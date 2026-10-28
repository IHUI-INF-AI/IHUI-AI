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
 *  T4 真仓阳性对照 —— 钉**出处 ref**(票#23 那枚改动的父版本)成对正反,不钉 HEAD:账还清那天
 *     HEAD 上量不到存量是正当结果,把它当"失明"就成了永红自检(恒红只会逼人跳门);另核扫描面在位;
 *  T5 台账缺席必须判红(缺席不等于通过),且只报"零豁免"不静默 —— 并先分辨"夹具缺件/import 期崩溃"
 *     与"判红",两者退出码同为 1(Node 拒 spawn 缺失模块时的红不是仓库的红);
 *  T6/T7/T8 取材面纪律 —— 走 face-reader、--staged 收窄到暂存集、遮罩只引一份实现。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as gate } from '../check-credential-presence-bypass.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE = join(REPO, 'scripts', 'check-credential-presence-bypass.mjs')
const SELF = 'check-credential-presence-bypass.mjs'

function runJson(args) {
  const out = spawnSync(process.execPath, [GATE, ...args], {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
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
  return faceShow('scripts/guardian-runner.mjs')
}

/** 同一张面(HEAD blob)的唯一取法,供注册表与守门 108 的存活期表共用 —— 别为第二个文件再抄一份 execFileSync。 */
function faceShow(relPath) {
  return execFileSync(
    'C:/Program Files/Git/cmd/git.exe',
    ['-c', 'safe.directory=*', 'show', `HEAD:${relPath}`],
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: REPO,
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 1 << 26,
      windowsHide: true,
    },
  )
}

test('T1 装车证明:runner 里必须有这道门,且 blocking + 自己的 skipEnv + 射程', () => {
  const src = runnerFace()
  const i = src.indexOf(`script: '${SELF}'`)
  assert.ok(i >= 0, `${SELF} 未注册进 guardian-runner ⇒ 门存在但无人调度`)
  const entry = src.slice(Math.max(0, i - 600), i + 700)
  assert.match(entry, /mode:\s*'blocking'/, '本门必须 blocking(它拦的是"把防线换成一个字符串")')
  assert.match(
    entry,
    /skipEnv:\s*'HUSKY_SKIP_CREDENTIAL_PRESENCE_BYPASS'/,
    'skipEnv 缺失会把别人的跳门成本转嫁给本门',
  )
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
  assert.match(
    src,
    /import \{ __test__ as gate \} from '\.\.\/check-credential-presence-bypass\.mjs'/,
  )
  assert.ok(
    !new RegExp('^\\s*(export )?function (scan' + 'Source|decide)\\s*\\(', 'm').test(src),
    '测试里出现第二份实现 = 漂移从防线变成掩体',
  )
  assert.equal(typeof gate.scanSource, 'function')
  assert.equal(typeof gate.decide, 'function')
})

test('T4 真仓阳性对照:钉**出处 ref**而不是钉 HEAD(账还清后 HEAD 量不到存量是正当结果,不是失明)', () => {
  // 旧写法要求"HEAD 面必须看得见 csrf.ts 那处存在性豁免",而 6fb790eb70a8(票#23)已把它修成
  // 「验过才免」⇒ 从清偿那一刻起这条断言永红,红的是承诺不是仓库(2026-10-04 复测:HEAD 候选 0)。
  // 判据没放宽:换成拿对象库里那两枚 blob 喂同一把尺子,成对正反 —— 改前必命中、改后必不命中,
  // 于是"看不见"与"已修好"从此是两个不同的读数(同守门 131/150 的 PROBE_REF 路子)。
  const p = gate.probeHistorical(REPO)
  assert.ok(
    p.before.length >= 1,
    `出处 ${gate.PROBE_REV_BEFORE} 的 ${gate.PROBE_FILE} 未被命中 ⇒ 判据对该型失明:${JSON.stringify(p)}`,
  )
  assert.equal(
    p.after.length,
    0,
    `票#23 的修法形态(${gate.PROBE_REV_AFTER})仍被命中 ⇒ 门对自己认可的写法判红,按规矩写就红只会逼人 --no-verify`,
  )
  // HEAD 面只问"扫描面在不在位":对着空气打分才是不记通过的那一型。
  const r = runJson(['--json'])
  const n = r.json.files?.length ?? r.json.scannedFiles ?? 0
  assert.ok(n > 100, `扫描面过窄(实得 ${n})= 门在对着空气打分`)
})

/**
 * 闭包拷贝:从门自己 import 的东西出发,迭代到不动点。
 * **不得**按名字手列依赖清单 —— 那份清单必然随每一次 lib 演进而漂(本仓 live-doc 镜像就少拷过
 * `lib/gitdir.mjs`,五条端到端用例在**收集期** MODULE_NOT_FOUND,被折成"判红",读起来像判据有牙)。
 * 而这里更险的是:Node 崩在 import 期时退出码也是 1,与本门"判红"完全同形 ⇒ 下面的缺件断言先判。
 */
function copyScriptClosure(dstRoot) {
  const SCRIPTS = join(REPO, 'scripts')
  const seen = new Set()
  const queue = [SELF]
  while (queue.length) {
    const rel = queue.shift()
    if (seen.has(rel)) continue
    seen.add(rel)
    const abs = join(SCRIPTS, rel)
    if (!existsSync(abs)) continue
    const text = readFileSync(abs, 'utf8')
    for (const m of text.matchAll(/from\s+['"]((?:\.{1,2}\/)[^'"]+\.mjs)['"]/g)) {
      const nextAbs = resolve(dirname(abs), m[1])
      if (!nextAbs.startsWith(SCRIPTS)) continue
      const nextRel = relative(SCRIPTS, nextAbs).split(/[\\/]/).join('/')
      if (!seen.has(nextRel)) queue.push(nextRel)
    }
    const dst = join(dstRoot, 'scripts', rel)
    mkdirSync(dirname(dst), { recursive: true })
    writeFileSync(dst, text, 'utf8')
  }
  return seen
}

test('T5 台账缺席 ⇒ 按零豁免判红并大声报出(缺席不等于通过)', () => {
  const s = mkScratch('cbleg')
  try {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execFileSync(
      'C:/Program Files/Git/cmd/git.exe',
      ['-c', 'safe.directory=*', 'init', '-q', '.'],
      { stdio: ['ignore', 'pipe', 'pipe'], cwd: s, windowsHide: true, timeout: 60_000 },
    )
    const dir = join(s, 'apps', 'api', 'src', 'plugins')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'x.ts'),
      `export async function h(request, reply){\n  if (request.headers['x-internal-service-token']) return\n  if (!verifyCsrfToken(a, b)) return reply.status(403).send(1)\n}\n`,
      'utf8',
    )
    mkdirSync(join(s, 'scripts', 'lib'), { recursive: true })
    // 整层闭包递归拷,**不按名字手列清单** —— 手列那份已经少过 `lib/gitdir.mjs`,而它 import 的
    // `scripts/seal-c-root-stray.mjs` 跟着缺 ⇒ 门在 import 期崩,退出码同样是 1,与"判红"完全同形
    // (本仓记过:blocking 门的红可能是崩溃;所以下面先判缺件,再判颜色)。
    copyScriptClosure(s)
    assert.ok(
      existsSync(join(s, 'scripts', 'lib', 'face-reader.mjs')),
      '闭包没把取材层拷进来 = 拷贝器自己失效',
    )
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execFileSync('C:/Program Files/Git/cmd/git.exe', ['-c', 'safe.directory=*', 'add', '-A'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: s,
      windowsHide: true,
      timeout: 60_000,
    })
    execFileSync(
      'C:/Program Files/Git/cmd/git.exe',
      [
        '-c',
        'safe.directory=*',
        '-c',
        'user.email=t@t',
        '-c',
        'user.name=t',
        'commit',
        '-q',
        '-m',
        'fixture',
      ],
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      { stdio: ['ignore', 'pipe', 'pipe'], cwd: s, windowsHide: true, timeout: 60_000 },
    )
    const out = spawnSync(
      process.execPath,
      [join(s, 'scripts', 'check-credential-presence-bypass.mjs')],
      {
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: s,
        encoding: 'utf8',
        timeout: 120_000,
        windowsHide: true,
      },
    )
    const combo = out.stdout + out.stderr
    assert.ok(
      !/ERR_MODULE_NOT_FOUND|Cannot find module/.test(combo),
      `夹具缺件(import 期崩溃的退出码也是 1,不得被读成"判红"):${combo.slice(0, 300)}`,
    )
    assert.equal(out.status, 1, `无台账时必须判红,不是静默通过:${out.stdout}\n${out.stderr}`)
    assert.match(combo, /不在被审面上|零豁免/, '缺席这一事实必须被大声报出')
    assert.match(combo, /x\.ts:2/, '且要点名到具体站点')
  } finally {
    rmScratch(s)
  }
})

test('T6 取材面形状锁:必须走 face-reader 的 catBatch,不得自派生 git show / 磁盘读被审内容', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/)
  assert.match(src, /catBatch\(/, '内容必须经层读取(否则工作树滞后会让结论来回跳)')
  assert.ok(!/execFileSync\([^)]*'show'/.test(src), '禁止自派生 git show 取被审内容')
  assert.ok(
    !/readFileSync\(join\(root/.test(src),
    '禁止按磁盘读被审内容(worktree 档走 readWorktreeFile)',
  )
})

test('T7 --staged 必须收窄到本次暂存集(不得复刻门 150 的人人必红)', () => {
  const src = readFileSync(GATE, 'utf8')
  // 空白容忍:lint-staged 会跑 prettier,长数组实参会被折成每行一项(2026-10-04 本文件被格式化后
  // 这条逐字锁当场漂红)。形状锁要判的是"这两个实参在同一个 args 数组里挨着",不是它们的排版。
  assert.match(src, /'diff',\s*'--cached'/, '--staged 档必须问"本次带进来了哪些路径"')
  assert.match(
    src,
    /face === 'staged'[\s\S]{0,120}st\.has\(p\)|files\.filter\(\(p\) => st\.has\(p\)\)/,
  )
})

test('T8 遮罩只引一份实现(不得在门里留本地 mask 副本)', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /from '\.\/lib\/code-mask\.mjs'/)
  assert.ok(
    !/function maskComments|function blankByMask|const MASK_RE =/.test(src),
    '本地副本必然与共享实现漂移',
  )
})

test('T9 自检必须端到端有牙:注释/字符串形态不得被计入,代码形态必须被计入', () => {
  const code = `async function h(request){\n  if (request.headers['x-id-token']) return\n  if (!verify(a)) return reply.status(403).send(1)\n}`
  const inComment = code.replace(
    "if (request.headers['x-id-token']) return",
    "// if (request.headers['x-id-token']) return",
  )
  assert.equal(gate.scanSource('a.ts', code).findings.length, 1)
  assert.equal(gate.scanSource('a.ts', inComment).findings.length, 0)
})

/**
 * T12 方向锁(G-1038449):`request.query` 这一面必须看得见,且**形态/类型判断不算验真**。
 * 这条锁的由来是一次变异取证:把 REF_RE 的 query 形态去掉后,门 157 立刻退回 findings 2
 * (csrf.ts:250 重新隐形),而当时 `--self-test` 24 例与本镜像其余各条**全绿** ——
 * 也就是说新识别面当时**没有任何测试锁着**,删掉它没人会发现。这里把三条方向钉死:
 *  ① query 面的裸属性与单跳变量形态必须命中(引用面加宽的证据);
 *  ② `typeof (…)?.k === 'string'`(csrf.ts:250 的形状)必须命中 —— 裸类型比较不是值验证,
 *     旧 VERIFIED_RE 的裸 `===` 正是在这里放过它;
 *  ③ #23 的正确形态 `await isVerifiedInternalMachineCall(request)` 仍**不得**判红 ——
 *     收窄判据若把它判红,就是判据写歪(宁可门失灵也不逼人 --no-verify,设计约束 1)。
 * 另带三条反向对照:query 面的非凭据参数不得判红、真值比较(有比较对象)不得判红、
 * query 面走 secretsEqual 验真不得判红。
 */
test('T12 query 面必须看得见 + 裸类型比较不算验真 + #23 形态仍放过', () => {
  const ENF = `\n  if (!verifyCsrfToken(a, b)) return reply.status(403).send(1)\n}`
  assert.equal(
    gate.scanSource(
      'a.ts',
      `async function h(request, reply){\n  if (request.query.key) return${ENF}`,
    ).findings.length,
    1,
    'query 裸属性必须命中',
  )
  assert.equal(
    gate.scanSource(
      'a.ts',
      `async function h(request, reply){\n  const k = request.query?.key\n  if (k) return${ENF}`,
    ).findings.length,
    1,
    'query 单跳变量必须命中',
  )
  // 类型守卫包裹的 query 存在性(csrf.ts:250 的形状;只抄形状,不含任何真实凭据取值)
  const guarded = `async function h(request, reply){\n  if (typeof (request.query as { key?: unknown } | undefined)?.key === 'string') return${ENF}`
  assert.equal(
    gate.scanSource('a.ts', guarded).findings.length,
    1,
    'typeof 包裹的 query 存在性必须命中(裸 === 不是验真)',
  )
  assert.equal(
    gate.scanSource(
      'a.ts',
      `async function h(request, reply){\n  if (await isVerifiedInternalMachineCall(request)) return${ENF}`,
    ).findings.length,
    0,
    '#23 的值验真形态必须放过,判据不许写歪',
  )
  assert.equal(
    gate.scanSource(
      'a.ts',
      `async function h(request, reply){\n  if (request.query.page) return${ENF}`,
    ).findings.length,
    0,
    'query 的非凭据参数不得判红',
  )
  assert.equal(
    gate.scanSource(
      'a.ts',
      `async function h(request, reply){\n  if (request.headers['x-tenant-signature'] === process.env.SIGNATURE) return${ENF}`,
    ).findings.length,
    0,
    '有比较对象的值比较不得判红',
  )
  assert.equal(
    gate.scanSource(
      'a.ts',
      `async function h(request, reply){\n  if (secretsEqual(request.query.key, process.env.GEMINI_KEY)) return${ENF}`,
    ).findings.length,
    0,
    'secretsEqual 验真不得判红',
  )
})

/**
 * T10 跨文件锁:本门的行内豁免族必须进守门 108 的 `FAMILY_LIFETIME_DAYS`,且**族名由门体自己给出**
 * (不在此处手抄 —— 手抄的那份会在改名时既匹配不上门体、也匹配不上表,变成一把空锁)。
 * 两侧一律读 **HEAD 面**:读磁盘会把"门体已落地而 108 那张表还没落地"读成一致(两面不同形 =
 * 自洽却错位的尺子,AGENTS 对 93/103/124 各记过一次)。
 * 不登记的实际代价不是"少一个到期日",而是走 90 天默认档 + 第一处真写出来的行内豁免被 108 的 E4
 * 判成"新引入的未登记豁免族"—— 一道门自己的合法出口被邻居钉红(两道门互咬)。
 */
test('T10 跨文件锁:行内豁免族必须进守门 108 的存活期表(30 天,待偿的裁决债)', () => {
  const gateFace = faceShow('scripts/check-credential-presence-bypass.mjs')
  const fam = /const EXEMPT_RE = \/([a-z-]+):\\s/.exec(gateFace)?.[1]
  assert.ok(fam, "门体里读不出豁免族名 ⇒ 本锁空转(锁必须问结构,不接受'看着像')")
  const expiry = faceShow('scripts/check-exemption-expiry.mjs')
  const m = new RegExp(`'${fam}':\\s*(\\d+)`).exec(expiry)
  assert.ok(
    m,
    `${fam} 没进 FAMILY_LIFETIME_DAYS ⇒ 走 90 天默认档,且第一处行内豁免会被守门 108 的 E4 判成"新引入的未登记族"`,
  )
  assert.equal(
    m[1],
    '30',
    '该族是待偿的裁决债(补验真或改台账带复核日),取 30 天;改档要走 108 表旁注释,不得就地放宽',
  )
})

test('T11 台账腐烂必须限定在审查面内(面外条目不判,否则不带 csrf.ts 的提交恒红)', () => {
  const ledger = new Map([
    [
      'apps/api/src/plugins/csrf.ts#request.headers',
      {
        file: 'apps/api/src/plugins/csrf.ts',
        anchor: 'request.headers',
        reason: 'x',
        reviewBy: '2099-01-01',
      },
    ],
  ])
  const outOfScope = gate.decide({
    findings: [],
    ledger,
    today: '2026-09-30',
    absent: false,
    scanned: new Set(['apps/api/src/routes/agents.ts']),
  })
  assert.equal(outOfScope.stale.length, 0, '面外条目不得判腐烂')
  const inScope = gate.decide({
    findings: [],
    ledger,
    today: '2026-09-30',
    absent: false,
    scanned: new Set(['apps/api/src/plugins/csrf.ts']),
  })
  assert.equal(inScope.stale.length, 1, '面内无命中仍必红')
  const full = gate.decide({ findings: [], ledger, today: '2026-09-30', absent: false })
  assert.equal(full.stale.length, 1, '全量档(缺省 null)保持原判据')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
