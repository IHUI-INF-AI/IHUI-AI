/**
 * P0 修复不回归守门 (2026-07-02)
 *
 * 锁定两个历史 P0 缺陷的修复状态，防止后续 PR 静默还原：
 *
 * 1) cspReport.ts 的 reportCspViolation 函数必须 export
 *    历史: 该函数未导出，外部埋点/自定义检测代码无法直接调用。
 *    影响: 调用方只能通过 initCspReport 监听 securitypolicyviolation 事件，
 *          主动上报场景 (e.g. CSP 白名单扫描) 无法复用同一上报逻辑。
 *    修复: 改为 `export function reportCspViolation(...)`。
 *
 * 2) AiCapabilityManagement.vue 聊天响应解析必须用 OpenAI 兼容格式
 *    data.choices?.[0]?.message?.content
 *    历史: 该文件使用 FastAPI 业务码格式 `data.message`, 跟 AIChat.vue / 实际
 *          后端 OpenAI 兼容响应不一致，导致管理员页面 AI 聊天测试拿到 [object Object]
 *          或 undefined。
 *    修复: 改用 `data.choices?.[0]?.message?.content`, 与 AIChat.vue / skills-enhanced-ai.ts 一致。
 *
 * 验证项 (3 个源码级断言, 全部必须通过):
 *   ① cspReport.ts 必含 `export function reportCspViolation`
 *   ② cspReport.ts 必含初始化监听函数 `initCspReport` (功能完整性)
 *   ③ AiCapabilityManagement.vue 必含 `data.choices?.[0]?.message?.content` 解析
 *
 * CI 入口: npx playwright test e2e/p0-fixes-no-regression.spec.ts
 *  源码级测试无需 PW_BASE_URL, 可在 CI 任何阶段运行。
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

test.describe('P0 修复不回归守门 (2026-07-02)', () => {
  // ===========================================================================
  // 1) cspReport.ts: reportCspViolation 函数必须 export
  // ===========================================================================
  test('源码级: cspReport.ts 必须 export function reportCspViolation', () => {
    const src = readFileSync(join(ROOT, 'src/utils/cspReport.ts'), 'utf8')

    // 精确锚点: export 关键字 + function 声明必须同时存在
    expect(
      src,
      'cspReport.ts 缺少 `export function reportCspViolation` 声明。\n' +
        'P0 修复要求: 外部代码 (埋点/自定义检测) 可直接调用此函数主动上报 CSP 违规。\n' +
        '如果只 export 类型 / interface 而漏掉 function 声明, 编译期不会报错, 但运行时\n' +
        'import { reportCspViolation } 会拿到 undefined, 触发 "is not a function" 错误。'
    ).toMatch(/export\s+function\s+reportCspViolation\s*\(/)

    // 进一步验证: 函数体里必须真的调用 reportToSentry + reportToLocal (双路上报)
    // 这是原报告逻辑的硬约束, 不允许简化为只 sendBeacon 到一个端点
    const reportFnBlock = src.match(
      /export\s+function\s+reportCspViolation\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/,
    )
    expect(reportFnBlock, '未找到 reportCspViolation 函数体').not.toBeNull()
    const body = reportFnBlock![1]
    expect(body, 'reportCspViolation 必须调用 reportToSentry').toMatch(/reportToSentry\s*\(/)
    expect(body, 'reportCspViolation 必须调用 reportToLocal').toMatch(/reportToLocal\s*\(/)
  })

  // ===========================================================================
  // 2) cspReport.ts: initCspReport 函数也必须 export (功能完整性)
  // ===========================================================================
  test('源码级: cspReport.ts 必须 export function initCspReport', () => {
    const src = readFileSync(join(ROOT, 'src/utils/cspReport.ts'), 'utf8')

    expect(
      src,
      'cspReport.ts 缺少 `export function initCspReport` 声明。\n' +
        'P0 修复配套: App.vue 在 onMounted 调用此函数注册 securitypolicyviolation 监听器。\n' +
        '漏掉 export 会导致 App.vue 的 import 拿到 undefined, CSP 违规事件静默丢失。'
    ).toMatch(/export\s+function\s+initCspReport\s*\(/)

    // 函数体里必须 addEventListener('securitypolicyviolation', ...) 监听原生事件
    const initFnBlock = src.match(
      /export\s+function\s+initCspReport\s*\(\s*\)\s*\{([\s\S]*?)\n\}/,
    )
    expect(initFnBlock, '未找到 initCspReport 函数体').not.toBeNull()
    const body = initFnBlock![1]
    expect(
      body,
      'initCspReport 必须 addEventListener 监听 `securitypolicyviolation` 事件'
    ).toMatch(/addEventListener\(\s*['"]securitypolicyviolation['"]/)
  })

  // ===========================================================================
  // 3) AiCapabilityManagement.vue: 聊天响应解析必须用 OpenAI 兼容格式
  // ===========================================================================
  test('源码级: AiCapabilityManagement.vue 必含 OpenAI 兼容响应解析', () => {
    const src = readFileSync(
      join(ROOT, 'src/views/admin/AiCapabilityManagement.vue'),
      'utf8',
    )

    // 精确锚点: data.choices?.[0]?.message?.content
    // 允许属性访问有可选链 ?. 或非空断言, 但三元路径必须完整
    expect(
      src,
      'AiCapabilityManagement.vue 缺少 `data.choices?.[0]?.message?.content` 解析。\n' +
        'P0 修复: 后端返回 OpenAI 兼容格式 { choices: [{ message: { content: "..." } }] }。\n' +
        '若用旧的 FastAPI 业务码格式 `data.message`, 管理员 AI 聊天测试会拿到 undefined。\n' +
        '正确写法: data.choices?.[0]?.message?.content ?? null (与 AIChat.vue / skills-enhanced-ai.ts 一致)'
    ).toMatch(/data\.choices\?\[0\]\?\.message\?\.content/)

    // 进一步验证: 必须用 isFastAPIChatResponse 类型守卫判断响应类型
    // 不允许直接 .data.message (会同时命中 error 响应)
    expect(
      src,
      'AiCapabilityManagement.vue 必须先用 isFastAPIChatResponse(data) 类型守卫,\n' +
        '然后再解析 OpenAI 格式。直接用 data.message 会与 error 响应 (含 message 字段) 冲突。'
    ).toMatch(/isFastAPIChatResponse\s*\(\s*data\s*\)/)

    // 错误响应分支必须用 isAPIErrorResponse 守卫
    expect(
      src,
      'AiCapabilityManagement.vue 必须用 isAPIErrorResponse(data) 守卫处理错误响应'
    ).toMatch(/isAPIErrorResponse\s*\(\s*data\s*\)/)
  })
})
