import { router, useLocalSearchParams } from 'expo-router';

import { SearchFilterScreen } from '@/features/marketplace/presentation/search_filter_screen';
import { initialSearchFilters, serializeSearchFilters } from '@/features/marketplace/presentation/search_filter_params';
import { backOrReplace } from '@/navigation/app_navigation';

export default function SearchFilterRoute() {
  const params = useLocalSearchParams();

  return (
    <SearchFilterScreen
      initialFilters={initialSearchFilters(params)}
      onBack={() => backOrReplace('/home')}
      onApply={(filters) => router.dismissTo({ pathname: '/home', params: serializeSearchFilters(filters) })}
    />
  );
}
