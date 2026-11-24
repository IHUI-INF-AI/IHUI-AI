#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门(本文件自述):`ApiKeyPermission` 的**三面对账** —— 类型联合 ↔ web 两处标签表 ↔ 五语言 `apiKeyPerms.*`。
//
// 立因(2026-10-16 实测):远端一枚提交给 `packages/types/src/api-key.ts` 的 `API_KEY_PERMISSIONS` 加了
// 第 63 个成员 `voice:stt`,但没同批改 `apps/web/app/(main)/admin/developer/DeveloperKeyDialog.tsx` 的
// `PERMISSION_LABELS` / `apps/web/app/(main)/settings/api-keys/PermissionSelector.tsx` 的 `PERM_LABELS`
// (两处都是 `Record<ApiKeyPermission, string>` ⇒ 少键即 TS2741),也没补五语言 `apiKeyPerms.voiceStt`。
// 后果不是"本地报错":那枚提交走的是旁路落地(不跑钩子),红点在 **CI 的 web 生产构建**才现形,
// 于是 `e2e.yml` 每次 push 全红,连带挡掉所有会话的交付门槛(§20)。typecheck 门本身能抓到,
// 但它跑在被审面上 ⇒ 输入分在别的会话手里时,谁都不该替别人红;所以这里做一条**便宜、按输入面触发**的专用判据。
//
// 判据(两条,都不许为变绿去放宽):
//   P1 键集等值:标签表的键集必须与 union **逐字相等**(缺 ⇒ TS2741 的成因;多 ⇒ 编译期"多余属性"同样红,
//      也是 union 缩小时没人摘的残渣)。两处表各自判,一处漏不许被另一处顶掉。
//   P2 取词可达:表里每个值都是 `apiKeyPerms.<leaf>` 形态的 i18n 键名,该键必须在**五语言包逐端都存在**
//      (§19「新增状态词必须同批补齐五语言」);引用别的命名空间一律判红(那是把"表值必须是 i18n 键"这条契约改掉)。
//   取不到任一被审文件 / union 枚举为 0 ⇒ exit 2「未判定」,不记绿也不冒红(§0.3)。
//
// 取材面纪律(§0.4 / 守门 118):全量档判 HEAD blob,`--staged` 判索引 blob,两面同给 ⇒ exit 2;
//   `--worktree` 仅人工逃生舱。清单与内容同面同轮,取不到不回落另一个面。
//
// 用法:
//   node scripts/check-api-key-permission-labels.mjs            # 判 HEAD 面
//   node scripts/check-api-key-permission-labels.mjs --staged   # 判索引面
//   node scripts/check-api-key-permission-labels.mjs --self-test
//
// 定级与触发:见 `scripts/guardian-runner.mjs` 注册条目现值(按输入面 `stagedTriggers` 收窄,
//   不给无关提交制造恒红 —— §12e)。跳过变量同样以注册条目现值为准。

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { gitRaw, readWorktreeFile } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const UNION_FILE = 'packages/types/src/api-key.ts'
const LABEL_MAPS = [
  'apps/web/app/(main)/admin/developer/DeveloperKeyDialog.tsx',
  'apps/web/app/(main)/settings/api-keys/PermissionSelector.tsx',
]
const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']
const MSG_DIR = 'packages/i18n/messages/web'
const NS = 'apiKeyPerms'

/** union 成员清单(只认 `API_KEY_PERMISSIONS = [...]` 这一块,先剥注释再取字面量) */
export function unionOf(src) {
  const m = String(src).match(/API_KEY_PERMISSIONS[^=]*=\s*\[([\s\S]*?)\n\]/)
  if (!m) return null
  const body = m[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  return [...body.matchAll(/'([^']+)'/g)].map((x) => x[1])
}

/** 标签表的 `权限 → i18n 键名` 映射(同样先剥注释,免得注释里的示例被当消费点) */
export function labelMapOf(src) {
  const body = String(src).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const out = new Map()
  for (const m of body.matchAll(/'([a-z]+:[a-z-]+)'\s*:\s*['"]([A-Za-z0-9_.]+)['"]/g)) {
    if (!m[2].startsWith(`${NS}.`)) {
      out.set(m[1], { bad: m[2] })
      continue
    }
    out.set(m[1], { key: m[2] })
  }
  return out
}

/** `apiKeyPerms.*` 在五语言包里的键集 */
export function localeKeys(parsedJson) {
  return new Set(Object.keys(parsedJson?.[NS] ?? {}))
}

/**
 * 两维裁定。`faces` = { union, maps: {file: text}, messages: {locale: text} }
 * 返回 { undetermined:[…], violations:[…] }
 */
export function judge({ unionSrc, mapSrcs, messageTexts }) {
  const undetermined = []
  const violations = []
  const perms = unionOf(unionSrc ?? '')
  if (!perms || perms.length === 0) {
    return { undetermined: [`union 取不到或枚举为 0(${UNION_FILE})`], violations }
  }
  const permSet = new Set(perms)

  for (const [file, src] of Object.entries(mapSrcs)) {
    if (src === undefined || src === null) {
      undetermined.push(`标签表取不到:${file}`)
      continue
    }
    const map = labelMapOf(src)
    const missing = perms.filter((p) => !map.has(p))
    const extra = [...map.keys()].filter((k) => !permSet.has(k))
    if (missing.length > 0) violations.push(`P1 缺键:${file} 的标签表少 ${missing.length} 枚 → ${missing.join(', ')}(少一枚就是 web 生产构建 TS2741)`)
    if (extra.length > 0) violations.push(`P1 多键:${file} 的标签表多出 ${extra.length} 枚 → ${extra.join(', ')}(union 里没有它们 ⇒ 多余属性同样编译不过)`)
    for (const [perm, v] of map) {
      if (v.bad) violations.push(`P2 命名空间:${file} 里 ${perm} 的值 "${v.bad}" 不是 ${NS}.* 的 i18n 键名`)
    }
  }

  for (const [locale, raw] of Object.entries(messageTexts)) {
    if (raw === undefined || raw === null) {
      undetermined.push(`语言包取不到:${MSG_DIR}/${locale}.json`)
      continue
    }
    let json
    try {
      json = JSON.parse(raw)
    } catch (e) {
      undetermined.push(`${locale}.json 解析失败:${e.message}`)
      continue
    }
    const keys = localeKeys(json)
    const miss = []
    for (const file of Object.keys(mapSrcs)) {
      const map = labelMapOf(mapSrcs[file] ?? '')
      for (const { key } of map.values()) {
        if (key && !keys.has(key.slice(NS.length + 1))) miss.push(`${file.split('/').pop()} → ${key}`)
      }
    }
    const uniq = [...new Set(miss)]
    if (uniq.length > 0) violations.push(`P2 取词不可达:${locale} 的 ${NS} 里缺 ${uniq.length} 枚 → ${uniq.slice(0, 6).join(', ')}${uniq.length > 6 ? ` …另 ${uniq.length - 6} 枚` : ''}`)
  }

  return { undetermined, violations }
}

function readFace(root, mode, rels) {
  const out = {}
  for (const rel of rels) {
    try {
      out[rel] = mode === 'worktree' ? readWorktreeFile(root, rel) : gitRaw(['show', `${mode === 'staged' ? ':' : 'HEAD:'}${rel}`], root)
    } catch {
      out[rel] = null
    }
  }
  return out
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--staged') && argv.includes('--worktree')) {
    console.log('❌ 未判定:--staged 与 --worktree 不得同用(两个判定面互斥)')
    return 2
  }
  if (argv.includes('--self-test')) return selfTest()
  const mode = argv.includes('--worktree') ? 'worktree' : argv.includes('--staged') ? 'staged' : 'head'

  const rels = [UNION_FILE, ...LABEL_MAPS, ...LOCALES.map((l) => `${MSG_DIR}/${l}.json`)]
  const got = readFace(ROOT, mode, rels)
  const r = judge({
    unionSrc: got[UNION_FILE],
    mapSrcs: Object.fromEntries(LABEL_MAPS.map((f) => [f, got[f]])),
    messageTexts: Object.fromEntries(LOCALES.map((l) => [l, got[`${MSG_DIR}/${l}.json`]])),
  })

  console.log(`📊 ApiKeyPermission 三面对账 · 面=${mode} · union ${unionOf(got[UNION_FILE] ?? '')?.length ?? 0} 枚 · 标签表 ${LABEL_MAPS.length} 份 · 语言包 ${LOCALES.length} 端`)
  if (r.undetermined.length > 0) {
    console.log(`❌ 未判定(${r.undetermined.length} 处取材失败,不记绿也不冒红):`)
    for (const u of r.undetermined) console.log(`   · ${u}`)
    return 2
  }
  if (r.violations.length > 0) {
    console.log(`❌ 发现 ${r.violations.length} 处不齐:`)
    for (const v of r.violations) console.log(`   ${v}`)
    console.log(`  出路:同一笔提交把两处标签表与五语言 ${NS}.* 一起补齐(§19);**不得**为变绿把表改成 Partial、加 ! 断言或改判据。`)
    return 1
  }
  console.log(`✅ 联合 / 两处标签表 / 五语言取词逐枚对齐(共 ${LOCALES.length} 端 × ${unionOf(got[UNION_FILE]).length} 枚)` )
  return 0
}

function selfTest() {
  const cases = []
  const eq = (name, got, want) => cases.push([name, JSON.stringify(got) === JSON.stringify(want), got, want])

  const UNION = "export const API_KEY_PERMISSIONS = [\n  'audio:write',\n  'voice:stt',\n]\n"
  const MAP = "const X: Record<ApiKeyPermission, string> = {\n  'audio:write': 'apiKeyPerms.audioWrite',\n  'voice:stt': 'apiKeyPerms.voiceStt',\n}\n"
  const MSG = { 'zh-CN': '{"apiKeyPerms":{"audioWrite":"a","voiceStt":"b"}}', en: '{"apiKeyPerms":{"audioWrite":"a","voiceStt":"b"}}', ja: '{"apiKeyPerms":{"audioWrite":"a","voiceStt":"b"}}', ko: '{"apiKeyPerms":{"audioWrite":"a","voiceStt":"b"}}', 'zh-TW': '{"apiKeyPerms":{"audioWrite":"a","voiceStt":"b"}}' }
  const base = { unionSrc: UNION, mapSrcs: { 'a.tsx': MAP }, messageTexts: MSG }

  eq('正控:齐 ⇒ 零违规', judge(base), { undetermined: [], violations: [] })
  eq('反例:表缺 voice:stt ⇒ 报 P1 缺键', judge({ ...base, mapSrcs: { 'a.tsx': MAP.replace("  'voice:stt': 'apiKeyPerms.voiceStt',\n", '') } }).violations[0].startsWith('P1 缺键'), true)
  eq('反例:表多一枚 union 里没有的 ⇒ 报 P1 多键', judge({ ...base, mapSrcs: { 'a.tsx': MAP.replace("  'audio:write'", "  'ghost:one': 'apiKeyPerms.ghostOne',\n  'audio:write'") } }).violations.some((v) => v.startsWith('P1 多键')), true)
  eq('反例:一端缺取词键 ⇒ 报 P2 且点到该端', judge({ ...base, messageTexts: { ...MSG, ja: '{"apiKeyPerms":{"audioWrite":"a"}}' } }).violations.some((v) => v.startsWith('P2 取词不可达:ja')), true)
  eq('反例:表值不是 apiKeyPerms.* ⇒ 报 P2 命名空间', judge({ ...base, mapSrcs: { 'a.tsx': MAP.replace("'apiKeyPerms.voiceStt'", "'otherNs.voiceStt'") } }).violations.some((v) => v.startsWith('P2 命名空间')), true)
  eq('未判定:union 取不到 ⇒ 不记绿也不冒红', judge({ ...base, unionSrc: 'export const X = 1' }).undetermined.length, 1)
  eq('未判定:表取不到 ⇒ 点名文件', judge({ ...base, mapSrcs: { 'a.tsx': null } }).undetermined.some((u) => u.includes('a.tsx')), true)
  eq('注释里的示例不得被当消费点', labelMapOf("// 'ghost:one': 'apiKeyPerms.ghostOne'\n" + MAP).has('ghost:one'), false)

  let fail = 0
  for (const [name, ok, got, want] of cases) {
    if (ok) console.log(`  ✔ ${name}`)
    else { fail++; console.log(`  ✗ ${name}\n     got :${JSON.stringify(got)}\n     want:${JSON.stringify(want)}`) }
  }
  console.log(`自检:${cases.length - fail} 通过 / ${fail} 失败`)
  return fail === 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().then((rc) => process.exit(rc)).catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = { unionOf, labelMapOf, localeKeys, judge, UNION_FILE, LABEL_MAPS, LOCALES, NS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
