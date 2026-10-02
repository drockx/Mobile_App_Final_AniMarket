import { createMessageService } from './application/message_service';
import { apiMessageRepository } from './data/api_message_repository';
import { getAccountSnapshot, subscribeAccount } from '../profile/profile_store';
import { getAccessToken } from '@/services/api';
import { firebaseEnabled } from '@/services/firebase_config';
import { firebaseMessageRepository } from './data/firebase_message_repository';

export const messageService = createMessageService(firebaseEnabled ? firebaseMessageRepository : apiMessageRepository);
function connectAccount() {
  const account = getAccountSnapshot();
  const customer = account.signedIn && !account.isStaff;
  messageService.connect(customer ? account.userId : '', customer ? getAccessToken() ?? '' : '');
}
subscribeAccount(connectAccount);
connectAccount();
