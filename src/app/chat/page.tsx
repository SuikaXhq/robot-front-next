'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import ChatArea from '@/components/ChatArea';
import type { SkillPayload } from '@/config/skills';

function ChatPageInner() {
  const searchParams = useSearchParams();

  const initialSkill: SkillPayload | undefined =
    searchParams.get('skillId')
      ? {
          id: searchParams.get('skillId')!,
          name: searchParams.get('skillName') || '',
          prompt: searchParams.get('skillPrompt') || undefined,
          meta: (() => {
            const raw = searchParams.get('skillMeta');
            if (!raw) return undefined;
            try {
              return JSON.parse(raw) as Record<string, unknown>;
            } catch {
              return undefined;
            }
          })(),
        }
      : undefined;

  return (
    <MainLayout>
      {(toggleSidebar) => (
        <ChatArea
          onToggleSidebar={toggleSidebar}
          initialSkill={initialSkill}
        />
      )}
    </MainLayout>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <MainLayout>
        <div style={{ padding: 40, textAlign: 'center' }}>加载中...</div>
      </MainLayout>
    }>
      <ChatPageInner />
    </Suspense>
  );
}
