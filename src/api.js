// E/S de la extensión: lee (nunca escribe) el archivo de credenciales de
// Claude Code y consulta los endpoints OAuth de uso y perfil.

import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Soup from "gi://Soup?version=3.0";

import { tokenFromCredentials } from "../lib/credentials.js";
import { planFromProfile } from "../lib/usage.js";

Gio._promisify(Gio.File.prototype, "load_contents_async");
Gio._promisify(Soup.Session.prototype, "send_and_read_async");

const CREDENTIALS_PATH = GLib.build_filenamev([GLib.get_home_dir(), ".claude", ".credentials.json"]);
const PROFILE_URL = "https://api.anthropic.com/api/oauth/profile";
// Solo para pruebas: permite simular una red caída.
const USAGE_URL = GLib.getenv("CQM_USAGE_URL") || "https://api.anthropic.com/api/oauth/usage";

function isCancelled(e) {
  return e instanceof GLib.Error && e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED);
}

export class QuotaClient {
  constructor() {
    this._cancellable = new Gio.Cancellable();
    this._session = new Soup.Session({ timeout: 20, user_agent: "claude-quota-mactahoe" });
  }

  async readToken() {
    let text = null;
    try {
      const [contents] = await Gio.File.new_for_path(CREDENTIALS_PATH).load_contents_async(this._cancellable);
      text = new TextDecoder().decode(contents);
    } catch (e) {
      if (isCancelled(e)) return null;
      if (!(e instanceof GLib.Error && e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)))
        return { token: null, expired: false, error: "invalid" };
    }
    return tokenFromCredentials(text, Date.now());
  }

  async _get(url, token) {
    const msg = Soup.Message.new("GET", url);
    const headers = msg.get_request_headers();
    headers.append("Authorization", `Bearer ${token}`);
    headers.append("anthropic-version", "2023-06-01");
    headers.append("anthropic-beta", "oauth-2025-04-20");
    headers.append("Accept", "application/json");
    try {
      const bytes = await this._session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, this._cancellable);
      const status = msg.get_status();
      let data = null;
      if (status === 200) {
        try {
          data = JSON.parse(new TextDecoder().decode(bytes.toArray()));
        } catch {
          return { status: 0, data: null, retryAfter: null };
        }
      }
      const ra = parseInt(msg.get_response_headers().get_one("retry-after") ?? "", 10);
      return { status, data, retryAfter: Number.isFinite(ra) ? ra : null };
    } catch (e) {
      if (isCancelled(e)) return null;
      return { status: 0, data: null, retryAfter: null };
    }
  }

  fetchUsage(token) {
    return this._get(USAGE_URL, token);
  }

  async fetchProfile(token) {
    const res = await this._get(PROFILE_URL, token);
    return res?.status === 200 ? planFromProfile(res.data) : null;
  }

  destroy() {
    this._cancellable.cancel();
    this._session.abort();
    this._session = null;
  }
}
