import { router } from 'expo-router';
import { marketReferenceData } from '@/features/market_reference/market_reference_dependencies';
import { MarketReferenceScreen } from '@/features/market_reference/presentation/market_reference_screen';

export default function MarketReferenceRoute() {
  return (
    <MarketReferenceScreen
      markets={marketReferenceData}
      onOpenCalculator={(category) => router.push({
        pathname: '/price_calculator',
        params: { category },
      })}
    />
  );
}
