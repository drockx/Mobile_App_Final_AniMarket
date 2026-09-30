import type { ListingPriceUnit, LivestockCategory } from './listing';

export type ListingStatus = 'active' | 'draft' | 'paused' | 'sold';
export type SellerListing = {
  id: string;
  title: string;
  category: LivestockCategory;
  status: ListingStatus;
  price: number;
  unit: ListingPriceUnit;
  details: string;
  location: string;
  weight: string;
  views: number;
  inquiries: number;
  updated: string;
  notice: string;
  imageUri?: string;
  orderId?: string;
};
