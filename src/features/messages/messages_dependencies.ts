import { createMessageService } from './application/message_service';
import { mockConversations, mockTabBadges } from './data/mock_conversations';

export const messageService = createMessageService(mockConversations, mockTabBadges);
