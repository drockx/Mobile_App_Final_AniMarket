import { createMemoryCollection, createPrivateMemoryCollection, type CollectionRepository } from '@/services/collection';
import { useSampleData } from '@/services/development_data';
import { createLocalListingRepository } from '@/features/marketplace/data/local_listing_repository';
import { listings } from '@/features/marketplace/data/mock_listings';
import { davaoDelNorteMarkets } from '@/features/market_reference/data/market_reference_data';
import type { ListingRepository } from '@/features/marketplace/domain/listing_repository';
import type { LocalMarket } from '@/features/market_reference/domain/market_reference';
import type { OrderRequest } from '@/features/orders/domain/checkout';
import type { NotificationRead } from '@/features/notifications/notification_store';

export type AppRepositories = {
  listings: ListingRepository;
  orders: CollectionRepository<OrderRequest & { ownerId: string }>;
  markets: CollectionRepository<LocalMarket>;
  notificationReads: CollectionRepository<NotificationRead>;
};

/** The only sample-data bootstrap. All feature services accept empty or asynchronous providers. */
export function createLocalAppRepositories(samples = useSampleData): AppRepositories {
  return {
    listings: createLocalListingRepository(samples ? listings : []),
    orders: createPrivateMemoryCollection(),
    markets: createMemoryCollection(samples ? davaoDelNorteMarkets : []),
    notificationReads: createPrivateMemoryCollection(),
  };
}

// Keep these local providers during the authorized, staged cloud rollout.
// Replace them only when the listing/order adapters and access rules are tested.
export const appRepositories = createLocalAppRepositories();
