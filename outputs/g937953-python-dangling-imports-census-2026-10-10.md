<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# G-937953 · Python 侧悬空导入只读普查报告（HEAD 树）

- 仓库：`G:\IHUI-AI`，判 HEAD blob（`git show HEAD:<path>` / `git cat-file --batch`），工作树脏文件零接触，零 git 写操作
- 扫描日期：2026-10-10 · 扫描器：Python 3.13 `ast` + `sys.stdlib_module_names`

## 一、扫描概况

| 指标 | 数值 |
|---|---|
| HEAD 树 `.py` 文件总数 | 1429 |
| ast 解析成功 | 1429（成功率 100.0%） |
| B 档（未判定：语法错/编码错） | **0** |
| A 档（悬空导入条目） | **102 条 / 53 个文件** |
| C 档（干净文件） | 1376 |

> 条目数不等于文件数：一个文件可含多条悬空导入。C 档 1376 = 1429 − 53。

## 二、判定口径

1. 依赖声明集 = `apps/ai-service/requirements.txt` + `apps/ai-service/pyproject.toml`（dependencies / optional-dependencies / dependency-groups / build-system.requires）+ `packages/sdk/python/pyproject.toml`；HEAD 树无 `uv.lock`，无法取完整锁图。
2. 标准库 = 本机 `sys.stdlib_module_names`（Python 3.13，290 项）。
3. 仓内存在性按**路径后缀匹配**判定（包根可与仓库根不同，如 `apps/ai-service/app`），匹配 `.py` / `__init__.py` / 包目录。
4. `from 包 import 符号`：若包 `__init__.py` 在 HEAD 存在则宽判干净（符号可能定义于 `__init__`），仅对仓内单文件模块的硬缺失报悬空。
5. 人工复核后剔除 2 条误报：`app/__init__.py:7` 确有 `__version__`、`app/sio/__init__.py:26,44` 确有 `sio`（对应 slash_commands.py:172、sio/handlers.py:41 两条）。

## 三、A 档逐条明细

### A1 · 仓内模块悬空（Python 门的正主，共 3 条）

| 位置 | 模块 | 判定理由 |
|---|---|---|
| `apps/ai-service/app/services/hook_engine.py:1150` | `services.email_service` | HEAD 树 `app/services/` 下确无 `email_service.py`/`email_service/`（ls-tree 已证）；被 try/except ImportError 包裹，运行时静默降级 |
| `apps/ai-service/app/skills/content_engine/full_audit.py:659` | `visual_regression` | 仓内无 `visual_regression` 模块（`apps/ai-service/tools/` 不在 HEAD 树）；运行时 sys.path 注入外部工具路径 + try/except 兜底 |
| `apps/ai-service/bench/fixtures/fixture_cli_tools/cli.py:11` | `nonexistent_fake_module` | bench 评测教具**刻意**的坏代码（pyproject per-file-ignores 注明 fixtures 为教具并已豁免 lint），建议豁免不修 |

### A2 · 传递依赖未直接声明（82 条，按顶层名汇总）

| 顶层名 | 条数 | 来源传递链 | 说明 |
|---|---|---|---|
| `starlette` | 63 | fastapi、mcp 的硬传递依赖，运行时必然可用；建议直接显式声明或口径豁免 |
| `prometheus_client` | 9 | prometheus-fastapi-instrumentator 传递依赖 |
| `dotenv` | 5 | pydantic-settings 传递依赖 |
| `mcp_types` | 3 | mcp 2.x 传递依赖（mcp→mcp-types）。**注意**：本机 pip 已装 mcp-types 2.2.0 但 `import mcp_types` 实测 ModuleNotFoundError，可用性存疑，风险最高的一条链 |
| `websockets` | 1 | uvicorn[standard] extra 传递依赖 |
| `openai` | 1 | litellm / langchain-openai 传递依赖 |

<details><summary>A2 全部条目 file:line（点开）</summary>

- `apps/ai-service/app/core/config.py:343` — `dotenv`
- `apps/ai-service/app/core/jwt_auth.py:17` — `starlette.middleware.base`
- `apps/ai-service/app/core/jwt_auth.py:18` — `starlette.responses`
- `apps/ai-service/app/middleware/agent_metrics.py:19` — `prometheus_client`
- `apps/ai-service/app/middleware/audit.py:17` — `starlette.middleware.base`
- `apps/ai-service/app/middleware/audit.py:18` — `starlette.requests`
- `apps/ai-service/app/middleware/audit.py:19` — `starlette.responses`
- `apps/ai-service/app/middleware/input_sanitizer.py:24` — `starlette.middleware.base`
- `apps/ai-service/app/middleware/input_sanitizer.py:25` — `starlette.requests`
- `apps/ai-service/app/middleware/input_sanitizer.py:26` — `starlette.responses`
- `apps/ai-service/app/middleware/llm_metrics.py:17` — `prometheus_client`
- `apps/ai-service/app/middleware/response_sanitizer.py:27` — `starlette.middleware.base`
- `apps/ai-service/app/middleware/response_sanitizer.py:28` — `starlette.requests`
- `apps/ai-service/app/middleware/response_sanitizer.py:29` — `starlette.responses`
- `apps/ai-service/app/middleware/trace_context.py:19` — `starlette.middleware.base`
- `apps/ai-service/app/middleware/trace_context.py:20` — `starlette.requests`
- `apps/ai-service/app/middleware/trace_context.py:21` — `starlette.responses`
- `apps/ai-service/app/routers/self_healing.py:31` — `starlette.concurrency`
- `apps/ai-service/app/services/agent_loop_v2.py:2647` — `starlette.concurrency`
- `apps/ai-service/app/services/compaction_metrics.py:34` — `prometheus_client`
- `apps/ai-service/app/services/mcp_export.py:75` — `mcp_types`
- `apps/ai-service/app/services/mcp_export.py:89` — `mcp_types`
- `apps/ai-service/app/services/mcp_export.py:91` — `starlette.requests`
- `apps/ai-service/app/services/mcp_export.py:92` — `starlette.responses`
- `apps/ai-service/app/services/mcp_quality.py:24` — `prometheus_client`
- `apps/ai-service/app/services/model_sync.py:67` — `prometheus_client`
- `apps/ai-service/app/skills/content_engine/publish_pipeline.py:262` — `dotenv`
- `apps/ai-service/app/tools/browser_selfcheck.py:169` — `websockets`
- `apps/ai-service/bench/run_bench.py:80` — `dotenv`
- `apps/ai-service/bench/run_bench.py:81` — `dotenv`
- `apps/ai-service/test_rate_limit_fix.py:14` — `dotenv`
- `apps/ai-service/tests/test_agent_engine_router.py:24` — `starlette.testclient`
- `apps/ai-service/tests/test_agent_engine_router.py:25` — `starlette.websockets`
- `apps/ai-service/tests/test_agent_loop_v2.py:894` — `prometheus_client`
- `apps/ai-service/tests/test_audit.py:17` — `starlette.applications`
- `apps/ai-service/tests/test_audit.py:18` — `starlette.responses`
- `apps/ai-service/tests/test_compaction_metrics.py:14` — `prometheus_client`
- `apps/ai-service/tests/test_engine_abandoned_request_no_side_effect.py:20` — `starlette.requests`
- `apps/ai-service/tests/test_engine_principal_binding_59.py:27` — `starlette.testclient`
- `apps/ai-service/tests/test_input_sanitizer.py:18` — `starlette.applications`
- `apps/ai-service/tests/test_input_sanitizer.py:19` — `starlette.responses`
- `apps/ai-service/tests/test_jwt_auth.py:24` — `starlette.applications`
- `apps/ai-service/tests/test_jwt_auth.py:25` — `starlette.middleware`
- `apps/ai-service/tests/test_jwt_auth.py:26` — `starlette.requests`
- `apps/ai-service/tests/test_jwt_auth.py:27` — `starlette.responses`
- `apps/ai-service/tests/test_jwt_auth.py:28` — `starlette.routing`
- `apps/ai-service/tests/test_llm_metrics.py:25` — `prometheus_client`
- `apps/ai-service/tests/test_mcp_export_capability_proxy.py:33` — `starlette.requests`
- `apps/ai-service/tests/test_mcp_oauth_authorization_code_e2e.py:42` — `starlette.applications`
- `apps/ai-service/tests/test_mcp_oauth_authorization_code_e2e.py:43` — `starlette.requests`
- `apps/ai-service/tests/test_mcp_oauth_authorization_code_e2e.py:44` — `starlette.responses`
- `apps/ai-service/tests/test_mcp_oauth_authorization_code_e2e.py:45` — `starlette.routing`
- `apps/ai-service/tests/test_mcp_protocol_completeness.py:61` — `mcp_types`
- `apps/ai-service/tests/test_mcp_protocol_completeness.py:63` — `starlette.requests`
- `apps/ai-service/tests/test_mcp_streamable_http_e2e.py:35` — `starlette.applications`
- `apps/ai-service/tests/test_mcp_streamable_http_e2e.py:36` — `starlette.requests`
- `apps/ai-service/tests/test_mcp_streamable_http_e2e.py:37` — `starlette.responses`
- `apps/ai-service/tests/test_mcp_streamable_http_e2e.py:38` — `starlette.routing`
- `apps/ai-service/tests/test_middleware.py:19` — `starlette.applications`
- `apps/ai-service/tests/test_middleware.py:20` — `starlette.responses`
- `apps/ai-service/tests/test_middleware.py:21` — `starlette.testclient`
- `apps/ai-service/tests/test_middleware.py:723` — `prometheus_client`
- `apps/ai-service/tests/test_privileged_surface_auth_59.py:31` — `starlette.applications`
- `apps/ai-service/tests/test_privileged_surface_auth_59.py:32` — `starlette.middleware`
- `apps/ai-service/tests/test_privileged_surface_auth_59.py:33` — `starlette.requests`
- `apps/ai-service/tests/test_privileged_surface_auth_59.py:34` — `starlette.responses`
- `apps/ai-service/tests/test_privileged_surface_auth_59.py:35` — `starlette.routing`
- `apps/ai-service/tests/test_rbac.py:16` — `starlette.requests`
- `apps/ai-service/tests/test_rbac.py:114` — `starlette.middleware.base`
- `apps/ai-service/tests/test_response_sanitizer.py:16` — `starlette.applications`
- `apps/ai-service/tests/test_response_sanitizer.py:17` — `starlette.responses`
- `apps/ai-service/tests/test_session_import_auth.py:22` — `starlette.applications`
- `apps/ai-service/tests/test_session_import_auth.py:23` — `starlette.middleware`
- `apps/ai-service/tests/test_session_import_auth.py:24` — `starlette.requests`
- `apps/ai-service/tests/test_session_import_auth.py:25` — `starlette.responses`
- `apps/ai-service/tests/test_session_import_auth.py:26` — `starlette.routing`
- `apps/ai-service/tests/test_sse_trace_frame_d174.py:368` — `starlette.responses`
- `apps/ai-service/tests/test_sse_trace_frame_d174.py:408` — `starlette.responses`
- `apps/ai-service/tests/test_trace_context.py:20` — `starlette.applications`
- `apps/ai-service/tests/test_trace_context.py:21` — `starlette.responses`
- `apps/ai-service/tests/test_trace_context.py:22` — `starlette.testclient`
- `scripts/evals/run_humaneval.py:36` — `openai`

</details>

### A3 · 第三方未声明（17 条）

**硬使用（无 try/except，环境缺失即崩）**

- `apps/ai-service/app/services/connectors/yuque.py:37` — `requests` — 语雀 Connector 硬 import `requests`，依赖声明集无 requests（栈内主用 httpx）
- `apps/ai-service/app/skills/content_engine/lib/imgchr_uploader.py:16` — `requests` — 硬 import `requests`/`urllib3`，均未声明
- `apps/ai-service/app/skills/content_engine/lib/imgchr_uploader.py:17` — `urllib3` — 硬 import `requests`/`urllib3`，均未声明
- `apps/ai-service/tests/test_connectors_yuque.py:18` — `requests` — 测试硬 import `requests`，未声明
- `scripts/locustfile.py:23` — `locust` — 压测脚本硬 import `locust`，未声明（dev 依赖组也未含）

**可选降级（try/except ImportError 包裹，未装即降级）**

- `apps/ai-service/app/services/codebase_indexer.py:49` — `anydoc` — 声明的是 firecrawl-anydoc，导入名 anydoc 不匹配声明名；未装时降级旧实现
- `apps/ai-service/app/services/codebase_indexer.py:223` — `tree_sitter` — 未声明，未装时代码切片降级正则模式
- `apps/ai-service/app/services/codebase_indexer.py:224` — `tree_sitter_language_pack` — 顶层名 `tree_sitter_language_pack` 不在 HEAD 树（无同名 .py/目录），且不在标准库与依赖声明集（import）
- `apps/ai-service/app/services/codebase_indexer.py:238` — `tree_sitter` — 未声明，未装时代码切片降级正则模式
- `apps/ai-service/app/services/codebase_indexer.py:239` — `tree_sitter_language_pack` — 顶层名 `tree_sitter_language_pack` 不在 HEAD 树（无同名 .py/目录），且不在标准库与依赖声明集（from-import）
- `apps/ai-service/app/services/im/feishu_lark.py:51` — `lark_oapi` — 未声明（飞书 SDK），未装时降级 httpx REST
- `apps/ai-service/app/services/spec_generator.py:1409` — `watchdog.observers` — 未声明，未装时返回 watchdog_not_installed
- `apps/ai-service/app/tools/document_asset_tools.py:39` — `anydoc` — 声明的是 firecrawl-anydoc，导入名 anydoc 不匹配声明名；未装时降级旧实现
- `apps/ai-service/app/tools/document_tools.py:32` — `anydoc` — 声明的是 firecrawl-anydoc，导入名 anydoc 不匹配声明名；未装时降级旧实现
- `apps/ai-service/app/tools/document_tools.py:33` — `anydoc` — 声明的是 firecrawl-anydoc，导入名 anydoc 不匹配声明名；未装时降级旧实现
- `apps/ai-service/tests/conftest.py:38` — `xdist.scheduler.loadscope` — pytest-xdist 的导入名（声明名不匹配），try-import 容错
- `apps/ai-service/tests/test_codebase_indexer.py:28` — `anydoc` — 声明的是 firecrawl-anydoc，导入名 anydoc 不匹配声明名；未装时降级旧实现

## 四、B 档（未判定）

**0 个文件**。1429 个 HEAD blob 全部通过 `ast.parse`，无语法错/编码错。

## 五、一句话结论

**存量非 0，但 Python 门的正主极小**：对标守门 98 的「import 仓内不存在模块」口径，真正的仓内悬空仅 A1 档 3 条（1 条刻意教具 + 2 条 try/except 降级兜底，硬悬空且无兜底的为 **0**）；其余 99 条全是第三方依赖卫生问题（82 条传递依赖未直接声明 + 17 条未声明第三方，其中 requests/urllib3/locust/mcp_types 无降级硬使用，属另一把「依赖声明」尺子的对象）。**倾向报数档而非判红档**：Python 扩面门第一版只锁 A1 类（锚点=各文件 HEAD 自身存量，初始棘轮 3 条），A2/A3 移交依赖声明 lint 单独立尺——现在判红会把依赖卫生误当悬空缺陷，噪声比 33:1。

## 六、可复跑命令清单

```bash
# 0) 枚举 HEAD 树 .py（唯一输入，绝不读工作树）
git ls-tree -r HEAD --name-only | grep '\.py$' > /tmp/ihui_py_files.txt

# 1) 抽依赖声明（HEAD blob）
git show HEAD:apps/ai-service/requirements.txt
git show HEAD:apps/ai-service/pyproject.toml
git show HEAD:packages/sdk/python/pyproject.toml

# 2) 逐文件取 blob 并 ast 解析（脚本经 git cat-file --batch 全只读；脚本与结果均落在仓外中性路径 D:\DevEnv\Temp）
python D:/DevEnv/Temp/ihui_census_scan.py
#    输出: D:\DevEnv\Temp\ihui_census_result.json

# 3) 人工复核抽样（示例）
git show HEAD:apps/ai-service/app/services/hook_engine.py | sed -n '1145,1155p'
git show HEAD:apps/ai-service/app/__init__.py | grep -n __version__
git ls-tree HEAD apps/ai-service/app/services/ --name-only | grep -i email
```

扫描器副本：`D:\DevEnv\Temp\ihui_census_scan.py`（仓外，不影响工作树）。判定辅助的已知 import 名↔发行名映射（PIL→pillow、jwt→pyjwt、socketio→python-socketio、bs4→beautifulsoup4 等）与依赖名前缀链（opentelemetry-sdk→opentelemetry）内置其中。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
