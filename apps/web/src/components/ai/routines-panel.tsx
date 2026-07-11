'use client'

import { Clock, Play, Calendar } from 'lucide-react'

import { Button, Switch } from '@ihui/ui'

interface RoutineItem {
  id: string
  name: string
  schedule: string
  enabled: boolean
  lastRun?: string
}

interface RoutinesPanelProps {
  routines: RoutineItem[]
  onToggle?: (id: string) => void
  onRun?: (id: string) => void
}

export function RoutinesPanel({ routines, onToggle, onRun }: RoutinesPanelProps) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b px-4 py-2.5">
        <h3 className="text-sm font-semibold">例行程序</h3>
      </div>
      <ul className="divide-y">
        {routines.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">暂无例行程序</p>
        ) : (
          routines.map((routine) => (
            <li key={routine.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium">{routine.name}</p>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-0.5">
                    <Calendar className="h-3 w-3" />
                    {routine.schedule}
                  </span>
                  {routine.lastRun && (
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-3 w-3" />
                      {routine.lastRun}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 shrink-0"
                onClick={() => onRun?.(routine.id)}
              >
                <Play className="h-3 w-3" />
                运行
              </Button>
              <Switch checked={routine.enabled} onCheckedChange={() => onToggle?.(routine.id)} />
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

export default RoutinesPanel
