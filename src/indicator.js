// Indicador de la barra: dos píldoras, el menú, el ciclo de refresco y los avisos.

import GLib from "gi://GLib";
import GObject from "gi://GObject";
import St from "gi://St";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";

import { QuotaClient } from "./api.js";
import { MenuView } from "./menu.js";
import { Notifier } from "./notifier.js";
import { QuotaPill } from "./ui/pill.js";
import { parseUsage } from "../lib/usage.js";
import { levelFor } from "../lib/levels.js";
import { formatReset } from "../lib/format.js";
import { evaluateAlerts } from "../lib/alerts.js";
import { computeStatus } from "../lib/status.js";

const RETRY_NETWORK_S = 60;
const RETRY_AUTH_S = 300;

function parseJson(text, fallback) {
  try {
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

export const QuotaIndicator = GObject.registerClass(
class QuotaIndicator extends PanelMenu.Button {
  _init(ext) {
    super._init(0.5, "Claude Quota MacTahoe", false);
    this._settings = ext.getSettings();
    this._client = new QuotaClient();
    this._notifier = new Notifier(ext);
    this._timerId = 0;
    this._running = false;
    this._destroyed = false;
    this._plan = null;
    this._failures = 0;
    this._lastError = null;
    this._pillLevels = { five_hour: null, seven_day: null };

    const box = new St.BoxLayout({ style_class: "cqm-indicator-box" });
    this._sessionPill = new QuotaPill();
    this._weeklyPill = new QuotaPill();
    box.add_child(this._sessionPill);
    box.add_child(this._weeklyPill);
    this.add_child(box);

    this._view = new MenuView(this.menu, ext, () => this.refresh());
    this.menu.connect("open-state-changed", (_m, open) => {
      if (open) this._render(true);
    });

    this._usage = parseJson(this._settings.get_string("last-data"), null);
    this._lastOkMs = this._settings.get_int64("last-ok-ms");
    this._settingsIds = [
      this._settings.connect("changed::warn-threshold", () => this._render(false)),
      this._settings.connect("changed::crit-threshold", () => this._render(false)),
      this._settings.connect("changed::refresh-minutes", () => {
        if (!this._running) this._schedule(this._refreshSeconds());
      }),
    ];

    this._render(false);
    this.refresh();
  }

  _refreshSeconds() {
    return this._settings.get_uint("refresh-minutes") * 60;
  }

  _thresholds() {
    return { warn: this._settings.get_uint("warn-threshold"), crit: this._settings.get_uint("crit-threshold") };
  }

  _status() {
    return computeStatus({
      hasData: !!this._usage,
      lastOkMs: this._lastOkMs,
      failures: this._failures,
      lastError: this._lastError,
      nowMs: Date.now(),
    });
  }

  _schedule(seconds) {
    if (this._timerId) GLib.Source.remove(this._timerId);
    this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, seconds, () => {
      this._timerId = 0;
      this.refresh();
      return GLib.SOURCE_REMOVE;
    });
  }

  async refresh() {
    if (this._running || this._destroyed) return;
    this._running = true;
    this._view.setRunning(true);
    let delay = this._refreshSeconds();
    try {
      delay = await this._fetch();
    } catch (e) {
      logError(e, "claude-quota-mactahoe: refresh failed");
      this._fail("network");
      delay = RETRY_NETWORK_S;
    }
    if (this._destroyed || delay === null) return;
    this._running = false;
    this._view.setRunning(false);
    this._render(false);
    this._schedule(delay);
  }

  // Devuelve los segundos hasta el próximo intento, o null si se destruyó.
  async _fetch() {
    const cred = await this._client.readToken();
    if (cred === null || this._destroyed) return null;
    if (cred.error) return this._fail(cred.error, RETRY_AUTH_S);
    if (cred.expired) return this._fail("expired", RETRY_AUTH_S);

    const res = await this._client.fetchUsage(cred.token);
    if (res === null || this._destroyed) return null;
    if (res.status === 401 || res.status === 403) return this._fail("auth", RETRY_AUTH_S);
    if (res.status !== 200 || !res.data) return this._fail("network", Math.max(RETRY_NETWORK_S, res.retryAfter ?? 0));

    this._usage = parseUsage(res.data);
    this._lastOkMs = Date.now();
    this._failures = 0;
    this._lastError = null;
    this._settings.set_string("last-data", JSON.stringify(this._usage));
    this._settings.set_int64("last-ok-ms", this._lastOkMs);
    this._runAlerts();
    if (!this._plan) {
      this._plan = await this._client.fetchProfile(cred.token);
      if (this._destroyed) return null;
    }
    return this._refreshSeconds();
  }

  _fail(error, retry) {
    this._failures++;
    this._lastError = error;
    return retry;
  }

  _runAlerts() {
    const { warn, crit } = this._thresholds();
    const u = this._usage;
    const out = evaluateAlerts([u.session, u.weekly, ...u.models], parseJson(this._settings.get_string("alert-state"), {}), {
      warn,
      crit,
      enabled: this._settings.get_boolean("alerts-enabled"),
      notifyRelease: this._settings.get_boolean("notify-release"),
      now: new Date(),
    });
    this._settings.set_string("alert-state", JSON.stringify(out.state));
    for (const note of out.notifications) this._notifier.notify(note);
  }

  _renderPill(pill, prefix, quota, status, thresholds, now) {
    if (status.mode === "loading") {
      pill.setQuota({ prefix, util: undefined, level: 0, resetShort: "" });
      return;
    }
    const util = quota?.util ?? null;
    const level = levelFor(util, thresholds.warn, thresholds.crit);
    pill.setQuota({ prefix, util, level, resetShort: formatReset(quota?.resetsAt ?? null, now).short });
    pill.setStale(status.mode !== "fresh");
    const key = quota?.key;
    if (key && status.mode === "fresh") {
      const prev = this._pillLevels[key];
      if (level === 2 && prev !== null && prev < 2) pill.pulse();
      this._pillLevels[key] = level;
    }
  }

  _render(animate) {
    const status = this._status();
    const thresholds = this._thresholds();
    const now = new Date();
    this._renderPill(this._sessionPill, "5h", this._usage?.session, status, thresholds, now);
    this._renderPill(this._weeklyPill, "7d", this._usage?.weekly, status, thresholds, now);
    if (this.menu.isOpen || animate) {
      this._view.update({ usage: this._usage, plan: this._plan, status, ...thresholds, now, animate });
    }
  }

  destroy() {
    this._destroyed = true;
    if (this._timerId) GLib.Source.remove(this._timerId);
    this._timerId = 0;
    for (const id of this._settingsIds) this._settings.disconnect(id);
    this._settingsIds = [];
    this._client.destroy();
    this._notifier.destroy();
    this._view.destroy();
    super.destroy();
  }
});
