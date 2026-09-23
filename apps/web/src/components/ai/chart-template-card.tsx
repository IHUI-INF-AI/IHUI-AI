// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * D46(2026-09-23 立,G-57):对话内受控图表卡 —— 模板白名单渲染器。
 *
 * 输入为 @ihui/design-tokens parseChartTemplatePayload 解析后的载荷(白名单守卫在前),
 * 渲染规则:
 * - 色值全部来自 chart-colors 同源调色板(CHART_PALETTE / chartText / chartAxis / chartBg),
 *   组件内零硬编码图表色 —— 明暗主题经 isDark 一刀切切换,与 8 端 token 同源;
 * - 形状圆角统一 rx=2(rounded-xs 对应值),字体继承容器(不设 font-family),
 *   圆角/字体规范守门天然通过;
 * - 数据行内数字缺失/非法的行跳过渲染(降级不炸),整体形状仍成立;
 * - 自由 HTML 产物不走本组件(保持既有 iframe 沙箱路径,见 artifact-canvas)。
 */
import * as React from 'react'
import { useTheme } from 'next-themes'
import {
  CHART_PALETTE,
  chartText,
  chartAxis,
  chartBg,
  chartTemplateMeta,
  rnRadius,
  type ChartTemplatePayload,
} from '@ihui/design-tokens'

const W = 560
const H = 280
const PAD = { top: 16, right: 16, bottom: 28, left: 88 }
const BAR_RX = rnRadius.xs

type Item = Record<string, unknown>

/** 行字段取数:数字(含数字字符串)→ number,否则 null */
function num(row: Item, key: string): number | null {
  const v = row[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return null
}

/** 行字段取数:非空字符串,否则 null */
function str(row: Item, key: string): string | null {
  const v = row[key]
  return typeof v === 'string' && v.trim() !== '' ? v : null
}

/** 日期/数字统一成可比较的数值(ISO 字符串走 Date.parse) */
function scalar(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
    const t = Date.parse(v)
    if (Number.isFinite(t)) return t
  }
  return null
}

function color(i: number): string {
  return CHART_PALETTE[i % CHART_PALETTE.length] ?? CHART_PALETTE[0] ?? '#3b82f6'
}

function Svg({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full" data-chart-template-svg>
      <rect x={0} y={0} width={W} height={H} fill={chartBg(isDark)} rx={rnRadius.sm} />
      {children}
    </svg>
  )
}

function Empty({ isDark }: { isDark: boolean }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" data-chart-template-empty>
      <rect x={0} y={0} width={W} height={H} fill={chartBg(isDark)} rx={rnRadius.sm} />
      <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="11" fill={chartText(isDark)}>
        --
      </text>
    </svg>
  )
}

/** 甘特图:行 {label,start,end}(数字偏移或 ISO 日期) */
function Gantt({ rows, isDark }: { rows: readonly Item[]; isDark: boolean }) {
  const pts = rows
    .map((r) => ({ label: str(r, 'label'), s: scalar(r['start']), e: scalar(r['end']) }))
    .filter(
      (p): p is { label: string | null; s: number; e: number } => p.s !== null && p.e !== null,
    )
  if (pts.length === 0) return <Empty isDark={isDark} />
  const min = Math.min(...pts.map((p) => Math.min(p.s, p.e)))
  const max = Math.max(...pts.map((p) => Math.max(p.s, p.e)))
  const span = max - min || 1
  const rowH = Math.min(28, (H - PAD.top - PAD.bottom) / pts.length)
  return (
    <Svg isDark={isDark}>
      {pts.map((p, i) => {
        const y = PAD.top + i * rowH + rowH / 2 - 5
        const x = PAD.left + ((Math.min(p.s, p.e) - min) / span) * (W - PAD.left - PAD.right)
        const w = Math.max(4, (Math.abs(p.e - p.s) / span) * (W - PAD.left - PAD.right))
        return (
          <g key={i}>
            {p.label !== null && (
              <text
                x={PAD.left - 6}
                y={y + 9}
                textAnchor="end"
                fontSize="10"
                fill={chartText(isDark)}
              >
                {p.label}
              </text>
            )}
            <rect x={x} y={y} width={w} height={10} rx={BAR_RX} fill={color(i)} />
          </g>
        )
      })}
    </Svg>
  )
}

/** 桑基图:行 {source,target,value},首现顺序定层,左侧源右测汇 */
function Sankey({ rows, isDark }: { rows: readonly Item[]; isDark: boolean }) {
  const links: { s: string; t: string; v: number }[] = []
  for (const r of rows) {
    const s = str(r, 'source')
    const t = str(r, 'target')
    const v = num(r, 'value')
    if (s !== null && t !== null && v !== null) links.push({ s, t, v })
  }
  if (links.length === 0) return <Empty isDark={isDark} />
  const sources: string[] = []
  const targets: string[] = []
  for (const l of links) {
    if (!sources.includes(l.s)) sources.push(l.s)
    if (!targets.includes(l.t)) targets.push(l.t)
  }
  const maxV = Math.max(...links.map((l) => l.v)) || 1
  const srcH = (H - PAD.top - PAD.bottom) / Math.max(sources.length, 1)
  const tgtH = (H - PAD.top - PAD.bottom) / Math.max(targets.length, 1)
  const x1 = PAD.left - 40
  const x2 = W - PAD.right + 24
  const mid = (x1 + x2) / 2
  return (
    <Svg isDark={isDark}>
      {sources.map((n, i) => {
        const y = PAD.top + i * srcH + srcH / 2
        return (
          <g key={`s-${n}`}>
            <rect x={x1} y={y - 8} width={14} height={16} rx={BAR_RX} fill={color(i)} />
            <text x={x1 - 4} y={y + 3.5} textAnchor="end" fontSize="10" fill={chartText(isDark)}>
              {n}
            </text>
          </g>
        )
      })}
      {targets.map((n, i) => {
        const y = PAD.top + i * tgtH + tgtH / 2
        return (
          <g key={`t-${n}`}>
            <rect x={x2} y={y - 8} width={14} height={16} rx={BAR_RX} fill={color(i)} />
            <text x={x2 + 18} y={y + 3.5} fontSize="10" fill={chartText(isDark)}>
              {n}
            </text>
          </g>
        )
      })}
      {links.map((l, i) => {
        const si = sources.indexOf(l.s)
        const ti = targets.indexOf(l.t)
        const y1 = PAD.top + si * srcH + srcH / 2
        const y2 = PAD.top + ti * tgtH + tgtH / 2
        const h = 3 + (l.v / maxV) * 9
        return (
          <path
            key={i}
            d={`M ${x1 + 14} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
            fill="none"
            stroke={color(si)}
            strokeWidth={h}
            strokeOpacity={0.55}
          />
        )
      })}
    </Svg>
  )
}

/** 雷达图:行 {label,value(0-100)} 为各轴 */
function Radar({ rows, isDark }: { rows: readonly Item[]; isDark: boolean }) {
  const pts = rows
    .map((r) => ({ label: str(r, 'label'), v: num(r, 'value') }))
    .filter((p): p is { label: string | null; v: number } => p.v !== null)
  if (pts.length < 3) return <Empty isDark={isDark} />
  const cx = W / 2
  const cy = H / 2 + 4
  const R = Math.min(H / 2 - 34, 100)
  const angle = (i: number) => (Math.PI * 2 * i) / pts.length - Math.PI / 2
  const poly = (f: (i: number) => number): string =>
    pts
      .map((_, i) => `${cx + Math.cos(angle(i)) * f(i)},${cy + Math.sin(angle(i)) * f(i)}`)
      .join(' ')
  return (
    <Svg isDark={isDark}>
      {[0.33, 0.66, 1].map((k) => (
        <polygon
          key={k}
          points={poly(() => R * k)}
          fill="none"
          stroke={chartAxis(isDark)}
          strokeWidth={1}
        />
      ))}
      {pts.map((_, i) => {
        const x = cx + Math.cos(angle(i)) * R
        const y = cy + Math.sin(angle(i)) * R
        return (
          <line
            key={`ax-${i}`}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke={chartAxis(isDark)}
            strokeWidth={1}
          />
        )
      })}
      <polygon
        points={poly((i) => (R * Math.max(0, Math.min(100, pts[i]?.v ?? 0))) / 100)}
        fill={color(0)}
        fillOpacity={0.28}
        stroke={color(0)}
        strokeWidth={1.5}
      />
      {pts.map((p, i) => {
        const lx = cx + Math.cos(angle(i)) * (R + 16)
        const ly = cy + Math.sin(angle(i)) * (R + 12)
        return p.label !== null ? (
          <text
            key={`lb-${i}`}
            x={lx}
            y={ly}
            textAnchor="middle"
            fontSize="10"
            fill={chartText(isDark)}
          >
            {p.label}
          </text>
        ) : null
      })}
    </Svg>
  )
}

/** 热力图:行 {row,col,value} 三元组 → 网格,色深按值归一 */
function Heatmap({ rows, isDark }: { rows: readonly Item[]; isDark: boolean }) {
  const cells: { row: string; col: string; v: number }[] = []
  const rowNames: string[] = []
  const colNames: string[] = []
  for (const r of rows) {
    const row = str(r, 'row')
    const col = str(r, 'col')
    const v = num(r, 'value')
    if (row === null || col === null || v === null) continue
    if (!rowNames.includes(row)) rowNames.push(row)
    if (!colNames.includes(col)) colNames.push(col)
    cells.push({ row, col, v })
  }
  if (cells.length === 0 || rowNames.length === 0 || colNames.length === 0)
    return <Empty isDark={isDark} />
  const min = Math.min(...cells.map((c) => c.v))
  const max = Math.max(...cells.map((c) => c.v))
  const span = max - min || 1
  const cw = (W - PAD.left - PAD.right) / colNames.length
  const ch = (H - PAD.top - PAD.bottom) / rowNames.length
  return (
    <Svg isDark={isDark}>
      {cells.map((c, i) => {
        const ri = rowNames.indexOf(c.row)
        const ci = colNames.indexOf(c.col)
        const k = (c.v - min) / span
        return (
          <g key={i}>
            <rect
              x={PAD.left + ci * cw}
              y={PAD.top + ri * ch}
              width={Math.max(2, cw - 2)}
              height={Math.max(2, ch - 2)}
              rx={BAR_RX}
              fill={color(0)}
              fillOpacity={0.15 + k * 0.85}
            />
            <text
              x={PAD.left + ci * cw + cw / 2 - 1}
              y={PAD.top + ri * ch + ch / 2 + 3}
              textAnchor="middle"
              fontSize="9"
              fill={isDark ? '#e2e8f0' : '#334155'}
            >
              {c.v}
            </text>
          </g>
        )
      })}
      {rowNames.map((r, i) => (
        <text
          key={`r-${i}`}
          x={PAD.left - 6}
          y={PAD.top + i * ch + ch / 2 + 3}
          textAnchor="end"
          fontSize="10"
          fill={chartText(isDark)}
        >
          {r}
        </text>
      ))}
      {colNames.map((c, i) => (
        <text
          key={`c-${i}`}
          x={PAD.left + i * cw + cw / 2 - 1}
          y={H - 10}
          textAnchor="middle"
          fontSize="10"
          fill={chartText(isDark)}
        >
          {c}
        </text>
      ))}
    </Svg>
  )
}

/** 漏斗图:行 {label,value},按值降序梯形层 */
function Funnel({ rows, isDark }: { rows: readonly Item[]; isDark: boolean }) {
  const pts = rows
    .map((r) => ({ label: str(r, 'label'), v: num(r, 'value') }))
    .filter((p): p is { label: string | null; v: number } => p.v !== null)
    .sort((a, b) => b.v - a.v)
  if (pts.length === 0) return <Empty isDark={isDark} />
  const maxV = pts[0]?.v || 1
  const layerH = (H - PAD.top - PAD.bottom) / pts.length
  const midX = W / 2
  return (
    <Svg isDark={isDark}>
      {pts.map((p, i) => {
        const wTop = ((pts[i - 1]?.v ?? maxV) / maxV) * (W - PAD.left - PAD.right)
        const w = (p.v / maxV) * (W - PAD.left - PAD.right)
        const y = PAD.top + i * layerH
        const xTop = midX - wTop / 2
        const x = midX - w / 2
        return (
          <g key={i}>
            <path
              d={`M ${xTop} ${y} L ${xTop + wTop} ${y} L ${x + w} ${y + layerH - 2} L ${x} ${y + layerH - 2} Z`}
              fill={color(i)}
              fillOpacity={0.9}
            />
            <text
              x={midX}
              y={y + layerH / 2 + 3.5}
              textAnchor="middle"
              fontSize="10"
              fill={chartBg(isDark)}
            >
              {p.label !== null ? `${p.label} · ${p.v}` : `${p.v}`}
            </text>
          </g>
        )
      })}
    </Svg>
  )
}

/** 时序图:行 {t,v} → 折线 + 数据点 */
function Timeseries({ rows, isDark }: { rows: readonly Item[]; isDark: boolean }) {
  const pts = rows
    .map((r) => ({ label: str(r, 't') ?? String(r['t'] ?? ''), v: num(r, 'v') }))
    .filter((p) => p.v !== null)
    .map((p) => ({ label: p.label, v: p.v as number }))
  if (pts.length < 2) return <Empty isDark={isDark} />
  const min = Math.min(...pts.map((p) => p.v))
  const max = Math.max(...pts.map((p) => p.v))
  const span = max - min || 1
  const x = (i: number) => PAD.left + (i / (pts.length - 1)) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - (v - min) / span) * (H - PAD.top - PAD.bottom - 10) + 5
  const line = pts.map((p, i) => `${x(i)},${y(p.v)}`).join(' ')
  const labelEvery = Math.ceil(pts.length / 8)
  return (
    <Svg isDark={isDark}>
      <line
        x1={PAD.left - 20}
        y1={y(min)}
        x2={W - PAD.right}
        y2={y(min)}
        stroke={chartAxis(isDark)}
        strokeWidth={1}
      />
      <polyline points={line} fill="none" stroke={color(0)} strokeWidth={2} />
      {pts.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.v)} r={2.5} fill={color(0)} />
      ))}
      {pts.map((p, i) =>
        i % labelEvery === 0 ? (
          <text
            key={`l-${i}`}
            x={x(i)}
            y={H - 10}
            textAnchor="middle"
            fontSize="9"
            fill={chartText(isDark)}
          >
            {p.label}
          </text>
        ) : null,
      )}
    </Svg>
  )
}

/** 树流图:行 {label,parent?} — parent 缺省为根,两段层次绘制 */
function Treeflow({ rows, isDark }: { rows: readonly Item[]; isDark: boolean }) {
  const nodes: { label: string; parent: string | null }[] = []
  for (const r of rows) {
    const label = str(r, 'label')
    if (label === null) continue
    nodes.push({ label, parent: str(r, 'parent') })
  }
  if (nodes.length === 0) return <Empty isDark={isDark} />
  const roots = nodes.filter((n) => n.parent === null)
  const children = nodes.filter((n) => n.parent !== null)
  const rootX = PAD.left + 60
  const childX = W - PAD.right - 40
  const rH = (H - PAD.top - PAD.bottom) / Math.max(roots.length, 1)
  const cH = (H - PAD.top - PAD.bottom) / Math.max(children.length, 1)
  const cyMid = H / 2
  return (
    <Svg isDark={isDark}>
      {roots.map((n, i) => {
        const y = PAD.top + i * rH + rH / 2
        return (
          <g key={`r-${i}`}>
            <rect
              x={rootX - 40}
              y={y - 9}
              width={80}
              height={18}
              rx={BAR_RX}
              fill={color(0)}
              fillOpacity={0.85}
            />
            <text x={rootX} y={y + 3.5} textAnchor="middle" fontSize="10" fill={chartBg(isDark)}>
              {n.label}
            </text>
          </g>
        )
      })}
      {children.map((n, i) => {
        const pIdx = roots.findIndex((r) => r.label === (n.parent ?? ''))
        const py = pIdx >= 0 ? PAD.top + pIdx * rH + rH / 2 : cyMid
        const y = PAD.top + i * cH + cH / 2
        const px = rootX + 40
        return (
          <g key={`c-${i}`}>
            <path
              d={`M ${px} ${py} C ${px + 40} ${py}, ${childX - 50} ${y}, ${childX - 4} ${y}`}
              fill="none"
              stroke={color(1)}
              strokeWidth={1.5}
              strokeOpacity={0.6}
            />
            <rect
              x={childX - 4}
              y={y - 9}
              width={80}
              height={18}
              rx={BAR_RX}
              fill={color(1)}
              fillOpacity={0.85}
            />
            <text
              x={childX + 36}
              y={y + 3.5}
              textAnchor="middle"
              fontSize="10"
              fill={chartBg(isDark)}
            >
              {n.label}
            </text>
          </g>
        )
      })}
    </Svg>
  )
}

/** 对比卡:行 {label,a,b} 双序列水平条 */
function Comparison({ rows, isDark }: { rows: readonly Item[]; isDark: boolean }) {
  const pts = rows
    .map((r) => ({ label: str(r, 'label'), a: num(r, 'a'), b: num(r, 'b') }))
    .filter((p) => p.a !== null && p.b !== null)
    .map((p) => ({ label: p.label, a: p.a as number, b: p.b as number }))
  if (pts.length === 0) return <Empty isDark={isDark} />
  const max = Math.max(...pts.flatMap((p) => [p.a, p.b])) || 1
  const rowH = (H - PAD.top - PAD.bottom) / pts.length
  const barW = (W - PAD.left - PAD.right) / 2 - 8
  return (
    <Svg isDark={isDark}>
      {pts.map((p, i) => {
        const y = PAD.top + i * rowH
        const wa = (Math.max(0, p.a) / max) * barW
        const wb = (Math.max(0, p.b) / max) * barW
        return (
          <g key={i}>
            {p.label !== null && (
              <text
                x={PAD.left - 6}
                y={y + rowH / 2 + 3.5}
                textAnchor="end"
                fontSize="10"
                fill={chartText(isDark)}
              >
                {p.label}
              </text>
            )}
            <rect
              x={PAD.left}
              y={y + 4}
              width={Math.max(2, wa)}
              height={9}
              rx={BAR_RX}
              fill={color(0)}
            />
            <rect
              x={PAD.left}
              y={y + 16}
              width={Math.max(2, wb)}
              height={9}
              rx={BAR_RX}
              fill={color(1)}
            />
            <text
              x={PAD.left + Math.max(2, wa) + 5}
              y={y + 12}
              fontSize="9"
              fill={chartText(isDark)}
            >
              {p.a}
            </text>
            <text
              x={PAD.left + Math.max(2, wb) + 5}
              y={y + 24}
              fontSize="9"
              fill={chartText(isDark)}
            >
              {p.b}
            </text>
          </g>
        )
      })}
    </Svg>
  )
}

const RENDERERS: Readonly<
  Record<string, (p: { rows: readonly Item[]; isDark: boolean }) => React.ReactElement>
> = {
  gantt: Gantt,
  sankey: Sankey,
  radar: Radar,
  heatmap: Heatmap,
  funnel: Funnel,
  timeseries: Timeseries,
  treeflow: Treeflow,
  comparison: Comparison,
}

/** 受控图表卡入口:payload 已过白名单守卫(见 @ihui/design-tokens parseChartTemplatePayload) */
export function ChartTemplateCard({ payload }: { payload: ChartTemplatePayload }) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const Render = RENDERERS[payload.template]
  const meta = chartTemplateMeta(payload.template)
  return (
    <div
      className="overflow-hidden rounded-sm border border-border/40"
      data-testid="chart-template-card"
      data-chart-template={payload.template}
    >
      <div className="flex items-center justify-between bg-muted/30 px-2 py-1">
        <span className="text-[10px] font-medium text-muted-foreground/80">
          {payload.title ?? meta?.label ?? payload.template}
        </span>
        <span className="text-[10px] text-muted-foreground/50">{payload.data.length}</span>
      </div>
      <div className="p-1">
        {Render !== undefined ? (
          <Render rows={payload.data} isDark={isDark} />
        ) : (
          <Empty isDark={isDark} />
        )}
      </div>
    </div>
  )
}

export default ChartTemplateCard
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
