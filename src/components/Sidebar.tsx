'use client';

import { useState } from 'react';
import styles from './Sidebar.module.css';
import sessionStyles from './SessionSidebar.module.css';
import {
  SettingOutlined,
  FileAddOutlined,
  FolderFilled,
  FileTextOutlined,
  MoreOutlined,
  PlusOutlined,
  DeleteOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { Button, Tree, Dropdown, Popconfirm } from 'antd';
import type { TreeDataNode } from 'antd';
import { useRouter, usePathname } from 'next/navigation';
import { useChatSessions } from '@/contexts/ChatSessionContext';

const treeData: TreeDataNode[] = [
  {
    title: '目录',
    key: '0',
    children: [
      { title: '1111', key: '0-0', isLeaf: true },
      { title: '1111', key: '0-1', isLeaf: true },
      { title: '1111', key: '0-2', isLeaf: true },
      { title: '1111', key: '0-3', isLeaf: true },
      { title: '1111', key: '0-4', isLeaf: true },
      { title: '1111', key: '0-5', isLeaf: true },
    ],
  },
];

const statusMap: Record<string, { text: string; color: string }> = {
  '0-0': { text: '待运行', color: '#909399' },
  '0-1': { text: '运行中', color: '#409eff' },
  '0-2': { text: '运行失败', color: '#f56c6c' },
  '0-3': { text: '运行成功', color: '#67c23a' },
  '0-4': { text: '运行成功', color: '#67c23a' },
  '0-5': { text: '运行成功', color: '#67c23a' },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function Sidebar() {
  const [taskViewMode, setTaskViewMode] = useState<'cases' | 'commands'>('cases');
  const { sessions, currentSessionId, createSession, switchSession, deleteSession } = useChatSessions();
  const router = useRouter();
  const pathname = usePathname();

  const handleSwitchSession = (id: string) => {
    switchSession(id);
    if (pathname !== '/chat') {
      router.push('/chat');
    }
  };

  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <div className={styles.robotTitle}>
          <div className={styles.logoCircle}>
            <div className={styles.logoInner} />
          </div>
          <span className={styles.titleText}>Robot 蜂群</span>
        </div>
      </div>

      <div className={sessionStyles.sessionList}>
        <div className={sessionStyles.sessionListHeader}>
          <span className={sessionStyles.sessionListTitle}>历史会话</span>
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => {
              createSession();
              if (pathname !== '/chat') {
                router.push('/chat');
              }
            }}
            className={sessionStyles.newSessionBtn}
          >
            新建
          </Button>
        </div>
        <div className={sessionStyles.sessionItems}>
          {sessions.length === 0 && (
            <div className={sessionStyles.emptyState}>暂无会话</div>
          )}
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`${sessionStyles.sessionItem} ${currentSessionId === session.id ? sessionStyles.sessionItemActive : ''}`}
              onClick={() => handleSwitchSession(session.id)}
            >
              <div className={sessionStyles.sessionItemLeft}>
                <MessageOutlined className={sessionStyles.sessionIcon} />
                <span className={sessionStyles.sessionTitle} title={session.title}>
                  {session.title}
                </span>
              </div>
              <div className={sessionStyles.sessionItemRight}>
                <span className={sessionStyles.sessionTime}>{formatTime(session.updatedAt)}</span>
                <Popconfirm
                  title="删除会话"
                  description="确定要删除这个会话吗？"
                  onConfirm={() => {
                    deleteSession(session.id);
                  }}
                  okText="删除"
                  cancelText="取消"
                >
                  <button
                    type="button"
                    className={sessionStyles.deleteBtn}
                    onClick={(e) => e.stopPropagation()}
                    title="删除"
                  >
                    <DeleteOutlined />
                  </button>
                </Popconfirm>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.sidebarDivider} />

      <div className={styles.taskTreeSection}>
        <div className={styles.taskHeader}>
          <span className={styles.taskTitle}>任务管理</span>
          <Button type="link" size="small" icon={<SettingOutlined />}>
            MCP配置
          </Button>
        </div>
        <div className={styles.taskTabs}>
          <div className={styles.segmentedControl}>
            <span
              className={`${styles.segTab} ${taskViewMode === 'cases' ? styles.segTabActive : ''}`}
              onClick={() => setTaskViewMode('cases')}
            >
              用例
            </span>
            <span
              className={`${styles.segTab} ${taskViewMode === 'commands' ? styles.segTabActive : ''}`}
              onClick={() => setTaskViewMode('commands')}
            >
              指令
            </span>
          </div>
          <Button type="link" size="small" icon={<FileAddOutlined />}>
            创建
          </Button>
        </div>
        <div className={styles.treeContainer}>
          <Tree
            checkable
            defaultExpandAll
            treeData={treeData}
            titleRender={(node) => {
              const key = node.key as string;
              const st = statusMap[key];
              return (
                <div className={styles.customTreeNode}>
                  <span className={styles.nodeLeft}>
                    {node.children ? (
                      <FolderFilled style={{ color: '#E6A23C', fontSize: 14 }} />
                    ) : (
                      <FileTextOutlined style={{ color: '#A8ABB2', fontSize: 14 }} />
                    )}
                    <span className={styles.nodeLabel}>{node.title as string}</span>
                  </span>
                  <span className={styles.nodeRight}>
                    {st && <span style={{ fontSize: 12, color: st.color }}>{st.text}</span>}
                    {!node.children && (
                      <Dropdown
                        menu={{
                          items: [
                            { key: 'copy', label: '复制' },
                            { key: 'edit', label: '编辑' },
                            { key: 'delete', label: <span style={{ color: '#f56c6c' }}>删除</span> },
                          ],
                        }}
                        trigger={['click']}
                      >
                        <MoreOutlined className={styles.moreIcon} onClick={(e) => e.stopPropagation()} />
                      </Dropdown>
                    )}
                  </span>
                </div>
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}
