import { router } from 'expo-router';

import { sellerListingsService } from '@/features/marketplace/marketplace_dependencies';
import { MyListingsScreen } from '@/features/marketplace/presentation/my_listings_screen';

export default function MyListingsRoute() {
  return (
    <MyListingsScreen
      service={sellerListingsService}
      onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/profile'); }}
      onCreate={(listing, continueDraft) => router.push({ pathname: '/listings/create', params: listing ? {
        suggestedTitle: listing.title,
        suggestedCategory: { Cow: 'cattle', Goat: 'goat', Pig: 'swine', Chicken: 'poultry' }[listing.category],
        suggestedPrice: String(listing.price), suggestedWeight: listing.weight,
        suggestedUnit: listing.unit,
        draftId: continueDraft ? listing.id : undefined,
      } : {} })}
      onInquiries={() => router.navigate({ pathname: '/messages', params: { side: 'selling' } })}
    />
  );
}
