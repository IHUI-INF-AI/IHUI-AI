<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# PROJECT_PLAN 自动归档(2026-09-25)

> 本文件由 scripts/archive-completed-tasks.mjs 自动生成,归档自 PROJECT_PLAN.md 的已完成任务条目。

---

### 对话链路对标 Codex/Trae/Qoder 补洞 W1-W5 ✅(2026-09-18,跨端:ai-service + api + web + cli + api-client)

> 触发:`E:\桌面\AI功能深度对标分析计划.md` 深度对标分析;5 个并行子代理因模型频率上限(429)全部中断,由主代理接续实现到底。
- [x] **W1 终端实时输出(terminal_delta)全链路**:① 后端 `agent_events.py` 新增 `SSE_TERMINAL_DELTA="terminal_delta"`;② `mcp_server._emit_terminal_delta` L1231 支持**进程内直投**(contextvar 注入同步 `push` callable 时优先走 push 并跳过 hook_engine,agent 通道零回归);③ `llm.py` L2578 主聊天流在终端类工具执行前注入 `push=asyncio.Queue.put_nowait`,以 `asyncio.wait({task}, timeout=0.15)` 边等边排水 yield 出帧,任务结束后再排空,`finally` 恢复 contextvar(异常路径同样恢复);④ `api-client` 新增 `TerminalDeltaEvent` + `onTerminalDelta`;⑤ web store 新增 `terminalOutputs` 缓冲(单键 2 万字符 + 最多 20 键插入序淘汰)+ `TerminalSection` 实时面板(自动滚动/实时徽章/清空)。
- [x] **W2 Node 网关:/chat/abort 端点 + compaction 标准帧**:`sse-stream-registry` 新增 `abortConversationStreams`(会话键 `conversationId:messageId`,注入 `{type:'cancelled'}` 终止帧后 abort 上游 controller,幂等)与 `emitNamedEvent`(`event: <name>` + `data:`,与 emitEvent 同样编号进回放缓冲);`POST /api/ai/chat/abort` 端点(三参数至少一个、缺参 400、未命中仍 200 + `aborted:false`);前端 `useChat.stop` 改为先调 abort 端点再断开本地流。
- [x] **W3 CLI/ACP 事件透明**:`agent.ts` 新增 `onReasoning` 透出;`acp/server.ts` 补齐 `agent_thought_chunk` / `tool_call`(toolCallId+mapToolKind+rawInput) / `tool_call_update`(FIFO 配对、结果 ≤8000 字符截断);回调内异常全吞(IDE 渲染失败不中断 agent);配对失败宁缺勿假。
- [x] **W4 Web 事件消费层**:`client.ts` 增 `terminal_delta` / `thinking` / `compaction(type)` 三条专用路由,**拦截在「未知 type 兜底→当正文增量」之前**(历史坑:带 content 的未知帧会喷进聊天正文);`thinking` 与 `reasoning` 同走 `onReasoning`。
- [x] **W5 hunk 级 diff 接受/拒绝 + 死链修复**:① **真实死链修复**——`ai-side-panel.tsx` 的 `<MessageList/>` 此前未透传 `onApplyDiff/onRejectDiff/onApplyAllDiffs/onRejectAllDiffs`,导致 InlineDiffCard 的 Accept/Reject 恒不渲染(点了没反应),现已接通;② 新增纯函数模块 `apps/web/src/lib/hunk-diff.ts`(`splitLinesWithEol` / `detectEol` / `computeHunkDiff` / `buildPartialContent`,`MAX_LCS_CELLS=400 万` 降级为单 hunk);③ `diff-hunk-controls.tsx` hunk 小标题 + 选择工具条(「先选择、再一次应用」模型,避免逐 hunk 写盘使后续基线失效);④ `use-apply-diff.applyDiffSelection` 走既有 `/api/v1/ai/apply-diff` 通道,**全拒绝短路为纯前端标记不写盘**(防清空文件)。

- **验收**:ai-service `test_mcp_tool_guards` 33 passed(新增 3 项 push 直投/广播回归/空 text 用例);api-client 新增 6 项分流用例(**含「绝不落进正文 onDelta」核心守护**)→ 单文件 10 passed、全量 155 passed;cli 新增 `tests/acp-events.test.ts` 7 passed + 全量 2316 passed;apps/api 全量 397 文件 / 6431 tests 全绿;四端 typecheck(web / api / cli / api-client)0 错 + 定向 eslint 0 错 + i18n 5 语言 parity OK(新增 `ai.pane.diffHunk` 10 键 / `ai.pane.terminal` 2 键)+ 死 key 0 + Button 高度守门 0 违规。**已知外部依赖失败(非本改动)**:ai-service `test_native_fc_e2e_real::test_openai_compat_provider_real_native_fc` 因 StepFun 上游配额 402 失败;web media `task-kanban` 等 4 文件失败属既有基线(与本轮改动文件无交集)。

> 📌 **2026-07-26 状态**:所有历史任务已完成并归档(109 个标准格式 + 6 个非标准格式执行报告)。本文件目前**无活跃任务**。所有归档内容在 `.ihui-agent/archive/PROJECT_PLAN_2026-07-26_auto-archive.md` 等归档文件中,可通过 `git log` 或归档目录检索。下方为已归档任务的 HTML 占位注释(按 AGENTS.md §1 规则保留,不可删除)。
>
> 💡 **2026-08-08 goal 模式完成**:全量扫描修复项目所有 bug/问题/未开发项/未对接项。结果:19/19 typecheck/lint/test 全绿,唯一真实 501 stub(monitor-routes.ts 监控漏斗)已修复为真实实现,order.ts FIXME 已清理。无任何未完成项。
>
> 📌 **2026-08-21 任务完成**: 排行榜/分销团队 mobile-rn 端接入真实 API,移除 mock 数据,后端新增 /distribution/team/* 端点,补齐 i18n keys(commit b2ddcf184c,18 文件 +435/-121)。
>
> 📌 **2026-08-21 任务完成**: mobile-rn 端 8 个 Screen 重写对齐 Uniapp 原项目(Agent/Carte/Chat/DevEnter/Developer/Recruitment/Share/Profile/AiAssistantN8n),新增测试 mock 与 vitest 配置,共享组件 TeamDetail/RankingDetail 补齐 loading/error 态,修复 TypeScript typecheck 错误(CarteScreen、DeveloperScreen、RecruitmentScreen 加入迁移白名单),commit c494167ab7,24 文件 +1644/-612。
>
> 📌 **2026-08-31 任务完成**: 桌面端下载页动态解析(零手动)。新增 `scripts/resolve-desktop-download.mjs` 从 GitHub Releases API 解析最新 `desktop-v*` release 资产,生成 `apps/web/src/config/desktop-feed.generated.ts` 入库快照;`downloads.config.ts` desktop 段改为构建期读快照(带 DESKTOP_FALLBACK 兜底);`release-desktop.yml` sync-downloads job + `sync-downloads.yml` 加 resolve 步骤并纳入自动 commit,发版后下载页自动更新 URL/大小/版本号;i18n 5 语言 `downloadDesktopReleaseNotes` 移除硬编码版本号;`.prettierignore` 豁免生成物。web typecheck/eslint/prettier/i18n 守门全绿,快照与线上幂等一致(commit 后记)。
>
> 📌 **2026-09-02 任务完成**: 自写 popover trigger 常驻焦点环 — 全栈 `data-state` 一致化 + `check:popover-trigger-data-state` 守门。**根因**:`apps/web/app/globals.css:1090-1093` 用 `button[data-state='closed']:focus-visible { box-shadow: none }` 抑制 Radix trigger 关闭后归还焦点的 2px ring 常驻,但项目内有 10 处**自写 popover**(`useState(open)` + `createPortal`,并非 Radix),其 trigger `<button>` 缺 `data-state` 属性,致 globals.css 规则**完全不命中**;同时 `form/Select.tsx` 用 `focus:ring-2`(非 `:focus-visible`),鼠标点击也会误亮焦点环。**修复 13 文件 +76/-2**:① 11 个 trigger 按钮加 `data-state={open ? 'open' : 'closed'}`(permission-history-panel 时钟图标根治 / permission-mode-popover 一致化 / context-usage-ring + slash-command-palette + add-menu-popover 显式自写 / global-topbar + tags-view + sidebar-actions 侧栏+顶栏同步);② `apps/web/src/components/feedback/Popover.tsx` cloneElement 时**自动注入** `data-state` 到所有 `children` 的 `as`-包装,所有调用点零感知;③ `form/Select.tsx` `focus:ring-2 focus:ring-offset-2` 改 `focus-visible:ring-2 focus-visible:ring-offset-2`(鼠标点击不再误亮,键盘 Tab 仍可见);④ `feedback/Drawer.tsx` JSDoc 约束外部 trigger 必须自带 `data-state` 或 `focus-visible:` 系 class。**新增守门**:`scripts/check-popover-trigger-data-state.mjs`(215 行,启发式 + AST-lite:扫描含 `createPortal` 且非 Radix import 的 `.tsx` 文件,缺 `data-state` 且会 `triggerRef.current?.focus()` 归还焦点的 trigger **exit 1**);注册到 `pnpm check:all`(与现有 i18n-keys / safe-parse / nav-dead-links 等并列);当前基线 10 个 popover 文件全 0 违规。**提交**:395a8a26d7;三仓(origin/gitee/gitcode)已全部同步。注:推送 gitee/gitcode 时 typecheck 被并行会话(改 publish/accounts/* + skill-library + tauri-bridge)的 4 处 TS 错误半编辑态阻塞(我方改动 0 TS 错误),按已守备规则 `HUSKY_SKIP_TYPECHECK=1` 绕过,GitHub 因 hook 阶段已成功推送未受影响。

> 📌 **2026-09-02 任务完成**: WorkPanel 代理内嵌浏览器(embed-proxy)**历史连贯根治** — proxy 模式 back/forward 零变化 + 历史双压栈。**根因(三)**:① `ihui-embed-loaded`(每次代理文档就绪都广播,url=`cur()`=服务端注入 `<base>`=302 跟随后的**最终落点**)被 store 当"新导航"压栈 → 后退目标 302 回当前页时落点广播把 idx 弹回;② `back()/forward()` 硬编码 `mode:'iframe'` + `loadUrl()` 重探测(去重锁 10s 内同 URL 直接跳过 → state 停 iframe 而 proxyUrl 未设 → 渲染分支错乱 / XFO 站点直嵌白屏);③ 初次加载 `example.com` + 落点 `example.com/` 两条重复条目。**修复(store `apps/web/src/stores/work-panel.ts` + 组件 `web-work-panel.tsx` + 8 新单测)**:① `onEmbedNavigation(url,title,kind)` 判别 `'nav'`(链接点击/跳转前广播 → 截断前进栈压栈)vs `'loaded'`(落点 → 只把当前条目**原地修正**为真实 URL,绝不压栈;与前一条目相同则合并去重);② back/forward 遇 `mode==='proxy'` 保持代理通道,直接换 `proxyUrl`(WebViewFrame `key={proxyUrl}` 触发 iframe 重建),不走 iframe 回落 + 重探测;③ navigate 重复提交当前 URL 只截断前进栈不压重复条目;④ **顺带根治潜伏缺陷**:status 原写在 tab 顶层(渲染层读 `tab.state.status`,单测捕获) → 改写入 `state.status` + 同步 `state.url`。**验证**:web typecheck 0 错误 + work-panel 单测 49/49(新增 8 用例覆盖 loaded 修正不压栈/重定向回退合并/proxy back-forward 保通道)+ 全量 1386/1387(1 失败 `message-list.test.tsx` 为并行会话 thinking-section 半编辑态,与本改动无关)+ e2e 回归探针 `tmp/verify-embed/probe-back4.cjs` **ALL PASS**(单条历史 / nav push + loaded 落点替换无第三条 / back 后 8s idx 稳定 0 / forward 回跳)。API 端 commit(embed-proxy form POST 透传 + GET 字段合并)与本 fix 分别提交。**提交**:api=`f63a331cb7`、web 历史连贯=`ab1ee213cb`(均含守门 typecheck 全绿并推送 origin);并行会话基于 ab1ee 追加 `e3b8517654`(补 Alt+←/→ 前进后退/Ctrl+R-F5 cache-buster 重载/Ctrl+L 聚焦地址栏 + 容器快捷键 a11y 豁免,工作区已与其一致)。

> 📌 **2026-09-05 任务完成**: web 移动端(手机视口 390px)**布局冲突/重叠根治**。用户反馈"web端用手机访问界面各种冲突重叠"。用 agent-browser 手机视口实测复现 + 全站巡检(11 页),共修 5 处:**根因一**:`apps/web/app/globals.css` `@media (max-width:1023px)` 把桌面侧栏 `aside[data-viewport-collapsed]` 一刀切强制 60px → 手机上 logo 竖排文字重叠 + 挤占内容区 60px;修复:拆两段——<768px `display:none` 完全隐藏(移动抽屉是兄弟节点不受影响),768-1023px 平板保留 60px 图标条(`apps/web/src/components/sidebar/Sidebar.tsx` 注释同步)。**根因二**:`packages/ui-react/src/components/auth-shell.tsx` welcome 图容器 `w-[340px] shrink-0` 固定宽 → login-scope 卡片 min-content≈441px 撑破 DialogContent(`w-[calc(100%-2rem)]=358px`),登录弹窗横向溢出被裁;修复:`w-[min(340px,calc(100vw-10rem))]` + img 加 `max-w-full object-contain`。**之三**:登录 2FA 面板浮层 `w-[320px]` → `w-full max-w-[320px]`(`apps/web/src/components/login/LoginFormContent.tsx`)。**之四**:PWA 安装提示条手机上遮挡聊天输入框 → <768px 改挂顶栏下方通栏(`apps/web/src/components/layout/GlobalShell.tsx`)。**之五**:全站固定宽度排查(Explore 扫描 w-[≥300px]/min-w/内联 width):en/pricing 对比表 640px、ai-news Leaderboard 920px、compare 760px 三处表格均已有 overflow-x-auto 包裹(安全,未动);顶栏 TagsView 标签截断属正常自适应(未动)。**验证**:agent-browser 390×844 实测登录卡片 L=16 R=374、溢出元素 0、`body.scrollWidth=390`(无横向滚动),/pricing /compare /ai-news /en /workspace /settings /messages /models /wallet /edu /agents-market 11 页全部 390 无溢出。**流程**:改前端必须重跑 `pnpm build`(next build+next start,~20 分钟)+ 重启 IHUI-WEB;@ihui/ui-react 为 workspace 源码直译(transpilePackages)无需单独 build。

---

### 已完成 ✅(2026-07-30)

---

### 产品 AI 能力满分开发(2026-08-12 立,P1,ai-service 为主) ✅

> 用户指令:"继续开发到满分""都需要推进到满分""按你的建议去做执行,最多 agent 并行开发最大化效率"。目标:错误恢复/自进化/任务/对话/使用便利五维度失分点清零。

---

### 第二轮:三 agent 并行穷尽审计 + P0 越权根治(2026-09-09 完成 ✅)

> 触发:用户判定首轮收尾"没做完没做细有遗漏"。3 个并行审计 agent 穷尽扫描跨端消费/声纹链路/用户隔离,坐实 3 项遗漏(提交 f8b231a04,三仓已推)。
- [x] ✅(2026-09-09) **P0 IDOR 越权根治(与 llm.py P0-9 同类)**:媒体任务路由此前不校验身份且 user_uuid 可选,任何登录用户可查看/取消/删除全平台任务。新增 `_user_scope` 依赖(JWT 派生 user_id/role_id,admin=role_id≥1):列表/统计/批量清理非 admin 强制按当前用户过滤;详情/单取消/删除非 admin 归属校验(不归属 404 不泄露存在性,与 agent_runtime._require_session 同策略,user_uuid='' 历史行不强制);批量取消服务层 `cancel_media_tasks` 新增 user_uuid 参数。生产 8803 实测:普通 token 列表/stats 全 0、admin 可见全部。

---

### 第三轮:admin 判定复核 + 声纹删除越权收敛(2026-09-09 完成 ✅)

> 触发:用户判定"还有遗漏"。第三轮穷尽核查聚焦上轮修复的根基与未覆盖面(提交 ab4d40a7f,三仓已推)。

---

### 第四轮:video.py 越权收敛 + 回调验签 fail-closed(2026-09-09 完成 ✅)

> 触发:用户再次判定"还有遗漏"。第四轮扫描前三轮未覆盖面:ai-service 遗留 API 面(video.py)、公开回调端点验签密钥、生产真实消费链路复核(提交 d02f781f7,三仓已推)。
- [x] ✅(2026-09-09) **P0 video.py 越权收敛(与 media_tasks 修复前同类 IDOR)**:列表 user_uuid 缺省查全平台、详情无归属校验(泄露产物 URL)、创建端 user_uuid 客户端可控(默认 "system" 可冒充入队)、取消任意 provider 任务。修复:列表/创建复用 media_tasks._user_scope/_scoped_user_uuid(JWT 派生,admin=role_id≥1),详情/取消归属校验(不归属 404)。生产链路复核:apps/api jimeng4 视频任务(创建注入 request.userId/列表 findVideoTasksByUser/详情归属查询)隔离完备,web 视频任务页轮询条件 accepted/running 亦正确——本路由为公网可达、无仓内消费者的遗留 API 面。
- [x] ✅(2026-09-09) **P0 回调验签 fail-closed**:/video/token6688-callback 与 /media/tasks/callback 均在 JWT 公开白名单(外部平台 webhook 无 JWT),TOKEN6688_CALLBACK_SECRET 为空时此前"跳过验签继续处理"= 匿名可伪造任意任务终态。现拒绝处理返回 503;配 token6688 key 时必须同步配置回调密钥(当前 .env 两处均空,token6688 链路本就未激活,无功能损失)。

---

### 第五轮:产品完整性收尾——交付承诺逐项对账(2026-09-09 完成 ✅)

> 触发:用户提示"别光想着遗漏,还有其他的"。第五轮换视角,不再盯越权,改审 F6-F8 交付物本身的产品完整性(提交 089c87a86,三仓已推)。

---

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
### 对话链路对标 Codex/Trae/Qoder 补洞 W1-W5 ✅(2026-09-18,跨端:ai-service + api + web + cli + api-client)
> 触发:`E:\桌面\AI功能深度对标分析计划.md` 深度对标分析;5 个并行子代理因模型频率上限(429)全部中断,由主代理接续实现到底。
- [x] **W1 终端实时输出(terminal_delta)全链路**:① 后端 `agent_events.py` 新增 `SSE_TERMINAL_DELTA="terminal_delta"`;② `mcp_server._emit_terminal_delta` L1231 支持**进程内直投**(contextvar 注入同步 `push` callable 时优先走 push 并跳过 hook_engine,agent 通道零回归);③ `llm.py` L2578 主聊天流在终端类工具执行前注入 `push=asyncio.Queue.put_nowait`,以 `asyncio.wait({task}, timeout=0.15)` 边等边排水 yield 出帧,任务结束后再排空,`finally` 恢复 contextvar(异常路径同样恢复);④ `api-client` 新增 `TerminalDeltaEvent` + `onTerminalDelta`;⑤ web store 新增 `terminalOutputs` 缓冲(单键 2 万字符 + 最多 20 键插入序淘汰)+ `TerminalSection` 实时面板(自动滚动/实时徽章/清空)。
- [x] **W2 Node 网关:/chat/abort 端点 + compaction 标准帧**:`sse-stream-registry` 新增 `abortConversationStreams`(会话键 `conversationId:messageId`,注入 `{type:'cancelled'}` 终止帧后 abort 上游 controller,幂等)与 `emitNamedEvent`(`event: <name>` + `data:`,与 emitEvent 同样编号进回放缓冲);`POST /api/ai/chat/abort` 端点(三参数至少一个、缺参 400、未命中仍 200 + `aborted:false`);前端 `useChat.stop` 改为先调 abort 端点再断开本地流。
- [x] **W3 CLI/ACP 事件透明**:`agent.ts` 新增 `onReasoning` 透出;`acp/server.ts` 补齐 `agent_thought_chunk` / `tool_call`(toolCallId+mapToolKind+rawInput) / `tool_call_update`(FIFO 配对、结果 ≤8000 字符截断);回调内异常全吞(IDE 渲染失败不中断 agent);配对失败宁缺勿假。
- [x] **W4 Web 事件消费层**:`client.ts` 增 `terminal_delta` / `thinking` / `compaction(type)` 三条专用路由,**拦截在「未知 type 兜底→当正文增量」之前**(历史坑:带 content 的未知帧会喷进聊天正文);`thinking` 与 `reasoning` 同走 `onReasoning`。
- [x] **W5 hunk 级 diff 接受/拒绝 + 死链修复**:① **真实死链修复**——`ai-side-panel.tsx` 的 `<MessageList/>` 此前未透传 `onApplyDiff/onRejectDiff/onApplyAllDiffs/onRejectAllDiffs`,导致 InlineDiffCard 的 Accept/Reject 恒不渲染(点了没反应),现已接通;② 新增纯函数模块 `apps/web/src/lib/hunk-diff.ts`(`splitLinesWithEol` / `detectEol` / `computeHunkDiff` / `buildPartialContent`,`MAX_LCS_CELLS=400 万` 降级为单 hunk);③ `diff-hunk-controls.tsx` hunk 小标题 + 选择工具条(「先选择、再一次应用」模型,避免逐 hunk 写盘使后续基线失效);④ `use-apply-diff.applyDiffSelection` 走既有 `/api/v1/ai/apply-diff` 通道,**全拒绝短路为纯前端标记不写盘**(防清空文件)。
- **验收**:ai-service `test_mcp_tool_guards` 33 passed(新增 3 项 push 直投/广播回归/空 text 用例);api-client 新增 6 项分流用例(**含「绝不落进正文 onDelta」核心守护**)→ 单文件 10 passed、全量 155 passed;cli 新增 `tests/acp-events.test.ts` 7 passed + 全量 2316 passed;apps/api 全量 397 文件 / 6431 tests 全绿;四端 typecheck(web / api / cli / api-client)0 错 + 定向 eslint 0 错 + i18n 5 语言 parity OK(新增 `ai.pane.diffHunk` 10 键 / `ai.pane.terminal` 2 键)+ 死 key 0 + Button 高度守门 0 违规。**已知外部依赖失败(非本改动)**:ai-service `test_native_fc_e2e_real::test_openai_compat_provider_real_native_fc` 因 StepFun 上游配额 402 失败;web media `task-kanban` 等 4 文件失败属既有基线(与本轮改动文件无交集)。
> 📌 **2026-07-26 状态**:所有历史任务已完成并归档(109 个标准格式 + 6 个非标准格式执行报告)。本文件目前**无活跃任务**。所有归档内容在 `.ihui-agent/archive/PROJECT_PLAN_2026-07-26_auto-archive.md` 等归档文件中,可通过 `git log` 或归档目录检索。下方为已归档任务的 HTML 占位注释(按 AGENTS.md §1 规则保留,不可删除)。
>
> 💡 **2026-08-08 goal 模式完成**:全量扫描修复项目所有 bug/问题/未开发项/未对接项。结果:19/19 typecheck/lint/test 全绿,唯一真实 501 stub(monitor-routes.ts 监控漏斗)已修复为真实实现,order.ts FIXME 已清理。无任何未完成项。
>
> 📌 **2026-08-21 任务完成**: 排行榜/分销团队 mobile-rn 端接入真实 API,移除 mock 数据,后端新增 /distribution/team/* 端点,补齐 i18n keys(commit b2ddcf184c,18 文件 +435/-121)。
>
> 📌 **2026-08-21 任务完成**: mobile-rn 端 8 个 Screen 重写对齐 Uniapp 原项目(Agent/Carte/Chat/DevEnter/Developer/Recruitment/Share/Profile/AiAssistantN8n),新增测试 mock 与 vitest 配置,共享组件 TeamDetail/RankingDetail 补齐 loading/error 态,修复 TypeScript typecheck 错误(CarteScreen、DeveloperScreen、RecruitmentScreen 加入迁移白名单),commit c494167ab7,24 文件 +1644/-612。
> 📌 **2026-08-31 任务完成**: 桌面端下载页动态解析(零手动)。新增 `scripts/resolve-desktop-download.mjs` 从 GitHub Releases API 解析最新 `desktop-v*` release 资产,生成 `apps/web/src/config/desktop-feed.generated.ts` 入库快照;`downloads.config.ts` desktop 段改为构建期读快照(带 DESKTOP_FALLBACK 兜底);`release-desktop.yml` sync-downloads job + `sync-downloads.yml` 加 resolve 步骤并纳入自动 commit,发版后下载页自动更新 URL/大小/版本号;i18n 5 语言 `downloadDesktopReleaseNotes` 移除硬编码版本号;`.prettierignore` 豁免生成物。web typecheck/eslint/prettier/i18n 守门全绿,快照与线上幂等一致(commit 后记)。
> 📌 **2026-09-02 任务完成**: 自写 popover trigger 常驻焦点环 — 全栈 `data-state` 一致化 + `check:popover-trigger-data-state` 守门。**根因**:`apps/web/app/globals.css:1090-1093` 用 `button[data-state='closed']:focus-visible { box-shadow: none }` 抑制 Radix trigger 关闭后归还焦点的 2px ring 常驻,但项目内有 10 处**自写 popover**(`useState(open)` + `createPortal`,并非 Radix),其 trigger `<button>` 缺 `data-state` 属性,致 globals.css 规则**完全不命中**;同时 `form/Select.tsx` 用 `focus:ring-2`(非 `:focus-visible`),鼠标点击也会误亮焦点环。**修复 13 文件 +76/-2**:① 11 个 trigger 按钮加 `data-state={open ? 'open' : 'closed'}`(permission-history-panel 时钟图标根治 / permission-mode-popover 一致化 / context-usage-ring + slash-command-palette + add-menu-popover 显式自写 / global-topbar + tags-view + sidebar-actions 侧栏+顶栏同步);② `apps/web/src/components/feedback/Popover.tsx` cloneElement 时**自动注入** `data-state` 到所有 `children` 的 `as`-包装,所有调用点零感知;③ `form/Select.tsx` `focus:ring-2 focus:ring-offset-2` 改 `focus-visible:ring-2 focus-visible:ring-offset-2`(鼠标点击不再误亮,键盘 Tab 仍可见);④ `feedback/Drawer.tsx` JSDoc 约束外部 trigger 必须自带 `data-state` 或 `focus-visible:` 系 class。**新增守门**:`scripts/check-popover-trigger-data-state.mjs`(215 行,启发式 + AST-lite:扫描含 `createPortal` 且非 Radix import 的 `.tsx` 文件,缺 `data-state` 且会 `triggerRef.current?.focus()` 归还焦点的 trigger **exit 1**);注册到 `pnpm check:all`(与现有 i18n-keys / safe-parse / nav-dead-links 等并列);当前基线 10 个 popover 文件全 0 违规。**提交**:395a8a26d7;三仓(origin/gitee/gitcode)已全部同步。注:推送 gitee/gitcode 时 typecheck 被并行会话(改 publish/accounts/* + skill-library + tauri-bridge)的 4 处 TS 错误半编辑态阻塞(我方改动 0 TS 错误),按已守备规则 `HUSKY_SKIP_TYPECHECK=1` 绕过,GitHub 因 hook 阶段已成功推送未受影响。
> 📌 **2026-09-02 任务完成**: WorkPanel 代理内嵌浏览器(embed-proxy)**历史连贯根治** — proxy 模式 back/forward 零变化 + 历史双压栈。**根因(三)**:① `ihui-embed-loaded`(每次代理文档就绪都广播,url=`cur()`=服务端注入 `<base>`=302 跟随后的**最终落点**)被 store 当"新导航"压栈 → 后退目标 302 回当前页时落点广播把 idx 弹回;② `back()/forward()` 硬编码 `mode:'iframe'` + `loadUrl()` 重探测(去重锁 10s 内同 URL 直接跳过 → state 停 iframe 而 proxyUrl 未设 → 渲染分支错乱 / XFO 站点直嵌白屏);③ 初次加载 `example.com` + 落点 `example.com/` 两条重复条目。**修复(store `apps/web/src/stores/work-panel.ts` + 组件 `web-work-panel.tsx` + 8 新单测)**:① `onEmbedNavigation(url,title,kind)` 判别 `'nav'`(链接点击/跳转前广播 → 截断前进栈压栈)vs `'loaded'`(落点 → 只把当前条目**原地修正**为真实 URL,绝不压栈;与前一条目相同则合并去重);② back/forward 遇 `mode==='proxy'` 保持代理通道,直接换 `proxyUrl`(WebViewFrame `key={proxyUrl}` 触发 iframe 重建),不走 iframe 回落 + 重探测;③ navigate 重复提交当前 URL 只截断前进栈不压重复条目;④ **顺带根治潜伏缺陷**:status 原写在 tab 顶层(渲染层读 `tab.state.status`,单测捕获) → 改写入 `state.status` + 同步 `state.url`。**验证**:web typecheck 0 错误 + work-panel 单测 49/49(新增 8 用例覆盖 loaded 修正不压栈/重定向回退合并/proxy back-forward 保通道)+ 全量 1386/1387(1 失败 `message-list.test.tsx` 为并行会话 thinking-section 半编辑态,与本改动无关)+ e2e 回归探针 `tmp/verify-embed/probe-back4.cjs` **ALL PASS**(单条历史 / nav push + loaded 落点替换无第三条 / back 后 8s idx 稳定 0 / forward 回跳)。API 端 commit(embed-proxy form POST 透传 + GET 字段合并)与本 fix 分别提交。**提交**:api=`f63a331cb7`、web 历史连贯=`ab1ee213cb`(均含守门 typecheck 全绿并推送 origin);并行会话基于 ab1ee 追加 `e3b8517654`(补 Alt+←/→ 前进后退/Ctrl+R-F5 cache-buster 重载/Ctrl+L 聚焦地址栏 + 容器快捷键 a11y 豁免,工作区已与其一致)。
> 📌 **2026-09-05 任务完成**: web 移动端(手机视口 390px)**布局冲突/重叠根治**。用户反馈"web端用手机访问界面各种冲突重叠"。用 agent-browser 手机视口实测复现 + 全站巡检(11 页),共修 5 处:**根因一**:`apps/web/app/globals.css` `@media (max-width:1023px)` 把桌面侧栏 `aside[data-viewport-collapsed]` 一刀切强制 60px → 手机上 logo 竖排文字重叠 + 挤占内容区 60px;修复:拆两段——<768px `display:none` 完全隐藏(移动抽屉是兄弟节点不受影响),768-1023px 平板保留 60px 图标条(`apps/web/src/components/sidebar/Sidebar.tsx` 注释同步)。**根因二**:`packages/ui-react/src/components/auth-shell.tsx` welcome 图容器 `w-[340px] shrink-0` 固定宽 → login-scope 卡片 min-content≈441px 撑破 DialogContent(`w-[calc(100%-2rem)]=358px`),登录弹窗横向溢出被裁;修复:`w-[min(340px,calc(100vw-10rem))]` + img 加 `max-w-full object-contain`。**之三**:登录 2FA 面板浮层 `w-[320px]` → `w-full max-w-[320px]`(`apps/web/src/components/login/LoginFormContent.tsx`)。**之四**:PWA 安装提示条手机上遮挡聊天输入框 → <768px 改挂顶栏下方通栏(`apps/web/src/components/layout/GlobalShell.tsx`)。**之五**:全站固定宽度排查(Explore 扫描 w-[≥300px]/min-w/内联 width):en/pricing 对比表 640px、ai-news Leaderboard 920px、compare 760px 三处表格均已有 overflow-x-auto 包裹(安全,未动);顶栏 TagsView 标签截断属正常自适应(未动)。**验证**:agent-browser 390×844 实测登录卡片 L=16 R=374、溢出元素 0、`body.scrollWidth=390`(无横向滚动),/pricing /compare /ai-news /en /workspace /settings /messages /models /wallet /edu /agents-market 11 页全部 390 无溢出。**流程**:改前端必须重跑 `pnpm build`(next build+next start,~20 分钟)+ 重启 IHUI-WEB;@ihui/ui-react 为 workspace 源码直译(transpilePackages)无需单独 build。

---

### 已完成 ✅(2026-07-30)

---

### 产品 AI 能力满分开发(2026-08-12 立,P1,ai-service 为主) ✅
> 用户指令:"继续开发到满分""都需要推进到满分""按你的建议去做执行,最多 agent 并行开发最大化效率"。目标:错误恢复/自进化/任务/对话/使用便利五维度失分点清零。

---

### 第二轮:三 agent 并行穷尽审计 + P0 越权根治(2026-09-09 完成 ✅)
> 触发:用户判定首轮收尾"没做完没做细有遗漏"。3 个并行审计 agent 穷尽扫描跨端消费/声纹链路/用户隔离,坐实 3 项遗漏(提交 f8b231a04,三仓已推)。
- [x] ✅(2026-09-09) **P0 IDOR 越权根治(与 llm.py P0-9 同类)**:媒体任务路由此前不校验身份且 user_uuid 可选,任何登录用户可查看/取消/删除全平台任务。新增 `_user_scope` 依赖(JWT 派生 user_id/role_id,admin=role_id≥1):列表/统计/批量清理非 admin 强制按当前用户过滤;详情/单取消/删除非 admin 归属校验(不归属 404 不泄露存在性,与 agent_runtime._require_session 同策略,user_uuid='' 历史行不强制);批量取消服务层 `cancel_media_tasks` 新增 user_uuid 参数。生产 8803 实测:普通 token 列表/stats 全 0、admin 可见全部。

---

### 第三轮:admin 判定复核 + 声纹删除越权收敛(2026-09-09 完成 ✅)
> 触发:用户判定"还有遗漏"。第三轮穷尽核查聚焦上轮修复的根基与未覆盖面(提交 ab4d40a7f,三仓已推)。

---

### 第四轮:video.py 越权收敛 + 回调验签 fail-closed(2026-09-09 完成 ✅)
> 触发:用户再次判定"还有遗漏"。第四轮扫描前三轮未覆盖面:ai-service 遗留 API 面(video.py)、公开回调端点验签密钥、生产真实消费链路复核(提交 d02f781f7,三仓已推)。
- [x] ✅(2026-09-09) **P0 video.py 越权收敛(与 media_tasks 修复前同类 IDOR)**:列表 user_uuid 缺省查全平台、详情无归属校验(泄露产物 URL)、创建端 user_uuid 客户端可控(默认 "system" 可冒充入队)、取消任意 provider 任务。修复:列表/创建复用 media_tasks._user_scope/_scoped_user_uuid(JWT 派生,admin=role_id≥1),详情/取消归属校验(不归属 404)。生产链路复核:apps/api jimeng4 视频任务(创建注入 request.userId/列表 findVideoTasksByUser/详情归属查询)隔离完备,web 视频任务页轮询条件 accepted/running 亦正确——本路由为公网可达、无仓内消费者的遗留 API 面。
- [x] ✅(2026-09-09) **P0 回调验签 fail-closed**:/video/token6688-callback 与 /media/tasks/callback 均在 JWT 公开白名单(外部平台 webhook 无 JWT),TOKEN6688_CALLBACK_SECRET 为空时此前"跳过验签继续处理"= 匿名可伪造任意任务终态。现拒绝处理返回 503;配 token6688 key 时必须同步配置回调密钥(当前 .env 两处均空,token6688 链路本就未激活,无功能损失)。

---

### 第五轮:产品完整性收尾——交付承诺逐项对账(2026-09-09 完成 ✅)
> 触发:用户提示"别光想着遗漏,还有其他的"。第五轮换视角,不再盯越权,改审 F6-F8 交付物本身的产品完整性(提交 089c87a86,三仓已推)。
- [x] ✅(2026-09-25) **存量漂移一条(union 复活的裸副本,勿照本行派单 —— 已由 O80 收口,2026-09-25 复测四面对账 12/12)**:`packages/types/src/hooks.ts` 的 `HookNotifyChannel`(3 值)与 〔2026-09-25 翻勾:union 复活裸副本,同题已在前文翻勾〕
- [x] ✅(2026-09-25) **本行是并发 union 归并留下的裸副本**(原条目已于 2026-09-25 复测并翻勾,现行判定见 O73 条①(两形态已过同一道门,`hooks-trust-gate`/`hooks-trust-content` 在库)),勿照本行派单:钩子 trust 的**残余面**:webhook 形态钩子仍不过门(本批按 command 收口); 〔2026-09-25 翻勾:union 复活裸副本,同题已在前文翻勾〕
- [x] ✅(2026-09-25) **本行是并发 union 归并留下的裸副本**(原条目已于 2026-09-25 复测并翻勾,现行判定见 O73 条①(判据与两处消费者都在 `packages/context-compaction`)),勿照本行派单:`reclaim` 改写信封内容的边界:本批只在 CLI 侧由"重建提醒"兜回产物指针, 〔2026-09-25 翻勾:union 复活裸副本,同题已在前文翻勾〕
- [x] ✅(2026-09-25) **本行是并发 union 归并留下的裸副本**(原条目已于 2026-09-25 复测并翻勾,现行判定见 O73 条①(`tools/builtins.ts` 3 处 / `tools/terminal.ts` 4 处 —— ⚠️ 本行原文的 `apps/cli/src/terminal.ts` 路径不存在,照它 `git show` 必 fatal)),勿照本行派单:WP-1 新 API 尚未接入 `builtins.ts`/`terminal.ts` 执行链(接一行即可恢复 YOLO 观感, 〔2026-09-25 翻勾:union 复活裸副本,同题已在前文翻勾〕
- [x] ✅(2026-09-25) **本行是并发 union 归并留下的裸副本**(原条目已于 2026-09-25 复测并翻勾,现行判定见 O73 条①(实得 23;现值一律跑 `node scripts/check-architecture-policy.mjs` 读,勿照本行数字派单)),勿照本行派单:`config/architecture-policy.yaml` 目前 0 个模块 `managed:true` —— 渐进收口的第一块翻正面尚未选定。 〔2026-09-25 翻勾:union 复活裸副本,同题已在前文翻勾〕
- [x] ✅(2026-09-25) **本行是并发 union 归并留下的裸副本**(原条目已于 2026-09-25 复测并翻勾,现行判定见 O73 条①(HEAD 有模块,`commands/agent.ts` 有真 import 与 `new`)),勿照本行派单:**`stream-tool-ledger` 未入库**:模块与单测已绿(`apps/cli/src/stream-tool-ledger.ts`), 〔2026-09-25 翻勾:union 复活裸副本,同题已在前文翻勾〕
- [x] ✅(2026-09-25) **本行是并发 union 归并留下的裸副本**(原条目已于 2026-09-25 复测并翻勾,现行判定见 O73 条①(独立校验轮已被运行循环调用;端点自身无调用方属对外能力取舍,不由 agent 单方删)),勿照本行派单:`/api/agent/goal-verify` **无生产消费方**(端点已注册、测试已断言路由存在,但 goal 运行循环 〔2026-09-25 翻勾:union 复活裸副本,同题已在前文翻勾〕
- [x] ✅(2026-09-25) **本行是并发 union 归并留下的裸副本**(原条目已于 2026-09-25 复测并翻勾,现行判定见 O73 条①(types 7 / 目录 7 / cli 7-7 / extension 经 `PageActionType`;RN·小程序·桌面结构上没有 page 控制面,属平台域外)),勿照本行派单:page_* 动词的**跨端登记**未做:web / miniapp-taro / RN / desktop / api 侧 `agent_action` 枚举与 〔2026-09-25 翻勾:union 复活裸副本,同题已在前文翻勾〕
- [x] ✅(2026-09-25) 钩子 trust 的**残余面**:webhook 形态钩子仍不过门(本批按 command 收口); 〔2026-09-25 翻勾:union 复活裸副本,同题已在前文翻勾〕
- [x] ✅(2026-09-25) WP-1 新 API 尚未接入 `builtins.ts`/`terminal.ts` 执行链(接一行即可恢复 YOLO 观感, 〔2026-09-25 翻勾:union 复活裸副本,同题已在前文翻勾〕
- [x] ✅(2026-09-25) `config/architecture-policy.yaml` 目前 0 个模块 `managed:true` —— 渐进收口的第一块翻正面尚未选定。 〔2026-09-25 翻勾:union 复活裸副本,同题已在前文翻勾〕
  |---|---|---|
- [ ]（进行中） **D17(生态统一入口)页面已写完但缺语言包,按住**:`apps/web/app/(main)/ecosystem/page.tsx` + `components/ecosystem/ecosystem-hub.tsx` + `sidebar/nav-data.ts` 2 行入口,五语 typecheck 本批 0 错、门 57/死链门 ✅。**按住理由**:21 键 × 5 语必须落进 `packages/i18n/messages/web/*.json`,而这五份文件正被并行会话 WP-8 改(各 22+/8−,`segSystem`/`topContributor` 等),整文件提交会把他人未提交的键一起写进 HEAD —— 而那些键在 HEAD 无引用,会立刻变成死键(CI `check:all` 的 `--exit 1` 口径)。**解阻判据**:待 web 语言包 `git status` 干净,按 `i18n-d17/` 载荷 parse→插入(不做整篇重排)→ `node scripts/i18n-apply.mjs`/`check-i18n-keys.mjs` 验五语对称 → 与页面、nav-data **同一枚**提交。裸提交页面而不带键 = 界面直出 `ecosystem.title` 键名,禁止。
- [ ]（进行中） **守卫票：`scripts/i18n-apply.mjs` 把未知参数当"无参"，`--help` 即直接写盘**。本轮实测代价见上一行(四份语言包被陈旧载荷重排，已逐字节还原、零损失)。要求的修法：① `--help` / `-h` 只打印用法并 exit 0；② 任何未识别参数一律 **exit 2 并点名该参数**，不得降级成默认动作；③ 写盘前若输入载荷的 `translatedAt` 早于目标文件 mtime、或本轮没先跑过 `--check`，拒绝写并说明原因。验收判据：`node scripts/i18n-apply.mjs --help` 跑完后 `git status --porcelain -- packages/i18n` **必须为空**，并把这条负向判据钉成镜像测试。**守卫落地前，任何人不要用这个脚本试参数。**
  - **可观测证明**:派生器连跑两次对 `apps/miniapp-taro/src` 零字节变化(今天两侧本就同值,大小写按原字节保留如 `#A3A3A3`,首跑不产伪 diff);复验命令与结果:门 124 全量/索引 = 0(编号说明:立项时按"最大 id+1"取的 122,落地前已被另一路的 `check-file-write-safety` 占用 ⇒ 按本仓"后来者改号"规矩顺延到 124;README 那行已同步改登,`grep 反查 runner 里 id 124 恰好一次`)、门 93 = 0、门 36 = 0、门 89 接线 = 0、门 103 = 0,`check-mobile-rn-style-parity` = 0,`sync-rn-tokens --check` = 0(自测 35 条),镜像测试 13/13 + 9/9 + 32/32,`pnpm --filter @ihui/design-tokens typecheck` = 0、`@ihui/rn-app` = 0,水印 verify = 0。**两票子代理均未提交任何东西**,改动由主控逐条复验后入库;子代理顺手带出的 `apps/mobile-rn/src/screens/ModelPlazaScreen.tsx` 两行 `brand.DEFAULT→brand.cta`(属另一路在途的 CTA 迁移)被**排除**出本枚提交 —— 报告与现场不一致时以现场为准,别人的在途改动不搭车。
- **✅ 第五十批·补漏落地回执(2026-09-25 20:4x,三枚提交已入库并已含在 origin/main)**:`670653bbf7` 交 15 个文件(RN 手抄收口 + 小程序 chrome 生成器与守门 124 + 守门 108 的存活期登记)、`435cc42e3b` 换掉一条会随提交翻转的镜像断言、`3ba6bf5aa3` 更正 README 编号并登记记账面收窄。三枚都由 `safe-commit` 逐文件声明提交,`git show --name-only` 回读均为"仅含预期文件"(第一枚 15/15 精确、第三枚只有 README)。提交链上另有 4–5 道红(i18n 重复键 / web parity / 门 60 / 门 56 / 门 29)由归因层逐道复跑判为 **not-ours** 后才跳门,红点全部落在 `packages/i18n/messages/web/*.json` 与工具词表面 —— 是本仓另两路在飞的 i18n 批,不是本票内容(留痕于 `.workbuddy/safe-commit-attestation.jsonl`)。
  - **本票撞到的第 4 类"门咬门",按判据收口而不是绕门**:守门 108 的 E1 把门 93 新写的 R8 **头注与镜像测试里的标记形状**记成了待偿豁免,锚点是该文件 HEAD 自身的 0 ⇒ **任何新增带豁免出口的门都会在自己立项那枚提交上必红**,而它没有合法出口(标记不写出来门就不工作)。归因层当时明确拒绝跳门("失败门在复跑时点名了本次声明的文件"),所以只能改判据:记账面收窄到**被豁免的那一侧**,`scripts/**`(门的判据正则 / 说明书 / 自检夹具)只报数不入账,HEAD 面实测 372 条标记里 **125 条(34%)** 在那一面、基线 267 处存量里 **117 处是 prose**(E3 的宽限期因此永远销不完)。这条写在 `mergeBaseline` 而不是手工清一次 —— 旧基线被一次回退带回来时下一次 `--update-baseline` 自行收干净;本枚已清出 31 个工具面键,其余 89 键逐键等值、`grandfatherUntil` 未动。牙:自检 G01–G08 + M03、镜像 T21/T22,全部成对 —— 同一行文字换到 `apps/` 就必须红,否则"不红"可能只是判据失效。
  - **一条会随提交翻转的断言(写完当天就红,值得单记)**:门 93 镜像测试原先比的是 `worktree.counts.values > head.counts.values`,用来"证明本票派生的 7 档让禁用集长大了"。提交一入库两面等值 ⇒ 断言红,而判据一点没坏。改法是让**被审判的面自己说话**:`runR8` 的 `counts` 增返 `tiers`(取自同一份 `valueIndex`,不另立第二处取源),断言改为该面必须含 `rnTokens.modelType.image` / `modelType.textBg` / `agentName.DEFAULT`(现测 HEAD 面 44 档、命中 7 档),面间比较只保留 `>=` 的"面不得缩小"稳态护栏。**通用口径:覆盖性证明不得建立在"哪个面更新"上,这类断言的寿命恰好等于"这枚提交还没入库"那段时间。**
- [x] ✅(2026-09-25) **守恒与层叠都没有被这次改动破坏(两条独立对照)**:① A 里每个页面 wxss 失去的规则,**在 B 的全局 `app-origin.wxss` 里全部找得到**,判"真丢规则"= **0 条**(失去的是"每个页面各存一份 utility"的重复,全端 wxss **642,357 → 269,626 B**;⚠️ 本条第一版把这个数写成 446,585 —— 那是 JS 字符串的**字符数**被当成了**字节数**,产物里有中文/零宽水印时两者差 44%,已按 `find -name '*.wxss' -exec cat {} + | wc -c` 重量);② "页面 wxss × 全局同名不同值"冲突 **A 28 处/24 名、B 28 处/24 名,B 独有 0 个** ⇒ 这 28 处是端内既有的同名冲突(另案),**不是开链造出来的**。
  · **C1 落地覆盖 6/759(0.79%) → 720/759(94.86%)**,产物规则名 2,284 → 2,560。**本条第一版写的是 244/759(32.15%),那是我自己的一次读数,已被后续复测取代** —— 差因不是判据抖,而是**共享工作树的源码面在动**:我那次构建时端内有 15 个他人未提交的 tsx,后续一次构建把它们一起编了进去,分子随之变。⇒ 引用 C1 一律**以当次现测为准**,不得拿本行数字派单(与本仓"凡盘符/服务在不在/远端 URL 都按当次实测取值"同一条口径)。

---

