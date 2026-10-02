import { useState } from 'react';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { DataFeedback } from '@/components/data_feedback';
import type { PublicProfile } from '../domain/public_profile';
import { AccountScreenLayout, accountColors as color } from './components/account_screen_layout';

export type { PublicProfile } from '../domain/public_profile';

export function PublicProfileScreen({ profile, loading, error, busy, onBack, onRetry, onRate }: {
  profile: PublicProfile | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
  onBack: () => void;
  onRetry: () => void;
  onRate: (stars: number) => Promise<boolean>;
}) {
  const [selection, setSelection] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const stars = selection ?? profile?.myRating ?? 0;
  const initials = profile?.fullName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'AM';
  const joined = profile?.memberSince ? new Date(profile.memberSince) : null;
  const joinedText = joined && Number.isFinite(joined.getTime()) ? joined.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' }) : null;
  async function save() {
    if (!stars || busy) return;
    setSaved(false);
    if (await onRate(stars)) { setSelection(null); setSaved(true); }
  }
  return <AccountScreenLayout title="User Profile" subtitle="Public profile" onBack={onBack}>
    <DataFeedback loading={loading} error={error} onRetry={onRetry} />
    {!!profile && <>
      <View style={styles.card}>
        <View style={styles.avatar}>
          {profile.photoUrl ? <Image source={profile.photoUrl} contentFit="cover" accessibilityLabel={`${profile.fullName}'s profile photo`} style={styles.photo} /> : <Text style={styles.initials}>{initials}</Text>}
        </View>
        <Text accessibilityRole="header" style={styles.name}>{profile.fullName}</Text>
        <Text style={styles.body}>{profile.city}, Davao del Norte</Text>
        <Text style={styles.identity}>{profile.verified ? 'Identity verified' : 'AniMarket member'}</Text>
        {joinedText && <Text style={styles.body}>Member since {joinedText}</Text>}
      </View>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Contact</Text>
        <View style={styles.contactField}>
          <Text style={styles.contactLabel}>Contact number</Text>
          <Text selectable style={styles.contactValue}>{profile.phone || 'Not provided'}</Text>
        </View>
        <View style={styles.contactField}>
          <Text style={styles.contactLabel}>Email</Text>
          <Text selectable style={styles.contactValue}>{profile.email || 'Not provided'}</Text>
        </View>
      </View>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Ratings</Text>
        <Text style={styles.average}>{profile.rating.average === null ? 'No ratings yet' : `★ ${profile.rating.average.toFixed(1)} / 5`}</Text>
        {!!profile.rating.count && <Text style={styles.body}>{profile.rating.count} {profile.rating.count === 1 ? 'rating' : 'ratings'}</Text>}
      </View>
      {profile.canRate ? <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>{profile.myRating ? 'Your rating' : 'Rate this user'}</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((value) => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`${value} ${value === 1 ? 'star' : 'stars'}`} accessibilityState={{ checked: stars === value, disabled: busy }} disabled={busy} onPress={() => { setSelection(value); setSaved(false); }} style={[styles.starButton, value <= stars && styles.starSelected]}>
            <Text style={[styles.star, value <= stars && styles.starFilled]}>{value <= stars ? '★' : '☆'}</Text>
          </Pressable>)}
        </View>
        <Text style={styles.body}>{stars ? `${stars} of 5 stars` : 'Select a star rating'}</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || !stars || stars === profile.myRating }} disabled={busy || !stars || stars === profile.myRating} onPress={() => { void save(); }} style={[styles.saveButton, (busy || !stars || stars === profile.myRating) && styles.disabled]}>
          {busy ? <ActivityIndicator color="#fff" accessibilityLabel="Saving your rating" /> : <Text style={styles.saveText}>{profile.myRating ? 'Update Rating' : 'Submit Rating'}</Text>}
        </Pressable>
        {saved && <Text accessibilityLiveRegion="polite" style={styles.identity}>Rating saved</Text>}
      </View> : <Text style={styles.body}>This is your public profile.</Text>}
    </>}
  </AccountScreenLayout>;
}

const styles = StyleSheet.create({
  card: { padding: 16, borderWidth: 1, borderColor: color.line, borderRadius: 16, backgroundColor: '#fff', gap: 10 },
  avatar: { width: 88, height: 88, borderRadius: 24, backgroundColor: '#eaf5ed', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  initials: { color: color.forest, fontSize: 28, lineHeight: 36, fontWeight: '800' },
  name: { color: color.forest, fontSize: 22, lineHeight: 29, fontWeight: '800', textAlign: 'center' },
  body: { color: color.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  contactField: { gap: 4 },
  contactLabel: { color: color.muted, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  contactValue: { color: color.text, fontSize: 15, lineHeight: 22 },
  identity: { color: color.green, fontSize: 15, lineHeight: 22, fontWeight: '700', textAlign: 'center' },
  sectionTitle: { color: color.text, fontSize: 18, lineHeight: 25, fontWeight: '700', textAlign: 'center' },
  average: { color: color.forest, fontSize: 24, lineHeight: 32, fontWeight: '800', textAlign: 'center' },
  stars: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 6 },
  starButton: { width: 44, minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: color.line, alignItems: 'center', justifyContent: 'center' },
  starSelected: { backgroundColor: '#eaf5ed', borderColor: color.green },
  star: { color: color.muted, fontSize: 28, lineHeight: 36 },
  starFilled: { color: color.forest },
  saveButton: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, backgroundColor: color.forest, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontSize: 16, lineHeight: 22, fontWeight: '700', textAlign: 'center' },
  disabled: { opacity: 0.5 },
});
