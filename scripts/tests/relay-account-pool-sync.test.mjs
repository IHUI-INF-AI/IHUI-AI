#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
/**
 * 号池跨环境同步编排器的纯逻辑锁(2026-11-11 立)。
 *
 * 为什么只测这几块:`relay-account-pool-sync.mjs` 的主体是 SSH/tsx 子进程(集成面,
 * 由真实 --dry-run 覆盖),但**解析层**出错的代价极高且极隐蔽 ——
 *   ① extractExport 认错边界 ⇒ 把 dotenv 诊断行当 JSON.parse 输入,整轮快照全废;
 *   ② flattenProviders 丢 providerCode ⇒ 导入器按错平台解析,8 类平台全部"缺凭证";
 *   ③ 参数校验漏一道 ⇒ --push-only/--pull-only 同时给会静默变成单向,或者
 *      --provider 打错字被当成"全平台"把不该推的推出去。
 * 这三类都是纯函数/P0 校验,必须锁死,且必须在**任何 IO 之前**返回。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  __extractExport as extractExport,
  __flattenProviders as flattenProviders,
  __humanAge as humanAge,
  __judgeTaskSnapshot as judgeTaskSnapshot,
  __syncMain as syncMain,
} from '../relay-account-pool-sync.mjs'
import { RELAY_PROVIDER_CODES } from '../lib/pool-providers.mjs'

const BEGIN = '__POOL_EXPORT_BEGIN__'
const END = '__POOL_EXPORT_END__'

/** 临时接管 stdout/stderr,用来断言 P0 校验的提示语。 */
async function capture(run) {
  const out = []
  const err = []
  const origOut = process.stdout.write.bind(process.stdout)
  const origErr = process.stderr.write.bind(process.stderr)
  process.stdout.write = (chunk) => {
    out.push(String(chunk))
    return true
  }
  process.stderr.write = (chunk) => {
    err.push(String(chunk))
    return true
  }
  try {
    const code = await run()
    return { code, stdout: out.join(''), stderr: err.join('') }
  } finally {
    process.stdout.write = origOut
    process.stderr.write = origErr
  }
}

// ① 边界标记之间的 JSON 必须能穿过 dotenv/[db] 噪声被完整取出
test('extractExport: 跳过 dotenv/[db] 诊断行,只取标记之间', () => {
  const payload = { providers: { trae: { accounts: [{ uid: 'u1' }] } }, exportedAt: 't' }
  const raw =
    `◇ injected env (12) from .env\n[db] connected\n` +
    `${BEGIN}\n${JSON.stringify(payload)}\n${END}\n` +
    `[db] closed\n`
  assert.deepEqual(extractExport(raw), payload)
})

// ② 标记缺失时要给可操作的话术(对端 checkout 太旧的唯一特征)
test('extractExport: 无边界标记时报 checkout 旧版,不抛赤裸 JSON 错误', () => {
  assert.throws(
    () => extractExport('{"providers":{}}'),
    /未找到导出边界标记.*--export-all/,
  )
})

// ③ END 在 BEGIN 之前(或只有 END)必须报错,不能切出空串再 JSON.parse 崩
test('extractExport: 标记顺序错乱视为缺失', () => {
  assert.throws(() => extractExport(`${END}\n{}\n${BEGIN}`), /未找到导出边界标记/)
})

// ④ 分桶形状:providerCode 必须从桶名注入 __sync,否则导入器不知道按哪个平台解
test('flattenProviders: providers 分桶摊平并把桶名写进 __sync.providerCode', () => {
  const payload = {
    providers: {
      trae: { accounts: [{ uid: 'a', __sync: { ownerUserId: 'o1' } }] },
      minimax: { accounts: [{ uid: 'b' }] },
    },
  }
  const out = flattenProviders(payload)
  assert.equal(out.length, 2)
  assert.deepEqual(
    out.map((a) => [a.uid, a.__sync.providerCode]),
    [
      ['a', 'trae'],
      ['b', 'minimax'],
    ],
  )
  // 原有 __sync 字段不能被覆盖(ownerUserId 是归属裁决的唯一来源)
  assert.equal(out[0].__sync.ownerUserId, 'o1')
})

// ⑤ 单平台形状(旧 --export <provider>)同样要能吃
test('flattenProviders: 单平台 {providerCode, accounts} 形状兼容', () => {
  const out = flattenProviders({ providerCode: 'raccoon', accounts: [{ uid: 'x' }, { uid: 'y' }] })
  assert.equal(out.length, 2)
  assert.deepEqual(
    out.map((a) => a.__sync.providerCode),
    ['raccoon', 'raccoon'],
  )
})

// ⑥ 空桶/垃圾输入不能炸(否则一次生产异常就让整轮同步不可恢复)
test('flattenProviders: 空值与异常输入返回空数组', () => {
  for (const bad of [null, undefined, {}, { providers: null }, { accounts: [] }, 'x']) {
    assert.deepEqual(flattenProviders(bad), [], `输入 ${JSON.stringify(bad)} 应得空数组`)
  }
})

// ⑦ 不能改动入参(调用方还要拿原始快照做别的判定)
test('flattenProviders: 不修改入参对象', () => {
  const src = { providers: { trae: { accounts: [{ uid: 'a' }] } } }
  const snapshot = JSON.stringify(src)
  flattenProviders(src)
  assert.equal(JSON.stringify(src), snapshot)
})

// ⑧ P0 校验:互斥方向必须 IO 前就拒,不能静默退化成单向
test('参数:--push-only 与 --pull-only 互斥且在任何 IO 前退出 2', async () => {
  const { code, stderr } = await capture(() => syncMain(['--push-only', '--pull-only']))
  assert.equal(code, 2)
  assert.match(stderr, /互斥/)
})

// ⑨ P0 校验:平台名打错要拒绝,绝不能当成"全平台"(那会把不该推的推出去)
test('参数:未知平台被拒并列出可选值', async () => {
  const { code, stderr } = await capture(() => syncMain(['--provider', 'not-a-provider']))
  assert.equal(code, 2)
  assert.match(stderr, /不支持的平台/)
  assert.match(stderr, new RegExp(RELAY_PROVIDER_CODES[0]))
})

// ⑩ 未知参数不能被忽略(拼错的开关静默失效是最难查的一类)
test('参数:未知参数被拒', async () => {
  const { code, stderr } = await capture(() => syncMain(['--aply']))
  assert.equal(code, 2)
  assert.match(stderr, /未知参数: --aply/)
})

// ⑪ 拉回窗口必须是非负数(负数会让所有"仅生产有"都判成已删,新号永远拉不回来)
test('参数:--pull-window-days 拒绝负数与非数字', async () => {
  for (const bad of ['-1', 'abc']) {
    const { code, stderr } = await capture(() => syncMain(['--pull-window-days', bad]))
    assert.equal(code, 2, `--pull-window-days ${bad} 应被拒`)
    assert.match(stderr, /--pull-window-days/)
  }
})

// ⑫ --owners 空值要拒(否则归属判定退化成"全库",可能把他人的号拉进开发机)
test('参数:--owners 空值被拒', async () => {
  const { code, stderr } = await capture(() => syncMain(['--owners', ' , ']))
  assert.equal(code, 2)
  assert.match(stderr, /--owners/)
})

// ⑬ 健康自检入口必须在帮助里露出来(否则换机器时没人知道有这条命令)
test('帮助:--help 同时列出 --status 与 --log', async () => {
  const { code, stdout } = await capture(() => syncMain(['--help']))
  assert.equal(code, 0)
  assert.match(stdout, /--status/)
  assert.match(stdout, /--log/)
})

// ⑭ humanAge:未知时间不许渲染成 "NaN 分钟前"
test('humanAge: 非法输入回落为"未知",不产生 NaN 文案', () => {
  assert.equal(humanAge(NaN), '未知')
  assert.equal(humanAge(-1), '未知')
  assert.equal(humanAge(30_000), '30 秒前')
  assert.equal(humanAge(90_000), '1 分钟前')
  assert.equal(humanAge(3 * 3600_000), '3 小时前')
  assert.equal(humanAge(2 * 86400_000), '2 天前')
})

// ─────────── 计划任务快照判据(健康自检的核心,静默失效的唯一出口) ───────────

const STABLE_NODE = 'C:\\Program Files\\nodejs\\node.exe'
const VERSIONED_NODE = 'C:\\Users\\Administrator\\.workbuddy\\binaries\\node\\versions\\22.22.2-6\\node.exe'
const REPO = 'G:\\IHUI-AI'
const SYNC_ARG = `"${REPO}\\scripts\\relay-account-pool-sync.mjs" --if-dirty --apply --quiet`

/** 造一份 Get-ScheduledTask 的输出文本。 */
function snap(over = {}) {
  const v = {
    state: 'Ready',
    lastRun: '11/12/2026 00:49:36',
    lastResult: '0x0',
    exec: STABLE_NODE,
    workdir: REPO,
    args: SYNC_ARG,
    ...over,
  }
  return (
    `STATE=${v.state}\nLASTRUN=${v.lastRun}\nLASTRESULT=${v.lastResult}\n` +
    `EXEC=${v.exec}\nWORKDIR=${v.workdir}\nARGS=${v.args}`
  )
}
/** 存在性替身:默认全在;传 missing 里的路径视为不存在。 */
const existsExcept = (...missing) => (p) => !missing.some((m) => p === m)
const levels = (rows) => rows.map((r) => r.level)
const joined = (rows) => rows.map((r) => r.text).join('\n')

// ⑮ 未注册:必须点名"自动同步等于没开"并给出注册命令(否则没人知道该做什么)
test('judgeTask: 任务不存在 ⇒ 一条 warn,且带 --register 出路', () => {
  const rows = judgeTaskSnapshot({ taskCode: 1, taskOut: 'No MSFT_ScheduledTask objects found' })
  assert.deepEqual(levels(rows), ['warn'])
  assert.match(joined(rows), /未注册/)
  assert.match(joined(rows), /--register/)
})

// ⑯ 健康态:ok + 一条 info(执行体来源),info 不得把稳定路径说成"版本目录"
test('judgeTask: Ready+0x0+路径齐全 ⇒ 无 warn,稳定 node 不提示版本目录', () => {
  const rows = judgeTaskSnapshot({ taskCode: 0, taskOut: snap(), exists: existsExcept() })
  assert.deepEqual(levels(rows), ['ok', 'info'])
  assert.match(joined(rows), /relay-account-pool-sync|IHUI-Pool-Sync/)
  assert.doesNotMatch(joined(rows), /版本目录/)
})

// ⑰ **误报回归锁**:Running + 0x41301 是 Windows 的 SCHED_S_TASK_RUNNING,不是失败。
//    立此锁的现场:自检初版只判 `!=0x0`,恰好在跑时误报"这轮同步失败"——假红会让人开始忽略自检。
test('judgeTask: Running + 0x41301 判为"正在运行",不得报失败', () => {
  const rows = judgeTaskSnapshot({
    taskCode: 0,
    taskOut: snap({ state: 'Running', lastResult: '0x41301' }),
    exists: existsExcept(),
  })
  assert.ok(!levels(rows).includes('warn'), `不该有 warn: ${joined(rows)}`)
  assert.match(joined(rows), /正在运行/)
})

// ⑱ 真的失败码(0x1)必须红,不能因为 State=Ready 就放过
test('judgeTask: 结果 0x1 ⇒ warn 且提示看日志', () => {
  const rows = judgeTaskSnapshot({ taskCode: 0, taskOut: snap({ lastResult: '0x1' }), exists: existsExcept() })
  assert.deepEqual(levels(rows), ['warn', 'info'])
  assert.match(joined(rows), /非 0 = 这轮同步失败/)
})

// ⑲ 定时炸弹本体:注册时的 node 绝对路径被清理 ⇒ 必须红,并指向重跑 --register
test('judgeTask: 执行体路径不存在 ⇒ warn 指认 node 升级并给 --register 出路', () => {
  const rows = judgeTaskSnapshot({
    taskCode: 0,
    taskOut: snap({ exec: VERSIONED_NODE }),
    exists: existsExcept(VERSIONED_NODE),
  })
  assert.deepEqual(levels(rows), ['ok', 'warn'])
  assert.match(joined(rows), /执行体已失效/)
  assert.match(joined(rows), /--register/)
})

// ⑳ 工作目录 / 同步脚本被移动 ⇒ 各自点名(不能合并成一句"环境异常")
test('judgeTask: 工作目录与脚本路径缺失分别点名', () => {
  const rows = judgeTaskSnapshot({
    taskCode: 0,
    taskOut: snap(),
    exists: existsExcept(REPO, `${REPO}\\scripts\\relay-account-pool-sync.mjs`),
  })
  const text = joined(rows)
  assert.match(text, /工作目录不存在/)
  assert.match(text, /同步脚本不存在/)
})

// ㉑ 仍在用版本目录 node 但路径还有效 ⇒ 只提示不判红(能工作就不该报故障)
test('judgeTask: 版本目录 node 仍存在 ⇒ info 提示升级后需重跑,不判红', () => {
  const rows = judgeTaskSnapshot({
    taskCode: 0,
    taskOut: snap({ exec: VERSIONED_NODE }),
    exists: existsExcept(),
  })
  assert.deepEqual(levels(rows), ['ok', 'info'])
  assert.match(joined(rows), /版本目录/)
})
