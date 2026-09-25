// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 工具功能名"在各端真的取到值"守门(2026-09-21 立)。
 *
 * 拦两类**静默**失败(都在本轮真实踩过):
 *  1. shared 词表加了映射,但某语言 / 某端语言包没有对应 taskStatus 键 →
 *     端内取词器(点号全路径 + 缺键回显键名)会把 `read_file` 显示成 `toolReadFile`;
 *     断言"界面不含 read_file"仍然通过,肉眼也看不出。
 *  2. miniapp-taro 的离线压缩语言包 `remote-locales.gen.ts` 忘了重生 →
 *     非中文端整块掉回中文/键名(实测 taskStatus 键数 13 vs shared 139)。
 *
 * 判据:对 TOOL_DISPLAY_KEYS 的每个 display key,
 *   - shared/<lang>.json 的 taskStatus[key] 必须是非空字符串且不等于键名;
 *   - 每个端语言包与 shared 深合并后(端 override 优先)同样必须解析出值;
 *   - miniapp-taro 生成物里 5 语言载荷各自必须解析出值(过期即红)。
 *
 * 本门**只判、只报差异**,不改文件。判定内容(键集、合并语义、离线包解码、失败口径)一字未动 ——
 * 2026-09-26 只换了"字节从哪儿来"这一件事。
 *
 * 取材面(2026-09-26 收口,与守门 36/124/93/rn-global-css-sync 同口径):默认判 **HEAD blob**,
 * `--staged` 判**索引 blob**(这次提交会带走的那一份 —— 盘上随后改对不算修好),`--worktree` 只作
 * 人工逃生舱,两个面旗同给 = 自相矛盾 ⇒ 判死;判定的那一面取不到 ⇒ **exit 2「无法判定」**,
 * 既不冒红也不记绿,且**不回落**到另一个面(回落就是把"没判"写成"判过了")。
 * 为什么必须换:这 34 个输入(词表 + MCP 表 + 30 个语言包 + 生成器 + 离线包)**全部是仓库内容**,
 * 而共享工作树常年被并行会话的半编辑态占据。实测(2026-09-26,同一份门代码):按磁盘判
 * **exit 1 / 223 处取不到值**,而 `git archive HEAD` 干净检出判 **exit 0** —— 那 223 处与任何人
 * 正在做的提交都无关,是一道只会逼人 `--no-verify`、连带废掉全部守门的恒红门(§12e 同型)。
 * 清单与内容同面同轮:候选路径由常量表推导(LANGS × END_DIRS,不做目录枚举),所以"清单"天然与
 * 内容同面;一次 `cat-file --batch` 读完 34 个 blob,不存在"清单读盘 + 内容读 git"的混面尺子。
 * 无机器态输入:本门不读仓库外的任何文件,因此没有第二把尺子可言。
 *
 * 与旧磁盘版的**唯一**语义差别(如实登记,不改判据):旧版对"盘上取不到的语言包"用
 * `readJson` 的 try/catch 静默折成 `{}`;新版仍然折成 `{}` 并照旧参与判定,但会把这类路径
 * **逐条计数并写进结论行**(`缺包 N 个`),"看起来全绿而其实少扫一整批"那一型不再能隐身。
 * 四个必需输入(词表 / MCP 表 / 生成器 / 离线包)缺失 → 与旧版一致地判"无法判定"(旧版是
 * ENOENT 抛出被 `.catch` 折成 exit 2,现在是 `Undetermined` ⇒ exit 2,退出码相同、原因可读)。
 *
 * 用法:
 *   node scripts/check-tool-display-resolvable.mjs             全量(HEAD blob)
 *   node scripts/check-tool-display-resolvable.mjs --staged    索引面(提交链)
 *   node scripts/check-tool-display-resolvable.mjs --worktree  人工排查(盘上内容,提交链不走这档)
 *   node scripts/check-tool-display-resolvable.mjs --json      机读(含 face 字段)
 * 紧急跳过:HUSKY_SKIP_TOOL_DISPLAY_RESOLVABLE=1 git commit ...
 */
import { gunzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 取材只走这一层:绝对路径 git、safe.directory、quotepath、windowsHide、maxBuffer、
// "输出被截断 ⇒ 无法判定" —— 这五处易错点各门自己写一遍就会各漏一遍(AGENTS §4/守门 118)。
import { Undetermined, catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']
const END_DIRS = ['web', 'extension', 'miniapp-taro', 'mobile-rn', 'cli']

/** 四个必需输入:取不到就是"没判",不得退化成"没有违规"。 */
const TOOL_DISPLAY_REL = 'packages/shared/src/chat/tool-display.ts'
const MCP_ACTIVITY_REL = 'packages/shared/src/chat/mcp-tool-activity.ts'
const TARO_GEN_SCRIPT_REL = 'apps/miniapp-taro/scripts/gen-i18n-compressed.mjs'
const TARO_BUNDLE_REL = 'apps/miniapp-taro/src/i18n/generated/remote-locales.gen.ts'
const REQUIRED_RELS = [TOOL_DISPLAY_REL, MCP_ACTIVITY_REL, TARO_GEN_SCRIPT_REL, TARO_BUNDLE_REL]

/** 语言包候选:shared × 5 + 各端 × 5(端清单与守门 74 同口径,api 不产界面文案故不在列) */
export function messageRels(langs = LANGS, ends = END_DIRS) {
  const out = []
  for (const lang of langs) out.push(`packages/i18n/messages/shared/${lang}.json`)
  for (const lang of langs)
    for (const dir of ends) out.push(`packages/i18n/messages/${dir}/${lang}.json`)
  return out
}

/** 本门的全部判定输入(同一面、同一轮一次读完) */
export function inputRels() {
  return [...REQUIRED_RELS, ...messageRels()]
}

/**
 * 纯函数:argv → 判定面(默认 **head**)。导出是为了"默认不再是磁盘"这一格能被构造面证明,
 * 而不是等人跑一次真仓看结论行 —— 结论行会被人改,函数不会。
 */
export function faceFromArgv(argv) {
  return selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
}

const FACE_SEL = faceFromArgv(process.argv.slice(2))
const FACE_TXT = {
  head: 'HEAD blob(全量审计)',
  staged: '索引 blob(本次提交会带走的那一份)',
  worktree: '工作树(人工逃生舱,提交链不走这档)',
}

/**
 * 按判定面读**全部**候选输入,一次 `cat-file --batch` 同面同轮读完。
 * 返回 `Map<rel, text|null>`(null = 该面上没有这个路径),必需项取不到即抛 `Undetermined`,
 * **不回落**到另一个面。root/face 都是入参:镜像测试因此能在临时 git 仓里造"索引≠磁盘"的现场。
 */
export function readFaceInputs(repoRoot, face) {
  const rels = inputRels()
  const map = new Map()
  if (face === 'worktree') {
    for (const rel of rels) map.set(rel, readWorktreeFile(repoRoot, rel))
  } else {
    const prefix = face === 'staged' ? ':' : 'HEAD:'
    const specs = rels.map((rel) => prefix + rel)
    const got = catBatch(repoRoot, specs, { maxBuffer: 1 << 28 })
    for (let i = 0; i < rels.length; i++) map.set(rels[i], got.get(specs[i]) ?? null)
  }
  const lack = REQUIRED_RELS.filter((r) => map.get(r) === null || map.get(r) === undefined)
  if (lack.length)
    throw new Undetermined(
      `${FACE_TXT[face] ?? face} 取不到必需输入 ${lack.join(' , ')} ⇒ 无法判定(不记为通过)`,
    )
  return map
}

/** 与 packages/i18n/src/loader.ts:mergeMessages 同语义(先铺 base,再遍历 override) */
export function mergeMessages(base, override) {
  const result = { ...base }
  for (const key of Object.keys(override ?? {})) {
    const val = override[key]
    const baseVal = result[key]
    if (
      val &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      baseVal &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key] = mergeMessages(baseVal, val)
    } else if (val !== undefined) {
      result[key] = val
    }
  }
  return result
}

/**
 * 判定输入的一个语言包 → 消息对象。
 * 与旧 `readJson(resolve(ROOT, path))` 的 try/catch **同语义**:该面上没有这个路径、或内容不是
 * 合法 JSON ⇒ `{}`(即"这一端没有 override")。两者都按 kind 计数进结论行,绝不静默。
 */
export function parsePack(text) {
  if (text === null || text === undefined) return { pack: {}, why: 'absent' }
  try {
    return { pack: JSON.parse(text), why: null }
  } catch {
    return { pack: {}, why: 'unparsable' }
  }
}

/** 从词表源码里取 工具名 → display key(只认对象字面量内的 `name: 'key'` 行) */
export function extractDisplayKeys(tsText) {
  const start = tsText.indexOf('const TOOL_DISPLAY_KEYS')
  if (start === -1) throw new Error('找不到 TOOL_DISPLAY_KEYS')
  const end = tsText.indexOf('\n}', start)
  const block = tsText.slice(start, end === -1 ? tsText.length : end)
  return [
    ...new Set([...block.matchAll(/^\s*[a-z0-9_]+:\s*'([A-Za-z0-9_]+)'/gm)].map((m) => m[1])),
  ].sort()
}

/**
 * D83:从 MCP 三层措辞表源码里取已登记的 i18n 键(一律 `toolMcp` 前缀)。
 * 该表是**动态 MCP server** 的措辞层,不落在 TOOL_DISPLAY_KEYS 的「码名→功能名」块里,
 * 故单列一条取材:表里出现的每个键都必须与 display key 同样逐语言可解析。
 */
export function extractMcpActivityKeys(tsText) {
  if (!tsText.includes('SERVER_TOOL_ACTIVITY_KEYS'))
    throw new Error('找不到 SERVER_TOOL_ACTIVITY_KEYS(D83 词表结构变更?)')
  return [...new Set([...tsText.matchAll(/'(toolMcp[A-Za-z0-9_]+)'/g)].map((m) => m[1]))].sort()
}

/**
 * miniapp-taro 离线包只装**远程语言**(zh-CN 由 JSON 直接随包发,见生成器 REMOTE_LOCALES),
 * 按 `en: '…'` / `'zh-TW': '…'` 两种形态取载荷。生成器格式变更时宁可报错也不要静默放过。
 */
export function remoteLocaleList(generatorText) {
  const m = /const REMOTE_LOCALES\s*=\s*\[([^\]]*)\]/.exec(generatorText)
  if (!m) return null
  return [...m[1].matchAll(/['"]([\w-]+)['"]/g)].map((x) => x[1])
}

export function decodeTaroBundle(genText, locales) {
  const out = {}
  for (const lang of locales) {
    const m = new RegExp(`['"]?${lang}['"]?\\s*:\\s*'([A-Za-z0-9+/=]+)'`).exec(genText)
    if (!m) {
      out[lang] = null
      continue
    }
    try {
      out[lang] = JSON.parse(gunzipSync(Buffer.from(m[1], 'base64')).toString('utf8'))
    } catch {
      out[lang] = null
    }
  }
  return out
}

/**
 * 纯判据:输入 = 一次同面取材得到的 `Map<rel, text|null>`。
 * 抽成函数是为了"索引≠磁盘 ⇒ 结论不同形"这一格能被构造面证明(镜像测试直接在临时 git 仓里
 * 造两面,不必依赖真仓瞬时状态)。判定内容与本门立项时逐条同形,未增未减。
 */
export function analyzeInputs(inputs) {
  const text = (rel) => inputs.get(rel) ?? null
  const absent = []
  const unparsable = []
  const readJsonAt = (rel) => {
    const t = text(rel)
    if (t === null) {
      absent.push(rel)
      return {}
    }
    const r = parsePack(t)
    if (r.why) unparsable.push(rel)
    return r.pack
  }

  const tsText = text(TOOL_DISPLAY_REL)
  const displayKeys = extractDisplayKeys(tsText)
  if (displayKeys.length === 0) throw new Error('词表解析出 0 个 display key(源码格式变更?)')
  // D83:MCP server×tool×上下文 三层措辞表的键同样必须逐语言可解析(表与词表必须同票)
  const mcpKeys = extractMcpActivityKeys(text(MCP_ACTIVITY_REL))
  if (mcpKeys.length === 0) throw new Error('MCP 措辞表解析出 0 个键(源码格式变更?)')
  const wordListKeys = [...new Set([...displayKeys, ...mcpKeys])].sort()

  const failures = []
  const sharedByLang = {}
  for (const lang of LANGS) {
    sharedByLang[lang] = readJsonAt(`packages/i18n/messages/shared/${lang}.json`)
  }

  const check = (where, bucket, key) => {
    const value = bucket?.[key]
    if (typeof value !== 'string' || value.trim() === '' || value === key) {
      failures.push(`${where} → taskStatus.${key}`)
    }
  }

  for (const lang of LANGS) {
    const sharedTask = sharedByLang[lang]?.taskStatus ?? {}
    // 合并视图只依赖 (端, 语言),与 key 无关 —— 旧版在 key 循环里重复 merge 3,175 次,
    // 提到循环外算一次。**比较的值逐字不变**,只是不再为每个 key 重算同一份合并结果。
    const mergedTask = {}
    for (const dir of END_DIRS) {
      mergedTask[dir] =
        mergeMessages(sharedByLang[lang], readJsonAt(`packages/i18n/messages/${dir}/${lang}.json`))
          .taskStatus ?? {}
    }
    for (const key of wordListKeys) {
      check(`shared/${lang}`, sharedTask, key)
      for (const dir of END_DIRS) check(`${dir}/${lang}`, mergedTask[dir], key)
    }
  }

  // 生成物:小程序离线包必须与词表同步(忘跑 pnpm gen:i18n 即红)。
  // 注意:生成器取的是 **REMOTE_LOCALES 源码文本**(不是 JSON),与旧版逐字同形。
  const remote = remoteLocaleList(text(TARO_GEN_SCRIPT_REL)) ?? LANGS
  const bundle = decodeTaroBundle(text(TARO_BUNDLE_REL) ?? '', remote)
  for (const lang of remote) {
    if (!bundle[lang]) {
      failures.push(`${TARO_BUNDLE_REL} 解不出 ${lang} 载荷(生成物过期或格式变更,需 pnpm gen:i18n)`)
      continue
    }
    // 离线包只要求覆盖**已被该端消费的** display key;D83 的 MCP 三层表目前无人消费
    // (apps 接线属后续票),故此处刻意不掺入 mcpKeys —— 掺了就是把"尚未接线的表"当成
    // 本票的落点债,而落点债由守门 74 的 W5 notice 如实报数,不该由这道门硬拦。
    for (const key of displayKeys) check(`taro-gen/${lang}`, bundle[lang].taskStatus ?? {}, key)
  }

  const k = displayKeys.length
  return {
    displayKeys: k,
    mcpActivityKeys: mcpKeys.length,
    // shared 1 份 + 各端合并视图(两张表都核) + 小程序离线包(仅远程语言、仅已消费的 display key)
    checked: wordListKeys.length * LANGS.length * (1 + END_DIRS.length) + k * remote.length,
    failures,
    absentInputs: [...new Set(absent)],
    unparsableInputs: [...new Set(unparsable)],
  }
}

async function main() {
  const json = process.argv.includes('--json')
  if (FACE_SEL.error) {
    console.error(`[tool-display-resolvable] ❌ 无法判定:${FACE_SEL.error}`)
    return 2
  }
  const face = FACE_SEL.face
  let inputs
  try {
    inputs = readFaceInputs(ROOT, face)
  } catch (e) {
    // 「无法判定」是预期结论,一句话足够;**其他异常**必须带栈落地 —— 匿名 exit 2 = 不可诊断。
    const known = e instanceof Undetermined
    console.error(
      `[tool-display-resolvable] 取不到输入(${FACE_TXT[face]})⇒ 无法判定(不记为通过):${
        known ? e.message : (e?.stack ?? e)
      }`,
    )
    return 2
  }
  const result = analyzeInputs(inputs)
  const faceTag = `取材面:${FACE_TXT[face]}`
  const gapTag =
    (result.absentInputs.length ? ` · 缺包 ${result.absentInputs.length} 个` : '') +
    (result.unparsableInputs.length ? ` · 非法 JSON ${result.unparsableInputs.length} 个` : '')
  const { failures } = result
  if (json) {
    console.log(JSON.stringify({ face, faceLabel: FACE_TXT[face], ...result }))
    return failures.length ? 1 : 0
  }
  if (failures.length === 0) {
    console.log(
      `[tool-display-resolvable] ✅ ${result.displayKeys} 个工具功能名 + ${result.mcpActivityKeys} 个 MCP 措辞键(D83 三层表)在 ${LANGS.length} 语言 ×(shared + ${END_DIRS.length} 端 + taro 生成物)全部取到值,共比对 ${result.checked} 项(${faceTag}${gapTag})`,
    )
    return 0
  }
  console.error(`[tool-display-resolvable] ❌ ${failures.length} 处取不到值(会回显键名或掉回中文)`)
  for (const line of failures.slice(0, 25)) console.error(`  - ${line}`)
  if (failures.length > 25) console.error(`  …另 ${failures.length - 25} 处`)
  console.error(
    '  修法:补 packages/i18n/messages/shared/<lang>.json 的 taskStatus 键(5 语言齐全),' +
      '改完必须跑 cd apps/miniapp-taro && pnpm gen:i18n 重生成离线语言包。',
  )
  // 结论行必须落在**末行**:镜像测试按末行断言"这句话是关于哪个取材面的"(守门 36 同型)。
  console.error(
    `[tool-display-resolvable] Found ${failures.length} 处取不到值(${faceTag}${gapTag})`,
  )
  return 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => {
      if (typeof code === 'number' && code !== 0) process.exit(code)
    })
    .catch((error) => {
      // 判据自身抛出的"格式变更"类断言(词表 0 键 / MCP 锚点丢失)也走这一支:
      // 那是"没能判定",不是"判定为违规" ⇒ exit 2,与取材失败同档,不得冒成判据红。
      console.error(`❌ ${error?.message ?? error}`)
      process.exit(2)
    })
}

/** §22c:测试直接 import 这些出口,不得在测试里复制第二份实现。 */
export const __test__ = {
  FACE_TXT,
  LANGS,
  END_DIRS,
  REQUIRED_RELS,
  TOOL_DISPLAY_REL,
  MCP_ACTIVITY_REL,
  TARO_GEN_SCRIPT_REL,
  TARO_BUNDLE_REL,
  faceFromArgv,
  inputRels,
  messageRels,
  readFaceInputs,
  parsePack,
  analyzeInputs,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
