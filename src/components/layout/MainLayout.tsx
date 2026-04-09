'use client';

import { useState, useRef, useCallback } from 'react';
import styles from './MainLayout.module.css';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/Sidebar';
import RightPanel from '@/components/RightPanel';
import { FileSystemProvider } from '@/contexts/FileSystemContext';

interface MainLayoutProps {
  children: React.ReactNode | ((toggleSidebar: () => void, isSidebarOpen: boolean) => React.ReactNode);
  /** 隐藏左侧边栏与右侧面板，让主内容占满整个下部区域 */
  fullWidth?: boolean;
}

export default function MainLayout({ children, fullWidth = false }: MainLayoutProps) {
  const [isSidebarOpen, setSidebarOpen] = useState(!fullWidth);
  const [isRightPanelOpen, setRightPanelOpen] = useState(!fullWidth);
  const [isFullscreen, setFullscreen] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(480);
  const [isDragging, setIsDragging] = useState(false);
  const lastWidthRef = useRef(480);

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const toggleFullscreen = useCallback(() => setFullscreen((v) => !v), []);

  const collapseRightPanel = useCallback(() => {
    if (isRightPanelOpen) {
      lastWidthRef.current = rightPanelWidth;
      setRightPanelOpen(false);
    }
  }, [isRightPanelOpen, rightPanelWidth]);

  const expandRightPanel = useCallback(() => {
    if (!isRightPanelOpen) {
      setRightPanelWidth(lastWidthRef.current);
      setRightPanelOpen(true);
    }
  }, [isRightPanelOpen]);

  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      if (!isRightPanelOpen) return;
      setIsDragging(true);
      const startX = e.clientX;
      const startWidth = rightPanelWidth;

      const onDrag = (ev: MouseEvent) => {
        const deltaX = startX - ev.clientX;
        let newWidth = startWidth + deltaX;
        if (newWidth < 300) newWidth = 300;
        if (newWidth > 1000) newWidth = 1000;
        setRightPanelWidth(newWidth);
      };

      const stopDrag = () => {
        setIsDragging(false);
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', stopDrag);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [isRightPanelOpen, rightPanelWidth]
  );

  const renderedChildren = typeof children === 'function'
    ? children(toggleSidebar, isSidebarOpen)
    : children;

  return (
    <FileSystemProvider>
      <div className={styles.layoutContainer}>
        <header className={styles.appHeader}>
          <Navbar />
        </header>

        <div className={styles.subHeader}>
          <div className={styles.breadcrumb}>
            <span className={styles.grayText}>Robot</span>
            <span className={styles.separator}>/</span>
            <span className={styles.boldText}>新建Robot</span>
          </div>
          <button className={styles.saveBtn}>保存</button>
        </div>

        <div className={`${styles.mainContent} ${isFullscreen ? styles.isFullscreenMode : ''}`}>
          {!fullWidth && (
            <aside
              className={`${styles.sidebarContainer} ${!isSidebarOpen || isFullscreen ? styles.sidebarClosed : ''}`}
              style={{ width: isSidebarOpen && !isFullscreen ? 260 : 0 }}
            >
              {isSidebarOpen && <Sidebar />}
            </aside>
          )}

          <main className={styles.chatContainer}>
            {renderedChildren}
          </main>

          {!fullWidth && (
            <>
              <div className={styles.resizeHandle} onMouseDown={startDrag}>
                <div className={styles.handleLine} />
                <div className={styles.handleArrows}>
                  <span className={styles.arrowLeft} onClick={(e) => { e.stopPropagation(); expandRightPanel(); }} title="展开右侧面板">◀</span>
                  <span className={styles.arrowRight} onClick={(e) => { e.stopPropagation(); collapseRightPanel(); }} title="收起右侧面板">▶</span>
                </div>
              </div>

              <div
                className={`${styles.panelSpacer} ${!isRightPanelOpen ? styles.panelClosed : ''} ${isDragging ? styles.isDragging : ''}`}
                style={{ width: isRightPanelOpen ? rightPanelWidth : 0 }}
              />

              <aside
                className={`${styles.absolutePanel} ${styles.panelContainer} ${!isRightPanelOpen && !isFullscreen ? styles.panelClosed : ''} ${isDragging ? styles.isDragging : ''} ${isFullscreen ? styles.isFullscreen : ''}`}
                style={{ width: isFullscreen ? 'calc(100% - 48px)' : isRightPanelOpen ? rightPanelWidth : 0 }}
              >
                {(isRightPanelOpen || isFullscreen) && <RightPanel />}
              </aside>
            </>
          )}
        </div>
      </div>
    </FileSystemProvider>
  );
}
