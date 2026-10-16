#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 台账存量清偿(机制根治的"清存量"那一半,2026-10-15 立)
 *
 * 背景:`union-converge` 的 `dedupeByFingerprint`(scripts/lib/dedupe-ledger.mjs)已在**合并时**
 * 堵住"重复再生",但已存在于 `HEAD:PROJECT_PLAN.md` 的 61 组同题副本不会因此自动消失(仅在
 * 两侧 diverge ⇒ 跑 unionLines 时才折;已收敛态不触发)。本脚本把现存未勾同题副本**主动清掉**,
 * 复用同一枚 `dedupeByFingerprint`(判据同源、零损失),经对象空间落地(commit-tree + CAS),
 * **绝不碰共享工作树** —— 与 plan-tasks-merge / union-converge 同源纪律。
 *
 * 安全闸(四条,任一不满足即跳过,绝不硬来):
 *   ① 工作树账本体必须干净(`git status --short -- PROJECT_PLAN.md` 为空) —— 在飞 agent 的
 *      未提交改动一律不动,避免撞坏别人的活儿;
 *   ② 读 `HEAD:PROJECT_PLAN.md`(已提交 blob)折叠,折叠后与原 blob 逐字相同 ⇒ 无需清偿,退出;
 *   ③ 落地走 commit-tree + CAS update-ref,HEAD 被并发抢进 ⇒ 重读 HEAD 重试(最多 5 次);
 *   ④ 落地后对齐共享主索引到新 blob(别人已暂存则该路径不动),落不进去只告警不失败。
 *
 * 不使用 `--dry-run`:只读 HEAD blob 并报告可折行数,一行不落(给人先确认形态)。
 * 落地后再跑守门 194 报告档核对剩余同题组(只报数,不拦截)。
 *
 * 注意:本脚本**不复跑台账自愈**(check-plan-line-loss --heal)—— 自愈的"行丢失"判据会把本脚本
 * 有意删除的副本行误判为丢失并回捞,等于把清偿撤销;零损失已由 dedupeByFingerprint 的注记/票号并入保证。
 */

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { dedupeByFingerprint } from './lib/dedupe-ledger.mjs'
import {
  git,
  headBlobOf,
  commitTreeWithIndex,
  casUpdateRef,
  attestBypassCommit,
  alignSharedIndex,
  LEDGER_DOC,
  ABSENT,
} from './lib/bypass-git.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const gitErrText = (e) => String(e?.stderr ?? e?.message ?? e).split(/\r?\n/)[0]

const countOpen = (text) => (String(text).match(/^- \[ \]/gm) || []).length

function isDirectRun() {
  const arg = process.argv[1] ? resolve(process.argv[1]) : ''
  return arg === resolve(fileURLToPath(import.meta.url))
}

export function dedupeStock({ root = ROOT, dryRun = false } = {}) {
  // ① 工作树账本体必须干净 —— 在飞 agent 的未提交改动不动
  const status = git(['status', '--short', '--', LEDGER_DOC], { root, allowFail: true })
  if (status === null) {
    return { skipped: true, why: '取不到 git status ⇒ 无法判定工作树是否干净,跳过(安全优先)' }
  }
  if (status.trim() !== '') {
    return { skipped: true, why: `工作树账本体未提交改动(${status.trim().split('\n')[0]}…) ⇒ 跳过,不碰在飞 agent 的活儿` }
  }

  // ② 读已提交 blob 折叠
  const head = git(['rev-parse', 'HEAD'], { root })
  const blob = headBlobOf(head, LEDGER_DOC, { root })
  if (blob === ABSENT) {
    return { skipped: true, why: `HEAD 上没有 ${LEDGER_DOC} ⇒ 跳过` }
  }
  const orig = git(['cat-file', 'blob', blob], { root, maxBuffer: 1 << 28 })
  const folded = dedupeByFingerprint(orig)
  const before = countOpen(orig)
  const after = countOpen(folded)
  const removed = before - after

  if (folded === orig) {
    return { skipped: true, why: `HEAD:${LEDGER_DOC} 无可折同题副本(未勾 ${before} 行,0 可折) ⇒ 无需清偿` }
  }

  if (dryRun) {
    return { dryRun: true, before, after, removed, message: `将折叠 ${removed} 行(未勾 ${before} → ${after}),不落盘` }
  }

  // ③ 落地:commit-tree + CAS,HEAD 被抢进则重读重试
  const msg =
    `fix(plan): 存量清偿——折叠 ${LEDGER_DOC} 未勾同题副本 ${removed} 行(未勾 ${before} → ${after})\n\n` +
    `机制由 scripts/lib/dedupe-ledger.mjs 的 dedupeByFingerprint 完成:按标题指纹折叠未勾同题行,` +
    `被丢弃行的独有 〔…〕 注记与异票号(〔同题原号 …〕)并入保留行,信息零损失。\n` +
    `与 union-converge 合并时去重同源;本枚为存量一次性清偿。`
  let attempts = 0
  while (attempts < 5) {
    const cur = git(['rev-parse', 'HEAD'], { root })
    const curBlob = headBlobOf(cur, LEDGER_DOC, { root })
    if (curBlob === ABSENT) return { skipped: true, why: `HEAD 上没有 ${LEDGER_DOC} ⇒ 跳过` }
    const curText = git(['cat-file', 'blob', curBlob], { root, maxBuffer: 1 << 28 })
    const curFolded = dedupeByFingerprint(curText)
    if (curFolded === curText) {
      return { skipped: true, why: `重读 HEAD 时已无可折副本(可能已被并发清偿) ⇒ 跳过` }
    }
    const { commit } = commitTreeWithIndex({
      root,
      parent: cur,
      message: msg,
      treePath: LEDGER_DOC,
      text: curFolded,
      baseRef: 'HEAD',
    })
    if (!commit) {
      return { skipped: true, why: 'commit-tree 前 onTree 校验拒绝 ⇒ 落地放弃(内容未写)' }
    }
    if (casUpdateRef(commit, cur, { root })) {
      attestBypassCommit(commit, { root, source: 'ledger-dedupe-stock', headBefore: cur })
      // ④ 对齐共享主索引(别人已暂存则该路径不动);落不进去只告警
      try {
        const r = alignSharedIndex({ root, paths: [LEDGER_DOC], parentRef: cur })
        if (r.failed) console.error(`⚠️ 共享索引对齐失败(不影响已落地提交):${r.error ?? ''}`)
      } catch (e) {
        console.error(`⚠️ 共享索引对齐异常(不影响已落地提交):${gitErrText(e).slice(0, 160)}`)
      }
      // ⑤ 落地窗口内账本体仍干净 ⇒ 同步工作树到新 HEAD(否则 git status 显"已修改",
      //    日后 git add -A 会把旧版副本连着重新入库);若在窗口内被并发改脏 ⇒ 不碰工作树,保留并发方改动。
      const lateStatus = git(['status', '--short', '--', LEDGER_DOC], { root, allowFail: true })
      if (lateStatus !== null && lateStatus.trim() === '') {
        try {
          git(['checkout', 'HEAD', '--', LEDGER_DOC], { root })
        } catch (e) {
          console.error(`⚠️ 工作树同步失败(不影响已落地提交):${gitErrText(e).slice(0, 160)}`)
        }
      } else {
        console.error('⚠️ 落地窗口内账本体被并发改脏 ⇒ 不碰工作树,保留并发方改动;下次收敛会 reconcile')
      }
      const afterCount = countOpen(curFolded)
      return {
        landed: true,
        commit,
        removed: countOpen(curText) - afterCount,
        before: countOpen(curText),
        after: afterCount,
      }
    }
    attempts++
  }
  return { skipped: true, why: `CAS 重试 ${attempts} 次均被并发抢进 ⇒ 放弃本次(下一轮再试)` }
}

/* istanbul ignore next */
if (isDirectRun()) {
  const dryRun = process.argv.includes('--dry-run')
  const r = dedupeStock({ root: ROOT, dryRun })
  if (r.skipped) {
    console.log(`ℹ️ 跳过:${r.why}`)
    process.exit(0)
  }
  if (r.dryRun) {
    console.log(`🔍 [dry-run] ${r.message}`)
    process.exit(0)
  }
  console.log(
    `✅ 存量清偿落地 ${String(r.commit).slice(0, 11)}:未勾 ${r.before} → ${r.after},折叠 ${r.removed} 行`,
  )
  // 落后再报守门 194 存量(只报数)
  try {
    const { spawnSync } = await import('node:child_process')
    const out = spawnSync(process.execPath, ['scripts/check-plan-task-duplicates.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1 << 26,
    })
    for (const line of (out.stdout || '').split('\n')) {
      if (line.includes('同题多号组')) console.log(`   复核:${line.trim()}`)
    }
  } catch {
    /* 复核失败不影响落地结论 */
  }
  process.exit(0)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
