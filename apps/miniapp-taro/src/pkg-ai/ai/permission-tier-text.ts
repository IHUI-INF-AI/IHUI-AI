// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { PERMISSION_TIER_WORD_KEYS } from '@ihui/shared/chat'
import type { PermissionTierDisplayKey } from '@ihui/shared/chat'
import { permissionModeDisplayKey } from '@ihui/types/permission-mode'
import type { ToolApprovalScope } from '@ihui/types'

// D111:小程序端权限档行文案解析(档名 + 后果说明)。
//
// 取词走共享注册表(PERMISSION_TIER_WORD_KEYS,键与 @ihui/types 的 wire 拼写一致),
// 措辞走端内 permissionTier.* 命名空间,禁止把后端英文枚举直接贴到界面。
// 缺键时用端内中文常量兜底(词表由主 agent 统一插入+跑 parity,插入前/压缩包过期时
// 行内仍显示中文,不渲染 "permissionTier.mode.x.title" 这类 raw key)。
//
// 数据源现状:chat 流里没有 permissionMode 字段,小程序历史走本机 localStorage
// (ChatMessage 无 metadata),服务端会话尚未接入 —— 本端当前只读工作区默认档
// (getWorkspacePermissionDefault),G-165① 的消息级盖章(metadata.permissionMode)
// 待服务端会话接入后套用同一解析函数叠加(盖章值 > 默认档,皆缺整行隐藏)。

/** 带回退的取词函数(与 useTt 同签名,便于组件直接传入 tt)。 */
export type TranslateWithFallback = (key: string, fallback: string) => string

export interface PermissionTierText {
  label: string
  title: string
  desc: string
}

/** 端内中文兜底:与 miniapp-taro 词表 zh-CN 的 permissionTier 逐字一致(只读镜像,不改词表)。 */
export const PERMISSION_TIER_FALLBACK_LABEL = '权限档'

export const PERMISSION_TIER_FALLBACK_TEXT: Readonly<
  Record<PermissionTierDisplayKey, { title: string; desc: string }>
> = {
  default: { title: '默认模式', desc: '全部操作需人工确认,最安全' },
  plan: { title: '只读计划', desc: '仅允许读取与检索,写文件与执行命令一律拒绝' },
  'accept-edits': { title: '接受编辑', desc: '白名单内的操作自动放行,其他需确认' },
  'bypass-permissions': { title: '绕过权限', desc: '完全访问,无任何确认(高风险)' },
  unknown: { title: '未知模式', desc: '未识别的权限模式,已按默认档处理' },
}

/**
 * 任意存储/接口值 → 行内三段文案。
 * - 未配置(null/undefined)→ default(生效行为即默认档,如实显示);
 * - 认不出 → unknown(绝不静默显示成 default,防授权误导);
 * - 词表缺键 → 端内中文兜底(不渲染 raw key,不抛错)。
 */
export function resolvePermissionTierText(
  mode: string | null | undefined,
  translate: TranslateWithFallback,
): PermissionTierText {
  const tier: PermissionTierDisplayKey = permissionModeDisplayKey(mode)
  const keys = PERMISSION_TIER_WORD_KEYS[tier]
  const fallback = PERMISSION_TIER_FALLBACK_TEXT[tier]
  return {
    label: translate('permissionTier.label', PERMISSION_TIER_FALLBACK_LABEL),
    title: translate(keys.title, fallback.title),
    desc: translate(keys.desc, fallback.desc),
  }
}

// ---------------------------------------------------------------------------
// D111 残余(2026-10-01 补齐纯逻辑层,由 D136 会话顺手落):ChatMessageItem 审批三键的
// 取词/wire 值层。**只有这一层** —— 消息行上的渲染接线(ChatMessageItem 三键 + 回传)
// 属 D111 票面本部,本票不代做;这一层先落是为了让常驻测试的纯逻辑块可跑、tsc 可归零。
// 三键 wire 值与 D136/tool-approval-card 同一口径:批准必带 scope,拒绝不带 scope
//(拒绝是一次判定,不落任何授权)。
// ---------------------------------------------------------------------------

/** 审批三键(允许一次 / 始终允许 / 拒绝)的 wire 值与取词键。 */
export interface ApprovalAction {
  id: 'allowOnce' | 'alwaysAllow' | 'reject'
  decision: 'approve' | 'reject'
  /** 仅 approve 有值;reject 恒 undefined(拒绝不落任何授权) */
  scope?: ToolApprovalScope
  /** 共享词包键(editor.toolApproval.*,与 web/D136 同一把) */
  key: string
  /** 词包缺键时的端内中文兜底 */
  fallback: string
}

export const APPROVAL_ACTIONS: readonly ApprovalAction[] = [
  {
    id: 'allowOnce',
    decision: 'approve',
    scope: 'once',
    key: 'editor.toolApproval.scopeOnce',
    fallback: '允许一次',
  },
  {
    id: 'alwaysAllow',
    decision: 'approve',
    scope: 'always',
    key: 'editor.toolApproval.scopeAlways',
    fallback: '始终允许',
  },
  {
    id: 'reject',
    decision: 'reject',
    key: 'editor.toolApproval.reject',
    fallback: '拒绝',
  },
]

/** 三键取词:词表完备走本地化值,缺键回落端内中文,绝不吐 raw key。 */
export function resolveApprovalActionLabels(
  translate: TranslateWithFallback,
): Array<{ id: ApprovalAction['id']; decision: ApprovalAction['decision']; scope?: ToolApprovalScope; label: string }> {
  return APPROVAL_ACTIONS.map((action) => {
    const label = translate(action.key, action.fallback)
    return {
      id: action.id,
      decision: action.decision,
      ...(action.scope !== undefined ? { scope: action.scope } : {}),
      label: label === action.key ? action.fallback : label,
    }
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
