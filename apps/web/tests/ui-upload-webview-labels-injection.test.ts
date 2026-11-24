// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment node
/**
 * Upload / WebViewFrame 标签注入契约测试(2026-09-23)
 *
 * 与 ui-table-labels-injection.test.ts 同一缺陷温床:labels(Partial)+ 包内中文 DEFAULT 兜底
 * —— 少传一键、或整个 labels 不传,都不会报错,只在非中文界面安静地显示中文。
 * 本测试钉四层:ui-react 键表 ⇒ web hook 逐键取词 ⇒ **每个 JSX 消费点(全部,非首个)都真的传
 * labels** ⇒ 5 语言有键且 zh 值与 DEFAULT 逐字符一致。
 * 第四层数据源:语言包优先;upload/webviewFrame 命名空间尚未合入语言包时回退批量清单
 * `.ihui-agent/tmp/i18n/batch-upload.json`(主 agent 合并后清单路径自动失效;若两头皆缺,
 * localeNamespace 直接抛错使测试变红,不会静默放过)。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { describe, it, expect } from 'vitest'

const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
const BATCH_MANIFEST = '.ihui-agent/tmp/i18n/batch-upload.json'

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
  return Object.keys(defaultEntries(file, decl))
}

/** 同上,但保留 key→zh 值(用于"zh 值逐字符不变"锚) */
function defaultEntries(file: string, decl: string): Record<string, string> {
  const src = read(`packages/ui-react/src/components/${file}`)
  const start = src.indexOf(`const ${decl}`)
  expect(start, `未找到 ${decl}`).toBeGreaterThan(-1)
  const block = src.slice(start, src.indexOf('\n}', start) + 2)
  const out: Record<string, string> = {}
  for (const m of block.matchAll(/^\s{2}(\w+):\s*'(.*)',$/gm)) {
    if (m[1] && m[2] !== undefined) out[m[1]] = m[2]
  }
  return out
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

/** 端内所有 JSX 消费点:命名绑定来自 @ihui/ui-react 且真的写了 `<Component`(收集每一处) */
function sharedConsumers(component: string): Array<{ file: string; block: string }> {
  const out: Array<{ file: string; block: string }> = []
  for (const abs of [
    ...listTsx(join(ROOT, 'apps/web/src')),
    ...listTsx(join(ROOT, 'apps/web/app')),
  ]) {
    const src = readFileSync(abs, 'utf8')
    // 只看 `import { … } from '@ihui/ui-react'` 的花括号内绑定,排除 lucide-react 同名图标
    let imported = false
    for (const im of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s*'@ihui\/ui[^']*'/g)) {
      if (im[1] && new RegExp(`\\b${component}\\b`).test(im[1])) imported = true
    }
    if (!imported) continue
    // JSX 标签起点后必须紧跟 空白/>// —— 排除 `<UploadCloud` 这类前缀同名标签
    const tagRe = new RegExp(`\\n[ \\t]*<${component}(?=[\\s/>])`, 'g')
    for (const m of src.matchAll(tagRe)) {
      const at = m.index + m[0].indexOf('<')
      out.push({ file: abs.split(ROOT + sep).join(''), block: openTag(src, at) })
    }
  }
  return out
}

/** 第四层数据源:语言包优先,缺命名空间时回退批量清单;两头皆缺 → 抛错(测试红) */
function localeNamespace(lang: string, ns: 'upload' | 'webviewFrame'): Record<string, string> {
  const packs = JSON.parse(read(`packages/i18n/messages/web/${lang}.json`)) as Record<
    string,
    Record<string, string>
  >
  if (packs[ns] && typeof packs[ns] === 'object') return packs[ns]
  if (existsSync(join(ROOT, BATCH_MANIFEST))) {
    const batch = JSON.parse(read(BATCH_MANIFEST)) as Record<
      string,
      Record<string, Record<string, string>>
    >
    const fromManifest = batch[lang]?.[ns]
    if (fromManifest) return fromManifest
  }
  throw new Error(`${lang}: 语言包缺 ${ns} 命名空间且 ${BATCH_MANIFEST} 未覆盖`)
}

describe('Upload labels 注入契约', () => {
  const entries = defaultEntries('Upload.tsx', 'DEFAULT_UPLOAD_LABELS')
  const keys = Object.keys(entries)

  it('哨兵:键表解析非空且含已知键(解析失配会先在这里红,而不是静默放过)', () => {
    expect(keys.length).toBeGreaterThanOrEqual(14)
    expect(keys).toContain('cancelUpload')
    expect(keys).toContain('placeholder')
  })

  it('web hook 为每个键注入取词(键名 1:1)', () => {
    const hook = read('apps/web/src/hooks/use-upload-labels.ts')
    const missing = keys.filter((k) => !new RegExp(`${k}:\\s*t\\('${k}'\\)`).test(hook))
    expect(missing, `hook 未注入:${missing.join(', ')}`).toEqual([])
    expect(hook).toContain("useTranslations('upload')")
  })

  it('每个 @ihui/ui-react Upload 消费点都真的传 labels', () => {
    const used = sharedConsumers('Upload')
    expect(used.length, '未找到任何消费点(判据失效哨兵)').toBeGreaterThanOrEqual(1)
    const missing = used.filter((c) => !/[\s{]labels=\{/.test(c.block)).map((c) => c.file)
    expect(missing, `消费点漏传 labels:${missing.join(', ')}`).toEqual([])
  })

  it('5 语言 upload 命名空间每个键都有值,zh-CN 与 DEFAULT 逐字符一致,占位符原样保留', () => {
    const templates: Record<string, string[]> = {
      sizeLimitHint: ['{size}'],
      maxCountReached: ['{max}'],
      oversizeFiles: ['{size}', '{files}'],
      uploadFailedWithStatus: ['{status}'],
    }
    for (const lang of LOCALES) {
      const ns = localeNamespace(lang, 'upload')
      const missing = keys.filter((k) => typeof ns[k] !== 'string' || ns[k] === '')
      expect(missing, `${lang}: upload 缺键 ${missing.join(', ')}`).toEqual([])
      // ImageUpload 端内占位符键(upload.imagePlaceholder)必须存在且被消费点取词
      expect(typeof ns.imagePlaceholder, `${lang}: upload.imagePlaceholder 缺失`).toBe('string')
      if (lang === 'zh-CN') {
        for (const k of keys) expect(ns[k], `zh-CN: upload.${k} 与包内默认值漂移`).toBe(entries[k])
      }
      for (const [k, tokens] of Object.entries(templates)) {
        for (const tk of tokens) {
          expect(ns[k], `${lang}: upload.${k} 丢占位符 ${tk}`).toContain(tk)
        }
      }
    }
    const consumer = read('apps/web/src/components/form/ImageUpload.tsx')
    expect(consumer).toContain("t('imagePlaceholder')")
  })
})

describe('WebViewFrame labels 注入契约', () => {
  const keys = defaultKeys('webview-frame.tsx', 'DEFAULT_WEB_VIEW_FRAME_LABELS')
  const entries = defaultEntries('webview-frame.tsx', 'DEFAULT_WEB_VIEW_FRAME_LABELS')

  it('哨兵:键表非空且含 retry/idlePlaceholder', () => {
    expect(keys.length).toBeGreaterThanOrEqual(8)
    expect(keys).toContain('retry')
    expect(keys).toContain('idlePlaceholder')
  })

  it('web hook 为每个键注入取词(键名 1:1)', () => {
    const hook = read('apps/web/src/hooks/use-web-view-frame-labels.ts')
    const missing = keys.filter((k) => !new RegExp(`${k}:\\s*t\\('${k}'\\)`).test(hook))
    expect(missing, `hook 未注入:${missing.join(', ')}`).toEqual([])
    expect(hook).toContain("useTranslations('webviewFrame')")
  })

  it('每个 @ihui/ui-react WebViewFrame 消费点(每一处)都真的传 labels', () => {
    const used = sharedConsumers('WebViewFrame')
    expect(used.length, '未找到任何消费点(判据失效哨兵)').toBeGreaterThanOrEqual(2)
    const missing = used.filter((c) => !/[\s{]labels=\{/.test(c.block)).map((c) => c.file)
    expect(missing, `消费点漏传 labels:${missing.join(', ')}`).toEqual([])
  })

  it('5 语言 webviewFrame 命名空间每个键都有值,zh-CN 与 DEFAULT 逐字符一致', () => {
    for (const lang of LOCALES) {
      const ns = localeNamespace(lang, 'webviewFrame')
      const missing = keys.filter((k) => typeof ns[k] !== 'string' || ns[k] === '')
      expect(missing, `${lang}: webviewFrame 缺键 ${missing.join(', ')}`).toEqual([])
      if (lang === 'zh-CN') {
        for (const k of keys) expect(ns[k], `zh-CN 漂移 ${k}`).toBe(entries[k])
      }
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
