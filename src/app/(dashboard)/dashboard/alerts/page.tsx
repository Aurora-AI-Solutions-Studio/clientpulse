// Alerts are now a tab inside each per-client page.

import { redirect } from 'next/navigation';

export default function AlertsRedirect() {
  redirect('/dashboard/clients');
}
