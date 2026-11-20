#!/usr/bin/env node
/**
 * 8877 端口 web dev 入口（桌面端 dev 壳专用）。
 *
 * 立因（2026-11-21 实测）：
 *   本机 8801 已被 IHUI-WEB-ROUTER（生产路由，nssm 服务托管）长期占用，
 *   dev-with-warmup 默认端口又是 8801。于是：
 *   - `pnpm dev:desktop:saas` 会先 taskkill 掉 8801 上的进程再起 Next dev
 *     ⇒ 直接把本机生产路由打掉；
 *   - `@ihui/desktop dev`（tauri.dev.json）又不覆盖 windows[0].url，
 *     窗口加载的是 tauri.conf.json 里的 https://aizhs.top/ ⇒ 本地改的代码
 *     永远不会出现在桌面端窗口里（"web 热更新了但桌面端不动"的根因）。
 *
 *   本脚本只做一件事：把 dev server 端口钉到 8877，其余逻辑全部交给
 *   dev-with-warmup（预热、锁、stdio 透传都不在这里重写）。
 *   配合 src-tauri/tauri.dev.local.json 的 devUrl / windows[0].url 一起用。
 */

process.env.IHUI_DEV_PORT = process.env.IHUI_DEV_PORT || '8877'

await import('./dev-with-warmup.mjs')
