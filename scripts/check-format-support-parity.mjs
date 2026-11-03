#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-format-support-parity.mjs — 「格式登记表 ↔ 渲染/解析实现」只读对账尺(三桶三态)
 *
 * 立因(2026-11-03 核查席实测):仓内有六张各自为政的格式表,互不对账,`grep -rE
 *   "EXT_MIME_MAP|SUPPORTED_EXTS|accept=" scripts/*.mjs` 命中集为空 ⇒ 无人判漂移。
 *   六张表(路径即输入,全部从**源文件**现读解析,§0.6 单一真相源:本脚本不抄任何表内容):
 *     R  apps/api/src/utils/file-type-validator.ts  EXT_MIME_MAP —— 上传白名单(登记面/基准)
 *     A  apps/api/src/services/document-parser.ts   *_MIME 常量 —— RAG 解析面(实现面)
 *     P  apps/ai-service/app/tools/document_tools.py SUPPORTED_EXTENSIONS —— (实现面)
 *     O  apps/web/src/components/media/office-preview.tsx SUPPORTED_EXTS —— 富预览(实现面)
 *     K  apps/web/src/lib/file-preview-attachment.ts OFFICEISH_EXTS + richPreviewKindOf(实现面)
 *     U  apps/web/app/(main)/knowledge-rag/UploadDialog.tsx accept= —— UI 准入(实现面/声明)
 *     M  apps/miniapp-taro/src/rn-compat/native-document.ts MIME_BY_EXT —— 小程序直开(实现面/声明)
 *
 * 三桶:
 *   ① 已登记且有实现 —— 上传收得到、下游也真有解析/预览/直开路径。
 *   ② 已登记但无实现(空头)—— 上传白名单收了、六张实现表零命中(候选如 zip;媒体档由
 *      图像/音视频管道另路承接,本尺不冒充知道那条管道,如实列名交人核)。
 *   ③ 有实现但未登记 —— 某消费面处理/宣称处理某扩展名,但上传白名单不收(候选如 md/json,
 *      前端 accept 里的 .md 用户上传会被后端 400,即此型的实测形状)。
 *
 * 三态(§0.3,绝不并桶):ok(②③皆空)/ drift(②或③非空)/ unjudged。
 *   任一面文件读不到、或该面枚举到 0 个扩展名候选(判死,不拿 0 冒充"该面没有实现"、更不记绿)
 *   ⇒ 该面判 unjudged 并点名原因,整体 exit 2。RAG 面出现解析不出的 MIME 常量(前缀启发
 *   落空)不猜扩展名,单独列「未映射取证」交人核。
 *
 * 档位纪律(§12e + 本仓「只读对账尺子不进提交链」惯例,参照 check-temp-landing /
 *   check-monitor-runtime-parity):
 *   ① 初装存量必然非零(②③当前就有货),升 blocking 的前置是存量归零 ⇒ 本尺永不 blocking;
 *   ② 它判的是**跨端六张表的漂移**——单个提交者改一端一行登记,结构上满足不了"六面同时对齐",
 *      挂提交链即恒红门;⇒ 刻意不进提交链,当前为人工档直跑。
 *   接线现状:**未接任何调度器**(本头注不自称已接线,门 89 R1/R2 安全);候选挂点 =
 *   scripts/git-guardian.mjs 巡检轮(只写日志/台账,clean 即零喊人)。
 *
 * 取材面(§0.4):默认判 **HEAD blob**(`git show HEAD:<path>`);`--worktree` 仅人工逃生舱;
 *   本尺无索引档 —— `--staged` 当场 exit 2 点名"未接提交链、不回落另一个面"。
 *
 * 用法:
 *   node scripts/check-format-support-parity.mjs              # HEAD 档
 *   node scripts/check-format-support-parity.mjs --worktree    # 人工排查
 *   node scripts/check-format-support-parity.mjs --json        # 供调度器读结论
 *   node scripts/check-format-support-parity.mjs --self-test   # 内联夹具(含反向牙)
 * 取证:node --test scripts/tests/check-format-support-parity.test.mjs(镜像判据 import __test__)
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, gitRaw } from './lib/face-reader.mjs'

// ROOT 由脚本自身位置推导(§15:共享工作树的 cwd 不可靠)
export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const EXIT = Object.freeze({ ok: 0, drift: 1, unjudged: 2 })

/** 判据本体:纯函数、零 IO,镜像测试直接 import 同一份(§22c 禁止在测试里复算)。 */

/** R 面:`EXT_MIME_MAP: Record<string, string[]> = { jpg: ['image/jpeg'], ... }` */
export function parseRegistryMap(text) {
  const block = /\b(?:const|let|var)\s+EXT_MIME_MAP\b[^{]*\{([\s\S]*?)\n\}/.exec(text)
  if (!block) return { exts: [], mimeToExt: new Map(), unparseable: ['EXT_MIME_MAP 块解析不出'] }
  const exts = []
  const mimeToExt = new Map()
  const unparseable = []
  for (const line of block[1].split('\n')) {
    const m = /^\s*([a-z0-9]+)\s*:\s*\[([^\]]*)\]/.exec(line)
    if (!m) {
      const t = line.trim()
      if (t.length > 0 && !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*'))
        unparseable.push(`登记行形态不认识:${t}`)
      continue
    }
    const ext = m[1]
    exts.push(ext)
    for (const raw of m[2].split(',')) {
      const mime = raw.trim().replace(/^['"]|['",]$/g, '')
      // 首见优先:canonical 在前(表内约定),后来者不覆盖,防别名漂移
      if (mime && !mimeToExt.has(mime)) mimeToExt.set(mime, ext)
    }
  }
  return { exts, mimeToExt, unparseable }
}

/** A 面:`const DOCX_MIME = 'application/...'` ⇒ 扩展名优先用 R 面 MIME 反查,落空退前缀启发 */
export function parseRagMimes(text, mimeToExt) {
  const exts = []
  const unmapped = []
  const re =
    /const\s+([A-Za-z][A-Za-z0-9_]*)\s*(?::[^=\n]*)?=\s*['"]([A-Za-z0-9.+-]+\/[A-Za-z0-9.+-]+)['"]/g
  let m
  while ((m = re.exec(text)) !== null) {
    const [, name, mime] = m
    if (!name.includes('MIME')) continue
    const byMime = mimeToExt.get(mime)
    if (byMime) {
      exts.push(byMime)
      continue
    }
    const pref = /^(.+?)_MIME(?:_[A-Za-z0-9]+)?$/.exec(name)
    if (pref && !pref[1].includes('MIME')) {
      exts.push(pref[1].toLowerCase())
      continue
    }
    // 标识符给不出实义前缀(如 MIME_OTHER)⇒ 不猜扩展名(§0.3),单列未映射取证
    unmapped.push({ name, mime, reason: '反查与前缀启发双双落空,不猜扩展名' })
  }
  return { exts, unmapped }
}

/** P 面:Python `SUPPORTED_EXTENSIONS: dict[str, str] = { ".txt": "…", ... }` */
export function parsePyExtensions(text) {
  const block = /^\s*SUPPORTED_EXTENSIONS\b[^\n]*\{([\s\S]*?)^\}/m.exec(text)
  if (!block) return { exts: [], unparseable: ['SUPPORTED_EXTENSIONS 块解析不出'] }
  const exts = []
  for (const line of block[1].split('\n')) {
    const m = /^\s*["']\.([A-Za-z0-9]+)["']\s*:/.exec(line)
    if (m) exts.push(m[1].toLowerCase())
  }
  return { exts }
}

/** O 面:`SUPPORTED_EXTS = new Set(['docx', ...])`(具名集常量通用解析) */
export function parseNamedSet(text, name) {
  const block = new RegExp(
    `\\b(?:const|let|var)\\s+${name}\\b[^=]*=\\s*new Set\\(\\[([\\s\\S]*?)\\]\\)`,
  ).exec(text)
  if (!block) return { exts: [], unparseable: [`${name} 集解析不出`] }
  const exts = []
  for (const m of block[1].matchAll(/['"]([A-Za-z0-9]+)['"]/g)) exts.push(m[1].toLowerCase())
  return { exts }
}

/** K 面:OFFICEISH_EXTS 集 + richPreviewKindOf 的 `normalized === 'pdf'` 判型行 */
export function parsePreviewKind(text) {
  const office = parseNamedSet(text, 'OFFICEISH_EXTS')
  const exts = [...office.exts]
  for (const m of text.matchAll(/\bnormalized === ['"]([a-z0-9]+)['"]/g)) exts.push(m[1])
  return { exts, unparseable: office.unparseable ?? [] }
}

/** U 面:`accept=".pdf,.docx,..."` */
export function parseAccept(text) {
  const m = /\baccept=["']([^"']+)["']/.exec(text)
  if (!m) return { exts: [], unparseable: ['accept= 属性解析不出'] }
  const exts = m[1]
    .split(',')
    .map((s) => s.trim().replace(/^\./, '').toLowerCase())
    .filter((s) => /^[a-z0-9]+$/.test(s))
  return { exts }
}

/** M 面:`MIME_BY_EXT: Record<string, string> = { pdf: 'application/pdf', ... }` */
export function parseMimeByExt(text) {
  const block = /\b(?:const|let|var)\s+MIME_BY_EXT\b[^{]*\{([\s\S]*?)\n\}/.exec(text)
  if (!block) return { exts: [], unparseable: ['MIME_BY_EXT 块解析不出'] }
  const exts = []
  for (const line of block[1].split('\n')) {
    const m = /^\s*([a-z0-9]+)\s*:\s*['"][^'"]+['"]/.exec(line)
    if (m) exts.push(m[1])
  }
  return { exts }
}

/** 六面登记表:输入文件与解析器一一对应;新增面只许在此登记,禁止第二份清单(§0.6)。 */
export const FACES = Object.freeze([
  { key: 'R', role: 'registry', file: 'apps/api/src/utils/file-type-validator.ts' },
  { key: 'A', role: 'impl', file: 'apps/api/src/services/document-parser.ts' },
  { key: 'P', role: 'impl', file: 'apps/ai-service/app/tools/document_tools.py' },
  { key: 'O', role: 'impl', file: 'apps/web/src/components/media/office-preview.tsx' },
  { key: 'K', role: 'impl', file: 'apps/web/src/lib/file-preview-attachment.ts' },
  { key: 'U', role: 'impl', file: 'apps/web/app/(main)/knowledge-rag/UploadDialog.tsx' },
  { key: 'M', role: 'impl', file: 'apps/miniapp-taro/src/rn-compat/native-document.ts' },
])

function parseFaceByKey(key, text, mimeToExt) {
  switch (key) {
    case 'R':
      return parseRegistryMap(text)
    case 'A':
      return parseRagMimes(text, mimeToExt)
    case 'P':
      return parsePyExtensions(text)
    case 'O':
      return parseNamedSet(text, 'SUPPORTED_EXTS')
    case 'K':
      return parsePreviewKind(text)
    case 'U':
      return parseAccept(text)
    case 'M':
      return parseMimeByExt(text)
    default:
      return { exts: [], unparseable: [`面 '${key}' 无解析器(登记表与代码脱节)`] }
  }
}

/**
 * 三桶:纯函数。faceReads = [{ key, present, exts:Set|[], reason? }]。
 * 任一面 present=false 或枚举到 0 候选 ⇒ facesBroken 点名(§0.3 判死不记绿)。
 */
export function buildBuckets(registryExts, faceReads) {
  const registered = new Set(registryExts)
  const hits = new Map() // ext -> Set(faceKey)
  const facesBroken = []
  for (const fr of faceReads) {
    const list = [...(fr.exts instanceof Set ? fr.exts : (fr.exts ?? []))]
    if (!fr.present) facesBroken.push({ key: fr.key, reason: fr.reason ?? '读不到' })
    else if (list.length === 0)
      facesBroken.push({ key: fr.key, reason: '枚举到 0 个扩展名候选 ⇒ 判死,不拿 0 冒充"没有"' })
    for (const e of list) {
      if (!hits.has(e)) hits.set(e, new Set())
      hits.get(e).add(fr.key)
    }
  }
  const aligned = []
  const hollow = []
  for (const ext of [...registered].sort()) {
    if (hits.has(ext)) aligned.push(ext)
    else hollow.push(ext)
  }
  const unregistered = [...hits.keys()].filter((e) => !registered.has(e)).sort()
  return {
    aligned,
    hollow,
    unregistered,
    unregisteredHits: Object.fromEntries(
      unregistered.map((e) => [e, [...hits.get(e)].sort().join('+')]),
    ),
    facesBroken,
  }
}

/** 三态裁决:unjudged 顶红优先于 drift(§0.3);绝不并桶。 */
export function verdict(buckets, registryCount) {
  if (buckets.facesBroken.length > 0 || registryCount === 0)
    return {
      state: 'unjudged',
      exit: EXIT.unjudged,
      reason:
        registryCount === 0
          ? 'R 面(登记基准)枚举到 0 ⇒ 判死,三维无从对账,不记绿'
          : `面输入取不到:${buckets.facesBroken.map((f) => `${f.key}(${f.reason})`).join(', ')}`,
    }
  if (buckets.hollow.length > 0 || buckets.unregistered.length > 0)
    return { state: 'drift', exit: EXIT.drift, reason: '②或③非空(漂移显形,warn 档不拦)' }
  return { state: 'ok', exit: EXIT.ok, reason: '六面对齐:登记↔实现零缺口' }
}

/** 面旗解析:本尺无索引档;--staged 与 --worktree 同给或单独给 --staged ⇒ 未判定(§0.4)。 */
export function resolveFace(argv) {
  const flags = ['--staged', '--worktree'].filter((f) => argv.includes(f))
  if (flags.length > 1)
    return { face: null, error: '--staged 与 --worktree 不得同给(两面旗 ⇒ 取材面无定义)' }
  if (flags[0] === '--staged')
    return {
      face: null,
      error: '本尺刻意不进提交链(§12e,只读对账),无索引档;不回落另一个面(§0.4)',
    }
  if (flags[0] === '--worktree') return { face: 'worktree', error: null }
  return { face: 'head', error: null }
}

/** 取材:head 档 git show blob;worktree 档读盘;取不到 ⇒ Undetermined(不猜、不回落)。 */
export function readFaceText(face, file, root = ROOT) {
  if (face === 'worktree') {
    try {
      return readFileSync(path.join(root, ...file.split('/')), 'utf8')
    } catch {
      throw new Undetermined(`${face} 面读不到 ${file}`)
    }
  }
  try {
    return String(gitRaw(['show', `HEAD:${file}`], root, { timeout: 60_000, maxBuffer: 1 << 24 }))
  } catch (e) {
    if (e instanceof Undetermined) throw e
    throw new Undetermined(`${face} 面 git show 取不到 ${file}:${e?.message ?? e}`)
  }
}

export function runChecks(face, root = ROOT) {
  let registry
  try {
    registry = parseRegistryMap(readFaceText(face, FACES[0].file, root))
  } catch (e) {
    return {
      exit: EXIT.unjudged,
      state: 'unjudged',
      reason: `R 面取不到:${e instanceof Undetermined ? e.message : (e?.message ?? e)}`,
      face,
    }
  }
  // R 面是登记基准,绝不进实现 hits(否则②桶被自己反衬成恒空)
  const faceReads = []
  const unmapped = []
  for (const f of FACES.slice(1)) {
    let text = null
    let readError = null
    try {
      text = readFaceText(face, f.file, root)
    } catch (e) {
      readError = e instanceof Undetermined ? e.message : `${e?.message ?? e}`
    }
    if (text === null) {
      faceReads.push({ key: f.key, present: false, exts: [], reason: readError })
      continue
    }
    const r = parseFaceByKey(f.key, text, registry.mimeToExt)
    if (r.unmapped) unmapped.push(...r.unmapped.map((u) => ({ face: f.key, ...u })))
    faceReads.push({
      key: f.key,
      present: (r.unparseable?.length ?? 0) === 0,
      exts: new Set(r.exts),
      reason: r.unparseable?.join(' / '),
    })
  }
  const buckets = buildBuckets(registry.exts, faceReads)
  const v = verdict(buckets, registry.exts.length)
  return { face, registryCount: registry.exts.length, faceReads, buckets, unmapped, ...v }
}

export function printReport(result) {
  console.log(
    `FORMAT-PARITY face=${result.face} 登记面=${result.registryCount ?? '取不到'} 实现面读数=${(
      result.faceReads ?? []
    )
      .map((f) => `${f.key}=${f.exts.size}${f.present ? '' : '(坏)'}`)
      .join(' ')}`,
  )
  for (const key of ['aligned', 'hollow', 'unregistered']) {
    const list = result.buckets?.[key] ?? []
    console.log(`${key} → ${list.length} 个 → ${list.join(', ') || '无'}`)
    if (key === 'unregistered' && result.buckets?.unregisteredHits)
      for (const e of list)
        console.log(`  · ${e} 命中面:${result.buckets.unregisteredHits[e]}(上传白名单不收此档)`)
  }
  if (result.buckets?.facesBroken?.length)
    for (const f of result.buckets.facesBroken) console.log(`  ! 面 ${f.key}:${f.reason}`)
  if (result.unmapped?.length) {
    console.log(`未映射 MIME 取证 ${result.unmapped.length} 条(前缀启发落空,不猜扩展名):`)
    for (const u of result.unmapped) console.log(`  ? ${u.face} ${u.name}='${u.mime}' ${u.reason}`)
  }
  console.log(
    `FORMAT-PARITY-RESULT state=${result.state} exit=${result.exit} ${result.reason ?? ''}`,
  )
}

export const __test__ = {
  parseRegistryMap,
  parseRagMimes,
  parsePyExtensions,
  parseNamedSet,
  parsePreviewKind,
  parseAccept,
  parseMimeByExt,
  buildBuckets,
  verdict,
  resolveFace,
  FACES,
  EXIT,
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const { face, error } = resolveFace(argv)
  if (error) {
    console.log(`FORMAT-PARITY-RESULT state=unjudged exit=2 reason=${error}`)
    return EXIT.unjudged
  }
  const result = runChecks(face)
  if (argv.includes('--json')) console.log(JSON.stringify(result, null, 2))
  else printReport(result)
  return result.exit
}

/** 内联夹具:正向必答(空头/未登记判得出)+ 反向锁(纯排版差异不改判)。 */
function selfTest() {
  const cases = []
  const t = (name, fn) => cases.push({ name, fn })

  const REG = `const EXT_MIME_MAP: Record<string, string[]> = {
  pdf: ['application/pdf'],
  txt: ['text/plain'],
  zip: ['application/zip', 'application/x-zip-compressed'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
}`

  t('R 面夹具:扩展名+MIME 反查表齐备', () => {
    const r = parseRegistryMap(REG)
    if (r.exts.join(',') !== 'pdf,txt,zip,docx') return `exts 不对:${r.exts.join(',')}`
    if (r.mimeToExt.get('application/pdf') !== 'pdf') return 'MIME 反查落空'
    if (r.unparseable.length !== 0) return `注释/空行被误判:${r.unparseable.join('|')}`
    return null
  })

  t('A 面夹具:MIME 常量优先反查登记面,落空退前缀启发', () => {
    const { mimeToExt } = parseRegistryMap(REG)
    const text = `const PDF_MIME = 'application/pdf'
const MD_MIME = 'text/markdown'
const RTF_MIME_ALT = 'text/rtf'`
    const r = parseRagMimes(text, mimeToExt)
    if (!r.exts.includes('pdf') || !r.exts.includes('md') || !r.exts.includes('rtf'))
      return `扩展名不齐:${r.exts.join(',')}`
    return null
  })

  t('A 面反向牙:前缀启发落空不猜,单列未映射取证(§0.3)', () => {
    const text = `const MIME_OTHER = 'weird/thing'`
    const r = parseRagMimes(text, new Map())
    if (r.exts.length !== 0) return `通用名标识符被猜成扩展名:${r.exts.join(',')}`
    if (r.unmapped.length !== 1) return '未映射取证应恰 1 条'
    return null
  })

  t('P/U/M/O/K 面夹具各判各形,零互串', () => {
    const p = parsePyExtensions(
      `SUPPORTED_EXTENSIONS: dict[str, str] = {\n    ".txt": "纯文本",\n    ".epub": "电子书",\n}`,
    )
    if (p.exts.join(',') !== 'txt,epub') return `P 面:${p.exts.join(',')}`
    const u = parseAccept(`<input type="file" accept=".pdf,.docx,.md,.txt" />`)
    if (u.exts.join(',') !== 'pdf,docx,md,txt') return `U 面:${u.exts.join(',')}`
    const m = parseMimeByExt(
      `const MIME_BY_EXT: Record<string, string> = {\n  pdf: 'application/pdf',\n  rar: 'application/vnd.rar',\n}`,
    )
    if (m.exts.join(',') !== 'pdf,rar') return `M 面:${m.exts.join(',')}`
    const o = parseNamedSet(
      `export const SUPPORTED_EXTS = new Set(['docx', 'xlsx', 'pptx'])`,
      'SUPPORTED_EXTS',
    )
    if (o.exts.join(',') !== 'docx,xlsx,pptx') return `O 面:${o.exts.join(',')}`
    const k = parsePreviewKind(`const OFFICEISH_EXTS: ReadonlySet<string> = new Set(['doc', 'docx'])
if (normalized === 'pdf') return { kind: 'pdf' }
if (normalized === 'tsv') return { kind: 'delimited' }`)
    if (!['doc', 'docx', 'pdf', 'tsv'].every((e) => k.exts.includes(e)))
      return `K 面:${k.exts.join(',')}`
    return null
  })

  t('三桶正向:空头与未登记都判得出(zip 无实现、md 未登记)', () => {
    const reg = parseRegistryMap(REG)
    const reads = [
      { key: 'A', present: true, exts: new Set(['pdf', 'txt', 'md']) },
      { key: 'U', present: true, exts: new Set(['pdf', 'md']) },
    ]
    const b = buildBuckets(reg.exts, reads)
    if (!b.hollow.includes('zip')) return `空头 zip 未判出:hollow=${b.hollow.join(',')}`
    if (!b.hollow.includes('docx')) return `空头 docx 未判出`
    if (!b.unregistered.includes('md')) return `未登记 md 未判出`
    if (b.unregistered.includes('pdf')) return 'pdf 已登记却进未登记桶 ⇒ 并桶'
    if (!b.aligned.includes('pdf')) return 'pdf 应落①'
    if (b.facesBroken.length !== 0) return `无坏面却报坏:${JSON.stringify(b.facesBroken)}`
    return null
  })

  t('反向锁:纯排版差异(换序/引号/注释/缩进)不改三桶', () => {
    const a = parseRegistryMap(REG)
    const b = parseRegistryMap(`const EXT_MIME_MAP: Record<string, string[]> = {
  // 换了顺序、加了注释、缩进不同、引号不同
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  zip: ['application/zip'],
  txt: ['text/plain'],
  pdf: ['application/pdf'],
}`)
    const setA = [...a.exts].sort().join(',')
    const setB = [...b.exts].sort().join(',')
    if (setA !== setB) return `排版差异改判了扩展名集:${setA} vs ${setB}`
    return null
  })

  t('三态不并桶:坏面/0 候选 ⇒ unjudged 顶红;空头 ⇒ drift;齐 ⇒ ok', () => {
    const readsBroken = [
      { key: 'R', present: true, exts: new Set(['pdf']) },
      { key: 'A', present: false, exts: [], reason: '读不到' },
    ]
    const vb = verdict(buildBuckets(['pdf'], readsBroken), 1)
    if (vb.state !== 'unjudged' || vb.exit !== EXIT.unjudged) return `坏面应 unjudged:${vb.state}`
    const readsEmptyFace = [
      { key: 'R', present: true, exts: new Set(['pdf']) },
      { key: 'A', present: true, exts: new Set() },
    ]
    const ve = verdict(buildBuckets(['pdf'], readsEmptyFace), 1)
    if (ve.state !== 'unjudged') return `0 候选面应 unjudged(判死不记绿):${ve.state}`
    const vd = verdict(
      buildBuckets(['zip'], [{ key: 'A', present: true, exts: new Set(['pdf']) }]),
      1,
    )
    if (vd.state !== 'drift' || vd.exit !== EXIT.drift) return `空头应 drift:${vd.state}`
    const vo = verdict(
      buildBuckets(['pdf'], [{ key: 'R', present: true, exts: new Set(['pdf']) }]),
      1,
    )
    if (vo.state !== 'ok' || vo.exit !== EXIT.ok) return `全齐应 ok:${vo.state}`
    return null
  })

  t('R 面基准为 0 ⇒ 整体 unjudged(无基准不猜)', () => {
    const vb = buildBuckets([], [{ key: 'R', present: true, exts: new Set() }])
    const v = verdict(vb, 0)
    if (v.state !== 'unjudged') return `应 unjudged:${v.state}`
    return null
  })

  t('面旗:--staged 点名"无索引档";两旗同给报错;默认 head', () => {
    if (resolveFace(['--staged']).face !== null) return '--staged 应被拒(本尺不进提交链)'
    if (!resolveFace(['--staged', '--worktree']).error) return '两旗同给应报错'
    if (resolveFace([]).face !== 'head') return '默认应 head'
    if (resolveFace(['--worktree']).face !== 'worktree') return '--worktree 面解析错'
    return null
  })

  const fails = []
  for (const c of cases) {
    let why = null
    try {
      why = c.fn()
    } catch (e) {
      why = `抛异常:${e?.message ?? e}`
    }
    if (why) {
      console.log(`FAIL ${c.name} — ${why}`)
      fails.push(c.name)
    } else {
      console.log(`ok   ${c.name}`)
    }
  }
  console.log(`SELF-TEST 例数=${cases.length} 失败=${fails.length}`)
  return fails.length === 0 ? EXIT.ok : EXIT.drift
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exitCode = main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(EXIT.unjudged)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
