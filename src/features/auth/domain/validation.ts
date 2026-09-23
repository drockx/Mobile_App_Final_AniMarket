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

export function validateLogin(values: LoginValues): string | null {
  if (!values.username.trim() || !values.password) {
    return 'Enter your user name and password.';
  }
  return null;
}

export function validateRegistration(values: RegistrationValues, acceptedTerms: boolean): string | null {
  const requiredFields: (keyof RegistrationValues)[] = [
    'firstName', 'lastName', 'phone', 'email', 'purok', 'barangay',
    'municipalityCity', 'province', 'postalCode', 'password', 'confirmPassword',
  ];

  if (requiredFields.some((field) => !values[field].trim())) {
    return 'Complete all required fields.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    return 'Enter a valid email address.';
  }
  if (!/^\d{4}$/.test(values.postalCode.trim())) {
    return 'Postal code must contain four digits.';
  }
  if (values.password !== values.confirmPassword) {
    return 'Passwords do not match.';
  }
  if (!acceptedTerms) {
    return 'Please agree to the terms and privacy policy.';
  }
  return null;
}
