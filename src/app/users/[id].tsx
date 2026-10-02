import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { useAccount } from '@/features/profile/profile_store';
import type { PublicProfile } from '@/features/profile/presentation/public_profile_screen';
import { PublicProfileScreen } from '@/features/profile/presentation/public_profile_screen';
import { backOrReplace } from '@/navigation/app_navigation';
import { apiRequest } from '@/services/api';

export default function PublicProfileRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const account = useAccount();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const request = useRef(0), saving = useRef(false);
  const activeRequest = useRef<AbortController | null>(null);
  const load = useCallback(() => {
    activeRequest.current?.abort();
    const current = ++request.current, controller = new AbortController();
    activeRequest.current = controller;
    setProfile(null); setLoading(true); setError(null);
    if (!account.userId || !/^[a-zA-Z0-9_-]{1,200}$/.test(id ?? '')) {
      setError('This user profile is unavailable.'); setLoading(false);
    } else void apiRequest<{ profile: PublicProfile }>(`/users/${id}`, { signal: controller.signal }).then((result) => {
      if (request.current === current) setProfile(result.profile);
    }).catch((issue) => {
      if (!controller.signal.aborted && request.current === current) setError(issue instanceof Error ? issue.message : 'Unable to load this profile.');
    }).finally(() => { if (request.current === current) setLoading(false); });
    return () => { request.current++; activeRequest.current?.abort(); activeRequest.current = null; };
  }, [id, account.userId]);
  useFocusEffect(load);
  async function rate(stars: number) {
    if (saving.current || !profile?.canRate) return false;
    const current = request.current;
    saving.current = true; setBusy(true); setError(null);
    try {
      const result = await apiRequest<{ profile: PublicProfile }>(`/users/${id}/rating`, { method: 'POST', body: { stars } });
      if (request.current !== current) return false;
      setProfile(result.profile); return true;
    } catch (issue) {
      if (request.current === current) setError(issue instanceof Error ? issue.message : 'Unable to save your rating.');
      return false;
    } finally { saving.current = false; setBusy(false); }
  }
  return <PublicProfileScreen key={`${id}:${account.userId}`} profile={profile} loading={loading} error={error} busy={busy} onRetry={() => { if (!saving.current) load(); }} onBack={() => backOrReplace(account.signedIn ? '/home' : '/login')} onRate={rate} />;
}
