'use client';

import { cn } from '@/lib/utils';

interface HealthScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function HealthScoreBadge({ score, size = 'md' }: HealthScoreBadgeProps) {
  const getStatusColor = (score: number) => {
    if (score >= 70) return '#22c55e'; // green
    if (score >= 40) return '#eab308'; // yellow
    return '#ef4444'; // red
  };

  const getStatusLabel = (score: number) => {
    if (score >= 70) return 'Healthy';
    if (score >= 40) return 'At Risk';
    return 'Critical';
  };

  const sizeClasses = {
    sm: 'w-12 h-12 text-xs',
    md: 'w-16 h-16 text-sm',
    lg: 'w-24 h-24 text-2xl',
  };

  const borderWidth = {
    sm: 2,
    md: 3,
    lg: 4,
  };

  const color = getStatusColor(score);
  const label = getStatusLabel(score);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          'rounded-full flex items-center justify-center font-bold',
          sizeClasses[size]
        )}
        style={{
          border: `${borderWidth[size]}px solid ${color}`,
          background: `${color}15`,
          color: color,
        }}
      >
        {score}
      </div>
      <span className="text-xs font-medium" style={{ color }}>
        {label}
      </span>
    </div>
  );
}
