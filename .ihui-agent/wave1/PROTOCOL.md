# Wave1 补屏协议(gap→aligned,并行 agent 专用)

## 场地与铁律
- 工作树:`D:\IHUI-AI-wt\gap-screens`(分支 gap-screens,基 493c7b74,node_modules 已装)。绝不碰 `d:\IHUI-AI`(他席在飞)。
- **禁止编辑共享文件**:`apps/mobile-rn/src/navigation/RootNavigator.tsx`、`packages/app/src/index.ts`、`packages/i18n/messages/mobile-rn/*.json`、`scripts/data/web-rn-screen-map.jsonl`、`package.json`。这些由集成方按你的 manifest 统一落。
- 你只能新建/修改:`packages/app/src/features/<你的域>/**`、`packages/api-client/src/endpoints/<你的域>*.ts`、`apps/mobile-rn/src/screens/<Your>Screen.tsx`,以及写 manifest。

## 样板链(先读这 6 个文件,照抄结构与风格)
1. `packages/app/src/features/status/StatusScreen.tsx` — 共享屏(纯展示,t/colorScheme/数据 props 注入)
2. `packages/app/src/features/status/status-styles.ts` — 样式(token 化)
3. `apps/mobile-rn/src/screens/StatusScreen.tsx` — RN 薄壳(取数+i18n+主题,渲染委托共享屏)
4. `packages/api-client/src/endpoints/status.ts` — 端点层(fetchApi 封装+类型)
5. `packages/i18n/messages/mobile-rn/zh-CN.json` 的 `statusPage` 命名空间 — 键结构参照
6. web 侧你的域页面源码(见各票 note 里的路径)

## 硬规则
- **水印**:每个新建 .ts/.tsx 文件第 1-3 行与末行,逐字节拷贝 `packages/api-client/src/endpoints/status.ts` 的对应行(水印行是全仓同一常量)。
- **设计 token**:颜色一律走既有 token(参照样板屏用法),相近色统一,零硬编码色值。
- **i18n**:所有 UI 文案经 `t('ns.key')`;五语(en/zh-CN/zh-TW/ja/ko)全量给,键名 camelCase,命名空间 `<domain>Page` 风格。
- **端点**:先查 `packages/api-client/src/endpoints/` 是否已有该域封装(分诊显示多数已实装),有则复用,无则新建;apps/api 路由已存在,不要动后端。
- **判定**:候选共享屏若真实承载 web 内容 → WIRING(只建 RN 薄壳);部分覆盖 → 扩展共享屏(仍属你的域目录);零覆盖 → 新建共享屏。薄壳 import 走 `@ihui/rn-app`。
- **验证**:`pnpm -F @ihui/app typecheck`、`pnpm -F @ihui/api-client exec tsc --noEmit`、`pnpm -F @ihui/mobile-rn exec tsc --noEmit`(若包名不同以实际 package.json 为准)。报错只允许来自"尚未注册导出/路由"这一类(集成后消失);你自己的文件必须零报错。

## Manifest(写到 `.ihui-agent/wave1/<domain>.manifest.json`)
```json
{
  "domain": "<域>",
  "unitScreen": "<RouteName>",
  "newFiles": ["<你新建/修改的文件清单>"],
  "indexExports": ["export { XScreen } from './features/<dir>/XScreen'", "export type { ... } from '...'"],
  "navigator": {
    "import": "import { XScreen } from '../screens/XScreen'",
    "param": "  RouteName: undefined",
    "screen": "<RootStack.Screen name=\"RouteName\" component={XScreen} />"
  },
  "i18n": { "en": {"ns": {...}}, "zh-CN": {"ns": {...}}, "zh-TW": {"ns": {...}}, "ja": {"ns": {...}}, "ko": {"ns": {...}} },
  "ledger": [
    { "web": "<路由>", "rn": "apps/mobile-rn/src/screens/XScreen.tsx", "status": "aligned", "note": "Wave1@2026-10-26: <承载证据:屏文件+端点>", "at": "2026-10-26" }
  ]
}
```
ledger 必须覆盖你票内**全部** gap 路由(一屏多路由则逐条各一行)。
