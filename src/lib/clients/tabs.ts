// Per-client page tab contract — pure module, importable from anywhere
// without dragging in React/server-only deps. Tested by tests/lib/tabs.test.ts.
//
// The Sidebar drops standalone Health / Predictions / Alerts entries — they
// live inside this tab set instead. URL pattern: /dashboard/clients/[id]?tab=<id>

export const PER_CLIENT_TABS = [
  'signals',
  'actions',
  'health',
  'predictions',
  'alerts',
] as const;

export type PerClientTab = (typeof PER_CLIENT_TABS)[number];

export const DEFAULT_PER_CLIENT_TAB: PerClientTab = 'signals';

export function parsePerClientTab(input: string | null | undefined): PerClientTab {
  if (typeof input !== 'string') return DEFAULT_PER_CLIENT_TAB;
  return (PER_CLIENT_TABS as readonly string[]).includes(input)
    ? (input as PerClientTab)
    : DEFAULT_PER_CLIENT_TAB;
}
