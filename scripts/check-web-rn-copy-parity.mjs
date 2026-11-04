#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 守门 291:web↔RN 用户可见措辞一致性门(blocking:同屏同文案 RN 硬编码而 web 走 i18n;
 * advisory:同值异键)
 *
 * 立因(2026-11-03,P2 自动化缺口):
 *  `check-web-rn-screen-parity.mjs` 判的是"这屏 RN 有没有承载",`check-web-rn-screen-map`
 *  判的是样式/结构;**文案**这一维此前零判据 —— 同一屏 web 用 `t('wallet.balance')`,
 *  RN 手写「余额」,两端各自换词,用户看到的两套说法没有任何机器拦。
 *
 * 射程(只比对能确定同屏映射的屏):
 *   数据源 = `scripts/data/web-rn-screen-map.jsonl` 的 **aligned** 行(用 `web` 路由与 `rn` 文件
 *   逐行配对);excluded / portal / gap 行一律跳过(它们本来就没有"同屏"这个前提)。
 *   web 侧文件集 = 该路由 `page.tsx` 所在目录整棵子树(同屏组件都算);
 *   RN 侧 = 台账 `rn` 指向的那一个文件。共享组件(`packages/app/src/components`)不在两侧射程
 *   —— 它是两端同一份源,列盲区而不是假装判过。
 *   路由→文件复用 `check-web-rn-screen-parity.mjs` 的 `collectWebRoutes`(§0.6:不另造路由真相)。
 *
 * 判据:
 *   B1 blocking —— RN 侧出现**用户可见中文硬编码**,而同一屏 web 侧有 i18n 键、且该中文与
 *      web 该屏某个键的 zh-CN 译文**逐字相同** ⇒ 红(这就是"web 已经取词了,RN 还在手写")。
 *      只认两种用户可见位置:JSX 文本节点、`placeholder/title/accessibilityLabel/aria-label/
 *      label/alt` 属性字面量。代码里的普通字符串(API 参数、日志、样式类名)不在射程。
 *   B2 advisory —— RN 用了 key K_rn、web 用了 K_web,K_rn ≠ K_web 但 zh-CN 译文逐字相同
 *      ⇒ 警告(语义同、键不同),记入账本 `scripts/data/web-rn-copy-diffs.json`。
 *      已裁决的三类不再逐条报噪声:`common.*` 通用键白名单(A 组)、同尾段命名约定差(B 组)、
 *      角色不同的同字不同义(E 组,§ROLE_EXEMPTIONS);裁决理由写进账本 `decisions`。
 *   B3 blocking —— 同义键异值:按语义族(SYNONYM_FAMILIES,retry / payMethod / enrolled / 学习时长)
 *      配对后比较**归一化取值**(大小写/标点/术语/单位/占位符顺序都压平);B1/B2 只认逐字相同,
 *      故「重试」vs「重新充值」这类差异此前恒为 0,是盲区而非零差异。
 *   计数口径:同一 RN 文件同一键会因多条 web 路由重复命中,派生前按 (RN 文件, 键, 值) 去重。
 *
 * 为什么 B1 敢 blocking、B2 只 warn:
 *   B1 是**同一句话被写了两遍**:web 那份有键有译文,RN 那份是裸中文 —— 改法是替换成同一个键,
 *   机器可证、不涉及观感判断。B2 只是"两个键碰巧同值"(如 `common.save` 与 `wallet.save`),
 *   合并键空间会动 i18n 结构,裁决权归人 ⇒ 只点名不拦(§12e)。
 *
 * 台账 `scripts/data/web-rn-copy-diffs.json`:每条带 owner/expires/evidence/count,到期即红;
 *   认领数少于现读 ⇒ 红(新增未挂账;B2 仍只 advisory);多于现读 ⇒ advisory(清单腐烂)。
 *   staged 档只判本次动到的屏,未触及屏的存量账不参与差额判序(否则每次提交都刷 68 条腐烂)。
 *
 * 盲区(静态判不了,写在这里):动态键(`t(\`k.${x}\`)` / `t(variable)`)、模板串拼出来的中文、
 *   `{cond ? '中文' : '英文'}` 里的字面量、共享组件内部文案、web 侧 `next-intl` 之外的取词方式。
 *
 * 集成位置: scripts/guardian-runner.mjs 第 291 项(pre-commit blocking;staged 触发面 =
 *   apps/web/app/ + apps/mobile-rn/src/ + packages/app/src/features/ + 屏幕映射台账 + 本门脚本/台账)。
 *
 * 用法:node scripts/check-web-rn-copy-parity.mjs [--gate|--staged] [--json] [--self-test]
 * 退出码:0 全绿(advisory 不折) · 1 B1 未挂账/账本到期 · 2 取不到输入(未判定)
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { maskComments } from './lib/code-mask.mjs'
import { catBatch, readWorktreeFile } from './lib/face-reader.mjs'
import { __test__ as parity } from './check-web-rn-screen-parity.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO = resolve(HERE, '..')
export const MAP_REL = 'scripts/data/web-rn-screen-map.jsonl'
export const MESSAGES_REL = 'packages/i18n/messages/web/zh-CN.json'
export const LEDGER_REL = 'scripts/data/web-rn-copy-diffs.json'
export const SKIP_ENV = 'HUSKY_SKIP_WEB_RN_COPY_PARITY'

const CJK_RE = /[\u3400-\u9fff]/
const USER_FACING_ATTRS = ['placeholder', 'title', 'accessibilityLabel', 'aria-label', 'label', 'alt']

/**
 * 通用键白名单(A 组决策):RN 复用 `common.*` 与 web 屏级键并存属于通用键复用,不算命名漂移。
 * 白名单之外的键(如 `wallet.retryRecharge` vs `common.retry`)照旧进 B2。
 */
export const COMMON_KEY_WHITELIST = new Set([
  'common.loading',
  'common.cancel',
  'common.back',
  'common.retry',
  'common.error',
  'common.save',
  'common.delete',
  'common.more',
  'common.confirm',
  'common.close',
  'common.ok',
  'common.submit',
  'common.next',
  'common.prev',
  'common.search',
])

/**
 * 角色裁决(E 组「同字不同义」):同一个键/同一句话在两端承担**不同的 UI 角色**时,
 * 字面相同但语义不同 ⇒ 不算漂移。按 (RN 文件, RN 键) 精确匹配,不做模糊豁免。
 */
export const ROLE_EXEMPTIONS = [
  {
    rn: 'apps/mobile-rn/src/screens/DevicesScreen.tsx',
    rnKey: 'common.error',
    webKeys: ['settings.devices.taskColError'],
    reason: 'RN 用作错误弹窗标题,web 是设备表「错误」列头 —— 同字不同义',
  },
  {
    rn: 'packages/app/src/features/activity-detail/ActivityDetailScreen.tsx',
    rnKey: 'activityDetail.title',
    webKeys: ['activities.descriptionLabel'],
    reason: 'RN 用作活动详情页标题,web 是活动描述字段标签 —— 同字不同义',
  },
  {
    rn: 'packages/app/src/features/account-cancel/AccountCancelScreen.tsx',
    rnKey: 'settings.accountDeletionConfirmLabel',
    webKeys: ['settings.accountDeletionSubmit'],
    reason: 'RN 是注销确认词输入框标签,web accountDeletionSubmit 是提交按钮 —— 同字不同义,已拆独立键',
  },
  {
    rn: 'packages/app/src/features/account-cancel/AccountCancelScreen.tsx',
    rnKey: 'settings.accountDeletionConfirmTitle',
    webKeys: ['settings.accountDeletionSubmit'],
    reason: 'RN 是注销二次确认弹窗标题,web accountDeletionSubmit 是提交按钮 —— 同字不同义,已拆独立键',
  },
  {
    rn: 'apps/mobile-rn/src/screens/PurchaseScreen.tsx',
    rnKey: 'common.retry',
    webKeys: ['wallet.retryRecharge'],
    reason: 'RN 是订阅列表加载失败的重试,web wallet.retryRecharge 是充值失败的重试 —— 同字不同义',
  },
  {
    rn: 'packages/app/src/features/exam/ExamScreen.tsx',
    rnKey: 'exam.retry',
    webKeys: ['eduExamResultPage.retry'],
    reason: 'RN「重试」是重做本题,web「重新考试」是整场重考 —— 同字不同义',
  },
  {
    rn: 'packages/app/src/features/exam/ExamScreen.tsx',
    rnKey: 'eduExamListPage.start',
    webKeys: ['exam.startExam'],
    reason:
      'RN 考试列表的开始按钮;同一 RN 文件被 exam 与 edu/exam 两条 web 路由映射,web 两页各用一个同值键(开始考试),无单键可同时满足两条路由 —— 非 RN 漂移',
  },
  {
    rn: 'packages/app/src/features/payment/PaymentScreen.tsx',
    rnKey: 'learnPaymentConfirmPage.fields.payMethod',
    webKeys: ['payment.checkout.paymentMethod'],
    reason:
      'RN 支付方式标签;同一 RN 文件被 payment 与 learn/payment/confirm 两条 web 路由映射,web 两页各用一个同值键,且 payment.checkout.paymentMethod 的 ja/ko 译文存量损坏 —— 非 RN 漂移',
  },
  {
    rn: 'packages/app/src/features/subscriptions/SubscriptionsScreen.tsx',
    rnKey: 'memberSubscriptionPage.cancelSubscription',
    webKeys: ['subscriptions.cancel'],
    reason:
      'RN 取消订阅;同一 RN 文件被 subscriptions 与 member/subscription 两条 web 路由映射,web 两页各用一个同值键(取消订阅),无单键可同时满足两条路由 —— 非 RN 漂移',
  },
  {
    rn: 'apps/mobile-rn/src/screens/PurchaseScreen.tsx',
    rnKey: 'wallet.rechargeMethod',
    webKeys: ['purchase.payMethod'],
    reason:
      'RN 充值支付方式;同一 RN 文件被 purchase 与 wallet/recharge 两条 web 路由映射,web 两页各用一个同值键(支付方式) —— 非 RN 漂移',
  },
  {
    rn: 'packages/app/src/features/points/PointsScreen.tsx',
    rnKey: 'points.levelLabel',
    webKeys: ['points.level'],
    reason:
      'web points 屏内 PointsSummary 用 points.level、PointsLeaderboard 用 points.levelLabel,两键五语言同值;RN 采用 levelLabel 后另一键仍同值命中 —— web 屏内双键,非 RN 漂移',
  },
  {
    rn: 'packages/app/src/features/points/PointsScreen.tsx',
    rnKey: 'points.mallTitle',
    webKeys: ['points.mallLink'],
    reason:
      'web points 屏内页签链接用 points.mallLink、商城页标题用 points.mallTitle,两键五语言同值;RN 采用 mallTitle 后另一键仍同值命中 —— web 屏内双键,非 RN 漂移',
  },
  {
    rn: 'packages/app/src/features/points/PointsScreen.tsx',
    rnKey: 'points.tasks.title',
    webKeys: ['points.taskCenterLink'],
    reason:
      'web points 屏内页签链接用 points.taskCenterLink、任务页标题用 points.tasks.title,两键五语言同值;RN 采用 tasks.title 后另一键仍同值命中 —— web 屏内双键,非 RN 漂移',
  },
  {
    rn: 'packages/app/src/features/vip/VipScreen.tsx',
    rnKey: 'vip.duration',
    webKeys: ['vip.durationDays'],
    reason:
      'RN 需插值渲染「{days} 天」;web/shared 合并面 vip.durationDays 在 shared 为无插值标签「有效天数」,直接统一会让 RN 丢失天数 —— 同键不同形态',
  },
  {
    rn: 'packages/app/src/features/agent-create/AgentCreateScreen.tsx',
    rnKey: 'agentCreate.categoryPlaceholder',
    webKeys: ['agent.fieldCategoryPlaceholder'],
    reason:
      'RN 分类是自由文本输入(示例占位「如:办公助手」),web 分类是 Select(占位「请选择分类」) —— 同字不同义',
  },
  {
    rn: 'packages/app/src/features/course-detail/CourseDetailScreen.tsx',
    rnKey: 'learn.signedUp',
    webKeys: ['learn.signUp', 'learn.signupCount'],
    reason:
      'web learn/[id] 同屏同义族并存 signUp(报名)与 signedUp(已报名);RN 采用 signedUp 后族内比较排除自身,余键取值不同 —— web 同族双值,非 RN 漂移',
  },
]

/**
 * B3 同义键异值:按「语义族」把不同键名的同义键配成对,再用**归一化后的取值**比较
 * (大小写/标点/术语/单位/占位符顺序都压平)。B1/B2 只认逐字相同,故这类差异此前恒为 0。
 */
export const SYNONYM_FAMILIES = [
  { id: 'retry', keyRe: /retry/i, terms: ['重试', '重新充值', '再充值', '重新支付', '再试一次'] },
  { id: 'pay-method', keyRe: /(payMethod|paymentMethod|rechargeMethod|payKind)/i, terms: ['支付方式', '付款方式', '充值方式'] },
  { id: 'enrol', keyRe: /(enrolled|signedUp|signUp|enrollment)/i, terms: ['已报名', '已注册', '已加入'] },
  { id: 'study-duration', keyRe: /(weekMinutes|weeklyHours|studyHours|learnHours)/i, terms: ['学习时长', '每周学习时长', '本周学习时长'] },
]

/** 读索引面或工作树面;取不到 ⇒ null(调用方按未判定处理)。取材统一走 lib/face-reader(守门 118)。 */
export function readFace(rel, face = 'worktree') {
  try {
    if (face === 'staged') {
      const text = catBatch(REPO, [`:${rel}`]).get(`:${rel}`)
      return typeof text === 'string' ? text.replace(/\r\n/g, '\n') : null
    }
    const text = readWorktreeFile(REPO, rel)
    return typeof text === 'string' ? text.replace(/\r\n/g, '\n') : null
  } catch {
    return null
  }
}

/** 台账行:只留 aligned 且 web/rn 都是字符串的行。 */
export function loadAlignedRows(text) {
  const rows = []
  const skipped = { excluded: 0, portal: 0, gap: 0, other: 0 }
  for (const line of text.split('\n')) {
    const s = line.trim()
    if (!s) continue
    let r
    try {
      r = JSON.parse(s)
    } catch {
      continue
    }
    if (r.status === 'aligned' && typeof r.web === 'string' && typeof r.rn === 'string') rows.push(r)
    else if (r.status === 'excluded') skipped.excluded += 1
    else if (r.status === 'portal') skipped.portal += 1
    else if (r.status === 'gap') skipped.gap += 1
    else skipped.other += 1
  }
  return { rows, skipped }
}

/** 扁平化 zh-CN 消息表(JSON.parse 本身 last-wins,与 next-intl 运行时一致)。 */
export function flattenMessages(obj, prefix = '', out = new Map()) {
  if (obj === null || typeof obj !== 'object') return out
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') out.set(key, v)
    else if (v && typeof v === 'object') flattenMessages(v, key, out)
  }
  return out
}

/** 取 web 文件的 i18n 键(命名空间感知)。返回 `{keys:Set, unresolved:string[]}`。 */
export function extractWebKeys(text, messages) {
  const masked = maskComments(text)
  const bindings = new Map()
  const bindRe =
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:await\s+)?(?:use|get)Translations\s*(?:<[^>]*>)?\s*\(\s*(?:'([^']*)'|"([^"]*)"|\{[\s\S]{0,160}?namespace\s*:\s*['"]([^'"]+)['"])/g
  let m
  while ((m = bindRe.exec(masked))) bindings.set(m[1], m[2] || m[3] || m[4] || '')
  const keys = new Set()
  const unresolved = []
  const callRe = /([A-Za-z_$][\w$]*)(?:\.(?:rich|markup|has|raw))?\s*\(\s*(['"])([^'"]+)\2/g
  while ((m = callRe.exec(masked))) {
    const fn = m[1]
    if (!bindings.has(fn)) continue
    const ns = bindings.get(fn)
    const key = m[3]
    const composed = ns && !key.startsWith(`${ns}.`) ? `${ns}.${key}` : key
    if (messages.has(composed)) keys.add(composed)
    else if (messages.has(key)) keys.add(key)
    else unresolved.push(ns ? `${ns}.${key}` : key)
  }
  return { keys, unresolved }
}

/** 取 RN 文件的 i18n 键(共享屏的 t 由宿主注入,不认绑定声明,直接认 `t('全键')`)。 */
export function extractRnKeys(text, messages) {
  const masked = maskComments(text)
  const keys = new Set()
  const unresolved = []
  const callRe = /\bt\s*\(\s*(['"])([^'"]+)\1/g
  let m
  while ((m = callRe.exec(masked))) {
    const key = m[2]
    if (messages.has(key)) keys.add(key)
    else if (key.includes('.')) unresolved.push(key)
  }
  return { keys, unresolved }
}

/** 归一化比较用文案:只压空白,其余逐字比对(不做同义词/标点归一,宁少报不误报)。 */
export function normalizeCopy(s) {
  return String(s).replace(/\s+/g, ' ').trim()
}

/** B3 同义比较用归一化:大小写、标点、空白、单位写法、占位符顺序统统压平(保留占位符本身)。 */
export function normalizeSemanticCopy(s) {
  const holes = []
  let out = String(s)
    .toLowerCase()
    .replace(/\{[^}]*\}/g, (m) => {
      holes.push(m.replace(/\s/g, ''))
      return '\u0000'
    })
    .replace(/[，,。.、；;：:！!？?、"'“”‘’()（）【】[\]\-_/\\|]/g, '')
    .replace(/\s+/g, '')
    .replace(/小时|時|hours?/g, 'h')
    .replace(/分钟|minutes?|mins?|分/g, 'm')
  holes.sort()
  out = out.split('\u0000').join('#')
  return `${out}|${holes.join(',')}`
}

/**
 * 取 RN 文件里**用户可见位置**的中文硬编码。
 * 只认 JSX 文本节点与具名属性字面量;代码字符串/日志/参数一律不在射程。
 */
export function extractHardcodedChinese(text) {
  const masked = maskComments(text)
  const out = []
  // ① JSX 文本节点:`>中文<`;排除表达式区(含 = ; { } 或语句片段的区间)。
  const textRe = />([^<>{}]+)</g
  let m
  while ((m = textRe.exec(masked))) {
    const raw = m[1]
    if (!CJK_RE.test(raw)) continue
    const t = raw.trim()
    if (!t) continue
    if (/=>|===|!==|\bconst\b|;/.test(t)) continue
    out.push({ kind: 'jsx-text', value: normalizeCopy(t), line: lineAt(masked, m.index + 1) })
  }
  // ② 具名用户可见属性:`placeholder="中文"` / `accessibilityLabel={'中文'}`。
  const attrRe = new RegExp(
    `\\b(${USER_FACING_ATTRS.join('|')})\\s*=\\s*(?:(["'])([^"']*)\\2|\\{\\s*(["'])([^"']*)\\4\\s*\\})`,
    'g',
  )
  while ((m = attrRe.exec(masked))) {
    const value = m[3] !== undefined ? m[3] : m[5]
    if (!value || !CJK_RE.test(value)) continue
    out.push({ kind: `attr:${m[1]}`, value: normalizeCopy(value), line: lineAt(masked, m.index) })
  }
  return out
}

/** 键名落在哪个语义族(去掉命名空间后按 keyRe 匹配)。 */
function familyForKey(key) {
  const tail = String(key).split('.').pop()
  return SYNONYM_FAMILIES.find((f) => f.keyRe.test(key) || f.keyRe.test(tail)) || null
}

/** 文案值命中了哪个语义族(按该族术语表)。 */
function familyForValue(value) {
  return (
    SYNONYM_FAMILIES.find((f) => f.terms.some((term) => String(value).includes(term))) || null
  )
}

/**
 * 纯判据:同屏比较 ⇒ `{blocking, advisory, b3, accepted}`。测试直接喂键集/硬编码,不读盘。
 * - blocking: B1 同屏同文案硬编码
 * - advisory: B2 同值异键(已剔除通用键白名单/同尾段命名约定/角色裁决)
 * - b3: B3 同义键异值(语义族配对 + 归一化取值比较)
 * - accepted: 已裁决/已豁免(B2 通用键复用、命名约定、同字不同义)
 */
export function judgeScreen({ web, rn, webKeys, rnKeys, hardcoded }, messages) {
  const blocking = []
  const advisory = []
  const b3 = []
  const accepted = []
  const webValueKeys = new Map()
  for (const key of webKeys) {
    const v = messages.get(key)
    if (typeof v !== 'string' || !CJK_RE.test(v)) continue
    const n = normalizeCopy(v)
    if (!webValueKeys.has(n)) webValueKeys.set(n, [])
    webValueKeys.get(n).push(key)
  }
  for (const h of hardcoded) {
    const hit = webValueKeys.get(h.value)
    if (hit) {
      blocking.push({
        rule: 'B1-hardcoded-cjk',
        file: web,
        rn,
        line: h.line,
        value: h.value,
        webKeys: hit,
        detail: `${h.kind} 与 web 键 ${hit.slice(0, 3).join('/')} 译文逐字相同`,
      })
    }
    // B3 ①:硬编码值落在某语义族,而 web 同族键的归一化取值并不相同 ⇒ 同义不同值
    const fam = familyForValue(h.value)
    if (!fam) continue
    const famWebKeys = [...webKeys].filter((k) => familyForKey(k)?.id === fam.id)
    if (!famWebKeys.length) continue
    const hNorm = normalizeSemanticCopy(h.value)
    const equal = famWebKeys.some((k) => normalizeSemanticCopy(messages.get(k) || '') === hNorm)
    if (!equal) {
      b3.push({
        rule: 'B3-synonym-drift',
        file: web,
        rn,
        line: h.line,
        value: h.value,
        webKeys: famWebKeys,
        detail: `${h.kind}「${h.value}」与 web 同义族键 ${famWebKeys.slice(0, 3).join('/')} 取值不同(归一化后仍不同)`,
      })
    }
  }
  const rnKeyByValue = new Map()
  for (const key of rnKeys) {
    const v = messages.get(key)
    if (typeof v !== 'string' || !CJK_RE.test(v)) continue
    const n = normalizeCopy(v)
    if (!rnKeyByValue.has(n)) rnKeyByValue.set(n, [])
    rnKeyByValue.get(n).push(key)
  }
  for (const [value, rnList] of rnKeyByValue) {
    const webList = webValueKeys.get(value)
    if (!webList) continue
    for (const rk of rnList) {
      const other = webList.filter((wk) => wk !== rk)
      if (!other.length) continue
      const exemption = ROLE_EXEMPTIONS.find((e) => e.rn === rn && e.rnKey === rk)
      if (exemption) {
        accepted.push({
          rule: 'B2-accepted',
          file: web,
          rn,
          rnKey: rk,
          webKeys: other,
          value,
          reason: exemption.reason,
        })
        continue
      }
      if (COMMON_KEY_WHITELIST.has(rk)) {
        accepted.push({
          rule: 'B2-accepted',
          file: web,
          rn,
          rnKey: rk,
          webKeys: other,
          value,
          reason: '通用键复用:RN 直接复用 common.* 与 web 屏级键并存,不算命名漂移',
        })
        continue
      }
      if (other.some((wk) => wk.split('.').pop() === rk.split('.').pop())) {
        accepted.push({
          rule: 'B2-accepted',
          file: web,
          rn,
          rnKey: rk,
          webKeys: other,
          value,
          reason: '同尾段命名约定差:命名空间前缀不同、尾段同名,属可接受约定',
        })
        continue
      }
      advisory.push({
        rule: 'B2-key-diff',
        file: web,
        rn,
        rnKey: rk,
        webKeys: other,
        value,
        detail: `RN ${rk} 与 web ${other.slice(0, 3).join('/')} 译文相同但键不同`,
      })
    }
  }
  // B3 ②:RN 键与 web 键同语义族但键名不同 ⇒ 归一化后比较取值
  for (const rk of rnKeys) {
    const fam = familyForKey(rk)
    if (!fam) continue
    const rnVal = messages.get(rk)
    if (typeof rnVal !== 'string' || !CJK_RE.test(rnVal)) continue
    const famWebKeys = [...webKeys].filter((k) => k !== rk && familyForKey(k)?.id === fam.id)
    if (!famWebKeys.length) continue
    const rnNorm = normalizeSemanticCopy(rnVal)
    const same = famWebKeys.filter((k) => normalizeSemanticCopy(messages.get(k) || '') === rnNorm)
    if (!same.length) {
      const exemption = ROLE_EXEMPTIONS.find((e) => e.rn === rn && e.rnKey === rk)
      if (exemption) {
        accepted.push({
          rule: 'B3-accepted',
          file: web,
          rn,
          rnKey: rk,
          webKeys: famWebKeys,
          value: rnVal,
          reason: exemption.reason,
        })
        continue
      }
      b3.push({
        rule: 'B3-synonym-drift',
        file: web,
        rn,
        rnKey: rk,
        value: rnVal,
        webKeys: famWebKeys,
        detail: `RN ${rk}「${rnVal}」与 web 同义族键 ${famWebKeys.slice(0, 3).join('/')} 归一化后取值仍不同`,
      })
    }
  }
  return { blocking, advisory, b3, accepted }
}

/**
 * 台账判序:到期即红;认领数少于现读 ⇒ 红;多于现读 ⇒ advisory(腐烂)。
 * scopeFiles 非空时(仅 staged 档用),只对这批屏做"认领 vs 现读",过期/缺字段仍全量判。
 * @param {Array<{rule:string,file:string}>} violations
 * @param {Array<{file:string,rule:string,count?:number,owner?:string,expires?:string,evidence?:string}>} entries
 */
export function judgeLedger(violations, entries, { today, scopeFiles = null }) {
  const red = []
  const advisory = []
  const expired = []
  const malformed = []
  for (const e of entries) {
    const label = `${e?.file || '?'} [${e?.rule || '?'}]`
    if (typeof e?.owner !== 'string' || !e.owner.trim()) malformed.push(`条目缺 owner:${label}`)
    if (typeof e?.evidence !== 'string' || !e.evidence.trim()) malformed.push(`条目缺 evidence:${label}`)
    if (typeof e?.expires !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.expires))
      malformed.push(`条目缺 expires(YYYY-MM-DD):${label}`)
    else if (e.expires < today) expired.push(`${label} 于 ${e.expires} 到期`)
  }
  const keyOf = (file, rule) => `${file}::${rule}`
  const counts = new Map()
  for (const v of violations) counts.set(keyOf(v.file, v.rule), (counts.get(keyOf(v.file, v.rule)) || 0) + 1)
  const quota = new Map()
  for (const e of entries) {
    if (typeof e?.file !== 'string' || typeof e?.rule !== 'string') {
      malformed.push(`条目缺 file/rule:${JSON.stringify(e).slice(0, 80)}`)
      continue
    }
    quota.set(keyOf(e.file, e.rule), Number.isInteger(e.count) ? e.count : 1)
  }
  for (const [k, n] of counts) {
    const q = quota.get(k) || 0
    if (n > q) red.push(`${k.replace('::', ' [')}] 现读 ${n} 处,账本认领 ${q} 处`)
  }
  for (const [k, q] of quota) {
    if (scopeFiles && !scopeFiles.has(k.slice(0, k.indexOf('::')))) continue
    const n = counts.get(k) || 0
    if (n < q) advisory.push(`${k.replace('::', ' [')}] 账本认领 ${q} 处,现读 ${n} 处 ⇒ 清单腐烂(复核后下调或删除)`)
    if (n === 0) advisory.push(`${k.replace('::', ' [')}] 已不再命中 ⇒ 条目可销账`)
  }
  return { red, advisory, expired, malformed }
}

/** 同屏 web 文件集:路由 page.tsx 所在目录整棵子树的 ts/tsx(排除测试)。 */
export function listScreenFiles(webPageRel) {
  const dir = dirname(join(REPO, webPageRel))
  if (!existsSync(dir)) return []
  const out = []
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const abs = join(d, name)
      if (statSync(abs).isDirectory()) {
        if (name === '__tests__' || name === '__mocks__') continue
        walk(abs)
        continue
      }
      if (!/\.(ts|tsx)$/.test(name) || /\.(test|spec)\.(ts|tsx)$/.test(name)) continue
      out.push(relative(REPO, abs).replace(/\\/g, '/'))
    }
  }
  walk(dir)
  return out.sort()
}

/** 暂存区文件清单(staged 档只判本次动到的屏);git 不可用 ⇒ null(调用方未判定)。 */
export function touchedFiles() {
  try {
    const out = execFileSync('git', ['-c', 'safe.directory=*', 'diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
      cwd: REPO,
      encoding: 'utf8',
      maxBuffer: 1 << 26,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    return new Set(out.split('\n').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/\\/g, '/')))
  } catch {
    return null
  }
}

function lineAt(src, idx) {
  return src.slice(0, idx).split('\n').length
}

function todayStr() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function readLedger(path = join(REPO, LEDGER_REL)) {
  if (!existsSync(path)) return null
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'))
    return Array.isArray(raw.entries) ? raw.entries : null
  } catch {
    return null
  }
}

/** 账本里的已裁决清单(A/B/E 键空间决策),只用于读数展示,不参与配额判序。 */
export function readLedgerDecisions(path = join(REPO, LEDGER_REL)) {
  if (!existsSync(path)) return []
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'))
    return Array.isArray(raw.decisions) ? raw.decisions : []
  } catch {
    return []
  }
}

/** 自检:每条判据一正一反 + 动态键盲区 + 干净样本 + 台账到期。 */
export function runSelfTest() {
  const messages = new Map([
    ['wallet.balance', '余额'],
    ['wallet.frozen', '冻结金额'],
    ['wallet.title', '我的钱包'],
    ['common.save', '保存'],
    ['wallet.save', '保存'],
    ['wallet.flowsTitle', '资金流水'],
    ['wallet.retryRecharge', '重新充值'],
    ['common.retry', '重试'],
    ['wallet.retryLabel', '重试'],
    ['common.loading', '加载中'],
    ['home.loadingText', '加载中'],
    ['wallet.payMethod', '支付方式'],
    ['wallet.rechargeMethod', '充值方式'],
  ])
  const cases = []
  const expect = (cond, msg) => {
    if (!cond) throw new Error(msg)
  }
  const ok = (name, fn) => {
    try {
      fn()
      cases.push(`  ✅ ${name}`)
    } catch (e) {
      cases.push(`  ❌ ${name}: ${e.message}`)
      throw e
    }
  }

  ok('① 同屏同文案:web 有 wallet.balance、RN 硬编码「余额」⇒ 红', () => {
    const r = judgeScreen(
      {
        web: 'wallet',
        rn: 'rn/WalletScreen.tsx',
        webKeys: new Set(['wallet.balance']),
        rnKeys: new Set(),
        hardcoded: [{ kind: 'jsx-text', value: '余额', line: 10 }],
      },
      messages,
    )
    expect(r.blocking.length === 1 && r.blocking[0].rule === 'B1-hardcoded-cjk', '同文案硬编码未判红')
  })
  ok('② 属性位硬编码:placeholder=「余额」⇒ 红', () => {
    const r = judgeScreen(
      {
        web: 'wallet',
        rn: 'rn/X.tsx',
        webKeys: new Set(['wallet.balance']),
        rnKeys: new Set(),
        hardcoded: [{ kind: 'attr:placeholder', value: '余额', line: 3 }],
      },
      messages,
    )
    expect(r.blocking.length === 1, '属性位未判红')
  })
  ok('③ 同值异键(同尾段):RN wallet.save 与 web common.save ⇒ 已裁决的命名约定', () => {
    const r = judgeScreen(
      { web: 'wallet', rn: 'rn/X.tsx', webKeys: new Set(['common.save']), rnKeys: new Set(['wallet.save']), hardcoded: [] },
      messages,
    )
    expect(r.blocking.length === 0, '同值异键被误判 blocking')
    expect(
      r.advisory.length === 0 && r.accepted.length === 1 && r.accepted[0].rule === 'B2-accepted',
      '同尾段命名约定未进已裁决',
    )
  })
  ok('④ 同键:两侧都用 wallet.balance ⇒ 不报', () => {
    const r = judgeScreen(
      {
        web: 'wallet',
        rn: 'rn/X.tsx',
        webKeys: new Set(['wallet.balance']),
        rnKeys: new Set(['wallet.balance']),
        hardcoded: [],
      },
      messages,
    )
    expect(r.blocking.length === 0 && r.advisory.length === 0, '同键被误报')
  })
  ok('⑤ 干净样本:RN 全取词、web 全取词 ⇒ 全绿', () => {
    const r = judgeScreen(
      {
        web: 'wallet',
        rn: 'rn/X.tsx',
        webKeys: new Set(['wallet.balance', 'wallet.title']),
        rnKeys: new Set(['wallet.balance', 'wallet.title']),
        hardcoded: [],
      },
      messages,
    )
    expect(r.blocking.length === 0 && r.advisory.length === 0, `干净样本被报:${JSON.stringify(r)}`)
  })
  ok('⑥ 中文硬编码但 web 无同值键 ⇒ 不判红(RN 自有文案)', () => {
    const r = judgeScreen(
      {
        web: 'wallet',
        rn: 'rn/X.tsx',
        webKeys: new Set(['wallet.balance']),
        rnKeys: new Set(),
        hardcoded: [{ kind: 'jsx-text', value: '这段 web 没有', line: 9 }],
      },
      messages,
    )
    expect(r.blocking.length === 0, 'RN 自有文案被误判')
  })
  ok('⑦ 命名空间合成:web useTranslations(wallet)+t(balance) ⇒ wallet.balance', () => {
    const r = extractWebKeys("const t = useTranslations('wallet')\nconst x = t('balance')", messages)
    expect(r.keys.has('wallet.balance'), `键未合成:${[...r.keys]}`)
  })
  ok('⑧ 动态键/未知键 ⇒ 落 unresolved,不冒充命中', () => {
    const r = extractWebKeys("const t = useTranslations('wallet')\nconst x = t(`k.${name}`)", messages)
    expect(r.keys.size === 0, '动态键被当成命中')
  })
  ok('⑨ 注释里的假标签/中文 ⇒ 不判(遮罩生效)', () => {
    const src = '// <Text>余额</Text>\nconst A = () => <Text>ok</Text>'
    const h = extractHardcodedChinese(src)
    expect(h.length === 0, `注释被读成硬编码:${JSON.stringify(h)}`)
  })
  ok('⑩ RN 取词键只认 t(字面量) ⇒ 注释里的 t("x") 不算', () => {
    const r = extractRnKeys('// t("wallet.balance")\nconst v = t("wallet.title")', messages)
    expect(r.keys.size === 1 && r.keys.has('wallet.title'), `注释被计入:${[...r.keys]}`)
  })
  ok('⑪ 台账:到期即红 + 认领差额', () => {
    const j = judgeLedger(
      [
        { file: 'wallet', rule: 'B1-hardcoded-cjk' },
        { file: 'wallet', rule: 'B1-hardcoded-cjk' },
      ],
      [{ file: 'wallet', rule: 'B1-hardcoded-cjk', count: 1, owner: 'o', expires: '2099-01-01', evidence: 'e' }],
      { today: '2026-11-03' },
    )
    expect(j.red.length === 1, '认领差额未判红')
    const ex = judgeLedger(
      [],
      [{ file: 'wallet', rule: 'B1-hardcoded-cjk', count: 0, owner: 'o', expires: '2020-01-01', evidence: 'e' }],
      { today: '2026-11-03' },
    )
    expect(ex.expired.length === 1, '到期未点名')
  })
  ok('⑫ 台账缺字段 ⇒ 点名(不静默放行);scopeFiles 只判本次审过的屏', () => {
    const j = judgeLedger([], [{ file: 'wallet', rule: 'B1-hardcoded-cjk' }], { today: '2026-11-03' })
    expect(j.malformed.length === 3, `缺字段未点名(${j.malformed.length}/3)`)
    const scoped = judgeLedger(
      [],
      [{ file: 'wallet', rule: 'B1-hardcoded-cjk', count: 3, owner: 'o', expires: '2099-01-01', evidence: 'e' }],
      { today: '2026-11-03', scopeFiles: new Set(['learn']) },
    )
    expect(scoped.advisory.length === 0, '未审过的屏不该刷清单腐烂')
  })

  ok('⑬ B3 反例:RN 硬编码「重试」vs web wallet.retryRecharge「重新充值」⇒ 同义异值', () => {
    const r = judgeScreen(
      {
        web: 'wallet',
        rn: 'package/app/src/features/topup-fail/TopupFailScreen.tsx',
        webKeys: new Set(['wallet.retryRecharge']),
        rnKeys: new Set(),
        hardcoded: [{ kind: 'jsx-text', value: '重试', line: 48 }],
      },
      messages,
    )
    expect(r.blocking.length === 0, 'B3 反例被误判 B1')
    expect(r.b3.length === 1 && r.b3[0].rule === 'B3-synonym-drift', '「重试」反例未被 B3 抓到')
  })
  ok('⑭ 通用键白名单:common.loading 复用 ⇒ 已裁决;白名单外的 retryLabel 仍报 B2', () => {
    const wl = judgeScreen(
      { web: 'home', rn: 'rn/X.tsx', webKeys: new Set(['home.loadingText']), rnKeys: new Set(['common.loading']), hardcoded: [] },
      messages,
    )
    expect(wl.advisory.length === 0, '通用键白名单仍在报 B2')
    expect(wl.accepted.length === 1, '通用键白名单未记入已裁决')
    const out = judgeScreen(
      { web: 'wallet', rn: 'rn/X.tsx', webKeys: new Set(['common.retry']), rnKeys: new Set(['wallet.retryLabel']), hardcoded: [] },
      messages,
    )
    expect(out.advisory.length === 1, '白名单之外未照常报 B2')
  })
  ok('⑮ B3 归一化:标点/大小写/单位/占位符顺序压平后一致 ⇒ 不报', () => {
    const punct = judgeScreen(
      {
        web: 'wallet',
        rn: 'rn/X.tsx',
        webKeys: new Set(['wallet.retryRecharge']),
        rnKeys: new Set(),
        hardcoded: [{ kind: 'jsx-text', value: '重新充值！', line: 1 }],
      },
      messages,
    )
    expect(punct.b3.length === 0, '标点差异被误报 B3')
    const same = normalizeSemanticCopy('剩余 {minutes} 分钟')
    const other = normalizeSemanticCopy('剩余{minutes}分')
    expect(same === other, `单位归一失效:${same} vs ${other}`)
  })

  console.log('🧪 web↔RN 措辞一致性门自检')
  for (const line of cases) console.log(line)
  console.log(`\n✅ ${cases.length}/${cases.length} 例通过`)
  return cases.length
}

export async function run({ mode = 'full', json = false } = {}) {
  const face = mode === 'staged' ? 'staged' : 'worktree'
  const mapText = readFace(MAP_REL, 'worktree')
  const messagesText = readFace(MESSAGES_REL, face) ?? readFace(MESSAGES_REL, 'worktree')
  if (!mapText || !messagesText) {
    console.error('❌ 台账行或 zh-CN 消息表取不到 ⇒ 未判定')
    process.exit(2)
  }
  const { rows, skipped } = loadAlignedRows(mapText)
  if (!rows.length) {
    console.error('❌ 台账没有 aligned 行 ⇒ 未判定(不把空集读成"零差异")')
    process.exit(2)
  }
  const messages = flattenMessages(JSON.parse(messagesText))
  const routes = new Map(parity.collectWebRoutes(face).map((r) => [r.route, r.rel]))
  const touched = mode === 'staged' ? touchedFiles() : null
  if (mode === 'staged' && !touched) {
    console.error('❌ 暂存区文件清单取不到(git 不可用)⇒ 未判定')
    process.exit(2)
  }
  const blocked = []
  const advisories = []
  const b3List = []
  const acceptedList = []
  const undetermined = []
  const auditedScreens = new Set()
  let webFileCount = 0
  let unresolvedKeys = 0
  let untouched = 0

  for (const row of rows) {
    const pageRel = routes.get(row.web)
    if (!pageRel) {
      undetermined.push(`${row.web}: 路由在 web 面取不到`)
      continue
    }
    // staged 档只判「本次动到的屏」:RN 文件本身在索引里,或该屏 web 目录下有文件在索引里。
    if (touched) {
      const dir = `${dirname(pageRel).replace(/\\/g, '/')}/`
      const hit = touched.has(row.rn) || [...touched].some((f) => f.startsWith(dir))
      if (!hit) {
        untouched += 1
        continue
      }
    }
    const rnText = readFace(row.rn, face)
    if (typeof rnText !== 'string') {
      undetermined.push(`${row.web}: RN 文件取不到(${row.rn})`)
      continue
    }
    auditedScreens.add(row.web)
    const webKeys = new Set()
    for (const rel of listScreenFiles(pageRel)) {
      const text = readFace(rel, face)
      if (typeof text !== 'string') continue
      webFileCount += 1
      const r = extractWebKeys(text, messages)
      for (const k of r.keys) webKeys.add(k)
      unresolvedKeys += r.unresolved.length
    }
    const rn = extractRnKeys(rnText, messages)
    unresolvedKeys += rn.unresolved.length
    const hardcoded = extractHardcodedChinese(rnText)
    const judged = judgeScreen({ web: row.web, rn: row.rn, webKeys, rnKeys: rn.keys, hardcoded }, messages)
    for (const v of judged.blocking) blocked.push(v)
    for (const v of judged.advisory) advisories.push(v)
    for (const v of judged.b3) b3List.push(v)
    for (const v of judged.accepted) acceptedList.push(v)
  }

  // D 项去重:同一 RN 文件同一键会因多条 web 路由重复计数(113 vs 106 唯一键),按唯一键只记一次。
  const dedupeBy = (list, keyFn) => {
    const seen = new Set()
    const out = []
    let dup = 0
    for (const r of list) {
      const k = keyFn(r)
      if (seen.has(k)) {
        dup += 1
        continue
      }
      seen.add(k)
      out.push(r)
    }
    return { out, dup }
  }
  const b2Unique = dedupeBy(advisories, (r) => `${r.rn}|${r.rnKey}|${r.value}`)
  const b3Unique = dedupeBy(b3List, (r) => `${r.rn}|${r.rnKey || '@hardcode'}|${r.value}`)
  const acceptedUnique = dedupeBy(acceptedList, (r) => `${r.rn}|${r.rnKey}|${r.value}`)
  const advisoriesDeduped = b2Unique.out
  const b3Deduped = b3Unique.out

  const entries = readLedger()
  if (entries === null) {
    console.error(`❌ 台账读不到或形状坏:${LEDGER_REL} ⇒ 未判定`)
    process.exit(2)
  }
  const b1 = judgeLedger(blocked, entries.filter((e) => e?.rule === 'B1-hardcoded-cjk'), {
    today: todayStr(),
    scopeFiles: touched ? auditedScreens : null,
  })
  const b2 = judgeLedger(advisoriesDeduped, entries.filter((e) => e?.rule === 'B2-key-diff'), {
    today: todayStr(),
    scopeFiles: touched ? auditedScreens : null,
  })
  const b3 = judgeLedger(b3Deduped, entries.filter((e) => e?.rule === 'B3-synonym-drift'), {
    today: todayStr(),
    scopeFiles: touched ? auditedScreens : null,
  })
  // B1/B3 新增未挂账 ⇒ 红;B2 新增未记账仍只是 advisory(措辞建议不拦提交),但**过期/缺字段照样红**
  // —— 那是账本纪律,不是判据强度。
  const blockingRed = [
    ...b1.red,
    ...b1.expired,
    ...b1.malformed,
    ...b2.expired,
    ...b2.malformed,
    ...b3.red,
    ...b3.expired,
    ...b3.malformed,
  ]
  const ledgerAdvisory = [
    ...b1.advisory,
    ...b2.advisory,
    ...b3.advisory,
    ...b2.red.map((s) => `(B2 advisory,不阻提交) ${s}`),
    ...b3.red.map((s) => `(B3 advisory,不阻提交) ${s}`),
  ]

  if (json) {
    console.log(
      JSON.stringify(
        {
          face,
          screens: rows.length,
          untouchedScreens: untouched,
          webFiles: webFileCount,
          skipped,
          undetermined,
          unresolvedKeys,
          blocking: blocked.length,
          blockingDetail: blocked,
          advisory: advisoriesDeduped.length,
          advisoryDetail: advisoriesDeduped,
          b3: b3Deduped.length,
          b3Detail: b3Deduped,
          accepted: acceptedUnique.out.length,
          acceptedDetail: acceptedUnique.out,
          duplicates: { b2: b2Unique.dup, b3: b3Unique.dup, accepted: acceptedUnique.dup },
          ledger: {
            entries: entries.length,
            decisions: readLedgerDecisions(),
            b1Red: b1.red,
            b2Red: b2.red,
            expired: [...b1.expired, ...b2.expired],
            malformed: [...b1.malformed, ...b2.malformed],
            stale: ledgerAdvisory,
          },
        },
        null,
        2,
      ),
    )
  } else {
    console.log(
      `🔍 web↔RN 措辞一致性门(291) face=${face} aligned 屏 ${rows.length}${untouched ? ` / 本次未触及 ${untouched}` : ''} / web 文件 ${webFileCount}`,
    )
    console.log(
      `  B1 blocking:${blocked.length}  · B2 advisory:${advisoriesDeduped.length}(去重 ${b2Unique.dup} 条)  · B3 同义异值:${b3Deduped.length}  · 已裁决/豁免:${acceptedUnique.out.length}  · 未判定:${undetermined.length}  · 未解析键:${unresolvedKeys}`,
    )
    console.log(
      `  台账:${entries.length} 条;到期 ${b1.expired.length + b2.expired.length + b3.expired.length} / B1 认领差额 ${b1.red.length} / B3 认领差额 ${b3.red.length} / 缺字段 ${b1.malformed.length + b2.malformed.length + b3.malformed.length}`,
    )
    for (const v of blocked.slice(0, 25))
      console.log(`   ✗ ${v.file} ↔ ${v.rn}:${v.line} 「${v.value}」→ web 键 ${v.webKeys.slice(0, 3).join('/')}`)
    for (const line of blockingRed.slice(0, 20)) console.log(`   ✗ 台账:${line}`)
    for (const line of ledgerAdvisory.slice(0, 10)) console.log(`   ⚠ 台账:${line}`)
    for (const v of advisoriesDeduped.slice(0, 15)) console.log(`   ⚠ ${v.file} ↔ ${v.rn} [${v.rule}] ${v.detail}`)
    for (const v of b3Deduped.slice(0, 15)) console.log(`   ⚠ ${v.file} ↔ ${v.rn}:${v.line || '-'} [${v.rule}] ${v.detail}`)
    const decisions = readLedgerDecisions()
    if (decisions.length)
      console.log(
        `   已裁决(A/B/E):${decisions.map((d) => `${d.group}组 ${d.count} 条(${d.rule})`).join(' · ')}`,
      )
    for (const u of undetermined.slice(0, 10)) console.log(`   ⚠ 未判定:${u}`)
  }
  process.exit(blockingRed.length > 0 ? 1 : 0)
}

const argv = process.argv.slice(2)
if (argv.includes('--self-test')) {
  try {
    runSelfTest()
    process.exit(0)
  } catch (e) {
    console.error(String(e?.message || e))
    process.exit(1)
  }
}
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  run({ mode: argv.includes('--staged') ? 'staged' : 'full', json: argv.includes('--json') })
}

export const __test__ = {
  readFace,
  loadAlignedRows,
  flattenMessages,
  extractWebKeys,
  extractRnKeys,
  extractHardcodedChinese,
  judgeScreen,
  judgeLedger,
  listScreenFiles,
  touchedFiles,
  readLedger,
  runSelfTest,
  normalizeCopy,
  MAP_REL,
  MESSAGES_REL,
  LEDGER_REL,
  SKIP_ENV,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
