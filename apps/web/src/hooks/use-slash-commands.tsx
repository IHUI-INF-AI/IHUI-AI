'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  BookOpen,
  FileText,
  Hammer,
  Repeat,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react'

import type { AiSkillMeta } from '@ihui/api-client/endpoints/ai-skills'
import type { SlashCommandPalette } from '@/components/ai/slash-command-palette'
import {
  GOAL_ARG_TEMPLATES,
  LOOP_ARG_OPTIONS,
} from '@/components/chat/command-arg-templates'
import { SLASH_COMMAND_IDS } from '@/components/chat/slash-command-data'

/** 斜杠命令 i18n key 映射(2026-07-29 提取自 message-input.tsx)
 * key 为 SLASH_COMMAND_IDS 中的命令 id,value 为 chat namespace 下的 i18n key
 * 未命中时回退到 id 本身(原组件行为保持一致) */
const SLASH_CMD_KEY_MAP: Record<string, string> = {
  summary: 'slashCmd.summary',
  translate: 'slashCmd.translate',
  explain: 'slashCmd.explain',
  code: 'slashCmd.code',
  polish: 'slashCmd.polish',
  'wechat-article': 'slashCmd.wechat-article',
  'koubo-script': 'slashCmd.koubo-script',
}

/** 复用 SlashCommandPalette 的 commands 元素类型,保持与下游契约一致
 * (slash-command-palette.tsx 中 Command 接口未导出,通过 ComponentProps 反推) */
type SlashCommand = React.ComponentProps<typeof SlashCommandPalette>['commands'][number]

/**
 * 斜杠命令列表 hook(2026-07-29 提取自 message-input.tsx)
 *
 * 职责:
 * - 构造 / 触发的完整斜杠命令列表,覆盖 5 大分组(目标与循环 / 模式切换 / 权限管理 / AI 技能 / 内容模板)
 * - 通过 useMemo 缓存,依赖 [t, aiSkills, skillsLoading];组件重渲不重新构造,只翻译语言或
 *   skills 列表变化时重建
 *
 * 数据流:
 * - 入参:aiSkills(/api/ai-skills 拉取的技能列表)+ skillsLoading(加载中标记)
 * - 出参:SlashCommand[] 直接喂给 <SlashCommandPalette commands={...} />
 *
 * 关键边界:
 * - /goal /loop 走"参数补全模式",argsSuggestions 引用 command-arg-templates.ts 中的静态候选
 * - skill 命令 id 形如 "skill-<skillId>",handler 据此前缀识别并填充 /skill <name> 模板
 * - permission-* 子命令被 use-chat.ts 的 tryHandlePermissionSlash 拦截,纯本地 UI 状态切换
 * - 翻译函数使用 'chat' namespace(与原组件一致)
 */
export function useSlashCommands(
  aiSkills: AiSkillMeta[],
  skillsLoading: boolean,
): SlashCommand[] {
  const t = useTranslations('chat')
  return React.useMemo<SlashCommand[]>(
    () => [
      // 🎯 目标与循环(2026-07-29 立,置顶重点:AI 编程最主流的命令)
      // 2026-07-29 二次深化:加 argsSuggestions,点击后进入参数补全模式
      // /goal <目标条件>:设定当前会话目标,AI 围绕目标执行(对标 AGENTS.md §8 goal 模式工作流)
      // /loop on|off|N:设置循环执行模式(对标 ai-service slash_commands.py _loop_handler)
      {
        id: 'goal',
        label: '/goal',
        description: t('slashCmd.goal'),
        usage: '/goal <目标>',
        kind: 'template' as const,
        category: 'goal' as const,
        icon: <Target className="h-4 w-4" />,
        hasArgs: true,
        argsTitle: t('slashCmd.goalArgTitle'),
        argsSuggestions: GOAL_ARG_TEMPLATES,
      },
      {
        id: 'loop',
        label: '/loop',
        description: t('slashCmd.loop'),
        usage: '/loop on|off|N',
        kind: 'template' as const,
        category: 'goal' as const,
        icon: <Repeat className="h-4 w-4" />,
        hasArgs: true,
        argsTitle: t('slashCmd.loopArgTitle'),
        argsSuggestions: LOOP_ARG_OPTIONS,
      },
      // ⚡ 模式切换(2026-07-25 立,对标 Trae SOLO Plan 模式):切换 plan/act 模式
      {
        id: 'plan',
        label: '/plan',
        description: t('slashCmd.plan'),
        kind: 'action' as const,
        category: 'mode' as const,
        icon: <BookOpen className="h-4 w-4" />,
      },
      {
        id: 'act',
        label: '/act',
        description: t('slashCmd.act'),
        kind: 'action' as const,
        category: 'mode' as const,
        icon: <Hammer className="h-4 w-4" />,
      },
      // 对话模式动作型命令(2026-07-28 立,补全 ChatMode 4态三通道):
      // /build /review /spec 切换 ChatMode,/plan /act 同时联动 ChatMode 和 Plan/Act
      {
        id: 'build',
        label: '/build',
        description: t('slashCmd.build'),
        kind: 'action' as const,
        category: 'mode' as const,
        icon: <Hammer className="h-4 w-4" />,
      },
      {
        id: 'review',
        label: '/review',
        description: t('slashCmd.review'),
        kind: 'action' as const,
        category: 'mode' as const,
        icon: <Search className="h-4 w-4" />,
      },
      {
        id: 'spec',
        label: '/spec',
        description: t('slashCmd.spec'),
        kind: 'action' as const,
        category: 'mode' as const,
        icon: <FileText className="h-4 w-4" />,
      },
      // 🔐 权限管理(2026-07-25 深化,深度对标 Codex approvalMode CLI):
      // /permission ask|auto|full 切换工作区权限模式(不进入 LLM 流,纯本地 UI 状态)
      // description 用 \n 拼接短描述 + 用法提示(2026-07-25 深化,提示用户支持的 3 个子命令)
      {
        id: 'permission-ask',
        label: '/permission ask',
        description: `${t('slashCmd.permissionAsk')}\n${t('permission.usageHint')}`,
        kind: 'action' as const,
        category: 'permission' as const,
        icon: <Shield className="h-4 w-4" />,
      },
      {
        id: 'permission-auto',
        label: '/permission auto',
        description: `${t('slashCmd.permissionAuto')}\n${t('permission.usageHint')}`,
        kind: 'action' as const,
        category: 'permission' as const,
        icon: <ShieldCheck className="h-4 w-4" />,
      },
      {
        id: 'permission-full',
        label: '/permission full',
        description: `${t('slashCmd.permissionFull')}\n${t('permission.usageHint')}`,
        kind: 'action' as const,
        category: 'permission' as const,
        icon: <ShieldAlert className="h-4 w-4" />,
      },
      // ✨ AI 技能(2026-07-29 二次深化,从 /api/ai-skills 异步拉取,接入斜杠命令弹窗)
      // 每个 skill 一项,点击后填充 /skill <name> 到 textarea,后端 _skill_handler 处理
      // loading 状态:skillsLoading=true 时所有 skill 项标记 loading,弹窗分组标题显示 spinner
      ...aiSkills.map((skill) => ({
        id: `skill-${skill.id}`,
        label: `/skill ${skill.name}`,
        description: skill.description,
        usage: `/skill ${skill.name}`,
        kind: 'template' as const,
        category: 'skill' as const,
        icon: <Sparkles className="h-4 w-4" />,
        hasArgs: false,
        loading: skillsLoading,
      })),
      // 📝 内容模板:选命令后填充模板到 textarea
      ...SLASH_COMMAND_IDS.map((id) => ({
        id,
        label: `/${id}`,
        description: t(SLASH_CMD_KEY_MAP[id] ?? id),
        kind: 'template' as const,
        category: 'template' as const,
        icon: <Sparkles className="h-4 w-4" />,
      })),
    ],
    [t, aiSkills, skillsLoading],
  )
}
