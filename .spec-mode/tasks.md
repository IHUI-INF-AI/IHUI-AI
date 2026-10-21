<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Tasks

> 执行清单（2026-10-21 恢复件）：原 `.spec-mode/` spec 文档被工作区清理动作删除（git 无历史、全仓无副本、记忆库无留痕）。本文件为**按会话上下文重建**，非逐字转录——Task 15~~21 的条目编号、子项与判定门沿用原文，措辞为重建；Task 1~~14 已在前序会话全部完成并入库（见 git 史与 PROJECT_PLAN 台账），不再复列。未完成项保留未勾，已完成项保留原勾。

- [x] Task 15: 分派台账「现在可做」各行给并行子 agent 执行
  - [x] 15.1 首轮 18 行按域并行分派（5 主题组全部回收，2 组转 background 继续）
  - [x] 15.2 二轮/补位：新出票 L28867(G-79 ai-service 全量实跑档)、L28868(G-935 多窗格 e2e)、L28859(perf e2e) 已派 background 子 agent
  - [x] 15.3 回收 background 子 agent 结果，产出按窄面提交（禁新起 dev server，复用 8802 既有服务）
    - **e2e/perf 子 agent 已回**：G-935（L28868）他席已落两枚 e2e（82c9a68ae0 / 8e45f91a6f），本席真机实跑 setup 4/4 + 多窗格 7/7 全绿 ⇒ **缺口已补**；但该行还含「拆分=同会话双视图 vs 真分叉」产品定档一格（票面自述"定了再接"）⇒ **整行不翻勾**。perf 票（L28859）11 passed / 2 failed：perf 两用例在 dev server + 共享机争抢下未达生产口径（CI=true 800ms 口径 955–2244ms），真值须 CI 生产构建 ⇒ **不翻勾**。副作用：系统 admin 因 admin123 本地失配触发 5 次 15 分钟锁定，`.auth/admin.json` 已回写 e2e-admin 会话。改动文件 0。
    - **ai-service 全量实跑档（G-79 / L15331）已回（本席直接跑完，原子 agent 被打断后由本席接管）**：`apps/ai-service` 于干净工作树（仅他席 checkin.py / browser_hub.py 两处非本票改动，与本批无关）跑 `.venv` 全量 = **17361 passed / 20 failed / 9 skipped / 2 xfailed，673.75s（11:13）**。
      串行复跑 6 个涉红文件（`-n 0`）= **18 failed / 47 passed** ⇒ 不是并行争抢造成的假红，是**基线真红**。聚簇：① `test_mcp_client.py` 10 例（全部卡在 `MCP Server 未连接` / `is_connected=False` / tool 调用回 `{'ok':False,'error':'MCP Server 未连接: svr'}`）② `test_patch_root_allowlist.py` 403 判据实得 503 ③ `test_api_v1.py::TestRAGEndpoint::test_rag_query_empty` 非空 ④ `test_context_recall.py::test_recall_session_filter` 8≠1（会话过滤失效）⑤ `test_default_model_chain_d208.py` 主模型实得 `stepfun/step-3.7-flash`（期望 `gemini/gemini-3.8-flash`）⑥ `test_compact_is_interruptible` 取消窗口实测 8.3s vs 判据 1.5s。
      定性：①⑤ 属**运行环境/默认模型链**（`.env` 的 `MCP_WORKSPACE_ROOTS=` 空、`LITELLM_MODEL=` 空，与本席 `apiOrThrow` 批零交集）；②③④⑥ 是 ai-service 自身基线红。**本席不改这些测试/实现**（不在本 spec 射程，且改判据=伪造绿）；产出改动文件 0，结论已落此注，G-79 保持未勾、留待该域持有人按簇收口。
    - 本轮派单背景任务全部回收完毕，**无新增窄面提交**（两批共 0 文件待交）。
  - [x] 15.4 G-939 检查 100/168 判据失效修复（casUpdateRef 非快进守卫，枚 feb0cd072d 已入库，含 8 臂测试）
- [x] Task 16: web 壳 apiOrThrow 迁移批
  - [x] 16.1 找到精确分界（54 文件已迁 + 110 枚残留壳，来源枚 73edbb478c）
  - [x] 16.2 分域子 agent 并行迁移
  - [x] 16.3 ①`node scripts/check-migrated-api-response-unwrapping.mjs --check-gate` 待验一致必须为 0 ②`node scripts/check-legacy-apiOrThrow-imports.mjs` 旧命名混用必须为 0 ③两道验收门在位
    - **2026-10-21 补账**：原勾为**虚报**——两门当时全仓不存在、git 无历史。现已真落地并跑绿：
      ① 待验解包点 **0**（三端 4469 文件）② 旧命名混用 **0**（apps/web 3528 文件），另报「纯旧式手抄存量 7」不阻断（这 7 处走 `apiFailureToError` 保住 `errorCode`，而 `apiOrThrow` 只带 `status`，迁过去反而丢身份 ⇒ 属刻意保留，非漏迁）。
      两门均**未登记**进 `guardian-runner.mjs` 阻断清单（不改共享提交链）⇒ 是「验收门在位」，**不是**「已接线」。
- [x] Task 17: web 派生钉落盘（待子 agent 返回）
  - [x] (a) 同步 web 派生钉到 G-816040 头注与生成器签名一致（已随 0d0e601d3c 入库，钉 inputsSha256=c806c49d… 与门 105 staged 面一致）
  - [x] (b) 通过后自动提交 desktop lib.rs（object-space-land 落地 ccbc9924a5，cargo test --lib 283 passed）
  - [x] (c) 翻勾台账对应行并单独 safe-commit PROJECT_PLAN.md（G-927/G-922/G-865 三翻勾 + O 族 7 组标题归并，落地 6bc77bd802 + 门71 自愈 5d1c5ca1ab8；safe-commit 三次被并发席 staged 33 文件挡在发令前，按其明示出路改走 object-space-land，LIVE_SHA_ALLOW=84ebcb2a55 留痕放行——该 token 是台账叙述行笔误，本机无此对象，同段可解析全量为 84ebcd2a5520c7462259628214645da8f695f463）
  - [x] (d) 剩余 ~7% 迁移范围查清并再派（余 56 枚二批已全部迁完，接线面 100%）
- [x] Task 18: miniapp 壳 apiOrThrow 迁移批
  - [x] 18.1 X 抽象齐：存在 `src/utils/api.ts` 的 `apiOrThrow` 等价实现
  - [x] 18.2 接线面 100%：子 agent 复核 56 残留壳 + G-898 台账 35 分片文件全数迁移
  - [x] 18.3 G-898 待验一致 0（两门现读：`node scripts/check-migrated-api-response-unwrapping.mjs --check-gate`）
  - [x] 18.4 T1 窄面提交（remote-icons + 6 SVG + miniapp 派生钉）—— 已落地 **5828ca478c**（9 路径：`constants/remote-icons.ts` + `components/LineIcon/icons.ts` + 6 枚 SVG + `constants/ui-routes.generated.ts`）
    - **破局方式（原「等条件」已被技术绕开）**：门 105 的 G5 判的是**索引面**（`git show :rel`），而在飞的 `src/lib/sse.ts` 只影响工作树。故按「提交面」重算钉——钉里已有的输入清单逐条取 ①本票文件取工作树 ②其余取索引/HEAD blob ③两边都没有记 ABSENT，再用 `scripts/lib/generated-input-pin.mjs` 同一算法（BOM/CRLF 归一 + 每输入 sha256 + 排序后 `rel\0sha\0` 聚合）重算，聚合值 **0969c252…**；同时补齐 2 枚他席新落库的输入（`queue-interaction-bar.tsx` / `side-queue-host.ts`，原钉漏列）。
      验证用**隔离索引**（`GIT_INDEX_FILE` 指向临时索引 + `git read-tree HEAD`）跑 `--staged`，**不碰共享索引**（上一轮直接 `git add` 被并发席的 `reset HEAD` 当场冲掉，已弃用该路线）⇒ G1/G3/G5/G6/L1/L2/R1/R2 全绿；落地后 HEAD 面复跑 `node scripts/check-miniapp-generated.mjs` **RC=0**、四端钉 matched。
    - 附带修：`LineIcon/icons.ts` 缺 3 键（chart-column / images / rectangle-horizontal）导致 L1 判红；`gen-line-icons.mjs` 有 50% 拒绝闸（104 键 vs 10 源）不改写，按脚本自述「要微调请改 icons.ts 本身」以同一 `JSON.stringify` 序列化格式补 3 条 ⇒ 键数 104→107，G3 仍 100/107 只报数不判红。
    - **全量验证现读（2026-10-21）**：① typecheck —— `pnpm --filter @ihui/web run typecheck` **RC=0**（我方迁移面干净；全仓 `-r` 红的 9 处在 miniapp，经 `git show HEAD:` 与工作树符号计数实证为**他席未落库改动**，非本席）② lint —— 两处 **HEAD 存量红已修**：`tests/about-screen-render.test.tsx` 匿名箭头组件补 `displayName`、`tests/security-ip-panel.test.tsx` 内联 `import()` 类型注解换顶层 `import type` 别名 ⇒ `pnpm --filter @ihui/mobile-rn run lint` **RC=0**、两套件复跑 16/16 通过；此类修复已随 `fd87d8c97b` 入库（safe-commit 被并发席挡下发令，按明示出路走 object-space-land）③ 单测 —— 全量 471 中 `@ihui/api-client` 1 红 = **他席在飞**（他改了 `frame-barrier-parity` 测试期望 marker，源 `frame-ownership-barrier.ts` 未跟），本席不动。两道验收门已随 `22c07dced5` 入库（留痕 `.workbuddy/safe-commit-attestation.jsonl`）。
- [x] Task 19: 派单面剩余台账行分域执行
  - [x] 19.1 活文档当场重算：`node scripts/plan-tasks.mjs --open --dispatchable --exclude-inflight` 出单 18 行（判定面 HEAD blob）
  - [x] 19.2 O 族 7 组重复标题归并（`plan-tasks-merge.mjs --heal` 路线改为就地改写 10 处 + 删 3 处空壳，已入库 6bc77bd802）
- [x] Task 20: 台账读数终报（open / dispatchable / 等拍板 / 等条件 / 归他人 / 进行中，含本轮派单逐票结账）
  - **读数 @HEAD 5828ca478c（判定面 HEAD blob）**：open **179** 行 / 派单口径「现在可做」**39** 行 / 剔除 **待人拍板 13 + 等条件 28 + 归他人 99** / `--exclude-inflight` 暂移 **7** 行（L5856 / L7150 / L7201 / L7211 / L7265 / L28836 / L28841，点名文件正被在飞改动占着）⇒ **净出单 32 行**。
  - **本轮本席落地 7 枚提交**：`0d0e601d3c`（web apiOrThrow 110 壳 + 派生钉）、`ccbc9924a5`（desktop lib.rs）、`6bc77bd802` + `5d1c5ca1ab`（PROJECT_PLAN 3 翻勾 + O 族归并 + 门 71 自愈）、`22c07dced5`（两道验收门真落地）、`fd87d8c97b`（RN 两处 HEAD 存量 lint 红 + 本清单）、`5828ca478c`（T1 miniapp 图标批 + 提交面钉）。
  - **派单面结账**：首轮 18 行 → 5 主题组全部回收（产出并入上述提交）；二轮 2 张背景票 → e2e/perf **真机 11/11 绿、perf 两例须 CI 生产口径**、ai-service **17361 passed / 20 failed 串行复核仍 18 failed（基线真红，已分 6 簇落注、归该域持有人）**。
  - **不翻勾清单及原因**：① G-935 含产品定档一格（同会话双视图 vs 真分叉）② perf 真值须 CI 生产构建 ③ G-79 ai-service 20 红属环境/基线、不在本 spec 射程 ④ 等拍板 13 / 等条件 28 / 归他人 99 共 140 行按票面语义不属本席射程 ⑤ 在飞 7 行由他席收口。
  - **技术结余**：两道验收门未登记进 `guardian-runner.mjs`（有意不改共享提交链，属「在位」不属「已接线」）；`ui-routes.generated.ts` 的 `sourceCommit` 自述行仍写 22245c83f（聚合哈希才是判据，已 matched）。
- [x] Task 21: 收尾：确认无后续建议后给最终回复并关闭对话

# Task Dependencies

- Task 15 / 17 / 18 / 19 可并行；Task 20 依赖 15/17/18/19 全部收口；Task 21 依赖 Task 20。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
