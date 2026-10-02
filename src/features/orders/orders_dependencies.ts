import { getOrderPickupPin, marketplaceService } from '@/features/marketplace/marketplace_dependencies';
import { formatListingAddress } from '@/features/marketplace/domain/listing';

import { createOrderService } from './application/order_service';
import { appRepositories } from '@/data/app_repositories';
import { getAccountSnapshot, subscribeAccount } from '../profile/profile_store';
import type { CheckoutItem } from './domain/checkout';

export const checkoutService = createOrderService(appRepositories.orders);
function connectAccount() { const account = getAccountSnapshot(); checkoutService.connectOwner(account.signedIn && !account.isStaff ? account.userId : ''); }
subscribeAccount(connectAccount); connectAccount();

export async function saveOrderRequest(listingId: string | undefined, reviewed: boolean) {
  const buyerId = getAccountSnapshot().userId;
  const item = getCheckoutItem(listingId);
  try {
    const pin = item ? await getOrderPickupPin(item.id) : undefined;
    if (!buyerId || buyerId !== getAccountSnapshot().userId) return { request: null, error: 'Your account changed. Please sign in again.' };
    // The listing may have changed while the private pickup point was loading.
    return checkoutService.saveRequest(getCheckoutItem(listingId), reviewed, new Date(), pin);
  } catch (error) { return { request: null, error: error instanceof Error ? error.message : 'Unable to load the pickup point.' }; }
}

export function getCheckoutItem(id?: string): CheckoutItem | undefined {
  if (!id) return undefined;
  const listing = marketplaceService.getListing(id);
  if (!listing) return undefined;
  return {
    id: listing.id, title: listing.title, weight: listing.weight, health: listing.health,
    seller: listing.seller?.name ?? 'Seller to confirm', sellerAddress: formatListingAddress(listing),
    sellerId: listing.seller?.id,
    sellerPhone: listing.seller?.phone,
    price: listing.price, priceUnit: listing.priceUnit, imageUri: listing.imageUri,
    category: listing.category, verified: listing.verified,
    vaccinationProofName: listing.vaccinationProof?.name,
    healthVerified: listing.healthVerification.status === 'verified',
  };
}

export function getOrderReview(id?: string) {
  return { draft: id ? checkoutService.getDraft(id) : undefined, example: false };
}

export function getOrderStatus(orderId?: string) {
  return { request: orderId ? checkoutService.getOrder(orderId) : undefined, example: false };
}
