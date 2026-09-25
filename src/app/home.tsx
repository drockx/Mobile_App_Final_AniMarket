import { router, useLocalSearchParams } from 'expo-router';

import { marketplaceService } from '@/features/marketplace/marketplace_dependencies';
import { MarketplaceHomeScreen } from '@/features/marketplace/presentation/marketplace_home_screen';
import { parseSearchFilters, serializeSearchFilters } from '@/features/marketplace/presentation/search_filter_params';

export default function HomeRoute() {
  const params = useLocalSearchParams();
  const routeFilters = parseSearchFilters(params);

  return (
    <MarketplaceHomeScreen
      marketplace={marketplaceService}
      routeFilters={routeFilters}
      routeKey={JSON.stringify(params)}
      onOpenListing={(id) => router.push({ pathname: '/listings/id', params: { id } })}
      onOpenMessages={() => router.push('/messages')}
      onOpenFilters={(filters) => router.push({
        pathname: '/search_filter',
        params: params.applied === 'true'
          ? serializeSearchFilters(filters)
          : {
            category: filters.category ?? '',
            query: filters.query,
            verifiedOnly: String(filters.verifiedOnly),
          },
      })}
    />
  );
}
