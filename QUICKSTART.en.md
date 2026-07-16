> 中文: ./QUICKSTART.md

# kimi-room · running in 5 minutes

![license](https://img.shields.io/badge/license-AGPL%20v3-b13a5a?style=flat-square)
![pwa](https://img.shields.io/badge/pwa-ready-b13a5a?style=flat-square)
![status](https://img.shields.io/badge/status-attending-b13a5a?style=flat-square)

No coding needed. 0 servers, 0 domains, 0 monthly fees.

## One-click deploy (recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/marikagura/kimi-room)

Click the button above → Vercel does the rest automatically:

1. Asks you to sign in with GitHub (no account? make one · free)
2. Forks this repo to your GitHub automatically
3. Builds + deploys automatically · gives you an `xxx.vercel.app` URL in ~3 minutes
4. Open the URL and it works

All your data (chat · memory · calendar · finance) lives in **your own browser**.
The author can't see it. Vercel can't either (it only hosts the static site).

Want it on your iPhone home screen? Open `xxx.vercel.app` in Safari → Share → Add
to Home Screen → full-screen PWA.

## Alternative: one-click Netlify

If Vercel's phone-number verification blocks you / you'd rather not give a phone
number → use Netlify instead, same code, GitHub OAuth usually goes straight
through.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/marikagura/kimi-room)

Click the button → sign in with GitHub → it forks + builds automatically · in a
few minutes you get an `xxx.netlify.app` URL.

Installing the PWA to your home screen · where data is stored · everything is the
same as the Vercel section.

## Configure the LLM (optional)

After opening the site, click `settings` at the bottom-right and add a profile
under "LLM profiles":

- **Format** · `openai compat` (OpenAI / OpenRouter / DeepSeek / Zhipu / Qwen /
  local vLLM, etc.) or native `anthropic` (direct Claude API from the browser,
  no proxy needed)
- **endpoint** · base URL is enough · e.g. `https://api.deepseek.com` /
  `https://openrouter.ai/api/v1`
- **API key** · your own (stored only in your browser, never uploaded)
- **Models** · one per line, or click "fetch model list" to fill automatically

You can keep several profiles (one for DeepSeek, one for Claude, one for
OpenRouter). The strip above the chat composer switches profile + model any
time without going back to settings. temperature / max tokens live in
settings too.

It works without a key too · just the Heartbeat ✨ LLM button produces nothing
when pressed.

If you had the old single endpoint / key / model config, it migrates into the
first profile automatically.

## Make it your own (AI-assisted · no coding needed)

1. Copy the GitHub repo link: `https://github.com/marikagura/kimi-room`
2. Paste it to ChatGPT or Claude and say: "help me change xxx" · e.g.:
   - "change every '他' to '(his name)'"
   - "change the home accent color to blue"
   - "add a todo-list module"
3. The LLM gives you changed code → commit to your forked repo → Vercel
   auto-redeploys

## Run it on your own computer (dev only)

```bash
git clone https://github.com/marikagura/kimi-room.git
cd kimi-room
npm install
npm run dev
# http://localhost:3000
```

## Can I just use the author's URL?

No. There is no public hosted URL. This repo = a recipe for you to run yourself,
not a storefront.

The data is entirely your own. After a one-click deploy = your private PWA.
