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
    // 2026-11-04 实测后加的三条。原四条全靠**动词短语**(改代码/补测试/写函数),而台账里的
    // 工程票标题是**名词短语**(「P86 提交链缺一道拦闸」「P84 …索引枚举仍未过 ignore_rules」
    // 「RP-91 给旁路收敛器物补『未知旗标 ⇒ 用法错』」)—— 一个动词都不含 ⇒ 四条全不命中
    // ⇒ 落 unknown ⇒ 停机。现读 12 枚可派单候选里 11 枚落 unknown、只有 1 枚自决,
    // 这才是"自主开发"真正的天花板(比票类白名单还窄)。
    // 安全性靠判定顺序保证:classifyAction 先扫 stop 命中,命中即停 ⇒ 自决侧加宽**不可能**
    // 覆盖掉任何一条停机类(成对反向锁见 check-human-valve.test.mjs)。
    /^\s*(?:[a-z]{1,4}-?\d{1,6}|p\d{1,3}\b|t\d{1,3}\b|rp-\d+|g-\d+|y-\d+|o\d+)\b/,
    /(?:缺|未有|仍未|尚未|没有|漏了)[^。；;\n]{0,20}(?:判据|守门|闸|拦闸|测试|用例|校验|断言|覆盖|接线|点名)/,
    /(?:新增|补|装|加)[^。；;\n]{0,12}(?:守门|判据|闸门|尺子|镜像测试|自检|夹具|回归锁)|(?:修|治)[^。；;\n]{0,8}假红/,
  ],
  // 2026-11-04 新装的停机类:**放宽**既有的闸与自决侧加宽是一对相反动作,前者必须等人。
  // 立因:上面对 code-and-docs 加宽之后,"改守门把某档调松/摘掉豁免"这类票也会被
  // 名词形态的自决匹配器接住 ⇒ 自治环可以自己去拆自己的刹车。本仓的刹车一旦被拆掉,
  // 后面所有门都不再可信(§12e:恒红门的唯一结局是逼人跳门,而恒绿的假门更糟)。
  // 所以:加闸 = 自决;减闸 = 停机等人。immutable-guard 只要求"声明",声明不等于批准,
  // 事后审计也不能把已经推上去的拆闸撤回来 ⇒ 必须前置拦。
  'guardrail-loosen': [
    /(?:放宽|调松|放松|降低|下调|取消|摘掉|摘除|删除|删掉|去掉|停用|关掉|注释掉)[^。；;\n]{0,16}(?:守门|判据|闸门|门\s*\d+|拦截|拦闸|校验|阻断|棘轮|豁免|白名单|基线|镜像测试|回归锁|接线锁|用例|断言)/,
    /(?:改成|改为|降为|降级为)[^。；;\n]{0,8}(?:warn|告警|只报数|不判红|观察|off|关闭)/i,
    /(?:新增|补)[^。；;\n]{0,12}(?:豁免条目|跳过变量|skipenv|no-verify)|常态化[^。；;\n]{0,8}跳门|默认跳门/i,
    /(?:上调|放宽)[^。；;\n]{0,12}(?:阈值|预算|上限|额度)|(?:摘掉|删除)[^。；;\n]{0,12}(?:镜像测试|回归锁|接线锁)/i,
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
    // 2026-11-04 实测补:上面那条只认"换 key"这个语序。探针「把 DEEPSEEK key 换成新的」
    // 当时判成 unknown ⇒ 危险动作为什么会漏,是因为票面习惯把对象写在动词前面。
    // 停机侧漏判 = 该停的没停,这是本清单里唯一会**放大** AI 自决范围的错,必须先补这一侧。
    /key\s*(?:换|更换|改成|更新|失效)|密钥\s*(?:换|更换|改成|更新)|(?:换|更换|吊销)[^。；;\n]{0,12}(?:key|密钥|凭据|secret)/i,
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
    // 下面两条是 2026-11-04 按**实测量**补的,不是推测:阀在 observe 档留痕 25 条,
    // 全部落 `unknown-fail-closed`,而它们的原文都是部署自愈票的措辞
    // ("B53 [deploy-feedback] … rollback /deploy/rollback 部署异常 ⇒ 排查链路并…")。
    // 本条规则的标题本来就写着"部署、重启、停服与配置变更" ⇒ 匹配器没盖住自己声明的范围,
    // 于是"该停机等人"被判对了,却报成"分类器没有规则" —— 这两件事的出路完全相反
    // (前者是该类票根本不该进自动派单面,后者是补匹配器),混在一起 A6 永远给不出可执行下一步,
    // 而 enforce 放量前置"未判定率归零"也因此结构性不可满足。
    // 方向纪律:本处只**加** stop 覆盖面 ⇒ 减少 AI 可自决的范围,不放宽任何一道闸。
    /回滚|回退到|rollback|revert\s*(?:生产|线上|main|上一)/i,
    /部署异常|部署失败|发布失败|切流失败|构建失败|建包失败|金丝雀[^。；;\n]{0,8}(?:异常|回退|失败|熔断)/,
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
 * 剥掉台账行上的**机器注记**(认领租约牌 / 释放牌 / 登记牌 / 反引号号码段外的注记括号)。
 * 立因:现读 12 枚可派单候选里 7 枚的标题以「（认领已释放@2026-11-04/stale-claim-strip#…）」开头,
 * 那是兜底清扫器加上去的,不是票面内容 ⇒ 任何按票面开头形态写的匹配器都被它挡掉。
 *
 * ⚠ 只在**并集**里用它,绝不用它替换原文(见 classifyAction):注记里万一混进危险词,
 *   拿剥完的文本单判就会把危险动作读成 self-serve —— 那是把 fail-closed 反向用。
 *   并集判定下剥文本只可能**增加** self 命中,而 stop 命中仍由原文保证 ⇒ 结果只会更严或持平。
 */
export function stripTicketAnnotations(text) {
  return String(text ?? '')
    .replace(/（[^（）]{0,80}?(?:认领已释放|进行中|登记|租约|待并入|副本)[^（）]{0,80}?）/g, ' ')
    .replace(/\([^()]{0,80}?(?:认领已释放|进行中|登记@|stale-claim-strip)[^()]{0,80}?\)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 判定入口。返回形状固定 {bucket, ruleId, reason}。
 * 判定顺序 = 先停机后自决:一段话里同时出现"改代码"和"换 API key"时必须停,不能因为先匹配到自决类就放行。
 * 匹配面 = 原文 ∪ 剥注记后的文本(两个形态各扫一遍,取并集)——理由见 stripTicketAnnotations:
 * 并集只会让 stop 更容易命中、让 self 有机会命中被注记挡掉的普通工程票,不会反过来放宽停机。
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
  const faces = [normalizeActionText(text), normalizeActionText(stripTicketAnnotations(text))].filter(
    (t, i, a) => t && a.indexOf(t) === i,
  )
  const today = todayIso(now)
  const hits = []
  for (const rule of rules) {
    if (!hasMatcher(rule.id)) continue
    if (MATCHERS[rule.id].some((re) => faces.some((f) => re.test(f)))) hits.push(rule)
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
  stripTicketAnnotations,
  auditValveList,
  hasMatcher,
  todayIso,
  isRealIsoDate,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
