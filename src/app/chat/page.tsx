'use client';

import MainLayout from '@/components/layout/MainLayout';
import ChatArea from '@/components/ChatArea';
import { ChatSessionProvider } from '@/contexts/ChatSessionContext';

export default function ChatPage() {
  return (
    <ChatSessionProvider>
      <MainLayout>
        {(toggleSidebar) => <ChatArea onToggleSidebar={toggleSidebar} />}
      </MainLayout>
    </ChatSessionProvider>
  );
}
