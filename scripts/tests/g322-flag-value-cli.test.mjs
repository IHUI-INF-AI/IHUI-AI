// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-322「带值旗标吞掉紧邻旗标」CLI 端到端探针(2026-10-15 收口批)。
// 判据本体单源在 scripts/lib/flag-value.mjs(其语义档见 flag-value.test.mjs);
// 本文件只做端到端:各站 CLI 喂三支坏值,断言**各自**非零退出且输出点名实得 token。
// 正例(默认档行为逐字不变)由各站既有套件锁 —— 本文件不重复。
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const ROOT = resolve(import.meta.dirname, '..', '..')
const S = (name) => resolve(ROOT, 'scripts', name)

/** 三支坏值:args = 实际喂给 CLI 的参数;expect = 必须出现在输出里的实得 token 文案。 */
const BAD_ARMS = [
  { args: ['--root', '--staged'], expect: '"--staged"' },
  { args: ['--root'], expect: '(其后没有任何参数)' },
  { args: ['--root', ''], expect: '""' },
]

/** 三支坏值各自:rc 非零 + 输出点名 `--root 需要一个<noun>` + 点名实得 token。 */
function assertBadRoot(script, noun = '目录参数') {
  for (const { args, expect } of BAD_ARMS) {
    const r = spawnSync(process.execPath, [script, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.notEqual(r.status, 0, `${script} ${JSON.stringify(args)} 不得静默通过(普查 B 档那一型)`)
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
    assert.match(out, new RegExp(`--root 需要一个${noun}`), `${script} 必须点名用法:${out.slice(0, 200)}`)
    assert.match(
      out,
      new RegExp(expect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `${script} 必须点名实得 token(三态分开,只测一支会留洞):${out.slice(0, 200)}`,
    )
    assert.doesNotMatch(out, /ERR_INVALID_ARG_TYPE|at ModuleJob/, `${script} 不得以裸栈当用法错出口:${out.slice(0, 200)}`)
  }
}

test('G-322 收口批:六站三支坏值各自大声拒绝', () => {
  assertBadRoot(S('check-principal-consumed.mjs'))
  assertBadRoot(S('check-scratch-root-no-nesting.mjs'))
  assertBadRoot(S('check-workspace-hygiene.mjs'))
  assertBadRoot(S('scan-hardcoded-zh.mjs'))
  assertBadRoot(S('plan-tasks.mjs'))
})

test('G-322 第二批:七道 blocking 门三支坏值各自大声拒绝', () => {
  assertBadRoot(S('check-background-task-type-parity.mjs'))
  assertBadRoot(S('check-batch-write-count-honesty.mjs'))
  assertBadRoot(S('check-declared-policy-has-consumer.mjs'))
  assertBadRoot(S('check-doom-loop-parity.mjs'))
  assertBadRoot(S('check-glyph-arrow-icon.mjs'))
  assertBadRoot(S('check-mention-engine-wired.mjs'))
  assertBadRoot(S('check-prompt-injection-registry.mjs'))
})

test('G-322 第四批:九站 warn/手动档三支坏值各自大声拒绝', () => {
  assertBadRoot(S('check-plan-sha-resolvable.mjs'))
  assertBadRoot(S('check-package-barrel-export.mjs'))
  assertBadRoot(S('check-tool-registry-integrity.mjs'))
  assertBadRoot(S('provenance-ledger.mjs'))
  assertBadRoot(S('check-tool-arg-routing-identity.mjs'))
  assertBadRoot(S('check-tool-arg-validation-wired.mjs'))
  assertBadRoot(S('check-tool-family-registered.mjs'))
  assertBadRoot(S('check-shared-nonde-node-purity.mjs'))
  // check-public-exposure-list 的 --root 在函数里,坏值走 throw ⇒ 顶层 catch,同样非零点名。
  assertBadRoot(S('check-public-exposure-list.mjs'))
})

test('G-322 等号形态:gate-wiring / miniapp-generated 的 --root= 空值与裸位置参数各自拒绝', () => {
  const cases = [
    [S('check-gate-wiring.mjs'), ['--root='], /--root= 需要一个目录值/],
    [S('check-gate-wiring.mjs'), ['some-dir'], /未知的裸位置参数/],
    [S('check-miniapp-generated.mjs'), ['--root='], /--root= 需要一个目录值/],
    [S('check-miniapp-generated.mjs'), ['--root'], /--root 需要一个目录参数/],
  ]
  for (const [script, args, re] of cases) {
    const r = spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    assert.notEqual(r.status, 0, `${script} ${JSON.stringify(args)} 不得静默按 cwd 跑(旧写法 resolve('')=cwd)`)
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
    assert.match(out, re, `必须点名:${out.slice(0, 200)}`)
  }
})

test('G-322 收口批:module-context 的 --face/--policy 漏值与空串各自拒绝', () => {
  const script = S('module-context.mjs')
  // `--face/--policy --staged`(值被下一旗标顶掉)在更早的"未知开关"检查就已大声拒绝(既有 A 形态),
  // 这里只锁本票要修的另外两支:结尾无值 / 空串 —— 旧写法这两支都静默落默认档还报 ✅。
  for (const flag of ['--face', '--policy']) {
    for (const args of [[flag], [flag, '']]) {
      const r = spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      assert.notEqual(r.status, 0, `module-context ${JSON.stringify(args)} 不得静默落默认档`)
      const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
      assert.match(out, new RegExp(`${flag} 需要一个值`.replace(/-/g, '\\-')), out.slice(0, 200))
    }
  }
})

// ─── 第五批(2026-10-17)───
// 这三型与"三支坏值"同族但**失效方向不同**:
test('G-322 第五批:--root 收口三站三支坏值各自大声拒绝', () => {
  assertBadRoot(S('check-bypass-landing-scope.mjs'), '目录')
  assertBadRoot(S('check-inline-back-button.mjs'), '目录')
  assertBadRoot(S('plan-bypass-ledger-report.mjs'), '目录')
})

test('G-322 第五批:check-api-routes 复用本文件唯一取值出口,四支坏值一律 exit 2 未判定', () => {
  const script = S('check-api-routes.mjs')
  const arms = [
    [['--root', '--staged'], /忽略无效的 --root 值: --staged/],
    [['--root'], /\(其后没有任何参数,该旗标必须给一个目录\)/],
    [['--root', ''], /""\(空串,该旗标必须给一个目录\)/],
    [['--root='], /等号写法后为空/],
  ]
  for (const [args, re] of arms) {
    const r = spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    assert.equal(
      r.status,
      2,
      `check-api-routes ${JSON.stringify(args)} 必须 exit 2(未判定),不得静默按默认根判:得 ${r.status}\n${r.stdout ?? ''}${r.stderr ?? ''}`,
    )
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
    assert.match(out, re, `必须点名实得 token(三态分开):${out.slice(0, 240)}`)
    assert.match(out, /给了 --root 却没拿到有效值/, out.slice(0, 240))
  }
})

test('G-322 第五批:数值档坏值不再被读成 NaN(plan-bypass-ledger-report 的 --limit/--digest-cap)', () => {
  const script = S('plan-bypass-ledger-report.mjs')
  for (const flag of ['--limit', '--digest-cap']) {
    for (const args of [[flag], [flag, ''], [flag, '--json']]) {
      const r = spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      assert.notEqual(r.status, 0, `${flag} ${JSON.stringify(args)} 不得静默退回默认档`)
      const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
      assert.match(out, new RegExp(`${flag} 需要一个正整数`), out.slice(0, 240))
    }
    // Number('abc')=NaN 那一型:token 合法但数值域不合法 ⇒ 旧写法 slice(0,NaN)=[] 交出"0 条"的空报告
    const bad = spawnSync(process.execPath, [script, flag, 'abc'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    assert.notEqual(bad.status, 0, `${flag} abc 不得被 Number() 读成 NaN 后当"没有数据"报出去`)
    assert.match(`${bad.stdout ?? ''}${bad.stderr ?? ''}`, /必须是正整数/)
  }
})

// ─── 第六/七批(2026-10-17)───
// 选点尺是"失效方向",不是行号:HEAD 面重扫(两把只读尺)得 113 处候选,其中
// **注册为 blocking 且这一支没有任何 '-' 守卫**的 28 处才是射程;第六批收 --root 七站,第七批再收八站。
test('G-322 第九批:落点/封口型旗标 —— seal-c-root-stray 的 --root/--devenv 与认证书的 --out-dir', () => {
  // 这两站选进来是因为**方向**:seal-c-root-stray 是本仓唯一会改盘根结构(junction 封口)的工具,
  // `--apply --root --devenv D:/DevEnv` 旧写法会静默按默认 C: 封口 = 调用方以为在验另一块盘(§26 递归穿透);
  // 认证书是要给人签收的凭证,`--out-dir --json` 旧写法把它写进 outputs/--json/ 却照报已写出。
  assertBadRoot(S('seal-c-root-stray.mjs'), '目录')
  for (const args of [['--devenv', '--apply'], ['--devenv'], ['--devenv', '']]) {
    const r = spawnSync(process.execPath, [S('seal-c-root-stray.mjs'), ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.notEqual(r.status, 0, `${JSON.stringify(args)} 不得静默退回 devEnvRoot()(它是封口的**目标根**)`)
    assert.match(`${r.stdout ?? ''}${r.stderr ?? ''}`, /--devenv 需要一个目录/)
  }
  const cert = S('run-8end-consistency-cert.mjs')
  for (const { args, expect } of [
    { args: ['--out-dir', '--json'], expect: '"--json"' },
    { args: ['--out-dir'], expect: '(其后没有任何参数)' },
    { args: ['--out-dir', ''], expect: '""' },
  ]) {
    const r = spawnSync(process.execPath, [cert, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    assert.notEqual(r.status, 0, `${JSON.stringify(args)} 不得把认证书写进一个由吞值造出来的目录`)
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
    assert.match(out, /--out-dir 需要一个目录/, out.slice(0, 200))
    assert.match(out, new RegExp(expect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), out.slice(0, 200))
  }
})

test('G-322 第十批:落点/表名型吞值(analyze-hook-log-unknown 五旗标、migration-ledger-drift --ledger-table)', () => {
  const ah = S('analyze-hook-log-unknown.mjs')
  for (const flag of ['--root', '--limit', '--window-min', '--sample', '--report']) {
    for (const args of [[flag], [flag, ''], [flag, '--json']]) {
      const r = spawnSync(process.execPath, [ah, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      assert.equal(r.status, 2, `${flag} ${JSON.stringify(args)} 必须 exit 2(旧写法:数字旗标喂进 Number() 得 NaN ⇒ slice(0,NaN)=[] 抽样静默变空;路径旗标吞成假路径)\n${r.stdout ?? ''}${r.stderr ?? ''}`)
      assert.match(`${r.stdout ?? ''}${r.stderr ?? ''}`, new RegExp(`${flag} 需要`))
    }
  }
  const md = S('check-migration-ledger-drift.mjs')
  for (const args of [['--ledger-table'], ['--ledger-table', ''], ['--ledger-table', '--dsn']]) {
    const r = spawnSync(process.execPath, [md, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    assert.equal(r.status, 2, `${JSON.stringify(args)} 必须 exit 2(旧写法 ?? 静默换成默认表去比漂移)\n${r.stdout ?? ''}${r.stderr ?? ''}`)
    assert.match(`${r.stdout ?? ''}${r.stderr ?? ''}`, /--ledger-table 需要/)
  }
  const bogus = spawnSync(process.execPath, [md, '--ledger-table', 'bogus'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  assert.equal(bogus.status, 2, '域名不合法也不得换成默认表')
  assert.match(`${bogus.stdout ?? ''}${bogus.stderr ?? ''}`, /不是合法 "schema.table"/)
  // 阳性对照:默认档的既有语义(SKIP 且非 strict 退 0)不得因新校验被改成判红 —— 校验只准拦"给了旗标却没值"
  const plain = spawnSync(process.execPath, [md], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  assert.equal(plain.status, 0, `${plain.stdout ?? ''}${plain.stderr ?? ''}`)
  assert.match(`${plain.stdout ?? ''}${plain.stderr ?? ''}`, /SKIP/)
})

test('G-322 第十一批:派单入口 plan-tasks 的 --since/--max-commits 吞值必须未判定(正例窗口仍可用)', () => {
  const script = S('plan-tasks.mjs')
  for (const args of [
    ['--reopened-flips', '--since', '--json'],
    ['--reopened-flips', '--since', ''],
    ['--reopened-flips', '--max-commits', '--json'],
    ['--reopened-flips', '--max-commits', ''],
    ['--reopened-flips', '--max-commits', 'abc'],
    ['--reopened-flips', '--max-commits='],
    ['--reopened-flips', '--max-commits=x'],
  ]) {
    const r = spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    assert.equal(r.status, 2, `${JSON.stringify(args)} 必须 exit 2(旧写法:--max-commits 静默退回默认 900,而"已截断"那行照打 = 读数自洽却与调用方要的不是同一件事)\n${r.stdout ?? ''}${r.stderr ?? ''}`)
    assert.match(`${r.stdout ?? ''}${r.stderr ?? ''}`, /无法判定 —— --(since|max-commits)/)
    assert.doesNotMatch(`${r.stdout ?? ''}${r.stderr ?? ''}`, /ERR_INVALID_ARG_TYPE|at ModuleJob/, '不得以裸栈当用法错出口')
  }
  // 阳性对照:显式窗口 + 显式上限仍按原语义出结论(没把判据收紧成"这道档不能用")
  const ok = spawnSync(process.execPath, [script, '--reopened-flips', '--since=2026-09-08', '--max-commits=5'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(ok.status, 0, `${ok.stdout ?? ''}${ok.stderr ?? ''}`)
})

test('G-322 第十二批:守护巡检(check-env-drift)、ps1 门(check-pwsh-version)、取号入口(next-plan-id --source)', () => {
  // 这三站的选点尺同一条:静默换面/换根 ⇒ 出的是"看起来正常的错结论"。
  // env-drift 旧写法 `resolve(argv[i+1] || '.')` 落在 **cwd**,守护进程 cwd ≠ 仓根 ⇒ 巡另一棵树还报"无漂移";
  // pwsh 门旧写法把 "--staged" 当根 ⇒ 由 existsSync 冒成**判红**,红记在本次提交头上(§12e);
  // next-plan-id 的 `--source` 是**发号依据的那一面**,吞值后走的是"rev 无效"或"按更宽的面发号"两支,后者=跨机撞号。
  assertBadRoot(S('check-env-drift.mjs'), '目录')
  assertBadRoot(S('check-pwsh-version.mjs'), '目录')
  const np = S('next-plan-id.mjs')
  for (const { args, expect } of [
    { args: ['--source', '--check'], expect: '"--check"' },
    { args: ['--source'], expect: '(其后没有任何参数)' },
    { args: ['--source', ''], expect: '""' },
  ]) {
    const r = spawnSync(process.execPath, [np, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    assert.notEqual(r.status, 0, `${JSON.stringify(args)} 不得带着被吞的 rev 继续取号`)
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
    assert.match(out, /--source 需要一个git rev/, out.slice(0, 200))
    assert.match(out, new RegExp(expect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), out.slice(0, 200))
    assert.doesNotMatch(out, /ERR_INVALID_ARG_TYPE|at ModuleJob/, '不得以裸栈当用法错出口')
  }
})

test('G-322 第十三批:数值与落点型四站 —— --top / --hours+--days / 取证 --report / 备份 --kind', () => {
  // 共同形状:旧写法要么把坏值 `|| 默认` 折掉(0 与"被吞"同形),要么只挡"后面没有参数"一支。
  // --top 0 单独锁:旧写法 `Number('0')||10` 静默改写成 10(覆写用户输入);直接接受 0 又会交出一份
  // **零行清单**读成"没有发现" ⇒ 两支都拒,理由写进文案。
  const arms = [
    [
      S('check-plan-sha-resolvable.mjs'),
      [['--top'], ['--top', ''], ['--top', '--json'], ['--top', '0'], ['--top', '-3']],
      /--top 需要/,
    ],
    [S('alert-volume-report.mjs'), [['--hours'], ['--hours', ''], ['--hours', '--json'], ['--days'], ['--days', 'x']], /需要(一个正数|正数)/],
    [S('check-public-path-probe.mjs'), [['--report'], ['--report', ''], ['--report', '--json']], /--report 需要一个取证文件路径/],
    [S('archive-dir.mjs'), [['--kind'], ['--kind', ''], ['--kind', '--apply']], /--kind 需要一个族名/],
  ]
  for (const [script, list, re] of arms) {
    for (const args of list) {
      const r = spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      assert.notEqual(r.status, 0, `${script.split('/').pop()} ${JSON.stringify(args)} 不得静默按默认档出结论`)
      const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
      assert.match(out, re, out.slice(0, 200))
      assert.doesNotMatch(out, /ERR_INVALID_ARG_TYPE|at ModuleJob/, '不得以裸栈当用法错出口')
    }
  }
})

test('G-322 第十四批:观测/编码/台账类五站的 --root / --manifest / --ticket+--out', () => {
  // 观测档(只报名不判红)最容易被漏:它不拦任何东西,但**观测面错了就等于没观测**,而输出照常好看。
  for (const f of [
    'check-bpe-encoding-parity.mjs',
    'check-mrn-vitest-mock-alias-surface.mjs',
    'check-sequence-null-bucket.mjs',
  ]) {
    assertBadRoot(S(f), '目录')
  }
  const sdk = S('check-sdk-release-channels.mjs')
  for (const { args, expect } of [
    { args: ['--manifest', '--json'], expect: '"--json"' },
    { args: ['--manifest'], expect: '(其后没有任何参数)' },
    { args: ['--manifest', ''], expect: '""' },
  ]) {
    const r = spawnSync(process.execPath, [sdk, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    assert.equal(r.status, 2, `${JSON.stringify(args)} 必须 exit 2:该文件顶层 main().catch() 丢返回码,` +
      `本站的守卫必须 process.exit —— 旧写法会把"少打一个值"冒成"台账不可读"的判红(红记错人)\n${r.stdout ?? ''}${r.stderr ?? ''}`)
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
    assert.match(out, /--manifest 需要一个文件路径/, out.slice(0, 200))
    assert.match(out, new RegExp(expect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), out.slice(0, 200))
  }
  const dp = S('check-dispatch-premise.mjs')
  for (const flag of ['--ticket', '--out']) {
    for (const args of [[flag], [flag, ''], [flag, '--json']]) {
      const r = spawnSync(process.execPath, [dp, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      assert.notEqual(r.status, 0, `${flag} ${JSON.stringify(args)} 不得静默出结论(派单前提判错的票=给别人派错活)`)
      assert.match(`${r.stdout ?? ''}${r.stderr ?? ''}`, new RegExp(`${flag} 需要一个`))
    }
  }
})

test('G-322 第七批:另八道 blocking 门的 --root 三支坏值各自大声拒绝', () => {
  for (const f of [
    'check-api-client-utf8.mjs',
    'check-crash-report-redaction.mjs',
    'check-lock-manifest-consistency.mjs',
    'check-no-nested-git.mjs',
    'check-slash-command-wired.mjs',
    'check-stale-dist.mjs',
    'check-token-sync-registry.mjs',
    'check-v3-62-conversation-mount.mjs',
  ]) {
    assertBadRoot(S(f))
  }
})

test('G-322 第六批:七道 blocking 门的 --root 三支坏值各自大声拒绝', () => {
  for (const f of [
    'check-admin-gate-consistency.mjs',
    'check-authorization-column-isolation.mjs',
    'check-digest-name-reality.mjs',
    'check-readme-table-integrity.mjs',
    'check-statusbar-single-source.mjs',
    'check-subagent-permission-inherited.mjs',
    'check-staged-deletions.mjs',
  ]) {
    assertBadRoot(S(f), '目录')
  }
})

test('G-322 第八批:check-write-owner-predicate 的 --root/--files/--limit 三支坏值各自非零', () => {
  const script = S('check-write-owner-predicate.mjs')
  assertBadRoot(script)
  for (const flag of ['--files', '--limit']) {
    for (const args of [[flag], [flag, ''], [flag, '--staged']]) {
      const r = spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      assert.notEqual(r.status, 0, `${JSON.stringify(args)} 不得静默出结论(旧写法 --files 顶值 = 扫 0 个文件报绿;--limit 顶值 = NaN)`)
      const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
      assert.match(out, new RegExp(`${flag} 需要一个`), out.slice(0, 220))
    }
  }
  // 数值域那一支:token 形态合法但不是正整数(`--files abc` 不算这一型 —— 那是一张合法的窄清单)
  const bad = spawnSync(process.execPath, [script, '--limit', 'abc'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  assert.match(`${bad.stdout ?? ''}${bad.stderr ?? ''}`, /必须是正整数/)
})

test('G-322 第八批:openapi-check 的 --min-coverage 不得把阈值折成 NaN(CI 契约门 D 维比较恒假=静默放行)', () => {
  const script = S('openapi-check.mjs')
  for (const args of [['--min-coverage'], ['--min-coverage', ''], ['--min-coverage', '--fresh'], ['--min-coverage='], ['--min-coverage', 'abc']]) {
    const r = spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    assert.equal(r.status, 2, `${JSON.stringify(args)} 必须 exit 2,不得让 NaN 把覆盖率门放行:\n${r.stdout ?? ''}${r.stderr ?? ''}`)
    assert.match(`${r.stdout ?? ''}${r.stderr ?? ''}`, /--min-coverage 需要一个数字/)
  }
})

test('G-322 第六批:check-staged-deletions 的 --allowlist 三支坏值必须真非零(该文件顶层 main().catch() 丢弃返回码)', () => {
  // 这一站的形状教训:`return 2` 在这个文件里等于没退出(红档一直靠 process.exit 落)。
  // 探针因此不能只看 stderr 有没有点名,必须量 rc —— 点名却 rc=0 = "看着拦了其实放行"。
  const script = S('check-staged-deletions.mjs')
  const arms = [
    { args: ['--allowlist', '--staged'], expect: '"--staged"' },
    { args: ['--allowlist'], expect: '(其后没有任何参数)' },
    { args: ['--allowlist', ''], expect: '""' },
  ]
  for (const { args, expect } of arms) {
    const r = spawnSync(process.execPath, [script, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.notEqual(r.status, 0, `--allowlist ${JSON.stringify(args)} 不得 rc=0`)
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
    assert.match(out, /--allowlist 需要一个文件路径/, out.slice(0, 200))
    assert.match(out, new RegExp(expect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), out.slice(0, 200))
  }
})

// ─── 第十六批(2026-10-17)───
// 本批射程 = HEAD 面只读尺重扫后仍为 **A 档(静默吞值)** 的 9 处 + **B 档(非零但形态不佳)** 的 4 处。
// 三支坏值(顶值 / 缺值 / 空串)在本批各站**不等价**,故逐支断言:有的站缺值走 `(其后没有任何参数)`,
// 有的站缺值走 `(缺)`,只测一支必留洞(census「三支坏值不等价」)。
test('G-322 第十六批:A 档 9 处 —— --root/--rev/--limit/--end/--timeout/--locale/--copy-assets 各自三支坏值大声拒绝', () => {
  // ① 走共享出口 / describeFlagToken 的六站:三支坏值文案与全仓标准同形。
  assertBadRoot(S('check-exemption-expiry.mjs'), '目录参数')
  assertBadRoot(S('check-orphan-deletion-refs.mjs'), '目录参数')
  assertBadRoot(S('c-disk-breakdown.mjs'), '参数')

  // ② --locale:旧写法空格形直接吞下一个 token(含下一个旗标)并静默回落默认语言集。
  const bg = S('apply-brand-glossary.mjs')
  for (const { args, expect } of [
    { args: ['--locale', '--dry-run'], expect: '"--dry-run"' },
    { args: ['--locale'], expect: '(其后没有任何参数)' },
    { args: ['--locale', ''], expect: '""' },
  ]) {
    const r = spawnSync(process.execPath, [bg, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    assert.equal(r.status, 2, `${JSON.stringify(args)} 必须 exit 2:静默回落默认语言集 = 把"我指定了语言"写成"我按默认跑"\n${r.stdout ?? ''}${r.stderr ?? ''}`)
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
    assert.match(out, /--locale 需要一个语言代码/, out.slice(0, 200))
    assert.match(out, new RegExp(expect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), out.slice(0, 200))
  }

  // ③ --rev/--limit:审计窗口型。--limit 另有数值域一支(abc 不是"被吞",是"读成 NaN ⇒ 回看 0 枚").
  const mal = S('check-merge-addition-loss.mjs')
  for (const flag of ['--rev', '--limit']) {
    for (const { args, expect } of [
      { args: [flag, '--all-new'], expect: '"--all-new"' },
      { args: [flag], expect: '(其后没有任何参数)' },
      { args: [flag, ''], expect: '""' },
    ]) {
      const r = spawnSync(process.execPath, [mal, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      assert.equal(r.status, 2, `${flag} ${JSON.stringify(args)} 必须 exit 2\n${r.stdout ?? ''}${r.stderr ?? ''}`)
      const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
      assert.match(out, new RegExp(`${flag} 需要一个`), out.slice(0, 200))
      assert.match(out, new RegExp(expect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), out.slice(0, 200))
    }
  }
  for (const script of [mal, S('check-merge-deletion-resurrection.mjs')]) {
    const r = spawnSync(process.execPath, [script, '--limit', 'abc'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    assert.equal(r.status, 2, `${script.split('/').pop()} --limit abc 必须 exit 2(旧写法 Number('abc')=NaN ⇒ 回看 0 枚仍出结论)`)
    assert.match(`${r.stdout ?? ''}${r.stderr ?? ''}`, /必须是正整数/)
  }

  // ④ --end/--timeout:该文件用 process.exitCode 而非 process.exit ⇒ 探针必须量 rc(点名却 rc=0 = 看着拦了其实放行)。
  const tcr = S('check-test-collection-runs.mjs')
  for (const { args, expect } of [
    { args: ['--end', '--strict'], expect: '"--strict"' },
    { args: ['--end'], expect: '(其后没有任何参数)' },
    { args: ['--end', ''], expect: '""' },
    { args: ['--timeout', '--strict'], expect: '"--strict"' },
    { args: ['--timeout'], expect: '(其后没有任何参数)' },
    { args: ['--timeout', ''], expect: '""' },
  ]) {
    const r = spawnSync(process.execPath, [tcr, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    assert.equal(r.status, 2, `${JSON.stringify(args)} 必须 exit 2(旧写法 --end 吞掉下一旗标 = 扫另一个端;\n` +
      `--timeout 读成 NaN ⇒ 超时判定恒假 = 慢套件静默放行)\n${r.stdout ?? ''}${r.stderr ?? ''}`)
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
    assert.match(out, /--(end|timeout) 需要一个/, out.slice(0, 200))
    assert.match(out, new RegExp(expect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), out.slice(0, 200))
  }

  // ⑤ --copy-assets:漏值时 copyAssets=undefined ⇒ 整步拷贝静默跳过,构建照报成功(产物缺资产却"绿")。
  const ab = S('lib/atomic-build.mjs')
  for (const { args, expect } of [
    { args: ['--outDir', 'dist', '--copy-assets', '-x'], expect: '"-x"' },
    { args: ['--outDir', 'dist', '--copy-assets'], expect: '(其后没有任何参数)' },
    { args: ['--outDir', 'dist', '--copy-assets', ''], expect: '""' },
  ]) {
    const r = spawnSync(process.execPath, [ab, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    assert.equal(r.status, 2, `${JSON.stringify(args)} 必须 exit 2,不得静默跳过拷贝步骤\n${r.stdout ?? ''}${r.stderr ?? ''}`)
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
    assert.match(out, /--copy-assets 需要一个脚本路径/, out.slice(0, 200))
    assert.match(out, new RegExp(expect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), out.slice(0, 200))
  }
})

test('G-322 第十六批:B 档 4 处 —— 非零但形态不佳(裸栈 rc=1 / 只查在场 / 点名后退默认照跑)', () => {
  // ① 两站旧写法在模块顶层 throw ⇒ rc=1 且**无点名**(读者只看到 Node 栈),调用方分不清"用法错"与"门自身炸了"。
  for (const f of ['check-root-dir-clean.mjs', 'check-test-paths.mjs']) {
    assertBadRoot(S(f), '目录参数')
  }

  // ② hook-window-guard:旧写法只查旗标在场(i>=0/j>=0),值被顶掉时把 `--repo` 当基线文件路径往下传。
  const hw = S('lib/hook-window-guard.mjs')
  for (const { args, expect, flag } of [
    { args: ['--check', '--baseline', '--repo', 'x'], expect: '"--repo"', flag: '--baseline' },
    { args: ['--check', '--baseline', 'a', '--repo'], expect: '(其后没有任何参数)', flag: '--repo' },
    { args: ['--check', '--baseline', '', '--repo', 'x'], expect: '""', flag: '--baseline' },
  ]) {
    const r = spawnSync(process.execPath, [hw, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    assert.equal(r.status, 2, `${JSON.stringify(args)} 必须 exit 2\n${r.stdout ?? ''}${r.stderr ?? ''}`)
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
    assert.match(out, new RegExp(`${flag} 需要一个参数`), out.slice(0, 200))
    assert.match(out, new RegExp(expect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), out.slice(0, 200))
  }

  // ③ plan-id-face:旧写法点名后退默认 HEAD 照跑 **exit 0** —— 对取号器而言等于把"我问的是另一个面"写成"我问的就是这个面"。
  //    纯函数 resolveSource 的「退默认 + notice」语义由镜像自检锁住(库内复用),判死只发生在 CLI 入口。
  const pf = S('lib/plan-id-face.mjs')
  for (const { args, expect } of [
    { args: ['--source', '--json'], expect: '"--json"' },
    { args: ['--source'], expect: '(其后没有任何参数)' },
    { args: ['--source', ''], expect: '""' },
  ]) {
    const r = spawnSync(process.execPath, [pf, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    assert.equal(r.status, 2, `${JSON.stringify(args)} 必须 exit 2(旧写法 exit 0 并给出 HEAD 面的号)\n${r.stdout ?? ''}${r.stderr ?? ''}`)
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
    assert.match(out, /--source 在场时值必须有效/, out.slice(0, 200))
    assert.match(out, new RegExp(expect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), out.slice(0, 200))
  }

  // ④ --threshold-min:纯函数 resolveThresholdMin 的「非法值回落默认」语义被自检钉住,判死在 CLI 层。
  const ua = S('check-uncommitted-age.mjs')
  for (const { args, expect } of [
    { args: ['--threshold-min', '--json'], expect: '"--json"' },
    { args: ['--threshold-min'], expect: '(其后没有任何参数)' },
    { args: ['--threshold-min', ''], expect: '""' },
  ]) {
    const r = spawnSync(process.execPath, [ua, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    assert.equal(r.status, 2, `${JSON.stringify(args)} 必须 exit 2:静默回落默认阈值 = 超龄判定按另一把尺子出结论\n${r.stdout ?? ''}${r.stderr ?? ''}`)
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
    assert.match(out, /--threshold-min 需要一个正整数分钟数/, out.slice(0, 200))
    assert.match(out, new RegExp(expect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), out.slice(0, 200))
  }
})

test('G-322 第五批:scan-hardcoded-zh 的 --exit blocking 腿不得把坏值读成"非严格档"(§0.10)', () => {
  const script = S('scan-hardcoded-zh.mjs')
  for (const args of [['--exit'], ['--exit', ''], ['--exit', '--staged'], ['--exit', '2']]) {
    const r = spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    assert.equal(
      r.status,
      2,
      `${JSON.stringify(args)} 必须 exit 2:棘轮被静默关掉 = "多放一次跳门"(正例 --exit 0/1 由 scan-hardcoded-zh.test.mjs 锁)\n${r.stdout ?? ''}${r.stderr ?? ''}`,
    )
    assert.match(`${r.stdout ?? ''}${r.stderr ?? ''}`, /--exit 需要 0 或 1/)
  }
})

test('G-322 第十七批:四道"判红型"守门的 --root 一律接 scripts/lib/flag-value.mjs 单源', () => {
  // 这四站在接单源之前**已经**大声 exit 2,但各写一份判据副本(`!val || val.startsWith('--')`)——
  // §0.6 说第二份必然漂移,而这一份的漂移方向恰好是洞:单划线 token(`-x`)被旧副本当合法目录收下。
  // 换成单源后判据只有一份,三支坏值各自 exit 2 且点名实得 token(文案由 lib 的 error 串出,
  // 不再逐门自写 ⇒ 本探针同时锁"措辞没被某扇门悄悄改回去")。
  for (const f of [
    'check-agent-status-vocabulary-parity.mjs',
    'check-load-state-projection-parity.mjs',
    'check-model-capacity-parity.mjs',
    'check-provider-health-vocabulary.mjs',
  ]) {
    assertBadRoot(S(f), '目录参数')
  }
})

// ─── 第十八批(2026-10-23)───
// 本批 10 站的旗标**不只有 --root**,noun 还带括号/竖线/连字符 ⇒ 旧 assertBadRoot 的
// `new RegExp(\`--root 需要一个${noun}\`)` 不转义会把 `(非负整数)` 读成捕获组、把真文案判成不匹配。
// 故新增一把通用尺:三支坏值(顶值 / 缺值 / 空串)逐支量 rc + 点名 noun + 点名实得 token,
// 文案一律来自 lib 的 error 串(措辞被某扇门改回去 = 本探针红)。
// 正例(默认档逐字不变)仍由各站自己的套件锁 —— 本文件不重复(见文件头口径)。

/** 正则元字符一律转义:noun 里出现 `(`、`|`、`-`、`/` 都是字面量,不是量词。 */
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * @param {string} script 绝对路径
 * @param {string} flag   被吞的那个带值旗标
 * @param {string} noun   lib 文案里的"一个<noun>"
 * @param {{pre?:string[], eat?:string, rc?:number, env?:object}} o
 *        pre = 前置实参(默认空);eat = 顶值那支拿来占值位的旗标(默认 --json);
 *        rc  = 期望退出码(默认只断非零 —— 各站用法错档既有 1 也有 2,不替它们改契约)。
 */
function assertBadFlag(script, flag, noun, o = {}) {
  const pre = o.pre ?? []
  const eat = o.eat ?? '--json'
  const arms = [
    { args: [...pre, flag, eat], expect: JSON.stringify(eat) },
    { args: [...pre, flag], expect: '(其后没有任何参数)' },
    { args: [...pre, flag, ''], expect: '""' },
  ]
  for (const { args, expect } of arms) {
    const r = spawnSync(process.execPath, [script, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: o.env,
    })
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
    if (o.rc === undefined) assert.notEqual(r.status, 0, `${script} ${JSON.stringify(args)} 不得静默按默认档出结论:\n${out.slice(0, 240)}`)
    else assert.equal(r.status, o.rc, `${script} ${JSON.stringify(args)} 必须 exit ${o.rc}:\n${out.slice(0, 240)}`)
    assert.match(out, new RegExp(esc(`${flag} 需要一个${noun}`)), `${script} 必须由单源出口点名用法:${out.slice(0, 240)}`)
    assert.match(out, new RegExp(esc(expect)), `${script} 三态必须分开(只测一支会留洞):${out.slice(0, 240)}`)
    assert.doesNotMatch(out, /ERR_INVALID_ARG_TYPE|at ModuleJob/, `${script} 不得以裸栈当用法错出口:${out.slice(0, 240)}`)
  }
}

test('G-322 第十八批:五道 --root 站的旧副本只挡 `--` 前缀,单划线 token 那格由单源补上', () => {
  // check-button-height 旧副本 `if (!v || v.startsWith('--')) throw`、check-direct-run-guard /
  // check-disk-root-write 的 argValue `!argv[i+1].startsWith('--') ? … : undefined` 同型;
  // check-capability-matrix 旧副本挡的是单划线(`startsWith('-')`)但漏值支只喊一句自写文案,
  // 三态不分。换成单源后判据只有一份,措辞也只有一份。
  assertBadRoot(S('check-button-height.mjs'), '目录参数')
  assertBadRoot(S('check-direct-run-guard.mjs'), '目录参数')
  assertBadRoot(S('check-disk-root-write.mjs'), '目录参数')
  assertBadFlag(S('check-capability-matrix.mjs'), '--root', '目录值', { eat: '--staged', rc: 2 })
})

test('G-322 第十八批:派单/巡检/审计四站的数值与枚举型旗标漏值不得折回默认', () => {
  // --timeout-ms 旧写法 `Number(argv[gi+1]) || 200_000`:漏值 ⇒ NaN 折回默认、`0` 是 falsy
  // 也被折回(用户显式要的即时超时没了)、`--timeout-ms --verbose` 把旗标当毫秒数。
  assertBadFlag(S('check-dispatch-key-coverage.mjs'), '--timeout-ms', '毫秒数(正整数)', { eat: '--verbose' })
  for (const v of ['abc', '0']) {
    const r = spawnSync(process.execPath, [S('check-dispatch-key-coverage.mjs'), '--timeout-ms', v], {
      cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.notEqual(r.status, 0, `--timeout-ms ${v} 不得被 Number() 读成 NaN/0 后当"正常超时"跑完:\n${r.stdout ?? ''}${r.stderr ?? ''}`)
    assert.match(`${r.stdout ?? ''}${r.stderr ?? ''}`, /--timeout-ms .*正整数/, `数值域那一支必须单独点名"正整数":\n${r.stdout ?? ''}${r.stderr ?? ''}`)
  }
  // `-5` 不是"数值域不合法",它是**值位上放的是个旗标**(以 - 开头)⇒ 由单源的形态档先拦,
  // 文案与全仓标准同形 —— 这一支与上面两支不等价,少了它就分不清"少打了个值"和"打了个错值"。
  {
    const r = spawnSync(process.execPath, [S('check-dispatch-key-coverage.mjs'), '--timeout-ms', '-5'], {
      cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.notEqual(r.status, 0)
    assert.match(`${r.stdout ?? ''}${r.stderr ?? ''}`, /--timeout-ms 需要一个毫秒数/)
  }
  // --base 是差值棘轮的**基线**:旧副本只挡 `--` 前缀,`-x` 会被交给 canResolve 报成"ref 解析不了",
  // 读起来像用户打了个好 ref 而 git 不认,其实是值位上放的是个旗标。
  assertBadFlag(S('check-format-changed.mjs'), '--base', 'ref', { eat: '--staged' })
  // --today 是这道门算"注册晚于基准日"的那把尺:漏值旧写法把 undefined 交给 ISO_DATE.test ⇒
  // 冒成"不是 ISO 日期:undefined",而 `--today --json` 会被当基准日(同样不是 ISO)—— 两态文案不分。
  assertBadFlag(S('check-auth-handler-registration-parity.mjs'), '--today', 'ISO 日期(YYYY-MM-DD)')
  // --probe 会**往声明集里塞一条**再对账:旧写法把 `--json` 归一化成一个真 chord 计进声明,
  // 观测面被凭空加一条;漏值时 String(undefined)='undefined' 同样被当成一个键。
  assertBadFlag(S('check-declared-shortcuts.mjs'), '--probe', '组合键(如 Mod+K)')
})

test('G-322 第十八批:烘焙/归档两站的落点与节流旗标漏值各自大声拒绝', (t) => {
  // --latest-json 是**输入面**:旧写法漏值报"缺 --latest-json"(读起来像用户没打),
  // 而 `--latest-json --out` 把旗标当路径 ⇒ 下一句"latest.json 不存在:--out"仍是被吞的 token 冒充路径。
  assertBadFlag(S('bake-desktop-latest.mjs'), '--latest-json', '文件路径', { eat: '--out' })
  // 其余落点旗标(--out/--tag/--gitee-url/…)读在"输入面已验过"之后 ⇒ 必须给一份**真能解析**的
  // latest.json 才走得到它们。夹具落 mkScratch(§15b,仓库外 + 进程退出回收),不碰真产物。
  const dir = mkScratch('g322-bake-')
  try {
    const fixture = join(dir, 'latest.json')
    writeFileSync(
      fixture,
      JSON.stringify({ version: '1.2.3', platforms: { 'windows-x86_64': { url: 'https://example.invalid/a.zip' } } }),
    )
    // 旧写法 `--out --gitee-url` 会把旗标当输出路径(resolve('--gitee-url') 是合法路径名)
    // ⇒ 认证产物被写进一个由吞值造出来的目录,末行照打"✅ 已烘焙"。
    assertBadFlag(S('bake-desktop-latest.mjs'), '--out', '文件路径', { pre: ['--latest-json', fixture], eat: '--gitee-url' })
  } finally {
    rmScratch(dir)
  }
  // --days 折回 0 = **关掉年龄节流**(把"我要按年龄节流"写成"全部可搬");--plan-face 折回默认面 =
  // 把"我指定了另一面"写成"我问的就是这个面"。归档器会写盘,故三支全部带 --dry-run 前置,
  // 且显式清空 HUSKY_SKIP_ARCHIVE(那条应急开关排在用法校验之前,留着会让探针 rc=0)。
  // 2026-10-29 加存在守卫(口径照 scripts/tests/watermark-reseat.test.mjs 的 T2):归档器已随
  // 2026-10-16「完成即删 / 存档机制退役」到期,它一删,这三条臂要探的**进程本体**就不在了 ——
  // 那时要记的不是"旗标判据变弱"(判据已原样迁入户 scripts/lib/plan-block-partition.mjs),
  // 而是 spawn 的对象消失。故按既有口径如实 skip,不冒充判定;归档器在位时这几臂逐条实跑,覆盖一条不少。
  const ARCHIVER = S('archive-completed-tasks.mjs')
  if (!existsSync(ARCHIVER)) {
    t.skip('archive-completed-tasks.mjs 已退役删除 ⇒ 归档臂主体不在,不冒充判定')
    return
  }
  const env = { ...process.env, HUSKY_SKIP_ARCHIVE: '' }
  assertBadFlag(S('archive-completed-tasks.mjs'), '--days', '天数(非负整数)', { pre: ['--dry-run'], env })
  assertBadFlag(S('archive-completed-tasks.mjs'), '--plan-face', '面名(head|worktree)', { pre: ['--dry-run'], eat: '--auto-commit', env })
  for (const [flag, v, re] of [
    ['--days', 'abc', /--days 需要非负整数/], // 数值域那一支:token 形态合法但读不出整数
    ['--days', '-1', /--days 需要一个天数\(非负整数\)/], // `-1` 以 - 开头 ⇒ 先落单源的**形态**档,不是数值档
  ]) {
    const r = spawnSync(process.execPath, [S('archive-completed-tasks.mjs'), '--dry-run', flag, v], {
      cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env,
    })
    assert.equal(r.status, 2, `${flag} ${v} 必须 exit 2(parseInt('abc')=NaN ⇒ diff>=NaN 恒假 = "一个也没到期"):\n${r.stdout ?? ''}${r.stderr ?? ''}`)
    assert.match(`${r.stdout ?? ''}${r.stderr ?? ''}`, re, `${flag} ${v} 走的必须是 ${re} 那一档:\n${r.stdout ?? ''}${r.stderr ?? ''}`)
  }
})

// ─── 第十九批(2026-10-23)───
// 本批四站全是**未注册档**(guardian-runner 注册表 mode 里没有它们)的 CLI 入口层,带病形:
// redundant/state-transition 的旧副本只挡 `--` 双划线(单划线 token 被当合法目录/数值收下),
// 两把 measure 尺的旧支是"点名一句 ℹ 后退默认照跑 exit 0"(mpbm 的 --source、ijb 的 --source
// 把"我指定了另一个面"写成"我问的就是默认面")。接单源后判死,措辞只有一份。
test('G-322 第十九批:未注册档四站 —— --root/--max-sites 与两把 measure 尺的 --source/--limit 接单源判死', () => {
  assertBadFlag(S('check-redundant-discriminator-predicate.mjs'), '--root', '目录实参', { eat: '--json', rc: 2 })
  assertBadFlag(S('check-state-transition-guard.mjs'), '--root', '目录参数', { eat: '--json', rc: 2 })
  assertBadFlag(S('check-state-transition-guard.mjs'), '--max-sites', '非负整数', { eat: '--json', rc: 2 })
  assertBadFlag(S('measure-plan-block-migration.mjs'), '--source', 'git rev', { eat: '--json', rc: 2 })
  assertBadFlag(S('measure-plan-block-migration.mjs'), '--limit', '非负整数', { eat: '--json', rc: 2 })
  assertBadFlag(S('measure-i18n-ja-suspect-buckets.mjs'), '--source', 'git rev', { eat: '--json', rc: 2 })
  assertBadFlag(S('measure-i18n-ja-suspect-buckets.mjs'), '--limit', '非负整数', { eat: '--json', rc: 2 })
})

// ─── 第二十批(2026-10-24)───
// 本批 10 站 / 8 文件全是**未注册档**的发布/运维 CLI,旧形是同一份 `argValue` 副本:
// 值位被下一个旗标顶掉时把 `--dry-run` 当文件名/主机名收下,漏值/空串则折成 null 由 `|| 默认` 静默接管。
test('G-322 第二十批:未注册档发布/运维 8 文件 10 站接单源判死', () => {
  assertBadFlag(S('cross-publish-devto.mjs'), '--file', '值', { eat: '--dry-run', rc: 2 })
  assertBadFlag(S('cross-publish-hashnode.mjs'), '--file', '值', { eat: '--dry-run', rc: 2 })
  assertBadFlag(S('cross-publish-producthunt.mjs'), '--name', '值', { eat: '--dry-run', rc: 2 })
  assertBadFlag(S('cross-publish-reddit.mjs'), '--subreddit', '值', { eat: '--dry-run', rc: 2 })
  assertBadFlag(S('cross-publish-v2ex.mjs'), '--node', '值', { eat: '--dry-run', rc: 2 })
  assertBadFlag(S('indexnow-submit.mjs'), '--host', '值', { eat: '--dry-run', rc: 2 })
  assertBadFlag(S('verify-free-providers.mjs'), '--provider', 'provider 代号', { eat: '--dry-run', rc: 2 })
  assertBadFlag(S('verify-free-providers.mjs'), '--timeout', '毫秒数', { eat: '--dry-run', rc: 2 })
  assertBadFlag(S('verify-publish-adapters.mjs'), '--jwt', 'JWT 字符串', { eat: '--dry-run', rc: 2 })
  assertBadFlag(S('verify-publish-adapters.mjs'), '--api-url', 'API 地址', { eat: '--dry-run', rc: 2 })
})

// ─── 第二十一批(2026-10-25,台账票 L7635)───
// 本批 10 站 / 10 文件:门与运维 CLI 的 --root/--dist/--today/--provider/--face 旧形
// `argv[i+1]` 直取(或只挡 `--` 前缀/自写三态文案),值位被下一个旗标顶掉/结尾无值/空串
// 三态不分,单划线 token 那格还漏。统一换 requireFlagValue 判死,文案只剩 lib 一份。
test('G-322 第二十一批:十站三支坏值各自大声拒绝(rc 2 + 点名实得 token)', () => {
  assertBadFlag(S('check-i18n-messages-exist.mjs'), '--root', '目录参数', { eat: '--staged', rc: 2 })
  assertBadFlag(S('check-load-state-loaded-marks.mjs'), '--root', '目录参数', { eat: '--json', rc: 2 })
  assertBadFlag(S('check-migration-immutable.mjs'), '--root', '目录参数', { eat: '--staged', rc: 2 })
  assertBadFlag(S('check-miniapp-build-artifacts.mjs'), '--dist', '目录参数', { eat: '--json', rc: 2 })
  assertBadFlag(S('check-turn-ordinal-lock.mjs'), '--root', '目录参数', { eat: '--json', rc: 2 })
  assertBadFlag(S('check-txn-cancel-boundary.mjs'), '--root', '目录参数', { eat: '--json', rc: 2 })
  assertBadFlag(S('check-theme-prop-wiring.mjs'), '--root', '目录参数', { eat: '--json', rc: 2 })
  assertBadFlag(S('check-tool-contract-declared.mjs'), '--today', 'ISO 日期(YYYY-MM-DD)', { eat: '--staged', rc: 2 })
  assertBadFlag(S('scan-upstream-models.mjs'), '--provider', 'provider 代号', { eat: '--dry-run', rc: 2 })
  assertBadFlag(S('sync-alpha-usage.mjs'), '--face', '面名(head|staged)', { eat: '--check', rc: 2 })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
