import { router } from 'expo-router';

import { messageService } from '@/features/messages/messages_dependencies';
import { MessagesScreen } from '@/features/messages/presentation/messages_screen';

export default function MessagesRoute() {
  return (
    <MessagesScreen
      service={messageService}
      onOpenConversation={(conversation) => router.push({ pathname: '/messages/[id]', params: { id: conversation.id } })}
    />
  );
}
