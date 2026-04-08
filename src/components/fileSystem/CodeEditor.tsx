'use client';

import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Button, Space, Tooltip, message } from 'antd';
import {
  SaveOutlined,
  CloseOutlined,
  CopyOutlined,
  DownloadOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import styles from './CodeEditor.module.css';

// 动态导入 Monaco Editor 避免 SSR 问题
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
});

// 文件扩展名到 Monaco Editor 语言的映射
const languageMap: Record<string, string> = {
  'js': 'javascript',
  'jsx': 'javascript',
  'ts': 'typescript',
  'tsx': 'typescript',
  'json': 'json',
  'html': 'html',
  'htm': 'html',
  'css': 'css',
  'scss': 'scss',
  'less': 'less',
  'py': 'python',
  'java': 'java',
  'c': 'c',
  'cpp': 'cpp',
  'h': 'cpp',
  'hpp': 'cpp',
  'cs': 'csharp',
  'go': 'go',
  'rs': 'rust',
  'rb': 'ruby',
  'php': 'php',
  'swift': 'swift',
  'kt': 'kotlin',
  'scala': 'scala',
  'r': 'r',
  'm': 'objective-c',
  'mm': 'objective-c',
  'sh': 'shell',
  'bash': 'shell',
  'zsh': 'shell',
  'ps1': 'powershell',
  'sql': 'sql',
  'yaml': 'yaml',
  'yml': 'yaml',
  'xml': 'xml',
  'dockerfile': 'dockerfile',
  'makefile': 'makefile',
  'cmake': 'cmake',
  'vue': 'vue',
  'svelte': 'svelte',
  'lua': 'lua',
  'perl': 'perl',
  'pl': 'perl',
};

// 获取文件语言
function getLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return languageMap[ext] || 'plaintext';
}

// 不可编辑的文件扩展名
const nonEditableExtensions = new Set([
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2',
  'exe', 'dll', 'so', 'dylib',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'ico', 'webp',
  'mp3', 'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
]);

// 检查文件是否可编辑
export function isEditable(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return !nonEditableExtensions.has(ext);
}

interface CodeEditorProps {
  /** 初始内容 */
  initialContent: string;
  /** 文件路径 */
  filePath: string;
  /** 保存回调 */
  onSave?: (content: string) => Promise<void>;
  /** 关闭回调 */
  onClose?: () => void;
}

/**
 * 代码编辑器组件
 * 基于 Monaco Editor，支持语法高亮和代码编辑
 */
export default function CodeEditor({
  initialContent,
  filePath,
  onSave,
  onClose,
}: CodeEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [originalContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // 客户端挂载检查
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const language = getLanguage(filePath);
  const fileName = filePath.split('/').pop() || 'untitled';
  const canEdit = isEditable(filePath);

  // 处理内容变化
  const handleChange = useCallback((value?: string) => {
    setContent(value || '');
    setHasChanges(value !== originalContent);
  }, [originalContent]);

  // 处理保存
  const handleSave = useCallback(async () => {
    if (!onSave) return;
    try {
      setIsSaving(true);
      await onSave(content);
      setHasChanges(false);
      message.success('保存成功');
    } catch (err) {
      message.error('保存失败');
    } finally {
      setIsSaving(false);
    }
  }, [content, onSave]);

  // 处理撤销
  const handleUndo = useCallback(() => {
    setContent(originalContent);
    setHasChanges(false);
    message.info('已撤销所有更改');
  }, [originalContent]);

  // 处理复制
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      message.success('已复制到剪贴板');
    } catch {
      message.error('复制失败');
    }
  }, [content]);

  // 处理下载
  const handleDownload = useCallback(() => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, [content, fileName]);

  // 不可编辑文件提示
  if (!canEdit) {
    return (
      <div className={styles.codeEditor}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <span className={styles.fileName}>{fileName}</span>
            <span className={styles.readOnlyBadge}>不可编辑</span>
          </div>
          <div className={styles.toolbarRight}>
            <Button icon={<CloseOutlined />} onClick={onClose}>
              关闭
            </Button>
          </div>
        </div>
        <div className={styles.uneditableContainer}>
          <div className={styles.uneditableIcon}>📄</div>
          <div className={styles.uneditableTitle}>此文件类型不支持编辑</div>
          <div className={styles.uneditableDesc}>
            该文件为二进制文件或不支持的格式，无法在线编辑。
            <br />
            您可以下载后在本地查看或编辑。
          </div>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload}>
            下载文件
          </Button>
        </div>
      </div>
    );
  }

  // 服务端渲染时显示加载状态
  if (!isMounted) {
    return (
      <div className={styles.codeEditor}>
        <div className={styles.toolbar}>
          <span className={styles.fileName}>{fileName}</span>
        </div>
        <div className={styles.editorContainer}>
          <div style={{ padding: 40, textAlign: 'center', color: '#909399' }}>
            编辑器加载中...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.codeEditor}>
      {/* 工具栏 */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <span className={styles.fileName}>{fileName}</span>
          {hasChanges && <span className={styles.unsavedIndicator}>● 未保存</span>}
          <span className={styles.languageBadge}>{language}</span>
        </div>
        <div className={styles.toolbarRight}>
          <Space>
            <Tooltip title="撤销更改">
              <Button
                icon={<UndoOutlined />}
                onClick={handleUndo}
                disabled={!hasChanges}
              />
            </Tooltip>
            <Tooltip title="复制内容">
              <Button icon={<CopyOutlined />} onClick={handleCopy}>
                复制
              </Button>
            </Tooltip>
            <Button icon={<DownloadOutlined />} onClick={handleDownload}>
              下载
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={isSaving}
              disabled={!hasChanges}
            >
              保存
            </Button>
            <Button icon={<CloseOutlined />} onClick={onClose}>
              关闭
            </Button>
          </Space>
        </div>
      </div>

      {/* 编辑器区域 */}
      <div className={styles.editorContainer}>
        <MonacoEditor
          height="100%"
          language={language}
          value={content}
          onChange={handleChange}
          theme="vs-light"
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            folding: true,
            foldingStrategy: 'indentation',
            showFoldingControls: 'always',
            matchBrackets: 'always',
            autoIndent: 'full',
            formatOnPaste: true,
            formatOnType: true,
          }}
        />
      </div>

      {/* 底部状态栏 */}
      <div className={styles.statusBar}>
        <span>行数: {content.split('\n').length}</span>
        <span>字符数: {content.length}</span>
        <span>语言: {language}</span>
        <span>编码: UTF-8</span>
      </div>
    </div>
  );
}
