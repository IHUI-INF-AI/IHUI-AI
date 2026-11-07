// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use strict'
/**
 * hook-tool-path.js — 钩子子进程的工具 PATH 构造(单一实现,2026-11-05 立)
 *
 * 病根:pre-commit 钩子经 wscript → cmd /s /c 启动,继承的是**触发者**的 PATH。
 * 在 GUI git 面板 / IDE 隐藏 shell 等上下文里,这个 PATH 可能既没有 node 目录,
 * 也没有仓库的 node_modules/.bin —— 于是旧写法 `npx lint-staged ...` 当场报
 * "'npx' is not recognized"(实测:PATH 只剩 System32+Windows+Git\cmd 时复现)。
 *
 * 本模块只做一件事:把**仓库内已知落点**显式拼进 PATH,不依赖继承值:
 *   ① dirname(process.execPath)      —— 运行本钩子的那个 node 一定可用
 *   ② <repo>/node_modules/.bin       —— eslint / prettier 等本仓任务二进制
 * 再去重(Windows 大小写不敏感)后与原 PATH 拼接。
 *
 * 注意:lint-staged 17.3.0 的 tinyexec 自身也会从 cwd 向上补 node_modules/.bin
 * (tinyexec@1.3.0 `addNodeBinToPath`),所以本模块是**加固**而不是唯一通路:
 * 即便未来 tinyexec 换实现/被替换,下面两项仍由钩子显式提供。
 */
const path = require('path')

/**
 * @param {{ envPath?: string, execPath?: string, root: string }} opts
 * @returns {string} 以平台分隔符拼接的新 PATH
 */
function buildToolPath({ envPath = '', execPath = process.execPath, root } = {}) {
  if (!root) throw new Error('buildToolPath: 缺少 root')
  const prepended = [path.dirname(execPath), path.join(root, 'node_modules', '.bin')]
  const seen = new Set()
  const out = []
  for (const raw of prepended.concat(String(envPath ?? '').split(path.delimiter))) {
    const p = raw.trim()
    if (!p) continue
    const key = process.platform === 'win32' ? p.toLowerCase() : p
    if (seen.has(key)) continue
    seen.add(key)
    out.push(p)
  }
  return out.join(path.delimiter)
}

module.exports = { buildToolPath }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
