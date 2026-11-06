// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

/**
 * 按轮变更集(turn change set)取数唯一入口(web 腿)。
 *
 * 为什么集中在这里而不是各组件各自 import `@ihui/api-client`:
 * ① 组件/状态层只认这一份派生类型 —— 响应形状的真相源是 api-client / @ihui/types,
 *   端内不重抄一份(手抄的 interface 一旦与后端漂移,类型检查仍一路绿,运行时才炸);
 * ② 列表/详情类型用 `Extract<..., {success:true}>['data']` 从 `ApiResult` 里**派生**,
 *   方法演进自动对齐;
 * ③ 端内禁止自写 fetch(跨端契约只能有一份),故这里只有 re-export 与解包,零请求逻辑。
 *
 * 回滚结果是例外:api-client 按上游文档刻意声明为开放记录(新增字段不被旧客户端吞掉),
 * 因此 web 侧只能在唯一的边界处断言出本次 UI 真正消费的字段。
 *
 * 批次 4(2026-11-06 立):web 的流式正文恢复不再经此处转发,改由
 * `/api/chat/resume/status` 的 `partialContent` 消费(见 hooks/use-chat/resume-stream.ts)。
 * `packages/api-client` 的 `getChatProjection` 仍是网关 `/api/chat/changes/projections` 的公共
 * 客户端绑定(有自身测试),web 未接它是按需裁剪,不是漏接。
 */

import { getChatTurnChange, listChatTurnChanges, rewindChatTurnChange } from '@ihui/api-client'
import type { ApiResult } from '@ihui/types/api'

export { getChatTurnChange, listChatTurnChanges }

/** 从 `ApiResult<T>` 的成功分支取 data(失败分支由调用方按既有错误链处理) */
type SuccessData<R> = R extends { success: true; data: infer D } ? D : never

/** 一轮变更集的摘要行(列表项) */
export type TurnChangeSummary = SuccessData<
  Awaited<ReturnType<typeof listChatTurnChanges>>
>['items'][number]

/** 单轮变更集详情(摘要 + 逐文件 unified diff) */
export type TurnChangeDetail = SuccessData<Awaited<ReturnType<typeof getChatTurnChange>>>

/** 变更集内的单个文件 */
export type TurnChangeFile = TurnChangeDetail['files'][number]

/** 回滚预演/实发结果中 UI 消费的字段(见文件头注的例外说明) */
export interface TurnChangeRewindResult {
  dryRun: boolean
  status: 'ok' | 'conflict' | 'already_rewound' | 'unavailable'
  /** 上游为开放记录,旧版可能不返回逐文件动作/冲突数组:UI 按"缺席=空"展示 */
  actions?: {
    path: string
    operation: 'add' | 'modify' | 'delete'
    action: 'restore' | 'delete' | 'skip'
    conflict?: boolean
    reason?: string
  }[]
  conflicts?: string[]
  applied: number
}

/**
 * 回滚(预演/实发)。
 * 失败分支抛错 —— 状态层用同一套 loading/error 面渲染,不需要各自判断 `success`。
 */
export async function requestTurnChangeRewind(
  changeSetId: string,
  body: { dryRun: boolean },
): Promise<TurnChangeRewindResult> {
  const res: ApiResult<Record<string, unknown>> = await rewindChatTurnChange(changeSetId, body)
  if (!res.success) throw new Error(res.error)
  // Record<string, unknown> → 具名字段:转换面仅此一处,组件层不再各自 cast
  return res.data as unknown as TurnChangeRewindResult
}
