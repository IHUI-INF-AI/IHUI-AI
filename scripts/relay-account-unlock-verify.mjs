#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 收口工具需要输出诊断信息 */
/**
 * 号池解锁收口校验(relay-account-unlock-verify.mjs,2026-11-06 立,归票 S-28)
 *
 * 补的缺口:S-28 那型「死号等机主手机验证码重登 / 新建 API key」过去整条看起来像在等人,
 * 因为"凭据到位之后要做完哪几步、每步成败如何听见"没有人折成一条命令。本器只做**编排 +
 * 池面收口判定**:
 *   ① 跑既有闭口出口(不新写第二份落库腿,AGENTS §0.6):
 *      minimax ⇒ scripts/sync-minimax-client-session.mjs --json [--uid=](票面点名的回灌腿)
 *      opencode ⇒ scripts/relay-account-pool.mjs --file <机主自备文件> --provider opencode [--owner]
 *   ② 跑既有只读名单出口 apps/api/scripts/relay-pool-account-list.ts --provider <p> --json;
 *   ③ 对池行下结论:新票在位(未过期/健康非 down)才算收口;旧票仍在、闭口命令本身失败、
 *      池内查无此号 ⇒ 具名拒绝(失败必响,绝不静默,§0.10)。
 *
 * 红线(本票明文):
 *   - 绝不代取凭据:CDP/页面求值/剪贴板/键鼠都不是授权通道,机主说"你去拿"也不算;
 *     本器不读任何浏览器/客户端凭据面,只消费既有脚本的退出码与脱敏投影。
 *   - 输出永不回显令牌(名单腿自己有 SAFE_COLUMN_KEYS 形状锁,本器只转述 uid/健康/到期)。
 *   - 不写库、不写盘;唯一的"写"都发生在被编排的既有闭口命令内部,其纪律不归本器重述。
 *
 * 退出码(三态绝不并桶):0 收口完成 / 1 具名拒绝(未收口) / 2 未判定(名单腿取不到输入)。
 * 用法:
 *   node scripts/relay-account-unlock-verify.mjs --provider minimax --uid <池行uid>
 *   node scripts/relay-account-unlock-verify.mjs --provider opencode --closure import --file keys.json [--owner <users.id>] [--old-uid <旧行uid>]
 *   node scripts/relay-account-unlock-verify.mjs --provider minimax --uid X --closure none   # 只验不重跑闭口
 *   node scripts/relay-account-unlock-verify.mjs --self-test
 */
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveTsxCli } from './lib/tsx-cli.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')

function parseArgs(argv) {
  const o = { provider: '', uid: '', closure: '', file: '', owner: '', oldUid: '', json: false, selfTest: false, error: null }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    const val = () => {
      const v = argv[i + 1] ?? ''
      if (!v || v.startsWith('--')) { o.error = `${a} 需要取值`; return '' }
      i += 1
      return v
    }
    if (a === '--json') o.json = true
    else if (a === '--self-test') o.selfTest = true
    else if (a === '--provider') o.provider = val()
    else if (a === '--uid') o.uid = val()
    else if (a === '--closure') o.closure = val()
    else if (a === '--file') o.file = val()
    else if (a === '--owner') o.owner = val()
    else if (a === '--old-uid') o.oldUid = val()
    else if (a.startsWith('--provider=')) o.provider = a.slice(11)
    else if (a.startsWith('--uid=')) o.uid = a.slice(6)
    else { o.error = `未支持参数:${a}` }
    if (o.error) return o
  }
  if (!o.provider) o.error = '--provider 必填(minimax|opencode|...)'
  if (!o.closure) o.closure = o.provider === 'minimax' ? 'sync' : o.provider === 'opencode' ? 'import' : 'none'
  if (o.closure === 'import' && !o.file) o.error = '闭口=import 需要 --file <机主自备账号 JSON>(本器不代取凭据)'
  return o
}

const pick = (row, keys) => {
  for (const k of keys) if (row[k] !== undefined && row[k] !== null) return row[k]
  return null
}
const toMs = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (Number.isFinite(n) && n > 0) return n > 1e11 ? n : n * 1000
  const t = Date.parse(String(v))
  return Number.isFinite(t) ? t : null
}

/**
 * 纯函数收口判据(测试直接 import 用,§22c;判据就这一份,CLI 与自测同源)。
 * rows: 池行投影数组;返回 {verdict:'closed'|'refused'|'undetermined', reasons:[具名], notes:[]}
 */
export function verdict({ rows, uid, closureRc, oldUid, now = Date.now() }) {
  const reasons = []
  const notes = []
  if (!Array.isArray(rows)) return { verdict: 'undetermined', reasons: ['名单腿输出取不到(未判定,不记绿)'], notes }
  if (rows.length === 0)
    return { verdict: 'refused', reasons: ['该 provider 在池内枚数为 0 —— 枚举到 0 不结清,先把号入池(既有 relay-account-pool.mjs 导入腿)'], notes }
  if (closureRc !== null && closureRc !== 0)
    return { verdict: 'refused', reasons: [`闭口命令本身退出码=${closureRc}(失败必响):回灌/导入未落地,池面结论不采信`], notes }
  const target = uid ? rows.find((r) => String(r.uid) === String(uid)) : rows[0]
  if (!target) return { verdict: 'refused', reasons: [`池内点名未命中:uid=${uid}(现读 uid 清单:${rows.map((r) => r.uid).join(', ')})`], notes }
  const expiry = toMs(pick(target, ['tokenExpiresAt', 'expiresAt', 'tokenExpires', 'accessTokenExpiresAt']))
  const health = String(pick(target, ['healthStatus', 'health']) ?? '')
  if (oldUid && rows.some((r) => String(r.uid) === String(oldUid)))
    reasons.push(`旧值行仍在池内并被接受位:uid=${oldUid}(解锁后旧票应退场——请走既有摘除/巡检重定级腿,勿留双行)`)
  if (health === 'down' || health === 'expired')
    reasons.push(`目标行健康态仍为 ${health}:新票未被确认接受(若刚重登完,先等 10 分钟巡检重定级或跑既有 relay:live-probe 实弹腿)`)
  else if (expiry !== null && expiry <= now)
    reasons.push(`目标行 token 已过期(expiry 早于当下):池内那枚还是旧死票,回灌未把新票送进来`)
  if (reasons.length) return { verdict: 'refused', reasons, notes }
  if (health === 'unknown' || health === '') notes.push('健康态=unknown:待巡检重定级(既有 relay-account-pool-worker 10 分钟腿),本器不代判上游实弹')
  return { verdict: 'closed', reasons: [], notes }
}

/** 名单腿可能先打横幅行(如 env 注入提示),JSON 恒在最后一整行:自尾向前找首个可解析数组/含 accounts 的对象。 */
export function extractJsonPayload(text) {
  const lines = String(text ?? '').split(/\r?\n/).filter((l) => l.trim())
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const l = lines[i].trim()
    if (!l.startsWith('[') && !l.startsWith('{')) continue
    try {
      const p = JSON.parse(l)
      if (Array.isArray(p)) return p
      if (Array.isArray(p?.accounts)) return p.accounts
      if (Array.isArray(p?.rows)) return p.rows
    } catch {
      /* 继续向前找 */
    }
  }
  return null
}

function closureArgv(o) {
  if (o.closure === 'none' || o.closure === '') return null
  if (o.closure === 'sync') {
    if (o.provider !== 'minimax') return { error: `闭口=sync 目前只对应 minimax 回灌腿(provider=${o.provider} 请用 import/none)` }
    const a = [path.join(HERE, 'sync-minimax-client-session.mjs'), '--json']
    if (o.uid) a.push(`--uid=${o.uid}`)
    return { cmd: process.execPath, args: a }
  }
  if (o.closure === 'import') {
    const a = [path.join(HERE, 'relay-account-pool.mjs'), '--file', o.file, '--provider', o.provider]
    if (o.owner) a.push('--owner', o.owner)
    return { cmd: process.execPath, args: a }
  }
  return { error: `未支持闭口档:${o.closure}(sync|import|none)` }
}

/** 真跑编排:闭口腿与名单腿都是**既有命令**,本器原样透传并只看退出码/脱敏输出。 */
export function defaultDeps() {
  const stdio = ['ignore', 'pipe', 'pipe'] // §12g
  return {
    runClosure(spec) {
      const r = spawnSync(spec.cmd, spec.args, { cwd: ROOT, windowsHide: true, stdio })
      return { rc: r.status ?? (r.error ? 2 : 2), tail: String(r.stdout ?? '').slice(-400) + String(r.stderr ?? '').slice(-400) }
    },
    runList(provider) {
      const tsx = resolveTsxCli(ROOT)
      if (!tsx) return { rc: 2, rows: null, why: '未判定:tsx 取不到(名单腿无法起跑)' }
      // 派生形态与已验证的 sync-minimax-client-session.mjs:136-144 同型:tsx 是 .mjs,
      // Windows 上不可直接 spawn(EFTYPE),必须把路径作为参数交给 node 本体。
      const r = spawnSync(process.execPath, [tsx, path.join(ROOT, 'apps', 'api', 'scripts', 'relay-pool-account-list.ts'), '--provider', provider, '--json'], {
        cwd: ROOT,
        windowsHide: true,
        stdio,
      })
      if ((r.status ?? 2) !== 0) return { rc: r.status ?? 2, rows: null, why: `名单腿 exit=${r.status}:` + String(r.stderr ?? '').slice(0, 200) }
      try {
        const rows = extractJsonPayload(String(r.stdout))
        return rows ? { rc: 0, rows } : { rc: 2, rows: null, why: '名单腿 stdout 里认不出 JSON 行数组(不猜形态)' }
      } catch (e) {
        return { rc: 2, rows: null, why: `名单腿输出解析失败(未判定):${e?.message ?? e}` }
      }
    },
  }
}

export function run(o, deps) {
  const D = deps ?? defaultDeps()
  let closureRc = null
  let closureTail = ''
  const spec = closureArgv(o)
  if (spec?.error) return { verdict: 'undetermined', reasons: [spec.error], notes: [], closureRc: null, closureTail: '' }
  if (spec) {
    const c = D.runClosure(spec)
    closureRc = c.rc
    closureTail = c.tail
  }
  const list = D.runList(o.provider)
  if (list.rc !== 0 && list.rows === null)
    return { verdict: 'undetermined', reasons: [list.why ?? `名单腿 exit=${list.rc}(取不到输入不记绿)`], notes: [], closureRc, closureTail }
  const v = verdict({ rows: list.rows, uid: o.uid, closureRc, oldUid: o.oldUid })
  return { ...v, closureRc, closureTail }
}

function exitOf(v) {
  return v.verdict === 'closed' ? 0 : v.verdict === 'refused' ? 1 : 2
}

// ── 离线自证:替身注入,不 spawn 任何真命令、不连库、不写盘 ──
function runSelfTest() {
  const out = []
  let failed = 0
  const ok = (n, c, x = '') => {
    out.push(`${c ? '✅' : '❌'} ${n}${x ? ` [${x}]` : ''}`)
    if (!c) failed += 1
  }
  const NOW = 1_800_000_000_000
  const future = NOW + 86400_000
  const past = NOW - 86400_000
  const deps = (rows, closureRc = 0) => ({ runClosure: () => ({ rc: closureRc, tail: 'fake' }), runList: () => ({ rc: 0, rows }) })
  const base = { provider: 'minimax', uid: 'u1', closure: 'sync', oldUid: '', json: true }
  const r1 = run(base, deps([{ uid: 'u1', healthStatus: 'ok', tokenExpiresAt: future }]))
  ok('S1 新票健康在位 ⇒ closed/exit 0', r1.verdict === 'closed' && exitOf(r1) === 0)
  const r2 = run(base, deps([{ uid: 'u1', healthStatus: 'down', tokenExpiresAt: past }]))
  ok('S2 旧死票仍在 ⇒ refused 且点名健康态', r2.verdict === 'refused' && r2.reasons.some((s) => s.includes('down')))
  const r3 = run(base, deps([{ uid: 'u1', healthStatus: 'ok', tokenExpiresAt: future }], 1))
  ok('S3 闭口命令失败 ⇒ refused(失败必响,不静默结清)', r3.verdict === 'refused' && r3.reasons[0].includes('退出码=1'))
  const r4 = run(base, { runClosure: () => ({ rc: 0, tail: '' }), runList: () => ({ rc: 2, rows: null, why: '连不上' }) })
  ok('S4 名单腿取不到 ⇒ undetermined/exit 2(不冒绿)', r4.verdict === 'undetermined' && exitOf(r4) === 2)
  const r5 = run(base, deps([]))
  ok('S5 池内 0 枚 ⇒ refused(枚举到 0 不结清)', r5.verdict === 'refused' && r5.reasons[0].includes('枚数为 0'))
  const r6 = run({ ...base, uid: 'nope' }, deps([{ uid: 'u1', healthStatus: 'ok', tokenExpiresAt: future }]))
  ok('S6 点名未命中 ⇒ refused 并现读清单', r6.verdict === 'refused' && r6.reasons[0].includes('u1'))
  const r7 = run({ ...base, oldUid: 'old9' }, deps([{ uid: 'u1', healthStatus: 'ok', tokenExpiresAt: future }, { uid: 'old9', healthStatus: 'down', tokenExpiresAt: past }]))
  ok('S7 --old-uid 旧行仍在 ⇒ refused(解锁后旧值应退场)', r7.verdict === 'refused' && r7.reasons.some((s) => s.includes('old9')))
  const r8 = run(base, deps([{ uid: 'u1', healthStatus: 'unknown', tokenExpiresAt: future }]))
  ok('S8 unknown 带注记放行(重定级归既有巡检腿,本器不代判)', r8.verdict === 'closed' && r8.notes.some((s) => s.includes('unknown')))
  const a = parseArgs(['--provider', 'opencode', '--closure', 'import'])
  ok('S9 import 档缺 --file 当场拒(不猜文件)', a.error !== null && a.error.includes('--file'))
  console.log(out.join('\n'))
  console.log(`SELF-TEST ${failed === 0 ? '通过' : '失败'}(${out.length} 条,失败 ${failed};全程替身注入,零 spawn/零连库/零写盘)`)
  process.exit(failed === 0 ? 0 : 1)
}

export const __test__ = { parseArgs, verdict, run, exitOf, toMs }

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const o = parseArgs(process.argv.slice(2))
  if (o.selfTest) {
    runSelfTest()
  } else if (o.error) {
    console.log(`⚠️ 未判定(参数:${o.error})`)
    process.exit(2)
  } else {
    const v = run(o)
    if (o.json) console.log(JSON.stringify({ verdict: v.verdict, reasons: v.reasons, notes: v.notes, closureRc: v.closureRc }))
    else {
      const head = { closed: '✅ 收口完成:池内该号已是新票且可被接受', refused: '❌ 拒绝结清(未收口,具名如下)', undetermined: '⚠️ 未判定(取不到输入,不记绿)' }[v.verdict]
      console.log(head)
      for (const s of v.reasons) console.log(`   - ${s}`)
      for (const s of v.notes) console.log(`   · ${s}`)
      if (v.verdict !== 'closed' && v.closureTail) console.log(`   闭口命令输出尾(不含凭据明文,既有腿自证):${v.closureTail.slice(0, 200)}`)
      console.log('   下一步:机主侧动作不变(手机验证码重登 mcode / 后台新建 OpenCode key 并放入本地文件),然后原样重跑本命令即可。')
    }
    process.exit(exitOf(v))
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
