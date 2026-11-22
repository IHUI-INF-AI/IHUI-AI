// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 注入表达式自足性回归（P0 永久防线）。
 *
 * 钉的是这一类故障：页内安装函数按 `Function.prototype.toString()` 取源，取到的是
 * **当前转译档案下的 JS 文本**。esbuild 的 keepNames 会往源里插 `__name(fn, "名")` 辅助调用，
 * 而那个辅助符声明在模块作用域 —— 被 CDP 打进页面后它不存在，于是真实 CLI 路径上
 * 每一次页面快照都以 `ReferenceError: __name is not defined` 收场（vitest 档案下不插，故全绿）。
 * 结论：**注入源的可执行性取决于宿主用哪种打包器**，所以修复必须是"表达式自带所需辅助符"，
 * 而不是换打包器、或往仓库里复制第二份手写的页内实现。
 *
 * 判据用 `node:vm` 起一个**没有任何模块作用域**的上下文来跑，并喂进源真正用到的最小 DOM 桩。
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import {
  PAGE_SNAPSHOT_SCHEMA,
  buildPageApiInstallExpression,
  buildPageApiOptions,
  injectedHelperNeeds,
  pageApiInstallerSource,
  wrapInstallerSource,
} from '@ihui/dom-actions'

const SCOPE = 'inject1'
const HERE = dirname(fileURLToPath(import.meta.url))
const BUDGET = { maxRows: 40, maxRowChars: 200, bodyChars: 120, maxBodyBlocks: 20, attrsChars: 60, labelChars: 40 }

/** 最小 DOM 桩：只实现安装源真正调用的那几个成员，多一个都不写。 */
function makeCleanContext(): vm.Context {
  const button: Record<string, unknown> = {
    tagName: 'BUTTON',
    id: 'b1',
    hidden: false,
    textContent: '提交',
    isConnected: true,
    attributes: [],
    getAttribute: (name: string) => (name === 'type' ? 'button' : null),
    hasAttribute: () => false,
    closest: () => null,
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 100, height: 30 }),
  }
  const document = {
    title: '注入回归页',
    querySelectorAll: () => [button],
    querySelector: () => null,
    getElementById: () => null,
    defaultView: null,
  }
  button.ownerDocument = document
  return vm.createContext({
    document,
    location: { href: 'https://inject.test/' },
    window: {
      innerWidth: 800,
      innerHeight: 600,
      getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
    },
  })
}

/** 在干净作用域里跑一段表达式（每次新上下文 ⇒ 无任何模块作用域可逃逸）。 */
function evalInCleanScope(expression: string): unknown {
  return vm.runInContext(`(${expression})`, makeCleanContext(), { timeout: 5000 })
}

/**
 * 粗粒度剥掉注释（行注释 + 块注释），用于"判代码不判散文"的文本判据。
 * 注释里正当提及被禁形态（解释"为什么不许这么写"）不得被判成违规，否则等于禁止把教训写下来。
 * 刻意只做这一件事：会把字符串里的 `//`、`/*` 一起当注释起点，对本判据只会更宽，不会放过违规。
 */
function stripComments(text: string): string {
  const out: string[] = []
  let inBlock = false
  for (const raw of text.split('\n')) {
    let line = ''
    for (let i = 0; i < raw.length; i++) {
      const two = raw.slice(i, i + 2)
      if (inBlock) {
        if (two === '*/') {
          inBlock = false
          i++
        }
        continue
      }
      if (two === '/*') {
        inBlock = true
        i++
        continue
      }
      if (two === '//') break
      line += raw[i]
    }
    out.push(line)
  }
  return out.join('\n')
}

describe('页内注入表达式的自足性', () => {
  it('表达式在没有任何模块作用域的上下文里安装成功', () => {
    const expression = buildPageApiInstallExpression(buildPageApiOptions(SCOPE))
    const installed = evalInCleanScope(expression) as {
      installed: boolean
      scope: string
      schema: number
      reused: boolean
    }
    expect(installed).toMatchObject({
      installed: true,
      scope: SCOPE,
      schema: PAGE_SNAPSHOT_SCHEMA,
      reused: false,
    })
    // 同一个文档里再装一次：同 schema 必须复用既有 scope（句柄表不得被清空）。
    // 必须复用同一个 context —— 换新上下文等于换了个文档，"复用"无从谈起。
    const sameContext = makeCleanContext()
    vm.runInContext(expression, sameContext, { timeout: 5000 })
    const again = vm.runInContext(expression, sameContext) as { reused: boolean; scope: string }
    expect(again).toMatchObject({ reused: true, scope: SCOPE })
  })

  it('表达式装出的 API 在干净作用域里真能采到一行（页内函数体逐步执行不 ReferenceError）', () => {
    const context = makeCleanContext()
    const opts = buildPageApiOptions(SCOPE)
    vm.runInContext(buildPageApiInstallExpression(opts), context, { timeout: 5000 })
    const raw = vm.runInContext(
      `this[${JSON.stringify(opts.globalKey)}].api.snapshot(${JSON.stringify(BUDGET)})`,
      context,
    ) as { scope: string; schema: number; rows: { handle: string; role: string; name: string }[] }
    // scope/schema 只能来自 opts ⇒ 采得到结果即证明函数体没有回头去够模块作用域的常量
    expect(raw.scope).toBe(SCOPE)
    expect(raw.schema).toBe(PAGE_SNAPSHOT_SCHEMA)
    expect(raw.rows).toHaveLength(1)
    expect(raw.rows[0]).toMatchObject({ role: 'button', name: '提交' })
    const state = vm.runInContext(
      `this[${JSON.stringify(opts.globalKey)}].api.state()`,
      context,
    ) as { handles: number }
    expect(state.handles).toBe(1)
  })

  describe('反向对照（证明这套判据有牙，不是恰好绿）', () => {
    it('裸 .toString() 源在同样的干净作用域下必须失败；当前档案若不失败则如实报出依据', () => {
      const source = pageApiInstallerSource()
      const needs = injectedHelperNeeds(source)
      if (needs.length > 0) {
        // 当前档案确实插了辅助符 ⇒ 裸源必须崩，且崩在我们兜的那个名字上
        let error: unknown = null
        try {
          evalInCleanScope(`(${source})(${JSON.stringify(buildPageApiOptions(SCOPE))})`)
        } catch (e) {
          error = e
        }
        expect(error).toBeInstanceOf(ReferenceError)
        expect(String((error as Error).message)).toContain(needs[0])
        console.log(`[有牙] 当前转译档案注入辅助符 ${needs.join(', ')} ⇒ 裸源在干净作用域下如预期失败`)
      } else {
        // 本档案（vitest）没插辅助符 ⇒ 这一枚对照**在此档案下**没有牙；如实打印依据，不删判据
        console.log(
          '[本档案无牙] pageApiInstallerSource() 本次实测不含任何模块作用域辅助符调用' +
            '（injectedHelperNeeds 为空 ⇒ 当前是未开 keepNames 的转译档案），故裸源"意外可执行"属预期。' +
            '该对照只在插入辅助符的档案（如 tsx / 生产打包）下有牙；' +
            '任何档案下的牙由下面两条合成用例恒定兜住。',
        )
        expect(needs).toEqual([])
      }
    })

    it('合成用例：引用未声明辅助符的裸源必崩，而经 wrapInstallerSource 包装后必成', () => {
      const synthetic =
        'function fakeInstaller(opts) { var key = opts.globalKey; var keep = function keepIt() { return key }; ' +
        '__name(keep, "keepIt"); this[key] = { installed: true, fn: keep }; return { installed: true, scope: opts.scope } }'
      const optsJson = JSON.stringify({ globalKey: '__probeKey', scope: 'zz' })
      expect(() => evalInCleanScope(`(${synthetic})(${optsJson})`)).toThrowError(/__name is not defined/)
      const wrapped = wrapInstallerSource(synthetic, optsJson)
      expect(evalInCleanScope(wrapped)).toEqual({ installed: true, scope: 'zz' })
    })

    it('未知辅助符必须在装配期抛错，而不是把注定崩的表达式发进页面', () => {
      expect(() => wrapInstallerSource('function f(o) { return __mystery(o) }', '{}')).toThrowError(
        /未登记的打包器辅助符：__mystery/,
      )
    })
  })

  describe('安装源自足性静态自检（防止重新引入闭包依赖）', () => {
    it('页内函数体不得引用共享包模块作用域里的导出名', () => {
      const source = pageApiInstallerSource()
      // 安装函数自身的名字必然出现在源文本里；打包器辅助符由表达式兜
      const allowed = new Set(['installIhuiPageApi', '__name'])
      const pageApiModule = readFileSync(
        resolve(HERE, '../../../packages/dom-actions/src/page-snapshot/page-api.ts'),
        'utf8',
      )
      const names = new Set<string>()
      for (const m of pageApiModule.matchAll(/^export (?:const|function|class) ([A-Za-z_$][\w$]*)/gm)) {
        names.add(m[1] as string)
      }
      // 判据面必须有内容，否则"零禁运名"是判据失效而非通过
      expect(names.size).toBeGreaterThan(5)
      const offenders: string[] = []
      for (const name of names) {
        if (allowed.has(name)) continue
        if (new RegExp(`\\b${name}\\b`).test(source)) offenders.push(name)
      }
      expect(offenders, `安装源引用了模块作用域标识符，注入后必为 undefined：${offenders.join(', ')}`).toEqual([])
    })

    it('CLI 与扩展两端都不得在端内自己拼注入表达式（唯一装配点在共享包）', () => {
      const cli = readFileSync(resolve(HERE, '../src/tools/browser-page.ts'), 'utf8')
      const adapter = readFileSync(
        resolve(HERE, '../../../apps/extension/lib/page-snapshot-adapter.ts'),
        'utf8',
      )
      expect(cli).toContain('buildPageApiInstallExpression')
      expect(adapter).toContain('buildPageApiInstallExpression')
      // 端内不得出现 `(${source})(...)` 这种就地拼接。判据只看**代码**：注释里正当提及这一形态
      // （解释"为什么不许这么写"）不得被当成违规，否则等于禁止把教训写下来。
      const splicePattern = /\(\s*\$\{\s*source\s*\}\s*\)\s*\(/
      expect(stripComments(cli)).not.toMatch(splicePattern)
      expect(stripComments(adapter)).not.toMatch(splicePattern)
      // 表达式装配点全仓只此一处
      const shared = readFileSync(
        resolve(HERE, '../../../packages/dom-actions/src/page-snapshot/install-expression.ts'),
        'utf8',
      )
      expect(shared.match(/function buildPageApiInstallExpression/g)).toHaveLength(1)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
