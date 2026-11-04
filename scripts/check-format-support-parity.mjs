#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-format-support-parity.mjs — 「格式登记表 ↔ 渲染/解析实现」只读对账尺(三桶三态·双族)
 *
 * 立因(2026-11-03 核查席实测):当时仓内六张各自为政的格式表互不对账,`grep -rE
 *   "EXT_MIME_MAP|SUPPORTED_EXTS|accept=" scripts/*.mjs` 命中集为空 ⇒ 无人判漂移(该命中集
 *   现由本尺自己撑起,属立因时点读数)。
 *   十张面(路径即输入,全部从**源文件**现读解析,§0.6 单一真相源:本脚本不抄任何表内容):
 *     R  apps/api/src/utils/file-type-validator.ts  EXT_MIME_MAP —— 上传白名单(登记面/基准)
 *     A  apps/api/src/services/document-parser.ts   *_MIME 常量 —— RAG 解析面(文档族实现面)
 *     P  apps/ai-service/app/tools/document_tools.py SUPPORTED_EXTENSIONS —— (文档族)
 *     O  apps/web/src/components/media/office-preview.tsx SUPPORTED_EXTS —— 富预览(文档族)
 *     K  apps/web/src/lib/file-preview-attachment.ts OFFICEISH_EXTS + richPreviewKindOf(文档族)
 *     U  apps/web/app/(main)/knowledge-rag/UploadDialog.tsx accept= —— UI 准入(文档族)
 *     M  apps/miniapp-taro/src/rn-compat/native-document.ts MIME_BY_EXT —— 小程序直开(文档族)
 *   媒体族(2026-11-03 B 票补的一维:图像/音视频由另一条管道承接,原判据缺该族 ⇒
 *   bmp/gif/jpeg/jpg/mov/ogg/png/webm/webp 九档被误报成「空头」):
 *     V  apps/ai-service/app/services/vision_helper.py     _EXT_TO_MIME —— 读字节→base64 喂视觉模型
 *     B  apps/api/src/routes/ai-audio.ts                    AUDIO_ALLOWED_EXTS —— /audio/upload 送 ASR
 *     W  apps/web/src/components/media/FilePreview.tsx       GALLERY_VIDEO_EXTENSIONS —— <video> 真播
 *   面族(doc / media / any)与「档族」是两件事:档族由 R 面该档**首个 MIME 的 major**现推
 *   (image|video|audio ⇒ media,其余 ⇒ doc,major 取不到 ⇒ unknown ⇒ 退回并族判),
 *   不在本脚本另立第二张表(§0.6)。
 *   **刻意不是面的一张表(2026-11-04 实测裁定,免得下一席再判一遍)**:
 *   `apps/api/src/plugins/upload-scanner.ts` 的 `MAGIC_SIGNATURES` 是**内容嗅探表**不是**准入表** ——
 *   它的作用是"这段字节真是什么"(拿 .zip 装了 gzip 就判不一致并拒),因此它列的档**不该**与
 *   EXT_MIME_MAP 逐项对齐:`['gz','gzip']` 与 `['mpg','mpeg']` 两行有用例正向钉着
 *   (`apps/api/tests/upload-scanner.test.ts:40` 断言 1f 8b 嗅出 application/gzip)。把这两行当成
 *   "有实现未登记"去摘 ⇒ 检出能力变弱(漏报比慢更糟);把它加成本尺第 11 面 ⇒ 恒报两档假 ③,
 *   与 2026-11-03 把九个媒体档误报成 ② 是同一型错(族/管道错位)。
 *
 * 三桶(②按族判:文档档必须文档面接住、媒体档必须媒体面接住;异族命中不算接住,
 *   但会在 hollowReasons 里点名"只被哪个族的面命中",便于逐档复核):
 *   ① 已登记且被**同族**(或 any 族)实现面接住 —— 上传收得到、下游真有解析/预览/直开/播映路径。
 *   ② 已登记但无同族实现 —— 候选如 zip;逐档带 hollowReasons 写明为什么。
 *   ③ 有实现但未登记 —— 某消费面处理/宣称处理某扩展名,但上传白名单不收(候选如 md/json,
 *      前端 accept 里的 .md 用户上传会被后端 400,即此型的实测形状)。③ 可按具名台账豁免
 *      (scripts/data/format-parity-waivers.json:owner+reason+expires 三键齐备且未到期才生效,
 *      缺一律视同无豁免;台账列了却不再命中 ⇒ staleWaivers 清单腐烂,判 drift 不判绿)。
 *
 * 三态(§0.3,绝不并桶):ok(②③皆空)/ drift(②或③非空,或豁免清单腐烂)/ unjudged。
 *   任一面文件读不到、或该面枚举到 0 个扩展名候选(判死,不拿 0 冒充"该面没有实现"、更不记绿)
 *   ⇒ 该面判 unjudged 并点名原因,整体 exit 2。RAG 面出现解析不出的 MIME 常量(前缀启发
 *   落空)不猜扩展名,单独列「未映射取证」交人核。豁免台账读不到/JSON 坏 ⇒ 不豁免任何一档
 *   (失效方向 = 多要一次定向说明,绝不是多放一次跳门,§0.7/§0.10),并把读失败点名打印。
 *
 * 档位纪律(§12e + 本仓「只读对账尺子不进提交链」惯例,参照 check-temp-landing /
 *   check-monitor-runtime-parity):
 *   ① 初装存量必然非零(②③当前就有货),升 blocking 的前置是存量归零 ⇒ 本尺永不 blocking;
 *   ② 它判的是**跨端十张表的漂移**——单个提交者改一端一行登记,结构上满足不了"十面同时对齐",
 *      挂提交链即恒红门;⇒ 刻意不进提交链,当前为人工档直跑(runner 现读未登记本尺)。
 *   接线现状(2026-11-04 起):唯一调度器 = `scripts/git-guardian.mjs` 的 `sweepFormatParity()`
 *   (两处执行体同挂:main() 健康轮次与 daemon tick,共用一枚节流戳,先到者真跑;30 分钟节流、
 *   ok/drift 只写日志不寄信 —— 补白名单/摘虚假承诺/出具名豁免都是 agent 当场能做的活,按 §5e-2
 *   不推回机主;未判定走稳定身份,连满 6 小时才到人)。人工档仍在(本头注不自称进提交链)。
 *   镜像:`scripts/tests/git-guardian-format-parity-sweep.test.mjs`(调度腿 8 例)。
 *
 * 取材面(§0.4):默认判 **HEAD blob**(`git show HEAD:<path>`);`--worktree` 仅人工逃生舱;
 *   本尺无索引档 —— `--staged` 当场 exit 2 点名"未接提交链、不回落另一个面"。
 *   豁免台账是唯一读**盘上**的输入(它是本票新写的具名台账,不在任何端上;读不到 ⇒ 不豁免)。
 *
 * 用法:
 *   node scripts/check-format-support-parity.mjs              # HEAD 档
 *   node scripts/check-format-support-parity.mjs --worktree    # 人工排查
 *   node scripts/check-format-support-parity.mjs --json        # 供调度器读结论
 *   node scripts/check-format-support-parity.mjs --self-test   # 内联夹具(含反向牙)
 * 取证:node --test scripts/tests/check-format-support-parity.test.mjs(镜像判据 import __test__)
 */
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, readWorktreeFile, Undetermined } from './lib/face-reader.mjs'

// ROOT 由脚本自身位置推导(§15:共享工作树的 cwd 不可靠)
export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const EXIT = Object.freeze({ ok: 0, drift: 1, unjudged: 2 })

/** 判据本体:纯函数、零 IO,镜像测试直接 import 同一份(§22c 禁止在测试里复算)。 */

/** R 面:`EXT_MIME_MAP: Record<string, string[]> = { jpg: ['image/jpeg'], ... }` */
export function parseRegistryMap(text) {
  const block = /\b(?:const|let|var)\s+EXT_MIME_MAP\b[^{]*\{([\s\S]*?)\n\}/.exec(text)
  if (!block)
    return {
      exts: [],
      mimeToExt: new Map(),
      majorByExt: new Map(),
      unparseable: ['EXT_MIME_MAP 块解析不出'],
    }
  const exts = []
  const mimeToExt = new Map()
  const majorByExt = new Map()
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
    let firstMajor = ''
    for (const raw of m[2].split(',')) {
      const mime = raw.trim().replace(/^['"]|['",]$/g, '')
      // 首见优先:canonical 在前(表内约定),后来者不覆盖,防别名漂移
      if (mime && !mimeToExt.has(mime)) mimeToExt.set(mime, ext)
      if (mime && !firstMajor) firstMajor = mime.split('/')[0].trim().toLowerCase()
    }
    // 档族从**首 MIME 的 major** 现推(§0.6:不在此脚本另立族表);major 取不到 ⇒ 空串(unknown)
    if (firstMajor) majorByExt.set(ext, firstMajor)
  }
  return { exts, mimeToExt, majorByExt, unparseable }
}

/**
 * 档族判定:唯一实现。image/video/audio ⇒ 'media';有 major 但非这三族 ⇒ 'doc';
 * major 取不到 ⇒ 'unknown'(不猜,buildBuckets 对 unknown 退回并族判定并点名)。
 */
export const MEDIA_MAJORS = Object.freeze(['image', 'video', 'audio'])
export function familyOfExt(major) {
  if (!major) return 'unknown'
  return MEDIA_MAJORS.includes(major) ? 'media' : 'doc'
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

/** P/V 面:Python `NAME: dict[str, str] = { ".txt": "纯文本", ... }`(同一形态,一族一个名) */
export function parsePyExtensions(text, name = 'SUPPORTED_EXTENSIONS') {
  const block = new RegExp(`^\\s*${name}\\b[^\\n]*\\{([\\s\\S]*?)^\\}`, 'm').exec(text)
  if (!block) return { exts: [], unparseable: [`${name} 块解析不出`] }
  const exts = []
  for (const line of block[1].split('\n')) {
    const m = /^\s*["']\.([A-Za-z0-9]+)["']\s*:/.exec(line)
    if (m) exts.push(m[1].toLowerCase())
  }
  return { exts }
}

/**
 * B/W 面:TS 字符串数组字面量 `const NAME[: 类型] = ['.wav', 'mp4', ...]`(点前缀可选)。
 *   B = apps/api/src/routes/ai-audio.ts  AUDIO_ALLOWED_EXTS(/audio/upload 真送 ASR)
 *   W = apps/web/src/components/media/FilePreview.tsx GALLERY_VIDEO_EXTENSIONS(<video> 真播)
 */
export function parseExtStringArray(text, name) {
  const block = new RegExp(
    `\\b(?:const|let|var)\\s+${name}\\b[^=\\n]*=\\s*\\[([\\s\\S]*?)\\]`,
  ).exec(text)
  if (!block) return { exts: [], unparseable: [`${name} 数组解析不出`] }
  const exts = []
  for (const m of block[1].matchAll(/['"]\.?([A-Za-z0-9]+)['"]/g)) exts.push(m[1].toLowerCase())
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

/**
 * 十面登记表:输入文件与解析器一一对应;新增面只许在此登记,禁止第二份清单(§0.6)。
 * family:该面能**接住**哪一族档的下游处理。文档族(doc)=解析/预览/直开;媒体族(media)
 *   =图像/音视频的真处理(喂模型、ASR、播映)。判 ② 时按「档族 ↔ 面族」同族才算接住。
 */
export const FACES = Object.freeze([
  { key: 'R', role: 'registry', family: 'any', file: 'apps/api/src/utils/file-type-validator.ts' },
  { key: 'A', role: 'impl', family: 'doc', file: 'apps/api/src/services/document-parser.ts' },
  { key: 'P', role: 'impl', family: 'doc', file: 'apps/ai-service/app/tools/document_tools.py' },
  {
    key: 'O',
    role: 'impl',
    family: 'doc',
    file: 'apps/web/src/components/media/office-preview.tsx',
  },
  { key: 'K', role: 'impl', family: 'doc', file: 'apps/web/src/lib/file-preview-attachment.ts' },
  {
    key: 'U',
    role: 'impl',
    family: 'doc',
    file: 'apps/web/app/(main)/knowledge-rag/UploadDialog.tsx',
  },
  {
    key: 'M',
    role: 'impl',
    family: 'doc',
    file: 'apps/miniapp-taro/src/rn-compat/native-document.ts',
  },
  // ── 媒体族(B 票新增:图像处理管道 + 音视频管道)──
  {
    key: 'V',
    role: 'impl',
    family: 'media',
    file: 'apps/ai-service/app/services/vision_helper.py',
  },
  { key: 'B', role: 'impl', family: 'media', file: 'apps/api/src/routes/ai-audio.ts' },
  {
    key: 'W',
    role: 'impl',
    family: 'media',
    file: 'apps/web/src/components/media/FilePreview.tsx',
  },
])

/** 媒体族面的解析器与常量名(与 FACES 同处登记,§0.6 不另立清单)。 */
const MEDIA_FACE_PARSERS = Object.freeze({
  V: { parse: parsePyExtensions, constName: '_EXT_TO_MIME' },
  B: { parse: parseExtStringArray, constName: 'AUDIO_ALLOWED_EXTS' },
  W: { parse: parseExtStringArray, constName: 'GALLERY_VIDEO_EXTENSIONS' },
})

function parseFaceByKey(key, text, mimeToExt) {
  const media = MEDIA_FACE_PARSERS[key]
  if (media) return media.parse(text, media.constName)
  switch (key) {
    case 'R':
      return parseRegistryMap(text)
    case 'A':
      return parseRagMimes(text, mimeToExt)
    case 'P':
      return parsePyExtensions(text, 'SUPPORTED_EXTENSIONS')
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
 * 三桶:纯函数。faceReads = [{ key, family?, present, exts:Set|[], reason? }]。
 * familyOf = Map(ext -> 'doc'|'media'|'unknown')(由 R 面 MIME major 现推;缺省 ⇒ 全部
 * 'unknown',即退回并族判定 = 老语义,保镜像测试的向后兼容)。
 * 任一面 present=false 或枚举到 0 候选 ⇒ facesBroken 点名(§0.3 判死不记绿)。
 * ② 按族判:同族(或面族 any)命中才算接住;只被异族面命中 ⇒ 仍进 ②,并在 hollowReasons
 *   点名"哪些异族面接住了但它不算"。
 */
export function buildBuckets(registryExts, faceReads, familyOf = null) {
  const registered = new Set(registryExts)
  const hits = new Map() // ext -> Set(faceKey)
  const facesBroken = []
  const faceFamily = new Map(faceReads.map((f) => [f.key, f.family ?? 'any']))
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
  const hollowReasons = {}
  for (const ext of [...registered].sort()) {
    const need = familyOf?.get?.(ext) ?? familyOf?.[ext] ?? 'unknown'
    const hitKeys = [...(hits.get(ext) ?? [])].sort()
    const sameFamily = hitKeys.filter((k) => {
      const fam = faceFamily.get(k) ?? 'any'
      return fam === 'any' || fam === need || need === 'unknown'
    })
    if (sameFamily.length > 0) aligned.push(ext)
    else {
      hollow.push(ext)
      hollowReasons[ext] =
        hitKeys.length === 0
          ? `族=${need}:十面零命中(上传收了却无任何下游处理)`
          : `族=${need}:只被异族面 ${hitKeys.map((k) => `${k}(${faceFamily.get(k)})`).join('+')} 命中 ⇒ 本族管道未接住`
    }
  }
  const unregistered = [...hits.keys()].filter((e) => !registered.has(e)).sort()
  return {
    aligned,
    hollow,
    hollowReasons,
    unregistered,
    unregisteredHits: Object.fromEntries(
      unregistered.map((e) => [e, [...hits.get(e)].sort().join('+')]),
    ),
    facesBroken,
  }
}

/**
 * 具名豁免台账裁决(纯函数;§0.7「验过才免且会到期」+ §0.10 失效方向)。
 * entries = [{ ext, owner, reason, expires }];required 三键(owner/reason/expires)缺一
 * 或 reason 短于 10 字 ⇒ malformed,不生效;expires < today ⇒ expired,不生效(回③)。
 * 台账里登了、但本次③不再命中该档 ⇒ stale(清单腐烂),由 verdict 判 drift 不判绿。
 */
export function applyWaivers(unregistered, entries, today = new Date().toISOString().slice(0, 10)) {
  const list = Array.isArray(entries) ? entries : []
  const set = new Set(unregistered)
  const waived = []
  const malformed = []
  const usedExt = new Set()
  for (const e of list) {
    const ext = typeof e?.ext === 'string' ? e.ext.toLowerCase() : ''
    if (!ext) {
      malformed.push({ ext: String(e?.ext ?? '<无 ext 键>'), why: '条目缺 ext 键' })
      continue
    }
    const owner = typeof e?.owner === 'string' ? e.owner.trim() : ''
    const reason = typeof e?.reason === 'string' ? e.reason.trim() : ''
    const expires = typeof e?.expires === 'string' ? e.expires.trim() : ''
    if (!owner || reason.length < 10 || !/^\d{4}-\d{2}-\d{2}$/.test(expires)) {
      malformed.push({
        ext,
        why: `owner/reason(≥10字)/expires(YYYY-MM-DD) 三键不全:owner='${owner}' reason长度=${reason.length} expires='${expires}'`,
      })
      continue
    }
    if (expires < today) {
      malformed.push({ ext, why: `豁免已到期 expires=${expires}<${today} ⇒ 视同无豁免` })
      continue
    }
    if (!set.has(ext)) {
      malformed.push({ ext, why: '台账在册但本次③不再命中 ⇒ 清单腐烂(§0.7),须摘条目或复核判据' })
      continue
    }
    usedExt.add(ext)
    waived.push({ ext, owner, reason, expires })
  }
  const staleWaivers = malformed.filter((m) => m.why.includes('清单腐烂')).map((m) => m.ext)
  return {
    unregistered: unregistered.filter((e) => !usedExt.has(e)),
    waived,
    staleWaivers,
    malformed,
  }
}

/** 三态裁决:unjudged 顶红优先于 drift(§0.3);绝不并桶。 */
export function verdict(buckets, registryCount, waiverIssues = {}) {
  if (buckets.facesBroken.length > 0 || registryCount === 0)
    return {
      state: 'unjudged',
      exit: EXIT.unjudged,
      reason:
        registryCount === 0
          ? 'R 面(登记基准)枚举到 0 ⇒ 判死,三维无从对账,不记绿'
          : `面输入取不到:${buckets.facesBroken.map((f) => `${f.key}(${f.reason})`).join(', ')}`,
    }
  const drifts = []
  if (buckets.hollow.length > 0) drifts.push(`②空头 ${buckets.hollow.length} 档`)
  if (buckets.unregistered.length > 0)
    drifts.push(`③有实现未登记 ${buckets.unregistered.length} 档`)
  const stale = waiverIssues.staleWaivers ?? []
  if (stale.length > 0) drifts.push(`豁免清单腐烂 ${stale.length} 条(${stale.join(',')})`)
  if (drifts.length > 0)
    return {
      state: 'drift',
      exit: EXIT.drift,
      reason: `${drifts.join(' + ')}(漂移显形,warn 档不拦)`,
    }
  return { state: 'ok', exit: EXIT.ok, reason: '十面对齐:登记↔实现(按族)零缺口' }
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

/** 取材:head 档走统一取材层取 HEAD blob;worktree 档读盘;取不到 ⇒ Undetermined(不猜、不回落)。 */
export function readFaceText(face, file, root = ROOT) {
  if (face === 'worktree') {
    try {
      return readWorktreeFile(root, file)
    } catch {
      throw new Undetermined(`${face} 面读不到 ${file}`)
    }
  }
  try {
    const text = catBatch(root, [`HEAD:${file}`], { timeout: 60_000 }).get(`HEAD:${file}`)
    if (typeof text !== 'string') throw new Undetermined(`${face} 面取不到 ${file}`)
    return text
  } catch (e) {
    if (e instanceof Undetermined) throw e
    throw new Undetermined(`${face} 面取不到 ${file}:${e?.message ?? e}`)
  }
}

/** 具名豁免台账(唯一读盘上的输入:它是判据自己的配置,不是被审面;读不到 ⇒ 一条也不豁免)。 */
export const WAIVER_LEDGER_FILE = 'scripts/data/format-parity-waivers.json'

export function readWaiverLedger(root = ROOT) {
  let raw = null
  try {
    // 走仓内唯一的「取盘上字节」出口 lib/face-reader.mjs,不在本尺另开一条 fs 通道(§0.6)
    raw = readWorktreeFile(root, WAIVER_LEDGER_FILE)
  } catch (e) {
    return { entries: [], error: `${WAIVER_LEDGER_FILE} 取不到:${e?.message ?? e}` }
  }
  if (raw === null) {
    return { entries: [], error: `${WAIVER_LEDGER_FILE} 不在盘上 ⇒ 一条也不豁免(§0.10 失效方向)` }
  }
  try {
    const parsed = JSON.parse(raw)
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : null
    if (!entries) return { entries: [], error: `${WAIVER_LEDGER_FILE} 无 entries 数组 ⇒ 不豁免` }
    return { entries, error: null, schema: parsed?.schema ?? '无 schema 键' }
  } catch (e) {
    return { entries: [], error: `${WAIVER_LEDGER_FILE} JSON 坏:${e?.message ?? e}` }
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
      faceReads.push({
        key: f.key,
        family: f.family ?? 'any',
        present: false,
        exts: [],
        reason: readError,
      })
      continue
    }
    const r = parseFaceByKey(f.key, text, registry.mimeToExt)
    if (r.unmapped) unmapped.push(...r.unmapped.map((u) => ({ face: f.key, ...u })))
    faceReads.push({
      key: f.key,
      family: f.family ?? 'any',
      present: (r.unparseable?.length ?? 0) === 0,
      exts: new Set(r.exts),
      reason: r.unparseable?.join(' / '),
    })
  }
  // 档族从 R 面首个 MIME 的 major 现推(不另立表,§0.6);major 缺 ⇒ 'unknown' 退回并族判
  const familyOf = new Map(
    registry.exts.map((e) => [e, familyOfExt(registry.majorByExt.get(e) ?? '')]),
  )
  const buckets = buildBuckets(registry.exts, faceReads, familyOf)
  const ledger = readWaiverLedger(root)
  const waiver = applyWaivers(buckets.unregistered, ledger.entries)
  // ③ 的有效集 = 原始命中集剔掉具名豁免(豁免必须能改判,否则等于没装这道台账)
  const v = verdict({ ...buckets, unregistered: waiver.unregistered }, registry.exts.length, waiver)
  const unknownFamily = registry.exts.filter((e) => familyOf.get(e) === 'unknown')
  return {
    face,
    registryCount: registry.exts.length,
    familyCounts: Object.fromEntries(
      ['doc', 'media', 'unknown'].map((f) => [
        f,
        registry.exts.filter((e) => familyOf.get(e) === f).length,
      ]),
    ),
    faceReads,
    buckets,
    waiver,
    waiverLedgerError: ledger.error,
    unknownFamily,
    unmapped,
    ...v,
  }
}

export function printReport(result) {
  console.log(
    `FORMAT-PARITY face=${result.face} 登记面=${result.registryCount ?? '取不到'} 档族=${
      result.familyCounts
        ? Object.entries(result.familyCounts)
            .map(([k, v]) => `${k}:${v}`)
            .join(' ')
        : '取不到'
    } 实现面读数=${(result.faceReads ?? [])
      .map(
        (f) =>
          `${f.key}${f.family === 'media' ? '(媒)' : ''}=${f.exts.size}${f.present ? '' : '(坏)'}`,
      )
      .join(' ')}`,
  )
  for (const key of ['aligned', 'hollow', 'unregistered']) {
    // ③ 一律按**剔掉具名豁免后的有效集**报数(与 verdict 同一份集,不得一处 4 一处 3)
    const list =
      key === 'unregistered'
        ? (result.waiver?.unregistered ?? result.buckets?.[key] ?? [])
        : (result.buckets?.[key] ?? [])
    console.log(`${key} → ${list.length} 个 → ${list.join(', ') || '无'}`)
    if (key === 'hollow')
      for (const e of list)
        console.log(`  · ${e} 留②原因:${result.buckets?.hollowReasons?.[e] ?? '未记录(判据缺项)'}`)
    if (key === 'unregistered' && result.buckets?.unregisteredHits)
      for (const e of list)
        console.log(`  · ${e} 命中面:${result.buckets.unregisteredHits[e]}(上传白名单不收此档)`)
  }
  if (result.waiver?.waived?.length) {
    console.log(`③ 具名豁免生效 ${result.waiver.waived.length} 条(台账 ${WAIVER_LEDGER_FILE}):`)
    for (const w of result.waiver.waived)
      console.log(`  ✓ ${w.ext} owner=${w.owner} expires=${w.expires} 理由:${w.reason}`)
  }
  if (result.waiverLedgerError)
    console.log(`  ! 豁免台账:${result.waiverLedgerError}(一条也不豁免)`)
  if (result.waiver?.staleWaivers?.length)
    console.log(
      `  ! 豁免清单腐烂 ${result.waiver.staleWaivers.length} 条(§0.7 登了却不再命中):${result.waiver.staleWaivers.join(', ')}`,
    )
  if (result.waiver?.malformed?.length)
    for (const m of result.waiver.malformed) console.log(`  ! 豁免条目不生效 ${m.ext}:${m.why}`)
  if (result.unknownFamily?.length)
    console.log(
      `  ? 档族 unknown(MIME major 取不到,退回并族判)${result.unknownFamily.length} 档:${result.unknownFamily.join(', ')}`,
    )
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
  parseExtStringArray,
  familyOfExt,
  buildBuckets,
  applyWaivers,
  verdict,
  resolveFace,
  FACES,
  WAIVER_LEDGER_FILE,
  MEDIA_MAJORS,
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

  // ── 媒体族(B 票新增的一维)──
  t('V/B/W 三面夹具各判各形,零互串', () => {
    const v = parsePyExtensions(
      `_EXT_TO_MIME: dict[str, str] = {\n    ".png": "image/png",\n    ".bmp": "image/bmp",\n}`,
      '_EXT_TO_MIME',
    )
    if (v.exts.join(',') !== 'png,bmp') return `V 面:${v.exts.join(',')}`
    const b = parseExtStringArray(
      `const AUDIO_ALLOWED_EXTS = ['.wav', '.mp3', '.ogg', '.flac']`,
      'AUDIO_ALLOWED_EXTS',
    )
    if (b.exts.join(',') !== 'wav,mp3,ogg,flac') return `B 面:${b.exts.join(',')}`
    const w = parseExtStringArray(
      `const GALLERY_VIDEO_EXTENSIONS: readonly string[] = ['mp4', 'webm', 'mov']`,
      'GALLERY_VIDEO_EXTENSIONS',
    )
    if (w.exts.join(',') !== 'mp4,webm,mov') return `W 面:${w.exts.join(',')}`
    const miss = parseExtStringArray(`const X = 1`, 'AUDIO_ALLOWED_EXTS')
    if (miss.exts.length !== 0 || !miss.unparseable?.length) return '解析不出时应 0 扩展名+点名'
    return null
  })

  t('档族由 R 面 MIME major 现推:image/video/audio=media,其余=doc,major 缺=unknown', () => {
    if (familyOfExt('image') !== 'media') return 'image 应为 media'
    if (familyOfExt('video') !== 'media') return 'video 应为 media'
    if (familyOfExt('audio') !== 'media') return 'audio 应为 media'
    if (familyOfExt('application') !== 'doc') return 'application 应为 doc'
    if (familyOfExt('text') !== 'doc') return 'text 应为 doc'
    if (familyOfExt('') !== 'unknown') return 'major 取不到应 unknown(不猜)'
    const r = parseRegistryMap(
      `const EXT_MIME_MAP: Record<string, string[]> = {\n  png: ['image/png'],\n  pdf: ['application/pdf'],\n}`,
    )
    if (r.majorByExt.get('png') !== 'image') return `majorByExt:${[...r.majorByExt]}`
    if (r.majorByExt.get('pdf') !== 'application') return 'pdf major 应为 application'
    return null
  })

  t('②按族判:同族面接住进①,文档档零命中留②且逐档写明原因', () => {
    const reg = parseRegistryMap(`const EXT_MIME_MAP: Record<string, string[]> = {
  png: ['image/png'],
  pdf: ['application/pdf'],
  zip: ['application/zip'],
}`)
    const fam = new Map(reg.exts.map((e) => [e, familyOfExt(reg.majorByExt.get(e) ?? '')]))
    const reads = [
      { key: 'M', family: 'doc', present: true, exts: new Set(['pdf']) },
      { key: 'V', family: 'media', present: true, exts: new Set(['png']) },
    ]
    const b = buildBuckets(reg.exts, reads, fam)
    if (b.aligned.join(',') !== 'pdf,png') return `同族命中应双双进①:${b.aligned.join(',')}`
    if (b.hollow.join(',') !== 'zip') return `zip 十面零命中应留②:${b.hollow.join(',')}`
    if (!/族=doc.*零命中/.test(b.hollowReasons.zip ?? ''))
      return `②留档原因未写明族与命中情况:${b.hollowReasons.zip}`
    if (verdict(b, 3, { staleWaivers: [] }).state !== 'drift') return '留②应 drift,不得记绿'
    return null
  })

  t('②按族判反向牙:媒体档只被文档面命中不得算接住(防尺子被媒体面洗绿)', () => {
    const reg = parseRegistryMap(
      `const EXT_MIME_MAP: Record<string, string[]> = {\n  webm: ['video/webm'],\n}`,
    )
    const fam = new Map([['webm', 'media']])
    const b = buildBuckets(
      reg.exts,
      [{ key: 'M', family: 'doc', present: true, exts: new Set(['webm']) }],
      fam,
    )
    if (b.aligned.length !== 0) return `异族命中被算成了①:${b.aligned.join(',')}`
    if (!b.hollow.includes('webm')) return 'webm 应留②'
    if (!/只被异族面 M\(doc\)/.test(b.hollowReasons.webm ?? ''))
      return `②留档原因没点名异族面:${b.hollowReasons.webm}`
    if (verdict(b, 1, { staleWaivers: [] }).state !== 'drift') return '留②应 drift,不得记绿'
    return null
  })

  t('族表缺省(未传 familyOf)=并族判定,老语义不破(向后兼容)', () => {
    const b = buildBuckets(
      ['png'],
      [
        { key: 'A', present: true, exts: new Set(['png']) },
        { key: 'V', family: 'media', present: true, exts: new Set(['bmp']) },
      ],
    )
    if (!b.aligned.includes('png')) return '未传 familyOf 时 A(doc/any) 命中应算①'
    if (b.hollow.length !== 0) return `不该有空头:${b.hollow.join(',')}`
    return null
  })

  t('豁免台账:三键齐备才生效;缺键/理由短/已到期/不再命中 ⇒ 一律不生效', () => {
    const okE = {
      ext: 'html',
      owner: 'apps/api',
      reason: '后端按 XSS 故意不收 html,属安全设计而非漂移',
      expires: '2099-01-01',
    }
    const w = applyWaivers(['html', 'md'], [okE], '2026-11-03')
    if (w.unregistered.join(',') !== 'md') return `豁免后③应只剩 md:${w.unregistered.join(',')}`
    if (w.waived.length !== 1 || w.waived[0].ext !== 'html') return 'html 应被具名豁免'
    if (w.staleWaivers.length !== 0) return `不该报腐烂:${JSON.stringify(w.staleWaivers)}`
    const shortReason = applyWaivers(['html'], [{ ...okE, reason: '太短' }], '2026-11-03')
    if (shortReason.waived.length !== 0 || shortReason.unregistered.join(',') !== 'html')
      return 'reason 不足 10 字仍被豁免 ⇒ 验过才免失效'
    const expired = applyWaivers(['html'], [{ ...okE, expires: '2020-01-01' }], '2026-11-03')
    if (expired.waived.length !== 0) return '到期豁免仍生效 ⇒ 豁免不会到期'
    const missingKey = applyWaivers(['html'], [{ ...okE, owner: '' }], '2026-11-03')
    if (missingKey.waived.length !== 0) return '缺 owner 仍生效 ⇒ 缺一半视同无豁免'
    const rotten = applyWaivers(['md'], [okE], '2026-11-03')
    if (rotten.staleWaivers.join(',') !== 'html')
      return `登了却不再命中应报清单腐烂:${JSON.stringify(rotten)}`
    const v = verdict(
      { facesBroken: [], hollow: [], unregistered: [], hollowReasons: {} },
      5,
      rotten,
    )
    if (v.state !== 'drift') return `清单腐烂应判 drift 不判绿:${v.state}`
    const none = applyWaivers(['html'], null, '2026-11-03')
    if (none.unregistered.join(',') !== 'html') return '台账取不到不得多放一次跳门'
    return null
  })

  t('面登记表形状锁:1 基准 + 6 文档面 + 3 媒体面,族字段齐备', () => {
    if (FACES[0].role !== 'registry') return '首面必须是登记基准'
    const impl = FACES.filter((f) => f.role === 'impl')
    if (impl.length !== 9) return `实现面应 9(6 文档 + 3 媒体),现 ${impl.length}`
    if (impl.filter((f) => f.family === 'media').length !== 3) return '媒体面应恰 3'
    if (impl.filter((f) => f.family === 'doc').length !== 6) return '文档面应恰 6'
    if (FACES.some((f) => !f.family || !f.file || !f.key)) return '每面必须有 key/file/family'
    if (new Set(FACES.map((f) => f.key)).size !== FACES.length) return '面 key 重复'
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
