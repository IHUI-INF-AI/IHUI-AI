// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 成长任务「服务端已判完成 → 一键领奖」(2026-11-05 立)。
 *
 * ## 为什么缺这一条腿
 *
 * 「专家体验」类任务的动作是驱动真客户端做的(见 `workbuddy-growth-experts.mjs`),
 * 做完后服务端把 `accept_status` 判成 `completed` —— 但**奖励还停在原地等按钮**。
 * 实测 2026-11-05:号池两个号 36 项里,`completed`(可领未领)攒了 **6 项**没人领,
 * 而这一格是纯 API 动作,零人工:`POST /v2/activity/growth/tasks/{code}/claim`
 * 就是官方客户端「领取奖励」按钮自己那条端点。
 *
 * ## 边界(它不干什么)
 *
 *   · **只领 `completed`**。`accepted` = 行为还没做 ⇒ 不碰;`claimed` = 已到账 ⇒ 不重领
 *     (§0.3:把 `accepted` 当可领会变成"向服务端要一份没挣到的奖励")。
 *   · **不代做任何行为**。行为要么已经真做过,要么这一项就留给 `--do-all` / 机主。
 *   · **受理 ≠ 到账**:HTTP 200 不等于领到了,以响应体 `code` 为准(判据 import
 *     `workbuddy-growth-oauth.mjs` 的 `parseClaimResponse`,本层零复算,§0.6)。
 *
 * ## 用法
 *
 *   node scripts/workbuddy-growth-claim.mjs --dry-run        # 只报有哪几项可领,不动服务端
 *   node scripts/workbuddy-growth-claim.mjs                  # 把可领的全领了
 *   node scripts/workbuddy-growth-claim.mjs --code chat_5    # 只领这一项
 *
 * 退出码:0 没有失败 / 1 有领奖失败 / 2 未判定(取不到号池·凭据·任务列表)。
 */
import {
  fetchGrowthTasks,
  listPoolAccounts,
  readPoolCredential,
} from './workbuddy-growth-experts.mjs'
import { claimTask } from './workbuddy-growth-oauth.mjs'
import { isDirectRun } from './lib/direct-run.mjs'

/**
 * 从任务列表挑出「服务端已判完成、奖励还没领」的项(纯函数,离线可测)。
 *
 * 只认 `completed` 这一个词。`accepted` / `in_progress` / `not_accepted` 都不算可领;
 * `claimed` 是终态,重领会拿服务端报错当噪音。
 *
 * @param {unknown} tasks 成长任务列表
 * @returns {Array<{task_code:string,title:string,accept_status:string,reward_credit:number,reward_energy:number}>}
 */
export function selectClaimable(tasks) {
  const arr = Array.isArray(tasks) ? tasks : []
  return arr
    .filter(
      (t) =>
        String(t?.accept_status ?? '')
          .trim()
          .toLowerCase() === 'completed',
    )
    .map((t) => ({
      task_code: String(t.task_code ?? ''),
      title: String(t.title ?? ''),
      accept_status: String(t.accept_status ?? ''),
      reward_credit: Number(t.reward_credit ?? 0),
      reward_energy: Number(t.reward_energy ?? 0),
    }))
    .filter((t) => t.task_code !== '')
}

/**
 * 按 `--code` 收窄(纯函数):给了就只留那一枚,没给就全留。
 *
 * 点了名但列表里没有 ⇒ 返回空集**且**由调用方报未判定(不退化成"没有可领的")。
 *
 * @param {Array<{task_code:string}>} rows selectClaimable 的结果
 * @param {string} only 指定的任务码(空串=不筛)
 */
export function narrowByCode(rows, only) {
  const want = String(only ?? '').trim()
  if (!want) return Array.isArray(rows) ? rows : []
  return (Array.isArray(rows) ? rows : []).filter((r) => r.task_code === want)
}

/** 解析命令行(纯函数,离线可测) */
export function parseArgs(argv) {
  const opts = { dryRun: false, onlyCode: '', help: false }
  const arr = Array.isArray(argv) ? argv : []
  for (let i = 0; i < arr.length; i += 1) {
    const a = String(arr[i])
    if (a === '--dry-run') opts.dryRun = true
    else if (a === '--help' || a === '-h') opts.help = true
    else if (a.startsWith('--code=')) opts.onlyCode = a.slice('--code='.length)
    else if (a === '--code') opts.onlyCode = String(arr[i + 1] ?? '')
  }
  return opts
}

const HELP = `用法:
  node scripts/workbuddy-growth-claim.mjs --dry-run
      只读:列出每个号「服务端已判完成、奖励还没领」的项

  node scripts/workbuddy-growth-claim.mjs
      把这些项的奖励全部领取(逐枚调官方领奖端点,受理后回读)

  node scripts/workbuddy-growth-claim.mjs --code <任务码>
      只领点名的那一枚

边界:只领 completed;accepted(行为没做)绝不领,claimed(已到账)绝不重领;本命令不代做任何行为。
退出码:0 没有失败 / 1 有领奖失败 / 2 未判定(取不到号池·凭据·任务列表)。
`

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    console.log(HELP)
    return 0
  }
  const accounts = listPoolAccounts()
  if (!accounts.length) {
    console.error('号池里没有可用账号副本(未判定)')
    return 2
  }

  let total = 0
  let okCount = 0
  let failCount = 0
  let undetermined = 0

  for (const acc of accounts) {
    const tag = `[${acc.uid.slice(0, 8)}]`
    const cred = readPoolCredential(acc.uid)
    if (!cred) {
      console.log(`${tag} 取不到凭据 —— 未判定`)
      undetermined += 1
      continue
    }
    const res = await fetchGrowthTasks(cred)
    if (!res.ok) {
      console.log(`${tag} 读任务列表失败 —— 未判定:${res.reason}`)
      undetermined += 1
      continue
    }
    const all = selectClaimable(res.tasks)
    const rows = narrowByCode(all, opts.onlyCode)
    if (opts.onlyCode && !rows.length) {
      // 点了名却在「可领集」里找不到:可能是已领,也可能根本不可领 ⇒ 逐条说清,不猜
      const hit = (res.tasks ?? []).find((t) => String(t?.task_code) === opts.onlyCode)
      console.log(
        `${tag} 点名 ${opts.onlyCode} 不在可领集 —— 它的实际状态=${hit?.accept_status ?? '(列表里没有)'};未领`,
      )
      undetermined += 1
      continue
    }
    if (!rows.length) {
      console.log(`${tag} 没有可领项(共 ${res.tasks.length} 项,均为终态或等行为)`)
      continue
    }
    console.log(
      `${tag} 可领 ${rows.length} 项:${rows.map((r) => `${r.task_code}(${r.title})`).join(', ')}`,
    )
    if (opts.dryRun) {
      total += rows.length
      continue
    }
    for (const r of rows) {
      total += 1
      const c = await claimTask(cred, r.task_code)
      if (c.ok) {
        okCount += 1
        console.log(
          `  ✅ ${r.task_code} 已到账 +${r.reward_credit}积分/+${r.reward_energy}能量 (http=${c.status})`,
        )
      } else {
        failCount += 1
        console.log(`  ❌ ${r.task_code} 未到账:http=${c.status} code=${c.code} msg=${c.msg}`)
      }
    }
  }

  if (opts.dryRun) {
    console.log(`\n[dry-run] 共 ${total} 项可领(未动服务端)。去掉 --dry-run 即领。`)
    return undetermined ? 2 : 0
  }
  console.log(`\n汇总:领到 ${okCount}/${total},失败 ${failCount},未判定 ${undetermined}`)
  if (failCount) return 1
  if (undetermined && !okCount) return 2
  return 0
}

if (isDirectRun(import.meta.url, process.argv[1])) {
  process.exitCode = await main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
