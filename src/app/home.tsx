import { router, useIsFocused, useLocalSearchParams } from 'expo-router';

import { marketplaceService } from '@/features/marketplace/marketplace_dependencies';
import { MarketplaceHomeScreen } from '@/features/marketplace/presentation/marketplace_home_screen';
import { parseSearchFilters, serializeSearchFilters } from '@/features/marketplace/presentation/search_filter_params';

export default function HomeRoute() {
  const params = useLocalSearchParams();
  const isFocused = useIsFocused();
  const routeFilters = parseSearchFilters(params);

  return (
    <MarketplaceHomeScreen
      marketplace={marketplaceService}
      routeFilters={routeFilters}
      routeKey={JSON.stringify(params)}
      isFocused={isFocused}
      onOpenListing={(id) => router.push({ pathname: '/listings/id', params: { id } })}
      onOpenNotifications={() => router.push('/notifications')}
      onSearch={(filters) => router.setParams(serializeSearchFilters(filters))}
      onOpenFilters={(filters) => router.push({
        pathname: '/search_filter',
        params: serializeSearchFilters(filters),
      })}
    />
  );
}
