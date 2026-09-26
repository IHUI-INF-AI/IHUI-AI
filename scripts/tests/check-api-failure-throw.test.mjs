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
import { fileURLToPath } from 'node:url'
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

test('T5 真仓阳性对照:全量面必须看得见存量(看不见 = 判据对该形态全盲,不是"已清完")', () => {
  const out = runNode([join(REPO, 'scripts', 'check-api-failure-throw.mjs'), '--json'])
  const j = JSON.parse(out)
  assert.ok(j.scannedFiles > 1000, `扫描面异常小(${j.scannedFiles})—— 枚举或过滤坏了`)
  assert.ok(j.total > 300, `真仓 HEAD 看不见已知存量(实得 ${j.total})⇒ 判据失明`)
  assert.equal(j.emptyScan, false, '空扫不得记绿')
  assert.notEqual(j.exit, 1, 'HEAD 全量档不得因存量判红(锚点=该文件自身,否则是恒红门)')
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
