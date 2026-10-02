import type { CheckoutItem } from '../../src/features/orders/domain/checkout';

// Test-only checkout input; excluded from the mobile build.
export const mockCheckoutItem: CheckoutItem = {
  id: 'checkout-demo-brahman', title: 'Brahman Bull (Pure Breed)', weight: '450 kg', health: 'Vaccinated',
  price: 45000, seller: 'Juan Dela Cruz', sellerAddress: 'Purok 4, Brgy. San Isidro, Tagum City, Davao del Norte',
  availability: 'Monday–Saturday, 8:00 AM–4:00 PM', unavailablePickupDays: [0],
  category: 'Cow', listingReference: 'ANM-2026-0148', verified: true,
  vaccinationProofName: 'Example vaccination record', healthVerified: true,
};
