// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-815966 反向用例:交接包「段 → 空态文案键」映射必须完备。
 *
 * `HandoffSection` 是四档封闭集(shared/handoff-package.ts:39)。原写法是
 * `Partial<Record<HandoffSection, string>>` 且只列三档 —— `diagnosis` 静默缺席,
 * 新增第五段交接位而忘配空态文案时 `tsc` 一个字都不吭声。
 * 现已改为完备 `Record<HandoffSection, string | null>`(`diagnosis` 显式登记 null)。
 */
import { describe, expect, it } from 'vitest'
import { HANDOFF_SECTIONS, type HandoffSection } from '@ihui/shared/chat/handoff-package'
import { EMPTY_KEY } from '../handoff-package-card'

describe('G-815966 / EMPTY_KEY 完备性(反向用例)', () => {
  it('故意漏掉 diagnosis 一档 ⇒ 必须编译期报错', () => {
    // ⚠️ 注解写 `typeof EMPTY_KEY`(生产表自身类型),不在测试里重抄 Record<…> ——
    //    重抄的那份与生产无关,生产退回 Partial 时测试照样绿,守卫形同虚设。
    //    绑 typeof 后:生产完备 ⇒ 漏一档报错 ⇒ 被抑制;退回 Partial ⇒ ts2578 判红。
    // @ts-expect-error 故意漏一档:完备 Record<Union, T|null> 缺键必须报错。
    const _missingOne: typeof EMPTY_KEY = {
      fixSteps: 'empty.fixSteps',
      evidence: 'empty.evidence',
      productSurface: 'empty.productSurface',
    }
    expect(_missingOne.diagnosis).toBeUndefined()
  })

  it('封闭集新增一段时,这行必须判红(判据=Exclude 归零)', () => {
    type Unhandled = Exclude<HandoffSection, 'diagnosis' | 'fixSteps' | 'evidence' | 'productSurface'>
    const _noUnhandledSection: Unhandled extends never ? true : { missing: Unhandled } = true
    expect(_noUnhandledSection).toBe(true)
  })

  it('四段全部显式登记(不许靠"表里没有"来表达"这一段不需要")', () => {
    // 键集必须与封闭集逐字相等:漏一档 ⇒ size 对不上;多一档 ⇒ Object.keys 对不上。
    expect(Object.keys(EMPTY_KEY).sort()).toEqual([...HANDOFF_SECTIONS].sort())
  })
})

describe('G-815966 / EMPTY_KEY 完备性(运行时)', () => {
  it('每个非 null 键都指向非空词包键(挡空串 / undefined 占位)', () => {
    for (const section of HANDOFF_SECTIONS) {
      const key = EMPTY_KEY[section]
      if (key === null) continue
      expect(typeof key, `段 ${section} 的词包键不是字符串`).toBe('string')
      expect(key.length, `段 ${section} 的词包键是空串`).toBeGreaterThan(0)
    }
  })

  it('空态词包键都在 ai.pane.handoff.empty.* 命名空间下(不越命名空间取词)', () => {
    for (const section of HANDOFF_SECTIONS) {
      const key = EMPTY_KEY[section]
      if (key === null) continue
      expect(key, `段 ${section} 的词包键未落在 empty.* 下`).toMatch(/^empty\./)
    }
  })

  it('diagnosis 段显式为 null(它有专属渲染分支,永不显示空态文案)', () => {
    // 这条断言的作用是把"显式 null"钉成有意决定:改成漏键、或误配一个键,都会判红。
    expect(EMPTY_KEY.diagnosis).toBeNull()
  })
})