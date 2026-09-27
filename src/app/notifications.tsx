import { router } from 'expo-router';
import { Alert } from 'react-native';

import type { AppNotification } from '@/features/notifications/notification_store';
import { NotificationsScreen } from '@/features/notifications/presentation/notifications_screen';

export default function NotificationsRoute() {
  function openNotification(notification: AppNotification) {
    if (notification.destination === 'messages') {
      router.push('/messages');
    } else if (notification.destination === 'profile') {
      router.push('/profile');
    } else {
      Alert.alert(
        notification.destination === 'order' ? 'Order details' : 'Draft listing',
        `${notification.destination === 'order' ? 'Order details' : 'Draft editing'} will be available when this feature is connected.`,
      );
    }
  }

  return <NotificationsScreen onBack={() => router.back()} onOpenNotification={openNotification} />;
}
