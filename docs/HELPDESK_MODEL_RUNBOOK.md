# AgoraNet helpdesk model: reboot and recovery

This runbook restores the testnet AI helpdesk after the Linux model computer
reboots, loses power, or stops answering. It assumes no Linux or Cloudflare
experience.

Last verified: 2026-08-23.

## What has to be working

The request path has four parts:

1. The AgoraNet app runs on Vercel.
2. Cloudflare Access checks the app's private service credential.
3. The `agoranet-helpdesk` Cloudflare Tunnel carries the request to the Linux computer.
4. Ollama runs `gemma4:e4b` on that computer.

Ollama listens only on `127.0.0.1:11434`. That is intentional. Never change it
to a public network address. Cloudflare is the only public path to the model.

## Normal reboot

On the Linux computer, save any open work and run:

```bash
sudo reboot
```

After the computer restarts and you can open its terminal, run these checks in
order.

### 1. Confirm both background services started

```bash
systemctl is-enabled ollama
systemctl is-active ollama
systemctl is-enabled cloudflared
systemctl is-active cloudflared
```

Expected result: `enabled`, `active`, `enabled`, `active`.

`ollama` serves the model. `cloudflared` is the private connector to
Cloudflare. Both are configured as system services and should start without
Hermes or a browser being open.

### 2. Confirm Ollama answers locally

```bash
curl -fsS http://127.0.0.1:11434/api/version
```

Expected result: JSON containing an Ollama version, such as
`{"version":"0.24.0"}`.

### 3. Load Gemma into the GPU

A reboot clears GPU memory. Load the model again with this harmless one-word
request:

```bash
curl -fsS http://127.0.0.1:11434/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"model":"gemma4:e4b","prompt":"Reply with OK only.","stream":false,"keep_alive":-1}'
```

The first request after a reboot may take longer while the model loads.

### 4. Confirm the model will remain loaded

```bash
ollama ps
```

Expected row:

```text
gemma4:e4b  ...  100% GPU  32768  Forever
```

The exact size and model ID may vary, but the model name, `100% GPU`, context
`32768`, and `Forever` are the important fields.

### 5. Confirm AgoraNet can reach the model

This final check can run on the Linux computer or the Mac. It does not need a
Cloudflare secret because it asks the public AgoraNet helpdesk; Vercel supplies
the private service credential on the server:

```bash
curl -fsS https://www.agoranet.ai/api/support \
  -H 'Content-Type: application/json' \
  --data '{"action":"ask","question":"I closed account setup and do not know where to go. What should I do?","context":{"clientVersion":"reboot-check"}}'
```

A healthy response is JSON with `"generated":true`, a plain-language answer,
and an approved help article such as `onboarding-interrupted`. Do not treat an
answer alone as proof of model health: AgoraNet can return safe approved text
when the model is unavailable. Check the `generated` field.

## Fast recovery when something fails

Run only the row that matches what you see.

| Symptom | Meaning | Safe action |
|---|---|---|
| `ollama` is not active | The local model service stopped. | Run `sudo systemctl restart ollama`, then repeat checks 2–4. |
| Ollama answers but `ollama ps` is empty | The service works, but Gemma is not loaded. | Repeat check 3, then check 4. |
| `cloudflared` is not active | The Linux computer is not connected to the Cloudflare Tunnel. | Run `sudo systemctl restart cloudflared`, then repeat check 5. |
| Public model URL returns `403` with the known service token | Cloudflare Access rejected the application credential. | Check the matched Cloudflare service token and Vercel environment variables. Do not create another token first. |
| Public model URL returns `502` or `530` | Cloudflare cannot reach Ollama through the connector. | Check both services, local Ollama health, and the tunnel route. |
| AgoraNet answers with `"generated":false` | The site is serving its safe corpus fallback, but Gemma was not used. | Complete checks 1–5 and inspect the service logs below. |
| The Linux computer has no internet | Local Ollama can still answer, but Cloudflare and AgoraNet cannot reach it. | Restore the connection; do not change Cloudflare, Vercel, or model settings. |

## Read the service logs

These commands display recent errors without changing anything:

```bash
journalctl -u ollama -n 100 --no-pager
journalctl -u cloudflared -n 100 --no-pager
```

To watch new messages while running a test, use two terminal windows:

```bash
journalctl -u ollama -f
```

```bash
journalctl -u cloudflared -f
```

Press `Ctrl+C` to stop watching. This does not stop either service.

## Configuration that should not be changed during recovery

- Ollama model: `gemma4:e4b`
- Model context: `32768`
- Ollama address: `127.0.0.1:11434`
- Ollama keep-alive drop-in:
  `/etc/systemd/system/ollama.service.d/keepalive.conf`
- Cloudflare Tunnel: `agoranet-helpdesk`
- Tunnel destination: `http://127.0.0.1:11434`
- Tunnel origin HTTP Host Header: `localhost:11434`
- Protected hostname: `helpdesk-model.agoranet.ai`
- Vercel provider base URL: `https://helpdesk-model.agoranet.ai/v1`

Do not expose port `11434`, disable Cloudflare Access, create replacement
tokens, reinstall Ollama, pull another model, or edit the tunnel route as a
first troubleshooting step. The checks above identify which part failed before
any configuration changes are considered.

## If the whole computer was replaced

This is not a normal reboot. Stop and use the model-installation procedure plus
a new Cloudflare connector installation. The existing Vercel credential,
Access application, DNS record, and route do not need to be replaced merely
because the Linux hardware changed, but the connector credential must be
installed securely on the replacement computer.
