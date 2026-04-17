export type SessionProvider = 'claude' | 'cursor' | 'codex' | 'gemini';

export interface ChatImage {
  data: string;
  name: string;
}

export interface ChatAttachment {
  type: 'image' | 'file';
  name: string;
  url?: string;
  data?: string;
  size?: number;
  mimeType?: string;
}

export interface ToolResult {
  content?: unknown;
  isError?: boolean;
  timestamp?: string | number | Date;
  toolUseResult?: unknown;
  [key: string]: unknown;
}

export interface SubagentChildTool {
  toolId: string;
  toolName: string;
  toolInput: unknown;
  toolResult?: ToolResult | null;
  timestamp: Date;
}

export interface ChatMessage {
  type: 'user' | 'assistant' | 'tool' | 'error';
  content?: string;
  timestamp: string | number | Date;
  images?: ChatImage[];
  attachments?: ChatAttachment[];
  reasoning?: string;
  isThinking?: boolean;
  isStreaming?: boolean;
  isInteractivePrompt?: boolean;
  isToolUse?: boolean;
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
  isPermissionRequest?: boolean;
  permissionFiles?: string[];
  permissionAction?: 'read' | 'write' | 'execute';
  permissionRequestId?: string;
  displayText?: string;
  a2uiPayload?: unknown;
  id?: string;
  messageId?: string;
  blobId?: string;
  rowid?: string | number;
  sequence?: string | number;
  [key: string]: unknown;
}
