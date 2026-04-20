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
 *
 * 【重要设计】一个前端连接可以同时维护一个 chat run 和一个 terminal run。
 * 切换 tab 时不需要关闭另一个 mode 的进程，只有切换历史会话或断开 WebSocket 时才全部清理。
 */

import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { spawn, type ChildProcess } from "child_process";

// =============================================================================
// 全局错误处理（防护 Windows 下 node-pty 的已知崩溃）
// =============================================================================

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

interface ClientSession {
  socket: WebSocket;
  runs: {
    chat?: RunState;
    terminal?: RunState;
  };
}

const sessions = new Map<string, ClientSession>();

function generateClientId(): string {
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function generateRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// =============================================================================
// 构建 claude CLI 启动参数
// =============================================================================

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
      args.push("--permission-mode", "bypassPermissions");
    }
    if (options.model) {
      args.push("--model", options.model);
    }
    if (isWindows) {
      return { cmd: "cmd.exe", args: ["/c", "claude", ...args] };
    }
    return { cmd: "/bin/bash", args: ["-c", `claude ${args.join(" ")}`] };
  }

  // chat 模式
  const args: string[] = [
    "--print",
    "--output-format=stream-json",
    "--input-format=stream-json",
    "--verbose",
    "--no-session-persistence",
  ];
  if (options.sessionId) {
    args.push("--resume", options.sessionId);
  }
  if (options.dangerouslySkipPermissions) {
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

function spawnClaude(session: ClientSession, options: {
  sessionId?: string;
  projectPath?: string;
  allowedDirs?: string[];
  dangerouslySkipPermissions?: boolean;
  model?: string;
  mode?: "chat" | "terminal";
}): RunState {
  const mode = options.mode || "chat";
  const existingRun = session.runs[mode];
  if (existingRun) {
    killRun(existingRun);
  }

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

  if (mode === "terminal" && ptyModule) {
    const ptyProcess = ptyModule.spawn(cmd, args, {
      name: "xterm-256color",
      cols: 120,
      rows: 30,
      cwd,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        FORCE_COLOR: "1",
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
    session.runs.terminal = run;

    ptyProcess.onData((data: string) => {
      if (run.status !== "running") return;
      run.buffer.push(data);
      if (run.buffer.length > 10000) run.buffer.shift();
      if (session.socket.readyState === WebSocket.OPEN) {
        session.socket.send(JSON.stringify({ type: "terminal.data", runId, data }));
      }
    });

    ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
      if (run.status !== "running") return;
      run.status = "ended";
      const reason = `Exit code: ${exitCode}`;
      const payloadEnd = JSON.stringify({ type: "session.ended", runId, mode, reason });
      run.buffer.push(payloadEnd + "\n");
      if (session.socket.readyState === WebSocket.OPEN) {
        session.socket.send(payloadEnd);
      }
    });

  } else {
    const child = spawn(cmd, args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        FORCE_COLOR: "0",
        NO_COLOR: "1",
        NODE_ENV: "production",
      },
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
    session.runs.chat = run;

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
        if (run.buffer.length > 10000) run.buffer.shift();
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
        console.log(text);
        run.buffer.push(JSON.stringify({ type: "error", runId, message: text }) + "\n");
        if (session.socket.readyState === WebSocket.OPEN) {
          session.socket.send(JSON.stringify({ type: "error", runId, message: text }));
        }
      }
    });

    child.on("error", (err: Error) => {
      if (run.status !== "running") return;
      run.status = "ended";
      const payloadEnd = JSON.stringify({ type: "session.ended", runId, mode, reason: err.message });
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
      const payloadEnd = JSON.stringify({ type: "session.ended", runId, mode, reason });
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

const lastSentRef = { content: "", time: 0 };

function sendToClaude(session: ClientSession, content: string): boolean {
  const run = session.runs.chat;
  if (!run || run.status !== "running") return false;

  const now = Date.now();
  if (content === lastSentRef.content && now - lastSentRef.time < 300) {
    console.log("[claude-bridge] sendToClaude dedup skipped:", JSON.stringify(content));
    return true;
  }
  lastSentRef.content = content;
  lastSentRef.time = now;

  if (!run.child?.stdin?.writable) return false;
  const payload = JSON.stringify({
    type: "user",
    message: { role: "user", content },
  });
  run.child.stdin.write(payload + "\n");
  return true;
}

function sendRawToClaude(session: ClientSession, payload: unknown): boolean {
  const run = session.runs.chat;
  if (!run || run.status !== "running") return false;
  if (!run.child?.stdin?.writable) return false;
  run.child.stdin.write(JSON.stringify(payload) + "\n");
  return true;
}

function sendPermissionResponse(session: ClientSession, requestId: string, allow: boolean): boolean {
  const run = session.runs.chat;
  if (!run || run.status !== "running") return false;
  if (!run.child?.stdin?.writable) return false;
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

function sendTerminalInput(session: ClientSession, data: string): boolean {
  const run = session.runs.terminal;
  if (!run || run.status !== "running" || !run.pty) return false;
  console.log("[claude-bridge] sendTerminalInput writing:", JSON.stringify(data));
  run.pty.write(data);
  return true;
}

function sendTerminalResize(session: ClientSession, cols: number, rows: number): boolean {
  const run = session.runs.terminal;
  if (!run || run.status !== "running" || !run.pty) return false;
  try {
    run.pty.resize(cols, rows);
  } catch {
    return false;
  }
  return true;
}

// =============================================================================
// 控制与清理函数
// =============================================================================

function interruptClaude(session: ClientSession): boolean {
  let didAnything = false;

  const chatRun = session.runs.chat;
  if (chatRun && chatRun.status === "running" && chatRun.child) {
    if (isWindows) {
      chatRun.child.stdin?.write("\x03");
    } else {
      chatRun.child.kill("SIGINT");
    }
    didAnything = true;
  }

  const terminalRun = session.runs.terminal;
  if (terminalRun && terminalRun.status === "running" && terminalRun.pty) {
    terminalRun.pty.write("\x03");
    didAnything = true;
  }

  return didAnything;
}

function killRun(run: RunState): void {
  if (run?.child) {
    try {
      run.child.kill("SIGTERM");
    } catch {}
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
    } catch {}
  }
  run.status = "ended";
}

function killAllRuns(session: ClientSession): void {
  if (session.runs.chat) {
    killRun(session.runs.chat);
    session.runs.chat = undefined;
  }
  if (session.runs.terminal) {
    killRun(session.runs.terminal);
    session.runs.terminal = undefined;
  }
}

// =============================================================================
// WebSocket 服务器
// =============================================================================

const httpServer = createServer();
const wss = new WebSocketServer({ server: httpServer, path: "/claude" });

wss.on("connection", (socket) => {
  const clientId = generateClientId();
  const session: ClientSession = { socket, runs: {} };
  sessions.set(clientId, session);

  socket.send(JSON.stringify({ type: "connected", clientId }));

  socket.on("message", (raw) => {
    let message: any;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      socket.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    switch (message.type) {
      case "session.start": {
        const mode: "chat" | "terminal" = message.mode === "terminal" ? "terminal" : "chat";
        const existing = session.runs[mode];
        if (existing && existing.status === "running") {
          socket.send(JSON.stringify({
            type: "session.started",
            sessionId: existing.sessionId || clientId,
            runId: existing.runId,
            mode: existing.mode,
          }));
          break;
        }
        const run = spawnClaude(session, {
          sessionId: message.sessionId,
          projectPath: message.projectPath,
          allowedDirs: message.allowedDirs,
          dangerouslySkipPermissions: message.dangerouslySkipPermissions,
          model: message.model,
          mode,
        });
        socket.send(JSON.stringify({
          type: "session.started",
          sessionId: run.sessionId || clientId,
          runId: run.runId,
          mode: run.mode,
        }));
        break;
      }

      case "session.attach": {
        socket.send(JSON.stringify({ type: "error", message: "Attach not supported in single-run mode" }));
        break;
      }

      case "message.send": {
        const activeRun = session.runs.chat;
        if (!activeRun || activeRun.status !== "running") {
          socket.send(JSON.stringify({ type: "error", message: "No active claude chat session. Start a session first." }));
          return;
        }
        const ok = sendToClaude(session, message.content || "");
        if (!ok) {
          socket.send(JSON.stringify({ type: "error", message: "Failed to send message to claude process" }));
        }
        break;
      }

      case "message.send_raw": {
        const activeRun = session.runs.chat;
        if (!activeRun || activeRun.status !== "running") {
          socket.send(JSON.stringify({ type: "error", message: "No active claude chat session. Start a session first." }));
          return;
        }
        const ok = sendRawToClaude(session, message.payload);
        if (!ok) {
          socket.send(JSON.stringify({ type: "error", message: "Failed to send raw message to claude process" }));
        }
        break;
      }

      case "permission.response": {
        const activeRun = session.runs.chat;
        if (!activeRun || activeRun.status !== "running") {
          socket.send(JSON.stringify({ type: "error", message: "No active claude chat session. Start a session first." }));
          return;
        }
        const ok = sendPermissionResponse(session, message.requestId, message.allow);
        if (!ok) {
          socket.send(JSON.stringify({ type: "error", message: "Failed to send permission response to claude process" }));
        }
        break;
      }

      case "terminal.input": {
        const activeRun = session.runs.terminal;
        if (!activeRun || activeRun.status !== "running") {
          socket.send(JSON.stringify({ type: "error", message: "No active claude terminal session. Start a session first." }));
          return;
        }
        const ok = sendTerminalInput(session, message.data || "");
        if (!ok) {
          socket.send(JSON.stringify({ type: "error", message: "Failed to send terminal input" }));
        }
        break;
      }

      case "terminal.resize": {
        const activeRun = session.runs.terminal;
        if (!activeRun || activeRun.status !== "running") {
          socket.send(JSON.stringify({ type: "error", message: "No active claude terminal session. Start a session first." }));
          return;
        }
        const ok = sendTerminalResize(session, Number(message.cols) || 80, Number(message.rows) || 24);
        if (!ok) {
          socket.send(JSON.stringify({ type: "error", message: "Failed to resize terminal" }));
        }
        break;
      }

      case "session.interrupt": {
        const ok = interruptClaude(session);
        if (!ok) {
          socket.send(JSON.stringify({ type: "error", message: "No active session to interrupt" }));
        }
        break;
      }

      case "session.close": {
        killAllRuns(session);
        socket.send(JSON.stringify({ type: "session.ended", reason: "Session closed by user" }));
        break;
      }

      default:
        socket.send(JSON.stringify({ type: "error", message: `Unknown message type: ${message.type}` }));
    }
  });

  socket.on("close", () => {
    killAllRuns(session);
    sessions.delete(clientId);
  });

  socket.on("error", (err) => {
    console.error("WebSocket error:", err);
    killAllRuns(session);
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
// 优雅关闭
// =============================================================================
process.on("SIGINT", () => {
  console.log("\n[claude-bridge] Shutting down...");
  for (const session of sessions.values()) {
    killAllRuns(session);
  }
  wss.close(() => {
    httpServer.close(() => {
      process.exit(0);
    });
  });
});
