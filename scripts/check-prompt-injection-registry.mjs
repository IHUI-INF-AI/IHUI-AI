#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 提示注入登记对账(guardian 第 128 项,blocking)
 *
 * 被审对象:`apps/cli/src/utils/prompt-injection-registry.ts` —— 一张「哪一段上下文以宿主名义
 * 进模型提示」的登记表。本仓最高频失效型就是「登记了但没人生产 / 生产了但没人消费」,
 * 而这一族腐烂的表现形式永远是**安静**(提示变短了,没人喊)。
 *
 * 三条判据,零豁免清单(判据输入全部从被审面自身推导,不留会腐烂的白名单):
 *  R1 生产者缺失:每条登记项的 producer 文件必须在**被审面**上存在,其代码面必须出现该 id,
 *     且必须有一处记账出口调用(注释里的提及不算 —— 那是「看起来有、其实没装车」)。
 *  R2 造好没装车:`renderInjectionNotice(` 必须在生产面(非测试)至少有一个调用点,
 *     且登记表与唯一出口模块在面上解析得到、出口导出仍在位。
 *  R3 裸宿主前缀旁路:出现 `[系统提醒]` / `[系统提示]` 这类以宿主名义的裸文本前缀、
 *     而该文件既不调用也不定义出口 ⇒ 违规。**锚点 = 该文件 HEAD 自身的违规数**(棘轮),
 *     只拦新增;把存量当场判红就是一台与任何提交都无关的恒红门,唯一结局是逼人
 *     `--no-verify` 连带废掉全部守门(§12e 同型)。
 *
 * 取材口径同 70/77/83/98/101/118:全量判 **HEAD blob**、`--staged` 判**索引 blob**、
 * `--worktree` 仅人工逃生舱、两面旗同给 exit 2;清单与正文**同面同轮**(一次
 * `cat-file --batch` 读满,经 `scripts/lib/face-reader.mjs`,守门 118 判这条)。
 * 取不到被审内容 ⇒ **exit 2「无法判定」**,不冒红也不记绿;枚举到 0 个候选文件判死。
 *
 * 已知限制(如实登记,不用它遮红):模板字符串 `${}` 内插的出口调用会被字符串遮罩抹掉而
 * 看不见(漏判方向是 R1 的③,不是误伤),与守门 83 R5「跨行配对不计」同一取向:宁窄不误。
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, gitRaw, selectFace, assertRepoRoot, Undetermined } from './lib/face-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 登记表与唯一出口(本门从它们自身推导判据输入,不抄第二份清单)。 */
const REGISTRY = 'apps/cli/src/utils/prompt-injection-registry.ts'
const BOUNDARY = 'apps/cli/src/utils/prompt-boundary.ts'
/** 记账出口:producer 至少要调用其中一个。 */
const RECORD_OUTLETS = [
  'recordInjectionInjected',
  'recordInjectionSkipped',
  'injectHostSection',
  'injectReminderSection',
]
const NOTICE_OUTLET = 'renderInjectionNotice'
/** R3 的字面量族:两个「以宿主名义」的裸前缀是同一型(只认其一就是本门立项要防的那类盲区)。 */
const BARE_PREFIX_RE = /\[(系统提醒|系统提示)\]/
/** 扫描面(有界,否则一次对账要为整棵树读 blob)。 */
const SCAN_ROOTS = ['apps/cli/src/', 'packages/context-compaction/src/']
const SRC_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/

/** 生产面之外的路径(测试与构建产物):R2 只问「有没有真调用点」,测试里调一次不算装车。 */
export function isTestPath(rel) {
  return /(^|\/)(tests?|__tests__|e2e|dist|node_modules)\//.test(rel) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(rel)
}

/**
 * 遮罩:注释一律遮(两档都遮),字符串按开关遮。
 * 遮掉的字符换成空格、换行原样保留 ⇒ 行号与逐行计数不漂。
 * 「认导入必须保留字符串、认调用必须连字符串一起遮」这两档方向不同,本仓记过两次混用
 * 造成的假绿,所以做成一个开关而不是两个函数,免得有人只改对一档。
 */
export function maskCode(text, { strings = false } = {}) {
  const src = String(text)
  const out = src.split('')
  let mode = 'code'
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    const next = src[i + 1]
    if (mode === 'code') {
      if (c === '/' && next === '/') {
        mode = 'line'
        i++
        continue
      }
      if (c === '/' && next === '*') {
        mode = 'block'
        i++
        continue
      }
      if (c === "'" || c === '"' || c === '`') mode = c
      continue
    }
    if (mode === 'line') {
      if (c === '\n') {
        mode = 'code'
        continue
      }
      out[i] = ' '
      continue
    }
    if (mode === 'block') {
      if (c === '*' && next === '/') {
        mode = 'code'
        out[i] = ' '
        i++
        continue
      }
      if (c !== '\n') out[i] = ' '
      continue
    }
    // 字符串态:单引号 / 双引号 / 反引号
    if (c === '\\') {
      if (strings) out[i] = ' '
      if (src[i + 1] !== '\n') i++
      if (strings && src[i] !== '\n') out[i] = ' '
      continue
    }
    if (c === mode) {
      mode = 'code'
      continue
    }
    if (strings && c !== '\n') out[i] = ' '
  }
  return out.join('')
}

/** 从登记表源码取 entries 与 kind 封闭集(表是判据输入,抄第二份名字就会漂移)。 */
export function parseRegistry(text) {
  const kinds = []
  const kindsBlock = /\bPROMPT_INJECTION_KINDS\s*=\s*\[([\s\S]*?)\]/.exec(text)
  if (kindsBlock) for (const m of kindsBlock[1].matchAll(/['"`]([^'"`]+)['"`]/g)) kinds.push(m[1])
  // 定位必须锚在**声明**上:这张表的 doc 注释里也写着 PROMPT_INJECTION_ENTRIES,按裸 indexOf
  // 会先命中注释,再在注释文本里找一个不存在的 `=`,于是解出 0 条而报告一切正常。
  // (镜像 T10 拿真登记表跑出来的 —— 判据对真实文件形态全盲正是 §22c 那条红线。)
  const decl = /(?:export\s+)?const\s+PROMPT_INJECTION_ENTRIES\b[^=]*=[\s\S]{0,120}?\[/.exec(text)
  if (!decl) throw new Undetermined(`${REGISTRY} 里找不到 PROMPT_INJECTION_ENTRIES 的数组字面量声明`)
  const open = decl.index + decl[0].length - 1
  let depth = 0
  let quote = ''
  let close = -1
  for (let i = open; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = ''
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c
      continue
    }
    if (c === '[') depth++
    else if (c === ']') {
      depth--
      if (depth === 0) {
        close = i
        break
      }
    }
  }
  if (close < 0) throw new Undetermined(`${REGISTRY} 的 entries 数组括号不闭合`)
  const body = text.slice(open + 1, close)
  const entries = []
  for (const objText of splitObjects(body)) {
    const get = (key) => {
      const m = new RegExp(`\\b${key}\\s*:\\s*['"\`]([^'"\`]*)['"\`]`).exec(objText)
      return m ? m[1] : null
    }
    const id = get('id')
    const producer = get('producer')
    if (!id || !producer) continue
    entries.push({ id, kind: get('kind'), producer, consumer: get('consumer'), title: get('title') })
  }
  return { entries, kinds }
}

/** 按顶层 `{}` 切条目(字符串里的括号不算深度,所以带引号扫描)。 */
function splitObjects(body) {
  const out = []
  let depth = 0
  let start = -1
  let quote = ''
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = ''
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c
      continue
    }
    if (c === '{') {
      if (depth === 0) start = i
      depth++
    } else if (c === '}') {
      depth--
      if (depth === 0 && start >= 0) {
        out.push(body.slice(start, i + 1))
        start = -1
      }
    }
  }
  return out
}

/** producer/consumer 的形态约定:`<仓库相对路径>#<导出符号>`。 */
export function splitSpec(spec) {
  const s = String(spec || '')
  const at = s.lastIndexOf('#')
  if (at <= 0) return null
  return { file: s.slice(0, at), symbol: s.slice(at + 1) }
}

/** 该文件是否「接了出口」(调用或自身就是定义)—— R3 用它代替豁免清单:接了就不算旁路。 */
export function usesOutlet(strictCode) {
  const names = [...RECORD_OUTLETS, NOTICE_OUTLET, 'frameSystemReminder', 'neutralizeBoundaries']
  return names.some((n) => new RegExp(`\\b${n}\\s*[(:]`).test(strictCode))
}

export function countBarePrefix(code) {
  let hits = 0
  for (const line of code.split('\n')) {
    if (!BARE_PREFIX_RE.test(line)) continue
    // **逐行**免,不按文件免:旧写法只要该文件别处调过任一出口(哪怕只是
    // `neutralizeBoundaries(` 用在别的语句里),整个文件的裸宿主前缀就一起不算旁路 ——
    // 实测 `commands/agent.ts` 就是这样被放过的:它有 2 处真旁路(:679 fs 事件、:1861 工具失败反思),
    // 却在别处调用 neutralizeBoundaries ⇒ 门打印"已接出口,不计旁路"、R3 存量报 0。
    // 文件级豁免把"这个文件懂规矩"当成"这一行走了出口",正是本门要防的那一型判据失效。
    if (usesOutlet(line)) continue
    hits++
  }
  return hits
}

/**
 * 纯判据聚合(取证靠构造面,不依赖仓库瞬时状态 —— 守门 103 的教训)。
 * @param {{registryText:string|null, boundaryText:string|null, files:Map<string,{text:string|null}>, headCounts:Map<string,number>}} input
 */
export function decide({ registryText, boundaryText, files, headCounts }) {
  const undetermined = []
  const red = { R1: [], R2: [], R3: [] }
  const notices = []
  if (!registryText) {
    return { red, undetermined: [`${REGISTRY} 在被审面上取不到 ⇒ 无法判定`], notices, counted: {} }
  }
  let parsed
  try {
    parsed = parseRegistry(registryText)
  } catch (e) {
    return { red, undetermined: [`登记面解析失败:${e.message}`], notices, counted: {} }
  }
  const { entries, kinds } = parsed
  if (kinds.length === 0) undetermined.push('kind 封闭集解析为空 ⇒ R1 的 kind 校验无牙(不是「没有违规」)')
  if (entries.length === 0) undetermined.push('登记表枚举到 0 条 ⇒ 判死,不记绿')
  // kind 值域:表里写了却不属于封闭集 ⇒ 表与类型层两侧不同认(登记表自身腐坏)
  for (const e of entries) {
    if (kinds.length && e.kind && !kinds.includes(e.kind)) {
      red.R1.push(`[R1] ${e.id}: kind "${e.kind}" 不在封闭集 [${kinds.join(', ')}]`)
    }
  }

  // ---- R1 生产者
  for (const e of entries) {
    const spec = splitSpec(e.producer)
    if (!spec) {
      red.R1.push(`[R1] ${e.id}: producer "${e.producer}" 不是 <路径>#<符号> 形态`)
      continue
    }
    const rec = files.get(spec.file)
    if (!rec) {
      red.R1.push(`[R1] ${e.id}: producer 文件不在被审面上:${spec.file}`)
      continue
    }
    if (rec.text === null) {
      undetermined.push(`${e.id}: producer ${spec.file} 取不到内容`)
      continue
    }
    const loose = maskCode(rec.text, { strings: false })
    const strict = maskCode(rec.text, { strings: true })
    const idVisible = loose.includes(`'${e.id}'`) || loose.includes(`"${e.id}"`) || loose.includes(`\`${e.id}\``)
    if (!idVisible) {
      red.R1.push(`[R1] ${e.id}: producer ${spec.file} 的代码面未出现该 id(注释里的提及不算)`)
      continue
    }
    const routed = RECORD_OUTLETS.some((n) => new RegExp(`\\b${n}\\s*\\(`).test(strict))
    if (!routed) red.R1.push(`[R1] ${e.id}: ${spec.file} 出现 id 却没有任何记账出口调用 ⇒ 登记了没人生产`)
  }

  // ---- R2 消费者 / 可见行(造好没装车)
  if (!boundaryText) undetermined.push(`${BOUNDARY} 在被审面上取不到 ⇒ R2 无法判定`)
  const registryExportsNotice = new RegExp(`export\\s+(async\\s+)?function\\s+${NOTICE_OUTLET}\\b`).test(registryText)
  if (!registryExportsNotice) red.R2.push(`[R2] 登记表不再导出 ${NOTICE_OUTLET}(唯一出口被摘线)`)
  let noticeCallers = 0
  for (const [rel, rec] of files) {
    if (rec.text === null) {
      undetermined.push(`${rel} 取不到内容`)
      continue
    }
    if (rel === REGISTRY || isTestPath(rel)) continue
    if (new RegExp(`\\b${NOTICE_OUTLET}\\s*\\(`).test(maskCode(rec.text, { strings: true }))) noticeCallers++
  }
  if (registryExportsNotice && noticeCallers === 0) {
    red.R2.push(`[R2] ${NOTICE_OUTLET}( 在生产面零调用点 ⇒ 可见行从未被拼进消息`)
  }

  // ---- R3 裸宿主前缀旁路(锚点 = 该文件 HEAD 自身违规数)
  let legacyHits = 0
  for (const [rel, rec] of files) {
    if (rec.text === null || isTestPath(rel) || rel === BOUNDARY) continue
    const cur = countBarePrefix(maskCode(rec.text, { strings: false }))
    if (cur === 0) continue
    const anchor = headCounts.get(rel) ?? 0
    if (cur > anchor) {
      red.R3.push(`[R3] ${rel}: 裸宿主前缀 ${cur} 处 > HEAD 自身 ${anchor} 处 ⇒ 新增未走出口`)
    } else {
      legacyHits += cur
      if (cur > 0) notices.push(`${rel}: HEAD 自身已有 ${cur} 处裸宿主前缀(锚点自持,只报数不判红)⇒ 改接出口需与"扩反第二真相锁的字面量集合同批"`)
    }
  }
  return {
    red,
    undetermined,
    notices,
    counted: {
      entries: entries.length,
      kinds: kinds.length,
      scannedFiles: files.size,
      noticeCallers,
      legacyHits,
    },
  }
}

/** 枚举被审面上的候选源码(清单与正文同面同轮读满)。 */
function collectFace(root, face) {
  const listArgs =
    face === 'staged'
      ? ['ls-files', '--', ...SCAN_ROOTS]
      : ['ls-tree', '-r', '--name-only', 'HEAD', '--', ...SCAN_ROOTS]
  const listed = gitRaw(listArgs, root)
  const paths = String(listed)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s && SRC_RE.test(s) && !s.endsWith('.d.ts'))
  const specOf = (rel) => (face === 'staged' ? `:${rel}` : `HEAD:${rel}`)
  const specs = paths.map(specOf)
  const blobs = specs.length ? catBatch(root, specs) : new Map()
  const files = new Map()
  paths.forEach((rel, i) => files.set(rel, { text: blobs.get(specs[i]) ?? null }))
  const readOne = (rel) => {
    if (face === 'worktree') {
      const abs = path.join(root, rel)
      return existsSync(abs) ? readFileSync(abs, 'utf8') : null
    }
    const spec = specOf(rel)
    return catBatch(root, [spec]).get(spec) ?? null
  }
  return { files, readOne, specOf }
}

async function audit(root, face) {
  assertRepoRoot(root, '本门')
  const { files, readOne, specOf } = collectFace(root, face)
  if (files.size === 0) throw new Undetermined(`被审面(${face})枚举到 0 个候选源码 ⇒ 判死,不记绿`)
  const registryText = readOne(REGISTRY)
  const boundaryText = readOne(BOUNDARY)
  const headCounts = new Map()
  if (face === 'head') {
    for (const [rel, rec] of files) {
      headCounts.set(rel, rec.text === null ? 0 : countBarePrefix(maskCode(rec.text, { strings: false })))
    }
  } else {
    // 棘轮锚点恒取 HEAD(它是「这一族文件本来就有多少处」的定义,与被审面无关)
    const rels = [...files.keys()].filter((r) => !isTestPath(r) && r !== BOUNDARY)
    const specs = rels.map((rel) => `HEAD:${rel}`)
    const blobs = specs.length ? catBatch(root, specs) : new Map()
    rels.forEach((rel, i) => {
      const t = blobs.get(specs[i])
      headCounts.set(rel, t === null ? 0 : countBarePrefix(maskCode(t, { strings: false })))
    })
  }
  void specOf
  return decide({ registryText, boundaryText, files, headCounts })
}

/* ------------------------------------------------------------------ 自检(纯构造面) */

function selfTest() {
  const cases = []
  const ok = (name, pass, detail = '') => cases.push({ name, pass, detail })
  const registry = `
export const PROMPT_INJECTION_KINDS = ['reference_data', 'host_reminder', 'host_directive'] as const;
export const PROMPT_INJECTION_ENTRIES: readonly PromptInjectionEntry[] = [
  { id: 'alpha', kind: 'host_reminder', producer: 'apps/cli/src/x.ts#doA', consumer: 'apps/cli/src/y.ts#build', title: 'A 段' },
];
export function renderInjectionNotice(): string { return ''; }
`
  const producer = `import { recordInjectionSkipped } from './utils/prompt-injection-registry.js';
export function doA() { return recordInjectionSkipped('alpha', '本轮无内容'); }
`
  const consumer = `import { renderInjectionNotice } from './utils/prompt-injection-registry.js';
export function build() { return renderInjectionNotice(); }
`
  const files = new Map([
    ['apps/cli/src/x.ts', { text: producer }],
    ['apps/cli/src/y.ts', { text: consumer }],
  ])
  const base = () => ({ registryText: registry, boundaryText: 'export function f(){}', files, headCounts: new Map() })

  let r = decide(base())
  ok('C1 合规登记面必绿(反向对照:证明其余各例的红不是恒红)', allGreen(r), JSON.stringify(r.red))

  r = decide({
    ...base(),
    files: new Map([
      ['apps/cli/src/x.ts', { text: 'export const ID = "alpha"; export function doA() { return ID }' }],
      ['apps/cli/src/y.ts', { text: consumer }],
    ]),
  })
  ok('C2 阳性对照:登记了没人生产必判 R1 红', has(r.red.R1, '没有任何记账出口调用'), JSON.stringify(r.red.R1))

  r = decide({ ...base(), files: new Map([['apps/cli/src/y.ts', { text: consumer }]]) })
  ok('C3 producer 文件不在面上必判 R1 红', has(r.red.R1, '不在被审面上'))

  r = decide({
    ...base(),
    files: new Map([
      ['apps/cli/src/x.ts', { text: `// recordInjectionInjected('alpha', '旧实现')\nexport function doA() { return recordInjectionSkipped('other','x') }\n` }],
      ['apps/cli/src/y.ts', { text: consumer }],
    ]),
  })
  ok('C4 注释里的 id 不得算产出', has(r.red.R1, '未出现该 id'), JSON.stringify(r.red.R1))

  r = decide({
    ...base(),
    files: new Map([
      ['apps/cli/src/x.ts', { text: `export const doc = "recordInjectionSkipped('alpha','x')"` }],
      ['apps/cli/src/y.ts', { text: consumer }],
    ]),
  })
  ok('C5 字符串里的出口调用不得算装车', has(r.red.R1, '没有任何记账出口调用'), JSON.stringify(r.red.R1))

  r = decide({ ...base(), files: new Map([['apps/cli/src/x.ts', { text: producer }]]) })
  ok('C6 生产面零可见行调用点必判 R2 红', has(r.red.R2, '零调用点'), JSON.stringify(r.red.R2))

  r = decide({ ...base(), registryText: registry.replace('export function renderInjectionNotice', 'function renderInjectionNotice') })
  ok('C7 唯一出口被摘线必判 R2 红', has(r.red.R2, '不再导出'))

  r = decide({ ...base(), registryText: registry.replace("kind: 'host_reminder'", "kind: 'host_whisper'") })
  ok('C8 kind 越出封闭集必判 R1 红', has(r.red.R1, '不在封闭集'))

  const bare = { text: 'export const s = `[系统提示] 别的东西`;\nexport const t = `[系统提醒] 又一段`;\n' }
  const bypassFiles = new Map([...files, ['apps/cli/src/commands/z.ts', bare]])
  r = decide({ ...base(), files: bypassFiles, headCounts: new Map([['apps/cli/src/commands/z.ts', 0]]) })
  ok('C9 阳性对照:裸 [系统提示] 旁路必判 R3 红', r.red.R3.length === 1 && r.red.R3[0].includes('commands/z.ts'), JSON.stringify(r.red.R3))

  // C9b —— 反向锁:出口调用**在别的行**不得替本行的裸前缀免(旧判据按文件级豁免,
  // 实测 commands/agent.ts 两处真旁路就是这样被一句"已接出口,不计旁路"放过的)
  const excuseFile = {
    text:
      "import { neutralizeBoundaries } from '../utils/prompt-boundary.js'\n" +
      'export function f(x) { return neutralizeBoundaries(x) }\n' +
      'export const g = `[系统提示] 这段没有走出口`\n',
  }
  r = decide({ ...base(), files: new Map([...files, ['apps/cli/src/commands/e.ts', excuseFile]]), headCounts: new Map() })
  ok(
    'C9b 同文件别处有出口 ⇒ 本行裸前缀仍必判 R3 红',
    r.red.R3.length === 1 && r.red.R3[0].includes('commands/e.ts'),
    JSON.stringify(r.red.R3),
  )
  r = decide({
    ...base(),
    files: new Map([
      ...files,
      ['apps/cli/src/commands/e.ts', { text: 'export const g = `[系统提示] x` ${injectHostSection("a","b")}\n' }],
    ]),
    headCounts: new Map(),
  })
  ok(
    'C9c 出口与本行同处一行才算真接线(免判方向必须是"这一行走过出口")',
    r.red.R3.length === 0,
    JSON.stringify(r.red.R3),
  )

  r = decide({ ...base(), files: bypassFiles, headCounts: new Map([['apps/cli/src/commands/z.ts', 2]]) })
  ok('C10 反向锁:HEAD 存量同样两处不得判红(否则就是恒红门)', r.red.R3.length === 0 && r.counted.legacyHits === 2, JSON.stringify(r.red.R3))

  r = decide({
    ...base(),
    files: new Map([...files, ['apps/cli/src/utils/prompt-boundary-ish.ts', { text: 'export function frameSystemReminder(k,b){ return `[系统提醒]` + b }\n' }]]),
    headCounts: new Map(),
  })
  ok('C11 已接出口的文件带前缀不计旁路', r.red.R3.length === 0, JSON.stringify(r.red.R3))

  r = decide({ ...base(), registryText: registry.replace(/\{\s*id: 'alpha'[\s\S]*?\},/, ''), files })
  ok('C12 空登记表必须计无法判定而非通过', has(r.undetermined, '枚举到 0 条'), JSON.stringify(r.undetermined))

  r = decide({ registryText: null, boundaryText: '', files, headCounts: new Map() })
  ok('C13 锚文件取不到不得记绿', r.undetermined.length > 0 && allGreen(r))

  r = decide({
    ...base(),
    files: new Map([
      ['apps/cli/src/x.ts', { text: producer }],
      ['apps/cli/tests/consumer.test.ts', { text: consumer }],
    ]),
  })
  ok('C14 测试面的调用点不得算装车', has(r.red.R2, '零调用点'))

  ok('C15 注释遮而字符串不遮:id 仍可见', maskCode(`const a = 'x'; // 'x'`, { strings: false }).includes(`'x'`))
  ok('C16 遮罩后行数不漂(逐行计数依赖它)', maskCode('a\nb\nc').split('\n').length === 3)

  const failed = cases.filter((c) => !c.pass)
  for (const c of cases) console.log(`${c.pass ? '✅' : '❌'} ${c.name}${c.pass ? '' : ' :: ' + c.detail}`)
  console.log(`--self-test ${cases.length - failed.length}/${cases.length} 通过`)
  return failed.length === 0 ? 0 : 1
}

const allGreen = (r) => [...r.red.R1, ...r.red.R2, ...r.red.R3].length === 0
const has = (arr, needle) => arr.some((s) => s.includes(needle))

/* ------------------------------------------------------------------ CLI */

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    process.exitCode = selfTest()
    return
  }
  const ri = argv.indexOf('--root')
  const root = ri >= 0 && argv[ri + 1] ? path.resolve(argv[ri + 1]) : ROOT
  const { face, error } = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (error) {
    console.error(`❌ ${error}`)
    process.exitCode = 2
    return
  }
  try {
    const res = await audit(root, face)
    const flat = [...res.red.R1, ...res.red.R2, ...res.red.R3]
    if (argv.includes('--json')) {
      console.log(JSON.stringify({ face, ...res, flat }, null, 2))
    } else {
      console.log(`取材面:${face}`)
      for (const line of flat) console.log(line)
      for (const u of res.undetermined) console.log(`⚠️ 未判定:${u}`)
      for (const n of res.notices) console.log(`ℹ️ ${n}`)
      if (flat.length === 0 && res.undetermined.length === 0) {
        console.log(
          `✅ 提示注入登记对账通过:登记 ${res.counted.entries} 条 / kind 封闭集 ${res.counted.kinds} 档 / ` +
            `扫描 ${res.counted.scannedFiles} 文件 / 可见行调用点 ${res.counted.noticeCallers} / ` +
            `R3 存量只报数 ${res.counted.legacyHits}`,
        )
      }
    }
    process.exitCode = flat.length > 0 ? 1 : res.undetermined.length > 0 ? 2 : 0
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`⛔ 无法判定(不冒红也不记绿):${e.message}`)
      process.exitCode = 2
      return
    }
    throw e
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  maskCode,
  parseRegistry,
  splitSpec,
  decide,
  countBarePrefix,
  usesOutlet,
  isTestPath,
  BARE_PREFIX_RE,
  REGISTRY,
  BOUNDARY,
  RECORD_OUTLETS,
  NOTICE_OUTLET,
  SCAN_ROOTS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
