#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/check-brand-email-channel.mjs
/**
 * 守门 81:品牌邮件通道对账(blocking)。
 *
 * 起因(2026-09-23 已确证的静默缺陷,不是假想):邮件"版式模板"只存在于
 *   `apps/api/src/services/email-templates.ts`(renderSystemAlertEmail 等,机械风"智汇通报"),
 *   但存在**第二条绕过模板的自发通道**:`deploy/win/ihui-deploy.ps1` 的 Send-EmailNotify 自拼
 *   传输层 —— `Send-MailMessage -Body $text`(无 `-BodyAsHtml`)与
 *   `Invoke-RestMethod https://api.resend.com/emails`(payload 只有 text、无 html)直发纯文本。
 *   这类代码"能发出去、typecheck 全绿、lint 全绿",但用户收到的邮件没有样式 ——
 *   与守门 72/78 同族的"本地全绿也发现不了"那一类,本门补这个缺口。
 *
 * 扫描范围(2026-09-24 扩面,判据见下):`deploy/**`、`scripts/**`(不含 scripts/tests)、
 *   `monitoring/**`、`apps/api/scripts/**` 下的 .ps1 / .mjs / .js / .cjs / .ts / .mts,
 *   以及 `.github/workflows/*.yml`。
 *   · 为什么必须带 monitoring/** 与 .cjs:infra 告警的邮件正文正是从
 *     `monitoring/alertbridge/alert-webhook-bridge.cjs` 出去的,而旧口径(仅 deploy+scripts
 *     的 .ps1/.mjs/.js/.ts)对它**双重不可见**(目录不在面内 + 扩展名不在集合内)——
 *     "不得自拼 HTML / 不得自拼 SMTP / 不得手抄版式"三条当时只靠 grep 断言和 bridge
 *     自己的自检钉着,没有闸门。扩面实测:新增判定文件 52 个、新增命中 0(bridge 已是合规形态)。
 *   · 为什么带 apps/api/scripts/**:nodemailer 的真实依赖就在 apps/api(根 package.json 亦带),
 *     在那里自拼第二条传输层在结构上完全可行。唯一例外是品牌出口本身
 *     `apps/api/scripts/notify-deploy-failure.ts`(见 isBrandExitScript)。
 *   · 为什么**不**带 packages/**:实测 +714 个文件只换来 1 处命中,而那处是
 *     `packages/api-client/src/endpoints/mail.ts` 的 `sendMail()` —— 它 POST 的是自家后端
 *     `/api/mail/send`(AGENTS §3 规定的 api-client 唯一通道),不碰 SMTP/Resend,且 packages
 *     下无任何包依赖 nodemailer/resend。判它红 = 造假阳,故不扩。
 *   · 为什么**不**带 apps/**(apps/api/scripts 除外):运行时服务层本就 import 模板;
 *     `apps/api/src/routes/system.ts` 的 createTransport 是管理员"SMTP 配置试测"端点,
 *     一并纳入会把它判红(实测)。
 *   · 为什么**不**加 .sh/.py:实测 deploy/scripts/monitoring 下 27 个跟踪 .sh/.py
 *     零发信 token(resend/smtp/createTransport/sendMail/Send-MailMessage 全无),无证据不扩。
 *   · 2026-09-24 R4 扩面:**Alertmanager 语境**的 .yml / .yaml / .tmpl
 *     (`monitoring/alertmanager/**` 与任何目录下文件名形如 `alertmanager*.yml|yaml|tmpl`)。
 *     起因:AM 原生 `email_configs` 发的是 Go 模板排版的无版式纯文本(正是用户投诉的那类形态),
 *     它**不是脚本**、过去扩展名根本进不了面 —— 于是有人往 `alertmanager.yml.tmpl` 加回一段
 *     `email_configs` 直接 commit,而全链没有一道门会在提交时变红。渲染器
 *     `scripts/render-alertmanager-config.mjs` 的 `assertBridgeOnlySurface` 结构上早已封死
 *     这条路,但**"跑渲染"仍是人工动作** —— 提交时无人拦(守门 52 同型:判据存在 ≠ 判据被调用)。
 *     刻意**不全仓扫 yml**:CI workflows / docker-compose / k8s / prometheus / grafana provisioning
 *     里的 `url:` / receiver 名与 AM 邮件面毫无关系,全仓扫必产大面积假阳(实测根
 *     `docker-compose.yml` 的头注释就写着历史 `dingtalk-webhook/feishu-webhook`,
 *     `monitoring/prometheus/*.yml` 亦整片无关)。R1/R2/R3 对这批新准入的 AM 文件同样生效
 *     (实测三份文件零命中,全量恒绿)。
 *
 * 判据:
 *   R1 PowerShell `Send-MailMessage` 调用语句(含反引号续行)缺 `-BodyAsHtml` → 红。
 *   R2 出现 `api.resend.com/emails`(任意语言/形态,含 host+path 分行形态)而**同一发送
 *      上下文**(命中行前 12 行 / 后 6 行)看不到 html 字段(允许形态 `html:`、'html'、
 *      PS `@{ … html = … }`、Python `"html":`)→ 红。
 *   R3 ops 邮件脚本绕过品牌层,两个子判据(都归 R3,基线 key 仍 `<path>#R3`):
 *     R3a 文件里有"发信动作"(createTransport/sendMail/api.resend.com)却既不引用
 *         `email-templates` 也不调用 `notify-deploy-failure` → 红(每文件一条)。
 *     R3b **自拼 HTML 正文 / 手抄品牌版式** → 红(与是否引用品牌层无关 —— 版式只许活在
 *         email-templates.ts 一处;调用出口的人同样不得自带一份 HTML)。R2/R3a 只看"有没有
 *         走模板",对"自带一份版式"这一型是盲的(守门 52 那晚"判据恒报 0 其实是扫不到"同型)。
 *         判据三段与门(宁漏不误报,选判据时在本门全部范围内实测 0 命中,不误伤三条守门
 *         脚本自带的 `<table`/`border-radius:`/`<td` 夹具):① 邮件版式标记(`<table`/`<td`/
 *         `<tr`/`bgcolor=`/`cellpadding`/`role="presentation"`)② 同一处 ±10 行内的样式指纹
 *         (品牌酸绿 `#B4FF00` / `letter-spacing:` / `border-radius:` / `font-family:`)
 *         ③ 本文件确在邮件语境(sendMail / api.resend.com / notify-deploy-failure /
 *         email-templates / SMTP / Resend / subject / 邮件 / 收件)。
 *      注释行一律不计。
 *   R4 **告警接收面(Alertmanager 配置)** —— 只在 Alertmanager 语境的 .yml/.yaml/.tmpl 上判,
 *      与渲染器 assertBridgeOnlySurface 同取向,把"跑渲染才红"提前到"改了提交就红":
 *      R4a 原生邮件面:`email_configs`,或 `smtp_*` 键形态(AM 里 smtp_* 的唯一宿主就是
 *          global 邮件面;渲染器判的是全文 `/smtp_/i`,本门收严到键形态以免注释性正文误伤)。
 *      R4b IM 中转 receiver:两级特征 —— ① **host/路径签名**(`qyapi.` / `oapi.` /
 *          `open.feishu` / `connect.dingtalk` / `robot/send`)在任何非注释行命中即红;
 *          ② 厂商 slug(`dingtalk|feishu|wechat|wecom`)只在 `name:` / `url:` 的**值**上命中才红。
 *          两级都是"改名也认":`feishu-copy` 仍是 slug 命中,`oapi.dingtalk.com` 换名也命中 host。
 *      R4c 出口面:`webhook_configs:` 块内出现 **不等于 bridge 出口**(`BRIDGE_URL`)的 url → 红。
 *          换 host 但端口仍是 9096(如 `http://localhost:9096/alert`)一律判红,理由:bridge
 *          按部署约定只绑回环 127.0.0.1,而渲染器判的就是"字面等于 BRIDGE_URL"—— 两道门取向
 *          必须一致,否则又回到"提交时绿、跑渲染才红"这个本门要消灭的落差;真要用别的 host
 *          是部署变更,应当同批改两处常量并跑一次渲染校验。
 *      整行 YAML 注释(`#`)不计红,但注释里出现的被禁字面量**如实计数报出**
 *      (`amCommentLiterals`,见输出计数行)—— 废弃桩 alertmanager.yml 的说明文字正是这一类。
 *
 * 豁免:① 品牌出口本身 `apps/api/scripts/notify-deploy-failure.ts` 不判 R2/R3 —— 它**就是**
 *   品牌层,不存在"绕过";实测它的 R2 假阳来自窗口口径(`RESEND_ENDPOINT` 常量在第 36 行,
 *   带 `html:` 的 payload 在第 416-426 行,相距 380 行)。它的传输正确性由
 *   `apps/api/tests/notify-deploy-failure.test.ts`(:291-304 断言 html 含机械风横幅)钉住,
 *   跳过条数如实计入 `brandExitSkipped` 计数,不静默。
 *   ② 行内标记 `brand-mail-exempt: <原因>`(命中行或紧邻上行;PS `#`、JS `//`、YAML `#`)。
 *   存量走 `scripts/brand-email-channel-baseline.json`(key=`<path>#<规则>` → 容忍条数),
 *   只减不增棘轮:实发条数 ≤ 基线 → 放行并如实计数;超出 → 只把超出部分判红;基线 key
 *   归零 → 输出"余量提示"提醒下调。基线文件缺失按空基线判定(不静默放行),JSON 解析失败
 *   按脚本自身异常 exit 2。
 *   **R4 不新增第三种豁免姿势,也不新增白名单目录** —— 只复用 ② 行内标记与基线棘轮
 *   (key 形如 `monitoring/alertmanager/alertmanager.yml.tmpl#R4`),且基线**现须为空**:
 *   把 AM 旁路写进基线等于给这条通道发长期通行证,与"结构上已封死"的前提直接矛盾。
 *
 * 三模式:
 *   --staged       pre-commit(runner 自动下发):只判**索引里在范围内的文件**(索引 blob
 *                  优先,取不到退回工作区);暂存集为空或取不到 → 按全量判
 *                  (守门 70 的既有教训:防"空暂存恒绿")。
 *   缺省(全量审计) 判所有 git 跟踪文件里在范围路径的工作区内容。
 *   --self-test    判据纯函数正反成对对照 + 临时仓模式取证,不触碰真实仓。
 *
 * 退出码:0 通过 / 1 检出未基线化违规 / 2 脚本自身异常(git 解析失败、基线 JSON 损坏等,
 *   绝不静默放行)。紧急跳过:HUSKY_SKIP_BRAND_MAIL_GUARD=1 git commit ...
 *
 * 当前接入:guardian-runner id '81',blocking,
 *   stagedTriggers=['deploy/','scripts/','.github/workflows/','monitoring/','apps/api/scripts/']。
 *   后两项 2026-09-24 扩面时同步补上:判据扫到 monitoring/** 与 apps/api/scripts/** 之后,若触发
 *   清单不跟上,**只改 bridge 的提交在 pre-commit 根本不会唤起本门**(runner 语义:声明
 *   stagedTriggers 后仅在暂存区触及这些路径才执行)—— 判据存在而永不调用,等于没有,正是
 *   §「造好没装车」那一型。现由镜像测试「装车证明」钉死,不再靠源码注释提醒。
 */
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveGitBin } from './lib/gitdir.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const SKIP_ENV = 'HUSKY_SKIP_BRAND_MAIL_GUARD'
export const BASELINE_REL = 'scripts/brand-email-channel-baseline.json'
/** G1 自豁免前缀:本门脚本与其测试必然含违规字面量(判据正则/夹具),按文件名跳过。 */
export const SELF_EXEMPT_PREFIX = 'check-brand-email-channel'
/** 违规清单里每行最多展示的字符数。 */
export const SNIPPET_CHARS = 110
/** R2 "同一发送上下文"窗口:命中行前 12 行 / 后 6 行(实测两处真实形态分别在 -3 / -8 行)。 */
export const R2_WINDOW_BEFORE = 12
export const R2_WINDOW_AFTER = 6
/** R2 端点识别:api.resend.com 之后多远内出现 /emails 算同一端点(host+path 分行形态)。 */
export const R2_ENDPOINT_WINDOW_CHARS = 140
/** R3b 样式指纹与邮件版式标记的"同一处"窗口(行):相隔再远就不是同一段手抄版式。 */
export const R3B_STYLE_WINDOW = 10
/**
 * 品牌出口自身:它就是邮件版式/传输的唯一合法实现,判它"绕过品牌层"是语义倒置。
 * 实测(2026-09-24):纳入 apps/api/scripts/** 后唯一命中就是它的 R2 窗口假阳
 * (端点常量 :36 vs 带 html 的 payload :416-426),故按路径不判 R2/R3,并如实计数。
 */
export const BRAND_EXIT_REL = 'apps/api/scripts/notify-deploy-failure.ts'
/**
 * R4:bridge 出口唯一 URL(基础设施告警到人的唯一落点)。
 * 与 `scripts/render-alertmanager-config.mjs` 导出的同名常量**同源等值** —— 那里是渲染器的
 * 结构判据,这里是提交时判据,两者取一个值。刻意**不 import** 渲染器:那个模块顶层会解析
 * git 二进制并被 `main()` 拉起文件 IO,把它拖进本门的每次判定既不必要也违反守门 80 的
 * "热路径 git 只读调用"取向。漂移由镜像测试断言两处字面量等值钉死,不靠人眼比对。
 */
export const BRIDGE_URL = 'http://127.0.0.1:9096/alert'
/** R4 只对 Alertmanager 语境的配置类文件生效(见文件头"为什么不全仓扫 yml")。 */
const AM_CONFIG_EXTS = new Set(['.yml', '.yaml', '.tmpl'])

const SCANNED_EXTS = new Set(['.ps1', '.mjs', '.js', '.cjs', '.ts', '.mts'])
const EXEMPT_RE = /brand-mail-exempt\s*:/
const SEND_MAIL_RE = /(^|[^-\w])Send-MailMessage\b/i
const BODY_AS_HTML_RE = /-BodyAsHtml\b/i
const RESEND_HOST_RE = /api\.resend\.com/g
/** html 字段允许形态:JS/YAML/Python 的 `html:`、带引号键、PS hashtable 的 `html =`。 */
const HTML_FIELD_RE = /(?:^|[^\w$])["']?html["']?\s*[:=]/m
/** 发信动作:`sendMail` 与其派生名(bridge 自己的腿函数就叫 sendMailLeg —— 旧 `\b` 判不到)。 */
const SEND_ACTION_RE = /createTransport|\bsendMail\w*|api\.resend\.com/
const BRAND_LAYER_RE = /email-templates|notify-deploy-failure/
/** R3b ①:邮件专属版式标记(浏览器页面用 div,`<table role=presentation>`/bgcolor/cellpadding 是邮件指纹)。 */
const MAIL_MARKUP_RE = /<table[\s>/]|<td[\s>/]|<tr[\s>]|bgcolor\s*=|cellpadding|role=["']presentation["']/i
/** R3b ②:版式样式指纹(品牌酸绿 + 邮件模板惯用的内联排版属性)。 */
const LAYOUT_STYLE_RE = /#B4FF00|letter-spacing\s*:|border-radius\s*:|font-family\s*:/i
/** R3b ③:邮件语境 —— 没有发信/派发的文件里出现 HTML 片段属页面生成,不属本门。 */
const MAIL_CONTEXT_RE =
  /createTransport|\bsendMail\w*|api\.resend\.com|notify-deploy-failure|email-templates|\bSMTP\b|Resend|\bsubject\b|邮件|收件/i

// ── R4 Alertmanager 接收面判据(整行 YAML 注释一律先剥,与渲染器 blankOutCommentLines 同形态) ──
/** R4a 原生邮件面:`email_configs` 键,或 `smtp_*` 键形态(AM 里 smtp_* 的唯一宿主是 global 邮件面)。 */
const AM_EMAIL_SURFACE_RE = /(?:^|[^\w])email_configs\b|(?:^|[\s{[,>-])smtp_[a-z0-9_]*\s*[:=]/i
/** R4b 一级:host/路径签名 —— 非注释行任意位置命中即红(改名也躲不掉)。 */
const AM_IM_HOST_RE = /(qyapi\.|oapi\.|open\.feishu|connect\.dingtalk|robot\/send)/i
/** R4b 二级:厂商 slug —— 只在 name:/url: 的**值**上命中才红(正文里的英文单词不构成 receiver)。 */
const AM_IM_SLUG_RE = /(dingtalk|feishu|wechat|wecom)/i
/** R4b 取值行:`name: 'x'` / `- name: x` / `url: 'https://…'`(带引号与裸值都认)。 */
const AM_NAMED_VALUE_RE = /^\s*(?:-\s+)?(name|url)\s*:\s*(.+)$/
/** R4c 块定位:`webhook_configs:` 起一个块,块内的 `url:` 才是出口面。 */
const AM_WEBHOOK_BLOCK_RE = /^(\s*)(?:-\s+)?webhook_configs\s*:/
const AM_URL_LINE_RE = /^\s*(?:-\s+)?url\s*:\s*(.*)$/
/** 注释行里的被禁字面量:只如实计数,永不判红(废弃桩/头注释正是在"讲解被禁形态")。 */
const AM_COMMENT_LITERAL_RE = /email_configs|smtp_[a-z0-9_]*|dingtalk|feishu|wechat|wecom|qyapi\.|oapi\.|open\.feishu/gi

// ── git 派生:绝对路径候选解析 + 强制 windowsHide(守门 52)+ timeout(守门 80) ──
let _gitBin = undefined
export function gitBin() {
  if (_gitBin === undefined) _gitBin = resolveGitBin()
  return _gitBin
}

function git(args, opts = {}) {
  const bin = gitBin()
  if (!bin) throw new Error('git 可执行文件候选解析全部失败 —— 判据无法执行(按脚本异常处理)')
  return execFileSync(bin, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', ...args], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    timeout: 60_000,
    ...opts,
    windowsHide: true,
  })
}

/** 路径清单专用:git 输出的 UTF-8 字节按 utf8 解码(中文路径不丢,守门 79 同款教训)。 */
function gitPathList(args) {
  const buf = git(args, { encoding: 'buffer', stdio: ['ignore', 'pipe', 'ignore'] })
  return buf.toString('utf8')
}

// ══════════════ 纯函数层(零副作用,经 __test__ 供 §22c 镜像测试直接 import) ══════════════

/**
 * 范围判定:deploy/monitoring/apps-api-scripts 三块运维脚本目录 + scripts/**(不含 scripts/tests)
 * + workflows 根层 *.yml + **Alertmanager 语境的配置类文件**(R4,见 isAlertmanagerSurfacePath)。
 * 2026-09-24 扩面(monitoring/** 与 .cjs/.mts)与同日 R4 扩面(.yml/.yaml/.tmpl 限 AM 语境)的理由见文件头。
 */
export function isScannedPath(rel) {
  const norm = String(rel || '').replace(/\\/g, '/')
  const ext = norm.slice(norm.lastIndexOf('.'))
  if (norm.startsWith('.github/workflows/')) {
    return norm.endsWith('.yml') && !norm.slice('.github/workflows/'.length).includes('/')
  }
  if (isAlertmanagerSurfacePath(norm)) return true
  if (!SCANNED_EXTS.has(ext)) return false
  if (norm.startsWith('deploy/')) return true
  if (norm.startsWith('monitoring/')) return true
  if (norm.startsWith('apps/api/scripts/')) return true
  if (norm.startsWith('scripts/tests/')) return false
  return norm.startsWith('scripts/')
}

/**
 * R4 语境判定:这份 yml/yaml/tmpl **是不是** Alertmanager 的接收面配置。
 * 两条且仅两条准入:① `monitoring/alertmanager/**`(本仓唯一的 AM 配置目录);
 * ② 任何目录下文件名形如 `alertmanager*.yml|yaml|tmpl`(部署侧再落一份主配置时同样受管)。
 * **刻意不放宽**:prometheus/loki/grafana/docker-compose/k8s/CI workflows 里的 `url:`、
 * receiver 名与 AM 邮件面无关,全仓扫 yml 必产大面积假阳(实测根 docker-compose.yml 的
 * 历史注释里就写着 `dingtalk-webhook/feishu-webhook`)。
 */
export function isAlertmanagerSurfacePath(rel) {
  const norm = String(rel || '').replace(/\\/g, '/')
  const base = norm.slice(norm.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  if (dot <= 0 || !AM_CONFIG_EXTS.has(base.slice(dot))) return false
  if (norm.startsWith('monitoring/alertmanager/')) return true
  return /^alertmanager[^/]*$/i.test(base.slice(0, dot))
}

/** 品牌出口自身不判 R2/R3(它**就是**品牌层;见 BRAND_EXIT_REL 注释),但如实计数。 */
export function isBrandExitScript(rel) {
  return String(rel || '').replace(/\\/g, '/') === BRAND_EXIT_REL
}

/** G1 自豁免:本门脚本与其测试文件必然含字面量,按文件名前缀跳过。 */
export function isSelfExempt(rel) {
  const norm = String(rel || '').replace(/\\/g, '/')
  const name = norm.slice(norm.lastIndexOf('/') + 1)
  return name.startsWith(SELF_EXEMPT_PREFIX)
}

function langOf(rel) {
  const norm = String(rel || '').toLowerCase()
  if (norm.endsWith('.ps1')) return 'ps'
  // .yaml / .tmpl 与 .yml 同语言:注释都是整行 `#`。漏了这一条,AM 那份**通篇注释**的
  // 废弃桩会被按 js 规则当成正文判据素材(而 R4 的取向是"整行注释不计红、只如实计数")。
  if (norm.endsWith('.yml') || norm.endsWith('.yaml') || norm.endsWith('.tmpl')) return 'yml'
  return 'js'
}

/** 注释行判定(ps/yml 以 # 起,js 以 // 或 * 起)——R3 与端点判据都不吃注释,宁漏不误报。 */
function isCommentLine(line, lang) {
  const t = String(line).trimStart()
  if (lang === 'js') return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')
  return t.startsWith('#')
}

/** 豁免标记识别:命中行本身或紧邻上行为 `brand-mail-exempt:` 注释即豁免。 */
export function isExemptAt(lines, idx) {
  if (EXEMPT_RE.test(String(lines[idx] ?? ''))) return true
  if (idx > 0 && EXEMPT_RE.test(String(lines[idx - 1] ?? ''))) return true
  return false
}

/**
 * R1 前置:PS 单条调用语句抽取器。找到每个 `Send-MailMessage`,按反引号续行把逻辑语句
 * 合并成一条(返回 1 基 startLine / endLine / text),供逐条判 `-BodyAsHtml`。
 */
export function extractSendMailStatements(lines) {
  const out = []
  const lang = 'ps'
  for (let i = 0; i < lines.length; i += 1) {
    const line = String(lines[i])
    if (isCommentLine(line, lang)) continue
    if (!SEND_MAIL_RE.test(line)) continue
    let j = i
    const parts = [line]
    while (/`\s*$/.test(String(lines[j])) && j + 1 < lines.length) {
      j += 1
      parts.push(String(lines[j]))
    }
    out.push({ startLine: i + 1, endLine: j + 1, startIdx: i, endIdx: j, text: parts.join('\n') })
    i = j
  }
  return out
}

/**
 * R2 前置:Resend 发送端点定位。`api.resend.com` 之后
 * R2_ENDPOINT_WINDOW_CHARS 字符内出现 `/emails` 才算发送端点(覆盖整串 URL 与
 * host+path 分行两种形态);只有裸域名(连通性探测/文档提及)不判。
 * 返回 [{ line(1 基), idx }]。
 */
export function findResendEndpointHits(text) {
  const hits = []
  const s = String(text ?? '')
  RESEND_HOST_RE.lastIndex = 0
  let m
  while ((m = RESEND_HOST_RE.exec(s)) !== null) {
    const idx = m.index
    const window = s.slice(idx, idx + R2_ENDPOINT_WINDOW_CHARS)
    if (window.includes('/emails')) {
      let line = 1
      for (let k = 0; k < idx; k += 1) if (s.charCodeAt(k) === 10) line += 1
      hits.push({ line, idx })
    }
    if (m.index === RESEND_HOST_RE.lastIndex) RESEND_HOST_RE.lastIndex += 1
  }
  return hits
}

/**
 * R2 判据:命中行的发送上下文(前 R2_WINDOW_BEFORE / 后 R2_WINDOW_AFTER 行)内是否存在
 * html 字段。刻意只看窗口 —— 窗口外孤立的 `html`(注释、无关字符串)不构成豁免,
 * 否则任何文件里一句 `// html` 就能赦掉纯文本直发。
 */
export function sendContextHasHtmlField(lines, hitLineIdx0) {
  const from = Math.max(0, hitLineIdx0 - R2_WINDOW_BEFORE)
  const to = Math.min(lines.length - 1, hitLineIdx0 + R2_WINDOW_AFTER)
  return HTML_FIELD_RE.test(lines.slice(from, to + 1).join('\n'))
}

/**
 * R3b 前置:定位"自拼 HTML 正文 / 手抄品牌版式"。三段与门(注释行不参与):
 * ① 本文件确在邮件语境(有发信动作或引用品牌层)—— 否则页面生成脚本里的 HTML 片段不属本门;
 * ② 出现邮件专属版式标记(<table / <td / <tr / bgcolor= / cellpadding / role="presentation");
 * ③ 该标记行 ±R3B_STYLE_WINDOW 行内有样式指纹(品牌酸绿或内联 letter-spacing/border-radius/font-family)。
 * 只取首个命中(每文件至多一条,与 R3a 同形)。③ 的距离要求就是防误报的关键:
 * 三条守门脚本各自带 `<table`、`border-radius:`、`<td` 夹具,但既不同处也不同在邮件语境。
 */
export function findLayoutCopyHits(lines, lang = 'js') {
  const arr = Array.isArray(lines) ? lines : String(lines ?? '').split(/\r?\n/)
  const code = arr.map((l) => (isCommentLine(String(l), lang) ? '' : String(l)))
  if (!code.some((l) => MAIL_CONTEXT_RE.test(l))) return []
  for (let i = 0; i < code.length; i += 1) {
    if (!MAIL_MARKUP_RE.test(code[i])) continue
    const from = Math.max(0, i - R3B_STYLE_WINDOW)
    const to = Math.min(code.length - 1, i + R3B_STYLE_WINDOW)
    if (!code.slice(from, to + 1).some((l) => LAYOUT_STYLE_RE.test(l))) continue
    return [{ line: i + 1, idx: i, snippet: code[i] }]
  }
  return []
}

/** YAML 标量取值:去引号、去行尾注释(`a: 'x' # 说明` 里的值不含 `# 说明`)。 */
function yamlScalar(raw) {
  let v = String(raw ?? '').trim()
  const q = v[0]
  if ((q === "'" || q === '"') && v.length >= 2 && v.endsWith(q)) return v.slice(1, -1)
  const hash = v.indexOf(' #')
  if (hash >= 0) v = v.slice(0, hash)
  return v.trim()
}

/**
 * R4 扫描(纯函数,只在 Alertmanager 语境文件上调用)。返回
 *   { hits:[{ line, idx, snippet, reason }], commentLiterals:number }
 * hits 一律跑在**剥掉整行注释**的正文上;commentLiterals 是注释行里被禁字面量的出现次数
 * (永不判红,只如实报出 —— 废弃桩与头注释正是在"讲解被禁形态",见渲染器同名取向的理由)。
 * 三条子判据(R4a 原生邮件面 / R4b IM 中转 receiver / R4c 非 bridge 出口)逐行独立命中,
 * 每处命中各一条,便于人一眼定位到**哪一行**要改。
 */
export function scanAlertmanagerSurface(lines) {
  const arr = Array.isArray(lines) ? lines : String(lines ?? '').split(/\r?\n/)
  const hits = []
  let commentLiterals = 0
  let webhookIndent = null // 非 null = 正在某个 webhook_configs: 块内,值是该块的缩进列
  for (let i = 0; i < arr.length; i += 1) {
    const raw = String(arr[i])
    if (isCommentLine(raw, 'yml')) {
      const found = raw.match(AM_COMMENT_LITERAL_RE)
      if (found) commentLiterals += found.length
      continue
    }
    const trimmed = raw.trim()
    const indent = raw.length - raw.trimStart().length
    if (trimmed === '') continue
    if (webhookIndent !== null && indent <= webhookIndent) webhookIndent = null
    const block = AM_WEBHOOK_BLOCK_RE.exec(raw)
    if (block) webhookIndent = block[1].length

    // ── R4a 原生邮件面 ──
    if (AM_EMAIL_SURFACE_RE.test(raw)) {
      hits.push({ line: i + 1, idx: i, snippet: raw, reason: 'R4a Alertmanager 原生邮件面(email_configs / smtp_*)' })
    }
    // ── R4b IM 中转 receiver ──
    const named = AM_NAMED_VALUE_RE.exec(raw)
    const imValue = named ? yamlScalar(named[2]) : ''
    const imHit =
      (named && (AM_IM_SLUG_RE.test(imValue) || AM_IM_HOST_RE.test(imValue))) || AM_IM_HOST_RE.test(raw)
    if (imHit) {
      const why = named ? `${named[1]} 取值为 IM 中转形态` : '出现 IM host/回调路径特征'
      hits.push({ line: i + 1, idx: i, snippet: raw, reason: `R4b IM 中转 receiver(${why})` })
    }
    // ── R4c webhook_configs 块内的出口 url ──
    if (webhookIndent !== null) {
      const u = AM_URL_LINE_RE.exec(raw)
      if (u) {
        const url = yamlScalar(u[1])
        if (url && url !== BRIDGE_URL) {
          hits.push({
            line: i + 1,
            idx: i,
            snippet: raw,
            reason: `R4c webhook_configs 出口不指向 bridge(实得 ${url || '∅'},唯一合法值 ${BRIDGE_URL})`,
          })
        }
      }
    }
  }
  return { hits, commentLiterals }
}

/**
 * 单文件判定(纯函数)。stats 如实累计:judged / selfExempt / brandExitSkipped / exempted /
 * resendNonEmails。返回 violations:[{ path, rule, line, snippet }]。
 */
export function judgeText(rel, text, stats = newStats()) {
  const violations = []
  const norm = String(rel || '').replace(/\\/g, '/')
  if (isSelfExempt(norm)) {
    stats.selfExempt += 1
    return { violations, stats }
  }
  const lang = langOf(norm)
  const lines = String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/)
  stats.judged += 1

  // ── 品牌出口自身:它就是版式/传输的唯一合法实现,R2/R3 对它语义倒置(见 BRAND_EXIT_REL) ──
  // R1 只可能命中 .ps1/.yml,出口是 .ts,故整块跳过不损失判据。
  if (isBrandExitScript(norm)) {
    stats.brandExitSkipped += 1
    return { violations, stats }
  }

  // ── R1:Send-MailMessage 缺 -BodyAsHtml(cmdlet 只可能出现在 PS / workflow 内联 pwsh) ──
  if (norm.endsWith('.ps1') || norm.endsWith('.yml')) {
    for (const stmt of extractSendMailStatements(lines)) {
      if (BODY_AS_HTML_RE.test(stmt.text)) continue
      let exempt = isExemptAt(lines, stmt.startIdx)
      if (!exempt) {
        for (let k = stmt.startIdx; k <= stmt.endIdx; k += 1) {
          if (EXEMPT_RE.test(String(lines[k]))) {
            exempt = true
            break
          }
        }
      }
      if (exempt) {
        stats.exempted += 1
        continue
      }
      violations.push({ path: norm, rule: 'R1', line: stmt.startLine, snippet: stmt.text })
    }
  }

  // ── R2:Resend /emails 端点且发送上下文无 html 字段 ──
  {
    const cleaned = lines.map((l) => (isCommentLine(l, lang) ? '' : l)).join('\n')
    for (const hit of findResendEndpointHits(cleaned)) {
      const i0 = hit.line - 1
      if (sendContextHasHtmlField(lines, i0)) continue
      if (isExemptAt(lines, i0)) {
        stats.exempted += 1
        continue
      }
      violations.push({ path: norm, rule: 'R2', line: hit.line, snippet: lines[i0] ?? '' })
    }
  }

  // ── R3a:ops 邮件脚本不接品牌层(每文件至多一条,保守:注释行不计) ──
  const whole = lines.join('\n')
  if (!BRAND_LAYER_RE.test(whole)) {
    let first = null
    for (let i = 0; i < lines.length; i += 1) {
      const l = String(lines[i])
      if (isCommentLine(l, lang)) continue
      if (!SEND_ACTION_RE.test(l)) continue
      if (isExemptAt(lines, i)) {
        stats.exempted += 1
        continue
      }
      first = { line: i + 1, snippet: l }
      break
    }
    if (first) violations.push({ path: norm, rule: 'R3', line: first.line, snippet: first.snippet })
  }

  // ── R3b:自拼 HTML 正文 / 手抄品牌版式(与是否引用品牌层无关,每文件至多一条) ──
  for (const hit of findLayoutCopyHits(lines, lang)) {
    if (isExemptAt(lines, hit.idx)) {
      stats.exempted += 1
      continue
    }
    violations.push({ path: norm, rule: 'R3', line: hit.line, snippet: hit.snippet })
  }

  // ── R4:Alertmanager 接收面(原生邮件 / IM 中转 receiver / 非 bridge 出口) ──
  // 只判 AM 语境文件;豁免姿势与 R1-R3 完全一致(行内标记 / 基线棘轮),不新增第三种。
  if (isAlertmanagerSurfacePath(norm)) {
    const { hits, commentLiterals } = scanAlertmanagerSurface(lines)
    stats.amCommentLiterals += commentLiterals
    for (const hit of hits) {
      if (isExemptAt(lines, hit.idx)) {
        stats.exempted += 1
        continue
      }
      violations.push({ path: norm, rule: 'R4', line: hit.line, snippet: hit.snippet, reason: hit.reason })
    }
  }

  return { violations, stats }
}

export function newStats() {
  return {
    judged: 0,
    selfExempt: 0,
    brandExitSkipped: 0,
    exempted: 0,
    unreadable: 0,
    amCommentLiterals: 0,
    baselineTolerated: 0,
    baselineShrinkKeys: [],
    baselineMissing: false,
  }
}

// ══════════════ 基线棘轮(只减不增) ══════════════

/** 基线缺失 → 空基线(照常判定,不静默放行);JSON 损坏 → 抛错由入口转 exit 2。 */
export function parseBaseline(jsonText) {
  const parsed = JSON.parse(jsonText)
  const counts = parsed && typeof parsed.counts === 'object' && parsed.counts !== null ? parsed.counts : {}
  const out = {}
  for (const [k, v] of Object.entries(counts)) out[k] = Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0
  return out
}

/**
 * 应用棘轮:按 `<path>#<rule>` 分组,实发 ≤ 基线 → 全部放行(计 tolerated);
 * 超出 → 只把超出部分判红(按行号升序,基线额度放行靠前的)。
 * 基线里实发归零的 key → 记入 shrink 提示(提醒下调基线,不判红)。
 */
export function applyBaseline(violations, baselineCounts, stats) {
  const byKey = new Map()
  for (const v of violations) {
    const key = `${v.path}#${v.rule}`
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(v)
  }
  const fresh = []
  for (const [key, list] of byKey) {
    const allow = Number(baselineCounts[key] ?? 0)
    list.sort((a, b) => a.line - b.line)
    const over = list.slice(allow)
    stats.baselineTolerated += list.length - over.length
    fresh.push(...over)
  }
  for (const key of Object.keys(baselineCounts)) {
    if (!byKey.has(key) && baselineCounts[key] > 0) stats.baselineShrinkKeys.push(key)
  }
  fresh.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.line - b.line))
  return fresh
}

// ══════════════ 输出渲染 ══════════════

function snippet(line) {
  const s = String(line ?? '').replace(/\s+/g, ' ').trim()
  return s.length > SNIPPET_CHARS ? `${s.slice(0, SNIPPET_CHARS)}…` : s
}

const RULE_LABEL = {
  R1: 'R1 Send-MailMessage 缺 -BodyAsHtml(纯文本直发,无品牌版式)',
  R2: 'R2 Resend /emails 发送上下文无 html 字段(绕过模板的纯文本 API)',
  R3: 'R3 ops 邮件绕过品牌层(不引用 email-templates / notify-deploy-failure,或自拼 HTML 正文手抄版式)',
  R4: 'R4 告警接收面越界(Alertmanager 原生邮件 / IM 中转 receiver / 非 bridge 出口)',
}

export function render(modeLabel, totalPaths, fresh, stats) {
  const lines = [
    `📧 品牌邮件通道对账(${modeLabel}):判定 ${stats.judged} 个在范围文件(候选 ${totalPaths} 个路径)`,
  ]
  if (fresh.length > 0) {
    lines.push(`❌ 检出 ${fresh.length} 处未基线化违规:`)
    for (const v of fresh.slice(0, 40)) {
      const label = RULE_LABEL[v.rule] ?? v.rule
      lines.push(`   - ${v.path}:${v.line}  [${label}${v.reason ? ` — ${v.reason}` : ''}]`)
      lines.push(`       ${snippet(v.snippet)}`)
    }
    if (fresh.length > 40) lines.push(`   ... 另有 ${fresh.length - 40} 处`)
    lines.push('')
    lines.push('   修复的唯一正确姿势:ops 邮件一律经品牌层 ——')
    lines.push('     ① PowerShell / CI / 脚本侧改调 `apps/api/scripts/notify-deploy-failure.ts`')
    lines.push('        (内部走 email-templates 的"智汇通报"版式),不在端内自拼传输层;')
    lines.push('     ② 确需新增模板:在 `apps/api/src/services/email-templates.ts` 加 render* 函数;')
    lines.push('     ③ 命中的是 R3b(自拼 HTML / 手抄版式):把正文改回**纯文本**交给出口')
    lines.push('        (`--message-file`),版式由 email-templates 单点渲染 —— 接了出口也不许自带一份 HTML;')
    lines.push('     ④ 仅"确属有意纯文本且不需版式"(如对拍调试)才允许在命中行或紧邻上行加')
    lines.push('        `brand-mail-exempt: <一句话原因>`;存量红进 ' + BASELINE_REL + '(只减不增)。')
    lines.push('     ⑤ 命中的是 R4(Alertmanager 接收面):infra 告警到人只有')
    lines.push(`        webhook → bridge → 品牌邮件一条路,唯一合法出口是 ${BRIDGE_URL};`)
    lines.push('        AM 原生 email_configs / smtp_* 与钉钉/飞书/企业微信中转 receiver 均已整体')
    lines.push('        摘除,不可再加回(AGENTS.md §5e)。换 bridge 监听地址属部署变更,必须同批')
    lines.push('        改 scripts/render-alertmanager-config.mjs 的 BRIDGE_URL 并跑一次渲染校验。')
  } else {
    lines.push('✅ 未检出未基线化违规')
  }
  const notes = []
  if (stats.baselineTolerated > 0) notes.push(`基线放行=${stats.baselineTolerated}`)
  if (stats.exempted > 0) notes.push(`豁免标记命中=${stats.exempted}`)
  if (stats.selfExempt > 0) notes.push(`自豁免(本门自身与测试,判据含字面量)=${stats.selfExempt}`)
  if (stats.brandExitSkipped > 0) notes.push(`品牌出口自身不判 R2/R3=${stats.brandExitSkipped}(它是版式唯一实现)`)
  if (stats.unreadable > 0) notes.push(`取不到内容=${stats.unreadable}`)
  if (stats.amCommentLiterals > 0) {
    notes.push(`AM 注释行内被禁字面量=${stats.amCommentLiterals}(整行 YAML 注释不判红,如实报出)`)
  }
  if (notes.length) lines.push(`   计数:${notes.join(' · ')}(均为如实计数,非静默)`)
  if (stats.baselineShrinkKeys.length > 0) {
    lines.push(
      `   💡 基线余量(实发已归零,请下调 ${BASELINE_REL}):${stats.baselineShrinkKeys.slice(0, 10).join(', ')}`,
    )
  }
  return lines
}

// ══════════════ 取材(三种模式的候选清单) ══════════════

/** 暂存区路径(A/C/M/R/D/T/U);删除态无内容由 readIndexBlob 兜底返回 null。 */
export function stagedPaths(repoRoot) {
  return gitPathList(['-C', repoRoot, 'diff', '--cached', '--name-only', '--diff-filter=ACMRTUD', '-z'])
    .split('\0')
    .filter(Boolean)
}

/** 全量模式候选:git 跟踪文件(未跟踪内容不会被提交,不判)。 */
export function trackedPaths(repoRoot) {
  return gitPathList(['-C', repoRoot, 'ls-files', '-z']).split('\0').filter(Boolean)
}

function readIndexBlob(repoRoot, rel) {
  try {
    return git(['-C', repoRoot, 'show', `:${rel}`], {
      encoding: 'buffer',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString('utf8')
  } catch {
    return null
  }
}

function readWorktreeFile(repoRoot, rel) {
  try {
    return readFileSync(join(repoRoot, rel), 'utf8')
  } catch {
    return null
  }
}

function readBaselineCounts(repoRoot) {
  let raw
  try {
    raw = readFileSync(join(repoRoot, BASELINE_REL), 'utf8')
  } catch {
    return { counts: {}, exists: false }
  }
  return { counts: parseBaseline(raw), exists: true }
}

/**
 * 审计入口(repoRoot / baseline 可注入,供 self-test 用临时仓取证)。
 * staged 模式:候选 = 暂存集 ∩ 范围;暂存集为空或取不到 → 退化全量(守门 70 教训,
 * 防"空暂存恒绿")。
 */
export function audit(repoRoot, { staged = false, baseline } = {}) {
  const stats = newStats()
  const { counts: baseCounts, exists: baselineExists } =
    baseline !== undefined ? { counts: baseline, exists: true } : readBaselineCounts(repoRoot)

  let candidates = null
  let modeLabel = null
  if (staged) {
    let list = null
    try {
      list = stagedPaths(repoRoot)
    } catch {
      list = null
    }
    if (list && list.length > 0) {
      candidates = list.filter(isScannedPath)
      modeLabel = 'pre-commit:索引里在范围内的文件'
    } else {
      candidates = trackedPaths(repoRoot).filter(isScannedPath)
      modeLabel = 'pre-commit 退化全量(暂存集为空/取不到,防"空暂存恒绿")'
    }
  } else {
    candidates = trackedPaths(repoRoot).filter(isScannedPath)
    modeLabel = '全量:跟踪文件工作区内容'
  }

  const violations = []
  for (const rel of candidates) {
    let text = null
    if (modeLabel.startsWith('pre-commit:')) {
      text = readIndexBlob(repoRoot, rel)
      if (text === null) text = readWorktreeFile(repoRoot, rel)
    } else {
      text = readWorktreeFile(repoRoot, rel)
    }
    if (text === null) {
      if (!isSelfExempt(rel)) stats.unreadable += 1
      continue
    }
    violations.push(...judgeText(rel, text, stats).violations)
  }
  if (!baselineExists && stats.judged > 0) {
    // 基线缺失不是错误,但必须显式说 —— 否则"全绿"可能只是没人把存量写进来
    stats.baselineMissing = true
  }
  const fresh = applyBaseline(violations, baseCounts, stats)
  if (staged && modeLabel.startsWith('pre-commit:')) {
    // --staged 只判暂存子集:基线 key 不在子集里 ≠ "实发归零",收缩提示只对全量有意义
    stats.baselineShrinkKeys = []
  }
  const label = stats.baselineMissing ? `${modeLabel};⚠️ 基线文件缺失,按空基线判定` : modeLabel
  return {
    code: fresh.length > 0 ? 1 : 0,
    lines: render(label, candidates.length, fresh, stats),
    violations: fresh,
    allViolations: violations,
    stats,
  }
}

// ══════════════ self-test(判据正反成对 + 临时仓模式取证,不触碰真实仓) ══════════════

function selfTestRun() {
  const results = []
  const check = (name, ok) => results.push({ name, ok: Boolean(ok) })
  const judge = (rel, text) => judgeText(rel, text, newStats()).violations

  // ── PS 抽取器 ──
  const ps1Lines = [
    'Send-MailMessage -SmtpServer $h -Body $text -Encoding UTF8',
    'Send-MailMessage -SmtpServer $h `',
    '    -Body $text -Encoding UTF8',
  ]
  const stmts = extractSendMailStatements(ps1Lines)
  check('1 PS 抽取器:两条调用各自成语句', stmts.length === 2)
  check('2 PS 抽取器:反引号续行合并为一条(跨 1-2 行)', stmts[1].startLine === 2 && stmts[1].endLine === 3)

  // ── R1 正反成对 ──
  const r1red = 'x.ps1'
  check(
    '3 R1 红:Send-MailMessage -Body $text 无 -BodyAsHtml',
    judge(r1red, 'Send-MailMessage -SmtpServer $h -Body $text').some((v) => v.rule === 'R1'),
  )
  check(
    '4 R1 绿:补 -BodyAsHtml',
    !judge(r1red, 'Send-MailMessage -SmtpServer $h -BodyAsHtml -Body $text').some((v) => v.rule === 'R1'),
  )
  check(
    '5 R1 绿:-BodyAsHtml 落在续行上同样判绿',
    !judge(r1red, 'Send-MailMessage -SmtpServer $h `\n    -BodyAsHtml -Body $text').some((v) => v.rule === 'R1'),
  )
  check(
    '6 R1 绿:紧邻上行 brand-mail-exempt 豁免',
    !judge(r1red, '# brand-mail-exempt: 有意纯文本\nSend-MailMessage -SmtpServer $h -Body $text').some(
      (v) => v.rule === 'R1',
    ),
  )
  check(
    '7 R1 绿:注释行里的 Send-MailMessage 不判',
    judge(r1red, '# Send-MailMessage 已废弃,不要用').length === 0,
  )

  // ── R2 正反成对 ──
  const psPayload = [
    "$payload = @{ from = 'a@b.c'; to = @($to); subject = $s; text = $t } | ConvertTo-Json",
    "Invoke-RestMethod -Uri 'https://api.resend.com/emails' -Method Post -Body $payload",
  ].join('\n')
  check(
    '8 R2 红:Resend /emails + payload 只有 text',
    judge('x.ps1', psPayload).some((v) => v.rule === 'R2'),
  )
  check(
    '9 R2 绿:payload 补 PS hashtable html 键',
    !judge(
      'x.ps1',
      psPayload.replace('text = $t', 'text = $t; html = $h'),
    ).some((v) => v.rule === 'R2'),
  )
  check(
    '10 R2 绿:JS `html:` 与 Python "html": 两种形态均被识别',
    !judge('x.mjs', "fetch('https://api.resend.com/emails', { body: JSON.stringify({ text: t, html: h }) })").some(
      (v) => v.rule === 'R2',
    ) &&
      !judge('x.py', "post('https://api.resend.com/emails', json={'text': t, \"html\": h})").some(
        (v) => v.rule === 'R2',
      ),
  )
  check(
    '11 R2 红:host+path 分行形态不逃逸(无 html 判红)',
    judge(
      'x.mjs',
      ["const r = await post({", "  host: 'api.resend.com',", "  path: '/emails',", '  body,', '})'].join('\n'),
    ).some((v) => v.rule === 'R2'),
  )
  check(
    '12 R2 红:孤立 html 出现在窗口之外(第 40 行)仍判红',
    judge(
      'x.mjs',
      [
        ...Array.from({ length: 40 }, (_, k) => `const v${k} = ${k}`),
        "fetch('https://api.resend.com/emails', { body: JSON.stringify({ text: t }) })",
      ].join('\n'),
    ).some((v) => v.rule === 'R2'),
  )
  check(
    '13 R2 绿:api.resend.com 后 140 字符内无 /emails(裸域名探测)不判',
    judge('x.mjs', "const ok = probe('api.resend.com') // 仅 TLS 连通性").filter((v) => v.rule === 'R2')
      .length === 0,
  )
  check(
    '14 R2 绿:brand-mail-exempt 标记豁免端点行',
    !judge(
      'x.ps1',
      psPayload.replace("Invoke-RestMethod", "# brand-mail-exempt: 灰度期纯文本\n        Invoke-RestMethod"),
    ).some((v) => v.rule === 'R2'),
  )

  // ── R3 正反 ──
  check(
    '15 R3 红:ops 脚本有 sendMail 且无品牌层引用',
    judge('deploy/send-notify.mjs', "import nodemailer from 'nodemailer'\ntransporter.sendMail(msg)").some(
      (v) => v.rule === 'R3',
    ),
  )
  check(
    '16 R3 绿:import email-templates 即接上品牌层',
    !judge(
      'deploy/send-notify.mjs',
      "import { renderSystemAlertEmail } from '../apps/api/src/services/email-templates'\ntransporter.sendMail(msg)",
    ).some((v) => v.rule === 'R3'),
  )
  check(
    '17 R3 绿:改调 notify-deploy-failure 同样放过',
    !judge('deploy/x.ps1', 'node apps/api/scripts/notify-deploy-failure.ts\nSend-MailMessage -Body $t -BodyAsHtml').some(
      (v) => v.rule === 'R3',
    ),
  )
  check(
    '18 R3 绿:仅注释提到 createTransport 不计发信动作',
    judge('scripts/doc-note.mjs', '// 历史上用过 createTransport,已迁移').length === 0,
  )
  check('19 R3 绿:ps1 无 Send-MailMessage 且无发信 token → 无违规', judge('deploy/clean.ps1', 'Write-Host ok').length === 0)

  // ── 自豁免 / 范围 ──
  const seStats = newStats()
  const se = judgeText(
    'scripts/check-brand-email-channel.mjs',
    "Send-MailMessage -Body $text\nfetch('https://api.resend.com/emails')",
    seStats,
  )
  check('20 自豁免:本门脚本自身含字面量不判红且如实计数', se.violations.length === 0 && seStats.selfExempt === 1)
  check('21 范围:deploy+scripts+workflows 在范围,tests/apps/其他扩展名不在',
    isScannedPath('deploy/win/a.ps1') &&
      isScannedPath('scripts/b.mjs') &&
      isScannedPath('.github/workflows/c.yml') &&
      !isScannedPath('scripts/tests/d.mjs') &&
      !isScannedPath('apps/api/src/services/e.ts') &&
      !isScannedPath('deploy/win/f.log') &&
      !isScannedPath('.github/workflows/nested/g.yml'))

  // ── 基线棘轮 ──
  const mk = (n) => Array.from({ length: n }, (_, k) => ({ path: 'p.ps1', rule: 'R1', line: k + 1, snippet: '' }))
  const stA = newStats()
  const fA = applyBaseline(mk(3), { 'p.ps1#R1': 2 }, stA)
  check('22 棘轮:实发 3 / 基线 2 → 只超出部分判红 1', fA.length === 1 && stA.baselineTolerated === 2)
  const stB = newStats()
  check('23 棘轮:实发 ≤ 基线 → 全放行', applyBaseline(mk(1), { 'p.ps1#R1': 2 }, stB).length === 0)
  const stC = newStats()
  applyBaseline([], { 'p.ps1#R1': 2 }, stC)
  check('24 棘轮:基线 key 实发归零 → 收缩提示不判红', stC.baselineShrinkKeys.length === 1)

  // ── 临时仓:--staged / 全量 / 空暂存退化 ──
  // 落点仍是仓内 .ihui-agent/tmp(AGENTS §15),但干净 checkout / CI runner 上该目录不存在,
  // mkdtempSync 会直接 ENOENT —— recursive mkdir 幂等,已存在不报错。
  const tmpRoot = join(ROOT, '.ihui-agent', 'tmp')
  mkdirSync(tmpRoot, { recursive: true })
  const root = mkdtempSync(join(tmpRoot, 'brand-mail-drill-'))
  const repo = join(root, 'repo')
  mkdirSync(repo, { recursive: true })
  const g = (args) => git(['-C', repo, ...args])
  try {
    g(['init', '-q', '--initial-branch=main'])
    g(['config', 'core.autocrlf', 'false'])
    g(['config', 'user.email', 't@t'])
    g(['config', 'user.name', 't'])
    mkdirSync(join(repo, 'deploy'), { recursive: true })
    const BAD = 'Send-MailMessage -SmtpServer $h -Body $text'
    writeFileSync(join(repo, 'deploy', 'a.ps1'), 'Write-Host clean\n')
    writeFileSync(join(repo, 'README.txt'), 'hello\n')
    g(['add', '-A'])
    g(['commit', '-qm', 'init'])

    check('25 干净仓:全量判绿', audit(repo, { baseline: {} }).code === 0)

    // 索引干净、磁盘脏 → --staged 判绿(未暂存内容不会被本次提交带上)
    writeFileSync(join(repo, 'deploy', 'a.ps1'), BAD + '\n')
    writeFileSync(join(repo, 'README.txt'), 'hello 2\n')
    g(['add', 'README.txt'])
    const s1 = audit(repo, { staged: true, baseline: {} })
    check('26 --staged 只判索引:a.ps1 仅磁盘脏 → 本次提交判绿', s1.code === 0)
    check('27 全量模式同一脏文件 → 判红(两种取材面语义相反且各自正确)', audit(repo, { baseline: {} }).code === 1)

    // 暂存进索引 → --staged 判红并点名
    g(['add', 'deploy/a.ps1'])
    const s2 = audit(repo, { staged: true, baseline: {} })
    check(
      '28 --staged 命中索引里的违规并点名文件+规则',
      s2.code === 1 && s2.violations.some((v) => v.path === 'deploy/a.ps1' && v.rule === 'R1'),
    )
    // 基线在位 → 同一条违规被棘轮放行
    const s3 = audit(repo, { staged: true, baseline: { 'deploy/a.ps1#R1': 1 } })
    check('29 基线在位 → 存量放行、不判红', s3.code === 0 && s3.stats.baselineTolerated === 1)

    g(['commit', '-qm', 'bad in'])
    // 暂存集为空 → 必须退化全量(防"空暂存恒绿")
    const s4 = audit(repo, { staged: true, baseline: {} })
    check('30 暂存集为空 → 退化全量仍判红(防"空暂存恒绿")', s4.code === 1)

    // ══ 2026-09-24 扩面取证:monitoring/** + .cjs + apps/api/scripts/** 真被扫到 ══
    // (临时仓 = 本门自己的取材口径,等价"注入对照":假违规样本必须被判红)
    mkdirSync(join(repo, 'monitoring', 'alertbridge'), { recursive: true })
    mkdirSync(join(repo, 'apps', 'api', 'scripts'), { recursive: true })

    const BRIDGE_BAD = [
      "const nodemailer = require('nodemailer')",
      'const tp = nodemailer.createTransport({ host: smtpHost })',
      "tp.sendMail({ to: ops, subject: 'PG 备份缺失', text: plainBody })",
    ].join('\n')
    writeFileSync(join(repo, 'monitoring', 'alertbridge', 'rogue-sender.cjs'), BRIDGE_BAD + '\n')
    g(['add', 'monitoring/alertbridge/rogue-sender.cjs'])
    const s5 = audit(repo, { staged: true, baseline: {} })
    check(
      '31 扩面·红:monitoring/** 下 .cjs 自拼 nodemailer 且不调出口 → 判红且点名该路径',
      s5.code === 1 && s5.violations.some((v) => v.path === 'monitoring/alertbridge/rogue-sender.cjs' && v.rule === 'R3'),
    )
    check(
      '32 扩面·判据可见性:全量模式同一条也判红(非只 --staged 才看得见)',
      audit(repo, { baseline: {} }).violations.some((v) => v.path === 'monitoring/alertbridge/rogue-sender.cjs'),
    )

    const BRIDGE_OK = [
      '// 邮件腿唯一出口:品牌派发器',
      "spawnSync('node', ['apps/api/scripts/notify-deploy-failure.ts', '--message-file', f])",
      "const nodemailer = require('nodemailer')",
      'const tp = nodemailer.createTransport({ host: smtpHost })',
      'tp.sendMail(msg)',
    ].join('\n')
    writeFileSync(join(repo, 'monitoring', 'alertbridge', 'rogue-sender.cjs'), BRIDGE_OK + '\n')
    g(['add', 'monitoring/alertbridge/rogue-sender.cjs'])
    check(
      '33 扩面·绿:同一 .cjs 改为调 notify-deploy-failure → 判绿(证明 31 红在"绕出口",不是扩面误伤)',
      !audit(repo, { staged: true, baseline: {} }).violations.some(
        (v) => v.path === 'monitoring/alertbridge/rogue-sender.cjs',
      ),
    )

    const MTS_BAD = [
      "const url = 'https://api.resend.com/emails'",
      "await fetch(url, { method: 'POST', body: JSON.stringify({ text }) })",
    ].join('\n')
    writeFileSync(join(repo, 'apps', 'api', 'scripts', 'send-weekly.mts'), MTS_BAD + '\n')
    g(['add', 'apps/api/scripts/send-weekly.mts'])
    const s6 = audit(repo, { staged: true, baseline: {} })
    check(
      '34 扩展名真进:.mts 且在新目录 apps/api/scripts/** → 判红(不是"目录进了扩展名没进"的假扩面)',
      s6.violations.some((v) => v.path === 'apps/api/scripts/send-weekly.mts' && v.rule === 'R2'),
    )

    writeFileSync(join(repo, 'apps', 'api', 'scripts', 'notify-deploy-failure.ts'), MTS_BAD + '\n')
    g(['add', 'apps/api/scripts/notify-deploy-failure.ts'])
    const s7 = audit(repo, { staged: true, baseline: {} })
    check(
      '35 品牌出口 carve 精准:同目录邻居判红,出口自身同形态内容不判(且如实计数)',
      !s7.violations.some((v) => v.path === BRAND_EXIT_REL) &&
        s7.stats.brandExitSkipped === 1 &&
        s7.violations.some((v) => v.path === 'apps/api/scripts/send-weekly.mts'),
    )
    rmSync(join(repo, 'apps', 'api', 'scripts', 'notify-deploy-failure.ts'), { force: true })
    rmSync(join(repo, 'apps', 'api', 'scripts', 'send-weekly.mts'), { force: true })
    rmSync(join(repo, 'monitoring', 'alertbridge', 'rogue-sender.cjs'), { force: true })
    g(['add', '-A'])

    // ══ R3b(自拼 HTML 正文 / 手抄品牌版式)正反成对 ══
    // 真违规形态:接了品牌出口,却自带一份机械风版式(出口只该收到纯文本正文)
    const LAYOUT_HOT = [
      "import { spawnSync } from 'node:child_process'",
      "const subject = '智汇通报'",
      "const head = '<table role=\"presentation\" width=\"600\" bgcolor=\"#0A0A0C\">'",
      "  + '<td style=\"font-family:Consolas,monospace;letter-spacing:3px;color:#B4FF00;\">IHUI</td></table>'",
      "spawnSync('node', ['apps/api/scripts/notify-deploy-failure.ts', '--message', head])",
    ].join('\n')
    check(
      '36 R3b 红:接了出口仍自带一份 HTML 版式(R3a 放过的那一型,必须由 R3b 兜住)',
      judge('monitoring/alertbridge/x.cjs', LAYOUT_HOT).some((v) => v.rule === 'R3'),
    )
    check(
      '37 R3b 反例:同样一段 HTML 但无邮件语境(页面/报告生成)不判 —— 三段与门缺一不可',
      judge(
        'scripts/gen-report.mjs',
        [
          "const page = '<table width=\"600\" bgcolor=\"#0A0A0C\">'",
          "  + '<td style=\"font-family:Consolas,monospace;letter-spacing:3px;color:#B4FF00;\">IHUI</td></table>'",
          "writeFileSync('report.html', page)",
        ].join('\n'),
      ).length === 0,
    )
    check(
      '38 R3b 反例:版式标记与样式指纹相距 > 窗口(10 行)不判 —— 距离判据真的在生效',
      judge(
        'scripts/far.mjs',
        [
          "const subject = 'x'",
          "const t = '<table>'",
          ...Array.from({ length: 16 }, (_, k) => `const v${k} = ${k}`),
          "const css = 'letter-spacing:3px'",
        ].join('\n'),
      ).length === 0,
    )
    check(
      '39 R3b 反例:只有样式指纹、无邮件版式标记(守门脚本的 CSS 夹具形态)不判',
      judge(
        'scripts/check-radius.mjs',
        "const subject = 'x'\nconst css = 'border-radius:6px;font-family:Consolas'\nconst RE = /letter-spacing\\s*:/",
      ).length === 0,
    )
    check(
      '40 R3b 反例:整段版式写在注释里不判(与本门一致取向:宁漏不误报)',
      judge('scripts/doc.mjs', `// ${LAYOUT_HOT.split('\n')[3]}\nconst subject = 'x'`).length === 0,
    )
    check(
      '41 R3b 绿:命中行紧邻上行 brand-mail-exempt 同样豁免',
      judge(
        'monitoring/y.cjs',
        [
          "const subject = 'x'",
          '// brand-mail-exempt: 有意自带纯文本 ASCII 版式',
          "const head = '<table bgcolor=\"#0A0A0C\">'",
          "const css = 'letter-spacing:3px'",
        ].join('\n'),
      ).filter((v) => v.rule === 'R3').length === 0,
    )

    // ══ 发信动作的"派生名":bridge 自己的腿函数就叫 sendMailLeg ══
    check(
      '42 发信动作认派生名:sendMailLeg 计为动作(旧 sendMail\\b 判不到 → 扩面后仍会空转)',
      judge('monitoring/alertbridge/z.cjs', "async function sendMailLeg(to) {}\nmodule.exports = sendMailLeg").some(
        (v) => v.rule === 'R3',
      ),
    )

    // ══ 品牌出口 carve 的纯函数面 ══
    const exitStats = newStats()
    const exitRes = judgeText(BRAND_EXIT_REL, MTS_BAD, exitStats)
    check(
      '43 品牌出口自身:同一条 R2 形态内容判绿,并如实计 brandExitSkipped=1(不静默)',
      exitRes.violations.length === 0 && exitStats.brandExitSkipped === 1,
    )
    check(
      '44 反例:把出口路径改一个字(邻居脚本)即判红 —— carve 精准到单一路径,不是一整目录',
      judgeText('apps/api/scripts/notify-deploy-failureX.ts', MTS_BAD, newStats()).violations.some(
        (v) => v.rule === 'R2',
      ),
    )

    // ══ 范围与扩展名(2026-09-24 扩面)══
    check(
      '45 范围:monitoring/** 与 apps/api/scripts/** 的新扩展名(.cjs/.mts)在范围内',
      isScannedPath('monitoring/alertbridge/alert-webhook-bridge.cjs') &&
        isScannedPath('monitoring/x.cjs') &&
        isScannedPath('apps/api/scripts/send-weekly.mts') &&
        isScannedPath('scripts/x.cjs'),
    )
    check(
      '46 范围反向:证据式不扩的面仍在面外(packages/apps 运行时/deploy 下非脚本扩展名)',
      !isScannedPath('packages/api-client/src/endpoints/mail.ts') &&
        !isScannedPath('apps/api/src/routes/system.ts') &&
        !isScannedPath('apps/api/src/services/email-service.ts') &&
        !isScannedPath('deploy/scripts/backup-db.sh') &&
        !isScannedPath('monitoring/alertbridge/README.md') &&
        !isScannedPath('scripts/db/db_sync.py'),
    )

    // ══ R4 告警接收面(Alertmanager)正反成对 ══
    // 干净稿:与真仓 monitoring/alertmanager/alertmanager.yml.tmpl 收敛后的形态同构
    const AM_CLEAN = [
      'global:',
      '  resolve_timeout: 5m',
      '',
      'route:',
      "  receiver: 'default-webhook'",
      "  group_by: ['alertname', 'service']",
      '',
      'receivers:',
      "  - name: 'default-webhook'",
      '    webhook_configs:',
      "      - url: 'http://127.0.0.1:9096/alert'",
      '        send_resolved: true',
    ].join('\n')
    const AM_REL = 'monitoring/alertmanager/alertmanager.yml.tmpl'
    const r4 = (rel, text) => judge(rel, text).filter((v) => v.rule === 'R4')

    check('47 R4 绿:干净 bridge-only 模板判绿(真仓现状的同构样本)', r4(AM_REL, AM_CLEAN).length === 0)
    check(
      '48 R4a 红:.tmpl 里加回 email_configs ⇒ 点名该行(本次立项的原始旁路形态)',
      r4(AM_REL, AM_CLEAN + "\n  - name: 'mail'\n    email_configs:\n      - to: 'ops@example.com'\n").length === 1,
    )
    check(
      '49 R4a 红:global 下加回 smtp_* 段 ⇒ 判红(AM 里 smtp_* 的唯一宿主就是原生邮件面)',
      r4(AM_REL, AM_CLEAN.replace('  resolve_timeout: 5m', '  resolve_timeout: 5m\n  smtp_smarthost: smtp.example.net:587'))
        .length === 1,
    )
    check(
      '50 R4b 红:receiver 改名 feishu-copy 仍判红 —— 认的是 slug,不只有原名字',
      r4(AM_REL, AM_CLEAN + "\n  - name: 'feishu-copy'\n    webhook_configs:\n      - url: 'http://hook.invalid/hook'\n")
        .filter((v) => /R4b/.test(v.reason)).length === 1,
    )
    check(
      '51 R4b 红:host 特征独立成立(receiver 叫 alert-bot-copy、名字干净,但 url 是钉钉回调域名)',
      r4(AM_REL, AM_CLEAN + "\n  - name: 'alert-bot-copy'\n    webhook_configs:\n      - url: 'https://oapi.dingtalk.com/robot/send'\n")
        .filter((v) => /R4b/.test(v.reason)).length === 1,
    )
    check(
      '52 R4c 红:url 换 host 但端口仍 9096(localhost:9096)⇒ 与渲染器同取向判红(理由见 scanAlertmanagerSurface 注释)',
      r4(AM_REL, AM_CLEAN.replace('http://127.0.0.1:9096/alert', 'http://localhost:9096/alert')).length === 1,
    )
    {
      // 整行 YAML 注释:不判红,但被禁字面量必须如实计数(废弃桩 alertmanager.yml 就是这个形态)
      const st = newStats()
      const res = judgeText(
        AM_REL,
        ['# 历史旁路已摘除:email_configs / smtp_smarthost 都不可再加回', '# dingtalk / feishu 中转 receiver 同理', AM_CLEAN].join('\n'),
        st,
      )
      check('53 R4 注释行:不计红(宁漏不误报)但如实计数被禁字面量 ≥4 处', res.violations.length === 0 && st.amCommentLiterals >= 4)
    }
    check(
      '54 R4 豁免姿势未新增:命中行紧邻上行 brand-mail-exempt 同样放过',
      r4(AM_REL, AM_CLEAN + "\n  - name: 'mail'\n    # brand-mail-exempt: 演练\n    email_configs:\n").length === 0,
    )
    check(
      '55 R4 面反向:非 Alertmanager 语境的 yml 不吃 R4(workflows 只判 R1-R3;compose/prometheus 根本不进面)',
      r4('.github/workflows/ci.yml', "jobs:\n  a:\n    steps:\n      - run: 'echo hi'\nemail_configs:\n").length === 0 &&
        isScannedPath('.github/workflows/ci.yml') &&
        !isScannedPath('docker-compose.yml') &&
        !isScannedPath('monitoring/prometheus/prometheus.yml') &&
        !isScannedPath('monitoring/loki/loki-config.yml') &&
        !isScannedPath('deploy/docker/x.yaml') &&
        !isAlertmanagerSurfacePath('monitoring/prometheus/alerts.yml'),
    )
    check(
      '56 R4 面:AM 语境两条准入都认(目录 + 文件名形态),且扩展名三种齐进',
      isAlertmanagerSurfacePath('monitoring/alertmanager/noise-rules.yml') &&
        isAlertmanagerSurfacePath('monitoring/alertmanager/alertmanager.yml.tmpl') &&
        isAlertmanagerSurfacePath('deploy/prod-bundle/alertmanager.yml') &&
        isScannedPath(AM_REL) &&
        isScannedPath('monitoring/alertmanager/alertmanager.yaml'),
    )
    {
      // 基线棘轮对 R4 同样生效(唯一的"存量"通道),且不引入新豁免姿势
      const v4 = [{ path: AM_REL, rule: 'R4', line: 3, snippet: '' }]
      const stR = newStats()
      check(
        '57 R4 走既有基线棘轮:key <path>#R4,实发≤基线放行、超出判红',
        applyBaseline(v4, { [`${AM_REL}#R4`]: 1 }, stR).length === 0 &&
          stR.baselineTolerated === 1 &&
          applyBaseline(v4, {}, newStats()).length === 1,
      )
    }
    {
      // 临时仓端到端:提交链取材面(--staged 读索引 / 全量读工作区)都必须看得见 R4
      mkdirSync(join(repo, 'monitoring', 'alertmanager'), { recursive: true })
      const amPath = join(repo, 'monitoring', 'alertmanager', 'alertmanager.yml.tmpl')
      const BAD_AM = AM_CLEAN + "\n  - name: 'mail'\n    email_configs:\n      - to: 'ops@example.com'\n"
      writeFileSync(amPath, BAD_AM + '\n')
      g(['add', 'monitoring/alertmanager/alertmanager.yml.tmpl'])
      const sA = audit(repo, { staged: true, baseline: {} })
      check(
        '58 R4 装车(--staged 面):索引里的旁路模板判红并点名 path+行',
        sA.code === 1 && sA.violations.some((v) => v.path === AM_REL && v.rule === 'R4'),
      )
      g(['commit', '-qm', 'am bad'])
      const sB = audit(repo, { baseline: {} })
      check(
        '59 R4 装车(全量面):同一份内容在缺省模式同样判红并点名该路径(不是只有 --staged 才看得见)',
        sB.code === 1 && sB.violations.some((v) => v.path === AM_REL && v.rule === 'R4'),
      )
      const rendered = render('全量', 1, sB.violations, sB.stats).join('\n')
      check(
        '60 R4 输出归因可读:违规行带 R4a 子判据与"唯一合法出口是 bridge"的修复指引',
        /R4a/.test(rendered) && new RegExp(BRIDGE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(rendered),
      )
      writeFileSync(amPath, AM_CLEAN + '\n')
      g(['add', 'monitoring/alertmanager/alertmanager.yml.tmpl'])
      check('61 R4 可逆:同一文件改回 bridge-only ⇒ 判绿(证明 58/59 红在旁路本身,不是面写死)', audit(repo, { staged: true, baseline: {} }).code === 0)
      rmSync(amPath, { force: true })
      g(['add', '-A'])
      g(['commit', '-qm', 'am cleaned'])
    }

    let fail = 0
    for (const r of results) {
      console.log(`${r.ok ? '✅' : '❌'} ${r.name}`)
      if (!r.ok) fail += 1
    }
    console.log(
      fail
        ? `❌ check-brand-email-channel self-test FAILED ${fail}/${results.length}`
        : `✅ check-brand-email-channel self-test 全部通过(${results.length} 例,含正反成对对照)`,
    )
    return fail ? 1 : 0
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

// ══════════════ main ══════════════

const HELP = [
  '用法:node scripts/check-brand-email-channel.mjs [--staged] [--self-test] [--help]',
  '',
  '  缺省        全量审计:deploy/** monitoring/** apps/api/scripts/** scripts/**(不含 tests)的',
  '              .ps1/.mjs/.js/.cjs/.ts/.mts + workflows/*.yml',
  '              + Alertmanager 语境(monitoring/alertmanager/** 或文件名 alertmanager*)的',
  '              .yml/.yaml/.tmpl —— 不扫其余 yml,防 CI/compose/prometheus 大面积假阳',
  '  --staged    pre-commit 模式:只判索引里在范围内的文件;暂存集为空/取不到 → 退化全量',
  '  --self-test 判据正反成对对照 + 临时仓模式取证,不触碰真实仓',
  '',
  '判据:R1 Send-MailMessage 缺 -BodyAsHtml / R2 Resend /emails 发送上下文无 html /',
  '      R3 ops 绕过品牌层(R3a 不接品牌层;R3b 自拼 HTML 正文、手抄品牌版式) /',
  `      R4 告警接收面越界(AM 原生 email_configs·smtp_* / IM 中转 receiver / 非 ${BRIDGE_URL} 出口)`,
  `豁免:品牌出口自身 ${BRAND_EXIT_REL} 不判 R2/R3;命中行或紧邻上行 \`brand-mail-exempt: <原因>\`;`,
  `      存量:${BASELINE_REL}(只减不增;R4 不新增第三种豁免姿势,且基线现须为空)`,
  `退出码:0 通过 / 1 检出未基线化违规 / 2 脚本自身异常。紧急跳过:${SKIP_ENV}=1`,
].join('\n')

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help')) {
    console.log(HELP)
    return 0
  }
  if (argv.includes('--self-test')) return selfTestRun()
  if (process.env[SKIP_ENV] === '1') {
    console.log(`⚠️  已跳过品牌邮件通道守门(${SKIP_ENV}=1)`)
    return 0
  }
  if (!gitBin()) {
    console.error('❌ 未解析到可用 git 可执行文件(候选全失败)—— 判据无法执行,按异常处理')
    return 2
  }
  const { code, lines } = audit(ROOT, { staged: argv.includes('--staged') })
  console.log(lines.join('\n'))
  return code
}

/** §22d 双形态入口守护:测试 import 时不得触发 CLI 副作用。 */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => {
      if (code) process.exit(code)
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  gitBin,
  isScannedPath,
  isSelfExempt,
  isBrandExitScript,
  isExemptAt,
  isAlertmanagerSurfacePath,
  extractSendMailStatements,
  findResendEndpointHits,
  sendContextHasHtmlField,
  findLayoutCopyHits,
  scanAlertmanagerSurface,
  judgeText,
  newStats,
  parseBaseline,
  applyBaseline,
  audit,
  render,
  SKIP_ENV,
  BASELINE_REL,
  SELF_EXEMPT_PREFIX,
  BRAND_EXIT_REL,
  BRIDGE_URL,
  R3B_STYLE_WINDOW,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
