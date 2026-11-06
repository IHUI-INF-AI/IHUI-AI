// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 批次 2(2026-11-06 立):小程序端结构化审批的"字段对齐 + 渲染降级"回归。
 *
 * 本端不做完整 dl 布局(小屏),只出摘要 + 至多三行事实;但**字段必须全量认领**:
 * 线上帧的 snake 键经 @ihui/api-client 的同一份投影转 camel,端内不抄第二份判据。
 * 钉住:
 *  A 认领层:结构化键转 camel,封闭集外值/脏数组按投影纪律丢弃;
 *  B 降级渲染:摘要 + 目录/路径(前 5)/命令;空字段不出空行;
 *  C 老生产者(零结构化字段)⇒ null,卡片退回"仅参数预览"旧形态;
 *  D 卡片接线:describeApprovalDetail 进 JSX 且 testid 在位(不做"函数有、界面没挂")。
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { parseToolApprovalLine } from '../../../lib/tool-approval-frame'
import {
  describeApprovalDetail,
  resolveApprovalTexts,
  type ApprovalRequestView,
} from '../tool-approval-text'

const HERE = dirname(fileURLToPath(import.meta.url))
const texts = resolveApprovalTexts((_key, fallback) => fallback)

function view(over: Partial<ApprovalRequestView> = {}): ApprovalRequestView {
  return {
    approvalId: 'ap-1',
    toolName: 'run_command',
    toolCallId: 'tc-1',
    argsPreview: '{}',
    dangerLevel: 'high',
    ...over,
  }
}

describe('A 认领层:结构化键转 camel 且封闭集外值缺席', () => {
  it('完整线帧逐字段进视图', () => {
    const evt = parseToolApprovalLine(
      'data: ' +
        JSON.stringify({
          type: 'tool-approval',
          approval_id: 'ap-1',
          reason_code: 'writes_files',
          risk_level: 'medium',
          argv: ['git', 'status'],
          cwd: '/repo',
          affected_paths: ['src/a.ts'],
          scope: 'fs_write',
          summary: '写入 1 个文件',
        }),
    )
    expect(evt).toMatchObject({
      reasonCode: 'writes_files',
      riskLevel: 'medium',
      argv: ['git', 'status'],
      cwd: '/repo',
      affectedPaths: ['src/a.ts'],
      scope: 'fs_write',
      summary: '写入 1 个文件',
    })
  })

  it('封闭集外 reason/scope 与脏 argv 不猜,退回首帧参数预览', () => {
    const evt = parseToolApprovalLine(
      'data: ' +
        JSON.stringify({
          type: 'tool-approval',
          approval_id: 'ap-1',
          reason_code: 'finished',
          scope: 'shell',
          argv: ['ls', 1],
        }),
    )
    expect(evt?.reasonCode).toBeUndefined()
    expect(evt?.scope).toBeUndefined()
    expect(evt?.argv).toBeUndefined()
  })
})

describe('B 降级渲染:摘要 + 目录/路径/命令,空字段不出空行', () => {
  it('摘要与三行事实齐出,路径最多 5 条', () => {
    const detail = describeApprovalDetail(
      view({
        summary: '写入 6 个文件',
        cwd: '/repo',
        affectedPaths: ['a', 'b', 'c', 'd', 'e', 'f'],
        argv: ['git', 'status'],
      }),
      texts,
    )
    expect(detail).toEqual({
      summary: '写入 6 个文件',
      lines: [
        `${texts.decisionCwd}: /repo`,
        `${texts.decisionPaths}: a、b、c、d、e`,
        `${texts.decisionCommand}: git status`,
      ],
    })
  })

  it('只有摘要(无目录/路径/命令)⇒ summary 有值、lines 为空', () => {
    const detail = describeApprovalDetail(view({ summary: '调用工具 run_command' }), texts)
    expect(detail).toEqual({ summary: '调用工具 run_command', lines: [] })
  })

  it('cwd 显式 null 与空数组不产出任何行(不写 null/空占位)', () => {
    const detail = describeApprovalDetail(
      view({ summary: '执行命令', cwd: null, affectedPaths: [], argv: [] }),
      texts,
    )
    expect(detail).toEqual({ summary: '执行命令', lines: [] })
  })

  it('空白项被过滤:路径/命令不把空串拼成连续顿号或空格', () => {
    const detail = describeApprovalDetail(
      view({ affectedPaths: ['a', '  ', 'b'], argv: ['git', ''] }),
      texts,
    )
    expect(detail?.lines).toEqual([`${texts.decisionPaths}: a、b`, `${texts.decisionCommand}: git`])
  })
})

describe('C 老生产者:零结构化字段 ⇒ null(保留旧形态,不画空面板)', () => {
  it('只有 argsPreview 的帧返回 null', () => {
    expect(describeApprovalDetail(view({ argsPreview: '{"command":"ls"}' }), texts)).toBeNull()
  })

  it('summary 全空白且无任何行 ⇒ null', () => {
    expect(describeApprovalDetail(view({ summary: '   ' }), texts)).toBeNull()
  })
})

describe('D 卡片接线:函数真的进 JSX,testid 在位', () => {
  it('tool-approval-card.tsx 调用 describeApprovalDetail 并渲染 tool-approval-detail', () => {
    const card = readFileSync(resolve(HERE, '../tool-approval-card.tsx'), 'utf8')
    expect(card).toContain('describeApprovalDetail(request, texts)')
    expect(card).toContain('data-testid="tool-approval-detail"')
    expect(card).toContain('texts.decisionDetail')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
