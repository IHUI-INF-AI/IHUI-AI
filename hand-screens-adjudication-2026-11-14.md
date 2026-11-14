<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 17 屏 hand 手抄副本 · 并行裁决报告

> 目标：小程序端应委托 RN 共享屏（单一源）而非手抄副本。门 `check-miniapp-mirror-fidelity` 报 17 屏为 hand。
> 方法：4 个只读 agent 并行逐屏读两端代码（RN 共享屏 spec + 小程序手抄页），产出裁决。
> 日期：2026-11-14。全部 fid=100%（文案维度已覆盖共享源 scope），但样式/结构/功能非机械等价。

## 裁决结论

**0 屏可机械安全直转 hosted 薄壳。** 分三类：

### MODEL_DIFF（业务对象/数据模型根本不同，不能转壳）— 4 屏
| 屏 | spec | route | 差异 |
|----|------|-------|------|
| order-refund | OrderRefundScreen | pkg-shop/order/refund | 单订单表单 vs 多订单 FlatList+下拉刷新；表单字段集/提交签名/空态语义全不同 |
| vip-compare(details) | VipCompareScreen | pkg-shop/vip/details | 共享屏=对比表组件(仅1段)；小程序=权益+套餐+对比+升级复合页，header 取词都不同 |
| post-detail(circle) | PostDetailScreen | pages/circle/detail | 圈子 UGC 动态(评论/点赞/收藏/关注/图片预览) vs 任务兼职风审计字段帖(只读)；route 自述"不参与镜像对账"→源登记错配 |
| share | ShareScreen | pages/share/index | 共享屏=hub 头部装饰段；小程序=完整 hub(3大列表+tab+分页+浮动tabbar)，共享屏覆盖<30% |

### NEEDS_EXTRACT（小程序多出段，需先下沉共享层/定义 slot 才能转壳）— 9 屏
| 屏 | 多出段摘要 |
|----|-----------|
| course-detail | 进度环/工具行/打卡/统计/讲师/简介/目录锁定/购买/笔记/评价/分享/完成弹窗 共10段 |
| course-tab | tab分栏/搜索分页/收藏/进度/API 数据获取（共享屏纯 props 无自取）|
| learn-develop | 数据获取+额外段（共享屏仅 header+grid+联系按钮）|
| study-plan | 多出计划相关段（正文待逐行复核）|
| study-record | 状态筛选 tab(all/in_progress/completed/paused)+客户端过滤+「没有更多」+触底加载+跳详情 |
| video-player | VideoInfo/互动(赞藏分享)/目录/简介/评论/付费弹窗/进度上报/完成标记 共8+段 |
| agent-detail | runtime/info双Tab+权限体系+定价卡+开场白/示例/systemPrompt+收藏/最近+相关智能体+标签 共10组段（共享屏仅"信息卡+开始聊天"约1/6）|
| agent | 轮播/搜索/快捷Tab/模型类型/排序/热门Banner/创建悬浮/吸底输入/配置弹窗/收藏最近 共11组段；另分类关键词数据源分叉(端内写死 vs 词包) |
| ask-create | 分类交互范式分叉(picker弹层 vs chip条)+草稿粒度(全字段 vs 3字段)+提交门禁+5字校验+延迟返回+Taro原生Switch color |

### 候选 SAFE_THIN_SHELL（共享屏是 props 注入式完整实现，可转壳但需端内 wrapper+端口注入）— 4 屏
| 屏 | spec | route | 转壳前置 |
|----|------|-------|---------|
| register | RegisterScreen(328行,完整实现) | pages/register/index | 需建端内 wrapper 注入 t/register API/自动登录/onSendCode 等端口；**认证关键路径，高风险** |
| about | AboutScreen | pkg-about/about/index | 需注入 getAbout/菜单数据/aboutSections；静态信息页 |
| follow | FollowScreen(230行,完整实现) | pkg-user/following/index | **被并发会话占用(M)**，暂不可改 |
| vip(member) | VipScreen | pages/member/index | **被并发会话占用(M)**，暂不可改；需核单会员 vs 多套餐模型 |

## 证据锚点（file:line）
- 共享屏真源在 `packages/app/src/features/**`（props 注入式，非薄壳；子代理曾误判 spec 为薄壳，已更正）。
- 小程序已有 hosted 薄壳范式可照抄：`apps/miniapp-taro/src/pages/setting/index.tsx`（委托 `@ihui/rn-app/features/settings/SettingsScreen`）。
- register/follow 共享屏均 `export function XxScreen(props)` 完整实现于 packages/app/src/features/。

## 占用状态（本轮 git status 实测）
- free：register、about、share、study/plan、study/record、video-detail、learn-develop、order/refund、vip/details
- OCCUPIED(他席在飞 M)：following/index、member/index、course/detail、circle/detail、ask/create、agent-detail、agent、course/list 等

## 收敛建议
17 屏是「逐屏 rn-compat 适配工程」（数据源注入/导航接线/端端口兼容层），非批量机械替换。
建议顺序：① 先清 register/about 两 free 屏（照 settings 范式建 wrapper）；② following/member 等并发落地后再动；
③ MODEL_DIFF 4 屏需先重做 spec（拆单订单表单屏/重定位对比表组件/换配动态详情 spec/升级 ShareScreen 为带 list-tab 端口的 hub 屏）；
④ NEEDS_EXTRACT 9 屏先把多出段抽成共享组件或定义 host slot。
此为门设计判断所印证：hand 存量不进 blocking，正是因多数 hand 页承载比共享屏更丰富/不同的实现。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
