import { AppTextInput as TextInput } from '@/components/app_text_input';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';

import { apiRequest } from '@/services/api';
import type { IdReview } from '../domain/identity_verification';
import { AccountScreenLayout } from './components/account_screen_layout';
import { verificationStyles as s } from './components/verification_styles';
import { PrivateIdPreview } from './components/private_id_preview';

export function VerificationReviewScreen({ onBack }: { onBack: () => void }) {
  const [reviews, setReviews] = useState<IdReview[]>([]);
  const [selected, setSelected] = useState<IdReview | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(true);
  const working = useRef(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const mounted = useRef(true);
  async function load() {
    if (working.current) return;
    working.current = true; setBusy(true); setError('');
    try { const result = await apiRequest<{ reviews: IdReview[] }>('/verification/reviews'); if (mounted.current) { setReviews(result.reviews); setLoaded(true); } }
    catch (issue) { if (mounted.current) setError(issue instanceof Error ? issue.message : 'Unable to load ID reviews.'); }
    finally { working.current = false; if (mounted.current) setBusy(false); }
  }
  useEffect(() => {
    let active = true; mounted.current = true; working.current = true;
    const controller = new AbortController();
    void apiRequest<{ reviews: IdReview[] }>('/verification/reviews', { signal: controller.signal }).then((result) => {
      if (active) { setReviews(result.reviews); setLoaded(true); }
    }).catch((issue) => { if (active) setError(issue.message); }).finally(() => {
      if (active) { working.current = false; setBusy(false); }
    });
    return () => { active = false; mounted.current = false; controller.abort(); };
  }, []);
  async function open(review: IdReview) {
    if (working.current) return;
    working.current = true; setBusy(true); setError('');
    try {
      const result = await apiRequest<IdReview>(`/verification/reviews/${review.userId}`);
      if (mounted.current) { setSelected(result); setReason(''); }
    } catch (issue) { if (mounted.current) setError(issue instanceof Error ? issue.message : 'Unable to open this ID.'); }
    finally { working.current = false; if (mounted.current) setBusy(false); }
  }
  async function decide(decision: 'verified' | 'rejected') {
    if (working.current || !selected) return;
    if (decision === 'rejected' && !reason.trim()) { setError('Explain what the user needs to correct.'); return; }
    working.current = true; setBusy(true); setError('');
    let saved = false;
    try {
      await apiRequest(`/verification/reviews/${selected.userId}`, { method: 'POST', body: { submissionId: selected.submissionId, decision, reason } });
      saved = true;
      if (mounted.current) { setSelected(null); setReason(''); }
    } catch (issue) { if (mounted.current) setError(issue instanceof Error ? issue.message : 'Unable to save this review.'); }
    finally { working.current = false; if (mounted.current) setBusy(false); }
    if (saved && mounted.current) void load();
  }
  function approve() {
    const message = `Confirm that the ID is valid, its photo is clear, and its name matches ${selected?.fullName}?`;
    if (Platform.OS === 'web') { if (window.confirm(message)) void decide('verified'); }
    else Alert.alert('Approve identity?', message, [{ text: 'Cancel', style: 'cancel' }, { text: 'Approve', onPress: () => { void decide('verified'); } }]);
  }
  return (
    <AccountScreenLayout title="ID Reviews" subtitle="Check the whole ID, its validity, and whether its name matches the account." onBack={onBack}>
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      {selected ? <View style={s.card}>
        <Text style={s.title}>{selected.fullName}</Text>
        <Text style={s.note}>{selected.idType} · Submitted {new Date(selected.submittedAt).toLocaleDateString()}</Text>
        {selected.photo && <PrivateIdPreview source={selected.photo} label="Private ID photo for review" />}
        <Text style={s.note}>Approve only when the ID details support this account’s identity. ID photos are removed after the decision.</Text>
        <Pressable accessibilityRole="button" disabled={busy} onPress={approve} style={[s.button, busy && s.disabled]}><Text style={s.buttonText}>{busy ? 'Please wait…' : 'Approve Identity'}</Text></Pressable>
        <Text style={s.label}>Feedback if a new photo is needed</Text>
        <TextInput accessibilityLabel="Verification feedback" placeholder="Explain what the user needs to correct" placeholderTextColor="#6b776f" value={reason} onChangeText={setReason} editable={!busy} maxLength={300} multiline style={s.input} />
        <Pressable accessibilityRole="button" disabled={busy || !reason.trim()} onPress={() => { void decide('rejected'); }} style={[s.secondary, (busy || !reason.trim()) && s.disabled]}><Text style={s.secondaryText}>Request a New ID Photo</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setSelected(null); setReason(''); setError(''); }} style={s.secondary}><Text style={s.secondaryText}>Back to Review Queue</Text></Pressable>
      </View> : <>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void load(); }} style={s.secondary}><Text style={s.secondaryText}>{busy ? 'Loading…' : 'Refresh Review Queue'}</Text></Pressable>
        {loaded && reviews.length === 0 && <View style={s.card}><Text style={s.body}>No IDs are waiting for your review.</Text></View>}
        {reviews.map((review) => <Pressable key={review.submissionId} accessibilityRole="button" disabled={busy} onPress={() => { void open(review); }} style={s.card}>
          <Text style={s.title}>{review.fullName}</Text><Text style={s.note}>{review.idType} · {review.city}</Text><Text style={s.label}>Review ID</Text>
        </Pressable>)}
      </>}
    </AccountScreenLayout>
  );
}
