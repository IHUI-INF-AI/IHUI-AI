#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// =============================================================================
// 守门 check-prod-bundle-shadow.mjs 的镜像测试(§22c:直接 import 源实现,不抄第二份判据)
// =============================================================================
// 为什么要有它:本门的登记表是**手工**的,而"登记了却没被判""判据在但表漏了一整类"
// 这两型失败对真仓的 audit() 输出完全不可见 —— deploy-diagnose.sh / ai-diagnose.mjs
// 与 prod-bundle 里的副本逐字节等值、且在 deploy/tests 里已有自检,却整批没进本门表,
// 门一路报"登记对 2 个"而没人看出面少了一半(2026-09-25 实测)。
//   所以这里钉六件事:
//   T1 装车证明 —— 两处挂点都得在:提交链(guardian-runner 注册块 + blocking + skipEnv +
//      编号唯一)与根 package.json 的 check:all。2026-09-24 立门时只有后者,于是"造好没
//      装车"跑了整整一天 —— 判据正确、跑得通,而没有任何调度器跑它,漂移永远静默。
//   T2 登记表自身形状与落点规则(tracked 不得落在被忽略的目录里)
//   T3 真仓现测必须 0 无法判定(缺一侧绝不记绿)
//   T4 反查登记表腐烂 —— prod-bundle 里存在逐字节相同的跟踪文件却没登记 ⇒ 红
//   T5 变异端到端 —— 改任一侧必红,摘线红,缺运行副本=未判定,缺入库源=S0,且 S2 真的在判
//   T6 退出码分流(机器态 vs 内容态)—— 用纯函数 + 构造输入验,不依赖本机有没有 prod-bundle
//
// 跑法:node --test scripts/tests/check-prod-bundle-shadow.test.mjs
// =============================================================================
import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as GATE } from '../check-prod-bundle-shadow.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const BUNDLE_REL = 'deploy/prod-bundle/'
const BUNDLE_DIR = join(REPO, 'deploy', 'prod-bundle')

const bundlePresent = existsSync(BUNDLE_DIR)

/** 只读取材,不改任何文件:git 的跟踪态与 blob 值 */
function git(args, cwd = REPO) {
  return execFileSync('git', ['-C', cwd, '-c', 'safe.directory=*', ...args], {
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
    // 真仓 ls-files -s 输出 >1.2MB,默认 1MB 上限会 ENOBUFS 把尺子打断(实测)
    maxBuffer: 256 * 1024 * 1024,
  })
}

// ── T1 装车证明(两处挂点)─────────────────────────────────────────────────
test('T1a 本门在 guardian-runner 的**提交链**上:blocking + skipEnv + 编号唯一', () => {
  const runner = readFileSync(join(REPO, 'scripts', 'guardian-runner.mjs'), 'utf8')
  // 取材面收窄到 checks 数组:同名字符串出现在 pushGateChecks 里不算"进了提交链"
  const start = runner.indexOf('const checks = [')
  const end = runner.indexOf('// === push 门检查集')
  if (start < 0 || end <= start) throw new Error('尺子失效:找不到 checks 数组边界')
  const region = runner.slice(start, end)

  const SELF = 'check-prod-bundle-shadow.mjs'
  const at = region.indexOf(`script: '${SELF}'`)
  if (at < 0) {
    throw new Error(
      `本门不在提交链 —— guardian-runner 的 checks 数组里没有 script: '${SELF}'。` +
        '这正是 2026-09-24 立门后的状态(只有 check:all 一个挂点),门存在而无人调度 = 没有门。',
    )
  }
  // 由 script 反推所在注册块(向前到最近的 `{`,向后到配平的 `}`),不硬写编号
  const open = region.lastIndexOf('{', at)
  let depth = 0
  let close = -1
  for (let i = open; i < region.length; i += 1) {
    if (region[i] === '{') depth += 1
    else if (region[i] === '}') {
      depth -= 1
      if (depth === 0) {
        close = i
        break
      }
    }
  }
  if (close < 0) throw new Error('注册块花括号不配平 —— 尺子失效')
  const block = region.slice(open, close + 1)

  const id = block.match(/id:\s*'([^']+)'/)?.[1]
  if (!id) throw new Error('注册块里没有 id —— runner 的撞号自检看不见它')
  if (!/mode:\s*'blocking'/.test(block)) {
    throw new Error(`本门必须是 blocking(warn 级等于回到"漂移静默"),现块:\n${block}`)
  }
  const skipEnv = block.match(/skipEnv:\s*'([^']+)'/)?.[1]
  if (!skipEnv) throw new Error('注册块缺 skipEnv —— 没有应急通道的门只会逼人 --no-verify')
  // 编号唯一性:同号会把 skipEnv 语义与"哪道门失败"的归因搅在一起(同日实测撞号 4 次)
  const allIds = [...region.matchAll(/^\s+id:\s*'([^']+)'/gm)].map((m) => m[1])
  const dup = allIds.filter((x) => x === id).length
  if (dup !== 1) throw new Error(`编号 ${id} 在 checks 数组里出现 ${dup} 次(须恰好 1 次)`)
  // 声明的 skipEnv 必须真是门脚本自己读的那个,否则键名写错 = 承诺的出口不存在
  const gateSrc = readFileSync(join(REPO, 'scripts', SELF), 'utf8')
  if (!gateSrc.includes(skipEnv)) {
    throw new Error(`runner 声明 ${skipEnv},但门脚本通篇不读它 —— 应急通道是假的`)
  }
})

test('T1b 本门同时挂在根 package.json 的 check:all 链上', () => {
  const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8'))
  const chain = pkg.scripts?.['check:all'] ?? ''
  if (!chain.includes('node scripts/check-prod-bundle-shadow.mjs')) {
    throw new Error('check:all 不再调用本门 —— 登记表与运行副本再无人对账')
  }
  // 阳性对照:同一把尺子扫一条确实存在的其它门,证明不是"字符串恒包含"
  if (!chain.includes('check-prod-bundle-shadow')) throw new Error('尺子失效')
})

// ── T2 登记表形状 + 落点规则 ────────────────────────────────────────────────
test('T2 每条登记三键齐备、runner 在被忽略侧、tracked 不得也在被忽略侧', () => {
  if (!Array.isArray(GATE.PAIRS) || GATE.PAIRS.length < 6) {
    throw new Error(`登记表异常:现 ${Array.isArray(GATE.PAIRS) ? GATE.PAIRS.length : '非数组'} 条`)
  }
  for (const p of GATE.PAIRS) {
    if (!p.tracked || !p.runner || !p.why) throw new Error(`登记缺键: ${JSON.stringify(p)}`)
    if (!p.runner.startsWith(BUNDLE_REL)) {
      throw new Error(`${p.runner} 不是 prod-bundle 运行副本 —— 本门只管这一型`)
    }
    if (p.tracked.startsWith(BUNDLE_REL)) {
      throw new Error(`${p.tracked} 入库源落在被忽略目录里 ⇒ S1 必红,登记自相矛盾`)
    }
    if (p.tracked === p.runner) throw new Error('两侧同路径 = 没有对账对象')
  }
})

// ── T3 真仓现测:全绿且零"无法判定" ─────────────────────────────────────────
test('T3 真仓 audit 全等值,undetermined / unverifiable 必须为 0', (t) => {
  if (!bundlePresent) return t.skip('本机没有 deploy/prod-bundle(整目录被忽略),无从判定')
  const res = GATE.audit(REPO, GATE.PAIRS)
  const out = res.lines.join('\n')
  if (res.unverifiable !== 0) throw new Error(`有 ${res.unverifiable} 对问不到 git:\n${out}`)
  if (res.undetermined !== 0) throw new Error(`有 ${res.undetermined} 对未判定:\n${out}`)
  if (!res.ok) throw new Error(`对账未过:\n${out}`)
  if (GATE.decide(res).code !== 0) throw new Error('全等值却不出 0')
  const eq = res.lines.filter((l) => l.trimStart().startsWith('✅')).length
  if (eq !== GATE.PAIRS.length) throw new Error(`✅ 行数 ${eq} != 登记对数 ${GATE.PAIRS.length}`)
})

// ── T4 反查登记表腐烂(本镜像测试存在的理由)────────────────────────────────
test('T4 prod-bundle 里凡有逐字节相同的跟踪文件,就必须已登记', (t) => {
  if (!bundlePresent) return t.skip('本机没有 deploy/prod-bundle,反查面为空')
  const tracked = new Map() // blob -> path
  for (const line of git(['ls-files', '-s']).trim().split('\n')) {
    const [head, p] = line.split('\t') // "<mode> <sha> <stage>\t<path>"(路径可含空格)
    if (!p || p.startsWith(BUNDLE_REL)) continue // 运行副本自身不算入库源
    const sha = head.split(' ')[1]
    if (!tracked.has(sha)) tracked.set(sha, p)
  }
  const registered = new Set(GATE.PAIRS.map((p) => p.runner))
  const orphans = []
  for (const f of readdirSync(BUNDLE_DIR)) {
    const abs = join(BUNDLE_DIR, f)
    // lstatSync 不跟随重解析点:junction / symlink 一律排除(§26 穿透事故)
    let st
    try {
      st = lstatSync(abs)
    } catch {
      continue
    }
    if (!st.isFile()) continue
    const sha = git(['hash-object', '--', abs]).trim()
    const src = tracked.get(sha)
    if (src && !registered.has(BUNDLE_REL + f)) orphans.push(`${BUNDLE_REL + f} ← ${src}`)
  }
  if (orphans.length > 0) {
    throw new Error(
      `登记表漏了 ${orphans.length} 对(门在判,但看不见这一类):\n  ${orphans.join('\n  ')}`,
    )
  }
  // 阳性对照:尺子必须认得一枚真登记,否则"零孤儿"可能只是它扫不到东西
  const known = GATE.PAIRS[0]
  const knownSha = git(['hash-object', '--', join(REPO, known.tracked)]).trim()
  if (tracked.get(knownSha) !== known.tracked) {
    throw new Error(`尺子失效:连已登记的 ${known.tracked} 都没从 ls-files -s 里认出来`)
  }
})

// ── T5 变异端到端:改任一侧 / 摘线 / 缺运行副本 / 缺入库源 / S2 各自结论正确 ─
test('T5 临时仓六种坏法各自判对并点名,等值时判绿', () => {
  const root = mkScratch('pb-shadow-')
  try {
    mkdirSync(join(root, 'deploy/win'), { recursive: true })
    mkdirSync(join(root, 'deploy/prod-bundle'), { recursive: true })
    writeFileSync(join(root, '.gitignore'), 'deploy/prod-bundle/\n')
    const g = (...a) => git(a, root)
    g('init', '-q', '-b', 'main')
    const T = 'deploy/win/x.ps1'
    const R = 'deploy/prod-bundle/x.ps1'
    const one = "Write-Host 'one'\n"
    writeFileSync(join(root, T), one)
    writeFileSync(join(root, R), one)
    g('add', '-f', '--', '.gitignore', T)
    g('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init')
    const pairs = [{ tracked: T, runner: R, why: 't' }]
    const text = (r) => r.lines.join('\n')

    if (GATE.audit(root, pairs).ok !== true) throw new Error('等值却判红 —— 门坏了')

    // ① 只改运行副本(生产侧漂移,本门立门的那一型)
    writeFileSync(join(root, R), "Write-Host 'two'\n")
    const m1 = GATE.audit(root, pairs)
    if (m1.ok !== false || !text(m1).includes('S3') || !text(m1).includes(R)) {
      throw new Error(`改运行副本未被点名:\n${text(m1)}`)
    }
    writeFileSync(join(root, R), one)

    // ② 只改入库源
    writeFileSync(join(root, T), "Write-Host 'three'\n")
    const m2 = GATE.audit(root, pairs)
    if (m2.ok !== false || !text(m2).includes('S3')) throw new Error(`改入库源未判红:\n${text(m2)}`)
    writeFileSync(join(root, T), one)

    // ③ 入库源被摘线 ⇒ S1(不得"看不见就算过")
    g('rm', '--cached', '-q', '--', T)
    g('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'untrack')
    const m3 = GATE.audit(root, pairs)
    if (m3.ok !== false || !text(m3).includes('S1')) throw new Error(`摘线未判 S1:\n${text(m3)}`)
    g('add', '-f', '--', T)
    g('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'retrack')
    if (GATE.audit(root, pairs).ok !== true) throw new Error('恢复跟踪后没有回到绿')

    // ④ 缺运行副本 ⇒ 「未判定」:不判红(否则非部署机每次提交被拦),但绝不静默
    const m4 = GATE.audit(root, [{ tracked: T, runner: 'deploy/prod-bundle/nope.ps1', why: 't' }])
    // ok 必须仍为 true:这一型是机器态,拿它判红等于造一台恒红门
    if (m4.ok !== true || m4.undetermined !== 1 || m4.unverifiable !== 0) {
      throw new Error(
        `缺运行副本应计"未判定且不判红",实为 ok=${m4.ok} undetermined=${m4.undetermined} ` +
          `unverifiable=${m4.unverifiable}:\n${text(m4)}`,
      )
    }
    if (!text(m4).includes('未判定')) throw new Error('未判定必须可见,不得静默绿')
    if (GATE.decide(m4).code !== 0) throw new Error('只剩机器态未判定却不出 0')

    // ④b 缺入库源 ⇒ S0 真缺陷(这一侧在所有机器上检出都该在),照判红
    const m4b = GATE.audit(root, [{ tracked: 'deploy/win/nope.ps1', runner: R, why: 't' }])
    if (m4b.ok !== false || m4b.undetermined !== 0 || !text(m4b).includes('S0')) {
      throw new Error(`缺入库源应判 S0 红且不折进未判定:\n${text(m4b)}`)
    }
    if (GATE.decide(m4b).code !== 1) throw new Error('S0 的退出码必须是 1')

    // ⑤ 运行副本被纳入版本树 ⇒ S2(登记表过期,不是等值问题)
    g('add', '-f', '--', R)
    g('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'track-runner')
    const m5 = GATE.audit(root, pairs)
    if (m5.ok !== false || !text(m5).includes('S2')) throw new Error(`S2 没在判:\n${text(m5)}`)
  } finally {
    rmScratch(root)
  }
})

// ── T6 退出码分流:纯函数 + 构造输入 ────────────────────────────────────────
// 为什么单列:机器态 vs 内容态的分流是本门能否进提交链的**唯一**理由,而它无法在真仓上
// 现场造出来(要模拟非部署机就得改名整目录 —— 那是别人的领域,并行会话正在用)。
// 用纯函数把结论钉死,不依赖本机形态(§"证明取材面这类行为只能用纯函数+构造面")。
test('T6 decide:机器态出 0、内容态出 1、问不到 git 出 2 且优先', () => {
  const cases = [
    ['全等值', { ok: true, undetermined: 0, unverifiable: 0 }, 0],
    ['只剩机器态未判定 ⇒ 不得拦提交', { ok: true, undetermined: 3, unverifiable: 0 }, 0],
    ['内容态漂移', { ok: false, undetermined: 0, unverifiable: 0 }, 1],
    ['内容态红 + 别的对未判定 ⇒ 仍须红', { ok: false, undetermined: 2, unverifiable: 0 }, 1],
    ['git 判不动 ⇒ 2(既不记绿也不冒充判据红)', { ok: true, undetermined: 0, unverifiable: 1 }, 2],
    ['git 判不动优先于内容态红', { ok: false, undetermined: 1, unverifiable: 1 }, 2],
  ]
  const fails = []
  for (const [name, input, want] of cases) {
    const got = GATE.decide(input)
    if (got.code !== want) fails.push(`${name}:期望 exit ${want},实得 ${got.code}`)
  }
  if (fails.length) throw new Error(fails.join('\n  '))
  // 反向对照:漏掉 unverifiable 字段不得被当成 0(缺输入 = 无法判定,不是通过)
  const noField = GATE.decide({ ok: true, undetermined: 0 })
  if (noField.code !== 0) {
    throw new Error(`unverifiable 未给时应按 0 计(现实现用 >0 判定),实得 ${noField.code}`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
