'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

interface HealthScoreBreakdown {
  financial: number
  relationship: number
  delivery: number
  engagement: number
}

interface HealthScoreCardProps {
  score: number
  breakdown: HealthScoreBreakdown
  status: 'Healthy' | 'At Risk' | 'Critical'
  lastUpdated: string
}

export function HealthScoreCard({
  score,
  breakdown,
  status,
  lastUpdated,
}: HealthScoreCardProps) {
  const [displayScore, setDisplayScore] = useState(0)

  // Animate the score on mount
  useEffect(() => {
    let current = 0
    const increment = score / 20
    const interval = setInterval(() => {
      current += increment
      if (current >= score) {
        setDisplayScore(score)
        clearInterval(interval)
      } else {
        setDisplayScore(Math.floor(current))
      }
    }, 30)
    return () => clearInterval(interval)
  }, [score])

  const getScoreColor = (s: number): string => {
    if (s >= 70) return 'text-green-400'
    if (s >= 40) return 'text-yellow-400'
    return 'text-[#e74c3c]'
  }

  const getStatusColor = (
    s: 'Healthy' | 'At Risk' | 'Critical'
  ): string => {
    switch (s) {
      case 'Healthy':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'At Risk':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'Critical':
        return 'bg-[#e74c3c]/20 text-[#e74c3c] border-[#e74c3c]/30'
    }
  }

  const subScores = [
    { label: 'Financial', value: breakdown.financial },
    { label: 'Relationship', value: breakdown.relationship },
    { label: 'Delivery', value: breakdown.delivery },
    { label: 'Engagement', value: breakdown.engagement },
  ]

  // Calculate arc path for circular score display
  const circumference = 2 * Math.PI * 45
  const offset = circumference - (displayScore / 100) * circumference

  return (
    <Card className="bg-[#111d35] border-[#1a2540]">
      <CardHeader>
        <CardTitle className="font-playfair text-white">Health Score</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Circular Score Display */}
        <div className="flex items-center justify-between">
          <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 120 120">
              {/* Background circle */}
              <circle
                cx="60"
                cy="60"
                r="45"
                fill="none"
                stroke="#1a2540"
                strokeWidth="8"
              />
              {/* Score arc */}
              <circle
                cx="60"
                cy="60"
                r="45"
                fill="none"
                stroke="#e74c3c"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{
                  transform: 'rotate(-90deg)',
                  transformOrigin: '60px 60px',
                  transition: 'stroke-dashoffset 0.5s ease',
                }}
              />
            </svg>
            {/* Score text overlay */}
            <div className="absolute text-center">
              <div className={`text-3xl font-bold font-playfair ${getScoreColor(displayScore)}`}>
                {displayScore}
              </div>
              <div className="text-xs text-[#7a88a8] mt-1">/ 100</div>
            </div>
          </div>

          {/* Status and Date */}
          <div className="flex-1 ml-6 space-y-4">
            <div>
              <Badge
                variant="outline"
                className={`${getStatusColor(status)} border capitalize`}
              >
                {status}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-[#7a88a8]">Last Updated</p>
              <p className="text-sm text-white font-medium">
                {new Date(lastUpdated).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Sub-scores */}
        <div className="space-y-4 pt-4 border-t border-[#1a2540]">
          <p className="text-sm font-medium text-white">Score Breakdown</p>
          {subScores.map((item) => (
            <div key={item.label} className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-[#7a88a8]">{item.label}</label>
                <span className="text-sm font-medium text-white">{item.value}%</span>
              </div>
              <Progress
                value={item.value}
                className="h-2 bg-[#0a1628]"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
