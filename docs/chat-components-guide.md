# Chat 组件移植学习指南

> 本文档详细说明从 `claudecodeui` 项目移植到本项目的 Claude 风格聊天组件的设计思路、文件结构和核心实现。阅读本文后，你将能够理解每个组件的职责、消息类型的扩展方式，以及工具渲染的流程。

---

## 目录

1. [整体架构](#整体架构)
2. [核心类型定义](#核心类型定义)
3. [消息列表层：ChatMessagesPane](#消息列表层-chatmessagespane)
4. [消息渲染层：ClaudeMessage](#消息渲染层-claudemessage)
5. [Markdown 渲染：MarkdownRenderer](#markdown-渲染-markdownrenderer)
6. [工具渲染系统](#工具渲染系统)
7. [交互辅助组件](#交互辅助组件)
8. [样式方案：CSS Modules](#样式方案-css-modules)
9. [集成与使用](#集成与使用)
10. [连接 Claude Code CLI](#连接-claude-code-cli)
11. [扩展指南](#扩展指南)

---

## 整体架构

移植后的 chat 模块采用**三层架构**：

```
数据层 (ChatMessage[])
    ↓
列表层 (ChatMessagesPane)  →  负责滚动容器、空状态、key 管理、加载指示器
    ↓
消息层 (ClaudeMessage)     →  负责单条消息的完整渲染（头像、气泡、类型分支、复制按钮）
    ↓
渲染层 (MarkdownRenderer / ToolRenderer / MessageCopyControl)
    →  具体内容的渲染
```

### 文件清单

```
src/components/chat/
├── types.ts                          # 消息类型、Provider 类型、工具结果类型
├── ChatMessagesPane.tsx              # 消息列表容器
├── ChatMessagesPane.module.css
├── ClaudeMessage.tsx                 # 核心消息组件（所有 type 分支）
├── ClaudeMessage.module.css
├── MarkdownRenderer.tsx              # Markdown + 代码块复制 + GFM 表格
├── MarkdownRenderer.module.css
├── MessageCopyControl.tsx            # 复制按钮（带 Markdown / Plain Text 切换）
├── MessageCopyControl.module.css
├── AssistantThinkingIndicator.tsx    # 底部 "Thinking..." 加载动画
├── AssistantThinkingIndicator.module.css
└── tools/
    ├── index.ts                      # 统一导出
    ├── ToolRenderer.tsx              # 工具消息渲染器
    ├── toolConfigs.ts                # 各类工具的显示配置表
    ├── CollapsibleDisplay.tsx        # 可折叠工具面板
    ├── CollapsibleSection.tsx        # 折叠面板的内部区块
    └── OneLineDisplay.tsx            # 单行工具展示（如 Bash、Read）
```

### 与原项目的主要差异

| 原项目 (claudecodeui) | 本项目 (robot-front-next) |
|---|---|
| Tailwind CSS | CSS Modules（`*.module.css`） |
| `i18next` 国际化 | 硬编码中英文字符串 |
| `SessionProviderLogo` 外部组件 | 内联 `ProviderLogo` SVG 组件 |
| WebSocket hooks 驱动消息流 | 由父组件 `ChatArea` 传入 `chatMessages` + `isLoading` |

---

## 核心类型定义

### `SessionProvider`

```ts
export type SessionProvider = 'claude' | 'cursor' | 'codex' | 'gemini';
```

决定头像图标和发送者名称。`ClaudeMessage` 内部通过 `ProviderLogo` 组件根据 `provider` 渲染对应的 SVG。

### `ChatMessage`

```ts
export interface ChatMessage {
  type: 'user' | 'assistant' | 'tool' | 'error';
  content?: string;
  timestamp: string | number | Date;
  images?: ChatImage[];
  reasoning?: string;              // 关联在普通 assistant 消息上的思考过程
  isThinking?: boolean;            // 独立的 thinking 气泡
  isStreaming?: boolean;
  isInteractivePrompt?: boolean;   // 交互式选择面板
  isToolUse?: boolean;             // 包含 toolInput / toolResult 的 assistant 消息
  toolName?: string;
  toolInput?: unknown;
  toolResult?: ToolResult | null;
  toolId?: string;
  toolCallId?: string;
  isSubagentContainer?: boolean;
  subagentState?: {
    childTools: SubagentChildTool[];
    currentToolIndex: number;
    isComplete: boolean;
  };
  isTaskNotification?: boolean;
  taskStatus?: 'pending' | 'running' | 'completed';
  displayText?: string;            // 工具消息前额外显示的人类可读说明
  id?: string;
  messageId?: string;
  blobId?: string;
  rowid?: string | number;
  sequence?: string | number;
}
```

**设计要点**：

- `type` 只有 4 种基础类型，**工具调用通过 `isToolUse = true` 叠加在 `assistant` 类型上**，而不是单独一种 `type`。
- `reasoning` 和 `isThinking` 是两种不同的“思考”形态：
  - `reasoning` 是 assistant 消息头部可折叠的 `<details>` 面板。
  - `isThinking` 是一条**独立**的灰度折叠消息，通常在流式输出中间出现。
- `displayText` 用于在工具卡片上方先渲染一段自然语言说明，让对话更流畅。

---

## 消息列表层：ChatMessagesPane

### 职责

1. 提供可滚动容器（`overflow-y: auto`）。
2. 空状态时显示占位文案。
3. 为每条消息生成**稳定唯一的 React key**。
4. 在列表末尾追加 `AssistantThinkingIndicator`（当 `isLoading = true`）。

### Key 稳定策略

`ChatMessagesPane` 内部维护三个 `useRef`：

```ts
const messageKeyMapRef = useRef<WeakMap<ChatMessage, string>>(new WeakMap());
const allocatedKeysRef = useRef<Set<string>>(new Set());
const generatedCounterRef = useRef(0);
```

生成 key 的优先级：

1. 如果 `WeakMap` 中已有映射，直接复用。
2. 依次尝试 `id` → `messageId` → `toolId` → `toolCallId` → `blobId` → `rowid` → `sequence`。
3. 如果都没有， fallback 到 `timestamp + toolName + contentPreview`。
4. 若出现冲突（`allocatedKeysRef.has(candidateKey)`），追加递增计数器直到唯一。

**为什么不用数组索引 `index` 作为 key？**

聊天列表会频繁追加、插入或更新内容，使用索引会导致 React 错误复用 DOM，造成消息闪烁、复制按钮状态串位等问题。

### Props

```ts
interface ChatMessagesPaneProps {
  chatMessages: ChatMessage[];
  isLoading?: boolean;
  provider?: SessionProvider;
  showThinking?: boolean;
  autoExpandTools?: boolean;
  showRawParameters?: boolean;
  onFileOpen?: (filePath: string, diffInfo?: any) => void;
}
```

---

## 消息渲染层：ClaudeMessage

### 职责

`ClaudeMessage` 是所有消息类型的**统一入口**。它根据 `message.type` 和一系列 boolean 标志决定渲染哪条分支。

### 核心渲染分支

```
message.type === 'user'
    ↓
    用户气泡（蓝色，靠右）+ 图片网格 + 时间 + 复制按钮

message.isTaskNotification
    ↓
    行内任务通知（小圆点 + 文案）

else（assistant / tool / error）
    ↓
    头像 + 发送者名称
        ↓
        message.isToolUse ? ToolRenderer 分支
        message.isInteractivePrompt ? 交互式面板分支
        message.isThinking ? Thinking 折叠面板
        默认 assistant 分支（Markdown / JSON Block / reasoning）
```

### 细节解析

#### 1. Grouped 样式

当**上一条消息和本条消息类型相同**时（且类型为 `user` / `assistant` / `tool` / `error`），隐藏头像和发送者名称，并追加 `.grouped` 类：

```css
.grouped {
  margin-top: 4px;
}
.grouped.assistantRow,
.grouped.toolRow,
grouped.errorRow {
  padding-left: 42px;   /* 头像 32px + margin-right 10px */
}
.grouped.userRow {
  padding-right: 42px;
}
```

这样连续的多条 assistant 消息左侧会与第一条消息对齐，不会因为没有头像而缩进来。

#### 2. 复制按钮控制

```ts
const COPY_HIDDEN_TOOL_NAMES = new Set(['Bash', 'Edit', 'Write', 'ApplyPatch']);
```

对于这类工具调用结果（如代码执行、文件编辑），ClaudeMessage 会隐藏消息的复制按钮，因为这些内容通常冗长且不适合一键复制。

#### 3. usage limit 提示格式化

```ts
function formatUsageLimitText(text: string): string
```

把后端返回的 `Claude AI usage limit reached|<timestamp>` 转换为可读的 Markdown 提示，例如：

> Claude usage limit reached. Your limit will reset at **14:30** - 2 Apr 2026

#### 4. JSON Block 自动检测

如果 assistant 消息的内容 trimmed 后以 `{` 或 `[` 开头并以 `}` 或 `]` 结尾，组件会尝试 `JSON.parse`：
- 成功 → 渲染成带标题栏的深色 JSON 代码块。
- 失败 → 回退到普通 Markdown 渲染。

---

## Markdown 渲染：MarkdownRenderer

### 技术栈

- `react-markdown` 解析 Markdown AST
- `remark-gfm` 支持 GitHub Flavored Markdown（表格、删除线、任务列表等）

### 特性

#### 1. 代码块增强

`CodeBlock` 子组件接管了 `<code>` 标签的渲染：

- **内联代码**：浅灰底色、圆角、`#e83e8c` 文字色。
- **多行代码块**：
  - 深色卡片容器（`#1e1e1e`）
  - 顶部语言标签栏（解析 `language-xxx` className）
  - **复制按钮**：点击后显示 "Copied" 状态 2 秒

#### 2. 覆盖的组件映射

```ts
components={{
  code: CodeBlock,
  p: ...,
  ul/ol/li: ...,
  a: ...,        // 自动 target="_blank" rel="noopener noreferrer"
  table: ...,    // 外层包裹 overflow-x:auto
  th/td: ...,    // 边框 + padding
  blockquote: ...,
  h1/h2/h3/h4: ...,
}}
```

---

## 工具渲染系统

工具消息不直接写在 `ClaudeMessage` 里，而是通过 `ToolRenderer` 分派，保持单一职责。

### 数据流

```
ClaudeMessage (isToolUse)
    → ToolRenderer (根据 toolName 和 mode 匹配配置)
        → OneLineDisplay   (简单单行：Bash / Read / Grep)
        → CollapsibleDisplay (可折叠详情：Edit / Write / TodoWrite / AskUserQuestion)
```

### toolConfigs.ts 设计

每种工具对应一个 `ToolDisplayConfig`，包含 `input` 和 `result` 两套显示规则：

```ts
export interface ToolDisplayConfig {
  input: {
    type: 'one-line' | 'collapsible' | 'hidden';
    icon?: string;
    label?: string;
    getValue?: (input: any) => string;      // 主文本
    getSecondary?: (input: any) => string;  // 副文本
    action?: 'copy' | 'open-file' | 'jump-to-results' | 'none';
    title?: string | ((input: any) => string);
    defaultOpen?: boolean;
    contentType?: 'diff' | 'markdown' | 'file-list' | 'todo-list' | 'text' | ...;
    getContentProps?: (input: any, helpers?: any) => any;
  };
  result?: {
    hidden?: boolean;
    hideOnSuccess?: boolean;
    type?: 'one-line' | 'collapsible' | 'special';
    // ...
  };
}
```

**注册表示例**：

```ts
Bash: {
  input: {
    type: 'one-line',
    icon: 'terminal',
    getValue: (input) => input.command,
    getSecondary: (input) => input.description,
    action: 'copy',
    style: 'terminal',
    wrapText: true,
  },
  result: { hideOnSuccess: true },  // 成功时不显示结果卡片
}
```

### shouldHideToolResult

在 `ClaudeMessage` 中调用，决定是否渲染 `toolResult`：

```ts
export function shouldHideToolResult(toolName: string, toolResult: any): boolean {
  const config = getToolConfig(toolName);
  if (config.result?.hidden) return true;
  if (config.result?.hideOnSuccess && toolResult && !toolResult.isError) return true;
  return false;
}
```

例如 `Bash` 执行成功后通常只显示命令本身，结果隐藏；但出错时会显示错误内容。

---

## 交互辅助组件

### AssistantThinkingIndicator

位于 `ChatMessagesPane` 列表最底部。 prop `selectedProvider` 决定文案前缀：

- `claude` → "Claude is thinking..."
- `cursor` → "Cursor is thinking..."
- `codex` → "Codex is thinking..."
- `gemini` → "Gemini is thinking..."

实现了一个三点呼吸动画 CSS。

### MessageCopyControl

气泡右下角的复制按钮，具备两种格式切换：

- **TXT**（纯文本）：去掉 Markdown 语法，方便直接粘贴到聊天框/编辑器。
- **MD**（原始 Markdown）：保留完整格式。

点击后显示对勾图标，2 秒后恢复。

---

## 样式方案：CSS Modules

原项目使用 Tailwind，但目标项目没有引入 Tailwind，因此全部采用 **CSS Modules** 重写。

### 命名规则

```css
/* 布局类 */
.messageRow / .userRow / .assistantRow / .toolRow / .errorRow
.messageContent
.bubble / .userBubble / .assistantBubble

/* 内容类 */
.assistantText / .userText
.thinkingWrapper / .thinkingSummary / .thinkingContent

/* 工具相关 */
.toolErrorBox / .toolErrorHeader / .toolErrorContent
.jsonBlockWrapper / .jsonBlockHeader / .jsonPre

/* 交互 */
.interactivePanel / .interactiveOption / .interactiveOptionSelected
```

### 样式关键决策

1. **消息宽度限制**：`max-width: 85%`，保证两侧留有空隙，不会顶到屏幕边缘。
2. **尖角朝向头像**：把圆角尖角从气泡底部改到了顶部：
   - `.userBubble` → `border-top-right-radius: 4px`
   - `.assistantBubble` → `border-top-left-radius: 4px`
3. **Grouped 对齐**：非首条 assistant/tool/error 消息通过 `padding-left: 42px` 抵消缺失头像占用的空间，实现左边缘严格对齐。

---

## 集成与使用

### 会话上下文与布局层级

`ChatSessionProvider` 负责管理聊天会话列表（创建、切换、删除、持久化）。它在 `MainLayout` 中全局注入，因此所有通过 `MainLayout` 渲染的页面共享同一套会话状态：

```tsx
// src/components/layout/MainLayout.tsx
<ChatSessionProvider>
  <FileSystemProvider>
    <div className={styles.layoutContainer}>
      <aside>{isSidebarOpen && <Sidebar />}</aside>
      <main>{children}</main>
      {/* ... */}
    </div>
  </FileSystemProvider>
</ChatSessionProvider>
```

`Sidebar` 依赖 `useChatSessions()` 显示会话列表；点击会话或新建会话时，若当前不在 `/chat` 页面会自动路由跳转。这保证了从任何页面切到聊天页时状态一致。

### ChatArea.tsx 中的使用方式

```tsx
import type { ChatMessage } from './chat/types';
import ChatMessagesPane from './chat/ChatMessagesPane';

export default function ChatArea() {
  const [messages, setMessages] = useState<ChatMessage[]>([...]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [mode, setMode] = useState<'chat' | 'terminal'>('chat');

  return (
    <div className={styles.chatArea}>
      {/* header + mode tabs ... */}

      <div className={styles.messagesContainer}>
        {/* Chat 和 Terminal 两个 Pane 同时挂载，通过 display 切换 */}
        <div style={{ display: mode === 'terminal' ? 'flex' : 'none' }}>
          <TerminalPane ... />
        </div>
        <div style={{ display: mode === 'chat' ? 'flex' : 'none' }}>
          <ChatMessagesPane
            chatMessages={messages}
            isLoading={isStreaming}
            provider="claude"
            showThinking={true}
            autoExpandTools={false}
            showRawParameters={false}
            onFileOpen={(filePath, diffInfo) => { ... }}
          />
        </div>
      </div>

      <ChatInput ... />
    </div>
  );
}
```

**为什么 chat 和 terminal 同时挂载？**

切换 `mode` 时只改变 CSS `display`，不卸载 DOM。这样 terminal 的 xterm.js 实例和滚动位置得以保留；切回 terminal tab 时状态完整恢复，无需重新初始化。

### CSS 容器调整

`.messagesContainer` 去掉了 `overflow-y: auto`，因为滚动职责已经下沉到 `ChatMessagesPane` 的 `.scrollContainer`。保留 `flex: 1` 让它占满可用高度即可：

```css
.messagesContainer {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-right: 8px;
  margin-bottom: 16px;
  min-height: 0;
}
```

---

## 连接 Claude Code CLI

本项目的 Chat 组件并不直接调用远程 API，而是通过一套**桥接服务（Bridge Server）**与本机安装的 `claude` CLI 进行双向通信。

### 为什么需要桥接服务？

Next.js 在开发模式下会频繁热重载（HMR），如果把 `claude` 子进程直接放在页面或 API Route 里管理，进程引用会在每次重载后丢失，导致会话断裂。因此我们在项目外单独启动一个轻量级 Node.js HTTP + WebSocket 服务（`src/server/claude-bridge.ts`），它专门负责：

1. **Spawn `claude` 子进程 / 伪终端**（chat 模式用 `child_process.spawn`，terminal 模式用 `node-pty`）。
2. **维护 WebSocket 会话**（`clientId → { chat?: RunState, terminal?: RunState }` 的 Map）。
3. **转发 JSON Lines 流**（chat 模式）或 **ANSI 数据流**（terminal 模式）。
4. **写入用户消息**（chat）或 **键盘输入**（terminal）。

### 两种运行模式

| 模式 | 启动方式 | 输出格式 | 适用场景 |
|---|---|---|---|
| **chat** | `claude --print --output-format=stream-json --input-format=stream-json` | JSON Lines 事件流 | 结构化渲染消息、工具调用、思考过程 |
| **terminal** | `node-pty` 伪终端（Windows: `cmd.exe /c claude`，Unix: `bash -c 'claude ...'`） | 原始 ANSI TUI 输出 | 完整 CLI 交互体验（权限菜单、选择框、颜色等） |

### 数据流架构

```
用户输入
  ↓
ChatArea.tsx
  ↓ (WebSocket 发送，带 mode 参数)
ClaudeBridgeClient  →  ws://localhost:3002/claude
  ↓
claude-bridge.ts (Node.js 进程)
  ├─ chat run    → child_process.spawn → claude CLI (pipe 模式)
  └─ terminal run → node-pty.spawn      → claude CLI (PTY 模式)
  ↓ (stdout / PTY onData)
claude-bridge.ts
  ├─ chat    → assistant.chunk (JSON Lines)
  └─ terminal → terminal.data (ANSI 字符串)
  ↓ (WebSocket 推送)
ChatArea.tsx
  ├─ chat    → 逐行解析 → 更新 messages 状态 → ClaudeMessage / ToolRenderer
  └─ terminal → 写入 xterm.js → 终端渲染
```

### 双模式并发设计

一个 WebSocket 连接（一个前端页面）可以同时维护 **一个 chat run 和一个 terminal run**。两者互不干扰：

- 切换 chat / terminal tab 时**不会**关闭另一个模式的进程。
- 只有以下情况才会全部清理：
  - 用户切换历史会话（`currentSessionId` 改变）
  - 用户主动关闭会话（`session.close`）
  - WebSocket 断开

后端 `ClientSession` 的数据结构：

```ts
interface ClientSession {
  socket: WebSocket;
  runs: {
    chat?: RunState;      // pipe 子进程
    terminal?: RunState;  // node-pty 实例
  };
}
```

### Terminal 懒加载

Terminal 模式下的 `claude` PTY 进程**不会**在页面加载时立即启动。只有当用户第一次点击切换到 terminal tab 时，前端才发送 `session.start { mode: 'terminal' }`。这减少了不必要的资源消耗，也避免了初始加载时的双重进程开销。

Chat 模式的进程则在进入会话时立即启动（`session.start { mode: 'chat' }`），因为 chat 是主要交互界面。

### 核心协议

#### 1. 启动 `claude` 进程

Bridge Server 在收到前端的 `session.start` 后，根据 `mode` 选择启动方式：

**chat 模式：**

```ts
const proc = spawn('claude', [
  '--print',
  '--output-format=stream-json',
  '--input-format=stream-json',
  '--verbose',
  '--no-session-persistence',
], {
  cwd: projectPath,
  env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', NODE_ENV: 'production' }
});
```

- `--print` 让 CLI 进入非交互式管道模式。
- `--output-format=stream-json` 让 stdout 输出类似 Anthropic API 的流式 JSON 事件。
- `--input-format=stream-json` 让 stdin 接收同样的 JSON Lines 格式。

**terminal 模式：**

```ts
const ptyProcess = ptyModule.spawn('cmd.exe', ['/c', 'claude', ...args], {
  name: 'xterm-256color',
  cols: 120,
  rows: 30,
  cwd: projectPath,
  env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', FORCE_COLOR: '1' }
});
```

- 通过 shell 包装启动 `claude`，让 CLI 认为自己运行在真实终端中。
- 使用 `xterm-256color` 启用完整的 ANSI 颜色和 TUI 渲染。
- **不**使用 `--print` 和 stream-json，保持原生交互行为。
- 跳过权限确认时只传 `--permission-mode bypassPermissions`（不传 `--dangerously-skip-permissions`，后者在 PTY 启动时会弹出阻塞式确认菜单）。

#### 2. WebSocket 消息类型

**前端发送给桥接服务：**

| 消息类型 | 说明 | 目标模式 |
|---|---|---|
| `session.start` | 启动一个新的 `claude` 会话。需指定 `mode: 'chat' \| 'terminal'` | 两者 |
| `message.send` | 发送用户消息（JSON Lines 格式） | chat |
| `message.send_raw` | 发送原始 JSON 负载到 stdin | chat |
| `permission.response` | 回复权限请求（`requestId`, `allow`） | chat |
| `terminal.input` | 发送键盘输入字符串到 PTY | terminal |
| `terminal.resize` | 调整 PTY 尺寸（`cols`, `rows`） | terminal |
| `session.interrupt` | 中断当前流式输出（发送 `Ctrl+C`） | 两者 |
| `session.close` | 关闭所有 runs 并清理会话 | 两者 |

**桥接服务推送给前端：**

| 消息类型 | 说明 | 来源模式 |
|---|---|---|
| `connected` | 握手成功，返回 `clientId` | — |
| `session.started` | `claude` 子进程已启动，返回 `runId` 和 `mode` | 两者 |
| `assistant.chunk` | 从 `claude` stdout 读取到的一行原始 JSON | chat |
| `terminal.data` | PTY 输出的原始 ANSI 数据块 | terminal |
| `session.ended` | 会话正常结束或异常退出 | 两者 |
| `error` | 错误信息 | 两者 |

#### 3. 前端流解析 (`ClaudeBridgeClient.ts`)

**chat 模式：**

客户端维护一个 `buffer`，每次收到 `assistant.chunk` 后执行：

```ts
buffer += chunk;
const lines = buffer.split('\n');
buffer = lines.pop()!; // 最后一行可能不完整，留到下次

for (const line of lines) {
  if (!line.trim()) continue;
  const event = JSON.parse(line);
  onEvent(event); // 抛给 ChatArea.tsx
}
```

常见的事件类型：

| 事件 | 含义 | UI 映射 |
|---|---|---|
| `assistant` | 新 assistant 消息开始 | 追加 `type: 'assistant'`, `isStreaming: true` |
| `content_block_start` + `text` | 文本块准备 | 准备好 `content` 容器 |
| `content_block_delta` + `text_delta` | 文本增量 | `content += delta.text` |
| `content_block_delta` + `thinking_delta` | 思考增量 | `reasoning += delta.thinking`, `isThinking: true` |
| `content_block_start` + `tool_use` | 工具调用开始 | `isToolUse: true`, `toolName`, `toolId` |
| `content_block_delta` + `input_json_delta` | 工具参数增量 | `toolInput` 累加 JSON 字符串 |
| `content_block_stop` | 块结束 | 尝试 `JSON.parse(toolInput)` |
| `message_stop` / `result` | 消息结束 | `isStreaming: false` |
| `error` | 错误 | 追加 `type: 'error'` 消息 |

**terminal 模式：**

收到 `terminal.data` 后直接追加到 xterm.js 的 buffer：

```ts
terminalPaneRef.current?.write(data);
```

xterm.js 负责解析 ANSI escape sequences 并渲染完整的 TUI 界面。

### 文件上传的处理方式

因为 `claude` CLI 在 `--print` 模式下只能读取文本或本地文件路径，我们不能直接把浏览器里的 `File` 对象传给进程。当前方案如下：

1. 用户在输入框复制/粘贴图片。
2. 前端将图片转为 base64，调用 `POST /api/upload`。
3. 服务端把图片写入项目目录下的 `.claude-uploads/` 文件夹。
4. 服务端返回**相对路径**（例如 `.claude-uploads/image.png`），避免暴露服务器绝对路径。
5. 前端把相对路径拼进消息文本（如 `"请看这张图片 .claude-uploads/image.png"`），连同文字一起发给 `claude`。
6. UI 层使用 `sanitizeServerPaths()` 和 `displayFilePath()` 进一步隐藏路径细节，只展示文件名或 `.claude-uploads/...` 后缀。

### 关于权限提示

**chat 模式：** 在 `--print` 模式下，`claude` **不会**弹出交互式权限确认（例如 "Allow reading files?"）。如果某条操作需要权限而被拒绝，CLI 会在流中返回一个 `user` 类型事件，内部携带 `tool_result` 且 `is_error: true`，对应内容会渲染为错误气泡（红色边框 + 错误文案）。因此 Web 端无需、也无法实现类似 CLI TTY 的 "允许 / 拒绝" 按钮。

**terminal 模式：** 由于运行在 PTY 中，`claude` CLI 会显示完整的 TUI 权限菜单（y/n 确认、方向键选择等）。用户直接在终端内用键盘交互即可。前端通过 `terminal.input` 把按键转发到 PTY，体验与本地终端完全一致。

---

## 扩展指南

### 1. 新增一种工具展示样式

以假设的工具 `Deploy` 为例：

**步骤 1**：在 `toolConfigs.ts` 中注册

```ts
Deploy: {
  input: {
    type: 'one-line',
    label: 'Deploy',
    getValue: (input) => input.environment || 'production',
    getSecondary: (input) => input.region,
    action: 'none',
    icon: 'rocket',
  },
  result: {
    type: 'collapsible',
    title: 'Deployment log',
    contentType: 'text',
    getContentProps: (result) => ({ content: String(result.content || ''), format: 'code' }),
  },
}
```

**步骤 2**：如果 `contentType` 是已有类型（`text` / `markdown` / `file-list` / ...），`ToolRenderer.tsx` 已自动处理，无需改动。如果是全新展示形态（例如图表），在 `ToolRenderer` 的 `switch (displayConfig.contentType)` 中新增一个 `case` 并编写对应的 React 组件即可。

### 2. 新增一种消息类型

当前系统通过 `type` + boolean 标志混合扩展。如果新增一种完全独立的消息形态（例如 `image-generation`）：

1. 在 `types.ts` 的 `ChatMessage` 中新增标志，例如 `isImageGeneration?: boolean`。
2. 在 `ClaudeMessage.tsx` 的渲染分支中找到合适的位置插入判断。
3. 编写对应的展示组件和 CSS Module。

**不推荐**直接新增 `type: 'image_generation'`，因为 `ChatMessagesPane` 的 key 生成、grouped 判断、`rowClass` 映射都会需要同步修改。

### 3. 让工具结果默认展开

给对应工具的 `input` 或 `result` 配置里加上 `defaultOpen: true`：

```ts
Grep: {
  result: {
    type: 'collapsible',
    defaultOpen: true,  // ← 这里
    ...
  }
}
```

或者全局控制：给 `ChatMessagesPane` 传 `autoExpandTools={true}`，进入视口的工具卡片会自动展开。

---

## 常见坑

1. **React key 重复**：`isInteractivePrompt` 的解析逻辑从 message.content 中提取选项行，源数据里可能同时包含普通选项和 `❯` 高亮行。当前已修复为 `Map` 去重，优先保留 `isSelected` 版本。
2. **ToolRenderer 的 import 路径**：`shouldHideToolResult` 在 `toolConfigs.ts` 中导出，而不是 `ToolRenderer.tsx`。如果 import 错文件会导致编译报错。
3. **代码块的 inline / block 判定**：
   - `react-markdown` 传 `inline` 标志。
   - 我们通过正则检测内容是否包含换行符作为兜底，避免单行代码被错误渲染成大块卡片。

---

## 总结

这套移植的 chat 组件核心思路是：

- **类型层**：用一套统一的 `ChatMessage` + boolean 标志覆盖所有消息变体。
- **列表层**：采用 `WeakMap` 稳定 key，保证列表更新的性能与正确性。
- **渲染层**：`ClaudeMessage` 做顶层分支，`ToolRenderer` 做工具二次分派，`MarkdownRenderer` 做富文本渲染。
- **样式层**：全部 CSS Modules，不引入额外样式方案。

掌握以上结构后，你可以灵活地增加新消息类型、调整工具展示样式、或者接入真实的 WebSocket/API 数据流。
