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
 * label/description:走 i18n(chat.commandArg.* namespace),由调用方传 t
 * insertText:选中后填充到 textarea 的完整文本(含 /goal 前缀,保持中文,发送给 AI)
 * icon:候选图标(覆盖默认 Sparkles)
 * 注:用 React.createElement 而非 JSX,因 task 指定 .ts 扩展名(纯数据文件) */
const iconCls = 'h-3.5 w-3.5'

/** 创建 /goal 命令参数候选(工厂函数,接受 t 进行 i18n 翻译) */
export function createGoalArgTemplates(t: (key: string) => string): ArgSuggestion[] {
  return [
    {
      label: t('commandArg.goalFixTs.label'),
      description: t('commandArg.goalFixTs.description'),
      insertText: '/goal 运行 pnpm typecheck 修复所有 TypeScript 错误,直到命令退出码为 0',
      icon: React.createElement(Bug, { className: iconCls }),
    },
    {
      label: t('commandArg.goalPassTests.label'),
      description: t('commandArg.goalPassTests.description'),
      insertText: '/goal 运行 pnpm test,修复所有失败的单元测试用例直到全部通过',
      icon: React.createElement(TestTube, { className: iconCls }),
    },
    {
      label: t('commandArg.goalRefactor.label'),
      description: t('commandArg.goalRefactor.description'),
      insertText: '/goal 识别项目中的重复代码,抽取共享工具函数,保持行为不变',
      icon: React.createElement(RefreshCw, { className: iconCls }),
    },
    {
      label: t('commandArg.goalLint.label'),
      description: t('commandArg.goalLint.description'),
      insertText: '/goal 运行 pnpm lint,修复所有 lint 错误和警告直到全绿',
      icon: React.createElement(Wand2, { className: iconCls }),
    },
    {
      label: t('commandArg.goalMigrateShared.label'),
      description: t('commandArg.goalMigrateShared.description'),
      insertText: '/goal 把端独占组件上提到 packages/app 共享层,多端复用,保持行为一致',
      icon: React.createElement(Package, { className: iconCls }),
    },
    {
      label: t('commandArg.goalBenchmark.label'),
      description: t('commandArg.goalBenchmark.description'),
      insertText:
        '/goal 深度对标目标产品的交互细节,逐项对齐实现,自验默认/hover/active/dark mode 4 状态',
      icon: React.createElement(BookMarked, { className: iconCls }),
    },
    {
      label: t('commandArg.goalDeadCode.label'),
      description: t('commandArg.goalDeadCode.description'),
      insertText: '/goal 扫描项目中未引用的导出/组件/工具函数,确认无依赖后删除',
      icon: React.createElement(X, { className: iconCls }),
    },
    {
      label: t('commandArg.goalE2e.label'),
      description: t('commandArg.goalE2e.description'),
      insertText: '/goal 为关键路径补全 E2E 测试,覆盖率提升到 80% 以上',
      icon: React.createElement(Code, { className: iconCls }),
    },
  ]
}

/** 创建 /loop 命令参数候选(工厂函数,接受 t 进行 i18n 翻译) */
export function createLoopArgOptions(t: (key: string) => string): ArgSuggestion[] {
  return [
    {
      label: t('commandArg.loopOn.label'),
      description: t('commandArg.loopOn.description'),
      insertText: '/loop on',
      icon: React.createElement(Power, { className: iconCls }),
    },
    {
      label: t('commandArg.loopOff.label'),
      description: t('commandArg.loopOff.description'),
      insertText: '/loop off',
      icon: React.createElement(Power, { className: iconCls }),
    },
    {
      label: t('commandArg.loop5.label'),
      description: t('commandArg.loop5.description'),
      insertText: '/loop 5',
      icon: React.createElement(Timer, { className: iconCls }),
    },
    {
      label: t('commandArg.loop10.label'),
      description: t('commandArg.loop10.description'),
      insertText: '/loop 10',
      icon: React.createElement(Timer, { className: iconCls }),
    },
    {
      label: t('commandArg.loop20.label'),
      description: t('commandArg.loop20.description'),
      insertText: '/loop 20',
      icon: React.createElement(Timer, { className: iconCls }),
    },
  ]
}
