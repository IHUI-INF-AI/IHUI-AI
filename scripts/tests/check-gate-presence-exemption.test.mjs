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
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SRC = join(REPO, 'scripts', 'check-gate-presence-exemption.mjs')
const SRC_REL = 'scripts/check-gate-presence-exemption.mjs'

const GATE = await import(pathToFileURL(SRC).href)
const T = GATE.__test__

/** git 派生不得依赖 PATH(§5b:服务账户与交互终端的 PATH 不通)—— 绝对路径由 face-reader 的出口给。 */
const GIT_BIN = await import(pathToFileURL(join(REPO, 'scripts', 'lib', 'gitdir.mjs')).href).then((m) => m.resolveGitBin() || 'git')

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
  assert.ok(e, 'check-gate-presence-exemption.mjs 不在 HEAD 的 runner 注册表里 —— 门存在而无人调度 = 没有')
  assert.match(e.block, /mode:\s*'blocking'/, '本门必须 blocking(存量有 HEAD 棘轮兜住,不会恒红)')
  assert.match(e.block, /skipEnv:\s*'HUSKY_SKIP_GATE_PRESENCE_EXEMPTION'/, '缺 skipEnv 就没有应急出口')
  assert.match(e.block, /stagedTriggers:[^\n]*apps\//, '缺 stagedTriggers 会让本门在提交链上根本不唤起')
  assert.doesNotMatch(e.id, /id: "/, '注册 id 必须是单引号形态(双引号 id 对按单引号解析的判据隐身 —— gate-registry-insert 头注 ①)')
})

test('T2 摘线不得被读成已装车:把 script 行改掉后,同一提取函数必须返回 null', () => {
  const runner = runGit(['show', 'HEAD:scripts/guardian-runner.mjs'])
  const stripped = runner.replace(`script: 'check-gate-presence-exemption.mjs',`, `script: 'check-somebody-elses-gate.mjs',`)
  assert.equal(extractEntry(stripped, 'check-gate-presence-exemption.mjs'), null,
    '摘掉 script 行后仍被判定"已装车" —— 说明 T1 的锚点根本不看 script 行')
})

test('T3 遮罩实现只能有一份:本门必须 import lib,不得留本地分词器', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.match(src, /from '\.\/lib\/code-mask\.mjs'/, '本门没引共用遮罩 —— 第二份实现必漂移(§3 共享层优先)')
  assert.ok(
    !/function\s+(maskComments|scanSpans|blankStrings)[\w]*\s*\(/.test(src),
    '本门里不得再定义遮罩函数(守门 135 镜像 T7 同一条锁)',
  )
})

test('T4 取材面形状锁:默认档必须判 HEAD,内容必须经 face-reader 的读取入口', async () => {
  const src = readFileSync(SRC, 'utf8')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '本门必须走 face-reader(守门 118 判"半接线"那一型)')
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

test('T5 真仓 HEAD 端到端:判据必须看得见存量命中与修复后的正确形态(看不见 = 对该型全盲)', () => {
  const out = runNode([SRC, '--json'])
  const j = JSON.parse(out)
  assert.ok(j.scannedFiles > 100, `扫描面异常小(${j.scannedFiles})—— 枚举或覆盖面过滤坏了`)
  assert.ok(
    j.hitSites.some((h) => h.file === 'apps/api/src/plugins/csrf.ts' && h.text.includes('x-goog-api-key')),
    '真仓 HEAD 的已知存量命中(csrf.ts 的 x-goog-api-key)必须被点名 —— 看不见它就不是"清完了",是瞎了',
  )
  assert.ok(
    j.passed >= 1 && !j.hitSites.some((h) => h.text.includes('isVerifiedInternalMachineCall')),
    '#23 修复后的正确形态(验过才免)必须落 passed,不得落 hits',
  )
  assert.ok(!j.hitSites.some((h) => h.text.includes('x-internal-service-token')),
    '注释里逐字引用的旧写法不得被当成站点(判据面先剥注释的正向证明)')
  assert.equal(j.emptyScan, false, '空扫不得记绿')
  assert.notEqual(j.exit, 1, 'HEAD 全量档不得因存量判红(锚点=该文件自身;判红=恒红门,§12e)')
})

test('T6 阳性对照用纯函数证明:历史 blob 必红、修复后同文件该站必不红', () => {
  const old = T.readHistoricalCsrf()
  assert.equal(typeof old, 'string', '修复前那版 csrf.ts 取不到 ⇒ 本门的存在理由不可复核(判失败,不静默)')
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
  assert.ok(rFixed.passed.some((p) => p.text.includes('isVerifiedInternalMachineCall')),
    '替换成"验过才免"后必须落 passed —— 反向对照若也绿,说明判据两边都不认,尺子是坏的')
})

test('T7 棘轮的锚点必须是"该文件 HEAD 自身存量",不得是 0 或手工清单', () => {
  // 构造面:同一判据对 HEAD 的 csrf.ts 现读 1 处存量命中 ⇒ 锚点为 1;
  // 若门把锚点写死 0,文档类提交之外的任何 csrf 改动都会被误判"新增"。
  const out = runNode([SRC, '--json'])
  const j = JSON.parse(out)
  const csrfHits = j.hitSites.filter((h) => h.file === 'apps/api/src/plugins/csrf.ts').length
  assert.equal(csrfHits, 1, `csrf.ts 的 HEAD 存量应恰为 1(x-goog-api-key),实得 ${csrfHits} —— 锚点面已漂,先重读再派单`)
  // strict 档语义(问责入口):有命中即 1;这不是恒红门,因为它不挂在提交链的默认档上
  try {
    runNode([SRC, '--strict'])
    assert.fail('strict 档对 HEAD 存量命中应当判红(拒绝出合格证),却 exit 0')
  } catch (e) {
    if (e.code === 'ERR_ASSERTION') throw e
    assert.ok([1, 2].includes(e.status), `strict 档退出码应为 1(命中)或 2(有判不出),实得 ${e.status}`)
  }
})

test('T8 暂存档"无射程内文件 ⇒ 回退全量"只在一种情形成立,不得被顺手改成无条件回退', () => {
  // 只用纯函数 + 构造面(端到端那一例取决于共享索引此刻有什么 —— 守门 103 T12 那一课)。
  assert.equal(T.shouldRetreatToHead({ face: 'staged', hasOnlyFiles: false, stagedInScopeCount: 0 }), true)
  assert.equal(T.shouldRetreatToHead({ face: 'staged', hasOnlyFiles: false, stagedInScopeCount: 1 }), false)
  assert.equal(T.shouldRetreatToHead({ face: 'staged', hasOnlyFiles: true, stagedInScopeCount: 0 }), false)
  assert.equal(T.shouldRetreatToHead({ face: 'head', hasOnlyFiles: false, stagedInScopeCount: -1 }), false)
})

test('T9 判据必须覆盖门自己产出的形态:豁免标记行不被注释遮掉,也不得被当成静默通过', () => {
  const withExempt = "server.addHook('onRequest', async (request) => {\n  if (request.headers['x-a']) return // presence-exempt: 机器投递,签名验签在路由层\n})"
  const r = T.findPresenceExemptions(withExempt)
  assert.equal(r.hits.length, 0, '带原因的豁免必须放行')
  assert.equal(r.exempted.length, 1, '豁免要计数,不得静默 —— "报了数"与"看不见"在账面上必须不同形')
  const bare = "server.addHook('onRequest', async (request) => {\n  if (request.headers['x-a']) return // presence-exempt:\n})"
  assert.equal(T.findPresenceExemptions(bare).hits.length, 1, '裸标记(无原因)不得放行(守门 102 同锁)')
})

test('T10 --self-test 端到端 exit 0(判据自身可取证)', () => {
  const out = runNode([SRC, '--self-test'])
  assert.match(out, /--self-test: 全部通过/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
