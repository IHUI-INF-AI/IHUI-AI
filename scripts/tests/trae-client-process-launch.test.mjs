// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * launchProduct 三通道兜底的镜像测试(2026-10-28 立)。
 *
 * 立因是当天现读:Loomy 在"由脚本/服务派生"的语境下,直接 spawn 与 run-as-user 两条通道
 * 都会让它在 Electron 主进程启动前就退出码 0 消失(连自己第一行日志都不写),而 notepad
 * 走同两条通道能活着 —— 差别在"要不要 shell 语义的启动"。人双击能开,就是这条通道的证据。
 * 于是拉起改成:发起 → **验进程活着** → 不行再交给 explorer → 再验一次。
 *
 * 判据一律 import 源模块的 `__test__`(§22c:测试里不复制第二份判据);
 * 子进程调用与 pid 探测都由夹具注入,绝不真起任何 GUI 程序。
 * 跑法:node --test scripts/tests/trae-client-process-launch.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as T } from '../lib/trae-client-process.mjs'

// ROOT 由测试自身位置推导(§15:共享工作区 cwd 不可靠)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const HELPER = path.join(ROOT, 'apps/api/scripts/run-as-user.ps1')
const SERVICE_ENV = {
  USERNAME: 'SYSTEM',
  USERPROFILE: 'C:\\Windows\\System32\\config\\systemprofile',
}

/** 造一个"存在"的 exe 路径(用真在盘上的文件冒充,只为过 existsSync 那道闸) */
const FAKE_EXE = fs.realpathSync(process.execPath)

/**
 * outcomes[i] = 第 i 次"发起"之后 pid 面反复采到的结果([] 没起来 / [pid] 起来了 / null 读不回)。
 * 按发起次数取,不是按采样次数 —— 验证是**窗口内反复采样**,一次发起会采好几把。
 */
function harness(outcomes, opts = {}) {
  const calls = []
  let attempt = -1
  const r = T.launchProduct(FAKE_EXE, {
    env: SERVICE_ENV,
    helperPath: HELPER,
    product: 'Loomy',
    verifyWaitMs: 1,
    run: (cmd, args) => {
      attempt += 1
      calls.push({ cmd: path.basename(String(cmd)), args })
      if (opts.throwOn && calls.length === opts.throwOn) throw new Error('夹具注入的发起失败')
      return ''
    },
    probe: () => (outcomes[attempt] === undefined ? [] : outcomes[attempt]),
  })
  return { r, calls }
}

test('L1 服务身份 + helper 起成功:只走第一条通道,不去碰 explorer', () => {
  const { r, calls } = harness([[4321]])
  assert.equal(r.launched, true, JSON.stringify(r))
  assert.equal(r.via, 'helper', JSON.stringify(r))
  assert.equal(calls.length, 1, `不该有第二次发起,实得 ${JSON.stringify(calls.map((c) => c.cmd))}`)
  assert.ok(!/explorer/i.test(calls[0].cmd), `第一条通道不该是 shell,实得 ${calls[0].cmd}`)
  assert.ok(calls[0].args.includes(HELPER), '必须把 run-as-user 助手传给解释器')
})

test('L2 第一条发起了但量不到进程 ⇒ 交给 shell(explorer),第二次验到进程才算活', () => {
  const { r, calls } = harness([[], [777]])
  assert.equal(r.launched, true, JSON.stringify(r))
  assert.equal(r.via, 'shell', JSON.stringify(r))
  assert.equal(calls.length, 2)
  assert.equal(calls[1].cmd.toLowerCase(), 'explorer.exe', '第二条通道必须是 shell 语义')
  assert.deepEqual(calls[1].args, [FAKE_EXE], 'shell 通道传的就是那个 exe')
})

test('L3 两条通道都量不到进程 ⇒ 判失败,并把两段原因都带回来(不冒"已重开")', () => {
  const { r, calls } = harness([[], []])
  assert.equal(r.launched, false, JSON.stringify(r))
  assert.equal(r.via, 'primary+shell', JSON.stringify(r))
  assert.equal(calls.length, 2)
  assert.match(r.error, /没检测到客户端进程/)
})

test('L4 探测取不到(null ⇒ 未判定)⇒ 放行且不再走 explorer:没量到 ≠ 没起来(§0.3)', () => {
  const { r, calls } = harness([null])
  assert.equal(r.launched, true, JSON.stringify(r))
  assert.equal(r.via, 'helper', JSON.stringify(r))
  assert.equal(calls.length, 1, `未判定不该被读成失败去试第二条通道,实得 ${calls.length} 次`)
})

test('L5 shell 通道自身发起失败 ⇒ 判失败并点名是 shell 那一档(不把责任糊到第一条)', () => {
  const { r } = harness([[], []], { throwOn: 2 })
  assert.equal(r.launched, false, JSON.stringify(r))
  assert.match(r.error, /shell 通道发起失败/)
})

test('L6 exe 路径拿不到 ⇒ 直接判失败,一次发起都不做', () => {
  const calls = []
  const r = T.launchProduct('', {
    env: SERVICE_ENV,
    helperPath: HELPER,
    product: 'Loomy',
    run: () => calls.push(1),
    probe: () => [],
  })
  assert.equal(r.launched, false)
  assert.equal(r.via, '')
  assert.equal(calls.length, 0)
})

test('L7 主通道抛错(助手权限不足/脚本自身坏)⇒ 仍要落到 shell 通道:旧写法在这里直接放弃', () => {
  const { r, calls } = harness([[], [777]], { throwOn: 1 })
  assert.equal(r.launched, true, JSON.stringify(r))
  assert.equal(r.via, 'shell', JSON.stringify(r))
  assert.equal(calls.length, 2, `主通道抛错后必须还有第二条通道,实得 ${calls.length} 次发起`)
  assert.equal(calls[1].cmd.toLowerCase(), 'explorer.exe')
})

test('L8 主通道抛错但进程已量到 ⇒ 按成功算,且绝不重复起第二个实例', () => {
  const { r, calls } = harness([[999]], { throwOn: 1 })
  assert.equal(r.launched, true, JSON.stringify(r))
  assert.equal(r.via, 'helper', JSON.stringify(r))
  assert.equal(calls.length, 1, `包装器报错而子进程已起,再去 explorer 等于给用户多开一个,实得 ${calls.length} 次`)
})

test('L9 没产品名可验时主通道抛错 ⇒ 如实判失败(不得把"没验"写成"起好了")', () => {
  const calls = []
  const r = T.launchProduct(FAKE_EXE, {
    env: SERVICE_ENV,
    helperPath: HELPER,
    product: '',
    run: (cmd, _args) => {
      calls.push(path.basename(String(cmd)))
      throw new Error('助手权限不足')
    },
  })
  assert.equal(r.launched, false, JSON.stringify(r))
  assert.match(r.error, /主通道\(helper\)发起失败/)
  assert.equal(calls.length, 1, '无法验证时 shell 也起不了"不知道有没有起来"的东西,只发起一次')
})

test('L10 窗口内反复采样:第 3 次才量到进程也算起来(单次采样会把"起得慢"读成"没起来")', () => {
  const calls = []
  let samples = 0
  const r = T.launchProduct(FAKE_EXE, {
    env: SERVICE_ENV,
    helperPath: HELPER,
    product: 'Loomy',
    verifyWaitMs: 1500,
    run: (cmd) => {
      calls.push(path.basename(String(cmd)))
      return ''
    },
    probe: () => {
      samples += 1
      return samples >= 3 ? [55] : []
    },
  })
  assert.ok(samples >= 3, `验证必须采样到第 3 次才算数,实得 ${samples} 次`)
  assert.equal(r.launched, true, JSON.stringify(r))
  assert.equal(r.via, 'helper', JSON.stringify(r))
  assert.equal(calls.length, 1, `量到进程后不该再发起第二条通道(那等于多开一个实例),实得 ${JSON.stringify(calls)}`)
})

test('L11 全程读不回(null)⇒ 放行且不试第二条;一次都没量到才判失败', () => {
  const nullCase = harness([null])
  assert.equal(nullCase.r.launched, true, JSON.stringify(nullCase.r))
  assert.equal(nullCase.calls.length, 1)
  const emptyCase = harness([[]])
  assert.equal(emptyCase.r.launched, false, JSON.stringify(emptyCase.r))
  assert.equal(emptyCase.calls.length, 2, '确定"没量到"才允许换通道')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
