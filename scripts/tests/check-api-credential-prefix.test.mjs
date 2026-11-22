// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/tests/check-api-credential-prefix.test.mjs
 *
 * 凭据前缀门(无 guardian id;挂在 `scripts/lib/pre-commit-hook.js` 的独立 blocking 步)的
 * §22c 镜像单测。**不在这里复制第二份判据** —— 规则表与 scanFile 一律 import 源脚本的 __test__。
 *
 * 2026-09-28 取材面收口时新增本文件,打四类东西:
 *  ① 可注入性:门按 `ROOT = process.cwd()` 定根 ⇒ 测试必须能在临时 git 仓里跑它(cwd 换根),
 *     否则"审夹具"会静默变成"审真仓"(守门 70 那一型);
 *  ② 三面三答:同一棵临时仓 HEAD 干净 / 索引一份违规 / 磁盘两份违规 ⇒ 三档各答各的;
 *  ③ CLI 契约:两面旗同给 ⇒ 2、无提交 ⇒ 2、空扫 ⇒ 2、**暂存档零候选 ⇒ 0**(那条边界不得被
 *     顺手收紧成替每次提交挡路的恒挡门,§12e)、仓库子目录当 cwd ⇒ 2(assertRepoRoot 判死,
 *     而不是"✅ 一致(0 个文件)"那种把没扫写成扫过);
 *  ④ 源码级反向锁:不得回到 node:fs 直读 / 不得散写 git 派生 / 默认档必须写死 'head' /
 *     必须有 §22d isDirectRun 守卫(否则任何 import 都会把 CLI 跑一遍并 process.exit)。
 *     这类失效只有源码锁能防 —— 行为断言会跟着实现一起漂绿。
 *
 * 运行:node --test scripts/tests/check-api-credential-prefix.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { catBatch } from '../lib/face-reader.mjs'
import { maskComments } from '../lib/code-mask.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(HERE, '..')
const REPO = resolve(HERE, '..', '..')
const GATE_REL = 'check-api-credential-prefix.mjs'
const GATE_ABS = join(SCRIPTS_DIR, GATE_REL)
const GIT = resolveGitBin() || 'git'

const {
  RULES,
  LINE_ALLOW,
  inScope,
  isExcluded,
  selectCandidate,
  scanFile,
  faceFromArgv,
  decideExit,
} = (await import(pathToFileURL(GATE_ABS).href)).__test__

const REL = 'docs/credential.md'
const CLEAN = '# 认证\n\nAuthorization: Bearer ihui_xxx\n'
const BAD1 = '# 认证\n\nAuthorization: Bearer sk-xxx\n'
const BAD2 = '# 认证\n\nAuthorization: Bearer sk-xxx\nIHUI_API_KEY="sk-your-api-key"\n'

function gitIn(dir, args) {
  return execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
    maxBuffer: 32 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function put(rel, text, cwd) {
  const abs = join(cwd, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
}

/** 铺一棵临时仓:HEAD 默认放"干净那份"(所以默认档必须绿),门本体留在真仓(它按 cwd 定根)。 */
function writeRepo(dir, { commit = true, body = CLEAN, extra = true } = {}) {
  gitIn(dir, ['init', '-q'])
  gitIn(dir, ['config', 'user.email', 'gate@fixture.local'])
  gitIn(dir, ['config', 'user.name', 'gate-fixture'])
  gitIn(dir, ['config', 'commit.gpgsign', 'false'])
  if (extra) put(REL, body, dir)
  put('README.md', '# 项目根文档\n', dir)
  put('apps/web/notes.js', 'export const a = 1\n', dir)
  if (commit) {
    gitIn(dir, ['add', '-A'])
    gitIn(dir, ['commit', '-q', '-m', 'fixture'])
  }
  return dir
}

/**
 * 以 cwd 换根跑门(ROOT = process.cwd()):这是本门唯一提供给夹具的注入通道,生产调用不带它。
 * 用 spawnSync 而不是 execFileSync:**违规报告走的是 stderr**,而 execFileSync 的返回值只有
 * stdout —— 拿它当"门的输出"会让红的那一支读起来像空输出,断言就退化成"没看到就算过"。
 */
function run(dir, args) {
  const r = spawnSync(process.execPath, [GATE_ABS, ...args], {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: dir,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 300_000,
    maxBuffer: 64 << 20,
  })
  return {
    code: typeof r.status === 'number' ? r.status : -1,
    out: `${r.stdout ?? ''}${r.stderr ?? ''}`,
  }
}

/** 结论行里的"发现 N 处" / "一致(N 个文件)" —— 三面三答靠它区分,而不是只看退出码。 */
function findingsOf(out) {
  const m = /发现\s+(\d+)\s+处凭据前缀误用/.exec(out)
  if (m) return Number(m[1])
  if (/凭据前缀一致/.test(out)) return 0
  throw new Error(`结论行解不出违规计数:${out.slice(0, 260)}`)
}

test('判据本体:六条规则与三档豁免在 import 的源实现里,本测试不复制第二份', () => {
  assert.equal(RULES.length, 6, '规则表条数是判据的一部分,漂移必须点名')
  // 命中/放过成对(逐字取自真事故形状,不是自造夹具)
  const hit = (line) =>
    LINE_ALLOW.some((re) => re.test(line)) === false && RULES.some((r) => r.re.test(line))
  assert.ok(hit('-H "Authorization: Bearer sk-xxx"'), 'Bearer + sk- 必须命中')
  assert.ok(!hit('Authorization: Bearer ihui_xxx'), '正确写法必须放过')
  assert.ok(!hit('"apiKey": "sk-***"'), '脱敏展示值走 LINE_ALLOW,不得判红')
  assert.ok(
    !hit('"openai": {"api_key": "sk-...", "api_base": "https://api.openai.com/v1"},'),
    '上游厂商 key 不命中',
  )
})

test('scanFile 不再碰磁盘:正文由调用方按判定面传入,取不到绝不返回空数组', () => {
  const found = scanFile(REL, BAD1)
  assert.equal(found.length, 1, '同一份文本必须判出 1 处')
  assert.equal(found[0].file, REL)
  assert.equal(found[0].rule, 'bearer-sk')
  assert.equal(scanFile(REL, CLEAN).length, 0)
  // 反向锁:判据面没有磁盘通道 —— scanFile 只吃 text。传非字符串必须炸给调用方,而不是静默 []
  assert.throws(() => scanFile(REL, null), 'null 正文不得被洗成"扫过且干净"')
})

test('F1 临时仓 HEAD 上的违规被点名(审的是夹具,不是真仓)', () => {
  const dir = mkScratch('cred-f1-')
  try {
    writeRepo(dir, { body: BAD1 })
    const r = run(dir, [])
    assert.equal(r.code, 0, `全量档是报告档,按旧语义仍 exit 0,实得 ${r.code}:${r.out}`)
    assert.equal(findingsOf(r.out), 1, `HEAD 面必须判出 1 处,实得 ${r.out}`)
    assert.ok(r.out.includes(REL), '红的输出必须点名文件(归因铰链靠它判断能不能跳门)')
    assert.match(r.out, /取材面:head/, '结论行必须写出是哪一面')
  } finally {
    rmScratch(dir)
  }
})

test('F2 三面三答:HEAD 干净 / 索引一份违规 / 磁盘两份违规 ⇒ 三档各答各的', () => {
  const dir = mkScratch('cred-f2-')
  try {
    writeRepo(dir) // HEAD = CLEAN ⇒ 0 处
    put(REL, BAD1, dir)
    gitIn(dir, ['add', REL]) // 索引 = 1 处
    put(REL, BAD2, dir) // 磁盘 = 2 处(第三份)
    const h = run(dir, [])
    const s = run(dir, ['--staged'])
    const w = run(dir, ['--worktree'])
    assert.equal(h.code, 0, `HEAD 面干净 ⇒ 0,实得 ${h.code}:${h.out}`)
    assert.equal(findingsOf(h.out), 0)
    assert.equal(findingsOf(s.out), 1, `--staged 必须判索引里那一份,实得 ${s.out}`)
    assert.equal(s.code, 1, '暂存档发现违规 ⇒ 1(退出码含义与旧版逐字同形)')
    assert.ok(s.out.includes(REL), '暂存档的红必须点名文件')
    assert.equal(
      findingsOf(w.out),
      2,
      `--worktree 必须看到磁盘那第三份(2 处),实得 ${findingsOf(w.out)}`,
    )
    assert.equal(w.code, 0, `磁盘面是人工档 ⇒ 不判红,实得 ${w.code}`)
  } finally {
    rmScratch(dir)
  }
})

test('F3 两面旗同给 ⇒ exit 2 并喊"无法判定"(不得任选一面冒充判定)', () => {
  const dir = mkScratch('cred-f3-')
  try {
    writeRepo(dir)
    const r = run(dir, ['--staged', '--worktree'])
    assert.equal(r.code, 2, `期望 2,实得 ${r.code}:${r.out}`)
    assert.match(r.out, /无法判定/)
  } finally {
    rmScratch(dir)
  }
})

test('F4 还没有提交 ⇒ exit 2,不得记成"没有违规"', () => {
  const dir = mkScratch('cred-f4-')
  try {
    writeRepo(dir, { commit: false })
    const r = run(dir, [])
    assert.equal(r.code, 2, `无提交 ⇒ 取不到 HEAD ⇒ 2,实得 ${r.code}:${r.out}`)
    assert.match(r.out, /无法判定/)
  } finally {
    rmScratch(dir)
  }
})

test('F5 全量面枚举到 0 个射程内候选 ⇒ 判死(空扫不是通过)', () => {
  const dir = mkScratch('cred-f5-')
  try {
    // 只放不在 SCAN_ROOTS 里的文件 ⇒ 面上一个候选都没有
    gitIn(dir, ['init', '-q'])
    gitIn(dir, ['config', 'user.email', 'g@f.local'])
    gitIn(dir, ['config', 'user.name', 'g'])
    put('elsewhere/x.md', BAD1, dir)
    gitIn(dir, ['add', '-A'])
    gitIn(dir, ['commit', '-q', '-m', 'out-of-scope'])
    const r = run(dir, [])
    assert.equal(r.code, 2, `空扫必须判死,实得 ${r.code}:${r.out}`)
    assert.match(r.out, /枚举到 0 个/)
  } finally {
    rmScratch(dir)
  }
})

test('F6 暂存档零候选 ⇒ 0 —— 那条边界不得被"顺手收紧"成替每次提交挡路', () => {
  const dir = mkScratch('cred-f6-')
  try {
    writeRepo(dir, { body: BAD1 }) // HEAD 上是脏的(全量档会报),但本次什么都没暂存
    const r = run(dir, ['--staged'])
    assert.equal(r.code, 0, `本次没暂存射程内文件 ⇒ 沿用旧语义放行,实得 ${r.code}:${r.out}`)
    assert.match(r.out, /0 个已暂存文件/)
  } finally {
    rmScratch(dir)
  }
})

test('F7 cwd 落在仓库子目录 ⇒ exit 2,不得打"✅ 一致(0 个文件)"', () => {
  const dir = mkScratch('cred-f7-')
  try {
    writeRepo(dir)
    // 旧形态在这一步会拿到**前缀相对路径**(git 在子目录里就是这么回的),inScope 一条都不匹配
    // ⇒ 打"✅ 凭据前缀一致(0 个文件)"。那正是本仓最高频的失效型:把"根本没扫"写成通过。
    const r = run(join(dir, 'docs'), [])
    assert.equal(r.code, 2, `ROOT 不是仓库根必须判死,实得 ${r.code}:${r.out}`)
    assert.match(r.out, /无法判定/)
    assert.doesNotMatch(r.out, /凭据前缀一致/, '这一档绝不允许出现成功口吻')
  } finally {
    rmScratch(dir)
  }
})

test('F8 纯函数级三面与退出码(构造面证明,不依赖仓库瞬时状态)', () => {
  assert.equal(faceFromArgv([]).face, 'head', '默认档必须是 HEAD')
  assert.equal(faceFromArgv(['--staged']).face, 'staged')
  assert.equal(faceFromArgv(['--worktree']).face, 'worktree')
  assert.ok(faceFromArgv(['--staged', '--worktree']).error, '两旗同给必须给 error')
  const base = { face: 'head', files: [REL], unreadable: [], findings: [] }
  assert.equal(decideExit(base), 0)
  assert.equal(
    decideExit({ ...base, findings: [{ rule: 'bearer-sk' }] }),
    0,
    '全量档只报告 ⇒ 0(旧语义)',
  )
  assert.equal(
    decideExit({ ...base, face: 'staged', findings: [{ rule: 'bearer-sk' }] }),
    1,
    '暂存档有违规 ⇒ 1(旧语义)',
  )
  assert.equal(decideExit({ ...base, unreadable: [REL] }), 2, '面上取不到正文 ⇒ 2,不回落另一面')
  assert.equal(decideExit({ ...base, files: [] }), 2, '全量面空扫 ⇒ 2')
  assert.equal(decideExit({ ...base, files: [], face: 'staged' }), 0, '暂存档空扫 ⇒ 0(见 F6)')
  assert.equal(inScope('docs/a.md'), true)
  assert.equal(inScope('README.md'), true, '根文档按**全等**匹配(不是 startsWith)')
  assert.equal(inScope('README.mdx'), false)
  assert.equal(isExcluded('docs/tests/a.md'), true)
  assert.equal(selectCandidate('docs/dist/a.md'), false, '忽略目录段不进候选')
})

test('T1 反向锁(源码级):门不得回到磁盘直读 / 散写 git / 无守卫的顶层 exit', () => {
  const src = readFileSync(GATE_ABS, 'utf8')
  const code = maskComments(src) // 遮噪只引那一份实现,不在此复制剥注释逻辑
  const locks = [
    ['不得 import node:fs(正文一律走层的读取入口)', !/from\s+'node:fs'/.test(code)],
    ['不得再散写 git 派生(execSync/execFileSync)', !/\b(?:execSync|execFileSync)\s*\(/.test(code)],
    ['不得回到 readdirSync/statSync 磁盘枚举', !/\b(?:readdirSync|statSync)\s*\(/.test(code)],
    [
      '正文必须经 catBatch 或 readWorktreeFile',
      /catBatch\s*\(/.test(code) || /readWorktreeFile\s*\(/.test(code),
    ],
    ["默认档必须写死 'head'(改成磁盘档就是回到旧形态)", /def:\s*'head'/.test(code)],
    [
      '必须有 §22d isDirectRun 守卫(顶层裸 process.exit(main()) 会让 import 就把 CLI 跑完)',
      /isDirectRun/.test(code),
    ],
    [
      '必须有 assertRepoRoot(子目录 cwd 会拿到前缀相对路径 ⇒ 空扫假绿)',
      /assertRepoRoot\s*\(/.test(code),
    ],
  ]
  for (const [why, ok] of locks) assert.ok(ok, why)
  // 阳性对照:同一批锁喂"回到旧形态"的合成源码 ⇒ 必须逐条抓到,否则锁只是装饰
  const bad = maskComments(
    [
      "import { execSync } from 'node:child_process'",
      "import { readdirSync, readFileSync } from 'node:fs'",
      'readdirSync(ROOT)',
      "execSync('git diff --cached --name-only')",
      "const face = selectFace({ staged: true, worktree: false, def: 'worktree' })",
      'process.exit(main())',
    ].join('\n'),
  )
  assert.match(bad, /from\s+'node:fs'/, '合成面必须被 node:fs 那条抓到')
  assert.match(bad, /\b(?:execSync|execFileSync)\s*\(/, '合成面必须被散写 git 那条抓到')
  assert.match(bad, /\b(?:readdirSync|statSync)\s*\(/, '合成面必须被磁盘枚举那条抓到')
  assert.ok(
    !/catBatch\s*\(/.test(bad) && !/readWorktreeFile\s*\(/.test(bad),
    '合成面没有层读取入口 ⇒ 该锁应命中',
  )
  assert.match(bad, /def:\s*'worktree'/, "合成面默认档写成 'worktree' ⇒ 那条锁必须能区分")
  assert.ok(
    !/isDirectRun/.test(bad) && !/assertRepoRoot\s*\(/.test(bad),
    '合成面缺两条守卫 ⇒ 该两锁应命中',
  )
})

test('T2 装车证明:提交链确有调用点且带 --staged 面旗(缺面旗就等于审上一提交态)', () => {
  const hook = catBatch(REPO, ['HEAD:scripts/lib/pre-commit-hook.js'], { maxBuffer: 1 << 28 }).get(
    'HEAD:scripts/lib/pre-commit-hook.js',
  )
  assert.equal(typeof hook, 'string', 'pre-commit-hook 的 HEAD 面必须取到')
  const line = hook.split('\n').find((l) => l.includes('check-api-credential-prefix.mjs'))
  assert.ok(line, '钩子里必须有本门的调用点,否则它只是仓库里一个没人跑的脚本')
  assert.match(
    line,
    /--staged/,
    '钩子调用必须带 --staged:门收口后默认档判 HEAD,不带面旗就是在审上一提交态',
  )
})

test('T3 --self-test 端到端 exit 0(判据自身可取证,且连跑两次同答)', () => {
  const dir = mkScratch('cred-selftest-')
  try {
    writeRepo(dir)
    const a = run(dir, ['--self-test'])
    const b = run(dir, ['--self-test'])
    assert.equal(a.code, 0, `第一次必须 0,实得 ${a.code}:${a.out}`)
    assert.equal(b.code, 0, `第二次必须仍是 0(本仓有一道门自检第二次起恒 2 —— 只跑一次等于没取证)`)
    assert.match(b.out, /规则自检通过/)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
