export const validIdTypes = ['National ID', 'Passport', 'Driver’s license', 'UMID', 'Other valid photo ID'] as const;
export type ValidIdType = typeof validIdTypes[number];
export type IdentityVerification = {
  status: 'unverified' | 'pending' | 'verified' | 'rejected' | 'expired';
  idType?: ValidIdType;
  submittedAt?: string;
  reviewedAt?: string | null;
  reason?: string;
};
export const verificationLabels: Record<IdentityVerification['status'], string> = {
  unverified: 'Valid ID required', pending: 'ID under review', verified: 'Identity verified',
  rejected: 'New ID photo needed', expired: 'ID submission expired',
};
export type IdReview = { userId: string; submissionId: string; fullName: string; idType: ValidIdType; submittedAt: string; city?: string; photo?: string };
