'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Mail, Loader2 } from 'lucide-react';

export function StepFirstBrief({ agencyId }: { agencyId: string | null }) {
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onGenerate() {
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch('/api/monday-brief', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Generate failed (${res.status})`);
        return;
      }
      setGenerated(true);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#c8d0e0]">
        The Monday Brief is a weekly portfolio snapshot with proposals
        you can accept. Generate your first one now so ClientPulse has
        something to work with.
      </p>

      {!agencyId && (
        <p className="text-xs text-[#e74c3c]">
          No agency on your profile yet — reach out to support.
        </p>
      )}

      {generated ? (
        <div className="p-3 bg-[#1a2540]/30 rounded-lg border border-[#1a2540]">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-[#38e8c8]" />
            <span className="text-sm text-white">First Monday Brief generated</span>
          </div>
          <p className="text-xs text-[#7a88a8] mb-3">
            Open the Brief to review, or finish onboarding and see proposals
            on the dashboard.
          </p>
          <Link
            href="/dashboard/brief"
            className="text-xs text-[#38e8c8] hover:underline inline-flex items-center gap-1"
          >
            <Mail className="w-3 h-3" /> View Monday Brief
          </Link>
        </div>
      ) : (
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating || !agencyId}
          className="text-sm bg-[#38e8c8]/15 border border-[#38e8c8]/40 text-[#38e8c8] hover:bg-[#38e8c8]/25 px-4 py-2 rounded transition-colors inline-flex items-center gap-2 disabled:opacity-50"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Generating…
            </>
          ) : (
            <>
              <Mail className="w-4 h-4" /> Generate first Monday Brief
            </>
          )}
        </button>
      )}

      {error && <p className="text-xs text-[#e74c3c]">{error}</p>}

      <p className="text-xs text-[#7a88a8]">
        You can re-generate anytime from the Monday Brief page; briefs also
        run automatically every Monday.
      </p>
    </div>
  );
}
