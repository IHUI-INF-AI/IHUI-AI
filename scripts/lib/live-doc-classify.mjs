// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「一行丢了没有 / 丢了算什么」判据的**唯一实现**(纯函数,零副作用,零 git)。
 *
 * 为什么必须有这一层(2026-09-29 立):AGENTS §12 那条「提交活文档前必须做工作树 ⊇ HEAD
 * 行级对账」过去**只有散文、没有门** —— 而散文在本仓的失效形态永远是安静。新增的常驻判据
 * `scripts/check-live-doc-pathspec.mjs` 要问的是同一个问题("要被提交进去的那一份内容是否
 * 逐字含住 HEAD 已有的非空行,丢的那几行算什么"),如果它在门里另写一份"什么算丢了",
 * 就会出现两个都自洽的答案:归并器判 lost 而行不插回,或门判 stale 而归并器插回去 ——
 * §22c「两处算同一件事必漂移」正是这一族。所以实现从 `scripts/merge-live-doc.mjs` **搬**到这里,
 * 原文件改为一行转发(`export { classifyMissing, anchorKey } from './lib/live-doc-classify.mjs'`),
 * 对外符号名与行为一字不变。镜像测试有一道形状锁禁止第二份实现回来。
 *
 * 三态语义(与 merge-live-doc 自测的 ⑰/⑰b/⑰c/⑰d 四组夹具逐字同形,断言方向未改):
 *   lost       = 整行在候选面里真的不见了 ⇒ 唯一参与判红的一档(要归并/回补)
 *   superseded = 有人把这一行就地改写了   ⇒ **不得**插回,也不判红
 *   stale      = 候选面停在**更旧的前缀**(HEAD 侧翻了勾并追加了注记)⇒ 不判红、不插回,
 *                但必须喊出来:提交会把这一行退回旧形态,处置动作是人工取 HEAD 形态。
 * `classifyMissing` 只吃两侧的行数组,不碰 git、不碰磁盘 —— 取哪一面是调用方的事(见 face-reader)。
 */
import {
  CONTAIN_MIN,
  SIM_THRESHOLD,
  jaccard,
  squash,
  stripState,
  tokenize,
} from './live-doc-similarity.mjs'

const trim = (l) => String(l ?? '').trim()

/**
 * 登记锚点:这三份文档里「一件事一行」的写法都有稳定头部(`- **名称**` / `### 标题`),
 * 所以同一锚点在「HEAD 缺失集」与「候选独有集」里各出现**一次** ⇒ 那是就地改写,不是吃掉。
 *
 * 为什么必须有它(2026-09-25 实测):容器短路只管"HEAD 行逐字存活在更长的新行里",
 * 而改守门 84 那行时改的是**中段**,旧行并不逐字存活,长行大改后 Jaccard 又掉到阈值下 ⇒
 * 被判真丢失、跑 --apply 会把旧行原样插回 ⇒ 新旧两行并存,正是本仓已出现三次的重复登记行。
 * 唯一性是本条规则的生命线:锚点在任一侧出现不止一次 ⇒ 不猜,退回原判据(宁可多报一行,
 * 也不能把"整段登记被人删掉"洗成"他改写了")。
 */
export function anchorKey(line) {
  const s = trim(line)
  if (!s.length) return null
  let m = /^[-*]\s+\*\*(.{2,80}?)\*\*/.exec(s)
  if (m) return `B#${m[1].trim()}`
  m = /^#{2,4}\s+(.{2,140}?)(?=[(（:：—-]|$)/.exec(s)
  if (m) return `H#${m[1].trim()}`
  // 表格行:守门速查表就是「一行一件事」,行身份 = 前两格(编号 + 脚本文件名)。
  // 没有这一条,改写 README 里某道门的描述会被判成"真丢失"⇒ --apply 把旧的补齐空格那一行
  // 原样插回 ⇒ 同一个编号留下两行(本节上面那段讲的正是这个形态)。
  // 只认「第二格是个 ASCII 标识符形状」的行 ⇒ 分隔行 `| --- |` 与中文表头天然不匹配。
  m = /^\|\s*([^|]{1,40}?)\s*\|\s*([^|]{1,60}?)\s*\|/.exec(s)
  if (m && /^[\w.@\-]{2,60}$/.test(m[2].trim()) && /\w/.test(m[2].trim()))
    return `T#${m[1].trim()}|${m[2].trim()}`
  return null
}

/**
 * 给每个「HEAD 有而候选面无」的行定性 lost / superseded / stale。
 * @param headLines 基准面(HEAD blob)的行
 * @param candidateLines 要被提交/被审的那一份的行
 * @returns {Map<string,'lost'|'superseded'|'stale'>} 键 = trim 后的 HEAD 行
 */
export function classifyMissing(headLines, candidateLines, threshold = SIM_THRESHOLD) {
  const wtLines = candidateLines
  const wtSet = new Set(wtLines.map(trim).filter(Boolean))
  const headSet = new Set(headLines.map(trim).filter(Boolean))
  const localOnly = wtLines.map(trim).filter((t) => t.length > 0 && !headSet.has(t))
  const localTok = localOnly.map(tokenize)
  const localSquashed = localOnly.map(squash)
  const bump = (map, k) => {
    if (k) map.set(k, (map.get(k) || 0) + 1)
  }
  const localAnchor = new Map()
  for (const l of localOnly) bump(localAnchor, anchorKey(l))
  const missingAnchor = new Map()
  for (const raw of headLines) {
    const t = trim(raw)
    if (t.length && !wtSet.has(t)) bump(missingAnchor, anchorKey(t))
  }
  // 翻勾会改行首状态(`- [ ]（进行中）` → `- [x] ✅(日期)`),不剥掉它就永远"不逐字包含",
  // 于是把刚翻勾的那行判成真丢失、`--apply` 再插回一遍 —— 双态行就是这么造出来的。
  const localBare = localOnly.map((l) => squash(stripState(l)))
  const verdict = new Map()
  for (const raw of headLines) {
    const t = trim(raw)
    if (!t.length || wtSet.has(t)) continue
    const tt = tokenize(t)
    const sq = squash(t)
    const bare = squash(stripState(t))
    if (
      (sq.length >= CONTAIN_MIN && localSquashed.some((w) => w.includes(sq))) ||
      (bare.length >= CONTAIN_MIN && localBare.some((w) => w.includes(bare)))
    ) {
      verdict.set(t, 'superseded')
      continue
    }
    const ak = anchorKey(t)
    if (ak && localAnchor.get(ak) === 1 && missingAnchor.get(ak) === 1) {
      verdict.set(t, 'superseded')
      continue
    }
    /**
     * 第三种"不是丢"的形态:**候选那一行是 HEAD 同一行的更旧前缀**(翻勾 + 追加注记都发生在
     * HEAD 侧)。它既不满足容器短路(旧行不是新行的超集),大改时也会掉到 Jaccard 阈值之下,
     * 于是过去被并入 `superseded` —— 而 superseded 的语义是"别人改写了这行",这一种的语义是
     * "我这副本落后了,提交会把这行退回旧态"。两者处置动作不同,必须分开报。
     * 判据保守到只做**一条**、且方向唯一:剥掉勾选态后候选是 HEAD 的严格前缀 + 唯一候选 +
     * HEAD 已勾而候选未勾。任何一条不成立就退回原判据(宁可交人工,绝不把真删除洗成"旧态")。
     */
    if (/^- \[x\]/i.test(t)) {
      const cands = []
      for (let i = 0; i < localOnly.length; i++) {
        const w = localOnly[i]
        if (!/^- \[ \]/.test(w)) continue
        const wb = squash(stripState(w))
        if (wb.length >= CONTAIN_MIN && bare.length > wb.length && bare.startsWith(wb))
          cands.push(w)
      }
      if (cands.length === 1) {
        verdict.set(t, 'stale')
        continue
      }
    }
    let best = 0
    for (const lt of localTok) {
      const s = jaccard(tt, lt)
      if (s > best) best = s
    }
    verdict.set(t, best >= threshold ? 'superseded' : 'lost')
  }
  return verdict
}
