/**
 * claude-bridge.ts
 * =============================================================================
 * 这是一个独立的 Node.js HTTP + WebSocket 桥接服务器。
 * 它的核心职责是：在前端网页和本地安装的 `claude` CLI 之间搭建一条双向通信的隧道。
 *
 * 架构原因：为什么不放在 Next.js API Route 里？
 * ---------------------------------------------------------------------------
 * Next.js 在开发模式下会被 Turbopack 频繁热重载，导致全局缓存的子进程引用丢失、
 * 会话断裂。独立的桥接服务不受 Next.js 生命周期影响，能长期保持 `claude` 子进程
 * 和会话状态。
 *
 * 支持两种运行模式：
 * 1. chat 模式  : pipe (stdin/stdout) + JSON Lines 流式事件。
 *                 前端能结构化渲染 tool_use、thinking、文本块等。
 * 2. terminal 模式: node-pty 伪终端。
 *                 完全还原原生 CLI 的 TUI 交互（权限提示、选择菜单、ANSI 颜色等）。
 */

import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { spawn, type ChildProcess } from "child_process";

// =============================================================================
// 全局错误处理（防护 Windows 下 node-pty 的已知崩溃）
// =============================================================================

/**
 * Windows 上关闭 node-pty 的伪终端时，conpty agent 会抛出 `AttachConsole failed`
 * 的异常，直接杀死整个 Node 进程。
 * 这里显式捕获并忽略它，防止桥接服务器意外崩溃。
 */
process.on("uncaughtException", (err: any) => {
  if (typeof err?.message === "string" && err.message.includes("AttachConsole")) {
    console.warn("[claude-bridge] Ignored known Windows node-pty AttachConsole error");
    return;
  }
  console.error("[claude-bridge] Uncaught exception:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason: any) => {
  console.error("[claude-bridge] Unhandled rejection:", reason);
});

// =============================================================================
// 可选依赖：node-pty（仅在 terminal 模式下需要）
// =============================================================================
let ptyModule: typeof import("node-pty") | null = null;
try {
  ptyModule = require("node-pty");
} catch {
  // 如果用户没有安装 node-pty，则 terminal 模式会优雅回退到 chat 模式。
}

// =============================================================================
// 全局常量
// =============================================================================
const PORT = process.env.CLAUDE_BRIDGE_PORT ? parseInt(process.env.CLAUDE_BRIDGE_PORT, 10) : 3002;
const isWindows = process.platform === "win32";

// =============================================================================
// 类型定义
// =============================================================================

/**
 * RunState: 描述一个正在运行（或已结束）的 claude 会话。
 *
 * 字段说明：
 * - child: chat 模式下用 child_process.spawn 创建的子进程
 * - pty  : terminal 模式下用 node-pty 创建的伪终端实例
 * - mode : "chat" | "terminal"，决定后续与该 run 交互的方式
 * - buffer: 最近输出的环形缓冲，方便调试和回放
 * - status: idle | running | ended，状态机用于避免重复处理 exit 事件
 */
interface RunState {
  child?: ChildProcess;
  pty?: any;
  mode: "chat" | "terminal";
  runId: string;
  buffer: string[];
  status: "idle" | "running" | "ended";
  createdAt: number;
  sessionId?: string;
  projectPath?: string;
  allowedDirs?: string[];
  dangerouslySkipPermissions?: boolean;
  model?: string;
}

/**
 * ClientSession: 一个 WebSocket 连接对应的客户端会话。
 * 每个前端页面会建立一个 WebSocket，服务端为其维护最多一个 active RunState。
 */
interface ClientSession {
  socket: WebSocket;
  run?: RunState;
}

// 内存中的会话映射表：clientId -> ClientSession
const sessions = new Map<string, ClientSession>();

// =============================================================================
// 辅助函数：生成唯一 ID
// =============================================================================
function generateClientId(): string {
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function generateRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// =============================================================================
// 构建 claude CLI 启动参数
// =============================================================================

/**
 * buildClaudeArgs
 * ---------------------------------------------------------------------------
 * 根据运行模式和用户选项，生成要传给 `claude` 命令的参数数组。
 *
 * 【chat 模式】（默认）
 * - `--print`                  : 单轮非交互输出，输出完自动退出
 * - `--output-format=stream-json` : stdout 输出 JSON Lines 事件流
 * - `--input-format=stream-json`  : stdin 接收 JSON Lines 格式的用户消息
 * - `--verbose`                : 输出更完整的信息
 * - `--dangerously-skip-permissions` + `--permission-mode bypassPermissions`
 *                              : 双重保险，让 CLI 在启动时不弹确认菜单
 * - `--add-dir`                : 显式把某些目录加入白名单（用于 Approach A 的重试）
 * - `--resume <sessionId>`     : 恢复之前的持久化会话
 * - `--model <model>`          : 指定模型别名
 *
 * 【terminal 模式】
 * - 不使用 `--print`，也不使用 stream-json。
 * - 通过 shell（Windows: cmd.exe /c claude；Linux: bash -c 'claude ...'）启动，
 *   让 `claude` 以为自己运行在真实终端里，从而渲染完整的 TUI。
 * - 跳过权限确认时，**只传 `--permission-mode bypassPermissions`**。
 *   不传 `--dangerously-skip-permissions`，因为后者在 PTY 启动时会弹出一个
 *   阻塞式的 "Yes, I accept" 确认菜单，用户键盘未就绪前会卡死。
 */
function buildClaudeArgs(options: {
  sessionId?: string;
  dangerouslySkipPermissions?: boolean;
  allowedDirs?: string[];
  model?: string;
  mode?: "chat" | "terminal";
}): { cmd: string; args: string[] } {
  const mode = options.mode || "chat";

  if (mode === "terminal") {
    const args: string[] = [];
    if (options.sessionId) {
      args.push("--resume", options.sessionId);
    }
    if (options.dangerouslySkipPermissions) {
      // PTY 模式下绝对不能带 --dangerously-skip-permissions，否则启动即阻塞。
      args.push("--permission-mode", "bypassPermissions");
    }
    if (options.model) {
      args.push("--model", options.model);
    }
    if (isWindows) {
      // Windows 通过 cmd.exe /c 来启动 claude
      return { cmd: "cmd.exe", args: ["/c", "claude", ...args] };
    }
    // Linux / macOS 通过 bash -c 启动
    return { cmd: "/bin/bash", args: ["-c", `claude ${args.join(" ")}`] };
  }

  // chat 模式：pipe + JSON stream
  const args: string[] = [
    "--print",
    "--output-format=stream-json",
    "--input-format=stream-json",
    "--verbose",
  ];
  if (options.sessionId) {
    args.push("--resume", options.sessionId);
  }
  if (options.dangerouslySkipPermissions) {
    // chat 模式传两个 flag，实测可直接生效且不弹确认
    args.push("--dangerously-skip-permissions");
    args.push("--permission-mode", "bypassPermissions");
  }
  if (options.allowedDirs && options.allowedDirs.length > 0) {
    args.push("--add-dir", ...options.allowedDirs);
  }
  if (options.model) {
    args.push("--model", options.model);
  }
  return { cmd: "claude", args };
}

// =============================================================================
// 核心函数：启动 claude 子进程 / 伪终端
// =============================================================================

/**
 * spawnClaude
 * ---------------------------------------------------------------------------
 * 根据 mode 选择不同的启动策略，创建 RunState 并将其绑定到 ClientSession。
 *
 * 【重要设计】单 run 覆盖：一个 client 同时只能有一个 active run。
 * 如果已有 run，先调用 killRun 强制结束旧进程，再启动新的。
 */
function spawnClaude(session: ClientSession, options: {
  sessionId?: string;
  projectPath?: string;
  allowedDirs?: string[];
  dangerouslySkipPermissions?: boolean;
  model?: string;
  mode?: "chat" | "terminal";
}): RunState {
  // 1. 清理旧进程（如果有）
  if (session.run) {
    killRun(session);
  }

  const mode = options.mode || "chat";
  const cwd = options.projectPath || process.cwd();
  const { cmd, args } = buildClaudeArgs({
    sessionId: options.sessionId,
    dangerouslySkipPermissions: options.dangerouslySkipPermissions,
    allowedDirs: options.allowedDirs,
    model: options.model,
    mode,
  });

  const runId = generateRunId();
  let run: RunState;

  // ---------------------------------------------------------------------------
  // 分支 A：terminal 模式 → 使用 node-pty 伪终端
  // ---------------------------------------------------------------------------
  if (mode === "terminal" && ptyModule) {
    const ptyProcess = ptyModule.spawn(cmd, args, {
      name: "xterm-256color",   // 让 claude 认为自己是 xterm 兼容终端
      cols: 120,
      rows: 30,
      cwd,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        FORCE_COLOR: "1",       // 启用 ANSI 颜色输出
      },
    });

    run = {
      pty: ptyProcess,
      mode: "terminal",
      runId,
      buffer: [],
      status: "running",
      createdAt: Date.now(),
      sessionId: options.sessionId,
      projectPath: options.projectPath,
      allowedDirs: options.allowedDirs,
      dangerouslySkipPermissions: options.dangerouslySkipPermissions,
      model: options.model,
    };
    session.run = run;

    // PTY 输出事件：claude 的 TUI 内容（含 ANSI 转义码）原样转发给前端
    ptyProcess.onData((data: string) => {
      if (run.status !== "running") return;
      run.buffer.push(data);
      if (run.buffer.length > 10000) {
        run.buffer.shift();
      }
      if (session.socket.readyState === WebSocket.OPEN) {
        session.socket.send(JSON.stringify({ type: "terminal.data", runId, data }));
      }
    });

    // PTY 退出事件
    ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
      if (run.status !== "running") return;
      run.status = "ended";
      const reason = `Exit code: ${exitCode}`;
      const payloadEnd = JSON.stringify({ type: "session.ended", runId, reason });
      run.buffer.push(payloadEnd + "\n");
      if (session.socket.readyState === WebSocket.OPEN) {
        session.socket.send(payloadEnd);
      }
    });

  // ---------------------------------------------------------------------------
  // 分支 B：chat 模式 → 使用 child_process.spawn + 管道
  // ---------------------------------------------------------------------------
  } else {
    const child = spawn(cmd, args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],  // 0:stdin, 1:stdout, 2:stderr
      env: {
        ...process.env,
        FORCE_COLOR: "0",
        NO_COLOR: "1",
        NODE_ENV: "production",
      },
      // Windows 上，如果 cmd 不是 cmd.exe，需要 shell:true 才能正确解析命令
      shell: isWindows && cmd !== "cmd.exe",
      windowsHide: true,
    });

    run = {
      child,
      mode: "chat",
      runId,
      buffer: [],
      status: "running",
      createdAt: Date.now(),
      sessionId: options.sessionId,
      projectPath: options.projectPath,
      allowedDirs: options.allowedDirs,
      dangerouslySkipPermissions: options.dangerouslySkipPermissions,
      model: options.model,
    };
    session.run = run;

    // stdout 按行缓冲处理：stream-json 输出是 JSON Lines，每个完整逻辑行是一帧。
    let stdoutBuffer = "";

    child.stdout?.on("data", (data: Buffer) => {
      if (run.status !== "running") return;
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        run.buffer.push(trimmed + "\n");
        if (run.buffer.length > 10000) {
          run.buffer.shift();
        }
        console.log(`[claude-bridge] stdout [${runId}] -> ${trimmed.slice(0, 200)}`);
        if (session.socket.readyState === WebSocket.OPEN) {
          session.socket.send(
            JSON.stringify({ type: "assistant.chunk", runId, content: trimmed + "\n" })
          );
        }
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      if (run.status !== "running") return;
      const text = data.toString().trim();
      if (text) {
        run.buffer.push(JSON.stringify({ type: "error", runId, message: text }) + "\n");
        if (session.socket.readyState === WebSocket.OPEN) {
          session.socket.send(JSON.stringify({ type: "error", runId, message: text }));
        }
      }
    });

    child.on("error", (err: Error) => {
      if (run.status !== "running") return;
      run.status = "ended";
      const payloadEnd = JSON.stringify({ type: "session.ended", runId, reason: err.message });
      run.buffer.push(payloadEnd + "\n");
      if (session.socket.readyState === WebSocket.OPEN) {
        session.socket.send(JSON.stringify({ type: "error", runId, message: err.message }));
        session.socket.send(payloadEnd);
      }
    });

    child.on("exit", (code, signal) => {
      if (run.status !== "running") return;
      run.status = "ended";
      if (stdoutBuffer.trim()) {
        run.buffer.push(JSON.stringify({ type: "assistant.chunk", runId, content: stdoutBuffer.trim() + "\n" }) + "\n");
      }
      const reason = signal ? `Signal: ${signal}` : `Exit code: ${code}`;
      const payloadEnd = JSON.stringify({ type: "session.ended", runId, reason });
      run.buffer.push(payloadEnd + "\n");
      if (session.socket.readyState === WebSocket.OPEN) {
        session.socket.send(payloadEnd);
      }
    });
  }

  return run;
}

// =============================================================================
// 消息发送相关函数
// =============================================================================

/**
 * sendToClaude
 * ---------------------------------------------------------------------------
 * 前端普通文本消息的统一入口。
 *
 * - terminal 模式：直接把文本写进 PTY（加 \r 模拟回车）。
 * - chat 模式：把文本包装成 stream-json 协议格式：
 *     { type: "user", message: { role: "user", content } }
 *   然后写入子进程 stdin，末尾加换行符。
 */
function sendToClaude(session: ClientSession, content: string): boolean {
  const run = session.run;
  if (!run || run.status !== "running") {
    return false;
  }
  if (run.mode === "terminal" && run.pty) {
    run.pty.write(content + "\r");
    return true;
  }
  if (!run.child?.stdin?.writable) {
    return false;
  }
  const payload = JSON.stringify({
    type: "user",
    message: {
      role: "user",
      content,
    },
  });
  run.child.stdin.write(payload + "\n");
  return true;
}

/**
 * sendRawToClaude
 * ---------------------------------------------------------------------------
 * 发送任意原始 JSON payload 到 claude stdin。目前只在 chat 模式下有效，
 * 用于某些高级场景（例如发送 tool_result）。
 */
function sendRawToClaude(session: ClientSession, payload: unknown): boolean {
  const run = session.run;
  if (!run || run.status !== "running") {
    return false;
  }
  if (run.mode === "terminal") {
    return false;
  }
  if (!run.child?.stdin?.writable) {
    return false;
  }
  run.child.stdin.write(JSON.stringify(payload) + "\n");
  return true;
}

/**
 * sendPermissionResponse
 * ---------------------------------------------------------------------------
 * chat 模式下响应权限请求（permission_request）。
 * 注意：stream-json 模式下目前实测几乎不会触发这个事件，但我们保留它
 * 以兼容未来可能的 CLI 更新。
 */
function sendPermissionResponse(session: ClientSession, requestId: string, allow: boolean): boolean {
  const run = session.run;
  if (!run || run.status !== "running" || run.mode === "terminal") {
    return false;
  }
  if (!run.child?.stdin?.writable) {
    return false;
  }
  const payload = {
    type: "permission_response",
    request_id: requestId,
    subtype: allow ? "success" : "error",
    response: allow ? { updated_input: null, permission_updates: null } : undefined,
    error: allow ? undefined : "Permission denied",
  };
  run.child.stdin.write(JSON.stringify(payload) + "\n");
  return true;
}

/**
 * sendTerminalInput
 * ---------------------------------------------------------------------------
 * 专门用于 terminal 模式。
 * 前端 xterm.js 会把用户按的每一个键（包括方向键、回车、Ctrl 组合键）
 * 作为原始字符串发过来，这里原样写给 PTY。
 */
function sendTerminalInput(session: ClientSession, data: string): boolean {
  const run = session.run;
  if (!run || run.status !== "running" || run.mode !== "terminal" || !run.pty) {
    return false;
  }
  run.pty.write(data);
  return true;
}

// =============================================================================
// 控制与清理函数
// =============================================================================

/**
 * interruptClaude
 * ---------------------------------------------------------------------------
 * 向前端响应 "中断" 请求。
 * - terminal 模式：发送 ASCII 码 \x03（Ctrl+C）给 PTY。
 * - chat 模式：Windows 写 \x03 到 stdin；Linux/macOS 发送 SIGINT 信号。
 */
function interruptClaude(session: ClientSession): boolean {
  const run = session.run;
  if (!run || run.status !== "running") return false;
  if (run.mode === "terminal" && run.pty) {
    run.pty.write("\x03");
    return true;
  }
  if (!run.child) return false;
  if (isWindows) {
    run.child.stdin?.write("\x03");
  } else {
    run.child.kill("SIGINT");
  }
  return true;
}

/**
 * killRun
 * ---------------------------------------------------------------------------
 * 强制终止当前的 claude run，清理引用，防止僵尸进程。
 *
 * Windows 下 PTY 的 kill 逻辑经过特调：
 * - 先清空 run.pty 引用，避免并发时重复 kill
 * - 使用 SIGKILL 而不是默认 kill，降低触发 AttachConsole 崩溃的概率
 */
function killRun(session: ClientSession): void {
  const run = session.run;
  if (run?.child) {
    try {
      run.child.kill("SIGTERM");
    } catch {
      // ignore
    }
    run.child = undefined;
  }
  if (run?.pty) {
    const ptyToKill = run.pty;
    run.pty = undefined;
    try {
      if (isWindows) {
        ptyToKill.kill("SIGKILL");
      } else {
        ptyToKill.kill();
      }
    } catch {
      // ignore
    }
  }
  if (run) {
    run.status = "ended";
  }
  session.run = undefined;
}

// =============================================================================
// WebSocket 服务器：前端 ↔ 桥接层的通信协议
// =============================================================================

const httpServer = createServer();
const wss = new WebSocketServer({ server: httpServer, path: "/claude" });

wss.on("connection", (socket) => {
  // 1. 为新连接分配 clientId 和 session
  const clientId = generateClientId();
  const session: ClientSession = { socket };
  sessions.set(clientId, session);

  // 2. 立即通知前端已连接
  socket.send(JSON.stringify({ type: "connected", clientId }));

  // 3. 监听前端发来的消息
  socket.on("message", (raw) => {
    let message: any;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      socket.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    // 消息路由
    switch (message.type) {
      // -----------------------------------------------------------------------
      // session.start: 前端请求启动新会话
      // -----------------------------------------------------------------------
      case "session.start": {
        const run = spawnClaude(session, {
          sessionId: message.sessionId,
          projectPath: message.projectPath,
          allowedDirs: message.allowedDirs,
          dangerouslySkipPermissions: message.dangerouslySkipPermissions,
          model: message.model,
          mode: message.mode || "chat",
        });
        socket.send(JSON.stringify({
          type: "session.started",
          sessionId: run.sessionId || clientId,
          runId: run.runId,
          mode: run.mode,
        }));
        break;
      }

      // -----------------------------------------------------------------------
      // session.attach: 未实现（单 run 模式不需要）
      // -----------------------------------------------------------------------
      case "session.attach": {
        socket.send(JSON.stringify({ type: "error", message: "Attach not supported in single-run mode" }));
        break;
      }

      // -----------------------------------------------------------------------
      // message.send: 前端发送普通用户消息
      // -----------------------------------------------------------------------
      case "message.send": {
        const activeRun = session.run;
        if (!activeRun || activeRun.status !== "running") {
          socket.send(JSON.stringify({ type: "error", message: "No active claude session. Start a session first." }));
          return;
        }
        const ok = sendToClaude(session, message.content || "");
        if (!ok) {
          socket.send(JSON.stringify({ type: "error", message: "Failed to send message to claude process" }));
        }
        break;
      }

      // -----------------------------------------------------------------------
      // message.send_raw: 前端发送原始 JSON payload
      // -----------------------------------------------------------------------
      case "message.send_raw": {
        const activeRun = session.run;
        if (!activeRun || activeRun.status !== "running") {
          socket.send(JSON.stringify({ type: "error", message: "No active claude session. Start a session first." }));
          return;
        }
        const ok = sendRawToClaude(session, message.payload);
        if (!ok) {
          socket.send(JSON.stringify({ type: "error", message: "Failed to send raw message to claude process" }));
        }
        break;
      }

      // -----------------------------------------------------------------------
      // permission.response: 前端响应权限请求（仅 chat 模式）
      // -----------------------------------------------------------------------
      case "permission.response": {
        const activeRun = session.run;
        if (!activeRun || activeRun.status !== "running") {
          socket.send(JSON.stringify({ type: "error", message: "No active claude session. Start a session first." }));
          return;
        }
        const ok = sendPermissionResponse(session, message.requestId, message.allow);
        if (!ok) {
          socket.send(JSON.stringify({ type: "error", message: "Failed to send permission response to claude process" }));
        }
        break;
      }

      // -----------------------------------------------------------------------
      // terminal.input: 前端键盘输入（仅 terminal 模式）
      // -----------------------------------------------------------------------
      case "terminal.input": {
        const activeRun = session.run;
        if (!activeRun || activeRun.status !== "running") {
          socket.send(JSON.stringify({ type: "error", message: "No active claude session. Start a session first." }));
          return;
        }
        const ok = sendTerminalInput(session, message.data || "");
        if (!ok) {
          socket.send(JSON.stringify({ type: "error", message: "Failed to send terminal input" }));
        }
        break;
      }

      // -----------------------------------------------------------------------
      // session.interrupt: 中断当前输出
      // -----------------------------------------------------------------------
      case "session.interrupt": {
        const activeRun = session.run;
        if (!activeRun || activeRun.status !== "running") {
          socket.send(JSON.stringify({ type: "error", message: "No active session to interrupt" }));
          return;
        }
        interruptClaude(session);
        break;
      }

      // -----------------------------------------------------------------------
      // session.close: 前端主动关闭会话
      // -----------------------------------------------------------------------
      case "session.close": {
        killRun(session);
        socket.send(JSON.stringify({ type: "session.ended", reason: "Session closed by user" }));
        break;
      }

      default:
        socket.send(JSON.stringify({ type: "error", message: `Unknown message type: ${message.type}` }));
    }
  });

  // 4. WebSocket 关闭 / 出错 → 清理资源
  socket.on("close", () => {
    killRun(session);
    sessions.delete(clientId);
  });

  socket.on("error", (err) => {
    console.error("WebSocket error:", err);
    killRun(session);
    sessions.delete(clientId);
  });
});

// =============================================================================
// 启动 HTTP / WebSocket 监听
// =============================================================================
httpServer.listen(PORT, () => {
  console.log(`[claude-bridge] WebSocket server listening on ws://localhost:${PORT}/claude`);
});

// =============================================================================
// 优雅关闭：收到 SIGINT 时清理所有子进程
// =============================================================================
process.on("SIGINT", () => {
  console.log("\n[claude-bridge] Shutting down...");
  for (const session of sessions.values()) {
    killRun(session);
  }
  wss.close(() => {
    httpServer.close(() => {
      process.exit(0);
    });
  });
});
