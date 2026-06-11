/**
 * Mock conversation data for the Messages page.
 *
 * The display shape (`ConversationRowDisplay`, formerly `MockConversation`)
 * lives in `src/types/message.types.ts`. The inbox now renders live Supabase
 * data via `useMessagesContext()`; this fixture is kept for design/dev
 * reference only.
 */

import type { ConversationRowDisplay } from '@/types/message.types';

const face = (n: number) => `https://i.pravatar.cc/150?img=${n}`;
const circleImg = (seed: string) => `https://picsum.photos/seed/${seed}/150/150`;

export const MOCK_CONVERSATIONS: ConversationRowDisplay[] = [
  {
    id: 'lea-weber',
    name: 'Lea Weber',
    avatar: face(47),
    type: 'user',
    preview: "You reacted 😍 to “See you at the workshop on Tue!”",
    previewKind: 'reaction',
    timestamp: '16:14',
    isPinned: true,
    hasStoryRing: true,
  },
  {
    id: 'berlin-film-community',
    name: 'Berlin Film Community',
    avatar: circleImg('c-berlin-film-community'),
    type: 'circle',
    preview: 'Mira: 🎬 Documentary night this Saturday — RSVP by Fri',
    previewKind: 'text',
    timestamp: '19:45',
    hasMention: true,
    unreadCount: 3,
  },
  {
    id: 'eric-abraham',
    name: 'Eric Abraham',
    avatar: face(12),
    type: 'user',
    preview: 'Patch shared on the modular thread.',
    previewKind: 'text',
    isOwn: true,
    status: 'read',
    timestamp: '19:42',
  },
  {
    id: 'camille-laurent',
    name: 'Camille Laurent',
    avatar: face(32),
    type: 'user',
    preview: 'Loved your set last night 👀',
    previewKind: 'text',
    timestamp: '18:23',
  },
  {
    id: 'street-dance-berlin',
    name: 'Street Dance Berlin',
    avatar: circleImg('c-street-dance-berlin'),
    type: 'circle',
    preview: 'Voice message',
    previewKind: 'voice',
    timestamp: '16:15',
    unreadCount: 1,
  },
  {
    id: 'lena-hoffmann',
    name: 'Lena Hoffmann',
    avatar: face(45),
    type: 'user',
    preview: 'Studio',
    previewKind: 'location',
    timestamp: '14:02',
  },
  {
    id: 'marcus-veil',
    name: 'Marcus Veil',
    avatar: face(60),
    type: 'user',
    preview: 'On my way!',
    previewKind: 'text',
    isOwn: true,
    status: 'delivered',
    timestamp: 'Yesterday',
  },
  {
    id: 'women-in-tech',
    name: 'Women in Tech',
    avatar: circleImg('c-women-in-tech'),
    type: 'circle',
    preview: 'Sara: Talk on Friday — confirmed 🎉',
    previewKind: 'text',
    timestamp: 'Mon',
  },
  {
    id: 'yara-nouri',
    name: 'Yara Nouri',
    avatar: face(5),
    type: 'user',
    preview: 'Yara is typing...',
    previewKind: 'typing',
    timestamp: 'Mon',
  },
];

export function getConversationById(id?: string): ConversationRowDisplay | undefined {
  return MOCK_CONVERSATIONS.find((c) => c.id === id);
}
