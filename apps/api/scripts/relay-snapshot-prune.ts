// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay:snapshot-prune —— WorkBuddy 快照库同账号重复快照清理(2026-10-31 立)。
 *
 * 背景:快照库(~/.wb-switch/backups/workbuddy-desktop.<ts>.info)是"每次切换前自动备份"
 * 的产物,同一账号切一次多一份、按时间留档不按账号去重 —— 2026-10-31 实测 12 份里 8 份
 * 是同账号(192****0269),一键切号列表被同号重复淹没(见 relay-account-switch.ts
 * dedupeTargetsForDisplay 的展示层修复;本脚本治存量堆积)。
 *
 * 规则:
 *  - 同一 accountId 只保留最新一份(listSwitchTargets 契约:名字倒序 = 时间倒序,首见即最新);
 *  - 无 accountId 的快照一律不动(宁多留一份,不冒并账号 —— §0.10 失效方向恒为多留);
 *  - 被清理份**移入** backupsDir/.pruned/(rename,不删除,可人工找回;.pruned 不被
 *    listSwitchTargets 的 `workbuddy-desktop.*.info` 顶层枚举命中,不回潮进切换列表);
 *  - 默认 dry-run 只出计划;--apply 才移动;零上游请求,只动本地文件。
 */
import { existsSync, mkdirSync, renameSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { defaultSwitchPaths, listSwitchTargets, type SwitchTarget } from './relay-account-switch.js'

export interface PrunePlan {
  /** 该账号保留的那份(组内最新) */
  keep: SwitchTarget
  /** 被清理(移入 .pruned/)的更旧同账号快照 */
  move: SwitchTarget[]
}

/** 纯函数:按 accountId 分组,每组保留首见(最新),其余入 move;无 accountId 的不进任何组 */
export function planPrune(targets: SwitchTarget[]): PrunePlan[] {
  const byAccount = new Map<string, PrunePlan>()
  for (const t of targets) {
    if (!t.accountId) continue
    const p = byAccount.get(t.accountId)
    if (p) p.move.push(t)
    else byAccount.set(t.accountId, { keep: t, move: [] })
  }
  return [...byAccount.values()].filter((p) => p.move.length > 0)
}

export function pruneMain(argv: string[], home = homedir()): number {
  const apply = argv.includes('--apply')
  const paths = defaultSwitchPaths(home)
  if (!existsSync(paths.backupsDir)) {
    console.error(`快照库不存在: ${paths.backupsDir}`)
    return 2
  }
  const { targets } = listSwitchTargets(paths)
  const plans = planPrune(targets)
  if (plans.length === 0) {
    console.log('快照库无同账号重复,无需清理')
    return 0
  }
  const prunedDir = join(paths.backupsDir, '.pruned')
  let total = 0
  for (const p of plans) {
    console.log(`账号 ${p.keep.accountId?.slice(0, 8)}… 保留 ${p.keep.name}`)
    for (const m of p.move) {
      total++
      const dest = join(prunedDir, m.name)
      console.log(`  清理 ${m.name} → .pruned/`)
      if (!apply) continue
      if (existsSync(dest)) {
        console.error(`  ⚠ 目标已存在,跳过(不动源文件): ${dest}`)
        continue
      }
      mkdirSync(prunedDir, { recursive: true })
      renameSync(m.path, dest)
    }
  }
  console.log(
    apply
      ? `已清理 ${total} 份(移入 .pruned/,如需找回人工从该目录取回)`
      : `(dry-run,共 ${total} 份待清理;加 --apply 落地)`,
  )
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = pruneMain(process.argv.slice(2))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
