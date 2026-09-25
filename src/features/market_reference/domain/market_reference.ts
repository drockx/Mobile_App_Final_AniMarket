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

export type RegionalMarket = {
  id: string;
  name: string;
  location: string;
  sampleTime: string;
  prices: readonly MarketPrice[];
};
