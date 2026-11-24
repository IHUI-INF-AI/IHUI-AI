// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * M4 B1 契约冻结:共享屏声明了必填宿主端口(`assertRequiredPort('onNavigate' | 'onToast' | …)`)
 * 的,对应 RN 壳必须真的把该端口接上 —— 属性内联或 props 对象字段皆可,但不得缺位。
 *
 * 为什么另立一把尺子:typecheck 只能判"壳自己那侧"的类型;一旦壳用 `{...props}` 或 props 对象,
 * 或某天有人把 required 改成 optional(或反过来),编译仍可能是绿的而运行期 assert 才炸。
 * 本测试从**真相源正文**读 assert 名单,再回头核壳的接线位 —— 两边同源,不靠手抄表。
 *
 * 判两件事:
 *  F0 覆盖面:扫到的"带必填端口的共享屏"≥ 20,且壳侧命中 ≥ 20(否则下面的全过是空转)。
 *  F1 每个必填端口在壳正文里都有接线位(`port={` 内联 或 `port,` 对象字段)。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SCREENS = join(ROOT, 'src/screens')
const FEATURES = resolve(ROOT, '../../packages/app/src/features')

function featureFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__') continue
      featureFiles(full, out)
    } else if (entry.endsWith('.tsx')) out.push(full)
  }
  return out
}

/** 共享屏导出名 → 源文件(只认 `export function <Name>(` 的真相源) */
const exportedIndex = new Map<string, string>()
for (const file of featureFiles(FEATURES)) {
  const text = readFileSync(file, 'utf8')
  for (const m of text.matchAll(/export function ([A-Z][A-Za-z0-9_]*)\s*[(<]/g)) {
    const name = m[1]
    if (name) exportedIndex.set(name, file)
  }
}

interface ShellCase {
  shell: string
  ports: string[]
}

const cases: ShellCase[] = []

for (const entry of readdirSync(SCREENS)) {
  if (!entry.endsWith('.tsx')) continue
  const path = join(SCREENS, entry)
  const text = readFileSync(path, 'utf8')

  // 壳从共享包取用的组件:根 barrel 或 features 子路径两种写法
  const imported: string[] = []
  for (const m of text.matchAll(/^import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*'@ihui\/rn-app'/gm)) {
    const block = m[1] ?? ''
    for (const part of block.split(',')) {
      const name =
        part
          .trim()
          .split(/\s+as\s+/)[0]
          ?.replace(/^type\s+/, '')
          .trim() ?? ''
      if (/^[A-Z]/.test(name)) imported.push(name)
    }
  }
  for (const m of text.matchAll(
    /^import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*'@ihui\/rn-app\/features\/[^']+'/gm,
  )) {
    const block = m[1] ?? ''
    for (const part of block.split(',')) {
      const name =
        part
          .trim()
          .split(/\s+as\s+/)[0]
          ?.replace(/^type\s+/, '')
          .trim() ?? ''
      if (/^[A-Z]/.test(name)) imported.push(name)
    }
  }

  const ports = new Set<string>()
  for (const name of imported) {
    const file = exportedIndex.get(name)
    if (!file) continue
    const source = readFileSync(file, 'utf8')
    for (const m of source.matchAll(/assertRequiredPort\(\s*'([A-Za-z0-9_]+)'/g)) {
      const port = m[1]
      if (port) ports.add(port)
    }
  }
  if (ports.size) cases.push({ shell: entry, ports: [...ports].sort() })
}

describe('宿主端口接线契约(M4 B1)', () => {
  it('F0 尺子没失明:带必填端口的壳覆盖面足够', () => {
    expect(cases.length).toBeGreaterThanOrEqual(20)
  })

  it('F1 每个必填端口在对应壳正文里都有接线位', () => {
    const missing: string[] = []
    for (const c of cases) {
      const text = readFileSync(join(SCREENS, c.shell), 'utf8')
      for (const port of c.ports) {
        // 两种合法接线:JSX 内联(`onToast={onToast}`)或 props 对象独占一行(`onToast,`)。
        // 不能只判 `port,` —— hook 解构行 `const { onNavigate, onToast }` 会假阳性。
        const inline = new RegExp(`\\b${port}=\\{`).test(text)
        const field = new RegExp(`(?:^|\\n)[ \\t]*${port},`).test(text)
        if (!inline && !field) missing.push(`${c.shell}: 缺 ${port}`)
      }
    }
    expect(missing, missing.join('\n')).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
