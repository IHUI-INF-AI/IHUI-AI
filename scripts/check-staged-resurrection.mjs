// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/check-staged-resurrection.mjs
/**
 * **pre-commit 侧的复活闸** —— 与 `safe-commit.mjs` Step 3b-2 同一判据
 * (`lib/intentional-file-deletion.mjs#judgeResurrection`),覆盖 safe-commit 够不到的那条腿。
 *
 * ## 为什么还要这一道
 *
 * `safe-commit` 是 AGENTS §12 强制的五步法入口,但仓里仍有别的提交路径:
 * `auto-commit-quiet` 的 `chore(auto)`、人工 `git commit`、以及各席位自己拼的 git 命令。
 * `8331e5460a` 那次正是这类路径进来的 —— 事后只能靠台账对账发现。pre-commit 是**唯一**
 * 所有路径都会经过的地方,所以判据要在这里再立一道。
 *
 * ## 与 safe-commit 那道的关系:同源,不重复维护
 *
 * 两道闸都 import 同一份 `judgeResurrection`,区别只在"从哪儿拿新增面":
 *   - safe-commit 用**声明集语义**(Step 2 刚 add 完,索引面就是本枚提交面);
 *   - 本脚本用 `git diff --cached --diff-filter=A`,即**当前索引相对 HEAD 的新增面** ——
 *     在 `git commit --only` 期间 git 会经 `GIT_INDEX_FILE` 传入临时索引,读到的正是本次
 *     提交的内容,语义自动对齐。
 *
 * ## 失效方向(§0.10)
 *
 * - `resurrected` ⇒ **exit 1**,逐条点名理由与有效期,给两条出路;
 * - `undetermined`(台账坏档 / 读不到索引面)⇒ **只报不拦**,exit 0 —— 判不出不是定罪的许可证;
 * - 台账缺席或零条目 ⇒ 无判据,静默通过(不刷噪音)。
 *
 * 用法:
 *   node scripts/check-staged-resurrection.mjs          # pre-commit 用,失败 exit 1
 *   node scripts/check-staged-resurrection.mjs --json   # 机器读,永远 exit 0
 *   node scripts/check-staged-resurrection.mjs --quiet  # 只在失败时说话
 */
import { spawnSync } from 'node:child_process'
import { judgeResurrection, readFileDeletionNotices } from './lib/intentional-file-deletion.mjs'

const argv = process.argv.slice(2)
const asJson = argv.includes('--json')
const quiet = argv.includes('--quiet')

function git(args) {
  const r = spawnSync('git', args, {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 << 20,
    timeout: 120_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (r.error || r.status !== 0) return null
  return r.stdout
}

/** 索引面相对 HEAD 的新增路径(`--no-renames`:改名的新侧也算 A,和 safe-commit 同口径)。 */
function addedPaths() {
  const raw = git(['diff', '--cached', '--name-status', '--no-renames', '--diff-filter=A', '-z'])
  if (raw === null) return null
  const fields = raw.split('\0').filter(Boolean)
  const out = []
  for (let i = 0; i + 1 < fields.length; i += 2) out.push(fields[i + 1])
  return out
}

function main() {
  const root = (git(['rev-parse', '--show-toplevel']) || '').trim()
  if (!root) {
    // 不在 git 仓里:pre-commit 不可能走到这儿,但别把"判不出"读成"有问题"。
    if (asJson) console.log(JSON.stringify({ verdict: 'undetermined', why: '不在 git 仓内' }))
    return 0
  }

  const notices = readFileDeletionNotices(root)
  const added = addedPaths()
  if (added === null) {
    if (asJson) console.log(JSON.stringify({ verdict: 'undetermined', why: '读不到索引面' }))
    else if (!quiet) console.log('⚠️  复活闸:读不到索引面 ⇒ 本轮跳过(判不出≠没回流)')
    return 0
  }

  const j = judgeResurrection({ notices, addedPaths: added })

  if (asJson) {
    console.log(
      JSON.stringify({
        verdict: j.verdict,
        hits: j.hits.map((h) => ({ path: h.path, reason: h.entry?.reason ?? null, until: h.entry?.until ?? null })),
        addedCount: added.length,
        why: j.why ?? null,
      }),
    )
    return 0
  }

  if (j.verdict === 'resurrected') {
    console.error(
      `❌ 复活闸:${j.hits.length} 个文件**已被登记为有意删除**,却出现在本次提交的新增面:`,
    )
    for (const { path: p, entry } of j.hits) {
      console.error(`     + ${p}`)
      console.error(
        `       通知书理由:${entry?.reason ?? '(无)'}${entry?.until ? ` · until ${entry.until}` : ' · 长期有效'}`,
      )
    }
    console.error('   这是「有意删除被 healer 复活后又收编进提交」的回流,不是正常新增。')
    console.error('   两种出路,必须显式选一种:')
    console.error(
      '     ① 确实要把它用回来 ⇒ node scripts/heal-worktree-tracked.mjs --revoke-deletion <path>',
    )
    console.error('     ② 确认是误带进来 ⇒ git restore --staged -- <path>')
    console.error('   台账:scripts/data/intentional-file-deletions.jsonl(写入只走 CLI)')
    return 1
  }

  if (j.verdict === 'undetermined') {
    if (!quiet) console.error(`⚠️  复活闸:台账解不开(${j.why})⇒ 本轮只报不拦,修好台账后自动生效`)
    return 0
  }

  if (!quiet) console.log(`✅ 复活闸:新增面 ${added.length} 件,与删除台账无交集`)
  return 0
}

process.exit(main())
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
