'use client';

import React, { useState } from 'react';
import {
  Modal,
  Button,
  Space,
  Spin,
  Tag,
  Tooltip,
  message,
} from 'antd';
import {
  DownloadOutlined,
  CopyOutlined,
  CloseOutlined,
  FileTextOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileUnknownOutlined,
  CodeOutlined,
  EditOutlined,
  FileZipOutlined,
} from '@ant-design/icons';
import { useFileSystem } from '@/contexts/FileSystemContext';
import { formatFileSize, isPreviewable } from '@/services/fileSystem';
import MarkdownEditor from './MarkdownEditor';
import CodeEditor, { isEditable } from './CodeEditor';
import styles from './FilePreviewModal.module.css';

// 支持的代码语言映射
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
  'go': 'go',
  'rs': 'rust',
  'cpp': 'cpp',
  'c': 'c',
  'h': 'cpp',
  'cs': 'csharp',
  'php': 'php',
  'rb': 'ruby',
  'swift': 'swift',
  'kt': 'kotlin',
  'sql': 'sql',
  'yaml': 'yaml',
  'yml': 'yaml',
  'xml': 'xml',
  'sh': 'shell',
  'bash': 'shell',
  'md': 'markdown',
  'txt': 'text',
  'log': 'log',
};

// 获取文件语言
function getLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return languageMap[ext] || 'text';
}

// 获取文件图标
function getFileIcon(mimeType: string, fileName: string) {
  // 检查是否是压缩文件
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <FileZipOutlined />;
  }

  if (mimeType.startsWith('image/')) {
    return <FileImageOutlined />;
  }
  if (mimeType === 'application/pdf') {
    return <FilePdfOutlined />;
  }
  if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('javascript')) {
    return <CodeOutlined />;
  }
  return <FileUnknownOutlined />;
}

// 检查是否是二进制/不可预览文件
const binaryExtensions = new Set([
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2',
  'exe', 'dll', 'so', 'dylib',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
]);

function isBinaryFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return binaryExtensions.has(ext);
}

// 代码高亮（简单实现）
function CodeBlock({ content, language }: { content: string; language: string }) {
  const lines = content.split('\n');

  return (
    <div className={styles.codeBlock}>
      <div className={styles.lineNumbers}>
        {lines.map((_, i) => (
          <div key={i} className={styles.lineNumber}>{i + 1}</div>
        ))}
      </div>
      <pre className={styles.codeContent}>
        <code>{content}</code>
      </pre>
    </div>
  );
}

export default function FilePreviewModal() {
  const { previewFile, isPreviewOpen, closePreview, downloadSelectedFile } = useFileSystem();
  const [copied, setCopied] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  if (!previewFile) return null;

  const { name, path, content, mimeType, size } = previewFile;
  const canPreview = isPreviewable(mimeType);
  const language = getLanguage(name);
  const isMarkdown = language === 'markdown' || name.endsWith('.md');
  const editable = isEditable(name);
  const isBinary = isBinaryFile(name);

  // 处理复制
  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      message.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      message.error('复制失败');
    }
  };

  // 处理下载
  const handleDownload = async () => {
    try {
      await downloadSelectedFile();
      message.success('下载成功');
    } catch {
      message.error('下载失败');
    }
  };

  // 处理保存（模拟）
  const handleSave = async (newContent: string) => {
    console.log('Saving file:', path, newContent);
    await new Promise(resolve => setTimeout(resolve, 500));
    message.success('保存成功');
  };

  // 关闭编辑器并返回预览
  const handleCloseEditor = () => {
    setIsEditMode(false);
  };

  // 渲染预览内容
  const renderContent = () => {
    // 二进制文件提示
    if (isBinary) {
      return (
        <div className={styles.unsupportedPreview}>
          <FileZipOutlined className={styles.unsupportedIcon} />
          <p>此文件类型不支持在线预览</p>
          <p className={styles.fileType}>文件: {name}</p>
          <p className={styles.fileTypeHint}>该文件为二进制文件，请下载后查看</p>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload} style={{ marginTop: 16 }}>
            下载文件
          </Button>
        </div>
      );
    }

    // 图片预览
    if (mimeType.startsWith('image/')) {
      return (
        <div className={styles.imagePreview}>
          {previewFile.url ? (
            <img src={previewFile.url} alt={name} />
          ) : (
            <div className={styles.imagePlaceholder}>
              <FileImageOutlined />
              <p>图片预览: {name}</p>
            </div>
          )}
        </div>
      );
    }

    // PDF预览
    if (mimeType === 'application/pdf') {
      return (
        <div className={styles.pdfPreview}>
          {previewFile.url ? (
            <iframe src={previewFile.url} title={name} />
          ) : (
            <div className={styles.pdfPlaceholder}>
              <FilePdfOutlined />
              <p>PDF预览: {name}</p>
            </div>
          )}
        </div>
      );
    }

    // 编辑器模式
    if (isEditMode) {
      // Markdown 使用 MarkdownEditor
      if (isMarkdown) {
        return (
          <div className={styles.editorWrapper}>
            <MarkdownEditor
              initialContent={content || ''}
              filePath={path}
              onSave={handleSave}
              onClose={handleCloseEditor}
            />
          </div>
        );
      }

      // 其他可编辑文件使用 CodeEditor
      if (editable) {
        return (
          <div className={styles.editorWrapper}>
            <CodeEditor
              initialContent={content || ''}
              filePath={path}
              onSave={handleSave}
              onClose={handleCloseEditor}
            />
          </div>
        );
      }
    }

    // 不可编辑文件提示
    if (!editable) {
      return (
        <div className={styles.unsupportedPreview}>
          <FileUnknownOutlined className={styles.unsupportedIcon} />
          <p>此文件类型不支持在线编辑</p>
          <p className={styles.fileType}>文件: {name}</p>
          <p className={styles.fileTypeHint}>该文件格式无法在线编辑，请下载后查看</p>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload} style={{ marginTop: 16 }}>
            下载文件
          </Button>
        </div>
      );
    }

    // 文本/代码文件预览
    if (content !== undefined) {
      return (
        <div className={styles.textPreview}>
          <CodeBlock content={content} language={language} />
        </div>
      );
    }

    return (
      <div className={styles.loadingPreview}>
        <Spin description="加载中..." />
      </div>
    );
  };

  // 计算模态框宽度
  const getModalWidth = () => {
    if (isEditMode) {
      return isMarkdown ? 1000 : 900;
    }
    return 800;
  };

  // 计算模态框最大高度
  const getMaxHeight = () => {
    if (isEditMode) {
      return '78vh';
    }
    return '60vh';
  };

  // 判断是否显示编辑器（隐藏默认footer）
  const isEditorActive = isEditMode && (isMarkdown || editable);

  return (
    <Modal
      title={
        <div className={styles.modalHeader}>
          <Space>
            {getFileIcon(mimeType, name)}
            <span className={styles.fileName}>{name}</span>
            <Tag>{language}</Tag>
            {!editable && <Tag color="default">只读</Tag>}
          </Space>
        </div>
      }
      open={isPreviewOpen}
      onCancel={closePreview}
      width={getModalWidth()}
      className={styles.previewModal}
      styles={{
        body: {
          padding: 0,
          maxHeight: getMaxHeight(),
          overflow: 'auto',
        },
      }}
      footer={
        isEditorActive ? null : (
          <div className={styles.modalFooter}>
            <div className={styles.fileInfo}>
              <span>路径: {path}</span>
              <span>大小: {formatFileSize(size)}</span>
            </div>
            <Space>
              {editable && content && (
                <Button
                  icon={<EditOutlined />}
                  onClick={() => setIsEditMode(true)}
                >
                  编辑
                </Button>
              )}
              {content && (
                <Tooltip title={copied ? '已复制' : '复制内容'}>
                  <Button
                    icon={<CopyOutlined />}
                    onClick={handleCopy}
                  >
                    复制
                  </Button>
                </Tooltip>
              )}
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleDownload}
              >
                下载
              </Button>
              <Button
                icon={<CloseOutlined />}
                onClick={closePreview}
              >
                关闭
              </Button>
            </Space>
          </div>
        )
      }
    >
      <div className={styles.previewContent}>
        {renderContent()}
      </div>
    </Modal>
  );
}
