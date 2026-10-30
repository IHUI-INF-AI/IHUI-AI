import { readFileSync, writeFileSync } from 'node:fs'

const I18N = JSON.parse(readFileSync('.ihui-agent/wave3/q10.i18n.json', 'utf8'))

/** 已完成路由的页面级命名空间(按完成顺序) */
const DONE_NS = ['agentPlanPage', 'agentPlanProgressPage', 'subagentsDispatchPage']

const pickI18n = () => {
  const out = {}
  for (const lang of Object.keys(I18N)) {
    out[lang] = {}
    for (const ns of DONE_NS) out[lang][ns] = I18N[lang][ns]
  }
  return out
}

const manifest = {
  domain: 'agent-plan + subagents-dispatch',
  wave: 'wave3-q10',
  unitScreen: 'agent-plan + agent-plan/progress + subagents/dispatch',
  newFiles: [
    'packages/app/src/features/agent-plan/AgentPlanScreen.tsx',
    'apps/mobile-rn/src/screens/AgentPlanScreen.tsx',
    'packages/api-client/src/endpoints/agent-plan-progress.ts',
    'packages/app/src/features/agent-plan/AgentPlanProgressScreen.tsx',
    'apps/mobile-rn/src/screens/AgentPlanProgressScreen.tsx',
    'packages/app/src/features/subagents/SubagentsDispatchScreen.tsx',
    'apps/mobile-rn/src/screens/SubagentsDispatchScreen.tsx',
  ],
  indexExports: [
    "export { AgentPlanScreen } from './features/agent-plan/AgentPlanScreen'",
    "export type { AgentPlanPhase, AgentPlanResultView, AgentPlanScreenProps } from './features/agent-plan/AgentPlanScreen'",
    "export { AgentPlanProgressScreen } from './features/agent-plan/AgentPlanProgressScreen'",
    "export type { AgentPlanProgressDetailView, AgentPlanProgressScreenProps, AgentPlanTaskRowView, AgentPlanVersionRowView } from './features/agent-plan/AgentPlanProgressScreen'",
    "export { SubagentsDispatchScreen } from './features/subagents/SubagentsDispatchScreen'",
    "export type { SubagentsDispatchResultView, SubagentsDispatchScreenProps } from './features/subagents/SubagentsDispatchScreen'",
  ],
  apiClientIndexExports: ["export * from './endpoints/agent-plan-progress.js'"],
  apiClientIndexNote:
    'agent-plan 既有三端点已在 endpoints/agent-plan.ts 且已由 index.ts:340 导出,本席未改该文件;新增的 agent-plan-progress.ts(任务/版本/diff 三只读查询)需在 packages/api-client/src/index.ts 追加上面 1 行 re-export,否则进度薄壳 import 报「无此导出」。subagents/dispatch 复用既有 endpoints/subagents.ts:190 dispatchSubagent(index.ts:416 已导出),未新建端点件、未改 barrel。',
  navigator: [
    {
      import: "import { AgentPlanScreen } from '../screens/AgentPlanScreen'",
      param: '  AgentPlan: undefined',
      screen: '<RootStack.Screen name="AgentPlan" component={AgentPlanScreen} />',
    },
    {
      import: "import { AgentPlanProgressScreen } from '../screens/AgentPlanProgressScreen'",
      param: '  AgentPlanProgress: undefined',
      screen: '<RootStack.Screen name="AgentPlanProgress" component={AgentPlanProgressScreen} />',
    },
    {
      import: "import { SubagentsDispatchScreen } from '../screens/SubagentsDispatchScreen'",
      param: '  SubagentsDispatch: undefined',
      screen:
        '<RootStack.Screen name="SubagentsDispatch" component={SubagentsDispatchScreen} />',
    },
  ],
  i18n: pickI18n(),
  ledger: [
    {
      web: 'agent-plan',
      rn: 'apps/mobile-rn/src/screens/AgentPlanScreen.tsx',
      status: 'aligned',
      note: 'Wave3-q10@2026-10-27: 新建共享屏 packages/app/src/features/agent-plan/AgentPlanScreen.tsx + 薄壳,复用既有端点封装 packages/api-client/src/endpoints/agent-plan.ts(未改);后端契约现读 = POST /api/agent-plan(apps/ai-service/app/routers/agent_plan.py:241)、GET /api/agent-plan/{plan_id}(:259)、POST /api/agent-plan/{plan_id}/decision(:399),信封 {code,message,data} 经 fetchApi 拆壳;阶段机/编辑态/批准阻塞与 web AgentPlanStudio(apps/web/src/components/agent-plan/AgentPlanStudio.tsx:33-121)同序;五语文案逐字取 web agentPlan 命名空间。如实登记:apps/api 全仓无 /api/agent-plan 前缀注册,web 由 next rewrites 直转 8803(apps/web/next.config.ts:320),RN 侧依赖同一网关转发;apps/api 缺该注册面。',
      at: '2026-10-27',
    },
    {
      web: 'agent-plan/progress',
      rn: 'apps/mobile-rn/src/screens/AgentPlanProgressScreen.tsx',
      status: 'aligned',
      note: 'Wave3-q10@2026-10-27: 新建共享屏 packages/app/src/features/agent-plan/AgentPlanProgressScreen.tsx + 薄壳 + 端点 packages/api-client/src/endpoints/agent-plan-progress.ts(新增任务/版本/diff 三只读查询,与 web apps/web/src/api/agent-plan-api.ts:60-102 同参同路径);详情复用既有 getAgentPlan(endpoints/agent-plan.ts:113);后端现读 = GET /api/agent-plan/{id}(ai-service agent_plan.py:259)、/tasks(:353)、/versions(:290)、/versions/diff(:308),信封 {code,message,data}。口径差如实登记:web「最近查看」是 localStorage 伪列表(progress/page.tsx:38/65-73),RN 无同义存储故未承载,只保留输入 plan_id 主路径;版本 diff 仍按 web 同参 from_version=1。apps/api 同样无该前缀注册(web 由 next rewrites 直转 8803)。',
      at: '2026-10-27',
    },
    {
      web: 'subagents/dispatch',
      rn: 'apps/mobile-rn/src/screens/SubagentsDispatchScreen.tsx',
      status: 'aligned',
      note: 'Wave3-q10@2026-10-27: 新建共享屏 packages/app/src/features/subagents/SubagentsDispatchScreen.tsx + 薄壳;端点复用既有 packages/api-client/src/endpoints/subagents.ts:190 dispatchSubagent(未新建文件);后端契约现读 = POST /api/subagents/dispatch(apps/api/src/routes/subagent-dispatch.ts:400-428,prefix /api 由 routes/index.ts:1236 注册),入参 zod :93-118,成功 success({dispatch})(:425),并发超限 429(:416-418)/DAG 循环依赖 400(:421-423);retry/quotas 两组可选字段后端接受(:112/:115)而 api-client 入参类型未列,薄壳以扩展类型透传未改既有件;字段与角色/编排/优先级取值集逐一同 web DispatchForm.tsx:20-43。口径差如实登记:web 的「DAG 节点/边编辑器」子面板未承载(未造假入口,ledger 明示);派单成功页 web 跳 /subagents/detail?id=,RN 侧无该 detail 屏路由,改为本屏内结果卡 + 「再派一个」。',
      at: '2026-10-27',
    },
  ],
  notLanded: [],
}

writeFileSync('.ihui-agent/wave3/q10.manifest.json', `${JSON.stringify(manifest, null, 2)}\n`)
console.log('manifest written, ns =', DONE_NS.join(','))
