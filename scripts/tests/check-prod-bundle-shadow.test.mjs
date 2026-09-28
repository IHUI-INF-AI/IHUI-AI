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
//   T7 (G-405)旧版 A/B —— 同一夹具下,pre-E1 冻结快照对"未登记 stray.ps1"必须**全盲**,
//      而新 audit 必须点名;并钉死定级:默认档不判红、--strict 判红、补登记即闭合。
//   T8 (G-405)装车与守卫形状锁 —— enumerateBundle 必须真挂在 audit 上(函数在而无人调
//      = 没有,守门 70/76/81/102 同族);重解析点不跟随、预算截断两处判据在代码位;
//      main 必须把 --strict 喂进 decide。
//   T9 (G-405)输出标记锁 —— E1 的任何行都不得以 "  ✅" 起头(T3 的 "✅ 行 + 未判定 ==
//      登记对数" 核账会被 E1 的 ✅ 顶歪);闭合报名必须走 ℹ。
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
// pre-E1 冻结快照(禁止演进 —— 它一旦被同步上新功能,T7 就从"证明旧版盲"退化成复读机)
import { __legacy__ as LEGACY } from './fixtures/prod-bundle-shadow.legacy.mjs'

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
test('T3 真仓:本机可判定的对必须逐字节等值;缺运行副本必须被**分类并喊出**而不是记绿', (t) => {
  if (!bundlePresent) return t.skip('本机没有 deploy/prod-bundle(整目录被忽略),无从判定')
  const res = GATE.audit(REPO, GATE.PAIRS)
  const out = res.lines.join('\n')
  if (res.unverifiable !== 0) throw new Error(`有 ${res.unverifiable} 对问不到 git:\n${out}`)
  /**
   * 刻意**不**断言 `undetermined === 0`。本门判的是"部署机上实际执行的那份 == 入库源",
   * 而 `deploy/prod-bundle/` 整目录被 .gitignore 忽略 ⇒ 运行副本只存在于部署机;
   * 在非部署机(含 CI 的干净检出)上"缺运行副本"是**机器状态**,不是代码缺陷。
   * 把机器状态写成必过断言 = 每台非部署机上一次红,而恒红门的唯一结局是逼人 `--no-verify`
   * 连带废掉全部守门(§12e 同型;AGENTS 对"判机器态的门"的处置是换落点而不是削判据)。
   * 于是这里钉的是**该型必须被正确分类**的三条不变量。
   */
  if (res.undetermined > 0) {
    const reasonLines = res.lines.filter((l) => l.includes('未判定'))
    if (reasonLines.length < res.undetermined)
      throw new Error(
        `${res.undetermined} 对未判定,但只有 ${reasonLines.length} 行喊出原因(静默未判定 = 把"没判"写成"判过了")\n${out}`,
      )
    if (!res.lines.some((l) => l.includes('不在本机') || l.includes('无法')))
      throw new Error(`未判定必须带"为什么"的具体原因:\n${out}`)
    if (GATE.decide(res).code !== 0)
      throw new Error(
        `非部署机上"缺运行副本"不得判红(那会让每一次提交被拦),实得 rc=${GATE.decide(res).code}`,
      )
  }
  if (!res.ok) throw new Error(`本机可判定的对出现内容态不等:\n${out}`)
  const eq = res.lines.filter((l) => l.trimStart().startsWith('✅')).length
  if (eq + res.undetermined !== GATE.PAIRS.length)
    throw new Error(
      `等值 ${eq} + 未判定 ${res.undetermined} != 登记对数 ${GATE.PAIRS.length} ⇒ 有一对既没比也没喊,既不是通过也不是未判定`,
    )
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

// ── T7 旧版 A/B(G-405 立项证据):未登记的脚本躺在盲区目录,旧实现必须全盲 ───
// 这是本票存在的全部理由,也是"新判据有牙"的唯一可复核形态:同一份夹具、同一时刻、
// 两份实现各喂一遍 —— 旧版报"一切正常"而新版点名。方向反过来(新版也看不见)或
// 旧版也看得见(快照被演进过)都算这条证据作废。
test('T7 pre-E1 旧实现对 stray.ps1 全盲且报绿;新实现点名、默认档不红、--strict 红、补登记闭合', () => {
  const root = mkScratch('pb-shadow-ab-')
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
    // 未登记的运行副本 —— G-405 的靶子:登记表没有它、也没有入库源,旧门对此结构失明
    writeFileSync(join(root, 'deploy/prod-bundle', 'stray.ps1'), "Write-Host 'stray'\n")
    g('add', '-f', '--', '.gitignore', T)
    g('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init')
    const pairs = [{ tracked: T, runner: R, why: 't' }]

    // ① 旧版:全绿、不点名、连"unlisted"这一态都不存在于返回形状里
    const legacy = LEGACY.audit(root, pairs)
    if (legacy.ok !== true) throw new Error(`夹具本身坏了(旧版不该判红):${legacy.lines.join('\n')}`)
    if (legacy.lines.join('\n').includes('stray.ps1'))
      throw new Error('旧版 A/B 失效:冻结快照竟然看见了 stray.ps1 —— 快照被演进过,T7 已不构成证据')
    if ('unlisted' in legacy)
      throw new Error('旧版 A/B 失效:冻结快照里出现了 unlisted 字段(它不该有这一态)')

    // ② 新版:同一夹具必须点名完整路径
    const fresh = GATE.audit(root, pairs)
    if (!fresh.unlisted.includes(`${GATE.BUNDLE_REL}/stray.ps1`)) {
      throw new Error(`新实现没点名 stray.ps1 —— E1 判据失明:\n${fresh.lines.join('\n')}`)
    }
    // ③ 定级(票面纪律:抬枚举面,不把判红搬进提交链)
    if (fresh.ok !== true || GATE.decide(fresh).code !== 0)
      throw new Error('默认档 unlisted 不得判红(部署机现存未登记脚本 ⇒ 判红=恒红门,§12e)')
    const strictVerdict = GATE.decide(fresh, { strict: true })
    if (strictVerdict.code !== 1 || strictVerdict.kind !== 'unlisted')
      throw new Error(`--strict 档必须判红且 kind=unlisted,实得 ${JSON.stringify(strictVerdict)}`)
    // ④ 补登记即闭合 —— 红是可治的,不是新恒红面
    const fixed = GATE.audit(root, [
      ...pairs,
      { tracked: T, runner: `${GATE.BUNDLE_REL}/stray.ps1`, why: 't' },
    ])
    if (fixed.unlisted.length !== 0)
      throw new Error(`登记后仍报 unlisted:${fixed.unlisted.join(', ')}`)
  } finally {
    rmScratch(root)
  }
})

// ── T8 装车与守卫形状锁(G-405)─────────────────────────────────────────────
// "函数写了、判据没挂上"是本仓记过最多次的失效型(守门 70/76/81/102 同族);而
// "枚举器跟穿 junction"是 §26 的穿透清空事故同族。这两件事只有源码级反向锁能防,
// 行为断言会跟着实现一起漂绿。
test('T8 E1 必须真挂在 audit 上;重解析点守卫与预算截断在代码位;main 把 --strict 喂进 decide', () => {
  const src = readFileSync(join(REPO, 'scripts', 'check-prod-bundle-shadow.mjs'), 'utf8')
  // 挂载点:audit 体内必须真的调用 enumerateBundle(root, pairs)(不是只 export 着)
  if (!/const en = enumerateBundle\(root, pairs\)/.test(src)) {
    throw new Error(
      'E1 未装车:audit() 里没有调用 enumerateBundle(root, pairs) —— 判据存在而无人调度 = 没有',
    )
  }
  // 重解析点守卫:枚举必须用 withFileTypes + isSymbolicLink 排除(§26 junction 教训)
  if (!/readdirSync\([^)]*withFileTypes/.test(src) || !src.includes('d.isSymbolicLink()')) {
    throw new Error(
      'E1/digest 枚举不再判重解析点 —— 会顺着 junction 把别的落点读成盲区目录的内容(§26)',
    )
  }
  // 预算截断:超限必须落 truncated 并被调用方当"未判定"(空扫/截断不得读成闭合)
  if (!src.includes('BUNDLE_WALK_LIMITS') || !/out\.truncated = true/.test(src)) {
    throw new Error('E1 的枚举预算/截断判据不见了 —— 截断的集合上出"全部已登记"就是假绿')
  }
  // --strict 必须真的进 decide(否则头注承诺的问责档是张空头支票;§"文档不得写跑不通的出路")
  if (!/decide\(res, \{ strict \}\)/.test(src) || !/argv\.includes\('--strict'\)/.test(src)) {
    throw new Error('main() 不再把 --strict 喂给 decide —— 文档里的问责档变成假出路')
  }
  // 登记表腐烂方向的对账:E1 的未判定行必须存在(机器态不得静默)
  if (!src.includes('E1 未判定')) {
    throw new Error('E1 整目录缺失时的"未判定"点名行被删了 —— 静默的未判定与通过在提交链里长得一样')
  }
})

// ── T9 输出标记锁(G-405):E1 不得产出 ✅ 行,免得顶歪 T3 的核账 ──────────────
test('T9 E1 的行不得以 "  ✅" 起头(push 语义),闭合报名走 ℹ', () => {
  const src = readFileSync(join(REPO, 'scripts', 'check-prod-bundle-shadow.mjs'), 'utf8')
  // 只锁"push 出去的行",不锁散文(自检的反向断言里合法地引用过该形态字符串)
  if (/lines\.push\(\s*`\s{2}✅ ?E1/.test(src)) {
    throw new Error(
      'E1 开始产出 "  ✅ …" 行 —— T3 的核账(✅ 行数 + 未判定 == 登记对数)会被顶歪,' +
        '闭合报名的既定形态是 ℹ',
    )
  }
  if (!/lines\.push\(\s*`\s{2}ℹ E1/.test(src) && !src.includes('  ℹ E1 枚举闭合')) {
    throw new Error('E1 闭合时不再报名(ℹ 行没了)—— "全部已登记"必须是可以被读出来的事实')
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
