'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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

const navItems = [
  { icon: <DesktopOutlined />, label: '首页', href: '/' },
  { icon: <AppstoreOutlined />, label: '应用广场', href: '#' },
  { icon: <ExperimentOutlined />, label: '实验室', href: '/chat' },
  { icon: <RobotOutlined />, label: '模型中心', href: '#' },
  { icon: <ToolOutlined />, label: '技能平台', href: '/skills' },
  { icon: <DatabaseOutlined />, label: '数据集货架', href: '#' },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <div className={styles.navbar}>
      <div className={styles.logoArea}>
        <div className={styles.logoIcon} />
        <span className={styles.logoText}>
          云上 OpenLab | <strong>AI 集成平台</strong>
        </span>
      </div>

      <div className={styles.navLinks}>
        {navItems.map((item, i) => {
          const isActive =
            pathname === item.href || (item.href !== '#' && pathname.startsWith(item.href));
          return item.href === '#' ? (
            <span
              key={i}
              className={`${styles.navBtn} ${isActive ? styles.activeBtn : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </span>
          ) : (
            <Link
              key={i}
              href={item.href}
              className={`${styles.navBtn} ${isActive ? styles.activeBtn : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
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
