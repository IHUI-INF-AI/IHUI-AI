<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# ai-service p0p1 合并交接（2026-11-08）

分支：`fix/ai-service-p0p1-1108`（交接时 tip `21bd5a2df1`）
状态：**main 侧已跳过该分支**，等其他会话按下列口径收口后再合。合并 worktree 已 `git merge --abort`，工作树干净。

合并时文本冲突 4 处（`app/routers/tools.py`、`app/services/mcp_server.py`、
`tests/test_file_search_ripgrep_v75.py`、`tests/test_security_p1_media_local_path_ais050.py`），
但真正阻断的是**语义**：同函数两侧判据不同 + 分支内多处陈旧夹具。以下五条为裁决口径。

## 1. `user_id`：以 main 为准（严格）

- main：`apps/ai-service/app/routers/tools.py:110` `model_config = ConfigDict(extra="forbid")`，
  请求体无 `user_id` 字段（`tools.py:112-119`）；身份只取 `principal`（`tools.py:132`
  `principal: str = Depends(require_request_user_id)`），AIS-100 说明见 `tools.py:140-142`。
- p0p1：`tools.py:122` `user_id: str | None = Field(None, ...)`；`tools.py:181-191`
  `DEV_ANONYMOUS_PRINCIPAL` + `int(role_id) >= 1` 可代他人。
- 收口要求：**不要复活 body 字段**；`role>=1 可代他人` 的请求体实现撤下。若确需代操作，
  后续单开 admin-only 端点 + 审计，不在本次合并里做。
- 夹具：`tests/test_codebase_index_freshness.py:297-364`（4 例）改为 principal 驱动
  （`:321/:338/:351/:364` 的 `user_id="u-1"/"u-2"` 走 `require_request_user_id` 覆盖），
  **断言（刷新行为/拦在入口零出域）不变**。

## 2. 越界文案：取 main 的详细版

- main：`app/services/mcp_server.py:938` `f"路径不在工作区白名单内: {path}"`（带允许根目录）。
- p0p1：`test_mcp_server.py:2086`、`:2106` 断言 `"路径不允许"`；
  `test_api_v1.py:748` 同。
- 收口要求：断言改匹配「不在工作区白名单」+ 路径本身，仍必须断言**拒绝且点名路径**，强度不降。

## 3. 错误码：取 main 的两级码

- main：`mcp_server.py:1063` `PATH_NOT_ALLOWED`、`:1065` `SENSITIVE_FILE_BLOCKED`
  （另见 `:1562/:1969/:2630`）。
- p0p1：`test_api_v1.py:774` 断言 `PATH_BLOCKED` —— 与它自己 `:1063` 的 `PATH_NOT_ALLOWED` 矛盾，
  属分支内陈旧夹具。
- 收口要求：改到 `PATH_NOT_ALLOWED`。

## 4. 策略表计数：不许改数字了事（三方差集已核，为空）

三方差集（main / p0p1 / 合并结果）**完全一致，无条目丢失**：

| 键 | main | p0p1 | 合并结果 | 只在 main | 只在 p0p1 |
|---|---|---|---|---|---|
| `dangerous_patterns` | 28 | 28 | 28 | 空 | 空 |
| `allowed_prefixes` | 31 | 31 | 31 | 空 | 空 |
| `sensitive_file_markers` | 6 | 6 | 6 | 空 | 空 |

证据：`apps/ai-service/app/data/command_policy.json` 两侧 blob 完全相同
（`HEAD` 与 `origin/fix/ai-service-p0p1-1108` 均为 `b5b88e01d8f81b974806161c1a72230c1ddfa10a`），
合并结果再读一次仍是 28/31/6。

- 结论：`tests/test_command_policy_merge_wiring.py:156-158` 断言的 `31/31/6` 是**分支内陈旧夹具**
  （在该分支自身也读不到 31，属自相矛盾）。
- 收口要求：断言改 `28/31/6`，并在测试里写明「28 为 main 与 p0p1 的同一份策略表，
  `command_policy.json` blob `b5b88e0`，三方差集为空」。**若后续再发现条目减少，补条目，不许改数字。**

## 5. `_audio_source_from_args`：4 元组

- 分支代码：`mcp_server.py:9611` 定义为 4 元组返回；唯一生产调用点 `:9763`
  `audio, filename, err, err_code = _audio_source_from_args(arguments)`。
- p0p1 夹具仍按 3 值解包：`tests/test_api_v1.py:747/756/765`
  `data, _name, err = ...` → stale。
- 收口要求：改测试对齐 4 元组，并核所有调用点（含
  `tests/test_security_batch32_mcp_ssrf_redirect.py:222` 的间接调用）都按 4 值解包。

## 合并侧另外两条待分支作者确认（Windows 平台红，非裁判据）

- `tests/test_run_command_streaming.py:234/264/270/276/282` 期望 `DANGEROUS_COMMAND`；
  Windows 下 `_shell_interpretation_of` 对 `echo & …` 判 `cmd /c` → `SHELL_METACHARACTER_BLOCKED`。
  需按平台分支断言或标记 skip，别把平台差异当判据变更。
- `tests/test_security_p1_media_local_path_ais050.py` 两条 upload 调用需带正常主体
  （main 已合 mcp-media 时补 `"__user_id"`；分支侧用 `"u-050"`），否则归属校验先于路径闸触发。

## 收口完成后的回报要求

给出稳定 tip + 一句「已按上述口径收口」+ 在该分支上跑过的夹具读数
（`uv run --extra dev pytest`；必须带 `--extra dev`，否则缺 pytest-asyncio 会 432 假红）。

## 合并复核结果（2026-11-08，tip `92f67fe33d`）

已合并。复核结论：

- `user_id`：请求体已不接受（`extra="forbid"`），身份走 `principal`，4 例 freshness 夹具改 principal 驱动，通过。
- 越界文案/错误码：代码与夹具基本对齐；**残留 1 处** `tests/test_mcp_server.py:2086`
  （`test_file_search_rejects_existing_root_outside_workspace`）仍断言旧文案「路径不允许」，
  合并后因代码取 main 详细版而变红。已按裁决 #2 就地改为
  「不在工作区白名单」+ 路径本身（仍断言拒绝且点名路径）。
- 策略表：main 侧**从来没有**那 3 条（`command_policy.json` 自 `b3e3723331` 创建起即 28，
  本波次前 `cfcd69a6c6` 也是 28/31/6，且 `git log -S` 查不到增减记录）→ 这是 main 存量债，
  不是本轮合并丢失。合并后 31/31/6，`test_command_policy_merge_wiring` 通过。
- 4 元组：已对齐，调用点全部按 4 值解包。
- 夹具对照：合并树 887 passed / 19 failed；分支 tip 883 passed / 23 failed。
  19 条与分支 tip 同集（9 条 run_command_streaming 子进程/Windows、5 条 api_v1 agent 桩、
  `workspace_index_policy` phase、`p0_task` 错误码、`media_auto_routing`、`freshness` 删除文件），
  属已知存量红；**合并反而修掉了分支 tip 的 4 条 mcp_server unreadable 红**（取 main 代码后消失）。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
