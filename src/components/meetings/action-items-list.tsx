'use client'

import { useState } from 'react'
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export interface ActionItem {
  id: string
  title: string
  description: string
  status: 'open' | 'done' | 'overdue'
  dueDate: string
  meetingSource: string
}

interface ActionItemsListProps {
  items: ActionItem[]
  onStatusChange?: (id: string, newStatus: 'open' | 'done' | 'overdue') => void
}

export function ActionItemsList({ items, onStatusChange }: ActionItemsListProps) {
  const [filter, setFilter] = useState<'all' | 'open' | 'done' | 'overdue'>('all')
  const [localItems, setLocalItems] = useState(items)

  const filteredItems =
    filter === 'all'
      ? localItems
      : localItems.filter((item) => {
          if (filter === 'open') return item.status === 'open'
          if (filter === 'done') return item.status === 'done'
          if (filter === 'overdue') return item.status === 'overdue'
          return true
        })

  const handleToggle = (id: string) => {
    const item = localItems.find((i) => i.id === id)
    if (!item) return

    const newStatus = item.status === 'open' ? 'done' : 'open'
    const updatedItems = localItems.map((i) => (i.id === id ? { ...i, status: newStatus as 'open' | 'done' | 'overdue' } : i))
    setLocalItems(updatedItems)

    if (onStatusChange) {
      onStatusChange(id, newStatus as 'open' | 'done' | 'overdue')
    }
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'done':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'overdue':
        return 'bg-[#e74c3c]/20 text-[#e74c3c] border-[#e74c3c]/30'
      case 'open':
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    }
  }

  const stats = {
    total: localItems.length,
    open: localItems.filter((i) => i.status === 'open').length,
    done: localItems.filter((i) => i.status === 'done').length,
    overdue: localItems.filter((i) => i.status === 'overdue').length,
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-[#7a88a8]">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No action items yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <Tabs defaultValue="all" value={filter} onValueChange={(v) => setFilter(v as 'all' | 'open' | 'done' | 'overdue')}>
        <TabsList className="bg-[#0a1628] border-[#1a2540]">
          <TabsTrigger value="all">
            All ({stats.total})
          </TabsTrigger>
          <TabsTrigger value="open">
            Open ({stats.open})
          </TabsTrigger>
          <TabsTrigger value="done">
            Done ({stats.done})
          </TabsTrigger>
          <TabsTrigger value="overdue">
            Overdue ({stats.overdue})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="space-y-3 mt-4">
          {filteredItems.length === 0 ? (
            <div className="text-center py-8 text-[#7a88a8]">
              No items in this category
            </div>
          ) : (
            filteredItems.map((item) => {
              const isOverdue = item.status === 'overdue'
              const isDone = item.status === 'done'

              return (
                <div
                  key={item.id}
                  className={`p-4 bg-[#0a1628] rounded-lg border transition-colors ${
                    isOverdue ? 'border-[#e74c3c]/50 bg-[#e74c3c]/5' : 'border-[#1a2540]'
                  } ${isDone ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <button
                      onClick={() => handleToggle(item.id)}
                      className="mt-1 flex-shrink-0 text-[#7a88a8] hover:text-[#e74c3c] transition-colors"
                      title={isDone ? 'Mark as open' : 'Mark as done'}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h4
                        className={`font-medium break-words ${
                          isDone ? 'text-[#7a88a8] line-through' : 'text-white'
                        }`}
                      >
                        {item.title}
                      </h4>
                      <p className="text-[#7a88a8] text-sm mt-1 break-words">
                        {item.description}
                      </p>

                      {/* Meta info */}
                      <div className="flex flex-wrap items-center gap-3 mt-3 text-xs">
                        <span className="text-[#7a88a8]">
                          Due: {new Date(item.dueDate).toLocaleDateString()}
                        </span>
                        <span className="text-[#7a88a8]">•</span>
                        <span className="text-[#7a88a8] truncate">{item.meetingSource}</span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex-shrink-0">
                      <Badge
                        variant="outline"
                        className={`${getStatusColor(item.status)} border capitalize whitespace-nowrap`}
                      >
                        {item.status === 'overdue' ? 'Overdue' : item.status}
                      </Badge>
                    </div>

                    {/* Overdue indicator */}
                    {isOverdue && (
                      <div className="flex-shrink-0">
                        <AlertCircle className="w-5 h-5 text-[#e74c3c]" />
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
