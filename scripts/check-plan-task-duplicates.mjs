#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 194 —— 台账"同题多号"检测(2026-10-13 立,根治同题跨号漂移)
 *
 * 根因链(机主 2026-10-13 拍板根治):
 *   ① 取号令牌 {{NEXT_ID}} 只查"号是否空闲",不查"题是否已登记" ⇒ 并发取号撞号后
 *      让号重登,每次重登都是一份新副本;
 *   ② union 并集合并把"两侧各自的旧态副本"当成各自独有整批带回(G-461);
 *   ③ F4 逐字等值判据抓不住"正文有漂移的同题副本"(G-1104165) ⇒ 同题不同号永久漂移,
 *      派单口径被同题多行灌水,"任务永远做不完"。
 *
 * 判据:对每条未勾登记行提取"标题指纹"(归一化:去编号引用/日期/注记段/空白/标点),
 *
 * ⚠️ 2026-10-16 增第三类「无号同题」:原分组条件要求 `distinctIds.size > 1`,而带**未解析取号令牌
 * 字面量**(裸写 {{NEXT_ID}} 不带族后缀 ⇒ 取号器不消费,原样入库)或干脆没编号的行 `selfId=∅`
 * 会被 `filter(Boolean)` 滤掉,整组恒看不见 —— 台账里同题多份副本可以长期存在而本门报 0 组,
 * 派单清单却把每一份都发出去(实测:GA7 两票在 HEAD 面各 3 份;`--ratchet` 现读锚点 94 组/307 行,
 * 全是存量,新增 0 ⇒ 加这一类不造恒红门,§12e 前置成立)。混合组(有号 + 无号)仍归"同号多行"(F4 地盘)。
 * 注:`scripts/guardian-runner.mjs` 里本门条目写的"--self-test(N 例)"随用例增删会过期,2026-10-19 已对齐现读数;
 * 该数每轮都可能再变,故以本门 `--self-test` 的**自印末行**为准(凡数字现读,§0.1)。
 * 指纹相同且票号不同的行 ⇒ "同题多号"组。指针行(〔【归并】开头,自述不再单独派单)
 * 不算独立任务,豁免。已勾行随归档走,不在本门视野。
 *
 * 档位:默认档只报数(存量先清偿,避免恒红门逼人 --no-verify);--strict 判红(exit 1)。
 * 配套:取号器(live-doc-edit {{NEXT_ID}} 展开处)发号前调 extractTaskFingerprint
 * 查重,命中同题拒发号(2026-10-13 同批接线)。
 * 跳过:HUSKY_SKIP_PLAN_DUP_TITLE=1(慎用:跳过即放行同题漂移回潮)。
 *
 * **差值棘轮 `--ratchet`(2026-10-13 补,提交链那一半)**:锚点 = `HEAD:PROJECT_PLAN.md`
 * 的同题组,候选面 = `--staged`(索引 blob,本次提交真会带走的那一份;`--worktree` 供人工)。
 * 判据是**成员键计数**(指纹 \t 自持号)只许变少、不许变多:候选里出现锚点没有的成员键
 * ⇒ 那一行是这次写进来的 ⇒ 判红并逐条点名;存量组只报数。计数而**不是"组数"**:组内多挂
 * 一个新号、或新增一整组,在计数维上都是"变多",而组数对"清一组 + 新增一组"恒绿。
 * 取材一律走 `scripts/lib/face-reader.mjs`(与守门 52/80/118 同一条取面纪律),
 * 取不到面 ⇒ exit 2 拒绝出合格证,不回落、不记绿。
 */
import { Undetermined, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { matchBalancedGroupAt } from './lib/plan-task-index.mjs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
export const LEDGER_NAME = 'PROJECT_PLAN.md'
/** 面名的中文标签(报错与结论行都要写明量的是哪一面 —— 换面即换读数,不标就是让人照错的数派单)。 */
export const FACE_TXT = { head: 'HEAD blob', staged: '索引 blob', worktree: '工作树' }

/**
 * 剥掉成对括号包裹的注记段(默认 `〔…〕`)。**括号配平**,不是 `[^〕]*` 那种非嵌套正则。
 *
 * 为什么必须配平(2026-10-19 实测):台账里存在真嵌套的注记
 * (`〔副本正文并入·承载整段:X〔副本正文并入·承载整段:X〔改号(…):原G-1038307〕〕〕`),
 * 非嵌套正则在第一个内层 `〕` 就收尾,剥完剩下孤儿 `〕`,并把折叠叙述暴露进标题,
 * 于是"同一件事的多种书写形态"算出互不相等的指纹 —— 这正是同题副本折不掉的那一格。
 *
 * 配平用的是 `lib/plan-task-index.mjs` 的 `matchBalancedGroupAt`(仓里唯一实现,§22c 不另抄)。
 * **配不平时原样保留该开括号并继续扫**(宁可少剥一段,也不从行里吃掉内容);
 * 收尾若仍剩孤儿闭括号,一并去掉 —— 它是上面剥剩下的残渣,不是内容。
 */
export function stripNoteGroups(s, opener, closer) {
  const pairs = { [opener]: closer }
  let out = ''
  let i = 0
  while (i < s.length) {
    if (s[i] === opener) {
      const end = matchBalancedGroupAt(s, i, pairs)
      if (end < 0) {
        out += s[i]
        i += 1
        continue
      }
      i = end // 整段丢掉
      continue
    }
    out += s[i]
    i += 1
  }
  return out.replaceAll(closer, '')
}

/**
 * 剥掉行首的「括注形状态/租约状语」(`（进行中@…）` / `（认领已释放@…:(嵌套括号)）` / `(待派)`)。
 *
 * 2026-10-20 立:这类括注是**元数据**,不承载任务身份。不剥的实测后果 —— 同一段租约下面挂着
 * 两件不同任务(`…goal-r81…） G-6 「四项…` 与 `…goal-r81…） G-460 **门 130…**`),标题取到
 * 破折号前的整段租约,60 字符截断后两行**指纹撞车**,折叠层把 G-6 折进 G-460(靠
 * `attestFoldPair` 的注记守恒才拦住,否则就是一次静默吞并)。配平沿用仓里唯一实现,配不平
 * (开括号没有对应闭括号)时原样保留 —— 宁可少剥一段,也不从行里吃掉内容。
 */
function stripLeadingStatusParens(s) {
  const pairs = { '（': '）', '(': ')' }
  let out = s.replace(/^\s+/, '')
  for (;;) {
    const ch = out[0]
    if (ch !== '（' && ch !== '(') return out
    const end = matchBalancedGroupAt(out, 0, pairs)
    if (end < 0) return out
    out = out.slice(end).replace(/^\s+/, '')
  }
}

/**
 * 剥掉**行尾**的「括注形状态/释放状语」(`（进行中@…）` / `（认领已释放@…）`)。
 *
 * 2026-10-22 立:租约改写器把释放印**追加在行尾**(`strip-stale-claim-marks.mjs` 的 rowAfter 形态),
 * 而 `stripLeadingStatusParens` 只认行首 ⇒ 同一行的「改写前(带租约)」与「改写后(带释放印)」
 * 在 60 字符指纹窗口里差出最后几个字 ⇒ 指纹不相等,两个消费方同时失明:
 *   ① union 归并的同题折叠(`dedupeByFingerprint`)折不动 ⇒ 两侧形态各留一份 = F4 副本;
 *   ② `plan-pointer-purge` 的 famKey 分不到一族 ⇒ 清偿器看不见它(F4 永不清零)。
 * 实测样本(2026-10-22,HEAD 面唯一 F4 组):`59. 消息级版本切换` 两行,一行尾
 * `（进行中@2026-10-18/…）`、一行尾 `（认领已释放@2026-10-22/…）`,指纹只差一个「认」字。
 * 只剥**状态状语本义**的括注(`认领已释放@` / `进行中` / `进行中@`);括号里带别的散文一律不碰
 * (与 `stripLeadingStatusParens` 同一保守口径:配不平就原样保留,宁可不剥一段)。
 */
function stripTrailingStatusParens(s) {
  let out = s.replace(/\s+$/, '')
  for (;;) {
    const last = out[out.length - 1]
    if (last !== '）' && last !== ')') return out
    const openCh = last === '）' ? '（' : '('
    let depth = 0
    let i = out.length - 1
    for (; i >= 0; i--) {
      if (out[i] === last) depth++
      else if (out[i] === openCh) {
        depth--
        if (depth === 0) break
      }
    }
    if (i < 0) return out
    const inner = out.slice(i + 1, out.length - 1)
    if (!/^(?:认领已释放@|进行中(?:@|$))/.test(inner)) return out
    out = out.slice(0, i).replace(/\s+$/, '')
  }
}

/**
 * `idx` 之前还压着几层未闭合的圆括注(全角与半角同视)。用途只有一件:
 * 选标题粗体时要跳过**括注内部**的强调词(见 `extractTaskFingerprint` 内那条 2026-10-20 修)。
 * 深度算不平(少写一个右括号)时按"仍在括注内"处理 ⇒ 宁可不换选择,也不把行尾叙述当成标题。
 */
export function parenDepthBefore(s, idx) {
  let d = 0
  const limit = Math.min(idx, s.length)
  for (let i = 0; i < limit; i++) {
    const c = s[i]
    if (c === '（' || c === '(') d += 1
    else if (c === '）' || c === ')') d = d > 0 ? d - 1 : 0
  }
  return d
}

/** 指纹提取:从登记行提取归一化标题指纹(导出供取号器与镜像测试复用,§22d) */
export function extractTaskFingerprint(line) {
  if (typeof line !== 'string') return null
  let s = line.trim()
  if (!/^- \[[ x]\]/.test(s)) return null
  // 指针行/租约残行:自述不再单独派单,不算独立任务。
  // 覆盖形态:行首〔【归并】/【【归并】/（【归并】,以及状语在前(如 (待派/XX)〔【归并】…)的行内归并注记
  if (/^-\s*\[[ x]\]\s*[〔（【]{0,2}\s*【归并】/.test(s)) return null
  if (/【归并】(重复登记副本|同题多号收拢)/.test(s) && /不再单独派单|让号|派单以那条为准|派单以持有行为准/.test(s)) return null
  // 去行首 checkbox
  s = s.replace(/^-\s*\[[ x]\]\s*/, '')
  // 去前置状语:(进行中@...)/(待派/XXX)/✅(date) 等
  s = s.replace(/^[（(【\[]?(进行中|待派|已完成|✅)[^】）)〕\]]*[】）)〕\]]?\s*/g, '')
  s = s.replace(/^✅\(\d{4}-\d{2}-\d{2}\)\s*/, '')
  // 行首括注形状语(租约/状态)不参与身份 —— 判据与立因见 stripLeadingStatusParens 头注。
  s = stripLeadingStatusParens(s)
  // 行尾释放印/租约状语同理(2026-10-22):改写器把释放印追加在行尾,不剥会让
  // 「改写前/改写后」两种形态算出互不相等的指纹 ⇒ union 折不动、purge 分不到族。
  s = stripTrailingStatusParens(s)
  // 去注记段(〔…〕)——注记是进度/归并留痕,不参与身份。
  // 2026-10-19 修:原实现是 `/〔[^〕]*〕/g`,**非嵌套**。台账里真实存在的形态是嵌套的
  // (`〔副本正文并入·承载整段:…〔副本正文并入·承载整段:…〔改号(…):原G-1038307〕〕〕`),
  // 非嵌套正则在第一个内层 `〕` 就收尾,剥完剩下孤儿 `〕`,并把折叠叙述
  // `(原编号 68;持有行题面「…」)` 暴露进标题 ⇒ 同一件事的多种书写形态算出互不相等的指纹。
  // 改用仓里既有的括号配平实现(§22c 不另抄一份);配不平时**原样保留该字符**继续扫,
  // 宁可少剥一点也不把内容从行里吃掉。
  s = stripNoteGroups(s, '〔', '〕')
  // 提取标题段:标题=粗体内文本;粗体恰是票号时取其后至"——"前;无粗体取票号后至"——"前
  // (尾巴"—— 详情/取证…"是各会话各自写的进度叙述,不参与身份)
  //
  // 〔2026-10-20 修:标题粗体必须取**第一个不在括注里的**,不是第一个 `**` 对〕
  // 登记行有一大族写成 `- [ ] G-16（等守门 128 持有人拍两件事的**取舍**;两格都是…）
  // **门 128 的 SL 维有两格判据缺口:…** —— 派单前提括注里带强调粗体,于是"取第一个粗体对"
  // 拿到的是括注内的强调词(`取舍` 两个字 ⇒ 权重 4 ⇒ 过 `weight < 16` 那道门槛 ⇒ 恒 null)。
  // HEAD 面现读:66/332 条未勾登记行算不出指纹,其中**同一件事挂在两个编号上的副本有 7 组**
  // 因此对本门完全隐形(上面那对 G-16 / G-815424 就是本桶里的一枚)—— 本门的差值棘轮正是拦
  // "重复登记"的,看不见就等于没闸,而派单清单会把两份都发出去(§1 记过的"打架重复做"机器成因)。
  // 只在"有括注内粗体"这种冲突时改变选择;无括注包裹的行,选出的粗体与改前逐字同一个
  // (镜像对本条有正反两向对照)。
  const boldAll = [...s.matchAll(/\*\*([^*]+)\*\*/g)]
  const outsideParen = boldAll.filter((m) => parenDepthBefore(s, m.index) === 0)
  const bold = outsideParen.length ? outsideParen[0] : boldAll[0]
  // 标题粗体必须出现在**行首区**(2026-10-20 修第二刀):粗体之前只允许"票号/取号令牌 + 括注状语"
  // 与空白,不该出现任何裸散文。上一版用「粗体在第一个破折号之前」判断,对 G-425 这类
  // 「标题是散文、破折号落在正文中段」的行仍然误判:正文强调 `**没有**` 在破折号前 21 字符
  // ⇒ 被当成标题 ⇒ weight 4 ⇒ null,于是同题两态(`[ ]`/`[x]`)恒折不动,归并后 F1 报
  // 「同主键两态并存(组)」。现行口径把粗体前的括注(含租约/状态状语)与票号剥干净后,
  // 仍有裸文本 ⇒ 该粗体是正文强调,退回"破折号前那段"这条既有口径。
  let boldLead = bold ? s.slice(0, bold.index ?? 0) : ''
  for (let k = 0; k < 10; k++) {
    const before = boldLead
    boldLead = boldLead
      .replace(/\{\{NEXT_ID\}\}/g, '')
      .replace(/[A-Z]-?\d+/g, '')
      .replace(/【[^】]*】|〔[^〕]*〕|（[^）]*）|\([^)]*\)|\[[^\]]*\]/g, '')
    if (boldLead === before) break
  }
  const boldIsTitle = !!bold && boldLead.replace(/[\s\p{P}\p{S}]+/gu, '') === ''
  let title = ''
  if (boldIsTitle) {
    if (/^[A-Z]-?\d+/.test(bold[1].replace(/[.。:：\s]/g, ''))) {
      const after = s.slice((bold.index ?? 0) + bold[0].length)
      // 2026-10-19 修(真值陷阱,本门此前的"整格失明"根因):原写法 `split(...)[0] || bold[1]`。
      // 登记行的主流写法是 `**G-933 冷启动…** —— 盘点口径(…)`,粗体后有一个空格再跟破折号,
      // 于是 `split()[0]` 等于**单个空格 `' '`** —— 它是真值 ⇒ `|| bold[1]` 兜底永不触发
      // ⇒ title 变成空白 ⇒ 归一化后权重 0 ⇒ `:88 weight < 16` 判 null。
      // 实测后果:HEAD 面 125 条登记行因此算不出指纹(修后 72),其中 G-933 / W4-W7 / D690
      // 三组同题副本**两行的粗体逐字相同却各自 null**,于是 `dedupeByFingerprint` 折不掉、
      // 派单口径把它们算成两件活。语义上要的是"破折号前若只剩空白,退回粗体本身"。
      const seg = after.split(/——|--/)[0]
      title = seg && seg.trim() ? seg : bold[1]
    } else {
      title = bold[1]
    }
  } else {
    title = s.split(/——|--/)[0]
  }
  // 归一化:小写、去编号引用、去日期、去空白与标点差异
  title = title.toLowerCase()
  title = title.replace(/[a-z]{1,3}-?\d{2,}/g, '') // 编号引用 G-123/G-99/D1047/O86…
  title = title.replace(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/g, '') // 日期
  title = title.replace(/[\s\p{P}\p{S}]+/gu, '') // 空白+标点+符号
  // 长度门槛:按"有效权重"算(中日韩字符权重 2,其余 1)——中英文标题量纲统一
  let weight = 0
  for (const ch of title) weight += /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(ch) ? 2 : 1
  if (weight < 16) return null // 过短指纹不可靠,不参与对账
  return title.slice(0, 60)
}

/**
 * 非登记行(正文粗体条目)的"题面"键:取 `- **题面**…` 的粗体内文本并归一(去日期/标点/空白)。
 *
 * 立因(2026-10-28 实测):清扫器留痕回捞腿的档②问 a「同题形态是否仍在被审面」只认
 * `extractTaskFingerprint`,而该函数对非登记行**一律返回 null** ⇒ 正文条目一旦在提交里被
 * 就地改短(实测 `319a35025fc7`:761 字版被同题 244 字版替换,粗体逐字相同),判据算成
 * 「非登记行丢失」⇒ 回捞腿整轮 undetermined ⇒ 完成即删清扫停摆。
 * 归一与权重门槛与指纹同口径(中文字符权重 2,< 16 不可靠 ⇒ null),但**只认行首粗体**:
 * 正文里的强调词(`**零会话端点证据**`)不作题面。
 * 登记行返回 null(它们走 extractTaskFingerprint,不在此另立一套)。
 */
export function bulletTitleKey(line) {
  if (typeof line !== 'string') return null
  const s = line.trim()
  if (/^- \[[ x]\]/.test(s)) return null
  const m = /^-\s*\*\*([^*]+)\*\*/.exec(s)
  if (!m) return null
  let title = m[1].replace(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/g, '')
  title = title.replace(/[\s\p{P}\p{S}]+/gu, '')
  let weight = 0
  for (const ch of title) weight += /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(ch) ? 2 : 1
  if (weight < 16) return null // 与指纹同门槛:过短(如"补充")会跨条目乱撞
  return title.slice(0, 60)
}

/** 从台账全文找同题多号组(导出供镜像测试复用) */
export function findDuplicateGroups(content) {
  const byFp = new Map()
  const lines = String(content ?? '').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (!/^- \[ \]/.test(raw)) continue // 只审未勾行
    const fp = extractTaskFingerprint(raw)
    if (!fp) continue
    const ids = [...raw.matchAll(/\b([A-Z])-(\d{2,})\b/g)].map((m) => `${m[1]}-${m[2]}`)
    const selfId = ids[0] ?? null
    if (!byFp.has(fp)) byFp.set(fp, [])
    byFp.get(fp).push({ line: i + 1, selfId, preview: raw.slice(0, 120) })
  }
  const groups = []
  for (const [fp, members] of byFp) {
    const distinctIds = new Set(members.map((m) => m.selfId).filter(Boolean))
    // 同题且票号不同(或同号多行——那归 F4/F10,本门只管跨号)
    if (members.length > 1 && distinctIds.size > 1) {
      groups.push({ fingerprint: fp, members, distinctIds: [...distinctIds], kind: 'cross-id' })
      continue
    }
    // 第三类(2026-10-16 立):**整组一行号都取不出** —— 带未解析取号令牌字面量(裸写 {{NEXT_ID}}
    // 不带族后缀,取号器不消费 ⇒ 原样入库)或干脆没编号。跨号维对它恒看不见(distinctIds.size===0,
    // 而 filter(Boolean) 把 ∅ 全滤掉),于是"同一件事的三份无号副本"永久隐形:门 203 报 0 组、
    // 棘轮的 ∅ 成员键又是死码(它拿的是本函数产物)——而派单清单会把三份都发出去,
    // 三个会话各领一张票各做一遍(GA7 两票在 HEAD 面各 3 份实测即此型)。
    // 只在**全组都无号**时成组;混合组(有号 + 无号)仍属"同号多行"那一档(F4 地盘),本门不抢名额。
    if (members.length > 1 && distinctIds.size === 0 && members.every((m) => !m.selfId)) {
      groups.push({ fingerprint: fp, members, distinctIds: [], kind: 'unnumbered' })
    }
    // 第四类(2026-10-16 立,机主令"一号一行彻底根治"):**同号多行**(同一 selfId 出现 ≥2 行)。
    // 此前刻意排除(注释称"归 F4/F10"),但 F4/F10 是修法出口不是提交链拦截闸 —— 同号新增
    // (union 回潮/取号竞态/手写撞号)从产生到被发现之间零拦截,只能事后折。变异实测:
    // 复制一行同号追加 ⇒ ratchetAdded 0 枚。本类让差值棘轮看见它:锚点里没有的键 = 新增 ⇒ 拦;
    // 锚点已有的存量组不拦(§12e)。fingerprint 前缀 S: 与跨号 F:/无号族区分。
    const bySelfId = new Map()
    for (const m of members) {
      if (!m.selfId) continue
      if (!bySelfId.has(m.selfId)) bySelfId.set(m.selfId, [])
      bySelfId.get(m.selfId).push(m)
    }
    for (const [sid, grp] of bySelfId) {
      if (grp.length > 1) groups.push({ fingerprint: `S:${sid}`, members: grp, distinctIds: [sid], kind: 'same-key' })
    }
  }
  return groups
}

/** 按单个指纹直查面上同题行(取号器发号前查重用;不要求面上已成组) */
export function findSameFingerprint(content, fp) {
  if (!fp) return []
  const hits = []
  const lines = String(content ?? '').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (!/^- \[ \]/.test(raw)) continue
    if (extractTaskFingerprint(raw) !== fp) continue
    const ids = [...raw.matchAll(/\b([A-Z])-(\d{2,})\b/g)].map((m) => `${m[1]}-${m[2]}`)
    hits.push({ line: i + 1, selfId: ids[0] ?? null, preview: raw.slice(0, 120) })
  }
  return hits
}

function isDirectRun() {
  const arg = process.argv[1] ? path.resolve(process.argv[1]) : ''
  return arg === path.resolve(fileURLToPath(import.meta.url))
}

/** 两面旗同给 ⇒ 判死(exit 2),与全仓取面纪律同形;`--ratchet` 缺省取索引面(提交链那一份)。 */
export function faceFromArgv(argv = [], { ratchet = false } = {}) {
  const staged = argv.includes('--staged')
  const worktree = argv.includes('--worktree')
  const head = argv.includes('--head')
  if ([staged, worktree, head].filter(Boolean).length > 1) {
    return { error: '--staged / --worktree / --head 不得同用(判定面互斥,两面旗同给判死)' }
  }
  if (head) return { face: 'head', error: null }
  return selectFace({ staged, worktree, def: ratchet ? 'staged' : 'worktree' })
}

/**
 * 按面取台账正文。取不到 ⇒ 抛 Undetermined(调用方 exit 2 拒绝出合格证),
 * 绝不回落到另一面 —— "换一面尺子再量一次"会把索引面的真红量成工作树的绿。
 */
export function readLedgerFace(root, face, rel = LEDGER_NAME) {
  if (face === 'worktree') {
    const s = readWorktreeFile(root, rel)
    if (s === null || s === undefined) throw new Undetermined(`工作树取不到 ${rel}`)
    return s
  }
  const spec = face === 'staged' ? `:${rel}` : `HEAD:${rel}`
  const out = gitRaw(['show', spec], root, { maxBuffer: 1 << 28 })
  if (out === null || out === undefined) throw new Undetermined(`取不到 ${spec} 面`)
  return String(out)
}

/**
 * 成员键计数(棘轮的量纲)。键 = `指纹 \t 自持号`(取不出号的行用 `∅`,同键计数照样生效)。
 * 为什么是计数不是集合:同一枚键在候选里多出第二行(同题同号再抄一份)同样是"这次带进来的",
 * 集合维对它恒绿 —— 而组数维对"清掉一组 + 新增一组"也恒绿。计数是这两个空档同时闭合的最小量纲。
 */
export function memberCounts(groups) {
  const m = new Map()
  for (const g of groups)
    for (const mem of g.members) {
      const k = `${g.fingerprint}\t${mem.selfId ?? '∅'}`
      m.set(k, (m.get(k) ?? 0) + 1)
    }
  return m
}

/**
 * 差值棘轮纯函数:只比"变多"。返回候选面**新增**的成员键(带多出来的份数)。
 * 锚点里有而候选里没有 ⇒ 收拢/清偿,不判(棘轮只拦新增,存量清偿不该被门挡回去)。
 */
export function ratchetAdded(anchorGroups, candidateGroups) {
  const anchor = memberCounts(anchorGroups)
  const added = []
  for (const [k, n] of memberCounts(candidateGroups)) {
    const base = anchor.get(k) ?? 0
    if (n > base) added.push({ key: k, fingerprint: k.split('\t')[0], selfId: k.split('\t')[1], extra: n - base })
  }
  added.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  return added
}

async function main() {
  const argv = process.argv.slice(2)
  const strict = argv.includes('--strict')
  const selfTest = argv.includes('--self-test')
  if (selfTest) {
    return runSelfTest()
  }
  const ratchet = argv.includes('--ratchet')
  const sel = faceFromArgv(argv, { ratchet })
  if (sel.error) {
    console.error(`❌ [plan-dup-title] ${sel.error}`)
    process.exit(2)
  }
  const face = sel.face
  const root = path.resolve(SCRIPT_DIR, '..')
  let content
  try {
    content = readLedgerFace(root, face)
  } catch (e) {
    console.error(`❌ [plan-dup-title] 读不到 ${LEDGER_NAME}(${FACE_TXT[face]}): ${e?.message ?? e} ⇒ 无法判定,不记为通过`)
    process.exit(2)
  }
  const groups = findDuplicateGroups(content)
  const total = groups.reduce((a, g) => a + g.members.length, 0)

  // ── 差值棘轮(提交链那一半):锚点 HEAD 面,只判"这次带进来的成员键" ──
  if (ratchet) {
    let anchorGroups
    try {
      anchorGroups = findDuplicateGroups(readLedgerFace(root, 'head'))
    } catch (e) {
      console.error(`❌ [plan-dup-title] 锚点取不到(HEAD:${LEDGER_NAME}): ${e?.message ?? e} ⇒ 无法判定,不记为通过`)
      process.exit(2)
    }
    const anchorTotal = anchorGroups.reduce((a, g) => a + g.members.length, 0)
    const added = ratchetAdded(anchorGroups, groups)
    console.log(
      `[plan-dup-title] 差值棘轮:锚点 HEAD ${anchorGroups.length} 组/${anchorTotal} 行 · ` +
        `候选面 ${FACE_TXT[face]} ${groups.length} 组/${total} 行 · 新增成员键 ${added.length}`,
    )
    for (const a of added.slice(0, 40)) {
      const g = groups.find((x) => x.fingerprint === a.fingerprint)
      const mem = g?.members.find((m) => (m.selfId ?? '∅') === a.selfId)
      console.log(`  ❌ 新增 ${a.selfId}(组 ${g?.distinctIds?.join(' vs ') ?? a.fingerprint}):${mem?.preview ?? '(预览取不到)'}`)
    }
    if (added.length > 0) {
      console.error(
        `❌ [--ratchet] 本次提交带进 ${added.length} 个锚点没有的同题成员键 ⇒ 判红。` +
          '同一件事在台账上只许有一行当前状态:① 让号/重登必须**旧行同批加〔【归并】同题多号收拢〕指针**(或删掉),' +
          '只增不删就是重复登记;② 用整行改写档就地更新已有那一行,不要再抄一份;' +
          '③ 手填编号会绕过取号器查重,登记一律走 {{NEXT_ID}} 令牌。' +
          '存量(锚点里已有的组)不拦 —— 判存量就是恒红门(§12e)。',
      )
      process.exit(1)
    }
    console.log(`结论:通过(存量 ${anchorGroups.length} 组只报数;本次新增成员键 0)`)
    process.exit(0)
  }

  const noNum = groups.filter((g) => g.kind === 'unnumbered').length
  console.log(
    `[plan-dup-title] 同题副本组 ${groups.length} 组(跨号 ${groups.length - noNum} / **无号同题** ${noNum}) / 涉及行 ${total} 行(判定面:${FACE_TXT[face]})`,
  )
  for (const g of groups.slice(0, 40)) {
    console.log(
      `  ⚠️ 同题组(${g.distinctIds.length ? g.distinctIds.join(' vs ') : '一行号都取不出 ⇒ 跨号维原本看不见'}):`,
    )
    for (const m of g.members) console.log(`     L${m.line} ${m.preview}`)
  }
  if (groups.length > 40) console.log(`  …其余 ${groups.length - 40} 组略`)
  if (strict && groups.length > 0) {
    console.error(`❌ [--strict] 同题多号 ${groups.length} 组 ⇒ 判红。收拢:每组保留持有行,其余行补〔【归并】同题多号收拢〕指针后重跑。`)
    process.exit(1)
  }
  console.log('结论:通过(默认档只报数;--strict 问责;--ratchet 提交链差值档)')
  process.exit(0)
}

function runSelfTest() {
  const cases = [
    { name: '同题不同号必命中', lines: ['- [ ] G-100 **修复登录超时问题** 详情甲', '- [ ] G-999 **修复登录超时问题。** 详情乙(2026-10-13)'], expect: 1 },
    { name: '不同题不命中', lines: ['- [ ] G-100 **修复登录超时问题**', '- [ ] G-101 **新增导出报表功能**'], expect: 0 },
    { name: '同号多行成组(第四类,2026-10-16 机主令一号一行)', lines: ['- [ ] G-100 **修复登录超时问题**', '- [ ] G-100 **修复登录超时问题**'], expect: 1 },
    { name: '指针行豁免', lines: ['- [ ] G-100 **修复登录超时问题**', '- [ ]〔【归并】重复登记副本:本行与 G-100 同题,派单以那条为准〕'], expect: 0 },
    { name: '编号引用不污染指纹', lines: ['- [ ] G-100 **修复 G-99 引起的登录超时**', '- [ ] G-101 **修复 G-88 引起的登录超时**'], expect: 1 },
    { name: '前置状语归一', lines: ['- [ ]（进行中@2026-10-05/g1-main）G-401 **MCP 工具免批准重跑（需拍板）**', '- [ ]G-768 **MCP 工具免批准重跑（需拍板）**'], expect: 1 },
    { name: '已勾行不审', lines: ['- [x] G-100 **修复登录超时问题**', '- [ ] G-101 **修复登录超时问题**'], expect: 0 },
    { name: '过短指纹不参与', lines: ['- [ ] G-100 **修超时**', '- [ ] G-101 **修超时**'], expect: 0 },    { name: '无号同题副本必命中(第三类,2026-10-16)', lines: ['- [ ] {{NEXT_ID}} **GA7 对 render-prop 宿主组合失明 属性扫描上限 4000 字符** 甲', '- [ ]（认领已释放@2026-10-15/x） {{NEXT_ID}} **GA7 对 render-prop 宿主组合失明 属性扫描上限 4000 字符** 乙'], expect: 1 },
    // 2026-10-22 回归锁(HEAD 面唯一 F4 组的逐字形状):租约改写器把释放印**追加在行尾**,
    // 修前「带租约」与「带释放印」两形态在 60 字符窗口里差一个字 ⇒ 指纹不等 ⇒ union 折不动、
    // purge 分不到族,F4 永远清不掉。修后两者指纹必须相等(expect 1 组)。
    {
      name: '行尾释放印/租约状语不参与指纹(2026-10-22 实测 59 族)',
      lines: [
        '- [ ] 59. 消息级版本切换 ← 1/3 →(regenerate 改为新增 sibling 而非物理删除;共用 `CanvasVersionMenu` 交互)（认领已释放@2026-10-22/qoder-claimfix:原牌 2026-10-18/w1-permax:大型票·消费面接线 超龄 96h 未清账,机主 2026-10-22 判定无席位在飞,按 §1 交回派单面;登记内容一字未动）',
        '- [ ] 59. 消息级版本切换 ← 1/3 →(regenerate 改为新增 sibling 而非物理删除;共用 `CanvasVersionMenu` 交互)（进行中@2026-10-18/w1-permax:大型票·消费面接线）',
      ],
      expect: 1,
    },
    // 反证臂:行尾括注里是**真内容**(不是状态状语)⇒ 必须照旧参与指纹,不得被顺手剥掉。
    // 形状要用"无粗体"的行 —— 有粗体时标题本来就取粗体、行尾内容不参与,那样测不出剥除臂。
    {
      name: '行尾普通括注仍是内容(反证:不得把正文当状语剥)',
      lines: [
        '- [ ] 59. 同一段题面正文甲,后面跟着真正的补充说明（补充:甲方案的内存上限更大）',
        '- [ ] 59. 同一段题面正文甲,后面跟着真正的补充说明（补充:乙方案的并发度更高）',
      ],
      expect: 0,
    },
    { name: '无号但只有一份 ⇒ 不成组', lines: ['- [ ] {{NEXT_ID}} **单独一份的无号登记行,标题足够长以越过指纹阈** 正文'], expect: 0 },
    { name: '混合组(有号 + 无号)不抢 F4 名额', lines: ['- [ ] G-700 **同一件事的混合组标题,长度足够越过指纹阈** 甲', '- [ ] {{NEXT_ID}} **同一件事的混合组标题,长度足够越过指纹阈** 乙'], expect: 0 },
    // ── 2026-10-19 修两处真值/正则缺陷,下面四例是它们的回归锁 ──
    // ⚠️ 形状必须**逐字复现真台账形态**:粗体本身要**以票号开头**(`**G-100 题面**`),
    // 否则 `extractTaskFingerprint` 走 `else { title = bold[1] }` 那条分支,压根碰不到 `:73` 的真值陷阱,
    // 用例会写成"修前也绿"的假锁(本轮第一版就是这么错的,阳性对照把它筛掉了)。
    {
      name: '粗体以票号开头+空格+破折号必算出指纹(真值陷阱回归;修前两行皆 null)',
      lines: [
        '- [ ] G-100 **G-100 修复登录超时问题的根因与修法** —— 详情甲',
        '- [ ] G-101 **G-101 修复登录超时问题的根因与修法** —— 详情乙',
      ],
      expect: 1,
    },
    {
      name: '粗体后有真题面时仍取题面(反证臂:钉"别把本分支改成恒取粗体")',
      lines: [
        '- [ ] G-100 **G-100** 真正的题面在这里继续写下去并且足够长 —— 详情甲',
        '- [ ] G-101 **G-101** 真正的题面在这里继续写下去并且足够长 —— 详情乙',
      ],
      expect: 1,
    },
    {
      name: '嵌套注记(〔…〔…〕〕)按配平整段剥掉(修前被非嵌套正则切碎 ⇒ 两行皆 null)',
      lines: [
        '- [ ] G-100 **G-100 修复登录超时问题** 〔副本正文并入·承载整段:甲〔改号(2026-10-14):原G-88〕〕 〔拍板@2026-10-18:定 A 档〕',
        '- [ ] G-101 **G-101 修复登录超时问题** 〔副本正文并入·承载整段:乙〔改号(2026-10-14):原G-77〕〕',
      ],
      expect: 1,
    },
    {
      name: '真实台账形态逐字复现(W4-W7;修前两行皆 null ⇒ 这正是折不掉的那一组)',
      lines: [
        '- [ ] **W4-W7 四波覆盖票（每波一票，交付判据见上）** —— 派单前先看登记表 `remaining` 名单，勿凭记忆切范围。',
        '- [ ] **W4-W7 四波覆盖票（每波一票，交付判据见上）** —— 派单前先看登记表 `remaining` 名单，勿凭记忆切范围。 〔现读更正@2026-10-19:实测该端目录不存在〕',
      ],
      expect: 1,
    },
    // ── 2026-10-20 第三型:破折号之后的正文粗体不得被当成标题 ──
    // 形状逐字取自真台账 G-200 / G-1104166 族:行首无粗体标题,破折号后的正文里才有
    // `（**成功响应**）`。修前首个粗体命中正文 ⇒ 指纹=「成功响应」⇒ weight 8 ⇒ 两行皆 null,
    // 同题两态(`[ ]` 与 `[x]`)折不动,归并后 F1 报"同主键两态并存(组) 3"。
    {
      name: '破折号后的正文粗体不当标题(G-200 族回归;修前两行皆 null)',
      lines: [
        '- [ ]G-200 输出被 max_tokens 截断时没有任何"续写"链路 —— 上游把 `finish_reason` 与（**成功响应**）判为续写而非压缩',
        '- [ ] G-1104166 输出被 max_tokens 截断时没有任何"续写"链路 —— 上游把 `finish_reason` 与（**成功响应**）判为续写而非压缩',
      ],
      expect: 1,
    },
    // ── 2026-10-20 修"行首派单前提括注里的强调粗体吞掉标题"(HEAD 面 66/332 行恒 null 的根因之一)──
    // 形状必须逐字跟着真账走:编号在粗体**外面**、括注里带 `**取舍**`、标题粗体在括注之后。
    // 修前:第一个 `**` 对落在括注内 ⇒ title='取舍' ⇒ 权重 4 < 16 ⇒ 两行皆 null ⇒ 0 组;
    // 修后:跳过括注内的粗体 ⇒ 同一标题 ⇒ 1 组。HEAD 面真例 = G-16 与 G-815424 那一对
    // (同一件事挂两个编号,派单清单会把两份都发出去)。
    {
      name: '派单前提括注内的强调粗体不得吞标题(修前两行皆 null ⇒ 跨号副本失明)',
      lines: [
        '- [ ] G-16（等守门 128 持有人拍两件事的**取舍**;本轮只量不裁）**门 128 的 SL 维有两格判据缺口:按档名计数不认几何投影别名** —— 现读证据:甲',
        '- [ ] G-815424（等守门 128 持有人拍两件事的**取舍**;本轮只量不裁）**门 128 的 SL 维有两格判据缺口:按档名计数不认几何投影别名** —— 现读证据:乙',
      ],
      expect: 1,
    },
    {
      name: '反向锁:没有括注的行,选粗体的结果与修前逐字相同(不得为了修一型把另一型换掉)',
      lines: [
        '- [ ] G-100 **修复登录超时问题需要跨越五个端的联调验收** 详情甲',
        '- [ ] G-999 **修复登录超时问题需要跨越五个端的联调验收。** 详情乙(2026-10-13)',
      ],
      expect: 1,
    },
  ]
  let pass = 0
  let total = 0
  const ok = (name, cond, detail = '') => {
    total++
    if (cond) pass++
    else console.error(`❌ self-test 失败: ${name}${detail ? ` —— ${detail}` : ''}`)
  }
  for (const c of cases) {
    const got = findDuplicateGroups(c.lines.join('\n')).length
    ok(c.name, got === c.expect, `期望 ${c.expect} 实测 ${got}`)
  }

  // ── 差值棘轮维(--ratchet 是提交链上唯一判红的那一半,这里必须四向都量到) ──
  const G_A = ['- [ ] G-100 **修复登录超时问题** 详情甲', '- [ ] G-999 **修复登录超时问题。** 详情乙']
  const G_B = ['- [ ] G-888 **修复登录超时问题** 详情丙'] // 同题第三个号
  const G_C = ['- [ ] G-500 **新增导出报表功能** 说明', '- [ ] G-501 **新增导出报表功能** 补充'] // 另一题的一组
  const gs = (lines) => findDuplicateGroups(lines.join('\n'))
  ok('棘轮:锚点已有、候选不变 ⇒ 新增 0', ratchetAdded(gs(G_A), gs(G_A)).length === 0)
  // 无号那一类的棘轮取证(第三类):锚点里已有的存量不得拦(§12e),这次多挂一份必须拦得到。
  const U_A = [
    '- [ ] {{NEXT_ID}} **无号同题副本的棘轮取证行,标题足够长以越过指纹阈** 甲',
    '- [ ] {{NEXT_ID}} **无号同题副本的棘轮取证行,标题足够长以越过指纹阈** 乙',
  ]
  ok(
    '棘轮:无号组存量不变 ⇒ 新增 0(存量天然在 HEAD 锚点里,判存量就是恒红门)',
    ratchetAdded(gs(U_A), gs(U_A)).length === 0,
  )
  ok(
    '棘轮:无号组多挂第三份 ⇒ 必须判 1(这类副本的成因就是"再抄一份",门过去对它恒绿)',
    ratchetAdded(gs(U_A), gs([...U_A, '- [ ] {{NEXT_ID}} **无号同题副本的棘轮取证行,标题足够长以越过指纹阈** 丙']))
      .length === 1,
  )
  ok(
    '棘轮:组内多挂一个号必判 1',
    ratchetAdded(gs(G_A), gs([...G_A, ...G_B])).length === 1,
    `实测 ${ratchetAdded(gs(G_A), gs([...G_A, ...G_B])).length}`,
  )
  ok('棘轮:整组全新 ⇒ 组内每个成员键都算新增', ratchetAdded(gs(G_A), gs([...G_A, ...G_C])).length === 2)
  ok('棘轮:清偿(收拢掉一个成员)不判 —— 棘轮只拦新增', ratchetAdded(gs([...G_A, ...G_B]), gs(G_A)).length === 0)
  ok(
    '棘轮:组数不变而键集换了照样判(计数维,组数维对它恒绿)',
    ratchetAdded(gs(G_A), gs(G_C)).length === 2,
    '锚点 1 组、候选 1 组 ⇒ 组数读数没动,但这是清掉一组 + 新增一组',
  )
  const G_A2 = [...G_A, '- [ ] G-100 **修复登录超时问题** 又抄了一份']
  ok(
    '棘轮:同题同号再抄一份必判(计数维,集合维对它恒绿)',
    ratchetAdded(gs(G_A), gs(G_A2)).length === 1,
    `实测 ${ratchetAdded(gs(G_A), gs(G_A2)).length}`,
  )

  // ── 取面维:面选错等于换一把尺子,这里必须钉死 ──
  ok('取面:两面旗同给 ⇒ 判死', Boolean(faceFromArgv(['--staged', '--worktree']).error))
  ok('取面:--ratchet 缺省索引面(提交链带走的那一份)', faceFromArgv([], { ratchet: true }).face === 'staged')
  ok('取面:缺省工作树(人读档,行为与接线前逐字一致)', faceFromArgv([]).face === 'worktree')
  ok('取面:显式 --head 可取', faceFromArgv(['--head'], { ratchet: true }).face === 'head')

  // ── 剥注记维:配不平不许把正文吃掉(反证臂;没有它,一次"配平失败就吞掉后面全部"的改法照样全绿) ──
  const unbal = extractTaskFingerprint(
    '- [ ] G-300 **未闭合的注记不许吃掉后面的正文** 〔只开不闭 后面还有很长很长的一段正文内容在这里',
  )
  ok('剥注记:括号配不平 ⇒ 仍算出指纹(不是把整行判死)', unbal !== null)
  ok(
    '剥注记:配平时只开不闭的那一段原样留在行里,不吞掉后续正文',
    unbal !== null && /未闭合的注记不许吃掉后面的正文/.test(unbal),
    `实测 ${JSON.stringify(unbal)}`,
  )
  ok(
    '剥注记:剥完之后不残留孤儿闭括号',
    !stripNoteGroups('甲〔注记:丙〕乙〕丙', '〔', '〕').includes('〕'),
  )

  console.log(`[plan-dup-title] self-test ${pass}/${total}`)
  process.exit(pass === total ? 0 : 1)
}

/* istanbul ignore next */
if (isDirectRun()) {
  main().catch((e) => {
    console.error('❌ 异常:', e?.stack ?? e)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠