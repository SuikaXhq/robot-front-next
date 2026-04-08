'use client';

import styles from './Navbar.module.css';
import {
  DesktopOutlined,
  AppstoreOutlined,
  ExperimentOutlined,
  RobotOutlined,
  ToolOutlined,
  DatabaseOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { Avatar } from 'antd';

export default function Navbar() {
  const navItems = [
    { icon: <DesktopOutlined />, label: '首页' },
    { icon: <AppstoreOutlined />, label: '应用广场' },
    { icon: <ExperimentOutlined />, label: '实验室', active: true },
    { icon: <RobotOutlined />, label: '模型中心' },
    { icon: <ToolOutlined />, label: '工具' },
    { icon: <DatabaseOutlined />, label: '数据集货架' },
  ];

  return (
    <div className={styles.navbar}>
      <div className={styles.logoArea}>
        <div className={styles.logoIcon} />
        <span className={styles.logoText}>
          云上 OpenLab | <strong>AI 集成平台</strong>
        </span>
      </div>

      <div className={styles.navLinks}>
        {navItems.map((item, i) => (
          <span
            key={i}
            className={`${styles.navBtn} ${item.active ? styles.activeBtn : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </span>
        ))}
      </div>

      <div className={styles.userArea}>
        <Avatar
          size="small"
          src="https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png"
        />
        <span className={styles.username}>Sunny 00123456</span>
        <DownOutlined style={{ fontSize: 10 }} />
      </div>
    </div>
  );
}
