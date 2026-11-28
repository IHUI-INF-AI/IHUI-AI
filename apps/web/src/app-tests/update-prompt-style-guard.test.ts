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

/** 注释里提到某个类名不算使用/不算定义 —— 判据必须去注释后再认。 */
const stripCode = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

const promptCode = stripCode(prompt)
const noticeCode = stripCode(notice)
const gateCode = stripCode(gate)
const pwaCode = stripCode(pwa)
const shellCode = stripCode(shell)
const cssCode = stripCode(css)

/**
 * 桌面更新胶囊视觉守卫（2026-11-24 形态）。
 *
 * 旧版进度横幅已退役：现在只在「新版本已在磁盘装好、当前进程未被打断」时，
 * 右下角常驻一个胶囊。没有进度环/百分比/倒计时/关闭按钮，也不自动重启。
 * 判据锁的正是这套「安静、可忽略」的形态，防止旧横幅那套视觉回潮。
 */
describe('桌面更新胶囊视觉守卫', () => {
  it('不得出现硬编码靛蓝发光（§4 禁止蓝色发光边框）', () => {
    for (const [name, src] of [
      ['globals.css', cssCode],
      ['UpdatePrompt.tsx', promptCode],
    ] as const) {
      expect(src, name).not.toMatch(/rgba?\(\s*129\s*,\s*140\s*,\s*248/)
      expect(src, name).not.toMatch(/#818cf8/i)
    }
  })

  it('发光族类名已整族删除：组件不得引用，样式表不得定义', () => {
    for (const cls of ['update-card-glow', 'update-btn-orbit', 'update-btn-orbit-glow']) {
      expect(promptCode, cls).not.toContain(cls)
      expect(cssCode, cls).not.toContain(cls)
    }
    expect(promptCode).not.toMatch(/className=.*update-orbit-border/)
    expect(cssCode).not.toMatch(/^\.update-orbit-border\s*[,{]/m)
  })

  it('状态色走令牌：不得回退 Tailwind 硬编码 red/green 调色板', () => {
    // 回滚提示与强更提示都必须走 warning 令牌，随主题翻转。
    expect(promptCode).not.toMatch(/\b(?:text|bg|border|from|to)-(?:red|green|emerald)-\d{2,3}\b/)
    expect(promptCode).toContain('text-warning-text')
  })

  it('胶囊必须避开桌面自绘顶栏：右下角挂住，不回退顶部横幅', () => {
    expect(promptCode).toContain('fixed inset-x-4 bottom-5 z-[70]')
    expect(promptCode).toContain('sm:right-6')
    expect(promptCode).not.toMatch(/\btop-14\b/)
  })

  it('投影走唯一档位表，不得用裸 shadow', () => {
    expect(promptCode).toContain('shadow-card')
    expect(noticeCode).toContain('shadow-elevation-md')
    expect(gateCode).toContain('shadow-elevation-xl')
    for (const [name, src] of [
      ['UpdatePrompt', promptCode],
      ['UpdateNoticeCard', noticeCode],
      ['AppVersionGatePrompt', gateCode],
    ] as const) {
      expect(src, name).not.toMatch(/["'\s]shadow-elevation-lg\b/)
      expect(src, name).not.toMatch(/["'\s]shadow["'\s]/)
    }
  })

  it('胶囊卡与按钮形态固定：圆角卡片 + 单行按钮，不再挂进度区', () => {
    expect(promptCode).toContain('rounded-2xl border border-border')
    expect(promptCode).toContain('h-9 shrink-0')
    expect(promptCode).toContain('rounded-md bg-cta')
  })

  it('不得复活假进度：没有 progressbar / 百分比 / 倒计时 / 下载环', () => {
    expect(promptCode).not.toContain('role="progressbar"')
    expect(promptCode).not.toContain('aria-valuenow')
    expect(promptCode).not.toContain('percent')
    expect(promptCode).not.toMatch(/countdown|remainingSeconds|downloadProgress/i)
  })

  it('标题按状态取词：ready / rollback 两条键径，不得三元链兜底', () => {
    expect(promptCode).toContain("t('readyTitle')")
    expect(promptCode).toContain("t('readyRollbackTitle')")
    expect(promptCode).not.toMatch(/status === 'error'\s*\?\s*t\('error'\)/)
  })

  it('强更弹窗必须限高 + 正文可滚：长 releaseNotes 不能把按钮顶出视口', () => {
    expect(gateCode).toMatch(/max-h-\[calc\(100vh-2rem\)\]/)
    expect(gateCode).toContain('overflow-y-auto')
    expect(gateCode).toContain('shrink-0 items-center justify-end')
  })

  it('强更弹窗层级必须高于同列 PWA 浮层', () => {
    expect(gateCode).toContain('z-max')
    expect(gateCode).not.toContain('z-modal flex items-center justify-center bg-background/80')
  })
})

/**
 * PWA/通知卡多端统一守卫（2026-11-13 立，保留至今）。
 */
describe('更新提示多端统一（2026-11-13 立）', () => {
  it('web 端 PWA 提示必须顶部挂住（不再是桌面右下角悬浮）', () => {
    expect(shellCode).not.toMatch(/fixed bottom-4 right-4/)
    expect(shellCode).toContain('inset-x-0 top-3')
  })

  it('顶部横幅滑入/滑出动画必须在 globals.css 单一真相源定义', () => {
    expect(cssCode).toContain('@keyframes ihui-update-banner-in')
    expect(cssCode).toContain('@keyframes ihui-update-banner-out')
    expect(cssCode).toContain('.animate-update-banner-in')
    expect(cssCode).toContain('.animate-update-banner-out')
  })

  it('PWA 提示必须滑入 + 对称滑出，禁止“啪一下消失”', () => {
    expect(pwaCode).toContain('animate-update-banner-in')
    expect(pwaCode).toContain('animate-update-banner-out')
    expect(pwaCode).toContain('onAnimationEnd')
  })

  it('PWA 提示文案仍走 appUpdate 单一真相源', () => {
    expect(pwaCode).toContain("useTranslations('appUpdate')")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
