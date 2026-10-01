import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import { messageService } from '@/features/messages/messages_dependencies';
import { ConversationScreen } from '@/features/messages/presentation/conversation_screen';
import { backOrReplace } from '@/navigation/app_navigation';
import { useAccount } from '@/features/profile/profile_store';

export default function ConversationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const account = useAccount();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    if (!account.signedIn) return;
    setFocused(true);
    const unwatch = messageService.watch(id);
    return () => { setFocused(false); unwatch(); };
  }, [id, account.signedIn]));
  if (!account.signedIn) return <Redirect href={{ pathname: '/login', params: { returnTo: `/messages/${id}` } }} />;

  return (
    <ConversationScreen
      key={id}
      conversationId={id}
      service={messageService}
      focused={focused}
      onBack={() => backOrReplace('/messages')}
    />
  );
}
