// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * DB 行面「窄 CAS 修复模板」采纳闸(未装车;装车由主会话统一做 —— 头注刻意不写"已接入第 N 项",
 * 那种话会被守门 89 判"声称装了车而零命中")。
 *
 * 立票凭据(G-93,2026-10-15):上游 `persisted-remote-session-path-repair.ts` 的判定只有
 *   `clean | repair | unrelated | unsafe` 四态,"含 identity 而前缀不匹配 ⇒ unsafe 直接抛错",
 *   写输入带 `expectedDirectory/expectedPath` 两个旧值,CAS 未命中**必须基于新事实重新裁决,
 *   不能返回旧快照**。我方同一族判据只住在 git 层(heal-worktree-tracked / refreshStaleIndex,
 *   AGENTS §5b),DB 行面没有"带旧值 expected 的窄修复"出口 ⇒ 现场只能顺手修一下。
 *   本门不替任何人改 DB 代码(票面:**不预先改任何文件**),它做的是把"下一条 DB 归属型
 *   修复票动手时按本模板写"变成一台机器闸:模板三要素的**缺项只许减少,不许新增**。
 *
 * 三条判据(全部住在 `scripts/lib/db-row-narrow-cas.mjs`,本门只取材与裁决 —— §22c 一份实现):
 *   ① `expected`  写必须带旧值(没有旧值的 UPDATE 不是 CAS,是盲写);
 *   ② `fourState` 判定必须是四态封闭集,且 `unsafe` 的出口是**抛错**(不抛错 = 不是拒猜);
 *   ③ `reread`    自己判了 `changes === 0` 就必须自己再取一次事实重裁,不许拿旧快照再来一枪。
 *   正当形态只有一条:**import 那份模板**(四态与拒猜由模板给出,不要求调用方再抄一遍 ——
 *   判据必须认自己给出的出口,否则"按规矩写"反被自己的门钉红)。
 *
 * 射程(刻意窄,扩面须先立票量存量 §12e):`apps/api/src` 的 TS/JS 里"自称在做维护性修复"
 * (代码面同时有 UPDATE 形态与 repair/heal/backfill/reconcile 族词)的文件。
 *   · `apps/ai-service/app`(Python)**不在射程**:模板本体是 ESM,Python 侧结构性走不了
 *     "import 模板"这一条正当形态 ⇒ 拉进来等于造一台恒红门(§12f)。要扩面须先立票。
 *   · 测试面(`/tests/`、`.test.`)不进射程(夹具里的 SQL 不是生产写路径)。
 *
 * 口径(照抄本仓横向口径,不得自创):全量判 **HEAD blob** / `--staged` 判**索引 blob** /
 * `--worktree` 仅人工逃生舱;两面旗同给 exit 2;取不到 ⇒ "无法判定"且**不回落**另一个面;
 * 枚举到 0 个候选判死(不记绿);存量只报数不判红(§12e/§12f 恒红门禁令),`--strict` 才问责;
 * 遮罩引 `scripts/lib/code-mask.mjs` 那一份(经 lib 转手,本门不自带分词器)。
 *
 * 用法:
 *   node scripts/check-db-row-narrow-cas.mjs                 # 全量档(HEAD):存量只报数
 *   node scripts/check-db-row-narrow-cas.mjs --staged        # 提交链:只判本次暂存引入的缺项
 *   node scripts/check-db-row-narrow-cas.mjs --strict        # 存量也问责(升 blocking 前先看它)
 *   node scripts/check-db-row-narrow-cas.mjs --json
 *   node scripts/check-db-row-narrow-cas.mjs --update-baseline   # 只许收窄(缺项集合只能变小)
 *   node scripts/check-db-row-narrow-cas.mjs --self-test
 * 退出码:0 = 绿/只报数 · 1 = 缺项被新增(新增候选带缺项 / 已有文件缺项变多 / --strict 存量) · 2 = 用法或无法判定
 */

import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

import { catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { judgeTemplate, TEMPLATE_PARTS } from './lib/db-row-narrow-cas.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const SCAN_DIRS = ['apps/api/src']
const BASELINE_REL = 'scripts/db-row-narrow-cas-baseline.json'
const BASELINE = resolve(ROOT, BASELINE_REL)
const SRC_EXT = /\.(ts|tsx|js|mjs|cjs|cts)$/
const TEST_FACE = /(?:^|\/)(?:tests?|__tests__)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/

/** 面 → 文件清单。三个面各自只有一段 git,不混面(混面 = 看起来自洽、实则错位的绿)。 */
function listFiles(face) {
  const args =
    face === 'staged'
      ? ['diff', '--cached', '--name-only', '--diff-filter=d', '--', ...SCAN_DIRS]
      : face === 'worktree'
        ? ['ls-files', '--', ...SCAN_DIRS]
        : ['ls-tree', '-r', '--name-only', 'HEAD', '--', ...SCAN_DIRS]
  const out = gitRaw(args, ROOT, { maxBuffer: 1 << 28 })
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter((f) => f && SRC_EXT.test(f) && !TEST_FACE.test(f))
}

/** 面 → 内容。索引面用 `:<path>`、HEAD 面用 `HEAD:<path>`、工作树走层的 readWorktreeFile。 */
function readFiles(face, files) {
  const out = new Map()
  if (face === 'worktree') {
    for (const f of files) {
      const t = readWorktreeFile(ROOT, f)
      if (t != null) out.set(f, t)
    }
    return out
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const specs = files.map((f) => `${prefix}${f}`)
  const blobs = catBatch(ROOT, specs, { maxBuffer: 1 << 28 })
  for (const f of files) {
    const t = blobs.get(`${prefix}${f}`)
    if (t != null) out.set(f, t)
  }
  return out
}

/**
 * 面 → 候选文件及其缺项。取不到任何候选内容 ⇒ 抛(由调用方判"无法判定",绝不折成绿)。
 * @returns {Map<string,string[]>} file -> missing(⊆ TEMPLATE_PARTS)
 */
export function collectFace(face) {
  const files = listFiles(face)
  const texts = readFiles(face, files)
  const out = new Map()
  for (const [f, text] of texts) {
    const j = judgeTemplate(text)
    if (j.candidate) out.set(f, j.missing.slice().sort())
  }
  return { candidates: out, scanned: files.length, read: texts.size }
}

function loadBaseline() {
  if (!existsSync(BASELINE)) return null
  try {
    const p = JSON.parse(readFileSync(BASELINE, 'utf8'))
    if (!p || typeof p.perFile !== 'object') return null
    return p
  } catch {
    return null
  }
}

function writeBaseline(candidates, { narrowOnly = true, prev = null } = {}) {
  const perFile = {}
  for (const [f, missing] of candidates) {
    if (narrowOnly && prev && Array.isArray(prev[f])) {
      // 只许收窄:基线里**仍然缺**的项才留着 —— 把新增的缺项洗进基线等于替违规发通行证
      perFile[f] = prev[f].filter((m) => missing.includes(m))
    } else if (!narrowOnly || !prev) {
      perFile[f] = missing.slice()
    }
  }
  const next = {
    version: 1,
    anchor: 'DB 行面维护性修复文件逐文件的「模板缺项」集合(expected/fourState/reread);缺项只许减少,新增即判红,存量只报数。',
    reason: '2026-10-15 G-93 首建:模板 scripts/lib/db-row-narrow-cas.mjs 与本节同枚落地。基线取当日 HEAD 现值。',
    face: 'head',
    scanDirs: SCAN_DIRS,
    parts: TEMPLATE_PARTS.slice(),
    perFile,
  }
  writeFileSync(BASELINE, JSON.stringify(next, null, 2) + '\n', 'utf8')
  return next
}

/** 判定层(自测与主判定共用):新候选带缺项 / 已有文件缺项变多 ⇒ 红;缺项变少 ⇒ 清偿。 */
export function judgeAgainstBaseline(candidates, base) {
  const prev = base?.perFile ?? {}
  const red = []
  const cleared = []
  for (const [f, missing] of candidates) {
    if (!Array.isArray(prev[f])) {
      if (missing.length > 0) red.push({ file: f, kind: 'new-candidate', missing })
      continue
    }
    const added = missing.filter((m) => !prev[f].includes(m))
    if (added.length > 0) red.push({ file: f, kind: 'regressed', missing: added })
    const gone = prev[f].filter((m) => !missing.includes(m))
    if (gone.length > 0) cleared.push({ file: f, cleared: gone })
  }
  return { red, cleared }
}

function totalMissing(candidates) {
  let n = 0
  for (const m of candidates.values()) n += m.length
  return n
}

export function selfTestRun(asJson) {
  const cases = [
    {
      name: '走模板的调用方**不进射程**(它自己不写 SQL,没有可判的写面)',
      text: `import { narrowCasRepair } from '../lib/db-row-narrow-cas.mjs'
export async function repairRemoteSessionPaths(input) {
  return narrowCasRepair({ readRow, updateRow, expected: { directory: input.expectedDirectory }, fields: ['directory'] })
}`,
      wantCandidate: false,
      wantMissing: [],
    },
    {
      name: '自己写 SQL + import 模板 ⇒ 四态/重读不缺(只可能缺 expected)',
      text: `import { adjudicateRow } from '../lib/db-row-narrow-cas.mjs'
export async function repairRemoteSessionPaths(input) {
  const adj = adjudicateRow({ row, expected: { directory: input.expectedDirectory }, fields: ['directory'] })
  const r = await db.execute(sql\`update session set directory = \${adj.writes[0].to}
    where id = \${input.id} and directory = \${input.expectedDirectory}\`)
  if (Number(r.changes) === 0) return Number(r.changes)
  return true
}`,
      wantCandidate: true,
      wantMissing: [],
    },
    {
      name: '本地四态齐 + unsafe 抛错 + 未命中重读 ⇒ 零缺项',
      text: `const STATES = ['clean', 'repair', 'unrelated', 'unsafe']
export async function repairRow(input) {
  const v = classify(input, STATES)
  if (v === 'unsafe') throw new Error('refuse')
  const r = await db.execute(sql\`update t set directory = \${input.directory} where id = \${input.id} and directory = \${input.expectedDirectory}\`)
  if (Number(r.changes) === 0) return repairRow({ ...input, ...(await selectRow(input.id)) })
  return true
}`,
      wantCandidate: true,
      wantMissing: [],
    },
    {
      name: '顺手修一下(update + repair 名,无旧值无四态)⇒ 三缺',
      text: `export async function repairThing(id, next) {
  await db.update(t).set({ directory: next }).where(eq(t.id, id))
  return true
}`,
      wantCandidate: true,
      wantMissing: ['expected', 'fourState'],
    },
    {
      name: '只在注释里自称四态 ⇒ 仍算缺(注释已遮)',
      text: `// clean | repair | unrelated | unsafe,expectedDirectory
export async function repairThing(id, next) {
  await db.update(t).set({ directory: next }).where(eq(t.id, id))
}`,
      wantCandidate: true,
      wantMissing: ['expected', 'fourState'],
    },
    {
      name: 'health-check 不属修复族 ⇒ 不是候选(词形不许放宽到 health)',
      text: `export async function healthCheck() {
  await db.update(t).set({ ok: 1 }).where(eq(t.id, 'x'))
}`,
      wantCandidate: false,
      wantMissing: [],
    },
    {
      name: '未命中直接返回(发 UPDATE 的 execute 不算重读)⇒ 缺 reread',
      text: `export async function backfillRow(id, expectedStatus) {
  const r = await db.execute(sql\`update t set status = 'ok' where id = \${id} and status = \${expectedStatus}\`)
  return Number(r.changes) === 0
}`,
      wantCandidate: true,
      wantMissing: ['fourState', 'reread'],
    },
  ]
  let fail = 0
  const lines = []
  for (const c of cases) {
    const got = judgeTemplate(c.text)
    // 非候选不比缺项(没有写面的文件,缺项无意义)
    const ok =
      got.candidate === c.wantCandidate &&
      (!c.wantCandidate || got.missing.join(',') === c.wantMissing.join(','))
    if (!ok) fail += 1
    lines.push(`${ok ? '✅' : '❌'} ${c.name}:期望 candidate=${c.wantCandidate} missing=[${c.wantMissing}] 实测 candidate=${got.candidate} missing=[${got.missing}]`)
  }

  // 判定层成对:新候选带缺项 / 已有文件缺项变多 / 缺项变少(清偿)
  const base = { perFile: { 'a.ts': ['expected', 'fourState'] } }
  const grew = judgeAgainstBaseline(new Map([['a.ts', ['expected', 'fourState', 'reread']]]), base)
  const okGrew = grew.red.length === 1 && grew.red[0].kind === 'regressed'
  if (!okGrew) fail += 1
  lines.push(`${okGrew ? '✅' : '❌'} 判定层:已有文件缺项变多 ⇒ regressed`)
  const fresh = judgeAgainstBaseline(new Map([['n.ts', ['expected']]]), base)
  const okFresh = fresh.red.length === 1 && fresh.red[0].kind === 'new-candidate'
  if (!okFresh) fail += 1
  lines.push(`${okFresh ? '✅' : '❌'} 判定层:新候选带缺项 ⇒ new-candidate`)
  const better = judgeAgainstBaseline(new Map([['a.ts', []]]), base)
  const okBetter = better.red.length === 0 && better.cleared.length === 1
  if (!okBetter) fail += 1
  lines.push(`${okBetter ? '✅' : '❌'} 判定层:缺项变少 ⇒ 清偿不红`)

  if (asJson) console.log(JSON.stringify({ fail, lines }))
  else for (const l of lines) console.log(l)
  return fail ? 1 : 0
}

function printRed(red) {
  console.log('\x1b[31m[窄 CAS 模板] ❌ DB 行面的维护性修复把模板缺项**新增**了:\x1b[0m')
  for (const r of red) {
    console.log(`   ${r.file}:${r.kind === 'new-candidate' ? '新进射程且带缺项' : '缺项变多'} [${r.missing.join(', ')}]`)
  }
  console.log('   三要素:expected=写必须带旧值 · fourState=四态封闭集且 unsafe 抛错 · reread=未命中必须重读再裁决。')
  console.log('   出路:直接 import scripts/lib/db-row-narrow-cas.mjs 的 adjudicateRow/narrowCasRepair(它自带三条),')
  console.log('        确实要自己写时,四态 + expected 旧值 + 未命中重读三条必须同笔补齐;不许靠改基线消红(基线只许收窄)。')
}

function main(argv) {
  const asJson = argv.includes('--json')
  const strict = argv.includes('--strict')
  const updateBaseline = argv.includes('--update-baseline')
  const picked = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree') })
  if (picked.error) {
    console.error(`⏭  ${picked.error} ⇒ exit 2`)
    return 2
  }
  const face = picked.face

  let cur
  try {
    cur = collectFace(face)
  } catch (e) {
    console.error(`⏭  ${face} 面取材失败 ⇒ 无法判定(不回落其他面):${e?.message ?? e}`)
    return 2
  }
  const { candidates, scanned } = cur

  if (face === 'staged') return stagedRun(candidates, asJson)

  // 枚举到 0 判死:一台永远看不到候选的门,与"判据失效永远安静"是同一件事
  if (candidates.size === 0) {
    console.error(`⏭  ${face} 面扫到 ${scanned} 个源文件、**0 个**维护性修复候选 ⇒ 无法判定(判死,不记绿)`)
    return 2
  }

  const baseline = loadBaseline()
  const total = totalMissing(candidates)
  const payload = { face, scanned, candidates: candidates.size, missingTotal: total }

  if (!baseline) {
    if (updateBaseline) {
      writeBaseline(candidates, { narrowOnly: false })
      console.log(`[窄 CAS 模板] 基线首建:${candidates.size} 个候选 / 缺项 ${total} 条 → ${BASELINE_REL}`)
      return 0
    }
    console.log(`[窄 CAS 模板] ⚠️ 未判定:${BASELINE_REL} 缺失 ⇒ 存量 ${candidates.size} 个候选 / 缺项 ${total} 条**只报数**(不静默当没有存量)`)
    console.log(`   出路:跑 --update-baseline 按 ${face} 面现值建锚(首建不受"只许收窄"限制)。`)
    if (asJson) console.log(JSON.stringify({ ...payload, kind: 'undetermined', reason: 'baseline-missing' }))
    return 0
  }

  const { red, cleared } = judgeAgainstBaseline(candidates, baseline)
  payload.red = red
  payload.cleared = cleared
  payload.kind = red.length ? 'red' : 'ok'

  if (asJson) {
    console.log(JSON.stringify(payload, null, 1))
  } else if (red.length) {
    printRed(red)
  } else {
    console.log(
      `\x1b[32m[窄 CAS 模板] ✅ ${face} 面 ${candidates.size} 个候选 / 缺项 ${total} 条,无新增${cleared.length ? `,清偿 ${cleared.length} 个文件(可跑 --update-baseline 收窄锚点)` : ''}\x1b[0m`,
    )
  }

  let rc = red.length ? 1 : 0
  if (strict && total > 0) {
    if (!asJson) console.log(`   --strict:存量缺项 ${total} 条一并无条件问责(升 blocking 前先看这个数;存量归零才准升档,§12e)`)
    rc = 1
  }

  if (updateBaseline) {
    const next = writeBaseline(candidates, { narrowOnly: true, prev: baseline.perFile })
    if (!asJson) console.log(`[窄 CAS 模板] 基线已收窄重写:候选 ${candidates.size} / 缺项 ${totalMissing(new Map(Object.entries(next.perFile).map(([k, v]) => [k, v])))} 条 → ${BASELINE_REL}`)
    rc = 0 // 重建锚点就是消红动作:基于旧基线的红名单只作留痕
  }
  return rc
}

/** 提交链档:只判"本次暂存把缺项加进来" —— 别人的在飞/存量归全量档的棘轮管。 */
function stagedRun(candidates, asJson) {
  let headCandidates
  try {
    headCandidates = collectFace('head').candidates
  } catch (e) {
    console.error(`⏭  暂存档需要 HEAD 面作对照,取材失败 ⇒ 无法判定:${e?.message ?? e}`)
    return 2
  }
  const red = []
  for (const [f, missing] of candidates) {
    const prev = headCandidates.get(f)
    if (!Array.isArray(prev)) {
      if (missing.length > 0) red.push({ file: f, kind: 'new-candidate', missing })
      continue
    }
    const added = missing.filter((m) => !prev.includes(m))
    if (added.length > 0) red.push({ file: f, kind: 'regressed', missing: added })
  }
  if (asJson) console.log(JSON.stringify({ kind: red.length ? 'red' : 'ok', mode: 'staged', stagedCandidates: candidates.size, red }, null, 1))
  else if (red.length) printRed(red)
  else console.log(`[窄 CAS 模板] ✅ 暂存面无新增缺项(本次暂存候选 ${candidates.size} 个)`)
  return red.length ? 1 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    if (process.argv.includes('--self-test')) process.exit(selfTestRun(process.argv.includes('--json')))
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    console.error(`❌ 脚本自身异常(exit 2): ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  collectFace,
  judgeAgainstBaseline,
  selfTestRun,
  judgeTemplate,
  SCAN_DIRS,
  BASELINE_REL,
  ROOT,
}
export { judgeTemplate }

// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
