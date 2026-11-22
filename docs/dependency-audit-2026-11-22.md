<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 依赖审计与冗余判定（2026-11-22）

本文件是 C:\IHUI-AI monorepo 的依赖清点与「冗余 / 非冗余」判定口径。目的是把**已经实测过的结论固化下来**，避免后续审计把框架装载型依赖再判成死代码删掉（2026-11-22 本轮就发生过一次：删 `apps/mobile-rn` 的 40 条 babel 声明后，真实 Babel 编译直接报 `Cannot find module '@babel/plugin-transform-react-jsx'`）。

## 一、量级（全部为实测值，非估算）

| 口径 | 数值 |
| --- | --- |
| workspace 包 | 27（9 apps + 18 packages；含根共 28 个 package.json） |
| 直接声明依赖（包名去重） | 332 → 清理后 **330**（生产 221 → 219 / 纯 dev 111 / peer 6） |
| `pnpm-lock.yaml` | 3561 个唯一包名 / 7639 个「包+版本」条目 / 26 个 importer |
| `.pnpm` 版本目录 | 4126 |
| `node_modules` | 2.71 GB / 262,652 文件 |
| pnpm store | 2.6 GB |
| Python | 33 运行时 + 5 dev + 1 ocr |
| Rust | 约 45 个 crate |

体积 Top15（约 877 MB，占 `node_modules` 的 1/3）：

`next` 183.4 · `next-swc` 105.2 · `monaco` 93.4 · `mermaid` 79.7 · `node-pty` 62.6 · `echarts` 57.5 · `@swc/core` 50.8 · `gpt-tokenizer` 50.6 · `turbo` 48.0 · `antd` 47.2 · `hermes` 46.4 · `@swc` 43.7 · `@napi-rs/canvas` 36.6 · `lucide-react` 34.5 · `pdfjs-dist` 32.9

这些**全部是真实功能或构建工具链**，没有一个是可删的多余项。

## 二、本轮实际删除的（2 条，已生效）

1. `apps/web/package.json` 删 `@ihui/auth`（`workspace:*`），同步删 `apps/web/next.config.ts` 的 `transpilePackages` 条目。依据：web 与整个 `packages/` 目录对它零 import（已全仓搜索确认）。
2. `apps/web/package.json` 删 `@tauri-apps/plugin-store`（`^2.4.0`）。依据：`apps/web/src/lib/local-vault.ts` 注释已写明 2026-11-05 改为 Rust 侧白名单命令 `store_read_entry` / `store_write_entry`，capability 里也已移除 `store:default`，全仓零 import。

验证：`pnpm install --lockfile-only` 21.4s；`--frozen-lockfile` 安装 3.6s 通过；两包已从 `apps/web/node_modules` 消失；web typecheck 未出现任何指向被删包的 `Cannot find module`。副作用：锁重算把 `stringify-entities` 4.0.4 抬到 4.0.5。

## 三、明确保留、不再讨论的（附证据）

| 依赖 | 为什么不能删 |
| --- | --- |
| `@lobehub/icons`（含 antd 链 ≈ 93 MB） | **产品决策：图标必须用。** 93 MB = antd 47.2 + `@ant-design/*` 15.1 + `@lobehub/ui` 4.7 + icons 8.6 + `@rc-component/*` 5.8 + moment 4.3 + luxon 4.4 + moment-timezone 2.7。这是换取 100+ 品牌图标的既定代价 |
| `apps/mobile-rn` 的 40 条 `@babel/plugin-transform-*` / `preset-flow` 等 | `babel.config.js` 只有 `presets`，但 `babel-preset-expo` 返回的是**插件名字符串**，由 `@babel/core` 按配置文件所在包解析；pnpm isolated 布局下该处必须有显式声明。实测复验：`BABEL_TRANSFORM_OK codeLen=385 plugins-used=41` |
| `pino-pretty` | 三处字符串形态调用：`apps/api/src/server.ts:169`、`services/alert-notification-service.ts:41`、`services/clawdbot/logger.ts:24` 的 `transport: { target: 'pino-pretty' }`，knip 的 AST 看不见 |
| `@capacitor/*`（10 个模块） | 在产的离线 APK 壳：`apps/mobile-cap/android/capacitor.settings.gradle` include 全部模块并直指 `.pnpm` 路径，`patches/@capacitor+android+7.6.9.patch` 有补丁 |
| `react-native-web` | `apps/web/next.config.ts` 的 `transpilePackages` + `turbopack.resolveAlias` 承载 RN 共享屏 |
| `tailwindcss-animate` | `apps/web/app/globals.css:13` 的 `@plugin 'tailwindcss-animate'`（Tailwind v4 语法） |
| `expo-local-authentication` | `apps/mobile-rn/src/platform/biometrics.ts` 有 `export * as LocalAuthentication`，`hooks/use-biometrics.ts` 调 `hasHardwareAsync`/`isEnrolledAsync`/`authenticateAsync` |
| `jszip` | 实际只用于 `apps/web/src/components/media/office-preview.tsx` 解 pptx 的 OOXML 取 `<a:t>` 文本与备注。注：`apps/api/src/lib/chat/zip-store.ts` 是零依赖手写 ZIP，与该包无关 |
| `pdf-lib` / `pdfkit` / `pdfjs-dist` | 三套各司其职：编辑签名 / 生成 / 渲染。不可合并 |
| `expo-notifications`（1.58 MB） | 代码零 import 且 `expo.autolinking` 已 exclude，但 `docs/RELEASE.md` 登记为「推送能力就绪」。删除等于正式承认该能力未接，**能力决策不在依赖审计射程内** |
| `@tarojs/plugin-platform-swan` / `-tt` | 体积实测：swan **0 个目录**（由 `@tarojs/cli` 内置提供，根本没额外装）、tt 仅 0.08 MB。不构成体积问题。`h5` 不可删——`miniapp-preview.yml` 每次 PR 跑 H5 预览 |

## 四、判定为「负收益」而刻意不做（附体积实测）

| 候选动作 | 真实收益 | 代价 |
| --- | --- | --- |
| 合并 `unpdf` 到现有 `pdfjs-dist` | **2 MB**（unpdf 自带 pdfjs，不会产生第二份 33 MB 副本） | 重写文档解析路径 |
| 合并 `recharts` 到 `echarts` | 6.3 MB（recharts 4.4 + d3 系 31 个包 1.9） | 重画 5 个图表组件，视觉回归风险 |
| `jszip` → `fflate` | 0.7 MB（jszip 0.7 vs fflate 1.3/2 目录） | 改 pptx 解析代码 |
| 删 `pdf-lib` / `pdfkit` / `pdfjs-dist` 其一 | 18.6 / 8 / 32.9 MB | 需另找替代能力，功能缺口 |
| 多版本收敛 | < 3 MB | 见下节 |

合计不到 10 MB，占 `node_modules` 的 0.4%。**改动业务代码换 0.4%，属负收益。**

## 五、多版本副本的真相

口径修正：`pnpm-lock.yaml` 里带 peer 后缀的条目会把同一版本算成多条，**真多版本包是 583 个**（此前统计出的 1770 是错的），总副本数 1468，其中 377 个只有 2 版。

大头版本数：`commander` 8（2.11.0 / 4.1.1 / 7.2.0 / 8.3.0 / 9.5.0 / 12.1.0 / 15.0.0）、`file-type` 7、`chalk` 6、`glob` 6、`semver` 6、`tslib` 6、`@expo/json-file` 5、`ansi-styles` 5、`css-tree` 5、`entities` 5、`ora` 5、`type-fest` 5。

**绝大多数不能合并**：`chalk` 5.x 是 ESM-only（与 3.x/4.x 的 CJS 形态互斥）、`glob` 7/10/13 是三套 API、`commander` 2.x~15.x API 全不同。用 `overrides` 强拉平会直接打断 Expo / Taro / Next 的构建链。

安全可收敛的只有 `tslib`（6→1，现为 1.14.1 / 2.3.0 / 2.4.1 / 2.6.2 / 2.8.1 / 2.9.1）与 `semver` 的 7.x 线（7.5.2 / 7.5.4 / 7.8.5 / 7.8.6 → 1 版），合计 < 3 MB。**本轮评估后不做**：需要重算整份锁并全量复验，风险与 3 MB 收益不成比例。

## 六、knip 结构性误报清单

仓库自带 knip 基线（2026-11-20，clean HEAD `93bd93160`）：未使用 dependencies 28、devDependencies 70、exports 1855、types 1521、duplicates 292、unlisted 6、binaries 1、total 3780。本轮清理后 `dependencies 28 → 26`，`devDependencies 70` 不变。

以下类型是**结构性误报，不得据此删除**（`scripts/check-knip-ratchet.mjs` 头注已登记）：

- Taro `plugin-*`、`@capacitor/*`、`expo-*`、`pino-pretty`、`tailwindcss-*`、babel `preset-*` / `plugin-*` —— 全部是「配置里按字符串装载、代码里不 import」的框架装载型依赖
- `unlisted 7`（基线 6）中的 `react` 来自构建产物 `packages/sdk/dist/ihui-types.d.ts`
- `unresolved 3` 是存量：`apps/mobile-rn/tests/vip-benefit-labels.test.ts` 与 `src/screens/VipBenefitScreen.tsx` 指向缺失的 `vip-benefits` 模块；`apps/cli/tests/a13-projection-equivalence.test.ts` 缺 `./fixtures/toJsonProperty.legacy.js`

## 七、若目标真的是减体积

删依赖的天花板就是上面那 10 MB。真正的杠杆是把大体积包从**首屏静态依赖**改成**触发式动态加载**，收益是删依赖的十几倍：

- `monaco`（93.4 MB）：代码编辑器仅在需要时 `import()`
- `mermaid`（79.7 MB）：图表渲染按需加载
- `pdfjs-dist`（32.9 MB）：预览面板挂载时再加载

这三项属工程改造，不在依赖审计范围，需单独立项并做首屏包体与交互回归。

## 八、复验命令

```powershell
cd C:\IHUI-AI
node scripts/check-knip-ratchet.mjs --print         # 只报数，不判定、不写基线
node scripts/check-lock-manifest-consistency.mjs    # 判 HEAD blob
pnpm install --lockfile-only                        # 改依赖后重算锁
pnpm install --frozen-lockfile --ignore-scripts      # 验证锁与清单一致
pnpm turbo typecheck --filter=@ihui/web              # 必须走 turbo 形态
Set-Location apps\mobile-rn                          # babel 探针必须以该目录为 cwd
node ..\..\.ihui-agent\tmp\babel-check.mjs           # 期望 BABEL_TRANSFORM_OK
```

## 九、本轮变更

- `apps/web/package.json`：删 `@ihui/auth`、`@tauri-apps/plugin-store`
- `apps/web/next.config.ts`：`transpilePackages` 移除 `'@ihui/auth'`
- `pnpm-lock.yaml`：同步重算（约 6 增 19 删）
- 曾试并**完整回滚**：`apps/mobile-rn` 40 条 babel 声明（会造成真实编译失败）、`pnpm patch @lobehub/icons` 去 peer 依赖（pnpm 按锁内 peer 快照解析，patch 包内 package.json 对既有锁无效，除非重造整份锁）
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
