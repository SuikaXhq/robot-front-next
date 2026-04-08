'use client';

import styles from './RightPanel.module.css';
import AgentPanel from './AgentPanel';

export default function RightPanel() {
  return (
    <div className={styles.rightPanel}>
      <AgentPanel />
    </div>
  );
}
