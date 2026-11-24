// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * D43(G-51)装车锁:会话内快捷笔记必须在**生产宿主树**里被真实渲染。
 *
 * 该组件与 12 相状态机、归档桶、"一键插入对话"早在 HEAD,但生产零渲染(只被自身测试
 * import)⇒ 票面"笔记可一键插入对话"在界面上拿不到,而这正是本仓反复登记的
 * "件在库 ≠ 装上车"那一型。本文件断言的是宿主 message-input 真挂了它,
 * 注释式提及不算(阳性对照见下)。
 */

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const HOST = 'src/components/chat/message-input.tsx'

function readHost(): string {
  try {
    return readFileSync(join(APP_ROOT, HOST), 'utf8')
  } catch {
    throw new Error(`宿主正文读取失败:${HOST} —— 取不到输入即未判定,绝不回落成"没问题"`)
  }
}

describe('D43 快捷笔记的宿主挂载', () => {
  const src = readHost()
  // 去掉行注释后再判,免得"注释里提了一句"被读成已接线
  const code = src
    .split(/\r?\n/)
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')

  it("宿主从 './voice-note' 引生产出口", () => {
    expect(/import\s*\{\s*VoiceNote\s*\}\s*from\s*'\.\/voice-note'/.test(code)).toBe(true)
  })

  it('宿主 JSX 里真渲染 <VoiceNote …/>,并把当前会话 id 传进去', () => {
    const jsx = /<VoiceNote\b[^>]*\/>/.exec(code)?.[0]
    expect(jsx, '未取到 JSX 挂载点 ⇒ 未装车').toBeTruthy()
    expect(jsx, '挂载点没带 conversationId ⇒ 归档记录无从标注所属会话').toContain('conversationId')
  })

  it('阳性对照:被摘掉挂载(把 JSX 那行删掉)后,同一把尺子必须判红', () => {
    const withoutMount = code.replace(/<VoiceNote\b[^>]*\/>\n?/, '')
    expect(/<VoiceNote\b[^>]*\/>/.test(withoutMount)).toBe(false)
    expect(withoutMount.length).toBeLessThan(code.length)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
