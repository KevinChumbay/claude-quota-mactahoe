// Anillo de progreso estilo widget de macOS, con el porcentaje en el centro.
// animateTo() lo llena desde 0 y el número sube a la par.

import Clutter from "gi://Clutter";
import GObject from "gi://GObject";
import St from "gi://St";
import Cairo from "cairo";

import { colorFor, fraction, pctLabel } from "../../lib/levels.js";

const FILL_MS = 550;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

export const QuotaRing = GObject.registerClass(
class QuotaRing extends St.Widget {
  _init({ size = 64, width = 7 } = {}) {
    super._init({
      layout_manager: new Clutter.BinLayout(),
      width: size,
      height: size,
      x_align: Clutter.ActorAlign.CENTER,
    });
    this._lineWidth = width;
    this._util = null;
    this._shown = 0; // fracción dibujada ahora mismo (0..1)
    this._level = 0;
    this._light = false;
    this._timeline = null;

    this._area = new St.DrawingArea({ width: size, height: size });
    this._area.connect("repaint", area => this._repaint(area));
    this._label = new St.Label({
      style_class: size >= 56 ? "cqm-ring-label" : "cqm-ring-label cqm-ring-label-small",
      text: "–",
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
    });
    this.add_child(this._area);
    this.add_child(this._label);
    this.connect("destroy", () => this._stop());
  }

  setLight(light) {
    this._light = light;
    this._area.queue_repaint();
  }

  setStale(stale) {
    this.opacity = stale ? 115 : 255;
  }

  setValue(util, level) {
    this._stop();
    this._util = util;
    this._level = level;
    this._shown = fraction(util);
    this._label.text = pctLabel(util);
    this._area.queue_repaint();
  }

  animateTo(util, level) {
    this._stop();
    this._util = util;
    this._level = level;
    const target = fraction(util);
    const shownMax = util == null ? 0 : Math.round(util);
    this._timeline = new Clutter.Timeline({ actor: this, duration: FILL_MS });
    this._timeline.connect("new-frame", tl => {
      const k = tl.get_progress();
      const e = 1 - Math.pow(1 - k, 3);
      this._shown = target * e;
      this._label.text = util == null ? "–" : `${Math.round(shownMax * e)}%`;
      this._area.queue_repaint();
    });
    this._timeline.connect("completed", () => this.setValue(util, level));
    this._timeline.start();
  }

  _stop() {
    if (this._timeline) {
      this._timeline.stop();
      this._timeline = null;
    }
  }

  _repaint(area) {
    const cr = area.get_context();
    const [w, h] = area.get_surface_size();
    const scale = w / this.width;
    const lw = this._lineWidth * scale;
    const r = Math.min(w, h) / 2 - lw / 2;
    cr.setLineWidth(lw);
    cr.setLineCap(Cairo.LineCap.ROUND);
    if (this._light) cr.setSourceRGBA(0, 0, 0, 0.08);
    else cr.setSourceRGBA(1, 1, 1, 0.14);
    cr.arc(w / 2, h / 2, r, 0, 2 * Math.PI);
    cr.stroke();
    if (this._shown > 0.001) {
      const [cR, cG, cB] = hexToRgb(colorFor(this._level));
      cr.setSourceRGBA(cR, cG, cB, 1);
      cr.arc(w / 2, h / 2, r, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * this._shown);
      cr.stroke();
    }
    cr.$dispose();
  }
});
