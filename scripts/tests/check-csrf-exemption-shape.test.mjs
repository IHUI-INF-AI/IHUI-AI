// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * §22c 镜像测试:scripts/check-csrf-exemption-shape.mjs(CSRF 豁免形状对账)。
 *
 * 判据一律 **import 源文件**,测试里不得再抄一份(§22c:镜像只复读实现就是复读机;
 * 守门 191 把"同料两份"判红)。几条不可动摇的锁:
 *  M1 判据不重写 —— 必须走源文件导出的 __test__,本文件不得出现第二份 scan/judge 实现;
 *  M2/M3/M4 三条判据有牙 —— 构造面成对正反(①存在性形态/验真形态/标记/噪声;②出口四态;
 *      ③棘轮同站/新增/只减/内容键),问结构(findings/exits/sites 数组)不问文本;
 *  M5 跨文件锁 —— 本门行内豁免族必须进守门 108 的 FAMILY_LIFETIME_DAYS 且取 30 天,
 *      族名由门体结构给出(不在此处手抄);不登记就会被 108 的 E4 判成"新引入的未登记族",
 *      一道门自己的合法出口被邻居钉红(credential-presence-exempt 同笔登记时记下的互咬教训);
 *  M6/M7 取材面纪律 —— face-reader 的 catBatch、遮罩只引 code-mask 一份、--staged 收窄到暂存集;
 *  M8 自检必须真跑过(判据在真跑它的那一刻才成立);
 *  M9 全量档存量只报数不红(§12f 恒红门禁令:③的 HEAD 存量非零,当场判红就是恒红门);
 *  M10 真仓阳性对照 —— 钉**出处 ref**(#23 修复提交的父版本 blob)成对正反,不钉 HEAD;
 *  M12 端到端(临时仓)—— 暂存一枚存在性豁免必须红、落地后只报数、--strict 才问责。
 *  **装车证明锁(T1/T2,2026-10-15 补录)**:主会话已把本门接线进 guardian-runner.mjs
 * (209 号 · blocking · HUSKY_SKIP_CSRF_EXEMPTION_SHAPE · stagedTriggers=apps/api/src),
 * 故"runner 里有这道门且四项齐"与"摘线不得被读成已装车"两条已在本文件末尾落锁(此前那句
 * "刻意不在本文件"失效,已就地更正,不留与事实相反的承诺)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as gate } from '../check-csrf-exemption-shape.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE = join(REPO, 'scripts', 'check-csrf-exemption-shape.mjs')
const SELF = 'check-csrf-exemption-shape.mjs'
const GATE_REL = `scripts/${SELF}`
const GIT = 'C:/Program Files/Git/cmd/git.exe'

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
 * 同一张面的唯一取法,供门体与守门 108 的存活期表共用 —— 别为第二个文件再抄一份 execFileSync。
 * **面由"门体是否已落地"决定,且两侧永远同面**:本票的门体与 108 的族表改动同笔落地
 * (同一 LAND_PATHS),于是
 *   · 门体不在 HEAD ⇒ 落地前窗口:HEAD 上这把尺子本身就不存在,磁盘是唯一真相,两侧都读磁盘;
 *   · 门体在 HEAD   ⇒ 已落地:两侧一律读 HEAD blob —— 共享工作树常年滞后 HEAD,按磁盘读会把
 *     "表后改/门先落地"读成一致(157 镜像 T10 记过的错位尺子;落地后任一侧对不上即真漂移,红)。
 * 不存在"门体读 HEAD、表读磁盘"的混面:混面正是 T10 要防的那件事。
 */
const FACE_OPTS = {
  stdio: ['ignore', 'pipe', 'pipe'],
  cwd: REPO,
  encoding: 'utf8',
  timeout: 120_000,
  maxBuffer: 1 << 26,
  windowsHide: true,
}
let landedCache = null
function gateLanded() {
  if (landedCache === null) {
    try {
      execFileSync(GIT, ['-c', 'safe.directory=*', 'show', `HEAD:${GATE_REL}`], FACE_OPTS)
      landedCache = true
    } catch {
      landedCache = false
    }
  }
  return landedCache
}
function faceShow(relPath) {
  if (gateLanded())
    return execFileSync(GIT, ['-c', 'safe.directory=*', 'show', `HEAD:${relPath}`], FACE_OPTS)
  // 落地前窗口:门体与 108 族表同笔落地,HEAD 上两边都取不到 ⇒ 磁盘是唯一真相
  const abs = join(REPO, relPath)
  if (!existsSync(abs)) throw new Error(`落地前窗口:${relPath} 在 HEAD 与磁盘都取不到`)
  console.error(`[csrf-mirror] faceShow:门体未落地,回落磁盘读 ${relPath}`)
  return readFileSync(abs, 'utf8')
}

/** 闭包拷贝:从门自己 import 的东西出发迭代到不动点(不按名字手列 —— 手列清单必漂)。 */
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

/* ─────────────────────────── 判据不重写(§22c / 守门 191)─────────────────────────── */

test('M1 测试不得重写判据(必须走源文件导出的 __test__)', () => {
  const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  assert.match(src, /import \{ __test__ as gate \} from '\.\.\/check-csrf-exemption-shape\.mjs'/)
  assert.ok(
    !new RegExp('^\\s*(export )?function (scan' + 'Source|judgeExits)\\s*\\(', 'm').test(src),
    '测试里出现第二份实现 = 漂移从防线变成掩体',
  )
  assert.equal(typeof gate.scanSource, 'function')
  assert.equal(typeof gate.judgeExits, 'function')
  assert.equal(typeof gate.timingSafeEqualSites, 'function')
  assert.equal(typeof gate.newSitesOf, 'function')
  assert.equal(typeof gate.newFindingsOf, 'function')
  assert.equal(typeof gate.inCsrfSurface, 'function')
})

/* ─────────────────────────── 判据①:存在性即放行 ─────────────────────────── */

test('M2 ①存在性豁免:核心阳性 + 验真形态放过 + 标记/噪声四界(问结构不问文本)', () => {
  const s = (src) => gate.scanSource('a.ts', src)
  const ENF = '\n  return reply.status(403).send(1)\n}'
  // 阳性:头存在性唯一条件即放行(本门立项那一型)
  assert.equal(
    s(`async function h(request, reply){\n  if (request.headers['x-agent-dispatch']) return${ENF}`)
      .findings.length,
    1,
  )
  // 阳性:env 键存在性(守门 157 射程外的那一格)
  assert.equal(
    s(`async function h(request, reply){\n  if (process.env.AGENT_DISPATCH_SECRET) return${ENF}`)
      .findings.length,
    1,
  )
  // 阳性:一跳变量(跨行 + 类型断言的 cookie 豁免形态)
  assert.equal(
    s(
      `async function h(request, reply){\n  const authToken = (request as FastifyRequest & { cookies?: Record<string, string> }).cookies\n    ?.auth_token\n  if (authToken) return${ENF}`,
    ).findings.length,
    1,
  )
  // 阳性:typeof 包裹的存在性(裸类型比较不是验真)
  assert.equal(
    s(
      `async function h(request, reply){\n  if (typeof (request.query as { key?: unknown } | undefined)?.key === 'string') return${ENF}`,
    ).findings.length,
    1,
  )
  // 反向:#23 修法形态(条件即验真出口)必须放过,且记 passed 不记 hit
  const fixed = s(
    `async function h(request, reply){\n  if (await isVerifiedInternalMachineCall(request)) return${ENF}`,
  )
  assert.equal(fixed.findings.length, 0)
  assert.equal(fixed.passed.length, 1)
  // 反向:值比较不是纯存在性(是否安全比较属另一维,本门不判)
  assert.equal(
    s(
      `async function h(request, reply){\n  if (request.headers['x-agent-token'] === process.env.AGENT_TOKEN) return${ENF}`,
    ).findings.length,
    0,
  )
  // 反向:分支是 403 拒绝而不是放行
  assert.equal(
    s(
      `async function h(request, reply){\n  if (request.headers['x-agent-dispatch']) return reply.status(403).send(1)\n}`,
    ).findings.length,
    0,
  )
  // 反向:映射短路(后面没有 enforcement)不判
  assert.equal(
    s(
      `async function mapX(request){\n  if (request.headers.authorization) return\n  const g = request.headers['x-goog-api-key']\n  if (g) request.headers.authorization = 'Bearer ' + g\n}`,
    ).findings.length,
    0,
  )
  // 反向:注释/字符串里的该形态不计
  assert.equal(
    s(
      `async function h(request, reply){\n  // 旧写法: if (request.headers['x-agent-dispatch']) return\n  return reply.send(1)\n}`,
    ).findings.length,
    0,
  )
  assert.equal(
    s(
      `async function h(request, reply){\n  const doc = "if (request.headers['x-agent-dispatch']) return"\n  return doc\n}`,
    ).findings.length,
    0,
  )
  // 豁免:带原因的本门标记(上一行注释 / 同行尾)⇒ exempted;裸标记不得放过
  assert.equal(
    s(
      `async function h(request, reply){\n  // csrf-exempt: 路由侧 preHandler 已验真(待偿)\n  if (request.headers['x-goog-api-key']) return${ENF}`,
    ).exempted.length,
    1,
  )
  assert.equal(
    s(
      `async function h(request, reply){\n  if (request.headers['x-goog-api-key']) return // csrf-exempt: 下游查库验真\n${ENF}`,
    ).exempted.length,
    1,
  )
  assert.equal(
    s(
      `async function h(request, reply){\n  // csrf-exempt:\n  if (request.headers['x-goog-api-key']) return${ENF}`,
    ).findings.length,
    1,
  )
  // 豁免:守门 157 的行内标记必须一并认(防两道门互咬)
  assert.equal(
    s(
      `async function h(request, reply){\n  // credential-presence-exempt: 守门 157 台账已裁\n  if (request.headers['x-goog-api-key']) return${ENF}`,
    ).findings.length,
    0,
  )
  // 判不出必须报名:条件里混有非存在性判定,不冒红也不静默放过
  assert.equal(
    s(
      `async function h(request, reply){\n  if (isAdmin && request.headers['x-agent-dispatch']) return${ENF}`,
    ).undetermined.length,
    1,
  )
})

/* ─────────────────────────── 判据②:出口摘线 ─────────────────────────── */

test('M3 ②验真出口:四态成对(alive/export-missing/no-caller/file-missing)', () => {
  const IP = 'apps/api/src/utils/internal-principal.ts'
  const CRED = 'apps/api/src/utils/csrf-exempt-credential.ts'
  const CS = 'apps/api/src/plugins/csrf.ts'
  const IP_SRC = `export async function isVerifiedInternalMachineCall(request){\n  if (await isVerifiedInternalServiceCall(request)) return true\n  return isVerifiedAgentControlInternalCall(request)\n}\nexport async function isVerifiedInternalServiceCall(request){ return false }\nexport async function isVerifiedAgentControlInternalCall(request){ return false }\n`
  const CRED_SRC = `export async function isServerSignedJwt(token){ return true }\n`
  const CS_SRC = `if (await isVerifiedInternalMachineCall(request)) return\nif (await isServerSignedJwt(t)) return\n`
  const stateOf = (map, name) => gate.judgeExits(map).find((e) => e.name === name)?.state
  const healthy = new Map([
    [IP, IP_SRC],
    [CRED, CRED_SRC],
    [CS, CS_SRC],
  ])
  assert.ok(
    gate.judgeExits(healthy).every((e) => e.state === 'alive'),
    JSON.stringify(gate.judgeExits(healthy)),
  )
  assert.equal(
    stateOf(
      new Map([
        [
          IP,
          IP_SRC.replace(
            'export async function isVerifiedAgentControlInternalCall',
            'async function isVerifiedAgentControlInternalCall',
          ),
        ],
        [CRED, CRED_SRC],
        [CS, CS_SRC],
      ]),
      'isVerifiedAgentControlInternalCall',
    ),
    'export-missing',
  )
  assert.equal(
    stateOf(
      new Map([
        [IP, IP_SRC],
        [CRED, CRED_SRC],
        [CS, CS_SRC.replace('if (await isVerifiedInternalMachineCall(request)) return\n', '')],
      ]),
      'isVerifiedInternalMachineCall',
    ),
    'no-caller',
  )
  assert.equal(
    stateOf(
      new Map([
        [CRED, CRED_SRC],
        [CS, CS_SRC],
      ]),
      'isVerifiedInternalMachineCall',
    ),
    'file-missing',
  )
  // 子出口被复合出口内部调用即在线(否则 HEAD 面两族凭据会被误判成摘线)
  const internalOnly = new Map([
    [IP, IP_SRC],
    [CRED, CRED_SRC],
  ])
  assert.equal(stateOf(internalOnly, 'isVerifiedInternalServiceCall'), 'alive')
  assert.equal(stateOf(internalOnly, 'isVerifiedInternalMachineCall'), 'no-caller')
  // 测试面不算调用点(夹具里写满出口名不得冒充消费者)
  assert.equal(
    stateOf(
      new Map([
        [IP, IP_SRC],
        [CRED, CRED_SRC],
        ['apps/api/tests/x.test.ts', 'if (await isVerifiedInternalMachineCall(request)) return\n'],
      ]),
      'isVerifiedInternalMachineCall',
    ),
    'no-caller',
  )
})

/* ─────────────────────────── 判据③:timingSafeEqual 棘轮 ─────────────────────────── */

test('M4 ③差值棘轮:同站不红、新增才红、只减不增、键按内容不按行号', () => {
  const mapA = new Map([
    [
      'apps/api/src/plugins/x.ts',
      `import { timingSafeEqual } from 'node:crypto'\nconst ok = timingSafeEqual(a, b)\n`,
    ],
    ['apps/api/src/utils/y.ts', `const c = timingSafeEqual(p, q)\n`],
  ])
  const anchor = gate.timingSafeEqualSites(mapA)
  assert.equal(gate.newSitesOf(gate.timingSafeEqualSites(new Map(mapA)), anchor).length, 0)
  const added = new Map([
    [
      'apps/api/src/plugins/x.ts',
      `import { timingSafeEqual } from 'node:crypto'\nconst ok = timingSafeEqual(a, b)\nconst more = timingSafeEqual(c, d)\n`,
    ],
    ['apps/api/src/utils/y.ts', `const c = timingSafeEqual(p, q)\n`],
  ])
  const newOnes = gate.newSitesOf(gate.timingSafeEqualSites(added), anchor)
  assert.equal(newOnes.length, 1)
  assert.equal(newOnes[0].file, 'apps/api/src/plugins/x.ts')
  assert.ok(newOnes[0].line > 0, '新增站点必须带行号(点名用)')
  // 新文件里的 timingSafeEqual 全部算新增
  assert.equal(
    gate.newSitesOf(
      gate.timingSafeEqualSites(
        new Map([...mapA, ['apps/api/src/utils/z.ts', 'const z = timingSafeEqual(m, n)\n']]),
      ),
      anchor,
    ).length,
    1,
  )
  // 只减不增:站点消失不算新增
  assert.equal(
    gate.newSitesOf(
      gate.timingSafeEqualSites(new Map([['apps/api/src/plugins/x.ts', 'const ok = 1\n']])),
      anchor,
    ).length,
    0,
  )
  // 站点键按内容不按行号(同行内容挪位不算新增 —— 按行号会把插入行读成假红)
  assert.equal(
    gate.newSitesOf(
      gate.timingSafeEqualSites(
        new Map([['apps/api/src/plugins/x.ts', '// lead\nconst ok = timingSafeEqual(a, b)\n']]),
      ),
      gate.timingSafeEqualSites(
        new Map([['apps/api/src/plugins/x.ts', 'const ok = timingSafeEqual(a, b)\n']]),
      ),
    ).length,
    0,
  )
  // 注释/字符串里的字样不计站点(存量读数问代码面)
  assert.equal(
    gate.timingSafeEqualSites(
      new Map([['a.ts', '// 提一句 timingSafeEqual 的实现\nconst s = "timingSafeEqual 字样"\n']]),
    ).length,
    0,
  )
})

/* ─────────────────────────── 跨文件锁:守门 108 存活期表 ─────────────────────────── */

test('M5 跨文件锁:行内豁免族必须进守门 108 的存活期表(30 天,待偿的裁决债)', () => {
  const gateFace = faceShow('scripts/check-csrf-exemption-shape.mjs')
  const fam = /const EXEMPT_RE = \/([a-z-]+):\\s/.exec(gateFace)?.[1]
  assert.ok(fam, "门体里读不出豁免族名 ⇒ 本锁空转(锁必须问结构,不接受'看着像')")
  assert.equal(fam, gate.EXEMPT_FAMILY, '族名的唯一真相是门体导出的 EXEMPT_FAMILY')
  const expiry = faceShow('scripts/check-exemption-expiry.mjs')
  const m = new RegExp(`'${fam}':\\s*(\\d+)`).exec(expiry)
  assert.ok(
    m,
    `${fam} 没进 FAMILY_LIFETIME_DAYS ⇒ 走 90 天默认档,且第一处行内豁免会被守门 108 的 E4 判成"新引入的未登记族"`,
  )
  assert.equal(
    m[1],
    '30',
    '该族是待偿的裁决债(补验真出口或收敛到 secretsEqual),取 30 天;改档要走 108 表旁注释,不得就地放宽',
  )
})

/* ─────────────────────────── 取材面纪律 ─────────────────────────── */

test('M6 取材面形状锁:必须走 face-reader 的 catBatch,遮罩只引一份实现', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/)
  assert.match(src, /catBatch\(/, '内容必须经层读取(否则工作树滞后会让结论来回跳)')
  assert.match(src, /from '\.\/lib\/code-mask\.mjs'/)
  assert.ok(
    !/function maskComments|function blankByMask|const MASK_RE =/.test(src),
    '本地副本必然与共享实现漂移',
  )
  assert.ok(
    !/execFileSync\([^)]*'show'/.test(src),
    '禁止自派生 git show 取被审内容(历史 blob 走 catBatch)',
  )
  assert.ok(
    !/readFileSync\(join\(root/.test(src),
    '禁止按磁盘读被审内容(worktree 档走 readWorktreeFile)',
  )
})

test('M7 --staged 必须收窄到本次暂存集(不得复刻门 150 的人人必红)', () => {
  const src = readFileSync(GATE, 'utf8')
  // 空白容忍:lint-staged 会跑 prettier,长数组实参会被折成每行一项。形状锁要判的是
  // "这两个实参在同一个 args 数组里挨着",不是它们的排版。
  assert.match(src, /'diff',\s*'--cached'/, '--staged 档必须问"本次带进来了哪些路径"')
  // 形状锁判的是"staged 面把判域收窄到暂存集",不问变量叫什么(effFace/face 都算)
  assert.match(
    src,
    /=== 'staged'[\s\S]{0,200}stagedPaths\.has\(/,
    '暂存集之外的路径不得按本次改动判红',
  )
  // 文档类提交(射程内 0 个暂存文件)必须回退全量,而不是判"无法判定"(恒挡)
  assert.ok(
    gate.shouldRetreatToHead({ face: 'staged', stagedInScopeCount: 0 }),
    '暂存档 + 射程内 0 个 ⇒ 回退全量',
  )
  assert.ok(
    !gate.shouldRetreatToHead({ face: 'staged', stagedInScopeCount: 1 }),
    '暂存档里有射程内文件 ⇒ 绝不回退(回退=把本次改动放过去)',
  )
  assert.ok(!gate.shouldRetreatToHead({ face: 'head', stagedInScopeCount: -1 }), '全量档不适用回退')
})

/* ─────────────────────────── 自检真跑 + 全量档存量只报数 ─────────────────────────── */

test('M8 --self-test 必须真跑过且 exit 0(判据在真跑它的那一刻才成立)', () => {
  const out = spawnSync(process.execPath, [GATE, '--self-test'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: REPO,
    encoding: 'utf8',
    timeout: 300_000,
    maxBuffer: 1 << 26,
    windowsHide: true,
  })
  const combo = out.stdout + out.stderr
  assert.ok(
    !/ERR_MODULE_NOT_FOUND|Cannot find module/.test(combo),
    `夹具缺件(import 期崩溃的退出码也是 1):${combo.slice(0, 300)}`,
  )
  assert.equal(out.status, 0, `--self-test 必须全绿:\n${combo.slice(-2000)}`)
  assert.match(combo, /--self-test: 全部通过/)
})

test('M9 全量档(HEAD)存量只报数不红:③存量看得见、出口在线、不恒红', () => {
  const r = runJson(['--json'])
  assert.equal(r.json.face, 'head')
  assert.equal(r.rc, 0, `HEAD 全量档不得因存量判红(§12f):${r.raw.slice(0, 400)}`)
  assert.ok(r.json.scannedFiles > 100, `扫描面过窄(实得 ${r.json.scannedFiles})= 门在对着空气打分`)
  assert.ok(r.json.surfaceFiles > 0, 'CSRF 豁免决策面塌了 = ①整族失明')
  // ③的 HEAD 存量必须**看得见**(立项现读非零;只报数不判红正是本门不恒红的形状)
  assert.ok(r.json.sites.length > 0, `③存量读数为 0 ⇒ 棘轮没有锚点可报:${r.raw.slice(0, 300)}`)
  assert.equal(r.json.addedSites.length, 0, 'HEAD 面上"新增"必须恒为 0(锚点即自身)')
  assert.equal(r.json.unreadable.length, 0, '候选取不到内容 ⇒ 无法判定,不记绿')
  // ②出口在 HEAD 面必须全部在线(四条里断一条即"没有出路",任何档都红)
  assert.ok(
    r.json.exits.every((e) => e.state === 'alive'),
    `出口摘线:${JSON.stringify(r.json.exits.filter((e) => e.state !== 'alive'))}`,
  )
  // strict 是问责档:有存量即 1(不与默认档顶账)
  const s = runJson(['--json', '--strict'])
  assert.ok(s.rc === 1 || s.rc === 2, `strict 档必须有牙(实得 ${s.rc})`)
})

/* ─────────────────────────── 真仓阳性对照(历史 blob,不钉 HEAD)─────────────────────────── */

test('M10 真仓阳性对照:钉出处 blob 成对正反(账还清后 HEAD 量不到存量是正当结果)', () => {
  const p = gate.probeHistorical(REPO)
  assert.ok(
    p.before.length >= 2,
    `出处 ${gate.PROBE_REV_BEFORE} 的 ${gate.PROBE_FILE} 未被命中 ⇒ 判据对该型失明:${JSON.stringify(p)}`,
  )
  assert.ok(
    p.beforeDetail.some((f) => String(f.ref).includes(gate.PROBE_TOKEN)),
    `阳性对照必须点到 ${gate.PROBE_TOKEN} 那一处(#23 的现场)`,
  )
  // 反向对照钉站点不钉总数:#23 只修了 x-internal-service-token,同文件另两处是后来
  // c824c12070 才收口的 —— 那一版 blob 上它们仍是存量(棘轮存在的理由)。
  assert.equal(
    p.afterDetail.filter((f) => String(f.ref).includes(gate.PROBE_TOKEN)).length,
    0,
    `票#23(${gate.PROBE_REV_AFTER})之后同一站点仍被命中 ⇒ 门对自己认可的修法形态全盲(按规矩写就红=逼人跳门)`,
  )
  assert.ok(p.after.length < p.before.length, '修一处少一处:总数必须严格下降')
  const e = gate.probeExitsHistorical(REPO)
  assert.ok(
    e.before.every((x) => x.state === 'file-missing'),
    `#23 之前出口文件不在 ⇒ "没有出路"必须可达:${JSON.stringify(e.before)}`,
  )
  assert.ok(
    e.after.every((x) => x.state === 'alive'),
    `#23 之后出口必须全部在线:${JSON.stringify(e.after)}`,
  )
})

/* ─────────────────────────── 端到端(临时仓):暂存必红 / 落地只报数 / strict 问责 ─────────────────────────── */

const IP_SRC = `export async function isVerifiedInternalMachineCall(request){\n  if (await isVerifiedInternalServiceCall(request)) return true\n  return isVerifiedAgentControlInternalCall(request)\n}\nexport async function isVerifiedInternalServiceCall(request){ return false }\nexport async function isVerifiedAgentControlInternalCall(request){ return false }\n`
const CRED_SRC = `export async function isServerSignedJwt(token){ return true }\n`
const CS_HEALTHY = `import { isVerifiedInternalMachineCall } from '../utils/internal-principal.js'\nimport { isServerSignedJwt } from '../utils/csrf-exempt-credential.js'\nexport default async function csrfPlugin(server){\n  server.addHook('onRequest', async (request, reply) => {\n    if (await isVerifiedInternalMachineCall(request)) return\n    if (await isServerSignedJwt(t)) return\n    if (!verifyCsrfToken(a, b)) return reply.status(403).send(1)\n  })\n}\n`
const CS_VIOLATING = `import { isVerifiedInternalMachineCall } from '../utils/internal-principal.js'\nimport { isServerSignedJwt } from '../utils/csrf-exempt-credential.js'\nexport default async function csrfPlugin(server){\n  server.addHook('onRequest', async (request, reply) => {\n    if (request.headers['x-agent-dispatch']) return\n    if (await isVerifiedInternalMachineCall(request)) return\n    if (await isServerSignedJwt(t)) return\n    if (!verifyCsrfToken(a, b)) return reply.status(403).send(1)\n  })\n}\n`

function buildScratchRepo(s) {
  const dir = join(s, 'apps', 'api', 'src', 'plugins')
  mkdirSync(dir, { recursive: true })
  mkdirSync(join(s, 'apps', 'api', 'src', 'utils'), { recursive: true })
  writeFileSync(join(dir, 'csrf.ts'), CS_HEALTHY, 'utf8')
  writeFileSync(join(s, 'apps', 'api', 'src', 'utils', 'internal-principal.ts'), IP_SRC, 'utf8')
  writeFileSync(
    join(s, 'apps', 'api', 'src', 'utils', 'csrf-exempt-credential.ts'),
    CRED_SRC,
    'utf8',
  )
  copyScriptClosure(s)
  execFileSync(GIT, ['-c', 'safe.directory=*', 'init', '-q', '.'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: s,
    windowsHide: true,
    timeout: 60_000,
  })
  execFileSync(GIT, ['-c', 'safe.directory=*', 'add', '-A'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: s,
    windowsHide: true,
    timeout: 60_000,
  })
  execFileSync(
    GIT,
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
      'baseline',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'], cwd: s, windowsHide: true, timeout: 60_000 },
  )
}

function runGateIn(s, args) {
  const out = spawnSync(process.execPath, [join(s, 'scripts', SELF), ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: s,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 1 << 26,
    windowsHide: true,
  })
  return { rc: out.status, combo: out.stdout + out.stderr }
}

test('M12 端到端:暂存一枚存在性豁免必须红并点名;落地后只报数;strict 才问责', () => {
  const s = mkScratch('csrfshape')
  try {
    buildScratchRepo(s)
    // ① 健康基线:HEAD 面全绿(①候选 0 / 出口 4 在线 / ③无站点)
    const base = runGateIn(s, ['--json'])
    assert.equal(base.rc, 0, `健康基线必须绿:${base.combo.slice(0, 400)}`)
    const baseJson = JSON.parse(base.combo)
    assert.equal(baseJson.findings.length, 0)
    assert.ok(baseJson.exits.every((e) => e.state === 'alive'))
    // ② 暂存一枚存在性豁免:必须红,且 addedFindings 点名到站点(问结构)
    writeFileSync(join(s, 'apps', 'api', 'src', 'plugins', 'csrf.ts'), CS_VIOLATING, 'utf8')
    execFileSync(GIT, ['-c', 'safe.directory=*', 'add', 'apps/api/src/plugins/csrf.ts'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: s,
      windowsHide: true,
      timeout: 60_000,
    })
    const staged = runGateIn(s, ['--staged', '--json'])
    assert.equal(staged.rc, 1, `暂存的新违例必须红:${staged.combo.slice(0, 500)}`)
    const stagedJson = JSON.parse(staged.combo)
    assert.equal(stagedJson.face, 'staged')
    assert.equal(stagedJson.addedFindings.length, 1, JSON.stringify(stagedJson.addedFindings))
    assert.match(stagedJson.addedFindings[0].file, /plugins\/csrf\.ts$/)
    assert.ok(String(stagedJson.addedFindings[0].ref).includes('x-agent-dispatch'))
    assert.ok(stagedJson.addedFindings[0].line > 0)
    // ③ 落地之后:HEAD 面只报数不红(§12f 棘轮 —— 否则每个后续提交都拿到无法清偿的红)
    execFileSync(
      GIT,
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
        'violation',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'], cwd: s, windowsHide: true, timeout: 60_000 },
    )
    const landed = runGateIn(s, ['--json'])
    assert.equal(landed.rc, 0, `落地后存量只报数(恒红门禁令):${landed.combo.slice(0, 500)}`)
    const landedJson = JSON.parse(landed.combo)
    assert.equal(landedJson.findings.length, 1, '存量必须看得见(报数,不是消失)')
    assert.equal(landedJson.addedFindings.length, 0, 'HEAD 面上"新增"恒为 0(锚点即自身)')
    // ④ strict 问责档:存量即红
    const strict = runGateIn(s, ['--json', '--strict'])
    assert.equal(strict.rc, 1, `strict 档有存量即红:${strict.combo.slice(0, 400)}`)
  } finally {
    rmScratch(s)
  }
})

/**
 * 装车证明锁(T1/T2,2026-10-15 主会话接线 guardian-runner(209 号)后补录 —— 头注那句
 * "刻意不在本文件"至此失效,已就地更正)。取材面:runner 是脚本形态(import 即执行守门),
 * 故**不 import、不抄判据**,按注册面的结构文本现读,问注册字面量不问注释。
 */
const RUNNER_REL = 'scripts/guardian-runner.mjs'
const RUNNER = join(REPO, 'scripts', 'guardian-runner.mjs')

/** 取本门在 runner 注册面里的条目块(取不到返回 null,不得猜) */
function findRunnerEntry(src, scriptName) {
  const at = src.indexOf(`script: '${scriptName}'`)
  if (at < 0) return null
  const start = src.lastIndexOf('\n  {', at)
  const end = src.indexOf('\n  },', at)
  if (start < 0 || end < 0) return null
  return { start, end: end + '\n  },'.length, text: src.slice(start, end + '\n  },'.length) }
}

/** "已装车"判据:blocking + 应急跳过变量一致 + 触发面含 apps/api/src */
function isWired(src) {
  const entry = findRunnerEntry(src, SELF)
  if (!entry) return false
  return (
    /mode:\s*'blocking'/.test(entry.text) &&
    /skipEnv:\s*'HUSKY_SKIP_CSRF_EXEMPTION_SHAPE'/.test(entry.text) &&
    /stagedTriggers:\s*\[[^\]]*'apps\/api\/src'/.test(entry.text)
  )
}

test('T1 装车在役:runner 注册面必须现读得到本门(blocking + skipEnv + stagedTriggers 含 apps/api/src)', () => {
  assert.ok(existsSync(RUNNER), `守门执行器不在位:${RUNNER_REL}`)
  assert.ok(existsSync(GATE), `门体不在位:${GATE_REL}`)
  const src = readFileSync(RUNNER, 'utf8')
  const entry = findRunnerEntry(src, SELF)
  assert.ok(entry, `runner 里找不到 ${SELF} 的注册条目 ⇒ 没装车`)
  assert.match(entry.text, /mode:\s*'blocking'/, '必须 blocking(否则提交链上不拦)')
  assert.match(
    entry.text,
    /skipEnv:\s*'HUSKY_SKIP_CSRF_EXEMPTION_SHAPE'/,
    '应急跳过变量必须与门体头注/用法一致,否则文档写的出路跑不通',
  )
  assert.match(entry.text, /stagedTriggers:\s*\[[^\]]*'apps\/api\/src'/, '触发面必须含 apps/api/src')
})

test('T2 摘线可被发现(变异验证):把该条目从注册面摘掉后,同一判据必须判"没装车"', () => {
  const src = readFileSync(RUNNER, 'utf8')
  const entry = findRunnerEntry(src, SELF)
  assert.ok(entry, 'T2 的前提是 T1 已在位;前提不成立不得假绿 —— 先修 T1')
  assert.equal(isWired(src), true, '注册面原式必须判"已装车"')
  const unplugged = src.slice(0, entry.start) + '\n' + src.slice(entry.end)
  assert.equal(isWired(unplugged), false, '摘掉条目后仍判"已装车" ⇒ 这条装车证明是空转的')
  assert.equal(findRunnerEntry(unplugged, SELF), null, '摘线后注册面里不得再读得到本门')
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
