#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * push-window-gate.mjs — 推送的两道「拒绝」闸(纯判定,可单测)
 *
 * 立因(2026-11-07 实测):
 *   病灶不是某一次口误,而是机制缺省相反 —— `.husky/post-commit` → `scripts/lib/post-commit-hook.js`
 *   的缺省行为是"只要 HUSKY_SKIP_PUSH !== '1' 就自动推",而当时 `origin` 是
 *   `ssh://git@ssh.github.com:443/IHUI-INF-AI/IHUI-AI.git`。硬约束要求"只准 HTTPS 显式地址"。
 *   一次默认行为 + 一个 SSH remote = 一次违规推送,只差远端当时可达(当日实测因远端不可达才没推出去)。
 *   约束只写在对话里、机制上却是"默认推" ⇒ 那句话在机制上不可执行。本模块把两条约束变成**拒绝**:
 *   缺省 = 不推,而不是缺省 = 推。
 *
 * 为什么住在 scripts/lib/ 而不是在 git-push-guard.mjs 里 export:
 *   与 lib/push-attempt-triage.mjs 同因 —— 该文件顶层就是 CLI 主体(没有 §22d 的 isDirectRun 守卫),
 *   测试若 import 它就会在测试进程里真跑一趟推送。判据在这里,装车在 guard 里。
 *
 * 取向:**宁拒不放**。取不到 URL、认不出协议、没显式写 `PUSH_WINDOW=1` 的环境一律拒绝,并如实
 *   说出缺什么;拒绝绝不降级成 warning 后继续推。
 */

/** 硬约束点名的两种正确写法;拒绝文案与文档共用这两处,不另抄。 */
export const HTTPS_REMOTE_HINT = 'https://github.com/IHUI-INF-AI/IHUI-AI.git'
export const SSH_REMOTE_HINT = 'ssh://git@ssh.github.com:443/IHUI-INF-AI/IHUI-AI.git'

/**
 * 受支持的两种显式传输协议。**只在协议名与主机都由字面量确定时放行**:
 * 正则要求 `协议://` 后紧跟至少一个非空白、非斜杠字符(即主机段非空),
 * 于是 `https://` / `ssh://` 这种"只有协议头"的残缺值仍会被拒。
 */
const SAFE_REMOTE_SCHEMES = [
  { re: /^https:\/\/[^\s/]+/i, code: 'https' },
  { re: /^ssh:\/\/[^\s/]+/i, code: 'ssh' },
]

/**
 * 协议闸:接受显式 `https://` 或 `ssh://` 开头的远端地址。
 * `git@host:path`(scp-like) / `git://` / `file://` / 本地路径(含 Windows 盘符、正反斜杠与 UNC) /
 * 相对路径 / 裸字符串全部拒绝。取不到 URL ⇒ 拒绝(未判定 ≠ 合规)。
 *
 * 2026-11-11 修订(为什么从 https-only 放宽到 https+ssh):
 *   原判据只准 `https://`，依据是 2026-11-07 的"只准 HTTPS 显式地址"约束。但本机实测
 *   GitHub 常规 443 不可达，唯一可用通道是 `ssh://git@ssh.github.com:443`，且机主后定的
 *   运维铁律是「origin 必须 ssh、**严禁改回 https**」—— 两条机主指令冲突时取较新的一条。
 *   旧判据的实际效果是:**自动推送永久失败**(每轮都 exit 1 刷 failed)，人只能绕开 guard 手推，
 *   等于把该模块整体废掉；而"不自动推"这一实质诉求由**窗口闸**(`PUSH_WINDOW=1`)独立承担，
 *   与协议无关。故这里只放宽协议白名单，窗口闸一律不动，危险协议(stcp-like/git:///file:///
 *   本地路径)的拒绝也一律不动 —— 放宽的是"走哪条安全通道"，不是"推不推"。
 *
 * @param {string|null|undefined} url
 * @returns {{ok:boolean, code:string, url:string|null, reason:string}}
 */
export function judgePushRemoteUrl(url) {
  const raw = String(url ?? '').trim()
  if (!raw) {
    return {
      ok: false,
      code: 'remote-unreadable',
      url: null,
      reason: '取不到目标远端 URL ⇒ 无法判定是否合规,本轮不推',
    }
  }
  for (const scheme of SAFE_REMOTE_SCHEMES) {
    if (scheme.re.test(raw)) return { ok: true, code: scheme.code, url: raw, reason: '' }
  }
  return {
    ok: false,
    code: 'unsafe-remote',
    url: raw,
    reason:
      '远端地址不是受支持的显式传输协议(只接受 https:// 与 ssh://;git@host:path / git:// / file:// / 本地路径 / 相对路径一律拒绝)，本轮不推',
  }
}

/**
 * 窗口闸:只有显式 `PUSH_WINDOW=1` 才算"拿到推送窗口"。
 * 缺省(含 `'0'` / `'true'` / 空串 / 未设置)一律视为**无窗口** —— 缺省值必须是不推。
 * @param {Record<string, string|undefined>} env
 * @returns {{ok:boolean, code:string, value:string, reason:string}}
 */
export function judgePushWindow(env = {}) {
  const value = String((env && env.PUSH_WINDOW) ?? '')
  if (value === '1') return { ok: true, code: 'window-open', value, reason: '' }
  return {
    ok: false,
    code: value ? 'window-not-open' : 'window-absent',
    value: value || '(未设置)',
    reason: '推送窗口未开启 ⇒ 本轮不推（提交已落地本地）',
  }
}
