# 前端规范合规扫描报告

> 扫描时间：2026-06-21
> 扫描范围：`g:\1\client\src` 下所有 `.vue`、`.scss`、`.css`、`.ts` 文件
> 排除范围：`node_modules`、`dist`、`.git`、`src/styles`（全局样式定义处，允许写数值）
> 依据规范：[design.md](file:///g:/1/client/docs/design.md)

---

## 一、总体汇总（大白话）

| 违规类型 | 违规数量 | 严重程度 | 涉及文件数 |
|---|---|---|---|
| `!important` 使用 | 0 处 | — | 0 |
| `text-shadow` 使用 | 8 处 | 严重 | 6 |
| 硬编码颜色（#xxx） | 27 处 | 严重 | 8 |
| 硬编码 box-shadow | 114 处 | 严重 | 68 |
| 硬编码 z-index 数字 | 42 处 | 中 | 42 |
| 硬编码 rgba 透明度 | 0 处 | — | 0 |
| 自己写 1px solid 描边 | 约 564 处 | 中 | 约 98 |
| 硬编码圆角数字 | 403 处 | 中 | 100 |
| 高特异性选择器（长链） | 约 78 处 | 严重 | 约 10 |
| var() fallback 写法 | 842 处 | 中 | 约 54 |
| **合计** | **约 2078 处** | — | — |

**一句话总结**：项目在 `!important`、`text-shadow`、硬编码颜色、rgba 透明度这几项执行得不错；但**圆角、描边、box-shadow、var fallback、长链选择器**违规较多，需要分批治理。

---

## 二、严重违规清单（优先处理）

### 2.1 text-shadow 违规（8 处，6 个文件）

规范：禁止使用 `text-shadow`，应用高对比度颜色增强可读性。

| 文件 | 行号 | 违规内容 | 所在功能 |
|---|---|---|---|
| [AICommunity.vue](file:///g:/1/client/src/views/AICommunity.vue#L1481) | 1481 | `text-shadow: none;` | AI 社区标题 |
| [FeedbackBtn.vue](file:///g:/1/client/src/components/FeedbackBtn.vue#L102) | 102 | `text-shadow: 0 1px 1px var(--color-black-30);` | 反馈按钮文字 |
| [ConfirmPurchasePopUp.vue](file:///g:/1/client/src/components/ConfirmPurchasePopUp.vue#L277) | 277 | `text-shadow: 0 0 5px var(--color-cyan-50);` | 购买弹窗标题 |
| [Home.vue.styles.scss](file:///g:/1/client/src/views/Home.vue.styles.scss#L1122) | 1122 | `text-shadow: none;` | 首页标题 |
| [Home.vue.styles.scss](file:///g:/1/client/src/views/Home.vue.styles.scss#L1132) | 1132 | `text-shadow: none;` | 第五页主标题 |
| [PanThumb/index.vue](file:///g:/1/client/src/components/PanThumb/index.vue#L99) | 99-101 | `text-shadow: 0 0 1px var(--color-white), 0 1px 2px var(--color-black-30);` | 卡片组件文字 |
| [UserMembershipBenefits.vue](file:///g:/1/client/src/components/user/UserMembershipBenefits.vue#L239) | 239 | `text-shadow: 0 1px 3px var(--color-rgba-0--0--255--0-15-);` | VIP 列文字 |
| [UserMembershipBenefits.vue](file:///g:/1/client/src/components/user/UserMembershipBenefits.vue#L245) | 245 | `text-shadow: 0 1px 5px var(--color-rgba-124--165--0--0-2-);` | 交易员列文字 |

### 2.2 硬编码颜色违规（27 处，8 个文件）

规范：禁止硬编码十六进制颜色，必须用 CSS 变量。

| 文件 | 行号 | 违规内容 | 说明 |
|---|---|---|---|
| [BackendHealth.vue](file:///g:/1/client/src/views/admin/BackendHealth.vue#L265) | 265-307 | `'#333'`、`'#fff'`、`'#67c23a'`、`'#e6a23c'`、`'#f56c6c'`、`'#409eff'` 等 10 处 | ECharts 图表配置（JS） |
| [Wallet.vue](file:///g:/1/client/src/views/Wallet.vue#L85) | 85-90 | `#000` 3 处 | SVG 标签属性 |
| [MobileDashboard.vue](file:///g:/1/client/src/views/MobileDashboard.vue#L32) | 32-37 | `#000` 3 处 | SVG 标签属性 |
| [FeedbackBtn.vue](file:///g:/1/client/src/components/FeedbackBtn.vue#L95) | 95-97 | `--primary: #ff5569;` 等 3 处 | CSS 局部变量声明 |
| [VideoProgress.vue](file:///g:/1/client/src/components/study/VideoProgress.vue#L80) | 80, 128 | `#f691ff`、`#090df6`、`#3EFFBE`、`#8B0BFF`、`#FFF200`、`#f00` | linear-gradient 渐变 |
| [BigRectangle.vue](file:///g:/1/client/src/components/module/BigRectangle.vue#L31) | 31-32 | `#f0f2f5`、`#909399` | JS 拼 SVG 字符串 |
| [Rectangle.vue](file:///g:/1/client/src/components/module/Rectangle.vue#L29) | 29-30 | `#f0f2f5`、`#909399` | JS 拼 SVG 字符串 |
| [EyeToggle.vue](file:///g:/1/client/src/components/EyeToggle.vue#L46) | 46, 148 | `--color: #909399;`、`--color: #606266;` | CSS 局部变量声明 |

### 2.3 硬编码 box-shadow 违规（114 处，68 个文件）

规范：所有 `box-shadow` 必须用 `var(--global-box-shadow)`。

**违规最多的前 10 个文件**：

| 文件 | 违规数 | 典型行号 |
|---|---|---|
| [EduDocumentation.vue](file:///g:/1/client/src/views/EduDocumentation.vue#L2043) | 7 | 2043, 2279, 3097, 3125, 3987, 4010, 4017 |
| [AiWorldBannerDetail.vue](file:///g:/1/client/src/views/AiWorldBannerDetail.vue#L568) | 5 | 568, 648, 775, 821, 912 |
| [LoginHistory.vue](file:///g:/1/client/src/components/settings/LoginHistory.vue#L268) | 5 | 268, 272, 277, 282, 287 |
| [VideoProgress.vue](file:///g:/1/client/src/components/study/VideoProgress.vue#L67) | 4 | 67, 165, 166, 167 |
| [VipIntroducePopupAlt.vue](file:///g:/1/client/src/components/VipIntroducePopupAlt.vue#L166) | 4 | 166, 258, 268, 298 |
| [PdfViewer.vue](file:///g:/1/client/src/components/PdfViewer.vue#L1050) | 4 | 1050, 1092, 1109, 1230 |
| [FeedbackBtn.vue](file:///g:/1/client/src/components/FeedbackBtn.vue#L104) | 4 | 104, 123, 131, 151 |
| [admin/index.vue](file:///g:/1/client/src/views/admin/index.vue#L428) | 4 | 428, 450, 496, 920 |
| [Chat.vue](file:///g:/1/client/src/views/Chat.vue#L341) | 3 | 341, 342, 344 |
| [AiTextBanner.vue](file:///g:/1/client/src/components/AiTextBanner.vue#L73) | 3 | 73, 97, 122 |

**典型违规模式**：
- `box-shadow: 0 2px 8px var(--color-black-6);`（应直接用 `var(--global-box-shadow)`）
- `box-shadow: 0 4px 12px var(--color-black-10);`（自定义投影值）
- `box-shadow: 0 0 8px var(--el-color-success);`（状态色发光效果）

> 完整 114 处清单见扫描原始数据，涉及 68 个文件，其中 47 个文件各 1 处违规。

### 2.4 高特异性选择器违规（约 78 处）

规范：禁止超过 2 层深度的长链选择器，应用 `:where()` 降特异性。

**4 层长链（8 处，最严重）**：

| 文件 | 行号 | 违规选择器 |
|---|---|---|
| [Vip.vue](file:///g:/1/client/src/views/Vip.vue#L906) | 906 | `html.dark body .vip-page .vip-fixed-bottom-bar` |
| [AIChat.vue](file:///g:/1/client/src/components/ai/AIChat.vue#L13427) | 13427 | `body .api-access-dialog .protocol-tabs .el-tabs__header` |
| [AIChat.vue](file:///g:/1/client/src/components/ai/AIChat.vue#L13433) | 13433 | `body .api-access-dialog .protocol-tabs .el-tabs__content` |
| [AIChat.vue](file:///g:/1/client/src/components/ai/AIChat.vue#L13436) | 13436 | `body .api-access-dialog .protocol-tabs .el-tabs__nav-wrap` |
| [AIChat.vue](file:///g:/1/client/src/components/ai/AIChat.vue#L13443) | 13443 | `body .api-access-dialog .protocol-tabs .el-tabs__nav-scroll` |
| [AIChat.vue](file:///g:/1/client/src/components/ai/AIChat.vue#L13448) | 13448 | `body .api-access-dialog .protocol-tabs .el-tabs__nav` |
| [AIChat.vue](file:///g:/1/client/src/components/ai/AIChat.vue#L13454) | 13454 | `body .api-access-dialog .protocol-tabs .el-tabs__item` |
| [AIChat.vue](file:///g:/1/client/src/components/ai/AIChat.vue#L12021) | 12021 | `:where(:root, body) .floating-chat-dialog-wrapper .floating-chat-dialog div.input-area` |

**3 层长链重灾区文件**（约 50 处）：
- [AICapabilitySelector.vue](file:///g:/1/client/src/components/ai/AICapabilitySelector/AICapabilitySelector.vue)（最多，约 12 处）
- [Distribution.vue](file:///g:/1/client/src/views/Distribution.vue)（6 处 `html.dark .distribution-page .xxx`）
- [BecomeSupplier.vue](file:///g:/1/client/src/views/about/BecomeSupplier.vue)（5 处）
- [Home.vue.styles.scss](file:///g:/1/client/src/views/Home.vue.styles.scss)（多处）
- [EduDocumentation.vue](file:///g:/1/client/src/views/EduDocumentation.vue)（约 20 处 `:where(html.dark) body .edu-docs-root .xxx .xxx`，虽然用了 :where 但内部仍 4 层）

> 重复类名堆叠 `.foo.foo`：**0 处**（项目有 `check-high-specificity-staged.mjs` 脚本持续监控）

---

## 三、中等违规清单（分批治理）

### 3.1 硬编码 z-index 数字（42 处，全部是 `z-index: 0`）

规范：必须用 `--z-*` 变量。但项目变量最小是 `--z-base: 1`，**没有 `--z-0` 变量**。

**建议**：在 [_global-tokens.scss](file:///g:/1/client/src/styles/_global-tokens.scss) 补充 `--z-0: 0;` 或 `--z-background: 0;` 变量，然后批量替换。

**涉及文件**（42 个，全部是 `z-index: 0;`）：

components 目录（11 处）：
- [UniversalLogin.vue](file:///g:/1/client/src/components/login/UniversalLogin.vue#L8704)（2 处：8704, 8712）
- [AIChat.vue](file:///g:/1/client/src/components/ai/AIChat.vue#L8858)（2 处：8858, 9145）
- [AIDialog.vue](file:///g:/1/client/src/components/ai/AIDialog.vue#L911)
- [AIChatLegacy.vue](file:///g:/1/client/src/components/ai/AIChatLegacy.vue#L4809)
- [FeedbackBtn.vue](file:///g:/1/client/src/components/FeedbackBtn.vue#L145)
- [PdfCompare.vue](file:///g:/1/client/src/components/PdfCompare.vue#L383)
- [GlowingBlobBackground.vue](file:///g:/1/client/src/components/login/GlowingBlobBackground.vue#L70)
- [Footer.vue](file:///g:/1/client/src/components/Footer.vue#L971)
- [ThemeSwitch/index.vue](file:///g:/1/client/src/components/ThemeSwitch/index.vue#L153)

views 目录（31 处）：Settings、About、LearnAI、EduDocumentation、VIPMembership、Register、User、AiWorldDetail、Vip、N8NAssistant、Share、Recharge、AiWorldBannerDetail、DistributionCenter、Withdrawal、UserCenter、Courses、Plaza、Login、Orders、Agents、AboutUs、ForgotPassword、AiWorld、Dashboard、AgentsCreate、TopUpSuccess、ContactUs、EnterpriseService、AgentScenario、HumanMachineCollaboration

### 3.2 自己写 1px solid 描边（约 564 处，98 个文件）

规范：禁止自己写 `1px solid #xxx`，必须用 `var(--unified-border)`。

**违规最多的前 10 个文件**：

| 文件 | 违规数 |
|---|---|
| [DramaScriptExcel.vue](file:///g:/1/client/src/components/ai-generation/DramaScriptExcel.vue) | 44 |
| [enterprise/EnterpriseService.vue](file:///g:/1/client/src/views/enterprise/EnterpriseService.vue) | 26 |
| [AICommunity.vue](file:///g:/1/client/src/views/AICommunity.vue) | 29 |
| [UniversalLogin.vue](file:///g:/1/client/src/components/login/UniversalLogin.vue) | 37 |
| [AIChat.vue](file:///g:/1/client/src/components/ai/AIChat.vue) | 34 |
| [LearnAI.vue](file:///g:/1/client/src/views/LearnAI.vue) | 34 |
| [Settings.vue](file:///g:/1/client/src/views/Settings.vue) | 18 |
| [EduDocumentation.vue](file:///g:/1/client/src/views/EduDocumentation.vue) | 18 |
| [N8NAssistant.vue](file:///g:/1/client/src/views/N8NAssistant.vue) | 16 |
| [SecurityAuditDashboard.vue](file:///g:/1/client/src/views/SecurityAuditDashboard.vue) | 12 |

> 说明：部分违规是 `border: 1px solid var(--border-unified-color)`，虽用了变量颜色但仍未用 `var(--unified-border)` 完整变量，属于轻度违规。

### 3.3 硬编码圆角数字（403 处，100 个文件）

规范：所有 `border-radius` 必须用 `var(--global-border-radius)`。

**违规最多的前 10 个文件**：

| 文件 | 违规数 |
|---|---|
| [EduDocumentation.vue](file:///g:/1/client/src/views/EduDocumentation.vue) | 24 |
| [PdfToolsPanel.vue](file:///g:/1/client/src/components/PdfToolsPanel.vue) | 16 |
| [AIChat.vue](file:///g:/1/client/src/components/ai/AIChat.vue) | 12 |
| [Tools.vue](file:///g:/1/client/src/views/Tools.vue) | 9 |
| [AiWorldBannerDetail.vue](file:///g:/1/client/src/views/AiWorldBannerDetail.vue) | 11 |
| [AiWorld.vue](file:///g:/1/client/src/views/AiWorld.vue) | 11 |
| [Wallet.vue](file:///g:/1/client/src/views/Wallet.vue) | 9 |
| [admin-classic/index.vue](file:///g:/1/client/src/views/admin-classic/index.vue) | 8 |
| [admin/index.vue](file:///g:/1/client/src/views/admin/index.vue) | 8 |
| [studyindex/ModelItem.vue](file:///g:/1/client/src/components/studyindex/ModelItem.vue) | 8 |

> 说明：`border-radius: 50%`（圆形）和 `border-radius: 9999px`（胶囊）不算违规，是特殊用法，已排除。

### 3.4 var() fallback 写法（842 处，54 个文件）

规范：禁止在 `var()` 里写 fallback，token 应在全局定义。

**违规类型分布**：

| fallback 类型 | 违规数 | 示例 |
|---|---|---|
| `var(--x, var(--y))` 嵌套 var | 629 处 | `var(--el-text-color-primary, var(--color-gray-333))` |
| `var(--x, 数字)` 数字/尺寸 | 212 处 | `var(--global-border-radius, 8px)` |
| `var(--x, '字符串')` 字符串 | 1 处 | `var(--font-family-chinese, 'PingFang SC'...)` |
| `var(--x, #fff)` 颜色 | 0 处 | — |
| `var(--x, rgba(...))` rgba | 0 处 | — |

**违规最多的前 5 个文件**：

| 文件 | 违规数 |
|---|---|
| [UniversalLogin.vue](file:///g:/1/client/src/components/login/UniversalLogin.vue) | 125 |
| [Home.vue.styles.scss](file:///g:/1/client/src/views/Home.vue.styles.scss) | 59 |
| [EduDocumentation.vue](file:///g:/1/client/src/views/EduDocumentation.vue) | 60 |
| [AIChat.vue](file:///g:/1/client/src/components/ai/AIChat.vue) | 41 |
| [Login.vue.styles.scss](file:///g:/1/client/src/views/Login.vue.styles.scss) | 48 |

---

## 四、合规情况良好的项（表扬）

| 检查项 | 结果 |
|---|---|
| `!important` 使用 | 0 处违规（测试文件里的 3 处是断言代码） |
| 硬编码 rgba 透明度 | 0 处违规（src 业务代码全部用变量） |
| `.foo.foo` 重复类名堆叠 | 0 处违规（有脚本持续监控） |
| `var(--x, #fff)` 颜色 fallback | 0 处违规 |
| `var(--x, rgba(...))` rgba fallback | 0 处违规 |

---

## 五、治理建议（按优先级）

### 第一优先级：严重违规（影响视觉统一）
1. **text-shadow（8 处）**：6 个文件，直接删除或改用颜色对比
2. **硬编码颜色（27 处）**：8 个文件，替换为 CSS 变量
3. **4 层长链选择器（8 处）**：用 `:where()` 包裹前缀降特异性

### 第二优先级：高频违规（批量处理）
4. **硬编码 box-shadow（114 处）**：68 个文件，统一替换为 `var(--global-box-shadow)`
5. **3 层长链选择器（约 50 处）**：集中在 AICapabilitySelector、Distribution、BecomeSupplier 等

### 第三优先级：中量违规（需先补变量）
6. **硬编码 z-index: 0（42 处）**：先在全局补 `--z-0: 0;` 变量，再批量替换
7. **var() fallback（842 处）**：数量大，建议分批，先处理违规最多的 5 个文件

### 第四优先级：大量违规（长期治理）
8. **1px solid 描边（约 564 处）**：98 个文件，建议写脚本批量替换 `1px solid var(--border-unified-color)` → `var(--unified-border)`
9. **硬编码圆角（403 处）**：100 个文件，建议写脚本批量替换数字 → `var(--global-border-radius)`

---

## 六、相关文件索引

- 设计规范：[design.md](file:///g:/1/client/docs/design.md)
- 全局 token：[_global-tokens.scss](file:///g:/1/client/src/styles/_global-tokens.scss)
- Element Plus 变量：[element-plus-vars.scss](file:///g:/1/client/src/styles/element-plus-vars.scss)
- 项目铁律：[.cursorrules](file:///g:/1/client/.cursorrules)
- 已有审计报告：[IMPORTANT_AND_SPECIFICITY_AUDIT.md](file:///g:/1/client/docs/IMPORTANT_AND_SPECIFICITY_AUDIT.md)
- 高特异性检查脚本：[check-high-specificity-staged.mjs](file:///g:/1/client/scripts/check-high-specificity-staged.mjs)
