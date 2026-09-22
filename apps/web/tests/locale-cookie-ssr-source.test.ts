// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * 语言偏好的 SSR 真值源与"单一写入口"守门(2026-09-22)
 *
 * 背景:语言是客户端 store 驱动的,但 `<html lang>` 要服务端首帧就正确(number-format.ts
 * 与 ai-news 4 个组件拿 documentElement.lang 当取词口径),故偏好必须镜像进 cookie。
 * 本文件钉两件事:①镜像写入点收敛在 setLocale(而不是每个调用方各写一份 document.cookie);
 * ②layout 真的读这个 cookie 决定 lang。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  LOCALE_COOKIE,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  isSupportedLocale,
  writeLocaleCookie,
} from '../src/lib/locale-cookie'
import { useLanguageStore } from '../src/stores/language'

function findRepoRoot(): string {
  let dir = process.cwd()
  for (let depth = 0; depth < 6; depth += 1) {
    if (existsSync(join(dir, 'packages/i18n/messages/web/zh-CN.json'))) return dir
    dir = dirname(dir)
  }
  throw new Error('未能定位仓库根')
}

const read = (rel: string) => readFileSync(join(findRepoRoot(), rel), 'utf8')

describe('locale-cookie — SSR 真值源', () => {
  beforeEach(() => {
    useLanguageStore.setState({ locale: DEFAULT_LOCALE })
  })

  it('SUPPORTED_LOCALES 全部通过校验,非语言值一律拒绝', () => {
    for (const code of SUPPORTED_LOCALES) {
      expect(isSupportedLocale(code)).toBe(true)
    }
    // 反向哨兵:判据若被写坏(如只判 typeof string),这几条会漏
    expect(isSupportedLocale('zh')).toBe(false)
    expect(isSupportedLocale('EN')).toBe(false)
    expect(isSupportedLocale('')).toBe(false)
    expect(isSupportedLocale(undefined)).toBe(false)
    expect(isSupportedLocale('en-US')).toBe(false)
  })

  it('writeLocaleCookie 写的是 path=/ 且带 max-age + samesite', () => {
    writeLocaleCookie('ja')
    expect(document.cookie).toContain(`${LOCALE_COOKIE}=ja`)
    // jsdom 不回显 path/samesite 等属性,故断言实现源码而非 cookie 字符串
    const impl = read('apps/web/src/lib/locale-cookie.ts')
    expect(impl).toContain('path=/')
    expect(impl).toContain('max-age=31536000')
    expect(impl).toContain('samesite=lax')
  })

  it('setLocale 同时落 store 与 cookie(镜像写入点收敛在 store)', () => {
    useLanguageStore.getState().setLocale('ko')
    expect(useLanguageStore.getState().locale).toBe('ko')
    expect(document.cookie).toContain(`${LOCALE_COOKIE}=ko`)
  })

  it('layout 从 cookie 取 lang,且不再有组件各自手写 locale cookie', () => {
    const layout = read('apps/web/app/layout.tsx')
    expect(layout).toContain('await cookies()')
    expect(layout).toContain('LOCALE_COOKIE')
    expect(layout).toContain('isSupportedLocale')
    // 单一写入口:除 lib/locale-cookie.ts 外,任何组件/hook 都不得再写 locale cookie
    const writers = [
      'apps/web/src/components/sidebar/SidebarUserRow.tsx',
      'apps/web/src/components/settings/ThemeBackupSync.tsx',
      'apps/web/src/providers/i18n-provider.tsx',
      'apps/web/src/stores/language.ts',
    ]
    for (const file of writers) {
      expect(read(file), file).not.toMatch(/document\.cookie\s*=\s*['"`]?locale/)
    }
    expect(read('apps/web/src/lib/locale-cookie.ts')).toMatch(/document\.cookie\s*=/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
