'use client';

import { useState, useEffect } from 'react';
import styles from './AgentPanel.module.css';
import {
  ExpandOutlined,
  CaretRightOutlined,
  ThunderboltOutlined,
  CopyOutlined,
  DesktopOutlined,
  ReloadOutlined,
  UpOutlined,
  DownOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import { Button } from 'antd';
import { FileSystemPanel, FilePreviewModal } from './fileSystem';
import { useFileSystem } from '@/contexts/FileSystemContext';

interface AgentPanelProps {
  title?: string;
}

const tabs = [
  { label: 'ROBOT', name: 'robot' },
  { label: '行为序列', name: 'action_sequence' },
  { label: '脚本', name: 'script' },
  { label: '结果', name: 'result' },
  { label: '终端', name: 'terminal' },
  { label: 'PLAN', name: 'plan' },
  { label: '文件系统', name: 'filesystem' },
];

const codeContent = `{
  "description": "user",
  "action": "点击",
  "argument": "点击"
}`;

export default function AgentPanel({ title }: AgentPanelProps) {
  const [activeTab, setActiveTab] = useState('robot');
  const [viewMode, setViewMode] = useState<'form' | 'code'>('code');
  const [isTabsExpanded, setIsTabsExpanded] = useState(false);
  const [isPanelFullscreen, setIsPanelFullscreen] = useState(false);
  const { focusRequested, clearFocusRequest } = useFileSystem();

  // 当收到聚焦请求时，切换到文件系统tab
  useEffect(() => {
    if (focusRequested) {
      setActiveTab('filesystem');
      clearFocusRequest();
    }
  }, [focusRequested, clearFocusRequest]);

  const codeLines = codeContent.split('\n');

  return (
    <div className={`${styles.agentPanelCard} ${isPanelFullscreen ? styles.isFullscreen : ''}`}>
      <div className={styles.panelHeader}>
        {title && <div className={styles.agentTitle}>{title}</div>}
        <div className={`${styles.independentTabsWrapper} ${isTabsExpanded ? styles.isExpanded : ''}`}>
          <div className={styles.independentTabs}>
            {tabs.map((tab) => (
              <span
                key={tab.name}
                className={`${styles.tabBtn} ${activeTab === tab.name ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab(tab.name)}
              >
                {tab.label}
              </span>
            ))}
          </div>
          <span className={styles.tabDropdownBtn} onClick={() => setIsTabsExpanded(!isTabsExpanded)}>
            {isTabsExpanded ? <UpOutlined /> : <DownOutlined />}
          </span>
        </div>
        <div className={styles.headerActions}>
          <ExpandOutlined
            className={styles.actionIcon}
            onClick={() => setIsPanelFullscreen(!isPanelFullscreen)}
          />
        </div>
      </div>

      <div className={styles.panelBody}>
        {/* ROBOT TAB */}
        {activeTab === 'robot' && (
          <div className={styles.robotView}>
            <div className={styles.vncWrapper}>
              {isPanelFullscreen && (
                <div className={styles.vncHeader}>
                  <div className={styles.vncTitle}>操作桌面</div>
                  <div className={styles.vncActions}>
                    <Button size="small" icon={<CopyOutlined />} className={styles.vncBtn} />
                    <Button size="small" icon={<DesktopOutlined />} className={styles.vncBtn} />
                    <Button size="small" icon={<ReloadOutlined />} className={styles.vncBtn} />
                  </div>
                </div>
              )}
              <div className={styles.vncBody}>
                <div className={styles.vncPlaceholder}>
                  <p>NoVNC Virtual Desktop Placeholder</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SEQUENCE TAB */}
        {activeTab === 'action_sequence' && (
          <div className={styles.sequenceView}>
            <div className={styles.panelToolbar}>
              <div className={styles.segmentedControl}>
                <span className={`${styles.segTab} ${viewMode === 'form' ? styles.segTabActive : ''}`} onClick={() => setViewMode('form')}>表单</span>
                <span className={`${styles.segTab} ${viewMode === 'code' ? styles.segTabActive : ''}`} onClick={() => setViewMode('code')}>代码</span>
              </div>
              <div className={styles.actions}>
                <Button type="primary" icon={<CaretRightOutlined />}>脚本执行</Button>
                <Button icon={<ThunderboltOutlined />}>智能执行</Button>
              </div>
            </div>
            <div className={styles.codeContainer}>
              <div className={styles.mockEditor}>
                <div className={styles.lineNumbers}>
                  {codeLines.map((_, i) => <div key={i} className={styles.lineNum}>{i + 1}</div>)}
                </div>
                <div className={styles.editorContent}>
                  <pre><code>{codeContent}</code></pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCRIPT TAB */}
        {activeTab === 'script' && (
          <div className={styles.sequenceView}>
            <div className={styles.panelToolbar}>
              <h4 style={{ margin: 0, fontWeight: 500, fontSize: 14 }}>脚本代码</h4>
              <Button type="primary" size="small" icon={<CaretRightOutlined />}>运行代码</Button>
            </div>
            <div className={styles.codeContainer}>
              <div className={styles.mockEditor}>
                <div className={styles.lineNumbers}>
                  {[1, 2, 3].map(i => <div key={i} className={styles.lineNum}>{i}</div>)}
                </div>
                <div className={styles.editorContent}>
                  <pre style={{ color: '#409EFF' }}><code>{`import nanobot\nrobot = nanobot.connect("localhost")\nrobot.execute_action("click", "login_btn")`}</code></pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RESULT TAB */}
        {activeTab === 'result' && (
          <div className={styles.sequenceView}>
            <div className={styles.codeContainer} style={{ backgroundColor: '#fdfdfd' }}>
              <div className={styles.mockEditor}>
                <div className={styles.editorContent} style={{ color: '#67C23A' }}>
                  <pre><code>{`{
  "status": "success",
  "execution_time": "1.2s",
  "data": {
    "elements_found": 5,
    "current_url": "https://example.com/dashboard"
  }
}`}</code></pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TERMINAL TAB */}
        {activeTab === 'terminal' && (
          <div className={styles.sequenceView}>
            <div className={styles.terminalShell}>
              <div className={styles.terminalHeader}>
                <span className={`${styles.termDot} ${styles.red}`} />
                <span className={`${styles.termDot} ${styles.yellow}`} />
                <span className={`${styles.termDot} ${styles.green}`} />
                <span className={styles.terminalTitle}>bash - root@headless: ~</span>
              </div>
              <div className={styles.terminalBody}>
                <p><span className={styles.prompt}>root@headless:~#</span> npm run start</p>
                <p className={styles.logInfo}>[INFO] Server started on port 3000</p>
                <p className={styles.logInfo}>[INFO] Connected to robot websocket</p>
                <p><span className={styles.prompt}>root@headless:~#</span> <span className={styles.cursor}>_</span></p>
              </div>
            </div>
          </div>
        )}

        {/* PLAN TAB */}
        {activeTab === 'plan' && (
          <div className={styles.sequenceView}>
            <div style={{ padding: 20, color: '#909399', textAlign: 'center' }}>
              Plan 功能开发中...
            </div>
          </div>
        )}

        {/* FILE SYSTEM TAB */}
        {activeTab === 'filesystem' && (
          <div className={styles.fileSystemView}>
            <FileSystemPanel />
          </div>
        )}
      </div>

      {/* File Preview Modal */}
      <FilePreviewModal />
    </div>
  );
}
