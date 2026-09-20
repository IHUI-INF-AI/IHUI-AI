# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""pytest 配置与 fixtures。"""

import os
import shutil
import sys
import time
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

# 确保 app 包可导入
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from httpx import ASGITransport, AsyncClient

# ---------------------------------------------------------------------------
# 2026-09-20 xdist loadscope 收尾竞态守卫(防 INTERNALERROR 中止全量跑)。
#
# 现象:全量跑至 90%+ 偶发 worker 无声退出 → xdist 重生新 worker →
# INTERNALERROR> KeyError: <WorkerController gwN>(loadscope.py:275),
# pytest 直接中止并丢用例(实测一次丢 ~525 例)。xdist 3.8.0 上游未修,
# 修复 PR #1299 仍在开放中。
#
# 机制:worker 猝死后 remove_node 把未完成任务重新入队;重生 worker 先走
# add_node()(写入 assigned_work[node]={}),稍后才走 add_node_collection()
# (注册 registered_collections[node])。两者之间若有任何 _reschedule(新worker)
# 被触发(其他 worker 完成用例 / 又有 worker 死亡 / collectionfinish 的
# schedule()),_assign_work_unit 查 registered_collections 即 KeyError。
#
# 修法:monkeypatch LoadScopeScheduling._reschedule,对尚未注册 collection
# 的 worker 直接跳过派活;等它注册后 collectionfinish → schedule() 会自然
# 派活,不丢任务也不饿死。try-import 容错:无 xdist / 串行运行时原样。
try:  # pragma: no cover - 仅 xdist 存在时生效
    from xdist.scheduler.loadscope import LoadScopeScheduling as _LoadScopeScheduling

    if not getattr(_LoadScopeScheduling, "_ihui_collection_guard", False):
        _loadscope_orig_reschedule = _LoadScopeScheduling._reschedule

        def _loadscope_reschedule_with_guard(self, node):
            if node not in self.registered_collections:
                return  # collection 未注册,此时派活必 KeyError;等注册后由 schedule() 派
            return _loadscope_orig_reschedule(self, node)

        _LoadScopeScheduling._reschedule = _loadscope_reschedule_with_guard
        _LoadScopeScheduling._ihui_collection_guard = True
except ImportError:  # pragma: no cover - 未安装 xdist 的环境
    pass


# ---------------------------------------------------------------------------
# 2026-09-20 性能立:per-run 隔离 basetemp,根治并发 pytest 互相毁灭。
#
# 缺陷(RUN8 实证,283 errors):pyproject addopts 的 --basetemp 是静态共享目录
# G:\.pytest_tmp,而 pytest 对显式 basetemp 会在每次启动时 rm_rf 整棵树 ——
# 多 agent 并行开发下两个 pytest 进程并发是常态,后启动的进程把先启动进程的
# popen-gwN worker 临时目录中途删光 → FileNotFoundError 洪水 + 大量用例报废,
# 且并发负载互相污染计时。
#
# 修法:controller 进程(无 workerinput)把 basetemp 覆写为独立目录树
# G:\.pytest_tmp_runs\run-<pid>,每场运行一个专属目录:
#   - 用户显式传 --basetemp 时尊重其选择,不覆写;
#   - xdist worker 的 basetemp 由 controller 下发(已是唯一目录 + popen-gwN),
#     且 worker 侧不再覆写(workerinput 判定);
#   - --noconftest 调用不加载本文件,仍走 addopts 的静态 G:\.pytest_tmp,
#     行为不变,但与 .pytest_tmp_runs 分树,其 rm_rf 波及不到本机制的目录;
#   - 非 Windows(CI Linux)不覆写,走 pytest 默认临时目录;
#   - 陈旧 run-*(mtime > 24h,崩溃残留)在启动时静默回收。
# 目录在仓库外(G:\ 根)、与仓库同盘 NVMe,保持 basetemp 迁移的性能收益。
def pytest_configure(config):
    if hasattr(config, "workerinput") or sys.platform != "win32":
        return
    if any(str(a).startswith("--basetemp") for a in config.invocation_params.args):
        return
    runs_root = Path(config.rootpath.anchor) / ".pytest_tmp_runs"
    # pytest 对显式 basetemp 只做 rm_rf + mkdir(不带 parents),父目录必须自建
    runs_root.mkdir(parents=True, exist_ok=True)
    config.option.basetemp = str(runs_root / f"run-{os.getpid()}")
    try:
        now = time.time()
        for stale in runs_root.glob("run-*"):
            if now - stale.stat().st_mtime > 86400:
                shutil.rmtree(stale, ignore_errors=True)
    except OSError:
        pass


# ---------------------------------------------------------------------------
# 2026-09-20 性能立:收集期重排序(重文件优先,LPT 列表调度)。
#
# xdist --dist loadfile 按收集顺序把文件装进 FIFO workqueue:worker 干完手头
# 文件就从队首领下一个(实证 xdist/scheduler/loadscope.py schedule() 按
# self.collection 顺序建队,_assign_work_unit popitem(last=False))。默认收集
# 序是字母序,重文件散布中段 → 先干完的 worker 只能领轻文件,个别 worker 背着
# [重文件 + 后领文件] 的链拖到最后,收尾大量 worker 空转。
#
# RUN 数据(2026-09-20 第二轮全量,durations=0 采集,wall 172.15s)的文件级
# 调度模拟:执行期总 sum=1369.8s(431 文件),20 worker 下
#   LPT makespan ≈ 103.4s = 最重单文件 test_publish_adapters_group2.py 的
#   实测总时长 —— 已触及「最重文件」结构下界(理论纯下界 sum/20 ≈ 68.5s;
#   再突破只能拆分 group1/group2,该两文件当前有他人在途改动,不越权);
#   预期实收 = 固定开销(启动/收集/导入)+ ~103s 执行期。
#
# 相对上一轮(RUN9)的关键变化:
#   - test_bench_golden.py 126.0 → 20.4:bench golden 执行器任务级并发改造
#     (run_bench.py 线程池,104.91s→19.99s 单用例);
#   - test_bench.py 82.4 → 60.0:run_bench 条件加载修复 smoke 隔离击穿,
#     self-healing smoke 不再打真实 API(82.51s 波动值 → 稳定 stub 链路成本,
#     xdist 单文件实测 durations 总和 ~60.7s;全量采集时打网态 47.5 偏低);
#   - 其余文件按新实测刷新,表扩到 top-45(占执行期 ~74%)。
#
# 权重 = 2026-09-20 第二轮实测的每文件 setup+call+teardown 总和。静态快照、
# 容忍漂移:未列文件保持原相对顺序(键 0),新增重文件最多退化为现状,不会
# 更差。sorted 为稳定排序:输入相同 → 输出相同,所有 worker 收集结果保持
# 一致(xdist 硬要求);同文件用例的相对顺序不变。
_TEST_FILE_WEIGHTS = {
    "tests/test_publish_adapters_group2.py": 103.4,
    "tests/test_publish_adapters_group1.py": 99.6,
    "tests/test_engine_harness_fourth.py": 76.6,
    "tests/test_bench.py": 60.0,
    "tests/test_hook_engine.py": 47.4,
    "tests/test_mcp_server.py": 42.1,
    "tests/test_engine_harness_eighth.py": 31.6,
    "tests/test_tool_approval_persist_52.py": 28.5,
    "tests/test_golden_e2e.py": 26.9,
    "tests/test_bench_golden.py": 20.4,
    "tests/test_sandbox.py": 20.2,
    "tests/test_mcp_export_usage.py": 20.0,
    "tests/test_native_fc_e2e_real.py": 19.8,
    "tests/test_routers.py": 18.6,
    "tests/test_llm_gateway.py": 16.3,
    "tests/test_file_editor_redis.py": 16.2,
    "tests/test_engine_harness_eleventh.py": 15.3,
    "tests/test_spec_generator.py": 14.6,
    "tests/test_engine_harness_thirteenth.py": 13.9,
    "tests/test_agent_checkpoint.py": 13.7,
    "tests/test_media_tasks.py": 13.5,
    "tests/test_mcp_stdio_bridge.py": 12.3,
    "tests/test_dag_worker_pool_four_layer_defense.py": 11.3,
    "tests/test_mcp_streamable_http.py": 10.0,
    "tests/test_business_flow_integration.py": 9.9,
    "tests/test_tool_approval.py": 9.8,
    "tests/test_hook_engine_integration.py": 9.4,
    "tests/test_memory_decay.py": 9.4,
    "tests/test_publish_playwright_base.py": 9.2,
    "tests/test_os_sandbox.py": 9.0,
    "tests/test_run_command_streaming.py": 8.5,
    "tests/test_self_healing_llm.py": 8.4,
    "tests/test_agent_self_heal.py": 8.4,
    "tests/test_orchestration_hub.py": 8.4,
    "tests/test_schema_check.py": 7.9,
    "tests/test_agent_engine_router.py": 7.4,
    "tests/test_koubo_workflow.py": 7.4,
    "tests/test_token6688_provider.py": 7.3,
    "tests/test_model_sync.py": 7.0,
    "tests/test_context_engine.py": 6.9,
    "tests/test_a2a_service.py": 6.7,
    "tests/test_engine_harness_tenth.py": 6.3,
    "tests/test_engine_harness_seventh.py": 6.2,
    "tests/test_api_v1.py": 6.0,
    "tests/test_telemetry_service.py": 5.9,
}


def pytest_collection_modifyitems(session, config, items):
    # 调试/复现顺序敏感问题的逃生口:IHUI_NO_LPT_REORDER=1 恢复字母序
    if os.environ.get("IHUI_NO_LPT_REORDER"):
        return
    weights = _TEST_FILE_WEIGHTS
    items[:] = sorted(
        items, key=lambda i: -weights.get(i.nodeid.split("::", 1)[0], 0.0)
    )

# ---------------------------------------------------------------------------
# 2026-09-20 性能立:pytest tmp_path 默认落系统 TEMP(本机 TMP=D:\caches\Temp,
# 位于 7200rpm HDD ST2000DM005),而仓库在 NVMe。全量 20 worker 满载时每用例
# 在 HDD 上并发创建/写删 SQLite(db + wal + shm,synchronous=FULL 每条 DDL/
# 事务一次 fsync)→ HDD ~120 IOPS 饱和,setup/call 排队,~25 个跨文件用例各被
# 拖到 ~84s(py-spy 抓栈实证:多个 worker 同时卡 SessionStore._migrate /
# journal_mode=WAL pragma)。三连修:
#   1) addopts 加 --basetemp=../../../.pytest_tmp → 临时文件迁到仓库外、
#      同盘 NVMe(每次运行被 pytest 清空,专用目录勿存他物);落仓库外是
#      硬约束:落仓库内会被 find_project_root 向上撞见真实 .git,
#      "仓库外"场景用例(git baseline/文档根越界)全翻车(RUN5 实证);
#   2) 此处设 IHUI_SQLITE_SYNCHRONOUS=OFF(session_store.__init__ 读该开关,
#      生产不设则默认 FULL,崩溃安全契约不变):测试进程无需崩溃持久性,
#      省掉每次事务的 fsync;
#   3) session_store 的 journal_mode=WAL 改为条件设置(已是 wal 则跳过),
#      省掉每次构造 Store 的一次独占锁 pragma。
os.environ.setdefault("IHUI_SQLITE_SYNCHRONOUS", "OFF")

# 2026-09-20 性能立:app.main 导入税 ~6.2s(LangChain/LiteLLM/Playwright 全链)。
# 不再模块级 import,改为首次使用时惰性加载:
#   - 纯单元测试文件所在的 xdist worker 完全免付 6.2s;
#   - --collect-only / IDE 测试发现同样免付(收集阶段不触发 fixture)。
# 关键陷阱:app.main 导入时 os.environ.setdefault 同步 .env vendor key
# (main.py L158/L164-170),而 autouse 的 _isolate_llm_env 先于 client fixture
# 执行 —— 清空发生在导入之前,会被 setdefault 冲掉。故 _get_app() 导入完成后
# 必须立即补清一次,保持"测试进程不携带真实 vendor key"的既有语义。
_app = None


def _get_app():
    """惰性获取全局 ASGI app(首次调用触发 app.main 导入,进程内仅一次)。"""
    global _app
    if _app is None:
        from app.main import app as _imported_app

        _app = _imported_app
        # 导入后立即补清 setdefault 同步进来的 .env vendor key:
        # - 若 key 来自 .env(app.main setdefault 添加):pop 即回到缺省态;
        # - 若 key 是外壳环境原有值:_isolate_llm_env 的 monkeypatch.delenv
        #   已记录原值,teardown 会照常还原,此处 pop 不破坏该语义。
        from app.core.llm_gateway import VENDOR_ENV_KEYS

        for _k in VENDOR_ENV_KEYS:
            os.environ.pop(_k, None)
    return _app


@pytest.fixture
async def client():
    """异步 HTTP 测试客户端(httpx + ASGI)。首次使用时触发 app.main 惰性导入。"""
    transport = ASGITransport(app=_get_app())
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture(autouse=True)
def _reset_rate_limit_buckets():
    """每个测试前清空共享 app 的进程内限流令牌桶(根治跨测试累积的偶发 429)。

    RateLimitMiddleware 按 (ip, prefix) 维护进程内 TokenBucket,而本文件的
    client fixture 复用同一全局 app 单例 → 桶状态跨测试文件累积。全量 CI 中
    13 个测试文件打 /api/llm/*,60 次/分钟的桶在 60s 窗口内被耗尽后,后续
    用例收到 429(2026-09-13 CI 实证:test_gemini_invalid_json_returns_400
    断言 400 实得 429;同代码前一轮通过,属时序敏感偶发,非代码回归)。

    逐层解包找到 RateLimitMiddleware 实例并清空桶。解包链(2026-09-13 实测):
    app.main.app 是 socketio.ASGIApp 包装器 → other_asgi_app = FastAPI 实例 →
    middleware_stack = 已构建的中间件链根 → 各层中间件经 .app 逐级下钻。
    三种属性名按序尝试,兼容包装层/框架层/中间件层各自不同的持有字段。
    找不到实例(栈尚未构建 / 中间件被移除)则无事可做 —— 没有活动限流器
    就不会产生跨测试 429,安全跳过。限流中间件自身行为由
    test_middleware.py::TestRateLimitMiddleware 与 test_input_sanitizer.py
    (独立最小 app + monkeypatch RATE_RULES)专项覆盖,不依赖共享桶状态,
    故清空不影响任何限流断言。

    惰性导入语义(2026-09-20):本进程尚未导入 app.main 时,共享 app 与限流桶
    都不存在,桶必然为空,直接跳过;首次 client 使用触发导入后,桶从零开始,
    同样满足"每测试前桶为空"的目标。
    """
    if "app.main" not in sys.modules:
        yield
        return

    from app.middleware.input_sanitizer import RateLimitMiddleware

    def _next(n):
        for attr in ("other_asgi_app", "middleware_stack", "app"):
            v = getattr(n, attr, None)
            if v is not None:
                return v
        return None

    node = _get_app()
    while node is not None:
        if isinstance(node, RateLimitMiddleware):
            node._buckets.clear()
            break
        node = _next(node)
    yield


# vendor env key 列表单一来源:app/core/llm_gateway.py 模块级 VENDOR_ENV_KEYS
# (LLMGateway._is_stub_mode 第二层直接用它判定,2026-08-31 提取为模块级常量)。
# _is_stub_mode 检查 os.environ 里这些 key 是否有任一非空 → 否就 stub 模式
# app.main 启动时通过 os.environ.setdefault 把 .env 真实 key 同步到 os.environ,
# 必须也清空这些 key,否则 _is_stub_mode 仍 False,会调真实 OpenAI API(测试无 key 必失败)
# 2026-08-31 修复:此前 conftest 维护副本漏 CLOUDFLARE_API_TOKEN / NVIDIA_API_KEY /
# OPENCODE_ZEN_KEY / GITHUB_TOKEN 等 → .env 含这些 key 时 stub 测试被误判非 stub
# (stream pre-flight 422 拦截)批量失败。现 import 权威列表,永不再漂移。


@pytest.fixture(autouse=True)
def _isolate_llm_env(monkeypatch, request):
    """隔离 .env 真实 API key:每个测试前清空 50+ os.environ vendor key,
    确保从干净状态开始。避免测试因 .env 中的真实 key 意外调用真实 API。
    需要真实模式的测试自行 monkeypatch 设置对应 key。
    同时 mock _resolve_from_db 避免 asyncpg 连接数据库(测试环境无 DB)。

    阶段 3 主体(2026-07-26):扁平字段已从 Settings 删除,无需再清空 settings.*_api_key。

    2026-08-25:select_key 的全局 mock 加 real_key_pool marker 闸门 ——
    test_key_pool_selector 直接测 KeyPoolSelector.select_key 真实选择逻辑,
    全局 mock 会把它打回 None 导致 5 个测试失败(assert None is not None)。
    标记 real_key_pool 的测试保留真实 select_key(内部自备 mock pool)。
    """
    # 清空 os.environ 里的 vendor key(app.main 启动时同步过;若本进程尚未
    # 导入 app.main,这里也会顺带完成 llm_gateway 的轻量导入并清掉外壳环境
    # 可能存在的同名 key —— 权威列表单一来源不因惰性化而漂移)
    from app.core.llm_gateway import VENDOR_ENV_KEYS

    for k in VENDOR_ENV_KEYS:
        monkeypatch.delenv(k, raising=False)

    # 2026-08-12 修复:COMBO_CHAINS 也会由 app.main 同步进 os.environ,
    # combo_router 构造时自动加载 → 不清理会污染 test_combo_router::test_list_combos
    # (环境泄漏导致断言 3==2)。与 vendor key 同规则清理。
    monkeypatch.delenv("COMBO_CHAINS", raising=False)

    # 2026-08-22 修复:settings.llm_providers(启动时从 .env 加载的 provider JSON)
    # 含真实 api_key 时,_is_stub_mode() 第一层即判非 stub → 测试打真实 LLM API
    # (慢/花 token/结果不稳定)。清空它,让 stub 判定只看被清空的 os.environ。
    from app.core.config import settings as _settings

    monkeypatch.setattr(_settings, "llm_providers", "")

    # 2026-08-31 修复:settings.github_token(.env 加载)非空时,
    # test_pr_reviewer::TestFetchPrDiff::test_success 断言 rate_limit=="anonymous"
    # 翻转为 "authenticated"(GITHUB_TOKEN 在 os.environ 清了但 settings 层漏清,
    # fetch_pr_diff 降级链 github_token or settings.github_token)。
    monkeypatch.setattr(_settings, "github_token", "")

    # 2026-08-22 修复:本地 .env 的 AGENT_EXECUTOR=loop_v2 会改变
    # /api/agents/execute/stream 的执行路径与 SSE 事件集(loop_v2 无 status/plan
    # 事件),而测试针对默认 langgraph 路径编写。显式锁 langgraph 保证确定性
    # (Phase 0 W1 已将生产默认翻转为 v2;测试里需要 v2 的用例自行 setenv/delenv)。
    monkeypatch.setenv("AGENT_EXECUTOR", "langgraph")

    # 2026-08-22 修复:清空 REDIS_URL。app.main 启动时把 .env 的真实
    # REDIS_URL 同步进 os.environ → WorkerPool._init_redis 等组件拿到真实
    # 客户端,submit/_persist 打真实 Redis IO —— 测试协程在真实网络 IO 上
    # 让出控制权,产生调度竞态(test_queue_full_rejected 曾因此 flaky +
    # teardown 死锁)。需要 Redis 的测试自行 monkeypatch.setenv。
    monkeypatch.delenv("REDIS_URL", raising=False)

    # 2026-08-22 补强:delenv 只挡住 os.environ.get("REDIS_URL") 的组件
    # (dag_scheduler/llm_budget_governor/agent_runtime);用 settings.redis_url
    # 的组件(skill_feedback/memory/hook_engine/telemetry/vector_memory 等)
    # 仍持有 .env 固化的真实地址。此前被"redis-py 8.x 默认 RESP3 → 老 Redis
    # HELLO 3 协商必败 → 降级内存"意外掩盖;protocol=2 修复(2026-08-22)后
    # Redis 真实可达 → 测试翻转失败(DLQ 计数/事件循环跨用/sio 房间断言)。
    # 单元测试不依赖外部 Redis 状态:指向端口 1(连接立即拒绝,确定性降级内存)。
    # 显式测试 Redis 行为的测试自行 monkeypatch settings.redis_url 覆盖本值。
    monkeypatch.setattr(_settings, "redis_url", "redis://127.0.0.1:1/0")
    monkeypatch.setattr(_settings, "schedule_redis_url", "redis://127.0.0.1:1/0")

    async def _noop_resolve_from_db(model, owner_uuid=None):
        return None

    monkeypatch.setattr("app.core.llm_gateway._resolve_from_db", _noop_resolve_from_db)

    # 2026-08-22 修复:_resolve() 三层优先级的第 2 层 KeyPoolSelector.select_key
    # 查真实 DB(ai_relay_key_pool)。测试环境共享 app.main 启动的 asyncpg pool,
    # 并发查询会 "another operation is in progress" 抛错,或拿到 DB 里真实号池
    # key → current_key_pool_id 非 None → complete/astream 走"号池换 key 重试"
    # 而非 FallbackRouter → fallback_used 标记丢失/测试结果随 DB 状态翻转。
    # 单元测试统一 mock 号池不可用(返回 None → 走 .env/llm_providers JSON 层),
    # 需要测号池故障转移的测试自行 monkeypatch 覆盖。
    # 2026-08-25:标 real_key_pool 的测试(test_key_pool_selector)保留真实
    # select_key,不被全局 mock 打回 None。
    if request.node.get_closest_marker("real_key_pool") is None:
        async def _noop_select_key(provider_code):
            return None

        monkeypatch.setattr(
            "app.services.key_pool_selector.KeyPoolSelector.select_key", _noop_select_key
        )


@pytest.fixture(autouse=True)
def _isolate_ab_test_db(monkeypatch):
    """隔离 ab_test_tracker 的真实 DB:全局把 `_get_pool` 换成 mock pool。

    2026-09-12 修复(生产库被测试污染 + 断言随 DB 状态漂移):
    多个用例在 monkeypatch `_get_pool` **之前**就调 `create_test` /
    `load_active_tests`,真实连上生产 PG,造成两类事故:

      ① 写入污染:`test_ab_test_tracker::TestLoadActiveTests::test_duplicate_skill_skipped`
         与 `test_shadow_runner` 系列在 mock 前 create_test →
         INSERT 真实 `agent_ab_tests`(累积 16 行 skill-a 测试垃圾);
      ② 读取漂移:`_ensure_loaded → load_active_tests` 把生产库残留的 running 行
         hydrate 进内存 → `len(stopped)==2`、`totalTests==3`,
         使 test_filter_by_status / test_filter_by_skill / test_with_tests 必失败。

    需要**断言** DB 调用的测试(TestPersistTestToDb / TestLoadActiveTests 的 mock 用例)
    在用例体内 monkeypatch 覆盖本值 —— 用例体晚于 autouse fixture 执行,覆盖后生效,
    其断言仍作用于自己的 mock,不受影响。
    """
    mock_pool = MagicMock()
    mock_conn = MagicMock()
    mock_conn.execute = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=[])
    mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
    mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)

    async def _mock_get_pool():
        return mock_pool

    monkeypatch.setattr("app.services.ab_test_tracker._get_pool", _mock_get_pool)


@pytest.fixture(autouse=True)
def _isolate_model_sync_db(monkeypatch):
    """隔离 model_sync 的真实 DB:全局把 `get_shared_pool` 换成"不可用"实现。

    2026-09-12 修复(测试直连生产库 → 断言随生产库状态漂移 + 反向删生产数据):
    test_model_sync::TestCleanupOldLogs / TestGetAggregatedStats 直接调
    `ModelSyncService.cleanup_old_logs()` / `get_aggregated_stats()`,二者内部
    `get_shared_pool()` 会真实连上共享 PostgreSQL,并真实执行 DELETE
    ai_model_sync_log。后果:
      ① 断言漂移:test_cleanup_returns_zero_when_no_table 断言"无表→deleted_count=0",
         实际返回值 = 生产库中 30 天前的历史行数;全量跑时库里恰有 6 条超龄行
         → 真删 6 条 → `assert 6 == 0` 失败(单跑时库内无超龄行 → 通过)。
      ② 数据破坏:该 DELETE 删的是生产库真实同步历史。
      ③ 污染来源:`with TestClient(app)` 用例触发 lifespan → model_sync
         `_sync_loop`(app/main.py:214 → model_sync.py:348)后台真实同步 + 清理,
         向生产库写 ai_model_sync_log;测试进程不应触碰生产库。

    注意:model_sync.py:70 是 `from ..core.db_pool import get_shared_pool` 绑定式导入,
    patch `app.core.db_pool.get_shared_pool` 对它无效,必须 patch
    `app.services.model_sync.get_shared_pool`。替换为抛异常后,model_sync 的全部
    DB 方法按既有契约优雅降级(cleanup→deleted_count=0 / stats→零值 dict /
    history→[] / _write_sync_log 静默),断言确定且不再触碰生产库。
    """

    async def _unavailable_get_shared_pool():
        raise RuntimeError(
            "测试隔离:model_sync 的 DB 访问已被 mock(不连真实 PostgreSQL)"
        )

    monkeypatch.setattr(
        "app.services.model_sync.get_shared_pool", _unavailable_get_shared_pool
    )


@pytest.fixture(autouse=True)
def _isolate_jwt_auth(monkeypatch, request):
    """隔离 JWT 中间件:清空 jwt_secret → middleware 走跳过路径(node_env=development)。

    .env 中配置了真实 jwt_secret 时,JWTAuthMiddleware 会验证 token,
    不带 token 的 HTTP 测试全部 401(test_routers/test_a2a 等)。
    清空 jwt_secret + node_env=development 后,middleware 直接放行。

    此前 test_dag_api/test_debug_api/test_message_bus/test_personas_router
    各自本地做过同样隔离(2026-08 修复),现提升为全局,消除逐文件遗漏。

    2026-08-25:加 real_jwt marker 闸门 —— test_jwt_auth 的 enable_jwt fixture
    显式设置真实 secret,但 autouse fixture 的 monkeypatch 在显式 fixture 之后
    生效会把它清回空,导致 _verify_token 解码失败(3 个测试 assert None)。
    标 real_jwt 的测试跳过本隔离,自行管理 jwt_secret。
    """
    if request.node.get_closest_marker("real_jwt") is not None:
        return

    from app.core.config import settings

    monkeypatch.setattr(settings, "jwt_secret", "")
    monkeypatch.setattr(settings, "node_env", "development")


@pytest.fixture(autouse=True)
def _isolate_vector_memory(monkeypatch):
    """隔离 vector_memory 单例:每个测试前清空状态 + 强制内存模式。

    原因:
    - conftest 默认 REDIS_URL 仍是 settings.redis_url(测试环境通常无 Redis)
    - vector_memory 默认 _use_redis=True,_get_redis 会尝试连接,失败后才降级
      (会卡住测试几秒,影响速度)
    - VectorMemoryStore 重构后用 _entries + _vectors(原 _store / _next_id 已移除)
    """
    from app.services.vector_memory import vector_memory

    def _force_memory_mode():
        vector_memory._use_redis = False
        vector_memory._redis = None
        vector_memory._entries.clear()
        vector_memory._vectors.clear()
        vector_memory._dirty = False
        vector_memory._hydrated = False

    _force_memory_mode()
    yield
    _force_memory_mode()


@pytest.fixture(autouse=True)
def _isolate_approval_persistence(monkeypatch, tmp_path):
    """隔离审批持久层:全局把 approval_grants.db 重定向到临时目录(每测试独立)。

    2026-09-20 修复(测试自毒化):test_engine_harness_policies::
    test_policy_always_forces_approval_for_low_risk_tool 走真实
    _request_approval 链路,其成功路径的批准落盘(agent_loop_v2 L3377
    _ap.grant("session", key, "mcp_tool"))会把 web_search 授权写入真实
    data/approval_grants.db;下次运行(含新进程)入口持久层预查命中
    'session' → 免弹窗直接执行 → 不发 tool.approval 事件 → 断言
    "未找到 tool.approval 事件" 失败(2026-09-20 全量第二轮实证,磁盘残留
    ('session','web_search\\x1f{"q": "x"}','mcp_tool') 即首次通过时自落盘)。

    单元测试不依赖跨进程磁盘授权状态:统一重定向到 tmp_path,彻底隔离。
    自带 set_db_path(tmp_path) 隔离的测试(test_approval_persistence_51 /
    test_tool_approval_persist_52 / test_network_approval_52 等)用例级覆盖
    依然生效(用例晚于本 autouse fixture 执行);teardown close + monkeypatch
    还原 _DB_PATH,连接惰性重建,不影响真实运行时路径。
    """
    from app.services import approval_persistence as _apm

    _apm.close()  # 关闭可能已打开的真实路径连接,强制按新路径惰性重建
    monkeypatch.setattr(_apm, "_DB_PATH", tmp_path / "approval_grants.db")
    yield
    _apm.close()  # 关闭指向 tmp 的连接;_DB_PATH 由 monkeypatch 还原为默认


# =============================================================================
# tool loop 端到端测试 fixtures(2026-07-24 立,提取自 .ihui-agent/tmp/mock_extension.py)
# =============================================================================

@pytest.fixture
def mock_extension_capability():
    """模拟 extension 端上报的 capability payload。

    参考 mock_extension.py 第 28-32 行 BROWSER_ACTIONS + 第 51-58 行 report_capability。
    用于测试 agent-control 路由的 capability 上报与 status 查询。
    """
    import uuid

    return {
        "endpoint": "extension",
        "instanceId": f"mock-ext-{uuid.uuid4().hex[:8]}",
        "browserActions": [
            "screenshot", "click_element", "type_text", "scroll", "extract_dom",
            "navigate", "wait_for_element", "get_attribute", "hover", "select_option",
            "switch_tab", "close_tab",
        ],
        "computerActions": [],
        "version": "mock-1.0.0",
        "reportedAt": "2026-07-24T00:00:00Z",
    }


@pytest.fixture
def mock_agent_action_handler():
    """模拟 extension 端执行 agent action 的 async handler。

    参考 mock_extension.py 第 99-131 行 handle_agent_action 逻辑:
    不同 action 返回不同 fake data(screenshot → base64 PNG / extract_dom → DOM 树 / 其他 → 通用)。
    """
    async def handler(
        request_id: str,
        action: str,
        category: str,
        params: dict,
    ) -> dict:
        """模拟执行 agent action,返回 fake data。"""
        if action == "screenshot":
            return {
                "screenshot": "mock-base64-png-data",
                "area": "viewport",
                "mock": True,
            }
        elif action == "extract_dom":
            return {
                "dom": [{"tag": "html", "text": "mock page"}],
                "count": 1,
                "totalMatched": 1,
                "mock": True,
            }
        elif action == "navigate":
            return {
                "url": params.get("url", "about:blank"),
                "title": "Mock Page",
                "mock": True,
            }
        else:
            return {
                "mock": True,
                "action": action,
                "executedBy": "extension",
            }

    return handler


@pytest.fixture
def captured_tool_results():
    """收集 tool-result 事件列表,用于 tool loop 测试中断言。

    测试中解析 SSE 流时,把 tool-result 事件追加到此列表,
    结束后检查 repeated / ok / errorCode 等字段。
    """
    return []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
