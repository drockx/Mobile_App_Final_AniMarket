import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';
import { DataFeedback } from '@/components/data_feedback';

import { getOrderPickupPin, marketplaceService } from '@/features/marketplace/marketplace_dependencies';
import { CreateListingScreen } from '@/features/marketplace/presentation/create_listing_screen';
import { backOrReplace } from '@/navigation/app_navigation';
import { refreshAccount, useAccount } from '@/features/profile/profile_store';
import { SellerVerificationRequiredScreen } from '@/features/profile/presentation/seller_verification_required_screen';
import type { LocationSelection } from '@/features/location/location_dependencies';

export default function CreateListingRoute() {
  const account = useAccount();
  useFocusEffect(useCallback(() => { if (account.signedIn) void refreshAccount().catch(() => {}); }, [account.signedIn]));
  const { suggestedPrice, suggestedCategory, suggestedWeight, suggestedTitle, suggestedUnit, draftId } = useLocalSearchParams<{ suggestedPrice?: string; suggestedCategory?: string; suggestedWeight?: string; suggestedTitle?: string; suggestedUnit?: string; draftId?: string }>();
  const initialPrice = suggestedPrice && /^\d+(\.\d{1,2})?$/.test(suggestedPrice) && Number.isFinite(Number(suggestedPrice)) && Number(suggestedPrice) > 0 ? suggestedPrice : '';
  const initialCategory = suggestedCategory === 'goat' ? 'Goat' : suggestedCategory === 'swine' ? 'Pig' : suggestedCategory === 'poultry' ? 'Chicken' : 'Cow';
  const initialWeight = suggestedWeight && Number(suggestedWeight) > 0 && Number.isFinite(Number(suggestedWeight)) ? suggestedWeight : '';
  const owned = useSyncExternalStore(marketplaceService.subscribeOwned, marketplaceService.getOwnedState, marketplaceService.getOwnedState);
  const draft = draftId ? owned.items.find((item) => item.id === draftId && item.status === 'draft') : undefined;
  const draftKey = `${account.userId}:${draftId ?? ''}`;
  const [attempt, setAttempt] = useState(0);
  const [pickup, setPickup] = useState<{ key: string; value: LocationSelection | null; error: string | null } | null>(null);
  useEffect(() => {
    if (!draftId || !draft || !account.signedIn) return;
    let active = true;
    void getOrderPickupPin(draftId).then((pin) => {
      if (active) setPickup({ key: draftKey, value: pin ? { coordinate: pin, source: 'map', address: null } : null, error: null });
    }).catch((error) => { if (active) setPickup({ key: draftKey, value: null, error: error instanceof Error ? error.message : 'Unable to load the saved pickup pin.' }); });
    return () => { active = false; };
  }, [account.signedIn, draftId, draftKey, draft, attempt]);
  if (!account.signedIn) return <Redirect href={{ pathname: '/login', params: { returnTo: '/listings/create' } }} />;
  if (account.verification.status !== 'verified') return <SellerVerificationRequiredScreen onBack={() => backOrReplace('/home')} onVerify={() => router.push('/account_verification')} />;
  if (draftId && (owned.loading || owned.error || !draft || pickup?.key !== draftKey || pickup.error)) return <View style={{ flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' }}>
    <DataFeedback loading={owned.loading || (!!draft && !owned.error && pickup?.key !== draftKey)} error={owned.error || pickup?.error} onRetry={() => { marketplaceService.retryOwned(); setAttempt((value) => value + 1); }} />
    {!owned.loading && !owned.error && !draft && <Text style={{ color: '#12372a', fontSize: 18 }}>This draft is no longer available for your account.</Text>}
    <Pressable accessibilityRole="button" onPress={() => backOrReplace('/my_listings')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: '#12372a', fontWeight: '700' }}>Back to My Listings</Text></Pressable>
  </View>;
  return (
    <CreateListingScreen
      key={`${account.userId}:${draftId ?? 'new'}`}
      marketplace={marketplaceService}
      initialDraft={draft} initialPickup={draftId ? pickup?.value : null}
      initialPrice={initialPrice}
      initialCategory={initialCategory}
      initialWeight={initialWeight}
      initialTitle={suggestedTitle}
      initialPriceUnit={suggestedUnit === 'per kg' || suggestedUnit === 'total' ? suggestedUnit : 'per head'}
      onClose={() => backOrReplace('/home')}
      onSavedDraft={() => router.replace('/my_listings')}
      onPublished={(id) => {
        router.replace({ pathname: '/listings/id', params: { id } });
      }}
      onMarketReference={() => router.push('/market_reference')}
    />
  );
}
