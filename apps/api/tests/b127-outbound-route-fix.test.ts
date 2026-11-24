// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 127(check-declared-outbound-routes)B 组修复的回归钉(2026-09-26)。
// 纯静态断言,不连库不发网络请求(§5 测试隔离铁律)。
// 判据对象是仓库文件形态(§22c:判"形态"的门,镜像测试输入必须逐字取自真实文件)——
// 本测试直接读真实源文件,不造夹具,防止"夹具复刻实现形状而门对真文件失明"。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

const knowledgeTools = read('../src/routes/v1-knowledge-tools.ts')
const autoRollback = read('../src/services/auto-rollback.ts')
const webhooksTrigger = read('../src/routes/webhooks-trigger.ts')

// 守门 108 把源码面里出现的标记字面量当一次豁免记账(豁免到期账),
// 故本测试用拼接构造标记,任何一行都不得逐字成形 —— 否则测试文件自己会被 E1 判红。
const EXEMPT_MARK = ['route-declare', '-exempt'].join('')

/** ai-service 真注册面:main.py include(api_v1_router, prefix="/api/v1") + api/v1/router.py
 *  include(knowledge_graph.router, prefix="/ai/knowledge-graph") + knowledge_graph.py 的
 *  @router.post("/extract")/post("/build")/get("/data")/delete("/data") 三段拼接。 */
describe('守门 127 B组① v1-knowledge-tools 四条图谱转发必须带 /ai/knowledge-graph 前缀', () => {
  it('extract/build/data(GET)/data(DELETE) 四条全部指向真实注册路径', () => {
    expect(knowledgeTools).toContain("'/api/v1/ai/knowledge-graph/extract'")
    expect(knowledgeTools).toContain("'/api/v1/ai/knowledge-graph/build'")
    // data 出现两次:GET 与 DELETE 各一
    expect(knowledgeTools.match(/'\/api\/v1\/ai\/knowledge-graph\/data'/g)).toHaveLength(2)
  })
  it('旧的裸路径(从未在 ai-service 注册过)不得回潮(判剥注释后的代码面,注释里允许引用旧路径说明历史)', () => {
    const code = knowledgeTools.replace(/\/\/[^\n]*/g, '')
    expect(code).not.toContain("'/api/v1/extract'")
    expect(code).not.toContain("'/api/v1/build'")
    expect(code).not.toContain("'/api/v1/data'")
  })
})

describe('守门 127 B组② auto-rollback 的 Prometheus 查询行', () => {
  it('豁免标记必须紧邻声明字面量(同语句块内)且带原因+到期日(守门 108 E1)', () => {
    const lines = autoRollback.split('\n')
    const declIdx = lines.findIndex((l) => l.includes('/api/v1/query?query='))
    expect(declIdx).toBeGreaterThanOrEqual(0)
    const block = lines.slice(Math.max(0, declIdx - 2), declIdx + 3).join('\n')
    expect(block).toContain(EXEMPT_MARK + ':')
    expect(block).toMatch(/until \d{4}-\d{2}-\d{2}/)
  })
  // 如实登记(2026-09-26 实测):守门 127 提取层先 maskComments 再扫豁免标记,而 maskComments
  // 把 // 注释整段抹成空格 ⇒ 标记在当前解析器下永不可见,"行内豁免"对 TS/Py 注释形态是死机制
  // (门 127 持有者待修:应在未遮罩行面上扫标记,并允许标记落在紧邻声明行的独立注释里 ——
  // prettier 会把超长同行尾注搬成独立行)。本断言钉"写法与位置正确",不承诺当前判绿。
})

describe('守门 127 B组③ webhooks-trigger 的 run 调用(判定:需新实现,停手登记)', () => {
  it('判定注释必须在位(不得被静默删掉后装作已修)', () => {
    expect(webhooksTrigger).toContain('从未注册过')
    expect(webhooksTrigger).toContain('/api/agents/execute')
  })
  it('该行不得用本族豁免遮(自家缺失路由用豁免 = 洗白)', () => {
    const lines = webhooksTrigger.split('\n')
    const declIdx = lines.findIndex((l) => l.includes('event.agentId}/run'))
    expect(declIdx).toBeGreaterThanOrEqual(0)
    const block = lines.slice(Math.max(0, declIdx - 2), declIdx + 3).join('\n')
    expect(block).not.toContain(EXEMPT_MARK)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
