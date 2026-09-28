// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// 提及维度的 **web 侧外观 adapter**(V3 第 61 票)。
//
// 「有哪些维度」由 @ihui/shared/chat/mention-engine 的 MENTION_DIMENSIONS 一张表决定;
// 本文件只回答「这个维度在 web 上长什么样(图标 + 强调色)」—— 图标一律 lucide-react
// (AGENTS §4 图标统一),色沿用 # 侧九类既有档位,不新增色值。
// 禁止在这里再声明一份维度清单:那正是本票要消除的「两个组件各写一遍」。

import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  CircleAlert,
  Code,
  Code2,
  Database,
  File,
  FileText,
  Folder,
  FolderOpen,
  Globe,
  History,
  ScrollText,
  Terminal,
} from 'lucide-react'

import {
  findDimension,
  MENTION_DIMENSIONS,
  type MentionSelection,
} from '@ihui/shared/chat/mention-engine'

export interface MentionDimensionView {
  icon: LucideIcon
  /** 图标着色类(仅用于浮层列表与 chip,沿用既有档) */
  colorClass: string
}

/** dimensionId → 外观。键集与引擎表逐一对应(由下方自检式常量在开发期兜住)。 */
const VIEWS: Record<string, MentionDimensionView> = {
  // @ 五类:检索类沿用与 # 侧同族的语义图标,保持同一维度在两侧同脸
  'at-file': { icon: File, colorClass: 'text-sky-500' },
  'at-folder': { icon: Folder, colorClass: 'text-amber-500' },
  'at-symbol': { icon: Code, colorClass: 'text-violet-500' },
  'at-database': { icon: Database, colorClass: 'text-emerald-500' },
  'at-web': { icon: Globe, colorClass: 'text-cyan-500' },
  // # 九类:沿用搬入引擎表之前的原色值,零观感变更
  'hash-file': { icon: FileText, colorClass: 'text-sky-500' },
  'hash-folder': { icon: FolderOpen, colorClass: 'text-amber-500' },
  'hash-code': { icon: Code2, colorClass: 'text-violet-500' },
  'hash-problems': { icon: CircleAlert, colorClass: 'text-rose-500' },
  'hash-terminal': { icon: Terminal, colorClass: 'text-emerald-500' },
  'hash-web': { icon: Globe, colorClass: 'text-cyan-500' },
  'hash-doc': { icon: BookOpen, colorClass: 'text-indigo-500' },
  'hash-pastChats': { icon: History, colorClass: 'text-purple-500' },
  'hash-rule': { icon: ScrollText, colorClass: 'text-orange-500' },
}

const FALLBACK_VIEW: MentionDimensionView = { icon: FileText, colorClass: 'text-muted-foreground' }

/** 引擎表里存在而本表缺外观的维度(= 新增维度忘配图标)。为空是常态;非空只报数不崩。 */
export function dimensionsMissingView(): string[] {
  return MENTION_DIMENSIONS.filter((d) => !VIEWS[d.id]).map((d) => d.id)
}

export function viewOfDimensionId(dimensionId: string): MentionDimensionView {
  return VIEWS[dimensionId] ?? FALLBACK_VIEW
}

/** 已选提及的外观:先按维度取,维度已被从表里删掉时回落(不抛错,只掉外观)。 */
export function viewOfSelection(selection: MentionSelection): MentionDimensionView {
  const dim = findDimension(selection.dimensionId)
  return viewOfDimensionId(dim?.id ?? selection.dimensionId)
}
