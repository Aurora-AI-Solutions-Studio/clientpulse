'use client';

import { useEffect, useState, useCallback } from 'react';
import { Check, AlertCircle, RefreshCw, Calendar, Mail, Unlink, ExternalLink, Clock, Video, Sparkles, Lock } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

interface User {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
}

interface StripeStatus {
  connected: boolean;
  accountId?: string;
  email?: string;
}

interface IntegrationConnection {
  id: string;
  provider: string;
  status: string;
  account_email?: string;
  account_name?: string;
  connected_at?: string;
  last_sync_at?: string;
  error?: string;
}

interface MeSummary {
  subscriptionPlan: string;
  subscriptionStatus: string;
  stripeCustomerId: string | null;
  tier: 'free' | 'solo' | 'pro' | 'agency';
  tierLabel: string;
  suiteAccess?: boolean;
}

interface SuiteStatus {
  enabled: boolean;
  signalsLast7d: number;
  lastSignalAt: string | null;
  mappedClientCount: number;
}

const TIER_DESCRIPTION: Record<MeSummary['tier'], string> = {
  free: 'Read-only · upgrade to add clients',
  solo: 'Up to 3 clients · 90-day retention · daily health refresh',
  pro: 'Up to 10 clients · 12-month retention · hourly refresh · 3 seats',
  agency: 'Unlimited clients · 36-month retention · real-time refresh · 8 seats',
};

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stripeStatus] = useState<StripeStatus>({ connected: false });
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [me, setMe] = useState<MeSummary | null>(null);
  const [suiteStatus, setSuiteStatus] = useState<SuiteStatus | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/connections');
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections || []);
      }
    } catch (error) {
      console.error('Error fetching connections:', error);
    }
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          setUser(user);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
    fetchConnections();
    void (async () => {
      try {
        const res = await fetch('/api/me', { cache: 'no-store' });
        if (res.ok) setMe(await res.json());
      } catch {
        // best-effort
      }
    })();
    void (async () => {
      try {
        const res = await fetch('/api/integrations/suite-status', { cache: 'no-store' });
        if (res.ok) setSuiteStatus(await res.json());
      } catch {
        // best-effort
      }
    })();

    // Check URL params for recently connected provider
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    if (connected) {
      fetchConnections();
      // Clean up URL
      window.history.replaceState({}, '', '/dashboard/settings');
    }
  }, [fetchConnections]);

  const getConnection = (provider: string) =>
    connections.find((c) => c.provider === provider && c.status === 'connected');

  const handleConnect = async (provider: 'google_calendar' | 'gmail' | 'zoom') => {
    setConnectingProvider(provider);
    try {
      const endpointMap: Record<string, string> = {
        google_calendar: '/api/integrations/calendar',
        gmail: '/api/integrations/gmail',
        zoom: '/api/integrations/zoom',
      };
      const endpoint = endpointMap[provider];
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error(`Error connecting ${provider}:`, error);
    } finally {
      setConnectingProvider(null);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    setDisconnectingId(connectionId);
    try {
      const res = await fetch(`/api/integrations/connections?connectionId=${connectionId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchConnections();
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
    } finally {
      setDisconnectingId(null);
    }
  };

  const handleSync = async (provider: 'google_calendar' | 'gmail' | 'zoom') => {
    setSyncingProvider(provider);
    try {
      const syncEndpointMap: Record<string, string> = {
        google_calendar: '/api/integrations/calendar/sync',
        gmail: '/api/integrations/gmail/sync',
        zoom: '/api/integrations/zoom/sync',
      };
      const endpoint = syncEndpointMap[provider];
      const res = await fetch(endpoint, { method: 'POST' });
      if (res.ok) {
        await fetchConnections();
      }
    } catch (error) {
      console.error(`Error syncing ${provider}:`, error);
    } finally {
      setSyncingProvider(null);
    }
  };

  const formatSyncTime = (iso?: string) => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#e74c3c] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#7a88a8]">Loading settings...</p>
        </div>
      </div>
    );
  }

  const calendarConn = getConnection('google_calendar');
  const gmailConn = getConnection('gmail');
  const zoomConn = getConnection('zoom');

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-bold text-white font-playfair mb-2">
          Settings
        </h2>
        <p className="text-[#7a88a8]">
          Manage your account settings and integrations
        </p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your account information and profile details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Email Address
            </label>
            <div className="flex items-center gap-3">
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="flex-1 px-4 py-2 bg-[#1a2540] border border-[#1a2540] rounded-lg text-white text-sm"
              />
              <span className="text-xs px-3 py-2 bg-green-500/10 text-green-400 rounded-lg flex items-center gap-1">
                <Check className="w-4 h-4" />
                Verified
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={user?.user_metadata?.full_name || ''}
              disabled
              className="w-full px-4 py-2 bg-[#1a2540] border border-[#1a2540] rounded-lg text-white text-sm"
              placeholder="Your full name"
            />
            <p className="text-xs text-[#7a88a8] mt-1">
              Update your profile in your Supabase account settings
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              User ID
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={user?.id || ''}
                disabled
                className="flex-1 px-4 py-2 bg-[#1a2540] border border-[#1a2540] rounded-lg text-white text-sm font-mono text-xs"
              />
              <button
                onClick={() => navigator.clipboard.writeText(user?.id || '')}
                className="px-3 py-2 bg-[#1a2540] hover:bg-[#252d3d] rounded-lg text-[#7a88a8] text-sm transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Communication Intelligence Integrations */}
      <Card>
        <CardHeader>
          <CardTitle>Communication Intelligence</CardTitle>
          <CardDescription>
            Connect your calendar and email to automatically track client engagement and enrich health scores
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Google Calendar */}
          <div className={`p-4 border rounded-lg transition-all ${
            calendarConn ? 'border-green-500/30 bg-green-500/5' : 'border-[#1a2540]'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Google Calendar</p>
                  {calendarConn ? (
                    <p className="text-xs text-green-400">
                      Connected as {calendarConn.account_email}
                    </p>
                  ) : (
                    <p className="text-xs text-[#7a88a8]">
                      Auto-detect client meetings, track frequency & attendance
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {calendarConn ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync('google_calendar')}
                      disabled={syncingProvider === 'google_calendar'}
                      className="text-blue-400 border-blue-500/20 hover:bg-blue-500/10"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncingProvider === 'google_calendar' ? 'animate-spin' : ''}`} />
                      {syncingProvider === 'google_calendar' ? 'Syncing...' : 'Sync Now'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect(calendarConn.id)}
                      disabled={disconnectingId === calendarConn.id}
                      className="text-red-400 border-red-500/20 hover:bg-red-500/10"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleConnect('google_calendar')}
                    disabled={connectingProvider === 'google_calendar'}
                  >
                    {connectingProvider === 'google_calendar' ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                        Connect
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            {calendarConn && (
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#1a2540]">
                <span className="flex items-center gap-1.5 text-xs text-[#7a88a8]">
                  <Clock className="w-3 h-3" />
                  Last sync: {formatSyncTime(calendarConn.last_sync_at)}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-[#7a88a8]">
                  <Check className="w-3 h-3 text-green-400" />
                  Connected {calendarConn.connected_at ? new Date(calendarConn.connected_at).toLocaleDateString() : ''}
                </span>
              </div>
            )}
          </div>

          {/* Gmail */}
          <div className={`p-4 border rounded-lg transition-all ${
            gmailConn ? 'border-green-500/30 bg-green-500/5' : 'border-[#1a2540]'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Gmail</p>
                  {gmailConn ? (
                    <p className="text-xs text-green-400">
                      Connected as {gmailConn.account_email}
                    </p>
                  ) : (
                    <p className="text-xs text-[#7a88a8]">
                      Track email volume, response times & client responsiveness
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {gmailConn ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync('gmail')}
                      disabled={syncingProvider === 'gmail'}
                      className="text-blue-400 border-blue-500/20 hover:bg-blue-500/10"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncingProvider === 'gmail' ? 'animate-spin' : ''}`} />
                      {syncingProvider === 'gmail' ? 'Syncing...' : 'Sync Now'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect(gmailConn.id)}
                      disabled={disconnectingId === gmailConn.id}
                      className="text-red-400 border-red-500/20 hover:bg-red-500/10"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleConnect('gmail')}
                    disabled={connectingProvider === 'gmail'}
                  >
                    {connectingProvider === 'gmail' ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                        Connect
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            {gmailConn && (
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#1a2540]">
                <span className="flex items-center gap-1.5 text-xs text-[#7a88a8]">
                  <Clock className="w-3 h-3" />
                  Last sync: {formatSyncTime(gmailConn.last_sync_at)}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-[#7a88a8]">
                  <Check className="w-3 h-3 text-green-400" />
                  Connected {gmailConn.connected_at ? new Date(gmailConn.connected_at).toLocaleDateString() : ''}
                </span>
              </div>
            )}
          </div>

          {/* Zoom */}
          <div className={`p-4 border rounded-lg transition-all ${
            zoomConn ? 'border-green-500/30 bg-green-500/5' : 'border-[#1a2540]'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-600/10 flex items-center justify-center">
                  <Video className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Zoom</p>
                  {zoomConn ? (
                    <p className="text-xs text-green-400">
                      Connected as {zoomConn.account_email}
                    </p>
                  ) : (
                    <p className="text-xs text-[#7a88a8]">
                      Sync meetings, recordings & participant data
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {zoomConn ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync('zoom')}
                      disabled={syncingProvider === 'zoom'}
                      className="text-blue-400 border-blue-500/20 hover:bg-blue-500/10"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncingProvider === 'zoom' ? 'animate-spin' : ''}`} />
                      {syncingProvider === 'zoom' ? 'Syncing...' : 'Sync Now'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect(zoomConn.id)}
                      disabled={disconnectingId === zoomConn.id}
                      className="text-red-400 border-red-500/20 hover:bg-red-500/10"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleConnect('zoom')}
                    disabled={connectingProvider === 'zoom'}
                  >
                    {connectingProvider === 'zoom' ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                        Connect
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            {zoomConn && (
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#1a2540]">
                <span className="flex items-center gap-1.5 text-xs text-[#7a88a8]">
                  <Clock className="w-3 h-3" />
                  Last sync: {formatSyncTime(zoomConn.last_sync_at)}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-[#7a88a8]">
                  <Check className="w-3 h-3 text-green-400" />
                  Connected {zoomConn.connected_at ? new Date(zoomConn.connected_at).toLocaleDateString() : ''}
                </span>
              </div>
            )}
          </div>

          {/* Privacy note */}
          <p className="text-xs text-[#7a88a8] px-1">
            ClientPulse only reads metadata (dates, attendees, subjects, participants). Email bodies, calendar descriptions, and recording audio are never stored.
          </p>
        </CardContent>
      </Card>

      {/* Aurora Suite — RF→CP signal pipeline (Slice 2C-2) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#e74c3c]" />
            Aurora Suite
          </CardTitle>
          <CardDescription>
            Cross-product signal pipeline. ReForge emits content velocity, pause/resume, voice freshness, approval latency, and ingestion rate per client; ClientPulse rolls them into health scoring and the Action Proposal Engine.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {suiteStatus?.enabled ? (
            <div className="rounded-lg border border-[#38e8c8]/30 bg-gradient-to-br from-[#1a2540]/60 via-[#1a2540]/40 to-[#38e8c8]/5 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#38e8c8]/10 flex items-center justify-center">
                    <Check className="w-5 h-5 text-[#38e8c8]" />
                  </div>
                  <div>
                    <p className="font-medium text-white">ReForge → ClientPulse</p>
                    <p className="text-xs text-[#38e8c8]">Connected · {suiteStatus.signalsLast7d} signal{suiteStatus.signalsLast7d === 1 ? '' : 's'} in the last 7 days</p>
                  </div>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-[#38e8c8]/10 text-[#38e8c8]">
                  Suite
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-[#1a2540]">
                <div>
                  <p className="text-xs text-[#7a88a8] mb-1">Mapped clients</p>
                  <p className="text-sm font-medium text-white">{suiteStatus.mappedClientCount}</p>
                </div>
                <div>
                  <p className="text-xs text-[#7a88a8] mb-1">Last signal received</p>
                  <p className="text-sm font-medium text-white">{formatSyncTime(suiteStatus.lastSignalAt ?? undefined)}</p>
                </div>
              </div>
              {suiteStatus.signalsLast7d === 0 && (
                <div className="flex items-start gap-2 mt-4 pt-4 border-t border-[#1a2540]">
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-[#7a88a8]">
                    No signals received this week. If ReForge has active content for these clients, the next scheduled emission will arrive shortly.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-[#1a2540] bg-[#1a2540]/30 p-4 opacity-90">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#1a2540] flex items-center justify-center">
                    <Lock className="w-5 h-5 text-[#7a88a8]" />
                  </div>
                  <div>
                    <p className="font-medium text-white">ReForge → ClientPulse</p>
                    <p className="text-xs text-[#7a88a8]">
                      Aurora Suite required. Combine ClientPulse with ReForge to get RF activity signals folded into your health scores and proposals.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end mt-4 pt-4 border-t border-[#1a2540]">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { window.location.href = '/dashboard/upgrade'; }}
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Upgrade to Suite
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Other Integrations */}
      <Card>
        <CardHeader>
          <CardTitle>Other Integrations</CardTitle>
          <CardDescription>
            Connect additional services to enhance insights
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stripe */}
          <div className="flex items-center justify-between p-4 border border-[#1a2540] rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#635bff]/10 flex items-center justify-center">
                <span className="text-[#635bff] font-bold text-sm">S</span>
              </div>
              <div>
                <p className="font-medium text-white">Stripe</p>
                <p className="text-xs text-[#7a88a8]">
                  {stripeStatus.connected
                    ? `Connected to ${stripeStatus.email}`
                    : 'Track payment health & invoice signals'}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className={
                stripeStatus.connected
                  ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border-green-500/20'
                  : ''
              }
            >
              {stripeStatus.connected ? 'Connected' : 'Connect'}
            </Button>
          </div>

          {/* Slack (Coming Soon) */}
          <div className="flex items-center justify-between p-4 border border-[#1a2540] rounded-lg opacity-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#36c5f0]/10 flex items-center justify-center">
                <span className="text-[#36c5f0] font-bold text-sm">S</span>
              </div>
              <div>
                <p className="font-medium text-white">Slack</p>
                <p className="text-xs text-[#7a88a8]">Coming soon</p>
              </div>
            </div>
            <Button variant="outline" size="sm" disabled>
              Coming Soon
            </Button>
          </div>

        </CardContent>
      </Card>

      {/* Subscription & Billing */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription & Billing</CardTitle>
          <CardDescription>
            Manage your plan and billing information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-white mb-4">Current Plan</h3>
            <div className="border border-[#1a2540] rounded-lg p-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-lg font-semibold text-white">
                    {me?.tierLabel ?? 'Free'} Plan
                  </p>
                  <p className="text-xs text-[#7a88a8] mt-1">
                    {TIER_DESCRIPTION[me?.tier ?? 'free']}
                  </p>
                </div>
                <span
                  className={`text-xs px-3 py-1 rounded-full capitalize ${
                    me?.subscriptionStatus === 'active'
                      ? 'bg-green-500/10 text-green-400'
                      : me?.subscriptionStatus === 'past_due'
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-[#e74c3c]/10 text-[#e74c3c]'
                  }`}
                >
                  {me?.subscriptionStatus ?? 'active'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {me?.tier && me.tier !== 'free' && me.stripeCustomerId && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={portalLoading}
                    onClick={async () => {
                      setPortalLoading(true);
                      try {
                        const res = await fetch('/api/stripe/portal', { method: 'POST' });
                        const data = await res.json().catch(() => ({}));
                        if (data.url) window.location.href = data.url;
                      } finally {
                        setPortalLoading(false);
                      }
                    }}
                  >
                    {portalLoading ? 'Opening…' : 'Manage billing'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { window.location.href = '/dashboard/upgrade'; }}
                >
                  {me?.tier === 'agency' ? 'Compare plans' : 'Upgrade'}
                </Button>
              </div>
            </div>
          </div>

          {(!me || me.tier === 'free') && (
            <div className="bg-[#1a2540]/30 border border-[#e74c3c]/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#e74c3c] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-white mb-1">
                    Upgrade to unlock more features
                  </p>
                  <p className="text-sm text-[#7a88a8] mb-3">
                    Get access to unlimited clients, advanced health scoring, and
                    integrations.
                  </p>
                  <Button
                    className="bg-[#e74c3c] hover:bg-[#c0392b] text-white text-sm"
                    onClick={() => { window.location.href = '/dashboard/upgrade'; }}
                  >
                    View Plans
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-white mb-3">
              Billing History
            </h3>
            <div className="space-y-2 text-sm">
              <p className="text-[#7a88a8]">
                {me?.tier && me.tier !== 'free'
                  ? 'View invoices in the Stripe Billing Portal (click Manage billing above).'
                  : 'No billing history yet. Your account is on the Free plan.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            Choose how and when you receive updates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            {
              label: 'Email Alerts',
              description: 'Receive alerts when clients reach at-risk status',
              enabled: true,
            },
            {
              label: 'Weekly Summary',
              description: 'Get a summary of your clients every Monday',
              enabled: true,
            },
            {
              label: 'Churn Notifications',
              description: 'Immediate notification when a client might churn',
              enabled: false,
            },
            {
              label: 'Product Updates',
              description: 'Receive news about new ClientPulse features',
              enabled: false,
            },
          ].map((notification, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 border border-[#1a2540] rounded-lg"
            >
              <div>
                <p className="font-medium text-white">{notification.label}</p>
                <p className="text-xs text-[#7a88a8] mt-1">
                  {notification.description}
                </p>
              </div>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked={notification.enabled}
                  className="w-5 h-5 rounded border-[#1a2540] bg-[#1a2540] text-[#e74c3c]"
                />
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-[#e74c3c]/20 bg-[#e74c3c]/5">
        <CardHeader>
          <CardTitle className="text-[#e74c3c]">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions - use with caution
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full border-[#e74c3c] text-[#e74c3c] hover:bg-[#e74c3c]/10"
          >
            Delete Account
          </Button>
          <p className="text-xs text-[#7a88a8]">
            This will permanently delete your account and all associated data.
            This action cannot be undone.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
