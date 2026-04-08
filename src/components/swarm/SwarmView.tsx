'use client';

import { useState } from 'react';
import styles from './SwarmView.module.css';
import SwarmCanvas from '@/components/swarm/SwarmCanvas';
import RoleManagement from '@/components/swarm/RoleManagement';
import DiscussionGroup from '@/components/swarm/DiscussionGroup';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';

export default function SwarmView() {
  const [isRoleCollapsed, setIsRoleCollapsed] = useState(false);

  return (
    <div className={styles.swarmView}>
      <div className={styles.swarmTopHalf}>
        <SwarmCanvas />
      </div>
      <div className={styles.swarmBottomHalf}>
        <div
          className={`${styles.roleManagementPanel} ${isRoleCollapsed ? styles.roleCollapsed : ''}`}
        >
          {isRoleCollapsed ? (
            <div className={styles.collapsedRolePanel}>
              <button
                className={styles.collapseToggleBtn}
                onClick={() => setIsRoleCollapsed(false)}
                title="展开角色管理"
              >
                <MenuUnfoldOutlined />
              </button>
            </div>
          ) : (
            <RoleManagement />
          )}
        </div>

        <div className={styles.dividerBar}>
          <button
            className={styles.collapseToggleBtn}
            onClick={() => setIsRoleCollapsed(!isRoleCollapsed)}
            title={isRoleCollapsed ? '展开角色管理' : '收起角色管理'}
          >
            {isRoleCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </button>
        </div>

        <div className={styles.discussionGroupPanel}>
          <DiscussionGroup />
        </div>
      </div>
    </div>
  );
}
