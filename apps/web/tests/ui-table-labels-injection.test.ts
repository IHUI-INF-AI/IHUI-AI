// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment node
/**
 * DataTable / TreeSelect 标签注入契约测试(2026-09-22 第五轮)
 *
 * 两个共享组件的界面文案走 `labels`(Partial)+ 包内中文 DEFAULT 兜底 —— 与 WorkPanel 同一缺陷温床:
 * 少传一个键、或整个 `labels` 不传,都不会报错,只会在非中文界面上安静地显示中文。
 * 本测试钉四层:ui-react 键表 ⇒ web hook 逐键取词 ⇒ **每个消费点都真的传 labels** ⇒ 5 语言包有键。
 * 第四层是本轮新增:前一层绿但页面漏传,现象与 WorkPanel 缺陷一模一样。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { describe, it, expect } from 'vitest'

const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

function repoRoot(): string {
  let dir = process.cwd()
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, 'packages/i18n/messages/web/zh-CN.json'))) return dir
    if (existsSync(join(dir, '..', 'packages/i18n/messages/web/zh-CN.json'))) return join(dir, '..')
    dir = dirname(dir)
  }
  throw new Error('未找到仓库根')
}
const ROOT = repoRoot()
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

/** 从 ui-react 源码读 `const DEFAULT_X_LABELS = { … }` 顶层键表(判据唯一来源,不手抄) */
function defaultKeys(file: string, decl: string): string[] {
  const src = read(`packages/ui-react/src/components/${file}`)
  const start = src.indexOf(`const ${decl}`)
  expect(start, `未找到 ${decl}`).toBeGreaterThan(-1)
  const block = src.slice(start, src.indexOf('\n}', start) + 2)
  return [...block.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]).filter((k): k is string => !!k)
}

/** 从 `<Tag` 起点做 angle/brace 配平,取整个 JSX 开标签(定长窗口会截断长 props) */
function openTag(src: string, at: number): string {
  let angle = 0
  let brace = 0
  for (let i = at; i < src.length; i += 1) {
    const c = src[i]
    if (c === '{') brace += 1
    else if (c === '}') brace -= 1
    else if (brace === 0 && c === '<') angle += 1
    else if (brace === 0 && c === '>') {
      angle -= 1
      if (angle === 0) return src.slice(at, i + 1)
    }
  }
  return src.slice(at)
}

/** 递归收集端内 .tsx(新增消费点自动纳入判据,不靠手抄文件清单) */
function listTsx(dir: string, acc: string[] = []): string[] {
  for (const ent of readdirSync(join(dir), { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.next' || ent.name.startsWith('.')) continue
    const p = join(dir, ent.name)
    if (ent.isDirectory()) listTsx(p, acc)
    else if (ent.name.endsWith('.tsx')) acc.push(p)
  }
  return acc
}

/** 端内所有 JSX 消费点:从 @ihui/ui-react 引该组件且真的写了 `<Component` */
function sharedConsumers(component: string): Array<{ file: string; block: string }> {
  const out: Array<{ file: string; block: string }> = []
  for (const abs of [
    ...listTsx(join(ROOT, 'apps/web/src')),
    ...listTsx(join(ROOT, 'apps/web/app')),
  ]) {
    const src = readFileSync(abs, 'utf8')
    if (!new RegExp(`import[^;]*\\b${component}\\b[^;]*from '@ihui/ui-react'`).test(src)) continue
    // JSX 标签起始必须是 `<Component ` / `<Component>` —— 否则会误命中 `<DataTableColumn…>` 这类类型实参
    const m = new RegExp(`\\n[ \\t]*<${component}[\\s/>]`).exec(src)
    if (!m) continue
    const at = m.index + src.slice(m.index).indexOf('<')
    out.push({ file: abs.split(ROOT + sep).join(''), block: openTag(src, at) })
  }
  return out
}

describe('DataTable labels 注入契约', () => {
  const keys = defaultKeys('data-table.tsx', 'DEFAULT_DATA_TABLE_LABELS')

  it('哨兵:键表解析非空且含已知键(解析失配会先在这里红,而不是静默放过)', () => {
    expect(keys.length).toBeGreaterThanOrEqual(13)
    expect(keys).toContain('paginationSummary')
    expect(keys).toContain('sortDirections')
  })

  it('web hook 为每个键注入取词(sortDirections 走嵌套)', () => {
    const hook = read('apps/web/src/hooks/use-data-table-labels.ts')
    const missing = keys
      .filter((k) => k !== 'sortDirections')
      .filter((k) => !new RegExp(`${k}:\\s*t\\('${k}'\\)`).test(hook))
    expect(missing, `hook 未注入:${missing.join(', ')}`).toEqual([])
    for (const d of ['asc', 'desc', 'none']) {
      expect(hook, `sortDirections.${d} 未注入`).toContain(
        `${d}: t('sort${d[0]?.toUpperCase()}${d.slice(1)}')`,
      )
    }
    expect(hook).toContain("useTranslations('dataTable')")
  })

  it('每个 @ihui/ui-react DataTable 消费点都真的传 labels', () => {
    const used = sharedConsumers('DataTable')
    expect(used.length, '未找到任何消费点(判据失效哨兵)').toBeGreaterThanOrEqual(2)
    const missing = used.filter((c) => !/[\s{]labels=\{/.test(c.block)).map((c) => c.file)
    expect(missing, `消费点漏传 labels:${missing.join(', ')}`).toEqual([])
  })

  it('5 语言包 dataTable 命名空间每个键都有值', () => {
    for (const lang of LOCALES) {
      const json = JSON.parse(read(`packages/i18n/messages/web/${lang}.json`)) as Record<
        string,
        Record<string, string>
      >
      const ns = json.dataTable
      expect(ns, `${lang}: 缺 dataTable 命名空间`).toBeTruthy()
      const flat = keys.filter((k) => k !== 'sortDirections')
      const missing = flat.filter((k) => typeof ns[k] !== 'string' || ns[k] === '')
      expect(missing, `${lang}: dataTable 缺键 ${missing.join(', ')}`).toEqual([])
      for (const d of ['sortAsc', 'sortDesc', 'sortNone']) {
        expect(typeof ns[d], `${lang}: dataTable.${d} 缺失`).toBe('string')
      }
    }
  })
})

describe('TreeSelect labels 注入契约', () => {
  const keys = defaultKeys('tree-select.tsx', 'DEFAULT_TREE_SELECT_LABELS')

  it('哨兵:键表非空且含 treeAriaLabel', () => {
    expect(keys.length).toBeGreaterThanOrEqual(4)
    expect(keys).toContain('treeAriaLabel')
  })

  it('web hook 为每个键注入取词', () => {
    const hook = read('apps/web/src/hooks/use-tree-select-labels.ts')
    const missing = keys.filter((k) => !new RegExp(`${k}:\\s*t\\('${k}'\\)`).test(hook))
    expect(missing, `hook 未注入:${missing.join(', ')}`).toEqual([])
    expect(hook).toContain("useTranslations('treeSelect')")
  })

  it('每个 @ihui/ui-react TreeSelect 消费点都真的传 labels', () => {
    const used = sharedConsumers('TreeSelect')
    expect(used.length, '未找到任何消费点(判据失效哨兵)').toBeGreaterThanOrEqual(2)
    const missing = used.filter((c) => !/[\s{]labels=\{/.test(c.block)).map((c) => c.file)
    expect(missing, `消费点漏传 labels:${missing.join(', ')}`).toEqual([])
  })

  it('5 语言包 treeSelect 命名空间每个键都有值', () => {
    for (const lang of LOCALES) {
      const json = JSON.parse(read(`packages/i18n/messages/web/${lang}.json`)) as Record<
        string,
        Record<string, string>
      >
      const ns = json.treeSelect
      expect(ns, `${lang}: 缺 treeSelect 命名空间`).toBeTruthy()
      const missing = keys.filter((k) => typeof ns[k] !== 'string' || ns[k] === '')
      expect(missing, `${lang}: treeSelect 缺键 ${missing.join(', ')}`).toEqual([])
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
