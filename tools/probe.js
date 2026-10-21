// Prueba manual del cliente fuera de GNOME Shell: gjs -m tools/probe.js
import GLib from "gi://GLib";

import { QuotaClient } from "../src/api.js";
import { parseUsage } from "../lib/usage.js";

const loop = new GLib.MainLoop(null, false);
const client = new QuotaClient();

async function main() {
  const cred = await client.readToken();
  print(`credenciales: error=${cred.error} vencido=${cred.expired}`);
  if (!cred.token) return;
  const res = await client.fetchUsage(cred.token);
  print(`uso: HTTP ${res.status} retryAfter=${res.retryAfter}`);
  if (res.data) print(JSON.stringify(parseUsage(res.data), null, 2));
  print(`plan: ${await client.fetchProfile(cred.token)}`);
}

main().catch(e => logError(e)).finally(() => {
  client.destroy();
  loop.quit();
});
loop.run();
