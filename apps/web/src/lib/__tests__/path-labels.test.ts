// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
    // use-cases 顶层已注册(/use-cases → useCases.title),剥离 /ko 后命中该前缀
    expect(resolvePathLabelSpec('/ko/use-cases/ai-translation')).toEqual({
      ns: 'useCases',
      key: 'title',
    })
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

  it('/self-media/automation 精确命中 selfMedia.automation(EXTRA_PATH_LABELS 注册)', () => {
    expect(resolvePathLabelSpec('/self-media/automation')).toEqual({
      ns: 'selfMedia',
      key: 'automation',
    })
  })

  it('/zh-CN/self-media/automation 剥离前缀后命中 selfMedia.automation', () => {
    expect(resolvePathLabelSpec('/zh-CN/self-media/automation')).toEqual({
      ns: 'selfMedia',
      key: 'automation',
    })
  })

  it('/compare 精确命中 compare.title(新建命名空间)', () => {
    expect(resolvePathLabelSpec('/compare')).toEqual({ ns: 'compare', key: 'title' })
  })

  it('/use-cases/ai-design 精确命中 useCases.title(新建命名空间)', () => {
    expect(resolvePathLabelSpec('/use-cases/ai-design')).toEqual({
      ns: 'useCases',
      key: 'title',
    })
  })

  it('/legal/terms 精确命中 legal.terms.title(新建法律子命名空间)', () => {
    expect(resolvePathLabelSpec('/legal/terms')).toEqual({
      ns: 'legal.terms',
      key: 'title',
    })
  })

  it('/admin/ai-skills 精确命中 adminAiSkills.skillName(现有命名空间新 key)', () => {
    expect(resolvePathLabelSpec('/admin/ai-skills')).toEqual({
      ns: 'adminAiSkills',
      key: 'skillName',
    })
  })

  it('/download 精确命中 download.title(新建命名空间)', () => {
    expect(resolvePathLabelSpec('/download')).toEqual({ ns: 'download', key: 'title' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
