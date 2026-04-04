'use client';

import { Mail } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function BriefPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-bold text-white font-playfair mb-2">
          Monday Brief
        </h2>
        <p className="text-[#7a88a8]">
          Your weekly client health summary and insights
        </p>
      </div>

      {/* Current Brief */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                This Week&apos;s Brief
              </CardTitle>
              <CardDescription>
                Monday, April 7, 2026
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              Send Now
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Brief Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-[#1a2540]/30 rounded-lg">
                <p className="text-sm text-[#7a88a8] mb-1">Healthy Clients</p>
                <p className="text-2xl font-bold text-green-400">10</p>
              </div>
              <div className="p-4 bg-[#1a2540]/30 rounded-lg">
                <p className="text-sm text-[#7a88a8] mb-1">At Risk</p>
                <p className="text-2xl font-bold text-[#e74c3c]">2</p>
              </div>
              <div className="p-4 bg-[#1a2540]/30 rounded-lg">
                <p className="text-sm text-[#7a88a8] mb-1">Avg Health Score</p>
                <p className="text-2xl font-bold text-white">78%</p>
              </div>
            </div>

            {/* Preview */}
            <div className="border border-[#1a2540] rounded-lg p-6 bg-[#0a0f1a]/50">
              <p className="text-sm text-[#7a88a8] mb-4">Email Preview</p>
              <div className="space-y-3 text-sm text-[#7a88a8]">
                <p>Your Monday Brief will include:</p>
                <ul className="list-disc list-inside space-y-2 ml-2">
                  <li>Weekly health score summary</li>
                  <li>At-risk clients requiring attention</li>
                  <li>Key metrics and trends</li>
                  <li>Recommended actions</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Brief Schedule</CardTitle>
          <CardDescription>
            Configure when you receive your Monday Brief
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Send Time
              </label>
              <select className="w-full px-4 py-2 bg-[#1a2540] border border-[#1a2540] rounded-lg text-white text-sm">
                <option>9:00 AM</option>
                <option>10:00 AM</option>
                <option>12:00 PM</option>
                <option>2:00 PM</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Recipient Email
              </label>
              <input
                type="email"
                className="w-full px-4 py-2 bg-[#1a2540] border border-[#1a2540] rounded-lg text-white text-sm"
                placeholder="your@email.com"
              />
            </div>
            <Button className="bg-[#e74c3c] hover:bg-[#c0392b] text-white">
              Save Schedule
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
