/**
 * 文件系统服务
 * 提供与服务器文件系统交互的API
 */

import { FileNode, FilePreviewInfo, FileSystemConfig } from '@/types/fileSystem';

// 默认配置
let config: FileSystemConfig = {
  baseUrl: process.env.NEXT_PUBLIC_FILE_SERVER_URL || 'http://localhost:3001',
  apiPrefix: '/api/fs',
};

/**
 * 配置文件系统服务
 */
export function configureFileSystem(cfg: Partial<FileSystemConfig>) {
  config = { ...config, ...cfg };
}

/**
 * 获取完整的API URL
 */
function getApiUrl(endpoint: string): string {
  const prefix = config.apiPrefix || '/api/fs';
  return `${config.baseUrl}${prefix}${endpoint}`;
}

/**
 * 获取目录结构
 * @param path 目录路径，默认为根目录
 * @returns 文件节点数组
 */
export async function getDirectoryTree(path: string = '/'): Promise<FileNode[]> {
  // 实际项目中这里应该调用后端API
  // const response = await fetch(getApiUrl('/tree'), {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ path, sessionId: config.sessionId }),
  // });
  // if (!response.ok) throw new Error('Failed to fetch directory tree');
  // return response.json();

  // Mock数据 - 模拟文件系统结构（包含多种文件类型用于测试）
  await new Promise(resolve => setTimeout(resolve, 300));

  const mockData: FileNode[] = [
    {
      name: 'workspace',
      path: '/workspace',
      isDirectory: true,
      modifiedTime: new Date().toISOString(),
      children: [
        {
          name: 'projects',
          path: '/workspace/projects',
          isDirectory: true,
          modifiedTime: new Date().toISOString(),
          children: [
            {
              name: 'web-app',
              path: '/workspace/projects/web-app',
              isDirectory: true,
              modifiedTime: new Date().toISOString(),
              children: [
                {
                  name: 'src',
                  path: '/workspace/projects/web-app/src',
                  isDirectory: true,
                  modifiedTime: new Date().toISOString(),
                  children: [
                    { name: 'App.tsx', path: '/workspace/projects/web-app/src/App.tsx', isDirectory: false, size: 3200, mimeType: 'text/typescript', modifiedTime: new Date().toISOString() },
                    { name: 'index.tsx', path: '/workspace/projects/web-app/src/index.tsx', isDirectory: false, size: 450, mimeType: 'text/typescript', modifiedTime: new Date().toISOString() },
                    { name: 'utils.ts', path: '/workspace/projects/web-app/src/utils.ts', isDirectory: false, size: 2800, mimeType: 'text/typescript', modifiedTime: new Date().toISOString() },
                    { name: 'styles.css', path: '/workspace/projects/web-app/src/styles.css', isDirectory: false, size: 5600, mimeType: 'text/css', modifiedTime: new Date().toISOString() },
                  ],
                },
                { name: 'package.json', path: '/workspace/projects/web-app/package.json', isDirectory: false, size: 2400, mimeType: 'application/json', modifiedTime: new Date().toISOString() },
                { name: 'tsconfig.json', path: '/workspace/projects/web-app/tsconfig.json', isDirectory: false, size: 650, mimeType: 'application/json', modifiedTime: new Date().toISOString() },
                { name: 'README.md', path: '/workspace/projects/web-app/README.md', isDirectory: false, size: 5200, mimeType: 'text/markdown', modifiedTime: new Date().toISOString() },
                { name: 'Dockerfile', path: '/workspace/projects/web-app/Dockerfile', isDirectory: false, size: 890, mimeType: 'text/plain', modifiedTime: new Date().toISOString() },
              ],
            },
            {
              name: 'python-api',
              path: '/workspace/projects/python-api',
              isDirectory: true,
              modifiedTime: new Date().toISOString(),
              children: [
                { name: 'main.py', path: '/workspace/projects/python-api/main.py', isDirectory: false, size: 4800, mimeType: 'text/x-python', modifiedTime: new Date().toISOString() },
                { name: 'models.py', path: '/workspace/projects/python-api/models.py', isDirectory: false, size: 3200, mimeType: 'text/x-python', modifiedTime: new Date().toISOString() },
                { name: 'requirements.txt', path: '/workspace/projects/python-api/requirements.txt', isDirectory: false, size: 450, mimeType: 'text/plain', modifiedTime: new Date().toISOString() },
              ],
            },
          ],
        },
        {
          name: 'logs',
          path: '/workspace/logs',
          isDirectory: true,
          modifiedTime: new Date().toISOString(),
          children: [
            { name: 'app.log', path: '/workspace/logs/app.log', isDirectory: false, size: 102400, mimeType: 'text/plain', modifiedTime: new Date().toISOString() },
            { name: 'error.log', path: '/workspace/logs/error.log', isDirectory: false, size: 51200, mimeType: 'text/plain', modifiedTime: new Date().toISOString() },
            { name: 'access.log', path: '/workspace/logs/access.log', isDirectory: false, size: 256000, mimeType: 'text/plain', modifiedTime: new Date().toISOString() },
          ],
        },
        {
          name: 'scripts',
          path: '/workspace/scripts',
          isDirectory: true,
          modifiedTime: new Date().toISOString(),
          children: [
            { name: 'deploy.sh', path: '/workspace/scripts/deploy.sh', isDirectory: false, size: 1800, mimeType: 'text/x-shellscript', modifiedTime: new Date().toISOString() },
            { name: 'backup.sh', path: '/workspace/scripts/backup.sh', isDirectory: false, size: 2400, mimeType: 'text/x-shellscript', modifiedTime: new Date().toISOString() },
            { name: 'setup.sql', path: '/workspace/scripts/setup.sql', isDirectory: false, size: 5600, mimeType: 'text/x-sql', modifiedTime: new Date().toISOString() },
          ],
        },
      ],
    },
    {
      name: 'data',
      path: '/data',
      isDirectory: true,
      modifiedTime: new Date().toISOString(),
      children: [
        {
          name: 'exports',
          path: '/data/exports',
          isDirectory: true,
          modifiedTime: new Date().toISOString(),
          children: [
            { name: 'report-2024-01.csv', path: '/data/exports/report-2024-01.csv', isDirectory: false, size: 1048576, mimeType: 'text/csv', modifiedTime: new Date().toISOString() },
            { name: 'report-2024-02.csv', path: '/data/exports/report-2024-02.csv', isDirectory: false, size: 2097152, mimeType: 'text/csv', modifiedTime: new Date().toISOString() },
            { name: 'summary.json', path: '/data/exports/summary.json', isDirectory: false, size: 16384, mimeType: 'application/json', modifiedTime: new Date().toISOString() },
            { name: 'data.xml', path: '/data/exports/data.xml', isDirectory: false, size: 45000, mimeType: 'text/xml', modifiedTime: new Date().toISOString() },
          ],
        },
        {
          name: 'uploads',
          path: '/data/uploads',
          isDirectory: true,
          modifiedTime: new Date().toISOString(),
          children: [
            { name: 'avatar.png', path: '/data/uploads/avatar.png', isDirectory: false, size: 45000, mimeType: 'image/png', modifiedTime: new Date().toISOString() },
            { name: 'screenshot.jpg', path: '/data/uploads/screenshot.jpg', isDirectory: false, size: 128000, mimeType: 'image/jpeg', modifiedTime: new Date().toISOString() },
            { name: 'document.pdf', path: '/data/uploads/document.pdf', isDirectory: false, size: 256000, mimeType: 'application/pdf', modifiedTime: new Date().toISOString() },
            { name: 'archive.zip', path: '/data/uploads/archive.zip', isDirectory: false, size: 10485760, mimeType: 'application/zip', modifiedTime: new Date().toISOString() },
            { name: 'installer.exe', path: '/data/uploads/installer.exe', isDirectory: false, size: 52428800, mimeType: 'application/x-msdownload', modifiedTime: new Date().toISOString() },
          ],
        },
        {
          name: 'docs',
          path: '/data/docs',
          isDirectory: true,
          modifiedTime: new Date().toISOString(),
          children: [
            { name: 'README.md', path: '/data/docs/README.md', isDirectory: false, size: 8500, mimeType: 'text/markdown', modifiedTime: new Date().toISOString() },
            { name: 'API.md', path: '/data/docs/API.md', isDirectory: false, size: 12000, mimeType: 'text/markdown', modifiedTime: new Date().toISOString() },
            { name: 'CHANGELOG.md', path: '/data/docs/CHANGELOG.md', isDirectory: false, size: 6500, mimeType: 'text/markdown', modifiedTime: new Date().toISOString() },
          ],
        },
      ],
    },
    {
      name: 'config',
      path: '/config',
      isDirectory: true,
      modifiedTime: new Date().toISOString(),
      children: [
        { name: 'app.yaml', path: '/config/app.yaml', isDirectory: false, size: 4096, mimeType: 'text/yaml', modifiedTime: new Date().toISOString() },
        { name: 'database.json', path: '/config/database.json', isDirectory: false, size: 2048, mimeType: 'application/json', modifiedTime: new Date().toISOString() },
        { name: 'nginx.conf', path: '/config/nginx.conf', isDirectory: false, size: 3500, mimeType: 'text/plain', modifiedTime: new Date().toISOString() },
        { name: '.env', path: '/config/.env', isDirectory: false, size: 800, mimeType: 'text/plain', modifiedTime: new Date().toISOString() },
      ],
    },
    {
      name: 'assets',
      path: '/assets',
      isDirectory: true,
      modifiedTime: new Date().toISOString(),
      children: [
        {
          name: 'images',
          path: '/assets/images',
          isDirectory: true,
          modifiedTime: new Date().toISOString(),
          children: [
            { name: 'logo.png', path: '/assets/images/logo.png', isDirectory: false, size: 24000, mimeType: 'image/png', modifiedTime: new Date().toISOString() },
            { name: 'banner.jpg', path: '/assets/images/banner.jpg', isDirectory: false, size: 180000, mimeType: 'image/jpeg', modifiedTime: new Date().toISOString() },
            { name: 'icon.svg', path: '/assets/images/icon.svg', isDirectory: false, size: 2400, mimeType: 'image/svg+xml', modifiedTime: new Date().toISOString() },
          ],
        },
        {
          name: 'fonts',
          path: '/assets/fonts',
          isDirectory: true,
          modifiedTime: new Date().toISOString(),
          children: [
            { name: 'Roboto.woff2', path: '/assets/fonts/Roboto.woff2', isDirectory: false, size: 65000, mimeType: 'font/woff2', modifiedTime: new Date().toISOString() },
          ],
        },
      ],
    },
    {
      name: 'temp',
      path: '/temp',
      isDirectory: true,
      modifiedTime: new Date().toISOString(),
      children: [
        { name: 'cache.json', path: '/temp/cache.json', isDirectory: false, size: 12000, mimeType: 'application/json', modifiedTime: new Date().toISOString() },
        { name: 'session.dat', path: '/temp/session.dat', isDirectory: false, size: 4500, mimeType: 'application/octet-stream', modifiedTime: new Date().toISOString() },
      ],
    },
  ];

  return mockData;
}

/**
 * 获取指定目录的内容
 * @param path 目录路径
 * @returns 文件节点数组
 */
export async function listDirectory(path: string = '/'): Promise<FileNode[]> {
  // const response = await fetch(getApiUrl('/list'), {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ path, sessionId: config.sessionId }),
  // });
  // if (!response.ok) throw new Error('Failed to list directory');
  // return response.json();

  await new Promise(resolve => setTimeout(resolve, 200));

  const tree = await getDirectoryTree();

  // 根目录直接返回顶层节点
  if (path === '/' || path === '') {
    return tree;
  }

  // 从树形数据中提取指定目录的内容
  const findDirectory = (nodes: FileNode[], targetPath: string): FileNode[] | null => {
    for (const node of nodes) {
      if (node.path === targetPath) {
        return node.children || [];
      }
      if (node.children && targetPath.startsWith(node.path + '/')) {
        const result = findDirectory(node.children, targetPath);
        if (result) return result;
      }
    }
    return null;
  };

  return findDirectory(tree, path) || [];
}

/**
 * 获取文件预览信息
 * @param path 文件路径
 * @returns 文件预览信息
 */
export async function getFilePreview(path: string): Promise<FilePreviewInfo> {
  // const response = await fetch(getApiUrl('/preview'), {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ path, sessionId: config.sessionId }),
  // });
  // if (!response.ok) throw new Error('Failed to get file preview');
  // return response.json();

  await new Promise(resolve => setTimeout(resolve, 300));

  const fileName = path.split('/').pop() || '';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  // 根据文件扩展名判断mimeType
  const mimeTypeMap: Record<string, string> = {
    'txt': 'text/plain',
    'md': 'text/markdown',
    'json': 'application/json',
    'yaml': 'text/yaml',
    'yml': 'text/yaml',
    'csv': 'text/csv',
    'log': 'text/plain',
    'js': 'text/javascript',
    'ts': 'text/typescript',
    'tsx': 'text/typescript',
    'jsx': 'text/javascript',
    'html': 'text/html',
    'css': 'text/css',
    'py': 'text/x-python',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'pdf': 'application/pdf',
  };

  const mimeType = mimeTypeMap[ext] || 'application/octet-stream';

  // Mock文件内容
  let content: string | undefined;
  if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('javascript')) {
    content = generateMockContent(fileName, ext);
  }

  return {
    path,
    name: fileName,
    content,
    mimeType,
    size: Math.floor(Math.random() * 1000000),
  };
}

/**
 * 下载文件
 * @param path 文件路径
 */
export async function downloadFile(path: string): Promise<Blob> {
  // const response = await fetch(getApiUrl('/download'), {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ path, sessionId: config.sessionId }),
  // });
  // if (!response.ok) throw new Error('Failed to download file');
  // return response.blob();

  await new Promise(resolve => setTimeout(resolve, 500));

  // Mock文件内容
  const content = `This is the content of ${path}`;
  return new Blob([content], { type: 'text/plain' });
}

/**
 * 根据路径查找文件节点
 * @param tree 树形数据
 * @param path 目标路径
 * @returns 文件节点或null
 */
export function findNodeByPath(tree: FileNode[], path: string): FileNode | null {
  for (const node of tree) {
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

/**
 * 获取父目录路径
 * @param path 当前路径
 * @returns 父目录路径
 */
export function getParentPath(path: string): string {
  if (path === '/') return '/';
  const parts = path.split('/').filter(Boolean);
  parts.pop();
  return parts.length === 0 ? '/' : '/' + parts.join('/');
}

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化后的字符串
 */
export function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * 生成Mock文件内容
 */
function generateMockContent(fileName: string, ext: string): string {
  switch (ext) {
    case 'json':
      return JSON.stringify({
        name: fileName,
        version: '1.0.0',
        description: 'Mock configuration file',
        settings: {
          debug: true,
          port: 3000,
          host: 'localhost',
        },
      }, null, 2);
    case 'md':
      return `# ${fileName}\n\n## Overview\n\nThis is a **mock markdown** file for testing the editor.\n\n### Features\n\n- ✅ Syntax highlighting\n- ✅ Live preview\n- ✅ Split view editing\n\n### Code Example\n\n\`\`\`typescript\nfunction greet(name: string): string {\n  return \`Hello, \${name}!\`;\n}\n\nconsole.log(greet('World'));\n\`\`\`\n\n### Table\n\n| Name | Type | Required |\n|------|------|----------|\n| id | number | Yes |\n| name | string | Yes |\n| email | string | No |\n\n> **Note**: This is a demo file.\n`;
    case 'yaml':
    case 'yml':
      return `app:\n  name: \${fileName}\n  version: 1.0.0\n  env: development\n\ndatabase:\n  host: localhost\n  port: 5432\n  poolSize: 10\n`;
    case 'csv':
      return `id,name,value,category\n1,Item A,100,Electronics\n2,Item B,200,Clothing\n3,Item C,150,Food\n`;
    case 'log':
      return `[2024-01-15 10:30:00] INFO: Application started\n[2024-01-15 10:30:01] DEBUG: Loading config\n[2024-01-15 10:30:02] INFO: Database connected\n[2024-01-15 10:30:05] WARN: High memory usage\n`;
    case 'ts':
    case 'tsx':
      return `import React, { useState } from 'react';\n\ninterface Props {\n  title: string;\n}\n\nexport const App: React.FC<Props> = ({ title }) => {\n  const [count, setCount] = useState(0);\n  return (\n    <div>\n      <h1>{title}</h1>\n      <p>Count: {count}</p>\n      <button onClick={() => setCount(c => c + 1)}>+</button>\n    </div>\n  );\n};`;
    case 'py':
      return `#!/usr/bin/env python3\n\nclass DataProcessor:\n    def __init__(self, config: dict):\n        self.config = config\n\n    def process(self, data: list) -> list:\n        return [self._transform(item) for item in data]\n\n    def _transform(self, item: dict) -> dict:\n        return {'id': item['id'], 'value': item['value'] * 2}\n\nif __name__ == '__main__':\n    processor = DataProcessor({'debug': True})\n    print('Processor initialized')`;
    case 'css':
      return `:root {\n  --primary: #1890ff;\n  --success: #52c41a;\n}\n\n.container {\n  max-width: 1200px;\n  margin: 0 auto;\n}\n\n.btn {\n  padding: 8px 16px;\n  border-radius: 4px;\n  cursor: pointer;\n}`;
    case 'sh':
      return `#!/bin/bash\nset -e\n\necho "Deploying application..."\nnpm ci\nnpm run build\necho "Deploy completed!"`;
    case 'sql':
      return `-- Database schema\nCREATE TABLE users (\n    id SERIAL PRIMARY KEY,\n    username VARCHAR(50) UNIQUE NOT NULL,\n    email VARCHAR(100) UNIQUE NOT NULL,\n    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);\n\nCREATE INDEX idx_users_email ON users(email);`;
    case 'xml':
      return `<?xml version="1.0"?>\n<configuration>\n  <app name="demo" version="1.0.0" />\n  <database host="localhost" port="5432" />\n</configuration>`;
    case 'env':
      return `# Environment variables\nNODE_ENV=development\nPORT=3000\nDB_HOST=localhost\nDB_PASS=secret\nJWT_SECRET=your-secret-key`;
    default:
      return `// \${fileName}\n// Mock content for testing\n\nfunction example(name: string): string {\n  console.log('Hello from \${fileName}');\n  return \`Hello, \${name}!\`;\n}\n\nmodule.exports = { example };`;
  }
}

/**
 * 检查文件是否可预览
 * @param mimeType 文件类型
 * @returns 是否可预览
 */
export function isPreviewable(mimeType: string): boolean {
  const previewableTypes = [
    'text/',
    'image/',
    'application/json',
    'application/pdf',
  ];
  return previewableTypes.some(type => mimeType.startsWith(type));
}
