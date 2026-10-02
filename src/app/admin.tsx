import { router } from 'expo-router';

import { AdminPortalScreen } from '@/features/market_reference/presentation/admin_portal_screen';
import { signOut } from '@/features/profile/profile_store';

export default function AdminRoute() {
  return <AdminPortalScreen onSignOut={() => { signOut(); router.replace('/login'); }} />;
}
