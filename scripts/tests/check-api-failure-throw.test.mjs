// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 135(check-api-failure-throw.mjs)的 §22c 镜像测试。
//
// 为什么每例都存在:本门守的是"错误身份在到达 UI 前被丢掉"这一型 —— 它没有任何编译期症状
// (typecheck/lint/测试全绿),表现是用户看到一句指向错误方向的中文。而门自身有三种"看起来
// 正常其实失明"的方式:注册块被摘线、具名出口被删掉(判据没有出路)、遮罩实现被复制成第二份
// (两处算同一件事必漂移)。这三种都只会表现为"一路报绿",所以必须用源码锁钉住。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const RUNNER = join(REPO, 'scripts', 'guardian-runner.mjs')
const SRC = join(REPO, 'scripts', 'check-api-failure-throw.mjs')
const EXPIRY = join(REPO, 'scripts', 'check-exemption-expiry.mjs')
const MASK_LIB = join(REPO, 'scripts', 'lib', 'code-mask.mjs')

function runNode(args, timeout = 600000) {
  return execFileSync(process.execPath, args, {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    windowsHide: true,
    timeout,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

test('T1 装车证明:runner 里必须有 id 135,且 blocking + skipEnv + stagedTriggers 齐备', () => {
  const src = readFileSync(RUNNER, 'utf8')
  const at = src.indexOf("id: '135'")
  assert.ok(at >= 0, '守门 135 不在 runner 里 —— 门存在但没人调度 = 没有(§22c 反复记过)')
  const block = src.slice(at, at + 3000)
  assert.ok(block.includes("script: 'check-api-failure-throw.mjs'"), 'id 135 指向的不是本门')
  assert.match(block, /mode:\s*'blocking'/, '本门必须是 blocking(存量有棘轮兜住,不会恒红)')
  assert.match(block, /skipEnv:\s*'HUSKY_SKIP_API_FAILURE_THROW'/, '缺 skipEnv 就没有应急出口')
  assert.match(block, /stagedTriggers:[^\n]*'apps\/'/, '缺 stagedTriggers 会让本门在提交链上根本不唤起')
})

test('T2 反向对照:runner 里没有本门时,T1 那种"已装车"结论不得成立', () => {
  // 摘线是"造好没装车"的常见终态;把注册块删掉后 T1 的判据必须翻红,而不是"找不到就当通过"
  const src = readFileSync(RUNNER, 'utf8')
  const stripped = src.replace(/id: '135',/g, "id: '___',")
  const hasIt = stripped.includes("script: 'check-api-failure-throw.mjs'") && stripped.includes("id: '135'")
  assert.ok(!hasIt, '把 id 改掉之后仍被判定为"已装车" —— 说明 T1 的锚点根本不看 id')
})

test('T3 豁免族必须登记进守门 108 的存活期表(否则豁免只有出生没有死亡)', () => {
  const src = readFileSync(EXPIRY, 'utf8')
  assert.match(src, /'api-error-exempt':\s*\d+/, 'api-error-exempt 未挂到期档')
})

test('T4 取材面形状锁:内容必须经 face-reader 的层读,不得回磁盘直读', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '本门必须走 face-reader(全量判 HEAD blob)')
  assert.match(src, /catBatch\(/, '没调用层的读取入口 = 半接线(守门 118 那一型)')
  assert.ok(
    !/readFileSync\(\s*join\(\s*ROOT/.test(src),
    '不得用 ROOT 拼磁盘路径读被审内容(共享工作树滞后 HEAD 时会换结论)',
  )
})

// 全量面只跑一次(20s 级),两条测试共用同一张结论面 —— 变异自证不许再扫一遍树。
let cachedHeadJson
function headJson() {
  if (!cachedHeadJson) cachedHeadJson = JSON.parse(runNode([SRC, '--json']))
  return cachedHeadJson
}

/**
 * 计数维形态锁(2026-10-27 改判,假牙清偿)。
 *
 * 门体原话把 `total` 定为**只报数**维:`scripts/check-api-failure-throw.mjs:17` ——
 * "棘轮锚点 = **该文件在 HEAD 自身的存量数**(与 77/83/98/102/131 同族):立项实测存量 212 处,
 * 当场判红就是一台与任何提交都无关的恒红门"。旧断言 `total > 300` 把一次性读数(212)钉成
 * 下限:存量被合法清干净那天本测试就假红,而测试假红在共享树里等于挡住所有会话落地
 * (§12e 同型,只是从门面挪到了测试面)。现在钉形态、不钉数值:
 *  · 结论面(JSON)四字段齐备,数值维逐枚可解析(行在而字段缺/形态坏 ⇒ 这一维没上岗);
 *  · 扫描面 `scannedFiles` > 1000 —— 真判据(采集口径塌了,那句"存量 0"不作数,§0.3);
 *  · `emptyScan === false` —— 真判据(空扫不得记绿);
 *  · `exit !== 1` —— 真判据(HEAD 全量档不得因存量判红);
 *  · `total` 的**数值**只报数(可解析的非负数即可,不挂下限;变异自证见 T5b)。
 */
function assertApiThrowCounts(j) {
  for (const k of ['scannedFiles', 'total', 'emptyScan', 'exit'])
    assert.ok(k in j, `--json 缺字段「${k}」⇒ 这一维没上岗:${JSON.stringify(j).slice(0, 300)}`)
  for (const k of ['scannedFiles', 'total', 'exit'])
    assert.equal(typeof j[k], 'number', `结论行字段「${k}」必须是数字(实得 ${typeof j[k]})⇒ 形状坏了`)
  assert.ok(
    Number.isFinite(j.scannedFiles) && j.scannedFiles > 1000,
    `扫描面异常小(${j.scannedFiles})—— 枚举或过滤坏了,上面那句"存量 N"不作数`,
  )
  assert.ok(
    Number.isFinite(j.total) && j.total >= 0,
    `total 必须是可解析的非负数(数值本身只报数,不是判据;实得 ${JSON.stringify(j.total)})`,
  )
  assert.equal(j.emptyScan, false, '空扫不得记绿')
  assert.notEqual(j.exit, 1, 'HEAD 全量档不得因存量判红(锚点=该文件自身,否则是恒红门)')
  return { scannedFiles: j.scannedFiles, total: j.total }
}

test('T5 全量面计数行:四字段齐备可解析 / 扫描面 > 1000 / total 数值只报数(2026-10-27 改判)', () => {
  // 现读报数留痕(只报数,不挂下限):total 归零不得让本测试翻红 —— 由 T5b 变异②机器自证
  console.log('   api-failure-throw 计数现读:', JSON.stringify(assertApiThrowCounts(headJson())))
})

/**
 * 变异自证(2026-10-27,改判的承重证明):牙必须长在"形态"上,不能靠一次性读数。
 * 都在**同一次**真仓结论面上做变异,零额外全量扫描:
 *  变异①:摘掉只报数维字段(total)⇒ 必须抛(缺维=没上岗有牙);
 *  变异①b:摘掉真判据载体(scannedFiles)⇒ 必须抛;
 *  变异①c:字段形态坏(number → string)⇒ 必须抛;
 *  变异②:total 读数改成 0 ⇒ **必须不抛**(它不是判据 —— 旧的 `> 300` 下限正是这里会假红的牙);
 *  变异③:扫描面改成 0 ⇒ 必须抛(与①成对:证明牙长在真判据上,不是"什么都不判")。
 */
test('T5b 计数维断言变异自证:摘字段/坏形态必翻红 / total 归零必不红', () => {
  const j = headJson()
  assert.doesNotThrow(() => assertApiThrowCounts(j), '基准面:真报告必须先过(否则下面全是空转)')
  const noTotal = { ...j }
  delete noTotal.total
  assert.ok(!('total' in noTotal), '夹具失效:没摘到 total 字段')
  assert.throws(() => assertApiThrowCounts(noTotal), /缺字段「total」/, '摘掉只报数维字段必须翻红')
  const noScan = { ...j }
  delete noScan.scannedFiles
  assert.throws(() => assertApiThrowCounts(noScan), /缺字段「scannedFiles」/, '摘掉扫描面字段必须翻红')
  assert.throws(() => assertApiThrowCounts({ ...j, total: String(j.total) }), /必须是数字/, '字段形态坏必须有牙')
  assert.doesNotThrow(
    () => assertApiThrowCounts({ ...j, total: 0 }),
    'total=0 是门体明写的"只报数"常态 ⇒ 断言不得为此翻红(假红=挡全仓落地)',
  )
  assert.throws(() => assertApiThrowCounts({ ...j, scannedFiles: 0 }), /扫描面异常小/, '扫描面 0 ⇒ 采集塌了,必须翻红')
})

test('T6 具名出口被摘线时,本门必须判"没有出路"(纯函数 + 构造面,不用源码正则比形状)', async () => {
  const { __test__ } = await import('../check-api-failure-throw.mjs')
  const { detectHelper } = __test__
  // 三条构造输入把三态各自钉住 —— 这正是"判定行为"而非"代码里有没有某串字"
  assert.equal(detectHelper('export function apiFailureToError(res) { return new Error(res.error) }'), 'ok')
  assert.equal(detectHelper('function apiFailureToError(res) { return new Error(res.error) }'), 'missing',
    '没 export 的出口等于不存在(门有判据、调用方拿不到 = 无出路)')
  assert.equal(detectHelper('export function someOtherName() {}'), 'missing')
  assert.equal(detectHelper(null), 'undetermined', '取不到内容不得判"缺失"也不得判"在"—— 必须是未判定')
  // 真仓的出口确实存在(否则本门今天就没有出路)
  const helper = readFileSync(join(REPO, 'packages/shared/src/utils/error-messages.ts'), 'utf8')
  assert.equal(detectHelper(helper), 'ok', 'apiFailureToError 不在 shared 里')
})

test('T7 遮罩实现只能有一份:本门与守门 131 都必须 import lib,不得各写一份', () => {
  const lib = readFileSync(MASK_LIB, 'utf8')
  assert.match(lib, /export function maskCommentsAndStrings\b/, '共用 lib 不见了')
  for (const [name, file] of [
    ['135', SRC],
    ['131', join(REPO, 'scripts', 'check-rn-interop-fn-style.mjs')],
  ]) {
    const src = readFileSync(file, 'utf8')
    assert.ok(
      /from '\.\/lib\/code-mask\.mjs'/.test(src),
      `守门 ${name} 没引共用遮罩 —— 第二份实现必漂移(§3 共享层优先)`,
    )
    assert.ok(
      !/function maskCommentsAndStrings\(/.test(src),
      `守门 ${name} 里还留着本地遮罩实现(应删掉,只 import)`,
    )
  }
})

test('T8 --self-test 端到端 exit 0(判据自身可取证)', () => {
  const out = runNode([join(REPO, 'scripts', 'check-api-failure-throw.mjs'), '--self-test'])
  assert.match(out, /--self-test: 全部通过/)
})

test('T9 暂存档的"回退全量"只在无射程内文件时发生 —— 不得被顺手改成无条件回退', async () => {
  // 只用纯函数 + 构造面证明:端到端那一例取决于**共享索引此刻有什么**,而并发会话随时在 stage .ts
  // —— 拿它做断言就是在拿仓库瞬时状态当尺子(守门 103 的 T12 同课)。
  const { shouldRetreatToHead } = await import(pathToFileURL(SRC).href)
  assert.equal(
    shouldRetreatToHead({ face: 'staged', hasOnlyFiles: false, stagedInScopeCount: 0 }),
    true,
    '无关提交(暂存集里没有 .ts)必须回退,否则本门替每一次文档提交挡路',
  )
  // 三条"绝不该回退":有射程内文件 / 显式 --files / 本来就是全量档。
  // 少锁任何一条,把判据改成"无条件回退"都能让本门在暂存档永久失明而账面一片绿。
  assert.equal(
    shouldRetreatToHead({ face: 'staged', hasOnlyFiles: false, stagedInScopeCount: 1 }),
    false,
    '暂存集里有射程内文件时回退 = 把本次改动放过去',
  )
  assert.equal(
    shouldRetreatToHead({ face: 'staged', hasOnlyFiles: true, stagedInScopeCount: 0 }),
    false,
    '显式 --files 指定了面 yet 被改判成 HEAD,自检与人工定位就都不成立',
  )
  assert.equal(
    shouldRetreatToHead({ face: 'head', hasOnlyFiles: false, stagedInScopeCount: -1 }),
    false,
    '全量档的 0 候选仍是判死,不得"回退"到自己身上冒充判过',
  )
  const src = readFileSync(SRC, 'utf8')
  assert.match(src, /retreatReason/, '回退必须留可读证据(报告行),不得静默换面')
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
