import type { Conversation, ConversationSide } from '../domain/conversation';

export const mockConversations: readonly Conversation[] = [
  {
    id: 'juan-brahman',
    side: 'buying',
    participant: 'Juan Dela Cruz',
    initials: 'JD',
    listing: 'Brahman Bull (Pure Breed)',
    preview: 'Yes, it is still available. Are you ready to order?',
    time: '10:24 AM',
    unreadCount: 3,
    verifiedSeller: true,
  },
  {
    id: 'davao-landrace',
    side: 'buying',
    participant: 'Davao Swine Farm',
    initials: 'DF',
    listing: 'Landrace Pig (95 kg) · ANM-2026-171420',
    preview: 'The price per kg is ₱140. Delivery is available.',
    time: 'Yesterday',
    unreadCount: 0,
    verifiedSeller: true,
  },
  {
    id: 'elena-goat',
    side: 'buying',
    participant: 'Elena Mercado',
    initials: 'EP',
    listing: 'Native Goat · ANM-2026-170944',
    preview: 'Pickup is confirmed for Sep 24 at 9:00 AM.',
    time: 'Sep 20',
    unreadCount: 0,
    verifiedSeller: true,
  },
  {
    id: 'maria-native-goat',
    side: 'selling',
    participant: 'Maria Santos',
    initials: 'MS',
    listing: 'Native Goat',
    preview: 'Is the goat still available for pickup?',
    time: 'Yesterday',
    unreadCount: 1,
    verifiedSeller: false,
  },
];

// Sample notification totals shown in the supplied inbox design.
export const mockTabBadges: Record<ConversationSide, number> = { buying: 2, selling: 1 };
