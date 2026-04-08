'use client';

import { useState } from 'react';
import styles from './DiscussionGroup.module.css';
import {
  MenuOutlined,
  UpOutlined,
  DownOutlined,
  UserOutlined,
  CheckCircleOutlined,
  LinkOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { Tabs, Input } from 'antd';

export default function DiscussionGroup() {
  const [inputMessage, setInputMessage] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={styles.discussionGroup}>
      <div className={styles.discussionHeader}>
        <MenuOutlined className={styles.headerIcon} />
        <div className={styles.headerTitle}>开发团队讨论组</div>
        {isCollapsed ? (
          <DownOutlined
            className={styles.headerIcon}
            onClick={() => setIsCollapsed(false)}
            title="展开"
          />
        ) : (
          <UpOutlined
            className={styles.headerIcon}
            onClick={() => setIsCollapsed(true)}
            title="收起"
          />
        )}
      </div>

      {!isCollapsed && (
        <>
          <div className={styles.discussionTabs}>
        <Tabs
          defaultActiveKey="status"
          size="small"
          items={[
            { key: 'status', label: '执行状态' },
            { key: 'history', label: '执行记录' },
          ]}
        />
      </div>

      <div className={styles.discussionBody}>
        <div className={styles.messageList}>
          {/* User Message */}
          <div className={`${styles.messageItem} ${styles.userMessage}`}>
            <div className={styles.messageContentWrapper}>
              <div className={styles.messageInfo}>Human · 2026-03-11 09:35</div>
              <div className={styles.messageBubble}>请你创建3个程序员</div>
            </div>
            <div className={styles.messageAvatar}>
              <UserOutlined />
            </div>
          </div>

          {/* Bot Message */}
          <div className={`${styles.messageItem} ${styles.botMessage}`}>
            <div className={styles.messageAvatar}>
              <UserOutlined />
            </div>
            <div className={styles.messageContentWrapper}>
              <div className={styles.messageInfo}>CTO · 2026-03-11 09:35</div>
              <div className={`${styles.messageBubble} ${styles.structuredMessage}`}>
                <div className={styles.structuredHeader}>
                  <CheckCircleOutlined style={{ color: '#67C23A' }} />
                  已创建3个程序员代理:
                </div>
                <div className={styles.structuredItem}>1. Coder #1 - dcff9c7f</div>
                <div className={styles.structuredItem}>2. Coder #2 - fbbf8a3b</div>
                <div className={styles.structuredItem}>3. Coder #3 - c996ff04</div>
                <div className={styles.structuredFooter}>他们已准备就绪，可以开始接收开发任务！</div>
              </div>
              <div className={styles.messageActions}>
                <span className={styles.actionBtn}>
                  <LinkOutlined /> 任务管理
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.discussionFooter}>
        <Input
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="请输入"
          suffix={<SendOutlined style={{ color: '#409eff', cursor: 'pointer', fontSize: 18 }} />}
          style={{ borderRadius: 16 }}
        />
      </div>
        </>
      )}
    </div>
  );
}
