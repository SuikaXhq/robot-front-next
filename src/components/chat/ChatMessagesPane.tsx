'use client';

import React, { useCallback, useRef, useEffect } from 'react';
import type { ChatMessage, SessionProvider } from './types';
import ClaudeMessage from './ClaudeMessage';
import AssistantThinkingIndicator from './AssistantThinkingIndicator';
import styles from './ChatMessagesPane.module.css';

interface ChatMessagesPaneProps {
  chatMessages: ChatMessage[];
  isLoading?: boolean;
  provider?: SessionProvider;
  showThinking?: boolean;
  autoExpandTools?: boolean;
  showRawParameters?: boolean;
  onFileOpen?: (filePath: string, diffInfo?: any) => void;
  onPermissionRequest?: (allow: boolean, files?: string[], requestId?: string) => void;
}

export default function ChatMessagesPane({
  chatMessages,
  isLoading = false,
  provider = 'claude',
  showThinking = true,
  autoExpandTools = false,
  showRawParameters = false,
  onFileOpen,
  onPermissionRequest,
}: ChatMessagesPaneProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messageKeyMapRef = useRef<WeakMap<ChatMessage, string>>(new WeakMap());
  const allocatedKeysRef = useRef<Set<string>>(new Set());
  const generatedCounterRef = useRef(0);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [chatMessages, isLoading]);

  const getMessageKey = useCallback((message: ChatMessage, index: number): string => {
    const existingKey = messageKeyMapRef.current.get(message);
    if (existingKey) return existingKey;

    const candidates = [message.id, message.messageId, message.toolId, message.toolCallId, message.blobId, message.rowid, message.sequence];
    let intrinsic = '';
    for (const candidate of candidates) {
      if (candidate !== undefined && candidate !== null) {
        intrinsic = `message-${message.type}-${String(candidate)}`;
        break;
      }
    }
    if (!intrinsic) {
      const ts = new Date(message.timestamp).getTime();
      const contentPreview = typeof message.content === 'string' ? message.content.slice(0, 48) : '';
      const toolName = typeof message.toolName === 'string' ? message.toolName : '';
      intrinsic = `message-${message.type}-${ts}-${toolName}-${contentPreview}`;
    }

    let candidateKey = intrinsic;
    if (allocatedKeysRef.current.has(candidateKey)) {
      do {
        generatedCounterRef.current += 1;
        candidateKey = `${intrinsic}-${generatedCounterRef.current}`;
      } while (allocatedKeysRef.current.has(candidateKey));
    }

    allocatedKeysRef.current.add(candidateKey);
    messageKeyMapRef.current.set(message, candidateKey);
    return candidateKey;
  }, []);

  return (
    <div className={styles.scrollContainer} ref={scrollContainerRef}>
      {chatMessages.length === 0 ? (
        <div className={styles.emptyState}>
          <p>Start a conversation by typing a message below.</p>
        </div>
      ) : (
        <div className={styles.messageList}>
          {chatMessages.map((message, index) => {
            const prevMessage = index > 0 ? chatMessages[index - 1] : null;
            return (
              <ClaudeMessage
                key={getMessageKey(message, index)}
                message={message}
                prevMessage={prevMessage}
                provider={provider}
                showThinking={showThinking}
                autoExpandTools={autoExpandTools}
                showRawParameters={showRawParameters}
                onFileOpen={onFileOpen}
                onPermissionRequest={onPermissionRequest}
              />
            );
          })}
        </div>
      )}
      {isLoading && <AssistantThinkingIndicator selectedProvider={provider} />}
    </div>
  );
}
