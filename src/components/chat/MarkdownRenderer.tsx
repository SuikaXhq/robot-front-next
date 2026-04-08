'use client';

import React, { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './MarkdownRenderer.module.css';
import FileLink, { detectFilePaths } from '../fileSystem/FileLink';

interface MarkdownRendererProps {
  content: string;
  /** 是否自动检测并高亮文件路径 */
  highlightFilePaths?: boolean;
}

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

/**
 * 文件路径文本组件 - 自动检测并渲染文件路径
 */
const FilePathText: React.FC<{ text: string }> = ({ text }) => {
  const paths = detectFilePaths(text);

  if (paths.length === 0) {
    return <>{text}</>;
  }

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const { path, start, end } of paths) {
    // 添加路径前的文本
    if (start > lastIndex) {
      elements.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex, start)}</span>);
    }

    // 添加文件链接
    elements.push(
      <FileLink key={`path-${start}`} path={path} inline>
        {path}
      </FileLink>
    );

    lastIndex = end;
  }

  // 添加剩余的文本
  if (lastIndex < text.length) {
    elements.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
  }

  return <>{elements}</>;
};

const CodeBlock = ({ inline, className, children, ...props }: any) => {
  const [copied, setCopied] = useState(false);
  const raw = Array.isArray(children) ? children.join('') : String(children ?? '');
  const looksMultiline = /[\r\n]/.test(raw);
  const inlineDetected = inline || (props?.node && props.node.type === 'inlineCode');
  const shouldInline = inlineDetected || !looksMultiline;

  if (shouldInline) {
    return (
      <code className={styles.inlineCode} {...props}>
        {children}
      </code>
    );
  }

  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : 'text';

  const handleCopy = async () => {
    const didCopy = await copyToClipboard(raw.replace(/\n$/, ''));
    if (!didCopy) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.codeBlock}>
      {language && language !== 'text' && (
        <div className={styles.codeLangBar}>
          <span className={styles.codeLangName}>{language}</span>
          <button
            type="button"
            onClick={handleCopy}
            className={styles.copyCodeBtn}
            title={copied ? 'Copied!' : 'Copy code'}
            aria-label={copied ? 'Copied!' : 'Copy code'}
          >
            {copied ? (
              <>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Copied</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
                </svg>
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      )}
      <pre className={styles.codePre}>
        <code className={match ? `language-${match[1]}` : ''} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
};

export const MarkdownRenderer = memo(function MarkdownRenderer({ content, highlightFilePaths = true }: MarkdownRendererProps) {
  return (
    <div className={`markdown-body ${styles.markdownContainer}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeBlock,
          text(props: { value?: string; children?: React.ReactNode }) {
            const value = props.value || String(props.children || '');
            if (!highlightFilePaths) return value;
            return <FilePathText text={value} />;
          },
          p({ children }) {
            return <p className={styles.paragraph}>{children}</p>;
          },
          ul({ children }) {
            return <ul className={styles.list}>{children}</ul>;
          },
          ol({ children }) {
            return <ol className={styles.list}>{children}</ol>;
          },
          li({ children }) {
            return <li className={styles.listItem}>{children}</li>;
          },
          a({ children, href }) {
            return (
              <a href={href} className={styles.link} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>{children}</table>
              </div>
            );
          },
          th({ children }) {
            return <th className={styles.tableBlock}>{children}</th>;
          },
          td({ children }) {
            return <td className={styles.tableBlock}>{children}</td>;
          },
          blockquote({ children }) {
            return (
              <blockquote className={styles.blockquote}>
                {children}
              </blockquote>
            );
          },
          h1({ children }) {
            return <h1 className={styles.heading}>{children}</h1>;
          },
          h2({ children }) {
            return <h2 className={`${styles.heading} ${styles.h2}`}>{children}</h2>;
          },
          h3({ children }) {
            return <h3 className={`${styles.heading} ${styles.h3}`}>{children}</h3>;
          },
          h4({ children }) {
            return <h4 className={`${styles.heading} ${styles.h4}`}>{children}</h4>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
