// EU-27 detection helper. Mirrors contentpulse/lib/geo/eu.ts.
//
// Aurora's launch posture (CEO call 2026-04-28 evening): market
// globally, no hard geoblock. EU visitors see a non-blocking notice
// banner about EU AI Act enforcement (Aug 2, 2026); ToS prohibition
// on EU-person data is the contractual layer.

export const EU_COUNTRY_CODES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]);

export function isEuRequest(headers: Headers): boolean {
  const country = (headers.get('x-vercel-ip-country') ?? headers.get('cf-ipcountry') ?? '')
    .toUpperCase();
  if (!country || country === 'XX') return false;
  return EU_COUNTRY_CODES.has(country);
}
