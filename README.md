# TAOTAO

> **会写代码、会用工具、能自我验证的本地 AI Agent**
> An AI Agent that writes code, uses tools, and self-verifies — all on your machine.

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Platform: Windows](https://img.shields.io/badge/Platform-Windows-blue.svg)
![Electron](https://img.shields.io/badge/Electron-28-47848F.svg)

[中文](#中文) | [English](#english)

---

## 中文

### ✨ 特性

- 🧠 **多模型支持** — Agnes (文本/图片/视频) · GitHub Models · Groq
- 🛠️ **工具链** — 文件读写、Shell 命令、代码搜索、文件树浏览
- 🛡️ **危险命令拦截** — 自动识别 `rm -rf`、`format` 等破坏性操作
- ✅ **代码自动验证** — 改完代码自动跑测试/编译
- 💬 **多 Agent 模式** — 自动 / 规划 / 智能体 / 问答
- 🎨 **Codex 风格 UI** — 活动栏 + 侧边栏 + 深色主题
- 🌍 **中英双语切换** — 一键切换界面语言
- 📊 **审计日志** — 所有操作可追溯

### 📸 截图

*（待补充）*

### 🚀 快速开始

#### 1. 克隆仓库

```bash
git clone https://github.com/polojia997/agentai-taotao.git
cd agentai-taotao
```

#### 2. 安装依赖

```bash
npm install
```

#### 3. 配置 API Key

```bash
cp .env.example .env
# 编辑 .env，填入你的 API Key
```

> ⚠️ **不要把真实的 `.env` 提交到 GitHub！** `.gitignore` 已经排除了它。

#### 4. 启动开发模式

```bash
npm run dev
```

#### 5. 打包成 EXE

```bash
npm run build
npm run dist
```

打包产物在 `release\TAOTAO Setup 1.0.0.exe`

### 🔑 配置说明

| 变量 | 用途 | 必填 |
|---|---|---|
| `AGNES_API_KEY` | 文本/图片/视频生成（推荐） | ✅ |
| `GITHUB_TOKEN` | GitHub Models 免费模型 | ❌ |
| `GROQ_API_KEY` | Groq 高速推理 | ❌ |

- 申请 Agnes: <https://agnes-ai.com>
- 申请 GitHub PAT: <https://github.com/settings/tokens>
- 申请 Groq: <https://console.groq.com>

### ⌨️ 快捷键

| 快捷键 | 功能 |
|---|---|
| `Enter` | 发送消息 |
| `Shift+Enter` | 换行 |
| `/` | 触发命令 |
| `Ctrl+N` | 新建会话 |
| `Ctrl+B` | 切换侧边栏 |
| `Ctrl+J` | 切换终端 |

### 💝 支持作者

如果 TAOTAO 帮到了你，欢迎扫码请我喝杯咖啡 ☕

> 顶栏 → ❤️ 按钮 → 选择 微信/支付宝 扫码

微信 / 支付宝收款码位于 `assets/donate/`。

### 🤝 贡献

欢迎 PR、Issue、Star ⭐

### 📜 许可证

[MIT](./LICENSE) © 2026 polojia997

---

## English

### ✨ Features

- 🧠 **Multi-model** — Agnes (text/image/video) · GitHub Models · Groq
- 🛠️ **Toolchain** — file I/O, shell, code search, file tree
- 🛡️ **Dangerous command interception** — auto-blocks `rm -rf`, `format`, etc.
- ✅ **Auto code verification** — runs tests/builds after edits
- 💬 **Multi agent modes** — auto / plan / agent / ask
- 🎨 **Codex-style UI** — activity bar + side panel + dark theme
- 🌍 **i18n** — Chinese / English toggle
- 📊 **Audit log** — every action traceable

### 📸 Screenshots

*Coming soon*

### 🚀 Quick Start

#### 1. Clone

```bash
git clone https://github.com/polojia997/agentai-taotao.git
cd agentai-taotao
```

#### 2. Install

```bash
npm install
```

#### 3. Configure API Keys

```bash
cp .env.example .env
# Edit .env and fill in your API keys
```

> ⚠️ **Never commit the real `.env` to GitHub!** It's already in `.gitignore`.

#### 4. Dev Mode

```bash
npm run dev
```

#### 5. Build EXE

```bash
npm run build
npm run dist
```

Output: `release\TAOTAO Setup 1.0.0.exe`

### 🔑 Configuration

| Variable | Purpose | Required |
|---|---|---|
| `AGNES_API_KEY` | Text / image / video (recommended) | ✅ |
| `GITHUB_TOKEN` | GitHub Models free tier | ❌ |
| `GROQ_API_KEY` | Groq fast inference | ❌ |

- Agnes: <https://agnes-ai.com>
- GitHub PAT: <https://github.com/settings/tokens>
- Groq: <https://console.groq.com>

### ⌨️ Shortcuts

| Key | Action |
|---|---|
| `Enter` | Send message |
| `Shift+Enter` | Newline |
| `/` | Slash command |
| `Ctrl+N` | New chat |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+J` | Toggle terminal |

### 💝 Support

If TAOTAO helps you, buy me a coffee ☕

> Top bar → ❤️ icon → choose WeChat / Alipay

QR codes live in `assets/donate/`.

### 🤝 Contributing

PRs, issues, and stars ⭐ are welcome.

### 📜 License

[MIT](./LICENSE) © 2026 polojia997
