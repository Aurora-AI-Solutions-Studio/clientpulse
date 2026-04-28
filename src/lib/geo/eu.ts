// EU-27 geoblock helpers — mirrors reforge/lib/geo/eu.ts.
//
// Aurora's launch posture is US + UK + CA + AU + NZ only. EU-27
// visitors are redirected to /eu-waitlist until HRAI compliance is
// in place (Aug 2, 2026 EU AI Act enforcement). UK / CH / NO / IS
// / LI are NOT in scope — they pass through.
//
// Detection uses Vercel's request geo (Cloudflare CF-IPCountry header
// passes through). Header lookup is the only path — no GeoLite2
// dependency. If the header is absent (local dev) we treat the
// request as non-EU (fail-open) so dev work isn't blocked.

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

export const EU_ALLOWED_PATHS = [
  '/eu-waitlist',
  '/api/eu-waitlist',
  '/robots.txt',
  '/sitemap.xml',
];

export function isEuAllowedPath(pathname: string): boolean {
  return EU_ALLOWED_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
