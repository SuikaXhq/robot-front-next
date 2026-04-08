'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  FolderOutlined,
  FileOutlined,
  FileTextOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileUnknownOutlined,
  ReloadOutlined,
  DownloadOutlined,
  EyeOutlined,
  ArrowUpOutlined,
  HomeOutlined,
  FolderOpenOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Tree, Button, Input, Spin, Empty, Breadcrumb, Tooltip } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { useFileSystem } from '@/contexts/FileSystemContext';
import { FileNode } from '@/types/fileSystem';
import { formatFileSize } from '@/services/fileSystem';
import styles from './FileSystemPanel.module.css';

// 获取文件图标
function getFileIcon(node: FileNode) {
  if (node.isDirectory) {
    return <FolderOutlined className={styles.folderIcon} />;
  }

  const ext = node.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'txt':
    case 'md':
    case 'log':
    case 'json':
    case 'yaml':
    case 'yml':
    case 'csv':
      return <FileTextOutlined className={styles.textFileIcon} />;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
      return <FileImageOutlined className={styles.imageFileIcon} />;
    case 'pdf':
      return <FilePdfOutlined className={styles.pdfFileIcon} />;
    default:
      return <FileOutlined className={styles.fileIcon} />;
  }
}

// 将 FileNode 转换为 Tree DataNode（只转换一层，异步加载子节点）
function convertToTreeData(nodes: FileNode[]): DataNode[] {
  return nodes.map(node => ({
    key: node.path,
    title: (
      <span className={styles.treeNodeTitle}>
        {getFileIcon(node)}
        <span className={styles.nodeName}>{node.name}</span>
      </span>
    ),
    isLeaf: !node.isDirectory,
    // 只有目录且有子节点时才设置children，用于显示展开箭头
    children: node.isDirectory
      ? (node.children && node.children.length > 0
        ? convertToTreeData(node.children)
        : []) // 空数组表示可以展开但暂无子节点
      : undefined,
  }));
}

// 查找指定路径的节点
function findNodeInTree(nodes: FileNode[], path: string): FileNode | null {
  for (const node of nodes) {
    if (node.path === path) {
      return node;
    }
    if (node.children) {
      const found = findNodeInTree(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

// 获取路径的所有父级路径
function getParentPaths(path: string): string[] {
  const paths: string[] = [];
  const parts = path.split('/').filter(Boolean);
  let currentPath = '';
  for (const part of parts) {
    currentPath += '/' + part;
    paths.push(currentPath);
  }
  return paths;
}

// 获取当前需要展开的keys（当前路径的所有父级）
function getExpandedKeys(currentPath: string): string[] {
  if (currentPath === '/') return [];
  // 展开当前路径及其所有父级
  const parents = getParentPaths(currentPath);
  // 加上根目录
  return ['/', ...parents];
}

export default function FileSystemPanel() {
  const {
    currentPath,
    selectedFilePath,
    setSelectedFilePath,
    treeData,
    currentDirectoryContents,
    loading,
    error,
    navigateTo,
    navigateUp,
    refreshDirectory,
    openFile,
    downloadSelectedFile,
    expandToPath,
  } = useFileSystem();

  const [searchValue, setSearchValue] = useState('');
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');
  const [isClient, setIsClient] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // 同步当前路径和展开状态
  useEffect(() => {
    setExpandedKeys(getExpandedKeys(currentPath));
  }, [currentPath]);

  // 格式化日期（避免hydration不匹配）
  const formatDate = useCallback((dateString?: string) => {
    if (!isClient || !dateString) return '-';
    try {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '-';
    }
  }, [isClient]);

  // 处理树节点选择 - 单击文件夹进入目录，单击文件打开预览
  const handleTreeSelect = useCallback((selectedKeys: React.Key[], info: any) => {
    if (selectedKeys.length > 0) {
      const path = selectedKeys[0] as string;
      const node = findNodeByPath(treeData, path);
      if (node) {
        setSelectedFilePath(path);
        if (node.isDirectory) {
          // 点击文件夹：导航到该目录并展开
          navigateTo(path);
        } else {
          // 点击文件：打开预览
          openFile(path);
        }
      }
    }
  }, [treeData, navigateTo, openFile, setSelectedFilePath]);

  // 处理列表项点击
  const handleItemClick = useCallback((node: FileNode) => {
    if (node.isDirectory) {
      navigateTo(node.path);
    } else {
      openFile(node.path);
    }
  }, [navigateTo, openFile]);

  // 处理面包屑导航
  const handleBreadcrumbClick = useCallback((path: string) => {
    navigateTo(path);
  }, [navigateTo]);

  // 生成面包屑项（使用新的 items API）
  const breadcrumbItems = React.useMemo(() => {
    const parts = currentPath.split('/').filter(Boolean);
    const items = [{ title: <HomeOutlined />, key: '/', onClick: () => handleBreadcrumbClick('/') }];
    let currentBuildPath = '';
    for (const part of parts) {
      currentBuildPath += '/' + part;
      const path = currentBuildPath;
      items.push({
        title: <span className={styles.breadcrumbLink}>{part}</span>,
        key: path,
        onClick: () => handleBreadcrumbClick(path),
      });
    }
    return items;
  }, [currentPath, handleBreadcrumbClick]);

  // 过滤后的列表
  const filteredContents = React.useMemo(() => {
    if (!searchValue) return currentDirectoryContents;
    const lowerSearch = searchValue.toLowerCase();
    return currentDirectoryContents.filter(node =>
      node.name.toLowerCase().includes(lowerSearch)
    );
  }, [currentDirectoryContents, searchValue]);

  // 处理搜索
  const handleSearch = useCallback((value: string) => {
    setSearchValue(value);
  }, []);

  // 处理在树中定位
  const handleLocateInTree = useCallback(async () => {
    if (selectedFilePath) {
      await expandToPath(selectedFilePath);
    }
  }, [selectedFilePath, expandToPath]);

  return (
    <div className={styles.fileSystemPanel}>
      {/* 工具栏 */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <Tooltip title="返回上级">
            <Button
              icon={<ArrowUpOutlined />}
              size="small"
              onClick={navigateUp}
              disabled={currentPath === '/'}
            />
          </Tooltip>
          <Tooltip title="刷新">
            <Button
              icon={<ReloadOutlined />}
              size="small"
              onClick={refreshDirectory}
              loading={loading}
            />
          </Tooltip>
          <Tooltip title="根目录">
            <Button
              icon={<HomeOutlined />}
              size="small"
              onClick={() => navigateTo('/')}
            />
          </Tooltip>
        </div>
        <div className={styles.toolbarRight}>
          <div className={styles.viewToggle}>
            <Button
              type={viewMode === 'tree' ? 'primary' : 'default'}
              size="small"
              icon={<FolderOutlined />}
              onClick={() => setViewMode('tree')}
            >
              树形
            </Button>
            <Button
              type={viewMode === 'list' ? 'primary' : 'default'}
              size="small"
              icon={<FileOutlined />}
              onClick={() => setViewMode('list')}
            >
              列表
            </Button>
          </div>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className={styles.searchBar}>
        <Input
          placeholder="搜索文件..."
          prefix={<SearchOutlined />}
          value={searchValue}
          onChange={e => handleSearch(e.target.value)}
          allowClear
          size="small"
        />
      </div>

      {/* 面包屑导航 */}
      <div className={styles.breadcrumbWrapper}>
        <Breadcrumb
          separator="/"
          items={breadcrumbItems}
        />
      </div>

      {/* 错误提示 */}
      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}

      {/* 内容区域 */}
      <div className={styles.contentArea}>
        {loading ? (
          <div className={styles.loadingContainer}>
            <Spin description="加载中..." />
          </div>
        ) : viewMode === 'tree' ? (
          <div className={styles.treeView}>
            {/* 根目录不显示"返回上级"，其他目录显示 */}
            {currentPath !== '/' && (
              <div
                className={styles.treeBackItem}
                onClick={navigateUp}
              >
                <ArrowUpOutlined className={styles.folderIcon} />
                <span className={styles.nodeName}>..</span>
              </div>
            )}
            {/* 显示当前目录内容 */}
            <Tree
              treeData={convertToTreeData(currentDirectoryContents)}
              onSelect={handleTreeSelect}
              selectedKeys={selectedFilePath ? [selectedFilePath] : []}
              autoExpandParent={false}
              showLine
              showIcon={false}
            />
          </div>
        ) : (
          <div className={styles.listView}>
            {filteredContents.length === 0 ? (
              <Empty description="暂无文件" />
            ) : (
              <div className={styles.fileList}>
                {filteredContents.map(node => (
                  <div
                    key={node.path}
                    className={`${styles.fileListItem} ${selectedFilePath === node.path ? styles.selected : ''}`}
                    onClick={() => handleItemClick(node)}
                    onDoubleClick={() => node.isDirectory ? navigateTo(node.path) : openFile(node.path)}
                  >
                    <div className={styles.fileItemIcon}>
                      {getFileIcon(node)}
                    </div>
                    <div className={styles.fileItemInfo}>
                      <div className={styles.fileItemName}>{node.name}</div>
                      <div className={styles.fileItemMeta}>
                        {node.isDirectory ? (
                          <span>文件夹</span>
                        ) : (
                          <>
                            <span>{formatFileSize(node.size)}</span>
                            <span>{formatDate(node.modifiedTime)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {!node.isDirectory && (
                      <div className={styles.fileItemActions}>
                        <Tooltip title="预览">
                          <Button
                            icon={<EyeOutlined />}
                            size="small"
                            type="text"
                            onClick={e => {
                              e.stopPropagation();
                              openFile(node.path);
                            }}
                          />
                        </Tooltip>
                        <Tooltip title="下载">
                          <Button
                            icon={<DownloadOutlined />}
                            size="small"
                            type="text"
                            onClick={e => {
                              e.stopPropagation();
                              // 直接下载
                            }}
                          />
                        </Tooltip>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 底部状态栏 */}
      <div className={styles.statusBar}>
        <span>{filteredContents.length} 个项目</span>
        {selectedFilePath && (
          <span className={styles.selectedPath}>
            已选择: {selectedFilePath.split('/').pop()}
          </span>
        )}
      </div>
    </div>
  );
}

// 辅助函数：根据路径查找节点
function findNodeByPath(nodes: FileNode[], path: string): FileNode | null {
  for (const node of nodes) {
    if (node.path === path) {
      return node;
    }
    if (node.children) {
      const found = findNodeByPath(node.children, path);
      if (found) return found;
    }
  }
  return null;
}
