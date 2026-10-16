#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 本工具是运维尺子,结论必须走 stdout */
/**
 * 公网路径与换流窗口的常驻探测(台账票 G-301)——**只读探测**,不改任何服务、不写仓库内容。
 *
 * 立项凭据(2026-09-27 人肉量到,但当时**没有常驻生产者**:那条 `live-login-500` 告警在跟踪代码里
 * 找不到任何生产者,所以"这一型坏了会喊人"不成立):
 *   · 换流那几十秒 `127.0.0.1:8801/sso/login` 会**拒连**约 6–9 秒(该路径是 stop/start,没有蓝绿);
 *   · 同一窗口公网 `https://aizhs.top/sso/login` 有 **25/195 次 ≥8 秒**,而本地答 9ms
 *     ⇒ 常态公网延迟比换流洞**大一个量级**,才是主要矛盾。
 *
 * 所以本门有**两条独立序列,不得互相掩盖**(用一条掩盖另一条等于没做 —— 票面原话):
 *   序列 A = 换流窗口:与部署时刻对齐,量"这一次部署造成多长的不可用"(最长连续 + 总不可用秒数);
 *   序列 B = 常态公网延迟/失败率:与部署无关,量隧道/上游段健康度(非 2xx 率、≥slow-ms 率、最长连续)。
 *   两序列各自给结论、各自计未判定,**永不合并成一个数字**。
 *   **B 还有一条分离判据**(票 G-301 存在的理由):落在换流时刻 ±窗口内的坏点**不得混进 B 的常态比率**,
 *   它们按序列 A 的"洞长"口径单独计(`splitBySwapWindow`);事件时刻拿不到 ⇒ 分离本身记**未判定**并
 *   在常态结论上附注"窗口洞未剔除",而不是假装分过了。
 *
 * 换流事件 oracle 的**编码教训**(本尺子接手时第一次在真日志上量到的,写死在这防止被"改回中文标记"复辟):
 *   部署环日志里的中文**在落盘那一刻就烂了**(UTF-8→GBK→UTF-8 双重转码,磁盘上是 `锟斤拷`/`?` 序列),
 *   按 utf8 或 gbk 解码都**恢复不出「交换」二字** ⇒ 旧稿 `swapMarker:'交换 staging'` 对真日志**永不命中**,
 *   序列 A 会以"未判定"的体面形态永久失明 —— 而旧自检 E6 的断言(`/0 行/` 反向包含)恰好看不见这一型。
 *   现标记是**三条 ASCII 子串的合取**(`staging` ∧ `(.next)` ∧ `web`,取自 ihui-deploy.ps1:1405 那行的
 *   ASCII 骨架),对 2MB 真日志尾验证 28/28 命中、其余 60 条含 "staging" 的行 0 误命中。合取判据抽成
 *   `lineMatchesMarker` 一份实现,单串与数组两形态共用(旧自测夹具仍走单串,不必改语义)。
 *
 * 「探测失败=目标坏了」与「探测失败=我自己没跑到」怎么分开(本门的第二判据):
 *   ① 单次样本按**错误形态归桶**,并记 `stage` = 这一跳走到哪儿就断了(`http` 拿到状态行 /
 *      `conn` TCP 到了对端但被拒或被复位 / `stall` 连对端都没到):
 *      拒连、复位、5xx ⇒ "对端可归因"(只有这三型能算对端坏);
 *      DNS 解析失败、TLS 握手失败、超过探测上限被我方主动中止、**连接阶段超时/网络不可达
 *      (`connStall`)** ⇒ 落 **indeterminate**(不得据此判对端坏 —— §5d 那条"网络不可达不等于
 *      key 无效"的同一条禁令);
 *      解析不出形态的异常 ⇒ 落 **probeError**(我方坏了,20% 失明线使本轮不出结论)。
 *      ⚠️ `connStall` 是 2026-10-16 补的一格:旧稿不认识 `UND_ERR_CONNECT_TIMEOUT`,把它记成
 *      "尺子自己失明"⇒ 一次真的链路故障会被 20% 失明线洗成"本轮不出结论"(当天实测那型就是
 *      12 样本里的 1 条 10735ms)。它既不是对端坏,也不是尺子坏,所以必须具名。
 *   ② 越阈之后还要答"是**哪一段**坏了"(2026-10-16 立,当天那封"公网慢 60%"的邮件答不上这句):
 *      `classifyPublicLeg` 拿两把尺子 —— 同轮**本地对照组**(绕过 CF 边缘与隧道的 `127.0.0.1:8801`)
 *      与**分阶段读数**(DNS→TCP→TLS→响应)—— 把坏点定成四档之一:
 *        `服务段`(对照同轮也越阈 ⇒ web 本体) / `入口段`(对照健康且有握手完成后才慢的样本 ⇒ 访客同经此路)
 *        / `本机出口段`(对照健康而坏点全停在握手前或握手中 ⇒ 只关于本机出口链路,**真实访客不经此路**;
 *                         同日实测:本机 v4 握手失败 36%、v6 18%,而经节点打同一 URL 20/20 全成)
 *        / 不给段名(`unlocated` 分阶段读数不全、`undetermined` 任一侧没样本 ⇒ **只报数不冒认**)。
 *      定位结果进身份键(`B/公网·常态·入口段`)与正文 `[定位]` 行。**门槛与发信不在本门**:本门只量与判;
 *      寄信的持续性门槛(同一身份连几轮才到人、轮次按**时间**计量、恢复即清零)住在派发侧
 *      `scripts/git-guardian.mjs` 的 `auditPublicPathProbe()`。
 *      采样因此从 `fetch`(只有总耗时)换成 `node:http/https` 自持 socket 事件 —— 分界必须来自
 *      "真到过哪一跳",不是从文案里猜(文案随运行时版本漂,跳不会)。
 *   ③ 整轮"跑完没有"用仓里那把常驻取证包装器 `scripts/run-evidence.mjs` 的**同一份判据**
 *      (import judgeEvidence / RC_MARK,不另立第二份标记语法):证据末行没有 `#EVIDENCE-RC=`
 *      就判 INCOMPLETE ⇒ **exit 3**,既不记通过也不记失败。
 *
 * 三态硬要求(§12f):量到 / 量不到(点名原因) / 确实是 0 —— 绝不并桶;
 * 任何序列没采到样本 ⇒ 该序列喊"未判定",**不得**读成"0 次失败"。
 *
 * 定级:**warn / 纯告警**。本门刻意**不接提交链**(不在 guardian-runner、不在 pre-commit、不在 CI 必跑):
 * 它判的是**对端与本机出口此刻的可达性**,提交者结构上满足不了;挂 blocking 就是每台每次被逼
 * `--no-verify`,连带让链上全部对账作废(§12e 那型)。
 * 它的派发点是既有守护 `scripts/git-guardian.mjs` 的巡检轮。**〔更正@2026-10-16,取代下面那句
 * 2026-09-28 的旧登记;旧句原文逐字保留,只作改判留痕读,不得当口径引用〕**:旧句写"巡检轮里还没有
 * 它的调用点,且那整段定义也未入库 ⇒ 本门零调度器,现役问责方式只有手跑"——今天现读已不成立:
 * `auditPublicPathProbe()` 既在 `git-guardian.mjs` 里且已入库,调用点在巡检轮的"健康轮次早退之前 +
 * `!CHECK_ONLY`"那一格,现读派发节律 03:17/03:47/04:19/04:50/05:20/05:52/06:24/06:54Z(约 30 分钟
 * 一趟,与节流戳一致),告警经 `notifyGuardRed()` 按身份去重、无每日封顶;持续性门槛(同一身份连几轮
 * 才到人、轮次按**时间**计量、恢复即清零、脏账本自卫)也住在派发侧那一份实现里,不在本门。
 * 旧句(2026-09-28 交付时的现场,当时确实如此):该文件**工作树**副本已含 `auditPublicPathProbe()`
 * 定义(节流、三态、告警一律经 `notifyGuardRed()` 按 alert 身份去重、无每日封顶),**但巡检轮里
 * 还没有它的调用点,且那整段定义也未入库** —— 即截至本票交付,本门**零调度器**,现役问责方式只有手跑。
 * 本门自身不发信、不自拼 SMTP、不新建通道(守门 81 硬拦的就是这个)。
 *
 * 用法:
 *   node scripts/check-public-path-probe.mjs --snapshot            # 一次采样巡检(A+B+阳性对照+取证封缄读回;裸跑同义)
 *   node scripts/check-public-path-probe.mjs --snapshot --json     # 同上,输出单行可 JSON.parse 的结论
 *   node scripts/check-public-path-probe.mjs --sequence B --samples 40 --interval-ms 1000
 *   node scripts/check-public-path-probe.mjs --sequence A --wait-ms 240000   # 等下一次换流再量
 *   node scripts/check-public-path-probe.mjs --burst --json        # 守护用的短程档
 *   node scripts/check-public-path-probe.mjs --report <ledger>     # 只读回一份取证
 *   node scripts/check-public-path-probe.mjs --self-test           # 构造面正反对照(唯一不触网的一档)
 * 退出码:0 已判定且未越阈值 / 1 已判定且越阈值 / 2 用法错 / 3 INCOMPLETE 或未判定(结论无效)。
 * 阳性对照未命中 ⇒ 无论其余读数如何一律降 3(一把抓不到已知必坏目标的尺子,不配出具合格证)。
 */
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, rmSync, statSync, writeFileSync } from 'node:fs'
// 分阶段计时必须自己掌握 socket 事件(undici 的 fetch 只给总耗时,拿不到 DNS/TCP/TLS 的分界)。
import http from 'node:http'
import https from 'node:https'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// **复用**仓里那把常驻取证包装器的判据,不另立第二套标记语法(§22c 的 __test__ 出口就是为此而设)。
// 只取 judgeEvidence / exitCodeForVerdict 与两枚标记;run-evidence 自身仍是"是否跑完"的唯一判据面。
import { judgeEvidence, exitCodeForVerdict, __test__ as evidenceKit } from './run-evidence.mjs'
const { RC_MARK, KILLED_MARK } = evidenceKit

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

export const DEFAULTS = {
  publicUrl: process.env.IHUI_PUBLIC_URL || 'https://aizhs.top/sso/login',
  localUrl: 'http://127.0.0.1:8801/sso/login',
  /**
   * **阳性对照目标**(判据三"这条尺子不能恒 0"):一个形状合法、TCP 真出发、当前无人监听的死端口
   * (47801,实测本机 `connect ECONNREFUSED 127.0.0.1:47801`)。它被 `unavailable` 算成一次失败 ⇒
   * 才允许其余读数报 0;算不出来 ⇒ 整轮降"未判定"。
   * 两次实测教训(都写在证据流水里,勿"顺手改回"被否掉的形态):
   *   · `127.0.0.1:1/` 在 Node 上**到不了 TCP 层**——WHATWG URL 对端口 1 直接抛 `Error: bad port`
   *     (无 code),落 probeError 是对的(那是我方输入坏,不是对端坏),拿它当对照 = 逼判据冤枉自己;
   *   · "不存在的 Host" 的 DNS NXDOMAIN 落 indeterminate(§5d"网络不可达 ≠ 失效"同一条禁令),
   *     拿它做对照会逼判据把不可归因说成失败。
   * 若哪天 47801 被人占用回 200,对照转"未命中"、整轮降未判定并点名换靶 —— 失效方向是"多要一次
   * 人工确认",绝不反向(把健康误判成坏)。
   */
  controlUrl: 'http://127.0.0.1:47801/',
  samples: 24,
  intervalMs: 1000,
  /** 单次探测的墙上上限;超过即中止并记 indeterminate(不是"对端失败") */
  ceilingMs: 15_000,
  /** 票面口径:≥8 秒即计一次慢样本(那 25/195 就是这么量出来的) */
  slowMs: 8_000,
  /** 序列 A:换流事件之后继续采多长 */
  windowMs: 60_000,
  /** 序列 A:事件距今不超过这个值才认为"仍在窗口内可量" */
  recencyMs: 120_000,
  /** 部署环日志(换流事件的唯一 oracle)。路径由脚本自身位置推导,不写盘符(§15b)。 */
  deployLog: resolve(HERE, '..', 'deploy', 'win', 'deploy-loop.log'),
  /** 旧字段名保留但已升级为合取数组;单串仍可用(自测夹具走这一支)。 */
  swapMarker: ['staging', '(.next)', 'web'],
  /** 分离判据的窗口:事件前 preMs / 事件后 postMs 内的样本归"换流窗口",不进常态比率(序列 B 用)。 */
  splitPreMs: 20_000,
  splitPostMs: 60_000,
  /** B 序列阈值:硬失败率 / 慢样本率 */
  failRatio: 0.2,
  slowRatio: 0.1,
  /** A 序列阈值:一次换流造成超过这个秒数的不可用即越界 */
  outageMs: 5_000,
}

// ───────────────────────── 样本归类(纯函数) ─────────────────────────

/**
 * 一次 HTTP 采样 → 归桶。**归桶决定"能不能把它算成对端的错"**,所以宁可落 indeterminate
 * 也不把"我方出口坏了"记成"目标坏了"(§5d:网络不可达不等于对端失效)。
 *
 * `stage` 是把"这一跳走到哪儿就断了"钉成一等的判据面(2026-10-16 立,当天那封"公网慢 60%"的
 * 邮件答不出是哪一段坏了):
 *   `http`  拿到状态行 ⇒ 只有这一型证明"请求真的走完了,对端花了 ms 才答"
 *   `conn`  TCP 到了对端但被拒/被复位 ⇒ 可算对端不可用(换流那一型)
 *   `stall` 连对端都没到(DNS/TLS/连接超时/被我方上限中止)⇒ 属**本机出口与链路**,不得冒充对端慢
 * @param {{status?:number|null, ms:number, errorName?:string, errorCode?:string, causeCode?:string}} r
 */
export function classifySample(r) {
  const code = String(r.causeCode || r.errorCode || r.errorName || '')
  if (typeof r.status === 'number') {
    if (r.status >= 500) return { stage: 'http', bucket: 'http5xx', unavailable: true, note: `HTTP ${r.status}` }
    if (r.status >= 400) return { stage: 'http', bucket: 'http4xx', unavailable: false, note: `HTTP ${r.status}(未算对端不可用:4xx 常是路由/鉴权语义)` }
    if (r.status >= 300) return { stage: 'http', bucket: 'redirected', unavailable: false, note: `HTTP ${r.status}` }
    return { stage: 'http', bucket: 'ok', unavailable: false, note: `HTTP ${r.status}` }
  }
  // 有分阶段读数时**先看走到了哪一跳**,再看错误文案(文案随运行时版本漂,跳不会漂)。
  // 这一支存在的理由:今天那封邮件的实体是"TCP 连上了但 TLS 握手没完成"(本机↔CF 链路丢包),
  // 它既不是"对端不可用",也不是"服务响应慢"—— 混进"公网慢"就会让人去查根本健康的隧道与 web。
  const reached = typeof r.stageReached === 'string' ? r.stageReached : null
  const tlsDone = reached === 'tlsDone' || reached === 'response' || reached === 'body'
  if (reached !== null && !tlsDone && !/ECONNREFUSED|ECONNRESET|socket hang up|EPIPE|ERR_SOCKET|SocketClosed/i.test(code)) {
    // **位置优先于"谁停的表"**:TCP 连上了而 TLS 没完成,不管中止是我方上限还是链路自己断,
    // 事实都是"停在握手中" ⇒ 归 tlsStall(上限那一层写进 note,不另起一桶)。
    if (reached === 'tcp') {
      const byUs = r.aborted === true || /PROBE_CEILING|PROBE_INACTIVITY|ABORT_ERR|AbortError/i.test(code)
      return { stage: 'stall', bucket: 'tlsStall', unavailable: false, indeterminate: true, preTls: true, note: `TCP 连上但 TLS 握手未完成${byUs ? '(被我方上限中止)' : '(链路侧断开)'} ⇒ 本机出口到 CF 边缘这一跳在丢包,真实访客不经本机出口` }
    }
    if (r.aborted || /PROBE_CEILING|PROBE_INACTIVITY|ABORT_ERR|AbortError/i.test(code)) {
      return { stage: 'stall', bucket: 'overCeiling', unavailable: false, indeterminate: true, preTls: true, note: '到上限仍未完成握手 ⇒ 只知"比上限慢",不得记成对端不可用' }
    }
    if (/ENOTFOUND|EAI_AGAIN/i.test(code)) return { stage: 'stall', bucket: 'dns', unavailable: false, indeterminate: true, preTls: true, note: 'DNS 解析失败 ⇒ 分不清对端与我方出口,计未判定' }
    return { stage: 'stall', bucket: 'connStall', unavailable: false, indeterminate: true, preTls: true, note: '连 TCP 都没通 ⇒ 属本机出口与链路这一跳,不得记成对端不可用' }
  }
  if (r.aborted || /PROBE_CEILING|ABORT_ERR|AbortError/i.test(code)) {
    return { stage: 'stall', bucket: 'overCeiling', unavailable: false, indeterminate: true, note: '超过探测上限被我方中止 ⇒ 只知"比上限还慢",不得记成对端不可用' }
  }
  if (/ECONNREFUSED/i.test(code)) return { stage: 'conn', bucket: 'connRefused', unavailable: true, note: '连接被拒(换流那一型)' }
  if (/ECONNRESET|EPIPE|SocketClosed|ERR_SOCKET|socket hang up/i.test(code)) return { stage: 'conn', bucket: 'connReset', unavailable: true, note: '连接被复位' }
  if (/ENOTFOUND|EAI_AGAIN/i.test(code)) return { stage: 'stall', bucket: 'dns', unavailable: false, indeterminate: true, note: 'DNS 解析失败 ⇒ 分不清对端与我方出口,计未判定' }
  if (/CERT|TLS|SSL|UNABLE_TO_VERIFY|SELF_SIGNED/i.test(code)) return { stage: 'stall', bucket: 'tls', unavailable: false, indeterminate: true, note: 'TLS 握手失败 ⇒ 可能是我方信任库,计未判定' }
  if (/PROXY|TUNNEL/i.test(code)) return { stage: 'stall', bucket: 'proxy', unavailable: false, indeterminate: true, note: '出口代理链路报错 ⇒ 属我方配置,计未判定' }
  // **连接阶段就没通**(undici 的 UND_ERR_CONNECT_TIMEOUT 带 `attempted addresses` 与 10000ms)。
  // 旧稿没有这一条,它一路落到 probeError ⇒ 记成"本地探测故障 = 这把尺子失明",于是 20% 失明线
  // 会把一次真的链路故障洗成"本轮不出结论"(2026-10-16 实测:12 样本里那 1 条 10735ms 就被这么记的)。
  // 它既不是对端坏(没走到对端),也不是尺子坏(尺子自己跑完了、错误形态认识)⇒ 具名落 stall。
  if (/UND_ERR_CONNECT_TIMEOUT|EHOSTUNREACH|ENETUNREACH|ENETDOWN|NETWORK_UNREACH|NetworkUnreachable|Connect,?Timeout/i.test(code)) {
    return { stage: 'stall', bucket: 'connStall', unavailable: false, indeterminate: true, note: 'TCP 连接阶段就没通(连接超时/网络不可达)⇒ 属本机出口与链路这一跳,不得记成对端不可用' }
  }
  if (code) return { stage: 'stall', bucket: 'probeError', unavailable: false, probeSideBroken: true, note: `无法归类的本地异常:${code.slice(0, 90)}` }
  return { stage: 'stall', bucket: 'probeError', unavailable: false, probeSideBroken: true, note: '既无状态码也无错误形态 ⇒ 探测本身没跑到' }
}

/**
 * 样本的 `stage`:优先读归类时写下的字段,**旧取证行没有这个字段**(2026-10-16 之前的取证),
 * 所以缺失时按 status/bucket 派生 —— 绝不能把"没有 stage"读成 `stall`,那等于把历史取证里
 * 每一条 200 响应改判成"没走到对端"(把账面改成事实)。一份实现,统计与定位都走它。
 */
export function sampleStage(s) {
  if (s && typeof s.stage === 'string' && ['http', 'conn', 'stall'].includes(s.stage)) return s.stage
  if (s && typeof s.status === 'number') return 'http'
  const b = String((s && s.bucket) || '')
  if (b === 'connRefused' || b === 'connReset') return 'conn'
  if (b === 'ok' || b === 'http4xx' || b === 'http5xx' || b === 'redirected') return 'http'
  return 'stall'
}

/**
 * 一条序列的样本 → 统计。**两序列各调各的**,永不合并。
 * 慢样本包含 overCeiling:那条至少证明"耗时 ≥ 上限",是慢的事实,不是不可用的事实。
 */
export function summarizeSequence(samples, opt = {}) {
  const slowMs = opt.slowMs ?? DEFAULTS.slowMs
  const n = samples.length
  const buckets = { ok: 0, redirected: 0, http4xx: 0, http5xx: 0, connRefused: 0, connReset: 0, overCeiling: 0, connStall: 0, tlsStall: 0, dns: 0, tls: 0, proxy: 0, probeError: 0 }
  let unavailable = 0
  let indeterminate = 0
  let probeSideBroken = 0
  let slow = 0
  let maxMs = 0
  // 按"走到哪一跳"分账:`httpSlow` 才是"对端答得慢"的事实,`stallSlow` 是"连对端都没到"的事实。
  // `slow` 保留为总额(旧口径,含 conn 阶段的慢样本)—— 拆维是**加维度**,不是把原来的账抹掉。
  let httpN = 0
  let connN = 0
  let stallN = 0
  let httpSlow = 0
  let stallSlow = 0
  // 分阶段读数(2026-10-16 补):`tlsDoneN` = 握手完成的样本数,`preTlsStall` = 卡在握手前/中的样本数。
  // `stageEvidence` 必须显式记:旧取证行没有这些字段 ⇒ 定位时**不许冒认**是哪一段。
  let tlsDoneN = 0
  let preTlsStall = 0
  let postTlsStall = 0
  let stageSamples = 0
  for (const s of samples) {
    buckets[s.bucket] = (buckets[s.bucket] || 0) + 1
    const st = sampleStage(s)
    if (st === 'http') httpN += 1
    else if (st === 'conn') connN += 1
    else stallN += 1
    if (typeof s.stageReached === 'string') stageSamples += 1
    const tl = s.stages && typeof s.stages === 'object' ? s.stages : null
    const done = s.stageReached === 'tlsDone' || s.stageReached === 'response' || s.stageReached === 'body' || (tl && typeof tl.tls === 'number') || (typeof s.status === 'number' && s.status > 0)
    if (done) tlsDoneN += 1
    if (typeof s.stageReached === 'string' && !done) preTlsStall += 1
    // 握手**完成之后**没等到完整响应 ⇒ 这是访客也会经过的那一段的事实(与"停在握手中"互斥)
    if (done && typeof s.status !== 'number') postTlsStall += 1
    if (s.unavailable) unavailable += 1
    if (s.indeterminate) indeterminate += 1
    if (s.probeSideBroken) probeSideBroken += 1
    if (typeof s.ms === 'number' && s.ms >= slowMs) {
      slow += 1
      if (st === 'http') httpSlow += 1
      else if (st === 'stall') stallSlow += 1
    }
    if (typeof s.ms === 'number' && s.ms > maxMs) maxMs = s.ms
  }
  const { longestRunMs, runs } = longestUnavailableRun(samples)
  return {
    n,
    buckets,
    unavailable,
    indeterminate,
    probeSideBroken,
    slow,
    httpN,
    connN,
    stallN,
    httpSlow,
    stallSlow,
    tlsDoneN,
    preTlsStall,
    postTlsStall,
    stageSamples,
    // 定位只准在"每条样本都有分阶段读数"时冒认某一段;混入无读数的旧取证 ⇒ 只报数不定位。
    stageEvidence: n > 0 && stageSamples === n,
    maxMs,
    failRatio: n ? unavailable / n : null,
    slowRatio: n ? slow / n : null,
    httpSlowRatio: httpN ? httpSlow / httpN : null,
    stallRatio: n ? stallN / n : null,
    indeterminateRatio: n ? indeterminate / n : null,
    longestRunMs,
    runs,
    spanMs: n ? new Date(samples[n - 1].at).getTime() - new Date(samples[0].at).getTime() : 0,
  }
}

/**
 * 公网侧越阈了 —— **是哪一段坏了?** 拿两把尺子:同轮本地对照组(127.0.0.1:8801,绕过 CF 边缘与隧道)
 * 排除/坐实服务段,分阶段读数(DNS→TCP→TLS→响应)区分"本机出口在丢包"与"访客同经的入口段慢"。
 *   `service`     对照组同轮也越阈 ⇒ web 本体慢,公网那条路只是把它透出来;
 *   `entry`       对照组健康 **且** 有握手完成后才慢的样本 ⇒ 访客也会走这一段(CF 边缘 / 隧道 / 上行);
 *   `egress`      对照组健康 **且** 坏点全部停在握手前或握手中 ⇒ 事实只关于**本机出口链路**,
 *                 真实访客不经本机出口(2026-10-16 同日实测:本机 v4 握手失败 36%、v6 18%,
 *                 而经节点打同一 URL 20/20 全成、最慢 2641ms ⇒ 那封"公网慢 60%"的邮件实体是这一型);
 *   `unlocated`   越阈但分阶段读数不全(旧取证 / 采样档没带 stages)⇒ **只报数不给段名**,
 *                 绝不冒认某一段 —— 猜错方向的代价是让人去查健康的组件;
 *   `undetermined` 任一侧没采到样本 ⇒ 不猜(把"没量到"写成"没问题"是本仓最高频失效型)。
 * 不自立新阈值:只用两侧已有的比率与"坏点停在握手前/后"这一构造事实(现读实测:健康轮公网也会有
 * 1/10 条 ≥8s,而对照组始终 9–47ms ⇒ 定位靠对照与分界,不是再拍一条线)。
 */
export function classifyPublicLeg(pub, local, opt = {}) {
  const slowRatio = opt.slowRatio ?? DEFAULTS.slowRatio
  const failRatio = opt.failRatio ?? DEFAULTS.failRatio
  const over = (st) => (st.slowRatio !== null && st.slowRatio > slowRatio) || (st.failRatio !== null && st.failRatio > failRatio)
  if (!pub || pub.n === 0) return { leg: 'undetermined', tag: null, note: '公网侧本轮无样本 ⇒ 不定位(不得读成"入口段没问题")' }
  if (!local || local.n === 0) return { leg: 'undetermined', tag: null, note: '本地对照组本轮没采到样本 ⇒ 分不清"入口段慢"与"服务段慢",不得冒认定位' }
  if (!over(pub)) return { leg: 'clear', tag: null, note: `公网侧本轮未越阈(对照 ${local.n} 样本、最慢 ${Math.round(local.maxMs)}ms)` }
  const split = `握手完成 ${pub.tlsDoneN}/${pub.n},停在握手前或中 ${pub.preTlsStall},慢样本里走到对端之后 ${pub.httpSlow}、没走到对端 ${pub.stallSlow}`
  if (over(local)) return { leg: 'service', tag: '服务段', note: `本地对照组同轮也越阈(慢 ${local.slow}/${local.n},最慢 ${Math.round(local.maxMs)}ms)⇒ 洞在**服务段**(web 本体),不是公网入口;${split}` }
  if (!pub.stageEvidence) return { leg: 'unlocated', tag: null, note: `越阈但分阶段读数不全(${pub.stageSamples}/${pub.n} 条有)⇒ 无法区分"本机出口在丢包"与"访客同经的入口段慢",本条只报数不指段` }
  const postTlsBad = pub.httpSlow + (pub.postTlsStall ?? 0)
  if (postTlsBad > 0) return { leg: 'entry', tag: '入口段', note: `本地对照同轮 ${local.n} 样本最慢仅 ${Math.round(local.maxMs)}ms ⇒ 服务段是快的;有 ${postTlsBad} 条**握手完成后**才慢/没等到完整响应 ⇒ 洞在访客同经的**公网入口 ↔ 本机隧道**这一段(CF 边缘 / cloudflared / 上行);${split}` }
  return { leg: 'egress', tag: '本机出口段', note: `本地对照同轮 ${local.n} 样本最慢仅 ${Math.round(local.maxMs)}ms ⇒ 服务段是快的;坏点全部停在握手前或握手中(${pub.preTlsStall}/${pub.n})⇒ 事实只关于**本机出口到 CF 边缘**这一跳,真实访客不经本机出口,不该据此查隧道或 web;${split}` }
}

/** 最长连续"对端可归因失败"的墙钟跨度(不是次数 × 间隔 —— 间隔会漂)。 */
export function longestUnavailableRun(samples) {
  let best = 0
  const runs = []
  let startIdx = -1
  const close = (from, to) => {
    const ms = new Date(samples[to].at).getTime() - new Date(samples[from].at).getTime() + (samples[to].ms || 0)
    runs.push({ from: samples[from].at, to: samples[to].at, ms })
    if (ms > best) best = ms
  }
  for (let i = 0; i < samples.length; i += 1) {
    if (samples[i].unavailable) {
      if (startIdx < 0) startIdx = i
    } else if (startIdx >= 0) {
      close(startIdx, i - 1)
      startIdx = -1
    }
  }
  if (startIdx >= 0) close(startIdx, samples.length - 1)
  return { longestRunMs: best, runs }
}

/**
 * 单条(序列 × 目标)判定:未判定 / 越阈值 / 合规。三态绝不并桶。
 * `rule:'outage'` 给序列 A(一次换流只产生少数几条样本,看的是"连续不可用了多久",
 * 比率在那一头没有意义);`rule:'ratio'` 给序列 B(看失败率与慢样本率)。
 * @returns {{verdict:'unjudged'|'breach'|'ok', reasons:string[], numbers:string}}
 */
export function judgeSequence(id, stat, opt = {}) {
  const rule = opt.rule === 'outage' ? 'outage' : 'ratio'
  const slowMs = opt.slowMs ?? DEFAULTS.slowMs
  // 读数里带上"走到哪一跳"的分账(2026-10-16):原来这一行只有 `慢 6`,收信人无法判断
  // 是**对端答得慢**还是**这一跳根本没走通**——而这两件事的下一步动作完全不同。
  const httpN = stat.httpN ?? 0
  const stallN = stat.stallN ?? 0
  const httpSlow = stat.httpSlow ?? 0
  const stallSlow = stat.stallSlow ?? 0
  const numbers = `样本 ${stat.n} 次;走到对端并拿到响应 ${httpN},没走到对端 ${stallN};握手完成 ${stat.tlsDoneN ?? 0}/${stat.n},卡在握手前或握手中 ${stat.preTlsStall ?? 0};对端可归因失败 ${stat.unavailable};慢(≥${slowMs}ms)${stat.slow}(响应之后 ${httpSlow} / 连对端都没到 ${stallSlow});DNS/TLS/连接超时/超上限等不可归因 ${stat.indeterminate};本地探测故障 ${stat.probeSideBroken};最长连续不可用 ${Math.round(stat.longestRunMs / 100) / 10}s;最慢单次 ${Math.round(stat.maxMs)}ms${stat.stageEvidence === false && stat.n > 0 ? ';分阶段读数不全(仅 ' + (stat.stageSamples ?? 0) + '/' + stat.n + ' 条有)⇒ 不得据此定段' : ''}`
  if (stat.n === 0) return { verdict: 'unjudged', reasons: [`${id}:一个样本都没采到 ⇒ **未判定**,不得读成"0 次失败"`], numbers: `${id} 样本 0` }
  if (stat.probeSideBroken > 0 && stat.probeSideBroken / stat.n > 0.2) {
    return { verdict: 'unjudged', reasons: [`${id}:${stat.probeSideBroken}/${stat.n} 次是**本地**异常(无法归类)⇒ 这台尺子该目标本轮失明,不出结论`], numbers }
  }
  const reasons = []
  if (rule === 'outage') {
    const outageMsMax = opt.outageMs ?? DEFAULTS.outageMs
    if (stat.longestRunMs > outageMsMax) reasons.push(`${id}:最长连续不可用 ${Math.round(stat.longestRunMs)}ms > 阈值 ${outageMsMax}ms`)
  } else {
    if (stat.failRatio !== null && stat.failRatio > (opt.failRatio ?? DEFAULTS.failRatio)) {
      reasons.push(`${id}:对端可归因失败率 ${(stat.failRatio * 100).toFixed(1)}% > 阈值 ${((opt.failRatio ?? DEFAULTS.failRatio) * 100).toFixed(0)}%`)
    }
    if (stat.slowRatio !== null && stat.slowRatio > (opt.slowRatio ?? DEFAULTS.slowRatio)) {
      reasons.push(`${id}:慢样本率 ${(stat.slowRatio * 100).toFixed(1)}% > 阈值 ${((opt.slowRatio ?? DEFAULTS.slowRatio) * 100).toFixed(0)}%(≥${slowMs}ms)`)
    }
  }
  if (stat.indeterminate > 0) reasons.push(`(附)${id}:${stat.indeterminate} 次不可归因(DNS/TLS/连接超时/超上限)—— 只报数,不参与判红`)
  return { verdict: reasons.some((r) => !r.startsWith('(附)')) ? 'breach' : 'ok', reasons, numbers }
}

// ───────────────────────── 换流事件 oracle(纯函数) ─────────────────────────

/**
 * 一行是否命中换流签名。`marker` 可为**单串**(旧语义,自测夹具用)或**子串合取数组**
 * (生产形态:真日志的中文在落盘时已烂成乱码,只有 ASCII 骨架可靠 —— 见文件头编码教训)。
 * 一份实现,两处共用;不得在别处再抄一遍 includes 链。
 */
export function lineMatchesMarker(line, marker) {
  if (Array.isArray(marker)) return marker.length > 0 && marker.every((t) => line.includes(t))
  return line.includes(String(marker))
}

/** 行首 `[YYYY-MM-DD HH:MM:SS +00:00]` → epoch ms;形态不认识 ⇒ null(不猜时刻)。 */
function parseLineClock(l) {
  const m = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s*([+-]\d{2}:\d{2})?\]/.exec(l)
  if (!m) return null
  const at = Date.parse(`${m[1].replace(' ', 'T')}${m[2] || 'Z'}`)
  return Number.isFinite(at) ? at : null
}

/** 尾部文本 → 全部换流事件(按时刻升序)。「命中签名但时间戳不认识」单独计数,**不静默丢**。 */
export function findSwapEvents(tailText, marker) {
  const lines = String(tailText || '').replace(/\r/g, '').split('\n').filter(Boolean)
  const events = []
  let unparseable = 0
  for (const l of lines) {
    if (!lineMatchesMarker(l, marker)) continue
    const at = parseLineClock(l)
    if (at === null) {
      unparseable += 1
      continue
    }
    events.push({ at, line: l.trim().slice(0, 200) })
  }
  events.sort((a, b) => a.at - b.at)
  const reason = events.length
    ? 'ok'
    : unparseable
      ? `找到 ${unparseable} 行命中换流签名但行首时间戳形态不认识 ⇒ 不猜时刻(未判定)`
      : `日志尾部 ${lines.length} 行里没有命中换流签名的行`
  return { events, unparseable, reason, scannedLines: lines.length }
}

/** 最近一次换流事件(序列 A 的锚点)。多事件集由 findSwapEvents 一份实现投影而来。 */
export function findLatestSwapEvent(tailText, marker) {
  const { events, reason } = findSwapEvents(tailText, marker)
  const latest = events.length ? events[events.length - 1] : null
  return latest ? { at: latest.at, line: latest.line, reason: 'ok' } : { at: null, line: null, reason }
}

/**
 * 读文件**尾部**若干字节:部署环日志会涨到几十 MB,整读会把只读尺子变成磁盘压力。
 * 用 `readSync`(定位读)而不是 `readFileSync(fd,{buffer,length,position})` —— 后者在 Node 26
 * 上要求 buffer 至少与文件同样大,对 24MB 的日志**必抛 ERR_INVALID_ARG_VALUE**;
 * 而抛错若被吞掉,现象就是"尾部 0 行里没有换流事件"(把工具失效说成了事实)。
 * 因此这里把失败原因**原样带回**,由调用方写进"未判定"文案里。
 */
function readTail(file, maxBytes) {
  let fd = null
  try {
    const st = statSync(file)
    if (!st.isFile()) return { ok: false, reason: '不是普通文件' }
    const len = Math.min(st.size, maxBytes)
    const buf = Buffer.allocUnsafe(len)
    fd = openSync(file, 'r')
    const got = readSync(fd, buf, 0, len, st.size - len)
    let text = buf.subarray(0, got).toString('utf8')
    // 起点落在行中 ⇒ 首个"行"是半行,其时间戳恰是被裁掉的那一段。**不静默裁掉,登记为观察事实**:
    // 吞掉半行又不报名,就会把"读歪了"说成"读过了"。
    let droppedPartial = false
    if (st.size - len > 0 && text[0] !== '[') {
      const nl = text.indexOf('\n')
      if (nl >= 0) {
        text = text.slice(nl + 1)
        droppedPartial = true
      }
    }
    return { ok: true, text, bytes: got, droppedPartial }
  } catch (e) {
    return { ok: false, reason: (e && e.code ? `${e.code}: ` : '') + (e && e.message ? e.message.slice(0, 140) : String(e)) }
  } finally {
    if (fd !== null) {
      try {
        closeSync(fd)
      } catch {
        /* 已关 */
      }
    }
  }
}

/**
 * 事件 oracle:读日志尾部 + 收集全部换流事件。**读取失败与"没有事件"必须给出不同的话** ——
 * "尾部 0 行里没有换流"与"这个文件根本读不出来"是两件不同的事,混成一句就是
 * 把尺子失明汇报成世界平静(§12f 那条同型禁令)。
 */
export function readSwapEvent(file, marker, maxBytes = 512 * 1024) {
  const base = { events: [], at: null, line: null, unparseable: 0, droppedPartial: false, bytesRead: 0 }
  if (!existsSync(file)) return { ...base, reason: `部署环日志不存在:${file}(不是"没有换流",是问不到)` }
  const t = readTail(file, maxBytes)
  if (!t.ok) return { ...base, reason: `部署环日志读不出来:${t.reason} ⇒ 未判定(不得读成"没有换流事件")` }
  const r = findSwapEvents(t.text || '', marker)
  const latest = r.events.length ? r.events[r.events.length - 1] : null
  return {
    events: r.events,
    at: latest ? latest.at : null,
    line: latest ? latest.line : null,
    unparseable: r.unparseable,
    droppedPartial: t.droppedPartial === true,
    bytesRead: t.bytes,
    reason: r.reason,
  }
}

/**
 * **序列 B 的分离判据(票 G-301 的存在理由)**:把落在任一换流时刻 `[at-preMs, at+postMs]` 内的
 * 样本从常态集挪进"窗口段"—— 窗口段按序列 A 的"洞长"口径判,**不得混进 B 的常态比率**
 * (一条序列掩盖另一条 = 没做)。三态:
 *   · 事件时刻拿不到 ⇒ `splitApplied:false`,常态结论必须附注"窗口洞未剔除",分离本身记未判定;
 *   · 事件在位且确无样本落窗口 ⇒ 真 0(已判定),报告允许写"本次无窗口坏点";
 *   · 样本自身没有可用时刻 ⇒ **不猜归属**,保守留在常态集并计数报名。
 */
export function splitBySwapWindow(samples, events, opt = {}) {
  const preMs = opt.preMs ?? DEFAULTS.splitPreMs
  const postMs = opt.postMs ?? DEFAULTS.splitPostMs
  const ats = (events || []).map((e) => (typeof e === 'number' ? e : e && typeof e.at === 'number' ? e.at : NaN)).filter((x) => Number.isFinite(x))
  if (ats.length === 0) {
    return { steady: samples.slice(), inWindow: [], splitApplied: false, untimeable: 0, reason: '拿不到可归因的换流事件时刻 ⇒ 窗口坏点与常态坏点**无法分开计数**(不得读成"没有换流影响")' }
  }
  const steady = []
  const inWindow = []
  let untimeable = 0
  for (const s of samples) {
    const t = Date.parse(String(s.at || ''))
    if (!Number.isFinite(t)) {
      untimeable += 1
      steady.push(s)
      continue
    }
    if (ats.some((at) => t >= at - preMs && t <= at + postMs)) inWindow.push(s)
    else steady.push(s)
  }
  return { steady, inWindow, splitApplied: true, untimeable, eventCount: ats.length, reason: untimeable ? `${untimeable} 条样本无可用时刻 ⇒ 保守留在常态集(不猜归属)并如实报名` : 'ok' }
}

// ───────────────────────── 采样(真网络) ─────────────────────────

/**
 * 一次采样,并把**每一跳的时刻**记下来(2026-10-16 立)。
 *
 * 为什么不再用 `fetch` 一把梭:当天那封"公网慢 60%"的邮件量到的是**总耗时**,而总耗时分不清
 * "TLS 握手没完成(本机↔CF 链路在丢包,访客不走这条出口)"与"握手完成后响应慢(CF 边缘→隧道→
 * origin,访客同经此路)"—— 这两型的出路完全不同,混在一个身份里既产误报,又会在真隧道坏时被
 * 本机噪声淹没(同日实测:本机直连 v4 握手失败 36%、v6 18%,而经节点打同一 URL 20/20 全成、
 * 最慢 2641ms ⇒ 那封邮件实体是前者)。
 *
 * `stages` 全是相对毫秒、到不了那一步就留 null(不是 0):`dns`/`tcp`/`tls`/`head`/`body`。
 * 显式 `keepAlive:false` 的 agent:探测档故意每条都新建连接,不留挂起句柄(本文件末尾那条
 * "不能用 process.exit"的 Windows libuv 教训就是被 keep-alive 句柄绊的)。
 *
 * @returns {Promise<{status:number|null, ms:number, errorName?:string, errorCode?:string,
 *   aborted?:boolean, causeCode?:string, stages:object, stageReached:string, bytes?:number}>}
 */
async function sampleOnce(url, ceilingMs) {
  const t0 = Date.now()
  const mark = { dns: null, tcp: null, tls: null, head: null, body: null }
  const stages = () => {
    const rel = (v) => (v === null ? null : v - t0)
    return { dns: rel(mark.dns), tcp: rel(mark.tcp), tls: rel(mark.tls), head: rel(mark.head), body: rel(mark.body) }
  }
  // 走到哪一跳:优先看真到过的最后一跳,而不是猜
  const reached = () => (mark.body !== null ? 'body' : mark.head !== null ? 'response' : mark.tls !== null ? 'tlsDone' : mark.tcp !== null ? 'tcp' : mark.dns !== null ? 'dns' : 'none')
  return await new Promise((resolvePromise) => {
    let settled = false
    const finish = (o) => {
      if (settled) return
      settled = true
      clearTimeout(watchdog)
      resolvePromise({ ...o, ms: Date.now() - t0, stages: stages(), stageReached: reached() })
    }
    let u
    try {
      u = new URL(url)
    } catch (e) {
      // 输入坏(不是网络坏):落 probeError 那一型,由 classifySample 归"我方"
      finish({ status: null, errorName: e && e.name, causeCode: String((e && e.message) || e).split(/\s+/).join(',').slice(0, 160) })
      return
    }
    const mod = u.protocol === 'https:' ? https : http
    const watchdog = setTimeout(() => {
      try {
        req.destroy(Object.assign(new Error('PROBE_CEILING'), { code: 'PROBE_CEILING' }))
      } catch {
        /* 已经结束了 */
      }
    }, ceilingMs)
    const req = mod.request(url, { method: 'GET', redirect: 'manual', agent: new mod.Agent({ keepAlive: false }), headers: { 'user-agent': 'ihui-check-public-path-probe/1.0' }, timeout: Math.min(ceilingMs, 10_000) }, (res) => {
      mark.head = Date.now()
      let bytes = 0
      res.on('data', (c) => {
        bytes += c.length
      })
      res.on('end', () => {
        mark.body = Date.now()
        finish({ status: res.statusCode, bytes })
      })
      res.on('error', (e) => finish({ status: res.statusCode ?? null, ...errShape(e) }))
      res.resume()
    })
    req.on('socket', (sock) => {
      if (sock.address() && sock.address().family) mark.tcp = Date.now()
      sock.on('lookup', () => {
        if (mark.dns === null) mark.dns = Date.now()
      })
      sock.on('connect', () => {
        if (mark.tcp === null) mark.tcp = Date.now()
      })
      sock.on('secureConnect', () => {
        if (mark.tls === null) mark.tls = Date.now()
      })
    })
    req.on('timeout', () => {
      req.destroy(Object.assign(new Error('PROBE_INACTIVITY'), { code: 'PROBE_INACTIVITY' }))
    })
    req.on('error', (e) => finish({ status: null, ...errShape(e) }))
    req.end()
  })
}

/** 把 error 归一成旧稿那三个候选串字段(归类判据读它们,不读堆栈)。 */
function errShape(e) {
  const cause = e && e.cause
  const toks = []
  for (const cand of [cause && cause.code, cause && cause.message, e && e.code, e && e.message, e && e.name]) {
    if (typeof cand === 'string' && cand) toks.push(...cand.split(/\s+/).filter(Boolean))
  }
  return {
    errorName: e && e.name,
    errorCode: e && e.code,
    aborted: e && (e.code === 'PROBE_CEILING' || e.name === 'AbortError' || /PROBE_CEILING/.test(String((e && e.message) || ''))) ? true : undefined,
    causeCode: toks.join(',').slice(0, 160),
  }
}

async function runSequence(id, plan, ledgerFile, opt) {
  const samples = []
  const push = async (url) => {
    const raw = await sampleOnce(url, opt.ceilingMs)
    const cls = classifySample(raw)
    const s = { seq: id, at: new Date().toISOString(), url, ...raw, ...cls }
    samples.push(s)
    if (ledgerFile) appendFileSync(ledgerFile, JSON.stringify({ kind: 'sample', ...s }) + '\n')
  }
  if (id === 'A') {
    if (!plan.eventAt) {
      return { samples, skipReason: plan.skipReason || '未拿到换流事件时刻 ⇒ 序列 A 未判定' }
    }
    const startAt = Date.now()
    const endAt = plan.eventAt + opt.windowMs
    if (startAt >= endAt) return { samples, skipReason: '事件窗口已过(检测时已超出 window-ms)⇒ 未判定,不得记 0' }
    while (Date.now() < endAt) {
      await push(opt.publicUrl)
      await push(opt.localUrl)
      if (Date.now() + opt.intervalMs > endAt) break
      await sleep(opt.intervalMs)
    }
    return { samples }
  }
  for (let i = 0; i < opt.samples; i += 1) {
    await push(opt.publicUrl)
    await push(opt.localUrl)
    if (i + 1 < opt.samples) await sleep(opt.intervalMs)
  }
  return { samples }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// ───────────────────────── 取证文件(复用 run-evidence 那一份判据) ─────────────────────────

export function writeLedgerTrailer(ledgerFile, obj) {
  if (!ledgerFile) return
  appendFileSync(ledgerFile, JSON.stringify({ kind: 'summary', ...obj }) + '\n')
}

export function sealLedger(ledgerFile, rc) {
  if (!ledgerFile) return
  appendFileSync(ledgerFile, `${RC_MARK}${rc}\n`)
}

/** 读一份取证:先问"跑完没有"(run-evidence 那把尺子),再按序列解析样本行;摘要行回传给 report 档做同样的分离。 */
export function readLedger(file) {
  let text = ''
  try {
    text = readFileSync(file, 'utf8')
  } catch (e) {
    return { completion: { kind: 'missing', reason: `取证文件读不到:${(e && e.message) || e}` }, bySeq: { A: [], B: [] }, summary: null, exit: 3 }
  }
  const completion = judgeEvidence(text)
  const bySeq = { A: [], B: [] }
  let summary = null
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('{')) continue
    try {
      const o = JSON.parse(line)
      if (o.kind === 'sample' && (o.seq === 'A' || o.seq === 'B')) bySeq[o.seq].push(o)
      else if (o.kind === 'summary') summary = o
    } catch {
      /* 半行 JSON:正是"被截断"的形态,由 completion 那一层判,这里不重复报 */
    }
  }
  return { completion, bySeq, summary, exit: exitCodeForVerdict(completion) }
}

// ───────────────────────── 构造面自检 ─────────────────────────

function selfTest() {
  const cases = []
  const ok = (n, c) => cases.push([n, !!c])
  const S = (over) => ({ bucket: 'ok', unavailable: false, ms: 100, at: '2026-09-28T00:00:00.000Z', ...over })
  // 归类:三类"对端可归因"、三类"不可归因"、一类"我方坏了"
  ok('C1 拒连 ⇒ 对端可归因(换流那一型)', classifySample({ ms: 3, causeCode: 'ECONNREFUSED' }).unavailable === true)
  ok('C2 502 ⇒ 对端可归因', classifySample({ status: 502, ms: 40 }).unavailable === true)
  ok('C3 4xx **不**算对端不可用(语义常是路由/鉴权)', classifySample({ status: 404, ms: 40 }).unavailable === false)
  ok('C4 DNS ⇒ indeterminate 且不判对端坏', (() => {
    const r = classifySample({ ms: 5, causeCode: 'ENOTFOUND' })
    return r.unavailable === false && r.indeterminate === true
  })())
  ok('C5 超上限被中止 ⇒ indeterminate(只证明"比上限慢")', classifySample({ ms: 15001, causeCode: 'ABORT_ERR' }).indeterminate === true)
  ok('C6 无法归类的异常 ⇒ probeSideBroken(我方失明,不是目标坏)', classifySample({ ms: 1, causeCode: 'ERR_INTERNAL_WEIRD' }).probeSideBroken === true)
  ok('C7 既无状态码也无错误形态 ⇒ 探测本身没跑到', classifySample({ ms: 1 }).bucket === 'probeError')
  // 统计与最长连续
  const t0 = Date.parse('2026-09-28T00:00:00.000Z')
  const mk = (i, unavailable, ms) => S({ unavailable, ms, at: new Date(t0 + i * 1000).toISOString(), bucket: unavailable ? 'connRefused' : 'ok' })
  // 连续不可用:第 1/2 条(相隔 1s,第 2 条自身耗时 9s)⇒ 跨度 = 1s(起点差)+ 9s(末条自身)
  const seq = [mk(0, false, 20), mk(1, true, 9000), mk(2, true, 9000), mk(3, false, 30), mk(4, false, 20)]
  const st = summarizeSequence(seq, { slowMs: 8000 })
  ok('T1 失败数/慢数分别计(同一条可以既失败又慢,不重复扣)', st.unavailable === 2 && st.slow === 2)
  ok('T2 最长连续不可用按墙钟跨度算(首条起点 → 末条起点+其耗时)= 1s+9s', st.longestRunMs === 1000 + 9000)
  ok('T2b 阳性对照:末条自身耗时不得被丢掉(否则 10s 的洞会被读成 1s)', st.longestRunMs > 1000 && st.runs.length === 1)
  ok('T3 零样本 ⇒ n=0 且比率是 null(不是 0)', (() => {
    const z = summarizeSequence([])
    return z.n === 0 && z.failRatio === null && z.slowRatio === null && z.maxMs === 0
  })())
  // 判定三态
  ok('J1 B 序列慢样本率越界 ⇒ breach 且点名比率', (() => {
    const j = judgeSequence('B', summarizeSequence(seq, { slowMs: 8000 }), { slowMs: 8000 })
    return j.verdict === 'breach' && /慢样本率/.test(j.reasons.join(' '))
  })())
  ok('J2 成对反向对照:全部 200 且快 ⇒ ok(不误伤健康链路)', (() => {
    const good = [S({ at: new Date(t0).toISOString(), ms: 12, status: 200 }), S({ at: new Date(t0 + 1000).toISOString(), ms: 9, status: 200 })]
    const j = judgeSequence('B', summarizeSequence(good))
    return j.verdict === 'ok' && j.reasons.length === 0
  })())
  ok('J3 零样本 ⇒ unjudged(不得出"0 次失败"的结论)', judgeSequence('B', summarizeSequence([])).verdict === 'unjudged')
  ok('J4 本地异常占比高 ⇒ unjudged 而不是 breach(把失明读成健康或读成都坏,两者都错)', (() => {
    const broken = [S({ bucket: 'probeError', probeSideBroken: true }), S({ bucket: 'probeError', probeSideBroken: true }), S({})]
    return judgeSequence('B', summarizeSequence(broken)).verdict === 'unjudged'
  })())
  ok('J5 A 序列按"最长连续不可用"判,不看失败率(一次换流只会有少数几条)', (() => {
    const j = judgeSequence('A/公网', { n: 4, unavailable: 2, slow: 0, maxMs: 900, longestRunMs: 9000, failRatio: 0.5, slowRatio: 0, indeterminate: 0, probeSideBroken: 0 }, { rule: 'outage', outageMs: 5000 })
    return j.verdict === 'breach' && /最长连续不可用/.test(j.reasons.join(' '))
  })())
  ok('J6 成对:A 的 900ms 洞 ⇒ 不越界(阈值 5s)', (() => {
    const j = judgeSequence('A/公网', { n: 4, unavailable: 1, slow: 0, maxMs: 900, longestRunMs: 900, failRatio: 0.25, slowRatio: 0, indeterminate: 0, probeSideBroken: 0 }, { rule: 'outage', outageMs: 5000 })
    return j.verdict === 'ok'
  })())
  ok('J7 两条序列/两个目标永不互相顶结论:A 全绿而 B/公网 越界时,结论里必须仍有 B 的红', (() => {
    const a = judgeSequence('A/公网', summarizeSequence([S({ ms: 30 })]), { rule: 'outage' })
    const b = judgeSequence('B/公网', summarizeSequence(seq, { slowMs: 8000 }), { rule: 'ratio', slowMs: 8000 })
    return a.verdict === 'ok' && b.verdict === 'breach'
  })())
  ok('J8 同一条规则换目标不串味:B/本地 全绿不得被 B/公网 的红顶掉(控制组的意义)', (() => {
    const pub = judgeSequence('B/公网', summarizeSequence(seq, { slowMs: 8000 }), { rule: 'ratio', slowMs: 8000 })
    const loc = judgeSequence('B/本地', summarizeSequence([S({ ms: 9, status: 200 }), S({ ms: 11, status: 200 })]), { rule: 'ratio', slowMs: 8000 })
    return pub.verdict === 'breach' && loc.verdict === 'ok'
  })())
  ok('J9 "这条判据不能恒 0"(判据三·构造面):一条全拒连的序列必须 breach,而等形的全 200 序列必须 ok —— 同一把尺子两向各喂一次,只喂一色不算证明', (() => {
    const mk2 = (i, bad) => ({ at: new Date(t0 + i * 1000).toISOString(), ms: bad ? 2 : 25, status: bad ? null : 200, causeCode: bad ? 'ECONNREFUSED' : undefined, ...classifySample(bad ? { ms: 2, causeCode: 'ECONNREFUSED' } : { status: 200, ms: 25 }) })
    const bad = judgeSequence('B/对照死靶', summarizeSequence(Array.from({ length: 6 }, (_, i) => mk2(i, true))), { rule: 'ratio' })
    const good = judgeSequence('B/对照活靶', summarizeSequence(Array.from({ length: 6 }, (_, i) => mk2(i, false))), { rule: 'ratio' })
    return bad.verdict === 'breach' && good.verdict === 'ok' && summarizeSequence(Array.from({ length: 6 }, (_, i) => mk2(i, true))).unavailable === 6
  })())
  // 换流事件 oracle。注意夹具保留中文原文(它演示"标记是 ASCII 合取、不靠中文"),但 marker 一律传 DEFAULTS.swapMarker。
  ok('E1 行首 ISO 时刻被取出(ASCII 合取签名)', (() => {
    const r = findLatestSwapEvent('[2026-09-27 15:00:00 +00:00] [deploy] [15:00:00 +00:00] 交换 staging → 线上(.next),重启 web\n[2026-09-27 15:01:00 +00:00] [deploy] 无关行', DEFAULTS.swapMarker)
    return Number.isFinite(r.at) && r.reason === 'ok'
  })())
  ok('E1b 合取是"与"不是"或":只含 staging 不含 (.next)/web 的行不得成事件(60 条真噪声行的形状)', findLatestSwapEvent('[2026-09-27 15:00:00 +00:00] OK next build -> .next-staging', DEFAULTS.swapMarker).at === null)
  ok('E2 无事件 ⇒ 未判定并给出可诊断原因(不是 0)', findLatestSwapEvent('nothing here', DEFAULTS.swapMarker).at === null)
  ok('E3 命中签名但时间戳不认识 ⇒ 判未判定,不猜时刻', findLatestSwapEvent('昨天 staging → 线上(.next),重启 web 了', DEFAULTS.swapMarker).reason.includes('不认识'))
  ok('E4 取**最后**一条(旧事件不得顶掉新事件)', (() => {
    const r = findLatestSwapEvent('[2026-09-27 10:00:00 +00:00] staging (.next) web\n[2026-09-27 18:00:00 +00:00] staging (.next) web', DEFAULTS.swapMarker)
    return r.at === Date.parse('2026-09-27T18:00:00Z')
  })())
  ok('E4b 单串 marker 向后兼容仍工作(自测夹具与第三方调用不因此断)', findLatestSwapEvent('[2026-09-27 10:00:00 +00:00] 交换 staging 完成', '交换 staging').at !== null)
  ok('E5 "文件不存在"与"读不出来"与"没有事件"三种话必须不同(把失明说成平静是本仓最高频失效型)', (() => {
    const a = readSwapEvent(resolve(ROOT, '.ihui-agent/tmp/probers/nope-does-not-exist.log'), DEFAULTS.swapMarker)
    const b = readSwapEvent(resolve(ROOT, '.ihui-agent/tmp/probers'), DEFAULTS.swapMarker)
    return /不存在/.test(a.reason) && !/读不出来/.test(a.reason) && /读不出来/.test(b.reason)
  })())
  ok('E6 阳性对照(真部署环日志,只读):日志在位时**必须真问出至少一个换流时刻**。' + '旧稿在这一格恒"未判定"而账面全绿 —— 中文标记对 GBK 乱码永不命中,该断言当时并不存在', (() => {
    if (!existsSync(DEFAULTS.deployLog)) {
      console.log('  ℹ️ E6 跳过:本机没有部署环日志(非部署机)—— 这是"未判定"不是"通过"')
      return true
    }
    const r = readSwapEvent(DEFAULTS.deployLog, DEFAULTS.swapMarker)
    return r.events.length > 0 && Number.isFinite(r.at)
  })())
  // 序列 B 的窗口分离(票面测试②的判据面)
  ok('K1 事件拿不到 ⇒ splitApplied:false,全部样本留常态,理由点名"无法分开计数"(不假装分过)', (() => {
    const s = [S({ at: '2026-09-28T00:00:00.000Z' }), S({ at: '2026-09-28T00:00:01.000Z' })]
    const r = splitBySwapWindow(s, [])
    return r.splitApplied === false && r.steady.length === 2 && r.inWindow.length === 0 && /无法分开计数/.test(r.reason)
  })())
  ok('K2 落在换流时刻前后的坏点归 A:窗口内样本必须离开 steady(票面测试②)', (() => {
    const evAt = Date.parse('2026-09-28T00:01:00.000Z')
    const mkAt = (off) => S({ at: new Date(evAt + off).toISOString(), unavailable: true, bucket: 'connRefused' })
    const s = [mkAt(-30_000), mkAt(-10_000), mkAt(0), mkAt(30_000), mkAt(90_000)]
    const r = splitBySwapWindow(s, [{ at: evAt }], { preMs: 20_000, postMs: 60_000 })
    return r.splitApplied === true && r.inWindow.length === 3 && r.steady.length === 2
  })())
  ok('K3 真 0:事件在位而样本全在窗口外 ⇒ inWindow=0 且 splitApplied=true(这才允许写"本次无窗口坏点")', (() => {
    const evAt = Date.parse('2026-09-28T00:00:00.000Z')
    const r = splitBySwapWindow([S({ at: new Date(evAt + 300_000).toISOString() })], [{ at: evAt }])
    return r.splitApplied === true && r.inWindow.length === 0 && r.steady.length === 1
  })())
  ok('K4 样本无可用时刻 ⇒ 不猜归属:留 steady 并计数 untimeable', (() => {
    const r = splitBySwapWindow([S({ at: 'garbage' })], [{ at: Date.parse('2026-09-28T00:00:00.000Z') }])
    return r.steady.length === 1 && r.untimeable === 1
  })())
  // ── 归因到"哪一跳"(2026-10-16 立:当天那封"公网慢 60%"的邮件答不出是哪一段坏了)
  ok('C8 TCP 连接阶段超时 ⇒ 具名落 connStall(stall 面、不可归因),**不**得记成"尺子自己失明"', (() => {
    const r = classifySample({ ms: 10735, errorName: 'TypeError', causeCode: 'UND_ERR_CONNECT_TIMEOUT,Connect,Timeout,Error,(attempted,addresses:,2606:4700:3033::ac43:a3c3:443)' })
    return r.bucket === 'connStall' && r.stage === 'stall' && r.indeterminate === true && r.probeSideBroken !== true && r.unavailable === false
  })())
  ok('C9 反向:拒连仍是"对端可归因"(拆归因不许把对端坏洗成出口坏)', (() => {
    const r = classifySample({ ms: 3, causeCode: 'ECONNREFUSED' })
    return r.stage === 'conn' && r.unavailable === true
  })())
  ok('S1 慢样本按跳分账且总额不丢:slow = http 慢 + stall 慢 + conn 慢', (() => {
    const mix = [S({ status: 200, ms: 100 }), S({ status: 200, ms: 9000 }), S({ bucket: 'connStall', stage: 'stall', indeterminate: true, ms: 10735, status: null }), S({ bucket: 'connRefused', stage: 'conn', unavailable: true, ms: 9000, status: null }), S({ bucket: 'probeError', stage: 'stall', probeSideBroken: true, ms: 1, status: null })]
    const m = summarizeSequence(mix, { slowMs: 8000 })
    return m.n === 5 && m.slow === 3 && m.httpSlow === 1 && m.stallSlow === 1 && m.httpN === 2 && m.connN === 1 && m.stallN === 2 && m.buckets.connStall === 1
  })())
  ok('S2 旧取证行没有 stage ⇒ 从 status/bucket 派生;一条 200 响应绝不能被读成"没走到对端"', (() => {
    const legacy = [S({ status: 200, ms: 9000 }), S({ bucket: 'connStall', ms: 10735, status: null })]
    const l = summarizeSequence(legacy, { slowMs: 8000 })
    return l.httpN === 1 && l.stallN === 1 && l.httpSlow === 1 && l.stallSlow === 1
  })())
  // 定位:同一份公网读数,结论必须**随对照组与握手分界翻** —— 这就是"定位真读了输入"的变异取证
  const staged = (over) => S({ stageReached: 'body', stages: { dns: 2, tcp: 260, tls: 520, head: 700, body: over.ms }, ...over })
  const pubBad = summarizeSequence(Array.from({ length: 10 }, (_, i) => staged({ status: 200, ms: i < 6 ? 9000 : 500, at: new Date(t0 + i * 1000).toISOString() })), { slowMs: 8000 })
  const localFast = summarizeSequence(Array.from({ length: 10 }, (_, i) => staged({ status: 200, ms: 20, at: new Date(t0 + i * 1000).toISOString() })), { slowMs: 8000 })
  const localSlow = summarizeSequence(Array.from({ length: 10 }, (_, i) => staged({ status: 200, ms: 9000, at: new Date(t0 + i * 1000).toISOString() })), { slowMs: 8000 })
  // 全停在握手中(TCP 通、TLS 没完成)—— 2026-10-16 那封邮件的真身
  const pubHandshake = summarizeSequence(Array.from({ length: 10 }, (_, i) => S({ bucket: 'tlsStall', stage: 'stall', stageReached: 'tcp', stages: { dns: 2, tcp: 310, tls: null, head: null, body: null }, indeterminate: true, preTls: true, unavailable: false, status: null, ms: 10_700, at: new Date(t0 + i * 1000).toISOString() })), { slowMs: 8000 })
  ok('L1 公网越阈 + 对照同轮健康 ⇒ 定位入口段(洞在 CF 边缘/隧道/上行,不是 web)', (() => {
    const g = classifyPublicLeg(pubBad, localFast)
    return g.leg === 'entry' && g.tag === '入口段' && /最慢仅 20ms/.test(g.note)
  })())
  ok('L2 变异对照:公网读数一字不改,换成对照也慢 ⇒ 必须翻成服务段', (() => {
    const g = classifyPublicLeg(pubBad, localSlow)
    return g.leg === 'service' && g.tag === '服务段'
  })())
  ok('L3 对照组没采到样本 ⇒ undetermined 且不给段名(不得冒认"入口段没问题")', (() => {
    const g = classifyPublicLeg(pubBad, summarizeSequence([]))
    return g.leg === 'undetermined' && g.tag === null && /不得冒认/.test(g.note)
  })())
  ok('L4 公网自己没样本 ⇒ undetermined(不是"公网健康")', classifyPublicLeg(null, localFast).leg === 'undetermined' && classifyPublicLeg(summarizeSequence([]), localFast).leg === 'undetermined')
  ok('L5 公网未越阈 ⇒ clear 且不给段名(段名只用于真有坏点时,否则身份里凭空多一档)', (() => {
    const g = classifyPublicLeg(localFast, localFast)
    return g.leg === 'clear' && g.tag === null
  })())
  // ── 握手分界(2026-10-16 补:今天那封"公网慢 60%"的实体是本机出口 TLS 丢包,与访客无关)
  ok('L6 对照组健康 + 坏点全停在握手中 ⇒ 本机出口段(不得据此查隧道/web)', (() => {
    const g = classifyPublicLeg(pubHandshake, localFast)
    return g.leg === 'egress' && g.tag === '本机出口段' && /不经本机出口/.test(g.note) && /10\/10/.test(g.note)
  })())
  ok('L7 变异对照:公网越阈的构成从"停在握手中"改成"握手完成后才慢",段名必须翻成入口段', (() => {
    const a = classifyPublicLeg(pubHandshake, localFast).tag
    const b = classifyPublicLeg(pubBad, localFast).tag
    return a === '本机出口段' && b === '入口段' && a !== b
  })())
  ok('L8 没有分阶段读数 ⇒ unlocated 且不给段名(不得冒认某一段)', (() => {
    const legacy = summarizeSequence(Array.from({ length: 10 }, (_, i) => S({ status: 200, ms: i < 6 ? 9000 : 500, at: new Date(t0 + i * 1000).toISOString() })), { slowMs: 8000 })
    const g = classifyPublicLeg(legacy, localFast)
    return g.leg === 'unlocated' && g.tag === null && /分阶段读数不全/.test(g.note) && legacy.stageEvidence === false && legacy.stageSamples === 0
  })())
  ok('L9 分界计数:停在握手中 / 握手后没等到完整响应 / 握手完成数,三者互斥且可相加核对', (() => {
    const mixed = summarizeSequence([
      S({ bucket: 'tlsStall', stage: 'stall', stageReached: 'tcp', stages: { dns: 2, tcp: 300, tls: null, head: null, body: null }, preTls: true, indeterminate: true, unavailable: false, status: null, ms: 9000, at: new Date(t0).toISOString() }),
      S({ bucket: 'overCeiling', stage: 'stall', stageReached: 'tlsDone', stages: { dns: 2, tcp: 280, tls: 520, head: null, body: null }, indeterminate: true, unavailable: false, status: null, ms: 15001, at: new Date(t0 + 1000).toISOString() }),
      S({ stageReached: 'body', stages: { dns: 2, tcp: 270, tls: 500, head: 9200, body: 9300 }, status: 200, ms: 9300, at: new Date(t0 + 2000).toISOString() }),
    ], { slowMs: 8000 })
    return mixed.n === 3 && mixed.tlsDoneN === 2 && mixed.preTlsStall === 1 && mixed.postTlsStall === 1 && mixed.stageEvidence === true && mixed.httpSlow === 1 && mixed.stallSlow === 2
  })())
  ok('L10 归类以"走到哪一跳"优先于错误文案:TCP 通而握手没完成 ⇒ tlsStall(不可归因,不是对端坏,不是尺子坏)', (() => {
    const r = classifySample({ status: null, ms: 10700, errorName: 'Error', errorCode: 'PROBE_INACTIVITY', causeCode: 'PROBE_INACTIVITY,Socket', stageReached: 'tcp', stages: { dns: 2, tcp: 300, tls: null, head: null, body: null } })
    return r.bucket === 'tlsStall' && r.stage === 'stall' && r.preTls === true && r.indeterminate === true && r.unavailable === false && r.probeSideBroken !== true
  })())
  ok('L11 反向:拒连即使在"没走到任何一跳"时也必须仍算对端可归因(分界不许洗白对端坏)', (() => {
    const r = classifySample({ status: null, ms: 3, errorCode: 'ECONNREFUSED', causeCode: 'ECONNREFUSED,connect,127.0.0.1:47801', stageReached: 'none', stages: { dns: null, tcp: null, tls: null, head: null, body: null } })
    return r.bucket === 'connRefused' && r.stage === 'conn' && r.unavailable === true
  })())
  // 取证三态:复用 run-evidence 的判据,不另立标记语法
  ok('V1 有 RC 行 ⇒ complete(跑完)', judgeEvidence('{}\n{}\n' + RC_MARK + '0\n').kind === 'complete')
  ok('V2 没跑完 ⇒ truncated ⇒ exit 3(INCOMPLETE ≠ 通过 ≠ 失败)', (() => {
    const v = judgeEvidence('{"kind":"sample","seq":"B"}\n半截')
    return v.kind === 'truncated' && exitCodeForVerdict(v) === 3
  })())
  ok('V3 KILLED 标记与 truncated 各有各的文案(不得混成一句)', judgeEvidence(`${KILLED_MARK}: SIGTERM\n`).kind === 'killed')
  ok('V4 反假绿:一份"0 次失败"的取证若没跑完,结论必须无效', (() => {
    const f = resolve(ROOT, '.ihui-agent/tmp/probers/selftest-truncated.jsonl')
    mkdirSync(dirname(f), { recursive: true })
    writeFileSync(f, '{"kind":"summary","unavailable":0}\n', 'utf8')
    const r = readLedger(f)
    rmSync(f, { force: true })
    return r.completion.kind === 'truncated' && r.exit === 3
  })())
  let pass = 0
  for (const [n, p] of cases) {
    console.log(`${p ? '  ✅' : '  ❌'} ${n}`)
    if (p) pass += 1
  }
  console.log(`check-public-path-probe --self-test:${pass}/${cases.length} 通过`)
  return pass === cases.length ? 0 : 1
}

// ───────────────────────── main ─────────────────────────

function pickOpt(argv, k, d) {
  const eq = argv.find((a) => a.startsWith(`--${k}=`))
  if (eq) return eq.slice(k.length + 3)
  const i = argv.indexOf(`--${k}`)
  if (i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) return argv[i + 1]
  return d
}

async function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  const reportIdx = argv.indexOf('--report')
  if (reportIdx >= 0) {
    const f = argv[reportIdx + 1]
    if (!f) {
      console.log('用法错:--report 需要一个取证文件路径')
      return 2
    }
    const r = readLedger(f)
    console.log(`取证:${f}`)
    console.log(`  跑完没有:${r.completion.kind} —— ${r.completion.reason}`)
    if (r.completion.kind !== 'complete') {
      console.log('  ⇒ 本轮结论**无效**(INCOMPLETE):既不是"没问题"也不是"有问题",请重跑取证。')
      return 3
    }
    // 回读用**同一把分离判据**:换流事件集取自摘要行(取证当时量到的那份),不重新问日志 ——
    // 重问会拿"此刻的事件集"去审"当时的样本",两把尺子跨时刻对不上(本仓"同面同轮"同型禁令)。
    const swapEvents = (r.summary && Array.isArray(r.summary.swapEvents) ? r.summary.swapEvents : []).filter((x) => Number.isFinite(x))
    for (const id of ['A', 'B']) {
      const byUrl = new Map()
      for (const s of r.bySeq[id]) byUrl.set(s.url || '(无 url)', (byUrl.get(s.url || '(无 url)') || []).concat([s]))
      const bstats = new Map()
      for (const [u, ss] of byUrl) {
        const sp = splitBySwapWindow(ss, swapEvents, { preMs: DEFAULTS.splitPreMs, postMs: DEFAULTS.splitPostMs })
        bstats.set(u, { split: sp, stat: summarizeSequence(sp.steady, { slowMs: DEFAULTS.slowMs }) })
      }
      // 对照 URL 从取证摘要行取(取证当时那一份)。拿不到 ⇒ 不定位 —— 拿"两个 url 里随便挑一个
      // 当公网"去猜,猜反了就把服务段的锅甩给入口段(反之亦然)。
      const sumOpt = (r.summary && r.summary.opt) || {}
      const pubUrl = typeof sumOpt.publicUrl === 'string' ? sumOpt.publicUrl : null
      const localUrl = typeof sumOpt.localUrl === 'string' ? sumOpt.localUrl : null
      for (const [url, samples] of byUrl) {
        if (id === 'A') {
          const stat = summarizeSequence(samples, { slowMs: DEFAULTS.slowMs })
          const j = judgeSequence(`A/${url}`, stat, { rule: 'outage', slowMs: DEFAULTS.slowMs })
          console.log(`  A/${url}:${j.numbers}`)
          console.log(`    ⇒ ${j.verdict}${j.reasons.length ? ' | ' + j.reasons.join(' | ') : ''}`)
          continue
        }
        const { split, stat } = bstats.get(url)
        const leg = url === pubUrl ? classifyPublicLeg(stat, localUrl && bstats.get(localUrl) ? bstats.get(localUrl).stat : null, { slowMs: DEFAULTS.slowMs }) : null
        const tagKey = `B/${url}·常态${leg && leg.tag ? `·${leg.tag}` : ''}`
        const j = judgeSequence(tagKey, stat, { rule: 'ratio', slowMs: DEFAULTS.slowMs })
        if (!split.splitApplied) j.reasons.push(`(附)换流窗口未剔除(${split.reason})—— 常态比率可能含换流洞`)
        if (leg) j.reasons.push(`[定位]${leg.note}`)
        else if (pubUrl && localUrl && url !== localUrl) j.reasons.push('(附)本目标既非取证里的公网目标也非对照目标 ⇒ 未定位')
        console.log(`  ${tagKey}:${j.numbers}`)
        console.log(`    ⇒ ${j.verdict}${j.reasons.length ? ' | ' + j.reasons.join(' | ') : ''}`)
        if (split.inWindow.length > 0) {
          const w = summarizeSequence(split.inWindow, { slowMs: DEFAULTS.slowMs })
          const wj = judgeSequence(`B/${url}·窗口段`, w, { rule: 'outage', slowMs: DEFAULTS.slowMs })
          console.log(`  B/${url}·窗口段(归 A 语义,不计常态):${wj.numbers}`)
          console.log(`    ⇒ ${wj.verdict}${wj.reasons.length ? ' | ' + wj.reasons.join(' | ') : ''}`)
        } else {
          console.log(`  B/${url}·窗口段:${split.splitApplied ? '窗口内样本 0(已判定的真 0)' : `未判定 —— ${split.reason}`}`)
        }
      }
      if (byUrl.size === 0) console.log(`  ${id}:取证里没有该序列的样本行 ⇒ 未判定(不得读成 0)`)
    }
    if (r.summary && r.summary.control) {
      const c = r.summary.control
      console.log(`  阳性对照(取证当时):${c.url} ⇒ ${c.bucket} ${c.ms}ms —— ${c.hit ? '命中(尺子有牙)' : '**未命中(尺子失明,该轮结论无效)**'}`)
    } else {
      console.log('  阳性对照:取证里没有对照记录 ⇒ 该轮"抓到过坏"**未被证明**,不得当合格证')
    }
    return r.exit === 0 ? 0 : r.exit === 3 ? 3 : 1
  }
  const json = argv.includes('--json')
  const burst = argv.includes('--burst')
  const snapshot = argv.includes('--snapshot') || !(burst || argv.includes('--report'))
  const sequence = String(pickOpt(argv, 'sequence', 'both')).toUpperCase()
  if (!['A', 'B', 'BOTH'].includes(sequence)) {
    console.log(`用法错:--sequence 只认 A / B / both,收到 ${JSON.stringify(sequence)}`)
    return 2
  }
  const opt = {
    publicUrl: pickOpt(argv, 'url-public', DEFAULTS.publicUrl),
    localUrl: pickOpt(argv, 'url-local', DEFAULTS.localUrl),
    controlUrl: pickOpt(argv, 'control-url', DEFAULTS.controlUrl),
    // 阳性对照**默认开**;关掉它 = 主动放弃"尺子有牙"的证明,所以关掉时报告必须大声报名。
    positiveControl: !argv.includes('--no-positive-control'),
    // --snapshot(含裸跑,两档同义)是"一次采样巡检"档:比长跑档轻,取证封缄+读回闭环都在这一档做。
    samples: Math.max(1, Number(pickOpt(argv, 'samples', burst ? 10 : snapshot ? 12 : DEFAULTS.samples)) || DEFAULTS.samples),
    intervalMs: Math.max(50, Number(pickOpt(argv, 'interval-ms', DEFAULTS.intervalMs)) || 0),
    ceilingMs: Math.max(500, Number(pickOpt(argv, 'ceiling-ms', DEFAULTS.ceilingMs)) || 0),
    slowMs: Math.max(1, Number(pickOpt(argv, 'slow-ms', DEFAULTS.slowMs)) || 0),
    windowMs: Math.max(1000, Number(pickOpt(argv, 'window-ms', DEFAULTS.windowMs)) || 0),
    recencyMs: Math.max(0, Number(pickOpt(argv, 'recency-ms', DEFAULTS.recencyMs)) || 0),
    splitPreMs: Math.max(0, Number(pickOpt(argv, 'split-pre-ms', DEFAULTS.splitPreMs)) || 0),
    splitPostMs: Math.max(0, Number(pickOpt(argv, 'split-post-ms', DEFAULTS.splitPostMs)) || 0),
    waitMs: Math.max(0, Number(pickOpt(argv, 'wait-ms', 0)) || 0),
    failRatio: Number(pickOpt(argv, 'fail-ratio', DEFAULTS.failRatio)),
    slowRatio: Number(pickOpt(argv, 'slow-ratio', DEFAULTS.slowRatio)),
    outageMs: Number(pickOpt(argv, 'outage-ms', DEFAULTS.outageMs)),
    deployLog: pickOpt(argv, 'deploy-log', DEFAULTS.deployLog),
    // 取证默认开(票面判据一:"没跑到"必须可分辨,而 run-evidence 那把尺子判的是**文件**;
    // 不落盘的 stdout 没有"被截断"这个形态)。只准写项目内 .ihui-agent/tmp/(§15/§25),--no-ledger 关闭并大声报名。
    ledger: argv.includes('--no-ledger') ? '' : pickOpt(argv, 'ledger', burst ? resolve(ROOT, '.ihui-agent/tmp/probers/public-path-burst.jsonl') : resolve(ROOT, '.ihui-agent/tmp/probers/public-path-snapshot.jsonl')),
  }
  if (opt.publicUrl === opt.localUrl) {
    console.log('用法错:--url-public 与 --url-local 不得相同(那等于把两条独立测量压成一条)')
    return 2
  }
  if (opt.positiveControl && opt.controlUrl === opt.localUrl) {
    console.log('用法错:对照目标不得等于被测本地目标(拿活靶当死靶 = 阳性对照恒过)')
    return 2
  }
  if (opt.ledger) {
    mkdirSync(dirname(opt.ledger), { recursive: true })
    writeFileSync(opt.ledger, '', 'utf8') // 每次从零开始,不与上一轮样本混在同一份取证里
  }

  // 换流事件:序列 A 拿它当锚点,序列 B 拿它做**窗口分离**(票面判据)。两者都必须先问一次,
  // 问不到时 A 记"未判定"、B 记"分离未生效并在常态结论上附注" —— 都不得静默按"没有换流"处理。
  const wantA = sequence === 'A' || sequence === 'BOTH'
  const wantB = sequence === 'B' || sequence === 'BOTH'
  let ev = { events: [], at: null, line: null, reason: '本轮未读换流事件' }
  if (wantA || wantB) ev = readSwapEvent(opt.deployLog, DEFAULTS.swapMarker)
  let plan = { eventAt: null, skipReason: '本轮未跑序列 A(--sequence B)' }
  if (wantA) {
    // 等待语义:**没找到事件也要等**(只要调用方给了 --wait-ms)。
    // 旧写法只在"找到了一条但过旧"时才进入等待循环 ⇒ 日志尾部恰好没有换流行(读失败也是这一支)
    // 时,--wait-ms 形同虚设,现象是"设置了等待却立刻返回未判定"。
    if (opt.waitMs > 0) {
      const knownAt = ev.at || 0
      const until = Date.now() + opt.waitMs
      while ((!ev.at || ev.at <= knownAt) && Date.now() < until) {
        await sleep(2000)
        const again = readSwapEvent(opt.deployLog, DEFAULTS.swapMarker)
        if (again.at && again.at > knownAt) {
          ev = again
          break
        }
        if (again.events && again.events.length) ev = again // 没等到新事件也刷新事件集(供 B 的窗口分离用)
      }
      if (!ev.at || ev.at <= knownAt) ev = { ...ev, reason: `等待 ${Math.round(opt.waitMs / 1000)}s 内未出现新的换流事件(${ev.reason || '日志可读但没有该事件'})` }
    }
    plan = ev.at ? { eventAt: ev.at, line: ev.line } : { eventAt: null, skipReason: `序列 A:${ev.reason}` }
  }

  const lines = []
  const verdicts = []
  const out = {}
  if (wantA) out.A = await runSequence('A', plan, opt.ledger, opt)
  if (wantB) out.B = await runSequence('B', plan, opt.ledger, opt)
  // 每条序列各量两个目标:公网是被测对象,本地是**控制组**。
  // 没有控制组,"公网慢"就分不清是隧道/上游坏了还是整台机都没起来 —— 那正是本票要分的第二维。
  const emit = (key, url, j) => {
    verdicts.push({ key, ...j })
    lines.push(`${key}(${url}):${j.numbers}`)
    lines.push(`  ⇒ ${j.verdict === 'unjudged' ? '未判定' : j.verdict === 'breach' ? '越阈值' : '合规'}${j.reasons.length ? ' | ' + j.reasons.join(' | ') : ''}`)
  }
  const targets = [
    ['公网', opt.publicUrl],
    ['本地', opt.localUrl],
  ]
  const splitReport = {}
  if (wantA) {
    for (const [label, url] of targets) {
      const samples = out.A.samples.filter((s) => s.url === url)
      const stat = summarizeSequence(samples, { slowMs: opt.slowMs })
      const j =
        samples.length === 0 && out.A.skipReason
          ? { verdict: 'unjudged', reasons: [`A/${label}:${out.A.skipReason}`], numbers: `A/${label} 样本 0` }
          : judgeSequence(`A/${label}`, stat, { rule: 'outage', slowMs: opt.slowMs, outageMs: opt.outageMs })
      emit(`A/${label}`, url, j)
    }
  }
  if (wantB) {
    // 两趟:先把两个目标的样本各自统计完(**分离判据对两个目标都跑**,对照组也得剔窗口洞),
    // 再出结论 —— 因为"公网越阈是哪一段坏了"必须拿**同轮**对照组定位,一趟里公网先出结论时
    // 对照组还没算出来,只能瞎写(票 G-301 立"任一不得替另一条顶结论"的同一条纪律)。
    const bstat = {}
    for (const [label, url] of targets) {
      const all = out.B.samples.filter((s) => s.url === url)
      const split = splitBySwapWindow(all, ev.events, { preMs: opt.splitPreMs, postMs: opt.splitPostMs })
      splitReport[label] = { applied: split.splitApplied, steady: split.steady.length, inWindow: split.inWindow.length, untimeable: split.untimeable, reason: split.reason }
      bstat[label] = { split, stat: summarizeSequence(split.steady, { slowMs: opt.slowMs }), win: split.inWindow.length > 0 ? summarizeSequence(split.inWindow, { slowMs: opt.slowMs }) : null }
    }
    for (const [label, url] of targets) {
      const { split, stat, win } = bstat[label]
      // 只有公网侧才定位到"段";对照组自己不需要(它越阈的语义早就定为"本机服务没起",归服务自愈层)。
      const leg = label === '公网' ? classifyPublicLeg(stat, bstat['本地'] ? bstat['本地'].stat : null, { slowMs: opt.slowMs, slowRatio: opt.slowRatio, failRatio: opt.failRatio }) : null
      const key = `B/${label}·常态${leg && leg.tag ? `·${leg.tag}` : ''}`
      const j = judgeSequence(key, stat, { rule: 'ratio', slowMs: opt.slowMs, failRatio: opt.failRatio, slowRatio: opt.slowRatio })
      if (!split.splitApplied) j.reasons = [...j.reasons, `(附)B/${label}:换流窗口**未剔除**(${split.reason})⇒ 若本轮发生过部署,常态比率含换流洞,不得据此给公网出"常态健康"合格证`]
      else if (split.untimeable > 0) j.reasons = [...j.reasons, `(附)B/${label}:${split.untimeable} 条样本无可用时刻,保守留在常态集(不猜归属)`]
      if (leg) j.reasons = [...j.reasons, `[定位]${leg.note}`]
      emit(key, url, { ...j, leg: leg ? leg.leg : null })
      if (win) {
        // 窗口段按序列 A 的"洞长"口径判:它是换流的既定代价,不是公网常态病 —— 混进比率就是两条互相掩盖。
        emit(`B/${label}·窗口段(归A语义)`, url, judgeSequence(`B/${label}·窗口段`, win, { rule: 'outage', slowMs: opt.slowMs, outageMs: opt.outageMs }))
      } else {
        lines.push(`B/${label}·窗口段:${split.splitApplied ? '窗口内样本 0(**已判定**的真 0,与常态比率互不顶账)' : `**未判定** —— ${split.reason}`}`)
      }
    }
  }
  // ── 阳性对照(判据三):这把尺子必须先证明"看得见一个已知必坏的目标",才有资格报"0 次异常"。
  let control
  if (opt.positiveControl) {
    const raw = await sampleOnce(opt.controlUrl, Math.min(opt.ceilingMs, 5000))
    const cls = classifySample(raw)
    control = { url: opt.controlUrl, hit: cls.unavailable === true, bucket: cls.bucket, ms: raw.ms }
    lines.push(`阳性对照(${opt.controlUrl}):${cls.bucket} ${raw.ms}ms ⇒ ${control.hit ? '判据有牙:必然失败点被算成"对端可归因失败",下面的 0 才是真 0' : '**未命中** ⇒ 尺子对已知必坏的目标失明,整轮降为未判定(不得出合格证)'}`)
  } else {
    lines.push('阳性对照:**本轮跳过**(--no-positive-control)⇒ "抓得到坏"未被证明,以上读数只可参考,不构成合格证。')
  }
  if (ev.droppedPartial) lines.push('(事件 oracle 附注:尾部定位读裁掉了开头一个残行 —— 半行不配被当成"没有事件"。已报名,不影响已解析事件的时刻。)')
  if (ev.unparseable) lines.push(`(事件 oracle 附注:${ev.unparseable} 行命中签名但时间戳不认识 ⇒ 未计入事件,不猜时刻。)`)

  const controlBlind = opt.positiveControl && control && !control.hit
  const anyBreach = verdicts.some((v) => v.verdict === 'breach')
  const allUnjudged = verdicts.length > 0 && verdicts.every((v) => v.verdict === 'unjudged')
  let rc = verdicts.length === 0 ? 3 : anyBreach ? 1 : allUnjudged ? 3 : 0
  if (controlBlind) rc = 3
  const results = {}
  for (const v of verdicts) results[v.key] = { verdict: v.verdict, reasons: v.reasons, numbers: v.numbers, ...(v.leg ? { leg: v.leg } : {}) }
  if (opt.ledger) {
    writeLedgerTrailer(opt.ledger, { at: new Date().toISOString(), rc, results, control, split: splitReport, swapEvents: (ev.events || []).map((e) => e.at).slice(-50), opt: { slowMs: opt.slowMs, ceilingMs: opt.ceilingMs, samples: opt.samples, publicUrl: opt.publicUrl, localUrl: opt.localUrl } })
    sealLedger(opt.ledger, rc)
    // 封缄后**读回自证**(run-evidence 那把尺子判文件):写进去的取证自己读不回 complete,
    // 本轮结论就是无凭据的 —— 探测被掐/磁盘写入失败都必须在这一格现形,而不是让 stdout 继续报平安。
    const rb = readLedger(opt.ledger)
    if (rb.completion.kind !== 'complete') {
      lines.push(`取证读回:${rb.completion.kind} —— ${rb.completion.reason} ⇒ 本轮结论**无效**,rc 强制 3(未判定)`)
      rc = 3
    }
  }
  if (json) {
    console.log(JSON.stringify({ rc, at: new Date().toISOString(), results, control, split: splitReport, swapEvents: (ev.events || []).map((e) => e.at).slice(-50), ledger: opt.ledger || null, positiveControlRan: opt.positiveControl }))
  } else {
    console.log(`目标:公网 ${opt.publicUrl} | 本地 ${opt.localUrl}(两条独立序列 × 两个目标;任一都不得替另一条顶结论)`)
    for (const l of lines) console.log(l)
    console.log(
      rc === 0
        ? '结论:已判定且未越阈值。**这不等于"有人在看"** —— 本门不在提交链,拿不到派发的场合请手动跑或按报告建议挂守护。'
        : rc === 1
          ? '结论:越阈值(纯告警语义;若接邮件派发,只准经 git-guardian 的 notifyGuardRed 出口,本门自身不发信)。'
          : '结论:未判定(INCOMPLETE)—— 既不是"通过"也不是"失败";先修探测条件(换流事件 oracle、网络出口、目标 URL、阳性对照)再读。',
    )
    if (opt.ledger) console.log(`取证:${opt.ledger}(读回:node scripts/check-public-path-probe.mjs --report ${opt.ledger})`)
  }
  return rc
}

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main(process.argv.slice(2))
    .then((c) => {
      // **刻意不用 process.exit(c)**:真机实测(2026-09-28)live 档 + stdout 重定向时,正确输出
      // 写完之后进程在 Windows libuv 清理 keep-alive 句柄的当口被 abrupt exit 打断,
      // `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING) src\win\async.c:94` → 退出码 127 ——
      // 读代码的人会把"127"当成目标坏了,而取证文件本身是完整且合规的。这正是判据一禁止的形态
      // (工具行为污染结论)。setExitCode + 让事件循环自然排空:undici 的 keep-alive 有几秒上限,
      // 对探测档可接受,换来确定正确的退出码。
      process.exitCode = c
    })
    .catch((e) => {
      console.error(`❌ 本门自身异常(结论无效,不得当成通过):${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exitCode = 2
    })
}

export const __test__ = {
  classifySample,
  sampleStage,
  summarizeSequence,
  classifyPublicLeg,
  longestUnavailableRun,
  judgeSequence,
  findLatestSwapEvent,
  findSwapEvents,
  lineMatchesMarker,
  readSwapEvent,
  splitBySwapWindow,
  readLedger,
  writeLedgerTrailer,
  sealLedger,
  DEFAULTS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
