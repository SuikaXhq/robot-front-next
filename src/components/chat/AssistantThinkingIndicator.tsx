'use client';

import { SessionProvider } from './types';
import styles from './AssistantThinkingIndicator.module.css';

interface AssistantThinkingIndicatorProps {
  selectedProvider?: SessionProvider;
}

export default function AssistantThinkingIndicator({ selectedProvider = 'claude' }: AssistantThinkingIndicatorProps) {
  const name = selectedProvider === 'cursor' ? 'Cursor' : selectedProvider === 'codex' ? 'Codex' : selectedProvider === 'gemini' ? 'Gemini' : 'Claude';

  return (
    <div className={styles.row}>
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.avatar}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#909399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
              <path d="M8.5 8.5v.01" />
              <path d="M16 15.5v.01" />
              <path d="M12 12v.01" />
              <path d="M11 17v.01" />
              <path d="M7 14v.01" />
            </svg>
          </div>
          <div className={styles.name}>{name}</div>
        </div>
        <div className={styles.dots}>
          <span className={styles.bounceDot} />
          <span className={styles.bounceDot} />
          <span className={styles.bounceDot} />
          <span className={styles.thinkingText}>正在思考</span>
        </div>
      </div>
    </div>
  );
}
