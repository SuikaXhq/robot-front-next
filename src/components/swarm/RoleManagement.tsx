'use client';

import styles from './RoleManagement.module.css';
import { UserOutlined, RobotOutlined, DesktopOutlined } from '@ant-design/icons';
import type { Role } from '@/types';

const roles: Role[] = [
  { id: 1, type: 'human', name: '开发团队讨论组', tag: '群组', time: '11:00', description: '已成功创建三个角色：...' },
  { id: 2, type: 'human', name: 'CTO', time: '11:00', description: '我已创建个程序员代理：...', count: 1 },
  { id: 3, type: 'ai', name: 'P2P人类-助手', time: '11:00', description: '已成功创建三个角色：...' },
  { id: 4, type: 'human', name: 'CTO', time: '11:00', description: '是的，我收到了来自...', count: 2 },
  { id: 5, type: 'monitor', name: 'Coder-1', time: '11:00', description: '-' },
  { id: 6, type: 'monitor', name: 'Coder-2', time: '11:00', description: '-' },
];

const iconMap = {
  human: <UserOutlined />,
  ai: <RobotOutlined />,
  monitor: <DesktopOutlined />,
};

export default function RoleManagement() {
  return (
    <div className={styles.roleManagement}>
      <div className={styles.roleHeader}>角色管理</div>
      <div className={styles.roleList}>
        {roles.map((role) => (
          <div key={role.id} className={styles.roleItem}>
            <div className={styles.roleIcon}>{iconMap[role.type]}</div>
            <div className={styles.roleInfo}>
              <div className={styles.roleNameRow}>
                <span className={styles.roleName}>{role.name}</span>
                {role.tag && <span className={styles.roleTag}>{role.tag}</span>}
                <span className={styles.roleTime}>{role.time}</span>
              </div>
              <div className={styles.roleDescRow}>
                <span className={styles.roleDesc}>{role.description}</span>
                {role.count && <span className={styles.roleCount}>{role.count}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
