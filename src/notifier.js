// Envía los avisos del motor de alertas como notificaciones de GNOME.

import Gio from "gi://Gio";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as MessageTray from "resource:///org/gnome/shell/ui/messageTray.js";

export class Notifier {
  constructor(ext) {
    this._gicon = Gio.icon_new_for_string(`${ext.path}/icons/claude-quota-symbolic.svg`);
    this._source = null;
  }

  _getSource() {
    if (!this._source) {
      this._source = new MessageTray.Source({ title: "Claude Code", icon: this._gicon });
      this._source.connect("destroy", () => {
        this._source = null;
      });
      Main.messageTray.add(this._source);
    }
    return this._source;
  }

  notify(note) {
    const source = this._getSource();
    const notification = new MessageTray.Notification({
      source,
      title: note.title,
      body: note.body,
      urgency: note.urgent ? MessageTray.Urgency.CRITICAL : MessageTray.Urgency.NORMAL,
    });
    source.addNotification(notification);
  }

  destroy() {
    this._source?.destroy();
    this._source = null;
  }
}
