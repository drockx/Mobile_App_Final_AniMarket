import { emptyCheckoutForm, tomorrowKey, type CheckoutForm } from '../domain/checkout';

// Direct navigation displays the supplied reference with a valid future date.
export function createExampleReviewForm(now = new Date()): CheckoutForm {
  return {
    ...emptyCheckoutForm('Maria Santos', '0917 123 4567'), fulfillment: 'delivery',
    deliveryDate: tomorrowKey(now), street: 'Purok 2', barangay: 'Visayan Village',
    city: 'Tagum City', province: 'Davao del Norte', postal: '8100',
    landmark: 'Near barangay hall', notes: 'Call before arrival', accessibleDestination: true,
    // Illustrative city-centre pin for the explicitly labelled example order only.
    deliveryLocation: { coordinate: { latitude: 7.4482, longitude: 125.807 }, source: 'map', address: null },
  };
}
