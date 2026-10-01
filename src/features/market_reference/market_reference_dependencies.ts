import { useSyncExternalStore } from 'react';
import { createCollectionStore } from '@/services/collection';
import { appRepositories } from '@/data/app_repositories';
import { isMarketRecord } from './domain/market_reference';

/** Sample references for the prototype; replace with verified market data before production use. */
export const marketReferenceStore = createCollectionStore(appRepositories.markets, isMarketRecord);
marketReferenceStore.connect('public');
export function useMarketReferences() { return useSyncExternalStore(marketReferenceStore.subscribe, marketReferenceStore.getState, marketReferenceStore.getState); }
