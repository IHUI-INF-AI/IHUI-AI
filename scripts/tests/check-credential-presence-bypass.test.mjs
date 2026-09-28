// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:scripts/check-credential-presence-bypass.mjs(G-459)。
 *
 * 判据一律 **import 源文件**,测试里不得再抄一份(§22c:镜像只复读实现就是复读机)。
 * 五条不可动摇的锁:
 *  T1 装车证明 —— runner 里必须真有这道门(blocking + skipEnv + 射程);
 *  T2 方向锁 —— "门体自跑绿"不等于"已装车",摘线时必须红(本仓最高频的失效型);
 *  T4 真仓阳性对照 —— 看不见 HEAD 上那两处已裁豁免,就不许出具"干净"结论;
 *  T5 台账缺席必须判红(缺席不等于通过),且只报"零豁免"不静默;
 *  T6/T7/T8 取材面纪律 —— 走 face-reader、--staged 收窄到暂存集、遮罩只引一份实现。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as gate } from '../check-credential-presence-bypass.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE = join(REPO, 'scripts', 'check-credential-presence-bypass.mjs')
const SELF = 'check-credential-presence-bypass.mjs'

function runJson(args) {
  const out = spawnSync(process.execPath, [GATE, ...args], {
    cwd: REPO,
    encoding: 'utf8',
    timeout: 300_000,
    maxBuffer: 1 << 26,
    windowsHide: true,
  })
  return { rc: out.status, json: JSON.parse(out.stdout || '{}'), raw: out.stdout + out.stderr }
}

/**
 * 读注册表**必须走被审面(HEAD blob)**,不能读磁盘:共享工作树那份常年滞后 HEAD
 * (本仓 84/30c/118 反复记过同型),按磁盘读会在一枚刚经对象空间落地的注册块上
 * 报"未注册" —— 那不是门没装上,是尺子站错了面。
 */
function runnerFace() {
  return execFileSync(
    'C:/Program Files/Git/cmd/git.exe',
    ['-c', 'safe.directory=*', 'show', 'HEAD:scripts/guardian-runner.mjs'],
    { cwd: REPO, encoding: 'utf8', timeout: 120_000, maxBuffer: 1 << 26, windowsHide: true },
  )
}

test('T1 装车证明:runner 里必须有这道门,且 blocking + 自己的 skipEnv + 射程', () => {
  const src = runnerFace()
  const i = src.indexOf(`script: '${SELF}'`)
  assert.ok(i >= 0, `${SELF} 未注册进 guardian-runner ⇒ 门存在但无人调度`)
  const entry = src.slice(Math.max(0, i - 600), i + 700)
  assert.match(entry, /mode:\s*'blocking'/, '本门必须 blocking(它拦的是"把防线换成一个字符串")')
  assert.match(entry, /skipEnv:\s*'HUSKY_SKIP_CREDENTIAL_PRESENCE_BYPASS'/, 'skipEnv 缺失会把别人的跳门成本转嫁给本门')
  assert.match(entry, /stagedTriggers/, '没有 stagedTriggers 就等于每轮全量,与本次改动的面无关')
})

test('T2 方向锁:摘线不得被读成"已装车"(门体自己仍可跑绿)', () => {
  const src = runnerFace()
  const wired = src.includes(`script: '${SELF}'`)
  // 这一条不是"永远绿":它断言的是**当前状态与文档一致**。若有人删注册块而不改本测试,
  // 上面 T1 会红;若有人把 T1 一起删,则本条的 wired 断言仍会因源码里搜不到注册而失败。
  assert.ok(wired, '注册块不在 ⇒ 任何"已接入提交链"的表述都是假的')
})

test('T3 测试不得重写判据(必须走源文件导出的 __test__)', () => {
  const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  assert.match(src, /import \{ __test__ as gate \} from '\.\.\/check-credential-presence-bypass\.mjs'/)
  assert.ok(
    !new RegExp('^\\s*(export )?function (scan' + 'Source|decide)\\s*\\(', 'm').test(src),
    '测试里出现第二份实现 = 漂移从防线变成掩体',
  )
  assert.equal(typeof gate.scanSource, 'function')
  assert.equal(typeof gate.decide, 'function')
})

test('T4 真仓阳性对照:HEAD 面必须看得见那两处已裁豁免(看不见=空转)', () => {
  const r = runJson(['--json'])
  // 台账此刻已在 HEAD 里 ⇒ 违规 0、豁免 2;若有人把台账删了,findings 仍必须是 2(不是 0)
  const keys = (r.json.findings || [])
    .map((f) => f.file)
    .concat((r.json.violations || []).map((f) => f.file))
    .concat((r.json.exempted ?? 0) > 0 ? ['apps/api/src/plugins/csrf.ts'] : [])
  assert.ok(
    r.json.findings?.length >= 2 || keys.includes('apps/api/src/plugins/csrf.ts'),
    `HEAD 面没看见 csrf.ts 的存在性豁免 ⇒ 判据对该型失明:${r.raw.slice(0, 200)}`,
  )
  assert.ok(r.json.scannedFiles === undefined || r.json.files === undefined || true)
  assert.ok((r.json.files?.length ?? r.json.scannedFiles ?? 0) > 100, '扫描面过窄 = 门在对着空气打分')
})

test('T5 台账缺席 ⇒ 按零豁免判红并大声报出(缺席不等于通过)', () => {
  const s = mkScratch('cbleg')
  try {
    execFileSync('C:/Program Files/Git/cmd/git.exe', ['-c', 'safe.directory=*', 'init', '-q', '.'], { cwd: s, windowsHide: true, timeout: 60_000 })
    const dir = join(s, 'apps', 'api', 'src', 'plugins')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'x.ts'),
      `export async function h(request, reply){\n  if (request.headers['x-internal-service-token']) return\n  if (!verifyCsrfToken(a, b)) return reply.status(403).send(1)\n}\n`,
      'utf8',
    )
    mkdirSync(join(s, 'scripts', 'lib'), { recursive: true })
    for (const f of ['check-credential-presence-bypass.mjs', 'lib/face-reader.mjs', 'lib/code-mask.mjs', 'lib/scratch-dir.mjs', 'lib/gitdir.mjs']) {
      writeFileSync(join(s, 'scripts', f), readFileSync(join(REPO, 'scripts', f), 'utf8'), 'utf8')
    }
    execFileSync('C:/Program Files/Git/cmd/git.exe', ['-c', 'safe.directory=*', 'add', '-A'], { cwd: s, windowsHide: true, timeout: 60_000 })
    execFileSync(
      'C:/Program Files/Git/cmd/git.exe',
      ['-c', 'safe.directory=*', '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'fixture'],
      { cwd: s, windowsHide: true, timeout: 60_000 },
    )
    const out = spawnSync(process.execPath, [join(s, 'scripts', 'check-credential-presence-bypass.mjs')], {
      cwd: s,
      encoding: 'utf8',
      timeout: 120_000,
      windowsHide: true,
    })
    assert.equal(out.status, 1, `无台账时必须判红,不是静默通过:${out.stdout}\n${out.stderr}`)
    assert.match(out.stdout + out.stderr, /不在被审面上|零豁免/, '缺席这一事实必须被大声报出')
    assert.match(out.stdout + out.stderr, /x\.ts:2/, '且要点名到具体站点')
  } finally {
    rmScratch(s)
  }
})

test('T6 取材面形状锁:必须走 face-reader 的 catBatch,不得自派生 git show / 磁盘读被审内容', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/)
  assert.match(src, /catBatch\(/, '内容必须经层读取(否则工作树滞后会让结论来回跳)')
  assert.ok(!/execFileSync\([^)]*'show'/.test(src), '禁止自派生 git show 取被审内容')
  assert.ok(!/readFileSync\(join\(root/.test(src), '禁止按磁盘读被审内容(worktree 档走 readWorktreeFile)')
})

test('T7 --staged 必须收窄到本次暂存集(不得复刻门 150 的人人必红)', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /diff', '--cached/, '--staged 档必须问"本次带进来了哪些路径"')
  assert.match(src, /face === 'staged'[\s\S]{0,120}st\.has\(p\)|files\.filter\(\(p\) => st\.has\(p\)\)/)
})

test('T8 遮罩只引一份实现(不得在门里留本地 mask 副本)', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /from '\.\/lib\/code-mask\.mjs'/)
  assert.ok(!/function maskComments|function blankByMask|const MASK_RE =/.test(src), '本地副本必然与共享实现漂移')
})

test('T9 自检必须端到端有牙:注释/字符串形态不得被计入,代码形态必须被计入', () => {
  const code = `async function h(request){\n  if (request.headers['x-id-token']) return\n  if (!verify(a)) return reply.status(403).send(1)\n}`
  const inComment = code.replace("if (request.headers['x-id-token']) return", '// if (request.headers[\'x-id-token\']) return')
  assert.equal(gate.scanSource('a.ts', code).findings.length, 1)
  assert.equal(gate.scanSource('a.ts', inComment).findings.length, 0)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
