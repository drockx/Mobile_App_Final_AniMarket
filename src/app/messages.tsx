import { router, useLocalSearchParams } from 'expo-router';

import { messageService } from '@/features/messages/messages_dependencies';
import { MessagesScreen } from '@/features/messages/presentation/messages_screen';

export default function MessagesRoute() {
  const { side } = useLocalSearchParams<{ side?: string }>();
  return (
    <MessagesScreen
      key={side === 'selling' ? 'selling' : 'buying'}
      initialSide={side === 'selling' ? 'selling' : 'buying'}
      service={messageService}
      onOpenConversation={(conversation) => router.push({ pathname: '/messages/[id]', params: { id: conversation.id } })}
    />
  );
}
