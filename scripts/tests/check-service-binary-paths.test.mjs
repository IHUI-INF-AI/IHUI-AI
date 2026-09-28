#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 守门 check-service-binary-paths.mjs 的镜像测试(§22c:直接 import 源实现,不抄第二份判据)
 *
 * 为什么要有它:本门判的是**机器状态**(HKLM 服务注册表),而它最容易自欺的两种形态恰好
 * 都表现为"安静":① 枚举链路断掉(解释器取不到 / 输出被截断 / 反斜杠被吃掉)⇒ 空表 ⇒
 * 若把空表读成"没有坏服务"就是替一台瞎掉的尺子出合格证;② 存在性判据被写成恒真 ⇒ 一路报绿。
 * 真仓现测本机 790 个服务键、0 个 nssm 形态,所以 T4 那类"空枚举必须落未判定"在本机不是
 * 假想,而是**今天唯一能跑出的真实结论**。
 *
 * 钉八件事:
 *   T1 判据边界形状锁 —— 不得引 face-reader、不得 readFileSync 仓库正文(它判机器态,
 *      不属守门 118 的取材面射程;把它改成按磁盘读被审内容就是越界,必须由机器发现)
 *   T2 派生纪律锁 —— windowsHide + timeout + maxBuffer 三项齐备(守门 52 / 80 记过同型:
 *      无 timeout 的 git/派生调用在本仓实测挂住过 80 分钟)
 *   T3 定级锁 —— 默认档确认缺失也 exit 0;strict 下 missing 与未判定都不得出合格证
 *   T4 空枚举不记通过(本票核心)
 *   T5 三态端到端 —— 注入 derive,构造输出直过 parse+classify+summarize 全链
 *   T6 真机信封形态 —— 真跑一次读侧,不得抛,rows/undetermined 必须是数组且结论落在三态内
 *   T7 存在性判据真的用 fs —— 夹具建文件⇒ok,删掉⇒missing(证明不是硬编码)
 *   T8 --json CLI 端到端可 JSON.parse,且 counts 与明细闭合
 *
 * 跑法:node --test scripts/tests/check-service-binary-paths.test.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path, { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as GATE } from '../check-service-binary-paths.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE_ABS = join(REPO, 'scripts', 'check-service-binary-paths.mjs')
const PS7 = 'C:/Program Files/PowerShell/7/pwsh.exe'

const src = readFileSync(GATE_ABS, 'utf8')
/** 注入用的存在性替身:只认识构造集合里的路径。 */
const fakeFs = (allow) => (p) => (allow.includes(String(p)) ? true : false)
/** 注入用的派生替身:返回构造的注册表输出,永不真跑解释器。 */
const fakeDerive = (text) => () => text

// ── T1 判据边界形状锁 ───────────────────────────────────────────────────────
test('T1 判机器状态的门不得引取材面层、不得读仓库正文', () => {
  // 本门与被审内容(face-reader 的三个面)无关:引它 = 把自己伪装成内容判据,
  // 而"按磁盘读被审内容"正是守门 118 要拦的那一型 —— 这里连被审内容都不该有。
  if (/from\s+['"]\.\/lib\/face-reader\.mjs['"]/.test(src)) {
    throw new Error('本门判机器状态,不得引 lib/face-reader.mjs(那会把它拖进 118 的取材面射程)')
  }
  if (/\breadFileSync\s*\(/.test(src)) {
    throw new Error('生产档不得 readFileSync —— 唯一的 fs 访问应限于量服务二进制自身是否存在')
  }
  if (!/existsSync/.test(src)) {
    throw new Error('存在性判据不见了:本门的核心动作就是量 Application 路径在不在')
  }
})

// ── T2 派生纪律锁 ───────────────────────────────────────────────────────────
test('T2 派生调用必须带 windowsHide / timeout / maxBuffer', () => {
  const i = src.indexOf('execFileSync(')
  if (i < 0) throw new Error('找不到派生点')
  const window = src.slice(i, i + 700)
  for (const need of ['windowsHide', 'timeout', 'maxBuffer', 'encoding']) {
    if (!window.includes(need)) throw new Error(`派生 options 缺 ${need}(守门 52/80 同型事故)`)
  }
  if (!/windowsHide:\s*true/.test(window)) throw new Error('windowsHide 必须显式为 true')
  if (!/ENUM_TIMEOUT_MS/.test(window)) throw new Error('timeout 必须走可调常量,不得写死不可覆盖')
})

test('T2b 解释器一律绝对路径,不得裸命令名依赖 PATH', () => {
  const bins = GATE.PS_CANDIDATES.map((c) => c.bin)
  for (const b of bins) {
    if (!path.win32.isAbsolute(b)) throw new Error(`非绝对路径:${b}`)
  }
  if (/[^\w."]\s*['"](?:pwsh|powershell)['"]/.test(src)) throw new Error('出现裸命令名解释器')
})

// ── T3 定级锁 ───────────────────────────────────────────────────────────────
test('T3 定级:默认档缺失不拦,strict 拒绝出具合格证', () => {
  const miss = { kind: GATE.MISSING, service: 'X', application: 'C:/gone' }
  if (GATE.summarize({ rows: [miss], strict: false }).exitCode !== 0) {
    throw new Error('默认档不得改退出码 —— 服务路径属机器状态,blocking 就是恒红门(§12e)')
  }
  if (GATE.summarize({ rows: [miss], strict: true }).exitCode !== 1) throw new Error('strict 下确认缺失必须 1')
  if (GATE.summarize({ rows: [], undetermined: ['x'], strict: true }).exitCode !== 1) {
    throw new Error('strict 下未判定必须 1(不得出合格证)')
  }
  // 反向:干净面在 strict 下也必须 0,否则本门自己就是一台恒红门
  if (GATE.summarize({ rows: [{ kind: GATE.OK }], strict: true }).exitCode !== 0) {
    throw new Error('干净面 strict 必须 0 —— 否则问责档永不可用')
  }
})

test('T3b 若日后被接进提交链,定级必须是 warn 且带应急跳过出口', () => {
  const runnerPath = join(REPO, 'scripts', 'guardian-runner.mjs')
  if (!existsSync(runnerPath)) return // 注册表不在位 ⇒ 本锁如实不判,不冒充通过也不冒充红
  const runner = readFileSync(runnerPath, 'utf8')
  if (!runner.includes('check-service-binary-paths.mjs')) return // 尚未接线(本票的既定状态:接线属主会话)
  const start = runner.indexOf('check-service-binary-paths.mjs')
  const entry = runner.slice(Math.max(0, start - 400), start + 400)
  if (/mode:\s*'blocking'/.test(entry)) {
    throw new Error('本门判机器状态,接进提交链时不得定 blocking(每台每次被逼 --no-verify,§12e)')
  }
  if (!/skipEnv/.test(entry)) throw new Error('接线时必须带 skipEnv 应急出口')
})

// ── T4 空枚举不记通过(本票核心)────────────────────────────────────────────
test('T4 枚举到 0 个 nssm 形态 ⇒ 未判定,绝不读成通过', () => {
  const r = GATE.readNssmServices({ platform: 'win32', derive: fakeDerive('SUM|790\n'), exists: fakeFs([PS7]) })
  const s = GATE.summarize({ rows: r.rows, undetermined: r.undetermined })
  if (r.rows.length !== 0) throw new Error('不该有行')
  if (s.verdict !== GATE.UND) throw new Error(`空枚举被判成 ${s.verdict},必须落未判定`)
  if (r.undetermined.length === 0) throw new Error('空枚举没留下任何原因 ⇒ 静默失效')
  const txt = GATE.renderHuman({ ...r, counts: s.counts, verdict: s.verdict, strict: false })
  if (/全部通过|无异常/.test(txt)) throw new Error('人读面把未判定写成了通过')
})

test('T4b 服务键数为 0(整个面没枚举到)同样是未判定', () => {
  const r = GATE.readNssmServices({ platform: 'win32', derive: fakeDerive('SUM|0\n'), exists: fakeFs([PS7]) })
  const s = GATE.summarize({ rows: r.rows, undetermined: r.undetermined })
  if (s.verdict !== GATE.UND) throw new Error(`verdict=${s.verdict}`)
})

// ── T5 三态端到端(注入 derive ⇒ 全链,不只验函数)───────────────────────────
test('T5 三态各一条端到端:ok / missing / 行级 undetermined', () => {
  const text = [
    'SVC|RssHub|app=C:/present/node.exe|dir=C:/x|img=C:/x/nssm.exe',
    'SVC|DeadSvc|app=C:/gone/node.exe|dir=C:/x|img=C:/x/nssm.exe',
    'SVC|RelSvc|app=node.exe|dir=|img=C:/x/nssm.exe',
    'SUM|800',
  ].join('\n')
  const r = GATE.readNssmServices({ platform: 'win32', derive: fakeDerive(text), exists: fakeFs([PS7, 'C:/present/node.exe']) })
  const bySvc = Object.fromEntries(r.rows.map((x) => [x.service, x.kind]))
  if (bySvc.RssHub !== GATE.OK) throw new Error(`存在的路径应 ok,实得 ${bySvc.RssHub}`)
  if (bySvc.DeadSvc !== GATE.MISSING) throw new Error(`缺失的路径应 missing,实得 ${bySvc.DeadSvc}`)
  if (bySvc.RelSvc !== GATE.UND) throw new Error(`相对路径应未判定而非 missing,实得 ${bySvc.RelSvc}`)
  const s = GATE.summarize({ rows: r.rows, undetermined: r.undetermined })
  if (s.counts[GATE.OK] !== 1 || s.counts[GATE.MISSING] !== 1 || s.counts[GATE.UND] !== 1) {
    throw new Error(`三态并桶了:${JSON.stringify(s.counts)}`)
  }
  if (s.verdict !== GATE.MISSING) throw new Error('有缺失时整体结论必须是 missing')
})

test('T5b 码页受损的取值不得被判 missing(那会把尺子失效伪装成一批坏服务)', () => {
  const text = 'SVC|Garbled|app=C:/x/' + String.fromCharCode(0xfffd) + 'node.exe|dir=|img=C:/x/nssm.exe\nSUM|10\n'
  const r = GATE.readNssmServices({ platform: 'win32', derive: fakeDerive(text), exists: fakeFs([PS7]) })
  if (r.rows[0].kind !== GATE.UND) throw new Error(`实得 ${r.rows[0].kind},必须未判定`)
  if (!GATE.looksCorrupted(r.rows[0].application)) throw new Error('夹具本身没带上受损特征 ⇒ 本例无牙')
})

test('T5c 派生失败 / 基键缺失 / 截断 三种读侧断裂都落未判定', () => {
  const cases = [
    ['抛错', () => { throw Object.assign(new Error('x'), { code: 'ETIMEDOUT' }) }],
    ['无 SUM 行', fakeDerive('SVC|A|app=C:/x/a.exe|dir=|img=nssm\n')],
    ['REGMISSING', fakeDerive('REGMISSING|HKLM:/x\n')],
  ]
  for (const [name, d] of cases) {
    const r = GATE.readNssmServices({ platform: 'win32', derive: d, exists: fakeFs([PS7, 'C:/x/a.exe']) })
    if (GATE.summarize({ rows: r.rows, undetermined: r.undetermined }).verdict !== GATE.UND) {
      throw new Error(`${name} 未落未判定`)
    }
    if (r.undetermined.length === 0) throw new Error(`${name} 没留下原因(静默失效)`)
  }
})

test('T5d 非 win32 与解释器全缺都点名原因,不冒充通过', () => {
  const a = GATE.readNssmServices({ platform: 'linux', exists: fakeFs([]) })
  if (a.undetermined.length !== 1 || !/win32/.test(a.undetermined[0])) throw new Error(JSON.stringify(a.undetermined))
  const b = GATE.readNssmServices({ platform: 'win32', exists: fakeFs([]) })
  if (!b.undetermined.some((u) => /解释器/.test(u))) throw new Error(JSON.stringify(b.undetermined))
})

// ── T6 真机读侧:不得抛,结论必须落三态 ─────────────────────────────────────
test('T6 真机跑一次读侧返回形态良好的信封(不冒充通过也不冒充红)', () => {
  if (process.platform !== 'win32') return
  const r = GATE.readNssmServices({})
  if (!Array.isArray(r.rows) || !Array.isArray(r.undetermined)) throw new Error('信封形状不对')
  const s = GATE.summarize({ rows: r.rows, undetermined: r.undetermined })
  if (![GATE.OK, GATE.MISSING, GATE.UND].includes(s.verdict)) throw new Error(`verdict=${s.verdict}`)
  // 本机实测无 nssm 服务 ⇒ 只能是未判定;若哪天判成 ok 而 rows 为空,就是空表被读成通过
  if (r.rows.length === 0 && s.verdict !== GATE.UND) {
    throw new Error(`空 rows 却判成 ${s.verdict}`)
  }
  for (const row of r.rows) {
    if (![GATE.OK, GATE.MISSING, GATE.UND].includes(row.kind)) throw new Error(`行态越界:${row.kind}`)
  }
})

// ── T7 存在性判据真的用文件系统 ─────────────────────────────────────────────
test('T7 真夹具:文件在 ⇒ ok,删掉同一路径 ⇒ missing', () => {
  const dir = mkScratch('svc-mirror-')
  try {
    const bin = path.join(dir, 'rsshub-node.exe').replace(/\\/g, '/')
    writeFileSync(bin, 'placeholder')
    const hit = GATE.classifyServices([{ service: 'S', application: bin }])
    if (hit[0].kind !== GATE.OK) throw new Error(`夹具文件应 ok,实得 ${hit[0].kind}`)
    rmSync(bin)
    const miss = GATE.classifyServices([{ service: 'S', application: bin }])
    if (miss[0].kind !== GATE.MISSING) throw new Error(`删除后应 missing,实得 ${miss[0].kind}`)
    if (GATE.summarize({ rows: miss }).verdict !== GATE.MISSING) throw new Error('missing 未成为整体结论')
  } finally {
    rmScratch(dir)
  }
})

// ── T8 --json CLI 端到端 ────────────────────────────────────────────────────
test('T8 CLI --json 可 JSON.parse 且 counts 与明细闭合', () => {
  const out = execFileSync(process.execPath, [GATE_ABS, '--json'], {
    encoding: 'utf8',
    timeout: 180_000,
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    cwd: REPO,
  })
  const j = JSON.parse(out)
  for (const k of ['counts', 'rows', 'undetermined', 'verdict', 'totalServices', 'engine']) {
    if (!(k in j)) throw new Error(`--json 缺字段 ${k}`)
  }
  const c = j.counts
  const rowSum = (c.ok || 0) + (c.missing || 0) + (c.undetermined || 0)
  const rowUndet = j.rows.filter((r) => r.kind === GATE.UND).length
  if (c.ok !== j.rows.filter((r) => r.kind === GATE.OK).length) throw new Error('counts.ok 与明细不符')
  if (c.missing !== j.rows.filter((r) => r.kind === GATE.MISSING).length) throw new Error('counts.missing 与明细不符')
  if (c.undetermined !== rowUndet + j.undetermined.length) throw new Error('counts.undetermined 未把整面原因并进来')
  if (rowSum < j.rows.length) throw new Error(`counts 不闭合:${rowSum} < ${j.rows.length}`)
  if (j.rows.length === 0 && j.verdict === GATE.OK) throw new Error('空明细却出具通过结论')
})

test('T8b 自检档零副作用:不得真派生解释器(注册表只读,但夹具必须可注入)', () => {
  const i = src.indexOf('export function selfTest')
  if (i < 0) throw new Error('找不到 selfTest')
  const body = src.slice(i, src.indexOf('\n}\n', i) + 3)
  if (/\bexecFileSync\b/.test(body)) throw new Error('--self-test 里不得真派生解释器,应经 derive 注入')
  if (!/mkScratch/.test(body)) throw new Error('--self-test 未使用唯一夹具落点(scripts/lib/scratch-dir.mjs)')
  if (/os\.tmpdir|mkdtempSync/.test(body)) throw new Error('禁止 os.tmpdir()/裸 mkdtempSync(§26 唯一夹具落点)')
})

test('T8c 源脚本必须带 §22d isDirectRun 守卫与 §22c __test__ 出口', () => {
  if (!/export const __test__ = \{/.test(src)) throw new Error('缺 __test__ 出口(§22c:测试不得抄第二份判据)')
  if (!/import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/.test(src)) {
    throw new Error('缺 isDirectRun 守卫(§22d)—— import 时会触发 CLI 副作用')
  }
})
