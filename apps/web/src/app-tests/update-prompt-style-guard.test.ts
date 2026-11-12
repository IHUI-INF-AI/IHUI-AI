// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const read = (rel: string) => fs.readFileSync(path.resolve(here, rel), 'utf8')

const prompt = read('../components/common/UpdatePrompt.tsx')
const notice = read('../components/common/UpdateNoticeCard.tsx')
const gate = read('../components/common/AppVersionGatePrompt.tsx')
const pwa = read('../components/common/PWAUpdatePrompt.tsx')
const shell = read('../components/layout/GlobalShell.tsx')
const css = read('../../app/globals.css')

/** 注释里提到某个类名不算使用/不算定义 —— 判据必须去注释后再认(否则注释能让门假绿/假红)。 */
const stripCode = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

const promptCode = stripCode(prompt)
const noticeCode = stripCode(notice)
const gateCode = stripCode(gate)
const pwaCode = stripCode(pwa)
const shellCode = stripCode(shell)
const cssCode = stripCode(css)

/**
 * 桌面更新提示视觉守卫(2026-11-12 立)。
 *
 * 立因:这一族样式同时存在三处相互矛盾的事实 ——
 *   ① globals.css 里整卡/按钮是硬编码靛蓝 rgba(129,140,248,…) 呼吸发光边框,
 *      与 AGENTS.md §4「不要蓝色发光边框」直接冲突;
 *   ② 组件头注释却写「无蓝色发光边框」;
 *   ③ 那几个类在 JSX 上还在引用,但发光被卡片 overflow-hidden 裁掉,用户看到的是
 *      「有一圈残影但不跟随主题」。
 * 靠人眼复查这种"注释/实现/规范三方不一致"必然复发,故把结论钉成静态判据。
 */
describe('桌面更新提示视觉守卫', () => {
  it('不得出现硬编码靛蓝发光(§4 禁止蓝色发光边框)', () => {
    for (const [name, src] of [
      ['globals.css', cssCode],
      ['UpdatePrompt.tsx', promptCode],
    ] as const) {
      expect(src, name).not.toMatch(/rgba?\(\s*129\s*,\s*140\s*,\s*248/)
      expect(src, name).not.toMatch(/#818cf8/i)
    }
  })

  it('发光族类名已整族删除:组件不得引用,样式表不得定义', () => {
    for (const cls of ['update-card-glow', 'update-btn-orbit', 'update-btn-orbit-glow']) {
      expect(promptCode, cls).not.toContain(cls)
      expect(cssCode, cls).not.toContain(cls)
    }
    // update-orbit-border 只剩 position:relative 空壳,一并删除;注释里作为历史可以出现
    expect(promptCode).not.toMatch(/className=.*update-orbit-border/)
    expect(cssCode).not.toMatch(/^\.update-orbit-border\s*[,{]/m)
  })

  it('状态色走令牌:不得回退 Tailwind 硬编码 red/green 调色板', () => {
    // 暗色卡面上 bg-green-600/10 + text-green-600 实测对比度不足,且不随主题翻转
    expect(promptCode).not.toMatch(/\b(?:text|bg|border|from|to)-(?:red|green|emerald)-\d{2,3}\b/)
    expect(promptCode).toContain('text-danger-text')
    expect(promptCode).toContain('text-success-text')
  })

  it('提示窗必须让开桌面端自绘顶栏(约 50px)', () => {
    // 旧值 top-4(16px):卡片压在标签栏与窗口拖动区上,窄窗口直接盖住前两个标签
    expect(promptCode).toContain('top-14')
    expect(promptCode).not.toMatch(/\btop-4\b/)
  })

  it('更新卡片/强更弹窗投影走唯一档位表,不得用裸 shadow', () => {
    expect(noticeCode).toContain('shadow-elevation-md')
    expect(gateCode).toContain('shadow-elevation-xl')
    for (const [name, src] of [
      ['UpdateNoticeCard', noticeCode],
      ['AppVersionGatePrompt', gateCode],
    ] as const) {
      expect(src, name).not.toMatch(/["'\s]shadow-elevation-lg\b/)
      expect(src, name).not.toMatch(/["'\s]shadow["'\s]/)
    }
  })

  it('强更弹窗必须限高 + 正文可滚:长 releaseNotes 不能把按钮顶出视口', () => {
    expect(gateCode).toMatch(/max-h-\[calc\(100vh-2rem\)\]/)
    expect(gateCode).toContain('overflow-y-auto')
    expect(gateCode).toContain('shrink-0 items-center justify-end')
  })

  it('强更弹窗层级必须高于同列 PWA 浮层(同层时后渲染的卡片会飘在遮罩上)', () => {
    expect(gateCode).toContain('z-max')
    expect(gateCode).not.toContain('z-modal flex items-center justify-center bg-background/80')
  })

  it('完成态整块必须铺满卡片宽(否则按钮行右侧空出一大片)', () => {
    // 实测(2026-11-12,1440×900):父级是 flex 且没给宽度时,这一列缩到内容宽 ——
    // 按钮行止于 x=757,而卡片内容右缘 867,右侧空 110px,倒计时条与上方状态条也不齐。
    expect(promptCode).toMatch(/flex w-full flex-col gap-2/)
    expect(promptCode).toMatch(
      /flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-success\/10/,
    )
    expect(promptCode).toMatch(/flex w-full items-center gap-2/)
  })

  it('卡内按钮圆角跟卡内其它容器同为 8px,不得用 rounded-sm 直角块', () => {
    // 卡片 rounded-xl(12px)、状态条/图标容器 rounded-lg(8px),按钮却是 rounded-sm(4px)
    expect(promptCode).not.toMatch(/rounded-sm[^"']*transition-colors/)
    expect(promptCode).toMatch(/h-8 flex-1 rounded-lg border border-border/)
    expect(promptCode).toMatch(/h-8 flex-1 rounded-lg bg-cta/)
  })

  it('标题必须按状态取词,不得回退成"非 error/up-to-date/done 即 available"的三元链', () => {
    // 旧形态在 downloading 时仍写"发现新版本",而 downloading 键五语种都在却无人引用(死键)
    expect(promptCode).toContain('updateTitleKey')
    expect(promptCode).not.toMatch(/status === 'error'\s*\?\s*t\('error'\)/)
    // 死键必须真的被用起来,不能继续躺在语言包里
    expect(promptCode).toContain("t('downloading')")
  })

  it('下载进度环必须是可访问的 progressbar,读屏能读到真实百分比', () => {
    // 进度行刻意 aria-live="off",若环又没有 role/aria-value,辅助技术全程拿不到进度
    expect(promptCode).toMatch(/role="progressbar"/)
    expect(promptCode).toContain('aria-valuenow={percent}')
    expect(promptCode).toContain('aria-valuemin={0}')
    expect(promptCode).toContain('aria-valuemax={100}')
  })
})

/**
 * 更新提示多端统一守卫(2026-11-13 立)。
 *
 * 立因:同一句"有新版本可用"在 web 与 RN 两端此前形态不一致 —— web 桌面态挂右下角、移动态挂顶栏
 * 下方,且 PWA 提示无任何滑入/滑出动画;RN 端已统一为"顶部下滑挂住横幅 + 滑入/滑出动画"。
 * 这类"两端各写一份定位/动画"必然漂移,故把统一结论钉成静态判据,阻止以后任一端被改回旧形态。
 */
describe('更新提示多端统一(2026-11-13 立)', () => {
  it('web 端 PWA 提示必须顶部挂住(不再是桌面右下角悬浮)', () => {
    // 旧形态桌面右下角 fixed bottom-4 right-4、移动顶栏下方 top-14 通栏,均已废弃
    expect(shellCode).not.toMatch(/fixed bottom-4 right-4/)
    expect(shellCode).toContain('inset-x-0 top-3')
  })

  it('顶部横幅滑入/滑出动画必须在 globals.css 单一真相源定义(不得内联 @keyframes 或散落各处)', () => {
    expect(cssCode).toContain('@keyframes ihui-update-banner-in')
    expect(cssCode).toContain('@keyframes ihui-update-banner-out')
    expect(cssCode).toContain('.animate-update-banner-in')
    expect(cssCode).toContain('.animate-update-banner-out')
  })

  it('PWA 提示必须滑入 + 对称滑出(与 RN 端 Animated translateY 退场对称,禁止"啪一下消失")', () => {
    expect(pwaCode).toContain('animate-update-banner-in')
    expect(pwaCode).toContain('animate-update-banner-out')
    expect(pwaCode).toContain('onAnimationEnd')
  })

  it('PWA 提示文案仍走 appUpdate 单一真相源(与 RN 端同命名空间,由 i18n parity 测试钉住)', () => {
    expect(pwaCode).toContain("useTranslations('appUpdate')")
  })

  it('桌面强更入场必须纯下滑(与 PWA/RN 同语义,禁止含缩放的 slide-in)', () => {
    // 旧 animate-update-slide-in 含 scale 缩放,与 PWA/RN 的纯 translateY 不一致,已废弃
    expect(promptCode).toContain('animate-update-banner-in')
    expect(promptCode).not.toContain('animate-update-slide-in')
  })

  it('桌面强更必须对称退场(与 PWA/RN 同:滑出而非瞬消)', () => {
    expect(promptCode).toContain('animate-update-banner-out')
    expect(promptCode).toContain('onAnimationEnd')
  })
})

// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
