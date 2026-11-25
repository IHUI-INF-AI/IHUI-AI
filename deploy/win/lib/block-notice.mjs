// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 拦截告知文案(2026-11-24 立;同日两轮强化:双语 → 计数个性化)。
 *
 * 目的:攻击者被拦时不该只看到一个干巴巴的 `forbidden`。要让他**自己就能验证**
 * 「我被识别了、我被留证了、我继续只是给自己加证据」—— 这三件事都是我们真做到了的,
 * 所以说得越具体,威慑越硬;反之,说一句没法验证的狠话,对方一试就穿,等于自曝虚张。
 *
 * 计数档位(二轮强化):`attempt` 由 router 的 ledger 给出。同一个人第二次起,
 * 文案会引用**他上一次拿到的证据编号** —— 声明可以不信,"你上次是 EV-xxxx"没法不信,
 * 那个编号就在他手上。第 5 次起换成"你已在册 N 次",落点从劝阻改为陈述。
 *
 * 五条自我约束(写给后来改文案的人):
 *   ① **不冒充国家机关**:可写「按国安级对抗标准建设」(本项目自定等级),
 *      不得写「我们是国家安全机关」「国安局认证」,英文同样禁 `national security agency`
 *      ——那属冒充,是法律风险而非风格问题;
 *   ② **每句话都要有事实支撑**:文案说"已封入证据链"就必须真有记录(`ref` 落盘并当日入链);
 *      说"第 N 次"就必须真的数过(ledger 计数,重启可从日志重建);
 *   ③ **不泄露防御细节**:不写规则 id / 阈值 / 端口 / 内部路径 —— 那是把绕过说明送给对手;
 *   ④ **双语同时给,不按 Accept-Language 挑**:扫描器多数不带语言头,只发一种语言
 *      等于对一半对手失语;
 *   ⑤ **不写"已报警""已移交"**:本项目只做阻断+取证+上报能力,不主张已发生的事。
 *
 * 纯函数 + 零 IO(落盘与计数在 router / ledger):便于 node:test 钉住文案与形态。
 */
import { createHash } from 'node:crypto'

export const NOTICE_VERSION = 3

/** 等级名:中文进 body,英文进 body 与 ASCII 响应头。这是本项目的自定安全等级,不是任何机关认证。 */
export const NOTICE_LEVEL = '国安级网络对抗标准'
export const NOTICE_LEVEL_EN = 'NATIONAL-GRADE ADVERSARIAL STANDARD'

/** 语言顺序:英文在前(国际读者),中文在后(母语读者)。两段都给,不按语言头挑。 */
const LANG_ORDER = ['en', 'zh']

/**
 * 基础文案:三段固定结构(判定 → 已固定 → 继续的代价),最后一句是落点。
 * 英文按英文语感写,不做中文直译(直译读起来像机器,威慑力反而弱)。
 */
const COPY = {
  zh: {
    verdict: '你的请求已被识别为攻击,在到达任何业务逻辑之前被终止。',
    verdictRate: '你发得太快了。限流已生效 —— 继续加压只会延长你自己的封禁期。',
    sections: [
      {
        tag: '已固定',
        lines: ['来源 IP / ASN / 请求载荷 / 精确时间,已封入防篡改哈希链。', '证据编号可被任何第三方核验,事后无法修改。'],
      },
      {
        tag: '继续的代价',
        lines: ['本站不是一台服务器,是三道独立防线组成的同一个体系。', '你每再发一次,只是在自己的证据卷宗里再加一页。'],
      },
    ],
    punch: ['别妄想攻击。', '你不是在攻击一台服务器 —— 你是在给自己立卷。'],
  },
  en: {
    verdict: 'Your request was identified as an attack and terminated before it reached any application logic.',
    verdictRate: 'You are sending too fast. The rate limit is in force — pushing harder only extends your own ban.',
    sections: [
      {
        tag: 'PRESERVED',
        lines: [
          'Source IP, ASN, payload and exact timestamp are sealed into a tamper-evident hash chain.',
          'The evidence ID is verifiable by any third party and cannot be altered after the fact.',
        ],
      },
      {
        tag: 'THE COST OF CONTINUING',
        lines: [
          'This site is not a single server. It is three independent defense layers acting as one system.',
          'Every further request only adds another page to your own case file.',
        ],
      },
    ],
    punch: ['Abandon the attempt.', 'You are not attacking a server — you are building a case file against yourself.'],
  },
}

/** 重复档:第 2–4 次,引用上一次编号(他能自己核对,所以这句话不可反驳)。 */
function repeatSection(lang, attempt, prevRef) {
  const ref = prevRef ? String(prevRef) : null
  if (lang === 'zh') {
    return {
      tag: '次数记录',
      lines: ref
        ? [`这是你第 ${attempt} 次触发本防线。你上一次收到的证据编号是 ${ref}。`, '两次编号在同一条链上,删不掉、改不动。']
        : [`这是你第 ${attempt} 次触发本防线,每一次都独立编号、独立入链。`],
    }
  }
  return {
    tag: 'ATTEMPT COUNT',
    lines: ref
      ? [
          `This is attempt #${attempt}. The evidence ID you received last time was ${ref}.`,
          'Both IDs sit on the same hash chain — they cannot be deleted or altered.',
        ]
      : [`This is attempt #${attempt}; each one is numbered and chained separately.`],
  }
}

/** 惯犯档:第 5 次起,不再劝阻,改为陈述账目。 */
function onRecordSection(lang, attempt) {
  if (lang === 'zh') {
    return {
      tag: '你已在册',
      lines: [`这是你第 ${attempt} 次。`, `你已经在这份卷宗里出现 ${attempt} 次 —— 每一次独立编号、独立入链,没有一次被抹掉。`],
    }
  }
  return {
    tag: 'ON RECORD',
    lines: [
      `This is attempt #${attempt}.`,
      `You now appear ${attempt} times in this record — each separately numbered, separately chained, none removed.`,
    ],
  }
}

/** 落点随档位变:劝阻 → 账单。第 5 次起换成陈述句,比命令句更冷。 */
function punchFor(lang, attempt) {
  if (attempt >= 5) {
    return lang === 'zh'
      ? ['停手吧。', `你已经在册 ${attempt} 次 —— 继续只会把卷宗写得更厚。`]
      : ['Stop.', `You are already on record ${attempt} times — continuing only makes the file thicker.`]
  }
  return COPY[lang].punch
}

/** 兼容旧调用面(测试与日志都用过):中文正文的扁平视图。 */
export const NOTICE_LINES = Object.freeze([...COPY.zh.sections.flatMap((s) => s.lines), ...COPY.zh.punch])

/** 证据编号:由 ip+时间+原因 派生的短哈希,可回查落盘记录,不可反推 IP。 */
export function evidenceRef({ ip = '', ts = Date.now(), reason = 'waf' } = {}) {
  const h = createHash('sha256').update(`${ip}|${ts}|${reason}`).digest('hex').slice(0, 10).toUpperCase()
  return `EV-${h}`
}

/** 工具特征段:只说"携带…特征",不说"你是 X" —— UA 可伪造,断言身份会被反将一军。 */
function toolSection(lang, tool) {
  const name = String(tool?.name ?? '未知工具')
  if (lang === 'zh') {
    return {
      tag: '工具特征',
      lines: [`你的请求携带 ${name} 的特征 —— 这一点已记进本次证据。`, '换工具也一样。防线认的是行为,不是名字。'],
    }
  }
  return {
    tag: 'TOOL SIGNATURE',
    lines: [
      `Your request carries the ${name} signature — recorded in this evidence entry.`,
      'Switching tools changes nothing. The filter reads behavior, not names.',
    ],
  }
}

/** 封禁状态段:在册是终局信息,排最前;到期时间必须给真值,不能写"永久"。 */
function banSection(lang, banned) {
  const until = String(banned?.expiresAt ?? '').replace('T', ' ').replace(/\.\d+Z$/, 'Z').replace(/Z$/, ' UTC')
  if (lang === 'zh') {
    return {
      tag: '封禁状态',
      lines: [`你的 IP 已在封禁名单,到期 ${until}。`, '在此之前,你的请求不会到达业务逻辑 —— 连这一页都可能看不到。'],
    }
  }
  return {
    tag: 'BAN STATUS',
    lines: [
      `Your IP is already on the ban list until ${until}.`,
      'Until then your requests never reach application logic — you may not even see this page.',
    ],
  }
}

/** 按状态码 + 次数档位 + 附加事实(工具/封禁)组装某一语言的完整副本。 */
function copyFor(lang, status, attempt, prevRef, extras = {}) {
  const base = COPY[lang]
  const sections = [...base.sections]
  if (extras.tool) sections.unshift(toolSection(lang, extras.tool))
  if (extras.banned) sections.unshift(banSection(lang, extras.banned))
  if (attempt >= 5) sections.push(onRecordSection(lang, attempt))
  else if (attempt >= 2) sections.push(repeatSection(lang, attempt, prevRef))
  return {
    verdict: status === 429 ? base.verdictRate : base.verdict,
    sections,
    punch: punchFor(lang, attempt),
  }
}

/**
 * 构造告知对象。403(WAF/回源鉴权) 与 429(限流) 用不同首句;
 * `attempt` 是**同一来源第几次触发**(由 ledger 提供,缺省 1 = 首次,不显示计数段)。
 */
export function buildNotice({
  ip = '',
  path = '',
  reason = 'waf',
  status = 403,
  ts = Date.now(),
  attempt = 1,
  prevRef = null,
  tool = null,
  banned = null,
} = {}) {
  const ref = evidenceRef({ ip, ts, reason })
  const n = Number.isFinite(attempt) && attempt >= 1 ? Math.floor(attempt) : 1
  const zh = copyFor('zh', status, n, prevRef, { tool, banned })
  const en = copyFor('en', status, n, prevRef, { tool, banned })
  return {
    version: NOTICE_VERSION,
    site: 'IHUI AI · aizhs.top',
    level: NOTICE_LEVEL,
    levelEn: NOTICE_LEVEL_EN,
    status,
    reason,
    ref,
    at: new Date(ts).toISOString(),
    attempt: n,
    prevRef: prevRef ?? null,
    tool: tool ? { name: tool.name } : null,
    banned: banned ? { expiresAt: banned.expiresAt ?? null } : null,
    langs: LANG_ORDER,
    zh,
    en,
    // 扁平中文视图:旧调用面(日志摘要/测试)读这两个字段,别删
    lead: zh.verdict,
    lines: NOTICE_LINES,
    pathLength: String(path ?? '').length,
  }
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** 单语言区块。英文在上、中文在下:先给国际读者,再给母语读者,顺序不影响阅读。 */
function renderLangBlock(lang, cls) {
  return [
    `<section class="${cls}">`,
    `<p class="verdict">${esc(lang.verdict)}</p>`,
    ...lang.sections.map(
      (s) => `<div class="sec"><h2>${esc(s.tag)}</h2><ul>${s.lines.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`,
    ),
    `<p class="punch">${lang.punch.map(esc).join('<br>')}</p>`,
    '</section>',
  ].join('')
}

/**
 * 极简 403 页:黑底、单一警示色、无脚本无外链、无站点导航。
 * 只用间距与色阶分区(不画装饰线),不给对手任何额外信息。
 */
function renderHtml(notice) {
  return [
    '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex">',
    `<title>${notice.status} · ${esc(notice.site)}</title>`,
    '<style>',
    'body{margin:0;min-height:100vh;display:grid;place-items:center;background:#08080a;color:#ececed;',
    'font:14px/1.7 ui-sans-serif,system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}',
    'main{max-width:680px;width:100%;padding:44px 30px;box-sizing:border-box}',
    '.top{display:flex;align-items:baseline;gap:14px}',
    'h1{margin:0;font:600 42px/1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:-1px;color:#fff}',
    '.dot{width:9px;height:9px;background:#e5484d;border-radius:50%}',
    '.lv{margin:10px 0 4px;font:600 11px/1.5 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.18em;color:#9a9aa2}',
    '.lvzh{margin:0 0 30px;font-size:12px;letter-spacing:.1em;color:#6f6f78}',
    'section.en{padding:0 0 26px;margin:0 0 26px;background:transparent}',
    'section.zh{color:#fff}',
    '.verdict{margin:0 0 18px;font-size:15px;font-weight:600;color:#f2f2f4}',
    '.sec{margin:0 0 16px}',
    'h2{margin:0 0 6px;font:600 10px/1.6 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.16em;color:#e5484d}',
    'ul{margin:0;padding-left:16px;color:#b9b9c0;font-size:13px}li{margin:3px 0}',
    '.punch{margin:20px 0 0;font-size:16px;font-weight:700;line-height:1.6;color:#fff}',
    '.ref{margin-top:30px;color:#6a6a73;font:12px/1.6 ui-monospace,Menlo,Consolas,monospace}',
    '</style>',
    '<main>',
    `<div class="top"><h1>${notice.status}</h1><span class="dot"></span></div>`,
    `<p class="lv">${esc(notice.levelEn)}</p>`,
    `<p class="lvzh">${esc(notice.level)}</p>`,
    renderLangBlock(notice.en, 'en'),
    renderLangBlock(notice.zh, 'zh'),
    `<p class="ref">Evidence ID / 证据编号&nbsp; ${esc(notice.ref)}${
      notice.attempt >= 2 ? ` · NO.${notice.attempt}` : ''
    }<br>${esc(notice.at)}</p>`,
    '</main>',
  ].join('')
}

/**
 * 渲染响应。浏览器(Accept 含 text/html)给人话页面,脚本/API 调用给 JSON ——
 * 两种都带 `x-ihui-notice` / `x-ihui-evidence` / `x-ihui-attempt` 头,curl -i 一眼能看到。
 *
 * ⚠ 头值必须全 ASCII(2026-11-24 实测教训):`x-ihui-notice` 初版直接塞中文等级名,
 * Node 抛 `ERR_INVALID_CHAR` 且是**未捕获异常** ⇒ router 当场退出、nssm 再拉起,
 * 表现为"每拦一个攻击者就崩一次、日志里反复 router started"。
 * 中文等级名只能进 body;头里只放 ASCII 代号。
 */
/** 所有形态共用的响应头:值必须全 ASCII(中文进头会让 Node 抛 ERR_INVALID_CHAR 打死进程)。 */
function commonHeaders(notice) {
  return {
    'cache-control': 'no-store',
    'content-language': 'en, zh',
    'x-ihui-notice': 'national-grade',
    'x-ihui-evidence': notice.ref,
    'x-ihui-attempt': String(notice.attempt ?? 1),
  }
}

/**
 * 最小版(~200 字节):**降级用,不是备胎**。
 *
 * 为什么必须有它:完整版 HTML 3.4KB、JSON 1.6KB,而攻击者只要发 1 字节就能换走
 * 一次 3.4KB 响应 —— 500rps 就是 1.7MB/s 出口,等于我们把他的话术变成了放大器。
 * 触发条件(在 router 里判):429(限流语义本身就是"你太快了")一律降级;
 * 403 在全局拒绝速率超阈值时降级。降级只砍篇幅,**不砍编号、不砍落点句** ——
 * 威慑的核心是"你被记住了",不是段落齐不齐。
 */
export function renderMinimal(notice) {
  const ref = notice.ref
  const n = notice.attempt ?? 1
  const body = Buffer.from(
    [
      `IHUI-AI ${notice.status} · 按国安级网络对抗标准建设 · 已记录 ${ref}（第 ${n} 次）`,
      '别妄想攻击。',
      `IHUI-AI ${notice.status} · national-grade adversarial standard · recorded ${ref} (#${n})`,
      'Abandon the attempt.',
      '',
    ].join('\n'),
    'utf8',
  )
  return {
    body,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'content-length': body.length,
      'x-ihui-minimal': '1',
      ...commonHeaders(notice),
    },
  }
}

export function renderNotice(accept = '', notice) {
  const wantsHtml = /\btext\/html\b/i.test(String(accept ?? ''))
  const common = commonHeaders(notice)
  if (wantsHtml) {
    const body = Buffer.from(renderHtml(notice), 'utf8')
    return {
      body,
      headers: { 'content-type': 'text/html; charset=utf-8', 'content-length': body.length, ...common },
    }
  }
  const body = Buffer.from(
    JSON.stringify({
      code: notice.status,
      message: notice.status === 429 ? 'too many requests' : 'forbidden',
      notice: {
        level: notice.level,
        levelEn: notice.levelEn,
        ref: notice.ref,
        at: notice.at,
        attempt: notice.attempt,
        prevRef: notice.prevRef,
        // 结构化给:脚本调用方会解析字段,把工具/封禁写成字段比埋在文本里更硬
        tool: notice.tool ?? null,
        banned: notice.banned ?? null,
        langs: notice.langs,
        en: notice.en,
        zh: notice.zh,
      },
    }),
    'utf8',
  )
  return {
    body,
    headers: { 'content-type': 'application/json; charset=utf-8', 'content-length': body.length, ...common },
  }
}

export const __test__ = { evidenceRef, buildNotice, renderNotice, renderMinimal, NOTICE_LEVEL, NOTICE_LEVEL_EN, NOTICE_LINES, COPY }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
