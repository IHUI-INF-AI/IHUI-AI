// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/lib/dev-stack-residency-policy.mjs — 常驻开发服务「按需启停」判据单源(§0.6)
//
// 2026-11-10 机主令:「常驻服务不用的时候不允许占用啊 必须关掉 以后也不能发生这种
// 白白占用的情况」。当日实测:登录自启的 dev-stack(expo/Metro 常驻吃 1.5 核)+ 每 2
// 分钟复活守护的 watchdog + 每 1 分钟复活 :80 CDN 的看门狗,在零客户端连接时白烧
// CPU(整机 20 核被打到 100%)。三条自启任务已禁用;本判据把「注册自启/复活常驻」
// 的入口默认锁死,防后手会话照旧文档把自启装回来。
//
// 消费方:install-dev-stack-autostart.mjs 的 install()、dev-stack-watchdog.mjs 直跑
// 入口(巡检复活与 --install 注册同锁)。判据纯函数零 IO,镜像测试直接 import。

export const RESIDENCY_RULING =
  '2026-11-10 机主令:常驻开发服务禁止开机自启白占,按需启动(pnpm dev)、用完即停(pnpm dev:safe:stop)'

// 唯一放行通道 = 机主显式定向放行(失效方向恒为「多要一次定向说明」,§0.10)
export const OWNER_ALLOW_ENV = 'IHUI_DEV_AUTOSTART_OWNER_ALLOW'

export function judgeDevAutostart({ env = {} } = {}) {
  if (String(env[OWNER_ALLOW_ENV] ?? '') === '1') {
    return { allowed: true, why: `机主显式放行(${OWNER_ALLOW_ENV}=1)` }
  }
  return { allowed: false, why: RESIDENCY_RULING }
}

// ── 2026-11-16 机主定向裁决:签到腿「最小常驻例外」────────────────────────────
// 机主对「签到腿脱离 dev 习惯 7×24」明确拍板(逐字见 docs/tickets/2026-11/signin-residency-20261116.md)。
// 例外只覆盖一枚进程 = ai-service(8803)的幂等自检拉起(30 分钟节拍,在位即零动作),
// 用途固定为签到调度 + 进程内保活心跳;**不解除**上面 judgeDevAutostart 对 dev 全家桶
// (web/api/Metro/CDN/revive-watchdog)的 11-10 锁 —— 本函数不得被 dev-stack 自啓/复活链路消费,
// 消费方唯一 = scripts/register-signin-residency-task.mjs。
// 关闸 = IHUI_SIGNIN_RESIDENCY_DISABLE=1:失效方向恒为「多要一次定向说明」(注册器拒装并
// 点名原因),绝不是「多放一次跳门」(§0.10)。卸载正道 = 注销任务,不留隐式常驻。
export const SIGNIN_RESIDENCY_RULING =
  '2026-11-16 机主定向裁决:允许签到腿(ai-service 单进程 8803,禁 --workers/--reload 的进程级风控闸门契约)最小幂等常驻;dev-stack 全家桶自启仍按 2026-11-10 锁死'

export const SIGNIN_RESIDENCY_DISABLE_ENV = 'IHUI_SIGNIN_RESIDENCY_DISABLE'

export function judgeSigninLegResidency({ env = {} } = {}) {
  if (String(env[SIGNIN_RESIDENCY_DISABLE_ENV] ?? '') === '1') {
    return {
      allowed: false,
      why: `机主显式关闭签到常驻腿(${SIGNIN_RESIDENCY_DISABLE_ENV}=1),出路:去掉该变量再注册,或保持按需形态`,
    }
  }
  return { allowed: true, why: SIGNIN_RESIDENCY_RULING }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
