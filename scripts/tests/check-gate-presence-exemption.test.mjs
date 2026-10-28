// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 check-gate-presence-exemption.mjs(凭据在场即豁免对账)的 §22c 镜像测试。
 *
 * 为什么每例都存在:本门判的形态在编译期与运行期都没有症状(typecheck/lint/单测全绿),
 * 而它自己有三种"看起来正常其实失明"的方式,每一种都只会表现为"一路报绿":
 *  ① 注册块被并发合并摘线(门存在、判据对、无人调度 —— 守门 64/70/81 同型);
 *  ② 遮罩被复制成第二份本地实现(两处实现必漂移,注释里的旧写法会被判成仓库违规);
 *  ③ 取材退回磁盘(共享工作树滞后 HEAD ⇒ 同一份代码在恒红与假绿之间来回跳)。
 * 外加一条本门独有的锁:阳性对照(修复前那版 csrf.ts 被点名)必须在 HEAD 面的历史 blob 上
 * 成立,不得被改成"看磁盘上那份已修好的" —— 那会把这门的存在理由自己抹掉。
 * 判据一律经 import 复用源实现(§22c:禁止在测试里再抄一份判据)。
 *
 * T11–T14 是本票(把两型未覆盖形态纳入判据)新增的,各自钉一件事:
 *  T11 变量中转维有牙,且带**噪声上界反例**(右值与凭据无关的局部量不得被判成命中或未判定 ——
 *     这条如果哪天被"顺手放宽成什么标识符都算",A6 那类反例就是它的红点);
 *  T12 continue 维有牙,且**只扩放行语句的书写形态**:前导取反仍落 absence、break 仍不判,
 *     这两条反向对照钉的是"没有偷偷改放过通道";
 *  T13 装车锁:两个新函数必须真被 findPresenceExemptions 调用(函数在、导出在、自检过而主判据
 *     没接 = 提交链上一路绿灯,守门 70/76/81/102 各记过一次);
 *  T14 变异自证:在临时仓里把每一维各自摘掉跑同一份夹具 —— 必须**只有那一维**读零,
 *     既有形态与另一维照旧命中("红要红在该维,不是别处";只摘一遍就把整门摘瞎的变异不算证明)。
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SRC = join(REPO, 'scripts', 'check-gate-presence-exemption.mjs')
const SRC_REL = 'scripts/check-gate-presence-exemption.mjs'

const GATE = await import(pathToFileURL(SRC).href)
const T = GATE.__test__

/** git 派生不得依赖 PATH(§5b:服务账户与交互终端的 PATH 不通)—— 绝对路径由 face-reader 的出口给。 */
const GIT_BIN = await import(pathToFileURL(join(REPO, 'scripts', 'lib', 'gitdir.mjs')).href).then(
  (m) => m.resolveGitBin() || 'git',
)

function runGit(args, timeout = 120000) {
  return execFileSync(GIT_BIN, ['-c', 'safe.directory=*', '-C', REPO, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout,
    maxBuffer: 64 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function runNode(args, timeout = 600000) {
  return execFileSync(process.execPath, args, {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    windowsHide: true,
    timeout,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/**
 * 从 runner 全文按"script 行 → 向上取最近的 id 行"抽出本门注册条目。
 * 这是本测试自己的取数管道,不是判据的第二份(测试要证明的是注册形态,不是分类行为)。
 */
function extractEntry(text, scriptName) {
  const lines = text.split('\n')
  const at = lines.findIndex((l) => l.trim() === `script: '${scriptName}',`)
  if (at < 0) return null
  let idLine = -1
  for (let i = at; i >= 0; i--) {
    if (/^\s+id:\s*['"][^'"]+['"],\s*$/.test(lines[i])) {
      idLine = i
      break
    }
  }
  if (idLine < 0) return null
  return { idLine, block: lines.slice(idLine, at + 30).join('\n'), id: lines[idLine].trim() }
}

test('T1 装车证明:runner(HEAD 面)里必须真有本门条目,且 blocking + skipEnv + stagedTriggers 齐备', () => {
  // 读 HEAD blob,不读磁盘 —— 共享工作树那份可能滞后(§12d/守门 84 记过的那一型)
  const runner = runGit(['show', 'HEAD:scripts/guardian-runner.mjs'])
  const e = extractEntry(runner, SRC_REL.replace('scripts/', ''))
  assert.ok(
    e,
    'check-gate-presence-exemption.mjs 不在 HEAD 的 runner 注册表里 —— 门存在而无人调度 = 没有',
  )
  assert.match(e.block, /mode:\s*'blocking'/, '本门必须 blocking(存量有 HEAD 棘轮兜住,不会恒红)')
  assert.match(
    e.block,
    /skipEnv:\s*'HUSKY_SKIP_GATE_PRESENCE_EXEMPTION'/,
    '缺 skipEnv 就没有应急出口',
  )
  assert.match(
    e.block,
    /stagedTriggers:[^\n]*apps\//,
    '缺 stagedTriggers 会让本门在提交链上根本不唤起',
  )
  assert.doesNotMatch(
    e.id,
    /id: "/,
    '注册 id 必须是单引号形态(双引号 id 对按单引号解析的判据隐身 —— gate-registry-insert 头注 ①)',
  )
})

test('T2 摘线不得被读成已装车:把 script 行改掉后,同一提取函数必须返回 null', () => {
  const runner = runGit(['show', 'HEAD:scripts/guardian-runner.mjs'])
  const stripped = runner.replace(
    `script: 'check-gate-presence-exemption.mjs',`,
    `script: 'check-somebody-elses-gate.mjs',`,
  )
  assert.equal(
    extractEntry(stripped, 'check-gate-presence-exemption.mjs'),
    null,
    '摘掉 script 行后仍被判定"已装车" —— 说明 T1 的锚点根本不看 script 行',
  )
})

test('T3 遮罩实现只能有一份:本门必须 import lib,不得留本地分词器', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.match(
    src,
    /from '\.\/lib\/code-mask\.mjs'/,
    '本门没引共用遮罩 —— 第二份实现必漂移(§3 共享层优先)',
  )
  assert.ok(
    !/function\s+(maskComments|scanSpans|blankStrings)[\w]*\s*\(/.test(src),
    '本门里不得再定义遮罩函数(守门 135 镜像 T7 同一条锁)',
  )
})

test('T4 取材面形状锁:默认档必须判 HEAD,内容必须经 face-reader 的读取入口', async () => {
  const src = readFileSync(SRC, 'utf8')
  assert.match(
    src,
    /from '\.\/lib\/face-reader\.mjs'/,
    '本门必须走 face-reader(守门 118 判"半接线"那一型)',
  )
  assert.match(src, /catBatch\(/, '没调用层的读取入口 = 引了层却自己读,正是 118 收紧要拦的形态')
  assert.match(src, /def:\s*'head'/, "selectFace 缺省面必须是 'head'(全量判 HEAD blob)")
  assert.ok(!/readFileSync\(/.test(src), '被审内容不得从磁盘直读(共享工作树滞后 HEAD 时会换结论)')
  // 两面旗同给 ⇒ exit 2:行为级证明(spawn,不 import,避免踩 selectFace 之外的路径)
  try {
    runNode([SRC, '--staged', '--worktree'])
    assert.fail('两面旗同给却 exit 0')
  } catch (e) {
    assert.equal(e.status, 2, `两面旗同给应 exit 2,实得 ${e.status}`)
  }
})

test('T5 真仓 HEAD 端到端:立项那一侧必须真被读到、正确形态必须落 passed(全量档不得因存量判红)', () => {
  const out = runNode([SRC, '--json'])
  const j = JSON.parse(out)
  assert.ok(j.scannedFiles > 100, `扫描面异常小(${j.scannedFiles})—— 枚举或覆盖面过滤坏了`)
  assert.equal(j.emptyScan, false, '空扫不得记绿')
  assert.ok(
    !j.hitSites.some((h) => h.text.includes('x-internal-service-token')),
    '注释里逐字引用的旧写法不得被当成站点(判据面先剥注释的正向证明)',
  )
  assert.notEqual(j.exit, 1, 'HEAD 全量档不得因存量判红(锚点=该文件自身;判红=恒红门,§12e)')
  // 覆盖面自证钉在「本门立项的那一只文件」上,而不是钉它的存量条数:
  // 旧写法断言「HEAD 必须点名 csrf.ts 的 x-goog-api-key 存量」,而该存量已于 c824c12070 改为
  // 查库验真路径 —— 把立项时的读数当恒定前提,账还清那天这条断言就变成"门瞎了"(§12e/守门 150、165
  // 同一条规矩:阳性对照钉出处 ref,不钉 HEAD)。存量可见性由 T6 用修复前的历史 blob 证明。
  const one = T.analyze('head', ['apps/api/src/plugins/csrf.ts'])
  assert.equal(one.scannedFiles, 1, 'csrf.ts 没进被审面 = 枚举/射程过滤把它筛掉了,本门对立项那一型失明')
  assert.equal(one.unreadable.length, 0, `csrf.ts 在 HEAD 面取不到:${JSON.stringify(one.unreadable)}`)
  assert.ok(
    one.passed >= 1,
    '修复后的正确形态(验过才免)必须落 passed —— 认不出它, hits=0 就只是"没看见"而不是"没有"',
  )
})

test('T6 阳性对照用纯函数证明:历史 blob 必红、修复后同文件该站必不红', () => {
  const old = T.readHistoricalCsrf()
  assert.equal(
    typeof old,
    'string',
    '修复前那版 csrf.ts 取不到 ⇒ 本门的存在理由不可复核(判失败,不静默)',
  )
  const rOld = T.findPresenceExemptions(old)
  assert.ok(
    rOld.hits.some((h) => h.text.includes('x-internal-service-token')),
    '同一判据对修复前的「凭据存在即豁免」必须点名',
  )
  // 修复后(HEAD csrf.ts):同一行位置换成验证调用 ⇒ 不得再是 hit
  const fixedSrc = old.replace(
    "if (request.headers['x-internal-service-token']) return",
    'if (await isVerifiedInternalMachineCall(request)) return',
  )
  assert.notEqual(fixedSrc, old, '构造面替换没命中(历史文本形态已漂,先查再改测试)')
  const rFixed = T.findPresenceExemptions(fixedSrc)
  assert.equal(rFixed.hits.filter((h) => h.text.includes('x-internal-service-token')).length, 0)
  assert.ok(
    rFixed.passed.some((p) => p.text.includes('isVerifiedInternalMachineCall')),
    '替换成"验过才免"后必须落 passed —— 反向对照若也绿,说明判据两边都不认,尺子是坏的',
  )
})

const ANCHOR_REL = 'apps/api/src/plugins/anchor-sample.ts'
const anchorText = (names) =>
  `export const handler = async (request) => {\n${names
    .map((n) => `  if (request.headers['${n}']) return`)
    .join('\n')}\n  await verify(request)\n}\n`

/** 临时仓里的 git/node 派生:锚点判据必须在"HEAD 有一处存量"这个构造面上跑,真仓此刻给不出。 */
function gitAt(dir, args, timeout = 120000) {
  return execFileSync(GIT_BIN, ['-c', 'safe.directory=*', '-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout,
    maxBuffer: 8 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}
function runNodeAt(cwd, args, timeout = 600000) {
  return execFileSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    windowsHide: true,
    timeout,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

test('T7 棘轮的锚点必须是"该文件在 HEAD 面的自身存量",不得是 0、也不得是手工清单', () => {
  // 旧写法把这条钉在真仓 HEAD 的 csrf.ts 存量条数 == 1 上,而该存量已于 c824c12070 清偿为
  // 查库验真 ⇒ 锚点面已漂:按它派单只会得到一条与任何改动无关的恒红(§12e)。
  // 本例改成在临时仓里**造出**"HEAD 有 1 处存量"的现场,三臂各钉一条不变量:
  //  A 加到 2 处 ⇒ cap=1 ⇒ 判红(锚点不是手工清单:清单里没有这个新文件也能算出 cap)
  //  B 仍是 1 处、只换 header 名 ⇒ 与 cap 等值 ⇒ 不得判红(锚点不是 0:写死 0 会把存量当新增)
  //  C HEAD 里没有的新文件带 1 处 ⇒ cap=0 ⇒ 判红(逐文件推导,不是全仓一张免检表)
  const dir = mkScratch('gpe-anchor')
  try {
    const scriptsDir = join(dir, 'scripts')
    mkdirSync(scriptsDir, { recursive: true })
    copyScriptWithClosure(
      join(REPO, 'scripts'),
      'check-gate-presence-exemption.mjs',
      scriptsDir,
      ['lib/code-mask.mjs', 'lib/face-reader.mjs'],
    )
    const gatePath = join(scriptsDir, 'check-gate-presence-exemption.mjs')
    const target = join(dir, ANCHOR_REL)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, anchorText(['x-golden-legacy']), 'utf8')
    gitAt(dir, ['init', '-q', '-b', 'main'])
    gitAt(dir, ['add', '--', ANCHOR_REL])
    gitAt(
      dir,
      ['-c', 'user.email=anchor@test', '-c', 'user.name=anchor', 'commit', '-q', '-m', 'baseline'],
    )
    // 判红(exit 1)本身就是这些臂的期望结果,而 execFileSync 在非零退出时抛错 ——
    // 结论在 e.stdout 里。只 catch"业务红"(1),"没跑到"(2=无法判定/派生失败)必须照抛,
    // 否则把"门崩了"读成"门判红"(§22c/收敛链那条"崩溃 ≠ 裁决"同一条禁令)。
    const stagedJson = () => {
      let text
      try {
        text = runNodeAt(dir, [gatePath, '--staged', '--json'])
      } catch (e) {
        if (e.status !== 1) throw e
        text = String(e.stdout ?? '')
      }
      return JSON.parse(text)
    }

    // 臂 A
    writeFileSync(target, anchorText(['x-golden-legacy', 'x-golden-second']), 'utf8')
    gitAt(dir, ['add', '--', ANCHOR_REL])
    const a = stagedJson()
    assert.equal(a.scannedFiles, 1, `临时仓只该扫到这一个在射程文件,实得 ${a.scannedFiles}`)
    assert.equal(a.red.length, 1, '臂 A:1→2 处必须判红(锚点没生效就不会红)')
    assert.equal(a.red[0].cap, 1, `臂 A:cap 必须由 HEAD 面算出,实得 ${a.red[0].cap}`)
    // strict 档语义(问责入口)一并钉在构造面上:全量档默认只因"新增"红,strict 则"有命中即红"。
    // 旧写法拿真仓 HEAD 的存量当这一臂的输入,存量清偿后它就变成"要求门必须红在一条不存在的账上"。
    assert.equal(
      (() => {
        try {
          runNodeAt(dir, [gatePath, '--strict'])
          return 0
        } catch (e) {
          return e.status
        }
      })(),
      1,
      'strict 档对构造面的存量命中必须拒绝出合格证(exit 1)',
    )

    // 臂 B
    writeFileSync(target, anchorText(['x-golden-renamed']), 'utf8')
    gitAt(dir, ['add', '--', ANCHOR_REL])
    const b = stagedJson()
    assert.equal(b.red.length, 0, '臂 B:同一处存量只换写法不得被判成新增 —— 锚点被写死 0 时这条必红')

    // 臂 C
    writeFileSync(target, anchorText(['x-golden-renamed']), 'utf8')
    gitAt(dir, ['add', '--', ANCHOR_REL])
    gitAt(
      dir,
      ['-c', 'user.email=anchor@test', '-c', 'user.name=anchor', 'commit', '-q', '-m', 'anchor-1'],
    )
    const freshRel = 'apps/api/src/plugins/anchor-fresh.ts'
    writeFileSync(join(dir, freshRel), anchorText(['x-golden-fresh']), 'utf8')
    gitAt(dir, ['add', '--', freshRel])
    const c = stagedJson()
    assert.equal(
      c.red.length,
      1,
      '臂 C:HEAD 里没有的新文件带一处存量 ⇒ cap=0 ⇒ 必须红(逐文件锚点,不是全仓免检表)',
    )
    assert.equal(c.red[0].file, freshRel, `臂 C:红的必须是那个新文件,实得 ${c.red[0].file}`)
  } finally {
    rmScratch(dir)
  }
})

test('T8 暂存档"无射程内文件 ⇒ 回退全量"只在一种情形成立,不得被顺手改成无条件回退', () => {
  // 只用纯函数 + 构造面(端到端那一例取决于共享索引此刻有什么 —— 守门 103 T12 那一课)。
  assert.equal(
    T.shouldRetreatToHead({ face: 'staged', hasOnlyFiles: false, stagedInScopeCount: 0 }),
    true,
  )
  assert.equal(
    T.shouldRetreatToHead({ face: 'staged', hasOnlyFiles: false, stagedInScopeCount: 1 }),
    false,
  )
  assert.equal(
    T.shouldRetreatToHead({ face: 'staged', hasOnlyFiles: true, stagedInScopeCount: 0 }),
    false,
  )
  assert.equal(
    T.shouldRetreatToHead({ face: 'head', hasOnlyFiles: false, stagedInScopeCount: -1 }),
    false,
  )
})

test('T9 判据必须覆盖门自己产出的形态:豁免标记行不被注释遮掉,也不得被当成静默通过', () => {
  const withExempt =
    "server.addHook('onRequest', async (request) => {\n  if (request.headers['x-a']) return // presence-exempt: 机器投递,签名验签在路由层\n})"
  const r = T.findPresenceExemptions(withExempt)
  assert.equal(r.hits.length, 0, '带原因的豁免必须放行')
  assert.equal(r.exempted.length, 1, '豁免要计数,不得静默 —— "报了数"与"看不见"在账面上必须不同形')
  const bare =
    "server.addHook('onRequest', async (request) => {\n  if (request.headers['x-a']) return // presence-exempt:\n})"
  assert.equal(
    T.findPresenceExemptions(bare).hits.length,
    1,
    '裸标记(无原因)不得放行(守门 102 同锁)',
  )
})

test('T10 --self-test 端到端 exit 0(判据自身可取证)', () => {
  const out = runNode([SRC, '--self-test'])
  assert.match(out, /--self-test: 全部通过/)
})

/* ───────────── 本票新增两维:A(变量中转)与 B(continue 放行) ───────────── */

/** 两段"新维独有"的夹具文本:一段靠 A 维才看得见,一段靠 B 维才看得见。 */
const A_TEXT = `  const authToken = request.headers.authorization ?? request.cookies?.auth_token
  if (authToken) return`
const B_TEXT = `  for (const p of policies) {
    if (request.headers['x-internal-service-token']) continue
    await check(p)
  }`
/** 既有形态的夹具:两维都摘掉后它仍必须命中(证明变异只摘了那一维,没有把整门摘瞎)。 */
const LEGACY_TEXT = `  if (request.headers['x-golden-legacy']) return`

test('T11 A 维有牙:凭据先取进变量再判必须被点名,而噪声上界的反例四档全空', () => {
  const r = T.findPresenceExemptions(A_TEXT)
  assert.equal(
    r.hits.length,
    1,
    `变量中转的存在性豁免未被点名 —— 本票第一格白做(实得 ${r.hits.length})`,
  )
  assert.match(r.hits[0].reason, /变量中转/, '命中要能看出是哪一维修的,否则报告里两维长得一样')
  // 遮噪仍是同一份:同一段写在注释里不得计数
  assert.equal(T.findPresenceExemptions(`  // ${A_TEXT.replace(/\n/g, '\n  // ')}`).hits.length, 0)
  // 声明表本身的两种书写:普通 + 解构,且只认同文件内一跳
  const decls = T.collectDeclarations(
    'const authToken = request.headers.authorization\nconst { ua } = request.headers\nconst flag = cfg.on\n',
  )
  assert.ok(decls.get('authToken') && /headers/.test(decls.get('authToken')[0]), '普通声明没进表')
  assert.ok(
    decls.get('ua') && /headers/.test(decls.get('ua')[0]),
    '解构声明没进表(局部名要登记,键名不算)',
  )
  assert.equal(
    T.traceIdentifierCondition('flag', decls),
    null,
    '右值与凭据无关的局部量必须留在射程外',
  )
  assert.equal(
    T.traceIdentifierCondition('authToken', new Map()),
    null,
    '找不到声明时不猜(形参/外层作用域属登记过的边界)',
  )
  // 噪声上界的端到端反例:与凭据无关的中转,四档全空(既不判红也不计未判定)
  const noise = T.findPresenceExemptions('  const enabled = cfg.csrfEnabled\n  if (enabled) return')
  assert.deepEqual(
    [noise.hits.length, noise.passed.length, noise.undetermined.length, noise.absent],
    [0, 0, 0, 0],
    'A 维把无关局部量卷进来了 —— 那正是"strict 永远出不了合格证"的恒红门形态(§12e)',
  )
  // Prettier 把长右值折到紧邻下一行是真写法:不认它 = 对格式化后的仓库整型隐身(而读数仍是 0)
  const wrapped = T.findPresenceExemptions(
    '  const authToken =\n    request.headers.authorization\n  if (authToken) return',
  )
  assert.equal(
    wrapped.hits.length,
    1,
    '折行的右值没被追到 ⇒ A 维只在手写不换行的夹具上有效,真仓读不到',
  )
  // 反向:等号与值之间夹空行,绝不许去抓后面某行的凭据出处(那会给别人的变量发合格证)
  const blankSep = T.collectDeclarations(
    'const flag =\n\nconst other = request.headers.authorization\n',
  )
  assert.doesNotMatch(
    String(blankSep.get('flag') ?? ''),
    /headers/,
    '空行之后的凭据出处被算到了 flag 头上(越界)',
  )
})

test('T12 B 维有牙:continue 形态必须被认作放行,而取反方向与 break 边界不得被顺手改动', () => {
  const r = T.findPresenceExemptions(B_TEXT)
  assert.equal(
    r.hits.length,
    1,
    `循环里"凭据在场即跳过本条校验"未被点名 —— 本票第二格白做(实得 ${r.hits.length})`,
  )
  assert.match(r.hits[0].text, /x-internal-service-token/)
  // 放行语句表:逐条判一个具体的书写形态,红点直指这一维
  assert.equal(T.PASS_STMT_RE.test('continue'), true, 'PASS 表不认 continue = 这一维被摘掉了')
  assert.equal(T.PASS_STMT_RE.test('continue outer'), true, '带标签的 continue 同样跳过本条校验')
  assert.equal(T.PASS_STMT_RE.test('return'), true, '既有 return 形态必须照旧认')
  assert.equal(T.PASS_STMT_RE.test('return false'), false, 'return false 不是"跳过校验"')
  assert.equal(T.PASS_STMT_RE.test('break'), false, 'break 今天不进 PASS 表(头注"已知不判 3")')
  // 放过通道一条没动:前导取反仍是"不适用即继续",两形(return / continue)同规则
  for (const [label, text] of [
    ['return 形(既有)', "  if (!request.headers['x-webhook']) return"],
    [
      'continue 形(本票新增)',
      "  for (const p of policies) {\n    if (!request.headers['x-webhook']) continue\n  }",
    ],
  ]) {
    const x = T.findPresenceExemptions(text)
    assert.equal(x.hits.length, 0, `${label}:取反形态被翻成红 = 放宽/改写了既有放过通道`)
    assert.equal(x.absent, 1, `${label}:取反形态应落 absence 档(计数在案,不是静默)`)
  }
  // break 的边界是登记过的事实:同一段只把 continue 换成 break ⇒ 不得命中
  assert.equal(T.findPresenceExemptions(B_TEXT.replace('continue', 'break')).hits.length, 0)
})

test('T13 装车锁:两个新函数必须真被主判据调用(函数在而无人调 = 提交链上一路绿灯)', () => {
  const src = readFileSync(SRC, 'utf8')
  const body = src.slice(src.indexOf('export function findPresenceExemptions'))
  assert.match(
    body,
    /collectDeclarations\(\s*masked\s*\)/,
    '声明表必须由遮罩面建,且在主判据里真的调用',
  )
  assert.match(
    body,
    /traceIdentifierCondition\(\s*cond\s*,\s*decls\s*\)/,
    '主判据里没有 A 维的调用点 = 这一维等于没有',
  )
  assert.match(
    body,
    /classifyCondition\(\s*cond\s*\)/,
    '中转后的条件必须走同一份 classifyCondition(不得另写判序)',
  )
  assert.doesNotMatch(
    body,
    /classifyCondition\(\s*s\.cond\s*\)/,
    '还拿原始 s.cond 判 = 中转结果被绕过',
  )
  // 同一份遮罩面:A 维绝不许拿原文建表(否则门又把自己解释性的散文判成站点)
  assert.doesNotMatch(src, /collectDeclarations\(\s*text\s*\)/, '声明表不得建在原文面上')
})

test('T14 变异自证:各自摘掉一维 ⇒ 只有那一维读零,既有形态与另一维照旧命中', async () => {
  const variants = [
    {
      label: 'no-trace',
      // A 维整块摘掉(把中转出口改成恒 null,主判据与 B 维一字未动)
      from: '      if (!traced) continue',
      to: '      if (!traced || traced) continue',
      dead: () => A_TEXT,
      alive: () => B_TEXT,
    },
    {
      label: 'no-continue',
      // B 维的放行语句档摘掉,A 维与既有 return 形态一字未动
      from: '|continue(?:\\s+[A-Za-z_$][\\w$]*)?',
      to: '',
      dead: () => B_TEXT,
      alive: () => A_TEXT,
    },
  ]
  for (const v of variants) {
    const dir = mkScratch(`gpe-mut-${v.label}`)
    try {
      const scriptsDir = join(dir, 'scripts')
      mkdirSync(scriptsDir, { recursive: true })
      copyScriptWithClosure(
        join(REPO, 'scripts'),
        'check-gate-presence-exemption.mjs',
        scriptsDir,
        ['lib/code-mask.mjs', 'lib/face-reader.mjs'],
      )
      const src = readFileSync(SRC, 'utf8')
      assert.ok(
        src.includes(v.from),
        `变异锚点在源码里找不到(${v.label}):夹具会静默无效,先修测试再谈结论`,
      )
      const mutated = src.replace(v.from, v.to)
      assert.notEqual(mutated, src, `变异没改动源码(${v.label})—— 这一臂等于没跑,不得据此下结论`)
      const copyPath = join(scriptsDir, 'check-gate-presence-exemption.mjs')
      writeFileSync(copyPath, mutated, 'utf8')
      const mod = await import(pathToFileURL(copyPath).href)
      const M = mod.__test__
      assert.equal(
        M.findPresenceExemptions(v.dead()).hits.length,
        0,
        `${v.label}:摘掉这一维后它仍命中 = 命中的不是这一维`,
      )
      assert.equal(
        M.findPresenceExemptions(v.alive()).hits.length,
        1,
        `${v.label}:另一维被连带摘瞎了 —— 变异范围超出本维,证明无效`,
      )
      assert.equal(
        M.findPresenceExemptions(LEGACY_TEXT).hits.length,
        1,
        `${v.label}:既有形态被连带摘瞎 = 变异臂在证明整门失效,不是这一维`,
      )
    } finally {
      rmScratch(dir)
    }
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
