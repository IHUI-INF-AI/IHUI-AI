// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * File Explorer 纯函数模型(无 JSX)。
 * 由 file-explorer.tsx / file-tree-node.tsx 共享复用:大纲解析、文件扁平化搜索、
 * 路径安全校验、重命名与文件名校验。
 */
import type { FileNode, OutlineNode } from '@ihui/types'

/**
 * 从源码文本解析顶层符号,生成大纲节点。
 * 后端无按文件 outline / symbol 端点,采用本地正则解析(class/function/interface/type/const 声明)。
 * 保持轻量,仅生成顶层节点(现有 UI 的 children 渲染可选)。
 */
export function parseOutline(source: string): OutlineNode[] {
  const nodes: OutlineNode[] = []
  const lines = source.split(/\r?\n/)
  lines.forEach((raw, idx) => {
    const line = raw.trim()
    if (!line || line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) return
    // 去除 export 前缀,统一识别声明关键字
    const stripped = line.startsWith('export ') ? line.slice('export '.length).trimStart() : line
    let type: OutlineNode['type'] | null = null
    let label = ''
    let m: RegExpMatchArray | null

    if ((m = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/.exec(stripped))) {
      type = 'function'
      label = m[1] ?? ''
    } else if ((m = /^\bclass\s+([A-Za-z_$][\w$]*)/.exec(stripped))) {
      type = 'class'
      label = m[1] ?? ''
    } else if ((m = /^\binterface\s+([A-Za-z_$][\w$]*)/.exec(stripped))) {
      type = 'interface'
      label = m[1] ?? ''
    } else if ((m = /^\btype\s+([A-Za-z_$][\w$]*)\s*=/.exec(stripped))) {
      type = 'type'
      label = m[1] ?? ''
    } else if ((m = /^(?:async\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/.exec(stripped))) {
      const rhs = line.slice(line.indexOf('=') + 1).trimStart()
      const isFn =
        /^\(.*\)\s*=>/.test(rhs) ||
        /^[\w$]+\s*=>/.test(rhs) ||
        /^(?:async\s+)?function\b/.test(rhs) ||
        /^async\b/.test(rhs)
      type = isFn ? 'function' : 'variable'
      label = m[1] ?? ''
    } else {
      return
    }

    nodes.push({ id: `${type}-${idx + 1}-${label}`, label, type, line: idx + 1 })
  })
  return nodes
}

/** 递归扁平化文件树,按文件名模糊搜索匹配的文件节点。 */
export function flattenFiles(nodes: FileNode[], term: string): FileNode[] {
  const out: FileNode[] = []
  const lower = term.toLowerCase()
  const walk = (list: FileNode[]) => {
    for (const n of list) {
      if (n.type === 'file' && n.name.toLowerCase().includes(lower)) out.push(n)
      if (n.children) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

/** 计算重命名后的新路径(替换最后一段路径分量)。 */
export function getRenamedPath(oldPath: string, newName: string): string {
  const lastSep = Math.max(oldPath.lastIndexOf('/'), oldPath.lastIndexOf('\\'))
  return lastSep >= 0 ? `${oldPath.substring(0, lastSep)}/${newName}` : newName
}

const SHELL_UNSAFE_CHARS = /["`$;|&\\]/
/** 文件名校验:禁用空名 / 路径穿越(..) / shell 元字符,防命令注入。 */
export function validateFileName(name: string): string | null {
  if (!name) return '文件名不能为空'
  if (name.includes('..')) return '文件名不能包含 ..'
  if (SHELL_UNSAFE_CHARS.test(name)) return '文件名包含非法字符'
  return null
}

export function normalizePath(p: string): string {
  const base = p.replace(/\\/g, '/').replace(/\/+$/, '')
  // 解析 . / .. 段:防止 'G:/repo/../outside' 这类路径绕过 isPathInWorkspace 越界防护。
  // 保留空段与 '..' 溢出(如 '/..' 停在根),不改变绝对路径语义。
  const out: string[] = []
  for (const seg of base.split('/')) {
    if (seg === '.') continue
    if (seg === '..' && out.length > 0 && out[out.length - 1] !== '..') {
      out.pop()
      continue
    }
    out.push(seg)
  }
  return out.join('/')
}
/** 校验目标路径必须在 workspace 子树内(防 rm -rf 越界删除)。 */
export function isPathInWorkspace(target: string, workspace: string): boolean {
  const t = normalizePath(target)
  const w = normalizePath(workspace)
  if (t === w) return true
  return t.startsWith(`${w}/`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
