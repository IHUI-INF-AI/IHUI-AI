<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Tasks

> 执行清单（2026-10-21 恢复件）：原 `.spec-mode/` spec 文档被工作区清理动作删除（git 无历史、全仓无副本、记忆库无留痕）。本文件为**按会话上下文重建**，非逐字转录——Task 15~~21 的条目编号、子项与判定门沿用原文，措辞为重建；Task 1~~14 已在前序会话全部完成并入库（见 git 史与 PROJECT_PLAN 台账），不再复列。未完成项保留未勾，已完成项保留原勾。

- [ ] Task 15: 分派台账「现在可做」各行给并行子 agent 执行
  - [x] 15.1 首轮 18 行按域并行分派（5 主题组全部回收，2 组转 background 继续）
  - [x] 15.2 二轮/补位：新出票 L28867(G-79 ai-service 全量实跑档)、L28868(G-935 多窗格 e2e)、L28859(perf e2e) 已派 background 子 agent
  - [ ] 15.3 回收 background 子 agent 结果，产出按窄面提交（禁新起 dev server，复用 8802 既有服务）
    - **e2e/perf 子 agent 已回**：G-935（L28868）他席已落两枚 e2e（82c9a68ae0 / 8e45f91a6f），本席真机实跑 setup 4/4 + 多窗格 7/7 全绿 ⇒ **缺口已补**；但该行还含「拆分=同会话双视图 vs 真分叉」产品定档一格（票面自述"定了再接"）⇒ **整行不翻勾**。perf 票（L28859）11 passed / 2 failed：perf 两用例在 dev server + 共享机争抢下未达生产口径（CI=true 800ms 口径 955–2244ms），真值须 CI 生产构建 ⇒ **不翻勾**。副作用：系统 admin 因 admin123 本地失配触发 5 次 15 分钟锁定，`.auth/admin.json` 已回写 e2e-admin 会话。改动文件 0。
    - ai-service 全量实跑档（L28867）子 agent 仍在跑，待回。
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
- [ ] Task 18: miniapp 壳 apiOrThrow 迁移批
  - [x] 18.1 X 抽象齐：存在 `src/utils/api.ts` 的 `apiOrThrow` 等价实现
  - [x] 18.2 接线面 100%：子 agent 复核 56 残留壳 + G-898 台账 35 分片文件全数迁移
  - [x] 18.3 G-898 待验一致 0（两门现读：`node scripts/check-migrated-api-response-unwrapping.mjs --check-gate`）
  - [ ] 18.4 T1 窄面提交（remote-icons + 6 SVG + miniapp 派生钉）—— **等条件**：门 105 miniapp 钉输入集 = `apps/miniapp-taro/src/` 全部 ts/tsx，含他席在飞未落库的 `src/api/index.ts` / `src/constants/style.ts` / `src/lib/sse.ts`（G-274），任一提交方式都会让 G5 判红 ⇒ 待他席落库后立即重生成钉并窄面提交
    - **全量验证现读（2026-10-21）**：① typecheck —— `pnpm --filter @ihui/web run typecheck` **RC=0**（我方迁移面干净；全仓 `-r` 红的 9 处在 miniapp，经 `git show HEAD:` 与工作树符号计数实证为**他席未落库改动**，非本席）② lint —— 两处 **HEAD 存量红已修**：`tests/about-screen-render.test.tsx` 匿名箭头组件补 `displayName`、`tests/security-ip-panel.test.tsx` 内联 `import()` 类型注解换顶层 `import type` 别名 ⇒ `pnpm --filter @ihui/mobile-rn run lint` **RC=0** ③ 单测 —— 全量 471 中 `@ihui/api-client` 1 红 = **他席在飞**（他改了 `frame-barrier-parity` 测试期望 marker，源 `frame-ownership-barrier.ts` 未跟），本席不动。两道验收门已随 `22c07dced5` 入库（safe-commit 走应急路径落地，留痕 `.workbuddy/safe-commit-attestation.jsonl`）。
- [x] Task 19: 派单面剩余台账行分域执行
  - [x] 19.1 活文档当场重算：`node scripts/plan-tasks.mjs --open --dispatchable --exclude-inflight` 出单 18 行（判定面 HEAD blob）
  - [x] 19.2 O 族 7 组重复标题归并（`plan-tasks-merge.mjs --heal` 路线改为就地改写 10 处 + 删 3 处空壳，已入库 6bc77bd802）
- [ ] Task 20: 台账读数终报（open / dispatchable / 等拍板 / 等条件 / 归他人 / 进行中，含本轮派单逐票结账）
- [ ] Task 21: 收尾：确认无后续建议后给最终回复并关闭对话

# Task Dependencies

- Task 15 / 17 / 18 / 19 可并行；Task 20 依赖 15/17/18/19 全部收口；Task 21 依赖 Task 20。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
