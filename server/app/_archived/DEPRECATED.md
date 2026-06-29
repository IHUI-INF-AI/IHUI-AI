# Archived: Shadow Traffic / Canary 子系统

## 状态: DEPRECATED — 已建未接线

本目录包含一组功能完整但从未接入生产请求路径的影子流量系统。

## 归档原因

经死代码分析验证:
- `main.py` 中零处引用 shadow 模块
- `canary_routes.py`(已注册路由)不引用任何 shadow 模块
- `canary_metrics.py` 中的 `sync_canary_shadow_all()` 和 `get_shadow_ratio_snapshot()` 定义了但从未被调用
- shadow 模块仅在 `tests/test_shadow_*.py` 和 `tests/test_canary_shadow_link.py` 中被引用

## 文件清单

| 文件 | 功能 |
|------|------|
| `shadow_traffic.py` | ShadowRouter: 影子流量路由器,按比例复制请求 |
| `shadow_compare.py` | ShadowCompareAggregator: 对比 v1/v2 响应差异 |
| `shadow_whitelist.py` | 影子流量白名单过滤 |
| `shadow_ratio_controller.py` | ShadowRatioController: 基于错误率自动调比 |
| `canary_shadow_link.py` | 金丝雀阶段与影子流量联动 |

## 可能原因

为 v1→v2 后端迁移准备的影子对比基础设施,迁移完成后未启用即搁置。

## 恢复方式

如需启用,将文件移回 `app/` 目录,并在 `main.py` 中接线 ShadowRouter 到请求中间件管道。
