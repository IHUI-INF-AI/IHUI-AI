// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { ShieldAlert, ShieldCheck } from 'lucide-react-native'
import type { ToolApprovalEvent } from '@ihui/api-client'
import { postToolApprovalResponse } from '@ihui/api-client'
import { rnRadius } from '@ihui/design-tokens'
import type { ToolApprovalScope } from '@ihui/types'
import { TextField } from '@ihui/rn-app'
import { currentRnTheme, tokens } from '../../theme/active-tokens'
import { useI18n } from '../../i18n'
import { rpx } from '../../utils/rpx'

/**
 * D136(2026-10-01 立,承 V4 #94 / D84):RN 端工具审批。
 *
 * 立因:`tool-approval` 帧早在契约里(`packages/shared/src/sse/contract.ts` 的
 * `SSE_EVENTS.TOOL_APPROVAL`),web 有 `apps/web/src/components/ai/tool-approval-dialog.tsx`,
 * 而 `git grep 'tool-approval|toolApproval' HEAD -- apps/mobile-rn/src` 零命中 ⇒ 手机上
 * agent 发起高危工具调用时**屏幕上什么都没有**,用户不知道发生过一次决定,任务就那么挂着。
 *
 * 三条不可漂的写法(每条都对应本仓记过的一次事故):
 *  1. **解析不在端内重写** —— 本组件收的是 `streamChat` 已经解析好的
 *     `ToolApprovalEvent`(`packages/api-client/src/client.ts` 的 `tryParseToolApproval`,
 *     它与 `@ihui/shared` 的 `parseToolApprovalEvent` 共用同一份
 *     `projectToolApprovalEnvFacts` 投影)。端内再写一份"挑字段"的收窄解析,就是那两个
 *     "两侧契约/服务端/组件/用例全在,而解析面不递 ⇒ 界面永远字段缺席=整块不渲染"
 *     的解析面之一。要新字段请改共享出口 + 加用例。
 *  2. **三档与 web 逐档同值** —— `once / session / always`,默认 `once`(最小特权),
 *     作用域**仅在批准时携带**(拒绝不落任何授权);与 web `handleDecision` 同形。
 *     刻意不给移动端"只留两档"的降级:档位少一档,后端授权面就会按缺省放大。
 *  3. **关闭 ≠ 决策,拒绝 ≠ 永久禁止**(AGENTS §30)—— 硬件返回/遮罩关闭只是把面板收起,
 *     **绝不**回传任何 decision,条目留在待决队列并由常驻胶囊给出"打开审批"的人工放行入口;
 *     拒绝后那条记录仍可见(写明"同类操作下次仍会询问你"),因为引擎侧的 approval id
 *     一旦被回答即出账(`postToolApprovalResponse` 对已失效条目走
 *     `assertAiServiceAccepted` 抛错),所以放行入口只能在"下一次询问"与"未答复的待决项"
 *     这两条真存在的路上,造第三个按钮就是对用户撒谎。
 *
 * 平台特有:依赖 react-native Modal / lucide-react-native,不适合共享层。
 *
 * G-978066(2026-10-10 补):web 审批门上的**原因输入**与 **grantRule 规则编辑器**搬到本面板。
 * 规则编辑器只出现在这里,不出现在 `ChatDisclosure.ToolApprovalRow` —— 那条行走
 * `sendToolApprovalResponse`(网关 /ai/agent/approval-response),其 schema 会静默丢弃
 * `grant_rule`(web 侧同一判据,见 tool-approval-dialog.tsx 的 showGrantRule),
 * 在那儿摆一个开关就是"看起来有、其实没装车"。本面板走 chat-stream 端点,字段有人接。
 */

/** 一条审批在端内的两种终局:待决(pending)/ 已回答(answered)。 */
interface ApprovalEntry {
  event: ToolApprovalEvent
  /** 已发出的决策(null = 仍待用户判断) */
  decided: 'approve' | 'reject' | null
}

export interface UseToolApprovalQueueResult {
  /** 直接挂进 streamChat 的 options.onToolApproval */
  onToolApproval: (event: ToolApprovalEvent) => void
  /** 必须渲染在屏内:面板 + 常驻待审批胶囊 */
  host: ReactNode
}

/** 三档作用域(与 @ihui/types 的 ToolApprovalScope 同一联合,顺序与 web 一致)。 */
const SCOPE_OPTIONS: ReadonlyArray<{ value: ToolApprovalScope; labelKey: string }> = [
  { value: 'once', labelKey: 'toolApproval.scopeOnce' },
  { value: 'session', labelKey: 'toolApproval.scopeSession' },
  { value: 'always', labelKey: 'toolApproval.scopeAlways' },
]

/** 第四档上送的固定口径:按 argv 前 2 个 token 落前缀规则(与 web/后端预填同值)。 */
const GRANT_RULE_TOKENS = 2

/** 高危命令片段最小表:命令全文命中任一片段 ⇒ 勾选第四档时先二次确认(与 web 同表)。 */
const DANGEROUS_COMMAND_PATTERNS: readonly string[] = [
  'rm -rf',
  'rm -fr',
  'mkfs',
  'dd if=',
  'shutdown',
  'reboot',
  'halt',
  'del /f',
  'rd /s',
  ':(){',
]

/** 原因输入上限(与 web textarea 的 maxLength 同值)。 */
const REASON_MAX_LENGTH = 500

/** 从 argsPreview(JSON,可能被 200 字符截断)尽力还原 run_command 的 argv。 */
function extractRunCommandArgv(argsPreview: string): string[] {
  try {
    const parsed: unknown = JSON.parse(argsPreview)
    if (parsed && typeof parsed === 'object') {
      const argv = (parsed as { argv?: unknown }).argv
      if (Array.isArray(argv)) {
        const argvTokens = argv.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
        if (argvTokens.length > 0) return argvTokens
      }
      const command = (parsed as { command?: unknown }).command
      if (typeof command === 'string' && command.trim() !== '') {
        return command.trim().split(/\s+/)
      }
    }
  } catch {
    // 截断的 JSON 落到这里,退回原文按空白切词兜底
  }
  const text = argsPreview.trim()
  return text === '' ? [] : text.split(/\s+/)
}

function isDangerousCommand(argv: readonly string[]): boolean {
  const cmdline = argv.join(' ').toLowerCase()
  return DANGEROUS_COMMAND_PATTERNS.some((p) => cmdline.includes(p))
}

export function useToolApprovalQueue(): UseToolApprovalQueueResult {
  const { t } = useI18n()
  const [entries, setEntries] = useState<ApprovalEntry[]>([])
  const [panelOpen, setPanelOpen] = useState(false)
  const [scope, setScope] = useState<ToolApprovalScope>('once')
  const [reason, setReason] = useState('')
  const [grantRule, setGrantRule] = useState(false)
  const [sending, setSending] = useState(false)
  /** 上一条决策回传失败的 approval id:必须显式挂在面板上,不得静默当"已处理"。 */
  const [failedId, setFailedId] = useState<string | null>(null)
  /** sendingRef:回调里读 state 会拿到闭包旧值,所以决策闸门用 ref 判重。 */
  const sendingRef = useRef(false)

  /** 入队去重按 approvalId(与 web enqueue 同口径);已回答的条目不再被同 id 覆盖。 */
  const enqueue = useCallback((event: ToolApprovalEvent) => {
    const approvalId = event?.approvalId
    if (!approvalId) return
    setEntries((prev) =>
      prev.some((e) => e.event.approvalId === approvalId)
        ? prev
        : [...prev, { event, decided: null }],
    )
    setPanelOpen(true)
  }, [])

  const onToolApproval = useCallback(
    (event: ToolApprovalEvent) => {
      enqueue(event)
    },
    [enqueue],
  )

  const pending = useMemo(() => entries.filter((e) => e.decided === null), [entries])
  const answered = useMemo(() => entries.filter((e) => e.decided !== null), [entries])
  const current = pending[0] ?? null

  // 新请求入栈时重置作用域/原因/规则勾选,避免上一条的授权范围串到下一条(与 web 同一条 effect 语义)。
  const currentId = current?.event.approvalId ?? null
  useEffect(() => {
    if (currentId !== null) {
      setScope('once')
      setReason('')
      setGrantRule(false)
    }
  }, [currentId])

  const decide = useCallback(
    async (decision: 'approve' | 'reject', withGrantRule = false) => {
      const target = current
      if (!target || sendingRef.current) return
      const approvalId = target.event.approvalId
      const trimmedReason = reason.trim()
      sendingRef.current = true
      setSending(true)
      try {
        await postToolApprovalResponse({
          // sessionId 缺失时回传必然失败:走 catch 标"未送达",后端按超时兜底(与 web 同)。
          sessionId: target.event.sessionId ?? '',
          approvalId,
          decision,
          // 作用域仅批准时有意义;once 显式传,防后端缺省意外放大(照抄 web 那条注释的理由)
          ...(decision === 'approve' ? { scope } : {}),
          // 空原因不携带键:「没说原因」与「说了个空原因」是两件事(与 web 同)
          ...(trimmedReason !== '' ? { reason: trimmedReason } : {}),
          // 第四档随 approve 一并上送,与三档 scope 正交;拒绝永不携带
          ...(decision === 'approve' && withGrantRule
            ? { grantRule: { kind: 'exec_prefix' as const, tokens: GRANT_RULE_TOKENS } }
            : {}),
        })
        setEntries((prev) =>
          prev.map((e) => (e.event.approvalId === approvalId ? { ...e, decided: decision } : e)),
        )
      } catch {
        // 失败必须响:不回退成"看起来已处理"。条目留在待决队列,面板上点名发送失败。
        setFailedId(approvalId)
      } finally {
        sendingRef.current = false
        setSending(false)
      }
    },
    [current, scope, reason],
  )

  // 规则编辑器只在 run_command 上出现(与前缀展示同源:argv 从 argsPreview 尽力还原)。
  const grantArgv = useMemo(
    () => extractRunCommandArgv(current?.event.argsPreview ?? ''),
    [current?.event.argsPreview],
  )
  const grantPrefix = grantArgv.slice(0, GRANT_RULE_TOKENS).join(' ')
  const showGrantRule = current?.event.toolName === 'run_command'
  const grantDangerous = isDangerousCommand(grantArgv)

  const requestApprove = useCallback(() => {
    if (showGrantRule && grantRule && grantDangerous) {
      Alert.alert(
        t('toolApproval.grantRuleConfirmTitle'),
        t('toolApproval.grantRuleConfirmContent', { prefix: grantPrefix }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('toolApproval.approve'), onPress: () => void decide('approve', true) },
        ],
      )
      return
    }
    void decide('approve', showGrantRule && grantRule)
  }, [showGrantRule, grantRule, grantDangerous, grantPrefix, decide, t])

  const dismissAnswered = useCallback(() => {
    setEntries((prev) => prev.filter((e) => e.decided === null))
  }, [])

  const host = (
    <>
      {/* 常驻入口:面板被收起(含硬件返回)后,待审批数必须仍可看见并可点开 ——
          这就是 AGENTS §30 说的"人工放行入口",关闭从不等于拒绝。 */}
      {pending.length > 0 && !panelOpen ? (
        <Pressable
          accessibilityRole="button"
          testID="tool-approval-open"
          style={styles.openPill}
          onPress={() => setPanelOpen(true)}
        >
          <ShieldAlert size={14} color={tokens.brand.ctaForeground} />
          <Text style={styles.openPillText}>
            {t('toolApproval.openPanel', { count: pending.length })}
          </Text>
        </Pressable>
      ) : null}

      <Modal
        visible={panelOpen && current !== null}
        transparent
        animationType="fade"
        // 关闭只收起面板:不发任何 decision,条目留在待决队列(见文件头第 3 条)。
        onRequestClose={() => setPanelOpen(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>{t('toolApproval.title')}</Text>
            <Text style={styles.description}>{t('toolApproval.description')}</Text>
            {pending.length > 1 ? (
              <Text style={styles.meta}>
                {t('toolApproval.pendingCount', { count: pending.length - 1 })}
              </Text>
            ) : null}
            {current ? (
              <>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{t('toolApproval.argsPreview')}</Text>
                  <Text style={styles.toolName} numberOfLines={2}>
                    {current.event.toolName || '—'}
                  </Text>
                  <Text style={styles.preview} numberOfLines={6}>
                    {current.event.argsPreview || '—'}
                  </Text>
                  <Text style={styles.meta}>
                    {t('toolApproval.dangerLevel', { level: current.event.dangerLevel })}
                  </Text>
                </View>
                <EnvironmentFacts event={current.event} t={t} />
                {failedId === current.event.approvalId ? (
                  <Text testID="tool-approval-send-failed" style={styles.error}>
                    {t('toolApproval.sendFailed')}
                  </Text>
                ) : null}
                {current.event.sessionId ? null : (
                  <Text testID="tool-approval-no-session" style={styles.error}>
                    {t('toolApproval.noSession')}
                  </Text>
                )}
                <View style={styles.scopeRow}>
                  <Text style={styles.fieldLabel}>{t('toolApproval.scopeLabel')}</Text>
                  <View style={styles.scopeGroup}>
                    {SCOPE_OPTIONS.map((opt) => {
                      const active = scope === opt.value
                      return (
                        <Pressable
                          key={opt.value}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: active }}
                          testID={`tool-approval-scope-${opt.value}`}
                          style={active ? styles.scopeOptionActive : styles.scopeOption}
                          onPress={() => setScope(opt.value)}
                        >
                          <Text style={active ? styles.scopeTextActive : styles.scopeText}>
                            {t(opt.labelKey)}
                          </Text>
                        </Pressable>
                      )
                    })}
                  </View>
                </View>
                {showGrantRule ? (
                  <View style={styles.field}>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: grantRule }}
                      testID="tool-approval-grant-rule"
                      style={[
                        grantRule ? styles.scopeOptionActive : styles.scopeOption,
                        styles.chipRow,
                      ]}
                      onPress={() => setGrantRule((v) => !v)}
                    >
                      <ShieldCheck
                        size={14}
                        color={grantRule ? tokens.text.primary : tokens.text.secondary}
                      />
                      <Text style={grantRule ? styles.scopeTextActive : styles.scopeText}>
                        {t('toolApproval.grantRuleToggle')}
                      </Text>
                    </Pressable>
                    <Text style={styles.meta}>
                      {t('toolApproval.grantRuleDesc', { prefix: grantPrefix })}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{t('editor.toolApproval.reasonLabel')}</Text>
                  <TextField
                    testID="tool-approval-reason"
                    accessibilityLabel={t('editor.toolApproval.reasonLabel')}
                    colorScheme={currentRnTheme()}
                    multiline
                    maxLength={REASON_MAX_LENGTH}
                    value={reason}
                    onChangeText={setReason}
                    placeholder={t('editor.toolApproval.reasonPlaceholder')}
                    placeholderTextColor={tokens.text.tertiary}
                    style={styles.reasonInput}
                  />
                </View>
                <View style={styles.actions}>
                  <Pressable
                    accessibilityRole="button"
                    testID="tool-approval-reject"
                    disabled={sending}
                    style={styles.rejectBtn}
                    onPress={() => void decide('reject')}
                  >
                    <Text style={styles.rejectText}>{t('toolApproval.reject')}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    testID="tool-approval-approve"
                    disabled={sending}
                    style={styles.approveBtn}
                    onPress={requestApprove}
                  >
                    <Text style={styles.approveText}>{t('toolApproval.approve')}</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Text style={styles.meta}>{t('toolApproval.empty')}</Text>
            )}
          </View>
        </View>
      </Modal>

      {/* 已处理记录常驻在面板**外**:面板会随"无待决项"自动收起,把记录留在面板里就等于
          拒绝之后屏幕上什么都不剩 —— 用户照样不知道"发生过一次决定"(本票立因)。
          这条记录写的是「已拒绝 + 同类操作下次仍会询问你」,不是「完成」(AGENTS §30)。 */}
      {answered.length > 0 ? (
        <View style={styles.trayCard}>
          <Text style={styles.trayTitle}>{t('toolApproval.trayTitle')}</Text>
          {answered.map((e) => (
            <Text key={e.event.approvalId} style={styles.trayRow}>
              {`${e.event.toolName} · ${
                e.decided === 'approve'
                  ? t('toolApproval.approve')
                  : t('toolApproval.rejectedBadge')
              }`}
              {e.decided === 'reject' ? ` — ${t('toolApproval.rejectedNextNote')}` : ''}
            </Text>
          ))}
          <Pressable
            accessibilityRole="button"
            testID="tool-approval-clear-history"
            onPress={dismissAnswered}
          >
            <Text style={styles.meta}>{t('toolApproval.clearHistory')}</Text>
          </Pressable>
        </View>
      ) : null}
    </>
  )

  return { onToolApproval, host }
}

/**
 * 逐请求环境事实(D159 的三个可选字段)。
 *
 * 三态绝不并桶:`execEnvironment` 整字段缺席 = 后端回退了上报开关 ⇒ 整块不渲染;
 * 在位但 `available === false` = 上报了但读不到 ⇒ 必须喊"未上报",不得静默。
 * 把两态折叠成一个,就等于把"没判"写成"判过了"。
 */
function EnvironmentFacts({
  event,
  t,
}: {
  event: ToolApprovalEvent
  t: (key: string, values?: Record<string, string | number>) => string
}) {
  const env = event.execEnvironment
  if (!env) return null
  const network = event.networkTarget
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{t('toolApproval.envLabel')}</Text>
      {env.available === false ? (
        <Text testID="tool-approval-env-unknown" style={styles.envValue}>
          {t('toolApproval.envUnknown')}
        </Text>
      ) : (
        <>
          <Text style={styles.envValue}>
            {env.inSandbox ? t('toolApproval.envInSandbox') : t('toolApproval.envOutsideSandbox')}
          </Text>
          {env.backend ? (
            <Text style={styles.envValue}>
              {t('toolApproval.envBackend', { backend: env.backend })}
            </Text>
          ) : null}
          {env.degraded ? (
            <Text style={styles.envValue}>{t('toolApproval.envDegraded')}</Text>
          ) : null}
        </>
      )}
      <Text style={styles.envValue}>
        {network ? t('toolApproval.envNetworkOpen') : t('toolApproval.envNetworkOff')}
      </Text>
      {network ? (
        <Text style={styles.envValue}>{`${network.protocol}://${network.display}`}</Text>
      ) : null}
      {event.blockedNetworkTargets && event.blockedNetworkTargets.length > 0 ? (
        <>
          <Text style={styles.envValue}>{t('toolApproval.envNetworkBlocked')}</Text>
          {event.blockedNetworkTargets.map((target) => (
            <Text key={`${target.host}:${target.port}`} style={styles.envValue}>
              {t('toolApproval.envNetworkBlockedOne', {
                host: target.host,
                port: target.port,
                reason: target.reason ?? '—',
              })}
            </Text>
          ))}
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  openPill: {
    position: 'absolute',
    top: rpx(180),
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(8),
    paddingHorizontal: rpx(20),
    paddingVertical: rpx(12),
    backgroundColor: tokens.brand.cta,
    borderRadius: rnRadius.md,
  },
  openPillText: {
    fontSize: 12,
    color: tokens.brand.ctaForeground,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: rpx(48),
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  card: {
    backgroundColor: tokens.surface.card,
    borderRadius: rnRadius.xl,
    padding: rpx(32),
    gap: rpx(16),
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  description: {
    fontSize: 13,
    color: tokens.text.secondary,
  },
  meta: {
    fontSize: 12,
    color: tokens.text.tertiary,
  },
  field: {
    gap: rpx(6),
  },
  fieldLabel: {
    fontSize: 12,
    color: tokens.text.tertiary,
  },
  toolName: {
    fontSize: 14,
    fontWeight: '500',
    color: tokens.text.primary,
  },
  preview: {
    fontSize: 12,
    color: tokens.text.secondary,
  },
  envValue: {
    fontSize: 12,
    color: tokens.text.secondary,
  },
  error: {
    fontSize: 12,
    color: tokens.danger.DEFAULT,
  },
  scopeRow: {
    gap: rpx(8),
  },
  scopeGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rpx(8),
  },
  scopeOption: {
    paddingHorizontal: rpx(16),
    paddingVertical: rpx(10),
    borderRadius: rnRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
  },
  scopeOptionActive: {
    paddingHorizontal: rpx(16),
    paddingVertical: rpx(10),
    borderRadius: rnRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.muted,
  },
  scopeText: {
    fontSize: 12,
    color: tokens.text.secondary,
  },
  scopeTextActive: {
    fontSize: 12,
    fontWeight: '500',
    color: tokens.text.primary,
  },
  // 规则开关复用档位 chip 的半径/描边,只加行内排布(不另立一份控件档圆角)
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: rpx(8),
  },
  // 输入控件档 = rnRadius.sm;常态描边取 border.light(墨档只允许出现在聚焦态,
  // 而聚焦态由 @ihui/rn-app 的 TextField 内部给出,端内不再手写第二份聚焦状态)
  reasonInput: {
    minHeight: rpx(88),
    paddingHorizontal: rpx(16),
    paddingVertical: rpx(10),
    borderRadius: rnRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.inputBg,
    color: tokens.text.primary,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: rpx(16),
    marginTop: rpx(8),
  },
  rejectBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: rpx(22),
    borderRadius: rnRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border.light,
  },
  rejectText: {
    fontSize: 14,
    color: tokens.text.secondary,
  },
  // 主实底与其上文字必须成对(brand.cta / brand.ctaForeground),跨档错配即隐形。
  approveBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: rpx(22),
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.brand.cta,
  },
  approveText: {
    fontSize: 14,
    fontWeight: '500',
    color: tokens.brand.ctaForeground,
  },
  // 常驻在面板外的那张记录卡:card 角色 ⇒ rnRadius.lg(守门 150 的档名即角色)
  trayCard: {
    backgroundColor: tokens.surface.card,
    borderRadius: rnRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border.light,
    padding: rpx(24),
    gap: rpx(6),
  },
  trayTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: tokens.text.secondary,
  },
  trayRow: {
    fontSize: 12,
    color: tokens.text.tertiary,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
