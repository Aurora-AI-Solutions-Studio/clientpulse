// Health is no longer its own destination. Score, predictions, and alerts
// are layers inside the per-client page. The clients list is the canonical
// entry point for any score lens. This file keeps old bookmarks working.

import { redirect } from 'next/navigation';

export default function HealthRedirect() {
  redirect('/dashboard/clients');
}
