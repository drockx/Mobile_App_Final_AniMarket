import type { DavaoDelNorteLocality } from '@/constants/davao_del_norte';
import type { IdentityVerification } from './identity_verification';

export type PersonalInformation = { fullName: string; email: string; phone: string; city: DavaoDelNorteLocality | ''; street?: string; barangay?: string; postalCode?: string };
export type Account = { id: string; username: string; personal: PersonalInformation; verification: IdentityVerification; isReviewer: boolean; isStaff?: boolean; avatarVersion: string | null };
export type AccountSession = { token: string; account: Account };
