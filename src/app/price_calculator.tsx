import { router, useLocalSearchParams } from 'expo-router';

import { PriceCalculatorScreen } from '@/features/price_calculator/presentation/price_calculator_screen';
import { backOrReplace } from '@/navigation/app_navigation';

export default function PriceCalculatorRoute() {
  const { category, city } = useLocalSearchParams<{ category?: string; city?: string }>();
  const initialCategory = category === 'goat' ? 'goat'
    : category === 'pig' || category === 'swine' ? 'swine'
      : category === 'poultry' ? 'poultry' : 'cattle';

  return (
    <PriceCalculatorScreen
      initialCategory={initialCategory}
      initialCity={city}
      onBack={() => backOrReplace('/market_reference')}
      onUsePrice={(price, animal, weight) => router.push({ pathname: '/listings/create', params: { suggestedPrice: String(price), suggestedCategory: animal, suggestedWeight: String(weight) } })}
    />
  );
}
