import { isDavaoDelNorteLocality } from '@/constants/davao_del_norte';
import { isBarangayInLocality } from '@/constants/davao_del_norte_barangays';
import type { PersonalInformation } from './account';

export type AddressErrors = Partial<Record<'city' | 'barangay' | 'street' | 'postalCode', string>>;

export function validatePersonalAddress(values: PersonalInformation): AddressErrors {
  const errors: AddressErrors = {};
  if (!isDavaoDelNorteLocality(values.city)) errors.city = 'Choose a city or municipality in Davao del Norte.';
  if (!isBarangayInLocality(values.city, values.barangay ?? '')) errors.barangay = 'Choose a barangay in the selected city or municipality.';
  if (!values.street?.trim()) errors.street = 'Purok is required.';
  else if (values.street.trim().length > 150) errors.street = 'Keep your purok within 150 characters.';
  if (!/^\d{4}$/.test(values.postalCode?.trim() ?? '')) errors.postalCode = 'Enter a four-digit postal code.';
  return errors;
}

export function updatePersonalInformation<K extends keyof PersonalInformation>(values: PersonalInformation, key: K, value: PersonalInformation[K]): PersonalInformation {
  return { ...values, [key]: value, ...(key === 'city' && value !== values.city ? { barangay: '' } : {}) };
}

export function profileAddress(values: { purok?: string; street?: string; barangay?: string; city: string }): string {
  return [values.purok ?? values.street, values.barangay, values.city].map((part) => part?.trim()).filter(Boolean).join(', ');
}
