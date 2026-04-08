'use client';

import React, { memo, useMemo, useCallback } from 'react';
import { getToolConfig, shouldHideToolResult } from './toolConfigs';
import { OneLineDisplay } from './OneLineDisplay';
import { CollapsibleDisplay } from './CollapsibleDisplay';
import { MarkdownRenderer } from '../MarkdownRenderer';

interface ToolRendererProps {
  toolName: string;
  toolInput: any;
  toolResult?: any;
  toolId?: string;
  mode: 'input' | 'result';
  onFileOpen?: (filePath: string, diffInfo?: any) => void;
  autoExpandTools?: boolean;
  showRawParameters?: boolean;
  rawToolInput?: string;
  isSubagentContainer?: boolean;
  subagentState?: {
    childTools: any[];
    currentToolIndex: number;
    isComplete: boolean;
  };
}

function getToolCategory(toolName: string): string {
  if (['Edit', 'Write', 'ApplyPatch'].includes(toolName)) return 'edit';
  if (['Grep', 'Glob'].includes(toolName)) return 'search';
  if (toolName === 'Bash') return 'bash';
  if (['TodoWrite', 'TodoRead'].includes(toolName)) return 'todo';
  if (['TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet'].includes(toolName)) return 'task';
  if (toolName === 'Task') return 'agent';
  if (toolName === 'exit_plan_mode' || toolName === 'ExitPlanMode') return 'plan';
  if (toolName === 'AskUserQuestion') return 'question';
  return 'default';
}

const FileListContent: React.FC<{ files: string[]; title?: string }> = ({ files, title }) => (
  <div style={{ fontSize: 12 }}>
    {title && <div style={{ fontWeight: 500, marginBottom: 6, color: '#606266' }}>{title}</div>}
    <ul style={{ margin: 0, paddingLeft: 16 }}>
      {files.map((f, i) => (
        <li key={i} style={{ fontFamily: 'Menlo, Monaco, Courier New, monospace', marginBottom: 2 }}>{f}</li>
      ))}
    </ul>
  </div>
);

const TodoListContent: React.FC<{ todos?: any[]; isResult?: boolean }> = ({ todos, isResult }) => {
  if (!todos || todos.length === 0) return null;
  return (
    <div style={{ fontSize: 12 }}>
      <ul style={{ margin: 0, paddingLeft: 16 }}>
        {todos.map((todo: any, i: number) => (
          <li key={i} style={{ marginBottom: 4 }}>
            <span style={{ fontWeight: 500 }}>{todo.id}</span>: {todo.content} {todo.status && <span style={{ color: '#909399' }}>({todo.status})</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};

const TaskListContent: React.FC<{ content: string }> = ({ content }) => (
  <div style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{content}</div>
);

const QuestionAnswerContent: React.FC<{ questions: any[]; answers: Record<string, string> }> = ({ questions, answers }) => (
  <div style={{ fontSize: 12 }}>
    {questions.map((q: any, i: number) => (
      <div key={i} style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 500, color: '#606266' }}>{q.header || 'Question'}</div>
        <div style={{ color: '#303133', marginBottom: 4 }}>{q.question}</div>
        {answers[q.question] && <div style={{ color: '#67c23a' }}>Answer: {answers[q.question]}</div>}
      </div>
    ))}
  </div>
);

const TextContent: React.FC<{ content: string; format?: 'plain' | 'code' }> = ({ content, format }) => {
  if (format === 'code') {
    return (
      <pre style={{ margin: 0, padding: 8, backgroundColor: '#1e1e1e', color: '#d4d4d4', borderRadius: 6, fontSize: 11, fontFamily: 'Menlo, Monaco, Courier New, monospace', overflowX: 'auto' }}>
        {content}
      </pre>
    );
  }
  return <div style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{content}</div>;
};

export const ToolRenderer: React.FC<ToolRendererProps> = memo(({
  toolName,
  toolInput,
  toolResult,
  toolId,
  mode,
  onFileOpen,
  autoExpandTools = false,
  showRawParameters = false,
  rawToolInput,
  isSubagentContainer,
  subagentState,
}) => {
  const config = getToolConfig(toolName);
  const displayConfig: any = mode === 'input' ? config.input : config.result;

  const parsedData = useMemo(() => {
    try {
      const rawData = mode === 'input' ? toolInput : toolResult;
      return typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    } catch {
      return mode === 'input' ? toolInput : toolResult;
    }
  }, [mode, toolInput, toolResult]);

  const handleAction = useCallback(() => {
    if (displayConfig?.action === 'open-file' && onFileOpen) {
      const value = displayConfig.getValue?.(parsedData) || '';
      onFileOpen(value);
    }
  }, [displayConfig, parsedData, onFileOpen]);

  if (isSubagentContainer && subagentState) {
    if (mode === 'result') return null;
    return (
      <div style={{ fontSize: 12, color: '#909399', padding: '4px 0' }}>
        Subagent: {subagentState.childTools.length} tools
      </div>
    );
  }

  if (!displayConfig) return null;

  if (displayConfig.type === 'one-line') {
    const value = displayConfig.getValue?.(parsedData) || '';
    const secondary = displayConfig.getSecondary?.(parsedData);
    return (
      <OneLineDisplay
        toolName={toolName}
        icon={displayConfig.icon}
        label={displayConfig.label}
        value={value}
        secondary={secondary}
        action={displayConfig.action}
        onAction={handleAction}
        style={displayConfig.style}
        wrapText={displayConfig.wrapText}
        toolResult={toolResult}
        toolId={toolId}
      />
    );
  }

  if (displayConfig.type === 'collapsible') {
    const title = typeof displayConfig.title === 'function'
      ? displayConfig.title(parsedData)
      : displayConfig.title || 'Details';

    const defaultOpen = displayConfig.defaultOpen !== undefined
      ? displayConfig.defaultOpen
      : autoExpandTools;

    const contentProps = displayConfig.getContentProps?.(parsedData, { onFileOpen }) || {};

    let contentComponent: React.ReactNode = null;
    switch (displayConfig.contentType) {
      case 'markdown':
        contentComponent = <MarkdownRenderer content={contentProps.content || ''} />;
        break;
      case 'file-list':
        contentComponent = <FileListContent files={contentProps.files || []} title={contentProps.title} />;
        break;
      case 'todo-list':
        contentComponent = <TodoListContent todos={contentProps.todos} isResult={contentProps.isResult} />;
        break;
      case 'task':
        contentComponent = <TaskListContent content={contentProps.content || ''} />;
        break;
      case 'question-answer':
        contentComponent = <QuestionAnswerContent questions={contentProps.questions || []} answers={contentProps.answers || {}} />;
        break;
      case 'text':
        contentComponent = <TextContent content={contentProps.content || ''} format={contentProps.format || 'plain'} />;
        break;
      case 'success-message': {
        const msg = displayConfig.getMessage?.(parsedData) || 'Success';
        contentComponent = (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#67c23a' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
            {msg}
          </div>
        );
        break;
      }
      default:
        contentComponent = <TextContent content={String(contentProps.content || '')} />;
    }

    const handleTitleClick = (toolName === 'Edit' || toolName === 'Write' || toolName === 'ApplyPatch') && contentProps.filePath && onFileOpen
      ? () => onFileOpen(contentProps.filePath, { old_string: contentProps.oldContent, new_string: contentProps.newContent })
      : undefined;

    return (
      <CollapsibleDisplay
        toolName={toolName}
        toolId={toolId}
        title={title}
        defaultOpen={defaultOpen}
        onTitleClick={handleTitleClick}
        showRawParameters={mode === 'input' && showRawParameters}
        rawContent={rawToolInput}
        toolCategory={getToolCategory(toolName)}
      >
        {contentComponent}
      </CollapsibleDisplay>
    );
  }

  return null;
});

ToolRenderer.displayName = 'ToolRenderer';
