// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「一键登录本机」spawn 目标存在性锁(2026-10-28 立)。
 *
 * 立因:relay-local-login.ts 曾有一条 WorkBuddy 专属通道,spawn 的
 * `scripts/workbuddy-login-local.mjs` **在任何一次提交里都不存在**(全 ref 扫过、盘上也没有),
 * 而 typecheck 与全部守门都是绿的 —— 脚本路径是运行期才解析的字符串,静态判据结构上看不见它;
 * 该平台的一键登录于是每次必 `spawn ENOENT`,却没有任何一处报红。
 * 本档把"文件里声明的每个脚本/解释器落点必须真实存在"钉在测试层:零 IO 之外只读仓库自身文件。
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const API_ROOT = resolve(HERE, '..')
const REPO_ROOT = resolve(API_ROOT, '..', '..')
const SOURCE = join(API_ROOT, 'src', 'services', 'relay-local-login.ts')

/** 从源码里抓 `resolve(REPO_ROOT, 'a', 'b', ...)` 形态的落点声明(只取字面量段) */
function declaredScriptTargets(src: string): string[] {
  const out = new Set<string>()
  const re = /resolve\(\s*REPO_ROOT\s*,\s*((?:'[^']+'\s*,\s*)*'[^']+')\s*\)/g
  for (const m of src.matchAll(re)) {
    const segments = [...m[1].matchAll(/'([^']+)'/g)].map((s) => s[1])
    if (segments.length > 0) out.add(join(...segments))
  }
  return [...out].sort()
}

describe('relay-local-login 的脚本落点', () => {
  const src = readFileSync(SOURCE, 'utf8')

  it('抓得到落点声明(判据自身不空转)', () => {
    const targets = declaredScriptTargets(src)
    expect(targets.length).toBeGreaterThanOrEqual(3)
    expect(targets).toContain(join('scripts', 'local-login.mjs'))
    expect(targets).toContain(join('scripts', 'trae-login-local.mjs'))
  })

  it('每个落点都真实存在(悬空 spawn 目标 = 该平台一键登录必失败)', () => {
    const missing = declaredScriptTargets(src).filter((rel) => !existsSync(join(REPO_ROOT, rel)))
    expect(missing).toEqual([])
  })

  it('不得再声明 WorkBuddy 专属脚本落点(已证实该文件不存在)', () => {
    expect(declaredScriptTargets(src).some((rel) => rel.includes('workbuddy'))).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
