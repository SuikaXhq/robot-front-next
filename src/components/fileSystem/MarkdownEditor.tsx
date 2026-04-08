'use client';

import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Button, Space, Switch, Tooltip } from 'antd';
import { EditOutlined, EyeOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import styles from './MarkdownEditor.module.css';

// 动态导入MDEditor以避免SSR问题
const MDEditor = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default),
  { ssr: false }
);

const MDPreview = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default.Markdown),
  { ssr: false }
);

interface MarkdownEditorProps {
  /** 初始内容 */
  initialContent: string;
  /** 文件路径 */
  filePath: string;
  /** 保存回调 */
  onSave?: (content: string) => Promise<void>;
  /** 关闭回调 */
  onClose?: () => void;
  /** 是否只读模式 */
  readOnly?: boolean;
}

/**
 * Markdown编辑器组件
 * 支持编辑和预览模式切换
 */
export default function MarkdownEditor({
  initialContent,
  filePath,
  onSave,
  onClose,
  readOnly = false,
}: MarkdownEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [isEditMode, setIsEditMode] = useState(!readOnly);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // 客户端挂载检查
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // 处理内容变化
  const handleChange = useCallback((value?: string) => {
    setContent(value || '');
    setHasChanges(true);
  }, []);

  // 处理保存
  const handleSave = useCallback(async () => {
    if (!onSave) return;
    try {
      setIsSaving(true);
      await onSave(content);
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setIsSaving(false);
    }
  }, [content, onSave]);

  // 切换编辑/预览模式
  const toggleMode = useCallback(() => {
    setIsEditMode(prev => !prev);
  }, []);

  // 获取文件名
  const fileName = filePath.split('/').pop() || 'untitled.md';

  // 服务端渲染时显示加载状态
  if (!isMounted) {
    return (
      <div className={styles.markdownEditor}>
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
    <div className={styles.markdownEditor}>
      {/* 工具栏 */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <span className={styles.fileName}>{fileName}</span>
          {hasChanges && <span className={styles.unsavedIndicator}>● 未保存</span>}
        </div>
        <div className={styles.toolbarRight}>
          <Space>
            {!readOnly && (
              <>
                <Tooltip title={isEditMode ? '切换到预览' : '切换到编辑'}>
                  <Switch
                    checked={isEditMode}
                    onChange={toggleMode}
                    checkedChildren={<EditOutlined />}
                    unCheckedChildren={<EyeOutlined />}
                  />
                </Tooltip>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  loading={isSaving}
                  disabled={!hasChanges}
                >
                  保存
                </Button>
              </>
            )}
            <Button icon={<CloseOutlined />} onClick={onClose}>
              关闭
            </Button>
          </Space>
        </div>
      </div>

      {/* 编辑器区域 */}
      <div className={styles.editorContainer} data-color-mode="light">
        {isEditMode ? (
          <MDEditor
            value={content}
            onChange={handleChange}
            height="100%"
            preview="edit"
            hideToolbar={false}
          />
        ) : (
          <div className={styles.previewContainer}>
            <MDPreview source={content} />
          </div>
        )}
      </div>

      {/* 底部状态栏 */}
      <div className={styles.statusBar}>
        <span>字符数: {content.length}</span>
        <span>行数: {content.split('\n').length}</span>
        <span>模式: {isEditMode ? '编辑' : '预览'}</span>
      </div>
    </div>
  );
}
