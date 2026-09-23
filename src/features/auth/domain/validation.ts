export type LoginValues = {
  username: string;
  password: string;
};

export type RegistrationValues = {
  firstName: string;
  middleName: string;
  lastName: string;
  phone: string;
  email: string;
  purok: string;
  barangay: string;
  municipalityCity: string;
  province: string;
  postalCode: string;
  password: string;
  confirmPassword: string;
};

export type RegistrationFieldErrors = Partial<
  Record<keyof RegistrationValues | 'terms', string>
>;

export function validateLogin(values: LoginValues): string | null {
  if (!values.username.trim() || !values.password) {
    return 'Enter your username and password.';
  }
  return null;
}

export function validateRegistrationFields(
  values: RegistrationValues,
  acceptedTerms: boolean,
): RegistrationFieldErrors {
  const errors: RegistrationFieldErrors = {};

  if (!values.firstName.trim()) errors.firstName = 'First name is required.';
  if (!values.lastName.trim()) errors.lastName = 'Last name is required.';
  if (!values.phone.trim()) errors.phone = 'Phone number is required.';
  if (!values.email.trim()) {
    errors.email = 'Email address is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  if (!values.purok.trim()) errors.purok = 'Purok or street is required.';
  if (!values.barangay.trim()) errors.barangay = 'Barangay is required.';
  if (!values.municipalityCity.trim()) errors.municipalityCity = 'Municipality or city is required.';
  if (!values.province.trim()) errors.province = 'Province is required.';

  if (!values.postalCode.trim()) {
    errors.postalCode = 'Postal code is required.';
  } else if (!/^\d{4}$/.test(values.postalCode.trim())) {
    errors.postalCode = 'Postal code must contain four digits.';
  }

  if (!values.password) errors.password = 'Password is required.';
  if (!values.confirmPassword) {
    errors.confirmPassword = 'Confirm your password.';
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  if (!acceptedTerms) {
    errors.terms = 'Please agree to the terms and privacy policy.';
  }

  return errors;
}

export function validateRegistration(
  values: RegistrationValues,
  acceptedTerms: boolean,
): string | null {
  return Object.values(validateRegistrationFields(values, acceptedTerms))[0] ?? null;
}
