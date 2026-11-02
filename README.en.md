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

Headline claims (same source as the table below, all live-computed): **618 tables · 4670 API routes ·
25 WebSocket endpoints · 100 catalogued LLMs · 38 platforms auto-publishing · 3959 test files ·
303 engineering gates · 51 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
14 compose services**.

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 618 | `dbTables` |
| schema 文件 | 240 | `dbSchemaFiles` |
| API 路由 | 4672 | `apiRoutes` |
| 路由文件 | 658 | `apiRouteFiles` |
| AI 服务路由 | 628 | `aiServiceRoutes` |
| WebSocket 端点 | 25 | `wsEndpoints` |
| 入库模型清单 | 100 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 16 | `sharedPackages` |
| CLI 命令文件 | 69 | `cliCommandFiles` |
| CLI 工具文件 | 73 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 3984 | `testFiles` |
| CI 工作流 | 50 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 314 | `guardianGates` |
| — blocking | 285 | `guardianBlocking` |
| — warn | 31 | `guardianWarn` |
| 跟踪文件 | 18796 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-11-02。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->
<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-11-02**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (dd0248cbd2)
- 🔧 Chore/Other:清算主工作树滞后副本并补齐派生产物 (04d0c2c7cb)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (05e0909aff)
- 🔧 Chore/Other:重封 AGENTS.md 铁律段哈希，消除合流后 advisory 告警 (86bde84fa7)
- 🔧 Chore/Other:补 .gitignore 兜住本地优选 IP 凭据，避免令牌误入库 (213b7c038c)
- 🔧 Chore/Other:重生成 ui-routes 生成物（911 条），对齐设置页新卡片 (d388266f28)
- 🔧 Chore/Other:按新 HEAD 源重生成离线语言包（键 544→592，钉 2fb7af837e） (2f98eb1e6b)

**2026-11-02**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (c5a90766cf)

**2026-11-01**
- 🐞 Fix:probe 改派 headless 可执行的只读自检,解危险拒签死循环 (1e42fc5e81)
- 🐞 Fix:自治环改用 tsx 加载 CLI 源码,解除 dist 未 bundle 导致的会话派发死锁 (4aa78225b0)
- 🔧 Chore/Other:派单面管理员闸 + LIKE转义 + publish同源SSRF闸 (c85a866895)
- 🐞 Fix:盘根白名单补 MiniMaxCode(D: 盘已安装应用,消除误报外流) (65b643bb9c)
- 🚀 Feature/Improvement:会话全文落盘腿与CLI空转/无头审批人根因修复 (09a3f02274)
- 🔧 Chore/Other:subagent 全局配置变更面强制管理员闸 (c8c4213622)
- 🔧 Chore/Other:收口越权/SSRF/注入/凭据泄露 5 类高危面 (ff4d42705a)
- 🐞 Fix:qoder 保活腿——单轮瞬时失败静音,连续失败才报警 (a72ca967d3)
- 📚 Docs:标注暴露凭据轮换未判定保留 warning 的安全域意图 (74bb1a4c02)
- 🐞 Fix:噪声治理——info 档只登记不寄信 + 自愈全成功静音 (28b2cee5df)
- 🐞 Fix:CLI 登录态写入不再因 ENOENT 打断整轮派发 —— 服务身份下 USERPROFILE 没有机主的登录态 (2c346fb800)
- 🐞 Fix:票面被截断时风险因子不许读 0 —— 那是"把高风险票排到前面"的失效方向 (65cc7e48a0)
- 🚀 Feature/Improvement:打通自开发最后三格 —— 会话干完能落账、排期真按模型走、经验真能沉淀 (bf1a42f113)
- 🐞 Fix:上下文/记忆面 8 个端点的身份从"自报"改成"注入" (9103baba9b)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (1b6443c3ab)
- 🐞 Fix:收窄 mobile-rn 两处依赖数组消除 exhaustive-deps 红、favorites 镜像件与生成器补 resourceType/resourceId 契约注解、CI pytest 覆盖 basetemp 根因 (c97d501323)
- 🐞 Fix:补上五处"闸装错了层/装错了方向"的凭据与主体防线 (f4d5103361)
- 🐞 Fix:派发契约尺子学会说取不到输入,隧道不在位不再被念成接线消失 (03a4fdd580)
- 🐞 Fix:5类报警根因修复 + 报警前自愈路由层 (1827fde982)
- 🐞 Fix:两维尺子不再因历史存量恒红 —— 结算腿改结清全部悬案,A3 只在封禁过半时叫人 (c08df4d714)
- 🐞 Fix:裸字面量 TTL 归口常量、两枚策略常量搬到可扫描取用点、probe-dev-extra 进 CI 自述点名表 (9fb6fee7a8)
- 🐞 Fix:冲突标记门体接旁路落地自证臂并扣减空冲突区补回量 (c3fc430bc5)
- 🚀 Feature/Improvement:两类写了没装车的展示契约与错误码契约装上真取用点 (98f7f3be13)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (837e41f4fb)
- 🚀 Feature/Improvement:给自开发装上"派发结算"这一问 —— 会话 exit 0 从此不等于票推进了 (31ec3e231f)
- 🔧 Chore/Other:本席认领「灰度观察窗排在换流之后」并挂租约(防双开;SPLIT 席已停笔,该格由 OBSWIN 席接手) (6341165f67)
- 🐞 Fix:供应商健康摘要的 30s SWR 策略从装饰常量收成单一旋钮 (71b2265af0)
- 🐞 Fix:摘掉被 union 归并留成两份的 workbook 路由注册,并把零 JSX 的 React 模块从 .tsx 改回 .ts (8eebef0d1f)
- 🚀 Feature/Improvement:灰度期实切车道计数持久化 + 熔断记账按轮次结果分桶(收编 SPLIT 席产出) (2829bd6e34)
- 🚀 Feature/Improvement:端侧存储 transport 取用归口到各端工厂,并收掉 shared 里未接线的 JSON 装饰层 (199c84c412)
- 🚀 Feature/Improvement:五枚"写了保留策略却从未执行"的清理函数装上真实触发点 (69a64068bd)
- 📚 Docs:执行体积清偿第六批——4 行逐字移入归档件,原位置只留一句指针注记 (d3baf99018)
- 📚 Docs:落 AGENTS.md 体积清偿第六批的逐字迁出件(先落归档,再摘正文,防 merge-live-doc 把搬走的行判成 lost 补回) (5a6c653770)
- 📚 Docs:再摘一次合流捞回的冲突标记行,并把回捞这一型登记成在册票 (24ff0bc188)
- 📚 Docs:登记「冲突标记经旁路落地+行级 union 反复回捞」这一格(本席已认领,含两轮实测 sha 与出路) (9795d38e68)
- 📚 Docs:补上编辑意图预测(Predictive Edit)能力清单——服务端三态/前端三把钥匙/scene 分账/真模型取证首跑(§21 交付门槛:新增端能力须同枚更新 README) (639c0bb9d2)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (177ac30e3c)
- 🐞 Fix:合流选边遗留的接线红就地收正——W10 补回采样面折算维,部署环 decide 同时带两把钥匙 (ef4c07a465)
- 🐞 Fix:产物 token 的签名密钥去掉公开常量兜底,并把"生产必填"那句话真接成启动闸;SaaS 模板弱默认口令封口 (da6f241813)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (7a809936fe)
- 🐞 Fix:收正合流选边遗留两格——灰度产物来源换回对侧定案形态 + web 族源收成共享层壳 (77cb1dc7f1)
- 🐞 Fix:/api/context 进"永不公开"地板 —— 那张 router 七格全无端点级身份,靠陈旧 .env 就能匿名重开 (e119289438)
- 🐞 Fix:clawdbot 整面闸升到带 requireActiveUser 的档位;并更正我自己写进提交史的一句 folklore (8c7054044b)
- 🐞 Fix:摘除合并落进 AGENTS.md 的三行未解决冲突标记 (08b12deaa4)
- 🐞 Fix:MCP 项目/集成面收归令牌主体,并堵掉"裸 id 可删任意 system_configs 行"的跨面删除 (3d31adbdac)
- 🐞 Fix:票59 消息级版本切换补上小程序消费腿 + 灰度补 P95 延迟劣化真策略用例 (a92c063cac)
- 🐞 Fix:摘掉打死守护的三处悬空引用,补齐 pure 层缺失的同类节流判据 (f73fb2793d)
- 🐞 Fix:工作簿读写面补装车 —— 五条端点此前线上全 404,而仓里那把"必须注册"的尺一直红着 (75de94caae)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f4e8324d22)
- 🚀 Feature/Improvement:barrel 销账下到符号级,标题臂不再写死形态名——清掉两条假账 (bc64e57842)
- 🔧 Chore/Other:壳声明件跟随自动升级的 4 枚页(按 HEAD 面派生) (b2b9dfd385)
- 🔧 Chore/Other:自动把 4 枚手写镜像页升级为壳承载 (a69349f15b)
- 🚀 Feature/Improvement:列表分页与输入框聚焦两族按「闭环在不在屏上」销账——再解放 2 页 (c395144e6c)
- 🚀 Feature/Improvement:判据认「barrel 里只装了导航条」这一型重复接线——两页当场变 convertible (830fb1b708)
- 🐞 Fix:合并后重生成 miniapp 两族派生产物(门 105 的 G5 钉随输入集更新) (0373e9aa2b)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (afc5595c90)
- 🐞 Fix:正文作用域补上承载壳——判据认「提示住在壳里」这一格 (5b3db1a65e)
- 🔧 Chore/Other:收编停留≥3分钟的 i18n 未提交改动 (bd98a24260)
- 🔧 Chore/Other:修三处 api 存量红 —— 豁免清单腐烂 / 出站口换 undici / 返回面加了 localEmbedded (39b1ee5ca2)
- 🐞 Fix:parentMessageId 口径加宽到 string | null + 小程序腿三处类型错 + knip 兼容层出口盲区登记豁免 (1f1e6e99fb)
- 🐞 Fix:回补 cli 包 14 枚动态派生词条 + 登记契约键 (bac640521e)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (fbad083b81)
- 🐞 Fix:清掉 api 包的四类存量 lint 红 + captcha 清理按自身头注分批 (3ebae14ded)
- 🚀 Feature/Improvement:ws-chat 把断线补发/幂等去重/跨实例限流三枚工具模块装进生产生命周期 (fadde1bce7)
- ♻️ Refactor:useFontMultiplier 改名 readFontMultiplier —— 它是纯读函数,不是 React Hook (e75621c841)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (7362129f72)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (eb60e13737)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (9930484394)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (da729e3f6f)
- 🐞 Fix:chat-sync 帧收件人只取承载层认证身份,堵死客户端自报 userId 的跨用户投递 (58fb182dec)
- 🔧 Chore/Other:给 hub 早退分支的工具入参校验补行为锁 (bbbf3f7443)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (fbb4ec7ea9)
- 🐞 Fix:套件红项分诊末簇收口——①百分比裁剪 5 处内联手搓收敛到具名唯一出口 clampPercent(@ihui/shared/utils/clamp-percent,api/miniapp/mobile-rn/packages-app×2,语义逐字等价:toNumber 保证有限值/round 先后序等价/NaN 归 0 为出口既定语义),edu-grade-trend 本地同名实现摘除;②三枚镜像测试对齐现形(ui-react T5 仓外样本改真仓兄弟路径构造——toRel 纯路径数学无需夹具/mkScratch 已入仓内批准根;tool-arg-wired 守恒式补 forwarded 转发豁免桶——头注恒等式 covered+forwarded+uncovered===total;transcript TA-12 数据条件化——audit.jsonl schema 演化后 path-ish 族为 0 条,判存在性用门体单源 extractTarget) (f25456c0fd)
- 🐞 Fix:合并后重新施加本侧独有的两格运行时缺口 —— Modal 遮罩点关 + Image onLoad 转发 (5f38f5d8dd)
- 🐞 Fix:卫生门真债+旧尺各一——①dev-stack-launch-fallback.test.mjs:77 中文绝对路径字面量改 \u 转义构造(运行时语义不变,销 GBK 乱码违规;HEAD 面欠账只有带进 HEAD 的提交能销);②check-workspace-hygiene 落点判据对齐 G-158 现形(改用唯一判据 isAllowedScratchRoot,批准根已入仓内 .DevEnv——判据没跟上设计红在尺子,check-service-binary-paths F3 同型) (007f24437c)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (225523491f)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (312ff9ad19)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (0d8853a870)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (9ab4908d49)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (97a63e10e8)
- 🐞 Fix:套件红项分诊第一簇续收 4 格——测试形状正则对齐现形(commit-payload 发令帮手改名 commitArgv/d159 合并命名出口/deploy-diverged 补救功能已整票回退故豁免面关闭零破坏性动词/arg-guard getOpt 三参) (3e76692c31)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (3722d122d7)
- 🔧 Chore/Other:收编停留≥3分钟的 i18n 未提交改动 (eb97698dbc)
- 📚 Docs:T12 §5b 状态更新——#8/#6 身份半格已落地,#5 大半落地,#3 缓议有因 (4b188b3468)
- 🚀 Feature/Improvement:钩子派发宿主身份核验(deny-by-default)—— T12 缺口表 #6 半格收口 (713eaf1513)
- 🚀 Feature/Improvement:索引快照压缩落盘(gzip 魔数自识别)—— T12 缺口表 #8 落地 (3b3e9542a4)
- 🔧 Chore/Other:parity-auto-stage-crash.test.mjs 溯源水印欠账带进 HEAD(门47 HEAD面欠账清偿) (aaabb813bf)
- 🔧 Chore/Other:回正 check-pkg-installable 镜像夹具的包名(包更名后夹具腐烂) (7fba73b50f)
- 🐞 Fix:灰度产物来源定案,放量判定拆成在位三态并不再把未判定折成通过 (5d2380fe2f)
- ♻️ Refactor:危险操作确认旁路的消费侧收拢到唯一出口并锁零就地判定 (88763ecb62)
- 🐞 Fix:号池入库契约把 phone 提为显式键并锁四档命名优先级(O66) (369f74ab01)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (5cc57906d3)
- 🐞 Fix:小程序宿主 typecheck 61→0 —— 去掉索引签名,RN 事件/props 类型面归口 primitives (ff2abfcdbf)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (dc9a528104)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (cffca2c7c7)
- 🐞 Fix:F6 判据改行级预算口径,根治「union 重组涌现块」半格死锁 (1addf6f4ab)

**2026-11-01**
- 🚀 Feature/Improvement:把人工阀从"打印出来的装饰"接成派发路径上的真闸(observe 起步),并加 A6 维量它哑不哑 (65443d4d53)
- 🐞 Fix:root-guard 用例派生 git 补 stdio 接管（门 193 存量红入库） (246a39e64a)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (19ff4238f5)
- 🐞 Fix:修 06:00 探针假阳性 + Qoder 补跑轮 + 号池锚点保护 + 同步徽章 (219424fad8)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (29bba39eaf)

**2026-11-01**
- 📚 Docs:登记「deploy/** 改动当天拿不到 CI 信号」 (4e529f995c)
- 🚀 Feature/Improvement:把自开发发起腿从"死了 6 天没人知道"修成真能派,并装上存续判据与调度器 (8bb0fb7f9f)
- 📚 Docs:登记「deploy/** 改动当天拿不到 CI 信号」—— 缺的是时延不是覆盖,要 workflow paths 与改动映射两处一起改 (2afdbef684)
- 🐞 Fix:根护栏前置闸不再读"上一版"把自己锁死 —— 当前面红时改问"本轮要检出的那一面"自洽否 (6198c6c102)
- 📚 Docs:点名跨端分享正文通道(§21 交付门槛:新增端能力须同批更新 README) (b5536d03fa)
- 🔧 Chore/Other:壳声明件跟随自动升级的 1 枚页(按 HEAD 面派生) (7b9a016f68)
- 🔧 Chore/Other:自动把 1 枚手写镜像页升级为壳承载 (fef888deb5)
- 🚀 Feature/Improvement:打通手写镜像页转壳的第一例——判据认「端内别名转发到共享层」这一型能力覆盖 (6e0a3da5cd)
- 🚀 Feature/Improvement:分享族 7 屏真的发布正文,并补齐朋友圈卡独立标题与封面两维 (f1af950bf5)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (bd9071a44c)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (1f8ccfe6ae)
- 🚀 Feature/Improvement:跨端分享正文通道落地——屏发布正文,宿主在页面级注册转发/朋友圈 (baf7462ab1)
- 🔧 Chore/Other:根护栏清单按 HEAD 面重封 —— 解开部署环的 fail-closed (0b5fcb5cd6)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1046648321)
- 📚 Docs:登记「根护栏前置闸读的是换流前那一面,能把自己锁成整轮空转」这一格 —— 带本日两次实测读数与两条同面出路 (9f68e99c85)
- 🐞 Fix:公开页 nonce 排除判据从未生效 —— 31 条缓存规则全数不匹配,边缘缓存件里钉死一个 nonce (69ad209b34)
- 🐞 Fix:内容类型闸对空 fileName 从"崩成 500 + 产物留盘"收成 fail-closed 的 415 (2b38b72597)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (cde5c238ec)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (0607f0042a)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (84f53c0111)
- 🐞 Fix:clawdbot 的对话桶与配对属主从「客户端自报 userId」收回令牌主体(三格) (12f2079a20)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (41d5a81463)
- 🔧 Chore/Other:补 props-resolution 两新件的尾部水印行(与 rn-compat 同类文件同形)+ ui-routes 钉重生成 (98f1252165)
- 🐞 Fix:三处构建文件的 pnpm 工具链从 @latest 收回收成逐字钉版,并把判据装到 deploy 面(门 48 规则 D) (660ee253f8)
- 🐞 Fix:分包总量消重 —— 根桶副作用豁免,9 份 707 KB 目录块收回 1 份 (eff410c0e5)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7801e27aef)
- 📚 Docs:T12 §5b 状态更新——#8/#6 身份半格已落地,#5 大半落地,#3 缓议有因 (f7eaa3e4ac)
- 🚀 Feature/Improvement:钩子派发宿主身份核验(deny-by-default)—— T12 缺口表 #6 半格收口 (ea4ec0266f)
- 🚀 Feature/Improvement:索引快照压缩落盘(gzip 魔数自识别)—— T12 缺口表 #8 落地 (e2c90a75fd)
- 📚 Docs:灰度那行就地改写 —— 来源与折绿两格已修死(枚 cf1fdef9cef),留的正是剩下的顺序语义那一格 (f2f8792e29)
- 🐞 Fix:灰度槽位从此有产物可服务,且"灰度没量过"再也不能记成判定通过 (cf1fdef9ce)
- 🚀 Feature/Improvement:消息中心数据钩子补齐——小程序向 RN 对齐真实动作链,fidelity 缺键 17→0 (c970ac616c)
- 🐞 Fix:5 个 use-cases 子页的 ja/ko 副本进 hreflang 集群 —— 那句"路由文件不存在"已与盘上相反 (5bbcc27509)
- 🔧 Chore/Other:六档陈旧卷宗跟回生产契约 —— 全量回归里剩下的红全部清零(除一枚需暴露决策的) (4cf0461f33)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (44dfcfd91c)
- 📚 Docs:同号多行去重 —— Z-1 4→1 / RP-79 2→1 / RP-47 2→1 (55f010724f)
- 🐞 Fix:结清 AGENTS.md 守门 207 体积债(HEAD 现读超预算)并补本票两道新门的 R4 点名 (44a91f7f4f)
- 🐞 Fix:rn-compat 垫片 props 契约对齐 RN 0.86 —— 小程序宿主 tsc 61 条型错归零 (3b541f58dd)
- 🐞 Fix:LIKE 通配符转义收成单源并上门(279),顺手把 AGENTS.md 的体积债与 R4 欠账一并清掉 (96d1f8305b)
- 🐞 Fix:会话记忆读/清补可达性闸 —— 身份对了还不够,conversationId 也是客户端给的 (179a297446)
- 🐞 Fix:考试判分与题型词表收成单源,并补齐四处端间缺口 (74e79a8fce)
- 🚀 Feature/Improvement:补登跨端对齐残留产物与镜像资源 (d76f63cde9)
- 🚀 Feature/Improvement:跨端对齐一键级联编排器 pnpm sync:cross-end(web→RN→小程序 按依赖序一发跑完) (08db578671)
- 🚀 Feature/Improvement:dir_rhash 接进索引增量链 + T12 缺口表闭环补记(缺口表 #1 全程收口) (37dfaf9dd3)
- 🐞 Fix:把登录"等代价"外壳拆出 password-crypto —— 修掉我自己上一批留下的整片替换式 mock 雷 (377115d10e)
- 📚 Docs:登记「灰度槽位从未拿到产物」这一型 —— 20/20 轮未判定被折成放量完成 (87f89d0a95)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (92a9ec433a)
- 📚 Docs:把明文例外域名清单登记进声明面 —— 强度只住在本地 .env 就会在一次整体替换时消失 (9c194f3c00)
- 🐞 Fix:门 273 遮罩识别补三格 —— 遮罩不再被计成缺按压反馈(HEAD 面 h2 3→0) (759ca70c1e)
- 🐞 Fix:开发者绑定一族五格补属主过滤 —— user_id 住在表里,这一族本就可以收 (ce0ae6c9a1)
- 📚 Docs:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (6cbb66b189)
- 📚 Docs:压缩守门速查节冗余重复登记、修复失真读数,使体积回到门207预算内 (d3c9ef1f14)
- ♻️ Refactor:评论管理面的特权判定收归单源 —— 摘掉本仓最后一枚自带 ADMIN_ROLE_ID 常量 (1f7b651270)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (ce9af1cfd6)
- 🐞 Fix:迁移容器不再以 root 运行 —— 它全程只握着 DATABASE_URL 这一枚生产凭据 (6d9dd26e57)
- 🐞 Fix:提现审核的审计主体改从令牌主体取 —— reviewer 不再住请求体 (2e16754244)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f23f5fb6df)
- 🐞 Fix:五个镜像页取词/功能面与共享屏齐平 —— 镜像保真缺口 17 → 0 (b4794da004)
- 🐞 Fix:个人号池反向同步端的内部凭据比较改走 secretsEqual 单源 (5f0bea107c)
- 🔧 Chore/Other:根护栏清单按 HEAD 面重封 —— 解开部署环的 fail-closed (e454818278)
- 🐞 Fix:两格裸 httpx 取远端可控 URL 补 SSRF 逐跳复检(入口一次 + 每跳一次) (b3099dee1c)
- 🐞 Fix:CI 安装步逐字钉版 + 门 48 新增规则 C 把这件事变成机器闸 (630198fe57)
- 🔧 Chore/Other:ruff 全量归零(41 机械项 + 3 手工)—— CI 的 Ruff job 直接原因 (2665af9c69)
- 🐞 Fix:收口 9095「今日已签」语义 + 第四条回灌腿(minimax)归属缺陷 (e561910994)
- 🐞 Fix:补 @rn-shells/DeveloperScreen 类型声明 —— 修壳化落地后的 tsc 红臂 (9da200af08)
- 🐞 Fix:rules 面五格裸端点补端点级身份 + /api/rules 进"配置重开不了"的地板名单 (70955c9eb5)
- 🔧 Chore/Other:补 test_codebase_indexer_ignore_channels.py 溯源水印 (7995b0f539)
- 🐞 Fix:一键登录的明文流量从"整 App 授权"改成"按域名开、默认关死" (0ae5f24bec)
- 🐞 Fix:红项按文件归因改走 TAP location，根治 junit file= 在本机恒空转 (1421e386b8)
- 🐞 Fix:补上 torpx 夹具里那处未接管 stdio 的 git 派生 —— 门 193 现读点名的一处裸奔 (1d7a026b66)
- 🚀 Feature/Improvement:目录级递归前像 dir_rhash —— 缺口表 #1 落地(超越 qoder/trae mtree 设计) (1f4956f07b)
- 🐞 Fix:补齐小程序 compat 层的四类类型缺口 —— 跨端共享包在小程序宿主下少红 17 条 (f2ac8cf1b5)
- 🐞 Fix:两处"外部串直接当路径用"收口 —— 规则删除的任意 .md 删除、git 面的跨目录只读泄露 (2f2511c4f3)
- 🐞 Fix:上下文/记忆族的归属只认令牌主体,客服工单 admin 面自带本地闸 (abc0baa402)
- 🚀 Feature/Improvement:号池隔离盲区监测器收口 D1-D6 + 守护 sweepPoolIsolation 接线 (2026-11-01) (115028214b)
- 🐞 Fix:回跳落点必须交出一份第一方落点集 —— 新增门 278 并把 OIDC 自动回跳收到同源 (85ca07c5a9)
- 🐞 Fix:torpx 镜像件派生 git 未接管 stdio —— 门 193 唯一红点 (a7039c0c1a)
- 🚀 Feature/Improvement:工具面能力门 + 索引剪枝回执(缺口表 #7 落地) (4b4fb09283)
- 🐞 Fix:根护栏清单按已入库的门 48 规则 B 重封 —— root-guard 不再 fail-closed 挡部署 (674da0c573)
- 📚 Docs:复摘 P84/P85/P86 三条僵尸行 —— 结清提交被整份取对侧的合并抹掉后又被回捞腿带回 (b5f0bd106c)
- 🐞 Fix:qoder/workbuddy 回灌同型收口 —— 目标行改唯一行并按主键写,本机号落个人池时不再另建运营池行 / 不再恒"池内没有该 uid" (43e9e4a3c3)
- 🐞 Fix:悬空导入门两处假阳收紧 + 清掉 seed 里指向未实现特性的三处悬空引用 (d92645f737)
- 📚 Docs:结清 P84/P85 —— ai-service 索引 ignore 判据与改名检测已入库 (e91e4492eb)
- 🐞 Fix:Toolbar 浮动余量判据改按设计令牌解析 —— 代码按规范写了,判据却"失明" (253c6e8ca8)
- 🚀 Feature/Improvement:索引面接 ignore 判据 + 代码检索改名检测(票 P84/P85) (789a23b8e0)
- 🐞 Fix:object-space-merge-cap 的派生口补 windowsHide 默认值 —— 门 52(blocking,stagedTriggers **/*)不再全仓逼人跳门 (40f4a89a70)
- 🐞 Fix:Trae 回灌按唯一目标行并精确到主键 —— 本机号已被个人池持有时不再另建运营池重复行 (4e72e8bf14)
- 📚 Docs:结清 O62819(门 128 几何维 CSS 变量解值 + torpx 夹具按新 HEAD 重订) (b2b6ee5909)
- 🐞 Fix:钉 @vitejs/plugin-react 到 4.x + Dockerfile 补 COPY ui-native —— e2e/ci.yml/Build Docker 三条真红同批收口 (c67e18d095)
- 🔧 Chore/Other:门 128 的 torpx 镜像件 C2 改吃生产面取证(夹具不得比门瞎) (9434c8a932)
- 🐞 Fix:4 处 pressFeedback 迁到 Tappable —— 补完 RN 0.86 迁移尾巴,typecheck 归零 (230b6d63dc)
- 📚 Docs:结清 O62819 / O67 / P86 —— 门128 工具类模型与门84 混合陈旧底稿拦闸已入库 (b673b33bef)
- 🐞 Fix:三处登录端点对"账号不存在"付出等代价口令校验 —— 堵掉耗时面的账号枚举 (b5aaf7e5bc)
- 🚀 Feature/Improvement:web/小程序腿接可解析工具类模型 + 几何维重锚(票 O62819/O67) (ca00ed0f39)
- 🐞 Fix:内部服务鉴权的老门加使用留痕 —— 关它需要证据,而它今天是静默的 (fe7f193699)
- 📚 Docs:补第廿一条欠账 —— 同仓索引租约、快照自证六档、检索金标双命名空间打分写进能力面 (484c798d84)
- 🐞 Fix:门7 依赖碎片化改差值口径 + 修好从 10-26 起长期烂着的镜像夹具 (aa460475d0)
- 🐞 Fix:转壳判据补上 useEffect 承载标题那一形,标题节律同批保住 (cdb29d00b5)
- 🔧 Chore/Other:补摘 2 处冗余默认导出(AboutScreen / ClientOnly)—— knip duplicates 维收口 (6ab2605046)
- 🐞 Fix:两枚镜像的构建期供应链全部钉版 —— 可变 tag、未钉版安装与 `curl | bash` 清零 (c042ae8041)
- 🐞 Fix:派生自愈腿 i18n 一族只交变化集给落地器, 4 份"盘==HEAD"的 CDN 载荷曾把真变的 3 份堵在后面 (5ff60c00c4)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (3ec38ed5ea)
- 🐞 Fix:生产 next build 通过 —— 类型增强显式进 web 程序 + 删死引用 + 补 transpilePackages (98ce4e6d43)
- 📚 Docs:认领 O62819(torpx 夹具按新 HEAD 重订)—— 镜像件现读 3 条红(C2/C3/C8),成因已量清:夹具的档表面比门的生产面窄(只喂 spacing,未并 cssTierPxFrom),而旧反例载体 ScreenStates 的 400rpx 已被落档批改成 var(--spacing-3xl) ⇒ 按 HEAD 硬钉的 [15,200] 与「onlyRn=0」双双腐烂。本轮把取证面改成与门同形、并把「反例不得变绿」这一腿换成行为推导而非字面数字。 (394c9b1a34)
- 🐞 Fix:再摘 499+11 枚死键(回补提交把它们搬回来了)—— 五端实测归零 (ea9c9e6624)
- 🚀 Feature/Improvement:补「混合陈旧底稿」行级拦闸(票 P86) (8aa1a3ddfa)
- 🐞 Fix:全仓归一 react-native 到单份 0.86.2 —— 修好 next build 类型面最后一处红(部署阻断真因) (e4beec16d3)
- 🐞 Fix:兜底鉴权闸缺省档随运行时武装,并停止抢在内部凭据之前判死(实测线上第一方回调被 401) (bc15c99664)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (eb846d39cb)
- 🚀 Feature/Improvement:id_native 轨首次可判 —— 同 id 索引(bench/score_id_native.py)(逆向复现超越 goal-b47) —— runner 头注早就写着「哪天仓内真落了同 id 的索引,这一轨自动点亮(判据现算)」,本件就是那把索引:检索宇宙换成本仓 ParentChildChunker 现算的父块、id 用它自带的十六位 chunk_id,不改判据、不做位置配对、不抄 id 表。现读:金标二十八枚 distinct id 复现二十七枚(未复现那枚是随正文变过的陈旧 id,题目与原因逐条点名),二百六十四题里判定二百六十三、判不了的每条带原因名;MRR 零点八一二、hit@5 零点九四三、nDCG@5 零点八四二。指标一律 import retrieval_eval,本件不自带第二份公式(有用例按源码锁这一条)。全程零连库零网络 (7a35b76a1a)
- 🚀 Feature/Improvement:门 131 补 F3「函数先起名再当 style 传」一档, F1 的内联正则对这一型全盲 (72e36cc58e)
- 🐞 Fix:提交面回退巡检的日志判语跟着臂次走 —— partial 型不再被念成"与祖先逐字同形" (8504f90ce0)
- 📚 Docs:结清 O22819 —— 侧车改判出口已具备声明式契约 (6e5044df0f)
- 🚀 Feature/Improvement:侧车归属改判出口补齐三处契约缺口(票 O22819) (4be834eeeb)
- 🐞 Fix:自动化配置缓存与调度任务镜像补封顶(只写不读那型再消两格) (09e1678f43)
- 🚀 Feature/Improvement:run-script-tests 补上「红项 → 文件」归因 —— 252 枚红从此有靶子可打 (3f656a28ea)
- 📚 Docs:登记提交链缺口「混合陈旧底稿绕过门 84 R1」—— 本席一枚提交实测吞掉他人 55 枚已入库行并当场回补,判据定义外的这一型从此有人盯 (96088b6edd)
- 🐞 Fix:49 枚工作流的 GITHUB_TOKEN 权限面收进顶层声明,并装上门 48 规则 B (304b03ace2)
- 🐞 Fix:回补被上一枚提交吃掉的他人已入库件(团队任务表面「队数封顶与逐出」那段安全强化,五十五枚行) —— 成因如实写:上一枚把工作树那份滞后副本整文件交回,吞掉了别人已入库的内容;它没被门 84 拦下不是判据该改,而是那一条判的是「暂存 blob 逐字节等于某祖先版本」,而我这份是「陈旧底稿加我自己的新增」的混合体,结构上落在它的定义之外。正解顺序是先取父提交 blob 把他人内容整段保回、再只把自己的响应面字段重新加一次。现读:五处逐出符号回归、相关用例绿、mcp 族 一七八例绿 (4710182cc9)
- 🐞 Fix:index_codebase 响应面接齐三代结果字段并上逐字段完整性钉 —— 遍历通道、快照自证、租约档三代各往 IndexResult 写了字段,而工具响应用的是手挑 key 清单,三回都没抄进去,于是「降级过/自证失败/被租约挡住」在端上与「一切正常」同形;新用例不再测某一个字段,改测「IndexResult 每个字段必须出现在响应里」,不靠人记得手抄。二百三十二例绿、mypy 六百八十二源文件零错 (6534b09698)
- 🔧 Chore/Other:金标缺陷答案重标器与前后对比基线(逆向复现 goal-b47,收编席 V 交付) —— 先更正本席派单时的成因假设:那九十五条缺陷题过去根本不在分母里,不是压低召回,而是百分之三十六的金标从未被打分(覆盖缺陷)。补齐后可判从一百六十九升到二百六十四,Recall@5 反升两点零三分、MRR 降两点五五分,检索腿的真实缺口因此才量得出来。重标只取源文件逐字切片,全量二百六十四条断言期望串是其源文件子串(本席另跑一遍复验),原金标件 sha 恒等未被改;取不到时移出打分集并计数,不静默删也不冒充答错。顺带定位到 id_native 轨出路:金标二十八枚 id 就是本仓 ParentChildChunker 的父块 id,现读复现二十七条,漏的一枚是随正文变过的陈旧派生 id。用例十例绿、ruff 通过、mypy 六百八十一源文件零错 (60eb0cbaa6)
- 🐞 Fix:夹具闭包推导器把注释里的举例 import 当真边收 —— 一型毒红整片套件的 8 枚用例 (0c99ef30c7)
- 🚀 Feature/Improvement:同仓索引加租约层做单飞行(逆向复现超越,对齐 T9 的 startSync/refreshLock/endSync 串行协议) —— 本仓此前根本没有这一格:懒索引闸门与 index_codebase 两条路都会发起整仓索引,同仓并发就是各花一遍 embedding,还会抢同一枚临时快照名。并进去的那轮在响应上写 lockState=coalesced-waited;等过窗口返回 over-window 并点名本轮未开工(零索引数不得被读成没东西可索引);跑完即摘牌,所以不存在拿到陈旧结果的通道。测试顺带咬出第二枚真缺陷:并发 replace 被瞬时锁挡下时旧代码只 debug 级留痕并把临时件留在盘上,现改为出声并自清。索引族 一五九例绿、ruff 通过、mypy 六百八十一源文件零错 (a208022b4d)
- 🐞 Fix:凭据脱敏闸接到 api 根 logger,并把 BYOK 的 Google key 从 URL 移进头 (99e7ed1d32)
- 🚀 Feature/Improvement:装上提交面「内容整片退回更早版本」的只读巡检尺 —— 本会话第三起损失的根因格从此有人看 (0082da2004)
- 🐞 Fix:平台凭据不再进 URL,并给两条落盘链各接一道凭据脱敏闸 (0e208a6d07)
- 🐞 Fix:畸形 ignore 模式不再把整次骨架装配带崩(本仓真档实测复现) —— 上一枚提交里我写了「生成产物全进骨架」这句成因,这枚把它量出来并修掉自己埋的雷:结尾单反斜杠的字符集合按字面量处理,其余编不过的模式跳过并把出处点名到规则文件行号,坏模式不连坐同文件的其它规则。现读实测本仓工作树面:同一份两千 token 预算下源文件从三十枚升到一百七十三枚、目录行从三百四十七降到一百一十六,另有三千零七十九条被剪条目带出处可答。四十三例绿、ruff 通过、mypy 六百八十一源文件零错 (cd32863fb6)
- 🐞 Fix:项目百科缓存与团队任务板补外层键封顶 —— "内层有上限、外层键没人管"那型再消两格 (8e6903090f)
- 🚀 Feature/Improvement:Merkle 快照读回补自证档(逆向复现超越,对齐 T9 逐字段校验并拒绝截断文件那一格) —— 旧口径把打不开、形态不合、尾部截断一律塌成空表,于是响应上读起来像增量完成,实际白烧一轮全量向量,而且删除集的分母一起变空、幽灵切片永不清理。现在写侧带 schemaVersion 与 fileCount,读侧除了比条数还要拿 files 重算 merkleRoot,六档形态收成一份单源清单并随响应回传 snapshotState;自证失败那一档本轮刻意不清幽灵、也不冒充清理过,原委写进 errors。新增九例、索引族套件 一三九例全绿,ruff 通过、mypy 六百八十一源文件零错 (b655b3eaa2)
- 🐞 Fix:销一枚溯源水印 HEAD 面欠账 —— 门 47 在 CI 钉版本那枚提交的复跑里抓到 (4ec0770e47)
- 🐞 Fix:CI 的 248 处第三方 Action 引用全部按提交号钉死 —— 可变标签是签名发布链的远程代码执行面 (671a0e6a47)
- 📚 Docs:登记两格逆向复现残余(索引面 ignore 接线、改名检测)—— 上一枚提交信息说了「已另开票」,这一枚就是那张票 (1aab7fd5ac)
- 🚀 Feature/Improvement:ignore 规则判据层落地并接进目录骨架装配(逆向复现超越,对齐 T12 原生层 ignore 三文件族剪枝) —— 本仓此前刻意给 rg 传 no-ignore 换两通道对账,代价是生成产物全进骨架与索引;现在规则求值收成一段纯函数、在枚举之后统一过一遍,所以两通道对 ignore 的判断在结构上不可能不一致。剪枝带回出处(哪枚规则文件的哪一行),规则文件读不动或超上限逐条点名不当没发生。索引面这一格刻意没同时接线:本仓存在跟踪但被 gitignore 覆盖的路径(守门 236 就是为这型立的),一口吃进去会让这些文件静默从索引消失,已另开票。三十一例绿、ruff 通过、mypy 六百八十源文件零错 (978b6f7854)
- 🐞 Fix:文件版本表补外层键封顶 + watcher 名额闸排在起线程之前 —— 同族第 5 批 (3c3943773e)
- 🔧 Chore/Other:回调机主批准的临时放宽 deploy.minutesPerDay 720→480(含现场读数与真因) (ed59167b4a)
- 📚 Docs:登记 render_repo_tree 目录骨架预算装箱与代码检索双腿融合(补第廿一条欠账) (b64a2c1b1a)
- 🚀 Feature/Improvement:新增 render_repo_tree 按 token 预算装箱仓库目录骨架(逆向复现超越,对齐 Qoder mtree 的 renderTree) —— 枚举走 rg_fallback_parity 单源出口不写第二遍遍历,预算先保目录骨架再补文件,削掉的文件与被 scope 排除的条目分格计数并以 complete 与 dropReason 出声,token 估算复用 context_compaction 不另立第二把尺;渲染钉十二例加接线钉五例共十七例绿,ruff 通过、mypy 六百七十九源文件零错 (0de483bff6)
- 🐞 Fix:会话级内存账本补外层键封顶 —— 准入留痕只增不删 与 产物"成功也镜像"两格一起收 (8ad1b44ec4)
- 📚 Docs:T12 mtree 原生面与钩子宿主取证结清(席 S 交付、本席复验) —— napi 导出实测二十三枚并据此更正 T9 的二十四枚,快照双哈希与 ignore 三文件族在原生层判定,hook 宿主是 Rust tokio 薄壳(导入表无 CreateProcess、无网络栈),钩子契约两个拐点(承载体换原生 exe、事件面从二档扩到五档并首次出现 matcher),缺口对撞表八条含七条真缺口 (18be313f02)
- 🐞 Fix:PR diff 缓存补键上限与真过期 + 原语加"新鲜度/会话"两档语义与晚绑定时钟 (4e7177bb74)
- 🔧 Chore/Other:归档处置镜像三例按"仍可达的两格"重写 —— 正控前提已被归并层自己吃掉,套件回绿 (e751da2b37)
- 🐞 Fix:进程内存储补"键数上限+滑动寿命"原语并接三处 + 更正我上一批过粗的 MCP 角色闸 (9ef49a8476)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (654a48986a)
- 🚀 Feature/Improvement:检索金标召回基线 runner 与首份基线件(补齐"指标与金标都在、从没见过面"那一格,逆向复现超越 T9 分档阶梯) (0d5f41b9ba)
- 🐞 Fix:收编器补上「部分回退」臂,并修好两条从未被递达的探针 (8af02b64e8)
- 🐞 Fix:收敛零丢失判据的空行口径收口 —— 修掉一道把同步链整体卡死的与内容无关的红 (9bb933f627)
- 🐞 Fix:file-transfer 两处出网补 SSRF 闸 —— 已导出的通用工具不该指望未来调用方自觉 (8991a5434e)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (6bdbc1885c)
- 🚀 Feature/Improvement:代码检索改双腿并跑加权融合加降级具名出声(逆向复现超越 #10,对齐 Qoder 五档召回阶梯) (a898e78057)
- 📚 Docs:F9 让号 —— 本侧未推行让给已入库同号(门 203 同题跨号禁止),改前整行逐字入归档件 (64d9562895)
- 🐞 Fix:技能库导入/评分面补容量·份额·归属 —— 单人写爆内存与刷高均值两条通道一起关 (4738b9dcf2)
- 📚 Docs:固化本轮 16 份席位交接件出 gitignored tmp,落在本轮取证册同族路径 (05e018e583)
- 🐞 Fix:三条产出发布物的 CI 链收口到 --frozen-lockfile —— 签名/发布路径不再静默重解析依赖 (dd437a0463)
- 🐞 Fix:网络段内网强制锁把某一代写法当契约,实现加强后它自己恒红 (e534238946)
- 📚 Docs:只读尺清单同批登记本会话新立的两把尺(检索召回质量尺 + AI 归属读侧聚合) (2743fd398f)
- 🐞 Fix:AI 归属主体缺失时不再静默跳过(读侧尺子量出"接线在而零落笔"后的补刀) (2b81e939a7)
- 🐞 Fix:ReDoS 闸补齐另外两处调用点 —— 长度闸门挡不住 7 字符的病态模式 (c5487c1ce9)
- 🐞 Fix:上一枚回补落地后受影响判据点名门 2f-miniapp-taro 判红,就地补 ko parity —— 反算把 zh-CN 三枚键请回而 ko 缺同键(utilsMiniapplogin.alipayUnsupported / webViewPortal.artifacts / identityVerify.submit);按 i18n 流水线正牌路径自主补译 ko 三条(术语对齐包内既有写法 알리페이 / 산출물 / 인증 제출),经 i18n-apply --target=miniapp-taro --check-first 写入,派生态同批重派(gen-i18n-compressed;en/ja/zh-TW 的 b64 与基线逐字相同故不入声明集)。有意留痕:ko.json 含上一枚从祖先回补的 565 行,按守卫的尺即「行级复活」,而窄清单通道 LAND_RESTORE_MANIFEST 对 .json 只受理数组元素级、字典键级还原不受理 ⇒ 走出口② LAND_ALLOW_STALE=1 显式放行(与枚 fa2b5a4082 同一理由的续格),其余判据一道未跳。末行现读:i18n-diff --target=miniapp-taro 报「无 pending,所有语言 parity + 翻译完整」,i18n-apply 自报 parity 通过。 (af54b80080)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a05583509c)
- 🐞 Fix:WebView 落点信任闸上收共享层 —— RN 不再把会话授权码签给任意 origin (5cfcb917de)
- 🐞 Fix:回补被收编扫描整片抹掉的 2915 行翻译(cli 状态词+小程序五语包+web),派生态同批重派 —— 枚 f9fb2e4ceb(2026-10-31)入库六小时后被枚 f0572d64c4(2026-11-01 00:40 chore(i18n) 收编停留≥3分钟未提交改动)反手抹掉,同枚还削掉 miniapp-taro 五语包各 586 行与 web 各 2 行,合计 2915 删除;现读 cli 包键数 66 掉到 52,packages/types 词条镜像用例红在 HEAD 面(zh-CN 缺 cli.failureOutcomeRetryable ⇒ 五语言全缺)。这与本轮已修的 G-24 归档保留档(枚 9fdbc207ba 抹)、G-44 告警身份单源(枚 9fdbc207ba 与 b41b9fdce8 抹)是同一把按滞后副本写回的刀,本枚只结清语言包这一格,扫描器自身缺守卫另行处理。修法:对 f0572d64c4 那 15 个文件逐字节反向应用(只撤其 hunk),再走正牌生成器同批重派三个 gen.ts 与四个 CDN b64。有意留痕:19 条路径的新内容按定义等于被抹前的祖先 blob(还原的目的就是回到那一形态),窄清单通道 LAND_RESTORE_MANIFEST 只受理行级与数组元素级、JSON 字典键级不受理,故按落地器出口② LAND_ALLOW_STALE=1 显式放行并在此写明;其余判据未跳。差集可核:cli 每包回补 15 键、miniapp-taro 每包 565 行、web 每包 2 行。末行现读:packages/types 词条镜像 10/10(改前红),check:i18n-keys 五语言 parity OK,离线包自述钉 matched。 (fa2b5a4082)
- 🚀 Feature/Improvement:检索召回质量只读尺 check-retrieval-quality(为双腿融合改造先立验收判据,判据先于改造) (3ac3595549)
- 🐞 Fix:notify(email) hook 不再"未投递却报成功" —— 审计/告警通道的终态必须诚实 (09ee10ea92)
- 🚀 Feature/Improvement:AI 代码归属读侧聚合出口 ai-authorship-report(补"只有写侧没有读侧"那一半,并量出写侧一枚都没落过) (1e49ec1740)
- 🐞 Fix:入口把本包自己的 nativewind env 拉进类型程序 —— 补上双份 react-native 那一格 (6239f00e6f)
- 🚀 Feature/Improvement:agent 工作簿读写工具面入库(对齐 Qoder xlsx-sidecar 的 open/read_range/write_cells/save/close) (d96d43d00d)
- 🐞 Fix:回补被两枚同步提交整片写回的 G-44 告警身份单源(部署腿+监控腿),HEAD 面三处恒红转绿 (e9134d30e2)
- 🐞 Fix:USDT 验签改走单源常数时间比较 + 未注册的 organization 路由就地补角色闸(堵 fail-open 陷阱) (64c87d8b42)
- ♻️ Refactor:web 端字号统一落盘 —— 只落可证恒等的 3877 处(font-weight 锁档) (46cd4f9051)
- 📚 Docs:F9 让号 —— 本地两枚未推行 O67 让给已入库的 O67(门128 CSS 变量解值),原行逐字入归档件 (87b3f475e1)
- 🐞 Fix:匿名语音上传补上限读取 + 外部 MCP 的 url 通道收归管理员 + 限流补档 (0448b4f43c)
- 🐞 Fix:工作区沙箱补齐 git 出网闸 + 集成代理不再让 path 改写落点 + grep 接嵌套量词判据 (555f539da8)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (92428cbd6d)
- 📚 Docs:细节能力清单第 32/33 条登记插件更新判据层与安全扫描 hooks 接线(AGENTS §21 新增端能力必须同批更新 README) (572470b674)
- 🔧 Chore/Other:门 273 自检⑯ 的 H3 资格锁改判 HEAD 面 —— 别让别人的滞后盘钉红我的自检 (079a6825a2)
- 🐞 Fix:门224镜像按固定缩进取注册条目,一枚缩进漂到三格的收尾把两条目读成合并体 (35426d5dc9)
- 🔧 Chore/Other:摘掉本席那把重复镜像锁 —— 同一判据由 O67 的 lib 单源承担,不留第二把 (1e441b5cfb)
- 🚀 Feature/Improvement:插件更新判据层 checkUpdates 与 planUpdate(补齐 G-22 autoUpdate 残腿,把门 277 接成供应链防线) (23e52bc8bf)
- 🚀 Feature/Improvement:安全扫描判据搬出命令壳并接进 hooks 两腿(逆向复现超越 G-12,对齐 Qoder security-scan 插件) (60af71ad11)
- 🚀 Feature/Improvement:工作簿读写服务面入库(收编中断席位可用的半格,主席补类型收口与 lint 修正) (5dc42a3a28)
- 🐞 Fix:让号 O67→O62819(合并新增撞号) —— 改未推本地一侧 1 行,改前原文留痕入归档件 (7a7e57708d)
- 🐞 Fix:备份落点探测锁把 G-50 的加强读成缺失,HEAD 面两例恒红 (9f1dc08fcd)
- 🐞 Fix:terminal_run 补上参数面收敛与沙箱 cwd —— 白名单内命令不再能读走仓库根的 .env (ae1546014a)
- 🐞 Fix:门104把位置比对的行数当漂移量级报,11行真差被读成213行 (9db11efbdc)
- 🐞 Fix:共享 RN 屏的类型程序自己挂上 className 增强 —— 结清 138 条类型红 (089130c719)
- 📚 Docs:细节能力清单第 31 条登记桌面输入动作族与两道内置门(AGENTS §21 新端能力必须同批更新 README) (7460082e2f)
- 📚 Docs:T8 把「对侧没有人工审批门与速率闸」降为分层表述(执行席否证主席派单断言,据实采纳) (04a1c90db6)
- ♻️ Refactor:web 端字号统一落盘 —— 只落可证恒等的 3877 处(font-weight 锁档) (5988f4cd4b)
- 🚀 Feature/Improvement:operator.rs 补输入类动作族与两道内置门(对齐 QoderComputerUse 动作面,逆向复现超越 T8 §A) (55744315c8)
- 📚 Docs:O67 就地改写为精确剩余项 —— 原点名的两条红已随枚 88bd07c0c0e 结清,剩下的是 web/小程序腿工具类未建模那一格 (975a26574f)
- 📚 Docs:点名 check-qoder-session-sync-task.mjs —— 消掉 HEAD 上唯一一枚 R4 恒红(已接线而文档隐形) (94c7251d4b)
- 🐞 Fix:登录/注册回跳收成"同源 ∪ env"白名单 + 证书打印窗转义 —— 堵掉带会话外跳与同源弹窗执行面 (fca5f7a796)
- 🐞 Fix:完成即删兜底轮把号段租约行当滞留票吃掉,千段租约的占用账被清空 (adf3f7e9a8)
- 📚 Docs:更正 Trae 册「消费方接线仍被在飞面挡住」这句过期账(写侧已接、缺的是读侧) (6d3b02600c)
- 🐞 Fix:补两枚 keyboardShouldPersistTaps —— H3 绝对零容忍维回到 0，顺带修"键盘抬起吞一次点击" (28769216be)
- 📚 Docs:按 T10 复核就地更正三处内核数字(16值/89迁移/145下限)——错误读数留在在册文档里就等于给下一席发错票 (19b19eb030)
- 📚 Docs:T10 复核 Trae 内核五条推断级读数 —— 推翻两条并给出逐枚偏移实锤(逆向复现超越的取证纪律腿) (d501ae2f64)
- 🐞 Fix:入口的 nativewind 类型增强改成注释指令 —— side-effect import 让打包器必炸 (bf1396e524)
- 📚 Docs:T9 Qoder 检索引擎实现级取证 + T8 对照架构图凭据(逆向复现超越的取证腿收口) (e90fe71010)
- 🔧 Chore/Other:.ihui-agent/tmp/rn-hyg/msg-renum.txt (11dc40379b)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (9c73e2d913)
- 🐞 Fix:清掉 HEAD 面一枚水印欠账 —— apps/api/tests/relay-account-pool-keepalive-forever.test.ts (c0958c47c7)
- 🚀 Feature/Improvement:ui-native 四原语补按压 + 两条按压通道深浅并成一档 (e63c5c17e7)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (7ae43b698d)
- ♻️ Refactor:web 端字号统一落盘 —— 只落可证恒等的 3877 处(font-weight 锁档) (22d67096b3)
- 🚀 Feature/Improvement:手工批 5 文件 8 枚 —— 含门 131 漏判的"命名函数 style"这一型 (8f8b994f80)
- 🚀 Feature/Improvement:三端落档腿装车齐 —— web 那一侧补上调度器,并把它独有的安全旗写死在 argv 上 (eab90b40e2)
- 🐞 Fix:门 128 几何维补上「CSS 命名档」这一腿 —— 落档自动化推进到哪,尺子就跟到哪 (cc6f9ee29d)
- 🚀 Feature/Improvement:按压反馈批 34 文件 62 枚 —— 死样式清掉、函数形态拆成设计档两参 (d58e272801)
- ♻️ Refactor:web 端字号统一落盘 —— 只落可证恒等的 3877 处(font-weight 锁档) (695a08c77f)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (9fdb4b7b3b)
- 🚀 Feature/Improvement:Tappable 加 pressedStyle 档 —— 修样式不许顺手改掉设计档 (06b84c8012)
- ♻️ Refactor:web 端字号统一落盘 —— 只落可证恒等的 3877 处(font-weight 锁档) (a70cb9c766)
- 🚀 Feature/Improvement:号池永久保活档 —— 机主本机 Trae 号进池并给它一条不会死的续期路 (a6179dd4a0)
- 🐞 Fix:门 273 不再把函数形态 style 当作已有反馈 —— 与门 131 停止互相打脸 (8b50a87750)
- 🚀 Feature/Improvement:人工批落 24 枚 —— VoiceNote/HomeScreen/ChatScreen/ImageAnnotator 全换 Tappable (2ffa442d8b)
- ♻️ Refactor:剩余字号任意值落档 350 处(500~700 字重档)—— 小程序端字号面清零 (dcf297e539)

**2026-10-31**
**2026-10-30**
- 🔧 Chore/Other:ui-routes 派生产物按 HEAD 面重生成落地 —— 还原度批 48 文件与壳承载升级后四端路由钉同步(mobile-rn 27 行级 / miniapp-taro 119 行级;web 份有他席在飞改动按门纪律拒绝写回未触碰;钉头注行与祖先 3f5069448 的重合是生成器幂等产出,非滞后回退) (aea62a2896)
- 🔧 Chore/Other:docs(agnes)[cross-domain]: 端点与域名事实按 2026-10-30 直连四组合更正 + 副本收单源 + 出网披露清单按现读重建 (110cf9d6d4)

- 🐞 Fix:门 253 补 D4「模块对象属性取用」维 + 存量逐条点名 —— 当日的安静停机这一型终于有尺子 (8d7d15a5a9)

- 🚀 Feature/Improvement:切号携对话闭环收口 —— 一条命令完成「切号+连续性对账」,对账器扩到 codex/zcode/opencode (a22b5d07a1)
- 🐞 Fix:门 253 补 D4「模块对象属性取用」维 + 存量逐条点名 —— 当日的安静停机这一型终于有尺子 (8d7d15a5a9)

- 🔧 Chore/Other:未判定连击三格的行为锁 —— 起点不得被清 / 未知腿有阳性对照 / 测试不得拿真实起点账当对象 (de9c682b29)
- 🐞 Fix:未判定连击三格收口 —— 三条腿自报 undetermined 时不再清起点账,180 分钟到人这条腿才真会响 (e1636ec07b)

- 🔧 Chore/Other:G-1102638 批1 同主键副本行物理归并 — 删 8 行(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕;幸存者规则与F4同向;落账注记行保留待批2;复跑auditPlan对账F1=0/F9不增;逐行留痕 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-30.md) (fa1954acfb)
- 🚀 Feature/Improvement:新增 relay:switch-oneclick 一键切号模式（自动建会话库快照+联动换桶，支持TTY交互选号，复用现有函数不复制逻辑） (484b0c8ec0)
- 🐞 Fix:清掉 2 条 exhaustive-deps 警告 —— 依赖表取稳定成员与移除未用 t (d9c1a97546)

- 🐞 Fix:/coupons/available 双注册把整个 API 色挡在线下 —— 支付页那支迁到 /pay 下 (399dc2969c)
- 🚀 Feature/Improvement:第二轮产品级差距修复(G1 跨设备/G2 自动化闭环/G3 产物管线/G4 计费弹性/G5 知识引擎/G6 企业治理 + E1/E2/E4) (0e875130c0)
- 🚀 Feature/Improvement:第二轮产品级五语词表(设备互联/交付物/自动化/企业治理/导入七源/CLI wiki) (9654b6a156)
- 🔧 Chore/Other:补齐两处源文件水印 —— csp.ts 与 tag 剪枝器 (97c20cc3d6)
- 🔧 Chore/Other:补登 4 个测试文件的溯源水印(HEAD 面欠账清偿) (06efc5fe3e)
- 🔧 Chore/Other:四枚按 g41-A 席一手证据结清(L28150 / L5645 / L5650 / L5644) (1cf14da043)
- 🔧 Chore/Other:恢复被整笔回退的两处判据 —— 敏感路由声明模型与 9 档事件清单按真实语义对齐 (af40ec736d)
- 🐞 Fix:清偿 ruff 全量 6 条(SIM103/UP037/I001/B905) —— 判据面禁改文件由本席按规则最小修正 (087f9e291c)
- 🐞 Fix:两屏颜色键按样式工厂约定回正 —— chipActiveText/tabActiveText/filterChipActiveText (b2b5f5fceb)
- 🚀 Feature/Improvement:一键切号补齐客户端生命周期,桌面双击完成关→选号→切号换桶→续开 (ab064e7d80)
- 🐞 Fix:合并吞掉的 13 个拆分组件回盘 —— 小程序 typecheck 在 HEAD 恒红 (36f97a756a)
- 🔧 Chore/Other:补登 14 枚文件的溯源水印 —— 续 06efc5fe3e0c5516885408df8a76f65adfb12181 那笔未落完的 web/archify/ai-service 批次(上一会话在落地前中断);工作树面 14/14 载荷已验完好,本枚只把水印带进 HEAD (2d96e7167f)
- 📚 Docs:登记 HTTP 路由唯一性零判据与支付链缺测试面 —— 今日 /api/coupons/available 双注册把 API 整色挡在线下的后续工单 (5d5705b36c)
- 🚀 Feature/Improvement:大屏「使用数据」六块面板接线 —— 布局与数据一直在,页面从未渲染 (cffda9f484)
- 📚 Docs:更正"在线还原演练缺建库权限"那句 —— 隔离集群法已端到端实证 (d0eeb48556)
**2026-10-30**
- 📚 Docs:复核第 4 行再改判 —— automation 工具真会执行,问题在僵尸模块与定时四件套缺位 (2c6154d191)
- 📚 Docs:派工前逐条复核 Top-12,第 1 行「审批收件箱缺失」与第 5 行「批准即生成规则」被现读推翻 —— 加 §3b 复核表并改派工序 (df330034d6)
- 🔧 Chore/Other:RP-90 结清摘行 —— 两处 prod 候选已同改吃 lib/prod-checkout-root 单源(HEAD 现读:deploy-decisions-face.mjs 注释自述 RP-90 已收、check-prod-checkout-foreign-work.mjs:90 import 且:584-592 通道C 走 prodCheckoutRoot),镜像 check-ops-patrol 51/51 + check-prod-checkout-foreign-work 1/1 全绿 (8c9486bd0b)
- 📚 Docs:能力树改为「源入库+产物不入库」—— candidate.json 与四份回执入库,HTML 按 .gitignore:295 的全局 *.html 规则不入库(不 -f 绕规) (c11469fdb8)
- 📚 Docs:O68 侧车归属改判无出口 按当场复跑证伪摘行 (声明式改判器 plan-fields-reclassify 在册且自检 9 通过 0 失败; O02 侧车 owner 已为机主真机验证面且 updatedBy 即该器; plan-tasks 派单现读对 O02 零命中) (6da6be99c2)
- 🔧 Chore/Other:守门 268 与兜底清扫器的 no-console 警告按同侪写法收口 (6014abefb3)
- 🔧 Chore/Other:G-50 结清删除 —— DevEnv 搬迁完成(旧根退役、备份卷改道) (19f5440261)
- 🐞 Fix:G-50 收口 —— 备份卷改道 §15b 批准落点,旧根 G:\DevEnv 退役删除 (e91f297336)
- 📚 Docs:守门 268 check-head-recall-stock 补进点名索引(门 89 R4 义务;AGENTS 已超 207 预算,AGENTS∪README 文档面按 README 归零) (b7989c8dfd)
- 🔧 Chore/Other:补落离线包派生面 —— 本席上一笔在合并前重生成,把"比源少 4 键"的包带进了 HEAD (0e6e8bfb45)
- 📚 Docs:提交/推送/合并改为 agent 自主强制动作 —— 取消'合并决策权归人',未合并检出改由 agent 依证据自主裁决(§12h 补条) (ed7b0f2098)
- 🐞 Fix:_model 的两处 no-any-return —— 收窄要判在"绑出来的局部"上,不是判在 .get() 表达式上 (e54a88d069)
- 📚 Docs:CSP 那行按线上实测更正 —— 文档写着比实际弱的面,本身就是缺陷 (244d6a4e0d)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (e2c9f7cf62)
- 🔧 Chore/Other:G-50 两形态并一 —— 摘除被取代的「等环境」旧行(正文已在保留行内) (bc70a3cad5)
- 🐞 Fix:停摆尺子读线上标记的落点硬写 .next —— 蓝绿形态下每轮读空并寄假停摆 (999e7051c9)
- 🐞 Fix:小程序 8 处调用接回真身并停止伪装 —— 与五语言同批(门 R2 规定含 messages/ 的提交取 scope=i18n,故本枚把端上改动与语言包同笔落) (c0f644a7c8)
- 🐞 Fix:补动态评论两条腿 + 邮箱验证码开 bind 场景 —— 前端接回真身的前置 (b52b052ee1)
- 🐞 Fix:一键模式的「快照已就绪」判据改与换桶同源 —— 昨天有快照不再冒充今天 (0d46f19685)
- 🔧 Chore/Other:快捷方式安装器入库 —— 桌面入口丢了/换机可一条命令重建 (3b195ef715)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (407c91eb36)
- 🐞 Fix:真机验证抓到两处「关闭客户端」缺陷 —— 进程名解析与强制兜底 (ca4874f3e5)
- 🚀 Feature/Improvement:补「HEAD 面回捞件」那一格——根治计划任务文档读数跳跃 (fea7830303)
- 🐞 Fix:派生弹窗存量 10 处归零 —— archify/rea 入仓时没带 windowsHide,这道门从那时起钉红所有人 (7681858835)
- 🐞 Fix:pre-push 的 tag-only 豁免看不见「删除 tag」——清仓实测 20 倍提速 (6272e5dca3)
- 📚 Docs:Qoder CN 0.5.1 REA 取证册入库(六层能力地图/33 轴判定/真缺 Top12/本轮被推翻 6 条) (18aea5255a)
- 🐞 Fix:摘掉安装期的 wxt prepare —— 干净检出上它必解析不到 @ihui/i18n 的 dist,setup 一挂就带走 CI/OpenAPI/e2e/real-db/Knip 五条 workflow;prepare 改挂 typecheck 脚本,ci-monorepo 里并把该步移到建包之后;顺手补 build 作业 mirror-fidelity 的自述登记 (59c1bc650f)
- 🔧 Chore/Other:RP-47 结清摘行 —— 两门 --staged 现读 rc=0(221:2118 枚逐一编译通过;254:零缺口),票面所称「恒取不到索引 blob」症状已不在;票面要求的可观测腿已装车(lib/face-reader 的 probeFaceSpec/describeProbe,两门未判定分支各接一次,镜像 39/39 含接线形状锁),落地 53d8ef47e9 (db197d2f1e)
- 🐞 Fix:RP-47 可观测腿 —— 两把门的「取不到」未判定必须点名命令/rc/stderr (53d8ef47e9)

- 🔧 Chore/Other:G-1102638 批1 同主键副本行物理归并 — 删 8 行(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕;幸存者规则与F4同向;落账注记行保留待批2;复跑auditPlan对账F1=0/F9不增;逐行留痕 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-30.md) (fa1954acfb)
- 🚀 Feature/Improvement:新增 relay:switch-oneclick 一键切号模式（自动建会话库快照+联动换桶，支持TTY交互选号，复用现有函数不复制逻辑） (484b0c8ec0)
- 🐞 Fix:清掉 2 条 exhaustive-deps 警告 —— 依赖表取稳定成员与移除未用 t (d9c1a97546)

- 🐞 Fix:/coupons/available 双注册把整个 API 色挡在线下 —— 支付页那支迁到 /pay 下 (399dc2969c)
- 🚀 Feature/Improvement:第二轮产品级差距修复(G1 跨设备/G2 自动化闭环/G3 产物管线/G4 计费弹性/G5 知识引擎/G6 企业治理 + E1/E2/E4) (0e875130c0)
- 🚀 Feature/Improvement:第二轮产品级五语词表(设备互联/交付物/自动化/企业治理/导入七源/CLI wiki) (9654b6a156)
- 🔧 Chore/Other:补齐两处源文件水印 —— csp.ts 与 tag 剪枝器 (97c20cc3d6)
- 🔧 Chore/Other:补登 4 个测试文件的溯源水印(HEAD 面欠账清偿) (06efc5fe3e)
- 🔧 Chore/Other:四枚按 g41-A 席一手证据结清(L28150 / L5645 / L5650 / L5644) (1cf14da043)
- 🔧 Chore/Other:恢复被整笔回退的两处判据 —— 敏感路由声明模型与 9 档事件清单按真实语义对齐 (af40ec736d)
- 🐞 Fix:清偿 ruff 全量 6 条(SIM103/UP037/I001/B905) —— 判据面禁改文件由本席按规则最小修正 (087f9e291c)
- 🐞 Fix:两屏颜色键按样式工厂约定回正 —— chipActiveText/tabActiveText/filterChipActiveText (b2b5f5fceb)
- 🚀 Feature/Improvement:一键切号补齐客户端生命周期,桌面双击完成关→选号→切号换桶→续开 (ab064e7d80)
- 🐞 Fix:合并吞掉的 13 个拆分组件回盘 —— 小程序 typecheck 在 HEAD 恒红 (36f97a756a)
- 🔧 Chore/Other:补登 14 枚文件的溯源水印 —— 续 06efc5fe3e0c5516885408df8a76f65adfb12181 那笔未落完的 web/archify/ai-service 批次(上一会话在落地前中断);工作树面 14/14 载荷已验完好,本枚只把水印带进 HEAD (2d96e7167f)
- 📚 Docs:登记 HTTP 路由唯一性零判据与支付链缺测试面 —— 今日 /api/coupons/available 双注册把 API 整色挡在线下的后续工单 (5d5705b36c)
- 🚀 Feature/Improvement:大屏「使用数据」六块面板接线 —— 布局与数据一直在,页面从未渲染 (cffda9f484)
- 📚 Docs:更正"在线还原演练缺建库权限"那句 —— 隔离集群法已端到端实证 (d0eeb48556)
**2026-10-30**
- 📚 Docs:复核第 4 行再改判 —— automation 工具真会执行,问题在僵尸模块与定时四件套缺位 (2c6154d191)
- 📚 Docs:派工前逐条复核 Top-12,第 1 行「审批收件箱缺失」与第 5 行「批准即生成规则」被现读推翻 —— 加 §3b 复核表并改派工序 (df330034d6)
- 🔧 Chore/Other:RP-90 结清摘行 —— 两处 prod 候选已同改吃 lib/prod-checkout-root 单源(HEAD 现读:deploy-decisions-face.mjs 注释自述 RP-90 已收、check-prod-checkout-foreign-work.mjs:90 import 且:584-592 通道C 走 prodCheckoutRoot),镜像 check-ops-patrol 51/51 + check-prod-checkout-foreign-work 1/1 全绿 (8c9486bd0b)
- 📚 Docs:能力树改为「源入库+产物不入库」—— candidate.json 与四份回执入库,HTML 按 .gitignore:295 的全局 *.html 规则不入库(不 -f 绕规) (c11469fdb8)
- 📚 Docs:O68 侧车归属改判无出口 按当场复跑证伪摘行 (声明式改判器 plan-fields-reclassify 在册且自检 9 通过 0 失败; O02 侧车 owner 已为机主真机验证面且 updatedBy 即该器; plan-tasks 派单现读对 O02 零命中) (6da6be99c2)
- 🔧 Chore/Other:守门 268 与兜底清扫器的 no-console 警告按同侪写法收口 (6014abefb3)
- 🔧 Chore/Other:G-50 结清删除 —— DevEnv 搬迁完成(旧根退役、备份卷改道) (19f5440261)
- 🐞 Fix:G-50 收口 —— 备份卷改道 §15b 批准落点,旧根 G:\DevEnv 退役删除 (e91f297336)
- 📚 Docs:守门 268 check-head-recall-stock 补进点名索引(门 89 R4 义务;AGENTS 已超 207 预算,AGENTS∪README 文档面按 README 归零) (b7989c8dfd)
- 🔧 Chore/Other:补落离线包派生面 —— 本席上一笔在合并前重生成,把"比源少 4 键"的包带进了 HEAD (0e6e8bfb45)
- 📚 Docs:提交/推送/合并改为 agent 自主强制动作 —— 取消'合并决策权归人',未合并检出改由 agent 依证据自主裁决(§12h 补条) (ed7b0f2098)
- 🐞 Fix:_model 的两处 no-any-return —— 收窄要判在"绑出来的局部"上,不是判在 .get() 表达式上 (e54a88d069)
- 📚 Docs:CSP 那行按线上实测更正 —— 文档写着比实际弱的面,本身就是缺陷 (244d6a4e0d)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (e2c9f7cf62)
- 🔧 Chore/Other:G-50 两形态并一 —— 摘除被取代的「等环境」旧行(正文已在保留行内) (bc70a3cad5)
- 🐞 Fix:停摆尺子读线上标记的落点硬写 .next —— 蓝绿形态下每轮读空并寄假停摆 (999e7051c9)
- 🐞 Fix:小程序 8 处调用接回真身并停止伪装 —— 与五语言同批(门 R2 规定含 messages/ 的提交取 scope=i18n,故本枚把端上改动与语言包同笔落) (c0f644a7c8)
- 🐞 Fix:补动态评论两条腿 + 邮箱验证码开 bind 场景 —— 前端接回真身的前置 (b52b052ee1)
- 🐞 Fix:一键模式的「快照已就绪」判据改与换桶同源 —— 昨天有快照不再冒充今天 (0d46f19685)
- 🔧 Chore/Other:快捷方式安装器入库 —— 桌面入口丢了/换机可一条命令重建 (3b195ef715)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (407c91eb36)
- 🐞 Fix:真机验证抓到两处「关闭客户端」缺陷 —— 进程名解析与强制兜底 (ca4874f3e5)
- 🚀 Feature/Improvement:补「HEAD 面回捞件」那一格——根治计划任务文档读数跳跃 (fea7830303)
- 🐞 Fix:派生弹窗存量 10 处归零 —— archify/rea 入仓时没带 windowsHide,这道门从那时起钉红所有人 (7681858835)
- 🐞 Fix:pre-push 的 tag-only 豁免看不见「删除 tag」——清仓实测 20 倍提速 (6272e5dca3)
- 📚 Docs:Qoder CN 0.5.1 REA 取证册入库(六层能力地图/33 轴判定/真缺 Top12/本轮被推翻 6 条) (18aea5255a)
- 🐞 Fix:schedule_task 落库的 conversation_id 改为真会话 id(此前写任务名,导致按会话查不到自建任务);补两条映射测试 (bb8df39199)
- 🚀 Feature/Improvement:注册门 269 API 路由唯一性(blocking,stagedTriggers=apps/api/) (030b894f1c)
- 📚 Docs:门 269 check-api-route-uniqueness 补进点名索引(R4 义务,先点名后注册) (1bb1c8c30c)
- 🚀 Feature/Improvement:补「同一 (method,path) 注册两次」的提交链判据 —— 今日已为此停摆一次 (46d65e94ac)
- 🔧 Chore/Other:旗清单落成 JSON + 镜像测试重写为 11 例(修 HEAD 上缺依赖的那一格) (b201309b88)
- 📚 Docs:RP-79 剩余面结清摘行(第二次,按回捞后的当前形态入账) —— 旗面单源完备性机器现算,未知旗闸装车 exit two 加定向说明放行,形状锁八例,自检一百五十八例,代码落地枚 d3201093f07 (830fee3d46)
- 📚 Docs:重落正本 §7b(首落 ee403f088c 被别席收敛吞掉,已打 lost-commit tag 保活) (f9c0dc1988)
- 📚 Docs:RP-79 剩余面结清摘行 —— 旗面抽单源且完备性机器现算(源码消费十六枚全覆盖),未知旗闸装车(exit two + 定向说明放行),USAGE 成套形状锁八例,自检一百五十八例全过,落地枚 d3201093f07 (7908385ffb)
- 🚀 Feature/Improvement:补装定时任务查询/取消工具 + run 三维机读计数;按创建动词同档收紧为 admin (1964518737)
- 🐞 Fix:收敛器装未知旗闸并把旗面抽成单源 —— 未认识的旗按用法错退出码二,定向说明可放行;清单完备性由源码扫描器现算而非人抄;形状锁八例。immutable-exempt: 本票要求为收敛器装闸并抽出清单单源,改动只新增闸与接线,不动任何既有判据与阈值 (d3201093f0)
- 🔧 Chore/Other:清 23 枚 HEAD 面水印欠账 —— 只补溯源载荷,零业务改动 (7cd758f4e3)
- 📚 Docs:补一行体积清偿指针 —— 44 行已整行移入 .ihui-agent/archive/AGENTS_trim-2026-10-31.md(规则条款一条未减;R4 点名义务同期转 README,补 17 枚门名),现读 95,121/96,000 (2f0140dc1f)
- 🐞 Fix:check-app-version-latest 补 --self-test(28 例)—— 此前文档写了跑不通的出路 (3f60aa920b)
- 🐞 Fix:重封 root-guard 清单 —— fea7830303 补门 268 时未同批封存,三个签出的部署环被 fail-closed 卡住 (c20d6ad587)
- 📚 Docs:R4 补点名 17 枚 —— AGENTS 体积清偿把 R4 登记补记整行移入归档件后,这些门的唯一文档点名处随之搬走(门 89 R4 立刻翻红 17 枚)。按 AGENTS 自己的口径「点名索引的正式归宿 = README」把 17 个门名补进索引节,判据不动;逐条判据/自检/跳过变量仍在各门体头注与原归档件里 (36f2020a6c)
- 🐞 Fix:关客户端改成「先枚举 PID、再逐个 /PID 杀」—— taskkill /IM 只收裸文件名,会连带关掉同名别的安装 (8379b3ad23)
- 📚 Docs:体积清偿 —— 44 行 R4 登记补记与同族重复副本整行移入 .ihui-agent/archive/AGENTS_trim-2026-10-31.md(门 207:121,974→95,121 B,预算 96,000;两步归档先移动后摘;七类必须留的判据各自存活至少一份;R4 点名义务由 README 索引承担,搬后门 89 R4 零红) (a1536eaa24)
- 🐞 Fix:tag 清仓要同时摘「存续层期望清单」—— 否则守护按清单把删掉的引用原样重建 (65788e5f6b)
- 📚 Docs:先把体积清偿要搬走的 44 行逐字归档,再动 AGENTS.md(两步归档:先移动、再摘) (e6eb9a03dc)
- 📚 Docs:RP-78 按实测结清 —— 票面称本机 .git 是 gitfile 被三面现读推翻(实体目录/非重解析点/D-IHUI-AI-git-repo 不存在),真风险方向相反且已在 AGENTS 更正(d59742000f) (ee4092b624)
- 📚 Docs:gitdir 形态按 2026-10-31 实测更正(工作区 .git 是实体目录,非 gitfile;D:/IHUI-AI-git-repo 不存在) —— 原文写反会把真库标成遗留并诱发误删; immutable-exempt: 更正与本机实测相反的机器事实断言,属 §0 七类机器事实每次现读要求的纠错 (d59742000f)
- 🐞 Fix:摘掉安装期的 wxt prepare —— 干净检出上它必解析不到 @ihui/i18n 的 dist,setup 一挂就带走 CI/OpenAPI/e2e/real-db/Knip 五条 workflow;prepare 改挂 typecheck 脚本,ci-monorepo 里并把该步移到建包之后;顺手补 build 作业 mirror-fidelity 的自述登记 (59c1bc650f)
- 🚀 Feature/Improvement:号池面板补齐健康四态 / 按供应商分布 / 24h 临期 —— 三格数据一直回但界面无人读 (7215469a79)
- 🔧 Chore/Other:RP-47 结清摘行 —— 两门 --staged 现读 rc=0(221:2118 枚逐一编译通过;254:零缺口),票面所称「恒取不到索引 blob」症状已不在;票面要求的可观测腿已装车(lib/face-reader 的 probeFaceSpec/describeProbe,两门未判定分支各接一次,镜像 39/39 含接线形状锁),落地 53d8ef47e9 (db197d2f1e)
- 🐞 Fix:RP-47 可观测腿 —— 两把门的「取不到」未判定必须点名命令/rc/stderr (53d8ef47e9)

- 🐞 Fix:恢复被 72769534b6 整片回退的离线包承载层装载 —— 生成器接回 bundleInputRels/rn-carried-keys,钉与门 105 的现算口径重新同源 (3b36cc477a)
- 📚 Docs:补 Agnes 生产落地三步 —— 密钥面 + 定价行落地 + 三处验证 (d99922c773)
- 🐞 Fix:切号连续性快照落点修正 —— 状态不再写进 scripts/.ihui-agent 树内 (638a0b0476)
- 🔧 Chore/Other:补最后一枚归档件水印 —— 取 HEAD 内容注水,不碰别席在飞改动 (71adeb2b6f)
- 🔧 Chore/Other:G-1102638 批1 同主键副本行物理归并 — 删 8 行(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕;幸存者规则与F4同向;落账注记行保留待批2;复跑auditPlan对账F1=0/F9不增;逐行留痕 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-30.md) (fa1954acfb)
- 🚀 Feature/Improvement:新增 relay:switch-oneclick 一键切号模式（自动建会话库快照+联动换桶，支持TTY交互选号，复用现有函数不复制逻辑） (484b0c8ec0)
- 🐞 Fix:清掉 2 条 exhaustive-deps 警告 —— 依赖表取稳定成员与移除未用 t (d9c1a97546)

- 🐞 Fix:/coupons/available 双注册把整个 API 色挡在线下 —— 支付页那支迁到 /pay 下 (399dc2969c)
- 🚀 Feature/Improvement:第二轮产品级差距修复(G1 跨设备/G2 自动化闭环/G3 产物管线/G4 计费弹性/G5 知识引擎/G6 企业治理 + E1/E2/E4) (0e875130c0)
- 🚀 Feature/Improvement:第二轮产品级五语词表(设备互联/交付物/自动化/企业治理/导入七源/CLI wiki) (9654b6a156)
- 🔧 Chore/Other:补齐两处源文件水印 —— csp.ts 与 tag 剪枝器 (97c20cc3d6)
- 🔧 Chore/Other:补登 4 个测试文件的溯源水印(HEAD 面欠账清偿) (06efc5fe3e)
- 🔧 Chore/Other:四枚按 g41-A 席一手证据结清(L28150 / L5645 / L5650 / L5644) (1cf14da043)
- 🔧 Chore/Other:恢复被整笔回退的两处判据 —— 敏感路由声明模型与 9 档事件清单按真实语义对齐 (af40ec736d)
- 🐞 Fix:清偿 ruff 全量 6 条(SIM103/UP037/I001/B905) —— 判据面禁改文件由本席按规则最小修正 (087f9e291c)
- 🐞 Fix:两屏颜色键按样式工厂约定回正 —— chipActiveText/tabActiveText/filterChipActiveText (b2b5f5fceb)
- 🚀 Feature/Improvement:一键切号补齐客户端生命周期,桌面双击完成关→选号→切号换桶→续开 (ab064e7d80)
- 🐞 Fix:合并吞掉的 13 个拆分组件回盘 —— 小程序 typecheck 在 HEAD 恒红 (36f97a756a)
- 🔧 Chore/Other:补登 14 枚文件的溯源水印 —— 续 06efc5fe3e0c5516885408df8a76f65adfb12181 那笔未落完的 web/archify/ai-service 批次(上一会话在落地前中断);工作树面 14/14 载荷已验完好,本枚只把水印带进 HEAD (2d96e7167f)
- 📚 Docs:登记 HTTP 路由唯一性零判据与支付链缺测试面 —— 今日 /api/coupons/available 双注册把 API 整色挡在线下的后续工单 (5d5705b36c)
- 🚀 Feature/Improvement:大屏「使用数据」六块面板接线 —— 布局与数据一直在,页面从未渲染 (cffda9f484)
- 📚 Docs:更正"在线还原演练缺建库权限"那句 —— 隔离集群法已端到端实证 (d0eeb48556)
**2026-10-30**
- 📚 Docs:复核第 4 行再改判 —— automation 工具真会执行,问题在僵尸模块与定时四件套缺位 (2c6154d191)
- 📚 Docs:派工前逐条复核 Top-12,第 1 行「审批收件箱缺失」与第 5 行「批准即生成规则」被现读推翻 —— 加 §3b 复核表并改派工序 (df330034d6)
- 🔧 Chore/Other:RP-90 结清摘行 —— 两处 prod 候选已同改吃 lib/prod-checkout-root 单源(HEAD 现读:deploy-decisions-face.mjs 注释自述 RP-90 已收、check-prod-checkout-foreign-work.mjs:90 import 且:584-592 通道C 走 prodCheckoutRoot),镜像 check-ops-patrol 51/51 + check-prod-checkout-foreign-work 1/1 全绿 (8c9486bd0b)
- 📚 Docs:能力树改为「源入库+产物不入库」—— candidate.json 与四份回执入库,HTML 按 .gitignore:295 的全局 *.html 规则不入库(不 -f 绕规) (c11469fdb8)
- 📚 Docs:O68 侧车归属改判无出口 按当场复跑证伪摘行 (声明式改判器 plan-fields-reclassify 在册且自检 9 通过 0 失败; O02 侧车 owner 已为机主真机验证面且 updatedBy 即该器; plan-tasks 派单现读对 O02 零命中) (6da6be99c2)
- 🔧 Chore/Other:守门 268 与兜底清扫器的 no-console 警告按同侪写法收口 (6014abefb3)
- 🔧 Chore/Other:G-50 结清删除 —— DevEnv 搬迁完成(旧根退役、备份卷改道) (19f5440261)
- 🐞 Fix:G-50 收口 —— 备份卷改道 §15b 批准落点,旧根 G:\DevEnv 退役删除 (e91f297336)
- 📚 Docs:守门 268 check-head-recall-stock 补进点名索引(门 89 R4 义务;AGENTS 已超 207 预算,AGENTS∪README 文档面按 README 归零) (b7989c8dfd)
- 🔧 Chore/Other:补落离线包派生面 —— 本席上一笔在合并前重生成,把"比源少 4 键"的包带进了 HEAD (0e6e8bfb45)
- 📚 Docs:提交/推送/合并改为 agent 自主强制动作 —— 取消'合并决策权归人',未合并检出改由 agent 依证据自主裁决(§12h 补条) (ed7b0f2098)
- 🐞 Fix:_model 的两处 no-any-return —— 收窄要判在"绑出来的局部"上,不是判在 .get() 表达式上 (e54a88d069)
- 📚 Docs:CSP 那行按线上实测更正 —— 文档写着比实际弱的面,本身就是缺陷 (244d6a4e0d)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (e2c9f7cf62)
- 🔧 Chore/Other:G-50 两形态并一 —— 摘除被取代的「等环境」旧行(正文已在保留行内) (bc70a3cad5)
- 🐞 Fix:停摆尺子读线上标记的落点硬写 .next —— 蓝绿形态下每轮读空并寄假停摆 (999e7051c9)
- 🐞 Fix:小程序 8 处调用接回真身并停止伪装 —— 与五语言同批(门 R2 规定含 messages/ 的提交取 scope=i18n,故本枚把端上改动与语言包同笔落) (c0f644a7c8)
- 🐞 Fix:补动态评论两条腿 + 邮箱验证码开 bind 场景 —— 前端接回真身的前置 (b52b052ee1)
- 🐞 Fix:一键模式的「快照已就绪」判据改与换桶同源 —— 昨天有快照不再冒充今天 (0d46f19685)
- 🔧 Chore/Other:快捷方式安装器入库 —— 桌面入口丢了/换机可一条命令重建 (3b195ef715)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (407c91eb36)
- 🐞 Fix:真机验证抓到两处「关闭客户端」缺陷 —— 进程名解析与强制兜底 (ca4874f3e5)
- 🚀 Feature/Improvement:补「HEAD 面回捞件」那一格——根治计划任务文档读数跳跃 (fea7830303)
- 🐞 Fix:派生弹窗存量 10 处归零 —— archify/rea 入仓时没带 windowsHide,这道门从那时起钉红所有人 (7681858835)
- 🐞 Fix:pre-push 的 tag-only 豁免看不见「删除 tag」——清仓实测 20 倍提速 (6272e5dca3)
- 📚 Docs:Qoder CN 0.5.1 REA 取证册入库(六层能力地图/33 轴判定/真缺 Top12/本轮被推翻 6 条) (18aea5255a)
- 🐞 Fix:离线包生成器恢复承载层 —— 72769534b6 把它整段删了,门与单源 lib 却仍在按三层算 (6518d4415b)
- 🐞 Fix:schedule_task 落库的 conversation_id 改为真会话 id(此前写任务名,导致按会话查不到自建任务);补两条映射测试 (bb8df39199)
- 🚀 Feature/Improvement:注册门 269 API 路由唯一性(blocking,stagedTriggers=apps/api/) (030b894f1c)
- 📚 Docs:门 269 check-api-route-uniqueness 补进点名索引(R4 义务,先点名后注册) (1bb1c8c30c)
- 🚀 Feature/Improvement:补「同一 (method,path) 注册两次」的提交链判据 —— 今日已为此停摆一次 (46d65e94ac)
- 🐞 Fix:三处"判据看不见合法形制"的误报 + 专项档判据方向反了 —— 守门面按形态扩,阈值一个不动 (ed9d964382)
- 🔧 Chore/Other:旗清单落成 JSON + 镜像测试重写为 11 例(修 HEAD 上缺依赖的那一格) (b201309b88)
- 📚 Docs:RP-79 剩余面结清摘行(第二次,按回捞后的当前形态入账) —— 旗面单源完备性机器现算,未知旗闸装车 exit two 加定向说明放行,形状锁八例,自检一百五十八例,代码落地枚 d3201093f07 (830fee3d46)
- 📚 Docs:重落正本 §7b(首落 ee403f088c 被别席收敛吞掉,已打 lost-commit tag 保活) (f9c0dc1988)
- 📚 Docs:RP-79 剩余面结清摘行 —— 旗面抽单源且完备性机器现算(源码消费十六枚全覆盖),未知旗闸装车(exit two + 定向说明放行),USAGE 成套形状锁八例,自检一百五十八例全过,落地枚 d3201093f07 (7908385ffb)
- 🚀 Feature/Improvement:补装定时任务查询/取消工具 + run 三维机读计数;按创建动词同档收紧为 admin (1964518737)
- 🐞 Fix:收敛器装未知旗闸并把旗面抽成单源 —— 未认识的旗按用法错退出码二,定向说明可放行;清单完备性由源码扫描器现算而非人抄;形状锁八例。immutable-exempt: 本票要求为收敛器装闸并抽出清单单源,改动只新增闸与接线,不动任何既有判据与阈值 (d3201093f0)
- 🔧 Chore/Other:清 23 枚 HEAD 面水印欠账 —— 只补溯源载荷,零业务改动 (7cd758f4e3)
- 📚 Docs:补一行体积清偿指针 —— 44 行已整行移入 .ihui-agent/archive/AGENTS_trim-2026-10-31.md(规则条款一条未减;R4 点名义务同期转 README,补 17 枚门名),现读 95,121/96,000 (2f0140dc1f)
- 🐞 Fix:check-app-version-latest 补 --self-test(28 例)—— 此前文档写了跑不通的出路 (3f60aa920b)
- 🐞 Fix:重封 root-guard 清单 —— fea7830303 补门 268 时未同批封存,三个签出的部署环被 fail-closed 卡住 (c20d6ad587)
- 📚 Docs:R4 补点名 17 枚 —— AGENTS 体积清偿把 R4 登记补记整行移入归档件后,这些门的唯一文档点名处随之搬走(门 89 R4 立刻翻红 17 枚)。按 AGENTS 自己的口径「点名索引的正式归宿 = README」把 17 个门名补进索引节,判据不动;逐条判据/自检/跳过变量仍在各门体头注与原归档件里 (36f2020a6c)
- 🐞 Fix:关客户端改成「先枚举 PID、再逐个 /PID 杀」—— taskkill /IM 只收裸文件名,会连带关掉同名别的安装 (8379b3ad23)
- 📚 Docs:体积清偿 —— 44 行 R4 登记补记与同族重复副本整行移入 .ihui-agent/archive/AGENTS_trim-2026-10-31.md(门 207:121,974→95,121 B,预算 96,000;两步归档先移动后摘;七类必须留的判据各自存活至少一份;R4 点名义务由 README 索引承担,搬后门 89 R4 零红) (a1536eaa24)
- 🐞 Fix:tag 清仓要同时摘「存续层期望清单」—— 否则守护按清单把删掉的引用原样重建 (65788e5f6b)
- 📚 Docs:先把体积清偿要搬走的 44 行逐字归档,再动 AGENTS.md(两步归档:先移动、再摘) (e6eb9a03dc)
- 📚 Docs:RP-78 按实测结清 —— 票面称本机 .git 是 gitfile 被三面现读推翻(实体目录/非重解析点/D-IHUI-AI-git-repo 不存在),真风险方向相反且已在 AGENTS 更正(d59742000f) (ee4092b624)
- 📚 Docs:gitdir 形态按 2026-10-31 实测更正(工作区 .git 是实体目录,非 gitfile;D:/IHUI-AI-git-repo 不存在) —— 原文写反会把真库标成遗留并诱发误删; immutable-exempt: 更正与本机实测相反的机器事实断言,属 §0 七类机器事实每次现读要求的纠错 (d59742000f)
- 🐞 Fix:摘掉安装期的 wxt prepare —— 干净检出上它必解析不到 @ihui/i18n 的 dist,setup 一挂就带走 CI/OpenAPI/e2e/real-db/Knip 五条 workflow;prepare 改挂 typecheck 脚本,ci-monorepo 里并把该步移到建包之后;顺手补 build 作业 mirror-fidelity 的自述登记 (59c1bc650f)
- 🚀 Feature/Improvement:号池面板补齐健康四态 / 按供应商分布 / 24h 临期 —— 三格数据一直回但界面无人读 (7215469a79)
- 🔧 Chore/Other:RP-47 结清摘行 —— 两门 --staged 现读 rc=0(221:2118 枚逐一编译通过;254:零缺口),票面所称「恒取不到索引 blob」症状已不在;票面要求的可观测腿已装车(lib/face-reader 的 probeFaceSpec/describeProbe,两门未判定分支各接一次,镜像 39/39 含接线形状锁),落地 53d8ef47e9 (db197d2f1e)
- 🐞 Fix:RP-47 可观测腿 —— 两把门的「取不到」未判定必须点名命令/rc/stderr (53d8ef47e9)
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

### Account keepalive centre (added 2026-10-26 — two unrelated liveness loops merged into one answer)

Publish-line cookie probing (`services/publish/cookie_refresh_daemon.py`) and AI-platform check-in credentials (`services/checkin_scheduler.py`) used to keep separate switches, separate counters and separate ways of saying "it failed", so the system had **no single answer** to "are these accounts still alive?". The centre (`apps/ai-service/app/services/keepalive/`, HTTP layer in `apps/ai-service/app/routers/keepalive.py`) folds cookie probing, credential (api_key / oauth) expiry detection and check-in JWT health (reads `exp` only, never re-signs) into one schedule, two tables, one health vocabulary and one alert outlet.

| Endpoint | Method | What it answers |
| -------- | ------ | --------------- |
| `/api/keepalive/status` | GET | Self-check: whether it is really on (reason, scheduler liveness, last round, probe list) — never infer it from config |
| `/api/keepalive/overview` | GET | Health roll-up: four buckets, per-source split, needs-attention, expiring soon, 7-day success rate, effective config |
| `/api/keepalive/accounts` | GET | Per-account detail, filterable by `?source=` and `?health=` |
| `/api/keepalive/events` | GET | Probe log, filterable by `?ref=` and `?only_failures=true`; `limit` defaults to 50, caps at 500 |
| `/api/keepalive/stats` | GET | Per-source ok / failed / total / rate over `?days=` (1..90, default 7) |
| `/api/keepalive/run` | POST | Trigger one round in the background and return immediately; `?ref=<source>:<id>` for a single account, `?force=true` to ignore back-off |

- **Health buckets** are computed in exactly one place (`policy.health_of`): `critical` when the last failure was `expired`, the expiry has passed, or consecutive failures reach `ALERT_AFTER_FAILURES`; `warning` while there are consecutive failures, inside the expiry-warning window, or only failures have ever been seen; `healthy` otherwise; `unknown` when neither success nor failure has been recorded. Clients must not recompute them.
- **Failure vocabulary**: `ok` / `expired` / `network` / `error` / `unsupported` / `skipped`, normalised by one entry point (`classify_message`). A ciphertext that will not decrypt (`InvalidTag`, key mismatch) is always `expired` — retrying it a thousand times cannot help, only re-recording the credential can. `unsupported` (nothing to keep alive) counts as neither success nor failure and never lands in `failed`, so it cannot drown real red. Back-off is `base × 2^(n-1)` capped at `RETRY_CAP_SECONDS`, retried at most `RETRY_MAX` times; success clears the counter, the warning stamp and the alert stamp together.
- **Alert outlet**: the site-wide `notifications` table, **one aggregated notification per owner per round** (19 accounts expiring at once must not send 19 messages — users then mute it and never see the real one); non-uuid owners such as `probe-user` are dropped and counted, because one bad owner aborts the whole batch insert; a missing table is reported as a warning rather than pretended delivered. `KEEPALIVE_ALERT_WEBHOOK` adds an extra leg. The whole path is fail-open — a failed notification never interrupts keepalive.
- **Switches**: `KEEPALIVE_ENABLED`, inherited from `COOKIE_REFRESH_ENABLED` / `CHECKIN_CRON_ENABLED` when unset; `resolve_config()` re-reads every round, so an `.env` change takes effect on the next round without a restart. Related defaults: `INTERVAL_HOURS`=6, `RETRY_MAX`=3, `RETRY_BASE_SECONDS`=300, `RETRY_CAP_SECONDS`=21600, `ALERT_AFTER_FAILURES`=3, `ALERT_REPEAT_HOURS`=24, `EXPIRE_WARN_DAYS`=3, `ALERT_INAPP`=true, `PROBE_CONCURRENCY`=4, `EVENT_RETENTION_DAYS`=90.
- **Bounds**: it judges credential liveness only — publishing still belongs to the publish scheduler and daily check-in to `checkin_scheduler`, otherwise one account gets hit by two writers at once. Front end: `apps/web/src/components/publish/KeepaliveCenterPanel.tsx` on `/publish/accounts`; client wrappers in `packages/api-client/src/endpoints/keepalive.ts`.

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
