import { Pressable, Text, View } from 'react-native';
import { verificationLabels } from '../domain/identity_verification';
import { useAccount } from '../profile_store';
import { AccountScreenLayout } from './components/account_screen_layout';
import { verificationStyles as s } from './components/verification_styles';

export function SellerVerificationRequiredScreen({ onBack, onVerify }: { onBack: () => void; onVerify: () => void }) {
  const account = useAccount();
  return <AccountScreenLayout title="Create Listing" subtitle="Verify your identity before publishing livestock for sale." onBack={onBack}>
    <View style={s.card}>
      <Text style={s.title}>{verificationLabels[account.verification.status]}</Text>
      <Text style={s.body}>{account.verification.status === 'pending' ? 'Your ID is waiting for review. You can create a listing after it is approved.' : 'Submit a clear photo of your National ID or another valid photo ID. Your account name must match the ID.'}</Text>
      <Pressable accessibilityRole="button" onPress={onVerify} style={s.button}><Text style={s.buttonText}>{account.verification.status === 'pending' ? 'View Verification' : 'Verify Account'}</Text></Pressable>
    </View>
  </AccountScreenLayout>;
}
