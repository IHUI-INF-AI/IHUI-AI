<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# ai-service 沙箱实现缺失：main 上 apply_child_runtime_guard「调用面在、实现面缺」

- 日期：2026-11-08
- 归属：产品代码缺陷（apps/ai-service 沙箱路径），不是存量测试判据问题
- 取证基线：main `1513c11c13` / 当前 `origin/main` `0f55b562fc`；修复分支 `fix/ai-service-stock-red-1108`（`764221fff7`）

## 现象

`apps/ai-service/app/services/os_sandbox.py` 从 `app.core.exec_env` 导入 `apply_child_runtime_guard`，并在 `guarded_child_env` 内两处调用；但 main 的 `apps/ai-service/app/core/exec_env.py` 没有该函数定义 ⇒ 模块 import 即 `ImportError`，沙箱路径当场不可用。对应用例：

- `apps/ai-service/tests/test_security_batch10_r4.py::TestRestrictedTokenFailClosed::test_restricted_token_spawn_failure_raises_without_fallback`
- 组内计数：修前 9 failed / 1060 passed / 2 skipped；修后 0 failed / 1069 passed / 2 skipped。

## 单独定性（勿并入存量测试红）

- 唯一实现提交 `96366c4f0e`（2026-11-06 20:21，A5）只存在于 `origin/fix/ai-service-admission-runtime-1106`；`git log --all -S'def apply_child_runtime_guard'` 只有这一枚，从未进入 main。
- 调用面提交 `e3fc2b1ac4`（2026-11-07 16:15）已是 main 祖先，它新增了 `os_sandbox.guarded_child_env` 的导入与调用。
- 因此不是「合流丢失」，而是**实现分支未合入 main、调用面先合入** ⇒ main 上「调用面在、实现面缺」。

## 影响

main 上 ai-service 一旦导入 `os_sandbox`（含 `sandbox_exec` 路由与沙箱指标消费面）即 `ImportError`；属于产品能力缺失，必须先补实现，不能按测试问题处理。

## 处置与现状

- `fix/ai-service-stock-red-1108`（`764221fff7`）按 `96366c4f0e` 原实现逐字恢复：`git diff 96366c4f0e:apps/ai-service/app/core/exec_env.py` 与工作树同名文件为空；恢复含 7 档未判定 reason 与 bash-env/node-options/python-path 三档钩子。
- 该分支与 `origin/main`（`0f55b562fc`）虚拟合并不冲突：`git merge-tree --write-tree` rc=0，结果树 `76b6131690`；差异仅 4 文件（`exec_env.py` / `mcp_export.py` / `mcp_server.py` / `test_mcp_quality.py`）。

## 验收入口

- `tests/test_security_batch10_r4.py` 该用例由红转绿；
- apps/ai-service mcp 与安全组全量：0 failed / 1069 passed / 2 skipped；ruff 4 文件全过。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
