"""带缓存控制的静态资源服务 (Bug-41)."""

import logging
import os

from fastapi.staticfiles import StaticFiles
from starlette.responses import Response
from starlette.types import Scope

logger = logging.getLogger(__name__)


class CachedStaticFiles(StaticFiles):
    """扩展 StaticFiles: 给静态资源 (CSS/JS/图片) 加 Cache-Control 头.

    行为:
      - 命中 .css / .js / .png / .jpg / .jpeg / .gif / .svg / .woff2 / .ico 时
        设置 Cache-Control: public, max-age=<cache_max_age>
      - 其它文件 (如 .html) 不加缓存 (走 alias 端点 no-store)
      - cache_max_age 单位为秒, 默认 3600 (1 小时)
    """

    _CACHEABLE_SUFFIXES = (
        ".css",
        ".js",
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".svg",
        ".woff",
        ".woff2",
        ".ico",
        ".webp",
        ".mp4",
        ".webm",
    )

    def __init__(self, *, directory: str, cache_max_age: int = 3600, **kwargs):
        super().__init__(directory=directory, **kwargs)
        self.cache_max_age = cache_max_age

    def file_response(
        self,
        full_path: str,
        stat_result: os.stat_result,
        scope: Scope,
        status_code: int = 200,
    ) -> Response:
        response = super().file_response(full_path, stat_result, scope, status_code)
        try:
            _, ext = os.path.splitext(full_path.lower())
            if ext in self._CACHEABLE_SUFFIXES:
                response.headers["Cache-Control"] = f"public, max-age={self.cache_max_age}"
        except Exception as e:
            logger.debug("设置静态资源 Cache-Control 失败: %s", e)  # intentionally ignored
        return response
