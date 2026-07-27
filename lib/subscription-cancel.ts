import type { Insight, Message } from './types';

/** Vendor-specific cancel guides for subscriptions detected in the inbox. */
export type CancelGuide = {
  key: string;
  displayName: string;
  /** Direct cancel / manage-subscription page when known */
  cancelUrl?: string;
  /** Account billing page fallback */
  manageUrl?: string;
  steps: string[];
  tips?: string[];
  /** Lowercase names/aliases used to match insight.vendor or message text */
  match: string[];
};

const GUIDES: CancelGuide[] = [
  {
    key: 'netflix',
    displayName: 'Netflix',
    cancelUrl: 'https://www.netflix.com/cancelplan',
    manageUrl: 'https://www.netflix.com/YourAccount',
    match: ['netflix', 'nflx'],
    steps: [
      'Sign in at netflix.com on the web (or open Account in the app).',
      'Open Account → Membership & Billing (or Membership).',
      'Choose Cancel Membership / Finish Cancellation.',
      'Confirm. Access usually continues until the end of the paid period.',
    ],
    tips: [
      'Cancel at least a day before renewal to avoid the next charge.',
      'Profiles and downloads may be removed after the period ends.',
    ],
  },
  {
    key: 'spotify',
    displayName: 'Spotify',
    cancelUrl: 'https://www.spotify.com/account/subscription/',
    manageUrl: 'https://www.spotify.com/account/overview/',
    match: ['spotify'],
    steps: [
      'Open spotify.com → Profile → Account (web is required to cancel on many plans).',
      'Go to Subscription / Manage your plan.',
      'Select Cancel Premium and confirm.',
      'You keep Premium until the billing period ends, then free tier.',
    ],
    tips: ['If you subscribed via Apple or Google, cancel in App Store / Play Store subscriptions.'],
  },
  {
    key: 'amazon',
    displayName: 'Amazon / Prime',
    cancelUrl: 'https://www.amazon.com/gp/primecentral',
    manageUrl: 'https://www.amazon.com/gp/css/homepage.html',
    match: ['amazon', 'amzn', 'prime'],
    steps: [
      'Go to Your Account → Memberships and subscriptions (or Prime Central).',
      'Select Prime Membership → Update, cancel, and more → End membership.',
      'For other Amazon subscriptions (Kindle, Music, Channels), open each membership and End.',
      'Confirm cancellation.',
    ],
    tips: ['Channel add-ons are separate from Prime — cancel each one individually.'],
  },
  {
    key: 'apple',
    displayName: 'Apple',
    cancelUrl: 'https://support.apple.com/billing',
    manageUrl: 'https://appleid.apple.com/account/manage',
    match: ['apple', 'itunes', 'app store', 'icloud', 'apple music', 'apple tv', 'apple one'],
    steps: [
      'On iPhone/iPad: Settings → [your name] → Subscriptions.',
      'On Mac: System Settings → [your name] → Media & Purchases → Manage.',
      'Or visit reportaproblem.apple.com → Subscriptions.',
      'Select the subscription → Cancel Subscription → Confirm.',
    ],
    tips: ['Family Sharing may show who pays — only the purchaser can cancel.'],
  },
  {
    key: 'google',
    displayName: 'Google / YouTube',
    cancelUrl: 'https://play.google.com/store/account/subscriptions',
    manageUrl: 'https://myaccount.google.com/payments-and-subscriptions',
    match: ['google', 'youtube', 'yt premium', 'youtube premium', 'google one', 'google play'],
    steps: [
      'Open play.google.com → Account → Payments & subscriptions → Subscriptions.',
      'Or on Android: Play Store → profile → Payments & subscriptions.',
      'Select YouTube Premium / Google One / etc. → Cancel subscription.',
      'Confirm. Benefits last until the end of the current cycle.',
    ],
  },
  {
    key: 'microsoft',
    displayName: 'Microsoft 365 / Xbox',
    cancelUrl: 'https://account.microsoft.com/services',
    manageUrl: 'https://account.microsoft.com/billing',
    match: ['microsoft', 'office', '365', 'xbox', 'game pass'],
    steps: [
      'Sign in at account.microsoft.com/services.',
      'Find Microsoft 365, Xbox Game Pass, or the product listed.',
      'Select Manage → Cancel → follow prompts.',
      'Choose to keep benefits until expiry if offered.',
    ],
  },
  {
    key: 'adobe',
    displayName: 'Adobe',
    cancelUrl: 'https://account.adobe.com/plans',
    manageUrl: 'https://account.adobe.com/',
    match: ['adobe', 'creative cloud', 'acrobat'],
    steps: [
      'Sign in at account.adobe.com → Plans.',
      'Select Manage plan → Cancel plan.',
      'Review any early termination fee (common on annual plans).',
      'Confirm cancellation.',
    ],
    tips: ['Annual plans paid monthly often charge remaining months if you cancel early.'],
  },
  {
    key: 'dropbox',
    displayName: 'Dropbox',
    cancelUrl: 'https://www.dropbox.com/account/plan',
    manageUrl: 'https://www.dropbox.com/account',
    match: ['dropbox'],
    steps: [
      'Open dropbox.com → avatar → Settings → Plan.',
      'Choose Cancel plan / Downgrade.',
      'Confirm. Files above free-tier limits may become read-only after expiry.',
    ],
  },
  {
    key: 'notion',
    displayName: 'Notion',
    cancelUrl: 'https://www.notion.so/my-account',
    manageUrl: 'https://www.notion.so/my-account',
    match: ['notion'],
    steps: [
      'Open Settings & members → Billing (or Plans).',
      'Select the workspace plan → Cancel plan / Downgrade.',
      'Confirm. Workspace owners manage billing.',
    ],
  },
  {
    key: 'github',
    displayName: 'GitHub',
    cancelUrl: 'https://github.com/settings/billing',
    manageUrl: 'https://github.com/settings/billing',
    match: ['github'],
    steps: [
      'Open GitHub → Settings → Billing and plans.',
      'Under Current plan, choose Edit → Cancel plan (or Downgrade).',
      'Confirm. Private repos stay available until the period ends on many plans.',
    ],
  },
  {
    key: 'disney',
    displayName: 'Disney+ / Hulu',
    cancelUrl: 'https://www.disneyplus.com/account',
    manageUrl: 'https://www.disneyplus.com/account',
    match: ['disney', 'disney+', 'hulu', 'espn+'],
    steps: [
      'Sign in on the web account page for Disney+ or Hulu.',
      'Open Account → Subscription / Billing → Cancel.',
      'Bundle plans (Disney Bundle) may need canceling as a package.',
    ],
  },
  {
    key: 'hbo',
    displayName: 'Max (HBO)',
    cancelUrl: 'https://auth.max.com/login',
    manageUrl: 'https://www.max.com/account',
    match: ['max', 'hbo', 'hbo max'],
    steps: [
      'Sign in on max.com → Account.',
      'Select Subscription → Cancel subscription.',
      'If billed through a partner (AT&T, Amazon, Apple), cancel with that provider.',
    ],
  },
  {
    key: 'uber',
    displayName: 'Uber One',
    cancelUrl: 'https://account.uber.com/membership',
    manageUrl: 'https://riders.uber.com',
    match: ['uber', 'uber one', 'uber eats'],
    steps: [
      'In the Uber app: Account → Uber One → Manage membership.',
      'Or use account.uber.com membership settings on the web.',
      'Select Cancel membership and confirm.',
    ],
  },
  {
    key: 'doordash',
    displayName: 'DoorDash DashPass',
    cancelUrl: 'https://www.doordash.com/consumer/edit_profile/',
    manageUrl: 'https://www.doordash.com/consumer/edit_profile/',
    match: ['doordash', 'dashpass', 'dash'],
    steps: [
      'Open DoorDash app or website → Account → DashPass.',
      'Select Manage → Cancel DashPass.',
      'Confirm. Benefits usually last until the billing date.',
    ],
  },
];

const GENERIC_STEPS = [
  'Search your email for “subscription”, “receipt”, or the vendor name to find the account you used.',
  'Sign in on the vendor’s website (web cancel is more reliable than in-app on many services).',
  'Open Account, Membership, Billing, or Subscriptions.',
  'Choose Cancel, End membership, or Downgrade — then confirm.',
  'Save a screenshot of the confirmation for your records.',
  'Check your bank/card statement after the next cycle to verify the charge stopped.',
];

const GENERIC_TIPS = [
  'If you paid via Apple App Store, Google Play, Amazon, or PayPal, cancel there — the vendor site may not control billing.',
  'Set a calendar reminder a day before the listed renewal if you are only pausing.',
  'MsgNexus only detects subscriptions from your messages; always confirm on the vendor’s site before canceling.',
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+.\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Resolve the best cancel guide for a vendor name and/or message body. */
export function getCancelGuide(vendor?: string | null, messageBody?: string): CancelGuide {
  const haystack = normalize([vendor || '', messageBody || ''].join(' '));

  let best: CancelGuide | undefined;
  let bestScore = 0;

  for (const guide of GUIDES) {
    let score = 0;
    for (const term of guide.match) {
      if (haystack.includes(term)) {
        score += term.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = guide;
    }
  }

  if (best && bestScore > 0) return best;

  const displayName = vendor?.trim() || 'This subscription';
  return {
    key: 'generic',
    displayName,
    steps: GENERIC_STEPS,
    tips: GENERIC_TIPS,
    match: [],
  };
}

export type SubscriptionCancelItem = {
  messageId: string;
  vendor: string;
  amount?: number;
  currency?: string;
  summary: string;
  guide: CancelGuide;
  from: string;
  timestamp: string;
};

/** Deduplicate subscription insights by vendor (keep highest amount / latest). */
export function buildSubscriptionCancelList(
  items: Array<{ message: Message; insight: Insight }>
): SubscriptionCancelItem[] {
  const byVendor = new Map<string, SubscriptionCancelItem>();

  for (const { message, insight } of items) {
    if (insight.category !== 'subscription' && !insight.isRecurring) continue;

    const vendor = insight.vendor?.trim() || message.from || 'Unknown';
    const key = normalize(vendor);
    const guide = getCancelGuide(insight.vendor, message.body);
    const entry: SubscriptionCancelItem = {
      messageId: message.id,
      vendor,
      amount: insight.amount,
      currency: insight.currency,
      summary: insight.summary,
      guide,
      from: message.from,
      timestamp: message.timestamp,
    };

    const existing = byVendor.get(key);
    if (!existing) {
      byVendor.set(key, entry);
      continue;
    }
    // Prefer entry with amount; then newer message
    const betterAmount =
      (entry.amount ?? 0) > (existing.amount ?? 0) ||
      (entry.amount != null && existing.amount == null);
    const newer = new Date(entry.timestamp).getTime() > new Date(existing.timestamp).getTime();
    if (betterAmount || (entry.amount === existing.amount && newer)) {
      byVendor.set(key, entry);
    }
  }

  return Array.from(byVendor.values()).sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
}
