import { createMessageService } from './application/message_service';
import { apiMessageRepository } from './data/api_message_repository';
import { getAccountSnapshot, subscribeAccount } from '../profile/profile_store';
import { getAccessToken } from '@/services/api';
import { firebaseEnabled } from '@/services/firebase_config';
import { firebaseMessageRepository } from './data/firebase_message_repository';

export const messageService = createMessageService(firebaseEnabled ? firebaseMessageRepository : apiMessageRepository);
function connectAccount() {
  const account = getAccountSnapshot();
  messageService.connect(account.signedIn ? account.userId : '', getAccessToken() ?? '');
}
subscribeAccount(connectAccount);
connectAccount();
