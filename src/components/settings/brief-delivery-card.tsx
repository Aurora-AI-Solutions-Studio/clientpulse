'use client';

import { useEffect, useState } from 'react';
import { Check, Clock, RefreshCw } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const HOUR_OPTIONS: number[] = Array.from({ length: 24 }, (_, i) => i);

const formatHour = (h: number): string => {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
};

const SHORTLIST_TIMEZONES: Array<{ id: string; label: string }> = [
  { id: 'America/Los_Angeles', label: 'Pacific (Los Angeles)' },
  { id: 'America/Denver', label: 'Mountain (Denver)' },
  { id: 'America/Chicago', label: 'Central (Chicago)' },
  { id: 'America/New_York', label: 'Eastern (New York)' },
  { id: 'America/Toronto', label: 'Eastern (Toronto)' },
  { id: 'America/Sao_Paulo', label: 'São Paulo' },
  { id: 'Europe/London', label: 'London' },
  { id: 'Europe/Berlin', label: 'Berlin' },
  { id: 'Europe/Madrid', label: 'Madrid' },
  { id: 'Europe/Athens', label: 'Athens' },
  { id: 'Asia/Dubai', label: 'Dubai' },
  { id: 'Asia/Kolkata', label: 'Kolkata' },
  { id: 'Asia/Singapore', label: 'Singapore' },
  { id: 'Asia/Tokyo', label: 'Tokyo' },
  { id: 'Australia/Sydney', label: 'Sydney' },
  { id: 'Pacific/Auckland', label: 'Auckland' },
];

interface Prefs {
  timezone: string;
  briefSendHour: number;
}

export function BriefDeliveryCard() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [draft, setDraft] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/profile/preferences', { cache: 'no-store' });
        if (!res.ok) {
          if (!cancelled) setError('Failed to load preferences');
          return;
        }
        const data = (await res.json()) as Prefs;
        if (!cancelled) {
          setPrefs(data);
          setDraft(data);
        }
      } catch {
        if (!cancelled) setError('Failed to load preferences');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !draft) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Brief delivery</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const dirty = !prefs || prefs.timezone !== draft.timezone || prefs.briefSendHour !== draft.briefSendHour;

  // Make sure the user's stored timezone shows up in the picker even if
  // it isn't on the shortlist (e.g. an OAuth signup who detected an
  // unusual zone).
  const tzList = SHORTLIST_TIMEZONES.some((t) => t.id === draft.timezone)
    ? SHORTLIST_TIMEZONES
    : [{ id: draft.timezone, label: draft.timezone }, ...SHORTLIST_TIMEZONES];

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/profile/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Failed to save');
        return;
      }
      const next = (await res.json()) as Prefs;
      setPrefs(next);
      setDraft(next);
      setSavedAt(Date.now());
    } catch {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#7a88a8]" />
          Brief delivery
        </CardTitle>
        <CardDescription>
          Your Monday Brief lands at this local time. We track the IANA zone
          so daylight-saving transitions don&apos;t shift the send hour.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-white mb-2">Timezone</label>
          <select
            className="w-full px-4 py-2 bg-[#1a2540] border border-[#1a2540] rounded-lg text-white text-sm"
            value={draft.timezone}
            onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
          >
            {tzList.map((tz) => (
              <option key={tz.id} value={tz.id}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-white mb-2">Delivery time (Monday)</label>
          <select
            className="w-full px-4 py-2 bg-[#1a2540] border border-[#1a2540] rounded-lg text-white text-sm"
            value={draft.briefSendHour}
            onChange={(e) => setDraft({ ...draft, briefSendHour: Number(e.target.value) })}
          >
            {HOUR_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {formatHour(h)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={!dirty || saving}>
            {saving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              'Save'
            )}
          </Button>
          {savedAt && !dirty && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              Saved
            </span>
          )}
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
