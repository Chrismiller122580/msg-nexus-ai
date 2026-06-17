import { Message } from './types';
import { generateId } from './utils';

const now = new Date();

function daysAgo(n: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  d.setHours(9 + Math.floor(Math.random() * 8), 20 + Math.floor(Math.random() * 30));
  return d.toISOString();
}

export const SEED_MESSAGES: Omit<Message, 'id'>[] = [
  {
    platformId: 'email',
    timestamp: daysAgo(0.2),
    from: 'Netflix <info@netflix.com>',
    subject: 'Your monthly subscription receipt',
    body: 'Thank you for being a member. Your subscription for Netflix Standard was billed $15.49 on Jun 12. This is a recurring monthly charge. Next bill on July 12.',
  },
  {
    platformId: 'whatsapp',
    timestamp: daysAgo(0.8),
    from: 'Mom',
    body: 'Can you send the rent money? Landlord wants it by the 5th. $1850 due this month. Thanks!',
  },
  {
    platformId: 'sms',
    timestamp: daysAgo(1.1),
    from: '+1 (555) 321-9982',
    body: 'Your electric bill is ready. Amount due: $142.87. Pay by June 20 to avoid late fee. Account #448291',
  },
  {
    platformId: 'email',
    timestamp: daysAgo(1.5),
    from: 'Amazon <ship-confirm@amazon.com>',
    subject: 'Your package has shipped',
    body: 'Order #392-8841023-221 for Wireless Headphones ($89.00) has shipped. Expected delivery June 18. Thanks for shopping with us.',
  },
  {
    platformId: 'slack',
    timestamp: daysAgo(2),
    from: 'Finance Alerts (bot)',
    body: 'New invoice received from Adobe. $59.99 for Creative Cloud annual plan (prorated month). Due in 7 days.',
  },
  {
    platformId: 'telegram',
    timestamp: daysAgo(2.4),
    from: 'Spotify',
    body: 'Hi there, your Spotify Premium family plan has renewed. $16.99 was charged automatically. Enjoy the music 🎵',
  },
  {
    platformId: 'imessage',
    timestamp: daysAgo(3),
    from: 'Sarah Chen',
    body: 'Just got the Target run for the party supplies. $67.42 total. I can Venmo split if you want.',
  },
  {
    platformId: 'email',
    timestamp: daysAgo(3.7),
    from: 'Xfinity <no-reply@xfinity.com>',
    subject: 'June statement for your Xfinity account',
    body: 'Internet + TV: $109.00 is due by June 25. Auto-pay is on. Thank you.',
  },
  {
    platformId: 'whatsapp',
    timestamp: daysAgo(4.2),
    from: 'Apartment Office',
    body: 'Reminder: Rent for July is $1850. Please pay by the 1st via the portal or check.',
  },
  {
    platformId: 'discord',
    timestamp: daysAgo(5),
    from: 'GitHub Bot',
    body: 'Your GitHub Pro subscription ($4.00/mo) will renew on the 28th. Update billing info here if needed.',
  },
  {
    platformId: 'x',
    timestamp: daysAgo(5.5),
    from: '@DoorDash',
    body: 'Your order from Shake Shack was delivered. $28.47 charged to your card ending 4242. Rate your order?',
  },
  {
    platformId: 'sms',
    timestamp: daysAgo(6.1),
    from: 'T-Mobile',
    body: 'Your monthly phone bill of $68.00 posted. Auto paid. Thanks for being a customer!',
  },
  {
    platformId: 'email',
    timestamp: daysAgo(7),
    from: 'Costco <members@costco.com>',
    subject: 'Your Costco membership renewal',
    body: 'Gold Star membership renewal: $60.00 for the year. Expires next month if not renewed.',
  },
  {
    platformId: 'slack',
    timestamp: daysAgo(8),
    from: 'Notion',
    body: 'Thanks! Your Notion Plus plan ($10/mo) has been successfully renewed. Team workspace remains active.',
  },
  {
    platformId: 'email',
    timestamp: daysAgo(9.5),
    from: 'PG&E <customerservice@pge.com>',
    subject: 'Your energy statement is available',
    body: 'Amount due: $87.34. Due date: June 19. View details and pay online.',
  },
  {
    platformId: 'whatsapp',
    timestamp: daysAgo(10),
    from: 'Work Group',
    body: 'Team lunch was $124. We split 4 ways. You owe $31. Ping me for Zelle.',
  },
  {
    platformId: 'imessage',
    timestamp: daysAgo(11),
    from: 'Alex Rivera',
    body: 'Uber to the airport last night: $41.75. Can you cover next time? 😂',
  },
  {
    platformId: 'email',
    timestamp: daysAgo(12),
    from: 'Dropbox <no-reply@dropbox.com>',
    subject: 'Receipt for Dropbox Plus',
    body: 'You were charged $11.99 for Dropbox Plus (monthly). Thank you for using Dropbox.',
  },
];

export function createSeedMessages(): Message[] {
  return SEED_MESSAGES.map((m) => ({
    ...m,
    id: generateId(),
  }));
}
