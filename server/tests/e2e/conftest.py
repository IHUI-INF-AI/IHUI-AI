"""E2E 测试共用 conftest.

pytest_addoption (--base / --skip-network) 已移至 tests/conftest.py 的根级 pytest_addoption,
因为 pytest_addoption 只能在 rootdir 的 conftest.py 中定义一次, 子目录重复定义会被忽略.

此文件保留用于未来添加 e2e 专用 fixture.
"""
