import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * i18n messages 完整性单元测试
 *
 * 验证维度:
 * 1. JSON 格式合法(加载不抛错)
 * 2. zh/en 顶层键 parity
 * 3. 5 个 admin 模块子块存在且键 parity
 * 4. 关键键存在且值非空(防 t('key') 返回 key 名)
 * 5. 值不含原始 key 名(防 next-intl fallback 显示 key)
 * 6. ICU 插值占位符 parity(zh/en 的 {xxx} 数量一致)
 */
const MESSAGES_DIR = join(process.cwd(), 'messages')
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

  it('顶层键 zh/en parity', () => {
    const zhKeys = Object.keys(zh).sort()
    const enKeys = Object.keys(en).sort()
    expect(zhKeys).toEqual(enKeys)
  })

  it('全局叶子键 zh/en parity(0 差异)', () => {
    const zhLeaves = new Set(leafKeys(zh))
    const enLeaves = new Set(leafKeys(en))
    const zhOnly = [...zhLeaves].filter((k) => !enLeaves.has(k))
    const enOnly = [...enLeaves].filter((k) => !zhLeaves.has(k))
    expect({ zhOnly, enOnly }).toEqual({ zhOnly: [], enOnly: [] })
  })
})

describe('admin 5 模块 i18n 完整性', () => {
  const MODULES = ['exam', 'learn', 'members', 'resources', 'live'] as const
  const EXPECTED_KEY_COUNTS: Record<string, number> = {
    exam: 107,
    learn: 78,
    members: 90,
    resources: 106,
    live: 93,
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
        for (const v of Object.values(zh.admin[mod])) {
          expect(typeof v).toBe('string')
          expect((v as string).length).toBeGreaterThan(0)
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
  // 验证 10 个子页面的 title/subtitle 前缀键都存在
  const PREFIX_KEYS = [
    { mod: 'exam', prefix: 'questions' },
    { mod: 'exam', prefix: 'records' },
    { mod: 'learn', prefix: 'categories' },
    { mod: 'learn', prefix: 'chapters' },
    { mod: 'members', prefix: 'levels' },
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

describe('exam 题型标签 i18n 验证', () => {
  const TYPE_KEYS = ['typeSingle', 'typeMulti', 'typeJudgment', 'typeFill', 'typeSubjective']

  for (const key of TYPE_KEYS) {
    it(`admin.exam.${key} 存在且 zh/en 均非空`, () => {
      expect(zh.admin.exam[key]).toBeDefined()
      expect(en.admin.exam[key]).toBeDefined()
      expect(typeof zh.admin.exam[key]).toBe('string')
      expect(typeof en.admin.exam[key]).toBe('string')
      expect((zh.admin.exam[key] as string).length).toBeGreaterThan(0)
      expect((en.admin.exam[key] as string).length).toBeGreaterThan(0)
    })
  }
})

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

  it('admin.members.updateSuccess 键存在(本轮修复的缺失键)', () => {
    expect(zh.admin.members.updateSuccess).toBeDefined()
    expect(en.admin.members.updateSuccess).toBeDefined()
  })

  it('admin.{exam,learn,resources,live}.unpublished 键存在', () => {
    for (const mod of ['exam', 'learn', 'resources', 'live']) {
      expect(zh.admin[mod].unpublished).toBeDefined()
      expect(en.admin[mod].unpublished).toBeDefined()
    }
  })
})
