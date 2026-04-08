export interface ContentBlockText {
  type: 'text';
  text: string;
}

export interface ContentBlockThinking {
  type: 'thinking';
  thinking: string;
}

export interface ContentBlockToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

export type ContentBlock = ContentBlockText | ContentBlockThinking | ContentBlockToolUse;

export interface AssistantMessageEvent {
  type: 'assistant';
  message: {
    id: string;
    type: 'message';
    role: 'assistant';
    content: ContentBlock[];
    model: string;
    stop_reason: string | null;
    stop_sequence: string | null;
  };
}

export interface ContentBlockStartEvent {
  type: 'content_block_start';
  index: number;
  content_block: ContentBlock;
}

export interface ContentBlockDeltaEvent {
  type: 'content_block_delta';
  index: number;
  delta: {
    type: 'text_delta' | 'thinking_delta' | 'input_json_delta';
    text?: string;
    thinking?: string;
    partial_json?: string;
  };
}

export interface ContentBlockStopEvent {
  type: 'content_block_stop';
  index: number;
}

export interface MessageStartEvent {
  type: 'message_start';
  message: { id: string; type: 'message'; role: 'assistant'; model: string };
}

export interface MessageStopEvent {
  type: 'message_stop';
}

export interface ToolResultBlock {
  type: 'tool_result';
  content: string;
  is_error?: boolean;
  tool_use_id?: string;
}

export interface UserMessageEvent {
  type: 'user';
  message: {
    role: 'user';
    content: (ContentBlock | ToolResultBlock)[];
  };
}

export interface ResultEvent {
  type: 'result';
  subtype: 'success' | 'error';
  result?: string;
  error?: string;
}

export interface PermissionRequestEvent {
  type: 'permission_request';
  request_id: string;
  agent_id?: string;
  tool_name?: string;
  tool_use_id?: string;
  description?: string;
  input?: unknown;
  permission_suggestions?: string[];
}

export interface PermissionResponseEvent {
  type: 'permission_response';
  request_id: string;
  subtype: 'success' | 'error';
  response?: { updated_input?: unknown; permission_updates?: unknown };
  error?: string;
}

export type StreamEvent =
  | AssistantMessageEvent
  | UserMessageEvent
  | MessageStartEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | MessageStopEvent
  | ResultEvent
  | PermissionRequestEvent
  | PermissionResponseEvent;

export interface BridgeCallbacks {
  onConnect?: (clientId: string) => void;
  onDisconnect?: () => void;
  onEvent?: (event: StreamEvent) => void;
  onError?: (message: string) => void;
  onSessionStarted?: (sessionId?: string) => void;
  onSessionEnded?: (reason: string) => void;
}

const DEFAULT_URL = typeof window !== 'undefined'
  ? `ws://${window.location.hostname}:3002/claude`
  : 'ws://localhost:3002/claude';

export class ClaudeBridgeClient {
  private ws: WebSocket | null = null;
  private url: string;
  private callbacks: BridgeCallbacks;
  private buffer: string = '';

  constructor(url: string = DEFAULT_URL, callbacks: BridgeCallbacks = {}) {
    this.url = url;
    this.callbacks = callbacks;
  }

  connect(): void {
    if (this.ws) return;
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      // wait for connected message from server
    };

    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      try {
        const data = JSON.parse(String(e.data));
        this.handleServerMessage(data);
      } catch {
        // ignore malformed json
      }
    };

    ws.onerror = () => {
      if (this.ws !== ws) return;
      this.callbacks.onError?.('WebSocket error');
    };

    ws.onclose = () => {
      if (this.ws === ws) {
        this.ws = null;
        this.callbacks.onDisconnect?.();
      }
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  startSession(options?: { sessionId?: string; projectPath?: string; allowedDirs?: string[]; dangerouslySkipPermissions?: boolean; model?: string }): void {
    if (!this.ensureConnected()) return;
    this.buffer = '';
    this.send({ type: 'session.start', sessionId: options?.sessionId, projectPath: options?.projectPath, allowedDirs: options?.allowedDirs, dangerouslySkipPermissions: options?.dangerouslySkipPermissions, model: options?.model });
  }

  sendMessage(content: string): void {
    if (!this.ensureConnected()) return;
    this.send({ type: 'message.send', content });
  }

  interrupt(): void {
    if (!this.ensureConnected()) return;
    this.send({ type: 'session.interrupt' });
  }

  closeSession(): void {
    if (!this.ensureConnected()) return;
    this.buffer = '';
    this.send({ type: 'session.close' });
  }

  sendPermissionResponse(requestId: string, allow: boolean): void {
    if (!this.ensureConnected()) return;
    const payload: any = { type: 'permission.response', requestId, allow };
    this.send(payload);
  }

  sendToolResult(toolUseId: string, content: string, isError = false): void {
    if (!this.ensureConnected()) return;
    this.send({
      type: 'message.send_raw',
      payload: {
        type: 'user',
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: toolUseId, content, is_error: isError }],
        },
      },
    });
  }

  setCallbacks(callbacks: BridgeCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  private ensureConnected(): boolean {
    if (this.isConnected()) return true;
    this.connect();
    return false;
  }

  private send(payload: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private handleServerMessage(msg: any): void {
    if (!msg || typeof msg !== 'object') return;

    switch (msg.type) {
      case 'connected': {
        this.callbacks.onConnect?.(msg.clientId);
        break;
      }
      case 'session.started': {
        this.buffer = '';
        this.callbacks.onSessionStarted?.(msg.sessionId);
        break;
      }
      case 'assistant.chunk': {
        this.handleChunk(msg.content);
        break;
      }
      case 'error': {
        this.callbacks.onError?.(msg.message || 'Unknown bridge error');
        break;
      }
      case 'session.ended': {
        this.callbacks.onSessionEnded?.(msg.reason || 'Session ended');
        break;
      }
    }
  }

  private handleChunk(chunk: string): void {
    if (typeof chunk !== 'string') return;
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const event = JSON.parse(trimmed) as StreamEvent;
        this.callbacks.onEvent?.(event);
      } catch {
        if (typeof window !== 'undefined' && localStorage.getItem('bridgeDebug')) {
          // eslint-disable-next-line no-console
          console.warn('[claudeBridge] Failed to parse chunk line:', trimmed);
        }
      }
    }
  }
}

export const claudeBridge = new ClaudeBridgeClient();
