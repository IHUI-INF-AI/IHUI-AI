// @vitest-environment jsdom
/**
 * path-labels 单元测试(2026-08-12 立)。
 *
 * 覆盖场景:
 * 1. i18n 路由前缀剥离:`/en/docs` / `/ko/use-cases/...` / `/en` 等自动复用非前缀版本 spec
 * 2. 精确匹配回归:`/docs` → nav.docs
 * 3. 根路径回归:`/` → nav.home
 * 4. 兜底:未注册 + 无 i18n 前缀的路径返回 null(由 TagsView 走 deriveTitle)
 * 5. 5 语言前缀全覆盖:`en` / `ko` / `ja` / `zh-TW` / `zh-CN` 全部能剥离
 */
import { describe, it, expect } from 'vitest'
import { resolvePathLabelSpec } from '../path-labels'

describe('resolvePathLabelSpec i18n 路由前缀剥离', () => {
  it('根路径 / 命中 nav.home(回归)', () => {
    expect(resolvePathLabelSpec('/')).toEqual({ ns: 'nav', key: 'home' })
  })

  it('空字符串命中 nav.home(回归)', () => {
    expect(resolvePathLabelSpec('')).toEqual({ ns: 'nav', key: 'home' })
  })

  it('/docs 精确命中 nav.docs(回归)', () => {
    expect(resolvePathLabelSpec('/docs')).toEqual({ ns: 'nav', key: 'docs' })
  })

  it('/pricing 精确命中 nav.pricing(回归)', () => {
    expect(resolvePathLabelSpec('/pricing')).toEqual({ ns: 'nav', key: 'pricing' })
  })

  it('【本任务根因】/en/docs 剥离前缀后命中 nav.docs,不再走 deriveTitle 英文兜底', () => {
    // 修复前:resolvePathLabelSpec('/en/docs') 返回 null → deriveTitle → "Docs"
    // 修复后:stripI18nPrefix('/en/docs') = '/docs' → 精确命中 nav.docs
    expect(resolvePathLabelSpec('/en/docs')).toEqual({ ns: 'nav', key: 'docs' })
  })

  it('/en 剥离前缀后是 /,命中 nav.home', () => {
    expect(resolvePathLabelSpec('/en')).toEqual({ ns: 'nav', key: 'home' })
  })

  it('/en/agents 剥离后命中 nav.agents(侧边栏 FLAT_NAV_ITEMS 自动注册)', () => {
    expect(resolvePathLabelSpec('/en/agents')).toEqual({ ns: 'nav', key: 'agents' })
  })

  it('/en/models 剥离后命中 nav.models(侧边栏 FLAT_NAV_ITEMS 自动注册)', () => {
    expect(resolvePathLabelSpec('/en/models')).toEqual({ ns: 'nav', key: 'models' })
  })

  it('/en/pricing 剥离后命中 nav.pricing(EXTRA_PATH_LABELS 注册)', () => {
    expect(resolvePathLabelSpec('/en/pricing')).toEqual({ ns: 'nav', key: 'pricing' })
  })

  it('/ko/use-cases/ai-translation 多级 i18n 路径正确剥离', () => {
    // use-cases 顶层无精确 entry,但 /use-cases 父级未注册 → 走最长前缀匹配:
    // SORTED_PATH_LABELS 中无任何 entry 的 href 是 /use-cases 前缀 → 全部未命中
    // 但 /ko/use-cases/* 在剥离后变 /use-cases/ai-translation,同样未注册 → 返回 null
    // (本任务根因是 /en/docs 走兜底,其他 i18n 路径未注册的仍走 deriveTitle,符合预期)
    expect(resolvePathLabelSpec('/ko/use-cases/ai-translation')).toBeNull()
  })

  it('所有 5 语言前缀都能剥离(/en /ko /ja /zh-TW /zh-CN)', () => {
    // 这 5 种前缀必须全部被 stripI18nPrefix 识别,避免漏注册导致 fallback 退化
    expect(resolvePathLabelSpec('/en/docs')).toEqual({ ns: 'nav', key: 'docs' })
    expect(resolvePathLabelSpec('/ko/docs')).toEqual({ ns: 'nav', key: 'docs' })
    expect(resolvePathLabelSpec('/ja/docs')).toEqual({ ns: 'nav', key: 'docs' })
    expect(resolvePathLabelSpec('/zh-TW/docs')).toEqual({ ns: 'nav', key: 'docs' })
    expect(resolvePathLabelSpec('/zh-CN/docs')).toEqual({ ns: 'nav', key: 'docs' })
  })

  it('非 i18n 前缀的路径不被误剥离(/english-community 不会被改成 /community)', () => {
    // /english-community 是以 'english' 开头(不在 I18N_PATH_PREFIXES 中),不应被剥离
    // 期望走 longest-prefix 匹配返回 null(此路由未注册)
    expect(resolvePathLabelSpec('/english-community')).toBeNull()
  })

  it('未注册的路径 + 无 i18n 前缀 → 返回 null 走 deriveTitle 兜底(回归)', () => {
    expect(resolvePathLabelSpec('/totally-unknown-path/foo')).toBeNull()
  })

  it('已注册的非 i18n 路径保持精确匹配(/business-card 命中 nav.businessCard)', () => {
    expect(resolvePathLabelSpec('/business-card')).toEqual({
      ns: 'nav',
      key: 'businessCard',
    })
  })
})
