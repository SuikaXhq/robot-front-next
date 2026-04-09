'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import styles from './ChatArea.module.css';
import {
  SettingOutlined,
  UpOutlined,
  DownOutlined,
  CaretRightOutlined,
  LayoutOutlined,
} from '@ant-design/icons';
import { Select, Tree } from 'antd';
import type { ChatMessage, ChatAttachment } from './chat/types';
import ChatMessagesPane from './chat/ChatMessagesPane';
import { ChatInput } from './chat/ChatInput';
import { claudeBridge, type StreamEvent } from '@/services/claudeBridgeClient';
import { useChatSessions } from '@/contexts/ChatSessionContext';
import type { SkillPayload } from '@/config/skills';

const taskTreeData = [
  { title: '进入URL', key: '1' },
  { title: '打开页面', key: '2' },
  {
    title: '密码登录',
    key: '3',
    children: [
      { title: '输入用户', key: '31' },
      { title: '输入密码', key: '32' },
      { title: '重新输入密码', key: '33' },
    ],
  },
  { title: '换用验证码登录', key: '4' },
  { title: '验证码MC', key: '5' },
];

interface ChatAreaProps {
  onToggleSidebar: () => void;
  /** 从 Skills 平台带入的初始 Skill */
  initialSkill?: SkillPayload;
}

export default function ChatArea({ onToggleSidebar, initialSkill }: ChatAreaProps) {
  const [isTaskExpanded, setIsTaskExpanded] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const contentBlocksRef = useRef<ChatMessage[]>([]);
  const [isBridgeReady, setIsBridgeReady] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const pendingSessionIdRef = useRef<string | null>(null);
  const [dangerouslySkipPermissions, setDangerouslySkipPermissions] = useState(false);
  const dangerouslySkipPermissionsRef = useRef(dangerouslySkipPermissions);
  useEffect(() => {
    dangerouslySkipPermissionsRef.current = dangerouslySkipPermissions;
  }, [dangerouslySkipPermissions]);

  const lastUserMessageRef = useRef<{ content: string; attachments?: ChatAttachment[] } | null>(null);
  const pendingRetryRef = useRef<{ dirs: string[]; message: { content: string; attachments?: ChatAttachment[] } } | null>(null);

  const {
    currentSession,
    currentSessionId,
    updateSessionMessages,
    clearCurrentSession,
    switchSession,
    sessions,
  } = useChatSessions();

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Sync local messages from context when switching sessions
  useEffect(() => {
    setMessages(currentSession?.messages || []);
    contentBlocksRef.current = [];
    setIsStreaming(false);
  }, [currentSession?.id]);

  // Debounced sync local messages back to context (for persistence)
  useEffect(() => {
    if (!currentSessionId) return;
    pendingSessionIdRef.current = currentSessionId;
    const timer = setTimeout(() => {
      if (pendingSessionIdRef.current === currentSessionId) {
        updateSessionMessages(currentSessionId, messages);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [messages, currentSessionId, updateSessionMessages]);

  // Start a fresh backend session when switching frontend sessions
  useEffect(() => {
    if (!isBridgeReady || !currentSessionId) return;
    setIsSessionReady(false);
    claudeBridge.closeSession();
    claudeBridge.startSession({ dangerouslySkipPermissions: dangerouslySkipPermissionsRef.current });
  }, [currentSessionId, isBridgeReady]);

  // Auto-send skill prompt from Skills platform when session is ready
  const initialSkillProcessedRef = useRef(false);
  useEffect(() => {
    if (!isSessionReady || !initialSkill?.prompt || initialSkillProcessedRef.current) return;
    initialSkillProcessedRef.current = true;

    setMessages((prev) => [
      ...prev,
      {
        type: 'assistant',
        content: `已加载技能「${initialSkill.name}」，正在初始化...`,
        timestamp: new Date().toISOString(),
      } as ChatMessage,
    ]);

    claudeBridge.sendMessage(initialSkill.prompt);
    setIsStreaming(true);
  }, [isSessionReady, initialSkill]);

  const handleEvent = useCallback((event: StreamEvent) => {
    switch (event.type) {
      // claude CLI stream-json sends a top-level "assistant" event with message.content blocks
      case 'assistant': {
        const msgId = event.message.id;
        const blocks = (event.message.content || []) as any[];

        let content = '';
        let reasoning = '';
        let isThinking = false;
        let isToolUse = false;
        let toolName = '';
        let toolId = '';
        let toolInput: unknown = {};

        for (const b of blocks) {
          if (b.type === 'text') {
            content += b.text || '';
          } else if (b.type === 'thinking') {
            reasoning += b.thinking || '';
          } else if (b.type === 'tool_use') {
            isToolUse = true;
            toolName = b.name || '';
            toolId = b.id || '';
            toolInput = b.input || {};
          }
        }

        // Only mark as pure thinking message if there is reasoning but no actual content
        isThinking = !!reasoning && !content && !isToolUse;

        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.messageId === msgId);
          if (idx >= 0) {
            const next = [...prev];
            const existing = next[idx];
            const mergedContent = content || existing.content || '';
            const mergedReasoning = reasoning || existing.reasoning || '';
            const mergedIsToolUse = isToolUse || existing.isToolUse;
            const mergedIsThinking = !!mergedReasoning && !mergedContent && !mergedIsToolUse;
            next[idx] = {
              ...existing,
              content: mergedContent,
              reasoning: mergedReasoning,
              isThinking: mergedIsThinking,
              isToolUse: mergedIsToolUse,
              toolName: toolName || existing.toolName,
              toolId: toolId || existing.toolId,
              toolInput: isToolUse ? toolInput : existing.toolInput,
              isStreaming: true,
              messageId: msgId,
            };
            return next;
          }
          return [
            ...prev,
            {
              type: 'assistant',
              content,
              reasoning,
              isThinking,
              isToolUse,
              toolName,
              toolId,
              toolInput,
              displayText: isToolUse ? `Using ${toolName}...` : undefined,
              isStreaming: true,
              timestamp: new Date().toISOString(),
              messageId: msgId,
            } as ChatMessage,
          ];
        });
        setIsStreaming(true);
        break;
      }

      // Fallback: if claude ever sends block-level deltas, handle them too
      case 'content_block_start': {
        const block = event.content_block;
        let m: ChatMessage;
        if (block.type === 'tool_use') {
          m = {
            type: 'assistant',
            isToolUse: true,
            toolName: block.name,
            toolId: block.id,
            toolInput: {},
            displayText: `Using ${block.name}...`,
            isStreaming: true,
            timestamp: new Date().toISOString(),
          };
        } else if (block.type === 'thinking') {
          m = {
            type: 'assistant',
            isThinking: true,
            reasoning: block.thinking || '',
            content: '',
            isStreaming: true,
            timestamp: new Date().toISOString(),
          };
        } else {
          m = {
            type: 'assistant',
            content: (block as any).text || '',
            isStreaming: true,
            timestamp: new Date().toISOString(),
          };
        }
        contentBlocksRef.current[event.index] = m;
        setMessages((prev) => [...prev, m]);
        break;
      }

      case 'content_block_delta': {
        const m = contentBlocksRef.current[event.index];
        if (!m) return;
        if (event.delta.type === 'text_delta' && event.delta.text) {
          m.content = (m.content || '') + event.delta.text;
        } else if (event.delta.type === 'thinking_delta' && event.delta.thinking) {
          m.reasoning = (m.reasoning || '') + event.delta.thinking;
        } else if (event.delta.type === 'input_json_delta' && event.delta.partial_json) {
          const current = typeof m.toolInput === 'string' ? m.toolInput : '';
          m.toolInput = current + event.delta.partial_json;
        }
        setMessages((prev) => {
          const idx = prev.indexOf(m);
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = { ...m };
          return next;
        });
        break;
      }

      case 'content_block_stop': {
        const m = contentBlocksRef.current[event.index];
        if (m?.isToolUse && typeof m.toolInput === 'string') {
          try {
            m.toolInput = JSON.parse(m.toolInput);
          } catch {
            // keep as string
          }
        }
        if (m) {
          m.isStreaming = false;
        }
        setMessages((prev) => {
          const idx = m ? prev.indexOf(m) : -1;
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = { ...m };
          return next;
        });
        break;
      }

      case 'user': {
        const blocks = ((event.message?.content) || []) as any[];
        for (const b of blocks) {
          if (b.type === 'tool_result') {
            const toolContent = b.content;
            let text = '';
            if (typeof toolContent === 'string') {
              text = toolContent;
            } else if (Array.isArray(toolContent)) {
              text = toolContent
                .map((block: any) =>
                  typeof block === 'string'
                    ? block
                    : block?.type === 'text'
                    ? block.text || ''
                    : block?.text || block?.content || JSON.stringify(block)
                )
                .filter(Boolean)
                .join('\n');
            } else if (toolContent && typeof toolContent === 'object') {
              text = toolContent.text || toolContent.content || JSON.stringify(toolContent);
            }
            const isDenied = typeof text === 'string' && text.includes("Claude requested permissions") && text.includes("but you haven't granted it yet");
            const isFileDenied = isDenied && /\bread from\b|\bwrite to\b/i.test(text);
            if (isFileDenied) {
              const pathMatch = text.match(/(?:from|to)\s+(.+?)(?:,|\s+but you haven't granted it yet)/i);
              const deniedTarget = pathMatch ? pathMatch[1].trim() : text;
              setMessages((prev) => [
                ...prev,
                {
                  type: 'tool',
                  content: text,
                  isPermissionDeniedResult: true,
                  permissionFiles: [deniedTarget],
                  permissionAction: 'read',
                  isStreaming: false,
                  timestamp: new Date().toISOString(),
                } as ChatMessage,
              ]);
            } else {
              setMessages((prev) => [
                ...prev,
                {
                  type: 'tool',
                  content: text || `[Tool result: ${b.tool_use_id || 'unknown'}]`,
                  isStreaming: false,
                  timestamp: new Date().toISOString(),
                } as ChatMessage,
              ]);
            }
          }
        }
        break;
      }

      case 'message_start': {
        setIsStreaming(true);
        break;
      }

      case 'message_stop':
      case 'result': {
        setIsStreaming(false);
        contentBlocksRef.current.forEach((m) => {
          if (m) m.isStreaming = false;
        });
        setMessages((prev) => {
          const toReplace = new Set(contentBlocksRef.current.filter(Boolean));
          return prev.map((m) => {
            if (toReplace.has(m)) return { ...m };
            if (m.type === 'assistant' && m.isStreaming) return { ...m, isStreaming: false };
            return m;
          });
        });
        contentBlocksRef.current = [];
        break;
      }

    }
  }, []);

  useEffect(() => {
    claudeBridge.setCallbacks({
      onConnect: () => {
        setIsBridgeReady(true);
      },
      onDisconnect: () => {
        setIsBridgeReady(false);
        setIsSessionReady(false);
        setIsStreaming(false);
      },
      onEvent: handleEvent,
      onError: (msg) => {
        setMessages((prev) => [
          ...prev,
          { type: 'error', content: msg, timestamp: new Date().toISOString() },
        ]);
        setIsStreaming(false);
      },
      onSessionStarted: () => {
        setIsSessionReady(true);
        if (pendingRetryRef.current) {
          const { dirs, message } = pendingRetryRef.current;
          pendingRetryRef.current = null;
          setMessages((prev) => [
            ...prev,
            {
              type: 'user',
              content: `已自动添加目录权限: ${dirs.join(', ')}，正在重试上一条消息...`,
              timestamp: new Date().toISOString(),
            } as ChatMessage,
          ]);
          claudeBridge.sendMessage(message.content);
          setIsStreaming(true);
        }
      },
      onSessionEnded: () => {
        setIsStreaming(false);
        setIsSessionReady(false);
      },
    });
    claudeBridge.connect();
    return () => {
      claudeBridge.disconnect();
    };
  }, [handleEvent]);

  const handleCommand = (raw: string): boolean => {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('/')) return false;

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();

    const pushSystem = (type: 'assistant' | 'error', text: string) => {
      setMessages((prev) => [
        ...prev,
        { type: 'user', content: trimmed, timestamp: new Date().toISOString() },
        { type, content: text, timestamp: new Date().toISOString() },
      ]);
    };

    switch (cmd) {
      case '/clear': {
        setMessages([]);
        setIsStreaming(false);
        contentBlocksRef.current = [];
        clearCurrentSession();
        claudeBridge.closeSession();
        claudeBridge.startSession({ dangerouslySkipPermissions });
        return true;
      }
      case '/resume': {
        const sessionId = parts[1];
        if (!sessionId) {
          pushSystem('error', '用法: /resume <session-id>');
          return true;
        }
        switchSession(sessionId);
        setIsStreaming(false);
        contentBlocksRef.current = [];
        pushSystem('assistant', `正在恢复会话: ${sessionId}...`);
        return true;
      }
      case '/model': {
        const model = parts[1];
        if (!model) {
          pushSystem('error', '用法: /model <model-name>');
          return true;
        }
        claudeBridge.closeSession();
        claudeBridge.startSession({ model, dangerouslySkipPermissions });
        setIsStreaming(false);
        contentBlocksRef.current = [];
        pushSystem('assistant', `已切换到模型: ${model}，新会话启动中...`);
        return true;
      }
      case '/save': {
        const filename = parts[1] || `chat-${Date.now()}.json`;
        const blob = new Blob([JSON.stringify(messages, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
        a.click();
        URL.revokeObjectURL(url);
        pushSystem('assistant', `对话已保存为 ${filename}`);
        return true;
      }
      case '/permissions': {
        const next = !dangerouslySkipPermissions;
        setDangerouslySkipPermissions(next);
        pushSystem('assistant', `已${next ? '开启' : '关闭'}跳过权限确认模式（仅对新会话生效）`);
        return true;
      }
      case '/debug': {
        const current = typeof window !== 'undefined' && !!localStorage.getItem('bridgeDebug');
        if (current) {
          localStorage.removeItem('bridgeDebug');
        } else {
          localStorage.setItem('bridgeDebug', 'true');
        }
        pushSystem('assistant', `桥接调试模式已${current ? '关闭' : '开启'}`);
        return true;
      }
      case '/help': {
        pushSystem('assistant', `**可用命令：**

- \`/clear\` — 清空当前对话
- \`/resume <session-id>\` — 恢复之前的会话
- \`/model <model-name>\` — 切换模型并重启会话
- \`/permissions\` — 切换是否跳过权限确认（自动允许所有操作）
- \`/save [filename]\` — 将当前对话保存为 JSON 文件
- \`/debug\` — 切换桥接调试模式（在浏览器控制台输出详细 JSON 流）

以下命令在 Web 模式下暂不支持：\`/compact\`、\`/cost\`、\`/history\`、\`/load\`、\`/settings\`、\`/quit\`、\`/exit\``);
        return true;
      }
      case '/compact':
      case '/cost':
      case '/history':
      case '/load':
      case '/settings':
      case '/quit':
      case '/exit': {
        pushSystem('error', `命令 ${cmd} 在 Web 模式下暂不可用。输入 /help 查看支持的命令。`);
        return true;
      }
      default: {
        pushSystem('error', `未知命令: ${cmd}。输入 /help 查看支持的命令。`);
        return true;
      }
    }
  };

  const handleSendMessage = (content: string, attachments?: ChatAttachment[]) => {
    if (!attachments?.length && content.trim().startsWith('/')) {
      if (handleCommand(content.trim())) return;
    }

    // UI 显示保留用户原文，不暴露路径
    const displayContent = content;

    // 发给 claude 的消息需要包含文件相对路径，它才能读取
    let claudeContent = content;
    if (attachments && attachments.length > 0) {
      const attachmentLines = attachments.map((att) => {
        const ref = att.url || (att.type === 'image' ? `[${att.name}]` : att.name);
        return att.type === 'image'
          ? `[Image attached: ${att.name}]\n路径: ${ref}`
          : `[File attached: ${att.name}]\n路径: ${ref}`;
      });
      claudeContent = [content, ...attachmentLines].filter(Boolean).join('\n');
    }

    setMessages((prev) => [
      ...prev,
      {
        type: 'user',
        content: displayContent,
        attachments,
        timestamp: new Date().toISOString(),
      } as ChatMessage,
    ]);

    lastUserMessageRef.current = { content: claudeContent, attachments };

    if (!claudeBridge.isConnected()) {
      setMessages((prev) => [
        ...prev,
        {
          type: 'error',
          content: '桥接服务未连接，请确保已运行 `npm run dev:bridge`',
          timestamp: new Date().toISOString(),
        },
      ]);
      return;
    }

    try {
      claudeBridge.sendMessage(claudeContent);
      setIsStreaming(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        { type: 'error', content: msg, timestamp: new Date().toISOString() },
      ]);
    }
  };

  const handleInterrupt = () => {
    claudeBridge.interrupt();
    setIsStreaming(false);
    contentBlocksRef.current.forEach((m) => {
      if (m) m.isStreaming = false;
    });
    setMessages((prev) => {
      const toReplace = new Set(contentBlocksRef.current.filter(Boolean));
      return prev.map((m) => (toReplace.has(m) ? { ...m } : m));
    });
  };

  const handleUpload = async (attachments: ChatAttachment[]): Promise<ChatAttachment[]> => {
    const results = await Promise.all(
      attachments.map(async (att) => {
        if (!att.data) return att;
        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: att.name, data: att.data, targetDir: '.claude-uploads' }),
          });
          const result = await res.json();
          if (!res.ok) {
            throw new Error(result.error || 'Upload failed');
          }
          return { ...att, url: result.path };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setMessages((prev) => [
            ...prev,
            { type: 'error', content: `上传失败: ${att.name} - ${msg}`, timestamp: new Date().toISOString() },
          ]);
          return { ...att, url: '' };
        }
      })
    );
    return results;
  };

  return (
    <div className={styles.chatArea}>
      <div className={styles.chatHeader}>
        <LayoutOutlined className={styles.toggleIcon} onClick={onToggleSidebar} />
        <div className={styles.tabs}>
          <span className={`${styles.tab} ${styles.tabActive}`}>执行状态</span>
          <span className={styles.tab}>执行记录</span>
        </div>
      </div>

      <div className={styles.messagesContainer}>
        <ChatMessagesPane
          chatMessages={messages}
          isLoading={isStreaming}
          onPermissionRequest={(allow, files, requestId) => {
            if (requestId) {
              claudeBridge.sendPermissionResponse(requestId, allow);
              setMessages((prev) =>
                prev.map((m) =>
                  m.permissionRequestId === requestId ? { ...m, isPermissionRequest: false } : m
                )
              );
              setMessages((prev) => [
                ...prev,
                {
                  type: 'user',
                  content: allow ? `已允许访问: ${(files || []).join(', ')}` : '已拒绝访问',
                  timestamp: new Date().toISOString(),
                },
              ]);
              return;
            }
            // Approach A: stream-json workaround for permission denials
            if (files && files.length > 0) {
              if (allow) {
                const dirs = files
                  .map((p) => {
                    const normalized = p.replace(/\\/g, '/');
                    const lastSlash = normalized.lastIndexOf('/');
                    return lastSlash >= 0 ? normalized.slice(0, lastSlash) : normalized;
                  })
                  .filter(Boolean);
                if (dirs.length > 0 && lastUserMessageRef.current) {
                  pendingRetryRef.current = { dirs, message: lastUserMessageRef.current };
                  claudeBridge.closeSession();
                  claudeBridge.startSession({ allowedDirs: dirs, dangerouslySkipPermissions: dangerouslySkipPermissionsRef.current });
                  return;
                }
              }
              setMessages((prev) => [
                ...prev,
                {
                  type: 'user',
                  content: '已拒绝访问',
                  timestamp: new Date().toISOString(),
                },
              ]);
            }
          }}
        />
      </div>

      <div className={styles.chatFooter}>
        <div className={styles.advancedInputArea}>

          <div className={styles.advancedInputPanel}>
            <div className={styles.envSelectorWrapper}>
              <Select
                defaultValue="env1"
                style={{ width: 130 }}
                options={[
                  { value: 'env1', label: '行解场景1' },
                  { value: 'env2', label: '行解场景2' },
                ]}
              />
              <span className={styles.eqIcon}>≈</span>
              <Select
                defaultValue="ip1"
                style={{ width: 140 }}
                options={[{ value: 'ip1', label: '7.213.211.12' }]}
              />
              <CaretRightOutlined className={styles.playBtn} />
            </div>

            <div className={styles.taskManagementWrapper}>
              <div className={styles.taskPanelHeader} onClick={() => setIsTaskExpanded(!isTaskExpanded)}>
                <div className={styles.taskPanelTitle}>
                  <SettingOutlined style={{ marginRight: 6 }} /> 任务管理
                </div>
                {isTaskExpanded ? <DownOutlined style={{ fontSize: 12, color: '#909399' }} /> : <UpOutlined style={{ fontSize: 12, color: '#909399' }} />}
              </div>
              {isTaskExpanded && (
                <div className={styles.taskBody}>
                  <Tree
                    checkable
                    defaultExpandAll
                    treeData={taskTreeData}
                  />
                </div>
              )}
            </div>

            <div style={{ marginTop: 8, fontSize: 12, color: '#606266', display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={dangerouslySkipPermissions}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setDangerouslySkipPermissions(next);
                    dangerouslySkipPermissionsRef.current = next;
                    if (claudeBridge.isConnected() && isSessionReady) {
                      setMessages((prev) => [
                        ...prev,
                        {
                          type: 'assistant',
                          content: `已${next ? '开启' : '关闭'}跳过权限确认，正在自动重启会话以应用设置...`,
                          timestamp: new Date().toISOString(),
                        } as ChatMessage,
                      ]);
                      claudeBridge.closeSession();
                      claudeBridge.startSession({ dangerouslySkipPermissions: next });
                    }
                  }}
                />
                <span>跳过权限确认（自动允许所有操作）</span>
              </label>
            </div>
          </div>

          <div className={styles.chatInputWrapper}>
            <ChatInput
              onSend={handleSendMessage}
              onInterrupt={handleInterrupt}
              onUpload={handleUpload}
              sessions={sessions}
              isProcessing={isStreaming}
              disabled={!isBridgeReady || !isSessionReady}
              placeholder={
                !isBridgeReady
                  ? "等待桥接服务连接..."
                  : !isSessionReady
                  ? "正在启动 Claude 会话..."
                  : "描述下您想执行怎样的测试任务？如：在71.14.16.144上，测试大数据spark性能"
              }
            />
          </div>
        </div>

        <div className={styles.footerHint}>
          内容由AI生成，无法确保准确性和完整性，仅供参考 | 使用条款 隐私声明
        </div>
      </div>
    </div>
  );
}
