// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius } from '@ihui/design-tokens'

// 对话流交代区(RN 端共享组件):引用来源 + 本轮上下文注入。
//
// 为什么单独成文件:`CitationList` / `InjectionDisclosure` 最早是 `AiAssistantN8nScreen.tsx`
// 里的局部函数,`ChatScreen` 要接同一批 SSE 帧时只有两条路 —— 再抄一份(违 §3 共享层优先,
// 且两处措辞/样式必然漂移)或抽成组件。这里选后者,并让取词键也从 `aiAssistantN8n.*`
// 抬到 `chatDisclosure.*`(交代区不再是 N8n 屏专属,命名空间跟着归属走)。
import { useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { ChevronDown, ChevronRight, Zap } from 'lucide-react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { sendToolApprovalResponse } from '@ihui/api-client'
import { useI18n } from '../i18n'
import { rpx } from '../utils/rpx'
import type { MessageCitation, MessageInjection, SteerNotice } from '../utils/chat-render-model'
import { permissionTierWordKeys } from '@ihui/shared/chat'

/**
 * 引用来源列表:来源标签 + 条目文字。
 * 只有 **http(s)** 外链才给跳转(仓库相对路径在手机端没有可打开的目标,给了就是死链)。
 */
export function CitationList({
  items,
}: {
  items: readonly MessageCitation[]
}): React.JSX.Element | null {
  const { t } = useI18n()
  if (!items.length) return null
  return (
    <View style={disclosureStyles.block}>
      <Text style={disclosureStyles.blockTitle}>{t('chatDisclosure.citationTitle')}</Text>
      {items.map((item, index) => {
        const url = item.url
        const external = typeof url === 'string' && /^https?:\/\//i.test(url)
        const body = (
          <>
            <Text style={disclosureStyles.meta}>{item.source}</Text>
            <Text style={disclosureStyles.text} numberOfLines={2}>
              {item.label}
            </Text>
          </>
        )
        return (
          <View key={`${item.source}_${index}`} style={disclosureStyles.card}>
            {external && url ? (
              <Pressable
                style={disclosureStyles.cardHead}
                accessibilityRole="link"
                accessibilityLabel={url}
                onPress={() => {
                  void Linking.openURL(url)
                }}
              >
                {body}
              </Pressable>
            ) : (
              <View style={disclosureStyles.cardHead}>{body}</View>
            )}
          </View>
        )
      })}
    </View>
  )
}

/** 注入来源 kind → 本端取词键(与 apps/ai-service llm.py 的 injection_frames 同源) */
const INJECTION_KIND_KEYS = {
  developer_instructions: 'chatDisclosure.kindDeveloper',
  workspace_memory: 'chatDisclosure.kindWorkspace',
  repo_wiki: 'chatDisclosure.kindRepoWiki',
  auto_context: 'chatDisclosure.kindAutoContext',
} as const

/** 注入交代条:一行一个来源;只有帧里确实带了 fullText 才给展开入口(不给假按钮) */
export function InjectionDisclosure({
  items,
}: {
  items: readonly MessageInjection[]
}): React.JSX.Element | null {
  const { t } = useI18n()
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({})
  if (!items.length) return null
  return (
    <View style={disclosureStyles.block}>
      <Text style={disclosureStyles.blockTitle}>{t('chatDisclosure.injectionTitle')}</Text>
      {items.map((item, index) => {
        const key = `${item.kind}_${index}`
        const open = openKeys[key] === true
        const kindKey =
          item.kind in INJECTION_KIND_KEYS
            ? INJECTION_KIND_KEYS[item.kind as keyof typeof INJECTION_KIND_KEYS]
            : undefined
        return (
          <View key={key} style={disclosureStyles.card}>
            <Pressable
              style={disclosureStyles.cardHead}
              onPress={() => setOpenKeys((prev) => ({ ...prev, [key]: !open }))}
              accessibilityRole="button"
              accessibilityLabel={item.collapsed}
            >
              {item.fullText ? (
                open ? (
                  <ChevronDown size={10} color={tokens.text.tertiary} />
                ) : (
                  <ChevronRight size={10} color={tokens.text.tertiary} />
                )
              ) : null}
              {/* 界面文本出自本端词表;后端中文 collapsed 仅在未知 kind 时兜底 */}
              <Text style={disclosureStyles.text}>{kindKey ? t(kindKey) : item.collapsed}</Text>
              {typeof item.count === 'number' ? (
                <Text style={disclosureStyles.meta}>{item.count}</Text>
              ) : null}
            </Pressable>
            {open && item.fullText ? (
              <View style={disclosureStyles.cardBody}>
                <Text style={disclosureStyles.text}>{item.fullText}</Text>
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

/** 单条引导文本的展示截断长度(对齐 web SteerNoticeBar STEER_NOTICE_PREVIEW_LIMIT:原文 ≤4000
 *  字符已入 LLM 上下文,交代侧只做预览) */
const STEER_NOTICE_PREVIEW_LIMIT = 120

/**
 * 引导交代条(D106 Steer 中途引导可视化):SSE steer 事件(phase='injected')回执,
 * 经 api-client onSteer → 屏内 appendSteerFrames 落到 assistant 消息上渲染本组件。
 * 形态对齐 web SteerNoticeBar:计数标题 + Zap 图标,正文为每条引导文本预览(超长截断)。
 */
export function SteerNoticeList({
  items,
}: {
  items: readonly SteerNotice[]
}): React.JSX.Element | null {
  const { t } = useI18n()
  if (!items.length) return null
  return (
    <View style={disclosureStyles.block}>
      <View style={disclosureStyles.steerHead}>
        <Zap size={10} color={tokens.text.tertiary} />
        <Text style={disclosureStyles.blockTitle}>
          {t('chatDisclosure.steerTitle', { count: items.length })}
        </Text>
      </View>
      {items.slice(0, 3).map((item, index) => (
        <View key={`steer_${index}`} style={disclosureStyles.card}>
          <View style={disclosureStyles.cardHead}>
            <Text style={disclosureStyles.text} numberOfLines={3}>
              {item.text.length > STEER_NOTICE_PREVIEW_LIMIT
                ? `${item.text.slice(0, STEER_NOTICE_PREVIEW_LIMIT)}…`
                : item.text}
            </Text>
          </View>
        </View>
      ))}
      {items.length > 3 ? (
        <Text style={disclosureStyles.meta}>
          {t('chatDisclosure.steerMore', { count: items.length - 3 })}
        </Text>
      ) : null}
    </View>
  )
}

/**
 * 权限档交代行(D111/G-165①):档名 + 该档会导致什么。
 *
 * 取词与 extension `WorkspacePermissionTierRow` / taro 页头行**同源**
 * (`permissionTierWordKeys` → `@ihui/types/permission-mode` 唯一真源),端内只负责排版。
 * `mode === null` 表示"消息未盖章且工作区默认档取数失败" —— 整行不渲染,
 * 不假装知道档位(认不出具体档位时由共享层归到 unknown,不会静默显示成默认档)。
 */
export function PermissionTierRow({
  mode,
}: {
  mode: string | null | undefined
}): React.JSX.Element | null {
  const { t } = useI18n()
  if (mode === null || mode === undefined) return null
  const text = permissionTierWordKeys(mode)
  return (
    <View style={disclosureStyles.tierRow}>
      <Text style={disclosureStyles.tierLabel}>{t('permissionTier.label')}</Text>
      <Text style={disclosureStyles.tierTitle}>{t(text.title)}</Text>
      <Text style={disclosureStyles.tierDesc}>{t(text.desc)}</Text>
    </View>
  )
}

/**
 * 审批三键 => 决策载荷的唯一映射(D111 残余)。
 * 单独立一张导出表并用测试钉死,防的是"改按钮文案时顺手改掉语义":
 * 拒绝不带 scope 键(拒绝不落任何授权,与 ToolApprovalSheet/web handleDecision 同形)。
 */
export const APPROVAL_ACTION_WIRE = {
  allowOnce: { decision: 'approve', scope: 'once' },
  alwaysAllow: { decision: 'approve', scope: 'always' },
  reject: { decision: 'reject' },
} as const

type ApprovalActionWire = (typeof APPROVAL_ACTION_WIRE)[keyof typeof APPROVAL_ACTION_WIRE]

/**
 * 工具审批三键行(D136 面板的行内同语义出口):
 * `request === null` 或该条已回传成功 ⇒ 整行不渲染(不给重复提交的机会);
 * 回传失败 ⇒ 留在原地,绝不静默当"已处理"。取词走既有 `toolApproval.*` / `common.cancel`,
 * 端内不新增第二份文案源。
 */
export function ToolApprovalRow({
  request,
  onResolved,
}: {
  request: { approvalId: string } | null
  onResolved?: (approvalId: string) => void
}): React.JSX.Element | null {
  const { t } = useI18n()
  const [resolvedId, setResolvedId] = useState<string | null>(null)
  if (request === null || resolvedId === request.approvalId) return null
  const respond = (wire: ApprovalActionWire): void => {
    void sendToolApprovalResponse({ approvalId: request.approvalId, ...wire })
      .then(() => {
        setResolvedId(request.approvalId)
        onResolved?.(request.approvalId)
      })
      .catch(() => {
        // 决策未能送出:行保持三键可重试(与 toolApproval.sendFailed 同一取向)
      })
  }
  return (
    <View style={disclosureStyles.approvalRow}>
      <Pressable style={disclosureStyles.approvalBtn} onPress={() => respond(APPROVAL_ACTION_WIRE.allowOnce)}>
        <Text style={disclosureStyles.approvalText}>{t('toolApproval.scopeOnce')}</Text>
      </Pressable>
      <Pressable style={disclosureStyles.approvalBtn} onPress={() => respond(APPROVAL_ACTION_WIRE.alwaysAllow)}>
        <Text style={disclosureStyles.approvalText}>{t('toolApproval.scopeAlways')}</Text>
      </Pressable>
      <Pressable style={disclosureStyles.approvalBtn} onPress={() => respond(APPROVAL_ACTION_WIRE.reject)}>
        <Text style={disclosureStyles.approvalText}>{t('common.cancel')}</Text>
      </Pressable>
    </View>
  )
}
const disclosureStyles = StyleSheet.create({
  block: {
    maxWidth: '78%',
    marginTop: rpx(8),
    gap: rpx(6),
  },
  blockTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.text.tertiary,
  },
  steerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(4),
  },
  card: {
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.muted,
    overflow: 'hidden',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(8),
    paddingHorizontal: rpx(12),
    paddingVertical: rpx(8),
  },
  cardBody: {
    paddingHorizontal: rpx(12),
    paddingBottom: rpx(10),
    gap: rpx(6),
  },
  tierRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: rpx(6),
    paddingHorizontal: rpx(16),
    paddingVertical: rpx(6),
  },
  tierLabel: { fontSize: 11, fontWeight: '600', color: tokens.text.tertiary },
  tierTitle: { fontSize: 11, color: tokens.text.secondary },
  tierDesc: { fontSize: 11, color: tokens.text.tertiary },
  approvalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: rpx(8),
    paddingHorizontal: rpx(16),
    paddingVertical: rpx(6),
  },
  approvalBtn: {
    paddingHorizontal: rpx(12),
    paddingVertical: rpx(6),
    borderRadius: rnRadius.sm,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.muted,
  },
  approvalText: { fontSize: 11, color: tokens.text.primary },
  text: { flex: 1, fontSize: 12, lineHeight: 18, color: tokens.text.primary },
  meta: { fontSize: 10, color: tokens.text.tertiary },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠