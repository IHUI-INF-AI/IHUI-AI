// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 79 号票消费面前端一格(2026-10-23 立):权限双轴(sandbox_mode × approval_policy)的
// **请求级**取值解析。纯函数、零 React 依赖 —— 组件与发流侧共用同一份实现,
// 端内不得再写第二份映射表(§"两处算同一件事必须共用一份实现")。
//
// 取值与映射的真相源**全部**在 @ihui/types(TS/Python 双向镜像,守门 68 R6 对账):
// - 两轴成员/默认档:SANDBOX_MODES / APPROVAL_POLICIES / *_DEFAULT
// - 预设三档:APPROVAL_PRESETS
// - 单轴 → 双轴:PERMISSION_MODE_TO_AXIS(**null = 无等价档,fail-closed 不伪造**)
// 本文件只做"显式优先、缺省派生、认不出就不发"的优先级拼装,不新增任何字面量档位。
//
// 优先级与后端裁决器(`apps/ai-service/app/core/permission_axis_gate.py` 的
// resolve_axis_resolution)同序:显式双轴 > config profile > 单轴映射 > 都没有。
// 前端没有 profile 选择面,故这里只有 1/3 两档;顺序一致才不会出现"界面一套、后端一套"。
//
// 方向纪律(与后端同一条):**不补默认档**。只声明一轴时另一轴保持未指定(undefined),
// 把"我没选沙箱"补成 read-only 会把"只要不弹审批"读成"禁止一切写操作"。

import {
  PERMISSION_MODE_TO_AXIS,
  SANDBOX_MODE_DEFAULT,
  APPROVAL_POLICY_DEFAULT,
  type ApprovalPolicyId,
  type AxisPair,
  type SandboxModeId,
} from '@ihui/types'
import { normalizePermissionMode } from '@ihui/types/permission-mode'

/** 随请求透传的两轴字段;字段名与 api-client / 网关 schema 逐字一致(camel 入)。 */
export interface RequestAxisFields {
  sandboxMode?: SandboxModeId
  approvalPolicy?: ApprovalPolicyId
}

/**
 * 本次请求实际要发出的双轴字段。
 *
 * - `explicit` 非空 ⇒ 用户在新面板里显式选过,两轴齐发(后端以显式双轴为准);
 * - `explicit` 为空 ⇒ 按单轴模式经 PERMISSION_MODE_TO_AXIS 派生。
 *   **与后端逐字节等价**:不带双轴时裁决器自己就会走同一张表(LEGACY_MODE 来源),
 *   故这里派生出去不改变任何既有行为,只是把"界面显示的"与"实际生效的"对齐;
 * - 单轴映射为 null(acceptEdits / manual)⇒ 返回 `{}`(一条也不发),
 *   绝不回退到任一预设 —— 伪造映射会把"编辑免审批"静默放宽,"全人工"静默放宽。
 */
export function resolveRequestAxes(
  explicit: AxisPair | null,
  singleMode: unknown,
): RequestAxisFields {
  if (explicit) {
    return { sandboxMode: explicit.sandboxMode, approvalPolicy: explicit.approvalPolicy }
  }
  const modeId = normalizePermissionMode(singleMode)
  if (modeId === null) return {}
  const pair = PERMISSION_MODE_TO_AXIS[modeId]
  if (!pair) return {}
  return { sandboxMode: pair.sandboxMode, approvalPolicy: pair.approvalPolicy }
}

/** 当前生效的两轴对(展示用);无任何可表达的取值 ⇒ null(界面须显式说明,不得假装)。 */
export function effectiveAxisPair(
  explicit: AxisPair | null,
  singleMode: unknown,
): AxisPair | null {
  const fields = resolveRequestAxes(explicit, singleMode)
  if (fields.sandboxMode === undefined || fields.approvalPolicy === undefined) return null
  return { sandboxMode: fields.sandboxMode, approvalPolicy: fields.approvalPolicy }
}

/**
 * 面板上"钉住当前可见档位"用的取值:生效对优先,否则取契约层默认档。
 *
 * 只在用户**主动点某一轴**时用(点一轴 = 把两轴都定下来,另一轴沿用眼前显示的那档),
 * 默认档同样取自 @ihui/types,不在端内手写。
 */
export function axisPairOrDefaults(
  explicit: AxisPair | null,
  singleMode: unknown,
): AxisPair {
  return (
    effectiveAxisPair(explicit, singleMode) ?? {
      sandboxMode: SANDBOX_MODE_DEFAULT,
      approvalPolicy: APPROVAL_POLICY_DEFAULT,
    }
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
