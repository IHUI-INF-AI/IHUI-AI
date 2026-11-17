# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""本地单机引擎入口(LOCAL_MODE)—— 阶段 3 产品化打包的代码侧地基。

用途
----
给「本地 agent 引擎」提供一个**独立于生产 `main:app`** 的启动入口:
- 进程只绑 `127.0.0.1`(不暴露到局域网);
- 复用**已验证**的 `AI_DEV_NO_AUTH=1` 旁路(`jwt_auth.dev_auth_bypass_enabled`),
  条件是 `JWT_SECRET` 为空——配了真实密钥就照样验签,开关不是跳过验签的后门;
- 显式关闭 reload(单机不热载)、日志走 info;
- 直接跑 FastAPI app(跳过生产才需要的 Socket.IO / WebSocket 连接闸那一层),
  让 PyInstaller 能把入口收敛到一个可执行文件。

不改动生产面
------------
- 生产 `app.main:app`(含 Socket.IO + WsConnGuard)一行不改、默认路径不变;
- 本文件只被 `pyinstaller local-engine.spec` 或显式 `python -m app.local_entry`
  调用,不进任何生产部署路径。

安全边界(诚实标注)
--------------------
- 旁路鉴权 = 本进程整站不验 JWT。因此**必须**绑 127.0.0.1;若用户改 host 为
  0.0.0.0,本入口拒绝启动(fail-closed),防止把无鉴权服务暴露到局域网。
- 这是「单机本地引擎」,不是多租户服务端;身份归属、审计、IM 桥等依赖
  JWT_SECRET / DB / Redis 的面按已有降级分支 no-op(见 main.py lifespan)。
"""

from __future__ import annotations

import logging
import os
import sys

logger = logging.getLogger(__name__)

# 本地单机引擎只允许绑回环地址:旁路鉴权后无任何身份校验,暴露到 0.0.0.0
# 等于把可执行任意工具的 agent 开放给同网段所有主机。
_LOOPBACK_HOSTS = {"127.0.0.1", "localhost"}


def _prepare_local_env() -> None:
    """设置本地单机态环境变量(幂等,不覆盖已显式注入的值)。

    - `AI_DEV_NO_AUTH=1`:复用唯一鉴权旁路开关(jwt_auth.dev_auth_bypass_enabled)。
    - `NODE_ENV=development`:关闭交互式文档外的生产断言,允许本地直连。
    两者都用 setdefault:若用户已显式配置(含配了真实 JWT_SECRET),以用户为准。
    """
    os.environ.setdefault("AI_DEV_NO_AUTH", "1")
    os.environ.setdefault("NODE_ENV", "development")


def _enforce_loopback(host: str) -> None:
    """fail-closed:旁路鉴权时只允许回环地址。"""
    if host not in _LOOPBACK_HOSTS:
        raise SystemExit(
            f"[local-engine] 拒绝启动:host={host!r} 不是回环地址。\n"
            f"  本地引擎旁路了 JWT 鉴权(AI_DEV_NO_AUTH=1 且 JWT_SECRET 为空),\n"
            f"  绑到 {host} 会把无鉴权服务暴露到局域网。只允许 127.0.0.1 / localhost。\n"
            f"  如需对外提供服务,请走生产入口 app.main:app 并配置真实 JWT_SECRET。"
        )


def main() -> None:
    """启动本地单机引擎(uvicorn 直跑 FastAPI app)。"""
    _prepare_local_env()

    # 延迟 import:设置好环境变量后再读 settings,确保 ai_dev_no_auth=True 生效。
    from app.core.config import settings
    from app.core.jwt_auth import dev_auth_bypass_enabled

    host = settings.host if settings.host in _LOOPBACK_HOSTS else "127.0.0.1"
    port = settings.port
    _enforce_loopback(host)

    # 二次确认旁路真的成立(配了 JWT_SECRET 时旁路不生效,此时不报错、按验签模式跑)。
    if not dev_auth_bypass_enabled():
        mode = "JWT 验签模式(检测到 JWT_SECRET 已配置)"
    else:
        mode = "旁路鉴权模式(AI_DEV_NO_AUTH=1 且 JWT_SECRET 为空)"

    logging.basicConfig(
        level=settings.log_level.upper() if settings.log_level else "INFO",
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    logger.info(
        "[local-engine] 启动本地单机引擎 host=%s port=%d · %s", host, port, mode
    )

    import uvicorn

    # 直接跑 FastAPI app:跳过 Socket.IO / WebSocket 连接闸(生产多租户才需要),
    # 让单机入口可被 PyInstaller 收敛成单一可执行文件。
    uvicorn.run(
        "app.main:fastapi_app",
        host=host,
        port=port,
        reload=False,
        log_level=settings.log_level or "info",
    )


if __name__ == "__main__":
    main()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
