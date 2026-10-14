// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 包管理器执行器判据 —— 全仓唯一一份(2026-10-14 立)。
 *
 * 为什么需要它:同一个判定此前被抄在两个入口脚本里
 * (`scripts/desktop-dev-saas.mjs` 与 `scripts/desktop-build-saas.mjs`),
 * 而这两处正是 AGENTS.md §0.6 说的那一型 —— 同类判据第二份必然漂移。
 * 本模块把判定收成一处,两个入口都 import 它。
 *
 * 判据本身要治的 bug:`npm_execpath` **不保证是 JS 入口**。
 *   · npm  下它是 `.../npm/bin/npm-cli.js` —— 可被 node 当模块加载;
 *   · pnpm 11/Windows 下它是 `.../@pnpm/exe/pnpm.exe` —— **是原生可执行文件本体**。
 * 把后者交给 `process.execPath`(node)加载,得到
 * `ERR_UNKNOWN_FILE_EXTENSION ".exe"` 且退出码 1,而报错信息里没有一个字提到"入口",
 * 表现为"整条命令起不来"而非"参数错了"。
 * 实测:该假设曾同时打断 `pnpm dev:desktop:saas`(2026-10-14 08:06 引入)与
 * `pnpm build:desktop:saas`(2026-10-13 引入)。
 *
 * 回落分支用 shell 解析裸 `pnpm`,是因为 Windows 上它可能是 .cmd shim;
 * 代价是参数不得含需要 shell 转义的字符 —— 两个调用方传的都是**文件路径**
 * (`--config <path>`),不是内联 JSON,这正是当年把内联 JSON 改成落盘路径的原因。
 */

/** 可被 node 当模块加载的入口扩展名:.js / .cjs / .mjs */
const NODE_LOADABLE_RE = /\.[cm]?js$/i

/**
 * 决定"该怎么把一条包管理器命令 spawn 出去"。
 *
 * @param {string | undefined} npmExecpath 取自 `process.env.npm_execpath`
 * @param {string} [execPath] 注入点:node 可执行文件路径(默认取本进程)
 * @returns {{cmd: string, prefix: string[], shell: boolean}}
 *   `cmd` 要执行的程序;`prefix` 需要前置到业务参数之前的参数(直载时是入口脚本路径);
 *   `shell` 是否要开 shell。
 */
export function planPackageManagerSpawn(npmExecpath, execPath = process.execPath) {
  const loadableByNode = !!npmExecpath && NODE_LOADABLE_RE.test(npmExecpath)
  return {
    cmd: loadableByNode ? execPath : 'pnpm',
    prefix: loadableByNode ? [npmExecpath] : [],
    shell: !loadableByNode,
  }
}

export const __test__ = { planPackageManagerSpawn, NODE_LOADABLE_RE }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
