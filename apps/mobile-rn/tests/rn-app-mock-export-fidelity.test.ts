// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `@ihui/rn-app` 的测试替身必须覆盖端内**真正取用**的每一个名字。
 *
 * 为什么需要一把尺子而不是一次次手补:同一型故障三个月内复发了三次 ——
 * `useScreenReappear`(薄壳从 barrel 取共享 hook)、`useWrapFocus`(守门 212 的聚焦描边唯一实现)、
 * `useFontMultiplier`(字号缩放唯一口)。表现都一样:端内代码是对的,红的是别人的套件,
 * 报错只有一句 "No X export is defined on the mock",要靠人肉猜是哪个文件。
 *
 * 判四件事(任一不成立即红;扫描集合近 0 判"尺子失明",不读成通过):
 *  F0 覆盖面:被测试加载的源文件数 > 20 且取用名字数 > 5(否则下面的"全过"是空转)。
 *  F1 端内从 '@ihui/rn-app' 具名**值**导入的名字 ⊆ (替身出口 ∪ 各套件内联工厂返回的键)。
 *  F2 替身里 `from '../..'` 的转发目标必须真存在(防替身指向已删的旧路径)。
 *  F3 正向对照:替身必须真的导出本票新增的那枚 useFontMultiplier。
 *
 * 两处必要的收窄(都来自实测,不是自我放宽):
 *  ① 匹配模式必须让花括号**紧贴**目标模块名。上一版写 `import\s+([\s\S]*?)\s+from\s+'@ihui/rn-app'`,
 *     惰性匹配跨过中间几十条 `import { useCallback } from 'react'` 一路吞到目标模块,
 *     "缺出口"一下报出 434 个名字(全是 react / lucide 的)—— 尺子读大与读小同样把人带进假结论。
 *  ② 只算被测试 import 到的源文件(1 跳)。扫全棵 src 会把没有任何套件加载的屏也算进来
 *     (实测多出一百多枚屏名);那些模块在 ESM 里根本不会被链接,判缺出口就是凭空造红。
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 本文件在 <端根>/tests/ 下 ⇒ 端根是上一层(写 '..','..' 会指到 apps/,尺子什么都扫不到)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const TESTS = join(ROOT, 'tests')
const MOCK = join(TESTS, '__mocks__/ihui-rn-app.ts')

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(full)) out.push(full)
  }
  return out
}

/** 剥块注释与行注释:注释里出现的示例名会污染集合。 */
function strip(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function namedClause(clause: string): string[] {
  return clause
    .split(',')
    .map((raw) => raw.trim())
    .filter((t) => t !== '' && !t.startsWith('type '))
    .map((t) => (t.split(/\s+as\s+/)[0] ?? '').trim())
    .filter((n) => /^[A-Za-z_$][\w$]*$/.test(n))
}

/** 端内(被测试加载到的那一层)从 barrel 具名取用的值导入。 */
function usedNames(files: Set<string>): Set<string> {
  const set = new Set<string>()
  for (const f of files) {
    const code = strip(readFileSync(f, 'utf8'))
    for (const m of code.matchAll(
      /import\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]@ihui\/rn-app['"]/g,
    )) {
      if (m[1]) continue // 整条是 `import type {…}` ⇒ 运行时被抹掉,替身不需要它
      for (const n of namedClause(m[2] ?? '')) set.add(n)
    }
  }
  return set
}

function testLoadedSrcFiles(): Set<string> {
  const out = new Set<string>()
  for (const f of walk(TESTS)) {
    if (f === MOCK) continue
    const code = strip(readFileSync(f, 'utf8'))
    for (const m of code.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)) {
      const target = resolve(dirname(f), m[1] ?? '.')
      for (const cand of [`${target}.ts`, `${target}.tsx`, target, join(target, 'index.ts')]) {
        if (existsSync(cand) && statSync(cand).isFile() && cand.startsWith(SRC)) out.add(cand)
      }
    }
  }
  return out
}

/** 别名替身的出口名。 */
function mockExports(): Set<string> {
  const code = strip(readFileSync(MOCK, 'utf8'))
  const names = new Set<string>()
  for (const m of code.matchAll(
    /export\s+(?:type\s+)?\{([^}]*)\}(?:\s+from\s+['"][^'"]+['"])?/g,
  ))
    for (const n of namedClause(m[1] ?? '')) names.add(n)
  for (const m of code.matchAll(
    /export\s+(?:declare\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g,
  ))
    if (m[1]) names.add(m[1])
  for (const m of code.matchAll(/export\s+type\s+([A-Za-z_$][\w$]*)/g)) if (m[1]) names.add(m[1])
  return names
}

/** 各套件内联 `vi.mock('@ihui/rn-app')` 工厂自己给的键(同一屏可能被这条路供给,不能算缺)。 */
function inlineFactoryKeys(): Set<string> {
  const set = new Set<string>()
  for (const f of walk(TESTS)) {
    const code = strip(readFileSync(f, 'utf8'))
    for (const m of code.matchAll(/vi\.mock\(\s*['"]@ihui\/rn-app['"][\s\S]*?\n\}\)/g)) {
      const body = m[0] ?? ''
      for (const k of body.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*:/gm)) if (k[1]) set.add(k[1])
      for (const k of body.matchAll(/return\s*\{([^}]*)\}/g))
        for (const n of namedClause(k[1] ?? '')) set.add(n)
    }
  }
  return set
}

describe('@ihui/rn-app 替身出口忠实度', () => {
  const loaded = testLoadedSrcFiles()
  const used = usedNames(loaded)
  const provided = new Set<string>([...mockExports(), ...inlineFactoryKeys()])

  it('F0 覆盖面非空转(加载到的源文件与取用名字都要有量)', () => {
    expect(loaded.size).toBeGreaterThan(20)
    expect(used.size).toBeGreaterThan(5)
    expect(provided.size).toBeGreaterThan(20)
  })

  it('F1 端内具名取用的名字必须都被替身/内联工厂覆盖', () => {
    const missing = [...used].filter((n) => !provided.has(n))
    const probe = missing[0] ?? ''
    expect(
      missing,
      `替身 tests/__mocks__/ihui-rn-app.ts 缺出口:${missing.join(', ')} ⇒ 走别名的套件会抛 "No ${probe} export is defined on the mock"(端内代码是对的,红的是别人的套件;三个月内已复发三次)`,
    ).toEqual([])
  })

  it('F2 替身里的转发目标必须真存在', () => {
    const code = strip(readFileSync(MOCK, 'utf8'))
    const dead: string[] = []
    for (const m of code.matchAll(/from\s+'(\.\.\/[^']+)'/g)) {
      const target = resolve(dirname(MOCK), m[1] ?? '.')
      const found =
        existsSync(target) ||
        existsSync(`${target}.ts`) ||
        existsSync(`${target}.tsx`) ||
        existsSync(join(target, 'index.ts'))
      if (!found) dead.push(m[1] ?? '?')
    }
    expect(dead, `替身转发到不存在的路径:${dead.join(', ')}`).toEqual([])
  })

  it('F3 正向对照:本票新增的那枚出口真的在覆盖集里', () => {
    expect(provided.has('useFontMultiplier')).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
