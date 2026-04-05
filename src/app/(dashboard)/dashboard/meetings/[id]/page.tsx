'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Circle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const MOCK_MEETING = {
  id: '1',
  title: 'Q2 Planning Session',
  client: 'Acme Corp',
  date: '2026-03-28T10:00:00',
  duration: '1 hour 15 minutes',
  status: 'completed',
  transcript: `[10:00] Sarah: Good morning everyone, thanks for joining our Q2 planning session. Let's start with the agenda.

[10:05] John: We need to discuss the new project scope and timeline adjustments.

[10:15] Sarah: Agreed. We have three main initiatives to cover today: Feature expansion, infrastructure upgrades, and team capacity planning.

[10:20] Mike: I'd like to raise concerns about the current delivery timeline. We're looking at compressed schedules.

[10:30] Sarah: Valid point. Let's prioritize and see what we can realistically deliver.

[10:45] John: We should also explore potential upsell opportunities with the new features.

[11:10] Sarah: Great discussion. Let's summarize our action items and next steps.

[11:15] Meeting ended`,
  sentiment: 8,
  actionItems: [
    {
      id: '1',
      title: 'Review feature prioritization',
      description: 'Go through the backlog and rank features by value and effort',
      status: 'open',
      dueDate: '2026-04-08',
      meeting: 'Q2 Planning Session',
    },
    {
      id: '2',
      title: 'Capacity planning analysis',
      description: 'Conduct team capacity assessment for Q2 initiatives',
      status: 'done',
      dueDate: '2026-04-05',
      meeting: 'Q2 Planning Session',
    },
    {
      id: '3',
      title: 'Infrastructure cost estimate',
      description: 'Provide detailed cost breakdown for infrastructure upgrades',
      status: 'open',
      dueDate: '2026-04-10',
      meeting: 'Q2 Planning Session',
    },
    {
      id: '4',
      title: 'Prepare upsell proposal',
      description: 'Create pitch deck for new feature offerings',
      status: 'open',
      dueDate: '2026-04-15',
      meeting: 'Q2 Planning Session',
    },
    {
      id: '5',
      title: 'Schedule follow-up with stakeholders',
      description: 'Book meetings to review decisions and timeline',
      status: 'open',
      dueDate: '2026-04-12',
      meeting: 'Q2 Planning Session',
    },
  ],
  intelligence: {
    sentiment: {
      score: 8,
      description: 'Positive and collaborative tone throughout the meeting',
    },
    summary:
      'Discussion focused on Q2 planning with three main initiatives: feature expansion, infrastructure upgrades, and team capacity planning. Team raised valid concerns about delivery timeline compression but agreed to prioritize and reassess capacity.',
    scopeChanges: [
      'New feature expansion added to roadmap',
      'Infrastructure upgrade timeline compressed by 2 weeks',
      'Team capacity review scheduled',
    ],
    stakeholderEngagement: {
      presence: 4,
      participationLevel: 'high',
      description: '4 active participants with strong engagement',
    },
    escalationSignals: [
      {
        signal: 'Timeline compression concerns',
        severity: 'medium',
        details: 'Team flagged concerns about compressed delivery schedule',
      },
      {
        signal: 'Resource capacity constraints',
        severity: 'medium',
        details: 'Capacity planning needed before finalizing scope',
      },
    ],
    upsellMentions: [
      {
        mention: 'New feature opportunities',
        estimatedValue: 50000,
        confidence: 'high',
      },
    ],
  },
}

function getStatusBadgeColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-green-500/20 text-green-400 border-green-500/30'
    case 'processing':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    case 'pending':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    default:
      return 'bg-[#1a2540] text-[#7a88a8]'
  }
}

function getSentimentColor(score: number): string {
  if (score >= 8) return 'text-green-400'
  if (score >= 6) return 'text-blue-400'
  if (score >= 4) return 'text-yellow-400'
  return 'text-[#e74c3c]'
}

export default function MeetingDetailPage() {
  const [actionItems, setActionItems] = useState(MOCK_MEETING.actionItems)

  const toggleActionItem = (id: string) => {
    setActionItems(
      actionItems.map((item) =>
        item.id === id ? { ...item, status: item.status === 'open' ? 'done' : 'open' } : item
      )
    )
  }

  const isOverdue = (dueDate: string): boolean => {
    return new Date(dueDate) < new Date() && dueDate < new Date().toISOString().split('T')[0]
  }

  return (
    <div className="space-y-8">
      {/* Back Button & Header */}
      <div>
        <Link href="/dashboard/meetings" className="flex items-center gap-2 text-[#7a88a8] hover:text-white mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Meetings
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold font-playfair text-white">
              {MOCK_MEETING.title}
            </h1>
            <div className="flex items-center gap-4 mt-3 text-[#7a88a8]">
              <span>{MOCK_MEETING.client}</span>
              <span>•</span>
              <span>{new Date(MOCK_MEETING.date).toLocaleDateString()}</span>
              <span>•</span>
              <span>{MOCK_MEETING.duration}</span>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`${getStatusBadgeColor(MOCK_MEETING.status)} border capitalize`}
          >
            {MOCK_MEETING.status}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="transcript" className="space-y-4">
        <TabsList className="bg-[#0a1628] border-[#1a2540]">
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
          <TabsTrigger value="actionItems">Action Items</TabsTrigger>
        </TabsList>

        {/* Transcript Tab */}
        <TabsContent value="transcript">
          <Card className="bg-[#111d35] border-[#1a2540]">
            <CardHeader>
              <CardTitle className="font-playfair text-white">Meeting Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-[#0a1628] rounded-lg p-6 text-[#7a88a8] whitespace-pre-wrap font-mono text-sm leading-relaxed">
                {MOCK_MEETING.transcript}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Intelligence Tab */}
        <TabsContent value="intelligence" className="space-y-4">
          {/* Sentiment Score */}
          <Card className="bg-[#111d35] border-[#1a2540]">
            <CardHeader>
              <CardTitle className="font-playfair text-white">Sentiment Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <div className={`text-5xl font-bold font-playfair ${getSentimentColor(MOCK_MEETING.intelligence.sentiment.score)}`}>
                    {MOCK_MEETING.intelligence.sentiment.score}/10
                  </div>
                  <p className="text-[#7a88a8] text-sm mt-2">Overall Sentiment</p>
                </div>
                <div className="flex-1">
                  <p className="text-white">{MOCK_MEETING.intelligence.sentiment.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="bg-[#111d35] border-[#1a2540]">
            <CardHeader>
              <CardTitle className="font-playfair text-white">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[#7a88a8] leading-relaxed">
                {MOCK_MEETING.intelligence.summary}
              </p>
            </CardContent>
          </Card>

          {/* Scope Changes */}
          <Card className="bg-[#111d35] border-[#1a2540]">
            <CardHeader>
              <CardTitle className="font-playfair text-white">Scope Changes</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {MOCK_MEETING.intelligence.scopeChanges.map((change, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-[#7a88a8]">
                    <span className="text-[#e74c3c] font-bold mt-1">•</span>
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Stakeholder Engagement */}
          <Card className="bg-[#111d35] border-[#1a2540]">
            <CardHeader>
              <CardTitle className="font-playfair text-white">Stakeholder Engagement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-white font-medium mb-1">Participants: {MOCK_MEETING.intelligence.stakeholderEngagement.presence}</div>
                <div className="text-[#7a88a8] text-sm">
                  {MOCK_MEETING.intelligence.stakeholderEngagement.description}
                </div>
              </div>
              <div>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border">
                  {MOCK_MEETING.intelligence.stakeholderEngagement.participationLevel}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Escalation Signals */}
          <Card className="bg-[#111d35] border-[#1a2540]">
            <CardHeader>
              <CardTitle className="font-playfair text-white">Escalation Signals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {MOCK_MEETING.intelligence.escalationSignals.map((signal, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-[#0a1628] rounded border border-[#1a2540] space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{signal.signal}</span>
                    <Badge
                      variant="outline"
                      className={
                        signal.severity === 'high'
                          ? 'bg-[#e74c3c]/20 text-[#e74c3c] border-[#e74c3c]/30'
                          : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                      }
                    >
                      {signal.severity}
                    </Badge>
                  </div>
                  <p className="text-[#7a88a8] text-sm">{signal.details}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Upsell Mentions */}
          <Card className="bg-[#111d35] border-[#1a2540]">
            <CardHeader>
              <CardTitle className="font-playfair text-white">Upsell Opportunities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {MOCK_MEETING.intelligence.upsellMentions.map((mention, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-[#0a1628] rounded border border-[#1a2540] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">{mention.mention}</span>
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border">
                      ${mention.estimatedValue.toLocaleString()}
                    </Badge>
                  </div>
                  <div className="text-[#7a88a8] text-sm">
                    Confidence: {mention.confidence}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Action Items Tab */}
        <TabsContent value="actionItems">
          <Card className="bg-[#111d35] border-[#1a2540]">
            <CardHeader>
              <CardTitle className="font-playfair text-white">
                Action Items ({actionItems.filter((a) => a.status === 'open').length} open)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {actionItems.length === 0 ? (
                <div className="text-center py-8 text-[#7a88a8]">No action items yet</div>
              ) : (
                <div className="space-y-3">
                  {actionItems.map((item) => {
                    const overdue = isOverdue(item.dueDate)
                    return (
                      <div
                        key={item.id}
                        className={`p-4 bg-[#0a1628] rounded border transition-colors ${
                          overdue ? 'border-[#e74c3c]/50' : 'border-[#1a2540]'
                        } ${item.status === 'done' ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-start gap-4">
                          <button
                            onClick={() => toggleActionItem(item.id)}
                            className="mt-1 flex-shrink-0 text-[#7a88a8] hover:text-[#e74c3c] transition-colors"
                          >
                            {item.status === 'done' ? (
                              <CheckCircle2 className="w-5 h-5 text-green-400" />
                            ) : (
                              <Circle className="w-5 h-5" />
                            )}
                          </button>
                          <div className="flex-1">
                            <h4
                              className={`font-medium ${
                                item.status === 'done'
                                  ? 'text-[#7a88a8] line-through'
                                  : 'text-white'
                              }`}
                            >
                              {item.title}
                            </h4>
                            <p className="text-[#7a88a8] text-sm mt-1">{item.description}</p>
                            <div className="flex items-center gap-3 mt-3 text-xs">
                              <span className="text-[#7a88a8]">Due: {item.dueDate}</span>
                              {overdue && item.status === 'open' && (
                                <Badge className="bg-[#e74c3c]/20 text-[#e74c3c] border-[#e74c3c]/30 border">
                                  Overdue
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              item.status === 'done'
                                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                            }
                          >
                            {item.status}
                          </Badge>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
