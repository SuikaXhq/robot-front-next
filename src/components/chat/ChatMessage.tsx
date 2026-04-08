import React, { memo } from 'react';
import { Avatar } from 'antd';
import { MarkdownRenderer } from './MarkdownRenderer';
import styles from './ChatMessage.module.css';

interface Message {
  role: 'user' | 'assistant';
  content: string | unknown;
}

interface ChatMessageProps {
  message: Message;
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

export const ChatMessage = memo(function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const contentText = toDisplayText(message.content);

  return (
    <div className={`${styles.messageWrapper} ${isUser ? styles.userRow : styles.assistantRow}`}>
      {/* Assistant Avatar */}
      {!isUser && (
        <Avatar
          size={36}
          src="https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png"
          className={styles.avatar}
        />
      )}

      {/* Message Bubble Container */}
      <div className={styles.messageContent}>
        <div
          className={`${styles.bubble} ${
            isUser ? styles.userBubble : styles.assistantBubble
          }`}
        >
          {isUser ? (
            <div className={styles.userText}>{contentText}</div>
          ) : (
            <MarkdownRenderer content={contentText} />
          )}
        </div>
      </div>

      {/* User Avatar */}
      {isUser && (
        <Avatar
          size={36}
          src="https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png"
          className={styles.avatar}
        />
      )}
    </div>
  );
});
