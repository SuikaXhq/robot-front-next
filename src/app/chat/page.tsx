'use client';

import MainLayout from '@/components/layout/MainLayout';
import ChatArea from '@/components/ChatArea';

export default function ChatPage() {
  return (
    <MainLayout>
      {(toggleSidebar) => <ChatArea onToggleSidebar={toggleSidebar} />}
    </MainLayout>
  );
}
