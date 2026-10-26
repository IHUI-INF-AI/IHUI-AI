// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ledger-closed-rows.mjs —— 「已结清行不回退」判据(2026-10-25 立)。
 *
 * 立因(已取证,不是推测):16:25 那枚 `chore(auto)` 把一份**滞后工作树副本**收编进历史,
 * 让 16:0x 已入库的四条结清(H04/O02/G-03 的 `- [x] ✅(2026-10-25/主会话结算)`)回到 `- [ ]`。
 * `auto-commit-quiet` 原有四道护栏都漏这一型:
 *   · dropStaleCopies 只认"工作树逐字节等于某祖先 blob";混合体(旧副本 ⊕ 本地小改)不等于任何祖先;
 *   · merge-live-doc 只判丢行/长行重复,判不出"已有行原地被翻回未勾"(行数不变、一行不丢);
 *   · scrub-declared-removals 只吃声明式摘除清单,清单没声明的回退看不见;
 *   · 归档单调性只管 ✅ 标题的复活,不管勾选态。
 *
 * 判据:同一份台账,按**复合主键**(编号 + 标题前缀,`compositeKeyOf` 单源)取两面各自的
 * 「已勾登记行」集(实现直接 import 守门 `check-plan-closed-stock.mjs` 的 `closedRowsOf`,
 * §0.6 单一真相源:不许在这里抄第二份"什么算同一件事")。
 * HEAD 面上任一已结清主键,在候选里既没有同主键已勾行(⇒ 被写回 `- [ ]`)也没有任何残留
 * (⇒ 整行消失) ⇒ 该主键判**回退**。
 *
 * 失效方向(fail-closed):HEAD/候选任一取不到、为空串或解析异常 ⇒ `undetermined=true`,
 * 调用方必须当"本文件本轮不收编"处理 —— 方向与 merge-live-doc 的 fail-closed 一致:
 * 宁可悬挂一轮,也不让一条已结清的账悄悄退回未做(机主令:完成即删,不回退)。
 *
 * 两型回退源与覆盖边界(2026-10-25 两起实测,根因写在这里,不留给下一个人重查):
 *   ① **混合体**(旧副本 ⊕ 本地小改):整份文本不等于任何祖先 blob ⇒ `dropStaleCopies` 的
 *      "工作树逐字节 == 某祖先 blob" 判据**结构上够不着**。16:25 那枚 `chore(auto)` 收编的
 *      PROJECT_PLAN.md 是 blob 17c21a31…,在其父链最近 13 枚动过该路径的提交里没有任何同值 ——
 *      所以那次不是"守卫没走到",而是"这型它判不了"。把该枚提交与它的父提交两枚**真实 blob**
 *      喂进本判据复算(只读 git show,不写仓):父面 7 个已结清主键里 4 个在候选里回退/消失
 *      (G-03/O02/H04/G-46)⇒ 红。本闸按复合主键判**勾选态**,这一型必拦。
 *   ② **整份旧 blob 覆盖**(工作树被某器物整份写回某个祖先版本):逐字节相等 ⇒ `dropStaleCopies`
 *      能拦(2026-10-25 17:07/17:09 两轮 dry-run 日志均见「跳过滞后副本:PROJECT_PLAN.md」)。
 *      但它的射程有两条硬边界:只审**未暂存**文件(索引态 `M ` 被当"明确意图"放过)、只回溯
 *      最近 6 枚动过该路径的提交。本闸不吃这两条:只要旧副本里有一条 HEAD 已结清的行被翻回
 *      未勾或抹掉就拦;不含任何已结清行回退的旧副本(例如只回退了新增注记/措辞)仍归
 *      `dropStaleCopies` 管 —— 两闸互补,不是替代。
 */
import { closedRowsOf } from '../check-plan-closed-stock.mjs'

/** 空串/取不到一律不可判:整份台账被清空既可能是灾难也可能是事故,不得读成"没有已勾行"。 */
function usableText(text) {
  return typeof text === 'string' && text.trim() !== ''
}

/**
 * 已结清行回退判定(纯函数;镜像测试直接 import 本出口,§22c)。
 * @param {string|null} headContent HEAD blob 文本(`HEAD:<台账>`)
 * @param {string|null} candidateContent 候选文本(归并/复洁之后、即将入库的那一份)
 * @returns {{ok:boolean, undetermined:boolean, regressions:Array<{key:string,line:number,raw:string}>, headClosed:number, candidateClosed:number}}
 */
export function closedRowRegressions(headContent, candidateContent) {
  const blank = {
    ok: false,
    undetermined: true,
    regressions: [],
    headClosed: 0,
    candidateClosed: 0,
  }
  if (!usableText(headContent) || !usableText(candidateContent)) return blank
  const head = closedRowsOf(headContent)
  const cand = closedRowsOf(candidateContent)
  if (head === null || cand === null) return blank
  const regressions = []
  for (const [key, rows] of head) {
    // 候选仍有同主键已勾行 ⇒ 这条结清没回退(追加注记不改键,见 compositeKeyOf 的题面截断)。
    if (cand.has(key)) continue
    for (const r of rows) regressions.push({ key, line: r.line, raw: r.raw })
  }
  return {
    ok: regressions.length === 0,
    undetermined: false,
    regressions,
    headClosed: head.size,
    candidateClosed: cand.size,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
