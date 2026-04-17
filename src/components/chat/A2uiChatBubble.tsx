'use client';

import React, { useEffect, useState } from 'react';
import { MessageProcessor, type SurfaceModel } from '@a2ui/web_core/v0_9';
import { A2uiSurface, basicCatalog, MarkdownContext, type ReactComponentImplementation } from '@a2ui/react/v0_9';
import { renderMarkdown } from '@a2ui/markdown-it';

export interface A2uiChatBubbleProps {
  messages: unknown[];
}

export default function A2uiChatBubble({ messages }: A2uiChatBubbleProps) {
  const [surface, setSurface] = useState<SurfaceModel<ReactComponentImplementation> | null>(null);

  useEffect(() => {
    const processor = new MessageProcessor([basicCatalog]);

    try {
      processor.processMessages(messages as any);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[A2uiChatBubble] Failed to process messages:', err);
    }

    const firstSurface = processor.model.surfacesMap.values().next().value as
      | SurfaceModel<ReactComponentImplementation>
      | undefined;
    if (firstSurface) {
      setSurface(firstSurface);
    }

    const unsub = processor.model.onSurfaceCreated.subscribe((s) => {
      setSurface(s);
    });

    return () => {
      unsub.unsubscribe();
      processor.model.dispose();
    };
  }, [messages]);

  if (!surface) {
    return <div style={{ padding: 12, color: '#909399' }}>Loading A2UI...</div>;
  }

  return (
    <MarkdownContext.Provider value={renderMarkdown}>
      <div className="a2ui-surface" style={{ maxWidth: '100%' }}>
        <A2uiSurface surface={surface} />
      </div>
    </MarkdownContext.Provider>
  );
}
