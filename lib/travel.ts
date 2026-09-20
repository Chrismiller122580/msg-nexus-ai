/** One-off travel / logistics spend — never monthly burn. */

export const TRAVEL_VENDORS: Array<{ name: string; aliases: string[] }> = [
  { name: 'Uber', aliases: ['uber'] },
  { name: 'Lyft', aliases: ['lyft'] },
  { name: 'Airbnb', aliases: ['airbnb'] },
  { name: 'Booking.com', aliases: ['booking.com', 'bookingcom'] },
  { name: 'Expedia', aliases: ['expedia'] },
  { name: 'Hotels.com', aliases: ['hotels.com'] },
  { name: 'Marriott', aliases: ['marriott', 'bonvoy'] },
  { name: 'Hilton', aliases: ['hilton', 'hilton honors'] },
  { name: 'Hyatt', aliases: ['hyatt'] },
  { name: 'Delta', aliases: ['delta air', 'delta.com', 'delta airlines'] },
  { name: 'United', aliases: ['united airlines', 'united.com'] },
  { name: 'American Airlines', aliases: ['american airlines', 'aa.com'] },
  { name: 'Southwest', aliases: ['southwest airlines'] },
  { name: 'JetBlue', aliases: ['jetblue'] },
  { name: 'Spirit', aliases: ['spirit airlines'] },
  { name: 'Avianca', aliases: ['avianca'] },
  { name: 'LATAM', aliases: ['latam airlines', 'latam'] },
  { name: 'Copa', aliases: ['copa airlines'] },
  { name: 'Hertz', aliases: ['hertz'] },
  { name: 'Enterprise', aliases: ['enterprise rent'] },
  { name: 'Avis', aliases: ['avis'] },
  { name: 'Amtrak', aliases: ['amtrak'] },
  { name: 'VRBO', aliases: ['vrbo'] },
];

const TRAVEL_KEYWORDS = [
  'itinerary',
  'boarding pass',
  'e-ticket',
  'eticket',
  'flight confirmation',
  'flight itinerary',
  'check-in is now open',
  'hotel reservation',
  'hotel booking',
  'rental car',
  'car rental',
  'trip confirmation',
  'booking confirmation',
  'reservation confirmed',
  'departing',
  'departure',
  'arrival gate',
  'confirmation code',
  'pnr',
  'seat assignment',
  'checked bag',
  'airport',
  'round trip',
  'one way flight',
];

const FOOD_RIDE_SHARE = /\buber\s*eats\b|\bue\s+eats\b|\bdoordash\b|\bgrubhub\b/i;

export function looksLikeTravel(text: string, vendor?: string): boolean {
  const t = text.toLowerCase();
  if (FOOD_RIDE_SHARE.test(t)) return false;
  if (vendor && TRAVEL_VENDORS.some((v) => v.name === vendor)) {
    if (vendor === 'Uber' && /\beats\b/.test(t)) return false;
    return true;
  }
  return TRAVEL_KEYWORDS.some((k) => t.includes(k));
}
