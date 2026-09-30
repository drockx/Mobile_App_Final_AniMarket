import { getOrderPickupPin, marketplaceService } from '@/features/marketplace/marketplace_dependencies';
import { formatListingAddress } from '@/features/marketplace/domain/listing';

import { createCheckoutService } from './application/checkout_service';
import { mockCheckoutItem } from './data/mock_checkout_item';
import { createExampleReviewForm } from './data/mock_order_review';
import { createExampleOrderStatus } from './data/mock_order_status';
import type { CheckoutItem } from './domain/checkout';

export const checkoutService = createCheckoutService();

export function saveOrderRequest(listingId: string | undefined, reviewed: boolean) {
  const item = getCheckoutItem(listingId);
  return checkoutService.saveRequest(item, reviewed, new Date(), item ? getOrderPickupPin(item.id) : undefined);
}

export function getCheckoutItem(id?: string): CheckoutItem | undefined {
  if (!id || id === mockCheckoutItem.id) return mockCheckoutItem;
  const listing = marketplaceService.getListing(id);
  if (!listing) return undefined;
  return {
    id: listing.id, title: listing.title, weight: listing.weight, health: listing.health,
    seller: listing.seller?.name ?? 'Seller to confirm', sellerAddress: formatListingAddress(listing),
    price: listing.price, priceUnit: listing.priceUnit, imageUri: listing.imageUri,
    category: listing.category, verified: listing.verified,
    vaccinationProofName: listing.vaccinationProof?.name,
    healthVerified: listing.healthVerification.status === 'verified',
  };
}

export function getOrderReview(id?: string) {
  const listingId = id ?? mockCheckoutItem.id;
  const saved = checkoutService.getDraft(listingId);
  if (saved || id) return { draft: saved, example: listingId === mockCheckoutItem.id };
  return { draft: checkoutService.review(mockCheckoutItem, createExampleReviewForm()).draft ?? undefined, example: true };
}

export function getOrderStatus(orderId?: string) {
  if (orderId) return { request: checkoutService.getOrder(orderId), example: false };
  return { request: createExampleOrderStatus(), example: true };
}
