'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { SKILLS_PLATFORM_URL, type SkillPayload } from '@/config/skills';

export default function SkillsPage() {
  const router = useRouter();

  const handleUseSkill = useCallback((skill: SkillPayload) => {
    const params = new URLSearchParams();
    params.set('skillId', skill.id);
    params.set('skillName', skill.name);
    if (skill.prompt) params.set('skillPrompt', skill.prompt);
    if (skill.meta) {
      try {
        params.set('skillMeta', JSON.stringify(skill.meta));
      } catch {
        // ignore serialization error
      }
    }
    router.push(`/chat?${params.toString()}`);
  }, [router]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      // 安全建议：对接完成后建议校验 event.origin
      // if (SKILLS_PLATFORM_URL && event.origin !== new URL(SKILLS_PLATFORM_URL).origin) return;
      if (!SKILLS_PLATFORM_URL) return;

      if (event.data?.type === 'USE_SKILL') {
        const payload = event.data?.skill as SkillPayload | undefined;
        if (payload) {
          handleUseSkill(payload);
        }
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [handleUseSkill]);

  if (!SKILLS_PLATFORM_URL) {
    return (
      <MainLayout fullWidth>
        <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
          <h2>Skills 平台未配置</h2>
          <p>请在 src/config/skills.ts 中设置 SKILLS_PLATFORM_URL</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout fullWidth>
      <iframe
        src={SKILLS_PLATFORM_URL}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="Skills Platform"
      />
    </MainLayout>
  );
}
