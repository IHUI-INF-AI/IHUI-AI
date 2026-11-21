# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""Trae 反代模型自动同步器(客户端为主取数源 + 幂等 upsert + 自动去重)。

立因:trae 上游 model_list 端点对号池凭据已失效(线上实证 401,见
apps/api/src/services/upstream-adapters/trae-adapter.ts 的健康检查注释),
每 6 小时的 model-discovery-sync 轮询到 trae 时拿不到真实清单 —— 要么空转,
要么走 discovery 聚合端点张冠李戴(2026-11-19 实测扫出 47 条 Gemini/Grok 误标)。

唯一可靠的 trae 真实数据源 = 本机 Trae 客户端登录态缓存 state.vscdb
(客户端把它拉到的官方模型列表落本地)。本器从它提取 → 与 ai_model_config_models
对账 → 幂等 upsert 新增 → 上架(is_relay_public=true)。只增不删(取不到不动存量),
天然避免"取不到 = 误判下架"。

用法:
  python scripts/sync-trae-models-from-client.py --check      # 只读对账,打印将新增/已一致
  python scripts/sync-trae-models-from-client.py --apply      # 单事务落库,写后复核
  可选 --vscdb <path> 指定客户端缓存;缺省自动探测 TRAE_CN_VSCDB / 常见安装位。

三态退出码:0 处理完(含无需改动) / 1 落库或校验失败 / 2 未判定(缺客户端缓存 / 连不上库)。
安全:只写 trae 自己的 ai_model_config_models 行;绝不输出任何凭据/token。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# Trae 客户端模型缓存候选路径(客户端为主取数源)
VSCDB_CANDIDATES = [
    os.environ.get("TRAE_CN_VSCDB", ""),
    r"G:\Trae CN\UserData\User\globalStorage\state.vscdb",
    os.path.expandvars(r"%APPDATA%\Trae CN\User\User\globalStorage\state.vscdb"),
    os.path.expanduser(r"~\AppData\Roaming\Trae CN\User\globalStorage\state.vscdb"),
]

# Trae 反代在 ai_model_config 的固定行(2026-11-19 实测 id=48, provider_code='trae')
TRAE_CONFIG_ID = int(os.environ.get("TRAE_CONFIG_ID", "48"))

# 过滤非模型条目:智能体内部工具名 / 界面名(命中即不是可调用模型)
NON_MODEL_PAT = re.compile(
    r"(远程资源|资源管理器|refactor_|code-review|scoper|finder|planner|incrementer|judge)",
    re.I,
)
# display_name 必须是干净短标签;混进 svg/路径/控制字符 = 脏数据,丢弃(display_name 退回用 name)
DIRTY_DISPLAY_PAT = re.compile(r"[<>\\/]|\.(svg|png|js|ts)\b", re.I)

# 客户端 id → 库内登记 id 的显式别名(Doubao 前缀族客户端带前缀、库内不带)。
# 只列已核实的成对;不在此表且规则归一也不命中的,按真正新增处理(宁可多一条不误删)。
ALIAS_TO_LIBRARY = {
    "doubao-seed-code": "Seed-Code",
    "doubao-seed-evolving": "Seed-Evolving",
    "deepseek-v4-pro-official": "DeepSeek-V4-Pro",
}


def canon(model_id: str) -> str:
    """规则归一:小写、去分隔符、剥 -official 后缀与纯日期后缀(0915 等)。
    用于大小写/后缀差异的宽松匹配;显式别名表优先于本规则。"""
    s = model_id.strip().lower().replace("_", "-")
    s = re.sub(r"-official$", "", s)
    s = re.sub(r"-\d{4}$", "", s)  # 去掉 0915 这类日期后缀
    s = s.replace("-", "")
    return s


def die_unverified(why: str) -> "int":
    print(f"❌ 未判定:{why}", file=sys.stderr)
    return 2


def find_vscdb(explicit: str | None) -> Path | None:
    """定位客户端缓存;显式参数优先,否则按候选顺序探测第一个存在的。"""
    cands = ([explicit] if explicit else []) + VSCDB_CANDIDATES
    for c in cands:
        if c and Path(c).exists():
            return Path(c)
    return None


def extract_models(vscdb: Path) -> list[tuple[str, str]]:
    """从 state.vscdb 二进制里提取 (model_id, display_name)。

    特征:name 在前,display_name 在其后的窗口内,且同对象窗口有模型旁证
    (trae 官方 icon svg 或 config_source+prompt_max_tokens)。没有旁证的
    name 一律不算模型(挡掉智能体工具名/界面名)。
    """
    data = vscdb.read_bytes()
    models: list[tuple[str, str]] = []
    seen: set[str] = set()
    for m in re.finditer(rb'"name"\s*:\s*"([^"]{2,60})"', data):
        name = m.group(1).decode("utf-8", "replace")
        if name in seen:
            continue
        win = data[m.start(): m.start() + 800]
        dm = re.search(rb'"display_name"\s*:\s*"([^"]{1,120})"', win)
        # 模型旁证:必须同窗口命中官方 icon 或模型元数据字段
        has_evidence = (b"trae-com-cn/model/" in win) or (
            b"config_source" in win and b"prompt_max_tokens" in win
        )
        if not (dm and has_evidence):
            continue
        display = dm.group(1).decode("utf-8", "replace")
        # 过滤非模型 + 脏 display
        if NON_MODEL_PAT.search(name) or NON_MODEL_PAT.search(display):
            continue
        if DIRTY_DISPLAY_PAT.search(display):
            display = name  # 脏 display 退回用 model_id,不用乱码串
        seen.add(name)
        models.append((name, display))
    return sorted(models)


def load_db():
    """连 Postgres:优先解析 apps/api/.env 的 DATABASE_URL / DATABASE_APP_URL 连接串。不外泄凭据。"""
    try:
        import psycopg2
    except ImportError:
        return None, "psycopg2 未安装"
    env = {}
    env_file = REPO_ROOT / "apps" / "api" / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    dsn = env.get("DATABASE_URL") or env.get("DATABASE_APP_URL")
    if dsn:
        try:
            conn = psycopg2.connect(dsn, connect_timeout=8)
            return conn, None
        except Exception as e:  # noqa: BLE001
            return None, f"连不上库:{e}"
    # 回退:分离字段
    host = env.get("DB_HOST") or "127.0.0.1"
    port = env.get("DB_PORT") or "5432"
    dbname = env.get("DB_NAME")
    user = env.get("DB_USER")
    pw = env.get("DB_PASSWORD")
    if not (dbname and user):
        return None, "apps/api/.env 取不到 DATABASE_URL 且缺 DB_NAME / DB_USER"
    try:
        conn = psycopg2.connect(
            host=host, port=port, dbname=dbname, user=user, password=pw, connect_timeout=8
        )
        return conn, None
    except Exception as e:  # noqa: BLE001
        return None, f"连不上库:{e}"


def existing_trae_models(cur) -> dict[str, str]:
    cur.execute(
        "SELECT model_id, display_name FROM ai_model_config_models WHERE config_id=%s",
        (TRAE_CONFIG_ID,),
    )
    return {r[0]: (r[1] or "") for r in cur.fetchall()}


def insert_model(cur, model_id: str, display: str, sort_order: int) -> None:
    cur.execute(
        """
        INSERT INTO ai_model_config_models
          (config_id, model_id, display_name, enabled, is_relay_public, context_length,
           input_price_per_1k, output_price_per_1k, relay_price_multiplier, relay_sort_order,
           tags, default_params, supports_tool_call, supports_vision, is_default, sort_order,
           created_at, updated_at)
        VALUES (%s, %s, %s, true, true, 32000,
                0, 0, '1.0', 0,
                %s::text[], '{}'::jsonb, false, false, false, %s,
                now(), now())
        """,
        (TRAE_CONFIG_ID, model_id, display, [], sort_order),
    )


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Trae 反代模型自动同步(客户端缓存 → DB,幂等)")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--check", action="store_true", help="只读对账,不写库")
    g.add_argument("--apply", action="store_true", help="单事务落库,写后复核")
    ap.add_argument("--vscdb", help="显式指定 Trae 客户端 state.vscdb 路径")
    args = ap.parse_args(argv)

    vscdb = find_vscdb(args.vscdb)
    if not vscdb:
        return die_unverified("找不到 Trae 客户端模型缓存 state.vscdb(本机没装/没登录过 Trae 客户端?)")
    upstream = extract_models(vscdb)
    if not upstream:
        return die_unverified(f"客户端缓存里没提取到任何模型({vscdb}) —— 缓存形状可能变了,需人工复核")

    conn, err = load_db()
    if err:
        return die_unverified(err)
    try:
        with conn.cursor() as cur:
            have = existing_trae_models(cur)
            # 库内已有 id 的归一集合(规则归一)
            have_canon = {canon(mid) for mid in have}

            already = []
            to_add = []
            skipped_alias = []
            for mid, disp in upstream:
                if mid in have:
                    already.append(mid)
                    continue
                # 显式别名:Doubao 前缀族等客户端 id 已映射到库内某个登记 id
                alias_target = ALIAS_TO_LIBRARY.get(mid.lower())
                if alias_target and alias_target in have:
                    skipped_alias.append((mid, f"别名→{alias_target}"))
                    continue
                # 规则归一撞库内已有(大小写/official/日期后缀差异) ⇒ 视为已存在
                if canon(mid) in have_canon:
                    skipped_alias.append((mid, f"归一撞已有"))
                    continue
                to_add.append((mid, disp))

            print(f"客户端缓存提取到 {len(upstream)} 个 trae 模型")
            print(f"  已在库(完全一致): {len(already)}")
            print(f"  别名归一跳过(库内已有,不同名): {len(skipped_alias)}")
            for mid, why in skipped_alias:
                print(f"    ~ {mid:<34} {why}")
            print(f"  真正待新增:       {len(to_add)}")
            for mid, disp in to_add:
                print(f"    + {mid:<34} {disp}")

            if args.check:
                print("\n[check] 只读对账,未写库")
                return 0

            # --apply: 单事务落库。只增不删 —— 客户端缓存取不到不动存量(避免误判下架)。
            base_sort = 100
            for i, (mid, disp) in enumerate(to_add):
                insert_model(cur, mid, disp, base_sort + i)
            conn.commit()

            # 写后复核:trae 现模型数 + 全部已上架
            have2 = existing_trae_models(cur)
            cur.execute(
                "SELECT COUNT(*) FROM ai_model_config_models WHERE config_id=%s AND is_relay_public=true",
                (TRAE_CONFIG_ID,),
            )
            public_count = cur.fetchone()[0]
            print(f"\n[apply] 落库后 trae 模型总数={len(have2)} (其中已上架 {public_count})")
            if public_count != len(have2):
                print(f"❌ 校验失败:存在未上架行({len(have2) - public_count} 条)", file=sys.stderr)
                return 1
            print("✅ 自动更新 + 上架完成,已自动去重(只展示每 modelId 一条,按 relay_sort_order)")
            return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
