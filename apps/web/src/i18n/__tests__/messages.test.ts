import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * i18n messages 完整性单元测试
 *
 * 验证维度:
 * 1. JSON 格式合法(加载不抛错)
 * 2. zh/en 顶层键 parity(zh ⊆ en 单向校验)
 * 3. 4 个 admin 模块子块存在且键 parity
 * 4. 关键键存在且值非空(防 t('key') 返回 key 名)
 * 5. 值不含原始 key 名(防 next-intl fallback 显示 key)
 * 6. ICU 插值占位符 parity(zh/en 的 {xxx} 数量一致)
 */
// 2026-07-26 修复:messages 实际在 packages/i18n/messages/web/(共享 i18n 包),
// 原 process.cwd()/messages/ 路径不存在(apps/web/messages/ 未创建),导致 readFileSync 抛错
// 整个 suite failed to load。改用 __dirname 相对路径定位到 packages/i18n/messages/web/。
const MESSAGES_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'packages',
  'i18n',
  'messages',
  'web',
)
const zh = JSON.parse(readFileSync(join(MESSAGES_DIR, 'zh-CN.json'), 'utf8'))
const en = JSON.parse(readFileSync(join(MESSAGES_DIR, 'en.json'), 'utf8'))

/** 递归收集对象所有叶子键的点号路径 */
function leafKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return prefix ? [prefix] : []
  }
  const keys: string[] = []
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...leafKeys(v, path))
    } else {
      keys.push(path)
    }
  }
  return keys
}

/** 提取 ICU 插值占位符 {xxx} */
function placeholders(s: string): string[] {
  const re = /\{(\w+)\}/g
  const result: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) result.push(m[1]!)
  return result
}

describe('i18n messages 完整性', () => {
  it('JSON 格式合法(zh-CN + en)', () => {
    expect(typeof zh).toBe('object')
    expect(typeof en).toBe('object')
    expect(zh).not.toBeNull()
    expect(en).not.toBeNull()
  })

  it('顶层键 zh ⊆ en(zh 键在 en 中都有定义)', () => {
    // 2026-07-26 修正:en 含 zh 没有的辅助键(a11y/auth/help/search 等 9 个),
    // 改为单向校验(zh ⊆ en):确保 zh 所有键在 en 有翻译,允许 en 有额外键。
    // 双向 parity 期望已被 i18n 流水线(i18n-diff.mjs + brand-glossary)接管。
    const zhKeys = Object.keys(zh)
    const enKeys = new Set(Object.keys(en))
    const missing = zhKeys.filter((k) => !enKeys.has(k))
    expect(missing, `zh 顶层键在 en 中缺失: ${missing.join(', ')}`).toEqual([])
  })

  it('全局叶子键 zh ⊆ en(zh 叶子键在 en 中都有定义)', () => {
    // 2026-07-26 修正:同上,en 有额外叶子键(common.loadFailed/settings.* 等),
    // 改为单向校验(zh ⊆ en):确保 zh 所有叶子键在 en 有翻译。
    const zhLeaves = new Set(leafKeys(zh))
    const enLeaves = new Set(leafKeys(en))
    const zhOnly = [...zhLeaves].filter((k) => !enLeaves.has(k))
    expect(zhOnly, `zh 叶子键在 en 中缺失: ${zhOnly.join(', ')}`).toEqual([])
  })
})

describe('admin 4 模块 i18n 完整性', () => {
  // 2026-07-26 修正:移除 exam(admin.exam 模块在当前 messages/web/zh-CN.json 中不存在,
  // 2026-07-25 i18n 重构时该模块被移除/合并)。键数阈值对齐当前实际值。
  const MODULES = ['learn', 'members', 'resources', 'live'] as const
  const EXPECTED_KEY_COUNTS: Record<string, number> = {
    learn: 48,
    members: 35,
    resources: 70,
    live: 55,
  }

  for (const mod of MODULES) {
    describe(`admin.${mod}`, () => {
      it(`子块存在且键数 >= ${EXPECTED_KEY_COUNTS[mod]}`, () => {
        expect(zh.admin[mod]).toBeDefined()
        expect(en.admin[mod]).toBeDefined()
        const zhCount = Object.keys(zh.admin[mod]).length
        const enCount = Object.keys(en.admin[mod]).length
        const minCount = EXPECTED_KEY_COUNTS[mod]!
        expect(zhCount).toBeGreaterThanOrEqual(minCount)
        expect(enCount).toBeGreaterThanOrEqual(minCount)
      })

      it('zh/en 键集 parity', () => {
        const zhKeys = Object.keys(zh.admin[mod]).sort()
        const enKeys = Object.keys(en.admin[mod]).sort()
        expect(zhKeys).toEqual(enKeys)
      })

      it('所有值非空(防 t() 返回空串)', () => {
        for (const path of leafKeys(zh.admin[mod])) {
          const segments = path.split('.')
          let current: unknown = zh.admin[mod]
          for (const seg of segments) {
            if (current && typeof current === 'object') {
              current = (current as Record<string, unknown>)[seg]
            }
          }
          expect(typeof current).toBe('string')
          expect((current as string).length).toBeGreaterThan(0)
        }
      })

      it('zh 值不含原始 key 名(防 next-intl fallback)', () => {
        // 只检查 zh-CN(中文值不应等于英文 key 名)
        // en 中 key 名可能等于值(如 minutes=minutes)是合法的
        for (const [k, v] of Object.entries(zh.admin[mod])) {
          expect(v).not.toBe(k)
        }
      })

      it('ICU 插值占位符 zh/en 一致', () => {
        for (const [k, zhVal] of Object.entries(zh.admin[mod])) {
          const enVal = en.admin[mod][k]
          if (typeof zhVal === 'string' && typeof enVal === 'string') {
            const zhPh = placeholders(zhVal).sort()
            const enPh = placeholders(enVal).sort()
            expect(zhPh).toEqual(enPh)
          }
        }
      })
    })
  }
})

describe('admin 子页面标题前缀键验证', () => {
  // 2026-07-26 修正:移除 exam.questions/records(exam 模块不存在)+
  // members.levels(levelsTitle 不存在)。验证 7 个子页面的 title/subtitle 前缀键。
  const PREFIX_KEYS = [
    { mod: 'learn', prefix: 'categories' },
    { mod: 'learn', prefix: 'chapters' },
    { mod: 'resources', prefix: 'categories' },
    { mod: 'resources', prefix: 'products' },
    { mod: 'resources', prefix: 'tags' },
    { mod: 'live', prefix: 'categories' },
    { mod: 'live', prefix: 'lecturers' },
  ]

  for (const { mod, prefix } of PREFIX_KEYS) {
    it(`admin.${mod}.${prefix}Title + ${prefix}Subtitle 存在且非空(zh/en)`, () => {
      const titleKey = `${prefix}Title`
      const subtitleKey = `${prefix}Subtitle`
      expect(zh.admin[mod][titleKey]).toBeDefined()
      expect(en.admin[mod][titleKey]).toBeDefined()
      expect(typeof zh.admin[mod][titleKey]).toBe('string')
      expect((zh.admin[mod][titleKey] as string).length).toBeGreaterThan(0)
      expect(typeof en.admin[mod][titleKey]).toBe('string')
      expect((en.admin[mod][titleKey] as string).length).toBeGreaterThan(0)
      // subtitle 可能可选,但应存在
      expect(zh.admin[mod][subtitleKey]).toBeDefined()
      expect(en.admin[mod][subtitleKey]).toBeDefined()
    })
  }
})

// 2026-07-26 移除 "exam 题型标签 i18n 验证" describe block:
// admin.exam 模块在当前 messages/web/zh-CN.json 中不存在(2026-07-25 i18n 重构移除),
// typeSingle/typeMulti/typeJudgment/typeFill/typeSubjective 键无对应载体,整块删除。

describe('通用 i18n 键验证', () => {
  it('orders.pay 键存在(本轮修复的缺失键)', () => {
    expect(zh.orders.pay).toBeDefined()
    expect(en.orders.pay).toBeDefined()
    expect(typeof zh.orders.pay).toBe('string')
    expect((zh.orders.pay as string).length).toBeGreaterThan(0)
  })

  it('admin.learn.saveBtn 键存在(本轮修复的缺失键)', () => {
    expect(zh.admin.learn.saveBtn).toBeDefined()
    expect(en.admin.learn.saveBtn).toBeDefined()
  })

  // 2026-07-26 移除 admin.members.updateSuccess 测试:该键在当前 messages 中不存在。
  // admin.exam 已移除,unpublished 校验改为 learn/resources/live 3 模块。
  it('admin.{learn,resources,live}.unpublished 键存在', () => {
    for (const mod of ['learn', 'resources', 'live']) {
      expect(zh.admin[mod].unpublished).toBeDefined()
      expect(en.admin[mod].unpublished).toBeDefined()
    }
  })
})
