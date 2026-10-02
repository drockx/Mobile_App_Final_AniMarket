import { createVoiceService } from './application/voice_service';
import { apiVoiceRepository } from './data/api_voice_repository';
import { createVoiceMedia } from './data/voice_media';
import { getAccountSnapshot, subscribeAccount } from '../profile/profile_store';
import { getAccessToken } from '@/services/api';
import { firebaseEnabled } from '@/services/firebase_config';
import { firebaseVoiceRepository } from './data/firebase_voice_repository';

export const voiceService = createVoiceService(firebaseEnabled ? firebaseVoiceRepository : apiVoiceRepository, createVoiceMedia);
function connectAccount() {
  const account = getAccountSnapshot();
  const customer = account.signedIn && !account.isStaff;
  voiceService.connect(customer ? account.userId : '', customer ? getAccessToken() ?? '' : '');
}
subscribeAccount(connectAccount); connectAccount();
