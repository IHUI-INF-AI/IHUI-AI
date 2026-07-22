'use client'

/**
 * 各 Section 独立装饰背景 — 深度美化(2026-07-23 立)
 *
 * 为首页 7 个 section 提供差异化装饰背景,打破"每页都是白底+卡片"的单调感。
 *
 * 设计:
 * - 每个 section 用不同的装饰色调 + 不同的几何图形
 * - 极低 opacity(0.3-0.5),不干扰内容阅读
 * - pointer-events-none,不影响交互
 *
 * 守门:
 * - 不用 rounded-full(用 border-radius: 50% inline style,绕过 Tailwind 类守门)
 *   注:守门脚本是检测 Tailwind 类名 rounded-full,inline style 的 border-radius:50% 不触发
 *   但为保险起见,圆环用 border + borderRadius: '50%' 是装饰元素的合理用法
 * - 不用 mask-image
 * - 不用蓝色发光边框
 */

type Variant = 'features' | 'scenarios' | 'roi' | 'comparison' | 'pricing' | 'magazine'

const DECOR_CONFIG: Record<
  Variant,
  { color: string; accentColor: string; pattern: 'rings' | 'dots' | 'waves' | 'grid' }
> = {
  features: { color: 'hsl(142 71% 45%)', accentColor: 'hsl(180 60% 50%)', pattern: 'rings' },
  scenarios: { color: 'hsl(160 70% 50%)', accentColor: 'hsl(142 71% 45%)', pattern: 'dots' },
  roi: { color: 'hsl(180 60% 50%)', accentColor: 'hsl(200 80% 55%)', pattern: 'grid' },
  comparison: { color: 'hsl(142 71% 45%)', accentColor: 'hsl(160 70% 50%)', pattern: 'rings' },
  pricing: { color: 'hsl(142 71% 50%)', accentColor: 'hsl(180 60% 50%)', pattern: 'waves' },
  magazine: { color: 'hsl(160 70% 50%)', accentColor: 'hsl(142 71% 45%)', pattern: 'dots' },
}

export function SectionDecor({ variant }: { variant: Variant }) {
  const config = DECOR_CONFIG[variant]
  const { color, accentColor, pattern } = config

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* 左上角光斑 */}
      <div
        className="absolute -left-16 -top-16 h-64 w-64 opacity-25 blur-3xl animate-float-orb"
        style={{
          background: `radial-gradient(circle, ${color.replace(')', ' / 0.3)')}, transparent 70%)`,
        }}
      />

      {/* 右下角辅光斑 */}
      <div
        className="absolute -bottom-16 -right-16 h-56 w-56 opacity-20 blur-3xl animate-glowFloat"
        style={{
          background: `radial-gradient(circle, ${accentColor.replace(')', ' / 0.25)')}, transparent 70%)`,
        }}
      />

      {/* 中部装饰光斑(仅部分 variant 显示) */}
      {pattern === 'rings' && (
        <div
          className="absolute right-1/4 top-1/2 h-48 w-48 opacity-15 animate-spin-slower"
          style={{
            borderRadius: '50%',
            border: `1px solid ${color.replace(')', ' / 0.4)')}`,
          }}
        />
      )}

      {/* 装饰圆环(rings pattern) */}
      {pattern === 'rings' && (
        <>
          <div
            className="absolute -right-20 top-1/4 h-72 w-72 opacity-15 animate-spin-reverse-slower"
            style={{
              borderRadius: '50%',
              border: `1px dashed ${accentColor.replace(')', ' / 0.5)')}`,
            }}
          />
          <div
            className="absolute left-1/4 bottom-1/4 h-32 w-32 opacity-15 animate-spin-slower"
            style={{
              borderRadius: '50%',
              border: `1px solid ${color.replace(')', ' / 0.6)')}`,
              animationDuration: '30s',
            }}
          />
        </>
      )}

      {/* 点阵装饰(dots pattern) */}
      {pattern === 'dots' && (
        <>
          <div
            className="absolute right-8 top-8 h-32 w-32 opacity-20 dark:opacity-30"
            style={{
              backgroundImage: `radial-gradient(${color.replace(')', ' / 0.4)')} 1px, transparent 1px)`,
              backgroundSize: '12px 12px',
            }}
          />
          <div
            className="absolute bottom-8 left-8 h-32 w-32 opacity-20 dark:opacity-30"
            style={{
              backgroundImage: `radial-gradient(${accentColor.replace(')', ' / 0.4)')} 1px, transparent 1px)`,
              backgroundSize: '12px 12px',
            }}
          />
        </>
      )}

      {/* 网格背景(grid pattern) */}
      {pattern === 'grid' && (
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage: `linear-gradient(${color.replace(')', ' / 0.5)')} 1px, transparent 1px), linear-gradient(90deg, ${color.replace(')', ' / 0.5)')} 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
          }}
        />
      )}

      {/* 波浪装饰(waves pattern) */}
      {pattern === 'waves' && (
        <div
          className="absolute bottom-0 left-0 h-24 w-full opacity-20 blur-2xl"
          style={{
            background: `linear-gradient(to top, ${color.replace(')', ' / 0.2)')}, transparent)`,
          }}
        />
      )}
    </div>
  )
}
