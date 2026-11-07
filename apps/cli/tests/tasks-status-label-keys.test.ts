// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `/tasks` 的 11 枚取词必须在五语言都入账(2026-11-04 实测)。
 *
 * 缺陷形态:apps/cli/src/commands/tasks.ts 与 src/tools/todo-write.ts 已把这 11 枚键
 * 写成 `t('cli.…')` 取词(旁边同类行还是硬编码中文),但词包 `packages/i18n/messages/cli/*`
 * 里一枚都没有 ⇒ cli 的 `t()` 在缺键时**返回裸键名本身**,终端里直接打印
 * `cli.taskStatusLabels.pending` 这种字串,五语言皆然。
 * 译法不臆造:pending←mobile-rn invoices.statusPending、inProgress←studyRecord.statusInProgress、
 * completed/cancelled←order.status.*、blocked←shared chat.goal.status.blocked。
 */
import { describe, expect, it } from 'vitest'
import { setLocale, t, type Locale } from '../src/i18n/index.js'

const LOCALES: Locale[] = ['en', 'ja', 'ko', 'zh-CN', 'zh-TW']
const KEYS = [
  'cli.taskStatusLabels.pending',
  'cli.taskStatusLabels.inProgress',
  'cli.taskStatusLabels.completed',
  'cli.taskStatusLabels.cancelled',
  'cli.taskStatusLabels.blocked',
  'cli.tasksHelpCancel',
  'cli.tasksHelpBlock',
  'cli.tasksUsageCancel',
  'cli.tasksUsageBlock',
  'cli.taskCancelledFeedback',
  'cli.taskBlockedFeedback',
]

describe('cli /tasks 取词入账(§19 新增状态词必须同批补齐五语言)', () => {
  for (const locale of LOCALES) {
    it(`${locale}: 11 枚键全部取到词,没有一枚退化成裸键名`, () => {
      setLocale(locale)
      for (const key of KEYS) {
        const value = t(key)
        expect(value, `${locale} 下 ${key} 取不到词 ⇒ 屏幕上会直接显示键名`).not.toBe(key)
        expect(value.length).toBeGreaterThan(0)
      }
    })
  }

  it('状态标签互不相同(五个状态不得被誊成同一个词)', () => {
    setLocale('zh-CN')
    const labels = [
      'pending',
      'inProgress',
      'completed',
      'cancelled',
      'blocked',
    ].map((s) => t(`cli.taskStatusLabels.${s}`))
    expect(new Set(labels).size).toBe(5)
  })

  it('help 行保持 "/tasks …" 命令开头(它被拼在表格 │ 之后,句式改了会串列)', () => {
    setLocale('en')
    for (const key of ['cli.tasksHelpCancel', 'cli.tasksHelpBlock']) {
      expect(t(key).startsWith('/tasks '), `${key} 应以命令名开头`).toBe(true)
    }
  })

  it('usage 行保留 <id> 提示,feedback 行真把 {id}/{content} 插进去(不留占位残迹)', () => {
    setLocale('zh-CN')
    expect(t('cli.tasksUsageCancel')).toContain('<id>')
    const feedback = t('cli.taskCancelledFeedback', { id: '7', content: '写周报' })
    expect(feedback).toContain('#7')
    expect(feedback).toContain('写周报')
    expect(feedback).not.toMatch(/[{}]/)
  })

  it('阴性对照:未入账的键仍按裸键名返回(证明上面 not.toBe 不是恒真断言)', () => {
    setLocale('zh-CN')
    expect(t('cli.thisKeyDoesNotExistAnywhere')).toBe('cli.thisKeyDoesNotExistAnywhere')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
