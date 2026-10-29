// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * D43(G-51)票③ RN 腿装车锁:语音笔记必须在 mobile-rn 生产宿主树里被真实渲染。
 *
 * 判据与 apps/web/src/components/chat/__tests__/voice-note-mount.test.tsx 同尺:
 * 注释式提及不算;「摘掉挂载必红」有阳性对照。RN 侧宿主有两处 ——
 * HomeScreen 大输入框(InputArea.voiceNoteNode 槽)与 ChatScreen 会话屏
 * (ChatInputBar.voiceNoteNode 槽,票面语义「会话内」的正主)。
 * 另锁 i18n:组件用到的 chat.voiceNote.* 键必须在 mobile-rn 五语包逐包存在,
 * 且 12 相标签全量齐(缺键时 translate 原样吐键名 = 界面漏裸键)。
 */

const HERE = dirname(fileURLToPath(import.meta.url))

function readSource(rel: string): string {
  try {
    return readFileSync(join(HERE, rel), 'utf8')
  } catch {
    throw new Error(`宿主正文读取失败:${rel} —— 取不到输入即未判定,绝不回落成"没问题"`)
  }
}

/** 去掉行注释后再判,免得"注释里提了一句"被读成已接线 */
function stripComments(src: string): string {
  return src
    .split(/\r?\n/)
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')
}

const HOSTS = [
  { rel: '../src/screens/HomeScreen.tsx', label: 'HomeScreen(大输入框)' },
  { rel: '../src/screens/ChatScreen.tsx', label: 'ChatScreen(会话屏)' },
] as const

describe('D43 语音笔记的 RN 宿主挂载', () => {
  for (const { rel, label } of HOSTS) {
    const code = stripComments(readSource(rel))

    it(`${label}:从 '../components/chat/VoiceNote' 引生产出口`, () => {
      expect(
        /import\s*\{\s*VoiceNote\s*\}\s*from\s*'\.\.\/components\/chat\/VoiceNote'/.test(code),
        `${label} 没有引 VoiceNote 生产出口`,
      ).toBe(true)
    })

    it(`${label}:JSX 里真渲染 <VoiceNote …/> 并经 voiceNoteNode 槽传入宿主`, () => {
      expect(/voiceNoteNode=\{/.test(code), `${label} 没有 voiceNoteNode 挂载槽`).toBe(true)
      // 非贪婪到首个 `/>`:props 里的箭头函数含 `>`,[^>]* 会被截断 ⇒ 必须 [\s\S]*?
      const jsx = /<VoiceNote\b[\s\S]*?\/>/.exec(code)?.[0]
      expect(jsx, `${label} 未取到 JSX 挂载点 ⇒ 未装车`).toBeTruthy()
      expect(jsx, `${label} 挂载点没带 conversationId ⇒ 归档记录无从标注所属会话`).toContain(
        'conversationId',
      )
      expect(jsx, `${label} 挂载点没带 onInsert ⇒ 「插入对话」出口未接`).toContain('onInsert')
    })

    it(`${label}:阳性对照 —— 摘掉挂载后同一把尺子必须判红`, () => {
      const withoutMount = code.replace(/<VoiceNote\b[\s\S]*?\/>\n?/, '')
      expect(withoutMount.length, '摘除动作本身没生效').toBeLessThan(code.length)
      expect(/<VoiceNote\b[\s\S]*?\/>/.test(withoutMount)).toBe(false)
    })
  }

  it('两个宿主槽位都真渲染:InputArea 与 ChatInputBar 各自消费 voiceNoteNode', () => {
    for (const rel of [
      '../src/components/InputArea.tsx',
      '../src/components/chat/ChatInputBar.tsx',
    ]) {
      const code = stripComments(readSource(rel))
      expect(/voiceNoteNode\s*\?/.test(code), `${rel} 的 voiceNoteNode 槽没有被渲染消费`).toBe(true)
    }
  })
})

describe('D43 语音笔记的 RN i18n 锁(五语包逐包)', () => {
  const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']
  const PHASES = [
    'ready',
    'requestingPermission',
    'preparingMedia',
    'connecting',
    'recording',
    'stopping',
    'waitingTranscript',
    'completed',
    'cancelled',
    'failed',
    'error',
    'interrupted',
  ]
  const ERRORS = [
    'permission',
    'startFailed',
    'saveFailed',
    'recognitionFailed',
    'sttPending',
    'loadFailed',
  ]
  // cancel 是 2026-10-27 D03 RN 腿新增的动作键(录音中显式取消 ⇒ cancelled 相),
  // 与 action 键一一对应由组件静态取词那组兜底,这里把白名单同步齐。
  const ACTIONS = ['start', 'stop', 'retry', 'saveAudioOnly', 'insertToInput', 'cancel', 'dismiss']

  for (const loc of LOCALES) {
    it(`${loc}:chat.voiceNote 子树齐(12 相 + 组件用到的 errors/action/顶层键)`, () => {
      const pack = JSON.parse(
        readSource(`../../../packages/i18n/messages/mobile-rn/${loc}.json`),
      ) as Record<string, { voiceNote?: Record<string, unknown> }>
      const vn = pack.chat?.voiceNote as
        | {
            title?: string
            searchPlaceholder?: string
            groupAll?: string
            phase?: Record<string, string>
            errors?: Record<string, string>
            action?: Record<string, string>
          }
        | undefined
      expect(vn, `${loc}: chat.voiceNote 整块缺失`).toBeTruthy()
      expect(typeof vn?.title === 'string' && vn.title.length > 0, `${loc}: title 缺`).toBe(true)
      expect(
        typeof vn?.searchPlaceholder === 'string' && vn.searchPlaceholder.length > 0,
        `${loc}: searchPlaceholder 缺`,
      ).toBe(true)
      expect(
        typeof vn?.groupAll === 'string' && vn.groupAll.length > 0,
        `${loc}: groupAll 缺`,
      ).toBe(true)
      for (const phase of PHASES) {
        expect(
          typeof vn?.phase?.[phase] === 'string' && (vn?.phase?.[phase] ?? '').length > 0,
          `${loc}: phase.${phase} 缺(徽章将漏裸键)`,
        ).toBe(true)
      }
      for (const err of ERRORS) {
        expect(
          typeof vn?.errors?.[err] === 'string' && (vn?.errors?.[err] ?? '').length > 0,
          `${loc}: errors.${err} 缺`,
        ).toBe(true)
      }
      for (const action of ACTIONS) {
        expect(
          typeof vn?.action?.[action] === 'string' && (vn?.action?.[action] ?? '').length > 0,
          `${loc}: action.${action} 缺`,
        ).toBe(true)
      }
    })
  }

  it('组件静态取词逐枚在五语包存在(动态相/错误码由上组 12+6 全量锁兜底)', () => {
    const src = readSource('../src/components/chat/VoiceNote.tsx')
    const keys = [...src.matchAll(/t\('(chat\.voiceNote\.[A-Za-z.]+)'\)/g)]
      .map((m) => m[1])
      .filter((k): k is string => Boolean(k))
    expect(keys.length, '组件里没取到任何静态键(尺子空转)').toBeGreaterThanOrEqual(4)
    for (const loc of LOCALES) {
      const pack = JSON.parse(
        readSource(`../../../packages/i18n/messages/mobile-rn/${loc}.json`),
      ) as Record<string, unknown>
      for (const key of keys) {
        const value = key
          .split('.')
          .reduce<unknown>(
            (acc, seg) =>
              acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[seg] : undefined,
            pack,
          )
        expect(typeof value === 'string' && value.length > 0, `${loc}: ${key} 缺`).toBe(true)
      }
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
