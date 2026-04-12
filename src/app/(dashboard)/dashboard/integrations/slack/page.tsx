'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, X, Zap } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface SlackSettings {
  connected: boolean;
  webhookUrl?: string;
  channelName?: string;
  lastMessageTime?: string;
  preferences?: {
    mondayBrief: boolean;
    churnAlerts: boolean;
    upsell: boolean;
    healthDrops: boolean;
  };
}

export default function SlackIntegrationPage() {
  const [settings, setSettings] = useState<SlackSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [webhookInput, setWebhookInput] = useState('');
  const [channelInput, setChannelInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [prefs, setPrefs] = useState<SlackSettings['preferences'] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/slack', { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed to load Slack settings (${res.status})`);
        const data: SlackSettings = await res.json();
        if (!cancelled) {
          setSettings(data);
          setPrefs(data.preferences || null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleConnect = async () => {
    if (!webhookInput.trim() || !channelInput.trim()) {
      setError('Please fill in webhook URL and channel name');
      return;
    }

    try {
      setConnecting(true);
      setError(null);
      const res = await fetch('/api/slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: webhookInput,
          channelName: channelInput,
        }),
      });
      if (!res.ok) throw new Error(`Failed to connect Slack (${res.status})`);
      const data: SlackSettings = await res.json();
      setSettings(data);
      setPrefs(data.preferences || null);
      setWebhookInput('');
      setChannelInput('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setError(null);
      const res = await fetch('/api/slack/test', { method: 'POST' });
      if (!res.ok) throw new Error(`Test failed (${res.status})`);
      // Show success message
      const testResult = await res.json();
      alert(testResult.message || 'Connection test successful!');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setDisconnecting(true);
      setError(null);
      const res = await fetch('/api/slack', { method: 'DELETE' });
      if (!res.ok) throw new Error(`Failed to disconnect (${res.status})`);
      setSettings({ connected: false });
      setPrefs(null);
      setShowDisconnectConfirm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleUpdatePreference = async (key: keyof NonNullable<SlackSettings['preferences']>, value: boolean) => {
    if (!prefs) return;

    try {
      setError(null);
      const newPrefs = { ...prefs, [key]: value };
      const res = await fetch('/api/slack/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPrefs),
      });
      if (!res.ok) throw new Error(`Failed to update preferences (${res.status})`);
      setPrefs(newPrefs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update preferences');
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-bold text-white font-playfair mb-2">
          Slack Integration
        </h2>
        <p className="text-[#7a88a8]">
          Connect ClientPulse to Slack for direct notifications and insights
        </p>
      </div>

      {error && (
        <Card className="border-red-500/40 bg-red-500/5">
          <CardContent className="p-4 text-red-300">{error}</CardContent>
        </Card>
      )}

      {/* Connection Status */}
      <Card className={settings?.connected ? 'border-green-500/40 bg-green-500/5' : 'border-[#2a3050]'}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {settings?.connected ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <CardTitle className="text-green-300">Connected</CardTitle>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-[#7a88a8]" />
                  <CardTitle className="text-white">Not Connected</CardTitle>
                </>
              )}
            </div>
          </div>
        </CardHeader>

        {settings?.connected ? (
          <CardContent className="space-y-6">
            {/* Connected Status Details */}
            <div className="space-y-4">
              <div className="p-3 bg-[#1a1f35] rounded border border-[#2a3050]">
                <p className="text-xs text-[#7a88a8] mb-1">Channel</p>
                <p className="text-sm font-semibold text-white">#{settings.channelName}</p>
              </div>
              {settings.lastMessageTime && (
                <div className="p-3 bg-[#1a1f35] rounded border border-[#2a3050]">
                  <p className="text-xs text-[#7a88a8] mb-1">Last Message</p>
                  <p className="text-sm font-semibold text-white">{settings.lastMessageTime}</p>
                </div>
              )}
            </div>

            {/* Notification Preferences */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-4">Notification Preferences</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 bg-[#1a1f35] rounded border border-[#2a3050] cursor-pointer hover:border-[#3a4060] transition">
                  <input
                    type="checkbox"
                    checked={prefs?.mondayBrief || false}
                    onChange={(e) => handleUpdatePreference('mondayBrief', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-white">Monday Brief</p>
                    <p className="text-xs text-[#7a88a8]">Weekly summary every Monday morning</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-[#1a1f35] rounded border border-[#2a3050] cursor-pointer hover:border-[#3a4060] transition">
                  <input
                    type="checkbox"
                    checked={prefs?.churnAlerts || false}
                    onChange={(e) => handleUpdatePreference('churnAlerts', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-white">Churn Alerts</p>
                    <p className="text-xs text-[#7a88a8]">Immediate notification of churn risks</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-[#1a1f35] rounded border border-[#2a3050] cursor-pointer hover:border-[#3a4060] transition">
                  <input
                    type="checkbox"
                    checked={prefs?.upsell || false}
                    onChange={(e) => handleUpdatePreference('upsell', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-white">Upsell Opportunities</p>
                    <p className="text-xs text-[#7a88a8]">Alerts for upsell and cross-sell moments</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-[#1a1f35] rounded border border-[#2a3050] cursor-pointer hover:border-[#3a4060] transition">
                  <input
                    type="checkbox"
                    checked={prefs?.healthDrops || false}
                    onChange={(e) => handleUpdatePreference('healthDrops', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-white">Health Drops</p>
                    <p className="text-xs text-[#7a88a8]">Alert when client health score drops</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleTestConnection}
                disabled={testing}
                variant="outline"
                className="bg-[#1a1f35] border-[#2a3050] text-[#7a88a8] hover:bg-[#232e4f]"
              >
                {testing ? 'Testing…' : 'Test Connection'}
              </Button>
              <Dialog open={showDisconnectConfirm} onOpenChange={setShowDisconnectConfirm}>
                <DialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="bg-red-500/15 text-[#e74c3c] border border-red-500/30 hover:bg-red-500/25"
                  >
                    Disconnect
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#111827] border-[#2a3050]">
                  <DialogHeader>
                    <DialogTitle className="text-white">Disconnect Slack?</DialogTitle>
                    <DialogDescription className="text-[#7a88a8]">
                      You won't receive Slack notifications once disconnected. You can reconnect anytime.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setShowDisconnectConfirm(false)}
                      className="bg-[#1a1f35] border-[#2a3050] text-[#7a88a8]"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                      className="bg-[#e74c3c] hover:bg-[#d63c2d] text-white"
                    >
                      {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        ) : (
          <CardContent className="space-y-4">
            <p className="text-[#7a88a8]">
              Set up a Slack webhook to receive ClientPulse insights directly in Slack.
            </p>

            {/* Connection Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#7a88a8] mb-2">
                  Webhook URL
                </label>
                <Input
                  type="password"
                  placeholder="https://hooks.slack.com/services/..."
                  value={webhookInput}
                  onChange={(e) => setWebhookInput(e.target.value)}
                  className="bg-[#1a1f35] border-[#2a3050] text-white placeholder-[#7a88a8]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#7a88a8] mb-2">
                  Channel Name
                </label>
                <Input
                  placeholder="clientpulse-alerts"
                  value={channelInput}
                  onChange={(e) => setChannelInput(e.target.value)}
                  className="bg-[#1a1f35] border-[#2a3050] text-white placeholder-[#7a88a8]"
                />
              </div>

              <Button
                onClick={handleConnect}
                disabled={connecting || !webhookInput.trim() || !channelInput.trim()}
                className="w-full bg-[#e74c3c] hover:bg-[#d63c2d] text-white"
              >
                {connecting ? 'Connecting…' : 'Connect'}
              </Button>
            </div>

            {/* Help Text */}
            <div className="p-3 bg-[#1a1f35] rounded border border-[#2a3050]">
              <p className="text-xs text-[#7a88a8]">
                Need help? Create a Slack app at{' '}
                <a
                  href="https://api.slack.com/apps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#e74c3c] hover:underline"
                >
                  api.slack.com/apps
                </a>
                {' '}and add an incoming webhook.
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
