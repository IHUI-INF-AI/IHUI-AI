# mobile-rn × Uniapp 历史项目(Ai-WXMiniVue)一致性复审报告

> 审计日期:2026-09-05 · 方式:双并行盘点代理穷举(uniapp 端 4 份清单 + RN 端 3 份清单)+ 主会话逐点复核
> 对照物:`D:\历史项目存档\zhs_app-ZZ\Ai-WXMiniVue\src` ↔ `G:\IHUI-AI\apps\mobile-rn\src`
> 任务登记:PROJECT_PLAN.md「P0 移动端 RN 完整复刻 Uniapp 历史项目 → 复刻差异复审批次三」

---

## 一、总体结论

| 维度 | 结论 |
|---|---|
| 页面覆盖 | uniapp 注册路由 70 页(7 主包+7 分包)→ RN 全部有对应 screen;**确诊缺失 2 个**(见 §三.1) |
| 组件挂载 | RN 61 个组件**全部被引用**(GlobalFloatBox/OfflineBanner 挂 App.tsx 全局,唯一孤儿 common/Default.tsx);uniapp 端自身有 20+ 孤儿组件属原项目冗余,不应照搬 |
| 交互/弹窗 | 五大核心页(首页/AI应用商店/广场/动态/我的)的 Drawer、分类弹层、搜索态、返回顶部、分享赚现金、模型/智能体/素材三列表弹窗、ModelConfigDialog、登录弹窗**均已对齐**(历轮修复成果属实) |
| 结构性差异 | **RN TabBar 与 uniapp 主页面五分法不一致**——这是用户感知"使用逻辑不一样"的最大单项,需用户拍板(见 §三.3) |
| 间距/位置 | rpx 换算体系已建(`src/utils/rpx.ts`,750 设计宽);抽查确诊 2 处微差已修;全面逐页 audit 待批次执行(见 §三.2) |

## 二、原项目关键事实(盘点结论,纠正既往认知)

1. **原项目没有可见的底部 tabBar**:`customTabBar/index.vue` 整体 `v-if="false"` 且未被任何页面 import;5 个主页面 `showTabbar` 硬编码 false;主页面切换靠 `uni.reLaunch`。RN 端的 5-Tab 底栏是 RN 端自建设计。
2. **ToggleButtonGroup 在原项目已失效**:整模板 `v-if="false"`(6 个 toggle 完全不渲染),RN 端 9-03 已正确对齐为隐藏。
3. **原项目自身存在 3 个死链页**:首页 navigateTo 指向未注册的 `/pages/tools/ai_voice`、`/pages/tools/ai_teacher`、`/pages/tools/marketing-assistant`(点过去无页面),RN 无需复刻。
4. **pages.json 无 tabBar 配置**,首页里的 `uni.switchTab` 实际无效,全部走 reLaunch。

## 三、确诊差异与处置

### 1. 缺失页面(第一轮报告修正版)

| uniapp 页面 | 第一轮判断 | 执行后实况 |
|---|---|---|
| `pages/distribution_personnel_list`(index + detail) | 缺失 | **已补齐**:新增 DistributionPersonnelListScreen(446 行)+ DistributionPersonnelDetailScreen(194 行),路由注册 + Distribution 功能块「我邀请的团队」入口 + i18n 5 语言 |
| `pages/user_order_list`(index) | ~~缺失~~ **误判** | 实际已被 OrderScreen 覆盖(代码注释明确对齐该页:tab/分页/空态逐字对齐);另按 1:1 状态徽章配色标准新增 UserOrderListScreen,UserCard 订单入口改指新页,Order 路由保留 |
| `pages/member/index.vue` | 未注册死页 | 不复刻(维持原判) |

注:uniapp detail.vue 的"某成员的下级成员列表"依赖旧接口把 openId 当 token 传同一端点;RN 新后端 /distribution/team/members 无按父级过滤参数,下级列表区以成员信息卡 + 空态降级(FIXME(api) 待后端补端点)。

### 2. 本轮已修复(已过 tsc+eslint)

| # | 文件 | 修复内容 |
|---|---|---|
| 1 | `src/screens/HomeScreen.tsx` | 补挂 `NotificationPanel`(对齐 ai_index 顶层 `PushNotification` 推送通知弹窗;此前仅 ChatScreen 挂载,首页漏挂) |
| 2 | `src/components/StudyBar.tsx` | 间距 rpx 精确化:marginBottom 18rpx、padding 2rpx、tab height 52rpx、水平间距 4rpx(对齐 `study/bar.vue`;此前 9/2/26/3dp 存在 1-2px 漂移) |

### 3. 结构性产品差异(P2,需用户决策)

- **RN TabBar**:首页(Home) / 课程(Course) / AI(AgentScreen≈商店) / 直播(Live) / 我的(Profile)
- **Uniapp 主页面五分法**:智汇AI社区(aiIndex) / AI应用商店(tools) / 广场(plaza) / 动态(share) / 我的(user),且原项目 tabbar 不可见、靠 reLaunch
- 影响:uniapp 的一级入口「广场」「动态」在 RN 端降级为 Drawer 二级入口(Drawer square→Plaza、share→News 跳转已通);"课程/直播"是 RN 端新增主 Tab。
- 待拍板:是否把「广场」「动态」提升为 RN 主 Tab,或维持现结构。

### 4. 不复刻项(原项目冗余,备查)

uniapp 端 20+ 孤儿组件(AiModelCard、CommissionFloatingIcon、ConfirmPurchasePopUp、EarningsStatisticsCard、FunctionBlockColumn、PersonalInformationCard、VoiceInput、colorful_loader、customTabBar、nav-bar、pay_btn、title-switch 局部副本等)系原项目自身历史包袱;RN 端已按"有效实现"复刻、未照搬冗余,属正确决策。

## 四、执行结果(同日批次三,主会话 + 双并行代理)

1. **缺失页面已补齐**(见 §三.1):3 个新 Screen + 路由 + 入口接线 + i18n 五语言(distributionPersonnel 15 key / userOrder 12 key)。
2. **TeamScreen 增强对齐** uniapp distribution_personnel_list:packages/types 扩展 TeamMember(transactionVolume/commission/orderNum)+TeamSortTab+排序/日期/触底加载 props;packages/app 共享屏加排序行(70rpx/圆角 15rpx/激活黑描边)、排名 No{n} 徽标、成交额·佣金·订单数高亮行(#ff9800 42rpx)、ListFooter 加载;mobile-rn wrapper 客户端排序/日期筛选/分页累积(对齐 listOrder/updateDisplayList)。
3. **间距批次(部分)**:spacing 代理中断前已修 NavBar/BottomActionBar/Drawer/TabBar.styles/CardWithList/GlobalFloatBox/AgentScreen/HomeScreen 等(rpx 对齐注释留痕);ProfileScreen/UserCard 清单待续。
4. **验证**:packages/types + packages/app tsc 0 错误;mobile-rn tsc 0 新增错误(App.tsx 为并行会话 WIP);eslint 0 错误;vitest 261/261 全绿。
5. **未 commit**:工作区混有并行会话 WIP,避免混提交,待干净会话收口。

## 五、遗留(P1/P2,已登记 PROJECT_PLAN)

- P1:ProfileScreen/UserCard 间距偏差矩阵 audit(批次三未完成部分)。
- P2:Tab 结构决策(§三.3)后按需调整 RootNavigator MainTabs。
