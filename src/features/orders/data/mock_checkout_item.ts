import type { CheckoutItem } from '../domain/checkout';

// Standalone screen fixture from the supplied checkout reference.
export const mockCheckoutItem: CheckoutItem = {
  id: 'checkout-demo-brahman', title: 'Brahman Bull (Pure Breed)', weight: '450 kg', health: 'Vaccinated',
  price: 45000, seller: 'Juan Dela Cruz', sellerAddress: 'Purok 4, Brgy. San Isidro, Tagum City, Davao del Norte',
  availability: 'Monday–Saturday, 8:00 AM–4:00 PM', unavailablePickupDays: [0],
};
