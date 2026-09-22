#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-mass-deletion.mjs —— 整树删除事故的结构化拦截(pre-commit blocking,守门 id 65)
 *
 * 背景(不是假想,是已发生两次的真实事故):
 *   并发会话带着"被清空的 git 索引"提交 → 一次提交删掉 11,607 / 11,640 个文件,
 *   事后各需一次"索引层重建"前向修复才能救回。当时的判据只是**事后**人肉
 *   `git ls-tree -r HEAD | wc -l`,没有任何闸在提交**前**拦住它。
 *   典型成因:`git rm -r --cached .` 之后没重加、lint-staged 异常中断、
 *   或本机 safe-delete 层把索引打残 —— 都会让"暂存区 = 全删"。
 *
 * 判据:比较【索引】与【HEAD】两个文件集合,删除规模命中任一条件即 exit 1:
 *   A. 绝对量 ≥ 1000 个文件(正常任务的删除量远不到这个数);
 *   B. 占 HEAD 文件树 ≥ 20%(仓库长大也不会漏)。
 *   两条都要"且索引非空可判"才生效:HEAD 尚无文件(未出生分支/空仓)时不判定。
 *
 * 为什么不用 `git diff --cached --stat` 的行数:行数与文件数不等价(单文件可删万行),
 * 本闸只关心**文件存续性**,这正是事故的损失形态。
 *
 * 应急放行:`IHUI_ALLOW_MASS_DELETION=1`。这是"确实要一次性删掉整个目录树"的合法
 * 场景(如迁移前清库)才该用的开关,用了必须在提交信息里写明影响范围。
 */
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const GIT = process.env.IHUI_GIT_BIN || 'C:\\Program Files\\Git\\cmd\\git.exe'
const ABS_LIMIT = 1000
const RATIO = 0.2

const git = (args) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1 << 28,
  })

/** 纯判据(供自测直接调用):返回 null = 放行,返回字符串 = 拦截理由 */
export function judge(deletedCount, headCount, allowed = false) {
  if (!Number.isFinite(deletedCount) || !Number.isFinite(headCount)) return '计数不可解析,无法判定'
  if (headCount <= 0) return null // 未出生分支 / 空仓:没有"存续性"可保护
  if (deletedCount <= 0) return null
  const ratio = deletedCount / headCount
  const hitAbs = deletedCount >= ABS_LIMIT
  const hitRatio = ratio >= RATIO
  if (!hitAbs && !hitRatio) return null
  if (allowed) {
    return null
  }
  return `索引相对 HEAD 缺失 ${deletedCount} 个文件(占 ${headCount} 的 ${(ratio * 100).toFixed(1)}%)`
}

function selfTest() {
  const cases = [
    // [删除数, HEAD 数, 期望是否拦截, 说明]
    [3, 11775, false, '正常提交的小幅删除'],
    [999, 11775, false, '刚好不到绝对量'],
    [1000, 11775, true, '命中绝对量 1000'],
    [199, 1000, false, '小仓 19.9% 未到比例线(且未命中绝对量)'],
    [200, 1000, true, '小仓命中 20% 比例线'],
    [11759, 11775, true, '真实事故形态(整树删除)'],
    [0, 11775, false, '无删除'],
    [11775, 0, false, '空仓不判定'],
    [11759, 11775, false, '应急开关放行'],
  ]
  let bad = 0
  for (const [d, h, expectBlock, why] of cases) {
    const allowed = why.includes('应急开关')
    const reason = judge(d, h, allowed)
    const gotBlock = reason !== null
    const ok = gotBlock === expectBlock
    if (!ok) bad++
    console.log(`${ok ? '✔' : '✘'} ${why}: 删除=${d} HEAD=${h} → ${gotBlock ? '拦截' : '放行'}${reason ? ' (' + reason + ')' : ''}`)
  }
  console.log(bad === 0 ? 'self-test 全部通过' : `self-test 失败 ${bad} 例`)
  process.exit(bad === 0 ? 0 : 1)
}

if (process.argv.includes('--self-test')) selfTest()

const headCount = Number.parseInt(git(['ls-tree', '-r', '--name-only', 'HEAD']).split('\n').filter(Boolean).length, 10)
const deletedCount = Number.parseInt(
  git(['diff', '--cached', '--diff-filter=D', '--name-only', 'HEAD']).split('\n').filter(Boolean).length,
  10,
)
const allowed = process.env.IHUI_ALLOW_MASS_DELETION === '1'
const reason = judge(deletedCount, headCount, allowed)

if (reason) {
  console.error(`\n❌ [check-mass-deletion] ${reason}`)
  console.error('   这正是 2026-09 两次「整树删除」事故的形态(单次提交删掉 11,607 / 11,640 个文件)。')
  console.error('   先判断成因,别急着放行:')
  console.error('     ① 索引被清空过? 复现验证:git ls-files | wc -l  与  git ls-tree -r HEAD | wc -l  应接近')
  console.error('        成因通常是 `git rm -r --cached .` 后未重加、lint-staged 中断、或索引被外部工具打残。')
  console.error('     ② 真是有意的大规模删除? 必须逐项列在提交信息里,再用应急开关:')
  console.error('        IHUI_ALLOW_MASS_DELETION=1 git commit ...')
  console.error('     ③ 已经误删并提交? 用**索引层重建**前向修复(零触碰他人未提交文件),')
  console.error('        禁止 reset --hard —— 那会连带抹掉并发会话的工作区改动。')
  if (allowed) console.error('   (IHUI_ALLOW_MASS_DELETION=1 已生效,本次放行)')
  process.exit(1)
}
console.log(
  `[check-mass-deletion] OK —— 索引 vs HEAD 缺失 ${deletedCount}/${headCount} 个文件(阈值 ${ABS_LIMIT} 或 ${RATIO * 100}%)`,
)
if (allowed && deletedCount > 0) console.log('  ⚠️ 应急开关 IHUI_ALLOW_MASS_DELETION=1 处于放行状态')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
