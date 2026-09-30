import { router, useLocalSearchParams } from 'expo-router';

import { marketplaceService, sellerListingsService } from '@/features/marketplace/marketplace_dependencies';
import { CreateListingScreen } from '@/features/marketplace/presentation/create_listing_screen';
import { backOrReplace } from '@/navigation/app_navigation';

export default function CreateListingRoute() {
  const { suggestedPrice, suggestedCategory, suggestedWeight, suggestedTitle, suggestedUnit, draftId } = useLocalSearchParams<{ suggestedPrice?: string; suggestedCategory?: string; suggestedWeight?: string; suggestedTitle?: string; suggestedUnit?: string; draftId?: string }>();
  const initialPrice = suggestedPrice && /^\d+(\.\d{1,2})?$/.test(suggestedPrice) && Number.isFinite(Number(suggestedPrice)) && Number(suggestedPrice) > 0 ? suggestedPrice : '';
  const initialCategory = suggestedCategory === 'goat' ? 'Goat' : suggestedCategory === 'swine' ? 'Pig' : suggestedCategory === 'poultry' ? 'Chicken' : 'Cow';
  const initialWeight = suggestedWeight && Number(suggestedWeight) > 0 && Number.isFinite(Number(suggestedWeight)) ? suggestedWeight : '';
  return (
    <CreateListingScreen
      marketplace={marketplaceService}
      initialPrice={initialPrice}
      initialCategory={initialCategory}
      initialWeight={initialWeight}
      initialTitle={suggestedTitle}
      initialPriceUnit={suggestedUnit === 'per kg' || suggestedUnit === 'total' ? suggestedUnit : 'per head'}
      onClose={() => backOrReplace('/home')}
      onPublished={(id) => {
        if (draftId) sellerListingsService.remove(draftId);
        router.replace({ pathname: '/listings/id', params: { id } });
      }}
      onMarketReference={() => router.push('/market_reference')}
    />
  );
}
