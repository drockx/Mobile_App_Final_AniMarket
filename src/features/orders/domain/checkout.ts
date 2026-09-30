import type { ListingPriceUnit, LivestockCategory } from '@/features/marketplace/domain/listing';
import { copyLocation, locationIssue, sameCity, type Coordinate, type SelectedLocation } from '../../location/domain/location';

export const PICKUP_TIMES = ['8:00 AM–10:00 AM', '10:00 AM–12:00 PM', '1:00 PM–3:00 PM', '3:00 PM–4:00 PM'] as const;
export const DELIVERY_PROVINCES = ['Davao del Norte'] as const;
export const TRANSPORT_ESTIMATE = { min: 2500, max: 3500 } as const;
export type CheckoutItem = {
  id: string;
  title: string;
  weight: string;
  health: string;
  seller: string;
  sellerAddress: string;
  price: number;
  priceUnit?: ListingPriceUnit;
  imageUri?: string;
  availability?: string;
  unavailablePickupDays?: readonly number[];
  category?: LivestockCategory;
  listingReference?: string;
  verified?: boolean;
  vaccinationProofName?: string;
  healthVerified?: boolean;
};
export type CheckoutForm = {
  fulfillment: 'pickup' | 'delivery';
  payment: 'cod' | 'seller';
  pickupDate: string;
  pickupTime: string;
  deliveryDate: string;
  receiver: string;
  phone: string;
  street: string;
  barangay: string;
  city: string;
  province: string;
  postal: string;
  landmark: string;
  notes: string;
  accessibleDestination: boolean;
  deliveryLocation: SelectedLocation | null;
};
export type CheckoutErrors = Partial<Record<keyof CheckoutForm | 'listing', string>>;
export type CheckoutDraft = {
  item: CheckoutItem;
  payment: CheckoutForm['payment'];
  fulfillment: CheckoutForm['fulfillment'];
  pickup: { date: string; time: string } | null;
  delivery: { date: string; receiver: string; phone: string; street: string; barangay: string; city: string; province: string; postal: string; landmark: string; notes: string; accessibleDestination: true; location: SelectedLocation; feeMin: number; feeMax: number } | null;
  totalMin: number;
  totalMax: number;
};
export type OrderRequest = {
  id: string;
  createdAt: string;
  status: 'saved-locally' | 'awaiting-seller' | 'cancelled';
  cancelledAt?: string;
  pickupPin?: Coordinate;
  draft: CheckoutDraft;
};
export type SaveOrderResult = { request: OrderRequest | null; error: string | null };

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function tomorrowKey(now = new Date()): string {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return dateKey(tomorrow);
}

export function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function livestockAmount(item: CheckoutItem): number | null {
  if (!Number.isFinite(item.price) || item.price <= 0) return null;
  if (item.priceUnit !== 'per kg') return item.price;
  const weight = item.weight.trim().match(/^(\d+(?:\.\d+)?)\s*kg$/i);
  const kg = weight ? Number(weight[1]) : 0;
  const amount = Math.round(item.price * kg * 100) / 100;
  return kg > 0 && Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function checkoutTotals(item: CheckoutItem, fulfillment: CheckoutForm['fulfillment']) {
  const amount = livestockAmount(item);
  return amount === null ? null : {
    livestock: amount,
    min: Math.round((amount + (fulfillment === 'delivery' ? TRANSPORT_ESTIMATE.min : 0)) * 100) / 100,
    max: Math.round((amount + (fulfillment === 'delivery' ? TRANSPORT_ESTIMATE.max : 0)) * 100) / 100,
  };
}

export function validateCheckout(form: CheckoutForm, item: CheckoutItem, now = new Date()): CheckoutErrors {
  const errors: CheckoutErrors = {};
  if (livestockAmount(item) === null) errors.listing = 'Ask the seller to confirm a valid price and live weight before reviewing this order.';
  const dateField = form.fulfillment === 'pickup' ? 'pickupDate' : 'deliveryDate';
  const date = parseDate(form[dateField]);
  if (!date || form[dateField] < tomorrowKey(now)) errors[dateField] = 'Choose a date from tomorrow onward.';
  else if (form.fulfillment === 'pickup' && item.unavailablePickupDays?.includes(date.getDay())) errors.pickupDate = 'Choose a day when the seller is available.';
  if (form.fulfillment === 'pickup') {
    if (!PICKUP_TIMES.some((time) => time === form.pickupTime)) errors.pickupTime = 'Select a preferred pickup time.';
  } else {
    for (const [key, label] of [['receiver', 'receiver name'], ['street', 'purok or street'], ['barangay', 'barangay'], ['city', 'municipality or city']] as const) {
      if (!form[key].trim()) errors[key] = `Enter the ${label}.`;
    }
    if (!/^(?:09\d{9}|\+?639\d{9})$/.test(form.phone.replace(/[\s()-]/g, ''))) errors.phone = 'Enter a valid Philippine mobile number.';
    if (!DELIVERY_PROVINCES.some((province) => province === form.province)) errors.province = 'Select a delivery province.';
    if (!/^\d{4}$/.test(form.postal.trim())) errors.postal = 'Enter a four-digit postal code.';
    if (!form.accessibleDestination) errors.accessibleDestination = 'Confirm vehicle access and an adult receiver.';
    const issue = locationIssue(form.deliveryLocation, DELIVERY_PROVINCES);
    if (issue) errors.deliveryLocation = issue;
    else if (form.deliveryLocation?.address?.province && form.deliveryLocation.address.province !== form.province) errors.deliveryLocation = 'Confirm a pin in the selected delivery province.';
    else if (form.deliveryLocation?.address?.city && !sameCity(form.deliveryLocation.address.city, form.city, form.province)) errors.deliveryLocation = 'Confirm a pin in the selected delivery city or municipality.';
  }
  if (form.payment !== 'cod' && form.payment !== 'seller') errors.payment = 'Select a payment arrangement.';
  return errors;
}

export function emptyCheckoutForm(receiver = '', phone = ''): CheckoutForm {
  return { fulfillment: 'pickup', payment: 'cod', pickupDate: '', pickupTime: '', deliveryDate: '', receiver, phone, street: '', barangay: '', city: '', province: 'Davao del Norte', postal: '', landmark: '', notes: '', accessibleDestination: false, deliveryLocation: null };
}

export function updateCheckoutField<K extends keyof CheckoutForm>(form: CheckoutForm, key: K, value: CheckoutForm[K]): CheckoutForm {
  const address = form.deliveryLocation?.address;
  const changedArea = (key === 'city' && address?.city && !sameCity(String(value), address.city, address.province ?? form.province))
    || (key === 'province' && address?.province && address.province !== value);
  return { ...form, [key]: value, ...(changedArea ? { deliveryLocation: null } : {}) };
}

export function selectDeliveryLocation(form: CheckoutForm, location: SelectedLocation): CheckoutForm {
  const address = location.address;
  const changedArea = !!((address?.city && form.city && !sameCity(address.city, form.city, address.province ?? form.province)) || (address?.province && form.province && address.province !== form.province));
  return { ...form, deliveryLocation: copyLocation(location),
    street: address?.street ?? (changedArea ? '' : form.street), barangay: address?.barangay ?? (changedArea ? '' : form.barangay),
    city: address?.city ?? form.city,
    province: address?.province && DELIVERY_PROVINCES.some((province) => province === address.province) ? address.province : form.province,
    postal: address?.postalCode && /^\d{4}$/.test(address.postalCode) ? address.postalCode : changedArea ? '' : form.postal,
    landmark: changedArea ? '' : form.landmark,
  };
}
