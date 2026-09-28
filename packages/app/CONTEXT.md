<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# packages/app — 模块契约

单一入口:`@ihui/rn-app` → `./src/index.ts`(`package.json` 的 `exports` 只有 `"."` 一条)。
本文件是守门「架构契约对账」(id 103)判据 E2 认的那份模块根自述;改包的外部面必须同笔改这里。

## 1. 这个包是什么、对外给谁用

RN 侧**共享屏层**:`src/features/`(现读 194 个特性目录)装整屏级界面,`src/components/`(15 个)
装被这些屏共用的组件,`src/theme/` 装主题解析。它不是端,也不能独立运行 —— 必须被某个 RN 宿主
(App.tsx + expo/metro)装载。

消费方现读(`git grep -l "@ihui/rn-app" HEAD` 再逐条读上下文,区分真 import 与注释提及):

- **真 import:213 个文件,全部在 `apps/mobile-rn`**。
- **注释提及而非 import:`apps/miniapp-taro/src/pkg-ai/ai-chat-detail/index.tsx`、
  `apps/web/src/components/common/view-more-link.tsx`、`packages/types/src/app.ts`、
  `packages/shared/src/ui/section-header-spec.ts`** —— 这四条都在叙述"与 RN 侧同档"或
  "类型已迁出去以免被迫装 react-native peerDep",**没有一条真的引这个包**。把它们算成消费方
  会造出"web/小程序也在用 RN 包"的假账,而那一型正是本仓守门 77 B6 / 门 118 记过的"按名字命中
  就当装车"的错。
- 包内自身:`packages/app/src/index.ts` 是出口,`packages/shared`/`packages/types` 里那两处也是注释。

## 2. 公开面

- 运行时出口只有一个:主入口 `.`。`src/index.ts` 逐名 re-export features 与 components。
- 类型有一条**刻意分开的旁路**:`packages/app/src/types.ts` 只做 re-export,真实类型住在
  `packages/types/src/app.ts`。分开的理由写在该文件头注里 —— 非 RN 宿主(小程序/桌面 web 壳)
  只要类型时**不应**被迫装 `@ihui/rn-app`(它带 react-native peerDep)。取类型请走
  `@ihui/types`,不要为了一个 interface 把整包拖进依赖树。
- 没有子路径出口(`exports` 里除 `.` 之外零条目)。按 `@ihui/rn-app/src/...` 穿透内部属架构契约
  判据 D3 深导入,直接判红。

## 3. 依赖方向与边界

策略表登记:`layer: composite`、`exported: true`、`managed: true`、`requires: packages/design-tokens`
+ `packages/types` + `packages/shared`(清单取表,勿在此另立一份)。

- 上游只能被更深的层消费;本包**不得** import 任何 `apps/*`(端应用 `exported:false`,D2 反向依赖)。
- 可见真值只有一处:色档 `packages/design-tokens/src/styles/tokens.css`、圆角 `radius.js`、
  几何 `geometry.js`。本包内**不得**出现第二个色值/圆角/尺寸字面量,派生副本一律由生成器写回。
- 主题透线:`packages/app` 的 theme-driven 组件形参若带 `colorScheme` 默认值,调用方必须在每个
  JSX 渲染点真传参(守门 91 判 missing/literal/spread-unknown)。
- 页头返回键的唯一实现是 `packages/app/src/components/BackChevron.tsx`(经本包导出);
  区段头「更多」的唯一 RN 实现是 `components/MoreLink.tsx`。两端不得再自拼第三份(守门 102 S0)。

## 4. 已知缺口 / 未收口的点(现读,非"应该没有")

1. **`components/Selecter.tsx` 引的是 web 图标库 `lucide-react`**,而同包 82 个文件用的是
   `lucide-react-native`。AGENTS §4 规定移动端一律 `lucide-react-native`;这一处是 web 图标组件
   被引进了 RN 共享屏层,metro 打包能过不代表真机上能渲染。是否收掉归该组件持有者(改图标载体
   属观感改动,需回归)。
2. **`src/components/UserInfoCard.tsx` 与 `src/features/cards/UserInfoCard.tsx` 同族两份活实现并存**,
   前者经现读全仓零深导入(只在注释里出现),属 DOM 死副本;按 AGENTS §7 删除安全,不在本文件
   授权删除,归该包持有者裁决。教训已登记在 O81 票⑮:**同族第三份活实现改了像素不移动任何读数**
   —— 守门 128 的配对源不含 `packages/app/src/features/**`,这是一格判据缺口。
3. **本包 194 个 features 目录里存在 DOM 形态与 RN 形态混写**(§1 那条"注释提及"链路的成因之一)。
   跨端对账门(128)今天对本包**没有配对面**,不得把它的 exit 0 读成"两端界面已同值"。
4. `packages/app` 无自有 `build`/`test` 脚本入口登记在本文件 —— 端内测试由 `apps/mobile-rn` 的
   vitest 装载本包源码跑,本包自身不产 dist。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
