import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { spawn, type ChildProcess } from "child_process";

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

let ptyModule: typeof import("node-pty") | null = null;
try {
  ptyModule = require("node-pty");
} catch {
  // node-pty not installed
}

const PORT = process.env.CLAUDE_BRIDGE_PORT ? parseInt(process.env.CLAUDE_BRIDGE_PORT, 10) : 3002;
const isWindows = process.platform === "win32";

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
  run?: RunState;
}

const sessions = new Map<string, ClientSession>();

function generateClientId(): string {
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function generateRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

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
      // In PTY mode, do NOT pass --dangerously-skip-permissions because it shows a blocking TUI confirmation at startup.
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

  // chat mode: pipe + JSON stream
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

function spawnClaude(session: ClientSession, options: {
  sessionId?: string;
  projectPath?: string;
  allowedDirs?: string[];
  dangerouslySkipPermissions?: boolean;
  model?: string;
  mode?: "chat" | "terminal";
}): RunState {
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
    session.run = run;

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
    session.run = run;

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

function sendTerminalInput(session: ClientSession, data: string): boolean {
  const run = session.run;
  if (!run || run.status !== "running" || run.mode !== "terminal" || !run.pty) {
    return false;
  }
  run.pty.write(data);
  return true;
}

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

const httpServer = createServer();
const wss = new WebSocketServer({ server: httpServer, path: "/claude" });

wss.on("connection", (socket) => {
  const clientId = generateClientId();
  const session: ClientSession = { socket };
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
        const run = spawnClaude(session, {
          sessionId: message.sessionId,
          projectPath: message.projectPath,
          allowedDirs: message.allowedDirs,
          dangerouslySkipPermissions: message.dangerouslySkipPermissions,
          model: message.model,
          mode: message.mode || "chat",
        });
        socket.send(JSON.stringify({ type: "session.started", sessionId: run.sessionId || clientId, runId: run.runId, mode: run.mode }));
        break;
      }
      case "session.attach": {
        socket.send(JSON.stringify({ type: "error", message: "Attach not supported in single-run mode" }));
        break;
      }
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
      case "session.interrupt": {
        const activeRun = session.run;
        if (!activeRun || activeRun.status !== "running") {
          socket.send(JSON.stringify({ type: "error", message: "No active session to interrupt" }));
          return;
        }
        interruptClaude(session);
        break;
      }
      case "session.close": {
        killRun(session);
        socket.send(JSON.stringify({ type: "session.ended", reason: "Session closed by user" }));
        break;
      }
      default:
        socket.send(JSON.stringify({ type: "error", message: `Unknown message type: ${message.type}` }));
    }
  });

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

httpServer.listen(PORT, () => {
  console.log(`[claude-bridge] WebSocket server listening on ws://localhost:${PORT}/claude`);
});

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
