// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-autonomy-invariants.mjs —— 自主环判据不变量守卫(门 299,2026-11-05 立,blocking)
 *
 * 立因(当次实测,不是"再加一层保险"):多会话共用一棵工作树时,一席的**在飞副本**常常是从
 * 我今天落地之前的旧基线长出来的。当次现读:`scripts/auto-evolve.mjs` 工作树 2851 行、HEAD 2263 行,
 * 而那份副本**缺当天全部 6 项判据**(零写盘档 `session-no-write`、`classifySessionWrites`、
 * 运行时归一 `normalizeSessionRuntime`、私有索引落账通道、`judgeLandingProof` 五问、交付边界 prompt 段)。
 * 它一旦提交,就是整片回写 —— 而提交链上没有任何一道门抓得住这种形态:
 *  · 门 84 R1 要"暂存 blob == 某祖先版本",而它带着新增,不等于任何祖先 ⇒ 放行;
 *  · immutable-guard 只管受保护面,`scripts/auto-evolve.mjs` 刻意不在面上(它是调度器,不是判据本体);
 *  · 分档对账测试(发射集 ⊆ 分档集)住在 CI / nightly 那一层,不在 pre-commit。
 * ⇒ 环的判据被并发抹掉时,环自己必须是**瞎的**还是**喊的**。这一门把它变成喊的。
 *
 * 判据顺序(与全仓横向口径一致,§0.4):
 *  1. 两面旗同给 ⇒ exit 2 未判定;
 *  2. 清单取不到 / JSON 坏 / entries 空 ⇒ exit 2 未判定 —— 不拿"没有清单"冒充"没有约束";
 *  3. 逐份取被审面(全量档 = HEAD blob,`--staged` = 索引 blob):取不到 ⇒ 该文件未判定,**绝不回落另一个面**;
 *  4. 清单声明的每条锚点必须逐字出现在被审面里;缺任意一条 ⇒ drift 并逐条点名(哪条锚点、哪份文件、
 *     在哪个 rev 上消失);
 *  5. 锚点是**绝对要求**而非差值棘轮:这里的失效型正是"悄悄少一条",而"少"发生在被审面上,
 *     拿该文件自己的历史违规数当锚点会自我豁免(它自己就是被抹的那个)。
 *
 * 方向纪律(§0.10):这道门唯一的出路是"把消失的判据带回来"。它不提供行内豁免、不提供跳门变量之外的
 * 任何放宽档 —— 真要解禁某个锚点(判据被合法改名/迁户),正解是**改清单本身并随同一枚提交带上改名后的
 * 新锚点**,清单与代码同轮变化,不许留一条"清单还认旧名"的僵尸。
 *
 * 取证:`--self-test` 成对夹具(齐⇒绿 / 摘一条⇒红 / 清单坏⇒未判定 / 面取不到⇒未判定 /
 * 两面旗同给⇒未判定);清单 = `scripts/data/autonomy-invariants.json`。
 * 应急:`HUSKY_SKIP_AUTONOMY_INVARIANTS=1`,须与 `..._REASON="<定向说明>"` 同给。
 */
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const DATA_REL = 'scripts/data/autonomy-invariants.json'

/** 读清单并解析;坏/空一律进 problems(调用方据此落未判定,不猜)。 */
export function parseInvariants(text) {
  const problems = []
  if (typeof text !== 'string' || text.trim() === '')
    return { entries: [], problems: [{ code: 'list-missing', message: '清单文本取不到' }] }
  let json
  try {
    json = JSON.parse(text)
  } catch (e) {
    return {
      entries: [],
      problems: [
        { code: 'list-bad', message: `清单不是合法 JSON:${String(e?.message ?? e).slice(0, 90)}` },
      ],
    }
  }
  const raw = Array.isArray(json?.entries) ? json.entries : null
  if (!raw) return { entries: [], problems: [{ code: 'list-bad', message: '清单缺 entries 数组' }] }
  if (raw.length === 0)
    return {
      entries: [],
      problems: [{ code: 'list-empty', message: 'entries 为空 ⇒ 不得把"没有条目"读成"没有约束"' }],
    }
  const entries = []
  for (const [i, e] of raw.entries()) {
    if (typeof e?.path !== 'string' || !e.path.trim()) {
      problems.push({ code: 'list-bad', message: `entries[${i}] 缺 path` })
      continue
    }
    if (!Array.isArray(e.anchors) || e.anchors.length === 0) {
      problems.push({ code: 'list-bad', message: `${e.path} 的 anchors 缺失或为空` })
      continue
    }
    if (e.anchors.some((a) => typeof a !== 'string' || !a.trim())) {
      problems.push({ code: 'list-bad', message: `${e.path} 的 anchors 里有空值/非字符串` })
      continue
    }
    if (typeof e.why !== 'string' || [...e.why.trim()].length < 10) {
      problems.push({
        code: 'list-bad',
        message: `${e.path} 的 why 必须是不短于 10 字的说明(这条不变量为什么不许消失)`,
      })
      continue
    }
    entries.push({
      path: e.path.trim(),
      anchors: e.anchors.map((a) => a.trim()),
      why: e.why.trim(),
    })
  }
  return { entries, problems }
}

/**
 * 核心判定:逐条锚点对被审面文本求存在。
 * @param {Array<{path:string,anchors:string[],why:string}>} entries
 * @param {Map<string,{ok:boolean,text?:string,why?:string}>} faces 每份文件的取面结果
 */
export function decideInvariants(entries, faces) {
  const lost = []
  const unreadable = []
  let checked = 0
  for (const e of entries) {
    const f = faces.get(e.path)
    if (!f || f.ok !== true) {
      unreadable.push({ path: e.path, why: f?.why ?? '取面结果缺失' })
      continue
    }
    checked += 1
    const missing = e.anchors.filter((a) => !f.text.includes(a))
    if (missing.length) lost.push({ path: e.path, why: e.why, missing })
  }
  return {
    state: lost.length ? 'drift' : unreadable.length ? 'unjudged' : 'ok',
    lost,
    unreadable,
    checked,
  }
}

function readFaceText(root, face, rel, rev) {
  if (face === 'worktree') {
    // 人工逃生舱(§0.4):取盘上那份,但读不到仍是未判定 —— 不回落、不猜。
    // 经 face-reader 的统一取材出口(门 118:本次改动动过的门不得散写磁盘读取)。
    try {
      const t = readWorktreeFile(root, rel)
      return typeof t === 'string'
        ? { ok: true, text: t }
        : { ok: false, why: `工作树 ${rel} 取不到(不存在或读失败)` }
    } catch (e) {
      return { ok: false, why: `工作树 ${rel} 读不到:${String(e?.message ?? e).slice(0, 110)}` }
    }
  }
  const spec = face === 'staged' ? `:${rel}` : `${rev}:${rel}`
  try {
    return { ok: true, text: gitRaw(['show', spec], root) }
  } catch (e) {
    return { ok: false, why: `${spec} 取不到:${String(e?.message ?? e).slice(0, 110)}` }
  }
}

export function runAudit(root = ROOT, { face = 'head', rev = 'HEAD' } = {}) {
  const base = {
    face,
    rev,
    exit: 2,
    state: 'unjudged',
    lost: [],
    unreadable: [],
    checked: 0,
    entryCount: 0,
    detail: '',
  }
  let listText
  try {
    listText =
      face === 'head'
        ? gitRaw(['show', `${rev}:${DATA_REL}`], root)
        : readFaceText(root, face, DATA_REL, rev).text
  } catch (e) {
    return {
      ...base,
      code: 'list-missing',
      detail: `清单在被审面上取不到(${DATA_REL}):${String(e?.message ?? e).slice(0, 110)}`,
    }
  }
  const parsed = parseInvariants(listText)
  if (parsed.problems.length)
    return {
      ...base,
      code: parsed.problems[0].code,
      listProblems: parsed.problems,
      detail: parsed.problems.map((p) => p.message).join('; '),
    }
  const faces = new Map()
  for (const e of parsed.entries) faces.set(e.path, readFaceText(root, face, e.path, rev))
  const out = decideInvariants(parsed.entries, faces)
  return {
    ...base,
    exit: out.state === 'drift' ? 1 : out.state === 'unjudged' ? 2 : 0,
    code: out.state,
    entryCount: parsed.entries.length,
    detail: '',
    ...out,
  }
}

export function printResult(r) {
  if (r.code === 'list-missing' || r.code === 'list-bad' || r.code === 'list-empty') {
    console.error(`❌ 自主环不变量守卫【未判定】:清单问题 —— ${r.detail}`)
    return
  }
  if (r.state === 'unjudged') {
    console.error(
      `❌ 自主环不变量守卫【未判定】:${r.unreadable.length} 份被审文件取不到(${r.face} 面)⇒ 既不记绿也不记红`,
    )
    for (const u of r.unreadable) console.error(`   · ${u.path}:${u.why}`)
    return
  }
  if (r.state === 'drift') {
    console.error(
      `❌ 自主环判据不变量被抹掉(判 ${r.entryCount} 条,失 ${r.lost.length} 条;判定面=${r.face})`,
    )
    for (const l of r.lost) {
      console.error(`   · ${l.path} —— ${l.why}`)
      for (const a of l.missing) console.error(`       消失的锚点:${JSON.stringify(a)}`)
    }
    console.error(
      `   出路:把这些判据带回 ${r.face} 面(通常是"你的副本是从旧基线长出来的 ⇒ 先 rebase/合并今天的改动,再提交")。`,
    )
    console.error(
      `         真要解禁某条锚点(判据被合法改名/迁户)⇒ 改 ${DATA_REL} 并在同一枚提交里带上改名后的新锚点;不留"清单还认旧名"的僵尸。`,
    )
    return
  }
  console.log(
    `✅ 自主环判据不变量守卫:${r.checked} 份文件、${r.entryCount} 条锚点全部在被审面(${r.face})上实有`,
  )
}

function selfTest() {
  let failed = 0
  const ok = (name, cond) => {
    if (cond) console.log(`  ✅ ${name}`)
    else {
      console.error(`  ❌ ${name}`)
      failed++
    }
  }
  console.log('autonomy-invariants self-test:')
  const E = [
    { path: 'a.mjs', anchors: ['alphaFn', 'beta const'], why: '这条不变量不许消失的充分理由' },
  ]
  const good = new Map([
    ['a.mjs', { ok: true, text: 'const x = 1\nfunction alphaFn(){}\nconst beta const = 2\n' }],
  ])
  ok('I1 齐 ⇒ ok', decideInvariants(E, good).state === 'ok')
  ok(
    'I2 摘一条锚点 ⇒ drift 并点名',
    (() => {
      const bad = new Map([['a.mjs', { ok: true, text: 'const x = 1\nconst beta const = 2\n' }]])
      const r = decideInvariants(E, bad)
      return r.state === 'drift' && r.lost[0].missing[0] === 'alphaFn'
    })(),
  )
  ok(
    'I3 反向:整片回写成旧版 ⇒ drift(这正是本门要抓的形态)',
    (() => {
      const stale = new Map([['a.mjs', { ok: true, text: '// 旧基线副本,一个新锚点都没有\n' }]])
      return decideInvariants(E, stale).state === 'drift'
    })(),
  )
  ok(
    'I4 面取不到 ⇒ unjudged(不冒充通过也不冒充缺陷)',
    (() => {
      const r = decideInvariants(E, new Map([['a.mjs', { ok: false, why: 'boom' }]]))
      return r.state === 'unjudged' && r.unreadable[0].why === 'boom'
    })(),
  )
  ok('I5 清单坏 ⇒ problems 非空', parseInvariants('{ 不是合法 JSON').problems.length === 1)
  ok(
    'I6 清单空 entries ⇒ 未判定(不许把"没有条目"读成"没有约束")',
    parseInvariants('{"entries":[]}').problems[0].code === 'list-empty',
  )
  ok(
    'I7 anchors 为空 ⇒ 清单问题',
    parseInvariants('{"entries":[{"path":"a","anchors":[],"why":"理由理由理由理由理由"}]}').problems
      .length === 1,
  )
  ok(
    'I8 why 短于 10 字 ⇒ 清单问题(每条不变量都得有交代)',
    parseInvariants('{"entries":[{"path":"a","anchors":["x"],"why":"太短"}]}').problems.length ===
      1,
  )
  ok(
    'I9 多份文件里只有一份缺 ⇒ 只点名那一份',
    (() => {
      const E2 = [
        { ...E[0] },
        { path: 'b.mjs', anchors: ['gamma'], why: '另一条不变量的充分理由说明' },
      ]
      const f = new Map([
        ['a.mjs', { ok: true, text: 'alphaFn beta const' }],
        ['b.mjs', { ok: true, text: 'nothing here' }],
      ])
      const r = decideInvariants(E2, f)
      return r.state === 'drift' && r.lost.length === 1 && r.lost[0].path === 'b.mjs'
    })(),
  )
  console.log(`autonomy-invariants self-test: ${failed === 0 ? `全通过(9 例)` : `${failed} 例红`}`)
  process.exitCode = failed === 0 ? 0 : 1
}

function main(argv) {
  const staged = argv.includes('--staged')
  const worktree = argv.includes('--worktree')
  if (staged && worktree) {
    console.error('❌ 两面旗同给 ⇒ 未判定(§0.4:不猜你要判哪个面)')
    process.exitCode = 2
    return
  }
  if (argv.includes('--self-test')) {
    selfTest()
    return
  }
  const face = selectFace({ staged, worktree, def: 'head' })
  const revIdx = argv.indexOf('--rev')
  const r = runAudit(ROOT, { face, rev: revIdx >= 0 ? String(argv[revIdx + 1] ?? 'HEAD') : 'HEAD' })
  printResult(r)
  process.exitCode = r.exit
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main(process.argv.slice(2))

export const __test__ = { parseInvariants, decideInvariants, runAudit, printResult, DATA_REL, ROOT }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
