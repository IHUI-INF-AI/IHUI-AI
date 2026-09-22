// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * use-ai-ws-business.ts 取词契约测试(2026-09-22 硬编码中文存量清理批次)
 *
 * 三层判据:
 * 1. 源码剥离注释后残留的 CJK 行必须**恰好**是 3 处协议匹配串(上游中文报文关键字),
 *    任何一处被"顺手翻译"即红 —— 那会让 checkTokenBalance / 流式完成判定静默失效。
 * 2. 界面串一律经 t()/tc() 取词,且 aiWs 9 键 + chat.loginRequired 在 5 语言可解析
 *    (缺键会让非中文界面回退中文或直接报 FORMAT_ERROR)。
 * 3. 用到 t/tc 的 useCallback 必须把它写进依赖数组 —— 本仓 eslint 只开了
 *    react-hooks/rules-of-hooks,**没有**开 exhaustive-deps,漏依赖不会被 lint 拦,
 *    所以这条只能靠本测试钉住。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const WEB_ROOT = resolve(__dirname, '..')
const REPO_ROOT = resolve(WEB_ROOT, '..', '..')
const SOURCE = readFileSync(join(WEB_ROOT, 'src/hooks/use-ai-ws-business.ts'), 'utf8')

const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
type Locale = (typeof LOCALES)[number]

const AI_WS_KEYS = [
  'videoDone',
  'videoFailed',
  'videoOneImageOnly',
  'sendFailed',
  'connectFailed',
  'connectFailedShort',
  'connectError',
  'creditLowTitle',
  'creditLowDesc',
] as const

/** 取词调用点(与界面串一一对应) */
const CALL_SITES = [
  "t('videoDone')",
  "t('videoFailed')",
  "t('videoOneImageOnly')",
  "t('sendFailed')",
  "t('connectFailed')",
  "t('connectFailedShort')",
  "t('connectError')",
  "t('creditLowTitle')",
  "t('creditLowDesc', { min: 50000 })",
  "tc('loginRequired')",
] as const

function loadMessages(locale: Locale): Record<string, unknown> {
  const file = join(REPO_ROOT, 'packages/i18n/messages/web', `${locale}.json`)
  return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
}

function pick(locale: Locale, path: string[]): string | undefined {
  const messages = loadMessages(locale)
  const value = path.reduce<unknown>(
    (acc, key) => (acc as Record<string, unknown> | undefined)?.[key],
    messages,
  )
  return typeof value === 'string' ? value : undefined
}

/** 去掉行注释 / 块注释 / JSX 注释,只留真实代码 */
function stripComments(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
}

function cjkLines(src: string): string[] {
  return stripComments(src)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /[\u3400-\u9fff]/.test(line))
}

/** 拆出每个 React.useCallback 的函数体与依赖数组文本 */
function useCallbacks(src: string): Array<{ body: string; deps: string[] }> {
  return src
    .split('React.useCallback(')
    .slice(1)
    .map((part) => {
      const matched = part.match(/\n\s*\[([^\]]*)\],\n\s*\)/)
      return {
        body: matched ? part.slice(0, matched.index) : part,
        deps: (matched?.[1] ?? '')
          .split(',')
          .map((dep) => dep.trim())
          .filter(Boolean),
      }
    })
}

describe('use-ai-ws-business 硬编码中文清理契约', () => {
  it('剥离注释后仅剩 3 处协议匹配串含中文', () => {
    const residues = cjkLines(SOURCE)
    expect(residues).toHaveLength(3)
    expect(residues.filter((line) => line.includes("obj.message === '流式响应完成'"))).toHaveLength(
      2,
    )
    expect(residues.filter((line) => line.includes('TOKEN_BALANCE_KEYWORDS'))).toHaveLength(1)
  })

  it('协议串未被本地化(仍是上游中文原文)', () => {
    expect(SOURCE).toContain("const TOKEN_BALANCE_KEYWORDS = ['50000', '余额不足', 'token余额']")
    expect(SOURCE).toContain("if (obj.message === '流式响应完成') return")
  })

  it('界面串全部走 t()/tc(),不留中文字面量', () => {
    for (const call of CALL_SITES) {
      expect(SOURCE, `缺少取词调用: ${call}`).toContain(call)
    }
    expect(SOURCE.match(/t\('videoFailed'\)/g) ?? []).toHaveLength(2)
  })

  it('hook 顶层取 aiWs + chat 两个命名空间', () => {
    expect(SOURCE).toContain("useTranslations('aiWs')")
    expect(SOURCE).toContain("useTranslations('chat')")
  })

  it('用到 t/tc 的 useCallback 均把 t/tc 写进依赖数组', () => {
    const callbacks = useCallbacks(SOURCE)
    expect(callbacks.length).toBeGreaterThanOrEqual(8)
    for (const { body, deps } of callbacks) {
      if (/(^|[^\w.])t\(/.test(body)) expect(deps, 't 未进依赖数组').toContain('t')
      if (/(^|[^\w.])tc\(/.test(body)) expect(deps, 'tc 未进依赖数组').toContain('tc')
    }
  })

  it('aiWs 9 键 + chat.loginRequired 在 5 语言均可解析', () => {
    for (const locale of LOCALES) {
      for (const key of AI_WS_KEYS) {
        const value = pick(locale, ['aiWs', key])
        expect(value, `${locale}.aiWs.${key} 缺失`).toBeTruthy()
      }
      const loginRequired = pick(locale, ['chat', 'loginRequired'])
      expect(loginRequired, `${locale}.chat.loginRequired 缺失`).toBeTruthy()
    }
  })

  it('aiWs.creditLowDesc 5 语言均含 {min} 占位符', () => {
    for (const locale of LOCALES) {
      const value = pick(locale, ['aiWs', 'creditLowDesc']) ?? ''
      expect(value, `${locale} 缺 {{min}} 占位符`).toContain('{min}')
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
