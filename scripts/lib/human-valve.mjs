// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * human-valve — 人工阀分类器(自进化 P0,2026-10-25 立)。
 *
 * 做的事只有一件:把一段自由文本的动作描述分成两桶 ——
 *   self-serve(AI 可自决) / stop-for-human(安全停机等人工)。
 *
 * 为什么是"停机"不是"失败"(票面原话:安全停机而非硬失败):
 *   硬失败会让调用方重试、换参、绕行,失效方向是"多放一次跳门"(§0.10);
 *   停机是一个明确的终态 —— 不重试、不绕行、留响声等人,失效方向恒为"多要一次定向说明"。
 *
 * fail-closed 的三处入口(缺一不可,任一失效都等于把人工阀拆掉):
 *   1) 未知动作文本 ⇒ stop-for-human(ruleId = unknown-fail-closed),绝不当成 self-serve;
 *   2) 数据里新增了一类而本模块没有对应匹配器 ⇒ 该类永远拿不到 self-serve(无匹配器即无命中);
 *   3) 自决类 reviewBy 到期 ⇒ 自动降为 stop-for-human(§0.7 豁免验过才免且会到期)。
 *
 * 单一真相源(§0.6):
 *   桶的归属只写在 scripts/data/human-valve-list.json;
 *   "什么样的文本属于哪一类"只写在下面的 MATCHERS。
 *   两边用同一个 id 对齐,谁多出一行都会被 auditValveList 报成漂移。
 *   id 闭集查询(按 id 直接问"这条能不能干")另有 scripts/data/human-gates.json,
 *   本模块不复制它的判据,也不替它做 id 级判定。
 */

export const BUCKETS = Object.freeze({
  SELF_SERVE: 'self-serve',
  STOP_FOR_HUMAN: 'stop-for-human',
})

export const UNKNOWN_RULE_ID = 'unknown-fail-closed'

const RULE_ID_RE = /^[a-z0-9][a-z0-9-]*$/
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export class HumanValveDataError extends Error {
  constructor(message) {
    super(message)
    this.name = 'HumanValveDataError'
    this.code = 'HUMAN_VALVE_DATA_INVALID'
  }
}

/**
 * 匹配器登记表:一个 data 规则 id 对应一组正则。
 * 只判"文本像不像这一类";判成哪一桶由数据决定。
 * 没有登记匹配器的 data 规则在这张表上查不到 ⇒ 永远不命中 ⇒ 落到 unknown 停机,
 * 这正是"数据新增一类而 lib 没认出来"那条反向牙的落点。
 */
export const MATCHERS = Object.freeze({
  'code-and-docs': [
    /改代码|写代码|新增函数|实现功能|重构|修(?:复)?\s*bug|补(?:充)?(?:测试|用例|注释)/,
    /(?:补|加|写|新增)[^,。；;\n]{0,10}(?:函数|方法|模块|脚本|接口)/,
    /改文档|文档更新|注释|台账登记|登记一条|plan\.md/i,
    /git\s+commit|本地提交/,
  ],
  'local-verification': [
    /跑(?:一遍)?守门|guardian-runner|typecheck|lint|--self-test|自检|self-test/,
    /单元测试|集成测试|node\s+--test|pytest|跑测试/,
  ],
  'read-only-probe': [
    /只读|查询|查看|看一眼|巡检|探针|读取|grep|rg\b|git\s+log|git\s+show/,
    /日志|指标|status|端口存活|健康检查/,
  ],
  'api-key-change': [
    /api[\s_-]?key|apikey|密钥|密钥对|secret|dsn|凭据泄露/,
    /换(?:一)?(?:个)?\s*key|补(?:一个)?\s*key|吊销\s*key|新增\s*key/,
  ],
  'credential-rotation': [
    /轮换|rotate|rotation|重新签发|续签/,
    /(?:口令|密码|passphrase)\s*(?:更换|更新)|更换\s*(?:口令|密码)/,
  ],
  'console-operation': [
    /控制台|console|后台面板|管理后台配置/,
    /\bdns\b|域名|解析记录|计费|账单|带宽套餐|隧道|cloudflare|vercel|阿里云|腾讯云|aws|azure/i,
  ],
  'device-scan': [/扫码|扫一扫|二维码|真机|实体设备/, /手机上|用手机|面对面人验/],
  'public-release-wording': [
    /对外发布|发布口径|公告|商店文案|版本说明|法务|免责声明|官网对外/,
    /发一封.*(?:邮件|公告)|客户通知|新闻稿/,
  ],
  'production-deploy': [
    /生产机|生产环境|线上环境|线上部署|部署到(?:生产|线上)|上线部署|发版上线/,
    /重启\s*(?:线上|生产|api|web|ai-service)|\bnssm\b|停服|停机维护/,
  ],
  'destructive-git-or-data': [
    /删[^,。；;\n]{0,16}分支|branch\s+-[dD]\b|删\s*worktree/,
    /reset\s+--hard|强推|force[-\s]?push|rebase\s+-i|filter-branch/,
    /删[^,。；;\n]{0,16}(?:数据|数据库|库表|表记录|备份|归档)|drop\s+table|truncate|rm\s+-rf/i,
  ],
  'external-system-write': [
    /第三方[^。；;\n]{0,12}(?:写入|提交|同步|推送)/,
    /webhook|工单系统|运维群|机器人消息|群消息|cdn\s*(?:刷新|预热)|提\s*pr|发起合并请求/i,
  ],
})

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HumanValveDataError(`${label} 必须是非空字符串`)
  }
  return value.trim()
}

function isRealIsoDate(text) {
  if (!ISO_DATE_RE.test(text)) return false
  const [y, m, d] = text.split('-').map(Number)
  // 用 UTC 构造再回读:防 2026-02-31 这类"格式对、日历不存在"的日期混过形状检查。
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** 把原始 JSON 文本解成规则表;任何形状问题一律抛 HumanValveDataError(调用方落 exit 2 未判定,不猜)。 */
export function parseValveList(rawText) {
  if (typeof rawText !== 'string' || rawText.trim() === '') {
    throw new HumanValveDataError('人工阀清单为空')
  }
  let doc
  try {
    doc = JSON.parse(rawText)
  } catch (e) {
    throw new HumanValveDataError(`人工阀清单不是合法 JSON:${e?.message ?? e}`)
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new HumanValveDataError('人工阀清单顶层必须是对象')
  }
  if (!Array.isArray(doc.rules) || doc.rules.length === 0) {
    throw new HumanValveDataError('人工阀清单 rules 必须是非空数组')
  }
  const seen = new Set()
  const rules = doc.rules.map((raw, index) => {
    const at = `rules[${index}]`
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new HumanValveDataError(`${at} 必须是对象`)
    }
    const id = requireNonEmptyString(raw.id, `${at}.id`)
    if (!RULE_ID_RE.test(id)) throw new HumanValveDataError(`${at}.id「${id}」形态非法`)
    if (seen.has(id)) throw new HumanValveDataError(`${at}.id「${id}」重复登记`)
    seen.add(id)
    const bucket = requireNonEmptyString(raw.bucket, `${at}.bucket`)
    if (bucket !== BUCKETS.SELF_SERVE && bucket !== BUCKETS.STOP_FOR_HUMAN) {
      throw new HumanValveDataError(
        `${at}.bucket「${bucket}」不在 ${Object.values(BUCKETS).join(' / ')} 内`,
      )
    }
    if (!Array.isArray(raw.examples) || raw.examples.length === 0) {
      throw new HumanValveDataError(`${at}.examples 必须是非空数组`)
    }
    raw.examples.forEach((ex, i) => requireNonEmptyString(ex, `${at}.examples[${i}]`))
    const reviewBy = requireNonEmptyString(raw.reviewBy, `${at}.reviewBy`)
    if (!isRealIsoDate(reviewBy)) {
      throw new HumanValveDataError(
        `${at}.reviewBy「${reviewBy}」不是有效的 YYYY-MM-DD(§0.7 必填且会到期)`,
      )
    }
    return Object.freeze({
      id,
      title: requireNonEmptyString(raw.title, `${at}.title`),
      bucket,
      examples: Object.freeze(raw.examples.map((ex) => ex.trim())),
      why: requireNonEmptyString(raw.why, `${at}.why`),
      reviewBy,
    })
  })
  return Object.freeze({
    version: Number.isInteger(doc.version) ? doc.version : 1,
    updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : '',
    rules: Object.freeze(rules),
  })
}

/** 归一化:ASCII 小写 + 全角空格/空白折叠,避免「Delete  Branch」与「delete branch」判成两类。 */
export function normalizeActionText(text) {
  return String(text)
    .replace(/\u3000/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function todayIso(now = new Date()) {
  const dt = now instanceof Date ? now : new Date(now)
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dt)
}

export function hasMatcher(ruleId) {
  return Object.prototype.hasOwnProperty.call(MATCHERS, ruleId)
}

/**
 * 数据 ↔ 匹配器登记表的双向对账(自检用,不参与单次判定):
 *   - 自决类没有匹配器 ⇒ 该类的例子永远判成 unknown ⇒ 自检必须报出来;
 *   - 匹配器在数据里消失 ⇒ 这一类从语料里被删了,同样要求人看。
 * 返回 problems 供 CLI 打印并置红;判定本身不受影响(仍 fail-closed)。
 */
export function auditValveList(rules, { now = new Date() } = {}) {
  const problems = []
  const today = todayIso(now)
  const dataIds = new Set()
  for (const rule of rules) {
    dataIds.add(rule.id)
    if (!hasMatcher(rule.id)) {
      problems.push(
        rule.bucket === BUCKETS.SELF_SERVE
          ? `规则「${rule.id}」声明 self-serve 但本模块没有匹配器 ⇒ 永远判不到,只能落 unknown 停机`
          : `规则「${rule.id}」没有匹配器 ⇒ 该类的文本只能靠 unknown 兜底停机`,
      )
    }
    if (rule.bucket === BUCKETS.SELF_SERVE && rule.reviewBy < today) {
      problems.push(`规则「${rule.id}」reviewBy=${rule.reviewBy} 已过期,self-serve 正在失效`)
    }
  }
  for (const id of Object.keys(MATCHERS)) {
    if (!dataIds.has(id)) problems.push(`匹配器「${id}」在清单里没有对应规则 ⇒ 数据与判据漂移`)
  }
  return Object.freeze({ ok: problems.length === 0, problems: Object.freeze(problems), today })
}

/**
 * 判定入口。返回形状固定 {bucket, ruleId, reason}。
 * 判定顺序 = 先停机后自决:一段话里同时出现"改代码"和"换 API key"时必须停,不能因为先匹配到自决类就放行。
 */
export function classifyAction(actionText, { rules, now = new Date() } = {}) {
  if (!Array.isArray(rules) || rules.length === 0) {
    // 没有规则表就无法判定 ⇒ 抛给调用方落 exit 2,绝不返回 self-serve。
    throw new HumanValveDataError('classifyAction 需要非空规则表(数据取不到 = 未判定,不猜)')
  }
  const text = typeof actionText === 'string' ? actionText.trim() : ''
  if (text === '') {
    return stopVerdict(UNKNOWN_RULE_ID, '动作描述为空,无法判定 ⇒ 安全停机等人工补全描述')
  }
  const normalized = normalizeActionText(text)
  const today = todayIso(now)
  const hits = []
  for (const rule of rules) {
    if (!hasMatcher(rule.id)) continue
    if (MATCHERS[rule.id].some((re) => re.test(normalized))) hits.push(rule)
  }
  const stopHit = hits.find((rule) => rule.bucket === BUCKETS.STOP_FOR_HUMAN)
  if (stopHit) {
    return stopVerdict(
      stopHit.id,
      `命中人工阀「${stopHit.title}」⇒ 安全停机等人工(不重试、不绕行)。为什么不自决:${stopHit.why}`,
    )
  }
  const selfHits = hits.filter((rule) => rule.bucket === BUCKETS.SELF_SERVE)
  const freshSelfHit = selfHits.find((rule) => rule.reviewBy >= today)
  if (freshSelfHit) {
    return Object.freeze({
      bucket: BUCKETS.SELF_SERVE,
      ruleId: freshSelfHit.id,
      reason: `命中自决类「${freshSelfHit.title}」⇒ 可自决(复核期限 ${freshSelfHit.reviewBy})`,
    })
  }
  if (selfHits.length > 0) {
    const expired = selfHits[0]
    return stopVerdict(
      expired.id,
      `自决类「${expired.title}」的 reviewBy=${expired.reviewBy} 已过期 ⇒ 降级为安全停机,须人工重新定档`,
    )
  }
  return stopVerdict(
    UNKNOWN_RULE_ID,
    '动作不在已知清单内 ⇒ 停机等人(未知动作一律 stop-for-human,这是 fail-closed 的第一处入口)',
  )
}

function stopVerdict(ruleId, reason) {
  return Object.freeze({ bucket: BUCKETS.STOP_FOR_HUMAN, ruleId, reason })
}

// §22c:导出的必须是判据本身,测试直接 import 它们,禁止另抄一份判定逻辑。
export const __test__ = {
  BUCKETS,
  UNKNOWN_RULE_ID,
  MATCHERS,
  parseValveList,
  classifyAction,
  normalizeActionText,
  auditValveList,
  hasMatcher,
  todayIso,
  isRealIsoDate,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
