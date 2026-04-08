import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowUpOutlined, StopOutlined, PaperClipOutlined, CloseOutlined, FileOutlined } from '@ant-design/icons';
import styles from './ChatInput.module.css';
import type { ChatAttachment } from './types';
import type { ChatSession } from '@/contexts/ChatSessionContext';

interface ChatInputProps {
  onSend: (message: string, attachments?: ChatAttachment[]) => void;
  onInterrupt?: () => void;
  onUpload?: (attachments: ChatAttachment[]) => Promise<ChatAttachment[]>;
  disabled?: boolean;
  isProcessing?: boolean;
  placeholder?: string;
  sessions?: ChatSession[];
}

interface ArgSuggestion {
  value: string;
  label: string;
  desc?: string;
}

interface SlashCommandDef {
  name: string;
  desc: string;
  getArgs?: (sessions: ChatSession[]) => ArgSuggestion[];
}

const COMMANDS: SlashCommandDef[] = [
  { name: '/clear', desc: '清空当前对话' },
  {
    name: '/resume',
    desc: '恢复历史会话',
    getArgs: (sessions) =>
      sessions.map((s) => ({
        value: s.id,
        label: s.title,
        desc: s.id.slice(0, 20) + '...',
      })),
  },
  {
    name: '/model',
    desc: '切换模型',
    getArgs: () => [
      { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
      { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
    ],
  },
  { name: '/save', desc: '保存对话为 JSON' },
  { name: '/debug', desc: '切换桥接调试模式' },
  { name: '/help', desc: '查看支持的命令' },
];

function formatFileSize(bytes?: number): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ChatInput(props: ChatInputProps) {
  const {
    onSend,
    onInterrupt,
    onUpload,
    disabled = false,
    isProcessing = false,
    placeholder = "Send a message...",
    sessions = [],
  } = props;

  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const trimmedStart = value.trimStart();
  const showCommands = trimmedStart.startsWith('/');

  const parts = trimmedStart.split(/\s+/);
  const cmdPart = parts[0].toLowerCase();
  const argQuery = parts.slice(1).join(' ').toLowerCase();
  const matchedCmd = COMMANDS.find((c) => c.name === cmdPart);

  type Suggestion = {
    type: 'cmd' | 'arg';
    name: string;
    desc: string;
    value?: string;
  };

  let suggestions: Suggestion[] = [];
  if (!matchedCmd || (parts.length === 1 && !trimmedStart.includes(' '))) {
    suggestions = COMMANDS.filter((c) => c.name.toLowerCase().includes(cmdPart)).map((c) => ({
      type: 'cmd',
      name: c.name,
      desc: c.desc,
    }));
  } else if (matchedCmd && matchedCmd.getArgs) {
    const args = matchedCmd.getArgs(sessions);
    suggestions = args
      .filter((a) => a.label.toLowerCase().includes(argQuery) || a.value.toLowerCase().includes(argQuery))
      .map((a) => ({
        type: 'arg',
        name: a.label,
        desc: a.desc || '',
        value: a.value,
      }));
  }

  useEffect(() => {
    if (showCommands) {
      setSelectedCommandIndex(0);
    }
  }, [showCommands, cmdPart, argQuery]);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const minHeight = 50;
    const maxHeight = 200;
    textarea.style.height = `${Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight))}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const isImage = file.type.startsWith('image/');
      if (isImage) {
        const reader = new FileReader();
        reader.onload = () => {
          setAttachments((prev) => [
            ...prev,
            {
              type: 'image',
              name: file.name,
              data: String(reader.result || ''),
              size: file.size,
              mimeType: file.type,
            },
          ]);
        };
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          setAttachments((prev) => [
            ...prev,
            {
              type: 'file',
              name: file.name,
              data: String(reader.result || ''),
              size: file.size,
              mimeType: file.type,
            },
          ]);
        };
        reader.readAsDataURL(file);
      }
    });
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    let hasFile = false;
    Array.from(items).forEach((item) => {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          hasFile = true;
          const isImage = file.type.startsWith('image/');
          if (isImage) {
            const reader = new FileReader();
            reader.onload = () => {
              setAttachments((prev) => [
                ...prev,
                {
                  type: 'image',
                  name: file.name || 'pasted-image.png',
                  data: String(reader.result || ''),
                  size: file.size,
                  mimeType: file.type,
                },
              ]);
            };
            reader.readAsDataURL(file);
          } else {
            const reader = new FileReader();
            reader.onload = () => {
              setAttachments((prev) => [
                ...prev,
                {
                  type: 'file',
                  name: file.name || 'pasted-file',
                  data: String(reader.result || ''),
                  size: file.size,
                  mimeType: file.type,
                },
              ]);
            };
            reader.readAsDataURL(file);
          }
        }
      }
    });
    if (hasFile) {
      e.preventDefault();
    }
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = value.trim();
    if ((!trimmed && attachments.length === 0) || disabled || isUploading) return;

    let finalAttachments = attachments;
    if (onUpload && attachments.length > 0) {
      setIsUploading(true);
      try {
        finalAttachments = await onUpload(attachments);
      } catch {
        // on error, still send original attachments
        finalAttachments = attachments;
      } finally {
        setIsUploading(false);
      }
    }

    onSend(trimmed, finalAttachments);
    setValue("");
    setAttachments([]);
  }, [value, attachments, disabled, isUploading, onSend, onUpload]);

  const applySuggestion = useCallback((sugg: Suggestion) => {
    if (sugg.type === 'cmd') {
      setValue(`${sugg.name} `);
    } else {
      const cmdDef = COMMANDS.find((c) => c.name === matchedCmd?.name);
      if (cmdDef && sugg.value) {
        setValue(`${cmdDef.name} ${sugg.value}`);
      }
    }
    textareaRef.current?.focus();
  }, [matchedCmd]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommands && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCommandIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCommandIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const selected = suggestions[selectedCommandIndex];
        if (selected.type === 'cmd') {
          applySuggestion(selected);
        } else {
          const cmdDef = COMMANDS.find((c) => c.name === matchedCmd?.name);
          if (cmdDef && selected.value) {
            const full = `${cmdDef.name} ${selected.value}`;
            onSend(full, []);
            setValue('');
            setAttachments([]);
          }
        }
        return;
      }
      if (e.key === 'Escape') {
        setValue((v) => v.replace(/^\s*\//, ''));
        textareaRef.current?.focus();
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInterrupt = useCallback(() => {
    onInterrupt?.();
  }, [onInterrupt]);

  const canSend = (value.trim().length > 0 || attachments.length > 0) && !disabled && !isUploading;
  const showInterrupt = isProcessing && onInterrupt;

  return (
    <div className={styles.inputContainer}>
      <div className={styles.inputWrapper}>
        {attachments.length > 0 && (
          <div className={styles.attachmentRow}>
            {attachments.map((att, idx) => (
              <div key={`${att.name}-${idx}`} className={styles.attachmentItem}>
                {att.type === 'image' ? (
                  <div className={styles.imageThumbWrapper}>
                    <img src={att.data} alt={att.name} className={styles.imageThumb} />
                    <button
                      type="button"
                      className={styles.removeAttachmentBtn}
                      onClick={() => removeAttachment(idx)}
                      title="Remove"
                    >
                      <CloseOutlined />
                    </button>
                  </div>
                ) : (
                  <div className={styles.fileCard}>
                    <FileOutlined className={styles.fileCardIcon} />
                    <div className={styles.fileCardInfo}>
                      <span className={styles.fileCardName}>{att.name}</span>
                      <span className={styles.fileCardSize}>{formatFileSize(att.size)}</span>
                    </div>
                    <button
                      type="button"
                      className={styles.removeAttachmentBtnInline}
                      onClick={() => removeAttachment(idx)}
                      title="Remove"
                    >
                      <CloseOutlined />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div className={styles.inputRow}>
          {showCommands && suggestions.length > 0 && (
            <div className={styles.commandPopover} role="listbox">
              {suggestions.map((sugg, idx) => (
                <div
                  key={`${sugg.type}-${sugg.name}-${sugg.value || ''}`}
                  className={`${styles.commandItem} ${idx === selectedCommandIndex ? styles.commandItemSelected : ''}`}
                  role="option"
                  aria-selected={idx === selectedCommandIndex}
                  onClick={() => {
                    if (sugg.type === 'cmd') {
                      applySuggestion(sugg);
                    } else {
                      const cmdDef = COMMANDS.find((c) => c.name === matchedCmd?.name);
                      if (cmdDef && sugg.value) {
                        onSend(`${cmdDef.name} ${sugg.value}`, []);
                        setValue('');
                        setAttachments([]);
                      }
                    }
                  }}
                  onMouseEnter={() => setSelectedCommandIndex(idx)}
                >
                  <span className={styles.commandName}>{sugg.type === 'arg' ? `▸ ${sugg.name}` : sugg.name}</span>
                  <span className={styles.commandDesc}>{sugg.desc}</span>
                </div>
              ))}
            </div>
          )}
          {showCommands && suggestions.length === 0 && (
            <div className={styles.commandPopover}>
              <div className={styles.commandItem} style={{ cursor: 'default', opacity: 0.6 }}>
                <span className={styles.commandDesc}>无匹配的命令或参数</span>
              </div>
            </div>
          )}
          <button
            type="button"
            className={styles.attachButton}
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
            disabled={disabled || isUploading}
          >
            <PaperClipOutlined />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              handleFiles(e.target.files);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          />
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
            disabled={disabled || isUploading}
            rows={1}
            style={{ minHeight: '50px' }}
            className={styles.textarea}
          />
          {showInterrupt ? (
            <button
              type="button"
              onClick={handleInterrupt}
              className={`${styles.actionButton} ${styles.interruptButton}`}
              title="Interrupt"
            >
              <StopOutlined />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSend}
              className={`${styles.actionButton} ${styles.sendButton} ${!canSend ? styles.disabled : ''}`}
              title="Send message"
            >
              <ArrowUpOutlined />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
