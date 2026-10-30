<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

> ⚠️ **Copyright & Commercial Licensing Notice**
>
> © 2026 **IHUI AI (智汇AI)** · Copyright owner: **Li Chunchuan (李春川)** · https://aizhs.top
>
> - Dual licensing: open-source use under **Apache-2.0** (copyright notice and NOTICE must be retained); **closed-source commercial use, rebranding, or SaaS resale** requires a separate commercial license.
> - All source files in this repository are embedded with provenance watermarks (visible banners + invisible zero-width steganography; verify with `node scripts/watermark.mjs decode <file>`). Removing watermarks does not change copyright ownership; unauthorized commercial use is technically traceable and legally actionable.
> - CI enforces watermark verification (`pnpm watermark:check`); any change that strips watermarks fails the build.

# IHUI-AI

<p align="center">
  <img src="apps/web/public/images/logo.png" width="140" alt="IHUI-AI Logo" />
</p>

<p align="center">
  <strong>Online Demo</strong> · <a href="https://aizhs.top">https://aizhs.top</a> &nbsp;|&nbsp; <strong>GitHub</strong> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI">Star this repo</a><br/>
  <sub><strong>Self-hosted full-stack AI platform</strong>: model gateway + Agent orchestration + multi-tenant business backend + 8 frontend ends · Apache 2.0 · Fork to production in 5 minutes</sub>
</p>

<p align="center">
  <sub>
    <a href="README.md">简体中文</a> · <a href="README.en.md">English</a> · <a href="README.ko.md">한국어</a> · <a href="README.ja.md">日本語</a>
  </sub>
</p>

---

> **This file is an index only.** As of 2026-09-30 the root README is an index layer: positioning,
> live-computed numbers, quick start, and entry points into nine topic documents. Every capability's
> full rationale and evidence lives, verbatim, in the nine archive files under
> [`docs/engineering/`](./docs/engineering); the authoritative engineering rulebook is
> [`AGENTS.md`](./AGENTS.md).

## What it is

| Dimension   | Description                                                                                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| In one line | Self-hosted full-stack AI platform: model gateway + Agent orchestration + multi-tenant backend + 8 frontend ends                                                |
| Backend     | `apps/api` — Fastify 5 + Drizzle ORM + PostgreSQL + Zod (TypeScript)                                                                                            |
| AI service  | `apps/ai-service` — FastAPI + LangGraph + LiteLLM + MCP (Python)                                                                                                |
| Frontends   | Next.js 16 + React 19 + Tailwind 4 + shadcn/ui (web), Taro 4 (mini-program), React Native + NativeWind (app), Tauri 2 (desktop), WXT (extension), Node.js (CLI) |
| Data        | PostgreSQL (row-level security, multi-tenant) + pgvector vector search + Redis                                                                                  |
| License     | Apache-2.0 (copyright notice and NOTICE must be retained; source files carry provenance watermarks)                                                             |

Full positioning narrative (value pyramid, cost comparison, differentiation, benchmark categories):
[`docs/engineering/readme-01-positioning.md`](./docs/engineering/readme-01-positioning.md).

## Key numbers (live-computed)

**These numbers are not hand-copied.** The single algorithm lives in
[`scripts/gen-doc-numbers.mjs`](./scripts/gen-doc-numbers.mjs), which counts from real sources
(schema code, route registrations, locale directories, compose manifests...). The gate
[`scripts/check-doc-numbers.mjs`](./scripts/check-doc-numbers.mjs) re-computes them for this file and
the Chinese README, and blocks any stale value.

Headline claims (same source as the table below, all live-computed): **611 tables · 4600 API routes ·
25 WebSocket endpoints · 99 catalogued LLMs · 38 platforms auto-publishing · 3544 test files ·
273 engineering gates · 50 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
14 compose services**.

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 612 | `dbTables` |
| schema 文件 | 237 | `dbSchemaFiles` |
| API 路由 | 4614 | `apiRoutes` |
| 路由文件 | 650 | `apiRouteFiles` |
| AI 服务路由 | 611 | `aiServiceRoutes` |
| WebSocket 端点 | 25 | `wsEndpoints` |
| 入库模型清单 | 100 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 16 | `sharedPackages` |
| CLI 命令文件 | 67 | `cliCommandFiles` |
| CLI 工具文件 | 72 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 3597 | `testFiles` |
| CI 工作流 | 50 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 299 | `guardianGates` |
| — blocking | 273 | `guardianBlocking` |
| — warn | 28 | `guardianWarn` |
| 跟踪文件 | 17673 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-30。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-30**
- 🐞 Fix:树选择器的节点键盘与读屏都到不了 —— 补可聚焦与选用键位 (79a6235cd43)
- 🐞 Fix:取面超时不再冒充"判红" —— 两门补 try/catch,统一走 exit 2 未判定 (5bf00f08c73)
- 🐞 Fix:trace onError 补 method/url + 补 AGENTS.md 里唯一漏点名的只读尺子(消 R4 存量红) (5b7dcb5e405)
- 🐞 Fix:设置页"消息通知"开关只写本机、全仓无人读 —— 用户以为关了推送,服务端照推 (612ffd55800)
- 🐞 Fix:设置页三个通知开关拨完只改内存(离开即复位);日志查看器不足折叠阈值时仍是可点按钮 (b88da069e86)
- 🐞 Fix:代理失败把上游原文(整屏 HTML/内部 JSON)直接显示到侧栏提示条 (2c7a1c41904)
- 📚 Docs:AGENTS.md 体积清偿(110428→94887)+ 安全文档对齐代码现状 (9b7a3f476a2)
- 🐞 Fix:代理失败把上游原文(整屏 HTML/内部 JSON)直接显示到侧栏提示条 (0a6a1168c33)
- 🐞 Fix:四页下拉刷新只转圈不刷新 —— 关掉没有处理函数的开关 (4393200ed47)
- 🐞 Fix:课程页签到/评价/笔记只弹"成功"、一个请求都不发(笔记会丢用户输入) (8396a002da8)
- 🐞 Fix:托盘「检查更新」可能整场无反应;树选择器缺展开语义且禁用后面板仍可点 (acff087465b)
- 🐞 Fix:相册权限被拒时三屏点了没反应 —— 缺权限前置判断 (272361f262c)
- 🐞 Fix:消息页「赞」「收藏」两个分类永远只显示技术错误 —— 请求了一个后端不存在的类型 (2e8d0827934)
- 🐞 Fix:修 next build 的 CSS 解析失败(0x1A)—— 把构建产物目录移出 Tailwind 扫描面 (5de6f58c2f0)
- 🐞 Fix:交卷后成绩页五项读数全 0、题目回顾空白;优惠券切 tab 双请求互相竞速 (a9d80ed0c18)
- 🐞 Fix:"我的"页四张入口卡与收藏夹前三条全是死链,消息中心"互动"tab 还在显示编造的演示消息 (7fac7d5205a)
- 🐞 Fix:"我的"页四张入口卡与收藏夹前三条全是死链,点了毫无反应 (7b2c7e8be5b)
- 📚 Docs:存续哨兵入档,并消除我自己造出的 §10.9 撞号 (1724d77d3e1)
- 🐞 Fix:侧栏闲置后 access token 不再自动续期 —— 续期闹钟的监听随服务工作线程回收而消失 (e3927a3c768)
- 🐞 Fix:复活 ApiSlowResponse —— 指标名少一个 _ms,这条告警结构上永不触发 (f6d7dbd58d8)
- 🐞 Fix:日历拖拽改期会静默吞掉发布时刻,时间格式又写死中文档 (9a821a58230)
- 🐞 Fix:发布分组展开会显示上一组的成员,误点即删错账号;保存中弹层三条出路被同时锁死 (9ce8ae4c599)
- 🐞 Fix:PDF 首片空白、直播黑屏永久转圈、上传整批被一个超限文件带崩、发布插图被回吞 (3961c9390e7)
- 🚀 Feature/Improvement:给源站回源鉴权装存续哨兵(只读尺子 + 巡检派发腿) (e6cd4ca32f6)
- 🐞 Fix:兜底闸 enforce 误拦 18 条公开面 —— 逐条按语义补名单(P0) (70d2bba8ebe)
- 🐞 Fix:上传"取消/移除"是假的、后台数值留空被写成 0、两处失败静默,外加全站气泡箭头被裁 (1c771ee4fdd)
- 🐞 Fix:WS 客户端 baseUrl 统一走 resolveWsApiBaseUrl,修生产同源 WS 无限重连 (f071844acd5)
- 🐞 Fix:反馈入口全端死路、订单切 tab 读旧筛选、支付可连点、发布失败静默 (7b95329ba0f)
- 🐞 Fix:订单列表首帧整页崩、账号注销 0% 可用、支付记录开出 0 元单等五处 (72d17ce94d6)
- 🐞 Fix:买课/交卷/提问/报名四处与后端请求契约错配,外加两处造出假红的工具面 (1ae7d3bd0c6)

**2026-10-30**
- 🐞 Fix:反馈入口全端死路、订单切 tab 读旧筛选、支付可连点、发布失败静默 (7b95329ba0f)
- 🐞 Fix:订单列表首帧整页崩、账号注销 0% 可用、支付记录开出 0 元单等五处 (72d17ce94d6)
- 🐞 Fix:买课/交卷/提问/报名四处与后端请求契约错配,外加两处造出假红的工具面 (1ae7d3bd0c6)

**2026-10-30**
- 🚀 Feature/Improvement:移动端订单详情补三条文案(五语言同批) —— 破坏性动作要能问、失败要能喊 (738b4492d56)
- 🐞 Fix:提现页接上真实校验原因与余额上限,会话历史搜索改走服务端 (3e505b8b8f2)
- 🚀 Feature/Improvement:提现页补四条校验原因文案(五语言同批) —— 报错不得再只写字段名 (aeef0ecc26e)
- 🐞 Fix:深度排查前端缺陷第二批 —— 注销/2FA 关闭补请求体,富文本三连,失败不再冒充空态 (f0a0ffa77b8)
- 🔧 Chore/Other:移除 knowledge 鉴权里的推断性注释(500 已定位为生产副本未更新) (82fe24c50f4)
- 🔧 Chore/Other:对齐 TOTP 默认档钉子到 enforce —— 修一条已入库的红测试 (20bf9852703)
- 🐞 Fix:服务清单器三处裸 $n 内插根修(RegistryKey.ToString() 返 HKEY_LOCAL_MACHINE 全串⇒真服务全 continue,修前 exit 0 而 services:[])+§0.3「枚举到0个⇒exit 2 未判定」硬闸(T| 分三种0)+生产者形状锁 bareRegistryVarHits;自检 20/20 含改回必翻红成对对照;本机现读 3 枚在册服务零入库真相源,反向 8 枚仓内点名本机不存在 (13c78b14fc2)
- 🐞 Fix:登记表 4 条抢键条目 rn 置 null —— 撞键 5 组收到 1 组,3 个路由名改回真渲染者的页 (b608ba35c3c)
- 📚 Docs:补回上一枚被 bash 命令替换吞掉的门名(守门133 check-i18n-locale-content-language)——反引号串在双引号里被当命令执行,文件名成空 (892b1ff31f6)
- 📚 Docs:更正 §19 假陈述——CJK三族互判与同名自套两层"现无门/人工必查"不成立,守门133 check-i18n-locale-content-language 已 blocking 装车(runner:3737);依 g34-s6 一手读数 (41a0dcebb42)
- 🐞 Fix:结清 G-37 三件事(35枚JSON parse全OK+四道i18n门全绿+CJK互判/同名自套真命中0;133已装车判这两型;看门狗与构建指纹双向消费均在HEAD)——同行清除F11禁桶措辞 (dbb46a7792f)
- 📚 Docs:把 SDK 票漂开版的两个独有记号折进当下行(G-23 与释放注记) —— 为归并做零丢失前置 (55877ff48d9)
- 🐞 Fix:结清G-16(别名+类臂两维已落地)/G-14(svc run脚本已入库+E1真装audit)/G-07(清偿器落地前自查已接)/Esc层栈协议5份副本(单实现+50消费方+23用例+CI 692通过) (d6a4f00558e)
- 📚 Docs:给24枚占位符作用域票补出真实落点(只搬票面正文已点名、但未加反引号且在HEAD存在的路径,零编造)⇒ 派单器可对它们发互斥合格证;勾选/租约/归属三维逐行不变 (93e0ae4653b)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (d2269d7feab)
- 🚀 Feature/Improvement:hook-failed 帧契约 + api-client 解析 + store 落桶(G-87 补链,端侧半) (f41cdcad580)
- 🔧 Chore/Other:块级窗口判据主文件 prettier 格式对齐(语义零变化) (f745178ed83)
- 🔧 Chore/Other:test (eb848ead6b8)
- 🔧 Chore/Other:b76-15 三文件 prettier 格式对齐(语义零变化) (be7ba525d55)
- ♻️ Refactor:孤儿护栏一接一退 —— check-immutable-guard 补 --audit-new(每枚判恰好一次,六态封闭)由 git-guardian 旁路派发(5min 节流/breach 才到人,不挂提交链不堵门);check-guardrail-hashes 退役(与 root-guard 同三目标同机制、基线件从未入库致 --verify 恒 exit 2,接线即 §0.6 重复实现装上车) (b2c05e4493a)
- 🐞 Fix:gen-rn-compat --write 重写 route-map 时 100% exit 2 根修(共享树瞬时句柄争用 errno -4094 不重试且把原因截成命令本身)⇒ 走 lib/atomic-write 唯一出口+退避重试+回读自证 payloadIntact+stderr/errno 点名;镜像 N1-N5,15/15 (b4bb4d01d70)
- 🔧 Chore/Other:路由表随登记面重生成 + RN 测试替身收两处局部复刻 + 硬编码中文基线下调一枚 (3b76e9adf5b)
- 🐞 Fix:有意还原被 9fdbc207ba 当残件删、6d0dbde7c9 只带回消费行的门234纪元声明面 ⇒ --staged/--worktree 不再 ReferenceError(此前 blocking 门在 pre-commit 面等于不存在);恢复 A1 身份维+孤儿 identity 形参接回 judge;侧车签名折算按取证收掉(接回即造 rotn=17 假阳恒红);回归锁:真跑 --staged + 变异反证,镜像 17/17、自检 26/0 (d17a1f6c74f)
- 🐞 Fix:前向重放首页收口那一刀 —— 它被 ffbe506f9e 的整文件重放抹掉,商品族堆叠在 main 上已复活 (e118488e7a0)

**2026-10-29**
- 🚀 Feature/Improvement:「已 accepted 未投影」账本 + 空响应权威答案兜底 (02bdf74496f)
- 🐞 Fix:结清11枚已实现票(告警去重身份/票60多窗格/G-878原生弹窗/D11语音barge-in/G-1222556 CSRF形状/成本熔断/影响面隔离/进化回流/监控大屏/O68就绪门 等,g33 t2t3逐条一手凭据) (e7f79cf7aef)
- 🚀 Feature/Improvement:帧水位事实上报的端内唯一消费点接线(对标 Qoder 借鉴清单第 6 项) (fc66ffaf0d7)
- 🔧 Chore/Other:侧车经三条官方出口整份重建(258→155行):--dedupe 60条同键多份→--retire-orphans 43键退场(28条逐字留痕)→--reclassify G-115改归机主git收敛面;rot 58→40/conflict 40→0/dup 6→0/blind 5→0;非手改jsonl,逐行处置见 g33-s10 报告 (68029830b1b)
- 🐞 Fix:登记表 17 处 rn 错写批量回正 + 补一条两代屏共用映射 —— 小程序 15 个路由名从"点了不动"变可达 (5aebbb02a83)
- 🐞 Fix:结清不可变护栏(root-guard已fail-closed接部署环)/B02(双轴+review+sse契约四落点齐) (86bb156b212)
- 🐞 Fix:结清 B03(双轴类型+consumers+守门68对账齐)/G-965(投影与强制档均已落,门234已blocking) (7d8ec7325f4)
- 🐞 Fix:结清四票(207第二刀declaredDropCaps已接/G-1222558四格已达成/68-RN腿三函数同值/圆角基线前提腐烂) (eb87981ee5e)
- 🚀 Feature/Improvement:帧水位接成有生产点的完整腿 + 静态长文档块级虚拟化（对标 Qoder §2 / §6.6） (efcb3c85735)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f72df75e510)
- 📚 Docs:摘除 SDK 票同题跨号重复登记副本(代裁) —— 它正挡着全仓推送收敛 (afeb6ed2988)
- 🚀 Feature/Improvement:补 ai.pane.hookFailures 五语言词包(38 键 x 5) (ffdf6e88079)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (888be1ba64a)
- 🔧 Chore/Other:重封 root-guard 清单到已入库的 guardian-runner 内容 —— 三处签出的部署环此前全部 fail-closed (58f51477c1f)
- 🚀 Feature/Improvement:补 ai.pane.hookFailures 五语言词包(38 键 x 5) (40206d8ec6b)
- 🐞 Fix:装悬空提交备份腿到弃落出口(四台落地器共用一份 lib)—— 门 30a 存量从此有排水口 (4468747144b)
- 🐞 Fix:折叠漂开副本族(N→1,认领合并到保留行 + 逐字留痕;--fold-drifted-families) (cd90c6ea1d0)
- 🚀 Feature/Improvement:视频卡片补齐 分享/复制链接/下载 三个动作 —— 对话框内媒体产物可带走 (06b0c509188)
- 🐞 Fix:注册页倒计时改走取词 —— 此前 en/ja/ko/zh-TW 用户看到的是"12秒后重新获取" (7a25781c112)
- 🐞 Fix:结清 G-706 —— apps/cli/src/worktree.ts:570-576 已用 mkdir EEXIST 当原子互斥(不做 existsSync 预检关 TOCTOU),marker 齐备 reused:true、不齐证明不了即保留不删 (5bfdae44b73)
- 🚀 Feature/Improvement:对标 Qoder 借鉴清单第 9/10 项 —— 准入回执配对(inputId)+ 命名错误码分类处置 (ef471e56a9e)
- 🐞 Fix:补齐端内在用而词包查无的 8 枚键 —— 这些界面在非中文语种下一直出中文 (fe13f15ab80)
- 🚀 Feature/Improvement:跨端生成器对同 rn 撞键出声 —— 静默后写覆盖从此可见 (6e712dc3ef8)
- 🐞 Fix:幻影漂移对齐补"活工作二审"—— 恢复历史内容不再被当陈旧副本回滚 (aac2e1af870)
- 🚀 Feature/Improvement:hook 执行失败六态卡接车（数据面待接） (fe687a03820)
- 🐞 Fix:回补误摘的 G-322 行(该票未完成:旗标单源已接的 11 文件已满探针,另 77 站待迁) (ab52c91d87f)
- 🐞 Fix:结清 O01(对照面空判未判定)/G-79(38枚红现读全绿)/G-927(票面9枚已清零,新增21枚另记) (a079c9d7c46)
- 🐞 Fix:check-task-claims --twins 对照集为空时落「未判定」exit 2(不再把"没得比"报成已清零)+ twinsFace 键 + T26/T26b (7406e957481)
- 🔧 Chore/Other:清两族存量测试红 —— skills-market 的 mock 层错位 + 块合并用例沿用旧判据 (65654e57cd6)
- 🚀 Feature/Improvement:语义折叠策略 + 工具摘要计数上屏(对标 Qoder 借鉴清单第 4 项) (66cf1b45b27)
- 🔧 Chore/Other:补齐 plan-fields-project --emit 坏值探针(11/11 全覆盖) + G-79 38 枚红逐条复检取证(现读 514/515 绿,唯一失败不在票面) (b8949cf8d75)
- 📚 Docs:供应商名单补 xai —— 名单项数与计数 18 长期不符,补上后自洽 (3d2895666d2)
- 🐞 Fix:前向修复 9fdbc207ba 整树收编事故 —— 恢复两条被删能力 + 收口 19 处裸 create_task (cd5339a7607)
- 🐞 Fix:结清五票(G-926 ignored雷区已清零/D42046审批重放A档已落/monitor面板/O87g守门8/上游模型双写对账) (eb28653c902)
- 🔧 Chore/Other:补 @ihui/shared 子路径别名与替身出口 —— 六枚套件从账面通过变真跑出用例 (f1560a322ec)
- 🚀 Feature/Improvement:上游模型登记器与 workbuddy 同步器双向归属对账(跨路径 provider 抽取 + assertOwnership 前置守卫 + 只读 --check) (cdef20f80d3)
- 🚀 Feature/Improvement:三处「造好没装车」接上生产渲染路径 (15cd3b6eb32)
- 🔧 Chore/Other:摘除两枚误入库的工具会话导出附件(1.8MB,含凭据行;工具产物不入库,盘上副本保留) (34036e6a83d)
- 🚀 Feature/Improvement:十态轮次状态徽章接线 + 错误码目录首次进屏幕 (651cb924c0b)
- 🐞 Fix:结清 45 枚前提腐烂/已实现票(批3/3,g30 七席只读分诊逐条一手证据) (2d2bceb2c2a)
- 🐞 Fix:重生成小程序路由表 —— 商店跳板回正,并补出 Home/HomeMain (b439ca6e69d)
- 🐞 Fix:结清 46 枚前提腐烂/已实现票(批2/3,g30 七席只读分诊逐条一手证据) (13b4f3b3603)
- 🐞 Fix:结清 46 枚前提腐烂/已实现票(批1/3,g30 七席只读分诊逐条一手证据) (900afc860c4)
- 🐞 Fix:小程序路由表把「AI 应用商店」错指到首页镜像壳 —— 登记表 rn 撞号根治一枚 (8fa01c3233d)
- 🚀 Feature/Improvement:中文全角括号 autolink 修正 + Diff 过期诚实说明 (3f9d52d6443)
- 🐞 Fix:副本归并器物有意还原 1fe3a2b42d 对 plan-copy-row-purge 的 -790 行回退(④c 判据层,HEAD 测试 SyntaxError)+ 接线 21/21;修正 s12 测试件重复函数名 (65f63112c2d)
- 🚀 Feature/Improvement:中文全角括号 autolink 修正 + Diff 过期诚实说明 (d9aa4637b22)
- 🔧 Chore/Other:更正跨端对账基线里 IntelligentAssistant 豁免的叙述 —— 生产调用方 4 枚减为 3 枚 (48c9c5545ad)
- 🔧 Chore/Other:摘 home.recommendCourses 五语言 —— 首页横向推荐列表已下线,键随之零消费者 (0c935a0192f)
- 🐞 Fix:取消信号穿进 hook 调用点 —— 有意还原 9fdbc207ba 当残件删掉的两处 _wait_interruptible 包裹(969d74b9a6..HEAD 对该文件仅 9/32 行差异,已逐行核对) (8a8ff1f65fe)

**2026-10-29**
- 📚 Docs:鉴权兜底闸已切 enforce，补记 12 条裸奔发现与蓝绿踩坑 (6df1c8efdc3)
- 🐞 Fix:enforce 档抓出的两条合法公开面补进名单(app-version / news) (1a55dab48d6)
- 🐞 Fix:删除 relay-account-pool-worker 重复的 runTraeSessionSync 导出 (8176b5c52a6)
- 🐞 Fix:兜底闸不得二次 send —— 修 /api/knowledge 匿名访问 500 而非 401 (83359d53964)
- 🐞 Fix:补全鉴权兜底的公开名单并给 enforce 档留痕 (45e7f7ba552)
- 🐞 Fix:语音输入条两枚圆角收成同档 —— 小程序腿此前比 RN 腿各粗一档 (57c98b75a33)
- 🐞 Fix:恢复被 d801061d98 误回退的文件(fixup,保留后续正常提交与本票 5 文件) (a598eb0f656)
- 🐞 Fix:底部胶囊的毛玻璃模糊半径收成单一源头 —— 两端各写一份 24 靠注释对齐 (5493867cd72)
- 📚 Docs:鉴权兜底闸已以 observe 档上线，更正'未做'记录 (05e0e309c3f)
- 🐞 Fix:observe 档上线即抓到 GitHub webhook —— 补进鉴权兜底的公开名单 (6774a82ebfb)
- 🔧 Chore/Other:补齐三个边缘守卫文件的溯源水印 (aa98aab816d)
- 🚀 Feature/Improvement:鉴权默认拒绝兜底闸(onRoute 追加,默认 observe) (e876ad8f6c3)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (cb284b0b0ab)
- 🐞 Fix:消掉上一枚落地后复跑暴露的三处简体残留 —— 否则这道门就是我造的恒红门 (c306cfaa2ab)
- 🐞 Fix:底部胶囊的 Android 真模糊强度调到可见档 —— 接线补齐后仍看不出模糊 (57dd6758c55)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b7f6a030176)
- 🔧 Chore/Other:把 ruff/mypy 两面存量红(19 + 4)清到 0,让号池之外的 Python 门重新有牙 (2b981bd839a)
- 🐞 Fix:修 feature-center i18n 键缺失并补 ui-react work-panel 预留属性 (63efdcfb6c8)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b06c8b01c79)

**2026-10-29**
- 📚 Docs:防病毒已装并用 EICAR 实测、守护自拉起腿已补 —— 两格闭环 (2feee1ff75d)
- 🐞 Fix:修 feature-center i18n 键缺失（开发仓对齐生产仓） (a412a16e56e)
- 🐞 Fix:补齐 checkpoint 回退入口与 tool-summary 帧的两个缺口(全量 typecheck 归零) (909ae74411c)
- 🐞 Fix:secure-store 存量令牌一次性迁移 —— 修复后不必重登 (1b84801d416)
- 🐞 Fix:小程序端词包补 pdfToolsPage —— 这一屏渲染得出,但它每句话都取不到词条 (59a760a6036)
- 🐞 Fix:Trae 切号不再按映像名全杀进程 (3f598e351d2)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 260 · 缺口 11) (28283deb244)
- 🔧 Chore/Other:把 apps/api/scripts 装进 typecheck 射程,并清掉这面 35 枚从未被看见的存量类型错 (1362cec462e)
- 🐞 Fix:dev-stack 重入锁 + 重拉冷却 + pid 文件删除收紧 —— 治三条腿反复「重拉失败」 (899b6855417)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (c9ab7153bca)
- 🐞 Fix:secure-store 回潮重放 + 三屏模糊接线 + 两处 View 直挂裸文本 (ffbe506f9e3)
- 🚀 Feature/Improvement:补 daemon 档自我存活兜底腿 (cca0a95e4f6)
- 📚 Docs:补记 2026-10-29 二轮加固(未授权面/本地文件面/边缘 IP 身份) (4d3f14ea770)
- 🐞 Fix:本地文件面收口(任意文件读/任意目录删/跨用户上传) + TOTP 默认升 enforce (1ec1beea63a)
- 📚 Docs:账本追平 —— PDF 工具台从未判定转已承载,缺口候选 10→9 (7758eabfeee)
- 🐞 Fix:选中态样式键写反了 —— HEAD 面既有的类型红,不修则 RN 包谁都推不动 (bd41560d839)
- 🐞 Fix:结清 web api 壳迁移票——主体234份已在HEAD(349e116a66),末枚admin/sms/operations已迁 (9b30e5b362d)
- 🚀 Feature/Improvement:侧栏补 /tools/pdf 入口(重放版) (c148782a0a6)
- 🔧 Chore/Other:ui-routes 产物追上 app.config(重放版) (20c2d8755e6)
- 🚀 Feature/Improvement:给 PDF 工具台补入口 + ui-routes 追上(重放版) (d2f1080548b)
- 🐞 Fix:镜像构建上下文排除真实密钥,并钉住规则不被删/不写错模式 (c860842563c)
- 🚀 Feature/Improvement:PDF 工具台全链落地(页 + 路由 + 入口 + 判据 + 派生) —— 重放版 (6e3584b69f9)
- 🚀 Feature/Improvement:web 侧栏补 nav.pdfTools 五语言(重放:上一版被并发 ref 移动挪出 main) (23151831409)
- 🐞 Fix:智汇AI 首页收口 —— 同数据源堆叠与随之失效的死码一并清掉 (55c75ae60bd)
- 📚 Docs:闭环源站收敛待办并登记主机侧三项加固 (b3773937d93)
- 🐞 Fix:侧栏滚动淡出遮罩双层错修复 —— 它从来没显示过 (e3daebc7f64)
- 🐞 Fix:边缘 IP 归一再补隧道腿——cloudflared 回环对端采信 CF-Connecting-IP (ad802698dfe)
- 🐞 Fix:边缘 IP 归一再补隧道腿——cloudflared 回环对端采信 CF-Connecting-IP (daf8856aa26)
- 🐞 Fix:成本面/调度状态面进入永不公开名单,收回 .env 白名单漂移 (433df6460d1)
- ♻️ Refactor:收尾最后一枚 api<T> 委托壳 —— admin/sms/operations 迁 apiOrThrow(web 本地 api<T> 声明归零) (7ac88bb579f)
- 🚀 Feature/Improvement:僵尸弹窗与撤销轮次两键五语言词包 (e13b707b2b2)
- 🐞 Fix:/chat/abort 清除 conversation.metadata.pendingQuestion (5c1bbb7c02f)
- 🐞 Fix:补 memory.refresh 三方 parity 漂移 + 承接上一枚提交信息事故说明 (79d47138857)
- 🔧 Chore/Other:-- (bf5355699b1)
- 🐞 Fix:账本生成器补上"写盘后紧随注入"这条腿 —— 并把被我自己洗掉的载荷落回去 (1414862c108)
- 📚 Docs:清偿 13c 归档器的文档↔代码脱节(4 文档 44 行)——文档在号召恢复退役件,这才是回潮的驱动力 (40c9ab3e53b)
- 🐞 Fix:补齐守门 52 存量 22 处 visible-spawn 缺 windowsHide —— 11 个文件全纯追加(零行为变更) (7c624aa2244)
- 🔧 Chore/Other:recover docked-browser panel wiring + cross-panel revealAt/CodeEditorHandle + ticket-60 pane chat-store addressing (d801061d983)
- 🐞 Fix:后端工具名单从前端真相源派生 —— 消除第二把尺子与存量漏计 (a06099ba765)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (15eaa6f61cf)
- 🐞 Fix:回灌腿补归属闸、任务中心断链修复,并把 WorkBuddy 第三条腿真正装车 (c3d5b63ca53)
- 🐞 Fix:secure-store 探测改同步取模块 —— dev bundle 的 lazy chunk 404 让刷新令牌永远落不了盘 (87a16d748a7)
- 🐞 Fix:给守门 26 的存量开一条排水口——清扫器新增具名族 parent-pollution-strays(判据 import 门体,不抄第二份) (c86f69d8e1b)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (e0acf77c41f)
- 🐞 Fix:「我的」页菜单去掉重复的收藏入口 + 三组同屏撞名文案区分 (3dc363cd824)
- 🚀 Feature/Improvement:落 RP 族 RP-1 首行 —— 26 枚「未取号」票的迁移与文案改正线 (c842abf2b7d)
- 🐞 Fix:「我的」页菜单「会员中心」撞名 + 抽屉键错位 + 底部条目被淡出遮罩压暗 (3ac7b5859be)
- 🚀 Feature/Improvement:工具摘要三档维度五语言词包(directories/edits/terminalCommands) (1dfe9bb1320)
- 🚀 Feature/Improvement:活动级几何虚拟化 + 工具摘要三档维度补齐 (80d97436e2b)
- 🚀 Feature/Improvement:轮次呈现投影层建立并装车 —— 消灭「造好没装车」 (1f3e7bd27b0)
- 📚 Docs:账本追平现读 —— 并交后手一条取证结论(小程序缺 PDF 工具台 hub) (b38b4a3e8b0)
- 📚 Docs:结清最后一条 gap chat/workbench —— 工作台在 RN 与小程序都有了承载 (c36f4b71a82)
- 🐞 Fix:增强跨端无硬边淡出遮罩强度 (dd34b4bbfa2)
- 🐞 Fix:屏幕侧配对前景键词序写反 —— filterChip/chip/tab 三键按样式工厂约定回正 (876c4cb4183)
- 🚀 Feature/Improvement:跨端驾驶舱接上唯一调度器 —— 它自述"全自动管线唯一入口"而全仓零调用点 (b8dc9e31543)
- 🚀 Feature/Improvement:D05设计稿落地现状对齐 + 清偿器补守门130落地前自查(F4/F4b/F9三维,g30 s9/s2) (316beddb12d)
- 🔧 Chore/Other:登记会话导出件族豁免 —— 门 47 缺口归零 (599baad8fa9)
- 🐞 Fix:补回富文本锚点 link 族的 <a href> 渲染 —— 事故提交 9fdbc207ba 把 renderLink 当残留删掉导致 role=link 全失效 (8fa512f9bb2)
- 🐞 Fix:拆掉 shared 包内自引造成的循环依赖 + 两个根 tab 多出来的返回键 (e648811e636)
- 🐞 Fix:修复 spacing 受管块压塌全站 max-w 命名档 —— AI 面板 32px 塌缩回归 (4394b6b4907)
- 🔧 Chore/Other:壳声明件跟随新落承载页(176 条说明符) (b35015da09a)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (a62494c34dc)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (20dc73c8283)
- 🚀 Feature/Improvement:补 chatWorkbenchPage 五语言词组 —— 聊天工作台共享屏的取词面 (c0ce5eb4b88)
- 🔧 Chore/Other:goal-b25 结清四票并补 G-07 进展注记 —— 门8未判定桶/F9判据/基线差值矛盾/滞台副本末枚 (427938a5868)
- 🚀 Feature/Improvement:落聊天工作台共享屏 + RN 薄壳 —— web /chat/workbench 的移动端承载 (dd5d0475feb)
- 🔧 Chore/Other:为同批误删恢复件 background_tasks 两枚登记保留裁决 —— 尺子的红线该由证据裁,不该由再摘一次消 (689b98ef7ed)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3355d2fb255)
- 🐞 Fix:驾驶舱补上漂移哨兵这一维,并让"部分覆盖"不能冒充合格证 (4dfcfa7d516)
- 📚 Docs:结清 student/my-resources —— 数据面真补上了,原 gap 的前提已不成立 (b9f69fc4ef1)
- 🐞 Fix:智汇AI 首页移除与 AI 应用商店重复的四块内容 (f571b65018d)
- 🐞 Fix:结清 L28260 api-client 假绿灯票——判死现读 0,清账链 bd5ce8a101 已在 HEAD (a7815297205)
- 🐞 Fix:部署环 ff 竞态锁正则跟上实现演进 + 门 11h 评分星补实心填充 + 水印复注 (2c6838d1690)
- 🔧 Chore/Other:壳声明件跟随新落承载页(175 条说明符) (e3ddff14d59)
- 🐞 Fix:结清三票(G-109四格全闭合/G-924死键已清零/G-689 stderr尾缓冲已装车) (5d9d115a2f0)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3e240a14074)
- 🐞 Fix:结清两枚前提腐烂票(dot-source传递闭包3d31e4c499已装车/六屏下沉411646ee58等已全量) (13c1bdaec1f)
- 🐞 Fix:结清 L5646 门116型B行——前提已腐烂(该文件裸git派生实测0,清偿枚949195bcb5早已是祖先) (b8ede2328ef)
- 🐞 Fix:重放被回潮抹掉的「我的创作」入口迁移 —— 底栏上方那块常驻嵌套块 (1fed27283b5)
- 🐞 Fix:目录级 index.css 被当成每页伴生样式 —— 修判据并恢复被误升级的「领券中心」页 (99e58a986c7)
- 🐞 Fix:合并留下的重复 const 把 Trae/Qoder 两条回灌腿一起炸了 —— 修脚本并补上 scripts 目录的可转译锁 (cecb7d460ea)
- 🐞 Fix:首页输入框占位文案收短到单行 —— 原串在 360dp 下折行，第二行被 48dp 外壳裁掉 (3e70039dd0f)
- 🔧 Chore/Other:摘净回潮尺子至今仍点名的两枚死副本 —— keepalive router 双份 + 孤儿 SDK 单文件 (082523e385e)
- 🐞 Fix:守门 8「前缀假设」收口为三态可判 —— 未判定桶 237→0、孤儿路由变异自证修前绿修后红 (255275c277e)
- 🐞 Fix:落地 background_tasks(spawn 强引用登记处)—— 修 main 上悬空 import (f7d269568cf)
- 🐞 Fix:恢复 WorkPanel 被 9fdbc207ba 删除的第五组 props(主页/点选/开发者工具/独立窗口/常显停止) (f33f7b82a3f)
- 🚀 Feature/Improvement:跨端无硬边滚动淡出遮罩 (RN 底部 / 小程序底部 / Web 侧栏) (1be5a68ad81)
- 🐞 Fix:F9 撞号判据收窄为「同号 ≥2 未勾活行」—— 已完成历史行与单活题面退出判红面 (d09c9d2bc72)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (940fda0cba9)
- 🐞 Fix:补回「清理功能回退残留」删掉的四组功能面(并集恢复,零整文件覆盖) (60668e4c253)
- 🐞 Fix:补 stable 非纯追加时的换代处置 —— 真浏览器验证发现的判据射程缺口 (865460dfa39)
- 🐞 Fix:折叠漂开副本族(N→1,认领合并到保留行 + 逐字留痕;--fold-drifted-families) (1242b2b5e9b)
- 📚 Docs:摘 2 条已被现行判定取代的旧 gap 行 —— gap 全集从 4 收到真值 2 (179334406c4)
- 🔧 Chore/Other:第二次摘除 miniapp-end-capabilities 与 tip-metro-guard —— 并发归并把本票第一次摘除反向抹回 2 枚 (32d79e0c8f0)

**2026-10-29**
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (c9ab7153bca)
- 🚀 Feature/Improvement:补 daemon 档自我存活兜底腿 (cca0a95e4f6)
- 📚 Docs:补记 2026-10-29 二轮加固(未授权面/本地文件面/边缘 IP 身份) (4d3f14ea770)
- 🐞 Fix:本地文件面收口(任意文件读/任意目录删/跨用户上传) + TOTP 默认升 enforce (1ec1beea63a)
- 📚 Docs:账本追平 —— PDF 工具台从未判定转已承载,缺口候选 10→9 (7758eabfeee)
- 🐞 Fix:选中态样式键写反了 —— HEAD 面既有的类型红,不修则 RN 包谁都推不动 (bd41560d839)
- 🐞 Fix:结清 web api 壳迁移票——主体234份已在HEAD(349e116a66),末枚admin/sms/operations已迁 (9b30e5b362d)
- 🚀 Feature/Improvement:侧栏补 /tools/pdf 入口(重放版) (c148782a0a6)
- 🔧 Chore/Other:ui-routes 产物追上 app.config(重放版) (20c2d8755e6)
- 🚀 Feature/Improvement:给 PDF 工具台补入口 + ui-routes 追上(重放版) (d2f1080548b)
- 🐞 Fix:镜像构建上下文排除真实密钥,并钉住规则不被删/不写错模式 (c860842563c)
- 🚀 Feature/Improvement:PDF 工具台全链落地(页 + 路由 + 入口 + 判据 + 派生) —— 重放版 (6e3584b69f9)
- 🚀 Feature/Improvement:web 侧栏补 nav.pdfTools 五语言(重放:上一版被并发 ref 移动挪出 main) (23151831409)
- 🐞 Fix:智汇AI 首页收口 —— 同数据源堆叠与随之失效的死码一并清掉 (55c75ae60bd)
- 📚 Docs:闭环源站收敛待办并登记主机侧三项加固 (b3773937d93)
- 🐞 Fix:侧栏滚动淡出遮罩双层错修复 —— 它从来没显示过 (e3daebc7f64)
- 🐞 Fix:边缘 IP 归一再补隧道腿——cloudflared 回环对端采信 CF-Connecting-IP (ad802698dfe)
- 🐞 Fix:边缘 IP 归一再补隧道腿——cloudflared 回环对端采信 CF-Connecting-IP (daf8856aa26)
- 🐞 Fix:成本面/调度状态面进入永不公开名单,收回 .env 白名单漂移 (433df6460d1)
- ♻️ Refactor:收尾最后一枚 api<T> 委托壳 —— admin/sms/operations 迁 apiOrThrow(web 本地 api<T> 声明归零) (7ac88bb579f)
- 🚀 Feature/Improvement:僵尸弹窗与撤销轮次两键五语言词包 (e13b707b2b2)
- 🐞 Fix:/chat/abort 清除 conversation.metadata.pendingQuestion (5c1bbb7c02f)
- 🐞 Fix:补 memory.refresh 三方 parity 漂移 + 承接上一枚提交信息事故说明 (79d47138857)
- 🔧 Chore/Other:-- (bf5355699b1)
- 🐞 Fix:账本生成器补上"写盘后紧随注入"这条腿 —— 并把被我自己洗掉的载荷落回去 (1414862c108)
- 📚 Docs:清偿 13c 归档器的文档↔代码脱节(4 文档 44 行)——文档在号召恢复退役件,这才是回潮的驱动力 (40c9ab3e53b)
- 🐞 Fix:补齐守门 52 存量 22 处 visible-spawn 缺 windowsHide —— 11 个文件全纯追加(零行为变更) (7c624aa2244)
- 🔧 Chore/Other:recover docked-browser panel wiring + cross-panel revealAt/CodeEditorHandle + ticket-60 pane chat-store addressing (d801061d983)
- 🐞 Fix:后端工具名单从前端真相源派生 —— 消除第二把尺子与存量漏计 (a06099ba765)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (15eaa6f61cf)
- 🐞 Fix:回灌腿补归属闸、任务中心断链修复,并把 WorkBuddy 第三条腿真正装车 (c3d5b63ca53)
- 🐞 Fix:secure-store 探测改同步取模块 —— dev bundle 的 lazy chunk 404 让刷新令牌永远落不了盘 (87a16d748a7)
- 🐞 Fix:给守门 26 的存量开一条排水口——清扫器新增具名族 parent-pollution-strays(判据 import 门体,不抄第二份) (c86f69d8e1b)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (e0acf77c41f)
- 🐞 Fix:「我的」页菜单去掉重复的收藏入口 + 三组同屏撞名文案区分 (3dc363cd824)
- 🚀 Feature/Improvement:落 RP 族 RP-1 首行 —— 26 枚「未取号」票的迁移与文案改正线 (c842abf2b7d)
- 🐞 Fix:「我的」页菜单「会员中心」撞名 + 抽屉键错位 + 底部条目被淡出遮罩压暗 (3ac7b5859be)
- 🚀 Feature/Improvement:工具摘要三档维度五语言词包(directories/edits/terminalCommands) (1dfe9bb1320)
- 🚀 Feature/Improvement:活动级几何虚拟化 + 工具摘要三档维度补齐 (80d97436e2b)
- 🚀 Feature/Improvement:轮次呈现投影层建立并装车 —— 消灭「造好没装车」 (1f3e7bd27b0)
- 📚 Docs:账本追平现读 —— 并交后手一条取证结论(小程序缺 PDF 工具台 hub) (b38b4a3e8b0)
- 📚 Docs:结清最后一条 gap chat/workbench —— 工作台在 RN 与小程序都有了承载 (c36f4b71a82)
- 🐞 Fix:增强跨端无硬边淡出遮罩强度 (dd34b4bbfa2)
- 🐞 Fix:屏幕侧配对前景键词序写反 —— filterChip/chip/tab 三键按样式工厂约定回正 (876c4cb4183)
- 🚀 Feature/Improvement:跨端驾驶舱接上唯一调度器 —— 它自述"全自动管线唯一入口"而全仓零调用点 (b8dc9e31543)
- 🚀 Feature/Improvement:D05设计稿落地现状对齐 + 清偿器补守门130落地前自查(F4/F4b/F9三维,g30 s9/s2) (316beddb12d)
- 🔧 Chore/Other:登记会话导出件族豁免 —— 门 47 缺口归零 (599baad8fa9)
- 🐞 Fix:补回富文本锚点 link 族的 <a href> 渲染 —— 事故提交 9fdbc207ba 把 renderLink 当残留删掉导致 role=link 全失效 (8fa512f9bb2)
- 🐞 Fix:拆掉 shared 包内自引造成的循环依赖 + 两个根 tab 多出来的返回键 (e648811e636)
- 🐞 Fix:修复 spacing 受管块压塌全站 max-w 命名档 —— AI 面板 32px 塌缩回归 (4394b6b4907)
- 🔧 Chore/Other:壳声明件跟随新落承载页(176 条说明符) (b35015da09a)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (a62494c34dc)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (20dc73c8283)
- 🚀 Feature/Improvement:补 chatWorkbenchPage 五语言词组 —— 聊天工作台共享屏的取词面 (c0ce5eb4b88)
- 🔧 Chore/Other:goal-b25 结清四票并补 G-07 进展注记 —— 门8未判定桶/F9判据/基线差值矛盾/滞台副本末枚 (427938a5868)
- 🚀 Feature/Improvement:落聊天工作台共享屏 + RN 薄壳 —— web /chat/workbench 的移动端承载 (dd5d0475feb)
- 🔧 Chore/Other:为同批误删恢复件 background_tasks 两枚登记保留裁决 —— 尺子的红线该由证据裁,不该由再摘一次消 (689b98ef7ed)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3355d2fb255)
- 🐞 Fix:驾驶舱补上漂移哨兵这一维,并让"部分覆盖"不能冒充合格证 (4dfcfa7d516)
- 📚 Docs:结清 student/my-resources —— 数据面真补上了,原 gap 的前提已不成立 (b9f69fc4ef1)
- 🐞 Fix:智汇AI 首页移除与 AI 应用商店重复的四块内容 (f571b65018d)
- 🐞 Fix:结清 L28260 api-client 假绿灯票——判死现读 0,清账链 bd5ce8a101 已在 HEAD (a7815297205)
- 🐞 Fix:部署环 ff 竞态锁正则跟上实现演进 + 门 11h 评分星补实心填充 + 水印复注 (2c6838d1690)
- 🔧 Chore/Other:壳声明件跟随新落承载页(175 条说明符) (e3ddff14d59)
- 🐞 Fix:结清三票(G-109四格全闭合/G-924死键已清零/G-689 stderr尾缓冲已装车) (5d9d115a2f0)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3e240a14074)
- 🐞 Fix:结清两枚前提腐烂票(dot-source传递闭包3d31e4c499已装车/六屏下沉411646ee58等已全量) (13c1bdaec1f)
- 🐞 Fix:结清 L5646 门116型B行——前提已腐烂(该文件裸git派生实测0,清偿枚949195bcb5早已是祖先) (b8ede2328ef)
- 🐞 Fix:重放被回潮抹掉的「我的创作」入口迁移 —— 底栏上方那块常驻嵌套块 (1fed27283b5)
- 🐞 Fix:目录级 index.css 被当成每页伴生样式 —— 修判据并恢复被误升级的「领券中心」页 (99e58a986c7)
- 🐞 Fix:合并留下的重复 const 把 Trae/Qoder 两条回灌腿一起炸了 —— 修脚本并补上 scripts 目录的可转译锁 (cecb7d460ea)
- 🐞 Fix:首页输入框占位文案收短到单行 —— 原串在 360dp 下折行，第二行被 48dp 外壳裁掉 (3e70039dd0f)
- 🔧 Chore/Other:摘净回潮尺子至今仍点名的两枚死副本 —— keepalive router 双份 + 孤儿 SDK 单文件 (082523e385e)
- 🐞 Fix:守门 8「前缀假设」收口为三态可判 —— 未判定桶 237→0、孤儿路由变异自证修前绿修后红 (255275c277e)
- 🐞 Fix:落地 background_tasks(spawn 强引用登记处)—— 修 main 上悬空 import (f7d269568cf)
- 🐞 Fix:恢复 WorkPanel 被 9fdbc207ba 删除的第五组 props(主页/点选/开发者工具/独立窗口/常显停止) (f33f7b82a3f)
- 🚀 Feature/Improvement:跨端无硬边滚动淡出遮罩 (RN 底部 / 小程序底部 / Web 侧栏) (1be5a68ad81)
- 🐞 Fix:F9 撞号判据收窄为「同号 ≥2 未勾活行」—— 已完成历史行与单活题面退出判红面 (d09c9d2bc72)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (940fda0cba9)
- 🐞 Fix:补回「清理功能回退残留」删掉的四组功能面(并集恢复,零整文件覆盖) (60668e4c253)
- 🐞 Fix:补 stable 非纯追加时的换代处置 —— 真浏览器验证发现的判据射程缺口 (865460dfa39)
- 🐞 Fix:折叠漂开副本族(N→1,认领合并到保留行 + 逐字留痕;--fold-drifted-families) (1242b2b5e9b)
- 📚 Docs:摘 2 条已被现行判定取代的旧 gap 行 —— gap 全集从 4 收到真值 2 (179334406c4)
- 🔧 Chore/Other:第二次摘除 miniapp-end-capabilities 与 tip-metro-guard —— 并发归并把本票第一次摘除反向抹回 2 枚 (32d79e0c8f0)

**2026-10-29**
- 🐞 Fix:收紧知识库归属——/api/knowledge 全插件强制登录,归属只认凭据 (ca1775aa7e5)
- 🔧 Chore/Other:新增变更B边缘IP透传端到端链路测试 (1a9f2ba2ba8)
- 🔧 Chore/Other:将 app/core/background_tasks.py 纳入版本控制防丢 (3c6419bf020)

**2026-10-29**
- 🐞 Fix:去掉收敛归并留下的三处重复导出(ExpertAutoRouteMode/ReviewFindingEvent/ReviewFindingSeverity) (b4c26c122e6)
- 🔧 Chore/Other:security：闭环变更B边缘IP透传并补API响应安全头（变更C） (79e830ba981)
- 🚀 Feature/Improvement:折叠语义例外集压过三维阈值 + 连接器分组从零消费者接成生产形态 (b5d9861d416)
- 🐞 Fix:并集补回 api-client 的 D09/D115 类型与发送链参数、web 发送链的窗格 store 参数 (5c20fb78ed4)
- 🔧 Chore/Other:T3 阳性对照窗口 300→40 —— 正控不变而镜像测试从 215s 降到 70s (af58e0f5a6d)
- 🐞 Fix:修 RN 端两处——一处编译不过、一处文案印成键名原文 (53c1dfb0a43)
- 🐞 Fix:miniapp 路由件改按 HEAD 面隔离树重算 —— 上一枚追平把他人未提交的输入烘进了自述钉 (230a8b3da2e)
- 🔧 Chore/Other:三族派生件同枚追平（路由×2 + 离线包×4 + 声明件×3）—— 本票新落的镜像页与壳把它们顶 stale (51cfd40aa99)
- 🐞 Fix:12 份文件补齐溯源水印 + 两处 lint 修正 (9725a9113fe)
- 🔧 Chore/Other:壳声明件跟随新落承载页(176 条说明符) (3e3497502cc)
- 🚀 Feature/Improvement:装出「逐字回潮」这道尺子并挂上常驻班次 —— 单父嫁接绕过钩子这一族从此有人看得见 (47d6d441aff)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (3f45c3f9438)
- ♻️ Refactor:云运行壳与共享屏同名（CloudRunsScreen）—— 让自动造页腿能认出这屏并给小程序端产出镜像页 (b676679d7a2)
- 🔧 Chore/Other:兼容层图标集按现算补 Cloud —— 新共享屏 CloudRunsScreen 把它带进了消费面 (1a54e3d07de)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f223a88eeae)
- 🔧 Chore/Other:给 carrier 7 枚带回件逐条登记裁决——回潮必须留下「谁判过、依据是什么」 (806ded2afa0)
- 🚀 Feature/Improvement:云运行屏提进 packages/app + RN 薄壳与导航登记 —— 结清 RN 端该内容域零承载 (2f6d6b266fa)
- 🚀 Feature/Improvement:mobile-rn 端包补 cloudRuns 命名空间 24 键（五语）—— 为「云运行」共享屏供词，措辞一律取自 web (7a0a0ab71e2)
- 📚 Docs:给门 89 的 R4 补上 check-web-portal-label-keys 的点名行(走对象空间,不吃别席的行) (0b6f24f7297)
- 🐞 Fix:消掉门 89 的 R5 撞号恒红 + 回补门 237 被无关提交洗掉的 996 行版 + 换掉一把会替人下因果结论的坏尺子 (3ef804fc3f9)
- 🔧 Chore/Other:撤销 1442baa1e0e 的整条移除——补回运营商一键登录的注册腿与消费腿 (b09e82f82c8)

**2026-10-29**
- 🐞 Fix:补齐 9fdbc207ba2 那批「清理功能回退残留」抹掉的实现(api-client 两导出 + 四个 store/hook 面) (c51a00fd0bf)

**2026-10-29**
- 🐞 Fix:恢复 chat store 被 c7476ff89b1 整份回退的实现(契约测试 96/96 钉住) (91cef71b0ed)
- ♻️ Refactor:收口新增集里盘上干净的三枚裸 git(棘轮新增 24→21)—— check-ps1-bom(1 生产 + 2 自检夹具,后者写临时仓/无 ps 目录,respectively 传 tmp/noPs 作根)、tip-metro-guard(rev-parse)、check-index-unmerged-age(ls-files -u -z)改走 face-reader 的 gitRaw。三处各有不能照抄的地方,如实记:① ps1-bom 的 git() 下游要 Buffer(subarray + 前 3 字节 hex 判 BOM),故用 { binary: true } 而非默认 utf8 串,原 .toString("utf8") 调用点一个不删;② tip-metro-guard 原来读的是 spawnSync 的 .stdout,且两支失败语义不同 —— git 跑起来非零退出时 stdout 为空串(打印成 "HEAD "),spawn 层失败才吞掉、保持初值 "?";gitRaw 一律抛,故用异常上的 e.status 是不是 number 还原这两支,静默 catch 会把它压成一支、把非零退出错报成 "?";③ check-index-unmerged-age 头注原写「不挂 face-reader 取材层」,迁移后成半真:改成「派生已统一走 gitRaw;判的是 index 元数据而非仓库内容,故仍不走 listFaceFiles/catBatch 那条取材面」,原解释的不按仓库锚点读内容的实质信息保留。验证都是真跑:check-ps1-bom --self-test 判据 + 端到端全 PASS(含面取不到 exit=2 与真零不空扫两向)、check-index-unmerged-age 现读「index 无未合并条目」rc=0、eslint 三文件 0 error(14 warning 全存量 no-console)、where.mjs 三文件均 0 处。范围如实:本批只动新增集里盘上干净的 3 枚;另 3 枚(check-cross-end-screen-coverage / check-web-rn-parity / gen-rn-host-shell)正被别席改(补 windowsHide 治门 193),按纪律未碰;gen-i18n-compressed 盘上已被别席清空;剩 17 枚属「HEAD 有、盘上已删未提交」,随删除落地自消;基线 18 枚是刻意存量(含 spawn 夹具件与钩子内 env 注入那一族),本批不碰。故棘轮在删除落地前仍红,落地后 39-17-3(他席)-1 = 18 = 基线。 (e17454a7ded)
- 🐞 Fix:D58 类目卡接回 D21 折叠策略——修「判据在、消费者为 0」 (01ea49c5f26)
- 🚀 Feature/Improvement:对话框里能真出视频了 —— 视频工具接进普通对话 + agnes 免费档提交/取件闭环 (f1f0a373423)
- 🐞 Fix:流式 markdown 块边界单调性——修两级真 bug + 新增跨拍判据 (b70cfde77b3)
- 🐞 Fix:补回 chat.ts 被整行替换吞掉的 steerNoticesByMessageId 两处初始值 (418ac6aef67)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (6313f42b140)
- 🚀 Feature/Improvement:WS 失败终态可见可归因（G-86 前置半格） (202de101487)
- 🐞 Fix:补回被「清理功能回退残留」删掉的伴生导出 —— 解 web 构建恒红 (53e6c362f6a)
- ♻️ Refactor:三处裸 git 迁移到 face-reader 的 gitRaw(棘轮 48→45)—— check-ruff-python 的 gitRun、check-gate-triggers 的 git 包装与其自检夹具 run、root-guard 的 headHashOf,三处都只是把「execFileSync 裸 git + 各自抄一遍 stdio 两态」换成层出口;§12g 的 stdio 两态由 gitRaw 写死,调用方不再复算。首推被 lint-staged 挡下两次并都点名本任务文件(未使用的 execFileSync 导入、catch 的 e 变为未使用),均已修后重发;现读 eslint 0 error。验证:ruff 自检 11/11、gate-triggers 自检九例+端到端七例、root-guard 无悬空标识符(execFileSync 残留 0)。范围如实:本批只收敛 3 枚,该棘轮仍红 —— 48 个命中里 20 个盘上已不存在(属 HEAD 存续而工作树已删未提交的 373 枚那一族),它们要么随删除落地自动从分母消失、要么需先恢复再迁,不在本批射程;另 check-index-unmerged-age 头注明写「判的不是仓库内容故不挂 face-reader」,按其既有决策不硬迁。 (52c88a32cf6)
- 🐞 Fix:两处派生 git 显式接管 stdio,解除 push 门 193 (7916748b793)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a54821ee506)
- 🐞 Fix:客户端 IP 归属收口 —— 边缘归一 + 三处手读 XFF 清除 (e5dce1709df)
- 🔧 Chore/Other:goal-b24 结清四票并补三票进展注记 —— 部署停摆升档/号池让位/公网腿归因/webhook 三类事件 (5a1fdcc51d6)
- 🔧 Chore/Other:摘净嫁接带回的 9 枚退役/零消费者件,并更正 1fe3a2b42d 的两处不实陈述 (1250480412b)
- 🔧 Chore/Other:撤销 systeminformation 豁免 —— override 已把它锁到修复版 (e9704d597db)
- 🐞 Fix:流式引用不再被切散,遥测收流对齐结束时刻 (444ca2abc1f)
- 🐞 Fix:发现器读数去重口径 + 闭环三处真缺陷（门槛单源/票号边界/同 sha 裁决） (9f2dfb3a648)
- 🐞 Fix:补齐锁文件缺失的 workspace 依赖 —— 解生产 frozen-lockfile 安装失败 (7f3924a5ade)
- 🚀 Feature/Improvement:安卓 latest 只读对账 + 幂等登记腿 + 公网腿分阶段时延尺 (0b2a21d3148)
- 🚀 Feature/Improvement:金丝雀观察窗从不可验变成本机可复现实测 + 修分流器契约缺失即整进程崩 (ebbac969af4)
- 🐞 Fix:重封根护栏 —— 门脚本六枚正当演进后清单过期(部署环 fail-closed) (f933451ec5e)
- 🚀 Feature/Improvement:停摆静默阈值改由日志实测分布派生 + 落后且停写时定向升级一次 (89c0980a95e)
- 🚀 Feature/Improvement:大屏指挥台二轮 —— 主导航隐藏 + 速率火花线 + 块级增量 Markdown + 工具卡窗口化 (71a5e026d65)
- ♻️ Refactor:两个自拼 cat-file batch 的工具改走共享层 —— 棘轮测试「自拼 batch 却不走本层的门」现读 0 涨到 2(audit-aligned-domain-drift / measure-cross-end-page-sizes),而自拼一件要把 stdio[0]=pipe / maxBuffer / 头解析三处本仓都真踩过的坑各重写一遍。改法:两处批量取材改调 lib/face-reader.mjs 的 catBatch(键即 rev 串,HEAD 面用 HEAD:path);顺带修掉 audit 那处索引面的空前缀,原实现把裸路径当对象规格喂进去,取不到只静默记 null。两脚本在盘上是已删未提交态(HEAD 面仍在),按 §7 先从 HEAD 恢复再改;真跑 rc=0。本轮首推被 lint-staged 挡下并点名本文件(execFileSync 迁走后成未使用导入),已修;eslint 现读 0 error 5 warning(均为存量 no-console)。仅收敛存量维 2→0;另一维裸 git 派生 18→49 未动,那需要逐文件迁 gitRaw,属另一条线。 (68a70876650)
- 🐞 Fix:合并把基础契约取成本侧旧版、消费方却是新版 —— api 端 36 条 TS 红按面逐条归位 (ad0a290626a)
- 🚀 Feature/Improvement:驾驶舱补出「小程序壳绑定块 ← RN 壳」这一格读数,并摘掉文档里会腐烂的阶段计数 (91dabc0193f)
- 🐞 Fix:让 xAI Grok 真的出现在模型选择器首屏 —— 探测腿代理 + 4.20 版本归一 (ec788c8d929)
- 🐞 Fix:门户维收敛落账 —— 5 条过期 gap 判定由 portal 行取代,并摘 1 条已作废的重复判定 (ee0b0c61dac)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b945ead980e)
- 🚀 Feature/Improvement:链条三段补齐调度 + 清掉自动补屏引入的 emoji 图标红 (072ce45ea5d)
- 🐞 Fix:回补 410f749036 洗掉的 5 条 gap 登记 —— 本票上一枚用滞后工作树副本整文件提交，吞了别席在册条目 (0a1180c78d2)
- 🐞 Fix:清偿 CategoryBar 的钉值与已不再命中的豁免 —— 门恢复判定后唯一的红就是这笔腐烂清单 (b7c072c9638)
- 🔧 Chore/Other:兼容层图标/路由映射与词包派生件按 HEAD 面重生成 —— 门 251 的 C2/C10 两维从判红转绿 (a05684b04a9)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a83ab9c96a4)
- 🐞 Fix:根桶补回 25 个出口 + 清掉 FavoriteScreen 的合解死块 —— 移动端 36 条 TS2305/2304 清零 (0de6e9f4f3d)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b6f0a1e7c9f)
- 🔧 Chore/Other:壳声明件跟随新落承载页(175 条说明符) (d0e43db6e5e)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (fba6247f597)

**2026-10-29**
- 🚀 Feature/Improvement:EdgeOne 回源鉴权头改由脚本直落,源站已切 enforce 并实测三向 (58c1403844c)
- 🐞 Fix:让 xAI Grok 真的出现在模型选择器首屏 —— 探测腿代理 + 4.20 版本归一 (5a30eca1140)
- 🐞 Fix:CI 三类事件不再静默失聪 —— check_suite/workflow_run/check_run 白名单 + 可诊断 500 (bd0fb9da328)
- 🐞 Fix:补齐两处裸派生 git 的 stdio 接管 —— 解门 193 阻塞 (09ea205d188)
- 🚀 Feature/Improvement:号池让位器物 —— 已完成条目退出占用面、号随让位回池 (eba39416ce8)
- 🐞 Fix:边缘 router 补三处「装了但装一半」的缺口 (3d99c2b3c67)
- 🚀 Feature/Improvement:接入 xAI Grok 官方 key —— 上游 14 档全量入库 + 计费/路由/分类三处补口 (c653f364540)
- 🚀 Feature/Improvement:接入 Agnes 视频生成（agnes-video-2.5 / 2.5-flash） (cb33e2848ed)
- 🚀 Feature/Improvement:工具活动窗口化展开文案（五语言同批） (80d75f9a524)
- 🐞 Fix:快捷键匹配不再假设 event.key 必在(Tauri WebView2 合成/IME 事件实崩回归) (0bba7984c33)
- 🐞 Fix:锁版本消除生产可达 critical/high 依赖漏洞（8 包） (fc651ffaab3)
- 🚀 Feature/Improvement:运营商一键登录 carrier one-click 落地（API 鉴权 + 原生桥接 + 小程序资源） (1fe3a2b42d1)
- 🔧 Chore/Other:四份 CDN 离线语言包对齐远端字节 —— 这四份是 gen-i18n-compressed.mjs 的纯派生件,两侧各自重生成造成 merge-file 冲突,导致本侧三枚提交推不上去。派生件不做文本级人工归并,取远端那一版(它来自更新的 i18n 源),合并落地后由器物按合并后的源再生成一次为准。 (bba8577c3bf)
- 🐞 Fix:QuickNotes 壳补回 default 导出 —— 造页器在「双导出契约」上判它拒产 (484d0f31013)
- 🔧 Chore/Other:壳声明件跟随新落承载页(174 条说明符) (3b351db105d)
- 🔧 Chore/Other:自动落 2 枚小程序壳承载页(共 2 枚待产) (47959b4e9cd)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (66994c740d1)
- 🐞 Fix:看门人启动时对账并夺回「别的身份跑着的本仓 dev 腿」 (19707a34fde)
- 🐞 Fix:临期刷新档接上「可被调度」单源谓词,止住死号每 5 分钟打上游换票点 (5cdc4e34c13)
- 🚀 Feature/Improvement:共享层补出三枚已实现的屏 —— 造页器此前因「未同名导出」拒产 (a2625f158b9)
- 🐞 Fix:壳声明件按 HEAD 面重生成 + UserPublicScreen 页改回默认导入 —— 合并后小程序端 typecheck 4+1 红 (f6356aab16f)
- 🐞 Fix:check-plan-fields 的 A1 基准面被合并残留的重复 if 绕过 —— 存量行被误判成新增(自检 3 例红) (70fb7780657)
- 🔧 Chore/Other:重生成小程序离线语言包与 ui-routes 派生件 —— 门一百零五在 HEAD 面判红(G-680 离线包自述钉 stale、四端 ui-routes 钉里小程序那份 stale、四个语种各缺六键 taskStatus.summaryFiles/summaryImages 等)。根因是最近落地的「大屏指挥台」那批 i18n 文案与页面路由只改了源,没同批重生成派生件,正是 §4 明令的派生件必须由器物生成、禁止手改。本次两枚器物真跑:gen-i18n-compressed.mjs 重写三份 gen.ts 与四份 CDN 载荷(每份自带溯源水印注入),generate-ui-routes.mjs 重写小程序那份 ui-routes.generated.ts(页面一百七十三条)。复验:门一百零五在 --worktree 面 rc=0 转绿,落地后 HEAD 面随之转绿。 (c13da44df93)
- 🐞 Fix:合并把 web 五语言 51 个键整族回退 + 同一 chat 块键重复 —— 按远端面补齐并去重 (db0e0f3de28)
- 🐞 Fix:EmptyState 补回 icon 契约 —— 合并把「真图标」那一版换成字符版,三个远端页成族 TS2322 (6e0cb34090b)
- 🐞 Fix:恢复快捷键匹配的 undefined key 守卫 —— HEAD 上该回归用例本就是红的 (31ec5a483ce)
- 🐞 Fix:git-guardian 补回本侧 22 条跨端调度腿 —— 远端面独有、本侧面也没有，取单边必丢 (fdad2c54a83)
- 🔧 Chore/Other:补齐 HEAD 面 4 枚缺溯源载荷的文件 (34ddd067222)
- 🐞 Fix:补回 isOpenRow 单源导出 —— 两处消费方 import 期抛,取号器与写盘闸同时不可用 (9c9a0858d5c)
- 🚀 Feature/Improvement:源站回源鉴权(三档默认off) + 依赖审计接常驻派发 + 豁免临期提醒 (eefe8f90c87)
- 📚 Docs:§10.7 的「待补判据」改判为已补 —— 门 260 当日收尾 (34c3ccbcf06)
- 🚀 Feature/Improvement:门 260 —— 生产依赖 critical/high 必须为 0(带到期日的豁免制) (af28a00f9f7)
- 🐞 Fix:union-converge 的自动合解把花括号与单侧参数吞了 —— 脚本在 HEAD 上根本 load 不起来 (ca4af949d94)
- 📚 Docs:更正 nginx 边缘限流"已落地"的错误结论 + 登记本轮三项实测 (ae3599d2ddc)
- 🔧 Chore/Other:给坏密文不连坐补镜像锁,并清 HEAD 面一枚 F401 (3b35fd21885)
- 🐞 Fix:入口限流补回环豁免 —— 内部服务不该被自己的限流限死 (ec68458225a)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b77e1b9e11d)
- 🔧 Chore/Other:调试面根因收口(默认关闭+归属隔离) + 入口层补真实限流 (e40dee4bb84)
- 🐞 Fix:缺依赖型清偿动作补上串行化约束 —— 过去只写「跑全量 pnpm install」,本仓多会话共写一棵树,每个看见缺依赖的会话各开一枚安装,而 install 写的就是 node_modules 本身(先清后链)⇒ 四枚并发互踩,实测把各端 node_modules 全部掏掉、根层 48 个包变空目录,而 pnpm store 完好(不是下载失败),且每枚都卡在 added 若干后静默中断。给出的出路自己成了故障源,正是 AGENTS §0.8 禁的「文档写跑不通的出路」。改法:crashNextStep 与 crashAdvisory 的依赖型分支持平起给「先取 build 锁、禁止并发安装」,超时型与超限型两档一字未动。测试:gate-failure-kind 镜像十七例全绿,新增三条断言,而「兜底型不得出现 pnpm install」那条反例照旧成立。背景:本机依赖树已按此口径单跑修复,现读根层一百四十八包零空目录、eslint 与 tsc 真跑出版本号。 (6061088472b)
- 🐞 Fix:自动合解造出的四处同名双份与双调度 —— 按取证选形并具名留痕 (145020aefe4)
- 🐞 Fix:24 枚壳源屏补回 default 导出 —— 上一轮"取对侧"把双导出契约的第二维吞了,小程序端成族编不过 (6df1d3320e2)
- 🚀 Feature/Improvement:大屏指挥台 —— 沉浸模式 + 流式遥测 + 活动语义摘要 (339c257d176)
- 🚀 Feature/Improvement:大屏指挥台五语言文案（沉浸模式开关 + 流式遥测 + 活动语义摘要） (58a5b015855)
- 📚 Docs:四语 README 数字与现算对齐 —— 散文口径清偿 7524 行 + 生成块重钉 (aeeb9e30088)
- 🐞 Fix:/metrics 与 /business-metrics 收为内网可读,补 IP 归属与 Python 导入落地两道判据 (d091578f5e6)
- 🔧 Chore/Other:封禁 /api/debug RCE 面 + chrome-extension CORS fail-closed (6bc21c94e5b)
- 🐞 Fix:壳类型声明件回补本侧那一份 —— 它被自动三方归并改成与页面不同形的声明 (a361d3d0bd2)
- 🔧 Chore/Other:壳声明件跟随新落承载页(172 条说明符) (40c54f9b5b1)
- 🐞 Fix:壳类型声明件回补本侧那一份 —— 它被自动三方归并改成与页面不同形的声明 (1d9ddb1aef8)
- 🐞 Fix:跨端契约族按本侧版对齐 —— 上一轮把「远端的屏」和「本侧的契约/样式」拼成谁都没编译过的杂交面 (f1020388f17)
- 🐞 Fix:四枚屏取回本侧那份可编译正文 —— 上一枚合并把两侧正文按行拼进同一文件,当场语法崩 (a144a603166)
- 🔧 Chore/Other:自动落 5 枚小程序壳承载页(共 7 枚待产) (16455892b4f)
- 🐞 Fix:语言包按"键"重算落回 + 锁文件按合并后清单重算 —— 修上一枚合并落地的两处继发型缺陷 (efbab1cf6f6)
- 🔧 Chore/Other:壳声明件跟随新落承载页(168 条说明符) (b4189b0b751)
- 🔧 Chore/Other:壳声明件补齐本批 3 枚真被引用的壳 —— 落地腿第二批同型缺口第二次复发 (812e68fb195)
- 🔧 Chore/Other:自动把 1 枚手写镜像页升级为壳承载 (89ab516ae7d)
- 🚀 Feature/Improvement:返回键两端同源不再算私有能力 —— 壳交 onBack ∧ 共享屏渲染 <BackChevron> 即销 (c830f775984)
- 🔧 Chore/Other:自动把 2 枚手写镜像页升级为壳承载 (0c0d6162993)
- 🐞 Fix:提示能力认"error 交给共享屏渲染"那一形 —— 补本票自己重构出来的回归 (b02543139ad)
- 🚀 Feature/Improvement:回放列表与积分明细补触底分页 —— 按"只差这一族"的次序挑屏 (cde1cd618ec)
- 🚀 Feature/Improvement:列表触底分页补到源头 —— usePaginatedList 认"后端不给 total",首帧不再闪空态 (f8e07159a74)
- 🔧 Chore/Other:壳声明件补齐 13 枚真被引用的模块 —— HEAD 面本来就缺,干净检出 typecheck 必红 (06e6139b232)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (414f25348aa)
- 🔧 Chore/Other:自动把 8 枚手写镜像页升级为壳承载 (0fb91af8f8f)
- 🚀 Feature/Improvement:跨端通用能力按"类别"对账 —— 壳侧有实现即算对齐,不再强求同一目标 (7b5975696a8)
- 🚀 Feature/Improvement:客户端分页不再是私有能力 —— 触底只调本地可见量,共享屏列表自己承担 (19018e5d071)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (813bea779ee)
- 🔧 Chore/Other:自动把 1 枚手写镜像页升级为壳承载 (8be8bb6af36)
- 🚀 Feature/Improvement:@/api 具名薄封装按端点对账 —— 端点与壳重合就不再算私有能力 (adde20a6a6d)
- 🚀 Feature/Improvement:问答列表补上拉加载更多 —— RN 壳只取第一页,小程序却有翻页 (80fec295068)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (3f63a4d7270)
- 🐞 Fix:catch 形态与错误出口判据认不全 —— 等价判据对一半的屏恒为假 (600705e7eee)
- 🐞 Fix:分→元展示收口到唯一出口 formatPrice —— 门 248 在 HEAD 面 20 处红归零 (8d08cc3e095)
- 🐞 Fix:壳页落地失败要把工作树退回 —— 器物自己制造的 held 会让升级永久停摆 (f4c7cf1d05f)
- 🔧 Chore/Other:自动把 4 枚手写镜像页升级为壳承载 (f07cc5fa83f)
- 🐞 Fix:gen-rn-host-shell 的 git() 助手补显式 stdio —— 解 pre-push 门 193 对本链的阻断 (7510a4596a1)
- 🐞 Fix:加单实例闸 —— 每 2 分钟一轮会重叠,两轮抢同一临时检出互删 (3bab2a802ee)
- 🚀 Feature/Improvement:锁文件族走"重生成"通道,千级分叉下 uv.lock 127 处冲突不再挡落地闸 (26a0e20456d)
- ⚡ Perf:429 个 pack 没有 MIDX —— 派生 git 慢到超时,145 条「无输出」才第一次有真因 (0ace84d80f3)
- 🐞 Fix:跨端补屏批的圆角角色档归位 —— 门 150 在 HEAD 面 17 族红归零 (71a62fb2148)
- 🔧 Chore/Other:壳声明件跟随自动升级的 2 枚页(按 HEAD 面派生) (d5ddfcb4e29)
- 🐞 Fix:手写页升级腿超时被杀 —— 修上限并让诊断能区分「被杀」与「没判」 (4d10c98e493)
- 🔧 Chore/Other:壳类型声明件再补 8 枚 —— miniapp 类型面 0 错(同型两小时内二次复发) (57040b6ebd1)
- 🔧 Chore/Other:自动把 6 枚手写镜像页升级为壳承载 (49009a514cb)
- 🔧 Chore/Other:壳类型声明件按面上引用补回 2 枚 —— miniapp 类型面在被审面上归零 (a8683927f9c)
- 🔧 Chore/Other:自动把 2 枚手写镜像页升级为壳承载 (286ed61c519)
- ⚡ Perf:取数层改批量装载,千级分叉从"跑不出结论"到 10 分钟给出 131 处清单 (55e093aeef9)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (4860390cd98)
- 🚀 Feature/Improvement:给推送通道装巡检腿 —— 判据在而零调度,本机停摆两天无人喊 (b01b68b48ae)
- 🔧 Chore/Other:壳类型层按新承载页重生成(补 2 枚新壳声明) (494f0fb1056)
- 🔧 Chore/Other:.ihui-agent/tmp/handoff-56/msg-readout.txt (709989d53a9)
- 🐞 Fix:Qoder 导入后即时体检 + 捕获器安装目录自适应(治"导入后 unknown/信息不全") (6370d2875d2)

**2026-10-28**
- 🐞 Fix:RN 资讯 tab 归一到 news 域(列表↔详情同表 + 分类 chips 现读源头)并装域锁 (dfcba0b622d)
- 🚀 Feature/Improvement:12 枚共享屏的小程序镜像页 + 跨端三元组登记(web→RN→小程序 声明链闭合) (a0f4cd49179)
- 🚀 Feature/Improvement:web→RN 11 枚补屏落地 + 知识库列表屏补齐(9 条 gap 归零) (f4ec1d7ae32)
- 🚀 Feature/Improvement:web 侧经 react-native-web 承载共享屏(三屏试点 + 机制锁) (daf4730f09f)
- 🚀 Feature/Improvement:Qoder 号池补客户端回灌保活腿(与 Trae 同构 client-first) (0efd05ef9ee)
- 🚀 Feature/Improvement:间距/字号/阴影三族由 TS 源生成 tokens.css 受管块,门93 增 R9-R11 同源判据 (06d6f9d71aa)
- 🐞 Fix:README 摘除 Gitee/GitCode 死链(守门 238 HEAD 红转绿);skip live-doc 理由=被删 3 行长行正是 238 强制摘除对象,回插即复红 (1a79b8b732b)
- 🔧 Chore/Other:ui-routes 自述钉按 HEAD 面归位(web wallboard + miniapp 本票 3 输入) (78662421188)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (0ccac06be0e)
- 🐞 Fix:weapp 样式落地真缺项归零 —— 描边/主容器/按钮 padding 三处治本 (1feb052574e)
- 🐞 Fix:i18n 闭包沿真实环无限重入(路径不折叠 ..)导致 gen-i18n 809s 不收敛 (b7da2a6c654)
- 🔧 Chore/Other:落地本地积压改动 86 处（README 现算对账归位 + 守门 118/173 修复 + 跨端与端内积压） (c7476ff89b1)
- 📚 Docs:小程序 80 枚手写镜像页的缺口清单与转壳派单计划 (1f6f8050547)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 237 · 缺口 11) (ca2fb58a3cd)
- 🚀 Feature/Improvement:web->RN 对账接上自动巡检腿(尺子此前零调度 = 造好没装车) — git-guardian 新增 auditWebRnParity():60min 节流/健康轮次/三态,喊人只在计数净增(§12e 棘轮,首轮只立基线,取不到结论判未判定不记绿);web-rn-parity 登记进 CROSS_END_LEGS;stampCrossEndDispatch 增可选 extra 承载下轮基线;头注纠偏为唯一调度器 = git-guardian 巡检腿(AGENTS §44)。自测 11/11,生产路径实跑 ok 基线已落盘。LAND_ALLOW_STALE:模板同形误报(工作树=HEAD+本票 175/-1,diff 单面无滞后),已核对 HEAD blob 无同名实现。 (cdb48604ac7)
- 🚀 Feature/Improvement:新增共享屏→RN 宿主壳生成器,补齐生壳这一侧器物 (f83bf2cf12d)
- 🔧 Chore/Other:两端 ui-routes 按 HEAD 检出场重生(清在飞面污染,worktree=登记制 .worktrees/) (9ef1520d293)
- 🔧 Chore/Other:两端 ui-routes 派生件按 HEAD 面重生(G5 陈旧清账) (7da265ab7ad)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 237 · 缺口 11) (d56f39c1ead)
- 🐞 Fix:壳声明件收回 HEAD 面同形(148→144 段,摘 4 枚别席未入库页的幽灵段) (a6d739f94ea)
- 🔧 Chore/Other:壳声明件跟随 coupon 直载页重生(148 段,含他席在飞 4 段) (a8ec51d9aa3)
- 🚀 Feature/Improvement:小程序 member/coupon 页迁为直载承载(第 16 枚手写页出桶) (a4727217e92)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f8ab3ed973c)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (facfc43e4b2)
- 🚀 Feature/Improvement:agents/edit 落共享源并接 RN 宿主(P0 跨端对齐第一枚) (bc1cfb81133)
- 🔧 Chore/Other:词包派生件跟承载补键重生成(remote +2 键族, b64 载荷与 manifest 同步) (c8ab98610f4)
- 🚀 Feature/Improvement:券/讲师共享屏落地新出口(条件渲染零像素)+规划器提示等价并入共享屏面(toastCovered/toastFullyCovered 增 sharedText 维:词条住在共享屏而壳装载它时不再误判'壳没有该提示';出口 appAlert/Toast 仍须住壳;S22 成对钉自检 28/28,三镜像 24/24,RN typecheck 6/6) (e3eec689604)
- 🚀 Feature/Improvement:共享屏补两枚交互出口 + 词包五语言同批补键 (559cd4c826b)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (c35f4089c52)
- 🔧 Chore/Other:词包派生件按 HEAD 面重生成(承载补键 2370→2667) (bc42b94f7c1)
- 🐞 Fix:承载键算式补裸字面量键表识别 + K6 用例补全 (a033a290e16)
- 🔧 Chore/Other:壳声明件跟随新落承载页(142 条说明符) (8c5a67af32a)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (460c1d93005)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 236 · 缺口 11) (aeed408107f)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (88aab4bc3ea)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (fcaaf5553d0)
- 🔧 Chore/Other:edu/dashboard 改判 aligned;settings/login-security 记录「只剩 passkey」 (ea003326f76)
- 🚀 Feature/Improvement:补「教育看板」屏 —— 单端点 /api/edu/dashboard,挂「学习」分区入口 (0cb8caafa61)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (47f51483e9e)
- 🚀 Feature/Improvement:安全中心补「重新生成恢复码」—— MFA 恢复码在 RN 侧此前完全没有入口 (511b2c40c17)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (40fbbaa48d9)
- 🔧 Chore/Other:壳声明件跟随新落承载页(141 条说明符) (8eb003c1542)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 235 · 缺口 11) (89836bfa485)
- 🔧 Chore/Other:给 member/settings 记 domainAudit —— 与 web 的有意分歧(web 页接的是坏路由) (79cbe1403e6)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (1dfd0f7af7b)
- 🔧 Chore/Other:agents/my 改判 aligned —— 我的智能体列表已有真承载 (65781503efd)
- 🚀 Feature/Improvement:补「我的智能体」列表屏 —— 走 /api/agents/my,入口挂「我的」页新分区 (97ede872737)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (19742a8618a)
- 🔧 Chore/Other:member/dashboard 改判 aligned —— 会员中心首页已有真承载(组合取数) (ec53c4324a6)
- 🚀 Feature/Improvement:补「会员中心首页」屏 —— 四卡 + 有效期 + 最近订单,数据按真身组合 (dc683835ed7)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a0e55b091b4)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a10d03d3dce)
- 🔧 Chore/Other:member/settings 改判 aligned + 三条 gap 写入本轮 recon 结论 (fa89b2c0824)
- 🔧 Chore/Other:壳声明件跟随新落承载页(139 条说明符) (5c8373e3782)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (d6b9f48b6fb)
- 🚀 Feature/Improvement:补「会员偏好」屏(通知四档 + 隐私三开关),并刻意不复用 web 那条坏路由 (e3a9e8b1489)
- 🔧 Chore/Other:壳声明件跟随新落承载页(138 条说明符) (7c5c46e2bbe)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 232 · 缺口 11) (59d28079c77)
- 🔧 Chore/Other:security-audit 改判 aligned —— RN 侧已有真承载(共享屏+宿主+入口) (ee40bb0ba0b)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (bb20b4fea8c)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (d7480b7a29d)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b538c947f09)
- 🐞 Fix:两处死传参删掉,PC 端 typecheck 转绿 —— backLabel / terminalReason 共享组件都不消费 (a11cc59c26c)
- 🚀 Feature/Improvement:域错配队列认手核结论 —— 行内 domainAudit 一旦写下就不再重复点名 (ad223e70285)
- 🚀 Feature/Improvement:Trae 一键切号——号池账号写回本机客户端登录态 (c463501b6ac)
- 🐞 Fix:circles/post 载体指针纠偏 —— 两端都 POST /api/circles,原指针指向社区发帖屏 (c3364c68474)
- 🐞 Fix:取回 automations 端点类型里被剥离的 terminalReason 字段(本地 A 桶纯丢失) (76fa6e82c6b)
- 🐞 Fix:正文闸的屏幕键口径漏掉驼峰命名空间 —— 40 余屏的文案面塌成 common.*，正常正文被算成"该屏渲染不出" (e2a497a8bb2)
- 🐞 Fix:OTA 卡片改按 expo-updates 原生模块存在性按需加载 —— 本机 debug APK 未编入该原生模块时,静态 import 会启动即抛 Cannot find native module 致整 App 红屏(12:49 实测复现);门内用 requireOptionalNativeModule 判存在性,缺失渲染空组件。真机实测:首页与广场正常渲染,分享徽章浮动动画、广场分类宫格图标均生效 (5fcbe332cac)
- 🚀 Feature/Improvement:把 OTA 更新提示真正装车 —— 补回 origin 已声明的 expo 依赖并挂载 UpdatePrompt (43623513bdd)
- 🐞 Fix:learn/[id]/homework 复位为 gap —— 课程作业与 SRS 复习是两套机制 (41bd0a41b6a)
- 🐞 Fix:域错配队列补回行身份 —— 上一版把 web/rn 段集合覆盖到 web/rn 字段上,队列不可点 (32f4ee60cc6)
- 🐞 Fix:复位两条「能力不同物」的 aligned —— RN 全仓无 mfa/passkey,安全审计事件也零消费方 (8bbd938db43)
- 🚀 Feature/Improvement:新增只读队列「aligned 却打不同后端域」—— 把 news 那类假对齐变成可复跑的一眼活 (2651d5e47f4)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (60554209a25)
- 🚀 Feature/Improvement:收藏屏补上小程序页独有的 6 档分类/统计行/空态 CTA (a53885e99b5)
- 🐞 Fix:清理 plan-hand 判据里一条重复且转义被破坏的坏正则行 (36324d723bb)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (8d37781e169)
- 🐞 Fix:shellFetchesData 认端内 api 层 + 优惠券壳接回屏重取(blob 落 HEAD) (ca27ee8858b)
- 🐞 Fix:硬编码正文闸改按"该共享屏消费的键"取作用域,词包按合并面读 (c6d3b606bec)
- 🚀 Feature/Improvement:资讯域入门户(/news)—— 一条入口让 list/分类/详情三段都在移动端可达 (5aea9dbda71)
- 🐞 Fix:shellFetchesData 认「import 过且出现 ≥2 次」的取数函数 —— 引用赋值形态不再漏 (f24996f71ba)
- 🐞 Fix:复位两条域错配的 aligned —— RN 的 Article* 走 /api/articles(社区文章),web 资讯走 /api/news/* (43b454fa0a6)
- 🚀 Feature/Improvement:购物车/N8N 模型两壳接回屏重取 —— 标准 useEffect(void load()) 形态 (5b468a1083c)
- 🐞 Fix:shellFetchesData 认 api-client 的具名取数函数 —— 三壳明明接了回屏重取却被判"没取数" (e489c995426)
- 🔧 Chore/Other:agents/edit/[id] 的 nextStep 写进四次 recon 的契约清单 (e4fe10daddd)
- 🚀 Feature/Improvement:RN 五语言新建 setting/message 两命名空间(operationFailed/deleted) —— 此前是缺整段不是缺单键 (1c721f33460)
- 🐞 Fix:转换判据统一遮注释——壳里一句注释曾把页面真钩子销成"已覆盖"(假销账) (bd08b40a28a)
- 🚀 Feature/Improvement:RN 五语言补 common.success —— 小程序一直弹它而 RN 词包缺键(影响 5 枚手写页的提示等价判定) (67db3f16104)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (8e89c324d21)
- 🚀 Feature/Improvement:判据把 CategoryBar 归位为端内 UI 设施 (84420b3bfef)
- 📚 Docs:给 VideoPlayer spec 的 4 枚 RN/web 单侧档补上裁定注记(小程序腿用原生 video,不自绘控制层) (4891535c526)
- 🔧 Chore/Other:更正 skills-market/[id] 的 nextStep —— RN 的 AiSkill* 与 web 的 skills-market 是两个域 (165cd1fac0b)
- 🔧 Chore/Other:给判据腿补 node --test 回归锁(10 例) —— 此前只有可被跳过的 --self-test (6e9802b0477)
- 🐞 Fix:取回 8 枚被清理枚删掉的共享层文件(纯丢失 + 有活消费方;带 LAND_ALLOW_STALE 留痕) (ed73eeaa30d)
- 🔧 Chore/Other:壳声明件跟随 teacher/list(按 HEAD 面派生) (8132d88a02e)
- 🚀 Feature/Improvement:门户不变量升为提交门(门 256)—— 存量 0 零容忍;README 点名满足 R4 (2ac00bd3281)
- 🚀 Feature/Improvement:第十三枚手写页落地(teacher/list) —— 端点 /teacher/list、搜索上抛、TeacherDetail 跳转与壳逐项对齐 (137979064ea)
- 🚀 Feature/Improvement:判据把 FocusField/SearchBar 归位为端内 UI 设施 + useRouter 与 getCurrentInstance 同族销账 (78fee82c755)
- 🚀 Feature/Improvement:判据把 FocusField 归位为端内 UI 设施 —— 它只说明页面渲染了输入控件,不说明有独有行为 (a7bf2dde39a)
- 🚀 Feature/Improvement:文章/问答/动态详情三壳接回屏重取 —— IIFE effect 加 reloadKey,bump 即重跑 (1372c9c5890)
- 🚀 Feature/Improvement:VIP 屏壳接回屏重取 —— load 带可选参,回屏刷新与小程序 useDidShow 对齐;弹窗分支仍由原 effect 负责 (dc36236d9dd)
- 🐞 Fix:闭包尺遇星号导出即抛栈——磁盘面整条 i18n/出包链被打穿,补 guard 并加 K6 锁 (77d625bd570)
- 🚀 Feature/Improvement:收藏/关注/订阅三壳接回屏重取 —— 走分页 hook 的 refresh,回屏即重置分页重载 (46770c72d16)
- 🔧 Chore/Other:edu/dashboard 撤掉误配的载体指针 —— 共享屏 StudyIndexScreen 是「AI 视频页」,不是教育看板 (347a6d10281)
- 🐞 Fix:三方合并恢复 slash-commands 的 review-target 系列出口(带 LAND_ALLOW_STALE 留痕) —— 解除 web 第二个 Next Build Error (7e729c2ca1d)
- 🚀 Feature/Improvement:错题屏壳接回屏重取 —— 复用既有 reloadKey 机制,回到该屏时重置分页并重载 (b2b9ec37fa9)
- 🔧 Chore/Other:cloud-run 改判 excluded —— 与 /cloud-agent 同一屏同一实现,不是第二条缺口 (a5d26467dc4)
- 🚀 Feature/Improvement:消息中心壳接回屏重取 —— 小程序侧 useDidShow 刷新在 RN 侧有了同等实现 (47ce80d2d1a)
- 🚀 Feature/Improvement:门户尺子加 W3 —— 条目指向的 web 路由必须在同一被审面真存在(否则用户点开是 404) (cd209100c95)
- 🐞 Fix:恢复 stream-handlers 被清理枚删掉的 createReviewFindingHandler 等出口 —— web Next Build Error 的直接成因 (0e2ae0b9927)
- 🚀 Feature/Improvement:门户表↔端内词包 不变量尺子(只读)+ 镜像 9 例 (1c960e8435c)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (844c43a8562)
- 🔧 Chore/Other:壳声明件跟随 account-pool(按 HEAD 面派生) (88a9a926e67)
- 🚀 Feature/Improvement:第十二枚手写页落地(account-pool 171→23 行,壳承载 + AuthReadyGate) (f378b1cc0b9)
- 🐞 Fix:取回 14 枚被清理枚删掉的纯丢失文件(A 桶误删 + 预检逼出的依赖) (60bf1c86597)
- 🐞 Fix:RN 账号池壳补「添加成功」反馈 —— 词条在册、小程序一直弹,RN 端此前静默 (579358b90c4)
- 🔧 Chore/Other:壳声明件跟随 edu-shop(按 HEAD 面派生) (63682ffbee8)
- 🚀 Feature/Improvement:第十一枚手写页落地(edu-shop 288→20 行) + 判据 toast 改为「逐条判」 (40c851eacfa)
- 🔧 Chore/Other:端内词包按 HEAD 面重生成 —— 把 ranking.anonymous 落进产物(G5 判的是产物钉==HEAD 输入) (8fc073c261c)
- 🐞 Fix:补齐 ranking.anonymous —— 小程序承载页此前在昵称为空时显示原始键名 (0c4c20f3ede)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (3482205dafb)
- 🐞 Fix:恢复被清理枚整枚删掉的共享组件 packages/app/src/components/SectionHeader.tsx (a5612ccc267)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (71cec08df8e)
- 🐞 Fix:渲染复判缺结论行时出声——有出账才记、没出账不许读成无事 (2a2b754456d)
- 🐞 Fix:逐条拒因补进 --json 出口——上一版只接到打印档,调度器读的那份里根本没有这两个键 (d3a8f58acbf)
- 🚀 Feature/Improvement:回屏重取层扩到 7 个壳 —— useDidShow 一族从"缺层"变"壳侧已承担" (c55b4e6d617)
- 📚 Docs:把那行功能缺项的收益估算按实测改口——84 枚被拦页里只卡单一能力的仅 6 枚(2120 行),78 枚多能力纠缠;频次 68/43/41 是"沾过"不是"解锁",按频次排性价比会高估一个量级 (6c162793cd8)
- 🚀 Feature/Improvement:渲染复判的出账接上守护轮仪表——同一条派发的第二条腿不能再没有读数 (5165ea2a99b)
- 🐞 Fix:把 chat_message_sync_revs 的表定义恢复回唯一出处 schema/chat.ts,并摘掉上一枚多接的 barrel 行 (c8de5c54942)
- 📚 Docs:把刚量清的接缝补进那行功能缺项——取数在 RN 壳的 useEffect([],) 里、承载页 8 行、唯一单点 ThemeRoot 有抹掉表单态的副作用,remount/re-fetch 需先定夺 (571e0bbad98)
- 🐞 Fix:造页腿的"拒 N 枚"从此逐条点名——11 枚拒因旧档里根本不出账 (b1698efd82a)
- 🚀 Feature/Improvement:RN 侧补「回屏即重取」通用层(重落) —— 41 枚手写页卡在 useDidShow 的结构成因 (e1462387467)
- 🐞 Fix:门户承载识别补上"详情 URL 出口"这一族——参数路由不再是尺子的盲区 (448de53dccf)
- 🐞 Fix:造页闭环腿 10 分钟上限被顶穿是真停摆,抬到 30 分钟并把"被掐死"写进结论 (8b9c1e268c6)
- 🚀 Feature/Improvement:门户批次器物化 add-web-portal-entries(手工三批的同一条防线钉成判据) (92f364dc925)
- 🔧 Chore/Other:壳声明件跟随 ai-skill(按 HEAD 面派生) (135d368b7da)
- 🐞 Fix:补 chat_message_sync_revs 的 drizzle schema 与 barrel 出口 —— 消费方 apps/api/src/db/chat-sync-rev-queries.ts(枚 073bd769f85d 由自动收编入库)按名取用而出口从未落库,导致 api 从任何一棵这棵树都起不来(SyntaxError: @ihui/database does not provide an export named chatMessageSyncRevs) (0fcba562794)
- 🚀 Feature/Improvement:第十枚手写页落地(ai-skill 248→23 行) + 判据认「带选项的 appAlert = 确认弹窗」 (de29be94520)
- 📚 Docs:登记一格实测出的跨端功能缺项——RN/共享屏无回屏即重取层,41 枚小程序手写页因此转不成承载 (08513a86470)
- 🐞 Fix:收敛器把"孩子被超时掐死"与"子进程判了没写结论"分开点名 (b79b2e9e081)
- 🚀 Feature/Improvement:渲染复判接上第二型证据(专有键),并把落地器的"没判"出路从误导改成可执行 (c4206110d34)
- 🐞 Fix:判据两处真缺陷 —— toast 括号配对(模板插值) + 鉴权钩子的 useDidShow 归门承担 (97488d29dfa)
- 🚀 Feature/Improvement:第二批 11 枚零承载功能页进门户(97→108) (c99cb8b5d5f)
- 🚀 Feature/Improvement:云托管运行记录(/cloud-agent)进门户——第 7 枚零承载功能页收口 (afffd489384)
- 📚 Docs:还原度尺的文档口径改回现在真的那四形制,顺手折掉同一件事的三份登记副本 (076d224f1e2)
- 🐞 Fix:收回上一枚对十枚词包的静默回退——按 HEAD~1 面重建 + 只追加本票六键 (4b334584f21)
- 🔧 Chore/Other:壳声明件跟随 llm-settings(按 HEAD 面派生) (ebacee138f5)
- 🚀 Feature/Improvement:六枚「RN 零承载」功能页按 M4 门户约定收口 (1e7a0fb41c1)
- 🚀 Feature/Improvement:第九枚手写页落地(llm-settings 277→20 行) + 判据认「错误分支 toast」 (7cce05681ee)
- 🚀 Feature/Improvement:渲染推翻候选接成语义复判——同名≠同物的队列不再只能等人逐屏翻代码 (74ac70b5d00)
- 🐞 Fix:新装两条腿补上「瞎了要可见」 (80ef9702c46)
- 🔧 Chore/Other:壳声明件按现读 HEAD 面归位(移除 Dashboard/DomainHub/Login/McpStore 四段无引用声明) (97d469aed70)
- 🚀 Feature/Improvement:tokens.css 补 neutral 色阶源,RN 灰阶 9 档从手抄转派生态(写回值逐字相同) (ca13dcf9eee)
- 🚀 Feature/Improvement:装 dist 新鲜度自愈腿——workspace 包 dist 落后源码时自动重建,不再等人敲命令 (69f7b9c8c04)
- 🔧 Chore/Other:壳声明件按 HEAD 面重生成(user-public + 他席已入库页引用的 Dashboard/DomainHub/Login/McpStore) (49425634ed6)
- 🐞 Fix:oklch 解析补无彩轴 `none` 色相 —— 一个解析漏洞足以把"可零视觉同源"整族读成属主决策 (aa0f4d8e996)
- 🚀 Feature/Improvement:第八枚手写页落地(user-public) + 判据补「端点等价」销账 (5a48e1868c2)
- 🐞 Fix:转换预演"发现可转页"时退出码就是 1 —— 我的 conversion-available 维会把最该喊的那一刻判成未判定 (14a6ca3c657)
- 🚀 Feature/Improvement:门 93 认得 oklch 了 —— RN 同源链此前对整条 Tailwind v4 色板失明 (7edcb69853d)
- 🐞 Fix:落地后复跑档对门 98 补锚点 —— 消掉"每次旁路落地都把 16 条存量算成本枚新增"的假红 (05dcf432dc5)

**2026-10-27**
- 🔧 Chore/Other:壳声明件跟随三枚批量落地页(按 HEAD 面派生) (33292e65ddc)
- 🚀 Feature/Improvement:三枚手写页批量落地(任务中心 423→20 / 广场详情 334→20 / 公告详情 188→20,共省 885 行) (50537b1e419)
- 🔧 Chore/Other:壳声明件跟随 fans 页(按 HEAD 面派生) (79a6c3e132f)
- 🐞 Fix:转换落地器写死了默认导入而壳只有具名导出 ⇒ 页面渲染 undefined;引法改按壳的现读导出定 + 补水印与组件名,顺带落地两枚手写页 (c94567126cd)
- 🚀 Feature/Improvement:第七枚手写页落地(fans 手写 → 壳承载) (d0e3faa0b53)
- 📚 Docs:门 128 跨端几何差票就地记进展(三对已现读复量、navbar-spec 假话与悬空指针已修、carousel 族 SL 失明归在飞席) (48f8dba36c2)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (ee7599396ef)
- 🔧 Chore/Other:壳声明件跟随 ai-skill/detail(按 HEAD 面派生) (d41cf64bd50)
- 🚀 Feature/Improvement:分诊探针改吃「判过缺口」集,并把入口归属收回尺子一处 —— 50 条缺口从此有机器预消化 (1f05a5c51f2)
- 🚀 Feature/Improvement:第六枚手写页落地(ai-skill/detail 241→23 行) + 生成器「鉴权就绪门」通道 + 提示等价判据 (cbff96231b0)
- 🐞 Fix:入口可达性补动态段归并 —— 上一枚自带的 6 条假阳就地自纠 (83c5307e38b)
- 🚀 Feature/Improvement:第五枚手写页落地(announcement 224→20 行) + 壳声明件跟随 check-in (6b67c666d61)
- 🚀 Feature/Improvement:对账尺补「入口级可达性」维 —— 把"50 条判过缺口"换算成"用户点得到的 13 条" (6c9893f33d2)
- 🐞 Fix:navbar-spec 单腿归属改真,并把 5 处悬空指针指回实际存在的那一节 (0bff00fb9e5)
- 🚀 Feature/Improvement:第四枚手写页落地(check-in 361→14 行) + 通用「鉴权就绪门」组件 (459c4740de4)
- 🐞 Fix:RN 导航器具名导入形态此前整批解析不到 —— 路由映射表 41 → 213 条,修运行时"点了不动"与转换门假缺口 (5169732f185)
- 🚀 Feature/Improvement:判据补齐最后一批"平台惯用法等价"(主题/返回/路由参数),拦路表只剩两类真业务差异 (eb2753c88ce)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (1ef4f0b5879)
- 🔧 Chore/Other:壳声明件跟随 activity 页 + 判据补"触底/确认弹窗/剪贴板"三条平台等价 (10afbc37f34)
- 🐞 Fix:补回 HEAD 缺失的 writeVerdictRows 导出 —— 消费方早已按名 import,干净检出上加载即抛 (33fc61db569)
- 🚀 Feature/Improvement:第三枚手写页落地(activity 258→20 行) + 判据认三类"平台惯用法等价" (952a8fc02d7)
- 🚀 Feature/Improvement:RN 色档「等值即入表」挂上守护节拍 —— 补上"造好没装车"那一格 (fb1be8742c9)
- 🚀 Feature/Improvement:手写页自动升级接进守护轮(30 分钟,cap=2)—— 判据腿/落地腿此后自走 (7d3a766cec9)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (d8982f97a9b)
- 🔧 Chore/Other:壳声明件跟随第二枚落地页(usage-rules) (e17ab1f3684)
- 🚀 Feature/Improvement:第二枚手写页落地(usage-rules 460→26 行) + 正文闸改按词包比对 + navTitle 通道认 tt (441b848e80d)
- 🚀 Feature/Improvement:RN 色档同源判据加第三条(末段同名)+ 认下门内已登记分歧,再收 8 档派生态 (9a3b6909e5e)
- 🚀 Feature/Improvement:漂移尺补 web→RN 侧涨跌维 —— RN 承载被拆与新页无人判过不再只有小程序侧会喊 (b4d9dfeaf1d)
- 🚀 Feature/Improvement:漂移尺补 web→RN 侧涨跌维 —— RN 承载被拆与新页无人判过不再只有小程序侧会喊 (36fb0177939)
- 🚀 Feature/Improvement:规划器认「跳转已被壳覆盖」——route-map 反查 + 壳正文出现该路由名才销账 (a54e4be9a9f)
- 🚀 Feature/Improvement:新增手写镜像页进差值棘轮(不许再产第二份重复实现) + 壳声明件跟随首枚落地页 (2ebb60ee2b5)
- 🚀 Feature/Improvement:漂移尺再吃两路现读 —— 还原度补"转换机会窗"维,守护轮从此能喊出可转壳承载的页 (5b0b8dcea4e)
- 🚀 Feature/Improvement:首枚手写页转壳承载落地(agreement 53→26 行) + 三条判据补真:React 钩子/标题钩子/硬编码正文 (18e51a75559)
- 🚀 Feature/Improvement:RN 手抄色档转派生态的**发现器**装车,并把 30 条同值配对登记进门 93 (7f204dbe341)
- 🚀 Feature/Improvement:还原度维接进漂移尺与"倒退⇒到人"链 —— 小程序镜像"真还原了多少"不再只有人工跑才看得见 (7bcb05ef98c)
- ♻️ Refactor:手写页转壳承载收敛成一条腿(判据腿=规划器) + 端内通用 UI 设施不再冒充私有能力 (15fcb902a8b)
- 🚀 Feature/Improvement:手写镜像页→壳承载的自动降级器物 + 还原度尺认「直载共享屏」与双路由锚点修复 (ae81c346494)
- 🚀 Feature/Improvement:手写镜像页转壳承载的规划器(带安全闸 + 拦路符号经济账)—— 小程序"自动跟随 RN"这一格的剩余面被量准 (e299edb7e92)
- 🚀 Feature/Improvement:样式派生面进守护轮自动同步 —— heal-derived-in-checkout 加 tokens 一族,git-guardian 加第四条腿 (7b14bf63159)
- 🐞 Fix:摘掉门户表里指向不存在 web 路由的瓦片(RN 点开即 404) (bd2892e2c8a)
- 🐞 Fix:还原度尺认「异名壳承载」—— 5 枚合法委托的量具假分叉归零(other 5→0、missing 700→661、hosted 108→113) (0673bd75f39)
- 🐞 Fix:web→RN 对账尺补「门户承载」推导维,根除只能靠人翻代码推翻的假缺口 (6aea1c8d49f)
- 🐞 Fix:还原度尺认壳承载委托链——量具假分叉修除(missing 1703→700、avg 10.8%→63.4%),形制分四桶并新拦两型旧尺结构上打不到的缺陷;顺带修基线不可解析的静默冒绿 (d7f4714ba8d)
- 🐞 Fix:「我的」页会员权益块补屏幕边距 + 4 Tab 与三枚菜单入口消裸键 (36ec70bc8af)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (84e8bd2cc7f)
- 🔧 Chore/Other:壳声明件跟随新落承载页(119 条说明符) (978daadd2bc)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 231 · 缺口 11) (4aa1339c14b)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (64a0e6e9f09)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (0c798de8dc0)
- 🚀 Feature/Improvement:legal.* 六键×五语按端间只增不改搬进 mobile-rn/miniapp-taro —— web 侧逐语种原样同步(数据等值断言在应用器里过),解 RN LegalDocsHub 原始键显示并解封最后一枚小程序镜像页(legal-docs-hub) (032c94548cd)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (403855087d0)
- 🐞 Fix:门 251 的两条修复出口真正跑通 —— 生成物按 HEAD 面重生成,两把尺子回填同形判据 (06e9b60af68)
- 🐞 Fix:/registry 归还 aligned —— 与同批三条同源映射,只有它漏登 (dc36d37d48d)
- 🐞 Fix:/knowledge-cards 归还 aligned —— RN 抽屉里早有显式映射 (089fb1c06d1)
- 🐞 Fix:门 150 最后 3 族圆角越档归位 —— 8→0 (4ae0e6caed8)
- 🐞 Fix:7 处圆角越档归位 —— 门 150 的 8 个判红族按角色档收口 (a316bc434be)
- 📚 Docs:巡检腿与常驻器物单列一节,并把 §8.5 里跑不通的出路改掉 (04b4733d459)
- 🐞 Fix:空态徽章圆角两端同取 2xl —— RN 侧写 50% 会让两端一个圆角方、一个正圆 (fc73de27888)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 230 · 缺口 12) (5e903e43bec)
- 🐞 Fix:样式对齐门从「import 就崩」恢复可跑 —— 补回 9fdbc207 清理掉的 5 个 lib 导出 (284d7178de4)
- 🚀 Feature/Improvement:gap 队列标出「工作形态」—— 每条候选是补宿主还是要新建,成本一眼可见 (2a4f4e29baa)
- 🐞 Fix:离线包重生成从 59 分降到 12 秒 —— 闭包探路不再为"不存在的路径"起 git 进程 (09ef0a5e322)
- 🐞 Fix:/user/comment 归还 aligned —— 与 /comments 同功能,RN 一屏承载两条 web 路由 (1ac38d3e69d)
- 🐞 Fix:/comments 归还 aligned —— 端点、分页与删除语义两侧逐条对齐 (722d802aa4d)
- 🐞 Fix:两条 gap 归还 aligned —— 发帖与佣金订单在 RN 侧都有同一功能的承载屏 (398ef73d0a2)
- 🐞 Fix:/following 归还 aligned —— 承载方是 FollowScreen,不是那份无人渲染的变体 (4f33a72090b)
- 🚀 Feature/Improvement:web→RN 对账补「gap 待复核」队列 —— 72 条已判缺口里有 61 条存在同名候选 (09c4d838dd6)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (0dd3668d18f)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (bf48864feee)
- 📚 Docs:两枚零消费共享屏判「不承载」留证 —— 财务汇总与评价详情在任何端都没有渲染方 (753fffa5ef5)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 230 · 缺口 12) (ee102e52fae)
- 📚 Docs:两枚零渲染屏判「不承载」留证 —— 帮助详情与关注列表在 RN 侧已有等价承载 (861b6d403ab)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 230 · 缺口 12) (4a61854f86b)
- 🔧 Chore/Other:自动落 2 枚小程序壳承载页(共 2 枚待产) (b3f15c481fe)
- 🐞 Fix:路由被别屏占用不再判「本屏已落」—— 两枚卡死页改道镜像分包 (fba8d80884a)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (d8c2cf9fdda)
- 🐞 Fix:web→RN 对账拒收「名义对齐」—— 共享屏在、无人渲染不再是 aligned (65680b784b6)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (90d823156f4)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b9b6bcee073)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 228 · 缺口 14) (45895247286)
- 🔧 Chore/Other:自动落 4 枚小程序壳承载页(共 4 枚待产) (4ed2c3c7e09)
- 🚀 Feature/Improvement:支持「不同名 RN 承载体」—— 5 枚被"同名"卡住的屏零开发解锁 (da698b85d9d)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 224 · 缺口 18) (4500bbfaceb)
- 🔧 Chore/Other:自动落 2 枚小程序壳承载页(共 2 枚待产) (0566d947ddb)
- 🐞 Fix:派生产物自愈腿补回从未定义的 prefetchUiInputs —— ui-routes 那条腿此前跑到就崩 (e5b280e77c4)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (29ca03bb465)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 222 · 缺口 20) (5891869b5d3)
- 🔧 Chore/Other:重落 5 枚被容量临时摘除的承载页 —— 摘页的原因已消失 (e29e7ee2d9e)
- 🐞 Fix:装配只交「真变了」的词包 —— 空词条组不再把未变文件塞进 blob 清单 (117a362bf80)
- 🐞 Fix:壳承载两条「无事可做=失败」收口 —— 通用键屏与空词条组不再卡死造页闭环 (6957d267938)
- 🔧 Chore/Other:壳声明件跟随新落承载页(105 条说明符) (fc6031fc27a)
- 🐞 Fix:造页器「页已落」判据改成双条件 —— 5 枚半落地页不再永远跳过 (0bf6d07f3e4)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 217 · 缺口 25) (f0bbbe475a3)
- 🔧 Chore/Other:自动落 4 枚小程序壳承载页(共 4 枚待产) (284abfc5e5d)
- 🐞 Fix:检出档收口三格 —— 一轮钉同一枚 sha、离线包改在主仓按被审面跑、落地成功与"别的门仍红"分开报 (35422d0ba31)
- 🔧 Chore/Other:自动落 5 枚小程序壳承载页(共 9 枚待产) (84c1271605c)
- 🐞 Fix:分包总量消重 —— 根桶副作用豁免,9 份 707 KB 目录块收回 1 份 (8e1817fb8d2)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (1429d5705fc)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (db087fdc4c2)
- 🔧 Chore/Other:自动落 2 枚小程序壳承载页(共 11 枚待产) (15a3e7bbbfe)
- ♻️ Refactor:派生产物落 HEAD 只留一条接缝;按 HEAD 建检出重生成,不再被滞后工作树卡死 (977cc184701)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (392181b89a7)
- 🔧 Chore/Other:自动落 2 枚小程序壳承载页(共 13 枚待产) (2c8d5196b1d)
- 🔧 Chore/Other:四端 ui-routes 派生产物自走落地 —— 补 G5 在旁路落地那条通道上的写回出口 (60371172d9c)
- 🚀 Feature/Improvement:修掉离线包自述钉的两处不同形,并给三处"只判不修"装上写回/到人腿 (013a9112e24)
- 🔧 Chore/Other:撤回桌面图标档器物 5 枚 + git-guardian 回退到 43c56167ece^ (d91b99f8e3b)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 204 · 缺口 38) (ba9490af2e6)
- 🐞 Fix:桌面图标档自愈不得把"量不到窗口数"读成"没人开窗口"(补镜像测试 21 例) (0f81e07a4d5)
- 🔧 Chore/Other:自动落 2 枚小程序壳承载页(共 15 枚待产) (9642fbfdc1e)
- 🐞 Fix:桌面图标档漂移对账器 + guardian 巡检自愈腿(治"间距突然变大") (43c56167ece)
- 🐞 Fix:摘掉上一枚还原带来的重复声明 + 把壳声明件刷到与在册页一致 (e28a8a04aef)
- 🐞 Fix:还原被"清理回退残留"删掉的跨账号内容泄漏修复 —— 补安全洞,也补 HEAD 上的类型断链 (9b9926bbbe9)

**2026-10-26**
- 🔧 Chore/Other:自动落 2 枚小程序壳承载页(共 17 枚待产) (ab76aa7b425)
- 🔧 Chore/Other:壳声明件跟随新落承载页(88 条说明符) (f0911228d19)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 200 · 缺口 42) (3021487c6e5)
- 🔧 Chore/Other:自动落 2 枚小程序壳承载页(共 19 枚待产) (63dee6faf27)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (3b58608133a)
- 📚 Docs:207 体积预算清偿 —— 上一枚容量条把预算吃到只剩 11 字节,下一位改文档的人必红 (6419b299ef5)
- 📚 Docs:第四次摘掉「国内镜像」徽章与两条死仓链接 —— 收门 238 在 HEAD 上的既存红 (68cf199cdc2)
- 📚 Docs:容量快照刷到最终真构建读数(队列已清空,含 home) (e21690fe793)
- 🚀 Feature/Improvement:容量闸补上「整档 20 MiB 总量」维 + 门 110 补 AB4 —— 逐包都绿也可能整档传不上去 (7abd2be3bae)
- 🔧 Chore/Other:壳声明件跟随新落承载页(86 条说明符) (376bdee26cf)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 198 · 缺口 21) (309cdfce379)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (2bb8c6e4cff)
- 🐞 Fix:词包并键档从"只并顶层直接子键"改为递归只增不改 —— 拆掉待产队列最后一枚 (3ecab00ce1f)
- 🔧 Chore/Other:壳声明件跟随新落承载页(85 条说明符) (d756e37b5da)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 197 · 缺口 22) (cb2ece40a5b)
- 🔧 Chore/Other:自动落 35 枚小程序壳承载页(共 36 枚待产) (6b0df38b91f)
- 🐞 Fix:pkg-user 分包超 2 MiB 上限 13,111 B —— 摘 8 枚镜像页让容量判据重新路由 (ee5ff98b0cd)
- 🐞 Fix:容量标定按真构建回灌 + 一屏接缝失败不再拖死整批 (ef5e0549924)
- 🔧 Chore/Other:壳声明件跟随新落承载页(58 条说明符) (809e5d74216)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 170 · 缺口 49) (2de1370f988)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 37 枚待产) (782ced81919)
- 🔧 Chore/Other:壳声明件跟随新落承载页(57 条说明符) (29479d1f704)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 169 · 缺口 50) (b28eff6fd51)
- 🔧 Chore/Other:自动落 39 枚小程序壳承载页(共 76 枚待产) (59952e3c2f9)
- 🔧 Chore/Other:壳声明件跟随新落承载页(18 条说明符) (2281a2d26de)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 130 · 缺口 89) (90247f592e4)
- 🔧 Chore/Other:自动落 2 枚小程序壳承载页(共 78 枚待产) (e31f115ebb4)
- 🚀 Feature/Improvement:造页闭环按「单分包 2 MiB」自动改道 —— 溢出屏进新分包,自动链不必再等人开包 (41fbba61c07)
- 🐞 Fix:造页闭环补上壳声明件自刷腿 —— 每落一枚承载页就多一条 @rn-shells 引用,不重生成门 251 C9 就红 (3b58136d3ba)
- 🔧 Chore/Other:自动落 2 枚小程序壳承载页(共 80 枚待产) (9402b257223)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 126 · 缺口 93) (cb77b66a83d)
- 🔧 Chore/Other:自动落 2 枚小程序壳承载页(共 82 枚待产) (ecf233441c7)
- 📚 Docs:容量上限那条压回 96KB 体积预算内 —— 首次落地多写 463 B 顶穿了门 207(96,396 > 96,000),删去实现细节只留判据指针与单源路径;细节在 commit 61ee5eb38efa 与 scripts/lib/cross-end-subpackage-capacity.mjs 头注。 (c5f5fb6d6bd)
- 🐞 Fix:造页闭环补上「单分包 2 MiB」容量闸 + 修单行 pages 数组致停摆 (61ee5eb38ef)
- 🚀 Feature/Improvement:系统状态屏 —— 补上 web→RN 最后一条未映射路由,收起缺口账本的登记腐烂 (960533871a7)
- 🐞 Fix:三端头像圆角同取一档(circle→md / square→lg)—— 容器禁 rounded-full 后三端同形 (c898912a64b)
- 🚀 Feature/Improvement:恢复跨端 UI 契约下沉(二期)—— 7 族 spec 单一源 + 两端薄壳 + 源码级契约测试 (1b757b05518)
- 🐞 Fix:门 8 复活 + 门 253 补 D3 —— 一笔"回退残留清理"把方法推导副本塞回门体并删掉 lib import,门一跑就 ReferenceError (5b51a35168e)
- 🐞 Fix:账本自刷的提交信息改取"读数行" —— 标题行不是证据(反向锁补进自检) (739cccd5d9f)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 124 · 缺口 94) (4087e011ede)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 82 枚待产) (26b63040063)
- 📚 Docs:自动同步缺口账本到现读口径(镜像缺口账本(自动生成)) (a63e21a1c76)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 83 枚待产) (b52976049c6)
- 🐞 Fix:账本自刷腿补上横幅注入档 —— 生成器产的是纯正文,缺载荷先注入再判(否则每轮被自己拒落,doc-stale 长挂) (3dcccdad741)
- 🔧 Chore/Other:自动落 2 枚小程序壳承载页(共 85 枚待产) (bee23fe1981)
- 🚀 Feature/Improvement:造页闭环补上"账本自刷"腿 —— 落完页按新 HEAD 把缺口账本一起刷进仓,漂移尺不再每批叫人重跑生成器 (35bc36133f9)
- 🐞 Fix:小数档整族退出 CSS 候选集 —— 守门 C8 fractional 0→4 的归因与正解(构建真跑现读) (ccf0fa3d475)
- 🔧 Chore/Other:自动落 2 枚小程序壳承载页(共 87 枚待产) (56d1e74f41a)
- 📚 Docs:缺口账本重生成到现读口径(镜像 118/共享屏 218/缺口 100)—— 漂移尺 doc-stale 的唯一出路是重跑生成器 (336dc5ecf94)
- 🐞 Fix:造页闭环静默停摆 8 小时根治 + 小程序兼容层类型清零(240→0)—— 瞎了的格子必须自己喊人 (099e56f5130)
- 🚀 Feature/Improvement:C10 功能轴词包装载 —— 承载页可达键算式单源进生成器与门 251 (40507b8f5ab)
- 🐞 Fix:补 /api/articles/:id 详情路由 + RN 契约字段映射 —— RN ArticleDetailScreen 一直在打这条不存在的路由(详情链路 100% 404,而 watch-aspect 早已预置该 URL 浏览计数拦截,证明缺的是路由不是屏);表列 authorName/coverImage/viewCount 与 packages/types 契约 author/cover/views 不同名,只增契约键不删表原键(Web/admin 既有断言不受影响)。新增 mock 契约测试 7 例(路由命中/契约取值/原字段守恒/未发布与不存在 404/非法 id 400),默认入口即跑,不依赖当前坏的 real 库通道。 [cross-domain] (4b7310f756a)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (6546edcac74)
- 🐞 Fix:壳注入腿改按"解析到哪模块"判定 —— 小程序端不再逐页内联 RN 词包(单页 1,382,817 B → 24,175 B) (bab8d3d28a0)
- 🐞 Fix:解开 optimizeMainPackage 的同名 chunk 相撞 —— 主包 2,529,656 B → 1,659,047 B(回到微信硬上限内) (9d1fa0ac6d9)
- 🔧 Chore/Other:给刚落地的闭包前置补装车锁 K5 —— 判据与拒则必须相邻,表读不到即未判定 (86366626fe1)
- 🐞 Fix:weapp 构建的致命 ModuleParseError 根治 —— 四枚 RN 原生包补端内承载,并把"闭包射程"装进造页器 (c54cb0aeef0)
- 🐞 Fix:构建警告与悬空路由一律变成门维度(C6/C7/C8/C9)+ 补上壳承载的编译期契约 (bdf93938b7e)
- 🐞 Fix:摘掉 2 枚编不过的壳承载页 + 把"壳必须存在"装进两把尺子与器物拒则 (938065c109a)
- 🚀 Feature/Improvement:守门 255 装车 —— 替换器自己就是拦新增的那把尺 (38d1362111d)
- 🚀 Feature/Improvement:端内 34 处色值字面量改走源档 —— 替换器 + satisfies 形态 + 归因后才落地 (b8533399419)
- 🐞 Fix:覆盖面表接上桶口 + 守门 254 改判索引面 —— "生成好了但取不到"是同一条链的第二格 (06498b55c60)
- 🚀 Feature/Improvement:RN 令牌表补上"覆盖面"这一维 —— web 改一处,RN 有档可走才是自动同步 (e04444de231)
- 🚀 Feature/Improvement:跨端造页闭环装车 + 门 252/253 注册 + 一起安静停机的根因修复 (a4256e1a82f)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (867451706d5)
- 🐞 Fix:12 个 workspace 包的 exports 补 default 条件 —— 跨端复用的总前置(CJS 解析条件原本一条都不命中) (e91d8c38ed9)
- 🔧 Chore/Other:撤回 more-course 壳页 —— 实测主包 2 MiB 硬上限被顶穿(无该页 1,723,572 B/余量 373,580 B;加该页后 2,449,620 B ⇒ 超 352,468 B),optimizeMainPackage 开启复现 Taro 4.2 chunk 相撞(build exit 1);壳页保留在生成器里但不再落仓库,并把'铺开前必须先解决共享依赖落点(建议壳页集中到同一分包)'写进器物头注与每条输出提示。 (8ec5438a186)
- 🚀 Feature/Improvement:rn-compat 生成腿接进提交链派生表 + 声明不复用页的转换判定器(五条拒绝判据) (5bafc199de7)
- 📚 Docs:登记跨端自动化复用腿结清票 —— 小程序端承载共享屏与 RN 壳(rn-compat + @rn-shells + RnShellReplacePlugin + 守门 251 四维含 C4 结构复用棘轮 + 生成腿接进提交链派生表 + 转换判定器)。取证 sha 6b7b5a537a32bf7d54a952961e1cbcddfd3e68cd / f455628f239d0bd5e6364074f23d20f355cf9166。行按 EOF 追加,底稿取 HEAD blob,不读工作树副本。 (0972d9a3520)
- 🚀 Feature/Improvement:自动产 6 枚小程序页(壳承载形制)并同批改齐四条接缝 —— 造页器的接缝档在"他席在飞"时正确拒落,半落地状态不留盘 (f455628f239)
- 🚀 Feature/Improvement:守门 251 增 C4「结构复用」维 —— 把「声明镜像 ≠ 复用」变成可拦的一维 (39be2a9a7ce)
- 🚀 Feature/Improvement:守门 251 装车 —— check-rn-compat-coverage 注册进提交链(blocking,stagedTriggers 收到能造出该状态的那一面:rn-compat/config/packages.app/apps.mobile-rn),AGENTS §守门速查的 R4 点名行同批带上(已接线而文档不点名=红,§0.9 造好没装车=没有)。 判据三维:消费面 react-native 具名取用 ⊆ src/rn-compat 出口(类型位含)、lucide 名 ⊆ icons-generated(名字全集 import 生成器 __test__ 那一份实现,§0.6)、route-map 目标页必须真在 app.config 在册;读到 0 条映射一律落未判定不记绿。绝对零容忍。 立门当天量到的 18 处真实缺口已在 8cc5c831128d 补齐,故本次注册不带存量红。 取证:check-rn-compat-coverage --self-test ⇒ 6/6(含摘掉即翻红/取不到面即未判定);--worktree ⇒ C1 0 / C2 0 / C3 34 条 0 缺。 落地方式:工作树副本落后 HEAD(缺他席 2026-10-25 GOAL 合入的复原注释两行),整文件交会把别人的行写回旧态 ⇒ 走 object-space-land 以 HEAD 为底构 blob(追加 18 行、删 0 行,断言不过即拒)。 (6b7b5a537a3)
- 🚀 Feature/Improvement:小程序承载 RN 壳的注入腿 + 兼容层缺口补齐 + 修 @ihui/shared 的 exports 条件真值 (8cc5c831128)
- 🚀 Feature/Improvement:再解锁 24 屏 —— 就绪尺第二批:补 expo-device(modelId 走系统信息)、expo-web-browser(普通网页走 web-view;认证会话显式按取消返回,绝不假装 success 让调用方等永不到的回跳)、expo-linking(初始 URL 由启动参数合成、监听空实现返回可 remove 句柄);两处 alias 块同步登记。就绪率 83.15%→256/279(91.76%);单测 11/11;taro build --type weapp exit 0。 (808da5c89a3)
- 🚀 Feature/Improvement:解锁 279 屏复用前置 —— 就绪尺现读三处引入点锁死全量(theme/active-tokens 引 react-native-restart+expo-file-system=279 屏、theme/color-scheme-sync 引 nativewind=267 屏);新增 rn-compat/native-extras(File/Paths 由本地 Storage 承载、二进制写入不落盘且只告警一次、restart 空实现但绝不抛、colorScheme 保留读回)并在两处 alias 块补三条别名;就绪率 0%→232/279(83.15%),单元 7/7。 (f84cd7b1287)
- 🚀 Feature/Improvement:RN 壳复用就绪尺 —— 小程序端已有共享屏源+rn-compat+@rn-shells 别名,但"280 个 RN 壳还差哪些模块才能原样跑"此前无人能量;新尺从 HEAD 面求 import 闭包,现读别名表与 workspace 依赖,逐屏判 ready/blocked 并给出缺口模块的引入点。现读 279 屏/就绪 0:三个核心引入点锁死全量——theme/active-tokens.ts 引 react-native-restart+expo-file-system(279 屏)、theme/color-scheme-sync.ts 引 nativewind(267 屏);补这三枚 shim 即可解锁近乎全部屏。@/ 语义风险单列(会静默绑到小程序树)。镜像 7 例含 type-only/资源/前缀别名/@ 优先级四条反向锁。 (728747bef07)
- 🔧 Chore/Other:兼容层转译锁 —— rn-compat/style.ts 是「一份共享屏源两端渲染」的承重墙,单位/无单位键/阴影/变换/截断任一格译错都会整屏走形而类型检查抓不到;新增 20 例语义锁(数字 1:1 落 px 且绝不产 rpx、flex/opacity 保持数字、var()/calc 原样透传、numberOfLines 折 line-clamp、iOS 阴影折 box-shadow、transform 数组折串),vitest 20/20。 (c9ded8217b4)
- 🚀 Feature/Improvement:裁决件词表适配层 —— 子代理 verdict 用 mirrored/missing/not-applicable,而落地器只认 aligned/excluded/gap,不匹配档既不落地也不进 refused ⇒ 229 条裁决会在最后一公里静默消失。新器只做一处归一(mirrored→aligned、not-applicable→excluded、missing→保持缺口)并对未知值大声拒收,写盘/判断全部委托 auto-register(零复算);镜像 8 例含落地器接受词行为锁;自检 10/10。 (03d745db63f)
- 🚀 Feature/Improvement:小程序端接上「共享屏源 + 平台 adapter」复用腿 —— 一份源两端渲染,不再逐屏手写 (d1dc35c331a)
- 🚀 Feature/Improvement:镜像声明链自愈装车 —— repair-cross-end-mirror 此前无调度器(门 128 R1 红了没人接回),现由 git-guardian 的 healCrossEndMirror() 30 分钟轮调度:只补登记表已声明的缺口、他席在飞一律拒落、只留日志不喊人(拒落属常态)、结论不可用记未判定不记绿;镜像 7 例含生产方 --json 契约锁;AGENTS §1 补点名。共享索引仍被并发会话占用,走 HEAD 基线 blob 单独落地。 (edf00be9977)
- 🐞 Fix:漂移尺 docNumbers 读回生产方真标签 —— gaps 曾按『缺口(未判定镜像)』解析,而 report-rn-miniapp-gaps 现写『缺口合计』⇒ gaps 恒 null、C9 阳性对照在 HEAD 恒红(消费者读生产者从不发射的标签);改读缺口合计并保留旧标签兜底,尺子自测 9/9。 (2b2dbd46dbb)
- 🚀 Feature/Improvement:跨端漂移尺真正装车 —— check-cross-end-parity-drift 此前全仓零派发(判据齐全却无人调度),现由 git-guardian 的 auditCrossEndParityDrift() 60 分钟轮调度:ok 只留读数、regressed 按倒退维到人(正文自带可执行下一步)、undetermined 只写未判定不记绿;镜像 6 例用尺子自身 judge() 现造夹具不抄状态名;AGENTS §1 只读尺子清单补点名;共享索引被并发会话占用,故以 HEAD 为底构造 blob 单独落地,不触碰他席暂存。 (fba15059e50)
- 🐞 Fix:修合并回灌截断的 guardian-runner.mjs(语法坏 ⇒ push 门编排器跑不起来)+ 补 README 速查节 6 枚门点名 + 修门 193 存量红 (bcfee6e2690)
<!-- END RECENT UPDATES -->

## Nine topic documents (verbatim archives from the old root README)

| File                                                                                                     | Domain                           | Archived sections                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`readme-01-positioning`](./docs/engineering/readme-01-positioning.md)                                   | Positioning & claims             | Header banners & manifesto · one-click deploy · tech-stack overview · project manifesto · GEO optimization · TOC · positioning · feature matrix                                                                                |
| [`readme-02-ux-and-ai-control`](./docs/engineering/readme-02-ux-and-ai-control.md)                       | UX & AI control                  | Streaming AI UX (Phase 19) · full AI-control bridge · GlobalTopBar + Plus popover · use cases · AI conversation decision surface & runtime facts                                                                               |
| [`readme-03-why-comparison-scenarios`](./docs/engineering/readme-03-why-comparison-scenarios.md)         | Selling points & scenarios       | Why IHUI-AI · benchmark matrix · who uses it · 5 typical scenarios · contact                                                                                                                                                   |
| [`readme-04-architecture-and-modules`](./docs/engineering/readme-04-architecture-and-modules.md)         | Architecture & modules           | Tech stack · 8-end architecture · cross-end sharing · maintenance ratio · app hierarchy diagrams · project structure · 15 module deep-dive                                                                                     |
| [`readme-05-quickstart-api-data`](./docs/engineering/readme-05-quickstart-api-data.md)                   | Quick start / API / data         | Quick start · REST/WebSocket API & capability catalog · model auto-sync · IM multi-platform control · database                                                                                                                 |
| [`readme-06-security-observability-gates`](./docs/engineering/readme-06-security-observability-gates.md) | Security / observability / gates | Observability · security design · root guardian service · full gate table · commit-loss protection · quality evidence · AI collaboration statement · testing · deployment · CI · i18n · LLM dictionary · gate registry addenda |
| [`readme-07-faq-roadmap-commerce`](./docs/engineering/readme-07-faq-roadmap-commerce.md)                 | FAQ / roadmap / commerce         | FAQ · contributing · doc navigation · roadmap (delivered / recent updates / capability list) · monetization · star history · translated READMEs · contact                                                                      |
| [`readme-08-seo-keywords-story`](./docs/engineering/readme-08-seo-keywords-story.md)                     | SEO & brand story                | AI-engine exposure · our story · open-source vision · license · join us · acknowledgements · quick FAQ · full keywords                                                                                                         |
| [`readme-09-ops-tools`](./docs/engineering/readme-09-ops-tools.md)                                       | Ops tooling & archives           | Release-line closure capabilities & ops entries · production monitoring tools · gate registry addenda · dangling table rows archive                                                                                            |
## The 9 ends (8 apps + 1 Capacitor shell)


## The 8 ends (plus one shell)

The workspace holds **9 app packages** (the last row is a Capacitor shell reusing the web static export)
and **16 shared packages**.

| End               | Directory           | Stack                                          | Notes                                                        |
| ----------------- | ------------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| Web               | `apps/web`          | Next.js 16 + React 19 + Tailwind 4 + shadcn/ui | Main site + admin console + IDE panel                        |
| API               | `apps/api`          | Fastify 5 + Drizzle ORM + PostgreSQL + Zod     | Business backend: auth/tenants/billing/content/WebSocket     |
| AI service        | `apps/ai-service`   | FastAPI + LangGraph + LiteLLM + MCP            | Model gateway, agent engine, RAG, workflows                  |
| Mini-program      | `apps/miniapp-taro` | Taro 4 + React + NativeWind                    | WeChat, native WeChat Pay                                    |
| Mobile app        | `apps/mobile-rn`    | React Native + Expo + NativeWind               | Shares screen layer `packages/app`                           |
| Desktop           | `apps/desktop`      | Tauri 2 (thin Rust shell) + web frontend       | No bundled frontend in release builds; tray + auto-update    |
| Browser extension | `apps/extension`    | WXT + Chrome MV3                               | Side Panel toolset                                           |
| CLI               | `apps/cli`          | Node.js + TypeScript                           | Terminal assistant, tools, drift checks, agent-engine client |
| Capacitor shell   | `apps/mobile-cap`   | Capacitor 7                                    | Packages `apps/web` `out/` export for Android/iOS            |

### Sidebar domain hub and per-domain entry pages (introduced 2026-10-19, AI and personal domains added 2026-10-23)

The sidebar collapses many first-level menu items into **per-domain entries**; each domain's full set of pages is hosted by one card-grid page. Existing routes are untouched (`CategoryShell` as a Next.js layout only covers its own directory subtree, so moving a directory would change URLs), so the entry page only groups and links.

- **What it does**: all five entry pages render through one component, `apps/web/src/components/layout/DomainHub.tsx`, and take their items from the `*_HUB_ITEMS` exports in `apps/web/src/components/sidebar/nav-data.ts` (single source of truth — no per-page copy of the list). Visibility goes through `useNavVisibilityFilter` (`apps/web/src/components/sidebar/use-nav-visibility.ts`): `adminOnly`/`permission` decide *may this be seen at all*, `advancedOnly` decides *should it be shown to ordinary users*. Same predicate as the Sidebar; do not re-implement it per page.
- **How to use**: open one of the URLs below, or click the domain entry in the sidebar and then a card. The tier (simple mode) is set in Settings → sidebar tiers and persists to `user_preferences.group=preferences` under `navTiers`.

| Entry URL | Item source | End |
| --------- | ----------- | --- |
| `/domains/ai` | `AI_HUB_ITEMS` | web (Next.js, platform-exclusive) |
| `/domains/personal` | `PERSONAL_HUB_ITEMS` | web (Next.js, platform-exclusive) |
| `/domains/content` | `CONTENT_HUB_ITEMS` | web (Next.js, platform-exclusive) |
| `/domains/edu` | `EDU_HUB_ITEMS` | web (Next.js, platform-exclusive) |
| `/domains/trade` | `TRADE_HUB_ITEMS` | web (Next.js, platform-exclusive) |

- **End**: web-only (the desktop shell reuses this web UI; mini-program and RN carry their own navigation).

### User-side read-only and unauthenticated endpoints (registered 2026-10-23 — previously absent from the README)

| Endpoint | Method | Auth | Response shape | End / consumer |
| -------- | ------ | ---- | -------------- | -------------- |
| `/api/goods/select` | GET | Public — only the on-shelf catalogue where `zhs_product.status = 1`, no private user fields | `{ code, message, data: { list, total, page, pageSize } }`; `page` defaults to 1, `pageSize` is 1..100 with default 20 | api + mobile-rn `CartScreen` + mini-program `pkg-shop/cart`, through `selectGoods()` in `packages/api-client/src/endpoints/goods.ts` |
| `/api/sign-ups` | GET | Requires login; ownership is checked in the handler — a `?userId` that is not the caller's, without system-admin rights, gets 403 (authentication is not authorization) | `{ code, message, data: { list: [{ id, targetTitle, targetType, status, createdAt }] } }`, status normalised to `draft/published/rejected/completed` | api + web `apps/web/app/(main)/user/sign-up/page.tsx`; aggregates `lesson_sign_ups` and `exam_signups` |
| `/api/auth/wechat/mini/one-tap-login` | POST | **Unauthenticated** (rate limited to 5 requests per minute); the phone number and the openId are both exchanged from one-time WeChat codes, so nothing is taken from the client | Success returns `{ ...tokens, user }` — the user object travels with the tokens; 503 when WeChat mini is unconfigured, 401 when the code exchange fails, 409 when the openId is already bound to another account, 403 when the account is disabled | api + mini-program `apps/miniapp-taro` (one-tap login button) |

- **What they do**: `/goods/select` supplies the cart's product paging read; `/sign-ups` merges course sign-ups and exam sign-ups into one "my sign-ups" list; `/auth/wechat/mini/one-tap-login` is a newly opened endpoint — previously `/mini/login` answered new users with `{needPhone:true, openId}` and issued no token, while `/mini/phone` required an existing session and returned no token either, so that chain was structurally impossible (proof case: `apps/api/src/routes/__tests__/wechat-mini-one-tap-login.test.ts`).
- **How to use**: all three are registered in `apps/api/src/routes/index.ts` (`goods.ts` under `prefix:'/api'`, `sign-ups.ts` under `prefix:'/api/sign-ups'`, the login leg under the auth prefix). Inputs are Zod-validated; one-tap login accepts `{ loginCode, phoneCode }` as a `strictObject`, so unknown keys answer 400.
- **End**: backend `apps/api`; consumers are listed in the table column above (web / mobile-rn / mini-program).

## 🚀 Quick start

```bash
git clone https://github.com/IHUI-INF-AI/IHUI-AI.git
cd IHUI-AI
cp .env.example .env           # fill JWT_SECRET / DB_PASSWORD / CREDENTIALS_ENCRYPTION_KEY
docker compose up -d           # business + migrations; add --profile observability as needed
```

If something does not come up: `docs/DEPLOYMENT_RUNBOOK.md` · `docs/TROUBLESHOOTING.md` · port registry `docs/port-management.md`.

Local development:

```bash
pnpm install                   # full install, --filter is forbidden (AGENTS §12e)
docker compose up -d db redis
pnpm --filter @ihui/database run db:migrate
pnpm dev                       # web :8801 + api :8802 (+ ai-service :8803)
pnpm turbo build typecheck lint test
```

Model keys are never in the repo: bootstrap with `node scripts/env-backfill-model-keys.mjs --verify`
(see [`AGENTS.md` §5d](./AGENTS.md)). Windows one-click launch scripts, full env-var table, REST/WebSocket
API, model sync and IM multi-platform control: [`readme-05`](./docs/engineering/readme-05-quickstart-api-data.md).

## Deployment

| Topic                                            | Where                                                                               |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Production runbook (blue-green, rollback, certs) | [`docs/DEPLOYMENT_RUNBOOK.md`](./docs/DEPLOYMENT_RUNBOOK.md)                        |
| Compose / IaC decisions                          | [`docs/INFRASTRUCTURE_DECISION.md`](./docs/INFRASTRUCTURE_DECISION.md)              |
| Monitoring & alerting (email single channel)     | [`docs/MONITORING.md`](./docs/MONITORING.md)                                        |
| Database backups & read-only backup role         | [`docs/DATABASE.md`](./docs/DATABASE.md)                                            |
| Credential rotation                              | [`docs/CREDENTIAL_ROTATION_RUNBOOK.md`](./docs/CREDENTIAL_ROTATION_RUNBOOK.md)      |
| CI workflow inventory                            | [`.github/workflows/`](./.github/workflows) + the workflow count in the table above |

## Development constraints (excerpt)

**The rules in this repo are code, not verbal agreements.** The single authoritative text is
[`AGENTS.md`](./AGENTS.md). The ones you hit on day one:

1. Task plans live only in `PROJECT_PLAN.md`; claims use the lease format `（进行中@日期/持有者）`.
2. Commits go through `node scripts/safe-commit.mjs`; `git add .` / `-A` / `-u` are forbidden; live docs
   require `node scripts/merge-live-doc.mjs --file README.md` first.
3. `git stash`, `git pull --rebase` and hand-written `git push` are forbidden; pushes go through the
   post-commit `git-push-guard`.
4. Single-branch development: no branches except `goal/*`.
5. Shared layer first: check `packages/` before writing any hook/util/type/api-client twice.
6. UI hard rules: single source of truth for radii/geometry; vector icons only; no emoji as icons.
7. Auth: authentication is not authorization; identity comes from the carrying layer, never from the
   request body; batch writes report the DB-confirmed set (`.returning({id})`).
8. i18n: key parity across five languages (en/zh-CN/zh-TW/ja/ko) is a gate.
9. Temp files only under `.ihui-agent/tmp/<task>/`.
10. New files must be watermarked: `node scripts/watermark.mjs inject <file>`.

## License & copyright

- **License**: Apache-2.0 (see [`LICENSE`](./LICENSE)); contributor terms in [`CONTRIBUTING.md`](./CONTRIBUTING.md).
- **NOTICE**: must be retained with every copy.
- **Provenance watermarks**: three-layer watermark on source files, maintained by `scripts/watermark.mjs`;
  they do not alter the rights granted by Apache-2.0.
- **Trademarks**: "智汇AI / IHUI-AI" and its logos belong to the project; Apache-2.0 grants no trademark rights.

## Contact

- Site / docs: <https://aizhs.top>
- Issues: <https://github.com/IHUI-INF-AI/IHUI-AI/issues>
- Security disclosures (please do not post publicly): [`SECURITY.md`](./SECURITY.md)
- Code of conduct: [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)

<div align="center">

If this project is useful to you, a ⭐ is the most direct contribution.

</div>
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
