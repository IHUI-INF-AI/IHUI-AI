// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 内容型守门的共用底层:候选清单 + 同面取材 + 差值棘轮锚点(2026-10-23 立)。
 *
 * 为什么要有这一层:AGENTS.md §0.4 规定"全量档判 HEAD blob、`--staged` 判索引 blob、
 * `--worktree` 仅人工逃生舱,清单与内容同面同轮"。`./face-reader.mjs` 提供的是**原语**
 * (`catBatch` / `gitRaw` / 三态解析),每道内容门还要各自再写四件事:
 *   ① 用 `git grep` 预筛候选(退出码 1 = 合法零命中,其它 = 未判定);
 *   ② 清单与正文同面取材(取不到不回落另一个面);
 *   ③ `--staged` 档的"本次新增行号"集合;
 *   ④ 差值棘轮锚点 = 该文件 HEAD 面自身的命中数(rename 要跟旧路径取基线)。
 * 这四件事**每一件都有已记录的错法**(带 pathspec 问 name-status 会让 rename 支永远走不到;
 * `--diff-filter=ACM` 会把"改名+改内容"整档滤掉;清单取索引、内容读磁盘会"悬留替红顶绿")。
 * 2026-10-23 实测:同一套东西已在 `check-disk-root-write`(自带一份,其中④那一支因带 pathspec
 * 而是死的)、`check-no-divider`(第二份)里各写一遍 —— 第三份必然漂开,故收在这一层。
 *
 * 本层**只提供取材与棘轮骨架,不含任何业务判据**:判据由调用方以 `judge(rel, text) → 命中数|命中[]`
 * 的形式传入,锚点与读数因此天然同尺(同一函数、同一入参形状)。
 */
import { Undetermined, catBatch, gitRaw, readWorktreeFile } from './face-reader.mjs'

const GIT_TIMEOUT = 120_000

/**
 * ① 候选清单。`face`:
 *   - `head`   ⇒ `git grep <rev> HEAD`(HEAD blob,输出带 `HEAD:` 前缀,这里剥掉)
 *   - `staged` ⇒ `git grep --cached`(索引 blob)
 *   - `worktree` ⇒ `git grep`(工作树,未跟踪文件不在内 —— 人工档可接受,结论行须点名)
 * 退出码 1 = git 明说"无命中",那是合法的零候选;其它非零一律抛 `Undetermined`(不记绿也不冒红)。
 *
 * @param {{prefilterRe:string, pathspecs?:string[], roots?:string[], skipSegmentTest?:(seg:string)=>boolean, excludePublic?:boolean}} opts
 */
export function sourceCandidates(top, face, opts) {
  const {
    prefilterRe,
    pathspecs = [],
    roots = ['apps/', 'packages/'],
    skipSegmentTest,
    excludePublic = true,
  } = opts
  const revArgs =
    face === 'staged'
      ? ['grep', '--cached', '-I', '-l', '-E', prefilterRe]
      : face === 'worktree'
        ? ['grep', '-I', '-l', '-E', prefilterRe]
        : ['grep', '-I', '-l', '-E', prefilterRe, 'HEAD']
  const args = pathspecs.length ? [...revArgs, '--', ...pathspecs] : revArgs
  let out
  try {
    out = gitRaw(args, top, { timeout: GIT_TIMEOUT })
  } catch (e) {
    if (e instanceof Undetermined && e.status === 1) return []
    throw e
  }
  return String(out)
    .split(/\r?\n/)
    .map((p) => p.trim())
    .map((p) => (face === 'head' ? p.replace(/^HEAD:/, '') : p))
    .filter((p) => p.length > 0)
    .filter((p) => roots.some((r) => p.startsWith(r)))
    .filter((p) => !excludePublic || !p.split('/').includes('public'))
    .filter((p) => (skipSegmentTest ? !p.split('/').some(skipSegmentTest) : true))
}

/**
 * ② 同面取材。被审面(head / staged)取不到 ⇒ 抛 `Undetermined`,**绝不回落另一个面**;
 * `worktree` 档盘上缺文件(并发席正删着)只跳过并计数 —— 那是机器态,不是业务结论。
 * @returns {{texts:Map<string,string>, skippedMissing:string[]}}
 */
export function readSources(top, face, files) {
  const texts = new Map()
  const skippedMissing = []
  if (files.length === 0) return { texts, skippedMissing }
  if (face === 'worktree') {
    for (const rel of files) {
      const src = readWorktreeFile(top, rel)
      if (src === null) {
        skippedMissing.push(rel)
        continue
      }
      texts.set(rel, src)
    }
    return { texts, skippedMissing }
  }
  const pre = face === 'staged' ? ':' : 'HEAD:'
  const specs = files.map((p) => `${pre}${p}`)
  const got = catBatch(top, specs, { timeout: GIT_TIMEOUT, maxBuffer: 1 << 28 })
  for (let i = 0; i < files.length; i++) {
    const src = got.get(specs[i])
    if (src === null || src === undefined) {
      throw new Undetermined(
        `${face === 'staged' ? '索引' : 'HEAD'} blob 取不到 ${files[i]} ⇒ 该面无法判定(不冒红也不记绿)`,
      )
    }
    texts.set(files[i], src)
  }
  return { texts, skippedMissing }
}

/**
 * ③ `--staged` 档"本次提交新增的行号"集合(供"出现即拦"那族用)。
 * `--diff-filter` 必须带 **R**:只写 `ACM` 时"改名 + 改内容"整档从 diff 里消失(连 `+++ b/` 头
 * 都没有),那一档的门对改名页面整个失明(2026-10-23 实测,见 check-no-divider 头注)。
 * @returns {Map<string,Set<number>>}
 */
export function addedLineNumbers(top) {
  const result = new Map()
  let output
  try {
    output = gitRaw(['diff', '--cached', '-U0', '--diff-filter=ACMR', '--no-color'], top, {
      timeout: GIT_TIMEOUT,
      maxBuffer: 50 * 1024 * 1024,
    })
  } catch {
    return result
  }
  if (!output) return result
  let curFile = null
  let curLine = 0
  for (const raw of output.split('\n')) {
    if (raw.startsWith('+++ b/')) {
      const m = /^\+\+\+\s+b\/(.+)$/.exec(raw)
      curFile = m ? m[1] : null
      curLine = 0
      continue
    }
    if (raw.startsWith('diff --git')) {
      curFile = null
      curLine = 0
      continue
    }
    if (raw.startsWith('@@')) {
      const m = /@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/.exec(raw)
      curLine = m ? parseInt(m[1], 10) : 0
      continue
    }
    if (curFile && curLine > 0) {
      if (raw.startsWith('+') && !raw.startsWith('+++')) {
        if (!result.has(curFile)) result.set(curFile, new Set())
        result.get(curFile).add(curLine)
        curLine++
      } else if (raw.startsWith('-') && !raw.startsWith('---')) {
        // 删除行不推进新面行号
      } else {
        curLine++
      }
    }
  }
  return result
}

/**
 * `git diff --cached --name-status -M -z` 解析。**刻意不带 pathspec**:实测(git 2.56.0,
 * 2026-10-23)同一份改名,加上 `-- <新路径>` 之后 git 直接报 `A` —— 它看不见删除那一侧,
 * 于是"rename 基线跟旧路径"这一支永远走不到(守门 213 至今带着 pathspec,那一支是死的)。
 * @returns {Map<string,{status:string, old:string|null}>}
 */
export function stagedNameStatus(top) {
  const out = gitRaw(['diff', '--cached', '--name-status', '-M', '-z'], top, {
    timeout: GIT_TIMEOUT,
  })
  const map = new Map()
  const tokens = String(out).split('\0')
  let i = 0
  while (i < tokens.length) {
    const st = tokens[i]
    if (!st) {
      i += 1
      continue
    }
    if (/^[RC]/.test(st)) {
      const old = tokens[i + 1]
      const nw = tokens[i + 2]
      if (nw) map.set(nw, { status: st[0], old: old ?? null })
      i += 3
      continue
    }
    const p = tokens[i + 1]
    if (p) map.set(p, { status: st[0], old: null })
    i += 2
  }
  return map
}

/**
 * ④ 差值棘轮锚点:每个候选文件在 **HEAD 面**自身的命中数。
 * `countOf(rel, text)` 必须与本轮读数**同一个函数**(§22c:判据不得在锚点侧另写一份)。
 * 新文件基线 0;rename 基线从旧路径带;两者都证明不了 ⇒ `Undetermined`
 * (不拿"当成新文件"冒红,也不拿"取不到"当 0)。
 * @returns {Map<string,number>}
 */
export function headAnchors(top, files, countOf) {
  const anchor = new Map()
  if (files.length === 0) return anchor
  const specs = files.map((r) => `HEAD:${r}`)
  const got = catBatch(top, specs, { timeout: GIT_TIMEOUT, maxBuffer: 1 << 28 })
  let status = null
  const pendings = []
  for (const rel of files) {
    const src = got.get(`HEAD:${rel}`) ?? null
    if (src !== null) {
      anchor.set(rel, countOf(rel, src))
      continue
    }
    status = status || stagedNameStatus(top)
    const st = status.get(rel)
    if (st && st.status === 'A') {
      anchor.set(rel, 0) // 新文件基线 0(不是取材失败)
      continue
    }
    if (st && st.old) {
      pendings.push({ rel, old: st.old })
      continue
    }
    throw new Undetermined(
      `HEAD blob 取不到 ${rel} 且 name-status 既不判 A 也不判 rename ⇒ 无法判定(不冒红也不记绿)`,
    )
  }
  if (pendings.length > 0) {
    const ospecs = pendings.map((p) => `HEAD:${p.old}`)
    const ogot = catBatch(top, ospecs, { timeout: GIT_TIMEOUT, maxBuffer: 1 << 28 })
    for (const p of pendings) {
      const osrc = ogot.get(`HEAD:${p.old}`) ?? null
      if (osrc === null) {
        throw new Undetermined(`rename 基线源 HEAD blob 取不到 ${p.old}(${p.rel}) ⇒ 无法判定`)
      }
      anchor.set(p.rel, countOf(p.old, osrc))
    }
  }
  return anchor
}

/**
 * 把"读数 vs 锚点"折成每文件的超额数(差值棘轮的算术部分,纯函数)。
 * 判据是**计数**,点名是**取证**:超出基线多少条只数得出来,落点仍要逐行给。
 * @returns {Map<string,number>}
 */
export function overBaseline(reads, anchor) {
  const out = new Map()
  for (const [rel, n] of reads) out.set(rel, Math.max(0, n - (anchor.get(rel) ?? 0)))
  return out
}

export const __test__ = {
  sourceCandidates,
  readSources,
  addedLineNumbers,
  stagedNameStatus,
  headAnchors,
  overBaseline,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
