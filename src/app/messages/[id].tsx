import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import { messageService } from '@/features/messages/messages_dependencies';
import { ConversationScreen } from '@/features/messages/presentation/conversation_screen';
import { backOrReplace } from '@/navigation/app_navigation';
import { useAccount } from '@/features/profile/profile_store';
import { voiceService } from '@/features/calls/calls_dependencies';

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
      onViewProfile={(userId) => router.push({ pathname: '/users/[id]', params: { id: userId } })}
      onBack={() => backOrReplace('/messages')}
      onCall={() => {
        const call = voiceService.getSnapshot();
        if (!call.busy && ['idle', 'ended', 'error'].includes(call.phase)) void voiceService.start(id).catch(() => {});
        router.push('/voice_call');
      }}
    />
  );
}
