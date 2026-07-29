import * as React from 'react'
import {
  Bug,
  TestTube,
  RefreshCw,
  Wand2,
  Package,
  BookMarked,
  X,
  Code,
  Power,
  Timer,
} from 'lucide-react'

import type { ArgSuggestion } from '@/components/ai/slash-command-palette'

/** /goal 命令参数候选模板(2026-07-29 二次深化,内置常见 goal 目标条件)
 * 参考 AGENTS.md §8 goal 模式工作流示例 + AI 编程主流场景
 * label:候选标签(简短)
 * description:候选描述(详细说明目标条件)
 * insertText:选中后填充到 textarea 的完整文本(含 /goal 前缀)
 * icon:候选图标(覆盖默认 Sparkles)
 * 注:用 React.createElement 而非 JSX,因 task 指定 .ts 扩展名(纯数据文件) */
const iconCls = 'h-3.5 w-3.5'

export const GOAL_ARG_TEMPLATES: ArgSuggestion[] = [
  {
    label: '修复所有 TypeScript 错误',
    description: '运行 pnpm typecheck,修复所有报错直到全绿(命令退出码 0)',
    insertText: '/goal 运行 pnpm typecheck 修复所有 TypeScript 错误,直到命令退出码为 0',
    icon: React.createElement(Bug, { className: iconCls }),
  },
  {
    label: '通过所有单元测试',
    description: '运行 pnpm test,修复失败用例直到全部通过',
    insertText: '/goal 运行 pnpm test,修复所有失败的单元测试用例直到全部通过',
    icon: React.createElement(TestTube, { className: iconCls }),
  },
  {
    label: '重构模块消除重复',
    description: '识别重复代码,抽取共享工具函数,保持行为不变',
    insertText: '/goal 识别项目中的重复代码,抽取共享工具函数,保持行为不变',
    icon: React.createElement(RefreshCw, { className: iconCls }),
  },
  {
    label: '完成 lint 全绿',
    description: '运行 pnpm lint,修复所有 lint 错误和警告',
    insertText: '/goal 运行 pnpm lint,修复所有 lint 错误和警告直到全绿',
    icon: React.createElement(Wand2, { className: iconCls }),
  },
  {
    label: '迁移功能到共享层',
    description: '把端独占组件上提到 packages/app,多端复用,保持行为一致',
    insertText: '/goal 把端独占组件上提到 packages/app 共享层,多端复用,保持行为一致',
    icon: React.createElement(Package, { className: iconCls }),
  },
  {
    label: '深度对标某产品交互',
    description: '参考目标产品交互细节,逐项对齐实现,自验 4 状态',
    insertText:
      '/goal 深度对标目标产品的交互细节,逐项对齐实现,自验默认/hover/active/dark mode 4 状态',
    icon: React.createElement(BookMarked, { className: iconCls }),
  },
  {
    label: '清理死代码',
    description: '扫描未引用的导出/组件/工具函数,确认无依赖后删除',
    insertText: '/goal 扫描项目中未引用的导出/组件/工具函数,确认无依赖后删除',
    icon: React.createElement(X, { className: iconCls }),
  },
  {
    label: '补全 E2E 测试',
    description: '为关键路径补全 E2E 测试,覆盖率提升到 80%+',
    insertText: '/goal 为关键路径补全 E2E 测试,覆盖率提升到 80% 以上',
    icon: React.createElement(Code, { className: iconCls }),
  },
]

/** /loop 命令参数候选(2026-07-29 二次深化,on/off/N 三选项 + 常用迭代次数) */
export const LOOP_ARG_OPTIONS: ArgSuggestion[] = [
  {
    label: '开启循环',
    description: '开启循环执行模式,AI 将持续迭代直到目标达成',
    insertText: '/loop on',
    icon: React.createElement(Power, { className: iconCls }),
  },
  {
    label: '关闭循环',
    description: '关闭循环执行模式,恢复单次执行',
    insertText: '/loop off',
    icon: React.createElement(Power, { className: iconCls }),
  },
  {
    label: '循环 5 次',
    description: '设置最大迭代次数为 5',
    insertText: '/loop 5',
    icon: React.createElement(Timer, { className: iconCls }),
  },
  {
    label: '循环 10 次',
    description: '设置最大迭代次数为 10',
    insertText: '/loop 10',
    icon: React.createElement(Timer, { className: iconCls }),
  },
  {
    label: '循环 20 次',
    description: '设置最大迭代次数为 20(高风险,需人工监督)',
    insertText: '/loop 20',
    icon: React.createElement(Timer, { className: iconCls }),
  },
]
