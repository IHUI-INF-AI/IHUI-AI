// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  buildAnalysisPrompt,
  fillTemplate,
  formatSpeakerList,
  readImportProvenance,
  type ImportProvenanceMessage,
} from '../import-analysis'
import type { ImportAnalysisScenario } from '../import-analysis-catalog.generated'

/** 微信导入后的典型消息形态(发言人写在正文前缀,时间已归一到 UTC ISO) */
const WECHAT_MESSAGES: ImportProvenanceMessage[] = [
  { content: '张三：明天下午三点开评审会', createdAt: '2026-09-05T00:05:00.000Z' },
  { content: '李四：收到，我把材料准备好', createdAt: '2026-09-05T00:06:00.000Z' },
  { content: '张三：另外埋点方案我周五前给结论', createdAt: '2026-09-05T02:30:00.000Z' },
  // 微信系统消息会被并进上一条正文(wechat.py 已知行为),前缀形态与发言人不同
  { content: '你撤回了一条消息', createdAt: '2026-09-05T02:31:00.000Z' },
  { content: '李四：好', createdAt: '2026-09-05T03:00:00.000Z' },
]

const WECHAT_META = {
  importedFrom: 'wechat',
  importedVia: 'conversation-import',
  fileName: '合并转发.zip',
}

describe('readImportProvenance', () => {
  it('读出 wechat 来源 + 文件名(D28 落库时写入、此前只写不读的字段)', () => {
    const r = readImportProvenance(WECHAT_META, WECHAT_MESSAGES)
    expect(r.kind).toBe('imported')
    if (r.kind !== 'imported') return
    expect(r.provenance.source).toBe('wechat')
    expect(r.provenance.via).toBe('conversation-import')
    expect(r.provenance.fileName).toBe('合并转发.zip')
  })

  it('自建会话(无 importedFrom)判为 none —— UI 据此整条不渲染,不用"未知来源"占位', () => {
    expect(readImportProvenance(null).kind).toBe('none')
    expect(readImportProvenance({}).kind).toBe('none')
    expect(readImportProvenance({ pendingQuestion: null }).kind).toBe('none')
    expect(readImportProvenance('not-an-object').kind).toBe('none')
    expect(readImportProvenance([1, 2]).kind).toBe('none')
  })

  it('importedFrom 不是合法来源枚举时判 none(不拿任意字符串冒充来源)', () => {
    expect(
      readImportProvenance({ importedFrom: 'evil_tool', importedVia: 'conversation-import' }).kind,
    ).toBe('none')
  })

  it('importedFrom 在但 importedVia 缺失时判 none(无法区分通道,宁可不显示)', () => {
    expect(readImportProvenance({ importedFrom: 'wechat' }).kind).toBe('none')
    expect(readImportProvenance({ importedFrom: 'wechat', importedVia: '' }).kind).toBe('none')
  })

  it('wechat:发言人按出现次数降序,系统消息不混入发言人', () => {
    const r = readImportProvenance(WECHAT_META, WECHAT_MESSAGES)
    if (r.kind !== 'imported') throw new Error('expected imported')
    // 张三 2 条、李四 2 条 → 同频按首次出现次序:张三先
    expect(r.provenance.speakers).toEqual(['张三', '李四'])
  })

  it('wechat:时间跨度取首末消息,不拿导入时刻冒充记录时间', () => {
    const r = readImportProvenance(WECHAT_META, WECHAT_MESSAGES)
    if (r.kind !== 'imported') throw new Error('expected imported')
    expect(r.provenance.startedAt).toBe('2026-09-05T00:05:00.000Z')
    expect(r.provenance.endedAt).toBe('2026-09-05T03:00:00.000Z')
  })

  it('wechat:收毫秒时间戳(web store 的 ChatMessage.createdAt 形态)', () => {
    const r = readImportProvenance(WECHAT_META, [
      { content: '甲：早', createdAt: Date.parse('2026-09-05T00:05:00.000Z') },
      { content: '甲：晚', createdAt: Date.parse('2026-09-05T03:00:00.000Z') },
    ])
    if (r.kind !== 'imported') throw new Error('expected imported')
    expect(r.provenance.startedAt).toBe('2026-09-05T00:05:00.000Z')
    expect(r.provenance.endedAt).toBe('2026-09-05T03:00:00.000Z')
  })

  it('宽松时间文本("昨天"/"2026")不算时间 —— 展示假时间比不展示更糟', () => {
    const r = readImportProvenance(WECHAT_META, [
      { content: '甲：早', createdAt: '昨天' },
      { content: '甲：晚', createdAt: '2026' },
    ])
    if (r.kind !== 'imported') throw new Error('expected imported')
    expect(r.provenance.startedAt).toBeNull()
    expect(r.provenance.endedAt).toBeNull()
  })

  it('非 wechat 来源不算发言人/时间(编程会话正文里的冒号不是发言人)', () => {
    const r = readImportProvenance(
      { importedFrom: 'claude_code', importedVia: 'conversation-import', fileName: null },
      [{ content: 'user: refactor this', createdAt: '2026-09-05T00:05:00.000Z' }],
    )
    if (r.kind !== 'imported') throw new Error('expected imported')
    expect(r.provenance.speakers).toEqual([])
    expect(r.provenance.startedAt).toBeNull()
  })

  it('fileName 为 null / 空串时归 null,不显示空白文件名', () => {
    const r = readImportProvenance(
      { importedFrom: 'codex', importedVia: 'conversation-import', fileName: '' },
    )
    if (r.kind !== 'imported') throw new Error('expected imported')
    expect(r.provenance.fileName).toBeNull()
  })
})

describe('formatSpeakerList', () => {
  it('不超过 limit 时全列', () => {
    expect(formatSpeakerList(['甲', '乙'], 5)).toBe('甲、乙')
  })

  it('超过 limit 时只列前 limit 个 + 余量(群聊几十人不该把来源条撑爆)', () => {
    expect(formatSpeakerList(['甲', '乙', '丙', '丁'], 2)).toBe('甲、乙 +2')
  })

  it('空清单返回空串(调用方据此整段不渲染)', () => {
    expect(formatSpeakerList([])).toBe('')
  })
})

describe('fillTemplate', () => {
  const pending = (name: string) => `（待补充：${name}）`

  it('填了的变量替换为 trim 后的值', () => {
    expect(fillTemplate('代码：{code}', { code: '  function f() {}  ' }, pending)).toBe(
      '代码：function f() {}',
    )
  })

  it('未填/填空白的变量替换为可见的待补充标记,不删占位符', () => {
    // 删掉占位符会让模型以为那条要求不存在,静默漏掉用户本想分析的内容
    expect(fillTemplate('背景：{background}', {}, pending)).toBe('背景：（待补充：background）')
    expect(fillTemplate('背景：{background}', { background: '   ' }, pending)).toBe(
      '背景：（待补充：background）',
    )
  })

  it('模板里出现但 variables 清单没列的占位符,同样按未填处理(不猜)', () => {
    expect(fillTemplate('X {unknownVar}', { known: 'v' }, pending)).toBe('X （待补充：unknownVar）')
  })
})

describe('buildAnalysisPrompt', () => {
  const scenario: ImportAnalysisScenario = {
    id: 'test',
    categoryId: '06',
    title: '知识笔记整理',
    description: '把信息整理成结构化笔记',
    useCase: '读书笔记、学习总结',
    variables: ['raw_info', 'purpose'],
    tags: [],
    difficulty: 'intermediate',
    estimatedTokens: 850,
    template: '原始信息：{raw_info}\n目的：{purpose}',
  }

  it('产出:场景名 + 记录在上下文中的提示 + 填好的模板正文', () => {
    const out = buildAnalysisPrompt(
      scenario,
      { raw_info: '本次导入的聊天记录', purpose: '提取待办' },
      (n) => `（待补充：${n}）`,
    )
    expect(out).toContain('知识笔记整理')
    expect(out).toContain('读书笔记、学习总结')
    expect(out).toContain('原始信息：本次导入的聊天记录')
    expect(out).toContain('目的：提取待办')
    // 关键口径:不把正文重贴一遍(历史里已是全文,重贴双倍计费/超上下文)
    expect(out).toContain('以上是本次导入的会话记录全文')
  })

  it('有未填变量时在尾部点名,而不是悄悄丢掉那条要求', () => {
    const out = buildAnalysisPrompt(scenario, { raw_info: '聊天记录' }, (n) => `（待补充：${n}）`)
    expect(out).toContain('（待补充：purpose）')
    expect(out).toContain('本次未填写的变量')
  })

  it('变量全填时不追加"未填写"尾巴', () => {
    const out = buildAnalysisPrompt(
      scenario,
      { raw_info: 'a', purpose: 'b' },
      (n) => `（待补充：${n}）`,
    )
    expect(out).not.toContain('本次未填写的变量')
  })

  it('要求模型对记录中不存在的信息明确标注,不许编造', () => {
    const out = buildAnalysisPrompt(scenario, {}, (n) => `（待补充：${n}）`)
    expect(out).toContain('记录中未提及')
    expect(out).toContain('不要推测或编造')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
