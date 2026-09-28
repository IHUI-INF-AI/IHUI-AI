// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * `scripts/desktop-dev-saas.mjs` 的"该停哪个桌面端实例"判据(纯函数,零副作用)。
 *
 * 为什么单独成文件:这条判据是**用户事故的直接防线**(旧写法 `taskkill /IM <裸文件名>` 会连用户
 * 已安装的那一份一起杀),而宿主脚本是顶层即执行的 CLI(跑到 `process.exit` 才完),测试 import 它
 * 就会真的去起一次 dev 构建。按 §22d 给整脚本补 `isDirectRun` 属于顺手重构(§11 派单格外的改动),
 * 所以判据下沉到这里 —— 宿主与测试共用**同一份**实现,不存在第二份真相。
 *
 * 判据只有一条:落在本仓 `apps/desktop/src-tauri/target/` 下的实例才可停。
 * 失效方向刻意是"少停":路径问不到、目录只是前缀相似、大小写/分隔符异常 ⇒ 一律归"不动它们"并报名,
 * 因为少停最多让 cargo 链接报 `os error 5`(可诊断、可重试),多停是用户正在用的程序消失。
 */

/** Windows 路径归一:统一分隔符 + 小写(文件系统大小写不敏感)。 */
export function normalizeWinPath(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\\/]+/g, '/')
}

/**
 * @param rawStdout `Get-CimInstance ... | ForEach-Object { '{0}|{1}' -f ProcessId, ExecutablePath }` 的输出
 * @param targetDir 本仓桌面端构建目录(该目录**之下**的实例才可停)
 * @returns {{mine: string[], foreign: string[]}} mine=可停的 pid;foreign=应报名不动的说明串
 */
export function selectDesktopVictims(rawStdout, targetDir) {
  const prefix = `${normalizeWinPath(targetDir)}/`
  const mine = []
  const foreign = []
  for (const row of String(rawStdout ?? '').split(/\r?\n/)) {
    const i = row.indexOf('|')
    if (i < 0) continue // 不是 `pid|path` 形态的行(表头/空行/换行截断)一律跳过
    const pid = row.slice(0, i).trim()
    const exe = row.slice(i + 1).trim()
    if (!/^\d+$/.test(pid)) continue
    if (!exe) {
      foreign.push(`${pid}(路径问不到)`)
      continue
    }
    // 必须带分隔符才算"在该目录之下":`.../targetX/...` 只是字符串前缀相似,不是子路径。
    if (normalizeWinPath(exe).startsWith(prefix)) mine.push(pid)
    else foreign.push(`${pid}(${exe})`)
  }
  return { mine, foreign }
}
