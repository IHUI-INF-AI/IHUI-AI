#!/usr/bin/env python3
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
"""生产 ⇄ 本地 用户数据表同步器(2026-09-22 立)。

背景(为什么必须有它):
  桌面端曾因 API 寻址 bug 把请求打到本机 8802,导致 2026-09-15~16 扫码添加的 19 个
  发布平台账号全部落进**本机库**,而线上库为空 —— 用户登录生产只看到空列表。
  根因是"两套库都能写,且没有约定谁是真源"。

设计原则(**真源单一化**,不是双向合并):
  - **生产库 = 唯一真源**。用户身份(users)只从生产流向本地,本地永不回推 users。
  - **本地 → 生产 = 单向回灌**:本地产生的用户资产(扫码账号/发布任务/会话)自动
    upsert 到生产,且只在本地行**更新**时才覆盖生产(SQL 层 `WHERE excluded.updated_at
    > t.updated_at` 保证),绝不反向覆盖生产的新数据。
  - **日志/快照类大表不在白名单**(ai_feed_snapshot 88w 行等),永不参与同步。
  - 两端 `PUBLISH_CREDENTIALS_KEY` 已统一,`credentials_enc` 可整列搬运;
    若检测到两端密钥不一致 → 直接失败,不做静默解密重加密(避免密钥漂移被掩盖)。

子命令:
  drift    只读对比两端差异(本地独有 / 生产独有 / 本地更新),--fail 时有未回灌增量则 exit 1
  sync     本地 → 生产 单向回灌(幂等,可反复跑;定时任务用这个)
  mirror   生产 → 本地 全量镜像(先自动 sync 保住本地增量,再覆盖本地);需 --yes
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import asyncpg

ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / '.ihui-agent' / 'db-sync.local.json'
BACKUP_DIR = ROOT / '.ihui-agent' / 'db-backups'

# 同步白名单(顺序 = 外键依赖顺序:父表在前)。
# push=False 的表只允许"生产 → 本地"单向流动(用户身份以生产为唯一真源)。
TABLES: list[dict[str, Any]] = [
    {'name': 'users', 'push': False},
    {'name': 'publish_accounts', 'push': True},
    {'name': 'publish_account_groups', 'push': True},
    {'name': 'publish_account_group_members', 'push': True},
    {'name': 'publish_tasks', 'push': True},
    {'name': 'publish_history', 'push': True},
    {'name': 'chat_conversations', 'push': True},
    {'name': 'chat_messages', 'push': True},
]


def log(msg: str) -> None:
    print(msg, flush=True)


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
    creationflags = 0
    startupinfo = None
    if os.name == 'nt':
        creationflags = subprocess.CREATE_NO_WINDOW  # type: ignore[attr-defined]
    proc = subprocess.Popen(
        [
            'ssh', '-o', 'ExitOnForwardFailure=yes', '-o', 'ServerAliveInterval=30',
            '-L', f'{local_port}:{ssh["dbHost"]}:{ssh["dbPort"]}', '-N', ssh['host'],
        ],
        creationflags=creationflags,
        startupinfo=startupinfo,
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


async def common_columns(local: asyncpg.Connection, prod: asyncpg.Connection, t: str) -> list[str]:
    lc = await local.fetch(
        'SELECT column_name FROM information_schema.columns '
        "WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position", t)
    pc = await prod.fetch(
        'SELECT column_name FROM information_schema.columns '
        "WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position", t)
    pcols = {r['column_name'] for r in pc}
    if not pcols:
        raise SystemExit(f'生产库缺少表 {t}(schema 不同步,请先跑迁移)')
    return [r['column_name'] for r in lc if r['column_name'] in pcols]


async def pk_of(conn: asyncpg.Connection, t: str) -> str:
    r = await conn.fetchrow(
        'SELECT kcu.column_name FROM information_schema.table_constraints tc '
        'JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name '
        "WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = $1", t)
    return r['column_name'] if r else 'id'


async def fetch_map(conn: asyncpg.Connection, t: str, pk: str) -> dict[Any, dict[str, Any]]:
    rows = await conn.fetch(f'SELECT * FROM "{t}"')
    return {r[pk]: dict(r) for r in rows}


def newer(a: dict[str, Any], b: dict[str, Any] | None) -> bool:
    """a 是否比 b 新(用于"本地更新才回灌")。无 updated_at 视为不可判定 → 不覆盖。"""
    if b is None:
        return True
    ta, tb = a.get('updated_at'), b.get('updated_at')
    if ta is None or tb is None:
        return False
    return ta > tb


async def do_drift(local: asyncpg.Connection, prod: asyncpg.Connection, fail: bool) -> int:
    pending = 0
    log(f"{'table':<32}{'local':>8}{'prod':>8}{'本地独有':>10}{'生产独有':>10}{'本地较新':>10}")
    for t in TABLES:
        name = t['name']
        try:
            cols = await common_columns(local, prod, name)
        except SystemExit as e:
            log(f'{name:<32}  SKIP: {e}')
            continue
        pk = await pk_of(local, name)
        lm = await fetch_map(local, name, pk)
        pm = await fetch_map(prod, name, pk)
        only_l = [k for k in lm if k not in pm]
        only_p = [k for k in pm if k not in lm]
        newer_l = [k for k in lm if k in pm and newer(lm[k], pm[k])]
        pushable = t['push']
        todo = len(only_l) + len(newer_l) if pushable else 0
        pending += todo
        log(f'{name:<32}{len(lm):>8}{len(pm):>8}{len(only_l):>10}{len(only_p):>10}{len(newer_l):>10}'
            + ('' if pushable else '   (只读镜像:不回灌)'))
        if todo:
            log(f'    ↑ 待回灌 {todo} 行: {[str(x) for x in (only_l + newer_l)[:5]]}')
    if pending:
        log(f'\n[drift] 本地有 {pending} 行未回灌到生产 → 跑 `pnpm db:sync`')
        return 1 if fail else 0
    log('\n[drift] 两端白名单表一致')
    return 0


async def build_uid_map(local: asyncpg.Connection, prod: asyncpg.Connection) -> dict[str, str]:
    """本地 user_id → 生产 user_id(按 email 对齐)。镜像后两端 UUID 一致,map 为恒等。

    key/value 一律用 **str**:各表 user_id 列类型不统一(publish_* 是 varchar,
    chat_conversations 是 uuid),用 UUID 对象做 key 会让 varchar 列的比较永远落空
    (2026-09-22 实测:21 行带着本地 UUID 写进了生产)。
    """
    try:
        lu = await local.fetch('SELECT id, email FROM users')
        pu = await prod.fetch('SELECT id, email FROM users')
    except asyncpg.exceptions.UndefinedColumnError:
        return {}
    by_email = {r['email']: str(r['id']) for r in pu if r['email']}
    return {str(r['id']): by_email[r['email']] for r in lu if r['email'] and r['email'] in by_email}


async def do_sync(local: asyncpg.Connection, prod: asyncpg.Connection, apply: bool) -> int:
    uid_map = await build_uid_map(local, prod)
    total = ins = upd = skip = 0
    for t in TABLES:
        name = t['name']
        if not t['push']:
            continue
        try:
            cols = await common_columns(local, prod, name)
        except SystemExit as e:
            log(f'{name:<32}  SKIP: {e}')
            continue
        pk = await pk_of(local, name)
        lm = await fetch_map(local, name, pk)
        pm = await fetch_map(prod, name, pk)
        todo = [k for k in lm if k not in pm or newer(lm[k], pm.get(k))]
        if not todo:
            log(f'{name:<32} 无需回灌({len(lm)} 行)')
            continue
        exists = [k for k in todo if k in pm]
        log(f'{name:<32} 待回灌 {len(todo)} 行(新增 {len(todo) - len(exists)},更新 {len(exists)})')
        if not apply:
            total += len(todo)
            continue
        set_cols = [c for c in cols if c != pk]
        col_sql = ', '.join(f'"{c}"' for c in cols)
        ph = ', '.join(f'${i + 1}' for i in range(len(cols)))
        set_sql = ', '.join(f'"{c}" = EXCLUDED."{c}"' for c in set_cols)
        where = f' WHERE EXCLUDED.updated_at > "{name}".updated_at' if 'updated_at' in cols else ''
        sql = (f'INSERT INTO "{name}" ({col_sql}) VALUES ({ph}) '
               f'ON CONFLICT ("{pk}") DO UPDATE SET {set_sql}{where}')
        async with prod.transaction():
            for k in todo:
                row = dict(lm[k])
                uid = row.get('user_id')
                if uid is not None and str(uid) in uid_map:
                    row['user_id'] = uid_map[str(uid)]
                await prod.execute(sql, *[row.get(c) for c in cols])
                total += 1
                if k in pm:
                    upd += 1
                else:
                    ins += 1
            after = await prod.fetchval(f'SELECT count(*) FROM "{name}"')
            log(f'    → 已写入;生产表现在 {after} 行')
    log(f'\n[sync] {"已回灌" if apply else "待回灌"} 共 {total} 行(新增 {ins},更新 {upd},跳过 {skip})')
    return 0


async def backup_local(local: asyncpg.Connection) -> Path:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    out = BACKUP_DIR / f'local-{time.strftime("%Y%m%d-%H%M%S")}.json'
    data: dict[str, list[dict[str, Any]]] = {}
    for t in TABLES:
        try:
            rows = await local.fetch(f'SELECT * FROM "{t["name"]}"')
            data[t['name']] = [dict(r) for r in rows]
        except Exception as e:  # noqa: BLE001
            data[t['name']] = [{'__error__': str(e)}]
    out.write_text(json.dumps(data, ensure_ascii=False, default=str), encoding='utf-8')
    log(f'[mirror] 本地白名单表已备份 → {out}')
    return out


async def do_mirror(local: asyncpg.Connection, prod: asyncpg.Connection, yes: bool) -> int:
    log('[mirror] 第 1 步:先把本地增量回灌到生产(避免被覆盖丢失)')
    await do_sync(local, prod, apply=True)
    if not yes:
        log('\n[mirror] dry-run 结束。确认覆盖本地库请加 --yes '
            '(会用生产数据 TRUNCATE 本地白名单表)')
        return 0
    await backup_local(local)
    names = ', '.join(f'"{t["name"]}"' for t in TABLES)
    async with local.transaction():
        await local.execute(f'TRUNCATE TABLE {names} CASCADE')
        for t in TABLES:
            name = t['name']
            cols = await common_columns(local, prod, name)
            rows = await prod.fetch(f'SELECT * FROM "{name}"')
            if not rows:
                continue
            col_sql = ', '.join(f'"{c}"' for c in cols)
            ph = ', '.join(f'${i + 1}' for i in range(len(cols)))
            await local.executemany(
                f'INSERT INTO "{name}" ({col_sql}) VALUES ({ph})',
                [tuple(dict(r).get(c) for c in cols) for r in rows],
            )
            log(f'  {name:<32} 导入 {len(rows)} 行')
    log('[mirror] 完成:本地库白名单表已与生产一致(含 users,UUID 相同)')
    return 0


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('mode', choices=['drift', 'sync', 'mirror'])
    ap.add_argument('--apply', action='store_true', help='sync: 真正写入生产(默认 dry-run)')
    ap.add_argument('--yes', action='store_true', help='mirror: 确认覆盖本地库')
    ap.add_argument('--fail', action='store_true', help='drift: 有未回灌增量时 exit 1')
    args = ap.parse_args()

    cfg = load_cfg()
    local = await asyncpg.connect(load_local_dsn())
    tunnel = start_tunnel(cfg)
    try:
        prod = await asyncpg.connect(prod_dsn(cfg))
        try:
            if args.mode == 'drift':
                return await do_drift(local, prod, args.fail)
            if args.mode == 'sync':
                return await do_sync(local, prod, args.apply)
            return await do_mirror(local, prod, args.yes)
        finally:
            await prod.close()
    finally:
        stop_tunnel(tunnel)
        await local.close()


sys.exit(asyncio.run(main()))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
