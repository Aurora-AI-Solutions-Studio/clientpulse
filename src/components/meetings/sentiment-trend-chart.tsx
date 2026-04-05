'use client'

interface SentimentDataPoint {
  date: string
  score: number
}

interface SentimentTrendChartProps {
  data: SentimentDataPoint[]
}

export function SentimentTrendChart({ data }: SentimentTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-[#0a1628] rounded-lg border border-[#1a2540]">
        <p className="text-[#7a88a8]">No sentiment data available</p>
      </div>
    )
  }

  // Calculate chart dimensions
  const padding = { top: 20, right: 20, bottom: 40, left: 40 }
  const width = 600
  const height = 300
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  // Calculate scales
  const minScore = Math.min(...data.map((d) => d.score), 1)
  const maxScore = Math.max(...data.map((d) => d.score), 10)
  const scoreRange = maxScore - minScore || 1

  const xScale = (index: number) => (index / (data.length - 1)) * chartWidth
  const yScale = (score: number) => {
    const normalized = (score - minScore) / scoreRange
    return chartHeight - normalized * chartHeight
  }

  // Generate path for line chart
  const pathPoints = data.map((d, i) => ({
    x: padding.left + xScale(i),
    y: padding.top + yScale(d.score),
    score: d.score,
    date: d.date,
  }))

  const linePath = pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  // Generate gradient fill path
  const fillPath =
    linePath +
    ` L ${pathPoints[pathPoints.length - 1].x} ${padding.top + chartHeight}` +
    ` L ${padding.left} ${padding.top + chartHeight}` +
    ` Z`

  // Generate Y-axis labels
  const yLabels = []
  for (let i = 0; i <= 10; i += 2) {
    yLabels.push(i)
  }

  // Generate X-axis labels (every other point for readability)
  const xLabels = data.filter((_, i) => i % Math.ceil(data.length / 5) === 0)

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} className="bg-[#0a1628] rounded-lg border border-[#1a2540]">
        {/* Grid lines */}
        {yLabels.map((label) => {
          const y = padding.top + yScale(label)
          return (
            <g key={`grid-${label}`}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#1a2540"
                strokeWidth="1"
                strokeDasharray="4"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="12"
                fill="#7a88a8"
              >
                {label}
              </text>
            </g>
          )
        })}

        {/* Gradient definition */}
        <defs>
          <linearGradient id="sentimentGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e74c3c" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#e74c3c" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Fill area under the line */}
        <path d={fillPath} fill="url(#sentimentGradient)" />

        {/* Line chart */}
        <path d={linePath} stroke="#e74c3c" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points */}
        {pathPoints.map((p, i) => (
          <g key={`point-${i}`}>
            <circle cx={p.x} cy={p.y} r="4" fill="#e74c3c" />
            <circle cx={p.x} cy={p.y} r="6" fill="#e74c3c" opacity="0.2" />
          </g>
        ))}

        {/* X-axis */}
        <line
          x1={padding.left}
          y1={padding.top + chartHeight}
          x2={width - padding.right}
          y2={padding.top + chartHeight}
          stroke="#1a2540"
          strokeWidth="2"
        />

        {/* Y-axis */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + chartHeight}
          stroke="#1a2540"
          strokeWidth="2"
        />

        {/* X-axis labels */}
        {xLabels.map((d, i) => {
          const dataIndex = data.indexOf(d)
          const x = padding.left + xScale(dataIndex)
          return (
            <g key={`xlabel-${i}`}>
              <line
                x1={x}
                y1={padding.top + chartHeight}
                x2={x}
                y2={padding.top + chartHeight + 4}
                stroke="#1a2540"
                strokeWidth="1"
              />
              <text
                x={x}
                y={padding.top + chartHeight + 20}
                textAnchor="middle"
                fontSize="11"
                fill="#7a88a8"
              >
                {new Date(d.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </text>
            </g>
          )
        })}

        {/* Y-axis label */}
        <text
          x={15}
          y={padding.top - 5}
          fontSize="12"
          fill="#7a88a8"
          fontWeight="500"
        >
          Sentiment
        </text>

        {/* X-axis label */}
        <text
          x={width / 2}
          y={height - 5}
          textAnchor="middle"
          fontSize="12"
          fill="#7a88a8"
          fontWeight="500"
        >
          Date
        </text>
      </svg>
    </div>
  )
}
