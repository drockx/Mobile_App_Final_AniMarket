import { createMarketplaceService } from './application/marketplace_service';
import { createSellerListingsService } from './application/seller_listings_service';
import { checkSellerEligibility, getAccountSnapshot, subscribeAccount } from '../profile/profile_store';
import { appRepositories } from '@/data/app_repositories';

// Firebase is deliberately absent. A future authorized adapter belongs at this boundary.
const catalog = createMarketplaceService(appRepositories.listings);
function connectAccount() { const account = getAccountSnapshot(); catalog.connectOwner(account.signedIn ? account.userId : ''); }
subscribeAccount(connectAccount); connectAccount();
export const sellerListingsService = createSellerListingsService(catalog);
export const getOrderPickupPin = (id: string) => catalog.loadPickupPin(id, getAccountSnapshot().userId);
export const marketplaceService = {
  ...catalog,
  async publishListing(...args: Parameters<typeof catalog.publishListing>) {
    const ownerId = getAccountSnapshot().userId;
    if (!ownerId) throw new Error('Sign in to publish your listing.');
    const account = await checkSellerEligibility();
    if (ownerId !== account.userId) throw new Error('Your account changed. Please try again.');
    return catalog.publishListing({ ...args[0], verified: true, seller: { id: ownerId, name: account.personal.fullName, memberSince: '' } }, args[1], args[2], args[3]);
  },
  saveDraft(...args: Parameters<typeof catalog.saveDraft>) {
    const account = getAccountSnapshot();
    return catalog.saveDraft({ ...args[0], verified: false, seller: { id: account.userId, name: account.personal.fullName, memberSince: '' } }, args[1], args[2], args[3]);
  },
};
