import { createMemoryCollection, createPrivateMemoryCollection, type CollectionRepository } from '@/services/collection';
import { createLocalListingRepository } from '@/features/marketplace/data/local_listing_repository';
import type { ListingRepository } from '@/features/marketplace/domain/listing_repository';
import type { LocalMarket } from '@/features/market_reference/domain/market_reference';
import type { OrderRequest } from '@/features/orders/domain/checkout';
import type { NotificationRead } from '@/features/notifications/notification_store';
import { firebaseEnabled } from '@/services/firebase_config';
import { createFirebaseAppRepositories } from './firebase_repositories';

export type AppRepositories = {
  listings: ListingRepository;
  orders: CollectionRepository<OrderRequest & { ownerId: string }>;
  markets: CollectionRepository<LocalMarket>;
  notificationReads: CollectionRepository<NotificationRead>;
};

/** Local development starts empty; production uses the persistent cloud repositories. */
export function createLocalAppRepositories(): AppRepositories {
  return {
    listings: createLocalListingRepository(),
    orders: createPrivateMemoryCollection(),
    markets: createMemoryCollection(),
    notificationReads: createPrivateMemoryCollection(),
  };
}

export const appRepositories = firebaseEnabled ? createFirebaseAppRepositories() : createLocalAppRepositories();
