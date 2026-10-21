// Contenido del menú desplegable (diseño M2): encabezado con plan, franja de
// datos viejos, dos mosaicos con anillo, anillos por modelo y botones.

import Clutter from "gi://Clutter";
import Gio from "gi://Gio";
import St from "gi://St";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

import { QuotaRing } from "./ui/ring.js";
import { levelFor } from "../lib/levels.js";
import { formatReset } from "../lib/format.js";

const USAGE_PAGE = "https://claude.ai/settings/usage";

function makeTile() {
  const box = new St.BoxLayout({ vertical: true, style_class: "cqm-tile", x_expand: true });
  const ring = new QuotaRing({ size: 64, width: 7 });
  const name = new St.Label({ style_class: "cqm-tile-name", x_align: Clutter.ActorAlign.CENTER });
  const reset = new St.Label({ style_class: "cqm-muted", x_align: Clutter.ActorAlign.CENTER });
  box.add_child(ring);
  box.add_child(name);
  box.add_child(reset);
  return { box, ring, name, reset };
}

function makeButton(iconName, text) {
  const child = new St.BoxLayout({ style_class: "cqm-btn-box" });
  const icon = new St.Icon({ icon_name: iconName, style_class: "cqm-btn-icon" });
  child.add_child(icon);
  if (text) child.add_child(new St.Label({ text, y_align: Clutter.ActorAlign.CENTER }));
  const button = new St.Button({ style_class: "cqm-btn", child, can_focus: true });
  return { button, icon };
}

export class MenuView {
  constructor(menu, ext, onRefresh) {
    this._menu = menu;
    this._interface = new Gio.Settings({ schema_id: "org.gnome.desktop.interface" });
    // El fondo lo dibuja .cqm-menu (claro u oscuro según el modo), no el tema,
    // para que el texto siempre contraste.
    menu.box.add_style_class_name("cqm-popup");

    const item = new PopupMenu.PopupBaseMenuItem({ reactive: false, can_focus: false, style_class: "cqm-menu-item" });
    this._root = new St.BoxLayout({ vertical: true, style_class: "cqm-menu", x_expand: true });
    item.add_child(this._root);
    menu.addMenuItem(item);

    // Encabezado
    const head = new St.BoxLayout({ style_class: "cqm-head" });
    const title = new St.BoxLayout({ x_expand: true, style_class: "cqm-title-box" });
    title.add_child(new St.Label({ text: "✳ Claude Code", style_class: "cqm-title", y_align: Clutter.ActorAlign.CENTER }));
    this._badge = new St.Label({ style_class: "cqm-badge", visible: false, y_align: Clutter.ActorAlign.CENTER });
    title.add_child(this._badge);
    this._ago = new St.Label({ style_class: "cqm-muted", y_align: Clutter.ActorAlign.CENTER });
    head.add_child(title);
    head.add_child(this._ago);
    this._root.add_child(head);

    this._banner = new St.Label({ style_class: "cqm-banner", visible: false });
    this._banner.clutter_text.line_wrap = true;
    this._root.add_child(this._banner);

    // Mosaicos
    this._grid = new St.BoxLayout({ style_class: "cqm-grid" });
    this._session = makeTile();
    this._weekly = makeTile();
    this._grid.add_child(this._session.box);
    this._grid.add_child(this._weekly.box);
    this._root.add_child(this._grid);

    this._models = new St.BoxLayout({ style_class: "cqm-models", visible: false });
    this._root.add_child(this._models);
    this._modelRings = [];

    // Pie
    const foot = new St.BoxLayout({ style_class: "cqm-foot" });
    const refresh = makeButton("view-refresh-symbolic", "Actualizar");
    this._refreshIcon = refresh.icon;
    this._refreshIcon.set_pivot_point(0.5, 0.5);
    refresh.button.connect("clicked", () => onRefresh());
    const web = makeButton("web-browser-symbolic", "claude.ai");
    web.button.connect("clicked", () => {
      Gio.AppInfo.launch_default_for_uri(USAGE_PAGE, global.create_app_launch_context(0, -1));
      menu.close();
    });
    const prefs = makeButton("emblem-system-symbolic", null);
    prefs.button.connect("clicked", () => {
      menu.close();
      ext.openPreferences();
    });
    foot.add_child(refresh.button);
    foot.add_child(new St.Widget({ x_expand: true }));
    foot.add_child(web.button);
    foot.add_child(prefs.button);
    this._root.add_child(foot);

    this._schemeId = this._interface.connect("changed::color-scheme", () => this._applyScheme());
    this._applyScheme();
  }

  _isLight() {
    return this._interface.get_string("color-scheme") !== "prefer-dark";
  }

  _applyScheme() {
    const light = this._isLight();
    if (light) this._root.add_style_class_name("cqm-light");
    else this._root.remove_style_class_name("cqm-light");
    for (const r of [this._session.ring, this._weekly.ring, ...this._modelRings.map(m => m.ring)]) r.setLight(light);
  }

  setRunning(running) {
    this._refreshIcon.remove_all_transitions();
    this._refreshIcon.rotation_angle_z = 0;
    if (running) {
      this._refreshIcon.ease({ rotation_angle_z: 360, duration: 800, repeatCount: -1, mode: Clutter.AnimationMode.LINEAR });
      this._ago.text = "actualizando…";
    }
  }

  _fillTile(tile, quota, opts, animate) {
    const level = levelFor(quota.util, opts.warn, opts.crit);
    const reset = formatReset(quota.resetsAt, opts.now);
    tile.name.text = quota.label;
    tile.reset.text = [reset.clock, reset.remaining].filter(Boolean).join(" · ");
    if (animate) tile.ring.animateTo(quota.util, level);
    else tile.ring.setValue(quota.util, level);
    tile.ring.setStale(opts.stale);
  }

  _fillModels(models, opts, animate) {
    this._models.destroy_all_children();
    this._modelRings = [];
    for (const m of models) {
      const box = new St.BoxLayout({ vertical: true, style_class: "cqm-model", x_expand: true });
      const ring = new QuotaRing({ size: 36, width: 4 });
      ring.setLight(this._isLight());
      const level = levelFor(m.util, opts.warn, opts.crit);
      if (animate) ring.animateTo(m.util, level);
      else ring.setValue(m.util, level);
      ring.setStale(opts.stale);
      box.add_child(ring);
      box.add_child(new St.Label({ text: m.label, style_class: "cqm-muted", x_align: Clutter.ActorAlign.CENTER }));
      this._models.add_child(box);
      this._modelRings.push({ ring });
    }
    this._models.visible = models.length > 0;
  }

  // usage: resultado de parseUsage o null; status: resultado de computeStatus.
  update({ usage, plan, status, warn, crit, now, animate }) {
    this._badge.text = plan ?? "";
    this._badge.visible = !!plan;
    this._ago.text = status.mode === "loading" ? "cargando…" : status.ago;
    this._banner.text = status.banner ?? "";
    this._banner.visible = !!status.banner;
    const hasData = !!usage && (status.mode === "fresh" || status.mode === "stale");
    this._grid.visible = hasData;
    if (!hasData) {
      this._models.visible = false;
      return;
    }
    const opts = { warn, crit, now, stale: status.mode === "stale" };
    this._fillTile(this._session, usage.session, opts, animate);
    this._fillTile(this._weekly, usage.weekly, opts, animate);
    this._fillModels(usage.models, opts, animate);
  }

  destroy() {
    if (this._schemeId) this._interface.disconnect(this._schemeId);
    this._schemeId = 0;
  }
}
