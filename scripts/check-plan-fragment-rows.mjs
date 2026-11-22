#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 只读尺子为 CLI 工具,读数必须打到 stdout 交人现读 */
/**
 * check-plan-fragment-rows.mjs —— 台账登记行「正文被吃掉」的**只读尺子**(2026-10-23 立)
 *
 * 立项出处(内容锚点,不用行号也不用短 sha —— §1「新证据指针禁止行号/短 sha」):
 *   台账里那条「台账里有两类"正文被吃掉"的残行,先造只读尺子再谈修器物」的登记行(未取号,G 族号池已满)。
 *   票面现读:①一枚「复选框后除了括号注记没有任何正文」的空行,②一枚「正文以 `,` 收尾、点名的参照路径
 *   在本仓零命中」的截断行。本格就是票面要的那把尺子 —— **先量,不先开处方**:它只点名,不改台账、
 *   不修复选框、不代任何席位做"这行该怎么写"的决定(处置权归行持有人与主会话)。
 *
 * 两型判据(互斥:同一行最多落一型;空正文型优先)
 *   F1 空正文型 —— 一行是登记行,剥掉复选框与状态装饰(单源 `bodyOfRow`)后,再**逐段吃掉行首
 *      配平的括号注记**(扫描原语单源 `matchBalancedGroupAt`),**一个正文字符都不剩** ⇒ 判 F1。
 *      「一个都不剩」是本型的命门:注记本身是合法的(`（认领已释放@…）`/`〔归:…〕`/`（【归并】…）`
 *      三族都在台账里大量存在),只有"整行除了注记什么也没有"才是正文被吃掉。
 *      ⚠ 收窄实测(这条不是洁癖,是 32 vs 1 的差):若宽判成"单源 `titleOf` 给不出标题即算空正文",
 *      HEAD 面命中 **32 枚**,其中 31 枚是「行首挂注记 + 后面整段正文」的健康长行(实测 L3507/
 *      L3664/… 那一批 `titleOf` 返回空串是因为题面被行首注记挤出了标题窗口,不是因为没正文)。
 *      收窄后命中 **1 枚**,与票面现读同形。阳性对照锁在镜像测试:把「残留正文一个都不许有」这一维
 *      摘掉 ⇒ 命中集立刻从 1 涨到 32(翻红),装回来 ⇒ 复绿。
 *   F2 截断收尾型 —— 一行是登记行且有正文(非 F1),而**整行末个非空白字符**落在「续写标点集」
 *      `， , 、 ； ; ： :` ⇒ 判 F2(句子被切在半截处,后面没有下文)。
 *      ⚠ 收窄实测:合法行的收尾永远是**闭合形**而不是续写形。HEAD 面实测以 `）`(7 枚)、`)`(5 枚)、
 *      `】`(3 枚)收尾的登记行共 15 枚,全部**不得**命中 —— 本型只看末个字符,闭括号/引号/反引号
 *      收尾天然落在射程外,不需要再叠一条"排除括号"的补丁(补丁会漂,形状不会)。
 *      阳性对照锁在镜像测试:摘掉「末字符必须属续写标点集」⇒ 连 `。`/`）` 收尾的健康行都被卷进命中集。
 *
 * 为什么不进提交链(§12e 恒红门禁令,这条是设计而不是偷懒)
 *   本格判的是**文档存量**(台账里已经躺着多少枚残行)与**机器状态**,不是"本次提交有没有把残行带进来"。
 *   存量非零时把它挂成 blocking,唯一结局是逼人 `--no-verify`、连带废掉全部守门 —— 正是 §12e 禁的那一型。
 *   升档前置(写在这是为了不让下一手顺手接线):① 存量两型归零,② 或改造成"只拦本次新增行"的差值棘轮
 *   (那需要先给每型定"违规身份",归并与门 167/130 同族,是另一张票)。
 *   惯例同族的只读尺子:`check-plan-sha-form.mjs` 的全量档、`check-plan-claims-vs-head.mjs`(未接线)、
 *   `check-dispatch-premise.mjs`、`check-temp-landing.mjs`、`check-monitor-runtime-parity.mjs`、
 *   `check-prod-checkout-foreign-work.mjs`。
 *   **本格刻意不注册进 `scripts/guardian-runner.mjs`,也不在 `scripts/lib/pre-commit-hook.js`** ⇒
 *   没有紧急跳过变量生效点(§0.8:文档不许写跑不通的出路,所以这里不编一个 skipEnv 名字)。
 *
 * 判定面(§0.4 同面同轮:清单与内容必须同一面、同一次读取)
 *   默认判 **HEAD blob**(`git show HEAD:PROJECT_PLAN.md`);`--staged` 判**索引 blob**;
 *   `--worktree` 只是人工逃生舱(盘上副本可能属于并行会话的半编辑态,不得作为任何门禁输入);
 *   两面旗同给 ⇒ exit 2(取哪一面都会让另一面成为假绿);被审面取不到/取空 ⇒ exit 2 显式「未判定」
 *   并点名原因,**不记绿也不冒红**(§0.3);登记行枚数枚举到 0 ⇒ 判死(exit 2),不读成"干净"。
 *   行号的含义随面而变,所以三档各报自己的行号并注明判定面,不得跨面混读。
 *
 * 判据不复制(§0.6 / §22c,守门 191 拦复制)
 *   登记行识别 = `parseTaskRows`;复选框与状态装饰剥离 = `bodyOfRow`;成对括注扫描 =
 *   `matchBalancedGroupAt`;主键取法 = `keyOfRow` —— 全部 import 自 `scripts/lib/plan-task-index.mjs`。
 *   本格只自带两张表:①「哪些括号对算行首注记」(扫描算法在单源,位置策略表按单源头注的说法本就
 *   分位置给 —— LEAD_DECOR_PAIRS 与 GROUP_PAIRS 两张不同形,第三张是本格的;半角 `[` 刻意**不进**本格
 *   表,理由与 LEAD_DECOR_PAIRS 一致:它装的是行文引用与 markdown 链接,不是注记)、
 *   ②「续写标点集」(本型的全部内涵,单源没有这一维)。
 *
 * 已知判不了格(如实登记,不得读成"已确认没有")
 *   ① **注记盖住截断点**那一族:正文在半截处被切断、切断点后面正好挂着一枚行尾注记 ⇒ 末字符是 `）`
 *      而不是续写标点,两型都不命中。实测 HEAD 面至少 1 枚(L29014,`…os.tmpdir()`(`check-workspace-dep-links` /
 *      （认领已释放@…)` —— `(` 开了列表再没闭合,"7 个脚本"只列出 1 个)。这一族要判得另立第三型
 *      (配平计数),票面没授权,本格不顺手扩。
 *   ② 代码围栏内的 `- [ ]` 形文本会被 `parseTaskRows` 当登记行(台账里实测 0 枚):真出现就是误报。
 *   ③ F2 不判"该行点名的路径在不在本仓":那是 `check-plan-claims-vs-head.mjs` 的 C1 维(已另有尺子,
 *      不复算 —— 本格 F2 命中行的路径可寻址性请用配套尺子现读,两把尺子各判各的结论,不互顶账)。
 *
 * 手动(§0.8,三条都真跑得通)
 *   node scripts/check-plan-fragment-rows.mjs              # HEAD blob(默认档)
 *   node scripts/check-plan-fragment-rows.mjs --staged     # 索引 blob
 *   node scripts/check-plan-fragment-rows.mjs --worktree   # 人工逃生舱:磁盘副本
 *   node scripts/check-plan-fragment-rows.mjs --json       # 机读(FRAGMENT-SUMMARY / FRAGMENT-HIT)
 *   node scripts/check-plan-fragment-rows.mjs --self-test  # 构造面正反对照,零 git、零写盘
 * 退出码:0 = 判过且两型皆 0 命中 / 1 = 判过且至少一型有命中(点名交人,**不是门红**)/
 *   2 = 未判定(两面旗同给、被审面取不到或取空、登记行枚数枚举到 0、参数值非法)。
 */

import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, assertRepoRoot, gitRaw, readWorktreeFile, selectFace, FACE_LABEL } from './lib/face-reader.mjs'
import { bodyOfRow, keyOfRow, matchBalancedGroupAt, parseTaskRows } from './lib/plan-task-index.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(§15:共享工作区 cwd 不可靠,不得 process.cwd() 定根) */
const ROOT = path.resolve(HERE, '..')

export const GATE = 'check-plan-fragment-rows'
/** 被审文档(台账);变量覆盖只为镜像测试构造第二份文档面,默认必须是真台账路径。 */
export const DOC = process.env.IHUI_PLAN_FRAGMENT_DOC || 'PROJECT_PLAN.md'

/** F1 型 id / F2 型 id(机读行与 --json 用同一套字面,不另拼中文) */
export const TYPE_EMPTY = 'empty-body'
export const TYPE_TRUNCATED = 'trailing-punct'

/**
 * 行首注记的括号对表(**位置策略表**,扫描算法住在单源 `matchBalancedGroupAt`)。
 * 半角 `[` 刻意不在表内:它装 markdown 链接与行文引用,不是注记。
 */
export const LEAD_ANNOTATION_PAIRS = { '（': '）', '(': ')', '【': '】', '〔': '〕' }

/** 吃掉行首注记前允许跨过的噪声(空白 / markdown 强调记号 / 冒号 / 引用标记)。 */
const LEAD_NOISE = new Set([' ', '\t', ':', '：', '*', '`', '>', '~'])

/** F2 的续写标点集(句子必须往下接,却已经没有下文)。闭合形不在集内 —— 见头注「收窄实测」。 */
export const CONTINUATION_PUNCT = ['，', ',', '、', '；', ';', '：', ':']

/** 注记之外是否"一个正文字符都不剩"的计数口径:空白与 markdown 强调记号不算正文。 */
function bodyChars(s) {
  return s.replace(/[\s*`>~]/g, '').length
}

/**
 * F1 的核心剥离出口:复选框与状态装饰由单源 `bodyOfRow` 剥,行首连续**配平**注记由单源
 * `matchBalancedGroupAt` 逐段吃;**开不出或开了不闭合就立刻停**(未闭合不吃,返回含该开括号的残段)——
 * 与单源 `skipKeyAttachedDecorGroups` 的「未闭合的括号不吃」同向:宁可把这行读成"还有正文"放过,
 * 也不把"正文其实写在别处"的行判成空正文。
 * @returns {string|null} 非登记行 ⇒ null;否则返回剥完之后的残段(已去掉行首噪声)
 */
export function annotationResidue(line) {
  const body = bodyOfRow(line)
  if (body === null) return null
  let cur = body
  for (let guard = 0; guard < 64; guard += 1) {
    let k = 0
    while (k < cur.length && LEAD_NOISE.has(cur[k])) k += 1
    const end = matchBalancedGroupAt(cur, k, LEAD_ANNOTATION_PAIRS)
    if (end < 0) return cur.slice(k)
    cur = cur.slice(end)
  }
  return cur
}

/** 逐行判两型(纯函数,不碰 git ⇒ 镜像测试可直接喂构造文本)。 */
export function findFragmentRows(text) {
  const rows = parseTaskRows(String(text ?? ''))
  const hits = []
  for (const r of rows) {
    const residue = annotationResidue(r.raw)
    if (residue === null) continue
    if (bodyChars(residue) === 0) {
      hits.push({
        line: r.line,
        state: r.state,
        type: TYPE_EMPTY,
        preview: previewOf(r.raw),
        tail: residue,
        note: `行首注记逐段剥尽后正文残留 0 字(剥完残段:${JSON.stringify(residue)})`,
      })
      continue
    }
    const s = r.raw.replace(/\s+$/, '')
    const last = [...s].pop()
    if (last !== undefined && CONTINUATION_PUNCT.includes(last)) {
      hits.push({
        line: r.line,
        state: r.state,
        type: TYPE_TRUNCATED,
        preview: previewOf(r.raw),
        tail: last,
        note: `整行末个非空白字符是续写标点「${last}」,其后无正文`,
      })
    }
  }
  const counts = {
    [TYPE_EMPTY]: hits.filter((h) => h.type === TYPE_EMPTY).length,
    [TYPE_TRUNCATED]: hits.filter((h) => h.type === TYPE_TRUNCATED).length,
  }
  return {
    hits,
    counts,
    denominator: {
      rows: rows.length,
      open: rows.filter((r) => r.state === 'open').length,
      done: rows.filter((r) => r.state === 'done').length,
      keyed: rows.filter((r) => keyOfRow(r.raw) !== null).length,
    },
  }
}

/** 点名用前 80 字(按码点切,中文行不按 UTF-16 单元切会把代理对劈开)。 */
export function previewOf(line, max = 80) {
  return [...String(line).replace(/\s+/g, ' ').trim()].slice(0, max).join('')
}

/** 面选择必须委派给单源 `selectFace`(参数形状错位过一次:三门共用这一条,少一个面就成假绿)。 */
export function pickFace(argv) {
  return selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree') })
}

/** 按面取被审文本;取不到一律抛 Undetermined(交调用方落 exit 2,绝不回落另一个面 —— §0.4)。 */
export function readFace(face, root = ROOT, doc = DOC) {
  if (face === 'worktree') {
    const text = readWorktreeFile(root, doc)
    if (typeof text !== 'string' || text === '') throw new Undetermined(`${FACE_LABEL.worktree} 取不到 ${doc}`)
    return text
  }
  const spec = face === 'staged' ? `:${doc}` : `HEAD:${doc}`
  try {
    const text = gitRaw(['show', spec], root, { timeout: 120_000 })
    if (typeof text !== 'string' || text === '') throw new Undetermined(`git show ${spec} 返回空内容`)
    return text
  } catch (e) {
    if (e instanceof Undetermined) throw e
    throw new Undetermined(`git show ${spec} 取不到被审面: ${e?.message ?? e}`)
  }
}

/** 一面的完整读数(判定面 + 分母 + 两型命中);纯计算,枚举到 0 判死在这里落 state='blind'。 */
export function inspectFace(face, text) {
  const r = findFragmentRows(text)
  if (r.denominator.rows === 0) {
    return { ...r, face, state: 'blind', why: `${FACE_LABEL[face]} 上枚举到 0 枚登记行 ⇒ 尺子对这一面失明,判死(§0.3:枚举到 0 不记绿)` }
  }
  const total = r.counts[TYPE_EMPTY] + r.counts[TYPE_TRUNCATED]
  return { ...r, face, state: total > 0 ? 'hit' : 'clean', why: null }
}

function printHuman(view) {
  console.log(
    `[台账残行尺] 判定面:${FACE_LABEL[view.face]} · 文档 ${DOC} · 登记行 ${view.denominator.rows} 枚` +
      `(未勾 ${view.denominator.open} / 已勾 ${view.denominator.done} · 有主键 ${view.denominator.keyed})`,
  )
  if (view.state === 'blind') {
    console.log(`❓ 未判定:${view.why} —— 不记绿也不冒红`)
    return
  }
  console.log(`  ① 空正文行(复选框后只剩括号注记):${view.counts[TYPE_EMPTY]} 枚`)
  console.log(`  ② 截断收尾行(正文以续写标点收尾):${view.counts[TYPE_TRUNCATED]} 枚`)
  for (const type of [TYPE_EMPTY, TYPE_TRUNCATED]) {
    const list = view.hits.filter((h) => h.type === type)
    for (const h of list) {
      console.log(
        `    · L${h.line} [${h.state}] ${type === TYPE_EMPTY ? '空正文' : '截断收尾'} —— 前 80 字:${h.preview}`,
      )
      console.log(`        判据:${h.note}`)
    }
    if (list.length === 0) console.log(`    · (本型 0 枚:这是"量过了、没有",不是"没量")`)
  }
  if (view.state === 'hit') {
    console.log(`⚠️ 量到存量 ${view.hits.length} 枚 —— 本尺只读、不在提交链(§12e),只点名不代改;处置权归行持有人与主会话。`)
    console.log(`   配套尺子:F2 命中行点名的路径在不在本仓,请现读 node scripts/check-plan-claims-vs-head.mjs(本格不复算)。`)
  } else {
    console.log('✅ 两型现读皆 0 命中(本面登记行枚数见上;判过 ≠ 永不再出现)。')
  }
}

function printJson(view) {
  console.log(
    `FRAGMENT-SUMMARY face=${view.face} rows=${view.denominator.rows} emptyBody=${view.counts[TYPE_EMPTY]} ` +
      `trailingPunct=${view.counts[TYPE_TRUNCATED]} state=${view.state}`,
  )
  for (const h of view.hits) {
    console.log(`FRAGMENT-HIT ${JSON.stringify({ face: view.face, ...h })}`)
  }
}

function selfTest() {
  let pass = 0
  let fail = 0
  const t = (name, ok, extra = '') => {
    if (ok) {
      pass += 1
      console.log(`✅ ${name}`)
    } else {
      fail += 1
      console.log(`❌ ${name}${extra ? `:${extra}` : ''}`)
    }
  }
  const EMPTY = '- [ ]（认领已释放@2026-10-23/stale-claim-strip#fixture-27）'
  const HEALTHY_LEAD_ANNOTATION = '- [ ]（认领已释放@2026-10-23/x） **本项遗留的待拍板事项**(已量化):① 补 SMTP'
  const TRUNCATED = '- [ ] `--allow-dangerous` 确认旁路仍在调用方(`commands/agent.ts:1757`),'
  const CLOSED_HEALTHY = '- [ ] G-9001 现状一句(收尾是闭括号)'
  const DOCFIX = `${EMPTY}\n${HEALTHY_LEAD_ANNOTATION}\n${TRUNCATED}\n${CLOSED_HEALTHY}\n`
  const r = findFragmentRows(DOCFIX)
  t('F1 命中"整行只剩注记"', r.counts[TYPE_EMPTY] === 1 && r.hits[0].line === 1)
  t('F1 不收"行首注记 + 后面整段正文"(32 vs 1 那一次收窄)', !r.hits.some((h) => h.line === 2))
  t('F2 命中以逗号收尾的截断行', r.counts[TYPE_TRUNCATED] === 1 && r.hits.some((h) => h.line === 3))
  t('F2 不收闭括号收尾的健康行', !r.hits.some((h) => h.line === 4))
  t('分母按单源 parseTaskRows 数(叙述行不计入)', r.denominator.rows === 4)
  const nested = findFragmentRows('- [ ]（【归并】重复登记副本）〔归:—｜等:等环境〕')
  t('F1 吃嵌套注记(两层都是注记 ⇒ 空正文)', nested.counts[TYPE_EMPTY] === 1)
  const unclosed = findFragmentRows('- [ ]（未闭合的开括号')
  t('F1 遇未闭合开括号立刻停(保守方向:放过而非误判)', unclosed.counts[TYPE_EMPTY] === 0)
  const punctAll = CONTINUATION_PUNCT.join('')
  t('F2 集内标点逐个都能命中(集本身没有哑臂)',
    CONTINUATION_PUNCT.every((p) => findFragmentRows(`- [ ] G-9002 正文${p}`).counts[TYPE_TRUNCATED] === 1), punctAll)
  t('F2 不认句号/闭括号(合法收尾不得命中)',
    findFragmentRows('- [ ] G-9003 正文。').counts[TYPE_TRUNCATED] === 0 &&
      findFragmentRows('- [ ] G-9004 正文」').counts[TYPE_TRUNCATED] === 0)
  const blank = findFragmentRows('# 标题\n\n一句叙述,以逗号收尾,\n')
  t('枚举到 0 枚登记行 ⇒ 判死(不记绿)', inspectFace('head', blank ? '' : '').state === 'blind')
  t('面选择:两面旗同给 ⇒ 判死', pickFace(['--staged', '--worktree']).face === null)
  t('面选择:默认 = HEAD blob', pickFace([]).face === 'head')
  console.log(`--self-test: ${pass}/${pass + fail} 通过`)
  return fail
}

function run(argv) {
  if (argv.includes('--self-test')) return selfTest()
  const json = argv.includes('--json')
  const face = pickFace(argv)
  if (face.error) {
    console.log(`❌ 未判定:${face.error}`)
    return 2
  }
  try {
    assertRepoRoot(ROOT, GATE)
  } catch (e) {
    console.log(`❌ 未判定:基准不是仓库根 —— ${e?.message ?? e}`)
    return 2
  }
  let text
  try {
    text = readFace(face.face)
  } catch (e) {
    console.log(`❌ 未判定:${e?.message ?? e} —— 被审面取不到不回落另一个面(§0.4),不记绿也不冒红(§0.3)`)
    return 2
  }
  const view = inspectFace(face.face, text)
  if (json) printJson(view)
  else printHuman(view)
  if (view.state === 'blind') return 2
  return view.state === 'hit' ? 1 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exitCode = run(process.argv.slice(2))

export const __test__ = {
  findFragmentRows,
  annotationResidue,
  previewOf,
  pickFace,
  inspectFace,
  readFace,
  selfTest,
  CONTINUATION_PUNCT,
  LEAD_ANNOTATION_PAIRS,
  TYPE_EMPTY,
  TYPE_TRUNCATED,
  GATE,
  DOC,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
