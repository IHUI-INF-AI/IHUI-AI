import { buildI18n, writeManifest } from './manifest-lib.mjs'

const FILE = '.ihui-agent/wave3/q2.manifest.json'

const manifest = {
  domain: 'knowledge-memory',
  unitScreen: 'Q2',
  newFiles: [
    'packages/app/src/features/knowledge-card/knowledge-card-styles.ts',
    'packages/app/src/features/knowledge-card/KnowledgeCardsScreen.tsx',
    'apps/mobile-rn/src/screens/KnowledgeCardsScreen.tsx',
  ],
  indexExports: [
    'export { KnowledgeCardsScreen } from "./features/knowledge-card/KnowledgeCardsScreen"',
    'export type { KnowledgeCardFormState, KnowledgeCardKind, KnowledgeCardRow, KnowledgeCardsScreenProps } from "./features/knowledge-card/KnowledgeCardsScreen"',
  ],
  apiClientIndexExports: [],
  apiClientIndexNote:
    'knowledge-cards 零新增端点:全仓唯一同域出口 packages/api-client/src/endpoints/knowledge-card.ts 已存在且已注册在 packages/api-client/src/index.ts:423(export * from "./endpoints/knowledge-card.js"),listKnowledgeCards/getKnowledgeCard/createKnowledgeCard/updateKnowledgeCard/markCardUsed/searchKnowledgeCards/deleteKnowledgeCard 七个函数直接复用,不得新建第二份。',
  navigator: [
    {
      import: 'import { KnowledgeCardsScreen } from "../screens/KnowledgeCardsScreen"',
      param: '  KnowledgeCards: undefined',
      screen: '<RootStack.Screen name="KnowledgeCards" component={KnowledgeCardsScreen} />',
    },
  ],
  i18n: buildI18n(['knowledgeCard']),
  ledger: [
    {
      web: 'knowledge-cards',
      rn: 'apps/mobile-rn/src/screens/KnowledgeCardsScreen.tsx',
      status: 'aligned',
      note:
        'Wave3@2026-10-26: 接线复用 —— 端点 packages/api-client/src/endpoints/knowledge-card.ts(已存在、已在 index.ts:423 注册)七个函数全复用,零新增端点。后端证据 apps/api/src/routes/knowledge-card.ts:108 GET /(list,裸数组 KnowledgeCardSummary[])、148 POST /、173 GET /search、209 GET /:id、227 PATCH /:id(updateSchema.markUsed 即"标记已用")、270 DELETE /:id;信封 {code,message,data} 由 fetchApi 解包(index.ts 挂载点 apps/api/src/routes/index.ts:1420 prefix=/api/knowledge-cards)。新建共享屏 packages/app/src/features/knowledge-card/KnowledgeCardsScreen.tsx + knowledge-card-styles.ts,四段区(仓库/创建编辑表单/详情/列表+搜索)与 web 页面族逐区对齐,三态齐(骨架/错误条/两种空态文案)。web confirmDialog 的 RN 等价 = appAlert 破坏性按钮。降级:web 详情区 MarkdownStream 在 RN 无共享承载,本屏按纯文本渲染;web 日期 Intl.DateTimeFormat 在本屏取 createdAt.slice(0,10)。',
      at: '2026-10-26',
    },
  ],
}

writeManifest(FILE, manifest)
console.log('written', FILE)
