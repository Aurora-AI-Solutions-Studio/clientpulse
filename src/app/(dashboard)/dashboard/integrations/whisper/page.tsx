'use client';

import { useEffect, useState } from 'react';
import { Cloud, Lock, Shield } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface TranscriptionSettings {
  mode: 'cloud' | 'local' | 'hybrid';
  localWhisperUrl?: string;
}

type Mode = 'cloud' | 'local' | 'hybrid';

export default function WhisperIntegrationPage() {
  const [settings, setSettings] = useState<TranscriptionSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<Mode>('cloud');
  const [localUrl, setLocalUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/transcription/settings', { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed to load transcription settings (${res.status})`);
        const data: TranscriptionSettings = await res.json();
        if (!cancelled) {
          setSettings(data);
          setSelectedMode(data.mode);
          setLocalUrl(data.localWhisperUrl || '');
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

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const payload: TranscriptionSettings = {
        mode: selectedMode,
        ...(selectedMode !== 'cloud' && localUrl ? { localWhisperUrl: localUrl } : {}),
      };
      const res = await fetch('/api/transcription/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Failed to save settings (${res.status})`);
      const data: TranscriptionSettings = await res.json();
      setSettings(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const modes: Array<{ id: Mode; title: string; description: string; icon: React.ReactNode }> = [
    {
      id: 'cloud',
      title: 'Cloud',
      description: 'Audio processed by OpenAI Whisper API. Fast, reliable. Audio leaves your infrastructure.',
      icon: <Cloud className="w-5 h-5" />,
    },
    {
      id: 'local',
      title: 'Local',
      description:
        'Audio processed by your self-hosted faster-whisper server. Audio never leaves your infrastructure. Requires setup.',
      icon: <Lock className="w-5 h-5" />,
    },
    {
      id: 'hybrid',
      title: 'Hybrid',
      description: 'Tries local first, falls back to cloud. Best of both worlds.',
      icon: <Shield className="w-5 h-5" />,
    },
  ];

  const isPrivacyMode = selectedMode === 'local' || selectedMode === 'hybrid';

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl text-white mb-2">
            Transcription Settings
          </h2>
          <p className="text-[#7a88a8]">
            Configure audio transcription mode for meeting recordings
          </p>
        </div>
        {isPrivacyMode && (
          <Badge className="bg-[#22c55e]/15 text-green-300 border border-green-500/30">
            Privacy Mode
          </Badge>
        )}
      </div>

      {error && (
        <Card className="border-red-500/40 bg-red-500/5">
          <CardContent className="p-4 text-red-300">{error}</CardContent>
        </Card>
      )}

      {/* Current Mode Display */}
      {!loading && settings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-white">Current Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {modes.find((m) => m.id === settings.mode)?.icon}
              <div>
                <p className="font-semibold text-white">{settings.mode.charAt(0).toUpperCase() + settings.mode.slice(1)} Mode</p>
                <p className="text-sm text-[#7a88a8]">{modes.find((m) => m.id === settings.mode)?.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mode Selector */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-4">Select Transcription Mode</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => {
                setSelectedMode(mode.id);
                setError(null);
              }}
              className={`p-4 rounded border transition text-left ${
                selectedMode === mode.id
                  ? 'bg-[#e74c3c]/10 border-[#e74c3c] shadow-lg shadow-[#e74c3c]/20'
                  : 'bg-[#1a1f35] border-[#2a3050] hover:border-[#3a4060]'
              }`}
            >
              <div className="flex items-start gap-3 mb-2">
                <div
                  className={`${
                    selectedMode === mode.id ? 'text-[#e74c3c]' : 'text-[#7a88a8]'
                  }`}
                >
                  {mode.icon}
                </div>
                <div className="flex-1">
                  <h4 className={`font-semibold ${selectedMode === mode.id ? 'text-white' : 'text-[#7a88a8]'}`}>
                    {mode.title}
                  </h4>
                </div>
              </div>
              <p className="text-sm text-[#7a88a8]">{mode.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Local/Hybrid Configuration */}
      {(selectedMode === 'local' || selectedMode === 'hybrid') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-white">Local Whisper Configuration</CardTitle>
            <CardDescription>
              Specify your self-hosted faster-whisper server endpoint
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#7a88a8] mb-2">
                Local Whisper Endpoint URL
              </label>
              <Input
                type="url"
                placeholder="http://localhost:8000"
                value={localUrl}
                onChange={(e) => setLocalUrl(e.target.value)}
                className="bg-[#1a1f35] border-[#2a3050] text-white placeholder-[#7a88a8]"
              />
            </div>
            <p className="text-xs text-[#7a88a8]">
              Make sure your faster-whisper server is running and accessible at this URL.
              {selectedMode === 'hybrid' && ' If local is unavailable, will fall back to cloud.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Privacy Information */}
      {isPrivacyMode && (
        <Card className="border-green-500/40 bg-green-500/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-400" />
              <CardTitle className="text-green-300">Privacy Protected</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-green-300/80">
              Your audio data stays on your infrastructure. Audio is never transmitted to external cloud services in{' '}
              {selectedMode === 'hybrid' ? 'local-first mode' : 'local mode'}.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={saving || loading}
          className="bg-[#e74c3c] hover:bg-[#d63c2d] text-white"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
        <Button
          variant="outline"
          disabled={loading}
          className="bg-[#1a1f35] border-[#2a3050] text-[#7a88a8] hover:bg-[#232e4f]"
        >
          Cancel
        </Button>
      </div>

      {/* Help Section */}
      <Card className="bg-[#1a1f35] border-[#2a3050]">
        <CardHeader>
          <CardTitle className="text-white text-base">Need Help?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-[#7a88a8]">
          <div>
            <p className="font-semibold text-white mb-1">Cloud Mode</p>
            <p>Works out of the box. Audio is processed by OpenAI Whisper API (requires API key).</p>
          </div>
          <div>
            <p className="font-semibold text-white mb-1">Local Mode</p>
            <p>
              Set up faster-whisper on your server.{' '}
              <a
                href="https://github.com/SYSTRAN/faster-whisper"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#e74c3c] hover:underline"
              >
                See documentation
              </a>
              .
            </p>
          </div>
          <div>
            <p className="font-semibold text-white mb-1">Hybrid Mode</p>
            <p>Attempts local transcription first. If unavailable, automatically falls back to cloud.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
