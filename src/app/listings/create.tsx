import { router, useLocalSearchParams } from 'expo-router';

import { marketplaceService } from '@/features/marketplace/marketplace_dependencies';
import { CreateListingScreen } from '@/features/marketplace/presentation/create_listing_screen';

export default function CreateListingRoute() {
  const { suggestedPrice, suggestedCategory, suggestedWeight } = useLocalSearchParams<{ suggestedPrice?: string; suggestedCategory?: string; suggestedWeight?: string }>();
  const initialPrice = suggestedPrice && /^\d+$/.test(suggestedPrice) && Number(suggestedPrice) > 0 ? suggestedPrice : '';
  const initialCategory = suggestedCategory === 'goat' ? 'Goat' : suggestedCategory === 'swine' ? 'Pig' : suggestedCategory === 'poultry' ? 'Chicken' : 'Cow';
  const initialWeight = suggestedWeight && Number(suggestedWeight) > 0 && Number.isFinite(Number(suggestedWeight)) ? suggestedWeight : '';
  return (
    <CreateListingScreen
      marketplace={marketplaceService}
      initialPrice={initialPrice}
      initialCategory={initialCategory}
      initialWeight={initialWeight}
      onClose={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/home');
      }}
      onPublished={(id) => router.replace({ pathname: '/listings/id', params: { id } })}
      onMarketReference={() => router.push('/market_reference')}
    />
  );
}
