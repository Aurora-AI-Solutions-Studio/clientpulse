'use client';

import { Progress } from '@/components/ui/progress';
import { HealthBreakdown } from '@/types/client';

interface HealthBreakdownProps {
  breakdown: HealthBreakdown;
}

export default function HealthBreakdownComponent({ breakdown }: HealthBreakdownProps) {
  const categories = [
    {
      label: 'Financial',
      value: breakdown.financial,
      weight: 30,
      color: 'bg-blue-500',
    },
    {
      label: 'Relationship',
      value: breakdown.relationship,
      weight: 30,
      color: 'bg-purple-500',
    },
    {
      label: 'Delivery',
      value: breakdown.delivery,
      weight: 25,
      color: 'bg-amber-500',
    },
    {
      label: 'Engagement',
      value: breakdown.engagement,
      weight: 15,
      color: 'bg-cyan-500',
    },
  ];

  return (
    <div className="space-y-6">
      {categories.map((category) => (
        <div key={category.label} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">
              {category.label}
            </span>
            <span className="text-xs text-[#7a88a8]">
              {category.value}/100 ({category.weight}% weight)
            </span>
          </div>
          <Progress value={category.value} className="h-2" />
          <div
            className={`h-2 rounded-full ${category.color} opacity-30`}
            style={{ width: `${category.value}%` }}
          />
        </div>
      ))}
    </div>
  );
}
