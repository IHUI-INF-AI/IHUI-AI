# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# D118 /init 式 AGENTS.md 生成器(init_agents_md)单测。
#
# 判据链:
# 1. 注册面:init_agents_md 出现在 app.tools 的 __all__ 且为可调用真身;
# 2. 生成面:tmp_path 造工作区(package.json scripts / pyproject / Makefile /
#    README / docs)→ 草稿含「构建命令 / 目录结构 / 既有约定文档」三段且内容命中;
# 3. 不落盘纪律:缺省调用后工作区内不得凭空出现 AGENTS.md;
# 4. path_guard 双闸门:白名单外拒绝 / 敏感目录(.git)拒绝 / 白名单内显式
#    output_path 可写且内容等于草稿。
#
# 零 DB / 零网络(§5 测试隔离铁律):本工具纯文件系统探测。

from __future__ import annotations

import json

import app.tools as tools_pkg
from app.tools.init_agents_md import init_agents_md


def _make_workspace(tmp_path):
    """造一个最小可探测工作区:Node monorepo + Python 子包 + 约定文档。"""
    ws = tmp_path / "demo-ws"
    (ws / "apps" / "web").mkdir(parents=True)
    (ws / "packages" / "ui").mkdir(parents=True)
    (ws / "docs").mkdir()
    (ws / "node_modules").mkdir()  # 应被目录结构段跳过

    (ws / "package.json").write_text(
        json.dumps(
            {
                "name": "demo-ws",
                "description": "演示工作区",
                "scripts": {"dev": "next dev", "build": "turbo build", "test": "vitest run"},
            }
        ),
        encoding="utf-8",
    )
    (ws / "pnpm-lock.yaml").write_text("lockfileVersion: '9.0'\n", encoding="utf-8")
    (ws / "turbo.json").write_text('{"pipeline":{}}', encoding="utf-8")
    (ws / "Makefile").write_text("deploy:\n\techo hi\n.PHONY: all\n", encoding="utf-8")
    (ws / "README.md").write_text(
        "# © 2026 test banner\n# Provenance-watermarked. 未授权商用可被溯源追责\n\n"
        "# Demo 项目\n\n这是说明。\n",
        encoding="utf-8",
    )
    (ws / "CONTRIBUTING.md").write_text("## 贡献指南\n", encoding="utf-8")
    (ws / "docs" / "ARCHITECTURE.md").write_text("# 架构\n", encoding="utf-8")
    (ws / ".prettierrc").write_text('{"semi": false}', encoding="utf-8")
    py = ws / "apps" / "web" / "package.json"
    py.write_text(json.dumps({"name": "@demo/web"}), encoding="utf-8")
    return ws


# ---------------------------------------------------------------------------
# 1. 注册面
# ---------------------------------------------------------------------------
def test_registered_in_tools_package():
    assert "init_agents_md" in tools_pkg.__all__
    assert callable(tools_pkg.init_agents_md)


# ---------------------------------------------------------------------------
# 2. 生成面:草稿三段内容命中
# ---------------------------------------------------------------------------
async def test_draft_contains_build_commands_dirs_and_docs(tmp_path):
    ws = _make_workspace(tmp_path)
    result = await init_agents_md({"workspace_root": str(ws)})
    assert result["ok"] is True, result
    draft = result["draft"]

    # 构建命令段:包管理器探测(pnpm-lock → pnpm)+ scripts + Makefile 目标
    assert "构建与开发命令" in draft
    assert "pnpm run build" in draft
    assert "pnpm run test" in draft
    assert "make deploy" in draft

    # 目录结构段:容器目录下探一层,噪音目录不出现(段内检查,勿用全文)
    assert "目录结构" in draft
    tree_section = draft.split("## 目录结构", 1)[1].split("##", 1)[0]
    assert "apps/" in tree_section
    assert "  web/" in tree_section
    assert "  ui/" in tree_section
    assert "node_modules" not in tree_section

    # 既有约定文档段:README/CONTRIBUTING/docs/ 均登记;
    # 摘要须跳过溯源水印横幅行,取真正标题
    assert "既有约定文档" in draft
    assert "`README.md` — Demo 项目" in draft
    assert "`CONTRIBUTING.md`" in draft
    assert "`docs/ARCHITECTURE.md`" in draft

    # 草稿属性:工具链段 + 人工复核警示
    assert "Prettier" in draft
    assert "人工复核" in draft


# ---------------------------------------------------------------------------
# 3. 不落盘纪律
# ---------------------------------------------------------------------------
async def test_default_does_not_write_to_disk(tmp_path):
    ws = _make_workspace(tmp_path)
    result = await init_agents_md({"workspace_root": str(ws)})
    assert result["ok"] is True
    assert result["written_path"] is None
    assert not (ws / "AGENTS.md").exists()
    assert not (ws / "draft").exists()


# ---------------------------------------------------------------------------
# 4. path_guard 双闸门
# ---------------------------------------------------------------------------
async def test_rejects_path_outside_workspace_whitelist(tmp_path):
    ws = _make_workspace(tmp_path)
    escape = tmp_path / "outside-AGENTS.md"
    result = await init_agents_md({"workspace_root": str(ws), "output_path": str(escape)})
    assert result["ok"] is False
    assert result["errorCode"] == "OUTPUT_PATH_REJECTED"
    assert not escape.exists()


async def test_rejects_relative_escape(tmp_path):
    ws = _make_workspace(tmp_path)
    result = await init_agents_md({"workspace_root": str(ws), "output_path": "../escaped.md"})
    assert result["ok"] is False
    assert result["errorCode"] == "OUTPUT_PATH_REJECTED"
    assert not (tmp_path / "escaped.md").exists()


async def test_rejects_sensitive_dir(tmp_path):
    ws = _make_workspace(tmp_path)
    (ws / ".git").mkdir()
    result = await init_agents_md(
        {"workspace_root": str(ws), "output_path": ".git/hooks/AGENTS.md"}
    )
    assert result["ok"] is False
    assert result["errorCode"] == "OUTPUT_PATH_REJECTED"
    assert "敏感目录" in result["message"]
    assert not (ws / ".git" / "hooks" / "AGENTS.md").exists()

    nm = ws / "node_modules" / "evil.md"
    result2 = await init_agents_md({"workspace_root": str(ws), "output_path": "node_modules/evil.md"})
    assert result2["ok"] is False
    assert not nm.exists()


async def test_explicit_whitelisted_output_writes_draft(tmp_path):
    ws = _make_workspace(tmp_path)
    result = await init_agents_md({"workspace_root": str(ws), "output_path": "draft/AGENTS.md"})
    assert result["ok"] is True, result
    written = ws / "draft" / "AGENTS.md"
    assert written.is_file()
    assert written.read_text(encoding="utf-8") == result["draft"]


# ---------------------------------------------------------------------------
# 5. 负面参数
# ---------------------------------------------------------------------------
async def test_missing_workspace_root(tmp_path):
    result = await init_agents_md({})
    assert result["ok"] is False
    assert result["errorCode"] == "INVALID_ARGUMENT"

    result2 = await init_agents_md({"workspace_root": str(tmp_path / "no-such-dir")})
    assert result2["ok"] is False
    assert result2["errorCode"] == "WORKSPACE_NOT_FOUND"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
