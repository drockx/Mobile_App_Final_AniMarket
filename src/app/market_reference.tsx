import { router } from 'expo-router';
import { marketReferenceStore, useMarketReferences } from '@/features/market_reference/market_reference_dependencies';
import { MarketReferenceScreen } from '@/features/market_reference/presentation/market_reference_screen';

export default function MarketReferenceRoute() {
  const data = useMarketReferences();
  return (
    <MarketReferenceScreen
      markets={data.items} loading={data.loading} error={data.error} onRetry={marketReferenceStore.retry}
      onOpenCalculator={(category, city) => router.push({
        pathname: '/price_calculator',
        params: { category, city },
      })}
    />
  );
}
