import React from 'react';
import { CollapsibleSection } from './CollapsibleSection';

interface CollapsibleDisplayProps {
  toolName: string;
  toolId?: string;
  title: string;
  defaultOpen?: boolean;
  action?: React.ReactNode;
  onTitleClick?: () => void;
  children: React.ReactNode;
  showRawParameters?: boolean;
  rawContent?: string;
  className?: string;
  toolCategory?: string;
}

export const CollapsibleDisplay: React.FC<CollapsibleDisplayProps> = ({
  toolName,
  title,
  defaultOpen = false,
  action,
  onTitleClick,
  children,
  showRawParameters = false,
  rawContent,
  className = '',
  toolCategory = 'default',
}) => {
  const borderColorMap: Record<string, string> = {
    edit: '#e6a23c',
    search: '#c0c4cc',
    bash: '#67c23a',
    todo: '#8e44ad',
    task: '#8e44ad',
    agent: '#9b59b6',
    plan: '#5b8ff9',
    question: '#409eff',
    default: '#dcdfe6',
  };

  const borderColor = borderColorMap[toolCategory] || borderColorMap.default;

  return (
    <div
      className={className}
      style={{
        borderLeft: `2px solid ${borderColor}`,
        margin: '4px 0',
        padding: '2px 0 2px 12px',
      }}
    >
      <CollapsibleSection
        title={title}
        toolName={toolName}
        open={defaultOpen}
        action={action}
        onTitleClick={onTitleClick}
      >
        {children}

        {showRawParameters && rawContent && (
          <details style={{ marginTop: 8, position: 'relative' }}>
            <summary
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                fontSize: 11,
                color: '#909399',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5l7 7-7 7" />
              </svg>
              raw params
            </summary>
            <pre
              style={{
                marginTop: 4,
                padding: 8,
                borderRadius: 4,
                backgroundColor: '#f5f7fa',
                fontSize: 11,
                color: '#606266',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'Menlo, Monaco, Courier New, monospace',
              }}
            >
              {rawContent}
            </pre>
          </details>
        )}
      </CollapsibleSection>
    </div>
  );
};
