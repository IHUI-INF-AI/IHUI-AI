// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * rev-reference-graph.mjs —— **某个提交/树里"还有没有人引用这些路径"** 的唯一取材出口。
 *
 * ## 为什么必须单列一层
 *
 * 2026-11-05 结构缺陷票:旁路落地(`commit-tree + CAS`)只推进 ref,不回写共享索引、不碰工作树;
 * 于是新增路径在 HEAD 里、索引与磁盘都没有。自愈第四层原本只用"父树签名"区分旁路残留与
 * `git rm`,而**合进来的新文件恰恰存在于另一个父树** ⇒ 被判成"与有意 git rm 分不清"只报不修。
 * 要区分这两件事,判据只能问一句:"这个路径在落地后的树里还有没有被引用?"
 * 有引用 ⇒ 删除/缺席几乎一定是落地没回写(构建取工作树,缺了直接编译失败);
 * 零引用 ⇒ 才可能是有意删除,交人确认。
 *
 * 匹配尺**不在这里另造一份**:`collectHits` 就是守门 99 那一份(相对说明符解析、别名、
 * 注释里的路径串不算引用),本层只负责"取哪个 rev、怎么喂"。检索方式(先 `git grep` 宽预筛、
 * 再由判据收窄)与 `check-orphan-deletion-refs.mjs` 同一条纪律。
 *
 * 失效方向:取不到(rev 不存在 / grep 失败 / blob 读不到)⇒ 该维记 `undetermined`,
 * **不得读成"零引用"**。调用方必须把未判定当"没有证明",不能当通过。
 */
import { gitRaw } from './face-reader.mjs'
import { collectHits } from '../check-staged-deletions.mjs'

const DEFAULT_TIMEOUT_MS = 90_000
/** 与 check-orphan-deletion-refs 同一口径:只有源码/配置才可能"引用一个模块"。 */
const SCAN_EXT = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|py|vue|svelte|json|jsonc|css|scss|html)(\.[^/]*)?$/

function firstLine(e) {
  return String(e?.stderr ?? e?.message ?? e)
    .split(/\r?\n/)[0]
    .trim()
}

/** rev 下全部文件(按路径);取不到即抛,交调用方记未判定。 */
export function revFileList({ root, rev, timeout = DEFAULT_TIMEOUT_MS }) {
  const out = gitRaw(['ls-tree', '-r', '--name-only', '-z', rev], root, { timeout })
  return out.split('\0').filter(Boolean)
}

/** rev 下 `git grep` 宽预筛;rc=1(无命中)是有效空集,>=2 交调用方记未判定。 */
export function grepInRev({ root, rev, stems, timeout = DEFAULT_TIMEOUT_MS }) {
  const args = ['grep', '-I', '-l', '-F']
  for (const s of stems) args.push('-e', s)
  args.push(rev, '--')
  try {
    // `git grep <rev>` 会把 rev 名作为前缀输出(`HEAD:apps/x.ts`);不剥掉就没有一条路径命中 liveSet。
    const prefix = `${rev}:`
    return {
      files: [
        ...new Set(
          gitRaw(args, root, { timeout })
            .split('\n')
            .filter(Boolean)
            .map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : l)),
        ),
      ],
    }
  } catch (e) {
    if (e?.status === 1) return { files: [] }
    return { files: [], error: firstLine(e) }
  }
}

/**
 * 在 `rev` 的**树内**找引用者(判据 = 守门 99 的 collectHits,零复算)。
 *
 * @param {{root:string, rev:string, paths:string[], timeout?:number}} a
 * @returns {{hits: Map<string, Array<{file:string,line:number,form:string,spec:string}>>, undetermined:string[], candidates:number, files:string[]}}
 */
export function findReferencersInRev({ root, rev, paths, timeout = DEFAULT_TIMEOUT_MS }) {
  const list = [...new Set((paths ?? []).filter(Boolean))]
  const undetermined = []
  if (!list.length) return { hits: new Map(), undetermined, candidates: 0, files: [] }
  const stems = [...new Set(list.map((p) => p.split('/').pop().replace(/\.[^.]*$/, '')))].filter(Boolean)
  let files
  try {
    files = revFileList({ root, rev, timeout })
  } catch (e) {
    return {
      hits: new Map(),
      undetermined: [`${rev} 的文件清单取不到:${firstLine(e)}`],
      candidates: 0,
      files: [],
    }
  }
  const live = new Set(files)
  const grep = grepInRev({ root, rev, stems, timeout })
  if (grep.error) undetermined.push(`git grep ${rev} 失败:${grep.error}`)
  const deleted = new Set(list)
  const candidates = (grep.files ?? []).filter((f) => SCAN_EXT.test(f) && !deleted.has(f) && live.has(f))
  if (!candidates.length) return { hits: new Map(), undetermined, candidates: 0, files }
  const readFile = (f) => {
    try {
      return gitRaw(['show', `${rev}:${f}`], root, { timeout })
    } catch {
      // 单个引用方读不到 ⇒ 该文件不计入结论(宁漏不误报),但 candidates 数看得出少了谁
      return null
    }
  }
  return { hits: collectHits(list, candidates, readFile, live), undetermined, candidates: candidates.length, files }
}

/** 便捷判据:某路径在 rev 里是否仍有引用。未判定时不冒充 `false`。 */
export function isReferencedInRev({ root, rev, path, timeout = DEFAULT_TIMEOUT_MS }) {
  const r = findReferencersInRev({ root, rev, paths: [path], timeout })
  const hits = r.hits.get(path) || []
  return {
    referenced: hits.length > 0,
    hits,
    undetermined: r.undetermined,
        }
}

export const __test__ = { SCAN_EXT, revFileList, grepInRev, findReferencersInRev, isReferencedInRev }
