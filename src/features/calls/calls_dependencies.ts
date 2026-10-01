import { createVoiceService } from './application/voice_service';
import { apiVoiceRepository } from './data/api_voice_repository';
import { createVoiceMedia } from './data/voice_media';
import { getAccountSnapshot, subscribeAccount } from '../profile/profile_store';
import { getAccessToken } from '@/services/api';

export const voiceService = createVoiceService(apiVoiceRepository, createVoiceMedia);
function connectAccount() {
  const account = getAccountSnapshot();
  voiceService.connect(account.signedIn ? account.userId : '', getAccessToken() ?? '');
}
subscribeAccount(connectAccount); connectAccount();
