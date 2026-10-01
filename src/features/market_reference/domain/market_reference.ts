export type MarketCategory = 'cow' | 'goat' | 'pig' | 'poultry';

export type MarketPrice = {
  id: string;
  category: MarketCategory;
  name: string;
  unit: string;
  min: number;
  max: number;
  median: number;
  change: number;
  observations: number;
  history: readonly number[];
};

export type LocalMarket = {
  id: string;
  sample?: boolean;
  updatedAt?: string;
  source?: string;
  name: string;
  location: string;
  prices: readonly MarketPrice[];
};

export function isMarketRecord(market: LocalMarket): boolean {
  return typeof market.name === 'string' && typeof market.location === 'string' && Array.isArray(market.prices)
    && market.prices.every((price) => price && typeof price.id === 'string' && typeof price.name === 'string'
      && ['cow', 'goat', 'pig', 'poultry'].includes(price.category) && typeof price.unit === 'string'
      && [price.min, price.max, price.median, price.change, price.observations].every(Number.isFinite)
      && price.min > 0 && price.max >= price.min && price.median >= price.min && price.median <= price.max
      && price.observations >= 0 && Array.isArray(price.history) && price.history.every((value: number) => Number.isFinite(value) && value > 0));
}
