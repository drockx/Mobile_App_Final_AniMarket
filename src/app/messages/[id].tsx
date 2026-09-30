import { useLocalSearchParams } from 'expo-router';

import { messageService } from '@/features/messages/messages_dependencies';
import { ConversationScreen } from '@/features/messages/presentation/conversation_screen';
import { backOrReplace } from '@/navigation/app_navigation';

export default function ConversationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversation = messageService.get(id);

  return (
    <ConversationScreen
      conversation={conversation}
      onBack={() => backOrReplace('/messages')}
    />
  );
}
