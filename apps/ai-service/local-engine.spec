# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""PyInstaller spec — 把 ai-service 本地单机引擎打包为单一可执行文件。

用法(在 apps/ai-service 目录、已激活 .venv 时):
    pyinstaller local-engine.spec --noconfirm

产物:dist/ihui-local-engine[.exe]

打包的是 `app.local_entry`(本地单机入口,绑 127.0.0.1),不是生产 `app.main:app`。
生产部署仍走 uvicorn/容器,不受影响。

已知重依赖(诚实标注,见方案文档「产品化打包」章节):
- playwright:若本机没装 Chromium,agent 浏览器工具会优雅降级(启动不崩);
- firecrawl-anydoc:文档解析,原生 NAPI wheel,PyInstaller 会把 .node/.dll 收进包;
- faster-whisper / tiktoken:模型/词表在首次用时下载或随包,单机首启有下载门槛。
这些是「产品化」的真实重量所在;spec 用 collect_all 尽量收全,跨平台仍需在各
目标 OS 上分别构建(PyInstaller 不交叉编译)。
"""

from PyInstaller.utils.hooks import collect_all, collect_submodules

datas = []
binaries = []
hiddenimports = []

# 把重依赖的元数据/二进制一并收进包,避免运行时 ImportError / 找不到原生库。
for pkg in (
    "litellm",
    "langgraph",
    "langchain",
    "langchain_core",
    "langchain_openai",
    "langchain_anthropic",
    "tiktoken",
    "pydantic",
    "pydantic_settings",
    "apscheduler",
    "edge_tts",
    "faster_whisper",
    "structlog",
):
    try:
        d, b, h = collect_all(pkg)
        datas += d
        binaries += b
        hiddenimports += h
    except Exception:  # noqa: BLE001 - 未安装的可选依赖跳过,不阻断打包
        pass

# firecrawl-anydoc 是 NAPI 原生模块(.node/.dll),必须显式收二进制。
try:
    d, b, h = collect_all("firecrawl_anydoc")
    datas += d
    binaries += b
    hiddenimports += h
except Exception:  # noqa: BLE001
    pass

hiddenimports += collect_submodules("app")

# app/data/*.json 是构建期生成的数据资产(tool_name_sets / command_policy /
# default_models 等),代码用 Path(__file__).parent.parent/"data" 相对解析,
# 打包时必须显式收进 datas 并落到 app/data/,否则产物启动期 FileNotFoundError。
import glob as _glob
for _json in _glob.glob("app/data/*.json"):
    datas.append((_json, "app/data"))

a = Analysis(
    ["app/local_entry.py"],
    pathex=["."],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=[
        # 生产/测试专用,单机引擎用不到,排除减体积。
        # 注意:不能排 socketio/engineio —— app.main 顶层 import socketio,
        # local_entry 加载 fastapi_app 会连带引入,排掉会让产物运行时 ImportError。
        "pytest",
    ],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    name="ihui-local-engine",
    console=True,
    onefile=True,
)
