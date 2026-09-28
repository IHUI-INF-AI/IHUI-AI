// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 镜像测试:scripts/run-evidence.mjs(取证包装器)。
 *
 * 为什么不复制判据(§22c):`judgeEvidence` / `exitCodeForVerdict` 直接从源文件 import。
 * 一旦测试里抄一份,源实现改了而测试仍绿 ⇒ 测试从防线变成缺陷的掩体(本仓记过多次)。
 *
 * 为什么这个文件必须存在:该工具文件名不以 `check|scan|guard` 开头 ⇒ 守门 89 的候选集
 * **结构上看不见它**(同 `scripts/c-disk-breakdown.mjs` 那一格的处置),所以它的不变量
 * 只能由"自己的自检 + 本镜像"两道钉住。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const TOOL = resolve(ROOT, 'scripts', 'run-evidence.mjs')
const gate = await import(`file://${TOOL}`)

test('T1 __test__ 必须把判定纯函数 export 出来(§22c:镜像不许拿第二份真相跑断言)', () => {
  const t = gate.__test__
  assert.equal(typeof t, 'object', '源文件必须 export const __test__')
  assert.equal(typeof t.judgeEvidence, 'function', '__test__ 缺 judgeEvidence')
  assert.equal(typeof t.exitCodeForVerdict, 'function', '__test__ 缺 exitCodeForVerdict')
  assert.equal(typeof t.RC_MARK, 'string', '__test__ 缺 RC_MARK')
  // 测试文件内不得出现第二份**判定实现**(声明式正则;写函数名字符串会匹配到断言自己那行)
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  assert.ok(
    !/^(?:export\s+)?function\s+judgeEvidence\s*\(/m.test(self),
    '镜像里出现了第二份 judgeEvidence 实现',
  )
})

test('T2 三态各自成立,且"没跑到"与"跑失败"不可能混为一谈', () => {
  const { judgeEvidence: j, exitCodeForVerdict: e, RC_MARK: M, KILLED_MARK: K } = gate.__test__
  assert.deepEqual(
    [j(`${M}0`).kind, j(`${M}1`).kind, j('半截 stdout').kind, j(`${K}: SIGTERM`).kind, j('').kind],
    ['complete', 'complete', 'truncated', 'killed', 'missing'],
  )
  // 关键不等式:RC=1 与 截断,退出码必须不同(1 vs 3) —— 否则本工具失去意义
  assert.equal(e(j(`${M}1`)), 1, '业务失败应给 1')
  assert.equal(e(j('半截 stdout')), 3, '截断必须给 3,不得给 0/1')
  assert.equal(e(j(`${M}0`)), 0)
})

test('T3 阳性对照:半截证据绝不得被读成通过(把判据改成恒 complete 时本条必红)', () => {
  const { judgeEvidence: j, exitCodeForVerdict: e, RC_MARK: M } = gate.__test__
  const truncated = j(`#EVIDENCE-CMD: x\n#EVIDENCE-START: t\n只有一行`)
  assert.notEqual(truncated.kind, 'complete')
  assert.notEqual(e(truncated), 0)
  assert.notEqual(e(truncated), 1, '截断不得与业务失败同码 —— 那正是本次要根治的混淆')
  // 反向:有标记但内容坏了,也不得猜成 0
  assert.equal(e(j(`${M}yes`)), 3, 'RC 内容非整数必须判 malformed→3,不得猜')
})

test('T4 CRLF 与多条标记:Windows 取证件不得因换行/续写被误判', () => {
  const { judgeEvidence: j, RC_MARK: M } = gate.__test__
  assert.equal(j(`x\r\n${M}0\r\n`).kind, 'complete')
  assert.equal(j(`${M}1\nagain\n${M}0`).rc, 0, '重试续写时以最后一条为准')
})

test('T5 该工具刻意不接提交链 —— 注册表里不得出现它(它是取证出口,不是判据)', () => {
  const runner = readFileSync(resolve(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
  assert.ok(
    !runner.includes('run-evidence.mjs'),
    'run-evidence 被当成守门接进提交链 ⇒ 每次提交都被"取证包装器"判红,正是本仓恒红门那型',
  )
})

test('T6 端到端装车证明:CLI 真跑 --self-test 必须全绿且 rc=0(例数以末行为准,不钉死防漂移)', () => {
  const out = execFileSync(process.execPath, [TOOL, '--self-test'], {
    encoding: 'utf8',
    cwd: ROOT,
    windowsHide: true,
    timeout: 300_000,
    maxBuffer: 32 << 20,
  })
  const m = /run-evidence --self-test:(\d+)\/(\d+) 通过/.exec(out)
  assert.ok(m, `自检末行没出现,输出尾部:${out.slice(-160)}`)
  assert.equal(m[1], m[2], '自检有未通过项')
  assert.ok(Number(m[2]) >= 15, `自检条数回落到 ${m[2]},低于本工具的最少判据集`)
  assert.ok(!/❌/.test(out), '自检输出里出现红叉')
})

test('T7 被包装命令的 RC 会原样传给调用方(0/非 0 两臂)', () => {
  const okFile = resolve(ROOT, '.ihui-agent', 'tmp', 'mirror-run-ok.txt')
  const badFile = resolve(ROOT, '.ihui-agent', 'tmp', 'mirror-run-bad.txt')
  try {
    execFileSync(
      process.execPath,
      [TOOL, okFile, '--', process.execPath, '-e', 'process.exit(0)'],
      { cwd: ROOT, windowsHide: true, timeout: 120_000, stdio: 'ignore' },
    )
    const txt = readFileSync(okFile, 'utf8')
    assert.ok(/#EVIDENCE-RC=0/.test(txt), '成功臂没落 RC 行')
    let threw = null
    try {
      execFileSync(
        process.execPath,
        [TOOL, badFile, '--', process.execPath, '-e', 'process.exit(5)'],
        { cwd: ROOT, windowsHide: true, timeout: 120_000, stdio: 'ignore' },
      )
    } catch (e) {
      threw = e.status
    }
    assert.equal(threw, 1, '被包装命令失败时本工具必须非 0(把真实失败传出去,不能吞)')
    assert.ok(/#EVIDENCE-RC=5/.test(readFileSync(badFile, 'utf8')), '证据里必须留下真实 RC=5')
  } finally {
    for (const f of [okFile, badFile]) {
      try {
        rmSync(f, { force: true })
      } catch {
        /* 清不掉由 T8 那条统一判 */
      }
    }
  }
})

test('T8 证据件由工具自己清理:自检跑完不得在 tmp 留残留取证件', () => {
  execFileSync(process.execPath, [TOOL, '--self-test'], {
    cwd: ROOT,
    windowsHide: true,
    timeout: 300_000,
    stdio: 'ignore',
  })
  const left = [
    'evidence-selftest-ok.txt',
    'evidence-selftest-fail.txt',
    'evidence-selftest-killed.txt',
    'evidence-selftest-cwd.txt',
  ].filter((f) => existsSync(resolve(ROOT, '.ihui-agent', 'tmp', f)))
  assert.deepEqual(left, [], '自检留下取证件 ⇒ 会被下一个人误当成本轮证据')
})

// T9/T10 —— 2026-09-27 两路并行代理各自撞上、由主会话修的两格(镜像必须钉住,否则下次重构又会漂回去):
//  ① 派生失败时 `error` 与 `close` **都**触发,句柄被关两次 ⇒ 未捕获 `EBADF: close`,整个取证进程崩掉
//     (证据里其实已写 RC=127:结论对、进程死,调用方只看到堆栈,极易误读成"被测命令出了问题")。
//  ② Windows 的 `pnpm`/`npx` 是 `.CMD` shim,`spawn('pnpm')` 必 `ENOENT` ⇒ 必须识别并改走 `cmd.exe /d /c`,
//     但**只认带批处理后缀的解析结果**(裸名会命中 Git Bash 那个无后缀 ELF shim,包一层就错)。
test('T9 派生失败不得崩掉取证进程(RC 行恰好一条)', () => {
  const file = resolve(ROOT, '.ihui-agent', 'tmp', 'mirror-enoent.txt')
  let status = null
  let stderr = ''
  try {
    execFileSync(
      process.execPath,
      [TOOL, file, '--', resolve(ROOT, '.ihui-agent', 'tmp', 'no-such-binary-xyz.exe')],
      {
        cwd: ROOT,
        windowsHide: true,
        timeout: 120_000,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
  } catch (e) {
    status = e.status
    stderr = String(e.stderr ?? '')
  } finally {
    try {
      rmSync(file, { force: true })
    } catch {
      /* 清不掉不影响结论 */
    }
  }
  assert.notEqual(status, 2, `本工具自己崩了(exit 2),stderr 尾部:${stderr.slice(-200)}`)
  assert.equal(status, 1, '派生失败必须以"业务失败"(exit 1)呈现,而不是崩')
  assert.ok(!/EBADF/.test(stderr), `句柄被关了两次:${stderr.slice(-200)}`)
})

test('T10 .CMD shim 走 cmd.exe 而裸名/绝对可执行原样交给 spawn(§22c:判据从源文件 import,不许抄第二份)', () => {
  assert.equal(
    typeof gate.__test__.buildSpawnArgv,
    'function',
    '__test__ 缺 buildSpawnArgv(镜像拿不到就只会复读实现)',
  )
  const b = gate.__test__.buildSpawnArgv
  assert.deepEqual(
    b(['zzz-not-a-real-binary']),
    ['zzz-not-a-real-binary'],
    '不存在的命令不得被凭空包一层',
  )
  assert.deepEqual(
    b([process.execPath, '-e', '0']),
    [process.execPath, '-e', '0'],
    '绝对路径的可执行文件必须原样',
  )
  if (process.platform === 'win32') {
    const withExt = b(['pnpm.cmd', '--version'])
    assert.equal(withExt[0], 'cmd.exe', `带 .cmd 后缀的 shim 必须改走 cmd.exe,实测 ${withExt[0]}`)
    assert.equal(withExt[1], '/d')
    assert.equal(withExt[2], '/c')
    const bare = b(['pnpm', '--version'])
    if (bare[0] === 'cmd.exe') {
      assert.ok(/\.cmd$/i.test(bare[3]), `只允许解析到带批处理后缀的路径,实测 ${bare[3]}`)
    }
  }
})

// T11–T15 —— G-285:--cwd 透传 + --expect-cwd 一致性校验(正反成对)。
// 立因:旧实现把被包装命令钉死在仓根,"从别的目录跑同一判据"那一发里子进程收到被改写过的
// 路径(Cannot find module G:\scripts\…,根本没进被测进程),而 --verify 仍判 complete
// —— 取证工具自己产出假合格证。这四条就是钉"这类取证原来做不了/做了也不可信"那一格。
const AI_DIR = resolve(ROOT, 'apps', 'ai-service')
const CWD_DIR = existsSync(AI_DIR) ? AI_DIR : ROOT

test('T11 --cwd=<绝对路径>:子进程真在该目录跑,且 #EVIDENCE-CWD= 行落盘可读回', () => {
  const file = resolve(ROOT, '.ihui-agent', 'tmp', 'mirror-cwd-ok.txt')
  try {
    execFileSync(
      process.execPath,
      [TOOL, file, `--cwd=${CWD_DIR}`, '--', process.execPath, '-e', 'console.log(process.cwd())'],
      { cwd: ROOT, windowsHide: true, timeout: 120_000, stdio: 'ignore' },
    )
    const txt = readFileSync(file, 'utf8')
    assert.ok(
      txt.includes(`#EVIDENCE-CWD=${CWD_DIR}`),
      `CWD 行没落盘,证据头部:${txt.slice(0, 200)}`,
    )
    assert.ok(
      txt.includes(CWD_DIR),
      '子进程 stdout 必须打出该目录(证明 spawn 的 cwd 真的换了,不是只记了一行字)',
    )
  } finally {
    try {
      rmSync(file, { force: true })
    } catch {
      /* 清不掉不影响结论 */
    }
  }
})

test('T12 --verify --expect-cwd=<同值> ⇒ complete / exit 0,且原样报出 CWD 行', () => {
  const file = resolve(ROOT, '.ihui-agent', 'tmp', 'mirror-cwd-same.txt')
  try {
    execFileSync(
      process.execPath,
      [TOOL, file, `--cwd=${CWD_DIR}`, '--', process.execPath, '-e', 'console.log(process.cwd())'],
      { cwd: ROOT, windowsHide: true, timeout: 120_000, stdio: 'ignore' },
    )
    const out = execFileSync(
      process.execPath,
      [TOOL, '--verify', file, `--expect-cwd=${CWD_DIR}`],
      {
        cwd: ROOT,
        windowsHide: true,
        timeout: 120_000,
        encoding: 'utf8',
      },
    )
    assert.match(out, /complete/)
    assert.match(
      out,
      new RegExp(CWD_DIR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      'verify 必须把 CWD 行原样报出',
    )
  } finally {
    try {
      rmSync(file, { force: true })
    } catch {
      /* 清不掉不影响结论 */
    }
  }
})

test('T13 --verify --expect-cwd=<不同值> ⇒ truncated / exit 3(取证面错了 ⇒ 结论无效,不得 complete)', () => {
  const file = resolve(ROOT, '.ihui-agent', 'tmp', 'mirror-cwd-diff.txt')
  let status = null
  let out = ''
  try {
    execFileSync(
      process.execPath,
      [TOOL, file, `--cwd=${CWD_DIR}`, '--', process.execPath, '-e', 'process.exit(0)'],
      { cwd: ROOT, windowsHide: true, timeout: 120_000, stdio: 'ignore' },
    )
    try {
      execFileSync(
        process.execPath,
        [TOOL, '--verify', file, `--expect-cwd=${resolve(ROOT, 'scripts')}`],
        {
          cwd: ROOT,
          windowsHide: true,
          timeout: 120_000,
          encoding: 'utf8',
        },
      )
    } catch (e) {
      status = e.status
      out = String(e.stdout ?? '')
    }
    assert.equal(status, 3, 'cwd 不符必须 exit 3(INCOMPLETE),不得发合格证')
    assert.match(out, /truncated/, '判据落点必须是 truncated 那一族')
  } finally {
    try {
      rmSync(file, { force: true })
    } catch {
      /* 清不掉不影响结论 */
    }
  }
})

test('T14 回归锁:不带 --cwd ⇒ 证据里没有 CWD 行,旧 verify 行为逐字不变', () => {
  const file = resolve(ROOT, '.ihui-agent', 'tmp', 'mirror-cwd-none.txt')
  try {
    execFileSync(
      process.execPath,
      [TOOL, file, '--', process.execPath, '-e', 'console.log(process.cwd());process.exit(0)'],
      { cwd: ROOT, windowsHide: true, timeout: 120_000, stdio: 'ignore' },
    )
    const txt = readFileSync(file, 'utf8')
    assert.ok(!txt.includes('#EVIDENCE-CWD='), '默认形态不得多出 CWD 行(既有调用方零感知)')
    execFileSync(process.execPath, [TOOL, '--verify', file], {
      cwd: ROOT,
      windowsHide: true,
      timeout: 120_000,
      stdio: 'ignore',
    })
  } finally {
    try {
      rmSync(file, { force: true })
    } catch {
      /* 清不掉不影响结论 */
    }
  }
})

test('T15 expect-cwd 判据从源文件 import(§22c:镜像不得抄第二份),三臂 + 大小写归一', () => {
  const t = gate.__test__
  assert.equal(typeof t.CWD_MARK, 'string', '__test__ 缺 CWD_MARK')
  assert.equal(typeof t.normCwd, 'function', '__test__ 缺 normCwd')
  const j = t.judgeEvidence
  const M = t.RC_MARK
  const C = t.CWD_MARK
  const ev = `${C}${CWD_DIR}\n${M}0\n`
  assert.equal(j(ev, CWD_DIR).kind, 'complete', '同值必须放行')
  assert.equal(j(ev, resolve(ROOT, 'scripts')).kind, 'truncated', '异值必须拦')
  assert.equal(j(`${M}0`, CWD_DIR).kind, 'truncated', '期望给了而证据未记录 ⇒ 也不得发合格证')
  if (process.platform === 'win32') {
    const flip = CWD_DIR.toLowerCase() === CWD_DIR ? CWD_DIR.toUpperCase() : CWD_DIR.toLowerCase()
    assert.equal(j(ev, flip).kind, 'complete', 'win32 同一目录的大小写两种写法不得误判')
  }
})

test('T-新 相对证据路径不得逃逸仓库根(2026-09-27 由一次真实手滑撞出来)', () => {
  const { resolveEvidencePath } = gate
  // 放行:仓库内的相对落点就是本工具的正常用法
  assert.equal(resolveEvidencePath('.ihui-agent/tmp/x.txt'), resolve(ROOT, '.ihui-agent/tmp/x.txt'))
  assert.equal(resolveEvidencePath('scripts/x.txt'), resolve(ROOT, 'scripts/x.txt'))
  // 判死:`..` 逃出去 —— 旧实现会把它 resolve 成盘根文件,而那是 §15/§28 明令禁止的落点
  for (const bad of ['../x.txt', '../../x.txt', '.ihui-agent/../../x.txt']) {
    assert.throws(() => resolveEvidencePath(bad), /逃出了仓库根/, `必须拒:${bad}`)
  }
  // 绝对路径不在这一判据射程(落点由调用方按 §15b/§26 负责),但必须原样传下去
  const abs = process.platform === 'win32' ? 'D:\\somewhere\\x.txt' : '/tmp/x.txt'
  assert.equal(resolveEvidencePath(abs), abs)
})

test('T-新 CLI 层:逃逸路径 exit 2 且**一个字节都不写**(拒绝必须发生在打开句柄之前)', () => {
  const outside = resolve(ROOT, '..', 'evidence-escape-should-not-exist.txt')
  rmSync(outside, { force: true })
  let status = null
  try {
    execFileSync(
      process.execPath,
      [TOOL, '../evidence-escape-should-not-exist.txt', '--', process.execPath, '-e', '0'],
      { encoding: 'utf8', windowsHide: true, timeout: 30_000 },
    )
  } catch (e) {
    status = e.status
  }
  assert.equal(status, 2, `逃逸路径必须 exit 2,实得 ${status}`)
  assert.equal(existsSync(outside), false, '判死之前先把文件建出来 ⇒ 这道拒绝只是装饰')
})
