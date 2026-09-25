import { marketReferenceData } from '@/features/market_reference/market_reference_dependencies';
import { MarketReferenceScreen } from '@/features/market_reference/presentation/market_reference_screen';

export default function MarketReferenceRoute() {
  return <MarketReferenceScreen markets={marketReferenceData} />;
}
