// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话级分叉(从某条消息分叉出新会话)的端内宿主逻辑。
 *
 * 为什么单独成文件、为什么把三个边界都做成注入参数:
 * 后端 `POST /api/chat/conversations/:id/branch` 与客户端出口
 * `branchConversation`(`@ihui/api-client`)早就入库,web 端也已在
 * `apps/web/src/hooks/use-chat/send-message.ts` 的 `branchMessage` 里消费它;
 * mobile-rn 缺的只是宿主。把"调用 + 结果→文案 + 切会话"这一步从 2200 行的
 * screen 里剥出来,是为了让它能被**真模块**测到 —— screen 依赖 expo / RN 原生
 * 模块,vitest 下渲染它要 mock 掉一整排包,而 mock 掉 `@ihui/api-client`
 * 之后测的就不是这条链路了。本模块零运行时依赖(只 `import type`),
 * 网络出口、词表、提示、切会话四条边界全部由调用方注入,测试喂真词包 + 假传输。
 *
 * 语义与 web 端 `branchMessage` 逐条对齐,不另起一套:
 * 1. 以目标消息之前的内容新建会话,**源会话原样保留**(后端事务里做的事)
 * 2. 成功后把界面切到新会话(RN 没有 URL,故对应 web 的 `setConversationId`)
 * 3. 失败必须响:把服务返回的 `error` 与 HTTP 状态码一起进文案,绝不静默 return
 */
import type { ApiResult } from '@ihui/types'

/** 分支响应体(只声明本模块用到的字段,便于测试构造)。 */
export interface BranchConversationResponse {
  conversation: { id: string }
}

/** `@ihui/api-client` 的 `branchConversation` 在本模块眼里的形状。 */
export type BranchConversationCall = (
  conversationId: string,
  messageId: string,
) => Promise<ApiResult<BranchConversationResponse>>

/** 取词函数(与 mobile-rn `useI18n().t` 同签名)。 */
export type BranchTranslate = (key: string, params?: Record<string, string | number>) => string

/** 浮层提示(与 mobile-rn `showToast` 同签名;级别取窄,实现方参数更宽可赋值)。 */
export type BranchNotify = (level: 'success' | 'warning' | 'error', message: string) => void

/**
 * 宿主"切到新会话"的自报结果 —— 两个字段各说一件事,不得互相顶替:
 * `switched` 是"界面现在真的落在该会话上",`loaded` 是"该会话的消息读回来了"。
 * 二者由调用方各自如实取证,本模块只按它们选文案,
 * 绝不从"函数没抛错"推出"切过去了"。
 */
export interface OpenConversationResult {
  /** 宿主确实把界面从原会话换到了这个新会话;原地未动 / 已卸载 → false。 */
  switched: boolean
  /** 新会话的消息加载成功。`switched` 为 false 时本字段无意义,调用方给 false。 */
  loaded: boolean
}

export interface BranchConversationDeps {
  /** 真实网络出口,由调用方传入 `@ihui/api-client` 的 `branchConversation`。 */
  branch: BranchConversationCall
  /** 词表:`t('ai.pane.branch.*')`。 */
  t: BranchTranslate
  /** 提示条。 */
  notify: BranchNotify
  /** 切到新会话并加载其消息,自报上述两维。 */
  openConversation: (conversationId: string) => Promise<OpenConversationResult>
}

export interface BranchConversationTarget {
  /** 源会话 id(未登录/新建未落库时为 undefined)。 */
  conversationId: string | undefined
  /** 分叉锚点消息的服务端 id;本地乐观消息没有,故不可分叉。 */
  messageId: string | undefined
}

/**
 * 五条出口,每条对应一句**只说自己那件事**的文案。
 * 特意把"会话建好了但界面没切过去"与"切过去了但内容没读回来"分成两条:
 * 前者用户要去历史列表里找,后者用户只要等一下重试,合并成一条就是误导。
 */
export type BranchConversationOutcome =
  /** 锚点不可用(消息/会话尚未落库),已给出提示。 */
  | { outcome: 'blocked' }
  /** 服务端拒绝,已给出带原因与状态码的提示。 */
  | { outcome: 'request-failed' }
  /** 新会话已在服务端创建,但**界面没能切过去**(含宿主已卸载)。 */
  | { outcome: 'created-not-switched'; conversationId: string }
  /** 界面已切到新会话,但**它的消息没读回来**。 */
  | { outcome: 'switched-not-loaded'; conversationId: string }
  /** 全程成功。 */
  | { outcome: 'switched'; conversationId: string }

/**
 * 从一条消息分叉出新会话,并把界面切过去。
 *
 * 每条出口都给用户一句提示 —— 包括"锚点还没落库"这一条:入口按钮本来就只在
 * 消息带服务端 id 时才渲染,真走到 `blocked` 说明渲染与点击之间状态变了
 * (例如对话被重置),此时不做任何解释就等于让用户以为按钮坏了。
 */
export async function branchConversationFromMessage(
  deps: BranchConversationDeps,
  target: BranchConversationTarget,
): Promise<BranchConversationOutcome> {
  const { conversationId, messageId } = target
  if (!conversationId || !messageId) {
    deps.notify('warning', deps.t('ai.pane.branch.notPersisted'))
    return { outcome: 'blocked' }
  }

  const res = await deps.branch(conversationId, messageId)
  if (!res.success) {
    const reason = res.error.trim() === '' ? deps.t('ai.pane.branch.noReason') : res.error
    const status =
      res.status === undefined ? deps.t('ai.pane.branch.unknownStatus') : String(res.status)
    deps.notify('error', deps.t('ai.pane.branch.failure', { reason, status }))
    return { outcome: 'request-failed' }
  }

  const newConversationId = res.data.conversation.id
  const opened = await deps.openConversation(newConversationId)
  if (!opened.switched) {
    // 服务端已经建好了会话,只有界面还停在原处 —— 这句必须照实说,不得推给用户
    // "内容加载失败"(那是另一种故障,用户按它去重试就找错了方向)。
    deps.notify('warning', deps.t('ai.pane.branch.switchFailure'))
    return { outcome: 'created-not-switched', conversationId: newConversationId }
  }
  if (!opened.loaded) {
    deps.notify('warning', deps.t('ai.pane.branch.loadFailure'))
    return { outcome: 'switched-not-loaded', conversationId: newConversationId }
  }

  deps.notify('success', deps.t('ai.pane.branch.success'))
  return { outcome: 'switched', conversationId: newConversationId }
}

/**
 * 一条消息能否作为分叉锚点:必须是**已落库会话里的已落库消息**。
 * 渲染期与点击期共用这一条判据,避免"按钮渲染出来了、点下去什么也没发生"。
 */
export function isBranchableTarget(target: BranchConversationTarget): boolean {
  return Boolean(target.conversationId && target.messageId)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
