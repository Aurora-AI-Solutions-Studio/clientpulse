'use client';

import { useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mail,
  Video,
  XCircle,
} from 'lucide-react';
import type {
  IntegrationHealth,
  IntegrationProvider,
} from '@/lib/integrations/health';

const OAUTH_PROVIDERS: Array<{
  id: Exclude<IntegrationProvider, 'stripe'>;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  {
    id: 'gmail',
    label: 'Gmail',
    description: 'Read email thread metadata for engagement signals.',
    icon: Mail,
  },
  {
    id: 'calendar',
    label: 'Google Calendar',
    description: 'Detect meeting cadence + upcoming check-ins.',
    icon: Calendar,
  },
  {
    id: 'zoom',
    label: 'Zoom',
    description: 'Pull meeting recordings for transcription.',
    icon: Video,
  },
];

interface HealthResponse {
  health: IntegrationHealth[];
}

export function StepIntegrations() {
  const [health, setHealth] = useState<IntegrationHealth[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch('/api/integrations/health');
      if (res.ok) {
        const data: HealthResponse = await res.json();
        setHealth(data.health);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function statusFor(id: IntegrationProvider) {
    return health.find((h) => h.provider === id)?.status ?? 'disconnected';
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#c8d0e0]">
        Connect at least one data source so ClientPulse can compute
        engagement signals. You can skip any and come back later from
        Settings → Integrations.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-[#7a88a8] py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Checking connections…
        </div>
      ) : (
        <ul className="space-y-2">
          {OAUTH_PROVIDERS.map((p) => {
            const status = statusFor(p.id);
            const healthy = status === 'healthy';
            const Icon = p.icon;
            return (
              <li
                key={p.id}
                className="flex items-center gap-3 p-3 bg-[#1a2540]/30 rounded-lg border border-[#1a2540]"
              >
                <Icon className="w-5 h-5 text-[#c8d0e0] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {p.label}
                    </span>
                    {healthy && (
                      <CheckCircle2 className="w-4 h-4 text-[#38e8c8]" />
                    )}
                    {status === 'error' && (
                      <XCircle className="w-4 h-4 text-[#e74c3c]" />
                    )}
                  </div>
                  <p className="text-xs text-[#7a88a8] mt-0.5">{p.description}</p>
                </div>
                {healthy ? (
                  <span className="text-xs text-[#38e8c8]">Connected</span>
                ) : (
                  <a
                    href={`/api/integrations/${p.id}`}
                    className="text-xs bg-[#38e8c8]/10 border border-[#38e8c8]/30 text-[#38e8c8] hover:bg-[#38e8c8]/20 px-2 py-1 rounded transition-colors inline-flex items-center gap-1"
                  >
                    Connect
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-[#7a88a8]">
        Already connected? Hit Continue. We&apos;ll re-check when the
        first Monday Brief runs.
      </p>
    </div>
  );
}
