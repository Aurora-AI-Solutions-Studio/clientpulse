'use client';

import { useEffect, useState } from 'react';
import { Check, AlertCircle } from 'lucide-react';
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

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stripeStatus] = useState<StripeStatus>({
    connected: false,
  });

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          setUser(user);
          // TODO: Fetch Stripe status from Supabase
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

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
          {/* Email */}
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

          {/* Full Name */}
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

          {/* User ID */}
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
              <button className="px-3 py-2 bg-[#1a2540] hover:bg-[#252d3d] rounded-lg text-[#7a88a8] text-sm transition-colors">
                Copy
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connected Integrations */}
      <Card>
        <CardHeader>
          <CardTitle>Connected Integrations</CardTitle>
          <CardDescription>
            Manage your connected third-party services
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
                    : 'Not connected'}
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

          {/* Google Calendar (Coming Soon) */}
          <div className="flex items-center justify-between p-4 border border-[#1a2540] rounded-lg opacity-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <span className="text-blue-400 font-bold text-sm">G</span>
              </div>
              <div>
                <p className="font-medium text-white">Google Calendar</p>
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
          {/* Current Plan */}
          <div>
            <h3 className="text-sm font-medium text-white mb-4">
              Current Plan
            </h3>
            <div className="border border-[#1a2540] rounded-lg p-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-lg font-semibold text-white">Free Plan</p>
                  <p className="text-xs text-[#7a88a8] mt-1">
                    Up to 5 clients • Basic analytics
                  </p>
                </div>
                <span className="text-xs px-3 py-1 bg-[#e74c3c]/10 text-[#e74c3c] rounded-full">
                  Active
                </span>
              </div>
              <div className="text-sm text-[#7a88a8]">
                <p>Renews on April 4, 2027</p>
              </div>
            </div>
          </div>

          {/* Upgrade Option */}
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
                <Button className="bg-[#e74c3c] hover:bg-[#c0392b] text-white text-sm">
                  View Plans
                </Button>
              </div>
            </div>
          </div>

          {/* Billing History */}
          <div>
            <h3 className="text-sm font-medium text-white mb-3">
              Billing History
            </h3>
            <div className="space-y-2 text-sm">
              <p className="text-[#7a88a8]">
                No billing history yet. Your account is on the Free plan.
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
