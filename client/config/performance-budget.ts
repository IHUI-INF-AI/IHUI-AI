/**
 * P21: 前端构建性能预算配置
 *
 * 定义各资源类型的最大体积、构建警告阈值和性能指标基线。
 * 被 vite.config.ts 和 scripts/check-perf-budget.ts 使用。
 *
 * 用法：
 *   import { PERFORMANCE_BUDGET } from '@/config/performance-budget'
 */

// ============================================================================
// 资源体积预算（单位: KB）
// ============================================================================

export interface ResourceBudget {
  /** 资源类型名称 */
  name: string
  /** 最大允许体积 (KB)，超过则构建失败 */
  maxKB: number
  /** 警告阈值 (KB)，超过则输出警告 */
  warnKB: number
  /** 文件路径 glob 模式 */
  pattern: string
}

export const RESOURCE_BUDGETS: ResourceBudget[] = [
  // ---- JS 预算 ----
  {
    name: 'vue-vendor',
    maxKB: 200,
    warnKB: 150,
    pattern: 'assets/js/vue-vendor-*.js',
  },
  {
    name: 'element-plus',
    maxKB: 500,
    warnKB: 400,
    pattern: 'assets/js/element-plus-*.js',
  },
  {
    name: 'echarts',
    maxKB: 800,
    warnKB: 600,
    pattern: 'assets/js/echarts-*.js',
  },
  {
    name: 'pdf',
    maxKB: 500,
    warnKB: 400,
    pattern: 'assets/js/pdf-*.js',
  },
  {
    name: 'highlight',
    maxKB: 200,
    warnKB: 150,
    pattern: 'assets/js/highlight-*.js',
  },
  {
    name: 'vue-i18n',
    maxKB: 100,
    warnKB: 80,
    pattern: 'assets/js/vue-i18n-*.js',
  },
  {
    name: 'pinia',
    maxKB: 50,
    warnKB: 40,
    pattern: 'assets/js/pinia-*.js',
  },
  {
    name: 'vue-router',
    maxKB: 50,
    warnKB: 40,
    pattern: 'assets/js/vue-router-*.js',
  },
  {
    name: 'axios',
    maxKB: 50,
    warnKB: 40,
    pattern: 'assets/js/axios-*.js',
  },
  // ---- CSS 预算 ----
  {
    name: 'main-css',
    maxKB: 300,
    warnKB: 250,
    pattern: 'assets/css/*.css',
  },
  // ---- 入口 chunk ----
  {
    name: 'entry-chunk',
    maxKB: 100,
    warnKB: 80,
    pattern: 'assets/js/index-*.js',
  },
]

// ============================================================================
// 总体预算
// ============================================================================

export const TOTAL_BUDGET = {
  /** 所有 JS 总体积上限 (KB) */
  totalJS: 3000,
  /** 所有 CSS 总体积上限 (KB) */
  totalCSS: 500,
  /** 单个 chunk 体积警告阈值 (KB) */
  chunkWarning: 500,
  /** 单个 chunk 体积错误阈值 (KB) */
  chunkError: 1000,
  /** 首屏关键资源总体积上限 (KB) */
  firstScreenBudget: 800,
}

// ============================================================================
// Web Vitals 性能基线
// ============================================================================

export interface VitalBaseline {
  name: string
  /** 目标值（P75） */
  target: number
  /** 单位 */
  unit: string
  /** 描述 */
  description: string
}

export const VITALS_BASELINE: VitalBaseline[] = [
  {
    name: 'LCP',
    target: 2500,
    unit: 'ms',
    description: '最大内容绘制 - 衡量加载性能',
  },
  {
    name: 'FID',
    target: 100,
    unit: 'ms',
    description: '首次输入延迟 - 衡量交互性',
  },
  {
    name: 'CLS',
    target: 0.1,
    unit: 'score',
    description: '累积布局偏移 - 衡量视觉稳定性',
  },
  {
    name: 'INP',
    target: 200,
    unit: 'ms',
    description: '交互到下一次绘制 - 衡量响应性',
  },
  {
    name: 'TTFB',
    target: 800,
    unit: 'ms',
    description: '首字节时间 - 衡量服务器响应',
  },
  {
    name: 'FCP',
    target: 1800,
    unit: 'ms',
    description: '首次内容绘制 - 衡量加载开始',
  },
]

// ============================================================================
// 构建时间预算
// ============================================================================

export const BUILD_TIME_BUDGET = {
  /** 开发模式启动时间上限 (ms) */
  devStartup: 10000,
  /** 生产构建时间上限 (ms) */
  prodBuild: 120000,
  /** 类型检查时间上限 (ms) */
  typeCheck: 60000,
  /** 测试运行时间上限 (ms) */
  testRun: 60000,
}

// ============================================================================
// 检测函数
// ============================================================================

export interface BudgetCheckResult {
  passed: boolean
  warnings: string[]
  errors: string[]
}

/**
 * 检测资源体积是否在预算范围内
 */
export function checkResourceBudget(
  assets: { name: string; sizeKB: number }[]
): BudgetCheckResult {
  const warnings: string[] = []
  const errors: string[] = []

  for (const budget of RESOURCE_BUDGETS) {
    // 用 glob 模式匹配资源
    const matching = assets.filter(a => {
      const regex = new RegExp(
        budget.pattern.replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')
      )
      return regex.test(a.name)
    })

    if (matching.length === 0) continue

    const totalKB = matching.reduce((sum, a) => sum + a.sizeKB, 0)

    if (totalKB > budget.maxKB) {
      errors.push(
        `[${budget.name}] 体积 ${totalKB.toFixed(1)}KB 超过上限 ${budget.maxKB}KB`
      )
    } else if (totalKB > budget.warnKB) {
      warnings.push(
        `[${budget.name}] 体积 ${totalKB.toFixed(1)}KB 超过警告阈值 ${budget.warnKB}KB`
      )
    }
  }

  // 检测总体积
  const totalJS = assets
    .filter(a => a.name.endsWith('.js'))
    .reduce((sum, a) => sum + a.sizeKB, 0)
  if (totalJS > TOTAL_BUDGET.totalJS) {
    errors.push(`JS 总体积 ${totalJS.toFixed(1)}KB 超过上限 ${TOTAL_BUDGET.totalJS}KB`)
  }

  const totalCSS = assets
    .filter(a => a.name.endsWith('.css'))
    .reduce((sum, a) => sum + a.sizeKB, 0)
  if (totalCSS > TOTAL_BUDGET.totalCSS) {
    errors.push(`CSS 总体积 ${totalCSS.toFixed(1)}KB 超过上限 ${TOTAL_BUDGET.totalCSS}KB`)
  }

  return {
    passed: errors.length === 0,
    warnings,
    errors,
  }
}

// ============================================================================
// 导出汇总
// ============================================================================

export const PERFORMANCE_BUDGET = {
  resources: RESOURCE_BUDGETS,
  total: TOTAL_BUDGET,
  vitals: VITALS_BASELINE,
  buildTime: BUILD_TIME_BUDGET,
  check: checkResourceBudget,
}

export default PERFORMANCE_BUDGET
