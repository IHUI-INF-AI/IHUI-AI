// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 台账行内标头 = 侧车的**投影**(2026-10-22 立,规格 §3)。
 *
 * 渲染与解析必须是同一份实现:两处各写一遍字符串拼接,迟早漂成"一边写得出、另一边读不回",
 * 而那时红的是门、错的是格式。标头形态(前缀 `归:`、分隔符 `｜`、顺序 归→等)是**契约**不是风格。
 *
 * 权威在侧车,标头只负责"人一眼看得懂"。因此:
 *  - 超预算只截断显示中的 owner,等段一定保住(丢了"在等什么"就等于把这行退回不可判);
 *  - parse 遇到截断省略号一律报 `malformed` 而**不猜**被截掉的字符(§0.3:"没判"不许写成"判过");
 *  - 只有 `归:` 开头且位于登记行复选框之后的那一段才算标头,反引号内的举例不算(复用单源码段尺子)。
 *
 * 同一复合键在侧车里有多条时,"投影取哪一条"**必须是显式裁决而不是读取顺序的副产品**(2026-10-24 立):
 *  - 本层原先只认一条记录(`renderHeader(rec)`),而"谁算那一条"住在 `lib/plan-fields.mjs` 的
 *   `loadFields`(按 `updatedAt` 最新胜出)—— 那是**写入时刻**,不是归属权威;同键两条读数不同
 *   (实测 `G-41#围栏只判…`:`持有人` 与 `mcp_unscoped_exit 围栏持有人`)时,隐式胜出者会让
 *   派单口径随读取面翻脸,而账面(门 234 A2)仍说"一致 0 枚"。
 *  - 现在由 `resolveSidecar()` 一处把这件事说明白:同键多条且**投影读数不同** ⇒ 输出
 *   `〔归:未判定〕`(失效方向 = 多要一次定向说明,绝不是蒙一条,§0.3/铁律 10);
 *   同键多条但读数逐字相同(抽取器重跑只换 `updatedAt` 的那种同义追加)⇒ 照旧正常投影,不制造噪声;
 *   单条记录 ⇒ 输出与改动前 `renderHeader(rec)` 逐字节相同(阳性对照由镜像测试钉住)。
 */
import { locateSidecarHeader, stripSidecarHeader } from './plan-task-index.mjs'

export const MAX = 48
const OPEN = '〔'
const CLOSE = '〕'
const SEP = '｜'
const OWNER_PREFIX = '归:'
const WAIT_PREFIX = '等:'
const NO_OWNER = '—'
/** 同键矛盾时的归属占位读数:它必须能被 parseHeader 读回(否则"未判定"自己就成了新的 malformed)。 */
export const UNJUDGED_OWNER = '未判定'
export const UNJUDGED_HEADER = OPEN + OWNER_PREFIX + UNJUDGED_OWNER + CLOSE

/** 标头两段的唯一算法(渲染与"是否矛盾"共用一份实现,分家必漂)。 */
function headerParts(rec) {
  const owner = String(rec.owner ?? '').trim() || NO_OWNER
  const blocking = String(rec.blocking ?? '').trim()
  const waitSeg = rec.waiting && rec.waiting !== 'none' && blocking ? WAIT_PREFIX + blocking : ''
  return { owner, waitSeg }
}

/**
 * 侧车记录 → 标头(不含标头时为 '')。
 *
 * **不得截断**(2026-10-25 修,治"投影写得出、解析读不回"):旧实现按 MAX 截断并追加 `…`,
 * 而 parseHeader 对含 `…` 的一律报 malformed(方向本身是对的 —— 截断后的 owner 无法充当权威)。
 * 两者叠在一起 ⇒ 任何 owner 长度逼近上限的记录投影进台账后**永久**是 malformed:
 * 门 234 A2 当场判红,而投影器物每次都会写出这种行(实测 G-47/G-71 等 3 行)。
 * 标头是投影,投影必须无损;显示宽度(MAX)只用于诊断文案的 clip,不再参与渲染。
 */
export function renderHeader(rec) {
  if (!rec) return ''
  const { owner, waitSeg } = headerParts(rec)
  const parts = [OWNER_PREFIX + owner]
  if (waitSeg) parts.push(waitSeg)
  return OPEN + parts.join(SEP) + CLOSE
}

/**
 * 一条记录的**投影读数身份**(未截断)。两条记录读数相同 ⇒ 它们在标头这一面上是同一件事;
 * 不同 ⇒ 同键矛盾。用未截断值比,是为了"两个长 owner 截到同一前缀"不被读成一致。
 */
export function projectionReading(rec) {
  const { owner, waitSeg } = headerParts(rec)
  return JSON.stringify([owner, waitSeg])
}

/**
 * 同一复合键的 N 条侧车记录 ⇒ 显式投影裁决。返回 `{ n, readings, conflict, header }`:
 *  - `n` = 参与投影的记录条数(0 ⇒ `header=''`,即"这条键位什么都没有");
 *  - `readings` = 去重排序后的投影读数(给门当棘轮签名用,与记录条数无关);
 *  - `conflict` = 读数 >1 个 ⇒ 归属不可判,**不许挑一条**；
 *  - `header` = conflict 时 `〔归:未判定〕`,否则与 `renderHeader(第一条)` 逐字相同。
 */
export function resolveSidecar(records) {
  const list = (Array.isArray(records) ? records : records ? [records] : []).filter(Boolean)
  if (list.length === 0) return { n: 0, readings: [], conflict: false, header: '' }
  const readings = [...new Set(list.map(projectionReading))].sort()
  const conflict = readings.length > 1
  return {
    n: list.length,
    readings,
    conflict,
    header: conflict ? UNJUDGED_HEADER : renderHeader(list[0]),
  }
}

/** 行 → 标头语义。`malformed` = 看见了但读不回(要人看),`rec=null ∧ malformed=false` = 没有标头。 */
export function parseHeader(line) {
  const text = String(line ?? '')
  // 定位单源 = plan-task-index.locateSidecarHeader(strip 与门的 headerOf 同一把尺,§0.6):
  // 复选框后第一个 codeSpan 外的 `〔归:…〕` 段。这里不再自写一份 `/〔…〕/` 定位。
  const span = locateSidecarHeader(text)
  if (!span) return { rec: null, malformed: false }
  const body = text.slice(span.start + 1, span.end - 1)
  if (body.includes('…')) return { rec: null, malformed: true }
  const fields = { key: null, owner: '', waiting: 'none', blocking: '' }
  // 分隔符只在**下一段真像槽名**时才算分隔符:owner 自带 `｜`(如 `A｜B`)若按裸 `｜` 切,
  // 会切出一个无冒号的段而误报 malformed —— 而那是合法的 owner,不是坏标头。
  const segSplit = /\｜(?=[^｜〕]{1,4}:)/
  for (const seg of body.split(segSplit)) {
    const i = seg.indexOf(':')
    if (i < 0) return { rec: null, malformed: true }
    const k = seg.slice(0, i).trim()
    const v = seg.slice(i + 1).trim()
    if (k === '归') fields.owner = v === NO_OWNER ? '' : v
    else if (k === '等') {
      // 等段 '—' 是投影占位(= 无等待),不是等待对象(2026-10-25 修,与 dispositionOf
      // 标头补判的同型同日批:占位当等待 = 把"没有等待"读成"在等",实测 4 行投影行
      // 被读回 waiting-env 而侧车是 none ⇒ A2 永久红)。
      if (v !== '—') {
        fields.waiting = 'env'
        fields.blocking = v
      }
    } else return { rec: null, malformed: true }
  }
  return { rec: fields, malformed: false }
}

/** 剥掉本层生成的那一段;其它括号(注记、正文)一字不动。
 *  实现已下移到 `plan-task-index.stripSidecarHeader`(判定层也必须剥它,两处各写一份会漂),此处只留出口名。 */
export const stripHeader = stripSidecarHeader

/** 投影自检:无标头 = true(不是失败);有标头但读不回 = false。 */
export function roundTripOk(line) {
  const p = parseHeader(line)
  if (p.malformed) return false
  if (!p.rec) return true
  const again = renderHeader(p.rec)
  return again === '' || String(line).includes(again)
}

export const __test__ = {
  renderHeader,
  parseHeader,
  stripHeader,
  roundTripOk,
  projectionReading,
  resolveSidecar,
  MAX,
  UNJUDGED_OWNER,
  UNJUDGED_HEADER,
  locateSidecarHeader,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
