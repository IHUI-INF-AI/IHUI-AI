'use client'

import * as React from 'react'

/** 能力雷达图 5 维评分(0-100) */
interface Props {
  capabilities: {
    coding: number
    math: number
    reasoning: number
    creative: number
    chinese: number
  }
  size?: number
}

/** SVG 雷达图(5 维能力,不引入 chart 库,做减法原则) */
export function CapabilityRadar({ capabilities, size = 200 }: Props) {
  const cx = size / 2
  const cy = size / 2
  const radius = size / 2 - 30
  const labels = [
    { key: 'coding' as const, label: '代码' },
    { key: 'math' as const, label: '数学' },
    { key: 'reasoning' as const, label: '推理' },
    { key: 'creative' as const, label: '创意' },
    { key: 'chinese' as const, label: '中文' },
  ]
  const angleStep = (Math.PI * 2) / labels.length
  const startAngle = -Math.PI / 2

  // 5 圈网格(20/40/60/80/100)
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0]

  // 数据点坐标
  const dataPoints = labels.map((l, i) => {
    const val = capabilities[l.key] / 100
    const angle = startAngle + i * angleStep
    return {
      x: cx + Math.cos(angle) * radius * val,
      y: cy + Math.sin(angle) * radius * val,
      label: l.label,
      val: capabilities[l.key],
    }
  })

  // 轴线端点
  const axisEnds = labels.map((_, i) => {
    const angle = startAngle + i * angleStep
    return {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    }
  })

  const polygonPoints = dataPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* 网格圈 */}
      {gridLevels.map((level, idx) => {
        const pts = labels
          .map((_, i) => {
            const angle = startAngle + i * angleStep
            const x = cx + Math.cos(angle) * radius * level
            const y = cy + Math.sin(angle) * radius * level
            return `${x.toFixed(1)},${y.toFixed(1)}`
          })
          .join(' ')
        return (
          <polygon
            key={idx}
            points={pts}
            fill="none"
            className="stroke-muted"
            strokeWidth={0.5}
            opacity={0.5}
          />
        )
      })}
      {/* 轴线 */}
      {axisEnds.map((end, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={end.x}
          y2={end.y}
          className="stroke-muted"
          strokeWidth={0.5}
          opacity={0.5}
        />
      ))}
      {/* 数据多边形 */}
      <polygon
        points={polygonPoints}
        fill="hsl(var(--primary))"
        fillOpacity={0.15}
        stroke="hsl(var(--primary))"
        strokeWidth={1.5}
      />
      {/* 数据点 */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} className="fill-primary" />
      ))}
      {/* 标签 */}
      {labels.map((l, i) => {
        const angle = startAngle + i * angleStep
        const labelR = radius + 18
        const x = cx + Math.cos(angle) * labelR
        const y = cy + Math.sin(angle) * labelR
        const anchor = Math.abs(Math.cos(angle)) < 0.1 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end'
        return (
          <g key={i}>
            <text
              x={x}
              y={y}
              textAnchor={anchor}
              dominantBaseline="middle"
              className="fill-muted-foreground"
              fontSize={9}
              fontWeight={500}
            >
              {l.label}
            </text>
            <text
              x={x}
              y={y + 11}
              textAnchor={anchor}
              dominantBaseline="middle"
              className="fill-foreground"
              fontSize={8}
              fontWeight={600}
            >
              {capabilities[l.key]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
