'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { FileNode, FilePreviewInfo } from '@/types/fileSystem';
import * as fileSystemService from '@/services/fileSystem';

interface FileSystemContextType {
  // 状态
  currentPath: string;
  selectedFilePath?: string;
  treeData: FileNode[];
  currentDirectoryContents: FileNode[];
  loading: boolean;
  error?: string;
  previewFile?: FilePreviewInfo;
  isPreviewOpen: boolean;
  /** 是否需要聚焦到文件系统tab */
  focusRequested: boolean;

  // 操作方法
  setCurrentPath: (path: string) => void;
  setSelectedFilePath: (path?: string) => void;
  navigateTo: (path: string) => Promise<void>;
  navigateUp: () => void;
  refreshDirectory: () => Promise<void>;
  openFile: (path: string) => Promise<void>;
  closePreview: () => void;
  downloadSelectedFile: () => Promise<void>;
  expandToPath: (path: string) => Promise<void>;
  clearFocusRequest: () => void;
}

const FileSystemContext = createContext<FileSystemContextType | undefined>(undefined);

export function useFileSystem() {
  const context = useContext(FileSystemContext);
  if (!context) {
    throw new Error('useFileSystem must be used within a FileSystemProvider');
  }
  return context;
}

interface FileSystemProviderProps {
  children: React.ReactNode;
  initialPath?: string;
}

export function FileSystemProvider({ children, initialPath = '/' }: FileSystemProviderProps) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [selectedFilePath, setSelectedFilePath] = useState<string | undefined>();
  const [treeData, setTreeData] = useState<FileNode[]>([]);
  const [currentDirectoryContents, setCurrentDirectoryContents] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [previewFile, setPreviewFile] = useState<FilePreviewInfo | undefined>();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [focusRequested, setFocusRequested] = useState(false);

  // 加载目录树
  const loadTreeData = useCallback(async () => {
    try {
      setLoading(true);
      setError(undefined);
      const data = await fileSystemService.getDirectoryTree();
      setTreeData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory tree');
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载当前目录内容
  const loadCurrentDirectory = useCallback(async () => {
    try {
      setLoading(true);
      setError(undefined);
      const contents = await fileSystemService.listDirectory(currentPath);
      setCurrentDirectoryContents(contents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory contents');
    } finally {
      setLoading(false);
    }
  }, [currentPath]);

  // 导航到指定路径
  const navigateTo = useCallback(async (path: string) => {
    setCurrentPath(path);
    // 如果树数据为空，先加载树
    if (treeData.length === 0) {
      await loadTreeData();
    }
    // 加载目录内容
    try {
      setLoading(true);
      const contents = await fileSystemService.listDirectory(path);
      setCurrentDirectoryContents(contents);
      setSelectedFilePath(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to navigate');
    } finally {
      setLoading(false);
    }
  }, [treeData.length, loadTreeData]);

  // 返回上级目录
  const navigateUp = useCallback(() => {
    const parentPath = fileSystemService.getParentPath(currentPath);
    if (parentPath !== currentPath) {
      navigateTo(parentPath);
    }
  }, [currentPath, navigateTo]);

  // 刷新当前目录
  const refreshDirectory = useCallback(async () => {
    await loadTreeData();
    await loadCurrentDirectory();
  }, [loadTreeData, loadCurrentDirectory]);

  // 打开文件（预览）
  const openFile = useCallback(async (path: string) => {
    try {
      setLoading(true);
      const preview = await fileSystemService.getFilePreview(path);
      setPreviewFile(preview);
      setIsPreviewOpen(true);
      setSelectedFilePath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open file');
    } finally {
      setLoading(false);
    }
  }, []);

  // 关闭预览
  const closePreview = useCallback(() => {
    setIsPreviewOpen(false);
    setTimeout(() => setPreviewFile(undefined), 200);
  }, []);

  // 清除聚焦请求
  const clearFocusRequest = useCallback(() => {
    setFocusRequested(false);
  }, []);

  // 下载选中的文件
  const downloadSelectedFile = useCallback(async () => {
    if (!selectedFilePath) return;
    try {
      const blob = await fileSystemService.downloadFile(selectedFilePath);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = selectedFilePath.split('/').pop() || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download file');
    }
  }, [selectedFilePath]);

  // 展开到指定路径（用于定位文件）
  const expandToPath = useCallback(async (targetPath: string) => {
    // 首先确保树数据已加载
    if (treeData.length === 0) {
      await loadTreeData();
    }

    // 检查路径是否存在
    const node = fileSystemService.findNodeByPath(treeData, targetPath);
    if (node) {
      // 设置聚焦请求，触发AgentPanel切换到文件系统tab
      setFocusRequested(true);
      if (node.isDirectory) {
        await navigateTo(targetPath);
      } else {
        // 如果是文件，导航到父目录并选中文件
        const parentPath = fileSystemService.getParentPath(targetPath);
        await navigateTo(parentPath);
        setSelectedFilePath(targetPath);
        // 打开文件预览
        await openFile(targetPath);
      }
    } else {
      setError(`Path not found: ${targetPath}`);
    }
  }, [treeData, loadTreeData, navigateTo, openFile]);

  // 初始化加载
  React.useEffect(() => {
    loadTreeData();
  }, [loadTreeData]);

  // 当前路径变化时重新加载目录内容
  React.useEffect(() => {
    if (treeData.length > 0) {
      loadCurrentDirectory();
    }
  }, [currentPath, treeData.length, loadCurrentDirectory]);

  const value = useMemo(() => ({
    currentPath,
    selectedFilePath,
    treeData,
    currentDirectoryContents,
    loading,
    error,
    previewFile,
    isPreviewOpen,
    focusRequested,
    setCurrentPath,
    setSelectedFilePath,
    navigateTo,
    navigateUp,
    refreshDirectory,
    openFile,
    closePreview,
    downloadSelectedFile,
    expandToPath,
    clearFocusRequest,
  }), [
    currentPath,
    selectedFilePath,
    treeData,
    currentDirectoryContents,
    loading,
    error,
    previewFile,
    isPreviewOpen,
    focusRequested,
    navigateTo,
    navigateUp,
    refreshDirectory,
    openFile,
    closePreview,
    downloadSelectedFile,
    expandToPath,
    clearFocusRequest,
  ]);

  return (
    <FileSystemContext.Provider value={value}>
      {children}
    </FileSystemContext.Provider>
  );
}
