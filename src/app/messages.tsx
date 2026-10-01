import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { messageService } from '@/features/messages/messages_dependencies';
import { MessagesScreen } from '@/features/messages/presentation/messages_screen';
import { useAccount } from '@/features/profile/profile_store';

export default function MessagesRoute() {
  const account = useAccount();
  const { side, notice } = useLocalSearchParams<{ side?: string; notice?: string }>();
  if (!account.signedIn) return <Redirect href={{ pathname: '/login', params: { returnTo: '/messages' } }} />;
  return (
    <MessagesScreen
      key={side === 'selling' ? 'selling' : 'buying'}
      initialSide={side === 'selling' ? 'selling' : 'buying'}
      service={messageService}
      notice={notice === 'sample-seller' ? 'This sample seller has no messaging account. Use New message to contact a registered user.' : notice === 'chat-error' ? 'Unable to open that conversation. Please choose the user again.' : undefined}
      onOpenConversation={(conversation) => router.push({ pathname: '/messages/[id]', params: { id: conversation.id } })}
    />
  );
}
