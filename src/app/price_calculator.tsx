import { router, useLocalSearchParams } from 'expo-router';

import { PriceCalculatorScreen } from '@/features/price_calculator/presentation/price_calculator_screen';

export default function PriceCalculatorRoute() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  const initialCategory = category === 'goat' ? 'goat'
    : category === 'pig' || category === 'swine' ? 'swine'
      : category === 'poultry' ? 'poultry' : 'cattle';

  return (
    <PriceCalculatorScreen
      initialCategory={initialCategory}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/market_reference');
      }}
      onUsePrice={(price, animal, weight) => router.push({ pathname: '/listings/create', params: { suggestedPrice: String(price), suggestedCategory: animal, suggestedWeight: String(weight) } })}
    />
  );
}
