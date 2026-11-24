// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工作区登记根白名单 —— 服务端唯一的「这条路径允许被碰」判据。
 *
 * 为什么必须有它:文件桥的 `workspacePath`、终端的 `cwd` 一直是**客户端自报字符串**,
 * 于是「文件必须落在工作区内」这条判据可以自我成立 —— 调用方传 `workspacePath="C:\"`
 * 之后,整台生产机都在"工作区内",越界校验形同装饰。白名单不能来自请求体 ⇒ 只能来自
 * 服务端配置(env)。
 *
 * 未配置 ⇒ 空数组 ⇒ 一切路径都拒绝(fail-closed)。宁可对自托管部署报一句「未登记」,
 * 也不要在无人显式意图的情况下把服务器文件系统敞开。
 */
import { realpathSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'

/** 唯一 env 键名(逗号或分号分隔);运维要放开工作区只改这一处 */
export const WORKSPACE_ROOTS_ENV = 'IHUI_WORKSPACE_ROOTS'

/** 存在则 realpath(消解符号链接),不存在则 resolve —— 新建文件/目录场景不能因不存在而放行 */
export function realpathOrResolve(p: string): string {
  try {
    return realpathSync(p)
  } catch {
    return resolve(p)
  }
}

/** 服务端登记的根集合(全部已归一);env 未设 ⇒ 空数组 */
export function getRegisteredWorkspaceRoots(): string[] {
  const raw = process.env[WORKSPACE_ROOTS_ENV] ?? ''
  const roots: string[] = []
  for (const item of raw.split(/[,;]/)) {
    const trimmed = item.trim()
    if (trimmed) roots.push(realpathOrResolve(trimmed))
  }
  return roots
}

/**
 * 落点判据。用 relative 而不是 startsWith:绝对路径、`..` 回跳、大小写盘符
 * 三种形态都能被 relative + isAbsolute 一次性覆盖。
 */
export function isInsideRoot(child: string, root: string): boolean {
  const rel = relative(root, child)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

/** 该路径是否落在任一登记根内(含根自身) */
export function isWithinAnyRegisteredRoot(p: string): boolean {
  const real = realpathOrResolve(p)
  return getRegisteredWorkspaceRoots().some((r) => isInsideRoot(real, r))
}

/**
 * 断言并返回归一后的绝对路径。
 * 错误文案刻意不含任何服务器实际路径,只说清"要改哪个旋钮"——这些 message 会被路由
 * 原样回吐给客户端。
 */
export function assertWithinRegisteredRoots(p: string, label = '路径'): string {
  const roots = getRegisteredWorkspaceRoots()
  if (roots.length === 0) {
    throw new Error(`未启用:服务端未登记任何工作区根(${WORKSPACE_ROOTS_ENV} 为空)`)
  }
  const real = realpathOrResolve(p)
  if (!roots.some((r) => isInsideRoot(real, r))) {
    throw new Error(`${label}未在服务端登记:仅允许 ${WORKSPACE_ROOTS_ENV} 白名单内的路径`)
  }
  return real
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
