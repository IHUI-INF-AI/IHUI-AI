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
import { resolve } from 'node:path'

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
    const r = spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
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
      const r = spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
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
    const r = spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
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
      const r = spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
      assert.notEqual(r.status, 0, `${flag} ${JSON.stringify(args)} 不得静默退回默认档`)
      const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
      assert.match(out, new RegExp(`${flag} 需要一个正整数`), out.slice(0, 240))
    }
    // Number('abc')=NaN 那一型:token 合法但数值域不合法 ⇒ 旧写法 slice(0,NaN)=[] 交出"0 条"的空报告
    const bad = spawnSync(process.execPath, [script, flag, 'abc'], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
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
    const r = spawnSync(process.execPath, [cert, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
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
      const r = spawnSync(process.execPath, [ah, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
      assert.equal(r.status, 2, `${flag} ${JSON.stringify(args)} 必须 exit 2(旧写法:数字旗标喂进 Number() 得 NaN ⇒ slice(0,NaN)=[] 抽样静默变空;路径旗标吞成假路径)\n${r.stdout ?? ''}${r.stderr ?? ''}`)
      assert.match(`${r.stdout ?? ''}${r.stderr ?? ''}`, new RegExp(`${flag} 需要`))
    }
  }
  const md = S('check-migration-ledger-drift.mjs')
  for (const args of [['--ledger-table'], ['--ledger-table', ''], ['--ledger-table', '--dsn']]) {
    const r = spawnSync(process.execPath, [md, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
    assert.equal(r.status, 2, `${JSON.stringify(args)} 必须 exit 2(旧写法 ?? 静默换成默认表去比漂移)\n${r.stdout ?? ''}${r.stderr ?? ''}`)
    assert.match(`${r.stdout ?? ''}${r.stderr ?? ''}`, /--ledger-table 需要/)
  }
  const bogus = spawnSync(process.execPath, [md, '--ledger-table', 'bogus'], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
  assert.equal(bogus.status, 2, '域名不合法也不得换成默认表')
  assert.match(`${bogus.stdout ?? ''}${bogus.stderr ?? ''}`, /不是合法 "schema.table"/)
  // 阳性对照:默认档的既有语义(SKIP 且非 strict 退 0)不得因新校验被改成判红 —— 校验只准拦"给了旗标却没值"
  const plain = spawnSync(process.execPath, [md], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
  assert.equal(plain.status, 0, `${plain.stdout ?? ''}${plain.stderr ?? ''}`)
  assert.match(`${plain.stdout ?? ''}${plain.stderr ?? ''}`, /SKIP/)
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
      const r = spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
      assert.notEqual(r.status, 0, `${JSON.stringify(args)} 不得静默出结论(旧写法 --files 顶值 = 扫 0 个文件报绿;--limit 顶值 = NaN)`)
      const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
      assert.match(out, new RegExp(`${flag} 需要一个`), out.slice(0, 220))
    }
  }
  // 数值域那一支:token 形态合法但不是正整数(`--files abc` 不算这一型 —— 那是一张合法的窄清单)
  const bad = spawnSync(process.execPath, [script, '--limit', 'abc'], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
  assert.match(`${bad.stdout ?? ''}${bad.stderr ?? ''}`, /必须是正整数/)
})

test('G-322 第八批:openapi-check 的 --min-coverage 不得把阈值折成 NaN(CI 契约门 D 维比较恒假=静默放行)', () => {
  const script = S('openapi-check.mjs')
  for (const args of [['--min-coverage'], ['--min-coverage', ''], ['--min-coverage', '--fresh'], ['--min-coverage='], ['--min-coverage', 'abc']]) {
    const r = spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
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
    })
    assert.notEqual(r.status, 0, `--allowlist ${JSON.stringify(args)} 不得 rc=0`)
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
    assert.match(out, /--allowlist 需要一个文件路径/, out.slice(0, 200))
    assert.match(out, new RegExp(expect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), out.slice(0, 200))
  }
})

test('G-322 第五批:scan-hardcoded-zh 的 --exit blocking 腿不得把坏值读成"非严格档"(§0.10)', () => {
  const script = S('scan-hardcoded-zh.mjs')
  for (const args of [['--exit'], ['--exit', ''], ['--exit', '--staged'], ['--exit', '2']]) {
    const r = spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
    assert.equal(
      r.status,
      2,
      `${JSON.stringify(args)} 必须 exit 2:棘轮被静默关掉 = "多放一次跳门"(正例 --exit 0/1 由 scan-hardcoded-zh.test.mjs 锁)\n${r.stdout ?? ''}${r.stderr ?? ''}`,
    )
    assert.match(`${r.stdout ?? ''}${r.stderr ?? ''}`, /--exit 需要 0 或 1/)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
