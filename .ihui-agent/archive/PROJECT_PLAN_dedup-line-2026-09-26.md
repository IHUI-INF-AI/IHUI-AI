<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# PROJECT_PLAN.md 行级去重:被删的逐字重复行(2026-09-26)

每一行都**在新成品里另有一份逐字相同的存活行**(见下方每段标注的存活行号),本归档是第二保险。

- 原第 251 行 → 存活于新成品:

- [x] ✅ **A 组 = 纯冗余,已删(`C:\c` 整目录 515MB)**。`C:\c` 是 2026-08-06 某会话把 `/c/tmp/...`

- 原第 262 行 → 存活于新成品:

- [x] ✅ **B 组 = 归档不删,移到 `D:\DevEnv\backups\archives\c-root-2026-09-24\`**(§15b 唯一备份目录)。

- 原第 273 行 → 存活于新成品:

- [x] ✅(2026-09-25) 另有 7 个脚本的 `--self-test` 仍走 `os.tmpdir()`(`check-workspace-dep-links` / 〔2026-09-25 孪生旧副本翻勾:同题已勾于 L271〕

- 原第 286 行 → 存活于新成品:

- [x] ✅(2026-09-24)**C 组刻意没动,待用户定性**:`C:\ai_zhs\cert\*.pem`(5 个,每个仅 10–20 字节,不可能是真 PEM,

- 原第 439 行 → 存活于新成品:

- [x] ✅(2026-09-25) 计划任务 `IHUI-C-Drive-AutoMaintain` 仍未注册(注册 = 影响全机的删除动作,须用户授权); 〔2026-09-25 孪生旧副本翻勾:同题已勾于 L9134〕

- 原第 2390 行 → 存活于新成品:

- [x] ✅(2026-09-25) **本轮未落地、需重做的一批(web 86 处内的键名对齐)**:该批次报告改了 4 个文件(`DeveloperKeyDialog` / `AiGenerationContent` / `PermissionSelector` / `helpers`),**逐条按内容复核后全部不在 HEAD**(`git grep <新键名> HEAD -- apps/web` 四处均 0 命中),工作区也已被并发会话覆盖 → 判为**丢失需重做**,不要当成已完成。中途我一度按"工作区里有"记成"已落地",那是读到了被覆盖前的窗口 —— 并行期复核一律以 **HEAD 对象树内容**为准(档案第 4 节已记此教训)。 〔2026-09-25 翻勾:经 HEAD 对象树逐键复核已由 02e3474c932 / a00983523bc 落地,无需重做〕

- 原第 2392 行 → 存活于新成品:

- [x] ✅(2026-09-25) **本轮未落地、需重做的一批(web 86 处内的键名对齐)**:该批次报告改了 4 个文件(`DeveloperKeyDialog` / `AiGenerationContent` / `PermissionSelector` / `helpers`),**逐条按内容复核后全部不在 HEAD**(`git grep <新键名> HEAD -- apps/web` 四处均 0 命中),工作区也已被并发会话覆盖 → 判为**丢失需重做**,不要当成已完成。中途我一度按"工作区里有"记成"已落地",那是读到了被覆盖前的窗口 —— 并行期复核一律以 **HEAD 对象树内容**为准(档案第 4 节已记此教训)。 〔2026-09-25 翻勾:经 HEAD 对象树逐键复核已由 02e3474c932 / a00983523bc 落地,无需重做〕

- 原第 2507 行 → 存活于新成品:

- [x] ✅(2026-09-23) **O21 资金链与文件版本面的属主谓词补齐(2026-09-23 逐行实测,安全 P0)**:① **【本票已修】**`createPayment` / `applyRefund` 事务内订单查询原只有 `where(eq(eduOrders.id, data.orderId))`,**无属主谓词**,且 `payAmount` / `refundAmount` 直接取客户端携带值(`priceSchema` 只验格式 `/^\d+(\.\d{1,2})?$/` 不验上限)⇒ 任意登录用户可对**他人已支付订单**挂 pending 退款申请(管理员在 `routes/order.ts:1056/1092` 审批后即成资金流出),或对他人 pending 订单写 `eduPayments`,金额由请求方指定。修法 = 属主条件下推进同一条 WHERE(零额外往返;跨属主统一 `order_not_found`→404,不留"存在但不可访问"的枚举 oracle)+ 新增导出纯函数 `capToOrderAmount`(允许下调以保部分支付/部分退款,越界回落订单金额,0/负数/不可解析亦回落不写脏值)。三处调用方(`routes/order.ts:433`、`:468`、`routes/user/payment-routes.ts:202`)实测全部传 `request.userId!`,**无 admin 代客路径** ⇒ 谓词不会挡掉任何正当流程。回归 `apps/api/tests/idor-order-owner-and-amount-cap.test.ts` 7 例(结构断言 + 上限四态),既有 `order`/`payment`/`payment-routes`/`payment-gateway`/`refund-dlq` 共 87 例不红,`order-queries.real.test.ts`(被 vitest `exclude` 挡在 CI 外,需真库)fixture 全部用同一 user 建单 ⇒ 谓词后仍成立。② **【待做,勿挂 idorGuard】**`routes/file-version.ts:165/179/197/214/260/293` 与 `routes/workspace.ts:502/520` 共 8 个端点仅 `checkAuth`/`requireAuth`,**无属主与成员校验**,`serializeVersion`(`file-version.ts:44-55`)还外泄服务端磁盘 `path`,而 `:254` 可直接 `update files set path=newPath where id=target.fileId` 改他人文件指向 + `:281-288` unlink 磁盘文件。**不得**用 `idorGuard('file')`:它以 `files.uploadedBy` 单列判定(该列 `onDelete:'set null'` **可空**,注销即恒 403),比现网 `canAccessFile`(上传者 ∪ 项目 owner ∪ `project_members`,`db/file-queries.ts:28-40`)**更弱**,硬接会把正常共享成员打成 403。正解 = 8 处统一 `canAccessFile`(`file-version.ts` 先由 `fileVersions.fileId` 反查 `files` 行)+ 出口剥 `path`。③ `utils/idor-guard.ts` 定档:**非死代码,但不得全量接线** —— 其 7 类里 5 类(order/payment/refund/invoice-*/project)现网已被 handler 内联属主判定覆盖(`order.ts:378/402/519/542/645/671/762/779`、`workspace.ts:252/275/294/323/342`、`oss.ts:234`),再挂 preHandler 只多出一次存在性查询=双重往返,`file` 类则因模型更宽不可替代 ⇒ 实现与两份测试保留,仅作 ① 类缺谓词端点的 preHandler 备选。**关键旁证(别再拿"有数据闸"当免检理由)**:`utils/scoped-guard.ts:199-201` 明示 `isDataScopeEnforced` 只在 `principal.kind==='apiKey'` 时生效,人用 JWT 不在其内;且上述路由一律 import 非受控出口 `db`(不经 `db/index.ts:193` 的 `dbScoped()`)⇒ scope/RLS 层对这些端点不提供任何防护。

- 原第 2508 行 → 存活于新成品:

  - 守门号自纠:本门最初登记为 77,收敛后发现 HEAD 的 runner 里 `id: '77'` 已被 `check-radius-single-source.mjs`(origin 线)占用 —— 同号两道 blocking 门会串 skipEnv 与失败归属,故**本门改号为 79**(runner / AGENTS 速查 / README 三处同步,均从 HEAD 版本生成 blob 后提交,未走已落后 384 行的工作区那份)。既存重复号 75 与 76 各两处由归属会话处理,本票未代裁。

- 原第 2509 行 → 存活于新成品:

  - 完成口径(2026-09-23,三子项逐条对账):① 资金链 `createPayment`/`applyRefund` 属主谓词 + `capToOrderAmount` 已在 HEAD(`db/order-queries.ts:213` 定义、`:260`/`:358` 调用),回归 `tests/idor-order-owner-and-amount-cap.test.ts` 在位。② 文件版本面 6 端点 + `workspace.ts` 2 端点全补 `checkFileAccess`/`canAccessFile`,两侧出口 `serializeVersion`/`serializeFileVersion` 剥 `path` 外泄;新测试 `tests/o21-file-version-owner.test.ts` 35 例(8 端点各钉 403 + 读不到行 + 路径不外泄 + 写副作用 0,含正向不误伤 2 例与 5 条结构钉)。③ `utils/idor-guard.ts` 按定档一行未改未接线,并加反向结构钉防后来者挂上。

- 原第 2510 行 → 存活于新成品:

  - O21b(自证时新发现,不在 O21 ② 清单内):`POST /file-versions/create` 只有 `checkAuth` + `findFileById`(仅判存在)⇒ 任意登录用户可向他人 fileId 写版本行并落盘。已补闸门(`2653ca09a70`),`FileAccess` 的 ok 分支带回 files 行以消掉二次查询的 TOCTOU 窗口;结构钉 6→7 并新增"闸门须排在 `data.toBuffer()` 之前"的顺序断言。**残余未做**:create 的越权行为用例需 multipart 注入夹具,现 harness 未覆盖,本票只交结构钉 + 与另 6 端点共用的同一谓词实现。

- 原第 2511 行 → 存活于新成品:

  - 同票附带修一处我自己带上 main 的破坏:`scripts/git-rebuild-local.mjs` 的 `externalGitDir(root: string): string` 把 TS 注解写进 `.mjs` → `node --check` SyntaxError(§5b 重建脚本一跑就炸;四版对照 base=OK/origin=OK/本地快照=FAIL/收敛首版=FAIL),已去注解并复验通过。

- 原第 2556 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「D15」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 D15 GitHub App(webhook 自动 PR review+@机器人触发)(G-20)

- 原第 2616 行 → 存活于新成品:

- [x] ✅(2026-09-24)**D34 事件契约扩字段(G-40/G-43/G-44/G-52)**:`sse_contract.py:18-45` 与 `packages/shared/src/sse/contract.ts:28-53` **同步**新增四事件 `injection_applied`{kind∈goal/model_switch/permissions/agents_md/host_skills/environments/developer_instructions/turn_aborted,collapsed 摘要,可展开全文}/`settings_applied`{model,reasoningEffort,personality,prev}/`retry_scheduled`{attempt,maxRetries,retryInMs,httpStatus}/`terminal_output`{stdout,stderr,**formattedOutput**,exitCode,truncated};Codex 实证字段名为准(报告 §1.1 计数 273/15/72/810)。`packages/api-client/src/client.ts` 分发**必须**拦在"未知 type 兜底当正文"之前(沿用 W4 教训 + 负例断言)。**验收**:两份契约集合相等断言(守门既有)+ api-client 四事件新用例 + "绝不落正文"守护 + 跨端消费登记(与 D49 联动)

- 原第 2796 行 → 存活于新成品:

- [x] ✅(2026-09-24) **D48 本地会话数据主权与加密(G-56)**:桌面端本地缓存加密(对标 Trae SQLCipher;我方优势:导入侧已有 redact_secrets 实测 0.07% 命中)。**验收**:静态盘 grep 明文会话为 0 + 解锁失败降级可读空态不崩 + 密钥不落仓(§5d)

- 原第 2797 行 → 存活于新成品:

  - **落地实证(2026-09-24,提交 `72a2eae9aca`)**:选型定为 **WebCrypto AES-256-GCM 在 web 层封装 + 主密钥经既有 `tauri-plugin-store` 通道落 `app_data_dir/ihui-vault.json`**(HKDF 分域子密钥)—— 零新增 cargo crate / npm 依赖 / Rust 改动。否决方案 1 的证据:新 crate **离线不可解析**(本地 index 596 条内 stronghold/sqlcipher 命中 0,而 `cargo tree --offline` 现有 24 个直接依赖全可解析 ⇒ 不是网不通),且薄壳架构(`devUrl=8801`、明文由 web 层写出)下 Rust 侧加密存储**动不了 localStorage**,只多存一把密钥;另实测 `grep -rn "auth\.json|refresh_token" apps/desktop/src-tauri/src` 命中 **0**(Rust 只读 C 层 `window-state.json`)⇒ 加密不切断 Rust 链路。

- 原第 2798 行 → 存活于新成品:

  - **验收三条各测到什么**:① 静态盘明文 0 —— 拿**真实 zustand persist 序列化产物**取证(非手造格式):正文样本 grep plain 1 → enc 0、`conversationId|recentMessages|draftInput` 类字段名 plain 7 → enc 0、CJK 字符数 plain 86 → enc 0(744B → 1104B);**测不到**:真机 WebView2 leveldb 分块/snappy 未实测(本机无运行中桌面包)。② 解锁失败降级可读空态不崩 —— `unreadable → return null` 且原密文进旁路键,token 侧 AEAD 失败退回 cookie 链路;变异 M1(改成抛错)→ 2 例红。③ 密钥不落仓 —— 新模块不 import env、不写 `.env`,日志与报告全程脱敏。测试 3 files / **30 passed**,受影响面既有测试 31 files / 330 passed,变异反证 4/4 被咬住并 sha256 逐字节还原。

- 原第 2799 行 → 存活于新成品:

  - **残余(不写作收口)**:① 其它 persist 键(`ihui-goal` 含目标文本、`ihui-notification`、`ihui-ai-tools-panel` 等)**仍为明文** —— 不在 D48 声明的 A/B 两层内,要扩需先定档范围;② 桌面 dev(`localhost:8801`)下 plugin-store 是否被 `capabilities/default.json` 放行**未实测**,被拒则自动退回明文写入 = 等价改造前(设计内降级,非崩溃);③ 威胁模型边界:主密钥按 Windows 用户 ACL 隔离,保证"拷走 localStorage 读不出",**不挡**已具该用户权限的进程(无新依赖就拿不到 DPAPI/safeStorage 级绑定);④ `getItem` 变异步后 `components/ai/ai-side-panel.tsx` 的 mount-effect 预填充可能晚于 hydration(真实数据仍以服务端 `getMessages` 为准),要修必须在禁止区挂 `onFinishHydration` 或 store 内重新同步赋值 —— 后者正是 2026-07-27 记录在案的 hydration-mismatch 事故成因,**刻意没做**。

- 原第 2832 行 → 存活于新成品:

- [x] ✅(2026-09-24 复核) **D55 机器代批决策条(G-66,P0 首批,低成本反超项)**:我方后端 1-1 已产出 `decision`/`reason` 八类推导(`agent_loop_v2._derive_step_decision` + `_decision_hints`),**对话流里却没有这条徽章**。补「自动审查中 / 已自动批准 / 已拒绝 / 请求用户确认 + 理由：」四态卡,~~数据零新增、只补渲染位~~(第 61 轮实测**作废**:缺 5 层,见下方进度行)。**验收**:四态各一用例 + 与 D34 `injection_applied` 帧不重复计数 + 现有 timeline 测试不回退

- 原第 2833 行 → 存活于新成品:

  - **进度(第 61 轮 · D55① 词表 + web 本地化渲染位,并更正本条前提)**:**"数据零新增"不成立** —— 逐层实测后缺 5 层:① 对话流(`/llm/complete/stream`)根本不发 decision(`plan.step`/`permission.mode` 只经 hook 总线转 workbench 三条流,`routers/llm.py` 无订阅也无发射);② 契约声明不含字段(`sse_contract.py` 的 `plan-step` payload 只写 `("payload",)`,`permission-mode` 不在 SSE_EVENTS);③ 回调持久化与 `ChatMessageMetadata` 均无 decision/reason(现只有 citations/injections/compaction/retryNotice 四类);④ hint-only 取值在 live 帧丢失(`_maybe_record_step` 先 `pop`,`emit_plan_step` 又重新推导,免审批类决策只剩在录制文件里);⑤ **15 个字面量在全仓任何语言包都没有文案**,两处渲染位把 `security_blocked`/`auto_skip_approval` 这类英文码直接喷给用户。本票做 ⑤ + 渲染位:新增共享词汇表 `packages/shared/src/chat/step-decision.ts`(15 值 → 取词键 + approved/rejected/needsUser/unknown 四归并态;认不出原样显示、缺词退回原始码、**绝不编造也绝不喷键名**;不设"自动审查中"第五态 —— 那是 `status=started` 的进度不是决策),`packages/i18n/messages/shared/{5 语言}.json` 各 +19 叶子(行级插入:逐文件 `25 0` 纯新增、旧叶子逐条比对不变、prettier 全绿),web 两处渲染位(timeline 证据块 / workbench plan-step 行)改为取词 + `data-decision-state` 着色。**判据是双向锁**:`packages/shared/tests/chat/step-decision.test.ts` 直接从 `agent_loop_v2.py` 抽字面量(只在 `_derive_step_decision` 函数体内扫 `return` + hints/权限事件两处全文件扫),断言"词表少一条"与"后端多一条"都失败。web 用例把 `next-intl` mock 换成**真实词包**,断言界面出现「已执行」且**不出现** `execute_tool`;**变异取证**:渲染位改回 `{evidence!.decision}` 该例立即红(还原后 4/4 绿)。守门 57 新增 `step-decision-localized-badge`(5 条锚点)。验证:shared typecheck 0 错 + 7 例、web typecheck 0 错、web timeline 4 例、i18n parity 5 语言 × 1692 路径 OK。**残余(不称收口)**:①-④ 是 D55② 的主体,须按 G-166 已验证的四层套路做(生产端单一真相源 → `/api/ai/callback` zod 合并 → `ChatMessageMetadata` 契约键 → 端内读回 + 守门扩锚点);在那之前 decision 在**对话流与回放**里仍然看不见,只有 workbench / agent-timeline 两面可见,extension/rn/taro/cli 四端因无数据同理无法消费(不是文案问题)。

- 原第 2834 行 → 存活于新成品:

  - **D55② 四端运行时权限决策取词(第 61 轮续)**:承 ① 把"直显英文码"这件事一次清干净 —— 实测 `/agent-runtime` 通道的 `permission.decision` 有**两个生产者且词表不同源**(`agent_runtime.py::_check_permission` 出 allow/ask/deny;`agent_loop_v2` 的 permission.mode 出那 15 值),此前 mobile-rn `AgentRuntimePanel.tsx:73` 与 miniapp-taro `:77` 把它**原始码直喷**,web `agent-runtime-panel.tsx` 只把本地化模板套在原始码外面("权限决策:auto_skip_approval"),只有 extension 已有映射(allow/ask/deny 走自己命名空间,行为正确,不动它以免制造死键)。落法:`packages/shared/src/chat/step-decision.ts` 加**唯一入口** `permissionDecisionWord()`(先认 15 值,再认 allow/ask/deny,两条都不中原样返回 —— 审批语境猜错语义=误导用户授权),shared 词包补 `stepDecision.perm.{allow,ask,deny}` ×5 语言(逐文件 5/0 纯新增),三端渲染位改为调用它 + miniapp 离线包 `gen:i18n` 重生成。取证:shared 用例 8 例(五语言 × 18 取值全命中 + 未知值/缺词两条反例,断言既不回显原始码也不喷键名);新增 `apps/miniapp-taro/src/i18n/__tests__/step-decision-pack.test.ts` 按**端运行时同一套 merge 语义**(mergeMessages(shared, 端))断言合并视图可达 —— 端包本身不含这些键,只测端包会测到一个根本不参与运行的组合;守门 57 `step-decision-localized-badge` 锚点 5→9 条(含三端调用点)。验证:shared typecheck 0 错、web/taro 各自 typecheck 我方文件 0 错(rn 总错误 11 条全部来自并发会话 in-flight 的 `AiAssistantN8nScreen.tsx`,与本体无关)、shared 8 例 + taro 5 例全绿、prettier/词包 parity(5 语言 × 1695 路径)OK。**残余(不称收口)**:对话流(`/llm/complete/stream`)仍无决策可显示 —— 该路径的执行器不做审批,`llm.py` 对 `agent_loop_v2`/hook 总线**零引用**,所以"对话流四态卡"的前置是权限档在对话流执行器落地(G-164/D111 那条线),不是补徽章;端侧 onPermission 事件驱动的渲染用例也未建(需先造 stream 回调夹具),现取证止于"调用点存在 + 词表解析可达"。

- 原第 2835 行 → 存活于新成品:

  - **D55② 端侧取证闭环 + G-164③ 实测收口(第 61 轮续)**:① 承上票补上我上轮明确写下的缺口 —— web `agent-runtime-panel.test.tsx` 的 `next-intl` mock 改成**真实 shared 词包**解析 `stepDecision.*`(否则"界面不再出现英文码"只是测试自造字面值),新增 3 例:`onPermission({decision:'auto_skip_approval'})` → 显示「自动批准(免审批)」且断言不含原始码;`deny` → 「已拒绝」;认不出的 `maybe_allow` → **原样显示且绝不显示成"已放行"**(审批语境猜错=误导授权)。**变异取证**:把渲染位退回 `decision: permission.decision` 后两条取词例立刻红(13 passed / 2 failed),还原后 15/15 绿。② `G-164 剩余③ 三端无任何档位可见性` 经实测**已不成立** —— 并行的 D111 票已把档位行落到三端真实落点:`apps/miniapp-taro/src/pkg-ai/ai/chat.tsx`、`apps/mobile-rn/src/screens/AiAssistantN8nScreen.tsx`、`apps/extension/entrypoints/sidepanel/components/MessageContent.tsx`(+ 同端 `AgentRuntimePanel.tsx`),均经共享 `permissionTierWordKeys` 取词。**剩余精度差**(如实登记,不称全完):mobile-rn 只有 N8n 屏挂了,`ChatScreen` 尚未挂 —— 该文件正被并发会话 in-flight 改写(语法破损中),此刻插入必撞车,解阻判据 = 待其提交后按 N8n 屏同一形态补 `ChatScreen` 档位行并扩守门 57 锚点。③ `G-164 剩余① 全线切 camel 落库`**不动**:它是"带回填的生产值迁移"(改 `workspace_permissions` 存量数据),按 AGENTS §8/§12 属高危且归属用户,不擅自执行、也不假装已排期。

- 原第 2836 行 → 存活于新成品:

  - **D79 第①步 cli 接线 + 四端现状更正(第 61 轮续)**:先量后做(子代理取证 + 我逐条 `git show HEAD:` 复核,拒绝自述)。① **cli 已接线**:新建 `apps/cli/src/commands/waiting-text.ts` 的 `buildWaitingSpinnerText()`(象限 agent / 阶段按 history 分首轮·追问 / seed=prompt / locale=`getLocale()`),`repl.ts:42` import + `:2169` 渲染位改调它(替掉硬编码"正在思考...");`apps/cli/tests/waiting-text.test.ts` 4 例,变异取证把取词退回固定串 → 2 例立即红(红在"不再是固定串"与"首轮≠追问"),还原 4/4;cli typecheck 0 错、prettier 干净、水印 10023/10023。② **web 属"造好没装车"且结构性阻塞**:`message-item-parts.tsx` 的 `waitSeed/waitQuadrant/waitPhase` 三个入参**只存在于并发会话未提交的工作区**(HEAD 计数 0),`MessageItem.tsx:693` 生产恒走固定串 `waitingResponse` ⇒ 解阻判据 = 等该端入参契约落库后补 3 个 prop + "传参即出池文案"断言(共享实现无需改)。③ **extension / desktop 无该表面**(grep `思考中|waitingResponse|isThinking|typing-indicator` 双端空),按 §9 记平台侧豁免;mobile-rn 的 `TaskStatusBar.tsx:122` 是任务状态条兜底不是打字指示器,真打字位在被 in-flight 占用的 `ChatScreen.tsx`。⑤ 两条**共享层真缺陷**:`resolveWaitingText` 只做取模,**没有"相邻不重复"保证**(seed 跳变即文案跳变,连续两帧撞同一条会显得卡住);池内 76 个 `waiting.*` 键**任一端都未落词包**,现走池内联文案 ⇒ 五语言本地化闭环(含 taro 离线包重生成)仍是独立一步。⑥ 顺带把 D55② 的端侧取证补全:`apps/mobile-rn/tests/agent-runtime-permission-decision.test.tsx`(真组件 + 真 `I18nProvider`,messages 走 `mergeMessages(shared, 端)`,4 例)+ `apps/miniapp-taro/src/components/__tests__/agent-runtime-permission-decision.test.ts`(8 例);rn 侧变异矩阵 M1 直显枚举/M2 把未知值猜成"已放行"/M3 喷键名 **三种形态全部判红**,taro **渲染级测不到**属实测非推测(该端 vitest `environment:'node'` 无 jsdom,`@tarojs/runtime` 在 node 下 `ReferenceError: ENABLE_INNER_HTML`,已连同错误原文写进文件头并退到"真实合并视图取词 + 端内调用点源码结构"两层)。

- 原第 2837 行 → 存活于新成品:

  - **D79 第②步 web 接线已落地(第 62 轮)**:上一步记的"结构性阻塞"随并发会话落库自动解除 —— 实测 `git show HEAD:...message-item-parts.tsx | grep -c waitQuadrant` = 4(入参契约已入库),于是把 `MessageItem.tsx` 的渲染位补上三个实参:`quadrant=agent`(对话流的等待对象就是智能体)、`phase` 按"本条之前是否已有 user 消息"分 `first|followup`、`seed = 最近一条 user 内容长度 + 4s 时间桶`(同一次等待内稳定 ⇒ 不跳字、不与读屏 announcer 抢播报,跨期才轮换)。取证 `apps/web/src/components/chat/message-list/__tests__/typing-indicator-waiting-pool.test.tsx` **4 例全绿**,判据形状刻意用可辨识合成池文案(不靠真词包,那层由 `waiting-pool.test.ts` 与端内合并视图用例各自钉):① 不传象限/阶段 → 回退固定串;② 传 agent × 三阶段 → 进池且不再是固定串;③ 同 seed 稳定 / 异 seed 会变;④ **象限与阶段只给一个就不进池**(契约要求两个都给,防"半接"静默失效)。写这层用例时踩到一条自己造的假绿:渲染位会把 `waiting.` 前缀剥掉再交给 `useTranslations('waiting')`,我第一版按 key 前缀判定 ⇒ mock 永不命中 ⇒ 组件静默落到池的**英文兜底表**(`Got it, thinking through a response…`)却仍然"看起来在跑",改成按 **ns** 判定后才拿到真信号 —— 记进项目记忆。**残余(不称收口)**:① 这 4 例证的是**组件 honors 入参**,渲染位"确实传了 3 个参数"目前只有 typecheck + 代码位置证据,store 驱动的端到端用例待补(判据:让 `useChatStore.messages` 处于 `showTyping` 态,断言 `[data-testid=typing-indicator]` 文本不等于固定串);② 轮换取舍是"一次等待内稳定",若产品要"同一等待内也轮换",需把 seed 换成时间桶并放慢节奏(会引入视觉抖动与读屏重复播报,须先定档);③ **miniapp-taro 仍走固定串** `pages/index/index.tsx:1440`,但其 locale 出口实测**已存在**(`src/i18n/index.tsx` 的 `useI18n()` 返回 `{locale, t, setLocale}`,上一步"无 locale 出口"的结论是我按 `index.ts` 猜路径导致的误判)⇒ 下一步按 cli 同形态建 helper + 用例并 `gen:i18n`。

- 原第 2838 行 → 存活于新成品:

  - **D79 第③步 taro 接线 + web 端到端取证 + 全量台账审计(第 62 轮,并行批次)**:两路代理交付已由我逐文件复核归属后入库(`git diff` 证实 taro 那 7+/2- 全属接线,未夹带他人 `permission-stamp.ts`,也未碰他人在改的 `MessageItem.tsx`)。① **miniapp-taro 接上轮换池**:取证推翻我上一轮"缺原料"的顾虑 —— `AiHomeState` 里 seed 与 phase **都可得**,但 **`inputText` 不能当 seed**(`handleSend:1017` 先入列再置 streaming 并清空输入,取它必为空)⇒ 改走 `conversationMessages` 末条 user 内容;新增 `src/pkg-ai/ai/waiting-text.ts`(薄接线层)+ 11 例,渲染位 `:1441` 换掉固定串;变异(退回 `tt(index.thinking)`)红在"等待占位块改调 buildTaroWaitingText"。**该端 vitest 是 `environment:node` 无 jsdom ⇒ 组件渲染级测不到**,故额外补了"端内调用点源码结构"一层才咬住接线 —— 单靠行为断言在这一端是测不出来的,这条限制连错误原文写进文件头。② **web 渲染位 store 驱动端到端 5 例**(真 zustand store 灌消息 + 假时钟 + 用 `resolveWaitingText` 反查期望下标,不手抄;按 **ns** 判取词),变异 A 剥三个 prop → 4 例红,变异 B 只剥 `waitSeed` → 报 `first.0 vs first.4` 证明 seed 真在传;内含一条自检断言防"期望下标恰为 0 时 `waitSeed ?? 0` 让 seed 判据恒真"。③ **72 条未勾 D 任务全量审计(只读)**:已落地 9 条(D34/D39/D44/D55/D83/D88/D98/D101/D106/D107/D111)、部分 13 条、其余未开始,逐条带 文件:行号;**其中已落地但守门 57 缺锚点**的 D44/D88/D101/D106/D107/D111 由我补锚点;另发现一条易踩的台账陷阱:**计划里存在两套 D 编号族**(第 722-732 行 i18n 补盲族的 D29-D33/D80 与第 1349 行起对话流族同号**不同任务**),改计划时不得并成一条。④ 顺带证伪一条旧假设:`waiting.*` 键在 `packages/i18n/messages/shared/*.json` **五语言齐**(不是"76 键无处可取"),真正过期的是 **miniapp-taro 离线包**(`remote-locales.gen.ts` 解码后 `has waiting: false`)⇒ 四语言等待池当前落英文回退,解阻动作只有一次 `gen:i18n`(由并行那路独占执行)。

- 原第 2839 行 → 存活于新成品:

  - **D79 第④步 词包落地 + 门 57 补 5 条锚点(第 62 轮并行批次)**:等待池 76 个 `waiting.*` 键落 `extension/mobile-rn/miniapp-taro/cli` 四端词包(20 文件全为纯新增,逐文件 flatten 深比较"既有叶子 changed=0 + 新增集合恰等 76"),值**逐字取 shared**(池只内联英文兜底,四语真相在 shared ⇒ 端包复制 shared 而不是复制池,否则等于引入第三套说法);web **不需要**改包(web 运行时 `mergeMessages(shared, web)`,实测 `waiting.*` 在 web 已可达)—— 这条是并行代理先按"每端都要有"去写、我实测后砍掉的半步。防回潮用例 `packages/i18n/tests/waiting-keys-in-end-packages.test.ts` 12 例直接用池函数取真值无镜像文案,注入红验证两型(改一个端值 → drifted 红;五端同删一键 → missing 红)。门 57 按只读审计补 5 条锚点(D44 白名单清零 / D88 diff 暂存 / D101 端中立 ICU / D106 双解析器对齐 / D111 三端档位可见性),implemented 27→32、清单 126 条,每个 mustMatch 先实测命中才入台账,且**不锚任何未跟踪文件**(他人 in-flight 内容当锚点 = 门依赖不在提交树里的东西)。**两处我自己造的故障与修法(都记下来)**:① 第一版锚点脚本用外部 `grep.exe` 校验令牌,路径不存在 ⇒ 抛错后我误以为已写入;改成 JS 读文件校验。② 第二版手工在 `implemented` 收尾前插文本,回溯找 `]` 时把 `  ],` 跳过、命中了更靠内的 anchors 收尾 ⇒ JSON 结构被写坏、门 57 直接 `ERR_INVALID_ARG_TYPE` 崩;正解是 `git checkout HEAD -- <该文件>`(那文件只有我未提交的改动)后改用"parse→push→stringify→prettier"的规范路径,代价是 prettier 把他人既有的一些单行 anchors 展开成规范形态(126+/16-,纯格式等价,门与 prettier 双绿)。残余:并行那路对"相邻不重复"约束的共享层改动仍在途未入库。

- 原第 2840 行 → 存活于新成品:

  - **D79 第⑤步 共享池"相邻不重复"约束(第 62 轮,并行第 3 路 + 我复核)**:约束落在 `resolveWaitingText` 的新可选入参 **`avoidSeed`**(不是 `avoidIndex` —— 下标是 `normalizeSeed % 池长` 的内部派生量,调用方手里只有上一帧 seed,要它自己重算取模规则等于造一个没人能正确使用的死 API)。实现 `pickIndexAvoiding` 在撞上上一条时 `(index+1)%poolLength`、池长 ≤1 原样返回,**纯函数无模块状态**(该池 5 端共用,任何模块级状态都会串台)。既有 24 例逐条零改动通过(不传即与今天等价),新增 14 条正反成对:零影响等价 / 反例基线 / 顺移与池尾环绕 / 撞车才换条(未撞不多跳) / **全象限×全阶段×(seed,avoidSeed) 不变式 3375 组** / 40 帧链 / 同余链"旧行为全冻结 vs 传入后不冻结" / vivid / 中文走词表·无 t 回英 / 异常 seed 矩阵 / 词表塌成单条 / 非法象限 / off 三口径 / echoT 不泄 key。**判据有效性用注入证明**:把约束写成 `index === previousIndex ? index : index` ⇒ 7 例红而既有 24 例与"零影响/反例基线"仍绿(证明拦的是约束本身,不是碰巧红一片)。**残余(如实,不称接完)**:`grep avoidSeed apps/` = 0 命中 —— 端调用点尚未消费该入参,即"门有闸、水没引";接法已定:① web 由 `message-item-parts.tsx` 的 TypingIndicator 持一个"上一帧 seed"ref 并回传 `avoidSeed`(该文件常被并发会话占用,须先确认它相对 HEAD 干净);② cli 传上一轮 prompt。本轮因 `message-item-parts.tsx` 与 rn 两屏仍属他人 in-flight,未越权接线。

- 原第 2841 行 → 存活于新成品:

  - **权限档存值迁移状态定档(第 62 轮,承 commit `6e495bb3`)**:**第①步写侧已翻正** —— `apps/api/src/routes/workspace-permissions.ts` 入参 `z.enum` 同时接受 kebab∪camel(两份清单派生自 `packages/types` 真源,零抄写),落库经 `normalizePermissionMode` 写 camel,新增 `toWirePermission()` 把此前直吐库行原值的 GET/PUT 三处显式归一 ⇒ 对外契约不变;`manual` 继续 400;混合态安全网 `apps/api/tests/workspace-permissions-mode-storage.test.ts` 23 例(遗留 kebab 行与新 camel 行出参同为 kebab、脏值不降级 default),双向变异各咬 5 红。**第②步工具已就位并主动按住** —— `scripts/perm-wire-backfill.mjs` + 17 例:默认只生成 SQL、UPDATE 前同事务导出 `(id,before,after)` CSV、`--rollback` 按 id+当前值双限定、SQL 无 DDL/INSERT/DELETE 且不触 `__drizzle_migrations`/journal,三闸各自拒(缺 `--confirm` 精确串 / dsn 命中 `aizhs|8810`(须 `--target=prod --window`)/ 缺 `--since` 观察窗口起点),不连库时估算段自己写明"行数=需连库,禁止估算",判据有效性由内置变异断言(摘掉 confirm 校验必红)。**四段顺序不可颠倒,当前状态:① 已完、②"旧拼写新增写入=0"未量到 ⇒ ③ 回填不执行;生产库本轮零连接。** 待 owner 定档:`packages/types` 是否导出 `permissionModeId()` 与 `PERMISSION_MODE_PERSISTABLE_IDS`(现由调用方 `Object.values(PERMISSION_MODE_WIRE)` 拼 400 文案,Partial 使值含 undefined);ACP 侧 `workspace.ts:684,695` 仍只收 kebab;真库混合行的 HTTP 实盘取证须在回填前后各跑一次。

- 原第 3132 行 → 存活于新成品:

- [x] ✅(2026-09-24) **守门 83 两处口径修 + RN 暗色两处存量收口 + 主题通道接线根因**(承接上一条,同一议题第二波;`606ff17a0f` 门 / `cb99ef0c09` 同步 / `8a84099476` 组件):

- 原第 3133 行 → 存活于新成品:

  - **接线根因(不修它,全端 `dark:` 配对都是纸面正确)**:共享 preset 是 `darkMode: 'class'`(`packages/design-tokens/src/tailwind-preset.js:24`),NativeWind 的 `dark:*` 读它自己的 colorScheme store,而**全仓从未有人调用过** `setColorScheme`/`colorScheme.set`(grep HEAD 命中 0)⇒ 这些类恒跟系统外观,而本 App 主题走另一条通道(`active-tokens.ts` 模块级单例 + 重载 JS)。后果:用户在设置里选深色而系统是浅色时,全端 38 处 `bg-white` / 数百处 `dark:` 一条都不生效。修在 `apps/mobile-rn/src/theme/color-scheme-sync.ts` + `ThemeProvider`(以解析后的三档偏好为依赖),并补 vitest 替身(`tests/__mocks__/nativewind.ts` + alias,理由同 expo-file-system 那条:真实入口在 node 下解析失败会整个测试文件加载不进来)。6 例回归 = 3 行为 + 3 装车证明(含"App.tsx 必须真把界面包进 ThemeProvider",否则前两条是死代码);mobile-rn 全量 **47 文件 / 253 例全绿**。

- 原第 3141 行 → 存活于新成品:

- **收口(2026-09-23)**:按"轮"记版（内存+localStorage，不新建表）+历史只读切换+跨版本 diff+空态落地，4 用例绿；界面英文过渡（11 处中文清零，词表释放后换中文键）。

- 原第 3160 行 → 存活于新成品:

- **收口(2026-09-23)**:五族全落地（审阅态 localStorage 跨刷新+计数聚合/树筛选+失败两级/只跳转不另建 PR 面/git-apply 六形态真仓验证），43 例新测试全绿；词表 26 键待入库（messages 被占用），G-135 在 D27/TaskDetailDialog 的接线点已指明。

- 原第 3212 行 → 存活于新成品:

- [x] ✅(2026-09-24) **D106 消息级"交代帧"跨端消费缺口(G-148;实测量化,不是推测)**:多落点 grep(`--include=*.ts --include=*.tsx`,排除 node_modules)得 **extension / miniapp-taro / mobile-rn / cli 四端对 `citations` 与 `onSteer` 均 0 命中,只有 web 消费**;对照 `compaction` 四端各有落点(extension 1 / miniapp-taro 3 / mobile-rn 2 / cli 15)→ 证明**不是"这些端不接 SSE 交代帧",而是逐帧漏接**,同一类缺口第 N 次出现(D34 的 `injection_applied` 我一开始也只接了 web,即本条的又一实例)。**根因层 = C 客户端通道(api-client 已给 `onInjectionApplied` / `onRetryScheduled` / `onCitations` 回调,端内没人注册)+ P 呈现(各端无对应组件)**。**做法纪律**:① 表现层组件沉 `@ihui/ui-react`(取词函数由 props 注入,不得在组件内 `useTranslations`,否则又变成 web 独占);② 每端注册回调时必须**逐字段显式承接**(各端 store 都是枚举式合并,未知字段会被静默丢掉 —— 与 D40 截断字段完全同因);③ 交代类文案一律走各端命名空间词表,**禁止把后端 `collapsed` 中文当界面文本**(第 42 轮已为此把 kind 定为取词键);④ 端内不得再抄一份渲染模型(mobile-rn 的 `utils/chat-render-model.ts` 属既有违例,收编另立任务)。**验收(可机检)**:守门 57 的 `context-injection-disclosure` 元素锚点从"仅 web"扩到 **web + extension + miniapp-taro + mobile-rn**;每端至少 1 条"帧字段进了 store、界面出本地化文案、未知 kind 回退 collapsed"的用例;`citations` 与 `steer` 在四端的命中数由 0 变非 0(脚本可复算,分母用四端目录)。 **对账改判(2026-09-24,HEAD 取证)**:四端 citations|onSteer 命中 extension 11 / miniapp 26 / mobile-rn 31 / cli 8,且各端有显式 D106 落点注释(推翻本条"四端 0 命中")。

- 原第 3213 行 → 存活于新成品:

  - **进度(第 43 轮)**:呈现层已沉共享组件 `@ihui/ui-react` 的 `ContextInjectionList`(取词函数 props 注入,组件内零 `useTranslations`),web 侧改为薄壳复用(既有 6 用例**一字未改全绿**,证提取保行为);**extension 已接通**(ChatPage 注册 `onInjectionApplied` + 枚举式合并里显式承接 + MessageContent 渲染,新增 4 例静态渲染用例,断言"出本地化文案、不出后端中文、多条默认只露第一条"),`injectionTitle/injectionKind*` 等 7 键 × 5 语言已入 extension 命名空间,守门 57 该元素锚点已到 6 处(后端/api-client/web/extension×2)。**剩余**:miniapp-taro、mobile-rn 两端的承接与词表;`citations` / `steer` 在四端仍为 0 命中。

- 原第 3214 行 → 存活于新成品:

  - **进度(第 44 轮 · C 层"双解析器漏接"根治 + 守门 63)**:量化出漏接的**结构成因**是同一协议被两处独立解析 —— `packages/api-client/src/client.ts`(web/extension/mobile-rn)与 `packages/shared/src/utils/sse-parse.ts`(miniapp-taro 经 `@ihui/shared` 单一真源使用;其端内 `src/utils/sse-parse.ts` 实测只是 7 行 re-export,故不存在第三解析器)。本轮把 sse-parse 漏接的四帧补齐(`steer`/`budget`/`injection_applied`/`retry_scheduled`,判据与 api-client 的 `tryParse*` 逐条对齐:无 `collapsed` 不产事件、`level` 非契约档位不产事件、`retryInMs` 缺省 0),覆盖数 **18 → 21**。**顺带修掉一条同族的第四层漏接**:`packages/api-client/src/index.ts` 的 re-export 清单里没有 `SteerEvent`/`InjectionAppliedEvent`/`RetryScheduledEvent`(只有 `BudgetEvent`/`CitationsEvent`),端内要写这三条回调就**点不到参数类型**,只能重抄一份或落 `any`(违 §3 类型零技术债)—— 已补 re-export 并重 build dist。**新增守门 63 `check-sse-parser-parity.mjs`(blocking,guardian-runner 已登记 + `stagedTriggers` 锁三个源文件与台账)**:① 抽不到事件名按失败处理;② sse-parse 覆盖数 ratchet(`parseCoverageBaseline=21`);③ 未接帧必须在 `scripts/data/sse-parser-coverage.json` 的 `webOnly` 写明"为什么只有该端消费"(空理由拦、登记却已接也拦)。**判据强度不是自述而是实测**:先把 `steer` 守卫改成不匹配的字面量 → 本闸同时红两条(20<21 覆盖倒退 + `steer` 未登记),还原后 `grep -c` 归 0 且门禁绿;因此"只在类型联合里补一行 `'steer'`"和"守卫被删只剩 `return { type:'steer' }`"两种假覆盖形态都骗不过它(后者是我写第一版时自己发现的假绿口子,已收紧为"必须有守卫,`compaction`/`usage` 这类按 payload 形状识别的帧走显式白名单例外")。`--self-test` 10 例正反成对(含 4 条"必须不算覆盖"的反例)。**本闸刻意不覆盖的第三层**:parser 有帧 ≠ 端内显示 —— 各端 dispatch/回调表**不注册该 type 仍然什么都看不到**(miniapp-taro `src/api/index.ts`、mobile-rn `streamChat` 回调即此),这正是下方 D107 的主体。**残余敞口(未闭环,不称收口)**:`question` 已登记 webOnly(理由:作答需"挂起输入 + 问题卡 + sendAnswer 续流"整条闭环,当前只有 web 有 `apps/web/src/hooks/use-chat/send-message.ts:701` 的 `onQuestion`,miniapp-taro 无问题卡组件也无作答通道,只解析会让用户"看到提问却无法回答",比不显示更糟),`thinking` 已登记但**附带发现一条新缺陷**(见 D107b)。验证:shared tsc 0 错、shared 全量 22 文件 559 例、miniapp-taro SSE 相关 7 文件 113 例、新案 `packages/shared/src/utils/__tests__/sse-parse-disclosure.test.ts` 5 例(含"steer 不喷进正文增量"这条**显示错内容级**断言)、守门 57/59/60/63/parity/watermark 全绿。

- 原第 3215 行 → 存活于新成品:

  - **进度(第 45 轮 · D107a miniapp-taro 注册层)**:小程序端把交代帧从"parser 有"推到"界面上有"。四层同时落地:① `src/api/index.ts` 的 `StreamEventCallbacks` 补 `onInjectionApplied`/`onRetryScheduled`/`onCitations` 并在 `dispatch` switch 里注册三个 case(**parser 有帧但表里没 case = 依然静默丢**,这正是守门 63 覆盖不到的第 3 层);② `chat.tsx` 把注入帧累积进 `aiCards.injections`(按 kind+collapsed 去重;字段类型必填但**旧历史里运行时可能 undefined**,故保留 `?? []` 兜底并在注释说明),`retry_scheduled` 进流上活动条(`ai.stream.gatewayRetry`);③ 新增 `InjectionCard`:界面文本出自 `ai.cards.injection.kind.*`,**后端中文 `collapsed` 只在未知 kind 时兜底**,`fullText` 缺省即不给"展开"入口;④ `ChatMessageItem` 渲染门与总数计入 `injections`。零新增 CSS(复用既有 `ai-card-*` 类,避免把跨端样式 parity 面扩大)。**词表**:5 语言 × 11 键行级插入(纯新增 `12 0`,含点键与 `ai.cards.terminal.exitCode` 同风格),`pnpm gen:i18n` 重生成离线包(657.7KB→b64 394.8KB);对称性校验:5 份 `ai.cards` 叶子集合一致(20 个)。守门 57 该元素锚点 6 → 9,标题标注"三端已接"。**残余(不称收口)**:mobile-rn / cli 两端仍未接;miniapp 侧只有**静态锚点**没有渲染期用例(该端无组件测试设施,现有 `__tests__` 均为逻辑用例),即"锚点在"不等于"界面出",补运行期断言需先给该端搭 render 测试;`citations` 在 miniapp 只注册了回调、无呈现组件;`steer` 对无引导输入 UI 的端仍无意义。验证:miniapp-taro `tsc --noEmit` 0 错(过程中被 tsc 抓到一处:`Text` 不接受 `hoverClass`,已去掉)、shared 559 例、守门 57/63 与 `check-i18n-keys`(1451 文件 / 15747 键 / 5 语言 parity)全绿。

- 原第 3216 行 → 存活于新成品:

  - **进度(第 46 轮 · D107a mobile-rn 注册层)**:RN 端同样从"parser 有"推到"界面上有"。① `src/utils/chat-render-model.ts` 新增纯函数 `applyInjectionFrame`(**追加** + 按 kind+collapsed 去重;整体替换会让流首与流中两批互相覆盖)与 `MessageInjection` 类型;② `AiAssistantN8nScreen.tsx` 注册 `onInjectionApplied`(写进最后一条 assistant 消息的 `injections`)与 `onRetryScheduled`(toast `aiAssistantN8n.gatewayRetry`),新增 `InjectionDisclosure` 渲染块 —— 措辞出自本端词表(`injectionKind*` 四键),**后端中文 `collapsed` 仅在未知 kind 时兜底**,`fullText` 缺省即不渲染展开入口,计数按 `cardMeta` 数字块显示;③ 词表 6 键 × 5 语言行级插入(每文件纯新增 `6 0`),对称性校验 `aiAssistantN8n` 叶子集合五语言一致(31 键)且逐语言取到值。守门 57 该元素锚点 9 → 11,标题标注"四端已接"。**残余(不称收口)**:cli 端仍未接(该端是终端态一行呈现,注入交代要与 `task-status-line.ts` 同批设计);mobile-rn 的 `citations` / `steer` 仍 0 命中(前者无引用卡组件,后者无引导输入 UI);`InjectionDisclosure` 只有**纯函数层**用例(4 例),渲染分支未断言 —— 该端无组件渲染测试设施,与本端既有做法一致。验证:mobile-rn `tsc --noEmit` 0 错、`tests/injection-disclosure.test.ts` + `terminal-truncation.test.ts` 7 例、prettier 绿、守门 57/63 绿。

- 原第 3217 行 → 存活于新成品:

  - **提交归位说明(第 46 轮收尾,防记录失真)**:本票拆成 3 个提交 — `40a8ba96d2` 代码+用例、`cb53163ca8` 词表 6 键 × 5 语言、`80273aa9f6` 守门 57 锚点。**本节这条第 46 轮进度文字实际落在并发会话的 `f2068e6fb9`** 里(该会话把工作区整体纳入了它的提交),内容未丢但不在 `80273aa9f6`,故在此显式归位。另记一条流程事实:代码票首次提交被 pre-commit 拦而纯词表票零跳过通过,**未逐条定位是哪一闸**(候选:端内 i18n 键闸在代码票里见到尚未入库的 `aiAssistantN8n.injection*` 取词引用);今后同端"代码 + 词表"**同票提交或词表先提交**,不用 `--no-verify` 掩盖这类跨票顺序问题。

- 原第 3233 行 → 存活于新成品:

  - **D107 ① 装车票(2026-09-24,commit `ce261e1a89a`)**:上轮留下的 ①「接入提交链」在 `guardian-runner.mjs` 释放后落地 —— `check-sse-dispatch-parity.mjs` 注册为守门 **90**(blocking,`skipEnv=HUSKY_SKIP_SSE_DISPATCH_PARITY`,`stagedTriggers` 含 `client.ts` + 台账 + 五端源码目录),`guardian-runner --help` 清单实跑已含 90。它 2026-09-23 就写好了却从未上过车道,是守门 89 R3 名单里的存量项(**造好没装车**同型)。**装车当刻即抓出两处漂移**:① 台账滞后 —— HEAD 实测 extension/miniapp-taro/mobile-rn/cli 四端均已注册 `onSteer`(D106 今日落地),台账仍挂着早先 `no-steer-ui` 的 WONTFIX 判定 ⇒ 判据③(唯一真源)红四条、baseline 各落后一格,已删四条登记并摘掉**已无端引用**的 `no-steer-ui` 分组(留着就是替已实现的功能喊 WONTFIX),baseline 上调到实测值(web 27 / ext 16 / miniapp 21 / rn 17 / cli 11);② **取材基准不一致的结构缺陷** —— 命中侧走 `git grep HEAD` 而帧清单读**工作树**的 `client.ts`,并发会话刚加进、尚未提交的一枚新帧会让**五端同时**判"静默丢弃",红点与提交者的改动毫无关系却只逼人 `--no-verify`(连带废掉全部守门,与守门 57/77 今日同一取向)。现帧清单同改 `git show HEAD:...`,读不到即 `exit 2` **绝不回退工作树**;git 调用改绝对路径 + `safe.directory` + `windowsHide` + `timeout`。镜像测试 `scripts/tests/check-sse-dispatch-parity.test.mjs` **9 例**:真仓绿(含"零 baseline 待上调警告")、两条注入违规(抽走命中→红因点名"静默丢弃"、baseline 抬高→ratchet 咬住)、取材基准回归钉(断言源码里不得再出现 `readFileSync(API_CLIENT_FILE`)、台账分组卫生、**装车证明**(runner 注册块含 blocking/skipEnv)、**编号唯一**(并发抢号教训)。`--self-test` 8/8 + 门 90 `exit 0`,pre-commit 全链**零跳过**通过。②「阶段标签」一层已由 D107b 结案判为非缺陷(活通道走 hook 总线 `content` 键),故 D107 两项残余均已闭合。

- 原第 3234 行 → 存活于新成品:

  - **守门 90 装车票之二 · cli 端补接 `budget`(2026-09-24,commit `46fd852b316`)**:门 90 的 `--report` 就是补接工单,本票做掉第一行 —— cli 端对 `budget` 帧 0 命中,而**换 key 退避与上下文注入上一批已能看见,唯独"今天快用完了"看不见**,CLI 用户恰恰最容易撞日限额。措辞走 `cli.budget*` 6 键 × 5 语言(`check-cli-i18n-parity` 5 locales / 338 keys 齐),`agent.ts` 两处调用点按存在性透传、签名取 `NonNullable<StreamChatOptions['onBudget']>` 不重抄;台账 `cli` baseline 11→12 并摘掉 `cli.onBudget`(组 `no-budget-ui` 仍被另三端引用故保留)。**与 web `send-message.ts:939` toast 的三点刻意差异是修正,不是漂移,且反证 web 侧有两处待修**:① web 把 85300 印成「8.5 万」—— 「万」这个单位在 en/ja/ko 都不成立,本端改千分位原值;② web **无条件**播报"明日 0 点重置",而 `resetAt` 是可选字段,缺省时等于替后端编造承诺;③ web 该 handler 的 5 条界面文案全是**硬编码中文**(违反 D106 纪律③"交代类文案一律走词表"),本端全部走词表。用例 6 例(`apps/cli/tests/budget-note.test.ts`,含"缺 resetAt 不得出现重置文案""不得出现 undefined""全字段皆缺不留悬空冒号"),cli 全包 **117 文件 / 2488 例**通过 + `typecheck` 0 错。

- 原第 3235 行 → 存活于新成品:

  - **同票修掉守门 90 自身的两处结构缺陷(装车后第一次跑真数据才暴露)**:① `--staged` 改判**暂存区**(`git grep --cached` + `git show :path`),手动/CI 仍判 HEAD —— 否则"代码与台账同票"这一 ratchet 的前提交法必被自己卡死(台账已写 12 而 HEAD 仍是 11 ⇒ 报"baseline 倒退",正常推进只能靠 `--no-verify`);② 一处会让整门失真的写法错误:`git grep -o -E <pat> --cached` 把 `--cached` 当**修订名**解析 → `unable to resolve revision` 退出 → 五端命中全 0 → 满屏"静默丢弃/低于 baseline"红,而真相是 grep 根本没跑;选项移到模式串之前,并按 exit 1(无匹配)与 ≥128(自身失败)分流,后者 `exit 2` 不许把"没跑成"当成"没命中"。两条各一枚镜像测试钉住(⑤ 源码形状钉 + ⑤b 用**临时索引**真跑暂存区口径且绝不碰共享主索引),`node --test scripts/tests/check-sse-dispatch-parity.test.mjs` **10/10**。

- 原第 3236 行 → 存活于新成品:

  - **本票三条 pre-commit 红的归属核查(未拿"其他 agent 的锅"当结论,逐条复跑取证)**:`30c check-stale-copy` 报的两个"陈旧副本"是 `sse-dispatch-coverage.json` 与 `check-sse-dispatch-parity.test.mjs` —— **复跑即消失**,机理是 `BASE = merge-base(HEAD, origin/main)` 而提交那一刻推送仍在飞行(worker 异步 push),我上一票的内容还没进 origin/main ⇒ 被当成"基线祖先历史版本";`84 check-stale-revert` 与 `30c` 剩下的红点名 `PROJECT_PLAN.md`(工作区 blob == `8caa3aef9`,即**旧基线整文件写**)+ 一处 `sqli-guard.test.ts` 暂存删除,均非本票文件,提交后 `git show --stat` 复核本票只含 12 个声明文件。**顺带查出一件未闭环的事**:`gate 89` 在 HEAD 上因 **R5 重复 id 91** 恒红(`check-c-drive-pollution.mjs` warn 与 `check-error-code-coverage.mjs` blocking 同日各登记 91)—— 恒红 blocking = 全队合法 `--no-verify` 关掉其余全部守门,严重度高于其本门所查;工作区里并发会话已把它改到 92 但未提交,故**本票不越权动 `guardian-runner.mjs`**(该文件此刻正是 ` M` 在飞状态),仅在此登记归属:改号由 `eabde2a79f2` 的 owner 提交即解,解阻判据 = `node scripts/check-gate-wiring.mjs` exit 0。

- 原第 3237 行 → 存活于新成品:

  - **守门 90 补接工单第二行 · budget 帧装配沉共享层 + mobile-rn(2026-09-24,commit `bac20ad4a53`)**:① 新增 `packages/shared/src/chat/budget-note.ts` 的 `formatBudgetNote(event, t, keys)` —— 三条硬规则(载荷没给的不说 / 只有 level 时退化为裸标题不留"标题:"悬空尾巴 / 未知档位按 warning 出行不静默)从端内实现**升为共享层唯一真相**,cli 的 `budgetNoteText` 改为委托它,共享层自身 6 例正反用例钉住;② mobile-rn 新增 `src/utils/budget-note.ts`(键挂 `common.*`,两屏共用免跨命名空间互引)+ `AiAssistantN8nScreen` 注册 `onBudget` + 6 键 ×5 语言 + `tests/budget-note.test.ts` 4 例(**真读语言包**跑五语言,断言不回显键名 / 不留 `{占位符}` / 缺 `resetAt` 不出重置文案);③ 台账 mobile-rn baseline 17→18 并摘登记。**过程里自己抓到的一个复写**:`formatTokenCount` 第一版在共享层新造了个千分位同名实现,而 `@ihui/shared/utils` 早有 K/M 版(ASCII、五语言通用)—— 已删自造版改为复用既有,顺带把"web 用「8.5 万」"明确写成不复制的写法。**两处刻意没做并在台账里显式登记(不静默、也不谎报已接)**:miniapp-taro 缺的只是 `src/api/index.ts` 的 dispatch case,而该文件载着并行会话未提交的 D49①(`rateChatMessage`/`sendToolApprovalResponse`/`id?: string`),补 case 会代收他人未提交工作(§12 红线)⇒ 已把本票在 miniapp 的改动**逐 hunk 回退**(api/index.ts、chat.tsx、5 份语言包、离线包 gen 后与 HEAD 零漂移),并在 `missing.miniapp-taro.onBudget` 写明解阻判据;RN 主屏 `ChatScreen.tsx` 同样载着他人未提交的评价/权限档改动,故只接 N8n 助手屏 —— **守门 90 的"名字出现即算已处理"口径看不出主聊天屏仍缺,这条盲区记录在此而非靠台账掩盖**。落地后镜像测试 ②(真仓 HEAD 口径)由红转绿,与 ⑤b(临时索引暂存区口径)同证"代码与台账同票"语义;⑧(编号唯一、从文件反查不硬写编号)仍红,红因是并行会话 `9023ecd304e`(07:48:45)把 `check-cross-end-tokens.mjs` 也登记成 90,而本门 `ce261e1a89a`(07:23:24)是先到者 —— 一行改号可修,但 `guardian-runner.mjs` 此刻被第三路在飞改动(16 行 skipEnv 补齐)占住,提交它会代收他人工作,故不动;解阻判据 = 该文件工作树 == HEAD 后把 `9023ecd304e` 那道门改到空闲的 93(与守门 89 R5 同一条红,同源同判据)。

- 原第 3238 行 → 存活于新成品:

  - **D107 守门脚本探测缺陷修复(2026-09-24)**:`check-sse-dispatch-parity.mjs:55` 原为 `join(ROOT, ...API_CLIENT_PATH)` —— `API_CLIENT_PATH` 是**字符串**(L54 已 `.join('/')` 拼好),spread 把字符串炸成单字符,`existsSync` 探的是不存在的路径 ⇒ 判据失效时的报错「工作树侧也不存在该文件」**失真**(文件实际 137KB 在位)。已改 `join(ROOT, API_CLIENT_PATH)`:实测失效分支报错恢复准确(「工作树侧存在该文件」),`--self-test` 8/8 不回退,`node --check` 通过。主流程(`git show HEAD:` 取帧清单)不受该缺陷影响 —— 只影响失效分支的提示文案;装车配置(门 90)无需改动。

- 原第 3240 行 → 存活于新成品:

- [x] ✅(2026-09-24) **D107 交代帧的"端内注册层"与"阶段标签"缺口(第 44 轮实测新立)**:守门 63 只对齐到 parser 层,**帧到了各端 dispatch 表仍会二次静默丢弃**,本条覆盖剩下两层。

- 原第 3241 行 → 存活于新成品:

  - **D107 端内注册层守门落地(2026-09-23,第 71 轮)**:新增 `scripts/check-sse-dispatch-parity.mjs` + `scripts/data/sse-dispatch-coverage.json` —— 补上守门 63 自陈覆盖不到的**注册层**。关键设计:帧清单**不写死在数据文件里**,每次运行从 `packages/api-client/src/client.ts` 的 `StreamChatOptions` 的 onXxx 成员自动提取(减去 `toolCallbacks`,现为 `onAbort`) ⇒ 数据文件不可能与代码脱节,且**新增帧会自动进入判据并要求各端显式处理**。四类判定:① 判据自洽(抽不到帧清单 / 缺端 / toolCallbacks 名字在 client.ts 不存在 → **按失败**,不许"解析不出来就当全绿")② ratchet(每端命中数 ≥ baseline,只挡倒退不挡增长)③ **唯一真源**(`missing[端]` 键集合必须**精确等于**实测未命中集合:实测未命中却没登记 = 静默丢弃判红;登记了却其实已接 = 墓志铭判红)④ 理由完备(每条 missing 必须解析到非空理由,可指向 `groups` 里的复用分组)。**实测矩阵(27 帧)**:web 27/27、miniapp-taro 20、mobile-rn 16、extension 15、cli 10;缺口即"补接工单",其中 `no-steer-ui` / `no-subagent-ui` / `no-question-ui` 等分组理由已写明依据(与守门 63 的 webOnly 同源)。**验证(实跑)**:`--self-test` **8/8 通过**(含"抽不到帧清单必须判红");**真实反演** —— 把 web baseline 由 27 改 28 → **exit 1** 且报「端 web 命中的帧数 27 低于 baseline 28」,还原后 **exit 0**。**剩余**:① 接入提交链待 `scripts/guardian-runner.mjs` 与 `.husky/pre-commit` 释放(二者当前被并行会话占用,本轮**零触碰**)② "阶段标签"那一层上轮已判为非缺陷(langgraph 引擎退役,活通道走 hook 总线 `content` 键)。

- 原第 3242 行 → 存活于新成品:

  - **D107a 各端注册层(与 D106 同源,主体不变)**:miniapp-taro `src/api/index.ts` 的事件分派 + `pkg-ai/ai/chat.tsx` 承接、mobile-rn `streamChat` 回调 + 渲染,补 `injection_applied`/`retry_scheduled`/`citations`/`steer`;验收沿用 D106 第④条(四端 0 命中变非 0)。**进度(第 47 轮 · cli 端)**:cli 补齐两帧 —— `injection_applied` 与 `retry_scheduled`。终端不画卡片,而是**流水式一行**:`TaskStatusLine.noteLine(text)`(新增方法,尊重 `isOn()` 故管道输出仍干净、按列宽截断、压平换行),措辞由 `injectionNoteText` / `retryNoteText` 生成 —— kind 走 `cli.injectionSrc*` 取词,**后端中文 `collapsed` 仅在未知 kind 或未给段数时兜底**;`retryInMs=0` 说"立即继续",不写"0 秒后继续"这种假精确。透传层与 `onPlanUpdate` 同形(`NonNullable<StreamChatOptions['...']>` 直接取类型,禁止端内重抄签名),两处 streamChat 调用点各按存在性展开(未传零开销)。词表 7 键 × 5 语言与代码**同票提交**(守第 46 轮的跨票教训),`cli` 直接子键集合五语言一致(18 个)。`apps/cli/tests/injection-note.test.ts` 7 例(含"未知 kind 不回显键名""非 TTY 不写任何字符");**过程中被自己的测试抓到一处真 bug**:第一版把 `INJECTION_SOURCE_KEYS[kind]` 的**键名**当文案传给了外层 `t()`,终端会打印 `本轮参考上下文：cli.injectionSrcDeveloper` —— 用例先红,修后 7/7 绿。验证:cli `tsc --noEmit` 0 错、cli 全量 **112 文件 2464 例**通过(改 agent.ts/repl.ts 未伤既有)、prettier 绿、守门 57 该元素锚点 11 → 13(五端)。

- 原第 3243 行 → 存活于新成品:

  - **D107b `thinking` 阶段帧"生产了没人看"(实测,两端都无消费)**:`apps/ai-service/app/services/langgraph_service.py`(754/861/974/1002 行)与 `agent_loop.py:563` 发出 `{"type":"thinking","message":"正在思考…|正在规划执行步骤…|正在总结执行结果…"}`,而两侧解析器都只认 **`content`** 字段(api-client `tryParseThinking` 第 2488 行 `if (typeof json.content !== 'string') return`)—— 这类**只带 `message` 的阶段帧被两港同时丢掉**,用户在长任务期看到的是"没有反馈",而竞品在此刻给的是显式阶段标签(规划/总结)。做法二选一并写进契约:① 后端把阶段文案改为规范字段(如 `injection_applied` 式的 `phase` 枚举 + 端内取词,**禁止把中文 `message` 当界面文本**,同第 42 轮纪律);② 若判定该帧属遗留通道,则从契约与发射点一并收回(不许留"发得出、没人接"的帧,同第 36 轮空契约帧判据)。验收:改后 web + miniapp-taro 各 1 条用例断言"阶段标签在界面上出现且为本地化文案",或 grep 证 `thinking` 的 `message`-only 发射点归零并同步处理契约项。

- 原第 3244 行 → 存活于新成品:

    - **D107b 结案(第 57 轮,证据替换推测,勿再按原口径实施)**:原登记说"5 处 message-only thinking 帧被两港丢弃 → 长任务期用户看不到阶段标签"。逐点实测后**该因果链不成立**:① `services/langgraph_service.py` 4 处**不在运行时路径上** —— `langgraph_service` 无任何运行时 import(只剩模块内 self-singleton),`a2a_service.py:394` 与 `agents.py:866` 均已改走 `agent_executor.run`,`agents.py:1022-1025` 记着双兜底死分支已删;② `services/agent_loop.py:563` 在 `AgentExecutor.run_stream` 内,而 **`run_stream` 无生产调用方**(全仓只有它自己的用例 + 一句过时注释在提它;路由用的是 `.run(...)`)。活着的 thinking 通道是**另一条**:`thinking.delta` 走 hook 总线、payload 键就是契约声明的 `content`(`agents.py:634` 读 `payload['content']`,`sse_contract.py` 声明 `SSEEventContract("thinking", ("content",))`,api-client `tryParseThinking` 同键)—— 即"发得出、没人接"的静默丢弃**并没有发生在网上**,D107b 不是对话流缺陷,不再改字段也不撤活路径的帧。**留下的不是待办而是一道锁**:`apps/ai-service/tests/test_thinking_frame_ledger.py` 用白名单把"message-only 发射点"钉死 —— ① 新增同类发射点即失败(判据含"为什么不上网"的强制说明),② 白名单条目变空账也失败(退役代码删干净后要同步摘条目,防"登记却已不存在"),③ 锚定契约键 `content` 不让上面两条悬空。**判据有效性实测**:临时放一个含该形态的 `app/_ledger_probe_tmp.py`,门立刻红(`assert not {'_ledger_probe_tmp.py': [1]}`),删掉探针后 3 例复绿;探针由本会话创建并已清理。mypy strict 0 错。

- 原第 3245 行 → 存活于新成品:

      - **守门 71 `check-plan-line-loss.mjs`(第 57 轮立,blocking,`stagedTriggers=PROJECT_PLAN.md`)**:本会话一小时内**两次**被并发会话的"按内存里旧计划文档整文件提交"抹掉已入库登记行(第一次我自己也是肇事者,见 `safe-commit-index-race` 第 22 条),13c 归档守卫只认 `### XXX(已完成 ✅)` 任务标题行、条目内 bullet 登记行完全不在其视野,故补这道闸。判据按**编号标记的原文前缀**在待提交内容里全文搜(整行消失才报,只改写文案保留编号不报 → 不误伤正常编辑),`.ihui-agent/archive/PROJECT_PLAN_*.md` 里能找到原文则按 §1 归档放行。`--self-test` 9 例正反成对(含 missingFrom 双目标比对);写闸过程中真修掉一个自造假阳:标记若按"编号 + 后续文本"重拼,`D107b` 会被拆成源文本里不存在的 `D107 b`,导致正常提交被误判丢失。紧急跳过 `HUSKY_SKIP_PLAN_LINE_LOSS=1`,失败提示直接给出"从 `git log --all -S <标记>` 找回原文插回"的三步正解。

- 原第 3246 行 → 存活于新成品:

      - **D112 守门 71 双目标自愈 + "旁路提交不跑钩子"的收口(第 60 轮)**:上一轮立的自愈面有两处失效被本轮实测抓到。① **判据留了个洞**:自愈只比"工作区 vs 历史",而 `commit-tree` 旁路(`git-sync-converge` 的索引层合并、临时索引提交)**不跑任何钩子**,它把已入库登记行从 HEAD 合掉时,共享工作区往往还留着那一行 → 单目标判"无缺失"提前返回,HEAD 从此永久缺行(本轮我自己的 G-154 第 60 轮行就是被并发收敛合并合掉的,靠 `git show HEAD:` 计数才发现)。现拆出 `historyMarkers()` + `missingFrom()`,**工作区与 HEAD 分别判缺失**,只有 HEAD 缺时也建前向恢复提交(基线仍取 HEAD,绝不代收他人未提交内容);`git-sync-converge` 在落合并提交后就地补跑一次 `--heal --commit`,把"旁路生产者"自己接上自愈。② **造好没装车**:`rev-parse` / `hash-object` 返回值没 `.trim()`,尾部换行让 `read-tree` 报 `Not a valid object name` —— **自愈提交自 2026-09-22 上线起一次都没成功过**,而 post-commit 写作 `... || true`,失败毫无声响(与本轮第 69/70 号"造好没装车"同一族)。③ 取证方式记档:函数层注入用例(`missingFrom` 正反)只能证明拆分正确,**判据端到端必须在独立仓库里真造一次旁路合行**才暴露 —— 临时 repo 里 `commit-tree` 掉一行、工作区留着,旧版脚本输出"无缺失,无需回捞"、新版识别"HEAD 缺 1 条"并建恢复提交,复跑幂等(0 缺)且不产生空提交;这一 A/B 是发现 ② 的唯一途径。`--self-test` 9 例(补 missingFrom 双目标一例)。

- 原第 3247 行 → 存活于新成品:

  - **D107 ① 装车票(2026-09-24,commit `ce261e1a89a`)**:上轮留下的 ①「接入提交链」在 `guardian-runner.mjs` 释放后落地 —— `check-sse-dispatch-parity.mjs` 注册为守门 **90**(blocking,`skipEnv=HUSKY_SKIP_SSE_DISPATCH_PARITY`,`stagedTriggers` 含 `client.ts` + 台账 + 五端源码目录),`guardian-runner --help` 清单实跑已含 90。它 2026-09-23 就写好了却从未上过车道,是守门 89 R3 名单里的存量项(**造好没装车**同型)。**装车当刻即抓出两处漂移**:① 台账滞后 —— HEAD 实测 extension/miniapp-taro/mobile-rn/cli 四端均已注册 `onSteer`(D106 今日落地),台账仍挂着早先 `no-steer-ui` 的 WONTFIX 判定 ⇒ 判据③(唯一真源)红四条、baseline 各落后一格,已删四条登记并摘掉**已无端引用**的 `no-steer-ui` 分组(留着就是替已实现的功能喊 WONTFIX),baseline 上调到实测值(web 27 / ext 16 / miniapp 21 / rn 17 / cli 11);② **取材基准不一致的结构缺陷** —— 命中侧走 `git grep HEAD` 而帧清单读**工作树**的 `client.ts`,并发会话刚加进、尚未提交的一枚新帧会让**五端同时**判"静默丢弃",红点与提交者的改动毫无关系却只逼人 `--no-verify`(连带废掉全部守门,与守门 57/77 今日同一取向)。现帧清单同改 `git show HEAD:...`,读不到即 `exit 2` **绝不回退工作树**;git 调用改绝对路径 + `safe.directory` + `windowsHide` + `timeout`。镜像测试 `scripts/tests/check-sse-dispatch-parity.test.mjs` **9 例**:真仓绿(含"零 baseline 待上调警告")、两条注入违规(抽走命中→红因点名"静默丢弃"、baseline 抬高→ratchet 咬住)、取材基准回归钉(断言源码里不得再出现 `readFileSync(API_CLIENT_FILE`)、台账分组卫生、**装车证明**(runner 注册块含 blocking/skipEnv)、**编号唯一**(并发抢号教训)。`--self-test` 8/8 + 门 90 `exit 0`,pre-commit 全链**零跳过**通过。②「阶段标签」一层已由 D107b 结案判为非缺陷(活通道走 hook 总线 `content` 键),故 D107 两项残余均已闭合。

- 原第 3248 行 → 存活于新成品:

  - **守门 90 装车票之二 · cli 端补接 `budget`(2026-09-24,commit `46fd852b316`)**:门 90 的 `--report` 就是补接工单,本票做掉第一行 —— cli 端对 `budget` 帧 0 命中,而**换 key 退避与上下文注入上一批已能看见,唯独"今天快用完了"看不见**,CLI 用户恰恰最容易撞日限额。措辞走 `cli.budget*` 6 键 × 5 语言(`check-cli-i18n-parity` 5 locales / 338 keys 齐),`agent.ts` 两处调用点按存在性透传、签名取 `NonNullable<StreamChatOptions['onBudget']>` 不重抄;台账 `cli` baseline 11→12 并摘掉 `cli.onBudget`(组 `no-budget-ui` 仍被另三端引用故保留)。**与 web `send-message.ts:939` toast 的三点刻意差异是修正,不是漂移,且反证 web 侧有两处待修**:① web 把 85300 印成「8.5 万」—— 「万」这个单位在 en/ja/ko 都不成立,本端改千分位原值;② web **无条件**播报"明日 0 点重置",而 `resetAt` 是可选字段,缺省时等于替后端编造承诺;③ web 该 handler 的 5 条界面文案全是**硬编码中文**(违反 D106 纪律③"交代类文案一律走词表"),本端全部走词表。用例 6 例(`apps/cli/tests/budget-note.test.ts`,含"缺 resetAt 不得出现重置文案""不得出现 undefined""全字段皆缺不留悬空冒号"),cli 全包 **117 文件 / 2488 例**通过 + `typecheck` 0 错。

- 原第 3249 行 → 存活于新成品:

  - **同票修掉守门 90 自身的两处结构缺陷(装车后第一次跑真数据才暴露)**:① `--staged` 改判**暂存区**(`git grep --cached` + `git show :path`),手动/CI 仍判 HEAD —— 否则"代码与台账同票"这一 ratchet 的前提交法必被自己卡死(台账已写 12 而 HEAD 仍是 11 ⇒ 报"baseline 倒退",正常推进只能靠 `--no-verify`);② 一处会让整门失真的写法错误:`git grep -o -E <pat> --cached` 把 `--cached` 当**修订名**解析 → `unable to resolve revision` 退出 → 五端命中全 0 → 满屏"静默丢弃/低于 baseline"红,而真相是 grep 根本没跑;选项移到模式串之前,并按 exit 1(无匹配)与 ≥128(自身失败)分流,后者 `exit 2` 不许把"没跑成"当成"没命中"。两条各一枚镜像测试钉住(⑤ 源码形状钉 + ⑤b 用**临时索引**真跑暂存区口径且绝不碰共享主索引),`node --test scripts/tests/check-sse-dispatch-parity.test.mjs` **10/10**。

- 原第 3250 行 → 存活于新成品:

  - **本票三条 pre-commit 红的归属核查(未拿"其他 agent 的锅"当结论,逐条复跑取证)**:`30c check-stale-copy` 报的两个"陈旧副本"是 `sse-dispatch-coverage.json` 与 `check-sse-dispatch-parity.test.mjs` —— **复跑即消失**,机理是 `BASE = merge-base(HEAD, origin/main)` 而提交那一刻推送仍在飞行(worker 异步 push),我上一票的内容还没进 origin/main ⇒ 被当成"基线祖先历史版本";`84 check-stale-revert` 与 `30c` 剩下的红点名 `PROJECT_PLAN.md`(工作区 blob == `8caa3aef9`,即**旧基线整文件写**)+ 一处 `sqli-guard.test.ts` 暂存删除,均非本票文件,提交后 `git show --stat` 复核本票只含 12 个声明文件。**顺带查出一件未闭环的事**:`gate 89` 在 HEAD 上因 **R5 重复 id 91** 恒红(`check-c-drive-pollution.mjs` warn 与 `check-error-code-coverage.mjs` blocking 同日各登记 91)—— 恒红 blocking = 全队合法 `--no-verify` 关掉其余全部守门,严重度高于其本门所查;工作区里并发会话已把它改到 92 但未提交,故**本票不越权动 `guardian-runner.mjs`**(该文件此刻正是 ` M` 在飞状态),仅在此登记归属:改号由 `eabde2a79f2` 的 owner 提交即解,解阻判据 = `node scripts/check-gate-wiring.mjs` exit 0。

- 原第 3251 行 → 存活于新成品:

  - **守门 90 补接工单第二行 · budget 帧装配沉共享层 + mobile-rn(2026-09-24,commit `bac20ad4a53`)**:① 新增 `packages/shared/src/chat/budget-note.ts` 的 `formatBudgetNote(event, t, keys)` —— 三条硬规则(载荷没给的不说 / 只有 level 时退化为裸标题不留"标题:"悬空尾巴 / 未知档位按 warning 出行不静默)从端内实现**升为共享层唯一真相**,cli 的 `budgetNoteText` 改为委托它,共享层自身 6 例正反用例钉住;② mobile-rn 新增 `src/utils/budget-note.ts`(键挂 `common.*`,两屏共用免跨命名空间互引)+ `AiAssistantN8nScreen` 注册 `onBudget` + 6 键 ×5 语言 + `tests/budget-note.test.ts` 4 例(**真读语言包**跑五语言,断言不回显键名 / 不留 `{占位符}` / 缺 `resetAt` 不出重置文案);③ 台账 mobile-rn baseline 17→18 并摘登记。**过程里自己抓到的一个复写**:`formatTokenCount` 第一版在共享层新造了个千分位同名实现,而 `@ihui/shared/utils` 早有 K/M 版(ASCII、五语言通用)—— 已删自造版改为复用既有,顺带把"web 用「8.5 万」"明确写成不复制的写法。**两处刻意没做并在台账里显式登记(不静默、也不谎报已接)**:miniapp-taro 缺的只是 `src/api/index.ts` 的 dispatch case,而该文件载着并行会话未提交的 D49①(`rateChatMessage`/`sendToolApprovalResponse`/`id?: string`),补 case 会代收他人未提交工作(§12 红线)⇒ 已把本票在 miniapp 的改动**逐 hunk 回退**(api/index.ts、chat.tsx、5 份语言包、离线包 gen 后与 HEAD 零漂移),并在 `missing.miniapp-taro.onBudget` 写明解阻判据;RN 主屏 `ChatScreen.tsx` 同样载着他人未提交的评价/权限档改动,故只接 N8n 助手屏 —— **守门 90 的"名字出现即算已处理"口径看不出主聊天屏仍缺,这条盲区记录在此而非靠台账掩盖**。落地后镜像测试 ②(真仓 HEAD 口径)由红转绿,与 ⑤b(临时索引暂存区口径)同证"代码与台账同票"语义;⑧(编号唯一、从文件反查不硬写编号)仍红,红因是并行会话 `9023ecd304e`(07:48:45)把 `check-cross-end-tokens.mjs` 也登记成 90,而本门 `ce261e1a89a`(07:23:24)是先到者 —— 一行改号可修,但 `guardian-runner.mjs` 此刻被第三路在飞改动(16 行 skipEnv 补齐)占住,提交它会代收他人工作,故不动;解阻判据 = 该文件工作树 == HEAD 后把 `9023ecd304e` 那道门改到空闲的 93(与守门 89 R5 同一条红,同源同判据)。

- 原第 3252 行 → 存活于新成品:

  - **D107 守门脚本探测缺陷修复(2026-09-24)**:`check-sse-dispatch-parity.mjs:55` 原为 `join(ROOT, ...API_CLIENT_PATH)` —— `API_CLIENT_PATH` 是**字符串**(L54 已 `.join('/')` 拼好),spread 把字符串炸成单字符,`existsSync` 探的是不存在的路径 ⇒ 判据失效时的报错「工作树侧也不存在该文件」**失真**(文件实际 137KB 在位)。已改 `join(ROOT, API_CLIENT_PATH)`:实测失效分支报错恢复准确(「工作树侧存在该文件」),`--self-test` 8/8 不回退,`node --check` 通过。主流程(`git show HEAD:` 取帧清单)不受该缺陷影响 —— 只影响失效分支的提示文案;装车配置(门 90)无需改动。

- 原第 3253 行 → 存活于新成品:

  - **守门 90 补接工单第二行 · budget 帧装配沉共享层 + mobile-rn(2026-09-24,commit `bac20ad4a53`)**:① 新增 `packages/shared/src/chat/budget-note.ts` 的 `formatBudgetNote(event, t, keys)` —— 三条硬规则(载荷没给的不说 / 只有 level 时退化为裸标题不留"标题:"悬空尾巴 / 未知档位按 warning 出行不静默)从端内实现**升为共享层唯一真相**,cli 的 `budgetNoteText` 改为委托它,共享层自身 6 例正反用例钉住;② mobile-rn 新增 `src/utils/budget-note.ts`(键挂 `common.*`,两屏共用免跨命名空间互引)+ `AiAssistantN8nScreen` 注册 `onBudget` + 6 键 ×5 语言 + `tests/budget-note.test.ts` 4 例(**真读语言包**跑五语言,断言不回显键名 / 不留 `{占位符}` / 缺 `resetAt` 不出重置文案);③ 台账 mobile-rn baseline 17→18 并摘登记。**过程里自己抓到的一个复写**:`formatTokenCount` 第一版在共享层新造了个千分位同名实现,而 `@ihui/shared/utils` 早有 K/M 版(ASCII、五语言通用)—— 已删自造版改为复用既有,顺带把"web 用「8.5 万」"明确写成不复制的写法。**两处刻意没做并在台账里显式登记(不静默、也不谎报已接)**:miniapp-taro 缺的只是 `src/api/index.ts` 的 dispatch case,而该文件载着并行会话未提交的 D49①(`rateChatMessage`/`sendToolApprovalResponse`/`id?: string`),补 case 会代收他人未提交工作(§12 红线)⇒ 已把本票在 miniapp 的改动**逐 hunk 回退**(api/index.ts、chat.tsx、5 份语言包、离线包 gen 后与 HEAD 零漂移),并在 `missing.miniapp-taro.onBudget` 写明解阻判据;RN 主屏 `ChatScreen.tsx` 同样载着他人未提交的评价/权限档改动,故只接 N8n 助手屏 —— **守门 90 的"名字出现即算已处理"口径看不出主聊天屏仍缺,这条盲区记录在此而非靠台账掩盖**。落地后镜像测试 ②(真仓 HEAD 口径)由红转绿,与 ⑤b(临时索引暂存区口径)同证"代码与台账同票"语义;⑧(编号唯一、从文件反查不硬写编号)与门 89 R5 的同源红**已于当日闭环** —— 并行会话把 `check-cross-end-tokens.mjs` 挪到 93、`check-error-code-coverage.mjs` 挪到 94,本门保持 `ce261e1a89a` 先到的 90;复测 `node scripts/check-gate-wiring.mjs` ⇒ R5=0 / exit 0,镜像测试 ⑧ 亦绿。

- 原第 3286 行 → 存活于新成品:

- [x] ✅(2026-09-24) **D110 WorkBuddy 一手证据已打通 → 对话流 9 条新差距(G-150~G-158,第 54 轮)**:**先前"本机不可取证"的结论作废** —— 用户指出已安装,实测 `G:workbuddyWorkBuddy.exe` 正在运行(4 进程),Electron + `resources/app.asar`(297MB / 逻辑 830MB / 20,474 文件),内部即**腾讯 CodeBuddy**(`/cli/dist/codebuddy.js` 23MB、`betterleaks.exe`、`@tencent/tencent-docs-ai-engine`)。取证法(只读、不 unpack):asar 头部用"扫首个 `{` + 花括号配平(跳字符串/转义)"定位,本机 header 5.4MB 需 ≥96MB 缓冲;**dataStart = header JSON 结束偏移**,条目 `offset` 为相对值;**坑**:`unpacked:true` 的文件(如根 `package.json`)`offset` 为 null,用它标定基址必然假失败 —— 只信 `offset != null` 的条目。对话流主包 `/renderer/assets/lib-chat-ui-*.js`(10,454,844B)**去重中文串 6,725 条**(脚本与产物在 `.ihui-agent/tmp/wb-evidence/`),按族计数:变更 214 / 重试 132 / 上下文 119 / 模式 116 / 权限 81 / 引用 80 / 计划 47 / 耗时 42 / 思考 30 / 回滚 29 / 终端 15 / 记忆 16 / 子任务 6。**由此暴露我方 9 条差距(逐条以对方原文为规格,不再靠猜)**: **对账改判(2026-09-24,HEAD 取证)**:PROJECT_PLAN HEAD 内 G-150…G-158 九枚编号全部在册,登记类交付已完成。

- 原第 3287 行 → 存活于新成品:

  - **G-150 压缩上限告警 + 可操作建议**:对方原文"上下文压缩已达上限,建议开始新对话或减少上下文(如禁用不必要的 MCP 工具/技能)";我方 `compaction` 只报 tokensBefore/After,**不到上限、不给动作**。

- 原第 3288 行 → 存活于新成品:

    - **G-150 落地进度(第 54 轮 · 信号层,提交 1df3f2f1c7)**:根因比"少一句文案"更底层 —— `context_compaction.py` **早已**产出 `trigger:"incompressible"`(第二级降级仍压不动),但 `llm.py` 的发帧条件是 `if compaction_info.get("compressed")` → 该状态**一帧都不发**,前端永远看不见。本轮抽出可测纯函数 `_compaction_frame(info)`:`compressed=True` 或 `trigger=="incompressible"` 才发,并新增 `trigger` 随帧外发;四层同步:`sse_contract.py` payload 元组 / `shared/src/sse/contract.ts` / `sse-parse.ts`(缺省时不造字段)/ api-client 原本就在读一个**契约未声明**的 trigger,顺带对齐。**用例**:pytest 4 例 + shared 2 例(补 shared 用例时第一次 Edit 把上一个用例收尾吞了 —— 半行 old_string 陷阱当场复现,已补回并复跑 7 例绿)。本票 pre-commit **零跳过通过**。**剩余(界面层)**:web `CompressionDivider` 仍按"节省 N%"低调分隔线渲染,incompressible 须改警示行 + `开启新对话` 出口(`clearMessages` 已在 store,需确认新会话入口);extension / miniapp / RN / cli 同批;措辞按对方规格"上下文压缩已达上限,建议开始新对话或减少上下文(如禁用不必要的 MCP 工具/技能)"。

- 原第 3289 行 → 存活于新成品:

      - **G-150 界面层(代码与用例已写好,未提交 —— 被并发 locale 改动卡住)**:`compression-divider.tsx` 已按 `trigger==="incompressible"` 换成警示行(role=status + `compaction-ceiling`,18 行新增);新用例 `compression-divider-ceiling.test.tsx` 2 例真跑通(断言整句等于 `chat.compaction.ceiling*` 词包插值,并断言普通压缩不再出警示行);词表 2 键 × 5 语言已插入,`chat.compaction` 键集合五语言一致(17)。**卡点**:同一批 `packages/i18n/messages/web/*.json` 工作区里另有并发会话的未提交删除(5 份各删 `ai.pane.shortcutShowHelp`),`git diff --numstat` 呈 `2 1` —— 整文件 `git add` 会把别人的删除代收进本票(§12 staged 污染红线),故不提交。**续做(一条链)**:对方提交后复跑 `node .ihui-agent/tmp/g150ui/i18n.mjs`(幂等)→ 校验 `git diff --numstat packages/i18n/messages/web/` 变成纯新增 `2 0` → 以 `feat(web)` 同票提交 `compression-divider.tsx` + 新用例 + 5 份 web 语言包 → 守门 57 该元素补挂 `compaction-ceiling` / `_compaction_frame` 锚点。**再次印证**:字段在 ≠ 界面在(`MessageCompaction.trigger` 与 api-client 解析早已就位,渲染层一直当普通分隔线用)。

- 原第 3290 行 → 存活于新成品:

  - **G-151 上下文生命周期显式交代**:对方"清空上下文,开启新对话""已自动开启新对话";我方无"上下文被重置/自动开新会话"的界面语言。

- 原第 3291 行 → 存活于新成品:

  - **G-152 错误带"点击重试"动作**:对方"网络超时,操作已阻止,请检查网络后重试""明文获取失败,点击重试";我方第 48 轮只做到"第 N/M 次重试"的**告知**,没有用户可点的重试入口。

- 原第 3292 行 → 存活于新成品:

    - **G-152 落地进度(第 54 轮)**:web 侧其实**已有闭环**(MessageItem 错误气泡「重试」→ `ihui:retry-message` → MessageList 复用 `regenerateMessage`,今日刚补上监听);逐端按**落点性质**复核后确认缺口在别处 —— extension 的 `error` 是**页面级字符串**(不是消息级),只有文案没有出口,本票补 `pickRetryTarget`(纯函数,无错误不给按钮、无可重发用户消息也不给按钮)+ 错误条内联「重试」按钮(`chat.retryMessage` 1 键 × 5 语言同票)+ 4 例纯函数用例;守门 57 新增 `error-retry-action` 元素(web + extension 共 3 处锚点)。**剩余**:miniapp-taro 与 mobile-rn 的失败回复仍只有 `callFailed` 类文案、无重发动作;cli 属自动退避(另一形态,是否要 `/retry` 待判)。

- 原第 3293 行 → 存活于新成品:

    - **G-152 mobile-rn(第 57 轮,已闭环)**:`ChatScreen` 的 `onError` 此前只 toast —— 那条空 assistant 气泡既没标记也没出口,界面看成一轮"回答完了",下一轮还会被当历史带给模型。本轮:① `onError` 走共享层 `applyStreamError`(不新增端内词汇,`ChatMessage.error` 就是唯一真相);② `renderMessage` 失败轮改渲染错误卡片(`AlertTriangle` + 标题 + 正文 + `RefreshCw` 重试),形态与 web D22 / miniapp 一致;③ 新增 `retryLastTurn`,把历史**截到上一次提问之前**并显式传给 `send(overrideText, baseHistory)` —— 不再依赖"先 setMessages 再 setTimeout"的旧渲染闭包;④ 上下文卫生:`send` 的 `apiMessages` 过滤失败轮,这条规则 **web `send-message.ts` 早已实现**(`!m.error`),miniapp 本次一并补上(它此前会把错误文案当"自己上一轮的回答"喂回去,且重发路径因闭包旧值会把同一问题带两遍);⑤ 失败轮不给"分享"、复制保留(两端同规则)。词表 `chatAlert.{errorTitle,errorRetry}` 2 键 × 5 语言与代码同票,值与 web `chat` 命名空间同键逐字一致(行级插入,`git diff -w` 每文件恰 `2 0`)。守门 57 `error-retry-action` 补 2 处 RN 锚点。**并发卫生记录**:`ChatScreen.tsx` 工作区里另有他人未提交的 `formatSSEError(err, info)` 透传(3 行),本票按"HEAD + 仅我的 hunk"重建 blob 提交,别人那份 in-flight 改动原地留给他们。**验证**:mobile-rn tsc 0 错、miniapp tsc 0 错 + 387 例、eslint 0 问题、`check-i18n-keys --target=mobile-rn` parity OK(695 键)、守门 57 绿。**剩余**:`AiAssistantN8nScreen` 同类(`onError` 把 `callFailed` 文案塞进 content、无标记无出口);cli 是否补 `/retry` 待判。

- 原第 3294 行 → 存活于新成品:

      - **G-152 RN 第二屏 `AiAssistantN8nScreen`(第 57 轮)**:该屏两条错误路径(`onError` + 2026-09-04 Fix B 的兜底 `catch`)此前都把 `callFailed` 文案塞进 `content`、**不打标也不给出口**,toast 一闪即失。现统一走共享层 `applyStreamError`(正文为空才写错误文案,已有部分内容保留;卡片正文用 `formatted.message`,把原本只在 toast 里的具体原因留在轮次上),`MessageBubble` 增错误卡片 + `onRetry`(父级只在"确实可重发"时传入,缺失即不渲染按钮),失败轮不给分享、复制保留;本屏 `onSend` 只带"本轮 + systemPrompt"(不回放历史),故无需像 ChatScreen 那样截断历史。词表**零新增**(复用 `chatAlert.{errorTitle,errorRetry}`)。守门 57 补该屏锚点。**事故留档**:为验证"剔除他人 in-flight 的 D111 权限档三段后我的改动仍独立可编译",我用重建副本**覆盖了工作区该文件**,而恢复命令因备份文件名写错没执行 → 他人未提交的 D111 改动(state / effect / 渲染行 + 2 个 import,共 31 行)被抹掉。已按先前 diff 逐行重建,复跑 `tsc` 通过、`diff 工作区 vs 我的副本` 恰为那 31 行,原状恢复。**教训:证明"我的改动独立可编译"绝不能靠覆写共享工作区文件** —— 正确做法是把副本 `hash-object -w` 成 blob 后在**只读 worktree** 里验(或直接接受"blob 提交 + 由 push 门 typecheck 复验"),任何写工作区的动作前必须先落一份可寻址备份并当场回读校验哈希。

- 原第 3295 行 → 存活于新成品:

      - **G-152 cli(第 57 轮)**:判据先落在形态差异上 —— cli 本就有自动退避告知(状态行 `retryNoteText` 打"第 N/M 次重试")+ 边框式错误卡片(`renderErrorCard`),真正缺的是**失败之后给用户的下一步**。`/retry` 属新端能力(§24 需用户显式确认),本票不擅自加;改用该端**现成能力**:Node readline 的 ↑ 历史。两条错误路径(`onError` 的 Agent 错误卡片后、外层 `catch` 的会话错误卡片后)各补一行 `t('cli.retryHint')`("按 ↑ 可调出上一条提问重发"),词表 1 键 × 5 语言与代码同票。守门 57 `error-retry-action` 补 cli 锚点。**验证**:cli tsc 0 错、`repl-abort` + `repl-sessions` 24 例 + `i18n-loader` 10 例通过、`check-cli-i18n-parity` 5 语言 × 26 键 OK、eslint 0 问题、守门 57 绿。**至此 G-152 逐端闭环**:web(错误卡片 + 重试,早已)/ extension(`pickRetryTarget` + 错误条内联重试)/ miniapp-taro(错误卡片 + 重发 + 失败轮不进历史)/ mobile-rn(`ChatScreen` + `AiAssistantN8nScreen` 两屏)/ cli(退避告知 + 出口提示);`apps/desktop` 是 Tauri 壳(仓内只有 `src-tauri`,无独立对话实现),复用 web 端即已覆盖。

- 原第 3296 行 → 存活于新成品:

    - **G-152 miniapp-taro(第 57 轮,已闭环)**:先纠正自己上一轮的写法 —— 我起草的端内 `stream-failure.ts` 用了新字段 `failed`,而共享层 `ChatMessage.error` **早已是这个概念的唯一词汇**(web `stores/chat.ts` 自 2026-07-28 起就用它渲染错误卡片),另立字段即制造第二套真相,故端内文件删除、词汇统一为 `error`。**标记规则收成一份实现**:`packages/shared/src/chat/stream-error.ts` 导出 `markStreamError`(空正文写错误文案、**已有部分内容不覆盖**、不改动入参)/ `applyStreamError`(尾位定位,末条非 assistant 一律不改)/ `isErrorTurn` / `resendTargetText`(无可重发提问返回 null 而不是发空消息),并把 web store 里那句 `{ ...target, error: true, content: target.content || error }` 换成调用 `markStreamError`。**miniapp 侧四处接线**:① catch 改走 `applyStreamError`(此前只把文案塞进 content,数据上与一次真回答完全同形);② 存历史前 `filter(!isErrorTurn)`,错误文案不再进 `ai_chat_history` 与历史预览;③ 长按菜单改成数组驱动(失败轮不给"复制/分享",并把"重试"置顶),收藏/朗读对失败轮直接不给动作;④ `ChatMessageItem` 新增失败轮错误卡片(`triangle-alert` + 标题 + 正文 + `refresh-cw` 重试),形态与 web D22 一致。词表 `ai.chatMessageItem.{errorCardTitle,retry}` 2 键 × 5 语言与代码**同票**,措辞逐字沿用 web `chat` 命名空间同键值。**踩坑记录**:`i18n-apply --target=miniapp-taro` 会把语言包里的数组整体 reflow(实测 4 文件 1570 行 insertions 全是排版噪音),已改为"基线取 HEAD + 行级插 2 行"的做法,并用扁平化差分自证 `en/ja/ko/zh-TW` 相对 HEAD 均 `+2 -0 ~0`(没丢键、没改值、没代收他人内容)。**验证**:shared tsc 0 错 + 新用例 12 例、miniapp tsc 0 错 + 387 例、守门 57 补 2 处锚点(注入 bogus mustMatch 实测门变红后还原)、prettier/eslint clean。**剩余**:mobile-rn 同类(它已有 `error` 词汇,只缺标记与出口);cli 是否补 `/retry` 待判。

- 原第 3297 行 → 存活于新成品:

  - **G-153 权限分级的后果说明**:对方"完全访问权限""减少确认步骤,允许 AI 直接执行更多操作""开启完全访问后…请谨慎操作。包括以下内容";我方权限模式切换缺"这一档会导致什么"的成文交代。

- 原第 3298 行 → 存活于新成品:

    - **G-153 落地进度(第 54 轮 · cli 先行)**:先按落点性质核实现状 —— web 其实**已有**权限说明栈(popover / info-modal / confirm-dialog / history-panel),但 `permission-mode-info-modal` 的入口条件是 `mode === 'bypass-permissions'`,即**只有最高风险档解释后果,其余档只报档名**;miniapp-taro 与 mobile-rn **0 命中**(整套权限模式 UI 都没有,属独立大件);cli 首屏只打 `权限 <档名>`。本票补 cli:`permissionModeNote(mode)`(五档 → `cli.permNote*` 词表,**未知档返回空串**而不是回显键名或编造)+ 首屏「权限说明:」一行(bypass 红 / acceptEdits 黄 / 其余暗),词表 5 键 × 5 语言与代码同票(`cli` 键集合一致 24),用例 3 例。守门 57 新增 `permission-mode-consequence` 元素(cli 两处 + web info-modal 一处锚点,清单 114 → 115)。验证:cli tsc 0 错、**全量 115 文件 2469 例通过**(改首屏打印未伤既有输出断言)、守门 57 绿。**剩余**:web 其余四档的后果行(词表被并发 locale 未提交删除卡住,与 G-150 界面层同批续做);extension 仅 1 处类型命中、无档说明;miniapp / RN 需先做权限模式选择 UI。

- 原第 3299 行 → 存活于新成品:

    - **G-153 更正(第 55 轮,自己推翻自己的结论)**:上面写的"web 只有最高风险档解释后果、其余档只报档名"**不成立** —— 复查 `permission-mode-popover.tsx` 渲染层发现 `MODE_OPTIONS_LIST` 三档各带 `descKey`(`mode.askDesc / autoDesc / fullDesc`),选项卡片里逐个渲染 `t(opt.descKey)`,另有 `highRisk` 徽章、高风险琥珀描边、切换后撤销 toast(`switchedTo*Desc`)与首次启用高风险的确认弹窗。我当时只看了 `permission-mode-info-modal` 的入口条件(`mode === bypass-permissions`)就下判断,**把"深入文档只给最高档"错说成"后果说明只给最高档"** —— 又一次"落点没看全就判缺失"(与 citations 那条同源)。真实缺口收缩为:web 无缺口;cli 确曾只打档名(本票已补);**extension / miniapp-taro / mobile-rn 是否各有档后果说明待逐端按渲染层核实**(miniapp/RN 是整套权限 UI 缺失的更大问题)。

- 原第 3302 行 → 存活于新成品:

  - **G-156 记忆三态**:对方区分"记忆已创建 / 已更新 / 已删除";我方 #27 只有"已记住 N 条",既不分态也不可管理。

- 原第 3303 行 → 存活于新成品:

  - **G-157 输入区能力提示**:对方"提及文件/符号""搜索文件、符号""上传文件或更多操作"写进界面;我方 @ 菜单无这类发现性文案(能力在、话没说)。

- 原第 3304 行 → 存活于新成品:

  - **G-158 反向清单(我方可能领先,禁止照抄)**:对方"子任务/子代理/专家团/分工"合计仅 6 条 —— 多代理分工在其对话流里**不是显性一等公民**;我方已有 subagent 时间线 + 阶段进度,应继续加固而非削平。

- 原第 3306 行 → 存活于新成品:

  - **进度(第 57 轮 2026-09-22):G-154 已落地(提交 `743e77b0bf` + 词表/守门数据随并行卷带入库),另附两条更正**。① G-154 终端隔离交代:`terminal-section.tsx` 交代行常显(`ai.pane.terminal.isolation` ×5 语言,真值=os_sandbox `allow_network` 默认 False/H5 三平台验收),真实词包整句相等用例 2 + 截断回归 3 零回归,变异测试 2/2 转红,守门 57 登记 `terminal-isolation-disclosure`(清单 120 条);**残余**(第 60 轮已收口,见下一行)。② **D107b 更正(降级,勿按原口径实施)**:5 处 `message`-only thinking 帧全在 langgraph 路径,而 `agents.py:1022-1025` 已证 agent_loop_v2 是唯一执行事实源、langgraph 仅剩 a2a 半退役消费 —— "双端丢弃"对主对话流无用户影响,维持待办但降为低优先;若做,按 D107b 原判据先二选一(阶段枚举 + 5 端取词,或收回该帧)。③ **D111 更正(阻塞面前置)**:miniapp-taro/mobile-rn/extension 的 `permissionMode|workspace` 命中实测均为 0 且**无 workspace 取数通道**(mobile-rn 仅 4 处无关命中)—— 三端缺的是数据面不是文案,必须随 G-164 整票(数据面 → 注册表取词 → 档位行),禁止直接抄 web UI 写出永远取不到值的代码。

- 原第 3307 行 → 存活于新成品:

  - **G-154 残余收口(第 60 轮):三端终端面补齐同一句交代,措辞逐字同源 web。** extension 在 `MessageContent.tsx` 的**首个**终端块内出一行(`chat.terminalIsolation`;extension 无折叠区,逐块渲染会把同一事实复读 N 遍,故用例断言"一条消息只出现一次");mobile-rn 在 `AiAssistantN8nScreen.tsx` 终端列表标题下复用既有 `bubbleStyles.blockHint`(`aiAssistantN8n.terminalIsolation`);miniapp-taro 在 `ai-cards.tsx` 终端卡头部下新增 `.ai-card-section-note`(`ai.cards.terminal.isolation`)。**三端词值一律取 web `ai.pane.terminal.isolation` 同语言原文**,不各写一遍话;15 个语言包文件逐文件核对为纯新增(`1 0`),miniapp 离线包 `gen:i18n` 重生成(仅 4 行 b64 载荷变化)。守门 57 `terminal-isolation-disclosure` 的 anchor 由 2 条扩到 6 条,**判据有效性已注入验证**:三端各把 mustMatch 换成 bogus 串一次 → 门逐条点名变红、还原后复绿。验证:extension 新增 2 例静态渲染用例(读真实词包断言整句)+ 包级 typecheck + eslint 全绿;miniapp-taro typecheck + eslint + 跨端样式一致性守门全绿;mobile-rn 包级 tsc **拿不到结论** —— 并发会话正把 `AiAssistantN8nScreen.tsx` 改到语法破损(11 处 TS1005/1128,全在 1013–1054 区间,HEAD 基线 0 错),故改用"HEAD + 我的 4 行"隔离取证:TS 解析 0 语法错、prettier 除他人已入库的第 1106 行外无改动诉求。本票对该文件走 blob 旁路落库,不夹带也不覆盖他人 in-flight 内容。

- 原第 3314 行 → 存活于新成品:

  - **进度(第 48 轮 · web 侧收口,extension 仍缺)**:web 四层一通 —— `packages/types/src/chat.ts` 加 `ChatMessage.retryNotice`(与 `injections` 同处同纪律);store 新增 `setMessageRetryNotice`(**整体替换为最近一次**:attempt 递增,旧的"第 1 次"没有继续显示的价值,与 injections 的"追加+去重"刻意不同并在注释写明原因);`send-message.ts` 注册 `onRetryScheduled`(`evt.messageId ?? assistantId`,缺 id 直接不写,不造假归属);新组件 `RetryNotice`(`ai.pane.retryScheduled` / `retryScheduledNow`,**立即重试走"立即继续"分支**,`httpStatus` 缺省不渲染)。词表 2 键 × 5 语言与代码**同票**提交,`ai.pane` 键集合五语言一致(165 键)。守门 57 新增 `upstream-retry-disclosure` 元素并挂 6 处锚点(api-client / web×2 / miniapp-taro / mobile-rn / cli)。**过程中被自己的工具链抓到两处错**:(a) `noUncheckedIndexedAccess` 下测试直接取 `panePack.retryScheduled` 报 possibly-undefined;(b) 误把 `cleanup()` 当 `RenderResult` 的方法用(应为 `unmount()`)—— 都是 tsc/vitest 先红,修后绿。用例断言用**整句等于词包插值结果**而非"包含",防"写死文案也能过"。验证:web `tsc --noEmit` 0 错、`retry-notice` 3 例 + `injection-bar` 6 例回归全绿、prettier 绿。**残余(不称收口)**:extension 对该帧仍 0 命中(未注册);web `retryNotice` 未持久化(刷新即失,属 S 层,与 D24 落库面同批)。

- 原第 3412 行 → 存活于新成品:

      - **③ 已定论(第 60 轮 2026-09-23,永久裁定勿翻案)**:`workspace_permissions` 无记录时**不回退**到"用户全局默认档"盖第二优先级。理由:① 盖章语义是"这条回答生成时实际生效的档"(历史事实),用户全局默认档只是"以后新建绑定的偏好",性质不同,盖上来=伪造历史;② 失败方向朝更保守——无 key=消费方知道"未知"并安静降级,伪造值会让审计/回放信任一条从未验证的声明(G-163 fail-open 同构);③ 展示层已有分层(消息盖章值 > 工作区默认档上下文行),用户侧不缺信息。**结构性防回潮**:`permissionStamp` 只接受一个参数,测试以 arity 断言钉死(加 userDefault 兜底参数前必须先显式推翻定论);未来若要在流式入口捕获请求真实生效档位,那是新的盖章来源(服务端可验证的请求时事实),须另立机制。落点:`apps/api/src/services/message-permission-stamp.ts` 头部定论 + `message-permission-stamp.test.ts` 7 例。

- 原第 5311 行 → 存活于新成品:

- **平台独占豁免依据(§9)**:改动全在 RN 端取色层与 design-tokens 的 RN 专用板(`rn-tokens.ts`),不触 web/miniapp-taro 的 CSS 变量链路;`brand.foreground` 为新增字段,其余端不消费。

- 原第 5401 行 → 存活于新成品:

- [x] ✅(2026-09-25) O10 对外 run 语义：幂等 run 创建（`Idempotency-Key`）、外部 run 句柄（不依赖 IHUI session_id）、通用幂等层、游标分页规范  ⏳(幂等重放保护已入库(af96921c95);run 句柄与游标分页另列 O10b)（✅2026-09-26 复核完成:run 句柄+游标分页已由 15e4f1f742e 落库(/api/agent-runs 三端点+cr1_ 游标),本票全量核实 38/38 绿、无需重做;余 api-client 接线与该提交自登记尾巴） 〔2026-09-25 翻勾:四件(幂等创建/外部句柄/通用幂等层/游标分页)经代理逐件核验已由 15e4f1f742e 落库,O10 测试 98/98 全绿;六条尾巴各自属主/需§24确认,已在其条登记〕

- 原第 5402 行 → 存活于新成品:

  - **进度(2026-09-24 派单；同日续做已转正式交付,见下一条)**：首轮当时未合入 main,现场留档于 tag `backup/wip-o10-2026-09-24`（commit `cffab4cb4af`，已推 origin 并 `ls-remote` 回读）。8 个新文件：`apps/api/src/services/{run-idempotency,run-handle,cursor-pagination}.ts` + `routes/agent-runs.ts` + 4 个测试。**判红的理由（不是审美）**：`npx vitest run` 实测 46 例 **12 failed / 34 passed**，其中 `agent-runs-route.test.ts` **8 条全红** —— 带身份的请求也拿到 401，即测试内 `vi.mock('../src/plugins/auth.js')` 的身份注入没落到 `request.userId` 上，**根因未定位**（不靠猜下结论，同 §"扫到 0 先怀疑判据"的反面：现象与预期矛盾时先取证再动手）。另 3 条已定性：① `canonicalJson` 那条是**测试期望本身写错**（该函数只排序对象键、不得重排数组，期望值却把 `[1,{…}]` 写成 `[{…},1]`）；② `readIdempotencyKey` 的"过短算没带"断言依赖 `utils/http-normalize.normalizeHeader` 对数组头的行为，未读源码确认；③ 已当场修掉一处真类型缺陷并复验 `pnpm --filter @ihui/api typecheck` exit 0 —— `run-idempotency.ts:84` 把 `unknown` 头值直喂 `normalizeHeader(string|string[]|undefined)`，改为按"非 string / 非数组即视为没带"收窄（不用断言绕过）。

- 原第 5403 行 → 存活于新成品:

  - **交付(2026-09-24 同日续做)：8 文件已入库并挂路由,首轮 12 条红测全部定性修绿(实测 46/46)**，没有一条靠削断言换取：

- 原第 5404 行 → 存活于新成品:

    - 7 条同源，错在测试脚手架自己 —— `createRun()` 写成 `over.user ? {'x-test-user':over.user} : {}`，而那批"带身份"的用例根本没传 `over.user` ⇒ 它们全是游客请求 ⇒ 401。先拿一枚同装配探针实测拿到 **201**，才确认根因在测试不在产品码；修法为默认带属主 `?? '7'`，游客那条走裸 `inject`，断言原样保留。

- 原第 5405 行 → 存活于新成品:

    - `canonicalJson` 期望值本身写错：该函数只排序对象键，数组一旦排序 `[A,B]` 与 `[B,A]` 就被判成同一请求体 ⇒ 幂等层把首次结果回给语义不同的重放(数据错乱级)。改成保序期望值并把这条不变量写进注释。

- 原第 5406 行 → 存活于新成品:

    - "过短"样本用了 12 字符而 `MIN_CLIENT_KEY_LEN = 8`；数组头按本仓 `normalizeHeader` 约定取首值而非判无效 ⇒ 改成两条断言(数组取首值 + 真·非字符串数字头算没带)，覆盖面变大不是变小。

- 原第 5407 行 → 存活于新成品:

    - `run-handle` 拿 base64 前 8 字符当"不可预测"尺子，而那是 `["run_` 的固定前缀必然相同 ⇒ 改判整枚句柄与**签名段**不同。

- 原第 5408 行 → 存活于新成品:

    - 并发同 key 断 `[201,409]`，但假 KV 同步落完时第二个是 200(已完成回读) ⇒ 改断这层真正的承诺：**只建成一次且两个响应指向同一 run**，永不允许两个 201；在途 409 仍由 `run-idempotency` 套件定死。

- 原第 5409 行 → 存活于新成品:

    - 游标那条的参照值取"从 r4 续翻那一页的 next_cursor"，而那一页只剩 r5、已无下一页 ⇒ 参照恒为 null，比的不是同一件事。改成**更强**断言：用第 2 页末尾游标真去翻第 3 页，必须正好拿到 `['r5']`。

- 原第 5410 行 → 存活于新成品:

    - 一处产品侧真缺陷当场修并复验：`run-idempotency.ts` 把 `unknown` 头值直喂 `normalizeHeader(string|string[]|undefined)`，改为按"非 string / 非数组即视为没带"收窄(不用断言绕过)。

- 原第 5411 行 → 存活于新成品:

    - **生产安全取舍(与派单原文不同,故写明)**：工厂缺 `handleSecret` 会抛错，若在挂载处 `?? config.JWT_SECRET` 兜底，两个 env 都没有时就会**把整个 API 启动带崩**(本机即生产机)；挂载处改为"解析不到密钥就跳过该面并 `server.log.warn`"。

- 原第 5412 行 → 存活于新成品:

  - **仍留的尾巴(故 O10 不勾)**：① 路径形态 —— 插件声明 `POST '/'` 而本服未开 `ignoreTrailingSlash`，对外实际是 `/api/agent-runs/`(带尾斜杠)，要收成无斜杠须改插件路由声明并同步 api-client，不许动全局 routerOption；② run 记录暂存 Redis(TTL 24h、owner 索引上限 1000 超出截断)，落库需 `packages/database` 属主建表(DDL 提案在该 WIP tag 的提交说明里)；③ 与 `v1-assistants.ts:426-443` 那套私有 `irun_<ulid>` 句柄**仍是双轨**，合并归该面属主；④ `POST` 只落 `status='queued'` 不投递引擎(那是新功能，需另行确认)；⑤ api-client 方法与 8 端调用未做(§9 口径未闭环)；⑥ README 未同步(§21 已触发，但该文档正被并行会话争用)。

- 原第 5413 行 → 存活于新成品:

  - **取证结论（值得留，省下一个人重复劳动）**：仓里**已有**幂等实现 `apps/api/src/plugins/open-idempotency.ts`(431 行,Redis `SET NX PX`,capability 门控,Redis 挂时 fail-open) 与游标分页 `apps/api/src/utils/cursor-page.ts`(签名游标 `cr1_`,已被 `v1-assistants`/`v1-batches` 真实消费)；故新写的 `cursor-pagination.ts` 是**复用层**(内核 re-export,零第二套编解码)，`run-idempotency.ts` 与开放面那套**刻意不同**：它是这些面唯一的重复创建防线,所以降级默认 `closed` 而非 fail-open(取舍写在门注)。

- 原第 5414 行 → 存活于新成品:

  - **已知双轨（未收敛,属架构决定）**：`v1-assistants.ts:426-443` 已有一套私有 `irun_<ulid>` + Redis 正反映射句柄（未导出故不可 import），与本 WIP 的无状态签名 `runh_` 并存。合并与否请由该面属主定,勿默默留两套。

- 原第 5415 行 → 存活于新成品:

  - **解阻判据**：定位 401 根因并把 12 条修绿（不得靠削断言/删用例换取全绿）→ 补 §5c 水印 inject+verify → 单点接线 `server.register(createAgentRunRoutes({kv: createKvFromRedis(server.redis), handleSecret: process.env.AGENT_RUN_HANDLE_SECRET ?? config.JWT_SECRET}), { prefix: '/api/agent-runs' })`（**必须配 `AGENT_RUN_HANDLE_SECRET`**，缺省时工厂直接抛错拒启动）→ 与代码同 commit 补 README(§21「新增 API 路由」已触发)与 api-client 方法 → 跑 `pnpm --filter @ihui/api typecheck` + eslint 0 error 后正常提交(不得 `--no-verify`)。另注:`POST '/'` 带 prefix 会解析成 `/api/agent-runs/`(尾斜杠),对外路径形态要先定。

- 原第 5613 行 → 存活于新成品:

- [x] ✅(2026-09-24) RN 分类栏统一收口(承 2026-09-23 04:19 会话被取消的迁移,用户原话"所有的菜单栏分类栏没有设计好 统一 好看的符合项目统一的样式 点击后下拉窗的形式呈现 左右滑动"):地基 `packages/app/src/components/category/{CategoryInlineBar,CategoryDropdown}` 补包根导出(`@ihui/rn-app` 可直接 import,此前只到 `components/index.ts` 端内取不到)+ Dropdown 面板改 `ScrollView`(修"选项多于 8 条被 maxHeight+overflow:hidden 静默裁切")+ 圆角一律 `rnRadius` 档(对齐同日新立 §4 圆角单一源头)。**迁移面 16 处**:共享层 9 屏(square/plaza/order/team/ranking/recruitment/token-value/study-index/study-publish,其中 study-publish 的 API 动态赛道 = CategoryDropdown 装车点)+ 端内 7 屏(ProfileScreen / TokenValueScreen / TopicListScreen / StudyIndexScreen / MaterialList / AgentScreen 赛道弹层双行并删违规 `trackDivider` hairline 分割线 / FenLeiOverlay 赛道行+分类网格双条)。孤儿裁定:`StudyBar`、`SingleTypeBar` 已零调用点(删除需同步下调 `scripts/radius-single-source-baseline.json` 的 2 条基线,本轮未做)。**真机取证(v0.0.4 / code 5 release 包,Hermes 字节码 bundle grep 命中 `CategoryInlineBar` / `agent-track-bar` / `ctaFill`)**:① 点顶栏「分类」弹出的那块当时仍是迁移清单外的 `FenLeiOverlay`(已补迁);② **该轮「选中 chip 底色未落上」的结论是取证方法错误,不是产品缺陷**(2026-09-24 真机定档):那块 chip 当时位于一层 `tokens.overlay.modal = rgba(0,0,0,0.6)` 遮罩之下,像素被整体压到原值的 40% —— 实测底色 #414E56 恰等于 #a3c4d6 × 0.4(R/G/B 三通道同比例 0.40,是遮罩指纹而非取色错误),同行 idle 底 #262626×0.4=#0A0A0A、描边 #525252×0.4=#212121、次要文字 #A3A3A3×0.4=#414141 全部对上。撤掉遮罩后在无任何弹层的广场页复测:选中 chip = 纯 `ctaFill` 底 + `ctaText` 字,浅色档案实测 #000000/#FFFFFF、深色档案 #a3c4d6/#16262e,按主题正确翻转。**教训:像素直方图取证必须先排除遮罩** —— 三通道同比例缩放即「上方有一层半透明黑」的判据,此时任何「颜色没落上」的结论都不成立;③ idle chip 以 `surface.card` 作底、落在同为 `surface.card` 的面板上确实隐形(这一条是真的),已改 `surface.muted` + 描边 `border.medium`,真机复测 idle 与选中两态均清晰可辨。同轮真机走查另立三项新缺陷(与本条无关):登录态启动硬崩、AI 需求广场「深色顶栏/底栏 + 浅色正文」主题割裂、一枚红色 ✕ 浮层压在分类条上。

- 原第 5614 行 → 存活于新成品:

- [x] ✅(2026-09-24) RN 分类栏统一收口(承 2026-09-23 04:19 会话被取消的迁移,用户原话"所有的菜单栏分类栏没有设计好 统一 好看的符合项目统一的样式 点击后下拉窗的形式呈现 左右滑动"):地基 `packages/app/src/components/category/{CategoryInlineBar,CategoryDropdown}` 补包根导出(`@ihui/rn-app` 可直接 import,此前只到 `components/index.ts` 端内取不到)+ Dropdown 面板改 `ScrollView`(修"选项多于 8 条被 maxHeight+overflow:hidden 静默裁切")+ 圆角一律 `rnRadius` 档(对齐同日新立 §4 圆角单一源头)。**迁移面 16 处**:共享层 9 屏(square/plaza/order/team/ranking/recruitment/token-value/study-index/study-publish,其中 study-publish 的 API 动态赛道 = CategoryDropdown 装车点)+ 端内 7 屏(ProfileScreen / TokenValueScreen / TopicListScreen / StudyIndexScreen / MaterialList / AgentScreen 赛道弹层双行并删违规 `trackDivider` hairline 分割线 / FenLeiOverlay 赛道行+分类网格双条)。孤儿裁定:`StudyBar`、`SingleTypeBar` 已零调用点(删除需同步下调 `scripts/radius-single-source-baseline.json` 的 2 条基线,本轮未做)。**真机取证(v0.0.4 / code 5 release 包,Hermes 字节码 bundle grep 命中 `CategoryInlineBar` / `agent-track-bar` / `ctaFill`)**:① 点顶栏「分类」弹出的那块当时仍是迁移清单外的 `FenLeiOverlay`(已补迁);② **该轮「选中 chip 底色未落上」的结论是取证方法错误,不是产品缺陷**(2026-09-24 真机定档):那块 chip 当时位于一层 `tokens.overlay.modal = rgba(0,0,0,0.6)` 遮罩之下,像素被整体压到原值的 40% —— 实测底色 #414E56 恰等于 #a3c4d6 × 0.4(R/G/B 三通道同比例 0.40,是遮罩指纹而非取色错误),同行 idle 底 #262626×0.4=#0A0A0A、描边 #525252×0.4=#212121、次要文字 #A3A3A3×0.4=#414141 全部对上。撤掉遮罩后在无任何弹层的广场页复测:选中 chip = 纯 `ctaFill` 底 + `ctaText` 字,浅色档案实测 #000000/#FFFFFF、深色档案 #a3c4d6/#16262e,按主题正确翻转。**教训:像素直方图取证必须先排除遮罩** —— 三通道同比例缩放即「上方有一层半透明黑」的判据,此时任何「颜色没落上」的结论都不成立;③ idle chip 以 `surface.card` 作底、落在同为 `surface.card` 的面板上确实隐形(这一条是真的),已改 `surface.muted` + 描边 `border.medium`,真机复测 idle 与选中两态均清晰可辨。同轮真机走查另立三项新缺陷(与本条无关):登录态启动硬崩、AI 需求广场「深色顶栏/底栏 + 浅色正文」主题割裂、一枚红色 ✕ 浮层压在分类条上。

- 原第 5615 行 → 存活于新成品:

- [x] ✅(2026-09-24) **RN 登录态启动硬崩根治(commit `4812fbb10`,真机 versionCode 7 复验)**:`RootNavigator.tsx` 的 `<UiControlBridgeLayer>` 被 `e09d86622`「事故后现场保全」快照按旧基线整文件回写,重新落进 `RootStack.Navigator` 的直接子节点位 —— React Navigation 只接受 Screen/Group/Fragment,登录态一进入即 JavascriptException + FATAL 退出。**HEAD 与 origin/main 双双含此缺陷**,即已发布的 0.0.5/code5、code6 在手机上登录后必崩(实测 `exp_appbootfail zh.ai.sq` / `JE_AppCustomException`,任务 `isExiting`、`mCurrentFocus` 退回 launcher)。正确挂载点 `1fdd73ed2` 早已建好(现 805 行),本次只是删掉复活的 2 行。取证:改前 `am start` 后焦点仍在桌面且无窗口;改后 `mCurrentFocus=zh.ai.sq/.MainActivity`、logcat 零 JS 异常。**顺带解锁一道从未跑过的取证用例**:`tests/agent-runtime-permission-decision.test.tsx` 自带 6 键 `react-native` 内联 stub,与 vitest.config 的 alias(`tests/__mocks__/react-native.ts`,含 Appearance)冲突,主题层在模块求值期取 `Appearance.getColorScheme()` 即整文件加载失败、收集 0 条用例 —— 一道 D55/G-66 取证用例静默空转。删内联 stub 后 4 条全跑全绿;mobile-rn 由 40 文件/391 例 + 1 空文件 变 41/395 全绿。

- 原第 5617 行 → 存活于新成品:

- [x] ✅(2026-09-24) **RN 端内自立的主按钮档 `brand.ctaFill`/`ctaText` 已删除,CTA 统一到 web 实际在用的那对档**(用户原话"那这个 token 删掉,使用 web 端用的那个 token";`fd1282a20c` 迁档 → `7d524928a2` 文档 + 守门 90 R2/R3 反"端内自立档"判据 → `9023ecd304` 装车 → `075e56ee39`/`39c0428857` 守门 83 收口 → `0a262ac1b0`/`43a84c6d6a` 自愈加固):

- 原第 5618 行 → 存活于新成品:

  - **web 真正用的那对是** `--color-primary` / `--color-primary-foreground`(即 `bg-primary text-primary-foreground`),实测消费点:`packages/ui-react/src/components/button.tsx:21,29,33,34`、`category-bar.tsx:31`(ITEM_ACTIVE 选中态)、`switch.tsx:61`(该处走 `--color-brand-accent`,不属 primary 档,别混)。RN 改后 `brand.DEFAULT`/`brand.foreground` 与之逐位同值,由守门 90 R1 钉住(`rn-tokens.ts` ↔ `styles/tokens.css`);R2 拦"未声明的品牌键"(自立档即红),R3 拦"对已删键的悬空引用"。

- 原第 5619 行 → 存活于新成品:

  - **观感变化(如实报)**:深色档案下 RN 主按钮 / 选中 chip / 加号 FAB 的底色由灰蓝 `#a3c4d6` 变**纯白**,前景由 `#16262e` 变纯黑 —— 与 web、小程序暗色主按钮一致;浅色档案零变化。要再调暗色主按钮观感,改 `tokens.css` 的 `.dark --color-primary` 一处,三端同时动,不得回端内加档。

- 原第 5620 行 → 存活于新成品:

  - **删档连锁面逐项收口**:① 迁移 26 文件 / 36 处 `ctaFill`(含 PlazaScreen 的 retryBtn/emptyBtn/chatBtn/fabCircle 与 CategoryInlineBar 选中态);② 守门 83 R3 基线登记 23 文件,且**取证为纯改名重分类**:逐文件核对"现 R3 计数 == 迁移前 `brand.DEFAULT` 计数 + 迁移前 `ctaFill` 计数",全仓 0 反例、零新增纯白填充(R2 基线一格未动;台账写在 JSON 的 `ctaFillRenameLedger`,抬升数即该键里的 perFile);③ 守门 83 的头部文档 / 失败提示 / self-test 措辞原本仍在教"改用 ctaFill 是 R3 的正解"(照写即悬空引用),已改 §4 成对口径,判据代码与断言期望值一字未动;④ 工作树 8 个文件 18 处"拼合旧基线"副本按 HEAD 复位,旧字节留快照。

- 原第 5621 行 → 存活于新成品:

  - **机制修复(这次欠的不只是登记)**:`scripts/heal-worktree-tracked.mjs` 新增第二判据通道 `compositeDriftPaths` —— 整块不等于任何祖先、但每个改动块逐字见于历史 ⇒ 判回潮并对齐。四条护栏:取用行形状限定(增删两侧都算,顺带挡住"删整段尾巴"——git 会把删除并进相邻块,单靠"只删不增"判据会漏)、块须见于历史、**纯重排不认领**(实测本仓这种假滞后 184 个文件,全在 lint-staged 的 import 排序上;若不排除守护会与格式化器每 2 分钟互踩一次)、覆盖前留字节快照。另把三处 restore 循环改为"git 写锁竞争即延后"(实测连撞两次 `index.lock`,原写法一抛就让整轮自愈作废)。判据``--self-test` 12 → **32 例**;"全仓真回潮 0 命中"这个数字用**阳性对照**反证过:把本次真实回收的滞后快照字节放回磁盘,判据 2/2 认出。

- 原第 5622 行 → 存活于新成品:

  - **一次值得记的互踩**:本会话对守门 83 的两笔已入库修正(`075e56ee39` 基线登记 + `39c0428857` 文案复位)被并行会话 08:36 的 R4 提交 `c08c71f7e7` 按**它自己那份旧基线**整文件回退 —— 基线数被抹回旧值、头部文档重新教"用 ctaFill"。因此本条登记与这两笔修正现在是**第二次前向修复**。口径:**给别人做"文案/基线"类前向修正,提交后必须 `git show HEAD:<file>` 回读复核存活**,只看工作树绿会漏(与 §5b"HEAD 被索引层重建回写成旧基线"同一类)。

- 原第 5623 行 → 存活于新成品:

  - **客观受阻(带数字,不写作待办)**:守门 83 的 **R2 在 HEAD 恒红 = 4 文件 / 11 处**(`AgentRuntimePanel.tsx:39,115`、`ModelConfigDialog.tsx:584,654,789,887,942,1042,1070`、`NotificationPanel.tsx:50`、`AiAssistantN8nScreen.tsx:2114`),全为他人**已入库**的硬编码浅色容器(在 `fd1282a20c^` 上同样红,与改名无关)。这些组件正文用静态 `text-gray-900` 一类色板,**只翻底色会做出"深底深字"的更坏结果**,须底色与文字色同批 theming 并做暗色真机验收 —— 不为过门抬基线,不越权改他人未验收 UI。因共享工作树滞后会假绿,核验须用干净检出:`git worktree add --detach ../wt HEAD && node scripts/check-brand-foreground.mjs`。

- 原第 5686 行 → 存活于新成品:

- [x] ✅(2026-09-23) **顺带修**:From 构造改为 `"智汇AI官方" <SMTP_USER>`(QQ 中继要求 From 邮箱段==登录账号,否则 550;旧 PS 硬编码 `IHUI-AI@aizhs.top` 配 QQ 账号 ⇒ SMTP 分支恒被拒、恒回落纯文本 Resend);`--strict` 下失败 exit 1(调用方得以判定降级),不带该参数仍恒 exit 0(CI 语义不变)。

- 原第 5687 行 → 存活于新成品:

- [x] ✅(2026-09-24) **守门 81** `check-brand-email-channel.mjs`(blocking):`.ps1`/`scripts`/`deploy` 中出现 `Send-MailMessage` 缺 `-BodyAsHtml`、或直连 `api.resend.com/emails` 而 payload 缺 `html` ⇒ 拦,并把"ops 邮件必须经 notify-deploy-failure.ts"钉成硬约束;含 `--self-test` + §22c 镜像测试。 **对账改判(2026-09-24,HEAD 取证)**:与下方 id 81 的现行条目重复登记,证据同 O25。

- 原第 5870 行 → 存活于新成品:

- [x] ✅(2026-09-24) **取证**:shared `stream-error` 12→16 例(含"不传不写键 / 空串不写 / 已有内容不被销毁"),web store +2 例(带码落到消息、两参旧形态不写键),新增 `message-item-error-card-wiring.test.ts` 5 例(`?raw` 读源码原文,同时钉"消费侧走表"与"生产侧带码"两环 —— 少任一环都会静默退化,渲染整套 MessageItem 反而会被 mock 掩盖)。**变异验证**:把 `entry.actionKey` 换成硬编码中文 → 该例立即变红,证非恒真。web tsc:我改的 5 个文件 0 错误(余 31 条属他人 in-flight 的 PriceChart / progress-sections,已 HEAD 差集对照,非本次引入)。

- 原第 5894 行 → 存活于新成品:

- [x] ✅(2026-09-24)**本轮真机走查查出、刻意未批量改的两项结构性欠账(2026-09-24)**:① **守门 83(check-brand-foreground.mjs)判据盲区** —— R1 只在**同一 style 块内**同时出现 bg 与 fg 才红,而本轮 4 处真缺陷全是**跨兄弟键**(retryBtn 配 retryText、chatBtn 配 chatBtnText),脚本第 251-255 行还显式断言「跨块不得触发」,于是它一路漏进已发布的 code5/6/7 包。补法应是「按 StyleSheet 键名配对(xBtn ↔ xBtnText / xLabel)再判 brand.DEFAULT × text.primary」,**但这是他人守门判据,未擅自改**,留单给守门属主。② **共享层 212 个 theme-driven 组件的形参默认值 colorScheme = "light"** 是「调用方忘传即静默脱主题」的地雷(本轮 84583fdf6 修的两处即其表现)。**已实测确认当前无其他受害调用点**(212 组件 × 端内全部 JSX 渲染点 → 漏传 0 处),故未做 213 文件的大改;若要根治须改为必填并全端接线,属独立批次。另:广场列表接口在本机持续失败并反复弹错误框吞点击,该页数据链路待单独查(未定性为缺陷,可能是环境/后端数据)。 **对账改判(2026-09-24,HEAD 取证)**:check-brand-foreground.mjs HEAD 内 r4Counts 命中 9 次,R4 兄弟键配对判据已落(本条要求的正是这一判据)。

- 原第 5895 行 → 存活于新成品:

- [x] ✅(2026-09-24)**本轮真机走查查出、刻意未批量改的两项结构性欠账(2026-09-24)**:① **守门 83(check-brand-foreground.mjs)判据盲区** —— R1 只在**同一 style 块内**同时出现 bg 与 fg 才红,而本轮 4 处真缺陷全是**跨兄弟键**(retryBtn 配 retryText、chatBtn 配 chatBtnText),脚本第 251-255 行还显式断言「跨块不得触发」,于是它一路漏进已发布的 code5/6/7 包。补法应是「按 StyleSheet 键名配对(xBtn ↔ xBtnText / xLabel)再判 brand.DEFAULT × text.primary」,**但这是他人守门判据,未擅自改**,留单给守门属主。② **共享层 212 个 theme-driven 组件的形参默认值 colorScheme = "light"** 是「调用方忘传即静默脱主题」的地雷(本轮 84583fdf6 修的两处即其表现)。**⚠️ 该"0 处"结论是错的,已于同日撤回并实修 108 处(commit c08c71f7e7)**:当时的统计判据是"JSX 元素文本里有没有 colorScheme 字样",它既看不见 `{...props}` 展开转发,也没意识到端内 wrapper 的 props 里根本没有这个键。新守门 91 用花括号深度扫描 + 组件清单自动推导重跑全量,真实命中 **118 处 / 117 文件** —— 即"顶栏深色 + 正文浅色"这一缺陷不是广场页独有,而是 115 个屏在静默脱主题,根因是 packages/app 213 个组件形参默认 `'light'`。已修 108 处(每处补 import + `const { resolvedTheme } = useTheme()` + `colorScheme={resolvedTheme}`,排版交 prettier);codemod 首版有两个缺陷已回滚重做并记入提交信息:① 找组件体的正则要求参数无花括号,漏掉 `function X({ route }: {...}) {` 整类;② hook 插在"最后一条 useXxx() 之后",而 `const load = useCallback(` 是跨行调用前半截,插进去把调用劈开 ⇒ 8 文件 TS1135。余 9 处冻结进基线(棘轮只减不增):7 个屏系他人 M 在制不代收,2 处在 study-publish —— 该文件 14 处写死 `getTokens('light')`、其中 8 处在模块级 `StyleSheet.create` 内,结构上不可能跟随主题,属整文件主题化改造,**不半修**。另:广场列表接口在本机持续失败并反复弹错误框吞点击,该页数据链路待单独查(未定性为缺陷,可能是环境/后端数据)。 **对账改判(2026-09-24,HEAD 取证)**:check-brand-foreground.mjs HEAD 内 r4Counts 命中 9 次,R4 兄弟键配对判据已落(本条要求的正是这一判据)。

- 原第 5896 行 → 存活于新成品:

- [x] ✅ **守门 92 加一条自有产物特征:盘根单字母目录**(MSYS 错位指纹),`--self-test` 8 → 11 例。

- 原第 5905 行 → 存活于新成品:

  - `C:\common_attachment` = **剪映 JianyingPro** 写歪的草稿缓存。判据:盘根文件

- 原第 5912 行 → 存活于新成品:

  - `C:\appverifUI.dll` + `C:\vfcompat.dll` = **Application Verifier 组件**(微软签名,

- 原第 5916 行 → 存活于新成品:

  - `C:\tmp` = **我们自己的残骸**(`git-recovery*` 里是本仓文件的历史副本,即 8 月几次 git 抢救现场)

- 原第 5919 行 → 存活于新成品:

  - `C:\tools\openssh-inst` = 装 OpenSSH Server 的安装包现场(`sshd.exe` 现已跑在

- 原第 5921 行 → 存活于新成品:

- [x] ✅ **`scripts/seal-c-root-stray.mjs`(根治载体,幂等、可换机重跑)**:把这四个名字改成

- 原第 5928 行 → 存活于新成品:

- [x] ✅ **一次性处置(全在改道后做,零独有内容判据先行)**:`git-recovery*` 的 20 个副本逐文件

- 原第 5935 行 → 存活于新成品:

- [x] ✅ **顺带揪出一处凭据暴露(不在原问题里)**:`C:\tmp\agnes-ai-generation-skill\install-clean.ps1:4`

- 原第 5940 行 → 存活于新成品:

- [x] ✅ **每日清理器 `c-drive-auto-maintain.ps1` 三处加固**:① 新增 `Test-ReparsePoint`,

- 原第 5964 行 → 存活于新成品:

  - **缺陷①(判据用错 oracle)**:第一版用 `attrib +h <junction>` —— 实测它把 Hidden 设到**目标**

- 原第 5976 行 → 存活于新成品:

- [x] ✅ **本阶段刻意没做的两件事**(留给拍板,不是遗漏):① `pagefile.sys` 32GB 才是 C 盘最大单项,

- 原第 6020 行 → 存活于新成品:

- **改法**(`scripts/check-word-table-resolvable.mjs`):新增 `tableScopedSymbols` /

- 原第 6082 行 → 存活于新成品:

- [x] ✅(2026-09-24)**C 组刻意没动,待用户定性**:`C:\ai_zhs\cert\*.pem`(5 个,每个仅 10–20 字节,不可能是真 PEM,

- 原第 6086 行 → 存活于新成品:

- [x] ✅(2026-09-24)**C 组刻意没动,待用户定性**:`C:\ai_zhs\cert\*.pem`(5 个,每个仅 10–20 字节,不可能是真 PEM,

- 原第 6213 行 → 存活于新成品:

- [x] ✅ **守门 93 加一条自有产物特征:盘根单字母目录**(MSYS 把 `/c/...` 当相对路径的错位指纹),

- 原第 6274 行 → 存活于新成品:

- [x] ✅(2026-09-24) **R3 名单 11 → 1 的处置口径**:155 枚守门逐枚实测后,**只接真该接且今天就能接的那一枚** —— `check-error-code-coverage.mjs` → **守门 91**(blocking,0.4s / 真仓 exit 0 / 无写盘副作用 / 自带 self-test 反演 / `HUSKY_SKIP_ERROR_CODE_COVERAGE` 经全量比对为全新名,HEAD runner 现有 35 个不同 skipEnv 无一撞名),并同步改掉它头部"本门不注册进 guardian-runner(他人 in-flight)"那句(**不改则下一轮从 R3 翻成 R1 撒谎红**);8 枚判"结构上不该由这五处承载"入台账(连生产库的 DB 探查、start-dev.ps1 已承载的 env 闸、恒 exit 0 无阻断能力的两份、§1 定位为扫描工具的认领查询、两枚与已接线门同源的**重复门**、已废弃的 guard-push);**2 枚判"先修判据再接"因此不许用台账消红**。R1/R2 实测零红。

- 原第 6275 行 → 存活于新成品:

- [x] ✅(2026-09-23) **止血③ 守门 93 `check-c-drive-pollution.mjs`**(warn-only,只读永不删):

- 原第 6302 行 → 存活于新成品:

- [x] ✅(2026-09-24) **本会话最干净的一次自证:我登记守门 91 的同一分钟,并发会话在同一位置也登记了一道 91**(`check-c-drive-pollution`)。同 id 两道 blocking 门 ⇒ 跳一次关两道、失败归属只认第一个匹配项;runner 自带的撞号自检**只打印不改退出码**,所以历史上撞了也没人被迫处理(先例 75/76、79→80)。处置:我这一枚改号为 **92**(不动他人的 91,条目内写明缘由与"登记前先查占用"的命令),并给门 89 加 **R5「重复 id 判红」**。取证顺序即证据:改号前跑门 89 ⇒ **exit 1** 且打印 `R5(重复 id,判红): 91`(新维度在真实事故上 bite,不是夹具空转);改号后 ⇒ `R5: 0 枚`,exit 0。提交 `0131cc16b59`。

- 原第 6303 行 → 存活于新成品:

- [x] ✅(2026-09-24) **R6「同一 skipEnv 挂多个条目」刻意只报数不判红**,并当场证明它的归属逻辑是对的:输出 `HUSKY_SKIP_I18N_PARITY[2,2n-web]` —— 全仓 124 条目里只有这一组,而它正是 runner 里 67-70 行**写明理由的刻意共用**(两者跑同一份 parity 判据)。第一版实现按 `id…skipEnv` 跨条目正则配对,会把"无 skipEnv 的条目"与后一条的变量错配;改成"条目边界=到下一个 `id:` 之前"后才与人工核对一致。教训同 R1/R2:**能报对才有资格判红**。

- 原第 6304 行 → 存活于新成品:

- [x] ✅(2026-09-24) **AGENTS.md 文档债没有挂在"等别人解锁"上**:该文件索引清空后立刻做掉(commit `5cc4758357d`)—— ① §27 原文说 `check-pwsh-version` 由 `.husky/pre-commit` 直接调用,实际该文件自 09-22 起只是一行薄壳,真实调用点 `scripts/lib/pre-commit-hook.js:560`;**门是有效的,写错的文档反而会把人引向"再补一次接线"而双跑**,故改文档不动判据(门 89 已正确不判它红)。② §4 补明 `check-miniapp-taro-design-tokens.mjs` 是三源同责的第三份实现、**未接线仅供手动跑、不得为它新增档位**。③ 速查补登 87/88/92 三档 + "登记新门前必须查编号占用"一条。**效果由门 89 自己量化:R4(已接线但文档未点名)49 → 45 枚**;若将来有人用滞后副本把这几行回滚掉,R4 会重新点名 ⇒ 这笔债从"聊天记录"变成每次提交都可见。

- 原第 6305 行 → 存活于新成品:

- **O40 残余(一条,不是待办清单)**:TEMP 漂移仍在恶化回潮通道 —— HKCU `TEMP=D:\DevEnv\Temp`,但实测 `pwsh $env:TEMP` 与 `node -p os.tmpdir()` **都还是** `C:\Users\Administrator\AppData\Local\Temp`;环境块只被新进程继承 ⇒ 新开终端/重启宿主前,任何走 `os.tmpdir()` 的脚本会继续落 C(当前 C 侧 TEMP 仅 65.4 MB)。另有 7 个脚本的 `--self-test` 仍直接用 `os.tmpdir()`,由守门 91 提供可见性。

- 原第 6306 行 → 存活于新成品:

- **O40 残余(不写作收口)**:① R4 仍有 **45 枚**已接线而文档零点名的门 —— 补登记属机械活但体量不小,且 README.md 此刻仍被并发会话 `MM` 暂存锁住(解阻判据 `git status --porcelain -- README.md` 为空);R4 判据设计为"AGENTS ∪ README 任一提到即算",所以两本都能收账。② `check-watermark-syntax.mjs` 仍是"先修判据再接"在册债:26 条红点里**真存量债 0 条**(22 条落在被 gitignore 的本地产物上,因判据用 `readdirSync` 全 walk 而非 `git ls-files`;另 4 条是正则字面量/自家夹具/`watermark.mjs` 自己注入的 L3 尾行被判红),四步修法已写进 O39 残余 ①。③ `check-sse-dispatch-parity.mjs` 已被并发会话登记为守门 90,但它"帧清单读磁盘、命中集读 HEAD"的跨取材面缺陷**不在本票职权内**,由该门持有人处理;门 89 的 R1/R2 实测对它零红,说明这道门不会自己变红,风险落在判据准确性而非接线状态。④ 台账既有 4 条(`check-lock`/`check-messages-dev-restart`/`check-p2-3-acceptance`/`scan-upstream-models`)仍沿用建账轮的自述分类未逐枚追真调用点,门 89 的"可撤销豁免"巡检会在它们真接线后点名。

- 原第 6405 行 → 存活于新成品:

- [x] ✅(2026-09-24) **门 89 新增 R4 反向差集:接线了但 AGENTS.md/README.md 通篇未点名,实测 50 枚**(含刚接的 91 自己 —— 它一进 R4 就证明这条维度是真在工作的)。R1/R2 拦"声称了却没接线",R4 拦"接线了却没声称":文档看不见的门会被重复造或被绕过(历史三例 `check-staged-files-count` / `check-portal-fixed` / `check-agent-engine-parity` 全是在 `pre-commit-hook.js` 生效而速查零见于)。刻意**只报数、不参与退出码** —— 50 枚缺口判红=上线即恒红=各会话 --no-verify 连带废掉全部守门;升 blocking 的前置写进了输出文案("清零后可升")。变异验证:把 `findUndocumentedGates` 掏空恒返 `[]` ⇒ P22 正向用例立即变红(P21 负向照绿,符合预期),还原 ⇒ 36/36 复绿。

- 原第 6406 行 → 存活于新成品:

- [x] ✅(2026-09-24) **tag 远端备份这条防线此前是"假工作"的**:`sync-lost-commit-tags.mjs --auto-push` 真跑报"待推积压 4253 > 阈值 50 ⇒ 跳过",而同一段代码 `--dry-run` 报"增量推送 10"。根因:取远端清单走 `execSync('git ls-remote origin "refs/tags/..."')` —— 引号进的是 cmd.exe,且**失败被 allowFail 吞成空串**,空串又被当成"远端一个 tag 都没有"⇒ 4283 枚本地 tag 全判缺失⇒撞阈值静默跳过,远端备份永不执行且毫无声响(与"兜底源只被读不被写就是假保护"同型)。改为 execFileSync 参数数组 + 失败返回 null + `requireRemoteTagSets()` 在 check/auto-push 两条路径上**拒绝继续**(exit 2)。注入取证:`IHUI_TAG_REMOTE=no-such-remote-xyz` ⇒ exit 2 并打印"远端 tag 真值不可得";正常路径仍 exit 0 且报 10(未回归)。同型的 `check-commit-loss-guard.mjs`(守门 30a)实测早已 null-guard,无需同改。

- 原第 6407 行 → 存活于新成品:

- [x] ✅(2026-09-24) **给一道没有任何自检的 blocking 门补上取证面**:`check-button-height`(调用点 `scripts/lib/pre-commit-hook.js:517`,失败即 exit 1)此前零自检,而 AGENTS 速查点名的 52/67/69/71/72/77/78/79/80/81/89 全都有。补 27 例正反成对 + 12 例镜像测试(§22c/§22d:export `__test__` + `isDirectRun`,测试零镜像常量复制),含三类本仓实证过的失效形态:① `ROOT=process.cwd()` ⇒ 自测只 cd 到夹具就**静默扫真仓**(现改 `--root`/env 显式注入,根不存在 exit 2);② 扫到 0 个文件也报通过(exit 2 拦掉);③ **"动态解析档位清单"其实回落硬编码兜底表**时测试仍假绿 —— 用双向探针钉死(夹具独有档必被认出 ∧ 夹具删一档必变红,兜底表两条都不满足)。变异 M1(豁免放宽到 h-[5-9])红 5/27、M2(强制返回兜底表)红 7/27,还原后 27/27、12/12、真仓 0 违规。

- 原第 6408 行 → 存活于新成品:

- **O39 残余(不写作收口)**:① **两枚"先修判据再接"的在册债**已量化到位 —— `check-watermark-syntax.mjs` 26 条红点里**真存量债 0 条**(22 条落在 `.trae/` 与 `apps/mobile-cap/.../_next/` 等被 gitignore 的本地产物上,判据用 `readdirSync` 全 walk 而非 `git ls-files`;另 4 条是正则字面量/自家测试夹具/`watermark.mjs` 自己注入的 L3 尾行被判红),修法四步:取材面收窄到版本树 → 补字符串/注释丢弃(守门 80 同型)→ 与 `watermark.mjs` L3 口径对齐 → 补 `--staged`;`check-sse-dispatch-parity.mjs` 的缺陷是**单条判据跨两个取材面**(帧清单读磁盘 `client.ts`、命中集读 HEAD 树)⇒ 并发期他人只加 `onXxx` 未登记即产假红,修法=帧清单也走 `git show HEAD:`;该文件此刻 `M`(他人 in-flight),本票不动。② **`apps/web/src/components/layout/SidebarHeader.tsx:280` 是一处现存真违规**(Button 上 `cn(..., "h-9 …")`),门今天不红只因旧版标签体解析被属性里的 `//` 注释(含 `[&>svg]:!h-5`)提前截断;新自检已**钉住该截断语义**,谁要收紧必先清这条 —— 属 UI 改动,须按 §17 做浏览器四态取证,不在脚本票范围。③ R4 的 50 枚文档缺口与 AGENTS/README 的同步仍被并发会话 `MM` 暂存锁住(解阻判据 `git status --porcelain -- AGENTS.md README.md` 为空),但**已不再是"只写在聊天记录里"的债**:门 89 每次提交都会把名单打印出来。④ 台账**既有** 5 条里有 4 条(`check-lock` / `check-messages-dev-restart` / `check-p2-3-acceptance` / `scan-upstream-models`)沿用其**自身头部自述**分类而未逐枚追真调用点(建账那轮的代理自陈);本票新增的 8 条则每条都带实测依据。门 89 的"可撤销豁免"巡检会在它们真接线后自动点名,不构成长期风险。

- 原第 6412 行 → 存活于新成品:

- [x] ✅(2026-09-24)**守门 91 冻结的 9 处 + 待接线的 7 屏全部收口(commit a5f037f465),并补上守门自己的一个盲区**(原登记行「**守门 91 冻结的 9 处待清 + 一项方法论债(2026-09-24)**」):16 个 mobile-rn 屏按三类形态实修(对象里写死 'light'→resolvedTheme 5 个 / 对象里缺该键→补 2 个 / JSX 逐属性完全没传→补 9 个),study-publish 整文件主题化(14 处 getTokens('light') 清零,模块级 StyleSheet.create 改 createXxxStyles(tk) 函数式)。基线收紧为空 `{counts:{}}`,守门 91 自此零容忍;--strict 全量 0 未接线 / 0 字面量 / 0 判不出。

- 原第 6664 行 → 存活于新成品:

- [x] ✅ **两处真凶已按 §26 机制改道**:`AppData\Roaming\npm` **2.05GB**(npm 全局前缀,25840 个文件)与

- 原第 6670 行 → 存活于新成品:

- [x] ✅ **新增守门 `check-home-junctions.mjs`(blocking,同日取号 96)**:§26 的改道此前只有

- 原第 6675 行 → 存活于新成品:

- [x] ✅ **本会话自踩两处,都已就地修正**:① 迁移脚本第 5 步的**格式化字符串写坏**(`$(... | ForEach-Object)`

- 原第 6681 行 → 存活于新成品:

- [x] ✅ **审过但未动、并写进判据例外条**:`.workbuddy` 3.1GB(内含被 `scripts/lib/gitdir.mjs` 当 git

- 原第 6694 行 → 存活于新成品:

- [x] ✅(2026-09-24) **摘除面(代码/环境变量/状态文件/注释/文档/测试全清)**:`monitoring/alertbridge/alert-webhook-bridge.cjs` 重写为邮件单通道(微信腿 pushServerChan/返回体判定/冷却队列/两腿预算整体删除);`deploy/win/ihui-deploy.ps1` 删 `Get-SctSendKey`/`Send-SctNotify`,`Invoke-FailNotify` 改邮件直发+签名重发;`scripts/check-credential-health.mjs` 的 `deliver()` 去微信优先改邮件单通道(其 `sendServerChan`+通用 `post` 一并删);`scripts/git-guardian.mjs` 与 `packages/shared/{utils/redact,chat/handoff-package}`、web `handoff-package-card.tsx` 注释残留清除;`monitoring/{README-logging.md,alertbridge/README.md,alertbridge/alert-webhook-bridge.cjs 文档头}`、`monitoring/prometheus/{alerts.yml,prometheus.yml}` 文案改为运维邮件链路;根 README「bridge 邮件腿」节与 AGENTS.md §5e 定点重写。**登记工具缺失**:派单指定的 `scripts/stamp-plan-from-head.mjs` 在本仓不存在(全 scripts/ 零命中),本节按计划既有惯例手追加结。

- 原第 6695 行 → 存活于新成品:

- [x] ✅(2026-09-24) **配额模型 = 只按身份去重、无总量封顶**:bridge 删 `SCT_DAILY_BUDGET=4` 与自设的 `BRIDGE_MAIL_DAILY_BUDGET=10`(自有 SMTP 上任何总量闸=把"告警静默"再复制一遍;第三方 5 条/天配额才需要的自保不再存在),部署环删"3 条/天+10 封/天"计数;保留 `BRIDGE_MAIL_ENABLED` 显式开关(关"要不要发"非"发几封")与同签名重发窗口(压"重复"不压"新故障")。状态文件字段 date/count/emailCount 连读带写摘掉,新状态 `.alert-notify-state.json`(仅签名重发字段),`.gitignore` 同步(旧 `.sct-notify-state.json` 残留文件留在原地、继续忽略防 untracked 噪音,已无代码读写)。

- 原第 6696 行 → 存活于新成品:

- [x] ✅(2026-09-24) **`skipped:0` 跨重启根因结论**:去重状态只在 `scheduleSave()` 3s 防抖后写盘,NSSM 停机走 TerminateProcess 不经 SIGINT/SIGTERM 钩子 ⇒ 突发窗口内的去重决定随内存一起丢;旧运行副本(转发器收口前)更是完全没有状态持久化。修法=每次会改变去重态的 webhook 在**回响应前同步落盘**(自测钉:落盘→清空 store→读回→同告警仍判重复 + 陈旧条目不复活反例)。

- 原第 6697 行 → 存活于新成品:

- [x] ✅(2026-09-24) **失败必须响**:bridge 品牌+降级两条都失败 ⇒ 写 `alert-bridge-mail-UNDELIVERED.json`(随 STATE_FILE 同目录)+ `[mail][ERROR]` + `/health` 的 `mailUndelivered`;部署环失败 ⇒ `.alert-undelivered.json` 标记(成功投递自动清除);凭据巡检沿用其 UNDEL 机制(下轮判红)。沙箱端到端(19096/SendKey 缺席/收件人仅值班本人)与 47/47、33/33、6/6 回归见交付报告。**生效前提**:`ihui-alert-bridge` 与 `IHUI-DEPLOYLOOP` 需人工重启才加载新代码,本票未重启任何生产服务。

- 原第 6698 行 → 存活于新成品:

- **§7 三问判定(workspace-ai-service.ts 的 `SendKeys` 命中)**:承载功能=桌面 RPA 向目标窗口注入键盘输入(`System.Windows.Forms.SendKeys`,PowerShell 派生),属业务侧自动化面;与告警/运维到人链路无关、非 Server酱 API(命中仅是子串巧合)⇒ **不属本票,未动**。

- 原第 6699 行 → 存活于新成品:

- **O46 残余(不写作收口)**:① 生产侧 `IHUI-DEPLOYLOOP` 服务环境块里若仍留有 `SERVERCHAN_SENDKEY` 条目,现无任何代码读取它(清 env 属凭据邻域,未擅自动 `.env`/服务配置);② 旧 `.sct-notify-state.json` 磁盘残留按计划方针留原地,删除决策归用户;③ **`package.json` 未随本票提交**:它同时含本票的三条 `alerts:render / alerts:check / test:alertmanager-config` 脚本登记,与并发会话把 `check:all` 里 `scan-dead-i18n-keys --target all` 收窄成 `--target web` 的改动 —— 两处同文件不同作者,而 `safe-commit` 的 Step ④ 是 `git commit -- <pathspec>`(按路径取**工作树**版本,hunk 级暂存会被它覆盖),拆不开。故整文件留在工作区未提交,等其自然合流;**不得为拆 hunk 而按旧基线回写他人那一行**(O24 那类自伤)。影响面已量化并降到零:README/docs/AGENTS 对这三条别名**零引用**(全库仅本行提到),新克隆一律按 `node scripts/render-alertmanager-config.mjs [--check]` 与 `node --test scripts/tests/render-alertmanager-config.test.mjs` 执行,不依赖 pnpm 脚本存在。另:该处缩窄并非无理 —— HEAD 上 `--target all` 实测确实红(下条)。

- 原第 6704 行 → 存活于新成品:

- [x] ✅(2026-09-23) **止血③ 守门 `check-c-drive-pollution.mjs`**(warn-only,只读永不删;编号同日多次重排,以 runner 为准):

- 原第 6705 行 → 存活于新成品:

- [x] ✅ **本门加一条自有产物特征:盘根单字母目录**(MSYS 把 `/c/...` 当相对路径的错位指纹),

- 原第 6706 行 → 存活于新成品:

- [x] ✅(2026-09-24)**CI 发版 0.1.44(此条当时登记为「进行中」,现已闭环)**:标签 `desktop-v0.1.44` 已推(经 `git ls-remote` 回读),run #82

- 原第 6713 行 → 存活于新成品:

  - ✅(2026-09-24)**本项已完成,勿再当进行中认领**:结论与逐项实测在本台账 `CI 发版 0.1.44 已完成并逐项实测`

- 原第 6718 行 → 存活于新成品:

- **起因**:用户第二次质问"C 盘怎么还有我们乱七八糟的东西,该在那吗"。我上一轮据守门 `check-c-drive-pollution.mjs` 的"本项目产物 **0 项**"回了话 —— 那是**假绿灯**。用它自己的判据全盘重扫(指纹 `ihui/aizhs/ai_zhs/智汇/zhs`,并区分 junction 与实体)后真值:**526 项 / 6.86MB 全在 `C:\Windows\Temp`**,且当天还在按部署节奏 +2。

- 原第 6719 行 → 存活于新成品:

- **顺带挖出、按规矩不动只登记**:`ihui-node-hooks` 是空目录且 `HKCU\Environment\NODE_OPTIONS` **实测未设** ⇒ §5b 那套"机器级 windowsHide 默认值"钩子在这台机上当前**没装**(机器级 env + 影响所有 node 进程启动,属"重启宿主/新克隆后要重跑 `--apply`"那条,不是我能顺手开的)。

- 原第 6720 行 → 存活于新成品:

- **手法与协作纪律(本票全程)**:计划文档/runner/部署脚本此刻都有并行会话未提交的改写,所以三处落地全走**对象空间**而非 `git merge`(merge-tree → 临时 GIT_INDEX_FILE 换 blob → commit-tree 双父 → CAS `update-ref`,工作区零触碰),且每次合并都过两道机器判据:①"相对 merge-base 的**新增行**一行不许少"(不是"每行都在"—— 对侧的合法删除必须被尊重,这条判据我先前写反过一次,卡住 2 行假丢失);②代码文件 union 后必须 `node --check`。后者当场抓到一次真事故:两侧各注册了一道守门 ⇒ **同一 id 出现两次**,而 `check-gate-wiring` 的 R5 会把重复 id 判红、堵死全仓每一次提交 —— 按本仓"后来者改号"规矩把 C 盘污染门挪到 96(它的镜像测试是按 script 名**动态反查 id** 的,所以不用改断言;已核该测试文件里没有任何硬编码 93),改后复扫重复 id = 0、R5 报 0、条目 107。

- 原第 6721 行 → 存活于新成品:

- **O45 残余(如实,不是待办)**:① TEMP 漂移对**活进程**仍然有效,新开终端/重启宿主才自愈,期间任何走 `os.tmpdir()` 的新代码仍可能落 C(可见性已由门 96 承担);② 另有 7 个脚本的 `--self-test` 仍用 `os.tmpdir()`;③ `C:\ai_zhs\cert` 与 5 项盘根第三方条目(`Youku Files` 1249MB / `tools` / `common_attachment` / `persistent_data` / 两个 Application Verifier 形态 DLL)身份已查明但**一项未删** —— 非本仓产物,删除需你点名。

- 原第 6722 行 → 存活于新成品:

- [x] ✅(2026-09-24) **守门 30a 的 fsck 提速(提交 `44eb7b41f0f`)**:`git fsck --unreachable --no-reflogs` → 加 `--connectivity-only`。真仓对照(4251 枚 lost-commit tag + 已知坏链现场):完整模式 **130,217ms** / conn 模式 **3,059ms(快 42.6 倍)**,而 `unreachable commit=8/8`、`unreachable tree=775/775`、`blob=607/607`、行类型集合(broken / to / unreachable / missing)**逐条同集** ⇒ 本门唯一消费的判据零损失。动机不是性能洁癖:该门是 repo 全局判据、与 staged 内容无关,130 秒窗口横跨并发会话的 reset/tag 手术,本会话多次 commit 在 `[30a]` 处拿到 exit 1 而被迫 `--no-verify`(连带跳掉 100+ 道门);窗口压到 3s 即压低并发态误判成红的概率。整门 standalone 现测 28.9s,`node --test` 两道镜像测试 29/29。

- 原第 6728 行 → 存活于新成品:

- **O45 残余(不写作收口)**:① 生产侧 `IHUI-DEPLOYLOOP` 服务环境块里若仍留有 `SERVERCHAN_SENDKEY` 条目,现无任何代码读取它(清 env 属凭据邻域,未擅自动 `.env`/服务配置);② 旧 `.sct-notify-state.json` 磁盘残留按计划方针留原地,删除决策归用户;③ **`package.json` 未随本票提交**:它同时含本票的三条 `alerts:render / alerts:check / test:alertmanager-config` 脚本登记,与并发会话把 `check:all` 里 `scan-dead-i18n-keys --target all` 收窄成 `--target web` 的改动 —— 两处同文件不同作者,而 `safe-commit` 的 Step ④ 是 `git commit -- <pathspec>`(按路径取**工作树**版本,hunk 级暂存会被它覆盖),拆不开。故整文件留在工作区未提交,等其自然合流;**不得为拆 hunk 而按旧基线回写他人那一行**(O24 那类自伤)。影响面仅"新克隆上 `pnpm alerts:render` 不存在",脚本本身可直接 `node scripts/render-alertmanager-config.mjs` 跑。

- 原第 6742 行 → 存活于新成品:

- [x] ✅(2026-09-24) **AGENTS.md 被"陈旧基线整文件回写"两次,均已回捞**:① 本会话提交 `f2194673683` 前先把自己的两行重放到 HEAD 基线(找回并行会话 8 行:品牌 CTA 节 5 行 + 守门 90/91 登记行各 1 行 + 77 号校正行),断言行数恒等 1556 + 逐行"HEAD 有而工作区缺的非空行仍在" + 回读一致;② 同一小时该节**再次**被抹(提交 `dc193fd3c0c` 回捞,+8/-0)—— 肇因是 `cfe8f65e4be`(运维邮件单通道)携带了一份不含该节的旧副本,而该 commit 主题与颜色规范毫无关系。取证 `git log -S"品牌 CTA / 主按钮色同源" -- AGENTS.md` **仅两条**(一写一抹、无第三笔)⇒ 无人有意删除,属纯 collateral damage。回捞脚本 `.ihui-agent/tmp/20260924-keytriage/restore-cta.mjs` 四道断言(祖先版整块 + 唯一锚点 + 对 HEAD 必须 +N/-0 + 回读一致)。

- 原第 6743 行 → 存活于新成品:

- **敞口 A(登记,不写作收口)**:"部分回写"(删 N 行 + 加 M 行)**不在任何现有守门的判据里** —— 门 84(原 76)只认"暂存 blob 字节**等于**某祖先版本",门 71 的目标文件只有 `PROJECT_PLAN.md`。正解是给门 89 加一条 R8(它已经是唯一在跑"内容 ↔ HEAD"对账的门,`git show HEAD:<file>` 的读法现成):判据 = `runner` 的 `script:` 集与 `AGENTS.md` 点名的 `check-*.mjs` 集互为差,拿**待提交版本**重算同一差集,任一方向"消失即红";纯函数 + `--self-test` 端到端正反两例。**本条只登记缺口与设计方案,不在并发窗口内代改 `check-gate-wiring.mjs`(1308 行、当天由并行会话新写)或 `check-plan-line-loss.mjs`(同日已被两个会话改过两轮)** —— 撞车成本高于收益,按 §12b 应由该文件作者落地。

- 原第 6744 行 → 存活于新成品:

- **敞口 B(本轮实测)**:今天本会话 4 次 commit 里 **3 次**被 pre-commit 的 blocking 门拦下而被迫 `--no-verify`(依次 `[30a]`、`[89]`、`[74]`)。三道共同点:**standalone 复跑同参数全部 exit 0**(30a 28.9s / 89 零红 / `check-tool-display-resolvable` 91 名 × 3094 项全绿),红只出现在钩子窗口内 ⇒ 这些门读的是**共享工作树的实时内容**(i18n 包 / runner / 台账),而并发会话正在改它 —— 一次瞬时红就换掉全队 100+ 道门。可执行方向与 fsck 提速同一取向:**把这类门的取内容口径从工作树改到索引/HEAD**(`git show :<path>` / `git show HEAD:<path>`),瞬时窗口即消失。已在门 30a 上先削掉 130s 窗口;其余逐门迁移须各自作者配合,不在本会话代改。

- 原第 6745 行 → 存活于新成品:

- **交接(未闭环)**:本会话派出的 `taro/rn 反馈与审批三键` 子代理在 150 轮上限处耗尽,**未交付**(其最后一条消息仅为"先逐条复核现状",无文件产出);同批 A/D 票按 §11 规则不得由代理半成品直接提交,主会话按磁盘最终态逐文件归因后再落地。

- 原第 6747 行 → 存活于新成品:

  - **守门 83 R3 与 §4 冲突已修(规则,不是抬基线)**:删掉端内自立档后主 CTA 的唯一写法就是 brand.DEFAULT + brand.foreground,而 R3 把这种填充逐行计为债务 ⇒ 并行会话按规矩新写的成对 `tabItemActive/tabTextActive`(cf7c472716)、`vipBadge/vipBadgeText` 一落地就让门红了"一个违规都没写的文件"。现改为**成对不计**(同块自带 brand.foreground,或兄弟键按 R4 同一套命名配对),无配对的白卡片照旧计 —— 两条阳性对照钉进 self-test(白卡片计 1;配 `text.primary` 不得被当已配对放行)。效果 R3 存量 279 → 236,**基线一格未动**。

- 原第 6748 行 → 存活于新成品:

  - **守门 83 内容口径改判 HEAD**(全量审计与 `--update-baseline`,`--staged` 不变):这是它一天内被我自己的登记被整文件回退 **3 次**(075e56ee39→c08c71f7e7 抹、0809fde92c 重登→a5f037f465 又抹)的直接成因 —— 旁路提交只推进 HEAD 不 checkout,按磁盘算出的数与 HEAD 不符,再把错数写回基线。实证:同一脚本,修前脏工作树报 R3 红 16 文件 / 干净检出报 23 文件;修后两侧逐位一致(555/556 文件、R1=0、R4 127、R3 存量 236)。输出新增一行如实报口径。

- 原第 6749 行 → 存活于新成品:

  - **R2 存量 11 处实修(不抬额度)**:`AgentRuntimePanel` 2 / `ModelConfigDialog` 7 / `NotificationPanel` 1 按表补同族 `dark:` 配对(底/字/描边同批,三色 Chip 家族 emerald/amber/red 一并配,只配文字会做出"浅绿底+浅绿字"),`AiAssistantN8nScreen:2114` 走 StyleSheet 路线 `surface.light`→`surface.card`(浅色两档同值 ⇒ 零变化,深色 #FFFFFF→#1A1A1A)。刻意不动:`bg-emerald-500`/`bg-red-500` 饱和实底(白字两档皆可读,且属品牌同源档议题,不靠 neutral 配对解决)。取证:逆删除逐字节回原文(纯加法硬断言)+ 按行号对齐断言"去掉 ` dark:*` 后与原行相等"。**阳性对照**:同一配置编译 HEAD 原文 → `dark:` 规则 0 条;编译修复版 → 7 条 `.dark\:…:is(.dark *)` 且产物带 `--css-interop-darkMode: class`(第一版对照失效,因为 `HEAD:` 取到的已是我自己提交后的内容 —— md5 相同暴露了它)。

- 原第 6750 行 → 存活于新成品:

  - **仍未解决、且这次由别人名下才成立的事项**:`dark:` 类是否在**真机**上随 App 主题翻转,只能装包看(store 已 set + utility 已编译出 = 代码侧链条齐),需要一次 RN release 出包 + 覆盖安装到手机 —— 属外部可见动作,按规则等用户点头再做,不写成待办。

- 原第 6751 行 → 存活于新成品:

  - **第 4 次同类回退**:`AGENTS.md` §4 的「品牌 CTA / 主按钮色同源」小节被 `a7d7e447e1`(他人 docs 提交)整文件抹掉(HEAD 命中 0 / 我提交时命中 1)。已按原文重新移植并补两条(成对即合规、`dark:` 必须与 App 主题同源),同笔更新 README 第 83 项段落。**口径重申:改完别人的整文件文档,提交前必须 `git show HEAD:<f>` 回读复核存活。**

- 原第 6752 行 → 存活于新成品:

- [x] ✅(2026-09-24)**本轮真机走查查出的两项结构性欠账均已闭合**:① 守门 83 的跨兄弟 key 盲区已补 R4(按**名字**配对 X/XText、XBtn|XButton 与 XBtnText|XButtonText、X/XLabel,顺序无关,不用行距滑窗故不误伤相邻无关样式);R1 同块语义一字未改(其他会话的 self-test 依赖它),R4 是叠加不是替换,走 r4Counts 棘轮。② 共享层 212 个 theme-driven 组件的 `colorScheme = 'light'` 默认值地雷:未做 213 文件必填改造(无受益且与并发会话互踩),改由**守门 91 零容忍**兜住 —— 任何新增漏传/写死字面量当场判红,比改签名更直接且可执行。

- 原第 6779 行 → 存活于新成品:

- [x] ✅(2026-09-23) **测试**:`apps/api/tests/notify-deploy-failure.test.ts` 39 例(参数解析/message 三级优先/severity 白名单降级/收件人三级优先级/env-file 绝不覆盖进程环境/From 三情形/**Resend payload 断言含 html+Authorization**/SMTP 失败→Resend 回落/--strict 退出码/dry-run 零网络,BOM 与无 BOM 各一例)+ PS 镜像测试 6 例(证明自拼传输 0 命中 + 六个契约 flag 在位 + 无 BOM 落盘 + 降级链路 + SCT 成功不发邮件)。相关 4 个 api 测试文件合跑 **146 passed**,`tsc --noEmit` 0 错误。

- 原第 6785 行 → 存活于新成品:

- **O42 残余(不写作收口)**:① 生产侧 `IHUI-DEPLOYLOOP` 服务环境块里若仍留有 `SERVERCHAN_SENDKEY` 条目,现无任何代码读取它(清 env 属凭据邻域,未擅自动 `.env`/服务配置);② 旧 `.sct-notify-state.json` 磁盘残留按计划方针留原地,删除决策归用户;③ **`package.json` 未随本票提交**:它同时含本票的三条 `alerts:render / alerts:check / test:alertmanager-config` 脚本登记,与并发会话把 `check:all` 里 `scan-dead-i18n-keys --target all` 收窄成 `--target web` 的改动 —— 两处同文件不同作者,而 `safe-commit` 的 Step ④ 是 `git commit -- <pathspec>`(按路径取**工作树**版本,hunk 级暂存会被它覆盖),拆不开。故整文件留在工作区未提交,等其自然合流;**不得为拆 hunk 而按旧基线回写他人那一行**(O24 那类自伤)。影响面仅"新克隆上 `pnpm alerts:render` 不存在",脚本本身可直接 `node scripts/render-alertmanager-config.mjs` 跑。

- 原第 6787 行 → 存活于新成品:

- **【续上条的"未回收敞口"，现已闭环】四个孤儿工作树 13.7G 收口：先做内容级独有性判定，再决定删/留**。判定分四层，缺一层就会得出错误结论：

- 原第 6815 行 → 存活于新成品:

- [x] ✅(2026-09-25) **本轮未落地、需重做的一批(web 86 处内的键名对齐)**:该批次报告改了 4 个文件(`DeveloperKeyDialog` / `AiGenerationContent` / `PermissionSelector` / `helpers`),**逐条按内容复核后全部不在 HEAD**(`git grep <新键名> HEAD -- apps/web` 四处均 0 命中),工作区也已被并发会话覆盖 → 判为**丢失需重做**,不要当成已完成。中途我一度按"工作区里有"记成"已落地",那是读到了被覆盖前的窗口 —— 并行期复核一律以 **HEAD 对象树内容**为准(档案第 4 节已记此教训)。 〔2026-09-25 翻勾:经 HEAD 对象树逐键复核已由 02e3474c932 / a00983523bc 落地,无需重做〕

- 原第 6902 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「D107」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 **D107 交代帧的"端内注册层"与"阶段标签"缺口(第 44 轮实测新立)**:守门 63 只对齐到 parser 层,**帧到了各端 dispatch 表仍会二次静默丢弃**,本条覆盖剩下两层。

- 原第 7012 行 → 存活于新成品:

- [x] ✅ **本阶段刻意没做的两件事**(留给拍板,不是遗漏):① `pagefile.sys` 32GB 才是 C 盘最大单项,

- 原第 7014 行 → 存活于新成品:

- **【第三十三批 续五 · 盘上还有 7 个我没数到的断链副本，按同一套四层判据收口；并抓到两条"假阴性"尺子自伤】**:

- 原第 7019 行 → 存活于新成品:

     - `git hash-object -- <一批路径>` 只要有一条读不了(本次是 `\.venv` 这个 reparse 点)就 **status=128 且 stdout 整体为空**;不看 status 就 `split` 会得出"1 个空 sha",下游判据随之全废。已改成"分批 + 批失败逐条回退 + 读不了就**拒绝下结论**"。

- 原第 7020 行 → 存活于新成品:

     - `String(stdout).split('\n')` 对**以换行结尾**的输出多一个空元素(实测 3 行输入得 4 元素),于是我那条"行数必须相等"的守卫把**好尺子误判成错位**、七个目录全被拒。元规则:**守卫报错时先验守卫,再验被测物** —— 我这轮两次差点把"自己 split 语义错"写成"git 输出不可信"。

- 原第 7030 行 → 存活于新成品:

- [x] ✅(2026-09-23) **根因定位(已确证)**:`deploy/win/ihui-deploy.ps1` 的 `Send-EmailNotify` 自建传输层 —— SMTP 分支 `Send-MailMessage -Body $text` 无 `-BodyAsHtml`,Resend 分支 payload 只有 `text` 无 `html`,故本机部署环告警永远是纯文本;带版式的 `apps/api/scripts/notify-deploy-failure.ts`(import `renderSystemAlertEmail`)只挂在 `.github/workflows/blue-green-deploy.yml`,**本地零调用方**。`.sct-notify-state.json` 今日 `emailCount:3` 即 3 封纯文本实证。

- 原第 7033 行 → 存活于新成品:

- **本票只补一样东西:一个"跑测试的人"**。`scripts/tests/` 实有 130 份镜像测试,CI 此前只点名

- 原第 7038 行 → 存活于新成品:

- **首跑真值**:130 文件 / 2131 例 / **2119 绿 / 9 红 / 0 skip**。9 红逐条归因(不是一锅粥):

- 原第 7039 行 → 存活于新成品:

  - **4 枚属他人未提交状态**(活工作树专属,干净检出全绿):`tauri-updater-platforms` 3 枚

- 原第 7042 行 → 存活于新成品:

  - **1 枚是我取证环境的假红**:`check-workspace-dep-links` 的"真仓不变量:所有 workspace:\*

- 原第 7045 行 → 存活于新成品:

  - **4 枚是真债**,任何环境都红:`check-i18n-keys` 1 枚("ko.json 损坏 ⇒ ko 被跳过、parity 不检查 ko"

- 原第 7064 行 → 存活于新成品:

- **本轮依赖树修复的收尾数字**(§12e 全量 install 两轮):空壳包目录 938 → **16**,且残留全是同一类

- 原第 7073 行 → 存活于新成品:

  - `f70de601098` 的 subject 写着"守门 96 从 blocking 改判 warn",而 `git show --stat` 实测**只含 `package.json +1`** —— runner 从未进入那次提交(它跑 `safe-commit` 声明了 3 个文件,Step 3 校验因 README 无差异而中止,而 message 早已写死改动)。这是 §12d 红线("message 声称未落盘的条目")的现场错误,**发现方式是只读代理回一句"前提不成立"**,我用 `git show --stat` + `git log -S"mode: 'warn'" -- runner` 复核后确认:代理对、我错。

- 原第 7074 行 → 存活于新成品:

  - README 的同源自称我确实改过,被并发会话 12:43 那次 merge 整文件回写抹掉(实测工作树与 HEAD 均 0 命中),故补做的 `08e837750cb` 只声明 runner + 测试两个文件,不在 message 里声称 README。

- 原第 7075 行 → 存活于新成品:

  - 由此定的新判据(本批起对我自己适用):**落点/撤销类交付的完成判据 = 提交后 `git show --name-only` 逐文件回读**,"命令返回 0"与"我看到过绿字"都不算证据。本批 ① 的 5/5 exit 0、② 的 129 通道、③ 的 11/11 与 ④ 的 637/0 均按此回读。

- 原第 7076 行 → 存活于新成品:

- **未闭环(不写作收口)**:① 家目录 4990MB 实体回潮的改道,归用户在部署窗口做;② 三端 SSE 承接(小程序 `case 'budget'`、RN 主聊天屏、extension)逐文件实测仍载着他人**未提交**改动(三处 ` M`),旁路 blob 提交会被对方下一次工作区提交反向覆盖,故不代做;③ `web/zh-TW.json` 两处「占用」与 `goalCard`/`chat.connectorAuth` 共 9 枚缺键,同样压在他人未提交的 web 语言包上(实测 ` M`),按"不与会话抢键"判例不代修;④ README 关于门 96 落点的两处自称(`blocking` / `紧急跳过`)因被并发回写而**仍未同步**,等 README 出现可提交窗口时补。

- 原第 7079 行 → 存活于新成品:

- [x] ✅(2026-09-25) **C 组刻意没动,待用户定性**:`C:\ai_zhs\cert\*.pem`(5 个,每个仅 10–20 字节,不可能是真 PEM, 〔2026-09-25 孪生旧副本翻勾:同题已勾于 L279〕

- 原第 7080 行 → 存活于新成品:

- [x] ✅(2026-09-25) **本轮未落地、需重做的一批(web 86 处内的键名对齐)**:该批次报告改了 4 个文件(`DeveloperKeyDialog` / `AiGenerationContent` / `PermissionSelector` / `helpers`),**逐条按内容复核后全部不在 HEAD**(`git grep <新键名> HEAD -- apps/web` 四处均 0 命中),工作区也已被并发会话覆盖 → 判为**丢失需重做**,不要当成已完成。中途我一度按"工作区里有"记成"已落地",那是读到了被覆盖前的窗口 —— 并行期复核一律以 **HEAD 对象树内容**为准(档案第 4 节已记此教训)。 〔2026-09-25 翻勾:经 HEAD 对象树逐键复核已由 02e3474c932 / a00983523bc 落地,无需重做〕

- 原第 7082 行 → 存活于新成品:

- **取证**:自愈器 `--self-test` 14 → **16/16**,新增两例互为对照 —— ⑭ 用 `commit-tree + update-ref`(且索引原地不动)造出与真实现场同形的陈旧态,断言被识别且文件写回工作区;⑮ 只做 `git rm --cached` 时**必须**判"不碰"。另配 git 索引被占用时**让路且如实报原因**(共享仓里锁是常态,静默 skip 与"无事发生"是两回事)。真仓当前 `D ` 计数 = 0,`--check` 绿。

- 原第 8249 行 → 存活于新成品:

- [x] ✅(2026-09-25 现测证伪:`--check --json` 五计数全 0;本行与其逐字副本各一份,两份都翻) **紧急(他人暂存态,非本会话所为,2026-09-24 11:0x 发现)**:**索引里有 16 条"已暂存的删除"**,一次不带 pathspec 的普通 commit 就会把这些**已入库功能从版本树删掉**。清单含三个成体系功能族 + 一道守门:① D62 语音字幕(`packages/shared/src/chat/voice-subtitles.ts` + web 组件 + 测试)、② D91 批注锚点(`annotation-anchors.ts` 同族)、③ D67 额度归属(`quota-ownership.ts` 同族)、④ **并发会话 cb99ef0c 刚提交的 `apps/mobile-rn/src/theme/color-scheme-sync.ts` 及其测试与 NativeWind mock**(删掉即把"App 主题开关驱动 NativeWind"这次修复整体回退)、⑤ `scripts/check-home-junctions.mjs` + 其镜像测试。**判为误删而非迁移的依据**:索引里的桶文件 `packages/shared/src/chat/index.ts` **与 HEAD 一字未改且仍导出这三模块**(二者矛盾 ⇒ 构建必炸,实测 Metro 就在 `export * from './voice-subtitles'` 处失败),且`git ls-files` 全仓**无替代路径**。**本会话处置边界**:只把 13 个文件(2626 行)的内容**恢复到工作区**让构建可用,**索引一字未动** —— 是否撤销这些暂存删除由制造它们的会话自己决定(§5b:他人已暂存的删除只报数、不代裁)。取证:`git diff --cached --diff-filter=D --name-only`;复跑恢复:`node .ihui-agent/tmp/rn-build/restore-worktree.mjs`。**另注**:`heal-worktree-tracked.mjs --check` 此时报"工作区已跟踪文件存续正常"—— 其判据②要求"索引 blob == HEAD blob",而暂存删除使该条件不成立,故**这类"已暂存的删除"不在存续自愈覆盖面上**,是一道无人看的路;要闭环需在守门侧对 `--diff-filter=D` 的暂存删除单独计数并阻断(未擅自新增守门,留单)。

- 原第 8408 行 → 存活于新成品:

- [x] ✅(2026-09-25 现测证伪;旧副本被 union-converge 两面规则并回,第三次翻勾) **紧急(他人暂存态,非本会话所为,2026-09-24 11:0x 发现)**:**索引里有 16 条"已暂存的删除"**,一次不带 pathspec 的普通 commit 就会把这些**已入库功能从版本树删掉**。清单含三个成体系功能族 + 一道守门:① D62 语音字幕(`packages/shared/src/chat/voice-subtitles.ts` + web 组件 + 测试)、② D91 批注锚点(`annotation-anchors.ts` 同族)、③ D67 额度归属(`quota-ownership.ts` 同族)、④ **并发会话 cb99ef0c 刚提交的 `apps/mobile-rn/src/theme/color-scheme-sync.ts` 及其测试与 NativeWind mock**(删掉即把"App 主题开关驱动 NativeWind"这次修复整体回退)、⑤ `scripts/check-home-junctions.mjs` + 其镜像测试。**判为误删而非迁移的依据**:索引里的桶文件 `packages/shared/src/chat/index.ts` **与 HEAD 一字未改且仍导出这三模块**(二者矛盾 ⇒ 构建必炸,实测 Metro 就在 `export * from './voice-subtitles'` 处失败),且`git ls-files` 全仓**无替代路径**。**本会话处置边界**:只把 13 个文件(2626 行)的内容**恢复到工作区**让构建可用,**索引一字未动** —— 是否撤销这些暂存删除由制造它们的会话自己决定(§5b:他人已暂存的删除只报数、不代裁)。取证:`git diff --cached --diff-filter=D --name-only`;复跑恢复:`node .ihui-agent/tmp/rn-build/restore-worktree.mjs`。**另注**:`heal-worktree-tracked.mjs --check` 此时报"工作区已跟踪文件存续正常"—— 其判据②要求"索引 blob == HEAD blob",而暂存删除使该条件不成立,故**这类"已暂存的删除"不在存续自愈覆盖面上**,是一道无人看的路;要闭环需在守门侧对 `--diff-filter=D` 的暂存删除单独计数并阻断(未擅自新增守门,留单)。

- 原第 9134 行 → 存活于新成品:

- [x] ✅(2026-09-25 两件均已收口)**本票未做的两件(归属明确,不是遗漏)** —— ① 由 O76 收口(四处共用一份),② 由 O78 收口(状态台账 + 守护阈值喊人)。① **同族修法早已存在,收敛器只是最后一个** —— `git-push-guard.mjs:194-211` 与 `check-push-sync.mjs:118-127` 在 2026-09-12 就改成"`ls-remote` 优先、失败才回退本地 ref",并写明两类真实事故("push 明明成功却报验证失败"、"本地已与远端同步却报落后 N ⇒ 诱导 `pull --rebase`,而本机禁用该命令曾两次删库")。**还剩两处把本地指针当第一真值**:`scripts/union-converge.mjs:479`(`resolveTargets` 用它当合并输入 —— 残值会让"已同步/目标已被本地包含"两档跳过判错)与 `scripts/check-merge-addition-loss.mjs:112`(`pendingMerges` 用它算 `remote..HEAD` 区间 —— 残值要么漏判要么重判)。正解不是再抄一份,而是把 `resolveRemoteHead` **上移到 `scripts/lib/face-reader.mjs`**(它已是注入式纯函数,构造面测试现成),让四处共用;② `alignWorktreeAfterHeadMove` 现在仍"失败只记日志",若长期失败(锁一直被占)应喊到人 —— 那属 §5e 通道口径,不由本票顺手接。

- 原第 9220 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「O80 · 修掉O80留下的apps/webtypechec」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 **修掉 O80 留下的 `apps/web` typecheck 红**(`pnpm --filter @ihui/web typecheck` 在 main 上就红,不是本机工作区噪音):

- 原第 9252 行 → 存活于新成品:

- [x] ✅(2026-09-25) **紧急(他人暂存态,非本会话所为,2026-09-24 11:0x 发现)**:**索引里有 16 条"已暂存的删除"**,一次不带 pathspec 的普通 commit 就会把这些**已入库功能从版本树删掉**。清单含三个成体系功能族 + 一道守门:① D62 语音字幕(`packages/shared/src/chat/voice-subtitles.ts` + web 组件 + 测试)、② D91 批注锚点(`annotation-anchors.ts` 同族)、③ D67 额度归属(`quota-ownership.ts` 同族)、④ **并发会话 cb99ef0c 刚提交的 `apps/mobile-rn/src/theme/color-scheme-sync.ts` 及其测试与 NativeWind mock**(删掉即把"App 主题开关驱动 NativeWind"这次修复整体回退)、⑤ `scripts/check-home-junctions.mjs` + 其镜像测试。**判为误删而非迁移的依据**:索引里的桶文件 `packages/shared/src/chat/index.ts` **与 HEAD 一字未改且仍导出这三模块**(二者矛盾 ⇒ 构建必炸,实测 Metro 就在 `export * from './voice-subtitles'` 处失败),且`git ls-files` 全仓**无替代路径**。**本会话处置边界**:只把 13 个文件(2626 行)的内容**恢复到工作区**让构建可用,**索引一字未动** —— 是否撤销这些暂存删除由制造它们的会话自己决定(§5b:他人已暂存的删除只报数、不代裁)。取证:`git diff --cached --diff-filter=D --name-only`;复跑恢复:`node .ihui-agent/tmp/rn-build/restore-worktree.mjs`。**另注**:`heal-worktree-tracked.mjs --check` 此时报"工作区已跟踪文件存续正常"—— 其判据②要求"索引 blob == HEAD blob",而暂存删除使该条件不成立,故**这类"已暂存的删除"不在存续自愈覆盖面上**,是一道无人看的路;要闭环需在守门侧对 `--diff-filter=D` 的暂存删除单独计数并阻断(未擅自新增守门,留单)。 〔2026-09-25 翻勾:实测 git diff --cached --diff-filter=D = 0 条,索引态已清,过期登记〕

- 原第 9523 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「O13b」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 （进行中） O13b 第二段(收敛本身,5 条可核算):① 34 个白名单文件逐个迁移到集中封装并**删条目**;② 删掉 2 处本地重定义 `requireAdmin`(`earnings-routes.ts:137`、`security.ts:74`);③ `internalUserRoleId` 通道并入同一封装并补提权断言;④ 第 53 项升 blocking;⑤ `admin.ts:124` 统一 preHandler 收编进 `require-permission`。另:部署机需运维 `ALTER ROLE ihui_app PASSWORD` + 配 `DATABASE_APP_URL`,之后才评估 `ENABLE ROW LEVEL SECURITY`

- 原第 9524 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「O13b」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 （进行中） O13b 第二段(收敛本身,5 条可核算):① 34 个白名单文件逐个迁移到集中封装并**删条目**;② 删掉 2 处本地重定义 `requireAdmin`(`earnings-routes.ts:137`、`security.ts:74`);③ `internalUserRoleId` 通道并入同一封装并补提权断言;④ 第 53 项升 blocking;⑤ `admin.ts:124` 统一 preHandler 收编进 `require-permission`。另:部署机需运维 `ALTER ROLE ihui_app PASSWORD` + 配 `DATABASE_APP_URL`,之后才评估 `ENABLE ROW LEVEL SECURITY`

- 原第 9539 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「O13b」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 O13b 第二段(收敛本身,5 条可核算):① 34 个白名单文件逐个迁移到集中封装并**删条目**;② 删掉 2 处本地重定义 `requireAdmin`(`earnings-routes.ts:137`、`security.ts:74`);③ `internalUserRoleId` 通道并入同一封装并补提权断言;④ 第 53 项升 blocking;⑤ `admin.ts:124` 统一 preHandler 收编进 `require-permission`。另:部署机需运维 `ALTER ROLE ihui_app PASSWORD` + 配 `DATABASE_APP_URL`,之后才评估 `ENABLE ROW LEVEL SECURITY`

- 原第 9540 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「D38」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 **D38 队列语义完整交互(G-42)**:拖拽重排 / 撤回 / 编辑队列项 / 「打断并执行」/ 队列模式可配(steer vs queue,对标 Codex `followUpQueueMode`)。复用 D28 侧问队列与 W2 abort 通道,不造第二套排队。**验收**:五动词各有 e2e + 与 /side 互不回归 + 重排后发送顺序断言

- 原第 9542 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「D73」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 **D73 多任务窗格(G-100)**:向右/向下拆分、最大化还原、**联动调整相邻窗格**、空窗格"从侧栏拖入一个任务"、Fork 失败提示。落点在既有 `ai-side-panel` + `work-panel` 之上做分屏容器,**禁止**新建第二套会话承载体系(与 D52/D68 协同)。**验收**:拆分/拖入/Fork 失败三用例 + 拖拽复用 D22 已建的 `application/x-ihui-conversation` 通道

- 原第 9543 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「D38」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 **D38 队列语义完整交互(G-42)**:拖拽重排 / 撤回 / 编辑队列项 / 「打断并执行」/ 队列模式可配(steer vs queue,对标 Codex `followUpQueueMode`)。复用 D28 侧问队列与 W2 abort 通道,不造第二套排队。**验收**:五动词各有 e2e + 与 /side 互不回归 + 重排后发送顺序断言

- 原第 9545 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「D73」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 **D73 多任务窗格(G-100)**:向右/向下拆分、最大化还原、**联动调整相邻窗格**、空窗格"从侧栏拖入一个任务"、Fork 失败提示。落点在既有 `ai-side-panel` + `work-panel` 之上做分屏容器,**禁止**新建第二套会话承载体系(与 D52/D68 协同)。**验收**:拆分/拖入/Fork 失败三用例 + 拖拽复用 D22 已建的 `application/x-ihui-conversation` 通道

- 原第 9546 行 → 存活于新成品:

- [x] ✅(2026-09-25)（进行中） **D17(生态统一入口)页面已写完但缺语言包,按住**:`apps/web/app/(main)/ecosystem/page.tsx` + `components/ecosystem/ecosystem-hub.tsx` + `sidebar/nav-data.ts` 2 行入口,五语 typecheck 本批 0 错、门 57/死链门 ✅。**按住理由**:21 键 × 5 语必须落进 `packages/i18n/messages/web/*.json`,而这五份文件正被并行会话 WP-8 改(各 22+/8−,`segSystem`/`topContributor` 等),整文件提交会把他人未提交的键一起写进 HEAD —— 而那些键在 HEAD 无引用,会立刻变成死键(CI `check:all` 的 `--exit 1` 口径)。**解阻判据**:待 web 语言包 `git status` 干净,按 `i18n-d17/` 载荷 parse→插入(不做整篇重排)→ `node scripts/i18n-apply.mjs`/`check-i18n-keys.mjs` 验五语对称 → 与页面、nav-data **同一枚**提交。裸提交页面而不带键 = 界面直出 `ecosystem.title` 键名,禁止。 **2026-09-25 同票补齐并入库**:并行会话已把 web 语言包提交干净 ⇒ 阻塞解除。用外科式插入落 `ecosystem` 29 键 + `nav.ecosystemHub` × 5 语(parse→插块→再 parse,**丢键即拒绝写盘**,复算五语键集 ✔ 一致),新增 8 例测试(5 例逐语言读真实词包断言"键存在、非空、不回显键名",1 例文件面装车证明页面真挂载 + nav 入口在位)。实测 `node scripts/check-i18n-keys.mjs` 由红(ecosystem 缺 5 键 + 两处动态前缀不可达)→ **17775 键 · 5 语言 parity OK**;`check-nav-dead-links` / `check-i18n-broken-en` / `check-no-emoji-icons` / `scan-i18n-zh-residue ko` / `scan-hardcoded-zh` 全 exit 0;`pnpm --filter @ihui/web typecheck` 本批文件命中 **0**(全包红点在他人未提交的 PriceChart 与 tool-category 测试里,不代改);vitest **8 passed**。**过程事故如实登记**:为查用法跑 `node scripts/i18n-apply.mjs --help`,该脚本**不认 `--help`、把它当无参直接进写盘模式**,拿一份陈旧载荷重排改写了 en/ja/ko/zh-TW 四份(各 176–214 增 / 35–39 删);这四份文件在我动手前是干净的,已按 `git show HEAD:<path>` 逐字节还原并复验(parse OK + `git status` 空),零损失 ⇒ 另立守卫票,见本节末新增登记行。

- 原第 9547 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「D38」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 **D38 队列语义完整交互(G-42)**:拖拽重排 / 撤回 / 编辑队列项 / 「打断并执行」/ 队列模式可配(steer vs queue,对标 Codex `followUpQueueMode`)。复用 D28 侧问队列与 W2 abort 通道,不造第二套排队。**验收**:五动词各有 e2e + 与 /side 互不回归 + 重排后发送顺序断言

- 原第 9549 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「D73」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 **D73 多任务窗格(G-100)**:向右/向下拆分、最大化还原、**联动调整相邻窗格**、空窗格"从侧栏拖入一个任务"、Fork 失败提示。落点在既有 `ai-side-panel` + `work-panel` 之上做分屏容器,**禁止**新建第二套会话承载体系(与 D52/D68 协同)。**验收**:拆分/拖入/Fork 失败三用例 + 拖拽复用 D22 已建的 `application/x-ihui-conversation` 通道

- 原第 9550 行 → 存活于新成品:

- [x] ✅(2026-09-25)（进行中） **守卫票：`scripts/i18n-apply.mjs` 把未知参数当"无参"，`--help` 即直接写盘**。本轮实测代价见上一行(四份语言包被陈旧载荷重排，已逐字节还原、零损失)。要求的修法：① `--help` / `-h` 只打印用法并 exit 0；② 任何未识别参数一律 **exit 2 并点名该参数**，不得降级成默认动作；③ 写盘前若输入载荷的 `translatedAt` 早于目标文件 mtime、或本轮没先跑过 `--check`，拒绝写并说明原因。验收判据：`node scripts/i18n-apply.mjs --help` 跑完后 `git status --porcelain -- packages/i18n` **必须为空**，并把这条负向判据钉成镜像测试。**守卫落地前，任何人不要用这个脚本试参数。** **2026-09-25 已落地(修法与原要求有两处偏差,理由如下)**:① `--help`/`-h` 只打印用法 exit 0;**未识别参数与裸位置参数一律 exit 2 并点名**,`--input` 只给开关不给值也算未识别(旧行为是当没传、静默回落到默认路径 —— 那正是"以为在应用自己指定的那份、其实应用的是盘上遗留的另一份");三条都在**读任何语言包之前**判定,盘上零变化。② 陈旧判据**没用 translatedAt/mtime**:本机 5+ 会话并发写词包,"载荷生成后有人动过文件"是常态,拿 mtime 拦会把合法批次天天挡掉,大家转而随手带过逃生参数 ⇒ 守卫退化成装饰。改成语义级的**回退可见化**:逐条点名"这次会改写哪些已翻译键 / 丢哪些键",但**默认不拦** —— 因为"源文案改了所以重译一个已翻键"正是这条流水线的正常维护动作(实测:默认拒写把既有 16 条用例一起打红,那 16 条全是合法形态);要硬拦的场景(自动化/CI)显式加 `--deny-overwrite`。取证:镜像测试 **39/39**(原 30 条一字未改 + 新增 9 条),新增用例里带**变异对照** —— 同夹具下无参调用必须**确实写盘**,否则"零变化"断言只是因为跑不起来而恒真;另有一条反向对照钉住"纯新增/占位重译不得被回退判据误报"。语言包本身在验收期被并行会话正常改了 5 份(技能市场 8 键),与本票无因果,已按文件归属区分。

- 原第 9553 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「D38」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 （进行中）**D38 队列语义完整交互(G-42)**:拖拽重排 / 撤回 / 编辑队列项 / 「打断并执行」/ 队列模式可配(steer vs queue,对标 Codex `followUpQueueMode`)。复用 D28 侧问队列与 W2 abort 通道,不造第二套排队。**验收**:五动词各有 e2e + 与 /side 互不回归 + 重排后发送顺序断言

- 原第 9615 行 → 存活于新成品:

- [x] ✅(2026-09-25) **守门 102 GA1 在 HEAD 面的 70 处 / 31 文件行尾字符箭头全部换成矢量**

- 原第 9625 行 → 存活于新成品:

  - **随之删掉的无使用者样式**:`member-arrow` `pf-arrow` `vs-share-arrow` `cd-aigc-arrow`

- 原第 9628 行 → 存活于新成品:

  - **提交面**:miniapp 批 `b72021ef1a`(25 文件 +81/−89)、web+共享层批 `5f639343c0`(7 文件 +16/−37)。

- 原第 9791 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「O10」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 O10 对外 run 语义：幂等 run 创建（`Idempotency-Key`）、外部 run 句柄（不依赖 IHUI session_id）、通用幂等层、游标分页规范  ⏳(幂等重放保护已入库(af96921c95);run 句柄与游标分页另列 O10b)

- 原第 10055 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「D29」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 D29 团队级知识引擎:记忆/Repo Wiki/知识卡云端共享+成员修正+过程审计(对标 Qoder 1.0,官方实证输入 token -40%)(G-35)

- 原第 10056 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「D30」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 D30 无人值守修复闭环:GitHub issue/代码扫描告警/失败测试→automations 定时认领修复→PR 回帖(对标 QoderWake;与 D14/D15 协同)(G-36)

- 原第 10057 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「D31」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 D31 设计稿转码:Figma Frame/组件→可运行前端代码(对标 Trae 设计还原)(G-37)

- 原第 10061 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「D31」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 D31 设计稿转码:Figma Frame/组件→可运行前端代码(对标 Trae 设计还原)(G-37)

- 原第 10065 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「D31」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 （进行中@2026-09-26/D31票） D31 设计稿转码:Figma Frame/组件→可运行前端代码(对标 Trae 设计还原)(G-37)

- 原第 10066 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「D29」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 （进行中@2026-09-26/D29票） D29 团队级知识引擎:记忆/Repo Wiki/知识卡云端共享+成员修正+过程审计(对标 Qoder 1.0,官方实证输入 token -40%)(G-35)

- 原第 10067 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「D29」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 D29 团队级知识引擎:记忆/Repo Wiki/知识卡云端共享+成员修正+过程审计(对标 Qoder 1.0,官方实证输入 token -40%)(G-35)

- 原第 10070 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「D16」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 D16 多模型智能路由(任务类型分类器+成本感知选模+预算降级)(G-21)

- 原第 10071 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「D29」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 D29 团队级知识引擎:记忆/Repo Wiki/知识卡云端共享+成员修正+过程审计(对标 Qoder 1.0,官方实证输入 token -40%)(G-35)

- 原第 10072 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「D30」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 D30 无人值守修复闭环:GitHub issue/代码扫描告警/失败测试→automations 定时认领修复→PR 回帖(对标 QoderWake;与 D14/D15 协同)(G-36)

- 原第 10073 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「D31」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 D31 设计稿转码:Figma Frame/组件→可运行前端代码(对标 Trae 设计还原)(G-37)

- 原第 10127 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「G-206」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 **G-206 同一个缺口今天被补了两遍 —— 共享包内现在有两份 conversation-org,而 barrel 只把一份给出去,另一份的关键函数在包外根本不存在**(**刻意不认领**:上限取值要设计侧拍板,挂个租约只会变成一台等人来摘的红门)

- 原第 10322 行 → 存活于新成品:

  - **"剩下 12 条"里有 6 条根本不是 CSS 问题(这条推翻的是我自己上一轮的登记)**:`mx-0.5 top-1/2 z-[1040] z-[9995] w-[400rpx] w-[420rpx]` 来自 `Toast`/`ConfirmDialog`/`VoiceInput`/`TitleSwitchScrollPicker`/`TitleSwitchOverlap` —— 这几个组件**在本端零 import**(只有 barrel 的 `export`),它们的类名字符串连同 `translate(-50%` 在整个产物里 0 次出现,只有转写形式孤零零留在 CSS 里。同 `custom-tab-bar` 一类:**源码在、组件不装配**。**地板因此是 12 而不是 6。** 剩下两条路都不做,理由是它们都比现状更糟:删组件属 §7(要先回答"承载什么功能、有无等价实现",这里连"该不该有这几个 UI"都不是我能替产品裁的);给门加 `@source not` 排除表则会在**某天真有人 import 它的那天**把这些样式静默丢掉 —— 用一条更窄的判据换来一个假绿地板,是这笔账里最贵的选项。登记归属,不代裁。

- 原第 10323 行 → 存活于新成品:

  - 一条**方法论教训**(比这条修复本身更通用):我先前那句"6 条属 custom-tab-bar,是地板"是**只数了已知的一类**就当成了全集 —— 而"地板"这种结论的正确算法是**逐名归因到"为什么这条运行时看不见"**,不是"我认识的那一类有几个"。这次是代理按逐名查 import 图才发现另外 6 条,否则我会带着一个错地板数字继续排期。另:本次 `config/index.ts` 那份实验补丁(`cache:false`)经比对**已在 HEAD**(`f459df544b`),应用它是 no-op ⇒ 已回退未落。门侧取证:css-landing `--self-test` 112 例全绿 + 镜像 45 例全绿;门 36(--worktree 436/436)、门 105、门 93(R6/R7/R8 全 0)、门 77 无新增违规;水印 verify 完好;`typecheck` 剩 2 枚 `onTerminalDelta` 错在 `src/pkg-ai/ai/chat.tsx:636`,该文件盘上 == HEAD blob ⇒ 他人现场,不碰。

- 原第 10395 行 → 存活于新成品:

- [x] ✅(2026-09-24) **第 3、4 次同型事故(继守门 64、70 之后)**:用五处权威接线点求差集实测抓到三枚脚本存在却**无人调用**的守门 —— `check-test-paths`(AGENTS §23 写"CI / pre-commit 必跑")、`check-verify-tmp-files`(§25 写"CI")、`check-i18n-messages-exist`(自称 pre-commit 模式)。已按实测档位登记为 **85 blocking / 86 warn / 87 blocking**,装门前逐枚实测真仓全量与 `--staged` 双口径均 exit 0(不误伤任何在途提交)。commit `66d2ae1a26d`。

- 原第 10396 行 → 存活于新成品:

- [x] ✅(2026-09-24) **本仓结构性事实(以后所有接线核查必须知道)**:`.husky/pre-commit` 自 2026-09-22 起只是 5 行薄壳(`wscript //nologo scripts/hook-run-hidden.vbs pre-commit scripts/lib/pre-commit-hook.js`),**真实 pre-commit 逻辑在 `scripts/lib/pre-commit-hook.js`**。所以"权威接线点"是**五处**:`guardian-runner.mjs` 的 `script:` 值 ∪ `scripts/lib/pre-commit-hook.js` ∪ `.husky/*` ∪ 根 `package.json` ∪ `.github/workflows/*`(+ `run-8end-consistency-cert.mjs`)。**只查 `.husky/pre-commit` 会得出完全相反的结论** —— 我一开始就据此误判 `check-pwsh-version`/`check-button-height` "没装车",实际它们在 hook.js:517/560 生效,是文档写的调用点名字不对。

- 原第 10397 行 → 存活于新成品:

- [x] ✅(2026-09-24) **`check-test-paths` 判据缺陷(假阳性)根治**:旧判据"`git check-ignore -v` 输出非空 = 被忽略",而 git 对**否定规则**同样打印命中行 ⇒ 真仓 `apps/web/src/components/billing/__tests__` 被误判 BLOCK,会把所有无关提交卡死。改为按命中模式首字符 `!` 判定,并加第二层"目录未命中但里面的实文件被吞"探查。取证三重:① 真仓前后差集 HEAD 版 exit 1/阻断 1 → 修复版 exit 0/阻断 0,**零新增红点**;② 三夹具与 `git add --dry-run`(git 自己的真值)对照,修复前 3 例中 2 例结论相反、修复后 3/3 一致;③ 镜像测试 12→16 例,含"完整反忽略必绿"与"**只放开内容的半个反忽略必红**"(实测 `!**/__tests__/**` 单独写是无效反忽略,git 不能重新包含父目录已被排除的文件 —— 这个坑值得所有人知道)。

- 原第 10398 行 → 存活于新成品:

- [x] ✅(2026-09-24) **guardian-runner 两处"登记了但永不生效"**:id 39 / id 10 把 `--staged` **写死进 `args`**,于是 AGENTS 承诺的"不带 `--staged` 为全量扫描"对这两枚恒命中"无 staged 文件,跳过"⇒ 假绿。摘掉硬编码(runner 在 staged 模式本就统一追加 ⇒ pre-commit 行为逐字不变);摘前实测两枚全量口径均绿(204 个 screen 全迁移 / OpenAPI A–E 全过且仅 0.37s,原注释担心的"3.5MB 比对成本"并不成立)⇒ 不新增红点。另**删除 `2l-shared` 登记**:它与今日新增的 `2o-shared` 是逐字相同的 script+args(一 warn 一 blocking),同一条判定每轮跑两遍且同时产出 1 警告 + 1 失败,污染归因。

- 原第 10399 行 → 存活于新成品:

- [x] ✅(2026-09-24) **端到端证明走权威入口,不用自拼内部件**:临时索引只装本票 5 文件 → `node scripts/guardian-runner.mjs --staged --timing` ⇒ **exit 0**,输出里 `[85][86][87]` 三行确被执行。之所以不用 `safe-commit`:此刻主索引里有**并发会话批量未提交的暂存删除**(含 `apps/api/src/routes/admin-maintenance-notice.ts`、`monitoring/alertmanager/alertmanager.yml.tmpl` 等 8 项 `D `),`safe-commit` 第 0 步的 `git reset HEAD` 会改掉他们的暂存状态 —— 共享工作区里这不属于我可动的范围。

- 原第 10400 行 → 存活于新成品:

- [x] ✅(2026-09-24) **`check-i18n-messages-exist` 重写(子代理交付,结论已逐条复测)**:`ROOT` 从 `process.cwd()` 改为仓库根 + 显式 `--root`/env 注入(旧自测只切 cwd ⇒ **静默扫真仓**,13 例里 10 例恒红且无人能跑,这才是最大的漏判面);新增"清单为空 / 根不存在 / `--staged` 与 `--root` 冲突"一律 **exit 2**(判不了就红,绝不静默报绿)。子代理把旧版一条显式覆盖("miniapp-taro 的 loader 在 `src/i18n/` 而非 `src/i18n/messages/`")并进了"按脚本自带表生成夹具"⇒ **表漂移时夹具与判据自洽、测试恒绿**,该覆盖实际丢失。我已补回:布局表(`ENDPOINTS`/`LOADER_TARGETS`/`LOCALES`)与**手写字面量**逐字比对 + 用 `git ls-tree HEAD` 做独立真值,18/18 绿。

- 原第 10401 行 → 存活于新成品:

- **O36 残余(不写作收口)**:① **AGENTS.md 三处文档漂移未修**,原因是它此刻被并发会话 `MM` 暂存中(改必互抹),应改文字已备好待其索引清空:§27"集成位置:`.husky/pre-commit` 直接调用"应改为 `scripts/lib/pre-commit-hook.js:560`;§23/§25 两处"必跑/CI"表述**已因本次补装变为真**,无需再改;`check-staged-files-count`、`check-portal-fixed`、`check-agent-engine-parity` 等**在 hook.js 生效却零见于守门速查**(反向差集,同样危险:文档看不到门,人就会重复造门)。解阻判据 = `git status --porcelain -- AGENTS.md` 为空。② 并发会话新建的对账门 `check-gate-wiring.mjs` 现存 5 枚红点(3 枚 R1 脚本自述撒谎 + 2 枚 R2 文档撒谎)正在逐条判真伪,**消红前只以 warn 接入**(恒红门=全队 --no-verify=118 道门全废,优先级高于加门)。③ R3 档另有 8 枚"无任何接线声称、五处零命中"的脚本(含 `check-sse-dispatch-parity.mjs` 自述"守门 2026-09-23 立"却无调用点 —— 最隐蔽的一类),属后续逐枚处置。④ **门 71 对"章节标题行"仍有盲区**(实测:它只认 `### 第N批` 与带编号的 bullet,`## O36 …` 这类 O 票标题行删掉不报),本票不复刻修法的原因是**简单补族并不能修好**:该门判活是"标记文本仍在 ∨ 该编号仍是某登记行的行首"两路 OR,而每个 O 票段落里的"残余"bullet 本身就带 `O3x` 编号 ⇒ 只加标题族会被第二路放行;真要收紧得让**标题类标记只走文本路**,而这会误伤"他人正常改写标题措辞"(门 71 的注释里已因此踩过一次假阳)。本票自身的兜底是:残余 bullet 以 `O3x 残余(不写作收口)` 开头 ⇒ 整段被滞后副本回滚时这一行必判红。落点与决策交门 71 持有人(今日该文件由 O35 一并在改,不重复动)。⑤ **给"共享工作区幻影滞后根治"票送一个现场量化样本**:此刻 `PROJECT_PLAN.md` 工作区 vs HEAD = `+150 −973`,而门 71 的 `--heal` 扫 439 条登记行报"**无缺失**" ⇒ 那 973 行全在保护面之外,任何人一次 `git add -A -- PROJECT_PLAN.md` 就能把它们从版本树静默抹掉,而 pre-commit 只打印一行"❗ 非登记行丢失 973 行(≥100 高度疑似旧基线整文件提交)"**警告不拦**。我没有把它升成 blocking:O35 一系今天刚把这块"报数面"补上并**明写了只报数的理由**(批量重排/归档会被误伤,恒红门反而逼各会话 --no-verify),推翻他人有据决策不在我票范围;要升 blocking,可行判据是"净缩水比 `vanish ≫ added` 且本次未同批 stage `.ihui-agent/archive/PROJECT_PLAN_*.md`"——这样 rewrap(vanish≈added)与归档(有 archive 同批)都不会误伤。

- 原第 10860 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「D17」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 D17 专家包/技能市场/连接器授权中心统一入口(对标 WorkBuddy 生态)(G-25/G-26)

- 原第 10893 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「G-207」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 **G-207 守门 111 对 `apps/cli/src/tools/` 下"本来就不注册工具"的文件是恒红的 —— 而这道红每次都合法地被跳掉,所以它既拦不住人、又一直在污染归因**

- 原第 10900 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「G-209」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 **G-209 `git-sync-converge` 违反 §5b 自己那条"origin/main 以 FETCH_HEAD 为准"——拿一个对象不在本地的 packed remote ref 去 `merge-base`,直接崩在同一夜两次**:2026-09-26 两次实测(04:5x 与 08:5x),命令都是 `node scripts/git-sync-converge.mjs`,报错逐字相同 —— `fatal: Not a valid object name <远端 sha>`,栈顶 `scripts/git-sync-converge.mjs:79`(git() 包装器)← `:647`(main)。成因链:并发会话 push 之后,`refs/remotes/origin/main`(或 packed-refs)被更新到那枚新提交,但**本机对象库里还没有那枚提交的对象** ⇒ `merge-base <本地> <远端>` 结构上不可能成功。两次都是**先 `git fetch origin main` 再跑同一条命令就通过**(第二次实测:合并树无冲突、`56e6f7ebcc7` 推进并推送成功),所以这不是环境故障,是本工具缺一步前置。**该修的是判据顺序而不是报错文案**:① 入口先读 `git ls-remote origin main`(或 `fetch` 一次)取权威值,而不是读嵌套 ref —— §5b 明写嵌套 remote-tracking ref 会在 1 秒内被宿主清理层删掉、"读回旧值不代表真值";② 用它比对前必须先 `cat-file -e <sha>^{commit}`,取不到就自己 `fetch`,fetch 也失败则**判"无法判定"并退出**而不是抛 `Command failed` 让人看见一段 Node 栈;③ 与本仓"判据失效的表现永远是安静"那条相反,这次是**失效表现为崩溃**,同样不该留 —— 一个会崩的收敛入口在并发期等于没有。**刻意没顺手修**:该脚本是共享收敛路径(§12d/§5b 多处依赖),改它的取材来源属结构性改动,且它当前对"真分叉"的索引层合并逻辑已由别人取证(45 例自检),另计一票做。

- 原第 10901 行 → 存活于新成品:

- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「G-209」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 **G-209 `git-sync-converge` 违反 §5b 自己那条"origin/main 以 FETCH_HEAD 为准"——拿一个对象不在本地的 packed remote ref 去 `merge-base`,直接崩在同一夜两次**:2026-09-26 两次实测(04:5x 与 08:5x),命令都是 `node scripts/git-sync-converge.mjs`,报错逐字相同 —— `fatal: Not a valid object name <远端 sha>`,栈顶 `scripts/git-sync-converge.mjs:79`(git() 包装器)← `:647`(main)。成因链:并发会话 push 之后,`refs/remotes/origin/main`(或 packed-refs)被更新到那枚新提交,但**本机对象库里还没有那枚提交的对象** ⇒ `merge-base <本地> <远端>` 结构上不可能成功。两次都是**先 `git fetch origin main` 再跑同一条命令就通过**(第二次实测:合并树无冲突、`56e6f7ebcc7` 推进并推送成功),所以这不是环境故障,是本工具缺一步前置。**该修的是判据顺序而不是报错文案**:① 入口先读 `git ls-remote origin main`(或 `fetch` 一次)取权威值,而不是读嵌套 ref —— §5b 明写嵌套 remote-tracking ref 会在 1 秒内被宿主清理层删掉、"读回旧值不代表真值";② 用它比对前必须先 `cat-file -e <sha>^{commit}`,取不到就自己 `fetch`,fetch 也失败则**判"无法判定"并退出**而不是抛 `Command failed` 让人看见一段 Node 栈;③ 与本仓"判据失效的表现永远是安静"那条相反,这次是**失效表现为崩溃**,同样不该留 —— 一个会崩的收敛入口在并发期等于没有。**刻意没顺手修**:该脚本是共享收敛路径(§12d/§5b 多处依赖),改它的取材来源属结构性改动,且它当前对"真分叉"的索引层合并逻辑已由别人取证(45 例自检),另计一票做。

### 第二趟里被**就地改写**的登记行(不是重复副本:同一件事只留一行当前状态,原文逐字留此)

- [x] ✅(2026-09-26)**活文档逐字去重(两份)**:`AGENTS.md` 与本项目计划台账里"同一件事登记了两三份"的副本已归并 —— 族的主键一律取**登记位置的标识**(计划取复合主键,守则文档取标题后括号里的门号),不按全文匹配取主键 (取错过一次:条目正文里的"口径同 70/77/83"会把别的门并进来,去重当场变成删别人的门)。 被取代副本的独有说法逐段并入存活条目并标注"以正文为准";归并落账注记**逐次原样带过去**, 不做"已有同样文字就不再补"的过滤(门按出现次数计,折一条就是抹一条账)。 删除前逐字进 `.ihui-agent/archive/` 三份归档件(同时也是登记行防丢闸的豁免面,必须与主文档同枚提交)。 零损失对账:计划 HEAD 11350 行 → 11166 行,被删 184 行 100% 逐字可找回、未触及却消失 0; 守则文档 1639 条非空行 = 1594 逐字仍在 + 34 逐字入归档 + 11 被加长后的存活行整段包含 + 无处可寻 0。 落地前后各门现读:四条状态判据与派单口径读数一字未变,防丢/归档/反回退三道 rc=0。 **未闭环**:计划台账仍有 8 块"首行相同而正文漂移"(机器不折半,须人工判哪份作数)、9 组同题多待办(只加副本指针、不动勾选),守则文档另有跨大节的散文孪生刻意未并(正文与速查是有意双写)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
