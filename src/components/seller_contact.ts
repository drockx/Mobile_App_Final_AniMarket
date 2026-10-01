import * as Linking from 'expo-linking';
import { Alert } from 'react-native';
import { phoneUrl } from '@/utils/phone_url';

/** Only an explicitly public listing contact is eligible; private profile numbers are not copied. */
export function sellerPhoneAction(phone?: string): (() => void) | undefined {
  const url = phoneUrl(phone);
  return url ? () => { void Linking.openURL(url).catch(() => Alert.alert('Unable to open phone app', 'Use Message Seller to contact this seller.')); } : undefined;
}
