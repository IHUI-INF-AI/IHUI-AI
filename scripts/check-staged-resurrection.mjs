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
 * ## 失效方向(§0.10,2026-11-07 收紧)
 *
 * - `resurrected` ⇒ **exit 1**,逐条点名理由与有效期,给两条出路;
 * - 台账**缺失** ⇒ **exit 2**(未判定),打印「台账缺失 ⇒ 未判定 ⇒ 判失败」——
 *   没有判据等于闸没立;旧口径「缺席即静默通过」已于 2026-11-07 删除;
 * - 台账**坏档** / 读不到索引面 ⇒ **exit 2**(未判定),同样不当作通过;
 * - 台账在但零条目 ⇒ 有判据、判 clean,exit 0。
 * 机器口 `--json` 仍永远 exit 0,用 `verdict` 区分 `clean`/`resurrected`/`undetermined`。
 *
 * 台账重建(HEAD 实际删除历史,不搬旧文件):
 *   git log -m --diff-filter=D --name-only --no-renames --since=<ISO> --format= HEAD
 *   → 只保留「当前 HEAD 树里已不存在」的路径(删了又被后续提交加回来的不算),逐行入账。
 *   生成脚本的完整口径写在台账文件头注释里。
 *
 * 用法:
 *   node scripts/check-staged-resurrection.mjs          # pre-commit 用:判红 exit 1,未判定 exit 2
 *   node scripts/check-staged-resurrection.mjs --json   # 机器读,永远 exit 0
 *   node scripts/check-staged-resurrection.mjs --quiet  # 只在失败/未判定时说话
 */
import { judgeResurrection, readFileDeletionNotices } from './lib/intentional-file-deletion.mjs'
import { gitRaw } from './lib/face-reader.mjs'

const argv = process.argv.slice(2)
const asJson = argv.includes('--json')
const quiet = argv.includes('--quiet')

function git(args) {
  try {
    return String(
      gitRaw(args, process.cwd(), { timeout: 120_000, maxBuffer: 64 << 20 }) ?? '',
    )
  } catch {
    return null
  }
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
    else console.error('❌ 复活闸:读不到索引面 ⇒ 未判定 ⇒ 判失败(先修 git 索引面)')
    return 2
  }

  if (notices.absent) {
    if (asJson)
      console.log(JSON.stringify({ verdict: 'undetermined', why: '台账缺失', addedCount: added.length }))
    else {
      console.error('❌ 复活闸:台账缺失 ⇒ 未判定 ⇒ 判失败。')
      console.error('   缺 scripts/data/intentional-file-deletions.jsonl:没有台账就判不出回流。')
      console.error('   重建口径见台账文件头注释与脚本头注释(HEAD 实际删除历史生成,不搬旧文件)')
    }
    return 2
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
    console.error(`❌ 复活闸:台账解不开(${j.why})⇒ 未判定 ⇒ 判失败(未判定不是通过,修好台账后才放行)`)
    return 2
  }

  if (!quiet) console.log(`✅ 复活闸:新增面 ${added.length} 件,与删除台账无交集`)
  return 0
}

process.exit(main())
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
