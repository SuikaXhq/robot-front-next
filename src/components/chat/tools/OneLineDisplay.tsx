import React, { useState } from 'react';
import styles from './OneLineDisplay.module.css';

export interface OneLineDisplayProps {
  toolName: string;
  icon?: string;
  label?: string;
  value: string;
  secondary?: string;
  action?: 'copy' | 'open-file' | 'jump-to-results' | 'none';
  onAction?: () => void;
  style?: string;
  wrapText?: boolean;
  toolResult?: any;
  toolId?: string;
}

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export const OneLineDisplay: React.FC<OneLineDisplayProps> = ({
  toolName,
  icon,
  label,
  value,
  secondary,
  action = 'none',
  onAction,
  style,
  wrapText = false,
  toolId,
}) => {
  const [copied, setCopied] = useState(false);
  const isTerminal = style === 'terminal';

  const handleAction = async () => {
    if (action === 'copy' && value) {
      const didCopy = await copyToClipboard(value);
      if (!didCopy) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else if (onAction) {
      onAction();
    }
  };

  const renderCopyButton = () => (
    <button
      onClick={handleAction}
      className={styles.copyButton}
      title="Copy to clipboard"
      aria-label="Copy to clipboard"
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67c23a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2" />
        </svg>
      )}
    </button>
  );

  if (isTerminal) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.terminalWrapper}>
          <div className={styles.terminalIcon}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <path d="M8 9l3 3-3 3m5 0h3" />
            </svg>
          </div>
          <div className={styles.terminalBody}>
            <div className={styles.terminalCodeBlock}>
              <pre className={`${styles.terminalCode} ${wrapText ? '' : styles.terminalCodeTruncate}`}>
                <span className={styles.terminalPrompt}>$ </span>
                {value}
              </pre>
            </div>
            {action === 'copy' && renderCopyButton()}
          </div>
        </div>
        {secondary && <div className={styles.terminalSecondary}>{secondary}</div>}
      </div>
    );
  }

  if (action === 'open-file') {
    const displayName = value.split('/').pop() || value;
    return (
      <div className={styles.fileRow}>
        <span className={styles.fileLabel}>{label || toolName}</span>
        <span className={styles.fileDivider}>/</span>
        <button onClick={handleAction} className={styles.fileName} title={value}>
          {displayName}
        </button>
      </div>
    );
  }

  if (action === 'jump-to-results') {
    return (
      <div className={styles.searchRow}>
        <span className={styles.searchLabel}>{label || toolName}</span>
        <span className={styles.searchDivider}>/</span>
        <span className={styles.searchValue}>{value}</span>
        {secondary && <span className={styles.searchSecondary}>{secondary}</span>}
      </div>
    );
  }

  return (
    <div className={`${styles.wrapper} ${styles.defaultRow}`}>
      <span className={styles.defaultLabel}>{label || toolName}</span>
      <span className={styles.defaultDivider}>/</span>
      <span className={`${styles.defaultValue} ${wrapText ? styles.defaultValueWrap : ''}`}>{value}</span>
      {action === 'copy' && renderCopyButton()}
    </div>
  );
};
