/**
 * 文件系统相关类型定义
 */

export interface FileNode {
  /** 文件/目录名 */
  name: string;
  /** 完整路径 */
  path: string;
  /** 是否为目录 */
  isDirectory: boolean;
  /** 文件大小（字节） */
  size?: number;
  /** 最后修改时间 */
  modifiedTime?: string;
  /** 子节点（目录才有） */
  children?: FileNode[];
  /** 是否为叶子节点（文件） */
  isLeaf?: boolean;
  /** 文件类型 */
  mimeType?: string;
}

export interface FileSystemState {
  /** 当前所在路径 */
  currentPath: string;
  /** 选中的文件路径 */
  selectedFilePath?: string;
  /** 目录树数据 */
  treeData: FileNode[];
  /** 是否加载中 */
  loading: boolean;
  /** 错误信息 */
  error?: string;
}

export interface FilePreviewInfo {
  /** 文件路径 */
  path: string;
  /** 文件名称 */
  name: string;
  /** 文件内容（文本文件） */
  content?: string;
  /** 文件URL（用于图片等） */
  url?: string;
  /** 文件类型 */
  mimeType: string;
  /** 文件大小 */
  size: number;
}

export interface FileSystemConfig {
  /** 服务器基础URL */
  baseUrl: string;
  /** API前缀 */
  apiPrefix?: string;
  /** 当前会话ID/运行ID */
  sessionId?: string;
}
