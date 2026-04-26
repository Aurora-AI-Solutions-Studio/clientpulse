import Link from 'next/link';
import { CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface AcceptedPageProps {
  searchParams: Promise<{
    status?: string;
    reason?: string;
    id?: string;
    title?: string;
    variant?: string;
  }>;
}

const ERROR_MESSAGES: Record<string, string> = {
  malformed: 'This link is not in the right shape. Try the dashboard instead.',
  'wrong-version': 'This link is from an older version of the email. Open the latest brief.',
  'bad-signature': "This link doesn't match what we sent. Don't accept it.",
  expired: 'This link expired (24 hours). Open the latest brief and accept from there.',
  'brief-missing': 'The brief this link came from is no longer available.',
  'action-missing': 'This proposal is no longer in the brief.',
  ownership: 'This proposal points to a client that is no longer in your agency.',
  validation: "This proposal couldn't be turned into an action item.",
  'server-error': 'Something went wrong on our end. Please try the dashboard.',
};

export default async function AcceptedPage({ searchParams }: AcceptedPageProps) {
  const params = await searchParams;
  const ok = params.status === 'ok';
  const variant = params.variant ?? 'created';
  const title = (params.title ?? '').trim();
  const reason = (params.reason ?? 'server-error').trim();
  const message = ERROR_MESSAGES[reason] ?? ERROR_MESSAGES['server-error'];

  if (ok) {
    return (
      <div className="space-y-6">
        <Card className="border-green-500/40 bg-green-500/5">
          <CardContent className="p-8 flex items-start gap-4">
            <CheckCircle2 className="w-8 h-8 text-green-400 mt-1 shrink-0" />
            <div className="flex-1">
              <h1 className="text-2xl font-semibold text-white mb-1">
                {variant === 'already-accepted'
                  ? 'Already in your action items'
                  : 'Added to your action items'}
              </h1>
              {title && (
                <p className="text-base text-[#9aa6c0] mb-3">&ldquo;{title}&rdquo;</p>
              )}
              <p className="text-sm text-[#7a88a8]">
                {variant === 'already-accepted'
                  ? "You'd already accepted this one — no duplicates created."
                  : 'It now lives on your action-items list and shows up in the next brief.'}
              </p>
            </div>
          </CardContent>
        </Card>
        <div className="flex items-center gap-3 flex-wrap">
          <Button asChild className="bg-[#e74c3c] hover:bg-[#c0392b]">
            <Link href="/dashboard/action-items">
              Open action items
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/brief">Back to brief</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="p-8 flex items-start gap-4">
          <AlertCircle className="w-8 h-8 text-amber-400 mt-1 shrink-0" />
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-white mb-2">
              Couldn&rsquo;t accept from email
            </h1>
            <p className="text-sm text-[#9aa6c0] mb-3">{message}</p>
            <p className="text-xs text-[#5a6883]">Reason code: {reason}</p>
          </div>
        </CardContent>
      </Card>
      <div className="flex items-center gap-3 flex-wrap">
        <Button asChild className="bg-[#e74c3c] hover:bg-[#c0392b]">
          <Link href="/dashboard/proposals">
            Open proposals
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/brief">Open brief</Link>
        </Button>
      </div>
    </div>
  );
}
