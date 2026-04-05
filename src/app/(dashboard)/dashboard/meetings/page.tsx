'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MeetingUploadDialog } from '@/components/meetings/meeting-upload-dialog'

const MOCK_MEETINGS = [
  {
    id: '1',
    title: 'Q2 Planning Session',
    client: 'Acme Corp',
    date: '2026-03-28',
    sentiment: 8,
    actionItems: 5,
    status: 'completed',
  },
  {
    id: '2',
    title: 'Executive Sync',
    client: 'Globex Inc',
    date: '2026-04-01',
    sentiment: 7,
    actionItems: 3,
    status: 'completed',
  },
  {
    id: '3',
    title: 'Technical Review',
    client: 'Initech',
    date: '2026-04-03',
    sentiment: 6,
    actionItems: 8,
    status: 'processing',
  },
  {
    id: '4',
    title: 'Stakeholder Update',
    client: 'Umbrella Corp',
    date: '2026-04-04',
    sentiment: 9,
    actionItems: 2,
    status: 'pending',
  },
  {
    id: '5',
    title: 'Budget Review',
    client: 'Stark Industries',
    date: '2026-04-05',
    sentiment: 4,
    actionItems: 12,
    status: 'completed',
  },
  {
    id: '6',
    title: 'Partnership Discussion',
    client: 'Wayne Enterprises',
    date: '2026-03-25',
    sentiment: 5,
    actionItems: 6,
    status: 'failed',
  },
]

function getSentimentColor(score: number): string {
  if (score >= 8) return 'bg-green-500/20 text-green-400 border-green-500/30'
  if (score >= 6) return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  if (score >= 4) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
  return 'bg-[#e74c3c]/20 text-[#e74c3c] border-[#e74c3c]/30'
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-green-500/20 text-green-400 border-green-500/30'
    case 'processing':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    case 'pending':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    case 'failed':
      return 'bg-[#e74c3c]/20 text-[#e74c3c] border-[#e74c3c]/30'
    default:
      return 'bg-[#1a2540] text-[#7a88a8]'
  }
}

export default function MeetingsPage() {
  const [filter, setFilter] = useState<'all' | 'completed' | 'processing' | 'pending'>('all')

  const filteredMeetings =
    filter === 'all'
      ? MOCK_MEETINGS
      : MOCK_MEETINGS.filter((m) => {
          if (filter === 'completed') return m.status === 'completed'
          if (filter === 'processing') return m.status === 'processing'
          if (filter === 'pending') return m.status === 'pending'
          return true
        })

  const stats = [
    {
      label: 'Total Meetings',
      value: MOCK_MEETINGS.length,
      description: 'All time',
    },
    {
      label: 'Avg Sentiment',
      value: (
        MOCK_MEETINGS.reduce((sum, m) => sum + m.sentiment, 0) / MOCK_MEETINGS.length
      ).toFixed(1),
      description: 'Out of 10',
    },
    {
      label: 'Action Items',
      value: MOCK_MEETINGS.reduce((sum, m) => sum + m.actionItems, 0),
      description: 'Total open',
    },
    {
      label: 'Pending Review',
      value: MOCK_MEETINGS.filter((m) => m.status === 'pending').length,
      description: 'Awaiting input',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-playfair text-white">Meeting Intelligence</h1>
          <p className="text-[#7a88a8] mt-1">Upload and analyze client meetings</p>
        </div>
        <MeetingUploadDialog />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="bg-[#111d35] border-[#1a2540]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#7a88a8]">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white font-playfair">{stat.value}</div>
              <p className="text-xs text-[#7a88a8] mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Meetings List with Tabs */}
      <Card className="bg-[#111d35] border-[#1a2540]">
        <CardHeader>
          <CardTitle className="font-playfair text-xl text-white">Recent Meetings</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" value={filter} onValueChange={(v) => setFilter(v as 'all' | 'completed' | 'processing' | 'pending')}>
            <TabsList className="bg-[#0a1628] border-[#1a2540] mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="processing">Processing</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
            </TabsList>

            <TabsContent value={filter} className="space-y-3 mt-4">
              {filteredMeetings.length === 0 ? (
                <div className="text-center py-8 text-[#7a88a8]">
                  No meetings found in this category
                </div>
              ) : (
                filteredMeetings.map((meeting) => (
                  <Link key={meeting.id} href={`/dashboard/meetings/${meeting.id}`}>
                    <div className="p-4 bg-[#0a1628] rounded-lg border border-[#1a2540] hover:border-[#e74c3c] transition-colors cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-white font-playfair">
                            {meeting.title}
                          </h3>
                          <p className="text-sm text-[#7a88a8] mt-1">{meeting.client}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-xs text-[#7a88a8]">{meeting.date}</div>
                          </div>
                          <Badge
                            variant="outline"
                            className={`${getSentimentColor(meeting.sentiment)} border`}
                          >
                            Sentiment: {meeting.sentiment}/10
                          </Badge>
                          <Badge variant="outline" className="bg-[#1a2540] text-[#7a88a8] border-[#1a2540]">
                            {meeting.actionItems} items
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`${getStatusColor(meeting.status)} border capitalize`}
                          >
                            {meeting.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
