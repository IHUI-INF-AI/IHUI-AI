// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WP-7 镜像测试（包内自证面）：语义快照契约 + 宿主序列化 + 注入表达式自足性。
 *
 * 判据与消费端 `apps/cli/tests/browser-page-snapshot{,-injection}.test.ts` 同源镜像
 * （夹具形态、断言口径一致），差别只在运行器：本包无 vitest 依赖，用 Node 内建
 * `node --test` 跑编译产物 `dist/index.js`（先 build 后 test，见 package.json `test` 脚本）。
 * 真实浏览器接线（扩展 content script / CLI CDP 真页）不在此面，归消费端 cdp 测试与他票。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {
  DEFAULT_PAGE_SNAPSHOT_BUDGET,
  PAGE_ACTIONS,
  PAGE_ATTR_WHITELIST,
  PAGE_API_GLOBAL_KEY,
  PAGE_HANDLE_PREFIX,
  PAGE_HANDLE_SCOPE_LENGTH,
  PAGE_READONLY_ACTIONS,
  PAGE_SNAPSHOT_BUDGET_CAPS,
  PAGE_SNAPSHOT_SCHEMA,
  SNAPSHOT_ROW_PROTECTED_FIELDS,
  SNAPSHOT_TOP_LEVEL_DROP_ORDER,
  buildPageApiInstallExpression,
  buildPageApiOptions,
  clampPageSnapshotBudget,
  dispatchedOutcome,
  formatPageHandle,
  injectedHelperNeeds,
  isPageAction,
  isWhitelistedAttr,
  newPageScope,
  normalizeAttrName,
  outcomeOf,
  parsePageHandle,
  renderEmptySnapshot,
  renderSnapshot,
  runPageAction,
  serializeSnapshotResult,
  snapshotOutcomeOf,
  wrapInstallerSource,
} from '@ihui/dom-actions'

const SCOPE = 'abcdefgh'

function row(serial, over = {}) {
  return {
    handle: formatPageHandle(SCOPE, serial),
    role: 'button',
    name: `按钮 ${serial}`,
    value: 'x',
    inViewport: true,
    depth: 3,
    attrs: { id: `b${serial}` },
    rect: [10, 20, 100, 30],
    ...over,
  }
}

function rawOf(overrides = {}) {
  return {
    schema: PAGE_SNAPSHOT_SCHEMA,
    scope: SCOPE,
    title: '测试页',
    url: 'https://example.test/',
    rows: [row(0), row(1)],
    body: [{ text: '甲'.repeat(50), heading: '第一章' }],
    counts: {
      interactiveFound: 2,
      rowsEmitted: 2,
      bodyCharsFound: 50,
      bodyCharsEmitted: 50,
      crossOriginFrames: 0,
    },
    ...overrides,
  }
}

function budgetOf(over = {}) {
  return {
    maxRows: 40,
    maxRowChars: 200,
    bodyChars: 120,
    maxBodyBlocks: 20,
    attrsChars: 60,
    labelChars: 40,
    ...over,
  }
}

describe('契约：句柄格式与动作面常量', () => {
  it('页内拼出的句柄必须被宿主解析器原样读回', () => {
    const handle = formatPageHandle(SCOPE, 42)
    assert.equal(handle, `${PAGE_HANDLE_PREFIX}:${SCOPE}:${(42).toString(36)}`)
    assert.deepEqual(parsePageHandle(handle), { scope: SCOPE, serial: 42 })
  })

  it('非规范串一律判不合法，不得当成"没找到"糊过去', () => {
    assert.equal(parsePageHandle(`el:${'x'.repeat(PAGE_HANDLE_SCOPE_LENGTH - 1)}:1`), null)
    assert.equal(parsePageHandle('css:#submit'), null)
    assert.equal(parsePageHandle(`el:${SCOPE}:00`), null)
    assert.equal(parsePageHandle(undefined), null)
    assert.equal(parsePageHandle(`el:${SCOPE}:-1`), null)
  })

  it('七个动词全部在册，只读动词是其后子集', () => {
    assert.equal(PAGE_ACTIONS.length, 7)
    assert.equal(isPageAction('page_snapshot'), true)
    assert.equal(isPageAction('click_element'), false)
    for (const readonly of PAGE_READONLY_ACTIONS) {
      assert.ok(PAGE_ACTIONS.includes(readonly))
    }
  })

  it('结构版本 / 全局键 / 顶层丢弃阶梯按契约字面在册', () => {
    assert.equal(PAGE_SNAPSHOT_SCHEMA, 1)
    assert.equal(PAGE_API_GLOBAL_KEY, '__ihuiPageApiV1')
    assert.equal(PAGE_HANDLE_SCOPE_LENGTH, 8)
    assert.deepEqual([...SNAPSHOT_TOP_LEVEL_DROP_ORDER], ['url', 'title', 'scope', 'body'])
  })

  it('属性白名单：命中与归一化同判，class/style 一律不进表', () => {
    assert.ok(PAGE_ATTR_WHITELIST.includes('href'))
    assert.equal(isWhitelistedAttr('Aria-Expanded'), true)
    assert.equal(normalizeAttrName('Data-TestID'), 'data-testid')
    assert.equal(isWhitelistedAttr('class'), false)
    assert.equal(isWhitelistedAttr('style'), false)
  })
})

describe('契约：预算分账（正文不得吃掉句柄配额）', () => {
  it('正文体积远超预算时，出行数仍等于句柄配额', () => {
    const fat = rawOf({
      rows: Array.from({ length: 40 }, (_, i) => row(i)),
      body: Array.from({ length: 12 }, (_, i) => ({ text: `段落${i}：` + '乙'.repeat(400) })),
      counts: {
        interactiveFound: 40,
        rowsEmitted: 40,
        bodyCharsFound: 4800,
        bodyCharsEmitted: 4800,
        crossOriginFrames: 0,
      },
    })
    const result = serializeSnapshotResult(fat, budgetOf())
    assert.equal(result.rows.length, 40)
    const emitted = result.body.reduce((sum, block) => sum + block.text.length, 0)
    assert.ok(emitted <= 120)
    assert.match(result.notices.join('\n'), /正文预算/)
  })

  it('句柄配额截行时不牵连正文', () => {
    const many = rawOf({
      rows: Array.from({ length: 60 }, (_, i) => row(i)),
      counts: {
        interactiveFound: 60,
        rowsEmitted: 60,
        bodyCharsFound: 50,
        bodyCharsEmitted: 50,
        crossOriginFrames: 0,
      },
    })
    const result = serializeSnapshotResult(many, budgetOf())
    assert.equal(result.rows.length, 40)
    assert.equal(result.body.length, 1)
    assert.match(result.notices.join('\n'), /未出表/)
  })

  it('越界预算被钳到上限而不是抛错（预算来自模型传参，报错等于打死可用请求）', () => {
    const clamped = clampPageSnapshotBudget({ maxRows: 999999, bodyChars: -5, maxRowChars: 'x' })
    assert.equal(clamped.maxRows, PAGE_SNAPSHOT_BUDGET_CAPS.maxRows)
    assert.equal(clamped.bodyChars, DEFAULT_PAGE_SNAPSHOT_BUDGET.bodyChars)
    assert.equal(clamped.maxRowChars, DEFAULT_PAGE_SNAPSHOT_BUDGET.maxRowChars)
    assert.deepEqual(clampPageSnapshotBudget(null), DEFAULT_PAGE_SNAPSHOT_BUDGET)
  })

  it('跨域 iframe 只登记不解析，逐条进 notices', () => {
    const withCross = rawOf({
      counts: {
        interactiveFound: 2,
        rowsEmitted: 2,
        bodyCharsFound: 50,
        bodyCharsEmitted: 50,
        crossOriginFrames: 3,
      },
    })
    const result = serializeSnapshotResult(withCross, budgetOf())
    assert.match(result.notices.join('\n'), /3 个跨域 iframe/)
  })
})

describe('契约：截断阶梯只动定位细节', () => {
  it('超预算行仍含 role/name/handle，rect 与 attrs 先掉', () => {
    const wide = row(7, { attrs: { 'data-testid': 'x'.repeat(120), href: '/some/long/path/here' } })
    const result = serializeSnapshotResult(rawOf({ rows: [wide] }), budgetOf({ maxRowChars: 40 }))
    const line = renderSnapshot(result)
      .split('\n')
      .find((l) => l.includes(wide.handle))
    assert.ok(line)
    assert.match(line, /role=button/)
    assert.ok(line.includes(wide.handle))
    assert.ok(!line.includes('rect='))
    assert.ok(!line.includes('data-testid'))
    assert.equal(result.rows[0].handle, wide.handle)
    assert.equal(result.rows[0].role, 'button')
    assert.equal(result.rows[0].name, '按钮 7')
    assert.ok(SNAPSHOT_ROW_PROTECTED_FIELDS.includes('handle'))
    assert.ok(!SNAPSHOT_ROW_PROTECTED_FIELDS.includes('rect'))
    assert.ok(!SNAPSHOT_ROW_PROTECTED_FIELDS.includes('attrs'))
  })

  it('整表为空时交付显式降级文本而不是空串', () => {
    const empty = rawOf({ rows: [], body: [] })
    assert.equal(
      renderEmptySnapshot('页面既未交回可动作元素，也未交回正文'),
      '（快照不可用：页面既未交回可动作元素，也未交回正文）',
    )
    assert.match(renderSnapshot(serializeSnapshotResult(empty, budgetOf())), /无可动作元素出表/)
  })
})

describe('契约：副作用确定性与无 DOM 降级', () => {
  it('页内 API 不可用 ⇒ 显式 PAGE_API_UNAVAILABLE 且 sideEffect=none', () => {
    const result = runPageAction('page_snapshot', {})
    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'PAGE_API_UNAVAILABLE')
    assert.equal(result.dispatched, false)
    assert.equal(result.sideEffect, 'none')
  })

  it('dispatched 为真即 uncertain，绝不自称无副作用', () => {
    const dispatched = outcomeOf({ ok: true, dispatched: true })
    assert.equal(dispatched.sideEffect, 'uncertain')
    const untouched = outcomeOf({ ok: false, dispatched: false, errorCode: 'HANDLE_STALE' })
    assert.equal(untouched.sideEffect, 'none')
    assert.equal(untouched.errorCode, 'HANDLE_STALE')
    assert.equal(dispatchedOutcome().sideEffect, 'uncertain')
  })

  it('页内交回畸形句柄 ⇒ 宿主显式 HANDLE_MALFORMED，不静默交付', () => {
    const broken = rawOf({ rows: [row(0, { handle: 'el:bad:1' })] })
    const outcome = snapshotOutcomeOf(broken)
    assert.equal(outcome.ok, false)
    assert.equal(outcome.errorCode, 'HANDLE_MALFORMED')
    const noRows = snapshotOutcomeOf({ ...rawOf(), rows: undefined })
    assert.equal(noRows.errorCode, 'EXECUTION_FAILED')
  })
})

describe('注入表达式：自足性与辅助符兜底（与消费端 injection 测试同源镜像）', () => {
  /** 最小 DOM 桩：只实现安装源真正调用的那几个成员，多一个都不写。 */
  function makeCleanContext() {
    const button = {
      tagName: 'BUTTON',
      id: 'b1',
      hidden: false,
      textContent: '提交',
      isConnected: true,
      attributes: [],
      getAttribute: (name) => (name === 'type' ? 'button' : null),
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

  it('表达式在没有任何模块作用域的上下文里安装成功，且同 schema 复用不重装', () => {
    const opts = buildPageApiOptions(SCOPE)
    const expression = buildPageApiInstallExpression(opts)
    const context = makeCleanContext()
    const installed = vm.runInContext(`(${expression})`, context, { timeout: 5000 })
    // vm 返回的是跨 realm 对象，逐字段浅拷回宿主 realm 再比结构
    assert.deepEqual(
      { ...installed },
      { installed: true, scope: SCOPE, schema: PAGE_SNAPSHOT_SCHEMA, reused: false },
    )
    const again = vm.runInContext(expression, context, { timeout: 5000 })
    assert.equal(again.reused, true)
    assert.equal(again.scope, SCOPE)
  })

  it('表达式装出的 API 在干净作用域里真能采到一行（函数体不回头够模块作用域）', () => {
    const opts = buildPageApiOptions(SCOPE)
    const context = makeCleanContext()
    vm.runInContext(buildPageApiInstallExpression(opts), context, { timeout: 5000 })
    const raw = vm.runInContext(
      `this[${JSON.stringify(opts.globalKey)}].api.snapshot(${JSON.stringify(budgetOf())})`,
      context,
    )
    assert.equal(raw.scope, SCOPE)
    assert.equal(raw.schema, PAGE_SNAPSHOT_SCHEMA)
    assert.equal(raw.rows.length, 1)
    assert.equal(raw.rows[0].role, 'button')
    assert.equal(raw.rows[0].name, '提交')
    assert.deepEqual(parsePageHandle(raw.rows[0].handle), { scope: SCOPE, serial: 0 })
    const state = vm.runInContext(`this[${JSON.stringify(opts.globalKey)}].api.state()`, context)
    assert.equal(state.handles, 1)
  })

  it('未登记的打包器辅助符 ⇒ 装配期抛错，不把注定 ReferenceError 的表达式发进页面', () => {
    assert.deepEqual(injectedHelperNeeds('function f(){ __notRegistered(1) }'), ['__notRegistered'])
    assert.throws(
      () => wrapInstallerSource('function f(){ __notRegistered(1) }', '[]'),
      /未登记的打包器辅助符/,
    )
    // 源码自带声明的辅助符不必我们兜（不得多塞一份）
    assert.deepEqual(injectedHelperNeeds('function g(){ var __own=1; __own(2) }'), [])
  })

  it('scope nonce 长度按契约，两次安装不撞号', () => {
    assert.equal(newPageScope().length, PAGE_HANDLE_SCOPE_LENGTH)
    assert.notEqual(newPageScope(), newPageScope())
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
