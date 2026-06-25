# 事故记录 (INCIDENTS)

> 记录项目开发与运维中发生的关键问题、根因、修复方案与防范措施
> 目标: 防止重复踩坑, 加快问题定位速度

---

## INC-2026-06-26-02: WebSocket 自动恢复系统与 ConnectionManager 解耦 (完善版)

**严重度**: P1 (WebSocket 服务可靠性)
**发生时间**: 2026-06-26
**修复时间**: 2026-06-26
**发现者**: 用户反馈 "不可以清理 要增加功能 完善功能"

### 现象
- `app/ws/auto_recovery.py` 是从 coze_zhs_py 迁移过来的, 但与新版 ConnectionManager 集成不完整
- 监控协程引用的属性 (active_connections, is_client_connected, remove_connection) 在新 manager 中不存在
- `_heartbeat_reaper` 后台任务从未被启动 (无调用方)
- `processing_tasks` 之外没有统一的 `_pending_tasks` 跟踪 (违反项目记忆)

### 根因
1. **接口不匹配**: auto_recovery 用 `active_connections` (dict), ConnectionManager 用 `_connections` (前缀下划线)
2. **方法缺失**: `is_client_connected` / `remove_connection` 在新 manager 中未实现
3. **心跳 reaper 死代码**: 类中定义了但无启动入口
4. **任务跟踪不统一**: 仅有 `processing_tasks` 跟踪出箱消费者, pubsub/reaper/TTL watchdog 未被跟踪
5. **集成缺失**: main.py lifespan 未调用 `initialize_auto_recovery`

### 修复

#### 1. `app/ws/manager.py` 新增兼容接口
- `active_connections` property → 返回 `_connections` 引用
- `is_client_connected(conn_id)` → 检查 client_state 非 DISCONNECTED/CLOSED/CLOSING
- `remove_connection(conn_id)` → disconnect 别名
- `_track_task(task)` 辅助方法 → 统一任务跟踪 (项目记忆: 防止 GC 丢异常)
- `_wait_pending_tasks(timeout)` → lifespan 退出时清理所有 _pending_tasks

#### 2. 扩展 ConnectionManager 后台任务
- `start_background_tasks()` 同时启动 `_outbox_consumer` 和 `_heartbeat_reaper`
- `start_redis_subscriber` / `_reconnect_pubsub` / TTL watchdog 全部经 `_track_task` 跟踪
- `stop_background_tasks` 等待所有 _pending_tasks 退出 (timeout=2s)

#### 3. `app/ws/auto_recovery.py` 扩展状态报告
- `get_status_report()` 新增 pending_tasks / total_messages_queued / background_tasks_started 字段
- 状态结构对外可观测, 供 `/api/v1/system/auto-recovery/status` 调用

#### 4. `app/main.py` lifespan 集成
```python
# 启动
from app.ws.auto_recovery import initialize_auto_recovery
from app.ws.manager import connection_manager as _ws_cm
await initialize_auto_recovery(_ws_cm)

# 关闭
from app.ws.auto_recovery import shutdown_auto_recovery
await shutdown_auto_recovery()
```

#### 5. 测试覆盖
- `tests/test_ws_auto_recovery_integration.py` - 32 个测试覆盖属性/方法/生命周期/状态报告
- 全部通过: 32/32 passed in 6.66s

### 防范措施
1. **跨模块依赖**: 迁移/重构时必须确认下游调用方使用的所有属性/方法
2. **后台任务必须有启动入口**: 编写后立即 grep 全仓库检查是否被启动
3. **任务跟踪统一**: 所有 asyncio.create_task 必须通过 `_track_task` 或类似集合
4. **集成测试**: 每次大改 manager, 必须新增测试覆盖与 auto_recovery 的协同

---

## INC-2026-06-26-01: alembic 迁移链 008 测试失效 (迁移重编号未同步测试)

**严重度**: P1 (CI 失败, 阻塞合并)
**发生时间**: 2026-06-26
**修复时间**: 2026-06-26
**发现者**: 全量测试 (pytest tests/) 自动暴露

### 现象
执行 `python -m pytest tests/ -x` 第一个失败用例:
```
FAILED tests/test_alembic_008_static.py::test_008_file_exists
  AssertionError: 迁移文件不存在: G:\IHUI-AI\server\alembic\versions\008_add_missing_tables.py
```

### 根因
迁移历史中 008-015 已被删除/合并, 当前迁移链从 016 重新编号:
- 016_add_refund_tables.py (down=None, chain root)
- 017-044 edu_* 域迁移
- 045_add_lecturer.py
- 046_g_pg_indexes.py
- 047_notify_persist.py (head)

但 `test_alembic_008_static.py` 仍硬编码 008_add_missing_tables.py 和 014_rename_sys_indexes head, 完全过时。

### 修复
重写为迁移链通用验证:
1. `test_001_init_sql_exists` - 基础 SQL 存在
2. `test_all_migrations_syntax_valid` - py_compile 通过
3. `test_all_migrations_have_revision_metadata` - revision/down_revision (None 允许) 元数据完整
4. `test_migration_chain_complete` - head=047_notify_persist, 链长 >= 30
5. `test_no_orphan_down_revisions` - 无悬空引用
6. `test_init_sql_has_create_tables` - 至少 10 个 CREATE TABLE

**测试结果**: 6/6 passed

### 防范
- 迁移重编号时, 同步检查 `tests/test_alembic_*.py` 系列测试
- 在 CI 跑全量 pytest 即可发现此类过期测试, 不依赖具体脚本
- 教训: 写测试时**避免硬编码迁移文件名/版本号**, 改为扫描 + 验证

---

## INC-2026-06-25-01: G 盘根目录误创建 (G:\\Users, G:\\tmp, G:\\1, G:\\dev)

**严重度**: P2 (影响开发体验, 不影响生产)
**发生时间**: 2026-06-24 18:41:29 (mtime of G:\\Users\\Administrator\\AppData\\Local\\Temp\\rewrite_edu_models.py)
**修复时间**: 2026-06-25
**发现者**: 用户 (报告 G:\\1, G:\\dev, G:\\tmp 自动创建, 后扩展发现 G:\\Users)

### 现象
在 G 盘根目录意外出现多个临时目录:
- `G:\1\pw-output` (来自 Playwright e2e 测试)
- `G:\dev\stdout` (来自某个 agent 工具)
- `G:\tmp\ro.css` (来自前端构建)
- `G:\tmp\refund_evidence` (来自退款证据上传)
- `G:\Users\Administrator\AppData\Local\Temp\rewrite_edu_models.py` (来自历史项目整合工具)

### 根因
Linux/macOS 风格的绝对路径在 Windows 上被错误解释:

| 风格 | 期望解析 | Windows 实际解析 | 影响 |
|------|----------|------------------|------|
| `/tmp/foo` | Linux `/tmp/foo` | `G:\tmp\foo` (相对当前盘) | 误创建 |
| `/var/log/x` | Linux `/var/log/x` | `G:\var\log\x` | 误创建 |
| `/Users/admin/x` | macOS `/Users/admin/x` | `G:\Users\admin\x` | 误创建 |
| `/home/user/x` | Linux `/home/user/x` | `G:\home\user\x` | 误创建 |
| `/etc/prometheus/x` | 容器内 | 主机 `G:\etc\prometheus\x` | 误创建 |

Windows 路径解析特性: 当看到 `/foo/bar` 开头的路径时, 解释为相对于**当前驱动器的根目录** (本项目 G:\\)。

### 修复方案
1. **配置层** ([server/app/config.py](file:///g:/IHUI-AI/server/app/config.py)):
   - `LOCAL_FILE_DIR` 改用 `tempfile.gettempdir()` 跨平台兜底
   - `model_post_init` 处理 .env 中空字符串回退
2. **脚本层**:
   - [refund.py](file:///g:/IHUI-AI/server/app/api/v1/refund.py): `_evidence_dir` 用 `tempfile.gettempdir()`
   - [canary_routes.py](file:///g:/IHUI-AI/server/app/api/v1/canary_routes.py): state_file 用 `tempfile.gettempdir()`
   - [backfill_persister.py](file:///g:/IHUI-AI/server/app/backfill_persister.py): 默认 SQLite 路径用 `tempfile.gettempdir()`
   - [drill_log.py](file:///g:/IHUI-AI/server/scripts/ops/drill_log.py): 平台感知 LOG_ROOT
   - [retry_drill_steps.py](file:///g:/IHUI-AI/server/scripts/ops/retry_drill_steps.py): 同上
   - [alipay_private_key_backup.py](file:///g:/IHUI-AI/server/scripts/alipay_private_key_backup.py): 临时密钥用 `tempfile.gettempdir()`
   - [helm_oci_publish.py](file:///g:/IHUI-AI/server/scripts/ci/helm_oci_publish.py): `OUT_DIR` 用 `tempfile.gettempdir()`
3. **测试层** (test_metrics_business.py, test_hls_transcode.py 等): 改用 `tempfile.gettempdir()`
4. **前端测试**: RefundComponents.test.ts 改用 `mock://` 占位符

### 防范措施
1. **扫描器** ([server/scripts/_scan_hardcoded_g_drive_paths.py](file:///g:/IHUI-AI/server/scripts/_scan_hardcoded_g_drive_paths.py)):
   - 扫描 `/tmp/`, `/var/lib/`, `/Users/`, `/home/`, `/etc/`, `/opt/`, `/var/log/`, `/var/run/` 硬编码
   - 扫描 G:\\1, G:\\dev, G:\\tmp, G:\\Users, G:\\home 等已发生过的禁止模式
2. **客户端专项扫描** ([server/scripts/_scan_client_hardcoded_paths.py](file:///g:/IHUI-AI/server/scripts/_scan_client_hardcoded_paths.py)):
   - 客户端代码专项扫描
   - 排除 API endpoint 路径 (如 `/home/banners`) 和 vendored lib (pdf.worker)
3. **CI 集成** ([.github/workflows/ci.yml](file:///g:/IHUI-AI/.github/workflows/ci.yml) `path-hygiene` job):
   - pytest + 静态扫描双层保险
4. **pytest 测试** ([server/tests/test_path_hygiene.py](file:///g:/IHUI-AI/server/tests/test_path_hygiene.py)):
   - 6 个测试覆盖 server + client + 配置 + .gitignore
5. **e2e 验证** ([server/tests/_e2e_full_verification.py](file:///g:/IHUI-AI/server/tests/_e2e_full_verification.py)):
   - 后端启动 + admin 登录 + G 盘根目录 5 处全检
6. **清理工具**:
   - [server/scripts/_delete_g_drive_artifacts.ps1](file:///g:/IHUI-AI/server/scripts/_delete_g_drive_artifacts.ps1): 增强清理
   - [server/scripts/_delete_empty_g_drive_dirs.ps1](file:///g:/IHUI-AI/server/scripts/_delete_empty_g_drive_dirs.ps1): 空目录清理
7. **.gitignore 兜底**: 根 + server 双层 `/G:/1/`, `/G:/dev/`, `/G:/tmp/`, `/G:/Users/` 等规则

### 经验教训
1. **跨平台开发必须用 `tempfile.gettempdir()` 而不是 `/tmp`** — 这是 Python 跨平台开发的第一原则
2. **Windows 路径解析特性** `/foo` 解释为 `G:\foo` (相对当前盘) — 在写路径时常被忽略
3. **agent 自动生成脚本时** 应避免 macOS/Linux 风格的硬编码绝对路径, 应使用平台无关 API
4. **CI 平台 ≠ 开发平台** — Linux CI 上的代码在 Windows 开发时可能产生意外行为
5. **PR 模板应加"路径变更自检"** — 任何路径相关 PR 必须经过 path-hygiene 测试

---

## INC-2026-06-25-02: FastAPI lifespan async generator 错误

**严重度**: P0 (后端无法启动)
**发生时间**: 2026-06-25 (本会话)
**修复时间**: 2026-06-25
**发现者**: CI 验证 + 后端启动测试

### 现象
后端启动失败, uvicorn 日志报:
```
TypeError: 'generator' object is not an async iterator
```
在 lifespan 函数调用时抛出。

### 根因
[server/app/main.py:38-39](file:///g:/IHUI-AI/server/app/main.py#L38-L39) 中:
```python
@asynccontextmanager
def lifespan(app: FastAPI):  # 错误: 应该是 async def
    ...
```

`@asynccontextmanager` 装饰的是普通 `def` 函数, 返回 sync generator, 但 FastAPI/Starlette 在 Python 3.10+ 要求 lifespan 是 `async` callable。

### 修复
```python
@asynccontextmanager
async def lifespan(app: FastAPI):  # 修复: async def
    ...
```

### 防范措施
1. **FastAPI lifespan 必须用 `async def`** — 这是 Python 3.10+ FastAPI 的硬性要求
2. **后端启动冒烟测试** 应加入 CI (本任务已加)
3. **lifespan 改动后** 必须本地启动验证, 不能仅看代码

---

## INC-2026-06-25-03: Pydantic Settings 空字符串覆盖默认值

**严重度**: P2 (配置不生效, 但不崩溃)
**发生时间**: 2026-06-25
**修复时间**: 2026-06-25
**发现者**: e2e 验证 + settings 配置检查

### 现象
`.env` 中 `LOCAL_FILE_DIR=` (空字符串) 会覆盖代码默认值 `tempfile.gettempdir()` 路径, 导致 `settings.LOCAL_FILE_DIR` 为空字符串而非预期的 `C:\Users\...\Temp\zhs_local_files`。

### 根因
Pydantic Settings v2 把空字符串视为有效值, 不会回退到 default。

### 修复
[server/app/config.py](file:///g:/IHUI-AI/server/app/config.py) `model_post_init`:
```python
if not self.LOCAL_FILE_DIR:
    self.LOCAL_FILE_DIR = os.path.join(tempfile.gettempdir(), "zhs_local_files")
```

### 防范措施
1. **任何带 .env 默认值的字段** 都应在 `model_post_init` 中加空值兜底
2. **CI 验证** 启动后端后, 跑 `python -c "from app.config import settings; print(settings.LOCAL_FILE_DIR)"` 验证配置正确

---

## INC-2026-06-25-04: 退款审计日志缺失 (历史 P0 修复)

**严重度**: P0 (合规 + 审计追踪)
**发生时间**: 历史
**修复时间**: 2026-06-25 (commit 8958996)
**发现者**: P0 安全审计

### 现象
退款端点 (alipay/wechat /refund) 缺少 require_login + 审计日志, 任何匿名调用都能触发退款。

### 修复
- [server/app/api/v1/refund.py](file:///g:/IHUI-AI/server/app/api/v1/refund.py) 所有端点加 `require_login`
- 退款审核 (`/review`) 加 `require_role("admin")`
- 高风险操作写 `logger.bind(audit=True).info(...)` 审计日志

### 防范措施
1. **任何涉及金钱/支付/退款的端点** 必须有审计日志
2. **静态审计脚本** [server/scripts/backend_audit.py](file:///g:/IHUI-AI/server/scripts/backend_audit.py) 扫描 P0-MissingAuth 问题
3. **P0 安全测试** [server/tests/test_p0_security_fixes.py](file:///g:/IHUI-AI/server/tests/test_p0_security_fixes.py) 14 个测试覆盖

---

## INC-2026-06-25-05: webhook 端点缺少 HMAC 签名验证 (历史 P0 修复)

**严重度**: P0 (外部 webhook 伪造)
**发生时间**: 历史
**修复时间**: 2026-06-25 (commit 8958996)
**发现者**: P0 安全审计

### 现象
`monitor/alerts` webhook 端点无 HMAC-SHA256 签名验证, 任何人都可以发送假告警。

### 修复
- webhook handler 加 HMAC-SHA256 验证, secret 从环境变量 `ALERTMANAGER_WEBHOOK_SECRET` 读取
- 签名不匹配返回 401, 阻止伪造

### 防范措施
1. **任何接收外部 HTTP 请求的端点** 必须有签名验证
2. **Webhook 集成测试** 覆盖"签名正确"和"签名错误"两条路径

---

## INC-2026-06-25-06: require_role 同步 DB 查询阻塞事件循环 (历史 P0 修复)

**严重度**: P0 (性能 + 可用性)
**发生时间**: 历史
**修复时间**: 2026-06-25 (commit 8958996)
**发现者**: P0 性能审计

### 现象
[server/app/security.py](file:///g:/IHUI-AI/server/app/security.py) `require_role` / `require_permission` 依赖中是同步 SQLAlchemy 查询, 在高并发时阻塞 asyncio 事件循环, 导致整个服务卡顿。

### 修复
```python
async def require_role(role: str):
    user_uuid = ...
    # 用 asyncio.to_thread 包装同步 DB 查询
    is_admin = await asyncio.to_thread(_check_role_sync, user_uuid, role)
```

### 防范措施
1. **任何 async 依赖中** 的同步 I/O (DB, Redis, 文件) 必须用 `asyncio.to_thread` 包装
2. **P0 静态审计** 自动扫描 `await` 函数内的同步 DB 调用
3. **性能测试** 应模拟高并发场景验证无事件循环阻塞

---

## 附录: 工具脚本

| 工具 | 用途 |
|------|------|
| `server/scripts/_scan_hardcoded_g_drive_paths.py` | 硬编码路径扫描 (主) |
| `server/scripts/_scan_client_hardcoded_paths.py` | client 子项目扫描 |
| `server/scripts/_check_prometheus_deploy.py` | Prometheus 部署平台检测 |
| `server/scripts/_delete_g_drive_artifacts.ps1` | 清理 G 盘根目录 |
| `server/scripts/_delete_empty_g_drive_dirs.ps1` | 清理空目录 |
| `server/scripts/backend_audit.py` | 后端 P0/P1/P2 静态审计 |
| `server/tests/test_path_hygiene.py` | 路径卫生 pytest 测试 |
| `server/tests/test_drill_log_path.py` | drill_log 跨平台测试 |
| `server/tests/test_p0_security_fixes.py` | P0 安全测试 |
| `server/tests/_e2e_full_verification.py` | e2e 完整验证 |
| `server/tests/_final_path_verification.py` | 最终路径验证 |
| `server/tests/_verify_outdir_no_g_drive.py` | OUT_DIR 验证 |
| `server/archive/_investigation_2026-06-25/_investigate_g_users.py` | G:\Users 调查 (已归档) |
| `server/archive/_investigation_2026-06-25/_investigate_g_users_deep.py` | G:\Users 深度调查 (已归档) |
| `server/archive/_investigation_2026-06-25/_cleanup_g_users_dir.py` | G:\Users 清理 (已归档) |

---

## 更新日志

| 日期 | 维护者 | 变更 |
|------|--------|------|
| 2026-06-25 | agent | 初版, 记录 5 个 INC (G 盘根目录/lifespan/Pydantic/退款审计/webhook/HMAC/require_role) |
