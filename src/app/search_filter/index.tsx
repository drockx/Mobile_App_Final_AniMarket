import { router, useLocalSearchParams } from 'expo-router';

import { SearchFilterScreen } from '@/features/marketplace/presentation/search_filter_screen';
import { initialSearchFilters, serializeSearchFilters } from '@/features/marketplace/presentation/search_filter_params';

export default function SearchFilterRoute() {
  const params = useLocalSearchParams();

  return (
    <SearchFilterScreen
      initialFilters={initialSearchFilters(params)}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/home');
      }}
      onApply={(filters) => router.navigate({ pathname: '/home', params: serializeSearchFilters(filters) })}
    />
  );
}
