import Adw from "gi://Adw";
import Gio from "gi://Gio";
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

function spinRow(settings, key, title, subtitle, lower, upper) {
  const row = Adw.SpinRow.new_with_range(lower, upper, 1);
  row.title = title;
  row.subtitle = subtitle;
  settings.bind(key, row, "value", Gio.SettingsBindFlags.DEFAULT);
  return row;
}

function switchRow(settings, key, title, subtitle) {
  const row = new Adw.SwitchRow({ title, subtitle });
  settings.bind(key, row, "active", Gio.SettingsBindFlags.DEFAULT);
  return row;
}

export default class ClaudeQuotaPrefs extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings();
    const page = new Adw.PreferencesPage({ title: "General", icon_name: "preferences-system-symbolic" });

    const data = new Adw.PreferencesGroup({ title: "Actualización" });
    data.add(spinRow(settings, "refresh-minutes", "Cada cuántos minutos", "Consulta tus cuotas en Claude", 1, 60));
    page.add(data);

    const alerts = new Adw.PreferencesGroup({ title: "Avisos" });
    alerts.add(switchRow(settings, "alerts-enabled", "Avisarme al acercarme al límite", "Notificación normal al umbral de aviso y urgente al crítico"));
    const warn = spinRow(settings, "warn-threshold", "Umbral de aviso (%)", "La píldora se pone ámbar", 50, 99);
    const crit = spinRow(settings, "crit-threshold", "Umbral crítico (%)", "La píldora se pone roja", 51, 100);
    // El crítico siempre por encima del aviso.
    warn.connect("notify::value", () => {
      if (crit.value <= warn.value) crit.value = warn.value + 1;
    });
    crit.connect("notify::value", () => {
      if (crit.value <= warn.value) warn.value = crit.value - 1;
    });
    alerts.add(warn);
    alerts.add(crit);
    alerts.add(switchRow(settings, "notify-release", "Avisarme cuando se libere", "Cuando una cuota que pasó del aviso vuelve a estar disponible"));
    page.add(alerts);

    window.add(page);
    window.set_default_size(520, 560);
  }
}
