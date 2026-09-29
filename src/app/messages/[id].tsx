import { router, useLocalSearchParams } from 'expo-router';

import { messageService } from '@/features/messages/messages_dependencies';
import { ConversationScreen } from '@/features/messages/presentation/conversation_screen';

export default function ConversationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversation = messageService.get(id);

  return (
    <ConversationScreen
      conversation={conversation}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/messages');
      }}
    />
  );
}
