<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Agent 能力评测基线

固定任务集 + 录制回放 + 基线机械比对。目标不是"跑一次看看"，而是让 agent 能力退化成
**可复现的数字** 和 **CI 里会红的门**：同一份代码跑两次结论必须逐字节相同，改动导致能力
退化时退出码非 0，无需人眼看日志。

## 测什么

| 能力           | 用例                                  | 硬判据（摘要）                                                                     |
| -------------- | ------------------------------------- | ---------------------------------------------------------------------------------- |
| tool-call      | `tool-call.direct-read`               | 选对 `read_file`、参数指向目标文件、工具结果真的回到下一轮请求、只读任务不改工作区 |
| tool-call      | `tool-call.invalid-arg-repair`        | 非法参数被运行时挡下（不带病执行）、补正后成功、修复轮次可计数                     |
| tool-call      | `tool-call.select-list-dir`           | 选 `list_dir` 而不是读文件工具、答复含真实文件名                                   |
| compaction     | `compaction.long-history-facts`       | 压缩后头部事实仍可检索、工具调用/结果配对完整、token 真实下降                      |
| compaction     | `compaction.degenerate-summary-guard` | 采样返回空/空白/占位时不吞掉历史，退化摘要被挡下                                   |
| resume         | `resume.mid-turn-tool-pair`           | 工具配对中断后从检查点续跑、三轮请求指纹一致、无重复副作用                         |
| resume         | `resume.persist-reload-continue`      | 落盘→重载→继续，消息条数/形态/工具结果名逐项一致                                   |
| error-recovery | `recovery.missing-file-then-list`     | 失败反馈进入下一轮请求、换策略成功、最终答复正确                                   |
| error-recovery | `recovery.repeated-failure-bounded`   | 重复失败有上界（模型提案 3 次、实际执行 2 次、`stopReason=error`）、无多余副作用   |

每个用例的 `metrics` 是数字/布尔/枚举，`evidence` 是机械证据（工具序列、文件快照哈希、
消息指纹）。判据不写"差不多就行"：每条都来自可观测事实。

## 一键跑

```bash
pnpm install --frozen-lockfile        # 只需一次；vitest 由 apps/cli 依赖提供
node benchmarks/agent-capability/run.mjs
```

等价的包内入口：`pnpm --dir benchmarks/agent-capability eval`（`evals/` 不在 pnpm workspace 里，
这是刻意设计：评测不参与产品构建，由 CI / 人工直跑）。

## 退出码与判读

| 退出码 | 含义                                                              | 处理                                                                           |
| ------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `0`    | `unchanged`（逐字段相同）或 `improved`（只有指标变好）            | 通过                                                                           |
| `1`    | `regressed`：用例通过→失败、指标变差、指标缺失、用例消失          | 修代码，禁止改基线来"消除"退化                                                 |
| `2`    | `changed`：夹具/证据指纹/exact 指标/新增用例变了，或找不到 vitest | 人工确认变化是预期的，再 `node run.mjs --update-baseline` 刷新基线并随代码评审 |

`changed` 单独给 2 而不是 0，是为了让"行为漂移但用例仍通过"也能在 CI 里红：只要工具序列、
文件快照或消息指纹变了，就必须有人复核并显式刷新基线，漂移不会静默通过。

终端输出形如：

```
基线对比结论: unchanged
[eval] 提交 <sha> · 夹具 <fixtureHash 前 12 位> · 用例 9（失败 0）
  PASS  compaction.degenerate-summary-guard
  ...
```

## 可复现性从哪来

1. **模型输出全部来自录制**。`src/replay.ts` 把 provider 固定在
   `http://eval-replay.local/v1`，任何真实模型地址都会被拒；录制必须**恰好消费完**（多一条、
   少一条都判失败）。测试里 `streamChat` 的远端实现被 mock 成直接抛错，不存在静默降级。
2. **不读本机配置**。`@cli/commands/settings.js` 被替换为用例显式声明的 `settings-state`；
   审计上报被 mock 丢弃，评测不产生网络副作用。
3. **快照只留确定性内容**。`src/snapshot.ts` 不含时间戳、耗时、绝对路径、随机 ID；工作区
   快照统一成相对 POSIX 路径 + LF 换行，Windows 本地与 Linux CI 可比。
4. **用例之间硬隔离**。每个用例一份全新临时目录，跑完即删；用例串行执行（工具注册表与 fetch
   stub 是进程级单例）。
5. **限流器必须重置**。`apps/cli/src/tools/index.ts` 的进程级限流器（10s / 5 次，wall-clock）
   会跨用例累积，且错误正文含动态毫秒数——不重置就会把上一用例的调用记到下一用例上，
   表现为续跑指纹莫名不一致。因此 `src/harness.ts` 的 `runTurn` 起手调用 `resetRateLimiter()`。
   这是全项目唯一一处显式进程状态重置，原因是"限流器是进程单例，不属于任何用例输入"。
6. **夹具哈希**。`fixtureHash` 是 `fixtures/` 全部文件的内容哈希；夹具一改，旧基线立即
   `changed`，不会用过期基线判绿。

已实测的确定性证据：在提交 `158c6f9559…` 上连续两次运行 `results/current.json` 字节完全相同
（sha256 `757942d54ed40d5730be4613953fcc396d9d427bdf0c703d86237457a3eacc3f`，
`fixtureHash` 前缀 `f7450dddd300`）。快照含提交号，换提交后 sha 必变——判「可复现」看同一提交内的
两次运行，而不是跨提交相等。`run.mjs` 每次都会把这枚 sha256 打进日志；
CI 每次拿新快照与仓库基线比较，任何非确定性都会以 `changed`/`regressed` 的形式红出来。

## 负控：先证明「差实现会掉分」

一份基线只有在**坏行为会被判红**时才成立。反过来（假实现与真实现同分）的评审事故说明夹具
没有区分度。本评测的负控不是"再跑一遍看它绿"，而是把录制改造成坏行为后跑同一条用例，
断言它必须 `passed === false`，且失败点落在预期的那条判据上：

| 能力           | 负控改法                                           | 必须变红的判据                                          |
| -------------- | -------------------------------------------------- | ------------------------------------------------------- |
| tool-call      | `direct-read` 录制里把 `read_file` 换成 `list_dir` | 工具序列恰好是 `read_file`；工具结果回填                |
| tool-call      | `invalid-arg-repair` 删掉补正后的成功调用          | 补正后的同类调用成功；path 参数被补正                   |
| resume         | 半回合那轮改成只给文本答案（工具对消失）           | 中断点停在半回合（工具对已执行、助手未收口）            |
| error-recovery | 删掉失败后的 `list_dir` 恢复段                     | 工具序列为「读失败 → 列目录 → 读成功」                  |
| compaction     | 采样返回空串 / 空白 / 占位正文（**用例内建负控**） | 退化摘要必须被判 `sampler-failed`，占位文本不得进上下文 |

实现方式：`src/fixtures.ts` 的 `setRecordingOverrides()` 让负控在录制层注入坏行为（深拷贝、
默认关闭，不改变正常读取路径）；负控在 `tests/eval.test.ts` 的独立 describe 里直接调用导出的
用例函数，不进入 `runAllCases()`，因此不会写进 `results/current.json` / 基线。测试输出会打印
`[负控] <用例> 判红断言: ...` 作为一手证据。负控若通过，说明该用例没有区分度，属于评测 bug。

resume 的负控刻意打在「半回合」断言上：它的其余判据是「落盘 vs 重载」自洽比较（被测能力
就是续跑一致性），对模型侧文本变化本就不敏感；这是设计口径，不是掩盖——若把半回合也改坏
（工具对消失），续跑断言立即判红。

## 基线纪律

- `baseline/baseline.json` 与代码同评审，**禁止手改**；只能由
  `--update-baseline` 生成。
- 新增指标必须先到 `src/metrics.ts` 登记方向（`higher-better` / `lower-better` / `exact`），
  未登记直接抛错——防止有人改口径让退化变成"没变"。
- `exact` 指标（布尔结论、`stopReason`）任何取值变化都只触发 `changed`，不会被误判成
  `improved` 或 `unchanged`。

## 新增用例

1. `fixtures/workspaces/<名字>/files.json`：初始工作区（相对路径 → 文本内容）。
2. `fixtures/recordings/<能力>/<用例 id>.json`：模型流录制；多轮用例可放目录并用
   `turn1.json` / `turn2.json` …（结构见 `src/replay.ts` 的 `validateRecording`）。
3. `fixtures/scenarios/<能力>/<用例 id>.json`：结构化场景数据（如长历史、事实清单）。
4. 在 `src/suites/<能力>.ts` 里加一个函数：`createCase(id, capability)` → `runTurn(...)` →
   逐条 `check(...)` → `metric(...)` / `evidence(...)` → `finish()`。
5. 新指标在 `src/metrics.ts` 登记方向。
6. `node benchmarks/agent-capability/run.mjs --update-baseline`，基线文件与用例代码同一个 PR。

## CI 集成

`.github/workflows/agent-capability-eval.yml` 在 `benchmarks/agent-capability/**` 或 `apps/cli/src/**` 变动时触发：
`pnpm install --frozen-lockfile` 后直接 `node benchmarks/agent-capability/run.mjs`，退出码即门禁
（`1` 退化、`2` 需刷新基线）。不需要 API Key、不联网请求模型，因此可以稳定跑在
`ubuntu-latest` 上，也不受模型供应商波动影响。

`benchmarks/**` 已在 `knip.jsonc` 的 `ignore` 中豁免（评测由 CI/人工直跑、不在产品依赖图里），
因此本评测目录不会被棘轮误计为未引用文件。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
