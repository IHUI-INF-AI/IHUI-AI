// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
    stdio: ['ignore', 'pipe', 'pipe'],
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
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
    'evidence-selftest-250ms.txt',
    'evidence-selftest-badtimeout.txt',
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
        stdio: ['ignore', 'pipe', 'pipe'],
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
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
          stdio: ['ignore', 'pipe', 'pipe'],
          // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
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
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      { encoding: 'utf8', windowsHide: true, timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'] },
    )
  } catch (e) {
    status = e.status
  }
  assert.equal(status, 2, `逃逸路径必须 exit 2,实得 ${status}`)
  assert.equal(existsSync(outside), false, '判死之前先把文件建出来 ⇒ 这道拒绝只是装饰')
})

test('T16 被包装命令的输出**不以换行收尾** ⇒ 标记仍必须独占一行、--verify 必须判 complete(2026-09-29 实测的假"截断")', () => {
  // 立因(不是假想):`cat <末尾没有换行的文件>` 这类命令的输出停在半行上,旧写法把
  // `#EVIDENCE-RC=0` 直接接在那半行后面 ⇒ 读侧按**行首**找标记找不到 ⇒ 一次**完整**的取证
  // 被读成 truncated 并要求重跑。失效方向是"少发合格证"(安全),但代价是把真证据作废,
  // 而"重跑那次恰好真被截断"就永远分不清 —— 所以这一格必须锁在提交链之外的 CI 档(§22c)。
  // 三臂:① 端到端(真派生一个无尾换行的子进程)判 complete 且 RC 行以行首出现;
  //      ② 反向锁:粘连形态(`out#EVIDENCE-RC=0`)判据**不得**认 —— 不许为了让①绿把判据放宽成
  //         "整串里含 RC_MARK 即通过",那是把"半截输出恰好带这几个字符"重新发成合格证;
  //      ③ 正文逐字保留(加固只允许在标记前补一个换行,不得动子进程写出的字节)。
  const f = resolve(ROOT, '.ihui-agent', 'tmp', 'mirror-run-noeol.txt')
  try {
    execFileSync(
      process.execPath,
      [TOOL, f, '--timeout=30000', '--', process.execPath, '-e', 'process.stdout.write("no-eol")'],
      { cwd: ROOT, windowsHide: true, timeout: 120_000, stdio: 'ignore' },
    )
    const txt = readFileSync(f, 'utf8')
    const lines = txt.split(/\r?\n/)
    assert.equal(
      lines.filter((l) => l.startsWith(gate.__test__.RC_MARK)).length,
      1,
      `RC 行必须恰好一条且以行首出现,证据末三行:${JSON.stringify(lines.slice(-3))}`,
    )
    assert.equal(
      gate.__test__.judgeEvidence(txt).kind,
      'complete',
      `无尾换行的取证被读成了 ${gate.__test__.judgeEvidence(txt).kind}(= 旧缺陷复现)`,
    )
    assert.ok(txt.includes('no-eol'), '③ 子进程正文必须逐字留在证据里')
    // ② 反向锁走**源文件那一份**判据(§22c:镜像不得抄第二份实现)
    assert.notEqual(
      gate.__test__.judgeEvidence(`out${gate.__test__.RC_MARK}0\n`).kind,
      'complete',
      '粘连形态被判成 complete ⇒ 判据被放宽成"含标记即通过"',
    )
  } finally {
    try {
      rmSync(f, { force: true })
    } catch {
      /* 清不掉由 T8 那条统一判 */
    }
  }
})

// T17–T19 —— 2026-09-29 的 `--timeout` **单位陷阱**(本机当天实录:主会话传 `--timeout=180/300/560`
// 当秒用,包装器忠实在 180 **毫秒**后 SIGTERM,于是产出的证据与"命令真挂死"逐字同形,
// 一次"git 网络卡死"的假 P0 诊断就是这么来的)。判据住在源文件的 parseTimeoutMs,
// 镜像只从源 import(§22c),不抄第二份。

test('T17 CLI 层:裸 --timeout=300 ⇒ exit 2 + 消息点名毫秒,且证据一个字节都不写(变异自证:摘掉"裸小值拒绝"这一支本条即翻红)', () => {
  const file = resolve(ROOT, '.ihui-agent', 'tmp', 'mirror-bad-timeout.txt')
  rmSync(file, { force: true })
  let status = null
  let out = ''
  try {
    execFileSync(
      process.execPath,
      [TOOL, file, '--timeout=300', '--', process.execPath, '-e', 'console.log(1)'],
      {
        cwd: ROOT,
        windowsHide: true,
        encoding: 'utf8',
        timeout: 120_000,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    status = 0
  } catch (e) {
    status = e.status
    out = `${String(e.stderr ?? '')}${String(e.stdout ?? '')}`
  }
  const wroteEvidence = existsSync(file)
  try {
    rmSync(file, { force: true })
  } catch {
    /* 清不掉不影响结论 */
  }
  // 摘掉拒绝分支时这一发会在 ~100ms 内正常跑完 ⇒ status=0 ⇒ 本条红(不是恒真断言)。
  assert.equal(status, 2, `裸 300 必须被判用法错误(exit 2),实得 ${status};输出:${out.slice(-200)}`)
  assert.match(out, /毫秒/, '拒绝必须把**单位**说清,否则人只会再猜一次')
  assert.match(out, /--timeout=300000/, '必须给出"乘 1000"那一种正确写法')
  assert.match(out, /--timeout=300s/, '必须给出"带后缀"那一种正确写法')
  assert.equal(
    wroteEvidence,
    false,
    '判死之前先把证据建出来 ⇒ 拒绝只是装饰(读侧照样拿到一份 incomplete 证据)',
  )
})

test('T18 parseTimeoutMs 换算表与边界(从源 import):后缀小值放行 / 0=不设上限 / 坏形态判死不猜默认值', () => {
  const p = gate.__test__.parseTimeoutMs
  assert.equal(typeof p, 'function', '__test__ 缺 parseTimeoutMs(镜像拿不到就只会复读实现)')
  const okMs = (raw, ms) => {
    const r = p(raw)
    assert.ok(!r.error, `${JSON.stringify(raw)} 竟被拒:${r.error ?? ''}`)
    assert.equal(r.ms, ms, `${JSON.stringify(raw)} 换算不符`)
  }
  const rejected = (raw, ...needles) => {
    const r = p(raw)
    assert.ok(r.error, `${JSON.stringify(raw)} 竟被放行`)
    for (const n of needles) assert.ok(r.error.includes(n), `${raw} 的文案缺"${n}"`)
  }
  okMs('180s', 180_000)
  okMs('2m', 120_000)
  okMs('45000ms', 45_000)
  okMs('45000MS', 45_000)
  okMs('30_000', 30_000)
  okMs('2000', 2000)
  // 显式后缀的小值 = 明确意图,一律放行(拦它就是把工具用成障碍)
  okMs('250ms', 250)
  okMs('1s', 1000)
  okMs('0', 0)
  okMs('0ms', 0)
  rejected('300', '毫秒', '--timeout=300000', '--timeout=300s')
  rejected('1999', '毫秒')
  rejected('560', '毫秒')
  for (const bad of ['abc', '-5', '', '30_', '1e3', 's', '1.5']) rejected(bad, '看不懂')
})

test('T19 形状锁:证据文件的标记与行序未被本次改动触碰(改格式 = 让既有取证件集体失去 oracle)', () => {
  const t = gate.__test__
  // 逐字比常量:形状锁的职责正是"改了字面量就红",所以这里**必须**写字面量而不是引用常量。
  assert.equal(t.RC_MARK, '#EVIDENCE-RC=')
  assert.equal(t.KILLED_MARK, '#EVIDENCE-KILLED')
  assert.equal(t.CWD_MARK, '#EVIDENCE-CWD=')
  const file = resolve(ROOT, '.ihui-agent', 'tmp', 'mirror-shape-lock.txt')
  try {
    execFileSync(
      process.execPath,
      [
        TOOL,
        file,
        '--timeout=30s',
        '--label=shape',
        '--',
        process.execPath,
        '-e',
        'console.log("body-line")',
      ],
      { cwd: ROOT, windowsHide: true, timeout: 120_000, stdio: 'ignore' },
    )
    const txt = readFileSync(file, 'utf8')
    const lines = txt.split(/\r?\n/).filter((l) => l !== '')
    assert.ok(lines[0].startsWith('#EVIDENCE-CMD: '), `首行必须是 CMD 行,实得:${lines[0]}`)
    assert.ok(
      lines.some((l) => l.startsWith('#EVIDENCE-START: ')),
      '缺 START 行 ⇒ 时间戳维度丢了',
    )
    // 行序按 HEAD 既有形态钉:… 正文 … #EVIDENCE-RC=<n> 之后跟一条 #EVIDENCE-END(不是 RC 收尾)。
    const rcIdx = lines.findIndex((l) => l.startsWith('#EVIDENCE-RC='))
    assert.ok(
      rcIdx >= 0,
      `缺 RC 行 ⇒ 读侧会判 incomplete,末三行:${JSON.stringify(lines.slice(-3))}`,
    )
    assert.ok(
      lines[rcIdx + 1]?.startsWith('#EVIDENCE-END: '),
      'RC 行之后必须仍是那条 END 行(顺序被改 = 旧证据差分作废)',
    )
    assert.equal(lines.at(-1), lines[rcIdx + 1], 'END 之后不得再多出行')
    assert.equal(lines.filter((l) => l.startsWith('#EVIDENCE-RC=')).length, 1, 'RC 行必须恰好一条')
    assert.ok(txt.includes('body-line'), '被包装命令的正文必须逐字留在证据里')
    // 不得凭空多出没在案的标记行(新标记要连同读侧判据一起改,不能只写一半)
    const allowed = [
      '#EVIDENCE-CMD: ',
      '#EVIDENCE-LABEL: ',
      '#EVIDENCE-START: ',
      '#EVIDENCE-CWD=',
      '#EVIDENCE-END: ',
      '#EVIDENCE-RC=',
      '#EVIDENCE-ERROR: ',
      '#EVIDENCE-KILLED',
    ]
    const strangers = lines
      .filter((l) => l.startsWith('#EVIDENCE-'))
      .filter((l) => !allowed.some((a) => l.startsWith(a)))
    assert.deepEqual(strangers, [], `出现未在案的证据标记:${strangers.join(' | ')}`)
  } finally {
    try {
      rmSync(file, { force: true })
    } catch {
      /* 清不掉不影响结论 */
    }
  }
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

test('T20 CLI 层:`--cwd <值>`(空格形式)必须 exit 2 且不写证据 —— 它过去被静默忽略,于是"在端目录跑"的取证其实跑在仓根', () => {
  const file = resolve(ROOT, '.ihui-agent', 'tmp', 'mirror-space-cwd.txt')
  rmSync(file, { force: true })
  let status = null
  let out = ''
  try {
    execFileSync(
      process.execPath,
      [TOOL, file, '--cwd', ROOT, '--', process.execPath, '-e', 'console.log(1)'],
      {
        cwd: ROOT,
        windowsHide: true,
        encoding: 'utf8',
        timeout: 120_000,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    status = 0
  } catch (e) {
    status = e.status
    out = `${String(e.stderr ?? '')}${String(e.stdout ?? '')}`
  }
  const wrote = existsSync(file)
  rmSync(file, { force: true })
  assert.equal(
    status,
    2,
    `空格形式 --cwd 必须判用法错误(exit 2),实得 ${status};输出:${out.slice(-220)}`,
  )
  assert.match(out, /--cwd=<值>/, '报错必须给出正确写法,否则人只会再猜一次形式')
  assert.equal(wrote, false, '判死前就把证据建出来 ⇒ 拒绝成了装饰(读侧仍拿到一份 incomplete 证据)')
})

test('T21 CLI 层正向对照:等值形态 --cwd= 必须真的换到那个目录(证明 V 档不是"一律拒绝")', () => {
  const target = resolve(ROOT, 'packages', 'shared')
  const file = resolve(ROOT, '.ihui-agent', 'tmp', 'mirror-eq-cwd.txt')
  rmSync(file, { force: true })
  execFileSync(
    process.execPath,
    [TOOL, file, `--cwd=${target}`, '--', process.execPath, '-p', 'process.cwd()'],
    {
      cwd: ROOT,
      windowsHide: true,
      encoding: 'utf8',
      timeout: 120_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  const txt = readFileSync(file, 'utf8')
  rmSync(file, { force: true })
  assert.ok(txt.includes(target), '被包装命令必须跑在指定目录')
  assert.match(txt, /#EVIDENCE-CWD=/, '证据里必须留下 cwd 行,否则读侧无从知道跑在哪一面')
})

test('T22 CLI 层:--verify 一份根本不存在的证据 ⇒ exit 3(不得把"没有取证"读成"取证且成功")', () => {
  const ghost = resolve(ROOT, '.ihui-agent', 'tmp', 'mirror-ghost-evidence.md')
  rmSync(ghost, { force: true })
  let status = 0
  let out = ''
  try {
    out = execFileSync(process.execPath, [TOOL, '--verify', ghost], {
      cwd: ROOT,
      windowsHide: true,
      encoding: 'utf8',
      timeout: 120_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    status = e.status
    out = `${e.stdout ?? ''}${e.stderr ?? ''}`
  }
  assert.equal(
    status,
    3,
    `missing-file 必须落 INCOMPLETE(3),实得 ${status};输出:${out.slice(-200)}`,
  )
  assert.match(out, /INCOMPLETE\(missing-file\)/, '必须点名是"文件不存在",不得只给一个码')
  // 反向对照:同一取法在真存在的成功件上必须仍是 0 —— 否则本条只是"verify 永远 3"。
  const real = resolve(ROOT, '.ihui-agent', 'tmp', 'mirror-real-evidence.md')
  rmSync(real, { force: true })
  execFileSync(process.execPath, [TOOL, real, '--', process.execPath, '-e', 'process.exit(0)'], {
    cwd: ROOT,
    windowsHide: true,
    encoding: 'utf8',
    timeout: 120_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let okStatus = 0
  try {
    execFileSync(process.execPath, [TOOL, '--verify', real], {
      cwd: ROOT,
      windowsHide: true,
      encoding: 'utf8',
      timeout: 120_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    okStatus = e.status
  }
  rmSync(real, { force: true })
  assert.equal(okStatus, 0, `真存在的成功证据必须仍 exit 0,实得 ${okStatus}`)
})
