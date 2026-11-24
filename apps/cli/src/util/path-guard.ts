// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as fs from 'node:fs';
import * as path from 'node:path';

import { sanitizeSessionSegment } from '../tools/result-envelope/artifact-store.js';

/** root 自身不算"之内";只认严格子路径。 */
function isStrictlyInside(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

/** 纯 resolve 判定的根内检查(供"工具入参"这类需要宽松口径的场景复用同一判据)。 */
export function isPathInside(root: string, target: string): boolean {
  return isStrictlyInside(path.resolve(root), path.resolve(target));
}

/**
 * 把不可信 id 收敛成单段名。
 *
 * `sanitizeSessionSegment` 会保留 `.` / `..`(它们是合法目录段),所以这里单独拒;
 * 其余字符统一映射为 `_`,天然不含路径分隔符、盘符与前导斜杠。
 */
export function safePathSegment(id: string): string {
  const segment = sanitizeSessionSegment(id);
  if (segment === '.' || segment === '..') {
    throw new Error(`拒绝路径段 "${id}":收敛后仍是特殊目录段 "${segment}"`);
  }
  return segment;
}

/**
 * 目标路径必须严格位于 root 之内。
 *
 * 先按 `path.resolve` 判一次;目标与根都存在时再按 realpath 判一次,
 * 防符号链接/ junction 把落点拐到根外。判据唯一实现(检查点、计划文件共用)。
 */
export function assertPathInside(root: string, target: string, label: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  if (!isStrictlyInside(resolvedRoot, resolvedTarget)) {
    throw new Error(`拒绝${label} "${resolvedTarget}":不在根目录 "${resolvedRoot}" 之内`);
  }
  if (fs.existsSync(resolvedRoot)) {
    const realRoot = fs.realpathSync(resolvedRoot);
    if (fs.existsSync(resolvedTarget)) {
      const realTarget = fs.realpathSync(resolvedTarget);
      if (!isStrictlyInside(realRoot, realTarget)) {
        throw new Error(`拒绝${label} "${resolvedTarget}":符号链接解析后落在根目录 "${realRoot}" 之外`);
      }
    } else {
      // 目标尚未创建(新建文件/目录场景):退一步校验"最近的已存在祖先",
      // 防父级目录是符号链接时把写入落点拐到根外。
      const anchor = nearestExistingAncestor(resolvedTarget);
      if (anchor !== null) {
        const realAnchor = fs.realpathSync(anchor);
        if (realAnchor !== realRoot && !isStrictlyInside(realRoot, realAnchor)) {
          throw new Error(`拒绝${label} "${resolvedTarget}":符号链接解析后落在根目录 "${realRoot}" 之外`);
        }
      }
    }
  }
  return resolvedTarget;
}

/** 沿父目录上溯到最近的已存在路径(用于目标尚未创建的写入前校验)。 */
function nearestExistingAncestor(target: string): string | null {
  let cur = target;
  for (;;) {
    if (fs.existsSync(cur)) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
}

/** 收敛单段 id(可带文件名后缀)并断言落在 root 之内(会话/hunk/账本/subagent 状态行共用)。 */
export function segmentFilePathInside(root: string, id: string, suffix: string, label: string): string {
  return assertPathInside(root, path.join(root, `${safePathSegment(id)}${suffix}`), label);
}

/**
 * 把来自持久化文件(manifest/undo history)的"工作区相对路径"解析成绝对路径。
 *
 * 持久化路径一律视为不可信输入,与工具入参的宽松口径**刻意不同**:
 *   - 绝对路径 / Windows 盘符 / UNC 一律拒(契约只允许相对路径,不因"恰好落在根内"放行);
 *   - `..` 目录段一律拒;
 *   - 其余交给 `assertPathInside`(resolve 根内断言 + realpath 二次断言)。
 */
export function resolveWorkspaceRelPath(root: string, relPath: string, label: string): string {
  if (path.isAbsolute(relPath) || path.win32.isAbsolute(relPath)) {
    throw new Error(`拒绝${label} "${relPath}":持久化路径必须是相对路径,不接受绝对路径/盘符`);
  }
  if (relPath.split(/[\\/]+/).includes('..')) {
    throw new Error(`拒绝${label} "${relPath}":含 ".." 目录段`);
  }
  return assertPathInside(root, path.resolve(root, relPath), label);
}

/**
 * 把可能需要绝对路径的入参(undo history 的 filePath 等)解析成绝对路径并断言在 root 内。
 *
 * 与 `resolveWorkspaceRelPath` 的区别:接受绝对路径,但无论相对/绝对,解析后都必须落在 root 内。
 */
export function resolvePathInsideRoot(root: string, filePath: string, label: string): string {
  return assertPathInside(root, path.resolve(root, filePath), label);
}

/**
 * 单段文件名判据(计划名等用户可见名):只拒路径穿越/分隔符/NUL,其余字符原样保留。
 *
 * 与 `safePathSegment` 的区别:后者会把非法字符**替换**成 `_`,适合 id 收敛;
 * 计划名是用户可见文件名(中文/空格/点号都合法),必须拒绝而非改名,故单列此判据。
 */
export function assertPlainFileName(name: string, label: string): string {
  if (!name) throw new Error(`${label}不能为空`);
  if (name.includes('/') || name.includes('\\') || name.includes('..') || name.includes('\0')) {
    throw new Error(`${label}不合法(不能含路径分隔符或 ..): ${name}`);
  }
  return name;
}

/** 收敛 id 并返回 `root/<segment>`,同时完成根内断言。 */
export function segmentPathInside(root: string, id: string, label: string): string {
  return assertPathInside(root, path.join(root, safePathSegment(id)), label);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
