import React from 'react';
import styles from './CollapsibleSection.module.css';

interface CollapsibleSectionProps {
  title: string;
  toolName?: string;
  open?: boolean;
  action?: React.ReactNode;
  onTitleClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  toolName,
  open = false,
  action,
  onTitleClick,
  children,
  className = '',
}) => {
  return (
    <details className={`${styles.details} ${className}`} open={open}>
      <summary className={styles.summary}>
        <svg className={styles.chevron} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {toolName && <span className={styles.toolName}>{toolName}</span>}
        {toolName && <span className={styles.divider}>/</span>}
        {onTitleClick ? (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTitleClick(); }}
            className={styles.titleButton}
          >
            {title}
          </button>
        ) : (
          <span className={styles.title}>{title}</span>
        )}
        {action && <span className={styles.action}>{action}</span>}
      </summary>
      <div className={styles.content}>{children}</div>
    </details>
  );
};
