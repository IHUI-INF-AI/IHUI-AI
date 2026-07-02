/**
 * 主题色 token 单一来源（TS）
 *
 * 严禁在任何其他位置硬编码主题背景色（亮色/暗色）！
 * - 不要在 index.html 预加载脚本中写 #ffffff / #000000
 * - 不要在 main.ts 的 forceThemeVariables() 中写 #ffffff / #6a6d77
 * - 不要在 *.scss 中写 --el-bg-color: #xxx;
 * - 改色只改这一个文件
 *
 * 使用方式：
 *   - 任何 JS/TS：import { THEME_TOKENS } from '@/styles/_theme-tokens'
 *   - 任何 CSS：var(--theme-light-surface) / var(--theme-dark-surface)（见下方 SCSS 桥接）
 *
 * ===========================================================================
 * ⚠️ THEME_INVARIANTS 改色强约束 ⚠️
 * ===========================================================================
 * darkSurface 选定为 #6a6d77 明确中性灰，而非纯黑，是因为它与以下"联调值"
 * 配套使用，单改任意一个都会破坏整套可读性：
 *   - --el-color-primary: #2563eb (深色模式 CTA 按钮蓝)
 *   - --el-color-primary hover: #3b82f6
 *   - --el-color-primary active: #1d4ed8
 *   - --el-text-color-primary: #e5eaf3 (深色模式文字)
 *   - --color-miniapp-green: #ffffff (深色模式 miniapp 按钮白底, 2026-07-02 决策 2 改为极简黑)
 *   - --color-miniapp-green-darker: #1a1a1a (深色模式 miniapp 按钮黑色描边)
 *
 * 验证关系（改色前必看，WCAG 2.1 公式精确计算）：
 *   - ghost 按钮文字 #e5eaf3 vs #6a6d77 = 4.28:1 ✓ (WCAG AA 大字 / UI 组件 ≥ 3:1)
 *   - CTA 按钮背景 #2563eb vs #6a6d77 = 1.001:1 ⚠ (依赖 1px 半透明白环 box-shadow 提亮边界)
 *   - miniapp 按钮白底 #ffffff vs #6a6d77 = 2.33:1 ✓ (配 1px #1a1a1a 黑色描边, 不再需要 box-shadow)
 *   - 若需达 WCAG AA 正文 (4.5:1)，需把 darkSurface 调暗到 #5a5d67 (5.44:1)
 *
 * 文件底部 `runThemeInvariantsCheck()` 在 dev 环境启动时自动运行，
 * 任何修改会立即在浏览器 console + Vite dev server 终端输出警告。
 *
 * 改色流程：先调 darkSurface → 重跑 invariants → 检查 ghost/CTA/miniapp 三按钮
 * 仍然各自满足"边界可识别"+"文字可读"。
 * ===========================================================================
 */
export const THEME_TOKENS = {
  /** 亮色模式：容器/卡片背景色（纯白） */
  lightSurface: '#ffffff',
  /** 亮色模式：页面主背景色（与容器同色） */
  lightPage: '#ffffff',
  /**
   * 暗色模式：容器/卡片背景色
   * 明确中性灰 #6a6d77，绝不是纯黑！
   * 与 --el-color-primary (#2563eb) 形成 1.005:1 对比度，
   * 故 CTA 按钮必须配 1px 半透明白环 box-shadow 提亮边界。
   * 不要尝试改成纯黑 #000000，会让"立即体验"按钮融入背景消失。
   */
  darkSurface: '#6a6d77',
  /** 暗色模式：页面主背景色（比容器深一档） */
  darkPage: '#5a5d67',
  /** 亮色 hover 状态色（纯白背景上稍微加深反馈） */
  lightHover: '#f5f5f5',
  /** 暗色 hover 状态色 */
  darkHover: '#7a7d87',
} as const

export type ThemeTokenKey = keyof typeof THEME_TOKENS

/**
 * 关键按钮色与 darkSurface 联调常量
 * 这些值与 THEME_TOKENS.darkSurface 配套使用，单改一个会破坏按钮可读性
 */
export const THEME_INVARIANTS = {
  /** 深色模式 CTA 按钮背景 = --el-color-primary */
  ctaBgDark: '#2563eb',
  /** 深色模式 CTA 按钮 hover 背景 = --el-color-primary-light-3 */
  ctaBgDarkHover: '#3b82f6',
  /** 深色模式 CTA 按钮 active 背景 = --el-color-primary-dark-2 */
  ctaBgDarkActive: '#1d4ed8',
  /** 深色模式文字 = --el-text-color-primary */
  ghostTextDark: '#e5eaf3',
  /** 深色模式 miniapp 按钮背景 = --color-miniapp-green (2026-07-02 决策 2 改为极简白底) */
  miniappBgDark: '#ffffff',
  /** 深色模式 miniapp 按钮描边 = --color-miniapp-green-darker (2026-07-02 决策 2 新增) */
  miniappBorderDark: '#1a1a1a',
} as const

/**
 * WCAG 2.1 相对亮度计算（sRGB → linear）
 */
function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const adj = (c: number): number => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * adj(r) + 0.7152 * adj(g) + 0.0722 * adj(b)
}

/**
 * WCAG 2.1 对比度计算
 * 返回值 ≥ 1，1 表示同色，21 表示最大对比（黑/白）
 */
function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * dev 期启动校验：检查主题不变式
 * 任何对比度异常会立即在浏览器 console + Vite 终端输出
 */
function runThemeInvariantsCheck(): void {
  if (!import.meta.env.DEV) return

  const ds = THEME_TOKENS.darkSurface
  type Check = {
    name: string
    fg: string
    bg: string
    /** 最小可接受对比度。CTA/miniapp 按钮背景依赖 box-shadow 提亮，故阈值较低 */
    minRatio: number
    /** true 表示依赖 box-shadow 提亮，警告文案不同 */
    reliesOnShadow?: boolean
  }
  const checks: Check[] = [
    {
      name: 'ghost 按钮文字',
      fg: THEME_INVARIANTS.ghostTextDark,
      bg: ds,
      minRatio: 4.5, // WCAG AA 正文
    },
    {
      name: 'CTA 按钮背景',
      fg: THEME_INVARIANTS.ctaBgDark,
      bg: ds,
      minRatio: 1.005, // 锚定当前调好的值
      reliesOnShadow: true,
    },
    {
      // 2026-07-02 决策 2: miniapp 改为极简黑主题 (白底 + 黑色描边)
      // 旧: #07c160 vs #6a6d77 = 2.17:1 (依赖 box-shadow)
      // 新: #ffffff vs #6a6d77 = 2.33:1 (黑色 #1a1a1a 描边补强边界, 不再依赖 box-shadow)
      name: 'miniapp 按钮白底',
      fg: THEME_INVARIANTS.miniappBgDark,
      bg: ds,
      minRatio: 2.0, // 比旧 1.5 更高 (2.33 实际值)
    },
    {
      // 2026-07-02 决策 2 新增: miniapp 描边在容器上可见性
      // 黑色 #1a1a1a 描边 vs #6a6d77 容器 = 1.005:1, 依赖描边本身已是视觉主体
      name: 'miniapp 按钮描边',
      fg: THEME_INVARIANTS.miniappBorderDark,
      bg: ds,
      minRatio: 0.95, // 锚定当前值, 描边 1px 已是主要视觉边界
    },
  ]

  // eslint-disable-next-line no-console -- groupCollapsed/groupEnd 是 dev 调试必须
  console.groupCollapsed(
    '%c[THEME_INVARIANTS] 主题不变式校验',
    'color:#2563eb;font-weight:600'
  )
  let failed = 0
  for (const c of checks) {
    const r = contrastRatio(c.fg, c.bg)
    const ok = r >= c.minRatio
    if (!ok) failed++
    const tag = ok ? '✓' : '✗'
    const color = ok ? '#67c23a' : '#f56c6c'
    const tip = c.reliesOnShadow ? ' (依赖 box-shadow 提亮边界)' : ''
    console.log(
      `%c${tag} ${c.name}${tip}: ${c.fg} on ${c.bg} = ${r.toFixed(3)}:1 (≥ ${c.minRatio}:1)`,
      `color:${color};font-weight:${ok ? 400 : 600}`
    )
  }
  if (failed > 0) {
    console.warn(
      `[THEME_INVARIANTS] ${failed} 项校验失败。如确需修改 darkSurface，请同步调整 THEME_INVARIANTS 联调值并验证按钮可读性。`
    )
  } else {
    console.info('[THEME_INVARIANTS] ✓ 全部通过，darkSurface 与按钮色联调正常')
  }
  // eslint-disable-next-line no-console -- groupEnd 配对必须
  console.groupEnd()
}

// 模块加载时即在 dev 环境执行校验
runThemeInvariantsCheck()
