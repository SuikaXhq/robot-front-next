'use client';

import React from 'react';
import { FileOutlined, FolderOutlined } from '@ant-design/icons';
import { useFileSystem } from '@/contexts/FileSystemContext';
import styles from './FileLink.module.css';

interface FileLinkProps {
  /** 文件路径 */
  path: string;
  /** 显示文本（可选，默认为文件名） */
  children?: React.ReactNode;
  /** 是否以行内方式显示 */
  inline?: boolean;
}

/**
 * 文件链接组件
 * 在chat消息中显示可点击的文件路径，点击后跳转到文件系统并定位到该文件
 */
export default function FileLink({ path, children, inline = false }: FileLinkProps) {
  const { expandToPath } = useFileSystem();

  // 判断是文件还是目录
  const isDirectory = !path.includes('.') || path.endsWith('/');

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await expandToPath(path);
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  };

  return (
    <span
      className={`${styles.fileLink} ${inline ? styles.inline : ''}`}
      onClick={handleClick}
      title={`点击在文件系统中定位: ${path}`}
    >
      {isDirectory ? (
        <FolderOutlined className={styles.icon} />
      ) : (
        <FileOutlined className={styles.icon} />
      )}
      <span className={styles.path}>{children || path}</span>
    </span>
  );
}

/**
 * 从文本中提取可能的文件路径
 * 支持的格式：
 * - /path/to/file.txt
 * - /path/to/directory/
 * - C:\\path\\to\\file.txt (Windows)
 * - ./relative/path
 * - ~/home/path
 */
export function detectFilePaths(text: string): Array<{ path: string; start: number; end: number }> {
  const paths: Array<{ path: string; start: number; end: number }> = [];

  // Unix绝对路径: /path/to/file or /path/to/dir/
  const unixPathRegex = /(?:^|\s)(\/[^\s:]+(?:\/[^\s:]+)*\/?)(?=\s|$|["'\n])/g;

  // Windows路径: C:\path\to\file
  const windowsPathRegex = /(?:^|\s)([a-zA-Z]:\\[^\s:]+(?:\\[^\s:]+)*)(?=\s|$|["'\n])/g;

  // 相对路径: ./path or ../path
  const relativePathRegex = /(?:^|\s)(\.\.?\/[^\s:]+(?:\/[^\s:]+)*)(?=\s|$|["'\n])/g;

  // 带~的路径: ~/path
  const homePathRegex = /(?:^|\s)(~\/[^\s:]+(?:\/[^\s:]+)*)(?=\s|$|["'\n])/g;

  const matches = [
    ...text.matchAll(unixPathRegex),
    ...text.matchAll(windowsPathRegex),
    ...text.matchAll(relativePathRegex),
    ...text.matchAll(homePathRegex),
  ];

  for (const match of matches) {
    if (match.index !== undefined) {
      const path = match[1].trim();
      // 过滤掉URL（包含http/https的）
      if (!path.startsWith('http') && path.length > 1) {
        paths.push({
          path,
          start: match.index + (match[0].length - path.length),
          end: match.index + match[0].length,
        });
      }
    }
  }

  return paths;
}
