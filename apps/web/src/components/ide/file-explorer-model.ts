// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import type { FileNode, OutlineNode } from '@ihui/types'

export function parseOutline(source: string): OutlineNode[] {
  const nodes: OutlineNode[] = []
  const lines = source.split(/\r?\n/)
  lines.forEach((raw, index) => {
    const line = raw.trim()
    if (!line || line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) return
    const stripped = line.startsWith('export ') ? line.slice('export '.length).trimStart() : line
    let type: OutlineNode['type'] | null = null
    let label = ''
    let match: RegExpMatchArray | null

    if ((match = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/.exec(stripped))) {
      type = 'function'
      label = match[1] ?? ''
    } else if ((match = /^\bclass\s+([A-Za-z_$][\w$]*)/.exec(stripped))) {
      type = 'class'
      label = match[1] ?? ''
    } else if ((match = /^\binterface\s+([A-Za-z_$][\w$]*)/.exec(stripped))) {
      type = 'interface'
      label = match[1] ?? ''
    } else if ((match = /^\btype\s+([A-Za-z_$][\w$]*)\s*=/.exec(stripped))) {
      type = 'type'
      label = match[1] ?? ''
    } else if (
      (match = /^(?:async\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/.exec(stripped))
    ) {
      const rhs = line.slice(line.indexOf('=') + 1).trimStart()
      const isFunction =
        /^\(.*\)\s*=>/.test(rhs) ||
        /^[\w$]+\s*=>/.test(rhs) ||
        /^(?:async\s+)?function\b/.test(rhs) ||
        /^async\b/.test(rhs)
      type = isFunction ? 'function' : 'variable'
      label = match[1] ?? ''
    } else {
      return
    }

    nodes.push({ id: `${type}-${index + 1}-${label}`, label, type, line: index + 1 })
  })
  return nodes
}

export function flattenFiles(nodes: FileNode[], term: string): FileNode[] {
  const matches: FileNode[] = []
  const lowerTerm = term.toLowerCase()
  const walk = (list: FileNode[]) => {
    for (const node of list) {
      if (node.type === 'file' && node.name.toLowerCase().includes(lowerTerm)) matches.push(node)
      if (node.children) walk(node.children)
    }
  }
  walk(nodes)
  return matches
}

export function getRenamedPath(oldPath: string, newName: string): string {
  const lastSeparator = Math.max(oldPath.lastIndexOf('/'), oldPath.lastIndexOf('\\'))
  return lastSeparator >= 0 ? `${oldPath.substring(0, lastSeparator)}/${newName}` : newName
}

const SHELL_UNSAFE_CHARS = /["`$;|&\\]/

export function validateFileName(name: string): string | null {
  if (!name) return '文件名不能为空'
  if (name.includes('..')) return '文件名不能包含 ..'
  if (SHELL_UNSAFE_CHARS.test(name)) return '文件名包含非法字符'
  return null
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

export function resolvePathSegments(path: string): string[] {
  const output: string[] = []
  for (const segment of normalizePath(path).split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') output.pop()
    else output.push(segment)
  }
  return output
}

export function isPathInWorkspace(target: string, workspace: string): boolean {
  const targetSegments = resolvePathSegments(target)
  const workspaceSegments = resolvePathSegments(workspace)
  return (
    targetSegments.length >= workspaceSegments.length &&
    workspaceSegments.every((segment, index) => targetSegments[index] === segment)
  )
}
