// Píldora de la barra superior: una cápsula con relleno proporcional y la
// etiqueta "5h 10%". Al pasar el mouse se alarga y muestra la hora de reinicio.

import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import St from "gi://St";

import { fraction, pctLabel } from "../../lib/levels.js";

const WIDTH = 62;
const WIDTH_HOVER = 106;
const FILL_MS = 700;
const HOVER_MS = 350;
const PULSE_TOGGLES = 6; // 3 destellos (encender + apagar)
const PULSE_STEP_MS = 300;

export const QuotaPill = GObject.registerClass(
class QuotaPill extends St.Widget {
  _init() {
    super._init({
      style_class: "cqm-pill",
      layout_manager: new Clutter.BinLayout(),
      reactive: true,
      track_hover: true,
      y_align: Clutter.ActorAlign.CENTER,
      width: WIDTH,
      clip_to_allocation: true,
    });
    this._fill = new St.Widget({
      style_class: "cqm-pill-fill cqm-level-0",
      x_align: Clutter.ActorAlign.START,
      y_expand: true,
      y_align: Clutter.ActorAlign.FILL,
      width: 0,
    });
    this._text = new St.Label({ style_class: "cqm-pill-label", text: "…" });
    this._tail = new St.Label({ style_class: "cqm-pill-label cqm-pill-tail", text: "", opacity: 0, visible: false });
    const labels = new St.BoxLayout({ x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER });
    labels.add_child(this._text);
    labels.add_child(this._tail);
    this.add_child(this._fill);
    this.add_child(labels);

    this._frac = 0;
    this._level = 0;
    this._pulseId = 0;
    this.connect("notify::hover", () => this._onHover());
    this.connect("destroy", () => this._stopPulse());
  }

  _targetWidth() {
    return this.hover && this._tail.text ? WIDTH_HOVER : WIDTH;
  }

  _easeFill(duration) {
    this._fill.ease({
      width: Math.round(this._targetWidth() * this._frac),
      duration,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD,
    });
  }

  // util === undefined: cargando.
  setQuota({ prefix, util, level, resetShort }) {
    const loading = util === undefined;
    this._frac = loading ? 0 : fraction(util);
    this._text.text = loading ? "…" : `${prefix} ${pctLabel(util)}`;
    this._tail.text = resetShort ? ` · ${resetShort}` : "";
    if (level !== this._level) {
      this._fill.remove_style_class_name(`cqm-level-${this._level}`);
      this._fill.add_style_class_name(`cqm-level-${level}`);
      this._level = level;
    }
    this._easeFill(FILL_MS);
  }

  setStale(stale) {
    this.opacity = stale ? 128 : 255;
  }

  _onHover() {
    const showTail = this.hover && !!this._tail.text;
    this.ease({ width: this._targetWidth(), duration: HOVER_MS, mode: Clutter.AnimationMode.EASE_OUT_QUAD });
    this._easeFill(HOVER_MS);
    if (showTail) this._tail.visible = true;
    this._tail.ease({
      opacity: showTail ? 255 : 0,
      duration: HOVER_MS,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD,
      onComplete: () => {
        if (!this.hover) this._tail.visible = false;
      },
    });
  }

  // Resplandor rojo que se enciende y apaga 3 veces y se detiene.
  pulse() {
    this._stopPulse();
    let toggles = 0;
    this._pulseId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, PULSE_STEP_MS, () => {
      toggles++;
      if (toggles % 2) this.add_style_class_name("cqm-pill-glow");
      else this.remove_style_class_name("cqm-pill-glow");
      if (toggles < PULSE_TOGGLES) return GLib.SOURCE_CONTINUE;
      this._pulseId = 0;
      return GLib.SOURCE_REMOVE;
    });
  }

  _stopPulse() {
    if (this._pulseId) {
      GLib.Source.remove(this._pulseId);
      this._pulseId = 0;
    }
    this.remove_style_class_name("cqm-pill-glow");
  }
});
