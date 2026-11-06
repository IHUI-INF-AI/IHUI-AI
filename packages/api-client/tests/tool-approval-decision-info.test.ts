// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 批次 2(2026-11-06 立):结构化审批决策信息投影回归。
 *
 * 判据只有一份(`projectToolApprovalDecisionInfo`)—— 主对话流与 agent 任务流、
 * web/RN/小程序三端都从这里取值。本文件钉住"哪些线字段能变成端上可渲染字段":
 *  - 封闭集(reason/scope)与枚举(risk)之外的值不猜,字段缺席退回首帧 argsPreview;
 *  - argv/cwd 的显式 null 是**事实**(宿主已报告"没有"),必须保留而不是当缺省;
 *  - 非字符串数组元素过滤而非整字段丢弃(路径半脏不该让整块降级)。
 */

import { describe, expect, it } from 'vitest'

import {
  TOOL_APPROVAL_OPERATION_SCOPES,
  TOOL_APPROVAL_REASON_CODES,
  projectToolApprovalDecisionInfo,
} from '../src/client.js'

describe('projectToolApprovalDecisionInfo', () => {
  it('完整载荷逐字段转 camelCase', () => {
    const info = projectToolApprovalDecisionInfo({
      reason_code: 'writes_files',
      risk_level: 'medium',
      argv: ['git', 'status'],
      cwd: '/repo',
      affected_paths: ['src/a.ts', 'src/b.ts'],
      scope: 'fs_write',
      summary: '写入 2 个文件',
    })
    expect(info).toEqual({
      reasonCode: 'writes_files',
      riskLevel: 'medium',
      argv: ['git', 'status'],
      cwd: '/repo',
      affectedPaths: ['src/a.ts', 'src/b.ts'],
      scope: 'fs_write',
      summary: '写入 2 个文件',
    })
  })

  it('原因码与作用域封闭集之外的值不猜(字段缺席)', () => {
    const info = projectToolApprovalDecisionInfo({
      reason_code: 'finished',
      scope: 'shell',
    })
    expect(info.reasonCode).toBeUndefined()
    expect(info.scope).toBeUndefined()
  })

  it('风险枚举之外的值不猜;null/非字符串单个字段缺席', () => {
    expect(projectToolApprovalDecisionInfo({ risk_level: 'critical' }).riskLevel).toBeUndefined()
    expect(projectToolApprovalDecisionInfo({ risk_level: null }).riskLevel).toBeUndefined()
    expect(projectToolApprovalDecisionInfo({ summary: 42 }).summary).toBeUndefined()
    expect(projectToolApprovalDecisionInfo({ cwd: 42 }).cwd).toBeUndefined()
  })

  it('argv/cwd 的显式 null 保留为事实(区别于缺省未上报)', () => {
    const info = projectToolApprovalDecisionInfo({ argv: null, cwd: null })
    expect(info.argv).toBeNull()
    expect(info.cwd).toBeNull()
  })

  it('argv 只接受纯字符串数组;半脏数组整字段缺席(命令不能拼错)', () => {
    expect(projectToolApprovalDecisionInfo({ argv: ['ls', 1] }).argv).toBeUndefined()
    expect(projectToolApprovalDecisionInfo({ argv: 'ls' }).argv).toBeUndefined()
    expect(projectToolApprovalDecisionInfo({ argv: [] }).argv).toEqual([])
  })

  it('受影响路径过滤非字符串,保留可读项', () => {
    expect(
      projectToolApprovalDecisionInfo({ affected_paths: ['ok.txt', 2, null, 'b.txt'] })
        .affectedPaths,
    ).toEqual(['ok.txt', 'b.txt'])
    expect(
      projectToolApprovalDecisionInfo({ affected_paths: 'ok.txt' }).affectedPaths,
    ).toBeUndefined()
  })

  it('空载荷 ⇒ 空对象(老生产者零差异,端上走 argsPreview 降级)', () => {
    expect(projectToolApprovalDecisionInfo({})).toEqual({})
  })

  it('封闭集常量本身是只读且唯一来源', () => {
    expect(TOOL_APPROVAL_REASON_CODES).toContain('writes_files')
    expect(TOOL_APPROVAL_REASON_CODES).toContain('requires_confirmation')
    expect(TOOL_APPROVAL_OPERATION_SCOPES).toEqual([
      'fs_read',
      'fs_write',
      'fs_delete',
      'exec',
      'network',
      'db',
      'other',
    ])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
