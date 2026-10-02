export type MarketCategory = 'cow' | 'goat' | 'pig' | 'poultry';

export type PriceObservation = {
  observedAt: string;
  min: number;
  max: number;
  statistic: 'average' | 'range';
  sourceName: string;
  sourceUrl: string;
};

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
  statistic?: 'average' | 'range';
  observedAt?: string;
  sourceName?: string;
  sourceUrl?: string;
  notes?: string;
  revision?: number;
  historyEntries?: readonly PriceObservation[];
};

export type LocalMarket = {
  id: string;
  sample?: boolean;
  updatedAt?: string;
  source?: string;
  name: string;
  location: string;
  prices: readonly MarketPrice[];
  scope?: 'province';
};

export function isMarketRecord(market: LocalMarket): boolean {
  return typeof market.name === 'string' && typeof market.location === 'string' && Array.isArray(market.prices)
    && market.prices.every((price) => price && typeof price.id === 'string' && typeof price.name === 'string'
      && ['cow', 'goat', 'pig', 'poultry'].includes(price.category) && typeof price.unit === 'string'
      && [price.min, price.max, price.median, price.change, price.observations].every(Number.isFinite)
      && price.min > 0 && price.max >= price.min && price.median >= price.min && price.median <= price.max
      && price.observations >= 0 && Array.isArray(price.history) && price.history.every((value: number) => Number.isFinite(value) && value > 0)
      && (!price.statistic || (['average', 'range'].includes(price.statistic)
        && isObservationDate(price.observedAt)
        && typeof price.sourceName === 'string' && !!price.sourceName.trim()
        && typeof price.sourceUrl === 'string' && isSourceUrl(price.sourceUrl)
        && Number.isInteger(price.revision) && price.revision! > 0
        && (price.statistic !== 'average' || price.min === price.max)))
      && (!price.historyEntries || (Array.isArray(price.historyEntries) && price.historyEntries.every((entry: PriceObservation) =>
        entry && isObservationDate(entry.observedAt) && ['average', 'range'].includes(entry.statistic)
        && [entry.min, entry.max].every(Number.isFinite) && entry.min > 0 && entry.max >= entry.min
        && (entry.statistic !== 'average' || entry.min === entry.max)
        && typeof entry.sourceName === 'string' && !!entry.sourceName.trim()
        && typeof entry.sourceUrl === 'string' && isSourceUrl(entry.sourceUrl)))));
}

export function isObservationDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isSourceUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.port && url.hostname.includes('.') && !/^localhost$|^[\d.]+$/.test(url.hostname); }
  catch { return false; }
}

export function marketForLocality(markets: readonly LocalMarket[], location: string): LocalMarket | undefined {
  return markets.find((market) => market.location === location)
    ?? markets.find((market) => market.scope === 'province' && market.location === 'Davao del Norte');
}

export function observationDate(value?: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date not supplied';
}
