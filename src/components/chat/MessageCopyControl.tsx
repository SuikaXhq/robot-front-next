'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './MessageCopyControl.module.css';

type CopyFormat = 'text' | 'markdown';

const convertMarkdownToPlainText = (markdown: string): string => {
  let plainText = markdown.replace(/\r\n/g, '\n');
  const codeBlocks: string[] = [];
  plainText = plainText.replace(/```[\w-]*\n([\s\S]*?)```/g, (_match, code: string) => {
    const placeholder = `@@CODEBLOCK${codeBlocks.length}@@`;
    codeBlocks.push(code.replace(/\n$/, ''));
    return placeholder;
  });
  plainText = plainText.replace(/`([^`]+)`/g, '$1');
  plainText = plainText.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1');
  plainText = plainText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
  plainText = plainText.replace(/^>\s?/gm, '');
  plainText = plainText.replace(/^#{1,6}\s+/gm, '');
  plainText = plainText.replace(/^[-*+]\s+/gm, '');
  plainText = plainText.replace(/^\d+\.\s+/gm, '');
  plainText = plainText.replace(/(\*\*|__)(.*?)\1/g, '$2');
  plainText = plainText.replace(/(\*|_)(.*?)\1/g, '$2');
  plainText = plainText.replace(/~~(.*?)~~/g, '$1');
  plainText = plainText.replace(/<\/?[^>]+(>|$)/g, '');
  plainText = plainText.replace(/\n{3,}/g, '\n\n');
  plainText = plainText.replace(/@@CODEBLOCK(\d+)@@/g, (_match, index: string) => codeBlocks[Number(index)] ?? '');
  return plainText.trim();
};

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

interface MessageCopyControlProps {
  content: string;
  messageType: 'user' | 'assistant';
}

export default function MessageCopyControl({ content, messageType }: MessageCopyControlProps) {
  const canSelectCopyFormat = messageType === 'assistant';
  const defaultFormat: CopyFormat = canSelectCopyFormat ? 'markdown' : 'text';
  const [selectedFormat, setSelectedFormat] = useState<CopyFormat>(defaultFormat);
  const [copied, setCopied] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copyPayload = useMemo(() => {
    if (selectedFormat === 'markdown') return content;
    return convertMarkdownToPlainText(content);
  }, [content, selectedFormat]);

  useEffect(() => {
    setSelectedFormat(defaultFormat);
    setIsDropdownOpen(false);
  }, [defaultFormat]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!isDropdownOpen) return;
      const target = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsDropdownOpen(false);
      }
    };
    window.addEventListener('mousedown', closeOnOutsideClick);
    return () => window.removeEventListener('mousedown', closeOnOutsideClick);
  }, [isDropdownOpen]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopyClick = async () => {
    if (!copyPayload.trim()) return;
    const didCopy = await copyToClipboard(copyPayload);
    if (!didCopy) return;
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleFormatChange = (format: CopyFormat) => {
    setSelectedFormat(format);
    setIsDropdownOpen(false);
  };

  const toneClass = messageType === 'user' ? styles.userTone : styles.assistantTone;
  const selectedFormatTag = selectedFormat === 'markdown' ? 'MD' : 'TXT';

  return (
    <div ref={dropdownRef} className={styles.root}>
      <button
        type="button"
        onClick={handleCopyClick}
        title={copied ? 'Copied' : 'Copy'}
        aria-label={copied ? 'Copied' : 'Copy'}
        className={`${styles.copyButton} ${toneClass}`}
      >
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        )}
        <span className={styles.formatTag}>{selectedFormatTag}</span>
      </button>

      {canSelectCopyFormat && (
        <>
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className={`${styles.dropdownToggle} ${toneClass}`}
            aria-label="Select copy format"
            title="Select copy format"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
              <path d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isDropdownOpen && (
            <div className={styles.dropdownMenu}>
              <button
                type="button"
                onClick={() => handleFormatChange('markdown')}
                className={`${styles.dropdownItem} ${selectedFormat === 'markdown' ? styles.dropdownItemSelected : ''}`}
              >
                Copy as markdown
              </button>
              <button
                type="button"
                onClick={() => handleFormatChange('text')}
                className={`${styles.dropdownItem} ${selectedFormat === 'text' ? styles.dropdownItemSelected : ''}`}
              >
                Copy as text
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
