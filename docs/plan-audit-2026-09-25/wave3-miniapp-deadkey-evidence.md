<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# i18n 死 key 审计报告(2026-09-25,target=miniapp-taro)

> 自动生成 by `scripts/scan-dead-i18n-keys.mjs`(2026-07-26 公共函数抽象到 _i18n-scan-helpers.mjs)
> target=miniapp-taro,messagesPath=packages/i18n/messages/miniapp-taro/zh-CN.json
## 总览
- target:**miniapp-taro**
- 扫描文件:5 语言(`packages\i18n\messages\miniapp-taro\zh-CN.json`, `packages\i18n\messages\miniapp-taro\en.json`, `packages\i18n\messages\miniapp-taro\ja.json`, `packages\i18n\messages\miniapp-taro\ko.json`, `packages\i18n\messages\miniapp-taro\zh-TW.json`)
- 递归 leaf key 总数:**3365**
- 代码静态引用 key(全路径 `t('a.b.c')` 形式):**3985**(去重)
- `useTranslations/getTranslations('namespace')` 命名空间:**7** 个(命名空间下所有 key 视作潜在引用,启发式)
- 死 key 数量:**1**(占比 **0.0%**)
- 翻译不完整 key 数量:**0**
- 动态 t(`prefix.${var}`) 命中:3 处
## 死 key 列表(按 namespace 分组)
### `ai.*`  (1 个)
- `ai.chatMessageItem.downloadSuccess`
## 契约键声明(scripts/i18n-contract-keys.json,仅免除"死键"判定)
> 这些键在本端无静态引用**不是孤儿**,而是跨端词包契约 / 被测试钉住的形状键。每条依据都按 HEAD 内容核验过(文件存在 + 行号在范围内 + 该行含被引用的标识符);依据不成立即判红。**parity / 翻译完整性 / 语言纯度一律不受本节影响。**
_本端无契约声明命中_
## 翻译不完整 key 列表(5 语言中任一缺失)
_翻译完整_ ✅
## 动态 key 提示(代码中拼接的 key,无法静态扫描)
共 3 处动态 key 调用,这些 key 即使在 zh-CN.json 中定义也无法通过静态扫描验证,建议人工核对:
- `apps\miniapp-taro\src\components\AgentRuntimePanel.tsx`(1 处)
  - L78: `{permissionDecisionWord(permission.decision, (k) => t(`stepDecision.${k}`))}`
- `apps\miniapp-taro\src\pkg-ai\ai\ChatMessageItem.tsx`(1 处)
  - L781: `{t(`ai.pane.${titleView.titleKey}`, titleView.values)}`
- `packages\shared\src\validation\form-schema.ts`(1 处)
  - L35: `return t(`${VALIDATION_NS}.${key}`, vars as Record<string, string | number> | undefined)`
## 排除项
- 目录:node_modules / .next / dist / coverage / __tests__ / tests / __mocks__ / fixtures
- 文件:`*.test.ts(x)` / `*.spec.ts(x)` / `*.d.ts`
---
_Generated at 2026-09-25T03:09:32.927Z_
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
