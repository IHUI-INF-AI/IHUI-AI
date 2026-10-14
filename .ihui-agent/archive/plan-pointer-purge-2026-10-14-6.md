# plan-pointer-purge 存量清偿台账(2026-10-14)

> 清偿 PROJECT_PLAN.md 重复登记存量,用户指令「彻底根治 / 一条也不许再产生」。
> 本轮新增 L5(同题折并 F10)/L6(同主键归并 F4)两层真删行归并:自动档已停产指针注记与
> F10 折叠(plan-tasks-merge noPointer,2026-10-14)⇒ 无注记重复行唯有此处收口。
> 准入闸:① 候选正文被幸存行逐字承载;② 行尾独有注记段移植到幸存行且不命中 13d 判据字面;
> ③ 认领牌走既有转移机制。不满足者逐行跳过点名(见下),绝不硬删。
> 分类:L1 940 / L2 12 / L3 1 / L4 6 / L5 2 / L6 0 / 已勾剥注记 2 / 认领转移 0 / 注记移植 1 / 跳过 23。
> 落地方式:对象空间(HEAD blob → 改写 → commit-tree → CAS),从不写工作树;旁路已 attestBypassCommit 留痕。
> 下列每行为被删行原文(带原行号与分类原因)。

- 原 L138(L1 外部持有行 L3824):

```
- [ ] 重启宿主/开机后 `%TEMP%` 才会真指 `D:\DevEnv\Temp`;在此之前任何未接 `scratch-dir` 的 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记 (与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔拍板@2026-10-09 机主授权代行:TEMP 指向等重启自然生效,残余按 G-70 口径并入盘根卫生票。〕
```

- 原 L139(L1 外部持有行 L7990):

```
- [ ] **仍在这台机器上、不由我裁的**:C 盘剩余 5 项未识别条目(优酷 1.3G / ClipFlow / 输入法字典 / 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记 (与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L1230(L1 外部持有行 L9653):

```
- [ ] **未闭环(阻塞主体在生产侧,非本任务代码)**:`deploy/win/ihui-deploy.ps1` 健康门禁连续两轮(11:02、11:16 均成功切到新构建 `2eeda2qr7rdjz.css`)在 8×12s 窗口内未全过 → **自动回滚**,web 现滞留旧构建,桌面端因此看不到新 UI。三项判据中 `web 200` 与 `/api/health` 实测均通过,唯一可疑项是 `Test-LlmGateway`(需 `IHUI_ADMIN_PASSWORD` 登录再探 `/api/llm/providers/health` 取 2xx)。解阻判据:生产机 `Get-Content deploy\win\deploy-loop.log -Tail 40` 的「健康门禁 第 N/8 轮: web= api= llm=」行,确认红项后再决定是修判据还是修通道凭据;失败后另有 30 分钟冷却。 〔更正等待条件(2026-09-27 实测):这一格挂在**本台账**里但**本机不是部署机** —— 服务列表与端口实测均无 IHUI* 服务、8801-8811 无监听(与 §5b/§15b 的盘符失真同族:部署事实属于 D: 那份 checkout)。所以"web 滞留旧构建"在本机既不可复现也不可修,归属应为**部署机持有者**;留在本台账只报数,不得有人为让它消失而在本机改部署脚本。〕〔【归并】重复登记副本(2026-10-01):同主键的另一条登记已翻勾(2026-09-27 判陈旧状态:此后多轮部署健康门禁正常通过,当日实测 /api/health、主站、desktop-feed 全 200),派单以翻勾那条为准,本行不再单独派单。〕
```

- 原 L1234(L1 外部持有行 L9653):

```
- [ ] **未闭环(阻塞主体在生产侧,非本任务代码)**:`deploy/win/ihui-deploy.ps1` 健康门禁连续两轮(11:02、11:16 均成功切到新构建 `2eeda2qr7rdjz.css`)在 8×12s 窗口内未全过 → **自动回滚**,web 现滞留旧构建,桌面端因此看不到新 UI。三项判据中 `web 200` 与 `/api/health` 实测均通过,唯一可疑项是 `Test-LlmGateway`(需 `IHUI_ADMIN_PASSWORD` 登录再探 `/api/llm/providers/health` 取 2xx)。解阻判据:生产机 `Get-Content deploy\win\deploy-loop.log -Tail 40` 的「健康门禁 第 N/8 轮: web= api= llm=」行,确认红项后再决定是修判据还是修通道凭据;失败后另有 30 分钟冷却。〔【归并】重复登记副本(2026-10-01):同主键的另一条登记已翻勾(2026-09-27 判陈旧状态:此后多轮部署健康门禁正常通过,当日实测 /api/health、主站、desktop-feed 全 200),派单以翻勾那条为准,本行不再单独派单。〕
```

- 原 L1814(L1 外部持有行 L15650):

```
- [ ]**Esc 无层栈协议**(方案已定稿,待实施):20+ 处 document/window 的 Esc 监听各自为政且普遍不 `stopPropagation` → 一次 Esc 同时关掉遮罩、弹层、pane、搜索条。**正解不是逐处补 `stopPropagation`**(跨层顺序不可控),而是:①新增 `apps/web/src/lib/overlay-stack.ts` —— `pushOverlay(id)/popOverlay(id)/isTopOverlay(id)`(模块级数组,注册幂等,卸载必 pop);②每个浮层在 open 时 push、close 时 pop,其 Esc 处理器首行 `if (!isTopOverlay(myId)) return`;③`packages/ui-react` 的 Dialog/Popover 家族优先内建该注册(一处接全部端),web 端自绘 portal 层逐个接入;④已有正例可参照其消费写法:`GlobalTopBar.tsx:366`、`TagsView.tsx:135`、`hover-preview-card.tsx:44`(已用 stopPropagation 的三层)。解阻判据:构造"遮罩 + 弹层 + pane 三层叠开"场景按一次 Esc,只有最上层关闭(真机 `aria-expanded`/`data-state` 逐层断言)。注意 `work-panel.tsx` 属共享包,须与结构改造项同票评估。 〔PROGRESS 2026-09-25: overlay-stack 已 30 处在栈,本批补命令面板桥接 commit 69523d6e5;ui-react 家族内建与"三层叠开"真机断言仍未做〕〔【归并】重复登记副本(2026-10-01):同主键的另一条登记「Esc 无层栈协议」已翻勾并收口(完成提交 c80253f29b;2026-09-29 值守按实证收口,证据 G-816706),派单以翻勾那条为准,本行不再单独派单。〕
```

- 原 L3912(L1 外部持有行 L15651):

```
- [ ]（进行中）RN 分类栏统一收口(承 2026-09-23 04:19 会话被取消的迁移,用户原话"所有的菜单栏分类栏没有设计好 统一 好看的符合项目统一的样式 点击后下拉窗的形式呈现 左右滑动"):地基 `packages/app/src/components/category/{CategoryInlineBar,CategoryDropdown}` 补包根导出(`@ihui/rn-app` 可直接 import,此前只到 `components/index.ts` 端内取不到)+ Dropdown 面板改 `ScrollView`(修"选项多于 8 条被 maxHeight+overflow:hidden 静默裁切")+ 圆角一律 `rnRadius` 档(对齐同日新立 §4 圆角单一源头)。**迁移面 16 处**:共享层 9 屏(square/plaza/order/team/ranking/recruitment/token-value/study-index/study-publish,其中 study-publish 的 API 动态赛道 = CategoryDropdown 装车点)+ 端内 7 屏(ProfileScreen / TokenValueScreen / TopicListScreen / StudyIndexScreen / MaterialList / AgentScreen 赛道弹层双行并删违规 `trackDivider` hairline 分割线 / FenLeiOverlay 赛道行+分类网格双条)。孤儿裁定:`StudyBar`、`SingleTypeBar` 已零调用点(删除需同步下调 `scripts/radius-single-source-baseline.json` 的 2 条基线,本轮未做)。**真机取证(v0.0.4 / code 5 release 包,Hermes 字节码 bundle grep 命中 `CategoryInlineBar` / `agent-track-bar` / `ctaFill`)**:① 点顶栏「分类」弹出的那块当时仍是迁移清单外的 `FenLeiOverlay`(已补迁);② 像素直方图实测选中 chip 前景 = 深色 `ctaText` #16262E 而底色仍是容器同色 #1A1A1A —— `ctaFill` 根本没落上,即"选中态看不见";③ idle chip 以 `surface.card` 作底,落在同为 `surface.card` 的弹层面板上完全隐形。已修:idle 底改 `surface.muted` + 描边 `border.medium`(两套主题下与页面 bg / 面板 card 均不同档)。**根因未定**:曾按"Pressable 函数式 style 整条路径未生效"归因并把容器视觉移到普通 View 数组路径(该改动本身无害,少一个变量),但随即被反证 —— 全仓 58 个文件用同款 `style={({pressed}) => [base, active ? activeStyle : null]}`,其中 `SingleTypeBar.tsx:142-143` 与迁移前的 SquareScreen 内联条都是这条路径且真机显示正常;`ctaText`(#16262E)在同一 chip 上生效而 `ctaFill`(#a3c4d6)不生效,也排除了"整套 token 缺失"(dist 陈旧版两者皆无,若走 dist 文字应回落到 #A3A3A3)。待手机回线后先加高对比标记色(如临时 `#FF00FF`)做二分,再定是样式合并路径还是取色问题。待复验(设备 19:5x 起 `adb devices` 为空,kill-server 重连无效,USB 侧仍见 3 个 Composite Device)。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记 (与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔现读@2026-10-13:票面「根因未定(ctaFill 未落上)」已从代码侧消解,不再需要 #FF00FF 二分 —— ① 2026-09-26 CTA 档用户定稿回翻(`packages/design-tokens/src/rn-tokens.ts:351` 头注:「主按钮/选中胶囊一律 brand.cta + brand.ctaForeground 成对」),当前 `CategoryInlineBar` 选中态 = `tk.brand.cta` 纯黑底 × `tk.brand.ctaForeground` 白字(HEAD 源码 L203/L217),9-24 实测时的 ctaFill 浅蓝档设计已废;② 按压反馈走 children 渲染函数已落地(`de7f150bac`,源码 L121-125 注释即取证);③ idle 底 `surface.muted` + 描边 `border.medium` 在 HEAD(L197-198)。剩两项:真机像素复验(分类栏屏均需登录态,§5e-2 不可代签)+ 孤儿组件 `StudyBar`/`SingleTypeBar` 删除需同步下调 `radius-single-source-baseline.json` 2 条基线。手机已回线(Redmi flame 在线),登录态不在场(重装后已清)。〕
```

- 原 L3915(L1 外部持有行 L15652):

```
- [ ] **C 组刻意没动,待用户定性**:`C:\ai_zhs\cert\*.pem`(5 个,每个仅 10–20 字节,不可能是真 PEM, 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记 (与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L3916(L1 外部持有行 L4700):

```
- [ ]（进行中） **本轮未落地、需重做的一批(web 86 处内的键名对齐)**:该批次报告改了 4 个文件(`DeveloperKeyDialog` / `AiGenerationContent` / `PermissionSelector` / `helpers`),**逐条按内容复核后全部不在 HEAD**(`git grep <新键名> HEAD -- apps/web` 四处均 0 命中),工作区也已被并发会话覆盖 → 判为**丢失需重做**,不要当成已完成。中途我一度按"工作区里有"记成"已落地",那是读到了被覆盖前的窗口 —— 并行期复核一律以 **HEAD 对象树内容**为准(档案第 4 节已记此教训)。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记 (与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L3917(L1 外部持有行 L4709):

```
- [ ]（进行中）**守门 91 冻结的 9 处待清 + 一项方法论债(2026-09-24)**:① study-publish 整文件主题化(14 处 `getTokens('light')`,8 处在模块级 StyleSheet.create 里,须改成按 scheme 生成的函数或下沉到组件内), 改完后 `node scripts/check-theme-prop-wiring.mjs --update-baseline` 应收窄; ② 7 个他人 M 在制的屏(CourseDetail / Distribution / LiveDetail / ModelPlaza / N8nModel / PostCreate / SharedDemo)待其会话自行接线; ③ `{...props}` 展开类站点被判 spread-unknown(判不出即如实报,不静默放行)—— 要真正覆盖须先给端内 wrapper 的 props 建立类型事实,属独立改造; ④ 方法论债:**本轮两次误判同源** —— 一次是把像素被 `rgba(0,0,0,0.6)` 遮罩压暗 40% 当成"颜色没落上", 一次是用"文本里有没有某个键"统计出"0 处漏传"。两者的共同错误是**用一个不测量目标东西的探针给出肯定结论**。 纪律:凡给出"0 处 / 没有 / 已全清"这类否定性结论,必须先构造一个**已知应被命中的正例**喂给同一判据(阳性对照), 否则该结论不得写进文档或据此决定"不做"。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记 (与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L3918(L1 外部持有行 L4700):

```
- [ ] **本轮未落地、需重做的一批(web 86 处内的键名对齐)**:该批次报告改了 4 个文件(`DeveloperKeyDialog` / `AiGenerationContent` / `PermissionSelector` / `helpers`),**逐条按内容复核后全部不在 HEAD**(`git grep <新键名> HEAD -- apps/web` 四处均 0 命中),工作区也已被并发会话覆盖 → 判为**丢失需重做**,不要当成已完成。中途我一度按"工作区里有"记成"已落地",那是读到了被覆盖前的窗口 —— 并行期复核一律以 **HEAD 对象树内容**为准(档案第 4 节已记此教训)。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记 (与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L3919(L1 外部持有行 L8009):

```
- [ ] **紧急(他人暂存态,非本会话所为,2026-09-24 11:0x 发现)**:**索引里有 16 条"已暂存的删除"**,一次不带 pathspec 的普通 commit 就会把这些**已入库功能从版本树删掉**。清单含三个成体系功能族 + 一道守门:① D62 语音字幕(`packages/shared/src/chat/voice-subtitles.ts` + web 组件 + 测试)、② D91 批注锚点(`annotation-anchors.ts` 同族)、③ D67 额度归属(`quota-ownership.ts` 同族)、④ **并发会话 cb99ef0c 刚提交的 `apps/mobile-rn/src/theme/color-scheme-sync.ts` 及其测试与 NativeWind mock**(删掉即把"App 主题开关驱动 NativeWind"这次修复整体回退)、⑤ `scripts/check-home-junctions.mjs` + 其镜像测试。**判为误删而非迁移的依据**:索引里的桶文件 `packages/shared/src/chat/index.ts` **与 HEAD 一字未改且仍导出这三模块**(二者矛盾 ⇒ 构建必炸,实测 Metro 就在 `export * from './voice-subtitles'` 处失败),且`git ls-files` 全仓**无替代路径**。**本会话处置边界**:只把 13 个文件(2626 行)的内容**恢复到工作区**让构建可用,**索引一字未动** —— 是否撤销这些暂存删除由制造它们的会话自己决定(§5b:他人已暂存的删除只报数、不代裁)。取证:`git diff --cached --diff-filter=D --name-only`;复跑恢复:`node .ihui-agent/tmp/rn-build/restore-worktree.mjs`。**另注**:`heal-worktree-tracked.mjs --check` 此时报"工作区已跟踪文件存续正常"—— 其判据②要求"索引 blob == HEAD blob",而暂存删除使该条件不成立,故**这类"已暂存的删除"不在存续自愈覆盖面上**,是一道无人看的路;要闭环需在守门侧对 `--diff-filter=D` 的暂存删除单独计数并阻断(未擅自新增守门,留单)。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记 (与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L4042(L1 外部持有行 L15653):

```
- [ ]（进行中）〔重复登记副本(2026-10-13):本行与「RN 分类栏统一收口(承 2026-09-23 04:19 会话被取消的迁移,用户原话"所有的菜单栏分类栏没有设计好 统一 好看的符合项目统一的样式 点击后下拉窗的形式呈现 左右滑动")」同题、与 3912 行正文逐字相同,派单以 3912 行为准(含 2026-10-13 现读注记),本行不再单独派单;按 §1 F4 不动勾选。〕
```

- 原 L4608(L1 外部持有行 L15653):

```
- [ ]（进行中）〔重复登记副本(2026-10-13):本行与「本轮真机走查查出、刻意未批量改的两项结构性欠账(2026-09-24)」同题,但正文是 **2026-09-24 撤回前的旧读数**(「已实测确认当前无其他受害调用点(212 组件漏传 0 处)」该结论已于同日撤回,真实命中 118 处/117 文件、已修 108 处);派单以 4609 行为准,本行不再单独派单;按 §1 F4 不动勾选。〕
```

- 原 L4618(L1 外部持有行 L11430):

```
- [ ] page_* 动词的**跨端登记**未做:web / miniapp-taro / RN / desktop / api 侧 `agent_action` 枚举与〔【归并】重复登记副本(2026-10-01):同主键的另一条登记已翻勾(2026-09-25,L13272;孪生旧副本同题已勾于 L9387;apps/api 侧子项 2026-09-28 复判「无消费方,登记即造假,不硬接、不再派单」),本行正文亦被并发插入截断,派单以翻勾那条为准,本行不再单独派单。〕
```

- 原 L4623(L1 外部持有行 L15654):

```
- [ ]**Esc 无层栈协议**(方案已定稿,待实施):20+ 处 document/window 的 Esc 监听各自为政且普遍不 `stopPropagation` → 一次 Esc 同时关掉遮罩、弹层、pane、搜索条。**正解不是逐处补 `stopPropagation`**(跨层顺序不可控),而是:①新增 `apps/web/src/lib/overlay-stack.ts` —— `pushOverlay(id)/popOverlay(id)/isTopOverlay(id)`(模块级数组,注册幂等,卸载必 pop);②每个浮层在 open 时 push、close 时 pop,其 Esc 处理器首行 `if (!isTopOverlay(myId)) return`;③`packages/ui-react` 的 Dialog/Popover 家族优先内建该注册(一处接全部端),web 端自绘 portal 层逐个接入;④已有正例可参照其消费写法:`GlobalTopBar.tsx:366`、`TagsView.tsx:135`、`hover-preview-card.tsx:44`(已用 stopPropagation 的三层)。解阻判据:构造"遮罩 + 弹层 + pane 三层叠开"场景按一次 Esc,只有最上层关闭(真机 `aria-expanded`/`data-state` 逐层断言)。注意 `work-panel.tsx` 属共享包,须与结构改造项同票评估。〔【归并】重复登记副本(2026-10-01):同主键的另一条登记「Esc 无层栈协议」已翻勾并收口(完成提交 c80253f29b;2026-09-29 值守按实证收口,证据 G-816706),派单以翻勾那条为准,本行不再单独派单。〕
```

- 原 L4741(L1 外部持有行 L9658):

```
- [ ]（进行中） **Esc 无层栈协议**(方案已定稿,待实施):20+ 处 document/window 的 Esc 监听各自为政且普遍不 `stopPropagation` → 一次 Esc 同时关掉遮罩、弹层、pane、搜索条。**正解不是逐处补 `stopPropagation`**(跨层顺序不可控),而是:①新增 `apps/web/src/lib/overlay-stack.ts` —— `pushOverlay(id)/popOverlay(id)/isTopOverlay(id)`(模块级数组,注册幂等,卸载必 pop);②每个浮层在 open 时 push、close 时 pop,其 Esc 处理器首行 `if (!isTopOverlay(myId)) return`;③`packages/ui-react` 的 Dialog/Popover 家族优先内建该注册(一处接全部端),web 端自绘 portal 层逐个接入;④已有正例可参照其消费写法:`GlobalTopBar.tsx:366`、`TagsView.tsx:135`、`hover-preview-card.tsx:44`(已用 stopPropagation 的三层)。解阻判据:构造"遮罩 + 弹层 + pane 三层叠开"场景按一次 Esc,只有最上层关闭(真机 `aria-expanded`/`data-state` 逐层断言)。注意 `work-panel.tsx` 属共享包,须与结构改造项同票评估。 〔PROGRESS 2026-09-25: overlay-stack 已 30 处在栈,本批补命令面板桥接 commit 69523d6e5;ui-react 家族内建与"三层叠开"真机断言仍未做〕〔【归并】重复登记副本(2026-10-01):同主键的另一条登记「Esc 无层栈协议」已翻勾并收口(完成提交 c80253f29b;2026-09-29 值守按实证收口,证据 G-816706),派单以翻勾那条为准,本行不再单独派单。〕
```

- 原 L4743(L1 外部持有行 L9659):

```
- [ ]（进行中） **Esc 无层栈协议**(方案已定稿,待实施):20+ 处 document/window 的 Esc 监听各自为政且普遍不 `stopPropagation` → 一次 Esc 同时关掉遮罩、弹层、pane、搜索条。**正解不是逐处补 `stopPropagation`**(跨层顺序不可控),而是:①新增 `apps/web/src/lib/overlay-stack.ts` —— `pushOverlay(id)/popOverlay(id)/isTopOverlay(id)`(模块级数组,注册幂等,卸载必 pop);②每个浮层在 open 时 push、close 时 pop,其 Esc 处理器首行 `if (!isTopOverlay(myId)) return`;③`packages/ui-react` 的 Dialog/Popover 家族优先内建该注册(一处接全部端),web 端自绘 portal 层逐个接入;④已有正例可参照其消费写法:`GlobalTopBar.tsx:366`、`TagsView.tsx:135`、`hover-preview-card.tsx:44`(已用 stopPropagation 的三层)。解阻判据:构造"遮罩 + 弹层 + pane 三层叠开"场景按一次 Esc,只有最上层关闭(真机 `aria-expanded`/`data-state` 逐层断言)。注意 `work-panel.tsx` 属共享包,须与结构改造项同票评估。〔【归并】重复登记副本(2026-10-01):同主键的另一条登记「Esc 无层栈协议」已翻勾并收口(完成提交 c80253f29b;2026-09-29 值守按实证收口,证据 G-816706),派单以翻勾那条为准,本行不再单独派单。〕
```

- 原 L5097(L1 外部持有行 L4996):

```
- [ ]**WP-8 上下文占用归因 + 流式工具账本 + 目标完成独立校验轮**。后者是补 〔PROGRESS 2026-09-26(按 HEAD 实测三件分档,票保持未勾):①**流式工具账本**已入库且有消费点(`apps/cli/src/stream-tool-ledger.ts` 在 HEAD,`commands/agent.ts`、`hooks/index.ts`、`hooks/trust.ts` 三处引用,`git grep -l` 实测非 0);②**上下文占用归因**已入库(`packages/shared/src/utils/context-attribution.ts`+ `apps/web/src/components/ai/context-usage-ring.tsx` + 定向测试);③**目标完成独立校验轮**只有契约与 web 呈现位(`packages/api-client/src/endpoints/agent-runtime.ts` 的 goalCriteria/校验结论字段 + web 词包 `goalAchieved`/`goalUnmet` 等键),**执行侧闸门零命中**:`git grep -n "verificationRound|goalVerification|judgeGoal|独立校验" HEAD -- apps/cli/src apps/api/src` = 0 命中 ⇒ 循环自宣完成仍未被强制过校验,§8 那条"禁止模型自评 yes"仍未落到运行时。解阻判据:CLI/api 循环侧接契约字段并出一枚"未过校验不得判 achieved"的用例;该格落点在 `apps/cli/src`(当前 12 个文件他人在飞),故本票不派、不代裁。〕 〔【归并】重复登记副本(2026-10-06):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L5168(L1 外部持有行 L9713):

```
- [ ] P1 **区段头「更多」与箭头折成两行**(学习页 3 个区段 + 首页区段,明暗两态均复现)。1:1 裁图确认**不是降采样伪影**(`crop-study1.png`)。**根因未定**:`MoreLink` 自身是 `flexDirection:'row'` 且 Yoga 默认 `nowrap`,按推理不可能换行;调用面(`LearnScreen.renderSectionHeader` / `MoreTitles` / `CardWithList` / 两端 HomeScreen)**全部委托唯一实现**,没有第四份自拼。⇒ 本票要求先**量出真实 bounds 再动手**:用 `uiautomator dump`(前提是把 `window_animation_scale`/`transition_animation_scale`/`animator_duration_scale` 三项设 0,否则恒报 `ERROR: could not get idle state` —— 本票踩过,且我一开始把键名写成 `window_transition_animation_scale` 是错的,设了等于没设),取「更多」文本节点与相邻箭头节点的 `[x1,y1][x2,y2]`,分清"同行被挤到下一行"与"父容器给的宽度小于内容宽度"。**无 bounds 证据前不得给 MoreLink 打 `flexShrink`/`flexWrap` 补丁** —— 那是三端共享组件,盲改只会新增第二类债。 〔重复登记副本·派单指针(2026-10-09 量,本席):本行与同题的另一条登记前缀逐字相同而**信息更少**(持有那条在末尾另带一条 2026-10-01 的〔进展…〕注记(代码侧归因与修复已完成、只剩真机复验),本条没有)⇒ **派单以题面「P1 **区段头「更多」与箭头折成两行**…」中较长的那条(现读 822 字节)为准**,本行不再单独派单。按 §1 的 F4 口径**不动勾选** —— 两条都是没做完的事,把没做的记成做过的比原病更响;也不摘声明位编号(守门 71 按"编号 + 题面原文前缀"判丢行,摘号会让自愈层把本行整条回捞,批⑤→⑦ 四轮循环即此),复核入口:`git show HEAD:PROJECT_PLAN.md | grep -F ' ] P1 **区段头「更多」与箭头折成两行**' | awk '{print length()}'` 应现读到两条长度不等的同题行。〕 〔拍板@2026-10-09 机主授权代行:采纳票面纪律——先 uiautomator 取真实 bounds 再动手,盲改共享组件禁止;待真机。〕
```

- 原 L5184(L1 外部持有行 L15656):

```
- [ ]O81 跨端 UI 单一源:小程序端与 App(RN)端逐档同值 + 改一端另一端自动生效(除登录方式与平台机制)。**第 1 票已落(本枚提交)**:对账尺 `scripts/check-cross-end-ui-parity.mjs`(guardian **128**,blocking,棘轮锚点 `scripts/cross-end-ui-parity-baseline.json`,自检 19 例 + 门禁 11 例),AGENTS §4 新节 + README 点名。**立项实测读数**:同名配对组件 19 对 / 174 处差异档 / RN 侧 210 个组件用 `StyleSheet.create` 而小程序侧 91 个用 `className=`(两种样式语言 = 结构上无法自动同步的根因)。**已量到的最小心智事实**:两份自称"唯一实现"的 `BackChevron` 图标墨迹 20px vs 22px、色一档取 `--color-foreground` 一档取 `tk.text.medium`、RN 带系统字号缩放倍率而小程序不带。**剩余票(顺序固定,不得跳)**:② **〔x〕 2026-09-26 已落**:几何档 `packages/design-tokens/src/geometry.js`(`GEOMETRY_PX` 一张表 + `rnGeometry`/`taroGeometry` 两个投影 + `TARO_RPX_PER_PX`,照 `radius.js` 形状,配 `geometry.d.ts`,由 `src/index.ts` 出口),**同枚提交即有两端消费方**(`apps/miniapp-taro/src/components/BackChevron.tsx` 与 `packages/app/src/components/BackChevron.tsx` 各自删掉本地 `= 40`/`= 22`/`= 36` 改取投影);取值依据含"移动端墨迹为何不取 web 顶栏的 14px(`TOPBAR_BTN_BASE` 的 `[&>svg]:!h-3.5` 是桌面密集工具条档)"写在该文件头注。**效果实测**:门 128 索引面 BackChevron 从"仅小程序 20 | 仅 RN 22"变成不再出现在差异清单(18 → 17 条),台账删该键(留着即清单腐烂),门禁测试 11/11 仍绿;`@ihui/design-tokens`、`@ihui/rn-app` typecheck 均 0 错误。**另登记一条与本票无关的既有债**:`pnpm --filter @ihui/miniapp-taro typecheck` 在**干净的 HEAD 上**即报 2 错(`src/pkg-ai/ai/chat.tsx:636` 传 `onTerminalDelta` 而 `StreamEventCallbacks` 无此键 + 参数隐式 any)—— 该文件工作树与 HEAD 逐字节相同,故非在飞改动;未擅自"顺手修"(§12 越权红线),留待该键的归属会话收口。③ 在 `packages/shared` 落"与平台无关的组件源 + 每端注入 primitive adapter"的第一例(试点 `BackChevron`:7 个小程序调用点 / 134 个 RN 调用点,API 取两端并集,动作语义留调用方),两端各自构建 + 真机/模拟器像素复核后才允许下调台账(〔真机复核通过@2026-10-14 本席:BackChevron 于 c12617dd 真机渲染正常(意见反馈页左上 `<` 形态/位置符合)且点击正常返回,落地提交 `a90cc00bb3`,门 128 棘轮与 wiring 测试 12/12 前验绿;④ 的下调台账前置已满足〕);④ 按台账读数从大到小逐族收敛(`InputArea` 23 / `BottomActionBar` 19 / `LoginPopUp` 17 / `NavBar` 15 / `IntelligentAssistant` 14 为前 5),每族一票,收完即下调 `counts` 并**在同枚提交里**留下"该组件只剩一份源"的证据;⑤ 确属平台差异的逐条写 `waivers.reason`,由守门 108 管到期。**架构前提(不要再试第二条路)**:单向适配器已失败过一次(2026-09-22 删 4,662 行,"同名 ≠ 同契约"),所以只能"一份源 + 两端注入",不能"一端包另一端";`packages/app` 是 RN 专属(Taro 跑不了),`packages/ui-native` 13 个组件里 11 个零生产消费方,不得当成已交付能力引用。 〔【归并】重复登记副本(2026-10-06):同主键的另一条登记 「O81 · 跨端UI单一源」,派单以那条为准,本行不再单独派单。〕
```

- 原 L5820(L1 外部持有行 L8032):

```
- [ ] 副本指针(编号 62)：同主键第二份未勾选副本,只加指针不动勾选;当前状态见同主键的当前状态那条(编号相同、不带租约)(该条写明 ChatSearchBar 前提被推翻与 use-chat-search 投影现场)。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L5821(L1 外部持有行 L8033):

```
- [ ] 副本指针(编号 63)：本行与上一条同主键、是并发并集留下的第二份未勾选副本 ⇒ 按 §1 只加指针不动勾选;当前状态见同主键的当前状态那条(编号相同、不带租约)。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L5822(L1 外部持有行 L8034):

```
- [ ] 副本指针(编号 75)：同主键第二份未勾选副本,只加指针不动勾选;当前状态见同主键的当前状态那条(编号相同、不带租约)(该条写明默认档与三轴派生阈值及残余)。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L5824(L1 外部持有行 L8035):

```
- [ ] 副本指针(编号 51)：同主键第二份未勾选副本,只加指针不动勾选;当前状态见带「三面 parity 门 136 现读未接线 0 类」注记的那条(该条写明六类执行器真接线、stub 两类按 §7 保留) 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L5935(L1 外部持有行 L7964):

```
- [ ] **`redact_legacy_procedural_patterns.py` 无人调度 + 元认知 `same_tool_diff_pattern` 把"正常的多样性"记成冲突**:前者是一份写好的清洗器,现读全仓引用面只有它自己的测试(`tests/test_redact_legacy_procedural_patterns.py:28` 直接按路径加载脚本),`app/` 与提交链/守护链零调用点 ⇒ 存量脏 pattern 永远不会被清(判"未接线"要数**调用面**,不是实现文件存在)。后者实测在 `app/services/metacognition.py:328-344`:同一 `tool_name` 下任意两条 procedural 只要 `pattern` 不同就产出一条 `conflict_type: same_tool_diff_pattern`、置信度 `0.6 + |score差|×0.3` 起跳 —— 而本仓自产的记录形如 `doom_loop:<tool>:<sha256(入参)>`,**天然每入参一枚不同 pattern**(摘要与旧的身份样文本在这一维等价:都是"入参不同⇒pattern 不同"),于是同一次死循环沉淀越多,冲突清单越长。这不是冲突,是枚举维度。归属:ai-service 元认知线持有者。解阻判据 = 先定义"什么才算同一工具下的真冲突"(例:同一 `pattern` 前缀 + score 反向),再把该判据接进 `detect_conflicts`,并给清洗器一个明确触发点(写入前 / 定时批量)+ 幂等证明后再谈接线。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6028(L1 外部持有行 L3824):

```
- [ ] 重启宿主/开机后 `%TEMP%` 才会真指 `D:\DevEnv\Temp`;在此之前任何未接 `scratch-dir` 的 〔更正等待条件(2026-09-27 现测):这条"重启宿主后才会生效"在本机**至今没兑现** —— GUI 宿主线上的进程实测 `process.env.TEMP = D:\caches\Temp`(而不是 §26 登记的 `D:\DevEnv\Temp`),而 `D:\caches` 这一族路径按 §26 属"本机不存在/历史死路径"那一型。所以它不是"再等等就好",而是**宿主环境层的分叉**:归 §26 改道机制的持有者处理,不得靠重启碰运气。本行保留未勾选,归属改为"等环境"。〕 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6085(L1 外部持有行 L15856):

```
- [ ]O86b 托盘退出「设上限≠修好」:120s 兜底被用户驳回,改租约模型(默认 5s 必退) —— `c149514135` + tag `desktop-v0.1.47` 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「O86b」,派单以那条为准,本行不再单独派单。〕
```

- 原 L6280(L1 外部持有行 L4996):

```
- [ ]**WP-8 上下文占用归因 + 流式工具账本 + 目标完成独立校验轮**。后者是补 〔PROGRESS 2026-09-26(按 HEAD 实测三件分档,票保持未勾):①**流式工具账本**已入库且有消费点(`apps/cli/src/stream-tool-ledger.ts` 在 HEAD,`commands/agent.ts`、`hooks/index.ts`、`hooks/trust.ts` 三处引用,`git grep -l` 实测非 0);②**上下文占用归因**已入库(`packages/shared/src/utils/context-attribution.ts`+ `apps/web/src/components/ai/context-usage-ring.tsx` + 定向测试);③**目标完成独立校验轮**只有契约与 web 呈现位(`packages/api-client/src/endpoints/agent-runtime.ts` 的 goalCriteria/校验结论字段 + web 词包 `goalAchieved`/`goalUnmet` 等键),**执行侧闸门零命中**:`git grep -n "verificationRound|goalVerification|judgeGoal|独立校验" HEAD -- apps/cli/src apps/api/src` = 0 命中 ⇒ 循环自宣完成仍未被强制过校验,§8 那条"禁止模型自评 yes"仍未落到运行时。解阻判据:CLI/api 循环侧接契约字段并出一枚"未过校验不得判 achieved"的用例;该格落点在 `apps/cli/src`(当前 12 个文件他人在飞),故本票不派、不代裁。〕 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6284(L1 外部持有行 L7954):

```
- [ ] 副本指针(编号 62)：同主键第二份未勾选副本,只加指针不动勾选;当前状态见带 v3wave3 租约的那条(该条写明 ChatSearchBar 前提被推翻与 use-chat-search 投影现场)。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6286(L1 外部持有行 L11136):

```
- [ ] 59. 消息级版本切换 ← 1/3 →(regenerate 改为新增 sibling 而非物理删除;共用 `CanvasVersionMenu` 交互) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「59 · 消息级版本切换←1/3→」,派单以那条为准,本行不再单独派单。〕
```

- 原 L6287(L1 外部持有行 L7955):

```
- [ ] 副本指针(编号 63)：本行与上一条同主键、是并发并集留下的第二份未勾选副本 ⇒ 按 §1 只加指针不动勾选;当前状态见带 v3wave3 租约的那条。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6289(L1 外部持有行 L7956):

```
- [ ] 副本指针(编号 75)：同主键第二份未勾选副本,只加指针不动勾选;当前状态见带 v3wave3 租约的那条(该条写明默认档与三轴派生阈值及残余)。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6290(L1 外部持有行 L4709):

```
- [ ]（进行中）**守门 91 冻结的 9 处待清 + 一项方法论债(2026-09-24)**:① study-publish 整文件主题化(14 处 `getTokens('light')`,8 处在模块级 StyleSheet.create 里,须改成按 scheme 生成的函数或下沉到组件内), 改完后 `node scripts/check-theme-prop-wiring.mjs --update-baseline` 应收窄; ② 7 个他人 M 在制的屏(CourseDetail / Distribution / LiveDetail / ModelPlaza / N8nModel / PostCreate / SharedDemo)待其会话自行接线; ③ `{...props}` 展开类站点被判 spread-unknown(判不出即如实报,不静默放行)—— 要真正覆盖须先给端内 wrapper 的 props 建立类型事实,属独立改造; ④ 方法论债:**本轮两次误判同源** —— 一次是把像素被 `rgba(0,0,0,0.6)` 遮罩压暗 40% 当成"颜色没落上", 一次是用"文本里有没有某个键"统计出"0 处漏传"。两者的共同错误是**用一个不测量目标东西的探针给出肯定结论**。 纪律:凡给出"0 处 / 没有 / 已全清"这类否定性结论,必须先构造一个**已知应被命中的正例**喂给同一判据(阳性对照), 否则该结论不得写进文档或据此决定"不做"。 〔PROGRESS 2026-09-25: ① study-publish 共享屏 15 处 getTokens(light) 由 commit 5ce93b9e1 清零(守门91/83 全绿);②③④ 仍开放〕 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记 (与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6291(L1 外部持有行 L7989):

```
- [ ]（进行中）**合流会静默吞掉「已真机验证」的代码修复,而守门 76/71 对此零覆盖(2026-09-24 实测)**: 本会话 84583fdf6 把 PlazaScreen.tsx:464 / RankingDetailScreen.tsx:171 的 colorScheme 字面量改为 resolvedTheme,**并在 v0.0.5/code8 真机复测通过**(广场页正文由 #f5f5f5/#ebebeb 变 #242424/#1a1a1a,与 NavBar/TabBar 同档)。随后几轮 git-sync-converge 之后,HEAD 里那两处**又变回了写死 "light"** —— 并发会话有一条基于 b1a162c4e7(同文件改造)的独立提交线,经 merge-tree 合流时结果取了对方侧;该合并在 git log -- <path> 的历史简化里被隐去(84583fdf6 根本不出现),所以「我的提交还在 ancestry-path 上」完全不能证明「我的改动还在文件里」。 为什么无人拦:守门 76(stale-revert)与 71(plan-line-loss)都只在 commit 时按**暂存内容**判定,而 converge 走 merge-tree + commit-tree + update-ref,**不跑任何钩子** —— 合流层是这两道门的共同盲区。本会话同一机制差点也吞掉测试桩修复,逐字符串核对后判为误报(命中的是我自己写的解释性注释,非真实 vi.mock 调用),说明受害面是全部经合流的代码改动,不止文档。 本轮处置:已用 cc63b5bd0a 前向重落,并在提交前逐行核对「工作区 vs 当前 HEAD 差量恰好只有这 5 行」(2 处字面量替换 + 1 行 import + 1 行 useTheme 钩子),对方对这两个文件的其余改动零触碰。 建议补法(未擅自实现,属他人守门):converge 成功出口处,对本次推送范围内每个文件跑一次「本会话已提交过的 blob 是否仍被 HEAD 版本包含」断言 —— 即把守门 71 对登记行做的事,对代码行做一次;或更廉价:合流后重跑一次本会话关键判据的 grep 断言。在补上之前,任何「真机验证过」的代码修复,收尾时必须用 git show HEAD:<file> 再核一次,不得以「commit 在 ancestry 上」代替。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记 (与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6293(L1 外部持有行 L7987):

```
- [ ] **⑤-附:运行副本要不要也开邮件,前提已变,请重新决定**。我**没有**覆盖 `D:\DevEnv\monitor\alertmanager\alertmanager.yml`:那是当前唯一真正在到人的 webhook 路由,拿模板产物整文件替换会有回归面;正确做法是在那份文件里**追加** `global` 邮件段 + 一个 email receiver(保留原 route 不动)。因为你当初批准这条的依据是"告警从未送达",而该前提已被我证伪,所以这一步改回由你定,我不代做。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6294(L1 外部持有行 L7990):

```
- [ ] **仍在这台机器上、不由我裁的**:C 盘剩余 5 项未识别条目(优酷 1.3G / ClipFlow / 输入法字典 / 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6295(L1 外部持有行 L4709):

```
- [ ]（进行中）**守门 91 冻结的 9 处待清 + 一项方法论债(2026-09-24)**:① study-publish 整文件主题化(14 处 `getTokens('light')`,8 处在模块级 StyleSheet.create 里,须改成按 scheme 生成的函数或下沉到组件内), 改完后 `node scripts/check-theme-prop-wiring.mjs --update-baseline` 应收窄; ② 7 个他人 M 在制的屏(CourseDetail / Distribution / LiveDetail / ModelPlaza / N8nModel / PostCreate / SharedDemo)待其会话自行接线; ③ `{...props}` 展开类站点被判 spread-unknown(判不出即如实报,不静默放行)—— 要真正覆盖须先给端内 wrapper 的 props 建立类型事实,属独立改造; ④ 方法论债:**本轮两次误判同源** —— 一次是把像素被 `rgba(0,0,0,0.6)` 遮罩压暗 40% 当成"颜色没落上", 一次是用"文本里有没有某个键"统计出"0 处漏传"。两者的共同错误是**用一个不测量目标东西的探针给出肯定结论**。 纪律:凡给出"0 处 / 没有 / 已全清"这类否定性结论,必须先构造一个**已知应被命中的正例**喂给同一判据(阳性对照), 否则该结论不得写进文档或据此决定"不做"。 〔PROGRESS 2026-09-25: ① study-publish 共享屏 15 处 getTokens(light) 由 commit 5ce93b9e1 清零(守门91/83 全绿);②③④ 仍开放〕 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6296(L1 外部持有行 L7989):

```
- [ ]（进行中）**合流会静默吞掉「已真机验证」的代码修复,而守门 76/71 对此零覆盖(2026-09-24 实测)**: 本会话 84583fdf6 把 PlazaScreen.tsx:464 / RankingDetailScreen.tsx:171 的 colorScheme 字面量改为 resolvedTheme,**并在 v0.0.5/code8 真机复测通过**(广场页正文由 #f5f5f5/#ebebeb 变 #242424/#1a1a1a,与 NavBar/TabBar 同档)。随后几轮 git-sync-converge 之后,HEAD 里那两处**又变回了写死 "light"** —— 并发会话有一条基于 b1a162c4e7(同文件改造)的独立提交线,经 merge-tree 合流时结果取了对方侧;该合并在 git log -- <path> 的历史简化里被隐去(84583fdf6 根本不出现),所以「我的提交还在 ancestry-path 上」完全不能证明「我的改动还在文件里」。 为什么无人拦:守门 76(stale-revert)与 71(plan-line-loss)都只在 commit 时按**暂存内容**判定,而 converge 走 merge-tree + commit-tree + update-ref,**不跑任何钩子** —— 合流层是这两道门的共同盲区。本会话同一机制差点也吞掉测试桩修复,逐字符串核对后判为误报(命中的是我自己写的解释性注释,非真实 vi.mock 调用),说明受害面是全部经合流的代码改动,不止文档。 本轮处置:已用 cc63b5bd0a 前向重落,并在提交前逐行核对「工作区 vs 当前 HEAD 差量恰好只有这 5 行」(2 处字面量替换 + 1 行 import + 1 行 useTheme 钩子),对方对这两个文件的其余改动零触碰。 建议补法(未擅自实现,属他人守门):converge 成功出口处,对本次推送范围内每个文件跑一次「本会话已提交过的 blob 是否仍被 HEAD 版本包含」断言 —— 即把守门 71 对登记行做的事,对代码行做一次;或更廉价:合流后重跑一次本会话关键判据的 grep 断言。在补上之前,任何「真机验证过」的代码修复,收尾时必须用 git show HEAD:<file> 再核一次,不得以「commit 在 ancestry 上」代替。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6298(L1 外部持有行 L7992):

```
- [ ] **本波未闭环（归属明确，不是遗漏）**：① 桌面 `page_*` 要真成立需三处同改（新增独立 category / 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6299(L1 外部持有行 L7996):

```
- [ ] **顺手登记一条门 71 的漏判(事实,非本票可修)**:上面这一整节由 `7c22d68d09b` 入库,随后被并发提交 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6302(L1 外部持有行 L11151):

```
- [ ] **本票未做的两件(归属明确,不是遗漏)**:① **同族修法早已存在,收敛器只是最后一个** —— `git-push-guard.mjs:194-211` 与 `check-push-sync.mjs:118-127` 在 2026-09-12 就改成"`ls-remote` 优先、失败才回退本地 ref",并写明两类真实事故("push 明明成功却报验证失败"、"本地已与远端同步却报落后 N ⇒ 诱导 `pull --rebase`,而本机禁用该命令曾两次删库")。**还剩两处把本地指针当第一真值**:`scripts/union-converge.mjs:479`(`resolveTargets` 用它当合并输入 —— 残值会让"已同步/目标已被本地包含"两档跳过判错)与 `scripts/check-merge-addition-loss.mjs:112`(`pendingMerges` 用它算 `remote..HEAD` 区间 —— 残值要么漏判要么重判)。正解不是再抄一份,而是把 `resolveRemoteHead` **上移到 `scripts/lib/face-reader.mjs`**(它已是注入式纯函数,构造面测试现成),让四处共用;② `alignWorktreeAfterHeadMove` 现在仍"失败只记日志",若长期失败(锁一直被占)应喊到人 —— 那属 §5e 通道口径,不由本票顺手接。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6303(L1 外部持有行 L11151):

```
- [ ] **本票未做的两件(归属明确,不是遗漏)** —— **2026-09-25 更正:① 已由 O76 收口(四处共用一份),② 仍未做**。① **同族修法早已存在,收敛器只是最后一个** —— `git-push-guard.mjs:194-211` 与 `check-push-sync.mjs:118-127` 在 2026-09-12 就改成"`ls-remote` 优先、失败才回退本地 ref",并写明两类真实事故("push 明明成功却报验证失败"、"本地已与远端同步却报落后 N ⇒ 诱导 `pull --rebase`,而本机禁用该命令曾两次删库")。**还剩两处把本地指针当第一真值**:`scripts/union-converge.mjs:479`(`resolveTargets` 用它当合并输入 —— 残值会让"已同步/目标已被本地包含"两档跳过判错)与 `scripts/check-merge-addition-loss.mjs:112`(`pendingMerges` 用它算 `remote..HEAD` 区间 —— 残值要么漏判要么重判)。正解不是再抄一份,而是把 `resolveRemoteHead` **上移到 `scripts/lib/face-reader.mjs`**(它已是注入式纯函数,构造面测试现成),让四处共用;② `alignWorktreeAfterHeadMove` 现在仍"失败只记日志",若长期失败(锁一直被占)应喊到人 —— 那属 §5e 通道口径,不由本票顺手接。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6304(L1 外部持有行 L11146):

```
- [ ] **架构契约表最后一块 `packages/types` 翻不正面 —— 台账旧句"0 个模块 managed:true"已失效(2026-09-28 现读)**: HEAD `config/architecture-policy.yaml` 现读 24 块里 **23 块已 `managed:true`**(表头留痕:api-client 第一块、dom-actions 第二块、i18n 第三块、repo-tooling 第四块、其后 19 块一次批量翻正),**只剩 `packages/types`**,而它被表内制度 + 镜像守卫双重按住:`EX-C2-1`(yaml 内)原文写明"按业务域拆成多入口前,不得把该模块翻 managed:true",现读 `packages/types/src/app.ts` = 5298 行(那条例外里写的 5258 已向上漂移 40 行,又一个抄旧取证的实证)而上限 2000; 镜像 `scripts/tests/check-architecture-policy.test.mjs` 的 `MANAGED_FALSE_LEDGER` 做双向集合对账 —— 径行翻正会让 T13 报"清单腐烂"红,而它不在改判据的允许面内。 所以本票**不是清账动作**:`--managed-trial packages/types` 的 0 红是那条例外遮住的,翻正而留例外=把没收口的块记成收口,翻正而删例外=当场 1 红,两种读法都不满足"翻完不产生新红"。 解阻前置(按序,四步同笔):① 拆 `packages/types/src/app.ts` 至各文件 ≤2000;② 同笔删 `EX-C2-1`;③ 同笔删 `MANAGED_FALSE_LEDGER` 的 types 条目;④ 再 trial→翻正→复跑全量/`--staged`/镜像 16 例。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6307(L1 外部持有行 L15659):

```
- [ ] **C 清单里那条"原生 `<a>` 不算 affordance"我试过当场扩,撤回 —— 它不是一行白名单**(2026-09-26): 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6310(L1 外部持有行 L8015):

```
- [ ] **门 137 升更严判据的前置条件（现在不许顺手升）**：首跑 3 命中里 2 处是同词不同义的假阳性 ⇒ 词元匹配仍需收窄（`idx/index/position` 后缀、复数名词指"集合"两种形态尚未进判据）；且 `--strict` 下有 **305 处未判定**（`digest` 两义、`node_modules` 之外的手写散列不可逆性判断）⇒ 本门长期停在建档/报数形态，`--strict` 只在清偿时跑。**不得为消红放宽判据，也不得因数字大而把假阳性当缺陷去"修"没坏的东西。** 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6311(L1 外部持有行 L10189):

```
- [ ]**第二十八批:布尔 ack 的键族从 `deleted` 扩到 `removed / restored / revoked / cleared`**(扩键后的普查现读 **27 处代码面**,其中 12 处是已定性的 `deleted` 那一族): 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6312(L1 外部持有行 L8016):

```
- [ ] **本波次之后仍 open 的账(逐条带归属,派单前先读这一格而不是重新猜)** 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6314(L1 外部持有行 L8022):

```
- [ ] **守门 134 的第二格仍开着（① 已按票面处置完毕,结论是"不补判据、固化测量",枚 `fd46aa9da`）**：① B2 那一跳接裸 SQL 维 —— 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6315(L1 外部持有行 L10223):

```
- [ ]（登记，非本线）relay admin 4 个删除端点零测试覆盖、`o13-bg-rls-live.test.ts` 需要自己的串行通道 〔2026-09-28 现读更正:前半已收口 —— `apps/api/tests/relay-admin-delete-honesty.test.ts`(枚 `ba0575f9b` 在账)恰好覆盖 4 端点×正常/越权/404 共 16 例,本会话现跑连跑两遍 16/16 全绿,且核实 4 链 ack 全部由 .returning() 集合派生无假 ack;后半(o13-bg-rls-live 串行通道)本会话另派在执行。票暂不翻,待后半落地一并归位。〕 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6316(L1 外部持有行 L7959):

```
- [ ] **③桌面 ANR/挂死看门狗 + 崩溃分类学 —— 归属桌面端持有人,本线不代做**:上游实测在 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6317(L1 外部持有行 L7960):

```
- [ ] **④长会话滚动四维差异 —— 本波刻意未做,阻塞在"运行时自验"这一格**:四维实测在我方 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6321(L1 外部持有行 L15577):

```
- [ ] **[归并]** 【归并】重复登记副本:本行与同标题登记 L6542(枚 b0d91000e)重复,并发归档/回捞把它复制到了不同编号下(编号一律不改、不删行、正文逐字留在下方)。本行不进派单口径,活账以主行为准。 **G-299. 门 8 清账后遗留的三枚"有消费方的待实装路由"(2026-09-28 登记,现读=基线仅剩 3 处)**:① `GET /api/subagents/all` —— 消费者 `apps/web/app/(main)/agent-teams/page.tsx:58`(期望 `{dispatches}` 含 completed/failed/cancelled 全量);后端只有 `/subagents/active`(仅 pending/running,形状恰好相同但语义是子集,**不得**为省事把客户端改道 active —— 那会把"页面少了历史"写成"已修")。正解 = 在 `subagent-dispatch.ts` 补 all 列表路由(带 status/limit 透传)。②③ `PUT /api/ai/n8n/workflows/:id` 与 `POST .../toggle` —— 消费者 `apps/mobile-rn/src/screens/N8nModelScreen.tsx:146/192`(保存改名/启停今天必 404);后端 n8n 面只有列表透传与创建转发(miniapp-compat-routes.ts:1123/1190),n8n REST API 本身支持 workflows/:id 更新与 activate/deactivate,正解 = 在 n8n 代理补两枚透传(SSRF 校验与 env 缺省回 stub 的既有纪律照抄)。验收判据:两枚消费者页面真机/真会话各跑一次成功路径 + 基线 `scripts/api-routes-baseline.json` 清零 + 门 8 末行现读 0。**归属**:subagent 面 = agent-teams 线;n8n 两面 = n8n 代理持有人(本票只登记形状与消费者证据,不代裁实现位置)。 〔落地@2026-09-28/枚 2704c4d27〕三枚路由已入库:subagents/all(新→旧+status/limit)、/ai/n8n/workflows 面四枚(list stub/写 503/fetch-merge-put/toggle 回读真值);apps/api/tests/g299-new-routes.test.ts 4 例绿、门 8 死调用清零、基线 perFileCount 清表。**本票未翻勾的唯一理由=验收判据第一条未跑**:RN N8nModelScreen 真机走查(本机无设备)与 agent-teams 页真会话 200 取证(需起栈)——路由与契约已证,运行时成功路径待验,不得以单测冒充真机。
```

- 原 L6324(L1 外部持有行 L7932):

```
- [ ] **`git fsck` 恒报 166216 条 broken link/missing，而同一 sha 直查存在 —— 本机对象图状态存疑**。实测三组互斥证据(2026-09-24 04:2x-04:3x，均在 `G:\IHUI-AI` 本机): 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6326(L1 外部持有行 L7936):

```
- [ ] **`stream-tool-ledger` 接线(唯一真正剩下的技术活)——归属是他人、非本批可 finish**: 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6327(L1 外部持有行 L15660):

```
- [ ] **本波自己踩到的取证纪律（已在上一批记过，仍复发，所以再记一次）**：`cmd 2>&1 | tail -N` 之后 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6328(L1 外部持有行 L7994):

```
- [ ] **上游第二轮规格派出的票（规格在 `.ihui-agent/tmp/zcode-absorb/MECHANISM-SPEC-2.md`，gitignored）**： 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6329(L1 外部持有行 L7995):

```
- [ ] **接线由主会话单做**（本波四张票都按任务书没碰 `guardian-runner.mjs` / `package.json` / 活文档）： 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6330(L1 外部持有行 L11354):

```
- [ ] **`BROWSER_ACTIONS` 手抄清单不照 page 族那样派生(经取证否决,非疏漏)**: 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6331(L1 外部持有行 L9866):

```
- [ ] **我本轮犯过两次的"检查时机"错误（记下来防它再变成诬告）**：两张并行票的存在性检查，我在代理**尚未落盘时**就跑了，`test -f` 全 MISSING， 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6333(L1 外部持有行 L15661):

```
- [ ] **传输层单点化**:`notify-deploy-failure.ts` 扩为通用品牌告警派发器(`--to`/`--title`/`--message-file`/`--severity`/`--source`/`--plain`/`--env-file`/`--strict`/`--dry-run`,SMTP→Resend 双通道且 Resend 必带 `html`);PS 侧删除全部自拼传输代码,改为按绝对路径解析 node+tsx 调用该脚本,降级路径也只能走 `--plain`(仍不留第二份 SMTP 代码)。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6334(L1 外部持有行 L10183):

```
- [ ] P1 残余②:桌面端 `tauri_plugin_log` 注册处只给了 `.level(Info)` 而**未设 target**,日志只进 stdout 不落文件(实测本机无任何 desktop 日志文件)⇒ 这类「卡死但不退出」事后完全无法归因,本票是靠读 runtime 源码 + 现场进程取证才定性的。修法=显式加写文件的 log target,落点须走 §15b 批准的日志根,属可观测性改动另计一票。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6337(L1 外部持有行 L7985):

```
- [ ] `reclaim` 改写信封内容的边界:本批只在 CLI 侧由"重建提醒"兜回产物指针, 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6339(L1 外部持有行 L15577):

```
- [ ] **[归并]** 【归并】重复登记副本:本行与同标题登记 L6542(枚 b0d91000e)重复,并发归档/回捞把它复制到了不同编号下(编号一律不改、不删行、正文逐字留在下方)。本行不进派单口径,活账以主行为准。 **G-312. 门 8 清账后遗留的三枚"有消费方的待实装路由"(2026-09-28 登记,现读=基线仅剩 3 处)**:① `GET /api/subagents/all` —— 消费者 `apps/web/app/(main)/agent-teams/page.tsx:58`(期望 `{dispatches}` 含 completed/failed/cancelled 全量);后端只有 `/subagents/active`(仅 pending/running,形状恰好相同但语义是子集,**不得**为省事把客户端改道 active —— 那会把"页面少了历史"写成"已修")。正解 = 在 `subagent-dispatch.ts` 补 all 列表路由(带 status/limit 透传)。②③ `PUT /api/ai/n8n/workflows/:id` 与 `POST .../toggle` —— 消费者 `apps/mobile-rn/src/screens/N8nModelScreen.tsx:146/192`(保存改名/启停今天必 404);后端 n8n 面只有列表透传与创建转发(miniapp-compat-routes.ts:1123/1190),n8n REST API 本身支持 workflows/:id 更新与 activate/deactivate,正解 = 在 n8n 代理补两枚透传(SSRF 校验与 env 缺省回 stub 的既有纪律照抄)。验收判据:两枚消费者页面真机/真会话各跑一次成功路径 + 基线 `scripts/api-routes-baseline.json` 清零 + 门 8 末行现读 0。**归属**:subagent 面 = agent-teams 线;n8n 两面 = n8n 代理持有人(本票只登记形状与消费者证据,不代裁实现位置)。 〔落地@2026-09-28/枚 2704c4d27〕三枚路由已入库:subagents/all(新→旧+status/limit)、/ai/n8n/workflows 面四枚(list stub/写 503/fetch-merge-put/toggle 回读真值);apps/api/tests/g299-new-routes.test.ts 4 例绿、门 8 死调用清零、基线 perFileCount 清表。**本票未翻勾的唯一理由=验收判据第一条未跑**:RN N8nModelScreen 真机走查(本机无设备)与 agent-teams 页真会话 200 取证(需起栈)——路由与契约已证,运行时成功路径待验,不得以单测冒充真机。（编号改派留痕:本行原登记为「G-299. 门 8 清账后遗留的三枚…」,与「本机交付被远端分支保护拒收」撞成一号两事;2026-09-28 由 live-doc-edit 的取号令牌在每次 CAS 里按当下 HEAD 现算改派为 G-312,旧编号在此留原文,便于任何按旧号引用的人查得到去向,而不是让它静默消失）
```

- 原 L6340(L1 外部持有行 L15577):

```
- [ ] **[归并]** 【归并】重复登记副本:本行与同标题登记 L6542(枚 b0d91000e)重复,并发归档/回捞把它复制到了不同编号下(编号一律不改、不删行、正文逐字留在下方)。本行不进派单口径,活账以主行为准。 **G-334. 门 8 清账后遗留的三枚"有消费方的待实装路由"(2026-09-28 登记,现读=基线仅剩 3 处)**:① `GET /api/subagents/all` —— 消费者 `apps/web/app/(main)/agent-teams/page.tsx:58`(期望 `{dispatches}` 含 completed/failed/cancelled 全量);后端只有 `/subagents/active`(仅 pending/running,形状恰好相同但语义是子集,**不得**为省事把客户端改道 active —— 那会把"页面少了历史"写成"已修")。正解 = 在 `subagent-dispatch.ts` 补 all 列表路由(带 status/limit 透传)。②③ `PUT /api/ai/n8n/workflows/:id` 与 `POST .../toggle` —— 消费者 `apps/mobile-rn/src/screens/N8nModelScreen.tsx:146/192`(保存改名/启停今天必 404);后端 n8n 面只有列表透传与创建转发(miniapp-compat-routes.ts:1123/1190),n8n REST API 本身支持 workflows/:id 更新与 activate/deactivate,正解 = 在 n8n 代理补两枚透传(SSRF 校验与 env 缺省回 stub 的既有纪律照抄)。验收判据:两枚消费者页面真机/真会话各跑一次成功路径 + 基线 `scripts/api-routes-baseline.json` 清零 + 门 8 末行现读 0。**归属**:subagent 面 = agent-teams 线;n8n 两面 = n8n 代理持有人(本票只登记形状与消费者证据,不代裁实现位置)。 〔落地@2026-09-28/枚 2704c4d27〕三枚路由已入库:subagents/all(新→旧+status/limit)、/ai/n8n/workflows 面四枚(list stub/写 503/fetch-merge-put/toggle 回读真值);apps/api/tests/g299-new-routes.test.ts 4 例绿、门 8 死调用清零、基线 perFileCount 清表。**本票未翻勾的唯一理由=验收判据第一条未跑**:RN N8nModelScreen 真机走查(本机无设备)与 agent-teams 页真会话 200 取证(需起栈)——路由与契约已证,运行时成功路径待验,不得以单测冒充真机。（编号改派留痕:本行原登记为「G-299. 门 8 清账后遗留的三枚…」,与「本机交付被远端分支保护拒收」撞成一号两事;2026-09-28 由 live-doc-edit 的取号令牌在每次 CAS 里按当下 HEAD 现算改派为 G-312,旧编号在此留原文,便于任何按旧号引用的人查得到去向,而不是让它静默消失） —— 沿革:G-299→G-312→G-334(两次都被别的登记占去,每次都在行尾留原文)。**[重复登记副本]** 同一件事在 origin 侧以「G-316. 门 8 清账后遗留的三枚…」另登过一次,当前状态持有行按那条走,本行不翻勾、不并抄。
```

- 原 L6343(L1 外部持有行 L3824):

```
- [ ] 重启宿主/开机后 `%TEMP%` 才会真指 `D:\DevEnv\Temp`;在此之前任何未接 `scratch-dir` 的 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记在 L5873(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6345(L1 外部持有行 L7930):

```
- [ ] **归属:守门 116 持有者(本票不认领、不抬基线)** —— 层的"常量绑裸 git"棘轮从基线 10 涨到实测 11,红是棘轮自己报的,复现:`node --test scripts/tests/face-reader.test.mjs`(实测 26 例 ⇒ 24 绿 / 本条红 / 另一枚红是 O76 新加的第四型尺子,它扫 HEAD,随 O76 落地即绿)。第 11 个是 `scripts/check-egress-facts.mjs`(`05ffe25825a` 15:39 入库,基线是在 `66e5edaf8b7` 12:29 定到 10 的,逐个文件的"加入时间"已比对过:12:29 之后新增的裸 git 绑定只有这一枚)。**为什么我不替别人抬基线**:把 10 改成 11 等于替他人的一次回归平账,而这条尺子的存在理由正是"新增者请改用层的 `gitRaw`"。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6348(L1 外部持有行 L7931):

```
- [ ] 待用户补:apps/*/.env ~35 键(WECHAT_APP_ID/SECRET、SMTP/RESEND/腾讯 SES、DINGTALK、GitHub Token 等),骨架已就位;丢失键全清单已梳理到 `tmp/env keys todo.md`(79 空键 / api 36 + web 15 + ai-service 28,按 ★优先级 + 配置渠道 + 目标文件组织) 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6350(L1 外部持有行 L3971):

```
- [ ] **`VideoPlayerScreen` 全屏纯黑 ⇒ 黑页上方横一条 34dp 浅灰带**。这条带由 `App.tsx` 根 View 的 `backgroundColor: tokens.surface.bg` 绘制;屏幕内容在屏幕顶边被裁剪(真机量得带内 y=8..60 = (245,245,245),而把黑底用 `marginTop:-34` 上推后黑色只出现在 y=68 以下)。**即端内任何写法都够不到这条带** —— 完整取证与已回退的尝试见同日登记「实测钉死一条边界:单屏无法把底色铺进状态栏带」。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6352(L1 外部持有行 L4356):

```
- [ ]（进行中） **守卫票: `scripts/i18n-apply.mjs` 把未知参数当"无参",`--help` 会直接进写盘模式**。本轮实测代价:跑 `node scripts/i18n-apply.mjs --help` 想查用法,结果它拿一份陈旧 `i18n-translations.json` **重排并改写了 en/ja/ko/zh-TW 四份语言包**(各 176–214 行新增 / 35–39 行删除)。四个文件当时是干净的,已按 `git show HEAD:<path>` 逐字节还原 + 复验(parse OK、`git status` 空),零损失。**要求的修法**:① `--help`/`-h` 只打印用法并 exit 0;② 任何未识别参数一律 exit 2 并点名该参数,**不得降级成默认动作**;③ 写盘前若 `--check` 未跑过或输入载荷的 `translatedAt` 早于目标文件 mtime,拒绝写并提示(本次那份载荷就是旧的)。验收:`node scripts/i18n-apply.mjs --help` 必须**不产生任何 git 脏文件**(用 `git status --porcelain -- packages/i18n` 断言),并补一条镜像测试钉死这条负向判据。归属:下一轮派单;在此之前**任何人不要用该脚本试参数**。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记在 L7870(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6359(L1 外部持有行 L15857):

```
- [ ] **ai-service `.venv` 处于半损坏态**:`.venv/pyvenv.cfg` 丢失(venv 退化成全局解释器视角,`python -m pytest` 报 no module;已按 uv 0.12.4 形态重建 cfg 恢复 venv 识别),且 `uv sync` 全量对齐被 **pywin32 的 pywintypes312.dll 文件锁**打断(本地有一个 61MB 的 python 进程疑似占着 DLL,不杀并行会话可能在用的进程)。当前状态:大部分包在,`requests`/`idna` 等在 sync 中断中丢失,O17/A2A 卡片测试文件因 import 链过长暂无法在本机 pytest。**修复路径**:确认占 DLL 的进程身份并终止(或停本地 ai-service dev 实例)→ 重跑 `uv sync --no-install-package pywin32` → 跑 `tests/test_a2a_agent_card.py`(含 2026-09-24 新增 3 用例)。O20 的行为正确性已由临时验证脚本 7/7 实证(`.ihui-agent/tmp/mail-0924/verify_host_fix.py`,用后即删)。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6369(L1 外部持有行 L8004):

```
- [ ]（进行中） **守卫票：`scripts/i18n-apply.mjs` 把未知参数当"无参"，`--help` 即直接写盘**。本轮实测代价见上一行(四份语言包被陈旧载荷重排，已逐字节还原、零损失)。要求的修法：① `--help` / `-h` 只打印用法并 exit 0；② 任何未识别参数一律 **exit 2 并点名该参数**，不得降级成默认动作；③ 写盘前若输入载荷的 `translatedAt` 早于目标文件 mtime、或本轮没先跑过 `--check`，拒绝写并说明原因。验收判据：`node scripts/i18n-apply.mjs --help` 跑完后 `git status --porcelain -- packages/i18n` **必须为空**，并把这条负向判据钉成镜像测试。**守卫落地前，任何人不要用这个脚本试参数。** 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6370(L1 外部持有行 L8005):

```
- [ ]（进行中）**授权缺陷：`POST /skills/:name/unlist` 只有 checkAuth 却做硬删条目** ⇒ 任意登录用户可永久删除他人/内置市场条目；注释自称"admin 治理动作"但实现里连 admin 校都没有（注释与实现分叉）。唯一调用方是 admin 页 ⇒ 收紧不破坏正常路径。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6371(L1 外部持有行 L8006):

```
- [ ]（进行中）**P0 授权缺陷：`POST /skills/market` 可用自报 author 认领平台内置技能**（主会话逐行实测：787-789 行 `existing.ownerId=publisherId; source="user"` 的"归属补齐"，其上游闸门 773 行只比 `body.author` 字符串；内置种子 `author:'IHUI'` 源码公开且无 ownerId；该端点零 admin 校 ⇒ 任意登录用户可①认领内置技能②改写其 description/tags/version/license③触发对全体订阅者的伪"更新"通知。注释 764 行"不接受请求体自报"与实现分叉） 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6372(L1 外部持有行 L4700):

```
- [ ] **本轮未落地、需重做的一批(web 86 处内的键名对齐)**:该批次报告改了 4 个文件(`DeveloperKeyDialog` / `AiGenerationContent` / `PermissionSelector` / `helpers`),**逐条按内容复核后全部不在 HEAD**(`git grep <新键名> HEAD -- apps/web` 四处均 0 命中),工作区也已被并发会话覆盖 → 判为**丢失需重做**,不要当成已完成。中途我一度按"工作区里有"记成"已落地",那是读到了被覆盖前的窗口 —— 并行期复核一律以 **HEAD 对象树内容**为准(档案第 4 节已记此教训)。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记在 L9633(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6373(L1 外部持有行 L4700):

```
- [ ] **本轮未落地、需重做的一批(web 86 处内的键名对齐)**:该批次报告改了 4 个文件(`DeveloperKeyDialog` / `AiGenerationContent` / `PermissionSelector` / `helpers`),**逐条按内容复核后全部不在 HEAD**(`git grep <新键名> HEAD -- apps/web` 四处均 0 命中),工作区也已被并发会话覆盖 → 判为**丢失需重做**,不要当成已完成。中途我一度按"工作区里有"记成"已落地",那是读到了被覆盖前的窗口 —— 并行期复核一律以 **HEAD 对象树内容**为准(档案第 4 节已记此教训)。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6374(L1 外部持有行 L8009):

```
- [ ] **紧急(他人暂存态,非本会话所为,2026-09-24 11:0x 发现)**:**索引里有 16 条"已暂存的删除"**,一次不带 pathspec 的普通 commit 就会把这些**已入库功能从版本树删掉**。清单含三个成体系功能族 + 一道守门:① D62 语音字幕(`packages/shared/src/chat/voice-subtitles.ts` + web 组件 + 测试)、② D91 批注锚点(`annotation-anchors.ts` 同族)、③ D67 额度归属(`quota-ownership.ts` 同族)、④ **并发会话 cb99ef0c 刚提交的 `apps/mobile-rn/src/theme/color-scheme-sync.ts` 及其测试与 NativeWind mock**(删掉即把"App 主题开关驱动 NativeWind"这次修复整体回退)、⑤ `scripts/check-home-junctions.mjs` + 其镜像测试。**判为误删而非迁移的依据**:索引里的桶文件 `packages/shared/src/chat/index.ts` **与 HEAD 一字未改且仍导出这三模块**(二者矛盾 ⇒ 构建必炸,实测 Metro 就在 `export * from './voice-subtitles'` 处失败),且`git ls-files` 全仓**无替代路径**。**本会话处置边界**:只把 13 个文件(2626 行)的内容**恢复到工作区**让构建可用,**索引一字未动** —— 是否撤销这些暂存删除由制造它们的会话自己决定(§5b:他人已暂存的删除只报数、不代裁)。取证:`git diff --cached --diff-filter=D --name-only`;复跑恢复:`node .ihui-agent/tmp/rn-build/restore-worktree.mjs`。**另注**:`heal-worktree-tracked.mjs --check` 此时报"工作区已跟踪文件存续正常"—— 其判据②要求"索引 blob == HEAD blob",而暂存删除使该条件不成立,故**这类"已暂存的删除"不在存续自愈覆盖面上**,是一道无人看的路;要闭环需在守门侧对 `--diff-filter=D` 的暂存删除单独计数并阻断(未擅自新增守门,留单)。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6378(L1 外部持有行 L15663):

```
- [ ] P1 **CI 装不上而门 101 报绿：锁只记「条目在不在」，不看它落在哪个依赖段**（2026-09-26 实测，9d1aa0baa3 现读）—— pnpm install --frozen-lockfile 在 packages/api-client 直接拒装：HEAD 的清单里该包 **dependencies 为空**、@ihui/types 在 devDependencies（现读 dependencies = (无) / devDependencies = @ihui/eslint-config, @ihui/types, @tarojs/taro, typescript, rimraf, vitest），而 pnpm-lock.yaml 仍把它记在 importers["packages/api-client"].dependencies 段 ⇒ pnpm 比对「同一字段」不通过。**CI 每个 job 的第一步都是这条 install**，所以红的是 Install dependencies（实测 Knip job 的失败步名就是它，不是棘轮本身），连带 CI / CI (Monorepo) / Smoke New Modules / e2e / Build Docker / Real DB 一整套红成一片；而本地 node scripts/check-lock-manifest-consistency.mjs **exit 0**（26 包 / 514 条声明 / 违规 0）。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6379(L1 外部持有行 L7950):

```
- [ ] **本会话开门留下的格(①已闭合且不是我收的,②仍开)**:① 工作树 `PROJECT_PLAN.md` 曾有 3 行(G-206/207/209)停在**归并前的旧 `[ ]` 形态**而 HEAD 已翻勾 —— 正确出口是 `node scripts/heal-worktree-tracked.mjs --align-drift`(判据:索引==HEAD ∧ 工作树==该路径某祖先 ⇒ 才动,可证零独有数据),**不是**手工把整文件按工作树提交(那等于替别人回退归并)。本票落地前复量:`--align-drift` 报「无需对齐(可判定 0 个)」而 `git show HEAD:PROJECT_PLAN.md` 与工作树副本 **md5 同值**(`fe60b0e32b6b3e64e54fa811f87cfba8`)⇒ 对齐已由并发会话/守护一侧完成,不记在自己账上;**这一格的读数必须在提交前一刻重取**,因为它是移动靶。② 门 101 的 **section 级对账**仍未做(上面已开票)。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6380(L1 外部持有行 L7951):

```
- [ ] **`check:plan-task-state` 在 CI 上红,是别人的新维度带着非零存量上线(归 F6 持有人,本会话不代裁)**:`node scripts/plan-tasks.mjs --gate --strict` 在 HEAD 面 exit 1,而 F1/F2/F3 全 0、F4 只报数 —— 红在**新加的 F6(整块登记重复,块级量纲)**:基线 0 而现读 **8 块 / 共 16 份**(另有 10 块"首行相同而正文漂移",工具自己写明"必须人工判哪份作数")。行级四条(F1–F4)对"整块被追加两遍"结构上失明,所以 F6 的立维方向是对的;**错在带存量上线**:这一型与任何提交都无关,谁提交都红 ⇒ 唯一结局是各会话 `--no-verify` 连带约 160 道门作废(§12e,本仓记过不下五次)。两条出路按工具自己的提示:要么人工收掉那 8 块逐字相同的整块重复(它写明"逐字相同才可自动收口",但**没有**自动收口出口,须手写),要么由持有人跑 `--update-baseline` 把 8 钉成棘轮上限 —— 后者会把"不再变多"这一维保住,把"存量归零"留给后人。**归属 F6 持有人,本会话不动别人的判据**。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6381(L1 外部持有行 L8014):

```
- [ ] **本批否证与不作为登记**：`monitoring/alertbridge/alert-webhook-bridge.cjs` 在 HEAD 面上有 **7 处 `no-unused-vars`（`catch (e)` 未用）**，实测与本批改动无关（HEAD 副本同一把 lint 同为 7）⇒ 按"只做被点名工作流"未顺手改；跨行的凭据（关键词与值分居两行）bridge 结构上不命中，已写进文件注释而非只写进报告。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6382(L1 外部持有行 L10223):

```
- [ ]（登记，非本线）relay admin 4 个删除端点零测试覆盖、`o13-bg-rls-live.test.ts` 需要自己的串行通道 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6385(L1 外部持有行 L3824):

```
- [ ] 重启宿主/开机后 `%TEMP%` 才会真指 `D:\DevEnv\Temp`;在此之前任何未接 `scratch-dir` 的 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记在 L13316(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6386(L1 外部持有行 L4709):

```
- [ ]（进行中）**守门 91 冻结的 9 处待清 + 一项方法论债(2026-09-24)**:① study-publish 整文件主题化(14 处 `getTokens('light')`,8 处在模块级 StyleSheet.create 里,须改成按 scheme 生成的函数或下沉到组件内), 改完后 `node scripts/check-theme-prop-wiring.mjs --update-baseline` 应收窄; ② 7 个他人 M 在制的屏(CourseDetail / Distribution / LiveDetail / ModelPlaza / N8nModel / PostCreate / SharedDemo)待其会话自行接线; ③ `{...props}` 展开类站点被判 spread-unknown(判不出即如实报,不静默放行)—— 要真正覆盖须先给端内 wrapper 的 props 建立类型事实,属独立改造; ④ 方法论债:**本轮两次误判同源** —— 一次是把像素被 `rgba(0,0,0,0.6)` 遮罩压暗 40% 当成"颜色没落上", 一次是用"文本里有没有某个键"统计出"0 处漏传"。两者的共同错误是**用一个不测量目标东西的探针给出肯定结论**。 纪律:凡给出"0 处 / 没有 / 已全清"这类否定性结论,必须先构造一个**已知应被命中的正例**喂给同一判据(阳性对照), 否则该结论不得写进文档或据此决定"不做"。 〔PROGRESS 2026-09-25: ① study-publish 共享屏 15 处 getTokens(light) 由 commit 5ce93b9e1 清零(守门91/83 全绿);②③④ 仍开放〕 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记在 L13318(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6387(L1 外部持有行 L7989):

```
- [ ]（进行中）**合流会静默吞掉「已真机验证」的代码修复,而守门 76/71 对此零覆盖(2026-09-24 实测)**: 本会话 84583fdf6 把 PlazaScreen.tsx:464 / RankingDetailScreen.tsx:171 的 colorScheme 字面量改为 resolvedTheme,**并在 v0.0.5/code8 真机复测通过**(广场页正文由 #f5f5f5/#ebebeb 变 #242424/#1a1a1a,与 NavBar/TabBar 同档)。随后几轮 git-sync-converge 之后,HEAD 里那两处**又变回了写死 "light"** —— 并发会话有一条基于 b1a162c4e7(同文件改造)的独立提交线,经 merge-tree 合流时结果取了对方侧;该合并在 git log -- <path> 的历史简化里被隐去(84583fdf6 根本不出现),所以「我的提交还在 ancestry-path 上」完全不能证明「我的改动还在文件里」。 为什么无人拦:守门 76(stale-revert)与 71(plan-line-loss)都只在 commit 时按**暂存内容**判定,而 converge 走 merge-tree + commit-tree + update-ref,**不跑任何钩子** —— 合流层是这两道门的共同盲区。本会话同一机制差点也吞掉测试桩修复,逐字符串核对后判为误报(命中的是我自己写的解释性注释,非真实 vi.mock 调用),说明受害面是全部经合流的代码改动,不止文档。 本轮处置:已用 cc63b5bd0a 前向重落,并在提交前逐行核对「工作区 vs 当前 HEAD 差量恰好只有这 5 行」(2 处字面量替换 + 1 行 import + 1 行 useTheme 钩子),对方对这两个文件的其余改动零触碰。 建议补法(未擅自实现,属他人守门):converge 成功出口处,对本次推送范围内每个文件跑一次「本会话已提交过的 blob 是否仍被 HEAD 版本包含」断言 —— 即把守门 71 对登记行做的事,对代码行做一次;或更廉价:合流后重跑一次本会话关键判据的 grep 断言。在补上之前,任何「真机验证过」的代码修复,收尾时必须用 git show HEAD:<file> 再核一次,不得以「commit 在 ancestry 上」代替。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记在 L13319(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6388(L1 外部持有行 L7990):

```
- [ ] **仍在这台机器上、不由我裁的**:C 盘剩余 5 项未识别条目(优酷 1.3G / ClipFlow / 输入法字典 / 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记在 L13320(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6389(L1 外部持有行 L15446):

```
- [ ]（进行中）RN 分类栏统一收口(承 2026-09-23 04:19 会话被取消的迁移,用户原话"所有的菜单栏分类栏没有设计好 统一 好看的符合项目统一的样式 点击后下拉窗的形式呈现 左右滑动"):地基 `packages/app/src/components/category/{CategoryInlineBar,CategoryDropdown}` 补包根导出(`@ihui/rn-app` 可直接 import,此前只到 `components/index.ts` 端内取不到)+ Dropdown 面板改 `ScrollView`(修"选项多于 8 条被 maxHeight+overflow:hidden 静默裁切")+ 圆角一律 `rnRadius` 档(对齐同日新立 §4 圆角单一源头)。**迁移面 16 处**:共享层 9 屏(square/plaza/order/team/ranking/recruitment/token-value/study-index/study-publish,其中 study-publish 的 API 动态赛道 = CategoryDropdown 装车点)+ 端内 7 屏(ProfileScreen / TokenValueScreen / TopicListScreen / StudyIndexScreen / MaterialList / AgentScreen 赛道弹层双行并删违规 `trackDivider` hairline 分割线 / FenLeiOverlay 赛道行+分类网格双条)。孤儿裁定:`StudyBar`、`SingleTypeBar` 已零调用点(删除需同步下调 `scripts/radius-single-source-baseline.json` 的 2 条基线,本轮未做)。**真机取证(v0.0.4 / code 5 release 包,Hermes 字节码 bundle grep 命中 `CategoryInlineBar` / `agent-track-bar` / `ctaFill`)**:① 点顶栏「分类」弹出的那块当时仍是迁移清单外的 `FenLeiOverlay`(已补迁);② 像素直方图实测选中 chip 前景 = 深色 `ctaText` #16262E 而底色仍是容器同色 #1A1A1A —— `ctaFill` 根本没落上,即"选中态看不见";③ idle chip 以 `surface.card` 作底,落在同为 `surface.card` 的弹层面板上完全隐形。已修:idle 底改 `surface.muted` + 描边 `border.medium`(两套主题下与页面 bg / 面板 card 均不同档)。**根因未定**:曾按"Pressable 函数式 style 整条路径未生效"归因并把容器视觉移到普通 View 数组路径(该改动本身无害,少一个变量),但随即被反证 —— 全仓 58 个文件用同款 `style={({pressed}) => [base, active ? activeStyle : null]}`,其中 `SingleTypeBar.tsx:142-143` 与迁移前的 SquareScreen 内联条都是这条路径且真机显示正常;`ctaText`(#16262E)在同一 chip 上生效而 `ctaFill`(#a3c4d6)不生效,也排除了"整套 token 缺失"(dist 陈旧版两者皆无,若走 dist 文字应回落到 #A3A3A3)。待手机回线后先加高对比标记色(如临时 `#FF00FF`)做二分,再定是样式合并路径还是取色问题。待复验(设备 19:5x 起 `adb devices` 为空,kill-server 重连无效,USB 侧仍见 3 个 Composite Device)。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记在 L13321(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6390(L1 外部持有行 L4356):

```
- [ ]（进行中） **守卫票: `scripts/i18n-apply.mjs` 把未知参数当"无参",`--help` 会直接进写盘模式**。本轮实测代价:跑 `node scripts/i18n-apply.mjs --help` 想查用法,结果它拿一份陈旧 `i18n-translations.json` **重排并改写了 en/ja/ko/zh-TW 四份语言包**(各 176–214 行新增 / 35–39 行删除)。四个文件当时是干净的,已按 `git show HEAD:<path>` 逐字节还原 + 复验(parse OK、`git status` 空),零损失。**要求的修法**:① `--help`/`-h` 只打印用法并 exit 0;② 任何未识别参数一律 exit 2 并点名该参数,**不得降级成默认动作**;③ 写盘前若 `--check` 未跑过或输入载荷的 `translatedAt` 早于目标文件 mtime,拒绝写并提示(本次那份载荷就是旧的)。验收:`node scripts/i18n-apply.mjs --help` 必须**不产生任何 git 脏文件**(用 `git status --porcelain -- packages/i18n` 断言),并补一条镜像测试钉死这条负向判据。归属:下一轮派单;在此之前**任何人不要用该脚本试参数**。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记在 L13322(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6392(L1 外部持有行 L15652):

```
- [ ] **C 组刻意没动,待用户定性**:`C:\ai_zhs\cert\*.pem`(5 个,每个仅 10–20 字节,不可能是真 PEM, 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记在 L13325(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6393(L1 外部持有行 L4709):

```
- [ ]（进行中）**守门 91 冻结的 9 处待清 + 一项方法论债(2026-09-24)**:① study-publish 整文件主题化(14 处 `getTokens('light')`,8 处在模块级 StyleSheet.create 里,须改成按 scheme 生成的函数或下沉到组件内), 改完后 `node scripts/check-theme-prop-wiring.mjs --update-baseline` 应收窄; ② 7 个他人 M 在制的屏(CourseDetail / Distribution / LiveDetail / ModelPlaza / N8nModel / PostCreate / SharedDemo)待其会话自行接线; ③ `{...props}` 展开类站点被判 spread-unknown(判不出即如实报,不静默放行)—— 要真正覆盖须先给端内 wrapper 的 props 建立类型事实,属独立改造; ④ 方法论债:**本轮两次误判同源** —— 一次是把像素被 `rgba(0,0,0,0.6)` 遮罩压暗 40% 当成"颜色没落上", 一次是用"文本里有没有某个键"统计出"0 处漏传"。两者的共同错误是**用一个不测量目标东西的探针给出肯定结论**。 纪律:凡给出"0 处 / 没有 / 已全清"这类否定性结论,必须先构造一个**已知应被命中的正例**喂给同一判据(阳性对照), 否则该结论不得写进文档或据此决定"不做"。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记在 L13328(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6394(L1 外部持有行 L4700):

```
- [ ] **本轮未落地、需重做的一批(web 86 处内的键名对齐)**:该批次报告改了 4 个文件(`DeveloperKeyDialog` / `AiGenerationContent` / `PermissionSelector` / `helpers`),**逐条按内容复核后全部不在 HEAD**(`git grep <新键名> HEAD -- apps/web` 四处均 0 命中),工作区也已被并发会话覆盖 → 判为**丢失需重做**,不要当成已完成。中途我一度按"工作区里有"记成"已落地",那是读到了被覆盖前的窗口 —— 并行期复核一律以 **HEAD 对象树内容**为准(档案第 4 节已记此教训)。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记在 L13329(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6395(L1 外部持有行 L8009):

```
- [ ] **紧急(他人暂存态,非本会话所为,2026-09-24 11:0x 发现)**:**索引里有 16 条"已暂存的删除"**,一次不带 pathspec 的普通 commit 就会把这些**已入库功能从版本树删掉**。清单含三个成体系功能族 + 一道守门:① D62 语音字幕(`packages/shared/src/chat/voice-subtitles.ts` + web 组件 + 测试)、② D91 批注锚点(`annotation-anchors.ts` 同族)、③ D67 额度归属(`quota-ownership.ts` 同族)、④ **并发会话 cb99ef0c 刚提交的 `apps/mobile-rn/src/theme/color-scheme-sync.ts` 及其测试与 NativeWind mock**(删掉即把"App 主题开关驱动 NativeWind"这次修复整体回退)、⑤ `scripts/check-home-junctions.mjs` + 其镜像测试。**判为误删而非迁移的依据**:索引里的桶文件 `packages/shared/src/chat/index.ts` **与 HEAD 一字未改且仍导出这三模块**(二者矛盾 ⇒ 构建必炸,实测 Metro 就在 `export * from './voice-subtitles'` 处失败),且`git ls-files` 全仓**无替代路径**。**本会话处置边界**:只把 13 个文件(2626 行)的内容**恢复到工作区**让构建可用,**索引一字未动** —— 是否撤销这些暂存删除由制造它们的会话自己决定(§5b:他人已暂存的删除只报数、不代裁)。取证:`git diff --cached --diff-filter=D --name-only`;复跑恢复:`node .ihui-agent/tmp/rn-build/restore-worktree.mjs`。**另注**:`heal-worktree-tracked.mjs --check` 此时报"工作区已跟踪文件存续正常"—— 其判据②要求"索引 blob == HEAD blob",而暂存删除使该条件不成立,故**这类"已暂存的删除"不在存续自愈覆盖面上**,是一道无人看的路;要闭环需在守门侧对 `--diff-filter=D` 的暂存删除单独计数并阻断(未擅自新增守门,留单)。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记在 L13330(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6496(L1 外部持有行 L3824):

```
- [ ] 重启宿主/开机后 `%TEMP%` 才会真指 `D:\DevEnv\Temp`;在此之前任何未接 `scratch-dir` 的 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记在 L5733(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6501(L1 外部持有行 L4709):

```
- [ ]（进行中）**守门 91 冻结的 9 处待清 + 一项方法论债(2026-09-24)**:① study-publish 整文件主题化(14 处 `getTokens('light')`,8 处在模块级 StyleSheet.create 里,须改成按 scheme 生成的函数或下沉到组件内), 改完后 `node scripts/check-theme-prop-wiring.mjs --update-baseline` 应收窄; ② 7 个他人 M 在制的屏(CourseDetail / Distribution / LiveDetail / ModelPlaza / N8nModel / PostCreate / SharedDemo)待其会话自行接线; ③ `{...props}` 展开类站点被判 spread-unknown(判不出即如实报,不静默放行)—— 要真正覆盖须先给端内 wrapper 的 props 建立类型事实,属独立改造; ④ 方法论债:**本轮两次误判同源** —— 一次是把像素被 `rgba(0,0,0,0.6)` 遮罩压暗 40% 当成"颜色没落上", 一次是用"文本里有没有某个键"统计出"0 处漏传"。两者的共同错误是**用一个不测量目标东西的探针给出肯定结论**。 纪律:凡给出"0 处 / 没有 / 已全清"这类否定性结论,必须先构造一个**已知应被命中的正例**喂给同一判据(阳性对照), 否则该结论不得写进文档或据此决定"不做"。 〔PROGRESS 2026-09-25: ① study-publish 共享屏 15 处 getTokens(light) 由 commit 5ce93b9e1 清零(守门91/83 全绿);②③④ 仍开放〕 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记在 L6251(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6502(L1 外部持有行 L7989):

```
- [ ]（进行中）**合流会静默吞掉「已真机验证」的代码修复,而守门 76/71 对此零覆盖(2026-09-24 实测)**: 本会话 84583fdf6 把 PlazaScreen.tsx:464 / RankingDetailScreen.tsx:171 的 colorScheme 字面量改为 resolvedTheme,**并在 v0.0.5/code8 真机复测通过**(广场页正文由 #f5f5f5/#ebebeb 变 #242424/#1a1a1a,与 NavBar/TabBar 同档)。随后几轮 git-sync-converge 之后,HEAD 里那两处**又变回了写死 "light"** —— 并发会话有一条基于 b1a162c4e7(同文件改造)的独立提交线,经 merge-tree 合流时结果取了对方侧;该合并在 git log -- <path> 的历史简化里被隐去(84583fdf6 根本不出现),所以「我的提交还在 ancestry-path 上」完全不能证明「我的改动还在文件里」。 为什么无人拦:守门 76(stale-revert)与 71(plan-line-loss)都只在 commit 时按**暂存内容**判定,而 converge 走 merge-tree + commit-tree + update-ref,**不跑任何钩子** —— 合流层是这两道门的共同盲区。本会话同一机制差点也吞掉测试桩修复,逐字符串核对后判为误报(命中的是我自己写的解释性注释,非真实 vi.mock 调用),说明受害面是全部经合流的代码改动,不止文档。 本轮处置:已用 cc63b5bd0a 前向重落,并在提交前逐行核对「工作区 vs 当前 HEAD 差量恰好只有这 5 行」(2 处字面量替换 + 1 行 import + 1 行 useTheme 钩子),对方对这两个文件的其余改动零触碰。 建议补法(未擅自实现,属他人守门):converge 成功出口处,对本次推送范围内每个文件跑一次「本会话已提交过的 blob 是否仍被 HEAD 版本包含」断言 —— 即把守门 71 对登记行做的事,对代码行做一次;或更廉价:合流后重跑一次本会话关键判据的 grep 断言。在补上之前,任何「真机验证过」的代码修复,收尾时必须用 git show HEAD:<file> 再核一次,不得以「commit 在 ancestry 上」代替。 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记在 L6252(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6503(L1 外部持有行 L7990):

```
- [ ] **仍在这台机器上、不由我裁的**:C 盘剩余 5 项未识别条目(优酷 1.3G / ClipFlow / 输入法字典 / 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记在 L6526(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6504(L1 外部持有行 L15446):

```
- [ ]（进行中）RN 分类栏统一收口(承 2026-09-23 04:19 会话被取消的迁移,用户原话"所有的菜单栏分类栏没有设计好 统一 好看的符合项目统一的样式 点击后下拉窗的形式呈现 左右滑动"):地基 `packages/app/src/components/category/{CategoryInlineBar,CategoryDropdown}` 补包根导出(`@ihui/rn-app` 可直接 import,此前只到 `components/index.ts` 端内取不到)+ Dropdown 面板改 `ScrollView`(修"选项多于 8 条被 maxHeight+overflow:hidden 静默裁切")+ 圆角一律 `rnRadius` 档(对齐同日新立 §4 圆角单一源头)。**迁移面 16 处**:共享层 9 屏(square/plaza/order/team/ranking/recruitment/token-value/study-index/study-publish,其中 study-publish 的 API 动态赛道 = CategoryDropdown 装车点)+ 端内 7 屏(ProfileScreen / TokenValueScreen / TopicListScreen / StudyIndexScreen / MaterialList / AgentScreen 赛道弹层双行并删违规 `trackDivider` hairline 分割线 / FenLeiOverlay 赛道行+分类网格双条)。孤儿裁定:`StudyBar`、`SingleTypeBar` 已零调用点(删除需同步下调 `scripts/radius-single-source-baseline.json` 的 2 条基线,本轮未做)。**真机取证(v0.0.4 / code 5 release 包,Hermes 字节码 bundle grep 命中 `CategoryInlineBar` / `agent-track-bar` / `ctaFill`)**:① 点顶栏「分类」弹出的那块当时仍是迁移清单外的 `FenLeiOverlay`(已补迁);② 像素直方图实测选中 chip 前景 = 深色 `ctaText` #16262E 而底色仍是容器同色 #1A1A1A —— `ctaFill` 根本没落上,即"选中态看不见";③ idle chip 以 `surface.card` 作底,落在同为 `surface.card` 的弹层面板上完全隐形。已修:idle 底改 `surface.muted` + 描边 `border.medium`(两套主题下与页面 bg / 面板 card 均不同档)。**根因未定**:曾按"Pressable 函数式 style 整条路径未生效"归因并把容器视觉移到普通 View 数组路径(该改动本身无害,少一个变量),但随即被反证 —— 全仓 58 个文件用同款 `style={({pressed}) => [base, active ? activeStyle : null]}`,其中 `SingleTypeBar.tsx:142-143` 与迁移前的 SquareScreen 内联条都是这条路径且真机显示正常;`ctaText`(#16262E)在同一 chip 上生效而 `ctaFill`(#a3c4d6)不生效,也排除了"整套 token 缺失"(dist 陈旧版两者皆无,若走 dist 文字应回落到 #A3A3A3)。待手机回线后先加高对比标记色(如临时 `#FF00FF`)做二分,再定是样式合并路径还是取色问题。待复验(设备 19:5x 起 `adb devices` 为空,kill-server 重连无效,USB 侧仍见 3 个 Composite Device)。 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记在 L6976(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6505(L1 外部持有行 L4356):

```
- [ ]（进行中） **守卫票: `scripts/i18n-apply.mjs` 把未知参数当"无参",`--help` 会直接进写盘模式**。本轮实测代价:跑 `node scripts/i18n-apply.mjs --help` 想查用法,结果它拿一份陈旧 `i18n-translations.json` **重排并改写了 en/ja/ko/zh-TW 四份语言包**(各 176–214 行新增 / 35–39 行删除)。四个文件当时是干净的,已按 `git show HEAD:<path>` 逐字节还原 + 复验(parse OK、`git status` 空),零损失。**要求的修法**:① `--help`/`-h` 只打印用法并 exit 0;② 任何未识别参数一律 exit 2 并点名该参数,**不得降级成默认动作**;③ 写盘前若 `--check` 未跑过或输入载荷的 `translatedAt` 早于目标文件 mtime,拒绝写并提示(本次那份载荷就是旧的)。验收:`node scripts/i18n-apply.mjs --help` 必须**不产生任何 git 脏文件**(用 `git status --porcelain -- packages/i18n` 断言),并补一条镜像测试钉死这条负向判据。归属:下一轮派单;在此之前**任何人不要用该脚本试参数**。 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记在 L7730(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6508(L1 外部持有行 L15652):

```
- [ ] **C 组刻意没动,待用户定性**:`C:\ai_zhs\cert\*.pem`(5 个,每个仅 10–20 字节,不可能是真 PEM, 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记在 L9334(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6509(L1 外部持有行 L4700):

```
- [ ]（进行中） **本轮未落地、需重做的一批(web 86 处内的键名对齐)**:该批次报告改了 4 个文件(`DeveloperKeyDialog` / `AiGenerationContent` / `PermissionSelector` / `helpers`),**逐条按内容复核后全部不在 HEAD**(`git grep <新键名> HEAD -- apps/web` 四处均 0 命中),工作区也已被并发会话覆盖 → 判为**丢失需重做**,不要当成已完成。中途我一度按"工作区里有"记成"已落地",那是读到了被覆盖前的窗口 —— 并行期复核一律以 **HEAD 对象树内容**为准(档案第 4 节已记此教训)。 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记 (与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6510(L1 外部持有行 L4709):

```
- [ ]（进行中）**守门 91 冻结的 9 处待清 + 一项方法论债(2026-09-24)**:① study-publish 整文件主题化(14 处 `getTokens('light')`,8 处在模块级 StyleSheet.create 里,须改成按 scheme 生成的函数或下沉到组件内), 改完后 `node scripts/check-theme-prop-wiring.mjs --update-baseline` 应收窄; ② 7 个他人 M 在制的屏(CourseDetail / Distribution / LiveDetail / ModelPlaza / N8nModel / PostCreate / SharedDemo)待其会话自行接线; ③ `{...props}` 展开类站点被判 spread-unknown(判不出即如实报,不静默放行)—— 要真正覆盖须先给端内 wrapper 的 props 建立类型事实,属独立改造; ④ 方法论债:**本轮两次误判同源** —— 一次是把像素被 `rgba(0,0,0,0.6)` 遮罩压暗 40% 当成"颜色没落上", 一次是用"文本里有没有某个键"统计出"0 处漏传"。两者的共同错误是**用一个不测量目标东西的探针给出肯定结论**。 纪律:凡给出"0 处 / 没有 / 已全清"这类否定性结论,必须先构造一个**已知应被命中的正例**喂给同一判据(阳性对照), 否则该结论不得写进文档或据此决定"不做"。 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记在 L9490(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6511(L1 外部持有行 L4700):

```
- [ ] **本轮未落地、需重做的一批(web 86 处内的键名对齐)**:该批次报告改了 4 个文件(`DeveloperKeyDialog` / `AiGenerationContent` / `PermissionSelector` / `helpers`),**逐条按内容复核后全部不在 HEAD**(`git grep <新键名> HEAD -- apps/web` 四处均 0 命中),工作区也已被并发会话覆盖 → 判为**丢失需重做**,不要当成已完成。中途我一度按"工作区里有"记成"已落地",那是读到了被覆盖前的窗口 —— 并行期复核一律以 **HEAD 对象树内容**为准(档案第 4 节已记此教训)。 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记在 L9493(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6512(L1 外部持有行 L8009):

```
- [ ] **紧急(他人暂存态,非本会话所为,2026-09-24 11:0x 发现)**:**索引里有 16 条"已暂存的删除"**,一次不带 pathspec 的普通 commit 就会把这些**已入库功能从版本树删掉**。清单含三个成体系功能族 + 一道守门:① D62 语音字幕(`packages/shared/src/chat/voice-subtitles.ts` + web 组件 + 测试)、② D91 批注锚点(`annotation-anchors.ts` 同族)、③ D67 额度归属(`quota-ownership.ts` 同族)、④ **并发会话 cb99ef0c 刚提交的 `apps/mobile-rn/src/theme/color-scheme-sync.ts` 及其测试与 NativeWind mock**(删掉即把"App 主题开关驱动 NativeWind"这次修复整体回退)、⑤ `scripts/check-home-junctions.mjs` + 其镜像测试。**判为误删而非迁移的依据**:索引里的桶文件 `packages/shared/src/chat/index.ts` **与 HEAD 一字未改且仍导出这三模块**(二者矛盾 ⇒ 构建必炸,实测 Metro 就在 `export * from './voice-subtitles'` 处失败),且`git ls-files` 全仓**无替代路径**。**本会话处置边界**:只把 13 个文件(2626 行)的内容**恢复到工作区**让构建可用,**索引一字未动** —— 是否撤销这些暂存删除由制造它们的会话自己决定(§5b:他人已暂存的删除只报数、不代裁)。取证:`git diff --cached --diff-filter=D --name-only`;复跑恢复:`node .ihui-agent/tmp/rn-build/restore-worktree.mjs`。**另注**:`heal-worktree-tracked.mjs --check` 此时报"工作区已跟踪文件存续正常"—— 其判据②要求"索引 blob == HEAD blob",而暂存删除使该条件不成立,故**这类"已暂存的删除"不在存续自愈覆盖面上**,是一道无人看的路;要闭环需在守门侧对 `--diff-filter=D` 的暂存删除单独计数并阻断(未擅自新增守门,留单)。 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记在 L9539(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6516(L1 外部持有行 L3824):

```
- [ ] 重启宿主/开机后 `%TEMP%` 才会真指 `D:\DevEnv\Temp`;在此之前任何未接 `scratch-dir` 的 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记在 L5914(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6525(L1 外部持有行 L4709):

```
- [ ]（进行中）**守门 91 冻结的 9 处待清 + 一项方法论债(2026-09-24)**:① study-publish 整文件主题化(14 处 `getTokens('light')`,8 处在模块级 StyleSheet.create 里,须改成按 scheme 生成的函数或下沉到组件内), 改完后 `node scripts/check-theme-prop-wiring.mjs --update-baseline` 应收窄; ② 7 个他人 M 在制的屏(CourseDetail / Distribution / LiveDetail / ModelPlaza / N8nModel / PostCreate / SharedDemo)待其会话自行接线; ③ `{...props}` 展开类站点被判 spread-unknown(判不出即如实报,不静默放行)—— 要真正覆盖须先给端内 wrapper 的 props 建立类型事实,属独立改造; ④ 方法论债:**本轮两次误判同源** —— 一次是把像素被 `rgba(0,0,0,0.6)` 遮罩压暗 40% 当成"颜色没落上", 一次是用"文本里有没有某个键"统计出"0 处漏传"。两者的共同错误是**用一个不测量目标东西的探针给出肯定结论**。 纪律:凡给出"0 处 / 没有 / 已全清"这类否定性结论,必须先构造一个**已知应被命中的正例**喂给同一判据(阳性对照), 否则该结论不得写进文档或据此决定"不做"。 〔PROGRESS 2026-09-25: ① study-publish 共享屏 15 处 getTokens(light) 由 commit 5ce93b9e1 清零(守门91/83 全绿);②③④ 仍开放〕 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记在 L6435(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6526(L1 外部持有行 L7989):

```
- [ ]（进行中）**合流会静默吞掉「已真机验证」的代码修复,而守门 76/71 对此零覆盖(2026-09-24 实测)**: 本会话 84583fdf6 把 PlazaScreen.tsx:464 / RankingDetailScreen.tsx:171 的 colorScheme 字面量改为 resolvedTheme,**并在 v0.0.5/code8 真机复测通过**(广场页正文由 #f5f5f5/#ebebeb 变 #242424/#1a1a1a,与 NavBar/TabBar 同档)。随后几轮 git-sync-converge 之后,HEAD 里那两处**又变回了写死 "light"** —— 并发会话有一条基于 b1a162c4e7(同文件改造)的独立提交线,经 merge-tree 合流时结果取了对方侧;该合并在 git log -- <path> 的历史简化里被隐去(84583fdf6 根本不出现),所以「我的提交还在 ancestry-path 上」完全不能证明「我的改动还在文件里」。 为什么无人拦:守门 76(stale-revert)与 71(plan-line-loss)都只在 commit 时按**暂存内容**判定,而 converge 走 merge-tree + commit-tree + update-ref,**不跑任何钩子** —— 合流层是这两道门的共同盲区。本会话同一机制差点也吞掉测试桩修复,逐字符串核对后判为误报(命中的是我自己写的解释性注释,非真实 vi.mock 调用),说明受害面是全部经合流的代码改动,不止文档。 本轮处置:已用 cc63b5bd0a 前向重落,并在提交前逐行核对「工作区 vs 当前 HEAD 差量恰好只有这 5 行」(2 处字面量替换 + 1 行 import + 1 行 useTheme 钩子),对方对这两个文件的其余改动零触碰。 建议补法(未擅自实现,属他人守门):converge 成功出口处,对本次推送范围内每个文件跑一次「本会话已提交过的 blob 是否仍被 HEAD 版本包含」断言 —— 即把守门 71 对登记行做的事,对代码行做一次;或更廉价:合流后重跑一次本会话关键判据的 grep 断言。在补上之前,任何「真机验证过」的代码修复,收尾时必须用 git show HEAD:<file> 再核一次,不得以「commit 在 ancestry 上」代替。 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记在 L6436(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6527(L1 外部持有行 L7990):

```
- [ ] **仍在这台机器上、不由我裁的**:C 盘剩余 5 项未识别条目(优酷 1.3G / ClipFlow / 输入法字典 / 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记在 L6205(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6528(L1 外部持有行 L15446):

```
- [ ]（进行中）RN 分类栏统一收口(承 2026-09-23 04:19 会话被取消的迁移,用户原话"所有的菜单栏分类栏没有设计好 统一 好看的符合项目统一的样式 点击后下拉窗的形式呈现 左右滑动"):地基 `packages/app/src/components/category/{CategoryInlineBar,CategoryDropdown}` 补包根导出(`@ihui/rn-app` 可直接 import,此前只到 `components/index.ts` 端内取不到)+ Dropdown 面板改 `ScrollView`(修"选项多于 8 条被 maxHeight+overflow:hidden 静默裁切")+ 圆角一律 `rnRadius` 档(对齐同日新立 §4 圆角单一源头)。**迁移面 16 处**:共享层 9 屏(square/plaza/order/team/ranking/recruitment/token-value/study-index/study-publish,其中 study-publish 的 API 动态赛道 = CategoryDropdown 装车点)+ 端内 7 屏(ProfileScreen / TokenValueScreen / TopicListScreen / StudyIndexScreen / MaterialList / AgentScreen 赛道弹层双行并删违规 `trackDivider` hairline 分割线 / FenLeiOverlay 赛道行+分类网格双条)。孤儿裁定:`StudyBar`、`SingleTypeBar` 已零调用点(删除需同步下调 `scripts/radius-single-source-baseline.json` 的 2 条基线,本轮未做)。**真机取证(v0.0.4 / code 5 release 包,Hermes 字节码 bundle grep 命中 `CategoryInlineBar` / `agent-track-bar` / `ctaFill`)**:① 点顶栏「分类」弹出的那块当时仍是迁移清单外的 `FenLeiOverlay`(已补迁);② 像素直方图实测选中 chip 前景 = 深色 `ctaText` #16262E 而底色仍是容器同色 #1A1A1A —— `ctaFill` 根本没落上,即"选中态看不见";③ idle chip 以 `surface.card` 作底,落在同为 `surface.card` 的弹层面板上完全隐形。已修:idle 底改 `surface.muted` + 描边 `border.medium`(两套主题下与页面 bg / 面板 card 均不同档)。**根因未定**:曾按"Pressable 函数式 style 整条路径未生效"归因并把容器视觉移到普通 View 数组路径(该改动本身无害,少一个变量),但随即被反证 —— 全仓 58 个文件用同款 `style={({pressed}) => [base, active ? activeStyle : null]}`,其中 `SingleTypeBar.tsx:142-143` 与迁移前的 SquareScreen 内联条都是这条路径且真机显示正常;`ctaText`(#16262E)在同一 chip 上生效而 `ctaFill`(#a3c4d6)不生效,也排除了"整套 token 缺失"(dist 陈旧版两者皆无,若走 dist 文字应回落到 #A3A3A3)。待手机回线后先加高对比标记色(如临时 `#FF00FF`)做二分,再定是样式合并路径还是取色问题。待复验(设备 19:5x 起 `adb devices` 为空,kill-server 重连无效,USB 侧仍见 3 个 Composite Device)。 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记在 L7159(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6529(L1 外部持有行 L4356):

```
- [ ]（进行中） **守卫票: `scripts/i18n-apply.mjs` 把未知参数当"无参",`--help` 会直接进写盘模式**。本轮实测代价:跑 `node scripts/i18n-apply.mjs --help` 想查用法,结果它拿一份陈旧 `i18n-translations.json` **重排并改写了 en/ja/ko/zh-TW 四份语言包**(各 176–214 行新增 / 35–39 行删除)。四个文件当时是干净的,已按 `git show HEAD:<path>` 逐字节还原 + 复验(parse OK、`git status` 空),零损失。**要求的修法**:① `--help`/`-h` 只打印用法并 exit 0;② 任何未识别参数一律 exit 2 并点名该参数,**不得降级成默认动作**;③ 写盘前若 `--check` 未跑过或输入载荷的 `translatedAt` 早于目标文件 mtime,拒绝写并提示(本次那份载荷就是旧的)。验收:`node scripts/i18n-apply.mjs --help` 必须**不产生任何 git 脏文件**(用 `git status --porcelain -- packages/i18n` 断言),并补一条镜像测试钉死这条负向判据。归属:下一轮派单;在此之前**任何人不要用该脚本试参数**。 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记在 L7914(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6531(L1 外部持有行 L15652):

```
- [ ] **C 组刻意没动,待用户定性**:`C:\ai_zhs\cert\*.pem`(5 个,每个仅 10–20 字节,不可能是真 PEM, 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记在 L9695(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6532(L1 外部持有行 L4709):

```
- [ ]（进行中）**守门 91 冻结的 9 处待清 + 一项方法论债(2026-09-24)**:① study-publish 整文件主题化(14 处 `getTokens('light')`,8 处在模块级 StyleSheet.create 里,须改成按 scheme 生成的函数或下沉到组件内), 改完后 `node scripts/check-theme-prop-wiring.mjs --update-baseline` 应收窄; ② 7 个他人 M 在制的屏(CourseDetail / Distribution / LiveDetail / ModelPlaza / N8nModel / PostCreate / SharedDemo)待其会话自行接线; ③ `{...props}` 展开类站点被判 spread-unknown(判不出即如实报,不静默放行)—— 要真正覆盖须先给端内 wrapper 的 props 建立类型事实,属独立改造; ④ 方法论债:**本轮两次误判同源** —— 一次是把像素被 `rgba(0,0,0,0.6)` 遮罩压暗 40% 当成"颜色没落上", 一次是用"文本里有没有某个键"统计出"0 处漏传"。两者的共同错误是**用一个不测量目标东西的探针给出肯定结论**。 纪律:凡给出"0 处 / 没有 / 已全清"这类否定性结论,必须先构造一个**已知应被命中的正例**喂给同一判据(阳性对照), 否则该结论不得写进文档或据此决定"不做"。 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记在 L9878(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6533(L1 外部持有行 L4700):

```
- [ ] **本轮未落地、需重做的一批(web 86 处内的键名对齐)**:该批次报告改了 4 个文件(`DeveloperKeyDialog` / `AiGenerationContent` / `PermissionSelector` / `helpers`),**逐条按内容复核后全部不在 HEAD**(`git grep <新键名> HEAD -- apps/web` 四处均 0 命中),工作区也已被并发会话覆盖 → 判为**丢失需重做**,不要当成已完成。中途我一度按"工作区里有"记成"已落地",那是读到了被覆盖前的窗口 —— 并行期复核一律以 **HEAD 对象树内容**为准(档案第 4 节已记此教训)。 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记在 L9881(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6534(L1 外部持有行 L8009):

```
- [ ] **紧急(他人暂存态,非本会话所为,2026-09-24 11:0x 发现)**:**索引里有 16 条"已暂存的删除"**,一次不带 pathspec 的普通 commit 就会把这些**已入库功能从版本树删掉**。清单含三个成体系功能族 + 一道守门:① D62 语音字幕(`packages/shared/src/chat/voice-subtitles.ts` + web 组件 + 测试)、② D91 批注锚点(`annotation-anchors.ts` 同族)、③ D67 额度归属(`quota-ownership.ts` 同族)、④ **并发会话 cb99ef0c 刚提交的 `apps/mobile-rn/src/theme/color-scheme-sync.ts` 及其测试与 NativeWind mock**(删掉即把"App 主题开关驱动 NativeWind"这次修复整体回退)、⑤ `scripts/check-home-junctions.mjs` + 其镜像测试。**判为误删而非迁移的依据**:索引里的桶文件 `packages/shared/src/chat/index.ts` **与 HEAD 一字未改且仍导出这三模块**(二者矛盾 ⇒ 构建必炸,实测 Metro 就在 `export * from './voice-subtitles'` 处失败),且`git ls-files` 全仓**无替代路径**。**本会话处置边界**:只把 13 个文件(2626 行)的内容**恢复到工作区**让构建可用,**索引一字未动** —— 是否撤销这些暂存删除由制造它们的会话自己决定(§5b:他人已暂存的删除只报数、不代裁)。取证:`git diff --cached --diff-filter=D --name-only`;复跑恢复:`node .ihui-agent/tmp/rn-build/restore-worktree.mjs`。**另注**:`heal-worktree-tracked.mjs --check` 此时报"工作区已跟踪文件存续正常"—— 其判据②要求"索引 blob == HEAD blob",而暂存删除使该条件不成立,故**这类"已暂存的删除"不在存续自愈覆盖面上**,是一道无人看的路;要闭环需在守门侧对 `--diff-filter=D` 的暂存删除单独计数并阻断(未擅自新增守门,留单)。 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记在 L9923(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L6545(L1 外部持有行 L15577):

```
- [ ] **[归并]** 【归并】重复登记副本:本行与同标题登记 L6542(枚 b0d91000e)重复,并发归档/回捞把它复制到了不同编号下(编号一律不改、不删行、正文逐字留在下方)。本行不进派单口径,活账以主行为准。 **G-349. 门 8 清账后遗留的三枚"有消费方的待实装路由"(2026-09-28 登记,现读=基线仅剩 3 处)**:① `GET /api/subagents/all` —— 消费者 `apps/web/app/(main)/agent-teams/page.tsx:58`(期望 `{dispatches}` 含 completed/failed/cancelled 全量);后端只有 `/subagents/active`(仅 pending/running,形状恰好相同但语义是子集,**不得**为省事把客户端改道 active —— 那会把"页面少了历史"写成"已修")。正解 = 在 `subagent-dispatch.ts` 补 all 列表路由(带 status/limit 透传)。②③ `PUT /api/ai/n8n/workflows/:id` 与 `POST .../toggle` —— 消费者 `apps/mobile-rn/src/screens/N8nModelScreen.tsx:146/192`(保存改名/启停今天必 404);后端 n8n 面只有列表透传与创建转发(miniapp-compat-routes.ts:1123/1190),n8n REST API 本身支持 workflows/:id 更新与 activate/deactivate,正解 = 在 n8n 代理补两枚透传(SSRF 校验与 env 缺省回 stub 的既有纪律照抄)。验收判据:两枚消费者页面真机/真会话各跑一次成功路径 + 基线 `scripts/api-routes-baseline.json` 清零 + 门 8 末行现读 0。**归属**:subagent 面 = agent-teams 线;n8n 两面 = n8n 代理持有人(本票只登记形状与消费者证据,不代裁实现位置)。 〔落地@2026-09-28/枚 2704c4d27〕三枚路由已入库:subagents/all(新→旧+status/limit)、/ai/n8n/workflows 面四枚(list stub/写 503/fetch-merge-put/toggle 回读真值);apps/api/tests/g299-new-routes.test.ts 4 例绿、门 8 死调用清零、基线 perFileCount 清表。**本票未翻勾的唯一理由=验收判据第一条未跑**:RN N8nModelScreen 真机走查(本机无设备)与 agent-teams 页真会话 200 取证(需起栈)——路由与契约已证,运行时成功路径待验,不得以单测冒充真机。（编号改派留痕:本行原登记为「G-299. 门 8 清账后遗留的三枚…」,与「本机交付被远端分支保护拒收」撞成一号两事;2026-09-28 由 live-doc-edit 的取号令牌在每次 CAS 里按当下 HEAD 现算改派为 G-312,旧编号在此留原文,便于任何按旧号引用的人查得到去向,而不是让它静默消失） —— 沿革:G-299→G-312→G-334(两次都被别的登记占去,每次都在行尾留原文)。**[重复登记副本]** 同一件事在 origin 侧以「G-316. 门 8 清账后遗留的三枚…」另登过一次,当前状态持有行按那条走,本行不翻勾、不并抄。 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「G-349 · 门8清账后遗留的三枚"有消费方的待实装路由"」,派单以那条为准,本行不再单独派单。〕
```

- 原 L6547(L1 外部持有行 L15666):

```
- [ ] **[归并]** 【归并】重复登记副本:本行与同标题登记 L6918(枚 290a26bc1)重复,并发归档/回捞把它复制到了不同编号下(编号一律不改、不删行、正文逐字留在下方)。本行不进派单口径,活账以主行为准。 **G-337. 分叉合并把 12 个"首行相同、正文已漂移"的重复登记块并到了一起(台账锚点 F4b 由两侧各自的 0 抬到 12),这不是存量欠账,是合并自己造出来的形态**:机制 —— 同一段多行登记被两条分支各自抄走后又各改了正文,行级判据(F1/F2/F4)按"编号 + 标题前缀逐字等值"配对,配不上这种"块级同、行内漂";而 union 的行重数策略对每一行都只"补对侧净增",于是两份漂移副本都活了下来。出口只有 `node scripts/plan-tasks-merge.mjs --dedupe-blocks` 的**报告档**(先不带 --commit 出清单),它**只删逐字相同的第 2..N 份**,**漂移副本一份都不动** —— 机器折半即有损,所以那 12 块必须逐块人工判"哪一份是当前状态",判完就地改写或翻勾并写明归并到谁(§1 第 2 条)。**等什么**:逐块裁决要读两条分支各自的上下文,不由合并代裁;在此之前 F4b=12 只是现读锚点,不得被读成"已修"。(2026-09-28 合并时登记,现值一律跑 `node scripts/plan-tasks.mjs --gate --json` 看末行)
```

- 原 L6548(L1 外部持有行 L15667):

```
- [ ] **[归并]** 【归并】重复登记副本:本行与同标题登记 L6918(枚 290a26bc1)重复,并发归档/回捞把它复制到了不同编号下(编号一律不改、不删行、正文逐字留在下方)。本行不进派单口径,活账以主行为准。 **G-351. 分叉合并把 12 个"首行相同、正文已漂移"的重复登记块并到了一起(台账锚点 F4b 由两侧各自的 0 抬到 12),这不是存量欠账,是合并自己造出来的形态**:机制 —— 同一段多行登记被两条分支各自抄走后又各改了正文,行级判据(F1/F2/F4)按"编号 + 标题前缀逐字等值"配对,配不上这种"块级同、行内漂";而 union 的行重数策略对每一行都只"补对侧净增",于是两份漂移副本都活了下来。出口只有 `node scripts/plan-tasks-merge.mjs --dedupe-blocks` 的**报告档**(先不带 --commit 出清单),它**只删逐字相同的第 2..N 份**,**漂移副本一份都不动** —— 机器折半即有损,所以那 12 块必须逐块人工判"哪一份是当前状态",判完就地改写或翻勾并写明归并到谁(§1 第 2 条)。**等什么**:逐块裁决要读两条分支各自的上下文,不由合并代裁;在此之前 F4b=12 只是现读锚点,不得被读成"已修"。(2026-09-28 合并时登记,现值一律跑 `node scripts/plan-tasks.mjs --gate --json` 看末行)
```

- 原 L6558(L1 外部持有行 L15577):

```
- [ ] **[归并]** 【归并】重复登记副本:本行与同标题登记 L6542(枚 b0d91000e)重复,并发归档/回捞把它复制到了不同编号下(编号一律不改、不删行、正文逐字留在下方)。本行不进派单口径,活账以主行为准。 **G-349. 门 8 清账后遗留的三枚"有消费方的待实装路由"(2026-09-28 登记,现读=基线仅剩 3 处)**:① `GET /api/subagents/all` —— 消费者 `apps/web/app/(main)/agent-teams/page.tsx:58`(期望 `{dispatches}` 含 completed/failed/cancelled 全量);后端只有 `/subagents/active`(仅 pending/running,形状恰好相同但语义是子集,**不得**为省事把客户端改道 active —— 那会把"页面少了历史"写成"已修")。正解 = 在 `subagent-dispatch.ts` 补 all 列表路由(带 status/limit 透传)。②③ `PUT /api/ai/n8n/workflows/:id` 与 `POST .../toggle` —— 消费者 `apps/mobile-rn/src/screens/N8nModelScreen.tsx:146/192`(保存改名/启停今天必 404);后端 n8n 面只有列表透传与创建转发(miniapp-compat-routes.ts:1123/1190),n8n REST API 本身支持 workflows/:id 更新与 activate/deactivate,正解 = 在 n8n 代理补两枚透传(SSRF 校验与 env 缺省回 stub 的既有纪律照抄)。验收判据:两枚消费者页面真机/真会话各跑一次成功路径 + 基线 `scripts/api-routes-baseline.json` 清零 + 门 8 末行现读 0。**归属**:subagent 面 = agent-teams 线;n8n 两面 = n8n 代理持有人(本票只登记形状与消费者证据,不代裁实现位置)。 〔落地@2026-09-28/枚 2704c4d27〕三枚路由已入库:subagents/all(新→旧+status/limit)、/ai/n8n/workflows 面四枚(list stub/写 503/fetch-merge-put/toggle 回读真值);apps/api/tests/g299-new-routes.test.ts 4 例绿、门 8 死调用清零、基线 perFileCount 清表。**本票未翻勾的唯一理由=验收判据第一条未跑**:RN N8nModelScreen 真机走查(本机无设备)与 agent-teams 页真会话 200 取证(需起栈)——路由与契约已证,运行时成功路径待验,不得以单测冒充真机。（编号改派留痕:本行原登记为「G-299. 门 8 清账后遗留的三枚…」,与「本机交付被远端分支保护拒收」撞成一号两事;2026-09-28 由 live-doc-edit 的取号令牌在每次 CAS 里按当下 HEAD 现算改派为 G-312,旧编号在此留原文,便于任何按旧号引用的人查得到去向,而不是让它静默消失） —— 沿革:G-299→G-312→G-334(两次都被别的登记占去,每次都在行尾留原文)。**[重复登记副本]** 同一件事在 origin 侧以「G-316. 门 8 清账后遗留的三枚…」另登过一次,当前状态持有行按那条走,本行不翻勾、不并抄。 (2026-09-28 二次改派:上一轮的号是按当时快照取的,合并落地后又被并发批次用掉同号 ⇒ 本次改由 live-doc-edit 在每次 CAS 里按当下 HEAD 现算,不再照快照取号。)
```

- 原 L6559(L1 外部持有行 L15668):

```
- [ ] **[归并]** 【归并】重复登记副本:本行与同标题登记 L6879(枚 290a26bc1)重复,并发归档/回捞把它复制到了不同编号下(编号一律不改、不删行、正文逐字留在下方)。本行不进派单口径,活账以主行为准。 **G-350. 分叉合并带进来的三组跨分支撞号(G-300 / G-301 / G-310),锚点已按现读收下,清偿不在这张票里**:机制不是"没查号" —— 两条分支各自在**自己那侧的当下 HEAD** 取过号、都没撞,合到同一份账面才第一次相遇(取号发生在分叉的两条腿上,号段并不共享)。判红条件"锚点里没有的键"必须现读放行,否则这枚合并自己就是一台恒红门;但**放行不等于已修**。归谁:各该票的持有人(由 origin 侧登记的哪一路会话持有)。等什么:该票持有人把自己那一侧改派成新号并在行尾留沿革,改派后跑 `node scripts/plan-tasks.mjs --update-baseline` 收窄锚点 —— 只许收窄,所以这一步天然把"顺手把锚调宽"堵在外面。(2026-09-28 合并时登记,现读见当次 --gate --json 的 collisions 数组) (2026-09-28 二次改派:上一轮的号是按当时快照取的,合并落地后又被并发批次用掉同号 ⇒ 本次改由 live-doc-edit 在每次 CAS 里按当下 HEAD 现算,不再照快照取号。)
```

- 原 L6560(L1 外部持有行 L15669):

```
- [ ] **[归并]** 【归并】重复登记副本:本行与同标题登记 L6880(枚 290a26bc1)重复,并发归档/回捞把它复制到了不同编号下(编号一律不改、不删行、正文逐字留在下方)。本行不进派单口径,活账以主行为准。 **G-351. 分叉合并这次"丢掉的东西"与"互相矛盾的两行文档",按归属交接,不由合并代裁**:① **丢的实现** —— `scripts/check-service-binary-paths.mjs` 与它的测试是同一票在两条分支各写一份(add/add),合并取的是 origin 那份(唯一理由:合并后的 guardian-runner 注册的是它,而只有它读 `HUSKY_SKIP_SERVICE_BINARY_PATHS`;留本侧就等于给提交链挂一条"文档写了但跑不通的出路"),本侧多出的三样探测随本次合并**没了**:服务 STATE 的 `sc query` 取法、按声明端口真应答的活性探测、nssm 输出的 UTF-16LE 解码。归该门持有人,出口是把这三样并回 origin 那份实现,不是把文件换回来。② **矛盾的两行文档** —— AGENTS.md 里现在同时留着"定级 warn / 手动问责 / 刻意不进提交链,因此无紧急跳过变量"(本侧)与"定级 warn,紧急跳过 `HUSKY_SKIP_SERVICE_BINARY_PATHS`"(origin 侧),两句对同一条门互斥;合并**没有**替谁改写谁的那一行(两条都逐字存活),拍板归两侧登记人共同做。③ 为什么这两件事不在合并里顺手修:①要动别人正在持有的门体,②要判定级属产品/治理决策 —— 合并的职责是"谁独有的谁拿走",不包括替人裁决。**等什么**:①② 各自持有人;在此之前锚点里 `G-300/G-301/G-310` 三组跨分支撞号按现读放行(见上一条),不得靠调宽锚点消红。(2026-09-28 合并时登记) (2026-09-28 二次改派:上一轮的号是按当时快照取的,合并落地后又被并发批次用掉同号 ⇒ 本次改由 live-doc-edit 在每次 CAS 里按当下 HEAD 现算,不再照快照取号。)
```

- 原 L6563(L1 外部持有行 L15670):

```
- [ ]【【归并】重复登记副本·双前缀畸形号(2026-09-28):行首那个号是改派工具把前缀又贴一次造出来的,尺子按它取不出主键,于是同一件事被算成两个标题;这份是并集重放带回的折叠前形态。同题登记的持有行是「门33的provider名单该由谁供给归属:守门33持有人;等人拍板」那一条(按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。】 **门 33 的 provider 名单该由谁供给(归属:守门 33 持有人;等人拍板)** —— 现读 7 个在 `.env` 的合法 provider 被判"未知",默认档只 warning 所以 rc 0。**为什么还开着**:config.py 的设计是"新增 provider 零代码改动、自动识别",而本门的名单是手抄副本;两种收口动作语义相反——① 把 7 个补进名单 = 继续养第二份真相,② 由 `.env`/服务端能力清单单向投影 = 改一道 blocking 门的判据。必须先定"这份名单到底要不要存在"。**不得**为让 warning 归零去删判据或放宽规则 3。
```

- 原 L6564(L1 外部持有行 L15579):

```
- [ ]【【归并】重复登记副本·双前缀畸形号(2026-09-28):行首那个号是改派工具把前缀又贴一次造出来的,尺子按它取不出主键,于是同一件事被算成两个标题;这份是并集重放带回的折叠前形态。同题登记的持有行是「MemberCard把"没量到"显示成0第八轮对照逼出;归属:web」那一条(按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。】 **MemberCard 把"没量到"显示成 0(第八轮对照逼出;归属:web 首页持有者;等 §17 运行时自验排期)** —— `apps/web/src/components/home/MemberCard.tsx:72-73` 现读 `stats?.points ?? 0` / `wallet?.balance ?? 0`,查询未回或失败时显示"0 分""0 余额"。上游同族口径是"订阅未知不能发布为成功空快照"(`packages/services/src/usage-stats/providers/bigmodelUsageQuotaProvider.ts:259` 原文)加展示层 `'--'` 占位。**为什么还开着**:属 UI 改动,§17 要求起 dev + 读 DOM 数值自验,本票未做该项;改法是 `number | null` + 占位,不动判据、无恒红风险。**这一条不是"抄上游功能",是把"未知"与"为零"分开** —— 后者是数据事故,前者是显示诚实。
```

- 原 L6565(L1 外部持有行 L7603):

```
- [ ]【【归并】重复登记副本·双前缀畸形号(2026-09-28):行首那个号是改派工具把前缀又贴一次造出来的,尺子按它取不出主键,于是同一件事被算成两个标题;这份是并集重放带回的折叠前形态。同题登记的持有行是「配置分层的"出处标签"与"请求档vs实得档"留痕归属:cli/子代理」那一条(按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。】 **配置分层的"出处标签"与"请求档 vs 实得档"留痕(归属:cli/子代理线持有人;等产品拍板)** —— 上游 `packages/provider/src/resolver.ts:190/196/208` 三层 overlay 且每个生效对象带 `source` 标签、快照的 `sourceRevisions` 被真实消费;我方 `apps/cli/src/subagents/precedence.ts:195-205` 的四层短路链**没有出处标签**,且 `git grep -I "requestedEffort\|effectiveEffort\|validateModelSelection"` HEAD 面现读 **0 命中** ⇒ 静默降档无法归因。**为什么还开着**:新建"配置分层解析出口"属 §24 新增能力、且是跨端数据建模,不在本轮取证范围;上游那两格(`effective-model-selection.ts` 的 `selectionIssue` 六值枚举、`model-selection-config.ts:76-77`"不能静默补档位")是它的前置形状,可作参考实现但不是本轮交付物。
```

- 原 L6566(L1 外部持有行 L15671):

```
- [ ]【【归并】重复登记副本·双前缀畸形号(2026-09-28):行首那个号是改派工具把前缀又贴一次造出来的,尺子按它取不出主键,于是同一件事被算成两个标题;这份是并集重放带回的折叠前形态。同题登记的持有行是「非会话401被当成会话死亡需拍板,会改用户可见语义——apps/ap」那一条(按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。】 **非会话 401 被当成会话死亡(需拍板,会改用户可见语义)** —— `apps/api/src/routes/agent-extended.ts:202` 现读 `statusCode ?? 401`,第三方 key 填错也以 401 出栈;而 `packages/api-client/src/client.ts:654/701` 只按 `isAuthEndpoint` 排除 ⇒ 用户看到的是"你要重新登录",而真实原因是"别人家的凭据错了"。归属:api 鉴权面 + api-client 两侧持有者。**为什么还开着**:收紧改变前端可见行为(弹登录框),按纪律属对外语义决策,不得由取证票自行落地。
```

- 原 L6567(L1 外部持有行 L7605):

```
- [ ]【【归并】重复登记副本·双前缀畸形号(2026-09-28):行首那个号是改派工具把前缀又贴一次造出来的,尺子按它取不出主键,于是同一件事被算成两个标题;这份是并集重放带回的折叠前形态。同题登记的持有行是「锁的"租约认token不认pid"一格只登记、未代裁归属:git-l」那一条(按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。】 **锁的"租约认 token 不认 pid"一格只登记、未代裁(归属:`git-lock`/`deploy-lock` 持有人)** —— 上游 `packages/provider-node/src/zcode-builtin-remote-synchronizer.ts:85` 取 `leaseId=randomUUID`、`:143` 的 `#finishLease` 只在 leaseId 相等时才改控制文件,于是"pid 被系统复用"这一型**结构上不可能发生**;而我方是事后补的一环(`scripts/lib/proc-identity.mjs` 的 match/mismatch/unverifiable,承 G-193 那次冻结 11h50m)。**为什么还开着**:改两处锁的 meta 属锁持有人领地,且今天没有可复现的抢占现场做验收依据;真要收它,判据应是"注入一次 leaseId 不相等的迟到 finish 请求,控制文件必须不被改动",而不是"代码写了 leaseId"。
```

- 原 L6568(L1 外部持有行 L7606):

```
- [ ]【【归并】重复登记副本·双前缀畸形号(2026-09-28):行首那个号是改派工具把前缀又贴一次造出来的,尺子按它取不出主键,于是同一件事被算成两个标题;这份是并集重放带回的折叠前形态。同题登记的持有行是「第八轮剩余六格候选清单归属:未派;等各线排期;本轮只取证未实现,逐格」那一条(按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。】 **第八轮剩余六格候选清单(归属:未派;等各线排期;本轮只取证未实现,逐格带出处)** —— ① 跨层发布闸:上游 `registry-service.ts:205-212` 在"下层已变而上层仍基于旧事实"时**不发混合快照**、继续服务上一份完整 Registry,而我方这条纪律只活在门的散文里、运行时层无出口;② 稀疏 overlay 空即删:`config-service.ts:513-516` 与继承值等价的配置不落盘(absence=继承,不是"空覆盖");③ 诊断量代替原文:`officialMcpCredentials.ts:52-90/359-376` 只记 JWT 剩余秒数并按小时分桶去重,可接我方唯一脱敏出口 `packages/shared/src/utils/redact.ts`;④ 告警去重身份=桶+周期而非墙钟窗口:`startPlanQuotaReminderStore.ts:33-36` 用快照 `referenceTime` 裁决(设备时间可能已越过服务端周期)、`bucketReminderKey` 缺任一字段即不提醒;⑤ in-flight 合并 + CAS 驱逐:`zaiStartPlanBilling.ts:113-122` 失败响应同样保留 1s(防 429 后立刻重复请求)且驱逐前 `if (requests.get(k) !== request) return`(旧请求不得删新记录),上游该守卫三处同形,是我方共享工作区并发写可直接取用的最小实现;⑥ 幂等 key 复用规则:`codingPlanQuotaResetCoordinator.ts:307-329` 瞬时错复用原 key、成功或稳定错才置 null,且服务端 `next_try_at` 必须透传(:617-624)。**为什么还开着**:六格都是"能落但需各自定级与验收"的独立改动(①②碰运行时快照语义、③④⑤⑥碰告警与并发路径),打包成一票会互相遮蔽;派单时逐格取,勿一次全接。**另有一格需产品先定**:上游 `usage-quota.ts:71` 的 `percentage` 是**已用**占比、而 Start Plan 侧 `:1338` 同名字段是**剩余/总额**,现靠"两族走不同 reader"规避,**无类型或判据看守** —— 要不要收口成"以 remaining 为权威、percentage 仅降级",属契约决策。
```

- 原 L6651(L1 外部持有行 L11199):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-457 **桌面端「启动后先进托盘」在真机采样里出现过一次"启动 11 秒后窗口自行转为可见"（复现条件未定位，不是偶发即免检）**：同一份 debug 构建、同一份 `desktop-behavior.json`（`launch_minimized:true`）两次采样结论相反 —— 一次 `vis=0 all=1`（3s 与 11s 两趟都全程隐藏，符合预期），另一次 3s 隐藏而 11s 变可见。窗口始终存在（`all=1`），所以不是"没隐藏成功"，而是**某处在我看不到的时刻把它 show 了出来**。已知候选：`lib.rs` 的 12 处 `window.show()`（375 单实例回调 / 2326 / 2728 / 2982 托盘动作与快捷键 / 474-590 托盘菜单分支），以及 `auto_refresh` 的断网兜底守卫。接手第一步：把 show 调用点统一加一行 `log::info!("[window-show] 站点=<n> 触发=…")`，再做两时刻采样(启动后 3s 与 11s 各一趟)（枚举该 pid 全部顶层窗口并分 vis/all 计数，**只看 vis 会把"窗口还没创建"误判成"已隐藏"** —— 本票的相反结论就是这么来的）。判据：同一配置连采 5 趟，`all=1 ∧ vis=0` 恒成立才算收口。**同格第二项未闭环（一并登记，避免下一个人以为弹框那一路也测过）**：「关闭时询问」在真机上只验到**前端没接住**的那一侧（3s 看门狗落兜底隐藏，不卡死不静默退出）；**前端接住并答完**这一路未做真机验证 —— `tauri dev --config {"build":{"devUrl":"http://localhost:8861"}}` 实测仍加载线上 bundle（DevTools 标题 = aizhs.top/agents，设置页里根本没有新卡片），即 devUrl 覆盖在薄壳模式下不生效，要验这一路得先解决"如何让壳加载本地构建"。该行目前只有单测 + 桌面事件三层接线守门覆盖。 〔改派留痕(2026-09-28 台账归并):本行是已完成那条 G-328(主因已修)之后的**另一格残余现象**,与它不是同一行当前状态 ⇒ 另取一号;两行内容都逐字保留。〕 (编号改派留痕(2026-09-28):本行原取 G-362,与同一编号下的另一条登记撞成一号两事(取号发生在分叉的两条腿上,号段不共享)。按台账既有口径让位 —— 同编号多条未完成登记时,持有行 = 位置最靠前的那一条;若对侧是已完成的历史行,则历史行保留原号(改它会牵动 README/commit 对旧号的引用,属 §22 那类破坏)。新号 G-457 是逐面复核过的空闲号(台账 HEAD 面 ⊕ 工作树 ⊕ 归档件全文三处均无),正文一字未动。旧号在此留原文,按旧号引用的人查得到去向。) (原编号 G-457;持有行题面「桌面端「启动后先进托盘」在真机采样里出现过一次"」)
```

- 原 L6658(L1 外部持有行 L15672):

```
- [ ]〔【归并】重复登记副本(2026-09-28 · 同文第 1 份):同题登记的持有行是「门 8 清账后遗留的三枚"有消费方的待实装路由"…」那一条待办(按标题前缀寻行,既不写行号也不写编号 —— 编号写进指针会被台账取成这条副本自己的主键,这正是本行刚犯过的错),派单以那条为准;本行不翻勾、不并抄。〕 **门 8 清账后遗留的三枚"有消费方的待实装路由"(2026-09-28 登记,现读=基线仅剩 3 处)**:① `GET /api/subagents/all` —— 消费者 `apps/web/app/(main)/agent-teams/page.tsx:58`(期望 `{dispatches}` 含 completed/failed/cancelled 全量);后端只有 `/subagents/active`(仅 pending/running,形状恰好相同但语义是子集,**不得**为省事把客户端改道 active —— 那会把"页面少了历史"写成"已修")。正解 = 在 `subagent-dispatch.ts` 补 all 列表路由(带 status/limit 透传)。②③ `PUT /api/ai/n8n/workflows/:id` 与 `POST .../toggle` —— 消费者 `apps/mobile-rn/src/screens/N8nModelScreen.tsx:146/192`(保存改名/启停今天必 404);后端 n8n 面只有列表透传与创建转发(miniapp-compat-routes.ts:1123/1190),n8n REST API 本身支持 workflows/:id 更新与 activate/deactivate,正解 = 在 n8n 代理补两枚透传(SSRF 校验与 env 缺省回 stub 的既有纪律照抄)。验收判据:两枚消费者页面真机/真会话各跑一次成功路径 + 基线 `scripts/api-routes-baseline.json` 清零 + 门 8 末行现读 0。**归属**:subagent 面 = agent-teams 线;n8n 两面 = n8n 代理持有人(本票只登记形状与消费者证据,不代裁实现位置)。 〔落地@2026-09-28/枚 2704c4d27〕三枚路由已入库:subagents/all(新→旧+status/limit)、/ai/n8n/workflows 面四枚(list stub/写 503/fetch-merge-put/toggle 回读真值);apps/api/tests/g299-new-routes.test.ts 4 例绿、门 8 死调用清零、基线 perFileCount 清表。**本票未翻勾的唯一理由=验收判据第一条未跑**:RN N8nModelScreen 真机走查(本机无设备)与 agent-teams 页真会话 200 取证(需起栈)——路由与契约已证,运行时成功路径待验,不得以单测冒充真机。（编号改派留痕:本行原登记为「G-299. 门 8 清账后遗留的三枚…」,与「本机交付被远端分支保护拒收」撞成一号两事;2026-09-28 由 live-doc-edit 的取号令牌在每次 CAS 里按当下 HEAD 现算改派为 G-312,旧编号在此留原文,便于任何按旧号引用的人查得到去向,而不是让它静默消失） (原编号 G-312) (原编号 G-312)
```

- 原 L6659(L1 外部持有行 L15672):

```
- [ ]〔【归并】重复登记副本(2026-09-28 · 同文第 2 份):同题登记的持有行是「门 8 清账后遗留的三枚"有消费方的待实装路由"…」那一条待办(按标题前缀寻行,既不写行号也不写编号 —— 编号写进指针会被台账取成这条副本自己的主键,这正是本行刚犯过的错),派单以那条为准;本行不翻勾、不并抄。〕 **门 8 清账后遗留的三枚"有消费方的待实装路由"(2026-09-28 登记,现读=基线仅剩 3 处)**:① `GET /api/subagents/all` —— 消费者 `apps/web/app/(main)/agent-teams/page.tsx:58`(期望 `{dispatches}` 含 completed/failed/cancelled 全量);后端只有 `/subagents/active`(仅 pending/running,形状恰好相同但语义是子集,**不得**为省事把客户端改道 active —— 那会把"页面少了历史"写成"已修")。正解 = 在 `subagent-dispatch.ts` 补 all 列表路由(带 status/limit 透传)。②③ `PUT /api/ai/n8n/workflows/:id` 与 `POST .../toggle` —— 消费者 `apps/mobile-rn/src/screens/N8nModelScreen.tsx:146/192`(保存改名/启停今天必 404);后端 n8n 面只有列表透传与创建转发(miniapp-compat-routes.ts:1123/1190),n8n REST API 本身支持 workflows/:id 更新与 activate/deactivate,正解 = 在 n8n 代理补两枚透传(SSRF 校验与 env 缺省回 stub 的既有纪律照抄)。验收判据:两枚消费者页面真机/真会话各跑一次成功路径 + 基线 `scripts/api-routes-baseline.json` 清零 + 门 8 末行现读 0。**归属**:subagent 面 = agent-teams 线;n8n 两面 = n8n 代理持有人(本票只登记形状与消费者证据,不代裁实现位置)。 〔落地@2026-09-28/枚 2704c4d27〕三枚路由已入库:subagents/all(新→旧+status/limit)、/ai/n8n/workflows 面四枚(list stub/写 503/fetch-merge-put/toggle 回读真值);apps/api/tests/g299-new-routes.test.ts 4 例绿、门 8 死调用清零、基线 perFileCount 清表。**本票未翻勾的唯一理由=验收判据第一条未跑**:RN N8nModelScreen 真机走查(本机无设备)与 agent-teams 页真会话 200 取证(需起栈)——路由与契约已证,运行时成功路径待验,不得以单测冒充真机。（编号改派留痕:本行原登记为「G-299. 门 8 清账后遗留的三枚…」,与「本机交付被远端分支保护拒收」撞成一号两事;2026-09-28 由 live-doc-edit 的取号令牌在每次 CAS 里按当下 HEAD 现算改派为 G-312,旧编号在此留原文,便于任何按旧号引用的人查得到去向,而不是让它静默消失） —— 沿革:G-299→G-312→G-334(两次都被别的登记占去,每次都在行尾留原文)。**[重复登记副本]** 同一件事在 origin 侧以「G-316. 门 8 清账后遗留的三枚…」另登过一次,当前状态持有行按那条走,本行不翻勾、不并抄。 (原编号 G-334) (原编号 G-334)
```

- 原 L6661(L1 外部持有行 L15673):

```
- [ ]〔【归并】重复登记副本(2026-09-28):同题登记的持有行是「分叉合并带进来的三组跨分支撞号…」那一条待办(按标题前缀寻行,既不写行号也不写编号 —— 编号写进指针会被台账取成这条副本自己的主键,这正是本行刚犯过的错),派单以那条为准;本行不翻勾、不并抄。〕 **分叉合并带进来的三组跨分支撞号(G-300 / G-301 / G-310),锚点已按现读收下,清偿不在这张票里**:机制不是"没查号" —— 两条分支各自在**自己那侧的当下 HEAD** 取过号、都没撞,合到同一份账面才第一次相遇(取号发生在分叉的两条腿上,号段并不共享)。判红条件"锚点里没有的键"必须现读放行,否则这枚合并自己就是一台恒红门;但**放行不等于已修**。归谁:各该票的持有人(由 origin 侧登记的哪一路会话持有)。等什么:该票持有人把自己那一侧改派成新号并在行尾留沿革,改派后跑 `node scripts/plan-tasks.mjs --update-baseline` 收窄锚点 —— 只许收窄,所以这一步天然把"顺手把锚调宽"堵在外面。(2026-09-28 合并时登记,现读见当次 --gate --json 的 collisions 数组) (原编号 G-335) (原编号 G-335)
```

- 原 L6662(L1 外部持有行 L15674):

```
- [ ]〔【归并】重复登记副本(2026-09-28):同题登记的持有行是「分叉合并这次"丢掉的东西"与"互相矛盾的两行文档"…」那一条待办(按标题前缀寻行,既不写行号也不写编号 —— 编号写进指针会被台账取成这条副本自己的主键,这正是本行刚犯过的错),派单以那条为准;本行不翻勾、不并抄。〕 **分叉合并这次"丢掉的东西"与"互相矛盾的两行文档",按归属交接,不由合并代裁**:① **丢的实现** —— `scripts/check-service-binary-paths.mjs` 与它的测试是同一票在两条分支各写一份(add/add),合并取的是 origin 那份(唯一理由:合并后的 guardian-runner 注册的是它,而只有它读 `HUSKY_SKIP_SERVICE_BINARY_PATHS`;留本侧就等于给提交链挂一条"文档写了但跑不通的出路"),本侧多出的三样探测随本次合并**没了**:服务 STATE 的 `sc query` 取法、按声明端口真应答的活性探测、nssm 输出的 UTF-16LE 解码。归该门持有人,出口是把这三样并回 origin 那份实现,不是把文件换回来。② **矛盾的两行文档** —— AGENTS.md 里现在同时留着"定级 warn / 手动问责 / 刻意不进提交链,因此无紧急跳过变量"(本侧)与"定级 warn,紧急跳过 `HUSKY_SKIP_SERVICE_BINARY_PATHS`"(origin 侧),两句对同一条门互斥;合并**没有**替谁改写谁的那一行(两条都逐字存活),拍板归两侧登记人共同做。③ 为什么这两件事不在合并里顺手修:①要动别人正在持有的门体,②要判定级属产品/治理决策 —— 合并的职责是"谁独有的谁拿走",不包括替人裁决。**等什么**:①② 各自持有人;在此之前锚点里 `G-300/G-301/G-310` 三组跨分支撞号按现读放行(见上一条),不得靠调宽锚点消红。(2026-09-28 合并时登记) (原编号 G-336) (原编号 G-336)
```

- 原 L6663(L1 外部持有行 L15675):

```
- [ ]〔【归并】重复登记副本(2026-09-28 · 同文第 1 份):同题登记的持有行是「分叉合并把 12 个"首行相同、正文已漂移"的重复登记块并到了一起…」那一条待办(按标题前缀寻行,既不写行号也不写编号 —— 编号写进指针会被台账取成这条副本自己的主键,这正是本行刚犯过的错),派单以那条为准;本行不翻勾、不并抄。〕 **分叉合并把 12 个"首行相同、正文已漂移"的重复登记块并到了一起(台账锚点 F4b 由两侧各自的 0 抬到 12),这不是存量欠账,是合并自己造出来的形态**:机制 —— 同一段多行登记被两条分支各自抄走后又各改了正文,行级判据(F1/F2/F4)按"编号 + 标题前缀逐字等值"配对,配不上这种"块级同、行内漂";而 union 的行重数策略对每一行都只"补对侧净增",于是两份漂移副本都活了下来。出口只有 `node scripts/plan-tasks-merge.mjs --dedupe-blocks` 的**报告档**(先不带 --commit 出清单),它**只删逐字相同的第 2..N 份**,**漂移副本一份都不动** —— 机器折半即有损,所以那 12 块必须逐块人工判"哪一份是当前状态",判完就地改写或翻勾并写明归并到谁(§1 第 2 条)。**等什么**:逐块裁决要读两条分支各自的上下文,不由合并代裁;在此之前 F4b=12 只是现读锚点,不得被读成"已修"。(2026-09-28 合并时登记,现值一律跑 `node scripts/plan-tasks.mjs --gate --json` 看末行) (原编号 G-337) (原编号 G-337)
```

- 原 L6664(L1 外部持有行 L15675):

```
- [ ]〔【归并】重复登记副本(2026-09-28 · 同文第 2 份):同题登记的持有行是「分叉合并把 12 个"首行相同、正文已漂移"的重复登记块并到了一起…」那一条待办(按标题前缀寻行,既不写行号也不写编号 —— 编号写进指针会被台账取成这条副本自己的主键,这正是本行刚犯过的错),派单以那条为准;本行不翻勾、不并抄。〕 **分叉合并把 12 个"首行相同、正文已漂移"的重复登记块并到了一起(台账锚点 F4b 由两侧各自的 0 抬到 12),这不是存量欠账,是合并自己造出来的形态**:机制 —— 同一段多行登记被两条分支各自抄走后又各改了正文,行级判据(F1/F2/F4)按"编号 + 标题前缀逐字等值"配对,配不上这种"块级同、行内漂";而 union 的行重数策略对每一行都只"补对侧净增",于是两份漂移副本都活了下来。出口只有 `node scripts/plan-tasks-merge.mjs --dedupe-blocks` 的**报告档**(先不带 --commit 出清单),它**只删逐字相同的第 2..N 份**,**漂移副本一份都不动** —— 机器折半即有损,所以那 12 块必须逐块人工判"哪一份是当前状态",判完就地改写或翻勾并写明归并到谁(§1 第 2 条)。**等什么**:逐块裁决要读两条分支各自的上下文,不由合并代裁;在此之前 F4b=12 只是现读锚点,不得被读成"已修"。(2026-09-28 合并时登记,现值一律跑 `node scripts/plan-tasks.mjs --gate --json` 看末行) (原编号 G-351) (原编号 G-351)
```

- 原 L6680(L1 外部持有行 L8048):

```
- [ ] **`--self-test` 的"登记侧不求值"洞已逐门普查完:41 道潜伏 / 今天掩盖真缺陷 0 条 / 根因是没有共用出口(普查判定面=HEAD,派单前须重跑)** —— 起因是本轮代落守门 41 时量到它的 13 条 self-test 全部传箭头函数而登记函数写的是 `!!ok`(`!!fn` 恒真)⇒ 一路打印"13/13 通过"却一条都没判过,在这个掩护下同文件一处单位错误(把**秒差**除以 3,600,000 ⇒ 48h 豁免窗实际约 5.5 年,"超窗仍判"那条反向对照永不触发)长期隐形。该门已修并补镜像(枚 `aea810c81`)。随后按 HEAD 面普查全仓 `scripts/**`(418 个 mjs)得到这一族的**全量分布**: 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6769(L1 外部持有行 L7607):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7697(G-401) 同题,派单以持有行为准,本行不再单独派单。〕 **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔拍板 2026-10-05(机主选"未知即按写处理"):MCP 工具默认档不再算 `read` —— 需批准、失败不自动重跑;确实只读者按"服务器 + 工具名"显式登记白名单并把白名单纳入跨语言对账。落点在 `apps/cli/src/tools/hub/mcp-adapter.ts` 与权限档两侧持有人;派单排在 G-710 那枚同目录代理之后,避免两个代理同改一个文件〕
```

- 原 L6770(L1 外部持有行 L7608):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7698(G-402) 同题,派单以持有行为准,本行不再单独派单。〕 **设置项"显式清空"与"从未设置"无差，且读侧同一含义两键相反（需拍板；归属：api 设置面 + web 设置页持有人）** —— 已亲自复验：`apps/api/src/routes/user/settings-routes.ts:55` 写体是 `z.record(z.string(), z.unknown())`，落库处 `value === null || value === undefined ? null : String(value)` ⇒ `null` 与"缺席"存成同一个 NULL 行；读侧 `apps/web/app/(main)/settings/notifications/page.tsx:48-52` 四键混用 `!== 'false'`（默认真）与 `=== 'true'`（默认假），于是**同一个被清空的值，在前一族读回 true、在后一族读回 false**。上游同族做法是把三态写进契约（`settings/pluginConfigPatch.ts:29-36`：`undefined`=未触碰跳过、`null`=进 `clearOptionKeys`、sensitive 空串=不改已有值；落库侧 `file-config.adapter.ts:557-565` 按 option key 合并而非整对象替换，防同 scope 密钥被静默清空）。**为什么还开着**：改成三态要动 PUT 语义（单键 DELETE 出口我方根本没有——`deleteUserPreference` 只服务 devices），属对外契约决策；先拍"要不要有删键出口"，再谈读侧归一。**不得**靠"读侧统一成 `=== 'true'`"消红——那会把默认真的四项静默翻转。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6771(L1 外部持有行 L15679):

```
- [ ]【【归并】重复登记副本·双前缀畸形号(2026-09-28):行首那个号是改派工具把前缀又贴一次造出来的,尺子按它取不出主键,于是同一件事被算成两个标题;这份是并集重放带回的折叠前形态。同题登记的持有行是「cachetoken过了服务端、没上客户端边界，三处消费端硬编码nu」那一条(按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。】 **cache token 过了服务端、没上客户端边界，三处消费端硬编码 null（可落地；归属：api-client + 三端上下文用量组件）** —— `packages/api-client/src/client.ts` 的 usage 解析只取 prompt/completion/total/reasoning（无 cache 字段），于是 `apps/web/src/components/ai/context-usage-ring.tsx:371`、`packages/app/src/features/chat/ContextUsagePanel.tsx:87`、`apps/miniapp-taro/src/pkg-ai/ai/context-usage-strip.tsx:74` 三处一律 `cacheReadTokens: null`，而 `context-usage-ring.tsx:759` 仍把这一档渲染成"读取 …"——**界面显示的是一个恒为 null 的字段**。服务端侧 `apps/ai-service/app/core/usage_cache.py` 已有双协议别名表，即数据源在、断在边界。修法向后兼容（加字段，缺值仍不渲染＝不判绿）。**判据缺口同记**：守门 112 对它两重失明（`SCAN_ROOTS` 不含 `packages/*`；`DENOMINATOR_NAME_RE` 只认 `context*` 前缀，`maxTokens` 整族隐身）。
```

- 原 L6772(L1 外部持有行 L15680):

```
- [ ]【【归并】重复登记副本·双前缀畸形号(2026-09-28):行首那个号是改派工具把前缀又贴一次造出来的,尺子按它取不出主键,于是同一件事被算成两个标题;这份是并集重放带回的折叠前形态。同题登记的持有行是「瞬时假值覆盖上一个可信值：上下文占用把"短暂0"当"真的清空"可落地」那一条(按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。】 **瞬时假值覆盖上一个可信值：上下文占用把"短暂 0"当"真的清空"（可落地；归属：web 首页/上下文条持有者）** —— `apps/web/src/components/chat/context-budget-bar.tsx:81-84` 只在 `!== undefined` 上守卫，收到 `used=0` 就渲染 0%；上游同型问题的处置是"普通工具调用期间 agent 会短暂发 used=0，这不是 context 真被清空"，并**逐项列出例外**（`/compact`、`/compress` 那一次 0 才是真话，见其 `zcodeTaskUsageFallback.ts:44-47,60-73`）。与我方 §30"没有终态不得写完成"、守门 135"身份不得从文案重建"同族。成本低（一处投影函数 + 一份成文例外表），但例外表**必须可判**，不得写成散文。
```

- 原 L6773(L1 外部持有行 L15681):

```
- [ ]【【归并】重复登记副本·双前缀畸形号(2026-09-28):行首那个号是改派工具把前缀又贴一次造出来的,尺子按它取不出主键,于是同一件事被算成两个标题;这份是并集重放带回的折叠前形态。同题登记的持有行是「影子副本门没有目录枚举可落地；归属：守门prod-bundle影子对」那一条(按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。】 **影子副本门没有目录枚举（可落地；归属：守门 prod-bundle 影子对账持有人）** —— `scripts/check-prod-bundle-shadow.mjs` 现读 `readdirSync` **0 次**，只比登记表里的对 ⇒ 一个未登记的脚本躺在 `deploy/prod-bundle/` 时本门全盲，而 §5e 的原话正是"落进 prod-bundle 的运维脚本必须同时落入库源，否则等于写进盲区"。上游同族做法把三件事同立：整棵树哈希（含 mode、排序、排除自身 integrity 文件）+ 清单逐字节验 + `reviewRequired` 非空直接抛。**注意定级方向**：它那套是 fail-closed 且只挂发布路径不挂提交链，与我方"台账只报数防恒红"（§12e）是同一条纪律的两侧——要抬的是**枚举面**，不是把判红搬到提交链上。
```

- 原 L6774(L1 外部持有行 L15682):

```
- [ ]【【归并】重复登记副本·双前缀畸形号(2026-09-28):行首那个号是改派工具把前缀又贴一次造出来的,尺子按它取不出主键,于是同一件事被算成两个标题;这份是并集重放带回的折叠前形态。同题登记的持有行是「棘轮锚点把量值编进指纹+--changed不沿反向依赖可落地；归属：」那一条(按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。】 **棘轮锚点把量值编进指纹 + `--changed` 不沿反向依赖（可落地；归属：守门 77/83/103 与门 118 那族）** —— 上游 `scripts/architecture/index.mjs` 的 `fingerprint(rule, file, detail)` 把**行数**当 detail，401 行涨到 500 会换指纹、被判"新违规"；我方锚点是"该文件违规**处数**"，500→5000 行名额不动。另它的 `--changed` 走反向依赖闭包（改一份被 40 处 import 的契约，那 40 处算这次头上），而我方 `PUSH_SCOPE_FILES`/`stagedTriggers` 都是路径前缀 ⇒ **改契约不红 importer**（门 103 已有 import 图，成本中）。两条都是"锚点粒度不够细 ⇒ 换个写法就净零逃逸"的同族，改法不得顺手扩成恒红。
```

- 原 L6775(L1 外部持有行 L15683):

```
- [ ]【【归并】重复登记副本·双前缀畸形号(2026-09-28):行首那个号是改派工具把前缀又贴一次造出来的,尺子按它取不出主键,于是同一件事被算成两个标题;这份是并集重放带回的折叠前形态。同题登记的持有行是「桌面侧两格：整页导航绕过"存草稿"闸+日志无保留期可落地；归属：de」那一条(按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。】 **桌面侧两格：整页导航绕过"存草稿"闸 + 日志无保留期（可落地；归属：desktop 端持有人）** —— ① `apps/desktop/src-tauri/src/lib.rs:2766` 在 `CloseRequested` 无条件 emit `desktop-before-close`（注释："三种去向都照发…先存草稿"），但 `auto_refresh.rs:275/318/347/366/394` 五处 `eval("location.reload()"/"location.href=")` 全部绕过；我方 `scripts/check-desktop-event-wiring.mjs` 的 **G8**（:470、:682-701）已经把"本文件的整页导航发起点"枚举成判据并自带"找不到即失明"护栏 ⇒ 照抄成 G9 即可，成本极低。② `apps/desktop/src-tauri/src` 全树 grep `rotate|retention|remove_file` **零命中**，日志无保留期；上游 `logRetention.ts:41-98` 启动裁 14 天、:24-32 用"日期回环"拒 `2026-02-30` 这类假日期。**不可照抄形态**：我方是单文件 `智汇AI.log`，须按 mtime+size 而非按天切分；另记上游一条陷阱——`copyFileSync` 会把 mtime 改成复制时刻，按 mtime 做 retention 会误删较新件（其 `desktopCrashCapture.ts:99-101` 用 `utimesSync` 还原），适用我方任何"复制 + 按 mtime 清理"的归档器。
```

- 原 L6776(L1 外部持有行 L15684):

```
- [ ]【【归并】重复登记副本·双前缀畸形号(2026-09-28):行首那个号是改派工具把前缀又贴一次造出来的,尺子按它取不出主键,于是同一件事被算成两个标题;这份是并集重放带回的折叠前形态。同题登记的持有行是「技能与项目层配置的键白名单可落地；归属：cliskills+conf」那一条(按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。】 **技能与项目层配置的键白名单（可落地；归属：cli skills + config 持有人）** —— ① 第 3 层 `<cwd>/.ihui/settings.json` 经 `apps/cli/src/config/index.ts:56-69` **零键过滤、零枚举校验**，`permissionMode`/`allowDangerous` 同层可达；今天不构提权**只因为** `.gitignore:150` 的 `.ihui/*` 一行 ⇒ **防线在一行 ignore，不在判据里**。② `SkillFrontmatter`（`packages/types/src/agent-runtime.ts:206-228`）无权限键、`getAllowedTools` 生产面**零调用方**（与上游 `safeToAutoLoad` 同型惰性：唯一消费者是 CLI 打印），而 `apps/cli/src/skills/index.ts:31` 注释仍写"（可选,工具白名单）"= **名字承诺而实现未兑现**，正是 `check-digest-name-reality` 的对象。③ 可抄的一条硬知识：插件作用域扫描**一律不跟随符号链接/junction**（根、子目录候选、SKILL.md 三粒度全拒），我方 `skills/index.ts:421-445` 目前靠 `Dirent.isDirectory()` 对链接返 false **偶然**不跟随，无注释无判据。**不得**为消红去把注释改成"已实现"。
```

- 原 L6777(L1 外部持有行 L15685):

```
- [ ]【【归并】重复登记副本·双前缀畸形号(2026-09-28):行首那个号是改派工具把前缀又贴一次造出来的,尺子按它取不出主键,于是同一件事被算成两个标题;这份是并集重放带回的折叠前形态。同题登记的持有行是「"文档表↔判据名"双向对账缺口可落地；归属：守门89持有人——89现」那一条(按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。】 **"文档表 ↔ 判据名"双向对账缺口（可落地；归属：守门 89 持有人）** —— 89 现判 R4（有码无文）与 R5（撞号），**不判"文档列了而 runner 没有"**。已现量的三处待配对：① 上游 `rule-catalog.md` 12 行 ↔ 其 `index.mjs` 12 个 `rule:` 字面量今天零漂移，而我方无同类表；② 端口三副本 `docs/port-management.md §2 ↔ dev-port-registry.json ↔ check-port-registry.mjs`，后者手抄 `REGISTERED_PORTS` 且注释自陈同步却不读 JSON（今天未漂移：JSON 9 枚 ⊆ Set 51 枚，docs 侧从未参与比较）；③ `docs/UI_GUIDELINES.md §3.1 角色↔px ↔ RADIUS_ROLES`（守门 150 判代码不判文档，而 AGENTS 自记"§3.1 曾差一档、照文档写必错"）。上游另有一条值得抄的**散文纪律**：`do not duplicate its rules in this file or in AGENTS.md`——用"禁止复制"消除漂移面，而我方靠"现值一律现读"这句话（正是本节反复失效的那类约束）。
```

- 原 L6778(L1 外部持有行 L15686):

```
- [ ]【【归并】重复登记副本·双前缀畸形号(2026-09-28):行首那个号是改派工具把前缀又贴一次造出来的,尺子按它取不出主键,于是同一件事被算成两个标题;这份是并集重放带回的折叠前形态。同题登记的持有行是「第3波待办覆盖面本身，不是功能票——未读名单已报名，按此接手：app」那一条(按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。】 **第 3 波待办（覆盖面本身，不是功能票）** —— 未读名单已报名，按此接手：`apps/zcode-cli/packages/core/src/{tool/handlers 120, runtime/methods 98, runtime/helpers 53, subagent 22, workflow 31, hooks 17, context 12, memory 10, browser-client 7}`；`packages/desktop/src/main/index.ts`(2384，装配主入口) + 遥测/ARMS 族 + `processResource*` 13；`packages/ui/src/lib` 剩余 workspace 22/task 21/provider 15/telemetry 9/tool 9；`packages/ui/src/v4`（W2-8 在报）；`packages/services/src` 剩余 14（`conversationShare*` 3、`settingsSync` 2、`commandsService` 1004、`memoryService`、`fsFaultInjection` 等）；`packages/zcode-server-cli/src` 剩余 41；`packages/web` 17。**另有两格结构空白**：`packages/app/src/features/**` 不在守门 128 的配对源里（同族第三份活实现改了像素不移动任何读数），`*.module.css` / CSS-in-JS 形态尚未测量——不得读成"已确认没有"。
```

- 原 L6792(L1 外部持有行 L15687):

```
- [ ] **双重执行**(两次 LLM、两遍工具副作用),比占位错误更坏;改成消费返回值必须与把手面登记同枚提交,而那三个文件此刻由他人持有。补丁形态已写在代理交付报告里(`handoff = await take_loop_v2_handoff(…); if handoff is not None: return AgentStepResult(**handoff.step_result); guard_loop_v2_pilot(…)`),**归属:ai-service 编排线持有人**。**同轮量到的一条既有事实(接线那票必须一并拍板)**:`AgentLoopV2.run()` 在 completed/error/max_iterations 后**无条件** fire-and-forget `meta_learner.evaluate_and_record`,它用**真实 `llm_gateway`** 再发一趟 LLM 并经 `KeyPoolSelector → get_shared_pool` 触生产 PG,同一份代码两次跑出 0 次与 3 次连接池触碰(实测非确定性);收敛档一旦真接上,**每次编排都会多一次计费 LLM 调用 + 一次落库**。本票测试里显式掐掉它并留了活的连接池哨兵。另:`progress_callback` 在新链路是循环结束后按真实顺序回灌、不是实时(旧路径跑一步发一次),没拿它冒充实时。 (原行首编号在此留原文) 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6800(L1 外部持有行 L8054):

```
- [ ] **上述②的两格"审面根因"分别是独立一票,现各写清归属与解阻前置**:① **守门 57 的清单计数只看台账、不看归档件**(它 `checkBaseline` 的 `entryCount` 有一部分来自台账里 `data.planSource.taskLinePattern` 匹配的 D 族行)⇒ 正解是把审面改成"台账 ⊕ 同面归档件"(`git ls-tree HEAD` / 索引列目录,照**门 71 的归档豁免**与**门 13c 的 A2/A3 同面取材**那两个先例抄,不得 `readdirSync`),基线一律不动;本票已派子代理做,落地判据 = 私有索引端到端两臂(台账摘掉而归档件同字在 ⇒ rc=0;两侧都摘 ⇒ rc=1 并点名)。② **取号只看台账面的 max**(`lib/plan-task-index.mjs` 的 `usedIdsOfPrefix` 只看被审的 `PROJECT_PLAN.md`)⇒ 归档后同一个号会被再发一次,这是①的同族、量纲不同(号段单调性 vs 计数存续)。它**此刻被他人持有**(`scripts/lib/plan-task-index.mjs` 与 `scripts/plan-tasks.mjs` 工作树各有在飞改动,本会话按 §12 边界未动),**解阻前置**=那两文件的在飞改动入库后,由同一持有人把 `usedIdsOfPrefix` 扩成"台账 ⊕ 归档件"或给 `live-doc-edit` 的令牌加一道"号已在归档面出现过 ⇒ 继续往上取"的复核;不得由旁路会话按 pathspec 交工作树版本(那会把别人的在飞改动整批写回旧态)。〔编号改派留痕(2026-09-28):原 G-362「桌面端「启动后先进托盘」在真机采样里出现过一次」 与另一条先入的登记撞成一号两事,按"后来者改号"由 live-doc-edit 的取号令牌在每次 CAS 里按当下 HEAD 现算;正文一字未动。〕 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6805(L1 外部持有行 L15577):

```
- [ ]〔【归并】重复登记副本(2026-09-28,幂等折叠):这一行与同题的持有行是同一件事,持有行是「门 8 清账后遗留的三枚"有消费方的待实装路由"…」那一条待办(按标题前缀寻行;指针里既不写编号也不写行号 —— 写了编号就会被台账取成这条副本自己的主键,折叠反而新增撞号,这是今天实测到的成因)。本行摘掉编号、只留指针,不翻勾、不并抄、正文逐字保留。〕 **G-1018258. 门 8 清账后遗留的三枚"有消费方的待实装路由"(2026-09-28 登记,现读=基线仅剩 3 处)**:① `GET /api/subagents/all` —— 消费者 `apps/web/app/(main)/agent-teams/page.tsx:58`(期望 `{dispatches}` 含 completed/failed/cancelled 全量);后端只有 `/subagents/active`(仅 pending/running,形状恰好相同但语义是子集,**不得**为省事把客户端改道 active —— 那会把"页面少了历史"写成"已修")。正解 = 在 `subagent-dispatch.ts` 补 all 列表路由(带 status/limit 透传)。②③ `PUT /api/ai/n8n/workflows/:id` 与 `POST .../toggle` —— 消费者 `apps/mobile-rn/src/screens/N8nModelScreen.tsx:146/192`(保存改名/启停今天必 404);后端 n8n 面只有列表透传与创建转发(miniapp-compat-routes.ts:1123/1190),n8n REST API 本身支持 workflows/:id 更新与 activate/deactivate,正解 = 在 n8n 代理补两枚透传(SSRF 校验与 env 缺省回 stub 的既有纪律照抄)。验收判据:两枚消费者页面真机/真会话各跑一次成功路径 + 基线 `scripts/api-routes-baseline.json` 清零 + 门 8 末行现读 0。**归属**:subagent 面 = agent-teams 线;n8n 两面 = n8n 代理持有人(本票只登记形状与消费者证据,不代裁实现位置)。 〔落地@2026-09-28/枚 2704c4d27〕三枚路由已入库:subagents/all(新→旧+status/limit)、/ai/n8n/workflows 面四枚(list stub/写 503/fetch-merge-put/toggle 回读真值);apps/api/tests/g299-new-routes.test.ts 4 例绿、门 8 死调用清零、基线 perFileCount 清表。**本票未翻勾的唯一理由=验收判据第一条未跑**:RN N8nModelScreen 真机走查(本机无设备)与 agent-teams 页真会话 200 取证(需起栈)——路由与契约已证,运行时成功路径待验,不得以单测冒充真机。（编号改派留痕:本行原登记为「G-299. 门 8 清账后遗留的三枚…」,与「本机交付被远端分支保护拒收」撞成一号两事;2026-09-28 由 live-doc-edit 的取号令牌在每次 CAS 里按当下 HEAD 现算改派为 G-312,旧编号在此留原文,便于任何按旧号引用的人查得到去向,而不是让它静默消失） —— 沿革:G-299→G-312→G-334(两次都被别的登记占去,每次都在行尾留原文)。**[重复登记副本]** 同一件事在 origin 侧以「G-316. 门 8 清账后遗留的三枚…」另登过一次,当前状态持有行按那条走,本行不翻勾、不并抄。 (原编号 G-334) 〔让号记录(2026-10-02 F9 清偿批②):原号 G-334 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕
```

- 原 L6940(L1 外部持有行 L15689):

```
- [ ] **A1 改道校验只比大小不比内容（可立即修；归属：§26 C 盘改道线，本票持有人即我）** —— 见上文 A1 与现读落点。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6941(L1 外部持有行 L15690):

```
- [ ]【【归并】重复登记副本·双前缀畸形号(2026-09-28):行首那个号是改派工具把前缀又贴一次造出来的,尺子按它取不出主键,于是同一件事被算成两个标题;这份是并集重放带回的折叠前形态。同题登记的持有行是「A2deploy-lock未来时间戳使锁龄恒0可立即修；归属：部署锁」那一条(按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。】 **A2 deploy-lock 未来时间戳使锁龄恒 0（可立即修；归属：部署锁持有人）** —— 见 A2；这条与 G-193 是同一根，不修就等于"下次冻结只是时间问题"。
```

- 原 L6942(L1 外部持有行 L15691):

```
- [ ]【【归并】重复登记副本·双前缀畸形号(2026-09-28):行首那个号是改派工具把前缀又贴一次造出来的,尺子按它取不出主键,于是同一件事被算成两个标题;这份是并集重放带回的折叠前形态。同题登记的持有行是「A3sso/mobile-auth的redirect未过origin」那一条(按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。】 **A3 sso/mobile-auth 的 redirect 未过 origin 守卫（可立即修；归属：web 鉴权出口持有者）** —— 见 A3；同参数三处已守卫、一处裸用。
```

- 原 L6943(L1 外部持有行 L15692):

```
- [ ]【【归并】重复登记副本·双前缀畸形号(2026-09-28):行首那个号是改派工具把前缀又贴一次造出来的,尺子按它取不出主键,于是同一件事被算成两个标题;这份是并集重放带回的折叠前形态。同题登记的持有行是「A4+A10两处"注释承诺而未兑现"待我复验后落地——名称档码元截断」那一条(按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。】 **A4+A10 两处"注释承诺而未兑现"（待我复验后落地）** —— 名称档码元截断产孤立代理对；权限确认弹窗被 `localStorage==='1'` 永久压制 + 偏好档位只写不读。
```

- 原 L6945(L1 外部持有行 L15693):

```
- [ ]【【归并】重复登记副本·双前缀畸形号(2026-09-28):行首那个号是改派工具把前缀又贴一次造出来的,尺子按它取不出主键,于是同一件事被算成两个标题;这份是并集重放带回的折叠前形态。同题登记的持有行是「W4-W7四波覆盖票每波一票，交付判据见上——派单前先看登记表rem」那一条(按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。】 **W4-W7 四波覆盖票（每波一票，交付判据见上）** —— 派单前先看登记表 `remaining` 名单，勿凭记忆切范围。
```

- 原 L6948(L1 外部持有行 L15860):

```
- [ ] `config/architecture-policy.yaml` 目前 0 个模块 `managed:true` —— 渐进收口的第一块翻正面尚未选定。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L6960(L1 外部持有行 L15577):

```
- [ ]〔【归并】重复登记副本(2026-09-28,幂等折叠):这一行与同题的持有行是同一件事,持有行是「门 8 清账后遗留的三枚"有消费方的待实装路由"…」那一条待办(按标题前缀寻行 —— 指针里既不写编号也不写行号:编号落在正文前 48 字符内会被台账取成本行的主键,折叠反而新增撞号)。本行摘掉编号、只留指针,不翻勾、不并抄、正文逐字保留。〕 **G-1018259. 门 8 清账后遗留的三枚"有消费方的待实装路由"(2026-09-28 登记,现读=基线仅剩 3 处)**:① `GET /api/subagents/all` —— 消费者 `apps/web/app/(main)/agent-teams/page.tsx:58`(期望 `{dispatches}` 含 completed/failed/cancelled 全量);后端只有 `/subagents/active`(仅 pending/running,形状恰好相同但语义是子集,**不得**为省事把客户端改道 active —— 那会把"页面少了历史"写成"已修")。正解 = 在 `subagent-dispatch.ts` 补 all 列表路由(带 status/limit 透传)。②③ `PUT /api/ai/n8n/workflows/:id` 与 `POST .../toggle` —— 消费者 `apps/mobile-rn/src/screens/N8nModelScreen.tsx:146/192`(保存改名/启停今天必 404);后端 n8n 面只有列表透传与创建转发(miniapp-compat-routes.ts:1123/1190),n8n REST API 本身支持 workflows/:id 更新与 activate/deactivate,正解 = 在 n8n 代理补两枚透传(SSRF 校验与 env 缺省回 stub 的既有纪律照抄)。验收判据:两枚消费者页面真机/真会话各跑一次成功路径 + 基线 `scripts/api-routes-baseline.json` 清零 + 门 8 末行现读 0。**归属**:subagent 面 = agent-teams 线;n8n 两面 = n8n 代理持有人(本票只登记形状与消费者证据,不代裁实现位置)。 〔落地@2026-09-28/枚 2704c4d27〕三枚路由已入库:subagents/all(新→旧+status/limit)、/ai/n8n/workflows 面四枚(list stub/写 503/fetch-merge-put/toggle 回读真值);apps/api/tests/g299-new-routes.test.ts 4 例绿、门 8 死调用清零、基线 perFileCount 清表。**本票未翻勾的唯一理由=验收判据第一条未跑**:RN N8nModelScreen 真机走查(本机无设备)与 agent-teams 页真会话 200 取证(需起栈)——路由与契约已证,运行时成功路径待验,不得以单测冒充真机。（编号改派留痕:本行原登记为「G-299. 门 8 清账后遗留的三枚…」,与「本机交付被远端分支保护拒收」撞成一号两事;2026-09-28 由 live-doc-edit 的取号令牌在每次 CAS 里按当下 HEAD 现算改派为 G-312,旧编号在此留原文,便于任何按旧号引用的人查得到去向,而不是让它静默消失） —— 沿革:G-299→G-312→G-334(两次都被别的登记占去,每次都在行尾留原文)。**[重复登记副本]** 同一件事在 origin 侧以「G-316. 门 8 清账后遗留的三枚…」另登过一次,当前状态持有行按那条走,本行不翻勾、不并抄。 (原编号 G-334) 〔让号记录(2026-10-02 F9 清偿批②):原号 G-334 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕
```

- 原 L7015(L1 外部持有行 L15758):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L9959(G-417) 同题,派单以持有行为准,本行不再单独派单。〕 G-1018287 **全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红,登记以免被"修好我看见的那三道"再掩一次** —— ① 守门 [12] 交付报告一致性判 `PROJECT_PLAN.md` 自身违规 1 处:同一份账面里既写着"完整收尾/无后续建议"一类断言,又留着"后续工作/优化项"清单(AGENTS §10 那条互斥约束)。它在全量档是 warn、不挡提交,但它是**批量审计恒红清单**里的一项,留着就会有人天天来问"这红谁的"。出路只有两条且不得放宽判据:要么把该份报告改成"任务 X 已完成、还有 N 项后续"(推荐,因为活账确实还有),要么真把后续条目清干净再声明闭环。归该份批次报告的作者;现读定位:`node scripts/check-delivery-report-consistency.mjs`。② 同日实测的并发副作用登记:多会话同时提交时(本轮实测单窗口 27–47 枚),守门 [30a] 会把**别人重写提交留下的悬空对象**算在本次提交头上、[84] 会把**别人挂在共享索引里的暂存删除**报成待判 —— 两者本轮都已按仓里规定动作处置(悬空提交 `cf05a98386` 已 `git tag lost-commit/cf05a983` 备份并复跑 30a rc=0,其内容经祖先判据确认**已在主线**,零丢失;[84] 复跑 rc=0 并把那条暂存删除点名交回其持有人)。**留这一格是因为它没有判据**:目前没有任何一道门区分"本次引入的悬空"与"并发重写留下的同内容副本",而这型一旦攒多了就是 §22 那类丢 commit 事故的温床。③ 同轮只读量测的第三格(本机**此刻不成立**,故不是待修而是待防):六把常驻命令行工具在"调用方 cwd 不在仓库内"时仍都能解析到仓库(本机 `.git` 是指针文件,git 会向上找),所以依赖 cwd 的那一处今天没有实害;但 `scripts/union-converge.mjs` 与 `scripts/git-push-converge.mjs` **写死** `C:/Program Files/Git/cmd/git.exe`,而仓里已有唯一出口 `scripts/lib/gitdir.mjs`(§5b 明写"脚本一律不得依赖环境取 git"),另一台机(G 盘那份 checkout)实测 git 落点不同 ⇒ 换机即 ENOENT。`git-push-converge.mjs` 同时是唯一不按自身位置推根的一把(换个目录跑结论会变)。**取证教训一条,写给下一个想顺手"修"的人**:我第一轮把这些工具的失败猜成"模块顶层数组引用后声明常量 ⇒ TDZ",现读**否证**(那三处在函数体内求值),真因是我自己的探针把 msys 风格路径拼成了不存在的目录 —— 0 命中/含糊错先怀疑尺子,再怀疑世界,别照假设改生产工具。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-417」,派单以那条为准,本行不再单独派单。〕 〔让号记录(2026-10-02 F9 清偿批②):原号 G-417 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕
```

- 原 L7111(L1 外部持有行 L7603):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-433 **配置分层的"出处标签"与"请求档 vs 实得档"留痕(归属:cli/子代理线持有人;等产品拍板)** —— 上游 `packages/provider/src/resolver.ts:190/196/208` 三层 overlay 且每个生效对象带 `source` 标签、快照的 `sourceRevisions` 被真实消费;我方 `apps/cli/src/subagents/precedence.ts:195-205` 的四层短路链**没有出处标签**,且 `git grep -I "requestedEffort\|effectiveEffort\|validateModelSelection"` HEAD 面现读 **0 命中** ⇒ 静默降档无法归因。**为什么还开着**:新建"配置分层解析出口"属 §24 新增能力、且是跨端数据建模,不在本轮取证范围;上游那两格(`effective-model-selection.ts` 的 `selectionIssue` 六值枚举、`model-selection-config.ts:76-77`"不能静默补档位")是它的前置形状,可作参考实现但不是本轮交付物。 (原行首编号 G-G-356 系改派工具把前缀重复贴了一次:尺子会把它读成 G-356 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4/F10 —— 现取新号,正文逐字未动) (原编号 G-433;持有行题面「配置分层的"出处标签"与"请求档vs实得档"留痕」)
```

- 原 L7112(L1 外部持有行 L15671):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-434 **非会话 401 被当成会话死亡(需拍板,会改用户可见语义)** —— `apps/api/src/routes/agent-extended.ts:202` 现读 `statusCode ?? 401`,第三方 key 填错也以 401 出栈;而 `packages/api-client/src/client.ts:654/701` 只按 `isAuthEndpoint` 排除 ⇒ 用户看到的是"你要重新登录",而真实原因是"别人家的凭据错了"。归属:api 鉴权面 + api-client 两侧持有者。**为什么还开着**:收紧改变前端可见行为(弹登录框),按纪律属对外语义决策,不得由取证票自行落地。 (原行首编号 G-G-357 系改派工具把前缀重复贴了一次:尺子会把它读成 G-357 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4/F10 —— 现取新号,正文逐字未动) (原编号 G-434;持有行题面「非会话401被当成会话死亡」)
```

- 原 L7113(L1 外部持有行 L7605):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-435 **锁的"租约认 token 不认 pid"一格只登记、未代裁(归属:`git-lock`/`deploy-lock` 持有人)** —— 上游 `packages/provider-node/src/zcode-builtin-remote-synchronizer.ts:85` 取 `leaseId=randomUUID`、`:143` 的 `#finishLease` 只在 leaseId 相等时才改控制文件,于是"pid 被系统复用"这一型**结构上不可能发生**;而我方是事后补的一环(`scripts/lib/proc-identity.mjs` 的 match/mismatch/unverifiable,承 G-193 那次冻结 11h50m)。**为什么还开着**:改两处锁的 meta 属锁持有人领地,且今天没有可复现的抢占现场做验收依据;真要收它,判据应是"注入一次 leaseId 不相等的迟到 finish 请求,控制文件必须不被改动",而不是"代码写了 leaseId"。 (原行首编号 G-G-358 系改派工具把前缀重复贴了一次:尺子会把它读成 G-358 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4/F10 —— 现取新号,正文逐字未动) (原编号 G-435;持有行题面「锁的"租约认token不认pid"一格只登记」)
```

- 原 L7114(L1 外部持有行 L7606):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-436 **第八轮剩余六格候选清单(归属:未派;等各线排期;本轮只取证未实现,逐格带出处)** —— ① 跨层发布闸:上游 `registry-service.ts:205-212` 在"下层已变而上层仍基于旧事实"时**不发混合快照**、继续服务上一份完整 Registry,而我方这条纪律只活在门的散文里、运行时层无出口;② 稀疏 overlay 空即删:`config-service.ts:513-516` 与继承值等价的配置不落盘(absence=继承,不是"空覆盖");③ 诊断量代替原文:`officialMcpCredentials.ts:52-90/359-376` 只记 JWT 剩余秒数并按小时分桶去重,可接我方唯一脱敏出口 `packages/shared/src/utils/redact.ts`;④ 告警去重身份=桶+周期而非墙钟窗口:`startPlanQuotaReminderStore.ts:33-36` 用快照 `referenceTime` 裁决(设备时间可能已越过服务端周期)、`bucketReminderKey` 缺任一字段即不提醒;⑤ in-flight 合并 + CAS 驱逐:`zaiStartPlanBilling.ts:113-122` 失败响应同样保留 1s(防 429 后立刻重复请求)且驱逐前 `if (requests.get(k) !== request) return`(旧请求不得删新记录),上游该守卫三处同形,是我方共享工作区并发写可直接取用的最小实现;⑥ 幂等 key 复用规则:`codingPlanQuotaResetCoordinator.ts:307-329` 瞬时错复用原 key、成功或稳定错才置 null,且服务端 `next_try_at` 必须透传(:617-624)。**为什么还开着**:六格都是"能落但需各自定级与验收"的独立改动(①②碰运行时快照语义、③④⑤⑥碰告警与并发路径),打包成一票会互相遮蔽;派单时逐格取,勿一次全接。**另有一格需产品先定**:上游 `usage-quota.ts:71` 的 `percentage` 是**已用**占比、而 Start Plan 侧 `:1338` 同名字段是**剩余/总额**,现靠"两族走不同 reader"规避,**无类型或判据看守** —— 要不要收口成"以 remaining 为权威、percentage 仅降级",属契约决策。 (原行首编号 G-G-359 系改派工具把前缀重复贴了一次:尺子会把它读成 G-359 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4/F10 —— 现取新号,正文逐字未动) (原编号 G-436;持有行题面「第八轮剩余六格候选清单」)
```

- 原 L7115(L1 外部持有行 L7607):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-437 **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 (原行首编号 G-G-373 系改派工具把前缀重复贴了一次:尺子会把它读成 G-373 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4/F10 —— 现取新号,正文逐字未动) (原编号 G-437;持有行题面「MCP工具被标成read⇒免批准+失败自动重跑」) 〔拍板 2026-10-05(机主选"未知即按写处理"):MCP 工具默认档不再算 `read` —— 需批准、失败不自动重跑;确实只读者按"服务器 + 工具名"显式登记白名单并把白名单纳入跨语言对账。落点在 `apps/cli/src/tools/hub/mcp-adapter.ts` 与权限档两侧持有人;派单排在 G-710 那枚同目录代理之后,避免两个代理同改一个文件〕
```

- 原 L7116(L1 外部持有行 L7608):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-438 **设置项"显式清空"与"从未设置"无差，且读侧同一含义两键相反（需拍板；归属：api 设置面 + web 设置页持有人）** —— 已亲自复验：`apps/api/src/routes/user/settings-routes.ts:55` 写体是 `z.record(z.string(), z.unknown())`，落库处 `value === null || value === undefined ? null : String(value)` ⇒ `null` 与"缺席"存成同一个 NULL 行；读侧 `apps/web/app/(main)/settings/notifications/page.tsx:48-52` 四键混用 `!== 'false'`（默认真）与 `=== 'true'`（默认假），于是**同一个被清空的值，在前一族读回 true、在后一族读回 false**。上游同族做法是把三态写进契约（`settings/pluginConfigPatch.ts:29-36`：`undefined`=未触碰跳过、`null`=进 `clearOptionKeys`、sensitive 空串=不改已有值；落库侧 `file-config.adapter.ts:557-565` 按 option key 合并而非整对象替换，防同 scope 密钥被静默清空）。**为什么还开着**：改成三态要动 PUT 语义（单键 DELETE 出口我方根本没有——`deleteUserPreference` 只服务 devices），属对外契约决策；先拍"要不要有删键出口"，再谈读侧归一。**不得**靠"读侧统一成 `=== 'true'`"消红——那会把默认真的四项静默翻转。 (原行首编号 G-G-374 系改派工具把前缀重复贴了一次:尺子会把它读成 G-374 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4/F10 —— 现取新号,正文逐字未动) (原编号 G-438;持有行题面「设置项"显式清空"与"从未设置"无差」)
```

- 原 L7117(L1 外部持有行 L15679):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-439 **cache token 过了服务端、没上客户端边界，三处消费端硬编码 null（可落地；归属：api-client + 三端上下文用量组件）** —— `packages/api-client/src/client.ts` 的 usage 解析只取 prompt/completion/total/reasoning（无 cache 字段），于是 `apps/web/src/components/ai/context-usage-ring.tsx:371`、`packages/app/src/features/chat/ContextUsagePanel.tsx:87`、`apps/miniapp-taro/src/pkg-ai/ai/context-usage-strip.tsx:74` 三处一律 `cacheReadTokens: null`，而 `context-usage-ring.tsx:759` 仍把这一档渲染成"读取 …"——**界面显示的是一个恒为 null 的字段**。服务端侧 `apps/ai-service/app/core/usage_cache.py` 已有双协议别名表，即数据源在、断在边界。修法向后兼容（加字段，缺值仍不渲染＝不判绿）。**判据缺口同记**：守门 112 对它两重失明（`SCAN_ROOTS` 不含 `packages/*`；`DENOMINATOR_NAME_RE` 只认 `context*` 前缀，`maxTokens` 整族隐身）。 (原行首编号 G-G-375 系改派工具把前缀重复贴了一次:尺子会把它读成 G-375 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4/F10 —— 现取新号,正文逐字未动) (原编号 G-439;持有行题面「cachetoken过了服务端」)
```

- 原 L7118(L1 外部持有行 L15680):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-440 **瞬时假值覆盖上一个可信值：上下文占用把"短暂 0"当"真的清空"（可落地；归属：web 首页/上下文条持有者）** —— `apps/web/src/components/chat/context-budget-bar.tsx:81-84` 只在 `!== undefined` 上守卫，收到 `used=0` 就渲染 0%；上游同型问题的处置是"普通工具调用期间 agent 会短暂发 used=0，这不是 context 真被清空"，并**逐项列出例外**（`/compact`、`/compress` 那一次 0 才是真话，见其 `zcodeTaskUsageFallback.ts:44-47,60-73`）。与我方 §30"没有终态不得写完成"、守门 135"身份不得从文案重建"同族。成本低（一处投影函数 + 一份成文例外表），但例外表**必须可判**，不得写成散文。 (原行首编号 G-G-376 系改派工具把前缀重复贴了一次:尺子会把它读成 G-376 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4/F10 —— 现取新号,正文逐字未动) (原编号 G-440;持有行题面「瞬时假值覆盖上一个可信值」)
```

- 原 L7119(L1 外部持有行 L15681):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-441 **影子副本门没有目录枚举（可落地；归属：守门 prod-bundle 影子对账持有人）** —— `scripts/check-prod-bundle-shadow.mjs` 现读 `readdirSync` **0 次**，只比登记表里的对 ⇒ 一个未登记的脚本躺在 `deploy/prod-bundle/` 时本门全盲，而 §5e 的原话正是"落进 prod-bundle 的运维脚本必须同时落入库源，否则等于写进盲区"。上游同族做法把三件事同立：整棵树哈希（含 mode、排序、排除自身 integrity 文件）+ 清单逐字节验 + `reviewRequired` 非空直接抛。**注意定级方向**：它那套是 fail-closed 且只挂发布路径不挂提交链，与我方"台账只报数防恒红"（§12e）是同一条纪律的两侧——要抬的是**枚举面**，不是把判红搬到提交链上。 (原行首编号 G-G-377 系改派工具把前缀重复贴了一次:尺子会把它读成 G-377 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4/F10 —— 现取新号,正文逐字未动) (原编号 G-441;持有行题面「影子副本门没有目录枚举」)
```

- 原 L7120(L1 外部持有行 L15682):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-442 **棘轮锚点把量值编进指纹 + `--changed` 不沿反向依赖（可落地；归属：守门 77/83/103 与门 118 那族）** —— 上游 `scripts/architecture/index.mjs` 的 `fingerprint(rule, file, detail)` 把**行数**当 detail，401 行涨到 500 会换指纹、被判"新违规"；我方锚点是"该文件违规**处数**"，500→5000 行名额不动。另它的 `--changed` 走反向依赖闭包（改一份被 40 处 import 的契约，那 40 处算这次头上），而我方 `PUSH_SCOPE_FILES`/`stagedTriggers` 都是路径前缀 ⇒ **改契约不红 importer**（门 103 已有 import 图，成本中）。两条都是"锚点粒度不够细 ⇒ 换个写法就净零逃逸"的同族，改法不得顺手扩成恒红。 (原行首编号 G-G-378 系改派工具把前缀重复贴了一次:尺子会把它读成 G-378 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4/F10 —— 现取新号,正文逐字未动) (原编号 G-442;持有行题面「棘轮锚点把量值编进指纹+--changed不沿反」)
```

- 原 L7121(L1 外部持有行 L15683):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-443 **桌面侧两格：整页导航绕过"存草稿"闸 + 日志无保留期（可落地；归属：desktop 端持有人）** —— ① `apps/desktop/src-tauri/src/lib.rs:2766` 在 `CloseRequested` 无条件 emit `desktop-before-close`（注释："三种去向都照发…先存草稿"），但 `auto_refresh.rs:275/318/347/366/394` 五处 `eval("location.reload()"/"location.href=")` 全部绕过；我方 `scripts/check-desktop-event-wiring.mjs` 的 **G8**（:470、:682-701）已经把"本文件的整页导航发起点"枚举成判据并自带"找不到即失明"护栏 ⇒ 照抄成 G9 即可，成本极低。② `apps/desktop/src-tauri/src` 全树 grep `rotate|retention|remove_file` **零命中**，日志无保留期；上游 `logRetention.ts:41-98` 启动裁 14 天、:24-32 用"日期回环"拒 `2026-02-30` 这类假日期。**不可照抄形态**：我方是单文件 `智汇AI.log`，须按 mtime+size 而非按天切分；另记上游一条陷阱——`copyFileSync` 会把 mtime 改成复制时刻，按 mtime 做 retention 会误删较新件（其 `desktopCrashCapture.ts:99-101` 用 `utimesSync` 还原），适用我方任何"复制 + 按 mtime 清理"的归档器。 (原行首编号 G-G-379 系改派工具把前缀重复贴了一次:尺子会把它读成 G-379 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4/F10 —— 现取新号,正文逐字未动) (原编号 G-443;持有行题面「桌面侧两格」)
```

- 原 L7122(L1 外部持有行 L15684):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-444 **技能与项目层配置的键白名单（可落地；归属：cli skills + config 持有人）** —— ① 第 3 层 `<cwd>/.ihui/settings.json` 经 `apps/cli/src/config/index.ts:56-69` **零键过滤、零枚举校验**，`permissionMode`/`allowDangerous` 同层可达；今天不构提权**只因为** `.gitignore:150` 的 `.ihui/*` 一行 ⇒ **防线在一行 ignore，不在判据里**。② `SkillFrontmatter`（`packages/types/src/agent-runtime.ts:206-228`）无权限键、`getAllowedTools` 生产面**零调用方**（与上游 `safeToAutoLoad` 同型惰性：唯一消费者是 CLI 打印），而 `apps/cli/src/skills/index.ts:31` 注释仍写"（可选,工具白名单）"= **名字承诺而实现未兑现**，正是 `check-digest-name-reality` 的对象。③ 可抄的一条硬知识：插件作用域扫描**一律不跟随符号链接/junction**（根、子目录候选、SKILL.md 三粒度全拒），我方 `skills/index.ts:421-445` 目前靠 `Dirent.isDirectory()` 对链接返 false **偶然**不跟随，无注释无判据。**不得**为消红去把注释改成"已实现"。 (原行首编号 G-G-380 系改派工具把前缀重复贴了一次:尺子会把它读成 G-380 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4/F10 —— 现取新号,正文逐字未动) (原编号 G-444;持有行题面「技能与项目层配置的键白名单」)
```

- 原 L7123(L1 外部持有行 L15685):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-445 **"文档表 ↔ 判据名"双向对账缺口（可落地；归属：守门 89 持有人）** —— 89 现判 R4（有码无文）与 R5（撞号），**不判"文档列了而 runner 没有"**。已现量的三处待配对：① 上游 `rule-catalog.md` 12 行 ↔ 其 `index.mjs` 12 个 `rule:` 字面量今天零漂移，而我方无同类表；② 端口三副本 `docs/port-management.md §2 ↔ dev-port-registry.json ↔ check-port-registry.mjs`，后者手抄 `REGISTERED_PORTS` 且注释自陈同步却不读 JSON（今天未漂移：JSON 9 枚 ⊆ Set 51 枚，docs 侧从未参与比较）；③ `docs/UI_GUIDELINES.md §3.1 角色↔px ↔ RADIUS_ROLES`（守门 150 判代码不判文档，而 AGENTS 自记"§3.1 曾差一档、照文档写必错"）。上游另有一条值得抄的**散文纪律**：`do not duplicate its rules in this file or in AGENTS.md`——用"禁止复制"消除漂移面，而我方靠"现值一律现读"这句话（正是本节反复失效的那类约束）。 (原行首编号 G-G-381 系改派工具把前缀重复贴了一次:尺子会把它读成 G-381 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4/F10 —— 现取新号,正文逐字未动) (原编号 G-445;持有行题面「"文档表↔判据名"双向对账缺口」)
```

- 原 L7124(L1 外部持有行 L15686):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-446 **第 3 波待办（覆盖面本身，不是功能票）** —— 未读名单已报名，按此接手：`apps/zcode-cli/packages/core/src/{tool/handlers 120, runtime/methods 98, runtime/helpers 53, subagent 22, workflow 31, hooks 17, context 12, memory 10, browser-client 7}`；`packages/desktop/src/main/index.ts`(2384，装配主入口) + 遥测/ARMS 族 + `processResource*` 13；`packages/ui/src/lib` 剩余 workspace 22/task 21/provider 15/telemetry 9/tool 9；`packages/ui/src/v4`（W2-8 在报）；`packages/services/src` 剩余 14（`conversationShare*` 3、`settingsSync` 2、`commandsService` 1004、`memoryService`、`fsFaultInjection` 等）；`packages/zcode-server-cli/src` 剩余 41；`packages/web` 17。**另有两格结构空白**：`packages/app/src/features/**` 不在守门 128 的配对源里（同族第三份活实现改了像素不移动任何读数），`*.module.css` / CSS-in-JS 形态尚未测量——不得读成"已确认没有"。 (原行首编号 G-G-382 系改派工具把前缀重复贴了一次:尺子会把它读成 G-382 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4/F10 —— 现取新号,正文逐字未动) (原编号 G-446;持有行题面「第3波待办」)
```

- 原 L7126(L1 外部持有行 L8049):

```
- [ ]【【归并】重复登记副本·双前缀畸形号(2026-09-28):行首那个号是改派工具把前缀又贴一次造出来的,尺子按它取不出主键,于是同一件事被算成两个标题;这份是并集重放带回的折叠前形态。同题登记的持有行是「plan-tasks-merge.mjs--dedupe-block」那一条(按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。】 **`plan-tasks-merge.mjs --dedupe-blocks` 的阈值覆盖不到"两行逐字相同的单行副本"这一型（现读实证：86H 那一条已完成行在 HEAD 面有 2 份逐字相同副本 —— 计数用 `git show HEAD:PROJECT_PLAN.md | grep -c "86H. agent 审批的权限决策落审计链"` = 2；按 §1 判据 3 不写行号，行号在 append 后必挪位）**：该出口只认 **≥3 行且每行 ≥40 字符的连续 bullet 块逐字相同**（阈值本身是对的 —— 低于它会把台账里天然成对的短行成百地报出来，噪声淹信号），于是"同一件事被写成两份、每份都是单行"恰好落在缝隙里；而 F1/F2/F4 也都不计它（四条判据里"待办副本"要求未勾形态，两份都已 `[x]` ⇒ 账面 0，`plan-tasks.mjs --staged` 现读 F 维全 0）。**这一型有两条候选制造路径(本票未定性,不得读成已归因)**:活文档 union 把改写前那份带回来;门 71 的 post-commit 自愈按标记回捞"丢失"的行 —— 若那一行其实是被**就地改写**(旧行已按 §1 留在原位、新行另处再写一份),回捞就会补出第二份。定性要跑一次可控复现(独立临时仓里"改写一行 → 触发自愈"看它补不补),不在本票顺手做。**在等谁**：归并器持有人裁 —— 出路只有两条且都要人拍：a) 给 `--dedupe-blocks` 加"同主键 + 逐字等值 + 已完成形态"的单行档（判据必须是**逐字等值**，半行不同就交人工，理由同它现有那条"机器折半即有损"）；b) 或在门 71 自愈侧改为"编号在面上已存在即不追加"（那是生产者侧收口，比事后清账更对，但要证明不会把真丢行也一并按住）。**不得**由本票手工删行：删已完成行受 §1"禁止无声删除"约束，而两份哪份作数要按主键而不是按行号（§1 判据 3 已把行号指针判为不可用作证据）。
```

- 原 L7130(L1 外部持有行 L7607):

```
- [ ]【【归并】重复登记副本·双前缀畸形号(2026-09-28):行首那个号是改派工具把前缀又贴一次造出来的,尺子按它取不出主键,于是同一件事被算成两个标题;这份是并集重放带回的折叠前形态。同题登记的持有行是「MCP工具被标成read⇒免批准+失败自动重跑需拍板；归属：cli权」那一条(按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。】 **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 〔拍板 2026-10-05(机主选"未知即按写处理"):MCP 工具默认档不再算 `read` —— 需批准、失败不自动重跑;确实只读者按"服务器 + 工具名"显式登记白名单并把白名单纳入跨语言对账。落点在 `apps/cli/src/tools/hub/mcp-adapter.ts` 与权限档两侧持有人;派单排在 G-710 那枚同目录代理之后,避免两个代理同改一个文件〕
```

- 原 L7131(L1 外部持有行 L7608):

```
- [ ]【【归并】重复登记副本·双前缀畸形号(2026-09-28):行首那个号是改派工具把前缀又贴一次造出来的,尺子按它取不出主键,于是同一件事被算成两个标题;这份是并集重放带回的折叠前形态。同题登记的持有行是「设置项"显式清空"与"从未设置"无差，且读侧同一含义两键相反需拍板；」那一条(按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。】 **设置项"显式清空"与"从未设置"无差，且读侧同一含义两键相反（需拍板；归属：api 设置面 + web 设置页持有人）** —— 已亲自复验：`apps/api/src/routes/user/settings-routes.ts:55` 写体是 `z.record(z.string(), z.unknown())`，落库处 `value === null || value === undefined ? null : String(value)` ⇒ `null` 与"缺席"存成同一个 NULL 行；读侧 `apps/web/app/(main)/settings/notifications/page.tsx:48-52` 四键混用 `!== 'false'`（默认真）与 `=== 'true'`（默认假），于是**同一个被清空的值，在前一族读回 true、在后一族读回 false**。上游同族做法是把三态写进契约（`settings/pluginConfigPatch.ts:29-36`：`undefined`=未触碰跳过、`null`=进 `clearOptionKeys`、sensitive 空串=不改已有值；落库侧 `file-config.adapter.ts:557-565` 按 option key 合并而非整对象替换，防同 scope 密钥被静默清空）。**为什么还开着**：改成三态要动 PUT 语义（单键 DELETE 出口我方根本没有——`deleteUserPreference` 只服务 devices），属对外契约决策；先拍"要不要有删键出口"，再谈读侧归一。**不得**靠"读侧统一成 `=== 'true'`"消红——那会把默认真的四项静默翻转。
```

- 原 L7132(L1 外部持有行 L15689):

```
- [ ]【【归并】重复登记副本·双前缀畸形号(2026-09-28):行首那个号是改派工具把前缀又贴一次造出来的,尺子按它取不出主键,于是同一件事被算成两个标题;这份是并集重放带回的折叠前形态。同题登记的持有行是「A1改道校验只比大小不比内容可立即修；归属：§26C盘改道线，本票持」那一条(按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。】 **A1 改道校验只比大小不比内容（可立即修；归属：§26 C 盘改道线，本票持有人即我）** —— 见上文 A1 与现读落点。
```

- 原 L7133(L1 外部持有行 L15701):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11128(G-453) 同题,派单以持有行为准,本行不再单独派单。〕 G-210 **台账 F4(重复登记副本)对"同一待办的漂移副本"结构上失明 —— 现读一例:同一条 D41后续① 在 HEAD 有 9 份未勾选副本、其中 7 份正文互不相同(2026-09-28 量)**: `plan-tasks.mjs` 的 F1/F4 判据是"编号 + 标题前缀**逐字等值**",这既是它的优点(不做相似度猜判)也是它的洞 —— 并发 union 每次都留一份**带自己注记**的副本,前缀之后的正文一漂移,复合主键就不再相等,于是同一件事以 N 份"未勾选"长期并存。后果不是账面难看而是**派单被放大 N 倍**:本日两次 `plan-tasks-merge.mjs --heal --commit`(归并 30 行 / 34 行)把 F1/F4 都归到 0,而这一族一份都没被动到 ⇒ "跑过归并"不等于"这一族被覆盖"。出路只有两条且都不该由机器代裁:① 归并线逐组判"哪份是当前状态"(需要读注记语义,机器判不了);② 给登记侧加一条硬约束——同一件事要更新就**就地改那一条**(§1 第 2 条已有此规矩,缺的是让机器能在前缀一致而正文漂移时也点名)。本票**只登记现读证据与两条出路**,不改判据、不批量翻勾(批量翻勾 = 把别人的注记当噪声删,比原病更响)。归属:分叉合并归并线(同 G-363 那条持有)。 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「G-417」,派单以那条为准,本行不再单独派单。〕〔让号记录(2026-10-09 F9 清偿批⑤·机主拍板"代码引证与改动面大小冲突时以代码引证为准"):原号 G-417 同号多题,代码引证(scripts/lib/plan-task-index.mjs 与 scripts/plan-tasks.mjs 把 G-417 当 F9 判据出处引用)锚定「全量守门盘点」侧 ⇒ 本族(台账 F4 失明票,归属分叉合并归并线)让出原号,新号由取号令牌按当次 CAS 的 HEAD 现算;同族其余 6 行同批承让到同号(见各自承接记录)。本行正文除编号位与本记录外逐字未动。〕
```

- 原 L7134(L3 纯指针行(剥注记后无实质正文)):

```
- [ ]【【归并】重复登记副本·双前缀畸形号(2026-09-28):行首那个号是改派工具把前缀又贴一次造出来的,尺子按它取不出主键,于是同一件事被算成两个标题;这份是并集重放带回的折叠前形态。同题登记的持有行是「同型未普查的一格登记,未修:全仓还有多少条路由把任意字符串喂给uui」那一条(按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。】 **任意字符串**喂给 `uuid` 列
```

- 原 L7135(L1 外部持有行 L15702):

```
- [ ]【【归并】重复登记副本·双前缀畸形号(2026-09-28):行首那个号是改派工具把前缀又贴一次造出来的,尺子按它取不出主键,于是同一件事被算成两个标题;这份是并集重放带回的折叠前形态。同题登记的持有行是「真机拍到的观感缺陷登记,未修:首页轮播的图片来源在移动网络下失败,错」那一条(按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。】 观感缺陷(登记,未修):首页轮播的图片来源在移动网络下失败,错误占位是一个橙色告警三角
```

- 原 L7295(L1 外部持有行 L15701):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11128(G-453) 同题,派单以持有行为准,本行不再单独派单。〕 G-210 **台账 F4(重复登记副本)对"同一待办的漂移副本"结构上失明 —— 现读一例:同一条 D41后续① 在 HEAD 有 9 份未勾选副本、其中 7 份正文互不相同(2026-09-28 量)**: `plan-tasks.mjs` 的 F1/F4 判据是"编号 + 标题前缀**逐字等值**",这既是它的优点(不做相似度猜判)也是它的洞 —— 并发 union 每次都留一份**带自己注记**的副本,前缀之后的正文一漂移,复合主键就不再相等,于是同一件事以 N 份"未勾选"长期并存。后果不是账面难看而是**派单被放大 N 倍**:本日两次 `plan-tasks-merge.mjs --heal --commit`(归并 30 行 / 34 行)把 F1/F4 都归到 0,而这一族一份都没被动到 ⇒ "跑过归并"不等于"这一族被覆盖"。出路只有两条且都不该由机器代裁:① 归并线逐组判"哪份是当前状态"(需要读注记语义,机器判不了);② 给登记侧加一条硬约束——同一件事要更新就**就地改那一条**(§1 第 2 条已有此规矩,缺的是让机器能在前缀一致而正文漂移时也点名)。本票**只登记现读证据与两条出路**,不改判据、不批量翻勾(批量翻勾 = 把别人的注记当噪声删,比原病更响)。归属:分叉合并归并线(同 G-363 那条持有)。 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「G-417 · 台账F4」,派单以那条为准,本行不再单独派单。〕〔让号记录(2026-10-09 F9 清偿批⑤承接):同题同批承让到 G-210(持行由取号令牌现算,见该行让号记录;机主拍板 2026-10-09 代码引证优先,原号 G-417 留归「全量守门盘点」侧),本行正文除编号位与本记录外逐字未动。〕
```

- 原 L7303(L1 外部持有行 L7582):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7672(G-470) 同题,派单以持有行为准,本行不再单独派单。〕 G-1018292. **共享索引被整批清空后,"他人已暂存的删除"会失去保护标记,并被工作区存续自愈当成外部删除恢复**(归属:安全提交器 + 存续自愈两处持有人;等环境条件 = 需先定"意图删除"与"宿主误删"在恢复前用什么区分,不是等人拍板措辞):实测链(2026-09-28 09:13–09:17,本机=生产,多会话并发) —— 另一会话把 `apps/ai-service/tests/test_tool_approval_grant_lifetime.py` 以 `D ` 形态暂存(该文件是它当天新建、已入库的测试,`git status` 显示索引里有暂存删除);我用 §12 强制的 `node scripts/safe-commit.mjs` 提交自己的 2 个文件,其 Step ① 是 `git reset HEAD` **清空整个暂存区**(该设计的目的正是别把别人的在途内容打包进我的提交),效果是那枚暂存删除的保护标记一起没了;2 分钟后 `git-guardian` 的存续自愈判定"工作树缺该文件 ∧ 索引 blob == HEAD blob ∧ HEAD 里有它"三条成立 ⇒ 恢复磁盘副本,日志原文:`✅ 工作区存续自愈:恢复 1 个被外部删除的跟踪文件(apps/ai-service/tests/test_tool_approval_grant_lifetime.py)`。**净结果这次是好的**:恢复内容与 HEAD 逐字节同值(零独有数据、零伪造),且该测试实跑 `5 passed`(RC=0,证据 `.ihui-agent/tmp/ff-race/pytest-grant.ev`)—— 也就是说被"恢复"的是一件确实该存在的东西,而它此前那次暂存删除更像宿主清理层命中 `tests/` 整目录(AGENTS §5b 记过该型)而非有意移除。**但机制本身是反的**:存续自愈的设计前提恰恰是"他人已暂存的删除只报数、不代裁",而一次**与它无关**的第三方提交就能替那个删除摘掉标记 —— 若那枚暂存删除是有意的(例如某票按 §7 迁移测试文件),本机会话的每次提交都会把它复活,而两边账面都绿:提交方只看到"我的 2 个文件",自愈方只看到"外部删除 + 零独有数据"。**要谁做什么**:① `safe-commit.mjs` 在 `git reset HEAD` 之前把 `git diff --cached --name-status` 的现状留底,复位后**逐路径恢复 D 标记**(或至少在输出里点名"本次清空了他人的 N 项暂存删除"),让归属会话能看见而不是事后发现;② 存续自愈恢复前问一句"该路径最近是否出现过 ` D`/`D ` 形态"(reflog/索引事件),分不清就只报数。**不在本票范围**:改动别人那枚删除本身(既不支持也不阻止),以及 §7 对"删除 git 对象前先答三问"的既有纪律。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-461 · 共享索引被整批清空后」,派单以那条为准,本行不再单独派单。〕 〔让号记录(2026-10-02 F9 清偿批②):原号 G-461 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕
```

- 原 L7305(L1 外部持有行 L15687):

```
- [ ]〔【归并】重复登记副本(2026-09-28,现读取证后落的折):本行与同题那条"四个生产 surface 全部接线"是同一件事的两态副本,标题不同 ⇒ 归并器按"编号 + 标题前缀逐字等值"配不上,所以它既不进 F1 自动收口、又永远留在派单清单里,并把守门 130 钉成干净 HEAD 上的恒红(约两百道门对每一次提交作废)。判哪份是旧的不靠叙述:两条正文同一段前缀逐字相同,另一份在下面接着往下写并记了接线完成;且现读 HEAD 面那四个生产文件全部引用把手(逐个量出命中数)。本行摘掉编号只留指针,正文逐字保留,**不翻勾也不代任何持有人判定做完** —— 状态结论仍由那条已完成行给。〕 **双重执行**(两次 LLM、两遍工具副作用),比占位错误更坏;改成消费返回值必须与把手面登记同枚提交,而那三个文件此刻由他人持有。补丁形态已写在代理交付报告里(`handoff = await take_loop_v2_handoff(…); if handoff is not None: return AgentStepResult(**handoff.step_result); guard_loop_v2_pilot(…)`),**归属:ai-service 编排线持有人**。**同轮量到的一条既有事实(接线那票必须一并拍板)**:`AgentLoopV2.run()` 在 completed/error/max_iterations 后**无条件** fire-and-forget `meta_learner.evaluate_and_record`,它用**真实 `llm_gateway`** 再发一趟 LLM 并经 `KeyPoolSelector → get_shared_pool` 触生产 PG,同一份代码两次跑出 0 次与 3 次连接池触碰(实测非确定性);收敛档一旦真接上,**每次编排都会多一次计费 LLM 调用 + 一次落库**。本票测试里显式掐掉它并留了活的连接池哨兵。另:`progress_callback` 在新链路是循环结束后按真实顺序回灌、不是实时(旧路径跑一步发一次),没拿它冒充实时。 (原行首编号在此留原文)
```

- 原 L7307(L1 外部持有行 L8048):

```
- [ ]〔【归并】重复登记副本(2026-09-28):本行行首那个号是**并发取号撞来的号** —— 两条分支各自在自己那侧的当下 HEAD 取过号、都没撞,合到同一份账面才第一次相遇;本行不是新任务,是同一件事的第二份登记。同题登记的持有行是「--self-test 的"登记侧不求值"」那一条待办(编号 G-365;按标题前缀寻行,既不写行号也不依赖行序);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。〕 **`--self-test` 的"登记侧不求值"洞已逐门普查完:41 道潜伏 / 今天掩盖真缺陷 0 条 / 根因是没有共用出口(普查判定面=HEAD,派单前须重跑)** —— 起因是本轮代落守门 41 时量到它的 13 条 self-test 全部传箭头函数而登记函数写的是 `!!ok`(`!!fn` 恒真)⇒ 一路打印"13/13 通过"却一条都没判过,在这个掩护下同文件一处单位错误(把**秒差**除以 3,600,000 ⇒ 48h 豁免窗实际约 5.5 年,"超窗仍判"那条反向对照永不触发)长期隐形。该门已修并补镜像(枚 `aea810c81`)。随后按 HEAD 面普查全仓 `scripts/**`(418 个 mjs)得到这一族的**全量分布**:
```

- 原 L7308(L1 外部持有行 L8049):

```
- [ ]〔【归并】重复登记副本(2026-09-28):本行行首那个号是**双前缀畸形号** —— 改派工具把前缀又贴到已有号上造出来的,尺子按它取不出主键,于是同一件事在台账里被算成两个标题。同题登记的持有行是「plan-tasks-merge.mjs --dedupe-blocks」那一条待办(编号 G-366;按标题前缀寻行,既不写行号也不依赖行序);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。〕 **`plan-tasks-merge.mjs --dedupe-blocks` 的阈值覆盖不到"两行逐字相同的单行副本"这一型（现读实证：86H 那一条已完成行在 HEAD 面有 2 份逐字相同副本 —— 计数用 `git show HEAD:PROJECT_PLAN.md | grep -c "86H. agent 审批的权限决策落审计链"` = 2；按 §1 判据 3 不写行号，行号在 append 后必挪位）**：该出口只认 **≥3 行且每行 ≥40 字符的连续 bullet 块逐字相同**（阈值本身是对的 —— 低于它会把台账里天然成对的短行成百地报出来，噪声淹信号），于是"同一件事被写成两份、每份都是单行"恰好落在缝隙里；而 F1/F2/F4 也都不计它（四条判据里"待办副本"要求未勾形态，两份都已 `[x]` ⇒ 账面 0，`plan-tasks.mjs --staged` 现读 F 维全 0）。**这一型有两条候选制造路径(本票未定性,不得读成已归因)**:活文档 union 把改写前那份带回来;门 71 的 post-commit 自愈按标记回捞"丢失"的行 —— 若那一行其实是被**就地改写**(旧行已按 §1 留在原位、新行另处再写一份),回捞就会补出第二份。定性要跑一次可控复现(独立临时仓里"改写一行 → 触发自愈"看它补不补),不在本票顺手做。**在等谁**：归并器持有人裁 —— 出路只有两条且都要人拍：a) 给 `--dedupe-blocks` 加"同主键 + 逐字等值 + 已完成形态"的单行档（判据必须是**逐字等值**，半行不同就交人工，理由同它现有那条"机器折半即有损"）；b) 或在门 71 自愈侧改为"编号在面上已存在即不追加"（那是生产者侧收口，比事后清账更对，但要证明不会把真丢行也一并按住）。**不得**由本票手工删行：删已完成行受 §1"禁止无声删除"约束，而两份哪份作数要按主键而不是按行号（§1 判据 3 已把行号指针判为不可用作证据）。
```

- 原 L7310(L1 外部持有行 L7607):

```
- [ ]〔【归并】重复登记副本(2026-09-28):本行行首那个号是**双前缀畸形号** —— 改派工具把前缀又贴到已有号上造出来的,尺子按它取不出主键,于是同一件事在台账里被算成两个标题。同题登记的持有行是「MCP 工具被标成」那一条待办(编号 G-401;按标题前缀寻行,既不写行号也不依赖行序);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。〕 **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 〔拍板 2026-10-05(机主选"未知即按写处理"):MCP 工具默认档不再算 `read` —— 需批准、失败不自动重跑;确实只读者按"服务器 + 工具名"显式登记白名单并把白名单纳入跨语言对账。落点在 `apps/cli/src/tools/hub/mcp-adapter.ts` 与权限档两侧持有人;派单排在 G-710 那枚同目录代理之后,避免两个代理同改一个文件〕
```

- 原 L7311(L1 外部持有行 L7608):

```
- [ ]〔【归并】重复登记副本(2026-09-28):本行行首那个号是**双前缀畸形号** —— 改派工具把前缀又贴到已有号上造出来的,尺子按它取不出主键,于是同一件事在台账里被算成两个标题。同题登记的持有行是「设置项"显式清空"与"从未设置"无差」那一条待办(编号 G-402;按标题前缀寻行,既不写行号也不依赖行序);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。〕 **设置项"显式清空"与"从未设置"无差，且读侧同一含义两键相反（需拍板；归属：api 设置面 + web 设置页持有人）** —— 已亲自复验：`apps/api/src/routes/user/settings-routes.ts:55` 写体是 `z.record(z.string(), z.unknown())`，落库处 `value === null || value === undefined ? null : String(value)` ⇒ `null` 与"缺席"存成同一个 NULL 行；读侧 `apps/web/app/(main)/settings/notifications/page.tsx:48-52` 四键混用 `!== 'false'`（默认真）与 `=== 'true'`（默认假），于是**同一个被清空的值，在前一族读回 true、在后一族读回 false**。上游同族做法是把三态写进契约（`settings/pluginConfigPatch.ts:29-36`：`undefined`=未触碰跳过、`null`=进 `clearOptionKeys`、sensitive 空串=不改已有值；落库侧 `file-config.adapter.ts:557-565` 按 option key 合并而非整对象替换，防同 scope 密钥被静默清空）。**为什么还开着**：改成三态要动 PUT 语义（单键 DELETE 出口我方根本没有——`deleteUserPreference` 只服务 devices），属对外契约决策；先拍"要不要有删键出口"，再谈读侧归一。**不得**靠"读侧统一成 `=== 'true'`"消红——那会把默认真的四项静默翻转。
```

- 原 L7312(L1 外部持有行 L8054):

```
- [ ]〔【归并】重复登记副本(2026-09-28):本行行首那个号是**并发取号撞来的号** —— 两条分支各自在自己那侧的当下 HEAD 取过号、都没撞,合到同一份账面才第一次相遇;本行不是新任务,是同一件事的第二份登记。同题登记的持有行是「上述②的两格」那一条待办(编号 G-362;按标题前缀寻行,既不写行号也不依赖行序);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。〕 **上述②的两格"审面根因"分别是独立一票,现各写清归属与解阻前置**:① **守门 57 的清单计数只看台账、不看归档件**(它 `checkBaseline` 的 `entryCount` 有一部分来自台账里 `data.planSource.taskLinePattern` 匹配的 D 族行)⇒ 正解是把审面改成"台账 ⊕ 同面归档件"(`git ls-tree HEAD` / 索引列目录,照**门 71 的归档豁免**与**门 13c 的 A2/A3 同面取材**那两个先例抄,不得 `readdirSync`),基线一律不动;本票已派子代理做,落地判据 = 私有索引端到端两臂(台账摘掉而归档件同字在 ⇒ rc=0;两侧都摘 ⇒ rc=1 并点名)。② **取号只看台账面的 max**(`lib/plan-task-index.mjs` 的 `usedIdsOfPrefix` 只看被审的 `PROJECT_PLAN.md`)⇒ 归档后同一个号会被再发一次,这是①的同族、量纲不同(号段单调性 vs 计数存续)。它**此刻被他人持有**(`scripts/lib/plan-task-index.mjs` 与 `scripts/plan-tasks.mjs` 工作树各有在飞改动,本会话按 §12 边界未动),**解阻前置**=那两文件的在飞改动入库后,由同一持有人把 `usedIdsOfPrefix` 扩成"台账 ⊕ 归档件"或给 `live-doc-edit` 的令牌加一道"号已在归档面出现过 ⇒ 继续往上取"的复核;不得由旁路会话按 pathspec 交工作树版本(那会把别人的在飞改动整批写回旧态)。〔编号改派留痕(2026-09-28):原 G-362「桌面端「启动后先进托盘」在真机采样里出现过一次」 与另一条先入的登记撞成一号两事,按"后来者改号"由 live-doc-edit 的取号令牌在每次 CAS 里按当下 HEAD 现算;正文一字未动。〕
```

- 原 L7313(L1 外部持有行 L8055):

```
- [ ]〔【归并】重复登记副本·同题不同编号(2026-09-28):本行与持有行是同一件事的第二份登记(题面逐字相同、编号不同 —— 两条分支各自取号后并到同一份账面才相遇)。持有行是「守门 150(角色档合规)在 HEAD 面判红 471 族」那一条待办(编号 G-365,按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。〕 **守门 150(角色档合规)在 HEAD 面判红 471 族,而它是 blocking:定级与存量锚点未对齐** —— 现读 `node scripts/check-radius-role-conformance.mjs` 末行「判红 471 族 / 已判合规 2215 / 弱证据待裁 93 / 未判定 1」。它挂 `apps/ + packages/`,意味着任何一次提交都要先清偿这 471 族,否则唯一出路是各会话跳钩子、连带其余全部守门作废(§12e 那一型)。归属该门持有者,两条正当出口:① 把这 471 族按"首锚 + 只拦新增"落进它自己的 `anchorRegression` 台账;② 或降 warn + `--strict` 问责。**禁止**为让报告变绿去放宽类别判据或把 card 一律改成 lg —— 弱证据实测判错率 20–70%,批量改档等于重新设计。
```

- 原 L7314(L1 外部持有行 L15703):

```
- [ ]〔【归并】重复登记副本·同题不同编号(2026-09-28):本行与持有行是同一件事的第二份登记(题面逐字相同、编号不同 —— 两条分支各自取号后并到同一份账面才相遇)。持有行是「CSRF「按凭据存在性豁免」这一型无判据」那一条待办(编号 G-366,按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。〕 **CSRF「按凭据存在性豁免」这一型无判据:票#23 修了一处,型还在** —— `plugins/csrf.ts` 原先 `if (request.headers['x-internal-service-token']) return` 只看头在不在就整条豁免,已改为 `isVerifiedInternalMachineCall(request)`(唯一出口 `apps/api/src/utils/internal-principal.ts`,复用 `secretsEqual`)。但下一个内部凭据族照样能写成 `if (request.headers['x-anything']) return`,typecheck/lint/其余门全不响。建议小门三条:① csrf/preHandler 里"以某 header/env 键的存在性为唯一条件即放行"⇒ 红,正当形态只有调用 isVerified* 出口或行内 `csrf-exempt: <原因>`(挂守门 108 的 30 天档);② 出口被摘线(无人调用或 export 不见)⇒ 判"没有出路"并参与退出码;③ 比较逻辑只许 `secretsEqual` 一份,再出现第二处 `timingSafeEqual` 即红。前置:先量 HEAD 面存量,非零就走首锚,不得当场造恒红门。
```

- 原 L7315(L1 外部持有行 L15689):

```
- [ ]〔【归并】重复登记副本(2026-09-28):本行行首那个号是**双前缀畸形号** —— 改派工具把前缀又贴到已有号上造出来的,尺子按它取不出主键,于是同一件事在台账里被算成两个标题。同题登记的持有行是「A1 改道校验只比大小不比内容」那一条待办(编号 G-411;按标题前缀寻行,既不写行号也不依赖行序);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。〕 **A1 改道校验只比大小不比内容（可立即修；归属：§26 C 盘改道线，本票持有人即我）** —— 见上文 A1 与现读落点。
```

- 原 L7320(L1 外部持有行 L15704):

```
- [ ] 〔【归并】重复登记副本·残行摘号(2026-10-09 批⑦执行):本行与同题持有行重复,现摘掉声明位编号只留指针;注记逐字携带原加粗头原文「G-580 本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)」,是为了让守门 71 的原文前缀判据(标记 = 加粗头前 ≤18 字,遇 * 即停)继续命中 —— 该门明写刻意不给「正文仍在即视为搬家」的豁免,所以摘号必须把原文留在行内,否则下一轮自愈会把旧号行整条捞回(批⑤ 至今「复活再摘」四轮即此循环)。派单以 G-580「并集合并会把两侧皆空的嵌套冲突标记块原样写进」持有行 为准,正文逐字保留,不翻勾、不并抄。〕**本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)** 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-580」,派单以那条为准,本行不再单独派单。〕
```

- 原 L7321(L1 外部持有行 L15704):

```
- [ ] **本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)** 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-580」,派单以那条为准,本行不再单独派单。〕〔【归并】重复登记副本·残行摘号(2026-10-09 批⑥执行):声明位 G-580 已摘,派单以持有行「并集合并会把"两侧皆空"的嵌套冲突标记块原样写进」为准,正文逐字保留。〕
```

- 原 L7322(L1 外部持有行 L15704):

```
- [ ] 〔【归并】重复登记副本·残行摘号(2026-10-09 批⑤复活再摘④):原号已让出,复活旧态摘号留指针,正文逐字保留;同题以「本批全量终审 186 项」按标题前缀寻行。〕**本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)** 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-580」,派单以那条为准,本行不再单独派单。〕
```

- 原 L7323(L1 外部持有行 L15704):

```
- [ ] 〔【归并】重复登记副本·残行摘号(2026-10-09 批⑤复活再摘③):原号已让出,复活旧态摘号留指针,正文逐字保留;同题以「本批全量终审 186 项」按标题前缀寻行。〕**本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)** 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-580」,派单以那条为准,本行不再单独派单。〕
```

- 原 L7324(L1 外部持有行 L15704):

```
- [ ] 〔【归并】重复登记副本·残行摘号(2026-10-09 批⑤复活再摘②):原号已让出,复活旧态摘号留指针,正文逐字保留;同题以「本批全量终审 186 项」按标题前缀寻行。〕**本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)** 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-580」,派单以那条为准,本行不再单独派单。〕
```

- 原 L7325(L1 外部持有行 L15704):

```
- [ ] 〔【归并】重复登记副本·残行摘号(2026-10-09 批⑤复活再摘):原号已让出,本行摘令牌、正文逐字保留;同题以「本批全量终审 186 项」按标题前缀寻行。〕**本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)** 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-580」,派单以那条为准,本行不再单独派单。〕
```

- 原 L7326(L1 外部持有行 L15704):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-09):本行声明位残留的原号已让出(见同族持有行让号记录),本行摘掉令牌、正文逐字保留、不翻勾、不并抄;同题登记以「本批全量终审 186 项」那一条按标题前缀寻行(不写行号)。〕 **本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)** 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-580」,派单以那条为准,本行不再单独派单。〕
```

- 原 L7331(L1 外部持有行 L7607):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-599 **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 (原编号 G-599;持有行题面「MCP工具被标成read⇒免批准+失败自动重跑」) 〔拍板 2026-10-05(机主选"未知即按写处理"):MCP 工具默认档不再算 `read` —— 需批准、失败不自动重跑;确实只读者按"服务器 + 工具名"显式登记白名单并把白名单纳入跨语言对账。落点在 `apps/cli/src/tools/hub/mcp-adapter.ts` 与权限档两侧持有人;派单排在 G-710 那枚同目录代理之后,避免两个代理同改一个文件〕
```

- 原 L7332(L1 外部持有行 L7608):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-594 **设置项"显式清空"与"从未设置"无差，且读侧同一含义两键相反（需拍板；归属：api 设置面 + web 设置页持有人）** —— 已亲自复验：`apps/api/src/routes/user/settings-routes.ts:55` 写体是 `z.record(z.string(), z.unknown())`，落库处 `value === null || value === undefined ? null : String(value)` ⇒ `null` 与"缺席"存成同一个 NULL 行；读侧 `apps/web/app/(main)/settings/notifications/page.tsx:48-52` 四键混用 `!== 'false'`（默认真）与 `=== 'true'`（默认假），于是**同一个被清空的值，在前一族读回 true、在后一族读回 false**。上游同族做法是把三态写进契约（`settings/pluginConfigPatch.ts:29-36`：`undefined`=未触碰跳过、`null`=进 `clearOptionKeys`、sensitive 空串=不改已有值；落库侧 `file-config.adapter.ts:557-565` 按 option key 合并而非整对象替换，防同 scope 密钥被静默清空）。**为什么还开着**：改成三态要动 PUT 语义（单键 DELETE 出口我方根本没有——`deleteUserPreference` 只服务 devices），属对外契约决策；先拍"要不要有删键出口"，再谈读侧归一。**不得**靠"读侧统一成 `=== 'true'`"消红——那会把默认真的四项静默翻转。 (原编号 G-594;持有行题面「设置项"显式清空"与"从未设置"无差」)
```

- 原 L7340(L1 外部持有行 L7958):

```
- [ ] P1 新登记(接上条,解阻前置已明确):僵尸实例修复。可选方向三条,按仓库既有取向排序 ——(a) WebView2 创建失败即记录 ERROR + 提示并 `process::exit`,**不得**继续启动 `auto_refresh` 常驻循环;(b) 失败时回退到离线兜底页(`lib.rs` 已注册 `offline` 协议,`auto_refresh` 有断网切页机制)而非静默半启动;(c) 查清 single-instance 为何未拦住第二实例。选哪条前必须先复现:同日两次启动的时间差是 14 分钟,尚未取证"主实例处于隐藏态时 siw 窗口是否仍在"。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7346(L1 外部持有行 L15679):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-375 **cache token 过了服务端、没上客户端边界，三处消费端硬编码 null（可落地；归属：api-client + 三端上下文用量组件）** —— `packages/api-client/src/client.ts` 的 usage 解析只取 prompt/completion/total/reasoning（无 cache 字段），于是 `apps/web/src/components/ai/context-usage-ring.tsx:371`、`packages/app/src/features/chat/ContextUsagePanel.tsx:87`、`apps/miniapp-taro/src/pkg-ai/ai/context-usage-strip.tsx:74` 三处一律 `cacheReadTokens: null`，而 `context-usage-ring.tsx:759` 仍把这一档渲染成"读取 …"——**界面显示的是一个恒为 null 的字段**。服务端侧 `apps/ai-service/app/core/usage_cache.py` 已有双协议别名表，即数据源在、断在边界。修法向后兼容（加字段，缺值仍不渲染＝不判绿）。**判据缺口同记**：守门 112 对它两重失明（`SCAN_ROOTS` 不含 `packages/*`；`DENOMINATOR_NAME_RE` 只认 `context*` 前缀，`maxTokens` 整族隐身）。 (原编号 G-375;持有行题面「cachetoken过了服务端」)
```

- 原 L7347(L1 外部持有行 L15680):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-376 **瞬时假值覆盖上一个可信值：上下文占用把"短暂 0"当"真的清空"（可落地；归属：web 首页/上下文条持有者）** —— `apps/web/src/components/chat/context-budget-bar.tsx:81-84` 只在 `!== undefined` 上守卫，收到 `used=0` 就渲染 0%；上游同型问题的处置是"普通工具调用期间 agent 会短暂发 used=0，这不是 context 真被清空"，并**逐项列出例外**（`/compact`、`/compress` 那一次 0 才是真话，见其 `zcodeTaskUsageFallback.ts:44-47,60-73`）。与我方 §30"没有终态不得写完成"、守门 135"身份不得从文案重建"同族。成本低（一处投影函数 + 一份成文例外表），但例外表**必须可判**，不得写成散文。 (原编号 G-376;持有行题面「瞬时假值覆盖上一个可信值」)
```

- 原 L7348(L1 外部持有行 L15681):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-377 **影子副本门没有目录枚举（可落地；归属：守门 prod-bundle 影子对账持有人）** —— `scripts/check-prod-bundle-shadow.mjs` 现读 `readdirSync` **0 次**，只比登记表里的对 ⇒ 一个未登记的脚本躺在 `deploy/prod-bundle/` 时本门全盲，而 §5e 的原话正是"落进 prod-bundle 的运维脚本必须同时落入库源，否则等于写进盲区"。上游同族做法把三件事同立：整棵树哈希（含 mode、排序、排除自身 integrity 文件）+ 清单逐字节验 + `reviewRequired` 非空直接抛。**注意定级方向**：它那套是 fail-closed 且只挂发布路径不挂提交链，与我方"台账只报数防恒红"（§12e）是同一条纪律的两侧——要抬的是**枚举面**，不是把判红搬到提交链上。 (原编号 G-377;持有行题面「影子副本门没有目录枚举」)
```

- 原 L7349(L1 外部持有行 L15682):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-378 **棘轮锚点把量值编进指纹 + `--changed` 不沿反向依赖（可落地；归属：守门 77/83/103 与门 118 那族）** —— 上游 `scripts/architecture/index.mjs` 的 `fingerprint(rule, file, detail)` 把**行数**当 detail，401 行涨到 500 会换指纹、被判"新违规"；我方锚点是"该文件违规**处数**"，500→5000 行名额不动。另它的 `--changed` 走反向依赖闭包（改一份被 40 处 import 的契约，那 40 处算这次头上），而我方 `PUSH_SCOPE_FILES`/`stagedTriggers` 都是路径前缀 ⇒ **改契约不红 importer**（门 103 已有 import 图，成本中）。两条都是"锚点粒度不够细 ⇒ 换个写法就净零逃逸"的同族，改法不得顺手扩成恒红。 (原编号 G-378;持有行题面「棘轮锚点把量值编进指纹+--changed不沿反」)
```

- 原 L7350(L1 外部持有行 L15683):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-379 **桌面侧两格：整页导航绕过"存草稿"闸 + 日志无保留期（可落地；归属：desktop 端持有人）** —— ① `apps/desktop/src-tauri/src/lib.rs:2766` 在 `CloseRequested` 无条件 emit `desktop-before-close`（注释："三种去向都照发…先存草稿"），但 `auto_refresh.rs:275/318/347/366/394` 五处 `eval("location.reload()"/"location.href=")` 全部绕过；我方 `scripts/check-desktop-event-wiring.mjs` 的 **G8**（:470、:682-701）已经把"本文件的整页导航发起点"枚举成判据并自带"找不到即失明"护栏 ⇒ 照抄成 G9 即可，成本极低。② `apps/desktop/src-tauri/src` 全树 grep `rotate|retention|remove_file` **零命中**，日志无保留期；上游 `logRetention.ts:41-98` 启动裁 14 天、:24-32 用"日期回环"拒 `2026-02-30` 这类假日期。**不可照抄形态**：我方是单文件 `智汇AI.log`，须按 mtime+size 而非按天切分；另记上游一条陷阱——`copyFileSync` 会把 mtime 改成复制时刻，按 mtime 做 retention 会误删较新件（其 `desktopCrashCapture.ts:99-101` 用 `utimesSync` 还原），适用我方任何"复制 + 按 mtime 清理"的归档器。 (原编号 G-379;持有行题面「桌面侧两格」)
```

- 原 L7351(L1 外部持有行 L15684):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-380 **技能与项目层配置的键白名单（可落地；归属：cli skills + config 持有人）** —— ① 第 3 层 `<cwd>/.ihui/settings.json` 经 `apps/cli/src/config/index.ts:56-69` **零键过滤、零枚举校验**，`permissionMode`/`allowDangerous` 同层可达；今天不构提权**只因为** `.gitignore:150` 的 `.ihui/*` 一行 ⇒ **防线在一行 ignore，不在判据里**。② `SkillFrontmatter`（`packages/types/src/agent-runtime.ts:206-228`）无权限键、`getAllowedTools` 生产面**零调用方**（与上游 `safeToAutoLoad` 同型惰性：唯一消费者是 CLI 打印），而 `apps/cli/src/skills/index.ts:31` 注释仍写"（可选,工具白名单）"= **名字承诺而实现未兑现**，正是 `check-digest-name-reality` 的对象。③ 可抄的一条硬知识：插件作用域扫描**一律不跟随符号链接/junction**（根、子目录候选、SKILL.md 三粒度全拒），我方 `skills/index.ts:421-445` 目前靠 `Dirent.isDirectory()` 对链接返 false **偶然**不跟随，无注释无判据。**不得**为消红去把注释改成"已实现"。 (原编号 G-380;持有行题面「技能与项目层配置的键白名单」)
```

- 原 L7352(L1 外部持有行 L15685):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-381 **"文档表 ↔ 判据名"双向对账缺口（可落地；归属：守门 89 持有人）** —— 89 现判 R4（有码无文）与 R5（撞号），**不判"文档列了而 runner 没有"**。已现量的三处待配对：① 上游 `rule-catalog.md` 12 行 ↔ 其 `index.mjs` 12 个 `rule:` 字面量今天零漂移，而我方无同类表；② 端口三副本 `docs/port-management.md §2 ↔ dev-port-registry.json ↔ check-port-registry.mjs`，后者手抄 `REGISTERED_PORTS` 且注释自陈同步却不读 JSON（今天未漂移：JSON 9 枚 ⊆ Set 51 枚，docs 侧从未参与比较）；③ `docs/UI_GUIDELINES.md §3.1 角色↔px ↔ RADIUS_ROLES`（守门 150 判代码不判文档，而 AGENTS 自记"§3.1 曾差一档、照文档写必错"）。上游另有一条值得抄的**散文纪律**：`do not duplicate its rules in this file or in AGENTS.md`——用"禁止复制"消除漂移面，而我方靠"现值一律现读"这句话（正是本节反复失效的那类约束）。 (原编号 G-381;持有行题面「"文档表↔判据名"双向对账缺口」)
```

- 原 L7372(L1 外部持有行 L15597):

```
- [ ]（待派/QODER-O81）G-3 **守门 149(包入口 barrel 漏 re-export)对"端内 barrel"整片失明,而它漏的正是能把整站打红的形态** —— 立票凭据不是推理:web 端本机现读 HTTP 500,响应体直接点名 `Export <某组件> doesn't exist in target module`,定位到「端内 barrel 没递出该符号,而同端消费方从 barrel 具名导入」;追溯还发现该符号**曾**在 barrel 里、被一枚"撤掉整条链"的提交摘掉而组件文件保留,之后有人重新引用却没复原出口。同一天另量到一处同型候选(另一张 barrel 与它的消费方),说明这不孤立。**为什么现有门看不见**:149 的候选集按 workspace 包入口(`packages/*/src/index.ts`)枚举,端内 barrel 从来不在面里(实测其 `--json` 输出中不含任何端内 barrel 路径);而管悬空导入的那道门判的是"符号根本不存在",这型是"符号存在而入口没递出",结构上互补不重叠。**后果不是"少一个类型错"**:本仓 web 构建设了 `ignoreBuildErrors`,端内 barrel 漏出口在本地与构建两侧都不红,只有点到那个位置的人知道 —— 与守门 72/78/149 立项时同一族"本地全绿、出事的是产物"。**扩面前置(不得跳过)**:先把存量一次量清(端内 barrel 全集 × 各自消费面 × 悬空具名导入数),再决定定级 —— 存量未清就 blocking 就是与任何提交无关的恒红门,唯一结局是各会话跳钩子、连带其余全部对账作废(§12e 同型);**不得**为让本票变绿去改判据或删引用。**顺带登记一条归属纪律**:那枚造成 500 的在飞引用属他人持有面,本票只登记现象与修法方向,不代改别人的文件。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔让号记录(2026-10-02 F9 清偿批②):原号 G-627 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕 〔改号(2026-10-14):原G-1018301〕
```

- 原 L7421(L1 外部持有行 L4709):

```
- [ ]（进行中）**守门 91 冻结的 9 处待清 + 一项方法论债(2026-09-24)**:① study-publish 整文件主题化(14 处 `getTokens('light')`,8 处在模块级 StyleSheet.create 里,须改成按 scheme 生成的函数或下沉到组件内), 改完后 `node scripts/check-theme-prop-wiring.mjs --update-baseline` 应收窄; ② 7 个他人 M 在制的屏(CourseDetail / Distribution / LiveDetail / ModelPlaza / N8nModel / PostCreate / SharedDemo)待其会话自行接线; ③ `{...props}` 展开类站点被判 spread-unknown(判不出即如实报,不静默放行)—— 要真正覆盖须先给端内 wrapper 的 props 建立类型事实,属独立改造; ④ 方法论债:**本轮两次误判同源** —— 一次是把像素被 `rgba(0,0,0,0.6)` 遮罩压暗 40% 当成"颜色没落上", 一次是用"文本里有没有某个键"统计出"0 处漏传"。两者的共同错误是**用一个不测量目标东西的探针给出肯定结论**。 纪律:凡给出"0 处 / 没有 / 已全清"这类否定性结论,必须先构造一个**已知应被命中的正例**喂给同一判据(阳性对照), 否则该结论不得写进文档或据此决定"不做"。 〔PROGRESS 2026-09-25: ① study-publish 共享屏 15 处 getTokens(light) 由 commit 5ce93b9e1 清零(守门91/83 全绿);②③④ 仍开放〕 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记在 L6391(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L7422(L1 外部持有行 L4700):

```
- [ ]（进行中） **本轮未落地、需重做的一批(web 86 处内的键名对齐)**:该批次报告改了 4 个文件(`DeveloperKeyDialog` / `AiGenerationContent` / `PermissionSelector` / `helpers`),**逐条按内容复核后全部不在 HEAD**(`git grep <新键名> HEAD -- apps/web` 四处均 0 命中),工作区也已被并发会话覆盖 → 判为**丢失需重做**,不要当成已完成。中途我一度按"工作区里有"记成"已落地",那是读到了被覆盖前的窗口 —— 并行期复核一律以 **HEAD 对象树内容**为准(档案第 4 节已记此教训)。 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记在 L9856(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L7424(L1 外部持有行 L11184):

```
- [ ] **D173 AI 对话链路四竞品对标 V4 收口线(19 条差距 / 5 个 Sprint)** —— 唯一入口 `docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`(87–105),本轮不在此复述差距正文,只登记排期与等待项。**S9 尺子先行(105→97)**:先落 `scripts/audit-benchmark-delivery.mjs`(V3 §八 自留建议至今未落地,`ls` 实测不存在)与 parity 门六端扩面,**顺序不可颠倒** —— #93/#94/#96 之所以能长期存在,正是因为 §9「多端连通」的机器判据只覆盖 web 一端(`check-agent-event-parity.mjs:537` 只扫 `apps/web/src`)。**S10 移动端可达性(93→94→95)**:RN 主屏 `apps/mobile-rn/src/screens/ChatScreen.tsx:652` 起只接 7/30 回调(逐名 `comm -23` 算出缺 23 个,含 `onToolCall`/`onToolApproval`/`onPlanUpdate`/`onTerminal*`/`onSubagent*`/`onUsage`/`onBudget`/`onQuestion`/`onFormRequest`/`onReconnect`),而同端 `AiAssistantN8nScreen.tsx:1412` 是完整实现、`src/utils/chat-render-model.ts` 的 4 个 `apply*` 在主屏零调用方 ⇒ 本票主体是**接线不是开发**;#94 是信任型缺陷(RN 与小程序 `tool-approval` 双零命中,手机上遇高危操作无弹窗)。**S11 保真(87→88→89→92)**、**S12 契约地基(99→100→101→102)**、**S13 传输计量收口(96→90→91→103→98)**。**等待项(归属:等用户拍板)**:#100 内置默认高危集**改变默认行为**(现 `_high_risk_tools_from_env` 未配 env 即 `frozenset()`,`agent_loop_v2.py:288-296`),按 §24 不得由实现票自行开工;#98 桌面端薄壳是 V3 #72 已拍板架构,本票**只对齐三处口径**(tauri.conf / `ensure-web-out.mjs` 自称唯一校验点 / `docs/MULTI_END.md §2.5`),不改选型。**解阻前置(可判)**:S10 之前必须先有 S9 的端能力档案表,否则清完的端下轮又漏。**本轮同时否证 7 条断言,均写进 V4 正文,不得照旧文派单**:①②③ 上述三条 V3 过期结论;④ `packages/app` 的 `ChatScreen` 并非「未导出」—— `src/index.ts:684` 导出在位,真问题是**全仓零消费方**(同包其它 4 个聊天屏都被 mobile-rn 复用)⇒ 归 #95;⑤ web **有**消息队列与 Steer(`queue-interaction-bar.tsx` 在库,D38 已✅)⇒ 队列**不是**差距,初稿列错了;⑥ #89 初稿「主聊天流无自动重连」**否证** —— api-client `client.ts:2078/2129/3443` 有重连与 `Last-Event-ID` 续传,web `send-message.ts:767-775` 已消费 `onReconnect`,缺陷窄化为「`connection-status.tsx` 四态件生产面零挂载(命中全在 `apps/web/tests/agent-task-progress-pane.test.tsx`) + 重连后待决审批恢复未取证」;#96 那句「web 反而没有续传」同批否证;⑦ 孤儿清单里的 `voice-note.tsx` 在 HEAD 与索引双双落空,只在工作树未跟踪面 ⇒ 摘出清单、按 §12 归属未定不动。**本轮交付**:V4 文档成文并注水印(`docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`,`watermark.mjs verify` 覆盖 1/1、残迹 0、损坏 0);六端回调覆盖数改用统一交集判据重算(web 全域 30/30、extension 19、cli 12、RN 主屏 7、RN 另一屏 17、miniapp 17),并登记「事件名口径 23 与回调名口径 17 不可混用」。**待办本体是 S9–S13 的实施,本行不因文档成文而翻勾。****本轮同时更正 3 条 V3 过期结论,不得照它们派单**:#73「小程序无 AI 对话页」已被代码推翻(`apps/miniapp-taro/src/pkg-ai/ai/chat.tsx` 1623 行,最新提交 `3f3e71a99` 09-27,按事件名覆盖 23/30);#51「`run_in_background` 只有 sleep/echo」已不成立(`task_executors.py` 现读 16 个 `async def` + import 期三面断言);#47「三套执行内核」应为「一套半」(`class AgentLoopV2` 唯一内核,但 `agent_loop.py` 仍以 `agent_executor` 被 `routers/agents.py:48`、`services/a2a_service.py:33`、`services/slash_commands.py:162` 三处生产引用)。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `DD128`(族名在编号段出现两次;而第一次修正产出的 `D-172` **带连接符、不属于台账编号族** —— 唯一真相源 `check-plan-line-loss.mjs` 的 `TASK_ID_PATTERN` 里 D 族写作 `Dd+`(只有 G 族带 `-`),带横杠的号对防丢面与复合主键**双双隐身**,比畸形号更糟:它看起来像有号。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 D-128 已被 8 行认领(L7174,7551,7721,7927…),改回就等于替这本账再加一枚撞号;现号 `D173`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「D173」,派单以那条为准,本行不再单独派单。〕
```

- 原 L7429(L1 外部持有行 L15701):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11128(G-453) 同题,派单以持有行为准,本行不再单独派单。〕 G-210 **台账 F4(重复登记副本)对"同一待办的漂移副本"结构上失明 —— 现读一例:同一条 D41后续① 在 HEAD 有 9 份未勾选副本、其中 7 份正文互不相同(2026-09-28 量)**: `plan-tasks.mjs` 的 F1/F4 判据是"编号 + 标题前缀**逐字等值**",这既是它的优点(不做相似度猜判)也是它的洞 —— 并发 union 每次都留一份**带自己注记**的副本,前缀之后的正文一漂移,复合主键就不再相等,于是同一件事以 N 份"未勾选"长期并存。后果不是账面难看而是**派单被放大 N 倍**:本日两次 `plan-tasks-merge.mjs --heal --commit`(归并 30 行 / 34 行)把 F1/F4 都归到 0,而这一族一份都没被动到 ⇒ "跑过归并"不等于"这一族被覆盖"。出路只有两条且都不该由机器代裁:① 归并线逐组判"哪份是当前状态"(需要读注记语义,机器判不了);② 给登记侧加一条硬约束——同一件事要更新就**就地改那一条**(§1 第 2 条已有此规矩,缺的是让机器能在前缀一致而正文漂移时也点名)。本票**只登记现读证据与两条出路**,不改判据、不批量翻勾(批量翻勾 = 把别人的注记当噪声删,比原病更响)。归属:分叉合并归并线(同 G-363 那条持有)。 (编号改派留痕(2026-09-28):本行原取 G-417,与「全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红」一条撞成一号两事;取号发生在分叉的两条腿上,号段不共享。让位的是**本行**(它是我这一路登记的),别人的行不动;新号由取号令牌按当次 CAS 的 HEAD 现算,落地后须复核它不与任何行首编号重复。正文一字未动。) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-417」,派单以那条为准,本行不再单独派单。〕〔让号记录(2026-10-09 F9 清偿批⑤承接):同题同批承让到 G-210(持行由取号令牌现算,见该行让号记录;机主拍板 2026-10-09 代码引证优先,原号 G-417 留归「全量守门盘点」侧),本行正文除编号位与本记录外逐字未动。〕
```

- 原 L7430(L1 外部持有行 L4700):

```
- [ ]（进行中） **本轮未落地、需重做的一批(web 86 处内的键名对齐)**:该批次报告改了 4 个文件(`DeveloperKeyDialog` / `AiGenerationContent` / `PermissionSelector` / `helpers`),**逐条按内容复核后全部不在 HEAD**(`git grep <新键名> HEAD -- apps/web` 四处均 0 命中),工作区也已被并发会话覆盖 → 判为**丢失需重做**,不要当成已完成。中途我一度按"工作区里有"记成"已落地",那是读到了被覆盖前的窗口 —— 并行期复核一律以 **HEAD 对象树内容**为准(档案第 4 节已记此教训)。 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记在 L9470(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L7435(L1 外部持有行 L8049):

```
- [ ]〔【归并】重复登记副本(2026-10-08):本行行首那个号是**六位接号畸形号** —— "上一轮改号"剥前缀时把新号与旧号数字直接相接(本族 `G-811`+`336`⇒`G-811336`),尺子按它取不出主键,于是同一件事在台账里被算成两个标题。同题登记的持有行是「G-761 · plan-tasks-merge」那一条(按标题前缀寻行,既不写行号也不写编号);本行摘掉行首畸形号、只留指针,不翻勾、不并抄、正文逐字保留。〕 **`plan-tasks-merge.mjs --dedupe-blocks` 的阈值覆盖不到"两行逐字相同的单行副本"这一型（现读实证：86H 那一条已完成行在 HEAD 面有 2 份逐字相同副本 —— 计数用 `git show HEAD:PROJECT_PLAN.md | grep -c "86H. agent 审批的权限决策落审计链"` = 2；按 §1 判据 3 不写行号，行号在 append 后必挪位）**：该出口只认 **≥3 行且每行 ≥40 字符的连续 bullet 块逐字相同**（阈值本身是对的 —— 低于它会把台账里天然成对的短行成百地报出来，噪声淹信号），于是"同一件事被写成两份、每份都是单行"恰好落在缝隙里；而 F1/F2/F4 也都不计它（四条判据里"待办副本"要求未勾形态，两份都已 `[x]` ⇒ 账面 0，`plan-tasks.mjs --staged` 现读 F 维全 0）。**这一型有两条候选制造路径(本票未定性,不得读成已归因)**:活文档 union 把改写前那份带回来;门 71 的 post-commit 自愈按标记回捞"丢失"的行 —— 若那一行其实是被**就地改写**(旧行已按 §1 留在原位、新行另处再写一份),回捞就会补出第二份。定性要跑一次可控复现(独立临时仓里"改写一行 → 触发自愈"看它补不补),不在本票顺手做。**在等谁**：归并器持有人裁 —— 出路只有两条且都要人拍：a) 给 `--dedupe-blocks` 加"同主键 + 逐字等值 + 已完成形态"的单行档（判据必须是**逐字等值**，半行不同就交人工，理由同它现有那条"机器折半即有损"）；b) 或在门 71 自愈侧改为"编号在面上已存在即不追加"（那是生产者侧收口，比事后清账更对，但要证明不会把真丢行也一并按住）。**不得**由本票手工删行：删已完成行受 §1"禁止无声删除"约束，而两份哪份作数要按主键而不是按行号（§1 判据 3 已把行号指针判为不可用作证据）。〔2026-09-29 改号(承 D168 第四遍收尾):剥掉双前缀后本行会与既有 **G-336**(标题「分叉合并这次"丢掉的东西"与"互相矛盾的两行文档」)**同主键 —— 那不是畸形号而是**真撞号**,所以这里不剥前缀而是取当次空闲新号;原编号位写的是「G-G-」。〕 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-811336」,派单以那条为准,本行不再单独派单。〕
```

- 原 L7436(L1 外部持有行 L7608):

```
- [ ]〔【归并】重复登记副本(2026-10-08):本行行首那个号是**六位接号畸形号** —— "上一轮改号"剥前缀时把新号与旧号数字直接相接(本族 `G-813`+`374`⇒`G-813374`),尺子按它取不出主键,于是同一件事在台账里被算成两个标题。同题登记的持有行是「G-402 · 设置项"显式清空"与"从未设置"无差」那一条(按标题前缀寻行,既不写行号也不写编号);本行摘掉行首畸形号、只留指针,不翻勾、不并抄、正文逐字保留。〕 **设置项"显式清空"与"从未设置"无差，且读侧同一含义两键相反（需拍板；归属：api 设置面 + web 设置页持有人）** —— 已亲自复验：`apps/api/src/routes/user/settings-routes.ts:55` 写体是 `z.record(z.string(), z.unknown())`，落库处 `value === null || value === undefined ? null : String(value)` ⇒ `null` 与"缺席"存成同一个 NULL 行；读侧 `apps/web/app/(main)/settings/notifications/page.tsx:48-52` 四键混用 `!== 'false'`（默认真）与 `=== 'true'`（默认假），于是**同一个被清空的值，在前一族读回 true、在后一族读回 false**。上游同族做法是把三态写进契约（`settings/pluginConfigPatch.ts:29-36`：`undefined`=未触碰跳过、`null`=进 `clearOptionKeys`、sensitive 空串=不改已有值；落库侧 `file-config.adapter.ts:557-565` 按 option key 合并而非整对象替换，防同 scope 密钥被静默清空）。**为什么还开着**：改成三态要动 PUT 语义（单键 DELETE 出口我方根本没有——`deleteUserPreference` 只服务 devices），属对外契约决策；先拍"要不要有删键出口"，再谈读侧归一。**不得**靠"读侧统一成 `=== 'true'`"消红——那会把默认真的四项静默翻转。〔2026-09-29 改号(承 D168 第四遍收尾):剥掉双前缀后本行会与既有 **G-374**(标题「G-374ihui-auth-user里存了is」)**同主键 —— 那不是畸形号而是**真撞号**,所以这里不剥前缀而是取当次空闲新号;原编号位写的是「G-G-」。〕 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-813374」,派单以那条为准,本行不再单独派单。〕
```

- 原 L7439(L1 外部持有行 L15717):

```
- [ ]〔【归并】重复登记副本(2026-10-08):本行行首那个号是**六位接号畸形号** —— "上一轮改号"剥前缀时把新号与旧号数字直接相接(本族 `G-814`+`385`⇒`G-87`),尺子按它取不出主键,于是同一件事在台账里被算成两个标题。同题登记的持有行是「G-385 · A1改道校验只比大小不比内容」那一条(按标题前缀寻行,既不写行号也不写编号);本行摘掉行首畸形号、只留指针,不翻勾、不并抄、正文逐字保留。〕 **A1 改道校验只比大小不比内容（可立即修；归属：§26 C 盘改道线，本票持有人即我）** —— 见上文 A1 与现读落点。〔2026-09-29 改号(承 D168 第四遍收尾):剥掉双前缀后本行会与既有 **G-385**(标题「生产备份链日志的写入侧编码要改成UTF-8」)**同主键 —— 那不是畸形号而是**真撞号**,所以这里不剥前缀而是取当次空闲新号;原编号位写的是「G-G-」。〕 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-87」,派单以那条为准,本行不再单独派单。〕
```

- 原 L7475(L1 外部持有行 L15863):

```
- [ ] **★ 抓到本仓一处"造好没装车"：`apps/cli/src/tools/argument-validator.ts` 在生产面零调用方 ⇒ CLI 工具入参根本不校验** 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7477(L1 外部持有行 L8121):

```
- [ ] **4 道 blocking 门红在 HEAD(各归属会话处置,本会话不代改)**:① 门 77 `check-radius-single-source` —— 纯 HEAD 检出仍 **1179 处**违规而基线只 26 条,引入者 `36b1468b19c`(09-23 18:04 把全 8 端纳入范围)未同步重算基线;② 门 83 `check-brand-foreground` —— 点名 4 文件的 `bg-white` 不在基线(内容自 `26975a4bfdd` 即在,`54282d0037f` 补登时只加了 ChatScreen、漏了 ModelConfigDialog);③ 门 7 `check-dedupe` —— `pnpm-lock.yaml` 与全部 package.json 与 HEAD 逐字节同 ⇒ HEAD 已红,引入 `63d1952cf30`(merge 锁文件);④ **门 52 `check-no-visible-spawn` 是判据自身坏了** —— 8 处命中全落在 `scripts/check-git-read-timeout.mjs:269-324` 的反引号**夹具**内,而门 80 的自测明确断言夹具不该判 ⇒ 需给门 52 补夹具豁免(与门 79 的 E1 豁免同型)。**禁止用"调高基线"消红**(门 70 口径:清理后人工确认才下调,不得为过门平账)。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7478(L1 外部持有行 L11193):

```
- [ ] **本线仍未闭环的一件(归属明确,不是遗漏)**:守门 93 的 **R1/R2/R4/R5 那半边仍按磁盘读** 两份 token 源文件,而同文件 R3 段头(`scripts/check-cross-end-tokens.mjs:1367`)自己写着"扫**仓库内容**,不扫共享工作树的未提交缓冲区"⇒ 同一道门两种取材面,AGENTS「口径同 77/83/98:全量判 HEAD blob」对它**只对了一半**。静态证据(本机不得为取证去改共享 token 文件,故不给动态复现):`grep -n "readFileSync(RN_TOKENS_PATH\|readFileSync(TOKENS_CSS_PATH" scripts/check-cross-end-tokens.mjs` 命中 1297/1298/1563 三处主流程读取。**当前不构成红点**(实测两文件工作树==HEAD),按"未引爆不动他人面"登记;解阻判据:任一 `pnpm check:all` 轮里这道门因这两份文件报出与本次提交内容无关的差异,即当场按 R3/R6 同形收口(HEAD / 索引 + `--worktree` 逃生舱)。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7486(L1 外部持有行 L11199):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11568(G-362) 同题,派单以持有行为准,本行不再单独派单。〕 G-1018225 **桌面端「启动后先进托盘」在真机采样里出现过一次"启动 11 秒后窗口自行转为可见"（复现条件未定位，不是偶发即免检）**：同一份 debug 构建、同一份 `desktop-behavior.json`（`launch_minimized:true`）两次采样结论相反 —— 一次 `vis=0 all=1`（3s 与 11s 两趟都全程隐藏，符合预期），另一次 3s 隐藏而 11s 变可见。窗口始终存在（`all=1`），所以不是"没隐藏成功"，而是**某处在我看不到的时刻把它 show 了出来**。已知候选：`lib.rs` 的 12 处 `window.show()`（375 单实例回调 / 2326 / 2728 / 2982 托盘动作与快捷键 / 474-590 托盘菜单分支），以及 `auto_refresh` 的断网兜底守卫。接手第一步：把 show 调用点统一加一行 `log::info!("[window-show] 站点=<n> 触发=…")`，再做两时刻采样(启动后 3s 与 11s 各一趟)（枚举该 pid 全部顶层窗口并分 vis/all 计数，**只看 vis 会把"窗口还没创建"误判成"已隐藏"** —— 本票的相反结论就是这么来的）。判据：同一配置连采 5 趟，`all=1 ∧ vis=0` 恒成立才算收口。**同格第二项未闭环（一并登记，避免下一个人以为弹框那一路也测过）**：「关闭时询问」在真机上只验到**前端没接住**的那一侧（3s 看门狗落兜底隐藏，不卡死不静默退出）；**前端接住并答完**这一路未做真机验证 —— `tauri dev --config {"build":{"devUrl":"http://localhost:8861"}}` 实测仍加载线上 bundle（DevTools 标题 = aizhs.top/agents，设置页里根本没有新卡片），即 devUrl 覆盖在薄壳模式下不生效，要验这一路得先解决"如何让壳加载本地构建"。该行目前只有单测 + 桌面事件三层接线守门覆盖。 〔改派留痕(2026-09-28 台账归并):本行是已完成那条 G-328(主因已修)之后的**另一格残余现象**,与它不是同一行当前状态 ⇒ 另取一号;两行内容都逐字保留。〕 〔让号记录(2026-10-02 F9 清偿批②):原号 G-362 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕 〔现读更正@2026-10-06(据实,**不翻勾**):票面"接手第一步"要的观察点**已入库** —— `git show HEAD:apps/desktop/src-tauri/src/lib.rs` 里 `site=` 命中 **17** 处、`.show()` 命中 15 处,逐条对位后每个 show 调用点的紧邻上一行都带站点标签(枚 f8008a2b0e 由本会话落),`auto_refresh` 兜底守卫也在同一档。⇒ 本票的真待办**收窄为**"同一份配置连采 5 趟,看那 11 秒自行转可见是否还在" —— 那需要 debug 构建与真机窗口,属等环境条件,不是可派单可落项;所以状态照旧未勾。〕
```

- 原 L7491(L1 外部持有行 L4700):

```
- [ ]（进行中） **本轮未落地、需重做的一批(web 86 处内的键名对齐)**:该批次报告改了 4 个文件(`DeveloperKeyDialog` / `AiGenerationContent` / `PermissionSelector` / `helpers`),**逐条按内容复核后全部不在 HEAD**(`git grep <新键名> HEAD -- apps/web` 四处均 0 命中),工作区也已被并发会话覆盖 → 判为**丢失需重做**,不要当成已完成。中途我一度按"工作区里有"记成"已落地",那是读到了被覆盖前的窗口 —— 并行期复核一律以 **HEAD 对象树内容**为准(档案第 4 节已记此教训)。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记在 L13327(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L7497(L1 外部持有行 L15721):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）**台账畸形号这一轮的两件已做实、一件按原样交回(承接 G-606;因 G-606 此刻在台账里有两行同主键 ⇒ 进展不往那两行里塞,另立一行,选哪行当正本由台账判据持有人裁决,值守不替谁选边)**:① **已入库**——枚 d9bd452a33 向 `scripts/lib/plan-task-index.mjs` 纯新增 207 行,补 `f9GroupLine`/`malformedLine`/`MALFORMED_ID_RE`/`findMalformedRows`/`planMalformedStrip`/`verifyMalformedStrip` 等导出。**起因是线上断过一次**:枚 34cdd23454(18:47)让 `scripts/union-converge.mjs` 从该 lib 导入三个名字,而当时本地 HEAD 与远端 tip **两个面都没有这些导出** ⇒ `node scripts/git-sync-converge.mjs` 在模块实例化阶段就抛 SyntaxError(我 19:0x 现场撞到)。修复证明 = `union-converge --self-test` 61 例全绿(崩的时候根本跑不起来)+ 门 98 那两条 D1 归零。② **同一格远端走了另一条修法**——现读远端 tip 的 `union-converge.mjs` 只 `import { auditPlan }`(收窄导入侧,没补 lib),两条路都能让收敛器加载 ⇒ **合流时那一行必冲突**,正本由持有人裁决;本侧那份是纯新增、不改变任何既有导出。③ **已 parked 不丢**——`.ihui-agent/tmp/ledger-fm-finish/wip.patch`(926 行:live-doc-edit 生产者侧拦"手加前缀的取号写法" / plan-tasks.mjs 的 F9b 差值维 / 基线 json 的 F9b 锚点与注记 / plan-tasks-merge.mjs `--strip-malformed` 修复出口 218 行)+ 新镜像测试 `plan-task-baseline-f9b.test.mjs`。**两路派出的会话先后撞轮次上限**,上一路自述"一条测试都没写" ⇒ 合入前必须逐文件 `git diff --numstat` 对账并补 §22c 变异自证(没有"摘掉判据即翻红"的证据就不要合)。**在等什么**:等台账状态判据持有人接 ③(本票不带租约,因为值守此刻不在做它)。④ **顺带量到两格会误导下一个人的事实**:门 130 此刻在 `--gate` 与 `--gate --staged` 两档都 RC=1(存量撞号按键集合锚点),而 union-converge 的**落地闸因此拒过一次合并**——实测报告原文「F3 行号指针已腐烂 各侧最多 277,归并结果 284 ⇒ 判需人工,不推进」,这是它在正常工作,不是故障;另,门 98 对 `apps/cli/tests/*.test.ts` 里 `../../scripts/lib/*` 这种跨包向上两级说明符判 2 处 D2 是**假阳**:A/B 实测同一文件在 **HEAD 原状**下 `pnpm --filter @ihui/cli exec vitest run` 2 文件 / 20 例全通过(封缄 RC=0)⇒ 正解是收门 98 的解析口径或另档计,**不是去改那两个能跑的测试**(我一度顺手把深度改成三级,发现改前改后都绿 ⇒ 改动不解决问题,已逐字节还原、未入库)。 【编号改派留痕 2026-09-28 20:0x】原取号 G-632 与远端已入库的另一条登记(「分支代际计数器:异步解算期间分支被切换…」)撞号,门 130 的 F9 与合并落地闸同时点名。**这里让号不代表裁决谁才是 G-632 的正统** —— 只因为本侧这一枚尚未推送,让号是零成本的一侧;远端那一枚要不要动属它自己的持有人。取号一律现算(令牌由该次 HEAD 底稿 + 远端面 max 推出),不接受把号抄进文档。 (原编号 G-725;持有行题面「台账畸形号这一轮的两件已做实」)
```

- 原 L7508(L1 外部持有行 L15722):

```
- [ ]O594 票⑰ —— **`2f-ext` 升 blocking 已量好前置,按用户指令暂缓落地**(注册文件 `scripts/guardian-runner.mjs` 本轮不得改)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「O81 · 票⑰——2f-ext升blocking已量好前置」,派单以那条为准,本行不再单独派单。〕〔让号记录(2026-10-09 F9 清偿批⑤·机主拍板"代码引证与改动面大小冲突时以代码引证为准"):原号 O81 与「跨端 UI 单一源」工作线(9 行,AGENTS.md/README 等按本号引用)撞成一号两题,本族(O81 票⑰ 2f-ext 升 blocking 前置票,4 行,全仓无代码引证)让出原号,新号由取号令牌按当次 CAS 的 HEAD 现算;同族其余 3 行同批承让到同号。本行正文除编号位与本记录外逐字未动。〕
```

- 原 L7509(L1 外部持有行 L15856):

```
- [ ]O86b 托盘退出「设上限≠修好」:120s 兜底被用户驳回,改租约模型(默认 5s 必退) —— `c149514135` + tag `desktop-v0.1.47` 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「O86b · 托盘退出「设上限≠修好」」,派单以那条为准,本行不再单独派单。〕
```

- 原 L7513(L1 外部持有行 L15758):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L9959(G-417) 同题,派单以持有行为准,本行不再单独派单。〕 G-1018288 **全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红,登记以免被"修好我看见的那三道"再掩一次** —— ① 守门 [12] 交付报告一致性判 `PROJECT_PLAN.md` 自身违规 1 处:同一份账面里既写着"完整收尾/无后续建议"一类断言,又留着"后续工作/优化项"清单(AGENTS §10 那条互斥约束)。它在全量档是 warn、不挡提交,但它是**批量审计恒红清单**里的一项,留着就会有人天天来问"这红谁的"。出路只有两条且不得放宽判据:要么把该份报告改成"任务 X 已完成、还有 N 项后续"(推荐,因为活账确实还有),要么真把后续条目清干净再声明闭环。归该份批次报告的作者;现读定位:`node scripts/check-delivery-report-consistency.mjs`。② 同日实测的并发副作用登记:多会话同时提交时(本轮实测单窗口 27–47 枚),守门 [30a] 会把**别人重写提交留下的悬空对象**算在本次提交头上、[84] 会把**别人挂在共享索引里的暂存删除**报成待判 —— 两者本轮都已按仓里规定动作处置(悬空提交 `cf05a98386` 已 `git tag lost-commit/cf05a983` 备份并复跑 30a rc=0,其内容经祖先判据确认**已在主线**,零丢失;[84] 复跑 rc=0 并把那条暂存删除点名交回其持有人)。**留这一格是因为它没有判据**:目前没有任何一道门区分"本次引入的悬空"与"并发重写留下的同内容副本",而这型一旦攒多了就是 §22 那类丢 commit 事故的温床。③ 同轮只读量测的第三格(本机**此刻不成立**,故不是待修而是待防):六把常驻命令行工具在"调用方 cwd 不在仓库内"时仍都能解析到仓库(本机 `.git` 是指针文件,git 会向上找),所以依赖 cwd 的那一处今天没有实害;但 `scripts/union-converge.mjs` 与 `scripts/git-push-converge.mjs` **写死** `C:/Program Files/Git/cmd/git.exe`,而仓里已有唯一出口 `scripts/lib/gitdir.mjs`(§5b 明写"脚本一律不得依赖环境取 git"),另一台机(G 盘那份 checkout)实测 git 落点不同 ⇒ 换机即 ENOENT。`git-push-converge.mjs` 同时是唯一不按自身位置推根的一把(换个目录跑结论会变)。**取证教训一条,写给下一个想顺手"修"的人**:我第一轮把这些工具的失败猜成"模块顶层数组引用后声明常量 ⇒ TDZ",现读**否证**(那三处在函数体内求值),真因是我自己的探针把 msys 风格路径拼成了不存在的目录 —— 0 命中/含糊错先怀疑尺子,再怀疑世界,别照假设改生产工具。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-417 · 全量守门盘点」,派单以那条为准,本行不再单独派单。〕 〔让号记录(2026-10-02 F9 清偿批②):原号 G-417 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕
```

- 原 L7519(L1 外部持有行 L15701):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11128(G-453) 同题,派单以持有行为准,本行不再单独派单。〕 G-210 **台账 F4(重复登记副本)对"同一待办的漂移副本"结构上失明 —— 现读一例:同一条 D41后续① 在 HEAD 有 9 份未勾选副本、其中 7 份正文互不相同(2026-09-28 量)**: `plan-tasks.mjs` 的 F1/F4 判据是"编号 + 标题前缀**逐字等值**",这既是它的优点(不做相似度猜判)也是它的洞 —— 并发 union 每次都留一份**带自己注记**的副本,前缀之后的正文一漂移,复合主键就不再相等,于是同一件事以 N 份"未勾选"长期并存。后果不是账面难看而是**派单被放大 N 倍**:本日两次 `plan-tasks-merge.mjs --heal --commit`(归并 30 行 / 34 行)把 F1/F4 都归到 0,而这一族一份都没被动到 ⇒ "跑过归并"不等于"这一族被覆盖"。出路只有两条且都不该由机器代裁:① 归并线逐组判"哪份是当前状态"(需要读注记语义,机器判不了);② 给登记侧加一条硬约束——同一件事要更新就**就地改那一条**(§1 第 2 条已有此规矩,缺的是让机器能在前缀一致而正文漂移时也点名)。本票**只登记现读证据与两条出路**,不改判据、不批量翻勾(批量翻勾 = 把别人的注记当噪声删,比原病更响)。归属:分叉合并归并线(同 G-363 那条持有)。 (编号改派留痕(2026-09-28):本行原取 G-417,与「全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红」一条撞成一号两事;取号发生在分叉的两条腿上,号段不共享。让位的是**本行**(它是我这一路登记的),别人的行不动;新号由取号令牌按当次 CAS 的 HEAD 现算,落地后须复核它不与任何行首编号重复。正文一字未动。) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-417 · 台账F4」,派单以那条为准,本行不再单独派单。〕〔让号记录(2026-10-09 F9 清偿批⑤承接):同题同批承让到 G-210(持行由取号令牌现算,见该行让号记录;机主拍板 2026-10-09 代码引证优先,原号 G-417 留归「全量守门盘点」侧),本行正文除编号位与本记录外逐字未动。〕
```

- 原 L7522(L1 外部持有行 L15723):

```
- [ ] **测试**:`apps/api/tests/notify-deploy-failure.test.ts`(参数解析/env 优先级/收件人消解/From 构造/Resend payload 含 html/--strict 退出码)+ PS 侧镜像测试(证明 PS 已无自拼传输)。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7525(L1 外部持有行 L15724):

```
- [ ] `/api/agent/goal-verify` **无生产消费方**(端点已注册、测试已断言路由存在,但 goal 运行循环 〔当轮现读 2026-09-29 03:28Z:本行正文比同题持有行**短**(在某次 union 里被截断,现读到「但 goal 运行循环」就断), 而原条目已于 2026-09-28 判定并归档、另有已勾持有行(现行判定:独立校验轮已被运行循环调用;端点无调用方属对外能力取舍,不由 agent 单方删)。 本行**不翻勾也不补写**(补写等于凭空造正文)—— 要恢复须按历史版本逐字取回,归台账找回线;派单一律走持有行,勿照本行。〕
```

- 原 L7538(L1 外部持有行 L15864):

```
- [ ] **G-8 本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)** 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-580 · 本批全量终审186项=173通过/5警告/8失败」,派单以那条为准,本行不再单独派单。〕 〔让号记录(2026-10-02 F9 清偿批②):原号 G-580 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕 〔改号(2026-10-14):原G-1018297〕
```

- 原 L7541(L1 外部持有行 L15597):

```
- [ ]〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7422(G-3) 同题,派单以持有行为准,本行不再单独派单。〕 （待派/QODER-O81）G-1018302 **守门 149(包入口 barrel 漏 re-export)对"端内 barrel"整片失明,而它漏的正是能把整站打红的形态** —— 立票凭据不是推理:web 端本机现读 HTTP 500,响应体直接点名 `Export <某组件> doesn't exist in target module`,定位到「端内 barrel 没递出该符号,而同端消费方从 barrel 具名导入」;追溯还发现该符号**曾**在 barrel 里、被一枚"撤掉整条链"的提交摘掉而组件文件保留,之后有人重新引用却没复原出口。同一天另量到一处同型候选(另一张 barrel 与它的消费方),说明这不孤立。**为什么现有门看不见**:149 的候选集按 workspace 包入口(`packages/*/src/index.ts`)枚举,端内 barrel 从来不在面里(实测其 `--json` 输出中不含任何端内 barrel 路径);而管悬空导入的那道门判的是"符号根本不存在",这型是"符号存在而入口没递出",结构上互补不重叠。**后果不是"少一个类型错"**:本仓 web 构建设了 `ignoreBuildErrors`,端内 barrel 漏出口在本地与构建两侧都不红,只有点到那个位置的人知道 —— 与守门 72/78/149 立项时同一族"本地全绿、出事的是产物"。**扩面前置(不得跳过)**:先把存量一次量清(端内 barrel 全集 × 各自消费面 × 悬空具名导入数),再决定定级 —— 存量未清就 blocking 就是与任何提交无关的恒红门,唯一结局是各会话跳钩子、连带其余全部对账作废(§12e 同型);**不得**为让本票变绿去改判据或删引用。**顺带登记一条归属纪律**:那枚造成 500 的在飞引用属他人持有面,本票只登记现象与修法方向,不代改别人的文件。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-627 · 守门149」,派单以那条为准,本行不再单独派单。〕 〔让号记录(2026-10-02 F9 清偿批②):原号 G-627 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕
```

- 原 L7567(L1 外部持有行 L11184):

```
- [ ] **D173 AI 对话链路四竞品对标 V4 收口线(19 条差距 / 5 个 Sprint)** —— 唯一入口 `docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`(87–105),本轮不在此复述差距正文,只登记排期与等待项。**S9 尺子先行(105→97)**:先落 `scripts/audit-benchmark-delivery.mjs`(V3 §八 自留建议至今未落地,`ls` 实测不存在)与 parity 门六端扩面,**顺序不可颠倒** —— #93/#94/#96 之所以能长期存在,正是因为 §9「多端连通」的机器判据只覆盖 web 一端(`check-agent-event-parity.mjs:537` 只扫 `apps/web/src`)。**S10 移动端可达性(93→94→95)**:RN 主屏 `apps/mobile-rn/src/screens/ChatScreen.tsx:652` 起只接 7/30 回调(逐名 `comm -23` 算出缺 23 个,含 `onToolCall`/`onToolApproval`/`onPlanUpdate`/`onTerminal*`/`onSubagent*`/`onUsage`/`onBudget`/`onQuestion`/`onFormRequest`/`onReconnect`),而同端 `AiAssistantN8nScreen.tsx:1412` 是完整实现、`src/utils/chat-render-model.ts` 的 4 个 `apply*` 在主屏零调用方 ⇒ 本票主体是**接线不是开发**;#94 是信任型缺陷(RN 与小程序 `tool-approval` 双零命中,手机上遇高危操作无弹窗)。**S11 保真(87→88→89→92)**、**S12 契约地基(99→100→101→102)**、**S13 传输计量收口(96→90→91→103→98)**。**等待项(归属:等用户拍板)**:#100 内置默认高危集**改变默认行为**(现 `_high_risk_tools_from_env` 未配 env 即 `frozenset()`,`agent_loop_v2.py:288-296`),按 §24 不得由实现票自行开工;#98 桌面端薄壳是 V3 #72 已拍板架构,本票**只对齐三处口径**(tauri.conf / `ensure-web-out.mjs` 自称唯一校验点 / `docs/MULTI_END.md §2.5`),不改选型。**解阻前置(可判)**:S10 之前必须先有 S9 的端能力档案表,否则清完的端下轮又漏。**本轮同时否证 7 条断言,均写进 V4 正文,不得照旧文派单**:①②③ 上述三条 V3 过期结论;④ `packages/app` 的 `ChatScreen` 并非「未导出」—— `src/index.ts:684` 导出在位,真问题是**全仓零消费方**(同包其它 4 个聊天屏都被 mobile-rn 复用)⇒ 归 #95;⑤ web **有**消息队列与 Steer(`queue-interaction-bar.tsx` 在库,D38 已✅)⇒ 队列**不是**差距,初稿列错了;⑥ #89 初稿「主聊天流无自动重连」**否证** —— api-client `client.ts:2078/2129/3443` 有重连与 `Last-Event-ID` 续传,web `send-message.ts:767-775` 已消费 `onReconnect`,缺陷窄化为「`connection-status.tsx` 四态件生产面零挂载(命中全在 `apps/web/tests/agent-task-progress-pane.test.tsx`) + 重连后待决审批恢复未取证」;#96 那句「web 反而没有续传」同批否证;⑦ 孤儿清单里的 `voice-note.tsx` 在 HEAD 与索引双双落空,只在工作树未跟踪面 ⇒ 摘出清单、按 §12 归属未定不动。**本轮交付**:V4 文档成文并注水印(`docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`,`watermark.mjs verify` 覆盖 1/1、残迹 0、损坏 0);六端回调覆盖数改用统一交集判据重算(web 全域 30/30、extension 19、cli 12、RN 主屏 7、RN 另一屏 17、miniapp 17),并登记「事件名口径 23 与回调名口径 17 不可混用」。**待办本体是 S9–S13 的实施,本行不因文档成文而翻勾。****本轮同时更正 3 条 V3 过期结论,不得照它们派单**:#73「小程序无 AI 对话页」已被代码推翻(`apps/miniapp-taro/src/pkg-ai/ai/chat.tsx` 1623 行,最新提交 `3f3e71a99` 09-27,按事件名覆盖 23/30);#51「`run_in_background` 只有 sleep/echo」已不成立(`task_executors.py` 现读 16 个 `async def` + import 期三面断言);#47「三套执行内核」应为「一套半」(`class AgentLoopV2` 唯一内核,但 `agent_loop.py` 仍以 `agent_executor` 被 `routers/agents.py:48`、`services/a2a_service.py:33`、`services/slash_commands.py:162` 三处生产引用)。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `DD128`(族名在编号段出现两次;而第一次修正产出的 `D-172` **带连接符、不属于台账编号族** —— 唯一真相源 `check-plan-line-loss.mjs` 的 `TASK_ID_PATTERN` 里 D 族写作 `Dd+`(只有 G 族带 `-`),带横杠的号对防丢面与复合主键**双双隐身**,比畸形号更糟:它看起来像有号。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 D-128 已被 8 行认领(L7174,7551,7721,7927…),改回就等于替这本账再加一枚撞号;现号 `D173`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「D173 · AI对话链路四竞品对标V4收口线」,派单以那条为准,本行不再单独派单。〕
```

- 原 L7572(L1 外部持有行 L8049):

```
- [ ]〔【归并】重复登记副本(2026-10-08):本行行首那个号是**六位接号畸形号** —— "上一轮改号"剥前缀时把新号与旧号数字直接相接(本族 `G-811`+`336`⇒`G-811336`),尺子按它取不出主键,于是同一件事在台账里被算成两个标题。同题登记的持有行是「G-761 · plan-tasks-merge」那一条(按标题前缀寻行,既不写行号也不写编号);本行摘掉行首畸形号、只留指针,不翻勾、不并抄、正文逐字保留。〕 **`plan-tasks-merge.mjs --dedupe-blocks` 的阈值覆盖不到"两行逐字相同的单行副本"这一型（现读实证：86H 那一条已完成行在 HEAD 面有 2 份逐字相同副本 —— 计数用 `git show HEAD:PROJECT_PLAN.md | grep -c "86H. agent 审批的权限决策落审计链"` = 2；按 §1 判据 3 不写行号，行号在 append 后必挪位）**：该出口只认 **≥3 行且每行 ≥40 字符的连续 bullet 块逐字相同**（阈值本身是对的 —— 低于它会把台账里天然成对的短行成百地报出来，噪声淹信号），于是"同一件事被写成两份、每份都是单行"恰好落在缝隙里；而 F1/F2/F4 也都不计它（四条判据里"待办副本"要求未勾形态，两份都已 `[x]` ⇒ 账面 0，`plan-tasks.mjs --staged` 现读 F 维全 0）。**这一型有两条候选制造路径(本票未定性,不得读成已归因)**:活文档 union 把改写前那份带回来;门 71 的 post-commit 自愈按标记回捞"丢失"的行 —— 若那一行其实是被**就地改写**(旧行已按 §1 留在原位、新行另处再写一份),回捞就会补出第二份。定性要跑一次可控复现(独立临时仓里"改写一行 → 触发自愈"看它补不补),不在本票顺手做。**在等谁**：归并器持有人裁 —— 出路只有两条且都要人拍：a) 给 `--dedupe-blocks` 加"同主键 + 逐字等值 + 已完成形态"的单行档（判据必须是**逐字等值**，半行不同就交人工，理由同它现有那条"机器折半即有损"）；b) 或在门 71 自愈侧改为"编号在面上已存在即不追加"（那是生产者侧收口，比事后清账更对，但要证明不会把真丢行也一并按住）。**不得**由本票手工删行：删已完成行受 §1"禁止无声删除"约束，而两份哪份作数要按主键而不是按行号（§1 判据 3 已把行号指针判为不可用作证据）。〔2026-09-29 改号(承 D168 第四遍收尾):剥掉双前缀后本行会与既有 **G-336**(标题「分叉合并这次"丢掉的东西"与"互相矛盾的两行文档」)**同主键 —— 那不是畸形号而是**真撞号**,所以这里不剥前缀而是取当次空闲新号;原编号位写的是「G-G-」。〕 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-811336 · plan-tasks-merge」,派单以那条为准,本行不再单独派单。〕
```

- 原 L7573(L1 外部持有行 L7608):

```
- [ ]〔【归并】重复登记副本(2026-10-08):本行行首那个号是**六位接号畸形号** —— "上一轮改号"剥前缀时把新号与旧号数字直接相接(本族 `G-813`+`374`⇒`G-813374`),尺子按它取不出主键,于是同一件事在台账里被算成两个标题。同题登记的持有行是「G-402 · 设置项"显式清空"与"从未设置"无差」那一条(按标题前缀寻行,既不写行号也不写编号);本行摘掉行首畸形号、只留指针,不翻勾、不并抄、正文逐字保留。〕 **设置项"显式清空"与"从未设置"无差，且读侧同一含义两键相反（需拍板；归属：api 设置面 + web 设置页持有人）** —— 已亲自复验：`apps/api/src/routes/user/settings-routes.ts:55` 写体是 `z.record(z.string(), z.unknown())`，落库处 `value === null || value === undefined ? null : String(value)` ⇒ `null` 与"缺席"存成同一个 NULL 行；读侧 `apps/web/app/(main)/settings/notifications/page.tsx:48-52` 四键混用 `!== 'false'`（默认真）与 `=== 'true'`（默认假），于是**同一个被清空的值，在前一族读回 true、在后一族读回 false**。上游同族做法是把三态写进契约（`settings/pluginConfigPatch.ts:29-36`：`undefined`=未触碰跳过、`null`=进 `clearOptionKeys`、sensitive 空串=不改已有值；落库侧 `file-config.adapter.ts:557-565` 按 option key 合并而非整对象替换，防同 scope 密钥被静默清空）。**为什么还开着**：改成三态要动 PUT 语义（单键 DELETE 出口我方根本没有——`deleteUserPreference` 只服务 devices），属对外契约决策；先拍"要不要有删键出口"，再谈读侧归一。**不得**靠"读侧统一成 `=== 'true'`"消红——那会把默认真的四项静默翻转。〔2026-09-29 改号(承 D168 第四遍收尾):剥掉双前缀后本行会与既有 **G-374**(标题「G-374ihui-auth-user里存了is」)**同主键 —— 那不是畸形号而是**真撞号**,所以这里不剥前缀而是取当次空闲新号;原编号位写的是「G-G-」。〕 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-813374 · 设置项"显式清空"与"从未设置"无差」,派单以那条为准,本行不再单独派单。〕
```

- 原 L7574(L1 外部持有行 L15717):

```
- [ ]〔【归并】重复登记副本(2026-10-08):本行行首那个号是**六位接号畸形号** —— "上一轮改号"剥前缀时把新号与旧号数字直接相接(本族 `G-814`+`385`⇒`G-87`),尺子按它取不出主键,于是同一件事在台账里被算成两个标题。同题登记的持有行是「G-385 · A1改道校验只比大小不比内容」那一条(按标题前缀寻行,既不写行号也不写编号);本行摘掉行首畸形号、只留指针,不翻勾、不并抄、正文逐字保留。〕 **A1 改道校验只比大小不比内容（可立即修；归属：§26 C 盘改道线，本票持有人即我）** —— 见上文 A1 与现读落点。〔2026-09-29 改号(承 D168 第四遍收尾):剥掉双前缀后本行会与既有 **G-385**(标题「生产备份链日志的写入侧编码要改成UTF-8」)**同主键 —— 那不是畸形号而是**真撞号**,所以这里不剥前缀而是取当次空闲新号;原编号位写的是「G-G-」。〕 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-87 · A1改道校验只比大小不比内容」,派单以那条为准,本行不再单独派单。〕
```

- 原 L7622(L1 外部持有行 L15724):

```
- [ ] `/api/agent/goal-verify` **无生产消费方**(端点已注册、测试已断言路由存在,但 goal 运行循环 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7623(L1 外部持有行 L8010):

```
- [ ] 钩子 trust 的**残余面**:webhook 形态钩子仍不过门(本批按 command 收口); 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7675(L1 外部持有行 L7603):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-10-08·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-764 **配置分层的"出处标签"与"请求档 vs 实得档"留痕(归属:cli/子代理线持有人;等产品拍板)** —— 上游 `packages/provider/src/resolver.ts:190/196/208` 三层 overlay 且每个生效对象带 `source` 标签、快照的 `sourceRevisions` 被真实消费;我方 `apps/cli/src/subagents/precedence.ts:195-205` 的四层短路链**没有出处标签**,且 `git grep -I "requestedEffort\|effectiveEffort\|validateModelSelection"` HEAD 面现读 **0 命中** ⇒ 静默降档无法归因。**为什么还开着**:新建"配置分层解析出口"属 §24 新增能力、且是跨端数据建模,不在本轮取证范围;上游那两格(`effective-model-selection.ts` 的 `selectionIssue` 六值枚举、`model-selection-config.ts:76-77`"不能静默补档位")是它的前置形状,可作参考实现但不是本轮交付物。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `G-G-356`(族名在编号段出现两次)。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 G-356 已被 9 行认领(L8274,8529,8619,8646…),改回就等于替这本账再加一枚撞号;现号 `G-764`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。 (原编号 G-764;持有行题面「配置分层的"出处标签"与"请求档vs实得档"留痕」)
```

- 原 L7677(L1 外部持有行 L7605):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-10-08·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-766 **锁的"租约认 token 不认 pid"一格只登记、未代裁(归属:`git-lock`/`deploy-lock` 持有人)** —— 上游 `packages/provider-node/src/zcode-builtin-remote-synchronizer.ts:85` 取 `leaseId=randomUUID`、`:143` 的 `#finishLease` 只在 leaseId 相等时才改控制文件,于是"pid 被系统复用"这一型**结构上不可能发生**;而我方是事后补的一环(`scripts/lib/proc-identity.mjs` 的 match/mismatch/unverifiable,承 G-193 那次冻结 11h50m)。**为什么还开着**:改两处锁的 meta 属锁持有人领地,且今天没有可复现的抢占现场做验收依据;真要收它,判据应是"注入一次 leaseId 不相等的迟到 finish 请求,控制文件必须不被改动",而不是"代码写了 leaseId"。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `G-G-358`(族名在编号段出现两次)。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 G-358 已被 9 行认领(L8276,8531,8621,8648…),改回就等于替这本账再加一枚撞号;现号 `G-766`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。 (原编号 G-766;持有行题面「锁的"租约认token不认pid"一格只登记」)
```

- 原 L7678(L1 外部持有行 L7606):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-10-08·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-767 **第八轮剩余六格候选清单(归属:未派;等各线排期;本轮只取证未实现,逐格带出处)** —— ① 跨层发布闸:上游 `registry-service.ts:205-212` 在"下层已变而上层仍基于旧事实"时**不发混合快照**、继续服务上一份完整 Registry,而我方这条纪律只活在门的散文里、运行时层无出口;② 稀疏 overlay 空即删:`config-service.ts:513-516` 与继承值等价的配置不落盘(absence=继承,不是"空覆盖");③ 诊断量代替原文:`officialMcpCredentials.ts:52-90/359-376` 只记 JWT 剩余秒数并按小时分桶去重,可接我方唯一脱敏出口 `packages/shared/src/utils/redact.ts`;④ 告警去重身份=桶+周期而非墙钟窗口:`startPlanQuotaReminderStore.ts:33-36` 用快照 `referenceTime` 裁决(设备时间可能已越过服务端周期)、`bucketReminderKey` 缺任一字段即不提醒;⑤ in-flight 合并 + CAS 驱逐:`zaiStartPlanBilling.ts:113-122` 失败响应同样保留 1s(防 429 后立刻重复请求)且驱逐前 `if (requests.get(k) !== request) return`(旧请求不得删新记录),上游该守卫三处同形,是我方共享工作区并发写可直接取用的最小实现;⑥ 幂等 key 复用规则:`codingPlanQuotaResetCoordinator.ts:307-329` 瞬时错复用原 key、成功或稳定错才置 null,且服务端 `next_try_at` 必须透传(:617-624)。**为什么还开着**:六格都是"能落但需各自定级与验收"的独立改动(①②碰运行时快照语义、③④⑤⑥碰告警与并发路径),打包成一票会互相遮蔽;派单时逐格取,勿一次全接。**另有一格需产品先定**:上游 `usage-quota.ts:71` 的 `percentage` 是**已用**占比、而 Start Plan 侧 `:1338` 同名字段是**剩余/总额**,现靠"两族走不同 reader"规避,**无类型或判据看守** —— 要不要收口成"以 remaining 为权威、percentage 仅降级",属契约决策。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `G-G-359`(族名在编号段出现两次)。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 G-359 已被 9 行认领(L8277,8532,8622,8649…),改回就等于替这本账再加一枚撞号;现号 `G-767`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。 (原编号 G-767;持有行题面「第八轮剩余六格候选清单」)
```

- 原 L7679(L1 外部持有行 L7607):

```
- [ ]〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7697(G-401) 同题,派单以持有行为准,本行不再单独派单。〕 （进行中@2026-10-05/g1-main）G-768 **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `G-G-373`(族名在编号段出现两次)。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 G-373 已被 20 行认领(L7678,7853,7954,8154…),改回就等于替这本账再加一枚撞号;现号 `G-768`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。 〔拍板 2026-10-05(机主选"未知即按写处理"):MCP 工具默认档不再算 `read` —— 需批准、失败不自动重跑;确实只读者按"服务器 + 工具名"显式登记白名单并把白名单纳入跨语言对账。落点在 `apps/cli/src/tools/hub/mcp-adapter.ts` 与权限档两侧持有人;派单排在 G-710 那枚同目录代理之后,避免两个代理同改一个文件〕 〔拍板@2026-10-07 机主:两步走——①先给14枚无标注工具补显式dangerLevel(零行为变更);②MCP适配层缺省翻dangerous(要批准),对照上游clientHello事故与#94手机高危无弹窗信任缺陷;cli权限档持有人按此执行〕 〔拍板@2026-10-07 机主:两步走——①先给14枚无标注工具补显式dangerLevel(零行为变更);②MCP适配层缺省翻dangerous(要批准),对照上游clientHello事故与#94手机高危无弹窗信任缺陷;cli权限档持有人按此执行〕
```

- 原 L7680(L1 外部持有行 L7608):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-10-08·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-769 **设置项"显式清空"与"从未设置"无差，且读侧同一含义两键相反（需拍板；归属：api 设置面 + web 设置页持有人）** —— 已亲自复验：`apps/api/src/routes/user/settings-routes.ts:55` 写体是 `z.record(z.string(), z.unknown())`，落库处 `value === null || value === undefined ? null : String(value)` ⇒ `null` 与"缺席"存成同一个 NULL 行；读侧 `apps/web/app/(main)/settings/notifications/page.tsx:48-52` 四键混用 `!== 'false'`（默认真）与 `=== 'true'`（默认假），于是**同一个被清空的值，在前一族读回 true、在后一族读回 false**。上游同族做法是把三态写进契约（`settings/pluginConfigPatch.ts:29-36`：`undefined`=未触碰跳过、`null`=进 `clearOptionKeys`、sensitive 空串=不改已有值；落库侧 `file-config.adapter.ts:557-565` 按 option key 合并而非整对象替换，防同 scope 密钥被静默清空）。**为什么还开着**：改成三态要动 PUT 语义（单键 DELETE 出口我方根本没有——`deleteUserPreference` 只服务 devices），属对外契约决策；先拍"要不要有删键出口"，再谈读侧归一。**不得**靠"读侧统一成 `=== 'true'`"消红——那会把默认真的四项静默翻转。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `G-G-374`(族名在编号段出现两次)。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 G-374 已被 20 行认领(L7676,7851,7925,8152…),改回就等于替这本账再加一枚撞号;现号 `G-769`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。 (原编号 G-769;持有行题面「设置项"显式清空"与"从未设置"无差」)
```

- 原 L7685(L1 外部持有行 L8049):

```
- [ ] **`plan-tasks-merge.mjs --dedupe-blocks` 的阈值覆盖不到"两行逐字相同的单行副本"这一型（现读实证：86H 那一条已完成行在 HEAD 面有 2 份逐字相同副本 —— 计数用 `git show HEAD:PROJECT_PLAN.md | grep -c "86H. agent 审批的权限决策落审计链"` = 2；按 §1 判据 3 不写行号，行号在 append 后必挪位）**：该出口只认 **≥3 行且每行 ≥40 字符的连续 bullet 块逐字相同**（阈值本身是对的 —— 低于它会把台账里天然成对的短行成百地报出来，噪声淹信号），于是"同一件事被写成两份、每份都是单行"恰好落在缝隙里；而 F1/F2/F4 也都不计它（四条判据里"待办副本"要求未勾形态，两份都已 `[x]` ⇒ 账面 0，`plan-tasks.mjs --staged` 现读 F 维全 0）。**这一型有两条候选制造路径(本票未定性,不得读成已归因)**:活文档 union 把改写前那份带回来;门 71 的 post-commit 自愈按标记回捞"丢失"的行 —— 若那一行其实是被**就地改写**(旧行已按 §1 留在原位、新行另处再写一份),回捞就会补出第二份。定性要跑一次可控复现(独立临时仓里"改写一行 → 触发自愈"看它补不补),不在本票顺手做。**在等谁**：归并器持有人裁 —— 出路只有两条且都要人拍：a) 给 `--dedupe-blocks` 加"同主键 + 逐字等值 + 已完成形态"的单行档（判据必须是**逐字等值**，半行不同就交人工，理由同它现有那条"机器折半即有损"）；b) 或在门 71 自愈侧改为"编号在面上已存在即不追加"（那是生产者侧收口，比事后清账更对，但要证明不会把真丢行也一并按住）。**不得**由本票手工删行：删已完成行受 §1"禁止无声删除"约束，而两份哪份作数要按主键而不是按行号（§1 判据 3 已把行号指针判为不可用作证据）。〔2026-09-29 改号(承 D168 第四遍收尾):剥掉双前缀后本行会与既有 **G-336**(标题「分叉合并这次"丢掉的东西"与"互相矛盾的两行文档」)**同主键 —— 那不是畸形号而是**真撞号**,所以这里不剥前缀而是取当次空闲新号;原编号位写的是「G-G-」。〕〔【归并】重复登记副本(2026-10-07):同主键的另一条登记 「G-761 · plan-tasks-merge」,派单以那条为准,本行不再单独派单。〕
```

- 原 L7686(L1 外部持有行 L7608):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7698(G-402) 同题,派单以持有行为准,本行不再单独派单。〕 **设置项"显式清空"与"从未设置"无差，且读侧同一含义两键相反（需拍板；归属：api 设置面 + web 设置页持有人）** —— 已亲自复验：`apps/api/src/routes/user/settings-routes.ts:55` 写体是 `z.record(z.string(), z.unknown())`，落库处 `value === null || value === undefined ? null : String(value)` ⇒ `null` 与"缺席"存成同一个 NULL 行；读侧 `apps/web/app/(main)/settings/notifications/page.tsx:48-52` 四键混用 `!== 'false'`（默认真）与 `=== 'true'`（默认假），于是**同一个被清空的值，在前一族读回 true、在后一族读回 false**。上游同族做法是把三态写进契约（`settings/pluginConfigPatch.ts:29-36`：`undefined`=未触碰跳过、`null`=进 `clearOptionKeys`、sensitive 空串=不改已有值；落库侧 `file-config.adapter.ts:557-565` 按 option key 合并而非整对象替换，防同 scope 密钥被静默清空）。**为什么还开着**：改成三态要动 PUT 语义（单键 DELETE 出口我方根本没有——`deleteUserPreference` 只服务 devices），属对外契约决策；先拍"要不要有删键出口"，再谈读侧归一。**不得**靠"读侧统一成 `=== 'true'`"消红——那会把默认真的四项静默翻转。〔2026-09-29 改号(承 D168 第四遍收尾):剥掉双前缀后本行会与既有 **G-374**(标题「G-374ihui-auth-user里存了is」)**同主键 —— 那不是畸形号而是**真撞号**,所以这里不剥前缀而是取当次空闲新号;原编号位写的是「G-G-」。〕〔【归并】重复登记副本(2026-10-07):同主键的另一条登记 「G-402 · 设置项"显式清空"与"从未设置"无差」,派单以那条为准,本行不再单独派单。〕
```

- 原 L7687(L1 外部持有行 L15717):

```
- [ ] **A1 改道校验只比大小不比内容（可立即修；归属：§26 C 盘改道线，本票持有人即我）** —— 见上文 A1 与现读落点。〔2026-09-29 改号(承 D168 第四遍收尾):剥掉双前缀后本行会与既有 **G-385**(标题「生产备份链日志的写入侧编码要改成UTF-8」)**同主键 —— 那不是畸形号而是**真撞号**,所以这里不剥前缀而是取当次空闲新号;原编号位写的是「G-G-」。〕〔【归并】重复登记副本(2026-10-07):同主键的另一条登记 「G-385 · A1改道校验只比大小不比内容」,派单以那条为准,本行不再单独派单。〕
```

- 原 L7692(L1 外部持有行 L7695):

```
- [ ] **[归并]** 本行与「G-14」同题(那一行是同一件事走预留段让号后的登记),是半途让号 + 自愈回捞留下的重复副本 ⇒ 只落状态、不删行、不重复计账;原文逐字留档于 .ihui-agent/archive/PROJECT_PLAN_yielded-ids-2026-09-29.md。 **生产服务的实际入口(3 个 `deploy/prod-bundle/svc/run-*.ps1`)不在版本库里,而唯一看得见它的判据只报数不判红** —— 现读(2026-09-29,`nssm get IHUI-API AppParameters`):`IHUI-API` 跑的是 `D:\IHUI-AI\deploy\prod-bundle\svc\run-api.ps1`,该目录整目录被 `.gitignore` 忽略,`git ls-files deploy/prod-bundle` 零命中 ⇒ 这 207 行(含 PostgreSQL readiness 前置轮询、`SWAGGER_API_KEY` 读取、PATH 注入、上界推导)**没有任何提交链判据、没有 review、没有历史**。这正是 AGENTS §5e 写过的那一型("落进 `deploy/prod-bundle/` 的运维脚本必须同时落一份入库源,否则等于写进盲区"),而 `scripts/check-prod-bundle-shadow.mjs` 的 E1 对未登记项**刻意只报数不判红**(该目录只存在于部署机,当场判红就是恒红门,§12e),所以这一格的存在形态是"账面全绿"。存量清单(现读):`run-api.ps1` 207 行 / `run-web.ps1` 45 行 / `run-ai.ps1` 15 行,合计 267 行运行态真身。收口办法与 `monitor.ps1` 同法(入库源 + 三行转发壳,路径不变 ⇒ **不需要动 nssm、不需要重启服务**):`deploy/win/` 落真身、`prod-bundle/svc/run-*.ps1` 换成转发壳,然后把三对加进 `check-prod-bundle-shadow.mjs` 的 `PAIRS`,由 S0–S3 逐字节等值接管。三条前置,缺一条就别动:① `run-api.ps1` 内有 **1 处 `$PSScriptRoot`**,搬家会改它的解析基准(必须先定位那一处并改成显式仓库根);② 转发壳必须 `& $source @args` 且透传 `$LASTEXITCODE`(monitor.ps1 那处的既有教训);③ 收编后必须实测**下一次服务重启**能正常起来 —— 而此刻部署环因远端分叉已冻结 120+ 轮(`BLOCKED-DIVERGED`),服务不会被自动重启,所以这一票真正安全的落地时机是"分叉裁决完、部署环恢复切流之后",不是现在。**归属:分叉裁决完成后接下一班运维**;本票只登记,不在冻结窗口里动生产入口。 〔【归并】重复登记副本(2026-10-12):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔改号(2026-10-14):原G-815916〕
```

- 原 L7704(L1 外部持有行 L15728):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-09 批⑦执行):本行与同题持有行重复,现摘掉声明位编号只留指针;注记逐字携带原加粗头原文「D173 断线窗口待决审批的重放(承 D131 取证;等 §24 拍板 A/B/C)」,是为了让守门 71 的原文前缀判据(标记 = 加粗头前 ≤18 字,遇 * 即停)继续命中 —— 该门明写刻意不给「正文仍在即视为搬家」的豁免,所以摘号必须把原文留在行内,否则下一轮自愈会把旧号行整条捞回(批⑤ 至今「复活再摘」四轮即此循环)。派单以 D1047 持有行 为准,正文逐字保留,不翻勾、不并抄。〕**断线窗口待决审批的重放(承 D131 取证;等 §24 拍板 A/B/C)** —— 取证已证"会丢"(`apps/ai-service/tests/test_d131_pending_approval_resume.py` 6 例 RC=0)。三条修法与爆炸半径:A=服务端在重连时重放仍待决的条目(改 `llm.py::_approval_sessions` 与 agents 侧待决表的取用点,**须与 `sse_contract` 同批**);B=让主对话流帧出口写 `id:`(动 `_sse()` 是全仓共用出口 ⇒ 影响所有流式消费端与两侧契约,须单独票 + 跨端同批);C=端侧在重连后显式再拉一次待决清单(新增一次读端点,不改服务端语义)。**等谁**:用户拍板选哪条(推荐 A,理由是"不新造对外能力、只补重放"),B 的跨端代价最大。**为什么不在本轮做**:票面写"证实会丢则修在服务端",但服务端改动与并行会话持有面(`llm.py`、`sse_contract.py` 此刻均 ` M`)撞车,按 §12 不代收。 —— 租约(2026-10-02):票面那句『此刻均 ` M`』的阻塞前提已解除(`app/routers/llm.py` 与 `app/core/sse_contract.py` 现读工作树 == HEAD),按票面推荐口径 **A** 开工:服务端在重连时重放仍待决的条目,与 `sse_contract` 同批;爆炸半径与验收以票面 A 档为准。
```

- 原 L7707(L2 族内归并,保留 L7706):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-09 批⑤复活再摘③):本行已让号至 D1047(持行在面),复活旧态摘号留指针,正文逐字保留。〕断线窗口待决审批的重放(承 D131 取证;等 §24 拍板 A/B/C)** —— 取证已证"会丢"(`apps/ai-service/tests/test_d131_pending_approval_resume.py` 6 例 RC=0)。三条修法与爆炸半径:A=服务端在重连时重放仍待决的条目(改 `llm.py::_approval_sessions` 与 agents 侧待决表的取用点,**须与 `sse_contract` 同批**);B=让主对话流帧出口写 `id:`(动 `_sse()` 是全仓共用出口 ⇒ 影响所有流式消费端与两侧契约,须单独票 + 跨端同批);C=端侧在重连后显式再拉一次待决清单(新增一次读端点,不改服务端语义)。**等谁**:用户拍板选哪条(推荐 A,理由是"不新造对外能力、只补重放"),B 的跨端代价最大。**为什么不在本轮做**:票面写"证实会丢则修在服务端",但服务端改动与并行会话持有面(`llm.py`、`sse_contract.py` 此刻均 ` M`)撞车,按 §12 不代收。 —— 租约(2026-10-02):票面那句『此刻均 ` M`』的阻塞前提已解除(`app/routers/llm.py` 与 `app/core/sse_contract.py` 现读工作树 == HEAD),按票面推荐口径 **A** 开工:服务端在重连时重放仍待决的条目,与 `sse_contract` 同批;爆炸半径与验收以票面 A 档为准。
```

- 原 L7708(L2 族内归并,保留 L7706):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-09 批⑤复活再摘②):本行已让号至 D1047(持行在面),复活旧态摘号留指针,正文逐字保留。〕断线窗口待决审批的重放(承 D131 取证;等 §24 拍板 A/B/C)** —— 取证已证"会丢"(`apps/ai-service/tests/test_d131_pending_approval_resume.py` 6 例 RC=0)。三条修法与爆炸半径:A=服务端在重连时重放仍待决的条目(改 `llm.py::_approval_sessions` 与 agents 侧待决表的取用点,**须与 `sse_contract` 同批**);B=让主对话流帧出口写 `id:`(动 `_sse()` 是全仓共用出口 ⇒ 影响所有流式消费端与两侧契约,须单独票 + 跨端同批);C=端侧在重连后显式再拉一次待决清单(新增一次读端点,不改服务端语义)。**等谁**:用户拍板选哪条(推荐 A,理由是"不新造对外能力、只补重放"),B 的跨端代价最大。**为什么不在本轮做**:票面写"证实会丢则修在服务端",但服务端改动与并行会话持有面(`llm.py`、`sse_contract.py` 此刻均 ` M`)撞车,按 §12 不代收。 —— 租约(2026-10-02):票面那句『此刻均 ` M`』的阻塞前提已解除(`app/routers/llm.py` 与 `app/core/sse_contract.py` 现读工作树 == HEAD),按票面推荐口径 **A** 开工:服务端在重连时重放仍待决的条目,与 `sse_contract` 同批;爆炸半径与验收以票面 A 档为准。
```

- 原 L7709(L1 外部持有行 L15728):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-09 批⑤复活再摘):本行已让号至 D1047(持行在面),复活旧态摘号留指针,正文逐字保留。〕**断线窗口待决审批的重放(承 D131 取证;等 §24 拍板 A/B/C)** —— 取证已证"会丢"(`apps/ai-service/tests/test_d131_pending_approval_resume.py` 6 例 RC=0)。三条修法与爆炸半径:A=服务端在重连时重放仍待决的条目(改 `llm.py::_approval_sessions` 与 agents 侧待决表的取用点,**须与 `sse_contract` 同批**);B=让主对话流帧出口写 `id:`(动 `_sse()` 是全仓共用出口 ⇒ 影响所有流式消费端与两侧契约,须单独票 + 跨端同批);C=端侧在重连后显式再拉一次待决清单(新增一次读端点,不改服务端语义)。**等谁**:用户拍板选哪条(推荐 A,理由是"不新造对外能力、只补重放"),B 的跨端代价最大。**为什么不在本轮做**:票面写"证实会丢则修在服务端",但服务端改动与并行会话持有面(`llm.py`、`sse_contract.py` 此刻均 ` M`)撞车,按 §12 不代收。 —— 租约(2026-10-02):票面那句『此刻均 ` M`』的阻塞前提已解除(`app/routers/llm.py` 与 `app/core/sse_contract.py` 现读工作树 == HEAD),按票面推荐口径 **A** 开工:服务端在重连时重放仍待决的条目,与 `sse_contract` 同批;爆炸半径与验收以票面 A 档为准。
```

- 原 L7710(L2 族内归并,保留 L7706):

```
- [ ]（【归并】重复登记副本·同题不同编号·2026-10-08·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）*D1047 断线窗口待决审批的重放(承 D131 取证;等 §24 拍板 A/B/C)** —— 取证已证"会丢"(`apps/ai-service/tests/test_d131_pending_approval_resume.py` 6 例 RC=0)。三条修法与爆炸半径:A=服务端在重连时重放仍待决的条目(改 `llm.py::_approval_sessions` 与 agents 侧待决表的取用点,**须与 `sse_contract` 同批**);B=让主对话流帧出口写 `id:`(动 `_sse()` 是全仓共用出口 ⇒ 影响所有流式消费端与两侧契约,须单独票 + 跨端同批);C=端侧在重连后显式再拉一次待决清单(新增一次读端点,不改服务端语义)。**等谁**:用户拍板选哪条(推荐 A,理由是"不新造对外能力、只补重放"),B 的跨端代价最大。**为什么不在本轮做**:票面写"证实会丢则修在服务端",但服务端改动与并行会话持有面(`llm.py`、`sse_contract.py` 此刻均 ` M`)撞车,按 §12 不代收。 —— 租约(2026-10-02):票面那句『此刻均 ` M`』的阻塞前提已解除(`app/routers/llm.py` 与 `app/core/sse_contract.py` 现读工作树 == HEAD),按票面推荐口径 **A** 开工:服务端在重连时重放仍待决的条目,与 `sse_contract` 同批;爆炸半径与验收以票面 A 档为准。〔让号记录(2026-10-09 F9 清偿批⑤):原号 D173 与「AI 对话链路四竞品对标 V4 收口线」(4 行成段工作线,2026-09-29 由畸形号 DD128 经让号改派而来,改派史有据;D128 本身已被 8 行认领不可回并)撞成一号两题,本行(断线窗口待决审批重放票,单行、全仓零代码引证)让出原号独立取号,由取号令牌按当次 CAS 的 HEAD 现算(D 族)。本行正文除编号位与本记录外逐字未动。〕 (原编号 D1047;持有行题面「断线窗口待决审批的重放」)
```

- 原 L7714(L1 外部持有行 L4709):

```
- [ ]（进行中）**守门 91 冻结的 9 处待清 + 一项方法论债(2026-09-24)**:① study-publish 整文件主题化(14 处 `getTokens('light')`,8 处在模块级 StyleSheet.create 里,须改成按 scheme 生成的函数或下沉到组件内), 改完后 `node scripts/check-theme-prop-wiring.mjs --update-baseline` 应收窄; ② 7 个他人 M 在制的屏(CourseDetail / Distribution / LiveDetail / ModelPlaza / N8nModel / PostCreate / SharedDemo)待其会话自行接线; ③ `{...props}` 展开类站点被判 spread-unknown(判不出即如实报,不静默放行)—— 要真正覆盖须先给端内 wrapper 的 props 建立类型事实,属独立改造; ④ 方法论债:**本轮两次误判同源** —— 一次是把像素被 `rgba(0,0,0,0.6)` 遮罩压暗 40% 当成"颜色没落上", 一次是用"文本里有没有某个键"统计出"0 处漏传"。两者的共同错误是**用一个不测量目标东西的探针给出肯定结论**。 纪律:凡给出"0 处 / 没有 / 已全清"这类否定性结论,必须先构造一个**已知应被命中的正例**喂给同一判据(阳性对照), 否则该结论不得写进文档或据此决定"不做"。 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记 (与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7721(L1 外部持有行 L7716):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7807(G-18) 同题,派单以持有行为准,本行不再单独派单。〕 G-815930 **归属:union-converge 落地闸持有人 —— 两版 F5 修法被"整文件取向"的并发合并各自抹掉过,现在活的只有一版;另一版的欠账名单与 --json 问责要恢复,只能三方合、不能整文件搬** —— 现读 HEAD 面的 `scripts/union-converge.mjs`:`本侧相对共同基底自己缩了量` 那一版在位(它实测能让真面合并过闸,今晚 04:1x 的 dry-run RC=0 就是它),而枚 `c18ac45d98` 引入的 `f5Deficit`/`suppCredit`(逐行点名欠账注记 + `--json` 可问责)**在 HEAD 里 0 命中**;反过来本侧第二版"额度基准改用生成器自己的期望值"也没了。两版各自消失过一次,是同一条路径造成的:代码文件在跨机合并里按"对侧相对基底动过 ⇒ 整文件取那一版",于是**文件还在、里面的实现被换成旧版**,而守门 100 是路径级零丢失判据,对这一型结构上看不见。**为什么本票不直接把它合回来**:实测把两版合成一份去提交,守门 84 的 R1r 行级复活判据点名"复活 4 行 ← 见于祖先 `45167ff85`"并定责为本任务红(那 4 行是 `}`/`.join('')`/`(() => {` 这类被两版各自挪过位置的形状行)—— **84 没有错,错在上游用整文件取向压扁了两个真实分叉**;正解是给代码文件也走内容级三方(与活文档同一纪律),再谈恢复名单那一版。修法与判据持有人裁,本票只交证据;复现:`git show HEAD:scripts/union-converge.mjs | grep -c f5Deficit`(现读 0)、`node scripts/union-converge.mjs --self-test`。
```

- 原 L7722(L1 外部持有行 L7717):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7808(G-19) 同题,派单以持有行为准,本行不再单独派单。〕 G-815931 **归属:守门 98 D4(影子 .js)持有人 + api 路由持有人 —— `user-concurrency-service.js` 删过 1 次、在 86 枚提交里被翻回来 23 次,"只删文件"这件事本身不成立** —— `apps/api/src/services/user-concurrency-service.js` 与同名 `.ts` 是**同一个 blob**(`8e0e5199574a…` 逐字节相同),纯影子 .js;`6bf657df86`(09-29 01:12)删过它,但此后状态翻转 23 次,复活来源两类:① union-converge 的"对侧删除不随合并传播"(刻意设计,防合并吞并),② 单父提交把整棵旧基线写回。**必要条件(缺一必复发)**:三处按 `.js` 后缀写的说明符必须先改掉 ——`apps/api/src/routes/v1-public.ts:65`、`apps/api/src/routes/developer-relay-keys-admin.ts:24`、`apps/api/tests/user-concurrency-leak.test.ts:50`;Node 按扩展名解析,说明符不动则删掉的 .js 会被下一次合并以"对侧仍引用"的形态带回来。门 98 的镜像取证取自 `6bf657df86^` 历史 blob 而非 HEAD,所以"删了不红"不代表"删得住"。另:CI 的 `source-check` 步骤(`.github/workflows/ci-monorepo.yml:91` 内联 find)判的是**提交树**,本机工作树跑同样的命令会因为文件在而红/不在而不红,读数一律带 sha。
```

- 原 L7723(L1 外部持有行 L15729):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7809(G-20) 同题,派单以持有行为准,本行不再单独派单。〕 G-815932 **归属:端口注册表门 + ai-service ruff + 受保护检查 lint-typecheck-test —— 三条红都在干净已入库代码上,按 §12f 优先级高于任何新增工作** —— ① `node scripts/check-port-registry.mjs --all` 现读 23 处命中(默认档只扫 2 个文件所以本机看着绿,CI 带 `--all`),全部 in-commit,集中在今天新入库的门与其夹具:`scripts/tests/check-service-binary-pots…`(实读 `check-service-binary-paths.test.mjs` 13 处)、`scripts/check-service-binary-paths.mjs:1525-1529`、`apps/desktop/README.md:46-51`、`apps/cli/tests/` 2 处、`apps/api/src/utils/egress-retry-safety.ts:26`(JSDoc 里的示例地址,该 corpus 不剥注释)。该门的 `EXEMPT_PATH_PATTERNS`(`scripts/check-port-registry.mjs:220-245`)只豁免了 `apps/api/tests`、`apps/ai-service/tests`,**不含 `scripts/tests` 与 `apps/cli/tests`** ⇒ 修哪一侧属该门持有人裁,**不得为变绿删夹具**(夹具是把端口写进断言的正当形态)。② `apps/ai-service` 的 `ruff check .` 现读 54 errors / 32 文件(版本与 `pyproject.toml:88` 的 `ruff==0.16.6` 同 pin 可精确复现),其中 `app/routers/llm.py:3269` 的 `F821 Undefined name tool_exec_tracker` 是唯一疑似**真功能缺陷**的一格,其余是 I001/UP0xx/SIM 类风格。③ 受保护检查 `CI / lint-typecheck-test (push)` 本身在 `496e4ced44`/`bedf82ed9c`/`dd6fb971f5` 上均 failure ⇒ 直推还能走、PR 通道被堵,这是全队交付阻塞而不是一条难看;具体失败步骤未判定(GitHub 未认证配额耗尽 + 日志端点 403),取证另有一路在跑,结论落地后并入本行。
```

- 原 L7773(L1 外部持有行 L15731):

```
- [ ] **`stream-tool-ledger` 未入库**:模块与单测已绿(`apps/cli/src/stream-tool-ledger.ts`), 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7774(L1 外部持有行 L15732):

```
- [ ] P1 **`check-auth-refresh-singleton`(hook 批外步骤)按磁盘遍历客户端源码,一个未跟踪的构建副本就让全队每次提交被迫跳门(2026-09-26 实测)**:它 `readdirSync` 走文件系统(第 47 行),于是并发会话留在 `apps/miniapp-taro/.tmp-twq-fix/` 的**未跟踪**旧构建产物(5.4 MB,`common.js` 里含裸 `refreshAccessToken`)被判成违规;而它跑在守门批**之外**,161 道门全绿也照样 exit 1 —— 实测连续两枚提交因此走 `--no-verify`(归因层量到"红在批外"),一次跳门等于该枚提交上全部守门作废(§12e 同型)。当场处置是把副本**移出**到 `.ihui-agent/tmp/quarantine-2026-09-26/`(未删除,可回读),该步现 exit 0。**根因未修**:判据应判仓库内容而非共享工作树快照(门 57 已确立该口径),且改它必须同笔迁到 `scripts/lib/face-reader.mjs` 的 `catBatch`(门 118 对"本次改动动过的门"按取材面判,仍按磁盘读会被判半接线红)。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7779(L1 外部持有行 L15733):

```
- [ ] （【归并】重复登记副本·同号不同题·2026-09-29·本行与同编号的持有行是同一件事的两次登记,现摘掉编号只留指针,不翻勾、正文逐字保留,派单以持有行为准）**CSV/Excel 导出必须中和公式注入**(安全缺口,可立即修;归属:web 导出工具) —— 上游 `packages/ui/src/components/ai-elements/markdown-table.tsx:81-91` `escapeCsvCell`:对不可信 assistant 内容命中 `/^[\t\r\n]/` 或 `/^\s*[=+\-@]/` 时前置 `'`,再走 RFC 引号转义;`:113` 另加 UTF-8 BOM。我方现状:`git show HEAD:apps/web/src/lib/export-utils.ts` :22-30 有 BOM、有 tab/换行清洗,**无公式前缀中和**;同义词族 `git grep -I -iE "formula injection|escapeCsvCell|startsWith\('='\)"` HEAD = **0 命中**。落点:`export-utils.ts:26-29`(formatter 输出处一处收口,不得在调用方各补)。验收:新增 `apps/web/src/lib/__tests__/export-utils-csv-hardening.test.ts` 断言 `'=SUM(A1)'` → `"'=SUM(A1)"`,命令 `pnpm --filter @ihui/web exec vitest run --retry=0 src/lib/__tests__/export-utils-csv-hardening.test.ts`。爆炸半径:仅"单元格以 `=+-@` 开头"时行为变,覆盖数十处 `exportToExcel` 调用面但都是导出内容转义。 (原编号 G-823;持有行题面「CSV/Excel导出必须中和公式注入——已落地」)
```

- 原 L7780(L1 外部持有行 L15734):

```
- [ ] （【归并】重复登记副本·同号不同题·2026-09-29·本行与同编号的持有行是同一件事的两次登记,现摘掉编号只留指针,不翻勾、正文逐字保留,派单以持有行为准）**GFM `singleTilde` 必须显式关掉(CJK 删除线扩展两处都要关)**(可立即修;归属:web markdown 配置) —— 上游 `message.tsx:404-428` 与 `:830-840`:`remark-gfm` 与 CJK 删除线扩展**两处**都默认 `singleTilde:true`,必须同时关,否则 `~text~` 被误划掉。我方现状:`git show HEAD:apps/web/src/components/ai/markdown-stream.tsx` :733/:1003/:1012 均为裸 `remarkGfm`(无 options),`git grep -In singleTilde` 全库 = **0 命中**。落点:同三处改 `[[remarkGfm,{singleTilde:false}], remarkMath]`。验收:`pnpm --filter @ihui/web exec vitest run --retry=0 src/components/ai/__tests__/markdown-stream.test.tsx` 补一条 `~a~` 原文断言。爆炸半径:仅 `~x~` 渲染结果。 (原编号 G-826;持有行题面「GFMsingleTilde必须显式关掉——已落」)
```

- 原 L7783(L1 外部持有行 L15735):

```
- [ ] （【归并】重复登记副本·同号不同题·2026-09-29·本行与同编号的持有行是同一件事的两次登记,现摘掉编号只留指针,不翻勾、正文逐字保留,派单以持有行为准）**签名 URL 进日志前必须剥掉凭据段**(小,可立即修;归属:web 媒体) —— 上游 `image-preview-dialog.tsx:86-98` 把 URL 的 userinfo/query/hash 剥掉再打日志(配合 `:382-386` 的注释说明为什么)。我方现状:同义族 `git grep -InE "sanitize.*[Ll]og|url\.search = ''"` 的命中全在 `apps/api/`(如 `apps/api/src/services/log-sanitizer.ts:13`),**web 面 0** ⇒ 概念有、这一条调用点没有。落点:`FilePreview.tsx` 打日志处(与 G-851/852 同文件 ⇒ 建议三票合派一人)。验收:`pnpm --filter @ihui/web exec vitest run --retry=0 src/components/media/__tests__/image-preview-pack.test.tsx` + 新增断言"日志里不含 `X-Amz-Signature`/`?` 之后内容"。⚠️ 与本仓 §5c"零宽溯源载荷"、§16 脱敏链同族,不得把完整签名 URL 写进任何上报面。 (原编号 G-855;持有行题面「签名URL进日志前必须剥掉凭据段——已落地」)
```

- 原 L7785(L1 外部持有行 L15736):

```
- [ ]（【归并】重复登记副本·同号不同题·2026-09-29·本行与同编号的持有行是同一件事的两次登记,现摘掉编号只留指针,不翻勾、正文逐字保留,派单以持有行为准）锁的初始化必须**写全再原子可见**:上游 `packages/services/src/bots/channelRuntime.ts:153-238`(`:172-176` 注释:"锁目录和 owner 必须作为完整状态对外可见",先写 pending 目录再 `rename`,免得竞争者把**未初始化**的锁判成 stale 抢占;`:180-188` Windows rename→EPERM 只在正式路径确实存在时才进接管分支)。我方 `scripts/git-lock.mjs` / `scripts/deploy-lock.mjs` 已有心跳 + proc-identity 三元(AGENTS §5b/§12),但**没有 pending+rename 这一层** —— 锁目录本身就是半成品可见态,与本机 09-24 那次"pid 被复用导致部署环冻结 11h50m"(G-193)是相邻风险。**落点** `G:\IHUI-AI\scripts\lib\`(与两把锁共用的那一份,禁止各写一遍)。**验收**:临时目录并发 A/B —— 旧实现能在 owner 写入前被 B 判 stale 抢占,新实现不可;两把锁的既有镜像测试全绿(不得为过门改它们的断言)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-814425 · 锁的初始化必须写全再原子可见」,派单以那条为准,本行不再单独派单。〕 (原编号 G-814425;持有行题面「锁的初始化必须"写全再原子可见"」)
```

- 原 L7786(L1 外部持有行 L15722):

```
- [ ]O594 票⑰ —— **`2f-ext` 升 blocking 已量好前置,按用户指令暂缓落地**(注册文件 `scripts/guardian-runner.mjs` 本轮不得改)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「O81」,派单以那条为准,本行不再单独派单。〕〔让号记录(2026-10-09 F9 清偿批⑤承接):同题同批承让到 O594(持行由取号令牌现算,见该行让号记录;机主拍板 2026-10-09 代码引证优先,O81 留归「跨端 UI 单一源」工作线),本行正文除编号位与本记录外逐字未动。〕
```

- 原 L7791(L1 外部持有行 L15738):

```
- [ ]（【归并】重复登记副本·同号不同题·2026-09-29·本行与同编号的持有行是同一件事的两次登记,现摘掉编号只留指针,不翻勾、正文逐字保留,派单以持有行为准）锁的初始化必须**写全再原子可见**:上游 `packages/services/src/bots/channelRuntime.ts:153-238`(`:172-176` 注释:"锁目录和 owner 必须作为完整状态对外可见",先写 pending 目录再 `rename`,免得竞争者把**未初始化**的锁判成 stale 抢占;`:180-188` Windows rename→EPERM 只在正式路径确实存在时才进接管分支)。我方 `scripts/git-lock.mjs` / `scripts/deploy-lock.mjs` 已有心跳 + proc-identity 三元(AGENTS §5b/§12),但**没有 pending+rename 这一层** —— 锁目录本身就是半成品可见态,与本机 09-24 那次"pid 被复用导致部署环冻结 11h50m"(G-193)是相邻风险。**落点** `G:\IHUI-AI\scripts\lib\`(与两把锁共用的那一份,禁止各写一遍)。**验收**:临时目录并发 A/B —— 旧实现能在 owner 写入前被 B 判 stale 抢占,新实现不可;两把锁的既有镜像测试全绿(不得为过门改它们的断言)。 **当前状态=实现已写完但刻意未落地(2026-09-29,等他人未提交改动让开落点)**:本票的实现(`scripts/lib/lock-atomic-init.mjs` + 两份镜像 + 两把锁的接线)已在工作树里跑绿 —— `node --test scripts/tests/{lock-atomic-init,git-lock-stale-steal,deploy-lock,deploy-lock-stale-steal}.test.mjs` 当轮 RC=0。但 `scripts/git-lock.mjs` / `scripts/deploy-lock.mjs` 此刻**同时含并发会话 G-653 的在飞改动**,且那份改动 import 的 `scripts/lib/atomic-write.mjs` **仍是未跟踪文件**(`??`)⇒ 我现在按 pathspec 或对象空间交这两个文件,等于把"引用一个不在版本树里的模块"写进 HEAD,别人一次干净检出就会让每一次提交的 git 写锁崩掉(这比原病更响)。解阻判据(接手人直接照做):① `git ls-files scripts/lib/atomic-write.mjs` 有输出 **且** 两把锁的工作树副本对 `git diff HEAD` 只剩本票的 hunk;② 两条都成立后 `node --test` 那四份套件仍 RC=0 才落;③ 落之前复跑 `node scripts/git-lock.mjs check` 与 `node scripts/deploy-lock.mjs check` 留 RC。禁止为"早点交"去替 G-653 落他们的半成品,也禁止把本票改成"只落 lib 不接线"——那正是守门 121 判的"声明无消费者"。 (原编号 G-814425;持有行题面「锁的初始化必须"写全再原子可见"」)
```

- 原 L7805(L1 外部持有行 L15656):

```
- [ ]O81 跨端 UI 单一源:小程序端与 App(RN)端逐档同值 + 改一端另一端自动生效(除登录方式与平台机制)。**第 1 票已落(本枚提交)**:对账尺 `scripts/check-cross-end-ui-parity.mjs`(guardian **128**,blocking,棘轮锚点 `scripts/cross-end-ui-parity-baseline.json`,自检 19 例 + 门禁 11 例),AGENTS §4 新节 + README 点名。**立项实测读数**:同名配对组件 19 对 / 174 处差异档 / RN 侧 210 个组件用 `StyleSheet.create` 而小程序侧 91 个用 `className=`(两种样式语言 = 结构上无法自动同步的根因)。**已量到的最小心智事实**:两份自称"唯一实现"的 `BackChevron` 图标墨迹 20px vs 22px、色一档取 `--color-foreground` 一档取 `tk.text.medium`、RN 带系统字号缩放倍率而小程序不带。**剩余票(顺序固定,不得跳)**:② **〔x〕 2026-09-26 已落**:几何档 `packages/design-tokens/src/geometry.js`(`GEOMETRY_PX` 一张表 + `rnGeometry`/`taroGeometry` 两个投影 + `TARO_RPX_PER_PX`,照 `radius.js` 形状,配 `geometry.d.ts`,由 `src/index.ts` 出口),**同枚提交即有两端消费方**(`apps/miniapp-taro/src/components/BackChevron.tsx` 与 `packages/app/src/components/BackChevron.tsx` 各自删掉本地 `= 40`/`= 22`/`= 36` 改取投影);取值依据含"移动端墨迹为何不取 web 顶栏的 14px(`TOPBAR_BTN_BASE` 的 `[&>svg]:!h-3.5` 是桌面密集工具条档)"写在该文件头注。**效果实测**:门 128 索引面 BackChevron 从"仅小程序 20 | 仅 RN 22"变成不再出现在差异清单(18 → 17 条),台账删该键(留着即清单腐烂),门禁测试 11/11 仍绿;`@ihui/design-tokens`、`@ihui/rn-app` typecheck 均 0 错误。**另登记一条与本票无关的既有债**:`pnpm --filter @ihui/miniapp-taro typecheck` 在**干净的 HEAD 上**即报 2 错(`src/pkg-ai/ai/chat.tsx:636` 传 `onTerminalDelta` 而 `StreamEventCallbacks` 无此键 + 参数隐式 any)—— 该文件工作树与 HEAD 逐字节相同,故非在飞改动;未擅自"顺手修"(§12 越权红线),留待该键的归属会话收口。③ 在 `packages/shared` 落"与平台无关的组件源 + 每端注入 primitive adapter"的第一例(试点 `BackChevron`:7 个小程序调用点 / 134 个 RN 调用点,API 取两端并集,动作语义留调用方),两端各自构建 + 真机/模拟器像素复核后才允许下调台账(〔真机复核通过@2026-10-14 本席:BackChevron 于 c12617dd 真机渲染正常(意见反馈页左上 `<` 形态/位置符合)且点击正常返回,落地提交 `a90cc00bb3`,门 128 棘轮与 wiring 测试 12/12 前验绿;④ 的下调台账前置已满足〕);④ 按台账读数从大到小逐族收敛(`InputArea` 23 / `BottomActionBar` 19 / `LoginPopUp` 17 / `NavBar` 15 / `IntelligentAssistant` 14 为前 5),每族一票,收完即下调 `counts` 并**在同枚提交里**留下"该组件只剩一份源"的证据;⑤ 确属平台差异的逐条写 `waivers.reason`,由守门 108 管到期。**架构前提(不要再试第二条路)**:单向适配器已失败过一次(2026-09-22 删 4,662 行,"同名 ≠ 同契约"),所以只能"一份源 + 两端注入",不能"一端包另一端";`packages/app` 是 RN 专属(Taro 跑不了),`packages/ui-native` 13 个组件里 11 个零生产消费方,不得当成已交付能力引用。 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记已随归档搬至 .ihui-agent/archive/PROJECT_PLAN_2026-10-08_auto-archive.md 的条目 「O81 · 跨端UI单一源」,派单以那条为准,本行不再单独派单。〕
```

- 原 L7807(L1 外部持有行 L15656):

```
- [ ]O81 跨端 UI 单一源:小程序端与 App(RN)端逐档同值 + 改一端另一端自动生效(除登录方式与平台机制)。**第 1 票已落(本枚提交)**:对账尺 `scripts/check-cross-end-ui-parity.mjs`(guardian **128**,blocking,棘轮锚点 `scripts/cross-end-ui-parity-baseline.json`,自检 19 例 + 门禁 11 例),AGENTS §4 新节 + README 点名。**立项实测读数**:同名配对组件 19 对 / 174 处差异档 / RN 侧 210 个组件用 `StyleSheet.create` 而小程序侧 91 个用 `className=`(两种样式语言 = 结构上无法自动同步的根因)。**已量到的最小心智事实**:两份自称"唯一实现"的 `BackChevron` 图标墨迹 20px vs 22px、色一档取 `--color-foreground` 一档取 `tk.text.medium`、RN 带系统字号缩放倍率而小程序不带。**剩余票(顺序固定,不得跳)**:② **〔x〕 2026-09-26 已落**:几何档 `packages/design-tokens/src/geometry.js`(`GEOMETRY_PX` 一张表 + `rnGeometry`/`taroGeometry` 两个投影 + `TARO_RPX_PER_PX`,照 `radius.js` 形状,配 `geometry.d.ts`,由 `src/index.ts` 出口),**同枚提交即有两端消费方**(`apps/miniapp-taro/src/components/BackChevron.tsx` 与 `packages/app/src/components/BackChevron.tsx` 各自删掉本地 `= 40`/`= 22`/`= 36` 改取投影);取值依据含"移动端墨迹为何不取 web 顶栏的 14px(`TOPBAR_BTN_BASE` 的 `[&>svg]:!h-3.5` 是桌面密集工具条档)"写在该文件头注。**效果实测**:门 128 索引面 BackChevron 从"仅小程序 20 | 仅 RN 22"变成不再出现在差异清单(18 → 17 条),台账删该键(留着即清单腐烂),门禁测试 11/11 仍绿;`@ihui/design-tokens`、`@ihui/rn-app` typecheck 均 0 错误。**另登记一条与本票无关的既有债**:`pnpm --filter @ihui/miniapp-taro typecheck` 在**干净的 HEAD 上**即报 2 错(`src/pkg-ai/ai/chat.tsx:636` 传 `onTerminalDelta` 而 `StreamEventCallbacks` 无此键 + 参数隐式 any)—— 该文件工作树与 HEAD 逐字节相同,故非在飞改动;未擅自"顺手修"(§12 越权红线),留待该键的归属会话收口。③ 在 `packages/shared` 落"与平台无关的组件源 + 每端注入 primitive adapter"的第一例(试点 `BackChevron`:7 个小程序调用点 / 134 个 RN 调用点,API 取两端并集,动作语义留调用方),两端各自构建 + 真机/模拟器像素复核后才允许下调台账(〔真机复核通过@2026-10-14 本席:BackChevron 于 c12617dd 真机渲染正常(意见反馈页左上 `<` 形态/位置符合)且点击正常返回,落地提交 `a90cc00bb3`,门 128 棘轮与 wiring 测试 12/12 前验绿;④ 的下调台账前置已满足〕);④ 按台账读数从大到小逐族收敛(`InputArea` 23 / `BottomActionBar` 19 / `LoginPopUp` 17 / `NavBar` 15 / `IntelligentAssistant` 14 为前 5),每族一票,收完即下调 `counts` 并**在同枚提交里**留下"该组件只剩一份源"的证据;⑤ 确属平台差异的逐条写 `waivers.reason`,由守门 108 管到期。**架构前提(不要再试第二条路)**:单向适配器已失败过一次(2026-09-22 删 4,662 行,"同名 ≠ 同契约"),所以只能"一份源 + 两端注入",不能"一端包另一端";`packages/app` 是 RN 专属(Taro 跑不了),`packages/ui-native` 13 个组件里 11 个零生产消费方,不得当成已交付能力引用。 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记 「O81」,派单以那条为准,本行不再单独派单。〕
```

- 原 L7813(L1 外部持有行 L15656):

```
- [ ]O81 跨端 UI 单一源:小程序端与 App(RN)端逐档同值 + 改一端另一端自动生效(除登录方式与平台机制)。**第 1 票已落(本枚提交)**:对账尺 `scripts/check-cross-end-ui-parity.mjs`(guardian **128**,blocking,棘轮锚点 `scripts/cross-end-ui-parity-baseline.json`,自检 19 例 + 门禁 11 例),AGENTS §4 新节 + README 点名。**立项实测读数**:同名配对组件 19 对 / 174 处差异档 / RN 侧 210 个组件用 `StyleSheet.create` 而小程序侧 91 个用 `className=`(两种样式语言 = 结构上无法自动同步的根因)。**已量到的最小心智事实**:两份自称"唯一实现"的 `BackChevron` 图标墨迹 20px vs 22px、色一档取 `--color-foreground` 一档取 `tk.text.medium`、RN 带系统字号缩放倍率而小程序不带。**剩余票(顺序固定,不得跳)**:② **[x] 2026-09-26 已落**:几何档 `packages/design-tokens/src/geometry.js`(`GEOMETRY_PX` 一张表 + `rnGeometry`/`taroGeometry` 两个投影 + `TARO_RPX_PER_PX`,照 `radius.js` 形状,配 `geometry.d.ts`,由 `src/index.ts` 出口),**同枚提交即有两端消费方**(`apps/miniapp-taro/src/components/BackChevron.tsx` 与 `packages/app/src/components/BackChevron.tsx` 各自删掉本地 `= 40`/`= 22`/`= 36` 改取投影);取值依据含"移动端墨迹为何不取 web 顶栏的 14px(`TOPBAR_BTN_BASE` 的 `[&>svg]:!h-3.5` 是桌面密集工具条档)"写在该文件头注。**效果实测**:门 128 索引面 BackChevron 从"仅小程序 20 | 仅 RN 22"变成不再出现在差异清单(18 → 17 条),台账删该键(留着即清单腐烂),门禁测试 11/11 仍绿;`@ihui/design-tokens`、`@ihui/rn-app` typecheck 均 0 错误。**另登记一条与本票无关的既有债**:`pnpm --filter @ihui/miniapp-taro typecheck` 在**干净的 HEAD 上**即报 2 错(`src/pkg-ai/ai/chat.tsx:636` 传 `onTerminalDelta` 而 `StreamEventCallbacks` 无此键 + 参数隐式 any)—— 该文件工作树与 HEAD 逐字节相同,故非在飞改动;未擅自"顺手修"(§12 越权红线),留待该键的归属会话收口。③ 在 `packages/shared` 落"与平台无关的组件源 + 每端注入 primitive adapter"的第一例(试点 `BackChevron`:7 个小程序调用点 / 134 个 RN 调用点,API 取两端并集,动作语义留调用方),两端各自构建 + 真机/模拟器像素复核后才允许下调台账(〔真机复核通过@2026-10-14 本席:BackChevron 于 c12617dd 真机渲染正常(意见反馈页左上 `<` 形态/位置符合)且点击正常返回,落地提交 `a90cc00bb3`,门 128 棘轮与 wiring 测试 12/12 前验绿;④ 的下调台账前置已满足〕);④ 按台账读数从大到小逐族收敛(`InputArea` 23 / `BottomActionBar` 19 / `LoginPopUp` 17 / `NavBar` 15 / `IntelligentAssistant` 14 为前 5),每族一票,收完即下调 `counts` 并**在同枚提交里**留下"该组件只剩一份源"的证据;⑤ 确属平台差异的逐条写 `waivers.reason`,由守门 108 管到期。**架构前提(不要再试第二条路)**:单向适配器已失败过一次(2026-09-22 删 4,662 行,"同名 ≠ 同契约"),所以只能"一份源 + 两端注入",不能"一端包另一端";`packages/app` 是 RN 专属(Taro 跑不了),`packages/ui-native` 13 个组件里 11 个零生产消费方,不得当成已交付能力引用。 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记 「O81」,派单以那条为准,本行不再单独派单。〕
```

- 原 L7815(L1 外部持有行 L15656):

```
- [ ]O81 跨端 UI 单一源:小程序端与 App(RN)端逐档同值 + 改一端另一端自动生效(除登录方式与平台机制)。**第 1 票已落(本枚提交)**:对账尺 `scripts/check-cross-end-ui-parity.mjs`(guardian **128**,blocking,棘轮锚点 `scripts/cross-end-ui-parity-baseline.json`,自检 19 例 + 门禁 11 例),AGENTS §4 新节 + README 点名。**立项实测读数**:同名配对组件 19 对 / 174 处差异档 / RN 侧 210 个组件用 `StyleSheet.create` 而小程序侧 91 个用 `className=`(两种样式语言 = 结构上无法自动同步的根因)。**已量到的最小心智事实**:两份自称"唯一实现"的 `BackChevron` 图标墨迹 20px vs 22px、色一档取 `--color-foreground` 一档取 `tk.text.medium`、RN 带系统字号缩放倍率而小程序不带。**剩余票(顺序固定,不得跳)**:② **[x] 2026-09-26 已落**:几何档 `packages/design-tokens/src/geometry.js`(`GEOMETRY_PX` 一张表 + `rnGeometry`/`taroGeometry` 两个投影 + `TARO_RPX_PER_PX`,照 `radius.js` 形状,配 `geometry.d.ts`,由 `src/index.ts` 出口),**同枚提交即有两端消费方**(`apps/miniapp-taro/src/components/BackChevron.tsx` 与 `packages/app/src/components/BackChevron.tsx` 各自删掉本地 `= 40`/`= 22`/`= 36` 改取投影);取值依据含"移动端墨迹为何不取 web 顶栏的 14px(`TOPBAR_BTN_BASE` 的 `[&>svg]:!h-3.5` 是桌面密集工具条档)"写在该文件头注。**效果实测**:门 128 索引面 BackChevron 从"仅小程序 20 | 仅 RN 22"变成不再出现在差异清单(18 → 17 条),台账删该键(留着即清单腐烂),门禁测试 11/11 仍绿;`@ihui/design-tokens`、`@ihui/rn-app` typecheck 均 0 错误。**另登记一条与本票无关的既有债**:`pnpm --filter @ihui/miniapp-taro typecheck` 在**干净的 HEAD 上**即报 2 错(`src/pkg-ai/ai/chat.tsx:636` 传 `onTerminalDelta` 而 `StreamEventCallbacks` 无此键 + 参数隐式 any)—— 该文件工作树与 HEAD 逐字节相同,故非在飞改动;未擅自"顺手修"(§12 越权红线),留待该键的归属会话收口。③ 在 `packages/shared` 落"与平台无关的组件源 + 每端注入 primitive adapter"的第一例(试点 `BackChevron`:7 个小程序调用点 / 134 个 RN 调用点,API 取两端并集,动作语义留调用方),两端各自构建 + 真机/模拟器像素复核后才允许下调台账(〔真机复核通过@2026-10-14 本席:BackChevron 于 c12617dd 真机渲染正常(意见反馈页左上 `<` 形态/位置符合)且点击正常返回,落地提交 `a90cc00bb3`,门 128 棘轮与 wiring 测试 12/12 前验绿;④ 的下调台账前置已满足〕);④ 按台账读数从大到小逐族收敛(`InputArea` 23 / `BottomActionBar` 19 / `LoginPopUp` 17 / `NavBar` 15 / `IntelligentAssistant` 14 为前 5),每族一票,收完即下调 `counts` 并**在同枚提交里**留下"该组件只剩一份源"的证据;⑤ 确属平台差异的逐条写 `waivers.reason`,由守门 108 管到期。**架构前提(不要再试第二条路)**:单向适配器已失败过一次(2026-09-22 删 4,662 行,"同名 ≠ 同契约"),所以只能"一份源 + 两端注入",不能"一端包另一端";`packages/app` 是 RN 专属(Taro 跑不了),`packages/ui-native` 13 个组件里 11 个零生产消费方,不得当成已交付能力引用。 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记已随归档搬至 .ihui-agent/archive/PROJECT_PLAN_2026-10-08_auto-archive.md 的条目 「O81 · 跨端UI单一源」,派单以那条为准,本行不再单独派单。〕
```

- 原 L7822(L1 外部持有行 L7930):

```
- [ ] **归属:守门 116 持有者(本票不认领、不抬基线)** —— 层的"常量绑裸 git"棘轮从基线 10 涨到实测 11,红是棘轮自己报的,复现:`node --test scripts/tests/face-reader.test.mjs`(实测 26 例 ⇒ 24 绿 / 本条红 / 另一枚红是 O76 新加的第四型尺子,它扫 HEAD,随 O76 落地即绿)。第 11 个是 `scripts/check-egress-facts.mjs`(`05ffe25825a` 15:39 入库,基线是在 `66e5edaf8b7` 12:29 定到 10 的,逐个文件的"加入时间"已比对过:12:29 之后新增的裸 git 绑定只有这一枚)。**为什么我不替别人抬基线**:把 10 改成 11 等于替他人的一次回归平账,而这条尺子的存在理由正是"新增者请改用层的 `gitRaw`"。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7824(L1 外部持有行 L7931):

```
- [ ] 待用户补:apps/*/.env ~35 键(WECHAT_APP_ID/SECRET、SMTP/RESEND/腾讯 SES、DINGTALK、GitHub Token 等),骨架已就位;丢失键全清单已梳理到 `tmp/env keys todo.md`(79 空键 / api 36 + web 15 + ai-service 28,按 ★优先级 + 配置渠道 + 目标文件组织) 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7825(L1 外部持有行 L7932):

```
- [ ] **`git fsck` 恒报 166216 条 broken link/missing，而同一 sha 直查存在 —— 本机对象图状态存疑**。实测三组互斥证据(2026-09-24 04:2x-04:3x，均在 `G:\IHUI-AI` 本机): 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7826(L1 外部持有行 L3971):

```
- [ ] **`VideoPlayerScreen` 全屏纯黑 ⇒ 黑页上方横一条 34dp 浅灰带**。这条带由 `App.tsx` 根 View 的 `backgroundColor: tokens.surface.bg` 绘制;屏幕内容在屏幕顶边被裁剪(真机量得带内 y=8..60 = (245,245,245),而把黑底用 `marginTop:-34` 上推后黑色只出现在 y=68 以下)。**即端内任何写法都够不到这条带** —— 完整取证与已回退的尝试见同日登记「实测钉死一条边界:单屏无法把底色铺进状态栏带」。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7827(L1 外部持有行 L15731):

```
- [ ] **`stream-tool-ledger` 未入库**:模块与单测已绿(`apps/cli/src/stream-tool-ledger.ts`), 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7829(L1 外部持有行 L7936):

```
- [ ] **`stream-tool-ledger` 接线(唯一真正剩下的技术活)——归属是他人、非本批可 finish**: 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7830(L1 外部持有行 L15732):

```
- [ ] P1 **`check-auth-refresh-singleton`(hook 批外步骤)按磁盘遍历客户端源码,一个未跟踪的构建副本就让全队每次提交被迫跳门(2026-09-26 实测)**:它 `readdirSync` 走文件系统(第 47 行),于是并发会话留在 `apps/miniapp-taro/.tmp-twq-fix/` 的**未跟踪**旧构建产物(5.4 MB,`common.js` 里含裸 `refreshAccessToken`)被判成违规;而它跑在守门批**之外**,161 道门全绿也照样 exit 1 —— 实测连续两枚提交因此走 `--no-verify`(归因层量到"红在批外"),一次跳门等于该枚提交上全部守门作废(§12e 同型)。当场处置是把副本**移出**到 `.ihui-agent/tmp/quarantine-2026-09-26/`(未删除,可回读),该步现 exit 0。**根因未修**:判据应判仓库内容而非共享工作树快照(门 57 已确立该口径),且改它必须同笔迁到 `scripts/lib/face-reader.mjs` 的 `catBatch`(门 118 对"本次改动动过的门"按取材面判,仍按磁盘读会被判半接线红)。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7833(L1 外部持有行 L15663):

```
- [ ] P1 **CI 装不上而门 101 报绿：锁只记「条目在不在」，不看它落在哪个依赖段**（2026-09-26 实测，9d1aa0baa3 现读）—— pnpm install --frozen-lockfile 在 packages/api-client 直接拒装：HEAD 的清单里该包 **dependencies 为空**、@ihui/types 在 devDependencies（现读 dependencies = (无) / devDependencies = @ihui/eslint-config, @ihui/types, @tarojs/taro, typescript, rimraf, vitest），而 pnpm-lock.yaml 仍把它记在 importers["packages/api-client"].dependencies 段 ⇒ pnpm 比对「同一字段」不通过。**CI 每个 job 的第一步都是这条 install**，所以红的是 Install dependencies（实测 Knip job 的失败步名就是它，不是棘轮本身），连带 CI / CI (Monorepo) / Smoke New Modules / e2e / Build Docker / Real DB 一整套红成一片；而本地 node scripts/check-lock-manifest-consistency.mjs **exit 0**（26 包 / 514 条声明 / 违规 0）。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7834(L1 外部持有行 L7949):

```
- [ ] **守门 94(errorCode 覆盖率)现在是真红,但红不在内容里,补目录行会制造孤儿条目(2026-09-26 20:5x 实测,归 `llm.py` 持有者)**:HEAD 面 `node scripts/check-error-code-coverage.mjs` exit 1,点名 `apps/ai-service/app/routers/llm.py:3086` 的 `CHAT_MODE_TOOL_BLOCKED` 与 `:3284` 的 `TOOL_MODE_UNAVAILABLE` 未进 `packages/shared/src/chat/error-catalog.ts`。两码同由 `12c685d10e` 引入。**关键读数**:工作树里 `llm.py` 正被并发会话改着,而那两处生产者在它的 diff 中是 **`-` 行(正在被删)** ⇒ 等那枚提交落地,本门自己归零。**处置 = 不动**:此刻按门的提示去补两行目录 + 五语言词包,产出的将是"目录里有、无人产出"的死条目,而 `R2` 只要求台账八类齐备、不反向拦孤儿,门不会替你发现。另需澄清:`check-error-code-coverage` 的红在 safe-commit 的逐道复跑里判 `not-ours`(未点名本次文件),所以它是"合法被跳过"的红 —— 这条登记就是它的出口。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7835(L1 外部持有行 L7950):

```
- [ ] **本会话开门留下的格(①已闭合且不是我收的,②仍开)**:① 工作树 `PROJECT_PLAN.md` 曾有 3 行(G-206/207/209)停在**归并前的旧 `[ ]` 形态**而 HEAD 已翻勾 —— 正确出口是 `node scripts/heal-worktree-tracked.mjs --align-drift`(判据:索引==HEAD ∧ 工作树==该路径某祖先 ⇒ 才动,可证零独有数据),**不是**手工把整文件按工作树提交(那等于替别人回退归并)。本票落地前复量:`--align-drift` 报「无需对齐(可判定 0 个)」而 `git show HEAD:PROJECT_PLAN.md` 与工作树副本 **md5 同值**(`fe60b0e32b6b3e64e54fa811f87cfba8`)⇒ 对齐已由并发会话/守护一侧完成,不记在自己账上;**这一格的读数必须在提交前一刻重取**,因为它是移动靶。② 门 101 的 **section 级对账**仍未做(上面已开票)。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7836(L1 外部持有行 L7951):

```
- [ ] **`check:plan-task-state` 在 CI 上红,是别人的新维度带着非零存量上线(归 F6 持有人,本会话不代裁)**:`node scripts/plan-tasks.mjs --gate --strict` 在 HEAD 面 exit 1,而 F1/F2/F3 全 0、F4 只报数 —— 红在**新加的 F6(整块登记重复,块级量纲)**:基线 0 而现读 **8 块 / 共 16 份**(另有 10 块"首行相同而正文漂移",工具自己写明"必须人工判哪份作数")。行级四条(F1–F4)对"整块被追加两遍"结构上失明,所以 F6 的立维方向是对的;**错在带存量上线**:这一型与任何提交都无关,谁提交都红 ⇒ 唯一结局是各会话 `--no-verify` 连带约 160 道门作废(§12e,本仓记过不下五次)。两条出路按工具自己的提示:要么人工收掉那 8 块逐字相同的整块重复(它写明"逐字相同才可自动收口",但**没有**自动收口出口,须手写),要么由持有人跑 `--update-baseline` 把 8 钉成棘轮上限 —— 后者会把"不再变多"这一维保住,把"存量归零"留给后人。**归属 F6 持有人,本会话不动别人的判据**。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7838(L1 外部持有行 L7954):

```
- [ ] 副本指针(编号 62)：同主键第二份未勾选副本,只加指针不动勾选;当前状态见带 v3wave3 租约的那条(该条写明 ChatSearchBar 前提被推翻与 use-chat-search 投影现场)。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7839(L1 外部持有行 L7955):

```
- [ ] 副本指针(编号 63)：本行与上一条同主键、是并发并集留下的第二份未勾选副本 ⇒ 按 §1 只加指针不动勾选;当前状态见带 v3wave3 租约的那条。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7840(L1 外部持有行 L7956):

```
- [ ] 副本指针(编号 75)：同主键第二份未勾选副本,只加指针不动勾选;当前状态见带 v3wave3 租约的那条(该条写明默认档与三轴派生阈值及残余)。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7842(L1 外部持有行 L7958):

```
- [ ] P1 新登记(接上条,解阻前置已明确):僵尸实例修复。可选方向三条,按仓库既有取向排序 ——(a) WebView2 创建失败即记录 ERROR + 提示并 `process::exit`,**不得**继续启动 `auto_refresh` 常驻循环;(b) 失败时回退到离线兜底页(`lib.rs` 已注册 `offline` 协议,`auto_refresh` 有断网切页机制)而非静默半启动;(c) 查清 single-instance 为何未拦住第二实例。选哪条前必须先复现:同日两次启动的时间差是 14 分钟,尚未取证"主实例处于隐藏态时 siw 窗口是否仍在"。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7843(L1 外部持有行 L7959):

```
- [ ] **③桌面 ANR/挂死看门狗 + 崩溃分类学 —— 归属桌面端持有人,本线不代做**:上游实测在 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7844(L1 外部持有行 L7960):

```
- [ ] **④长会话滚动四维差异 —— 本波刻意未做,阻塞在"运行时自验"这一格**:四维实测在我方 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7846(L1 外部持有行 L7964):

```
- [ ] **`redact_legacy_procedural_patterns.py` 无人调度 + 元认知 `same_tool_diff_pattern` 把"正常的多样性"记成冲突**:前者是一份写好的清洗器,现读全仓引用面只有它自己的测试(`tests/test_redact_legacy_procedural_patterns.py:28` 直接按路径加载脚本),`app/` 与提交链/守护链零调用点 ⇒ 存量脏 pattern 永远不会被清(判"未接线"要数**调用面**,不是实现文件存在)。后者实测在 `app/services/metacognition.py:328-344`:同一 `tool_name` 下任意两条 procedural 只要 `pattern` 不同就产出一条 `conflict_type: same_tool_diff_pattern`、置信度 `0.6 + |score差|×0.3` 起跳 —— 而本仓自产的记录形如 `doom_loop:<tool>:<sha256(入参)>`,**天然每入参一枚不同 pattern**(摘要与旧的身份样文本在这一维等价:都是"入参不同⇒pattern 不同"),于是同一次死循环沉淀越多,冲突清单越长。这不是冲突,是枚举维度。归属:ai-service 元认知线持有者。解阻判据 = 先定义"什么才算同一工具下的真冲突"(例:同一 `pattern` 前缀 + score 反向),再把该判据接进 `detect_conflicts`,并给清洗器一个明确触发点(写入前 / 定时批量)+ 幂等证明后再谈接线。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7848(L1 外部持有行 L7966):

```
- [ ] **门 35(mypy,blocking)此刻对 HEAD 内容就是红的**:一轮 `mypy app --strict` 有 4 条错误落在 `git status` **干净**的文件上(`app/routers/llm.py:1374`、`app/main.py:257`、`app/services/tool_input_scanner.py:34`、`app/services/mcp_server.py:2333`),另 3 条落在他人持有、此刻在飞的 `app/services/agent_engine.py`。后果是 §12e 那一型:**每个碰 ai-service 的提交都被逼 `--no-verify`,连带约 180 道门对该提交作废**(本票第一枚提交就被它连带跳门,归因记录见 `.workbuddy/safe-commit-attestation.jsonl`)。两条诚实限定:① `main.py:257` 的期望类型定义在别的文件里,严格判"HEAD 面红"要一次 `git archive` 隔离检出后复量;② `tool_input_scanner.py:34` / `mcp_server.py:2333` 是"模块没有该属性",与 app/services/sandbox/(该目录已于 2026-10-12 随 G-188 下线删除) 的导出面有关,修它可能改动别人的运行时行为而非只加注解。归属:Python 侧门持有者;解阻判据 = 隔离检出复量后逐条定性(真缺陷修代码、过期注解修类型),**不得为变绿去削 `--strict` 或加 `# type: ignore`**。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7849(L1 外部持有行 L3824):

```
- [ ] 重启宿主/开机后 `%TEMP%` 才会真指 `D:\DevEnv\Temp`;在此之前任何未接 `scratch-dir` 的 〔更正等待条件(2026-09-27 现测):这条"重启宿主后才会生效"在本机**至今没兑现** —— GUI 宿主线上的进程实测 `process.env.TEMP = D:\caches\Temp`(而不是 §26 登记的 `D:\DevEnv\Temp`),而 `D:\caches` 这一族路径按 §26 属"本机不存在/历史死路径"那一型。所以它不是"再等等就好",而是**宿主环境层的分叉**:归 §26 改道机制的持有者处理,不得靠重启碰运气。本行保留未勾选,归属改为"等环境"。〕 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7851(L1 外部持有行 L11146):

```
- [ ] **架构契约表最后一块 `packages/types` 翻不正面 —— 台账旧句"0 个模块 managed:true"已失效(2026-09-28 现读)**: HEAD `config/architecture-policy.yaml` 现读 24 块里 **23 块已 `managed:true`**(表头留痕:api-client 第一块、dom-actions 第二块、i18n 第三块、repo-tooling 第四块、其后 19 块一次批量翻正),**只剩 `packages/types`**,而它被表内制度 + 镜像守卫双重按住:`EX-C2-1`(yaml 内)原文写明"按业务域拆成多入口前,不得把该模块翻 managed:true",现读 `packages/types/src/app.ts` = 5298 行(那条例外里写的 5258 已向上漂移 40 行,又一个抄旧取证的实证)而上限 2000; 镜像 `scripts/tests/check-architecture-policy.test.mjs` 的 `MANAGED_FALSE_LEDGER` 做双向集合对账 —— 径行翻正会让 T13 报"清单腐烂"红,而它不在改判据的允许面内。 所以本票**不是清账动作**:`--managed-trial packages/types` 的 0 红是那条例外遮住的,翻正而留例外=把没收口的块记成收口,翻正而删例外=当场 1 红,两种读法都不满足"翻完不产生新红"。 解阻前置(按序,四步同笔):① 拆 `packages/types/src/app.ts` 至各文件 ≤2000;② 同笔删 `EX-C2-1`;③ 同笔删 `MANAGED_FALSE_LEDGER` 的 types 条目;④ 再 trial→翻正→复跑全量/`--staged`/镜像 16 例。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7853(L1 外部持有行 L4996):

```
- [ ]**WP-8 上下文占用归因 + 流式工具账本 + 目标完成独立校验轮**。后者是补 〔PROGRESS 2026-09-26(按 HEAD 实测三件分档,票保持未勾):①**流式工具账本**已入库且有消费点(`apps/cli/src/stream-tool-ledger.ts` 在 HEAD,`commands/agent.ts`、`hooks/index.ts`、`hooks/trust.ts` 三处引用,`git grep -l` 实测非 0);②**上下文占用归因**已入库(`packages/shared/src/utils/context-attribution.ts`+ `apps/web/src/components/ai/context-usage-ring.tsx` + 定向测试);③**目标完成独立校验轮**只有契约与 web 呈现位(`packages/api-client/src/endpoints/agent-runtime.ts` 的 goalCriteria/校验结论字段 + web 词包 `goalAchieved`/`goalUnmet` 等键),**执行侧闸门零命中**:`git grep -n "verificationRound|goalVerification|judgeGoal|独立校验" HEAD -- apps/cli/src apps/api/src` = 0 命中 ⇒ 循环自宣完成仍未被强制过校验,§8 那条"禁止模型自评 yes"仍未落到运行时。解阻判据:CLI/api 循环侧接契约字段并出一枚"未过校验不得判 achieved"的用例;该格落点在 `apps/cli/src`(当前 12 个文件他人在飞),故本票不派、不代裁。〕 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7854(L1 外部持有行 L7985):

```
- [ ] `reclaim` 改写信封内容的边界:本批只在 CLI 侧由"重建提醒"兜回产物指针, 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7857(L1 外部持有行 L7987):

```
- [ ] **⑤-附:运行副本要不要也开邮件,前提已变,请重新决定**。我**没有**覆盖 `D:\DevEnv\monitor\alertmanager\alertmanager.yml`:那是当前唯一真正在到人的 webhook 路由,拿模板产物整文件替换会有回归面;正确做法是在那份文件里**追加** `global` 邮件段 + 一个 email receiver(保留原 route 不动)。因为你当初批准这条的依据是"告警从未送达",而该前提已被我证伪,所以这一步改回由你定,我不代做。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7858(L1 外部持有行 L4709):

```
- [ ]（进行中）**守门 91 冻结的 9 处待清 + 一项方法论债(2026-09-24)**:① study-publish 整文件主题化(14 处 `getTokens('light')`,8 处在模块级 StyleSheet.create 里,须改成按 scheme 生成的函数或下沉到组件内), 改完后 `node scripts/check-theme-prop-wiring.mjs --update-baseline` 应收窄; ② 7 个他人 M 在制的屏(CourseDetail / Distribution / LiveDetail / ModelPlaza / N8nModel / PostCreate / SharedDemo)待其会话自行接线; ③ `{...props}` 展开类站点被判 spread-unknown(判不出即如实报,不静默放行)—— 要真正覆盖须先给端内 wrapper 的 props 建立类型事实,属独立改造; ④ 方法论债:**本轮两次误判同源** —— 一次是把像素被 `rgba(0,0,0,0.6)` 遮罩压暗 40% 当成"颜色没落上", 一次是用"文本里有没有某个键"统计出"0 处漏传"。两者的共同错误是**用一个不测量目标东西的探针给出肯定结论**。 纪律:凡给出"0 处 / 没有 / 已全清"这类否定性结论,必须先构造一个**已知应被命中的正例**喂给同一判据(阳性对照), 否则该结论不得写进文档或据此决定"不做"。 〔PROGRESS 2026-09-25: ① study-publish 共享屏 15 处 getTokens(light) 由 commit 5ce93b9e1 清零(守门91/83 全绿);②③④ 仍开放〕 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7859(L1 外部持有行 L7989):

```
- [ ]（进行中）**合流会静默吞掉「已真机验证」的代码修复,而守门 76/71 对此零覆盖(2026-09-24 实测)**: 本会话 84583fdf6 把 PlazaScreen.tsx:464 / RankingDetailScreen.tsx:171 的 colorScheme 字面量改为 resolvedTheme,**并在 v0.0.5/code8 真机复测通过**(广场页正文由 #f5f5f5/#ebebeb 变 #242424/#1a1a1a,与 NavBar/TabBar 同档)。随后几轮 git-sync-converge 之后,HEAD 里那两处**又变回了写死 "light"** —— 并发会话有一条基于 b1a162c4e7(同文件改造)的独立提交线,经 merge-tree 合流时结果取了对方侧;该合并在 git log -- <path> 的历史简化里被隐去(84583fdf6 根本不出现),所以「我的提交还在 ancestry-path 上」完全不能证明「我的改动还在文件里」。 为什么无人拦:守门 76(stale-revert)与 71(plan-line-loss)都只在 commit 时按**暂存内容**判定,而 converge 走 merge-tree + commit-tree + update-ref,**不跑任何钩子** —— 合流层是这两道门的共同盲区。本会话同一机制差点也吞掉测试桩修复,逐字符串核对后判为误报(命中的是我自己写的解释性注释,非真实 vi.mock 调用),说明受害面是全部经合流的代码改动,不止文档。 本轮处置:已用 cc63b5bd0a 前向重落,并在提交前逐行核对「工作区 vs 当前 HEAD 差量恰好只有这 5 行」(2 处字面量替换 + 1 行 import + 1 行 useTheme 钩子),对方对这两个文件的其余改动零触碰。 建议补法(未擅自实现,属他人守门):converge 成功出口处,对本次推送范围内每个文件跑一次「本会话已提交过的 blob 是否仍被 HEAD 版本包含」断言 —— 即把守门 71 对登记行做的事,对代码行做一次;或更廉价:合流后重跑一次本会话关键判据的 grep 断言。在补上之前,任何「真机验证过」的代码修复,收尾时必须用 git show HEAD:<file> 再核一次,不得以「commit 在 ancestry 上」代替。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7860(L1 外部持有行 L7990):

```
- [ ] **仍在这台机器上、不由我裁的**:C 盘剩余 5 项未识别条目(优酷 1.3G / ClipFlow / 输入法字典 / 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7861(L1 外部持有行 L7992):

```
- [ ] **本波未闭环（归属明确，不是遗漏）**：① 桌面 `page_*` 要真成立需三处同改（新增独立 category / 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7862(L1 外部持有行 L15660):

```
- [ ] **本波自己踩到的取证纪律（已在上一批记过，仍复发，所以再记一次）**：`cmd 2>&1 | tail -N` 之后 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7863(L1 外部持有行 L7994):

```
- [ ] **上游第二轮规格派出的票（规格在 `.ihui-agent/tmp/zcode-absorb/MECHANISM-SPEC-2.md`，gitignored）**： 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7864(L1 外部持有行 L7995):

```
- [ ] **接线由主会话单做**（本波四张票都按任务书没碰 `guardian-runner.mjs` / `package.json` / 活文档）： 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7865(L1 外部持有行 L7996):

```
- [ ] **顺手登记一条门 71 的漏判(事实,非本票可修)**:上面这一整节由 `7c22d68d09b` 入库,随后被并发提交 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7866(L1 外部持有行 L11354):

```
- [ ] **`BROWSER_ACTIONS` 手抄清单不照 page 族那样派生(经取证否决,非疏漏)**: 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7867(L1 外部持有行 L9866):

```
- [ ] **我本轮犯过两次的"检查时机"错误（记下来防它再变成诬告）**：两张并行票的存在性检查，我在代理**尚未落盘时**就跑了，`test -f` 全 MISSING， 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7868(L1 外部持有行 L15863):

```
- [ ] **★ 抓到本仓一处"造好没装车"：`apps/cli/src/tools/argument-validator.ts` 在生产面零调用方 ⇒ CLI 工具入参根本不校验** 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7871(L1 外部持有行 L8121):

```
- [ ] **4 道 blocking 门红在 HEAD(各归属会话处置,本会话不代改)**:① 门 77 `check-radius-single-source` —— 纯 HEAD 检出仍 **1179 处**违规而基线只 26 条,引入者 `36b1468b19c`(09-23 18:04 把全 8 端纳入范围)未同步重算基线;② 门 83 `check-brand-foreground` —— 点名 4 文件的 `bg-white` 不在基线(内容自 `26975a4bfdd` 即在,`54282d0037f` 补登时只加了 ChatScreen、漏了 ModelConfigDialog);③ 门 7 `check-dedupe` —— `pnpm-lock.yaml` 与全部 package.json 与 HEAD 逐字节同 ⇒ HEAD 已红,引入 `63d1952cf30`(merge 锁文件);④ **门 52 `check-no-visible-spawn` 是判据自身坏了** —— 8 处命中全落在 `scripts/check-git-read-timeout.mjs:269-324` 的反引号**夹具**内,而门 80 的自测明确断言夹具不该判 ⇒ 需给门 52 补夹具豁免(与门 79 的 E1 豁免同型)。**禁止用"调高基线"消红**(门 70 口径:清理后人工确认才下调,不得为过门平账)。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7872(L1 外部持有行 L15723):

```
- [ ] **测试**:`apps/api/tests/notify-deploy-failure.test.ts`(参数解析/env 优先级/收件人消解/From 构造/Resend payload 含 html/--strict 退出码)+ PS 侧镜像测试(证明 PS 已无自拼传输)。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7874(L1 外部持有行 L11151):

```
- [ ] **本票未做的两件(归属明确,不是遗漏)**:① **同族修法早已存在,收敛器只是最后一个** —— `git-push-guard.mjs:194-211` 与 `check-push-sync.mjs:118-127` 在 2026-09-12 就改成"`ls-remote` 优先、失败才回退本地 ref",并写明两类真实事故("push 明明成功却报验证失败"、"本地已与远端同步却报落后 N ⇒ 诱导 `pull --rebase`,而本机禁用该命令曾两次删库")。**还剩两处把本地指针当第一真值**:`scripts/union-converge.mjs:479`(`resolveTargets` 用它当合并输入 —— 残值会让"已同步/目标已被本地包含"两档跳过判错)与 `scripts/check-merge-addition-loss.mjs:112`(`pendingMerges` 用它算 `remote..HEAD` 区间 —— 残值要么漏判要么重判)。正解不是再抄一份,而是把 `resolveRemoteHead` **上移到 `scripts/lib/face-reader.mjs`**(它已是注入式纯函数,构造面测试现成),让四处共用;② `alignWorktreeAfterHeadMove` 现在仍"失败只记日志",若长期失败(锁一直被占)应喊到人 —— 那属 §5e 通道口径,不由本票顺手接。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7875(L1 外部持有行 L11151):

```
- [ ] **本票未做的两件(归属明确,不是遗漏)** —— **2026-09-25 更正:① 已由 O76 收口(四处共用一份),② 仍未做**。① **同族修法早已存在,收敛器只是最后一个** —— `git-push-guard.mjs:194-211` 与 `check-push-sync.mjs:118-127` 在 2026-09-12 就改成"`ls-remote` 优先、失败才回退本地 ref",并写明两类真实事故("push 明明成功却报验证失败"、"本地已与远端同步却报落后 N ⇒ 诱导 `pull --rebase`,而本机禁用该命令曾两次删库")。**还剩两处把本地指针当第一真值**:`scripts/union-converge.mjs:479`(`resolveTargets` 用它当合并输入 —— 残值会让"已同步/目标已被本地包含"两档跳过判错)与 `scripts/check-merge-addition-loss.mjs:112`(`pendingMerges` 用它算 `remote..HEAD` 区间 —— 残值要么漏判要么重判)。正解不是再抄一份,而是把 `resolveRemoteHead` **上移到 `scripts/lib/face-reader.mjs`**(它已是注入式纯函数,构造面测试现成),让四处共用;② `alignWorktreeAfterHeadMove` 现在仍"失败只记日志",若长期失败(锁一直被占)应喊到人 —— 那属 §5e 通道口径,不由本票顺手接。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7878(L1 外部持有行 L15857):

```
- [ ] **ai-service `.venv` 处于半损坏态**:`.venv/pyvenv.cfg` 丢失(venv 退化成全局解释器视角,`python -m pytest` 报 no module;已按 uv 0.12.4 形态重建 cfg 恢复 venv 识别),且 `uv sync` 全量对齐被 **pywin32 的 pywintypes312.dll 文件锁**打断(本地有一个 61MB 的 python 进程疑似占着 DLL,不杀并行会话可能在用的进程)。当前状态:大部分包在,`requests`/`idna` 等在 sync 中断中丢失,O17/A2A 卡片测试文件因 import 链过长暂无法在本机 pytest。**修复路径**:确认占 DLL 的进程身份并终止(或停本地 ai-service dev 实例)→ 重跑 `uv sync --no-install-package pywin32` → 跑 `tests/test_a2a_agent_card.py`(含 2026-09-24 新增 3 用例)。O20 的行为正确性已由临时验证脚本 7/7 实证(`.ihui-agent/tmp/mail-0924/verify_host_fix.py`,用后即删)。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7880(L1 外部持有行 L15661):

```
- [ ] **传输层单点化**:`notify-deploy-failure.ts` 扩为通用品牌告警派发器(`--to`/`--title`/`--message-file`/`--severity`/`--source`/`--plain`/`--env-file`/`--strict`/`--dry-run`,SMTP→Resend 双通道且 Resend 必带 `html`);PS 侧删除全部自拼传输代码,改为按绝对路径解析 node+tsx 调用该脚本,降级路径也只能走 `--plain`(仍不留第二份 SMTP 代码)。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7881(L1 外部持有行 L15724):

```
- [ ] `/api/agent/goal-verify` **无生产消费方**(端点已注册、测试已断言路由存在,但 goal 运行循环 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7882(L1 外部持有行 L8004):

```
- [ ]（进行中） **守卫票：`scripts/i18n-apply.mjs` 把未知参数当"无参"，`--help` 即直接写盘**。本轮实测代价见上一行(四份语言包被陈旧载荷重排，已逐字节还原、零损失)。要求的修法：① `--help` / `-h` 只打印用法并 exit 0；② 任何未识别参数一律 **exit 2 并点名该参数**，不得降级成默认动作；③ 写盘前若输入载荷的 `translatedAt` 早于目标文件 mtime、或本轮没先跑过 `--check`，拒绝写并说明原因。验收判据：`node scripts/i18n-apply.mjs --help` 跑完后 `git status --porcelain -- packages/i18n` **必须为空**，并把这条负向判据钉成镜像测试。**守卫落地前，任何人不要用这个脚本试参数。** 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7883(L1 外部持有行 L8005):

```
- [ ]（进行中）**授权缺陷：`POST /skills/:name/unlist` 只有 checkAuth 却做硬删条目** ⇒ 任意登录用户可永久删除他人/内置市场条目；注释自称"admin 治理动作"但实现里连 admin 校都没有（注释与实现分叉）。唯一调用方是 admin 页 ⇒ 收紧不破坏正常路径。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7884(L1 外部持有行 L8006):

```
- [ ]（进行中）**P0 授权缺陷：`POST /skills/market` 可用自报 author 认领平台内置技能**（主会话逐行实测：787-789 行 `existing.ownerId=publisherId; source="user"` 的"归属补齐"，其上游闸门 773 行只比 `body.author` 字符串；内置种子 `author:'IHUI'` 源码公开且无 ownerId；该端点零 admin 校 ⇒ 任意登录用户可①认领内置技能②改写其 description/tags/version/license③触发对全体订阅者的伪"更新"通知。注释 764 行"不接受请求体自报"与实现分叉） 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7885(L1 外部持有行 L4700):

```
- [ ] **本轮未落地、需重做的一批(web 86 处内的键名对齐)**:该批次报告改了 4 个文件(`DeveloperKeyDialog` / `AiGenerationContent` / `PermissionSelector` / `helpers`),**逐条按内容复核后全部不在 HEAD**(`git grep <新键名> HEAD -- apps/web` 四处均 0 命中),工作区也已被并发会话覆盖 → 判为**丢失需重做**,不要当成已完成。中途我一度按"工作区里有"记成"已落地",那是读到了被覆盖前的窗口 —— 并行期复核一律以 **HEAD 对象树内容**为准(档案第 4 节已记此教训)。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7886(L1 外部持有行 L11193):

```
- [ ] **本线仍未闭环的一件(归属明确,不是遗漏)**:守门 93 的 **R1/R2/R4/R5 那半边仍按磁盘读** 两份 token 源文件,而同文件 R3 段头(`scripts/check-cross-end-tokens.mjs:1367`)自己写着"扫**仓库内容**,不扫共享工作树的未提交缓冲区"⇒ 同一道门两种取材面,AGENTS「口径同 77/83/98:全量判 HEAD blob」对它**只对了一半**。静态证据(本机不得为取证去改共享 token 文件,故不给动态复现):`grep -n "readFileSync(RN_TOKENS_PATH\|readFileSync(TOKENS_CSS_PATH" scripts/check-cross-end-tokens.mjs` 命中 1297/1298/1563 三处主流程读取。**当前不构成红点**(实测两文件工作树==HEAD),按"未引爆不动他人面"登记;解阻判据:任一 `pnpm check:all` 轮里这道门因这两份文件报出与本次提交内容无关的差异,即当场按 R3/R6 同形收口(HEAD / 索引 + `--worktree` 逃生舱)。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7887(L1 外部持有行 L15860):

```
- [ ] `config/architecture-policy.yaml` 目前 0 个模块 `managed:true` —— 渐进收口的第一块翻正面尚未选定。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7888(L1 外部持有行 L8009):

```
- [ ] **紧急(他人暂存态,非本会话所为,2026-09-24 11:0x 发现)**:**索引里有 16 条"已暂存的删除"**,一次不带 pathspec 的普通 commit 就会把这些**已入库功能从版本树删掉**。清单含三个成体系功能族 + 一道守门:① D62 语音字幕(`packages/shared/src/chat/voice-subtitles.ts` + web 组件 + 测试)、② D91 批注锚点(`annotation-anchors.ts` 同族)、③ D67 额度归属(`quota-ownership.ts` 同族)、④ **并发会话 cb99ef0c 刚提交的 `apps/mobile-rn/src/theme/color-scheme-sync.ts` 及其测试与 NativeWind mock**(删掉即把"App 主题开关驱动 NativeWind"这次修复整体回退)、⑤ `scripts/check-home-junctions.mjs` + 其镜像测试。**判为误删而非迁移的依据**:索引里的桶文件 `packages/shared/src/chat/index.ts` **与 HEAD 一字未改且仍导出这三模块**(二者矛盾 ⇒ 构建必炸,实测 Metro 就在 `export * from './voice-subtitles'` 处失败),且`git ls-files` 全仓**无替代路径**。**本会话处置边界**:只把 13 个文件(2626 行)的内容**恢复到工作区**让构建可用,**索引一字未动** —— 是否撤销这些暂存删除由制造它们的会话自己决定(§5b:他人已暂存的删除只报数、不代裁)。取证:`git diff --cached --diff-filter=D --name-only`;复跑恢复:`node .ihui-agent/tmp/rn-build/restore-worktree.mjs`。**另注**:`heal-worktree-tracked.mjs --check` 此时报"工作区已跟踪文件存续正常"—— 其判据②要求"索引 blob == HEAD blob",而暂存删除使该条件不成立,故**这类"已暂存的删除"不在存续自愈覆盖面上**,是一道无人看的路;要闭环需在守门侧对 `--diff-filter=D` 的暂存删除单独计数并阻断(未擅自新增守门,留单)。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7889(L1 外部持有行 L8010):

```
- [ ] 钩子 trust 的**残余面**:webhook 形态钩子仍不过门(本批按 command 收口); 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7891(L1 外部持有行 L15659):

```
- [ ] **C 清单里那条"原生 `<a>` 不算 affordance"我试过当场扩,撤回 —— 它不是一行白名单**(2026-09-26): 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7894(L1 外部持有行 L8014):

```
- [ ] **本批否证与不作为登记**：`monitoring/alertbridge/alert-webhook-bridge.cjs` 在 HEAD 面上有 **7 处 `no-unused-vars`（`catch (e)` 未用）**，实测与本批改动无关（HEAD 副本同一把 lint 同为 7）⇒ 按"只做被点名工作流"未顺手改；跨行的凭据（关键词与值分居两行）bridge 结构上不命中，已写进文件注释而非只写进报告。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7895(L1 外部持有行 L8015):

```
- [ ] **门 137 升更严判据的前置条件（现在不许顺手升）**：首跑 3 命中里 2 处是同词不同义的假阳性 ⇒ 词元匹配仍需收窄（`idx/index/position` 后缀、复数名词指"集合"两种形态尚未进判据）；且 `--strict` 下有 **305 处未判定**（`digest` 两义、`node_modules` 之外的手写散列不可逆性判断）⇒ 本门长期停在建档/报数形态，`--strict` 只在清偿时跑。**不得为消红放宽判据，也不得因数字大而把假阳性当缺陷去"修"没坏的东西。** 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7896(L1 外部持有行 L8016):

```
- [ ] **本波次之后仍 open 的账(逐条带归属,派单前先读这一格而不是重新猜)** 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7897(L1 外部持有行 L10189):

```
- [ ]**第二十八批:布尔 ack 的键族从 `deleted` 扩到 `removed / restored / revoked / cleared`**(扩键后的普查现读 **27 处代码面**,其中 12 处是已定性的 `deleted` 那一族): 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7899(L1 外部持有行 L10223):

```
- [ ]（登记，非本线）relay admin 4 个删除端点零测试覆盖、`o13-bg-rls-live.test.ts` 需要自己的串行通道 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7900(L1 外部持有行 L10183):

```
- [ ] P1 残余②:桌面端 `tauri_plugin_log` 注册处只给了 `.level(Info)` 而**未设 target**,日志只进 stdout 不落文件(实测本机无任何 desktop 日志文件)⇒ 这类「卡死但不退出」事后完全无法归因,本票是靠读 runtime 源码 + 现场进程取证才定性的。修法=显式加写文件的 log target,落点须走 §15b 批准的日志根,属可观测性改动另计一票。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7901(L1 外部持有行 L8022):

```
- [ ] **守门 134 的第二格仍开着（① 已按票面处置完毕,结论是"不补判据、固化测量",枚 `fd46aa9da`）**：① B2 那一跳接裸 SQL 维 —— 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7907(L1 外部持有行 L10223):

```
- [ ]（登记，非本线）relay admin 4 个删除端点零测试覆盖、`o13-bg-rls-live.test.ts` 需要自己的串行通道 〔2026-09-28 现读更正:前半已收口 —— `apps/api/tests/relay-admin-delete-honesty.test.ts`(枚 `ba0575f9b` 在账)恰好覆盖 4 端点×正常/越权/404 共 16 例,本会话现跑连跑两遍 16/16 全绿,且核实 4 链 ack 全部由 .returning() 集合派生无假 ack;后半(o13-bg-rls-live 串行通道)本会话另派在执行。票暂不翻,待后半落地一并归位。〕 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7909(L1 外部持有行 L8032):

```
- [ ] 副本指针(编号 62)：同主键第二份未勾选副本,只加指针不动勾选;当前状态见同主键的当前状态那条(编号相同、不带租约)(该条写明 ChatSearchBar 前提被推翻与 use-chat-search 投影现场)。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7910(L1 外部持有行 L8033):

```
- [ ] 副本指针(编号 63)：本行与上一条同主键、是并发并集留下的第二份未勾选副本 ⇒ 按 §1 只加指针不动勾选;当前状态见同主键的当前状态那条(编号相同、不带租约)。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7911(L1 外部持有行 L8034):

```
- [ ] 副本指针(编号 75)：同主键第二份未勾选副本,只加指针不动勾选;当前状态见同主键的当前状态那条(编号相同、不带租约)(该条写明默认档与三轴派生阈值及残余)。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7912(L1 外部持有行 L8035):

```
- [ ] 副本指针(编号 51)：同主键第二份未勾选副本,只加指针不动勾选;当前状态见带「三面 parity 门 136 现读未接线 0 类」注记的那条(该条写明六类执行器真接线、stub 两类按 §7 保留) 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7914(L1 外部持有行 L8048):

```
- [ ] **`--self-test` 的"登记侧不求值"洞已逐门普查完:41 道潜伏 / 今天掩盖真缺陷 0 条 / 根因是没有共用出口(普查判定面=HEAD,派单前须重跑)** —— 起因是本轮代落守门 41 时量到它的 13 条 self-test 全部传箭头函数而登记函数写的是 `!!ok`(`!!fn` 恒真)⇒ 一路打印"13/13 通过"却一条都没判过,在这个掩护下同文件一处单位错误(把**秒差**除以 3,600,000 ⇒ 48h 豁免窗实际约 5.5 年,"超窗仍判"那条反向对照永不触发)长期隐形。该门已修并补镜像(枚 `aea810c81`)。随后按 HEAD 面普查全仓 `scripts/**`(418 个 mjs)得到这一族的**全量分布**: 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7915(L1 外部持有行 L8049):

```
- [ ] **`plan-tasks-merge.mjs --dedupe-blocks` 的阈值覆盖不到"两行逐字相同的单行副本"这一型（现读实证：86H 那一条已完成行在 HEAD 面有 2 份逐字相同副本 —— 计数用 `git show HEAD:PROJECT_PLAN.md | grep -c "86H. agent 审批的权限决策落审计链"` = 2；按 §1 判据 3 不写行号，行号在 append 后必挪位）**：该出口只认 **≥3 行且每行 ≥40 字符的连续 bullet 块逐字相同**（阈值本身是对的 —— 低于它会把台账里天然成对的短行成百地报出来，噪声淹信号），于是"同一件事被写成两份、每份都是单行"恰好落在缝隙里；而 F1/F2/F4 也都不计它（四条判据里"待办副本"要求未勾形态，两份都已 `[x]` ⇒ 账面 0，`plan-tasks.mjs --staged` 现读 F 维全 0）。**这一型有两条候选制造路径(本票未定性,不得读成已归因)**:活文档 union 把改写前那份带回来;门 71 的 post-commit 自愈按标记回捞"丢失"的行 —— 若那一行其实是被**就地改写**(旧行已按 §1 留在原位、新行另处再写一份),回捞就会补出第二份。定性要跑一次可控复现(独立临时仓里"改写一行 → 触发自愈"看它补不补),不在本票顺手做。**在等谁**：归并器持有人裁 —— 出路只有两条且都要人拍：a) 给 `--dedupe-blocks` 加"同主键 + 逐字等值 + 已完成形态"的单行档（判据必须是**逐字等值**，半行不同就交人工，理由同它现有那条"机器折半即有损"）；b) 或在门 71 自愈侧改为"编号在面上已存在即不追加"（那是生产者侧收口，比事后清账更对，但要证明不会把真丢行也一并按住）。**不得**由本票手工删行：删已完成行受 §1"禁止无声删除"约束，而两份哪份作数要按主键而不是按行号（§1 判据 3 已把行号指针判为不可用作证据）。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7918(L1 外部持有行 L7607):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7697(G-401) 同题,派单以持有行为准,本行不再单独派单。〕 **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔拍板 2026-10-05(机主选"未知即按写处理"):MCP 工具默认档不再算 `read` —— 需批准、失败不自动重跑;确实只读者按"服务器 + 工具名"显式登记白名单并把白名单纳入跨语言对账。落点在 `apps/cli/src/tools/hub/mcp-adapter.ts` 与权限档两侧持有人;派单排在 G-710 那枚同目录代理之后,避免两个代理同改一个文件〕
```

- 原 L7919(L1 外部持有行 L7608):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7698(G-402) 同题,派单以持有行为准,本行不再单独派单。〕 **设置项"显式清空"与"从未设置"无差，且读侧同一含义两键相反（需拍板；归属：api 设置面 + web 设置页持有人）** —— 已亲自复验：`apps/api/src/routes/user/settings-routes.ts:55` 写体是 `z.record(z.string(), z.unknown())`，落库处 `value === null || value === undefined ? null : String(value)` ⇒ `null` 与"缺席"存成同一个 NULL 行；读侧 `apps/web/app/(main)/settings/notifications/page.tsx:48-52` 四键混用 `!== 'false'`（默认真）与 `=== 'true'`（默认假），于是**同一个被清空的值，在前一族读回 true、在后一族读回 false**。上游同族做法是把三态写进契约（`settings/pluginConfigPatch.ts:29-36`：`undefined`=未触碰跳过、`null`=进 `clearOptionKeys`、sensitive 空串=不改已有值；落库侧 `file-config.adapter.ts:557-565` 按 option key 合并而非整对象替换，防同 scope 密钥被静默清空）。**为什么还开着**：改成三态要动 PUT 语义（单键 DELETE 出口我方根本没有——`deleteUserPreference` 只服务 devices），属对外契约决策；先拍"要不要有删键出口"，再谈读侧归一。**不得**靠"读侧统一成 `=== 'true'`"消红——那会把默认真的四项静默翻转。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7920(L1 外部持有行 L15687):

```
- [ ] **双重执行**(两次 LLM、两遍工具副作用),比占位错误更坏;改成消费返回值必须与把手面登记同枚提交,而那三个文件此刻由他人持有。补丁形态已写在代理交付报告里(`handoff = await take_loop_v2_handoff(…); if handoff is not None: return AgentStepResult(**handoff.step_result); guard_loop_v2_pilot(…)`),**归属:ai-service 编排线持有人**。**同轮量到的一条既有事实(接线那票必须一并拍板)**:`AgentLoopV2.run()` 在 completed/error/max_iterations 后**无条件** fire-and-forget `meta_learner.evaluate_and_record`,它用**真实 `llm_gateway`** 再发一趟 LLM 并经 `KeyPoolSelector → get_shared_pool` 触生产 PG,同一份代码两次跑出 0 次与 3 次连接池触碰(实测非确定性);收敛档一旦真接上,**每次编排都会多一次计费 LLM 调用 + 一次落库**。本票测试里显式掐掉它并留了活的连接池哨兵。另:`progress_callback` 在新链路是循环结束后按真实顺序回灌、不是实时(旧路径跑一步发一次),没拿它冒充实时。 (原行首编号在此留原文) 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7921(L1 外部持有行 L8054):

```
- [ ] **上述②的两格"审面根因"分别是独立一票,现各写清归属与解阻前置**:① **守门 57 的清单计数只看台账、不看归档件**(它 `checkBaseline` 的 `entryCount` 有一部分来自台账里 `data.planSource.taskLinePattern` 匹配的 D 族行)⇒ 正解是把审面改成"台账 ⊕ 同面归档件"(`git ls-tree HEAD` / 索引列目录,照**门 71 的归档豁免**与**门 13c 的 A2/A3 同面取材**那两个先例抄,不得 `readdirSync`),基线一律不动;本票已派子代理做,落地判据 = 私有索引端到端两臂(台账摘掉而归档件同字在 ⇒ rc=0;两侧都摘 ⇒ rc=1 并点名)。② **取号只看台账面的 max**(`lib/plan-task-index.mjs` 的 `usedIdsOfPrefix` 只看被审的 `PROJECT_PLAN.md`)⇒ 归档后同一个号会被再发一次,这是①的同族、量纲不同(号段单调性 vs 计数存续)。它**此刻被他人持有**(`scripts/lib/plan-task-index.mjs` 与 `scripts/plan-tasks.mjs` 工作树各有在飞改动,本会话按 §12 边界未动),**解阻前置**=那两文件的在飞改动入库后,由同一持有人把 `usedIdsOfPrefix` 扩成"台账 ⊕ 归档件"或给 `live-doc-edit` 的令牌加一道"号已在归档面出现过 ⇒ 继续往上取"的复核;不得由旁路会话按 pathspec 交工作树版本(那会把别人的在飞改动整批写回旧态)。〔编号改派留痕(2026-09-28):原 G-362「桌面端「启动后先进托盘」在真机采样里出现过一次」 与另一条先入的登记撞成一号两事,按"后来者改号"由 live-doc-edit 的取号令牌在每次 CAS 里按当下 HEAD 现算;正文一字未动。〕 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7922(L1 外部持有行 L8055):

```
- [ ] **守门 150(角色档合规)在 HEAD 面判红 471 族,而它是 blocking:定级与存量锚点未对齐** —— 现读 `node scripts/check-radius-role-conformance.mjs` 末行「判红 471 族 / 已判合规 2215 / 弱证据待裁 93 / 未判定 1」。它挂 `apps/ + packages/`,意味着任何一次提交都要先清偿这 471 族,否则唯一出路是各会话跳钩子、连带其余全部守门作废(§12e 那一型)。归属该门持有者,两条正当出口:① 把这 471 族按"首锚 + 只拦新增"落进它自己的 `anchorRegression` 台账;② 或降 warn + `--strict` 问责。**禁止**为让报告变绿去放宽类别判据或把 card 一律改成 lg —— 弱证据实测判错率 20–70%,批量改档等于重新设计。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7924(L1 外部持有行 L15689):

```
- [ ] **A1 改道校验只比大小不比内容（可立即修；归属：§26 C 盘改道线，本票持有人即我）** —— 见上文 A1 与现读落点。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L7972(L1 外部持有行 L15859):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L6964(G-208) 同题,派单以持有行为准,本行不再单独派单。〕 **G-1018283. 生产备份链日志的写入侧编码要改成 UTF-8(2026-09-28 逐行 strict-UTF-8 现读登记)**:`D:\DevEnv\logs\pg-backup-scheduler.log` 自 **L571(2026-09-09 00:58:12,字节偏移 25,709)起由 UTF-8 切成 GBK 并持续至今**(前 570 行 520 行中文正常 / 之后 360 行非 UTF-8,0 个 `U+FFFD` ⇒ GBK 侧可无损还原)。**同批纠一处台账失实**:`scripts/alert-volume-report.mjs` 头注把"GBK/UTF-8 混合"记在 `deploy-loop.log` 头上,而该文件实测**整档是合法 UTF-8** —— 坏的是 09-24→09-28 那段已烘死的 475,314 个 `U+FFFD`(行 120,624–257,864,子进程管道阶段就把非 ASCII 字节换成替换字符,**原字节不可回收**);该处文案已按现读改写(规矩"只用 ASCII 判据"一字未动,改的是它给的错误机理 —— 按旧文案下一个人会去修解码器,而解码器没有坏)。**为什么现在不当场做(等环境条件,不是等人拍板)**:改法是 `deploy/win/ihui-pg-backup.ps1` 顶部加一条进程级`[Console]::OutputEncoding = UTF8` 并同笔把 `deploy/prod-bundle/` 那两份运行副本改成逐字节等值(由 prod-bundle 影子对账门判等),调度器每轮用 `&` 从磁盘重读子脚本 ⇒ 不必重启服务、下一轮 03:00 起生效;但它落在**生产备份链实际执行的那份文件**上,而"改转发壳后重启曾让 `pg_dump` 挂 3.5 分钟"那次至今没解释清(本轮另测近 5 轮各 8–15 秒,挂起不可复现)——在解释清之前不动生产备份,这条规矩自 2026-09-24 起就写在案。**归属**:生产备份链持有人。**验收判据(必须"改完且跑过")**:新增行的 strict-UTF-8 解码 non-UTF-8 计数 = 0;历史 GBK 段不做改写(对已入库运行态日志做转换属另一类动作)。**顺带一格(不单独开票)**:`IHUI-DEPLOYLOOP` 的守护半在 09-26 11:09 起就驻留旧脚本,其 catch 支管道仍按旧编码写,全档该支触发 0 次 ⇒ 零观测损伤,并入既有低峰重启窗口即可。〔2026-10-01 影子漂移现读(备份链对账会话):方向=**入库源前进而运行副本陈旧** —— 42d1b6d1c6 给 ihui-pg-backup.ps1 加 PG 就绪门、43a0b7c01c+8f4ddccba6 给调度器加 30 分钟重试与本票 UTF-8 写入侧,而 deploy/prod-bundle/ 两份运行副本经 git blob 比对逐字节等于 17d45f6e72(09-28)/f84ee1bae7(09-24) 旧版,mtime 停在 09-25/09-29 ⇒ 非被人单独改过,是本票"同笔把运行副本改成逐字节等值"那一半未在本卷发生;check:all 第 24 步两 S3 红(174 行/70 行)。注意:台账 21618/21619 自记"影子已同步+门绿+服务已重启"与本卷磁盘态矛盾(疑在另一卷/另一机执行,本机现无 IHUI-PG-BACKUP 服务亦无相关计划任务)。按本票硬约束未动生产副本,待 3.5 分钟挂起解释清后再同步。〕 〔让号记录(2026-10-02 F9 清偿批②):原号 G-385 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕
```

- 原 L7983(L1 外部持有行 L15701):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11128(G-453) 同题,派单以持有行为准,本行不再单独派单。〕 G-210 **台账 F4(重复登记副本)对"同一待办的漂移副本"结构上失明 —— 现读一例:同一条 D41后续① 在 HEAD 有 9 份未勾选副本、其中 7 份正文互不相同(2026-09-28 量)**: `plan-tasks.mjs` 的 F1/F4 判据是"编号 + 标题前缀**逐字等值**",这既是它的优点(不做相似度猜判)也是它的洞 —— 并发 union 每次都留一份**带自己注记**的副本,前缀之后的正文一漂移,复合主键就不再相等,于是同一件事以 N 份"未勾选"长期并存。后果不是账面难看而是**派单被放大 N 倍**:本日两次 `plan-tasks-merge.mjs --heal --commit`(归并 30 行 / 34 行)把 F1/F4 都归到 0,而这一族一份都没被动到 ⇒ "跑过归并"不等于"这一族被覆盖"。出路只有两条且都不该由机器代裁:① 归并线逐组判"哪份是当前状态"(需要读注记语义,机器判不了);② 给登记侧加一条硬约束——同一件事要更新就**就地改那一条**(§1 第 2 条已有此规矩,缺的是让机器能在前缀一致而正文漂移时也点名)。本票**只登记现读证据与两条出路**,不改判据、不批量翻勾(批量翻勾 = 把别人的注记当噪声删,比原病更响)。归属:分叉合并归并线(同 G-363 那条持有)。 (编号改派留痕(2026-09-28):本行原取 G-417,与「全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红」一条撞成一号两事;取号发生在分叉的两条腿上,号段不共享。让位的是**本行**(它是我这一路登记的),别人的行不动;新号由取号令牌按当次 CAS 的 HEAD 现算,落地后须复核它不与任何行首编号重复。正文一字未动。)〔让号记录(2026-10-09 F9 清偿批⑤承接):同题同批承让到 G-210(持行由取号令牌现算,见该行让号记录;机主拍板 2026-10-09 代码引证优先,原号 G-417 留归「全量守门盘点」侧),本行正文除编号位与本记录外逐字未动。〕
```

- 原 L7984(L1 外部持有行 L7582):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7672(G-470) 同题,派单以持有行为准,本行不再单独派单。〕 G-1018294. **共享索引被整批清空后,"他人已暂存的删除"会失去保护标记,并被工作区存续自愈当成外部删除恢复**(归属:安全提交器 + 存续自愈两处持有人;等环境条件 = 需先定"意图删除"与"宿主误删"在恢复前用什么区分,不是等人拍板措辞):实测链(2026-09-28 09:13–09:17,本机=生产,多会话并发) —— 另一会话把 `apps/ai-service/tests/test_tool_approval_grant_lifetime.py` 以 `D ` 形态暂存(该文件是它当天新建、已入库的测试,`git status` 显示索引里有暂存删除);我用 §12 强制的 `node scripts/safe-commit.mjs` 提交自己的 2 个文件,其 Step ① 是 `git reset HEAD` **清空整个暂存区**(该设计的目的正是别把别人的在途内容打包进我的提交),效果是那枚暂存删除的保护标记一起没了;2 分钟后 `git-guardian` 的存续自愈判定"工作树缺该文件 ∧ 索引 blob == HEAD blob ∧ HEAD 里有它"三条成立 ⇒ 恢复磁盘副本,日志原文:`✅ 工作区存续自愈:恢复 1 个被外部删除的跟踪文件(apps/ai-service/tests/test_tool_approval_grant_lifetime.py)`。**净结果这次是好的**:恢复内容与 HEAD 逐字节同值(零独有数据、零伪造),且该测试实跑 `5 passed`(RC=0,证据 `.ihui-agent/tmp/ff-race/pytest-grant.ev`)—— 也就是说被"恢复"的是一件确实该存在的东西,而它此前那次暂存删除更像宿主清理层命中 `tests/` 整目录(AGENTS §5b 记过该型)而非有意移除。**但机制本身是反的**:存续自愈的设计前提恰恰是"他人已暂存的删除只报数、不代裁",而一次**与它无关**的第三方提交就能替那个删除摘掉标记 —— 若那枚暂存删除是有意的(例如某票按 §7 迁移测试文件),本机会话的每次提交都会把它复活,而两边账面都绿:提交方只看到"我的 2 个文件",自愈方只看到"外部删除 + 零独有数据"。**要谁做什么**:① `safe-commit.mjs` 在 `git reset HEAD` 之前把 `git diff --cached --name-status` 的现状留底,复位后**逐路径恢复 D 标记**(或至少在输出里点名"本次清空了他人的 N 项暂存删除"),让归属会话能看见而不是事后发现;② 存续自愈恢复前问一句"该路径最近是否出现过 ` D`/`D ` 形态"(reflog/索引事件),分不清就只报数。**不在本票范围**:改动别人那枚删除本身(既不支持也不阻止),以及 §7 对"删除 git 对象前先答三问"的既有纪律。 〔让号记录(2026-10-02 F9 清偿批②):原号 G-461 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕
```

- 原 L8025(L1 外部持有行 L7654):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7745(G-681) 同题,派单以持有行为准,本行不再单独派单。〕 **G-333. 行号指针在活文档 union 后回到 211 处(其中 205 处无自动出口)+ 同主键两态 20 组复活(2026-09-28 现读,归各行持有人;判据没有坏)**:现读(`node scripts/plan-tasks.mjs --gate`,判定面 HEAD blob)**F3 行号指针 211 处 = 可自动收口 6 / 无出口交人工 205**,而本会话上一枚计划文档提交前这一维是 **8 处**;同一次合并还带回 **F1 同主键两态并存 20 组 / 涉及未勾选行 28**。**成因不是判据变尖,是载体换了一批行**:合并 `6226d6449` 的活文档档走"两侧行 union",把对侧新登记的一整批「…登记在 L####」式证据指针原样并进来 —— §1 明文「证据指针禁止写行号,行号在任何一次 append 后都会挪位」,所以**唯一出路是把这些行改成内容锚点(编号 + 标题原文),不是把 F3 族表放宽去迁就它们**(放宽 = 替人做出"这一族已合规"的判断,与本仓"判据必须覆盖门自己产出的形态"相反)。**为什么这不是一台恒红门**:提交链跑的是差值棘轮(`--staged --gate` 只拦"本次让分叉变多"),全量档只点名,所以下一个人正常提交不会为别人欠的账跳门(§12e);要问责存量跑 `--gate --strict`(现读即红,那是它拒绝出合格证,不是仓库故障)。**逐条出路(不得整批改)**:① 6 处可自动收口的由 `node scripts/plan-tasks-merge.mjs --heal --commit` 收(它只动 `autoFixable` 的行 —— 即"目标行仍是同复合主键的条目行"那一格);② 205 处无出口的**只能由该行持有人改写**:取清单 `node scripts/plan-tasks.mjs --pointers`,模板就用归并器自己产出的措辞(`同主键的另一条登记「编号 · 标题」`),因为 F3 认它、而写行号不认;③ 20 组 F1 复活行**本轮不要再清** —— 上游生产者已由 `8fa037255` 那行登记(自动归档器按磁盘底稿整文件写回),生产侧没修之前清完就会被下一次 union 带回,白烧提交与门禁链。**归属分层**:G- 号这条判据与两个出口由台账工具线持有;205 处指针文本归各行持有人;生产者侧(归档器取材面)归 `8fa037255` 那行的持有人。**它在等什么**:等各行持有人按 ② 改写,不等环境条件、也不等技术参数。**核验本行是否解除**:`--gate` 现读 F3 的"无出口交人工"归零且 F1 为 0 组。 〔拍板@2026-10-08 机主:维持归属各行持有人——F3 205 处指针文本由各行持有人改写为内容锚点,F1 20 组待生产者侧(归档器取材面)修复后再清;本会话不代裁〕
```

- 原 L8051(L1 外部持有行 L7607):

```
- [ ]〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7697(G-401) 同题,派单以持有行为准,本行不再单独派单。〕 （进行中@2026-10-05/g1-main）**MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 〔拍板 2026-10-05(机主选"未知即按写处理"):MCP 工具默认档不再算 `read` —— 需批准、失败不自动重跑;确实只读者按"服务器 + 工具名"显式登记白名单并把白名单纳入跨语言对账。落点在 `apps/cli/src/tools/hub/mcp-adapter.ts` 与权限档两侧持有人;派单排在 G-710 那枚同目录代理之后,避免两个代理同改一个文件〕 〔拍板@2026-10-07 机主:两步走——①先给14枚无标注工具补显式dangerLevel(零行为变更);②MCP适配层缺省翻dangerous(要批准),对照上游clientHello事故与#94手机高危无弹窗信任缺陷;cli权限档持有人按此执行〕 〔拍板@2026-10-07 机主:两步走——①先给14枚无标注工具补显式dangerLevel(零行为变更);②MCP适配层缺省翻dangerous(要批准),对照上游clientHello事故与#94手机高危无弹窗信任缺陷;cli权限档持有人按此执行〕
```

- 原 L8052(L1 外部持有行 L7608):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7698(G-402) 同题,派单以持有行为准,本行不再单独派单。〕 **设置项"显式清空"与"从未设置"无差，且读侧同一含义两键相反（需拍板；归属：api 设置面 + web 设置页持有人）** —— 已亲自复验：`apps/api/src/routes/user/settings-routes.ts:55` 写体是 `z.record(z.string(), z.unknown())`，落库处 `value === null || value === undefined ? null : String(value)` ⇒ `null` 与"缺席"存成同一个 NULL 行；读侧 `apps/web/app/(main)/settings/notifications/page.tsx:48-52` 四键混用 `!== 'false'`（默认真）与 `=== 'true'`（默认假），于是**同一个被清空的值，在前一族读回 true、在后一族读回 false**。上游同族做法是把三态写进契约（`settings/pluginConfigPatch.ts:29-36`：`undefined`=未触碰跳过、`null`=进 `clearOptionKeys`、sensitive 空串=不改已有值；落库侧 `file-config.adapter.ts:557-565` 按 option key 合并而非整对象替换，防同 scope 密钥被静默清空）。**为什么还开着**：改成三态要动 PUT 语义（单键 DELETE 出口我方根本没有——`deleteUserPreference` 只服务 devices），属对外契约决策；先拍"要不要有删键出口"，再谈读侧归一。**不得**靠"读侧统一成 `=== 'true'`"消红——那会把默认真的四项静默翻转。
```

- 原 L8071(L1 外部持有行 L15577):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-10-08·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）**G-316. 门 8 清账后遗留的三枚"有消费方的待实装路由"(2026-09-28 登记,现读=基线仅剩 3 处)**:① `GET /api/subagents/all` —— 消费者 `apps/web/app/(main)/agent-teams/page.tsx:58`(期望 `{dispatches}` 含 completed/failed/cancelled 全量);后端只有 `/subagents/active`(仅 pending/running,形状恰好相同但语义是子集,**不得**为省事把客户端改道 active —— 那会把"页面少了历史"写成"已修")。正解 = 在 `subagent-dispatch.ts` 补 all 列表路由(带 status/limit 透传)。②③ `PUT /api/ai/n8n/workflows/:id` 与 `POST .../toggle` —— 消费者 `apps/mobile-rn/src/screens/N8nModelScreen.tsx:146/192`(保存改名/启停今天必 404);后端 n8n 面只有列表透传与创建转发(miniapp-compat-routes.ts:1123/1190),n8n REST API 本身支持 workflows/:id 更新与 activate/deactivate,正解 = 在 n8n 代理补两枚透传(SSRF 校验与 env 缺省回 stub 的既有纪律照抄)。验收判据:两枚消费者页面真机/真会话各跑一次成功路径 + 基线 `scripts/api-routes-baseline.json` 清零 + 门 8 末行现读 0。**归属**:subagent 面 = agent-teams 线;n8n 两面 = n8n 代理持有人(本票只登记形状与消费者证据,不代裁实现位置)。 〔落地@2026-09-28/枚 2704c4d27〕三枚路由已入库:subagents/all(新→旧+status/limit)、/ai/n8n/workflows 面四枚(list stub/写 503/fetch-merge-put/toggle 回读真值);apps/api/tests/g299-new-routes.test.ts 4 例绿、门 8 死调用清零、基线 perFileCount 清表。**本票未翻勾的唯一理由=验收判据第一条未跑**:RN N8nModelScreen 真机走查(本机无设备)与 agent-teams 页真会话 200 取证(需起栈)——路由与契约已证,运行时成功路径待验,不得以单测冒充真机。 (原编号 G-316;持有行题面「门8清账后遗留的三枚"有消费方的待实装路由"」)
```

- 原 L8074(L1 外部持有行 L15701):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-10-08·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-453 **台账 F4(重复登记副本)对"同一待办的漂移副本"结构上失明 —— 现读一例:同一条 D41后续① 在 HEAD 有 9 份未勾选副本、其中 7 份正文互不相同(2026-09-28 量)**: `plan-tasks.mjs` 的 F1/F4 判据是"编号 + 标题前缀**逐字等值**",这既是它的优点(不做相似度猜判)也是它的洞 —— 并发 union 每次都留一份**带自己注记**的副本,前缀之后的正文一漂移,复合主键就不再相等,于是同一件事以 N 份"未勾选"长期并存。后果不是账面难看而是**派单被放大 N 倍**:本日两次 `plan-tasks-merge.mjs --heal --commit`(归并 30 行 / 34 行)把 F1/F4 都归到 0,而这一族一份都没被动到 ⇒ "跑过归并"不等于"这一族被覆盖"。出路只有两条且都不该由机器代裁:① 归并线逐组判"哪份是当前状态"(需要读注记语义,机器判不了);② 给登记侧加一条硬约束——同一件事要更新就**就地改那一条**(§1 第 2 条已有此规矩,缺的是让机器能在前缀一致而正文漂移时也点名)。本票**只登记现读证据与两条出路**,不改判据、不批量翻勾(批量翻勾 = 把别人的注记当噪声删,比原病更响)。归属:分叉合并归并线(同 G-363 那条持有)。 (编号改派留痕(2026-09-28):本行原取 G-417,与「全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红」一条撞成一号两事;取号发生在分叉的两条腿上,号段不共享。让位的是**本行**(它是我这一路登记的),别人的行不动;新号由取号令牌按当次 CAS 的 HEAD 现算,落地后须复核它不与任何行首编号重复。正文一字未动。) (编号改派留痕(2026-09-28):本行原取 G-417,与「全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红」一号两事。让位的是**本行**(它是我这一路登记的,别人的行一字未动)。新号是**手工取并逐面复核过的**(G/D/O 不相关,只看 G 族):台账行首集合 + 归档件全文 + 工作树副本三处均无 453 —— 因为取号令牌在改派场景下两次交回了"正在被让位的那个号"(它返回 G-417,而当时台账该族 max 已到 419/429),这个缺陷另立一票 G-454。正文一字未动。) (原编号 G-453;持有行题面「台账F4」)
```

- 原 L8076(L1 外部持有行 L15579):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-10-08·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-355 **MemberCard 把"没量到"显示成 0(第八轮对照逼出;归属:web 首页持有者;等 §17 运行时自验排期)** —— `apps/web/src/components/home/MemberCard.tsx:72-73` 现读 `stats?.points ?? 0` / `wallet?.balance ?? 0`,查询未回或失败时显示"0 分""0 余额"。上游同族口径是"订阅未知不能发布为成功空快照"(`packages/services/src/usage-stats/providers/bigmodelUsageQuotaProvider.ts:259` 原文)加展示层 `'--'` 占位。**为什么还开着**:属 UI 改动,§17 要求起 dev + 读 DOM 数值自验,本票未做该项;改法是 `number | null` + 占位,不动判据、无恒红风险。**这一条不是"抄上游功能",是把"未知"与"为零"分开** —— 后者是数据事故,前者是显示诚实。 (原编号 G-355;持有行题面「MemberCard把"没量到"显示成0」)
```

- 原 L8077(L1 外部持有行 L7603):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-10-08·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-356 **配置分层的"出处标签"与"请求档 vs 实得档"留痕(归属:cli/子代理线持有人;等产品拍板)** —— 上游 `packages/provider/src/resolver.ts:190/196/208` 三层 overlay 且每个生效对象带 `source` 标签、快照的 `sourceRevisions` 被真实消费;我方 `apps/cli/src/subagents/precedence.ts:195-205` 的四层短路链**没有出处标签**,且 `git grep -I "requestedEffort\|effectiveEffort\|validateModelSelection"` HEAD 面现读 **0 命中** ⇒ 静默降档无法归因。**为什么还开着**:新建"配置分层解析出口"属 §24 新增能力、且是跨端数据建模,不在本轮取证范围;上游那两格(`effective-model-selection.ts` 的 `selectionIssue` 六值枚举、`model-selection-config.ts:76-77`"不能静默补档位")是它的前置形状,可作参考实现但不是本轮交付物。 (原编号 G-356;持有行题面「配置分层的"出处标签"与"请求档vs实得档"留痕」)
```

- 原 L8079(L1 外部持有行 L7605):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-10-08·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-358 **锁的"租约认 token 不认 pid"一格只登记、未代裁(归属:`git-lock`/`deploy-lock` 持有人)** —— 上游 `packages/provider-node/src/zcode-builtin-remote-synchronizer.ts:85` 取 `leaseId=randomUUID`、`:143` 的 `#finishLease` 只在 leaseId 相等时才改控制文件,于是"pid 被系统复用"这一型**结构上不可能发生**;而我方是事后补的一环(`scripts/lib/proc-identity.mjs` 的 match/mismatch/unverifiable,承 G-193 那次冻结 11h50m)。**为什么还开着**:改两处锁的 meta 属锁持有人领地,且今天没有可复现的抢占现场做验收依据;真要收它,判据应是"注入一次 leaseId 不相等的迟到 finish 请求,控制文件必须不被改动",而不是"代码写了 leaseId"。 (原编号 G-358;持有行题面「锁的"租约认token不认pid"一格只登记」)
```

- 原 L8080(L1 外部持有行 L7606):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-10-08·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-359 **第八轮剩余六格候选清单(归属:未派;等各线排期;本轮只取证未实现,逐格带出处)** —— ① 跨层发布闸:上游 `registry-service.ts:205-212` 在"下层已变而上层仍基于旧事实"时**不发混合快照**、继续服务上一份完整 Registry,而我方这条纪律只活在门的散文里、运行时层无出口;② 稀疏 overlay 空即删:`config-service.ts:513-516` 与继承值等价的配置不落盘(absence=继承,不是"空覆盖");③ 诊断量代替原文:`officialMcpCredentials.ts:52-90/359-376` 只记 JWT 剩余秒数并按小时分桶去重,可接我方唯一脱敏出口 `packages/shared/src/utils/redact.ts`;④ 告警去重身份=桶+周期而非墙钟窗口:`startPlanQuotaReminderStore.ts:33-36` 用快照 `referenceTime` 裁决(设备时间可能已越过服务端周期)、`bucketReminderKey` 缺任一字段即不提醒;⑤ in-flight 合并 + CAS 驱逐:`zaiStartPlanBilling.ts:113-122` 失败响应同样保留 1s(防 429 后立刻重复请求)且驱逐前 `if (requests.get(k) !== request) return`(旧请求不得删新记录),上游该守卫三处同形,是我方共享工作区并发写可直接取用的最小实现;⑥ 幂等 key 复用规则:`codingPlanQuotaResetCoordinator.ts:307-329` 瞬时错复用原 key、成功或稳定错才置 null,且服务端 `next_try_at` 必须透传(:617-624)。**为什么还开着**:六格都是"能落但需各自定级与验收"的独立改动(①②碰运行时快照语义、③④⑤⑥碰告警与并发路径),打包成一票会互相遮蔽;派单时逐格取,勿一次全接。**另有一格需产品先定**:上游 `usage-quota.ts:71` 的 `percentage` 是**已用**占比、而 Start Plan 侧 `:1338` 同名字段是**剩余/总额**,现靠"两族走不同 reader"规避,**无类型或判据看守** —— 要不要收口成"以 remaining 为权威、percentage 仅降级",属契约决策。 (原编号 G-359;持有行题面「第八轮剩余六格候选清单」)
```

- 原 L8081(L1 外部持有行 L7607):

```
- [ ]〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7697(G-401) 同题,派单以持有行为准,本行不再单独派单。〕 （进行中@2026-10-05/g1-main）G-373 **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 〔拍板 2026-10-05(机主选"未知即按写处理"):MCP 工具默认档不再算 `read` —— 需批准、失败不自动重跑;确实只读者按"服务器 + 工具名"显式登记白名单并把白名单纳入跨语言对账。落点在 `apps/cli/src/tools/hub/mcp-adapter.ts` 与权限档两侧持有人;派单排在 G-710 那枚同目录代理之后,避免两个代理同改一个文件〕 〔拍板@2026-10-07 机主:两步走——①先给14枚无标注工具补显式dangerLevel(零行为变更);②MCP适配层缺省翻dangerous(要批准),对照上游clientHello事故与#94手机高危无弹窗信任缺陷;cli权限档持有人按此执行〕 〔拍板@2026-10-07 机主:两步走——①先给14枚无标注工具补显式dangerLevel(零行为变更);②MCP适配层缺省翻dangerous(要批准),对照上游clientHello事故与#94手机高危无弹窗信任缺陷;cli权限档持有人按此执行〕
```

- 原 L8089(L1 外部持有行 L11184):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-10-08·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）**D173 AI 对话链路四竞品对标 V4 收口线(19 条差距 / 5 个 Sprint)** —— 唯一入口 `docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`(87–105),本轮不在此复述差距正文,只登记排期与等待项。**S9 尺子先行(105→97)**:先落 `scripts/audit-benchmark-delivery.mjs`(V3 §八 自留建议至今未落地,`ls` 实测不存在)与 parity 门六端扩面,**顺序不可颠倒** —— #93/#94/#96 之所以能长期存在,正是因为 §9「多端连通」的机器判据只覆盖 web 一端(`check-agent-event-parity.mjs:537` 只扫 `apps/web/src`)。**S10 移动端可达性(93→94→95)**:RN 主屏 `apps/mobile-rn/src/screens/ChatScreen.tsx:652` 起只接 7/30 回调(逐名 `comm -23` 算出缺 23 个,含 `onToolCall`/`onToolApproval`/`onPlanUpdate`/`onTerminal*`/`onSubagent*`/`onUsage`/`onBudget`/`onQuestion`/`onFormRequest`/`onReconnect`),而同端 `AiAssistantN8nScreen.tsx:1412` 是完整实现、`src/utils/chat-render-model.ts` 的 4 个 `apply*` 在主屏零调用方 ⇒ 本票主体是**接线不是开发**;#94 是信任型缺陷(RN 与小程序 `tool-approval` 双零命中,手机上遇高危操作无弹窗)。**S11 保真(87→88→89→92)**、**S12 契约地基(99→100→101→102)**、**S13 传输计量收口(96→90→91→103→98)**。**等待项(归属:等用户拍板)**:#100 内置默认高危集**改变默认行为**(现 `_high_risk_tools_from_env` 未配 env 即 `frozenset()`,`agent_loop_v2.py:288-296`),按 §24 不得由实现票自行开工;#98 桌面端薄壳是 V3 #72 已拍板架构,本票**只对齐三处口径**(tauri.conf / `ensure-web-out.mjs` 自称唯一校验点 / `docs/MULTI_END.md §2.5`),不改选型。**解阻前置(可判)**:S10 之前必须先有 S9 的端能力档案表,否则清完的端下轮又漏。**本轮同时否证 7 条断言,均写进 V4 正文,不得照旧文派单**:①②③ 上述三条 V3 过期结论;④ `packages/app` 的 `ChatScreen` 并非「未导出」—— `src/index.ts:684` 导出在位,真问题是**全仓零消费方**(同包其它 4 个聊天屏都被 mobile-rn 复用)⇒ 归 #95;⑤ web **有**消息队列与 Steer(`queue-interaction-bar.tsx` 在库,D38 已✅)⇒ 队列**不是**差距,初稿列错了;⑥ #89 初稿「主聊天流无自动重连」**否证** —— api-client `client.ts:2078/2129/3443` 有重连与 `Last-Event-ID` 续传,web `send-message.ts:767-775` 已消费 `onReconnect`,缺陷窄化为「`connection-status.tsx` 四态件生产面零挂载(命中全在 `apps/web/tests/agent-task-progress-pane.test.tsx`) + 重连后待决审批恢复未取证」;#96 那句「web 反而没有续传」同批否证;⑦ 孤儿清单里的 `voice-note.tsx` 在 HEAD 与索引双双落空,只在工作树未跟踪面 ⇒ 摘出清单、按 §12 归属未定不动。**本轮交付**:V4 文档成文并注水印(`docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`,`watermark.mjs verify` 覆盖 1/1、残迹 0、损坏 0);六端回调覆盖数改用统一交集判据重算(web 全域 30/30、extension 19、cli 12、RN 主屏 7、RN 另一屏 17、miniapp 17),并登记「事件名口径 23 与回调名口径 17 不可混用」。**待办本体是 S9–S13 的实施,本行不因文档成文而翻勾。****本轮同时更正 3 条 V3 过期结论,不得照它们派单**:#73「小程序无 AI 对话页」已被代码推翻(`apps/miniapp-taro/src/pkg-ai/ai/chat.tsx` 1623 行,最新提交 `3f3e71a99` 09-27,按事件名覆盖 23/30);#51「`run_in_background` 只有 sleep/echo」已不成立(`task_executors.py` 现读 16 个 `async def` + import 期三面断言);#47「三套执行内核」应为「一套半」(`class AgentLoopV2` 唯一内核,但 `agent_loop.py` 仍以 `agent_executor` 被 `routers/agents.py:48`、`services/a2a_service.py:33`、`services/slash_commands.py:162` 三处生产引用)。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `DD128`(族名在编号段出现两次;而第一次修正产出的 `D-172` **带连接符、不属于台账编号族** —— 唯一真相源 `check-plan-line-loss.mjs` 的 `TASK_ID_PATTERN` 里 D 族写作 `Dd+`(只有 G 族带 `-`),带横杠的号对防丢面与复合主键**双双隐身**,比畸形号更糟:它看起来像有号。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 D-128 已被 8 行认领(L7174,7551,7721,7927…),改回就等于替这本账再加一枚撞号;现号 `D173`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。 (原编号 D173;持有行题面「AI对话链路四竞品对标V4收口线」)
```

- 原 L8158(L1 外部持有行 L11430):

```
- [ ] page_* 动词的**跨端登记**未做:web / miniapp-taro / RN / desktop / api 侧 `agent_action` 枚举与 〔【归并】重复登记副本(2026-10-11 本席量):本行正文到「枚举与」即断、没有任何交代,却进得了 `--open --dispatchable`,下一个接手的人拿到半句话。同主键另有带完整复测结论的登记(检索式 `git show HEAD:PROJECT_PLAN.md | grep -n "page_\* 动词"`),其结论是"这一格等的是 page_* 会不会经共享事件流落到小程序/RN/desktop 屏上"的产品与该端持有者裁决,不是 agent 能代定的。按 §1 的 F4 口径**只加指针、不动勾选**,也不摘任何声明位编号。〕
```

- 原 L8163(L1 外部持有行 L15653):

```
- [ ]〔【归并】重复登记副本(2026-10-13):本行是同批租约标记产生的无号残影,本体=「G-1080903 服务「运行时代码新鲜度」」行(2026-10-13 已翻勾),派单以本体为准,本行不再单独派单。〕
```

- 原 L8946(L1 外部持有行 L10752):

```
- [ ] **D181 电脑使用画中画(5 行,对标 `chatSession.pictureInPicture.*`;实现形态需拍板)** —— 竞品串:`sectionLabel`"电脑使用画中画"/`title`"画中画"/`hideInSession`"在此会话中隐藏画中画"/`hideInAllSessions`/`updateFailed`。零命中探针:「画中画」0;`aiChat.floatMode`(PictureInPicture2 图标,ai-side-panel.tsx:1424)=AI 面板页内浮窗,非 computer-use 会话小窗,邻位不背书。拍板结论(2026-09-30 用户拍板):暂缓+登记依赖 —— computer_use.py 是 agent 浏览器自动化工具后端(开页/快照/步进),尚无"可观看会话";先做 PiP 外壳等于空壳。依赖:computer-use 会话可视化(快照流/回放已有 browser_replay/browser_trace 雏形),随其产品化一起立项;浏览器内形态可用 Document Picture-in-Picture API。 〔【归并】重复登记副本(2026-10-10):同主键的另一条登记 「D181 · 电脑使用画中画」,派单以那条为准,本行不再单独派单。〕
```

- 原 L9013(L1 外部持有行 L15745):

```
- [ ]〔【归并】重复登记副本(2026-09-28):本行行首那个号是**并发取号撞来的号** —— 两条分支各自在自己那侧的当下 HEAD 取过号、都没撞,合到同一份账面才第一次相遇;本行不是新任务,是同一件事的第二份登记。同题登记的持有行是「ihui-auth-user 里存了」那一条待办(编号 G-362;按标题前缀寻行,既不写行号也不依赖行序);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。〕 **`ihui-auth-user` 里存了 `isAuthenticated`:登录态的第二份真相** —— 权威推导应是「有没有 token」(共享工厂 `createAuthStore` 就是这么算的),两份真值的失效形态是「token 已清而 isAuthenticated 仍 true」⇒ UI 认为已登录、请求全 401。出口:该 key 只存 user 资料,`isAuthenticated` 一律派生;读到旧形状要兼容一个版本再删,不得当场判用户"没登录"。
```

- 原 L9014(L1 外部持有行 L15745):

```
- [ ] **`ihui-auth-user` 里存了 `isAuthenticated`:登录态的第二份真相** —— 权威推导应是「有没有 token」(共享工厂 `createAuthStore` 就是这么算的),两份真值的失效形态是「token 已清而 isAuthenticated 仍 true」⇒ UI 认为已登录、请求全 401。出口:该 key 只存 user 资料,`isAuthenticated` 一律派生;读到旧形状要兼容一个版本再删,不得当场判用户"没登录"。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9015(L1 外部持有行 L15745):

```
- [ ] **`ihui-auth-user` 里存了 `isAuthenticated`:登录态的第二份真相** —— 权威推导应是「有没有 token」(共享工厂 `createAuthStore` 就是这么算的),两份真值的失效形态是「token 已清而 isAuthenticated 仍 true」⇒ UI 认为已登录、请求全 401。出口:该 key 只存 user 资料,`isAuthenticated` 一律派生;读到旧形状要兼容一个版本再删,不得当场判用户"没登录"。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9456(L1 外部持有行 L15746):

```
- [ ] **存量漂移一条(另票,本票未代改)**:`packages/types/src/hooks.ts` 的 `HookNotifyChannel`(3 值)与 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9457(L1 外部持有行 L15746):

```
- [ ] **存量漂移一条(另票,本票未代改)**:`packages/types/src/hooks.ts` 的 `HookNotifyChannel`(3 值)与 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9470(L1 外部持有行 L11136):

```
- [ ] 59. 消息级版本切换 ← 1/3 →(regenerate 改为新增 sibling 而非物理删除;共用 `CanvasVersionMenu` 交互) 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「59 · 消息级版本切换←1/3→」,派单以那条为准,本行不再单独派单。〕
```

- 原 L9474(L1 外部持有行 L15722):

```
- [ ]O594 票⑰ —— **`2f-ext` 升 blocking 已量好前置,按用户指令暂缓落地**(注册文件 `scripts/guardian-runner.mjs` 本轮不得改)。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「O81 · 票⑰——2f-ext升blocking已量好前置」,派单以那条为准,本行不再单独派单。〕〔让号记录(2026-10-09 F9 清偿批⑤承接):同题同批承让到 O594(持行由取号令牌现算,见该行让号记录;机主拍板 2026-10-09 代码引证优先,O81 留归「跨端 UI 单一源」工作线),本行正文除编号位与本记录外逐字未动。〕
```

- 原 L9479(L1 外部持有行 L15859):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L6964(G-208) 同题,派单以持有行为准,本行不再单独派单。〕 **G-1018284. 生产备份链日志的写入侧编码要改成 UTF-8(2026-09-28 逐行 strict-UTF-8 现读登记)**:`D:\DevEnv\logs\pg-backup-scheduler.log` 自 **L571(2026-09-09 00:58:12,字节偏移 25,709)起由 UTF-8 切成 GBK 并持续至今**(前 570 行 520 行中文正常 / 之后 360 行非 UTF-8,0 个 `U+FFFD` ⇒ GBK 侧可无损还原)。**同批纠一处台账失实**:`scripts/alert-volume-report.mjs` 头注把"GBK/UTF-8 混合"记在 `deploy-loop.log` 头上,而该文件实测**整档是合法 UTF-8** —— 坏的是 09-24→09-28 那段已烘死的 475,314 个 `U+FFFD`(行 120,624–257,864,子进程管道阶段就把非 ASCII 字节换成替换字符,**原字节不可回收**);该处文案已按现读改写(规矩"只用 ASCII 判据"一字未动,改的是它给的错误机理 —— 按旧文案下一个人会去修解码器,而解码器没有坏)。**为什么现在不当场做(等环境条件,不是等人拍板)**:改法是 `deploy/win/ihui-pg-backup.ps1` 顶部加一条进程级`[Console]::OutputEncoding = UTF8` 并同笔把 `deploy/prod-bundle/` 那两份运行副本改成逐字节等值(由 prod-bundle 影子对账门判等),调度器每轮用 `&` 从磁盘重读子脚本 ⇒ 不必重启服务、下一轮 03:00 起生效;但它落在**生产备份链实际执行的那份文件**上,而"改转发壳后重启曾让 `pg_dump` 挂 3.5 分钟"那次至今没解释清(本轮另测近 5 轮各 8–15 秒,挂起不可复现)——在解释清之前不动生产备份,这条规矩自 2026-09-24 起就写在案。**归属**:生产备份链持有人。**验收判据(必须"改完且跑过")**:新增行的 strict-UTF-8 解码 non-UTF-8 计数 = 0;历史 GBK 段不做改写(对已入库运行态日志做转换属另一类动作)。**顺带一格(不单独开票)**:`IHUI-DEPLOYLOOP` 的守护半在 09-26 11:09 起就驻留旧脚本,其 catch 支管道仍按旧编码写,全档该支触发 0 次 ⇒ 零观测损伤,并入既有低峰重启窗口即可。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-385 · 生产备份链日志的写入侧编码要改成UTF-8」,派单以那条为准,本行不再单独派单。〕 〔让号记录(2026-10-02 F9 清偿批②):原号 G-385 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕
```

- 原 L9481(L1 外部持有行 L15758):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L9959(G-417) 同题,派单以持有行为准,本行不再单独派单。〕 G-1018290 **全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红,登记以免被"修好我看见的那三道"再掩一次** —— ① 守门 [12] 交付报告一致性判 `PROJECT_PLAN.md` 自身违规 1 处:同一份账面里既写着"完整收尾/无后续建议"一类断言,又留着"后续工作/优化项"清单(AGENTS §10 那条互斥约束)。它在全量档是 warn、不挡提交,但它是**批量审计恒红清单**里的一项,留着就会有人天天来问"这红谁的"。出路只有两条且不得放宽判据:要么把该份报告改成"任务 X 已完成、还有 N 项后续"(推荐,因为活账确实还有),要么真把后续条目清干净再声明闭环。归该份批次报告的作者;现读定位:`node scripts/check-delivery-report-consistency.mjs`。② 同日实测的并发副作用登记:多会话同时提交时(本轮实测单窗口 27–47 枚),守门 [30a] 会把**别人重写提交留下的悬空对象**算在本次提交头上、[84] 会把**别人挂在共享索引里的暂存删除**报成待判 —— 两者本轮都已按仓里规定动作处置(悬空提交 `cf05a98386` 已 `git tag lost-commit/cf05a983` 备份并复跑 30a rc=0,其内容经祖先判据确认**已在主线**,零丢失;[84] 复跑 rc=0 并把那条暂存删除点名交回其持有人)。**留这一格是因为它没有判据**:目前没有任何一道门区分"本次引入的悬空"与"并发重写留下的同内容副本",而这型一旦攒多了就是 §22 那类丢 commit 事故的温床。③ 同轮只读量测的第三格(本机**此刻不成立**,故不是待修而是待防):六把常驻命令行工具在"调用方 cwd 不在仓库内"时仍都能解析到仓库(本机 `.git` 是指针文件,git 会向上找),所以依赖 cwd 的那一处今天没有实害;但 `scripts/union-converge.mjs` 与 `scripts/git-push-converge.mjs` **写死** `C:/Program Files/Git/cmd/git.exe`,而仓里已有唯一出口 `scripts/lib/gitdir.mjs`(§5b 明写"脚本一律不得依赖环境取 git"),另一台机(G 盘那份 checkout)实测 git 落点不同 ⇒ 换机即 ENOENT。`git-push-converge.mjs` 同时是唯一不按自身位置推根的一把(换个目录跑结论会变)。**取证教训一条,写给下一个想顺手"修"的人**:我第一轮把这些工具的失败猜成"模块顶层数组引用后声明常量 ⇒ TDZ",现读**否证**(那三处在函数体内求值),真因是我自己的探针把 msys 风格路径拼成了不存在的目录 —— 0 命中/含糊错先怀疑尺子,再怀疑世界,别照假设改生产工具。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-417 · 全量守门盘点」,派单以那条为准,本行不再单独派单。〕 〔让号记录(2026-10-02 F9 清偿批②):原号 G-417 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕
```

- 原 L9485(L1 外部持有行 L15701):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11128(G-453) 同题,派单以持有行为准,本行不再单独派单。〕 G-210 **台账 F4(重复登记副本)对"同一待办的漂移副本"结构上失明 —— 现读一例:同一条 D41后续① 在 HEAD 有 9 份未勾选副本、其中 7 份正文互不相同(2026-09-28 量)**: `plan-tasks.mjs` 的 F1/F4 判据是"编号 + 标题前缀**逐字等值**",这既是它的优点(不做相似度猜判)也是它的洞 —— 并发 union 每次都留一份**带自己注记**的副本,前缀之后的正文一漂移,复合主键就不再相等,于是同一件事以 N 份"未勾选"长期并存。后果不是账面难看而是**派单被放大 N 倍**:本日两次 `plan-tasks-merge.mjs --heal --commit`(归并 30 行 / 34 行)把 F1/F4 都归到 0,而这一族一份都没被动到 ⇒ "跑过归并"不等于"这一族被覆盖"。出路只有两条且都不该由机器代裁:① 归并线逐组判"哪份是当前状态"(需要读注记语义,机器判不了);② 给登记侧加一条硬约束——同一件事要更新就**就地改那一条**(§1 第 2 条已有此规矩,缺的是让机器能在前缀一致而正文漂移时也点名)。本票**只登记现读证据与两条出路**,不改判据、不批量翻勾(批量翻勾 = 把别人的注记当噪声删,比原病更响)。归属:分叉合并归并线(同 G-363 那条持有)。 (编号改派留痕(2026-09-28):本行原取 G-417,与「全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红」一条撞成一号两事;取号发生在分叉的两条腿上,号段不共享。让位的是**本行**(它是我这一路登记的),别人的行不动;新号由取号令牌按当次 CAS 的 HEAD 现算,落地后须复核它不与任何行首编号重复。正文一字未动。) 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-417 · 台账F4」,派单以那条为准,本行不再单独派单。〕〔让号记录(2026-10-09 F9 清偿批⑤承接):同题同批承让到 G-210(持行由取号令牌现算,见该行让号记录;机主拍板 2026-10-09 代码引证优先,原号 G-417 留归「全量守门盘点」侧),本行正文除编号位与本记录外逐字未动。〕
```

- 原 L9486(L1 外部持有行 L7582):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7672(G-470) 同题,派单以持有行为准,本行不再单独派单。〕 G-1018295. **共享索引被整批清空后,"他人已暂存的删除"会失去保护标记,并被工作区存续自愈当成外部删除恢复**(归属:安全提交器 + 存续自愈两处持有人;等环境条件 = 需先定"意图删除"与"宿主误删"在恢复前用什么区分,不是等人拍板措辞):实测链(2026-09-28 09:13–09:17,本机=生产,多会话并发) —— 另一会话把 `apps/ai-service/tests/test_tool_approval_grant_lifetime.py` 以 `D ` 形态暂存(该文件是它当天新建、已入库的测试,`git status` 显示索引里有暂存删除);我用 §12 强制的 `node scripts/safe-commit.mjs` 提交自己的 2 个文件,其 Step ① 是 `git reset HEAD` **清空整个暂存区**(该设计的目的正是别把别人的在途内容打包进我的提交),效果是那枚暂存删除的保护标记一起没了;2 分钟后 `git-guardian` 的存续自愈判定"工作树缺该文件 ∧ 索引 blob == HEAD blob ∧ HEAD 里有它"三条成立 ⇒ 恢复磁盘副本,日志原文:`✅ 工作区存续自愈:恢复 1 个被外部删除的跟踪文件(apps/ai-service/tests/test_tool_approval_grant_lifetime.py)`。**净结果这次是好的**:恢复内容与 HEAD 逐字节同值(零独有数据、零伪造),且该测试实跑 `5 passed`(RC=0,证据 `.ihui-agent/tmp/ff-race/pytest-grant.ev`)—— 也就是说被"恢复"的是一件确实该存在的东西,而它此前那次暂存删除更像宿主清理层命中 `tests/` 整目录(AGENTS §5b 记过该型)而非有意移除。**但机制本身是反的**:存续自愈的设计前提恰恰是"他人已暂存的删除只报数、不代裁",而一次**与它无关**的第三方提交就能替那个删除摘掉标记 —— 若那枚暂存删除是有意的(例如某票按 §7 迁移测试文件),本机会话的每次提交都会把它复活,而两边账面都绿:提交方只看到"我的 2 个文件",自愈方只看到"外部删除 + 零独有数据"。**要谁做什么**:① `safe-commit.mjs` 在 `git reset HEAD` 之前把 `git diff --cached --name-status` 的现状留底,复位后**逐路径恢复 D 标记**(或至少在输出里点名"本次清空了他人的 N 项暂存删除"),让归属会话能看见而不是事后发现;② 存续自愈恢复前问一句"该路径最近是否出现过 ` D`/`D ` 形态"(reflog/索引事件),分不清就只报数。**不在本票范围**:改动别人那枚删除本身(既不支持也不阻止),以及 §7 对"删除 git 对象前先答三问"的既有纪律。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-461 · 共享索引被整批清空后」,派单以那条为准,本行不再单独派单。〕 〔让号记录(2026-10-02 F9 清偿批②):原号 G-461 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕
```

- 原 L9507(L1 外部持有行 L11184):

```
- [ ] **D173 AI 对话链路四竞品对标 V4 收口线(19 条差距 / 5 个 Sprint)** —— 唯一入口 `docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`(87–105),本轮不在此复述差距正文,只登记排期与等待项。**S9 尺子先行(105→97)**:先落 `scripts/audit-benchmark-delivery.mjs`(V3 §八 自留建议至今未落地,`ls` 实测不存在)与 parity 门六端扩面,**顺序不可颠倒** —— #93/#94/#96 之所以能长期存在,正是因为 §9「多端连通」的机器判据只覆盖 web 一端(`check-agent-event-parity.mjs:537` 只扫 `apps/web/src`)。**S10 移动端可达性(93→94→95)**:RN 主屏 `apps/mobile-rn/src/screens/ChatScreen.tsx:652` 起只接 7/30 回调(逐名 `comm -23` 算出缺 23 个,含 `onToolCall`/`onToolApproval`/`onPlanUpdate`/`onTerminal*`/`onSubagent*`/`onUsage`/`onBudget`/`onQuestion`/`onFormRequest`/`onReconnect`),而同端 `AiAssistantN8nScreen.tsx:1412` 是完整实现、`src/utils/chat-render-model.ts` 的 4 个 `apply*` 在主屏零调用方 ⇒ 本票主体是**接线不是开发**;#94 是信任型缺陷(RN 与小程序 `tool-approval` 双零命中,手机上遇高危操作无弹窗)。**S11 保真(87→88→89→92)**、**S12 契约地基(99→100→101→102)**、**S13 传输计量收口(96→90→91→103→98)**。**等待项(归属:等用户拍板)**:#100 内置默认高危集**改变默认行为**(现 `_high_risk_tools_from_env` 未配 env 即 `frozenset()`,`agent_loop_v2.py:288-296`),按 §24 不得由实现票自行开工;#98 桌面端薄壳是 V3 #72 已拍板架构,本票**只对齐三处口径**(tauri.conf / `ensure-web-out.mjs` 自称唯一校验点 / `docs/MULTI_END.md §2.5`),不改选型。**解阻前置(可判)**:S10 之前必须先有 S9 的端能力档案表,否则清完的端下轮又漏。**本轮同时否证 7 条断言,均写进 V4 正文,不得照旧文派单**:①②③ 上述三条 V3 过期结论;④ `packages/app` 的 `ChatScreen` 并非「未导出」—— `src/index.ts:684` 导出在位,真问题是**全仓零消费方**(同包其它 4 个聊天屏都被 mobile-rn 复用)⇒ 归 #95;⑤ web **有**消息队列与 Steer(`queue-interaction-bar.tsx` 在库,D38 已✅)⇒ 队列**不是**差距,初稿列错了;⑥ #89 初稿「主聊天流无自动重连」**否证** —— api-client `client.ts:2078/2129/3443` 有重连与 `Last-Event-ID` 续传,web `send-message.ts:767-775` 已消费 `onReconnect`,缺陷窄化为「`connection-status.tsx` 四态件生产面零挂载(命中全在 `apps/web/tests/agent-task-progress-pane.test.tsx`) + 重连后待决审批恢复未取证」;#96 那句「web 反而没有续传」同批否证;⑦ 孤儿清单里的 `voice-note.tsx` 在 HEAD 与索引双双落空,只在工作树未跟踪面 ⇒ 摘出清单、按 §12 归属未定不动。**本轮交付**:V4 文档成文并注水印(`docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`,`watermark.mjs verify` 覆盖 1/1、残迹 0、损坏 0);六端回调覆盖数改用统一交集判据重算(web 全域 30/30、extension 19、cli 12、RN 主屏 7、RN 另一屏 17、miniapp 17),并登记「事件名口径 23 与回调名口径 17 不可混用」。**待办本体是 S9–S13 的实施,本行不因文档成文而翻勾。****本轮同时更正 3 条 V3 过期结论,不得照它们派单**:#73「小程序无 AI 对话页」已被代码推翻(`apps/miniapp-taro/src/pkg-ai/ai/chat.tsx` 1623 行,最新提交 `3f3e71a99` 09-27,按事件名覆盖 23/30);#51「`run_in_background` 只有 sleep/echo」已不成立(`task_executors.py` 现读 16 个 `async def` + import 期三面断言);#47「三套执行内核」应为「一套半」(`class AgentLoopV2` 唯一内核,但 `agent_loop.py` 仍以 `agent_executor` 被 `routers/agents.py:48`、`services/a2a_service.py:33`、`services/slash_commands.py:162` 三处生产引用)。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `DD128`(族名在编号段出现两次;而第一次修正产出的 `D-172` **带连接符、不属于台账编号族** —— 唯一真相源 `check-plan-line-loss.mjs` 的 `TASK_ID_PATTERN` 里 D 族写作 `Dd+`(只有 G 族带 `-`),带横杠的号对防丢面与复合主键**双双隐身**,比畸形号更糟:它看起来像有号。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 D-128 已被 8 行认领(L7174,7551,7721,7927…),改回就等于替这本账再加一枚撞号;现号 `D173`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「D173 · AI对话链路四竞品对标V4收口线」,派单以那条为准,本行不再单独派单。〕
```

- 原 L9553(L1 外部持有行 L15745):

```
- [ ] **`ihui-auth-user` 里存了 `isAuthenticated`:登录态的第二份真相** —— 权威推导应是「有没有 token」(共享工厂 `createAuthStore` 就是这么算的),两份真值的失效形态是「token 已清而 isAuthenticated 仍 true」⇒ UI 认为已登录、请求全 401。出口:该 key 只存 user 资料,`isAuthenticated` 一律派生;读到旧形状要兼容一个版本再删,不得当场判用户"没登录"。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9554(L1 外部持有行 L15746):

```
- [ ] **存量漂移一条(另票,本票未代改)**:`packages/types/src/hooks.ts` 的 `HookNotifyChannel`(3 值)与 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9557(L1 外部持有行 L7607):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7697(G-401) 同题,派单以持有行为准,本行不再单独派单。〕 **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔拍板 2026-10-05(机主选"未知即按写处理"):MCP 工具默认档不再算 `read` —— 需批准、失败不自动重跑;确实只读者按"服务器 + 工具名"显式登记白名单并把白名单纳入跨语言对账。落点在 `apps/cli/src/tools/hub/mcp-adapter.ts` 与权限档两侧持有人;派单排在 G-710 那枚同目录代理之后,避免两个代理同改一个文件〕
```

- 原 L9558(L1 外部持有行 L7608):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7698(G-402) 同题,派单以持有行为准,本行不再单独派单。〕 **设置项"显式清空"与"从未设置"无差，且读侧同一含义两键相反（需拍板；归属：api 设置面 + web 设置页持有人）** —— 已亲自复验：`apps/api/src/routes/user/settings-routes.ts:55` 写体是 `z.record(z.string(), z.unknown())`，落库处 `value === null || value === undefined ? null : String(value)` ⇒ `null` 与"缺席"存成同一个 NULL 行；读侧 `apps/web/app/(main)/settings/notifications/page.tsx:48-52` 四键混用 `!== 'false'`（默认真）与 `=== 'true'`（默认假），于是**同一个被清空的值，在前一族读回 true、在后一族读回 false**。上游同族做法是把三态写进契约（`settings/pluginConfigPatch.ts:29-36`：`undefined`=未触碰跳过、`null`=进 `clearOptionKeys`、sensitive 空串=不改已有值；落库侧 `file-config.adapter.ts:557-565` 按 option key 合并而非整对象替换，防同 scope 密钥被静默清空）。**为什么还开着**：改成三态要动 PUT 语义（单键 DELETE 出口我方根本没有——`deleteUserPreference` 只服务 devices），属对外契约决策；先拍"要不要有删键出口"，再谈读侧归一。**不得**靠"读侧统一成 `=== 'true'`"消红——那会把默认真的四项静默翻转。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9559(L1 外部持有行 L15687):

```
- [ ] **双重执行**(两次 LLM、两遍工具副作用),比占位错误更坏;改成消费返回值必须与把手面登记同枚提交,而那三个文件此刻由他人持有。补丁形态已写在代理交付报告里(`handoff = await take_loop_v2_handoff(…); if handoff is not None: return AgentStepResult(**handoff.step_result); guard_loop_v2_pilot(…)`),**归属:ai-service 编排线持有人**。**同轮量到的一条既有事实(接线那票必须一并拍板)**:`AgentLoopV2.run()` 在 completed/error/max_iterations 后**无条件** fire-and-forget `meta_learner.evaluate_and_record`,它用**真实 `llm_gateway`** 再发一趟 LLM 并经 `KeyPoolSelector → get_shared_pool` 触生产 PG,同一份代码两次跑出 0 次与 3 次连接池触碰(实测非确定性);收敛档一旦真接上,**每次编排都会多一次计费 LLM 调用 + 一次落库**。本票测试里显式掐掉它并留了活的连接池哨兵。另:`progress_callback` 在新链路是循环结束后按真实顺序回灌、不是实时(旧路径跑一步发一次),没拿它冒充实时。 (原行首编号在此留原文) 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9560(L1 外部持有行 L8054):

```
- [ ] **上述②的两格"审面根因"分别是独立一票,现各写清归属与解阻前置**:① **守门 57 的清单计数只看台账、不看归档件**(它 `checkBaseline` 的 `entryCount` 有一部分来自台账里 `data.planSource.taskLinePattern` 匹配的 D 族行)⇒ 正解是把审面改成"台账 ⊕ 同面归档件"(`git ls-tree HEAD` / 索引列目录,照**门 71 的归档豁免**与**门 13c 的 A2/A3 同面取材**那两个先例抄,不得 `readdirSync`),基线一律不动;本票已派子代理做,落地判据 = 私有索引端到端两臂(台账摘掉而归档件同字在 ⇒ rc=0;两侧都摘 ⇒ rc=1 并点名)。② **取号只看台账面的 max**(`lib/plan-task-index.mjs` 的 `usedIdsOfPrefix` 只看被审的 `PROJECT_PLAN.md`)⇒ 归档后同一个号会被再发一次,这是①的同族、量纲不同(号段单调性 vs 计数存续)。它**此刻被他人持有**(`scripts/lib/plan-task-index.mjs` 与 `scripts/plan-tasks.mjs` 工作树各有在飞改动,本会话按 §12 边界未动),**解阻前置**=那两文件的在飞改动入库后,由同一持有人把 `usedIdsOfPrefix` 扩成"台账 ⊕ 归档件"或给 `live-doc-edit` 的令牌加一道"号已在归档面出现过 ⇒ 继续往上取"的复核;不得由旁路会话按 pathspec 交工作树版本(那会把别人的在飞改动整批写回旧态)。〔编号改派留痕(2026-09-28):原 G-362「桌面端「启动后先进托盘」在真机采样里出现过一次」 与另一条先入的登记撞成一号两事,按"后来者改号"由 live-doc-edit 的取号令牌在每次 CAS 里按当下 HEAD 现算;正文一字未动。〕 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9561(L1 外部持有行 L8055):

```
- [ ] **守门 150(角色档合规)在 HEAD 面判红 471 族,而它是 blocking:定级与存量锚点未对齐** —— 现读 `node scripts/check-radius-role-conformance.mjs` 末行「判红 471 族 / 已判合规 2215 / 弱证据待裁 93 / 未判定 1」。它挂 `apps/ + packages/`,意味着任何一次提交都要先清偿这 471 族,否则唯一出路是各会话跳钩子、连带其余全部守门作废(§12e 那一型)。归属该门持有者,两条正当出口:① 把这 471 族按"首锚 + 只拦新增"落进它自己的 `anchorRegression` 台账;② 或降 warn + `--strict` 问责。**禁止**为让报告变绿去放宽类别判据或把 card 一律改成 lg —— 弱证据实测判错率 20–70%,批量改档等于重新设计。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9563(L1 外部持有行 L15689):

```
- [ ] **A1 改道校验只比大小不比内容（可立即修；归属：§26 C 盘改道线，本票持有人即我）** —— 见上文 A1 与现读落点。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9567(L1 外部持有行 L7930):

```
- [ ] **归属:守门 116 持有者(本票不认领、不抬基线)** —— 层的"常量绑裸 git"棘轮从基线 10 涨到实测 11,红是棘轮自己报的,复现:`node --test scripts/tests/face-reader.test.mjs`(实测 26 例 ⇒ 24 绿 / 本条红 / 另一枚红是 O76 新加的第四型尺子,它扫 HEAD,随 O76 落地即绿)。第 11 个是 `scripts/check-egress-facts.mjs`(`05ffe25825a` 15:39 入库,基线是在 `66e5edaf8b7` 12:29 定到 10 的,逐个文件的"加入时间"已比对过:12:29 之后新增的裸 git 绑定只有这一枚)。**为什么我不替别人抬基线**:把 10 改成 11 等于替他人的一次回归平账,而这条尺子的存在理由正是"新增者请改用层的 `gitRaw`"。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9568(L1 外部持有行 L7931):

```
- [ ] 待用户补:apps/*/.env ~35 键(WECHAT_APP_ID/SECRET、SMTP/RESEND/腾讯 SES、DINGTALK、GitHub Token 等),骨架已就位;丢失键全清单已梳理到 `tmp/env keys todo.md`(79 空键 / api 36 + web 15 + ai-service 28,按 ★优先级 + 配置渠道 + 目标文件组织) 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9569(L1 外部持有行 L7932):

```
- [ ] **`git fsck` 恒报 166216 条 broken link/missing，而同一 sha 直查存在 —— 本机对象图状态存疑**。实测三组互斥证据(2026-09-24 04:2x-04:3x，均在 `G:\IHUI-AI` 本机): 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9570(L1 外部持有行 L3971):

```
- [ ] **`VideoPlayerScreen` 全屏纯黑 ⇒ 黑页上方横一条 34dp 浅灰带**。这条带由 `App.tsx` 根 View 的 `backgroundColor: tokens.surface.bg` 绘制;屏幕内容在屏幕顶边被裁剪(真机量得带内 y=8..60 = (245,245,245),而把黑底用 `marginTop:-34` 上推后黑色只出现在 y=68 以下)。**即端内任何写法都够不到这条带** —— 完整取证与已回退的尝试见同日登记「实测钉死一条边界:单屏无法把底色铺进状态栏带」。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9571(L1 外部持有行 L15731):

```
- [ ] **`stream-tool-ledger` 未入库**:模块与单测已绿(`apps/cli/src/stream-tool-ledger.ts`), 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9573(L1 外部持有行 L7936):

```
- [ ] **`stream-tool-ledger` 接线(唯一真正剩下的技术活)——归属是他人、非本批可 finish**: 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9574(L1 外部持有行 L15732):

```
- [ ] P1 **`check-auth-refresh-singleton`(hook 批外步骤)按磁盘遍历客户端源码,一个未跟踪的构建副本就让全队每次提交被迫跳门(2026-09-26 实测)**:它 `readdirSync` 走文件系统(第 47 行),于是并发会话留在 `apps/miniapp-taro/.tmp-twq-fix/` 的**未跟踪**旧构建产物(5.4 MB,`common.js` 里含裸 `refreshAccessToken`)被判成违规;而它跑在守门批**之外**,161 道门全绿也照样 exit 1 —— 实测连续两枚提交因此走 `--no-verify`(归因层量到"红在批外"),一次跳门等于该枚提交上全部守门作废(§12e 同型)。当场处置是把副本**移出**到 `.ihui-agent/tmp/quarantine-2026-09-26/`(未删除,可回读),该步现 exit 0。**根因未修**:判据应判仓库内容而非共享工作树快照(门 57 已确立该口径),且改它必须同笔迁到 `scripts/lib/face-reader.mjs` 的 `catBatch`(门 118 对"本次改动动过的门"按取材面判,仍按磁盘读会被判半接线红)。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9576(L1 外部持有行 L15663):

```
- [ ] P1 **CI 装不上而门 101 报绿：锁只记「条目在不在」，不看它落在哪个依赖段**（2026-09-26 实测，9d1aa0baa3 现读）—— pnpm install --frozen-lockfile 在 packages/api-client 直接拒装：HEAD 的清单里该包 **dependencies 为空**、@ihui/types 在 devDependencies（现读 dependencies = (无) / devDependencies = @ihui/eslint-config, @ihui/types, @tarojs/taro, typescript, rimraf, vitest），而 pnpm-lock.yaml 仍把它记在 importers["packages/api-client"].dependencies 段 ⇒ pnpm 比对「同一字段」不通过。**CI 每个 job 的第一步都是这条 install**，所以红的是 Install dependencies（实测 Knip job 的失败步名就是它，不是棘轮本身），连带 CI / CI (Monorepo) / Smoke New Modules / e2e / Build Docker / Real DB 一整套红成一片；而本地 node scripts/check-lock-manifest-consistency.mjs **exit 0**（26 包 / 514 条声明 / 违规 0）。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9577(L1 外部持有行 L7949):

```
- [ ] **守门 94(errorCode 覆盖率)现在是真红,但红不在内容里,补目录行会制造孤儿条目(2026-09-26 20:5x 实测,归 `llm.py` 持有者)**:HEAD 面 `node scripts/check-error-code-coverage.mjs` exit 1,点名 `apps/ai-service/app/routers/llm.py:3086` 的 `CHAT_MODE_TOOL_BLOCKED` 与 `:3284` 的 `TOOL_MODE_UNAVAILABLE` 未进 `packages/shared/src/chat/error-catalog.ts`。两码同由 `12c685d10e` 引入。**关键读数**:工作树里 `llm.py` 正被并发会话改着,而那两处生产者在它的 diff 中是 **`-` 行(正在被删)** ⇒ 等那枚提交落地,本门自己归零。**处置 = 不动**:此刻按门的提示去补两行目录 + 五语言词包,产出的将是"目录里有、无人产出"的死条目,而 `R2` 只要求台账八类齐备、不反向拦孤儿,门不会替你发现。另需澄清:`check-error-code-coverage` 的红在 safe-commit 的逐道复跑里判 `not-ours`(未点名本次文件),所以它是"合法被跳过"的红 —— 这条登记就是它的出口。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9578(L1 外部持有行 L7950):

```
- [ ] **本会话开门留下的格(①已闭合且不是我收的,②仍开)**:① 工作树 `PROJECT_PLAN.md` 曾有 3 行(G-206/207/209)停在**归并前的旧 `[ ]` 形态**而 HEAD 已翻勾 —— 正确出口是 `node scripts/heal-worktree-tracked.mjs --align-drift`(判据:索引==HEAD ∧ 工作树==该路径某祖先 ⇒ 才动,可证零独有数据),**不是**手工把整文件按工作树提交(那等于替别人回退归并)。本票落地前复量:`--align-drift` 报「无需对齐(可判定 0 个)」而 `git show HEAD:PROJECT_PLAN.md` 与工作树副本 **md5 同值**(`fe60b0e32b6b3e64e54fa811f87cfba8`)⇒ 对齐已由并发会话/守护一侧完成,不记在自己账上;**这一格的读数必须在提交前一刻重取**,因为它是移动靶。② 门 101 的 **section 级对账**仍未做(上面已开票)。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9579(L1 外部持有行 L7951):

```
- [ ] **`check:plan-task-state` 在 CI 上红,是别人的新维度带着非零存量上线(归 F6 持有人,本会话不代裁)**:`node scripts/plan-tasks.mjs --gate --strict` 在 HEAD 面 exit 1,而 F1/F2/F3 全 0、F4 只报数 —— 红在**新加的 F6(整块登记重复,块级量纲)**:基线 0 而现读 **8 块 / 共 16 份**(另有 10 块"首行相同而正文漂移",工具自己写明"必须人工判哪份作数")。行级四条(F1–F4)对"整块被追加两遍"结构上失明,所以 F6 的立维方向是对的;**错在带存量上线**:这一型与任何提交都无关,谁提交都红 ⇒ 唯一结局是各会话 `--no-verify` 连带约 160 道门作废(§12e,本仓记过不下五次)。两条出路按工具自己的提示:要么人工收掉那 8 块逐字相同的整块重复(它写明"逐字相同才可自动收口",但**没有**自动收口出口,须手写),要么由持有人跑 `--update-baseline` 把 8 钉成棘轮上限 —— 后者会把"不再变多"这一维保住,把"存量归零"留给后人。**归属 F6 持有人,本会话不动别人的判据**。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9581(L1 外部持有行 L7954):

```
- [ ] 副本指针(编号 62)：同主键第二份未勾选副本,只加指针不动勾选;当前状态见带 v3wave3 租约的那条(该条写明 ChatSearchBar 前提被推翻与 use-chat-search 投影现场)。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9582(L1 外部持有行 L7955):

```
- [ ] 副本指针(编号 63)：本行与上一条同主键、是并发并集留下的第二份未勾选副本 ⇒ 按 §1 只加指针不动勾选;当前状态见带 v3wave3 租约的那条。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9583(L1 外部持有行 L7956):

```
- [ ] 副本指针(编号 75)：同主键第二份未勾选副本,只加指针不动勾选;当前状态见带 v3wave3 租约的那条(该条写明默认档与三轴派生阈值及残余)。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9585(L1 外部持有行 L7958):

```
- [ ] P1 新登记(接上条,解阻前置已明确):僵尸实例修复。可选方向三条,按仓库既有取向排序 ——(a) WebView2 创建失败即记录 ERROR + 提示并 `process::exit`,**不得**继续启动 `auto_refresh` 常驻循环;(b) 失败时回退到离线兜底页(`lib.rs` 已注册 `offline` 协议,`auto_refresh` 有断网切页机制)而非静默半启动;(c) 查清 single-instance 为何未拦住第二实例。选哪条前必须先复现:同日两次启动的时间差是 14 分钟,尚未取证"主实例处于隐藏态时 siw 窗口是否仍在"。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9586(L1 外部持有行 L7959):

```
- [ ] **③桌面 ANR/挂死看门狗 + 崩溃分类学 —— 归属桌面端持有人,本线不代做**:上游实测在 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9587(L1 外部持有行 L7960):

```
- [ ] **④长会话滚动四维差异 —— 本波刻意未做,阻塞在"运行时自验"这一格**:四维实测在我方 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9589(L1 外部持有行 L15722):

```
- [ ]O594 票⑰ —— **`2f-ext` 升 blocking 已量好前置,按用户指令暂缓落地**(注册文件 `scripts/guardian-runner.mjs` 本轮不得改)。 〔【归并】重复登记副本(2026-10-01):同主键的另一条登记 「O81 · 票⑰——2f-ext升blocking已量好前置」,派单以那条为准,本行不再单独派单。〕〔让号记录(2026-10-09 F9 清偿批⑤承接):同题同批承让到 O594(持行由取号令牌现算,见该行让号记录;机主拍板 2026-10-09 代码引证优先,O81 留归「跨端 UI 单一源」工作线),本行正文除编号位与本记录外逐字未动。〕
```

- 原 L9591(L1 外部持有行 L7964):

```
- [ ] **`redact_legacy_procedural_patterns.py` 无人调度 + 元认知 `same_tool_diff_pattern` 把"正常的多样性"记成冲突**:前者是一份写好的清洗器,现读全仓引用面只有它自己的测试(`tests/test_redact_legacy_procedural_patterns.py:28` 直接按路径加载脚本),`app/` 与提交链/守护链零调用点 ⇒ 存量脏 pattern 永远不会被清(判"未接线"要数**调用面**,不是实现文件存在)。后者实测在 `app/services/metacognition.py:328-344`:同一 `tool_name` 下任意两条 procedural 只要 `pattern` 不同就产出一条 `conflict_type: same_tool_diff_pattern`、置信度 `0.6 + |score差|×0.3` 起跳 —— 而本仓自产的记录形如 `doom_loop:<tool>:<sha256(入参)>`,**天然每入参一枚不同 pattern**(摘要与旧的身份样文本在这一维等价:都是"入参不同⇒pattern 不同"),于是同一次死循环沉淀越多,冲突清单越长。这不是冲突,是枚举维度。归属:ai-service 元认知线持有者。解阻判据 = 先定义"什么才算同一工具下的真冲突"(例:同一 `pattern` 前缀 + score 反向),再把该判据接进 `detect_conflicts`,并给清洗器一个明确触发点(写入前 / 定时批量)+ 幂等证明后再谈接线。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9593(L1 外部持有行 L7966):

```
- [ ] **门 35(mypy,blocking)此刻对 HEAD 内容就是红的**:一轮 `mypy app --strict` 有 4 条错误落在 `git status` **干净**的文件上(`app/routers/llm.py:1374`、`app/main.py:257`、`app/services/tool_input_scanner.py:34`、`app/services/mcp_server.py:2333`),另 3 条落在他人持有、此刻在飞的 `app/services/agent_engine.py`。后果是 §12e 那一型:**每个碰 ai-service 的提交都被逼 `--no-verify`,连带约 180 道门对该提交作废**(本票第一枚提交就被它连带跳门,归因记录见 `.workbuddy/safe-commit-attestation.jsonl`)。两条诚实限定:① `main.py:257` 的期望类型定义在别的文件里,严格判"HEAD 面红"要一次 `git archive` 隔离检出后复量;② `tool_input_scanner.py:34` / `mcp_server.py:2333` 是"模块没有该属性",与 app/services/sandbox/(该目录已于 2026-10-12 随 G-188 下线删除) 的导出面有关,修它可能改动别人的运行时行为而非只加注解。归属:Python 侧门持有者;解阻判据 = 隔离检出复量后逐条定性(真缺陷修代码、过期注解修类型),**不得为变绿去削 `--strict` 或加 `# type: ignore`**。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9594(L1 外部持有行 L3824):

```
- [ ] 重启宿主/开机后 `%TEMP%` 才会真指 `D:\DevEnv\Temp`;在此之前任何未接 `scratch-dir` 的 〔更正等待条件(2026-09-27 现测):这条"重启宿主后才会生效"在本机**至今没兑现** —— GUI 宿主线上的进程实测 `process.env.TEMP = D:\caches\Temp`(而不是 §26 登记的 `D:\DevEnv\Temp`),而 `D:\caches` 这一族路径按 §26 属"本机不存在/历史死路径"那一型。所以它不是"再等等就好",而是**宿主环境层的分叉**:归 §26 改道机制的持有者处理,不得靠重启碰运气。本行保留未勾选,归属改为"等环境"。〕 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9595(L1 外部持有行 L11146):

```
- [ ] **架构契约表最后一块 `packages/types` 翻不正面 —— 台账旧句"0 个模块 managed:true"已失效(2026-09-28 现读)**: HEAD `config/architecture-policy.yaml` 现读 24 块里 **23 块已 `managed:true`**(表头留痕:api-client 第一块、dom-actions 第二块、i18n 第三块、repo-tooling 第四块、其后 19 块一次批量翻正),**只剩 `packages/types`**,而它被表内制度 + 镜像守卫双重按住:`EX-C2-1`(yaml 内)原文写明"按业务域拆成多入口前,不得把该模块翻 managed:true",现读 `packages/types/src/app.ts` = 5298 行(那条例外里写的 5258 已向上漂移 40 行,又一个抄旧取证的实证)而上限 2000; 镜像 `scripts/tests/check-architecture-policy.test.mjs` 的 `MANAGED_FALSE_LEDGER` 做双向集合对账 —— 径行翻正会让 T13 报"清单腐烂"红,而它不在改判据的允许面内。 所以本票**不是清账动作**:`--managed-trial packages/types` 的 0 红是那条例外遮住的,翻正而留例外=把没收口的块记成收口,翻正而删例外=当场 1 红,两种读法都不满足"翻完不产生新红"。 解阻前置(按序,四步同笔):① 拆 `packages/types/src/app.ts` 至各文件 ≤2000;② 同笔删 `EX-C2-1`;③ 同笔删 `MANAGED_FALSE_LEDGER` 的 types 条目;④ 再 trial→翻正→复跑全量/`--staged`/镜像 16 例。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9596(L1 外部持有行 L4996):

```
- [ ]**WP-8 上下文占用归因 + 流式工具账本 + 目标完成独立校验轮**。后者是补 〔PROGRESS 2026-09-26(按 HEAD 实测三件分档,票保持未勾):①**流式工具账本**已入库且有消费点(`apps/cli/src/stream-tool-ledger.ts` 在 HEAD,`commands/agent.ts`、`hooks/index.ts`、`hooks/trust.ts` 三处引用,`git grep -l` 实测非 0);②**上下文占用归因**已入库(`packages/shared/src/utils/context-attribution.ts`+ `apps/web/src/components/ai/context-usage-ring.tsx` + 定向测试);③**目标完成独立校验轮**只有契约与 web 呈现位(`packages/api-client/src/endpoints/agent-runtime.ts` 的 goalCriteria/校验结论字段 + web 词包 `goalAchieved`/`goalUnmet` 等键),**执行侧闸门零命中**:`git grep -n "verificationRound|goalVerification|judgeGoal|独立校验" HEAD -- apps/cli/src apps/api/src` = 0 命中 ⇒ 循环自宣完成仍未被强制过校验,§8 那条"禁止模型自评 yes"仍未落到运行时。解阻判据:CLI/api 循环侧接契约字段并出一枚"未过校验不得判 achieved"的用例;该格落点在 `apps/cli/src`(当前 12 个文件他人在飞),故本票不派、不代裁。〕 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9597(L1 外部持有行 L7985):

```
- [ ] `reclaim` 改写信封内容的边界:本批只在 CLI 侧由"重建提醒"兜回产物指针, 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9599(L1 外部持有行 L7987):

```
- [ ] **⑤-附:运行副本要不要也开邮件,前提已变,请重新决定**。我**没有**覆盖 `D:\DevEnv\monitor\alertmanager\alertmanager.yml`:那是当前唯一真正在到人的 webhook 路由,拿模板产物整文件替换会有回归面;正确做法是在那份文件里**追加** `global` 邮件段 + 一个 email receiver(保留原 route 不动)。因为你当初批准这条的依据是"告警从未送达",而该前提已被我证伪,所以这一步改回由你定,我不代做。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9600(L1 外部持有行 L4709):

```
- [ ]（进行中）**守门 91 冻结的 9 处待清 + 一项方法论债(2026-09-24)**:① study-publish 整文件主题化(14 处 `getTokens('light')`,8 处在模块级 StyleSheet.create 里,须改成按 scheme 生成的函数或下沉到组件内), 改完后 `node scripts/check-theme-prop-wiring.mjs --update-baseline` 应收窄; ② 7 个他人 M 在制的屏(CourseDetail / Distribution / LiveDetail / ModelPlaza / N8nModel / PostCreate / SharedDemo)待其会话自行接线; ③ `{...props}` 展开类站点被判 spread-unknown(判不出即如实报,不静默放行)—— 要真正覆盖须先给端内 wrapper 的 props 建立类型事实,属独立改造; ④ 方法论债:**本轮两次误判同源** —— 一次是把像素被 `rgba(0,0,0,0.6)` 遮罩压暗 40% 当成"颜色没落上", 一次是用"文本里有没有某个键"统计出"0 处漏传"。两者的共同错误是**用一个不测量目标东西的探针给出肯定结论**。 纪律:凡给出"0 处 / 没有 / 已全清"这类否定性结论,必须先构造一个**已知应被命中的正例**喂给同一判据(阳性对照), 否则该结论不得写进文档或据此决定"不做"。 〔PROGRESS 2026-09-25: ① study-publish 共享屏 15 处 getTokens(light) 由 commit 5ce93b9e1 清零(守门91/83 全绿);②③④ 仍开放〕 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9601(L1 外部持有行 L7989):

```
- [ ]（进行中）**合流会静默吞掉「已真机验证」的代码修复,而守门 76/71 对此零覆盖(2026-09-24 实测)**: 本会话 84583fdf6 把 PlazaScreen.tsx:464 / RankingDetailScreen.tsx:171 的 colorScheme 字面量改为 resolvedTheme,**并在 v0.0.5/code8 真机复测通过**(广场页正文由 #f5f5f5/#ebebeb 变 #242424/#1a1a1a,与 NavBar/TabBar 同档)。随后几轮 git-sync-converge 之后,HEAD 里那两处**又变回了写死 "light"** —— 并发会话有一条基于 b1a162c4e7(同文件改造)的独立提交线,经 merge-tree 合流时结果取了对方侧;该合并在 git log -- <path> 的历史简化里被隐去(84583fdf6 根本不出现),所以「我的提交还在 ancestry-path 上」完全不能证明「我的改动还在文件里」。 为什么无人拦:守门 76(stale-revert)与 71(plan-line-loss)都只在 commit 时按**暂存内容**判定,而 converge 走 merge-tree + commit-tree + update-ref,**不跑任何钩子** —— 合流层是这两道门的共同盲区。本会话同一机制差点也吞掉测试桩修复,逐字符串核对后判为误报(命中的是我自己写的解释性注释,非真实 vi.mock 调用),说明受害面是全部经合流的代码改动,不止文档。 本轮处置:已用 cc63b5bd0a 前向重落,并在提交前逐行核对「工作区 vs 当前 HEAD 差量恰好只有这 5 行」(2 处字面量替换 + 1 行 import + 1 行 useTheme 钩子),对方对这两个文件的其余改动零触碰。 建议补法(未擅自实现,属他人守门):converge 成功出口处,对本次推送范围内每个文件跑一次「本会话已提交过的 blob 是否仍被 HEAD 版本包含」断言 —— 即把守门 71 对登记行做的事,对代码行做一次;或更廉价:合流后重跑一次本会话关键判据的 grep 断言。在补上之前,任何「真机验证过」的代码修复,收尾时必须用 git show HEAD:<file> 再核一次,不得以「commit 在 ancestry 上」代替。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9602(L1 外部持有行 L7990):

```
- [ ] **仍在这台机器上、不由我裁的**:C 盘剩余 5 项未识别条目(优酷 1.3G / ClipFlow / 输入法字典 / 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9603(L1 外部持有行 L7992):

```
- [ ] **本波未闭环（归属明确，不是遗漏）**：① 桌面 `page_*` 要真成立需三处同改（新增独立 category / 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9604(L1 外部持有行 L15660):

```
- [ ] **本波自己踩到的取证纪律（已在上一批记过，仍复发，所以再记一次）**：`cmd 2>&1 | tail -N` 之后 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9605(L1 外部持有行 L7994):

```
- [ ] **上游第二轮规格派出的票（规格在 `.ihui-agent/tmp/zcode-absorb/MECHANISM-SPEC-2.md`，gitignored）**： 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9606(L1 外部持有行 L7995):

```
- [ ] **接线由主会话单做**（本波四张票都按任务书没碰 `guardian-runner.mjs` / `package.json` / 活文档）： 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9607(L1 外部持有行 L7996):

```
- [ ] **顺手登记一条门 71 的漏判(事实,非本票可修)**:上面这一整节由 `7c22d68d09b` 入库,随后被并发提交 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9608(L1 外部持有行 L11354):

```
- [ ] **`BROWSER_ACTIONS` 手抄清单不照 page 族那样派生(经取证否决,非疏漏)**: 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9609(L1 外部持有行 L9866):

```
- [ ] **我本轮犯过两次的"检查时机"错误（记下来防它再变成诬告）**：两张并行票的存在性检查，我在代理**尚未落盘时**就跑了，`test -f` 全 MISSING， 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9610(L1 外部持有行 L15863):

```
- [ ] **★ 抓到本仓一处"造好没装车"：`apps/cli/src/tools/argument-validator.ts` 在生产面零调用方 ⇒ CLI 工具入参根本不校验** 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9613(L1 外部持有行 L8121):

```
- [ ] **4 道 blocking 门红在 HEAD(各归属会话处置,本会话不代改)**:① 门 77 `check-radius-single-source` —— 纯 HEAD 检出仍 **1179 处**违规而基线只 26 条,引入者 `36b1468b19c`(09-23 18:04 把全 8 端纳入范围)未同步重算基线;② 门 83 `check-brand-foreground` —— 点名 4 文件的 `bg-white` 不在基线(内容自 `26975a4bfdd` 即在,`54282d0037f` 补登时只加了 ChatScreen、漏了 ModelConfigDialog);③ 门 7 `check-dedupe` —— `pnpm-lock.yaml` 与全部 package.json 与 HEAD 逐字节同 ⇒ HEAD 已红,引入 `63d1952cf30`(merge 锁文件);④ **门 52 `check-no-visible-spawn` 是判据自身坏了** —— 8 处命中全落在 `scripts/check-git-read-timeout.mjs:269-324` 的反引号**夹具**内,而门 80 的自测明确断言夹具不该判 ⇒ 需给门 52 补夹具豁免(与门 79 的 E1 豁免同型)。**禁止用"调高基线"消红**(门 70 口径:清理后人工确认才下调,不得为过门平账)。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9614(L1 外部持有行 L15723):

```
- [ ] **测试**:`apps/api/tests/notify-deploy-failure.test.ts`(参数解析/env 优先级/收件人消解/From 构造/Resend payload 含 html/--strict 退出码)+ PS 侧镜像测试(证明 PS 已无自拼传输)。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9615(L1 外部持有行 L11151):

```
- [ ] **本票未做的两件(归属明确,不是遗漏)**:① **同族修法早已存在,收敛器只是最后一个** —— `git-push-guard.mjs:194-211` 与 `check-push-sync.mjs:118-127` 在 2026-09-12 就改成"`ls-remote` 优先、失败才回退本地 ref",并写明两类真实事故("push 明明成功却报验证失败"、"本地已与远端同步却报落后 N ⇒ 诱导 `pull --rebase`,而本机禁用该命令曾两次删库")。**还剩两处把本地指针当第一真值**:`scripts/union-converge.mjs:479`(`resolveTargets` 用它当合并输入 —— 残值会让"已同步/目标已被本地包含"两档跳过判错)与 `scripts/check-merge-addition-loss.mjs:112`(`pendingMerges` 用它算 `remote..HEAD` 区间 —— 残值要么漏判要么重判)。正解不是再抄一份,而是把 `resolveRemoteHead` **上移到 `scripts/lib/face-reader.mjs`**(它已是注入式纯函数,构造面测试现成),让四处共用;② `alignWorktreeAfterHeadMove` 现在仍"失败只记日志",若长期失败(锁一直被占)应喊到人 —— 那属 §5e 通道口径,不由本票顺手接。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9616(L1 外部持有行 L11151):

```
- [ ] **本票未做的两件(归属明确,不是遗漏)** —— **2026-09-25 更正:① 已由 O76 收口(四处共用一份),② 仍未做**。① **同族修法早已存在,收敛器只是最后一个** —— `git-push-guard.mjs:194-211` 与 `check-push-sync.mjs:118-127` 在 2026-09-12 就改成"`ls-remote` 优先、失败才回退本地 ref",并写明两类真实事故("push 明明成功却报验证失败"、"本地已与远端同步却报落后 N ⇒ 诱导 `pull --rebase`,而本机禁用该命令曾两次删库")。**还剩两处把本地指针当第一真值**:`scripts/union-converge.mjs:479`(`resolveTargets` 用它当合并输入 —— 残值会让"已同步/目标已被本地包含"两档跳过判错)与 `scripts/check-merge-addition-loss.mjs:112`(`pendingMerges` 用它算 `remote..HEAD` 区间 —— 残值要么漏判要么重判)。正解不是再抄一份,而是把 `resolveRemoteHead` **上移到 `scripts/lib/face-reader.mjs`**(它已是注入式纯函数,构造面测试现成),让四处共用;② `alignWorktreeAfterHeadMove` 现在仍"失败只记日志",若长期失败(锁一直被占)应喊到人 —— 那属 §5e 通道口径,不由本票顺手接。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9619(L1 外部持有行 L15857):

```
- [ ] **ai-service `.venv` 处于半损坏态**:`.venv/pyvenv.cfg` 丢失(venv 退化成全局解释器视角,`python -m pytest` 报 no module;已按 uv 0.12.4 形态重建 cfg 恢复 venv 识别),且 `uv sync` 全量对齐被 **pywin32 的 pywintypes312.dll 文件锁**打断(本地有一个 61MB 的 python 进程疑似占着 DLL,不杀并行会话可能在用的进程)。当前状态:大部分包在,`requests`/`idna` 等在 sync 中断中丢失,O17/A2A 卡片测试文件因 import 链过长暂无法在本机 pytest。**修复路径**:确认占 DLL 的进程身份并终止(或停本地 ai-service dev 实例)→ 重跑 `uv sync --no-install-package pywin32` → 跑 `tests/test_a2a_agent_card.py`(含 2026-09-24 新增 3 用例)。O20 的行为正确性已由临时验证脚本 7/7 实证(`.ihui-agent/tmp/mail-0924/verify_host_fix.py`,用后即删)。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9622(L1 外部持有行 L15724):

```
- [ ] `/api/agent/goal-verify` **无生产消费方**(端点已注册、测试已断言路由存在,但 goal 运行循环 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9623(L1 外部持有行 L8004):

```
- [ ]（进行中） **守卫票：`scripts/i18n-apply.mjs` 把未知参数当"无参"，`--help` 即直接写盘**。本轮实测代价见上一行(四份语言包被陈旧载荷重排，已逐字节还原、零损失)。要求的修法：① `--help` / `-h` 只打印用法并 exit 0；② 任何未识别参数一律 **exit 2 并点名该参数**，不得降级成默认动作；③ 写盘前若输入载荷的 `translatedAt` 早于目标文件 mtime、或本轮没先跑过 `--check`，拒绝写并说明原因。验收判据：`node scripts/i18n-apply.mjs --help` 跑完后 `git status --porcelain -- packages/i18n` **必须为空**，并把这条负向判据钉成镜像测试。**守卫落地前，任何人不要用这个脚本试参数。** 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9624(L1 外部持有行 L8005):

```
- [ ]（进行中）**授权缺陷：`POST /skills/:name/unlist` 只有 checkAuth 却做硬删条目** ⇒ 任意登录用户可永久删除他人/内置市场条目；注释自称"admin 治理动作"但实现里连 admin 校都没有（注释与实现分叉）。唯一调用方是 admin 页 ⇒ 收紧不破坏正常路径。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9625(L1 外部持有行 L8006):

```
- [ ]（进行中）**P0 授权缺陷：`POST /skills/market` 可用自报 author 认领平台内置技能**（主会话逐行实测：787-789 行 `existing.ownerId=publisherId; source="user"` 的"归属补齐"，其上游闸门 773 行只比 `body.author` 字符串；内置种子 `author:'IHUI'` 源码公开且无 ownerId；该端点零 admin 校 ⇒ 任意登录用户可①认领内置技能②改写其 description/tags/version/license③触发对全体订阅者的伪"更新"通知。注释 764 行"不接受请求体自报"与实现分叉） 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9626(L1 外部持有行 L4700):

```
- [ ] **本轮未落地、需重做的一批(web 86 处内的键名对齐)**:该批次报告改了 4 个文件(`DeveloperKeyDialog` / `AiGenerationContent` / `PermissionSelector` / `helpers`),**逐条按内容复核后全部不在 HEAD**(`git grep <新键名> HEAD -- apps/web` 四处均 0 命中),工作区也已被并发会话覆盖 → 判为**丢失需重做**,不要当成已完成。中途我一度按"工作区里有"记成"已落地",那是读到了被覆盖前的窗口 —— 并行期复核一律以 **HEAD 对象树内容**为准(档案第 4 节已记此教训)。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9627(L1 外部持有行 L11193):

```
- [ ] **本线仍未闭环的一件(归属明确,不是遗漏)**:守门 93 的 **R1/R2/R4/R5 那半边仍按磁盘读** 两份 token 源文件,而同文件 R3 段头(`scripts/check-cross-end-tokens.mjs:1367`)自己写着"扫**仓库内容**,不扫共享工作树的未提交缓冲区"⇒ 同一道门两种取材面,AGENTS「口径同 77/83/98:全量判 HEAD blob」对它**只对了一半**。静态证据(本机不得为取证去改共享 token 文件,故不给动态复现):`grep -n "readFileSync(RN_TOKENS_PATH\|readFileSync(TOKENS_CSS_PATH" scripts/check-cross-end-tokens.mjs` 命中 1297/1298/1563 三处主流程读取。**当前不构成红点**(实测两文件工作树==HEAD),按"未引爆不动他人面"登记;解阻判据:任一 `pnpm check:all` 轮里这道门因这两份文件报出与本次提交内容无关的差异,即当场按 R3/R6 同形收口(HEAD / 索引 + `--worktree` 逃生舱)。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9628(L1 外部持有行 L15860):

```
- [ ] `config/architecture-policy.yaml` 目前 0 个模块 `managed:true` —— 渐进收口的第一块翻正面尚未选定。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9629(L1 外部持有行 L8009):

```
- [ ] **紧急(他人暂存态,非本会话所为,2026-09-24 11:0x 发现)**:**索引里有 16 条"已暂存的删除"**,一次不带 pathspec 的普通 commit 就会把这些**已入库功能从版本树删掉**。清单含三个成体系功能族 + 一道守门:① D62 语音字幕(`packages/shared/src/chat/voice-subtitles.ts` + web 组件 + 测试)、② D91 批注锚点(`annotation-anchors.ts` 同族)、③ D67 额度归属(`quota-ownership.ts` 同族)、④ **并发会话 cb99ef0c 刚提交的 `apps/mobile-rn/src/theme/color-scheme-sync.ts` 及其测试与 NativeWind mock**(删掉即把"App 主题开关驱动 NativeWind"这次修复整体回退)、⑤ `scripts/check-home-junctions.mjs` + 其镜像测试。**判为误删而非迁移的依据**:索引里的桶文件 `packages/shared/src/chat/index.ts` **与 HEAD 一字未改且仍导出这三模块**(二者矛盾 ⇒ 构建必炸,实测 Metro 就在 `export * from './voice-subtitles'` 处失败),且`git ls-files` 全仓**无替代路径**。**本会话处置边界**:只把 13 个文件(2626 行)的内容**恢复到工作区**让构建可用,**索引一字未动** —— 是否撤销这些暂存删除由制造它们的会话自己决定(§5b:他人已暂存的删除只报数、不代裁)。取证:`git diff --cached --diff-filter=D --name-only`;复跑恢复:`node .ihui-agent/tmp/rn-build/restore-worktree.mjs`。**另注**:`heal-worktree-tracked.mjs --check` 此时报"工作区已跟踪文件存续正常"—— 其判据②要求"索引 blob == HEAD blob",而暂存删除使该条件不成立,故**这类"已暂存的删除"不在存续自愈覆盖面上**,是一道无人看的路;要闭环需在守门侧对 `--diff-filter=D` 的暂存删除单独计数并阻断(未擅自新增守门,留单)。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9630(L1 外部持有行 L8010):

```
- [ ] 钩子 trust 的**残余面**:webhook 形态钩子仍不过门(本批按 command 收口); 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9632(L1 外部持有行 L15659):

```
- [ ] **C 清单里那条"原生 `<a>` 不算 affordance"我试过当场扩,撤回 —— 它不是一行白名单**(2026-09-26): 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9635(L1 外部持有行 L8014):

```
- [ ] **本批否证与不作为登记**：`monitoring/alertbridge/alert-webhook-bridge.cjs` 在 HEAD 面上有 **7 处 `no-unused-vars`（`catch (e)` 未用）**，实测与本批改动无关（HEAD 副本同一把 lint 同为 7）⇒ 按"只做被点名工作流"未顺手改；跨行的凭据（关键词与值分居两行）bridge 结构上不命中，已写进文件注释而非只写进报告。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9636(L1 外部持有行 L8015):

```
- [ ] **门 137 升更严判据的前置条件（现在不许顺手升）**：首跑 3 命中里 2 处是同词不同义的假阳性 ⇒ 词元匹配仍需收窄（`idx/index/position` 后缀、复数名词指"集合"两种形态尚未进判据）；且 `--strict` 下有 **305 处未判定**（`digest` 两义、`node_modules` 之外的手写散列不可逆性判断）⇒ 本门长期停在建档/报数形态，`--strict` 只在清偿时跑。**不得为消红放宽判据，也不得因数字大而把假阳性当缺陷去"修"没坏的东西。** 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9637(L1 外部持有行 L8016):

```
- [ ] **本波次之后仍 open 的账(逐条带归属,派单前先读这一格而不是重新猜)** 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9638(L1 外部持有行 L10189):

```
- [ ]**第二十八批:布尔 ack 的键族从 `deleted` 扩到 `removed / restored / revoked / cleared`**(扩键后的普查现读 **27 处代码面**,其中 12 处是已定性的 `deleted` 那一族): 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9639(L1 外部持有行 L10223):

```
- [ ]（登记，非本线）relay admin 4 个删除端点零测试覆盖、`o13-bg-rls-live.test.ts` 需要自己的串行通道 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9640(L1 外部持有行 L10183):

```
- [ ] P1 残余②:桌面端 `tauri_plugin_log` 注册处只给了 `.level(Info)` 而**未设 target**,日志只进 stdout 不落文件(实测本机无任何 desktop 日志文件)⇒ 这类「卡死但不退出」事后完全无法归因,本票是靠读 runtime 源码 + 现场进程取证才定性的。修法=显式加写文件的 log target,落点须走 §15b 批准的日志根,属可观测性改动另计一票。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9642(L1 外部持有行 L8022):

```
- [ ] **守门 134 的第二格仍开着（① 已按票面处置完毕,结论是"不补判据、固化测量",枚 `fd46aa9da`）**：① B2 那一跳接裸 SQL 维 —— 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9645(L1 外部持有行 L8032):

```
- [ ] 副本指针(编号 62)：同主键第二份未勾选副本,只加指针不动勾选;当前状态见同主键的当前状态那条(编号相同、不带租约)(该条写明 ChatSearchBar 前提被推翻与 use-chat-search 投影现场)。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9646(L1 外部持有行 L8033):

```
- [ ] 副本指针(编号 63)：本行与上一条同主键、是并发并集留下的第二份未勾选副本 ⇒ 按 §1 只加指针不动勾选;当前状态见同主键的当前状态那条(编号相同、不带租约)。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9647(L1 外部持有行 L8034):

```
- [ ] 副本指针(编号 75)：同主键第二份未勾选副本,只加指针不动勾选;当前状态见同主键的当前状态那条(编号相同、不带租约)(该条写明默认档与三轴派生阈值及残余)。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9648(L1 外部持有行 L8035):

```
- [ ] 副本指针(编号 51)：同主键第二份未勾选副本,只加指针不动勾选;当前状态见带「三面 parity 门 136 现读未接线 0 类」注记的那条(该条写明六类执行器真接线、stub 两类按 §7 保留) 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9650(L1 外部持有行 L8048):

```
- [ ] **`--self-test` 的"登记侧不求值"洞已逐门普查完:41 道潜伏 / 今天掩盖真缺陷 0 条 / 根因是没有共用出口(普查判定面=HEAD,派单前须重跑)** —— 起因是本轮代落守门 41 时量到它的 13 条 self-test 全部传箭头函数而登记函数写的是 `!!ok`(`!!fn` 恒真)⇒ 一路打印"13/13 通过"却一条都没判过,在这个掩护下同文件一处单位错误(把**秒差**除以 3,600,000 ⇒ 48h 豁免窗实际约 5.5 年,"超窗仍判"那条反向对照永不触发)长期隐形。该门已修并补镜像(枚 `aea810c81`)。随后按 HEAD 面普查全仓 `scripts/**`(418 个 mjs)得到这一族的**全量分布**: 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9661(L1 外部持有行 L8049):

```
- [ ] **`plan-tasks-merge.mjs --dedupe-blocks` 的阈值覆盖不到"两行逐字相同的单行副本"这一型（现读实证：86H 那一条已完成行在 HEAD 面有 2 份逐字相同副本 —— 计数用 `git show HEAD:PROJECT_PLAN.md | grep -c "86H. agent 审批的权限决策落审计链"` = 2；按 §1 判据 3 不写行号，行号在 append 后必挪位）**：该出口只认 **≥3 行且每行 ≥40 字符的连续 bullet 块逐字相同**（阈值本身是对的 —— 低于它会把台账里天然成对的短行成百地报出来，噪声淹信号），于是"同一件事被写成两份、每份都是单行"恰好落在缝隙里；而 F1/F2/F4 也都不计它（四条判据里"待办副本"要求未勾形态，两份都已 `[x]` ⇒ 账面 0，`plan-tasks.mjs --staged` 现读 F 维全 0）。**这一型有两条候选制造路径(本票未定性,不得读成已归因)**:活文档 union 把改写前那份带回来;门 71 的 post-commit 自愈按标记回捞"丢失"的行 —— 若那一行其实是被**就地改写**(旧行已按 §1 留在原位、新行另处再写一份),回捞就会补出第二份。定性要跑一次可控复现(独立临时仓里"改写一行 → 触发自愈"看它补不补),不在本票顺手做。**在等谁**：归并器持有人裁 —— 出路只有两条且都要人拍：a) 给 `--dedupe-blocks` 加"同主键 + 逐字等值 + 已完成形态"的单行档（判据必须是**逐字等值**，半行不同就交人工，理由同它现有那条"机器折半即有损"）；b) 或在门 71 自愈侧改为"编号在面上已存在即不追加"（那是生产者侧收口，比事后清账更对，但要证明不会把真丢行也一并按住）。**不得**由本票手工删行：删已完成行受 §1"禁止无声删除"约束，而两份哪份作数要按主键而不是按行号（§1 判据 3 已把行号指针判为不可用作证据）。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9662(L1 外部持有行 L15859):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L6964(G-208) 同题,派单以持有行为准,本行不再单独派单。〕 **G-1018285. 生产备份链日志的写入侧编码要改成 UTF-8(2026-09-28 逐行 strict-UTF-8 现读登记)**:`D:\DevEnv\logs\pg-backup-scheduler.log` 自 **L571(2026-09-09 00:58:12,字节偏移 25,709)起由 UTF-8 切成 GBK 并持续至今**(前 570 行 520 行中文正常 / 之后 360 行非 UTF-8,0 个 `U+FFFD` ⇒ GBK 侧可无损还原)。**同批纠一处台账失实**:`scripts/alert-volume-report.mjs` 头注把"GBK/UTF-8 混合"记在 `deploy-loop.log` 头上,而该文件实测**整档是合法 UTF-8** —— 坏的是 09-24→09-28 那段已烘死的 475,314 个 `U+FFFD`(行 120,624–257,864,子进程管道阶段就把非 ASCII 字节换成替换字符,**原字节不可回收**);该处文案已按现读改写(规矩"只用 ASCII 判据"一字未动,改的是它给的错误机理 —— 按旧文案下一个人会去修解码器,而解码器没有坏)。**为什么现在不当场做(等环境条件,不是等人拍板)**:改法是 `deploy/win/ihui-pg-backup.ps1` 顶部加一条进程级`[Console]::OutputEncoding = UTF8` 并同笔把 `deploy/prod-bundle/` 那两份运行副本改成逐字节等值(由 prod-bundle 影子对账门判等),调度器每轮用 `&` 从磁盘重读子脚本 ⇒ 不必重启服务、下一轮 03:00 起生效;但它落在**生产备份链实际执行的那份文件**上,而"改转发壳后重启曾让 `pg_dump` 挂 3.5 分钟"那次至今没解释清(本轮另测近 5 轮各 8–15 秒,挂起不可复现)——在解释清之前不动生产备份,这条规矩自 2026-09-24 起就写在案。**归属**:生产备份链持有人。**验收判据(必须"改完且跑过")**:新增行的 strict-UTF-8 解码 non-UTF-8 计数 = 0;历史 GBK 段不做改写(对已入库运行态日志做转换属另一类动作)。**顺带一格(不单独开票)**:`IHUI-DEPLOYLOOP` 的守护半在 09-26 11:09 起就驻留旧脚本,其 catch 支管道仍按旧编码写,全档该支触发 0 次 ⇒ 零观测损伤,并入既有低峰重启窗口即可。 〔【归并】重复登记副本(2026-10-01):同主键的另一条登记 「G-385 · 生产备份链日志的写入侧编码要改成UTF-8」,派单以那条为准,本行不再单独派单。〕 〔让号记录(2026-10-02 F9 清偿批②):原号 G-385 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕
```

- 原 L9719(L1 外部持有行 L4356):

```
- [ ]（进行中） **守卫票: `scripts/i18n-apply.mjs` 把未知参数当"无参",`--help` 会直接进写盘模式**。本轮实测代价:跑 `node scripts/i18n-apply.mjs --help` 想查用法,结果它拿一份陈旧 `i18n-translations.json` **重排并改写了 en/ja/ko/zh-TW 四份语言包**(各 176–214 行新增 / 35–39 行删除)。四个文件当时是干净的,已按 `git show HEAD:<path>` 逐字节还原 + 复验(parse OK、`git status` 空),零损失。**要求的修法**:① `--help`/`-h` 只打印用法并 exit 0;② 任何未识别参数一律 exit 2 并点名该参数,**不得降级成默认动作**;③ 写盘前若 `--check` 未跑过或输入载荷的 `translatedAt` 早于目标文件 mtime,拒绝写并提示(本次那份载荷就是旧的)。验收:`node scripts/i18n-apply.mjs --help` 必须**不产生任何 git 脏文件**(用 `git status --porcelain -- packages/i18n` 断言),并补一条镜像测试钉死这条负向判据。归属:下一轮派单;在此之前**任何人不要用该脚本试参数**。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记 (与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9735(L1 外部持有行 L15871):

```
- [ ] G-62. 流式中切换模型 → 终止后自动带入新模型 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「68 · 流式中切换模型→终止后自动带入新模型」,派单以那条为准,本行不再单独派单。〕 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 68 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。指针副本族两行自述「派单以那条为准,本行不再单独派单」,按批②同款特例整族让号,原号留归注记所指的干净持有行。〕 〔改号(2026-10-14):原G-1038409〕
```

- 原 L9736(L1 外部持有行 L15674):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）**分叉合并这次"丢掉的东西"与"互相矛盾的两行文档",按归属交接,不由合并代裁**:① **丢的实现** —— `scripts/check-service-binary-paths.mjs` 与它的测试是同一票在两条分支各写一份(add/add),合并取的是 origin 那份(唯一理由:合并后的 guardian-runner 注册的是它,而只有它读 `HUSKY_SKIP_SERVICE_BINARY_PATHS`;留本侧就等于给提交链挂一条"文档写了但跑不通的出路"),本侧多出的三样探测随本次合并**没了**:服务 STATE 的 `sc query` 取法、按声明端口真应答的活性探测、nssm 输出的 UTF-16LE 解码。归该门持有人,出口是把这三样并回 origin 那份实现,不是把文件换回来。② **矛盾的两行文档** —— AGENTS.md 里现在同时留着"定级 warn / 手动问责 / 刻意不进提交链,因此无紧急跳过变量"(本侧)与"定级 warn,紧急跳过 `HUSKY_SKIP_SERVICE_BINARY_PATHS`"(origin 侧),两句对同一条门互斥;合并**没有**替谁改写谁的那一行(两条都逐字存活),拍板归两侧登记人共同做。③ 为什么这两件事不在合并里顺手修:①要动别人正在持有的门体,②要判定级属产品/治理决策 —— 合并的职责是"谁独有的谁拿走",不包括替人裁决。**等什么**:①② 各自持有人;在此之前锚点里 `G-300/G-301/G-310` 三组跨分支撞号按现读放行(见上一条),不得靠调宽锚点消红。(2026-09-28 合并时登记) (2026-09-28 二次改派:上一轮的号是按当时快照取的,合并落地后又被并发批次用掉同号 ⇒ 本次改由 live-doc-edit 在每次 CAS 里按当下 HEAD 现算,不再照快照取号。) (原编号 G-351;持有行题面「分叉合并这次"丢掉的东西"与"互相矛盾的两行文档」)〔残行摘号补齐(2026-10-09/F9 清偿批⑤):本行声明位残留的原号已按 F9 清偿批②/④让出(同族持有行的让号记录在案),本笔摘掉声明位令牌,正文除令牌外逐字未动;同题登记以「分叉合并」那一条按标题前缀寻行(不写行号),派单以持有行为准。〕
```

- 原 L9737(L1 外部持有行 L15577):

```
- [ ]〔【归并】重复登记副本(2026-09-28,幂等折叠):这一行与同题的持有行是同一件事,持有行是「门 8 清账后遗留的三枚"有消费方的待实装路由"…」那一条待办(按标题前缀寻行;指针里既不写编号也不写行号 —— 写了编号就会被台账取成这条副本自己的主键,折叠反而新增撞号,这是今天实测到的成因)。本行摘掉编号、只留指针,不翻勾、不并抄、正文逐字保留。〕 **G-1038415. 门 8 清账后遗留的三枚"有消费方的待实装路由"(2026-09-28 登记,现读=基线仅剩 3 处)**:① `GET /api/subagents/all` —— 消费者 `apps/web/app/(main)/agent-teams/page.tsx:58`(期望 `{dispatches}` 含 completed/failed/cancelled 全量);后端只有 `/subagents/active`(仅 pending/running,形状恰好相同但语义是子集,**不得**为省事把客户端改道 active —— 那会把"页面少了历史"写成"已修")。正解 = 在 `subagent-dispatch.ts` 补 all 列表路由(带 status/limit 透传)。②③ `PUT /api/ai/n8n/workflows/:id` 与 `POST .../toggle` —— 消费者 `apps/mobile-rn/src/screens/N8nModelScreen.tsx:146/192`(保存改名/启停今天必 404);后端 n8n 面只有列表透传与创建转发(miniapp-compat-routes.ts:1123/1190),n8n REST API 本身支持 workflows/:id 更新与 activate/deactivate,正解 = 在 n8n 代理补两枚透传(SSRF 校验与 env 缺省回 stub 的既有纪律照抄)。验收判据:两枚消费者页面真机/真会话各跑一次成功路径 + 基线 `scripts/api-routes-baseline.json` 清零 + 门 8 末行现读 0。**归属**:subagent 面 = agent-teams 线;n8n 两面 = n8n 代理持有人(本票只登记形状与消费者证据,不代裁实现位置)。 〔落地@2026-09-28/枚 2704c4d27〕三枚路由已入库:subagents/all(新→旧+status/limit)、/ai/n8n/workflows 面四枚(list stub/写 503/fetch-merge-put/toggle 回读真值);apps/api/tests/g299-new-routes.test.ts 4 例绿、门 8 死调用清零、基线 perFileCount 清表。**本票未翻勾的唯一理由=验收判据第一条未跑**:RN N8nModelScreen 真机走查(本机无设备)与 agent-teams 页真会话 200 取证(需起栈)——路由与契约已证,运行时成功路径待验,不得以单测冒充真机。（编号改派留痕:本行原登记为「G-299. 门 8 清账后遗留的三枚…」,与「本机交付被远端分支保护拒收」撞成一号两事;2026-09-28 由 live-doc-edit 的取号令牌在每次 CAS 里按当下 HEAD 现算改派为 G-312,旧编号在此留原文,便于任何按旧号引用的人查得到去向,而不是让它静默消失） —— 沿革:G-299→G-312→G-334(两次都被别的登记占去,每次都在行尾留原文)。**[重复登记副本]** 同一件事在 origin 侧以「G-316. 门 8 清账后遗留的三枚…」另登过一次,当前状态持有行按那条走,本行不翻勾、不并抄。 (原编号 G-334) 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-334 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕
```

- 原 L9739(L1 外部持有行 L15577):

```
- [ ]〔【归并】重复登记副本(2026-09-28,幂等折叠):这一行与同题的持有行是同一件事,持有行是「门 8 清账后遗留的三枚"有消费方的待实装路由"…」那一条待办(按标题前缀寻行 —— 指针里既不写编号也不写行号:编号落在正文前 48 字符内会被台账取成本行的主键,折叠反而新增撞号)。本行摘掉编号、只留指针,不翻勾、不并抄、正文逐字保留。〕 **G-1038416. 门 8 清账后遗留的三枚"有消费方的待实装路由"(2026-09-28 登记,现读=基线仅剩 3 处)**:① `GET /api/subagents/all` —— 消费者 `apps/web/app/(main)/agent-teams/page.tsx:58`(期望 `{dispatches}` 含 completed/failed/cancelled 全量);后端只有 `/subagents/active`(仅 pending/running,形状恰好相同但语义是子集,**不得**为省事把客户端改道 active —— 那会把"页面少了历史"写成"已修")。正解 = 在 `subagent-dispatch.ts` 补 all 列表路由(带 status/limit 透传)。②③ `PUT /api/ai/n8n/workflows/:id` 与 `POST .../toggle` —— 消费者 `apps/mobile-rn/src/screens/N8nModelScreen.tsx:146/192`(保存改名/启停今天必 404);后端 n8n 面只有列表透传与创建转发(miniapp-compat-routes.ts:1123/1190),n8n REST API 本身支持 workflows/:id 更新与 activate/deactivate,正解 = 在 n8n 代理补两枚透传(SSRF 校验与 env 缺省回 stub 的既有纪律照抄)。验收判据:两枚消费者页面真机/真会话各跑一次成功路径 + 基线 `scripts/api-routes-baseline.json` 清零 + 门 8 末行现读 0。**归属**:subagent 面 = agent-teams 线;n8n 两面 = n8n 代理持有人(本票只登记形状与消费者证据,不代裁实现位置)。 〔落地@2026-09-28/枚 2704c4d27〕三枚路由已入库:subagents/all(新→旧+status/limit)、/ai/n8n/workflows 面四枚(list stub/写 503/fetch-merge-put/toggle 回读真值);apps/api/tests/g299-new-routes.test.ts 4 例绿、门 8 死调用清零、基线 perFileCount 清表。**本票未翻勾的唯一理由=验收判据第一条未跑**:RN N8nModelScreen 真机走查(本机无设备)与 agent-teams 页真会话 200 取证(需起栈)——路由与契约已证,运行时成功路径待验,不得以单测冒充真机。（编号改派留痕:本行原登记为「G-299. 门 8 清账后遗留的三枚…」,与「本机交付被远端分支保护拒收」撞成一号两事;2026-09-28 由 live-doc-edit 的取号令牌在每次 CAS 里按当下 HEAD 现算改派为 G-312,旧编号在此留原文,便于任何按旧号引用的人查得到去向,而不是让它静默消失） —— 沿革:G-299→G-312→G-334(两次都被别的登记占去,每次都在行尾留原文)。**[重复登记副本]** 同一件事在 origin 侧以「G-316. 门 8 清账后遗留的三枚…」另登过一次,当前状态持有行按那条走,本行不翻勾、不并抄。 (原编号 G-334) 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-334 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕
```

- 原 L9741(L1 外部持有行 L15758):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L9959(G-417) 同题,派单以持有行为准,本行不再单独派单。〕 G-1038464 **全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红,登记以免被"修好我看见的那三道"再掩一次** —— ① 守门 [12] 交付报告一致性判 `PROJECT_PLAN.md` 自身违规 1 处:同一份账面里既写着"完整收尾/无后续建议"一类断言,又留着"后续工作/优化项"清单(AGENTS §10 那条互斥约束)。它在全量档是 warn、不挡提交,但它是**批量审计恒红清单**里的一项,留着就会有人天天来问"这红谁的"。出路只有两条且不得放宽判据:要么把该份报告改成"任务 X 已完成、还有 N 项后续"(推荐,因为活账确实还有),要么真把后续条目清干净再声明闭环。归该份批次报告的作者;现读定位:`node scripts/check-delivery-report-consistency.mjs`。② 同日实测的并发副作用登记:多会话同时提交时(本轮实测单窗口 27–47 枚),守门 [30a] 会把**别人重写提交留下的悬空对象**算在本次提交头上、[84] 会把**别人挂在共享索引里的暂存删除**报成待判 —— 两者本轮都已按仓里规定动作处置(悬空提交 `cf05a98386` 已 `git tag lost-commit/cf05a983` 备份并复跑 30a rc=0,其内容经祖先判据确认**已在主线**,零丢失;[84] 复跑 rc=0 并把那条暂存删除点名交回其持有人)。**留这一格是因为它没有判据**:目前没有任何一道门区分"本次引入的悬空"与"并发重写留下的同内容副本",而这型一旦攒多了就是 §22 那类丢 commit 事故的温床。③ 同轮只读量测的第三格(本机**此刻不成立**,故不是待修而是待防):六把常驻命令行工具在"调用方 cwd 不在仓库内"时仍都能解析到仓库(本机 `.git` 是指针文件,git 会向上找),所以依赖 cwd 的那一处今天没有实害;但 `scripts/union-converge.mjs` 与 `scripts/git-push-converge.mjs` **写死** `C:/Program Files/Git/cmd/git.exe`,而仓里已有唯一出口 `scripts/lib/gitdir.mjs`(§5b 明写"脚本一律不得依赖环境取 git"),另一台机(G 盘那份 checkout)实测 git 落点不同 ⇒ 换机即 ENOENT。`git-push-converge.mjs` 同时是唯一不按自身位置推根的一把(换个目录跑结论会变)。**取证教训一条,写给下一个想顺手"修"的人**:我第一轮把这些工具的失败猜成"模块顶层数组引用后声明常量 ⇒ TDZ",现读**否证**(那三处在函数体内求值),真因是我自己的探针把 msys 风格路径拼成了不存在的目录 —— 0 命中/含糊错先怀疑尺子,再怀疑世界,别照假设改生产工具。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-417」,派单以那条为准,本行不再单独派单。〕 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-417 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕
```

- 原 L9743(L1 外部持有行 L7582):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7672(G-470) 同题,派单以持有行为准,本行不再单独派单。〕 G-1038470. **共享索引被整批清空后,"他人已暂存的删除"会失去保护标记,并被工作区存续自愈当成外部删除恢复**(归属:安全提交器 + 存续自愈两处持有人;等环境条件 = 需先定"意图删除"与"宿主误删"在恢复前用什么区分,不是等人拍板措辞):实测链(2026-09-28 09:13–09:17,本机=生产,多会话并发) —— 另一会话把 `apps/ai-service/tests/test_tool_approval_grant_lifetime.py` 以 `D ` 形态暂存(该文件是它当天新建、已入库的测试,`git status` 显示索引里有暂存删除);我用 §12 强制的 `node scripts/safe-commit.mjs` 提交自己的 2 个文件,其 Step ① 是 `git reset HEAD` **清空整个暂存区**(该设计的目的正是别把别人的在途内容打包进我的提交),效果是那枚暂存删除的保护标记一起没了;2 分钟后 `git-guardian` 的存续自愈判定"工作树缺该文件 ∧ 索引 blob == HEAD blob ∧ HEAD 里有它"三条成立 ⇒ 恢复磁盘副本,日志原文:`✅ 工作区存续自愈:恢复 1 个被外部删除的跟踪文件(apps/ai-service/tests/test_tool_approval_grant_lifetime.py)`。**净结果这次是好的**:恢复内容与 HEAD 逐字节同值(零独有数据、零伪造),且该测试实跑 `5 passed`(RC=0,证据 `.ihui-agent/tmp/ff-race/pytest-grant.ev`)—— 也就是说被"恢复"的是一件确实该存在的东西,而它此前那次暂存删除更像宿主清理层命中 `tests/` 整目录(AGENTS §5b 记过该型)而非有意移除。**但机制本身是反的**:存续自愈的设计前提恰恰是"他人已暂存的删除只报数、不代裁",而一次**与它无关**的第三方提交就能替那个删除摘掉标记 —— 若那枚暂存删除是有意的(例如某票按 §7 迁移测试文件),本机会话的每次提交都会把它复活,而两边账面都绿:提交方只看到"我的 2 个文件",自愈方只看到"外部删除 + 零独有数据"。**要谁做什么**:① `safe-commit.mjs` 在 `git reset HEAD` 之前把 `git diff --cached --name-status` 的现状留底,复位后**逐路径恢复 D 标记**(或至少在输出里点名"本次清空了他人的 N 项暂存删除"),让归属会话能看见而不是事后发现;② 存续自愈恢复前问一句"该路径最近是否出现过 ` D`/`D ` 形态"(reflog/索引事件),分不清就只报数。**不在本票范围**:改动别人那枚删除本身(既不支持也不阻止),以及 §7 对"删除 git 对象前先答三问"的既有纪律。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-461 · 共享索引被整批清空后」,派单以那条为准,本行不再单独派单。〕 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-461 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕
```

- 原 L9746(L1 外部持有行 L15597):

```
- [ ]〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7422(G-3) 同题,派单以持有行为准,本行不再单独派单。〕 （待派/QODER-O81）G-1038488 **守门 149(包入口 barrel 漏 re-export)对"端内 barrel"整片失明,而它漏的正是能把整站打红的形态** —— 立票凭据不是推理:web 端本机现读 HTTP 500,响应体直接点名 `Export <某组件> doesn't exist in target module`,定位到「端内 barrel 没递出该符号,而同端消费方从 barrel 具名导入」;追溯还发现该符号**曾**在 barrel 里、被一枚"撤掉整条链"的提交摘掉而组件文件保留,之后有人重新引用却没复原出口。同一天另量到一处同型候选(另一张 barrel 与它的消费方),说明这不孤立。**为什么现有门看不见**:149 的候选集按 workspace 包入口(`packages/*/src/index.ts`)枚举,端内 barrel 从来不在面里(实测其 `--json` 输出中不含任何端内 barrel 路径);而管悬空导入的那道门判的是"符号根本不存在",这型是"符号存在而入口没递出",结构上互补不重叠。**后果不是"少一个类型错"**:本仓 web 构建设了 `ignoreBuildErrors`,端内 barrel 漏出口在本地与构建两侧都不红,只有点到那个位置的人知道 —— 与守门 72/78/149 立项时同一族"本地全绿、出事的是产物"。**扩面前置(不得跳过)**:先把存量一次量清(端内 barrel 全集 × 各自消费面 × 悬空具名导入数),再决定定级 —— 存量未清就 blocking 就是与任何提交无关的恒红门,唯一结局是各会话跳钩子、连带其余全部对账作废(§12e 同型);**不得**为让本票变绿去改判据或删引用。**顺带登记一条归属纪律**:那枚造成 500 的在飞引用属他人持有面,本票只登记现象与修法方向,不代改别人的文件。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-627 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕
```

- 原 L9748(L1 外部持有行 L15674):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-29·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）**分叉合并这次"丢掉的东西"与"互相矛盾的两行文档",按归属交接,不由合并代裁**:① **丢的实现** —— `scripts/check-service-binary-paths.mjs` 与它的测试是同一票在两条分支各写一份(add/add),合并取的是 origin 那份(唯一理由:合并后的 guardian-runner 注册的是它,而只有它读 `HUSKY_SKIP_SERVICE_BINARY_PATHS`;留本侧就等于给提交链挂一条"文档写了但跑不通的出路"),本侧多出的三样探测随本次合并**没了**:服务 STATE 的 `sc query` 取法、按声明端口真应答的活性探测、nssm 输出的 UTF-16LE 解码。归该门持有人,出口是把这三样并回 origin 那份实现,不是把文件换回来。② **矛盾的两行文档** —— AGENTS.md 里现在同时留着"定级 warn / 手动问责 / 刻意不进提交链,因此无紧急跳过变量"(本侧)与"定级 warn,紧急跳过 `HUSKY_SKIP_SERVICE_BINARY_PATHS`"(origin 侧),两句对同一条门互斥;合并**没有**替谁改写谁的那一行(两条都逐字存活),拍板归两侧登记人共同做。③ 为什么这两件事不在合并里顺手修:①要动别人正在持有的门体,②要判定级属产品/治理决策 —— 合并的职责是"谁独有的谁拿走",不包括替人裁决。**等什么**:①② 各自持有人;在此之前锚点里 `G-300/G-301/G-310` 三组跨分支撞号按现读放行(见上一条),不得靠调宽锚点消红。(2026-09-28 合并时登记) (2026-09-28 二次改派:上一轮的号是按当时快照取的,合并落地后又被并发批次用掉同号 ⇒ 本次改由 live-doc-edit 在每次 CAS 里按当下 HEAD 现算,不再照快照取号。) (原编号 G-351;持有行题面「分叉合并这次"丢掉的东西"与"互相矛盾的两行文档」)〔残行摘号补齐(2026-10-09/F9 清偿批⑤):本行声明位残留的原号已按 F9 清偿批②/④让出(同族持有行的让号记录在案),本笔摘掉声明位令牌,正文除令牌外逐字未动;同题登记以「分叉合并」那一条按标题前缀寻行(不写行号),派单以持有行为准。〕
```

- 原 L9751(L1 外部持有行 L15758):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L9959(G-417) 同题,派单以持有行为准,本行不再单独派单。〕 G-1038465 **全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红,登记以免被"修好我看见的那三道"再掩一次** —— ① 守门 [12] 交付报告一致性判 `PROJECT_PLAN.md` 自身违规 1 处:同一份账面里既写着"完整收尾/无后续建议"一类断言,又留着"后续工作/优化项"清单(AGENTS §10 那条互斥约束)。它在全量档是 warn、不挡提交,但它是**批量审计恒红清单**里的一项,留着就会有人天天来问"这红谁的"。出路只有两条且不得放宽判据:要么把该份报告改成"任务 X 已完成、还有 N 项后续"(推荐,因为活账确实还有),要么真把后续条目清干净再声明闭环。归该份批次报告的作者;现读定位:`node scripts/check-delivery-report-consistency.mjs`。② 同日实测的并发副作用登记:多会话同时提交时(本轮实测单窗口 27–47 枚),守门 [30a] 会把**别人重写提交留下的悬空对象**算在本次提交头上、[84] 会把**别人挂在共享索引里的暂存删除**报成待判 —— 两者本轮都已按仓里规定动作处置(悬空提交 `cf05a98386` 已 `git tag lost-commit/cf05a983` 备份并复跑 30a rc=0,其内容经祖先判据确认**已在主线**,零丢失;[84] 复跑 rc=0 并把那条暂存删除点名交回其持有人)。**留这一格是因为它没有判据**:目前没有任何一道门区分"本次引入的悬空"与"并发重写留下的同内容副本",而这型一旦攒多了就是 §22 那类丢 commit 事故的温床。③ 同轮只读量测的第三格(本机**此刻不成立**,故不是待修而是待防):六把常驻命令行工具在"调用方 cwd 不在仓库内"时仍都能解析到仓库(本机 `.git` 是指针文件,git 会向上找),所以依赖 cwd 的那一处今天没有实害;但 `scripts/union-converge.mjs` 与 `scripts/git-push-converge.mjs` **写死** `C:/Program Files/Git/cmd/git.exe`,而仓里已有唯一出口 `scripts/lib/gitdir.mjs`(§5b 明写"脚本一律不得依赖环境取 git"),另一台机(G 盘那份 checkout)实测 git 落点不同 ⇒ 换机即 ENOENT。`git-push-converge.mjs` 同时是唯一不按自身位置推根的一把(换个目录跑结论会变)。**取证教训一条,写给下一个想顺手"修"的人**:我第一轮把这些工具的失败猜成"模块顶层数组引用后声明常量 ⇒ TDZ",现读**否证**(那三处在函数体内求值),真因是我自己的探针把 msys 风格路径拼成了不存在的目录 —— 0 命中/含糊错先怀疑尺子,再怀疑世界,别照假设改生产工具。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-417 · 全量守门盘点」,派单以那条为准,本行不再单独派单。〕 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-417 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕
```

- 原 L9753(L1 外部持有行 L15597):

```
- [ ]〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7422(G-3) 同题,派单以持有行为准,本行不再单独派单。〕 （待派/QODER-O81）G-1038489 **守门 149(包入口 barrel 漏 re-export)对"端内 barrel"整片失明,而它漏的正是能把整站打红的形态** —— 立票凭据不是推理:web 端本机现读 HTTP 500,响应体直接点名 `Export <某组件> doesn't exist in target module`,定位到「端内 barrel 没递出该符号,而同端消费方从 barrel 具名导入」;追溯还发现该符号**曾**在 barrel 里、被一枚"撤掉整条链"的提交摘掉而组件文件保留,之后有人重新引用却没复原出口。同一天另量到一处同型候选(另一张 barrel 与它的消费方),说明这不孤立。**为什么现有门看不见**:149 的候选集按 workspace 包入口(`packages/*/src/index.ts`)枚举,端内 barrel 从来不在面里(实测其 `--json` 输出中不含任何端内 barrel 路径);而管悬空导入的那道门判的是"符号根本不存在",这型是"符号存在而入口没递出",结构上互补不重叠。**后果不是"少一个类型错"**:本仓 web 构建设了 `ignoreBuildErrors`,端内 barrel 漏出口在本地与构建两侧都不红,只有点到那个位置的人知道 —— 与守门 72/78/149 立项时同一族"本地全绿、出事的是产物"。**扩面前置(不得跳过)**:先把存量一次量清(端内 barrel 全集 × 各自消费面 × 悬空具名导入数),再决定定级 —— 存量未清就 blocking 就是与任何提交无关的恒红门,唯一结局是各会话跳钩子、连带其余全部对账作废(§12e 同型);**不得**为让本票变绿去改判据或删引用。**顺带登记一条归属纪律**:那枚造成 500 的在飞引用属他人持有面,本票只登记现象与修法方向,不代改别人的文件。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-627 · 守门149」,派单以那条为准,本行不再单独派单。〕 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-627 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕
```

- 原 L9755(L1 外部持有行 L15674):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-10-07·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）**分叉合并这次"丢掉的东西"与"互相矛盾的两行文档",按归属交接,不由合并代裁**:① **丢的实现** —— `scripts/check-service-binary-paths.mjs` 与它的测试是同一票在两条分支各写一份(add/add),合并取的是 origin 那份(唯一理由:合并后的 guardian-runner 注册的是它,而只有它读 `HUSKY_SKIP_SERVICE_BINARY_PATHS`;留本侧就等于给提交链挂一条"文档写了但跑不通的出路"),本侧多出的三样探测随本次合并**没了**:服务 STATE 的 `sc query` 取法、按声明端口真应答的活性探测、nssm 输出的 UTF-16LE 解码。归该门持有人,出口是把这三样并回 origin 那份实现,不是把文件换回来。② **矛盾的两行文档** —— AGENTS.md 里现在同时留着"定级 warn / 手动问责 / 刻意不进提交链,因此无紧急跳过变量"(本侧)与"定级 warn,紧急跳过 `HUSKY_SKIP_SERVICE_BINARY_PATHS`"(origin 侧),两句对同一条门互斥;合并**没有**替谁改写谁的那一行(两条都逐字存活),拍板归两侧登记人共同做。③ 为什么这两件事不在合并里顺手修:①要动别人正在持有的门体,②要判定级属产品/治理决策 —— 合并的职责是"谁独有的谁拿走",不包括替人裁决。**等什么**:①② 各自持有人;在此之前锚点里 `G-300/G-301/G-310` 三组跨分支撞号按现读放行(见上一条),不得靠调宽锚点消红。(2026-09-28 合并时登记) (2026-09-28 二次改派:上一轮的号是按当时快照取的,合并落地后又被并发批次用掉同号 ⇒ 本次改由 live-doc-edit 在每次 CAS 里按当下 HEAD 现算,不再照快照取号。) (原编号 G-351;持有行题面「分叉合并这次"丢掉的东西"与"互相矛盾的两行文档」)〔残行摘号补齐(2026-10-09/F9 清偿批⑤):本行声明位残留的原号已按 F9 清偿批②/④让出(同族持有行的让号记录在案),本笔摘掉声明位令牌,正文除令牌外逐字未动;同题登记以「分叉合并」那一条按标题前缀寻行(不写行号),派单以持有行为准。〕
```

- 原 L9762(L1 外部持有行 L7582):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7672(G-470) 同题,派单以持有行为准,本行不再单独派单。〕 G-1038472. **共享索引被整批清空后,"他人已暂存的删除"会失去保护标记,并被工作区存续自愈当成外部删除恢复**(归属:安全提交器 + 存续自愈两处持有人;等环境条件 = 需先定"意图删除"与"宿主误删"在恢复前用什么区分,不是等人拍板措辞):实测链(2026-09-28 09:13–09:17,本机=生产,多会话并发) —— 另一会话把 `apps/ai-service/tests/test_tool_approval_grant_lifetime.py` 以 `D ` 形态暂存(该文件是它当天新建、已入库的测试,`git status` 显示索引里有暂存删除);我用 §12 强制的 `node scripts/safe-commit.mjs` 提交自己的 2 个文件,其 Step ① 是 `git reset HEAD` **清空整个暂存区**(该设计的目的正是别把别人的在途内容打包进我的提交),效果是那枚暂存删除的保护标记一起没了;2 分钟后 `git-guardian` 的存续自愈判定"工作树缺该文件 ∧ 索引 blob == HEAD blob ∧ HEAD 里有它"三条成立 ⇒ 恢复磁盘副本,日志原文:`✅ 工作区存续自愈:恢复 1 个被外部删除的跟踪文件(apps/ai-service/tests/test_tool_approval_grant_lifetime.py)`。**净结果这次是好的**:恢复内容与 HEAD 逐字节同值(零独有数据、零伪造),且该测试实跑 `5 passed`(RC=0,证据 `.ihui-agent/tmp/ff-race/pytest-grant.ev`)—— 也就是说被"恢复"的是一件确实该存在的东西,而它此前那次暂存删除更像宿主清理层命中 `tests/` 整目录(AGENTS §5b 记过该型)而非有意移除。**但机制本身是反的**:存续自愈的设计前提恰恰是"他人已暂存的删除只报数、不代裁",而一次**与它无关**的第三方提交就能替那个删除摘掉标记 —— 若那枚暂存删除是有意的(例如某票按 §7 迁移测试文件),本机会话的每次提交都会把它复活,而两边账面都绿:提交方只看到"我的 2 个文件",自愈方只看到"外部删除 + 零独有数据"。**要谁做什么**:① `safe-commit.mjs` 在 `git reset HEAD` 之前把 `git diff --cached --name-status` 的现状留底,复位后**逐路径恢复 D 标记**(或至少在输出里点名"本次清空了他人的 N 项暂存删除"),让归属会话能看见而不是事后发现;② 存续自愈恢复前问一句"该路径最近是否出现过 ` D`/`D ` 形态"(reflog/索引事件),分不清就只报数。**不在本票范围**:改动别人那枚删除本身(既不支持也不阻止),以及 §7 对"删除 git 对象前先答三问"的既有纪律。 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-461 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕
```

- 原 L9764(L1 外部持有行 L15871):

```
- [ ] G-67. 流式中切换模型 → 终止后自动带入新模型 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「68 · 流式中切换模型→终止后自动带入新模型」,派单以那条为准,本行不再单独派单。〕 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 68 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。指针副本族两行自述「派单以那条为准,本行不再单独派单」,按批②同款特例整族让号,原号留归注记所指的干净持有行。〕 〔改号(2026-10-14):原G-1038410〕
```

- 原 L9765(L1 外部持有行 L15859):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L6964(G-208) 同题,派单以持有行为准,本行不再单独派单。〕 **G-1038461. 生产备份链日志的写入侧编码要改成 UTF-8(2026-09-28 逐行 strict-UTF-8 现读登记)**:`D:\DevEnv\logs\pg-backup-scheduler.log` 自 **L571(2026-09-09 00:58:12,字节偏移 25,709)起由 UTF-8 切成 GBK 并持续至今**(前 570 行 520 行中文正常 / 之后 360 行非 UTF-8,0 个 `U+FFFD` ⇒ GBK 侧可无损还原)。**同批纠一处台账失实**:`scripts/alert-volume-report.mjs` 头注把"GBK/UTF-8 混合"记在 `deploy-loop.log` 头上,而该文件实测**整档是合法 UTF-8** —— 坏的是 09-24→09-28 那段已烘死的 475,314 个 `U+FFFD`(行 120,624–257,864,子进程管道阶段就把非 ASCII 字节换成替换字符,**原字节不可回收**);该处文案已按现读改写(规矩"只用 ASCII 判据"一字未动,改的是它给的错误机理 —— 按旧文案下一个人会去修解码器,而解码器没有坏)。**为什么现在不当场做(等环境条件,不是等人拍板)**:改法是 `deploy/win/ihui-pg-backup.ps1` 顶部加一条进程级`[Console]::OutputEncoding = UTF8` 并同笔把 `deploy/prod-bundle/` 那两份运行副本改成逐字节等值(由 prod-bundle 影子对账门判等),调度器每轮用 `&` 从磁盘重读子脚本 ⇒ 不必重启服务、下一轮 03:00 起生效;但它落在**生产备份链实际执行的那份文件**上,而"改转发壳后重启曾让 `pg_dump` 挂 3.5 分钟"那次至今没解释清(本轮另测近 5 轮各 8–15 秒,挂起不可复现)——在解释清之前不动生产备份,这条规矩自 2026-09-24 起就写在案。**归属**:生产备份链持有人。**验收判据(必须"改完且跑过")**:新增行的 strict-UTF-8 解码 non-UTF-8 计数 = 0;历史 GBK 段不做改写(对已入库运行态日志做转换属另一类动作)。**顺带一格(不单独开票)**:`IHUI-DEPLOYLOOP` 的守护半在 09-26 11:09 起就驻留旧脚本,其 catch 支管道仍按旧编码写,全档该支触发 0 次 ⇒ 零观测损伤,并入既有低峰重启窗口即可。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-385 · 生产备份链日志的写入侧编码要改成UTF-8」,派单以那条为准,本行不再单独派单。〕 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-385 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。本键让号侧(生产备份链 strict-UTF-8 登记族)含最早正主登记(2026-09-28),与批②披露一致:A1 改道族 16 行(含裸登记行)按最大纯登记族规则持有;时间线倒挂属分叉取号竞态,非抢号。〕
```

- 原 L9766(L1 外部持有行 L15758):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L9959(G-417) 同题,派单以持有行为准,本行不再单独派单。〕 G-1038467 **全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红,登记以免被"修好我看见的那三道"再掩一次** —— ① 守门 [12] 交付报告一致性判 `PROJECT_PLAN.md` 自身违规 1 处:同一份账面里既写着"完整收尾/无后续建议"一类断言,又留着"后续工作/优化项"清单(AGENTS §10 那条互斥约束)。它在全量档是 warn、不挡提交,但它是**批量审计恒红清单**里的一项,留着就会有人天天来问"这红谁的"。出路只有两条且不得放宽判据:要么把该份报告改成"任务 X 已完成、还有 N 项后续"(推荐,因为活账确实还有),要么真把后续条目清干净再声明闭环。归该份批次报告的作者;现读定位:`node scripts/check-delivery-report-consistency.mjs`。② 同日实测的并发副作用登记:多会话同时提交时(本轮实测单窗口 27–47 枚),守门 [30a] 会把**别人重写提交留下的悬空对象**算在本次提交头上、[84] 会把**别人挂在共享索引里的暂存删除**报成待判 —— 两者本轮都已按仓里规定动作处置(悬空提交 `cf05a98386` 已 `git tag lost-commit/cf05a983` 备份并复跑 30a rc=0,其内容经祖先判据确认**已在主线**,零丢失;[84] 复跑 rc=0 并把那条暂存删除点名交回其持有人)。**留这一格是因为它没有判据**:目前没有任何一道门区分"本次引入的悬空"与"并发重写留下的同内容副本",而这型一旦攒多了就是 §22 那类丢 commit 事故的温床。③ 同轮只读量测的第三格(本机**此刻不成立**,故不是待修而是待防):六把常驻命令行工具在"调用方 cwd 不在仓库内"时仍都能解析到仓库(本机 `.git` 是指针文件,git 会向上找),所以依赖 cwd 的那一处今天没有实害;但 `scripts/union-converge.mjs` 与 `scripts/git-push-converge.mjs` **写死** `C:/Program Files/Git/cmd/git.exe`,而仓里已有唯一出口 `scripts/lib/gitdir.mjs`(§5b 明写"脚本一律不得依赖环境取 git"),另一台机(G 盘那份 checkout)实测 git 落点不同 ⇒ 换机即 ENOENT。`git-push-converge.mjs` 同时是唯一不按自身位置推根的一把(换个目录跑结论会变)。**取证教训一条,写给下一个想顺手"修"的人**:我第一轮把这些工具的失败猜成"模块顶层数组引用后声明常量 ⇒ TDZ",现读**否证**(那三处在函数体内求值),真因是我自己的探针把 msys 风格路径拼成了不存在的目录 —— 0 命中/含糊错先怀疑尺子,再怀疑世界,别照假设改生产工具。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-417 · 全量守门盘点」,派单以那条为准,本行不再单独派单。〕 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-417 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕
```

- 原 L9768(L1 外部持有行 L7582):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7672(G-470) 同题,派单以持有行为准,本行不再单独派单。〕 G-1038473. **共享索引被整批清空后,"他人已暂存的删除"会失去保护标记,并被工作区存续自愈当成外部删除恢复**(归属:安全提交器 + 存续自愈两处持有人;等环境条件 = 需先定"意图删除"与"宿主误删"在恢复前用什么区分,不是等人拍板措辞):实测链(2026-09-28 09:13–09:17,本机=生产,多会话并发) —— 另一会话把 `apps/ai-service/tests/test_tool_approval_grant_lifetime.py` 以 `D ` 形态暂存(该文件是它当天新建、已入库的测试,`git status` 显示索引里有暂存删除);我用 §12 强制的 `node scripts/safe-commit.mjs` 提交自己的 2 个文件,其 Step ① 是 `git reset HEAD` **清空整个暂存区**(该设计的目的正是别把别人的在途内容打包进我的提交),效果是那枚暂存删除的保护标记一起没了;2 分钟后 `git-guardian` 的存续自愈判定"工作树缺该文件 ∧ 索引 blob == HEAD blob ∧ HEAD 里有它"三条成立 ⇒ 恢复磁盘副本,日志原文:`✅ 工作区存续自愈:恢复 1 个被外部删除的跟踪文件(apps/ai-service/tests/test_tool_approval_grant_lifetime.py)`。**净结果这次是好的**:恢复内容与 HEAD 逐字节同值(零独有数据、零伪造),且该测试实跑 `5 passed`(RC=0,证据 `.ihui-agent/tmp/ff-race/pytest-grant.ev`)—— 也就是说被"恢复"的是一件确实该存在的东西,而它此前那次暂存删除更像宿主清理层命中 `tests/` 整目录(AGENTS §5b 记过该型)而非有意移除。**但机制本身是反的**:存续自愈的设计前提恰恰是"他人已暂存的删除只报数、不代裁",而一次**与它无关**的第三方提交就能替那个删除摘掉标记 —— 若那枚暂存删除是有意的(例如某票按 §7 迁移测试文件),本机会话的每次提交都会把它复活,而两边账面都绿:提交方只看到"我的 2 个文件",自愈方只看到"外部删除 + 零独有数据"。**要谁做什么**:① `safe-commit.mjs` 在 `git reset HEAD` 之前把 `git diff --cached --name-status` 的现状留底,复位后**逐路径恢复 D 标记**(或至少在输出里点名"本次清空了他人的 N 项暂存删除"),让归属会话能看见而不是事后发现;② 存续自愈恢复前问一句"该路径最近是否出现过 ` D`/`D ` 形态"(reflog/索引事件),分不清就只报数。**不在本票范围**:改动别人那枚删除本身(既不支持也不阻止),以及 §7 对"删除 git 对象前先答三问"的既有纪律。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-461 · 共享索引被整批清空后」,派单以那条为准,本行不再单独派单。〕 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-461 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕
```

- 原 L9770(L1 外部持有行 L15859):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L6964(G-208) 同题,派单以持有行为准,本行不再单独派单。〕 **G-1038462. 生产备份链日志的写入侧编码要改成 UTF-8(2026-09-28 逐行 strict-UTF-8 现读登记)**:`D:\DevEnv\logs\pg-backup-scheduler.log` 自 **L571(2026-09-09 00:58:12,字节偏移 25,709)起由 UTF-8 切成 GBK 并持续至今**(前 570 行 520 行中文正常 / 之后 360 行非 UTF-8,0 个 `U+FFFD` ⇒ GBK 侧可无损还原)。**同批纠一处台账失实**:`scripts/alert-volume-report.mjs` 头注把"GBK/UTF-8 混合"记在 `deploy-loop.log` 头上,而该文件实测**整档是合法 UTF-8** —— 坏的是 09-24→09-28 那段已烘死的 475,314 个 `U+FFFD`(行 120,624–257,864,子进程管道阶段就把非 ASCII 字节换成替换字符,**原字节不可回收**);该处文案已按现读改写(规矩"只用 ASCII 判据"一字未动,改的是它给的错误机理 —— 按旧文案下一个人会去修解码器,而解码器没有坏)。**为什么现在不当场做(等环境条件,不是等人拍板)**:改法是 `deploy/win/ihui-pg-backup.ps1` 顶部加一条进程级`[Console]::OutputEncoding = UTF8` 并同笔把 `deploy/prod-bundle/` 那两份运行副本改成逐字节等值(由 prod-bundle 影子对账门判等),调度器每轮用 `&` 从磁盘重读子脚本 ⇒ 不必重启服务、下一轮 03:00 起生效;但它落在**生产备份链实际执行的那份文件**上,而"改转发壳后重启曾让 `pg_dump` 挂 3.5 分钟"那次至今没解释清(本轮另测近 5 轮各 8–15 秒,挂起不可复现)——在解释清之前不动生产备份,这条规矩自 2026-09-24 起就写在案。**归属**:生产备份链持有人。**验收判据(必须"改完且跑过")**:新增行的 strict-UTF-8 解码 non-UTF-8 计数 = 0;历史 GBK 段不做改写(对已入库运行态日志做转换属另一类动作)。**顺带一格(不单独开票)**:`IHUI-DEPLOYLOOP` 的守护半在 09-26 11:09 起就驻留旧脚本,其 catch 支管道仍按旧编码写,全档该支触发 0 次 ⇒ 零观测损伤,并入既有低峰重启窗口即可。 〔【归并】重复登记副本(2026-10-01):同主键的另一条登记 「G-385 · 生产备份链日志的写入侧编码要改成UTF-8」,派单以那条为准,本行不再单独派单。〕 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-385 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。本键让号侧(生产备份链 strict-UTF-8 登记族)含最早正主登记(2026-09-28),与批②披露一致:A1 改道族 16 行(含裸登记行)按最大纯登记族规则持有;时间线倒挂属分叉取号竞态,非抢号。〕
```

- 原 L9772(L1 外部持有行 L15751):

```
- [ ]【【归并】重复登记副本·双前缀畸形号(2026-09-28):行首那个号是改派工具把前缀又贴一次造出来的,尺子按它取不出主键,于是同一件事被算成两个标题;这份是并集重放带回的折叠前形态。同题登记的持有行是「A7+A8+A9三格"尺子盲区"可立即修，逐条一票——消费投影开放映」那一条(按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。】 **A7+A8+A9 三格"尺子盲区"（可立即修，逐条一票）** —— 消费投影开放映射、LineIcon 调用点值→键零看守、行统计 6 处各算且已量到两处真漂移。
```

- 原 L9774(L1 外部持有行 L15752):

```
- [ ] （【归并】重复登记副本·同号不同题·2026-09-29·本行与同编号的持有行是同一件事的两次登记,现摘掉编号只留指针,不翻勾、正文逐字保留,派单以持有行为准）**活动时钟必须单调且"维护性写入只拥有自己的列"**(可立即修;归属:ai-service 会话存储 + cli 会话状态层持有人=本线) —— 上游 `.../storage/session-store/repositories/sessions.ts:131` `time_updated = max(time_updated, ?)`、`:290`、`:339-343` `touchSession`,设计理由在 `:130`、`:285-286`:路径自愈曾复用全字段 update,把读快照的旧值压到并发新值上。我方现状(主会话已独立复跑):`git show HEAD:apps/ai-service/app/services/session_store.py | grep -cE "updated_at = \?"` = **8**(:803/820/862/975/1011/1064/1144/1317 全是裸赋值),`grep -cE "max\(updated_at"` = **0**;CLI 侧 `git show HEAD:apps/cli/src/sessions/state-store.ts | grep -cE "lock|cas|expected|version"` = **0**,而 `saveSession` 是整文件覆盖写、仓内 58 个调用点(repl.ts:967/995/1025/1326/1408/1460/1500/1536、acp/server.ts:712/729/787、agent.ts:2720)。落点:`state-store.ts` 把 `saveSession` 拆成 `patchSession(id, ownedFields, expected?)`(列所有权 + 单调 `updatedAt`),`session_store.py` 8 处改 `updated_at = max(updated_at, ?)`。验收:`git show HEAD:apps/ai-service/app/services/session_store.py | grep -c "updated_at = max(updated_at"` = 8 且裸赋值 = 0;`git show HEAD:apps/cli/src/sessions/state-store.ts | grep -c "writeFileSync(p, JSON.stringify(state"` = 0。爆炸半径:中—大(`idx_threads_updated` :460 与 `ORDER BY updated_at DESC` :933/:1615 的分页都吃这个键),SQL 表达式级不动 schema,可逐点灰度。 (原编号 G-820;持有行题面「活动时钟必须单调且"维护性写入只拥有自己的列"—」)
```

- 原 L9809(L1 外部持有行 L15675):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）**分叉合并把 12 个"首行相同、正文已漂移"的重复登记块并到了一起(台账锚点 F4b 由两侧各自的 0 抬到 12),这不是存量欠账,是合并自己造出来的形态**:机制 —— 同一段多行登记被两条分支各自抄走后又各改了正文,行级判据(F1/F2/F4)按"编号 + 标题前缀逐字等值"配对,配不上这种"块级同、行内漂";而 union 的行重数策略对每一行都只"补对侧净增",于是两份漂移副本都活了下来。出口只有 `node scripts/plan-tasks-merge.mjs --dedupe-blocks` 的**报告档**(先不带 --commit 出清单),它**只删逐字相同的第 2..N 份**,**漂移副本一份都不动** —— 机器折半即有损,所以那 12 块必须逐块人工判"哪一份是当前状态",判完就地改写或翻勾并写明归并到谁(§1 第 2 条)。**等什么**:逐块裁决要读两条分支各自的上下文,不由合并代裁;在此之前 F4b=12 只是现读锚点,不得被读成"已修"。(2026-09-28 合并时登记,现值一律跑 `node scripts/plan-tasks.mjs --gate --json` 看末行) (原编号 G-351;持有行题面「分叉合并把12个"首行相同」)〔残行摘号补齐(2026-10-09/F9 清偿批⑤):本行声明位残留的原号已按 F9 清偿批②/④让出(同族持有行的让号记录在案),本笔摘掉声明位令牌,正文除令牌外逐字未动;同题登记以「分叉合并」那一条按标题前缀寻行(不写行号),派单以持有行为准。〕
```

- 原 L9811(L1 外部持有行 L15675):

```
- [ ]〔【归并】重复登记副本(2026-09-28,幂等折叠):这一行与同题的持有行是同一件事,持有行是「分叉合并把 12 个"首行相同、正文已漂移"…」那一条待办(按标题前缀寻行;指针里既不写编号也不写行号 —— 写了编号就会被台账取成这条副本自己的主键,折叠反而新增撞号,这是今天实测到的成因)。本行摘掉编号、只留指针,不翻勾、不并抄、正文逐字保留。〕 **分叉合并把 12 个"首行相同、正文已漂移"的重复登记块并到了一起(台账锚点 F4b 由两侧各自的 0 抬到 12),这不是存量欠账,是合并自己造出来的形态**:机制 —— 同一段多行登记被两条分支各自抄走后又各改了正文,行级判据(F1/F2/F4)按"编号 + 标题前缀逐字等值"配对,配不上这种"块级同、行内漂";而 union 的行重数策略对每一行都只"补对侧净增",于是两份漂移副本都活了下来。出口只有 `node scripts/plan-tasks-merge.mjs --dedupe-blocks` 的**报告档**(先不带 --commit 出清单),它**只删逐字相同的第 2..N 份**,**漂移副本一份都不动** —— 机器折半即有损,所以那 12 块必须逐块人工判"哪一份是当前状态",判完就地改写或翻勾并写明归并到谁(§1 第 2 条)。**等什么**:逐块裁决要读两条分支各自的上下文,不由合并代裁;在此之前 F4b=12 只是现读锚点,不得被读成"已修"。(2026-09-28 合并时登记,现值一律跑 `node scripts/plan-tasks.mjs --gate --json` 看末行) (原编号 G-351)〔残行摘号补齐(2026-10-09/F9 清偿批⑤):本行声明位残留的原号已按 F9 清偿批②/④让出(同族持有行的让号记录在案),本笔摘掉声明位令牌,正文除令牌外逐字未动;同题登记以「分叉合并」那一条按标题前缀寻行(不写行号),派单以持有行为准。〕
```

- 原 L9812(L1 外部持有行 L15675):

```
- [ ]〔【归并】重复登记副本(2026-09-28,幂等折叠):这一行与同题的持有行是同一件事,持有行是「分叉合并把 12 个"首行相同、正文已漂移"…」那一条待办(按标题前缀寻行 —— 指针里既不写编号也不写行号:编号落在正文前 48 字符内会被台账取成本行的主键,折叠反而新增撞号)。本行摘掉编号、只留指针,不翻勾、不并抄、正文逐字保留。〕 **分叉合并把 12 个"首行相同、正文已漂移"的重复登记块并到了一起(台账锚点 F4b 由两侧各自的 0 抬到 12),这不是存量欠账,是合并自己造出来的形态**:机制 —— 同一段多行登记被两条分支各自抄走后又各改了正文,行级判据(F1/F2/F4)按"编号 + 标题前缀逐字等值"配对,配不上这种"块级同、行内漂";而 union 的行重数策略对每一行都只"补对侧净增",于是两份漂移副本都活了下来。出口只有 `node scripts/plan-tasks-merge.mjs --dedupe-blocks` 的**报告档**(先不带 --commit 出清单),它**只删逐字相同的第 2..N 份**,**漂移副本一份都不动** —— 机器折半即有损,所以那 12 块必须逐块人工判"哪一份是当前状态",判完就地改写或翻勾并写明归并到谁(§1 第 2 条)。**等什么**:逐块裁决要读两条分支各自的上下文,不由合并代裁;在此之前 F4b=12 只是现读锚点,不得被读成"已修"。(2026-09-28 合并时登记,现值一律跑 `node scripts/plan-tasks.mjs --gate --json` 看末行) (原编号 G-351)〔残行摘号补齐(2026-10-09/F9 清偿批⑤):本行声明位残留的原号已按 F9 清偿批②/④让出(同族持有行的让号记录在案),本笔摘掉声明位令牌,正文除令牌外逐字未动;同题登记以「分叉合并」那一条按标题前缀寻行(不写行号),派单以持有行为准。〕
```

- 原 L9815(L1 外部持有行 L15672):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）**门 8 清账后遗留的三枚"有消费方的待实装路由"(2026-09-28 登记,现读=基线仅剩 3 处)**:① `GET /api/subagents/all` —— 消费者 `apps/web/app/(main)/agent-teams/page.tsx:58`(期望 `{dispatches}` 含 completed/failed/cancelled 全量);后端只有 `/subagents/active`(仅 pending/running,形状恰好相同但语义是子集,**不得**为省事把客户端改道 active —— 那会把"页面少了历史"写成"已修")。正解 = 在 `subagent-dispatch.ts` 补 all 列表路由(带 status/limit 透传)。②③ `PUT /api/ai/n8n/workflows/:id` 与 `POST .../toggle` —— 消费者 `apps/mobile-rn/src/screens/N8nModelScreen.tsx:146/192`(保存改名/启停今天必 404);后端 n8n 面只有列表透传与创建转发(miniapp-compat-routes.ts:1123/1190),n8n REST API 本身支持 workflows/:id 更新与 activate/deactivate,正解 = 在 n8n 代理补两枚透传(SSRF 校验与 env 缺省回 stub 的既有纪律照抄)。验收判据:两枚消费者页面真机/真会话各跑一次成功路径 + 基线 `scripts/api-routes-baseline.json` 清零 + 门 8 末行现读 0。**归属**:subagent 面 = agent-teams 线;n8n 两面 = n8n 代理持有人(本票只登记形状与消费者证据,不代裁实现位置)。 〔落地@2026-09-28/枚 2704c4d27〕三枚路由已入库:subagents/all(新→旧+status/limit)、/ai/n8n/workflows 面四枚(list stub/写 503/fetch-merge-put/toggle 回读真值);apps/api/tests/g299-new-routes.test.ts 4 例绿、门 8 死调用清零、基线 perFileCount 清表。**本票未翻勾的唯一理由=验收判据第一条未跑**:RN N8nModelScreen 真机走查(本机无设备)与 agent-teams 页真会话 200 取证(需起栈)——路由与契约已证,运行时成功路径待验,不得以单测冒充真机。（编号改派留痕:本行原登记为「G-299. 门 8 清账后遗留的三枚…」,与「本机交付被远端分支保护拒收」撞成一号两事;2026-09-28 由 live-doc-edit 的取号令牌在每次 CAS 里按当下 HEAD 现算改派为 G-312,旧编号在此留原文,便于任何按旧号引用的人查得到去向,而不是让它静默消失） —— 沿革:G-299→G-312→G-334(两次都被别的登记占去,每次都在行尾留原文)。**[重复登记副本]** 同一件事在 origin 侧以「G-316. 门 8 清账后遗留的三枚…」另登过一次,当前状态持有行按那条走,本行不翻勾、不并抄。 (原编号 G-334;持有行题面「门8清账后遗留的三枚"有消费方的待实装路由"」)
```

- 原 L9817(L1 外部持有行 L15756):

```
- [ ]〔【归并】重复登记副本(2026-09-28,幂等折叠):这一行与同题的持有行是同一件事,持有行是「分叉合并带进来的三组跨分支撞号…」那一条待办(按标题前缀寻行;指针里既不写编号也不写行号 —— 写了编号就会被台账取成这条副本自己的主键,折叠反而新增撞号,这是今天实测到的成因)。本行摘掉编号、只留指针,不翻勾、不并抄、正文逐字保留。〕 **G-350. 分叉合并带进来的三组跨分支撞号(G-300 / G-301 / G-310),锚点已按现读收下,清偿不在这张票里**:机制不是"没查号" —— 两条分支各自在**自己那侧的当下 HEAD** 取过号、都没撞,合到同一份账面才第一次相遇(取号发生在分叉的两条腿上,号段并不共享)。判红条件"锚点里没有的键"必须现读放行,否则这枚合并自己就是一台恒红门;但**放行不等于已修**。归谁:各该票的持有人(由 origin 侧登记的哪一路会话持有)。等什么:该票持有人把自己那一侧改派成新号并在行尾留沿革,改派后跑 `node scripts/plan-tasks.mjs --update-baseline` 收窄锚点 —— 只许收窄,所以这一步天然把"顺手把锚调宽"堵在外面。(2026-09-28 合并时登记,现读见当次 --gate --json 的 collisions 数组) (2026-09-28 二次改派:上一轮的号是按当时快照取的,合并落地后又被并发批次用掉同号 ⇒ 本次改由 live-doc-edit 在每次 CAS 里按当下 HEAD 现算,不再照快照取号。) (原编号 G-350)
```

- 原 L9819(L1 外部持有行 L15756):

```
- [ ]〔【归并】重复登记副本(2026-09-28,幂等折叠):这一行与同题的持有行是同一件事,持有行是「分叉合并带进来的三组跨分支撞号…」那一条待办(按标题前缀寻行 —— 指针里既不写编号也不写行号:编号落在正文前 48 字符内会被台账取成本行的主键,折叠反而新增撞号)。本行摘掉编号、只留指针,不翻勾、不并抄、正文逐字保留。〕 **G-350. 分叉合并带进来的三组跨分支撞号(G-300 / G-301 / G-310),锚点已按现读收下,清偿不在这张票里**:机制不是"没查号" —— 两条分支各自在**自己那侧的当下 HEAD** 取过号、都没撞,合到同一份账面才第一次相遇(取号发生在分叉的两条腿上,号段并不共享)。判红条件"锚点里没有的键"必须现读放行,否则这枚合并自己就是一台恒红门;但**放行不等于已修**。归谁:各该票的持有人(由 origin 侧登记的哪一路会话持有)。等什么:该票持有人把自己那一侧改派成新号并在行尾留沿革,改派后跑 `node scripts/plan-tasks.mjs --update-baseline` 收窄锚点 —— 只许收窄,所以这一步天然把"顺手把锚调宽"堵在外面。(2026-09-28 合并时登记,现读见当次 --gate --json 的 collisions 数组) (2026-09-28 二次改派:上一轮的号是按当时快照取的,合并落地后又被并发批次用掉同号 ⇒ 本次改由 live-doc-edit 在每次 CAS 里按当下 HEAD 现算,不再照快照取号。) (原编号 G-350)
```

- 原 L9821(L1 外部持有行 L15579):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-432 **MemberCard 把"没量到"显示成 0(第八轮对照逼出;归属:web 首页持有者;等 §17 运行时自验排期)** —— `apps/web/src/components/home/MemberCard.tsx:72-73` 现读 `stats?.points ?? 0` / `wallet?.balance ?? 0`,查询未回或失败时显示"0 分""0 余额"。上游同族口径是"订阅未知不能发布为成功空快照"(`packages/services/src/usage-stats/providers/bigmodelUsageQuotaProvider.ts:259` 原文)加展示层 `'--'` 占位。**为什么还开着**:属 UI 改动,§17 要求起 dev + 读 DOM 数值自验,本票未做该项;改法是 `number | null` + 占位,不动判据、无恒红风险。**这一条不是"抄上游功能",是把"未知"与"为零"分开** —— 后者是数据事故,前者是显示诚实。 (原行首编号 G-G-355 系改派工具把前缀重复贴了一次:尺子会把它读成 G-355 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4/F10 —— 现取新号,正文逐字未动) (原编号 G-432;持有行题面「MemberCard把"没量到"显示成0」)
```

- 原 L9823(L1 外部持有行 L7582):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-09):本行声明位残留的原号已让出(见同族持有行让号记录),本行摘掉令牌、正文逐字保留、不翻勾、不并抄;同题登记以「共享索引被整批清空后」那一条按标题前缀寻行(不写行号)。〕 **共享索引被整批清空后,"他人已暂存的删除"会失去保护标记,并被工作区存续自愈当成外部删除恢复**(归属:安全提交器 + 存续自愈两处持有人;等环境条件 = 需先定"意图删除"与"宿主误删"在恢复前用什么区分,不是等人拍板措辞):实测链(2026-09-28 09:13–09:17,本机=生产,多会话并发) —— 另一会话把 `apps/ai-service/tests/test_tool_approval_grant_lifetime.py` 以 `D ` 形态暂存(该文件是它当天新建、已入库的测试,`git status` 显示索引里有暂存删除);我用 §12 强制的 `node scripts/safe-commit.mjs` 提交自己的 2 个文件,其 Step ① 是 `git reset HEAD` **清空整个暂存区**(该设计的目的正是别把别人的在途内容打包进我的提交),效果是那枚暂存删除的保护标记一起没了;2 分钟后 `git-guardian` 的存续自愈判定"工作树缺该文件 ∧ 索引 blob == HEAD blob ∧ HEAD 里有它"三条成立 ⇒ 恢复磁盘副本,日志原文:`✅ 工作区存续自愈:恢复 1 个被外部删除的跟踪文件(apps/ai-service/tests/test_tool_approval_grant_lifetime.py)`。**净结果这次是好的**:恢复内容与 HEAD 逐字节同值(零独有数据、零伪造),且该测试实跑 `5 passed`(RC=0,证据 `.ihui-agent/tmp/ff-race/pytest-grant.ev`)—— 也就是说被"恢复"的是一件确实该存在的东西,而它此前那次暂存删除更像宿主清理层命中 `tests/` 整目录(AGENTS §5b 记过该型)而非有意移除。**但机制本身是反的**:存续自愈的设计前提恰恰是"他人已暂存的删除只报数、不代裁",而一次**与它无关**的第三方提交就能替那个删除摘掉标记 —— 若那枚暂存删除是有意的(例如某票按 §7 迁移测试文件),本机会话的每次提交都会把它复活,而两边账面都绿:提交方只看到"我的 2 个文件",自愈方只看到"外部删除 + 零独有数据"。**要谁做什么**:① `safe-commit.mjs` 在 `git reset HEAD` 之前把 `git diff --cached --name-status` 的现状留底,复位后**逐路径恢复 D 标记**(或至少在输出里点名"本次清空了他人的 N 项暂存删除"),让归属会话能看见而不是事后发现;② 存续自愈恢复前问一句"该路径最近是否出现过 ` D`/`D ` 形态"(reflog/索引事件),分不清就只报数。**不在本票范围**:改动别人那枚删除本身(既不支持也不阻止),以及 §7 对"删除 git 对象前先答三问"的既有纪律。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-461 · 共享索引被整批清空后」,派单以那条为准,本行不再单独派单。〕
```

- 原 L9824(L1 外部持有行 L7582):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）**共享索引被整批清空后,"他人已暂存的删除"会失去保护标记,并被工作区存续自愈当成外部删除恢复**(归属:安全提交器 + 存续自愈两处持有人;等环境条件 = 需先定"意图删除"与"宿主误删"在恢复前用什么区分,不是等人拍板措辞):实测链(2026-09-28 09:13–09:17,本机=生产,多会话并发) —— 另一会话把 `apps/ai-service/tests/test_tool_approval_grant_lifetime.py` 以 `D ` 形态暂存(该文件是它当天新建、已入库的测试,`git status` 显示索引里有暂存删除);我用 §12 强制的 `node scripts/safe-commit.mjs` 提交自己的 2 个文件,其 Step ① 是 `git reset HEAD` **清空整个暂存区**(该设计的目的正是别把别人的在途内容打包进我的提交),效果是那枚暂存删除的保护标记一起没了;2 分钟后 `git-guardian` 的存续自愈判定"工作树缺该文件 ∧ 索引 blob == HEAD blob ∧ HEAD 里有它"三条成立 ⇒ 恢复磁盘副本,日志原文:`✅ 工作区存续自愈:恢复 1 个被外部删除的跟踪文件(apps/ai-service/tests/test_tool_approval_grant_lifetime.py)`。**净结果这次是好的**:恢复内容与 HEAD 逐字节同值(零独有数据、零伪造),且该测试实跑 `5 passed`(RC=0,证据 `.ihui-agent/tmp/ff-race/pytest-grant.ev`)—— 也就是说被"恢复"的是一件确实该存在的东西,而它此前那次暂存删除更像宿主清理层命中 `tests/` 整目录(AGENTS §5b 记过该型)而非有意移除。**但机制本身是反的**:存续自愈的设计前提恰恰是"他人已暂存的删除只报数、不代裁",而一次**与它无关**的第三方提交就能替那个删除摘掉标记 —— 若那枚暂存删除是有意的(例如某票按 §7 迁移测试文件),本机会话的每次提交都会把它复活,而两边账面都绿:提交方只看到"我的 2 个文件",自愈方只看到"外部删除 + 零独有数据"。**要谁做什么**:① `safe-commit.mjs` 在 `git reset HEAD` 之前把 `git diff --cached --name-status` 的现状留底,复位后**逐路径恢复 D 标记**(或至少在输出里点名"本次清空了他人的 N 项暂存删除"),让归属会话能看见而不是事后发现;② 存续自愈恢复前问一句"该路径最近是否出现过 ` D`/`D ` 形态"(reflog/索引事件),分不清就只报数。**不在本票范围**:改动别人那枚删除本身(既不支持也不阻止),以及 §7 对"删除 git 对象前先答三问"的既有纪律。 (原编号 G-461;持有行题面「共享索引被整批清空后」)
```

- 原 L9825(L1 外部持有行 L15597):

```
- [ ]〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7422(G-3) 同题,派单以持有行为准,本行不再单独派单。〕 （待派/QODER-O81）**守门 149(包入口 barrel 漏 re-export)对"端内 barrel"整片失明,而它漏的正是能把整站打红的形态** —— 立票凭据不是推理:web 端本机现读 HTTP 500,响应体直接点名 `Export <某组件> doesn't exist in target module`,定位到「端内 barrel 没递出该符号,而同端消费方从 barrel 具名导入」;追溯还发现该符号**曾**在 barrel 里、被一枚"撤掉整条链"的提交摘掉而组件文件保留,之后有人重新引用却没复原出口。同一天另量到一处同型候选(另一张 barrel 与它的消费方),说明这不孤立。**为什么现有门看不见**:149 的候选集按 workspace 包入口(`packages/*/src/index.ts`)枚举,端内 barrel 从来不在面里(实测其 `--json` 输出中不含任何端内 barrel 路径);而管悬空导入的那道门判的是"符号根本不存在",这型是"符号存在而入口没递出",结构上互补不重叠。**后果不是"少一个类型错"**:本仓 web 构建设了 `ignoreBuildErrors`,端内 barrel 漏出口在本地与构建两侧都不红,只有点到那个位置的人知道 —— 与守门 72/78/149 立项时同一族"本地全绿、出事的是产物"。**扩面前置(不得跳过)**:先把存量一次量清(端内 barrel 全集 × 各自消费面 × 悬空具名导入数),再决定定级 —— 存量未清就 blocking 就是与任何提交无关的恒红门,唯一结局是各会话跳钩子、连带其余全部对账作废(§12e 同型);**不得**为让本票变绿去改判据或删引用。**顺带登记一条归属纪律**:那枚造成 500 的在飞引用属他人持有面,本票只登记现象与修法方向,不代改别人的文件。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕〔残行摘号补齐(2026-10-09/F9 清偿批⑤):本行声明位残留的原号已按 F9 清偿批②/④让出(同族持有行的让号记录在案),本笔摘掉声明位令牌,正文除令牌外逐字未动;同题登记以「守门 149(包入口 barrel 漏 re-export)」那一条按标题前缀寻行(不写行号),派单以持有行为准。〕
```

- 原 L9829(L1 外部持有行 L15758):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L9959(G-417) 同题,派单以持有行为准,本行不再单独派单。〕 G-417 **全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红,登记以免被"修好我看见的那三道"再掩一次** —— ① 守门 [12] 交付报告一致性判 `PROJECT_PLAN.md` 自身违规 1 处:同一份账面里既写着"完整收尾/无后续建议"一类断言,又留着"后续工作/优化项"清单(AGENTS §10 那条互斥约束)。它在全量档是 warn、不挡提交,但它是**批量审计恒红清单**里的一项,留着就会有人天天来问"这红谁的"。出路只有两条且不得放宽判据:要么把该份报告改成"任务 X 已完成、还有 N 项后续"(推荐,因为活账确实还有),要么真把后续条目清干净再声明闭环。归该份批次报告的作者;现读定位:`node scripts/check-delivery-report-consistency.mjs`。② 同日实测的并发副作用登记:多会话同时提交时(本轮实测单窗口 27–47 枚),守门 [30a] 会把**别人重写提交留下的悬空对象**算在本次提交头上、[84] 会把**别人挂在共享索引里的暂存删除**报成待判 —— 两者本轮都已按仓里规定动作处置(悬空提交 `cf05a98386` 已 `git tag lost-commit/cf05a983` 备份并复跑 30a rc=0,其内容经祖先判据确认**已在主线**,零丢失;[84] 复跑 rc=0 并把那条暂存删除点名交回其持有人)。**留这一格是因为它没有判据**:目前没有任何一道门区分"本次引入的悬空"与"并发重写留下的同内容副本",而这型一旦攒多了就是 §22 那类丢 commit 事故的温床。③ 同轮只读量测的第三格(本机**此刻不成立**,故不是待修而是待防):六把常驻命令行工具在"调用方 cwd 不在仓库内"时仍都能解析到仓库(本机 `.git` 是指针文件,git 会向上找),所以依赖 cwd 的那一处今天没有实害;但 `scripts/union-converge.mjs` 与 `scripts/git-push-converge.mjs` **写死** `C:/Program Files/Git/cmd/git.exe`,而仓里已有唯一出口 `scripts/lib/gitdir.mjs`(§5b 明写"脚本一律不得依赖环境取 git"),另一台机(G 盘那份 checkout)实测 git 落点不同 ⇒ 换机即 ENOENT。`git-push-converge.mjs` 同时是唯一不按自身位置推根的一把(换个目录跑结论会变)。**取证教训一条,写给下一个想顺手"修"的人**:我第一轮把这些工具的失败猜成"模块顶层数组引用后声明常量 ⇒ TDZ",现读**否证**(那三处在函数体内求值),真因是我自己的探针把 msys 风格路径拼成了不存在的目录 —— 0 命中/含糊错先怀疑尺子,再怀疑世界,别照假设改生产工具。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-417 · 全量守门盘点」,派单以那条为准,本行不再单独派单。〕
```

- 原 L9831(L1 外部持有行 L15704):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-09):本行声明位残留的原号已让出(见同族持有行让号记录),本行摘掉令牌、正文逐字保留、不翻勾、不并抄;同题登记以「本批全量终审 186 项」那一条按标题前缀寻行(不写行号)。〕 **本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)** 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-580 · 本批全量终审186项=173通过/5警告/8失败」,派单以那条为准,本行不再单独派单。〕
```

- 原 L9832(L1 外部持有行 L15597):

```
- [ ]〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7422(G-3) 同题,派单以持有行为准,本行不再单独派单。〕 （待派/QODER-O81）**守门 149(包入口 barrel 漏 re-export)对"端内 barrel"整片失明,而它漏的正是能把整站打红的形态** —— 立票凭据不是推理:web 端本机现读 HTTP 500,响应体直接点名 `Export <某组件> doesn't exist in target module`,定位到「端内 barrel 没递出该符号,而同端消费方从 barrel 具名导入」;追溯还发现该符号**曾**在 barrel 里、被一枚"撤掉整条链"的提交摘掉而组件文件保留,之后有人重新引用却没复原出口。同一天另量到一处同型候选(另一张 barrel 与它的消费方),说明这不孤立。**为什么现有门看不见**:149 的候选集按 workspace 包入口(`packages/*/src/index.ts`)枚举,端内 barrel 从来不在面里(实测其 `--json` 输出中不含任何端内 barrel 路径);而管悬空导入的那道门判的是"符号根本不存在",这型是"符号存在而入口没递出",结构上互补不重叠。**后果不是"少一个类型错"**:本仓 web 构建设了 `ignoreBuildErrors`,端内 barrel 漏出口在本地与构建两侧都不红,只有点到那个位置的人知道 —— 与守门 72/78/149 立项时同一族"本地全绿、出事的是产物"。**扩面前置(不得跳过)**:先把存量一次量清(端内 barrel 全集 × 各自消费面 × 悬空具名导入数),再决定定级 —— 存量未清就 blocking 就是与任何提交无关的恒红门,唯一结局是各会话跳钩子、连带其余全部对账作废(§12e 同型);**不得**为让本票变绿去改判据或删引用。**顺带登记一条归属纪律**:那枚造成 500 的在飞引用属他人持有面,本票只登记现象与修法方向,不代改别人的文件。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-627 · 守门149」,派单以那条为准,本行不再单独派单。〕〔残行摘号补齐(2026-10-09/F9 清偿批⑤):本行声明位残留的原号已按 F9 清偿批②/④让出(同族持有行的让号记录在案),本笔摘掉声明位令牌,正文除令牌外逐字未动;同题登记以「守门 149(包入口 barrel 漏 re-export)」那一条按标题前缀寻行(不写行号),派单以持有行为准。〕
```

- 原 L9834(L1 外部持有行 L15704):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-09):本行声明位残留的原号已让出(见同族持有行让号记录),本行摘掉令牌、正文逐字保留、不翻勾、不并抄;同题登记以「本批全量终审 186 项」那一条按标题前缀寻行(不写行号)。〕 **本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)**
```

- 原 L9835(L1 外部持有行 L15597):

```
- [ ]〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7422(G-3) 同题,派单以持有行为准,本行不再单独派单。〕 （待派/QODER-O81）**守门 149(包入口 barrel 漏 re-export)对"端内 barrel"整片失明,而它漏的正是能把整站打红的形态** —— 立票凭据不是推理:web 端本机现读 HTTP 500,响应体直接点名 `Export <某组件> doesn't exist in target module`,定位到「端内 barrel 没递出该符号,而同端消费方从 barrel 具名导入」;追溯还发现该符号**曾**在 barrel 里、被一枚"撤掉整条链"的提交摘掉而组件文件保留,之后有人重新引用却没复原出口。同一天另量到一处同型候选(另一张 barrel 与它的消费方),说明这不孤立。**为什么现有门看不见**:149 的候选集按 workspace 包入口(`packages/*/src/index.ts`)枚举,端内 barrel 从来不在面里(实测其 `--json` 输出中不含任何端内 barrel 路径);而管悬空导入的那道门判的是"符号根本不存在",这型是"符号存在而入口没递出",结构上互补不重叠。**后果不是"少一个类型错"**:本仓 web 构建设了 `ignoreBuildErrors`,端内 barrel 漏出口在本地与构建两侧都不红,只有点到那个位置的人知道 —— 与守门 72/78/149 立项时同一族"本地全绿、出事的是产物"。**扩面前置(不得跳过)**:先把存量一次量清(端内 barrel 全集 × 各自消费面 × 悬空具名导入数),再决定定级 —— 存量未清就 blocking 就是与任何提交无关的恒红门,唯一结局是各会话跳钩子、连带其余全部对账作废(§12e 同型);**不得**为让本票变绿去改判据或删引用。**顺带登记一条归属纪律**:那枚造成 500 的在飞引用属他人持有面,本票只登记现象与修法方向,不代改别人的文件。〔残行摘号补齐(2026-10-09/F9 清偿批⑤):本行声明位残留的原号已按 F9 清偿批②/④让出(同族持有行的让号记录在案),本笔摘掉声明位令牌,正文除令牌外逐字未动;同题登记以「守门 149(包入口 barrel 漏 re-export)」那一条按标题前缀寻行(不写行号),派单以持有行为准。〕
```

- 原 L9837(L1 外部持有行 L15757):

```
- [ ]（【归并】重复登记副本·同题不同编号·2026-10-05·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）看板把 `cancelled/failed/quota_exceeded/preempted` 全塌成 `blocked`（等人拍板）—— 上游 `dw/src/engine/errors.ts:14-35` 的分级判据是"**能不能被 catch**"而非严重程度：脚本 catch 得到的降为 node 级、`report` 返回 void 无处 catch 的升 run 级，`Interrupted` 必须独立码（否则"进程被杀"与"脚本真失败"只能靠 message 文本分）。我方 `packages/types/src/agent-runtime.ts:1258-1266` `LEGACY_STATUS_MAP` 四档同落 `blocked` ⇒ 被取消的任务与待解阻塞在看板上同形，"重跑很可能就好"与"要先解阻塞"是一条视觉信号。拆 = 六档变七档，牵动 `z.enum`（`agents-kanban.ts:128,151`）+ SSE 载荷 + `dag_scheduler.py:351` + 五语言 + 守门 151 的 SV2。 (原编号 G-462;持有行题面「看板把cancelled/failed/quot」)
```

- 原 L9839(L1 外部持有行 L15758):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L9959(G-417) 同题,派单以持有行为准,本行不再单独派单。〕 G-417 **全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红,登记以免被"修好我看见的那三道"再掩一次** —— ① 守门 [12] 交付报告一致性判 `PROJECT_PLAN.md` 自身违规 1 处:同一份账面里既写着"完整收尾/无后续建议"一类断言,又留着"后续工作/优化项"清单(AGENTS §10 那条互斥约束)。它在全量档是 warn、不挡提交,但它是**批量审计恒红清单**里的一项,留着就会有人天天来问"这红谁的"。出路只有两条且不得放宽判据:要么把该份报告改成"任务 X 已完成、还有 N 项后续"(推荐,因为活账确实还有),要么真把后续条目清干净再声明闭环。归该份批次报告的作者;现读定位:`node scripts/check-delivery-report-consistency.mjs`。② 同日实测的并发副作用登记:多会话同时提交时(本轮实测单窗口 27–47 枚),守门 [30a] 会把**别人重写提交留下的悬空对象**算在本次提交头上、[84] 会把**别人挂在共享索引里的暂存删除**报成待判 —— 两者本轮都已按仓里规定动作处置(悬空提交 `cf05a98386` 已 `git tag lost-commit/cf05a983` 备份并复跑 30a rc=0,其内容经祖先判据确认**已在主线**,零丢失;[84] 复跑 rc=0 并把那条暂存删除点名交回其持有人)。**留这一格是因为它没有判据**:目前没有任何一道门区分"本次引入的悬空"与"并发重写留下的同内容副本",而这型一旦攒多了就是 §22 那类丢 commit 事故的温床。③ 同轮只读量测的第三格(本机**此刻不成立**,故不是待修而是待防):六把常驻命令行工具在"调用方 cwd 不在仓库内"时仍都能解析到仓库(本机 `.git` 是指针文件,git 会向上找),所以依赖 cwd 的那一处今天没有实害;但 `scripts/union-converge.mjs` 与 `scripts/git-push-converge.mjs` **写死** `C:/Program Files/Git/cmd/git.exe`,而仓里已有唯一出口 `scripts/lib/gitdir.mjs`(§5b 明写"脚本一律不得依赖环境取 git"),另一台机(G 盘那份 checkout)实测 git 落点不同 ⇒ 换机即 ENOENT。`git-push-converge.mjs` 同时是唯一不按自身位置推根的一把(换个目录跑结论会变)。**取证教训一条,写给下一个想顺手"修"的人**:我第一轮把这些工具的失败猜成"模块顶层数组引用后声明常量 ⇒ TDZ",现读**否证**(那三处在函数体内求值),真因是我自己的探针把 msys 风格路径拼成了不存在的目录 —— 0 命中/含糊错先怀疑尺子,再怀疑世界,别照假设改生产工具。（进行中@2026-10-08/W1-A）
```

- 原 L9840(L1 外部持有行 L7582):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-09):本行声明位残留的原号已让出(见同族持有行让号记录),本行摘掉令牌、正文逐字保留、不翻勾、不并抄;同题登记以「共享索引被整批清空后」那一条按标题前缀寻行(不写行号)。〕 **共享索引被整批清空后,"他人已暂存的删除"会失去保护标记,并被工作区存续自愈当成外部删除恢复**(归属:安全提交器 + 存续自愈两处持有人;等环境条件 = 需先定"意图删除"与"宿主误删"在恢复前用什么区分,不是等人拍板措辞):实测链(2026-09-28 09:13–09:17,本机=生产,多会话并发) —— 另一会话把 `apps/ai-service/tests/test_tool_approval_grant_lifetime.py` 以 `D ` 形态暂存(该文件是它当天新建、已入库的测试,`git status` 显示索引里有暂存删除);我用 §12 强制的 `node scripts/safe-commit.mjs` 提交自己的 2 个文件,其 Step ① 是 `git reset HEAD` **清空整个暂存区**(该设计的目的正是别把别人的在途内容打包进我的提交),效果是那枚暂存删除的保护标记一起没了;2 分钟后 `git-guardian` 的存续自愈判定"工作树缺该文件 ∧ 索引 blob == HEAD blob ∧ HEAD 里有它"三条成立 ⇒ 恢复磁盘副本,日志原文:`✅ 工作区存续自愈:恢复 1 个被外部删除的跟踪文件(apps/ai-service/tests/test_tool_approval_grant_lifetime.py)`。**净结果这次是好的**:恢复内容与 HEAD 逐字节同值(零独有数据、零伪造),且该测试实跑 `5 passed`(RC=0,证据 `.ihui-agent/tmp/ff-race/pytest-grant.ev`)—— 也就是说被"恢复"的是一件确实该存在的东西,而它此前那次暂存删除更像宿主清理层命中 `tests/` 整目录(AGENTS §5b 记过该型)而非有意移除。**但机制本身是反的**:存续自愈的设计前提恰恰是"他人已暂存的删除只报数、不代裁",而一次**与它无关**的第三方提交就能替那个删除摘掉标记 —— 若那枚暂存删除是有意的(例如某票按 §7 迁移测试文件),本机会话的每次提交都会把它复活,而两边账面都绿:提交方只看到"我的 2 个文件",自愈方只看到"外部删除 + 零独有数据"。**要谁做什么**:① `safe-commit.mjs` 在 `git reset HEAD` 之前把 `git diff --cached --name-status` 的现状留底,复位后**逐路径恢复 D 标记**(或至少在输出里点名"本次清空了他人的 N 项暂存删除"),让归属会话能看见而不是事后发现;② 存续自愈恢复前问一句"该路径最近是否出现过 ` D`/`D ` 形态"(reflog/索引事件),分不清就只报数。**不在本票范围**:改动别人那枚删除本身(既不支持也不阻止),以及 §7 对"删除 git 对象前先答三问"的既有纪律。
```

- 原 L9843(L1 外部持有行 L15758):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L9959(G-417) 同题,派单以持有行为准,本行不再单独派单。〕 G-417 **全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红,登记以免被"修好我看见的那三道"再掩一次** —— ① 守门 [12] 交付报告一致性判 `PROJECT_PLAN.md` 自身违规 1 处:同一份账面里既写着"完整收尾/无后续建议"一类断言,又留着"后续工作/优化项"清单(AGENTS §10 那条互斥约束)。它在全量档是 warn、不挡提交,但它是**批量审计恒红清单**里的一项,留着就会有人天天来问"这红谁的"。出路只有两条且不得放宽判据:要么把该份报告改成"任务 X 已完成、还有 N 项后续"(推荐,因为活账确实还有),要么真把后续条目清干净再声明闭环。归该份批次报告的作者;现读定位:`node scripts/check-delivery-report-consistency.mjs`。② 同日实测的并发副作用登记:多会话同时提交时(本轮实测单窗口 27–47 枚),守门 [30a] 会把**别人重写提交留下的悬空对象**算在本次提交头上、[84] 会把**别人挂在共享索引里的暂存删除**报成待判 —— 两者本轮都已按仓里规定动作处置(悬空提交 `cf05a98386` 已 `git tag lost-commit/cf05a983` 备份并复跑 30a rc=0,其内容经祖先判据确认**已在主线**,零丢失;[84] 复跑 rc=0 并把那条暂存删除点名交回其持有人)。**留这一格是因为它没有判据**:目前没有任何一道门区分"本次引入的悬空"与"并发重写留下的同内容副本",而这型一旦攒多了就是 §22 那类丢 commit 事故的温床。③ 同轮只读量测的第三格(本机**此刻不成立**,故不是待修而是待防):六把常驻命令行工具在"调用方 cwd 不在仓库内"时仍都能解析到仓库(本机 `.git` 是指针文件,git 会向上找),所以依赖 cwd 的那一处今天没有实害;但 `scripts/union-converge.mjs` 与 `scripts/git-push-converge.mjs` **写死** `C:/Program Files/Git/cmd/git.exe`,而仓里已有唯一出口 `scripts/lib/gitdir.mjs`(§5b 明写"脚本一律不得依赖环境取 git"),另一台机(G 盘那份 checkout)实测 git 落点不同 ⇒ 换机即 ENOENT。`git-push-converge.mjs` 同时是唯一不按自身位置推根的一把(换个目录跑结论会变)。**取证教训一条,写给下一个想顺手"修"的人**:我第一轮把这些工具的失败猜成"模块顶层数组引用后声明常量 ⇒ TDZ",现读**否证**(那三处在函数体内求值),真因是我自己的探针把 msys 风格路径拼成了不存在的目录 —— 0 命中/含糊错先怀疑尺子,再怀疑世界,别照假设改生产工具。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-417 · 全量守门盘点」,派单以那条为准,本行不再单独派单。〕
```

- 原 L9844(L1 外部持有行 L7582):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-09):本行声明位残留的原号已让出(见同族持有行让号记录),本行摘掉令牌、正文逐字保留、不翻勾、不并抄;同题登记以「共享索引被整批清空后」那一条按标题前缀寻行(不写行号)。〕 **共享索引被整批清空后,"他人已暂存的删除"会失去保护标记,并被工作区存续自愈当成外部删除恢复**(归属:安全提交器 + 存续自愈两处持有人;等环境条件 = 需先定"意图删除"与"宿主误删"在恢复前用什么区分,不是等人拍板措辞):实测链(2026-09-28 09:13–09:17,本机=生产,多会话并发) —— 另一会话把 `apps/ai-service/tests/test_tool_approval_grant_lifetime.py` 以 `D ` 形态暂存(该文件是它当天新建、已入库的测试,`git status` 显示索引里有暂存删除);我用 §12 强制的 `node scripts/safe-commit.mjs` 提交自己的 2 个文件,其 Step ① 是 `git reset HEAD` **清空整个暂存区**(该设计的目的正是别把别人的在途内容打包进我的提交),效果是那枚暂存删除的保护标记一起没了;2 分钟后 `git-guardian` 的存续自愈判定"工作树缺该文件 ∧ 索引 blob == HEAD blob ∧ HEAD 里有它"三条成立 ⇒ 恢复磁盘副本,日志原文:`✅ 工作区存续自愈:恢复 1 个被外部删除的跟踪文件(apps/ai-service/tests/test_tool_approval_grant_lifetime.py)`。**净结果这次是好的**:恢复内容与 HEAD 逐字节同值(零独有数据、零伪造),且该测试实跑 `5 passed`(RC=0,证据 `.ihui-agent/tmp/ff-race/pytest-grant.ev`)—— 也就是说被"恢复"的是一件确实该存在的东西,而它此前那次暂存删除更像宿主清理层命中 `tests/` 整目录(AGENTS §5b 记过该型)而非有意移除。**但机制本身是反的**:存续自愈的设计前提恰恰是"他人已暂存的删除只报数、不代裁",而一次**与它无关**的第三方提交就能替那个删除摘掉标记 —— 若那枚暂存删除是有意的(例如某票按 §7 迁移测试文件),本机会话的每次提交都会把它复活,而两边账面都绿:提交方只看到"我的 2 个文件",自愈方只看到"外部删除 + 零独有数据"。**要谁做什么**:① `safe-commit.mjs` 在 `git reset HEAD` 之前把 `git diff --cached --name-status` 的现状留底,复位后**逐路径恢复 D 标记**(或至少在输出里点名"本次清空了他人的 N 项暂存删除"),让归属会话能看见而不是事后发现;② 存续自愈恢复前问一句"该路径最近是否出现过 ` D`/`D ` 形态"(reflog/索引事件),分不清就只报数。**不在本票范围**:改动别人那枚删除本身(既不支持也不阻止),以及 §7 对"删除 git 对象前先答三问"的既有纪律。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-461 · 共享索引被整批清空后」,派单以那条为准,本行不再单独派单。〕
```

- 原 L9856(L1 外部持有行 L15759):

```
- [ ] **[归并]** 【归并】重复登记副本:本行与同任务登记「把 redactChildOutput 的同形副本收成一份实现」重复(它是**本会话上一轮让号**复制出来的投影 —— 编号从 G-334 被挪成畸形的 G-G-334;先折叠副本再改号才是对的顺序,见枚 857303368 的理由格)。本行不进派单口径、正文逐字留在下方、不删行。 G-G-334 **把 `redactChildOutput` 的同形副本收成一份实现（承 L13210 收口枚 4b4c985ae 时现读到，不属顺手扩面）**：① 现读 HEAD 面 `grep -c "export function redactChildOutput" scripts/check-credential-health.mjs scripts/git-guardian.mjs` = **1 / 1**，两处同一 `SECRETISH_RE` 字面量、同一 `limit = 300`；② 副本比这一个函数更大 —— **派发探针整段也是同形拷贝**（`check-credential-health.mjs:922-927` 与 `git-guardian.mjs:994-999` 那四条用 `redactChildOutput(...)` 组装 `why` 的语句逐字相同），而 `why` 的落点是守护日志与 UNDELIVERED 标记（`git-guardian.mjs:1072/:1085`）；③ 两侧消费面不同 ⇒ 漂移表现不同：一侧拼进**到人邮件正文**，一侧写**守护日志/未送达标记**。「两处算同一件事必漂移」是本仓记过最多次的失效型，而这条链的失败形态是安静的：漂的一侧只会让某些告警少打码或多打码，没有任何门会喊。**修法唯一**：抽 `scripts/lib/secret-shape-redact.mjs`，导出三档语义（`redactSecretishLines` 只脱敏 / `redactChildOutput` 脱敏+截断 / `redactAlertDetail` 只判值形状不截断），两消费者各 import 自己那档；**不得**为省事把三档并成一档 —— L13210 那次自伤正是"脱敏与截断焊死"造成的（把 500 字 CI 配额诊断砍成 300 字，拿泄露修复换一个不可处置的告警）。**落地判据**：a) 构造面正反例成对钉语义等值（散文逐字不改 / assignment 留键名抹值 / 40 位 git sha 不被抹 / 空输入明写占位）；b) 镜像源码形状锁"全仓不得再出现第二份 `SECRETISH_RE` 字面量"（照守门 131/135 引 `lib/code-mask.mjs` 那一份实现的先例）；c) 两侧尺子复跑至全绿并留退出码：巡检侧 `node scripts/check-credential-health.mjs --self-test`（本枚现读 58/58、RC=0），守护侧 `node --test scripts/tests/git-guardian-notify.test.mjs`（声明 26 用例）**现读被他人未提交副本挡住** —— `scripts/git-guardian.mjs` 的工作树 blob `146341b3` 经 `git log --all --find-object` 证明**不等于任何已提交版本**、且缺 HEAD 里在位的 `readProbeVerdict`，于是该镜像在 `:361` 抛 TypeError。该文件此刻归其持有者，**禁止**为让本行变绿去 `checkout-index`/`restore` 它（那是抹别人未提交的编辑）。**在等谁**：抽 lib 会同时改守护链（`git-guardian.mjs` 是每 2 分钟 tick 的常驻体，且此刻正被他人持有），需与 §5b/§5e 那份"改通道要逐个覆盖"清单的持有者同窗口落，不由本会话单方动它。
```

- 原 L9857(L1 外部持有行 L9868):

```
- [ ]〔【归并】重复登记副本(2026-09-28):本行行首那个号是**双前缀畸形号** —— 改派工具把前缀又贴到已有号上造出来的,尺子按它取不出主键,于是同一件事在台账里被算成两个标题。同题登记的持有行是「把 redactChildOutput 的同形副本收成一份实现」那一条待办(编号 G-334;按标题前缀寻行,既不写行号也不依赖行序);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。〕 **把 `redactChildOutput` 的同形副本收成一份实现（承 L13210 收口枚 4b4c985ae 时现读到，不属顺手扩面）**：① 现读 HEAD 面 `grep -c "export function redactChildOutput" scripts/check-credential-health.mjs scripts/git-guardian.mjs` = **1 / 1**，两处同一 `SECRETISH_RE` 字面量、同一 `limit = 300`；② 副本比这一个函数更大 —— **派发探针整段也是同形拷贝**（`check-credential-health.mjs:922-927` 与 `git-guardian.mjs:994-999` 那四条用 `redactChildOutput(...)` 组装 `why` 的语句逐字相同），而 `why` 的落点是守护日志与 UNDELIVERED 标记（`git-guardian.mjs:1072/:1085`）；③ 两侧消费面不同 ⇒ 漂移表现不同：一侧拼进**到人邮件正文**，一侧写**守护日志/未送达标记**。「两处算同一件事必漂移」是本仓记过最多次的失效型，而这条链的失败形态是安静的：漂的一侧只会让某些告警少打码或多打码，没有任何门会喊。**修法唯一**：抽 `scripts/lib/secret-shape-redact.mjs`，导出三档语义（`redactSecretishLines` 只脱敏 / `redactChildOutput` 脱敏+截断 / `redactAlertDetail` 只判值形状不截断），两消费者各 import 自己那档；**不得**为省事把三档并成一档 —— L13210 那次自伤正是"脱敏与截断焊死"造成的（把 500 字 CI 配额诊断砍成 300 字，拿泄露修复换一个不可处置的告警）。**落地判据**：a) 构造面正反例成对钉语义等值（散文逐字不改 / assignment 留键名抹值 / 40 位 git sha 不被抹 / 空输入明写占位）；b) 镜像源码形状锁"全仓不得再出现第二份 `SECRETISH_RE` 字面量"（照守门 131/135 引 `lib/code-mask.mjs` 那一份实现的先例）；c) 两侧尺子复跑至全绿并留退出码：巡检侧 `node scripts/check-credential-health.mjs --self-test`（本枚现读 58/58、RC=0），守护侧 `node --test scripts/tests/git-guardian-notify.test.mjs`（声明 26 用例）**现读被他人未提交副本挡住** —— `scripts/git-guardian.mjs` 的工作树 blob `146341b3` 经 `git log --all --find-object` 证明**不等于任何已提交版本**、且缺 HEAD 里在位的 `readProbeVerdict`，于是该镜像在 `:361` 抛 TypeError。该文件此刻归其持有者，**禁止**为让本行变绿去 `checkout-index`/`restore` 它（那是抹别人未提交的编辑）。**在等谁**：抽 lib 会同时改守护链（`git-guardian.mjs` 是每 2 分钟 tick 的常驻体，且此刻正被他人持有），需与 §5b/§5e 那份"改通道要逐个覆盖"清单的持有者同窗口落，不由本会话单方动它。
```

- 原 L9858(L1 外部持有行 L9868):

```
- [ ]〔【归并】重复登记副本(2026-09-28):本行行首那个号是**双前缀畸形号** —— 改派工具把前缀又贴到已有号上造出来的,尺子按它取不出主键,于是同一件事在台账里被算成两个标题。同题登记的持有行是「把 redactChildOutput 的同形副本收成一份实现」那一条待办(按标题前缀寻行,既不写行号也不写编号);本行摘掉畸形号、只留指针,不翻勾、不并抄、正文逐字保留。〕 **把 `redactChildOutput` 的同形副本收成一份实现（承 L13210 收口枚 4b4c985ae 时现读到，不属顺手扩面）**：① 现读 HEAD 面 `grep -c "export function redactChildOutput" scripts/check-credential-health.mjs scripts/git-guardian.mjs` = **1 / 1**，两处同一 `SECRETISH_RE` 字面量、同一 `limit = 300`；② 副本比这一个函数更大 —— **派发探针整段也是同形拷贝**（`check-credential-health.mjs:922-927` 与 `git-guardian.mjs:994-999` 那四条用 `redactChildOutput(...)` 组装 `why` 的语句逐字相同），而 `why` 的落点是守护日志与 UNDELIVERED 标记（`git-guardian.mjs:1072/:1085`）；③ 两侧消费面不同 ⇒ 漂移表现不同：一侧拼进**到人邮件正文**，一侧写**守护日志/未送达标记**。「两处算同一件事必漂移」是本仓记过最多次的失效型，而这条链的失败形态是安静的：漂的一侧只会让某些告警少打码或多打码，没有任何门会喊。**修法唯一**：抽 `scripts/lib/secret-shape-redact.mjs`，导出三档语义（`redactSecretishLines` 只脱敏 / `redactChildOutput` 脱敏+截断 / `redactAlertDetail` 只判值形状不截断），两消费者各 import 自己那档；**不得**为省事把三档并成一档 —— L13210 那次自伤正是"脱敏与截断焊死"造成的（把 500 字 CI 配额诊断砍成 300 字，拿泄露修复换一个不可处置的告警）。**落地判据**：a) 构造面正反例成对钉语义等值（散文逐字不改 / assignment 留键名抹值 / 40 位 git sha 不被抹 / 空输入明写占位）；b) 镜像源码形状锁"全仓不得再出现第二份 `SECRETISH_RE` 字面量"（照守门 131/135 引 `lib/code-mask.mjs` 那一份实现的先例）；c) 两侧尺子复跑至全绿并留退出码：巡检侧 `node scripts/check-credential-health.mjs --self-test`（本枚现读 58/58、RC=0），守护侧 `node --test scripts/tests/git-guardian-notify.test.mjs`（声明 26 用例）**现读被他人未提交副本挡住** —— `scripts/git-guardian.mjs` 的工作树 blob `146341b3` 经 `git log --all --find-object` 证明**不等于任何已提交版本**、且缺 HEAD 里在位的 `readProbeVerdict`，于是该镜像在 `:361` 抛 TypeError。该文件此刻归其持有者，**禁止**为让本行变绿去 `checkout-index`/`restore` 它（那是抹别人未提交的编辑）。**在等谁**：抽 lib 会同时改守护链（`git-guardian.mjs` 是每 2 分钟 tick 的常驻体，且此刻正被他人持有），需与 §5b/§5e 那份"改通道要逐个覆盖"清单的持有者同窗口落，不由本会话单方动它。 (原行首形态 G-G-334)
```

- 原 L9859(L1 外部持有行 L9868):

```
- [ ]〔【归并】重复登记副本(2026-09-28):本行行首那个号是**双前缀畸形号** —— 改派工具把前缀又贴到已有号上造出来的,尺子按它取不出主键,于是同一件事被算成两个标题。同题登记的持有行是「把 redactChildOutput 的同形副本收成一份实现」那一条待办(按标题前缀寻行,不写编号也不写行号);本行摘掉畸形号、只留指针,不翻勾、不并抄、正文逐字保留。〕 **把 `redactChildOutput` 的同形副本收成一份实现（承 L13210 收口枚 4b4c985ae 时现读到，不属顺手扩面）**：① 现读 HEAD 面 `grep -c "export function redactChildOutput" scripts/check-credential-health.mjs scripts/git-guardian.mjs` = **1 / 1**，两处同一 `SECRETISH_RE` 字面量、同一 `limit = 300`；② 副本比这一个函数更大 —— **派发探针整段也是同形拷贝**（`check-credential-health.mjs:922-927` 与 `git-guardian.mjs:994-999` 那四条用 `redactChildOutput(...)` 组装 `why` 的语句逐字相同），而 `why` 的落点是守护日志与 UNDELIVERED 标记（`git-guardian.mjs:1072/:1085`）；③ 两侧消费面不同 ⇒ 漂移表现不同：一侧拼进**到人邮件正文**，一侧写**守护日志/未送达标记**。「两处算同一件事必漂移」是本仓记过最多次的失效型，而这条链的失败形态是安静的：漂的一侧只会让某些告警少打码或多打码，没有任何门会喊。**修法唯一**：抽 `scripts/lib/secret-shape-redact.mjs`，导出三档语义（`redactSecretishLines` 只脱敏 / `redactChildOutput` 脱敏+截断 / `redactAlertDetail` 只判值形状不截断），两消费者各 import 自己那档；**不得**为省事把三档并成一档 —— L13210 那次自伤正是"脱敏与截断焊死"造成的（把 500 字 CI 配额诊断砍成 300 字，拿泄露修复换一个不可处置的告警）。**落地判据**：a) 构造面正反例成对钉语义等值（散文逐字不改 / assignment 留键名抹值 / 40 位 git sha 不被抹 / 空输入明写占位）；b) 镜像源码形状锁"全仓不得再出现第二份 `SECRETISH_RE` 字面量"（照守门 131/135 引 `lib/code-mask.mjs` 那一份实现的先例）；c) 两侧尺子复跑至全绿并留退出码：巡检侧 `node scripts/check-credential-health.mjs --self-test`（本枚现读 58/58、RC=0），守护侧 `node --test scripts/tests/git-guardian-notify.test.mjs`（声明 26 用例）**现读被他人未提交副本挡住** —— `scripts/git-guardian.mjs` 的工作树 blob `146341b3` 经 `git log --all --find-object` 证明**不等于任何已提交版本**、且缺 HEAD 里在位的 `readProbeVerdict`，于是该镜像在 `:361` 抛 TypeError。该文件此刻归其持有者，**禁止**为让本行变绿去 `checkout-index`/`restore` 它（那是抹别人未提交的编辑）。**在等谁**：抽 lib 会同时改守护链（`git-guardian.mjs` 是每 2 分钟 tick 的常驻体，且此刻正被他人持有），需与 §5b/§5e 那份"改通道要逐个覆盖"清单的持有者同窗口落，不由本会话单方动它。 (原行首形态是双前缀)
```

- 原 L9861(L1 外部持有行 L9868):

```
- [ ]【【归并】重复登记副本·双前缀畸形号(2026-09-28):行首那个号是改派工具把前缀又贴一次造出来的,尺子按它取不出主键,于是同一件事被算成两个标题;这份是并集重放带回的折叠前形态。同题登记的持有行是「把redactChildOutput的同形副本收成一份实现承L132」那一条(按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。】 **把 `redactChildOutput` 的同形副本收成一份实现（承 L13210 收口枚 4b4c985ae 时现读到，不属顺手扩面）**：① 现读 HEAD 面 `grep -c "export function redactChildOutput" scripts/check-credential-health.mjs scripts/git-guardian.mjs` = **1 / 1**，两处同一 `SECRETISH_RE` 字面量、同一 `limit = 300`；② 副本比这一个函数更大 —— **派发探针整段也是同形拷贝**（`check-credential-health.mjs:922-927` 与 `git-guardian.mjs:994-999` 那四条用 `redactChildOutput(...)` 组装 `why` 的语句逐字相同），而 `why` 的落点是守护日志与 UNDELIVERED 标记（`git-guardian.mjs:1072/:1085`）；③ 两侧消费面不同 ⇒ 漂移表现不同：一侧拼进**到人邮件正文**，一侧写**守护日志/未送达标记**。「两处算同一件事必漂移」是本仓记过最多次的失效型，而这条链的失败形态是安静的：漂的一侧只会让某些告警少打码或多打码，没有任何门会喊。**修法唯一**：抽 `scripts/lib/secret-shape-redact.mjs`，导出三档语义（`redactSecretishLines` 只脱敏 / `redactChildOutput` 脱敏+截断 / `redactAlertDetail` 只判值形状不截断），两消费者各 import 自己那档；**不得**为省事把三档并成一档 —— L13210 那次自伤正是"脱敏与截断焊死"造成的（把 500 字 CI 配额诊断砍成 300 字，拿泄露修复换一个不可处置的告警）。**落地判据**：a) 构造面正反例成对钉语义等值（散文逐字不改 / assignment 留键名抹值 / 40 位 git sha 不被抹 / 空输入明写占位）；b) 镜像源码形状锁"全仓不得再出现第二份 `SECRETISH_RE` 字面量"（照守门 131/135 引 `lib/code-mask.mjs` 那一份实现的先例）；c) 两侧尺子复跑至全绿并留退出码：巡检侧 `node scripts/check-credential-health.mjs --self-test`（本枚现读 58/58、RC=0），守护侧 `node --test scripts/tests/git-guardian-notify.test.mjs`（声明 26 用例）**现读被他人未提交副本挡住** —— `scripts/git-guardian.mjs` 的工作树 blob `146341b3` 经 `git log --all --find-object` 证明**不等于任何已提交版本**、且缺 HEAD 里在位的 `readProbeVerdict`，于是该镜像在 `:361` 抛 TypeError。该文件此刻归其持有者，**禁止**为让本行变绿去 `checkout-index`/`restore` 它（那是抹别人未提交的编辑）。**在等谁**：抽 lib 会同时改守护链（`git-guardian.mjs` 是每 2 分钟 tick 的常驻体，且此刻正被他人持有），需与 §5b/§5e 那份"改通道要逐个覆盖"清单的持有者同窗口落，不由本会话单方动它。
```

- 原 L9862(L1 外部持有行 L9868):

```
- [ ]〔【归并】重复登记副本:与本编号另一条同题登记正文逐字相同,不单独派单〕 **把 `redactChildOutput` 的同形副本收成一份实现（承 L13210 收口枚 4b4c985ae 时现读到，不属顺手扩面）**：① 现读 HEAD 面 `grep -c "export function redactChildOutput" scripts/check-credential-health.mjs scripts/git-guardian.mjs` = **1 / 1**，两处同一 `SECRETISH_RE` 字面量、同一 `limit = 300`；② 副本比这一个函数更大 —— **派发探针整段也是同形拷贝**（`check-credential-health.mjs:922-927` 与 `git-guardian.mjs:994-999` 那四条用 `redactChildOutput(...)` 组装 `why` 的语句逐字相同），而 `why` 的落点是守护日志与 UNDELIVERED 标记（`git-guardian.mjs:1072/:1085`）；③ 两侧消费面不同 ⇒ 漂移表现不同：一侧拼进**到人邮件正文**，一侧写**守护日志/未送达标记**。「两处算同一件事必漂移」是本仓记过最多次的失效型，而这条链的失败形态是安静的：漂的一侧只会让某些告警少打码或多打码，没有任何门会喊。**修法唯一**：抽 `scripts/lib/secret-shape-redact.mjs`，导出三档语义（`redactSecretishLines` 只脱敏 / `redactChildOutput` 脱敏+截断 / `redactAlertDetail` 只判值形状不截断），两消费者各 import 自己那档；**不得**为省事把三档并成一档 —— L13210 那次自伤正是"脱敏与截断焊死"造成的（把 500 字 CI 配额诊断砍成 300 字，拿泄露修复换一个不可处置的告警）。**落地判据**：a) 构造面正反例成对钉语义等值（散文逐字不改 / assignment 留键名抹值 / 40 位 git sha 不被抹 / 空输入明写占位）；b) 镜像源码形状锁"全仓不得再出现第二份 `SECRETISH_RE` 字面量"（照守门 131/135 引 `lib/code-mask.mjs` 那一份实现的先例）；c) 两侧尺子复跑至全绿并留退出码：巡检侧 `node scripts/check-credential-health.mjs --self-test`（本枚现读 58/58、RC=0），守护侧 `node --test scripts/tests/git-guardian-notify.test.mjs`（声明 26 用例）**现读被他人未提交副本挡住** —— `scripts/git-guardian.mjs` 的工作树 blob `146341b3` 经 `git log --all --find-object` 证明**不等于任何已提交版本**、且缺 HEAD 里在位的 `readProbeVerdict`，于是该镜像在 `:361` 抛 TypeError。该文件此刻归其持有者，**禁止**为让本行变绿去 `checkout-index`/`restore` 它（那是抹别人未提交的编辑）。**在等谁**：抽 lib 会同时改守护链（`git-guardian.mjs` 是每 2 分钟 tick 的常驻体，且此刻正被他人持有），需与 §5b/§5e 那份"改通道要逐个覆盖"清单的持有者同窗口落，不由本会话单方动它。
```

- 原 L9864(L1 外部持有行 L9868):

```
- [ ] **把 `redactChildOutput` 的同形副本收成一份实现（承 L13210 收口枚 4b4c985ae 时现读到，不属顺手扩面）**：① 现读 HEAD 面 `grep -c "export function redactChildOutput" scripts/check-credential-health.mjs scripts/git-guardian.mjs` = **1 / 1**，两处同一 `SECRETISH_RE` 字面量、同一 `limit = 300`；② 副本比这一个函数更大 —— **派发探针整段也是同形拷贝**（`check-credential-health.mjs:922-927` 与 `git-guardian.mjs:994-999` 那四条用 `redactChildOutput(...)` 组装 `why` 的语句逐字相同），而 `why` 的落点是守护日志与 UNDELIVERED 标记（`git-guardian.mjs:1072/:1085`）；③ 两侧消费面不同 ⇒ 漂移表现不同：一侧拼进**到人邮件正文**，一侧写**守护日志/未送达标记**。「两处算同一件事必漂移」是本仓记过最多次的失效型，而这条链的失败形态是安静的：漂的一侧只会让某些告警少打码或多打码，没有任何门会喊。**修法唯一**：抽 `scripts/lib/secret-shape-redact.mjs`，导出三档语义（`redactSecretishLines` 只脱敏 / `redactChildOutput` 脱敏+截断 / `redactAlertDetail` 只判值形状不截断），两消费者各 import 自己那档；**不得**为省事把三档并成一档 —— L13210 那次自伤正是"脱敏与截断焊死"造成的（把 500 字 CI 配额诊断砍成 300 字，拿泄露修复换一个不可处置的告警）。**落地判据**：a) 构造面正反例成对钉语义等值（散文逐字不改 / assignment 留键名抹值 / 40 位 git sha 不被抹 / 空输入明写占位）；b) 镜像源码形状锁"全仓不得再出现第二份 `SECRETISH_RE` 字面量"（照守门 131/135 引 `lib/code-mask.mjs` 那一份实现的先例）；c) 两侧尺子复跑至全绿并留退出码：巡检侧 `node scripts/check-credential-health.mjs --self-test`（本枚现读 58/58、RC=0），守护侧 `node --test scripts/tests/git-guardian-notify.test.mjs`（声明 26 用例）**现读被他人未提交副本挡住** —— `scripts/git-guardian.mjs` 的工作树 blob `146341b3` 经 `git log --all --find-object` 证明**不等于任何已提交版本**、且缺 HEAD 里在位的 `readProbeVerdict`，于是该镜像在 `:361` 抛 TypeError。该文件此刻归其持有者，**禁止**为让本行变绿去 `checkout-index`/`restore` 它（那是抹别人未提交的编辑）。**在等谁**：抽 lib 会同时改守护链（`git-guardian.mjs` 是每 2 分钟 tick 的常驻体，且此刻正被他人持有），需与 §5b/§5e 那份"改通道要逐个覆盖"清单的持有者同窗口落，不由本会话单方动它。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9869(L1 外部持有行 L15689):

```
- [ ] **A1 改道校验只比大小不比内容（可立即修；归属：§26 C 盘改道线，本票持有人即我）** —— 见上文 A1 与现读落点。〔【归并】重复登记副本(2026-10-07):同主键的另一条登记 「G-385 · A1改道校验只比大小不比内容」,派单以那条为准,本行不再单独派单。〕
```

- 原 L9871(L1 外部持有行 L9868):

```
- [ ] **把 `redactChildOutput` 的同形副本收成一份实现（承 L13210 收口枚 4b4c985ae 时现读到，不属顺手扩面）**：① 现读 HEAD 面 `grep -c "export function redactChildOutput" scripts/check-credential-health.mjs scripts/git-guardian.mjs` = **1 / 1**，两处同一 `SECRETISH_RE` 字面量、同一 `limit = 300`；② 副本比这一个函数更大 —— **派发探针整段也是同形拷贝**（`check-credential-health.mjs:922-927` 与 `git-guardian.mjs:994-999` 那四条用 `redactChildOutput(...)` 组装 `why` 的语句逐字相同），而 `why` 的落点是守护日志与 UNDELIVERED 标记（`git-guardian.mjs:1072/:1085`）；③ 两侧消费面不同 ⇒ 漂移表现不同：一侧拼进**到人邮件正文**，一侧写**守护日志/未送达标记**。「两处算同一件事必漂移」是本仓记过最多次的失效型，而这条链的失败形态是安静的：漂的一侧只会让某些告警少打码或多打码，没有任何门会喊。**修法唯一**：抽 `scripts/lib/secret-shape-redact.mjs`，导出三档语义（`redactSecretishLines` 只脱敏 / `redactChildOutput` 脱敏+截断 / `redactAlertDetail` 只判值形状不截断），两消费者各 import 自己那档；**不得**为省事把三档并成一档 —— L13210 那次自伤正是"脱敏与截断焊死"造成的（把 500 字 CI 配额诊断砍成 300 字，拿泄露修复换一个不可处置的告警）。**落地判据**：a) 构造面正反例成对钉语义等值（散文逐字不改 / assignment 留键名抹值 / 40 位 git sha 不被抹 / 空输入明写占位）；b) 镜像源码形状锁"全仓不得再出现第二份 `SECRETISH_RE` 字面量"（照守门 131/135 引 `lib/code-mask.mjs` 那一份实现的先例）；c) 两侧尺子复跑至全绿并留退出码：巡检侧 `node scripts/check-credential-health.mjs --self-test`（本枚现读 58/58、RC=0），守护侧 `node --test scripts/tests/git-guardian-notify.test.mjs`（声明 26 用例）**现读被他人未提交副本挡住** —— `scripts/git-guardian.mjs` 的工作树 blob `146341b3` 经 `git log --all --find-object` 证明**不等于任何已提交版本**、且缺 HEAD 里在位的 `readProbeVerdict`，于是该镜像在 `:361` 抛 TypeError。该文件此刻归其持有者，**禁止**为让本行变绿去 `checkout-index`/`restore` 它（那是抹别人未提交的编辑）。**在等谁**：抽 lib 会同时改守护链（`git-guardian.mjs` 是每 2 分钟 tick 的常驻体，且此刻正被他人持有），需与 §5b/§5e 那份"改通道要逐个覆盖"清单的持有者同窗口落，不由本会话单方动它。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9891(L1 外部持有行 L3908):

```
- [ ] **剩一条已量化、未修(需产品决策,非纯工程)**:主端点 `aizhs.top/desktop-feed.json` **只写 〔【归并】重复登记副本(2026-10-06/g2-alltasks):本行为截断残行(正文止于"只写"),完整登记见带 g2-alltasks 标记的主行(含 desktop-feed.json 单端点进展注记,定稿枚 ea7616fecf),派单以主行为准,本行不再单独派单。〕
```

- 原 L9892(L1 外部持有行 L7607):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7697(G-401) 同题,派单以持有行为准,本行不再单独派单。〕 **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9893(L1 外部持有行 L7607):

```
- [ ]【【归并】重复登记副本·双前缀畸形号(2026-09-28):行首那个号是改派工具把前缀又贴一次造出来的,尺子按它取不出主键,于是同一件事被算成两个标题;这份是并集重放带回的折叠前形态。同题登记的持有行是「MCP工具被标成read⇒免批准+失败自动重跑需拍板；归属：cli权」那一条(按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。】 **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。
```

- 原 L9894(L1 外部持有行 L7607):

```
- [ ]〔【归并】重复登记副本(2026-09-28):本行行首那个号是**双前缀畸形号** —— 改派工具把前缀又贴到已有号上造出来的,尺子按它取不出主键,于是同一件事在台账里被算成两个标题。同题登记的持有行是「MCP 工具被标成」那一条待办(编号 G-401;按标题前缀寻行,既不写行号也不依赖行序);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。〕 **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。
```

- 原 L9905(L1 外部持有行 L15656):

```
- [ ]O81 跨端 UI 单一源:小程序端与 App(RN)端逐档同值 + 改一端另一端自动生效(除登录方式与平台机制)。**第 1 票已落(本枚提交)**:对账尺 `scripts/check-cross-end-ui-parity.mjs`(guardian **128**,blocking,棘轮锚点 `scripts/cross-end-ui-parity-baseline.json`,自检 19 例 + 门禁 11 例),AGENTS §4 新节 + README 点名。**立项实测读数**:同名配对组件 19 对 / 174 处差异档 / RN 侧 210 个组件用 `StyleSheet.create` 而小程序侧 91 个用 `className=`(两种样式语言 = 结构上无法自动同步的根因)。**已量到的最小心智事实**:两份自称"唯一实现"的 `BackChevron` 图标墨迹 20px vs 22px、色一档取 `--color-foreground` 一档取 `tk.text.medium`、RN 带系统字号缩放倍率而小程序不带。**剩余票(顺序固定,不得跳)**:② **〔x〕 2026-09-26 已落**:几何档 `packages/design-tokens/src/geometry.js`(`GEOMETRY_PX` 一张表 + `rnGeometry`/`taroGeometry` 两个投影 + `TARO_RPX_PER_PX`,照 `radius.js` 形状,配 `geometry.d.ts`,由 `src/index.ts` 出口),**同枚提交即有两端消费方**(`apps/miniapp-taro/src/components/BackChevron.tsx` 与 `packages/app/src/components/BackChevron.tsx` 各自删掉本地 `= 40`/`= 22`/`= 36` 改取投影);取值依据含"移动端墨迹为何不取 web 顶栏的 14px(`TOPBAR_BTN_BASE` 的 `[&>svg]:!h-3.5` 是桌面密集工具条档)"写在该文件头注。**效果实测**:门 128 索引面 BackChevron 从"仅小程序 20 | 仅 RN 22"变成不再出现在差异清单(18 → 17 条),台账删该键(留着即清单腐烂),门禁测试 11/11 仍绿;`@ihui/design-tokens`、`@ihui/rn-app` typecheck 均 0 错误。**另登记一条与本票无关的既有债**:`pnpm --filter @ihui/miniapp-taro typecheck` 在**干净的 HEAD 上**即报 2 错(`src/pkg-ai/ai/chat.tsx:636` 传 `onTerminalDelta` 而 `StreamEventCallbacks` 无此键 + 参数隐式 any)—— 该文件工作树与 HEAD 逐字节相同,故非在飞改动;未擅自"顺手修"(§12 越权红线),留待该键的归属会话收口。③ 在 `packages/shared` 落"与平台无关的组件源 + 每端注入 primitive adapter"的第一例(试点 `BackChevron`:7 个小程序调用点 / 134 个 RN 调用点,API 取两端并集,动作语义留调用方),两端各自构建 + 真机/模拟器像素复核后才允许下调台账(〔真机复核通过@2026-10-14 本席:BackChevron 于 c12617dd 真机渲染正常(意见反馈页左上 `<` 形态/位置符合)且点击正常返回,落地提交 `a90cc00bb3`,门 128 棘轮与 wiring 测试 12/12 前验绿;④ 的下调台账前置已满足〕);④ 按台账读数从大到小逐族收敛(`InputArea` 23 / `BottomActionBar` 19 / `LoginPopUp` 17 / `NavBar` 15 / `IntelligentAssistant` 14 为前 5),每族一票,收完即下调 `counts` 并**在同枚提交里**留下"该组件只剩一份源"的证据;⑤ 确属平台差异的逐条写 `waivers.reason`,由守门 108 管到期。**架构前提(不要再试第二条路)**:单向适配器已失败过一次(2026-09-22 删 4,662 行,"同名 ≠ 同契约"),所以只能"一份源 + 两端注入",不能"一端包另一端";`packages/app` 是 RN 专属(Taro 跑不了),`packages/ui-native` 13 个组件里 11 个零生产消费方,不得当成已交付能力引用。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「O81 · 跨端UI单一源」,派单以那条为准,本行不再单独派单。〕
```

- 原 L9907(L1 外部持有行 L15656):

```
- [ ]O81 跨端 UI 单一源:小程序端与 App(RN)端逐档同值 + 改一端另一端自动生效(除登录方式与平台机制)。**第 1 票已落(本枚提交)**:对账尺 `scripts/check-cross-end-ui-parity.mjs`(guardian **128**,blocking,棘轮锚点 `scripts/cross-end-ui-parity-baseline.json`,自检 19 例 + 门禁 11 例),AGENTS §4 新节 + README 点名。**立项实测读数**:同名配对组件 19 对 / 174 处差异档 / RN 侧 210 个组件用 `StyleSheet.create` 而小程序侧 91 个用 `className=`(两种样式语言 = 结构上无法自动同步的根因)。**已量到的最小心智事实**:两份自称"唯一实现"的 `BackChevron` 图标墨迹 20px vs 22px、色一档取 `--color-foreground` 一档取 `tk.text.medium`、RN 带系统字号缩放倍率而小程序不带。**剩余票(顺序固定,不得跳)**:② **〔x〕 2026-09-26 已落**:几何档 `packages/design-tokens/src/geometry.js`(`GEOMETRY_PX` 一张表 + `rnGeometry`/`taroGeometry` 两个投影 + `TARO_RPX_PER_PX`,照 `radius.js` 形状,配 `geometry.d.ts`,由 `src/index.ts` 出口),**同枚提交即有两端消费方**(`apps/miniapp-taro/src/components/BackChevron.tsx` 与 `packages/app/src/components/BackChevron.tsx` 各自删掉本地 `= 40`/`= 22`/`= 36` 改取投影);取值依据含"移动端墨迹为何不取 web 顶栏的 14px(`TOPBAR_BTN_BASE` 的 `[&>svg]:!h-3.5` 是桌面密集工具条档)"写在该文件头注。**效果实测**:门 128 索引面 BackChevron 从"仅小程序 20 | 仅 RN 22"变成不再出现在差异清单(18 → 17 条),台账删该键(留着即清单腐烂),门禁测试 11/11 仍绿;`@ihui/design-tokens`、`@ihui/rn-app` typecheck 均 0 错误。**另登记一条与本票无关的既有债**:`pnpm --filter @ihui/miniapp-taro typecheck` 在**干净的 HEAD 上**即报 2 错(`src/pkg-ai/ai/chat.tsx:636` 传 `onTerminalDelta` 而 `StreamEventCallbacks` 无此键 + 参数隐式 any)—— 该文件工作树与 HEAD 逐字节相同,故非在飞改动;未擅自"顺手修"(§12 越权红线),留待该键的归属会话收口。③ 在 `packages/shared` 落"与平台无关的组件源 + 每端注入 primitive adapter"的第一例(试点 `BackChevron`:7 个小程序调用点 / 134 个 RN 调用点,API 取两端并集,动作语义留调用方),两端各自构建 + 真机/模拟器像素复核后才允许下调台账(〔真机复核通过@2026-10-14 本席:BackChevron 于 c12617dd 真机渲染正常(意见反馈页左上 `<` 形态/位置符合)且点击正常返回,落地提交 `a90cc00bb3`,门 128 棘轮与 wiring 测试 12/12 前验绿;④ 的下调台账前置已满足〕);④ 按台账读数从大到小逐族收敛(`InputArea` 23 / `BottomActionBar` 19 / `LoginPopUp` 17 / `NavBar` 15 / `IntelligentAssistant` 14 为前 5),每族一票,收完即下调 `counts` 并**在同枚提交里**留下"该组件只剩一份源"的证据;⑤ 确属平台差异的逐条写 `waivers.reason`,由守门 108 管到期。**架构前提(不要再试第二条路)**:单向适配器已失败过一次(2026-09-22 删 4,662 行,"同名 ≠ 同契约"),所以只能"一份源 + 两端注入",不能"一端包另一端";`packages/app` 是 RN 专属(Taro 跑不了),`packages/ui-native` 13 个组件里 11 个零生产消费方,不得当成已交付能力引用。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「O81」,派单以那条为准,本行不再单独派单。〕
```

- 原 L9909(L1 外部持有行 L7607):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7697(G-401) 同题,派单以持有行为准,本行不再单独派单。〕 **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9910(L1 外部持有行 L7607):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7697(G-401) 同题,派单以持有行为准,本行不再单独派单。〕 **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 〔拍板@2026-10-07 机主:两步走——①先给14枚无标注工具补显式dangerLevel(零行为变更);②MCP适配层缺省翻dangerous(要批准),对照上游clientHello事故与#94手机高危无弹窗信任缺陷;cli权限档持有人按此执行〕 〔拍板@2026-10-07 机主:两步走——①先给14枚无标注工具补显式dangerLevel(零行为变更);②MCP适配层缺省翻dangerous(要批准),对照上游clientHello事故与#94手机高危无弹窗信任缺陷;cli权限档持有人按此执行〕
```

- 原 L9911(L1 外部持有行 L15656):

```
- [ ]O81 跨端 UI 单一源:小程序端与 App(RN)端逐档同值 + 改一端另一端自动生效(除登录方式与平台机制)。**第 1 票已落(本枚提交)**:对账尺 `scripts/check-cross-end-ui-parity.mjs`(guardian **128**,blocking,棘轮锚点 `scripts/cross-end-ui-parity-baseline.json`,自检 19 例 + 门禁 11 例),AGENTS §4 新节 + README 点名。**立项实测读数**:同名配对组件 19 对 / 174 处差异档 / RN 侧 210 个组件用 `StyleSheet.create` 而小程序侧 91 个用 `className=`(两种样式语言 = 结构上无法自动同步的根因)。**已量到的最小心智事实**:两份自称"唯一实现"的 `BackChevron` 图标墨迹 20px vs 22px、色一档取 `--color-foreground` 一档取 `tk.text.medium`、RN 带系统字号缩放倍率而小程序不带。**剩余票(顺序固定,不得跳)**:② **〔x〕 2026-09-26 已落**:几何档 `packages/design-tokens/src/geometry.js`(`GEOMETRY_PX` 一张表 + `rnGeometry`/`taroGeometry` 两个投影 + `TARO_RPX_PER_PX`,照 `radius.js` 形状,配 `geometry.d.ts`,由 `src/index.ts` 出口),**同枚提交即有两端消费方**(`apps/miniapp-taro/src/components/BackChevron.tsx` 与 `packages/app/src/components/BackChevron.tsx` 各自删掉本地 `= 40`/`= 22`/`= 36` 改取投影);取值依据含"移动端墨迹为何不取 web 顶栏的 14px(`TOPBAR_BTN_BASE` 的 `[&>svg]:!h-3.5` 是桌面密集工具条档)"写在该文件头注。**效果实测**:门 128 索引面 BackChevron 从"仅小程序 20 | 仅 RN 22"变成不再出现在差异清单(18 → 17 条),台账删该键(留着即清单腐烂),门禁测试 11/11 仍绿;`@ihui/design-tokens`、`@ihui/rn-app` typecheck 均 0 错误。**另登记一条与本票无关的既有债**:`pnpm --filter @ihui/miniapp-taro typecheck` 在**干净的 HEAD 上**即报 2 错(`src/pkg-ai/ai/chat.tsx:636` 传 `onTerminalDelta` 而 `StreamEventCallbacks` 无此键 + 参数隐式 any)—— 该文件工作树与 HEAD 逐字节相同,故非在飞改动;未擅自"顺手修"(§12 越权红线),留待该键的归属会话收口。③ 在 `packages/shared` 落"与平台无关的组件源 + 每端注入 primitive adapter"的第一例(试点 `BackChevron`:7 个小程序调用点 / 134 个 RN 调用点,API 取两端并集,动作语义留调用方),两端各自构建 + 真机/模拟器像素复核后才允许下调台账(〔真机复核通过@2026-10-14 本席:BackChevron 于 c12617dd 真机渲染正常(意见反馈页左上 `<` 形态/位置符合)且点击正常返回,落地提交 `a90cc00bb3`,门 128 棘轮与 wiring 测试 12/12 前验绿;④ 的下调台账前置已满足〕);④ 按台账读数从大到小逐族收敛(`InputArea` 23 / `BottomActionBar` 19 / `LoginPopUp` 17 / `NavBar` 15 / `IntelligentAssistant` 14 为前 5),每族一票,收完即下调 `counts` 并**在同枚提交里**留下"该组件只剩一份源"的证据;⑤ 确属平台差异的逐条写 `waivers.reason`,由守门 108 管到期。**架构前提(不要再试第二条路)**:单向适配器已失败过一次(2026-09-22 删 4,662 行,"同名 ≠ 同契约"),所以只能"一份源 + 两端注入",不能"一端包另一端";`packages/app` 是 RN 专属(Taro 跑不了),`packages/ui-native` 13 个组件里 11 个零生产消费方,不得当成已交付能力引用。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「O81 · 跨端UI单一源」,派单以那条为准,本行不再单独派单。〕
```

- 原 L9912(L1 外部持有行 L15656):

```
- [ ]O81 跨端 UI 单一源:小程序端与 App(RN)端逐档同值 + 改一端另一端自动生效(除登录方式与平台机制)。**第 1 票已落(本枚提交)**:对账尺 `scripts/check-cross-end-ui-parity.mjs`(guardian **128**,blocking,棘轮锚点 `scripts/cross-end-ui-parity-baseline.json`,自检 19 例 + 门禁 11 例),AGENTS §4 新节 + README 点名。**立项实测读数**:同名配对组件 19 对 / 174 处差异档 / RN 侧 210 个组件用 `StyleSheet.create` 而小程序侧 91 个用 `className=`(两种样式语言 = 结构上无法自动同步的根因)。**已量到的最小心智事实**:两份自称"唯一实现"的 `BackChevron` 图标墨迹 20px vs 22px、色一档取 `--color-foreground` 一档取 `tk.text.medium`、RN 带系统字号缩放倍率而小程序不带。**剩余票(顺序固定,不得跳)**:② **〔x〕 2026-09-26 已落**:几何档 `packages/design-tokens/src/geometry.js`(`GEOMETRY_PX` 一张表 + `rnGeometry`/`taroGeometry` 两个投影 + `TARO_RPX_PER_PX`,照 `radius.js` 形状,配 `geometry.d.ts`,由 `src/index.ts` 出口),**同枚提交即有两端消费方**(`apps/miniapp-taro/src/components/BackChevron.tsx` 与 `packages/app/src/components/BackChevron.tsx` 各自删掉本地 `= 40`/`= 22`/`= 36` 改取投影);取值依据含"移动端墨迹为何不取 web 顶栏的 14px(`TOPBAR_BTN_BASE` 的 `[&>svg]:!h-3.5` 是桌面密集工具条档)"写在该文件头注。**效果实测**:门 128 索引面 BackChevron 从"仅小程序 20 | 仅 RN 22"变成不再出现在差异清单(18 → 17 条),台账删该键(留着即清单腐烂),门禁测试 11/11 仍绿;`@ihui/design-tokens`、`@ihui/rn-app` typecheck 均 0 错误。**另登记一条与本票无关的既有债**:`pnpm --filter @ihui/miniapp-taro typecheck` 在**干净的 HEAD 上**即报 2 错(`src/pkg-ai/ai/chat.tsx:636` 传 `onTerminalDelta` 而 `StreamEventCallbacks` 无此键 + 参数隐式 any)—— 该文件工作树与 HEAD 逐字节相同,故非在飞改动;未擅自"顺手修"(§12 越权红线),留待该键的归属会话收口。③ 在 `packages/shared` 落"与平台无关的组件源 + 每端注入 primitive adapter"的第一例(试点 `BackChevron`:7 个小程序调用点 / 134 个 RN 调用点,API 取两端并集,动作语义留调用方),两端各自构建 + 真机/模拟器像素复核后才允许下调台账(〔真机复核通过@2026-10-14 本席:BackChevron 于 c12617dd 真机渲染正常(意见反馈页左上 `<` 形态/位置符合)且点击正常返回,落地提交 `a90cc00bb3`,门 128 棘轮与 wiring 测试 12/12 前验绿;④ 的下调台账前置已满足〕);④ 按台账读数从大到小逐族收敛(`InputArea` 23 / `BottomActionBar` 19 / `LoginPopUp` 17 / `NavBar` 15 / `IntelligentAssistant` 14 为前 5),每族一票,收完即下调 `counts` 并**在同枚提交里**留下"该组件只剩一份源"的证据;⑤ 确属平台差异的逐条写 `waivers.reason`,由守门 108 管到期。**架构前提(不要再试第二条路)**:单向适配器已失败过一次(2026-09-22 删 4,662 行,"同名 ≠ 同契约"),所以只能"一份源 + 两端注入",不能"一端包另一端";`packages/app` 是 RN 专属(Taro 跑不了),`packages/ui-native` 13 个组件里 11 个零生产消费方,不得当成已交付能力引用。 〔【归并】重复登记副本(2026-10-01):同主键的另一条登记 「O81 · 跨端UI单一源」,派单以那条为准,本行不再单独派单。〕
```

- 原 L9913(L1 外部持有行 L7607):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7697(G-401) 同题,派单以持有行为准,本行不再单独派单。〕 **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L9914(L1 外部持有行 L15672):

```
- [ ]〔【归并】重复登记副本(2026-09-28,幂等折叠):这一行与同题的持有行是同一件事,持有行是「门 8 清账后遗留的三枚"有消费方的待实装路由"…」那一条待办(按标题前缀寻行;指针里既不写编号也不写行号 —— 写了编号就会被台账取成这条副本自己的主键,折叠反而新增撞号,这是今天实测到的成因)。本行摘掉编号、只留指针,不翻勾、不并抄、正文逐字保留。〕 **门 8 清账后遗留的三枚"有消费方的待实装路由"(2026-09-28 登记,现读=基线仅剩 3 处)**:① `GET /api/subagents/all` —— 消费者 `apps/web/app/(main)/agent-teams/page.tsx:58`(期望 `{dispatches}` 含 completed/failed/cancelled 全量);后端只有 `/subagents/active`(仅 pending/running,形状恰好相同但语义是子集,**不得**为省事把客户端改道 active —— 那会把"页面少了历史"写成"已修")。正解 = 在 `subagent-dispatch.ts` 补 all 列表路由(带 status/limit 透传)。②③ `PUT /api/ai/n8n/workflows/:id` 与 `POST .../toggle` —— 消费者 `apps/mobile-rn/src/screens/N8nModelScreen.tsx:146/192`(保存改名/启停今天必 404);后端 n8n 面只有列表透传与创建转发(miniapp-compat-routes.ts:1123/1190),n8n REST API 本身支持 workflows/:id 更新与 activate/deactivate,正解 = 在 n8n 代理补两枚透传(SSRF 校验与 env 缺省回 stub 的既有纪律照抄)。验收判据:两枚消费者页面真机/真会话各跑一次成功路径 + 基线 `scripts/api-routes-baseline.json` 清零 + 门 8 末行现读 0。**归属**:subagent 面 = agent-teams 线;n8n 两面 = n8n 代理持有人(本票只登记形状与消费者证据,不代裁实现位置)。 〔落地@2026-09-28/枚 2704c4d27〕三枚路由已入库:subagents/all(新→旧+status/limit)、/ai/n8n/workflows 面四枚(list stub/写 503/fetch-merge-put/toggle 回读真值);apps/api/tests/g299-new-routes.test.ts 4 例绿、门 8 死调用清零、基线 perFileCount 清表。**本票未翻勾的唯一理由=验收判据第一条未跑**:RN N8nModelScreen 真机走查(本机无设备)与 agent-teams 页真会话 200 取证(需起栈)——路由与契约已证,运行时成功路径待验,不得以单测冒充真机。（编号改派留痕:本行原登记为「G-299. 门 8 清账后遗留的三枚…」,与「本机交付被远端分支保护拒收」撞成一号两事;2026-09-28 由 live-doc-edit 的取号令牌在每次 CAS 里按当下 HEAD 现算改派为 G-312,旧编号在此留原文,便于任何按旧号引用的人查得到去向,而不是让它静默消失） —— 沿革:G-299→G-312→G-334(两次都被别的登记占去,每次都在行尾留原文)。**[重复登记副本]** 同一件事在 origin 侧以「G-316. 门 8 清账后遗留的三枚…」另登过一次,当前状态持有行按那条走,本行不翻勾、不并抄。 (原编号 G-334)
```

- 原 L9915(L1 外部持有行 L15672):

```
- [ ]〔【归并】重复登记副本(2026-09-28,幂等折叠):这一行与同题的持有行是同一件事,持有行是「门 8 清账后遗留的三枚"有消费方的待实装路由"…」那一条待办(按标题前缀寻行 —— 指针里既不写编号也不写行号:编号落在正文前 48 字符内会被台账取成本行的主键,折叠反而新增撞号)。本行摘掉编号、只留指针,不翻勾、不并抄、正文逐字保留。〕 **门 8 清账后遗留的三枚"有消费方的待实装路由"(2026-09-28 登记,现读=基线仅剩 3 处)**:① `GET /api/subagents/all` —— 消费者 `apps/web/app/(main)/agent-teams/page.tsx:58`(期望 `{dispatches}` 含 completed/failed/cancelled 全量);后端只有 `/subagents/active`(仅 pending/running,形状恰好相同但语义是子集,**不得**为省事把客户端改道 active —— 那会把"页面少了历史"写成"已修")。正解 = 在 `subagent-dispatch.ts` 补 all 列表路由(带 status/limit 透传)。②③ `PUT /api/ai/n8n/workflows/:id` 与 `POST .../toggle` —— 消费者 `apps/mobile-rn/src/screens/N8nModelScreen.tsx:146/192`(保存改名/启停今天必 404);后端 n8n 面只有列表透传与创建转发(miniapp-compat-routes.ts:1123/1190),n8n REST API 本身支持 workflows/:id 更新与 activate/deactivate,正解 = 在 n8n 代理补两枚透传(SSRF 校验与 env 缺省回 stub 的既有纪律照抄)。验收判据:两枚消费者页面真机/真会话各跑一次成功路径 + 基线 `scripts/api-routes-baseline.json` 清零 + 门 8 末行现读 0。**归属**:subagent 面 = agent-teams 线;n8n 两面 = n8n 代理持有人(本票只登记形状与消费者证据,不代裁实现位置)。 〔落地@2026-09-28/枚 2704c4d27〕三枚路由已入库:subagents/all(新→旧+status/limit)、/ai/n8n/workflows 面四枚(list stub/写 503/fetch-merge-put/toggle 回读真值);apps/api/tests/g299-new-routes.test.ts 4 例绿、门 8 死调用清零、基线 perFileCount 清表。**本票未翻勾的唯一理由=验收判据第一条未跑**:RN N8nModelScreen 真机走查(本机无设备)与 agent-teams 页真会话 200 取证(需起栈)——路由与契约已证,运行时成功路径待验,不得以单测冒充真机。（编号改派留痕:本行原登记为「G-299. 门 8 清账后遗留的三枚…」,与「本机交付被远端分支保护拒收」撞成一号两事;2026-09-28 由 live-doc-edit 的取号令牌在每次 CAS 里按当下 HEAD 现算改派为 G-312,旧编号在此留原文,便于任何按旧号引用的人查得到去向,而不是让它静默消失） —— 沿革:G-299→G-312→G-334(两次都被别的登记占去,每次都在行尾留原文)。**[重复登记副本]** 同一件事在 origin 侧以「G-316. 门 8 清账后遗留的三枚…」另登过一次,当前状态持有行按那条走,本行不翻勾、不并抄。 (原编号 G-334)
```

- 原 L9986(L1 外部持有行 L15579):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-10-08·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-394 **MemberCard 把"没量到"显示成 0(第八轮对照逼出;归属:web 首页持有者;等 §17 运行时自验排期)** —— `apps/web/src/components/home/MemberCard.tsx:72-73` 现读 `stats?.points ?? 0` / `wallet?.balance ?? 0`,查询未回或失败时显示"0 分""0 余额"。上游同族口径是"订阅未知不能发布为成功空快照"(`packages/services/src/usage-stats/providers/bigmodelUsageQuotaProvider.ts:259` 原文)加展示层 `'--'` 占位。**为什么还开着**:属 UI 改动,§17 要求起 dev + 读 DOM 数值自验,本票未做该项;改法是 `number | null` + 占位,不动判据、无恒红风险。**这一条不是"抄上游功能",是把"未知"与"为零"分开** —— 后者是数据事故,前者是显示诚实。 (原编号 G-G-355 系改派工具把前缀重复贴了一次:尺子会把它读成 G-355 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4 —— 现取新号,正文逐字未动) (原编号 G-394;持有行题面「MemberCard把"没量到"显示成0」)
```

- 原 L10000(L1 外部持有行 L10011):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-09 批⑦执行):本行与同题持有行重复,现摘掉声明位编号只留指针;注记逐字携带原加粗头原文「G-1058623 RN 与 api-client 三处接口路径多写一段 `agents`,运行时必 404(守门 8 报的真缺口,2026-10-05 现读三段取证)」,是为了让守门 71 的原文前缀判据(标记 = 加粗头前 ≤18 字,遇 * 即停)继续命中 —— 该门明写刻意不给「正文仍在即视为搬家」的豁免,所以摘号必须把原文留在行内,否则下一轮自愈会把旧号行整条捞回(批⑤ 至今「复活再摘」四轮即此循环)。派单以 G-73 持有行 为准,正文逐字保留,不翻勾、不并抄。〕**RN 与 api-client 三处接口路径多写一段 `agents`,运行时必 404(守门 8 报的真缺口,2026-10-05 现读三段取证)**:① 端内 `apps/mobile-rn/src/screens/HomeScreen.tsx:569` 写 `/cozeZhsApi/agents/collect`,门 8 归一为 `/api/agents/collect`;而后端 `apps/api/src/routes/agents.ts:1567` 注册的是 `server.post('/collect')`,经 `apps/api/src/routes/index.ts:646` 的 `server.register(agentsRoutes, { prefix: '/api' })` 挂载 ⇒ 实际路径是 **`/api/collect`**,**差一段 `agents`**。② `:577` 的 `/cozeZhsApi/agents/thumbs` 同型(后端 `agents.ts:1552` 注册 `/thumbs` ⇒ 实际 `/api/thumbs`)。③ `packages/api-client/src/endpoints/agent.ts:97` 的 `/cozeZhsApi/cache/agent-category-dict/categories` ⇒ 归一 `/api/cache/agent-category-dict/categories`,`apps/api/src/routes/` 下 **0 命中**该路径。**修法**:三处端内路径去掉多写的那一段;或后端补挂 `agents` 段(**属对外契约变更,需机主定**)。**验收**:改后 `node scripts/check-api-routes.mjs` 末行不再出现这三处「后端**不在册**」,且 RN 收藏/点赞真机点得动。注意守门 8 按设计**只报数不判红**(§12e)⇒ 这条不会自己变红,必须靠人收口。⚠️ 三处**不可**批量正则替换(端内还可能有真的 `/agents/...` 路由),必须逐条比对后端注册面。 〔拍板③@2026-10-06:新建公开双键字典端点,注册在客户端既有调用路径(4 调用方+api-client 零改动);实施 agent 在飞〕
```

- 原 L10001(L1 外部持有行 L15878):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-09 批⑦执行):本行与同题持有行重复,现摘掉声明位编号只留指针;注记逐字携带原加粗头原文「G-1058623 RN 三处接口路径多写一段 `agents`(守门 8 报的真缺口;2026-10-06 部分收口,① ② 已修并入库 `f3bf8bd3fc`,③ 待机主定)」,是为了让守门 71 的原文前缀判据(标记 = 加粗头前 ≤18 字,遇 * 即停)继续命中 —— 该门明写刻意不给「正文仍在即视为搬家」的豁免,所以摘号必须把原文留在行内,否则下一轮自愈会把旧号行整条捞回(批⑤ 至今「复活再摘」四轮即此循环)。派单以 G-73 持有行 为准,正文逐字保留,不翻勾、不并抄。〕**RN 三处接口路径多写一段 `agents`(守门 8 报的真缺口;2026-10-06 部分收口,① ② 已修并入库 `f3bf8bd3fc`,③ 待机主定)** ——原票面三处里**只有 2 处是路径错**:`HomeScreen.tsx` 的收藏/点赞(① ②)确为多写一段 `agents`(后端 `agents.ts:1567` 是 `server.post('/collect')`、`:1552` 是 `server.post('/thumbs')`，`routes/index.ts:646` 挂 `prefix: "/api"` 且 agentsRoutes 内**无二级 prefix** => 实际 `/api/collect`、`/api/thumbs`)，已改为 `/api/collect` / `/api/thumbs` 并入库(`f3bf8bd3fc`)。**为什么连 `/cozeZhsApi` 一起换成 `/api`**:normalizeUrl 对两者等价(行为零变化)，但守门 8 的 `pathRe` 只认引号紧邻的 `/api/`，`/cozeZhsApi` 永远落在豁免桶里 => 改后才**进入判红调用集**，从此有判据兜住。验收:`check-api-routes.mjs --worktree`「后端不在册」**3 处 → 1 处**;变异(① 改回原路径)⇒ 复现 2 处。⚠️ **口径坑:守门 8 默认面是 HEAD blob 不是工作树**(`check-api-routes.mjs:3553-3559`)⇒ 改后必须加 `--worktree` 才看得到读数变化，不加旗标读数必然不变，别误读成「改动无效」。⚠️ **注释里写路径一律不带引号和反引号** —— `pathRe` 字符类把**反引号与引号同等**，本轮首版注释用反引号包路径，当场被抽成一条真死调用、门 exit 1(已改并留痕)。 ——**③ 另案:不是路径写错，是缺后端实现**。`packages/api-client/src/endpoints/agent.ts:97` 的 `/api/cache/agent-category-dict/categories` 后端 0 命中且**无等价路由**;`getAgentCategories` **不是死代码**(4 个真实 RN 调用方:HomeScreen/PlazaScreen/AgentScreen/AiAssistantScreen)。名字最近的 `agent-categories-cache.ts` 有两点硬差异:① `addHook(preHandler, requireAdmin)` 管理员专属;② 返回体 `{items,total,page,pageSize,lastRefreshedAt}` ≠ 端内要的 `{agentCategory, agentMainCategory}` 双键并列。**未擅自新增路由**(=新造对外契约，机主职权)，`diff -q` 证明该文件逐字未动。**待机主定**:① 新建公开双键字典端点(契约新增)，还是 ② 改端内去调既有 `/api/categories/list` 一类(返回体形状不同，4 个调用方取值逻辑要跟着改)。**风险低**:4 个调用方全有静态 fallback (`PLAZA_CATEGORY_FALLBACK` 等)，当前 404 只导致筛选弹层降级为静态占位，**不崩、不白屏**，可从容决策。顺带发现(同型死常量，未动):`apps/web/src/config/backend-paths.ts:64-65` 的 `${COZE}/agents/thumbs`/`collect`，`AGENTS_PATHS` 零消费方故无线上影响。**③ 收口后本票即可整条翻勾。** **【2026-10-06 追加现读:这一格比票面写的更彻底 —— 不是 2 行死常量,是整张 `ROUTE_MAP` 零消费(纯只读,未动代码)】**:`AGENTS_PATHS` 的真实消费面**只有 1 处** —— 同文件 `ROUTE_MAP['/agents']`(`backend-paths.ts:241`),而 `getPathsByRoute` / `ROUTE_MAP` / `BackendRouteKey` 三者在整个 `apps/web/src` 与全仓(`.ts/.tsx/.mts`)**各自只有定义处 1 个命中、零调用方、零测试钉子** ⇒ **这张表本身就是死的**,所以 `thumbs`/`collect` 那两个错路径永远不会被任何页面取到(与 RN 那两处不同:RN 是活调用会真404)。**更狠的一层**:该文件导出 **14 个路径组**,**只有 `OPENCLAW_PATHS` 有外部 import**(`apps/web/src/lib/openclaw-api.ts:6`,活的);其余 `AUTH_PATHS`/`AI_PATHS`/`FILE_PATHS`/`WS_PATHS`/`AGENTS_PATHS`/`STATISTICS_PATHS`/`SERVICE_APPOINTMENT_PATHS`/`NOTIFICATION_PATHS`/`CUSTOMER_SERVICE_PATHS`/`WALLET_PATHS`/`TOOLS_PATHS`/`CONTENT_PATHS`/`UPLOAD_PATHS`/`USER_SETTINGS_PATHS` **13 组全被这张死表引用或零引用** ⇒ 典型"旧架构整体搬运后没人接线的遗留面"(文件头自述"等价自旧架构 client/src/config/backend-paths.ts")。**为什么本会话不删(留给机主拍板,属 §1/§12e 边界)**:① 删表会一次性带走 14 个导出符号,虽现读零消费,但 `apps/web` 处于**多会话在飞态**(主索引里 `PROJECT_PLAN.md` 已被他人暂存),他人 in-flight 改动若正引用这些符号,删除会让他的构建红在半路且难以归因;② 票面原话是"同型死常量,**无线上影响**"⇒ **收益是纯清理,不是止血**,优先级低于任何真缺口;③ 真要动手,正解**不是删文件**而是先给 `getPathsByRoute` 补一个调用方(把死表接活)或整体删除并在同枚里留指针,**二选一是产品口径**(这张表原设计意图是"按页面查所需 API",可能原计划接一个 API 文档页/调试面板),不该由 agent 代裁。**已核实可排除的两条猜测**:① 不是"路径写错导致线上 404" —— 零消费方,无调用即无请求;② 不是"测试没覆盖导致漏判" —— 全仓无任何测试 import 本文件,删掉不会破测试。**建议(供机主拍板时参考)**:选"整体删除 + 在本行留指针",因为保留一张零消费的表只会持续骗后来人(本轮就有另一个 agent 因为它以为`${COZE}/agents/thumbs` 是活路径而去核对后端)。 〔拍板③@2026-10-06:新建公开双键字典端点,注册在客户端既有调用路径(4 调用方+api-client 零改动);实施 agent 在飞〕**【2026-10-06 死表删除已落地(档 B收口,入库 `31872798562`):本行建议的「整体删除」已执行】**删除前取证走**四通道**(HEAD面 / 暂存区 / 未跟踪 / 工作树当前内容),结论一致:18 个 export 里只有 `OPENCLAW_PATHS` 被真实消费(唯一消费方 `apps/web/src/lib/openclaw-api.ts`,29 处引用);另 14 组路径常量与 `ROUTE_MAP` / `BackendRouteKey` / `getPathsByRoute` 零调用方、零测试钉子。**删的是内容不是文件** —— 整文件删除会连带带走唯一活着的 `OPENCLAW_PATHS`,故保留文件只留活表:**257 行 → 81 行**(−191/+15),水印头尾逐字未动。**保留 `OPENCLAW_PATHS` 全部 8 个子对象(含当前零调用的 `sessions`/`stats`)**:活着的路径表按域完整列出是**契约语义**,按当前调用点裁剪等于把契约表降级成调用点快照;死常量是「整组无人碰」,与此不同类。**甄别过的同名不同物**(删对了、不是漏删):`AGENTS_PATHS` 另有一处是 `apps/ai-service/tests/test_privileged_surface_auth_59.py` 的 Python 局部元组;`ROUTE_MAP` 另有一处是 `apps/miniapp-taro/src/pkg-user/favorites/index.tsx` 该端自己的路由映射。**验收**:`apps/web` tsc `--noEmit` 20 条错误**全部**落在他人 in-flight 文件(`MessageList.tsx` / `windowing.ts` / `checkpoint-rewind-undo-claim.test.tsx` / `LivePlayer.tsx`),无一指向本文件或 `openclaw-api.ts`,且这 4 个文件对本文件**零引用** ⇒ 因果无关;水印 verify 通过;落地 5 道预检(水印 / 悬空引用 / 门 98 / CAS / 提交面回读)全过。**本票剩下的 ③ 仍待实施 agent 收口,与本条删除互不依赖。**
```

- 原 L10002(L1 外部持有行 L10011):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-09 批⑥执行):声明位 G-1058623 已摘,派单以持有行「RN 三处接口路径多写一段 `agents`」为准,正文逐字保留。〕**RN 与 api-client 三处接口路径多写一段 `agents`,运行时必 404(守门 8 报的真缺口,2026-10-05 现读三段取证)**:① 端内 `apps/mobile-rn/src/screens/HomeScreen.tsx:569` 写 `/cozeZhsApi/agents/collect`,门 8 归一为 `/api/agents/collect`;而后端 `apps/api/src/routes/agents.ts:1567` 注册的是 `server.post('/collect')`,经 `apps/api/src/routes/index.ts:646` 的 `server.register(agentsRoutes, { prefix: '/api' })` 挂载 ⇒ 实际路径是 **`/api/collect`**,**差一段 `agents`**。② `:577` 的 `/cozeZhsApi/agents/thumbs` 同型(后端 `agents.ts:1552` 注册 `/thumbs` ⇒ 实际 `/api/thumbs`)。③ `packages/api-client/src/endpoints/agent.ts:97` 的 `/cozeZhsApi/cache/agent-category-dict/categories` ⇒ 归一 `/api/cache/agent-category-dict/categories`,`apps/api/src/routes/` 下 **0 命中**该路径。**修法**:三处端内路径去掉多写的那一段;或后端补挂 `agents` 段(**属对外契约变更,需机主定**)。**验收**:改后 `node scripts/check-api-routes.mjs` 末行不再出现这三处「后端**不在册**」,且 RN 收藏/点赞真机点得动。注意守门 8 按设计**只报数不判红**(§12e)⇒ 这条不会自己变红,必须靠人收口。⚠️ 三处**不可**批量正则替换(端内还可能有真的 `/agents/...` 路由),必须逐条比对后端注册面。 〔拍板③@2026-10-06:新建公开双键字典端点,注册在客户端既有调用路径(4 调用方+api-client 零改动);实施 agent 在飞〕
```

- 原 L10003(L1 外部持有行 L15879):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-09 批⑤复活再摘④):原号留归 F1 判据票,复活旧态摘号留指针,正文逐字保留;同题以「RN 三处接口路径多写一段」按标题前缀寻行。〕RN 与 api-client 三处接口路径多写一段 `agents`,运行时必 404(守门 8 报的真缺口,2026-10-05 现读三段取证)**:① 端内 `apps/mobile-rn/src/screens/HomeScreen.tsx:569` 写 `/cozeZhsApi/agents/collect`,门 8 归一为 `/api/agents/collect`;而后端 `apps/api/src/routes/agents.ts:1567` 注册的是 `server.post('/collect')`,经 `apps/api/src/routes/index.ts:646` 的 `server.register(agentsRoutes, { prefix: '/api' })` 挂载 ⇒ 实际路径是 **`/api/collect`**,**差一段 `agents`**。② `:577` 的 `/cozeZhsApi/agents/thumbs` 同型(后端 `agents.ts:1552` 注册 `/thumbs` ⇒ 实际 `/api/thumbs`)。③ `packages/api-client/src/endpoints/agent.ts:97` 的 `/cozeZhsApi/cache/agent-category-dict/categories` ⇒ 归一 `/api/cache/agent-category-dict/categories`,`apps/api/src/routes/` 下 **0 命中**该路径。**修法**:三处端内路径去掉多写的那一段;或后端补挂 `agents` 段(**属对外契约变更,需机主定**)。**验收**:改后 `node scripts/check-api-routes.mjs` 末行不再出现这三处「后端**不在册**」,且 RN 收藏/点赞真机点得动。注意守门 8 按设计**只报数不判红**(§12e)⇒ 这条不会自己变红,必须靠人收口。⚠️ 三处**不可**批量正则替换(端内还可能有真的 `/agents/...` 路由),必须逐条比对后端注册面。 〔拍板③@2026-10-06:新建公开双键字典端点,注册在客户端既有调用路径(4 调用方+api-client 零改动);实施 agent 在飞〕
```

- 原 L10004(L1 外部持有行 L15880):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-09 批⑤复活再摘④):本行已让号至 G-73(持行在面),复活旧态摘号留指针,正文逐字保留。〕RN 三处接口路径多写一段 `agents`(守门 8 报的真缺口;2026-10-06 部分收口,① ② 已修并入库 `f3bf8bd3fc`,③ 待机主定)** ——原票面三处里**只有 2 处是路径错**:`HomeScreen.tsx` 的收藏/点赞(① ②)确为多写一段 `agents`(后端 `agents.ts:1567` 是 `server.post('/collect')`、`:1552` 是 `server.post('/thumbs')`，`routes/index.ts:646` 挂 `prefix: "/api"` 且 agentsRoutes 内**无二级 prefix** => 实际 `/api/collect`、`/api/thumbs`)，已改为 `/api/collect` / `/api/thumbs` 并入库(`f3bf8bd3fc`)。**为什么连 `/cozeZhsApi` 一起换成 `/api`**:normalizeUrl 对两者等价(行为零变化)，但守门 8 的 `pathRe` 只认引号紧邻的 `/api/`，`/cozeZhsApi` 永远落在豁免桶里 => 改后才**进入判红调用集**，从此有判据兜住。验收:`check-api-routes.mjs --worktree`「后端不在册」**3 处 → 1 处**;变异(① 改回原路径)⇒ 复现 2 处。⚠️ **口径坑:守门 8 默认面是 HEAD blob 不是工作树**(`check-api-routes.mjs:3553-3559`)⇒ 改后必须加 `--worktree` 才看得到读数变化，不加旗标读数必然不变，别误读成「改动无效」。⚠️ **注释里写路径一律不带引号和反引号** —— `pathRe` 字符类把**反引号与引号同等**，本轮首版注释用反引号包路径，当场被抽成一条真死调用、门 exit 1(已改并留痕)。 ——**③ 另案:不是路径写错，是缺后端实现**。`packages/api-client/src/endpoints/agent.ts:97` 的 `/api/cache/agent-category-dict/categories` 后端 0 命中且**无等价路由**;`getAgentCategories` **不是死代码**(4 个真实 RN 调用方:HomeScreen/PlazaScreen/AgentScreen/AiAssistantScreen)。名字最近的 `agent-categories-cache.ts` 有两点硬差异:① `addHook(preHandler, requireAdmin)` 管理员专属;② 返回体 `{items,total,page,pageSize,lastRefreshedAt}` ≠ 端内要的 `{agentCategory, agentMainCategory}` 双键并列。**未擅自新增路由**(=新造对外契约，机主职权)，`diff -q` 证明该文件逐字未动。**待机主定**:① 新建公开双键字典端点(契约新增)，还是 ② 改端内去调既有 `/api/categories/list` 一类(返回体形状不同，4 个调用方取值逻辑要跟着改)。**风险低**:4 个调用方全有静态 fallback (`PLAZA_CATEGORY_FALLBACK` 等)，当前 404 只导致筛选弹层降级为静态占位，**不崩、不白屏**，可从容决策。顺带发现(同型死常量，未动):`apps/web/src/config/backend-paths.ts:64-65` 的 `${COZE}/agents/thumbs`/`collect`，`AGENTS_PATHS` 零消费方故无线上影响。**③ 收口后本票即可整条翻勾。** **【2026-10-06 追加现读:这一格比票面写的更彻底 —— 不是 2 行死常量,是整张 `ROUTE_MAP` 零消费(纯只读,未动代码)】**:`AGENTS_PATHS` 的真实消费面**只有 1 处** —— 同文件 `ROUTE_MAP['/agents']`(`backend-paths.ts:241`),而 `getPathsByRoute` / `ROUTE_MAP` / `BackendRouteKey` 三者在整个 `apps/web/src` 与全仓(`.ts/.tsx/.mts`)**各自只有定义处 1 个命中、零调用方、零测试钉子** ⇒ **这张表本身就是死的**,所以 `thumbs`/`collect` 那两个错路径永远不会被任何页面取到(与 RN 那两处不同:RN 是活调用会真404)。**更狠的一层**:该文件导出 **14 个路径组**,**只有 `OPENCLAW_PATHS` 有外部 import**(`apps/web/src/lib/openclaw-api.ts:6`,活的);其余 `AUTH_PATHS`/`AI_PATHS`/`FILE_PATHS`/`WS_PATHS`/`AGENTS_PATHS`/`STATISTICS_PATHS`/`SERVICE_APPOINTMENT_PATHS`/`NOTIFICATION_PATHS`/`CUSTOMER_SERVICE_PATHS`/`WALLET_PATHS`/`TOOLS_PATHS`/`CONTENT_PATHS`/`UPLOAD_PATHS`/`USER_SETTINGS_PATHS` **13 组全被这张死表引用或零引用** ⇒ 典型"旧架构整体搬运后没人接线的遗留面"(文件头自述"等价自旧架构 client/src/config/backend-paths.ts")。**为什么本会话不删(留给机主拍板,属 §1/§12e 边界)**:① 删表会一次性带走 14 个导出符号,虽现读零消费,但 `apps/web` 处于**多会话在飞态**(主索引里 `PROJECT_PLAN.md` 已被他人暂存),他人 in-flight 改动若正引用这些符号,删除会让他的构建红在半路且难以归因;② 票面原话是"同型死常量,**无线上影响**"⇒ **收益是纯清理,不是止血**,优先级低于任何真缺口;③ 真要动手,正解**不是删文件**而是先给 `getPathsByRoute` 补一个调用方(把死表接活)或整体删除并在同枚里留指针,**二选一是产品口径**(这张表原设计意图是"按页面查所需 API",可能原计划接一个 API 文档页/调试面板),不该由 agent 代裁。**已核实可排除的两条猜测**:① 不是"路径写错导致线上 404" —— 零消费方,无调用即无请求;② 不是"测试没覆盖导致漏判" —— 全仓无任何测试 import 本文件,删掉不会破测试。**建议(供机主拍板时参考)**:选"整体删除 + 在本行留指针",因为保留一张零消费的表只会持续骗后来人(本轮就有另一个 agent 因为它以为`${COZE}/agents/thumbs` 是活路径而去核对后端)。 〔拍板③@2026-10-06:新建公开双键字典端点,注册在客户端既有调用路径(4 调用方+api-client 零改动);实施 agent 在飞〕**【2026-10-06 死表删除已落地(档 B收口,入库 `31872798562`):本行建议的「整体删除」已执行】**删除前取证走**四通道**(HEAD面 / 暂存区 / 未跟踪 / 工作树当前内容),结论一致:18 个 export 里只有 `OPENCLAW_PATHS` 被真实消费(唯一消费方 `apps/web/src/lib/openclaw-api.ts`,29 处引用);另 14 组路径常量与 `ROUTE_MAP` / `BackendRouteKey` / `getPathsByRoute` 零调用方、零测试钉子。**删的是内容不是文件** —— 整文件删除会连带带走唯一活着的 `OPENCLAW_PATHS`,故保留文件只留活表:**257 行 → 81 行**(−191/+15),水印头尾逐字未动。**保留 `OPENCLAW_PATHS` 全部 8 个子对象(含当前零调用的 `sessions`/`stats`)**:活着的路径表按域完整列出是**契约语义**,按当前调用点裁剪等于把契约表降级成调用点快照;死常量是「整组无人碰」,与此不同类。**甄别过的同名不同物**(删对了、不是漏删):`AGENTS_PATHS` 另有一处是 `apps/ai-service/tests/test_privileged_surface_auth_59.py` 的 Python 局部元组;`ROUTE_MAP` 另有一处是 `apps/miniapp-taro/src/pkg-user/favorites/index.tsx` 该端自己的路由映射。**验收**:`apps/web` tsc `--noEmit` 20 条错误**全部**落在他人 in-flight 文件(`MessageList.tsx` / `windowing.ts` / `checkpoint-rewind-undo-claim.test.tsx` / `LivePlayer.tsx`),无一指向本文件或 `openclaw-api.ts`,且这 4 个文件对本文件**零引用** ⇒ 因果无关;水印 verify 通过;落地 5 道预检(水印 / 悬空引用 / 门 98 / CAS / 提交面回读)全过。**本票剩下的 ③ 仍待实施 agent 收口,与本条删除互不依赖。**
```

- 原 L10005(L1 外部持有行 L15879):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-09 批⑤复活再摘③):原号留归 F1 判据票,复活旧态摘号留指针,正文逐字保留;同题以「RN 三处接口路径多写一段」按标题前缀寻行。〕RN 与 api-client 三处接口路径多写一段 `agents`,运行时必 404(守门 8 报的真缺口,2026-10-05 现读三段取证)**:① 端内 `apps/mobile-rn/src/screens/HomeScreen.tsx:569` 写 `/cozeZhsApi/agents/collect`,门 8 归一为 `/api/agents/collect`;而后端 `apps/api/src/routes/agents.ts:1567` 注册的是 `server.post('/collect')`,经 `apps/api/src/routes/index.ts:646` 的 `server.register(agentsRoutes, { prefix: '/api' })` 挂载 ⇒ 实际路径是 **`/api/collect`**,**差一段 `agents`**。② `:577` 的 `/cozeZhsApi/agents/thumbs` 同型(后端 `agents.ts:1552` 注册 `/thumbs` ⇒ 实际 `/api/thumbs`)。③ `packages/api-client/src/endpoints/agent.ts:97` 的 `/cozeZhsApi/cache/agent-category-dict/categories` ⇒ 归一 `/api/cache/agent-category-dict/categories`,`apps/api/src/routes/` 下 **0 命中**该路径。**修法**:三处端内路径去掉多写的那一段;或后端补挂 `agents` 段(**属对外契约变更,需机主定**)。**验收**:改后 `node scripts/check-api-routes.mjs` 末行不再出现这三处「后端**不在册**」,且 RN 收藏/点赞真机点得动。注意守门 8 按设计**只报数不判红**(§12e)⇒ 这条不会自己变红,必须靠人收口。⚠️ 三处**不可**批量正则替换(端内还可能有真的 `/agents/...` 路由),必须逐条比对后端注册面。 〔拍板③@2026-10-06:新建公开双键字典端点,注册在客户端既有调用路径(4 调用方+api-client 零改动);实施 agent 在飞〕
```

- 原 L10006(L1 外部持有行 L15880):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-09 批⑤复活再摘③):本行已让号至 G-73(持行在面),复活旧态摘号留指针,正文逐字保留。〕RN 三处接口路径多写一段 `agents`(守门 8 报的真缺口;2026-10-06 部分收口,① ② 已修并入库 `f3bf8bd3fc`,③ 待机主定)** ——原票面三处里**只有 2 处是路径错**:`HomeScreen.tsx` 的收藏/点赞(① ②)确为多写一段 `agents`(后端 `agents.ts:1567` 是 `server.post('/collect')`、`:1552` 是 `server.post('/thumbs')`，`routes/index.ts:646` 挂 `prefix: "/api"` 且 agentsRoutes 内**无二级 prefix** => 实际 `/api/collect`、`/api/thumbs`)，已改为 `/api/collect` / `/api/thumbs` 并入库(`f3bf8bd3fc`)。**为什么连 `/cozeZhsApi` 一起换成 `/api`**:normalizeUrl 对两者等价(行为零变化)，但守门 8 的 `pathRe` 只认引号紧邻的 `/api/`，`/cozeZhsApi` 永远落在豁免桶里 => 改后才**进入判红调用集**，从此有判据兜住。验收:`check-api-routes.mjs --worktree`「后端不在册」**3 处 → 1 处**;变异(① 改回原路径)⇒ 复现 2 处。⚠️ **口径坑:守门 8 默认面是 HEAD blob 不是工作树**(`check-api-routes.mjs:3553-3559`)⇒ 改后必须加 `--worktree` 才看得到读数变化，不加旗标读数必然不变，别误读成「改动无效」。⚠️ **注释里写路径一律不带引号和反引号** —— `pathRe` 字符类把**反引号与引号同等**，本轮首版注释用反引号包路径，当场被抽成一条真死调用、门 exit 1(已改并留痕)。 ——**③ 另案:不是路径写错，是缺后端实现**。`packages/api-client/src/endpoints/agent.ts:97` 的 `/api/cache/agent-category-dict/categories` 后端 0 命中且**无等价路由**;`getAgentCategories` **不是死代码**(4 个真实 RN 调用方:HomeScreen/PlazaScreen/AgentScreen/AiAssistantScreen)。名字最近的 `agent-categories-cache.ts` 有两点硬差异:① `addHook(preHandler, requireAdmin)` 管理员专属;② 返回体 `{items,total,page,pageSize,lastRefreshedAt}` ≠ 端内要的 `{agentCategory, agentMainCategory}` 双键并列。**未擅自新增路由**(=新造对外契约，机主职权)，`diff -q` 证明该文件逐字未动。**待机主定**:① 新建公开双键字典端点(契约新增)，还是 ② 改端内去调既有 `/api/categories/list` 一类(返回体形状不同，4 个调用方取值逻辑要跟着改)。**风险低**:4 个调用方全有静态 fallback (`PLAZA_CATEGORY_FALLBACK` 等)，当前 404 只导致筛选弹层降级为静态占位，**不崩、不白屏**，可从容决策。顺带发现(同型死常量，未动):`apps/web/src/config/backend-paths.ts:64-65` 的 `${COZE}/agents/thumbs`/`collect`，`AGENTS_PATHS` 零消费方故无线上影响。**③ 收口后本票即可整条翻勾。** **【2026-10-06 追加现读:这一格比票面写的更彻底 —— 不是 2 行死常量,是整张 `ROUTE_MAP` 零消费(纯只读,未动代码)】**:`AGENTS_PATHS` 的真实消费面**只有 1 处** —— 同文件 `ROUTE_MAP['/agents']`(`backend-paths.ts:241`),而 `getPathsByRoute` / `ROUTE_MAP` / `BackendRouteKey` 三者在整个 `apps/web/src` 与全仓(`.ts/.tsx/.mts`)**各自只有定义处 1 个命中、零调用方、零测试钉子** ⇒ **这张表本身就是死的**,所以 `thumbs`/`collect` 那两个错路径永远不会被任何页面取到(与 RN 那两处不同:RN 是活调用会真404)。**更狠的一层**:该文件导出 **14 个路径组**,**只有 `OPENCLAW_PATHS` 有外部 import**(`apps/web/src/lib/openclaw-api.ts:6`,活的);其余 `AUTH_PATHS`/`AI_PATHS`/`FILE_PATHS`/`WS_PATHS`/`AGENTS_PATHS`/`STATISTICS_PATHS`/`SERVICE_APPOINTMENT_PATHS`/`NOTIFICATION_PATHS`/`CUSTOMER_SERVICE_PATHS`/`WALLET_PATHS`/`TOOLS_PATHS`/`CONTENT_PATHS`/`UPLOAD_PATHS`/`USER_SETTINGS_PATHS` **13 组全被这张死表引用或零引用** ⇒ 典型"旧架构整体搬运后没人接线的遗留面"(文件头自述"等价自旧架构 client/src/config/backend-paths.ts")。**为什么本会话不删(留给机主拍板,属 §1/§12e 边界)**:① 删表会一次性带走 14 个导出符号,虽现读零消费,但 `apps/web` 处于**多会话在飞态**(主索引里 `PROJECT_PLAN.md` 已被他人暂存),他人 in-flight 改动若正引用这些符号,删除会让他的构建红在半路且难以归因;② 票面原话是"同型死常量,**无线上影响**"⇒ **收益是纯清理,不是止血**,优先级低于任何真缺口;③ 真要动手,正解**不是删文件**而是先给 `getPathsByRoute` 补一个调用方(把死表接活)或整体删除并在同枚里留指针,**二选一是产品口径**(这张表原设计意图是"按页面查所需 API",可能原计划接一个 API 文档页/调试面板),不该由 agent 代裁。**已核实可排除的两条猜测**:① 不是"路径写错导致线上 404" —— 零消费方,无调用即无请求;② 不是"测试没覆盖导致漏判" —— 全仓无任何测试 import 本文件,删掉不会破测试。**建议(供机主拍板时参考)**:选"整体删除 + 在本行留指针",因为保留一张零消费的表只会持续骗后来人(本轮就有另一个 agent 因为它以为`${COZE}/agents/thumbs` 是活路径而去核对后端)。 〔拍板③@2026-10-06:新建公开双键字典端点,注册在客户端既有调用路径(4 调用方+api-client 零改动);实施 agent 在飞〕**【2026-10-06 死表删除已落地(档 B收口,入库 `31872798562`):本行建议的「整体删除」已执行】**删除前取证走**四通道**(HEAD面 / 暂存区 / 未跟踪 / 工作树当前内容),结论一致:18 个 export 里只有 `OPENCLAW_PATHS` 被真实消费(唯一消费方 `apps/web/src/lib/openclaw-api.ts`,29 处引用);另 14 组路径常量与 `ROUTE_MAP` / `BackendRouteKey` / `getPathsByRoute` 零调用方、零测试钉子。**删的是内容不是文件** —— 整文件删除会连带带走唯一活着的 `OPENCLAW_PATHS`,故保留文件只留活表:**257 行 → 81 行**(−191/+15),水印头尾逐字未动。**保留 `OPENCLAW_PATHS` 全部 8 个子对象(含当前零调用的 `sessions`/`stats`)**:活着的路径表按域完整列出是**契约语义**,按当前调用点裁剪等于把契约表降级成调用点快照;死常量是「整组无人碰」,与此不同类。**甄别过的同名不同物**(删对了、不是漏删):`AGENTS_PATHS` 另有一处是 `apps/ai-service/tests/test_privileged_surface_auth_59.py` 的 Python 局部元组;`ROUTE_MAP` 另有一处是 `apps/miniapp-taro/src/pkg-user/favorites/index.tsx` 该端自己的路由映射。**验收**:`apps/web` tsc `--noEmit` 20 条错误**全部**落在他人 in-flight 文件(`MessageList.tsx` / `windowing.ts` / `checkpoint-rewind-undo-claim.test.tsx` / `LivePlayer.tsx`),无一指向本文件或 `openclaw-api.ts`,且这 4 个文件对本文件**零引用** ⇒ 因果无关;水印 verify 通过;落地 5 道预检(水印 / 悬空引用 / 门 98 / CAS / 提交面回读)全过。**本票剩下的 ③ 仍待实施 agent 收口,与本条删除互不依赖。**
```

- 原 L10007(L1 外部持有行 L15879):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-09 批⑤复活再摘②):原号留归 F1 判据票,复活旧态摘号留指针,正文逐字保留;同题以「RN 三处接口路径多写一段」按标题前缀寻行。〕RN 与 api-client 三处接口路径多写一段 `agents`,运行时必 404(守门 8 报的真缺口,2026-10-05 现读三段取证)**:① 端内 `apps/mobile-rn/src/screens/HomeScreen.tsx:569` 写 `/cozeZhsApi/agents/collect`,门 8 归一为 `/api/agents/collect`;而后端 `apps/api/src/routes/agents.ts:1567` 注册的是 `server.post('/collect')`,经 `apps/api/src/routes/index.ts:646` 的 `server.register(agentsRoutes, { prefix: '/api' })` 挂载 ⇒ 实际路径是 **`/api/collect`**,**差一段 `agents`**。② `:577` 的 `/cozeZhsApi/agents/thumbs` 同型(后端 `agents.ts:1552` 注册 `/thumbs` ⇒ 实际 `/api/thumbs`)。③ `packages/api-client/src/endpoints/agent.ts:97` 的 `/cozeZhsApi/cache/agent-category-dict/categories` ⇒ 归一 `/api/cache/agent-category-dict/categories`,`apps/api/src/routes/` 下 **0 命中**该路径。**修法**:三处端内路径去掉多写的那一段;或后端补挂 `agents` 段(**属对外契约变更,需机主定**)。**验收**:改后 `node scripts/check-api-routes.mjs` 末行不再出现这三处「后端**不在册**」,且 RN 收藏/点赞真机点得动。注意守门 8 按设计**只报数不判红**(§12e)⇒ 这条不会自己变红,必须靠人收口。⚠️ 三处**不可**批量正则替换(端内还可能有真的 `/agents/...` 路由),必须逐条比对后端注册面。 〔拍板③@2026-10-06:新建公开双键字典端点,注册在客户端既有调用路径(4 调用方+api-client 零改动);实施 agent 在飞〕
```

- 原 L10008(L1 外部持有行 L15880):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-09 批⑤复活再摘②):本行已让号至 G-73(持行在面),复活旧态摘号留指针,正文逐字保留。〕RN 三处接口路径多写一段 `agents`(守门 8 报的真缺口;2026-10-06 部分收口,① ② 已修并入库 `f3bf8bd3fc`,③ 待机主定)** ——原票面三处里**只有 2 处是路径错**:`HomeScreen.tsx` 的收藏/点赞(① ②)确为多写一段 `agents`(后端 `agents.ts:1567` 是 `server.post('/collect')`、`:1552` 是 `server.post('/thumbs')`，`routes/index.ts:646` 挂 `prefix: "/api"` 且 agentsRoutes 内**无二级 prefix** => 实际 `/api/collect`、`/api/thumbs`)，已改为 `/api/collect` / `/api/thumbs` 并入库(`f3bf8bd3fc`)。**为什么连 `/cozeZhsApi` 一起换成 `/api`**:normalizeUrl 对两者等价(行为零变化)，但守门 8 的 `pathRe` 只认引号紧邻的 `/api/`，`/cozeZhsApi` 永远落在豁免桶里 => 改后才**进入判红调用集**，从此有判据兜住。验收:`check-api-routes.mjs --worktree`「后端不在册」**3 处 → 1 处**;变异(① 改回原路径)⇒ 复现 2 处。⚠️ **口径坑:守门 8 默认面是 HEAD blob 不是工作树**(`check-api-routes.mjs:3553-3559`)⇒ 改后必须加 `--worktree` 才看得到读数变化，不加旗标读数必然不变，别误读成「改动无效」。⚠️ **注释里写路径一律不带引号和反引号** —— `pathRe` 字符类把**反引号与引号同等**，本轮首版注释用反引号包路径，当场被抽成一条真死调用、门 exit 1(已改并留痕)。 ——**③ 另案:不是路径写错，是缺后端实现**。`packages/api-client/src/endpoints/agent.ts:97` 的 `/api/cache/agent-category-dict/categories` 后端 0 命中且**无等价路由**;`getAgentCategories` **不是死代码**(4 个真实 RN 调用方:HomeScreen/PlazaScreen/AgentScreen/AiAssistantScreen)。名字最近的 `agent-categories-cache.ts` 有两点硬差异:① `addHook(preHandler, requireAdmin)` 管理员专属;② 返回体 `{items,total,page,pageSize,lastRefreshedAt}` ≠ 端内要的 `{agentCategory, agentMainCategory}` 双键并列。**未擅自新增路由**(=新造对外契约，机主职权)，`diff -q` 证明该文件逐字未动。**待机主定**:① 新建公开双键字典端点(契约新增)，还是 ② 改端内去调既有 `/api/categories/list` 一类(返回体形状不同，4 个调用方取值逻辑要跟着改)。**风险低**:4 个调用方全有静态 fallback (`PLAZA_CATEGORY_FALLBACK` 等)，当前 404 只导致筛选弹层降级为静态占位，**不崩、不白屏**，可从容决策。顺带发现(同型死常量，未动):`apps/web/src/config/backend-paths.ts:64-65` 的 `${COZE}/agents/thumbs`/`collect`，`AGENTS_PATHS` 零消费方故无线上影响。**③ 收口后本票即可整条翻勾。** **【2026-10-06 追加现读:这一格比票面写的更彻底 —— 不是 2 行死常量,是整张 `ROUTE_MAP` 零消费(纯只读,未动代码)】**:`AGENTS_PATHS` 的真实消费面**只有 1 处** —— 同文件 `ROUTE_MAP['/agents']`(`backend-paths.ts:241`),而 `getPathsByRoute` / `ROUTE_MAP` / `BackendRouteKey` 三者在整个 `apps/web/src` 与全仓(`.ts/.tsx/.mts`)**各自只有定义处 1 个命中、零调用方、零测试钉子** ⇒ **这张表本身就是死的**,所以 `thumbs`/`collect` 那两个错路径永远不会被任何页面取到(与 RN 那两处不同:RN 是活调用会真404)。**更狠的一层**:该文件导出 **14 个路径组**,**只有 `OPENCLAW_PATHS` 有外部 import**(`apps/web/src/lib/openclaw-api.ts:6`,活的);其余 `AUTH_PATHS`/`AI_PATHS`/`FILE_PATHS`/`WS_PATHS`/`AGENTS_PATHS`/`STATISTICS_PATHS`/`SERVICE_APPOINTMENT_PATHS`/`NOTIFICATION_PATHS`/`CUSTOMER_SERVICE_PATHS`/`WALLET_PATHS`/`TOOLS_PATHS`/`CONTENT_PATHS`/`UPLOAD_PATHS`/`USER_SETTINGS_PATHS` **13 组全被这张死表引用或零引用** ⇒ 典型"旧架构整体搬运后没人接线的遗留面"(文件头自述"等价自旧架构 client/src/config/backend-paths.ts")。**为什么本会话不删(留给机主拍板,属 §1/§12e 边界)**:① 删表会一次性带走 14 个导出符号,虽现读零消费,但 `apps/web` 处于**多会话在飞态**(主索引里 `PROJECT_PLAN.md` 已被他人暂存),他人 in-flight 改动若正引用这些符号,删除会让他的构建红在半路且难以归因;② 票面原话是"同型死常量,**无线上影响**"⇒ **收益是纯清理,不是止血**,优先级低于任何真缺口;③ 真要动手,正解**不是删文件**而是先给 `getPathsByRoute` 补一个调用方(把死表接活)或整体删除并在同枚里留指针,**二选一是产品口径**(这张表原设计意图是"按页面查所需 API",可能原计划接一个 API 文档页/调试面板),不该由 agent 代裁。**已核实可排除的两条猜测**:① 不是"路径写错导致线上 404" —— 零消费方,无调用即无请求;② 不是"测试没覆盖导致漏判" —— 全仓无任何测试 import 本文件,删掉不会破测试。**建议(供机主拍板时参考)**:选"整体删除 + 在本行留指针",因为保留一张零消费的表只会持续骗后来人(本轮就有另一个 agent 因为它以为`${COZE}/agents/thumbs` 是活路径而去核对后端)。 〔拍板③@2026-10-06:新建公开双键字典端点,注册在客户端既有调用路径(4 调用方+api-client 零改动);实施 agent 在飞〕**【2026-10-06 死表删除已落地(档 B收口,入库 `31872798562`):本行建议的「整体删除」已执行】**删除前取证走**四通道**(HEAD面 / 暂存区 / 未跟踪 / 工作树当前内容),结论一致:18 个 export 里只有 `OPENCLAW_PATHS` 被真实消费(唯一消费方 `apps/web/src/lib/openclaw-api.ts`,29 处引用);另 14 组路径常量与 `ROUTE_MAP` / `BackendRouteKey` / `getPathsByRoute` 零调用方、零测试钉子。**删的是内容不是文件** —— 整文件删除会连带带走唯一活着的 `OPENCLAW_PATHS`,故保留文件只留活表:**257 行 → 81 行**(−191/+15),水印头尾逐字未动。**保留 `OPENCLAW_PATHS` 全部 8 个子对象(含当前零调用的 `sessions`/`stats`)**:活着的路径表按域完整列出是**契约语义**,按当前调用点裁剪等于把契约表降级成调用点快照;死常量是「整组无人碰」,与此不同类。**甄别过的同名不同物**(删对了、不是漏删):`AGENTS_PATHS` 另有一处是 `apps/ai-service/tests/test_privileged_surface_auth_59.py` 的 Python 局部元组;`ROUTE_MAP` 另有一处是 `apps/miniapp-taro/src/pkg-user/favorites/index.tsx` 该端自己的路由映射。**验收**:`apps/web` tsc `--noEmit` 20 条错误**全部**落在他人 in-flight 文件(`MessageList.tsx` / `windowing.ts` / `checkpoint-rewind-undo-claim.test.tsx` / `LivePlayer.tsx`),无一指向本文件或 `openclaw-api.ts`,且这 4 个文件对本文件**零引用** ⇒ 因果无关;水印 verify 通过;落地 5 道预检(水印 / 悬空引用 / 门 98 / CAS / 提交面回读)全过。**本票剩下的 ③ 仍待实施 agent 收口,与本条删除互不依赖。**
```

- 原 L10009(L1 外部持有行 L10011):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-09 批⑤复活再摘):原号留归 F1 判据票,本行摘号留指针,正文逐字保留;同题以「RN 三处接口路径多写一段」按标题前缀寻行。〕**RN 与 api-client 三处接口路径多写一段 `agents`,运行时必 404(守门 8 报的真缺口,2026-10-05 现读三段取证)**:① 端内 `apps/mobile-rn/src/screens/HomeScreen.tsx:569` 写 `/cozeZhsApi/agents/collect`,门 8 归一为 `/api/agents/collect`;而后端 `apps/api/src/routes/agents.ts:1567` 注册的是 `server.post('/collect')`,经 `apps/api/src/routes/index.ts:646` 的 `server.register(agentsRoutes, { prefix: '/api' })` 挂载 ⇒ 实际路径是 **`/api/collect`**,**差一段 `agents`**。② `:577` 的 `/cozeZhsApi/agents/thumbs` 同型(后端 `agents.ts:1552` 注册 `/thumbs` ⇒ 实际 `/api/thumbs`)。③ `packages/api-client/src/endpoints/agent.ts:97` 的 `/cozeZhsApi/cache/agent-category-dict/categories` ⇒ 归一 `/api/cache/agent-category-dict/categories`,`apps/api/src/routes/` 下 **0 命中**该路径。**修法**:三处端内路径去掉多写的那一段;或后端补挂 `agents` 段(**属对外契约变更,需机主定**)。**验收**:改后 `node scripts/check-api-routes.mjs` 末行不再出现这三处「后端**不在册**」,且 RN 收藏/点赞真机点得动。注意守门 8 按设计**只报数不判红**(§12e)⇒ 这条不会自己变红,必须靠人收口。⚠️ 三处**不可**批量正则替换(端内还可能有真的 `/agents/...` 路由),必须逐条比对后端注册面。 〔拍板③@2026-10-06:新建公开双键字典端点,注册在客户端既有调用路径(4 调用方+api-client 零改动);实施 agent 在飞〕
```

- 原 L10010(L1 外部持有行 L15878):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-09 批⑤复活再摘):本行已让号至 G-73(持行在面),复活旧态摘号留指针,正文逐字保留。〕**RN 三处接口路径多写一段 `agents`(守门 8 报的真缺口;2026-10-06 部分收口,① ② 已修并入库 `f3bf8bd3fc`,③ 待机主定)** ——原票面三处里**只有 2 处是路径错**:`HomeScreen.tsx` 的收藏/点赞(① ②)确为多写一段 `agents`(后端 `agents.ts:1567` 是 `server.post('/collect')`、`:1552` 是 `server.post('/thumbs')`，`routes/index.ts:646` 挂 `prefix: "/api"` 且 agentsRoutes 内**无二级 prefix** => 实际 `/api/collect`、`/api/thumbs`)，已改为 `/api/collect` / `/api/thumbs` 并入库(`f3bf8bd3fc`)。**为什么连 `/cozeZhsApi` 一起换成 `/api`**:normalizeUrl 对两者等价(行为零变化)，但守门 8 的 `pathRe` 只认引号紧邻的 `/api/`，`/cozeZhsApi` 永远落在豁免桶里 => 改后才**进入判红调用集**，从此有判据兜住。验收:`check-api-routes.mjs --worktree`「后端不在册」**3 处 → 1 处**;变异(① 改回原路径)⇒ 复现 2 处。⚠️ **口径坑:守门 8 默认面是 HEAD blob 不是工作树**(`check-api-routes.mjs:3553-3559`)⇒ 改后必须加 `--worktree` 才看得到读数变化，不加旗标读数必然不变，别误读成「改动无效」。⚠️ **注释里写路径一律不带引号和反引号** —— `pathRe` 字符类把**反引号与引号同等**，本轮首版注释用反引号包路径，当场被抽成一条真死调用、门 exit 1(已改并留痕)。 ——**③ 另案:不是路径写错，是缺后端实现**。`packages/api-client/src/endpoints/agent.ts:97` 的 `/api/cache/agent-category-dict/categories` 后端 0 命中且**无等价路由**;`getAgentCategories` **不是死代码**(4 个真实 RN 调用方:HomeScreen/PlazaScreen/AgentScreen/AiAssistantScreen)。名字最近的 `agent-categories-cache.ts` 有两点硬差异:① `addHook(preHandler, requireAdmin)` 管理员专属;② 返回体 `{items,total,page,pageSize,lastRefreshedAt}` ≠ 端内要的 `{agentCategory, agentMainCategory}` 双键并列。**未擅自新增路由**(=新造对外契约，机主职权)，`diff -q` 证明该文件逐字未动。**待机主定**:① 新建公开双键字典端点(契约新增)，还是 ② 改端内去调既有 `/api/categories/list` 一类(返回体形状不同，4 个调用方取值逻辑要跟着改)。**风险低**:4 个调用方全有静态 fallback (`PLAZA_CATEGORY_FALLBACK` 等)，当前 404 只导致筛选弹层降级为静态占位，**不崩、不白屏**，可从容决策。顺带发现(同型死常量，未动):`apps/web/src/config/backend-paths.ts:64-65` 的 `${COZE}/agents/thumbs`/`collect`，`AGENTS_PATHS` 零消费方故无线上影响。**③ 收口后本票即可整条翻勾。** **【2026-10-06 追加现读:这一格比票面写的更彻底 —— 不是 2 行死常量,是整张 `ROUTE_MAP` 零消费(纯只读,未动代码)】**:`AGENTS_PATHS` 的真实消费面**只有 1 处** —— 同文件 `ROUTE_MAP['/agents']`(`backend-paths.ts:241`),而 `getPathsByRoute` / `ROUTE_MAP` / `BackendRouteKey` 三者在整个 `apps/web/src` 与全仓(`.ts/.tsx/.mts`)**各自只有定义处 1 个命中、零调用方、零测试钉子** ⇒ **这张表本身就是死的**,所以 `thumbs`/`collect` 那两个错路径永远不会被任何页面取到(与 RN 那两处不同:RN 是活调用会真404)。**更狠的一层**:该文件导出 **14 个路径组**,**只有 `OPENCLAW_PATHS` 有外部 import**(`apps/web/src/lib/openclaw-api.ts:6`,活的);其余 `AUTH_PATHS`/`AI_PATHS`/`FILE_PATHS`/`WS_PATHS`/`AGENTS_PATHS`/`STATISTICS_PATHS`/`SERVICE_APPOINTMENT_PATHS`/`NOTIFICATION_PATHS`/`CUSTOMER_SERVICE_PATHS`/`WALLET_PATHS`/`TOOLS_PATHS`/`CONTENT_PATHS`/`UPLOAD_PATHS`/`USER_SETTINGS_PATHS` **13 组全被这张死表引用或零引用** ⇒ 典型"旧架构整体搬运后没人接线的遗留面"(文件头自述"等价自旧架构 client/src/config/backend-paths.ts")。**为什么本会话不删(留给机主拍板,属 §1/§12e 边界)**:① 删表会一次性带走 14 个导出符号,虽现读零消费,但 `apps/web` 处于**多会话在飞态**(主索引里 `PROJECT_PLAN.md` 已被他人暂存),他人 in-flight 改动若正引用这些符号,删除会让他的构建红在半路且难以归因;② 票面原话是"同型死常量,**无线上影响**"⇒ **收益是纯清理,不是止血**,优先级低于任何真缺口;③ 真要动手,正解**不是删文件**而是先给 `getPathsByRoute` 补一个调用方(把死表接活)或整体删除并在同枚里留指针,**二选一是产品口径**(这张表原设计意图是"按页面查所需 API",可能原计划接一个 API 文档页/调试面板),不该由 agent 代裁。**已核实可排除的两条猜测**:① 不是"路径写错导致线上 404" —— 零消费方,无调用即无请求;② 不是"测试没覆盖导致漏判" —— 全仓无任何测试 import 本文件,删掉不会破测试。**建议(供机主拍板时参考)**:选"整体删除 + 在本行留指针",因为保留一张零消费的表只会持续骗后来人(本轮就有另一个 agent 因为它以为`${COZE}/agents/thumbs` 是活路径而去核对后端)。 〔拍板③@2026-10-06:新建公开双键字典端点,注册在客户端既有调用路径(4 调用方+api-client 零改动);实施 agent 在飞〕**【2026-10-06 死表删除已落地(档 B收口,入库 `31872798562`):本行建议的「整体删除」已执行】**删除前取证走**四通道**(HEAD面 / 暂存区 / 未跟踪 / 工作树当前内容),结论一致:18 个 export 里只有 `OPENCLAW_PATHS` 被真实消费(唯一消费方 `apps/web/src/lib/openclaw-api.ts`,29 处引用);另 14 组路径常量与 `ROUTE_MAP` / `BackendRouteKey` / `getPathsByRoute` 零调用方、零测试钉子。**删的是内容不是文件** —— 整文件删除会连带带走唯一活着的 `OPENCLAW_PATHS`,故保留文件只留活表:**257 行 → 81 行**(−191/+15),水印头尾逐字未动。**保留 `OPENCLAW_PATHS` 全部 8 个子对象(含当前零调用的 `sessions`/`stats`)**:活着的路径表按域完整列出是**契约语义**,按当前调用点裁剪等于把契约表降级成调用点快照;死常量是「整组无人碰」,与此不同类。**甄别过的同名不同物**(删对了、不是漏删):`AGENTS_PATHS` 另有一处是 `apps/ai-service/tests/test_privileged_surface_auth_59.py` 的 Python 局部元组;`ROUTE_MAP` 另有一处是 `apps/miniapp-taro/src/pkg-user/favorites/index.tsx` 该端自己的路由映射。**验收**:`apps/web` tsc `--noEmit` 20 条错误**全部**落在他人 in-flight 文件(`MessageList.tsx` / `windowing.ts` / `checkpoint-rewind-undo-claim.test.tsx` / `LivePlayer.tsx`),无一指向本文件或 `openclaw-api.ts`,且这 4 个文件对本文件**零引用** ⇒ 因果无关;水印 verify 通过;落地 5 道预检(水印 / 悬空引用 / 门 98 / CAS / 提交面回读)全过。**本票剩下的 ③ 仍待实施 agent 收口,与本条删除互不依赖。**
```

- 原 L10188(L1 外部持有行 L15766):

```
- [ ]（进行中@2026-10-04/本会话）**node `spawnSync` 对原生 exe 持续 EBUSY**(`schtasks.exe`/`cmd.exe` 全中,`execSync` 同):`safe-commit.mjs`、`git-sync-converge.mjs`、`.husky/post-commit` 的推送腿在此环境下失效,提交落地但自动推送缺席。绕行:prettier/eslint 判据手动实跑 + 提交靠并行会话的 converge push 带上(073de24 已实证被带上;2dddc85 待带上,见下)。git.exe 进程堆积的清理方法见 skill 记载(MSYS_NO_PATHCONV 前缀防路径转换)。**本机命令校验层**(WorkBuddy 安全策略)拦截计划任务注册类命令文本,agent 无法直接注册——注册类动作须人执行或由已有守护设施代做。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕〔2026-10-04 本轮新量到的同族落点（票面原只点了 safe-commit / converge / post-commit 三处）：**`packages/sdk/scripts/prepack.mjs:40` 的 `execFileSync` 与 `scripts/check-pkg-installable.mjs:308` 的 `sh()` 都不带 `stdio`** ⇒ 后者走 shell 会派生 `cmd.exe`，正是本族「原生 exe 全中」的同一形态。实测症状：`check-pkg-installable.mjs packages/sdk` 报 `spawnSync C:\Windows\system32\cmd.exe EBUSY` 并**刻意不回落 npm pack**（判据自己写的「无法判定」分支）；`pnpm pack` 同型卡在 prepack 的 tsc 腿 ⇒ **D18（sdk 发布就绪）在本机根本跑不到判据**。本轮按「只补 stdio 不改判据」修（§12e：修红不得顺手削判据）〕【2026-10-04 本轮实测补记（同一族的系统性账，票面原只点三处）】本轮按"只补 stdio 不改判据"修完三处同族落点并全部转绿：
```

- 原 L10191(L1 外部持有行 L9658):

```
- [ ]（进行中@2026-09-26/Esc层栈票,主会话第九批） **Esc 无层栈协议**(方案已定稿,待实施):20+ 处 document/window 的 Esc 监听各自为政且普遍不 `stopPropagation` → 一次 Esc 同时关掉遮罩、弹层、pane、搜索条。**正解不是逐处补 `stopPropagation`**(跨层顺序不可控),而是:①新增 `apps/web/src/lib/overlay-stack.ts` —— `pushOverlay(id)/popOverlay(id)/isTopOverlay(id)`(模块级数组,注册幂等,卸载必 pop);②每个浮层在 open 时 push、close 时 pop,其 Esc 处理器首行 `if (!isTopOverlay(myId)) return`;③`packages/ui-react` 的 Dialog/Popover 家族优先内建该注册(一处接全部端),web 端自绘 portal 层逐个接入;④已有正例可参照其消费写法:`GlobalTopBar.tsx:366`、`TagsView.tsx:135`、`hover-preview-card.tsx:44`(已用 stopPropagation 的三层)。解阻判据:构造"遮罩 + 弹层 + pane 三层叠开"场景按一次 Esc,只有最上层关闭(真机 `aria-expanded`/`data-state` 逐层断言)。注意 `work-panel.tsx` 属共享包,须与结构改造项同票评估。 〔PROGRESS 2026-09-25: overlay-stack 已 30 处在栈,本批补命令面板桥接 commit 69523d6e5;ui-react 家族内建与"三层叠开"真机断言仍未做〕〔【归并】重复登记副本(2026-10-01):同主键的另一条登记「Esc 无层栈协议」已翻勾并收口(完成提交 c80253f29b;2026-09-29 值守按实证收口,证据 G-816706),派单以翻勾那条为准,本行不再单独派单。〕
```

- 原 L10192(L1 外部持有行 L9659):

```
- [ ]（进行中@2026-09-26/Esc层栈票,主会话第九批） **Esc 无层栈协议**(方案已定稿,待实施):20+ 处 document/window 的 Esc 监听各自为政且普遍不 `stopPropagation` → 一次 Esc 同时关掉遮罩、弹层、pane、搜索条。**正解不是逐处补 `stopPropagation`**(跨层顺序不可控),而是:①新增 `apps/web/src/lib/overlay-stack.ts` —— `pushOverlay(id)/popOverlay(id)/isTopOverlay(id)`(模块级数组,注册幂等,卸载必 pop);②每个浮层在 open 时 push、close 时 pop,其 Esc 处理器首行 `if (!isTopOverlay(myId)) return`;③`packages/ui-react` 的 Dialog/Popover 家族优先内建该注册(一处接全部端),web 端自绘 portal 层逐个接入;④已有正例可参照其消费写法:`GlobalTopBar.tsx:366`、`TagsView.tsx:135`、`hover-preview-card.tsx:44`(已用 stopPropagation 的三层)。解阻判据:构造"遮罩 + 弹层 + pane 三层叠开"场景按一次 Esc,只有最上层关闭(真机 `aria-expanded`/`data-state` 逐层断言)。注意 `work-panel.tsx` 属共享包,须与结构改造项同票评估。〔【归并】重复登记副本(2026-10-01):同主键的另一条登记「Esc 无层栈协议」已翻勾并收口(完成提交 c80253f29b;2026-09-29 值守按实证收口,证据 G-816706),派单以翻勾那条为准,本行不再单独派单。〕
```

- 原 L10193(L1 外部持有行 L4996):

```
- [ ]（进行中@2026-09-26/WP-8③,主会话第十批）**WP-8 上下文占用归因 + 流式工具账本 + 目标完成独立校验轮**。后者是补 〔PROGRESS 2026-09-26(按 HEAD 实测三件分档,票保持未勾):①**流式工具账本**已入库且有消费点(`apps/cli/src/stream-tool-ledger.ts` 在 HEAD,`commands/agent.ts`、`hooks/index.ts`、`hooks/trust.ts` 三处引用,`git grep -l` 实测非 0);②**上下文占用归因**已入库(`packages/shared/src/utils/context-attribution.ts`+ `apps/web/src/components/ai/context-usage-ring.tsx` + 定向测试);③**目标完成独立校验轮**只有契约与 web 呈现位(`packages/api-client/src/endpoints/agent-runtime.ts` 的 goalCriteria/校验结论字段 + web 词包 `goalAchieved`/`goalUnmet` 等键),**执行侧闸门零命中**:`git grep -n "verificationRound|goalVerification|judgeGoal|独立校验" HEAD -- apps/cli/src apps/api/src` = 0 命中 ⇒ 循环自宣完成仍未被强制过校验,§8 那条"禁止模型自评 yes"仍未落到运行时。解阻判据:CLI/api 循环侧接契约字段并出一枚"未过校验不得判 achieved"的用例;该格落点在 `apps/cli/src`(当前 12 个文件他人在飞),故本票不派、不代裁。〕 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L10194(L1 外部持有行 L10189):

```
- [ ]（进行中@2026-09-27/删除诚实性票） **第二十八批:布尔 ack 的键族从 `deleted` 扩到 `removed / restored / revoked / cleared`**(扩键后的普查现读 **27 处代码面**,其中 12 处是已定性的 `deleted` 那一族): 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L10195(L1 外部持有行 L4996):

```
- [ ]（进行中@2026-09-26/WP-8③,主会话第十批）**WP-8 上下文占用归因 + 流式工具账本 + 目标完成独立校验轮**。后者是补 〔PROGRESS 2026-09-26(按 HEAD 实测三件分档,票保持未勾):①**流式工具账本**已入库且有消费点(`apps/cli/src/stream-tool-ledger.ts` 在 HEAD,`commands/agent.ts`、`hooks/index.ts`、`hooks/trust.ts` 三处引用,`git grep -l` 实测非 0);②**上下文占用归因**已入库(`packages/shared/src/utils/context-attribution.ts`+ `apps/web/src/components/ai/context-usage-ring.tsx` + 定向测试);③**目标完成独立校验轮**只有契约与 web 呈现位(`packages/api-client/src/endpoints/agent-runtime.ts` 的 goalCriteria/校验结论字段 + web 词包 `goalAchieved`/`goalUnmet` 等键),**执行侧闸门零命中**:`git grep -n "verificationRound|goalVerification|judgeGoal|独立校验" HEAD -- apps/cli/src apps/api/src` = 0 命中 ⇒ 循环自宣完成仍未被强制过校验,§8 那条"禁止模型自评 yes"仍未落到运行时。解阻判据:CLI/api 循环侧接契约字段并出一枚"未过校验不得判 achieved"的用例;该格落点在 `apps/cli/src`(当前 12 个文件他人在飞),故本票不派、不代裁。〕 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L10196(L1 外部持有行 L10189):

```
- [ ]（进行中@2026-09-27/删除诚实性票） **第二十八批:布尔 ack 的键族从 `deleted` 扩到 `removed / restored / revoked / cleared`**(扩键后的普查现读 **27 处代码面**,其中 12 处是已定性的 `deleted` 那一族): 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L10198(L1 外部持有行 L4996):

```
- [ ]（进行中@2026-09-26/WP-8③,主会话第十批）**WP-8 上下文占用归因 + 流式工具账本 + 目标完成独立校验轮**。后者是补 〔PROGRESS 2026-09-26(按 HEAD 实测三件分档,票保持未勾):①**流式工具账本**已入库且有消费点(`apps/cli/src/stream-tool-ledger.ts` 在 HEAD,`commands/agent.ts`、`hooks/index.ts`、`hooks/trust.ts` 三处引用,`git grep -l` 实测非 0);②**上下文占用归因**已入库(`packages/shared/src/utils/context-attribution.ts`+ `apps/web/src/components/ai/context-usage-ring.tsx` + 定向测试);③**目标完成独立校验轮**只有契约与 web 呈现位(`packages/api-client/src/endpoints/agent-runtime.ts` 的 goalCriteria/校验结论字段 + web 词包 `goalAchieved`/`goalUnmet` 等键),**执行侧闸门零命中**:`git grep -n "verificationRound|goalVerification|judgeGoal|独立校验" HEAD -- apps/cli/src apps/api/src` = 0 命中 ⇒ 循环自宣完成仍未被强制过校验,§8 那条"禁止模型自评 yes"仍未落到运行时。解阻判据:CLI/api 循环侧接契约字段并出一枚"未过校验不得判 achieved"的用例;该格落点在 `apps/cli/src`(当前 12 个文件他人在飞),故本票不派、不代裁。〕 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L10199(L1 外部持有行 L10189):

```
- [ ]（进行中@2026-09-27/删除诚实性票） **第二十八批:布尔 ack 的键族从 `deleted` 扩到 `removed / restored / revoked / cleared`**(扩键后的普查现读 **27 处代码面**,其中 12 处是已定性的 `deleted` 那一族): 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L10210(L1 外部持有行 L15653):

```
- [ ]〔【归并】重复登记副本(2026-10-13):本行是同主键的重复登记残影,本体=「G-679 可寻址性守恒尺」行(2026-10-13 已翻勾),派单以本体为准,本行不再单独派单。〕
```

- 原 L10214(L1 外部持有行 L15670):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-10-08·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-762 **门 33 的 provider 名单该由谁供给(归属:守门 33 持有人;等人拍板)** —— 现读 7 个在 `.env` 的合法 provider 被判"未知",默认档只 warning 所以 rc 0。**为什么还开着**:config.py 的设计是"新增 provider 零代码改动、自动识别",而本门的名单是手抄副本;两种收口动作语义相反——① 把 7 个补进名单 = 继续养第二份真相,② 由 `.env`/服务端能力清单单向投影 = 改一道 blocking 门的判据。必须先定"这份名单到底要不要存在"。**不得**为让 warning 归零去删判据或放宽规则 3。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `G-G-354`(族名在编号段出现两次)。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 G-354 已被 9 行认领(L8272,8527,8617,8644…),改回就等于替这本账再加一枚撞号;现号 `G-762`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。 〔拍板@2026-10-07 机主:选②——由.env/服务端能力清单单向投影,消灭第二份手抄名单〕 〔拍板@2026-10-07 机主:选②——由.env/服务端能力清单单向投影,消灭第二份手抄名单〕 (原编号 G-762;持有行题面「门33的provider名单该由谁供给」)
```

- 原 L10226(L1 外部持有行 L15670):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-10-08·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-354 **门 33 的 provider 名单该由谁供给(归属:守门 33 持有人;等人拍板)** —— 现读 7 个在 `.env` 的合法 provider 被判"未知",默认档只 warning 所以 rc 0。**为什么还开着**:config.py 的设计是"新增 provider 零代码改动、自动识别",而本门的名单是手抄副本;两种收口动作语义相反——① 把 7 个补进名单 = 继续养第二份真相,② 由 `.env`/服务端能力清单单向投影 = 改一道 blocking 门的判据。必须先定"这份名单到底要不要存在"。**不得**为让 warning 归零去删判据或放宽规则 3。 〔拍板@2026-10-07 机主:选②——由.env/服务端能力清单单向投影,消灭第二份手抄名单〕 〔拍板@2026-10-07 机主:选②——由.env/服务端能力清单单向投影,消灭第二份手抄名单〕 (原编号 G-354;持有行题面「门33的provider名单该由谁供给」)
```

- 原 L10241(L1 外部持有行 L10223):

```
- [ ]（登记，非本线）relay admin 4 个删除端点零测试覆盖、`o13-bg-rls-live.test.ts` 需要自己的串行通道 〔2026-09-28 现读更正:前半已收口 —— `apps/api/tests/relay-admin-delete-honesty.test.ts`(枚 `ba0575f9b` 在账)恰好覆盖 4 端点×正常/越权/404 共 16 例,本会话现跑连跑两遍 16/16 全绿,且核实 4 链 ack 全部由 .returning() 集合派生无假 ack;后半(o13-bg-rls-live 串行通道)本会话另派在执行。票暂不翻,待后半落地一并归位。〕 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L10268(L1 外部持有行 L7607):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7697(G-401) 同题,派单以持有行为准,本行不再单独派单。〕 G-401 **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 (原编号 G-G-373 系改派工具把前缀重复贴了一次:尺子会把它读成 G-373 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4 —— 现取新号,正文逐字未动) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-401」,派单以那条为准,本行不再单独派单。〕 〔拍板 2026-10-05(机主选"未知即按写处理"):MCP 工具默认档不再算 `read` —— 需批准、失败不自动重跑;确实只读者按"服务器 + 工具名"显式登记白名单并把白名单纳入跨语言对账。落点在 `apps/cli/src/tools/hub/mcp-adapter.ts` 与权限档两侧持有人;派单排在 G-710 那枚同目录代理之后,避免两个代理同改一个文件〕
```

- 原 L10269(L1 外部持有行 L15686):

```
- [ ] G-410 **第 3 波待办（覆盖面本身，不是功能票）** —— 未读名单已报名，按此接手：`apps/zcode-cli/packages/core/src/{tool/handlers 120, runtime/methods 98, runtime/helpers 53, subagent 22, workflow 31, hooks 17, context 12, memory 10, browser-client 7}`；`packages/desktop/src/main/index.ts`(2384，装配主入口) + 遥测/ARMS 族 + `processResource*` 13；`packages/ui/src/lib` 剩余 workspace 22/task 21/provider 15/telemetry 9/tool 9；`packages/ui/src/v4`（W2-8 在报）；`packages/services/src` 剩余 14（`conversationShare*` 3、`settingsSync` 2、`commandsService` 1004、`memoryService`、`fsFaultInjection` 等）；`packages/zcode-server-cli/src` 剩余 41；`packages/web` 17。**另有两格结构空白**：`packages/app/src/features/**` 不在守门 128 的配对源里（同族第三份活实现改了像素不移动任何读数），`*.module.css` / CSS-in-JS 形态尚未测量——不得读成"已确认没有"。 (原编号 G-G-382 系改派工具把前缀重复贴了一次:尺子会把它读成 G-382 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4 —— 现取新号,正文逐字未动) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-410」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10270(L1 外部持有行 L15686):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L10431(G-410) 同题,派单以持有行为准,本行不再单独派单。〕 G-382 **第 3 波待办（覆盖面本身，不是功能票）** —— 未读名单已报名，按此接手：`apps/zcode-cli/packages/core/src/{tool/handlers 120, runtime/methods 98, runtime/helpers 53, subagent 22, workflow 31, hooks 17, context 12, memory 10, browser-client 7}`；`packages/desktop/src/main/index.ts`(2384，装配主入口) + 遥测/ARMS 族 + `processResource*` 13；`packages/ui/src/lib` 剩余 workspace 22/task 21/provider 15/telemetry 9/tool 9；`packages/ui/src/v4`（W2-8 在报）；`packages/services/src` 剩余 14（`conversationShare*` 3、`settingsSync` 2、`commandsService` 1004、`memoryService`、`fsFaultInjection` 等）；`packages/zcode-server-cli/src` 剩余 41；`packages/web` 17。**另有两格结构空白**：`packages/app/src/features/**` 不在守门 128 的配对源里（同族第三份活实现改了像素不移动任何读数），`*.module.css` / CSS-in-JS 形态尚未测量——不得读成"已确认没有"。 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「G-382」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10272(L1 外部持有行 L7607):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7697(G-401) 同题,派单以持有行为准,本行不再单独派单。〕 G-373 **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「G-373」,派单以那条为准,本行不再单独派单。〕 〔拍板 2026-10-05(机主选"未知即按写处理"):MCP 工具默认档不再算 `read` —— 需批准、失败不自动重跑;确实只读者按"服务器 + 工具名"显式登记白名单并把白名单纳入跨语言对账。落点在 `apps/cli/src/tools/hub/mcp-adapter.ts` 与权限档两侧持有人;派单排在 G-710 那枚同目录代理之后,避免两个代理同改一个文件〕
```

- 原 L10273(L1 外部持有行 L15686):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-382 **第 3 波待办（覆盖面本身，不是功能票）** —— 未读名单已报名，按此接手：`apps/zcode-cli/packages/core/src/{tool/handlers 120, runtime/methods 98, runtime/helpers 53, subagent 22, workflow 31, hooks 17, context 12, memory 10, browser-client 7}`；`packages/desktop/src/main/index.ts`(2384，装配主入口) + 遥测/ARMS 族 + `processResource*` 13；`packages/ui/src/lib` 剩余 workspace 22/task 21/provider 15/telemetry 9/tool 9；`packages/ui/src/v4`（W2-8 在报）；`packages/services/src` 剩余 14（`conversationShare*` 3、`settingsSync` 2、`commandsService` 1004、`memoryService`、`fsFaultInjection` 等）；`packages/zcode-server-cli/src` 剩余 41；`packages/web` 17。**另有两格结构空白**：`packages/app/src/features/**` 不在守门 128 的配对源里（同族第三份活实现改了像素不移动任何读数），`*.module.css` / CSS-in-JS 形态尚未测量——不得读成"已确认没有"。 (原编号 G-382;持有行题面「第3波待办」)
```

- 原 L10275(L1 外部持有行 L7607):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-373 **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 (原编号 G-373;持有行题面「MCP工具被标成read⇒免批准+失败自动重跑」) 〔拍板 2026-10-05(机主选"未知即按写处理"):MCP 工具默认档不再算 `read` —— 需批准、失败不自动重跑;确实只读者按"服务器 + 工具名"显式登记白名单并把白名单纳入跨语言对账。落点在 `apps/cli/src/tools/hub/mcp-adapter.ts` 与权限档两侧持有人;派单排在 G-710 那枚同目录代理之后,避免两个代理同改一个文件〕
```

- 原 L10278(L1 外部持有行 L7607):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7697(G-401) 同题,派单以持有行为准,本行不再单独派单。〕 G-373 **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-373」,派单以那条为准,本行不再单独派单。〕 〔拍板 2026-10-05(机主选"未知即按写处理"):MCP 工具默认档不再算 `read` —— 需批准、失败不自动重跑;确实只读者按"服务器 + 工具名"显式登记白名单并把白名单纳入跨语言对账。落点在 `apps/cli/src/tools/hub/mcp-adapter.ts` 与权限档两侧持有人;派单排在 G-710 那枚同目录代理之后,避免两个代理同改一个文件〕
```

- 原 L10279(L1 外部持有行 L7607):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7697(G-401) 同题,派单以持有行为准,本行不再单独派单。〕 G-768 **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `G-G-373`(族名在编号段出现两次)。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 G-373 已被 20 行认领(L7678,7853,7954,8154…),改回就等于替这本账再加一枚撞号;现号 `G-768`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-768」,派单以那条为准,本行不再单独派单。〕 〔拍板 2026-10-05(机主选"未知即按写处理"):MCP 工具默认档不再算 `read` —— 需批准、失败不自动重跑;确实只读者按"服务器 + 工具名"显式登记白名单并把白名单纳入跨语言对账。落点在 `apps/cli/src/tools/hub/mcp-adapter.ts` 与权限档两侧持有人;派单排在 G-710 那枚同目录代理之后,避免两个代理同改一个文件〕
```

- 原 L10280(L1 外部持有行 L15686):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L10431(G-410) 同题,派单以持有行为准,本行不再单独派单。〕 G-777 **第 3 波待办（覆盖面本身，不是功能票）** —— 未读名单已报名，按此接手：`apps/zcode-cli/packages/core/src/{tool/handlers 120, runtime/methods 98, runtime/helpers 53, subagent 22, workflow 31, hooks 17, context 12, memory 10, browser-client 7}`；`packages/desktop/src/main/index.ts`(2384，装配主入口) + 遥测/ARMS 族 + `processResource*` 13；`packages/ui/src/lib` 剩余 workspace 22/task 21/provider 15/telemetry 9/tool 9；`packages/ui/src/v4`（W2-8 在报）；`packages/services/src` 剩余 14（`conversationShare*` 3、`settingsSync` 2、`commandsService` 1004、`memoryService`、`fsFaultInjection` 等）；`packages/zcode-server-cli/src` 剩余 41；`packages/web` 17。**另有两格结构空白**：`packages/app/src/features/**` 不在守门 128 的配对源里（同族第三份活实现改了像素不移动任何读数），`*.module.css` / CSS-in-JS 形态尚未测量——不得读成"已确认没有"。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `G-G-382`(族名在编号段出现两次)。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 G-382 已被 9 行认领(L8289,8540,8630,8657…),改回就等于替这本账再加一枚撞号;现号 `G-777`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-777」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10281(L1 外部持有行 L15686):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L10431(G-410) 同题,派单以持有行为准,本行不再单独派单。〕 G-382 **第 3 波待办（覆盖面本身，不是功能票）** —— 未读名单已报名，按此接手：`apps/zcode-cli/packages/core/src/{tool/handlers 120, runtime/methods 98, runtime/helpers 53, subagent 22, workflow 31, hooks 17, context 12, memory 10, browser-client 7}`；`packages/desktop/src/main/index.ts`(2384，装配主入口) + 遥测/ARMS 族 + `processResource*` 13；`packages/ui/src/lib` 剩余 workspace 22/task 21/provider 15/telemetry 9/tool 9；`packages/ui/src/v4`（W2-8 在报）；`packages/services/src` 剩余 14（`conversationShare*` 3、`settingsSync` 2、`commandsService` 1004、`memoryService`、`fsFaultInjection` 等）；`packages/zcode-server-cli/src` 剩余 41；`packages/web` 17。**另有两格结构空白**：`packages/app/src/features/**` 不在守门 128 的配对源里（同族第三份活实现改了像素不移动任何读数），`*.module.css` / CSS-in-JS 形态尚未测量——不得读成"已确认没有"。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-382」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10283(L1 外部持有行 L7607):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7697(G-401) 同题,派单以持有行为准,本行不再单独派单。〕 G-373 **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-373 · G-G-373MCP工具被标成read⇒免批准+」,派单以那条为准,本行不再单独派单。〕 〔拍板 2026-10-05(机主选"未知即按写处理"):MCP 工具默认档不再算 `read` —— 需批准、失败不自动重跑;确实只读者按"服务器 + 工具名"显式登记白名单并把白名单纳入跨语言对账。落点在 `apps/cli/src/tools/hub/mcp-adapter.ts` 与权限档两侧持有人;派单排在 G-710 那枚同目录代理之后,避免两个代理同改一个文件〕
```

- 原 L10284(L1 外部持有行 L15686):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L10431(G-410) 同题,派单以持有行为准,本行不再单独派单。〕 G-382 **第 3 波待办（覆盖面本身，不是功能票）** —— 未读名单已报名，按此接手：`apps/zcode-cli/packages/core/src/{tool/handlers 120, runtime/methods 98, runtime/helpers 53, subagent 22, workflow 31, hooks 17, context 12, memory 10, browser-client 7}`；`packages/desktop/src/main/index.ts`(2384，装配主入口) + 遥测/ARMS 族 + `processResource*` 13；`packages/ui/src/lib` 剩余 workspace 22/task 21/provider 15/telemetry 9/tool 9；`packages/ui/src/v4`（W2-8 在报）；`packages/services/src` 剩余 14（`conversationShare*` 3、`settingsSync` 2、`commandsService` 1004、`memoryService`、`fsFaultInjection` 等）；`packages/zcode-server-cli/src` 剩余 41；`packages/web` 17。**另有两格结构空白**：`packages/app/src/features/**` 不在守门 128 的配对源里（同族第三份活实现改了像素不移动任何读数），`*.module.css` / CSS-in-JS 形态尚未测量——不得读成"已确认没有"。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-382 · G-G-382第3波待办」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10286(L1 外部持有行 L7607):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7697(G-401) 同题,派单以持有行为准,本行不再单独派单。〕 G-401 **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 (原编号 G-G-373 系改派工具把前缀重复贴了一次:尺子会把它读成 G-373 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4 —— 现取新号,正文逐字未动) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-401 · MCP工具被标成read⇒免批准+失败自动重跑」,派单以那条为准,本行不再单独派单。〕 〔拍板 2026-10-05(机主选"未知即按写处理"):MCP 工具默认档不再算 `read` —— 需批准、失败不自动重跑;确实只读者按"服务器 + 工具名"显式登记白名单并把白名单纳入跨语言对账。落点在 `apps/cli/src/tools/hub/mcp-adapter.ts` 与权限档两侧持有人;派单排在 G-710 那枚同目录代理之后,避免两个代理同改一个文件〕
```

- 原 L10287(L1 外部持有行 L15686):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L10431(G-410) 同题,派单以持有行为准,本行不再单独派单。〕 G-410 **第 3 波待办（覆盖面本身，不是功能票）** —— 未读名单已报名，按此接手：`apps/zcode-cli/packages/core/src/{tool/handlers 120, runtime/methods 98, runtime/helpers 53, subagent 22, workflow 31, hooks 17, context 12, memory 10, browser-client 7}`；`packages/desktop/src/main/index.ts`(2384，装配主入口) + 遥测/ARMS 族 + `processResource*` 13；`packages/ui/src/lib` 剩余 workspace 22/task 21/provider 15/telemetry 9/tool 9；`packages/ui/src/v4`（W2-8 在报）；`packages/services/src` 剩余 14（`conversationShare*` 3、`settingsSync` 2、`commandsService` 1004、`memoryService`、`fsFaultInjection` 等）；`packages/zcode-server-cli/src` 剩余 41；`packages/web` 17。**另有两格结构空白**：`packages/app/src/features/**` 不在守门 128 的配对源里（同族第三份活实现改了像素不移动任何读数），`*.module.css` / CSS-in-JS 形态尚未测量——不得读成"已确认没有"。 (原编号 G-G-382 系改派工具把前缀重复贴了一次:尺子会把它读成 G-382 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4 —— 现取新号,正文逐字未动) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-410 · 第3波待办」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10291(L1 外部持有行 L7607):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7697(G-401) 同题,派单以持有行为准,本行不再单独派单。〕 G-373 **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-373 · MCP工具被标成read⇒免批准+失败自动重跑」,派单以那条为准,本行不再单独派单。〕 〔拍板 2026-10-05(机主选"未知即按写处理"):MCP 工具默认档不再算 `read` —— 需批准、失败不自动重跑;确实只读者按"服务器 + 工具名"显式登记白名单并把白名单纳入跨语言对账。落点在 `apps/cli/src/tools/hub/mcp-adapter.ts` 与权限档两侧持有人;派单排在 G-710 那枚同目录代理之后,避免两个代理同改一个文件〕
```

- 原 L10292(L1 外部持有行 L15686):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L10431(G-410) 同题,派单以持有行为准,本行不再单独派单。〕 G-382 **第 3 波待办（覆盖面本身，不是功能票）** —— 未读名单已报名，按此接手：`apps/zcode-cli/packages/core/src/{tool/handlers 120, runtime/methods 98, runtime/helpers 53, subagent 22, workflow 31, hooks 17, context 12, memory 10, browser-client 7}`；`packages/desktop/src/main/index.ts`(2384，装配主入口) + 遥测/ARMS 族 + `processResource*` 13；`packages/ui/src/lib` 剩余 workspace 22/task 21/provider 15/telemetry 9/tool 9；`packages/ui/src/v4`（W2-8 在报）；`packages/services/src` 剩余 14（`conversationShare*` 3、`settingsSync` 2、`commandsService` 1004、`memoryService`、`fsFaultInjection` 等）；`packages/zcode-server-cli/src` 剩余 41；`packages/web` 17。**另有两格结构空白**：`packages/app/src/features/**` 不在守门 128 的配对源里（同族第三份活实现改了像素不移动任何读数），`*.module.css` / CSS-in-JS 形态尚未测量——不得读成"已确认没有"。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-382 · 第3波待办」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10294(L1 外部持有行 L7607):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7697(G-401) 同题,派单以持有行为准,本行不再单独派单。〕 G-768 **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `G-G-373`(族名在编号段出现两次)。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 G-373 已被 20 行认领(L7678,7853,7954,8154…),改回就等于替这本账再加一枚撞号;现号 `G-768`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-768 · MCP工具被标成read⇒免批准+失败自动重跑」,派单以那条为准,本行不再单独派单。〕 〔拍板 2026-10-05(机主选"未知即按写处理"):MCP 工具默认档不再算 `read` —— 需批准、失败不自动重跑;确实只读者按"服务器 + 工具名"显式登记白名单并把白名单纳入跨语言对账。落点在 `apps/cli/src/tools/hub/mcp-adapter.ts` 与权限档两侧持有人;派单排在 G-710 那枚同目录代理之后,避免两个代理同改一个文件〕
```

- 原 L10295(L1 外部持有行 L15686):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L10431(G-410) 同题,派单以持有行为准,本行不再单独派单。〕 G-777 **第 3 波待办（覆盖面本身，不是功能票）** —— 未读名单已报名，按此接手：`apps/zcode-cli/packages/core/src/{tool/handlers 120, runtime/methods 98, runtime/helpers 53, subagent 22, workflow 31, hooks 17, context 12, memory 10, browser-client 7}`；`packages/desktop/src/main/index.ts`(2384，装配主入口) + 遥测/ARMS 族 + `processResource*` 13；`packages/ui/src/lib` 剩余 workspace 22/task 21/provider 15/telemetry 9/tool 9；`packages/ui/src/v4`（W2-8 在报）；`packages/services/src` 剩余 14（`conversationShare*` 3、`settingsSync` 2、`commandsService` 1004、`memoryService`、`fsFaultInjection` 等）；`packages/zcode-server-cli/src` 剩余 41；`packages/web` 17。**另有两格结构空白**：`packages/app/src/features/**` 不在守门 128 的配对源里（同族第三份活实现改了像素不移动任何读数），`*.module.css` / CSS-in-JS 形态尚未测量——不得读成"已确认没有"。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `G-G-382`(族名在编号段出现两次)。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 G-382 已被 9 行认领(L8289,8540,8630,8657…),改回就等于替这本账再加一枚撞号;现号 `G-777`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-777 · 第3波待办」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10297(L1 外部持有行 L7607):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7697(G-401) 同题,派单以持有行为准,本行不再单独派单。〕 G-373 **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 〔【归并】重复登记副本(2026-10-01):同主键的另一条登记 「G-373 · MCP工具被标成read⇒免批准+失败自动重跑」,派单以那条为准,本行不再单独派单。〕 〔拍板 2026-10-05(机主选"未知即按写处理"):MCP 工具默认档不再算 `read` —— 需批准、失败不自动重跑;确实只读者按"服务器 + 工具名"显式登记白名单并把白名单纳入跨语言对账。落点在 `apps/cli/src/tools/hub/mcp-adapter.ts` 与权限档两侧持有人;派单排在 G-710 那枚同目录代理之后,避免两个代理同改一个文件〕
```

- 原 L10298(L1 外部持有行 L15686):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L10431(G-410) 同题,派单以持有行为准,本行不再单独派单。〕 G-382 **第 3 波待办（覆盖面本身，不是功能票）** —— 未读名单已报名，按此接手：`apps/zcode-cli/packages/core/src/{tool/handlers 120, runtime/methods 98, runtime/helpers 53, subagent 22, workflow 31, hooks 17, context 12, memory 10, browser-client 7}`；`packages/desktop/src/main/index.ts`(2384，装配主入口) + 遥测/ARMS 族 + `processResource*` 13；`packages/ui/src/lib` 剩余 workspace 22/task 21/provider 15/telemetry 9/tool 9；`packages/ui/src/v4`（W2-8 在报）；`packages/services/src` 剩余 14（`conversationShare*` 3、`settingsSync` 2、`commandsService` 1004、`memoryService`、`fsFaultInjection` 等）；`packages/zcode-server-cli/src` 剩余 41；`packages/web` 17。**另有两格结构空白**：`packages/app/src/features/**` 不在守门 128 的配对源里（同族第三份活实现改了像素不移动任何读数），`*.module.css` / CSS-in-JS 形态尚未测量——不得读成"已确认没有"。 〔【归并】重复登记副本(2026-10-01):同主键的另一条登记 「G-382 · 第3波待办」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10300(L1 外部持有行 L7607):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7697(G-401) 同题,派单以持有行为准,本行不再单独派单。〕 G-373 **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-373 · G-G-373MCP工具被标成read⇒免批准+」,派单以那条为准,本行不再单独派单。〕 〔拍板 2026-10-05(机主选"未知即按写处理"):MCP 工具默认档不再算 `read` —— 需批准、失败不自动重跑;确实只读者按"服务器 + 工具名"显式登记白名单并把白名单纳入跨语言对账。落点在 `apps/cli/src/tools/hub/mcp-adapter.ts` 与权限档两侧持有人;派单排在 G-710 那枚同目录代理之后,避免两个代理同改一个文件〕
```

- 原 L10301(L1 外部持有行 L15686):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L10431(G-410) 同题,派单以持有行为准,本行不再单独派单。〕 G-382 **第 3 波待办（覆盖面本身，不是功能票）** —— 未读名单已报名，按此接手：`apps/zcode-cli/packages/core/src/{tool/handlers 120, runtime/methods 98, runtime/helpers 53, subagent 22, workflow 31, hooks 17, context 12, memory 10, browser-client 7}`；`packages/desktop/src/main/index.ts`(2384，装配主入口) + 遥测/ARMS 族 + `processResource*` 13；`packages/ui/src/lib` 剩余 workspace 22/task 21/provider 15/telemetry 9/tool 9；`packages/ui/src/v4`（W2-8 在报）；`packages/services/src` 剩余 14（`conversationShare*` 3、`settingsSync` 2、`commandsService` 1004、`memoryService`、`fsFaultInjection` 等）；`packages/zcode-server-cli/src` 剩余 41；`packages/web` 17。**另有两格结构空白**：`packages/app/src/features/**` 不在守门 128 的配对源里（同族第三份活实现改了像素不移动任何读数），`*.module.css` / CSS-in-JS 形态尚未测量——不得读成"已确认没有"。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-382 · G-G-382第3波待办」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10303(L1 外部持有行 L7607):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7697(G-401) 同题,派单以持有行为准,本行不再单独派单。〕 G-373 **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-373 · MCP工具被标成read⇒免批准+失败自动重跑」,派单以那条为准,本行不再单独派单。〕 〔拍板 2026-10-05(机主选"未知即按写处理"):MCP 工具默认档不再算 `read` —— 需批准、失败不自动重跑;确实只读者按"服务器 + 工具名"显式登记白名单并把白名单纳入跨语言对账。落点在 `apps/cli/src/tools/hub/mcp-adapter.ts` 与权限档两侧持有人;派单排在 G-710 那枚同目录代理之后,避免两个代理同改一个文件〕
```

- 原 L10304(L1 外部持有行 L15686):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L10431(G-410) 同题,派单以持有行为准,本行不再单独派单。〕 G-382 **第 3 波待办（覆盖面本身，不是功能票）** —— 未读名单已报名，按此接手：`apps/zcode-cli/packages/core/src/{tool/handlers 120, runtime/methods 98, runtime/helpers 53, subagent 22, workflow 31, hooks 17, context 12, memory 10, browser-client 7}`；`packages/desktop/src/main/index.ts`(2384，装配主入口) + 遥测/ARMS 族 + `processResource*` 13；`packages/ui/src/lib` 剩余 workspace 22/task 21/provider 15/telemetry 9/tool 9；`packages/ui/src/v4`（W2-8 在报）；`packages/services/src` 剩余 14（`conversationShare*` 3、`settingsSync` 2、`commandsService` 1004、`memoryService`、`fsFaultInjection` 等）；`packages/zcode-server-cli/src` 剩余 41；`packages/web` 17。**另有两格结构空白**：`packages/app/src/features/**` 不在守门 128 的配对源里（同族第三份活实现改了像素不移动任何读数），`*.module.css` / CSS-in-JS 形态尚未测量——不得读成"已确认没有"。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-382 · 第3波待办」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10307(L1 外部持有行 L11361):

```
- [ ] `--allow-dangerous` 确认旁路仍在调用方(`commands/agent.ts:1757`、`server/agent-core.ts:101`), 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L10308(L1 外部持有行 L15703):

```
- [ ] **CSRF「按凭据存在性豁免」这一型无判据:票#23 修了一处,型还在** —— `plugins/csrf.ts` 原先 `if (request.headers['x-internal-service-token']) return` 只看头在不在就整条豁免,已改为 `isVerifiedInternalMachineCall(request)`(唯一出口 `apps/api/src/utils/internal-principal.ts`,复用 `secretsEqual`)。但下一个内部凭据族照样能写成 `if (request.headers['x-anything']) return`,typecheck/lint/其余门全不响。建议小门三条:① csrf/preHandler 里"以某 header/env 键的存在性为唯一条件即放行"⇒ 红,正当形态只有调用 isVerified* 出口或行内 `csrf-exempt: <原因>`(挂守门 108 的 30 天档);② 出口被摘线(无人调用或 export 不见)⇒ 判"没有出路"并参与退出码;③ 比较逻辑只许 `secretsEqual` 一份,再出现第二处 `timingSafeEqual` 即红。前置:先量 HEAD 面存量,非零就走首锚,不得当场造恒红门。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L10310(L1 外部持有行 L11361):

```
- [ ] `--allow-dangerous` 确认旁路仍在调用方(`commands/agent.ts:1757`、`server/agent-core.ts:101`), 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L10311(L1 外部持有行 L15703):

```
- [ ] **CSRF「按凭据存在性豁免」这一型无判据:票#23 修了一处,型还在** —— `plugins/csrf.ts` 原先 `if (request.headers['x-internal-service-token']) return` 只看头在不在就整条豁免,已改为 `isVerifiedInternalMachineCall(request)`(唯一出口 `apps/api/src/utils/internal-principal.ts`,复用 `secretsEqual`)。但下一个内部凭据族照样能写成 `if (request.headers['x-anything']) return`,typecheck/lint/其余门全不响。建议小门三条:① csrf/preHandler 里"以某 header/env 键的存在性为唯一条件即放行"⇒ 红,正当形态只有调用 isVerified* 出口或行内 `csrf-exempt: <原因>`(挂守门 108 的 30 天档);② 出口被摘线(无人调用或 export 不见)⇒ 判"没有出路"并参与退出码;③ 比较逻辑只许 `secretsEqual` 一份,再出现第二处 `timingSafeEqual` 即红。前置:先量 HEAD 面存量,非零就走首锚,不得当场造恒红门。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L10312(L1 外部持有行 L7940):

```
- [ ] 71. chat 多端/多标签实时同步(**V2 #23 未交付,本轮重列**;先定 SSE 与 WS 双通道的「同一消息 patch 幂等」契约) 〔【归并】重复登记副本(2026-10-08):同主键的另一条登记 「71 · chat多端/多标签实时同步」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10317(L1 外部持有行 L15703):

```
- [ ] **CSRF「按凭据存在性豁免」这一型无判据:票#23 修了一处,型还在** —— `plugins/csrf.ts` 原先 `if (request.headers['x-internal-service-token']) return` 只看头在不在就整条豁免,已改为 `isVerifiedInternalMachineCall(request)`(唯一出口 `apps/api/src/utils/internal-principal.ts`,复用 `secretsEqual`)。但下一个内部凭据族照样能写成 `if (request.headers['x-anything']) return`,typecheck/lint/其余门全不响。建议小门三条:① csrf/preHandler 里"以某 header/env 键的存在性为唯一条件即放行"⇒ 红,正当形态只有调用 isVerified* 出口或行内 `csrf-exempt: <原因>`(挂守门 108 的 30 天档);② 出口被摘线(无人调用或 export 不见)⇒ 判"没有出路"并参与退出码;③ 比较逻辑只许 `secretsEqual` 一份,再出现第二处 `timingSafeEqual` 即红。前置:先量 HEAD 面存量,非零就走首锚,不得当场造恒红门。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L10318(L1 外部持有行 L11361):

```
- [ ] `--allow-dangerous` 确认旁路仍在调用方(`commands/agent.ts:1757`、`server/agent-core.ts:101`), 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L10319(L1 外部持有行 L11361):

```
- [ ] `--allow-dangerous` 确认旁路仍在调用方(`commands/agent.ts:1757`、`server/agent-core.ts:101`), 〔【归并】重复登记副本(2026-10-04):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L10324(L1 外部持有行 L10323):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-09/goal清偿席:本行是守门 71 自愈把**已让号的老形态**复活回来的残行 —— 编号 G-79 已让出(让号记录见持有行 G-1106294 行尾),本行摘掉编号令牌、正文逐字保留、**不翻勾、不再单独派单**,派单一律走 G-1106294)〕 **ai-service 全量实跑档在干净 HEAD 上量到 38 枚红(16815 passed / 8 skipped / 2 xfailed),两面同参数复跑后定名:7 枚已被他席在飞改动修好(不进本行射程)、31 枚是 HEAD 自身的内容红** —— 逐枚清单与根因取证见 `docs/benchmark-evidence/2026-10/g1058646-clean-head-pytest.txt`,仍红 31 行清单见 `docs/benchmark-evidence/2026-10/g1058646-still-red-31.txt`(证据封缄 `#EVIDENCE-RC=1`,复现命令写在该证据件末段;两面复跑用同一次 pytest.main 单调用,第一版逐枚 pytest.main 会拿到 ExitCode 2 把真红写成"RC2" —— 那是尺子错不是世界错)。**根因四簇**:A mcp 工具面 12 枚(用例用 1 参 lambda 去 monkeypatch `_validate_path_in_workspace`,而 `app/services/mcp_server.py` 已按 `(path, extra_roots)` 两参调用);B role parity 4 枚(测试替身 spy 不认产品新增 kwarg `session_id`;另一枚是用例自带的覆盖面自证在报「只找到 1 个构造点,尺子大概失效了」—— **真信号,不得靠调阈值消红**);C 并行中断 4 枚(用例引用 `AgentLoopV2` 的 `_mode_policy` / `_executed_tool_calls`,HEAD 产品面到底有没有这两个属性由 `git grep -c -F _mode_policy HEAD -- apps/ai-service/app` 现读判定;若为 0 则属"测试先行而实现未入库",**禁止补一个属性蒙绿**);D 其余 11 枚逐枚读因中。**这一行为什么现在开着**:两路修复代理正按 A / B-C-D 分工只改各自清单内的**干净测试文件**;`app/services/mcp_server.py`、`app/services/agent_loop_v2.py`、`app/routers/llm.py`、`app/routers/agent_runtime.py` 此刻是他席在飞(` M`),凡"必须改这些才能转绿"的用例一律停手回报、不替他人改(§12)。**收口判据(缺一不算完)**:① 改动入库后在**新的干净检出**上单调用重跑 `docs/benchmark-evidence/2026-10/g1058646-still-red-31.txt` 全表 ⇒ 31→0;② `node scripts/run-ai-service-tests.mjs` 全量档重跑一次,收集面与执行面都不被破坏;③ 每条改绿的断言带"改坏必红"的变异自证(只报跑绿不算交付);④ 那 7 枚由持有其在飞改动的一席随自己提交翻账,本行不代记。
```

- 原 L10351(L1 外部持有行 L15771):

```
- [ ] page_* 动词的**跨端登记**未做:web / miniapp-taro / RN / desktop / api 侧 `agent_action` 枚举与〔【归并】重复登记副本(2026-10-01):同主键的另一条登记已翻勾(2026-09-25,正文可按「page_* 动词跨端登记」检索;孪生旧副本同题已勾(同前检索;apps/api 侧子项 2026-09-28 复判「无消费方,登记即造假,不硬接、不再派单」),本行正文亦被并发插入截断,派单以翻勾那条为准,本行不再单独派单。〕 〔复测@2026-10-09 现读,本行仍成立且不得由 agent 强行收口:`git grep -nE "'page_[a-z_]+'" HEAD` 按端计数 = types 7 / extension 2 / api 2 / **miniapp 0 / RN(packages/app)0 / desktop 0 / cli 0**。行内旧注指向的"已翻勾持有行"正文已随归档离开台账面,而其"现行判定见 O73 条①"那一格在 O73 小节里找不到 page_ 任何逐字判定 —— **失效指针按 §1 必须消掉,不得据它翻勾**。为什么"补上枚举"不是清账:page_* 是浏览器面的动作(web/extension 才有点击、悬停、取点),这 0 处的端**没有生产者**;硬登记只会在跨端枚举对账上产出"看起来齐全、实际永远不会响"的死档(与 §12e 那条"登记表腐烂"同族,而登记即造假已被本仓复判过一次)。真正能清这条的判据是一句话:**这些动词会不会经共享事件流/历史落到这三个端的屏上?** 会 ⇒ 缺的是显示词表(五语言同批,§19),补它才算收口;不会 ⇒ 这一格应当按"平台独占,单端登记"改写本行并结案,而不是把七个键抄进没有生产者的一端。该判断涉及对外语义(哪端能展示哪类动作),属机主/该端持有者裁决,不由本票代定。〕
```

- 原 L10409(L1 外部持有行 L11430):

```
- [ ] page_* 动词的**跨端登记**未做:web / miniapp-taro / RN / desktop / api 侧 `agent_action` 枚举与〔【归并】重复登记副本(2026-10-10 量,本席):同主键另有两条带完整正文的未勾登记(现读入口 `git show HEAD:PROJECT_PLAN.md | grep -c "page_\* 动词"` = 8 条命中,其中 3 条未勾登记 + 5 条已归档占位),本行是其中被并发插入截断的短副本 —— 正文到「枚举与」即断,没有任何交代,于是它进了 `--open --dispatchable` 的出单,而下一个接手的人拿到的是半句话。派单一律走带复测结论的那条长副本(现读 831 字节,同前检索式可定位);按 §1 的 F4 口径**只加指针、不动勾选**(长副本那条自己写明这一格等的是「page_* 会不会经共享事件流落到小程序 / RN / desktop 屏上」的产品与该端持有者裁决,不是 agent 能代定的,更没有"做完了")。也不摘声明位编号(守门 71 按"编号 + 题面原文前缀"判丢行,摘号会让自愈层把本行整条回捞)。〕
```

- 原 L10538(L1 外部持有行 L11414):

```
- [ ] **本票复测后仍然开放、且值得派单的两件**(不是遗漏,是量完之后的真残余):① `RN / miniapp 未消费 tailPreview` —— 两端 1742 个跟踪文件里命中 0,唯一消费者是 web;难点不是接一行,而是两端如何取到 `context-attribution` 这份共享引擎(实测两端对它**零引用**,共享引擎在移动端没有装载路径)。② `apps/api` 侧 `page_*` 只有测试面引用、无生产侧登记(一格小账)。〔2026-09-28 复判(② 本格):**判"无消费方,登记即造假",不硬接、保持未勾、不再派单** —— HEAD 复跑:7 条 `page_*` 动词字面量在 `apps/api/src` 命中 0(git grep HEAD),仅测试面 `tests/agent-control-ui.test.ts` L874-882 引用,"只有测试面引用"仍成立。api 侧既有出口形态是**动词不透明的纯转发/计数面**:`capabilitySchema.browserPageActions=z.array(z.string()).max(20)`(routes/agent-control.ts:218)+ `/status` 计数(:463)+ `executeSchema.action=z.string()`(:232,不解释动词名直接 WS 转发);且**六族动词(browser/computer/ui/app_ui/miniapp_ui/ext_ui)在 api 生产面同样零动词字面量** —— page_* 不是特例,是转发面的设计常态。与单源的类型级衔接已由 `AgentControlCapability` cast 承担(字段类型 `BrowserPageControlActionType[]` 即 packages/types 单源);动词名的真实消费方在 extension(`@ihui/dom-actions` PAGE_ACTIONS,编译期护栏)与 CLI,服务端授权闸读的是 `browserPageActions` **计数>0** 而非动词名(ai-service `control_autonomy.py:233`)。硬"登记"只有两条路:在 api 侧另抄一份成员清单(§1 状态词汇四份副本的教训,明令禁止),或只为本族加运行期枚举校验(与其余六族形态不一致,且 schema 注释已记过失败模式"端上多报一条⇒整条 capability 上报 400 静默失去该端全部能力")。⇒ 本格按"平台域外/无消费方"收口,登记即造假,不硬造。取证:`check-capability-catalog` 全量绿(62 scope / 180 handler 0 未覆盖 / D 0 腐化,EXIT 0)、`@ihui/api` typecheck 0 错、`agent-control-ui.test.ts` 25/25 过(含 ㉕ 句柄族 7 动词计数)。〕 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L10541(L1 外部持有行 L11414):

```
- [ ] **本票复测后仍然开放、且值得派单的两件**(不是遗漏,是量完之后的真残余):① `RN / miniapp 未消费 tailPreview` —— 两端 1742 个跟踪文件里命中 0,唯一消费者是 web;难点不是接一行,而是两端如何取到 `context-attribution` 这份共享引擎(实测两端对它**零引用**,共享引擎在移动端没有装载路径)。② `apps/api` 侧 `page_*` 只有测试面引用、无生产侧登记(一格小账)。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L10545(L1 外部持有行 L11427):

```
- [ ]〔【归并】重复登记副本·同题不同编号(2026-09-28):本行与持有行是同一件事的第二份登记(题面逐字相同、编号不同 —— 两条分支各自取号后并到同一份账面才相遇)。持有行是「RN「记住密码」把账号+密码明文写进 AsyncStorage」那一条待办(编号 G-361,按标题前缀寻行,不写行号);本行摘掉行首编号、正文逐字保留、不翻勾、不并抄,派单以持有行为准。〕 **RN「记住密码」把账号+密码明文写进 AsyncStorage,而它正是票#20 那条自动登录判据的凭据源(需产品口径)** —— 实测 `apps/mobile-rn/src/lib/credential-storage.ts:72-87` 将 `{account,password}` 原样存入 `ihui-remember-credentials`(Android 上 AsyncStorage 是应用私有目录下的明文文件,root 或备份可读),而 `shouldAttemptAutoLogin` 读的 `hasRememberedCredentials()` 就是这一位。SecureStore 那层已在 `src/lib/auth/secure-store.ts` 用于凭据,记住密码这条链没跟上。两条出口:① 改存 SecureStore —— 但**登出标记必须留在不同层**:票#20 的 `ihui-session-logged-out` 刻意与凭据不同寿命(同层会被 `clearAll` 一起删,等于自己否决自己,理由写在该文件注释里);② 取消「记住密码」只留「自动登录」。禁止的省事做法:直接删 key —— 已勾选用户的勾选会静默失效且无任何提示。
```

- 原 L10552(L1 外部持有行 L11414):

```
- [ ] **本票复测后仍然开放、且值得派单的两件**(不是遗漏,是量完之后的真残余):① `RN / miniapp 未消费 tailPreview` —— 两端 1742 个跟踪文件里命中 0,唯一消费者是 web;难点不是接一行,而是两端如何取到 `context-attribution` 这份共享引擎(实测两端对它**零引用**,共享引擎在移动端没有装载路径)。② `apps/api` 侧 `page_*` 只有测试面引用、无生产侧登记(一格小账)。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L10554(L1 外部持有行 L11414):

```
- [ ] **本票复测后仍然开放、且值得派单的两件**(不是遗漏,是量完之后的真残余):① `RN / miniapp 未消费 tailPreview` —— 两端 1742 个跟踪文件里命中 0,唯一消费者是 web;难点不是接一行,而是两端如何取到 `context-attribution` 这份共享引擎(实测两端对它**零引用**,共享引擎在移动端没有装载路径)。② `apps/api` 侧 `page_*` 只有测试面引用、无生产侧登记(一格小账)。〔2026-09-28 复判(② 本格):**判"无消费方,登记即造假",不硬接、保持未勾、不再派单** —— HEAD 复跑:7 条 `page_*` 动词字面量在 `apps/api/src` 命中 0(git grep HEAD),仅测试面 `tests/agent-control-ui.test.ts` L874-882 引用,"只有测试面引用"仍成立。api 侧既有出口形态是**动词不透明的纯转发/计数面**:`capabilitySchema.browserPageActions=z.array(z.string()).max(20)`(routes/agent-control.ts:218)+ `/status` 计数(:463)+ `executeSchema.action=z.string()`(:232,不解释动词名直接 WS 转发);且**六族动词(browser/computer/ui/app_ui/miniapp_ui/ext_ui)在 api 生产面同样零动词字面量** —— page_* 不是特例,是转发面的设计常态。与单源的类型级衔接已由 `AgentControlCapability` cast 承担(字段类型 `BrowserPageControlActionType[]` 即 packages/types 单源);动词名的真实消费方在 extension(`@ihui/dom-actions` PAGE_ACTIONS,编译期护栏)与 CLI,服务端授权闸读的是 `browserPageActions` **计数>0** 而非动词名(ai-service `control_autonomy.py:233`)。硬"登记"只有两条路:在 api 侧另抄一份成员清单(§1 状态词汇四份副本的教训,明令禁止),或只为本族加运行期枚举校验(与其余六族形态不一致,且 schema 注释已记过失败模式"端上多报一条⇒整条 capability 上报 400 静默失去该端全部能力")。⇒ 本格按"平台域外/无消费方"收口,登记即造假,不硬造。取证:`check-capability-catalog` 全量绿(62 scope / 180 handler 0 未覆盖 / D 0 腐化,EXIT 0)、`@ihui/api` typecheck 0 错、`agent-control-ui.test.ts` 25/25 过(含 ㉕ 句柄族 7 动词计数)。〕 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L10563(L1 外部持有行 L11414):

```
- [ ] **本票复测后仍然开放、且值得派单的两件**(不是遗漏,是量完之后的真残余):① `RN / miniapp 未消费 tailPreview` —— 两端 1742 个跟踪文件里命中 0,唯一消费者是 web;难点不是接一行,而是两端如何取到 `context-attribution` 这份共享引擎(实测两端对它**零引用**,共享引擎在移动端没有装载路径)。② `apps/api` 侧 `page_*` 只有测试面引用、无生产侧登记(一格小账)。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L10565(L1 外部持有行 L11414):

```
- [ ] **本票复测后仍然开放、且值得派单的两件**(不是遗漏,是量完之后的真残余):① `RN / miniapp 未消费 tailPreview` —— 两端 1742 个跟踪文件里命中 0,唯一消费者是 web;难点不是接一行,而是两端如何取到 `context-attribution` 这份共享引擎(实测两端对它**零引用**,共享引擎在移动端没有装载路径)。② `apps/api` 侧 `page_*` 只有测试面引用、无生产侧登记(一格小账)。〔2026-09-28 复判(② 本格):**判"无消费方,登记即造假",不硬接、保持未勾、不再派单** —— HEAD 复跑:7 条 `page_*` 动词字面量在 `apps/api/src` 命中 0(git grep HEAD),仅测试面 `tests/agent-control-ui.test.ts` L874-882 引用,"只有测试面引用"仍成立。api 侧既有出口形态是**动词不透明的纯转发/计数面**:`capabilitySchema.browserPageActions=z.array(z.string()).max(20)`(routes/agent-control.ts:218)+ `/status` 计数(:463)+ `executeSchema.action=z.string()`(:232,不解释动词名直接 WS 转发);且**六族动词(browser/computer/ui/app_ui/miniapp_ui/ext_ui)在 api 生产面同样零动词字面量** —— page_* 不是特例,是转发面的设计常态。与单源的类型级衔接已由 `AgentControlCapability` cast 承担(字段类型 `BrowserPageControlActionType[]` 即 packages/types 单源);动词名的真实消费方在 extension(`@ihui/dom-actions` PAGE_ACTIONS,编译期护栏)与 CLI,服务端授权闸读的是 `browserPageActions` **计数>0** 而非动词名(ai-service `control_autonomy.py:233`)。硬"登记"只有两条路:在 api 侧另抄一份成员清单(§1 状态词汇四份副本的教训,明令禁止),或只为本族加运行期枚举校验(与其余六族形态不一致,且 schema 注释已记过失败模式"端上多报一条⇒整条 capability 上报 400 静默失去该端全部能力")。⇒ 本格按"平台域外/无消费方"收口,登记即造假,不硬造。取证:`check-capability-catalog` 全量绿(62 scope / 180 handler 0 未覆盖 / D 0 腐化,EXIT 0)、`@ihui/api` typecheck 0 错、`agent-control-ui.test.ts` 25/25 过(含 ㉕ 句柄族 7 动词计数)。〕 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L10661(L1 外部持有行 L3824):

```
- [ ] 重启宿主/开机后 `%TEMP%` 才会真指 `D:\DevEnv\Temp`;在此之前任何未接 `scratch-dir` 的 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记逐字相同的另一条登记(与本行正文逐字相同,可按正文检索;现存多处同文副本)(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L10663(L1 外部持有行 L4356):

```
- [ ]（进行中） **守卫票: `scripts/i18n-apply.mjs` 把未知参数当"无参",`--help` 会直接进写盘模式**。本轮实测代价:跑 `node scripts/i18n-apply.mjs --help` 想查用法,结果它拿一份陈旧 `i18n-translations.json` **重排并改写了 en/ja/ko/zh-TW 四份语言包**(各 176–214 行新增 / 35–39 行删除)。四个文件当时是干净的,已按 `git show HEAD:<path>` 逐字节还原 + 复验(parse OK、`git status` 空),零损失。**要求的修法**:① `--help`/`-h` 只打印用法并 exit 0;② 任何未识别参数一律 exit 2 并点名该参数,**不得降级成默认动作**;③ 写盘前若 `--check` 未跑过或输入载荷的 `translatedAt` 早于目标文件 mtime,拒绝写并提示(本次那份载荷就是旧的)。验收:`node scripts/i18n-apply.mjs --help` 必须**不产生任何 git 脏文件**(用 `git status --porcelain -- packages/i18n` 断言),并补一条镜像测试钉死这条负向判据。归属:下一轮派单;在此之前**任何人不要用该脚本试参数**。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记逐字相同的另一条登记(与本行正文逐字相同,可按正文检索;现存多处同文副本)(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L10664(L1 外部持有行 L4700):

```
- [ ] **本轮未落地、需重做的一批(web 86 处内的键名对齐)**:该批次报告改了 4 个文件(`DeveloperKeyDialog` / `AiGenerationContent` / `PermissionSelector` / `helpers`),**逐条按内容复核后全部不在 HEAD**(`git grep <新键名> HEAD -- apps/web` 四处均 0 命中),工作区也已被并发会话覆盖 → 判为**丢失需重做**,不要当成已完成。中途我一度按"工作区里有"记成"已落地",那是读到了被覆盖前的窗口 —— 并行期复核一律以 **HEAD 对象树内容**为准(档案第 4 节已记此教训)。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记逐字相同的另一条登记(与本行正文逐字相同,可按正文检索;现存多处同文副本)(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L10665(L1 外部持有行 L4709):

```
- [ ]（进行中）**守门 91 冻结的 9 处待清 + 一项方法论债(2026-09-24)**:① study-publish 整文件主题化(14 处 `getTokens('light')`,8 处在模块级 StyleSheet.create 里,须改成按 scheme 生成的函数或下沉到组件内), 改完后 `node scripts/check-theme-prop-wiring.mjs --update-baseline` 应收窄; ② 7 个他人 M 在制的屏(CourseDetail / Distribution / LiveDetail / ModelPlaza / N8nModel / PostCreate / SharedDemo)待其会话自行接线; ③ `{...props}` 展开类站点被判 spread-unknown(判不出即如实报,不静默放行)—— 要真正覆盖须先给端内 wrapper 的 props 建立类型事实,属独立改造; ④ 方法论债:**本轮两次误判同源** —— 一次是把像素被 `rgba(0,0,0,0.6)` 遮罩压暗 40% 当成"颜色没落上", 一次是用"文本里有没有某个键"统计出"0 处漏传"。两者的共同错误是**用一个不测量目标东西的探针给出肯定结论**。 纪律:凡给出"0 处 / 没有 / 已全清"这类否定性结论,必须先构造一个**已知应被命中的正例**喂给同一判据(阳性对照), 否则该结论不得写进文档或据此决定"不做"。 〔PROGRESS 2026-09-25: ① study-publish 共享屏 15 处 getTokens(light) 由 commit 5ce93b9e1 清零(守门91/83 全绿);②③④ 仍开放〕 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记逐字相同的另一条登记(与本行正文逐字相同,可按正文检索;现存多处同文副本)(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L10666(L1 外部持有行 L7989):

```
- [ ]（进行中）**合流会静默吞掉「已真机验证」的代码修复,而守门 76/71 对此零覆盖(2026-09-24 实测)**: 本会话 84583fdf6 把 PlazaScreen.tsx:464 / RankingDetailScreen.tsx:171 的 colorScheme 字面量改为 resolvedTheme,**并在 v0.0.5/code8 真机复测通过**(广场页正文由 #f5f5f5/#ebebeb 变 #242424/#1a1a1a,与 NavBar/TabBar 同档)。随后几轮 git-sync-converge 之后,HEAD 里那两处**又变回了写死 "light"** —— 并发会话有一条基于 b1a162c4e7(同文件改造)的独立提交线,经 merge-tree 合流时结果取了对方侧;该合并在 git log -- <path> 的历史简化里被隐去(84583fdf6 根本不出现),所以「我的提交还在 ancestry-path 上」完全不能证明「我的改动还在文件里」。 为什么无人拦:守门 76(stale-revert)与 71(plan-line-loss)都只在 commit 时按**暂存内容**判定,而 converge 走 merge-tree + commit-tree + update-ref,**不跑任何钩子** —— 合流层是这两道门的共同盲区。本会话同一机制差点也吞掉测试桩修复,逐字符串核对后判为误报(命中的是我自己写的解释性注释,非真实 vi.mock 调用),说明受害面是全部经合流的代码改动,不止文档。 本轮处置:已用 cc63b5bd0a 前向重落,并在提交前逐行核对「工作区 vs 当前 HEAD 差量恰好只有这 5 行」(2 处字面量替换 + 1 行 import + 1 行 useTheme 钩子),对方对这两个文件的其余改动零触碰。 建议补法(未擅自实现,属他人守门):converge 成功出口处,对本次推送范围内每个文件跑一次「本会话已提交过的 blob 是否仍被 HEAD 版本包含」断言 —— 即把守门 71 对登记行做的事,对代码行做一次;或更廉价:合流后重跑一次本会话关键判据的 grep 断言。在补上之前,任何「真机验证过」的代码修复,收尾时必须用 git show HEAD:<file> 再核一次,不得以「commit 在 ancestry 上」代替。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记逐字相同的另一条登记(与本行正文逐字相同,可按正文检索;现存多处同文副本)(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L10667(L1 外部持有行 L7990):

```
- [ ] **仍在这台机器上、不由我裁的**:C 盘剩余 5 项未识别条目(优酷 1.3G / ClipFlow / 输入法字典 / 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记逐字相同的另一条登记(与本行正文逐字相同,可按正文检索;现存多处同文副本)(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L10668(L1 外部持有行 L15446):

```
- [ ]（进行中）RN 分类栏统一收口(承 2026-09-23 04:19 会话被取消的迁移,用户原话"所有的菜单栏分类栏没有设计好 统一 好看的符合项目统一的样式 点击后下拉窗的形式呈现 左右滑动"):地基 `packages/app/src/components/category/{CategoryInlineBar,CategoryDropdown}` 补包根导出(`@ihui/rn-app` 可直接 import,此前只到 `components/index.ts` 端内取不到)+ Dropdown 面板改 `ScrollView`(修"选项多于 8 条被 maxHeight+overflow:hidden 静默裁切")+ 圆角一律 `rnRadius` 档(对齐同日新立 §4 圆角单一源头)。**迁移面 16 处**:共享层 9 屏(square/plaza/order/team/ranking/recruitment/token-value/study-index/study-publish,其中 study-publish 的 API 动态赛道 = CategoryDropdown 装车点)+ 端内 7 屏(ProfileScreen / TokenValueScreen / TopicListScreen / StudyIndexScreen / MaterialList / AgentScreen 赛道弹层双行并删违规 `trackDivider` hairline 分割线 / FenLeiOverlay 赛道行+分类网格双条)。孤儿裁定:`StudyBar`、`SingleTypeBar` 已零调用点(删除需同步下调 `scripts/radius-single-source-baseline.json` 的 2 条基线,本轮未做)。**真机取证(v0.0.4 / code 5 release 包,Hermes 字节码 bundle grep 命中 `CategoryInlineBar` / `agent-track-bar` / `ctaFill`)**:① 点顶栏「分类」弹出的那块当时仍是迁移清单外的 `FenLeiOverlay`(已补迁);② 像素直方图实测选中 chip 前景 = 深色 `ctaText` #16262E 而底色仍是容器同色 #1A1A1A —— `ctaFill` 根本没落上,即"选中态看不见";③ idle chip 以 `surface.card` 作底,落在同为 `surface.card` 的弹层面板上完全隐形。已修:idle 底改 `surface.muted` + 描边 `border.medium`(两套主题下与页面 bg / 面板 card 均不同档)。**根因未定**:曾按"Pressable 函数式 style 整条路径未生效"归因并把容器视觉移到普通 View 数组路径(该改动本身无害,少一个变量),但随即被反证 —— 全仓 58 个文件用同款 `style={({pressed}) => [base, active ? activeStyle : null]}`,其中 `SingleTypeBar.tsx:142-143` 与迁移前的 SquareScreen 内联条都是这条路径且真机显示正常;`ctaText`(#16262E)在同一 chip 上生效而 `ctaFill`(#a3c4d6)不生效,也排除了"整套 token 缺失"(dist 陈旧版两者皆无,若走 dist 文字应回落到 #A3A3A3)。待手机回线后先加高对比标记色(如临时 `#FF00FF`)做二分,再定是样式合并路径还是取色问题。待复验(设备 19:5x 起 `adb devices` 为空,kill-server 重连无效,USB 侧仍见 3 个 Composite Device)。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记逐字相同的另一条登记(与本行正文逐字相同,可按正文检索;现存多处同文副本)(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L10669(L1 外部持有行 L15652):

```
- [ ] **C 组刻意没动,待用户定性**:`C:\ai_zhs\cert\*.pem`(5 个,每个仅 10–20 字节,不可能是真 PEM, 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记逐字相同的另一条登记(与本行正文逐字相同,可按正文检索;现存多处同文副本)(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L10670(L1 外部持有行 L4709):

```
- [ ]（进行中）**守门 91 冻结的 9 处待清 + 一项方法论债(2026-09-24)**:① study-publish 整文件主题化(14 处 `getTokens('light')`,8 处在模块级 StyleSheet.create 里,须改成按 scheme 生成的函数或下沉到组件内), 改完后 `node scripts/check-theme-prop-wiring.mjs --update-baseline` 应收窄; ② 7 个他人 M 在制的屏(CourseDetail / Distribution / LiveDetail / ModelPlaza / N8nModel / PostCreate / SharedDemo)待其会话自行接线; ③ `{...props}` 展开类站点被判 spread-unknown(判不出即如实报,不静默放行)—— 要真正覆盖须先给端内 wrapper 的 props 建立类型事实,属独立改造; ④ 方法论债:**本轮两次误判同源** —— 一次是把像素被 `rgba(0,0,0,0.6)` 遮罩压暗 40% 当成"颜色没落上", 一次是用"文本里有没有某个键"统计出"0 处漏传"。两者的共同错误是**用一个不测量目标东西的探针给出肯定结论**。 纪律:凡给出"0 处 / 没有 / 已全清"这类否定性结论,必须先构造一个**已知应被命中的正例**喂给同一判据(阳性对照), 否则该结论不得写进文档或据此决定"不做"。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记逐字相同的另一条登记(与本行正文逐字相同,可按正文检索;现存多处同文副本)(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L10671(L1 外部持有行 L8009):

```
- [ ] **紧急(他人暂存态,非本会话所为,2026-09-24 11:0x 发现)**:**索引里有 16 条"已暂存的删除"**,一次不带 pathspec 的普通 commit 就会把这些**已入库功能从版本树删掉**。清单含三个成体系功能族 + 一道守门:① D62 语音字幕(`packages/shared/src/chat/voice-subtitles.ts` + web 组件 + 测试)、② D91 批注锚点(`annotation-anchors.ts` 同族)、③ D67 额度归属(`quota-ownership.ts` 同族)、④ **并发会话 cb99ef0c 刚提交的 `apps/mobile-rn/src/theme/color-scheme-sync.ts` 及其测试与 NativeWind mock**(删掉即把"App 主题开关驱动 NativeWind"这次修复整体回退)、⑤ `scripts/check-home-junctions.mjs` + 其镜像测试。**判为误删而非迁移的依据**:索引里的桶文件 `packages/shared/src/chat/index.ts` **与 HEAD 一字未改且仍导出这三模块**(二者矛盾 ⇒ 构建必炸,实测 Metro 就在 `export * from './voice-subtitles'` 处失败),且`git ls-files` 全仓**无替代路径**。**本会话处置边界**:只把 13 个文件(2626 行)的内容**恢复到工作区**让构建可用,**索引一字未动** —— 是否撤销这些暂存删除由制造它们的会话自己决定(§5b:他人已暂存的删除只报数、不代裁)。取证:`git diff --cached --diff-filter=D --name-only`;复跑恢复:`node .ihui-agent/tmp/rn-build/restore-worktree.mjs`。**另注**:`heal-worktree-tracked.mjs --check` 此时报"工作区已跟踪文件存续正常"—— 其判据②要求"索引 blob == HEAD blob",而暂存删除使该条件不成立,故**这类"已暂存的删除"不在存续自愈覆盖面上**,是一道无人看的路;要闭环需在守门侧对 `--diff-filter=D` 的暂存删除单独计数并阻断(未擅自新增守门,留单)。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记同主键的另一条登记「D62 · **紧急(他人暂存态,非本会话所为,2026-09-24 11:0x 发现)**」(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L10672(L1 外部持有行 L3824):

```
- [ ] 重启宿主/开机后 `%TEMP%` 才会真指 `D:\DevEnv\Temp`;在此之前任何未接 `scratch-dir` 的 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记逐字相同的另一条登记(与本行正文逐字相同,可按正文检索;现存多处同文副本)(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L10674(L1 外部持有行 L4709):

```
- [ ]（进行中）**守门 91 冻结的 9 处待清 + 一项方法论债(2026-09-24)**:① study-publish 整文件主题化(14 处 `getTokens('light')`,8 处在模块级 StyleSheet.create 里,须改成按 scheme 生成的函数或下沉到组件内), 改完后 `node scripts/check-theme-prop-wiring.mjs --update-baseline` 应收窄; ② 7 个他人 M 在制的屏(CourseDetail / Distribution / LiveDetail / ModelPlaza / N8nModel / PostCreate / SharedDemo)待其会话自行接线; ③ `{...props}` 展开类站点被判 spread-unknown(判不出即如实报,不静默放行)—— 要真正覆盖须先给端内 wrapper 的 props 建立类型事实,属独立改造; ④ 方法论债:**本轮两次误判同源** —— 一次是把像素被 `rgba(0,0,0,0.6)` 遮罩压暗 40% 当成"颜色没落上", 一次是用"文本里有没有某个键"统计出"0 处漏传"。两者的共同错误是**用一个不测量目标东西的探针给出肯定结论**。 纪律:凡给出"0 处 / 没有 / 已全清"这类否定性结论,必须先构造一个**已知应被命中的正例**喂给同一判据(阳性对照), 否则该结论不得写进文档或据此决定"不做"。 〔PROGRESS 2026-09-25: ① study-publish 共享屏 15 处 getTokens(light) 由 commit 5ce93b9e1 清零(守门91/83 全绿);②③④ 仍开放〕 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记逐字相同的另一条登记(与本行正文逐字相同,可按正文检索;现存多处同文副本)(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L10675(L1 外部持有行 L7989):

```
- [ ]（进行中）**合流会静默吞掉「已真机验证」的代码修复,而守门 76/71 对此零覆盖(2026-09-24 实测)**: 本会话 84583fdf6 把 PlazaScreen.tsx:464 / RankingDetailScreen.tsx:171 的 colorScheme 字面量改为 resolvedTheme,**并在 v0.0.5/code8 真机复测通过**(广场页正文由 #f5f5f5/#ebebeb 变 #242424/#1a1a1a,与 NavBar/TabBar 同档)。随后几轮 git-sync-converge 之后,HEAD 里那两处**又变回了写死 "light"** —— 并发会话有一条基于 b1a162c4e7(同文件改造)的独立提交线,经 merge-tree 合流时结果取了对方侧;该合并在 git log -- <path> 的历史简化里被隐去(84583fdf6 根本不出现),所以「我的提交还在 ancestry-path 上」完全不能证明「我的改动还在文件里」。 为什么无人拦:守门 76(stale-revert)与 71(plan-line-loss)都只在 commit 时按**暂存内容**判定,而 converge 走 merge-tree + commit-tree + update-ref,**不跑任何钩子** —— 合流层是这两道门的共同盲区。本会话同一机制差点也吞掉测试桩修复,逐字符串核对后判为误报(命中的是我自己写的解释性注释,非真实 vi.mock 调用),说明受害面是全部经合流的代码改动,不止文档。 本轮处置:已用 cc63b5bd0a 前向重落,并在提交前逐行核对「工作区 vs 当前 HEAD 差量恰好只有这 5 行」(2 处字面量替换 + 1 行 import + 1 行 useTheme 钩子),对方对这两个文件的其余改动零触碰。 建议补法(未擅自实现,属他人守门):converge 成功出口处,对本次推送范围内每个文件跑一次「本会话已提交过的 blob 是否仍被 HEAD 版本包含」断言 —— 即把守门 71 对登记行做的事,对代码行做一次;或更廉价:合流后重跑一次本会话关键判据的 grep 断言。在补上之前,任何「真机验证过」的代码修复,收尾时必须用 git show HEAD:<file> 再核一次,不得以「commit 在 ancestry 上」代替。 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记逐字相同的另一条登记(与本行正文逐字相同,可按正文检索;现存多处同文副本)(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L10676(L1 外部持有行 L7990):

```
- [ ] **仍在这台机器上、不由我裁的**:C 盘剩余 5 项未识别条目(优酷 1.3G / ClipFlow / 输入法字典 / 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记逐字相同的另一条登记(与本行正文逐字相同,可按正文检索;现存多处同文副本)(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L10677(L1 外部持有行 L15446):

```
- [ ]（进行中）RN 分类栏统一收口(承 2026-09-23 04:19 会话被取消的迁移,用户原话"所有的菜单栏分类栏没有设计好 统一 好看的符合项目统一的样式 点击后下拉窗的形式呈现 左右滑动"):地基 `packages/app/src/components/category/{CategoryInlineBar,CategoryDropdown}` 补包根导出(`@ihui/rn-app` 可直接 import,此前只到 `components/index.ts` 端内取不到)+ Dropdown 面板改 `ScrollView`(修"选项多于 8 条被 maxHeight+overflow:hidden 静默裁切")+ 圆角一律 `rnRadius` 档(对齐同日新立 §4 圆角单一源头)。**迁移面 16 处**:共享层 9 屏(square/plaza/order/team/ranking/recruitment/token-value/study-index/study-publish,其中 study-publish 的 API 动态赛道 = CategoryDropdown 装车点)+ 端内 7 屏(ProfileScreen / TokenValueScreen / TopicListScreen / StudyIndexScreen / MaterialList / AgentScreen 赛道弹层双行并删违规 `trackDivider` hairline 分割线 / FenLeiOverlay 赛道行+分类网格双条)。孤儿裁定:`StudyBar`、`SingleTypeBar` 已零调用点(删除需同步下调 `scripts/radius-single-source-baseline.json` 的 2 条基线,本轮未做)。**真机取证(v0.0.4 / code 5 release 包,Hermes 字节码 bundle grep 命中 `CategoryInlineBar` / `agent-track-bar` / `ctaFill`)**:① 点顶栏「分类」弹出的那块当时仍是迁移清单外的 `FenLeiOverlay`(已补迁);② 像素直方图实测选中 chip 前景 = 深色 `ctaText` #16262E 而底色仍是容器同色 #1A1A1A —— `ctaFill` 根本没落上,即"选中态看不见";③ idle chip 以 `surface.card` 作底,落在同为 `surface.card` 的弹层面板上完全隐形。已修:idle 底改 `surface.muted` + 描边 `border.medium`(两套主题下与页面 bg / 面板 card 均不同档)。**根因未定**:曾按"Pressable 函数式 style 整条路径未生效"归因并把容器视觉移到普通 View 数组路径(该改动本身无害,少一个变量),但随即被反证 —— 全仓 58 个文件用同款 `style={({pressed}) => [base, active ? activeStyle : null]}`,其中 `SingleTypeBar.tsx:142-143` 与迁移前的 SquareScreen 内联条都是这条路径且真机显示正常;`ctaText`(#16262E)在同一 chip 上生效而 `ctaFill`(#a3c4d6)不生效,也排除了"整套 token 缺失"(dist 陈旧版两者皆无,若走 dist 文字应回落到 #A3A3A3)。待手机回线后先加高对比标记色(如临时 `#FF00FF`)做二分,再定是样式合并路径还是取色问题。待复验(设备 19:5x 起 `adb devices` 为空,kill-server 重连无效,USB 侧仍见 3 个 Composite Device)。 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记逐字相同的另一条登记(与本行正文逐字相同,可按正文检索;现存多处同文副本)(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L10678(L1 外部持有行 L4356):

```
- [ ]（进行中） **守卫票: `scripts/i18n-apply.mjs` 把未知参数当"无参",`--help` 会直接进写盘模式**。本轮实测代价:跑 `node scripts/i18n-apply.mjs --help` 想查用法,结果它拿一份陈旧 `i18n-translations.json` **重排并改写了 en/ja/ko/zh-TW 四份语言包**(各 176–214 行新增 / 35–39 行删除)。四个文件当时是干净的,已按 `git show HEAD:<path>` 逐字节还原 + 复验(parse OK、`git status` 空),零损失。**要求的修法**:① `--help`/`-h` 只打印用法并 exit 0;② 任何未识别参数一律 exit 2 并点名该参数,**不得降级成默认动作**;③ 写盘前若 `--check` 未跑过或输入载荷的 `translatedAt` 早于目标文件 mtime,拒绝写并提示(本次那份载荷就是旧的)。验收:`node scripts/i18n-apply.mjs --help` 必须**不产生任何 git 脏文件**(用 `git status --porcelain -- packages/i18n` 断言),并补一条镜像测试钉死这条负向判据。归属:下一轮派单;在此之前**任何人不要用该脚本试参数**。 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记逐字相同的另一条登记(与本行正文逐字相同,可按正文检索;现存多处同文副本)(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L10679(L1 外部持有行 L15652):

```
- [ ] **C 组刻意没动,待用户定性**:`C:\ai_zhs\cert\*.pem`(5 个,每个仅 10–20 字节,不可能是真 PEM, 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记逐字相同的另一条登记(与本行正文逐字相同,可按正文检索;现存多处同文副本)(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L10680(L1 外部持有行 L4709):

```
- [ ]（进行中）**守门 91 冻结的 9 处待清 + 一项方法论债(2026-09-24)**:① study-publish 整文件主题化(14 处 `getTokens('light')`,8 处在模块级 StyleSheet.create 里,须改成按 scheme 生成的函数或下沉到组件内), 改完后 `node scripts/check-theme-prop-wiring.mjs --update-baseline` 应收窄; ② 7 个他人 M 在制的屏(CourseDetail / Distribution / LiveDetail / ModelPlaza / N8nModel / PostCreate / SharedDemo)待其会话自行接线; ③ `{...props}` 展开类站点被判 spread-unknown(判不出即如实报,不静默放行)—— 要真正覆盖须先给端内 wrapper 的 props 建立类型事实,属独立改造; ④ 方法论债:**本轮两次误判同源** —— 一次是把像素被 `rgba(0,0,0,0.6)` 遮罩压暗 40% 当成"颜色没落上", 一次是用"文本里有没有某个键"统计出"0 处漏传"。两者的共同错误是**用一个不测量目标东西的探针给出肯定结论**。 纪律:凡给出"0 处 / 没有 / 已全清"这类否定性结论,必须先构造一个**已知应被命中的正例**喂给同一判据(阳性对照), 否则该结论不得写进文档或据此决定"不做"。 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记逐字相同的另一条登记(与本行正文逐字相同,可按正文检索;现存多处同文副本)(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L10681(L1 外部持有行 L4700):

```
- [ ] **本轮未落地、需重做的一批(web 86 处内的键名对齐)**:该批次报告改了 4 个文件(`DeveloperKeyDialog` / `AiGenerationContent` / `PermissionSelector` / `helpers`),**逐条按内容复核后全部不在 HEAD**(`git grep <新键名> HEAD -- apps/web` 四处均 0 命中),工作区也已被并发会话覆盖 → 判为**丢失需重做**,不要当成已完成。中途我一度按"工作区里有"记成"已落地",那是读到了被覆盖前的窗口 —— 并行期复核一律以 **HEAD 对象树内容**为准(档案第 4 节已记此教训)。 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记逐字相同的另一条登记(与本行正文逐字相同,可按正文检索;现存多处同文副本)(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L10682(L1 外部持有行 L8009):

```
- [ ] **紧急(他人暂存态,非本会话所为,2026-09-24 11:0x 发现)**:**索引里有 16 条"已暂存的删除"**,一次不带 pathspec 的普通 commit 就会把这些**已入库功能从版本树删掉**。清单含三个成体系功能族 + 一道守门:① D62 语音字幕(`packages/shared/src/chat/voice-subtitles.ts` + web 组件 + 测试)、② D91 批注锚点(`annotation-anchors.ts` 同族)、③ D67 额度归属(`quota-ownership.ts` 同族)、④ **并发会话 cb99ef0c 刚提交的 `apps/mobile-rn/src/theme/color-scheme-sync.ts` 及其测试与 NativeWind mock**(删掉即把"App 主题开关驱动 NativeWind"这次修复整体回退)、⑤ `scripts/check-home-junctions.mjs` + 其镜像测试。**判为误删而非迁移的依据**:索引里的桶文件 `packages/shared/src/chat/index.ts` **与 HEAD 一字未改且仍导出这三模块**(二者矛盾 ⇒ 构建必炸,实测 Metro 就在 `export * from './voice-subtitles'` 处失败),且`git ls-files` 全仓**无替代路径**。**本会话处置边界**:只把 13 个文件(2626 行)的内容**恢复到工作区**让构建可用,**索引一字未动** —— 是否撤销这些暂存删除由制造它们的会话自己决定(§5b:他人已暂存的删除只报数、不代裁)。取证:`git diff --cached --diff-filter=D --name-only`;复跑恢复:`node .ihui-agent/tmp/rn-build/restore-worktree.mjs`。**另注**:`heal-worktree-tracked.mjs --check` 此时报"工作区已跟踪文件存续正常"—— 其判据②要求"索引 blob == HEAD blob",而暂存删除使该条件不成立,故**这类"已暂存的删除"不在存续自愈覆盖面上**,是一道无人看的路;要闭环需在守门侧对 `--diff-filter=D` 的暂存删除单独计数并阻断(未擅自新增守门,留单)。 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记同主键的另一条登记「D62 · **紧急(他人暂存态,非本会话所为,2026-09-24 11:0x 发现)**」(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L10686(L1 外部持有行 L4700):

```
- [ ]（进行中） **本轮未落地、需重做的一批(web 86 处内的键名对齐)**:该批次报告改了 4 个文件(`DeveloperKeyDialog` / `AiGenerationContent` / `PermissionSelector` / `helpers`),**逐条按内容复核后全部不在 HEAD**(`git grep <新键名> HEAD -- apps/web` 四处均 0 命中),工作区也已被并发会话覆盖 → 判为**丢失需重做**,不要当成已完成。中途我一度按"工作区里有"记成"已落地",那是读到了被覆盖前的窗口 —— 并行期复核一律以 **HEAD 对象树内容**为准(档案第 4 节已记此教训)。 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记逐字相同的另一条登记(与本行正文逐字相同,可按正文检索;现存多处同文副本)(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L10687(L1 外部持有行 L4700):

```
- [ ]（进行中） **本轮未落地、需重做的一批(web 86 处内的键名对齐)**:该批次报告改了 4 个文件(`DeveloperKeyDialog` / `AiGenerationContent` / `PermissionSelector` / `helpers`),**逐条按内容复核后全部不在 HEAD**(`git grep <新键名> HEAD -- apps/web` 四处均 0 命中),工作区也已被并发会话覆盖 → 判为**丢失需重做**,不要当成已完成。中途我一度按"工作区里有"记成"已落地",那是读到了被覆盖前的窗口 —— 并行期复核一律以 **HEAD 对象树内容**为准(档案第 4 节已记此教训)。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记逐字相同的另一条登记(与本行正文逐字相同,可按正文检索;现存多处同文副本)(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L10781(L1 外部持有行 L3824):

```
- [ ] 重启宿主/开机后 `%TEMP%` 才会真指 `D:\DevEnv\Temp`;在此之前任何未接 `scratch-dir` 的 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记 (与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L10782(L1 外部持有行 L1473):

```
- [ ] D14 云端沙箱 agent(容器隔离+任务队列+镜像缓存+跨项目并行看板,对标 Qoder My Quests)(G-17) 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记 「D14」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10784(L1 外部持有行 L1473):

```
- [ ] D14 云端沙箱 agent(容器隔离+任务队列+镜像缓存+跨项目并行看板,对标 Qoder My Quests)(G-17) 〔拆票(2026-09-27):本行是**四件事捆成一行**,按 §9 拆成可独立验收的四票 —— ① 容器隔离执行面(受影响面:`apps/ai-service/app/services/` 新增 sandbox 执行器 + `apps/api` 侧任务派发;验收:并发跑两个互不可见的会话,一方写 /tmp 文件另一方读不到,且容器退出后无残留卷);② 任务队列(验收:同一镜像 N 个任务串行度可配、失败可重放一次、队列满时**明确拒绝而不是静默排队**);③ 镜像缓存(验收:第二次同镜像任务启动耗时对比第一次,给出实测秒数,不得只写"已缓存");④ 跨项目并行看板(与 D25 产品化看板同一缺口,不得各做一套)。**今天没做的原因(如实登记,不是"待办")**:本机没有可用的容器运行时(`docker` 不在 PATH,`docker info` 不可达),①③ 在缺运行时的机器上只能写出无法验证的壳 —— 而"能编译的壳"正是本仓反复登记的"造好没装车"那一型。本行保留未勾选,归属=等环境(需一台有容器的机器)。〕 〔【归并】重复登记副本(2026-10-09):同主键的另一条登记 「D14 · 云端沙箱agent」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10786(L1 外部持有行 L1492):

```
- [ ] D18 Agent SDK 对外开放(G-23)。**发布就绪性已上机器闸门(2026-09-24,本票)**:新建 `packages/sdk/tests/publish-ready.test.mjs` 8 用例并接进根 `package.json` 的 `check:sdk-publish` + 串入 `check:all`(否则就是本仓反复记过的"造好没装车")。判据刻意**复用既有权威入口不另造第二套**:`node scripts/check-pkg-installable.mjs packages/sdk` 实测 exit 0(真 npm pack + 解包 8 项),本测试补的是它结构性看不见的那几维 —— 它在本机工作树 pack,永远看不出"根 `LICENSE`/`NOTICE` 未入库 ⇒ CI 干净检出时 prepack 必失败";且完全不读 python/go/java 三份清单。新增钉死的四条:根 LICENSE/NOTICE 必须在 HEAD 且非空、包内 LICENSE/NOTICE **按设计不得入库**(`.gitignore` 显式忽略、由 prepack 从根复制,防法律文本漂移)双向锁死、npm/PyPI/Maven/Go 四通道坐标与 `release-sdk.yml` 里的**回读 URL 字面量**逐一同名、三处 version 全等(一条发布列车)。**.NET 反向守卫**:44 个 `.cs` 至今无 `.csproj`/`.nuspec` 即无发布出口,一旦有人补了工程文件却漏建 `nuget-publish` job 立即判红。**剩余全为人工或对外不可逆动作**(故本条不勾):GitHub secrets(NPM/PYPI/MAVEN)、npm `@ihui` org 与 trusted publisher、PyPI 项目归属、Maven Central groupId 域名验证、打 `sdk-v0.1.0` tag 推 origin(唯一触发器)、NuGet 通道整条待建、homebrew sha256 回填需真实 release 资产。⚠️ 顺带纠一处**票面前提已过时**:本票开头引用的 O14"api-client 仍 `private: true`"在同日 16:1x 已被别的会话完成(去 private + exports/files/publishConfig 齐、403 文件 junk=0),照旧文派单会重复劳动 —— 本票据此**没有**动 `packages/api-client`。 〔【归并】重复登记副本(2026-10-09):同主键的另一条登记 「D18 · AgentSDK对外开放」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10787(L1 外部持有行 L9982):

```
- [ ] **D35 长会话分页投影与增量回放(G-59)**:对标 Codex `thread_history_projection_state{next_rollout_byte_offset,next_rollout_ordinal}` + `idx_thread_items_by_turn_updated_page`。会话消息按 turn 分片拉取 + metadata 九类只回"摘要 + 展开时懒取全文"。**验收**:5000 消息会话首屏 ≤800ms(Playwright 计时断言,阈值入 e2e)+ 上翻不重复不丢帧 + 懒取失败降级为占位不白屏 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记 「D35」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10788(L1 外部持有行 L1538):

```
- [ ] **D43 会话内快捷笔记(G-51)**:录音 12 phase 状态机 + 转写 + 归档/分组/搜索,笔记可一键插入对话。复用 `voice-input/voice-record`,不新建录音栈。**验收**:phase 矩阵用例(权限拒绝/中断/最终化失败)+ 笔记→上下文引用闭环 + miniapp 端豁免标注(平台独占:录音 API 差异) 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记 「D43」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10789(L1 外部持有行 L1550):

```
- [ ] **D50 多端遥控配对 + 每会话浏览器 Tab 状态(G-60)+ WorkBuddy 取证专项**:① 手机看/接管桌面在跑会话(对标 `remote_control_enrollments`);② 每会话浏览器 tab 路由状态持久化(对标 `thread-tab-routes-v1`,复用 work-panel 历史连贯根治成果);③ **WorkBuddy 元素级取证补齐**(本机四路探测确认无程序本体):在装有 WorkBuddy 的机器上取包体或跑一次渲染取证,把报告 §1.4 的 E4 二手升为 E1/E2,再回补差距编号 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记 「D50」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10790(L1 外部持有行 L1764):

```
- [ ] **D77 对话流业务表单卡(G-106)**:在消息流内完成业务动作的可填表单——邮件撰写卡(收件人/抄送/密送/主题/回复至/正文 + **批准操作/拒绝操作**成对动作)、日历创建/更新卡(创建/保存 + 时间区间与多出席人折叠)。数据面需新事件 `form_request`{kind,fields[],actions[]} 与 `form_response`(进 D34 契约双份);渲染走 `question-dialog` 同族弹层还是内联卡由方案定,但**必须复用 `packages/ui-react` 表单件**(共享层优先,禁止端内自绘)。端覆盖按 §9 矩阵执行,miniapp/mobile-rn 若需豁免必须显式写理由。**验收**:两表单端到端(填→批准→后端落→状态回显)+ 拒绝路径不产生副作用 + 五语言词表 〔【归并】重复登记副本(2026-09-26):同主键的另一条登记 「D77」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10794(L1 外部持有行 L2004):

```
- [ ] 82. Predictive Edit(对标 Trae CUE 的独立编辑意图预测器,现有 FIM 链路上升级) 进度(2026-09-27,不翻勾):服务端三态与结构化动作入库(50 例、mypy strict 干净、失败态两两可分辨)。未闭环:前端零调用方(交接的最小 diff 与四个 i18n 键在报告里,**必须两把钥匙不然又把三态折回去**)、接受率看板需给 metrics 加 scene 字段、真模型取证未跑、判据缺重叠区间与锚点内容比对两格、README 能力清单待补。 〔【归并】重复登记副本(2026-10-09):同主键的另一条登记 「82 · PredictiveEdit」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10799(L1 外部持有行 L7953):

```
- [ ] 72. `apps/desktop` 从薄壳到本地能力端点(本地 workspace 通道 + 增量索引 + 本地 git/diff + 离线降级;**保留前端单一事实源在 web,不复制 UI**) 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记 「72 · apps/desktop从薄壳到本地能力端点」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10800(L1 外部持有行 L15774):

```
- [ ] 计划任务 `IHUI-C-Drive-AutoMaintain` 仍未注册(注册 = 影响全机的删除动作,须用户授权); 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记 (与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L10801(L1 外部持有行 L15775):

```
- [ ] 另有 7 个脚本的 `--self-test` 仍走 `os.tmpdir()`(`check-workspace-dep-links` / 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记 (与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L10808(L1 外部持有行 L8018):

```
- [ ] 47. 三套执行内核工具集归一(A/B/C → 唯一工具注册表 `mcp_server._TOOLS`;AgentEngine 15 个工具映射或移植;JSON-RPC 只留协议适配层;CI parity 断言 `BUILTIN_ENGINE_TOOLS` ⊆ `_TOOLS` 映射完整) 〔PROGRESS 2026-09-27(五路并行第一波,ab4fed16d 前一枚):已落 J11/J14 两面 + 引擎内置名经 `resolve_engine_tool` 归口(归口在 `_ADMIN_ONLY_TOOLS` 判定之前,否则 unified_exec 这类名字会绕过角色矩阵)。实测 `BUILTIN_ENGINE_TOOLS` 是 **14 枚不是票面的 15**。**未闭环**:第三格「JSON-RPC 只留协议适配层」未做 —— agent_engine 的 RPC 面仍自带工具定义。票保持未勾。〕 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记 「47 · 三套执行内核工具集归一」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10809(L2 族内归并,保留 L10792):

```
- [ ]82. Predictive Edit(对标 Trae CUE 的独立编辑意图预测器,现有 FIM 链路上升级) 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记 「82 · PredictiveEdit」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10810(L1 外部持有行 L7599):

```
- [ ] **O87g 守门 8 的"前缀假设"确实是本票假绿的成因,但不能直接换成精确挂载图(先决:先扩提取式)**:`scripts/check-api-routes.mjs` 的 `buildCompositePrefixes` 把**任一 localPath × 任一绝对前缀**笛卡尔拼接(其注释自述:把 `/api` 与 `/api/admin` 当根去拼 relative prefix),于是 `routes/ranking.ts` 挂在 `/api/ranking` 下的 `server.get('/courses')` 会组合出一条结构上不存在的 `/api/courses` —— 本票那条死调用它报的正是「新增 0 处死调用」。**但把判据换成精确挂载图更糟**:现测 2675 处前端调用里 **2092 处会"消失"**,因为 `registerCrud(server, '/x', …)`(`admin/_shared.ts`、promotions.ts 那族)与模板前缀子树这些注册形态,`scripts/lib/outbound-route-registrations.mjs` 的提取式读不到 —— 那是一把漏读两千的尺子,接进提交链等于造一台与任何提交都无关的恒红门(§12e 同型,也是本仓记过最多次的那一型)。解阻顺序不得跳:① 先把路由提取式扩到 helper 注册形态(按其实参表名解析)并证明"精确集 ⊇ 现有真值";② 再谈把 composite 换成精确集,且必须保留不透明前缀的「未判定」出口;③ 全量报告**报数必须报名**,否则拿到数字的人不知道哪条是盲区。归属:守门 8 持有人。取证:`node scripts/check-api-routes.mjs` HEAD 面现读 5140 路由 × 162 组合前缀;两侧包差异可用 `--dump-backend` 复量。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「O87g」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10812(L1 外部持有行 L7947):

```
- [ ] 85. 离线/边缘优先降级(依赖 72;本地向量索引 + `ollama`/`lmstudio`/`llama_cpp` 三路 provider 已在适配表里) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「85 · 离线/边缘优先降级」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10813(L1 外部持有行 L15777):

```
- [ ] 86. 证据级可追溯执行流水(每次工具调用带 invocation id + 输入/输出哈希 + 权限决策 + 操作者身份,导出签名 ledger) 〔2026-09-27 用户拍板:**做,落库并可导出**;前置一格是保留策略(谁能动、留多久),该项按 §24 需单独确认,故本票第一步是出表设计与保留方案而非写迁移〕 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「86 · 证据级可追溯执行流水」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10814(L1 外部持有行 L15777):

```
- [ ] 86. 证据级可追溯执行流水(每次工具调用带 invocation id + 输入/输出哈希 + 权限决策 + 操作者身份,导出签名 ledger) 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记 「86 · 证据级可追溯执行流水」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10815(L1 外部持有行 L7944):

```
- [ ] 64. AI 消息可编辑 + 消息级 pin/书签(共用 59 的 sibling 存储) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「64 · AI消息可编辑+消息级pin/书签」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10816(L1 外部持有行 L7939):

```
- [ ] 60. 真并行多窗格(store 从 `conversationId` 单例改为 `Map<paneId, State>`;独立 SSE/abort;服务端 fork 路由下放) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「60 · 真并行多窗格」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10817(L1 外部持有行 L7940):

```
- [ ] 71. chat 多端/多标签实时同步(**V2 #23 未交付,本轮重列**;先定 SSE 与 WS 双通道的「同一消息 patch 幂等」契约) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「71 · chat多端/多标签实时同步」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10818(L1 外部持有行 L7953):

```
- [ ] 72. `apps/desktop` 从薄壳到本地能力端点(本地 workspace 通道 + 增量索引 + 本地 git/diff + 离线降级;**保留前端单一事实源在 web,不复制 UI**) 进度(2026-09-27,不翻勾;第一路 J 撞轮限且零产出,第二路 J2 先落盘后交付):宿主侧本地 git 通道已完成 —— `src-tauri/src/git_status_core.rs`(纯函数 `-z` 解析 + 逐级包含性校验,非 UTF-8 路径判「判不了」而非 lossy)、`git_local_status.rs`(`EngineOutcome` 三态 Facts/CommandFailed/Undetermined,九小类致盲;空输出=无改动 与 解析失败=判不了 分家;前端永不可自报 root,须经 `git_authorize_workspace` 双重证明 + 登记表为空一律拒)、`git_channel_ipc.rs` 三条 command、`lib.rs` 注册。测试真跑:`rustc --test` **29 passed**(另 `--ignored` 2 passed 含真机冒烟与「挂起必报 TimedOut 且已强杀」),`cargo check` exit 0(单次预算已用完)。**未做四类**:① 前端消费面一行未写(未碰 apps/web,需 `invoke('git_workspace_status')` 那条 hook);② 离线降级/增量索引/diff 文本通道未做(本票只到工作区状态清单);③ `git_authorize_workspace` 现走完整 status,>5000 变更条目的仓库会被判 Budget 而永不能授权(改直调 `verify_root` 即收口,需第二次 cargo check);④ 符号链接/junction 逃逸一维未收口。J2 另如实登记一处覆盖面不确定:`cargo check` 究竟覆盖了 `verify_root` 重构前还是后的字节不可断定。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「72 · apps/desktop从薄壳到本地能力端点」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10819(L1 外部持有行 L7942):

```
- [ ] 77. Goal-driven 自评估闭环 + My Quests 跨 workspace 全局看板(依赖 51) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「77 · Goal-driven自评估闭环+MyQuest」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10820(L1 外部持有行 L7943):

```
- [ ] 78. Experts 多智能体并行子模式(专家模板产品化 + 同文件写冲突治理:串行化或 worktree 隔离) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「78 · Experts多智能体并行子模式」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10821(L1 外部持有行 L8018):

```
- [ ] 47. 三套执行内核工具集归一(A/B/C → 唯一工具注册表 `mcp_server._TOOLS`;AgentEngine 15 个工具映射或移植;JSON-RPC 只留协议适配层;CI parity 断言 `BUILTIN_ENGINE_TOOLS` ⊆ `_TOOLS` 映射完整) 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记 「47 · 三套执行内核工具集归一」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10822(L1 外部持有行 L8018):

```
- [ ]47. 三套执行内核工具集归一(A/B/C → 唯一工具注册表 `mcp_server._TOOLS`;AgentEngine 15 个工具映射或移植;JSON-RPC 只留协议适配层;CI parity 断言 `BUILTIN_ENGINE_TOOLS` ⊆ `_TOOLS` 映射完整) 〔PROGRESS 2026-09-27(五路并行第一波,ab4fed16d 前一枚):已落 J11/J14 两面 + 引擎内置名经 `resolve_engine_tool` 归口(归口在 `_ADMIN_ONLY_TOOLS` 判定之前,否则 unified_exec 这类名字会绕过角色矩阵)。实测 `BUILTIN_ENGINE_TOOLS` 是 **14 枚不是票面的 15**。**未闭环**:第三格「JSON-RPC 只留协议适配层」未做 —— agent_engine 的 RPC 面仍自带工具定义。票保持未勾。〕 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「47 · 三套执行内核工具集归一」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10823(L1 外部持有行 L8019):

```
- [ ] **守门 134 的两格条件性扩面（各自写了可判触发条件,未达即不做,未认领）**：① B2 那一跳接裸 SQL 维 —— 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「B2 · 守门134的两格条件性扩面」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10825(L1 外部持有行 L15577):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7673(G-349) 同题,派单以持有行为准,本行不再单独派单。〕 **G-316. 门 8 清账后遗留的三枚"有消费方的待实装路由"(2026-09-28 登记,现读=基线仅剩 3 处)**:① `GET /api/subagents/all` —— 消费者 `apps/web/app/(main)/agent-teams/page.tsx:58`(期望 `{dispatches}` 含 completed/failed/cancelled 全量);后端只有 `/subagents/active`(仅 pending/running,形状恰好相同但语义是子集,**不得**为省事把客户端改道 active —— 那会把"页面少了历史"写成"已修")。正解 = 在 `subagent-dispatch.ts` 补 all 列表路由(带 status/limit 透传)。②③ `PUT /api/ai/n8n/workflows/:id` 与 `POST .../toggle` —— 消费者 `apps/mobile-rn/src/screens/N8nModelScreen.tsx:146/192`(保存改名/启停今天必 404);后端 n8n 面只有列表透传与创建转发(miniapp-compat-routes.ts:1123/1190),n8n REST API 本身支持 workflows/:id 更新与 activate/deactivate,正解 = 在 n8n 代理补两枚透传(SSRF 校验与 env 缺省回 stub 的既有纪律照抄)。验收判据:两枚消费者页面真机/真会话各跑一次成功路径 + 基线 `scripts/api-routes-baseline.json` 清零 + 门 8 末行现读 0。**归属**:subagent 面 = agent-teams 线;n8n 两面 = n8n 代理持有人(本票只登记形状与消费者证据,不代裁实现位置)。 〔落地@2026-09-28/枚 2704c4d27〕三枚路由已入库:subagents/all(新→旧+status/limit)、/ai/n8n/workflows 面四枚(list stub/写 503/fetch-merge-put/toggle 回读真值);apps/api/tests/g299-new-routes.test.ts 4 例绿、门 8 死调用清零、基线 perFileCount 清表。**本票未翻勾的唯一理由=验收判据第一条未跑**:RN N8nModelScreen 真机走查(本机无设备)与 agent-teams 页真会话 200 取证(需起栈)——路由与契约已证,运行时成功路径待验,不得以单测冒充真机。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-316 · 门8清账后遗留的三枚"有消费方的待实装路由"」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10826(L1 外部持有行 L15778):

```
- [ ] **O88. 台账孪生副本:两型已收口、一型待裁(2026-09-28 两次现读归正,归台账持有人)**:**已收口的两型** —— ① 行号指针维:F3 原先只认「存活于 L<行号>」一种措辞而该族 HEAD 面现读 0 条,归并器自己产的「同主键/逐字相同的另一条登记在 L<行号>」222 处全隐身(47 处指到别的话题 / 160 处目标行根本不是条目行 / 15 处落空),账面 F3=0 而 §1 明令禁止的证据形态满账;现改为**族表**判据 + 与之同集的修复出口(镜像 T11 钉"判得到必须修得了"),并收紧到"禁写行号"本身(指得准的行号指针也判红),现读面上行号指针 **0 处**。② 到期租约维:门 109 的 2 条 CL1 已按 §1 出路清账(有同题已完成登记的那条翻勾并摘牌;正文自述"刻意不当场执行"的那条不翻勾,改写成待认领并写明认领姿势)—— 该门是 `stagedTriggers=PROJECT_PLAN.md` 的 blocking 门,红着等于每次提交计划文档都被逼跳门(§12e)。**仍待裁的一型** —— ③ `--twins` 现读 **102 条**"已闭环登记的未勾孪生",其中靠**相似度**(0.63–0.95)或**包含**配上的约 93 条,按 §1「相似度只配报数,不配判红」一条都不能自动动;逐条分类已出(77 判同一句被复制、3 判不出、0 判成不同事),可自动子集仅 10 行,而那份分类的关键词筛在 35/80 行**漏判**未完成语义(反向 0 漏判)⇒ 这 10 行也不自动落,报告落在 `.ihui-agent/tmp/twin-adjudication/report.md`(临时区,不入库,需要就重跑)。**它在等什么**:等持有人按报告逐条裁"该记完成还是仍开" —— 自动挂"重复登记副本"指针会把真任务从派单口径里静默摘掉,那比账面重复更贵。取证一律现读:`node scripts/check-task-claims.mjs --twins`、`node scripts/plan-tasks.mjs --gate`(F3/F4/F4b/F6 四行)、`node scripts/plan-tasks-merge.mjs`。 **2026-09-28 再归正**:上面③那句"三面全不判"已被并发的另一路会话补上 —— 现读 `node scripts/plan-tasks.mjs --gate` 有 **F10 已完成行的逐字孪生(done 侧)224 组 / 多余副本 339 行**,默认档只报数、差值棘轮只拦新增,逐组出口 `node scripts/plan-tasks-merge.mjs --dedupe-done-twins`,**升 blocking 的前置是存量清零**(§12e)。所以本行剩下的真待裁只余"相似度孪生"那一族。 〔【归并】重复登记副本(2026-09-28):本行与同一件事的另一条登记同题,该登记的标题原文为「O88. 台账孪生副本的其余三型无人覆盖(2026-09-28 现读,归台账持有人)」;上面那条再归正已同步搬进那一条 ⇒ 其行内含本行全部结论,派单以那条为准,本行不再单独派单。〕 —— **2026-09-28 本副本同步撤回**:上面"再归正"那句里的 F10 维与 `--dedupe-done-twins` 出口都不在 HEAD(现读 done 侧 85 组,出口从未实现,未知旗标 exit 2),现行判定见同编号「其余三型无人覆盖」那条的第五条更正,勿照本行的 F10 措辞派单。
```

- 原 L10827(L1 外部持有行 L8024):

```
- [ ] **O88. 台账孪生副本的其余三型无人覆盖(2026-09-28 现读,归台账持有人)**:① `--twins` 报 73 条"已闭环登记的未勾孪生",其中只有 22 条**正文逐字等值**算可证,本轮翻勾 4 条、余 18 条正文自带「仍未注册 / 刻意没动待用户定性 / 本票不认领」措辞**不得自动翻勾**(把没做的记成做过的比原病更响),要逐条人工裁;② 另 51 条只靠相似度(0.63 至 0.95)配对,AGENTS §1 明文"相似度只能报数,不配判红",现无判据可落;③ **已完成行自身**的逐字孪生 191 组 / 448 行(可省 257 行)结构上没人管 —— F4b 只比未勾行、F6 要求连续 ≥3 行重复块、归档器只搬三级标题粒度条目(bullet 级 1784 行按设计"不搬也不护")。**它在等什么**:等持有人定"逐字孪生"的收口形态(翻勾注记 / 归档搬走 / 原样保留),不是等环境条件,也不是等某个技术参数。取证一律现读:`node scripts/check-task-claims.mjs --twins`、`node scripts/plan-tasks-merge.mjs`、`node scripts/plan-tasks-merge.mjs --dedupe-blocks`。 —— **2026-09-28 现读归正(前两条已收口)**:行号指针维由 F3 族表+同集修复出口收口(旧判据只认「存活于 L<行号>」而该族现读 0 条,归并器自产的「另一条登记在 L<行号>」222 处全隐身;现收紧到禁写行号本身,面上行号指针 0 处),到期租约维由门 109 的两条 CL1 按 §1 出路清账,门 109 现读 0 红。**仍待裁的一型**:③ ① 行号指针维:F3 原先只认「存活于 L<行号>」一种措辞而该族 HEAD 面现读 0 条,归并器自己产的「同主键/逐字相同的另一条登记在 L<行号>」222 处全隐身(47 处指到别的话题 / 160 处目标行根本不是条目行 / 15 处落空),账面 F3=0 而 §1 明令禁止的证据形态满账;现改为**族表**判据 + 与之同集的修复出口(镜像 T11 钉"判得到必须修得了"),并收紧到"禁写行号"本身(指得准的行号指针也判红),现读面上行号指针 **0 处**。② 到期租约维:门 109 的 2 条 CL1 已按 §1 出路清账(有同题已完成登记的那条翻勾并摘牌;正文自述"刻意不当场执行"的那条不翻勾,改写成待认领并写明认领姿势)—— 该门是 `stagedTriggers=PROJECT_PLAN.md` 的 blocking 门,红着等于每次提交计划文档都被逼跳门(§12e)。**仍待裁的一型** —— ③ `--twins` 现读 **102 条**"已闭环登记的未勾孪生",其中靠**相似度**(0.63–0.95)或**包含**配上的约 93 条,按 §1「相似度只配报数,不配判红」一条都不能自动动;逐条分类已出(77 判同一句被复制、3 判不出、0 判成不同事),可自动子集仅 10 行,而那份分类的关键词筛在 35/80 行**漏判**未完成语义(反向 0 漏判)⇒ 这 10 行也不自动落,报告落在 `.ihui-agent/tmp/twin-adjudication/report.md`(临时区,不入库,需要就重跑)。**它在等什么**:等持有人按报告逐条裁"该记完成还是仍开" —— 自动挂"重复登记副本"指针会把真任务从派单口径里静默摘掉,那比账面重复更贵。取证一律现读:`node scripts/check-task-claims.mjs --twins`、`node scripts/plan-tasks.mjs --gate`(F3/F4/F4b/F6 四行)、`node scripts/plan-tasks-merge.mjs`。 **2026-09-28 再归正(第三条)**:上面③那句"三面全不判"已被并发的另一路会话补上 —— 现读 `node scripts/plan-tasks.mjs --gate` 有 **F10 已完成行的逐字孪生(done 侧)224 组 / 多余副本 339 行**,默认档只报数、差值棘轮只拦新增,逐组出口 `node scripts/plan-tasks-merge.mjs --dedupe-done-twins`,**升 blocking 的前置是存量清零**(§12e)。所以本行剩下的真待裁只余"相似度孪生"那一族。 **2026-09-28 再归正(第四条:判据第三次落后于产出形态)**:面上仍有 2 处行号指针写作「…的完成登记在 L13178」「…入库登记在 L8584」这类拼法,而 F3 的 dup 族要求前缀恰为「(同主键|逐字相同)的另一条登记在」—— 这两串既没有"的"也没有"另一条" ⇒ 判据再次看不见自己产出的形态,现读 F3 仍报 0 处。一行修法已备好待该文件持有人落:把 dup 族前缀改成可选 `(?:同主键|逐字相同)?(?:的另一条|的权威|的)登记在\s*L(\d{1,6})`,并配一条活体对照(数面上 `(存活于|登记在)\s*L\d` 的出现次数,判据报 0 而它非 0 ⇒ 判"族表落后"而不是通过)。本会话试过改这一行,但 `scripts/lib/plan-task-index.mjs` 此刻被并发会话持有(工作树 83 增/12 删在飞,含 F10 与 FORK_POINTER_RE 两条新判据),继续改等于替他们把半成品提交进去 ⇒ 已逐字还原,只把修法与取证交回本行。 —— **2026-09-28 第五条更正(撤回第三条里的三处不实;数字一律当次现读)**:① 上一条写的"现读 `plan-tasks.mjs --gate` 有 F10 已完成行的逐字孪生(done 侧)224 组 / 多余副本 339 行,默认档只报数、差值棘轮只拦新增,逐组出口 `plan-tasks-merge.mjs --dedupe-done-twins`"**三处都不成立**:HEAD 面上没有叫 F10 的维(该行维度在 `--gate` 里印作「同态重复(done 侧只报数)」,JSON 键 `dupDoneGroups`),`--dedupe-done-twins` 这条出口**从未实现**(现跑被"未识别的参数"拒掉并 exit 2 —— 那个拒参数守卫是另一路会话为同一件事补的,现读 `git grep -c "dedupe-done-twins" HEAD -- scripts` 只在注释与测试里命中,且它们写的正是"一个从未实现过的出口"),而 224/339 是**并发会话未提交的工作树判据**跑出来的读数,不是被审面读数。② 当次现读(HEAD blob 面,`node scripts/plan-tasks.mjs --gate`):done 侧 85 组;F3 行号指针 8 处(可自动收口 0、无出口交人工 8)。③ 所以这一族的真状态是**待补出口**,不是"出口已在":已完成行的逐字孪生目前没有任何机器出口,而 §1 禁止无声删除 ⇒ 出路只能是"每小节各留一份、其余改写为归并指针"(算法未实现;全局留 1 份会把跨小节单元里该节的唯一登记抹掉,信息仍在别处而按章节读账的人看不见)。④ 同一条通道解除上一条:dup 族前缀已放宽为含 `(?:完成)?`(现读 `scripts/lib/plan-task-index.mjs` 的 POINTER_FAMILIES 第二族),故"…的完成登记在 L…"「…入库登记在 L…」两型已被判到,面上行号指针余 8 处且全部无自动出口(目标行已不是条目行,作者原指哪一条不可推断 ⇒ 不许编锚点)。⑤ 规矩(本行是活的反例,写给后来人照抄):**登记"现读"之前必须确认读的是被审面** —— 判据脚本自己在飞(工作树 dirty)时它产出的数字属于别人未提交的版本,把它写进 HEAD 就是一句谁也复核不了的假陈述;核验姿势 = 先 `git status --porcelain -- scripts/<该判据>` 为空,或直接 `git grep -c "<新维名或新旗标>" HEAD -- scripts` 问 HEAD 本身。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「O88 · 台账孪生副本的其余三型无人覆盖」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10828(L1 外部持有行 L7654):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7745(G-681) 同题,派单以持有行为准,本行不再单独派单。〕 **G-333. 行号指针在活文档 union 后回到 211 处(其中 205 处无自动出口)+ 同主键两态 20 组复活(2026-09-28 现读,归各行持有人;判据没有坏)**:现读(`node scripts/plan-tasks.mjs --gate`,判定面 HEAD blob)**F3 行号指针 211 处 = 可自动收口 6 / 无出口交人工 205**,而本会话上一枚计划文档提交前这一维是 **8 处**;同一次合并还带回 **F1 同主键两态并存 20 组 / 涉及未勾选行 28**。**成因不是判据变尖,是载体换了一批行**:合并 `6226d6449` 的活文档档走"两侧行 union",把对侧新登记的一整批「…登记在 L####」式证据指针原样并进来 —— §1 明文「证据指针禁止写行号,行号在任何一次 append 后都会挪位」,所以**唯一出路是把这些行改成内容锚点(编号 + 标题原文),不是把 F3 族表放宽去迁就它们**(放宽 = 替人做出"这一族已合规"的判断,与本仓"判据必须覆盖门自己产出的形态"相反)。**为什么这不是一台恒红门**:提交链跑的是差值棘轮(`--staged --gate` 只拦"本次让分叉变多"),全量档只点名,所以下一个人正常提交不会为别人欠的账跳门(§12e);要问责存量跑 `--gate --strict`(现读即红,那是它拒绝出合格证,不是仓库故障)。**逐条出路(不得整批改)**:① 6 处可自动收口的由 `node scripts/plan-tasks-merge.mjs --heal --commit` 收(它只动 `autoFixable` 的行 —— 即"目标行仍是同复合主键的条目行"那一格);② 205 处无出口的**只能由该行持有人改写**:取清单 `node scripts/plan-tasks.mjs --pointers`,模板就用归并器自己产出的措辞(`同主键的另一条登记「编号 · 标题」`),因为 F3 认它、而写行号不认;③ 20 组 F1 复活行**本轮不要再清** —— 上游生产者已由 `8fa037255` 那行登记(自动归档器按磁盘底稿整文件写回),生产侧没修之前清完就会被下一次 union 带回,白烧提交与门禁链。**归属分层**:G- 号这条判据与两个出口由台账工具线持有;205 处指针文本归各行持有人;生产者侧(归档器取材面)归 `8fa037255` 那行的持有人。**它在等什么**:等各行持有人按 ② 改写,不等环境条件、也不等技术参数。**核验本行是否解除**:`--gate` 现读 F3 的"无出口交人工"归零且 F1 为 0 组。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-333 · 行号指针在活文档union后回到211处」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10829(L1 外部持有行 L15779):

```
- [ ] 4. 观察期:**首个 GREEN run 达成(2026-09-14,ac4acf3f:577 passed / 0 failed / 4 flaky / 66 skipped 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕〔sha无从找回:ac4acf3f=首个GREEN run(2026-09-14,577 passed)旧史提交,单根02b2d353ad之前,结构上无从找回〕
```

- 原 L10830(L1 外部持有行 L8018):

```
- [ ]47. 三套执行内核工具集归一(A/B/C → 唯一工具注册表 `mcp_server._TOOLS`;AgentEngine 15 个工具映射或移植;JSON-RPC 只留协议适配层;CI parity 断言 `BUILTIN_ENGINE_TOOLS` ⊆ `_TOOLS` 映射完整) 〔PROGRESS 2026-09-27(五路并行第一波,ab4fed16d 前一枚):已落 J11/J14 两面 + 引擎内置名经 `resolve_engine_tool` 归口(归口在 `_ADMIN_ONLY_TOOLS` 判定之前,否则 unified_exec 这类名字会绕过角色矩阵)。实测 `BUILTIN_ENGINE_TOOLS` 是 **14 枚不是票面的 15**。**未闭环**:第三格「JSON-RPC 只留协议适配层」未做 —— agent_engine 的 RPC 面仍自带工具定义。票保持未勾。〕 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记 「47 · 三套执行内核工具集归一」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10831(L1 外部持有行 L11159):

```
- [ ]**台账"两层自愈互咬"的机制票 G-307 交了半成品:熔断行级判据在盘、端到端那一例红**(归本会话,不甩给别人)—— 代理把判据与出口写到位(`F10` done 侧逐字孪生 224 组 / 多余副本 339 行、`--dedupe-done-twins` 只删第 2..N 份逐字相同副本、归并器截断行为改为整行保留),四份文件语法全过、两把工具自检 85/0 与 52/0 全绿,但在补镜像用例时撞到轮次上限死在半途:`node --test scripts/tests/plan-tasks.test.mjs scripts/tests/plan-tasks-merge.test.mjs scripts/tests/plan-task-index.test.mjs scripts/tests/check-plan-line-loss.test.mjs` 现读 **62 例里 1 红** —— `T19 端到端:熔断现场不得建提交,退出码必须仍是 0 并点名 marker` 失败,实测输出是「✅ 自愈落地 …归并 1 行 → 落地面现读 F1 0…」,即**熔断在真链路上没触发**,而测试期望它触发。**半成品没有丢**:五份文件逐字存于 `.ihui-agent/tmp/g307-partial/`,而工作树那几份已按 `git cat-file blob HEAD:<path>` 逐路径贴回 HEAD 形态(贴回后四份镜像测试 32/32 RC=0)—— 台账工具是**活执行体**(post-commit 每轮都跑它),留一份判据半途的副本在盘上,下一次别人的自动档就会把它当成品落地。**接手判据**:① 先证熔断可达(造一个"同一主键连续两轮被回捞"的现场,量它第三轮真的不再建提交);② 端到端那条必须**同时**断言"未建提交 ∧ 退出码 0 ∧ 点名 marker",三态不并桶;③ `--dedupe-done-twins` 的零损失断言必须双向(不删 ∧ 不重复)且默认档只出报告,显式 `--commit` 才落盘 —— 删活文档的行是本仓最危险的动作,绝不进自动档。 【更正 2026-09-28 晚】本行内那句"新落 F10 / 出口 `plan-tasks-merge.mjs --dedupe-done-twins`"是**假账**:现读 `git show HEAD:scripts/plan-tasks.mjs | grep -c F10` = 0、`git show HEAD:scripts/plan-tasks-merge.mjs | grep -c dedupe-done-twins` = **1 且唯一那一处正是枚 `e12e9c142` 里把这条幻影命令当立项凭据写下的注释** ⇒ 该维与该出口从未实现,不得当成已有能力引用(现存的是另一维:同态重复 done 侧按复合主键、只报数)。**假账之所以写得出来,根因在工具**:归并器旧形态对不认识的旗标静默忽略,跑那条从未存在的命令会落进默认报告档并打出「✅ 零损失对账通过…派单口径 403 → 403」,读起来像那个操作真跑了 —— 该缺陷已收口(枚 `e12e9c142`:未识别 token ⇒ exit 2 并原样点名,位置参数只接受 `--write-to` 的值与一枚日期;镜像 A1 纯函数三态 / A2 端到端 rc=2 且拒绝那一趟绝不打出通过档口;T11 那条红属他人在飞的 `plan-task-index.mjs`,与本行无关)。F10 与其归并出口**仍是一件待做的事**,判据与反证在 G-307 那条半成品行里。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-307 · 台账"两层自愈互咬"的机制票G-307交了半成品」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10833(L1 外部持有行 L1473):

```
- [ ] D14 云端沙箱 agent(容器隔离+任务队列+镜像缓存+跨项目并行看板,对标 Qoder My Quests)(G-17) 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记已随归档搬至 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-08.md 的条目 「D14 · 云端沙箱agent」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10834(L2 族内归并,保留 L10785):

```
- [ ] D18 Agent SDK 对外开放(G-23) 〔【归并】重复登记副本(2026-09-26):同主键的另一条登记已随归档搬至 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-08.md 的条目 「D18 · AgentSDK对外开放」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10835(L1 外部持有行 L1764):

```
- [ ] **D77 对话流业务表单卡(G-106)**:在消息流内完成业务动作的可填表单——邮件撰写卡(收件人/抄送/密送/主题/回复至/正文 + **批准操作/拒绝操作**成对动作)、日历创建/更新卡(创建/保存 + 时间区间与多出席人折叠)。数据面需新事件 `form_request`{kind,fields[],actions[]} 与 `form_response`(进 D34 契约双份);渲染走 `question-dialog` 同族弹层还是内联卡由方案定,但**必须复用 `packages/ui-react` 表单件**(共享层优先,禁止端内自绘)。端覆盖按 §9 矩阵执行,miniapp/mobile-rn 若需豁免必须显式写理由。**验收**:两表单端到端(填→批准→后端落→状态回显)+ 拒绝路径不产生副作用 + 五语言词表 〔【归并】重复登记副本(2026-09-26):同主键的另一条登记已随归档搬至 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-08.md 的条目 「D77 · 对话流业务表单卡」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10837(L1 外部持有行 L15775):

```
- [ ] 另有 7 个脚本的 `--self-test` 仍走 `os.tmpdir()`(`check-workspace-dep-links` / 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L10839(L1 外部持有行 L7953):

```
- [ ] 72. `apps/desktop` 从薄壳到本地能力端点(本地 workspace 通道 + 增量索引 + 本地 git/diff + 离线降级;**保留前端单一事实源在 web,不复制 UI**) 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记已随归档搬至 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-08.md 的条目 「72 · apps/desktop从薄壳到本地能力端点」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10840(L1 外部持有行 L15775):

```
- [ ] 另有 7 个脚本的 `--self-test` 仍走 `os.tmpdir()`(`check-workspace-dep-links` / 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记逐字相同的另一条登记(与本行正文逐字相同,可按正文检索;现存多处同文副本)(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L10841(L1 外部持有行 L15774):

```
- [ ] 计划任务 `IHUI-C-Drive-AutoMaintain` 仍未注册(注册 = 影响全机的删除动作,须用户授权); 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记逐字相同的另一条登记(与本行正文逐字相同,可按正文检索;现存多处同文副本)(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L10843(L1 外部持有行 L1473):

```
- [ ] D14 云端沙箱 agent(容器隔离+任务队列+镜像缓存+跨项目并行看板,对标 Qoder My Quests)(G-17) 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「D14」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10844(L1 外部持有行 L9982):

```
- [ ] **D35 长会话分页投影与增量回放(G-59)**:对标 Codex `thread_history_projection_state{next_rollout_byte_offset,next_rollout_ordinal}` + `idx_thread_items_by_turn_updated_page`。会话消息按 turn 分片拉取 + metadata 九类只回"摘要 + 展开时懒取全文"。**验收**:5000 消息会话首屏 ≤800ms(Playwright 计时断言,阈值入 e2e)+ 上翻不重复不丢帧 + 懒取失败降级为占位不白屏 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「D35」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10845(L1 外部持有行 L1538):

```
- [ ] **D43 会话内快捷笔记(G-51)**:录音 12 phase 状态机 + 转写 + 归档/分组/搜索,笔记可一键插入对话。复用 `voice-input/voice-record`,不新建录音栈。**验收**:phase 矩阵用例(权限拒绝/中断/最终化失败)+ 笔记→上下文引用闭环 + miniapp 端豁免标注(平台独占:录音 API 差异) 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「D43」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10846(L1 外部持有行 L1550):

```
- [ ] **D50 多端遥控配对 + 每会话浏览器 Tab 状态(G-60)+ WorkBuddy 取证专项**:① 手机看/接管桌面在跑会话(对标 `remote_control_enrollments`);② 每会话浏览器 tab 路由状态持久化(对标 `thread-tab-routes-v1`,复用 work-panel 历史连贯根治成果);③ **WorkBuddy 元素级取证补齐**(本机四路探测确认无程序本体):在装有 WorkBuddy 的机器上取包体或跑一次渲染取证,把报告 §1.4 的 E4 二手升为 E1/E2,再回补差距编号 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「D50」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10847(L1 外部持有行 L15774):

```
- [ ] 计划任务 `IHUI-C-Drive-AutoMaintain` 仍未注册(注册 = 影响全机的删除动作,须用户授权); 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记逐字相同的另一条登记(与本行正文逐字相同,可按正文检索;现存多处同文副本)(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L10848(L1 外部持有行 L15775):

```
- [ ] 另有 7 个脚本的 `--self-test` 仍走 `os.tmpdir()`(`check-workspace-dep-links` / 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记逐字相同的另一条登记(与本行正文逐字相同,可按正文检索;现存多处同文副本)(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L10849(L1 外部持有行 L7953):

```
- [ ] 72. `apps/desktop` 从薄壳到本地能力端点(本地 workspace 通道 + 增量索引 + 本地 git/diff + 离线降级;**保留前端单一事实源在 web,不复制 UI**) 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记已随归档搬至 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-08.md 的条目 「72 · apps/desktop从薄壳到本地能力端点」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10850(L1 外部持有行 L15777):

```
- [ ] 86. 证据级可追溯执行流水(每次工具调用带 invocation id + 输入/输出哈希 + 权限决策 + 操作者身份,导出签名 ledger) 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「86 · 证据级可追溯执行流水」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10851(L1 外部持有行 L15778):

```
- [ ] **O88. 台账孪生副本:两型已收口、一型待裁(2026-09-28 两次现读归正,归台账持有人)**:**已收口的两型** —— ① 行号指针维:F3 原先只认「存活于 L<行号>」一种措辞而该族 HEAD 面现读 0 条,归并器自己产的「同主键/逐字相同的另一条登记在 L<行号>」222 处全隐身(47 处指到别的话题 / 160 处目标行根本不是条目行 / 15 处落空),账面 F3=0 而 §1 明令禁止的证据形态满账;现改为**族表**判据 + 与之同集的修复出口(镜像 T11 钉"判得到必须修得了"),并收紧到"禁写行号"本身(指得准的行号指针也判红),现读面上行号指针 **0 处**。② 到期租约维:门 109 的 2 条 CL1 已按 §1 出路清账(有同题已完成登记的那条翻勾并摘牌;正文自述"刻意不当场执行"的那条不翻勾,改写成待认领并写明认领姿势)—— 该门是 `stagedTriggers=PROJECT_PLAN.md` 的 blocking 门,红着等于每次提交计划文档都被逼跳门(§12e)。**仍待裁的一型** —— ③ `--twins` 现读 **102 条**"已闭环登记的未勾孪生",其中靠**相似度**(0.63–0.95)或**包含**配上的约 93 条,按 §1「相似度只配报数,不配判红」一条都不能自动动;逐条分类已出(77 判同一句被复制、3 判不出、0 判成不同事),可自动子集仅 10 行,而那份分类的关键词筛在 35/80 行**漏判**未完成语义(反向 0 漏判)⇒ 这 10 行也不自动落,报告落在 `.ihui-agent/tmp/twin-adjudication/report.md`(临时区,不入库,需要就重跑)。**它在等什么**:等持有人按报告逐条裁"该记完成还是仍开" —— 自动挂"重复登记副本"指针会把真任务从派单口径里静默摘掉,那比账面重复更贵。取证一律现读:`node scripts/check-task-claims.mjs --twins`、`node scripts/plan-tasks.mjs --gate`(F3/F4/F4b/F6 四行)、`node scripts/plan-tasks-merge.mjs`。 **2026-09-28 再归正**:上面③那句"三面全不判"已被并发的另一路会话补上 —— 现读 `node scripts/plan-tasks.mjs --gate` 有 **F10 已完成行的逐字孪生(done 侧)224 组 / 多余副本 339 行**,默认档只报数、差值棘轮只拦新增,逐组出口 `node scripts/plan-tasks-merge.mjs --dedupe-done-twins`,**升 blocking 的前置是存量清零**(§12e)。所以本行剩下的真待裁只余"相似度孪生"那一族。 〔【归并】重复登记副本(2026-09-28):本行与同一件事的另一条登记同题,该登记的标题原文为「O88. 台账孪生副本的其余三型无人覆盖(2026-09-28 现读,归台账持有人)」;上面那条再归正已同步搬进那一条 ⇒ 其行内含本行全部结论,派单以那条为准,本行不再单独派单。〕
```

- 原 L10853(L2 族内归并,保留 L10792):

```
- [ ] 82. Predictive Edit(对标 Trae CUE 的独立编辑意图预测器,现有 FIM 链路上升级) 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「82 · PredictiveEdit」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10854(L1 外部持有行 L7953):

```
- [ ] 72. `apps/desktop` 从薄壳到本地能力端点(本地 workspace 通道 + 增量索引 + 本地 git/diff + 离线降级;**保留前端单一事实源在 web,不复制 UI**) 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「72 · apps/desktop从薄壳到本地能力端点」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10855(L1 外部持有行 L8018):

```
- [ ] 47. 三套执行内核工具集归一(A/B/C → 唯一工具注册表 `mcp_server._TOOLS`;AgentEngine 15 个工具映射或移植;JSON-RPC 只留协议适配层;CI parity 断言 `BUILTIN_ENGINE_TOOLS` ⊆ `_TOOLS` 映射完整) 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「47 · 三套执行内核工具集归一」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10856(L1 外部持有行 L8018):

```
- [ ] 47. 三套执行内核工具集归一(A/B/C → 唯一工具注册表 `mcp_server._TOOLS`;AgentEngine 15 个工具映射或移植;JSON-RPC 只留协议适配层;CI parity 断言 `BUILTIN_ENGINE_TOOLS` ⊆ `_TOOLS` 映射完整) 〔PROGRESS 2026-09-27(五路并行第一波,ab4fed16d 前一枚):已落 J11/J14 两面 + 引擎内置名经 `resolve_engine_tool` 归口(归口在 `_ADMIN_ONLY_TOOLS` 判定之前,否则 unified_exec 这类名字会绕过角色矩阵)。实测 `BUILTIN_ENGINE_TOOLS` 是 **14 枚不是票面的 15**。**未闭环**:第三格「JSON-RPC 只留协议适配层」未做 —— agent_engine 的 RPC 面仍自带工具定义。票保持未勾。〕 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「47 · 三套执行内核工具集归一」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10857(L2 族内归并,保留 L10792):

```
- [ ]82. Predictive Edit(对标 Trae CUE 的独立编辑意图预测器,现有 FIM 链路上升级) 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「82 · PredictiveEdit」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10858(L1 外部持有行 L1473):

```
- [ ] D14 云端沙箱 agent(容器隔离+任务队列+镜像缓存+跨项目并行看板,对标 Qoder My Quests)(G-17) 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记已随归档搬至 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-08.md 的条目 「D14 · 云端沙箱agent」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10859(L1 外部持有行 L15777):

```
- [ ] 86. 证据级可追溯执行流水(每次工具调用带 invocation id + 输入/输出哈希 + 权限决策 + 操作者身份,导出签名 ledger) 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记逐字相同的另一条登记(与本行正文逐字相同,可按正文检索;现存多处同文副本),派单以那条为准,本行不再单独派单。〕
```

- 原 L10860(L1 外部持有行 L1473):

```
- [ ] D14 云端沙箱 agent(容器隔离+任务队列+镜像缓存+跨项目并行看板,对标 Qoder My Quests)(G-17) 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「D14 · 云端沙箱agent」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10861(L1 外部持有行 L9982):

```
- [ ] **D35 长会话分页投影与增量回放(G-59)**:对标 Codex `thread_history_projection_state{next_rollout_byte_offset,next_rollout_ordinal}` + `idx_thread_items_by_turn_updated_page`。会话消息按 turn 分片拉取 + metadata 九类只回"摘要 + 展开时懒取全文"。**验收**:5000 消息会话首屏 ≤800ms(Playwright 计时断言,阈值入 e2e)+ 上翻不重复不丢帧 + 懒取失败降级为占位不白屏 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「D35 · 长会话分页投影与增量回放」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10862(L1 外部持有行 L1538):

```
- [ ] **D43 会话内快捷笔记(G-51)**:录音 12 phase 状态机 + 转写 + 归档/分组/搜索,笔记可一键插入对话。复用 `voice-input/voice-record`,不新建录音栈。**验收**:phase 矩阵用例(权限拒绝/中断/最终化失败)+ 笔记→上下文引用闭环 + miniapp 端豁免标注(平台独占:录音 API 差异) 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「D43 · 会话内快捷笔记」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10863(L1 外部持有行 L1550):

```
- [ ] **D50 多端遥控配对 + 每会话浏览器 Tab 状态(G-60)+ WorkBuddy 取证专项**:① 手机看/接管桌面在跑会话(对标 `remote_control_enrollments`);② 每会话浏览器 tab 路由状态持久化(对标 `thread-tab-routes-v1`,复用 work-panel 历史连贯根治成果);③ **WorkBuddy 元素级取证补齐**(本机四路探测确认无程序本体):在装有 WorkBuddy 的机器上取包体或跑一次渲染取证,把报告 §1.4 的 E4 二手升为 E1/E2,再回补差距编号 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「D50 · 多端遥控配对+每会话浏览器Tab状态」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10864(L1 外部持有行 L15835):

```
- [ ] **D128 AI 对话链路四竞品对标 V4 收口线(19 条差距 / 5 个 Sprint)** —— 唯一入口 `docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`(87–105),本轮不在此复述差距正文,只登记排期与等待项。**S9 尺子先行(105→97)**:先落 `scripts/audit-benchmark-delivery.mjs`(V3 §八 自留建议至今未落地,`ls` 实测不存在)与 parity 门六端扩面,**顺序不可颠倒** —— #93/#94/#96 之所以能长期存在,正是因为 §9「多端连通」的机器判据只覆盖 web 一端(`check-agent-event-parity.mjs:537` 只扫 `apps/web/src`)。**S10 移动端可达性(93→94→95)**:RN 主屏 `apps/mobile-rn/src/screens/ChatScreen.tsx:652` 起只接 7/30 回调(逐名 `comm -23` 算出缺 23 个,含 `onToolCall`/`onToolApproval`/`onPlanUpdate`/`onTerminal*`/`onSubagent*`/`onUsage`/`onBudget`/`onQuestion`/`onFormRequest`/`onReconnect`),而同端 `AiAssistantN8nScreen.tsx:1412` 是完整实现、`src/utils/chat-render-model.ts` 的 4 个 `apply*` 在主屏零调用方 ⇒ 本票主体是**接线不是开发**;#94 是信任型缺陷(RN 与小程序 `tool-approval` 双零命中,手机上遇高危操作无弹窗)。**S11 保真(87→88→89→92)**、**S12 契约地基(99→100→101→102)**、**S13 传输计量收口(96→90→91→103→98)**。**等待项(归属:等用户拍板)**:#100 内置默认高危集**改变默认行为**(现 `_high_risk_tools_from_env` 未配 env 即 `frozenset()`,`agent_loop_v2.py:288-296`),按 §24 不得由实现票自行开工;#98 桌面端薄壳是 V3 #72 已拍板架构,本票**只对齐三处口径**(tauri.conf / `ensure-web-out.mjs` 自称唯一校验点 / `docs/MULTI_END.md §2.5`),不改选型。**解阻前置(可判)**:S10 之前必须先有 S9 的端能力档案表,否则清完的端下轮又漏。**本轮同时否证 7 条断言,均写进 V4 正文,不得照旧文派单**:①②③ 上述三条 V3 过期结论;④ `packages/app` 的 `ChatScreen` 并非「未导出」—— `src/index.ts:684` 导出在位,真问题是**全仓零消费方**(同包其它 4 个聊天屏都被 mobile-rn 复用)⇒ 归 #95;⑤ web **有**消息队列与 Steer(`queue-interaction-bar.tsx` 在库,D38 已✅)⇒ 队列**不是**差距,初稿列错了;⑥ #89 初稿「主聊天流无自动重连」**否证** —— api-client `client.ts:2078/2129/3443` 有重连与 `Last-Event-ID` 续传,web `send-message.ts:767-775` 已消费 `onReconnect`,缺陷窄化为「`connection-status.tsx` 四态件生产面零挂载(命中全在 `apps/web/tests/agent-task-progress-pane.test.tsx`) + 重连后待决审批恢复未取证」;#96 那句「web 反而没有续传」同批否证;⑦ 孤儿清单里的 `voice-note.tsx` 在 HEAD 与索引双双落空,只在工作树未跟踪面 ⇒ 摘出清单、按 §12 归属未定不动。**本轮交付**:V4 文档成文并注水印(`docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`,`watermark.mjs verify` 覆盖 1/1、残迹 0、损坏 0);六端回调覆盖数改用统一交集判据重算(web 全域 30/30、extension 19、cli 12、RN 主屏 7、RN 另一屏 17、miniapp 17),并登记「事件名口径 23 与回调名口径 17 不可混用」。**待办本体是 S9–S13 的实施,本行不因文档成文而翻勾。****本轮同时更正 3 条 V3 过期结论,不得照它们派单**:#73「小程序无 AI 对话页」已被代码推翻(`apps/miniapp-taro/src/pkg-ai/ai/chat.tsx` 1623 行,最新提交 `3f3e71a99` 09-27,按事件名覆盖 23/30);#51「`run_in_background` 只有 sleep/echo」已不成立(`task_executors.py` 现读 16 个 `async def` + import 期三面断言);#47「三套执行内核」应为「一套半」(`class AgentLoopV2` 唯一内核,但 `agent_loop.py` 仍以 `agent_executor` 被 `routers/agents.py:48`、`services/a2a_service.py:33`、`services/slash_commands.py:162` 三处生产引用)。 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「D128」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10865(L1 外部持有行 L15577):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7673(G-349) 同题,派单以持有行为准,本行不再单独派单。〕 **G-349. 门 8 清账后遗留的三枚"有消费方的待实装路由"(2026-09-28 登记,现读=基线仅剩 3 处)**:① `GET /api/subagents/all` —— 消费者 `apps/web/app/(main)/agent-teams/page.tsx:58`(期望 `{dispatches}` 含 completed/failed/cancelled 全量);后端只有 `/subagents/active`(仅 pending/running,形状恰好相同但语义是子集,**不得**为省事把客户端改道 active —— 那会把"页面少了历史"写成"已修")。正解 = 在 `subagent-dispatch.ts` 补 all 列表路由(带 status/limit 透传)。②③ `PUT /api/ai/n8n/workflows/:id` 与 `POST .../toggle` —— 消费者 `apps/mobile-rn/src/screens/N8nModelScreen.tsx:146/192`(保存改名/启停今天必 404);后端 n8n 面只有列表透传与创建转发(miniapp-compat-routes.ts:1123/1190),n8n REST API 本身支持 workflows/:id 更新与 activate/deactivate,正解 = 在 n8n 代理补两枚透传(SSRF 校验与 env 缺省回 stub 的既有纪律照抄)。验收判据:两枚消费者页面真机/真会话各跑一次成功路径 + 基线 `scripts/api-routes-baseline.json` 清零 + 门 8 末行现读 0。**归属**:subagent 面 = agent-teams 线;n8n 两面 = n8n 代理持有人(本票只登记形状与消费者证据,不代裁实现位置)。 〔落地@2026-09-28/枚 2704c4d27〕三枚路由已入库:subagents/all(新→旧+status/limit)、/ai/n8n/workflows 面四枚(list stub/写 503/fetch-merge-put/toggle 回读真值);apps/api/tests/g299-new-routes.test.ts 4 例绿、门 8 死调用清零、基线 perFileCount 清表。**本票未翻勾的唯一理由=验收判据第一条未跑**:RN N8nModelScreen 真机走查(本机无设备)与 agent-teams 页真会话 200 取证(需起栈)——路由与契约已证,运行时成功路径待验,不得以单测冒充真机。（编号改派留痕:本行原登记为「G-299. 门 8 清账后遗留的三枚…」,与「本机交付被远端分支保护拒收」撞成一号两事;2026-09-28 由 live-doc-edit 的取号令牌在每次 CAS 里按当下 HEAD 现算改派为 G-312,旧编号在此留原文,便于任何按旧号引用的人查得到去向,而不是让它静默消失） —— 沿革:G-299→G-312→G-334(两次都被别的登记占去,每次都在行尾留原文)。**[重复登记副本]** 同一件事在 origin 侧以「G-316. 门 8 清账后遗留的三枚…」另登过一次,当前状态持有行按那条走,本行不翻勾、不并抄。 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「G-349 · 门8清账后遗留的三枚"有消费方的待实装路由"」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10866(L1 外部持有行 L15577):

```
- [ ]〔【归并】重复登记副本(2026-09-28,幂等折叠):这一行与同题的持有行是同一件事,持有行是「门 8 清账后遗留的三枚"有消费方的待实装路由"…」那一条待办(按标题前缀寻行;指针里既不写编号也不写行号 —— 写了编号就会被台账取成这条副本自己的主键,折叠反而新增撞号,这是今天实测到的成因)。本行摘掉编号、只留指针,不翻勾、不并抄、正文逐字保留。〕 **G-316. 门 8 清账后遗留的三枚"有消费方的待实装路由"(2026-09-28 登记,现读=基线仅剩 3 处)**:① `GET /api/subagents/all` —— 消费者 `apps/web/app/(main)/agent-teams/page.tsx:58`(期望 `{dispatches}` 含 completed/failed/cancelled 全量);后端只有 `/subagents/active`(仅 pending/running,形状恰好相同但语义是子集,**不得**为省事把客户端改道 active —— 那会把"页面少了历史"写成"已修")。正解 = 在 `subagent-dispatch.ts` 补 all 列表路由(带 status/limit 透传)。②③ `PUT /api/ai/n8n/workflows/:id` 与 `POST .../toggle` —— 消费者 `apps/mobile-rn/src/screens/N8nModelScreen.tsx:146/192`(保存改名/启停今天必 404);后端 n8n 面只有列表透传与创建转发(miniapp-compat-routes.ts:1123/1190),n8n REST API 本身支持 workflows/:id 更新与 activate/deactivate,正解 = 在 n8n 代理补两枚透传(SSRF 校验与 env 缺省回 stub 的既有纪律照抄)。验收判据:两枚消费者页面真机/真会话各跑一次成功路径 + 基线 `scripts/api-routes-baseline.json` 清零 + 门 8 末行现读 0。**归属**:subagent 面 = agent-teams 线;n8n 两面 = n8n 代理持有人(本票只登记形状与消费者证据,不代裁实现位置)。 〔落地@2026-09-28/枚 2704c4d27〕三枚路由已入库:subagents/all(新→旧+status/limit)、/ai/n8n/workflows 面四枚(list stub/写 503/fetch-merge-put/toggle 回读真值);apps/api/tests/g299-new-routes.test.ts 4 例绿、门 8 死调用清零、基线 perFileCount 清表。**本票未翻勾的唯一理由=验收判据第一条未跑**:RN N8nModelScreen 真机走查(本机无设备)与 agent-teams 页真会话 200 取证(需起栈)——路由与契约已证,运行时成功路径待验,不得以单测冒充真机。 (原编号 G-316)
```

- 原 L10867(L1 外部持有行 L8040):

```
- [ ]〔【归并】重复登记副本(2026-09-28,幂等折叠):这一行与同题的持有行是同一件事,持有行是「分叉合并带进来的三组跨分支撞号…」那一条待办(按标题前缀寻行;指针里既不写编号也不写行号 —— 写了编号就会被台账取成这条副本自己的主键,折叠反而新增撞号,这是今天实测到的成因)。本行摘掉编号、只留指针,不翻勾、不并抄、正文逐字保留。〕 **G-335. 分叉合并带进来的三组跨分支撞号(G-300 / G-301 / G-310),锚点已按现读收下,清偿不在这张票里**:机制不是"没查号" —— 两条分支各自在**自己那侧的当下 HEAD** 取过号、都没撞,合到同一份账面才第一次相遇(取号发生在分叉的两条腿上,号段并不共享)。判红条件"锚点里没有的键"必须现读放行,否则这枚合并自己就是一台恒红门;但**放行不等于已修**。归谁:各该票的持有人(由 origin 侧登记的哪一路会话持有)。等什么:该票持有人把自己那一侧改派成新号并在行尾留沿革,改派后跑 `node scripts/plan-tasks.mjs --update-baseline` 收窄锚点 —— 只许收窄,所以这一步天然把"顺手把锚调宽"堵在外面。(2026-09-28 合并时登记,现读见当次 --gate --json 的 collisions 数组) (原编号 G-335)
```

- 原 L10869(L1 外部持有行 L15670):

```
- [ ] G-393 **门 33 的 provider 名单该由谁供给(归属:守门 33 持有人;等人拍板)** —— 现读 7 个在 `.env` 的合法 provider 被判"未知",默认档只 warning 所以 rc 0。**为什么还开着**:config.py 的设计是"新增 provider 零代码改动、自动识别",而本门的名单是手抄副本;两种收口动作语义相反——① 把 7 个补进名单 = 继续养第二份真相,② 由 `.env`/服务端能力清单单向投影 = 改一道 blocking 门的判据。必须先定"这份名单到底要不要存在"。**不得**为让 warning 归零去删判据或放宽规则 3。 (原编号 G-G-354 系改派工具把前缀重复贴了一次:尺子会把它读成 G-354 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4 —— 现取新号,正文逐字未动) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-393」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10870(L1 外部持有行 L15579):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7765(G-763) 同题,派单以持有行为准,本行不再单独派单。〕 G-394 **MemberCard 把"没量到"显示成 0(第八轮对照逼出;归属:web 首页持有者;等 §17 运行时自验排期)** —— `apps/web/src/components/home/MemberCard.tsx:72-73` 现读 `stats?.points ?? 0` / `wallet?.balance ?? 0`,查询未回或失败时显示"0 分""0 余额"。上游同族口径是"订阅未知不能发布为成功空快照"(`packages/services/src/usage-stats/providers/bigmodelUsageQuotaProvider.ts:259` 原文)加展示层 `'--'` 占位。**为什么还开着**:属 UI 改动,§17 要求起 dev + 读 DOM 数值自验,本票未做该项;改法是 `number | null` + 占位,不动判据、无恒红风险。**这一条不是"抄上游功能",是把"未知"与"为零"分开** —— 后者是数据事故,前者是显示诚实。 (原编号 G-G-355 系改派工具把前缀重复贴了一次:尺子会把它读成 G-355 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4 —— 现取新号,正文逐字未动) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-394」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10871(L1 外部持有行 L7603):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7693(G-395) 同题,派单以持有行为准,本行不再单独派单。〕 G-395 **配置分层的"出处标签"与"请求档 vs 实得档"留痕(归属:cli/子代理线持有人;等产品拍板)** —— 上游 `packages/provider/src/resolver.ts:190/196/208` 三层 overlay 且每个生效对象带 `source` 标签、快照的 `sourceRevisions` 被真实消费;我方 `apps/cli/src/subagents/precedence.ts:195-205` 的四层短路链**没有出处标签**,且 `git grep -I "requestedEffort\|effectiveEffort\|validateModelSelection"` HEAD 面现读 **0 命中** ⇒ 静默降档无法归因。**为什么还开着**:新建"配置分层解析出口"属 §24 新增能力、且是跨端数据建模,不在本轮取证范围;上游那两格(`effective-model-selection.ts` 的 `selectionIssue` 六值枚举、`model-selection-config.ts:76-77`"不能静默补档位")是它的前置形状,可作参考实现但不是本轮交付物。 (原编号 G-G-356 系改派工具把前缀重复贴了一次:尺子会把它读成 G-356 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4 —— 现取新号,正文逐字未动) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-395」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10873(L1 外部持有行 L7605):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7695(G-397) 同题,派单以持有行为准,本行不再单独派单。〕 G-397 **锁的"租约认 token 不认 pid"一格只登记、未代裁(归属:`git-lock`/`deploy-lock` 持有人)** —— 上游 `packages/provider-node/src/zcode-builtin-remote-synchronizer.ts:85` 取 `leaseId=randomUUID`、`:143` 的 `#finishLease` 只在 leaseId 相等时才改控制文件,于是"pid 被系统复用"这一型**结构上不可能发生**;而我方是事后补的一环(`scripts/lib/proc-identity.mjs` 的 match/mismatch/unverifiable,承 G-193 那次冻结 11h50m)。**为什么还开着**:改两处锁的 meta 属锁持有人领地,且今天没有可复现的抢占现场做验收依据;真要收它,判据应是"注入一次 leaseId 不相等的迟到 finish 请求,控制文件必须不被改动",而不是"代码写了 leaseId"。 (原编号 G-G-358 系改派工具把前缀重复贴了一次:尺子会把它读成 G-358 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4 —— 现取新号,正文逐字未动) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-397」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10874(L1 外部持有行 L7606):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7696(G-398) 同题,派单以持有行为准,本行不再单独派单。〕 G-398 **第八轮剩余六格候选清单(归属:未派;等各线排期;本轮只取证未实现,逐格带出处)** —— ① 跨层发布闸:上游 `registry-service.ts:205-212` 在"下层已变而上层仍基于旧事实"时**不发混合快照**、继续服务上一份完整 Registry,而我方这条纪律只活在门的散文里、运行时层无出口;② 稀疏 overlay 空即删:`config-service.ts:513-516` 与继承值等价的配置不落盘(absence=继承,不是"空覆盖");③ 诊断量代替原文:`officialMcpCredentials.ts:52-90/359-376` 只记 JWT 剩余秒数并按小时分桶去重,可接我方唯一脱敏出口 `packages/shared/src/utils/redact.ts`;④ 告警去重身份=桶+周期而非墙钟窗口:`startPlanQuotaReminderStore.ts:33-36` 用快照 `referenceTime` 裁决(设备时间可能已越过服务端周期)、`bucketReminderKey` 缺任一字段即不提醒;⑤ in-flight 合并 + CAS 驱逐:`zaiStartPlanBilling.ts:113-122` 失败响应同样保留 1s(防 429 后立刻重复请求)且驱逐前 `if (requests.get(k) !== request) return`(旧请求不得删新记录),上游该守卫三处同形,是我方共享工作区并发写可直接取用的最小实现;⑥ 幂等 key 复用规则:`codingPlanQuotaResetCoordinator.ts:307-329` 瞬时错复用原 key、成功或稳定错才置 null,且服务端 `next_try_at` 必须透传(:617-624)。**为什么还开着**:六格都是"能落但需各自定级与验收"的独立改动(①②碰运行时快照语义、③④⑤⑥碰告警与并发路径),打包成一票会互相遮蔽;派单时逐格取,勿一次全接。**另有一格需产品先定**:上游 `usage-quota.ts:71` 的 `percentage` 是**已用**占比、而 Start Plan 侧 `:1338` 同名字段是**剩余/总额**,现靠"两族走不同 reader"规避,**无类型或判据看守** —— 要不要收口成"以 remaining 为权威、percentage 仅降级",属契约决策。 (原编号 G-G-359 系改派工具把前缀重复贴了一次:尺子会把它读成 G-359 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4 —— 现取新号,正文逐字未动) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-398」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10875(L1 外部持有行 L15577):

```
- [ ]〔【归并】重复登记副本(2026-09-28,幂等折叠):这一行与同题的持有行是同一件事,持有行是「门 8 清账后遗留的三枚"有消费方的待实装路由"…」那一条待办(按标题前缀寻行 —— 指针里既不写编号也不写行号:编号落在正文前 48 字符内会被台账取成本行的主键,折叠反而新增撞号)。本行摘掉编号、只留指针,不翻勾、不并抄、正文逐字保留。〕 **G-316. 门 8 清账后遗留的三枚"有消费方的待实装路由"(2026-09-28 登记,现读=基线仅剩 3 处)**:① `GET /api/subagents/all` —— 消费者 `apps/web/app/(main)/agent-teams/page.tsx:58`(期望 `{dispatches}` 含 completed/failed/cancelled 全量);后端只有 `/subagents/active`(仅 pending/running,形状恰好相同但语义是子集,**不得**为省事把客户端改道 active —— 那会把"页面少了历史"写成"已修")。正解 = 在 `subagent-dispatch.ts` 补 all 列表路由(带 status/limit 透传)。②③ `PUT /api/ai/n8n/workflows/:id` 与 `POST .../toggle` —— 消费者 `apps/mobile-rn/src/screens/N8nModelScreen.tsx:146/192`(保存改名/启停今天必 404);后端 n8n 面只有列表透传与创建转发(miniapp-compat-routes.ts:1123/1190),n8n REST API 本身支持 workflows/:id 更新与 activate/deactivate,正解 = 在 n8n 代理补两枚透传(SSRF 校验与 env 缺省回 stub 的既有纪律照抄)。验收判据:两枚消费者页面真机/真会话各跑一次成功路径 + 基线 `scripts/api-routes-baseline.json` 清零 + 门 8 末行现读 0。**归属**:subagent 面 = agent-teams 线;n8n 两面 = n8n 代理持有人(本票只登记形状与消费者证据,不代裁实现位置)。 〔落地@2026-09-28/枚 2704c4d27〕三枚路由已入库:subagents/all(新→旧+status/limit)、/ai/n8n/workflows 面四枚(list stub/写 503/fetch-merge-put/toggle 回读真值);apps/api/tests/g299-new-routes.test.ts 4 例绿、门 8 死调用清零、基线 perFileCount 清表。**本票未翻勾的唯一理由=验收判据第一条未跑**:RN N8nModelScreen 真机走查(本机无设备)与 agent-teams 页真会话 200 取证(需起栈)——路由与契约已证,运行时成功路径待验,不得以单测冒充真机。 (原编号 G-316)
```

- 原 L10876(L1 外部持有行 L8040):

```
- [ ]〔【归并】重复登记副本(2026-09-28,幂等折叠):这一行与同题的持有行是同一件事,持有行是「分叉合并带进来的三组跨分支撞号…」那一条待办(按标题前缀寻行 —— 指针里既不写编号也不写行号:编号落在正文前 48 字符内会被台账取成本行的主键,折叠反而新增撞号)。本行摘掉编号、只留指针,不翻勾、不并抄、正文逐字保留。〕 **G-335. 分叉合并带进来的三组跨分支撞号(G-300 / G-301 / G-310),锚点已按现读收下,清偿不在这张票里**:机制不是"没查号" —— 两条分支各自在**自己那侧的当下 HEAD** 取过号、都没撞,合到同一份账面才第一次相遇(取号发生在分叉的两条腿上,号段并不共享)。判红条件"锚点里没有的键"必须现读放行,否则这枚合并自己就是一台恒红门;但**放行不等于已修**。归谁:各该票的持有人(由 origin 侧登记的哪一路会话持有)。等什么:该票持有人把自己那一侧改派成新号并在行尾留沿革,改派后跑 `node scripts/plan-tasks.mjs --update-baseline` 收窄锚点 —— 只许收窄,所以这一步天然把"顺手把锚调宽"堵在外面。(2026-09-28 合并时登记,现读见当次 --gate --json 的 collisions 数组) (原编号 G-335)
```

- 原 L10877(L1 外部持有行 L7608):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7698(G-402) 同题,派单以持有行为准,本行不再单独派单。〕 G-402 **设置项"显式清空"与"从未设置"无差，且读侧同一含义两键相反（需拍板；归属：api 设置面 + web 设置页持有人）** —— 已亲自复验：`apps/api/src/routes/user/settings-routes.ts:55` 写体是 `z.record(z.string(), z.unknown())`，落库处 `value === null || value === undefined ? null : String(value)` ⇒ `null` 与"缺席"存成同一个 NULL 行；读侧 `apps/web/app/(main)/settings/notifications/page.tsx:48-52` 四键混用 `!== 'false'`（默认真）与 `=== 'true'`（默认假），于是**同一个被清空的值，在前一族读回 true、在后一族读回 false**。上游同族做法是把三态写进契约（`settings/pluginConfigPatch.ts:29-36`：`undefined`=未触碰跳过、`null`=进 `clearOptionKeys`、sensitive 空串=不改已有值；落库侧 `file-config.adapter.ts:557-565` 按 option key 合并而非整对象替换，防同 scope 密钥被静默清空）。**为什么还开着**：改成三态要动 PUT 语义（单键 DELETE 出口我方根本没有——`deleteUserPreference` 只服务 devices），属对外契约决策；先拍"要不要有删键出口"，再谈读侧归一。**不得**靠"读侧统一成 `=== 'true'`"消红——那会把默认真的四项静默翻转。 (原编号 G-G-374 系改派工具把前缀重复贴了一次:尺子会把它读成 G-374 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4 —— 现取新号,正文逐字未动) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-402」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10879(L1 外部持有行 L11026):

```
- [ ]**D163 回退与预览失败必须声明「工作区未发生变化」,并把 Diff 快捷预览从三态补到五态(承 V4 §8.3③;一手取证 2026-09-28)。** 竞品原文:`undoUnavailableDescription:"文件检查点不可用，工作区未发生变化。"`、`undoFailedDescription:"CLI 文件检查点暂时不可用，工作区未发生变化。"`、成功态 `undoSucceededDescription:"已恢复 {{count}} 个文件；任务记录仍然保留。"`、确认态 `undoConfirmDescription:"将恢复 {{fileCount}} 个文件，并同时撤销从这轮开始受影响的 {{turnCount}} 轮修改。任务记录不会删除。"`、准备态 `undoPreparingDescription:"正在检查将恢复的文件和受影响轮次…"`、部分警告 `undoPartialWarning:"部分修改不在 CLI 文件检查点中，撤销结果可能不完整。"`;预览五态 `diffPreviewLoading / diffPreviewLoadFailed:"Diff 加载失败。移开后重新悬停可重试。"(给具体动作)/ diffPreviewExpired:"这份 Diff 记录已过期，无法快捷预览。"/ diffPreviewTooLarge:"Diff 过大，无法在快捷预览中显示。"/ diffPreviewUnavailable:"当前没有可供预览的文本 Diff。"`。**我方否证**:`git grep -niE "工作区未发生|未发生变化|nothing changed" -- packages/i18n/messages/web/zh-CN.json apps/web/src packages/shared/src` **零命中**;预览降级我方 D90 已✅三态(工具记录内容/无法读取当前文件/没有可预览内容),**缺"已过期"与"过大"两态及其动作出口**。**为什么重要**:回退是破坏性动作,用户敢不敢再试一次全靠"这次什么都没改成"这句承诺;这与 §「越权用例要断言未发出查询(`whereSeen===0`)」是同一条纪律的**用户界面版**——机器侧断言副作用未发生,人这一侧要给一句等价的话。**不得只改文案**:文案必须由"是否真的没改"这个事实驱动(撤销前记快照、失败后比对文件集与索引,不成立就不许说"未发生变化"),否则就是造一句安慰话。**归属**:可与第二条并行,但**依赖协议通道②/③(检查点可用性状态要能上报)**。**验收**:①注入一次"部分文件回滚失败",断言文案含具体文件数与"未变化"承诺,且该承诺由比对结果驱动(把比对改成恒真,用例必须翻红——变异对照);②预览五态各有用例,过期与过大两态必须给**下一步动作**而非只报失败。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「D163」,派单以那条为准,本行不再单独派单。〕 —— 租约(2026-10-02/goal-cont):现读复核票面前提，**两态预览那一半已在 HEAD**(枚 `63ad49be80` 交付 + `apps/web/src/components/media/__tests__/d163-preview-five-states.test.tsx` 现读 expired 给「重试+打开原文」、too-large 只给「打开原文」并断言无重试按钮 ⇒ 验收②的「给下一步动作」有界面级证据)；回退声明那一半的事实判据与消费点也已入库(`apps/web/src/lib/undo-fact-check.ts` + `apps/web/src/components/checkpoint/CheckpointRewindPanel.tsx:111-134` 真的走比对结果与 `count` 插值)。**本租约只补剩下那一格**:面板级用例(把「比对结论 → 用户看到的那句」钉成可红可绿,含变异对照),纯判据单测证不了改坏接线的形态。
```

- 原 L10880(L1 外部持有行 L15780):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘):本行已让号至 G-200(持行在面),merge 回流旧态摘号留指针,正文逐字保留。〕输出被 max_tokens 截断时没有任何"续写"链路，且端上看不到截断（等人拍板）—— 上游 `runtime/methods/turn-output-token-continuation.ts:15-57` 有界续写 ≤3 次、把 `finish_reason==='length'` 与 raw `model_context_window_exceeded`（**成功响应**）判为续写而非压缩，续写 prompt 带 `queryScope` 并被排除出持久历史。我方 SSE 链**根本不携带 finish/stop reason**（`apps/cli/src/commands/agent.ts`、`packages/api-client/src/endpoints/chat.ts`、`packages/shared/src/utils/sse-parse.ts` 三处现读均无；provider 侧只有 `apps/ai-service/app/providers/gemini_provider.py:146-170` 解 `finishReason` 且只用于 SAFETY）。现读 `scripts/guardian-runner.mjs` 的 187 条 `script:` 中无一道判这一格。跨端契约动作（§19 parity + 8 端），并要先定默认档（只提示 / 默认续写 / 默认 off + 影子档只记账 —— 守门 115 已有同一先例与同一理由）。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-425」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10882(L1 外部持有行 L1473):

```
- [ ] D14 云端沙箱 agent(容器隔离+任务队列+镜像缓存+跨项目并行看板,对标 Qoder My Quests)(G-17) 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记 「D14 · 云端沙箱agent」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10883(L1 外部持有行 L9982):

```
- [ ] **D35 长会话分页投影与增量回放(G-59)**:对标 Codex `thread_history_projection_state{next_rollout_byte_offset,next_rollout_ordinal}` + `idx_thread_items_by_turn_updated_page`。会话消息按 turn 分片拉取 + metadata 九类只回"摘要 + 展开时懒取全文"。**验收**:5000 消息会话首屏 ≤800ms(Playwright 计时断言,阈值入 e2e)+ 上翻不重复不丢帧 + 懒取失败降级为占位不白屏 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记 「D35 · 长会话分页投影与增量回放」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10884(L1 外部持有行 L1538):

```
- [ ] **D43 会话内快捷笔记(G-51)**:录音 12 phase 状态机 + 转写 + 归档/分组/搜索,笔记可一键插入对话。复用 `voice-input/voice-record`,不新建录音栈。**验收**:phase 矩阵用例(权限拒绝/中断/最终化失败)+ 笔记→上下文引用闭环 + miniapp 端豁免标注(平台独占:录音 API 差异) 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记 「D43 · 会话内快捷笔记」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10885(L1 外部持有行 L1550):

```
- [ ] **D50 多端遥控配对 + 每会话浏览器 Tab 状态(G-60)+ WorkBuddy 取证专项**:① 手机看/接管桌面在跑会话(对标 `remote_control_enrollments`);② 每会话浏览器 tab 路由状态持久化(对标 `thread-tab-routes-v1`,复用 work-panel 历史连贯根治成果);③ **WorkBuddy 元素级取证补齐**(本机四路探测确认无程序本体):在装有 WorkBuddy 的机器上取包体或跑一次渲染取证,把报告 §1.4 的 E4 二手升为 E1/E2,再回补差距编号 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记 「D50 · 多端遥控配对+每会话浏览器Tab状态」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10886(L1 外部持有行 L15701):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘):本行已让号至 G-210(持行在面),merge 回流旧态摘号留指针,正文逐字保留。〕**台账 F4(重复登记副本)对"同一待办的漂移副本"结构上失明 —— 现读一例:同一条 D41后续① 在 HEAD 有 9 份未勾选副本、其中 7 份正文互不相同(2026-09-28 量)**: `plan-tasks.mjs` 的 F1/F4 判据是"编号 + 标题前缀**逐字等值**",这既是它的优点(不做相似度猜判)也是它的洞 —— 并发 union 每次都留一份**带自己注记**的副本,前缀之后的正文一漂移,复合主键就不再相等,于是同一件事以 N 份"未勾选"长期并存。后果不是账面难看而是**派单被放大 N 倍**:本日两次 `plan-tasks-merge.mjs --heal --commit`(归并 30 行 / 34 行)把 F1/F4 都归到 0,而这一族一份都没被动到 ⇒ "跑过归并"不等于"这一族被覆盖"。出路只有两条且都不该由机器代裁:① 归并线逐组判"哪份是当前状态"(需要读注记语义,机器判不了);② 给登记侧加一条硬约束——同一件事要更新就**就地改那一条**(§1 第 2 条已有此规矩,缺的是让机器能在前缀一致而正文漂移时也点名)。本票**只登记现读证据与两条出路**,不改判据、不批量翻勾(批量翻勾 = 把别人的注记当噪声删,比原病更响)。归属:分叉合并归并线(同 G-363 那条持有)。 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「G-417」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10887(L1 外部持有行 L15701):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘②):本行已让号至 G-210(持行在面),指针后残留编号声明位摘除,正文逐字保留。〕**台账 F4(重复登记副本)对"同一待办的漂移副本"结构上失明 —— 现读一例:同一条 D41后续① 在 HEAD 有 9 份未勾选副本、其中 7 份正文互不相同(2026-09-28 量)**: `plan-tasks.mjs` 的 F1/F4 判据是"编号 + 标题前缀**逐字等值**",这既是它的优点(不做相似度猜判)也是它的洞 —— 并发 union 每次都留一份**带自己注记**的副本,前缀之后的正文一漂移,复合主键就不再相等,于是同一件事以 N 份"未勾选"长期并存。后果不是账面难看而是**派单被放大 N 倍**:本日两次 `plan-tasks-merge.mjs --heal --commit`(归并 30 行 / 34 行)把 F1/F4 都归到 0,而这一族一份都没被动到 ⇒ "跑过归并"不等于"这一族被覆盖"。出路只有两条且都不该由机器代裁:① 归并线逐组判"哪份是当前状态"(需要读注记语义,机器判不了);② 给登记侧加一条硬约束——同一件事要更新就**就地改那一条**(§1 第 2 条已有此规矩,缺的是让机器能在前缀一致而正文漂移时也点名)。本票**只登记现读证据与两条出路**,不改判据、不批量翻勾(批量翻勾 = 把别人的注记当噪声删,比原病更响)。归属:分叉合并归并线(同 G-363 那条持有)。 (编号改派留痕(2026-09-28):本行原取 G-417,与「全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红」一条撞成一号两事;取号发生在分叉的两条腿上,号段不共享。让位的是**本行**(它是我这一路登记的),别人的行不动;新号由取号令牌按当次 CAS 的 HEAD 现算,落地后须复核它不与任何行首编号重复。正文一字未动。) (原编号 G-417;持有行题面「台账F4」)
```

- 原 L10888(L1 外部持有行 L15701):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘):本行已让号至 G-210(持行在面),merge 回流旧态摘号留指针,正文逐字保留。〕**台账 F4(重复登记副本)对"同一待办的漂移副本"结构上失明 —— 现读一例:同一条 D41后续① 在 HEAD 有 9 份未勾选副本、其中 7 份正文互不相同(2026-09-28 量)**: `plan-tasks.mjs` 的 F1/F4 判据是"编号 + 标题前缀**逐字等值**",这既是它的优点(不做相似度猜判)也是它的洞 —— 并发 union 每次都留一份**带自己注记**的副本,前缀之后的正文一漂移,复合主键就不再相等,于是同一件事以 N 份"未勾选"长期并存。后果不是账面难看而是**派单被放大 N 倍**:本日两次 `plan-tasks-merge.mjs --heal --commit`(归并 30 行 / 34 行)把 F1/F4 都归到 0,而这一族一份都没被动到 ⇒ "跑过归并"不等于"这一族被覆盖"。出路只有两条且都不该由机器代裁:① 归并线逐组判"哪份是当前状态"(需要读注记语义,机器判不了);② 给登记侧加一条硬约束——同一件事要更新就**就地改那一条**(§1 第 2 条已有此规矩,缺的是让机器能在前缀一致而正文漂移时也点名)。本票**只登记现读证据与两条出路**,不改判据、不批量翻勾(批量翻勾 = 把别人的注记当噪声删,比原病更响)。归属:分叉合并归并线(同 G-363 那条持有)。 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「G-417 · 台账F4」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10892(L1 外部持有行 L15704):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘):原号已让出(批⑤),merge 回流旧态摘号留指针,正文逐字保留;同题以「本批全量终审 186 项」按标题前缀寻行。〕**本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)** 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-580」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10893(L1 外部持有行 L15670):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11120(G-393) 同题,派单以持有行为准,本行不再单独派单。〕 G-354 **门 33 的 provider 名单该由谁供给(归属:守门 33 持有人;等人拍板)** —— 现读 7 个在 `.env` 的合法 provider 被判"未知",默认档只 warning 所以 rc 0。**为什么还开着**:config.py 的设计是"新增 provider 零代码改动、自动识别",而本门的名单是手抄副本;两种收口动作语义相反——① 把 7 个补进名单 = 继续养第二份真相,② 由 `.env`/服务端能力清单单向投影 = 改一道 blocking 门的判据。必须先定"这份名单到底要不要存在"。**不得**为让 warning 归零去删判据或放宽规则 3。 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「G-354」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10894(L1 外部持有行 L15579):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7765(G-763) 同题,派单以持有行为准,本行不再单独派单。〕 G-355 **MemberCard 把"没量到"显示成 0(第八轮对照逼出;归属:web 首页持有者;等 §17 运行时自验排期)** —— `apps/web/src/components/home/MemberCard.tsx:72-73` 现读 `stats?.points ?? 0` / `wallet?.balance ?? 0`,查询未回或失败时显示"0 分""0 余额"。上游同族口径是"订阅未知不能发布为成功空快照"(`packages/services/src/usage-stats/providers/bigmodelUsageQuotaProvider.ts:259` 原文)加展示层 `'--'` 占位。**为什么还开着**:属 UI 改动,§17 要求起 dev + 读 DOM 数值自验,本票未做该项;改法是 `number | null` + 占位,不动判据、无恒红风险。**这一条不是"抄上游功能",是把"未知"与"为零"分开** —— 后者是数据事故,前者是显示诚实。 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「G-355」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10895(L1 外部持有行 L7603):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7693(G-395) 同题,派单以持有行为准,本行不再单独派单。〕 G-356 **配置分层的"出处标签"与"请求档 vs 实得档"留痕(归属:cli/子代理线持有人;等产品拍板)** —— 上游 `packages/provider/src/resolver.ts:190/196/208` 三层 overlay 且每个生效对象带 `source` 标签、快照的 `sourceRevisions` 被真实消费;我方 `apps/cli/src/subagents/precedence.ts:195-205` 的四层短路链**没有出处标签**,且 `git grep -I "requestedEffort\|effectiveEffort\|validateModelSelection"` HEAD 面现读 **0 命中** ⇒ 静默降档无法归因。**为什么还开着**:新建"配置分层解析出口"属 §24 新增能力、且是跨端数据建模,不在本轮取证范围;上游那两格(`effective-model-selection.ts` 的 `selectionIssue` 六值枚举、`model-selection-config.ts:76-77`"不能静默补档位")是它的前置形状,可作参考实现但不是本轮交付物。 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「G-356」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10900(L1 外部持有行 L7605):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7695(G-397) 同题,派单以持有行为准,本行不再单独派单。〕 G-358 **锁的"租约认 token 不认 pid"一格只登记、未代裁(归属:`git-lock`/`deploy-lock` 持有人)** —— 上游 `packages/provider-node/src/zcode-builtin-remote-synchronizer.ts:85` 取 `leaseId=randomUUID`、`:143` 的 `#finishLease` 只在 leaseId 相等时才改控制文件,于是"pid 被系统复用"这一型**结构上不可能发生**;而我方是事后补的一环(`scripts/lib/proc-identity.mjs` 的 match/mismatch/unverifiable,承 G-193 那次冻结 11h50m)。**为什么还开着**:改两处锁的 meta 属锁持有人领地,且今天没有可复现的抢占现场做验收依据;真要收它,判据应是"注入一次 leaseId 不相等的迟到 finish 请求,控制文件必须不被改动",而不是"代码写了 leaseId"。 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「G-358」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10901(L1 外部持有行 L7606):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7696(G-398) 同题,派单以持有行为准,本行不再单独派单。〕 G-359 **第八轮剩余六格候选清单(归属:未派;等各线排期;本轮只取证未实现,逐格带出处)** —— ① 跨层发布闸:上游 `registry-service.ts:205-212` 在"下层已变而上层仍基于旧事实"时**不发混合快照**、继续服务上一份完整 Registry,而我方这条纪律只活在门的散文里、运行时层无出口;② 稀疏 overlay 空即删:`config-service.ts:513-516` 与继承值等价的配置不落盘(absence=继承,不是"空覆盖");③ 诊断量代替原文:`officialMcpCredentials.ts:52-90/359-376` 只记 JWT 剩余秒数并按小时分桶去重,可接我方唯一脱敏出口 `packages/shared/src/utils/redact.ts`;④ 告警去重身份=桶+周期而非墙钟窗口:`startPlanQuotaReminderStore.ts:33-36` 用快照 `referenceTime` 裁决(设备时间可能已越过服务端周期)、`bucketReminderKey` 缺任一字段即不提醒;⑤ in-flight 合并 + CAS 驱逐:`zaiStartPlanBilling.ts:113-122` 失败响应同样保留 1s(防 429 后立刻重复请求)且驱逐前 `if (requests.get(k) !== request) return`(旧请求不得删新记录),上游该守卫三处同形,是我方共享工作区并发写可直接取用的最小实现;⑥ 幂等 key 复用规则:`codingPlanQuotaResetCoordinator.ts:307-329` 瞬时错复用原 key、成功或稳定错才置 null,且服务端 `next_try_at` 必须透传(:617-624)。**为什么还开着**:六格都是"能落但需各自定级与验收"的独立改动(①②碰运行时快照语义、③④⑤⑥碰告警与并发路径),打包成一票会互相遮蔽;派单时逐格取,勿一次全接。**另有一格需产品先定**:上游 `usage-quota.ts:71` 的 `percentage` 是**已用**占比、而 Start Plan 侧 `:1338` 同名字段是**剩余/总额**,现靠"两族走不同 reader"规避,**无类型或判据看守** —— 要不要收口成"以 remaining 为权威、percentage 仅降级",属契约决策。 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「G-359」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10907(L1 外部持有行 L15835):

```
- [ ] **D128 AI 对话链路四竞品对标 V4 收口线(19 条差距 / 5 个 Sprint)** —— 唯一入口 `docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`(87–105),本轮不在此复述差距正文,只登记排期与等待项。**S9 尺子先行(105→97)**:先落 `scripts/audit-benchmark-delivery.mjs`(V3 §八 自留建议至今未落地,`ls` 实测不存在)与 parity 门六端扩面,**顺序不可颠倒** —— #93/#94/#96 之所以能长期存在,正是因为 §9「多端连通」的机器判据只覆盖 web 一端(`check-agent-event-parity.mjs:537` 只扫 `apps/web/src`)。**S10 移动端可达性(93→94→95)**:RN 主屏 `apps/mobile-rn/src/screens/ChatScreen.tsx:652` 起只接 7/30 回调(逐名 `comm -23` 算出缺 23 个,含 `onToolCall`/`onToolApproval`/`onPlanUpdate`/`onTerminal*`/`onSubagent*`/`onUsage`/`onBudget`/`onQuestion`/`onFormRequest`/`onReconnect`),而同端 `AiAssistantN8nScreen.tsx:1412` 是完整实现、`src/utils/chat-render-model.ts` 的 4 个 `apply*` 在主屏零调用方 ⇒ 本票主体是**接线不是开发**;#94 是信任型缺陷(RN 与小程序 `tool-approval` 双零命中,手机上遇高危操作无弹窗)。**S11 保真(87→88→89→92)**、**S12 契约地基(99→100→101→102)**、**S13 传输计量收口(96→90→91→103→98)**。**等待项(归属:等用户拍板)**:#100 内置默认高危集**改变默认行为**(现 `_high_risk_tools_from_env` 未配 env 即 `frozenset()`,`agent_loop_v2.py:288-296`),按 §24 不得由实现票自行开工;#98 桌面端薄壳是 V3 #72 已拍板架构,本票**只对齐三处口径**(tauri.conf / `ensure-web-out.mjs` 自称唯一校验点 / `docs/MULTI_END.md §2.5`),不改选型。**解阻前置(可判)**:S10 之前必须先有 S9 的端能力档案表,否则清完的端下轮又漏。**本轮同时否证 7 条断言,均写进 V4 正文,不得照旧文派单**:①②③ 上述三条 V3 过期结论;④ `packages/app` 的 `ChatScreen` 并非「未导出」—— `src/index.ts:684` 导出在位,真问题是**全仓零消费方**(同包其它 4 个聊天屏都被 mobile-rn 复用)⇒ 归 #95;⑤ web **有**消息队列与 Steer(`queue-interaction-bar.tsx` 在库,D38 已✅)⇒ 队列**不是**差距,初稿列错了;⑥ #89 初稿「主聊天流无自动重连」**否证** —— api-client `client.ts:2078/2129/3443` 有重连与 `Last-Event-ID` 续传,web `send-message.ts:767-775` 已消费 `onReconnect`,缺陷窄化为「`connection-status.tsx` 四态件生产面零挂载(命中全在 `apps/web/tests/agent-task-progress-pane.test.tsx`) + 重连后待决审批恢复未取证」;#96 那句「web 反而没有续传」同批否证;⑦ 孤儿清单里的 `voice-note.tsx` 在 HEAD 与索引双双落空,只在工作树未跟踪面 ⇒ 摘出清单、按 §12 归属未定不动。**本轮交付**:V4 文档成文并注水印(`docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`,`watermark.mjs verify` 覆盖 1/1、残迹 0、损坏 0);六端回调覆盖数改用统一交集判据重算(web 全域 30/30、extension 19、cli 12、RN 主屏 7、RN 另一屏 17、miniapp 17),并登记「事件名口径 23 与回调名口径 17 不可混用」。**待办本体是 S9–S13 的实施,本行不因文档成文而翻勾。****本轮同时更正 3 条 V3 过期结论,不得照它们派单**:#73「小程序无 AI 对话页」已被代码推翻(`apps/miniapp-taro/src/pkg-ai/ai/chat.tsx` 1623 行,最新提交 `3f3e71a99` 09-27,按事件名覆盖 23/30);#51「`run_in_background` 只有 sleep/echo」已不成立(`task_executors.py` 现读 16 个 `async def` + import 期三面断言);#47「三套执行内核」应为「一套半」(`class AgentLoopV2` 唯一内核,但 `agent_loop.py` 仍以 `agent_executor` 被 `routers/agents.py:48`、`services/a2a_service.py:33`、`services/slash_commands.py:162` 三处生产引用)。 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「D128 · AI对话链路四竞品对标V4收口线」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10909(L1 外部持有行 L15711):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘③):指针后残留编号声明位摘除,同题持有行见「第十一批」让号新号行,正文逐字保留。〕**第十一批:沙箱默认严档落地 + 两路只读取证的 24 条发现落成可执行票(每条带落点与验收判据)** (原编号 G-603;持有行题面「第十一批」)
```

- 原 L10910(L1 外部持有行 L15711):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-608 **第十一批:沙箱默认严档落地 + 两路只读取证的 24 条发现落成可执行票(每条带落点与验收判据)** (原编号 G-608;持有行题面「第十一批」)
```

- 原 L10914(L1 外部持有行 L7654):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7745(G-681) 同题,派单以持有行为准,本行不再单独派单。〕 G-681 **F9 基线层把"别人跳门塞进 HEAD 的存量"记在每个碰台账的人头上 —— 同一轮里差值档已判绿而基线档仍红(2026-09-29 现读;归属:台账判据线;补丁三处已量好,落点唯一)**:现读 `node scripts/plan-tasks.mjs --staged --gate` 先打 `✅ 差值棘轮:相对 HEAD,本次提交未新增状态分叉(F1=0 F2=0 F3=0 F4=0 F4b=0 F6=0 F8=0 F9=72)`,紧接着打 `❌ 基线棘轮:F9 撞号:出现基线键集里没有的编号 …(共 31 组)`。被拦的人**一个撞号都没造**,却要为自己的提交绕钩子 —— 一次绕过约等于其余全部对账对该提交作废(§12e/§12f 同型,而这一台是**每次碰台账都响**)。**只改归属、不改强度**:基线层的 F9 那一项在手里有差值基准面(HEAD 面)时,只认"基线缺 ∧ HEAD 也没有"的键;其余键**打印出来**(`ℹ F9 基线缺项 N 组此刻已在 HEAD 面 ⇒ 不记在本次提交头上`,静默等于放行)而不判红;全量问责档**不过滤** ⇒ 存量照旧红、逐组名单照旧给;`--update-baseline` 仍只许收窄。落点三处,都在 `scripts/plan-tasks.mjs`:① `gate()` 里 `const f9b = f9Ratchet(base, a)` 之后算 `f9HeadKeys / f9Attributed / f9Stock` 并打印那行 ℹ;② `const vsBase = ratchetViolations(base, items, a)` 在 `before` 在位时改传按归属过滤后的面(`{ ...a, collisions: (a.collisions ?? []).filter((g) => attributed.includes(g.key)) }`,**不改** `ratchetViolations` 的签名 —— 两参调用方 `git-sync-converge` 的文案与判序必须逐字不变,那是镜像 M20 钉着的);③ `const addedKeys = … f9b.added` 换成归属后的集合。两条反向锁必须同批写,且都用**纯函数 + 构造面**(不得依赖仓库瞬时状态 —— 守门 103 T12 那一课,也是本票立项时 M20 硬写 `涨到 71` 而基线今天 73 枚那一型的正解):A)同一份"存量键在 HEAD 已有、基线没有"的面,`--staged` 档必须绿而全量档必须红;B)差值基准面没带逐组明细 ⇒ 判"未判定"(exit 2),既不冒红也不记绿。**为什么本票不当场落(阻塞主体,不是遗漏)**:`scripts/plan-tasks.mjs` 此刻**三面分歧** —— HEAD 那份刚由并发会话落了"编号位收窄"(`auditFace`/`registersKeyAtIdPosition`,镜像 `plan-tasks-f9.test.mjs` 10/10 已绿),索引那份是某会话 staged 的 1378 行**旧基线**(相对 HEAD 净删 182 行、且不含收窄),工作树第三份是同一旧基线现场并夹着他人未提交改动;按 §12"判据文件他人持有就只登记不代改",本会话不写第四份,也不按 pathspec 交它。**解阻前置(可判)**:该路径三面归一(索引那份由持有人提交,或按 HEAD 底稿重做),然后按上面三处落并补两条反向锁。同批已单独落地的另一半:`scripts/tests/plan-tasks.test.mjs` 的 M20 不再把 `BASE_KEYS.length`(现读自基线文件)硬写成 71 ⇒ 基线每被人工刷一次就恒红的那一格已闭(镜像 30/30 在 HEAD 码面上复验)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-681」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10921(L1 外部持有行 L15670):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11120(G-393) 同题,派单以持有行为准,本行不再单独派单。〕 G-762 **门 33 的 provider 名单该由谁供给(归属:守门 33 持有人;等人拍板)** —— 现读 7 个在 `.env` 的合法 provider 被判"未知",默认档只 warning 所以 rc 0。**为什么还开着**:config.py 的设计是"新增 provider 零代码改动、自动识别",而本门的名单是手抄副本;两种收口动作语义相反——① 把 7 个补进名单 = 继续养第二份真相,② 由 `.env`/服务端能力清单单向投影 = 改一道 blocking 门的判据。必须先定"这份名单到底要不要存在"。**不得**为让 warning 归零去删判据或放宽规则 3。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `G-G-354`(族名在编号段出现两次)。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 G-354 已被 9 行认领(L8272,8527,8617,8644…),改回就等于替这本账再加一枚撞号;现号 `G-762`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-762」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10922(L1 外部持有行 L15579):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7765(G-763) 同题,派单以持有行为准,本行不再单独派单。〕 G-763 **MemberCard 把"没量到"显示成 0(第八轮对照逼出;归属:web 首页持有者;等 §17 运行时自验排期)** —— `apps/web/src/components/home/MemberCard.tsx:72-73` 现读 `stats?.points ?? 0` / `wallet?.balance ?? 0`,查询未回或失败时显示"0 分""0 余额"。上游同族口径是"订阅未知不能发布为成功空快照"(`packages/services/src/usage-stats/providers/bigmodelUsageQuotaProvider.ts:259` 原文)加展示层 `'--'` 占位。**为什么还开着**:属 UI 改动,§17 要求起 dev + 读 DOM 数值自验,本票未做该项;改法是 `number | null` + 占位,不动判据、无恒红风险。**这一条不是"抄上游功能",是把"未知"与"为零"分开** —— 后者是数据事故,前者是显示诚实。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `G-G-355`(族名在编号段出现两次)。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 G-355 已被 9 行认领(L8273,8528,8618,8645…),改回就等于替这本账再加一枚撞号;现号 `G-763`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-763」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10923(L1 外部持有行 L7603):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7693(G-395) 同题,派单以持有行为准,本行不再单独派单。〕 G-764 **配置分层的"出处标签"与"请求档 vs 实得档"留痕(归属:cli/子代理线持有人;等产品拍板)** —— 上游 `packages/provider/src/resolver.ts:190/196/208` 三层 overlay 且每个生效对象带 `source` 标签、快照的 `sourceRevisions` 被真实消费;我方 `apps/cli/src/subagents/precedence.ts:195-205` 的四层短路链**没有出处标签**,且 `git grep -I "requestedEffort\|effectiveEffort\|validateModelSelection"` HEAD 面现读 **0 命中** ⇒ 静默降档无法归因。**为什么还开着**:新建"配置分层解析出口"属 §24 新增能力、且是跨端数据建模,不在本轮取证范围;上游那两格(`effective-model-selection.ts` 的 `selectionIssue` 六值枚举、`model-selection-config.ts:76-77`"不能静默补档位")是它的前置形状,可作参考实现但不是本轮交付物。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `G-G-356`(族名在编号段出现两次)。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 G-356 已被 9 行认领(L8274,8529,8619,8646…),改回就等于替这本账再加一枚撞号;现号 `G-764`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-764」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10927(L1 外部持有行 L7605):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7695(G-397) 同题,派单以持有行为准,本行不再单独派单。〕 G-766 **锁的"租约认 token 不认 pid"一格只登记、未代裁(归属:`git-lock`/`deploy-lock` 持有人)** —— 上游 `packages/provider-node/src/zcode-builtin-remote-synchronizer.ts:85` 取 `leaseId=randomUUID`、`:143` 的 `#finishLease` 只在 leaseId 相等时才改控制文件,于是"pid 被系统复用"这一型**结构上不可能发生**;而我方是事后补的一环(`scripts/lib/proc-identity.mjs` 的 match/mismatch/unverifiable,承 G-193 那次冻结 11h50m)。**为什么还开着**:改两处锁的 meta 属锁持有人领地,且今天没有可复现的抢占现场做验收依据;真要收它,判据应是"注入一次 leaseId 不相等的迟到 finish 请求,控制文件必须不被改动",而不是"代码写了 leaseId"。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `G-G-358`(族名在编号段出现两次)。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 G-358 已被 9 行认领(L8276,8531,8621,8648…),改回就等于替这本账再加一枚撞号;现号 `G-766`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-766」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10928(L1 外部持有行 L7606):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7696(G-398) 同题,派单以持有行为准,本行不再单独派单。〕 G-767 **第八轮剩余六格候选清单(归属:未派;等各线排期;本轮只取证未实现,逐格带出处)** —— ① 跨层发布闸:上游 `registry-service.ts:205-212` 在"下层已变而上层仍基于旧事实"时**不发混合快照**、继续服务上一份完整 Registry,而我方这条纪律只活在门的散文里、运行时层无出口;② 稀疏 overlay 空即删:`config-service.ts:513-516` 与继承值等价的配置不落盘(absence=继承,不是"空覆盖");③ 诊断量代替原文:`officialMcpCredentials.ts:52-90/359-376` 只记 JWT 剩余秒数并按小时分桶去重,可接我方唯一脱敏出口 `packages/shared/src/utils/redact.ts`;④ 告警去重身份=桶+周期而非墙钟窗口:`startPlanQuotaReminderStore.ts:33-36` 用快照 `referenceTime` 裁决(设备时间可能已越过服务端周期)、`bucketReminderKey` 缺任一字段即不提醒;⑤ in-flight 合并 + CAS 驱逐:`zaiStartPlanBilling.ts:113-122` 失败响应同样保留 1s(防 429 后立刻重复请求)且驱逐前 `if (requests.get(k) !== request) return`(旧请求不得删新记录),上游该守卫三处同形,是我方共享工作区并发写可直接取用的最小实现;⑥ 幂等 key 复用规则:`codingPlanQuotaResetCoordinator.ts:307-329` 瞬时错复用原 key、成功或稳定错才置 null,且服务端 `next_try_at` 必须透传(:617-624)。**为什么还开着**:六格都是"能落但需各自定级与验收"的独立改动(①②碰运行时快照语义、③④⑤⑥碰告警与并发路径),打包成一票会互相遮蔽;派单时逐格取,勿一次全接。**另有一格需产品先定**:上游 `usage-quota.ts:71` 的 `percentage` 是**已用**占比、而 Start Plan 侧 `:1338` 同名字段是**剩余/总额**,现靠"两族走不同 reader"规避,**无类型或判据看守** —— 要不要收口成"以 remaining 为权威、percentage 仅降级",属契约决策。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `G-G-359`(族名在编号段出现两次)。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 G-359 已被 9 行认领(L8277,8532,8622,8649…),改回就等于替这本账再加一枚撞号;现号 `G-767`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-767」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10929(L1 外部持有行 L7608):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7698(G-402) 同题,派单以持有行为准,本行不再单独派单。〕 G-769 **设置项"显式清空"与"从未设置"无差，且读侧同一含义两键相反（需拍板；归属：api 设置面 + web 设置页持有人）** —— 已亲自复验：`apps/api/src/routes/user/settings-routes.ts:55` 写体是 `z.record(z.string(), z.unknown())`，落库处 `value === null || value === undefined ? null : String(value)` ⇒ `null` 与"缺席"存成同一个 NULL 行；读侧 `apps/web/app/(main)/settings/notifications/page.tsx:48-52` 四键混用 `!== 'false'`（默认真）与 `=== 'true'`（默认假），于是**同一个被清空的值，在前一族读回 true、在后一族读回 false**。上游同族做法是把三态写进契约（`settings/pluginConfigPatch.ts:29-36`：`undefined`=未触碰跳过、`null`=进 `clearOptionKeys`、sensitive 空串=不改已有值；落库侧 `file-config.adapter.ts:557-565` 按 option key 合并而非整对象替换，防同 scope 密钥被静默清空）。**为什么还开着**：改成三态要动 PUT 语义（单键 DELETE 出口我方根本没有——`deleteUserPreference` 只服务 devices），属对外契约决策；先拍"要不要有删键出口"，再谈读侧归一。**不得**靠"读侧统一成 `=== 'true'`"消红——那会把默认真的四项静默翻转。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `G-G-374`(族名在编号段出现两次)。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 G-374 已被 20 行认领(L7676,7851,7925,8152…),改回就等于替这本账再加一枚撞号;现号 `G-769`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-769」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10931(L1 外部持有行 L15701):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘):本行已让号至 G-210(持行在面),merge 回流旧态摘号留指针,正文逐字保留。〕**台账 F4(重复登记副本)对"同一待办的漂移副本"结构上失明 —— 现读一例:同一条 D41后续① 在 HEAD 有 9 份未勾选副本、其中 7 份正文互不相同(2026-09-28 量)**: `plan-tasks.mjs` 的 F1/F4 判据是"编号 + 标题前缀**逐字等值**",这既是它的优点(不做相似度猜判)也是它的洞 —— 并发 union 每次都留一份**带自己注记**的副本,前缀之后的正文一漂移,复合主键就不再相等,于是同一件事以 N 份"未勾选"长期并存。后果不是账面难看而是**派单被放大 N 倍**:本日两次 `plan-tasks-merge.mjs --heal --commit`(归并 30 行 / 34 行)把 F1/F4 都归到 0,而这一族一份都没被动到 ⇒ "跑过归并"不等于"这一族被覆盖"。出路只有两条且都不该由机器代裁:① 归并线逐组判"哪份是当前状态"(需要读注记语义,机器判不了);② 给登记侧加一条硬约束——同一件事要更新就**就地改那一条**(§1 第 2 条已有此规矩,缺的是让机器能在前缀一致而正文漂移时也点名)。本票**只登记现读证据与两条出路**,不改判据、不批量翻勾(批量翻勾 = 把别人的注记当噪声删,比原病更响)。归属:分叉合并归并线(同 G-363 那条持有)。 (编号改派留痕(2026-09-28):本行原取 G-417,与「全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红」一条撞成一号两事;取号发生在分叉的两条腿上,号段不共享。让位的是**本行**(它是我这一路登记的),别人的行不动;新号由取号令牌按当次 CAS 的 HEAD 现算,落地后须复核它不与任何行首编号重复。正文一字未动。) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-417」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10933(L1 外部持有行 L15670):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11120(G-393) 同题,派单以持有行为准,本行不再单独派单。〕 G-354 **门 33 的 provider 名单该由谁供给(归属:守门 33 持有人;等人拍板)** —— 现读 7 个在 `.env` 的合法 provider 被判"未知",默认档只 warning 所以 rc 0。**为什么还开着**:config.py 的设计是"新增 provider 零代码改动、自动识别",而本门的名单是手抄副本;两种收口动作语义相反——① 把 7 个补进名单 = 继续养第二份真相,② 由 `.env`/服务端能力清单单向投影 = 改一道 blocking 门的判据。必须先定"这份名单到底要不要存在"。**不得**为让 warning 归零去删判据或放宽规则 3。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-354」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10934(L1 外部持有行 L15579):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7765(G-763) 同题,派单以持有行为准,本行不再单独派单。〕 G-355 **MemberCard 把"没量到"显示成 0(第八轮对照逼出;归属:web 首页持有者;等 §17 运行时自验排期)** —— `apps/web/src/components/home/MemberCard.tsx:72-73` 现读 `stats?.points ?? 0` / `wallet?.balance ?? 0`,查询未回或失败时显示"0 分""0 余额"。上游同族口径是"订阅未知不能发布为成功空快照"(`packages/services/src/usage-stats/providers/bigmodelUsageQuotaProvider.ts:259` 原文)加展示层 `'--'` 占位。**为什么还开着**:属 UI 改动,§17 要求起 dev + 读 DOM 数值自验,本票未做该项;改法是 `number | null` + 占位,不动判据、无恒红风险。**这一条不是"抄上游功能",是把"未知"与"为零"分开** —— 后者是数据事故,前者是显示诚实。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-355」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10935(L1 外部持有行 L7603):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7693(G-395) 同题,派单以持有行为准,本行不再单独派单。〕 G-356 **配置分层的"出处标签"与"请求档 vs 实得档"留痕(归属:cli/子代理线持有人;等产品拍板)** —— 上游 `packages/provider/src/resolver.ts:190/196/208` 三层 overlay 且每个生效对象带 `source` 标签、快照的 `sourceRevisions` 被真实消费;我方 `apps/cli/src/subagents/precedence.ts:195-205` 的四层短路链**没有出处标签**,且 `git grep -I "requestedEffort\|effectiveEffort\|validateModelSelection"` HEAD 面现读 **0 命中** ⇒ 静默降档无法归因。**为什么还开着**:新建"配置分层解析出口"属 §24 新增能力、且是跨端数据建模,不在本轮取证范围;上游那两格(`effective-model-selection.ts` 的 `selectionIssue` 六值枚举、`model-selection-config.ts:76-77`"不能静默补档位")是它的前置形状,可作参考实现但不是本轮交付物。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-356」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10937(L1 外部持有行 L7605):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7695(G-397) 同题,派单以持有行为准,本行不再单独派单。〕 G-358 **锁的"租约认 token 不认 pid"一格只登记、未代裁(归属:`git-lock`/`deploy-lock` 持有人)** —— 上游 `packages/provider-node/src/zcode-builtin-remote-synchronizer.ts:85` 取 `leaseId=randomUUID`、`:143` 的 `#finishLease` 只在 leaseId 相等时才改控制文件,于是"pid 被系统复用"这一型**结构上不可能发生**;而我方是事后补的一环(`scripts/lib/proc-identity.mjs` 的 match/mismatch/unverifiable,承 G-193 那次冻结 11h50m)。**为什么还开着**:改两处锁的 meta 属锁持有人领地,且今天没有可复现的抢占现场做验收依据;真要收它,判据应是"注入一次 leaseId 不相等的迟到 finish 请求,控制文件必须不被改动",而不是"代码写了 leaseId"。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-358」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10938(L1 外部持有行 L7606):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7696(G-398) 同题,派单以持有行为准,本行不再单独派单。〕 G-359 **第八轮剩余六格候选清单(归属:未派;等各线排期;本轮只取证未实现,逐格带出处)** —— ① 跨层发布闸:上游 `registry-service.ts:205-212` 在"下层已变而上层仍基于旧事实"时**不发混合快照**、继续服务上一份完整 Registry,而我方这条纪律只活在门的散文里、运行时层无出口;② 稀疏 overlay 空即删:`config-service.ts:513-516` 与继承值等价的配置不落盘(absence=继承,不是"空覆盖");③ 诊断量代替原文:`officialMcpCredentials.ts:52-90/359-376` 只记 JWT 剩余秒数并按小时分桶去重,可接我方唯一脱敏出口 `packages/shared/src/utils/redact.ts`;④ 告警去重身份=桶+周期而非墙钟窗口:`startPlanQuotaReminderStore.ts:33-36` 用快照 `referenceTime` 裁决(设备时间可能已越过服务端周期)、`bucketReminderKey` 缺任一字段即不提醒;⑤ in-flight 合并 + CAS 驱逐:`zaiStartPlanBilling.ts:113-122` 失败响应同样保留 1s(防 429 后立刻重复请求)且驱逐前 `if (requests.get(k) !== request) return`(旧请求不得删新记录),上游该守卫三处同形,是我方共享工作区并发写可直接取用的最小实现;⑥ 幂等 key 复用规则:`codingPlanQuotaResetCoordinator.ts:307-329` 瞬时错复用原 key、成功或稳定错才置 null,且服务端 `next_try_at` 必须透传(:617-624)。**为什么还开着**:六格都是"能落但需各自定级与验收"的独立改动(①②碰运行时快照语义、③④⑤⑥碰告警与并发路径),打包成一票会互相遮蔽;派单时逐格取,勿一次全接。**另有一格需产品先定**:上游 `usage-quota.ts:71` 的 `percentage` 是**已用**占比、而 Start Plan 侧 `:1338` 同名字段是**剩余/总额**,现靠"两族走不同 reader"规避,**无类型或判据看守** —— 要不要收口成"以 remaining 为权威、percentage 仅降级",属契约决策。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-359」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10939(L1 外部持有行 L15835):

```
- [ ] **D128 AI 对话链路四竞品对标 V4 收口线(19 条差距 / 5 个 Sprint)** —— 唯一入口 `docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`(87–105),本轮不在此复述差距正文,只登记排期与等待项。**S9 尺子先行(105→97)**:先落 `scripts/audit-benchmark-delivery.mjs`(V3 §八 自留建议至今未落地,`ls` 实测不存在)与 parity 门六端扩面,**顺序不可颠倒** —— #93/#94/#96 之所以能长期存在,正是因为 §9「多端连通」的机器判据只覆盖 web 一端(`check-agent-event-parity.mjs:537` 只扫 `apps/web/src`)。**S10 移动端可达性(93→94→95)**:RN 主屏 `apps/mobile-rn/src/screens/ChatScreen.tsx:652` 起只接 7/30 回调(逐名 `comm -23` 算出缺 23 个,含 `onToolCall`/`onToolApproval`/`onPlanUpdate`/`onTerminal*`/`onSubagent*`/`onUsage`/`onBudget`/`onQuestion`/`onFormRequest`/`onReconnect`),而同端 `AiAssistantN8nScreen.tsx:1412` 是完整实现、`src/utils/chat-render-model.ts` 的 4 个 `apply*` 在主屏零调用方 ⇒ 本票主体是**接线不是开发**;#94 是信任型缺陷(RN 与小程序 `tool-approval` 双零命中,手机上遇高危操作无弹窗)。**S11 保真(87→88→89→92)**、**S12 契约地基(99→100→101→102)**、**S13 传输计量收口(96→90→91→103→98)**。**等待项(归属:等用户拍板)**:#100 内置默认高危集**改变默认行为**(现 `_high_risk_tools_from_env` 未配 env 即 `frozenset()`,`agent_loop_v2.py:288-296`),按 §24 不得由实现票自行开工;#98 桌面端薄壳是 V3 #72 已拍板架构,本票**只对齐三处口径**(tauri.conf / `ensure-web-out.mjs` 自称唯一校验点 / `docs/MULTI_END.md §2.5`),不改选型。**解阻前置(可判)**:S10 之前必须先有 S9 的端能力档案表,否则清完的端下轮又漏。**本轮同时否证 7 条断言,均写进 V4 正文,不得照旧文派单**:①②③ 上述三条 V3 过期结论;④ `packages/app` 的 `ChatScreen` 并非「未导出」—— `src/index.ts:684` 导出在位,真问题是**全仓零消费方**(同包其它 4 个聊天屏都被 mobile-rn 复用)⇒ 归 #95;⑤ web **有**消息队列与 Steer(`queue-interaction-bar.tsx` 在库,D38 已✅)⇒ 队列**不是**差距,初稿列错了;⑥ #89 初稿「主聊天流无自动重连」**否证** —— api-client `client.ts:2078/2129/3443` 有重连与 `Last-Event-ID` 续传,web `send-message.ts:767-775` 已消费 `onReconnect`,缺陷窄化为「`connection-status.tsx` 四态件生产面零挂载(命中全在 `apps/web/tests/agent-task-progress-pane.test.tsx`) + 重连后待决审批恢复未取证」;#96 那句「web 反而没有续传」同批否证;⑦ 孤儿清单里的 `voice-note.tsx` 在 HEAD 与索引双双落空,只在工作树未跟踪面 ⇒ 摘出清单、按 §12 归属未定不动。**本轮交付**:V4 文档成文并注水印(`docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`,`watermark.mjs verify` 覆盖 1/1、残迹 0、损坏 0);六端回调覆盖数改用统一交集判据重算(web 全域 30/30、extension 19、cli 12、RN 主屏 7、RN 另一屏 17、miniapp 17),并登记「事件名口径 23 与回调名口径 17 不可混用」。**待办本体是 S9–S13 的实施,本行不因文档成文而翻勾。****本轮同时更正 3 条 V3 过期结论,不得照它们派单**:#73「小程序无 AI 对话页」已被代码推翻(`apps/miniapp-taro/src/pkg-ai/ai/chat.tsx` 1623 行,最新提交 `3f3e71a99` 09-27,按事件名覆盖 23/30);#51「`run_in_background` 只有 sleep/echo」已不成立(`task_executors.py` 现读 16 个 `async def` + import 期三面断言);#47「三套执行内核」应为「一套半」(`class AgentLoopV2` 唯一内核,但 `agent_loop.py` 仍以 `agent_executor` 被 `routers/agents.py:48`、`services/a2a_service.py:33`、`services/slash_commands.py:162` 三处生产引用)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「D128」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10940(L1 外部持有行 L7608):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7698(G-402) 同题,派单以持有行为准,本行不再单独派单。〕 G-813374 **设置项"显式清空"与"从未设置"无差，且读侧同一含义两键相反（需拍板；归属：api 设置面 + web 设置页持有人）** —— 已亲自复验：`apps/api/src/routes/user/settings-routes.ts:55` 写体是 `z.record(z.string(), z.unknown())`，落库处 `value === null || value === undefined ? null : String(value)` ⇒ `null` 与"缺席"存成同一个 NULL 行；读侧 `apps/web/app/(main)/settings/notifications/page.tsx:48-52` 四键混用 `!== 'false'`（默认真）与 `=== 'true'`（默认假），于是**同一个被清空的值，在前一族读回 true、在后一族读回 false**。上游同族做法是把三态写进契约（`settings/pluginConfigPatch.ts:29-36`：`undefined`=未触碰跳过、`null`=进 `clearOptionKeys`、sensitive 空串=不改已有值；落库侧 `file-config.adapter.ts:557-565` 按 option key 合并而非整对象替换，防同 scope 密钥被静默清空）。**为什么还开着**：改成三态要动 PUT 语义（单键 DELETE 出口我方根本没有——`deleteUserPreference` 只服务 devices），属对外契约决策；先拍"要不要有删键出口"，再谈读侧归一。**不得**靠"读侧统一成 `=== 'true'`"消红——那会把默认真的四项静默翻转。〔2026-09-29 改号(承 D168 第四遍收尾):剥掉双前缀后本行会与既有 **G-374**(标题「G-374ihui-auth-user里存了is」)**同主键 —— 那不是畸形号而是**真撞号**,所以这里不剥前缀而是取当次空闲新号;原编号位写的是「G-G-」。〕 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-813374」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10944(L1 外部持有行 L15670):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11120(G-393) 同题,派单以持有行为准,本行不再单独派单。〕 G-354 **门 33 的 provider 名单该由谁供给(归属:守门 33 持有人;等人拍板)** —— 现读 7 个在 `.env` 的合法 provider 被判"未知",默认档只 warning 所以 rc 0。**为什么还开着**:config.py 的设计是"新增 provider 零代码改动、自动识别",而本门的名单是手抄副本;两种收口动作语义相反——① 把 7 个补进名单 = 继续养第二份真相,② 由 `.env`/服务端能力清单单向投影 = 改一道 blocking 门的判据。必须先定"这份名单到底要不要存在"。**不得**为让 warning 归零去删判据或放宽规则 3。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-354 · G-G-354门33的provider名单该由谁」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10945(L1 外部持有行 L15579):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7765(G-763) 同题,派单以持有行为准,本行不再单独派单。〕 G-355 **MemberCard 把"没量到"显示成 0(第八轮对照逼出;归属:web 首页持有者;等 §17 运行时自验排期)** —— `apps/web/src/components/home/MemberCard.tsx:72-73` 现读 `stats?.points ?? 0` / `wallet?.balance ?? 0`,查询未回或失败时显示"0 分""0 余额"。上游同族口径是"订阅未知不能发布为成功空快照"(`packages/services/src/usage-stats/providers/bigmodelUsageQuotaProvider.ts:259` 原文)加展示层 `'--'` 占位。**为什么还开着**:属 UI 改动,§17 要求起 dev + 读 DOM 数值自验,本票未做该项;改法是 `number | null` + 占位,不动判据、无恒红风险。**这一条不是"抄上游功能",是把"未知"与"为零"分开** —— 后者是数据事故,前者是显示诚实。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-355 · G-G-355MemberCard把"没量到"显」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10946(L1 外部持有行 L7603):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7693(G-395) 同题,派单以持有行为准,本行不再单独派单。〕 G-356 **配置分层的"出处标签"与"请求档 vs 实得档"留痕(归属:cli/子代理线持有人;等产品拍板)** —— 上游 `packages/provider/src/resolver.ts:190/196/208` 三层 overlay 且每个生效对象带 `source` 标签、快照的 `sourceRevisions` 被真实消费;我方 `apps/cli/src/subagents/precedence.ts:195-205` 的四层短路链**没有出处标签**,且 `git grep -I "requestedEffort\|effectiveEffort\|validateModelSelection"` HEAD 面现读 **0 命中** ⇒ 静默降档无法归因。**为什么还开着**:新建"配置分层解析出口"属 §24 新增能力、且是跨端数据建模,不在本轮取证范围;上游那两格(`effective-model-selection.ts` 的 `selectionIssue` 六值枚举、`model-selection-config.ts:76-77`"不能静默补档位")是它的前置形状,可作参考实现但不是本轮交付物。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-356 · G-G-356配置分层的"出处标签"与"请求档v」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10948(L1 外部持有行 L7605):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7695(G-397) 同题,派单以持有行为准,本行不再单独派单。〕 G-358 **锁的"租约认 token 不认 pid"一格只登记、未代裁(归属:`git-lock`/`deploy-lock` 持有人)** —— 上游 `packages/provider-node/src/zcode-builtin-remote-synchronizer.ts:85` 取 `leaseId=randomUUID`、`:143` 的 `#finishLease` 只在 leaseId 相等时才改控制文件,于是"pid 被系统复用"这一型**结构上不可能发生**;而我方是事后补的一环(`scripts/lib/proc-identity.mjs` 的 match/mismatch/unverifiable,承 G-193 那次冻结 11h50m)。**为什么还开着**:改两处锁的 meta 属锁持有人领地,且今天没有可复现的抢占现场做验收依据;真要收它,判据应是"注入一次 leaseId 不相等的迟到 finish 请求,控制文件必须不被改动",而不是"代码写了 leaseId"。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-358 · G-G-358锁的"租约认token不认pid"」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10949(L1 外部持有行 L7606):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7696(G-398) 同题,派单以持有行为准,本行不再单独派单。〕 G-359 **第八轮剩余六格候选清单(归属:未派;等各线排期;本轮只取证未实现,逐格带出处)** —— ① 跨层发布闸:上游 `registry-service.ts:205-212` 在"下层已变而上层仍基于旧事实"时**不发混合快照**、继续服务上一份完整 Registry,而我方这条纪律只活在门的散文里、运行时层无出口;② 稀疏 overlay 空即删:`config-service.ts:513-516` 与继承值等价的配置不落盘(absence=继承,不是"空覆盖");③ 诊断量代替原文:`officialMcpCredentials.ts:52-90/359-376` 只记 JWT 剩余秒数并按小时分桶去重,可接我方唯一脱敏出口 `packages/shared/src/utils/redact.ts`;④ 告警去重身份=桶+周期而非墙钟窗口:`startPlanQuotaReminderStore.ts:33-36` 用快照 `referenceTime` 裁决(设备时间可能已越过服务端周期)、`bucketReminderKey` 缺任一字段即不提醒;⑤ in-flight 合并 + CAS 驱逐:`zaiStartPlanBilling.ts:113-122` 失败响应同样保留 1s(防 429 后立刻重复请求)且驱逐前 `if (requests.get(k) !== request) return`(旧请求不得删新记录),上游该守卫三处同形,是我方共享工作区并发写可直接取用的最小实现;⑥ 幂等 key 复用规则:`codingPlanQuotaResetCoordinator.ts:307-329` 瞬时错复用原 key、成功或稳定错才置 null,且服务端 `next_try_at` 必须透传(:617-624)。**为什么还开着**:六格都是"能落但需各自定级与验收"的独立改动(①②碰运行时快照语义、③④⑤⑥碰告警与并发路径),打包成一票会互相遮蔽;派单时逐格取,勿一次全接。**另有一格需产品先定**:上游 `usage-quota.ts:71` 的 `percentage` 是**已用**占比、而 Start Plan 侧 `:1338` 同名字段是**剩余/总额**,现靠"两族走不同 reader"规避,**无类型或判据看守** —— 要不要收口成"以 remaining 为权威、percentage 仅降级",属契约决策。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-359 · G-G-359第八轮剩余六格候选清单」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10950(L1 外部持有行 L15835):

```
- [ ] **D128 AI 对话链路四竞品对标 V4 收口线(19 条差距 / 5 个 Sprint)** —— 唯一入口 `docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`(87–105),本轮不在此复述差距正文,只登记排期与等待项。**S9 尺子先行(105→97)**:先落 `scripts/audit-benchmark-delivery.mjs`(V3 §八 自留建议至今未落地,`ls` 实测不存在)与 parity 门六端扩面,**顺序不可颠倒** —— #93/#94/#96 之所以能长期存在,正是因为 §9「多端连通」的机器判据只覆盖 web 一端(`check-agent-event-parity.mjs:537` 只扫 `apps/web/src`)。**S10 移动端可达性(93→94→95)**:RN 主屏 `apps/mobile-rn/src/screens/ChatScreen.tsx:652` 起只接 7/30 回调(逐名 `comm -23` 算出缺 23 个,含 `onToolCall`/`onToolApproval`/`onPlanUpdate`/`onTerminal*`/`onSubagent*`/`onUsage`/`onBudget`/`onQuestion`/`onFormRequest`/`onReconnect`),而同端 `AiAssistantN8nScreen.tsx:1412` 是完整实现、`src/utils/chat-render-model.ts` 的 4 个 `apply*` 在主屏零调用方 ⇒ 本票主体是**接线不是开发**;#94 是信任型缺陷(RN 与小程序 `tool-approval` 双零命中,手机上遇高危操作无弹窗)。**S11 保真(87→88→89→92)**、**S12 契约地基(99→100→101→102)**、**S13 传输计量收口(96→90→91→103→98)**。**等待项(归属:等用户拍板)**:#100 内置默认高危集**改变默认行为**(现 `_high_risk_tools_from_env` 未配 env 即 `frozenset()`,`agent_loop_v2.py:288-296`),按 §24 不得由实现票自行开工;#98 桌面端薄壳是 V3 #72 已拍板架构,本票**只对齐三处口径**(tauri.conf / `ensure-web-out.mjs` 自称唯一校验点 / `docs/MULTI_END.md §2.5`),不改选型。**解阻前置(可判)**:S10 之前必须先有 S9 的端能力档案表,否则清完的端下轮又漏。**本轮同时否证 7 条断言,均写进 V4 正文,不得照旧文派单**:①②③ 上述三条 V3 过期结论;④ `packages/app` 的 `ChatScreen` 并非「未导出」—— `src/index.ts:684` 导出在位,真问题是**全仓零消费方**(同包其它 4 个聊天屏都被 mobile-rn 复用)⇒ 归 #95;⑤ web **有**消息队列与 Steer(`queue-interaction-bar.tsx` 在库,D38 已✅)⇒ 队列**不是**差距,初稿列错了;⑥ #89 初稿「主聊天流无自动重连」**否证** —— api-client `client.ts:2078/2129/3443` 有重连与 `Last-Event-ID` 续传,web `send-message.ts:767-775` 已消费 `onReconnect`,缺陷窄化为「`connection-status.tsx` 四态件生产面零挂载(命中全在 `apps/web/tests/agent-task-progress-pane.test.tsx`) + 重连后待决审批恢复未取证」;#96 那句「web 反而没有续传」同批否证;⑦ 孤儿清单里的 `voice-note.tsx` 在 HEAD 与索引双双落空,只在工作树未跟踪面 ⇒ 摘出清单、按 §12 归属未定不动。**本轮交付**:V4 文档成文并注水印(`docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`,`watermark.mjs verify` 覆盖 1/1、残迹 0、损坏 0);六端回调覆盖数改用统一交集判据重算(web 全域 30/30、extension 19、cli 12、RN 主屏 7、RN 另一屏 17、miniapp 17),并登记「事件名口径 23 与回调名口径 17 不可混用」。**待办本体是 S9–S13 的实施,本行不因文档成文而翻勾。****本轮同时更正 3 条 V3 过期结论,不得照它们派单**:#73「小程序无 AI 对话页」已被代码推翻(`apps/miniapp-taro/src/pkg-ai/ai/chat.tsx` 1623 行,最新提交 `3f3e71a99` 09-27,按事件名覆盖 23/30);#51「`run_in_background` 只有 sleep/echo」已不成立(`task_executors.py` 现读 16 个 `async def` + import 期三面断言);#47「三套执行内核」应为「一套半」(`class AgentLoopV2` 唯一内核,但 `agent_loop.py` 仍以 `agent_executor` 被 `routers/agents.py:48`、`services/a2a_service.py:33`、`services/slash_commands.py:162` 三处生产引用)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「D128 · DD128AI对话链路四竞品对标V4收口线」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10958(L1 外部持有行 L8018):

```
- [ ] 47. 三套执行内核工具集归一(A/B/C → 唯一工具注册表 `mcp_server._TOOLS`;AgentEngine 15 个工具映射或移植;JSON-RPC 只留协议适配层;CI parity 断言 `BUILTIN_ENGINE_TOOLS` ⊆ `_TOOLS` 映射完整) 〔PROGRESS 2026-09-27(五路并行第一波,ab4fed16d 前一枚):已落 J11/J14 两面 + 引擎内置名经 `resolve_engine_tool` 归口(归口在 `_ADMIN_ONLY_TOOLS` 判定之前,否则 unified_exec 这类名字会绕过角色矩阵)。实测 `BUILTIN_ENGINE_TOOLS` 是 **14 枚不是票面的 15**。**未闭环**:第三格「JSON-RPC 只留协议适配层」未做 —— agent_engine 的 RPC 面仍自带工具定义。票保持未勾。〕 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记已随归档搬至 .ihui-agent/archive/PROJECT_PLAN_2026-09-28_auto-archive.md 的条目 「47 · 三套执行内核工具集归一」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10959(L2 族内归并,保留 L10792):

```
- [ ] 82. Predictive Edit(对标 Trae CUE 的独立编辑意图预测器,现有 FIM 链路上升级) 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记已随归档搬至 .ihui-agent/archive/PROJECT_PLAN_2026-09-28_auto-archive.md 的条目 「82 · PredictiveEdit」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10960(L1 外部持有行 L8018):

```
- [ ] 47. 三套执行内核工具集归一(A/B/C → 唯一工具注册表 `mcp_server._TOOLS`;AgentEngine 15 个工具映射或移植;JSON-RPC 只留协议适配层;CI parity 断言 `BUILTIN_ENGINE_TOOLS` ⊆ `_TOOLS` 映射完整) 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记已随归档搬至 .ihui-agent/archive/PROJECT_PLAN_2026-09-28_auto-archive.md 的条目 「47 · 三套执行内核工具集归一」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10961(L2 族内归并,保留 L10792):

```
- [ ]82. Predictive Edit(对标 Trae CUE 的独立编辑意图预测器,现有 FIM 链路上升级) 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记已随归档搬至 .ihui-agent/archive/PROJECT_PLAN_2026-09-28_auto-archive.md 的条目 「82 · PredictiveEdit」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10962(L1 外部持有行 L9982):

```
- [ ] **D35 长会话分页投影与增量回放(G-59)**:对标 Codex `thread_history_projection_state{next_rollout_byte_offset,next_rollout_ordinal}` + `idx_thread_items_by_turn_updated_page`。会话消息按 turn 分片拉取 + metadata 九类只回"摘要 + 展开时懒取全文"。**验收**:5000 消息会话首屏 ≤800ms(Playwright 计时断言,阈值入 e2e)+ 上翻不重复不丢帧 + 懒取失败降级为占位不白屏 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记已随归档搬至 .ihui-agent/archive/PROJECT_PLAN_2026-09-28_auto-archive.md 的条目 「D35 · 长会话分页投影与增量回放」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10963(L1 外部持有行 L1538):

```
- [ ] **D43 会话内快捷笔记(G-51)**:录音 12 phase 状态机 + 转写 + 归档/分组/搜索,笔记可一键插入对话。复用 `voice-input/voice-record`,不新建录音栈。**验收**:phase 矩阵用例(权限拒绝/中断/最终化失败)+ 笔记→上下文引用闭环 + miniapp 端豁免标注(平台独占:录音 API 差异) 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记已随归档搬至 .ihui-agent/archive/PROJECT_PLAN_2026-09-28_auto-archive.md 的条目 「D43 · 会话内快捷笔记」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10964(L1 外部持有行 L1550):

```
- [ ] **D50 多端遥控配对 + 每会话浏览器 Tab 状态(G-60)+ WorkBuddy 取证专项**:① 手机看/接管桌面在跑会话(对标 `remote_control_enrollments`);② 每会话浏览器 tab 路由状态持久化(对标 `thread-tab-routes-v1`,复用 work-panel 历史连贯根治成果);③ **WorkBuddy 元素级取证补齐**(本机四路探测确认无程序本体):在装有 WorkBuddy 的机器上取包体或跑一次渲染取证,把报告 §1.4 的 E4 二手升为 E1/E2,再回补差距编号 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记已随归档搬至 .ihui-agent/archive/PROJECT_PLAN_2026-09-28_auto-archive.md 的条目 「D50 · 多端遥控配对+每会话浏览器Tab状态」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10965(L1 外部持有行 L8018):

```
- [ ] 47. 三套执行内核工具集归一(A/B/C → 唯一工具注册表 `mcp_server._TOOLS`;AgentEngine 15 个工具映射或移植;JSON-RPC 只留协议适配层;CI parity 断言 `BUILTIN_ENGINE_TOOLS` ⊆ `_TOOLS` 映射完整) 〔PROGRESS 2026-09-27(五路并行第一波,ab4fed16d 前一枚):已落 J11/J14 两面 + 引擎内置名经 `resolve_engine_tool` 归口(归口在 `_ADMIN_ONLY_TOOLS` 判定之前,否则 unified_exec 这类名字会绕过角色矩阵)。实测 `BUILTIN_ENGINE_TOOLS` 是 **14 枚不是票面的 15**。**未闭环**:第三格「JSON-RPC 只留协议适配层」未做 —— agent_engine 的 RPC 面仍自带工具定义。票保持未勾。〕 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记已随归档搬至 .ihui-agent/archive/PROJECT_PLAN_2026-09-28_auto-archive.md 的条目 「47 · 三套执行内核工具集归一」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10966(L2 族内归并,保留 L10792):

```
- [ ] 82. Predictive Edit(对标 Trae CUE 的独立编辑意图预测器,现有 FIM 链路上升级) 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记已随归档搬至 .ihui-agent/archive/PROJECT_PLAN_2026-09-28_auto-archive.md 的条目 「82 · PredictiveEdit」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10967(L1 外部持有行 L8018):

```
- [ ] 47. 三套执行内核工具集归一(A/B/C → 唯一工具注册表 `mcp_server._TOOLS`;AgentEngine 15 个工具映射或移植;JSON-RPC 只留协议适配层;CI parity 断言 `BUILTIN_ENGINE_TOOLS` ⊆ `_TOOLS` 映射完整) 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记已随归档搬至 .ihui-agent/archive/PROJECT_PLAN_2026-09-28_auto-archive.md 的条目 「47 · 三套执行内核工具集归一」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10968(L2 族内归并,保留 L10792):

```
- [ ]82. Predictive Edit(对标 Trae CUE 的独立编辑意图预测器,现有 FIM 链路上升级) 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记已随归档搬至 .ihui-agent/archive/PROJECT_PLAN_2026-09-28_auto-archive.md 的条目 「82 · PredictiveEdit」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10969(L1 外部持有行 L8018):

```
- [ ]47. 三套执行内核工具集归一(A/B/C → 唯一工具注册表 `mcp_server._TOOLS`;AgentEngine 15 个工具映射或移植;JSON-RPC 只留协议适配层;CI parity 断言 `BUILTIN_ENGINE_TOOLS` ⊆ `_TOOLS` 映射完整) 〔PROGRESS 2026-09-27(五路并行第一波,ab4fed16d 前一枚):已落 J11/J14 两面 + 引擎内置名经 `resolve_engine_tool` 归口(归口在 `_ADMIN_ONLY_TOOLS` 判定之前,否则 unified_exec 这类名字会绕过角色矩阵)。实测 `BUILTIN_ENGINE_TOOLS` 是 **14 枚不是票面的 15**。**未闭环**:第三格「JSON-RPC 只留协议适配层」未做 —— agent_engine 的 RPC 面仍自带工具定义。票保持未勾。〕 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记已随归档搬至 .ihui-agent/archive/PROJECT_PLAN_2026-09-28_auto-archive.md 的条目 「47 · 三套执行内核工具集归一」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10970(L1 外部持有行 L9982):

```
- [ ] **D35 长会话分页投影与增量回放(G-59)**:对标 Codex `thread_history_projection_state{next_rollout_byte_offset,next_rollout_ordinal}` + `idx_thread_items_by_turn_updated_page`。会话消息按 turn 分片拉取 + metadata 九类只回"摘要 + 展开时懒取全文"。**验收**:5000 消息会话首屏 ≤800ms(Playwright 计时断言,阈值入 e2e)+ 上翻不重复不丢帧 + 懒取失败降级为占位不白屏 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记已随归档搬至 .ihui-agent/archive/PROJECT_PLAN_2026-09-28_auto-archive.md 的条目 「D35 · 长会话分页投影与增量回放」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10971(L1 外部持有行 L1538):

```
- [ ] **D43 会话内快捷笔记(G-51)**:录音 12 phase 状态机 + 转写 + 归档/分组/搜索,笔记可一键插入对话。复用 `voice-input/voice-record`,不新建录音栈。**验收**:phase 矩阵用例(权限拒绝/中断/最终化失败)+ 笔记→上下文引用闭环 + miniapp 端豁免标注(平台独占:录音 API 差异) 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记已随归档搬至 .ihui-agent/archive/PROJECT_PLAN_2026-09-28_auto-archive.md 的条目 「D43 · 会话内快捷笔记」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10972(L1 外部持有行 L1550):

```
- [ ] **D50 多端遥控配对 + 每会话浏览器 Tab 状态(G-60)+ WorkBuddy 取证专项**:① 手机看/接管桌面在跑会话(对标 `remote_control_enrollments`);② 每会话浏览器 tab 路由状态持久化(对标 `thread-tab-routes-v1`,复用 work-panel 历史连贯根治成果);③ **WorkBuddy 元素级取证补齐**(本机四路探测确认无程序本体):在装有 WorkBuddy 的机器上取包体或跑一次渲染取证,把报告 §1.4 的 E4 二手升为 E1/E2,再回补差距编号 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记已随归档搬至 .ihui-agent/archive/PROJECT_PLAN_2026-09-28_auto-archive.md 的条目 「D50 · 多端遥控配对+每会话浏览器Tab状态」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10974(L1 外部持有行 L15711):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11187(G-608) 同题,派单以持有行为准,本行不再单独派单。〕 G-1018300 **第十一批:沙箱默认严档落地 + 两路只读取证的 24 条发现落成可执行票(每条带落点与验收判据)** 〔让号记录(2026-10-02 F9 清偿批②):原号 G-603 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕
```

- 原 L10980(L1 外部持有行 L15722):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘):本行已让号至 O594(持行在面),merge 回流旧态摘号留指针,正文逐字保留。〕****`2f-ext` 升 blocking 已量好前置,按用户指令暂缓落地**(注册文件 `scripts/guardian-runner.mjs` 本轮不得改)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「O81 · 票⑰——2f-ext升blocking已量好前置」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10981(L1 外部持有行 L7599):

```
- [ ] **O87g 守门 8 的"前缀假设"确实是本票假绿的成因,但不能直接换成精确挂载图(先决:先扩提取式)**:`scripts/check-api-routes.mjs` 的 `buildCompositePrefixes` 把**任一 localPath × 任一绝对前缀**笛卡尔拼接(其注释自述:把 `/api` 与 `/api/admin` 当根去拼 relative prefix),于是 `routes/ranking.ts` 挂在 `/api/ranking` 下的 `server.get('/courses')` 会组合出一条结构上不存在的 `/api/courses` —— 本票那条死调用它报的正是「新增 0 处死调用」。**但把判据换成精确挂载图更糟**:现测 2675 处前端调用里 **2092 处会"消失"**,因为 `registerCrud(server, '/x', …)`(`admin/_shared.ts`、promotions.ts 那族)与模板前缀子树这些注册形态,`scripts/lib/outbound-route-registrations.mjs` 的提取式读不到 —— 那是一把漏读两千的尺子,接进提交链等于造一台与任何提交都无关的恒红门(§12e 同型,也是本仓记过最多次的那一型)。解阻顺序不得跳:① 先把路由提取式扩到 helper 注册形态(按其实参表名解析)并证明"精确集 ⊇ 现有真值";② 再谈把 composite 换成精确集,且必须保留不透明前缀的「未判定」出口;③ 全量报告**报数必须报名**,否则拿到数字的人不知道哪条是盲区。归属:守门 8 持有人。取证:`node scripts/check-api-routes.mjs` HEAD 面现读 5140 路由 × 162 组合前缀;两侧包差异可用 `--dump-backend` 复量。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「O87g · 守门8的"前缀假设"确实是本票假绿的成因」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10982(L1 外部持有行 L15670):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11120(G-393) 同题,派单以持有行为准,本行不再单独派单。〕 G-393 **门 33 的 provider 名单该由谁供给(归属:守门 33 持有人;等人拍板)** —— 现读 7 个在 `.env` 的合法 provider 被判"未知",默认档只 warning 所以 rc 0。**为什么还开着**:config.py 的设计是"新增 provider 零代码改动、自动识别",而本门的名单是手抄副本;两种收口动作语义相反——① 把 7 个补进名单 = 继续养第二份真相,② 由 `.env`/服务端能力清单单向投影 = 改一道 blocking 门的判据。必须先定"这份名单到底要不要存在"。**不得**为让 warning 归零去删判据或放宽规则 3。 (原编号 G-G-354 系改派工具把前缀重复贴了一次:尺子会把它读成 G-354 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4 —— 现取新号,正文逐字未动) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-393 · 门33的provider名单该由谁供给」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10983(L1 外部持有行 L15579):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7765(G-763) 同题,派单以持有行为准,本行不再单独派单。〕 G-394 **MemberCard 把"没量到"显示成 0(第八轮对照逼出;归属:web 首页持有者;等 §17 运行时自验排期)** —— `apps/web/src/components/home/MemberCard.tsx:72-73` 现读 `stats?.points ?? 0` / `wallet?.balance ?? 0`,查询未回或失败时显示"0 分""0 余额"。上游同族口径是"订阅未知不能发布为成功空快照"(`packages/services/src/usage-stats/providers/bigmodelUsageQuotaProvider.ts:259` 原文)加展示层 `'--'` 占位。**为什么还开着**:属 UI 改动,§17 要求起 dev + 读 DOM 数值自验,本票未做该项;改法是 `number | null` + 占位,不动判据、无恒红风险。**这一条不是"抄上游功能",是把"未知"与"为零"分开** —— 后者是数据事故,前者是显示诚实。 (原编号 G-G-355 系改派工具把前缀重复贴了一次:尺子会把它读成 G-355 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4 —— 现取新号,正文逐字未动) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-394 · MemberCard把"没量到"显示成0」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10984(L1 外部持有行 L7603):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7693(G-395) 同题,派单以持有行为准,本行不再单独派单。〕 G-395 **配置分层的"出处标签"与"请求档 vs 实得档"留痕(归属:cli/子代理线持有人;等产品拍板)** —— 上游 `packages/provider/src/resolver.ts:190/196/208` 三层 overlay 且每个生效对象带 `source` 标签、快照的 `sourceRevisions` 被真实消费;我方 `apps/cli/src/subagents/precedence.ts:195-205` 的四层短路链**没有出处标签**,且 `git grep -I "requestedEffort\|effectiveEffort\|validateModelSelection"` HEAD 面现读 **0 命中** ⇒ 静默降档无法归因。**为什么还开着**:新建"配置分层解析出口"属 §24 新增能力、且是跨端数据建模,不在本轮取证范围;上游那两格(`effective-model-selection.ts` 的 `selectionIssue` 六值枚举、`model-selection-config.ts:76-77`"不能静默补档位")是它的前置形状,可作参考实现但不是本轮交付物。 (原编号 G-G-356 系改派工具把前缀重复贴了一次:尺子会把它读成 G-356 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4 —— 现取新号,正文逐字未动) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-395 · 配置分层的"出处标签"与"请求档vs实得档"留痕」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10986(L1 外部持有行 L7605):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7695(G-397) 同题,派单以持有行为准,本行不再单独派单。〕 G-397 **锁的"租约认 token 不认 pid"一格只登记、未代裁(归属:`git-lock`/`deploy-lock` 持有人)** —— 上游 `packages/provider-node/src/zcode-builtin-remote-synchronizer.ts:85` 取 `leaseId=randomUUID`、`:143` 的 `#finishLease` 只在 leaseId 相等时才改控制文件,于是"pid 被系统复用"这一型**结构上不可能发生**;而我方是事后补的一环(`scripts/lib/proc-identity.mjs` 的 match/mismatch/unverifiable,承 G-193 那次冻结 11h50m)。**为什么还开着**:改两处锁的 meta 属锁持有人领地,且今天没有可复现的抢占现场做验收依据;真要收它,判据应是"注入一次 leaseId 不相等的迟到 finish 请求,控制文件必须不被改动",而不是"代码写了 leaseId"。 (原编号 G-G-358 系改派工具把前缀重复贴了一次:尺子会把它读成 G-358 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4 —— 现取新号,正文逐字未动) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-397 · 锁的"租约认token不认pid"一格只登记」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10987(L1 外部持有行 L7606):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7696(G-398) 同题,派单以持有行为准,本行不再单独派单。〕 G-398 **第八轮剩余六格候选清单(归属:未派;等各线排期;本轮只取证未实现,逐格带出处)** —— ① 跨层发布闸:上游 `registry-service.ts:205-212` 在"下层已变而上层仍基于旧事实"时**不发混合快照**、继续服务上一份完整 Registry,而我方这条纪律只活在门的散文里、运行时层无出口;② 稀疏 overlay 空即删:`config-service.ts:513-516` 与继承值等价的配置不落盘(absence=继承,不是"空覆盖");③ 诊断量代替原文:`officialMcpCredentials.ts:52-90/359-376` 只记 JWT 剩余秒数并按小时分桶去重,可接我方唯一脱敏出口 `packages/shared/src/utils/redact.ts`;④ 告警去重身份=桶+周期而非墙钟窗口:`startPlanQuotaReminderStore.ts:33-36` 用快照 `referenceTime` 裁决(设备时间可能已越过服务端周期)、`bucketReminderKey` 缺任一字段即不提醒;⑤ in-flight 合并 + CAS 驱逐:`zaiStartPlanBilling.ts:113-122` 失败响应同样保留 1s(防 429 后立刻重复请求)且驱逐前 `if (requests.get(k) !== request) return`(旧请求不得删新记录),上游该守卫三处同形,是我方共享工作区并发写可直接取用的最小实现;⑥ 幂等 key 复用规则:`codingPlanQuotaResetCoordinator.ts:307-329` 瞬时错复用原 key、成功或稳定错才置 null,且服务端 `next_try_at` 必须透传(:617-624)。**为什么还开着**:六格都是"能落但需各自定级与验收"的独立改动(①②碰运行时快照语义、③④⑤⑥碰告警与并发路径),打包成一票会互相遮蔽;派单时逐格取,勿一次全接。**另有一格需产品先定**:上游 `usage-quota.ts:71` 的 `percentage` 是**已用**占比、而 Start Plan 侧 `:1338` 同名字段是**剩余/总额**,现靠"两族走不同 reader"规避,**无类型或判据看守** —— 要不要收口成"以 remaining 为权威、percentage 仅降级",属契约决策。 (原编号 G-G-359 系改派工具把前缀重复贴了一次:尺子会把它读成 G-359 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4 —— 现取新号,正文逐字未动) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-398 · 第八轮剩余六格候选清单」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10988(L1 外部持有行 L7608):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7698(G-402) 同题,派单以持有行为准,本行不再单独派单。〕 G-402 **设置项"显式清空"与"从未设置"无差，且读侧同一含义两键相反（需拍板；归属：api 设置面 + web 设置页持有人）** —— 已亲自复验：`apps/api/src/routes/user/settings-routes.ts:55` 写体是 `z.record(z.string(), z.unknown())`，落库处 `value === null || value === undefined ? null : String(value)` ⇒ `null` 与"缺席"存成同一个 NULL 行；读侧 `apps/web/app/(main)/settings/notifications/page.tsx:48-52` 四键混用 `!== 'false'`（默认真）与 `=== 'true'`（默认假），于是**同一个被清空的值，在前一族读回 true、在后一族读回 false**。上游同族做法是把三态写进契约（`settings/pluginConfigPatch.ts:29-36`：`undefined`=未触碰跳过、`null`=进 `clearOptionKeys`、sensitive 空串=不改已有值；落库侧 `file-config.adapter.ts:557-565` 按 option key 合并而非整对象替换，防同 scope 密钥被静默清空）。**为什么还开着**：改成三态要动 PUT 语义（单键 DELETE 出口我方根本没有——`deleteUserPreference` 只服务 devices），属对外契约决策；先拍"要不要有删键出口"，再谈读侧归一。**不得**靠"读侧统一成 `=== 'true'`"消红——那会把默认真的四项静默翻转。 (原编号 G-G-374 系改派工具把前缀重复贴了一次:尺子会把它读成 G-374 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4 —— 现取新号,正文逐字未动) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-402 · 设置项"显式清空"与"从未设置"无差」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10990(L1 外部持有行 L15780):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘):本行已让号至 G-200(持行在面),merge 回流旧态摘号留指针,正文逐字保留。〕输出被 max_tokens 截断时没有任何"续写"链路，且端上看不到截断（等人拍板）—— 上游 `runtime/methods/turn-output-token-continuation.ts:15-57` 有界续写 ≤3 次、把 `finish_reason==='length'` 与 raw `model_context_window_exceeded`（**成功响应**）判为续写而非压缩，续写 prompt 带 `queryScope` 并被排除出持久历史。我方 SSE 链**根本不携带 finish/stop reason**（`apps/cli/src/commands/agent.ts`、`packages/api-client/src/endpoints/chat.ts`、`packages/shared/src/utils/sse-parse.ts` 三处现读均无；provider 侧只有 `apps/ai-service/app/providers/gemini_provider.py:146-170` 解 `finishReason` 且只用于 SAFETY）。现读 `scripts/guardian-runner.mjs` 的 187 条 `script:` 中无一道判这一格。跨端契约动作（§19 parity + 8 端），并要先定默认档（只提示 / 默认续写 / 默认 off + 影子档只记账 —— 守门 115 已有同一先例与同一理由）。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-425 · 输出被maxtokens截断时没有任何"续写"链」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10992(L1 外部持有行 L15701):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘):本行已让号至 G-210(持行在面),merge 回流旧态摘号留指针,正文逐字保留。〕**台账 F4(重复登记副本)对"同一待办的漂移副本"结构上失明 —— 现读一例:同一条 D41后续① 在 HEAD 有 9 份未勾选副本、其中 7 份正文互不相同(2026-09-28 量)**: `plan-tasks.mjs` 的 F1/F4 判据是"编号 + 标题前缀**逐字等值**",这既是它的优点(不做相似度猜判)也是它的洞 —— 并发 union 每次都留一份**带自己注记**的副本,前缀之后的正文一漂移,复合主键就不再相等,于是同一件事以 N 份"未勾选"长期并存。后果不是账面难看而是**派单被放大 N 倍**:本日两次 `plan-tasks-merge.mjs --heal --commit`(归并 30 行 / 34 行)把 F1/F4 都归到 0,而这一族一份都没被动到 ⇒ "跑过归并"不等于"这一族被覆盖"。出路只有两条且都不该由机器代裁:① 归并线逐组判"哪份是当前状态"(需要读注记语义,机器判不了);② 给登记侧加一条硬约束——同一件事要更新就**就地改那一条**(§1 第 2 条已有此规矩,缺的是让机器能在前缀一致而正文漂移时也点名)。本票**只登记现读证据与两条出路**,不改判据、不批量翻勾(批量翻勾 = 把别人的注记当噪声删,比原病更响)。归属:分叉合并归并线(同 G-363 那条持有)。 (编号改派留痕(2026-09-28):本行原取 G-417,与「全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红」一条撞成一号两事;取号发生在分叉的两条腿上,号段不共享。让位的是**本行**(它是我这一路登记的),别人的行不动;新号由取号令牌按当次 CAS 的 HEAD 现算,落地后须复核它不与任何行首编号重复。正文一字未动。) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-417 · 台账F4」,派单以那条为准,本行不再单独派单。〕
```

- 原 L10997(L1 外部持有行 L15711):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11187(G-608) 同题,派单以持有行为准,本行不再单独派单。〕 G-608 **第十一批:沙箱默认严档落地 + 两路只读取证的 24 条发现落成可执行票(每条带落点与验收判据)** 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-608 · 第十一批」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11000(L1 外部持有行 L15835):

```
- [ ] **D128 AI 对话链路四竞品对标 V4 收口线(19 条差距 / 5 个 Sprint)** —— 唯一入口 `docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`(87–105),本轮不在此复述差距正文,只登记排期与等待项。**S9 尺子先行(105→97)**:先落 `scripts/audit-benchmark-delivery.mjs`(V3 §八 自留建议至今未落地,`ls` 实测不存在)与 parity 门六端扩面,**顺序不可颠倒** —— #93/#94/#96 之所以能长期存在,正是因为 §9「多端连通」的机器判据只覆盖 web 一端(`check-agent-event-parity.mjs:537` 只扫 `apps/web/src`)。**S10 移动端可达性(93→94→95)**:RN 主屏 `apps/mobile-rn/src/screens/ChatScreen.tsx:652` 起只接 7/30 回调(逐名 `comm -23` 算出缺 23 个,含 `onToolCall`/`onToolApproval`/`onPlanUpdate`/`onTerminal*`/`onSubagent*`/`onUsage`/`onBudget`/`onQuestion`/`onFormRequest`/`onReconnect`),而同端 `AiAssistantN8nScreen.tsx:1412` 是完整实现、`src/utils/chat-render-model.ts` 的 4 个 `apply*` 在主屏零调用方 ⇒ 本票主体是**接线不是开发**;#94 是信任型缺陷(RN 与小程序 `tool-approval` 双零命中,手机上遇高危操作无弹窗)。**S11 保真(87→88→89→92)**、**S12 契约地基(99→100→101→102)**、**S13 传输计量收口(96→90→91→103→98)**。**等待项(归属:等用户拍板)**:#100 内置默认高危集**改变默认行为**(现 `_high_risk_tools_from_env` 未配 env 即 `frozenset()`,`agent_loop_v2.py:288-296`),按 §24 不得由实现票自行开工;#98 桌面端薄壳是 V3 #72 已拍板架构,本票**只对齐三处口径**(tauri.conf / `ensure-web-out.mjs` 自称唯一校验点 / `docs/MULTI_END.md §2.5`),不改选型。**解阻前置(可判)**:S10 之前必须先有 S9 的端能力档案表,否则清完的端下轮又漏。**本轮同时否证 7 条断言,均写进 V4 正文,不得照旧文派单**:①②③ 上述三条 V3 过期结论;④ `packages/app` 的 `ChatScreen` 并非「未导出」—— `src/index.ts:684` 导出在位,真问题是**全仓零消费方**(同包其它 4 个聊天屏都被 mobile-rn 复用)⇒ 归 #95;⑤ web **有**消息队列与 Steer(`queue-interaction-bar.tsx` 在库,D38 已✅)⇒ 队列**不是**差距,初稿列错了;⑥ #89 初稿「主聊天流无自动重连」**否证** —— api-client `client.ts:2078/2129/3443` 有重连与 `Last-Event-ID` 续传,web `send-message.ts:767-775` 已消费 `onReconnect`,缺陷窄化为「`connection-status.tsx` 四态件生产面零挂载(命中全在 `apps/web/tests/agent-task-progress-pane.test.tsx`) + 重连后待决审批恢复未取证」;#96 那句「web 反而没有续传」同批否证;⑦ 孤儿清单里的 `voice-note.tsx` 在 HEAD 与索引双双落空,只在工作树未跟踪面 ⇒ 摘出清单、按 §12 归属未定不动。**本轮交付**:V4 文档成文并注水印(`docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`,`watermark.mjs verify` 覆盖 1/1、残迹 0、损坏 0);六端回调覆盖数改用统一交集判据重算(web 全域 30/30、extension 19、cli 12、RN 主屏 7、RN 另一屏 17、miniapp 17),并登记「事件名口径 23 与回调名口径 17 不可混用」。**待办本体是 S9–S13 的实施,本行不因文档成文而翻勾。****本轮同时更正 3 条 V3 过期结论,不得照它们派单**:#73「小程序无 AI 对话页」已被代码推翻(`apps/miniapp-taro/src/pkg-ai/ai/chat.tsx` 1623 行,最新提交 `3f3e71a99` 09-27,按事件名覆盖 23/30);#51「`run_in_background` 只有 sleep/echo」已不成立(`task_executors.py` 现读 16 个 `async def` + import 期三面断言);#47「三套执行内核」应为「一套半」(`class AgentLoopV2` 唯一内核,但 `agent_loop.py` 仍以 `agent_executor` 被 `routers/agents.py:48`、`services/a2a_service.py:33`、`services/slash_commands.py:162` 三处生产引用)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「D128 · AI对话链路四竞品对标V4收口线」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11002(L1 外部持有行 L15653):

```
- [ ]〔【归并】重复登记副本(2026-10-13):本行是同主键的重复登记残影,本体=「G-679 可寻址性守恒尺」行(2026-10-13 已翻勾),派单以本体为准,本行不再单独派单。〕
```

- 原 L11003(L1 外部持有行 L7654):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7745(G-681) 同题,派单以持有行为准,本行不再单独派单。〕 G-681 **F9 基线层把"别人跳门塞进 HEAD 的存量"记在每个碰台账的人头上 —— 同一轮里差值档已判绿而基线档仍红(2026-09-29 现读;归属:台账判据线;补丁三处已量好,落点唯一)**:现读 `node scripts/plan-tasks.mjs --staged --gate` 先打 `✅ 差值棘轮:相对 HEAD,本次提交未新增状态分叉(F1=0 F2=0 F3=0 F4=0 F4b=0 F6=0 F8=0 F9=72)`,紧接着打 `❌ 基线棘轮:F9 撞号:出现基线键集里没有的编号 …(共 31 组)`。被拦的人**一个撞号都没造**,却要为自己的提交绕钩子 —— 一次绕过约等于其余全部对账对该提交作废(§12e/§12f 同型,而这一台是**每次碰台账都响**)。**只改归属、不改强度**:基线层的 F9 那一项在手里有差值基准面(HEAD 面)时,只认"基线缺 ∧ HEAD 也没有"的键;其余键**打印出来**(`ℹ F9 基线缺项 N 组此刻已在 HEAD 面 ⇒ 不记在本次提交头上`,静默等于放行)而不判红;全量问责档**不过滤** ⇒ 存量照旧红、逐组名单照旧给;`--update-baseline` 仍只许收窄。落点三处,都在 `scripts/plan-tasks.mjs`:① `gate()` 里 `const f9b = f9Ratchet(base, a)` 之后算 `f9HeadKeys / f9Attributed / f9Stock` 并打印那行 ℹ;② `const vsBase = ratchetViolations(base, items, a)` 在 `before` 在位时改传按归属过滤后的面(`{ ...a, collisions: (a.collisions ?? []).filter((g) => attributed.includes(g.key)) }`,**不改** `ratchetViolations` 的签名 —— 两参调用方 `git-sync-converge` 的文案与判序必须逐字不变,那是镜像 M20 钉着的);③ `const addedKeys = … f9b.added` 换成归属后的集合。两条反向锁必须同批写,且都用**纯函数 + 构造面**(不得依赖仓库瞬时状态 —— 守门 103 T12 那一课,也是本票立项时 M20 硬写 `涨到 71` 而基线今天 73 枚那一型的正解):A)同一份"存量键在 HEAD 已有、基线没有"的面,`--staged` 档必须绿而全量档必须红;B)差值基准面没带逐组明细 ⇒ 判"未判定"(exit 2),既不冒红也不记绿。**为什么本票不当场落(阻塞主体,不是遗漏)**:`scripts/plan-tasks.mjs` 此刻**三面分歧** —— HEAD 那份刚由并发会话落了"编号位收窄"(`auditFace`/`registersKeyAtIdPosition`,镜像 `plan-tasks-f9.test.mjs` 10/10 已绿),索引那份是某会话 staged 的 1378 行**旧基线**(相对 HEAD 净删 182 行、且不含收窄),工作树第三份是同一旧基线现场并夹着他人未提交改动;按 §12"判据文件他人持有就只登记不代改",本会话不写第四份,也不按 pathspec 交它。**解阻前置(可判)**:该路径三面归一(索引那份由持有人提交,或按 HEAD 底稿重做),然后按上面三处落并补两条反向锁。同批已单独落地的另一半:`scripts/tests/plan-tasks.test.mjs` 的 M20 不再把 `BASE_KEYS.length`(现读自基线文件)硬写成 71 ⇒ 基线每被人工刷一次就恒红的那一格已闭(镜像 30/30 在 HEAD 码面上复验)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-681 · F9基线层把"别人跳门塞进HEAD的存量"记在每」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11005(L1 外部持有行 L15701):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11128(G-453) 同题,派单以持有行为准,本行不再单独派单。〕 G-453 **台账 F4(重复登记副本)对"同一待办的漂移副本"结构上失明 —— 现读一例:同一条 D41后续① 在 HEAD 有 9 份未勾选副本、其中 7 份正文互不相同(2026-09-28 量)**: `plan-tasks.mjs` 的 F1/F4 判据是"编号 + 标题前缀**逐字等值**",这既是它的优点(不做相似度猜判)也是它的洞 —— 并发 union 每次都留一份**带自己注记**的副本,前缀之后的正文一漂移,复合主键就不再相等,于是同一件事以 N 份"未勾选"长期并存。后果不是账面难看而是**派单被放大 N 倍**:本日两次 `plan-tasks-merge.mjs --heal --commit`(归并 30 行 / 34 行)把 F1/F4 都归到 0,而这一族一份都没被动到 ⇒ "跑过归并"不等于"这一族被覆盖"。出路只有两条且都不该由机器代裁:① 归并线逐组判"哪份是当前状态"(需要读注记语义,机器判不了);② 给登记侧加一条硬约束——同一件事要更新就**就地改那一条**(§1 第 2 条已有此规矩,缺的是让机器能在前缀一致而正文漂移时也点名)。本票**只登记现读证据与两条出路**,不改判据、不批量翻勾(批量翻勾 = 把别人的注记当噪声删,比原病更响)。归属:分叉合并归并线(同 G-363 那条持有)。 (编号改派留痕(2026-09-28):本行原取 G-417,与「全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红」一条撞成一号两事;取号发生在分叉的两条腿上,号段不共享。让位的是**本行**(它是我这一路登记的),别人的行不动;新号由取号令牌按当次 CAS 的 HEAD 现算,落地后须复核它不与任何行首编号重复。正文一字未动。) (编号改派留痕(2026-09-28):本行原取 G-417,与「全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红」一号两事。让位的是**本行**(它是我这一路登记的,别人的行一字未动)。新号是**手工取并逐面复核过的**(G/D/O 不相关,只看 G 族):台账行首集合 + 归档件全文 + 工作树副本三处均无 453 —— 因为取号令牌在改派场景下两次交回了"正在被让位的那个号"(它返回 G-417,而当时台账该族 max 已到 419/429),这个缺陷另立一票 G-454。正文一字未动。) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-453 · 台账F4」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11006(L1 外部持有行 L15670):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11120(G-393) 同题,派单以持有行为准,本行不再单独派单。〕 G-354 **门 33 的 provider 名单该由谁供给(归属:守门 33 持有人;等人拍板)** —— 现读 7 个在 `.env` 的合法 provider 被判"未知",默认档只 warning 所以 rc 0。**为什么还开着**:config.py 的设计是"新增 provider 零代码改动、自动识别",而本门的名单是手抄副本;两种收口动作语义相反——① 把 7 个补进名单 = 继续养第二份真相,② 由 `.env`/服务端能力清单单向投影 = 改一道 blocking 门的判据。必须先定"这份名单到底要不要存在"。**不得**为让 warning 归零去删判据或放宽规则 3。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-354 · 门33的provider名单该由谁供给」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11007(L1 外部持有行 L15579):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7765(G-763) 同题,派单以持有行为准,本行不再单独派单。〕 G-355 **MemberCard 把"没量到"显示成 0(第八轮对照逼出;归属:web 首页持有者;等 §17 运行时自验排期)** —— `apps/web/src/components/home/MemberCard.tsx:72-73` 现读 `stats?.points ?? 0` / `wallet?.balance ?? 0`,查询未回或失败时显示"0 分""0 余额"。上游同族口径是"订阅未知不能发布为成功空快照"(`packages/services/src/usage-stats/providers/bigmodelUsageQuotaProvider.ts:259` 原文)加展示层 `'--'` 占位。**为什么还开着**:属 UI 改动,§17 要求起 dev + 读 DOM 数值自验,本票未做该项;改法是 `number | null` + 占位,不动判据、无恒红风险。**这一条不是"抄上游功能",是把"未知"与"为零"分开** —— 后者是数据事故,前者是显示诚实。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-355 · MemberCard把"没量到"显示成0」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11008(L1 外部持有行 L7603):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7693(G-395) 同题,派单以持有行为准,本行不再单独派单。〕 G-356 **配置分层的"出处标签"与"请求档 vs 实得档"留痕(归属:cli/子代理线持有人;等产品拍板)** —— 上游 `packages/provider/src/resolver.ts:190/196/208` 三层 overlay 且每个生效对象带 `source` 标签、快照的 `sourceRevisions` 被真实消费;我方 `apps/cli/src/subagents/precedence.ts:195-205` 的四层短路链**没有出处标签**,且 `git grep -I "requestedEffort\|effectiveEffort\|validateModelSelection"` HEAD 面现读 **0 命中** ⇒ 静默降档无法归因。**为什么还开着**:新建"配置分层解析出口"属 §24 新增能力、且是跨端数据建模,不在本轮取证范围;上游那两格(`effective-model-selection.ts` 的 `selectionIssue` 六值枚举、`model-selection-config.ts:76-77`"不能静默补档位")是它的前置形状,可作参考实现但不是本轮交付物。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-356 · 配置分层的"出处标签"与"请求档vs实得档"留痕」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11010(L1 外部持有行 L7605):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7695(G-397) 同题,派单以持有行为准,本行不再单独派单。〕 G-358 **锁的"租约认 token 不认 pid"一格只登记、未代裁(归属:`git-lock`/`deploy-lock` 持有人)** —— 上游 `packages/provider-node/src/zcode-builtin-remote-synchronizer.ts:85` 取 `leaseId=randomUUID`、`:143` 的 `#finishLease` 只在 leaseId 相等时才改控制文件,于是"pid 被系统复用"这一型**结构上不可能发生**;而我方是事后补的一环(`scripts/lib/proc-identity.mjs` 的 match/mismatch/unverifiable,承 G-193 那次冻结 11h50m)。**为什么还开着**:改两处锁的 meta 属锁持有人领地,且今天没有可复现的抢占现场做验收依据;真要收它,判据应是"注入一次 leaseId 不相等的迟到 finish 请求,控制文件必须不被改动",而不是"代码写了 leaseId"。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-358 · 锁的"租约认token不认pid"一格只登记」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11011(L1 外部持有行 L7606):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7696(G-398) 同题,派单以持有行为准,本行不再单独派单。〕 G-359 **第八轮剩余六格候选清单(归属:未派;等各线排期;本轮只取证未实现,逐格带出处)** —— ① 跨层发布闸:上游 `registry-service.ts:205-212` 在"下层已变而上层仍基于旧事实"时**不发混合快照**、继续服务上一份完整 Registry,而我方这条纪律只活在门的散文里、运行时层无出口;② 稀疏 overlay 空即删:`config-service.ts:513-516` 与继承值等价的配置不落盘(absence=继承,不是"空覆盖");③ 诊断量代替原文:`officialMcpCredentials.ts:52-90/359-376` 只记 JWT 剩余秒数并按小时分桶去重,可接我方唯一脱敏出口 `packages/shared/src/utils/redact.ts`;④ 告警去重身份=桶+周期而非墙钟窗口:`startPlanQuotaReminderStore.ts:33-36` 用快照 `referenceTime` 裁决(设备时间可能已越过服务端周期)、`bucketReminderKey` 缺任一字段即不提醒;⑤ in-flight 合并 + CAS 驱逐:`zaiStartPlanBilling.ts:113-122` 失败响应同样保留 1s(防 429 后立刻重复请求)且驱逐前 `if (requests.get(k) !== request) return`(旧请求不得删新记录),上游该守卫三处同形,是我方共享工作区并发写可直接取用的最小实现;⑥ 幂等 key 复用规则:`codingPlanQuotaResetCoordinator.ts:307-329` 瞬时错复用原 key、成功或稳定错才置 null,且服务端 `next_try_at` 必须透传(:617-624)。**为什么还开着**:六格都是"能落但需各自定级与验收"的独立改动(①②碰运行时快照语义、③④⑤⑥碰告警与并发路径),打包成一票会互相遮蔽;派单时逐格取,勿一次全接。**另有一格需产品先定**:上游 `usage-quota.ts:71` 的 `percentage` 是**已用**占比、而 Start Plan 侧 `:1338` 同名字段是**剩余/总额**,现靠"两族走不同 reader"规避,**无类型或判据看守** —— 要不要收口成"以 remaining 为权威、percentage 仅降级",属契约决策。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-359 · 第八轮剩余六格候选清单」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11013(L1 外部持有行 L15670):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11120(G-393) 同题,派单以持有行为准,本行不再单独派单。〕 G-762 **门 33 的 provider 名单该由谁供给(归属:守门 33 持有人;等人拍板)** —— 现读 7 个在 `.env` 的合法 provider 被判"未知",默认档只 warning 所以 rc 0。**为什么还开着**:config.py 的设计是"新增 provider 零代码改动、自动识别",而本门的名单是手抄副本;两种收口动作语义相反——① 把 7 个补进名单 = 继续养第二份真相,② 由 `.env`/服务端能力清单单向投影 = 改一道 blocking 门的判据。必须先定"这份名单到底要不要存在"。**不得**为让 warning 归零去删判据或放宽规则 3。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `G-G-354`(族名在编号段出现两次)。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 G-354 已被 9 行认领(L8272,8527,8617,8644…),改回就等于替这本账再加一枚撞号;现号 `G-762`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-762 · 门33的provider名单该由谁供给」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11014(L1 外部持有行 L15579):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7765(G-763) 同题,派单以持有行为准,本行不再单独派单。〕 G-763 **MemberCard 把"没量到"显示成 0(第八轮对照逼出;归属:web 首页持有者;等 §17 运行时自验排期)** —— `apps/web/src/components/home/MemberCard.tsx:72-73` 现读 `stats?.points ?? 0` / `wallet?.balance ?? 0`,查询未回或失败时显示"0 分""0 余额"。上游同族口径是"订阅未知不能发布为成功空快照"(`packages/services/src/usage-stats/providers/bigmodelUsageQuotaProvider.ts:259` 原文)加展示层 `'--'` 占位。**为什么还开着**:属 UI 改动,§17 要求起 dev + 读 DOM 数值自验,本票未做该项;改法是 `number | null` + 占位,不动判据、无恒红风险。**这一条不是"抄上游功能",是把"未知"与"为零"分开** —— 后者是数据事故,前者是显示诚实。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `G-G-355`(族名在编号段出现两次)。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 G-355 已被 9 行认领(L8273,8528,8618,8645…),改回就等于替这本账再加一枚撞号;现号 `G-763`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-763 · MemberCard把"没量到"显示成0」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11015(L1 外部持有行 L7603):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7693(G-395) 同题,派单以持有行为准,本行不再单独派单。〕 G-764 **配置分层的"出处标签"与"请求档 vs 实得档"留痕(归属:cli/子代理线持有人;等产品拍板)** —— 上游 `packages/provider/src/resolver.ts:190/196/208` 三层 overlay 且每个生效对象带 `source` 标签、快照的 `sourceRevisions` 被真实消费;我方 `apps/cli/src/subagents/precedence.ts:195-205` 的四层短路链**没有出处标签**,且 `git grep -I "requestedEffort\|effectiveEffort\|validateModelSelection"` HEAD 面现读 **0 命中** ⇒ 静默降档无法归因。**为什么还开着**:新建"配置分层解析出口"属 §24 新增能力、且是跨端数据建模,不在本轮取证范围;上游那两格(`effective-model-selection.ts` 的 `selectionIssue` 六值枚举、`model-selection-config.ts:76-77`"不能静默补档位")是它的前置形状,可作参考实现但不是本轮交付物。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `G-G-356`(族名在编号段出现两次)。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 G-356 已被 9 行认领(L8274,8529,8619,8646…),改回就等于替这本账再加一枚撞号;现号 `G-764`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-764 · 配置分层的"出处标签"与"请求档vs实得档"留痕」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11017(L1 外部持有行 L7605):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7695(G-397) 同题,派单以持有行为准,本行不再单独派单。〕 G-766 **锁的"租约认 token 不认 pid"一格只登记、未代裁(归属:`git-lock`/`deploy-lock` 持有人)** —— 上游 `packages/provider-node/src/zcode-builtin-remote-synchronizer.ts:85` 取 `leaseId=randomUUID`、`:143` 的 `#finishLease` 只在 leaseId 相等时才改控制文件,于是"pid 被系统复用"这一型**结构上不可能发生**;而我方是事后补的一环(`scripts/lib/proc-identity.mjs` 的 match/mismatch/unverifiable,承 G-193 那次冻结 11h50m)。**为什么还开着**:改两处锁的 meta 属锁持有人领地,且今天没有可复现的抢占现场做验收依据;真要收它,判据应是"注入一次 leaseId 不相等的迟到 finish 请求,控制文件必须不被改动",而不是"代码写了 leaseId"。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `G-G-358`(族名在编号段出现两次)。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 G-358 已被 9 行认领(L8276,8531,8621,8648…),改回就等于替这本账再加一枚撞号;现号 `G-766`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-766 · 锁的"租约认token不认pid"一格只登记」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11018(L1 外部持有行 L7606):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7696(G-398) 同题,派单以持有行为准,本行不再单独派单。〕 G-767 **第八轮剩余六格候选清单(归属:未派;等各线排期;本轮只取证未实现,逐格带出处)** —— ① 跨层发布闸:上游 `registry-service.ts:205-212` 在"下层已变而上层仍基于旧事实"时**不发混合快照**、继续服务上一份完整 Registry,而我方这条纪律只活在门的散文里、运行时层无出口;② 稀疏 overlay 空即删:`config-service.ts:513-516` 与继承值等价的配置不落盘(absence=继承,不是"空覆盖");③ 诊断量代替原文:`officialMcpCredentials.ts:52-90/359-376` 只记 JWT 剩余秒数并按小时分桶去重,可接我方唯一脱敏出口 `packages/shared/src/utils/redact.ts`;④ 告警去重身份=桶+周期而非墙钟窗口:`startPlanQuotaReminderStore.ts:33-36` 用快照 `referenceTime` 裁决(设备时间可能已越过服务端周期)、`bucketReminderKey` 缺任一字段即不提醒;⑤ in-flight 合并 + CAS 驱逐:`zaiStartPlanBilling.ts:113-122` 失败响应同样保留 1s(防 429 后立刻重复请求)且驱逐前 `if (requests.get(k) !== request) return`(旧请求不得删新记录),上游该守卫三处同形,是我方共享工作区并发写可直接取用的最小实现;⑥ 幂等 key 复用规则:`codingPlanQuotaResetCoordinator.ts:307-329` 瞬时错复用原 key、成功或稳定错才置 null,且服务端 `next_try_at` 必须透传(:617-624)。**为什么还开着**:六格都是"能落但需各自定级与验收"的独立改动(①②碰运行时快照语义、③④⑤⑥碰告警与并发路径),打包成一票会互相遮蔽;派单时逐格取,勿一次全接。**另有一格需产品先定**:上游 `usage-quota.ts:71` 的 `percentage` 是**已用**占比、而 Start Plan 侧 `:1338` 同名字段是**剩余/总额**,现靠"两族走不同 reader"规避,**无类型或判据看守** —— 要不要收口成"以 remaining 为权威、percentage 仅降级",属契约决策。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `G-G-359`(族名在编号段出现两次)。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 G-359 已被 9 行认领(L8277,8532,8622,8649…),改回就等于替这本账再加一枚撞号;现号 `G-767`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-767 · 第八轮剩余六格候选清单」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11019(L1 外部持有行 L7608):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7698(G-402) 同题,派单以持有行为准,本行不再单独派单。〕 G-769 **设置项"显式清空"与"从未设置"无差，且读侧同一含义两键相反（需拍板；归属：api 设置面 + web 设置页持有人）** —— 已亲自复验：`apps/api/src/routes/user/settings-routes.ts:55` 写体是 `z.record(z.string(), z.unknown())`，落库处 `value === null || value === undefined ? null : String(value)` ⇒ `null` 与"缺席"存成同一个 NULL 行；读侧 `apps/web/app/(main)/settings/notifications/page.tsx:48-52` 四键混用 `!== 'false'`（默认真）与 `=== 'true'`（默认假），于是**同一个被清空的值，在前一族读回 true、在后一族读回 false**。上游同族做法是把三态写进契约（`settings/pluginConfigPatch.ts:29-36`：`undefined`=未触碰跳过、`null`=进 `clearOptionKeys`、sensitive 空串=不改已有值；落库侧 `file-config.adapter.ts:557-565` 按 option key 合并而非整对象替换，防同 scope 密钥被静默清空）。**为什么还开着**：改成三态要动 PUT 语义（单键 DELETE 出口我方根本没有——`deleteUserPreference` 只服务 devices），属对外契约决策；先拍"要不要有删键出口"，再谈读侧归一。**不得**靠"读侧统一成 `=== 'true'`"消红——那会把默认真的四项静默翻转。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `G-G-374`(族名在编号段出现两次)。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 G-374 已被 20 行认领(L7676,7851,7925,8152…),改回就等于替这本账再加一枚撞号;现号 `G-769`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-769 · 设置项"显式清空"与"从未设置"无差」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11021(L1 外部持有行 L7608):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7698(G-402) 同题,派单以持有行为准,本行不再单独派单。〕 G-813374 **设置项"显式清空"与"从未设置"无差，且读侧同一含义两键相反（需拍板；归属：api 设置面 + web 设置页持有人）** —— 已亲自复验：`apps/api/src/routes/user/settings-routes.ts:55` 写体是 `z.record(z.string(), z.unknown())`，落库处 `value === null || value === undefined ? null : String(value)` ⇒ `null` 与"缺席"存成同一个 NULL 行；读侧 `apps/web/app/(main)/settings/notifications/page.tsx:48-52` 四键混用 `!== 'false'`（默认真）与 `=== 'true'`（默认假），于是**同一个被清空的值，在前一族读回 true、在后一族读回 false**。上游同族做法是把三态写进契约（`settings/pluginConfigPatch.ts:29-36`：`undefined`=未触碰跳过、`null`=进 `clearOptionKeys`、sensitive 空串=不改已有值；落库侧 `file-config.adapter.ts:557-565` 按 option key 合并而非整对象替换，防同 scope 密钥被静默清空）。**为什么还开着**：改成三态要动 PUT 语义（单键 DELETE 出口我方根本没有——`deleteUserPreference` 只服务 devices），属对外契约决策；先拍"要不要有删键出口"，再谈读侧归一。**不得**靠"读侧统一成 `=== 'true'`"消红——那会把默认真的四项静默翻转。〔2026-09-29 改号(承 D168 第四遍收尾):剥掉双前缀后本行会与既有 **G-374**(标题「G-374ihui-auth-user里存了is」)**同主键 —— 那不是畸形号而是**真撞号**,所以这里不剥前缀而是取当次空闲新号;原编号位写的是「G-G-」。〕 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-813374 · 设置项"显式清空"与"从未设置"无差」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11025(L1 外部持有行 L15686):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L10431(G-410) 同题,派单以持有行为准,本行不再单独派单。〕 G-410 **第 3 波待办（覆盖面本身，不是功能票）** —— 未读名单已报名，按此接手：`apps/zcode-cli/packages/core/src/{tool/handlers 120, runtime/methods 98, runtime/helpers 53, subagent 22, workflow 31, hooks 17, context 12, memory 10, browser-client 7}`；`packages/desktop/src/main/index.ts`(2384，装配主入口) + 遥测/ARMS 族 + `processResource*` 13；`packages/ui/src/lib` 剩余 workspace 22/task 21/provider 15/telemetry 9/tool 9；`packages/ui/src/v4`（W2-8 在报）；`packages/services/src` 剩余 14（`conversationShare*` 3、`settingsSync` 2、`commandsService` 1004、`memoryService`、`fsFaultInjection` 等）；`packages/zcode-server-cli/src` 剩余 41；`packages/web` 17。**另有两格结构空白**：`packages/app/src/features/**` 不在守门 128 的配对源里（同族第三份活实现改了像素不移动任何读数），`*.module.css` / CSS-in-JS 形态尚未测量——不得读成"已确认没有"。 (原编号 G-G-382 系改派工具把前缀重复贴了一次:尺子会把它读成 G-382 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4 —— 现取新号,正文逐字未动)
```

- 原 L11028(L1 外部持有行 L15786):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘):本行已让号至 G-200(持行在面),merge 回流旧态摘号留指针,正文逐字保留(已完成态登记,摘号不翻勾)。〕输出被 max_tokens 截断时没有任何"续写"链路，且端上看不到截断（等人拍板）—— 上游 `runtime/methods/turn-output-token-continuation.ts:15-57` 有界续写 ≤3 次、把 `finish_reason==='length'` 与 raw `model_context_window_exceeded`（**成功响应**）判为续写而非压缩，续写 prompt 带 `queryScope` 并被排除出持久历史。我方 SSE 链**根本不携带 finish/stop reason**（`apps/cli/src/commands/agent.ts`、`packages/api-client/src/endpoints/chat.ts`、`packages/shared/src/utils/sse-parse.ts` 三处现读均无；provider 侧只有 `apps/ai-service/app/providers/gemini_provider.py:146-170` 解 `finishReason` 且只用于 SAFETY）。现读 `scripts/guardian-runner.mjs` 的 187 条 `script:` 中无一道判这一格。跨端契约动作（§19 parity + 8 端），并要先定默认档（只提示 / 默认续写 / 默认 off + 影子档只记账 —— 守门 115 已有同一先例与同一理由）。 〔拍板@2026-10-07 机主:抄上游——有界续写≤3次+finish_reason透传,续写prompt排除出持久历史〕 〔拍板@2026-10-07 机主:抄上游——有界续写≤3次+finish_reason透传,续写prompt排除出持久历史〕〔完成@2026-10-07 续会话:1e6247f516 有界续写≤3次+finish_reason透传,续写prompt排除出持久历史(agent-output-continuation.ts)+cli五语言文案,cli vitest 57/57;截断可见提示半已由 eda9661f7b/ce97639dd7 收口(L8144)〕
```

- 原 L11046(L1 外部持有行 L7603):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7693(G-395) 同题,派单以持有行为准,本行不再单独派单。〕 G-764 **配置分层的"出处标签"与"请求档 vs 实得档"留痕(归属:cli/子代理线持有人;等产品拍板)** —— 上游 `packages/provider/src/resolver.ts:190/196/208` 三层 overlay 且每个生效对象带 `source` 标签、快照的 `sourceRevisions` 被真实消费;我方 `apps/cli/src/subagents/precedence.ts:195-205` 的四层短路链**没有出处标签**,且 `git grep -I "requestedEffort\|effectiveEffort\|validateModelSelection"` HEAD 面现读 **0 命中** ⇒ 静默降档无法归因。**为什么还开着**:新建"配置分层解析出口"属 §24 新增能力、且是跨端数据建模,不在本轮取证范围;上游那两格(`effective-model-selection.ts` 的 `selectionIssue` 六值枚举、`model-selection-config.ts:76-77`"不能静默补档位")是它的前置形状,可作参考实现但不是本轮交付物。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `G-G-356`(族名在编号段出现两次)。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 G-356 已被 9 行认领(L8274,8529,8619,8646…),改回就等于替这本账再加一枚撞号;现号 `G-764`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。
```

- 原 L11048(L1 外部持有行 L7605):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7695(G-397) 同题,派单以持有行为准,本行不再单独派单。〕 G-766 **锁的"租约认 token 不认 pid"一格只登记、未代裁(归属:`git-lock`/`deploy-lock` 持有人)** —— 上游 `packages/provider-node/src/zcode-builtin-remote-synchronizer.ts:85` 取 `leaseId=randomUUID`、`:143` 的 `#finishLease` 只在 leaseId 相等时才改控制文件,于是"pid 被系统复用"这一型**结构上不可能发生**;而我方是事后补的一环(`scripts/lib/proc-identity.mjs` 的 match/mismatch/unverifiable,承 G-193 那次冻结 11h50m)。**为什么还开着**:改两处锁的 meta 属锁持有人领地,且今天没有可复现的抢占现场做验收依据;真要收它,判据应是"注入一次 leaseId 不相等的迟到 finish 请求,控制文件必须不被改动",而不是"代码写了 leaseId"。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `G-G-358`(族名在编号段出现两次)。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 G-358 已被 9 行认领(L8276,8531,8621,8648…),改回就等于替这本账再加一枚撞号;现号 `G-766`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。
```

- 原 L11049(L1 外部持有行 L7606):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7696(G-398) 同题,派单以持有行为准,本行不再单独派单。〕 G-767 **第八轮剩余六格候选清单(归属:未派;等各线排期;本轮只取证未实现,逐格带出处)** —— ① 跨层发布闸:上游 `registry-service.ts:205-212` 在"下层已变而上层仍基于旧事实"时**不发混合快照**、继续服务上一份完整 Registry,而我方这条纪律只活在门的散文里、运行时层无出口;② 稀疏 overlay 空即删:`config-service.ts:513-516` 与继承值等价的配置不落盘(absence=继承,不是"空覆盖");③ 诊断量代替原文:`officialMcpCredentials.ts:52-90/359-376` 只记 JWT 剩余秒数并按小时分桶去重,可接我方唯一脱敏出口 `packages/shared/src/utils/redact.ts`;④ 告警去重身份=桶+周期而非墙钟窗口:`startPlanQuotaReminderStore.ts:33-36` 用快照 `referenceTime` 裁决(设备时间可能已越过服务端周期)、`bucketReminderKey` 缺任一字段即不提醒;⑤ in-flight 合并 + CAS 驱逐:`zaiStartPlanBilling.ts:113-122` 失败响应同样保留 1s(防 429 后立刻重复请求)且驱逐前 `if (requests.get(k) !== request) return`(旧请求不得删新记录),上游该守卫三处同形,是我方共享工作区并发写可直接取用的最小实现;⑥ 幂等 key 复用规则:`codingPlanQuotaResetCoordinator.ts:307-329` 瞬时错复用原 key、成功或稳定错才置 null,且服务端 `next_try_at` 必须透传(:617-624)。**为什么还开着**:六格都是"能落但需各自定级与验收"的独立改动(①②碰运行时快照语义、③④⑤⑥碰告警与并发路径),打包成一票会互相遮蔽;派单时逐格取,勿一次全接。**另有一格需产品先定**:上游 `usage-quota.ts:71` 的 `percentage` 是**已用**占比、而 Start Plan 侧 `:1338` 同名字段是**剩余/总额**,现靠"两族走不同 reader"规避,**无类型或判据看守** —— 要不要收口成"以 remaining 为权威、percentage 仅降级",属契约决策。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `G-G-359`(族名在编号段出现两次)。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 G-359 已被 9 行认领(L8277,8532,8622,8649…),改回就等于替这本账再加一枚撞号;现号 `G-767`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。
```

- 原 L11050(L1 外部持有行 L7608):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7698(G-402) 同题,派单以持有行为准,本行不再单独派单。〕 G-769 **设置项"显式清空"与"从未设置"无差，且读侧同一含义两键相反（需拍板；归属：api 设置面 + web 设置页持有人）** —— 已亲自复验：`apps/api/src/routes/user/settings-routes.ts:55` 写体是 `z.record(z.string(), z.unknown())`，落库处 `value === null || value === undefined ? null : String(value)` ⇒ `null` 与"缺席"存成同一个 NULL 行；读侧 `apps/web/app/(main)/settings/notifications/page.tsx:48-52` 四键混用 `!== 'false'`（默认真）与 `=== 'true'`（默认假），于是**同一个被清空的值，在前一族读回 true、在后一族读回 false**。上游同族做法是把三态写进契约（`settings/pluginConfigPatch.ts:29-36`：`undefined`=未触碰跳过、`null`=进 `clearOptionKeys`、sensitive 空串=不改已有值；落库侧 `file-config.adapter.ts:557-565` 按 option key 合并而非整对象替换，防同 scope 密钥被静默清空）。**为什么还开着**：改成三态要动 PUT 语义（单键 DELETE 出口我方根本没有——`deleteUserPreference` 只服务 devices），属对外契约决策；先拍"要不要有删键出口"，再谈读侧归一。**不得**靠"读侧统一成 `=== 'true'`"消红——那会把默认真的四项静默翻转。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `G-G-374`(族名在编号段出现两次)。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 G-374 已被 20 行认领(L7676,7851,7925,8152…),改回就等于替这本账再加一枚撞号;现号 `G-769`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。
```

- 原 L11052(L1 外部持有行 L15686):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L10431(G-410) 同题,派单以持有行为准,本行不再单独派单。〕 G-777 **第 3 波待办（覆盖面本身，不是功能票）** —— 未读名单已报名，按此接手：`apps/zcode-cli/packages/core/src/{tool/handlers 120, runtime/methods 98, runtime/helpers 53, subagent 22, workflow 31, hooks 17, context 12, memory 10, browser-client 7}`；`packages/desktop/src/main/index.ts`(2384，装配主入口) + 遥测/ARMS 族 + `processResource*` 13；`packages/ui/src/lib` 剩余 workspace 22/task 21/provider 15/telemetry 9/tool 9；`packages/ui/src/v4`（W2-8 在报）；`packages/services/src` 剩余 14（`conversationShare*` 3、`settingsSync` 2、`commandsService` 1004、`memoryService`、`fsFaultInjection` 等）；`packages/zcode-server-cli/src` 剩余 41；`packages/web` 17。**另有两格结构空白**：`packages/app/src/features/**` 不在守门 128 的配对源里（同族第三份活实现改了像素不移动任何读数），`*.module.css` / CSS-in-JS 形态尚未测量——不得读成"已确认没有"。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `G-G-382`(族名在编号段出现两次)。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 G-382 已被 9 行认领(L8289,8540,8630,8657…),改回就等于替这本账再加一枚撞号;现号 `G-777`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。
```

- 原 L11054(L1 外部持有行 L7608):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7698(G-402) 同题,派单以持有行为准,本行不再单独派单。〕 G-813374 **设置项"显式清空"与"从未设置"无差，且读侧同一含义两键相反（需拍板；归属：api 设置面 + web 设置页持有人）** —— 已亲自复验：`apps/api/src/routes/user/settings-routes.ts:55` 写体是 `z.record(z.string(), z.unknown())`，落库处 `value === null || value === undefined ? null : String(value)` ⇒ `null` 与"缺席"存成同一个 NULL 行；读侧 `apps/web/app/(main)/settings/notifications/page.tsx:48-52` 四键混用 `!== 'false'`（默认真）与 `=== 'true'`（默认假），于是**同一个被清空的值，在前一族读回 true、在后一族读回 false**。上游同族做法是把三态写进契约（`settings/pluginConfigPatch.ts:29-36`：`undefined`=未触碰跳过、`null`=进 `clearOptionKeys`、sensitive 空串=不改已有值；落库侧 `file-config.adapter.ts:557-565` 按 option key 合并而非整对象替换，防同 scope 密钥被静默清空）。**为什么还开着**：改成三态要动 PUT 语义（单键 DELETE 出口我方根本没有——`deleteUserPreference` 只服务 devices），属对外契约决策；先拍"要不要有删键出口"，再谈读侧归一。**不得**靠"读侧统一成 `=== 'true'`"消红——那会把默认真的四项静默翻转。〔2026-09-29 改号(承 D168 第四遍收尾):剥掉双前缀后本行会与既有 **G-374**(标题「G-374ihui-auth-user里存了is」)**同主键 —— 那不是畸形号而是**真撞号**,所以这里不剥前缀而是取当次空闲新号;原编号位写的是「G-G-」。〕〔【归并】重复登记副本(2026-10-07):同主键的另一条登记 「G-402 · 设置项"显式清空"与"从未设置"无差」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11060(L1 外部持有行 L15728):

```
- [ ]（【归并】重复登记副本·同题不同编号·2026-10-09·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘②):本行已让号至 D1047(持行在面),指针后残留编号声明位摘除,正文逐字保留。〕**断线窗口待决审批的重放(承 D131 取证;等 §24 拍板 A/B/C)** —— 取证已证"会丢"(`apps/ai-service/tests/test_d131_pending_approval_resume.py` 6 例 RC=0)。三条修法与爆炸半径:A=服务端在重连时重放仍待决的条目(改 `llm.py::_approval_sessions` 与 agents 侧待决表的取用点,**须与 `sse_contract` 同批**);B=让主对话流帧出口写 `id:`(动 `_sse()` 是全仓共用出口 ⇒ 影响所有流式消费端与两侧契约,须单独票 + 跨端同批);C=端侧在重连后显式再拉一次待决清单(新增一次读端点,不改服务端语义)。**等谁**:用户拍板选哪条(推荐 A,理由是"不新造对外能力、只补重放"),B 的跨端代价最大。**为什么不在本轮做**:票面写"证实会丢则修在服务端",但服务端改动与并行会话持有面(`llm.py`、`sse_contract.py` 此刻均 ` M`)撞车,按 §12 不代收。 —— 租约(2026-10-02):票面那句『此刻均 ` M`』的阻塞前提已解除(`app/routers/llm.py` 与 `app/core/sse_contract.py` 现读工作树 == HEAD),按票面推荐口径 **A** 开工:服务端在重连时重放仍待决的条目,与 `sse_contract` 同批;爆炸半径与验收以票面 A 档为准。 (原编号 D173;持有行题面「断线窗口待决审批的重放」)
```

- 原 L11071(L1 外部持有行 L15653):

```
- [ ]〔【归并】重复登记副本(2026-10-13):本行是同批租约标记产生的无号残影,本体=「G-815970 取消信号必须穿进」行(2026-10-13 已翻勾),派单以本体为准,本行不再单独派单。〕
```

- 原 L11074(L1 外部持有行 L15653):

```
- [ ]〔【归并】重复登记副本(2026-10-13):本行是同批租约标记产生的无号残影,本体=「G-815972 宿主中止一个回合必须带」行(2026-10-13 已翻勾),派单以本体为准,本行不再单独派单。〕
```

- 原 L11119(L1 外部持有行 L15722):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘):本行已让号至 O594(持行在面),merge 回流旧态摘号留指针,正文逐字保留。〕****`2f-ext` 升 blocking 已量好前置,按用户指令暂缓落地**(注册文件 `scripts/guardian-runner.mjs` 本轮不得改)。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「O81」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11122(L1 外部持有行 L15711):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11187(G-608) 同题,派单以持有行为准,本行不再单独派单。〕 G-608 **第十一批:沙箱默认严档落地 + 两路只读取证的 24 条发现落成可执行票(每条带落点与验收判据)**
```

- 原 L11131(L1 外部持有行 L15775):

```
- [ ] 另有 7 个脚本的 `--self-test` 仍走 `os.tmpdir()`(`check-workspace-dep-links` / 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L11137(L1 外部持有行 L7940):

```
- [ ] 71. chat 多端/多标签实时同步(**V2 #23 未交付,本轮重列**;先定 SSE 与 WS 双通道的「同一消息 patch 幂等」契约) 〔【归并】重复登记副本(2026-10-09):同主键的另一条登记 「71 · chat多端/多标签实时同步」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11140(L1 外部持有行 L7953):

```
- [ ] 72. `apps/desktop` 从薄壳到本地能力端点(本地 workspace 通道 + 增量索引 + 本地 git/diff + 离线降级;**保留前端单一事实源在 web,不复制 UI**) 进度(2026-09-27,不翻勾;第一路 J 撞轮限且零产出,第二路 J2 先落盘后交付):宿主侧本地 git 通道已完成 —— `src-tauri/src/git_status_core.rs`(纯函数 `-z` 解析 + 逐级包含性校验,非 UTF-8 路径判「判不了」而非 lossy)、`git_local_status.rs`(`EngineOutcome` 三态 Facts/CommandFailed/Undetermined,九小类致盲;空输出=无改动 与 解析失败=判不了 分家;前端永不可自报 root,须经 `git_authorize_workspace` 双重证明 + 登记表为空一律拒)、`git_channel_ipc.rs` 三条 command、`lib.rs` 注册。测试真跑:`rustc --test` **29 passed**(另 `--ignored` 2 passed 含真机冒烟与「挂起必报 TimedOut 且已强杀」),`cargo check` exit 0(单次预算已用完)。**未做四类**:① 前端消费面一行未写(未碰 apps/web,需 `invoke('git_workspace_status')` 那条 hook);② 离线降级/增量索引/diff 文本通道未做(本票只到工作区状态清单);③ `git_authorize_workspace` 现走完整 status,>5000 变更条目的仓库会被判 Budget 而永不能授权(改直调 `verify_root` 即收口,需第二次 cargo check);④ 符号链接/junction 逃逸一维未收口。J2 另如实登记一处覆盖面不确定:`cargo check` 究竟覆盖了 `verify_root` 重构前还是后的字节不可断定。 〔【归并】重复登记副本(2026-10-09):同主键的另一条登记 「72 · apps/desktop从薄壳到本地能力端点」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11144(L1 外部持有行 L15835):

```
- [ ] **D128 AI 对话链路四竞品对标 V4 收口线(19 条差距 / 5 个 Sprint)** —— 唯一入口 `docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`(87–105),本轮不在此复述差距正文,只登记排期与等待项。**S9 尺子先行(105→97)**:先落 `scripts/audit-benchmark-delivery.mjs`(V3 §八 自留建议至今未落地,`ls` 实测不存在)与 parity 门六端扩面,**顺序不可颠倒** —— #93/#94/#96 之所以能长期存在,正是因为 §9「多端连通」的机器判据只覆盖 web 一端(`check-agent-event-parity.mjs:537` 只扫 `apps/web/src`)。**S10 移动端可达性(93→94→95)**:RN 主屏 `apps/mobile-rn/src/screens/ChatScreen.tsx:652` 起只接 7/30 回调(逐名 `comm -23` 算出缺 23 个,含 `onToolCall`/`onToolApproval`/`onPlanUpdate`/`onTerminal*`/`onSubagent*`/`onUsage`/`onBudget`/`onQuestion`/`onFormRequest`/`onReconnect`),而同端 `AiAssistantN8nScreen.tsx:1412` 是完整实现、`src/utils/chat-render-model.ts` 的 4 个 `apply*` 在主屏零调用方 ⇒ 本票主体是**接线不是开发**;#94 是信任型缺陷(RN 与小程序 `tool-approval` 双零命中,手机上遇高危操作无弹窗)。**S11 保真(87→88→89→92)**、**S12 契约地基(99→100→101→102)**、**S13 传输计量收口(96→90→91→103→98)**。**等待项(归属:等用户拍板)**:#100 内置默认高危集**改变默认行为**(现 `_high_risk_tools_from_env` 未配 env 即 `frozenset()`,`agent_loop_v2.py:288-296`),按 §24 不得由实现票自行开工;#98 桌面端薄壳是 V3 #72 已拍板架构,本票**只对齐三处口径**(tauri.conf / `ensure-web-out.mjs` 自称唯一校验点 / `docs/MULTI_END.md §2.5`),不改选型。**解阻前置(可判)**:S10 之前必须先有 S9 的端能力档案表,否则清完的端下轮又漏。**本轮同时否证 7 条断言,均写进 V4 正文,不得照旧文派单**:①②③ 上述三条 V3 过期结论;④ `packages/app` 的 `ChatScreen` 并非「未导出」—— `src/index.ts:684` 导出在位,真问题是**全仓零消费方**(同包其它 4 个聊天屏都被 mobile-rn 复用)⇒ 归 #95;⑤ web **有**消息队列与 Steer(`queue-interaction-bar.tsx` 在库,D38 已✅)⇒ 队列**不是**差距,初稿列错了;⑥ #89 初稿「主聊天流无自动重连」**否证** —— api-client `client.ts:2078/2129/3443` 有重连与 `Last-Event-ID` 续传,web `send-message.ts:767-775` 已消费 `onReconnect`,缺陷窄化为「`connection-status.tsx` 四态件生产面零挂载(命中全在 `apps/web/tests/agent-task-progress-pane.test.tsx`) + 重连后待决审批恢复未取证」;#96 那句「web 反而没有续传」同批否证;⑦ 孤儿清单里的 `voice-note.tsx` 在 HEAD 与索引双双落空,只在工作树未跟踪面 ⇒ 摘出清单、按 §12 归属未定不动。**本轮交付**:V4 文档成文并注水印(`docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`,`watermark.mjs verify` 覆盖 1/1、残迹 0、损坏 0);六端回调覆盖数改用统一交集判据重算(web 全域 30/30、extension 19、cli 12、RN 主屏 7、RN 另一屏 17、miniapp 17),并登记「事件名口径 23 与回调名口径 17 不可混用」。**待办本体是 S9–S13 的实施,本行不因文档成文而翻勾。****本轮同时更正 3 条 V3 过期结论,不得照它们派单**:#73「小程序无 AI 对话页」已被代码推翻(`apps/miniapp-taro/src/pkg-ai/ai/chat.tsx` 1623 行,最新提交 `3f3e71a99` 09-27,按事件名覆盖 23/30);#51「`run_in_background` 只有 sleep/echo」已不成立(`task_executors.py` 现读 16 个 `async def` + import 期三面断言);#47「三套执行内核」应为「一套半」(`class AgentLoopV2` 唯一内核,但 `agent_loop.py` 仍以 `agent_executor` 被 `routers/agents.py:48`、`services/a2a_service.py:33`、`services/slash_commands.py:162` 三处生产引用)。 〔【归并】重复登记副本(2026-10-01):同主键的另一条登记 「D128 · AI对话链路四竞品对标V4收口线」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11147(L1 外部持有行 L15758):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L9959(G-417) 同题,派单以持有行为准,本行不再单独派单。〕 G-1018289 **全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红,登记以免被"修好我看见的那三道"再掩一次** —— ① 守门 [12] 交付报告一致性判 `PROJECT_PLAN.md` 自身违规 1 处:同一份账面里既写着"完整收尾/无后续建议"一类断言,又留着"后续工作/优化项"清单(AGENTS §10 那条互斥约束)。它在全量档是 warn、不挡提交,但它是**批量审计恒红清单**里的一项,留着就会有人天天来问"这红谁的"。出路只有两条且不得放宽判据:要么把该份报告改成"任务 X 已完成、还有 N 项后续"(推荐,因为活账确实还有),要么真把后续条目清干净再声明闭环。归该份批次报告的作者;现读定位:`node scripts/check-delivery-report-consistency.mjs`。② 同日实测的并发副作用登记:多会话同时提交时(本轮实测单窗口 27–47 枚),守门 [30a] 会把**别人重写提交留下的悬空对象**算在本次提交头上、[84] 会把**别人挂在共享索引里的暂存删除**报成待判 —— 两者本轮都已按仓里规定动作处置(悬空提交 `cf05a98386` 已 `git tag lost-commit/cf05a983` 备份并复跑 30a rc=0,其内容经祖先判据确认**已在主线**,零丢失;[84] 复跑 rc=0 并把那条暂存删除点名交回其持有人)。**留这一格是因为它没有判据**:目前没有任何一道门区分"本次引入的悬空"与"并发重写留下的同内容副本",而这型一旦攒多了就是 §22 那类丢 commit 事故的温床。③ 同轮只读量测的第三格(本机**此刻不成立**,故不是待修而是待防):六把常驻命令行工具在"调用方 cwd 不在仓库内"时仍都能解析到仓库(本机 `.git` 是指针文件,git 会向上找),所以依赖 cwd 的那一处今天没有实害;但 `scripts/union-converge.mjs` 与 `scripts/git-push-converge.mjs` **写死** `C:/Program Files/Git/cmd/git.exe`,而仓里已有唯一出口 `scripts/lib/gitdir.mjs`(§5b 明写"脚本一律不得依赖环境取 git"),另一台机(G 盘那份 checkout)实测 git 落点不同 ⇒ 换机即 ENOENT。`git-push-converge.mjs` 同时是唯一不按自身位置推根的一把(换个目录跑结论会变)。**取证教训一条,写给下一个想顺手"修"的人**:我第一轮把这些工具的失败猜成"模块顶层数组引用后声明常量 ⇒ TDZ",现读**否证**(那三处在函数体内求值),真因是我自己的探针把 msys 风格路径拼成了不存在的目录 —— 0 命中/含糊错先怀疑尺子,再怀疑世界,别照假设改生产工具。 〔让号记录(2026-10-02 F9 清偿批②):原号 G-417 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕
```

- 原 L11150(L1 外部持有行 L15701):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘):本行已让号至 G-210(持行在面),merge 回流旧态摘号留指针,正文逐字保留。〕**台账 F4(重复登记副本)对"同一待办的漂移副本"结构上失明 —— 现读一例:同一条 D41后续① 在 HEAD 有 9 份未勾选副本、其中 7 份正文互不相同(2026-09-28 量)**: `plan-tasks.mjs` 的 F1/F4 判据是"编号 + 标题前缀**逐字等值**",这既是它的优点(不做相似度猜判)也是它的洞 —— 并发 union 每次都留一份**带自己注记**的副本,前缀之后的正文一漂移,复合主键就不再相等,于是同一件事以 N 份"未勾选"长期并存。后果不是账面难看而是**派单被放大 N 倍**:本日两次 `plan-tasks-merge.mjs --heal --commit`(归并 30 行 / 34 行)把 F1/F4 都归到 0,而这一族一份都没被动到 ⇒ "跑过归并"不等于"这一族被覆盖"。出路只有两条且都不该由机器代裁:① 归并线逐组判"哪份是当前状态"(需要读注记语义,机器判不了);② 给登记侧加一条硬约束——同一件事要更新就**就地改那一条**(§1 第 2 条已有此规矩,缺的是让机器能在前缀一致而正文漂移时也点名)。本票**只登记现读证据与两条出路**,不改判据、不批量翻勾(批量翻勾 = 把别人的注记当噪声删,比原病更响)。归属:分叉合并归并线(同 G-363 那条持有)。 (编号改派留痕(2026-09-28):本行原取 G-417,与「全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红」一条撞成一号两事;取号发生在分叉的两条腿上,号段不共享。让位的是**本行**(它是我这一路登记的),别人的行不动;新号由取号令牌按当次 CAS 的 HEAD 现算,落地后须复核它不与任何行首编号重复。正文一字未动。)
```

- 原 L11157(L1 外部持有行 L7654):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7745(G-681) 同题,派单以持有行为准,本行不再单独派单。〕 **G-333. 行号指针在活文档 union 后回到 211 处(其中 205 处无自动出口)+ 同主键两态 20 组复活(2026-09-28 现读,归各行持有人;判据没有坏)**:现读(`node scripts/plan-tasks.mjs --gate`,判定面 HEAD blob)**F3 行号指针 211 处 = 可自动收口 6 / 无出口交人工 205**,而本会话上一枚计划文档提交前这一维是 **8 处**;同一次合并还带回 **F1 同主键两态并存 20 组 / 涉及未勾选行 28**。**成因不是判据变尖,是载体换了一批行**:合并 `6226d6449` 的活文档档走"两侧行 union",把对侧新登记的一整批「…登记在 L####」式证据指针原样并进来 —— §1 明文「证据指针禁止写行号,行号在任何一次 append 后都会挪位」,所以**唯一出路是把这些行改成内容锚点(编号 + 标题原文),不是把 F3 族表放宽去迁就它们**(放宽 = 替人做出"这一族已合规"的判断,与本仓"判据必须覆盖门自己产出的形态"相反)。**为什么这不是一台恒红门**:提交链跑的是差值棘轮(`--staged --gate` 只拦"本次让分叉变多"),全量档只点名,所以下一个人正常提交不会为别人欠的账跳门(§12e);要问责存量跑 `--gate --strict`(现读即红,那是它拒绝出合格证,不是仓库故障)。**逐条出路(不得整批改)**:① 6 处可自动收口的由 `node scripts/plan-tasks-merge.mjs --heal --commit` 收(它只动 `autoFixable` 的行 —— 即"目标行仍是同复合主键的条目行"那一格);② 205 处无出口的**只能由该行持有人改写**:取清单 `node scripts/plan-tasks.mjs --pointers`,模板就用归并器自己产出的措辞(`同主键的另一条登记「编号 · 标题」`),因为 F3 认它、而写行号不认;③ 20 组 F1 复活行**本轮不要再清** —— 上游生产者已由 `8fa037255` 那行登记(自动归档器按磁盘底稿整文件写回),生产侧没修之前清完就会被下一次 union 带回,白烧提交与门禁链。**归属分层**:G- 号这条判据与两个出口由台账工具线持有;205 处指针文本归各行持有人;生产者侧(归档器取材面)归 `8fa037255` 那行的持有人。**它在等什么**:等各行持有人按 ② 改写,不等环境条件、也不等技术参数。**核验本行是否解除**:`--gate` 现读 F3 的"无出口交人工"归零且 F1 为 0 组。 〔【归并】重复登记副本(2026-10-09):同主键的另一条登记 「G-333 · 行号指针在活文档union后回到211处」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11161(L1 外部持有行 L15670):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11120(G-393) 同题,派单以持有行为准,本行不再单独派单。〕 G-354 **门 33 的 provider 名单该由谁供给(归属:守门 33 持有人;等人拍板)** —— 现读 7 个在 `.env` 的合法 provider 被判"未知",默认档只 warning 所以 rc 0。**为什么还开着**:config.py 的设计是"新增 provider 零代码改动、自动识别",而本门的名单是手抄副本;两种收口动作语义相反——① 把 7 个补进名单 = 继续养第二份真相,② 由 `.env`/服务端能力清单单向投影 = 改一道 blocking 门的判据。必须先定"这份名单到底要不要存在"。**不得**为让 warning 归零去删判据或放宽规则 3。 〔【归并】重复登记副本(2026-10-01):同主键的另一条登记 「G-354 · 门33的provider名单该由谁供给」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11162(L1 外部持有行 L15579):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7765(G-763) 同题,派单以持有行为准,本行不再单独派单。〕 G-355 **MemberCard 把"没量到"显示成 0(第八轮对照逼出;归属:web 首页持有者;等 §17 运行时自验排期)** —— `apps/web/src/components/home/MemberCard.tsx:72-73` 现读 `stats?.points ?? 0` / `wallet?.balance ?? 0`,查询未回或失败时显示"0 分""0 余额"。上游同族口径是"订阅未知不能发布为成功空快照"(`packages/services/src/usage-stats/providers/bigmodelUsageQuotaProvider.ts:259` 原文)加展示层 `'--'` 占位。**为什么还开着**:属 UI 改动,§17 要求起 dev + 读 DOM 数值自验,本票未做该项;改法是 `number | null` + 占位,不动判据、无恒红风险。**这一条不是"抄上游功能",是把"未知"与"为零"分开** —— 后者是数据事故,前者是显示诚实。 〔【归并】重复登记副本(2026-10-01):同主键的另一条登记 「G-355 · MemberCard把"没量到"显示成0」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11163(L1 外部持有行 L7603):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7693(G-395) 同题,派单以持有行为准,本行不再单独派单。〕 G-356 **配置分层的"出处标签"与"请求档 vs 实得档"留痕(归属:cli/子代理线持有人;等产品拍板)** —— 上游 `packages/provider/src/resolver.ts:190/196/208` 三层 overlay 且每个生效对象带 `source` 标签、快照的 `sourceRevisions` 被真实消费;我方 `apps/cli/src/subagents/precedence.ts:195-205` 的四层短路链**没有出处标签**,且 `git grep -I "requestedEffort\|effectiveEffort\|validateModelSelection"` HEAD 面现读 **0 命中** ⇒ 静默降档无法归因。**为什么还开着**:新建"配置分层解析出口"属 §24 新增能力、且是跨端数据建模,不在本轮取证范围;上游那两格(`effective-model-selection.ts` 的 `selectionIssue` 六值枚举、`model-selection-config.ts:76-77`"不能静默补档位")是它的前置形状,可作参考实现但不是本轮交付物。 〔【归并】重复登记副本(2026-10-01):同主键的另一条登记 「G-356 · 配置分层的"出处标签"与"请求档vs实得档"留痕」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11165(L1 外部持有行 L7605):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7695(G-397) 同题,派单以持有行为准,本行不再单独派单。〕 G-358 **锁的"租约认 token 不认 pid"一格只登记、未代裁(归属:`git-lock`/`deploy-lock` 持有人)** —— 上游 `packages/provider-node/src/zcode-builtin-remote-synchronizer.ts:85` 取 `leaseId=randomUUID`、`:143` 的 `#finishLease` 只在 leaseId 相等时才改控制文件,于是"pid 被系统复用"这一型**结构上不可能发生**;而我方是事后补的一环(`scripts/lib/proc-identity.mjs` 的 match/mismatch/unverifiable,承 G-193 那次冻结 11h50m)。**为什么还开着**:改两处锁的 meta 属锁持有人领地,且今天没有可复现的抢占现场做验收依据;真要收它,判据应是"注入一次 leaseId 不相等的迟到 finish 请求,控制文件必须不被改动",而不是"代码写了 leaseId"。 〔【归并】重复登记副本(2026-10-01):同主键的另一条登记 「G-358 · 锁的"租约认token不认pid"一格只登记」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11166(L1 外部持有行 L7606):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7696(G-398) 同题,派单以持有行为准,本行不再单独派单。〕 G-359 **第八轮剩余六格候选清单(归属:未派;等各线排期;本轮只取证未实现,逐格带出处)** —— ① 跨层发布闸:上游 `registry-service.ts:205-212` 在"下层已变而上层仍基于旧事实"时**不发混合快照**、继续服务上一份完整 Registry,而我方这条纪律只活在门的散文里、运行时层无出口;② 稀疏 overlay 空即删:`config-service.ts:513-516` 与继承值等价的配置不落盘(absence=继承,不是"空覆盖");③ 诊断量代替原文:`officialMcpCredentials.ts:52-90/359-376` 只记 JWT 剩余秒数并按小时分桶去重,可接我方唯一脱敏出口 `packages/shared/src/utils/redact.ts`;④ 告警去重身份=桶+周期而非墙钟窗口:`startPlanQuotaReminderStore.ts:33-36` 用快照 `referenceTime` 裁决(设备时间可能已越过服务端周期)、`bucketReminderKey` 缺任一字段即不提醒;⑤ in-flight 合并 + CAS 驱逐:`zaiStartPlanBilling.ts:113-122` 失败响应同样保留 1s(防 429 后立刻重复请求)且驱逐前 `if (requests.get(k) !== request) return`(旧请求不得删新记录),上游该守卫三处同形,是我方共享工作区并发写可直接取用的最小实现;⑥ 幂等 key 复用规则:`codingPlanQuotaResetCoordinator.ts:307-329` 瞬时错复用原 key、成功或稳定错才置 null,且服务端 `next_try_at` 必须透传(:617-624)。**为什么还开着**:六格都是"能落但需各自定级与验收"的独立改动(①②碰运行时快照语义、③④⑤⑥碰告警与并发路径),打包成一票会互相遮蔽;派单时逐格取,勿一次全接。**另有一格需产品先定**:上游 `usage-quota.ts:71` 的 `percentage` 是**已用**占比、而 Start Plan 侧 `:1338` 同名字段是**剩余/总额**,现靠"两族走不同 reader"规避,**无类型或判据看守** —— 要不要收口成"以 remaining 为权威、percentage 仅降级",属契约决策。 〔【归并】重复登记副本(2026-10-01):同主键的另一条登记 「G-359 · 第八轮剩余六格候选清单」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11172(L1 外部持有行 L15577):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7673(G-349) 同题,派单以持有行为准,本行不再单独派单。〕 **G-316. 门 8 清账后遗留的三枚"有消费方的待实装路由"(2026-09-28 登记,现读=基线仅剩 3 处)**:① `GET /api/subagents/all` —— 消费者 `apps/web/app/(main)/agent-teams/page.tsx:58`(期望 `{dispatches}` 含 completed/failed/cancelled 全量);后端只有 `/subagents/active`(仅 pending/running,形状恰好相同但语义是子集,**不得**为省事把客户端改道 active —— 那会把"页面少了历史"写成"已修")。正解 = 在 `subagent-dispatch.ts` 补 all 列表路由(带 status/limit 透传)。②③ `PUT /api/ai/n8n/workflows/:id` 与 `POST .../toggle` —— 消费者 `apps/mobile-rn/src/screens/N8nModelScreen.tsx:146/192`(保存改名/启停今天必 404);后端 n8n 面只有列表透传与创建转发(miniapp-compat-routes.ts:1123/1190),n8n REST API 本身支持 workflows/:id 更新与 activate/deactivate,正解 = 在 n8n 代理补两枚透传(SSRF 校验与 env 缺省回 stub 的既有纪律照抄)。验收判据:两枚消费者页面真机/真会话各跑一次成功路径 + 基线 `scripts/api-routes-baseline.json` 清零 + 门 8 末行现读 0。**归属**:subagent 面 = agent-teams 线;n8n 两面 = n8n 代理持有人(本票只登记形状与消费者证据,不代裁实现位置)。 〔落地@2026-09-28/枚 2704c4d27〕三枚路由已入库:subagents/all(新→旧+status/limit)、/ai/n8n/workflows 面四枚(list stub/写 503/fetch-merge-put/toggle 回读真值);apps/api/tests/g299-new-routes.test.ts 4 例绿、门 8 死调用清零、基线 perFileCount 清表。**本票未翻勾的唯一理由=验收判据第一条未跑**:RN N8nModelScreen 真机走查(本机无设备)与 agent-teams 页真会话 200 取证(需起栈)——路由与契约已证,运行时成功路径待验,不得以单测冒充真机。
```

- 原 L11173(L1 外部持有行 L15701):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11128(G-453) 同题,派单以持有行为准,本行不再单独派单。〕 G-453 **台账 F4(重复登记副本)对"同一待办的漂移副本"结构上失明 —— 现读一例:同一条 D41后续① 在 HEAD 有 9 份未勾选副本、其中 7 份正文互不相同(2026-09-28 量)**: `plan-tasks.mjs` 的 F1/F4 判据是"编号 + 标题前缀**逐字等值**",这既是它的优点(不做相似度猜判)也是它的洞 —— 并发 union 每次都留一份**带自己注记**的副本,前缀之后的正文一漂移,复合主键就不再相等,于是同一件事以 N 份"未勾选"长期并存。后果不是账面难看而是**派单被放大 N 倍**:本日两次 `plan-tasks-merge.mjs --heal --commit`(归并 30 行 / 34 行)把 F1/F4 都归到 0,而这一族一份都没被动到 ⇒ "跑过归并"不等于"这一族被覆盖"。出路只有两条且都不该由机器代裁:① 归并线逐组判"哪份是当前状态"(需要读注记语义,机器判不了);② 给登记侧加一条硬约束——同一件事要更新就**就地改那一条**(§1 第 2 条已有此规矩,缺的是让机器能在前缀一致而正文漂移时也点名)。本票**只登记现读证据与两条出路**,不改判据、不批量翻勾(批量翻勾 = 把别人的注记当噪声删,比原病更响)。归属:分叉合并归并线(同 G-363 那条持有)。 (编号改派留痕(2026-09-28):本行原取 G-417,与「全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红」一条撞成一号两事;取号发生在分叉的两条腿上,号段不共享。让位的是**本行**(它是我这一路登记的),别人的行不动;新号由取号令牌按当次 CAS 的 HEAD 现算,落地后须复核它不与任何行首编号重复。正文一字未动。) (编号改派留痕(2026-09-28):本行原取 G-417,与「全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红」一号两事。让位的是**本行**(它是我这一路登记的,别人的行一字未动)。新号是**手工取并逐面复核过的**(G/D/O 不相关,只看 G 族):台账行首集合 + 归档件全文 + 工作树副本三处均无 453 —— 因为取号令牌在改派场景下两次交回了"正在被让位的那个号"(它返回 G-417,而当时台账该族 max 已到 419/429),这个缺陷另立一票 G-454。正文一字未动。)
```

- 原 L11175(L1 外部持有行 L15579):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7765(G-763) 同题,派单以持有行为准,本行不再单独派单。〕 G-355 **MemberCard 把"没量到"显示成 0(第八轮对照逼出;归属:web 首页持有者;等 §17 运行时自验排期)** —— `apps/web/src/components/home/MemberCard.tsx:72-73` 现读 `stats?.points ?? 0` / `wallet?.balance ?? 0`,查询未回或失败时显示"0 分""0 余额"。上游同族口径是"订阅未知不能发布为成功空快照"(`packages/services/src/usage-stats/providers/bigmodelUsageQuotaProvider.ts:259` 原文)加展示层 `'--'` 占位。**为什么还开着**:属 UI 改动,§17 要求起 dev + 读 DOM 数值自验,本票未做该项;改法是 `number | null` + 占位,不动判据、无恒红风险。**这一条不是"抄上游功能",是把"未知"与"为零"分开** —— 后者是数据事故,前者是显示诚实。
```

- 原 L11176(L1 外部持有行 L7603):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7693(G-395) 同题,派单以持有行为准,本行不再单独派单。〕 G-356 **配置分层的"出处标签"与"请求档 vs 实得档"留痕(归属:cli/子代理线持有人;等产品拍板)** —— 上游 `packages/provider/src/resolver.ts:190/196/208` 三层 overlay 且每个生效对象带 `source` 标签、快照的 `sourceRevisions` 被真实消费;我方 `apps/cli/src/subagents/precedence.ts:195-205` 的四层短路链**没有出处标签**,且 `git grep -I "requestedEffort\|effectiveEffort\|validateModelSelection"` HEAD 面现读 **0 命中** ⇒ 静默降档无法归因。**为什么还开着**:新建"配置分层解析出口"属 §24 新增能力、且是跨端数据建模,不在本轮取证范围;上游那两格(`effective-model-selection.ts` 的 `selectionIssue` 六值枚举、`model-selection-config.ts:76-77`"不能静默补档位")是它的前置形状,可作参考实现但不是本轮交付物。
```

- 原 L11178(L1 外部持有行 L7605):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7695(G-397) 同题,派单以持有行为准,本行不再单独派单。〕 G-358 **锁的"租约认 token 不认 pid"一格只登记、未代裁(归属:`git-lock`/`deploy-lock` 持有人)** —— 上游 `packages/provider-node/src/zcode-builtin-remote-synchronizer.ts:85` 取 `leaseId=randomUUID`、`:143` 的 `#finishLease` 只在 leaseId 相等时才改控制文件,于是"pid 被系统复用"这一型**结构上不可能发生**;而我方是事后补的一环(`scripts/lib/proc-identity.mjs` 的 match/mismatch/unverifiable,承 G-193 那次冻结 11h50m)。**为什么还开着**:改两处锁的 meta 属锁持有人领地,且今天没有可复现的抢占现场做验收依据;真要收它,判据应是"注入一次 leaseId 不相等的迟到 finish 请求,控制文件必须不被改动",而不是"代码写了 leaseId"。
```

- 原 L11179(L1 外部持有行 L7606):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7696(G-398) 同题,派单以持有行为准,本行不再单独派单。〕 G-359 **第八轮剩余六格候选清单(归属:未派;等各线排期;本轮只取证未实现,逐格带出处)** —— ① 跨层发布闸:上游 `registry-service.ts:205-212` 在"下层已变而上层仍基于旧事实"时**不发混合快照**、继续服务上一份完整 Registry,而我方这条纪律只活在门的散文里、运行时层无出口;② 稀疏 overlay 空即删:`config-service.ts:513-516` 与继承值等价的配置不落盘(absence=继承,不是"空覆盖");③ 诊断量代替原文:`officialMcpCredentials.ts:52-90/359-376` 只记 JWT 剩余秒数并按小时分桶去重,可接我方唯一脱敏出口 `packages/shared/src/utils/redact.ts`;④ 告警去重身份=桶+周期而非墙钟窗口:`startPlanQuotaReminderStore.ts:33-36` 用快照 `referenceTime` 裁决(设备时间可能已越过服务端周期)、`bucketReminderKey` 缺任一字段即不提醒;⑤ in-flight 合并 + CAS 驱逐:`zaiStartPlanBilling.ts:113-122` 失败响应同样保留 1s(防 429 后立刻重复请求)且驱逐前 `if (requests.get(k) !== request) return`(旧请求不得删新记录),上游该守卫三处同形,是我方共享工作区并发写可直接取用的最小实现;⑥ 幂等 key 复用规则:`codingPlanQuotaResetCoordinator.ts:307-329` 瞬时错复用原 key、成功或稳定错才置 null,且服务端 `next_try_at` 必须透传(:617-624)。**为什么还开着**:六格都是"能落但需各自定级与验收"的独立改动(①②碰运行时快照语义、③④⑤⑥碰告警与并发路径),打包成一票会互相遮蔽;派单时逐格取,勿一次全接。**另有一格需产品先定**:上游 `usage-quota.ts:71` 的 `percentage` 是**已用**占比、而 Start Plan 侧 `:1338` 同名字段是**剩余/总额**,现靠"两族走不同 reader"规避,**无类型或判据看守** —— 要不要收口成"以 remaining 为权威、percentage 仅降级",属契约决策。
```

- 原 L11181(L1 外部持有行 L15686):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L10431(G-410) 同题,派单以持有行为准,本行不再单独派单。〕 G-382 **第 3 波待办（覆盖面本身，不是功能票）** —— 未读名单已报名，按此接手：`apps/zcode-cli/packages/core/src/{tool/handlers 120, runtime/methods 98, runtime/helpers 53, subagent 22, workflow 31, hooks 17, context 12, memory 10, browser-client 7}`；`packages/desktop/src/main/index.ts`(2384，装配主入口) + 遥测/ARMS 族 + `processResource*` 13；`packages/ui/src/lib` 剩余 workspace 22/task 21/provider 15/telemetry 9/tool 9；`packages/ui/src/v4`（W2-8 在报）；`packages/services/src` 剩余 14（`conversationShare*` 3、`settingsSync` 2、`commandsService` 1004、`memoryService`、`fsFaultInjection` 等）；`packages/zcode-server-cli/src` 剩余 41；`packages/web` 17。**另有两格结构空白**：`packages/app/src/features/**` 不在守门 128 的配对源里（同族第三份活实现改了像素不移动任何读数），`*.module.css` / CSS-in-JS 形态尚未测量——不得读成"已确认没有"。
```

- 原 L11200(L1 外部持有行 L11026):

```
- [ ]**D163 回退与预览失败必须声明「工作区未发生变化」,并把 Diff 快捷预览从三态补到五态(承 V4 §8.3③;一手取证 2026-09-28)。** 竞品原文:`undoUnavailableDescription:"文件检查点不可用，工作区未发生变化。"`、`undoFailedDescription:"CLI 文件检查点暂时不可用，工作区未发生变化。"`、成功态 `undoSucceededDescription:"已恢复 {{count}} 个文件；任务记录仍然保留。"`、确认态 `undoConfirmDescription:"将恢复 {{fileCount}} 个文件，并同时撤销从这轮开始受影响的 {{turnCount}} 轮修改。任务记录不会删除。"`、准备态 `undoPreparingDescription:"正在检查将恢复的文件和受影响轮次…"`、部分警告 `undoPartialWarning:"部分修改不在 CLI 文件检查点中，撤销结果可能不完整。"`;预览五态 `diffPreviewLoading / diffPreviewLoadFailed:"Diff 加载失败。移开后重新悬停可重试。"(给具体动作)/ diffPreviewExpired:"这份 Diff 记录已过期，无法快捷预览。"/ diffPreviewTooLarge:"Diff 过大，无法在快捷预览中显示。"/ diffPreviewUnavailable:"当前没有可供预览的文本 Diff。"`。**我方否证**:`git grep -niE "工作区未发生|未发生变化|nothing changed" -- packages/i18n/messages/web/zh-CN.json apps/web/src packages/shared/src` **零命中**;预览降级我方 D90 已✅三态(工具记录内容/无法读取当前文件/没有可预览内容),**缺"已过期"与"过大"两态及其动作出口**。**为什么重要**:回退是破坏性动作,用户敢不敢再试一次全靠"这次什么都没改成"这句承诺;这与 §「越权用例要断言未发出查询(`whereSeen===0`)」是同一条纪律的**用户界面版**——机器侧断言副作用未发生,人这一侧要给一句等价的话。**不得只改文案**:文案必须由"是否真的没改"这个事实驱动(撤销前记快照、失败后比对文件集与索引,不成立就不许说"未发生变化"),否则就是造一句安慰话。**归属**:可与第二条并行,但**依赖协议通道②/③(检查点可用性状态要能上报)**。**验收**:①注入一次"部分文件回滚失败",断言文案含具体文件数与"未变化"承诺,且该承诺由比对结果驱动(把比对改成恒真,用例必须翻红——变异对照);②预览五态各有用例,过期与过大两态必须给**下一步动作**而非只报失败。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「D163 · 回退与预览失败必须声明「工作区未发生变化」」,派单以那条为准,本行不再单独派单。〕 —— 租约(2026-10-02/goal-cont):现读复核票面前提，**两态预览那一半已在 HEAD**(枚 `63ad49be80` 交付 + `apps/web/src/components/media/__tests__/d163-preview-five-states.test.tsx` 现读 expired 给「重试+打开原文」、too-large 只给「打开原文」并断言无重试按钮 ⇒ 验收②的「给下一步动作」有界面级证据)；回退声明那一半的事实判据与消费点也已入库(`apps/web/src/lib/undo-fact-check.ts` + `apps/web/src/components/checkpoint/CheckpointRewindPanel.tsx:111-134` 真的走比对结果与 `count` 插值)。**本租约只补剩下那一格**:面板级用例(把「比对结论 → 用户看到的那句」钉成可红可绿,含变异对照),纯判据单测证不了改坏接线的形态。
```

- 原 L11254(L1 外部持有行 L10697):

```
- [ ] **等持有人拍板（不挂进行中：登记人此刻不动它，挂了租约就是给后来人留假锁）** G-814393 小程序主包已用到 **93.94%**（`pnpm check:all` 现读：主包 1,969,970 B / 硬上限 2,097,152 B / 余量仅 **127,182 B**，告警水位 90% 已破）—— 这是 `check:all` 当前**唯一**的非零退出项。登记前复核过：`grep '^- \[ \]'` 全集中提到「主包 / 2 MiB / 2,097 / AB1 / 产物预算 / 包体积」的未勾选条目**零条**（只有几条已完成行沾到这些词，且属别的话题）。红在干净 HEAD 上，按 §12f 优先级高于一切新增，但**处置动作属结构决策**不是清行数：`pages/member` 442,546 B / 31 文件与 `pkg-ai` 532,110 B / 121 文件是两块最大占用，把它们再拆独立分包 / 把静态资源外置 CDN 才会移动这个数字，而"哪些页面允许延后加载"改变的是用户首屏行为，须产品拍板。**不许为了让 `check:all` 变绿去调水位或改判据**（§12e：那是给已发生的债发通行证）。落地判据：改完后 `pnpm check:all` 末行 RC=0 且主包余量回到 >10%，且小程序真机首屏与 tabBar 页可达性实测过（不是只看构建产物）。前置排队原因如实：此刻生产被真分叉挡停（见 G-731 同族），在飞文件 11 个，不宜同时动分包结构。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-81439 · 等持有人拍板」,派单以那条为准,本行不再单独派单。〕 〔拍板@2026-10-13 机主授权代行:哪些页面延后加载——pages/member(442,546B/31 文件)整目录迁独立分包;pkg-ai 不再拆、静态资源不外置 CDN(不动首屏依赖链)。前置排队(生产真分叉挡停)已解除;实施须满足本行落地判据(check:all RC=0+主包余量>10%+真机 tabBar 页可达实测),按分包瘦身批排期执行,不许调水位改判据。〕
```

- 原 L11255(L1 外部持有行 L7939):

```
- [ ] 60. 真并行多窗格(store 从 `conversationId` 单例改为 `Map<paneId, State>`;独立 SSE/abort;服务端 fork 路由下放) 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「60 · 真并行多窗格」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11256(L1 外部持有行 L7940):

```
- [ ] 71. chat 多端/多标签实时同步(**V2 #23 未交付,本轮重列**;先定 SSE 与 WS 双通道的「同一消息 patch 幂等」契约) 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「71 · chat多端/多标签实时同步」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11257(L1 外部持有行 L7942):

```
- [ ] 77. Goal-driven 自评估闭环 + My Quests 跨 workspace 全局看板(依赖 51) 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「77 · Goal-driven自评估闭环+MyQuest」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11258(L1 外部持有行 L7943):

```
- [ ] 78. Experts 多智能体并行子模式(专家模板产品化 + 同文件写冲突治理:串行化或 worktree 隔离) 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「78 · Experts多智能体并行子模式」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11259(L1 外部持有行 L7944):

```
- [ ] 64. AI 消息可编辑 + 消息级 pin/书签(共用 59 的 sibling 存储) 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「64 · AI消息可编辑+消息级pin/书签」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11260(L1 外部持有行 L7947):

```
- [ ] 85. 离线/边缘优先降级(依赖 72;本地向量索引 + `ollama`/`lmstudio`/`llama_cpp` 三路 provider 已在适配表里) 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「85 · 离线/边缘优先降级」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11261(L1 外部持有行 L7953):

```
- [ ] 72. `apps/desktop` 从薄壳到本地能力端点(本地 workspace 通道 + 增量索引 + 本地 git/diff + 离线降级;**保留前端单一事实源在 web,不复制 UI**) 进度(2026-09-27,不翻勾;第一路 J 撞轮限且零产出,第二路 J2 先落盘后交付):宿主侧本地 git 通道已完成 —— `src-tauri/src/git_status_core.rs`(纯函数 `-z` 解析 + 逐级包含性校验,非 UTF-8 路径判「判不了」而非 lossy)、`git_local_status.rs`(`EngineOutcome` 三态 Facts/CommandFailed/Undetermined,九小类致盲;空输出=无改动 与 解析失败=判不了 分家;前端永不可自报 root,须经 `git_authorize_workspace` 双重证明 + 登记表为空一律拒)、`git_channel_ipc.rs` 三条 command、`lib.rs` 注册。测试真跑:`rustc --test` **29 passed**(另 `--ignored` 2 passed 含真机冒烟与「挂起必报 TimedOut 且已强杀」),`cargo check` exit 0(单次预算已用完)。**未做四类**:① 前端消费面一行未写(未碰 apps/web,需 `invoke('git_workspace_status')` 那条 hook);② 离线降级/增量索引/diff 文本通道未做(本票只到工作区状态清单);③ `git_authorize_workspace` 现走完整 status,>5000 变更条目的仓库会被判 Budget 而永不能授权(改直调 `verify_root` 即收口,需第二次 cargo check);④ 符号链接/junction 逃逸一维未收口。J2 另如实登记一处覆盖面不确定:`cargo check` 究竟覆盖了 `verify_root` 重构前还是后的字节不可断定。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「72 · apps/desktop从薄壳到本地能力端点」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11262(L1 外部持有行 L15722):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘):本行已让号至 O594(持行在面),merge 回流旧态摘号留指针,正文逐字保留。〕****`2f-ext` 升 blocking 已量好前置,按用户指令暂缓落地**(注册文件 `scripts/guardian-runner.mjs` 本轮不得改)。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「O81 · 票⑰——2f-ext升blocking已量好前置」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11263(L1 外部持有行 L15835):

```
- [ ] **D128 AI 对话链路四竞品对标 V4 收口线(19 条差距 / 5 个 Sprint)** —— 唯一入口 `docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`(87–105),本轮不在此复述差距正文,只登记排期与等待项。**S9 尺子先行(105→97)**:先落 `scripts/audit-benchmark-delivery.mjs`(V3 §八 自留建议至今未落地,`ls` 实测不存在)与 parity 门六端扩面,**顺序不可颠倒** —— #93/#94/#96 之所以能长期存在,正是因为 §9「多端连通」的机器判据只覆盖 web 一端(`check-agent-event-parity.mjs:537` 只扫 `apps/web/src`)。**S10 移动端可达性(93→94→95)**:RN 主屏 `apps/mobile-rn/src/screens/ChatScreen.tsx:652` 起只接 7/30 回调(逐名 `comm -23` 算出缺 23 个,含 `onToolCall`/`onToolApproval`/`onPlanUpdate`/`onTerminal*`/`onSubagent*`/`onUsage`/`onBudget`/`onQuestion`/`onFormRequest`/`onReconnect`),而同端 `AiAssistantN8nScreen.tsx:1412` 是完整实现、`src/utils/chat-render-model.ts` 的 4 个 `apply*` 在主屏零调用方 ⇒ 本票主体是**接线不是开发**;#94 是信任型缺陷(RN 与小程序 `tool-approval` 双零命中,手机上遇高危操作无弹窗)。**S11 保真(87→88→89→92)**、**S12 契约地基(99→100→101→102)**、**S13 传输计量收口(96→90→91→103→98)**。**等待项(归属:等用户拍板)**:#100 内置默认高危集**改变默认行为**(现 `_high_risk_tools_from_env` 未配 env 即 `frozenset()`,`agent_loop_v2.py:288-296`),按 §24 不得由实现票自行开工;#98 桌面端薄壳是 V3 #72 已拍板架构,本票**只对齐三处口径**(tauri.conf / `ensure-web-out.mjs` 自称唯一校验点 / `docs/MULTI_END.md §2.5`),不改选型。**解阻前置(可判)**:S10 之前必须先有 S9 的端能力档案表,否则清完的端下轮又漏。**本轮同时否证 7 条断言,均写进 V4 正文,不得照旧文派单**:①②③ 上述三条 V3 过期结论;④ `packages/app` 的 `ChatScreen` 并非「未导出」—— `src/index.ts:684` 导出在位,真问题是**全仓零消费方**(同包其它 4 个聊天屏都被 mobile-rn 复用)⇒ 归 #95;⑤ web **有**消息队列与 Steer(`queue-interaction-bar.tsx` 在库,D38 已✅)⇒ 队列**不是**差距,初稿列错了;⑥ #89 初稿「主聊天流无自动重连」**否证** —— api-client `client.ts:2078/2129/3443` 有重连与 `Last-Event-ID` 续传,web `send-message.ts:767-775` 已消费 `onReconnect`,缺陷窄化为「`connection-status.tsx` 四态件生产面零挂载(命中全在 `apps/web/tests/agent-task-progress-pane.test.tsx`) + 重连后待决审批恢复未取证」;#96 那句「web 反而没有续传」同批否证;⑦ 孤儿清单里的 `voice-note.tsx` 在 HEAD 与索引双双落空,只在工作树未跟踪面 ⇒ 摘出清单、按 §12 归属未定不动。**本轮交付**:V4 文档成文并注水印(`docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`,`watermark.mjs verify` 覆盖 1/1、残迹 0、损坏 0);六端回调覆盖数改用统一交集判据重算(web 全域 30/30、extension 19、cli 12、RN 主屏 7、RN 另一屏 17、miniapp 17),并登记「事件名口径 23 与回调名口径 17 不可混用」。**待办本体是 S9–S13 的实施,本行不因文档成文而翻勾。****本轮同时更正 3 条 V3 过期结论,不得照它们派单**:#73「小程序无 AI 对话页」已被代码推翻(`apps/miniapp-taro/src/pkg-ai/ai/chat.tsx` 1623 行,最新提交 `3f3e71a99` 09-27,按事件名覆盖 23/30);#51「`run_in_background` 只有 sleep/echo」已不成立(`task_executors.py` 现读 16 个 `async def` + import 期三面断言);#47「三套执行内核」应为「一套半」(`class AgentLoopV2` 唯一内核,但 `agent_loop.py` 仍以 `agent_executor` 被 `routers/agents.py:48`、`services/a2a_service.py:33`、`services/slash_commands.py:162` 三处生产引用)。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「D128 · DD128AI对话链路四竞品对标V4收口线」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11265(L1 外部持有行 L15701):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘):本行已让号至 G-210(持行在面),merge 回流旧态摘号留指针,正文逐字保留。〕**台账 F4(重复登记副本)对"同一待办的漂移副本"结构上失明 —— 现读一例:同一条 D41后续① 在 HEAD 有 9 份未勾选副本、其中 7 份正文互不相同(2026-09-28 量)**: `plan-tasks.mjs` 的 F1/F4 判据是"编号 + 标题前缀**逐字等值**",这既是它的优点(不做相似度猜判)也是它的洞 —— 并发 union 每次都留一份**带自己注记**的副本,前缀之后的正文一漂移,复合主键就不再相等,于是同一件事以 N 份"未勾选"长期并存。后果不是账面难看而是**派单被放大 N 倍**:本日两次 `plan-tasks-merge.mjs --heal --commit`(归并 30 行 / 34 行)把 F1/F4 都归到 0,而这一族一份都没被动到 ⇒ "跑过归并"不等于"这一族被覆盖"。出路只有两条且都不该由机器代裁:① 归并线逐组判"哪份是当前状态"(需要读注记语义,机器判不了);② 给登记侧加一条硬约束——同一件事要更新就**就地改那一条**(§1 第 2 条已有此规矩,缺的是让机器能在前缀一致而正文漂移时也点名)。本票**只登记现读证据与两条出路**,不改判据、不批量翻勾(批量翻勾 = 把别人的注记当噪声删,比原病更响)。归属:分叉合并归并线(同 G-363 那条持有)。 (编号改派留痕(2026-09-28):本行原取 G-417,与「全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红」一条撞成一号两事;取号发生在分叉的两条腿上,号段不共享。让位的是**本行**(它是我这一路登记的),别人的行不动;新号由取号令牌按当次 CAS 的 HEAD 现算,落地后须复核它不与任何行首编号重复。正文一字未动。) 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-417 · 台账F4」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11266(L1 外部持有行 L8018):

```
- [ ]47. 三套执行内核工具集归一(A/B/C → 唯一工具注册表 `mcp_server._TOOLS`;AgentEngine 15 个工具映射或移植;JSON-RPC 只留协议适配层;CI parity 断言 `BUILTIN_ENGINE_TOOLS` ⊆ `_TOOLS` 映射完整) 〔PROGRESS 2026-09-27(五路并行第一波,ab4fed16d 前一枚):已落 J11/J14 两面 + 引擎内置名经 `resolve_engine_tool` 归口(归口在 `_ADMIN_ONLY_TOOLS` 判定之前,否则 unified_exec 这类名字会绕过角色矩阵)。实测 `BUILTIN_ENGINE_TOOLS` 是 **14 枚不是票面的 15**。**未闭环**:第三格「JSON-RPC 只留协议适配层」未做 —— agent_engine 的 RPC 面仍自带工具定义。票保持未勾。〕 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「47 · 三套执行内核工具集归一」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11267(L1 外部持有行 L15779):

```
- [ ] 4. 观察期:**首个 GREEN run 达成(2026-09-14,ac4acf3f:577 passed / 0 failed / 4 flaky / 66 skipped 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕〔sha无从找回:ac4acf3f=首个GREEN run(2026-09-14,577 passed)旧史提交,单根02b2d353ad之前,结构上无从找回〕
```

- 原 L11268(L1 外部持有行 L8019):

```
- [ ] **守门 134 的两格条件性扩面（各自写了可判触发条件,未达即不做,未认领）**：① B2 那一跳接裸 SQL 维 —— 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「B2 · 守门134的两格条件性扩面」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11269(L1 外部持有行 L8024):

```
- [ ] **O88. 台账孪生副本的其余三型无人覆盖(2026-09-28 现读,归台账持有人)**:① `--twins` 报 73 条"已闭环登记的未勾孪生",其中只有 22 条**正文逐字等值**算可证,本轮翻勾 4 条、余 18 条正文自带「仍未注册 / 刻意没动待用户定性 / 本票不认领」措辞**不得自动翻勾**(把没做的记成做过的比原病更响),要逐条人工裁;② 另 51 条只靠相似度(0.63 至 0.95)配对,AGENTS §1 明文"相似度只能报数,不配判红",现无判据可落;③ **已完成行自身**的逐字孪生 191 组 / 448 行(可省 257 行)结构上没人管 —— F4b 只比未勾行、F6 要求连续 ≥3 行重复块、归档器只搬三级标题粒度条目(bullet 级 1784 行按设计"不搬也不护")。**它在等什么**:等持有人定"逐字孪生"的收口形态(翻勾注记 / 归档搬走 / 原样保留),不是等环境条件,也不是等某个技术参数。取证一律现读:`node scripts/check-task-claims.mjs --twins`、`node scripts/plan-tasks-merge.mjs`、`node scripts/plan-tasks-merge.mjs --dedupe-blocks`。 —— **2026-09-28 现读归正(前两条已收口)**:行号指针维由 F3 族表+同集修复出口收口(旧判据只认「存活于 L<行号>」而该族现读 0 条,归并器自产的「另一条登记在 L<行号>」222 处全隐身;现收紧到禁写行号本身,面上行号指针 0 处),到期租约维由门 109 的两条 CL1 按 §1 出路清账,门 109 现读 0 红。**仍待裁的一型**:③ ① 行号指针维:F3 原先只认「存活于 L<行号>」一种措辞而该族 HEAD 面现读 0 条,归并器自己产的「同主键/逐字相同的另一条登记在 L<行号>」222 处全隐身(47 处指到别的话题 / 160 处目标行根本不是条目行 / 15 处落空),账面 F3=0 而 §1 明令禁止的证据形态满账;现改为**族表**判据 + 与之同集的修复出口(镜像 T11 钉"判得到必须修得了"),并收紧到"禁写行号"本身(指得准的行号指针也判红),现读面上行号指针 **0 处**。② 到期租约维:门 109 的 2 条 CL1 已按 §1 出路清账(有同题已完成登记的那条翻勾并摘牌;正文自述"刻意不当场执行"的那条不翻勾,改写成待认领并写明认领姿势)—— 该门是 `stagedTriggers=PROJECT_PLAN.md` 的 blocking 门,红着等于每次提交计划文档都被逼跳门(§12e)。**仍待裁的一型** —— ③ `--twins` 现读 **102 条**"已闭环登记的未勾孪生",其中靠**相似度**(0.63–0.95)或**包含**配上的约 93 条,按 §1「相似度只配报数,不配判红」一条都不能自动动;逐条分类已出(77 判同一句被复制、3 判不出、0 判成不同事),可自动子集仅 10 行,而那份分类的关键词筛在 35/80 行**漏判**未完成语义(反向 0 漏判)⇒ 这 10 行也不自动落,报告落在 `.ihui-agent/tmp/twin-adjudication/report.md`(临时区,不入库,需要就重跑)。**它在等什么**:等持有人按报告逐条裁"该记完成还是仍开" —— 自动挂"重复登记副本"指针会把真任务从派单口径里静默摘掉,那比账面重复更贵。取证一律现读:`node scripts/check-task-claims.mjs --twins`、`node scripts/plan-tasks.mjs --gate`(F3/F4/F4b/F6 四行)、`node scripts/plan-tasks-merge.mjs`。 **2026-09-28 再归正(第三条)**:上面③那句"三面全不判"已被并发的另一路会话补上 —— 现读 `node scripts/plan-tasks.mjs --gate` 有 **F10 已完成行的逐字孪生(done 侧)224 组 / 多余副本 339 行**,默认档只报数、差值棘轮只拦新增,逐组出口 `node scripts/plan-tasks-merge.mjs --dedupe-done-twins`,**升 blocking 的前置是存量清零**(§12e)。所以本行剩下的真待裁只余"相似度孪生"那一族。 **2026-09-28 再归正(第四条:判据第三次落后于产出形态)**:面上仍有 2 处行号指针写作「…的完成登记在 L13178」「…入库登记在 L8584」这类拼法,而 F3 的 dup 族要求前缀恰为「(同主键|逐字相同)的另一条登记在」—— 这两串既没有"的"也没有"另一条" ⇒ 判据再次看不见自己产出的形态,现读 F3 仍报 0 处。一行修法已备好待该文件持有人落:把 dup 族前缀改成可选 `(?:同主键|逐字相同)?(?:的另一条|的权威|的)登记在\s*L(\d{1,6})`,并配一条活体对照(数面上 `(存活于|登记在)\s*L\d` 的出现次数,判据报 0 而它非 0 ⇒ 判"族表落后"而不是通过)。本会话试过改这一行,但 `scripts/lib/plan-task-index.mjs` 此刻被并发会话持有(工作树 83 增/12 删在飞,含 F10 与 FORK_POINTER_RE 两条新判据),继续改等于替他们把半成品提交进去 ⇒ 已逐字还原,只把修法与取证交回本行。 —— **2026-09-28 第五条更正(撤回第三条里的三处不实;数字一律当次现读)**:① 上一条写的"现读 `plan-tasks.mjs --gate` 有 F10 已完成行的逐字孪生(done 侧)224 组 / 多余副本 339 行,默认档只报数、差值棘轮只拦新增,逐组出口 `plan-tasks-merge.mjs --dedupe-done-twins`"**三处都不成立**:HEAD 面上没有叫 F10 的维(该行维度在 `--gate` 里印作「同态重复(done 侧只报数)」,JSON 键 `dupDoneGroups`),`--dedupe-done-twins` 这条出口**从未实现**(现跑被"未识别的参数"拒掉并 exit 2 —— 那个拒参数守卫是另一路会话为同一件事补的,现读 `git grep -c "dedupe-done-twins" HEAD -- scripts` 只在注释与测试里命中,且它们写的正是"一个从未实现过的出口"),而 224/339 是**并发会话未提交的工作树判据**跑出来的读数,不是被审面读数。② 当次现读(HEAD blob 面,`node scripts/plan-tasks.mjs --gate`):done 侧 85 组;F3 行号指针 8 处(可自动收口 0、无出口交人工 8)。③ 所以这一族的真状态是**待补出口**,不是"出口已在":已完成行的逐字孪生目前没有任何机器出口,而 §1 禁止无声删除 ⇒ 出路只能是"每小节各留一份、其余改写为归并指针"(算法未实现;全局留 1 份会把跨小节单元里该节的唯一登记抹掉,信息仍在别处而按章节读账的人看不见)。④ 同一条通道解除上一条:dup 族前缀已放宽为含 `(?:完成)?`(现读 `scripts/lib/plan-task-index.mjs` 的 POINTER_FAMILIES 第二族),故"…的完成登记在 L…"「…入库登记在 L…」两型已被判到,面上行号指针余 8 处且全部无自动出口(目标行已不是条目行,作者原指哪一条不可推断 ⇒ 不许编锚点)。⑤ 规矩(本行是活的反例,写给后来人照抄):**登记"现读"之前必须确认读的是被审面** —— 判据脚本自己在飞(工作树 dirty)时它产出的数字属于别人未提交的版本,把它写进 HEAD 就是一句谁也复核不了的假陈述;核验姿势 = 先 `git status --porcelain -- scripts/<该判据>` 为空,或直接 `git grep -c "<新维名或新旗标>" HEAD -- scripts` 问 HEAD 本身。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「O88 · 台账孪生副本的其余三型无人覆盖」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11270(L1 外部持有行 L7654):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7745(G-681) 同题,派单以持有行为准,本行不再单独派单。〕 **G-333. 行号指针在活文档 union 后回到 211 处(其中 205 处无自动出口)+ 同主键两态 20 组复活(2026-09-28 现读,归各行持有人;判据没有坏)**:现读(`node scripts/plan-tasks.mjs --gate`,判定面 HEAD blob)**F3 行号指针 211 处 = 可自动收口 6 / 无出口交人工 205**,而本会话上一枚计划文档提交前这一维是 **8 处**;同一次合并还带回 **F1 同主键两态并存 20 组 / 涉及未勾选行 28**。**成因不是判据变尖,是载体换了一批行**:合并 `6226d6449` 的活文档档走"两侧行 union",把对侧新登记的一整批「…登记在 L####」式证据指针原样并进来 —— §1 明文「证据指针禁止写行号,行号在任何一次 append 后都会挪位」,所以**唯一出路是把这些行改成内容锚点(编号 + 标题原文),不是把 F3 族表放宽去迁就它们**(放宽 = 替人做出"这一族已合规"的判断,与本仓"判据必须覆盖门自己产出的形态"相反)。**为什么这不是一台恒红门**:提交链跑的是差值棘轮(`--staged --gate` 只拦"本次让分叉变多"),全量档只点名,所以下一个人正常提交不会为别人欠的账跳门(§12e);要问责存量跑 `--gate --strict`(现读即红,那是它拒绝出合格证,不是仓库故障)。**逐条出路(不得整批改)**:① 6 处可自动收口的由 `node scripts/plan-tasks-merge.mjs --heal --commit` 收(它只动 `autoFixable` 的行 —— 即"目标行仍是同复合主键的条目行"那一格);② 205 处无出口的**只能由该行持有人改写**:取清单 `node scripts/plan-tasks.mjs --pointers`,模板就用归并器自己产出的措辞(`同主键的另一条登记「编号 · 标题」`),因为 F3 认它、而写行号不认;③ 20 组 F1 复活行**本轮不要再清** —— 上游生产者已由 `8fa037255` 那行登记(自动归档器按磁盘底稿整文件写回),生产侧没修之前清完就会被下一次 union 带回,白烧提交与门禁链。**归属分层**:G- 号这条判据与两个出口由台账工具线持有;205 处指针文本归各行持有人;生产者侧(归档器取材面)归 `8fa037255` 那行的持有人。**它在等什么**:等各行持有人按 ② 改写,不等环境条件、也不等技术参数。**核验本行是否解除**:`--gate` 现读 F3 的"无出口交人工"归零且 F1 为 0 组。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-333 · 行号指针在活文档union后回到211处」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11271(L1 外部持有行 L15777):

```
- [ ] 86. 证据级可追溯执行流水(每次工具调用带 invocation id + 输入/输出哈希 + 权限决策 + 操作者身份,导出签名 ledger) 〔2026-09-27 用户拍板:**做,落库并可导出**;前置一格是保留策略(谁能动、留多久),该项按 §24 需单独确认,故本票第一步是出表设计与保留方案而非写迁移〕 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「86 · 证据级可追溯执行流水」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11272(L1 外部持有行 L11159):

```
- [ ]**台账"两层自愈互咬"的机制票 G-307 交了半成品:熔断行级判据在盘、端到端那一例红**(归本会话,不甩给别人)—— 代理把判据与出口写到位(`F10` done 侧逐字孪生 224 组 / 多余副本 339 行、`--dedupe-done-twins` 只删第 2..N 份逐字相同副本、归并器截断行为改为整行保留),四份文件语法全过、两把工具自检 85/0 与 52/0 全绿,但在补镜像用例时撞到轮次上限死在半途:`node --test scripts/tests/plan-tasks.test.mjs scripts/tests/plan-tasks-merge.test.mjs scripts/tests/plan-task-index.test.mjs scripts/tests/check-plan-line-loss.test.mjs` 现读 **62 例里 1 红** —— `T19 端到端:熔断现场不得建提交,退出码必须仍是 0 并点名 marker` 失败,实测输出是「✅ 自愈落地 …归并 1 行 → 落地面现读 F1 0…」,即**熔断在真链路上没触发**,而测试期望它触发。**半成品没有丢**:五份文件逐字存于 `.ihui-agent/tmp/g307-partial/`,而工作树那几份已按 `git cat-file blob HEAD:<path>` 逐路径贴回 HEAD 形态(贴回后四份镜像测试 32/32 RC=0)—— 台账工具是**活执行体**(post-commit 每轮都跑它),留一份判据半途的副本在盘上,下一次别人的自动档就会把它当成品落地。**接手判据**:① 先证熔断可达(造一个"同一主键连续两轮被回捞"的现场,量它第三轮真的不再建提交);② 端到端那条必须**同时**断言"未建提交 ∧ 退出码 0 ∧ 点名 marker",三态不并桶;③ `--dedupe-done-twins` 的零损失断言必须双向(不删 ∧ 不重复)且默认档只出报告,显式 `--commit` 才落盘 —— 删活文档的行是本仓最危险的动作,绝不进自动档。 【更正 2026-09-28 晚】本行内那句"新落 F10 / 出口 `plan-tasks-merge.mjs --dedupe-done-twins`"是**假账**:现读 `git show HEAD:scripts/plan-tasks.mjs | grep -c F10` = 0、`git show HEAD:scripts/plan-tasks-merge.mjs | grep -c dedupe-done-twins` = **1 且唯一那一处正是枚 `e12e9c142` 里把这条幻影命令当立项凭据写下的注释** ⇒ 该维与该出口从未实现,不得当成已有能力引用(现存的是另一维:同态重复 done 侧按复合主键、只报数)。**假账之所以写得出来,根因在工具**:归并器旧形态对不认识的旗标静默忽略,跑那条从未存在的命令会落进默认报告档并打出「✅ 零损失对账通过…派单口径 403 → 403」,读起来像那个操作真跑了 —— 该缺陷已收口(枚 `e12e9c142`:未识别 token ⇒ exit 2 并原样点名,位置参数只接受 `--write-to` 的值与一枚日期;镜像 A1 纯函数三态 / A2 端到端 rc=2 且拒绝那一趟绝不打出通过档口;T11 那条红属他人在飞的 `plan-task-index.mjs`,与本行无关)。F10 与其归并出口**仍是一件待做的事**,判据与反证在 G-307 那条半成品行里。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-307 · 台账"两层自愈互咬"的机制票G-307交了半成品」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11273(L1 外部持有行 L15670):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11120(G-393) 同题,派单以持有行为准,本行不再单独派单。〕 G-354 **门 33 的 provider 名单该由谁供给(归属:守门 33 持有人;等人拍板)** —— 现读 7 个在 `.env` 的合法 provider 被判"未知",默认档只 warning 所以 rc 0。**为什么还开着**:config.py 的设计是"新增 provider 零代码改动、自动识别",而本门的名单是手抄副本;两种收口动作语义相反——① 把 7 个补进名单 = 继续养第二份真相,② 由 `.env`/服务端能力清单单向投影 = 改一道 blocking 门的判据。必须先定"这份名单到底要不要存在"。**不得**为让 warning 归零去删判据或放宽规则 3。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-354 · G-G-354门33的provider名单该由谁」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11274(L1 外部持有行 L15579):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7765(G-763) 同题,派单以持有行为准,本行不再单独派单。〕 G-355 **MemberCard 把"没量到"显示成 0(第八轮对照逼出;归属:web 首页持有者;等 §17 运行时自验排期)** —— `apps/web/src/components/home/MemberCard.tsx:72-73` 现读 `stats?.points ?? 0` / `wallet?.balance ?? 0`,查询未回或失败时显示"0 分""0 余额"。上游同族口径是"订阅未知不能发布为成功空快照"(`packages/services/src/usage-stats/providers/bigmodelUsageQuotaProvider.ts:259` 原文)加展示层 `'--'` 占位。**为什么还开着**:属 UI 改动,§17 要求起 dev + 读 DOM 数值自验,本票未做该项;改法是 `number | null` + 占位,不动判据、无恒红风险。**这一条不是"抄上游功能",是把"未知"与"为零"分开** —— 后者是数据事故,前者是显示诚实。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-355 · G-G-355MemberCard把"没量到"显」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11275(L1 外部持有行 L7603):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7693(G-395) 同题,派单以持有行为准,本行不再单独派单。〕 G-356 **配置分层的"出处标签"与"请求档 vs 实得档"留痕(归属:cli/子代理线持有人;等产品拍板)** —— 上游 `packages/provider/src/resolver.ts:190/196/208` 三层 overlay 且每个生效对象带 `source` 标签、快照的 `sourceRevisions` 被真实消费;我方 `apps/cli/src/subagents/precedence.ts:195-205` 的四层短路链**没有出处标签**,且 `git grep -I "requestedEffort\|effectiveEffort\|validateModelSelection"` HEAD 面现读 **0 命中** ⇒ 静默降档无法归因。**为什么还开着**:新建"配置分层解析出口"属 §24 新增能力、且是跨端数据建模,不在本轮取证范围;上游那两格(`effective-model-selection.ts` 的 `selectionIssue` 六值枚举、`model-selection-config.ts:76-77`"不能静默补档位")是它的前置形状,可作参考实现但不是本轮交付物。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-356 · G-G-356配置分层的"出处标签"与"请求档v」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11277(L1 外部持有行 L7605):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7695(G-397) 同题,派单以持有行为准,本行不再单独派单。〕 G-358 **锁的"租约认 token 不认 pid"一格只登记、未代裁(归属:`git-lock`/`deploy-lock` 持有人)** —— 上游 `packages/provider-node/src/zcode-builtin-remote-synchronizer.ts:85` 取 `leaseId=randomUUID`、`:143` 的 `#finishLease` 只在 leaseId 相等时才改控制文件,于是"pid 被系统复用"这一型**结构上不可能发生**;而我方是事后补的一环(`scripts/lib/proc-identity.mjs` 的 match/mismatch/unverifiable,承 G-193 那次冻结 11h50m)。**为什么还开着**:改两处锁的 meta 属锁持有人领地,且今天没有可复现的抢占现场做验收依据;真要收它,判据应是"注入一次 leaseId 不相等的迟到 finish 请求,控制文件必须不被改动",而不是"代码写了 leaseId"。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-358 · G-G-358锁的"租约认token不认pid"」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11278(L1 外部持有行 L7606):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7696(G-398) 同题,派单以持有行为准,本行不再单独派单。〕 G-359 **第八轮剩余六格候选清单(归属:未派;等各线排期;本轮只取证未实现,逐格带出处)** —— ① 跨层发布闸:上游 `registry-service.ts:205-212` 在"下层已变而上层仍基于旧事实"时**不发混合快照**、继续服务上一份完整 Registry,而我方这条纪律只活在门的散文里、运行时层无出口;② 稀疏 overlay 空即删:`config-service.ts:513-516` 与继承值等价的配置不落盘(absence=继承,不是"空覆盖");③ 诊断量代替原文:`officialMcpCredentials.ts:52-90/359-376` 只记 JWT 剩余秒数并按小时分桶去重,可接我方唯一脱敏出口 `packages/shared/src/utils/redact.ts`;④ 告警去重身份=桶+周期而非墙钟窗口:`startPlanQuotaReminderStore.ts:33-36` 用快照 `referenceTime` 裁决(设备时间可能已越过服务端周期)、`bucketReminderKey` 缺任一字段即不提醒;⑤ in-flight 合并 + CAS 驱逐:`zaiStartPlanBilling.ts:113-122` 失败响应同样保留 1s(防 429 后立刻重复请求)且驱逐前 `if (requests.get(k) !== request) return`(旧请求不得删新记录),上游该守卫三处同形,是我方共享工作区并发写可直接取用的最小实现;⑥ 幂等 key 复用规则:`codingPlanQuotaResetCoordinator.ts:307-329` 瞬时错复用原 key、成功或稳定错才置 null,且服务端 `next_try_at` 必须透传(:617-624)。**为什么还开着**:六格都是"能落但需各自定级与验收"的独立改动(①②碰运行时快照语义、③④⑤⑥碰告警与并发路径),打包成一票会互相遮蔽;派单时逐格取,勿一次全接。**另有一格需产品先定**:上游 `usage-quota.ts:71` 的 `percentage` 是**已用**占比、而 Start Plan 侧 `:1338` 同名字段是**剩余/总额**,现靠"两族走不同 reader"规避,**无类型或判据看守** —— 要不要收口成"以 remaining 为权威、percentage 仅降级",属契约决策。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-359 · G-G-359第八轮剩余六格候选清单」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11281(L1 外部持有行 L15835):

```
- [ ] **D128 AI 对话链路四竞品对标 V4 收口线(19 条差距 / 5 个 Sprint)** —— 唯一入口 `docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`(87–105),本轮不在此复述差距正文,只登记排期与等待项。**S9 尺子先行(105→97)**:先落 `scripts/audit-benchmark-delivery.mjs`(V3 §八 自留建议至今未落地,`ls` 实测不存在)与 parity 门六端扩面,**顺序不可颠倒** —— #93/#94/#96 之所以能长期存在,正是因为 §9「多端连通」的机器判据只覆盖 web 一端(`check-agent-event-parity.mjs:537` 只扫 `apps/web/src`)。**S10 移动端可达性(93→94→95)**:RN 主屏 `apps/mobile-rn/src/screens/ChatScreen.tsx:652` 起只接 7/30 回调(逐名 `comm -23` 算出缺 23 个,含 `onToolCall`/`onToolApproval`/`onPlanUpdate`/`onTerminal*`/`onSubagent*`/`onUsage`/`onBudget`/`onQuestion`/`onFormRequest`/`onReconnect`),而同端 `AiAssistantN8nScreen.tsx:1412` 是完整实现、`src/utils/chat-render-model.ts` 的 4 个 `apply*` 在主屏零调用方 ⇒ 本票主体是**接线不是开发**;#94 是信任型缺陷(RN 与小程序 `tool-approval` 双零命中,手机上遇高危操作无弹窗)。**S11 保真(87→88→89→92)**、**S12 契约地基(99→100→101→102)**、**S13 传输计量收口(96→90→91→103→98)**。**等待项(归属:等用户拍板)**:#100 内置默认高危集**改变默认行为**(现 `_high_risk_tools_from_env` 未配 env 即 `frozenset()`,`agent_loop_v2.py:288-296`),按 §24 不得由实现票自行开工;#98 桌面端薄壳是 V3 #72 已拍板架构,本票**只对齐三处口径**(tauri.conf / `ensure-web-out.mjs` 自称唯一校验点 / `docs/MULTI_END.md §2.5`),不改选型。**解阻前置(可判)**:S10 之前必须先有 S9 的端能力档案表,否则清完的端下轮又漏。**本轮同时否证 7 条断言,均写进 V4 正文,不得照旧文派单**:①②③ 上述三条 V3 过期结论;④ `packages/app` 的 `ChatScreen` 并非「未导出」—— `src/index.ts:684` 导出在位,真问题是**全仓零消费方**(同包其它 4 个聊天屏都被 mobile-rn 复用)⇒ 归 #95;⑤ web **有**消息队列与 Steer(`queue-interaction-bar.tsx` 在库,D38 已✅)⇒ 队列**不是**差距,初稿列错了;⑥ #89 初稿「主聊天流无自动重连」**否证** —— api-client `client.ts:2078/2129/3443` 有重连与 `Last-Event-ID` 续传,web `send-message.ts:767-775` 已消费 `onReconnect`,缺陷窄化为「`connection-status.tsx` 四态件生产面零挂载(命中全在 `apps/web/tests/agent-task-progress-pane.test.tsx`) + 重连后待决审批恢复未取证」;#96 那句「web 反而没有续传」同批否证;⑦ 孤儿清单里的 `voice-note.tsx` 在 HEAD 与索引双双落空,只在工作树未跟踪面 ⇒ 摘出清单、按 §12 归属未定不动。**本轮交付**:V4 文档成文并注水印(`docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`,`watermark.mjs verify` 覆盖 1/1、残迹 0、损坏 0);六端回调覆盖数改用统一交集判据重算(web 全域 30/30、extension 19、cli 12、RN 主屏 7、RN 另一屏 17、miniapp 17),并登记「事件名口径 23 与回调名口径 17 不可混用」。**待办本体是 S9–S13 的实施,本行不因文档成文而翻勾。****本轮同时更正 3 条 V3 过期结论,不得照它们派单**:#73「小程序无 AI 对话页」已被代码推翻(`apps/miniapp-taro/src/pkg-ai/ai/chat.tsx` 1623 行,最新提交 `3f3e71a99` 09-27,按事件名覆盖 23/30);#51「`run_in_background` 只有 sleep/echo」已不成立(`task_executors.py` 现读 16 个 `async def` + import 期三面断言);#47「三套执行内核」应为「一套半」(`class AgentLoopV2` 唯一内核,但 `agent_loop.py` 仍以 `agent_executor` 被 `routers/agents.py:48`、`services/a2a_service.py:33`、`services/slash_commands.py:162` 三处生产引用)。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「D128 · AI对话链路四竞品对标V4收口线」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11282(L1 外部持有行 L15577):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7673(G-349) 同题,派单以持有行为准,本行不再单独派单。〕 **G-316. 门 8 清账后遗留的三枚"有消费方的待实装路由"(2026-09-28 登记,现读=基线仅剩 3 处)**:① `GET /api/subagents/all` —— 消费者 `apps/web/app/(main)/agent-teams/page.tsx:58`(期望 `{dispatches}` 含 completed/failed/cancelled 全量);后端只有 `/subagents/active`(仅 pending/running,形状恰好相同但语义是子集,**不得**为省事把客户端改道 active —— 那会把"页面少了历史"写成"已修")。正解 = 在 `subagent-dispatch.ts` 补 all 列表路由(带 status/limit 透传)。②③ `PUT /api/ai/n8n/workflows/:id` 与 `POST .../toggle` —— 消费者 `apps/mobile-rn/src/screens/N8nModelScreen.tsx:146/192`(保存改名/启停今天必 404);后端 n8n 面只有列表透传与创建转发(miniapp-compat-routes.ts:1123/1190),n8n REST API 本身支持 workflows/:id 更新与 activate/deactivate,正解 = 在 n8n 代理补两枚透传(SSRF 校验与 env 缺省回 stub 的既有纪律照抄)。验收判据:两枚消费者页面真机/真会话各跑一次成功路径 + 基线 `scripts/api-routes-baseline.json` 清零 + 门 8 末行现读 0。**归属**:subagent 面 = agent-teams 线;n8n 两面 = n8n 代理持有人(本票只登记形状与消费者证据,不代裁实现位置)。 〔落地@2026-09-28/枚 2704c4d27〕三枚路由已入库:subagents/all(新→旧+status/limit)、/ai/n8n/workflows 面四枚(list stub/写 503/fetch-merge-put/toggle 回读真值);apps/api/tests/g299-new-routes.test.ts 4 例绿、门 8 死调用清零、基线 perFileCount 清表。**本票未翻勾的唯一理由=验收判据第一条未跑**:RN N8nModelScreen 真机走查(本机无设备)与 agent-teams 页真会话 200 取证(需起栈)——路由与契约已证,运行时成功路径待验,不得以单测冒充真机。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-316 · 门8清账后遗留的三枚"有消费方的待实装路由"」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11283(L1 外部持有行 L15701):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11128(G-453) 同题,派单以持有行为准,本行不再单独派单。〕 G-453 **台账 F4(重复登记副本)对"同一待办的漂移副本"结构上失明 —— 现读一例:同一条 D41后续① 在 HEAD 有 9 份未勾选副本、其中 7 份正文互不相同(2026-09-28 量)**: `plan-tasks.mjs` 的 F1/F4 判据是"编号 + 标题前缀**逐字等值**",这既是它的优点(不做相似度猜判)也是它的洞 —— 并发 union 每次都留一份**带自己注记**的副本,前缀之后的正文一漂移,复合主键就不再相等,于是同一件事以 N 份"未勾选"长期并存。后果不是账面难看而是**派单被放大 N 倍**:本日两次 `plan-tasks-merge.mjs --heal --commit`(归并 30 行 / 34 行)把 F1/F4 都归到 0,而这一族一份都没被动到 ⇒ "跑过归并"不等于"这一族被覆盖"。出路只有两条且都不该由机器代裁:① 归并线逐组判"哪份是当前状态"(需要读注记语义,机器判不了);② 给登记侧加一条硬约束——同一件事要更新就**就地改那一条**(§1 第 2 条已有此规矩,缺的是让机器能在前缀一致而正文漂移时也点名)。本票**只登记现读证据与两条出路**,不改判据、不批量翻勾(批量翻勾 = 把别人的注记当噪声删,比原病更响)。归属:分叉合并归并线(同 G-363 那条持有)。 (编号改派留痕(2026-09-28):本行原取 G-417,与「全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红」一条撞成一号两事;取号发生在分叉的两条腿上,号段不共享。让位的是**本行**(它是我这一路登记的),别人的行不动;新号由取号令牌按当次 CAS 的 HEAD 现算,落地后须复核它不与任何行首编号重复。正文一字未动。) (编号改派留痕(2026-09-28):本行原取 G-417,与「全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红」一号两事。让位的是**本行**(它是我这一路登记的,别人的行一字未动)。新号是**手工取并逐面复核过的**(G/D/O 不相关,只看 G 族):台账行首集合 + 归档件全文 + 工作树副本三处均无 453 —— 因为取号令牌在改派场景下两次交回了"正在被让位的那个号"(它返回 G-417,而当时台账该族 max 已到 419/429),这个缺陷另立一票 G-454。正文一字未动。) 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-453 · 台账F4」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11284(L1 外部持有行 L15670):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11120(G-393) 同题,派单以持有行为准,本行不再单独派单。〕 G-354 **门 33 的 provider 名单该由谁供给(归属:守门 33 持有人;等人拍板)** —— 现读 7 个在 `.env` 的合法 provider 被判"未知",默认档只 warning 所以 rc 0。**为什么还开着**:config.py 的设计是"新增 provider 零代码改动、自动识别",而本门的名单是手抄副本;两种收口动作语义相反——① 把 7 个补进名单 = 继续养第二份真相,② 由 `.env`/服务端能力清单单向投影 = 改一道 blocking 门的判据。必须先定"这份名单到底要不要存在"。**不得**为让 warning 归零去删判据或放宽规则 3。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-354 · 门33的provider名单该由谁供给」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11285(L1 外部持有行 L15579):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7765(G-763) 同题,派单以持有行为准,本行不再单独派单。〕 G-355 **MemberCard 把"没量到"显示成 0(第八轮对照逼出;归属:web 首页持有者;等 §17 运行时自验排期)** —— `apps/web/src/components/home/MemberCard.tsx:72-73` 现读 `stats?.points ?? 0` / `wallet?.balance ?? 0`,查询未回或失败时显示"0 分""0 余额"。上游同族口径是"订阅未知不能发布为成功空快照"(`packages/services/src/usage-stats/providers/bigmodelUsageQuotaProvider.ts:259` 原文)加展示层 `'--'` 占位。**为什么还开着**:属 UI 改动,§17 要求起 dev + 读 DOM 数值自验,本票未做该项;改法是 `number | null` + 占位,不动判据、无恒红风险。**这一条不是"抄上游功能",是把"未知"与"为零"分开** —— 后者是数据事故,前者是显示诚实。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-355 · MemberCard把"没量到"显示成0」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11286(L1 外部持有行 L7603):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7693(G-395) 同题,派单以持有行为准,本行不再单独派单。〕 G-356 **配置分层的"出处标签"与"请求档 vs 实得档"留痕(归属:cli/子代理线持有人;等产品拍板)** —— 上游 `packages/provider/src/resolver.ts:190/196/208` 三层 overlay 且每个生效对象带 `source` 标签、快照的 `sourceRevisions` 被真实消费;我方 `apps/cli/src/subagents/precedence.ts:195-205` 的四层短路链**没有出处标签**,且 `git grep -I "requestedEffort\|effectiveEffort\|validateModelSelection"` HEAD 面现读 **0 命中** ⇒ 静默降档无法归因。**为什么还开着**:新建"配置分层解析出口"属 §24 新增能力、且是跨端数据建模,不在本轮取证范围;上游那两格(`effective-model-selection.ts` 的 `selectionIssue` 六值枚举、`model-selection-config.ts:76-77`"不能静默补档位")是它的前置形状,可作参考实现但不是本轮交付物。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-356 · 配置分层的"出处标签"与"请求档vs实得档"留痕」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11288(L1 外部持有行 L7605):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7695(G-397) 同题,派单以持有行为准,本行不再单独派单。〕 G-358 **锁的"租约认 token 不认 pid"一格只登记、未代裁(归属:`git-lock`/`deploy-lock` 持有人)** —— 上游 `packages/provider-node/src/zcode-builtin-remote-synchronizer.ts:85` 取 `leaseId=randomUUID`、`:143` 的 `#finishLease` 只在 leaseId 相等时才改控制文件,于是"pid 被系统复用"这一型**结构上不可能发生**;而我方是事后补的一环(`scripts/lib/proc-identity.mjs` 的 match/mismatch/unverifiable,承 G-193 那次冻结 11h50m)。**为什么还开着**:改两处锁的 meta 属锁持有人领地,且今天没有可复现的抢占现场做验收依据;真要收它,判据应是"注入一次 leaseId 不相等的迟到 finish 请求,控制文件必须不被改动",而不是"代码写了 leaseId"。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-358 · 锁的"租约认token不认pid"一格只登记」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11289(L1 外部持有行 L7606):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7696(G-398) 同题,派单以持有行为准,本行不再单独派单。〕 G-359 **第八轮剩余六格候选清单(归属:未派;等各线排期;本轮只取证未实现,逐格带出处)** —— ① 跨层发布闸:上游 `registry-service.ts:205-212` 在"下层已变而上层仍基于旧事实"时**不发混合快照**、继续服务上一份完整 Registry,而我方这条纪律只活在门的散文里、运行时层无出口;② 稀疏 overlay 空即删:`config-service.ts:513-516` 与继承值等价的配置不落盘(absence=继承,不是"空覆盖");③ 诊断量代替原文:`officialMcpCredentials.ts:52-90/359-376` 只记 JWT 剩余秒数并按小时分桶去重,可接我方唯一脱敏出口 `packages/shared/src/utils/redact.ts`;④ 告警去重身份=桶+周期而非墙钟窗口:`startPlanQuotaReminderStore.ts:33-36` 用快照 `referenceTime` 裁决(设备时间可能已越过服务端周期)、`bucketReminderKey` 缺任一字段即不提醒;⑤ in-flight 合并 + CAS 驱逐:`zaiStartPlanBilling.ts:113-122` 失败响应同样保留 1s(防 429 后立刻重复请求)且驱逐前 `if (requests.get(k) !== request) return`(旧请求不得删新记录),上游该守卫三处同形,是我方共享工作区并发写可直接取用的最小实现;⑥ 幂等 key 复用规则:`codingPlanQuotaResetCoordinator.ts:307-329` 瞬时错复用原 key、成功或稳定错才置 null,且服务端 `next_try_at` 必须透传(:617-624)。**为什么还开着**:六格都是"能落但需各自定级与验收"的独立改动(①②碰运行时快照语义、③④⑤⑥碰告警与并发路径),打包成一票会互相遮蔽;派单时逐格取,勿一次全接。**另有一格需产品先定**:上游 `usage-quota.ts:71` 的 `percentage` 是**已用**占比、而 Start Plan 侧 `:1338` 同名字段是**剩余/总额**,现靠"两族走不同 reader"规避,**无类型或判据看守** —— 要不要收口成"以 remaining 为权威、percentage 仅降级",属契约决策。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-359 · 第八轮剩余六格候选清单」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11292(L1 外部持有行 L10752):

```
- [ ] **D181 电脑使用画中画(5 行,对标 `chatSession.pictureInPicture.*`;实现形态需拍板)** —— 竞品串:`sectionLabel`"电脑使用画中画"/`title`"画中画"/`hideInSession`"在此会话中隐藏画中画"/`hideInAllSessions`/`updateFailed`。零命中探针:「画中画」0;`aiChat.floatMode`(PictureInPicture2 图标,ai-side-panel.tsx:1424)=AI 面板页内浮窗,非 computer-use 会话小窗,邻位不背书。拍板点:竞品=桌面壳浮动小窗承载 computer-use 会话;我方浏览器内可用 popout/Document Picture-in-Picture API 对标,形态需拍板。等 G-816102+拍板。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「D181 · 电脑使用画中画」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11299(L1 外部持有行 L15722):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘):本行已让号至 O594(持行在面),merge 回流旧态摘号留指针,正文逐字保留。〕****`2f-ext` 升 blocking 已量好前置,按用户指令暂缓落地**(注册文件 `scripts/guardian-runner.mjs` 本轮不得改)。 〔【归并】重复登记副本(2026-10-01):同主键的另一条登记 「O81 · 票⑰——2f-ext升blocking已量好前置」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11301(L1 外部持有行 L15775):

```
- [ ] 另有 7 个脚本的 `--self-test` 仍走 `os.tmpdir()`(`check-workspace-dep-links` / 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L11302(L1 外部持有行 L15661):

```
- [ ] **传输层单点化**:`notify-deploy-failure.ts` 扩为通用品牌告警派发器(`--to`/`--title`/`--message-file`/`--severity`/`--source`/`--plain`/`--env-file`/`--strict`/`--dry-run`,SMTP→Resend 双通道且 Resend 必带 `html`);PS 侧删除全部自拼传输代码,改为按绝对路径解析 node+tsx 调用该脚本,降级路径也只能走 `--plain`(仍不留第二份 SMTP 代码)。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L11305(L1 外部持有行 L15711):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11187(G-608) 同题,派单以持有行为准,本行不再单独派单。〕 G-1038487 **第十一批:沙箱默认严档落地 + 两路只读取证的 24 条发现落成可执行票(每条带落点与验收判据)** 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-603 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕 〔【归并】重复登记副本(2026-10-12):同主键的另一条登记 「G-1038487 · 第十一批」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11307(L1 外部持有行 L11026):

```
- [ ] **D163 回退与预览失败必须声明「工作区未发生变化」,并把 Diff 快捷预览从三态补到五态(承 V4 §8.3③;一手取证 2026-09-28)。** 竞品原文:`undoUnavailableDescription:"文件检查点不可用，工作区未发生变化。"`、`undoFailedDescription:"CLI 文件检查点暂时不可用，工作区未发生变化。"`、成功态 `undoSucceededDescription:"已恢复 {{count}} 个文件；任务记录仍然保留。"`、确认态 `undoConfirmDescription:"将恢复 {{fileCount}} 个文件，并同时撤销从这轮开始受影响的 {{turnCount}} 轮修改。任务记录不会删除。"`、准备态 `undoPreparingDescription:"正在检查将恢复的文件和受影响轮次…"`、部分警告 `undoPartialWarning:"部分修改不在 CLI 文件检查点中，撤销结果可能不完整。"`;预览五态 `diffPreviewLoading / diffPreviewLoadFailed:"Diff 加载失败。移开后重新悬停可重试。"(给具体动作)/ diffPreviewExpired:"这份 Diff 记录已过期，无法快捷预览。"/ diffPreviewTooLarge:"Diff 过大，无法在快捷预览中显示。"/ diffPreviewUnavailable:"当前没有可供预览的文本 Diff。"`。**我方否证**:`git grep -niE "工作区未发生|未发生变化|nothing changed" -- packages/i18n/messages/web/zh-CN.json apps/web/src packages/shared/src` **零命中**;预览降级我方 D90 已✅三态(工具记录内容/无法读取当前文件/没有可预览内容),**缺"已过期"与"过大"两态及其动作出口**。**为什么重要**:回退是破坏性动作,用户敢不敢再试一次全靠"这次什么都没改成"这句承诺;这与 §「越权用例要断言未发出查询(`whereSeen===0`)」是同一条纪律的**用户界面版**——机器侧断言副作用未发生,人这一侧要给一句等价的话。**不得只改文案**:文案必须由"是否真的没改"这个事实驱动(撤销前记快照、失败后比对文件集与索引,不成立就不许说"未发生变化"),否则就是造一句安慰话。**归属**:可与第二条并行,但**依赖协议通道②/③(检查点可用性状态要能上报)**。**验收**:①注入一次"部分文件回滚失败",断言文案含具体文件数与"未变化"承诺,且该承诺由比对结果驱动(把比对改成恒真,用例必须翻红——变异对照);②预览五态各有用例,过期与过大两态必须给**下一步动作**而非只报失败。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「D163」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11308(L1 外部持有行 L11026):

```
- [ ] **D163 回退与预览失败必须声明「工作区未发生变化」,并把 Diff 快捷预览从三态补到五态(承 V4 §8.3③;一手取证 2026-09-28)。** 竞品原文:`undoUnavailableDescription:"文件检查点不可用，工作区未发生变化。"`、`undoFailedDescription:"CLI 文件检查点暂时不可用，工作区未发生变化。"`、成功态 `undoSucceededDescription:"已恢复 {{count}} 个文件；任务记录仍然保留。"`、确认态 `undoConfirmDescription:"将恢复 {{fileCount}} 个文件，并同时撤销从这轮开始受影响的 {{turnCount}} 轮修改。任务记录不会删除。"`、准备态 `undoPreparingDescription:"正在检查将恢复的文件和受影响轮次…"`、部分警告 `undoPartialWarning:"部分修改不在 CLI 文件检查点中，撤销结果可能不完整。"`;预览五态 `diffPreviewLoading / diffPreviewLoadFailed:"Diff 加载失败。移开后重新悬停可重试。"(给具体动作)/ diffPreviewExpired:"这份 Diff 记录已过期，无法快捷预览。"/ diffPreviewTooLarge:"Diff 过大，无法在快捷预览中显示。"/ diffPreviewUnavailable:"当前没有可供预览的文本 Diff。"`。**我方否证**:`git grep -niE "工作区未发生|未发生变化|nothing changed" -- packages/i18n/messages/web/zh-CN.json apps/web/src packages/shared/src` **零命中**;预览降级我方 D90 已✅三态(工具记录内容/无法读取当前文件/没有可预览内容),**缺"已过期"与"过大"两态及其动作出口**。**为什么重要**:回退是破坏性动作,用户敢不敢再试一次全靠"这次什么都没改成"这句承诺;这与 §「越权用例要断言未发出查询(`whereSeen===0`)」是同一条纪律的**用户界面版**——机器侧断言副作用未发生,人这一侧要给一句等价的话。**不得只改文案**:文案必须由"是否真的没改"这个事实驱动(撤销前记快照、失败后比对文件集与索引,不成立就不许说"未发生变化"),否则就是造一句安慰话。**归属**:可与第二条并行,但**依赖协议通道②/③(检查点可用性状态要能上报)**。**验收**:①注入一次"部分文件回滚失败",断言文案含具体文件数与"未变化"承诺,且该承诺由比对结果驱动(把比对改成恒真,用例必须翻红——变异对照);②预览五态各有用例,过期与过大两态必须给**下一步动作**而非只报失败。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「D163 · 回退与预览失败必须声明「工作区未发生变化」」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11309(L1 外部持有行 L11026):

```
- [ ] **D163 回退与预览失败必须声明「工作区未发生变化」,并把 Diff 快捷预览从三态补到五态(承 V4 §8.3③;一手取证 2026-09-28)。** 竞品原文:`undoUnavailableDescription:"文件检查点不可用，工作区未发生变化。"`、`undoFailedDescription:"CLI 文件检查点暂时不可用，工作区未发生变化。"`、成功态 `undoSucceededDescription:"已恢复 {{count}} 个文件；任务记录仍然保留。"`、确认态 `undoConfirmDescription:"将恢复 {{fileCount}} 个文件，并同时撤销从这轮开始受影响的 {{turnCount}} 轮修改。任务记录不会删除。"`、准备态 `undoPreparingDescription:"正在检查将恢复的文件和受影响轮次…"`、部分警告 `undoPartialWarning:"部分修改不在 CLI 文件检查点中，撤销结果可能不完整。"`;预览五态 `diffPreviewLoading / diffPreviewLoadFailed:"Diff 加载失败。移开后重新悬停可重试。"(给具体动作)/ diffPreviewExpired:"这份 Diff 记录已过期，无法快捷预览。"/ diffPreviewTooLarge:"Diff 过大，无法在快捷预览中显示。"/ diffPreviewUnavailable:"当前没有可供预览的文本 Diff。"`。**我方否证**:`git grep -niE "工作区未发生|未发生变化|nothing changed" -- packages/i18n/messages/web/zh-CN.json apps/web/src packages/shared/src` **零命中**;预览降级我方 D90 已✅三态(工具记录内容/无法读取当前文件/没有可预览内容),**缺"已过期"与"过大"两态及其动作出口**。**为什么重要**:回退是破坏性动作,用户敢不敢再试一次全靠"这次什么都没改成"这句承诺;这与 §「越权用例要断言未发出查询(`whereSeen===0`)」是同一条纪律的**用户界面版**——机器侧断言副作用未发生,人这一侧要给一句等价的话。**不得只改文案**:文案必须由"是否真的没改"这个事实驱动(撤销前记快照、失败后比对文件集与索引,不成立就不许说"未发生变化"),否则就是造一句安慰话。**归属**:可与第二条并行,但**依赖协议通道②/③(检查点可用性状态要能上报)**。**验收**:①注入一次"部分文件回滚失败",断言文案含具体文件数与"未变化"承诺,且该承诺由比对结果驱动(把比对改成恒真,用例必须翻红——变异对照);②预览五态各有用例,过期与过大两态必须给**下一步动作**而非只报失败。 —— 进度(2026-10-02)预览臂:五态预览已入 HEAD(`apps/web/src/components/media/` 四文件:expired/too-large 两终态 + PREVIEW_MAX_BYTES 声明侧与真实字节两侧都拦 + 各态动作出口),web 端 media 目录 13 文件 117 例与包外两个引用方 30 例 RC=0、tsc 0 错。此前状态是**测试在 HEAD 而实现躺工作树 12 小时**(干净检出上命名导入解析不到 ⇒ 收集期即红),按 §12f「红在干净 HEAD 优先修」代落地,内容逐字未改。**回退声明臂未做**:它依赖协议通道②/③(检查点可用性上报),票面明令不得只改文案。 〔【归并】重复登记副本(2026-10-03):同主键的另一条登记 「D163 · 回退与预览失败必须声明「工作区未发生变化」」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11310(L1 外部持有行 L11026):

```
- [ ] **D163 回退与预览失败必须声明「工作区未发生变化」,并把 Diff 快捷预览从三态补到五态(承 V4 §8.3③;一手取证 2026-09-28)。** 竞品原文:`undoUnavailableDescription:"文件检查点不可用，工作区未发生变化。"`、`undoFailedDescription:"CLI 文件检查点暂时不可用，工作区未发生变化。"`、成功态 `undoSucceededDescription:"已恢复 {{count}} 个文件；任务记录仍然保留。"`、确认态 `undoConfirmDescription:"将恢复 {{fileCount}} 个文件，并同时撤销从这轮开始受影响的 {{turnCount}} 轮修改。任务记录不会删除。"`、准备态 `undoPreparingDescription:"正在检查将恢复的文件和受影响轮次…"`、部分警告 `undoPartialWarning:"部分修改不在 CLI 文件检查点中，撤销结果可能不完整。"`;预览五态 `diffPreviewLoading / diffPreviewLoadFailed:"Diff 加载失败。移开后重新悬停可重试。"(给具体动作)/ diffPreviewExpired:"这份 Diff 记录已过期，无法快捷预览。"/ diffPreviewTooLarge:"Diff 过大，无法在快捷预览中显示。"/ diffPreviewUnavailable:"当前没有可供预览的文本 Diff。"`。**我方否证**:`git grep -niE "工作区未发生|未发生变化|nothing changed" -- packages/i18n/messages/web/zh-CN.json apps/web/src packages/shared/src` **零命中**;预览降级我方 D90 已✅三态(工具记录内容/无法读取当前文件/没有可预览内容),**缺"已过期"与"过大"两态及其动作出口**。**为什么重要**:回退是破坏性动作,用户敢不敢再试一次全靠"这次什么都没改成"这句承诺;这与 §「越权用例要断言未发出查询(`whereSeen===0`)」是同一条纪律的**用户界面版**——机器侧断言副作用未发生,人这一侧要给一句等价的话。**不得只改文案**:文案必须由"是否真的没改"这个事实驱动(撤销前记快照、失败后比对文件集与索引,不成立就不许说"未发生变化"),否则就是造一句安慰话。**归属**:可与第二条并行,但**依赖协议通道②/③(检查点可用性状态要能上报)**。**验收**:①注入一次"部分文件回滚失败",断言文案含具体文件数与"未变化"承诺,且该承诺由比对结果驱动(把比对改成恒真,用例必须翻红——变异对照);②预览五态各有用例,过期与过大两态必须给**下一步动作**而非只报失败。 —— 进度(2026-10-02)预览臂:五态预览已入 HEAD(`apps/web/src/components/media/` 四文件:expired/too-large 两终态 + PREVIEW_MAX_BYTES 声明侧与真实字节两侧都拦 + 各态动作出口),web 端 media 目录 13 文件 117 例与包外两个引用方 30 例 RC=0、tsc 0 错。此前状态是**测试在 HEAD 而实现躺工作树 12 小时**(干净检出上命名导入解析不到 ⇒ 收集期即红),按 §12f「红在干净 HEAD 优先修」代落地,内容逐字未改。**回退声明臂未做**:它依赖协议通道②/③(检查点可用性上报),票面明令不得只改文案。 〔【归并】重复登记副本(2026-10-02):同主键的另一条登记 「D163 · 回退与预览失败必须声明「工作区未发生变化」」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11311(L1 外部持有行 L15674):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘②):本行为同题不同编号摘号指针行,指针后残留编号声明位摘除,正文逐字保留。〕**. 分叉合并这次"丢掉的东西"与"互相矛盾的两行文档",按归属交接,不由合并代裁**:① **丢的实现** —— `scripts/check-service-binary-paths.mjs` 与它的测试是同一票在两条分支各写一份(add/add),合并取的是 origin 那份(唯一理由:合并后的 guardian-runner 注册的是它,而只有它读 `HUSKY_SKIP_SERVICE_BINARY_PATHS`;留本侧就等于给提交链挂一条"文档写了但跑不通的出路"),本侧多出的三样探测随本次合并**没了**:服务 STATE 的 `sc query` 取法、按声明端口真应答的活性探测、nssm 输出的 UTF-16LE 解码。归该门持有人,出口是把这三样并回 origin 那份实现,不是把文件换回来。② **矛盾的两行文档** —— AGENTS.md 里现在同时留着"定级 warn / 手动问责 / 刻意不进提交链,因此无紧急跳过变量"(本侧)与"定级 warn,紧急跳过 `HUSKY_SKIP_SERVICE_BINARY_PATHS`"(origin 侧),两句对同一条门互斥;合并**没有**替谁改写谁的那一行(两条都逐字存活),拍板归两侧登记人共同做。③ 为什么这两件事不在合并里顺手修:①要动别人正在持有的门体,②要判定级属产品/治理决策 —— 合并的职责是"谁独有的谁拿走",不包括替人裁决。**等什么**:①② 各自持有人;在此之前锚点里 `G-300/G-301/G-310` 三组跨分支撞号按现读放行(见上一条),不得靠调宽锚点消红。(2026-09-28 合并时登记) (2026-09-28 二次改派:上一轮的号是按当时快照取的,合并落地后又被并发批次用掉同号 ⇒ 本次改由 live-doc-edit 在每次 CAS 里按当下 HEAD 现算,不再照快照取号。) (原编号 G-351;持有行题面「分叉合并这次"丢掉的东西"与"互相矛盾的两行文档」)
```

- 原 L11312(L1 外部持有行 L15674):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-29·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘②):本行为同题不同编号摘号指针行,指针后残留编号声明位摘除,正文逐字保留。〕**. 分叉合并这次"丢掉的东西"与"互相矛盾的两行文档",按归属交接,不由合并代裁**:① **丢的实现** —— `scripts/check-service-binary-paths.mjs` 与它的测试是同一票在两条分支各写一份(add/add),合并取的是 origin 那份(唯一理由:合并后的 guardian-runner 注册的是它,而只有它读 `HUSKY_SKIP_SERVICE_BINARY_PATHS`;留本侧就等于给提交链挂一条"文档写了但跑不通的出路"),本侧多出的三样探测随本次合并**没了**:服务 STATE 的 `sc query` 取法、按声明端口真应答的活性探测、nssm 输出的 UTF-16LE 解码。归该门持有人,出口是把这三样并回 origin 那份实现,不是把文件换回来。② **矛盾的两行文档** —— AGENTS.md 里现在同时留着"定级 warn / 手动问责 / 刻意不进提交链,因此无紧急跳过变量"(本侧)与"定级 warn,紧急跳过 `HUSKY_SKIP_SERVICE_BINARY_PATHS`"(origin 侧),两句对同一条门互斥;合并**没有**替谁改写谁的那一行(两条都逐字存活),拍板归两侧登记人共同做。③ 为什么这两件事不在合并里顺手修:①要动别人正在持有的门体,②要判定级属产品/治理决策 —— 合并的职责是"谁独有的谁拿走",不包括替人裁决。**等什么**:①② 各自持有人;在此之前锚点里 `G-300/G-301/G-310` 三组跨分支撞号按现读放行(见上一条),不得靠调宽锚点消红。(2026-09-28 合并时登记) (2026-09-28 二次改派:上一轮的号是按当时快照取的,合并落地后又被并发批次用掉同号 ⇒ 本次改由 live-doc-edit 在每次 CAS 里按当下 HEAD 现算,不再照快照取号。) (原编号 G-351;持有行题面「分叉合并这次"丢掉的东西"与"互相矛盾的两行文档」)
```

- 原 L11313(L1 外部持有行 L15711):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11187(G-608) 同题,派单以持有行为准,本行不再单独派单。〕 G-1038487 **第十一批:沙箱默认严档落地 + 两路只读取证的 24 条发现落成可执行票(每条带落点与验收判据)** 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-603 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕
```

- 原 L11314(L1 外部持有行 L15674):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-10-07·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘②):本行为同题不同编号摘号指针行,指针后残留编号声明位摘除,正文逐字保留。〕**. 分叉合并这次"丢掉的东西"与"互相矛盾的两行文档",按归属交接,不由合并代裁**:① **丢的实现** —— `scripts/check-service-binary-paths.mjs` 与它的测试是同一票在两条分支各写一份(add/add),合并取的是 origin 那份(唯一理由:合并后的 guardian-runner 注册的是它,而只有它读 `HUSKY_SKIP_SERVICE_BINARY_PATHS`;留本侧就等于给提交链挂一条"文档写了但跑不通的出路"),本侧多出的三样探测随本次合并**没了**:服务 STATE 的 `sc query` 取法、按声明端口真应答的活性探测、nssm 输出的 UTF-16LE 解码。归该门持有人,出口是把这三样并回 origin 那份实现,不是把文件换回来。② **矛盾的两行文档** —— AGENTS.md 里现在同时留着"定级 warn / 手动问责 / 刻意不进提交链,因此无紧急跳过变量"(本侧)与"定级 warn,紧急跳过 `HUSKY_SKIP_SERVICE_BINARY_PATHS`"(origin 侧),两句对同一条门互斥;合并**没有**替谁改写谁的那一行(两条都逐字存活),拍板归两侧登记人共同做。③ 为什么这两件事不在合并里顺手修:①要动别人正在持有的门体,②要判定级属产品/治理决策 —— 合并的职责是"谁独有的谁拿走",不包括替人裁决。**等什么**:①② 各自持有人;在此之前锚点里 `G-300/G-301/G-310` 三组跨分支撞号按现读放行(见上一条),不得靠调宽锚点消红。(2026-09-28 合并时登记) (2026-09-28 二次改派:上一轮的号是按当时快照取的,合并落地后又被并发批次用掉同号 ⇒ 本次改由 live-doc-edit 在每次 CAS 里按当下 HEAD 现算,不再照快照取号。) (原编号 G-351;持有行题面「分叉合并这次"丢掉的东西"与"互相矛盾的两行文档」)
```

- 原 L11315(L1 外部持有行 L15597):

```
- [ ]〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7422(G-3) 同题,派单以持有行为准,本行不再单独派单。〕 （待派/QODER-O81）G-1038490 **守门 149(包入口 barrel 漏 re-export)对"端内 barrel"整片失明,而它漏的正是能把整站打红的形态** —— 立票凭据不是推理:web 端本机现读 HTTP 500,响应体直接点名 `Export <某组件> doesn't exist in target module`,定位到「端内 barrel 没递出该符号,而同端消费方从 barrel 具名导入」;追溯还发现该符号**曾**在 barrel 里、被一枚"撤掉整条链"的提交摘掉而组件文件保留,之后有人重新引用却没复原出口。同一天另量到一处同型候选(另一张 barrel 与它的消费方),说明这不孤立。**为什么现有门看不见**:149 的候选集按 workspace 包入口(`packages/*/src/index.ts`)枚举,端内 barrel 从来不在面里(实测其 `--json` 输出中不含任何端内 barrel 路径);而管悬空导入的那道门判的是"符号根本不存在",这型是"符号存在而入口没递出",结构上互补不重叠。**后果不是"少一个类型错"**:本仓 web 构建设了 `ignoreBuildErrors`,端内 barrel 漏出口在本地与构建两侧都不红,只有点到那个位置的人知道 —— 与守门 72/78/149 立项时同一族"本地全绿、出事的是产物"。**扩面前置(不得跳过)**:先把存量一次量清(端内 barrel 全集 × 各自消费面 × 悬空具名导入数),再决定定级 —— 存量未清就 blocking 就是与任何提交无关的恒红门,唯一结局是各会话跳钩子、连带其余全部对账作废(§12e 同型);**不得**为让本票变绿去改判据或删引用。**顺带登记一条归属纪律**:那枚造成 500 的在飞引用属他人持有面,本票只登记现象与修法方向,不代改别人的文件。 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-627 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕
```

- 原 L11318(L1 外部持有行 L15711):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11187(G-608) 同题,派单以持有行为准,本行不再单独派单。〕 G-1104170 **第十一批:沙箱默认严档落地 + 两路只读取证的 24 条发现落成可执行票(每条带落点与验收判据)** 〔让号@2026-10-10 merge回流再摘③:原编号 G-603 与既有同号题撞声明位(union 回流),本族让出原号改用新号(取号令牌现算),派单以本行新号为准;本行正文除编号位与本记录外逐字未动,改前整行原文见父提交面(按标题前缀「第十一批」寻行)。〕 〔【归并】重复登记副本(2026-10-12):同主键的另一条登记 「G-1104170 · 第十一批」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11319(L1 外部持有行 L15711):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11187(G-608) 同题,派单以持有行为准,本行不再单独派单。〕 G-1058511 **第十一批:沙箱默认严档落地 + 两路只读取证的 24 条发现落成可执行票(每条带落点与验收判据)** 〔让号记录(2026-10-03 F9 清偿批③):原号 G-603 与「两道 blocking 门红在干净 HEAD」两题共用,按 G-312 + 最早登记行持号(该行 2026-09-29 01:39 先登),本任务让出原号改用本号;正文除编号位与本记录外逐字未动。〕 〔【归并】重复登记副本(2026-10-12):同主键的另一条登记 「G-1058511 · 第十一批」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11320(L1 外部持有行 L15675):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘②):本行为同题不同编号摘号指针行,指针后残留编号声明位摘除,正文逐字保留。〕**. 分叉合并把 12 个"首行相同、正文已漂移"的重复登记块并到了一起(台账锚点 F4b 由两侧各自的 0 抬到 12),这不是存量欠账,是合并自己造出来的形态**:机制 —— 同一段多行登记被两条分支各自抄走后又各改了正文,行级判据(F1/F2/F4)按"编号 + 标题前缀逐字等值"配对,配不上这种"块级同、行内漂";而 union 的行重数策略对每一行都只"补对侧净增",于是两份漂移副本都活了下来。出口只有 `node scripts/plan-tasks-merge.mjs --dedupe-blocks` 的**报告档**(先不带 --commit 出清单),它**只删逐字相同的第 2..N 份**,**漂移副本一份都不动** —— 机器折半即有损,所以那 12 块必须逐块人工判"哪一份是当前状态",判完就地改写或翻勾并写明归并到谁(§1 第 2 条)。**等什么**:逐块裁决要读两条分支各自的上下文,不由合并代裁;在此之前 F4b=12 只是现读锚点,不得被读成"已修"。(2026-09-28 合并时登记,现值一律跑 `node scripts/plan-tasks.mjs --gate --json` 看末行) (原编号 G-351;持有行题面「分叉合并把12个"首行相同」)
```

- 原 L11322(L2 族内归并,保留 L11321):

```
- [ ]〔【归并】重复登记副本(2026-09-28,幂等折叠):这一行与同题的持有行是同一件事,持有行是「分叉合并把 12 个"首行相同、正文已漂移"…」那一条待办(按标题前缀寻行 —— 指针里既不写编号也不写行号:编号落在正文前 48 字符内会被台账取成本行的主键,折叠反而新增撞号)。本行摘掉编号、只留指针,不翻勾、不并抄、正文逐字保留。〕 **G-351. 分叉合并把 12 个"首行相同、正文已漂移"的重复登记块并到了一起(台账锚点 F4b 由两侧各自的 0 抬到 12),这不是存量欠账,是合并自己造出来的形态**:机制 —— 同一段多行登记被两条分支各自抄走后又各改了正文,行级判据(F1/F2/F4)按"编号 + 标题前缀逐字等值"配对,配不上这种"块级同、行内漂";而 union 的行重数策略对每一行都只"补对侧净增",于是两份漂移副本都活了下来。出口只有 `node scripts/plan-tasks-merge.mjs --dedupe-blocks` 的**报告档**(先不带 --commit 出清单),它**只删逐字相同的第 2..N 份**,**漂移副本一份都不动** —— 机器折半即有损,所以那 12 块必须逐块人工判"哪一份是当前状态",判完就地改写或翻勾并写明归并到谁(§1 第 2 条)。**等什么**:逐块裁决要读两条分支各自的上下文,不由合并代裁;在此之前 F4b=12 只是现读锚点,不得被读成"已修"。(2026-09-28 合并时登记,现值一律跑 `node scripts/plan-tasks.mjs --gate --json` 看末行) (原编号 G-351)
```

- 原 L11323(L1 外部持有行 L7945):

```
- [ ] 68. 流式中切换模型 → 终止后自动带入新模型 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「68 · 流式中切换模型→终止后自动带入新模型」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11324(L1 外部持有行 L15577):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）**G-334. 门 8 清账后遗留的三枚"有消费方的待实装路由"(2026-09-28 登记,现读=基线仅剩 3 处)**:① `GET /api/subagents/all` —— 消费者 `apps/web/app/(main)/agent-teams/page.tsx:58`(期望 `{dispatches}` 含 completed/failed/cancelled 全量);后端只有 `/subagents/active`(仅 pending/running,形状恰好相同但语义是子集,**不得**为省事把客户端改道 active —— 那会把"页面少了历史"写成"已修")。正解 = 在 `subagent-dispatch.ts` 补 all 列表路由(带 status/limit 透传)。②③ `PUT /api/ai/n8n/workflows/:id` 与 `POST .../toggle` —— 消费者 `apps/mobile-rn/src/screens/N8nModelScreen.tsx:146/192`(保存改名/启停今天必 404);后端 n8n 面只有列表透传与创建转发(miniapp-compat-routes.ts:1123/1190),n8n REST API 本身支持 workflows/:id 更新与 activate/deactivate,正解 = 在 n8n 代理补两枚透传(SSRF 校验与 env 缺省回 stub 的既有纪律照抄)。验收判据:两枚消费者页面真机/真会话各跑一次成功路径 + 基线 `scripts/api-routes-baseline.json` 清零 + 门 8 末行现读 0。**归属**:subagent 面 = agent-teams 线;n8n 两面 = n8n 代理持有人(本票只登记形状与消费者证据,不代裁实现位置)。 〔落地@2026-09-28/枚 2704c4d27〕三枚路由已入库:subagents/all(新→旧+status/limit)、/ai/n8n/workflows 面四枚(list stub/写 503/fetch-merge-put/toggle 回读真值);apps/api/tests/g299-new-routes.test.ts 4 例绿、门 8 死调用清零、基线 perFileCount 清表。**本票未翻勾的唯一理由=验收判据第一条未跑**:RN N8nModelScreen 真机走查(本机无设备)与 agent-teams 页真会话 200 取证(需起栈)——路由与契约已证,运行时成功路径待验,不得以单测冒充真机。（编号改派留痕:本行原登记为「G-299. 门 8 清账后遗留的三枚…」,与「本机交付被远端分支保护拒收」撞成一号两事;2026-09-28 由 live-doc-edit 的取号令牌在每次 CAS 里按当下 HEAD 现算改派为 G-312,旧编号在此留原文,便于任何按旧号引用的人查得到去向,而不是让它静默消失） —— 沿革:G-299→G-312→G-334(两次都被别的登记占去,每次都在行尾留原文)。**[重复登记副本]** 同一件事在 origin 侧以「G-316. 门 8 清账后遗留的三枚…」另登过一次,当前状态持有行按那条走,本行不翻勾、不并抄。 (原编号 G-334;持有行题面「门8清账后遗留的三枚"有消费方的待实装路由"」)
```

- 原 L11325(L1 外部持有行 L7582):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7672(G-470) 同题,派单以持有行为准,本行不再单独派单。〕 G-1104169 **共享索引被整批清空后,"他人已暂存的删除"会失去保护标记,并被工作区存续自愈当成外部删除恢复**(归属:安全提交器 + 存续自愈两处持有人;等环境条件 = 需先定"意图删除"与"宿主误删"在恢复前用什么区分,不是等人拍板措辞):实测链(2026-09-28 09:13–09:17,本机=生产,多会话并发) —— 另一会话把 `apps/ai-service/tests/test_tool_approval_grant_lifetime.py` 以 `D ` 形态暂存(该文件是它当天新建、已入库的测试,`git status` 显示索引里有暂存删除);我用 §12 强制的 `node scripts/safe-commit.mjs` 提交自己的 2 个文件,其 Step ① 是 `git reset HEAD` **清空整个暂存区**(该设计的目的正是别把别人的在途内容打包进我的提交),效果是那枚暂存删除的保护标记一起没了;2 分钟后 `git-guardian` 的存续自愈判定"工作树缺该文件 ∧ 索引 blob == HEAD blob ∧ HEAD 里有它"三条成立 ⇒ 恢复磁盘副本,日志原文:`✅ 工作区存续自愈:恢复 1 个被外部删除的跟踪文件(apps/ai-service/tests/test_tool_approval_grant_lifetime.py)`。**净结果这次是好的**:恢复内容与 HEAD 逐字节同值(零独有数据、零伪造),且该测试实跑 `5 passed`(RC=0,证据 `.ihui-agent/tmp/ff-race/pytest-grant.ev`)—— 也就是说被"恢复"的是一件确实该存在的东西,而它此前那次暂存删除更像宿主清理层命中 `tests/` 整目录(AGENTS §5b 记过该型)而非有意移除。**但机制本身是反的**:存续自愈的设计前提恰恰是"他人已暂存的删除只报数、不代裁",而一次**与它无关**的第三方提交就能替那个删除摘掉标记 —— 若那枚暂存删除是有意的(例如某票按 §7 迁移测试文件),本机会话的每次提交都会把它复活,而两边账面都绿:提交方只看到"我的 2 个文件",自愈方只看到"外部删除 + 零独有数据"。**要谁做什么**:① `safe-commit.mjs` 在 `git reset HEAD` 之前把 `git diff --cached --name-status` 的现状留底,复位后**逐路径恢复 D 标记**(或至少在输出里点名"本次清空了他人的 N 项暂存删除"),让归属会话能看见而不是事后发现;② 存续自愈恢复前问一句"该路径最近是否出现过 ` D`/`D ` 形态"(reflog/索引事件),分不清就只报数。**不在本票范围**:改动别人那枚删除本身(既不支持也不阻止),以及 §7 对"删除 git 对象前先答三问"的既有纪律。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-461 · 共享索引被整批清空后」,派单以那条为准,本行不再单独派单。〕 〔让号@2026-10-10 merge回流再摘③:原编号 G-461 与既有同号题撞声明位(union 回流),本族让出原号改用新号(取号令牌现算),派单以本行新号为准;本行正文除编号位与本记录外逐字未动,改前整行原文见父提交面(按标题前缀「共享索引被整批清空后」寻行)。〕
```

- 原 L11326(L1 外部持有行 L7582):

```
- [ ] （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘③补):指针后残留编号声明位摘除,同题持有行已让号至 G-1018292,正文逐字保留。〕**共享索引被整批清空后,"他人已暂存的删除"会失去保护标记,并被工作区存续自愈当成外部删除恢复**(归属:安全提交器 + 存续自愈两处持有人;等环境条件 = 需先定"意图删除"与"宿主误删"在恢复前用什么区分,不是等人拍板措辞):实测链(2026-09-28 09:13–09:17,本机=生产,多会话并发) —— 另一会话把 `apps/ai-service/tests/test_tool_approval_grant_lifetime.py` 以 `D ` 形态暂存(该文件是它当天新建、已入库的测试,`git status` 显示索引里有暂存删除);我用 §12 强制的 `node scripts/safe-commit.mjs` 提交自己的 2 个文件,其 Step ① 是 `git reset HEAD` **清空整个暂存区**(该设计的目的正是别把别人的在途内容打包进我的提交),效果是那枚暂存删除的保护标记一起没了;2 分钟后 `git-guardian` 的存续自愈判定"工作树缺该文件 ∧ 索引 blob == HEAD blob ∧ HEAD 里有它"三条成立 ⇒ 恢复磁盘副本,日志原文:`✅ 工作区存续自愈:恢复 1 个被外部删除的跟踪文件(apps/ai-service/tests/test_tool_approval_grant_lifetime.py)`。**净结果这次是好的**:恢复内容与 HEAD 逐字节同值(零独有数据、零伪造),且该测试实跑 `5 passed`(RC=0,证据 `.ihui-agent/tmp/ff-race/pytest-grant.ev`)—— 也就是说被"恢复"的是一件确实该存在的东西,而它此前那次暂存删除更像宿主清理层命中 `tests/` 整目录(AGENTS §5b 记过该型)而非有意移除。**但机制本身是反的**:存续自愈的设计前提恰恰是"他人已暂存的删除只报数、不代裁",而一次**与它无关**的第三方提交就能替那个删除摘掉标记 —— 若那枚暂存删除是有意的(例如某票按 §7 迁移测试文件),本机会话的每次提交都会把它复活,而两边账面都绿:提交方只看到"我的 2 个文件",自愈方只看到"外部删除 + 零独有数据"。**要谁做什么**:① `safe-commit.mjs` 在 `git reset HEAD` 之前把 `git diff --cached --name-status` 的现状留底,复位后**逐路径恢复 D 标记**(或至少在输出里点名"本次清空了他人的 N 项暂存删除"),让归属会话能看见而不是事后发现;② 存续自愈恢复前问一句"该路径最近是否出现过 ` D`/`D ` 形态"(reflog/索引事件),分不清就只报数。**不在本票范围**:改动别人那枚删除本身(既不支持也不阻止),以及 §7 对"删除 git 对象前先答三问"的既有纪律。 (原编号 G-461;持有行题面「共享索引被整批清空后」)
```

- 原 L11327(L1 外部持有行 L15597):

```
- [ ]〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7422(G-3) 同题,派单以持有行为准,本行不再单独派单。〕 （待派/QODER-O81）G-1104171 **守门 149(包入口 barrel 漏 re-export)对"端内 barrel"整片失明,而它漏的正是能把整站打红的形态** —— 立票凭据不是推理:web 端本机现读 HTTP 500,响应体直接点名 `Export <某组件> doesn't exist in target module`,定位到「端内 barrel 没递出该符号,而同端消费方从 barrel 具名导入」;追溯还发现该符号**曾**在 barrel 里、被一枚"撤掉整条链"的提交摘掉而组件文件保留,之后有人重新引用却没复原出口。同一天另量到一处同型候选(另一张 barrel 与它的消费方),说明这不孤立。**为什么现有门看不见**:149 的候选集按 workspace 包入口(`packages/*/src/index.ts`)枚举,端内 barrel 从来不在面里(实测其 `--json` 输出中不含任何端内 barrel 路径);而管悬空导入的那道门判的是"符号根本不存在",这型是"符号存在而入口没递出",结构上互补不重叠。**后果不是"少一个类型错"**:本仓 web 构建设了 `ignoreBuildErrors`,端内 barrel 漏出口在本地与构建两侧都不红,只有点到那个位置的人知道 —— 与守门 72/78/149 立项时同一族"本地全绿、出事的是产物"。**扩面前置(不得跳过)**:先把存量一次量清(端内 barrel 全集 × 各自消费面 × 悬空具名导入数),再决定定级 —— 存量未清就 blocking 就是与任何提交无关的恒红门,唯一结局是各会话跳钩子、连带其余全部对账作废(§12e 同型);**不得**为让本票变绿去改判据或删引用。**顺带登记一条归属纪律**:那枚造成 500 的在飞引用属他人持有面,本票只登记现象与修法方向,不代改别人的文件。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔让号@2026-10-10 merge回流再摘③:原编号 G-627 与既有同号题撞声明位(union 回流),本族让出原号改用新号(取号令牌现算),派单以本行新号为准;本行正文除编号位与本记录外逐字未动,改前整行原文见父提交面(按标题前缀「守门 149(包入口 barrel 漏 re-export)」寻行)。〕
```

- 原 L11328(L1 外部持有行 L15711):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11187(G-608) 同题,派单以持有行为准,本行不再单独派单。〕 G-1104170 **第十一批:沙箱默认严档落地 + 两路只读取证的 24 条发现落成可执行票(每条带落点与验收判据)** 〔让号@2026-10-10 merge回流再摘③:原编号 G-603 与既有同号题撞声明位(union 回流),本族让出原号改用新号(取号令牌现算),派单以本行新号为准;本行正文除编号位与本记录外逐字未动,改前整行原文见父提交面(按标题前缀「第十一批」寻行)。〕
```

- 原 L11329(L1 外部持有行 L15704):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘):原号已让出(批⑤),merge 回流旧态摘号留指针,正文逐字保留;同题以「本批全量终审 186 项」按标题前缀寻行。〕**本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)** 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-580 · 本批全量终审186项=173通过/5警告/8失败」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11330(L1 外部持有行 L15597):

```
- [ ]（待派/QODER-O81）〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘③):〔让号@2026-10-10 merge回流再摘③:同题登记已让出原号 G-627 改用新号(持有行按标题前缀「守门 149(包入口 barrel 漏 re-export)」寻行),本行摘号留指针,正文逐字保留,派单以持有行新号为准。〕〕**守门 149(包入口 barrel 漏 re-export)对"端内 barrel"整片失明,而它漏的正是能把整站打红的形态** —— 立票凭据不是推理:web 端本机现读 HTTP 500,响应体直接点名 `Export <某组件> doesn't exist in target module`,定位到「端内 barrel 没递出该符号,而同端消费方从 barrel 具名导入」;追溯还发现该符号**曾**在 barrel 里、被一枚"撤掉整条链"的提交摘掉而组件文件保留,之后有人重新引用却没复原出口。同一天另量到一处同型候选(另一张 barrel 与它的消费方),说明这不孤立。**为什么现有门看不见**:149 的候选集按 workspace 包入口(`packages/*/src/index.ts`)枚举,端内 barrel 从来不在面里(实测其 `--json` 输出中不含任何端内 barrel 路径);而管悬空导入的那道门判的是"符号根本不存在",这型是"符号存在而入口没递出",结构上互补不重叠。**后果不是"少一个类型错"**:本仓 web 构建设了 `ignoreBuildErrors`,端内 barrel 漏出口在本地与构建两侧都不红,只有点到那个位置的人知道 —— 与守门 72/78/149 立项时同一族"本地全绿、出事的是产物"。**扩面前置(不得跳过)**:先把存量一次量清(端内 barrel 全集 × 各自消费面 × 悬空具名导入数),再决定定级 —— 存量未清就 blocking 就是与任何提交无关的恒红门,唯一结局是各会话跳钩子、连带其余全部对账作废(§12e 同型);**不得**为让本票变绿去改判据或删引用。**顺带登记一条归属纪律**:那枚造成 500 的在飞引用属他人持有面,本票只登记现象与修法方向,不代改别人的文件。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-627 · 守门149」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11331(L1 外部持有行 L15704):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘):原号已让出(批⑤),merge 回流旧态摘号留指针,正文逐字保留;同题以「本批全量终审 186 项」按标题前缀寻行。〕**本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)**
```

- 原 L11332(L1 外部持有行 L15597):

```
- [ ]（待派/QODER-O81）〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘③):〔让号@2026-10-10 merge回流再摘③:同题登记已让出原号 G-627 改用新号(持有行按标题前缀「守门 149(包入口 barrel 漏 re-export)」寻行),本行摘号留指针,正文逐字保留,派单以持有行新号为准。〕〕**守门 149(包入口 barrel 漏 re-export)对"端内 barrel"整片失明,而它漏的正是能把整站打红的形态** —— 立票凭据不是推理:web 端本机现读 HTTP 500,响应体直接点名 `Export <某组件> doesn't exist in target module`,定位到「端内 barrel 没递出该符号,而同端消费方从 barrel 具名导入」;追溯还发现该符号**曾**在 barrel 里、被一枚"撤掉整条链"的提交摘掉而组件文件保留,之后有人重新引用却没复原出口。同一天另量到一处同型候选(另一张 barrel 与它的消费方),说明这不孤立。**为什么现有门看不见**:149 的候选集按 workspace 包入口(`packages/*/src/index.ts`)枚举,端内 barrel 从来不在面里(实测其 `--json` 输出中不含任何端内 barrel 路径);而管悬空导入的那道门判的是"符号根本不存在",这型是"符号存在而入口没递出",结构上互补不重叠。**后果不是"少一个类型错"**:本仓 web 构建设了 `ignoreBuildErrors`,端内 barrel 漏出口在本地与构建两侧都不红,只有点到那个位置的人知道 —— 与守门 72/78/149 立项时同一族"本地全绿、出事的是产物"。**扩面前置(不得跳过)**:先把存量一次量清(端内 barrel 全集 × 各自消费面 × 悬空具名导入数),再决定定级 —— 存量未清就 blocking 就是与任何提交无关的恒红门,唯一结局是各会话跳钩子、连带其余全部对账作废(§12e 同型);**不得**为让本票变绿去改判据或删引用。**顺带登记一条归属纪律**:那枚造成 500 的在飞引用属他人持有面,本票只登记现象与修法方向,不代改别人的文件。
```

- 原 L11333(L1 外部持有行 L15757):

```
- [ ]（【归并】重复登记副本·同题不同编号·2026-10-05·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘③):指针后残留编号声明位摘除,正文逐字保留。〕看板把 `cancelled/failed/quota_exceeded/preempted` 全塌成 `blocked`（等人拍板）—— 上游 `dw/src/engine/errors.ts:14-35` 的分级判据是"**能不能被 catch**"而非严重程度：脚本 catch 得到的降为 node 级、`report` 返回 void 无处 catch 的升 run 级，`Interrupted` 必须独立码（否则"进程被杀"与"脚本真失败"只能靠 message 文本分）。我方 `packages/types/src/agent-runtime.ts:1258-1266` `LEGACY_STATUS_MAP` 四档同落 `blocked` ⇒ 被取消的任务与待解阻塞在看板上同形，"重跑很可能就好"与"要先解阻塞"是一条视觉信号。拆 = 六档变七档，牵动 `z.enum`（`agents-kanban.ts:128,151`）+ SSE 载荷 + `dag_scheduler.py:351` + 五语言 + 守门 151 的 SV2。 (原编号 G-462;持有行题面「看板把cancelled/failed/quot」)
```

- 原 L11334(L1 外部持有行 L15758):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L9959(G-417) 同题,派单以持有行为准,本行不再单独派单。〕 G-417 **全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红,登记以免被"修好我看见的那三道"再掩一次** —— ① 守门 [12] 交付报告一致性判 `PROJECT_PLAN.md` 自身违规 1 处:同一份账面里既写着"完整收尾/无后续建议"一类断言,又留着"后续工作/优化项"清单(AGENTS §10 那条互斥约束)。它在全量档是 warn、不挡提交,但它是**批量审计恒红清单**里的一项,留着就会有人天天来问"这红谁的"。出路只有两条且不得放宽判据:要么把该份报告改成"任务 X 已完成、还有 N 项后续"(推荐,因为活账确实还有),要么真把后续条目清干净再声明闭环。归该份批次报告的作者;现读定位:`node scripts/check-delivery-report-consistency.mjs`。② 同日实测的并发副作用登记:多会话同时提交时(本轮实测单窗口 27–47 枚),守门 [30a] 会把**别人重写提交留下的悬空对象**算在本次提交头上、[84] 会把**别人挂在共享索引里的暂存删除**报成待判 —— 两者本轮都已按仓里规定动作处置(悬空提交 `cf05a98386` 已 `git tag lost-commit/cf05a983` 备份并复跑 30a rc=0,其内容经祖先判据确认**已在主线**,零丢失;[84] 复跑 rc=0 并把那条暂存删除点名交回其持有人)。**留这一格是因为它没有判据**:目前没有任何一道门区分"本次引入的悬空"与"并发重写留下的同内容副本",而这型一旦攒多了就是 §22 那类丢 commit 事故的温床。③ 同轮只读量测的第三格(本机**此刻不成立**,故不是待修而是待防):六把常驻命令行工具在"调用方 cwd 不在仓库内"时仍都能解析到仓库(本机 `.git` 是指针文件,git 会向上找),所以依赖 cwd 的那一处今天没有实害;但 `scripts/union-converge.mjs` 与 `scripts/git-push-converge.mjs` **写死** `C:/Program Files/Git/cmd/git.exe`,而仓里已有唯一出口 `scripts/lib/gitdir.mjs`(§5b 明写"脚本一律不得依赖环境取 git"),另一台机(G 盘那份 checkout)实测 git 落点不同 ⇒ 换机即 ENOENT。`git-push-converge.mjs` 同时是唯一不按自身位置推根的一把(换个目录跑结论会变)。**取证教训一条,写给下一个想顺手"修"的人**:我第一轮把这些工具的失败猜成"模块顶层数组引用后声明常量 ⇒ TDZ",现读**否证**(那三处在函数体内求值),真因是我自己的探针把 msys 风格路径拼成了不存在的目录 —— 0 命中/含糊错先怀疑尺子,再怀疑世界,别照假设改生产工具。 〔【归并】重复登记副本(2026-10-09):同主键的另一条登记 「G-417 · 全量守门盘点」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11335(L1 外部持有行 L7582):

```
- [ ] 〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘③):〔让号@2026-10-10 merge回流再摘③:同题登记已让出原号 G-461 改用新号(持有行按标题前缀「共享索引被整批清空后」寻行),本行摘号留指针,正文逐字保留,派单以持有行新号为准。〕〕**共享索引被整批清空后,"他人已暂存的删除"会失去保护标记,并被工作区存续自愈当成外部删除恢复**(归属:安全提交器 + 存续自愈两处持有人;等环境条件 = 需先定"意图删除"与"宿主误删"在恢复前用什么区分,不是等人拍板措辞):实测链(2026-09-28 09:13–09:17,本机=生产,多会话并发) —— 另一会话把 `apps/ai-service/tests/test_tool_approval_grant_lifetime.py` 以 `D ` 形态暂存(该文件是它当天新建、已入库的测试,`git status` 显示索引里有暂存删除);我用 §12 强制的 `node scripts/safe-commit.mjs` 提交自己的 2 个文件,其 Step ① 是 `git reset HEAD` **清空整个暂存区**(该设计的目的正是别把别人的在途内容打包进我的提交),效果是那枚暂存删除的保护标记一起没了;2 分钟后 `git-guardian` 的存续自愈判定"工作树缺该文件 ∧ 索引 blob == HEAD blob ∧ HEAD 里有它"三条成立 ⇒ 恢复磁盘副本,日志原文:`✅ 工作区存续自愈:恢复 1 个被外部删除的跟踪文件(apps/ai-service/tests/test_tool_approval_grant_lifetime.py)`。**净结果这次是好的**:恢复内容与 HEAD 逐字节同值(零独有数据、零伪造),且该测试实跑 `5 passed`(RC=0,证据 `.ihui-agent/tmp/ff-race/pytest-grant.ev`)—— 也就是说被"恢复"的是一件确实该存在的东西,而它此前那次暂存删除更像宿主清理层命中 `tests/` 整目录(AGENTS §5b 记过该型)而非有意移除。**但机制本身是反的**:存续自愈的设计前提恰恰是"他人已暂存的删除只报数、不代裁",而一次**与它无关**的第三方提交就能替那个删除摘掉标记 —— 若那枚暂存删除是有意的(例如某票按 §7 迁移测试文件),本机会话的每次提交都会把它复活,而两边账面都绿:提交方只看到"我的 2 个文件",自愈方只看到"外部删除 + 零独有数据"。**要谁做什么**:① `safe-commit.mjs` 在 `git reset HEAD` 之前把 `git diff --cached --name-status` 的现状留底,复位后**逐路径恢复 D 标记**(或至少在输出里点名"本次清空了他人的 N 项暂存删除"),让归属会话能看见而不是事后发现;② 存续自愈恢复前问一句"该路径最近是否出现过 ` D`/`D ` 形态"(reflog/索引事件),分不清就只报数。**不在本票范围**:改动别人那枚删除本身(既不支持也不阻止),以及 §7 对"删除 git 对象前先答三问"的既有纪律。
```

- 原 L11336(L1 外部持有行 L7945):

```
- [ ] 68. 流式中切换模型 → 终止后自动带入新模型 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「68 · 流式中切换模型→终止后自动带入新模型」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11337(L1 外部持有行 L7582):

```
- [ ] 〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘③):〔让号@2026-10-10 merge回流再摘③:同题登记已让出原号 G-461 改用新号(持有行按标题前缀「共享索引被整批清空后」寻行),本行摘号留指针,正文逐字保留,派单以持有行新号为准。〕〕**共享索引被整批清空后,"他人已暂存的删除"会失去保护标记,并被工作区存续自愈当成外部删除恢复**(归属:安全提交器 + 存续自愈两处持有人;等环境条件 = 需先定"意图删除"与"宿主误删"在恢复前用什么区分,不是等人拍板措辞):实测链(2026-09-28 09:13–09:17,本机=生产,多会话并发) —— 另一会话把 `apps/ai-service/tests/test_tool_approval_grant_lifetime.py` 以 `D ` 形态暂存(该文件是它当天新建、已入库的测试,`git status` 显示索引里有暂存删除);我用 §12 强制的 `node scripts/safe-commit.mjs` 提交自己的 2 个文件,其 Step ① 是 `git reset HEAD` **清空整个暂存区**(该设计的目的正是别把别人的在途内容打包进我的提交),效果是那枚暂存删除的保护标记一起没了;2 分钟后 `git-guardian` 的存续自愈判定"工作树缺该文件 ∧ 索引 blob == HEAD blob ∧ HEAD 里有它"三条成立 ⇒ 恢复磁盘副本,日志原文:`✅ 工作区存续自愈:恢复 1 个被外部删除的跟踪文件(apps/ai-service/tests/test_tool_approval_grant_lifetime.py)`。**净结果这次是好的**:恢复内容与 HEAD 逐字节同值(零独有数据、零伪造),且该测试实跑 `5 passed`(RC=0,证据 `.ihui-agent/tmp/ff-race/pytest-grant.ev`)—— 也就是说被"恢复"的是一件确实该存在的东西,而它此前那次暂存删除更像宿主清理层命中 `tests/` 整目录(AGENTS §5b 记过该型)而非有意移除。**但机制本身是反的**:存续自愈的设计前提恰恰是"他人已暂存的删除只报数、不代裁",而一次**与它无关**的第三方提交就能替那个删除摘掉标记 —— 若那枚暂存删除是有意的(例如某票按 §7 迁移测试文件),本机会话的每次提交都会把它复活,而两边账面都绿:提交方只看到"我的 2 个文件",自愈方只看到"外部删除 + 零独有数据"。**要谁做什么**:① `safe-commit.mjs` 在 `git reset HEAD` 之前把 `git diff --cached --name-status` 的现状留底,复位后**逐路径恢复 D 标记**(或至少在输出里点名"本次清空了他人的 N 项暂存删除"),让归属会话能看见而不是事后发现;② 存续自愈恢复前问一句"该路径最近是否出现过 ` D`/`D ` 形态"(reflog/索引事件),分不清就只报数。**不在本票范围**:改动别人那枚删除本身(既不支持也不阻止),以及 §7 对"删除 git 对象前先答三问"的既有纪律。 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记 「G-461 · 共享索引被整批清空后」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11338(L1 外部持有行 L15711):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L11187(G-608) 同题,派单以持有行为准,本行不再单独派单。〕 G-1058511 **第十一批:沙箱默认严档落地 + 两路只读取证的 24 条发现落成可执行票(每条带落点与验收判据)** 〔让号记录(2026-10-03 F9 清偿批③):原号 G-603 与「两道 blocking 门红在干净 HEAD」两题共用,按 G-312 + 最早登记行持号(该行 2026-09-29 01:39 先登),本任务让出原号改用本号;正文除编号位与本记录外逐字未动。〕
```

- 原 L11347(L1 外部持有行 L15577):

```
- [ ]〔【归并】重复登记副本(2026-09-28,幂等折叠):这一行与同题的持有行是同一件事,持有行是「门 8 清账后遗留的三枚"有消费方的待实装路由"…」那一条待办(按标题前缀寻行;指针里既不写编号也不写行号 —— 写了编号就会被台账取成这条副本自己的主键,折叠反而新增撞号,这是今天实测到的成因)。本行摘掉编号、只留指针,不翻勾、不并抄、正文逐字保留。〕 **G-334. 门 8 清账后遗留的三枚"有消费方的待实装路由"(2026-09-28 登记,现读=基线仅剩 3 处)**:① `GET /api/subagents/all` —— 消费者 `apps/web/app/(main)/agent-teams/page.tsx:58`(期望 `{dispatches}` 含 completed/failed/cancelled 全量);后端只有 `/subagents/active`(仅 pending/running,形状恰好相同但语义是子集,**不得**为省事把客户端改道 active —— 那会把"页面少了历史"写成"已修")。正解 = 在 `subagent-dispatch.ts` 补 all 列表路由(带 status/limit 透传)。②③ `PUT /api/ai/n8n/workflows/:id` 与 `POST .../toggle` —— 消费者 `apps/mobile-rn/src/screens/N8nModelScreen.tsx:146/192`(保存改名/启停今天必 404);后端 n8n 面只有列表透传与创建转发(miniapp-compat-routes.ts:1123/1190),n8n REST API 本身支持 workflows/:id 更新与 activate/deactivate,正解 = 在 n8n 代理补两枚透传(SSRF 校验与 env 缺省回 stub 的既有纪律照抄)。验收判据:两枚消费者页面真机/真会话各跑一次成功路径 + 基线 `scripts/api-routes-baseline.json` 清零 + 门 8 末行现读 0。**归属**:subagent 面 = agent-teams 线;n8n 两面 = n8n 代理持有人(本票只登记形状与消费者证据,不代裁实现位置)。 〔落地@2026-09-28/枚 2704c4d27〕三枚路由已入库:subagents/all(新→旧+status/limit)、/ai/n8n/workflows 面四枚(list stub/写 503/fetch-merge-put/toggle 回读真值);apps/api/tests/g299-new-routes.test.ts 4 例绿、门 8 死调用清零、基线 perFileCount 清表。**本票未翻勾的唯一理由=验收判据第一条未跑**:RN N8nModelScreen 真机走查(本机无设备)与 agent-teams 页真会话 200 取证(需起栈)——路由与契约已证,运行时成功路径待验,不得以单测冒充真机。（编号改派留痕:本行原登记为「G-299. 门 8 清账后遗留的三枚…」,与「本机交付被远端分支保护拒收」撞成一号两事;2026-09-28 由 live-doc-edit 的取号令牌在每次 CAS 里按当下 HEAD 现算改派为 G-312,旧编号在此留原文,便于任何按旧号引用的人查得到去向,而不是让它静默消失） —— 沿革:G-299→G-312→G-334(两次都被别的登记占去,每次都在行尾留原文)。**[重复登记副本]** 同一件事在 origin 侧以「G-316. 门 8 清账后遗留的三枚…」另登过一次,当前状态持有行按那条走,本行不翻勾、不并抄。 (原编号 G-334)
```

- 原 L11348(L1 外部持有行 L15577):

```
- [ ]〔【归并】重复登记副本(2026-09-28,幂等折叠):这一行与同题的持有行是同一件事,持有行是「门 8 清账后遗留的三枚"有消费方的待实装路由"…」那一条待办(按标题前缀寻行 —— 指针里既不写编号也不写行号:编号落在正文前 48 字符内会被台账取成本行的主键,折叠反而新增撞号)。本行摘掉编号、只留指针,不翻勾、不并抄、正文逐字保留。〕 **G-334. 门 8 清账后遗留的三枚"有消费方的待实装路由"(2026-09-28 登记,现读=基线仅剩 3 处)**:① `GET /api/subagents/all` —— 消费者 `apps/web/app/(main)/agent-teams/page.tsx:58`(期望 `{dispatches}` 含 completed/failed/cancelled 全量);后端只有 `/subagents/active`(仅 pending/running,形状恰好相同但语义是子集,**不得**为省事把客户端改道 active —— 那会把"页面少了历史"写成"已修")。正解 = 在 `subagent-dispatch.ts` 补 all 列表路由(带 status/limit 透传)。②③ `PUT /api/ai/n8n/workflows/:id` 与 `POST .../toggle` —— 消费者 `apps/mobile-rn/src/screens/N8nModelScreen.tsx:146/192`(保存改名/启停今天必 404);后端 n8n 面只有列表透传与创建转发(miniapp-compat-routes.ts:1123/1190),n8n REST API 本身支持 workflows/:id 更新与 activate/deactivate,正解 = 在 n8n 代理补两枚透传(SSRF 校验与 env 缺省回 stub 的既有纪律照抄)。验收判据:两枚消费者页面真机/真会话各跑一次成功路径 + 基线 `scripts/api-routes-baseline.json` 清零 + 门 8 末行现读 0。**归属**:subagent 面 = agent-teams 线;n8n 两面 = n8n 代理持有人(本票只登记形状与消费者证据,不代裁实现位置)。 〔落地@2026-09-28/枚 2704c4d27〕三枚路由已入库:subagents/all(新→旧+status/limit)、/ai/n8n/workflows 面四枚(list stub/写 503/fetch-merge-put/toggle 回读真值);apps/api/tests/g299-new-routes.test.ts 4 例绿、门 8 死调用清零、基线 perFileCount 清表。**本票未翻勾的唯一理由=验收判据第一条未跑**:RN N8nModelScreen 真机走查(本机无设备)与 agent-teams 页真会话 200 取证(需起栈)——路由与契约已证,运行时成功路径待验,不得以单测冒充真机。（编号改派留痕:本行原登记为「G-299. 门 8 清账后遗留的三枚…」,与「本机交付被远端分支保护拒收」撞成一号两事;2026-09-28 由 live-doc-edit 的取号令牌在每次 CAS 里按当下 HEAD 现算改派为 G-312,旧编号在此留原文,便于任何按旧号引用的人查得到去向,而不是让它静默消失） —— 沿革:G-299→G-312→G-334(两次都被别的登记占去,每次都在行尾留原文)。**[重复登记副本]** 同一件事在 origin 侧以「G-316. 门 8 清账后遗留的三枚…」另登过一次,当前状态持有行按那条走,本行不翻勾、不并抄。 (原编号 G-334)
```

- 原 L11356(L1 外部持有行 L15579):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7765(G-763) 同题,派单以持有行为准,本行不再单独派单。〕 G-394 **MemberCard 把"没量到"显示成 0(第八轮对照逼出;归属:web 首页持有者;等 §17 运行时自验排期)** —— `apps/web/src/components/home/MemberCard.tsx:72-73` 现读 `stats?.points ?? 0` / `wallet?.balance ?? 0`,查询未回或失败时显示"0 分""0 余额"。上游同族口径是"订阅未知不能发布为成功空快照"(`packages/services/src/usage-stats/providers/bigmodelUsageQuotaProvider.ts:259` 原文)加展示层 `'--'` 占位。**为什么还开着**:属 UI 改动,§17 要求起 dev + 读 DOM 数值自验,本票未做该项;改法是 `number | null` + 占位,不动判据、无恒红风险。**这一条不是"抄上游功能",是把"未知"与"为零"分开** —— 后者是数据事故,前者是显示诚实。 (原编号 G-G-355 系改派工具把前缀重复贴了一次:尺子会把它读成 G-355 而与同号他票拼成假撞号,标题又因带着畸形前缀配不进 F1/F4 —— 现取新号,正文逐字未动)
```

- 原 L11363(L1 外部持有行 L10011):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘):原号留归 F1 判据票(批⑤),merge 回流旧态摘号留指针,正文逐字保留;同题以「RN 与 api-client 三处接口路径」按标题前缀寻行。〕**RN 与 api-client 三处接口路径多写一段 `agents`,运行时必 404(守门 8 报的真缺口,2026-10-05 现读三段取证)**:① 端内 `apps/mobile-rn/src/screens/HomeScreen.tsx:569` 写 `/cozeZhsApi/agents/collect`,门 8 归一为 `/api/agents/collect`;而后端 `apps/api/src/routes/agents.ts:1567` 注册的是 `server.post('/collect')`,经 `apps/api/src/routes/index.ts:646` 的 `server.register(agentsRoutes, { prefix: '/api' })` 挂载 ⇒ 实际路径是 **`/api/collect`**,**差一段 `agents`**。② `:577` 的 `/cozeZhsApi/agents/thumbs` 同型(后端 `agents.ts:1552` 注册 `/thumbs` ⇒ 实际 `/api/thumbs`)。③ `packages/api-client/src/endpoints/agent.ts:97` 的 `/cozeZhsApi/cache/agent-category-dict/categories` ⇒ 归一 `/api/cache/agent-category-dict/categories`,`apps/api/src/routes/` 下 **0 命中**该路径。**修法**:三处端内路径去掉多写的那一段;或后端补挂 `agents` 段(**属对外契约变更,需机主定**)。**验收**:改后 `node scripts/check-api-routes.mjs` 末行不再出现这三处「后端**不在册**」,且 RN 收藏/点赞真机点得动。注意守门 8 按设计**只报数不判红**(§12e)⇒ 这条不会自己变红,必须靠人收口。⚠️ 三处**不可**批量正则替换(端内还可能有真的 `/agents/...` 路由),必须逐条比对后端注册面。 〔拍板③@2026-10-06:新建公开双键字典端点,注册在客户端既有调用路径(4 调用方+api-client 零改动);实施 agent 在飞〕
```

- 原 L11364(L1 外部持有行 L15878):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘):本行已让号至 G-73(持行在面),merge 回流旧态摘号留指针,正文逐字保留。〕**RN 三处接口路径多写一段 `agents`(守门 8 报的真缺口;2026-10-06 部分收口,① ② 已修并入库 `f3bf8bd3fc`,③ 待机主定)** ——原票面三处里**只有 2 处是路径错**:`HomeScreen.tsx` 的收藏/点赞(① ②)确为多写一段 `agents`(后端 `agents.ts:1567` 是 `server.post('/collect')`、`:1552` 是 `server.post('/thumbs')`，`routes/index.ts:646` 挂 `prefix: "/api"` 且 agentsRoutes 内**无二级 prefix** => 实际 `/api/collect`、`/api/thumbs`)，已改为 `/api/collect` / `/api/thumbs` 并入库(`f3bf8bd3fc`)。**为什么连 `/cozeZhsApi` 一起换成 `/api`**:normalizeUrl 对两者等价(行为零变化)，但守门 8 的 `pathRe` 只认引号紧邻的 `/api/`，`/cozeZhsApi` 永远落在豁免桶里 => 改后才**进入判红调用集**，从此有判据兜住。验收:`check-api-routes.mjs --worktree`「后端不在册」**3 处 → 1 处**;变异(① 改回原路径)⇒ 复现 2 处。⚠️ **口径坑:守门 8 默认面是 HEAD blob 不是工作树**(`check-api-routes.mjs:3553-3559`)⇒ 改后必须加 `--worktree` 才看得到读数变化，不加旗标读数必然不变，别误读成「改动无效」。⚠️ **注释里写路径一律不带引号和反引号** —— `pathRe` 字符类把**反引号与引号同等**，本轮首版注释用反引号包路径，当场被抽成一条真死调用、门 exit 1(已改并留痕)。 ——**③ 另案:不是路径写错，是缺后端实现**。`packages/api-client/src/endpoints/agent.ts:97` 的 `/api/cache/agent-category-dict/categories` 后端 0 命中且**无等价路由**;`getAgentCategories` **不是死代码**(4 个真实 RN 调用方:HomeScreen/PlazaScreen/AgentScreen/AiAssistantScreen)。名字最近的 `agent-categories-cache.ts` 有两点硬差异:① `addHook(preHandler, requireAdmin)` 管理员专属;② 返回体 `{items,total,page,pageSize,lastRefreshedAt}` ≠ 端内要的 `{agentCategory, agentMainCategory}` 双键并列。**未擅自新增路由**(=新造对外契约，机主职权)，`diff -q` 证明该文件逐字未动。**待机主定**:① 新建公开双键字典端点(契约新增)，还是 ② 改端内去调既有 `/api/categories/list` 一类(返回体形状不同，4 个调用方取值逻辑要跟着改)。**风险低**:4 个调用方全有静态 fallback (`PLAZA_CATEGORY_FALLBACK` 等)，当前 404 只导致筛选弹层降级为静态占位，**不崩、不白屏**，可从容决策。顺带发现(同型死常量，未动):`apps/web/src/config/backend-paths.ts:64-65` 的 `${COZE}/agents/thumbs`/`collect`，`AGENTS_PATHS` 零消费方故无线上影响。**③ 收口后本票即可整条翻勾。** **【2026-10-06 追加现读:这一格比票面写的更彻底 —— 不是 2 行死常量,是整张 `ROUTE_MAP` 零消费(纯只读,未动代码)】**:`AGENTS_PATHS` 的真实消费面**只有 1 处** —— 同文件 `ROUTE_MAP['/agents']`(`backend-paths.ts:241`),而 `getPathsByRoute` / `ROUTE_MAP` / `BackendRouteKey` 三者在整个 `apps/web/src` 与全仓(`.ts/.tsx/.mts`)**各自只有定义处 1 个命中、零调用方、零测试钉子** ⇒ **这张表本身就是死的**,所以 `thumbs`/`collect` 那两个错路径永远不会被任何页面取到(与 RN 那两处不同:RN 是活调用会真404)。**更狠的一层**:该文件导出 **14 个路径组**,**只有 `OPENCLAW_PATHS` 有外部 import**(`apps/web/src/lib/openclaw-api.ts:6`,活的);其余 `AUTH_PATHS`/`AI_PATHS`/`FILE_PATHS`/`WS_PATHS`/`AGENTS_PATHS`/`STATISTICS_PATHS`/`SERVICE_APPOINTMENT_PATHS`/`NOTIFICATION_PATHS`/`CUSTOMER_SERVICE_PATHS`/`WALLET_PATHS`/`TOOLS_PATHS`/`CONTENT_PATHS`/`UPLOAD_PATHS`/`USER_SETTINGS_PATHS` **13 组全被这张死表引用或零引用** ⇒ 典型"旧架构整体搬运后没人接线的遗留面"(文件头自述"等价自旧架构 client/src/config/backend-paths.ts")。**为什么本会话不删(留给机主拍板,属 §1/§12e 边界)**:① 删表会一次性带走 14 个导出符号,虽现读零消费,但 `apps/web` 处于**多会话在飞态**(主索引里 `PROJECT_PLAN.md` 已被他人暂存),他人 in-flight 改动若正引用这些符号,删除会让他的构建红在半路且难以归因;② 票面原话是"同型死常量,**无线上影响**"⇒ **收益是纯清理,不是止血**,优先级低于任何真缺口;③ 真要动手,正解**不是删文件**而是先给 `getPathsByRoute` 补一个调用方(把死表接活)或整体删除并在同枚里留指针,**二选一是产品口径**(这张表原设计意图是"按页面查所需 API",可能原计划接一个 API 文档页/调试面板),不该由 agent 代裁。**已核实可排除的两条猜测**:① 不是"路径写错导致线上 404" —— 零消费方,无调用即无请求;② 不是"测试没覆盖导致漏判" —— 全仓无任何测试 import 本文件,删掉不会破测试。**建议(供机主拍板时参考)**:选"整体删除 + 在本行留指针",因为保留一张零消费的表只会持续骗后来人(本轮就有另一个 agent 因为它以为`${COZE}/agents/thumbs` 是活路径而去核对后端)。 〔拍板③@2026-10-06:新建公开双键字典端点,注册在客户端既有调用路径(4 调用方+api-client 零改动);实施 agent 在飞〕**【2026-10-06 死表删除已落地(档 B收口,入库 `31872798562`):本行建议的「整体删除」已执行】**删除前取证走**四通道**(HEAD面 / 暂存区 / 未跟踪 / 工作树当前内容),结论一致:18 个 export 里只有 `OPENCLAW_PATHS` 被真实消费(唯一消费方 `apps/web/src/lib/openclaw-api.ts`,29 处引用);另 14 组路径常量与 `ROUTE_MAP` / `BackendRouteKey` / `getPathsByRoute` 零调用方、零测试钉子。**删的是内容不是文件** —— 整文件删除会连带带走唯一活着的 `OPENCLAW_PATHS`,故保留文件只留活表:**257 行 → 81 行**(−191/+15),水印头尾逐字未动。**保留 `OPENCLAW_PATHS` 全部 8 个子对象(含当前零调用的 `sessions`/`stats`)**:活着的路径表按域完整列出是**契约语义**,按当前调用点裁剪等于把契约表降级成调用点快照;死常量是「整组无人碰」,与此不同类。**甄别过的同名不同物**(删对了、不是漏删):`AGENTS_PATHS` 另有一处是 `apps/ai-service/tests/test_privileged_surface_auth_59.py` 的 Python 局部元组;`ROUTE_MAP` 另有一处是 `apps/miniapp-taro/src/pkg-user/favorites/index.tsx` 该端自己的路由映射。**验收**:`apps/web` tsc `--noEmit` 20 条错误**全部**落在他人 in-flight 文件(`MessageList.tsx` / `windowing.ts` / `checkpoint-rewind-undo-claim.test.tsx` / `LivePlayer.tsx`),无一指向本文件或 `openclaw-api.ts`,且这 4 个文件对本文件**零引用** ⇒ 因果无关;水印 verify 通过;落地 5 道预检(水印 / 悬空引用 / 门 98 / CAS / 提交面回读)全过。**本票剩下的 ③ 仍待实施 agent 收口,与本条删除互不依赖。**
```

- 原 L11385(L1 外部持有行 L7705):

```
- [ ]（【归并】重复登记副本·同题不同编号·2026-10-09·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）**D1047 断线窗口待决审批的重放(承 D131 取证;等 §24 拍板 A/B/C)** —— 取证已证"会丢"(`apps/ai-service/tests/test_d131_pending_approval_resume.py` 6 例 RC=0)。三条修法与爆炸半径:A=服务端在重连时重放仍待决的条目(改 `llm.py::_approval_sessions` 与 agents 侧待决表的取用点,**须与 `sse_contract` 同批**);B=让主对话流帧出口写 `id:`(动 `_sse()` 是全仓共用出口 ⇒ 影响所有流式消费端与两侧契约,须单独票 + 跨端同批);C=端侧在重连后显式再拉一次待决清单(新增一次读端点,不改服务端语义)。**等谁**:用户拍板选哪条(推荐 A,理由是"不新造对外能力、只补重放"),B 的跨端代价最大。**为什么不在本轮做**:票面写"证实会丢则修在服务端",但服务端改动与并行会话持有面(`llm.py`、`sse_contract.py` 此刻均 ` M`)撞车,按 §12 不代收。 —— 租约(2026-10-02):票面那句『此刻均 ` M`』的阻塞前提已解除(`app/routers/llm.py` 与 `app/core/sse_contract.py` 现读工作树 == HEAD),按票面推荐口径 **A** 开工:服务端在重连时重放仍待决的条目,与 `sse_contract` 同批;爆炸半径与验收以票面 A 档为准。〔让号记录(2026-10-09 批⑥执行):本行原持 D173,而 D173 同号多题 —— 持有行留驻「AI 对话链路四竞品对标 V4 收口线」,本行让出原号改用 D1047(取号器现读该族最大号已越过 D1047 ⇒ 不会再被发出)。正文与验收口径逐字未改。〕 (原编号 D1047;持有行题面「断线窗口待决审批的重放」)
```

- 原 L11400(L1 外部持有行 L15801):

```
- [ ] RN / miniapp 未消费 `tailPreview`(§9 跨端同步);本次补译的 zh-TW/en/ja/ko 四语归因译文待人复核。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L11401(L1 外部持有行 L11428):

```
- [ ] P1 **返回键同一型跨端清账(本票的直接续作)**:① `packages/app/src/features/**` 与两个共享 `NavBar` / `PayResultScreen` 的 ‹;② `apps/mobile-rn/src/screens/**` 及其端内 `NavBar`(RN 侧写法是 `lucide-react-native ChevronLeft`,端内 `apps/mobile-rn/src/screens/AboutScreen.tsx` 已有现成范例);③ `apps/extension` 那处「字符箭头 + 文字」双写(属 102 的 GA1 族而非 GA4)。做法与本票同:先复用该端既有矢量出口,再按文件收编,顺带删各自失效的样式工厂。**存量数字一律按上面那条命令现取,勿照任何文档里的历史数派单。** GA4 棘轮已把这些位置钉成"不得再加",但棘轮不会自动变小 —— 存量清零前,GA4 在这三端始终只是"没恶化",不是"已合规"。 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「P1 · 返回键同一型跨端清账(本票的直接续作)…(带 2026-09-28 清账注记并已于同日翻勾)」,派单以那条为准,本行不再单独派单;本行无编号 ⇒ 台账 F1/F4 的复合主键看不见这一对,故手工折,只加指针不动状态。〕
```

- 原 L11402(L1 外部持有行 L11427):

```
- [ ] **RN「记住密码」把账号+密码明文写进 AsyncStorage,而它正是票#20 那条自动登录判据的凭据源(需产品口径)** —— 实测 `apps/mobile-rn/src/lib/credential-storage.ts:72-87` 将 `{account,password}` 原样存入 `ihui-remember-credentials`(Android 上 AsyncStorage 是应用私有目录下的明文文件,root 或备份可读),而 `shouldAttemptAutoLogin` 读的 `hasRememberedCredentials()` 就是这一位。SecureStore 那层已在 `src/lib/auth/secure-store.ts` 用于凭据,记住密码这条链没跟上。两条出口:① 改存 SecureStore —— 但**登出标记必须留在不同层**:票#20 的 `ihui-session-logged-out` 刻意与凭据不同寿命(同层会被 `clearAll` 一起删,等于自己否决自己,理由写在该文件注释里);② 取消「记住密码」只留「自动登录」。禁止的省事做法:直接删 key —— 已勾选用户的勾选会静默失效且无任何提示。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L11403(L1 外部持有行 L11428):

```
- [ ] P1 **返回键同一型跨端清账(本票的直接续作)**:① `packages/app/src/features/**` 与两个共享 `NavBar` / `PayResultScreen` 的 ‹;② `apps/mobile-rn/src/screens/**` 及其端内 `NavBar`(RN 侧写法是 `lucide-react-native ChevronLeft`,端内 `apps/mobile-rn/src/screens/AboutScreen.tsx` 已有现成范例);③ `apps/extension` 那处「字符箭头 + 文字」双写(属 102 的 GA1 族而非 GA4)。做法与本票同:先复用该端既有矢量出口,再按文件收编,顺带删各自失效的样式工厂。**存量数字一律按上面那条命令现取,勿照任何文档里的历史数派单。** GA4 棘轮已把这些位置钉成"不得再加",但棘轮不会自动变小 —— 存量清零前,GA4 在这三端始终只是"没恶化",不是"已合规"。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L11404(L1 外部持有行 L11428):

```
- [ ] P1 **返回键同一型跨端清账(本票的直接续作)**:① `packages/app/src/features/**` 与两个共享 `NavBar` / `PayResultScreen` 的 ‹;② `apps/mobile-rn/src/screens/**` 及其端内 `NavBar`(RN 侧写法是 `lucide-react-native ChevronLeft`,端内 `apps/mobile-rn/src/screens/AboutScreen.tsx` 已有现成范例);③ `apps/extension` 那处「字符箭头 + 文字」双写(属 102 的 GA1 族而非 GA4)。做法与本票同:先复用该端既有矢量出口,再按文件收编,顺带删各自失效的样式工厂。**存量数字一律按上面那条命令现取,勿照任何文档里的历史数派单。** GA4 棘轮已把这些位置钉成"不得再加",但棘轮不会自动变小 —— 存量清零前,GA4 在这三端始终只是"没恶化",不是"已合规"。 【2026-09-28 清账注记(枚 140c783c3)】现取存量(按 GA4 判据剥 back-label-exempt 后实跑 auditFile):packages/app **45 处/42 文件**(features 错误/空态文字返回 41 + Selecter 字面量 1 + MessageInput 双写 1 + 翻页文字按钮 2;历史数 223/168 已失真)、mobile-rn **1 处/1 文件**(ModelConfigDialog 双写;screens 与端内 NavBar 实测已矢量,`‹`/`←` 存量 0)、extension **1 处/1 文件**(AgentPage 矢量+文字双写)⇒ 三端 47 处**全部收编矢量出口清零**(原可点容器内换 lucide ChevronLeft + accessibilityLabel/aria-label,删失效样式工厂与豁免标记;PayResultScreen 实测已是 BackChevron 无存量;共享 NavBar.tsx 为他人未跟踪在飞件,未动未计)。GA4 复跑:三端违规 0、行内豁免 59→12(余 12 属 miniapp/web 非本票范围)、盲区 0、门自检 104/104;packages/app tsc 0 错/vitest 17 全过,extension tsc 0 错/292 全过,mobile-rn 仅他人在飞未跟踪测试(chat-disclosure-tier-approval.test.tsx)红与本票无关。派单时 packages/app 存量 42 文件 >30,按票规保持未勾;实际剩余存量=0,复核 GA4 读数后即可翻勾。】 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L11405(L1 外部持有行 L15801):

```
- [ ] RN / miniapp 未消费 `tailPreview`(§9 跨端同步);本次补译的 zh-TW/en/ja/ko 四语归因译文待人复核。〔现读更正(2026-09-28):前半**已被证伪** —— tailPreview 消费面在 HEAD 实测命中 `apps/miniapp-taro/src/pkg-ai/ai/chat.tsx` 与 `context-usage-strip.tsx`、`packages/app/src/features/chat/ChatScreen.tsx` 与 `ContextUsagePanel.tsx`(共享 RN 屏即 mobile-rn 消费路径)⇒ "未消费"不成立,不得再按本行前半派单。本行唯一残余=后半"四语归因译文待人复核"(明文等人,不由机器代判)。〕 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L11406(L1 外部持有行 L15729):

```
- [ ] 〔【归并】同题多号收拢(2026-10-13,守门194):本行与 L7809(G-20) 同题,派单以持有行为准,本行不再单独派单。〕 G-20 **归属:端口注册表门 + ai-service ruff + 受保护检查 lint-typecheck-test —— 三条红都在干净已入库代码上,按 §12f 优先级高于任何新增工作** —— ① `node scripts/check-port-registry.mjs --all` 现读 23 处命中(默认档只扫 2 个文件所以本机看着绿,CI 带 `--all`),全部 in-commit,集中在今天新入库的门与其夹具:`scripts/tests/check-service-binary-pots…`(实读 `check-service-binary-paths.test.mjs` 13 处)、`scripts/check-service-binary-paths.mjs:1525-1529`、`apps/desktop/README.md:46-51`、`apps/cli/tests/` 2 处、`apps/api/src/utils/egress-retry-safety.ts:26`(JSDoc 里的示例地址,该 corpus 不剥注释)。该门的 `EXEMPT_PATH_PATTERNS`(`scripts/check-port-registry.mjs:220-245`)只豁免了 `apps/api/tests`、`apps/ai-service/tests`,**不含 `scripts/tests` 与 `apps/cli/tests`** ⇒ 修哪一侧属该门持有人裁,**不得为变绿删夹具**(夹具是把端口写进断言的正当形态)。② `apps/ai-service` 的 `ruff check .` 现读 54 errors / 32 文件(版本与 `pyproject.toml:88` 的 `ruff==0.16.6` 同 pin 可精确复现),其中 `app/routers/llm.py:3269` 的 `F821 Undefined name tool_exec_tracker` 是唯一疑似**真功能缺陷**的一格,其余是 I001/UP0xx/SIM 类风格。③ 受保护检查 `CI / lint-typecheck-test (push)` 本身在 `496e4ced44`/`bedf82ed9c`/`dd6fb971f5` 上均 failure ⇒ 直推还能走、PR 通道被堵,这是全队交付阻塞而不是一条难看;具体失败步骤未判定(GitHub 未认证配额耗尽 + 日志端点 403),取证另有一路在跑,结论落地后并入本行。 〔让位注记(2026-09-29):本行原为 G-815932,与另一会话同日取的「归属:…」那一行同号 —— 落地闸在归并时才判出"同两个号挂两种标题"(F9 新增撞号,不允许声明放行)。按本仓既有口径"已推送侧不动、未推送侧让号",由**本行**改到现算的空闲号;正文与判据一字未改。空闲号由 `lib/plan-task-index.usedIdsOfPrefix` 在"台账 ⊕ 归档件"那张占用面上现算,不写第二份判据。〕〔复测@2026-10-10(值守第 12 轮,三条各自量,不合并结论,本行保持未勾):① 端口注册表门已不复红 —— `node scripts/check-port-registry.mjs --all` 现读 rc=0，末行「51 槽 ≡ 派生集 51 槽(文档多报 0 / 注册表多认领 0)」，本行立项时的 23 处命中已消失，那一格无需再动 `EXEMPT_PATH_PATTERNS`。② ruff 仍是红的，但**红量与红点都变了**：同一命令在干净 HEAD 抽取面上现读 `Found 86 errors`(81 fixable)，而在共享工作树里同命令只报 13 条 —— 差值来自**他席 76 个未提交的 ai-service 文件**(它们已在盘上把 lint 扫过一遍，只差提交)。所以本轮**不留下第二份清扫**：本席先把 --fix 跑在那 10 个"当刻干净"的文件上(11 处)，与在飞那批比对后确认重叠 ⇒ 已按 HEAD 字节逐文件还原(净差 0，本席在这 10 个文件上无残留)，因为把同一件清扫复制成两份、落地顺序又不同，正是"互相写回旧态"的起点(§12 同型)；另:本行点名的 `apps/ai-service/app/routers/llm.py` 那一格 F821 现已不在 HEAD 面上(ruff --select F821 现读 All checks passed)，即"唯一疑似真功能缺陷"已被清，剩下的是风格档。③ 这条是本轮唯一被本席改动的：**main CI 的失败步骤不在 lint,而在 `ai-service-schema-check` 的签到建表自验** —— 实读 run 38009440233 末行 `AssertionError: checkin tables missing: 4` 而同一行打印的可见数正是 4，根因是 `.github/workflows/ci.yml` 把不变量写成了数量断言(assert n == 3)，签到线补第 4 张表后干净 HEAD 上每枚提交必红。修法已落地：期望集合改为从 `apps/ai-service/app/services/checkin_store.py` 源码里的建表语句现派生、逐名要求可见，派生为空按判据失明判红。取证(本机真跑，不是转述)：原样步 rc=0 并打印「DDL 声明 4 张,落库可见 4 张」；变异臂(往派生源塞一张不存在的表)rc=1 且点名该表；守门 48 工作流步序 rc=0。数量型锁的害正在于此 —— 它把"合法多一张"判成缺失，又在张数巧合时放过真缺表。〕
```

- 原 L11408(L1 外部持有行 L15801):

```
- [ ] RN / miniapp 未消费 `tailPreview`(§9 跨端同步);本次补译的 zh-TW/en/ja/ko 四语归因译文待人复核。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L11409(L1 外部持有行 L11428):

```
- [ ] P1 **返回键同一型跨端清账(本票的直接续作)**:① `packages/app/src/features/**` 与两个共享 `NavBar` / `PayResultScreen` 的 ‹;② `apps/mobile-rn/src/screens/**` 及其端内 `NavBar`(RN 侧写法是 `lucide-react-native ChevronLeft`,端内 `apps/mobile-rn/src/screens/AboutScreen.tsx` 已有现成范例);③ `apps/extension` 那处「字符箭头 + 文字」双写(属 102 的 GA1 族而非 GA4)。做法与本票同:先复用该端既有矢量出口,再按文件收编,顺带删各自失效的样式工厂。**存量数字一律按上面那条命令现取,勿照任何文档里的历史数派单。** GA4 棘轮已把这些位置钉成"不得再加",但棘轮不会自动变小 —— 存量清零前,GA4 在这三端始终只是"没恶化",不是"已合规"。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L11411(L1 外部持有行 L15801):

```
- [ ] RN / miniapp 未消费 `tailPreview`(§9 跨端同步);本次补译的 zh-TW/en/ja/ko 四语归因译文待人复核。〔现读更正(2026-09-28):前半**已被证伪** —— tailPreview 消费面在 HEAD 实测命中 `apps/miniapp-taro/src/pkg-ai/ai/chat.tsx` 与 `context-usage-strip.tsx`、`packages/app/src/features/chat/ChatScreen.tsx` 与 `ContextUsagePanel.tsx`(共享 RN 屏即 mobile-rn 消费路径)⇒ "未消费"不成立,不得再按本行前半派单。本行唯一残余=后半"四语归因译文待人复核"(明文等人,不由机器代判)。〕 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L11412(L1 外部持有行 L11428):

```
- [ ] P1 **返回键同一型跨端清账(本票的直接续作)**:① `packages/app/src/features/**` 与两个共享 `NavBar` / `PayResultScreen` 的 ‹;② `apps/mobile-rn/src/screens/**` 及其端内 `NavBar`(RN 侧写法是 `lucide-react-native ChevronLeft`,端内 `apps/mobile-rn/src/screens/AboutScreen.tsx` 已有现成范例);③ `apps/extension` 那处「字符箭头 + 文字」双写(属 102 的 GA1 族而非 GA4)。做法与本票同:先复用该端既有矢量出口,再按文件收编,顺带删各自失效的样式工厂。**存量数字一律按上面那条命令现取,勿照任何文档里的历史数派单。** GA4 棘轮已把这些位置钉成"不得再加",但棘轮不会自动变小 —— 存量清零前,GA4 在这三端始终只是"没恶化",不是"已合规"。 【2026-09-28 清账注记(枚 140c783c3)】现取存量(按 GA4 判据剥 back-label-exempt 后实跑 auditFile):packages/app **45 处/42 文件**(features 错误/空态文字返回 41 + Selecter 字面量 1 + MessageInput 双写 1 + 翻页文字按钮 2;历史数 223/168 已失真)、mobile-rn **1 处/1 文件**(ModelConfigDialog 双写;screens 与端内 NavBar 实测已矢量,`‹`/`←` 存量 0)、extension **1 处/1 文件**(AgentPage 矢量+文字双写)⇒ 三端 47 处**全部收编矢量出口清零**(原可点容器内换 lucide ChevronLeft + accessibilityLabel/aria-label,删失效样式工厂与豁免标记;PayResultScreen 实测已是 BackChevron 无存量;共享 NavBar.tsx 为他人未跟踪在飞件,未动未计)。GA4 复跑:三端违规 0、行内豁免 59→12(余 12 属 miniapp/web 非本票范围)、盲区 0、门自检 104/104;packages/app tsc 0 错/vitest 17 全过,extension tsc 0 错/292 全过,mobile-rn 仅他人在飞未跟踪测试(chat-disclosure-tier-approval.test.tsx)红与本票无关。派单时 packages/app 存量 42 文件 >30,按票规保持未勾;实际剩余存量=0,复核 GA4 读数后即可翻勾。】 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L11413(L1 外部持有行 L11427):

```
- [ ] **RN「记住密码」把账号+密码明文写进 AsyncStorage,而它正是票#20 那条自动登录判据的凭据源(需产品口径)** —— 实测 `apps/mobile-rn/src/lib/credential-storage.ts:72-87` 将 `{account,password}` 原样存入 `ihui-remember-credentials`(Android 上 AsyncStorage 是应用私有目录下的明文文件,root 或备份可读),而 `shouldAttemptAutoLogin` 读的 `hasRememberedCredentials()` 就是这一位。SecureStore 那层已在 `src/lib/auth/secure-store.ts` 用于凭据,记住密码这条链没跟上。两条出口:① 改存 SecureStore —— 但**登出标记必须留在不同层**:票#20 的 `ihui-session-logged-out` 刻意与凭据不同寿命(同层会被 `clearAll` 一起删,等于自己否决自己,理由写在该文件注释里);② 取消「记住密码」只留「自动登录」。禁止的省事做法:直接删 key —— 已勾选用户的勾选会静默失效且无任何提示。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L11417(L1 外部持有行 L15390):

```
- [ ] **P1-① 扩共享层首批(在等:逐屏清单裁决,量级 10–20 人日)**:两端 UI 里重复的业务 props / hooks 继续上提 `packages/shared`。〔【归并】重复登记副本(2026-10-10 量,本席):本行是该题**最早**的形态(现读 95 字节,只写着"量级 10–20 人日"与"继续上提"),其前提已被实测否证(同名导出只 4 件)且 4 件已逐件判定完毕 —— 现行结论见同题带「票面前提已被实测否证」字样的长行(现读入口 `git show HEAD:PROJECT_PLAN.md | grep -n "P1-① 扩共享层首批"`)。按 §1 的 F4 口径**只加指针、不动勾选**,也不摘声明位编号(守门 71 按"编号 + 题面原文前缀"判丢行,摘号会让自愈层把本行整条回捞)。〕
```

- 原 L11418(L1 外部持有行 L11547):

```
- [ ] **P1-① 扩共享层首批 —— 票面前提已被实测否证,剩余只有 4 件(在等:逐件判定谁在渲染,不是 10–20 人日的一批)**:按「同名导出」量两端(miniapp 452 个源文件 / 812 个导出名 × packages/app 224 个文件 / 226 个导出名;覆盖面自证与读数一起打,枚举到 0 个文件当场抛),两端同名而 `packages/shared` 还没有的仅 **4 件**:`BackChevron` / `SectionHeader` / `Selecter` / `UserInfoCard`。其中 BackChevron 的两份同名实现已在守门 102 的 S0 机制清单里,`UserInfoCard` 的第四份已由 O81 票登记为 DOM 死副本并明令不删(§7 删除安全)⇒ 这一条的真实工作是**逐件判定哪份在屏幕上渲染**,不是批量上提。顺带量到:`apps/miniapp-taro/src/components/SectionHeader.tsx` 是 default export、`components/index.ts` 没递它、全端零「从 `@/components/SectionHeader` 取用」的 import ⇒ P2-F 把三个页面切到 `@/components/adapters` 之后它是孤儿副本;删与留属该端持有人裁决,本条只留证据不下结论。**判据边界(不得读歪)**:这把尺子只认同名,不同名而同意象的重复(RN 的 camelCase 样式键 vs 小程序的 kebab 类名)它结构上看不见,所以「4 件」不等于「两端 UI 只剩 4 处重复」—— 后一维的尺子是守门 128 的 RE 维,它现读对 7 族零判据(两侧未同名,已报名)。 〔重复登记副本·派单指针(2026-10-09 量,本席):本行与同题的另一条登记前缀逐字相同而**信息更少**(持有那条在同题正文之外多 801 字节(裁决与尺子边界的后续),本条是它的早期形态)⇒ **派单以题面「**P1-① 扩共享层首批 —— 票面前提已被实测否证,剩余只有 4…」中较长的那条(现读 1133 字节)为准**,本行不再单独派单。按 §1 的 F4 口径**不动勾选** —— 两条都是没做完的事,把没做的记成做过的比原病更响;也不摘声明位编号(守门 71 按"编号 + 题面原文前缀"判丢行,摘号会让自愈层把本行整条回捞,批⑤→⑦ 四轮循环即此),复核入口:`git show HEAD:PROJECT_PLAN.md | grep -F ' ] **P1-① 扩共享层首批 —— 票面前提已被实' | awk '{print length()}'` 应现读到两条长度不等的同题行。〕 〔拍板@2026-10-09 机主授权代行:4 件逐件判定——BackChevron/SectionHeader 上提 shared,Selecter 核消费面,UserInfoCard 按 O81 登记不删;小票派单。〕
```

- 原 L11420(L1 外部持有行 L11427):

```
- [ ] **RN「记住密码」把账号+密码明文写进 AsyncStorage,而它正是票#20 那条自动登录判据的凭据源(需产品口径)** —— 实测 `apps/mobile-rn/src/lib/credential-storage.ts:72-87` 将 `{account,password}` 原样存入 `ihui-remember-credentials`(Android 上 AsyncStorage 是应用私有目录下的明文文件,root 或备份可读),而 `shouldAttemptAutoLogin` 读的 `hasRememberedCredentials()` 就是这一位。SecureStore 那层已在 `src/lib/auth/secure-store.ts` 用于凭据,记住密码这条链没跟上。两条出口:① 改存 SecureStore —— 但**登出标记必须留在不同层**:票#20 的 `ihui-session-logged-out` 刻意与凭据不同寿命(同层会被 `clearAll` 一起删,等于自己否决自己,理由写在该文件注释里);② 取消「记住密码」只留「自动登录」。禁止的省事做法:直接删 key —— 已勾选用户的勾选会静默失效且无任何提示。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L11421(L1 外部持有行 L15801):

```
- [ ] RN / miniapp 未消费 `tailPreview`(§9 跨端同步);本次补译的 zh-TW/en/ja/ko 四语归因译文待人复核。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L11422(L1 外部持有行 L11428):

```
- [ ] P1 **返回键同一型跨端清账(本票的直接续作)**:① `packages/app/src/features/**` 与两个共享 `NavBar` / `PayResultScreen` 的 ‹;② `apps/mobile-rn/src/screens/**` 及其端内 `NavBar`(RN 侧写法是 `lucide-react-native ChevronLeft`,端内 `apps/mobile-rn/src/screens/AboutScreen.tsx` 已有现成范例);③ `apps/extension` 那处「字符箭头 + 文字」双写(属 102 的 GA1 族而非 GA4)。做法与本票同:先复用该端既有矢量出口,再按文件收编,顺带删各自失效的样式工厂。**存量数字一律按上面那条命令现取,勿照任何文档里的历史数派单。** GA4 棘轮已把这些位置钉成"不得再加",但棘轮不会自动变小 —— 存量清零前,GA4 在这三端始终只是"没恶化",不是"已合规"。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L11424(L1 外部持有行 L15801):

```
- [ ] RN / miniapp 未消费 `tailPreview`(§9 跨端同步);本次补译的 zh-TW/en/ja/ko 四语归因译文待人复核。〔现读更正(2026-09-28):前半**已被证伪** —— tailPreview 消费面在 HEAD 实测命中 `apps/miniapp-taro/src/pkg-ai/ai/chat.tsx` 与 `context-usage-strip.tsx`、`packages/app/src/features/chat/ChatScreen.tsx` 与 `ContextUsagePanel.tsx`(共享 RN 屏即 mobile-rn 消费路径)⇒ "未消费"不成立,不得再按本行前半派单。本行唯一残余=后半"四语归因译文待人复核"(明文等人,不由机器代判)。〕 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L11425(L1 外部持有行 L11428):

```
- [ ] P1 **返回键同一型跨端清账(本票的直接续作)**:① `packages/app/src/features/**` 与两个共享 `NavBar` / `PayResultScreen` 的 ‹;② `apps/mobile-rn/src/screens/**` 及其端内 `NavBar`(RN 侧写法是 `lucide-react-native ChevronLeft`,端内 `apps/mobile-rn/src/screens/AboutScreen.tsx` 已有现成范例);③ `apps/extension` 那处「字符箭头 + 文字」双写(属 102 的 GA1 族而非 GA4)。做法与本票同:先复用该端既有矢量出口,再按文件收编,顺带删各自失效的样式工厂。**存量数字一律按上面那条命令现取,勿照任何文档里的历史数派单。** GA4 棘轮已把这些位置钉成"不得再加",但棘轮不会自动变小 —— 存量清零前,GA4 在这三端始终只是"没恶化",不是"已合规"。 【2026-09-28 清账注记(枚 140c783c3)】现取存量(按 GA4 判据剥 back-label-exempt 后实跑 auditFile):packages/app **45 处/42 文件**(features 错误/空态文字返回 41 + Selecter 字面量 1 + MessageInput 双写 1 + 翻页文字按钮 2;历史数 223/168 已失真)、mobile-rn **1 处/1 文件**(ModelConfigDialog 双写;screens 与端内 NavBar 实测已矢量,`‹`/`←` 存量 0)、extension **1 处/1 文件**(AgentPage 矢量+文字双写)⇒ 三端 47 处**全部收编矢量出口清零**(原可点容器内换 lucide ChevronLeft + accessibilityLabel/aria-label,删失效样式工厂与豁免标记;PayResultScreen 实测已是 BackChevron 无存量;共享 NavBar.tsx 为他人未跟踪在飞件,未动未计)。GA4 复跑:三端违规 0、行内豁免 59→12(余 12 属 miniapp/web 非本票范围)、盲区 0、门自检 104/104;packages/app tsc 0 错/vitest 17 全过,extension tsc 0 错/292 全过,mobile-rn 仅他人在飞未跟踪测试(chat-disclosure-tier-approval.test.tsx)红与本票无关。派单时 packages/app 存量 42 文件 >30,按票规保持未勾;实际剩余存量=0,复核 GA4 读数后即可翻勾。】 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L11429(L1 外部持有行 L11547):

```
- [ ] **P1-① 扩共享层首批 —— 票面前提已被实测否证,剩余只有 4 件(在等:逐件判定谁在渲染,不是 10–20 人日的一批)**:按「同名导出」量两端(miniapp 452 个源文件 / 812 个导出名 × packages/app 224 个文件 / 226 个导出名;覆盖面自证与读数一起打,枚举到 0 个文件当场抛),两端同名而 `packages/shared` 还没有的仅 **4 件**:`BackChevron` / `SectionHeader` / `Selecter` / `UserInfoCard`。其中 BackChevron 的两份同名实现已在守门 102 的 S0 机制清单里,`UserInfoCard` 的第四份已由 O81 票登记为 DOM 死副本并明令不删(§7 删除安全)⇒ 这一条的真实工作是**逐件判定哪份在屏幕上渲染**,不是批量上提。顺带量到:端内那份零消费者、零深导入的 SectionHeader 副本(小程序腿,与 adapters 那条同名) 是 default export、`components/index.ts` 没递它、全端零「从 `@/components/SectionHeader` 取用」的 import ⇒ P2-F 把三个页面切到 `@/components/adapters` 之后它是孤儿副本;删与留属该端持有人裁决,本条只留证据不下结论。**判据边界(不得读歪)**:这把尺子只认同名,不同名而同意象的重复(RN 的 camelCase 样式键 vs 小程序的 kebab 类名)它结构上看不见,所以「4 件」不等于「两端 UI 只剩 4 处重复」—— 后一维的尺子是守门 128 的 RE 维,它现读对 7 族零判据(两侧未同名,已报名)。 〔重复登记副本·派单指针(2026-10-09 量,本席):本行与同题的另一条登记前缀逐字相同而**信息更少**(持有那条在同题正文之外多 801 字节(裁决与尺子边界的后续),本条是它的早期形态)⇒ **派单以题面「**P1-① 扩共享层首批 —— 票面前提已被实测否证,剩余只有 4…」中较长的那条(现读 1133 字节)为准**,本行不再单独派单。按 §1 的 F4 口径**不动勾选** —— 两条都是没做完的事,把没做的记成做过的比原病更响;也不摘声明位编号(守门 71 按"编号 + 题面原文前缀"判丢行,摘号会让自愈层把本行整条回捞,批⑤→⑦ 四轮循环即此),复核入口:`git show HEAD:PROJECT_PLAN.md | grep -F ' ] **P1-① 扩共享层首批 —— 票面前提已被实' | awk '{print length()}'` 应现读到两条长度不等的同题行。〕 〔拍板@2026-10-09 机主授权代行:4 件逐件判定——BackChevron/SectionHeader 上提 shared,Selecter 核消费面,UserInfoCard 按 O81 登记不删;小票派单。〕 〔副本行@2026-10-09 只去路径点名,不动勾选(§1 F4:副本行加指针不动状态);同题持有行见结清@2026-10-09那一条。〕
```

- 原 L11432(L1 外部持有行 L11547):

```
- [ ] **P1-① 扩共享层首批 —— 票面前提已被实测否证,剩余只有 4 件(在等:逐件判定谁在渲染,不是 10–20 人日的一批)**:按「同名导出」量两端(miniapp 452 个源文件 / 812 个导出名 × packages/app 224 个文件 / 226 个导出名;覆盖面自证与读数一起打,枚举到 0 个文件当场抛),两端同名而 `packages/shared` 还没有的仅 **4 件**:`BackChevron` / `SectionHeader` / `Selecter` / `UserInfoCard`。其中 BackChevron 的两份同名实现已在守门 102 的 S0 机制清单里,`UserInfoCard` 的第四份已由 O81 票登记为 DOM 死副本并明令不删(§7 删除安全)⇒ 这一条的真实工作是**逐件判定哪份在屏幕上渲染**,不是批量上提。顺带量到:`小程序端 components 目录那份同名未接线旧副本(非 adapters 腿)` 是 default export、`components/index.ts` 没递它、全端零「从 `@/components/SectionHeader` 取用」的 import ⇒ P2-F 把三个页面切到 `@/components/adapters` 之后它是孤儿副本;删与留属该端持有人裁决,本条只留证据不下结论。**判据边界(不得读歪)**:这把尺子只认同名,不同名而同意象的重复(RN 的 camelCase 样式键 vs 小程序的 kebab 类名)它结构上看不见,所以「4 件」不等于「两端 UI 只剩 4 处重复」—— 后一维的尺子是守门 128 的 RE 维,它现读对 7 族零判据(两侧未同名,已报名)。 〔重复登记副本·派单指针(2026-10-09 量,本席):本行与同题的另一条登记前缀逐字相同而**信息更少**(持有那条在同题正文之外多 801 字节(裁决与尺子边界的后续),本条是它的早期形态)⇒ **派单以题面「**P1-① 扩共享层首批 —— 票面前提已被实测否证,剩余只有 4…」中较长的那条(现读 1133 字节)为准**,本行不再单独派单。按 §1 的 F4 口径**不动勾选** —— 两条都是没做完的事,把没做的记成做过的比原病更响;也不摘声明位编号(守门 71 按"编号 + 题面原文前缀"判丢行,摘号会让自愈层把本行整条回捞,批⑤→⑦ 四轮循环即此),复核入口:`git show HEAD:PROJECT_PLAN.md | grep -F ' ] **P1-① 扩共享层首批 —— 票面前提已被实' | awk '{print length()}'` 应现读到两条长度不等的同题行。〕 〔拍板@2026-10-09 机主授权代行:4 件逐件判定——BackChevron/SectionHeader 上提 shared,Selecter 核消费面,UserInfoCard 按 O81 登记不删;小票派单。〕
```

- 原 L11516(L1 外部持有行 L10641):

```
- [ ] 4. 观察期:**首个 GREEN run 达成(2026-09-14,ac4acf3f:577 passed / 0 failed / 4 flaky / 66 skipped @13.6m——2026-08-20 以来 400+ 连红后首次 success)**。连续 3 次 main push 稳定绿后收官(并行会话持续推 main,后续 push 由后续会话按此基准观察;注意并行会话自有改动若再引入失败,以本节根因方法论排查)。CI 迭代实证(每轮根因→修复):44 败(run 34828980145)→ 15 败(34835579747,登录竞争+token 过期清零)→ 12 败(34839041078)→ 1 败(4d4932f run,579/1/1/66 @13.6m)→ 1 败(11f2cf5 run,578/1/2/66 @15.3m)→ **0 败(ac4acf3f run)**。④ 观察 3b 追加:**CSP 根因(产品级)**——`detectStreamBaseUrl` dev 分支仅凭 hostname=localhost:8801 判定,CI e2e 的生产构建 web 同跑 localhost:8801 → streamBaseUrl 跨源直连 8802 → 被 CSP `connect-src 'self' https: wss: ws:` 拦截(trace console 铁证)→ streamChat 无限重试,SSE 用例全灭;修复 = dev 分支叠加 `NODE_ENV==='development'` 门控(commit `4d4932ff`,生产/dev/Tauri 行为不变)。web 构建/运行补 JWT_SECRET(edge 中间件验签,SRO 接管根因,run 34835579747 im-channels error-context 铁证);share-function-test 自建数据 + 消息卡片改轮询(`11f2cf59`)。**教训链:本地 127.0.0.1:8821 同源 + 13.6m 快机,把 CI 的 localhost:8801 跨源 CSP、45.6m 慢机 token 过期、全新库环境依赖全部掩盖**。 〔拍板@2026-10-09 机主授权代行:维持观察口径,首个 GREEN run 后按票面节奏复核,不提前收口。〕 〔【归并】重复登记副本(2026-10-10):同主键的另一条登记 「4 · 首个GREENrun达成」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11519(L1 外部持有行 L11539):

```
- [ ] **`CourseScreen:113` 那格盲区的精确成因(不再是"未知失配"),以及为什么这一枚仍没修**: 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L11521(L1 外部持有行 L11539):

```
- [ ] **`CourseScreen:113` 那格盲区的精确成因(不再是"未知失配"),以及为什么这一枚仍没修**: 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L11523(L1 外部持有行 L15779):

```
- [ ] 4. 观察期:**首个 GREEN run 达成(2026-09-14,ac4acf3f:577 passed / 0 failed / 4 flaky / 66 skipped 〔【归并】重复登记副本(2026-10-10):同主键的另一条登记 「4 · 首个GREENrun达成」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11529(L1 外部持有行 L11539):

```
- [ ] **`CourseScreen:113` 那格盲区的精确成因(不再是"未知失配"),以及为什么这一枚仍没修**: 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L11531(L1 外部持有行 L15779):

```
- [ ] 4. 观察期:**首个 GREEN run 达成(2026-09-14,ac4acf3f:577 passed / 0 failed / 4 flaky / 66 skipped〔sha无从找回:ac4acf3f=首个GREEN run(2026-09-14,577 passed)旧史提交,单根02b2d353ad之前,结构上无从找回〕 〔【归并】重复登记副本(2026-10-10):同主键的另一条登记 「4 · 首个GREENrun达成」,派单以那条为准,本行不再单独派单。〕
```

- 原 L11533(L1 外部持有行 L11515):

```
- [ ] 双端功能矩阵维护(2026-08-26 立,跨端:apps/web + apps/mobile-rn)— 基线 `outputs/双端功能矩阵-2026-08-26.md`(源:reports/web-vs-mobile-feature-audit-2026-08-26.html,严格口径复核 M5 验收)。规则:双端新增/改动功能时对照矩阵维护,避免再次出现"一端有另一端无"。遗留待办(按优先级):~~① Chat 附件(expo-document-picker)/语音 TTS/收藏/素材库占位补齐~~✅(附件/TTS/素材库 2026-08-26;会话收藏 2026-09-05 补齐:api-client favoriteConversation/unfavoriteConversation + Drawer 左滑收藏/删除双按钮乐观接线,9 屏映射补 favorited);~~② WebViewScreen 按功能域细分接入~~✅(webview-portal-config 16 域,会话打通运行时验证仍待装机);~~③ knowledge-rag/subagents 原生化~~✅(2026-08-26;workspace 依赖 IDE 本地 FS 属合理差异);~~④ HomeScreen 素材详情、DeveloperScreen 占位清理~~✅(2026-08-26;2026-09-05 补 DeveloperScreen 过时注释修正 + RankingDetailScreen 领取免费资料接复制飞书链接)。剩余:WebView 会话打通装机实测(协议层已 2026-09-07 全链路验证+缺陷根治,仅剩真机 UI 体验确认);~~DeveloperScreen getDevInfo(需后端补接口)~~✅(2026-09-07 核验闭环:后端 GET /api/developer/dev-info 聚合端点(developer.ts:185,含 website)+ api-client getDeveloperDevInfo + DeveloperScreen 接线均已存在,无需补接口)〔【归并】重复登记副本(2026-10-10 量,本席):合流把同题的两条未勾登记并到了一起,本行是**信息更少**的那一条(现读 921 字节,另一条 1311 字节,多出的是 2026-10-09 的机主拍板与本轮交代);派单一律走较长那条(现读入口 `git show HEAD:PROJECT_PLAN.md | grep -n "双端功能矩阵维护"` 两条未勾、长度不等)。按 §1 的 F4 口径**只加指针、不动勾选** —— 这一格仍未闭的那半是「WebView 会话打通的真机 UI 体验确认」,它等的是机主职权(用生产管理员凭据登录到机主手机并产生真实会话记录),不是 agent 能代做的,也不是等新环境。〕
```

- 原 L11534(L1 外部持有行 L10641):

```
- [ ] 4. 观察期:**首个 GREEN run 达成(2026-09-14,ac4acf3f:577 passed / 0 failed / 4 flaky / 66 skipped @13.6m——2026-08-20 以来 400+ 连红后首次 success)**。连续 3 次 main push 稳定绿后收官(并行会话持续推 main,后续 push 由后续会话按此基准观察;注意并行会话自有改动若再引入失败,以本节根因方法论排查)。CI 迭代实证(每轮根因→修复):44 败(run 34828980145)→ 15 败(34835579747,登录竞争+token 过期清零)→ 12 败(34839041078)→ 1 败(4d4932f run,579/1/1/66 @13.6m)→ 1 败(11f2cf5 run,578/1/2/66 @15.3m)→ **0 败(ac4acf3f run)**。④ 观察 3b 追加:**CSP 根因(产品级)**——`detectStreamBaseUrl` dev 分支仅凭 hostname=localhost:8801 判定,CI e2e 的生产构建 web 同跑 localhost:8801 → streamBaseUrl 跨源直连 8802 → 被 CSP `connect-src 'self' https: wss: ws:` 拦截(trace console 铁证)→ streamChat 无限重试,SSE 用例全灭;修复 = dev 分支叠加 `NODE_ENV==='development'` 门控(commit `4d4932ff`,生产/dev/Tauri 行为不变)。web 构建/运行补 JWT_SECRET(edge 中间件验签,SRO 接管根因,run 34835579747 im-channels error-context 铁证);share-function-test 自建数据 + 消息卡片改轮询(`11f2cf59`)。**教训链:本地 127.0.0.1:8821 同源 + 13.6m 快机,把 CI 的 localhost:8801 跨源 CSP、45.6m 慢机 token 过期、全新库环境依赖全部掩盖**。〔sha无从找回:ac4acf3f=首个GREEN run(2026-09-14,577 passed)旧史提交,单根02b2d353ad之前,结构上无从找回〕 〔【归并】重复登记副本(2026-10-10):同主键的另一条登记 「4 · 首个GREENrun达成」,派单以那条为准,本行不再单独派单。〕
```

- 原 L15337(L1 外部持有行 L7966):

```
- [ ] **门 35(mypy,blocking)此刻对 HEAD 内容就是红的**:一轮 `mypy app --strict` 有 4 条错误落在 `git status` **干净**的文件上(`app/routers/llm.py:1374`、`app/main.py:257`、`app/services/tool_input_scanner.py:34`、`app/services/mcp_server.py:2333`),另 3 条落在他人持有、此刻在飞的 `app/services/agent_engine.py`。后果是 §12e 那一型:**每个碰 ai-service 的提交都被逼 `--no-verify`,连带约 180 道门对该提交作废**(本票第一枚提交就被它连带跳门,归因记录见 `.workbuddy/safe-commit-attestation.jsonl`)。两条诚实限定:① `main.py:257` 的期望类型定义在别的文件里,严格判"HEAD 面红"要一次 `git archive` 隔离检出后复量;② `tool_input_scanner.py:34` / `mcp_server.py:2333` 是"模块没有该属性",与 `app/services/sandbox/` 的导出面有关,修它可能改动别人的运行时行为而非只加注解。归属:Python 侧门持有者;解阻判据 = 隔离检出复量后逐条定性(真缺陷修代码、过期注解修类型),**不得为变绿去削 `--strict` 或加 `# type: ignore`**。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15341(L1 外部持有行 L7987):

```
- [ ] **⑤-附:运行副本要不要也开邮件,前提已变,请重新决定**。我**没有**覆盖 `D:\DevEnv\monitor\alertmanager\alertmanager.yml`:那是当前唯一真正在到人的 webhook 路由,拿模板产物整文件替换会有回归面;正确做法是在那份文件里**追加** `global` 邮件段 + 一个 email receiver(保留原 route 不动)。因为你当初批准这条的依据是"告警从未送达",而该前提已被我证伪,所以这一步改回由你定,我不代做。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔拍板@2026-10-12 机主授权代行:运行副本不开邮件——主副本告警已到人,双份只产噪音(§5e-1 不能整改的告警不进人通道);维持登记。〕
```

- 原 L15348(L1 外部持有行 L7966):

```
- [ ] **门 35(mypy,blocking)此刻对 HEAD 内容就是红的**:一轮 `mypy app --strict` 有 4 条错误落在 `git status` **干净**的文件上(`app/routers/llm.py:1374`、`app/main.py:257`、`app/services/tool_input_scanner.py:34`、`app/services/mcp_server.py:2333`),另 3 条落在他人持有、此刻在飞的 `app/services/agent_engine.py`。后果是 §12e 那一型:**每个碰 ai-service 的提交都被逼 `--no-verify`,连带约 180 道门对该提交作废**(本票第一枚提交就被它连带跳门,归因记录见 `.workbuddy/safe-commit-attestation.jsonl`)。两条诚实限定:① `main.py:257` 的期望类型定义在别的文件里,严格判"HEAD 面红"要一次 `git archive` 隔离检出后复量;② `tool_input_scanner.py:34` / `mcp_server.py:2333` 是"模块没有该属性",与 `app/services/sandbox/` 的导出面有关,修它可能改动别人的运行时行为而非只加注解。归属:Python 侧门持有者;解阻判据 = 隔离检出复量后逐条定性(真缺陷修代码、过期注解修类型),**不得为变绿去削 `--strict` 或加 `# type: ignore`**。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15349(L1 外部持有行 L7987):

```
- [ ] **⑤-附:运行副本要不要也开邮件,前提已变,请重新决定**。我**没有**覆盖 `D:\DevEnv\monitor\alertmanager\alertmanager.yml`:那是当前唯一真正在到人的 webhook 路由,拿模板产物整文件替换会有回归面;正确做法是在那份文件里**追加** `global` 邮件段 + 一个 email receiver(保留原 route 不动)。因为你当初批准这条的依据是"告警从未送达",而该前提已被我证伪,所以这一步改回由你定,我不代做。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔拍板@2026-10-12 机主授权代行:运行副本不开邮件——主副本告警已到人,双份只产噪音(§5e-1 不能整改的告警不进人通道);维持登记。〕
```

- 原 L15362(L1 外部持有行 L7966):

```
- [ ] **门 35(mypy,blocking)此刻对 HEAD 内容就是红的**:一轮 `mypy app --strict` 有 4 条错误落在 `git status` **干净**的文件上(`app/routers/llm.py:1374`、`app/main.py:257`、`app/services/tool_input_scanner.py:34`、`app/services/mcp_server.py:2333`),另 3 条落在他人持有、此刻在飞的 `app/services/agent_engine.py`。后果是 §12e 那一型:**每个碰 ai-service 的提交都被逼 `--no-verify`,连带约 180 道门对该提交作废**(本票第一枚提交就被它连带跳门,归因记录见 `.workbuddy/safe-commit-attestation.jsonl`)。两条诚实限定:① `main.py:257` 的期望类型定义在别的文件里,严格判"HEAD 面红"要一次 `git archive` 隔离检出后复量;② `tool_input_scanner.py:34` / `mcp_server.py:2333` 是"模块没有该属性",与 `app/services/sandbox/` 的导出面有关,修它可能改动别人的运行时行为而非只加注解。归属:Python 侧门持有者;解阻判据 = 隔离检出复量后逐条定性(真缺陷修代码、过期注解修类型),**不得为变绿去削 `--strict` 或加 `# type: ignore`**。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15363(L1 外部持有行 L7987):

```
- [ ] **⑤-附:运行副本要不要也开邮件,前提已变,请重新决定**。我**没有**覆盖 `D:\DevEnv\monitor\alertmanager\alertmanager.yml`:那是当前唯一真正在到人的 webhook 路由,拿模板产物整文件替换会有回归面;正确做法是在那份文件里**追加** `global` 邮件段 + 一个 email receiver(保留原 route 不动)。因为你当初批准这条的依据是"告警从未送达",而该前提已被我证伪,所以这一步改回由你定,我不代做。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔拍板@2026-10-12 机主授权代行:运行副本不开邮件——主副本告警已到人,双份只产噪音(§5e-1 不能整改的告警不进人通道);维持登记。〕
```

- 原 L15365(L1 外部持有行 L3908):

```
- [ ] **剩一条已量化、未修(需产品决策,非纯工程)**:主端点 `aizhs.top/desktop-feed.json` **只写 〔【归并】重复登记副本(2026-10-06/g2-alltasks):本行为截断残行(正文止于"只写"),完整登记见带 g2-alltasks 标记的主行(含 desktop-feed.json 单端点进展注记,定稿枚 ea7616fecf),派单以主行为准,本行不再单独派单。〕 〔拍板@2026-10-12 机主授权代行:按本行正文所述最优路径执行,前置自然解除后落地;维持登记,交代成立。〕
```

- 原 L15376(L1 外部持有行 L11427):

```
- [ ] **RN「记住密码」把账号+密码明文写进 AsyncStorage,而它正是票#20 那条自动登录判据的凭据源(需产品口径)** —— 实测 `apps/mobile-rn/src/lib/credential-storage.ts:72-87` 将 `{account,password}` 原样存入 `ihui-remember-credentials`(Android 上 AsyncStorage 是应用私有目录下的明文文件,root 或备份可读),而 `shouldAttemptAutoLogin` 读的 `hasRememberedCredentials()` 就是这一位。SecureStore 那层已在 `src/lib/auth/secure-store.ts` 用于凭据,记住密码这条链没跟上。两条出口:① 改存 SecureStore —— 但**登出标记必须留在不同层**:票#20 的 `ihui-session-logged-out` 刻意与凭据不同寿命(同层会被 `clearAll` 一起删,等于自己否决自己,理由写在该文件注释里);② 取消「记住密码」只留「自动登录」。禁止的省事做法:直接删 key —— 已勾选用户的勾选会静默失效且无任何提示。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔拍板@2026-10-12 机主授权代行:RN/跨端族用户指示本批暂缓,维持登记待 RN 窗口;本行交代成立。〕
```

- 原 L15378(L1 外部持有行 L11427):

```
- [ ] **RN「记住密码」把账号+密码明文写进 AsyncStorage,而它正是票#20 那条自动登录判据的凭据源(需产品口径)** —— 实测 `apps/mobile-rn/src/lib/credential-storage.ts:72-87` 将 `{account,password}` 原样存入 `ihui-remember-credentials`(Android 上 AsyncStorage 是应用私有目录下的明文文件,root 或备份可读),而 `shouldAttemptAutoLogin` 读的 `hasRememberedCredentials()` 就是这一位。SecureStore 那层已在 `src/lib/auth/secure-store.ts` 用于凭据,记住密码这条链没跟上。两条出口:① 改存 SecureStore —— 但**登出标记必须留在不同层**:票#20 的 `ihui-session-logged-out` 刻意与凭据不同寿命(同层会被 `clearAll` 一起删,等于自己否决自己,理由写在该文件注释里);② 取消「记住密码」只留「自动登录」。禁止的省事做法:直接删 key —— 已勾选用户的勾选会静默失效且无任何提示。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔拍板@2026-10-12 机主授权代行:RN/跨端族用户指示本批暂缓,维持登记待 RN 窗口;本行交代成立。〕
```

- 原 L15380(L1 外部持有行 L15390):

```
- [ ] **P1-① 扩共享层首批(在等:逐屏清单裁决,量级 10–20 人日)**:两端 UI 里重复的业务 props / hooks 继续上提 `packages/shared`。〔【归并】重复登记副本(2026-10-10 量,本席):本行是该题**最早**的形态(现读 95 字节,只写着"量级 10–20 人日"与"继续上提"),其前提已被实测否证(同名导出只 4 件)且 4 件已逐件判定完毕 —— 现行结论见同题带「票面前提已被实测否证」字样的长行(现读入口 `git show HEAD:PROJECT_PLAN.md | grep -n "P1-① 扩共享层首批"`)。按 §1 的 F4 口径**只加指针、不动勾选**,也不摘声明位编号(守门 71 按"编号 + 题面原文前缀"判丢行,摘号会让自愈层把本行整条回捞)。〕 〔拍板@2026-10-12 机主授权代行:列入 backlog 按价值排期,不阻塞当前批次;维持登记。〕
```

- 原 L15381(L1 外部持有行 L11547):

```
- [ ] **P1-① 扩共享层首批 —— 票面前提已被实测否证,剩余只有 4 件(在等:逐件判定谁在渲染,不是 10–20 人日的一批)**:按「同名导出」量两端(miniapp 452 个源文件 / 812 个导出名 × packages/app 224 个文件 / 226 个导出名;覆盖面自证与读数一起打,枚举到 0 个文件当场抛),两端同名而 `packages/shared` 还没有的仅 **4 件**:`BackChevron` / `SectionHeader` / `Selecter` / `UserInfoCard`。其中 BackChevron 的两份同名实现已在守门 102 的 S0 机制清单里,`UserInfoCard` 的第四份已由 O81 票登记为 DOM 死副本并明令不删(§7 删除安全)⇒ 这一条的真实工作是**逐件判定哪份在屏幕上渲染**,不是批量上提。顺带量到:`apps/miniapp-taro/src/components/SectionHeader.tsx` 是 default export、`components/index.ts` 没递它、全端零「从 `@/components/SectionHeader` 取用」的 import ⇒ P2-F 把三个页面切到 `@/components/adapters` 之后它是孤儿副本;删与留属该端持有人裁决,本条只留证据不下结论。**判据边界(不得读歪)**:这把尺子只认同名,不同名而同意象的重复(RN 的 camelCase 样式键 vs 小程序的 kebab 类名)它结构上看不见,所以「4 件」不等于「两端 UI 只剩 4 处重复」—— 后一维的尺子是守门 128 的 RE 维,它现读对 7 族零判据(两侧未同名,已报名)。 〔重复登记副本·派单指针(2026-10-09 量,本席):本行与同题的另一条登记前缀逐字相同而**信息更少**(持有那条在同题正文之外多 801 字节(裁决与尺子边界的后续),本条是它的早期形态)⇒ **派单以题面「**P1-① 扩共享层首批 —— 票面前提已被实测否证,剩余只有 4…」中较长的那条(现读 1133 字节)为准**,本行不再单独派单。按 §1 的 F4 口径**不动勾选** —— 两条都是没做完的事,把没做的记成做过的比原病更响;也不摘声明位编号(守门 71 按"编号 + 题面原文前缀"判丢行,摘号会让自愈层把本行整条回捞,批⑤→⑦ 四轮循环即此),复核入口:`git show HEAD:PROJECT_PLAN.md | grep -F ' ] **P1-① 扩共享层首批 —— 票面前提已被实' | awk '{print length()}'` 应现读到两条长度不等的同题行。〕 〔拍板@2026-10-09 机主授权代行:4 件逐件判定——BackChevron/SectionHeader 上提 shared,Selecter 核消费面,UserInfoCard 按 O81 登记不删;小票派单。〕 〔拍板@2026-10-12 机主授权代行:RN/跨端族用户指示本批暂缓,维持登记待 RN 窗口;本行交代成立。〕
```

- 原 L15382(L1 外部持有行 L11427):

```
- [ ] **RN「记住密码」把账号+密码明文写进 AsyncStorage,而它正是票#20 那条自动登录判据的凭据源(需产品口径)** —— 实测 `apps/mobile-rn/src/lib/credential-storage.ts:72-87` 将 `{account,password}` 原样存入 `ihui-remember-credentials`(Android 上 AsyncStorage 是应用私有目录下的明文文件,root 或备份可读),而 `shouldAttemptAutoLogin` 读的 `hasRememberedCredentials()` 就是这一位。SecureStore 那层已在 `src/lib/auth/secure-store.ts` 用于凭据,记住密码这条链没跟上。两条出口:① 改存 SecureStore —— 但**登出标记必须留在不同层**:票#20 的 `ihui-session-logged-out` 刻意与凭据不同寿命(同层会被 `clearAll` 一起删,等于自己否决自己,理由写在该文件注释里);② 取消「记住密码」只留「自动登录」。禁止的省事做法:直接删 key —— 已勾选用户的勾选会静默失效且无任何提示。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔拍板@2026-10-12 机主授权代行:RN/跨端族用户指示本批暂缓,维持登记待 RN 窗口;本行交代成立。〕
```

- 原 L15385(L1 外部持有行 L11547):

```
- [ ] **P1-① 扩共享层首批 —— 票面前提已被实测否证,剩余只有 4 件(在等:逐件判定谁在渲染,不是 10–20 人日的一批)**:按「同名导出」量两端(miniapp 452 个源文件 / 812 个导出名 × packages/app 224 个文件 / 226 个导出名;覆盖面自证与读数一起打,枚举到 0 个文件当场抛),两端同名而 `packages/shared` 还没有的仅 **4 件**:`BackChevron` / `SectionHeader` / `Selecter` / `UserInfoCard`。其中 BackChevron 的两份同名实现已在守门 102 的 S0 机制清单里,`UserInfoCard` 的第四份已由 O81 票登记为 DOM 死副本并明令不删(§7 删除安全)⇒ 这一条的真实工作是**逐件判定哪份在屏幕上渲染**,不是批量上提。顺带量到:端内那份零消费者、零深导入的 SectionHeader 副本(小程序腿,与 adapters 那条同名) 是 default export、`components/index.ts` 没递它、全端零「从 `@/components/SectionHeader` 取用」的 import ⇒ P2-F 把三个页面切到 `@/components/adapters` 之后它是孤儿副本;删与留属该端持有人裁决,本条只留证据不下结论。**判据边界(不得读歪)**:这把尺子只认同名,不同名而同意象的重复(RN 的 camelCase 样式键 vs 小程序的 kebab 类名)它结构上看不见,所以「4 件」不等于「两端 UI 只剩 4 处重复」—— 后一维的尺子是守门 128 的 RE 维,它现读对 7 族零判据(两侧未同名,已报名)。 〔重复登记副本·派单指针(2026-10-09 量,本席):本行与同题的另一条登记前缀逐字相同而**信息更少**(持有那条在同题正文之外多 801 字节(裁决与尺子边界的后续),本条是它的早期形态)⇒ **派单以题面「**P1-① 扩共享层首批 —— 票面前提已被实测否证,剩余只有 4…」中较长的那条(现读 1133 字节)为准**,本行不再单独派单。按 §1 的 F4 口径**不动勾选** —— 两条都是没做完的事,把没做的记成做过的比原病更响;也不摘声明位编号(守门 71 按"编号 + 题面原文前缀"判丢行,摘号会让自愈层把本行整条回捞,批⑤→⑦ 四轮循环即此),复核入口:`git show HEAD:PROJECT_PLAN.md | grep -F ' ] **P1-① 扩共享层首批 —— 票面前提已被实' | awk '{print length()}'` 应现读到两条长度不等的同题行。〕 〔拍板@2026-10-09 机主授权代行:4 件逐件判定——BackChevron/SectionHeader 上提 shared,Selecter 核消费面,UserInfoCard 按 O81 登记不删;小票派单。〕 〔副本行@2026-10-09 只去路径点名,不动勾选(§1 F4:副本行加指针不动状态);同题持有行见结清@2026-10-09那一条。〕 〔拍板@2026-10-12 机主授权代行:RN/跨端族用户指示本批暂缓,维持登记待 RN 窗口;本行交代成立。〕
```

- 原 L15387(L1 外部持有行 L11547):

```
- [ ] **P1-① 扩共享层首批 —— 票面前提已被实测否证,剩余只有 4 件(在等:逐件判定谁在渲染,不是 10–20 人日的一批)**:按「同名导出」量两端(miniapp 452 个源文件 / 812 个导出名 × packages/app 224 个文件 / 226 个导出名;覆盖面自证与读数一起打,枚举到 0 个文件当场抛),两端同名而 `packages/shared` 还没有的仅 **4 件**:`BackChevron` / `SectionHeader` / `Selecter` / `UserInfoCard`。其中 BackChevron 的两份同名实现已在守门 102 的 S0 机制清单里,`UserInfoCard` 的第四份已由 O81 票登记为 DOM 死副本并明令不删(§7 删除安全)⇒ 这一条的真实工作是**逐件判定哪份在屏幕上渲染**,不是批量上提。顺带量到:`小程序端 components 目录那份同名未接线旧副本(非 adapters 腿)` 是 default export、`components/index.ts` 没递它、全端零「从 `@/components/SectionHeader` 取用」的 import ⇒ P2-F 把三个页面切到 `@/components/adapters` 之后它是孤儿副本;删与留属该端持有人裁决,本条只留证据不下结论。**判据边界(不得读歪)**:这把尺子只认同名,不同名而同意象的重复(RN 的 camelCase 样式键 vs 小程序的 kebab 类名)它结构上看不见,所以「4 件」不等于「两端 UI 只剩 4 处重复」—— 后一维的尺子是守门 128 的 RE 维,它现读对 7 族零判据(两侧未同名,已报名)。 〔重复登记副本·派单指针(2026-10-09 量,本席):本行与同题的另一条登记前缀逐字相同而**信息更少**(持有那条在同题正文之外多 801 字节(裁决与尺子边界的后续),本条是它的早期形态)⇒ **派单以题面「**P1-① 扩共享层首批 —— 票面前提已被实测否证,剩余只有 4…」中较长的那条(现读 1133 字节)为准**,本行不再单独派单。按 §1 的 F4 口径**不动勾选** —— 两条都是没做完的事,把没做的记成做过的比原病更响;也不摘声明位编号(守门 71 按"编号 + 题面原文前缀"判丢行,摘号会让自愈层把本行整条回捞,批⑤→⑦ 四轮循环即此),复核入口:`git show HEAD:PROJECT_PLAN.md | grep -F ' ] **P1-① 扩共享层首批 —— 票面前提已被实' | awk '{print length()}'` 应现读到两条长度不等的同题行。〕 〔拍板@2026-10-09 机主授权代行:4 件逐件判定——BackChevron/SectionHeader 上提 shared,Selecter 核消费面,UserInfoCard 按 O81 登记不删;小票派单。〕 〔拍板@2026-10-12 机主授权代行:RN/跨端族用户指示本批暂缓,维持登记待 RN 窗口;本行交代成立。〕
```

- 原 L15443(L1 外部持有行 L15454):

```
- [ ]（进行中）**真机走查(2026-09-24,v0.0.5/code7)三项新发现的收口状态**:① **广场页「深色顶栏/底栏 + 浅色正文」主题割裂 —— 已修(commit 84583fdf6)**:根因不在端级组件,而是 PlazaScreen.tsx:464 与 RankingDetailScreen.tsx:171 把 colorScheme 写成字面量 light,而 packages/app/src/features/{plaza,ranking-detail} 内部是 getTokens(colorScheme) 且形参默认 'light' —— 调用方一钉死,整棵正文子树脱离主题。实测证据:同一屏 NavBar/TabBar 取到 #1a1a1a 而正文 #f5f5f5 / #ebebeb。范围按全端收口而非只修被报那一处:全仓 colorScheme 字面量除这两处为零;再按「212 个 theme-driven 共享组件 × 端内全部 JSX 渲染点」统计漏传 colorScheme 的调用点 = **0 处**,故不把 213 处默认值改必填(无实际受益且会与并发会话互踩 213 文件)。**遗留陷阱另计**:共享组件形参默认 'light' 本身是「忘传即静默脱主题」的地雷,待改为必填并全端接线。② **红色 ✕ 浮层压在分类条上 —— 判为本轮误报**:复测时该元素已消失,且 uiautomator 在其位置 (360,197) 取不到任何属于它的节点(该处唯一命中节点是 chip「已完成」[328,158][458,222]),即它无命中区、非布局层元素,判为错误弹层关闭按钮进出场动画的瞬时残影;留作「若复现再查」。③ **错误态「好的」确认钮黑底近黑字 —— 已修(commit 26cf923961,v0.0.5/code8 真机复测)**:原假设「底色与前景跨档案错配」**被实测否证** —— 两个值来自同一档案:浅档 brand.DEFAULT=#000000 作底 × text.primary=#0A0A0A 作字 = **1.06:1**(深档 #FFFFFF × #FAFAFA = 1.04:1,同样不可读)。真因是**跨键错配**:bg 取 brand.DEFAULT、fg 取 text.primary,而 brand.DEFAULT 在两套档案里都是「容器底」不是「CTA 底」,只有 ctaFill 才与 ctaText 成对。同屏用 ctaFill x ctaText 的控件(待接单 chip、加号 FAB)实测 #ffffff 墨压 #000000 底,证明正确配对本机就在生效。修 4 处(含每张等待卡上「聊一聊」的 chatBtn/chatBtnText 同型黑底黑字),改后该文件已无 brand.DEFAULT 作 backgroundColor 的残留;复测 ctaFill #a3c4d6 覆盖 10816px + ctaText #16262e 墨 360px,#000000 归零,浅档 21.00:1 / 深档 8.46:1。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记 (与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15444(L1 外部持有行 L15446):

```
- [ ]（进行中）RN 分类栏统一收口(承 2026-09-23 04:19 会话被取消的迁移,用户原话"所有的菜单栏分类栏没有设计好 统一 好看的符合项目统一的样式 点击后下拉窗的形式呈现 左右滑动"):地基 `packages/app/src/components/category/{CategoryInlineBar,CategoryDropdown}` 补包根导出(`@ihui/rn-app` 可直接 import,此前只到 `components/index.ts` 端内取不到)+ Dropdown 面板改 `ScrollView`(修"选项多于 8 条被 maxHeight+overflow:hidden 静默裁切")+ 圆角一律 `rnRadius` 档(对齐同日新立 §4 圆角单一源头)。**迁移面 16 处**:共享层 9 屏(square/plaza/order/team/ranking/recruitment/token-value/study-index/study-publish,其中 study-publish 的 API 动态赛道 = CategoryDropdown 装车点)+ 端内 7 屏(ProfileScreen / TokenValueScreen / TopicListScreen / StudyIndexScreen / MaterialList / AgentScreen 赛道弹层双行并删违规 `trackDivider` hairline 分割线 / FenLeiOverlay 赛道行+分类网格双条)。孤儿裁定:`StudyBar`、`SingleTypeBar` 已零调用点(删除需同步下调 `scripts/radius-single-source-baseline.json` 的 2 条基线,本轮未做)。**真机取证(v0.0.4 / code 5 release 包,Hermes 字节码 bundle grep 命中 `CategoryInlineBar` / `agent-track-bar` / `ctaFill`)**:① 点顶栏「分类」弹出的那块当时仍是迁移清单外的 `FenLeiOverlay`(已补迁);② 像素直方图实测选中 chip 前景 = 深色 `ctaText` #16262E 而底色仍是容器同色 #1A1A1A —— `ctaFill` 根本没落上,即"选中态看不见";③ idle chip 以 `surface.card` 作底,落在同为 `surface.card` 的弹层面板上完全隐形。已修:idle 底改 `surface.muted` + 描边 `border.medium`(两套主题下与页面 bg / 面板 card 均不同档)。**根因未定**:曾按"Pressable 函数式 style 整条路径未生效"归因并把容器视觉移到普通 View 数组路径(该改动本身无害,少一个变量),但随即被反证 —— 全仓 58 个文件用同款 `style={({pressed}) => [base, active ? activeStyle : null]}`,其中 `SingleTypeBar.tsx:142-143` 与迁移前的 SquareScreen 内联条都是这条路径且真机显示正常;`ctaText`(#16262E)在同一 chip 上生效而 `ctaFill`(#a3c4d6)不生效,也排除了"整套 token 缺失"(dist 陈旧版两者皆无,若走 dist 文字应回落到 #A3A3A3)。待手机回线后先加高对比标记色(如临时 `#FF00FF`)做二分,再定是样式合并路径还是取色问题。待复验(设备 19:5x 起 `adb devices` 为空,kill-server 重连无效,USB 侧仍见 3 个 Composite Device)。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记 (与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15447(L1 外部持有行 L15454):

```
- [ ]（进行中）**真机走查(2026-09-24,v0.0.5/code7)三项新发现的收口状态**:① **广场页「深色顶栏/底栏 + 浅色正文」主题割裂 —— 已修(commit 84583fdf6)**:根因不在端级组件,而是 PlazaScreen.tsx:464 与 RankingDetailScreen.tsx:171 把 colorScheme 写成字面量 light,而 packages/app/src/features/{plaza,ranking-detail} 内部是 getTokens(colorScheme) 且形参默认 'light' —— 调用方一钉死,整棵正文子树脱离主题。实测证据:同一屏 NavBar/TabBar 取到 #1a1a1a 而正文 #f5f5f5 / #ebebeb。范围按全端收口而非只修被报那一处:全仓 colorScheme 字面量除这两处为零;再按「212 个 theme-driven 共享组件 × 端内全部 JSX 渲染点」统计漏传 colorScheme 的调用点 = **0 处**,故不把 213 处默认值改必填(无实际受益且会与并发会话互踩 213 文件)。**遗留陷阱另计**:共享组件形参默认 'light' 本身是「忘传即静默脱主题」的地雷,待改为必填并全端接线。② **红色 ✕ 浮层压在分类条上 —— 判为本轮误报**:复测时该元素已消失,且 uiautomator 在其位置 (360,197) 取不到任何属于它的节点(该处唯一命中节点是 chip「已完成」[328,158][458,222]),即它无命中区、非布局层元素,判为错误弹层关闭按钮进出场动画的瞬时残影;留作「若复现再查」。③ **错误态「好的」确认钮黑底近黑字 —— 已修(commit 26cf923961,v0.0.5/code8 真机复测)**:原假设「底色与前景跨档案错配」**被实测否证** —— 两个值来自同一档案:浅档 brand.DEFAULT=#000000 作底 × text.primary=#0A0A0A 作字 = **1.06:1**(深档 #FFFFFF × #FAFAFA = 1.04:1,同样不可读)。真因是**跨键错配**:bg 取 brand.DEFAULT、fg 取 text.primary,而 brand.DEFAULT 在两套档案里都是「容器底」不是「CTA 底」,只有 ctaFill 才与 ctaText 成对。同屏用 ctaFill x ctaText 的控件(待接单 chip、加号 FAB)实测 #ffffff 墨压 #000000 底,证明正确配对本机就在生效。修 4 处(含每张等待卡上「聊一聊」的 chatBtn/chatBtnText 同型黑底黑字),改后该文件已无 brand.DEFAULT 作 backgroundColor 的残留;复测 ctaFill #a3c4d6 覆盖 10816px + ctaText #16262e 墨 360px,#000000 归零,浅档 21.00:1 / 深档 8.46:1。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15448(L1 外部持有行 L15454):

```
- [ ]（进行中）**真机走查(2026-09-24,v0.0.5/code7)三项新发现的收口状态**:① **广场页「深色顶栏/底栏 + 浅色正文」主题割裂 —— 已修(commit 84583fdf6)**:根因不在端级组件,而是 PlazaScreen.tsx:464 与 RankingDetailScreen.tsx:171 把 colorScheme 写成字面量 light,而 packages/app/src/features/{plaza,ranking-detail} 内部是 getTokens(colorScheme) 且形参默认 'light' —— 调用方一钉死,整棵正文子树脱离主题。实测证据:同一屏 NavBar/TabBar 取到 #1a1a1a 而正文 #f5f5f5 / #ebebeb。范围按全端收口而非只修被报那一处:全仓 colorScheme 字面量除这两处为零;再按「212 个 theme-driven 共享组件 × 端内全部 JSX 渲染点」统计漏传 colorScheme 的调用点 = **0 处**,故不把 213 处默认值改必填(无实际受益且会与并发会话互踩 213 文件)。**遗留陷阱另计**:共享组件形参默认 'light' 本身是「忘传即静默脱主题」的地雷,待改为必填并全端接线。② **红色 ✕ 浮层压在分类条上 —— 判为本轮误报**:复测时该元素已消失,且 uiautomator 在其位置 (360,197) 取不到任何属于它的节点(该处唯一命中节点是 chip「已完成」[328,158][458,222]),即它无命中区、非布局层元素,判为错误弹层关闭按钮进出场动画的瞬时残影;留作「若复现再查」。③ **错误态「好的」确认钮黑底近黑字 —— 已修(commit 26cf923961,v0.0.5/code8 真机复测)**:原假设「底色与前景跨档案错配」**被实测否证** —— 两个值来自同一档案:浅档 brand.DEFAULT=#000000 作底 × text.primary=#0A0A0A 作字 = **1.06:1**(深档 #FFFFFF × #FAFAFA = 1.04:1,同样不可读)。真因是**跨键错配**:bg 取 brand.DEFAULT、fg 取 text.primary,而 brand.DEFAULT 在两套档案里都是「容器底」不是「CTA 底」,只有 ctaFill 才与 ctaText 成对。同屏用 ctaFill x ctaText 的控件(待接单 chip、加号 FAB)实测 #ffffff 墨压 #000000 底,证明正确配对本机就在生效。修 4 处(含每张等待卡上「聊一聊」的 chatBtn/chatBtnText 同型黑底黑字),改后该文件已无 brand.DEFAULT 作 backgroundColor 的残留;复测 ctaFill #a3c4d6 覆盖 10816px + ctaText #16262e 墨 360px,#000000 归零,浅档 21.00:1 / 深档 8.46:1。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记在 L5599(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L15449(L1 外部持有行 L15454):

```
- [ ]（进行中）**真机走查(2026-09-24,v0.0.5/code7)三项新发现的收口状态**:① **广场页「深色顶栏/底栏 + 浅色正文」主题割裂 —— 已修(commit 84583fdf6)**:根因不在端级组件,而是 PlazaScreen.tsx:464 与 RankingDetailScreen.tsx:171 把 colorScheme 写成字面量 light,而 packages/app/src/features/{plaza,ranking-detail} 内部是 getTokens(colorScheme) 且形参默认 'light' —— 调用方一钉死,整棵正文子树脱离主题。实测证据:同一屏 NavBar/TabBar 取到 #1a1a1a 而正文 #f5f5f5 / #ebebeb。范围按全端收口而非只修被报那一处:全仓 colorScheme 字面量除这两处为零;再按「212 个 theme-driven 共享组件 × 端内全部 JSX 渲染点」统计漏传 colorScheme 的调用点 = **0 处**,故不把 213 处默认值改必填(无实际受益且会与并发会话互踩 213 文件)。**遗留陷阱另计**:共享组件形参默认 'light' 本身是「忘传即静默脱主题」的地雷,待改为必填并全端接线。② **红色 ✕ 浮层压在分类条上 —— 判为本轮误报**:复测时该元素已消失,且 uiautomator 在其位置 (360,197) 取不到任何属于它的节点(该处唯一命中节点是 chip「已完成」[328,158][458,222]),即它无命中区、非布局层元素,判为错误弹层关闭按钮进出场动画的瞬时残影;留作「若复现再查」。③ **错误态「好的」确认钮黑底近黑字 —— 已修(commit 26cf923961,v0.0.5/code8 真机复测)**:原假设「底色与前景跨档案错配」**被实测否证** —— 两个值来自同一档案:浅档 brand.DEFAULT=#000000 作底 × text.primary=#0A0A0A 作字 = **1.06:1**(深档 #FFFFFF × #FAFAFA = 1.04:1,同样不可读)。真因是**跨键错配**:bg 取 brand.DEFAULT、fg 取 text.primary,而 brand.DEFAULT 在两套档案里都是「容器底」不是「CTA 底」,只有 ctaFill 才与 ctaText 成对。同屏用 ctaFill x ctaText 的控件(待接单 chip、加号 FAB)实测 #ffffff 墨压 #000000 底,证明正确配对本机就在生效。修 4 处(含每张等待卡上「聊一聊」的 chatBtn/chatBtnText 同型黑底黑字),改后该文件已无 brand.DEFAULT 作 backgroundColor 的残留;复测 ctaFill #a3c4d6 覆盖 10816px + ctaText #16262e 墨 360px,#000000 归零,浅档 21.00:1 / 深档 8.46:1。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记在 L13317(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L15450(L1 外部持有行 L15454):

```
- [ ]（进行中）**真机走查(2026-09-24,v0.0.5/code7)三项新发现的收口状态**:① **广场页「深色顶栏/底栏 + 浅色正文」主题割裂 —— 已修(commit 84583fdf6)**:根因不在端级组件,而是 PlazaScreen.tsx:464 与 RankingDetailScreen.tsx:171 把 colorScheme 写成字面量 light,而 packages/app/src/features/{plaza,ranking-detail} 内部是 getTokens(colorScheme) 且形参默认 'light' —— 调用方一钉死,整棵正文子树脱离主题。实测证据:同一屏 NavBar/TabBar 取到 #1a1a1a 而正文 #f5f5f5 / #ebebeb。范围按全端收口而非只修被报那一处:全仓 colorScheme 字面量除这两处为零;再按「212 个 theme-driven 共享组件 × 端内全部 JSX 渲染点」统计漏传 colorScheme 的调用点 = **0 处**,故不把 213 处默认值改必填(无实际受益且会与并发会话互踩 213 文件)。**遗留陷阱另计**:共享组件形参默认 'light' 本身是「忘传即静默脱主题」的地雷,待改为必填并全端接线。② **红色 ✕ 浮层压在分类条上 —— 判为本轮误报**:复测时该元素已消失,且 uiautomator 在其位置 (360,197) 取不到任何属于它的节点(该处唯一命中节点是 chip「已完成」[328,158][458,222]),即它无命中区、非布局层元素,判为错误弹层关闭按钮进出场动画的瞬时残影;留作「若复现再查」。③ **错误态「好的」确认钮黑底近黑字 —— 已修(commit 26cf923961,v0.0.5/code8 真机复测)**:原假设「底色与前景跨档案错配」**被实测否证** —— 两个值来自同一档案:浅档 brand.DEFAULT=#000000 作底 × text.primary=#0A0A0A 作字 = **1.06:1**(深档 #FFFFFF × #FAFAFA = 1.04:1,同样不可读)。真因是**跨键错配**:bg 取 brand.DEFAULT、fg 取 text.primary,而 brand.DEFAULT 在两套档案里都是「容器底」不是「CTA 底」,只有 ctaFill 才与 ctaText 成对。同屏用 ctaFill x ctaText 的控件(待接单 chip、加号 FAB)实测 #ffffff 墨压 #000000 底,证明正确配对本机就在生效。修 4 处(含每张等待卡上「聊一聊」的 chatBtn/chatBtnText 同型黑底黑字),改后该文件已无 brand.DEFAULT 作 backgroundColor 的残留;复测 ctaFill #a3c4d6 覆盖 10816px + ctaText #16262e 墨 360px,#000000 归零,浅档 21.00:1 / 深档 8.46:1。 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记在 L5459(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L15451(L1 外部持有行 L15454):

```
- [ ]（进行中）**真机走查(2026-09-24,v0.0.5/code7)三项新发现的收口状态**:① **广场页「深色顶栏/底栏 + 浅色正文」主题割裂 —— 已修(commit 84583fdf6)**:根因不在端级组件,而是 PlazaScreen.tsx:464 与 RankingDetailScreen.tsx:171 把 colorScheme 写成字面量 light,而 packages/app/src/features/{plaza,ranking-detail} 内部是 getTokens(colorScheme) 且形参默认 'light' —— 调用方一钉死,整棵正文子树脱离主题。实测证据:同一屏 NavBar/TabBar 取到 #1a1a1a 而正文 #f5f5f5 / #ebebeb。范围按全端收口而非只修被报那一处:全仓 colorScheme 字面量除这两处为零;再按「212 个 theme-driven 共享组件 × 端内全部 JSX 渲染点」统计漏传 colorScheme 的调用点 = **0 处**,故不把 213 处默认值改必填(无实际受益且会与并发会话互踩 213 文件)。**遗留陷阱另计**:共享组件形参默认 'light' 本身是「忘传即静默脱主题」的地雷,待改为必填并全端接线。② **红色 ✕ 浮层压在分类条上 —— 判为本轮误报**:复测时该元素已消失,且 uiautomator 在其位置 (360,197) 取不到任何属于它的节点(该处唯一命中节点是 chip「已完成」[328,158][458,222]),即它无命中区、非布局层元素,判为错误弹层关闭按钮进出场动画的瞬时残影;留作「若复现再查」。③ **错误态「好的」确认钮黑底近黑字 —— 已修(commit 26cf923961,v0.0.5/code8 真机复测)**:原假设「底色与前景跨档案错配」**被实测否证** —— 两个值来自同一档案:浅档 brand.DEFAULT=#000000 作底 × text.primary=#0A0A0A 作字 = **1.06:1**(深档 #FFFFFF × #FAFAFA = 1.04:1,同样不可读)。真因是**跨键错配**:bg 取 brand.DEFAULT、fg 取 text.primary,而 brand.DEFAULT 在两套档案里都是「容器底」不是「CTA 底」,只有 ctaFill 才与 ctaText 成对。同屏用 ctaFill x ctaText 的控件(待接单 chip、加号 FAB)实测 #ffffff 墨压 #000000 底,证明正确配对本机就在生效。修 4 处(含每张等待卡上「聊一聊」的 chatBtn/chatBtnText 同型黑底黑字),改后该文件已无 brand.DEFAULT 作 backgroundColor 的残留;复测 ctaFill #a3c4d6 覆盖 10816px + ctaText #16262e 墨 360px,#000000 归零,浅档 21.00:1 / 深档 8.46:1。 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记在 L5637(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L15453(L1 外部持有行 L15454):

```
- [ ]（进行中）**真机走查(2026-09-24,v0.0.5/code7)三项新发现的收口状态**:① **广场页「深色顶栏/底栏 + 浅色正文」主题割裂 —— 已修(commit 84583fdf6)**:根因不在端级组件,而是 PlazaScreen.tsx:464 与 RankingDetailScreen.tsx:171 把 colorScheme 写成字面量 light,而 packages/app/src/features/{plaza,ranking-detail} 内部是 getTokens(colorScheme) 且形参默认 'light' —— 调用方一钉死,整棵正文子树脱离主题。实测证据:同一屏 NavBar/TabBar 取到 #1a1a1a 而正文 #f5f5f5 / #ebebeb。范围按全端收口而非只修被报那一处:全仓 colorScheme 字面量除这两处为零;再按「212 个 theme-driven 共享组件 × 端内全部 JSX 渲染点」统计漏传 colorScheme 的调用点 = **0 处**,故不把 213 处默认值改必填(无实际受益且会与并发会话互踩 213 文件)。**遗留陷阱另计**:共享组件形参默认 'light' 本身是「忘传即静默脱主题」的地雷,待改为必填并全端接线。② **红色 ✕ 浮层压在分类条上 —— 判为本轮误报**:复测时该元素已消失,且 uiautomator 在其位置 (360,197) 取不到任何属于它的节点(该处唯一命中节点是 chip「已完成」[328,158][458,222]),即它无命中区、非布局层元素,判为错误弹层关闭按钮进出场动画的瞬时残影;留作「若复现再查」。③ **错误态「好的」确认钮黑底近黑字 —— 已修(commit 26cf923961,v0.0.5/code8 真机复测)**:原假设「底色与前景跨档案错配」**被实测否证** —— 两个值来自同一档案:浅档 brand.DEFAULT=#000000 作底 × text.primary=#0A0A0A 作字 = **1.06:1**(深档 #FFFFFF × #FAFAFA = 1.04:1,同样不可读)。真因是**跨键错配**:bg 取 brand.DEFAULT、fg 取 text.primary,而 brand.DEFAULT 在两套档案里都是「容器底」不是「CTA 底」,只有 ctaFill 才与 ctaText 成对。同屏用 ctaFill x ctaText 的控件(待接单 chip、加号 FAB)实测 #ffffff 墨压 #000000 底,证明正确配对本机就在生效。修 4 处(含每张等待卡上「聊一聊」的 chatBtn/chatBtnText 同型黑底黑字),改后该文件已无 brand.DEFAULT 作 backgroundColor 的残留;复测 ctaFill #a3c4d6 覆盖 10816px + ctaText #16262e 墨 360px,#000000 归零,浅档 21.00:1 / 深档 8.46:1。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15456(L1 外部持有行 L15454):

```
- [ ]（进行中）**真机走查(2026-09-24,v0.0.5/code7)三项新发现的收口状态**:① **广场页「深色顶栏/底栏 + 浅色正文」主题割裂 —— 已修(commit 84583fdf6)**:根因不在端级组件,而是 PlazaScreen.tsx:464 与 RankingDetailScreen.tsx:171 把 colorScheme 写成字面量 light,而 packages/app/src/features/{plaza,ranking-detail} 内部是 getTokens(colorScheme) 且形参默认 'light' —— 调用方一钉死,整棵正文子树脱离主题。实测证据:同一屏 NavBar/TabBar 取到 #1a1a1a 而正文 #f5f5f5 / #ebebeb。范围按全端收口而非只修被报那一处:全仓 colorScheme 字面量除这两处为零;再按「212 个 theme-driven 共享组件 × 端内全部 JSX 渲染点」统计漏传 colorScheme 的调用点 = **0 处**,故不把 213 处默认值改必填(无实际受益且会与并发会话互踩 213 文件)。**遗留陷阱另计**:共享组件形参默认 'light' 本身是「忘传即静默脱主题」的地雷,待改为必填并全端接线。② **红色 ✕ 浮层压在分类条上 —— 判为本轮误报**:复测时该元素已消失,且 uiautomator 在其位置 (360,197) 取不到任何属于它的节点(该处唯一命中节点是 chip「已完成」[328,158][458,222]),即它无命中区、非布局层元素,判为错误弹层关闭按钮进出场动画的瞬时残影;留作「若复现再查」。③ **错误态「好的」确认钮黑底近黑字 —— 已修(commit 26cf923961,v0.0.5/code8 真机复测)**:原假设「底色与前景跨档案错配」**被实测否证** —— 两个值来自同一档案:浅档 brand.DEFAULT=#000000 作底 × text.primary=#0A0A0A 作字 = **1.06:1**(深档 #FFFFFF × #FAFAFA = 1.04:1,同样不可读)。真因是**跨键错配**:bg 取 brand.DEFAULT、fg 取 text.primary,而 brand.DEFAULT 在两套档案里都是「容器底」不是「CTA 底」,只有 ctaFill 才与 ctaText 成对。同屏用 ctaFill x ctaText 的控件(待接单 chip、加号 FAB)实测 #ffffff 墨压 #000000 底,证明正确配对本机就在生效。修 4 处(含每张等待卡上「聊一聊」的 chatBtn/chatBtnText 同型黑底黑字),改后该文件已无 brand.DEFAULT 作 backgroundColor 的残留;复测 ctaFill #a3c4d6 覆盖 10816px + ctaText #16262e 墨 360px,#000000 归零,浅档 21.00:1 / 深档 8.46:1。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15457(L1 外部持有行 L15454):

```
- [ ]（进行中）**真机走查(2026-09-24,v0.0.5/code7)三项新发现的收口状态**:① **广场页「深色顶栏/底栏 + 浅色正文」主题割裂 —— 已修(commit 84583fdf6)**:根因不在端级组件,而是 PlazaScreen.tsx:464 与 RankingDetailScreen.tsx:171 把 colorScheme 写成字面量 light,而 packages/app/src/features/{plaza,ranking-detail} 内部是 getTokens(colorScheme) 且形参默认 'light' —— 调用方一钉死,整棵正文子树脱离主题。实测证据:同一屏 NavBar/TabBar 取到 #1a1a1a 而正文 #f5f5f5 / #ebebeb。范围按全端收口而非只修被报那一处:全仓 colorScheme 字面量除这两处为零;再按「212 个 theme-driven 共享组件 × 端内全部 JSX 渲染点」统计漏传 colorScheme 的调用点 = **0 处**,故不把 213 处默认值改必填(无实际受益且会与并发会话互踩 213 文件)。**遗留陷阱另计**:共享组件形参默认 'light' 本身是「忘传即静默脱主题」的地雷,待改为必填并全端接线。② **红色 ✕ 浮层压在分类条上 —— 判为本轮误报**:复测时该元素已消失,且 uiautomator 在其位置 (360,197) 取不到任何属于它的节点(该处唯一命中节点是 chip「已完成」[328,158][458,222]),即它无命中区、非布局层元素,判为错误弹层关闭按钮进出场动画的瞬时残影;留作「若复现再查」。③ **错误态「好的」确认钮黑底近黑字 —— 已修(commit 26cf923961,v0.0.5/code8 真机复测)**:原假设「底色与前景跨档案错配」**被实测否证** —— 两个值来自同一档案:浅档 brand.DEFAULT=#000000 作底 × text.primary=#0A0A0A 作字 = **1.06:1**(深档 #FFFFFF × #FAFAFA = 1.04:1,同样不可读)。真因是**跨键错配**:bg 取 brand.DEFAULT、fg 取 text.primary,而 brand.DEFAULT 在两套档案里都是「容器底」不是「CTA 底」,只有 ctaFill 才与 ctaText 成对。同屏用 ctaFill x ctaText 的控件(待接单 chip、加号 FAB)实测 #ffffff 墨压 #000000 底,证明正确配对本机就在生效。修 4 处(含每张等待卡上「聊一聊」的 chatBtn/chatBtnText 同型黑底黑字),改后该文件已无 brand.DEFAULT 作 backgroundColor 的残留;复测 ctaFill #a3c4d6 覆盖 10816px + ctaText #16262e 墨 360px,#000000 归零,浅档 21.00:1 / 深档 8.46:1。 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记逐字相同的另一条登记(与本行正文逐字相同,可按正文检索;现存多处同文副本)(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L15458(L1 外部持有行 L15454):

```
- [ ]（进行中）**真机走查(2026-09-24,v0.0.5/code7)三项新发现的收口状态**:① **广场页「深色顶栏/底栏 + 浅色正文」主题割裂 —— 已修(commit 84583fdf6)**:根因不在端级组件,而是 PlazaScreen.tsx:464 与 RankingDetailScreen.tsx:171 把 colorScheme 写成字面量 light,而 packages/app/src/features/{plaza,ranking-detail} 内部是 getTokens(colorScheme) 且形参默认 'light' —— 调用方一钉死,整棵正文子树脱离主题。实测证据:同一屏 NavBar/TabBar 取到 #1a1a1a 而正文 #f5f5f5 / #ebebeb。范围按全端收口而非只修被报那一处:全仓 colorScheme 字面量除这两处为零;再按「212 个 theme-driven 共享组件 × 端内全部 JSX 渲染点」统计漏传 colorScheme 的调用点 = **0 处**,故不把 213 处默认值改必填(无实际受益且会与并发会话互踩 213 文件)。**遗留陷阱另计**:共享组件形参默认 'light' 本身是「忘传即静默脱主题」的地雷,待改为必填并全端接线。② **红色 ✕ 浮层压在分类条上 —— 判为本轮误报**:复测时该元素已消失,且 uiautomator 在其位置 (360,197) 取不到任何属于它的节点(该处唯一命中节点是 chip「已完成」[328,158][458,222]),即它无命中区、非布局层元素,判为错误弹层关闭按钮进出场动画的瞬时残影;留作「若复现再查」。③ **错误态「好的」确认钮黑底近黑字 —— 已修(commit 26cf923961,v0.0.5/code8 真机复测)**:原假设「底色与前景跨档案错配」**被实测否证** —— 两个值来自同一档案:浅档 brand.DEFAULT=#000000 作底 × text.primary=#0A0A0A 作字 = **1.06:1**(深档 #FFFFFF × #FAFAFA = 1.04:1,同样不可读)。真因是**跨键错配**:bg 取 brand.DEFAULT、fg 取 text.primary,而 brand.DEFAULT 在两套档案里都是「容器底」不是「CTA 底」,只有 ctaFill 才与 ctaText 成对。同屏用 ctaFill x ctaText 的控件(待接单 chip、加号 FAB)实测 #ffffff 墨压 #000000 底,证明正确配对本机就在生效。修 4 处(含每张等待卡上「聊一聊」的 chatBtn/chatBtnText 同型黑底黑字),改后该文件已无 brand.DEFAULT 作 backgroundColor 的残留;复测 ctaFill #a3c4d6 覆盖 10816px + ctaText #16262e 墨 360px,#000000 归零,浅档 21.00:1 / 深档 8.46:1。 〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记逐字相同的另一条登记(与本行正文逐字相同,可按正文检索;现存多处同文副本)(本行无编号主键),派单以那条为准,本行不再单独派单。〕
```

- 原 L15460(L1 外部持有行 L11515):

```
- [ ] 双端功能矩阵维护(2026-08-26 立,跨端:apps/web + apps/mobile-rn)— 基线 `outputs/双端功能矩阵-2026-08-26.md`(源:reports/web-vs-mobile-feature-audit-2026-08-26.html,严格口径复核 M5 验收)。规则:双端新增/改动功能时对照矩阵维护,避免再次出现"一端有另一端无"。遗留待办(按优先级):~~① Chat 附件(expo-document-picker)/语音 TTS/收藏/素材库占位补齐~~✅(附件/TTS/素材库 2026-08-26;会话收藏 2026-09-05 补齐:api-client favoriteConversation/unfavoriteConversation + Drawer 左滑收藏/删除双按钮乐观接线,9 屏映射补 favorited);~~② WebViewScreen 按功能域细分接入~~✅(webview-portal-config 16 域,会话打通运行时验证仍待装机);~~③ knowledge-rag/subagents 原生化~~✅(2026-08-26;workspace 依赖 IDE 本地 FS 属合理差异);~~④ HomeScreen 素材详情、DeveloperScreen 占位清理~~✅(2026-08-26;2026-09-05 补 DeveloperScreen 过时注释修正 + RankingDetailScreen 领取免费资料接复制飞书链接)。剩余:WebView 会话打通装机实测(协议层已 2026-09-07 全链路验证+缺陷根治,仅剩真机 UI 体验确认);~~DeveloperScreen getDevInfo(需后端补接口)~~✅(2026-09-07 核验闭环:后端 GET /api/developer/dev-info 聚合端点(developer.ts:185,含 website)+ api-client getDeveloperDevInfo + DeveloperScreen 接线均已存在,无需补接口)〔【归并】重复登记副本(2026-10-10 量,本席):合流把同题的两条未勾登记并到了一起,本行是**信息更少**的那一条(现读 921 字节,另一条 1311 字节,多出的是 2026-10-09 的机主拍板与本轮交代);派单一律走较长那条(现读入口 `git show HEAD:PROJECT_PLAN.md | grep -n "双端功能矩阵维护"` 两条未勾、长度不等)。按 §1 的 F4 口径**只加指针、不动勾选** —— 这一格仍未闭的那半是「WebView 会话打通的真机 UI 体验确认」,它等的是机主职权(用生产管理员凭据登录到机主手机并产生真实会话记录),不是 agent 能代做的,也不是等新环境。〕〔【归并】重复登记副本(2026-10-13,G-43 口径②收敛):同题的另一条登记 = 未勾四条中**最长那条**(可按 `git show HEAD:PROJECT_PLAN.md | grep -n "双端功能矩阵维护"` 按长度与正文检索),派单以那条为准,本行不再单独派单;上方"两条未勾"读数已过期,现读四条。〕
```

- 原 L15461(L1 外部持有行 L11515):

```
- [ ] 双端功能矩阵维护(2026-08-26 立,跨端:apps/web + apps/mobile-rn)— 基线 `outputs/双端功能矩阵-2026-08-26.md`(源:reports/web-vs-mobile-feature-audit-2026-08-26.html,严格口径复核 M5 验收)。规则:双端新增/改动功能时对照矩阵维护,避免再次出现"一端有另一端无"。遗留待办(按优先级):~~① Chat 附件(expo-document-picker)/语音 TTS/收藏/素材库占位补齐~~✅(附件/TTS/素材库 2026-08-26;会话收藏 2026-09-05 补齐:api-client favoriteConversation/unfavoriteConversation + Drawer 左滑收藏/删除双按钮乐观接线,9 屏映射补 favorited);~~② WebViewScreen 按功能域细分接入~~✅(webview-portal-config 16 域,会话打通运行时验证仍待装机);~~③ knowledge-rag/subagents 原生化~~✅(2026-08-26;workspace 依赖 IDE 本地 FS 属合理差异);~~④ HomeScreen 素材详情、DeveloperScreen 占位清理~~✅(2026-08-26;2026-09-05 补 DeveloperScreen 过时注释修正 + RankingDetailScreen 领取免费资料接复制飞书链接)。剩余:WebView 会话打通装机实测(协议层已 2026-09-07 全链路验证+缺陷根治,仅剩真机 UI 体验确认);~~DeveloperScreen getDevInfo(需后端补接口)~~✅(2026-09-07 核验闭环:后端 GET /api/developer/dev-info 聚合端点(developer.ts:185,含 website)+ api-client getDeveloperDevInfo + DeveloperScreen 接线均已存在,无需补接口) 〔拍板@2026-10-09 机主授权代行:矩阵随批次维护,不单独立票;下次大功能落地时顺带刷。〕〔【归并】重复登记副本(2026-10-13,G-43 口径②收敛):同题的另一条登记 = 未勾四条中**最长那条**(可按 `git show HEAD:PROJECT_PLAN.md | grep -n "双端功能矩阵维护"` 按长度与正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15462(L1 外部持有行 L11515):

```
- [ ] 双端功能矩阵维护(2026-08-26 立,跨端:apps/web + apps/mobile-rn)— 基线 `outputs/双端功能矩阵-2026-08-26.md`(源:reports/web-vs-mobile-feature-audit-2026-08-26.html,严格口径复核 M5 验收)。规则:双端新增/改动功能时对照矩阵维护,避免再次出现"一端有另一端无"。遗留待办(按优先级):~~① Chat 附件(expo-document-picker)/语音 TTS/收藏/素材库占位补齐~~✅(附件/TTS/素材库 2026-08-26;会话收藏 2026-09-05 补齐:api-client favoriteConversation/unfavoriteConversation + Drawer 左滑收藏/删除双按钮乐观接线,9 屏映射补 favorited);~~② WebViewScreen 按功能域细分接入~~✅(webview-portal-config 16 域,会话打通运行时验证仍待装机);~~③ knowledge-rag/subagents 原生化~~✅(2026-08-26;workspace 依赖 IDE 本地 FS 属合理差异);~~④ HomeScreen 素材详情、DeveloperScreen 占位清理~~✅(2026-08-26;2026-09-05 补 DeveloperScreen 过时注释修正 + RankingDetailScreen 领取免费资料接复制飞书链接)。剩余:WebView 会话打通装机实测(协议层已 2026-09-07 全链路验证+缺陷根治,仅剩真机 UI 体验确认);~~DeveloperScreen getDevInfo(需后端补接口)~~✅(2026-09-07 核验闭环:后端 GET /api/developer/dev-info 聚合端点(developer.ts:185,含 website)+ api-client getDeveloperDevInfo + DeveloperScreen 接线均已存在,无需补接口)〔【归并】重复登记副本(2026-10-13,G-43 口径②收敛):同题的另一条登记 = 未勾四条中**最长那条**(可按 `git show HEAD:PROJECT_PLAN.md | grep -n "双端功能矩阵维护"` 按长度与正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15465(L1 外部持有行 L9713):

```
- [ ] P1 **区段头「更多」与箭头折成两行**(学习页 3 个区段 + 首页区段,明暗两态均复现)。1:1 裁图确认**不是降采样伪影**(`crop-study1.png`)。**根因未定**:`MoreLink` 自身是 `flexDirection:'row'` 且 Yoga 默认 `nowrap`,按推理不可能换行;调用面(`LearnScreen.renderSectionHeader` / `MoreTitles` / `CardWithList` / 两端 HomeScreen)**全部委托唯一实现**,没有第四份自拼。⇒ 本票要求先**量出真实 bounds 再动手**:用 `uiautomator dump`(前提是把 `window_animation_scale`/`transition_animation_scale`/`animator_duration_scale` 三项设 0,否则恒报 `ERROR: could not get idle state` —— 本票踩过,且我一开始把键名写成 `window_transition_animation_scale` 是错的,设了等于没设),取「更多」文本节点与相邻箭头节点的 `[x1,y1][x2,y2]`,分清"同行被挤到下一行"与"父容器给的宽度小于内容宽度"。**无 bounds 证据前不得给 MoreLink 打 `flexShrink`/`flexWrap` 补丁** —— 那是三端共享组件,盲改只会新增第二类债。 〔重复登记副本·派单指针(2026-10-09 量,本席):本行与同题的另一条登记前缀逐字相同而**信息更少**(持有那条在末尾另带一条 2026-10-01 的〔进展…〕注记(代码侧归因与修复已完成、只剩真机复验),本条没有)⇒ **派单以题面「P1 **区段头「更多」与箭头折成两行**…」中较长的那条(现读 822 字节)为准**,本行不再单独派单。按 §1 的 F4 口径**不动勾选** —— 两条都是没做完的事,把没做的记成做过的比原病更响;也不摘声明位编号(守门 71 按"编号 + 题面原文前缀"判丢行,摘号会让自愈层把本行整条回捞,批⑤→⑦ 四轮循环即此),复核入口:`git show HEAD:PROJECT_PLAN.md | grep -F ' ] P1 **区段头「更多」与箭头折成两行**' | awk '{print length()}'` 应现读到两条长度不等的同题行。〕 〔拍板@2026-10-09 机主授权代行:采纳票面纪律——先 uiautomator 取真实 bounds 再动手,盲改共享组件禁止;待真机。〕 〔真机复验@2026-10-13(机主授权登录态到手):**只走完一半** —— 首页「AI 应用商店」区段头实拍「更多 ›」**同行未折行**(同一行内 x≈646-710,y≈217),首页那一半不复现;但票面另一半**学习页 3 个区段本轮未走到**,且 `uiautomator dump` 陈旧缓存 ⇒ bounds 证据(分清"被挤到下一行"与"父容器宽度不足")仍未取到。同屏新线索:区段头标题与顶栏标题都贴/裁在屏幕左缘,**疑父容器横向溢出**(与折行可能同源,未经 bounds 证实)。**保持未勾**,不据半程证据翻勾;票面纪律(先取 bounds、禁盲改三端共享的 `MoreLink`)不变。〕
```

- 原 L15468(L1 外部持有行 L3971):

```
- [ ] **`VideoPlayerScreen` 全屏纯黑 ⇒ 黑页上方横一条 34dp 浅灰带**。这条带由 `App.tsx` 根 View 的 `backgroundColor: tokens.surface.bg` 绘制;屏幕内容在屏幕顶边被裁剪(真机量得带内 y=8..60 = (245,245,245),而把黑底用 `marginTop:-34` 上推后黑色只出现在 y=68 以下)。**即端内任何写法都够不到这条带** —— 完整取证与已回退的尝试见同日登记「实测钉死一条边界:单屏无法把底色铺进状态栏带」。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔真机复验@2026-10-13(机主授权登录态到手):**复验对象不在场** —— 该账号「我的→会员权益→视频」实读「暂无视频内容」空态,全屏播放器无从发起(票面路径 ProfileScreen→VideoPlayerModal 亦需有内容)⇒ 60dp 探针法(带位 y=8..60 应从 (245,245,245) 翻 (0,0,0))**无从量起**。代码侧三处修复均在 HEAD 且回归锁在位(vitest video-immersive 14/14、守门 97 全量 RC=0)。**保持未勾**,等该账号有视频内容或换有内容的账号后一次量清。〕
```

- 原 L15471(L1 外部持有行 L3971):

```
- [ ] **`VideoPlayerScreen` 全屏纯黑 ⇒ 黑页上方横一条 34dp 浅灰带**。这条带由 `App.tsx` 根 View 的 `backgroundColor: tokens.surface.bg` 绘制;屏幕内容在屏幕顶边被裁剪(真机量得带内 y=8..60 = (245,245,245),而把黑底用 `marginTop:-34` 上推后黑色只出现在 y=68 以下)。**即端内任何写法都够不到这条带** —— 完整取证与已回退的尝试见同日登记「实测钉死一条边界:单屏无法把底色铺进状态栏带」。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔真机复验@2026-10-13(机主授权登录态到手):**复验对象不在场** —— 该账号「我的→会员权益→视频」实读「暂无视频内容」空态,全屏播放器无从发起(票面路径 ProfileScreen→VideoPlayerModal 亦需有内容)⇒ 60dp 探针法(带位 y=8..60 应从 (245,245,245) 翻 (0,0,0))**无从量起**。代码侧三处修复均在 HEAD 且回归锁在位(vitest video-immersive 14/14、守门 97 全量 RC=0)。**保持未勾**,等该账号有视频内容或换有内容的账号后一次量清。〕
```

- 原 L15476(L1 外部持有行 L3971):

```
- [ ] **`VideoPlayerScreen` 全屏纯黑 ⇒ 黑页上方横一条 34dp 浅灰带**。这条带由 `App.tsx` 根 View 的 `backgroundColor: tokens.surface.bg` 绘制;屏幕内容在屏幕顶边被裁剪(真机量得带内 y=8..60 = (245,245,245),而把黑底用 `marginTop:-34` 上推后黑色只出现在 y=68 以下)。**即端内任何写法都够不到这条带** —— 完整取证与已回退的尝试见同日登记「实测钉死一条边界:单屏无法把底色铺进状态栏带」。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔真机复验@2026-10-13(机主授权登录态到手):**复验对象不在场** —— 该账号「我的→会员权益→视频」实读「暂无视频内容」空态,全屏播放器无从发起(票面路径 ProfileScreen→VideoPlayerModal 亦需有内容)⇒ 60dp 探针法(带位 y=8..60 应从 (245,245,245) 翻 (0,0,0))**无从量起**。代码侧三处修复均在 HEAD 且回归锁在位(vitest video-immersive 14/14、守门 97 全量 RC=0)。**保持未勾**,等该账号有视频内容或换有内容的账号后一次量清。〕
```

- 原 L15519(L1 外部持有行 L9713):

```
- [ ] P1 **区段头「更多」与箭头折成两行**(学习页 3 个区段 + 首页区段,明暗两态均复现)。1:1 裁图确认**不是降采样伪影**(`crop-study1.png`)。**根因未定**:`MoreLink` 自身是 `flexDirection:'row'` 且 Yoga 默认 `nowrap`,按推理不可能换行;调用面(`LearnScreen.renderSectionHeader` / `MoreTitles` / `CardWithList` / 两端 HomeScreen)**全部委托唯一实现**,没有第四份自拼。⇒ 本票要求先**量出真实 bounds 再动手**:用 `uiautomator dump`(前提是把 `window_animation_scale`/`transition_animation_scale`/`animator_duration_scale` 三项设 0,否则恒报 `ERROR: could not get idle state` —— 本票踩过,且我一开始把键名写成 `window_transition_animation_scale` 是错的,设了等于没设),取「更多」文本节点与相邻箭头节点的 `[x1,y1][x2,y2]`,分清"同行被挤到下一行"与"父容器给的宽度小于内容宽度"。**无 bounds 证据前不得给 MoreLink 打 `flexShrink`/`flexWrap` 补丁** —— 那是三端共享组件,盲改只会新增第二类债。 〔重复登记副本·派单指针(2026-10-09 量,本席):本行与同题的另一条登记前缀逐字相同而**信息更少**(持有那条在末尾另带一条 2026-10-01 的〔进展…〕注记(代码侧归因与修复已完成、只剩真机复验),本条没有)⇒ **派单以题面「P1 **区段头「更多」与箭头折成两行**…」中较长的那条(现读 822 字节)为准**,本行不再单独派单。按 §1 的 F4 口径**不动勾选** —— 两条都是没做完的事,把没做的记成做过的比原病更响;也不摘声明位编号(守门 71 按"编号 + 题面原文前缀"判丢行,摘号会让自愈层把本行整条回捞,批⑤→⑦ 四轮循环即此),复核入口:`git show HEAD:PROJECT_PLAN.md | grep -F ' ] P1 **区段头「更多」与箭头折成两行**' | awk '{print length()}'` 应现读到两条长度不等的同题行。〕 〔拍板@2026-10-09 机主授权代行:采纳票面纪律——先 uiautomator 取真实 bounds 再动手,盲改共享组件禁止;待真机。〕 〔真机取证@2026-10-13(机主授权代行,已登录态):票面明令的「先 uiautomator 量 bounds」**已取到** —— 学习页 3 个区段头逐个量得:「更多」TextView `(612,532,660,564)` 与相邻箭头 SvgView `(664,536,688,560)`(另两处 y=809..857、y=1136..1184 同形),父 Button `(608,524,692,572)`,行内「学习路径」`(28,523,172,572)` 与 Button 同处一行 ⇒ 三者 **y 区间重叠、x 紧邻**,判为**同行未折行**,与"父容器给的宽度小于内容宽度"不是同一型。取样纪律已修正:`uiautomator dump` 报 `could not get idle state` 时**目标文件不被覆盖**,照读会拿到上一轮的旧树(上一轮"陈旧缓存"误判即由此而来);本轮改为先删旧文件 + 校验 stdout 含 "dumped to" + 重试 8 次,仍失败即判"未取证"。**仍未证的一格**:票面写的是「学习页 3 个区段 + 首页区段」,首页那一个因首页 ScrollView 滚动失效(见同题宫格行)取不到 ⇒ 3/4 已证,**保持未勾**,不据半程证据翻勾。〕
```

- 原 L15522(L1 外部持有行 L3971):

```
- [ ] **`VideoPlayerScreen` 全屏纯黑 ⇒ 黑页上方横一条 34dp 浅灰带**。这条带由 `App.tsx` 根 View 的 `backgroundColor: tokens.surface.bg` 绘制;屏幕内容在屏幕顶边被裁剪(真机量得带内 y=8..60 = (245,245,245),而把黑底用 `marginTop:-34` 上推后黑色只出现在 y=68 以下)。**即端内任何写法都够不到这条带** —— 完整取证与已回退的尝试见同日登记「实测钉死一条边界:单屏无法把底色铺进状态栏带」。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔复核@2026-10-13(机主授权代行,已登录态 18643389808):票面 60dp 探针法**仍无从量起** —— 全屏播放器的入口都要真实视频数据:`ProfileScreen` 会员权益「视频」tab 实读「暂无视频内容」(同处「文本/图片/音频」三 tab 中只有视频为空),学习页「课程分类」进去是智能体列表无视频,`CourseDetail`/`StudyIndex` 该账号同样无视频条目 ⇒ 全屏 Dialog 无从发起。另记一条与登录无关的取证边界:本机 `adb shell id` = uid=2000(shell) 非 root ⇒ `/data/data/zh.ai.sq/app_webview/**` 与 WebView cookie 库不可读,登录态只能用"页面是否弹登录框"这一层判据,读不到 cookie 佐证。**保持未勾**。〕
```

- 原 L15526(L1 外部持有行 L3971):

```
- [ ] **`VideoPlayerScreen` 全屏纯黑 ⇒ 黑页上方横一条 34dp 浅灰带**。这条带由 `App.tsx` 根 View 的 `backgroundColor: tokens.surface.bg` 绘制;屏幕内容在屏幕顶边被裁剪(真机量得带内 y=8..60 = (245,245,245),而把黑底用 `marginTop:-34` 上推后黑色只出现在 y=68 以下)。**即端内任何写法都够不到这条带** —— 完整取证与已回退的尝试见同日登记「实测钉死一条边界:单屏无法把底色铺进状态栏带」。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔复核@2026-10-13(机主授权代行,已登录态 18643389808):票面 60dp 探针法**仍无从量起** —— 全屏播放器的入口都要真实视频数据:`ProfileScreen` 会员权益「视频」tab 实读「暂无视频内容」(同处「文本/图片/音频」三 tab 中只有视频为空),学习页「课程分类」进去是智能体列表无视频,`CourseDetail`/`StudyIndex` 该账号同样无视频条目 ⇒ 全屏 Dialog 无从发起。另记一条与登录无关的取证边界:本机 `adb shell id` = uid=2000(shell) 非 root ⇒ `/data/data/zh.ai.sq/app_webview/**` 与 WebView cookie 库不可读,登录态只能用"页面是否弹登录框"这一层判据,读不到 cookie 佐证。**保持未勾**。〕
```

- 原 L15528(L1 外部持有行 L3971):

```
- [ ] **`VideoPlayerScreen` 全屏纯黑 ⇒ 黑页上方横一条 34dp 浅灰带**。这条带由 `App.tsx` 根 View 的 `backgroundColor: tokens.surface.bg` 绘制;屏幕内容在屏幕顶边被裁剪(真机量得带内 y=8..60 = (245,245,245),而把黑底用 `marginTop:-34` 上推后黑色只出现在 y=68 以下)。**即端内任何写法都够不到这条带** —— 完整取证与已回退的尝试见同日登记「实测钉死一条边界:单屏无法把底色铺进状态栏带」。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔复核@2026-10-13(机主授权代行,已登录态 18643389808):票面 60dp 探针法**仍无从量起** —— 全屏播放器的入口都要真实视频数据:`ProfileScreen` 会员权益「视频」tab 实读「暂无视频内容」(同处「文本/图片/音频」三 tab 中只有视频为空),学习页「课程分类」进去是智能体列表无视频,`CourseDetail`/`StudyIndex` 该账号同样无视频条目 ⇒ 全屏 Dialog 无从发起。另记一条与登录无关的取证边界:本机 `adb shell id` = uid=2000(shell) 非 root ⇒ `/data/data/zh.ai.sq/app_webview/**` 与 WebView cookie 库不可读,登录态只能用"页面是否弹登录框"这一层判据,读不到 cookie 佐证。**保持未勾**。〕
```

- 原 L15546(L1 外部持有行 L9713):

```
- [ ] P1 **区段头「更多」与箭头折成两行**(学习页 3 个区段 + 首页区段,明暗两态均复现)。1:1 裁图确认**不是降采样伪影**(`crop-study1.png`)。**根因未定**:`MoreLink` 自身是 `flexDirection:'row'` 且 Yoga 默认 `nowrap`,按推理不可能换行;调用面(`LearnScreen.renderSectionHeader` / `MoreTitles` / `CardWithList` / 两端 HomeScreen)**全部委托唯一实现**,没有第四份自拼。⇒ 本票要求先**量出真实 bounds 再动手**:用 `uiautomator dump`(前提是把 `window_animation_scale`/`transition_animation_scale`/`animator_duration_scale` 三项设 0,否则恒报 `ERROR: could not get idle state` —— 本票踩过,且我一开始把键名写成 `window_transition_animation_scale` 是错的,设了等于没设),取「更多」文本节点与相邻箭头节点的 `[x1,y1][x2,y2]`,分清"同行被挤到下一行"与"父容器给的宽度小于内容宽度"。**无 bounds 证据前不得给 MoreLink 打 `flexShrink`/`flexWrap` 补丁** —— 那是三端共享组件,盲改只会新增第二类债。 〔重复登记副本·派单指针(2026-10-09 量,本席):本行与同题的另一条登记前缀逐字相同而**信息更少**(持有那条在末尾另带一条 2026-10-01 的〔进展…〕注记(代码侧归因与修复已完成、只剩真机复验),本条没有)⇒ **派单以题面「P1 **区段头「更多」与箭头折成两行**…」中较长的那条(现读 822 字节)为准**,本行不再单独派单。按 §1 的 F4 口径**不动勾选** —— 两条都是没做完的事,把没做的记成做过的比原病更响;也不摘声明位编号(守门 71 按"编号 + 题面原文前缀"判丢行,摘号会让自愈层把本行整条回捞,批⑤→⑦ 四轮循环即此),复核入口:`git show HEAD:PROJECT_PLAN.md | grep -F ' ] P1 **区段头「更多」与箭头折成两行**' | awk '{print length()}'` 应现读到两条长度不等的同题行。〕 〔拍板@2026-10-09 机主授权代行:采纳票面纪律——先 uiautomator 取真实 bounds 再动手,盲改共享组件禁止;待真机。〕 〔真机复验@2026-10-13(机主授权登录态到手):**只走完一半** —— 首页「AI 应用商店」区段头实拍「更多 ›」**同行未折行**(同一行内 x≈646-710,y≈217),首页那一半不复现;但票面另一半**学习页 3 个区段本轮未走到**,且 `uiautomator dump` 陈旧缓存 ⇒ bounds 证据(分清"被挤到下一行"与"父容器宽度不足")仍未取到。同屏新线索:区段头标题与顶栏标题都贴/裁在屏幕左缘,**疑父容器横向溢出**(与折行可能同源,未经 bounds 证实)。**保持未勾**,不据半程证据翻勾;票面纪律(先取 bounds、禁盲改三端共享的 `MoreLink`)不变。〕 〔真机取证@2026-10-13(机主授权代行,已登录态):票面明令的「先 uiautomator 量 bounds」**已取到** —— 学习页 3 个区段头逐个量得:「更多」TextView `(612,532,660,564)` 与相邻箭头 SvgView `(664,536,688,560)`(另两处 y=809..857、y=1136..1184 同形),父 Button `(608,524,692,572)`,行内「学习路径」`(28,523,172,572)` 与 Button 同处一行 ⇒ 三者 **y 区间重叠、x 紧邻**,判为**同行未折行**,与"父容器给的宽度小于内容宽度"不是同一型。取样纪律已修正:`uiautomator dump` 报 `could not get idle state` 时**目标文件不被覆盖**,照读会拿到上一轮的旧树(上一轮"陈旧缓存"误判即由此而来);本轮改为先删旧文件 + 校验 stdout 含 "dumped to" + 重试 8 次,仍失败即判"未取证"。**仍未证的一格**:票面写的是「学习页 3 个区段 + 首页区段」,首页那一个因首页 ScrollView 滚动失效(见同题宫格行)取不到 ⇒ 3/4 已证,**保持未勾**,不据半程证据翻勾。〕
```

- 原 L15547(L1 外部持有行 L3971):

```
- [ ] **`VideoPlayerScreen` 全屏纯黑 ⇒ 黑页上方横一条 34dp 浅灰带**。这条带由 `App.tsx` 根 View 的 `backgroundColor: tokens.surface.bg` 绘制;屏幕内容在屏幕顶边被裁剪(真机量得带内 y=8..60 = (245,245,245),而把黑底用 `marginTop:-34` 上推后黑色只出现在 y=68 以下)。**即端内任何写法都够不到这条带** —— 完整取证与已回退的尝试见同日登记「实测钉死一条边界:单屏无法把底色铺进状态栏带」。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔真机复验@2026-10-13(机主授权登录态到手):**复验对象不在场** —— 该账号「我的→会员权益→视频」实读「暂无视频内容」空态,全屏播放器无从发起(票面路径 ProfileScreen→VideoPlayerModal 亦需有内容)⇒ 60dp 探针法(带位 y=8..60 应从 (245,245,245) 翻 (0,0,0))**无从量起**。代码侧三处修复均在 HEAD 且回归锁在位(vitest video-immersive 14/14、守门 97 全量 RC=0)。**保持未勾**,等该账号有视频内容或换有内容的账号后一次量清。〕 〔复核@2026-10-13(机主授权代行,已登录态 18643389808):票面 60dp 探针法**仍无从量起** —— 全屏播放器的入口都要真实视频数据:`ProfileScreen` 会员权益「视频」tab 实读「暂无视频内容」(同处「文本/图片/音频」三 tab 中只有视频为空),学习页「课程分类」进去是智能体列表无视频,`CourseDetail`/`StudyIndex` 该账号同样无视频条目 ⇒ 全屏 Dialog 无从发起。另记一条与登录无关的取证边界:本机 `adb shell id` = uid=2000(shell) 非 root ⇒ `/data/data/zh.ai.sq/app_webview/**` 与 WebView cookie 库不可读,登录态只能用"页面是否弹登录框"这一层判据,读不到 cookie 佐证。**保持未勾**。〕
```

- 原 L15548(L1 外部持有行 L3971):

```
- [ ] **`VideoPlayerScreen` 全屏纯黑 ⇒ 黑页上方横一条 34dp 浅灰带**。这条带由 `App.tsx` 根 View 的 `backgroundColor: tokens.surface.bg` 绘制;屏幕内容在屏幕顶边被裁剪(真机量得带内 y=8..60 = (245,245,245),而把黑底用 `marginTop:-34` 上推后黑色只出现在 y=68 以下)。**即端内任何写法都够不到这条带** —— 完整取证与已回退的尝试见同日登记「实测钉死一条边界:单屏无法把底色铺进状态栏带」。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔真机复验@2026-10-13(机主授权登录态到手):**复验对象不在场** —— 该账号「我的→会员权益→视频」实读「暂无视频内容」空态,全屏播放器无从发起(票面路径 ProfileScreen→VideoPlayerModal 亦需有内容)⇒ 60dp 探针法(带位 y=8..60 应从 (245,245,245) 翻 (0,0,0))**无从量起**。代码侧三处修复均在 HEAD 且回归锁在位(vitest video-immersive 14/14、守门 97 全量 RC=0)。**保持未勾**,等该账号有视频内容或换有内容的账号后一次量清。〕 〔复核@2026-10-13(机主授权代行,已登录态 18643389808):票面 60dp 探针法**仍无从量起** —— 全屏播放器的入口都要真实视频数据:`ProfileScreen` 会员权益「视频」tab 实读「暂无视频内容」(同处「文本/图片/音频」三 tab 中只有视频为空),学习页「课程分类」进去是智能体列表无视频,`CourseDetail`/`StudyIndex` 该账号同样无视频条目 ⇒ 全屏 Dialog 无从发起。另记一条与登录无关的取证边界:本机 `adb shell id` = uid=2000(shell) 非 root ⇒ `/data/data/zh.ai.sq/app_webview/**` 与 WebView cookie 库不可读,登录态只能用"页面是否弹登录框"这一层判据,读不到 cookie 佐证。**保持未勾**。〕
```

- 原 L15550(L1 外部持有行 L3971):

```
- [ ] **`VideoPlayerScreen` 全屏纯黑 ⇒ 黑页上方横一条 34dp 浅灰带**。这条带由 `App.tsx` 根 View 的 `backgroundColor: tokens.surface.bg` 绘制;屏幕内容在屏幕顶边被裁剪(真机量得带内 y=8..60 = (245,245,245),而把黑底用 `marginTop:-34` 上推后黑色只出现在 y=68 以下)。**即端内任何写法都够不到这条带** —— 完整取证与已回退的尝试见同日登记「实测钉死一条边界:单屏无法把底色铺进状态栏带」。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔真机复验@2026-10-13(机主授权登录态到手):**复验对象不在场** —— 该账号「我的→会员权益→视频」实读「暂无视频内容」空态,全屏播放器无从发起(票面路径 ProfileScreen→VideoPlayerModal 亦需有内容)⇒ 60dp 探针法(带位 y=8..60 应从 (245,245,245) 翻 (0,0,0))**无从量起**。代码侧三处修复均在 HEAD 且回归锁在位(vitest video-immersive 14/14、守门 97 全量 RC=0)。**保持未勾**,等该账号有视频内容或换有内容的账号后一次量清。〕 〔复核@2026-10-13(机主授权代行,已登录态 18643389808):票面 60dp 探针法**仍无从量起** —— 全屏播放器的入口都要真实视频数据:`ProfileScreen` 会员权益「视频」tab 实读「暂无视频内容」(同处「文本/图片/音频」三 tab 中只有视频为空),学习页「课程分类」进去是智能体列表无视频,`CourseDetail`/`StudyIndex` 该账号同样无视频条目 ⇒ 全屏 Dialog 无从发起。另记一条与登录无关的取证边界:本机 `adb shell id` = uid=2000(shell) 非 root ⇒ `/data/data/zh.ai.sq/app_webview/**` 与 WebView cookie 库不可读,登录态只能用"页面是否弹登录框"这一层判据,读不到 cookie 佐证。**保持未勾**。〕
```

- 原 L15565(L1 外部持有行 L15612):

```
- [ ] **ai-service 退化指纹的等值处置未拍板**:三选项 A 保留现状 + 消费侧基数保护(本票已把口径写进注释)、B 每账号加盐使其互异(等于放弃"跨账号同设备"检测能力)、C 停用 `fingerprint_hash` 参与联动判定。这是**产品决策**不是重构,按 §24 需机主点头;在拍板前不得为了"账面干净"顺手删列或改摘要算法。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 拍板@2026-10-06:**A 保留现状+消费侧基数保护**(机主拍板,口径已在本票注释);无需代码改动,fingerprint_hash 列保留不改算法
```

- 原 L15566(L1 外部持有行 L7966):

```
- [ ] **门 35(mypy,blocking)此刻对 HEAD 内容就是红的**:一轮 `mypy app --strict` 有 4 条错误落在 `git status` **干净**的文件上(`app/routers/llm.py:1374`、`app/main.py:257`、`app/services/tool_input_scanner.py:34`、`app/services/mcp_server.py:2333`),另 3 条落在他人持有、此刻在飞的 `app/services/agent_engine.py`。后果是 §12e 那一型:**每个碰 ai-service 的提交都被逼 `--no-verify`,连带约 180 道门对该提交作废**(本票第一枚提交就被它连带跳门,归因记录见 `.workbuddy/safe-commit-attestation.jsonl`)。两条诚实限定:① `main.py:257` 的期望类型定义在别的文件里,严格判"HEAD 面红"要一次 `git archive` 隔离检出后复量;② `tool_input_scanner.py:34` / `mcp_server.py:2333` 是"模块没有该属性",与 app/services/sandbox/(该目录已于 2026-10-12 随 G-188 下线删除) 的导出面有关,修它可能改动别人的运行时行为而非只加注解。归属:Python 侧门持有者;解阻判据 = 隔离检出复量后逐条定性(真缺陷修代码、过期注解修类型),**不得为变绿去削 `--strict` 或加 `# type: ignore`**。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15572(L1 外部持有行 L7607):

```
- [ ] **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔拍板 2026-10-05(机主选"未知即按写处理"):MCP 工具默认档不再算 `read` —— 需批准、失败不自动重跑;确实只读者按"服务器 + 工具名"显式登记白名单并把白名单纳入跨语言对账。落点在 `apps/cli/src/tools/hub/mcp-adapter.ts` 与权限档两侧持有人;派单排在 G-710 那枚同目录代理之后,避免两个代理同改一个文件〕
```

- 原 L15573(L1 外部持有行 L7608):

```
- [ ] **设置项"显式清空"与"从未设置"无差，且读侧同一含义两键相反（需拍板；归属：api 设置面 + web 设置页持有人）** —— 已亲自复验：`apps/api/src/routes/user/settings-routes.ts:55` 写体是 `z.record(z.string(), z.unknown())`，落库处 `value === null || value === undefined ? null : String(value)` ⇒ `null` 与"缺席"存成同一个 NULL 行；读侧 `apps/web/app/(main)/settings/notifications/page.tsx:48-52` 四键混用 `!== 'false'`（默认真）与 `=== 'true'`（默认假），于是**同一个被清空的值，在前一族读回 true、在后一族读回 false**。上游同族做法是把三态写进契约（`settings/pluginConfigPatch.ts:29-36`：`undefined`=未触碰跳过、`null`=进 `clearOptionKeys`、sensitive 空串=不改已有值；落库侧 `file-config.adapter.ts:557-565` 按 option key 合并而非整对象替换，防同 scope 密钥被静默清空）。**为什么还开着**：改成三态要动 PUT 语义（单键 DELETE 出口我方根本没有——`deleteUserPreference` 只服务 devices），属对外契约决策；先拍"要不要有删键出口"，再谈读侧归一。**不得**靠"读侧统一成 `=== 'true'`"消红——那会把默认真的四项静默翻转。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15575(L1 外部持有行 L7949):

```
- [ ] **守门 94(errorCode 覆盖率)现在是真红,但红不在内容里,补目录行会制造孤儿条目(2026-09-26 20:5x 实测,归 `llm.py` 持有者)**:HEAD 面 `node scripts/check-error-code-coverage.mjs` exit 1,点名 `apps/ai-service/app/routers/llm.py:3086` 的 `CHAT_MODE_TOOL_BLOCKED` 与 `:3284` 的 `TOOL_MODE_UNAVAILABLE` 未进 `packages/shared/src/chat/error-catalog.ts`。两码同由 `12c685d10e` 引入。**关键读数**:工作树里 `llm.py` 正被并发会话改着,而那两处生产者在它的 diff 中是 **`-` 行(正在被删)** ⇒ 等那枚提交落地,本门自己归零。**处置 = 不动**:此刻按门的提示去补两行目录 + 五语言词包,产出的将是"目录里有、无人产出"的死条目,而 `R2` 只要求台账八类齐备、不反向拦孤儿,门不会替你发现。另需澄清:`check-error-code-coverage` 的红在 safe-commit 的逐道复跑里判 `not-ours`(未点名本次文件),所以它是"合法被跳过"的红 —— 这条登记就是它的出口。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15576(L1 外部持有行 L8055):

```
- [ ] **守门 150(角色档合规)在 HEAD 面判红 471 族,而它是 blocking:定级与存量锚点未对齐** —— 现读 `node scripts/check-radius-role-conformance.mjs` 末行「判红 471 族 / 已判合规 2215 / 弱证据待裁 93 / 未判定 1」。它挂 `apps/ + packages/`,意味着任何一次提交都要先清偿这 471 族,否则唯一出路是各会话跳钩子、连带其余全部守门作废(§12e 那一型)。归属该门持有者,两条正当出口:① 把这 471 族按"首锚 + 只拦新增"落进它自己的 `anchorRegression` 台账;② 或降 warn + `--strict` 问责。**禁止**为让报告变绿去放宽类别判据或把 card 一律改成 lg —— 弱证据实测判错率 20–70%,批量改档等于重新设计。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15580(L1 外部持有行 L7608):

```
- [ ] **设置项"显式清空"与"从未设置"无差，且读侧同一含义两键相反（需拍板；归属：api 设置面 + web 设置页持有人）** —— 已亲自复验：`apps/api/src/routes/user/settings-routes.ts:55` 写体是 `z.record(z.string(), z.unknown())`，落库处 `value === null || value === undefined ? null : String(value)` ⇒ `null` 与"缺席"存成同一个 NULL 行；读侧 `apps/web/app/(main)/settings/notifications/page.tsx:48-52` 四键混用 `!== 'false'`（默认真）与 `=== 'true'`（默认假），于是**同一个被清空的值，在前一族读回 true、在后一族读回 false**。上游同族做法是把三态写进契约（`settings/pluginConfigPatch.ts:29-36`：`undefined`=未触碰跳过、`null`=进 `clearOptionKeys`、sensitive 空串=不改已有值；落库侧 `file-config.adapter.ts:557-565` 按 option key 合并而非整对象替换，防同 scope 密钥被静默清空）。**为什么还开着**：改成三态要动 PUT 语义（单键 DELETE 出口我方根本没有——`deleteUserPreference` 只服务 devices），属对外契约决策；先拍"要不要有删键出口"，再谈读侧归一。**不得**靠"读侧统一成 `=== 'true'`"消红——那会把默认真的四项静默翻转。〔2026-09-29 改号(承 D168 第四遍收尾):剥掉双前缀后本行会与既有 **G-374**(标题「G-374ihui-auth-user里存了is」)**同主键 —— 那不是畸形号而是**真撞号**,所以这里不剥前缀而是取当次空闲新号;原编号位写的是「G-G-」。〕〔【归并】重复登记副本(2026-10-07):同主键的另一条登记 「G-402 · 设置项"显式清空"与"从未设置"无差」,派单以那条为准,本行不再单独派单。〕
```

- 原 L15582(L1 外部持有行 L15612):

```
- [ ] **ai-service 退化指纹的等值处置未拍板**:三选项 A 保留现状 + 消费侧基数保护(本票已把口径写进注释)、B 每账号加盐使其互异(等于放弃"跨账号同设备"检测能力)、C 停用 `fingerprint_hash` 参与联动判定。这是**产品决策**不是重构,按 §24 需机主点头;在拍板前不得为了"账面干净"顺手删列或改摘要算法。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15583(L1 外部持有行 L7607):

```
- [ ] **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔拍板 2026-10-05(机主选"未知即按写处理"):MCP 工具默认档不再算 `read` —— 需批准、失败不自动重跑;确实只读者按"服务器 + 工具名"显式登记白名单并把白名单纳入跨语言对账。落点在 `apps/cli/src/tools/hub/mcp-adapter.ts` 与权限档两侧持有人;派单排在 G-710 那枚同目录代理之后,避免两个代理同改一个文件〕
```

- 原 L15584(L1 外部持有行 L7608):

```
- [ ] **设置项"显式清空"与"从未设置"无差，且读侧同一含义两键相反（需拍板；归属：api 设置面 + web 设置页持有人）** —— 已亲自复验：`apps/api/src/routes/user/settings-routes.ts:55` 写体是 `z.record(z.string(), z.unknown())`，落库处 `value === null || value === undefined ? null : String(value)` ⇒ `null` 与"缺席"存成同一个 NULL 行；读侧 `apps/web/app/(main)/settings/notifications/page.tsx:48-52` 四键混用 `!== 'false'`（默认真）与 `=== 'true'`（默认假），于是**同一个被清空的值，在前一族读回 true、在后一族读回 false**。上游同族做法是把三态写进契约（`settings/pluginConfigPatch.ts:29-36`：`undefined`=未触碰跳过、`null`=进 `clearOptionKeys`、sensitive 空串=不改已有值；落库侧 `file-config.adapter.ts:557-565` 按 option key 合并而非整对象替换，防同 scope 密钥被静默清空）。**为什么还开着**：改成三态要动 PUT 语义（单键 DELETE 出口我方根本没有——`deleteUserPreference` 只服务 devices），属对外契约决策；先拍"要不要有删键出口"，再谈读侧归一。**不得**靠"读侧统一成 `=== 'true'`"消红——那会把默认真的四项静默翻转。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15590(L1 外部持有行 L15618):

```
- [ ] **RN/desktop 端设备指纹只有 2 个可能值（本批新量到，需 owner 定性，非清账动作）**：`apps/mobile-rn/src/lib/device-fingerprint.ts` 的采集器只喂 `platform: Platform.OS` 一个字段 ⇒ 全网 iPhone 共用同一个 `fingerprintHash`（实测 `platform:'ios'` → `8be82194543a6f57cd52c70e03fc9151`、`'android'` → `ef773d266bcd872d505f7af4657e73c3`）。而该列是 `user_devices` 的 `(userId, fingerprintHash)` 唯一键，并被 `plugins/audit-logger.ts:306`、`routes/payment-gateway.ts` 6 处、`payment-usdt.ts:107`、`services/anomaly-detector.ts` 的 `device-fingerprint` 维度当设备标识消费 ⇒ **"新设备登录"检测与支付侧设备风控在 RN 端结构性失效**。修法要么补采字段（需 `react-native-device-info`，AGENTS §3 零依赖约定要一并议）、要么把"依赖指纹唯一性"的规则改掉 —— 两条都改变对外行为，不由 agent 单方定。 〔现读更正 + 归并(2026-10-11 本席):本行正文那句「采集器只喂 platform: Platform.OS 一个字段」**已不成立** —— RN 侧敞口已按机主拍板收口(采集器补采四段:平台段含 Brand-Model-APILevel / screen 物理像素 / timezone / language,见 `apps/mobile-rn/src/lib/device-fingerprint.ts` 头注与 出口 `createDeviceFingerprintCollector` 住在 `packages/types/src/device.ts`;生产摘要侧对旧退化值一次性豁免,变异自证在 `apps/api/tests/legacy-device-fingerprint.test.ts`)。本行残余只有一格且**不在移动端**:`desktop` 侧同型形态 + 桌面端是否纳入同一采集契约属 owner 定性 ⇒ 派单以带该进展注记的那条持有行为准(检索式 `设备指纹只有 2 个可能值`),本行不再单独派单;勾选状态一字未动(那一格确实没做)。〕
```

- 原 L15592(L1 外部持有行 L7607):

```
- [ ] **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔拍板 2026-10-05(机主选"未知即按写处理"):MCP 工具默认档不再算 `read` —— 需批准、失败不自动重跑;确实只读者按"服务器 + 工具名"显式登记白名单并把白名单纳入跨语言对账。落点在 `apps/cli/src/tools/hub/mcp-adapter.ts` 与权限档两侧持有人;派单排在 G-710 那枚同目录代理之后,避免两个代理同改一个文件〕
```

- 原 L15593(L1 外部持有行 L7608):

```
- [ ] **设置项"显式清空"与"从未设置"无差，且读侧同一含义两键相反（需拍板；归属：api 设置面 + web 设置页持有人）** —— 已亲自复验：`apps/api/src/routes/user/settings-routes.ts:55` 写体是 `z.record(z.string(), z.unknown())`，落库处 `value === null || value === undefined ? null : String(value)` ⇒ `null` 与"缺席"存成同一个 NULL 行；读侧 `apps/web/app/(main)/settings/notifications/page.tsx:48-52` 四键混用 `!== 'false'`（默认真）与 `=== 'true'`（默认假），于是**同一个被清空的值，在前一族读回 true、在后一族读回 false**。上游同族做法是把三态写进契约（`settings/pluginConfigPatch.ts:29-36`：`undefined`=未触碰跳过、`null`=进 `clearOptionKeys`、sensitive 空串=不改已有值；落库侧 `file-config.adapter.ts:557-565` 按 option key 合并而非整对象替换，防同 scope 密钥被静默清空）。**为什么还开着**：改成三态要动 PUT 语义（单键 DELETE 出口我方根本没有——`deleteUserPreference` 只服务 devices），属对外契约决策；先拍"要不要有删键出口"，再谈读侧归一。**不得**靠"读侧统一成 `=== 'true'`"消红——那会把默认真的四项静默翻转。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15594(L1 外部持有行 L15612):

```
- [ ] **ai-service 退化指纹的等值处置未拍板**:三选项 A 保留现状 + 消费侧基数保护(本票已把口径写进注释)、B 每账号加盐使其互异(等于放弃"跨账号同设备"检测能力)、C 停用 `fingerprint_hash` 参与联动判定。这是**产品决策**不是重构,按 §24 需机主点头;在拍板前不得为了"账面干净"顺手删列或改摘要算法。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15595(L1 外部持有行 L15597):

```
- [ ]（待派/QODER-O81）**守门 149(包入口 barrel 漏 re-export)对"端内 barrel"整片失明,而它漏的正是能把整站打红的形态** —— 立票凭据不是推理:web 端本机现读 HTTP 500,响应体直接点名 `Export <某组件> doesn't exist in target module`,定位到「端内 barrel 没递出该符号,而同端消费方从 barrel 具名导入」;追溯还发现该符号**曾**在 barrel 里、被一枚"撤掉整条链"的提交摘掉而组件文件保留,之后有人重新引用却没复原出口。同一天另量到一处同型候选(另一张 barrel 与它的消费方),说明这不孤立。**为什么现有门看不见**:149 的候选集按 workspace 包入口(`packages/*/src/index.ts`)枚举,端内 barrel 从来不在面里(实测其 `--json` 输出中不含任何端内 barrel 路径);而管悬空导入的那道门判的是"符号根本不存在",这型是"符号存在而入口没递出",结构上互补不重叠。**后果不是"少一个类型错"**:本仓 web 构建设了 `ignoreBuildErrors`,端内 barrel 漏出口在本地与构建两侧都不红,只有点到那个位置的人知道 —— 与守门 72/78/149 立项时同一族"本地全绿、出事的是产物"。**扩面前置(不得跳过)**:先把存量一次量清(端内 barrel 全集 × 各自消费面 × 悬空具名导入数),再决定定级 —— 存量未清就 blocking 就是与任何提交无关的恒红门,唯一结局是各会话跳钩子、连带其余全部对账作废(§12e 同型);**不得**为让本票变绿去改判据或删引用。**顺带登记一条归属纪律**:那枚造成 500 的在飞引用属他人持有面,本票只登记现象与修法方向,不代改别人的文件。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕〔残行摘号补齐(2026-10-09/F9 清偿批⑤):本行声明位残留的原号已按 F9 清偿批②/④让出(同族持有行的让号记录在案),本笔摘掉声明位令牌,正文除令牌外逐字未动;同题登记以「守门 149(包入口 barrel 漏 re-export)」那一条按标题前缀寻行(不写行号),派单以持有行为准。〕
```

- 原 L15596(L1 外部持有行 L15597):

```
- [ ]（待派/QODER-O81）**守门 149(包入口 barrel 漏 re-export)对"端内 barrel"整片失明,而它漏的正是能把整站打红的形态** —— 立票凭据不是推理:web 端本机现读 HTTP 500,响应体直接点名 `Export <某组件> doesn't exist in target module`,定位到「端内 barrel 没递出该符号,而同端消费方从 barrel 具名导入」;追溯还发现该符号**曾**在 barrel 里、被一枚"撤掉整条链"的提交摘掉而组件文件保留,之后有人重新引用却没复原出口。同一天另量到一处同型候选(另一张 barrel 与它的消费方),说明这不孤立。**为什么现有门看不见**:149 的候选集按 workspace 包入口(`packages/*/src/index.ts`)枚举,端内 barrel 从来不在面里(实测其 `--json` 输出中不含任何端内 barrel 路径);而管悬空导入的那道门判的是"符号根本不存在",这型是"符号存在而入口没递出",结构上互补不重叠。**后果不是"少一个类型错"**:本仓 web 构建设了 `ignoreBuildErrors`,端内 barrel 漏出口在本地与构建两侧都不红,只有点到那个位置的人知道 —— 与守门 72/78/149 立项时同一族"本地全绿、出事的是产物"。**扩面前置(不得跳过)**:先把存量一次量清(端内 barrel 全集 × 各自消费面 × 悬空具名导入数),再决定定级 —— 存量未清就 blocking 就是与任何提交无关的恒红门,唯一结局是各会话跳钩子、连带其余全部对账作废(§12e 同型);**不得**为让本票变绿去改判据或删引用。**顺带登记一条归属纪律**:那枚造成 500 的在飞引用属他人持有面,本票只登记现象与修法方向,不代改别人的文件。 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-627 · 守门149」,派单以那条为准,本行不再单独派单。〕〔残行摘号补齐(2026-10-09/F9 清偿批⑤):本行声明位残留的原号已按 F9 清偿批②/④让出(同族持有行的让号记录在案),本笔摘掉声明位令牌,正文除令牌外逐字未动;同题登记以「守门 149(包入口 barrel 漏 re-export)」那一条按标题前缀寻行(不写行号),派单以持有行为准。〕
```

- 原 L15598(L1 外部持有行 L7607):

```
- [ ] **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15599(L1 外部持有行 L7607):

```
- [ ] **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15601(L1 外部持有行 L7607):

```
- [ ] **MCP 工具被标成 `read` ⇒ 免批准 + 失败自动重跑（需拍板；归属：cli 权限档与 MCP 适配层两侧持有人）** —— 逐跳已亲自复验：① `apps/cli/src/tools/hub/mcp-adapter.ts:81` `dangerLevel: enableDangerous ? 'dangerous' : 'read'`；② `apps/cli/src/tools/permissions.ts:121` 缺省档 `dangerLevel === 'read' ? 'allow' : 'ask'`、`:125` plan 档 `'allow' : 'deny'` ⇒ 远程工具在两种档下都**不问人**；③ `apps/cli/src/tools/index.ts:901` `maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0` ⇒ 同一档又让它**失败重跑一次**；④ 非 hub 路径 `mcp-runtime.ts` 的 `mcpToolToTool` 根本不写该字段，而 `tools/index.ts:106` 自述缺省"按只读处理"。**为什么是问题**：`dangerLevel` 一个字段同时决定"要不要问人"和"能不能重跑"，而远程 MCP 工具的副作用与幂等性由**别人**实现，名字还能仿冒（上游 `mcp/index.ts:123` 正是因此写 `needsApproval = true`，并在 :156-157 注明权限绝不用名字通配表达）。**为什么还开着 / 不许顺手做**：直接翻档 ⇒ 用户侧表现为"昨天能跑今天全要批准"、plan 模式整片拒、且重试语义消失，属对外可见语义变更；渐进路径是先**把"批准"与"可重试"拆成两轴**（副作用/幂等域声明，缺省不改批准），再谈 MCP 默认档。`settings.allowDangerous` 目前是全局而非按 server，这也是选型的一部分。**不得**用行内豁免或调缺省值消账。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15602(L1 外部持有行 L15604):

```
- [ ]（进行中@2026-09-29/LEDGER-FIX）承「图源池的层序违规已清零(落地枚 f1638d8),但留了三格未闭合」那条的第 ③ 格:畸形编号实测有**第二类**,且机械批处理会被自己造出的第三份副本顶回 —— 现读 HEAD 面另有 4 个六位号条目行 `G-811336 / G-812373 / G-813374 / G-87`,其一是"上一轮改号"留下的:**剥前缀时把新号与旧号数字直接相接**(`G-811` + `336` ⇒ `G-811336`),即"修双前缀"这一步本身产出了新畸形。后果实测:我按上一条写的脚本把 `G-G-373` 归成 `G-373` 时,同一件事在面上已有 `G-812373` 那份副本 ⇒ 归并不是消除副本而是**长出第三份**(64 组同主键多行由此而来);而取号器把这类六位号当"已用号"算 max,`{{NEXT_ID}}` 会给出 `G-814386` 这种天文号。**因此本票不换算法,改成逐条归并**:① 先按标题前缀把同一件事的所有形态(干净号 / `G-G-N` / 六位接号)聚成一组,持有行只允许一个;② 其余副本走 `node scripts/plan-tasks-merge.mjs --heal`(F4 只加"重复登记副本"指针、绝不动勾选);③ 只有聚不到组的畸形号才去前缀或另发新号,另发必须走取号令牌(G 族的 NEXT_ID 形态,该令牌展开值已含族名,正文再手写 `G-` 就产出 `G-G-N`,本仓实测三次)。**判据(三条同时成立才算做完)**:面上 `G-G-\d+` 与 `G-\d{6,}` 均为 0;`node scripts/plan-tasks.mjs --staged --gate` 的 F9 撞号组数不得比动手前高;`git show HEAD:PROJECT_PLAN.md` 里每一条被改动的行,除号形态外与父提交逐字等值。**已实测拒写两次**:第一版脚本 `changed(369) != expected(378)`(有 5 个畸形号只出现在折叠注释里没有条目行)、`norm` 等值把六位接号算进"已用号"导致 alloc 出 `G-814386`;另一次是取号器自己拒的 —— 远端 tip 在推进而对象不在本地 ⇒ 它拒绝发号并要求先 `git fetch`,这条锁是对的(上一版只警告不拒,当天就撞出 2 组 F9)。**结论:本条登记行刻意不带编号**,以免我又用六位天文号给台账添第三类畸形。〔归属:本会话;等什么:无,可立即做,但必须按 ①②③ 的顺序,不得直接全局替换〕 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15603(L1 外部持有行 L15604):

```
- [ ]（进行中@2026-09-29/LEDGER-FIX）承「图源池的层序违规已清零(落地枚 f1638d8),但留了三格未闭合」那条的第 ③ 格:畸形编号实测有**第二类**,且机械批处理会被自己造出的第三份副本顶回 —— 现读 HEAD 面另有 4 个六位号条目行 `G-811336 / G-812373 / G-813374 / G-87`,其一是"上一轮改号"留下的:**剥前缀时把新号与旧号数字直接相接**(`G-811` + `336` ⇒ `G-811336`),即"修双前缀"这一步本身产出了新畸形。后果实测:我按上一条写的脚本把 `G-G-373` 归成 `G-373` 时,同一件事在面上已有 `G-812373` 那份副本 ⇒ 归并不是消除副本而是**长出第三份**(64 组同主键多行由此而来);而取号器把这类六位号当"已用号"算 max,`{{NEXT_ID}}` 会给出 `G-814386` 这种天文号。**因此本票不换算法,改成逐条归并**:① 先按标题前缀把同一件事的所有形态(干净号 / `G-G-N` / 六位接号)聚成一组,持有行只允许一个;② 其余副本走 `node scripts/plan-tasks-merge.mjs --heal`(F4 只加"重复登记副本"指针、绝不动勾选);③ 只有聚不到组的畸形号才去前缀或另发新号,另发必须走取号令牌(G 族的 NEXT_ID 形态,该令牌展开值已含族名,正文再手写 `G-` 就产出 `G-G-N`,本仓实测三次)。**判据(三条同时成立才算做完)**:面上 `G-G-\d+` 与 `G-\d{6,}` 均为 0;`node scripts/plan-tasks.mjs --staged --gate` 的 F9 撞号组数不得比动手前高;`git show HEAD:PROJECT_PLAN.md` 里每一条被改动的行,除号形态外与父提交逐字等值。**已实测拒写两次**:第一版脚本 `changed(369) != expected(378)`(有 5 个畸形号只出现在折叠注释里没有条目行)、`norm` 等值把六位接号算进"已用号"导致 alloc 出 `G-814386`;另一次是取号器自己拒的 —— 远端 tip 在推进而对象不在本地 ⇒ 它拒绝发号并要求先 `git fetch`,这条锁是对的(上一版只警告不拒,当天就撞出 2 组 F9)。**结论:本条登记行刻意不带编号**,以免我又用六位天文号给台账添第三类畸形。〔归属:本会话;等什么:无,可立即做,但必须按 ①②③ 的顺序,不得直接全局替换〕 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15605(L1 外部持有行 L15604):

```
- [ ]（进行中@2026-09-29/LEDGER-FIX）承「图源池的层序违规已清零(落地枚 f1638d8),但留了三格未闭合」那条的第 ③ 格:畸形编号实测有**第二类**,且机械批处理会被自己造出的第三份副本顶回 —— 现读 HEAD 面另有 4 个六位号条目行 `G-811336 / G-812373 / G-813374 / G-87`,其一是"上一轮改号"留下的:**剥前缀时把新号与旧号数字直接相接**(`G-811` + `336` ⇒ `G-811336`),即"修双前缀"这一步本身产出了新畸形。后果实测:我按上一条写的脚本把 `G-G-373` 归成 `G-373` 时,同一件事在面上已有 `G-812373` 那份副本 ⇒ 归并不是消除副本而是**长出第三份**(64 组同主键多行由此而来);而取号器把这类六位号当"已用号"算 max,`{{NEXT_ID}}` 会给出 `G-814386` 这种天文号。**因此本票不换算法,改成逐条归并**:① 先按标题前缀把同一件事的所有形态(干净号 / `G-G-N` / 六位接号)聚成一组,持有行只允许一个;② 其余副本走 `node scripts/plan-tasks-merge.mjs --heal`(F4 只加"重复登记副本"指针、绝不动勾选);③ 只有聚不到组的畸形号才去前缀或另发新号,另发必须走取号令牌(G 族的 NEXT_ID 形态,该令牌展开值已含族名,正文再手写 `G-` 就产出 `G-G-N`,本仓实测三次)。**判据(三条同时成立才算做完)**:面上 `G-G-\d+` 与 `G-\d{6,}` 均为 0;`node scripts/plan-tasks.mjs --staged --gate` 的 F9 撞号组数不得比动手前高;`git show HEAD:PROJECT_PLAN.md` 里每一条被改动的行,除号形态外与父提交逐字等值。**已实测拒写两次**:第一版脚本 `changed(369) != expected(378)`(有 5 个畸形号只出现在折叠注释里没有条目行)、`norm` 等值把六位接号算进"已用号"导致 alloc 出 `G-814386`;另一次是取号器自己拒的 —— 远端 tip 在推进而对象不在本地 ⇒ 它拒绝发号并要求先 `git fetch`,这条锁是对的(上一版只警告不拒,当天就撞出 2 组 F9)。**结论:本条登记行刻意不带编号**,以免我又用六位天文号给台账添第三类畸形。〔归属:本会话;等什么:无,可立即做,但必须按 ①②③ 的顺序,不得直接全局替换〕 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15607(L1 外部持有行 L15604):

```
- [ ]承「图源池的层序违规已清零(落地枚 f1638d8),但留了三格未闭合」那条的第 ③ 格:畸形编号实测有**第二类**,且机械批处理会被自己造出的第三份副本顶回 —— 现读 HEAD 面另有 4 个六位号条目行 `G-811336 / G-812373 / G-813374 / G-87`,其一是"上一轮改号"留下的:**剥前缀时把新号与旧号数字直接相接**(`G-811` + `336` ⇒ `G-811336`),即"修双前缀"这一步本身产出了新畸形。后果实测:我按上一条写的脚本把 `G-G-373` 归成 `G-373` 时,同一件事在面上已有 `G-812373` 那份副本 ⇒ 归并不是消除副本而是**长出第三份**(64 组同主键多行由此而来);而取号器把这类六位号当"已用号"算 max,`{{NEXT_ID}}` 会给出 `G-814386` 这种天文号。**因此本票不换算法,改成逐条归并**:① 先按标题前缀把同一件事的所有形态(干净号 / `G-G-N` / 六位接号)聚成一组,持有行只允许一个;② 其余副本走 `node scripts/plan-tasks-merge.mjs --heal`(F4 只加"重复登记副本"指针、绝不动勾选);③ 只有聚不到组的畸形号才去前缀或另发新号,另发必须走取号令牌(G 族的 NEXT_ID 形态,该令牌展开值已含族名,正文再手写 `G-` 就产出 `G-G-N`,本仓实测三次)。**判据(三条同时成立才算做完)**:面上 `G-G-\d+` 与 `G-\d{6,}` 均为 0;`node scripts/plan-tasks.mjs --staged --gate` 的 F9 撞号组数不得比动手前高;`git show HEAD:PROJECT_PLAN.md` 里每一条被改动的行,除号形态外与父提交逐字等值。**已实测拒写两次**:第一版脚本 `changed(369) != expected(378)`(有 5 个畸形号只出现在折叠注释里没有条目行)、`norm` 等值把六位接号算进"已用号"导致 alloc 出 `G-814386`;另一次是取号器自己拒的 —— 远端 tip 在推进而对象不在本地 ⇒ 它拒绝发号并要求先 `git fetch`,这条锁是对的(上一版只警告不拒,当天就撞出 2 组 F9)。**结论:本条登记行刻意不带编号**,以免我又用六位天文号给台账添第三类畸形。〔归属:本会话;等什么:无,可立即做,但必须按 ①②③ 的顺序,不得直接全局替换〕 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15611(L1 外部持有行 L15604):

```
- [ ]承「图源池的层序违规已清零(落地枚 f1638d8),但留了三格未闭合」那条的第 ③ 格:畸形编号实测有**第二类**,且机械批处理会被自己造出的第三份副本顶回 —— 现读 HEAD 面另有 4 个六位号条目行 `G-811336 / G-812373 / G-813374 / G-87`,其一是"上一轮改号"留下的:**剥前缀时把新号与旧号数字直接相接**(`G-811` + `336` ⇒ `G-811336`),即"修双前缀"这一步本身产出了新畸形。后果实测:我按上一条写的脚本把 `G-G-373` 归成 `G-373` 时,同一件事在面上已有 `G-812373` 那份副本 ⇒ 归并不是消除副本而是**长出第三份**(64 组同主键多行由此而来);而取号器把这类六位号当"已用号"算 max,`{{NEXT_ID}}` 会给出 `G-814386` 这种天文号。**因此本票不换算法,改成逐条归并**:① 先按标题前缀把同一件事的所有形态(干净号 / `G-G-N` / 六位接号)聚成一组,持有行只允许一个;② 其余副本走 `node scripts/plan-tasks-merge.mjs --heal`(F4 只加"重复登记副本"指针、绝不动勾选);③ 只有聚不到组的畸形号才去前缀或另发新号,另发必须走取号令牌(G 族的 NEXT_ID 形态,该令牌展开值已含族名,正文再手写 `G-` 就产出 `G-G-N`,本仓实测三次)。**判据(三条同时成立才算做完)**:面上 `G-G-\d+` 与 `G-\d{6,}` 均为 0;`node scripts/plan-tasks.mjs --staged --gate` 的 F9 撞号组数不得比动手前高;`git show HEAD:PROJECT_PLAN.md` 里每一条被改动的行,除号形态外与父提交逐字等值。**已实测拒写两次**:第一版脚本 `changed(369) != expected(378)`(有 5 个畸形号只出现在折叠注释里没有条目行)、`norm` 等值把六位接号算进"已用号"导致 alloc 出 `G-814386`;另一次是取号器自己拒的 —— 远端 tip 在推进而对象不在本地 ⇒ 它拒绝发号并要求先 `git fetch`,这条锁是对的(上一版只警告不拒,当天就撞出 2 组 F9)。**结论:本条登记行刻意不带编号**,以免我又用六位天文号给台账添第三类畸形。〔归属:本会话;等什么:无,可立即做,但必须按 ①②③ 的顺序,不得直接全局替换〕 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15614(L1 外部持有行 L15604):

```
- [ ]承「图源池的层序违规已清零(落地枚 f1638d8),但留了三格未闭合」那条的第 ③ 格:畸形编号实测有**第二类**,且机械批处理会被自己造出的第三份副本顶回 —— 现读 HEAD 面另有 4 个六位号条目行 `G-811336 / G-812373 / G-813374 / G-87`,其一是"上一轮改号"留下的:**剥前缀时把新号与旧号数字直接相接**(`G-811` + `336` ⇒ `G-811336`),即"修双前缀"这一步本身产出了新畸形。后果实测:我按上一条写的脚本把 `G-G-373` 归成 `G-373` 时,同一件事在面上已有 `G-812373` 那份副本 ⇒ 归并不是消除副本而是**长出第三份**(64 组同主键多行由此而来);而取号器把这类六位号当"已用号"算 max,`{{NEXT_ID}}` 会给出 `G-814386` 这种天文号。**因此本票不换算法,改成逐条归并**:① 先按标题前缀把同一件事的所有形态(干净号 / `G-G-N` / 六位接号)聚成一组,持有行只允许一个;② 其余副本走 `node scripts/plan-tasks-merge.mjs --heal`(F4 只加"重复登记副本"指针、绝不动勾选);③ 只有聚不到组的畸形号才去前缀或另发新号,另发必须走取号令牌(G 族的 NEXT_ID 形态,该令牌展开值已含族名,正文再手写 `G-` 就产出 `G-G-N`,本仓实测三次)。**判据(三条同时成立才算做完)**:面上 `G-G-\d+` 与 `G-\d{6,}` 均为 0;`node scripts/plan-tasks.mjs --staged --gate` 的 F9 撞号组数不得比动手前高;`git show HEAD:PROJECT_PLAN.md` 里每一条被改动的行,除号形态外与父提交逐字等值。**已实测拒写两次**:第一版脚本 `changed(369) != expected(378)`(有 5 个畸形号只出现在折叠注释里没有条目行)、`norm` 等值把六位接号算进"已用号"导致 alloc 出 `G-814386`;另一次是取号器自己拒的 —— 远端 tip 在推进而对象不在本地 ⇒ 它拒绝发号并要求先 `git fetch`,这条锁是对的(上一版只警告不拒,当天就撞出 2 组 F9)。**结论:本条登记行刻意不带编号**,以免我又用六位天文号给台账添第三类畸形。〔归属:本会话;等什么:无,可立即做,但必须按 ①②③ 的顺序,不得直接全局替换〕 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15616(L1 外部持有行 L15618):

```
- [ ] **RN/desktop 端设备指纹只有 2 个可能值（本批新量到，需 owner 定性，非清账动作）**：`apps/mobile-rn/src/lib/device-fingerprint.ts` 的采集器只喂 `platform: Platform.OS` 一个字段 ⇒ 全网 iPhone 共用同一个 `fingerprintHash`（实测 `platform:'ios'` → `8be82194543a6f57cd52c70e03fc9151`、`'android'` → `ef773d266bcd872d505f7af4657e73c3`）。而该列是 `user_devices` 的 `(userId, fingerprintHash)` 唯一键，并被 `plugins/audit-logger.ts:306`、`routes/payment-gateway.ts` 6 处、`payment-usdt.ts:107`、`services/anomaly-detector.ts` 的 `device-fingerprint` 维度当设备标识消费 ⇒ **"新设备登录"检测与支付侧设备风控在 RN 端结构性失效**。修法要么补采字段（需 `react-native-device-info`，AGENTS §3 零依赖约定要一并议）、要么把"依赖指纹唯一性"的规则改掉 —— 两条都改变对外行为，不由 agent 单方定。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15617(L1 外部持有行 L15618):

```
- [ ] **RN/desktop 端设备指纹只有 2 个可能值（本批新量到，需 owner 定性，非清账动作）**：`apps/mobile-rn/src/lib/device-fingerprint.ts` 的采集器只喂 `platform: Platform.OS` 一个字段 ⇒ 全网 iPhone 共用同一个 `fingerprintHash`（实测 `platform:'ios'` → `8be82194543a6f57cd52c70e03fc9151`、`'android'` → `ef773d266bcd872d505f7af4657e73c3`）。而该列是 `user_devices` 的 `(userId, fingerprintHash)` 唯一键，并被 `plugins/audit-logger.ts:306`、`routes/payment-gateway.ts` 6 处、`payment-usdt.ts:107`、`services/anomaly-detector.ts` 的 `device-fingerprint` 维度当设备标识消费 ⇒ **"新设备登录"检测与支付侧设备风控在 RN 端结构性失效**。修法要么补采字段（需 `react-native-device-info`，AGENTS §3 零依赖约定要一并议）、要么把"依赖指纹唯一性"的规则改掉 —— 两条都改变对外行为，不由 agent 单方定。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15619(L1 外部持有行 L15618):

```
- [ ] **RN/desktop 端设备指纹只有 2 个可能值（本批新量到，需 owner 定性，非清账动作）**：`apps/mobile-rn/src/lib/device-fingerprint.ts` 的采集器只喂 `platform: Platform.OS` 一个字段 ⇒ 全网 iPhone 共用同一个 `fingerprintHash`（实测 `platform:'ios'` → `8be82194543a6f57cd52c70e03fc9151`、`'android'` → `ef773d266bcd872d505f7af4657e73c3`）。而该列是 `user_devices` 的 `(userId, fingerprintHash)` 唯一键，并被 `plugins/audit-logger.ts:306`、`routes/payment-gateway.ts` 6 处、`payment-usdt.ts:107`、`services/anomaly-detector.ts` 的 `device-fingerprint` 维度当设备标识消费 ⇒ **"新设备登录"检测与支付侧设备风控在 RN 端结构性失效**。修法要么补采字段（需 `react-native-device-info`，AGENTS §3 零依赖约定要一并议）、要么把"依赖指纹唯一性"的规则改掉 —— 两条都改变对外行为，不由 agent 单方定。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15623(L1 外部持有行 L15618):

```
- [ ] **RN/desktop 端设备指纹只有 2 个可能值（本批新量到，需 owner 定性，非清账动作）**：`apps/mobile-rn/src/lib/device-fingerprint.ts` 的采集器只喂 `platform: Platform.OS` 一个字段 ⇒ 全网 iPhone 共用同一个 `fingerprintHash`（实测 `platform:'ios'` → `8be82194543a6f57cd52c70e03fc9151`、`'android'` → `ef773d266bcd872d505f7af4657e73c3`）。而该列是 `user_devices` 的 `(userId, fingerprintHash)` 唯一键，并被 `plugins/audit-logger.ts:306`、`routes/payment-gateway.ts` 6 处、`payment-usdt.ts:107`、`services/anomaly-detector.ts` 的 `device-fingerprint` 维度当设备标识消费 ⇒ **"新设备登录"检测与支付侧设备风控在 RN 端结构性失效**。修法要么补采字段（需 `react-native-device-info`，AGENTS §3 零依赖约定要一并议）、要么把"依赖指纹唯一性"的规则改掉 —— 两条都改变对外行为，不由 agent 单方定。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔拍板@2026-10-12 机主授权代行:RN/跨端族用户指示本批暂缓,维持登记待 RN 窗口;本行交代成立。〕
```

- 原 L15624(L1 外部持有行 L15618):

```
- [ ] **RN/desktop 端设备指纹只有 2 个可能值（本批新量到，需 owner 定性，非清账动作）**：`apps/mobile-rn/src/lib/device-fingerprint.ts` 的采集器只喂 `platform: Platform.OS` 一个字段 ⇒ 全网 iPhone 共用同一个 `fingerprintHash`（实测 `platform:'ios'` → `8be82194543a6f57cd52c70e03fc9151`、`'android'` → `ef773d266bcd872d505f7af4657e73c3`）。而该列是 `user_devices` 的 `(userId, fingerprintHash)` 唯一键，并被 `plugins/audit-logger.ts:306`、`routes/payment-gateway.ts` 6 处、`payment-usdt.ts:107`、`services/anomaly-detector.ts` 的 `device-fingerprint` 维度当设备标识消费 ⇒ **"新设备登录"检测与支付侧设备风控在 RN 端结构性失效**。修法要么补采字段（需 `react-native-device-info`，AGENTS §3 零依赖约定要一并议）、要么把"依赖指纹唯一性"的规则改掉 —— 两条都改变对外行为，不由 agent 单方定。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔拍板@2026-10-12 机主授权代行:RN/跨端族用户指示本批暂缓,维持登记待 RN 窗口;本行交代成立。〕
```

- 原 L15626(L1 外部持有行 L15618):

```
- [ ] **RN/desktop 端设备指纹只有 2 个可能值（本批新量到，需 owner 定性，非清账动作）**：`apps/mobile-rn/src/lib/device-fingerprint.ts` 的采集器只喂 `platform: Platform.OS` 一个字段 ⇒ 全网 iPhone 共用同一个 `fingerprintHash`（实测 `platform:'ios'` → `8be82194543a6f57cd52c70e03fc9151`、`'android'` → `ef773d266bcd872d505f7af4657e73c3`）。而该列是 `user_devices` 的 `(userId, fingerprintHash)` 唯一键，并被 `plugins/audit-logger.ts:306`、`routes/payment-gateway.ts` 6 处、`payment-usdt.ts:107`、`services/anomaly-detector.ts` 的 `device-fingerprint` 维度当设备标识消费 ⇒ **"新设备登录"检测与支付侧设备风控在 RN 端结构性失效**。修法要么补采字段（需 `react-native-device-info`，AGENTS §3 零依赖约定要一并议）、要么把"依赖指纹唯一性"的规则改掉 —— 两条都改变对外行为，不由 agent 单方定。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔拍板@2026-10-12 机主授权代行:RN/跨端族用户指示本批暂缓,维持登记待 RN 窗口;本行交代成立。〕
```

- 原 L15628(L1 外部持有行 L15612):

```
- [ ] **ai-service 退化指纹的等值处置未拍板**:三选项 A 保留现状 + 消费侧基数保护(本票已把口径写进注释)、B 每账号加盐使其互异(等于放弃"跨账号同设备"检测能力)、C 停用 `fingerprint_hash` 参与联动判定。这是**产品决策**不是重构,按 §24 需机主点头;在拍板前不得为了"账面干净"顺手删列或改摘要算法。 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔拍板@2026-10-12 机主授权代行:选 A 保留现状+登记判据(退化指纹是观测信号不是缺陷,等值处置无业务增量);维持登记。〕
```

- 原 L15629(L1 外部持有行 L15618):

```
- [ ] **RN/desktop 端设备指纹只有 2 个可能值（本批新量到，需 owner 定性，非清账动作）**：`apps/mobile-rn/src/lib/device-fingerprint.ts` 的采集器只喂 `platform: Platform.OS` 一个字段 ⇒ 全网 iPhone 共用同一个 `fingerprintHash`（实测 `platform:'ios'` → `8be82194543a6f57cd52c70e03fc9151`、`'android'` → `ef773d266bcd872d505f7af4657e73c3`）。而该列是 `user_devices` 的 `(userId, fingerprintHash)` 唯一键，并被 `plugins/audit-logger.ts:306`、`routes/payment-gateway.ts` 6 处、`payment-usdt.ts:107`、`services/anomaly-detector.ts` 的 `device-fingerprint` 维度当设备标识消费 ⇒ **"新设备登录"检测与支付侧设备风控在 RN 端结构性失效**。修法要么补采字段（需 `react-native-device-info`，AGENTS §3 零依赖约定要一并议）、要么把"依赖指纹唯一性"的规则改掉 —— 两条都改变对外行为，不由 agent 单方定。 〔现读更正 + 归并(2026-10-11 本席):本行正文那句「采集器只喂 platform: Platform.OS 一个字段」**已不成立** —— RN 侧敞口已按机主拍板收口(采集器补采四段:平台段含 Brand-Model-APILevel / screen 物理像素 / timezone / language,见 `apps/mobile-rn/src/lib/device-fingerprint.ts` 头注与 出口 `createDeviceFingerprintCollector` 住在 `packages/types/src/device.ts`;生产摘要侧对旧退化值一次性豁免,变异自证在 `apps/api/tests/legacy-device-fingerprint.test.ts`)。本行残余只有一格且**不在移动端**:`desktop` 侧同型形态 + 桌面端是否纳入同一采集契约属 owner 定性 ⇒ 派单以带该进展注记的那条持有行为准(检索式 `设备指纹只有 2 个可能值`),本行不再单独派单;勾选状态一字未动(那一格确实没做)。〕 〔拍板@2026-10-12 机主授权代行:RN/跨端族用户指示本批暂缓,维持登记待 RN 窗口;本行交代成立。〕
```

- 原 L15632(L1 外部持有行 L15612):

```
- [ ] **ai-service 退化指纹的等值处置未拍板**:三选项 A 保留现状 + 消费侧基数保护(本票已把口径写进注释)、B 每账号加盐使其互异(等于放弃"跨账号同设备"检测能力)、C 停用 `fingerprint_hash` 参与联动判定。这是**产品决策**不是重构,按 §24 需机主点头;在拍板前不得为了"账面干净"顺手删列或改摘要算法。 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 〔拍板@2026-10-12 机主授权代行:选 A 保留现状+登记判据(退化指纹是观测信号不是缺陷,等值处置无业务增量);维持登记。〕
```

- 原 L15634(L1 外部持有行 L15612):

```
- [ ] **ai-service 退化指纹的等值处置未拍板**:三选项 A 保留现状 + 消费侧基数保护(本票已把口径写进注释)、B 每账号加盐使其互异(等于放弃"跨账号同设备"检测能力)、C 停用 `fingerprint_hash` 参与联动判定。这是**产品决策**不是重构,按 §24 需机主点头;在拍板前不得为了"账面干净"顺手删列或改摘要算法。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕 拍板@2026-10-06:**A 保留现状+消费侧基数保护**(机主拍板,口径已在本票注释);无需代码改动,fingerprint_hash 列保留不改算法 〔拍板@2026-10-12 机主授权代行:选 A 保留现状+登记判据(退化指纹是观测信号不是缺陷,等值处置无业务增量);维持登记。〕
```

- 原 L15728(L5 真归并,保留 L7705):

```
- [ ] **断线窗口待决审批的重放(承 D131 取证;等 §24 拍板 A/B/C)** —— 取证已证"会丢"(`apps/ai-service/tests/test_d131_pending_approval_resume.py` 6 例 RC=0)。三条修法与爆炸半径:A=服务端在重连时重放仍待决的条目(改 `llm.py::_approval_sessions` 与 agents 侧待决表的取用点,**须与 `sse_contract` 同批**);B=让主对话流帧出口写 `id:`(动 `_sse()` 是全仓共用出口 ⇒ 影响所有流式消费端与两侧契约,须单独票 + 跨端同批);C=端侧在重连后显式再拉一次待决清单(新增一次读端点,不改服务端语义)。**等谁**:用户拍板选哪条(推荐 A,理由是"不新造对外能力、只补重放"),B 的跨端代价最大。**为什么不在本轮做**:票面写"证实会丢则修在服务端",但服务端改动与并行会话持有面(`llm.py`、`sse_contract.py` 此刻均 ` M`)撞车,按 §12 不代收。 —— 租约(2026-10-02):票面那句『此刻均 ` M`』的阻塞前提已解除(`app/routers/llm.py` 与 `app/core/sse_contract.py` 现读工作树 == HEAD),按票面推荐口径 **A** 开工:服务端在重连时重放仍待决的条目,与 `sse_contract` 同批;爆炸半径与验收以票面 A 档为准。 〔让号记录(2026-10-09 批⑥执行):本行原持 D173,而 D173 同号多题 —— 持有行留驻「AI 对话链路四竞品对标 V4 收口线」,本行让出原号改用 D1047(取号器现读该族最大号已越过 D1047 ⇒ 不会再被发出)。正文与验收口径逐字未改。〕 〔半程@2026-10-13 机主授权代行:agent 任务流侧已交付——agent_loop_v2.pending_approval_replays() 取数侧(仍待决=decision未写∧事件未置,thread_id==session_id 精确相等,属主精确相等 fail-closed;D1047 七例新测试)+agents.py 事件流在 start 帧后对带 Last-Event-ID 的重连重发同形 tool-approval 帧(replay:true,前端按 approvalId 幂等);回归:D131 取证六例+agent流34例全绿。**主对话流(llm.py::_approval_sessions)那半留票面未动**,理由:重连=重起一次 run,直接重放待决条目会让用户答复唤醒孤儿生成器继续执行(僵尸 run 执行结果无处落),须与 sse_contract 同批先立续传锚点 —— 与票面 A 档「须与 sse_contract 同批」一致,本行保持未勾。〕
```

- 原 L15820(L1 外部持有行 L15786):

```
- [ ]〔【归并】重复登记副本·残行摘号(2026-10-10 merge回流再摘):本行已让号至 G-200(持行在面),merge 回流旧态摘号留指针,正文逐字保留(已完成态登记,摘号不翻勾)。〕输出被 max_tokens 截断时没有任何"续写"链路，且端上看不到截断（等人拍板）—— 上游 `runtime/methods/turn-output-token-continuation.ts:15-57` 有界续写 ≤3 次、把 `finish_reason==='length'` 与 raw `model_context_window_exceeded`（**成功响应**）判为续写而非压缩，续写 prompt 带 `queryScope` 并被排除出持久历史。我方 SSE 链**根本不携带 finish/stop reason**（`apps/cli/src/commands/agent.ts`、`packages/api-client/src/endpoints/chat.ts`、`packages/shared/src/utils/sse-parse.ts` 三处现读均无；provider 侧只有 `apps/ai-service/app/providers/gemini_provider.py:146-170` 解 `finishReason` 且只用于 SAFETY）。现读 `scripts/guardian-runner.mjs` 的 187 条 `script:` 中无一道判这一格。跨端契约动作（§19 parity + 8 端），并要先定默认档（只提示 / 默认续写 / 默认 off + 影子档只记账 —— 守门 115 已有同一先例与同一理由）。 〔拍板@2026-10-07 机主:抄上游——有界续写≤3次+finish_reason透传,续写prompt排除出持久历史〕 〔拍板@2026-10-07 机主:抄上游——有界续写≤3次+finish_reason透传,续写prompt排除出持久历史〕〔完成@2026-10-07 续会话:1e6247f516 有界续写≤3次+finish_reason透传,续写prompt排除出持久历史(agent-output-continuation.ts)+cli五语言文案,cli vitest 57/57;截断可见提示半已由 eda9661f7b/ce97639dd7 收口(L8144)〕
```

- 原 L15829(L1 外部持有行 L15604):

```
- [ ]（进行中@2026-09-29/LEDGER-FIX）承「图源池的层序违规已清零(落地枚 f1638d8),但留了三格未闭合」那条的第 ③ 格:畸形编号实测有**第二类**,且机械批处理会被自己造出的第三份副本顶回 —— 现读 HEAD 面另有 4 个六位号条目行 `G-811336 / G-812373 / G-813374 / G-87`,其一是"上一轮改号"留下的:**剥前缀时把新号与旧号数字直接相接**(`G-811` + `336` ⇒ `G-811336`),即"修双前缀"这一步本身产出了新畸形。后果实测:我按上一条写的脚本把 `G-G-373` 归成 `G-373` 时,同一件事在面上已有 `G-812373` 那份副本 ⇒ 归并不是消除副本而是**长出第三份**(64 组同主键多行由此而来);而取号器把这类六位号当"已用号"算 max,`{{NEXT_ID}}` 会给出 `G-814386` 这种天文号。**因此本票不换算法,改成逐条归并**:① 先按标题前缀把同一件事的所有形态(干净号 / `G-G-N` / 六位接号)聚成一组,持有行只允许一个;② 其余副本走 `node scripts/plan-tasks-merge.mjs --heal`(F4 只加"重复登记副本"指针、绝不动勾选);③ 只有聚不到组的畸形号才去前缀或另发新号,另发必须走取号令牌(G 族的 NEXT_ID 形态,该令牌展开值已含族名,正文再手写 `G-` 就产出 `G-G-N`,本仓实测三次)。**判据(三条同时成立才算做完)**:面上 `G-G-\d+` 与 `G-\d{6,}` 均为 0;`node scripts/plan-tasks.mjs --staged --gate` 的 F9 撞号组数不得比动手前高;`git show HEAD:PROJECT_PLAN.md` 里每一条被改动的行,除号形态外与父提交逐字等值。**已实测拒写两次**:第一版脚本 `changed(369) != expected(378)`(有 5 个畸形号只出现在折叠注释里没有条目行)、`norm` 等值把六位接号算进"已用号"导致 alloc 出 `G-814386`;另一次是取号器自己拒的 —— 远端 tip 在推进而对象不在本地 ⇒ 它拒绝发号并要求先 `git fetch`,这条锁是对的(上一版只警告不拒,当天就撞出 2 组 F9)。**结论:本条登记行刻意不带编号**,以免我又用六位天文号给台账添第三类畸形。〔归属:本会话;等什么:无,可立即做,但必须按 ①②③ 的顺序,不得直接全局替换〕 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15830(L1 外部持有行 L15604):

```
- [ ]（进行中@2026-09-29/LEDGER-FIX）承「图源池的层序违规已清零(落地枚 f1638d8),但留了三格未闭合」那条的第 ③ 格:畸形编号实测有**第二类**,且机械批处理会被自己造出的第三份副本顶回 —— 现读 HEAD 面另有 4 个六位号条目行 `G-811336 / G-812373 / G-813374 / G-87`,其一是"上一轮改号"留下的:**剥前缀时把新号与旧号数字直接相接**(`G-811` + `336` ⇒ `G-811336`),即"修双前缀"这一步本身产出了新畸形。后果实测:我按上一条写的脚本把 `G-G-373` 归成 `G-373` 时,同一件事在面上已有 `G-812373` 那份副本 ⇒ 归并不是消除副本而是**长出第三份**(64 组同主键多行由此而来);而取号器把这类六位号当"已用号"算 max,`{{NEXT_ID}}` 会给出 `G-814386` 这种天文号。**因此本票不换算法,改成逐条归并**:① 先按标题前缀把同一件事的所有形态(干净号 / `G-G-N` / 六位接号)聚成一组,持有行只允许一个;② 其余副本走 `node scripts/plan-tasks-merge.mjs --heal`(F4 只加"重复登记副本"指针、绝不动勾选);③ 只有聚不到组的畸形号才去前缀或另发新号,另发必须走取号令牌(G 族的 NEXT_ID 形态,该令牌展开值已含族名,正文再手写 `G-` 就产出 `G-G-N`,本仓实测三次)。**判据(三条同时成立才算做完)**:面上 `G-G-\d+` 与 `G-\d{6,}` 均为 0;`node scripts/plan-tasks.mjs --staged --gate` 的 F9 撞号组数不得比动手前高;`git show HEAD:PROJECT_PLAN.md` 里每一条被改动的行,除号形态外与父提交逐字等值。**已实测拒写两次**:第一版脚本 `changed(369) != expected(378)`(有 5 个畸形号只出现在折叠注释里没有条目行)、`norm` 等值把六位接号算进"已用号"导致 alloc 出 `G-814386`;另一次是取号器自己拒的 —— 远端 tip 在推进而对象不在本地 ⇒ 它拒绝发号并要求先 `git fetch`,这条锁是对的(上一版只警告不拒,当天就撞出 2 组 F9)。**结论:本条登记行刻意不带编号**,以免我又用六位天文号给台账添第三类畸形。〔归属:本会话;等什么:无,可立即做,但必须按 ①②③ 的顺序,不得直接全局替换〕 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15832(L1 外部持有行 L15604):

```
- [ ]（进行中@2026-09-29/LEDGER-FIX）承「图源池的层序违规已清零(落地枚 f1638d8),但留了三格未闭合」那条的第 ③ 格:畸形编号实测有**第二类**,且机械批处理会被自己造出的第三份副本顶回 —— 现读 HEAD 面另有 4 个六位号条目行 `G-811336 / G-812373 / G-813374 / G-87`,其一是"上一轮改号"留下的:**剥前缀时把新号与旧号数字直接相接**(`G-811` + `336` ⇒ `G-811336`),即"修双前缀"这一步本身产出了新畸形。后果实测:我按上一条写的脚本把 `G-G-373` 归成 `G-373` 时,同一件事在面上已有 `G-812373` 那份副本 ⇒ 归并不是消除副本而是**长出第三份**(64 组同主键多行由此而来);而取号器把这类六位号当"已用号"算 max,`{{NEXT_ID}}` 会给出 `G-814386` 这种天文号。**因此本票不换算法,改成逐条归并**:① 先按标题前缀把同一件事的所有形态(干净号 / `G-G-N` / 六位接号)聚成一组,持有行只允许一个;② 其余副本走 `node scripts/plan-tasks-merge.mjs --heal`(F4 只加"重复登记副本"指针、绝不动勾选);③ 只有聚不到组的畸形号才去前缀或另发新号,另发必须走取号令牌(G 族的 NEXT_ID 形态,该令牌展开值已含族名,正文再手写 `G-` 就产出 `G-G-N`,本仓实测三次)。**判据(三条同时成立才算做完)**:面上 `G-G-\d+` 与 `G-\d{6,}` 均为 0;`node scripts/plan-tasks.mjs --staged --gate` 的 F9 撞号组数不得比动手前高;`git show HEAD:PROJECT_PLAN.md` 里每一条被改动的行,除号形态外与父提交逐字等值。**已实测拒写两次**:第一版脚本 `changed(369) != expected(378)`(有 5 个畸形号只出现在折叠注释里没有条目行)、`norm` 等值把六位接号算进"已用号"导致 alloc 出 `G-814386`;另一次是取号器自己拒的 —— 远端 tip 在推进而对象不在本地 ⇒ 它拒绝发号并要求先 `git fetch`,这条锁是对的(上一版只警告不拒,当天就撞出 2 组 F9)。**结论:本条登记行刻意不带编号**,以免我又用六位天文号给台账添第三类畸形。〔归属:本会话;等什么:无,可立即做,但必须按 ①②③ 的顺序,不得直接全局替换〕 〔【归并】重复登记副本(2026-10-01):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕
```

- 原 L15837(L1 外部持有行 L15917):

```
- [ ]**G-73 RN 三处接口路径多写一段 `agents`(守门 8 报的真缺口;2026-10-06 部分收口,① ② 已修并入库 `f3bf8bd3fc`,③ 待机主定)** ——原票面三处里**只有 2 处是路径错**:`HomeScreen.tsx` 的收藏/点赞(① ②)确为多写一段 `agents`(后端 `agents.ts:1567` 是 `server.post('/collect')`、`:1552` 是 `server.post('/thumbs')`，`routes/index.ts:646` 挂 `prefix: "/api"` 且 agentsRoutes 内**无二级 prefix** => 实际 `/api/collect`、`/api/thumbs`)，已改为 `/api/collect` / `/api/thumbs` 并入库(`f3bf8bd3fc`)。**为什么连 `/cozeZhsApi` 一起换成 `/api`**:normalizeUrl 对两者等价(行为零变化)，但守门 8 的 `pathRe` 只认引号紧邻的 `/api/`，`/cozeZhsApi` 永远落在豁免桶里 => 改后才**进入判红调用集**，从此有判据兜住。验收:`check-api-routes.mjs --worktree`「后端不在册」**3 处 → 1 处**;变异(① 改回原路径)⇒ 复现 2 处。⚠️ **口径坑:守门 8 默认面是 HEAD blob 不是工作树**(`check-api-routes.mjs:3553-3559`)⇒ 改后必须加 `--worktree` 才看得到读数变化，不加旗标读数必然不变，别误读成「改动无效」。⚠️ **注释里写路径一律不带引号和反引号** —— `pathRe` 字符类把**反引号与引号同等**，本轮首版注释用反引号包路径，当场被抽成一条真死调用、门 exit 1(已改并留痕)。 ——**③ 另案:不是路径写错，是缺后端实现**。`packages/api-client/src/endpoints/agent.ts:97` 的 `/api/cache/agent-category-dict/categories` 后端 0 命中且**无等价路由**;`getAgentCategories` **不是死代码**(4 个真实 RN 调用方:HomeScreen/PlazaScreen/AgentScreen/AiAssistantScreen)。名字最近的 `agent-categories-cache.ts` 有两点硬差异:① `addHook(preHandler, requireAdmin)` 管理员专属;② 返回体 `{items,total,page,pageSize,lastRefreshedAt}` ≠ 端内要的 `{agentCategory, agentMainCategory}` 双键并列。**未擅自新增路由**(=新造对外契约，机主职权)，`diff -q` 证明该文件逐字未动。**待机主定**:① 新建公开双键字典端点(契约新增)，还是 ② 改端内去调既有 `/api/categories/list` 一类(返回体形状不同，4 个调用方取值逻辑要跟着改)。**风险低**:4 个调用方全有静态 fallback (`PLAZA_CATEGORY_FALLBACK` 等)，当前 404 只导致筛选弹层降级为静态占位，**不崩、不白屏**，可从容决策。顺带发现(同型死常量，未动):`apps/web/src/config/backend-paths.ts:64-65` 的 `${COZE}/agents/thumbs`/`collect`，`AGENTS_PATHS` 零消费方故无线上影响。**③ 收口后本票即可整条翻勾。** **【2026-10-06 追加现读:这一格比票面写的更彻底 —— 不是 2 行死常量,是整张 `ROUTE_MAP` 零消费(纯只读,未动代码)】**:`AGENTS_PATHS` 的真实消费面**只有 1 处** —— 同文件 `ROUTE_MAP['/agents']`(`backend-paths.ts:241`),而 `getPathsByRoute` / `ROUTE_MAP` / `BackendRouteKey` 三者在整个 `apps/web/src` 与全仓(`.ts/.tsx/.mts`)**各自只有定义处 1 个命中、零调用方、零测试钉子** ⇒ **这张表本身就是死的**,所以 `thumbs`/`collect` 那两个错路径永远不会被任何页面取到(与 RN 那两处不同:RN 是活调用会真404)。**更狠的一层**:该文件导出 **14 个路径组**,**只有 `OPENCLAW_PATHS` 有外部 import**(`apps/web/src/lib/openclaw-api.ts:6`,活的);其余 `AUTH_PATHS`/`AI_PATHS`/`FILE_PATHS`/`WS_PATHS`/`AGENTS_PATHS`/`STATISTICS_PATHS`/`SERVICE_APPOINTMENT_PATHS`/`NOTIFICATION_PATHS`/`CUSTOMER_SERVICE_PATHS`/`WALLET_PATHS`/`TOOLS_PATHS`/`CONTENT_PATHS`/`UPLOAD_PATHS`/`USER_SETTINGS_PATHS` **13 组全被这张死表引用或零引用** ⇒ 典型"旧架构整体搬运后没人接线的遗留面"(文件头自述"等价自旧架构 client/src/config/backend-paths.ts")。**为什么本会话不删(留给机主拍板,属 §1/§12e 边界)**:① 删表会一次性带走 14 个导出符号,虽现读零消费,但 `apps/web` 处于**多会话在飞态**(主索引里 `PROJECT_PLAN.md` 已被他人暂存),他人 in-flight 改动若正引用这些符号,删除会让他的构建红在半路且难以归因;② 票面原话是"同型死常量,**无线上影响**"⇒ **收益是纯清理,不是止血**,优先级低于任何真缺口;③ 真要动手,正解**不是删文件**而是先给 `getPathsByRoute` 补一个调用方(把死表接活)或整体删除并在同枚里留指针,**二选一是产品口径**(这张表原设计意图是"按页面查所需 API",可能原计划接一个 API 文档页/调试面板),不该由 agent 代裁。**已核实可排除的两条猜测**:① 不是"路径写错导致线上 404" —— 零消费方,无调用即无请求;② 不是"测试没覆盖导致漏判" —— 全仓无任何测试 import 本文件,删掉不会破测试。**建议(供机主拍板时参考)**:选"整体删除 + 在本行留指针",因为保留一张零消费的表只会持续骗后来人(本轮就有另一个 agent 因为它以为`${COZE}/agents/thumbs` 是活路径而去核对后端)。 〔拍板③@2026-10-06:新建公开双键字典端点,注册在客户端既有调用路径(4 调用方+api-client 零改动);实施 agent 在飞〕**【2026-10-06 死表删除已落地(档 B收口,入库 `31872798562`):本行建议的「整体删除」已执行】**删除前取证走**四通道**(HEAD面 / 暂存区 / 未跟踪 / 工作树当前内容),结论一致:18 个 export 里只有 `OPENCLAW_PATHS` 被真实消费(唯一消费方 `apps/web/src/lib/openclaw-api.ts`,29 处引用);另 14 组路径常量与 `ROUTE_MAP` / `BackendRouteKey` / `getPathsByRoute` 零调用方、零测试钉子。**删的是内容不是文件** —— 整文件删除会连带带走唯一活着的 `OPENCLAW_PATHS`,故保留文件只留活表:**257 行 → 81 行**(−191/+15),水印头尾逐字未动。**保留 `OPENCLAW_PATHS` 全部 8 个子对象(含当前零调用的 `sessions`/`stats`)**:活着的路径表按域完整列出是**契约语义**,按当前调用点裁剪等于把契约表降级成调用点快照;死常量是「整组无人碰」,与此不同类。**甄别过的同名不同物**(删对了、不是漏删):`AGENTS_PATHS` 另有一处是 `apps/ai-service/tests/test_privileged_surface_auth_59.py` 的 Python 局部元组;`ROUTE_MAP` 另有一处是 `apps/miniapp-taro/src/pkg-user/favorites/index.tsx` 该端自己的路由映射。**验收**:`apps/web` tsc `--noEmit` 20 条错误**全部**落在他人 in-flight 文件(`MessageList.tsx` / `windowing.ts` / `checkpoint-rewind-undo-claim.test.tsx` / `LivePlayer.tsx`),无一指向本文件或 `openclaw-api.ts`,且这 4 个文件对本文件**零引用** ⇒ 因果无关;水印 verify 通过;落地 5 道预检(水印 / 悬空引用 / 门 98 / CAS / 提交面回读)全过。**本票剩下的 ③ 仍待实施 agent 收口,与本条删除互不依赖。**〔让号记录(2026-10-09 批⑥执行):本行原持 G-1058623,而 G-1058623 同号多题 —— 持有行留驻「F1 不认 `【归并】重复登记副本` 注记」,本行让出原号改用 G-73(取号器现读该族最大号已越过 G-73 ⇒ 不会再被发出)。正文与验收口径逐字未改。〕 〔改号(2026-10-14):原G-1104167〕 〔落地@2026-10-14:③ 已按拍板收口——apps/api/src/routes/agent-category-dict.ts:29 以绝对路径字面量注册 GET /api/cache/agent-category-dict/categories(经 routes/index.ts:1129 挂载),契约与端内 AgentCategories 双键逐字对齐,4 个 RN 调用方与 api-client 零改动;守门 8 --worktree 终验 exit 0(agent.ts:97 归一后标注〔真调用点·可判·后端在册〕,死调用 0),全仓 RN/api-client 已无活的多写 agents 调用(仅余 2 条不带引号的历史注释)。三处全部收口,本票可整条翻勾。〕
```

- 原 L15858(L5 真归并,保留 L8072(+2 段注记移植)):

```
- [ ] **G-1038426. 分叉合并把 12 个"首行相同、正文已漂移"的重复登记块并到了一起(台账锚点 F4b 由两侧各自的 0 抬到 12),这不是存量欠账,是合并自己造出来的形态**:机制 —— 同一段多行登记被两条分支各自抄走后又各改了正文,行级判据(F1/F2/F4)按"编号 + 标题前缀逐字等值"配对,配不上这种"块级同、行内漂";而 union 的行重数策略对每一行都只"补对侧净增",于是两份漂移副本都活了下来。出口只有 `node scripts/plan-tasks-merge.mjs --dedupe-blocks` 的**报告档**(先不带 --commit 出清单),它**只删逐字相同的第 2..N 份**,**漂移副本一份都不动** —— 机器折半即有损,所以那 12 块必须逐块人工判"哪一份是当前状态",判完就地改写或翻勾并写明归并到谁(§1 第 2 条)。**等什么**:逐块裁决要读两条分支各自的上下文,不由合并代裁;在此之前 F4b=12 只是现读锚点,不得被读成"已修"。(2026-09-28 合并时登记,现值一律跑 `node scripts/plan-tasks.mjs --gate --json` 看末行) (原编号 G-351) 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-351 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕 (2026-09-28 二次改派:上一轮的号是按当时快照取的,合并落地后又被并发批次用掉同号 ⇒ 本次改由 live-doc-edit 在每次 CAS 里按当下 HEAD 现算,不再照快照取号。)
```

## 跳过交人工(逐行点名,不静默)

- L15894:L6 正文有幸存行 L15656 未承载的独有增量(body=1860 字) ⇒ 交人工,不硬删(实测:G-317 约 2000 字关键发现、G-341 整张独立票、L10371 截断回放都是这一型)

  ```
  - [ ]O81 跨端 UI 单一源:小程序端与 App(RN)端逐档同值 + 改一端另一端自动生效(除登录方式与平台机制)。**第 1 票已落(本枚提交)**:对账尺 `scripts/check-cross-end-ui-parity.mjs`(guardian **128**,blocking,棘轮锚点 `scripts/cross-end-ui-parity-baseline.json`,自检 19 例 + 门禁 11 例),AGENTS §4 新节 + README 点名。**立项实测读数**:同名配对组件 19 对 / 174 处差异档 / RN 侧 210 个组件用 `StyleSheet.create` 而小程序侧 91 个用 `className=`(两种样式语言 = 结构上无法自动同步的根因)。**已量到的最小心智事实**:两份自称"唯一实现"的 `BackChevron` 图标墨迹 20px vs 22px、色一档取 `--color-foreground` 一档取 `tk.text.medium`、RN 带系统字号缩放倍率而小程序不带。**剩余票(顺序固定,不得跳)**:② **〔x〕 2026-09-26 已落**:几何档 `packages/design-tokens/src/geometry.js`(`GEOMETRY_PX` 一张表 + `rnGeometry`/`taroGeometry` 两个投影 + `TARO_RPX_PER_PX`,照 `radius.js` 形状,配 `geometry.d.ts`,由 `src/index.ts` 出口),**同枚提交即有两端消费方**(`apps/miniapp-taro/src/components/BackChevron.tsx` 与 `packages/app/src/components/BackChevron.tsx` 各自删掉本地 `= 40`/`= 22`/`= 36` 改取投影);取值依据含"移动端墨迹为何不取 web 顶栏的 14px(`TOPBAR_BTN_BASE` 的 `[&>svg]:!h-3.5` 是桌面密集工具条档)"写在该文件头注。**效果实测**:门 128 索引面 BackChevron 从"仅小程序 20 | 仅 RN 22"变成不再出现在差异清单(18 → 17 条),台账删该键(留着即清单腐烂),门禁测试 11/11 仍绿;`@ihui/design-tokens`、`@ihui/rn-app` typecheck 均 0 错误。**另登记一条与本票无关的既有债**:`pnpm --filter @ihui/miniapp-taro typecheck` 在**干净的 HEAD 上**即报 2 错(`src/pkg-ai/ai/chat.tsx:636` 传 `onTerminalDelta` 而 `StreamEventCallbacks` 无此键 + 参数隐式 any)—— 该文件工作树与 HEAD 逐字节相同,故非在飞改动;未擅自"顺手修"(§12 越权红线),留待该键的归属会话收口。③ 在 `packages/shared` 落"与平台无关的组件源 + 每端注入 primitive adapter"的第一例(试点 `BackChevron`:7 个小程序调用点 / 134 个 RN 调用点,API 取两端并集,动作语义留调用方),两端各自构建 + 真机/模拟器像素复核后才允许下调台账;④ 按台账读数从大到小逐族收敛(`InputArea` 23 / `BottomActionBar` 19 / `LoginPopUp` 17 / `NavBar` 15 / `IntelligentAssistant` 14 为前 5),每族一票,收完即下调 `counts` 并**在同枚提交里**留下"该组件只剩一份源"的证据;⑤ 确属平台差异的逐条写 `waivers.reason`,由守门 108 管到期。**架构前提(不要再试第二条路)**:单向适配器已失败过一次(2026-09-22 删 4,662 行,"同名 ≠ 同契约"),所以只能"一份源 + 两端注入",不能"一端包另一端";`packages/app` 是 RN 专属(Taro 跑不了),`packages/ui-native` 13 个组件里 11 个零生产消费方,不得当成已交付能力引用。
  ```

- L15701:L6 幸存行 L7983 已被既有层处置 ⇒ 本行跳过(幸存行消失的删行 = 净丢活)

  ```
  - [ ] G-210 **台账 F4(重复登记副本)对"同一待办的漂移副本"结构上失明 —— 现读一例:同一条 D41后续① 在 HEAD 有 9 份未勾选副本、其中 7 份正文互不相同(2026-09-28 量)**: `plan-tasks.mjs` 的 F1/F4 判据是"编号 + 标题前缀**逐字等值**",这既是它的优点(不做相似度猜判)也是它的洞 —— 并发 union 每次都留一份**带自己注记**的副本,前缀之后的正文一漂移,复合主键就不再相等,于是同一件事以 N 份"未勾选"长期并存。后果不是账面难看而是**派单被放大 N 倍**:本日两次 `plan-tasks-merge.mjs --heal --commit`(归并 30 行 / 34 行)把 F1/F4 都归到 0,而这一族一份都没被动到 ⇒ "跑过归并"不等于"这一族被覆盖"。出路只有两条且都不该由机器代裁:① 归并线逐组判"哪份是当前状态"(需要读注记语义,机器判不了);② 给登记侧加一条硬约束——同一件事要更新就**就地改那一条**(§1 第 2 条已有此规矩,缺的是让机器能在前缀一致而正文漂移时也点名)。本票**只登记现读证据与两条出路**,不改判据、不批量翻勾(批量翻勾 = 把别人的注记当噪声删,比原病更响)。归属:分叉合并归并线(同 G-363 那条持有)。 〔改号(2026-10-14):原G-1104165〕
  ```

- L7811:L6 正文有幸存行 L15869 未承载的独有增量(body=962 字) ⇒ 交人工,不硬删(实测:G-317 约 2000 字关键发现、G-341 整张独立票、L10371 截断回放都是这一型)

  ```
  - [ ] G-32 **活文档行 union 会把"本侧已让号删掉的旧形态"从 base/对侧补回来 ⇒ union-converge 落地闸对本侧死锁(归属:union-converge 落地闸持有人;本会话量到并受阻)** —— 现读取证:本侧把 7 枚登记行整体让号(`c8cecd2572`,815951..815957 → 815980..815986,四条断言:键位命中唯一 / 标题稳定片段 / 正文逐字守恒 / 旧号引用只允许是【归并】留痕行)之后,`node scripts/union-converge.mjs` 的 F9 从 7 组降到 2 组,余下两组是 `G-815926` / `G-815930` 与「图标生成器注入 radius-exempt 的恒红与…」——**而本面已经没有这两个键位行**。机理:落地闸只判"合并结果是否放大分叉",不管这行是谁删的;活文档的「每行重数取 max」在"本侧删除、对侧未改"这一格会把 base/对侧那一份重新计成 1 份,于是让号一侧的删除**结构上无法传播**,而 F9 恰恰按合并结果计组 ⇒ 谁也无法让闸变绿,除非有人能在合并面上做真正的删除(§12d/守门 100 的口径:"确要删必须在合并之后显式 git rm" —— 可这一步需要先落一次合并,而合并正被它拦住 = 死锁)。**这不是"再改一次号"能解的**(我已实证:上一轮连让两次,每次都被并发 union 把旧形态捞回,一面上攒出三个编号形态)。**候选出路三条,请择一并给出可判前置**:① 落地闸为"本侧自有旧形态副本"开一条**声明式窄口**(逐条附 file+旧号+让号到的新号+取证命令,照 `--take-ours` 的做法:声明必须可复核、少一项即拒),合并落地后立刻在合并面 `git rm` 幽灵行;② 让行 union 认得"删除"这一维 —— 某行在 base 与对侧都在、而本侧把它改写成让号形态(同标题、异键位)时**不再按 max 累加**,配套必须有一条"本侧正当新增不得被少带"的成对反例,否则就把守门 71/100 防吞行那一族能力废回去;③ 由落地闸持有人在合并面做一次一次性清账(把 815926/815930 的幽灵键位行显式删除并留让号注记)。**在①②③任一项落地前,本机凡是"本侧让过号"的会话都会被这道闸卡住,交付同步不到 origin** —— 本会话的 9 枚代码/判据提交即卡在此(圆角四道门与 face-reader 镜像在被审面全绿,已实测)。**禁止的处理**:为让闸变绿去放宽 F9/F1/F4 判据、把幽灵行算成存量债预登记进基线、或继续第三次改号。 〔2026-09-29 让号:G-815987 → G-32 —— 与 origin 面上一枚同号异题登记撞上(union-converge 落地闸 F9 现读),按 §1「后来者改号、由未推的一侧让号」本侧让;旧形态整行原文已逐字入 .ihui-agent/archive/PROJECT_PLAN_superseded-numbering-2026-09-29.md(门 71 的归档豁免),本行上一条"已还原为本号"的留痕已被本条取代〕 〔改号(2026-10-14):原G-856410〕
  ```

- L10752:L6 正文有幸存行 L15816 未承载的独有增量(body=663 字) ⇒ 交人工,不硬删(实测:G-317 约 2000 字关键发现、G-341 整张独立票、L10371 截断回放都是这一型)

  ```
  - [ ] **D181 电脑使用画中画(5 行,对标 `chatSession.pictureInPicture.*`;实现形态需拍板)** —— 竞品串:`sectionLabel`"电脑使用画中画"/`title`"画中画"/`hideInSession`"在此会话中隐藏画中画"/`hideInAllSessions`/`updateFailed`。零命中探针:「画中画」0;`aiChat.floatMode`(PictureInPicture2 图标,ai-side-panel.tsx:1424)=AI 面板页内浮窗,非 computer-use 会话小窗,邻位不背书。拍板结论(2026-09-30 用户拍板):暂缓+登记依赖 —— computer_use.py 是 agent 浏览器自动化工具后端(开页/快照/步进),尚无"可观看会话";先做 PiP 外壳等于空壳。依赖:computer-use 会话可视化(快照流/回放已有 browser_replay/browser_trace 雏形),随其产品化一起立项;浏览器内形态可用 Document Picture-in-Picture API。〔拍板落账@2026-10-10(机主授权代行):2026-09-30 拍板(暂缓+登记依赖)为**终态**——computer_use.py 尚无「可观看会话」,先做 PiP 外壳=空壳,随 computer-use 会话可视化产品化一起立项。本行自本注记起转「等条件(依赖立项)」,不再占等拍板桶;依赖立项之日随新号翻勾或注销。〕
  ```

- L15758:L6 幸存行 L9839 已被既有层处置 ⇒ 本行跳过(幸存行消失的删行 = 净丢活)

  ```
  - [ ] G-417 **全量守门盘点(187 项跑完再汇总)在干净 HEAD 上剩两处无人认领的红,登记以免被"修好我看见的那三道"再掩一次** —— ① 守门 [12] 交付报告一致性判 `PROJECT_PLAN.md` 自身违规 1 处:同一份账面里既写着"完整收尾/无后续建议"一类断言,又留着"后续工作/优化项"清单(AGENTS §10 那条互斥约束)。它在全量档是 warn、不挡提交,但它是**批量审计恒红清单**里的一项,留着就会有人天天来问"这红谁的"。出路只有两条且不得放宽判据:要么把该份报告改成"任务 X 已完成、还有 N 项后续"(推荐,因为活账确实还有),要么真把后续条目清干净再声明闭环。归该份批次报告的作者;现读定位:`node scripts/check-delivery-report-consistency.mjs`。② 同日实测的并发副作用登记:多会话同时提交时(本轮实测单窗口 27–47 枚),守门 [30a] 会把**别人重写提交留下的悬空对象**算在本次提交头上、[84] 会把**别人挂在共享索引里的暂存删除**报成待判 —— 两者本轮都已按仓里规定动作处置(悬空提交 `cf05a98386` 已 `git tag lost-commit/cf05a983` 备份并复跑 30a rc=0,其内容经祖先判据确认**已在主线**,零丢失;[84] 复跑 rc=0 并把那条暂存删除点名交回其持有人)。**留这一格是因为它没有判据**:目前没有任何一道门区分"本次引入的悬空"与"并发重写留下的同内容副本",而这型一旦攒多了就是 §22 那类丢 commit 事故的温床。③ 同轮只读量测的第三格(本机**此刻不成立**,故不是待修而是待防):六把常驻命令行工具在"调用方 cwd 不在仓库内"时仍都能解析到仓库(本机 `.git` 是指针文件,git 会向上找),所以依赖 cwd 的那一处今天没有实害;但 `scripts/union-converge.mjs` 与 `scripts/git-push-converge.mjs` **写死** `C:/Program Files/Git/cmd/git.exe`,而仓里已有唯一出口 `scripts/lib/gitdir.mjs`(§5b 明写"脚本一律不得依赖环境取 git"),另一台机(G 盘那份 checkout)实测 git 落点不同 ⇒ 换机即 ENOENT。`git-push-converge.mjs` 同时是唯一不按自身位置推根的一把(换个目录跑结论会变)。**取证教训一条,写给下一个想顺手"修"的人**:我第一轮把这些工具的失败猜成"模块顶层数组引用后声明常量 ⇒ TDZ",现读**否证**(那三处在函数体内求值),真因是我自己的探针把 msys 风格路径拼成了不存在的目录 —— 0 命中/含糊错先怀疑尺子,再怀疑世界,别照假设改生产工具。（进行中@2026-10-08/W1-A）
  ```

- L15779:L6 正文有幸存行 L10641 未承载的独有增量(body=167 字) ⇒ 交人工,不硬删(实测:G-317 约 2000 字关键发现、G-341 整张独立票、L10371 截断回放都是这一型)

  ```
  - [ ] 4. 观察期:**首个 GREEN run 达成(2026-09-14,ac4acf3f:577 passed / 0 failed / 4 flaky / 66 skipped 〔sha无从找回:ac4acf3f=首个GREEN run(2026-09-14,577 passed)旧史提交,单根02b2d353ad之前,结构上无从找回〕
  ```

- L15818:L6 正文有幸存行 L10641 未承载的独有增量(body=167 字) ⇒ 交人工,不硬删(实测:G-317 约 2000 字关键发现、G-341 整张独立票、L10371 截断回放都是这一型)

  ```
  - [ ] 4. 观察期:**首个 GREEN run 达成(2026-09-14,ac4acf3f:577 passed / 0 failed / 4 flaky / 66 skipped 〔sha无从找回:ac4acf3f=首个GREEN run(2026-09-14,577 passed)旧史提交,单根02b2d353ad之前,结构上无从找回〕
  ```

- L15778:L6 正文有幸存行 L15817 未承载的独有增量(body=1374 字) ⇒ 交人工,不硬删(实测:G-317 约 2000 字关键发现、G-341 整张独立票、L10371 截断回放都是这一型)

  ```
  - [ ] **O88. 台账孪生副本:两型已收口、一型待裁(2026-09-28 两次现读归正,归台账持有人)**:**已收口的两型** —— ① 行号指针维:F3 原先只认「存活于 L<行号>」一种措辞而该族 HEAD 面现读 0 条,归并器自己产的「同主键/逐字相同的另一条登记在 L<行号>」222 处全隐身(47 处指到别的话题 / 160 处目标行根本不是条目行 / 15 处落空),账面 F3=0 而 §1 明令禁止的证据形态满账;现改为**族表**判据 + 与之同集的修复出口(镜像 T11 钉"判得到必须修得了"),并收紧到"禁写行号"本身(指得准的行号指针也判红),现读面上行号指针 **0 处**。② 到期租约维:门 109 的 2 条 CL1 已按 §1 出路清账(有同题已完成登记的那条翻勾并摘牌;正文自述"刻意不当场执行"的那条不翻勾,改写成待认领并写明认领姿势)—— 该门是 `stagedTriggers=PROJECT_PLAN.md` 的 blocking 门,红着等于每次提交计划文档都被逼跳门(§12e)。**仍待裁的一型** —— ③ `--twins` 现读 **102 条**"已闭环登记的未勾孪生",其中靠**相似度**(0.63–0.95)或**包含**配上的约 93 条,按 §1「相似度只配报数,不配判红」一条都不能自动动;逐条分类已出(77 判同一句被复制、3 判不出、0 判成不同事),可自动子集仅 10 行,而那份分类的关键词筛在 35/80 行**漏判**未完成语义(反向 0 漏判)⇒ 这 10 行也不自动落,报告落在 `.ihui-agent/tmp/twin-adjudication/report.md`(临时区,不入库,需要就重跑)。**它在等什么**:等持有人按报告逐条裁"该记完成还是仍开" —— 自动挂"重复登记副本"指针会把真任务从派单口径里静默摘掉,那比账面重复更贵。取证一律现读:`node scripts/check-task-claims.mjs --twins`、`node scripts/plan-tasks.mjs --gate`(F3/F4/F4b/F6 四行)、`node scripts/plan-tasks-merge.mjs`。 **2026-09-28 再归正**:上面③那句"三面全不判"已被并发的另一路会话补上 —— 现读 `node scripts/plan-tasks.mjs --gate` 有 **F10 已完成行的逐字孪生(done 侧)224 组 / 多余副本 339 行**,默认档只报数、差值棘轮只拦新增,逐组出口 `node scripts/plan-tasks-merge.mjs --dedupe-done-twins`,**升 blocking 的前置是存量清零**(§12e)。所以本行剩下的真待裁只余"相似度孪生"那一族。 —— **2026-09-28 本副本同步撤回**:上面"再归正"那句里的 F10 维与 `--dedupe-done-twins` 出口都不在 HEAD(现读 done 侧 85 组,出口从未实现,未知旗标 exit 2),现行判定见同编号「其余三型无人覆盖」那条的第五条更正,勿照本行的 F10 措辞派单。
  ```

- L15729:L6 幸存行 L11406 已被既有层处置 ⇒ 本行跳过(幸存行消失的删行 = 净丢活)

  ```
  - [ ] G-20 **归属:端口注册表门 + ai-service ruff + 受保护检查 lint-typecheck-test —— 三条红都在干净已入库代码上,按 §12f 优先级高于任何新增工作** —— ① `node scripts/check-port-registry.mjs --all` 现读 23 处命中(默认档只扫 2 个文件所以本机看着绿,CI 带 `--all`),全部 in-commit,集中在今天新入库的门与其夹具:`scripts/tests/check-service-binary-pots…`(实读 `check-service-binary-paths.test.mjs` 13 处)、`scripts/check-service-binary-paths.mjs:1525-1529`、`apps/desktop/README.md:46-51`、`apps/cli/tests/` 2 处、`apps/api/src/utils/egress-retry-safety.ts:26`(JSDoc 里的示例地址,该 corpus 不剥注释)。该门的 `EXEMPT_PATH_PATTERNS`(`scripts/check-port-registry.mjs:220-245`)只豁免了 `apps/api/tests`、`apps/ai-service/tests`,**不含 `scripts/tests` 与 `apps/cli/tests`** ⇒ 修哪一侧属该门持有人裁,**不得为变绿删夹具**(夹具是把端口写进断言的正当形态)。② `apps/ai-service` 的 `ruff check .` 现读 54 errors / 32 文件(版本与 `pyproject.toml:88` 的 `ruff==0.16.6` 同 pin 可精确复现),其中 `app/routers/llm.py:3269` 的 `F821 Undefined name tool_exec_tracker` 是唯一疑似**真功能缺陷**的一格,其余是 I001/UP0xx/SIM 类风格。③ 受保护检查 `CI / lint-typecheck-test (push)` 本身在 `496e4ced44`/`bedf82ed9c`/`dd6fb971f5` 上均 failure ⇒ 直推还能走、PR 通道被堵,这是全队交付阻塞而不是一条难看;具体失败步骤未判定(GitHub 未认证配额耗尽 + 日志端点 403),取证另有一路在跑,结论落地后并入本行。 〔改号(2026-10-14):原G-815945〕
  ```

- L11199:L5 幸存行 L7486 已被既有层处置 ⇒ 本行跳过(幸存行消失的删行 = 净丢活)

  ```
  - [ ] G-362 **桌面端「启动后先进托盘」在真机采样里出现过一次"启动 11 秒后窗口自行转为可见"（复现条件未定位，不是偶发即免检）**：同一份 debug 构建、同一份 `desktop-behavior.json`（`launch_minimized:true`）两次采样结论相反 —— 一次 `vis=0 all=1`（3s 与 11s 两趟都全程隐藏，符合预期），另一次 3s 隐藏而 11s 变可见。窗口始终存在（`all=1`），所以不是"没隐藏成功"，而是**某处在我看不到的时刻把它 show 了出来**。已知候选：`lib.rs` 的 12 处 `window.show()`（375 单实例回调 / 2326 / 2728 / 2982 托盘动作与快捷键 / 474-590 托盘菜单分支），以及 `auto_refresh` 的断网兜底守卫。接手第一步：把 show 调用点统一加一行 `log::info!("[window-show] 站点=<n> 触发=…")`，再做两时刻采样(启动后 3s 与 11s 各一趟)（枚举该 pid 全部顶层窗口并分 vis/all 计数，**只看 vis 会把"窗口还没创建"误判成"已隐藏"** —— 本票的相反结论就是这么来的）。判据：同一配置连采 5 趟，`all=1 ∧ vis=0` 恒成立才算收口。**同格第二项未闭环（一并登记，避免下一个人以为弹框那一路也测过）**：「关闭时询问」在真机上只验到**前端没接住**的那一侧（3s 看门狗落兜底隐藏，不卡死不静默退出）；**前端接住并答完**这一路未做真机验证 —— `tauri dev --config {"build":{"devUrl":"http://localhost:8861"}}` 实测仍加载线上 bundle（DevTools 标题 = aizhs.top/agents，设置页里根本没有新卡片），即 devUrl 覆盖在薄壳模式下不生效，要验这一路得先解决"如何让壳加载本地构建"。该行目前只有单测 + 桌面事件三层接线守门覆盖。 〔改派留痕(2026-09-28 台账归并):本行是已完成那条 G-328(主因已修)之后的**另一格残余现象**,与它不是同一行当前状态 ⇒ 另取一号;两行内容都逐字保留。〕
  ```

- L15658:L5 正文有幸存行 L7945 未承载的独有增量(body=50 字) ⇒ 交人工,不硬删(实测:G-317 约 2000 字关键发现、G-341 整张独立票、L10371 截断回放都是这一型)

  ```
  - [ ] G-1. 流式中切换模型 → 终止后自动带入新模型 〔让号记录(2026-10-02 F9 清偿批②):原号 68 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕 〔改号(2026-10-14):原G-1038307〕
  ```

- L15705:L5 正文有幸存行 L9757 未承载的独有增量(body=145 字) ⇒ 交人工,不硬删(实测:G-317 约 2000 字关键发现、G-341 整张独立票、L10371 截断回放都是这一型)

  ```
  - [ ] **G-211 本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)** 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-580 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕 〔让号记录(2026-10-02 F9 清偿批②):原号 G-580 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕 〔让号记录(2026-10-02 F9 清偿批②):原号 G-580 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕 〔让号记录(2026-10-03 F9 清偿批③复投二):原号 G-580 同号多题,按 G-312 + 最早登记行持号,本任务让出原号改用本号;正文除编号位与本记录外逐字未动。〕 〔改号(2026-10-14):原G-1038481〕
  ```

- L15737:L5 正文有幸存行 L11316 未承载的独有增量(body=578 字) ⇒ 交人工,不硬删(实测:G-317 约 2000 字关键发现、G-341 整张独立票、L10371 截断回放都是这一型)

  ```
  - [ ]G-214 看板把 `cancelled/failed/quota_exceeded/preempted` 全塌成 `blocked`（已拍板@2026-10-10批拆七档）—— 上游 `dw/src/engine/errors.ts:14-35` 的分级判据是"**能不能被 catch**"而非严重程度：脚本 catch 得到的降为 node 级、`report` 返回 void 无处 catch 的升 run 级，`Interrupted` 必须独立码（否则"进程被杀"与"脚本真失败"只能靠 message 文本分）。我方 `packages/types/src/agent-runtime.ts:1258-1266` `LEGACY_STATUS_MAP` 四档同落 `blocked` ⇒ 被取消的任务与待解阻塞在看板上同形，"重跑很可能就好"与"要先解阻塞"是一条视觉信号。拆 = 六档变七档，牵动 `z.enum`（`agents-kanban.ts:128,151`）+ SSE 载荷 + `dag_scheduler.py:351` + 五语言 + 守门 151 的 SV2。 〔让号记录(2026-10-02 F9 清偿批②):原号 G-462 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-462 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-462 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕 〔拍板@2026-10-09 机主授权代行:看板状态按可恢复性+严重度两级归桶,cancelled 与 failed 分列;立项派单(六档变七档牵动面以票面为准)。〕 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-462 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕 〔拍板@2026-10-10(机主授权代行):**批,按上游「可 catch 性」分级拆七档**(cancelled/failed/quota_exceeded/preempted 各自独立档,不再塌进 blocked)。证据:HEAD packages/types/src/agent-runtime.ts:548 LEGACY_STATUS_MAP 四档仍同落 blocked 病灶活着;上游 errors.ts:14-35 分级论证完整可抄;**拆档枚举必须与 G-710(错误码取代文本匹配)同笔设计**——同一片 types 枚举表不得两次翻新。拆牵动 z.enum(agents-kanban)+SSE 载荷+dag_scheduler+五语言+守门 151 SV2,§19 同批。本行为持有行直接派单执行。〕 〔改号(2026-10-14):原G-1018246〕 〔状态补正(2026-10-14):行头旧态"等人拍板"系重复登记副本侧形态,拍板事实以行内〔拍板@2026-10-09 机主授权代行〕与 2026-10-10 批拆七档为准,经锚点 PROJECT_PLAN_RENUMBER_2026-10-14 甄别补正〕
  ```

- L15859:L5 幸存行 L7972 已被既有层处置 ⇒ 本行跳过(幸存行消失的删行 = 净丢活)

  ```
  - [ ] **G-1018282. 生产备份链日志的写入侧编码要改成 UTF-8(2026-09-28 逐行 strict-UTF-8 现读登记)**:`D:\DevEnv\logs\pg-backup-scheduler.log` 自 **L571(2026-09-09 00:58:12,字节偏移 25,709)起由 UTF-8 切成 GBK 并持续至今**(前 570 行 520 行中文正常 / 之后 360 行非 UTF-8,0 个 `U+FFFD` ⇒ GBK 侧可无损还原)。**同批纠一处台账失实**:`scripts/alert-volume-report.mjs` 头注把"GBK/UTF-8 混合"记在 `deploy-loop.log` 头上,而该文件实测**整档是合法 UTF-8** —— 坏的是 09-24→09-28 那段已烘死的 475,314 个 `U+FFFD`(行 120,624–257,864,子进程管道阶段就把非 ASCII 字节换成替换字符,**原字节不可回收**);该处文案已按现读改写(规矩"只用 ASCII 判据"一字未动,改的是它给的错误机理 —— 按旧文案下一个人会去修解码器,而解码器没有坏)。**为什么现在不当场做(等环境条件,不是等人拍板)**:改法是 `deploy/win/ihui-pg-backup.ps1` 顶部加一条进程级`[Console]::OutputEncoding = UTF8` 并同笔把 `deploy/prod-bundle/` 那两份运行副本改成逐字节等值(由 prod-bundle 影子对账门判等),调度器每轮用 `&` 从磁盘重读子脚本 ⇒ 不必重启服务、下一轮 03:00 起生效;但它落在**生产备份链实际执行的那份文件**上,而"改转发壳后重启曾让 `pg_dump` 挂 3.5 分钟"那次至今没解释清(本轮另测近 5 轮各 8–15 秒,挂起不可复现)——在解释清之前不动生产备份,这条规矩自 2026-09-24 起就写在案。**归属**:生产备份链持有人。**验收判据(必须"改完且跑过")**:新增行的 strict-UTF-8 解码 non-UTF-8 计数 = 0;历史 GBK 段不做改写(对已入库运行态日志做转换属另一类动作)。**顺带一格(不单独开票)**:`IHUI-DEPLOYLOOP` 的守护半在 09-26 11:09 起就驻留旧脚本,其 catch 支管道仍按旧编码写,全档该支触发 0 次 ⇒ 零观测损伤,并入既有低峰重启窗口即可。 〔让号记录(2026-10-02 F9 清偿批②):原号 G-385 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕
  ```

- L15861:L5 正文有幸存行 L9757 未承载的独有增量(body=139 字) ⇒ 交人工,不硬删(实测:G-317 约 2000 字关键发现、G-341 整张独立票、L10371 截断回放都是这一型)

  ```
  - [ ] **G-2 本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)** 〔让号记录(2026-10-02 F9 清偿批②):原号 G-580 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕 〔改号(2026-10-14):原G-1018296〕
  ```

- L15864:L5 正文有幸存行 L9757 未承载的独有增量(body=139 字) ⇒ 交人工,不硬删(实测:G-317 约 2000 字关键发现、G-341 整张独立票、L10371 截断回放都是这一型)

  ```
  - [ ] **G-8 本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)** 〔让号记录(2026-10-02 F9 清偿批②):原号 G-580 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕 〔改号(2026-10-14):原G-1018297〕
  ```

- L15871:L5 正文有幸存行 L7945 未承载的独有增量(body=50 字) ⇒ 交人工,不硬删(实测:G-317 约 2000 字关键发现、G-341 整张独立票、L10371 截断回放都是这一型)

  ```
  - [ ] G-53. 流式中切换模型 → 终止后自动带入新模型 〔让号记录(2026-10-02 F9 清偿批②):原号 68 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕 〔改号(2026-10-14):原G-1018221〕
  ```

- L15872:L5 正文有幸存行 L9757 未承载的独有增量(body=139 字) ⇒ 交人工,不硬删(实测:G-317 约 2000 字关键发现、G-341 整张独立票、L10371 截断回放都是这一型)

  ```
  - [ ] **G-63 本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)** 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-580 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕 〔改号(2026-10-14):原G-1038482〕
  ```

- L15873:L5 正文有幸存行 L11316 未承载的独有增量(body=509 字) ⇒ 交人工,不硬删(实测:G-317 约 2000 字关键发现、G-341 整张独立票、L10371 截断回放都是这一型)

  ```
  - [ ]G-65 看板把 `cancelled/failed/quota_exceeded/preempted` 全塌成 `blocked`（等人拍板）—— 上游 `dw/src/engine/errors.ts:14-35` 的分级判据是"**能不能被 catch**"而非严重程度：脚本 catch 得到的降为 node 级、`report` 返回 void 无处 catch 的升 run 级，`Interrupted` 必须独立码（否则"进程被杀"与"脚本真失败"只能靠 message 文本分）。我方 `packages/types/src/agent-runtime.ts:1258-1266` `LEGACY_STATUS_MAP` 四档同落 `blocked` ⇒ 被取消的任务与待解阻塞在看板上同形，"重跑很可能就好"与"要先解阻塞"是一条视觉信号。拆 = 六档变七档，牵动 `z.enum`（`agents-kanban.ts:128,151`）+ SSE 载荷 + `dag_scheduler.py:351` + 五语言 + 守门 151 的 SV2。 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-462 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕 〔改号(2026-10-14):原G-1038474〕
  ```

- L15874:L5 正文有幸存行 L11316 未承载的独有增量(body=509 字) ⇒ 交人工,不硬删(实测:G-317 约 2000 字关键发现、G-341 整张独立票、L10371 截断回放都是这一型)

  ```
  - [ ]G-66 看板把 `cancelled/failed/quota_exceeded/preempted` 全塌成 `blocked`（等人拍板）—— 上游 `dw/src/engine/errors.ts:14-35` 的分级判据是"**能不能被 catch**"而非严重程度：脚本 catch 得到的降为 node 级、`report` 返回 void 无处 catch 的升 run 级，`Interrupted` 必须独立码（否则"进程被杀"与"脚本真失败"只能靠 message 文本分）。我方 `packages/types/src/agent-runtime.ts:1258-1266` `LEGACY_STATUS_MAP` 四档同落 `blocked` ⇒ 被取消的任务与待解阻塞在看板上同形，"重跑很可能就好"与"要先解阻塞"是一条视觉信号。拆 = 六档变七档，牵动 `z.enum`（`agents-kanban.ts:128,151`）+ SSE 载荷 + `dag_scheduler.py:351` + 五语言 + 守门 151 的 SV2。 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-462 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕 〔改号(2026-10-14):原G-1038475〕
  ```

- L15875:L5 正文有幸存行 L9757 未承载的独有增量(body=139 字) ⇒ 交人工,不硬删(实测:G-317 约 2000 字关键发现、G-341 整张独立票、L10371 截断回放都是这一型)

  ```
  - [ ] **G-68 本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)** 〔让号记录(2026-10-03 F9 清偿批③复投二):原号 G-580 同号多题,按 G-312 + 最早登记行持号,本任务让出原号改用本号;正文除编号位与本记录外逐字未动。〕 〔改号(2026-10-14):原G-1058518〕
  ```

- L15877:L5 正文有幸存行 L11316 未承载的独有增量(body=511 字) ⇒ 交人工,不硬删(实测:G-317 约 2000 字关键发现、G-341 整张独立票、L10371 截断回放都是这一型)

  ```
  - [ ]G-71 看板把 `cancelled/failed/quota_exceeded/preempted` 全塌成 `blocked`（等人拍板）—— 上游 `dw/src/engine/errors.ts:14-35` 的分级判据是"**能不能被 catch**"而非严重程度：脚本 catch 得到的降为 node 级、`report` 返回 void 无处 catch 的升 run 级，`Interrupted` 必须独立码（否则"进程被杀"与"脚本真失败"只能靠 message 文本分）。我方 `packages/types/src/agent-runtime.ts:1258-1266` `LEGACY_STATUS_MAP` 四档同落 `blocked` ⇒ 被取消的任务与待解阻塞在看板上同形，"重跑很可能就好"与"要先解阻塞"是一条视觉信号。拆 = 六档变七档，牵动 `z.enum`（`agents-kanban.ts:128,151`）+ SSE 载荷 + `dag_scheduler.py:351` + 五语言 + 守门 151 的 SV2。 〔让号记录(2026-10-02 F9 清偿批②):原号 G-462 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕 〔拍板@2026-10-09 机主授权代行:看板状态按可恢复性+严重度两级归桶,cancelled 与 failed 分列;立项派单(六档变七档牵动面以票面为准)。〕 〔改号(2026-10-14):原G-1018245〕
  ```

- L15889:L5 正文有幸存行 L15697 未承载的独有增量(body=92 字) ⇒ 交人工,不硬删(实测:G-317 约 2000 字关键发现、G-341 整张独立票、L10371 截断回放都是这一型)

  ```
  - [ ] G-87 **A1 改道校验只比大小不比内容（可立即修；归属：§26 C 盘改道线，本票持有人即我）** —— 见上文 A1 与现读落点。〔2026-09-29 改号(承 D168 第四遍收尾):剥掉双前缀后本行会与既有 **G-385**(标题「生产备份链日志的写入侧编码要改成UTF-8」)**同主键 —— 那不是畸形号而是**真撞号**,所以这里不剥前缀而是取当次空闲新号;原编号位写的是「G-G-」。〕 〔改号(2026-10-14):原G-814385〕
  ```

