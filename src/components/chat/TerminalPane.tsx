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
}

const TerminalPane = forwardRef<TerminalPaneRef, TerminalPaneProps>(({ onData }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const onDataRef = useRef(onData);

  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

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
          background: '#ffffff',
          foreground: '#1f2328',
          cursor: '#0969da',
          selectionBackground: '#b4d5ff',
        },
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerRef.current);
      fitAddon.fit();

      term.onData((data: string) => {
        onDataRef.current?.(data);
      });

      termRef.current = term;
      fitAddonRef.current = fitAddon;

      const handleResize = () => {
        try {
          fitAddon.fit();
        } catch {
          // ignore
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    });

    return () => {
      disposed = true;
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
        height: '100%',
        padding: 12,
        background: '#ffffff',
        overflow: 'hidden',
      }}
    />
  );
});

TerminalPane.displayName = 'TerminalPane';
export default TerminalPane;
