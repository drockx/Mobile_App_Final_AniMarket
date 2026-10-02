import { useSyncExternalStore } from 'react';
import { createCollectionStore } from '@/services/collection';
import { appRepositories } from '@/data/app_repositories';
import { isMarketRecord } from './domain/market_reference';

/** Public, sourced references maintained through the authorized admin endpoint. */
export const marketReferenceStore = createCollectionStore(appRepositories.markets, isMarketRecord);
marketReferenceStore.connect('public');

/** @deprecated Screens should use useMarketReferences() to receive updates and loading/error states. */
export let marketReferenceData = marketReferenceStore.getSnapshot();
marketReferenceStore.subscribe(() => {
  marketReferenceData = marketReferenceStore.getSnapshot();
});

export function useMarketReferences() { return useSyncExternalStore(marketReferenceStore.subscribe, marketReferenceStore.getState, marketReferenceStore.getState); }
