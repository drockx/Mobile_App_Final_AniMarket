import type { SellerListing } from '../domain/seller_listing';

export function createListingParams(listing?: SellerListing, continueDraft = false) {
  return listing ? {
    suggestedTitle: listing.title,
    suggestedCategory: { Cow: 'cattle', Goat: 'goat', Pig: 'swine', Chicken: 'poultry' }[listing.category],
    suggestedPrice: String(listing.price), suggestedWeight: listing.weight,
    suggestedUnit: listing.unit, draftId: continueDraft ? listing.id : undefined,
  } : {};
}
