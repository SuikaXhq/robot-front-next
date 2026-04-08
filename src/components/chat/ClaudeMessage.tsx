'use client';

import React, { memo, useMemo, useState, useEffect, useRef } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import MessageCopyControl from './MessageCopyControl';
import { ToolRenderer } from './tools/ToolRenderer';
import { shouldHideToolResult } from './tools/toolConfigs';
import type { ChatMessage, ChatAttachment, SessionProvider } from './types';
import styles from './ClaudeMessage.module.css';

function useImagePreview() {
  const [src, setSrc] = useState<string | null>(null);
  const [alt, setAlt] = useState('');

  const open = (s: string, a?: string) => {
    setSrc(s);
    setAlt(a || '');
  };
  const close = () => setSrc(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const Overlay = src
    ? () => (
        <div className={styles.previewOverlay} onClick={close}>
          <button
            type="button"
            className={styles.previewCloseBtn}
            onClick={(e) => { e.stopPropagation(); close(); }}
            aria-label="Close preview"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <img
            src={src}
            alt={alt}
            className={styles.previewImage}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )
    : () => null;

  return { open, close, Overlay };
}

interface ClaudeMessageProps {
  message: ChatMessage;
  prevMessage?: ChatMessage | null;
  provider?: SessionProvider;
  showThinking?: boolean;
  autoExpandTools?: boolean;
  showRawParameters?: boolean;
  onFileOpen?: (filePath: string, diffInfo?: any) => void;
  onPermissionRequest?: (allow: boolean, files?: string[], requestId?: string) => void;
}

const COPY_HIDDEN_TOOL_NAMES = new Set(['Bash', 'Edit', 'Write', 'ApplyPatch']);

const ProviderLogo: React.FC<{ provider: SessionProvider }> = ({ provider }) => {
  if (provider === 'cursor') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#303133" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 17l6-6-6-6" />
        <path d="M13 19h8" />
      </svg>
    );
  }
  if (provider === 'codex') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#303133" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M9 9h6v6H9z" />
      </svg>
    );
  }
  if (provider === 'gemini') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#303133" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#303133" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
      <path d="M8.5 8.5v.01" />
      <path d="M16 15.5v.01" />
      <path d="M12 12v.01" />
      <path d="M11 17v.01" />
      <path d="M7 14v.01" />
    </svg>
  );
};

const getProviderName = (provider: SessionProvider) => {
  if (provider === 'cursor') return 'Cursor';
  if (provider === 'codex') return 'Codex';
  if (provider === 'gemini') return 'Gemini';
  return 'Claude';
};

function formatFileSize(bytes?: number): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toDisplayText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === 'string'
          ? item
          : item?.type === 'text'
          ? item.text || ''
          : item?.text || item?.content || JSON.stringify(item)
      )
      .filter(Boolean)
      .join('\n');
  }
  if (value && typeof value === 'object') {
    return (value as any).text || (value as any).content || JSON.stringify(value);
  }
  return String(value || '');
}

function sanitizeServerPaths(text: string): string {
  if (typeof text !== 'string') return text;
  // 把 .claude-uploads 前面的绝对路径前缀去掉（支持 Windows / Unix）
  return text.replace(/(?:[A-Za-z]:[\\/]|[\\/])(?:[^\\/]*[\\/])*(\.claude-uploads[\\/][^\s\t\n"']+)/g, '$1');
}

function getAttachmentSrc(data?: string, url?: string): string | undefined {
  if (data) return data;
  if (url) return `/api/file?path=${encodeURIComponent(url)}`;
  return undefined;
}

const AttachmentsBlock: React.FC<{ attachments?: ChatAttachment[]; onImageClick?: (src: string, alt?: string) => void }> = ({ attachments, onImageClick }) => {
  if (!attachments || attachments.length === 0) return null;
  const images = attachments.filter((a) => a.type === 'image');
  const files = attachments.filter((a) => a.type === 'file');
  return (
    <>
      {images.length > 0 && (
        <div className={styles.imageGrid}>
          {images.map((img, idx) => {
            const src = getAttachmentSrc(img.data, img.url);
            return (
              <img
                key={`${img.name}-${idx}`}
                src={src}
                alt={img.name}
                className={styles.gridImage}
                onClick={() => onImageClick?.(src || '', img.name)}
              />
            );
          })}
        </div>
      )}
      {files.length > 0 && (
        <div className={styles.fileAttachmentList}>
          {files.map((file, idx) => {
            const href = getAttachmentSrc(file.data, file.url);
            return (
              <a
                key={`${file.name}-${idx}`}
                className={styles.fileAttachmentItem}
                href={href || undefined}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!href) e.preventDefault();
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                  <polyline points="13 2 13 9 20 9" />
                </svg>
                <span className={styles.fileAttachmentName}>{file.name}</span>
                {file.size != null && (
                  <span className={styles.fileAttachmentSize}>{formatFileSize(file.size)}</span>
                )}
              </a>
            );
          })}
        </div>
      )}
    </>
  );
};

function formatUsageLimitText(text: string, isClient: boolean): string {
  try {
    if (typeof text !== 'string') return String(text);
    // 服务端渲染时返回原文本，避免时间格式化导致的hydration问题
    if (!isClient) return text;
    return text.replace(/Claude AI usage limit reached\|(\d{10,13})/g, (match, ts) => {
      let timestampMs = parseInt(ts, 10);
      if (!Number.isFinite(timestampMs)) return match;
      if (timestampMs < 1e12) timestampMs *= 1000;
      const reset = new Date(timestampMs);
      // 使用固定格式避免locale差异
      const hours = reset.getHours().toString().padStart(2, '0');
      const minutes = reset.getMinutes().toString().padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dateReadable = `${reset.getDate()} ${months[reset.getMonth()]} ${reset.getFullYear()}`;
      return `Claude usage limit reached. Your limit will reset at **${timeStr}** - ${dateReadable}`;
    });
  } catch {
    return text;
  }
}

const ClaudeMessage = memo(({
  message,
  prevMessage = null,
  provider = 'claude',
  showThinking = true,
  autoExpandTools = false,
  showRawParameters = false,
  onFileOpen,
  onPermissionRequest,
}: ClaudeMessageProps) => {
  const isGrouped = Boolean(
    prevMessage &&
    prevMessage.type === message.type &&
    (prevMessage.type === 'assistant' || prevMessage.type === 'user' || prevMessage.type === 'tool' || prevMessage.type === 'error')
  );

  const messageRef = useRef<HTMLDivElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const node = messageRef.current;
    if (!autoExpandTools || !node || !message.isToolUse) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isExpanded) {
            setIsExpanded(true);
            const details = node.querySelectorAll<HTMLDetailsElement>('details');
            details.forEach((detail) => { detail.open = true; });
          }
        });
      },
      { threshold: 0.1 }
    );
    observer.observe(node);
    return () => { observer.unobserve(node); };
  }, [autoExpandTools, isExpanded, message.isToolUse]);

  // 使用客户端状态来避免hydration不匹配
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const formattedTime = useMemo(() => {
    if (!isClient) return '';
    try {
      const date = new Date(message.timestamp);
      // 使用固定格式避免locale差异导致的hydration问题
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const seconds = date.getSeconds().toString().padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
    } catch {
      return '';
    }
  }, [message.timestamp, isClient]);

  const shouldHideThinkingMessage = Boolean(message.isThinking && !showThinking);
  if (shouldHideThinkingMessage) return null;

  const userCopyContent = toDisplayText(message.content);
  const formattedMessageContent = useMemo(() => formatUsageLimitText(userCopyContent, isClient), [userCopyContent, isClient]);
  const sanitizedMessageContent = useMemo(() => sanitizeServerPaths(formattedMessageContent), [formattedMessageContent]);
  const assistantCopyContent = message.isToolUse
    ? toDisplayText((message as any).displayText || message.content)
    : sanitizedMessageContent;

  const { open: openPreview, Overlay: PreviewOverlay } = useImagePreview();

  const isCommandOrFileEditToolResponse = Boolean(
    message.isToolUse && COPY_HIDDEN_TOOL_NAMES.has(String(message.toolName || ''))
  );

  const shouldShowUserCopyControl = message.type === 'user' && userCopyContent.trim().length > 0;
  const shouldShowAssistantCopyControl =
    message.type === 'assistant' &&
    assistantCopyContent.trim().length > 0 &&
    !isCommandOrFileEditToolResponse;

  const rowClass =
    message.type === 'user'
      ? `${styles.messageRow} ${styles.userRow}`
      : `${styles.messageRow} ${message.type === 'error' ? styles.errorRow : message.type === 'tool' ? styles.toolRow : styles.assistantRow}`;

  const bubbleClass =
    message.type === 'user'
      ? `${styles.bubble} ${styles.userBubble}`
      : `${styles.bubble} ${styles.assistantBubble}`;

  return (
    <>
      <div ref={messageRef} className={`${rowClass} ${isGrouped ? styles.grouped : ''}`}>
        {message.type === 'user' ? (
          <>
            <div className={styles.messageContent}>
              <div className={bubbleClass}>
                <div className={styles.userText}>{toDisplayText(message.content)}</div>
                {message.images && message.images.length > 0 && (
                  <div className={styles.imageGrid}>
                    {message.images.map((img, idx) => (
                      <img
                        key={img.name || idx}
                        src={img.data}
                        alt={img.name}
                        className={styles.gridImage}
                        onClick={() => openPreview(img.data, img.name)}
                      />
                    ))}
                  </div>
                )}
                <AttachmentsBlock attachments={message.attachments} onImageClick={openPreview} />
                <div className={styles.userMeta}>
                  {shouldShowUserCopyControl && (
                    <MessageCopyControl content={userCopyContent} messageType="user" />
                  )}
                  <span>{formattedTime}</span>
                </div>
              </div>
            </div>
            {!isGrouped && <div className={`${styles.avatar} ${styles.userAvatar}`}>U</div>}
          </>
        ) : message.isTaskNotification ? (
          <div className={styles.taskNotification}>
            <span className={`${styles.taskDot} ${message.taskStatus === 'completed' ? styles.taskDotCompleted : styles.taskDotPending}`} />
            <span className={styles.taskText}>{toDisplayText(message.content)}</span>
          </div>
        ) : (
          <>
            {!isGrouped && (
              <div
                className={`${styles.avatar} ${
                  message.type === 'error' ? styles.errorAvatar : message.type === 'tool' ? styles.toolAvatar : styles.assistantAvatar
                }`}
              >
                {message.type === 'error' ? '!' : message.type === 'tool' ? '🔧' : <ProviderLogo provider={provider} />}
              </div>
            )}
            <div className={styles.messageContent} style={{ maxWidth: '100%' }}>
              {!isGrouped && (
                <div className={`${styles.senderName} ${message.type === 'error' ? styles.senderNameError : ''}`}>
                  {message.type === 'error'
                    ? 'Error'
                    : message.type === 'tool'
                    ? 'Tool'
                    : getProviderName(provider)}
                </div>
              )}

              <div className={bubbleClass}>
                {message.isToolUse ? (
                  <>
                    {(message as any).displayText && (
                      <div style={{ marginBottom: 8 }}>
                        <MarkdownRenderer content={toDisplayText((message as any).displayText)} />
                      </div>
                    )}
                    {message.toolInput && (
                      <ToolRenderer
                        toolName={message.toolName || 'UnknownTool'}
                        toolInput={message.toolInput}
                        toolResult={message.toolResult}
                        toolId={message.toolId}
                        mode="input"
                        onFileOpen={onFileOpen}
                        autoExpandTools={autoExpandTools}
                        showRawParameters={showRawParameters}
                        rawToolInput={typeof message.toolInput === 'string' ? message.toolInput : undefined}
                        isSubagentContainer={message.isSubagentContainer}
                        subagentState={message.subagentState}
                      />
                    )}
                    {message.toolResult && !shouldHideToolResult(message.toolName || 'UnknownTool', message.toolResult) && (
                      message.toolResult.isError ? (
                        <div className={styles.toolErrorBox}>
                          <div className={styles.toolErrorHeader}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f56c6c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            <span>Error</span>
                          </div>
                          <div className={styles.toolErrorContent}>
                            <MarkdownRenderer content={sanitizeServerPaths(toDisplayText(message.toolResult?.content))} />
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginTop: 8 }}>
                          <ToolRenderer
                            toolName={message.toolName || 'UnknownTool'}
                            toolInput={message.toolInput}
                            toolResult={message.toolResult}
                            toolId={message.toolId}
                            mode="result"
                            onFileOpen={onFileOpen}
                            autoExpandTools={autoExpandTools}
                          />
                        </div>
                      )
                    )}
                  </>
                ) : message.isPermissionDeniedResult ? (
                  <div className={styles.permissionPanel}>
                    <div className={styles.permissionHeader}>
                      <div className={styles.permissionIcon}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          <path d="M12 8v4" />
                          <path d="M12 16h.01" />
                        </svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className={styles.permissionTitle}>权限受限，无法访问文件</div>
                        <div className={styles.permissionDesc}>
                          Claude 需要访问以下文件才能继续。允许将自动添加对应目录权限并重试上一条消息。
                        </div>
                        {message.permissionFiles && message.permissionFiles.length > 0 && (
                          <div className={styles.permissionFileList}>
                            {message.permissionFiles.map((file, idx) => (
                              <div key={idx} className={styles.permissionFileItem}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                                  <polyline points="13 2 13 9 20 9" />
                                </svg>
                                <span className={styles.permissionFileName}>{file}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className={styles.permissionActions}>
                          <button
                            className={styles.permissionAllowBtn}
                            onClick={() => onPermissionRequest?.(true, message.permissionFiles, message.permissionRequestId)}
                          >
                            允许（添加目录权限并重试）
                          </button>
                          <button
                            className={styles.permissionDenyBtn}
                            onClick={() => onPermissionRequest?.(false, message.permissionFiles, message.permissionRequestId)}
                          >
                            拒绝
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : message.isPermissionRequest ? (
                  <div className={styles.permissionPanel}>
                    <div className={styles.permissionHeader}>
                      <div className={styles.permissionIcon}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          <path d="M12 8v4" />
                          <path d="M12 16h.01" />
                        </svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className={styles.permissionTitle}>请求访问文件</div>
                        <div className={styles.permissionDesc}>
                          {toDisplayText(message.content) || 'Claude 需要访问以下文件才能继续。是否允许？'}
                        </div>
                        {message.permissionFiles && message.permissionFiles.length > 0 && (
                          <div className={styles.permissionFileList}>
                            {message.permissionFiles.map((file, idx) => (
                              <div key={idx} className={styles.permissionFileItem}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                                  <polyline points="13 2 13 9 20 9" />
                                </svg>
                                <span className={styles.permissionFileName}>{file}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className={styles.permissionActions}>
                          <button
                            className={styles.permissionAllowBtn}
                            onClick={() => onPermissionRequest?.(true, message.permissionFiles, message.permissionRequestId)}
                          >
                            允许访问
                          </button>
                          <button
                            className={styles.permissionDenyBtn}
                            onClick={() => onPermissionRequest?.(false, message.permissionFiles, message.permissionRequestId)}
                          >
                            拒绝
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : message.isInteractivePrompt ? (
                  <div className={styles.interactivePanel}>
                    <div className={styles.interactiveHeader}>
                      <div className={styles.interactiveIcon}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                          <path d="M12 17h.01" />
                        </svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className={styles.interactiveTitle}>Interactive Question</div>
                        {(() => {
                          const lines = toDisplayText(message.content).split('\n').filter((line) => line.trim());
                          const questionLine = lines.find((line) => line.includes('?')) || lines[0] || '';
                          const optionMap = new Map<string, { number: string; text: string; isSelected: boolean }>();
                          lines.forEach((line) => {
                            const optionMatch = line.match(/[❯\s]*(\d+)\.\s+(.+)/);
                            if (optionMatch) {
                              const isSelected = line.includes('❯');
                              const num = optionMatch[1];
                              const text = optionMatch[2].trim();
                              const existing = optionMap.get(num);
                              if (!existing || isSelected) {
                                optionMap.set(num, { number: num, text, isSelected });
                              }
                            }
                          });
                          const options = Array.from(optionMap.values());
                          return (
                            <>
                              <p className={styles.interactiveQuestion}>{questionLine}</p>
                              <div style={{ marginBottom: 8 }}>
                                {options.map((option) => (
                                  <button
                                    key={option.number}
                                    disabled
                                    className={`${styles.interactiveOption} ${option.isSelected ? styles.interactiveOptionSelected : ''}`}
                                  >
                                    <span className={`${styles.optionNumber} ${option.isSelected ? styles.optionNumber : ''}`}>{option.number}</span>
                                    <span style={{ flex: 1, fontSize: 13 }}>{option.text}</span>
                                    {option.isSelected && <span>❯</span>}
                                  </button>
                                ))}
                              </div>
                              <div className={styles.interactiveHint}>
                                <div className={styles.interactiveHintTitle}>Waiting for your response</div>
                                <div className={styles.interactiveHintText}>Reply in the input box below to continue.</div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ) : message.isThinking ? (
                  <div className={styles.thinkingWrapper}>
                    <details>
                      <summary className={styles.thinkingSummary}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 5l7 7-7 7" />
                        </svg>
                        <span>Thinking</span>
                      </summary>
                      <div className={styles.thinkingContent}>
                        <MarkdownRenderer content={toDisplayText(message.content)} />
                      </div>
                    </details>
                  </div>
                ) : (
                  <div className={styles.assistantText}>
                    {showThinking && message.reasoning && (
                      <details className={styles.thinkingWrapper} style={{ marginBottom: 10 }}>
                        <summary className={styles.thinkingSummary}>Thinking</summary>
                        <div className={styles.thinkingContent} style={{ fontStyle: 'italic' }}>
                          {message.reasoning}
                        </div>
                      </details>
                    )}

                    {(() => {
                      const content = sanitizedMessageContent;
                      const trimmedContent = content.trim();
                      if (
                        (trimmedContent.startsWith('{') || trimmedContent.startsWith('[')) &&
                        (trimmedContent.endsWith('}') || trimmedContent.endsWith(']'))
                      ) {
                        try {
                          const parsed = JSON.parse(trimmedContent);
                          const formatted = JSON.stringify(parsed, null, 2);
                          return (
                            <div className={styles.jsonBlockWrapper}>
                              <div className={styles.jsonBlockHeader}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                  <line x1="16" y1="13" x2="8" y2="13" />
                                  <line x1="16" y1="17" x2="8" y2="17" />
                                  <polyline points="10 9 9 9 8 9" />
                                </svg>
                                <span style={{ fontWeight: 500 }}>JSON Response</span>
                              </div>
                              <div className={styles.jsonBlock}>
                                <pre className={styles.jsonPre}>{formatted}</pre>
                              </div>
                            </div>
                          );
                        } catch {
                          // fallthrough
                        }
                      }

                      if (message.type === 'assistant' || message.type === 'tool' || message.type === 'error') {
                        return <MarkdownRenderer content={content} />;
                      }
                      return <div className={styles.userText}>{content}</div>;
                    })()}
                  </div>
                )}
                <AttachmentsBlock attachments={message.attachments} onImageClick={openPreview} />

                <div className={styles.metaRow}>
                  {shouldShowAssistantCopyControl && (
                    <MessageCopyControl content={assistantCopyContent} messageType="assistant" />
                  )}
                  {!isGrouped && <span>{formattedTime}</span>}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      <PreviewOverlay />
    </>
  );
});

ClaudeMessage.displayName = 'ClaudeMessage';
export default ClaudeMessage;
