import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'

interface MiniChartProps {
  data: number[]
  labels?: string[]
  height?: number
  className?: string
}

/** 纯 CSS/div 柱状图:无图表库依赖,做减法 */
export function MiniChart({ data, labels, height = 120, className }: MiniChartProps) {
  const max = Math.max(...data, 1)

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-end gap-1" style={{ height }}>
        {data.map((v, i) => (
          <Tooltip
            key={`bar-${i}`}
            content={labels?.[i] ? `${labels[i]}: ${v}` : String(v)}
          >
            <div className="group relative flex-1">
              <div
                className="absolute bottom-0 w-full rounded-sm bg-primary/70 transition-colors group-hover:bg-primary"
                style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 2 : 0 }}
              />
            </div>
          </Tooltip>
        ))}
      </div>
      {labels && labels.length > 0 && (
        <div className="mt-1.5 flex gap-1">
          {labels.map((l, i) => (
            <span
              key={`label-${i}`}
              className="flex-1 break-words text-center text-xs text-muted-foreground"
            >
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
