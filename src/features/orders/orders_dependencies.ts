import { marketplaceService } from '@/features/marketplace/marketplace_dependencies';
import { formatListingAddress } from '@/features/marketplace/domain/listing';

import { createCheckoutService } from './application/checkout_service';
import { mockCheckoutItem } from './data/mock_checkout_item';
import type { CheckoutItem } from './domain/checkout';

export const checkoutService = createCheckoutService();

export function getCheckoutItem(id?: string): CheckoutItem | undefined {
  if (!id || id === mockCheckoutItem.id) return mockCheckoutItem;
  const listing = marketplaceService.getListing(id);
  if (!listing) return undefined;
  return {
    id: listing.id, title: listing.title, weight: listing.weight, health: listing.health,
    seller: listing.seller?.name ?? 'Seller to confirm', sellerAddress: formatListingAddress(listing),
    price: listing.price, priceUnit: listing.priceUnit, imageUri: listing.imageUri,
  };
}
