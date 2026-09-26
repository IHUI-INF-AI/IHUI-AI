// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 对象空间落地器(常驻工具,不在提交链;2026-09-27 立,工程工具收口票)。
 *
 * 为什么在仓里(成因写死在头注,票面要求):本会话交付 8 枚票,全部要落"对象空间"提交 —— 工作树副本常年
 * 滞后 HEAD,按 pathspec 交工作树就把别人已入库的行整批写回旧态(AGENTS §12 一夜三次自伤)。当时在同一次
 * 会话里手写了 6 份近乎同形的落地脚本且已漂开(细节见 scripts/lib/bypass-git.mjs 头注),其中本器收的是
 * land-r24 + reconcile-index 两份:
 *  - ① 落地后 `git show --name-only` 回读,证明"消息声称的每条路径真在提交里"(本仓规矩:commit message
 *    只能写能被回读证明的东西;声明路径无差异 ⇒ 事先拒绝,而不是落地后让 proof 步骤扑空);
 *  - ② 逐路径把共享主索引对齐到新 blob —— commit-tree+update-ref 不碰主索引,新文件在别人眼里就成了
 *    `D ` 暂存删除、改动文件成 `M `,此后一次不带 pathspec 的普通提交就把本轮交付写回旧版。
 *    对齐只在"索引 blob == 父提交 blob 或索引里没有"时动(判据住在 lib,只有一份实现);
 *    别人真暂存过的一律**不动并点名"归属他人"**(退出码 0,但逐条喊出来,绝不静默)。
 *
 * CLI 契约(env 驱动,无参数):
 *  LAND_PATHS  必填,以 `;` 分隔的仓库相对路径清单(内容取各路径的工作树当前字节)
 *  LAND_MSG    必填,提交信息
 *  LAND_ROOT   测试/换仓通道:被落地的仓库根(缺省 = 本脚本所在仓根)
 *  LAND_BASE_REF 取证通道:防覆盖对账的基线 ref(缺省 HEAD;只有测试用它造"别人已改过"的现场)
 * 退出码:0 = 已落地且回读通过(对齐的 skipped/未判定只在 stdout 点名);
 *        1 = 业务拒绝(某目标路径被别人改过 ⇒ 需重新归并 / 声明路径无差异 / CAS 12 次未抢到 / 提交面回读缺路径 / 索引锁龄超上限);
 *        2 = 用法或环境错(空清单 / 空消息 / 声明路径不在盘上 / 根不可当仓库问)。
 *
 * ⚠️ 头注刻意不写"已接 pre-commit / CI / 第 N 项"—— 它是手动常驻工具,那种话会被守门 89 判"声称已接线而零命中"。
 */

import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  alignSharedIndex,
  casUpdateRef,
  commitTreeWithIndex,
  git,
  headBlobOf,
  resolveHeadRef,
  writeBlobOfWorktree,
} from './lib/bypass-git.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')
const MAX_CAS_ATTEMPTS = 12

/** 读 env 并判用法;不合法 ⇒ {error, code:2}。 */
export function parseArgs(env = process.env) {
  const root = env.LAND_ROOT ? resolve(env.LAND_ROOT) : REPO_ROOT
  const paths = String(env.LAND_PATHS ?? '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
  const msg = env.LAND_MSG ?? ''
  const baseRef = env.LAND_BASE_REF || 'HEAD'
  if (paths.length === 0) return { error: '缺 LAND_PATHS(以 ; 分隔)⇒ 拒绝执行(空清单会把 undefined 当路径提交,本仓踩过)' }
  if (msg === '') return { error: '缺 LAND_MSG ⇒ 拒绝执行(不允许空消息落地,提交史无法归因)' }
  if (!resolveHeadRef({ root })) return { error: `${root} 不是可用仓库(HEAD 不可解析或 detached)⇒ 无法判定,不落` }
  const missing = paths.filter((p) => !existsSync(join(root, p)))
  if (missing.length > 0) return { error: `声明路径不在盘上:\n  ${missing.join('\n  ')}` }
  return { root, paths, msg, baseRef }
}

/** 防覆盖护栏:基线快照与当下 HEAD 之间,哪些目标路径的内容被别人动过。 */
export function clobberedPaths(paths, baseMap, headNow, { root }) {
  return paths.filter((p) => headBlobOf(headNow, p, { root }) !== baseMap.get(p))
}

async function main() {
  const parsed = parseArgs()
  if (parsed.error) {
    console.error(`❌ ${parsed.error}`)
    process.exit(2)
  }
  const { root, paths, msg, baseRef } = parsed

  const head0 = git(['rev-parse', 'HEAD'], { root })
  const base = new Map(paths.map((p) => [p, headBlobOf(baseRef, p, { root })]))
  const mine = new Map(paths.map((p) => [p, writeBlobOfWorktree(p, { root })]))

  // 声明无差异 ⇒ 事先拒绝(提交面回读结构上证明不了"改了它";safe-commit Step③ 同型的中止语义,前置到写盘之前)
  const noDiff = paths.filter((p) => mine.get(p) === base.get(p))
  if (noDiff.length > 0) {
    console.error(`❌ 这些声明路径与基线(${baseRef})内容逐字节相同 ⇒ 拒绝落地(提交面回读永远证不了它们被改):\n  ${noDiff.join('\n  ')}`)
    process.exit(1)
  }

  let landed = ''
  let parentSha = ''
  for (let attempt = 1; attempt <= MAX_CAS_ATTEMPTS; attempt++) {
    const head = git(['rev-parse', 'HEAD'], { root })
    const clobber = clobberedPaths(paths, base, head, { root })
    if (clobber.length > 0) {
      console.error(`❌ 放弃落地:HEAD 已推进且这些目标路径被别人改过 ⇒ 需重新归并而非覆盖(第 ${attempt} 次尝试):\n  ${clobber.join('\n  ')}`)
      process.exit(1)
    }
    const { commit } = commitTreeWithIndex({
      root,
      parent: head,
      message: msg,
      entries: paths.map((p) => ({ path: p, blob: mine.get(p) })),
      baseRef: head,
    })
    if (casUpdateRef(commit, head, { root })) {
      landed = commit
      parentSha = head
      console.log(`✅ 第 ${attempt} 次 CAS 成功 HEAD=${commit}(基线 ${baseRef}=${head0.slice(0, 9)})`)
      break
    }
    console.log(`⚠️ 第 ${attempt} 次 CAS 失败(别人先推进了 HEAD),重读重试`)
  }
  if (landed === '') {
    console.error(`❌ ${MAX_CAS_ATTEMPTS} 次均未抢到 CAS,主索引未动`)
    process.exit(1)
  }

  // ① 提交面回读:声明的每条路径必须出现在 git show --name-only 清单里
  const inCommit = new Set(
    git(['show', '--name-only', '--format=', landed], { root })
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean),
  )
  const notProven = paths.filter((p) => !inCommit.has(p))
  if (notProven.length > 0) {
    console.error(`❌ 提交面回读缺路径(消息声称的改动没真进树):\n  ${notProven.join('\n  ')}`)
    process.exit(1)
  }
  const extras = [...inCommit].filter((p) => !paths.includes(p))
  console.log(
    `✅ 提交面回读 ${paths.length}/${paths.length} 路径在树${extras.length ? `;另有非声明路径 ${extras.length} 条(检查是否混提)` : ''}`,
  )

  // ② 共享主索引对齐(判据在 lib,只有一份):未尽事项点名后退出码仍 0 —— 落地本身已成功
  const align = alignSharedIndex({ root, paths, parentRef: parentSha })
  if (align.lockAbandoned) {
    console.error('❌ .git/index.lock 锁龄超上限:不代删别人的锁,请人工确认持有者后单跑索引对齐')
    process.exit(1)
  }
  if (align.failed) {
    console.error(`❌ 索引对齐未完成(轮次耗尽/派生持续失败):${align.error ?? ''}`)
    process.exit(1)
  }
  console.log(`✅ 主索引已对齐 ${align.moved.length + align.already.length}/${paths.length} 路径(移动 ${align.moved.length} / 已就位 ${align.already.length})`)
  if (align.skipped.length > 0) {
    console.log(`⚠️ 未动(归属他人):\n  ${align.skipped.map((s) => `${s.path} (${s.reason})`).join('\n  ')}`)
  }
  if (align.undetermined.length > 0) {
    console.log(`⚠️ 未判定:\n  ${align.undetermined.map((u) => `${u.path} (${u.reason})`).join('\n  ')}`)
  }
  process.exit(0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = { parseArgs, clobberedPaths }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
