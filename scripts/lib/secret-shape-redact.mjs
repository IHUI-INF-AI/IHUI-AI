// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 凭据形状脱敏的**唯一实现**(G-334,2026-09-28 立)。
 *
 * 为什么要有这个文件:同一套"命中凭据关键词就把值抹掉"的规则,曾同时住在
 * `scripts/check-credential-health.mjs`(拼到人邮件正文的一侧)与 `scripts/git-guardian.mjs`
 * (写守护日志与 UNDELIVERED 标记的一侧),两处 `SECRETISH_RE` 字面量与 `limit = 300` 逐字相同。
 * 两份实现必漂移是本仓记过最多次的失效型,而这一族的漂移表现是**安静**的:漂了的一侧只会让某些
 * 告警少打码或多打码,没有任何门会喊。
 *
 * 三档语义**刻意分开**,不得并成一档 —— 这个区分是用一次真实自伤换来的(见 PROJECT_PLAN
 * O86附⑦ 末格的收口注记):把"脱敏"与"截断"焊死在一个函数里,导致给告警正文接闸门时顺手把
 * 500 字的 CI 配额诊断砍成 300 字,等于拿泄露修复换一个不可处置的告警。
 *  - `redactSecretishLines` —— 逐行脱敏,**不截断**;给"必须留全诊断"的正文组装用。
 *  - `redactChildOutput` —— 上一条 + 长度上限;给子进程 stderr/stdout 用(崩溃时可能整倒 .env)。
 *  - `redactAlertDetail` —— 只抹"值形状"(键名=值 / 已知凭据前缀字面量),**不碰散文、不截断**;
 *    给已经过结构化组装的告警 detail 用。判"提到 token 这个词"和判"这里有一个 token 值"是两件事。
 */

/**
 * 子进程输出转诊断文本:逐行脱敏。契约脚本自身不打印密钥,但 node 崩溃时会把 require 到的
 * .env 片段、整条命令行甚至堆栈倒进 stderr —— 这些一律不落巡检输出(取向与 ihui-deploy.ps1 的
 * Protect-NotifyOutput 一致)。比 ps1 多走半步:命中行保留到第一个 `=`/`:` 前的**键名**,
 * 于是 "缺 RESEND_API_KEY" 这类诊断仍读得懂,而值永不落地;没有分隔符可切的行(堆栈里裸嵌的
 * token)整行打码 —— 宁可不给诊断,不给泄露面。
 */
const SECRETISH_RE = /(api[_-]?key|token|secret|passw|authorization|bearer)/i

export function redactSecretishLines(raw) {
  return String(raw ?? '')
    .split(/\r?\n/)
    .map((l) => {
      const line = l.trimEnd()
      if (!SECRETISH_RE.test(line)) return line
      const sep = /[=:]/.exec(line)
      return sep && sep.index < 40 ? `${line.slice(0, sep.index + 1)}***` : '[已脱敏]'
    })
    .filter((l) => l !== '')
    .join(' / ')
}

/**
 * 告警正文里的一条 detail:只抹"值形状"的东西,不把提到 token/key 的散文整行打码。
 * 刻意**不收** `[0-9a-f]{32,}` —— 40 位 git sha 与十六进制指纹同形,收了就会把
 * "线上构建 <sha> vs origin/main"这类部署停摆诊断抹掉,而那正是需要人来处置的一行。
 */
const ALERT_ASSIGN_RE =
  /((?:api[_-]?key|access[_-]?key|secret[_-]?key|token|secret|passw(?:or)?d|authorization|bearer)\s*[=:]\s*["']?)([^\s,;)"']+)/gi
const ALERT_LITERAL_RE =
  /\b(gh[pousr]_[A-Za-z0-9]{8,}|xox[baprs]-[A-Za-z0-9-]{6,}|AKIA[A-Z0-9]{8,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}\.)\b/g

export function redactAlertDetail(detail) {
  const s = String(detail ?? '')
  // 先 assignment 再 literal:assignment 已经把值换成 *** 后,字面量那条不会再命中同一处
  // 收尾 trim:纯空白要与纯空值同判"(无详情)" —— 一封只有空格的告警正文等于没寄。
  const masked = s.replace(ALERT_ASSIGN_RE, '$1***').replace(ALERT_LITERAL_RE, '[已脱敏]').trim()
  return masked || '(无详情)'
}

/** 子进程输出:脱敏 + 截断(日志不被撑爆)。空输出如实标"(无输出)",不伪装成有内容。 */
export function redactChildOutput(raw, limit = 300) {
  const kept = redactSecretishLines(raw)
  if (!kept) return '(无输出)'
  return kept.length > limit ? `${kept.slice(0, limit)}…(截断)` : kept
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
