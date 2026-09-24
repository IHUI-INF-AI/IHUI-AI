// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D91 四类文档批注锚点分型 · 共享层判定单测(G-124)
// 覆盖:四坐标标签逐类(逐字键)+ 穷尽性 + 单一状态机(四类共用反证)+
// 回流组装(toTaskInput)+ 删除终态/取消可重标。

import { describe, expect, it } from 'vitest'

import {
  ANNOTATION_ANCHOR_ACTIONS,
  ANNOTATION_ANCHOR_KINDS,
  ANNOTATION_ANCHOR_LABEL_IDS,
  ANNOTATION_ANCHOR_STATES,
  anchorLabel,
  annotationAnchorLabelKey,
  applyAnchorAction,
  canRelabel,
  isTerminalAnchorState,
  toTaskInput,
  type AnnotationAnchor,
  type AnnotationAnchorAction,
  type AnnotationAnchorState,
} from '../annotation-anchors'

const anchors: Record<(typeof ANNOTATION_ANCHOR_KINDS)[number], AnnotationAnchor> = {
  pdf: { kind: 'pdf', page: 3 },
  pptx: { kind: 'pptx', slide: 5, element: '标题文本框' },
  docx: { kind: 'docx', page: 12 },
  xlsx: { kind: 'xlsx', sheet: '季度汇总', range: 'A1:C9' },
}

describe('D91 anchorLabel / 四坐标逐类(键与插值)', () => {
  it('pdf → label.pdf,插值只带 page', () => {
    const l = anchorLabel(anchors.pdf)
    expect(l.key).toBe('label.pdf')
    expect(l.id).toBe('pdf')
    expect(l.values).toEqual({ page: 3 })
    expect(l.secondary).toBeUndefined()
  })

  it('pptx 带 element → label.pptx(slide+element),次标签 label.pptxComment(批注 {element})', () => {
    const l = anchorLabel(anchors.pptx)
    expect(l.key).toBe('label.pptx')
    expect(l.values).toEqual({ slide: 5, element: '标题文本框' })
    expect(l.secondary?.key).toBe('label.pptxComment')
    expect(l.secondary?.values).toEqual({ element: '标题文本框' })
  })

  it('pptx 无 element → 退化为 label.pptxSlide(第 {slide} 张),无次标签', () => {
    const l = anchorLabel({ kind: 'pptx', slide: 2 })
    expect(l.key).toBe('label.pptxSlide')
    expect(l.values).toEqual({ slide: 2 })
    expect(l.secondary).toBeUndefined()
  })

  it('docx → label.docx,插值只带 page', () => {
    const l = anchorLabel(anchors.docx)
    expect(l.key).toBe('label.docx')
    expect(l.values).toEqual({ page: 12 })
    expect(l.secondary).toBeUndefined()
  })

  it('xlsx 带 range → label.xlsx(sheet+range),次标签 label.xlsxSelected(已选择 {range})', () => {
    const l = anchorLabel(anchors.xlsx)
    expect(l.key).toBe('label.xlsx')
    expect(l.values).toEqual({ sheet: '季度汇总', range: 'A1:C9' })
    expect(l.secondary?.key).toBe('label.xlsxSelected')
    expect(l.secondary?.values).toEqual({ range: 'A1:C9' })
  })

  it('xlsx 无 range → 退化为 label.xlsxSheet({sheet}),无次标签', () => {
    const l = anchorLabel({ kind: 'xlsx', sheet: '明细' })
    expect(l.key).toBe('label.xlsxSheet')
    expect(l.values).toEqual({ sheet: '明细' })
    expect(l.secondary).toBeUndefined()
  })

  it('穷尽性(运行时面):四类各返回一个 label.* 键,id 集与词包标签 id 集对齐', () => {
    const seen = new Set<string>()
    for (const kind of ANNOTATION_ANCHOR_KINDS) {
      const l = anchorLabel(anchors[kind])
      expect(l.key.startsWith('label.'), kind).toBe(true)
      expect(ANNOTATION_ANCHOR_LABEL_IDS).toContain(l.id)
      if (l.secondary) expect(ANNOTATION_ANCHOR_LABEL_IDS).toContain(l.secondary.id)
      seen.add(l.id)
    }
    // 四类主标签四个 id,退化形 + 次标签共 8 个 id
    expect(ANNOTATION_ANCHOR_LABEL_IDS.length).toBe(8)
    expect(['pdf', 'pptx', 'docx', 'xlsx'].every((k) => seen.has(k))).toBe(true)
  })

  it('键名生成器:id → label.<id>', () => {
    for (const id of ANNOTATION_ANCHOR_LABEL_IDS) {
      expect(annotationAnchorLabelKey(id)).toBe(`label.${id}`)
    }
  })
})

describe('D91 单一状态机 / 四类共用(本票硬约束的反证)', () => {
  const SEQ: AnnotationAnchorAction[] = ['label', 'add', 'cancel', 'relabel', 'add', 'delete']
  const run = (start: AnnotationAnchorState): AnnotationAnchorState[] => {
    const trace: AnnotationAnchorState[] = [start]
    let cur = start
    for (const action of SEQ) {
      cur = applyAnchorAction(cur, action)
      trace.push(cur)
    }
    return trace
  }
  const fromLabeled = run('labeled')

  it('反证:四类锚点走同一动作序列,状态轨迹逐点一致 —— 状态机与 kind 无感', () => {
    for (const kind of ANNOTATION_ANCHOR_KINDS) {
      expect(run('labeled'), kind).toEqual(fromLabeled)
      expect(run('idle'), kind).toEqual(run('idle'))
      expect(run('cancelled'), kind).toEqual(run('cancelled'))
    }
    // 轨迹本身即生命周期:labeled → added → cancelled → labeled → added → deleted
    expect(fromLabeled).toEqual(['labeled', 'labeled', 'added', 'cancelled', 'labeled', 'added', 'deleted'])
  })

  it('模块只导出一套状态/动作词表(五态五动作,无按 kind 分叉的第二套)', () => {
    expect(ANNOTATION_ANCHOR_STATES).toEqual(['idle', 'labeled', 'added', 'cancelled', 'deleted'])
    expect(ANNOTATION_ANCHOR_ACTIONS).toEqual(['label', 'add', 'cancel', 'delete', 'relabel'])
  })

  it('转移表:label 只把 idle/cancelled/labeled 收敛为 labeled', () => {
    expect(applyAnchorAction('idle', 'label')).toBe('labeled')
    expect(applyAnchorAction('cancelled', 'label')).toBe('labeled')
    expect(applyAnchorAction('labeled', 'label')).toBe('labeled')
    expect(applyAnchorAction('added', 'label')).toBe('added')
    expect(applyAnchorAction('deleted', 'label')).toBe('deleted')
  })

  it('转移表:add 仅 labeled(及幂等 added)生效', () => {
    expect(applyAnchorAction('labeled', 'add')).toBe('added')
    expect(applyAnchorAction('added', 'add')).toBe('added')
    expect(applyAnchorAction('idle', 'add')).toBe('idle')
    expect(applyAnchorAction('cancelled', 'add')).toBe('cancelled')
    expect(applyAnchorAction('deleted', 'add')).toBe('deleted')
  })

  it('转移表:cancel 把 labeled/added 撤到 cancelled(added 撤下可重标)', () => {
    expect(applyAnchorAction('labeled', 'cancel')).toBe('cancelled')
    expect(applyAnchorAction('added', 'cancel')).toBe('cancelled')
    expect(applyAnchorAction('idle', 'cancel')).toBe('idle')
    expect(applyAnchorAction('cancelled', 'cancel')).toBe('cancelled')
    expect(applyAnchorAction('deleted', 'cancel')).toBe('deleted')
  })

  it('删除是终态:有内容的态(labeled/added/cancelled)delete ⇒ deleted,idle 无内容保持 idle', () => {
    for (const state of ANNOTATION_ANCHOR_STATES) {
      expect(applyAnchorAction(state, 'delete'), state).toBe(
        state === 'idle' ? 'idle' : 'deleted',
      )
    }
    for (const action of ANNOTATION_ANCHOR_ACTIONS) {
      expect(applyAnchorAction('deleted', action)).toBe('deleted')
    }
    expect(isTerminalAnchorState('deleted')).toBe(true)
    for (const state of ANNOTATION_ANCHOR_STATES) {
      if (state !== 'deleted') expect(isTerminalAnchorState(state)).toBe(false)
    }
  })

  it('取消可重新标注:relabel 把 cancelled 拉回 labeled;canRelabel 判据逐态可测', () => {
    expect(applyAnchorAction('cancelled', 'relabel')).toBe('labeled')
    expect(applyAnchorAction('labeled', 'relabel')).toBe('labeled')
    expect(applyAnchorAction('added', 'relabel')).toBe('added')
    expect(applyAnchorAction('deleted', 'relabel')).toBe('deleted')
    expect(canRelabel('idle')).toBe(true)
    expect(canRelabel('labeled')).toBe(true)
    expect(canRelabel('cancelled')).toBe(true)
    expect(canRelabel('added')).toBe(false) // 须先 cancel 撤下
    expect(canRelabel('deleted')).toBe(false) // 终态
  })
})

describe('D91 toTaskInput / 回流成任务输入(统一动作载体)', () => {
  it('四类坐标各自组装为 `[坐标标签] 备注`', () => {
    expect(toTaskInput(anchors.pdf, '修改这段公式', 'PDF 第 3 页')).toBe('[PDF 第 3 页] 修改这段公式')
    expect(toTaskInput(anchors.pptx, '检查排版', '第 5 张 · 标题文本框')).toBe('[第 5 张 · 标题文本框] 检查排版')
    expect(toTaskInput(anchors.docx, '校对措辞', '文档第 12 页')).toBe('[文档第 12 页] 校对措辞')
    expect(toTaskInput(anchors.xlsx, '核对合计', '季度汇总 · A1:C9')).toBe('[季度汇总 · A1:C9] 核对合计')
  })

  it('备注为空 / 纯空白 ⇒ null(不可凭空添加到任务)', () => {
    expect(toTaskInput(anchors.pdf, '', 'PDF 第 3 页')).toBeNull()
    expect(toTaskInput(anchors.pdf, '   ', 'PDF 第 3 页')).toBeNull()
  })

  it('备注两端空白被裁剪', () => {
    expect(toTaskInput(anchors.pdf, '  修改这段  ', 'PDF 第 3 页')).toBe('[PDF 第 3 页] 修改这段')
  })

  it('label 缺省(空白)→ 回退机器可读坐标前缀(诊断用,四类各形)', () => {
    expect(toTaskInput(anchors.pdf, '检查', '  ')).toBe('[pdf:p3] 检查')
    expect(toTaskInput(anchors.pptx, '检查', '')).toBe('[pptx:s5:标题文本框] 检查')
    expect(toTaskInput(anchors.docx, '检查', '')).toBe('[docx:p12] 检查')
    expect(toTaskInput(anchors.xlsx, '检查', '')).toBe('[xlsx:季度汇总!A1:C9] 检查')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
