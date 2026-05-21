# kimi-room · 5 分钟跑起来

![license](https://img.shields.io/badge/license-AGPL%20v3-b13a5a?style=flat-square)
![pwa](https://img.shields.io/badge/pwa-ready-b13a5a?style=flat-square)
![status](https://img.shields.io/badge/status-attending-b13a5a?style=flat-square)

完全不会代码也能用. 0 服务器, 0 域名, 0 月费.

## 一键部署 (推荐)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/marikagura/kimi-room)

点上面按钮 → 接下来 Vercel 全自动:

1. 让你用 GitHub 账号登录 (没账号就建一个 · 免费)
2. 自动 fork 这个 repo 到你的 GitHub
3. 自动 build + deploy · 3 分钟后给你一个 `xxx.vercel.app` 网址
4. 打开网址就能用

你的所有数据 (对话 · 记忆 · 日历 · 财务) 全部存在你**自己浏览器**里.
作者看不到. Vercel 也看不到 (它只 host 静态网页).

iPhone 上想加到主屏幕? Safari 打开 `xxx.vercel.app` → 分享 → 加到主屏幕 → 全屏 PWA.

## 备选: 一键 Netlify

Vercel 那个手机号 verification 卡住 / 不想给手机号 → 换 Netlify, 同一份代码, 一般 GitHub OAuth 直接过.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/marikagura/kimi-room)

点按钮 → GitHub 登录 → 自动 fork + build · 几分钟后拿到 `xxx.netlify.app` 网址.

PWA 装到主屏幕 · 数据存哪 · 一切都跟 Vercel 那一节一样.

## 配置 LLM (可选)

进网站后点右下角 `settings`, 填:

- **API endpoint** · 例 `https://api.openai.com/v1/chat/completions`
- **API key** · 你自己的 (仅存你浏览器, 不上传)
- **Model name** · 例 `gpt-4o-mini` / `claude-3-5-sonnet-20241022` / `deepseek-chat`

不填 key 也能用 · 只是 Heartbeat 的 ✨ LLM 按钮按了不出东西.

OpenAI 格式即可 (大部分服务商都支持). 国内可以用 DeepSeek / 智谱 / 通义千问.

## 改成你自己的版本 (LLM 辅助 · 不会代码也行)

1. 复制 GitHub repo 链接: `https://github.com/marikagura/kimi-room`
2. 贴给 ChatGPT 或 Claude, 说: "帮我改 xxx" · 例:
   - "把所有的 '他' 改成 '（他的名字）'"
   - "把首页主色换成蓝色"
   - "加一个 todo list 模块"
3. LLM 给你改后的代码 → commit 到你 fork 的 repo → Vercel 自动 redeploy

## 在自己电脑上跑 (仅 dev 用)

```bash
git clone https://github.com/marikagura/kimi-room.git
cd kimi-room
npm install
npm run dev
# http://localhost:3000
```

## 我能不能直接用作者的网址?

不能. 没有公共托管网址. 这个 repo = 给你自己跑的方子, 不是网店.

数据完全你自己的. 一键部署后 = 你的私有 PWA.
