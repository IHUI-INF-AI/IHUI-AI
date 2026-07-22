import {
  FileText, FileCode, FileJson, FileImage, FileCog,
  Hash, FileTerminal, Braces, Database, Binary, Box, Container,
  type LucideIcon,
} from 'lucide-react'

/** 特殊文件名(完整小写匹配)→ 图标 */
const SPECIAL_FILE_ICON_MAP: Record<string, LucideIcon> = {
  dockerfile: Container,
  makefile: FileTerminal,
  '.gitignore': FileCog,
  '.env': FileCog,
  '.env.local': FileCog,
  '.env.production': FileCog,
  '.env.development': FileCog,
  license: FileText,
  copying: FileText,
  readme: FileText,
  changelog: FileText,
  'package.json': FileJson,
  'package-lock.json': FileJson,
  'tsconfig.json': FileJson,
  'vite.config.ts': FileCog,
  'turbo.json': FileCog,
  'pnpm-lock.yaml': FileCog,
  'pnpm-workspace.yaml': FileCog,
}

const EXT_ICON_MAP: Record<string, LucideIcon> = {
  ts: FileCode,
  tsx: FileCode,
  js: FileCode,
  jsx: FileCode,
  json: FileJson,
  css: Hash,
  scss: Hash,
  md: FileText,
  txt: FileText,
  html: FileCode,
  xml: FileCode,
  svg: FileImage,
  png: FileImage,
  jpg: FileImage,
  jpeg: FileImage,
  gif: FileImage,
  py: FileCode,
  go: FileCode,
  rs: FileCode,
  sh: FileCog,
  yml: FileCog,
  yaml: FileCog,
  env: FileCog,
  // 新增扩展名
  vue: FileCode,
  svelte: FileCode,
  rb: FileCode,
  php: FileCode,
  java: FileCode,
  c: FileCode,
  cpp: FileCode,
  cc: FileCode,
  cxx: FileCode,
  h: FileCode,
  hpp: FileCode,
  dart: FileCode,
  lua: FileCode,
  sql: Database,
  prisma: Database,
  graphql: Braces,
  gql: Braces,
  toml: FileCog,
  ini: FileCog,
  conf: FileCog,
  lock: FileCog,
  log: FileText,
  pdf: FileText,
  zip: Box,
  tar: Box,
  gz: Box,
  wasm: Binary,
}

const SPECIAL_FILE_COLOR_MAP: Record<string, string> = {
  dockerfile: 'text-blue-500',
  makefile: 'text-green-600',
  '.gitignore': 'text-orange-500',
  '.env': 'text-yellow-600',
  '.env.local': 'text-yellow-600',
  '.env.production': 'text-yellow-600',
  '.env.development': 'text-yellow-600',
  license: 'text-muted-foreground',
  readme: 'text-muted-foreground',
  changelog: 'text-muted-foreground',
  'package.json': 'text-amber-500',
  'package-lock.json': 'text-amber-500',
  'tsconfig.json': 'text-amber-500',
  'vite.config.ts': 'text-purple-500',
  'turbo.json': 'text-purple-500',
  'pnpm-lock.yaml': 'text-orange-500',
  'pnpm-workspace.yaml': 'text-orange-500',
}

const EXT_COLOR_MAP: Record<string, string> = {
  ts: 'text-blue-500',
  tsx: 'text-blue-500',
  js: 'text-yellow-500',
  jsx: 'text-yellow-500',
  json: 'text-amber-500',
  css: 'text-pink-500',
  scss: 'text-pink-500',
  md: 'text-muted-foreground',
  html: 'text-orange-500',
  py: 'text-green-500',
  go: 'text-cyan-500',
  rs: 'text-orange-600',
  // 新增扩展名
  vue: 'text-green-500',
  svelte: 'text-orange-500',
  rb: 'text-red-500',
  php: 'text-indigo-500',
  java: 'text-red-600',
  c: 'text-blue-600',
  cpp: 'text-blue-600',
  cc: 'text-blue-600',
  cxx: 'text-blue-600',
  h: 'text-blue-600',
  hpp: 'text-blue-600',
  dart: 'text-cyan-500',
  lua: 'text-blue-500',
  sql: 'text-pink-500',
  prisma: 'text-cyan-600',
  graphql: 'text-pink-500',
  gql: 'text-pink-500',
  sh: 'text-green-600',
  yml: 'text-purple-500',
  yaml: 'text-purple-500',
  toml: 'text-purple-500',
  env: 'text-yellow-600',
  svg: 'text-orange-500',
  lock: 'text-muted-foreground',
  log: 'text-muted-foreground',
}

export type GitFileStatus = 'modified' | 'added' | 'deleted' | 'untracked'

const GIT_STATUS_COLOR: Record<GitFileStatus, string> = {
  modified: 'bg-orange-500',
  added: 'bg-green-500',
  deleted: 'bg-red-500',
  untracked: 'bg-green-500',
}

export function getFileIcon(filename: string): LucideIcon {
  const lower = filename.toLowerCase()
  if (SPECIAL_FILE_ICON_MAP[lower]) return SPECIAL_FILE_ICON_MAP[lower]
  const ext = lower.split('.').pop() ?? ''
  return EXT_ICON_MAP[ext] ?? FileText
}

export function getFileColor(filename: string): string {
  const lower = filename.toLowerCase()
  if (SPECIAL_FILE_COLOR_MAP[lower]) return SPECIAL_FILE_COLOR_MAP[lower]
  const ext = lower.split('.').pop() ?? ''
  return EXT_COLOR_MAP[ext] ?? 'text-muted-foreground'
}

/** 获取 git 状态色点颜色,无状态返回 null */
export function getGitStatusColor(status?: GitFileStatus): string | null {
  if (!status) return null
  return GIT_STATUS_COLOR[status] ?? null
}
