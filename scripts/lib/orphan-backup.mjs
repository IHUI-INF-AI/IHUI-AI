// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 孤儿提交的 §29 零损失备份腿(2026-10-29 立,门 30a 根因票)。
 *
 * 为什么要在仓里、还要抽成 lib:本仓有**四台**旁路落地器会造出"已 commit-tree 而没进任何 ref"的
 * 孤儿提交(`object-space-land.mjs` / `git-sync-converge.mjs` / `union-converge.mjs` /
 * `plan-tasks-merge.mjs`)。守门 30a(`check-commit-loss-guard.mjs`,blocking、`stagedTriggers` 缺省
 * = 任何提交都跑)把"30 天窗内新产生且未 tag 备份"的孤儿**逐枚判红**,而它认账只认
 * `refs/tags/lost-commit/*` 的 sha 直等(见其 :1396-1402)。此前只有 `git-sync-converge.mjs` 一条腿,
 * 另外三台一枚都不备份 ⇒ 2026-10-29 现读 163 枚存量红、且日增(10-26:25 / 10-27:37 / 10-28:88),
 * 红与任何一次提交内容都无关 —— §12e 那一型:恒红的唯一结局是逼人 skipEnv、连带废掉全部守门。
 *
 * 立因读数(推翻"孤儿=被顶掉的旧 tip"这个直觉):实测 185 枚孤儿里 **178 枚的全部父提交都可达**、
 * **184 枚从未在 `refs/heads/main` 的 reflog 里当过 HEAD 值** ⇒ 绝大多数孤儿是**本轮造好却被当场弃掉的那枚新提交**
 * (CAS 没抢到 / 落地后自证不过),不是被推进的旧 tip;快进式推进结构上产不出孤儿
 * (`casUpdateRef` 对非快进 fail-closed)。所以这一腿的调用点是**弃落出口**,不是成功出口 ——
 * 给正常落地的 parentSha 打 tag 只会把每次落地变成 tag 噪声。
 *
 * 三条不可漂的写法:
 *  ① **命名族不变**:`lost-commit/wip-<档>-<sha7>`,`git-sync-converge` 的 `conv` 档一字不动
 *     (它的镜像测试钉着 `lost-commit/wip-conv-947ef34`);
 *  ② **打完必须 `pack-refs`**:嵌套 depth≥2 的 ref 会被宿主清理层静默删掉(§5b「嵌套 ref 存续」),
 *     tag 消失 = 30a 重新判红,等于这条腿自己失效;
 *  ③ **永不抛**:备份是善后,不能把落地器本身炸掉;但失败必须出声(log + 留痕),
 *     "没备份成功"绝不写成"已备份"(§0.3)。
 *
 * 留痕 `.ihui-agent/state/orphan-backup.jsonl` 是给 §29 那条"保留期 30 天、GC 由维护者人工触发"
 * 用的名单:守门不擅删 tag,但必须有人能一次列出"这台机器替谁留了债"。
 *
 * 纪律:本文件只放判据 + 一次 IO,不 import 任何调用方(叶子模块不得反向依赖主文件 ⇒ 成环);
 * 无 CLI 主流程(门 194 的 isDirectRun 那一格对纯 lib 不适用,顶层不得有 main)。
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')

/** §29 命名族前缀;30a 的"已备份"判据只认 refs/tags/lost-commit/* 的 sha 直等,不看中段。 */
export const ORPHAN_TAG_PREFIX = 'lost-commit/wip-'

/**
 * 纯函数:孤儿提交的备份 ref 名。
 * @param {string} sha 7-40 位十六进制;形状不对返回 null(调用方必须把 null 当"未备份"报出来)
 * @param {string} kind 产出方档位:conv(收敛器)/ land(落地器)/ uni(归并器)/ merge(台账合并器)
 */
export function orphanBackupRefName(sha, kind = 'conv') {
  const s = String(sha || '').trim()
  if (!/^[0-9a-f]{7,40}$/.test(s)) return null
  if (!/^[a-z]{2,8}$/.test(String(kind))) return null
  return `${ORPHAN_TAG_PREFIX}${kind}-${s.slice(0, 7)}`
}

/** 派生 git 一律显式 stdio + windowsHide(§5b 派生进程纪律 / §12g;漏此参数在守护下必弹控制台窗)。 */
function gitAt(root, args) {
  try {
    const out = execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1 << 24,
    })
    return String(out || '').trim()
  } catch {
    return null
  }
}

/**
 * 把一枚当场弃掉的提交按 §29 备份成 annotated tag 并 pack-refs,再追一行留痕。
 * 幂等:同名 ref 已在 ⇒ 只报 already,不重复打、不撞名。
 * @returns {{ok:boolean, ref:string|null, already?:boolean, why:string}}
 */
export function backupOrphanCommit({
  sha,
  why = '未署名弃落',
  kind = 'conv',
  root = REPO_ROOT,
  logger = () => {},
  runner = gitAt,
  ledgerFile = resolve(root, '.ihui-agent', 'state', 'orphan-backup.jsonl'),
  now = new Date(),
} = {}) {
  const ref = orphanBackupRefName(sha, kind)
  if (!ref) {
    logger(`⚠️ 孤儿提交备份未执行:sha 形状不对(${String(sha).slice(0, 12)})或档名不合法(${kind})—— 未备份不等于不需要备份`)
    return { ok: false, ref: null, why: 'bad-sha-or-kind' }
  }
  const s = String(sha).trim()
  try {
    if (runner(root, ['rev-parse', '--verify', '--quiet', `refs/tags/${ref}`]) !== null) {
      return { ok: true, ref, already: true, why: 'already-tagged' }
    }
    const tagged = runner(root, [
      'tag',
      ref,
      s,
      '-m',
      `孤儿提交(${why}):已 commit-tree 而未进任何 ref,按 §29 零损失备份`,
    ])
    if (tagged === null) {
      logger(`⚠️ 孤儿提交备份失败(git tag 未成):${ref} → ${s.slice(0, 12)} —— 30a 会继续把它记成未备份`)
      return { ok: false, ref, why: 'tag-failed' }
    }
    // 嵌套 ref 不 pack 就会被宿主清理层删掉(§5b),tag 消失 = 这条腿静默失效
    runner(root, ['pack-refs', '--all', '--prune'])
    try {
      mkdirSync(dirname(ledgerFile), { recursive: true })
      appendFileSync(
        ledgerFile,
        JSON.stringify({
          at: now.toISOString(),
          sha: s,
          ref,
          kind,
          why: String(why).slice(0, 200),
        }) + '\n',
        'utf8',
      )
    } catch (e) {
      // 留痕写不进不能反过来说没备份:tag 已是既成事实,这里只出声
      logger(`⚠️ 孤儿备份留痕未写入 ${ledgerFile}:${String(e?.message ?? e).slice(0, 120)} —— tag 已在,名单缺这一行`)
    }
    logger(`🛟 已备份孤儿提交为 ${ref}(否则守门 30a 会让每一次提交都被逼跳门)`)
    return { ok: true, ref, why: 'tagged' }
  } catch (e) {
    logger(`⚠️ 备份孤儿提交异常:${String(e?.message ?? e).slice(0, 120)}`)
    return { ok: false, ref, why: 'threw' }
  }
}

/** §22c:镜像测试直接吃这份判据,不在测试里复制。 */
export const __test__ = { orphanBackupRefName, backupOrphanCommit, ORPHAN_TAG_PREFIX }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
