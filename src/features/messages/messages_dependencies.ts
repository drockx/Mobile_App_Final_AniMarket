import { createMessageService } from './application/message_service';
import { apiMessageRepository } from './data/api_message_repository';
import { getAccountSnapshot, subscribeAccount } from '../profile/profile_store';
import { getAccessToken } from '@/services/api';

export const messageService = createMessageService(apiMessageRepository);
function connectAccount() {
  const account = getAccountSnapshot();
  messageService.connect(account.signedIn ? account.userId : '', getAccessToken() ?? '');
}
subscribeAccount(connectAccount);
connectAccount();
