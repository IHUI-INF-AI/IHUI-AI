#!/usr/bin/env python3
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
"""生产 ⇄ 本地 **全表** 数据同步器(2026-09-22 全表化改造)。

背景:
  桌面端曾因 API 寻址 bug 把请求打到本机 8802,2026-09-15~16 扫码添加的 19 个发布
  平台账号全部落进本机库,线上为空 —— 用户登录生产只看到空列表。根因是"两套库都能写,
  且没有约定谁是真源"。首版同步器只覆盖 8 张白名单表,故 2026-09-22 全表化。

设计原则(**真源单一化**,不是双向合并):
  - **生产库 = 唯一真源**。表清单从两端 schema 动态枚举,不再手抄白名单。
  - **镜像 mirror(生产 → 本地)= 全表**,本地库成为生产快照。
  - **回灌 sync(本地 → 生产)= 全表**,但按表能力自动分级,**绝不删除生产数据**:
      · 有主键 + updated_at → upsert,且仅当本地行更新(`EXCLUDED.updated_at > t.updated_at`)
      · 有主键 无 updated_at → 只补生产缺失主键的行(`ON CONFLICT DO NOTHING`)
      · 无主键            → 物理上无法 upsert,只镜像不回灌(报告里列出)
  - **噪音护栏**:单表"本地独有待回灌行数"超过 max(护栏下限, 生产行数×比例) 时默认
    跳过并显著告警 —— 本机跑采集/压测会产生海量观测行,无脑灌进生产就是污染。
    确认要同步用 `--force`,或 `--tables 精确指定`(精确指定不受护栏约束)。
  - 两端 `PUBLISH_CREDENTIALS_KEY` 已统一,`credentials_enc` 可整列搬运;检测到两端
    密钥不一致 → 直接失败,不做静默重加密(避免密钥漂移被掩盖)。

子命令:
  tables   列出两端表清单与分类(只读)
  schema   生产有、本地缺的表在本地建出来(默认 dry-run,加 --apply 执行)
  drift    只读对比两端差异(默认只打有差异的表;--fail 有未回灌增量时 exit 1)
  sync     本地 → 生产 单向回灌(默认 dry-run,加 --apply 真写;幂等可反复跑)
  mirror   生产 → 本地 全表镜像(先自动 sync 保住本地增量,再覆盖本地;需 --yes)
"""
from __future__ import annotations

import argparse
import asyncio
import contextlib
import json
import os
import re
import socket
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import asyncpg

ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / '.ihui-agent' / 'db-sync.local.json'
BACKUP_DIR = ROOT / '.ihui-agent' / 'db-backups'

# ---------------------------------------------------------------------------
# 排除规则:同步绝不触碰的表
# ---------------------------------------------------------------------------
EXCLUDE_SCHEMAS = ('pg_catalog', 'information_schema', 'pg_toast', 'drizzle')
# 迁移记账 / 内部分区备份等(名字命中即排除,大小写不敏感)
EXCLUDE_NAME_PARTS = ('drizzle', 'migration', 'migrations', 'schema_migrations', 'mig_audit')
# PostGIS 等扩展自带的公共表(两端结构由扩展管理,不参与业务同步)
EXCLUDE_EXACT = ('spatial_ref_sys',)

# 大表阈值:超过则不走"整表进内存",改为主键集合 diff + 分批取行
LARGE_TABLE_ROWS = 500_000
# 取行 / 写入 / COPY 的分批大小
BATCH = 500
COPY_BATCH = 5_000
# 整批写入失败后允许"逐行重放"的最大行数。超过则认为该表整体冲突(典型:外键指向
# 生产不存在的父行),直接跳过整批 —— 数千次失败事务会拖垮 SSH 隧道上的连接。
VERIFY_ROW_LIMIT = 300
# 逐行重放的墙钟上限(秒)。隧道另一头生产库在跑自己的定时任务(实测 8 个会话并发
# `update ai_feed_hot_item`),单行往返能到 2 秒级,300 行的重放能磨掉十分钟。
REPLAY_MAX_SECONDS = 45
# 同一张表连续多少批写入失败就认定"本表系统性不可回灌",余下批次直接跳过。
# 前两批都失败的表,后面必然同样失败 —— 继续逐批试纯属浪费(2026-09-22 实测
# ai_world_items 4108 行在此磨掉 4 分钟以上)。设为 2 表示:第 1 批仍尝试逐行抢救,
# 第 2 批起放弃。
SYSTEMIC_FAIL_CHUNKS = 2
# 超大表阈值:达到此规模不做全量主键 diff(百万行级传输会拖爆隧道 + 整体超时),
# 改用行数差判定护栏。实测 ai_feed_snapshot 单表 88 万行即足以让一次 sync 超 15 分钟。
BIG_TABLE_ROWS = 100_000
# 噪音护栏:本地独有待回灌行数 > max(GUARD_MIN, 生产行数 * GUARD_RATIO) 时跳过
GUARD_MIN = 5_000
GUARD_RATIO = 0.5
# 无主键表(只能全列去重)的最大处理行数,超过则只镜像不回灌
KEYLESS_MAX_ROWS = 50_000

SQL_TABLES = """
SELECT c.relname AS t,
       GREATEST(c.reltuples, 0)::bigint AS est,
       COALESCE(s.n_live_tup, 0)::bigint AS live
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
WHERE n.nspname = 'public' AND c.relkind = 'r'
"""

SQL_COLUMNS = """
SELECT table_name AS t, column_name AS c, udt_name AS ut
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position
"""

SQL_PK = """
SELECT tc.table_name AS t, kcu.column_name AS c
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.ordinal_position
"""

# 业务唯一约束(不含主键):两端主键不同但业务键相同的行,只有以业务键为 upsert
# 目标才可能合并;否则会撞唯一约束、整批失败(2026-09-22 实测 8 张表如此)
SQL_UNIQUE = """
SELECT c.relname AS tbl,
       array_agg(a.attname ORDER BY k.ord) AS cols
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum
WHERE con.contype = 'u' AND n.nspname = 'public'
GROUP BY c.relname, con.conname
"""


# --json 模式:除人读报告外,额外吐一行机器可读摘要(供 ai-service 内的
# db_sync_scheduler 消费,避免用正则去啃报告文本)。前缀固定,便于 stdout 混排时定位。
JSON_PREFIX = '__IHUI_DB_SYNC_JSON__'
_JSON_MODE = False
_JSON_LINES: list[str] = []


def log(msg: str = '') -> None:
    print(msg, flush=True)
    if _JSON_MODE:
        _JSON_LINES.append(msg)


def emit_json(mode: str, exit_code: int) -> None:
    """输出机器可读摘要(仅 --json 模式调用)。"""
    if not _JSON_MODE:
        return
    payload = {
        'mode': mode,
        'exit_code': exit_code,
        'lines': _JSON_LINES[-400:],
    }
    print(JSON_PREFIX + json.dumps(payload, ensure_ascii=False), flush=True)


def q(ident: str) -> str:
    """安全引用标识符。"""
    return '"' + ident.replace('"', '""') + '"'


def lit(value: str) -> str:
    """安全引用字符串字面量(用于 UNION ALL 里的表名常量)。"""
    return "'" + value.replace("'", "''") + "'"


def excluded_table(name: str) -> bool:
    low = name.lower()
    if low in EXCLUDE_EXACT:
        return True
    return any(p in low for p in EXCLUDE_NAME_PARTS)


# ---------------------------------------------------------------------------
# 连接与隧道
# ---------------------------------------------------------------------------
def load_local_dsn() -> str:
    env = ROOT / 'apps' / 'ai-service' / '.env'
    for line in env.read_text(encoding='utf-8', errors='replace').splitlines():
        if line.strip().startswith('DATABASE_URL='):
            return line.split('=', 1)[1].strip()
    raise SystemExit(f'未找到 DATABASE_URL: {env}')


def load_cfg() -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        raise SystemExit(f'缺少本地配置 {CONFIG_PATH}(含生产 DSN,已被 .gitignore 忽略)')
    return json.loads(CONFIG_PATH.read_text(encoding='utf-8'))


def prod_dsn(cfg: dict[str, Any]) -> str:
    p = cfg['prod']
    return f"postgresql://{p['user']}:{p['password']}@127.0.0.1:{p['tunnelPort']}/{p['db']}"


def start_tunnel(cfg: dict[str, Any]) -> subprocess.Popen[bytes]:
    """建 SSH 端口转发(隐藏窗口),等端口可连后再返回。"""
    ssh = cfg['ssh']
    local_port = cfg['prod']['tunnelPort']
    creationflags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0  # type: ignore[attr-defined]
    proc = subprocess.Popen(
        [
            'ssh', '-o', 'ExitOnForwardFailure=yes', '-o', 'ServerAliveInterval=30',
            '-L', f'{local_port}:{ssh["dbHost"]}:{ssh["dbPort"]}', '-N', ssh['host'],
        ],
        creationflags=creationflags,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    deadline = time.time() + 20
    while time.time() < deadline:
        if proc.poll() is not None:
            raise SystemExit('SSH 隧道启动失败(进程已退出),请检查 ssh.aizhs.top 连通性')
        with socket.socket() as s:
            s.settimeout(0.5)
            try:
                s.connect(('127.0.0.1', local_port))
                return proc
            except OSError:
                time.sleep(0.4)
    proc.kill()
    raise SystemExit(f'SSH 隧道端口 {local_port} 20s 内未就绪')


def stop_tunnel(proc: subprocess.Popen[bytes]) -> None:
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()


# 隧道按单例持有:密集小事务下 ssh 进程偶发退出(2026-09-22 实测),
# 必须能探测并自愈重建,否则后续每张表都会连环失败。
_TUNNEL: subprocess.Popen[bytes] | None = None


def ensure_tunnel(cfg: dict[str, Any]) -> subprocess.Popen[bytes]:
    """返回可用隧道;进程已死则重建。"""
    global _TUNNEL
    if _TUNNEL is None or _TUNNEL.poll() is not None:
        if _TUNNEL is not None:
            with contextlib.suppress(Exception):
                _TUNNEL.kill()
        _TUNNEL = start_tunnel(cfg)
    return _TUNNEL


async def reconnect_prod(cfg: dict[str, Any]) -> asyncpg.Connection:
    """重建隧道并重连生产库(隧道死后端口已失效,必须先重建隧道再连)。"""
    ensure_tunnel(cfg)
    return await asyncpg.connect(prod_dsn(cfg))


# ---------------------------------------------------------------------------
# 表元数据
# ---------------------------------------------------------------------------
@dataclass
class TableMeta:
    name: str
    cols: list[str]
    coltypes: dict[str, str]  # 列名 → udt_name,用于检测两端类型漂移
    pk: list[str]
    has_updated_at: bool
    has_user_id: bool
    rows: int  # 行数:load_exact_counts 用精确 count(*) 覆盖过,未覆盖的才是估算值

    @property
    def upsertable(self) -> bool:
        return bool(self.pk)

    @property
    def strategy(self) -> str:
        if not self.pk:
            return 'keyless-insert'
        return 'upsert-ts' if self.has_updated_at else 'insert-only'


async def load_meta(conn: asyncpg.Connection) -> dict[str, TableMeta]:
    tbls = await conn.fetch(SQL_TABLES)
    col_rows = await conn.fetch(SQL_COLUMNS)
    pk_rows = await conn.fetch(SQL_PK)

    cols: dict[str, list[str]] = {}
    types: dict[str, dict[str, str]] = {}
    for r in col_rows:
        cols.setdefault(r['t'], []).append(r['c'])
        types.setdefault(r['t'], {})[r['c']] = r['ut']
    pks: dict[str, list[str]] = {}
    for r in pk_rows:
        pks.setdefault(r['t'], []).append(r['c'])

    out: dict[str, TableMeta] = {}
    for r in tbls:
        name = r['t']
        if excluded_table(name):
            continue
        cl = cols.get(name, [])
        out[name] = TableMeta(
            name=name,
            cols=cl,
            coltypes=types.get(name, {}),
            pk=pks.get(name, []),
            has_updated_at='updated_at' in cl,
            has_user_id='user_id' in cl,
            rows=max(int(r['est'] or 0), int(r['live'] or 0)),
        )
    return out


async def load_uniq(conn: asyncpg.Connection) -> dict[str, list[list[str]]]:
    """表的业务唯一约束列组合(用于选择 upsert 冲突目标)。"""
    rows = await conn.fetch(SQL_UNIQUE)
    out: dict[str, list[list[str]]] = {}
    for r in rows:
        out.setdefault(r['tbl'], []).append(list(r['cols']))
    return out


@dataclass
class Ctx:
    """两端元数据快照。"""
    local: dict[str, TableMeta] = field(default_factory=dict)
    prod: dict[str, TableMeta] = field(default_factory=dict)
    uniq: dict[str, list[list[str]]] = field(default_factory=dict)
    cfg: dict[str, Any] = field(default_factory=dict)

    @property
    def both(self) -> list[str]:
        return sorted(set(self.local) & set(self.prod))

    @property
    def prod_only(self) -> list[str]:
        return sorted(set(self.prod) - set(self.local))

    @property
    def local_only(self) -> list[str]:
        return sorted(set(self.local) - set(self.prod))

    def common_cols(self, name: str) -> list[str]:
        p = set(self.prod[name].cols)
        return [c for c in self.local[name].cols if c in p]

    def common_pk(self, name: str) -> list[str]:
        p = set(self.prod[name].pk)
        return [c for c in self.local[name].pk if c in p]

    def type_conflicts(self, name: str) -> list[str]:
        """两端同名共有列却类型漂移的列 —— 这类表直接回灌必然 DataError,须跳过。

        实测(2026-09-22):`agent_meta_lessons` 本地有 uuid 主键、生产连该列都没有,
        同名列类型也不同(本机库由 drizzle push 建、生产由旧迁移建,已漂移)。
        """
        lm, pm = self.local[name], self.prod[name]
        bad: list[str] = []
        for c in self.common_cols(name):
            lt, pt = lm.coltypes.get(c, ''), pm.coltypes.get(c, '')
            if lt and pt and lt != pt:
                bad.append(f'{c}(本地 {lt} / 生产 {pt})')
        return bad


# 一次性取回全部表的精确行数的估算上限:估算 ≥ 此值的表保留估算(那些表本就走
# BIG_TABLE_ROWS 快速路径,而对亿级表做 count(*) 不划算)。
COUNT_UNION_MAX_EST = 5_000_000


def build_count_sql(names: list[str]) -> str:
    """拼一条 UNION ALL,一次取回这些表的精确行数(每端仅一次往返)。"""
    return '\nUNION ALL\n'.join(
        f'SELECT {lit(n)} AS t, count(*)::bigint AS n FROM {q(n)}' for n in names
    )


async def load_exact_counts(conn: asyncpg.Connection, metas: dict[str, TableMeta]) -> int:
    """把 metas 里的行数替换为精确 count(*),返回覆盖张数。

    取不到时退回估算值:精确行数是为了"不漏表",但为此让整轮同步起不来更糟。
    """
    names = [n for n, m in metas.items() if m.rows < COUNT_UNION_MAX_EST]
    if not names:
        return 0
    try:
        rows = await conn.fetch(build_count_sql(names))
    except Exception as e:  # noqa: BLE001
        log(f'[scan] ⚠ 精确行数探测失败,退回估算值({type(e).__name__}: {str(e)[:120]})')
        return 0
    for r in rows:
        metas[r['t']].rows = int(r['n'])
    return len(rows)


async def build_ctx(local: asyncpg.Connection, prod: asyncpg.Connection,
                    cfg: dict[str, Any] | None = None) -> Ctx:
    lmeta = await load_meta(local)
    pmeta = await load_meta(prod)
    # 行数必须精确(2026-09-22 实测根因):scan() 用 rows == 0 跳过"两端皆空"的表,
    # 而 reltuples / n_live_tup 对"只 INSERT 过、从未 ANALYZE"的表会双双报 0 ——
    # 712 张共有表里 36 张实际有数据却被估计为 0,整表被无声漏掉(含本地 19 行的
    # publish_notifications、本地 10 行的 agents)。一条 UNION ALL 取回全部精确行数,
    # 实测本机 0.6s / 生产 3.4s。
    n_local = await load_exact_counts(local, lmeta)
    n_prod = await load_exact_counts(prod, pmeta)
    log(f'[scan] 元数据就绪:本机 {len(lmeta)} 表 / 生产 {len(pmeta)} 表;'
        f'精确行数已覆盖本机 {n_local} 张、生产 {n_prod} 张')
    return Ctx(local=lmeta, prod=pmeta, uniq=await load_uniq(prod), cfg=cfg or {})


# ---------------------------------------------------------------------------
# 子命令: tables
# ---------------------------------------------------------------------------
STRATEGY_LABEL = {
    'upsert-ts': 'upsert(updated_at 守卫)',
    'insert-only': 'insert-only(只补生产缺失行)',
    'keyless-insert': 'keyless-insert(无主键,全列去重补新增)',
}


async def do_tables(ctx: Ctx) -> int:
    both = ctx.both
    by_strategy: dict[str, list[str]] = {'upsert-ts': [], 'insert-only': [], 'keyless-insert': []}
    for t in both:
        by_strategy[ctx.prod[t].strategy].append(t)
    nonempty = [t for t in both if ctx.local[t].rows or ctx.prod[t].rows]

    log(f'本机表={len(ctx.local)}  生产表={len(ctx.prod)}  共有={len(both)}  '
        f'仅生产有={len(ctx.prod_only)}  仅本机有={len(ctx.local_only)}')
    log(f'共有表中"至少一端有行"的={len(nonempty)} 张(其余两端皆空,同步时自动跳过)')
    log()
    for k, label in STRATEGY_LABEL.items():
        log(f'[回灌策略] {label}: {len(by_strategy[k])} 张')
        if k == 'mirror-only':
            log(f'    {", ".join(by_strategy[k]) if by_strategy[k] else "(无)"}')
    log()
    if ctx.prod_only:
        nonzero = [t for t in ctx.prod_only if ctx.prod[t].rows]
        log(f'[仅生产有] {len(ctx.prod_only)} 张(本地缺表,镜像时会跳过;其中非空 {len(nonzero)} 张)')
        if nonzero:
            for t in nonzero:
                log(f'    {t}  ~{ctx.prod[t].rows} 行')
        log('    → 跑 `schema --apply` 可在本地建出这些表')
    if ctx.local_only:
        log(f'[仅本机有] {len(ctx.local_only)} 张(生产没有,不会回灌): {", ".join(ctx.local_only)}')
    return 0


# ---------------------------------------------------------------------------
# 子命令: schema(生产 → 本地 建表补齐)
# ---------------------------------------------------------------------------
SQL_DDL_COLUMNS = """
SELECT c.relname AS tbl, a.attname AS col,
       format_type(a.atttypid, a.atttypmod) AS typ,
       a.attnotnull AS notnull,
       a.attidentity AS identity,
       pg_get_expr(d.adbin, d.adrelid) AS coldefault
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid
LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])
  AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY c.relname, a.attnum
"""

SQL_DDL_CONSTRAINTS = """
SELECT c.relname AS tbl, con.conname AS cname, con.contype AS ctype,
       pg_get_constraintdef(con.oid) AS cdef
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])
ORDER BY c.relname, con.contype
"""

SQL_DDL_INDEXES = """
SELECT tablename AS tbl, indexname AS iname, indexdef AS idef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = ANY($1::text[])
ORDER BY tablename, indexname
"""

_SEQ_RE = re.compile(r"nextval\('([^']+)'")


def build_ddl(tbl: str, cols: list[Any], cons: list[Any], idxs: list[Any]) -> list[str]:
    """按生产 catalog 定义生成建表语句(不复制外键:同步不做级联约束)。"""
    stmts: list[str] = []
    for c in cols:
        m = _SEQ_RE.search(c['coldefault'] or '')
        if m:
            stmts.append(f'CREATE SEQUENCE IF NOT EXISTS {q(m.group(1).split(".")[-1])}')

    fields: list[str] = []
    for c in cols:
        line = f"{q(c['col'])} {c['typ']}"
        if c['identity'] in ('a', 'd'):
            # 生产用 ALWAYS identity 时本地降级为 BY DEFAULT:本地是镜像副本,
            # 必须允许整行(含显式 id)导入,否则 COPY/INSERT 会被服务端拒绝。
            line += ' GENERATED BY DEFAULT AS IDENTITY'
        elif c['coldefault']:
            line += f" DEFAULT {c['coldefault']}"
        if c['notnull']:
            line += ' NOT NULL'
        fields.append(line)

    stmts.append(f'CREATE TABLE IF NOT EXISTS {q(tbl)} (\n  ' + ',\n  '.join(fields) + '\n)')
    for cn in cons:
        if cn['ctype'] in ('p', 'u', 'c'):
            stmts.append(
                f'ALTER TABLE {q(tbl)} ADD CONSTRAINT {q(cn["cname"])} {cn["cdef"]}')
    for ix in idxs:
        d = ix['idef']
        if 'CREATE UNIQUE INDEX ' in d:
            d = d.replace('CREATE UNIQUE INDEX ', 'CREATE UNIQUE INDEX IF NOT EXISTS ', 1)
        else:
            d = d.replace('CREATE INDEX ', 'CREATE INDEX IF NOT EXISTS ', 1)
        stmts.append(d)
    return stmts


async def do_schema(ctx: Ctx, local: asyncpg.Connection, prod: asyncpg.Connection,
                    apply: bool) -> int:
    missing = ctx.prod_only
    if not missing:
        log('[schema] 本地不缺表,无需补齐')
        return 0

    nonzero = [t for t in missing if ctx.prod[t].rows]
    log(f'[schema] 本地缺 {len(missing)} 张表(其中非空 {len(nonzero)} 张)')
    for t in nonzero:
        log(f'    {t}  ~{ctx.prod[t].rows} 行')
    if not apply:
        log('\n[schema] dry-run 结束。加 --apply 会在本地建出这些表(只建表,不动已有表)')
        return 0

    # 先同步扩展(pg_trgm/pgcrypto 等):类型/索引依赖它们,缺了会导致建表失败
    ext_rows = await prod.fetch("SELECT extname FROM pg_extension WHERE extname <> 'plpgsql'")
    got_ext: list[str] = []
    for r in ext_rows:
        try:
            await local.execute(f'CREATE EXTENSION IF NOT EXISTS {q(r["extname"])}')
            got_ext.append(r['extname'])
        except Exception:  # noqa: BLE001
            pass
    log(f'[schema] 扩展就绪: {", ".join(got_ext) if got_ext else "(无)"}')

    col_rows = await prod.fetch(SQL_DDL_COLUMNS, missing)
    cons = await prod.fetch(SQL_DDL_CONSTRAINTS, missing)
    idxs = await prod.fetch(SQL_DDL_INDEXES, missing)

    by_cols: dict[str, list[Any]] = {}
    for r in col_rows:
        by_cols.setdefault(r['tbl'], []).append(r)
    by_cons: dict[str, list[Any]] = {}
    for r in cons:
        by_cons.setdefault(r['tbl'], []).append(r)
    by_idx: dict[str, list[Any]] = {}
    for r in idxs:
        by_idx.setdefault(r['tbl'], []).append(r)

    per_table: list[tuple[str, list[str]]] = []
    for t in missing:
        if not by_cols.get(t):
            continue
        per_table.append((t, build_ddl(t, by_cols[t], by_cons.get(t, []), by_idx.get(t, []))))

    n_stmts = sum(len(s) for _, s in per_table)
    log(f'[schema] 从生产 catalog 读出 {len(by_cols)} 张表定义,生成 {n_stmts} 条 DDL,执行中')
    ok_t = fail_t = 0
    failed_tables: list[str] = []
    err_detail: list[str] = []
    for t, stmts in per_table:
        bad = False
        for s in stmts:
            try:
                await local.execute(s)
            except Exception as e:  # noqa: BLE001
                bad = True
                if len(err_detail) < 6:
                    err_detail.append(f'{t}: {str(e)[:110]}')
        if bad:
            fail_t += 1
            failed_tables.append(t)
        else:
            ok_t += 1

    log(f'[schema] 完成:建成 {ok_t} 张,失败 {fail_t} 张')
    if failed_tables:
        log(f'    未建成({len(failed_tables)}): {", ".join(failed_tables)}')
    for e in err_detail:
        log(f'    ERROR {e}')
    return 0 if fail_t == 0 else 1


# ---------------------------------------------------------------------------
# diff:只拉主键(+updated_at)判增量,按需分批取行
# ---------------------------------------------------------------------------
async def collect_pending(
    local: asyncpg.Connection, prod: asyncpg.Connection, m: TableMeta, common_pk: list[str],
) -> tuple[list[tuple[Any, ...]], int, int]:
    """返回 (待回灌主键列表, 生产行数, 本地行数)。"""
    sel = ', '.join(q(c) for c in common_pk)
    if m.has_updated_at:
        sel += ', ' + q('updated_at')
    lrows = await local.fetch(f'SELECT {sel} FROM {q(m.name)}')
    prows = await prod.fetch(f'SELECT {sel} FROM {q(m.name)}')

    if m.has_updated_at:
        pmap: dict[tuple[Any, ...], Any] = {
            tuple(r[c] for c in common_pk): r['updated_at'] for r in prows
        }
    else:
        pmap = {tuple(r[c] for c in common_pk): None for r in prows}

    pending: list[tuple[Any, ...]] = []
    for r in lrows:
        key = tuple(r[c] for c in common_pk)
        if key not in pmap:
            pending.append(key)
        elif m.has_updated_at:
            lv, pv = r['updated_at'], pmap[key]
            if lv is not None and pv is not None and lv > pv:
                pending.append(key)
    return pending, len(prows), len(lrows)


async def fetch_rows(
    local: asyncpg.Connection, m: TableMeta, common_pk: list[str], common_cols: list[str],
    keys: list[tuple[Any, ...]], large: bool,
) -> list[dict[str, Any]]:
    """按主键取本地行。复合主键或大表用整表拉取(调用方已确保 keys 非空)。"""
    col_sql = ', '.join(q(c) for c in common_cols)
    if len(common_pk) == 1:
        pk = common_pk[0]
        out: list[dict[str, Any]] = []
        for i in range(0, len(keys), BATCH):
            chunk = [k[0] for k in keys[i:i + BATCH]]
            rows = await local.fetch(
                f'SELECT {col_sql} FROM {q(m.name)} WHERE {q(pk)} = ANY($1)', chunk)
            out.extend(dict(r) for r in rows)
        return out
    rows = await local.fetch(f'SELECT {col_sql} FROM {q(m.name)}')
    wanted = set(keys)
    return [dict(r) for r in rows if tuple(r[c] for c in common_pk) in wanted]


def _hashable(v: Any) -> Any:
    """把 asyncpg 返回的不可哈希值(jsonb→dict/list、bytea)归一化成可哈希值。"""
    if isinstance(v, (list, dict)):
        return json.dumps(v, sort_keys=True, default=str)
    if isinstance(v, (bytes, bytearray)):
        return bytes(v).hex()
    return v


async def keyless_pending(local: asyncpg.Connection, prod: asyncpg.Connection,
                          m: TableMeta, cols: list[str]) -> list[dict[str, Any]]:
    """无主键表:用全列指纹去重,返回"本地有、生产没有"的行(超上限返回空,只镜像)。"""
    if not cols:
        return []
    # 先用元数据里的(精确)行数拦大表:无主键表要**全表拉两端**做指纹,生产侧真的涨到
    # 几十万行时,隧道下就是分钟级灾难。此前只在拉回本地后才判上限 —— 代价已经付了。
    if m.rows > KEYLESS_MAX_ROWS:
        return []
    col_sql = ', '.join(q(c) for c in cols)
    lrows = await local.fetch(f'SELECT {col_sql} FROM {q(m.name)}')
    if len(lrows) > KEYLESS_MAX_ROWS:
        return []
    prows = await prod.fetch(f'SELECT {col_sql} FROM {q(m.name)}')
    have = {tuple(_hashable(r[c]) for c in cols) for r in prows}
    return [dict(r) for r in lrows if tuple(_hashable(r[c]) for c in cols) not in have]


# ---------------------------------------------------------------------------
# 子命令: drift
# ---------------------------------------------------------------------------
@dataclass
class TableDiff:
    name: str
    strategy: str
    pending: int
    prod_rows: int
    local_rows: int
    guarded: bool = False
    type_conflict: list[str] = field(default_factory=list)


async def scan(ctx: Ctx, local: asyncpg.Connection, prod: asyncpg.Connection,
               only: set[str] | None = None) -> list[TableDiff]:
    out: list[TableDiff] = []
    # 变量名刻意避开 n:下面无主键分支里 `n = len(keyless)` 会把它覆盖掉,
    # 导致收尾统计打出"比对 21 张表"这种明显错数(2026-09-22 实测踩到)。
    seen = 0
    skipped_empty = 0
    t0 = time.monotonic()
    for name in ctx.both:
        if only and name not in only:
            continue
        seen += 1
        # 进度输出:这一段在实测里是整轮最长的静默期(生产侧单次往返数百毫秒,
        # 逐表比对累积到几分钟级)。没有进度行时,超时被杀会查不出卡在哪。
        if seen % 100 == 0:
            log(f'[scan] 已比对 {seen}/{len(ctx.both)} 张表,用时 {time.monotonic() - t0:.0f}s')
        lm, pm = ctx.local[name], ctx.prod[name]
        if lm.rows == 0 and pm.rows == 0:
            skipped_empty += 1
            continue
        conflict = ctx.type_conflicts(name)
        if max(lm.rows, pm.rows) >= BIG_TABLE_ROWS:
            # 超大表快速路径:不拉全量主键(88 万行 ×2 端会拖爆隧道并让整轮超时)。
            # 本地明显更多 → 判为观测噪音,标记护栏由 sync 跳过;否则视为无待回灌增量
            # (这类表以护栏/镜像为主,单行更新靠 mirror 兜底)。
            delta = max(lm.rows - pm.rows, 0)
            guarded = delta > max(GUARD_MIN, int(pm.rows * GUARD_RATIO))
            out.append(TableDiff(name, pm.strategy, delta, pm.rows, lm.rows, guarded, conflict))
            continue
        common_pk = ctx.common_pk(name)
        if not common_pk:
            keyless = await keyless_pending(local, prod, pm, ctx.common_cols(name))
            n = len(keyless)
            limit = max(GUARD_MIN, int(pm.rows * GUARD_RATIO))
            out.append(TableDiff(name, 'keyless-insert', n, pm.rows, lm.rows, n > limit, conflict))
            continue
        pending, pn, ln = await collect_pending(local, prod, pm, common_pk)
        limit = max(GUARD_MIN, int(pn * GUARD_RATIO))
        guarded = bool(pending) and len(pending) > limit
        out.append(TableDiff(name, pm.strategy, len(pending), pn, ln, guarded, conflict))
    log(f'[scan] 完成:比对 {seen} 张表,{len(out)} 张有过内容,'
        f'两端皆空跳过 {skipped_empty} 张,用时 {time.monotonic() - t0:.0f}s')
    return out


async def do_drift(ctx: Ctx, local: asyncpg.Connection, prod: asyncpg.Connection, fail: bool) -> int:
    diffs = await scan(ctx, local, prod)
    changed = [d for d in diffs if d.pending]
    conflict = [d for d in diffs if d.type_conflict]
    log(f'[drift] 参与对比的表 {len(diffs)} 张;有未回灌增量的 {len(changed)} 张')
    if changed:
        log(f"{'table':<40}{'待回灌':>8}{'本地':>10}{'生产':>10}  策略")
        for d in sorted(changed, key=lambda x: -x.pending):
            mark = '  ⚠护栏(默认跳过)' if d.guarded else (
                '  ⚠类型漂移(跳过)' if d.type_conflict else '')
            log(f'{d.name:<40}{d.pending:>8}{d.local_rows:>10}{d.prod_rows:>10}  '
                f'{STRATEGY_LABEL[d.strategy]}{mark}')
    tail = [d for d in diffs if d.strategy == 'keyless-insert']
    if tail:
        joined = ', '.join(f'{d.name}({d.pending})' for d in tail)
        log(f'[drift] 无主键表 {len(tail)} 张(全列指纹去重补新增): {joined}')
    if conflict:
        log(f'[drift] 两端列类型漂移、无法直接回灌的表 {len(conflict)} 张(需先对齐迁移):')
        for d in conflict:
            log(f'    {d.name}: {"; ".join(d.type_conflict[:3])}')
    if ctx.prod_only:
        log(f'[drift] 本地缺表 {len(ctx.prod_only)} 张(未参与对比,跑 `schema --apply` 补齐)')
    if changed:
        log('\n[drift] 跑 `pnpm db:sync --apply` 回灌到生产;或 `pnpm db:mirror --yes` 用生产覆盖本地')
        return 1 if fail else 0
    log('[drift] 两端全表一致')
    return 0


# ---------------------------------------------------------------------------
# 子命令: sync(本地 → 生产)
# ---------------------------------------------------------------------------
SQL_FK_EDGES = """
SELECT con.conrelid::regclass::text AS child,
       con.confrelid::regclass::text AS parent
FROM pg_constraint con
JOIN pg_namespace n ON n.oid = con.connamespace
WHERE con.contype = 'f' AND n.nspname = 'public'
"""


def topo_sort(tables: list[str], edges: list[tuple[str, str]]) -> list[str]:
    """按外键依赖排序(父表在前)。存在环时保留剩余表的原相对顺序。"""
    want = set(tables)
    deps: dict[str, set[str]] = {t: set() for t in tables}
    for child, parent in edges:
        c = child.split('.')[-1].strip('"')
        p = parent.split('.')[-1].strip('"')
        if c in want and p in want and c != p:
            deps[c].add(p)
    out: list[str] = []
    remaining = set(tables)
    while remaining:
        free = [t for t in tables if t in remaining and not (deps[t] & remaining)]
        if not free:  # 循环依赖(自引用等):放弃排序,按原顺序收尾
            out.extend(t for t in tables if t in remaining)
            break
        for t in free:
            out.append(t)
            remaining.discard(t)
    return out


async def build_uid_map(local: asyncpg.Connection, prod: asyncpg.Connection) -> dict[str, str]:
    """本地 user_id → 生产 user_id(按 email 对齐)。镜像后两端 UUID 一致,map 为恒等。

    key/value 一律用 **str**:各表 user_id 列类型不统一(`publish_*` 是 varchar,
    `chat_conversations` 是 uuid),用 UUID 对象做 key 会让 varchar 列的比较永远落空
    (2026-09-22 实测:21 行带着本地 UUID 写进了生产)。
    """
    try:
        lu = await local.fetch('SELECT id, email FROM users')
        pu = await prod.fetch('SELECT id, email FROM users')
    except asyncpg.exceptions.UndefinedColumnError:
        return {}
    by_email = {r['email']: str(r['id']) for r in pu if r['email']}
    return {str(r['id']): by_email[r['email']] for r in lu if r['email'] and r['email'] in by_email}


async def push_rows(prod: asyncpg.Connection, name: str, cols: list[str], pk: list[str],
                    rows: list[dict[str, Any]], has_updated_at: bool,
                    uid_map: dict[str, str], keyless: bool = False,
                    conflict_cols: list[str] | None = None) -> tuple[int, int, int, str]:
    """写入生产,返回 (成功行数, 冲突跳过行数, 未落地行数, 首次失败原因)。

    "未落地"必须与"冲突跳过"分开计数(2026-09-22 实测教训):二者此前合并成一个
    skipped,于是"整表一行都没写进生产"(resources 720 行、ai_world_items 4108 行)
    在汇总里只表现为"冲突跳过",与"该行生产已存在"无从区分;叠加 do_sync 固定
    return 0,最终输出"已回灌 1350 行 (失败 0 张)"这种乐观结论,而真实缺口是
    4833 行 —— 正是用户要求"不可以再出现"的静默漏同步。
    现在:① 系统性失败早退、② 大批量不重放,两类都单独计入 abandoned,
    由 do_sync 点名"零落地"表并拉高退出码,让调度器/CI 能看见。
    注意回放路径用的是无 arbiter 的 `ON CONFLICT DO NOTHING`,单行插入若报错必是
    真失败(已存在的行会静默成功并计入 written),故回放失败也计入冲突跳过。
    """
    if not rows:
        return 0, 0, 0, ''
    col_sql = ', '.join(q(c) for c in cols)
    ph = ', '.join(f'${i + 1}' for i in range(len(cols)))
    if keyless:
        sql = f'INSERT INTO {q(name)} ({col_sql}) VALUES ({ph})'
        fallback = sql
    else:
        pk_sql = ', '.join(q(c) for c in (conflict_cols or pk))
        if has_updated_at:
            set_cols = [c for c in cols if c not in (conflict_cols or pk) and c not in pk]
            set_sql = ', '.join(f'{q(c)} = EXCLUDED.{q(c)}' for c in set_cols)
            sql = (f'INSERT INTO {q(name)} ({col_sql}) VALUES ({ph}) '
                   f'ON CONFLICT ({pk_sql}) DO UPDATE SET {set_sql} '
                   f'WHERE EXCLUDED."updated_at" > {q(name)}."updated_at"')
        else:
            sql = (f'INSERT INTO {q(name)} ({col_sql}) VALUES ({ph}) '
                   f'ON CONFLICT ({pk_sql}) DO NOTHING')
        fallback = (f'INSERT INTO {q(name)} ({col_sql}) VALUES ({ph}) '
                    f'ON CONFLICT DO NOTHING')

    values: list[tuple[Any, ...]] = []
    for row in rows:
        uid = row.get('user_id')
        if uid is not None and str(uid) in uid_map:
            row['user_id'] = uid_map[str(uid)]
        values.append(tuple(row.get(c) for c in cols))

    written = skipped = abandoned = 0
    first_err = ''
    failed_chunks = 0
    replay_deadline = time.monotonic() + REPLAY_MAX_SECONDS
    for i in range(0, len(values), BATCH):
        chunk = values[i:i + BATCH]
        try:
            async with prod.transaction():
                await prod.executemany(sql, chunk)
            written += len(chunk)
            failed_chunks = 0
            continue
        except asyncpg.exceptions.PostgresError as e:
            # 只捕 PostgresError:连接级异常(InterfaceError)必须冒泡,否则会被吞掉后
            # 在后续语句才炸成难查的 "connection is closed"。
            if not first_err:
                first_err = f'{type(e).__name__}: {str(e)[:110]}'
        failed_chunks += 1
        if failed_chunks >= SYSTEMIC_FAIL_CHUNKS:
            # 系统性失败:本表余下批次直接跳过,不再逐批试(每批都要付一次失败事务
            # + 外键校验的代价),否则整轮同步会被单表拖死。
            # 这些行是"没写进生产",不是"冲突跳过",单独计数,别让汇总乐观。
            abandoned += len(chunk)
            continue
        if len(chunk) > VERIFY_ROW_LIMIT or time.monotonic() >= replay_deadline:
            # 大批量整体冲突(典型:外键指向生产不存在的父行):不做逐行重放,
            # 数千次失败事务会拖垮隧道连接。整批计为未落地并保留失败原因。
            abandoned += len(chunk)
            continue
        async with prod.transaction():
            for row in chunk:
                try:
                    async with prod.transaction():  # SAVEPOINT:单行失败不留脏事务
                        await prod.execute(fallback, *row)
                    written += 1
                except asyncpg.exceptions.PostgresError:
                    skipped += 1
                if time.monotonic() >= replay_deadline:
                    break
    return written, skipped, abandoned, first_err


async def do_sync(ctx: Ctx, local: asyncpg.Connection, prod: asyncpg.Connection,
                  apply: bool, force: bool, only: set[str] | None,
                  exclude: set[str], max_rows: int) -> int:
    uid_map = await build_uid_map(local, prod)
    diffs = await scan(ctx, local, prod, only)
    # 按生产外键依赖排序(父表先写):字母序会让子表先于父表插入从而撞外键
    fk_rows = await prod.fetch(SQL_FK_EDGES)
    rank = {n: i for i, n in enumerate(
        topo_sort([d.name for d in diffs], [(r['child'], r['parent']) for r in fk_rows]))}
    diffs.sort(key=lambda d: rank.get(d.name, 10 ** 6))
    total = tables_touched = skipped_guard = skipped_type = failed = 0
    undelivered = partial = 0
    # 未同步表名清单:用户要求"所有表都要同步",那么"哪几张没同步、为什么"必须点名,
    # 否则汇总里的数字(护栏跳过 5 张 / 失败 15 张)无法落地到具体表。
    guard_names: list[str] = []
    type_names: list[str] = []
    failed_names: list[str] = []
    undelivered_names: list[str] = []
    partial_names: list[str] = []

    def conflict_target(name: str, common_pk: list[str]) -> list[str] | None:
        """优先用业务唯一键做 upsert 冲突目标。

        两端主键不同的行,只有业务键相同时才代表同一实体;以主键为冲突目标会直接撞
        唯一约束整批失败,以业务唯一键为目标才能正确合并/更新(2026-09-22 实测 8 张表)。
        """
        cc = set(ctx.common_cols(name))
        for cols in ctx.uniq.get(name, []):
            if cols and set(cols) <= cc and set(cols) != set(common_pk):
                return list(cols)
        return None

    async def write_one(diff: TableDiff) -> tuple[int, int, int, str]:
        """写单表(闭包读外层 prod,连接重建后自动用新连接)。"""
        meta = ctx.prod[diff.name]
        common_cols = ctx.common_cols(diff.name)
        if diff.strategy == 'keyless-insert':
            rows = await keyless_pending(local, prod, meta, common_cols)
            return await push_rows(prod, diff.name, common_cols, [], rows, False, uid_map,
                                   keyless=True)
        common_pk = ctx.common_pk(diff.name)
        keys = await collect_pending_keys(local, prod, meta, common_pk)
        rows = await fetch_rows(local, meta, common_pk, common_cols, keys,
                                diff.pending > LARGE_TABLE_ROWS)
        return await push_rows(prod, diff.name, common_cols, common_pk, rows,
                               meta.has_updated_at, uid_map,
                               conflict_cols=conflict_target(diff.name, common_pk))

    for d in diffs:
        if d.name in exclude:
            continue
        m = ctx.prod[d.name]
        if not d.pending:
            continue
        if d.type_conflict:
            skipped_type += 1
            type_names.append(d.name)
            log(f'{d.name:<40} ⚠ 跳过:{len(d.type_conflict)} 个共有列两端类型漂移 '
                f'({"; ".join(d.type_conflict[:2])}) —— 需先对齐迁移')
            continue
        if d.guarded and not force and not (only and d.name in only):
            log(f'{d.name:<40} ⚠ 跳过护栏:{d.pending} 行待回灌 > '
                f'max({GUARD_MIN}, 生产 {d.prod_rows}×{GUARD_RATIO}) —— 疑本机观测噪音;'
                f'确认要同步用 --force 或 --tables {d.name}')
            skipped_guard += 1
            guard_names.append(d.name)
            continue
        if max_rows and d.pending > max_rows:
            log(f'{d.name:<40} 跳过:待回灌 {d.pending} 行 > --max-rows {max_rows}')
            continue

        common_cols = ctx.common_cols(d.name)
        log(f'{d.name:<40} 待回灌 {d.pending} 行 '
            f'({STRATEGY_LABEL[d.strategy]},本地 {d.local_rows}/生产 {d.prod_rows})')
        if not apply:
            total += d.pending
            continue

        try:
            written, conflicts, abandoned, ferr = await write_one(d)
        except asyncpg.exceptions.InterfaceError as e:
            # 隧道/生产连接中断:重建连接后重试本表(不重连会让后续每张表连环失败)
            log(f'    ⚠ 生产连接中断({str(e)[:60]}),重建连接后重试')
            with contextlib.suppress(Exception):
                await prod.close()
            try:
                prod = await reconnect_prod(ctx.cfg)
                written, conflicts, abandoned, ferr = await write_one(d)
            except Exception as e2:  # noqa: BLE001
                failed += 1
                failed_names.append(d.name)
                log(f'    ✗ 重连后仍失败({type(e2).__name__}): {str(e2)[:120]}')
                continue
        except Exception as e:  # noqa: BLE001
            failed += 1
            failed_names.append(d.name)
            log(f'    ✗ 写入失败({type(e).__name__}): {str(e)[:150]}')
            continue
        after = await prod.fetchval(f'SELECT count(*) FROM {q(d.name)}')
        not_landed = conflicts + abandoned
        note = f',冲突跳过 {conflicts}' if conflicts else ''
        note += f',未落地 {abandoned}' if abandoned else ''
        if ferr:
            note += f' [首次失败 {ferr}]'
        log(f'    → 已写入 {written} 行{note};生产现 {after} 行')
        total += written
        # tables_touched 只统计"真的写进去了"的表:此前不论 written 是否为 0 都 +1,
        # 于是"涉及 16 张表"里混进了 resources(0/720 行)这种一行没进的表,属于
        # 把未同步说成已同步,已在 2026-09-22 实测中暴露,必须纠正。
        if written:
            tables_touched += 1
        if not written:
            # 有待回灌行却一行都没落地:这不是"冲突跳过"能解释的,点名 + 拉高退出码。
            undelivered += 1
            undelivered_names.append(d.name)
        elif not_landed:
            partial += 1
            partial_names.append(f'{d.name}({not_landed})')

    verb = '已回灌' if apply else '待回灌'
    log(f'\n[sync] {verb} {total} 行,涉及 {tables_touched} 张表'
        f'(护栏跳过 {skipped_guard} 张,类型漂移跳过 {skipped_type} 张,'
        f'失败 {failed} 张,零落地 {undelivered} 张)')
    if guard_names:
        log(f'[sync] 护栏跳过({len(guard_names)}): {", ".join(sorted(guard_names))}')
        log('[sync]   ↑ 这些表本地待回灌量相对生产过大,疑本机观测噪音;'
            '确认要同步用 `--force` 或 `--tables 表名`')
    if type_names:
        log(f'[sync] 类型漂移跳过({len(type_names)}): {", ".join(sorted(type_names))}')
        log('[sync]   ↑ 两端同名列类型不同,强写会 DataError;需先对齐迁移再同步')
    if failed_names:
        log(f'[sync] 写入失败({len(failed_names)}): {", ".join(sorted(failed_names))}')
        log('[sync]   ↑ 多为外键父行缺失 / 唯一键冲突;见各行 ✗ 明细')
    if undelivered_names:
        log(f'[sync] 零落地({len(undelivered_names)}): {", ".join(sorted(undelivered_names))}')
        log('[sync]   ↑ 有待回灌行却一行都没进生产(唯一键/外键冲突或本地数据重复),'
            '不计入"涉及张数";需先处置数据再复跑,否则缺口会一直静默存在')
    if partial_names:
        log(f'[sync] 部分未落地({len(partial_names)}): {", ".join(sorted(partial_names))}')
    if not apply and total:
        log('[sync] 这是 dry-run,加 --apply 才真正写入生产')
    # 退出码必须反映"有没有真缺口":此前无条件 return 0,导致 resources 720 行
    # 全数未进生产时仍是绿色退出,调度器/CI 与用户都看不见。
    if failed or undelivered:
        return 1
    return 0


async def collect_pending_keys(local: asyncpg.Connection, prod: asyncpg.Connection,
                               m: TableMeta, common_pk: list[str]) -> list[tuple[Any, ...]]:
    keys, _, _ = await collect_pending(local, prod, m, common_pk)
    return keys


# ---------------------------------------------------------------------------
# 子命令: mirror(生产 → 本地 全表)
# ---------------------------------------------------------------------------
async def backup_local(local: asyncpg.Connection, ctx: Ctx) -> Path:
    """备份本地"非共有表"(TRUNCATE ... CASCADE 可能级联到的候选),防误伤。"""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    out = BACKUP_DIR / f'local-nonshared-{time.strftime("%Y%m%d-%H%M%S")}.json'
    data: dict[str, list[dict[str, Any]]] = {}
    for name in ctx.local_only:
        try:
            rows = await local.fetch(f'SELECT * FROM {q(name)}')
            data[name] = [dict(r) for r in rows]
        except Exception as e:  # noqa: BLE001
            data[name] = [{'__error__': str(e)}]
    out.write_text(json.dumps(data, ensure_ascii=False, default=str), encoding='utf-8')
    log(f'[mirror] 本地非共有表已备份 → {out} ({len(data)} 张)')
    return out


async def do_mirror(ctx: Ctx, local: asyncpg.Connection, prod: asyncpg.Connection,
                    yes: bool, only: set[str] | None, force: bool) -> int:
    log('[mirror] 第 1 步:先把本地增量回灌到生产(避免被覆盖丢失)')
    await do_sync(ctx, local, prod, apply=True, force=force, only=only,
                  exclude=set(), max_rows=0)

    targets = [t for t in ctx.both if not only or t in only]
    if not yes:
        log(f'\n[mirror] dry-run 结束。将用生产数据覆盖本地 {len(targets)} 张共有表(TRUNCATE)')
        log('         确认请加 --yes')
        return 0

    await backup_local(local, ctx)

    log(f'[mirror] 第 2 步:覆盖本地 {len(targets)} 张表')
    names_sql = ', '.join(q(t) for t in targets)
    # CASCADE 只在"全表镜像"时用:它是为了清掉指向共有表的**非共有**本地表
    # (那些表已被 backup_local 备份)。而 `--tables` 子集镜像时,targets 只含被点名的表,
    # CASCADE 却会顺手清空"指向它们的其他共有表",而那些表不在 targets 里、不会被回填
    # ⇒ 静默丢数据。子集镜像一律不带 CASCADE:真有外键引用就报错退出,让人显式决定。
    cascade = '' if only else ' CASCADE'
    async with local.transaction():
        await local.execute(f'TRUNCATE TABLE {names_sql}{cascade}')

        imported = skipped_empty = 0
        for name in targets:
            m = ctx.prod[name]
            cols = ctx.common_cols(name)
            if not cols:
                continue
            col_sql = ', '.join(q(c) for c in cols)
            buf: list[tuple[Any, ...]] = []
            n = 0
            async with prod.transaction():
                # prefetch 必须拉大:asyncpg 游标默认每次只预取 50 行,88 万行的
                # ai_feed_snapshot 会变成 1.7 万次往返(隧道下十几分钟);拉到
                # COPY_BATCH 后往返数降两个数量级。
                async for rec in prod.cursor(f'SELECT {col_sql} FROM {q(name)}',
                                             prefetch=COPY_BATCH):
                    buf.append(tuple(rec))
                    n += 1
                    if len(buf) >= COPY_BATCH:
                        await local.copy_records_to_table(name, records=buf, columns=cols)
                        buf.clear()
                if buf:
                    await local.copy_records_to_table(name, records=buf, columns=cols)
            if n:
                imported += 1
                log(f'    {name:<40} 导入 {n} 行')
            else:
                skipped_empty += 1
    log(f'[mirror] 完成:非空表 {imported} 张已导入,空表 {skipped_empty} 张;'
        f'本地库现与生产一致(含 users,UUID 相同)')
    return 0


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
def parse_set(raw: str) -> set[str]:
    return {x.strip() for x in raw.split(',') if x.strip()}


async def main() -> int:
    global _JSON_MODE
    ap = argparse.ArgumentParser(description='生产 ⇄ 本地 全表数据同步器')
    ap.add_argument('mode', choices=['tables', 'schema', 'drift', 'sync', 'mirror'])
    ap.add_argument('--apply', action='store_true', help='sync/schema: 真正执行(默认 dry-run)')
    ap.add_argument('--yes', action='store_true', help='mirror: 确认覆盖本地库')
    ap.add_argument('--fail', action='store_true', help='drift: 有未回灌增量时 exit 1')
    ap.add_argument('--force', action='store_true', help='sync/mirror: 忽略大表噪音护栏')
    ap.add_argument('--tables', default='', help='sync/mirror: 只处理这些表(逗号分隔)')
    ap.add_argument('--exclude', default='', help='sync: 排除这些表(逗号分隔)')
    ap.add_argument('--max-rows', type=int, default=0, help='sync: 单表回灌行数上限(0=不限)')
    ap.add_argument('--json', action='store_true', help='除人读报告外额外输出一行机器可读摘要')
    args = ap.parse_args()
    _JSON_MODE = bool(args.json)

    cfg = load_cfg()
    local = await asyncpg.connect(load_local_dsn())
    tunnel = ensure_tunnel(cfg)
    rc = 1
    try:
        prod = await asyncpg.connect(prod_dsn(cfg))
        try:
            ctx = await build_ctx(local, prod, cfg)
            only = parse_set(args.tables) or None
            if args.mode == 'tables':
                rc = await do_tables(ctx)
            elif args.mode == 'schema':
                rc = await do_schema(ctx, local, prod, args.apply)
            elif args.mode == 'drift':
                rc = await do_drift(ctx, local, prod, args.fail)
            elif args.mode == 'sync':
                rc = await do_sync(ctx, local, prod, args.apply, args.force, only,
                                   parse_set(args.exclude), args.max_rows)
            else:
                rc = await do_mirror(ctx, local, prod, args.yes, only, args.force)
        finally:
            await prod.close()
    finally:
        stop_tunnel(tunnel)
        await local.close()
        emit_json(args.mode, rc)
    return rc


sys.exit(asyncio.run(main()))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
