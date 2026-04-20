# Robot Front Next

基于 Next.js + TypeScript 构建的 Claude Code Web UI，通过本地桥接服务与本机 `claude` CLI 交互，提供结构化的聊天界面和完整的终端体验。

## 功能特性

- **双模式交互**：Chat 模式（结构化消息、工具调用、思考过程渲染）+ Terminal 模式（原生 CLI TUI，权限菜单、方向键选择等）
- **会话管理**：支持多会话切换、持久化历史记录
- **工具渲染**：Bash、Read、Edit、Write、Grep、TodoWrite 等工具调用的可视化展示
- **文件上传**：通过 `.claude-uploads/` 目录中转，支持图片和文本文件
- **实时流式输出**：WebSocket 双向通信，逐字渲染 assistant 回复

## 技术栈

- **框架**：Next.js 15 (App Router)
- **语言**：TypeScript
- **样式**：CSS Modules
- **终端**：xterm.js + node-pty
- **通信**：WebSocket（`ws` 库）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

> Terminal 模式需要可选依赖 `node-pty`。Windows 用户可能需要安装 [windows-build-tools](https://github.com/nodejs/node-gyp#on-windows) 才能编译成功。

### 2. 启动开发服务器

```bash
# 方式一：同时启动 Next.js + 桥接服务
npm run start:prod

# 方式二：分开启动（开发调试）
npm run dev        # Next.js 开发服务器（端口 3000）
npm run bridge     # 桥接服务（端口 3002）
```

### 3. 访问应用

打开 [http://localhost:3000](http://localhost:3000) 使用浏览器访问。

确保本地已安装 `claude` CLI（`npm install -g @anthropic-ai/claude-code`）。

## 项目结构

```
├── src/
│   ├── app/                    # Next.js App Router
│   ├── components/
│   │   ├── chat/               # 聊天组件（消息列表、渲染、工具卡片）
│   │   ├── ChatArea.tsx        # 聊天主区域（双模式切换、WebSocket 连接）
│   │   ├── Sidebar.tsx         # 侧边栏（会话列表、导航）
│   │   ├── TerminalPane.tsx    # 终端面板（xterm.js 封装）
│   │   └── layout/             # 布局组件
│   ├── contexts/
│   │   ├── ChatSessionContext.tsx   # 会话状态管理
│   │   └── FileSystemContext.tsx    # 文件系统状态
│   ├── server/
│   │   └── claude-bridge.ts    # WebSocket 桥接服务（独立 Node.js 进程）
│   └── lib/
│       └── ClaudeBridgeClient.ts    # 前端 WebSocket 客户端封装
├── docs/
│   └── chat-components-guide.md     # Chat 组件架构文档
└── CLAUDE.md / AGENTS.md       # 项目规范与 Agent 说明
```

## 架构要点

### 桥接服务（`claude-bridge.ts`）

独立的 HTTP + WebSocket 服务器，负责：
- **Chat 模式**：`child_process.spawn` 启动 `claude --print`，通过 JSON Lines 双向通信
- **Terminal 模式**：`node-pty` 启动伪终端，完整还原 CLI TUI 交互
- **双模式并发**：一个前端连接可同时维护 chat run 和 terminal run，切换 tab 不中断

详见 [`docs/chat-components-guide.md`](docs/chat-components-guide.md) → "连接 Claude Code CLI"。

### 双模式设计

- Chat 和 Terminal 两个 Pane **同时挂载**，通过 CSS `display` 切换可见性
- Terminal 采用**懒加载**：首次切换到 terminal tab 时才启动 PTY 进程
- 切换历史会话或断开 WebSocket 时，两个模式的进程一并清理

## 相关文档

- [Chat 组件架构指南](docs/chat-components-guide.md) — 消息类型、渲染流程、工具系统详解
- [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md) — 项目规范与开发约定

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
