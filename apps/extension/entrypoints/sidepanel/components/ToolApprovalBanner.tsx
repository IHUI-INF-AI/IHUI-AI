// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ToolApprovalEvent } from '@ihui/api-client'
import { useI18n } from '../../../src/i18n'

/**
 * 扩展侧栏「工具执行审批」横幅(V3 #58 的扩展端补位)。
 *
 * 链路事实:ai-service 的 tool loop 在高危工具(run_command / delete_file / write_file 等)
 * 执行前发一条 SSE `tool-approval` 帧;客户端注册了 onToolApproval 才会解析这帧,而决策必须经
 * postToolApprovalResponse 回传,否则后端等满 120s 超时并按「未批准」处理。web 端早已接好
 * (全局 ToolApprovalDialog),扩展端此前**没有任何审批位** —— 帧到了也无处显示,于是每一次
 * 高危调用都在后台静默地烧满那 120 秒,而界面只表现为「卡住了」。
 *
 * 本组件只做两件事:显示待审批的事实 + 把点击装配成 (decision, scope) 参数。真正的回传调用由
 * 宿主注入的 onResolve 承担(本文件不 import postToolApprovalResponse),于是横幅与传输层解耦,
 * 也让映射逻辑能在 node 环境下被纯函数测到 —— 本端 vitest 的 environment 是 node,
 * renderToStaticMarkup 点不了真按钮,把判定只留在 JSX 事件里就等于判不到(同名测试对此写明)。
 *
 * 最小特权:默认批准档一律 scope='once'。第三档「本会话内都允许」于 2026-09-28 落地
 * (词键 `chat.approveForSession` 五语言同批进包,提交 3a8726494e8)—— 之前不加这枚按钮,
 * 是因为本端可用词键里没有它的逐字等义文案,而 `agent.modeBypassPermissions` 的词值是
 * 「全部放行」,语义宽度等于 always:拿它当 session 的按钮文案就是骗用户签一张比所需更大的授权。
 * 现在词到位了,所以按本文件自述的顺序补上这一档。**always 仍然不出**:它比 session 又大一档,
 * 且到现在也没有逐字等义词 —— `resolveApprovalAction` 的反向锁继续钉住"任何档都不得是 always"。
 */

/**
 * 缺 sessionId 时唯一渲染的技术态标识。
 * 它是技术标识(与后端字段同源可搜),不是界面文案,所以**刻意不进 i18n** ——
 * 给一个寻址失败的诊断码编措辞,读的人反而搜不到它。
 */
export const APPROVAL_NO_SESSION = 'no-session'

/** 横幅渲染的按钮种类(封闭集;新增一档的前提见文件头注:词键必须先在五语言包里到位) */
export const APPROVAL_BUTTON_KINDS = ['approve', 'approve-session', 'reject'] as const

/** 按钮种类(由 APPROVAL_BUTTON_KINDS 反推,不得另抄一份字面量联合) */
export type ApprovalButtonKind = (typeof APPROVAL_BUTTON_KINDS)[number]

/** 装配出的决策参数:与 postToolApprovalResponse 的 decision / scope 两字段同形 */
export interface ApprovalAction {
  decision: 'approve' | 'reject'
  /** 作用域;拒绝不带(契约注明该字段仅 approve 时有意义) */
  scope?: 'once' | 'session'
}

/**
 * 点击处理器(纯函数部分):按钮种类 → 回传参数。
 *
 * 认不出的种类返回 null 而不是猜一个默认档 —— 审批语境里「猜」的表现形式是用户按了 A
 * 却发出了 B,而界面上一切看上去都成功。
 */
export function resolveApprovalAction(kind: ApprovalButtonKind): ApprovalAction | null {
  switch (kind) {
    case 'approve':
      return { decision: 'approve', scope: 'once' }
    case 'approve-session':
      return { decision: 'approve', scope: 'session' }
    case 'reject':
      return { decision: 'reject' }
    default:
      return null
  }
}

/**
 * 回传可行性判据:审批帧必须带得出寻址用的 sessionId(回传端点按它拼路径)。
 *
 * 空串同样算不可用:端点会拼成 `.../stream//approval-response`,请求发得出去、后端寻址不到
 * 会话,用户那边仍是「点了没反应」—— 那正是要避免的失效形态。
 */
export function isApprovalResolvable(event: ToolApprovalEvent | null): boolean {
  if (event === null) return false
  const sessionId: string | undefined = event.sessionId
  return typeof sessionId === 'string' && sessionId !== ''
}

/**
 * 按钮外观与取词档:一张表按封闭集穷尽(Record 缺键即编译期红),所以加档时不会
 * 出现「渲出一个没样式的按钮」或「按钮上印着键名」。
 */
const BUTTON_BY_KIND: Record<ApprovalButtonKind, { className: string; labelKey: string }> = {
  approve: {
    labelKey: 'agent.approve',
    className: 'rounded-sm border-none bg-cta px-2.5 py-1 text-xs font-medium text-cta-foreground',
  },
  'approve-session': {
    labelKey: 'chat.approveForSession',
    // 第三枚用中性描边而不是第二份 CTA 实底:一屏两个主按钮会让人分不清默认那个
    className:
      'rounded-sm border border-border bg-transparent px-2.5 py-1 text-xs font-medium text-foreground',
  },
  reject: {
    labelKey: 'agent.reject',
    className:
      'rounded-sm border border-destructive bg-transparent px-2.5 py-1 text-xs font-medium text-destructive',
  },
}

export interface ToolApprovalBannerProps {
  event: ToolApprovalEvent | null
  onResolve: (decision: 'approve' | 'reject', scope?: 'once' | 'session') => void | Promise<void>
}

/** 高危工具审批横幅;event 为空时什么都不渲染(不造空态框) */
export function ToolApprovalBanner({ event, onResolve }: ToolApprovalBannerProps) {
  const { t } = useI18n()
  if (event === null) return null

  // 缺 sessionId:只渲染技术态,不渲染按钮。留着按钮等用户点 = 把后端那 120s 超时藏进
  // 「点了没反应」里;显式不可用才是一次能被人看懂的失败。
  if (!isApprovalResolvable(event)) {
    return (
      <div
        className="rounded-md border border-border bg-muted/40 px-2.5 py-2 text-xs"
        data-testid="tool-approval-banner"
        data-approval-resolvable="false"
      >
        <span className="font-mono text-muted-foreground" data-testid="tool-approval-unavailable">
          {APPROVAL_NO_SESSION}
        </span>
      </div>
    )
  }

  const fire = (kind: ApprovalButtonKind) => {
    const action = resolveApprovalAction(kind)
    if (action === null) return
    void onResolve(action.decision, action.scope)
  }

  return (
    <section
      className="rounded-md border border-warning bg-warning/10 px-2.5 py-2 text-xs"
      role="group"
      aria-label={t('agent.permission')}
      data-testid="tool-approval-banner"
      data-approval-resolvable="true"
    >
      <div className="mb-1 font-medium">{t('agent.permissionDecision')}</div>
      <div className="flex flex-wrap items-center gap-1.5">
        {/* toolName 与 dangerLevel 都是技术标识:审批要让用户看清「到底放行的是哪一个」,
            折成中文功能名或等级词都会削弱这一层的可比对性,故按原值等宽显示 */}
        <span className="max-w-full min-w-0 truncate font-mono">{event.toolName}</span>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
          {event.dangerLevel}
        </span>
      </div>
      {/* 参数预览:后端已截断 200 字符,再超长靠 CSS 截(line-clamp + break-all)。
          禁止用 title 属性补全文 —— 原生提示窗样式不受控(AGENTS §4 禁用原生提示窗) */}
      <pre className="m-0 mt-1 line-clamp-4 break-all rounded-sm bg-background/70 p-1.5 font-mono text-[10px] leading-4 whitespace-pre-wrap">
        {event.argsPreview}
      </pre>
      <div className="mt-2 flex items-center gap-1.5">
        {APPROVAL_BUTTON_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className={BUTTON_BY_KIND[kind].className}
            data-testid={`tool-approval-${kind}`}
            onClick={() => fire(kind)}
          >
            <span>{t(BUTTON_BY_KIND[kind].labelKey)}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
