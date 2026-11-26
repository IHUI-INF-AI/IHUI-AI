// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * shared 层 Enter 提交唯一出口守卫(2026-11-08,同型根因自查 IME 类)。
 *
 * `chat/enter-submit.ts` 已用三腿判据(本地标志 ∪ 事件 isComposing ∪ 收尾闩锁)+ 空内容
 * 闭环,本轮不改实现;本夹具的价值是「防回潮」——shared 里任何模块再写 `key === 'Enter'`
 * 都必须走 `shouldSubmitOnEnter`,否则就是又一次「只抄一条腿」的复发。
 *
 * 红证方法(故障注入):临时在 src/chat 下放一个裸 `e.key === 'Enter'` 模块,本文件应转红,
 * 删除后转绿。legacy 源码本身无缺陷,故正常状态下绿-绿。
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { shouldSubmitOnEnter } from '../enter-submit'

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url))
const ENTER_SUBMIT_FILE = path.join(SRC_DIR, 'chat', 'enter-submit.ts')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue
      walk(full, out)
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\.(ts|tsx)$/.test(entry.name)) continue
    out.push(full)
  }
  return out
}

describe('Enter 判定只能走 shared 唯一出口', () => {
  const files = walk(SRC_DIR)
  const offenders = files.filter((file) => {
    if (file === ENTER_SUBMIT_FILE) return false
    return /key\s*===\s*['"]Enter['"]/.test(fs.readFileSync(file, 'utf8'))
  })

  it('任何写 key === "Enter" 的模块都必须引入 shouldSubmitOnEnter', () => {
    expect(offenders).toEqual([])
  })

  it('enter-submit 从 chat 面导出(各端只有这一个入口)', () => {
    const chatIndex = fs.readFileSync(path.join(SRC_DIR, 'chat', 'index.ts'), 'utf8')
    expect(chatIndex).toMatch(/export \* from '\.\/enter-submit'/)
  })
})

describe('三腿判据行为(任一腿成立即不提交)', () => {
  const base = {
    key: 'Enter',
    shiftKey: false,
    defaultPrevented: false,
    localComposing: false,
    nativeComposing: false,
    justEndedComposing: false,
    hasContent: true,
  }

  it('组合期(本地标志/事件标志/收尾闩锁)任一条成立都不提交', () => {
    expect(shouldSubmitOnEnter({ ...base, localComposing: true })).toBe(false)
    expect(shouldSubmitOnEnter({ ...base, nativeComposing: true })).toBe(false)
    expect(shouldSubmitOnEnter({ ...base, justEndedComposing: true })).toBe(false)
  })

  it('正常 Enter 且非空才提交;Shift+Enter / 空内容 / 外部否决都不提交', () => {
    expect(shouldSubmitOnEnter(base)).toBe(true)
    expect(shouldSubmitOnEnter({ ...base, shiftKey: true })).toBe(false)
    expect(shouldSubmitOnEnter({ ...base, hasContent: false })).toBe(false)
    expect(shouldSubmitOnEnter({ ...base, defaultPrevented: true })).toBe(false)
  })
})

/**
 * 2026-11-26 跨端接线形状守卫(防"上屏后首次 Enter 被吞"回潮)。
 *
 * 事故形态:腿三曾把闩锁的布尔位直接填进判据(`justEndedComposing: latch.justEnded`),
 * 于是空格/数字键选词上屏后——闩锁刚置起、还没被任何 keydown 消费——用户按下的**真·发送 Enter**
 * 被判成"确认候选词"吃掉,且完全静默(用户看到的就是"输入完按 Enter 发不出去,要按第二次")。
 *
 * 为什么要在 shared 的守卫里跨端读源文件:这条缺陷的复发点不在判据本体,而在**接线**——
 * 判据再纯,任何一端把布尔位直填回去就复发一次。两端(web 输入框 / 扩展侧栏)都被逐行钉住。
 * 新增端接这条判据时,把它的接线文件加进 END_WIRINGS 即可。
 */
describe('腿三接线形状:任何端都不得把闩锁布尔位直填进判据', () => {
  const repoRoot = path.resolve(SRC_DIR, '..', '..', '..')
  const END_WIRINGS = [
    path.join(repoRoot, 'apps', 'web', 'src', 'components', 'chat', 'web-input-core.tsx'),
    path.join(
      repoRoot,
      'apps',
      'extension',
      'entrypoints',
      'sidepanel',
      'components',
      'AgentRuntimePanel.tsx',
    ),
  ].filter((file) => fs.existsSync(file))

  it('至少扫到一处真实接线(防"路径写错 ⇒ 永绿")', () => {
    expect(END_WIRINGS.length).toBeGreaterThan(0)
  })

  it('justEndedComposing 必须来自 isCompositionEndPress,不得是闩锁布尔位', () => {
    for (const file of END_WIRINGS) {
      const src = fs.readFileSync(file, 'utf8')
      expect(src).toContain('isCompositionEndPress(')
      // 复发形态:`justEndedComposing: latch.justEnded` / `… current.justEnded`
      expect(src).not.toMatch(/justEndedComposing\s*:\s*(?:[\w.]+\s*)?justEnded\b/)
    }
  })

  it('收尾必须带上时刻、按键抬起必须清闩锁、229 哨兵必须在(缺一条都会让中文发送复发或漏发)', () => {
    for (const file of END_WIRINGS) {
      const src = fs.readFileSync(file, 'utf8')
      // 漏传时刻 ⇒ 判据退回保守档 ⇒ "上屏后第一次 Enter"又被吃
      expect(src).toMatch(/noteCompositionEnd\(\s*performance\.now\(\)\s*\)/)
      // 少了 keyup 清闩锁 ⇒ "松开空格再按 Enter"被吃(keyup 是权威信号)
      expect(src).toMatch(/noteKeyUp/)
      // 少了 229 哨兵 ⇒ 旧引擎的 IME 处理期 Enter 会把半截拼音发出去
      expect(src).toMatch(/229/)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
