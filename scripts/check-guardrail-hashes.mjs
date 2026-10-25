#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-guardrail-hashes.mjs —— 不可变护栏的只读 hash 校验(2026-10-25 立,R3)。
 *
 * ## 这道门拦什么
 *
 * 规则自身也要上锁。本仓的 `AGENTS.md §0 全局铁律`、`scripts/lib/judgement-libs.json`(判据库注册表)、
 * `scripts/guardian-runner.mjs`(守门注册表)一旦被顺手改写,「先读后写 / 同一件事只有一份判据 /
 * 恒红门禁令」这些约束就会在无人察觉时失效 —— 而它们本身不在任何门里。
 * 本器把这三枚的**规则段**算成 sha256 存进 `scripts/data/guardrail-hashes.json`,
 * 任何改动都必须人工带 `GUARDRAIL_UNLOCK=<token>=<原因>` 重跑 `--baseline` 才准推进,
 * 否则提交链 fail-closed。
 *
 * ## 段,不是整文件
 *
 * `AGENTS.md` 每天都有追加,整文件 hash 会恒红(§12e 恒红门即逼人 --no-verify)。
 * 故条目分两种 scope:
 *   - `section` —— 由一对**逐行标记**界定(`startMarker` 含、`endMarker` 不含);
 *     标记找不到 ⇒ `missing`(段标记漂了),**绝不静默退化成整文件或跳过**;
 *   - `whole`   —— 整个文件就是规则本身(如判据库 JSON 列表)。
 * 标记之间的增删才算改动;段外追加不触发。
 *
 * ## 取材面(守门 118 / §0.4)
 *
 *   --verify(默认)判 **HEAD blob**;`--staged` 判**索引 blob**(pre-commit 面);
 *   `--worktree` 仅人工逃生舱(自检也走它,避免夹具仓库依赖 git)。
 *   清单与正文**同面同轮**取:清单也从同一面读,否则"改暂存清单 + 保留 HEAD 清单"就能绕过。
 *   两面旗同给 ⇒ exit 2;取不到面 ⇒ exit 2 未判定,不回落另一面、不记绿。
 *
 * ## 三档退出码
 *
 *   0 = 每条 pass;
 *   1 = 任一 mismatch / missing(段标记不存在 / 文件在该面不存在);
 *   2 = 未判定(清单缺失或坏、面取不到、git 读失败)+ **无解锁跑 `--baseline`**。
 *
 * ## 解锁口(照 `LAND_SHA_ALLOW` / `LIVE_SHA_ALLOW` 的形状)
 *
 *   `GUARDRAIL_UNLOCK=<token>=<原因>[;<token2>=<原因2>…]` —— 无 `=`、token 空、原因为空
 *   一律不收录(无原因不放行);每次放行打印留痕。`--baseline` 未带有效解锁 ⇒ rc=2 并打印
 *   「须人工显式解锁」。`--baseline` 读**工作树**(人改完盘上那份再立新基线)。
 *
 * ## 自检
 *
 *   node scripts/check-guardrail-hashes.mjs --self-test
 *   覆盖:① 清单齐全 ⇒ pass ② 篡改一字节 ⇒ mismatch rc=1 ③ 无解锁跑 --baseline ⇒ rc=2
 *   ④ 段结束标记不存在 ⇒ missing rc=1。
 *
 * 应急跳过(注册条体现值以 scripts/guardian-runner.mjs 为准):HUSKY_SKIP_GUARDRAIL_HASHES=1
 */

import { createHash } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const SELF = fileURLToPath(import.meta.url)
const HERE = dirname(SELF)
const DEFAULT_ROOT = resolve(HERE, '..')
const ROOT = process.env.GUARDRAIL_ROOT ? resolve(process.env.GUARDRAIL_ROOT) : DEFAULT_ROOT
const MANIFEST_REL = 'scripts/data/guardrail-hashes.json'

/**
 * 受保护清单的**唯一真相源**:路径 + 段标记。hash 落在 MANIFEST_REL。
 * 新增护栏改这里(它会改变 guardian-runner 注册表段的 hash ⇒ 必须带解锁重立基线)。
 */
export const GUARDRAIL_ENTRIES = [
  {
    id: 'guardian-checks',
    path: 'scripts/guardian-runner.mjs',
    scope: 'section',
    startMarker:
      '// === 检查配置(按 mode 分组;项数与分级见 `--help`,勿在此写死数字——写死必然过期) ===',
    endMarker: '// === push 门检查集(2026-08-31 新增) ===',
    note: 'pre-commit 守门注册表(checks 段)',
  },
  {
    id: 'guardian-pushgate',
    path: 'scripts/guardian-runner.mjs',
    scope: 'section',
    startMarker: '// === push 门检查集(2026-08-31 新增) ===',
    endMarker: '// === CLI 解析 ===',
    note: 'push 门注册表(pushGateChecks 段)',
  },
  {
    id: 'agents-iron-laws',
    path: 'AGENTS.md',
    scope: 'section',
    startMarker: '## 0. 全局铁律(先读,跨节通用)',
    endMarker: '## 1. 任务计划文档规则(强制)',
    note: '§0 全局铁律段(段外追加不受影响)',
  },
  {
    id: 'judgement-libs',
    path: 'scripts/lib/judgement-libs.json',
    scope: 'whole',
    note: '判据库注册表整文件',
  },
]

/** 按行切分并丢掉末尾单个空行:行尾 LF/CRLF 与文件是否以换行结尾不改变语义 hash。 */
export function linesOf(text) {
  const lines = String(text).split(/\r?\n/)
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

/** 取条目对应的段文本。段标记缺失 ⇒ `{ ok: false, reason }`,绝不放宽成整文件。 */
export function segmentOf(text, entry) {
  const lines = linesOf(text)
  if (entry.scope === 'whole') return { ok: true, lines }
  const start = lines.findIndex((l) => l.trim() === String(entry.startMarker).trim())
  if (start < 0) return { ok: false, reason: `段起始标记不存在:${entry.startMarker}` }
  const end = lines.findIndex(
    (l, i) => i > start && l.trim() === String(entry.endMarker).trim(),
  )
  if (end < 0) return { ok: false, reason: `段结束标记不存在:${entry.endMarker}` }
  return { ok: true, lines: lines.slice(start, end) }
}

export function sha256OfLines(lines) {
  return createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex')
}

/** `GUARDRAIL_UNLOCK=<token>=<原因>[;…]` ⇒ Map(token → 原因)。无原因一律不收录。 */
export function parseUnlock(raw) {
  const out = new Map()
  for (const part of String(raw ?? '').split(/[;\n]+/)) {
    const s = part.trim()
    if (s === '') continue
    const eq = s.indexOf('=')
    if (eq <= 0) continue
    const token = s.slice(0, eq).trim()
    const reason = s.slice(eq + 1).trim()
    if (token === '' || reason === '') continue
    out.set(token, reason)
  }
  return out
}

/**
 * 按面读单个文件。
 * @returns {{ok:true,text:string}|{ok:false,missing:boolean,reason:string}}
 */
export function readFaceText(face, rel, root = ROOT) {
  if (face === 'worktree') {
    const text = readWorktreeFile(root, rel)
    if (text === null) return { ok: false, missing: true, reason: `工作树无此文件:${rel}` }
    return { ok: true, text }
  }
  const spec = face === 'staged' ? `:${rel}` : `HEAD:${rel}`
  try {
    return { ok: true, text: gitRaw(['show', spec], root) }
  } catch (e) {
    const msg = String(e?.stderr ?? e?.message ?? e).trim()
    const gone = /does not exist|exists on disk, but not in|path .* (?:does not|not in)/i.test(msg)
    return { ok: false, missing: gone, reason: `${face} 面取不到 ${rel}:${msg}` }
  }
}

function readManifest(face) {
  const r = readFaceText(face, MANIFEST_REL)
  if (!r.ok) return { error: r.reason, missing: r.missing }
  try {
    const parsed = JSON.parse(r.text)
    if (!parsed || !Array.isArray(parsed.entries)) return { error: `${MANIFEST_REL} 缺 entries 数组` }
    return { manifest: parsed }
  } catch (e) {
    return { error: `${MANIFEST_REL} 不是合法 JSON:${e.message}` }
  }
}

/** 单条判定:pass / mismatch / missing / undetermined。 */
export function judgeEntry(entry, face) {
  const file = readFaceText(face, entry.path)
  if (!file.ok) {
    if (file.missing) return { status: 'missing', detail: file.reason }
    return { status: 'undetermined', detail: file.reason }
  }
  const seg = segmentOf(file.text, entry)
  if (!seg.ok) return { status: 'missing', detail: seg.reason }
  const actual = sha256OfLines(seg.lines)
  if (actual === String(entry.sha256 ?? '').toLowerCase()) {
    return { status: 'pass', detail: `${seg.lines.length} 行`, actual }
  }
  return {
    status: 'mismatch',
    detail: `期望 ${entry.sha256 ?? '(空)'} / 现算 ${actual}(${seg.lines.length} 行)`,
    actual,
  }
}

/** @returns {number} 退出码 */
export function verify({ face, argv = [] }) {
  const sel = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (sel.error) {
    console.log(`⚪ 未判定:${sel.error}`)
    return 2
  }
  const useFace = sel.face
  const loaded = readManifest(useFace)
  if (loaded.error) {
    console.log(`⚪ 未判定:${loaded.error}`)
    console.log(`   清单不存在时先带解锁重立基线:GUARDRAIL_UNLOCK=<token>=<原因> node scripts/check-guardrail-hashes.mjs --baseline`)
    return 2
  }
  const entries = loaded.manifest.entries
  if (entries.length === 0) {
    console.log(`⚪ 未判定:${MANIFEST_REL} 的 entries 为空(空清单不等于全绿)`)
    return 2
  }
  const counts = { pass: 0, mismatch: 0, missing: 0, undetermined: 0 }
  for (const entry of entries) {
    const r = judgeEntry(entry, useFace)
    counts[r.status] += 1
    const icon = r.status === 'pass' ? '✅' : r.status === 'undetermined' ? '⚪' : '❌'
    console.log(`${icon} ${r.status.padEnd(12)} ${entry.id} ${entry.path}  ${r.detail}`)
  }
  console.log(
    `—— ${useFace} 面 ${entries.length} 条:pass ${counts.pass} / mismatch ${counts.mismatch} / missing ${counts.missing} / undetermined ${counts.undetermined}`,
  )
  if (counts.undetermined > 0) return 2
  if (counts.mismatch > 0 || counts.missing > 0) {
    console.log('   守卫被改动或段标记漂移 ⇒ fail-closed 拒绝推进')
    console.log('   确认属人工授权改动后:GUARDRAIL_UNLOCK=<token>=<原因> node scripts/check-guardrail-hashes.mjs --baseline,并提交清单')
    return 1
  }
  return 0
}

/** @returns {number} 退出码 */
export function baseline({ env = process.env } = {}) {
  const unlock = parseUnlock(env.GUARDRAIL_UNLOCK)
  if (unlock.size === 0) {
    console.log('❌ 拒绝对护栏重立基线:须人工显式解锁')
    console.log('   格式:GUARDRAIL_UNLOCK=<token>=<原因>[;<token2>=<原因2>…](token 为空或原因缺省不收录)')
    console.log('   示例:GUARDRAIL_UNLOCK=*="机主批准 2026-10-25 调整 §0 铁律措辞"')
    return 2
  }
  for (const [token, reason] of unlock) {
    console.log(`ℹ 人工解锁留痕(GUARDRAIL_UNLOCK):${token} ⇒ 原因:${reason}`)
  }
  const old = readManifest('worktree')
  const oldById = new Map(
    old.manifest ? old.manifest.entries.map((e) => [e.id, e]) : [],
  )
  const entries = []
  const problems = []
  let changed = 0
  for (const spec of GUARDRAIL_ENTRIES) {
    const file = readFaceText('worktree', spec.path)
    if (!file.ok) {
      problems.push(`${spec.id}:${file.reason}`)
      continue
    }
    const seg = segmentOf(file.text, spec)
    if (!seg.ok) {
      problems.push(`${spec.id}:${seg.reason}`)
      continue
    }
    const sha256 = sha256OfLines(seg.lines)
    const before = oldById.get(spec.id)?.sha256 ?? '(无)'
    if (before !== sha256) {
      changed += 1
      console.log(`ℹ 基线变更 ${spec.id}:${before} ⇒ ${sha256}`)
    }
    const entry = { ...spec, sha256, lines: seg.lines.length }
    entries.push(entry)
  }
  if (problems.length > 0) {
    console.log('❌ 拒绝写清单:下列条目在工作树取不到段(段标记漂移或文件缺失),不得把缺失写成基线')
    for (const p of problems) console.log(`   · ${p}`)
    return 1
  }
  const manifest = {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/check-guardrail-hashes.mjs --baseline',
    unlock: [...unlock].map(([token, reason]) => ({ token, reason })),
    entries,
  }
  const abs = join(ROOT, MANIFEST_REL)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log(`—— 基线已写入 ${MANIFEST_REL}:${entries.length} 条(本轮变更 ${changed} 条)`)
  return 0
}

/** `--list`:只打印清单现状,不碰被保护文件。 */
export function list() {
  const loaded = readManifest('worktree')
  if (loaded.error) {
    console.log(`⚪ 无法列出清单:${loaded.error}`)
    return 2
  }
  for (const entry of loaded.manifest.entries) {
    console.log(
      `${entry.id}  ${entry.path}  scope=${entry.scope}  lines=${entry.lines ?? '?'}  sha256=${entry.sha256}`,
    )
    if (entry.startMarker) {
      console.log(`   段:[${entry.startMarker}] → [${entry.endMarker}](end 不含)`)
    }
  }
  console.log(`—— 清单 ${MANIFEST_REL}:${loaded.manifest.entries.length} 条`)
  return 0
}

const FIXTURE_REL = join('.ihui-agent', 'tmp', 'guardrail-hashes-selftest')

/** `--self-test`:夹具仓库里跑四例(不碰真清单,也不需要夹具是 git 仓库)。 */
export function selfTest() {
  const fixture = join(DEFAULT_ROOT, FIXTURE_REL)
  rmSync(fixture, { recursive: true, force: true })
  mkdirSync(join(fixture, 'scripts', 'lib'), { recursive: true })
  mkdirSync(join(fixture, 'scripts', 'data'), { recursive: true })

  const guardian = [
    '#!/usr/bin/env node',
    GUARDRAIL_ENTRIES[0].startMarker,
    'const checks = []',
    GUARDRAIL_ENTRIES[0].endMarker,
    'const pushGateChecks = []',
    GUARDRAIL_ENTRIES[1].endMarker,
    'const cli = 1',
    '',
  ].join('\n')
  const agents = [
    '# AGENTS',
    GUARDRAIL_ENTRIES[2].startMarker,
    'rule one',
    GUARDRAIL_ENTRIES[2].endMarker,
    'rest',
    '',
  ].join('\n')
  writeFileSync(join(fixture, 'scripts', 'guardian-runner.mjs'), guardian, 'utf8')
  writeFileSync(join(fixture, 'AGENTS.md'), agents, 'utf8')
  writeFileSync(join(fixture, 'scripts', 'lib', 'judgement-libs.json'), '["a","b"]\n', 'utf8')

  const run = (args, unlock) => {
    const env = { ...process.env, GUARDRAIL_ROOT: fixture }
    delete env.GUARDRAIL_UNLOCK
    if (unlock !== undefined) env.GUARDRAIL_UNLOCK = unlock
    const r = spawnSync(process.execPath, [SELF, ...args], { env, encoding: 'utf8', windowsHide: true })
    return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
  }

  const cases = []
  const add = (name, ok, detail) => cases.push({ name, ok, detail })

  const t0 = run(['--baseline', '--worktree'], '*=自检夹具建基线')
  add('①a 解锁基线可写', t0.status === 0, `rc=${t0.status}`)

  const t1 = run(['--verify', '--worktree'])
  add(
    '① 清单齐全 ⇒ 全 pass',
    t1.status === 0 && t1.out.includes('mismatch 0') && t1.out.includes('missing 0'),
    `rc=${t1.status}`,
  )

  const decl = join(fixture, 'scripts', 'lib', 'judgement-libs.json')
  const origDecl = '["a","b"]\n'
  writeFileSync(decl, '["a","bx"]\n', 'utf8')
  const t2 = run(['--verify', '--worktree'])
  add(
    '② 篡改一字节 ⇒ mismatch rc=1',
    t2.status === 1 && t2.out.includes('mismatch'),
    `rc=${t2.status}`,
  )
  writeFileSync(decl, origDecl, 'utf8')

  const t3 = run(['--baseline', '--worktree'])
  add(
    '③ 无解锁跑 --baseline ⇒ rc=2',
    t3.status === 2 && t3.out.includes('须人工显式解锁'),
    `rc=${t3.status}`,
  )

  const guardianPath = join(fixture, 'scripts', 'guardian-runner.mjs')
  writeFileSync(guardianPath, guardian.replace(`${GUARDRAIL_ENTRIES[1].endMarker}\n`, ''), 'utf8')
  const t4 = run(['--verify', '--worktree'])
  add(
    '④ 段标记漂 ⇒ missing(不静默过)',
    // 断言"该条必须被报成 missing",不能断言"输出里没有 ✅" —— 另外三条本该 pass,天然会打 ✅。
    t4.status === 1 && t4.out.includes('missing 1') && t4.out.includes('guardian-pushgate'),
    `rc=${t4.status}`,
  )
  writeFileSync(guardianPath, guardian, 'utf8')

  rmSync(fixture, { recursive: true, force: true })

  for (const c of cases) console.log(`${c.ok ? '✅' : '❌'} ${c.name}  ${c.detail}`)
  const failed = cases.filter((c) => !c.ok).length
  console.log(`—— 自检 ${cases.length - failed}/${cases.length} 通过`)
  return failed === 0 ? 0 : 1
}

async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--self-test')) return selfTest()
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`用法:
  node scripts/check-guardrail-hashes.mjs [--verify] [--staged|--worktree]
  node scripts/check-guardrail-hashes.mjs --baseline   # 须 GUARDRAIL_UNLOCK=<token>=<原因>
  node scripts/check-guardrail-hashes.mjs --list
  node scripts/check-guardrail-hashes.mjs --self-test`)
    return 0
  }
  if (argv.includes('--baseline')) return baseline()
  if (argv.includes('--list')) return list()
  return verify({ face: 'head', argv })
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}${e instanceof Undetermined ? '' : `\n${e?.stack ?? ''}`}`)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
