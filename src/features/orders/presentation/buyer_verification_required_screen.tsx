import { Pressable, Text, View } from 'react-native';
import { verificationLabels } from '@/features/profile/domain/identity_verification';
import { useAccount } from '@/features/profile/profile_store';
import { AccountScreenLayout } from '@/features/profile/presentation/components/account_screen_layout';
import { verificationStyles as s } from '@/features/profile/presentation/components/verification_styles';

export function BuyerVerificationRequiredScreen({ onBack, onVerify }: { onBack: () => void; onVerify: () => void }) {
  const account = useAccount();
  const pending = account.verification.status === 'pending';
  return <AccountScreenLayout title="Account Verification Required" subtitle="Verify your identity before placing an order." onBack={onBack}>
    <View style={s.card}>
      <Text style={s.title}>{account.loading ? 'Loading your account…' : verificationLabels[account.verification.status]}</Text>
      <Text style={s.body}>{pending ? 'Your ID is waiting for review. You can place an order after it is approved.' : 'Complete your address in Personal Information, then submit a valid photo ID for review. Your ID must be approved before you can order livestock.'}</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: account.loading }} disabled={account.loading} onPress={onVerify} style={[s.button, account.loading && s.disabled]}>
        <Text style={s.buttonText}>{pending ? 'View Verification' : 'Verify Account'}</Text>
      </Pressable>
    </View>
  </AccountScreenLayout>;
}
