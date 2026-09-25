import { router } from 'expo-router';
import { Alert } from 'react-native';

import { messageService } from '@/features/messages/messages_dependencies';
import { MessagesScreen } from '@/features/messages/presentation/messages_screen';

export default function MessagesRoute() {
  return (
    <MessagesScreen
      service={messageService}
      onHome={() => router.replace('/home')}
      onOpenConversation={(conversation) => Alert.alert(
        conversation.participant,
        'Conversation details are not available yet.',
      )}
    />
  );
}
