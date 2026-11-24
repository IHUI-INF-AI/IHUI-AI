<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# N-workbook-py 席 · 心跳 / 结清

- HEAD（收尾当次实测）：`5ecf1322f1`（开工时为 `60af71ad116e8bc7892e647de93934530dca0b4f`；
  中途别席落了 `Merge 78028d8a… into 572470b6…` union 提交 ⇒ 收尾凭据在**合并后的树**上复跑一遍，见下）
- 状态：**做完了**（三条任务目标全落，凭据齐；未做 recalc/convert = 红线刻意不对齐）
- 本席改动面（只这三个文件，`apps/api/**` 一字节未动）：
  - `G:/IHUI-AI/apps/ai-service/app/services/workbook_agent.py`
  - `G:/IHUI-AI/apps/ai-service/app/services/mcp_server.py`（只动 workbook 那 4 枚 handler）
  - `G:/IHUI-AI/apps/ai-service/tests/test_workbook_agent.py`（新建，21 例）

## 现场复核结论（以代码为准）

主席口径基本属实，四处需要更正：

| 项 | 主席口径 | 实测 |
| --- | --- | --- |
| `workbook-service.ts` 行数 | 817 | 872 |
| `routes/workbook.ts` 行数 | 144 | 159 |
| `workbook_agent.py` 状态 | 未入库 | 本席收尾时索引里已是 `AM` ⇒ **有别席已 `git add`**（非本席动作，本席未碰 add/commit/push） |
| `-p no:xdist` | 硬约束要求 | `apps/ai-service/pyproject.toml:207` 明文禁用（会把插件连 addopts 的 `-n/--dist` 一起打成 exit 4）⇒ **以仓内配置为准**，走 `pnpm check:pytest` 唯一入口 |

## 凭据末行现读

```
pnpm check:pytest -- tests/test_workbook_agent.py
  run 档:collected=21 passed=21 failed=0 errors=0 skipped=0 rc=0
  RESULT verdict=GREEN exit=0

pnpm check:pytest -- tests/test_workbook_agent.py tests/test_mcp_server.py tests/test_internal_ticket_senders.py
  collected=205 passed=205 failed=0 errors=0 ⇒ RESULT verdict=GREEN exit=0

apps/api vitest（未改，复核主席口径）
  Tests  23 passed (23)

node scripts/check-mypy.mjs --worktree
  Success: no issues found in 678 source files  ✅ 守门通过(0 errors)

uvx ruff check <三文件>
  All checks passed!

node scripts/check-watermark-syntax.mjs <三文件>   → 全部通过(取材=显式文件 3 个)
node scripts/watermark.mjs verify <三文件>          → 残迹 0 / 载荷损坏 0 / 仅隐写 0
```

末轮补刀：摘掉 `internal_headers`（全仓零消费者，§3 零冗余 / 门 121「声明必须有消费者」），
只留 `outbound_headers` 一枚出口；模块头注里那条已不存在的 `skipped_missing_identity` 状态一并抹掉
（文档不得描述跑不通的形态，§0.8）。

## 别席 union 合并落进来之后的复跑（HEAD=`5ecf1322f1`，三文件均未被动过）

```
pnpm check:pytest -- tests/test_workbook_agent.py
  collected=21 passed=21 failed=0 ⇒ GREEN exit=0
pnpm check:pytest -- tests/test_workbook_agent.py tests/test_mcp_server.py
  collected=197 passed=197 failed=0 errors=0 ⇒ GREEN exit=0
node scripts/check-mypy.mjs --worktree   → ✅ 0 errors, 678 source files
uvx ruff check <三文件>                  → All checks passed!
```

本席**未**执行任何 `git add`/`commit`/`push`（主席 pathspec 落地）。收尾时 `workbook_agent.py` 与
`test_workbook_agent.py` 在工作树上为 `??`（未跟踪），`mcp_server.py` 为 `M `（索引==工作区）
—— 开工时 `workbook_agent.py` 一度是 `AM`（别席曾把它 stage 过），合并轮之后回到 `??`。

## Python ↔ api 对不上（7 处，全部按「以 api 为准改 Python」修）

1. `open` 丢了 `fileId`（api `OpenWorkbookData.fileId`，workbook-service.ts:524/587）
2. `protocolVersion` 只在 open 透传（api `send()` routes/workbook.ts:102 对**五条**命令都注入）
3. `write_cells` 丢了 `sourceSha256Before` / `sourceSha256After` / `bytes`（api SaveWorkbookData:727-729/813-815）——这正是非破坏式的**凭据三键**
4. `_post` 成功面 `data` 非对象时回落 `{}` ⇒ `read_range` 回 `cells: []` 冒充"读过了"（§0.3 禁型）
5. `internal_headers` 只要 `x-user-id` 在就判"有头"：无 JWT_SECRET 且无常驻密钥时**零凭据请求照发**，api 回 401 → 客户端报 `HTTP_401`（读成"没权限"，真问题是"本机没配凭据"）
6. 失败信封 `status` 只分 `refused` / `upstream_unavailable`：api 具名的两枚**未判定**码（`WORKBOOK_HANDLE_UNDETERMINED` / `WORKBOOK_UNJUDGED`）被折进 `refused` = 把"没判"说成"判过"
7. `written_not_saved` 半成功态在 `status` 位占坑，与 api 的判定态争同一个字段 ⇒ 挪到 `subStatus`

## 注册面（mcp_server 那 165 行）改动

- schema **没有**泄漏身份：五枚 workbook 工具入参键集与 `ROUTING_IDENTITY_KEYS`（从 `packages/types/src/tool-contract.ts` 现读，非复制）不相交 ⇒ 已由测试钉住，未改。
- 改了 3 处：① 4 枚 handler 的 `cells` 非数组被折成 `[]`（结论换成"cells 不能为空"）⇒ 原样透传，由客户端点名收到的类型；② 4 枚 handler 函数内 import 未排序（ruff I001 × 4，死掉的上一席没跑 ruff）；③ `detail.reason`（exceljs 异常原文）直灌模型面 ⇒ 在客户端加投影，剥 `reason`、留结构位（`cellCount`/`limit`/`formulaTargets`…）。
- **未**入 `_ADMIN_ONLY_TOOLS`：归属由 api 逐请求现问，与 `edu_*` 同档，理由原注保留。

## 对齐 / 刻意不对齐

- 对齐：`open / read_range / write_cells / save_archive(→落新档) / close` 五枚命令语义，加握手位 `protocolVersion`。
- 刻意不对齐（红线）：`recalc_cells`（exceljs 无计算引擎 ⇒ 公式格只回原文 + `state=formula-uncomputed` + `cachedValueWithheld`，绝不拿缓存值冒充当前值）、`convert_workbook`（未做）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
