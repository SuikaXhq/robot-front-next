'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { ChatMessage } from '@/components/chat/types';

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
  createdAt: number;
}

interface ChatSessionContextValue {
  sessions: ChatSession[];
  currentSessionId: string | null;
  createSession: () => string;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  updateSessionMessages: (id: string, messages: ChatMessage[]) => void;
  clearCurrentSession: () => void;
  currentSession: ChatSession | null;
}

const ChatSessionContext = createContext<ChatSessionContextValue | null>(null);

const STORAGE_KEY = 'robot-chat-sessions-v1';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getDefaultTitle(): string {
  return '新对话';
}

function stripBase64Data(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => {
    if (!m.attachments && !m.images) return m;
    const next: ChatMessage = { ...m };
    if (next.attachments) {
      next.attachments = next.attachments.map((att) => {
        if (att.data) {
          const { data, ...rest } = att;
          return rest;
        }
        return att;
      });
    }
    if (next.images) {
      next.images = next.images.map((img) => {
        if (img.data) {
          const { data, ...rest } = img as any;
          return rest;
        }
        return img;
      });
    }
    return next;
  });
}

export function ChatSessionProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatSession[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const seen = new Set<string>();
          const deduped = parsed.filter((s) => {
            if (seen.has(s.id)) return false;
            seen.add(s.id);
            return true;
          });
          setSessions(deduped);
          setCurrentSessionId(deduped[0].id);
        } else {
          const id = generateId();
          const initial: ChatSession = {
            id,
            title: getDefaultTitle(),
            messages: [],
            updatedAt: Date.now(),
            createdAt: Date.now(),
          };
          setSessions([initial]);
          setCurrentSessionId(id);
        }
      } else {
        const id = generateId();
        const initial: ChatSession = {
          id,
          title: getDefaultTitle(),
          messages: [],
          updatedAt: Date.now(),
          createdAt: Date.now(),
        };
        setSessions([initial]);
        setCurrentSessionId(id);
      }
    } catch {
      const id = generateId();
      setSessions([{ id, title: getDefaultTitle(), messages: [], updatedAt: Date.now(), createdAt: Date.now() }]);
      setCurrentSessionId(id);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch {
      // ignore quota errors
    }
  }, [sessions, loaded]);

  const createSession = useCallback((): string => {
    const id = generateId();
    const session: ChatSession = {
      id,
      title: getDefaultTitle(),
      messages: [],
      updatedAt: Date.now(),
      createdAt: Date.now(),
    };
    setSessions((prev) => [session, ...prev]);
    setCurrentSessionId(id);
    return id;
  }, []);

  const switchSession = useCallback((id: string) => {
    setCurrentSessionId(id);
  }, []);

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (currentSessionId === id) {
          if (next.length > 0) {
            setCurrentSessionId(next[0].id);
          } else {
            const newId = generateId();
            const session: ChatSession = {
              id: newId,
              title: getDefaultTitle(),
              messages: [],
              updatedAt: Date.now(),
              createdAt: Date.now(),
            };
            setCurrentSessionId(newId);
            return [session];
          }
        }
        return next;
      });
    },
    [currentSessionId]
  );

  const updateSessionMessages = useCallback((id: string, messages: ChatMessage[]) => {
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      const next = [...prev];
      const session = { ...next[idx] };
      session.messages = messages;
      session.updatedAt = Date.now();

      // auto-title on first user message
      if (session.title === getDefaultTitle()) {
        const firstUser = messages.find((m) => m.type === 'user' && m.content?.trim());
        if (firstUser?.content) {
          session.title = firstUser.content.trim().slice(0, 30) || getDefaultTitle();
        }
      }

      next[idx] = session;
      // move to top
      next.splice(idx, 1);
      next.unshift(session);
      return next;
    });
  }, []);

  const clearCurrentSession = useCallback(() => {
    if (!currentSessionId) return;
    updateSessionMessages(currentSessionId, []);
  }, [currentSessionId, updateSessionMessages]);

  const currentSession = useMemo(() => {
    return sessions.find((s) => s.id === currentSessionId) || null;
  }, [sessions, currentSessionId]);

  // One-time cleanup: dedupe sessions in memory after loading from localStorage
  useEffect(() => {
    if (!loaded) return;
    const ids = sessions.map((s) => s.id);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      const seen = new Set<string>();
      const deduped = sessions.filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });
      setSessions(deduped);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const dedupedSessions = useMemo(() => {
    const seen = new Set<string>();
    return sessions.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [sessions]);

  const value = useMemo(
    () => ({
      sessions: dedupedSessions,
      currentSessionId,
      createSession,
      switchSession,
      deleteSession,
      updateSessionMessages,
      clearCurrentSession,
      currentSession,
    }),
    [dedupedSessions, currentSessionId, createSession, switchSession, deleteSession, updateSessionMessages, clearCurrentSession, currentSession]
  );

  return <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>;
}

export function useChatSessions(): ChatSessionContextValue {
  const ctx = useContext(ChatSessionContext);
  if (!ctx) {
    throw new Error('useChatSessions must be used within ChatSessionProvider');
  }
  return ctx;
}
