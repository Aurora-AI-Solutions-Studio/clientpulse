'use client';

import { Plus, Calendar } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function MeetingsPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white font-playfair mb-2">
            Meetings
          </h2>
          <p className="text-[#7a88a8]">
            Track and schedule client meetings
          </p>
        </div>
        <Button className="bg-[#e74c3c] hover:bg-[#c0392b] text-white gap-2">
          <Plus className="w-4 h-4" />
          Schedule Meeting
        </Button>
      </div>

      {/* Upcoming Meetings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Upcoming Meetings
          </CardTitle>
          <CardDescription>
            Your scheduled client meetings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 bg-[#1a2540]/30 rounded-lg">
            <div className="text-center">
              <p className="text-[#7a88a8] mb-2">No upcoming meetings</p>
              <p className="text-sm text-[#7a88a8]/60">
                Schedule your first meeting with a client
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
