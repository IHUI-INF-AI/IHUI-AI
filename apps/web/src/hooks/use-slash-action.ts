'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from '@/components/common'

import type { AiSkillMeta } from '@ihui/api-client/endpoints/ai-skills'
import { PROMPT_TEMPLATE_IDS } from '@/components/chat/prompt-template-data'

/** WebInputCore 句柄 — 与 message-input.tsx 中的 WebInputCoreHandle 契约一致
 * 这里独立声明(不依赖 message-input.tsx)以避免 hook 反向依赖组件,符合 hooks/ 目录
 * "被组件依赖"的方向性。如果未来需要扩展(resize/scrollTo),同步更新两处。 */
export interface SlashActionInputCoreHandle {
  focus: () => void
  setSelectionRange: (start: number, end: number) => void
  resize: () => void
}

/** PromptTemplate 类型契约 — 与 @/components/ai/prompt-templates 的 Template 一致
 * id 来自 PROMPT_TEMPLATE_IDS,name/content 是 i18n 翻译后的展示文案。
 * 独立导出方便 message-input.tsx 的 props 标注。 */
export interface PromptTemplate {
  id: string
  name: string
  content: string
  category?: string
}

// i18n key 映射表(扁平结构,与 message-list 空状态共用同一组 key)
const TPL_NAME_KEY_MAP: Record<string, string> = {
  summary: 'tplSummary',
  translate: 'tplTranslate',
  explain: 'tplExplain',
  code: 'tplCode',
  polish: 'tplPolish',
}

const TPL_CONTENT_KEY_MAP: Record<string, string> = {
  summary: 'tplSummaryContent',
  translate: 'tplTranslateContent',
  explain: 'tplExplainContent',
  code: 'tplCodeContent',
  polish: 'tplPolishContent',
}

/** /permission 切换 toast 首弹记录(2026-07-25 深化,从 message-input.tsx 迁移):
 * 每个子命令模式只 toast 一次,持久化到 localStorage(跨刷新/跨标签页也只弹一次)。
 * 用 set 序列化存,key 形如 "ask,auto,full" 表示已提示过的模式集合。 */
const PERMISSION_TOAST_KEY = 'ihui:permission-toast-shown'

/**
 * 斜杠命令动作 hook(2026-07-29 提取自 message-input.tsx)
 *
 * 职责:
 * - 构造 promptTemplates(供 <PromptTemplates templates={...} /> 使用)
 * - 提供 handleCommandSelect(用户选中斜杠命令项的回调)
 * - 提供 handleCommandArgsSelect(参数补全模式选中候选项的回调)
 *
 * 数据流:
 * - 入参:setInputValue(写入 textarea)+ aiSkills(skill 列表,当前 handler 不直接消费,
 *   保留为 hook 签名的一部分以便未来扩展)+ inputCoreRef(focus/resize 句柄)
 *   + onSend(动作型命令的提交回调)
 * - 出参:{ promptTemplates, handleCommandSelect, handleCommandArgsSelect }
 *
 * 关键边界:
 * - 动作型命令(plan/act/build/review/spec/permission-*):清空 textarea + 走 onSend,
 *   由 use-chat.ts 的 tryHandlePlanModeSlash / tryHandleChatModeSlash / tryHandlePermissionSlash 拦截
 * - /permission 切换 toast:每个模式只弹一次,持久化到 localStorage
 * - skill 命令 id 形如 "skill-<skillId>",填充 "/skill <skillName> " 到 textarea
 * - 其他模板命令:填充 commandTemplates[id](含 /goal /loop /summary /translate /...)
 * - 参数补全模式:用户选中候选项后直接填充 insertText,不自动发送
 *
 * 与其他 hook 的协作:
 * - useSlashCommands(同批 2026-07-29 提取):提供 slashCommands 给 <SlashCommandPalette>
 * - usePermissionModeCycle(同批 2026-07-29 提取):权限模式循环切换独立 hook,本 hook 只处理 toast
 */
export function useSlashAction(
  setInputValue: (v: string) => void,
  // FIXME(any): aiSkills 留作未来 skill 描述/分类查询扩展,先用 void 消费以满足 TS6133
   
  aiSkills: AiSkillMeta[],
  inputCoreRef: React.RefObject<SlashActionInputCoreHandle | null>,
  onSend: (content: string) => Promise<boolean> | boolean,
): {
  promptTemplates: PromptTemplate[]
  handleCommandSelect: (id: string) => void
  handleCommandArgsSelect: (_commandId: string, insertText: string) => void
} {
  const t = useTranslations('chat')

  // FIXME(any): 临时消费 aiSkills 以满足 TS6133,见函数签名注释
  void aiSkills

  // /permission 切换 toast 首弹记录(2026-07-25 深化):每个子命令模式只 toast 一次,
  // 持久化到 localStorage(跨刷新/跨标签页也只弹一次)。
  // React.useRef 不支持 lazy initializer(那是 useState 才有的),改用空 set + useEffect mount 填充
  const permissionToastShownRef = React.useRef<Set<string>>(new Set())
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(PERMISSION_TOAST_KEY)
      if (!raw) return
      permissionToastShownRef.current = new Set(raw.split(',').filter(Boolean))
    } catch {
      // 静默
    }
  }, [])
  const markPermissionToastShown = React.useCallback((mode: string) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(
        PERMISSION_TOAST_KEY,
        [...permissionToastShownRef.current, mode].join(','),
      )
    } catch {
      // 静默
    }
  }, [])

  // 斜杠命令填充文本映射(2026-07-29 提取自 message-input.tsx)
  // - /goal /loop 命令:填充命令到 textarea 让用户继续输入参数
  //   点击后 textarea 内容为 "/goal " 或 "/loop ",光标在末尾,用户输入参数后 Enter 发送
  //   后端 ai-service slash_commands.py 的 _goal_handler / _loop_handler 负责实际处理
  // - 其他模板命令:填充完整提示词文本,用户可直接 Enter 发送
  const commandTemplates = React.useMemo<Record<string, string>>(
    () => ({
      goal: '/goal ',
      loop: '/loop ',
      summary: t('cmdSummary'),
      translate: t('cmdTranslate'),
      explain: t('cmdExplain'),
      code: t('cmdCode'),
      polish: t('cmdPolish'),
      'wechat-article': t('cmdWechatArticle'),
      'koubo-script': t('cmdKouboScript'),
    }),
    [t],
  )

  // i18n key 为扁平结构(tplSummary / tplSummaryContent),与 message-list 空状态共用同一组 key,
  // 保证附加栏弹窗与空状态 chips 显示的模板内容完全一致。
  const promptTemplates = React.useMemo<PromptTemplate[]>(
    () =>
      PROMPT_TEMPLATE_IDS.map((id) => ({
        id,
        name: t(TPL_NAME_KEY_MAP[id] ?? id),
        content: t(TPL_CONTENT_KEY_MAP[id] ?? id),
      })),
    [t],
  )

  /** 填充文本到 textarea 并聚焦(2026-07-29 提取自 message-input.tsx)
   * - setInputValue 写入内容
   * - requestAnimationFrame 等待 React 提交 DOM 后再 focus + setSelectionRange + resize
   *   确保光标定位在文本末尾,textarea 高度自适应 */
  const fillInput = React.useCallback(
    (text: string) => {
      setInputValue(text)
      requestAnimationFrame(() => {
        inputCoreRef.current?.focus()
        inputCoreRef.current?.setSelectionRange(text.length, text.length)
        inputCoreRef.current?.resize()
      })
    },
    [setInputValue, inputCoreRef],
  )

  /** 斜杠命令选中回调(2026-07-29 提取自 message-input.tsx)
   * 动作型命令(plan/act/build/review/spec/permission-*):直接走 onSend 流程,
   * 由 use-chat.ts 的 tryHandlePlanModeSlash / tryHandleChatModeSlash / tryHandlePermissionSlash 拦截。
   * 不填充 textarea,避免用户看到 "/plan" 文字再手动按发送(多余操作)。 */
  const handleCommandSelect = React.useCallback(
    (id: string) => {
      // 动作型命令(2026-07-25 立):直接走 onSend 流程
      if (
        id === 'plan' ||
        id === 'act' ||
        // ChatMode 4态动作型命令(2026-07-28 立,补全三通道):
        // /build /review /spec 走 onSend,由 use-chat.ts 的 tryHandleChatModeSlash 拦截
        id === 'build' ||
        id === 'review' ||
        id === 'spec' ||
        // 权限模式动作型命令(2026-07-25 深化):/permission ask|auto|full 走 onSend
        // 由 use-chat.ts 的 tryHandlePermissionSlash 拦截(纯本地 UI 状态切换,无 LLM)
        id === 'permission-ask' ||
        id === 'permission-auto' ||
        id === 'permission-full'
      ) {
        // /permission 切换 toast(2026-07-25 深化):仅每个模式首次弹一次,
        // 提醒用户已切换并显示完整模式名,避免反复刷屏。用 useRef 跨渲染持久,
        // 用户后续再用同一子命令不再弹(避免噪音)。
        if (id.startsWith('permission-')) {
          const mode = id.replace('permission-', '')
          if (!permissionToastShownRef.current.has(mode)) {
            permissionToastShownRef.current.add(mode)
            // 持久化到 localStorage(2026-07-25 二次深化):跨刷新/跨标签页也只弹一次
            markPermissionToastShown(mode)
            const key =
              mode === 'ask'
                ? 'permission.switchedToModeAsk'
                : mode === 'auto'
                  ? 'permission.switchedToModeAuto'
                  : 'permission.switchedToModeFull'
            toast.success(t(key), { duration: 2500 })
          }
        }
        // 清空当前 textarea 内容再发送,避免与已有内容拼接
        setInputValue('')
        requestAnimationFrame(() => inputCoreRef.current?.resize())
        void onSend(`/${id.replace('-', ' ')}`)
        return
      }
      // skill 命令(2026-07-29 二次深化):id 形如 "skill-<skillId>",
      // 填充 "/skill <skillName> " 到 textarea 让用户确认或追加参数
      if (id.startsWith('skill-')) {
        const skillName = id.slice('skill-'.length)
        fillInput(`/skill ${skillName} `)
        return
      }
      fillInput(commandTemplates[id] ?? '')
    },
    // aiSkills 列入依赖数组(2026-07-29 预留):当前 handleCommandSelect 通过 id 前缀识别 skill 命令,
    // skillName 从 id 切片获取;未来若需要根据 aiSkills 查找 skill 描述/分类等元数据,
    // 依赖数组已就位,无需再改 hook 签名
    [
      t,
      fillInput,
      setInputValue,
      onSend,
      inputCoreRef,
      commandTemplates,
      markPermissionToastShown,
      aiSkills,
    ],
  )

  /** 参数补全模式选择回调(2026-07-29 二次深化)
   * 用户在参数补全模式下选中候选项时触发,直接填充 insertText 到 textarea
   * 不自动发送,让用户确认后按 Enter 发送(避免误触)
   * commandId 参数保留以匹配 SlashCommandPalette onSelectArgs 签名,当前实现不使用 */
  const handleCommandArgsSelect = React.useCallback(
    (_commandId: string, insertText: string) => {
      fillInput(insertText)
    },
    [fillInput],
  )

  return { promptTemplates, handleCommandSelect, handleCommandArgsSelect }
}
