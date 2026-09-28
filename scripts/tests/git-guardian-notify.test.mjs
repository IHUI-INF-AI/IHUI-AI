// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// git-guardian 通知层(判红 → 邮件到人)镜像测试(§22c:import 源模块的 __test__,零复制实现)。
//
// 立因:守护此前没有任何到人出口 —— "合并吞并对账"抓到 38 个路径被合并抹掉那类红只写进
// .workbuddy/git-guardian.log,只有翻日志的人知道,而其后果是已入库功能被静默回滚。
// 本测试钉住通知层的**行为契约**,而不是它"存在":
//   ① 去重正反成对:同指纹窗口内只发一次 / 窗口过期再发 / 不同指纹各发一次 / 指纹对数字与
//      sha 归一(实时计数波动不得变成新一轮轰炸);
//   ② 失败必须响:dispatch 抛异常 → notifyGuardRed 不得外抛(守护崩了比不发邮件严重得多)、
//      写 UNDELIVERED 标记、退避后重试、下次成功自动清除标记;
//   ③ 状态文件损坏退回空表不抛(宁可多发一封,绝不让通知层带崩自愈流程);
//   ④ argv 契约:多行中文走 --message-file、绝不带 --env-file(tsx v4 劫持坑,§5e);
//   ⑤ 装车证明:三个判红点(合并吞并/家目录改道/恢复源)的函数体内真的调了 notifyGuardRed,
//      派生带 windowsHide+timeout,--notify-test 入口在 main 里真实存在 —— 防"判据存在但
//      永不被调用"(守门 70/76 的教训)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as N } from '../git-guardian.mjs'

const WINDOW = 4 * 60 * 60 * 1000
const FAIL_CD = 30 * 60 * 1000

/** 每例独立:临时状态/标记文件 + 计数的假派发器 + 吞掉的日志 */
function harness(dispatchImpl) {
  const dir = mkScratch('gg-notify-')
  const calls = []
  const lines = []
  const dispatch = (arg) => {
    calls.push(arg)
    return dispatchImpl ? dispatchImpl(arg) : { ok: true, why: '已送达' }
  }
  return {
    dir,
    calls,
    lines,
    stateFile: join(dir, 'state.json'),
    undelFile: join(dir, 'UNDELIVERED.json'),
    opts: { dispatch, stateFile: join(dir, 'state.json'), undelFile: join(dir, 'UNDELIVERED.json'), logger: (l) => lines.push(l) },
  }
}

// ── ① 指纹与去重窗口 ──────────────────────────────────────────────────────────

test('指纹对数字/哈希归一:计数与 sha 波动属同一故障,不构成新一轮轰炸', () => {
  const a = N.alertFingerprint('合并吞并对账判红', '抹掉 38 个路径 → 9f2ab1c0deadbeef 旧基线')
  const b = N.alertFingerprint('合并吞并对账判红', '抹掉 39 个路径 → 1a2b3c4d5e6f7a8b 旧基线')
  assert.equal(a, b, '数字/sha 变而语义未变 ⇒ 同指纹(否则每 2 分钟一趟就是每 2 分钟一封)')
})

test('指纹区分故障身份:name 变、非数字语义变都必须算新故障', () => {
  const base = N.alertFingerprint('恢复源刷新失败', '刷新 exit 1 ⇒ 落后于 main')
  assert.notEqual(N.alertFingerprint('恢复源刷新失败', '刷新 exit 1 ⇒ 磁盘满'), base, '正文语义变 = 故障演化')
  assert.notEqual(N.alertFingerprint('家目录改道仍判红', '刷新 exit 1 ⇒ 落后于 main'), base, 'alert 名是去重身份的一半')
})

test('shouldAlert:无记录发;同指纹已送达在窗口内压住、过期再发(正反成对)', () => {
  const fp = 'f1'
  const now = 1_000_000
  assert.equal(N.shouldAlert({}, 'k', fp, now, { windowMs: WINDOW, failCooldownMs: FAIL_CD }), true)
  const sent = { k: { fp, ts: now, delivered: true } }
  assert.equal(N.shouldAlert(sent, 'k', fp, now + WINDOW - 1, { windowMs: WINDOW, failCooldownMs: FAIL_CD }), false, '窗口内同因不重发')
  assert.equal(N.shouldAlert(sent, 'k', fp, now + WINDOW + 1, { windowMs: WINDOW, failCooldownMs: FAIL_CD }), true, '去重只去"重复",不去"还在发生" ⇒ 过期必须重发')
})

test('shouldAlert:指纹变化 = 新故障,立即发不等窗口', () => {
  const state = { k: { fp: 'old', ts: 100, delivered: true } }
  assert.equal(N.shouldAlert(state, 'k', 'new', 101, { windowMs: WINDOW, failCooldownMs: FAIL_CD }), true)
})

test('shouldAlert:未送达按失败退避(窗口内 false / 超退避 true),与已送达判据分轨', () => {
  const now = 5_000_000
  const state = { k: { fp: 'f', ts: now, delivered: false } }
  assert.equal(N.shouldAlert(state, 'k', 'f', now + FAIL_CD - 1, { windowMs: WINDOW, failCooldownMs: FAIL_CD }), false)
  assert.equal(N.shouldAlert(state, 'k', 'f', now + FAIL_CD + 1, { windowMs: WINDOW, failCooldownMs: FAIL_CD }), true)
})

test('withAlertMark 返回新对象,不改入参(状态表读写不得有共享可变引用)', () => {
  const before = { k: { fp: 'a', ts: 1, delivered: true } }
  const after = N.withAlertMark(before, 'k', 'b', 2, false)
  assert.deepEqual(before.k, { fp: 'a', ts: 1, delivered: true })
  assert.deepEqual(after.k, { fp: 'b', ts: 2, delivered: false })
})

test('notifyGuardRed:同指纹窗口内只发一次(第二轮被压住)', () => {
  const h = harness()
  const r1 = N.notifyGuardRed('合并吞并对账判红', '丢失 38 个路径', { ...h.opts, now: 1000 })
  const r2 = N.notifyGuardRed('合并吞并对账判红', '丢失 38 个路径', { ...h.opts, now: 1000 + 60_000 })
  assert.equal(r1.sent, true)
  assert.equal(r2.sent, false)
  assert.equal(r2.suppressed, true)
  assert.equal(h.calls.length, 1, '同因 2 分钟一轮 × 窗口内 ⇒ 只允许一次派发')
  rmScratch(h.dir)
})

test('notifyGuardRed:窗口过期后同一故障再发一封(绝不因去转而静默)', () => {
  const h = harness()
  N.notifyGuardRed('恢复源刷新失败', 'exit 1', { ...h.opts, now: 0, windowMs: WINDOW, failCooldownMs: FAIL_CD })
  const r = N.notifyGuardRed('恢复源刷新失败', 'exit 1', { ...h.opts, now: WINDOW + 1000, windowMs: WINDOW, failCooldownMs: FAIL_CD })
  assert.equal(r.sent, true)
  assert.equal(h.calls.length, 2)
  rmScratch(h.dir)
})

test('notifyGuardRed:不同故障(不同 name 或不同内容)各发各的,互不压制', () => {
  const h = harness()
  N.notifyGuardRed('合并吞并对账判红', '丢失 38 个路径', { ...h.opts, now: 5 })
  N.notifyGuardRed('家目录改道修复后仍判红', '冷却项 3 个', { ...h.opts, now: 6 })
  N.notifyGuardRed('合并吞并对账判红', '体检脚本自身 exit 2 不跑了', { ...h.opts, now: 7 })
  assert.equal(h.calls.length, 3)
  rmScratch(h.dir)
})

// ── ②③ 失败必须响 + 状态健壮性 ───────────────────────────────────────────────

test('notifyGuardRed:派发抛异常不外抛、写 UNDELIVERED 标记,退避后重试成功即清除标记', () => {
  const h = harness()
  // 直接注入会 throw 的派发器:第一次必炸,之后成功(证明"异常→标记→重试→清除"闭环)
  const boom = (arg) => {
    h.calls.push(arg)
    if (h.calls.length === 1) throw new Error('派发器炸了')
    return { ok: true, why: '已送达' }
  }
  const opts = { ...h.opts, dispatch: boom, windowMs: WINDOW, failCooldownMs: FAIL_CD }
  let r
  assert.doesNotThrow(() => {
    r = N.notifyGuardRed('恢复源刷新失败', 'exit 1', { ...opts, now: 0 })
  }, '发信异常绝不能打穿守护主流程')
  assert.equal(r.sent, false)
  assert.ok(existsSync(h.undelFile), '失败必须留可诊断痕迹(§5e),不得静默')
  const mark = JSON.parse(readFileSync(h.undelFile, 'utf8'))
  assert.equal(mark.name, '恢复源刷新失败')
  assert.match(mark.why, /派发器炸了/)
  // 退避窗内:不重敲
  const mid = N.notifyGuardRed('恢复源刷新失败', 'exit 1', { ...opts, now: FAIL_CD - 1 })
  assert.equal(mid.sent, false)
  // 超退避:重试成功 ⇒ 标记自动清除
  const again = N.notifyGuardRed('恢复源刷新失败', 'exit 1', { ...opts, now: FAIL_CD + 1 })
  assert.equal(again.sent, true)
  assert.ok(!existsSync(h.undelFile), '下一次成功投递必须清除 UNDELIVERED(§5e)')
  rmScratch(h.dir)
})

test('notifyGuardRed:状态文件损坏退回空表,照常判定发信而非抛', () => {
  const h = harness()
  writeFileSync(h.stateFile, '{坏掉的 json!!!', 'utf8')
  const r = N.notifyGuardRed('合并吞并对账判红', '丢失 12 个路径', { ...h.opts, now: 100 })
  assert.equal(r.sent, true)
  assert.equal(h.calls.length, 1)
  rmScratch(h.dir)
})

test('parseNotifyState:坏 JSON/数组/缺字段条目一律归一,绝不抛', () => {
  assert.deepEqual(N.parseNotifyState('not json'), {})
  assert.deepEqual(N.parseNotifyState('[]'), {})
  assert.deepEqual(N.parseNotifyState(''), {})
  assert.deepEqual(N.parseNotifyState('["a"]'), {})
  const ok = N.parseNotifyState('{"k":{"fp":"f","ts":1,"delivered":true},"bad":123,"noTs":{"fp":"f"}}')
  assert.deepEqual(Object.keys(ok), ['k'])
  assert.deepEqual(ok.k, { fp: 'f', ts: 1, delivered: true })
})

// ── ④ 派发 argv 契约(§5e 硬约束) ───────────────────────────────────────────

test('buildGuardMailArgv:唯一出口是品牌派发器,--message-file/--strict/--source 齐备,绝不带 --env-file', () => {
  const argv = N.buildGuardMailArgv({ to: 'a@b.c', title: 't', severity: 'critical', messageFile: 'm.txt' })
  assert.ok(argv[1].replaceAll('\\', '/').endsWith('apps/api/scripts/notify-deploy-failure.ts'))
  assert.ok(argv.includes('--message-file'), '多行中文正文不得走命令行参数(GBK 代码页坑)')
  assert.ok(argv.includes('--strict'), '据 exit 0/1 写/清 UNDELIVERED 标记')
  assert.ok(argv.includes('git-guardian'), '--source 必须可归因到本守护')
  assert.ok(!argv.some((a) => String(a).includes('env-file')), '--env-file 会遭 tsx v4 劫持转发给 node(路径不存在 exit 9,实测坑)')
  assert.ok(!N.buildGuardMailArgv({ to: 'a@b.c', title: 't', severity: 'info', messageFile: 'm' }).includes('--dry-run'))
  assert.ok(N.buildGuardMailArgv({ to: 'a@b.c', title: 't', severity: 'info', messageFile: 'm', dryRun: true }).includes('--dry-run'))
})

test('maskEmail / redactChildOutput / judgeDryRunChannel:脱敏与通道判定', () => {
  assert.equal(N.maskEmail('abc@qq.com'), 'a***@qq.com')
  assert.equal(N.maskEmail(''), '***')
  const red = N.redactChildOutput('RESEND_API_KEY=sk-live-supersecret\nplain diag line')
  assert.ok(!red.includes('supersecret'), '子进程崩溃可能把 .env 片段倒进 stderr,值永不落地')
  assert.ok(red.includes('RESEND_API_KEY=***'), '键名保留,诊断仍读得懂')
  assert.equal(N.judgeDryRunChannel('[dry-run] 通道判定 SMTP: 可用'), true)
  assert.equal(N.judgeDryRunChannel('通道判定 SMTP: 不可用'), false)
})

test('resolveAlertTo:进程 env 优先(§5e 收件人唯一权威 = apps/api/.env 的 ALERT_EMAIL_TO)', () => {
  const keep = process.env.ALERT_EMAIL_TO
  try {
    process.env.ALERT_EMAIL_TO = 'ops@example.test'
    assert.equal(N.resolveAlertTo(), 'ops@example.test')
  } finally {
    if (keep === undefined) delete process.env.ALERT_EMAIL_TO
    else process.env.ALERT_EMAIL_TO = keep
  }
})

test('显式开关只关"要不要发"(GIT_GUARDIAN_NOTIFY_DISABLED),不存在任何"发几封"的总量闸', () => {
  const keep = process.env.GIT_GUARDIAN_NOTIFY_DISABLED
  const h = harness()
  try {
    process.env.GIT_GUARDIAN_NOTIFY_DISABLED = '1'
    const off = N.notifyGuardRed('恢复源刷新失败', 'exit 1', { ...h.opts, now: 0 })
    assert.equal(off.sent, false)
    assert.equal(h.calls.length, 0)
  } finally {
    if (keep === undefined) delete process.env.GIT_GUARDIAN_NOTIFY_DISABLED
    else process.env.GIT_GUARDIAN_NOTIFY_DISABLED = keep
  }
  const on = N.notifyGuardRed('恢复源刷新失败', 'exit 1', { ...h.opts, now: 0 })
  assert.equal(on.sent, true)
  assert.equal(h.calls.length, 1, '开关解除后立即恢复投递(默认面零封顶,第 4 封照发)')
  const more = N.notifyGuardRed('恢复源刷新失败', 'exit 1', { ...h.opts, now: 25 * WINDOW })
  assert.equal(more.sent, true, '跨天继续按窗口重发 ⇒ 不存在"每日 N 封"计数闸')
  rmScratch(h.dir)
})

test('force(人工 --notify-test 面):绕过当轮去重,且不污染/不抢占真实状态', () => {
  const h = harness()
  N.notifyGuardRed('合并吞并对账判红', '丢失 38 个路径', { ...h.opts, now: 0 })
  const r = N.notifyGuardRed('合并吞并对账判红', '丢失 38 个路径', { ...h.opts, now: 10, force: true })
  assert.equal(r.sent, true)
  assert.equal(h.calls.length, 2, '同窗口二次调用:第一次记账被压,force 必须真发')
  const state = JSON.parse(readFileSync(h.stateFile, 'utf8'))
  assert.equal(state['合并吞并对账判红'].ts, 0, 'force 不得改写状态(一次手工测试不许抢占故障通知窗口)')
  rmScratch(h.dir)
})

// ── ⑤ 装车证明:判红点真的接线(防"判据存在但永不被调用",守门 70/76 教训) ────

/** 取函数体(按大括号配平,与 git-guardian-drift-align.test.mjs 同一手法) */
function funcBody(src, name) {
  const start = src.indexOf(`function ${name}(`)
  assert.ok(start >= 0, `源文件里找不到 ${name}()`)
  const open = src.indexOf('{', start)
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1)
  }
  assert.fail(`${name}() 花括号未配平`)
}

test('装车证明:三类"只有守护看得见"的红都真接了 notifyGuardRed', () => {
  const src = readFileSync(new URL('../git-guardian.mjs', import.meta.url), 'utf8')
  assert.match(funcBody(src, 'auditMergeAdditionLoss'), /notifyGuardRed\(\s*\n?\s*'合并吞并对账判红/)
  assert.match(funcBody(src, 'auditMergeAdditionLoss'), /notifyGuardRed\([\s\S]*?合并吞并对账自身异常/)
  assert.match(funcBody(src, 'healHomeJunctions'), /notifyGuardRed\(\s*\n?\s*'家目录改道修复后仍判红/)
  assert.match(funcBody(src, 'refreshRecoverySource'), /notifyGuardRed\(\s*\n?\s*'本地恢复源刷新失败/)
})

test('装车证明:派生带 windowsHide+timeout;main 里有 --notify-test/--notify-dry-run 入口;--status 显示通知层', () => {
  const src = readFileSync(new URL('../git-guardian.mjs', import.meta.url), 'utf8')
  // dispatchGuardMail 的参数解构 `{ title, ...` 会让 funcBody 取错起点,这里按"到下一个函数"切段
  const dStart = src.indexOf('function dispatchGuardMail')
  const body = src.slice(dStart, src.indexOf('function readNotifyText', dStart))
  assert.ok(dStart > 0 && body.length > 100, '找不到 dispatchGuardMail 段')
  assert.match(body, /windowsHide:\s*true/, '漏 windowsHide ⇒ 计划任务/守护下必弹控制台窗(§5b)')
  assert.match(body, /timeout:\s*NOTIFY_DISPATCH_TIMEOUT_MS/, '派发必须封顶(守门 80 同族)')
  assert.match(body, /messageFile:\s*msgFile/, '正文以文件传入派发器(--message-file 契约在 argv 测试钉)')
  assert.match(funcBody(src, 'main'), /'--notify-test'/)
  assert.match(funcBody(src, 'main'), /'--notify-dry-run'/)
  assert.match(funcBody(src, 'status'), /notify:\s*notifySummary\(\)/, '--status 必须如实显示通知层状态')
})

// ── 基线新鲜度探针:失败必须带原因(2026-09-27 值守补) ─────────────────────
test(
  '形状锁:基线新鲜度探针失败时要把 stderr/退出码写进日志,不得再退回"未判定"一句空话',
  () => {
    const src = readFileSync(new URL('../git-guardian.mjs', import.meta.url), 'utf8')
    const start = src.indexOf('function reportBaselineFreshness')
    const body = src.slice(start, src.indexOf('\nfunction ', start + 10))
    assert.ok(start > 0 && body.length > 400, '找不到 reportBaselineFreshness 段')
    // ① stderr 必须被接管:第三项若是 'ignore',这条"未判定"就永远答不出为什么(实测静默了 517 条)
    assert.match(
      body,
      /stdio:\s*\[\s*'ignore',\s*'pipe',\s*'pipe'\s*\]/,
      '探针的 stderr 又被丢回 ignore ⇒ 未判定重新变成无原因',
    )
    // ② 结论行必须真把原因插进去(只捕获不打印 = 与丢弃等价)
    assert.match(body, /未判定[^`]*\$\{why/, '日志行必须插入 why,不得写死一句定文案')
    // ③ 派生失败与"输出不是 JSON"要分开归因(否则下次仍要人猜是哪一段坏了)。
    //    2026-09-27 起归因搬进 readProbeVerdict(见下方 V 组),本段只锁"调用点确实委托给它"
    //    与"函数里两型各有一条出口"—— 委托掉不算丢,写死在调用点也不算多。
    assert.match(body, /readProbeVerdict\(\s*\{\s*status,\s*stdout,\s*stderr\s*\}\s*\)/, '结论判读必须走那把纯函数,不得在调用点各写一遍')
    assert.doesNotMatch(body, /探针派生失败/, '调用点不得再自带归因文案(有第二份真相 = 必漂移)')
    //    注意:funcBody() 取的是"名字后第一个 {"，对带解构形参的函数会正好截到形参那对
    //    花括号(本例第一版就是这么红的)，所以这里改用与 body 同法的行首 `\n}` 切片。
    const vStart = src.indexOf('export function readProbeVerdict(')
    assert.ok(vStart > 0, '找不到 readProbeVerdict 段')
    const vsrc = src.slice(vStart, src.indexOf('\n}\n', vStart) + 1)
    assert.ok(vsrc.length > 300, `readProbeVerdict 取面过短(${vsrc.length}) ⇒ 切片判据失效,不得当作通过`)
    assert.match(vsrc, /探针未产出 stdout/, '要有"探针没跑起来"这一归因分支')
    assert.match(vsrc, /输出不是 JSON/, '要有"输出不是 JSON"这一归因分支')
    // ④ 继承既有的遮噪/护栏,不得在补诊断时顺手丢掉
    assert.match(body, /windowsHide:\s*true/, '漏 windowsHide ⇒ 守护下必弹控制台窗(§5b)')
    assert.match(body, /timeout:\s*240000/, '热路径派生必须封顶(守门 80 同族)')
  },
)

// ── 探针"退出码 1 但结论在 stdout"必须被采用(2026-09-27 值守补) ──────────
// 立因:轴①②判红时探针 exit(1),而整份结论在 stdout 的 JSON 里。旧实现只走成功分支 ⇒
// execFileSync 抛异常 ⇒ stdout 整块丢弃 ⇒ 日志写"账不可用:未判定"。实测现读:便宜档
// rc=1、stdout 1530 B 合法 JSON、upstream=red/behind=3 —— 守护每逢它报出最响的一条结论
// 就把那条结论扔掉,而"本地落后主线"恰是值守最该先看的一维。
const VERDICT_JSON = JSON.stringify({ code: 1, axes: { upstream: { status: 'red', behind: 3 } } })

test('V1b 真判据:同一份 JSON 在 rc=1 下必须解析出 axes', () => {
  const r = N.readProbeVerdict({ status: 1, stdout: VERDICT_JSON, stderr: '' })
  assert.ok(r.parsed, 'rc=1 + 合法 JSON 必须采用结论,why 应为空')
  assert.equal(r.why, null, '采用结论时不得再带"未判定"原因')
  assert.equal(r.parsed.axes.upstream.behind, 3)
})
test('V2 stdout 为空 ⇒ 未判定且点名 rc/stderr(不得静默)', () => {
  const r = N.readProbeVerdict({ status: 1, stdout: '', stderr: 'boom' })
  assert.equal(r.parsed, null)
  assert.match(r.why, /探针未产出 stdout/)
  assert.match(r.why, /rc=1/)
  assert.match(r.why, /boom/, 'stderr 必须进原因,否则又是一条无人能答为什么的未判定')
})
test('V3 spawn 失败(status 取不到)⇒ 未判定,rc 位置写 ?', () => {
  const r = N.readProbeVerdict({ status: null, stdout: '', stderr: '' })
  assert.equal(r.parsed, null)
  assert.match(r.why, /rc=\?/)
  assert.match(r.why, /stderr=\(空\)/, '空 stderr 要如实写成(空),不得留白让人以为被截断')
})
test('V4 stdout 有内容但不是 JSON ⇒ 归因为"输出不是 JSON",与 V2 分开', () => {
  const r = N.readProbeVerdict({ status: 0, stdout: 'not json at all', stderr: '' })
  assert.equal(r.parsed, null)
  assert.match(r.why, /输出不是 JSON/)
})
test('V5 顶层是数组也不算结论(旧实现会把 [..] 当 parsed 用而 axes 全 undefined)', () => {
  const r = N.readProbeVerdict({ status: 0, stdout: '[1,2,3]', stderr: '' })
  assert.equal(r.parsed, null)
  assert.match(r.why, /顶层不是对象/)
})
test('V6 真探针端到面:把现读那把 rc=1 的 stdout 喂给判读器,必须拿回"落后 N"', () => {
  // 阳性对照 —— 判据失效的表现永远是安静,所以这里不吃构造面,直接派生真探针。
  // 它可能此刻是绿的(落后 0),因此只断言"parsed 非空 + axes 形状齐",不断言 red。
  const out = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL('../check-baseline-freshness.mjs', import.meta.url)),
      '--json',
      '--no-fetch',
      '--skip-drift-analysis',
    ],
    {
      encoding: 'utf8',
      cwd: fileURLToPath(new URL('../../', import.meta.url)),
      windowsHide: true,
      timeout: 240000,
    },
  )
  const r = N.readProbeVerdict({ status: out.status, stdout: out.stdout, stderr: out.stderr })
  assert.ok(r.parsed, `真探针 rc=${out.status} 的结论被丢了:${r.why}`)
  assert.ok(r.parsed.axes && typeof r.parsed.axes === 'object', 'axes 必须在位')
})

