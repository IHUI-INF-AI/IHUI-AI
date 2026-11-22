// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * tool-call-card 参数兜底回归测试(2026-09-21 立)。
 *
 * 无参工具(web_ui_describe / web_ui_read 这类)的 toolCall 落库后 args 字段会整个丢掉,
 * 而 deriveDiffInfo / extractToolUrl 在 message-list 的**渲染路径**上索引它 ——
 * 一旦 undefined 就抛 `Cannot read properties of undefined (reading 'path')`,
 * 后果不是某个卡片空了,而是**整个聊天页被错误边界接管**("应用发生严重错误")。
 * 真实触发路径:让 AI 导航一次,回到聊天页看历史 tool call 即复现。
 */
import { describe, it, expect } from 'vitest'
import { deriveDiffInfo, extractToolArtifact } from '@/components/ai/tool-call-card'

describe('extractToolArtifact - 工件指针只认严格形状', () => {
  const ID = '0123456789abcdef0123456789abcdef'

  it('对象形态:命中 artifactId 并带 originalChars', () => {
    expect(extractToolArtifact({ artifactId: ID, originalChars: 20480 })).toEqual({
      artifactId: ID,
      originalChars: 20480,
    })
  })

  it('字符串形态:JSON 文本同样解析', () => {
    expect(extractToolArtifact(JSON.stringify({ artifactId: ID }))).toEqual({
      artifactId: ID,
      originalChars: undefined,
    })
  })

  it('形状不符一律 null(不做拼接式猜测)', () => {
    expect(extractToolArtifact(undefined)).toBeNull()
    expect(extractToolArtifact('not-json')).toBeNull()
    expect(extractToolArtifact({ artifactId: 'zzzz' })).toBeNull()
    expect(extractToolArtifact({ artifactId: ID.toUpperCase() })).toBeNull()
    expect(extractToolArtifact([{ artifactId: ID }])).toBeNull()
  })

  it('originalChars 非正数时降级为 undefined', () => {
    expect(extractToolArtifact({ artifactId: ID, originalChars: 0 })?.originalChars).toBeUndefined()
    expect(
      extractToolArtifact({ artifactId: ID, originalChars: -1 })?.originalChars,
    ).toBeUndefined()
  })
})

describe('deriveDiffInfo - args 缺失必须兜底', () => {
  it('无参工具的 args 为 undefined 时不抛错,返回 null', () => {
    expect(() => deriveDiffInfo('web_ui_describe', undefined)).not.toThrow()
    expect(deriveDiffInfo('web_ui_describe', undefined)).toBeNull()
  })

  it('文件类工具缺 args 时也不抛错(拿不到内容就该返回 null)', () => {
    expect(deriveDiffInfo('edit_file', undefined)).toBeNull()
    expect(deriveDiffInfo('write_file', undefined)).toBeNull()
  })

  it('args 为空对象时同样安全', () => {
    expect(deriveDiffInfo('web_ui_invoke', {})).toBeNull()
  })

  it('正常 edit_file 参数仍然工作(兜底不得削弱原路径)', () => {
    const got = deriveDiffInfo('edit_file', {
      path: 'a.ts',
      oldText: 'x',
      newText: 'y',
    })
    expect(got).toEqual({ file_path: 'a.ts', old_content: 'x', new_content: 'y' })
  })

  it('dryRun 预览调用不得产出可 Apply 的 diff 卡', () => {
    const got = deriveDiffInfo('edit_file', {
      path: 'a.ts',
      oldText: 'x',
      newText: 'y',
      dryRun: true,
    })
    expect(got).toBeNull()
  })

  it('edits[] 多编辑不给单一 diff 卡(无 Apply 入口)', () => {
    const got = deriveDiffInfo('edit_file', {
      path: 'a.ts',
      edits: [
        { oldText: 'x', newText: 'y' },
        { oldText: 'z', newText: 'w' },
      ],
    })
    expect(got).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
