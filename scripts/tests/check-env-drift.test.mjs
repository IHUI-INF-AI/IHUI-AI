#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// =============================================================================
// check-env-drift.mjs 的镜像测试(§22c:直接 import 源实现,不在测试里抄第二份判据)
// =============================================================================
// 为什么要有它:这把尺子判的是**机器状态**,所以它刻意不在提交链上 —— 而"刻意不接线"这件事
// 本身没有提交链的判据会替它说话:任何一次顺手把 `check-*.mjs` 加进 guardian-runner 的改动,
// 都会把一台"在别人机器上必然未判定"的尺子变成恒红 blocking 门(§12e 那一型的成因)。
// 这里钉六件事:
//   T1 装车证明 —— `scripts/git-guardian.mjs` 里确实调用了这把尺子,且调用点在
//      `!CHECK_ONLY` 分支内、并在健康轮次早退块之内(挂错位置等于永不执行,该文件已踩过两次)
//   T2 摘线必红 —— 把那一行删掉,同一条判据必须判"未接线"(方向性对照,证明 T1 不是恒真)
//   T3 绝不进提交链 —— guardian-runner 的 checks 数组里不得出现本工具(设计前提,不是遗漏)
//   T4 退出码分流 —— 红优先于未判定、未知状态归未判定(构造面,不依赖仓库瞬时状态)
//   T5 结论与退出码同形 —— 真仓现读:exit 0 必须等于"零漂移且零未判定",且默认 JSON 不含长度字段
//   T6 值不落任何出口 —— 含金丝雀值的端到端证明(默认档与 --verbose 档都不许出现该串)
//   T7 空对照面不得冒充通过 —— 指向一个空目录 ⇒ exit 2 且逐条"未判定"
//
// 跑法:node --test scripts/tests/check-env-drift.test.mjs
// =============================================================================
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as GATE } from '../check-env-drift.mjs'
import { __test__ as GUARD } from '../git-guardian.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const TOOL = join(REPO, 'scripts', 'check-env-drift.mjs')
const GUARDIAN = join(REPO, 'scripts', 'git-guardian.mjs')

/** 跑一次真 CLI(只读工具,零副作用);返回 {code, stdout} */
function runCli(args) {
  try {
    const stdout = execFileSync(process.execPath, [TOOL, ...args], {
      encoding: 'utf8',
      windowsHide: true, // §5b:漏此参数在守护/计划任务下必弹控制台窗
      timeout: 60_000, // 守门 80:派生一律带上限
      maxBuffer: 8 * 1024 * 1024,
    })
    return { code: 0, stdout }
  } catch (e) {
    return { code: typeof e.status === 'number' ? e.status : 2, stdout: String(e.stdout || '') }
  }
}

// ── T1 装车证明 ─────────────────────────────────────────────────────────────
test('T1 git-guardian 真调用了这把尺子,且挂点在 !CHECK_ONLY 分支 / 健康早退块之内', () => {
  const src = readFileSync(GUARDIAN, 'utf8')
  const v = GATE.verifyGuardianWiring(src)
  // 逐项点名,否则"红了但不知道哪一项红"——而这类失败的表现永远是安静
  if (!v.wired) throw new Error(`装车判据未通过:${JSON.stringify(v.checks)}`)

  // 顺序证明(纯位置断言,不参与判据本体):调用点必须落在
  //   `if (coreOk && before.refsOk) {` 之后、健康结论行 `✅ .git 健康` 之前
  const gateIdx = src.indexOf('if (coreOk && before.refsOk)')
  const hookIdx = src.indexOf('if (!CHECK_ONLY) auditEnvDrift()')
  const earlyReturnIdx = src.indexOf('✅ .git 健康', hookIdx)
  if (gateIdx < 0 || hookIdx < 0) throw new Error('找不到健康分支边界或调用点')
  if (!(hookIdx > gateIdx)) throw new Error('挂点在健康分支之外:该轮根本不会走到这里')
  if (!(earlyReturnIdx > hookIdx))
    throw new Error('挂点在健康轮次早退之后 ⇒ 永不执行(本仓踩过两次的那一型)')

  // 第二个执行体(NSSM --daemon)也必须挂上,否则 daemon 跑的那台机永远不判
  const daemonIdx = src.indexOf('auditEnvDrift()', src.indexOf('function startDaemon'))
  if (!(daemonIdx > 0 && daemonIdx !== hookIdx))
    throw new Error('常驻模式没挂这一层(双执行体覆盖不齐)')
})

// ── T2 摘线必红(方向性对照)───────────────────────────────────────────────
test('T2 把挂点删掉 ⇒ 同一条判据必须判"未接线"(T1 不是恒真)', () => {
  const src = readFileSync(GUARDIAN, 'utf8')
  const stripped = src.replace('if (!CHECK_ONLY) auditEnvDrift()', '/* 摘线 */')
  if (stripped === src) throw new Error('夹具失效:没找到要摘的那一行')
  const v = GATE.verifyGuardianWiring(stripped)
  if (v.wired) throw new Error('摘线后仍判"已接线" ⇒ 装车证明没有牙')
  if (v.checks.hookedInTick) throw new Error('hookedInTick 应为 false')
})

test('T2b 挂错分支(改判到 CHECK_ONLY 一侧)同样必须判未接线', () => {
  const src = readFileSync(GUARDIAN, 'utf8')
  const flipped = src.replace('if (!CHECK_ONLY) auditEnvDrift()', 'if (CHECK_ONLY) auditEnvDrift()')
  if (flipped === src) throw new Error('夹具失效')
  if (GATE.verifyGuardianWiring(flipped).wired)
    throw new Error('挂进 --check 分支等于永不执行,必须判未接线')
})

// ── T3 设计前提:绝不进提交链 ──────────────────────────────────────────────
test('T3 本工具不得被接进 pre-commit 提交链(它判机器状态,接进去就是恒红门)', () => {
  const runner = readFileSync(join(REPO, 'scripts', 'guardian-runner.mjs'), 'utf8')
  const start = runner.indexOf('const checks = [')
  const end = runner.indexOf('// === push 门检查集')
  if (start < 0 || end <= start) throw new Error('尺子失效:找不到 checks 数组边界')
  const region = runner.slice(start, end)
  if (region.includes('check-env-drift')) {
    throw new Error(
      'check-env-drift 被接进了提交链。它判的是这台机的 .env 与它的备份(两者都在 .gitignore 内,' +
        '任何检出上都不存在)⇒ 干净 checkout / CI / 别人机器上"无对照面"是常态,blocking 就是把' +
        '每一次提交逼成 --no-verify(§12e 同型)。要接请先把它改成判仓库内容,或明确接受恒红代价。',
    )
  }
})

// ── T4 退出码分流(构造面)─────────────────────────────────────────────────
test('T4 红优先于未判定;未知状态归未判定,绝不记绿', () => {
  const v = (state, drift = []) => ({
    id: state,
    state,
    drift,
    reason: '',
    currentPath: '',
    counts: {},
  })
  const mixed = GATE.aggregate([v('drift', [{ key: 'K', kind: 'empty' }]), v('undetermined')])
  if (!(mixed.exit === 1 && mixed.counts.drift === 1 && mixed.counts.undetermined === 1)) {
    throw new Error(`一个目标不可判不得替其余目标的真漂移消音:${JSON.stringify(mixed)}`)
  }
  const onlyUndetermined = GATE.aggregate([v('clean'), v('undetermined')])
  if (onlyUndetermined.exit !== 2) throw new Error('有未判定必须 exit 2(不出合格证)')
  const weird = GATE.aggregate([v('nonsense')])
  if (weird.exit !== 2 || weird.counts.undetermined !== 1)
    throw new Error('未知状态被静默算成了通过')
  if (GATE.aggregate([v('clean'), v('registered-only')]).exit !== 0)
    throw new Error('全绿 + 登记不判必须 exit 0')
})

// ── T5 真仓现读:结论与退出码同形 ──────────────────────────────────────────
test('T5 真 CLI --json 可 parse,且 exit 0 当且仅当"零漂移且零未判定"', () => {
  const r = runCli(['--check', '--json'])
  if (r.code > 2) throw new Error(`退出码越界(${r.code})—— 只允许 0/1/2`)
  const out = JSON.parse(r.stdout)
  if (!Array.isArray(out.verdicts) || !out.counts) throw new Error('JSON 形状不对')
  const expect = out.counts.drift > 0 ? 1 : out.counts.undetermined > 0 ? 2 : 0
  if (out.exit !== expect)
    throw new Error(`退出码与结论不同形:exit=${out.exit} vs ${JSON.stringify(out.counts)}`)
  if (out.exit !== r.code)
    throw new Error(`JSON 里的 exit 与实际退出码不一致(${out.exit}/${r.code})`)
  if (!/磁盘运行态/.test(String(out.face)))
    throw new Error('判定面必须显式声明(结论行不写明就是撒谎)')
  // 默认档连"值有多长"都不给:每个 drift 条目只能是 {key,kind}
  for (const v of out.verdicts) {
    for (const d of v.drift || []) {
      if (Object.keys(d).sort().join(',') !== 'key,kind') {
        throw new Error(`默认 JSON 泄漏了额外字段:${JSON.stringify(Object.keys(d))}`)
      }
    }
  }
  // 目标覆盖必须与登记表同形(少了目标 = 尺子被削)
  if (out.counts.targets !== GATE.MANAGED_TARGETS.length) {
    throw new Error(`目标数 ${out.counts.targets} ≠ 登记表 ${GATE.MANAGED_TARGETS.length}`)
  }
})

// ── T6 值不落任何出口(端到端金丝雀)──────────────────────────────────────
test('T6 备份里的金丝雀值,在任何档的输出与告警正文里都不得出现', () => {
  const CANARY = 'CANARY-do-not-leak-4f9c2b'
  const root = mkScratch('env-drift-canary-')
  try {
    const bdir = join(root, '.ihui-agent', 'env-backup')
    mkdirSync(bdir, { recursive: true })
    mkdirSync(join(root, 'apps', 'api'), { recursive: true })
    writeFileSync(
      join(bdir, 'api.env.before-canary.1'),
      `SMTP_PASS=${CANARY}\nDATABASE_URL=${CANARY}-db\n`,
      'utf8',
    )
    writeFileSync(join(root, 'apps', 'api', '.env'), 'SMTP_PASS=\n', 'utf8') // 一个空、一个整键缺失

    const out = GATE.analyze({ root, targets: [GATE.MANAGED_TARGETS[0]] })
    if (out.exit !== 1) throw new Error(`夹具必须判红,实得 exit=${out.exit}`)
    const flat = JSON.stringify(out) + GATE.render(out) + GATE.render(out, { verbose: true })
    if (flat.includes(CANARY)) throw new Error('值泄漏:默认/verbose 渲染或 JSON 里出现了凭据内容')
    if (/backupLen/.test(JSON.stringify(GATE.stripLens(out))))
      throw new Error('stripLens 后仍有长度字段')

    // CLI 面同样验一遍(它才是守护真正调的那条出口)
    const cli = runCli(['--check', '--json', '--root', root])
    if (cli.code !== 1) throw new Error(`CLI 夹具应 exit 1,实得 ${cli.code}`)
    if (cli.stdout.includes(CANARY)) throw new Error('CLI 输出泄漏值')
    const cliText = runCli(['--check', '--verbose', '--root', root]).stdout
    if (cliText.includes(CANARY)) throw new Error('--verbose 也不得泄漏值(它只加长度)')
    if (!/备份长度 \d+/.test(cliText))
      throw new Error('--verbose 档的长度档没生效(判据与出口对不上)')

    // 告警正文的形状锁:守护那侧只准拼 key/kind,不准碰长度与值
    const g = readFileSync(GUARDIAN, 'utf8')
    const body = g.slice(
      g.indexOf('function envDriftDetail('),
      g.indexOf('\n}\n', g.indexOf('function envDriftDetail(')),
    )
    if (body.length < 40) throw new Error('找不到 envDriftDetail 函数体(形状锁失效)')
    if (/backupLen/.test(body)) throw new Error('告警正文里出现了长度字段(非 verbose 也不该给)')
    if (/readFileSync|values\.get\(/.test(body)) throw new Error('告警正文自己回去读值 ⇒ 泄漏面')
  } finally {
    rmScratch(root)
  }
})

// ── T7 空对照面不得冒充通过 ────────────────────────────────────────────────
test('T7 指向空目录 ⇒ 逐条未判定 + exit 2,绝不报"一切正常"', () => {
  const root = mkScratch('env-drift-empty-')
  try {
    const r = runCli(['--check', '--json', '--root', root])
    if (r.code !== 2) throw new Error(`空目录必须 exit 2(无法判定),实得 ${r.code}`)
    const out = JSON.parse(r.stdout)
    if (out.counts.clean !== 0) throw new Error('无现文件却判了 clean')
    const judged = out.verdicts.filter((v) => v.state !== 'registered-only')
    if (!judged.length) throw new Error('一条都没判 ⇒ 空扫冒充通过')
    if (judged.every((v) => v.state === 'undetermined')) return
    throw new Error('未判定与裁决混计')
  } finally {
    rmScratch(root)
  }
})

// ── T8 判据本体不许被"放宽"消红(反向锁)──────────────────────────────────
test('T8 备份里本就为空的键不得算漂移;现文件同值为空也不算', () => {
  const bak = GATE.parseEnvText('A=\nB=   \nC=1\n').values
  const cur = GATE.parseEnvText('A=\nB=\n').values
  const d = GATE.diffAgainstBackup({ backupValues: bak, currentValues: cur })
  if (d.length !== 1 || d[0].key !== 'C') throw new Error(`只该报 C,实得 ${JSON.stringify(d)}`)
  if (GATE.isBlankValue('  \t ') !== true || GATE.isBlankValue('x') !== false) {
    throw new Error('判空口径漂了(§5d 只写值为空的键)')
  }
  // 整键缺失与值为空两型都得报(判据不得只认其中一型 —— 本仓最高频的洞就是"一条门只管自己立项那一型")
  const d2 = GATE.diffAgainstBackup({
    backupValues: GATE.parseEnvText('GONE=1\n').values,
    currentValues: new Map(),
  })
  if (d2.length !== 1 || d2[0].kind !== 'missing') throw new Error('整键缺失那一型没被看见')
})

// ── T9 到人那一侧的分流(用假派发器,绝不真发信)───────────────────────────
test('T9 守护层:漂移/未判定各自成一条 alert;全绿不发信;尺子坏了也喊', () => {
  const calls = []
  const notify = (name, detail, opts) => {
    calls.push({ name, detail, opts })
    return { sent: true, why: 'fake' }
  }
  const logs = []
  const logger = (m) => logs.push(m)
  const verdict = (state, extra = {}) => ({
    id: 'apps/api/.env',
    state,
    reason: extra.reason || 'r',
    currentPath: '/p/.env',
    backup: state === 'drift' ? { name: 'api.env.before-x.1', mtimeMs: 1 } : undefined,
    drift: state === 'drift' ? [{ key: 'SMTP_PASS', kind: 'empty', backupLen: 12 }] : [],
    counts: { backupKeys: 1, currentKeys: 1, drift: 0, retired: 0 },
  })
  const payload = (counts, verdicts) =>
    JSON.stringify({ face: '磁盘运行态', backupDir: '/b', counts, verdicts })

  // ① 漂移 ⇒ 一条 alert,severity critical,正文点名键名、不点名长度
  calls.length = 0
  let r = GUARD.auditEnvDrift({
    notify,
    logger,
    run: () => ({
      code: 1,
      stdout: payload(
        { targets: 1, drift: 1, driftKeys: 1, undetermined: 0, clean: 0, registeredOnly: 0 },
        [verdict('drift')],
      ),
    }),
  })
  if (r.state !== 'drift') throw new Error(`判据红却分流成 ${r.state}`)
  if (calls.length !== 1 || !calls[0].name.startsWith('.env'))
    throw new Error(`漂移必须发一条 .env* alert:${JSON.stringify(calls.map((c) => c.name))}`)
  if (calls[0].opts?.severity !== 'critical') throw new Error('凭据面漂移不该是默认 severity')
  if (!calls[0].detail.includes('SMTP_PASS'))
    throw new Error('alert 正文没点名漂移的键 ⇒ 收到信的人不知道该修什么')
  if (/backupLen/.test(calls[0].detail)) throw new Error('alert 正文不该带值长度')

  // ② 未判定 ⇒ 另一条 alert 身份(窗口各自去重,绝不与"漂移"共用一个名字)
  calls.length = 0
  r = GUARD.auditEnvDrift({
    notify,
    logger,
    run: () => ({
      code: 2,
      stdout: payload(
        { targets: 1, drift: 0, driftKeys: 0, undetermined: 1, clean: 0, registeredOnly: 0 },
        [verdict('undetermined', { reason: '无同目标备份' })],
      ),
    }),
  })
  if (r.state !== 'undetermined' || calls.length !== 1)
    throw new Error(`未判定必须另发一条:${JSON.stringify(calls)}`)
  if (calls[0].name === 'x' || !/未判定/.test(calls[0].name))
    throw new Error('alert 身份必须与"漂移"分开')

  // ③ 全绿 ⇒ 一条都不发(否则每 2 分钟一封,等于把去重窗口当垃圾用)
  calls.length = 0
  logs.length = 0
  r = GUARD.auditEnvDrift({
    notify,
    logger,
    run: () => ({
      code: 0,
      stdout: payload(
        { targets: 1, drift: 0, driftKeys: 0, undetermined: 0, clean: 1, registeredOnly: 0 },
        [verdict('clean')],
      ),
    }),
  })
  if (r.state !== 'clean' || calls.length !== 0 || logs.length !== 0) {
    throw new Error(
      `全绿必须既不发信也不写日志(健康轮次保持安静):state=${r.state} calls=${calls.length} logs=${logs.length}`,
    )
  }

  // ④ 尺子坏了(输出不是 JSON / 文件不在位)⇒ 必须喊,不得静默
  calls.length = 0
  GUARD.auditEnvDrift({ notify, logger, run: () => ({ code: 2, stdout: 'not json at all' }) })
  if (calls.length !== 1) throw new Error('尺子坏了却一声不响 ⇒ 故障形态又变回"安静"')
  calls.length = 0
  GUARD.auditEnvDrift({ notify, logger, run: () => ({ missing: true, code: 2, stdout: '' }) })
  if (calls.length !== 1) throw new Error('判据被摘线却不喊 ⇒ 摘线本身成了隐形事件')

  // ⑤ 退出码与结论不符(尺子自报 0 漂移却 exit 1)⇒ 也喊,不得当成"没有漂移"
  calls.length = 0
  r = GUARD.auditEnvDrift({
    notify,
    logger,
    run: () => ({
      code: 1,
      stdout: payload(
        { targets: 1, drift: 0, driftKeys: 0, undetermined: 0, clean: 1, registeredOnly: 0 },
        [verdict('clean')],
      ),
    }),
  })
  if (r.state !== 'inconsistent' || calls.length !== 1)
    throw new Error('矛盾结论必须点名,不能被读成绿')
})

test('T10 alert 正文的唯一拼装处:只拼键名,绝不回读值', () => {
  const src = readFileSync(GUARDIAN, 'utf8')
  const start = src.indexOf('function envDriftDetail(')
  const body = src.slice(start, src.indexOf('\n}\n', start))
  if (body.length < 40) throw new Error('找不到 envDriftDetail(形状锁失效)')
  if (/backupLen/.test(body)) throw new Error('正文里出现长度字段')
  if (/readFileSync|values\.get\(/.test(body)) throw new Error('正文自己回去读值 ⇒ 泄漏面')
  if (!/d\.key/.test(body)) throw new Error('正文没点名键名 ⇒ 收到信的人不知道该修什么')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
