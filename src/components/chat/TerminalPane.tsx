'use client';

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import '@xterm/xterm/css/xterm.css';

export interface TerminalPaneRef {
  write(data: string): void;
  clear(): void;
  resize(): void;
  getSize(): { cols: number; rows: number } | null;
}

interface TerminalPaneProps {
  onData?(data: string): void;
  onReady?(): void;
}

const TerminalPane = forwardRef<TerminalPaneRef, TerminalPaneProps>(({ onData, onReady }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const onDataRef = useRef(onData);
  const onReadyRef = useRef(onReady);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const resizeHandlerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .xterm .xterm-helper-textarea {
        position: absolute !important;
        opacity: 0 !important;
        left: 0 !important;
        top: 0 !important;
        z-index: -10 !important;
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;

    let disposed = false;

    Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
    ]).then(([{ Terminal }, { FitAddon }]) => {
      if (disposed || !containerRef.current) return;

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: 'Consolas, "Courier New", monospace',
        theme: {
          background: '#fafbfc',
          foreground: '#1a1a2e',
          cursor: '#ff2d55',
          selectionBackground: '#ff2d5526',
          black: '#1a1a2e',
          red: '#e71d36',
          green: '#2ec4b6',
          yellow: '#f77f00',
          blue: '#3a86ff',
          magenta: '#8338ec',
          cyan: '#06d6a0',
          white: '#5c677d',
          brightBlack: '#9baacf',
          brightRed: '#ff4d6d',
          brightGreen: '#72efdd',
          brightYellow: '#ff9f1c',
          brightBlue: '#4895ef',
          brightMagenta: '#b5179e',
          brightCyan: '#4cc9f0',
          brightWhite: '#1a1a2e',
        },
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerRef.current);

      term.onData((data: string) => {
        onDataRef.current?.(data);
      });

      termRef.current = term;
      fitAddonRef.current = fitAddon;

      const doFit = () => {
        if (!termRef.current || !fitAddonRef.current || !containerRef.current) return;
        try {
          // 让 xterm 元素跟随容器伸缩，防止 CSS 固定后无法自适应
          if (termRef.current.element) {
            termRef.current.element.style.width = '100%';
            termRef.current.element.style.height = '100%';
          }
          fitAddonRef.current.fit();
          termRef.current.refresh(0, termRef.current.rows - 1);
        } catch {
          // ignore
        }
      };

      const handleResize = () => {
        requestAnimationFrame(() => {
          doFit();
          // 手动触发 window resize，让 xterm 内部 renderer 完成真正的重绘/重排
          window.dispatchEvent(new Event('resize'));
        });
      };

      resizeHandlerRef.current = handleResize;
      window.addEventListener('resize', handleResize);

      const resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(containerRef.current);
      resizeObserverRef.current = resizeObserver;

      // 延迟到下一帧再 fit，确保容器尺寸已稳定
      requestAnimationFrame(() => {
        setTimeout(() => {
          doFit();
          onReadyRef.current?.();
        }, 0);
      });
    });

    return () => {
      disposed = true;
      if (resizeHandlerRef.current) {
        window.removeEventListener('resize', resizeHandlerRef.current);
        resizeHandlerRef.current = null;
      }
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      try {
        termRef.current?.dispose?.();
      } catch {
        // ignore
      }
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    write(data: string) {
      termRef.current?.write?.(data);
    },
    clear() {
      termRef.current?.clear?.();
    },
    resize() {
      try {
        fitAddonRef.current?.fit?.();
      } catch {
        // ignore
      }
    },
    getSize() {
      const term = termRef.current;
      if (!term) return null;
      return { cols: term.cols || 80, rows: term.rows || 24 };
    },
  }));

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        flex: 1,
        padding: 12,
        background: '#fafbfc',
        overflow: 'hidden',
      }}
    />
  );
});

TerminalPane.displayName = 'TerminalPane';
export default TerminalPane;
