"""把最高管理员账号关联到手机号 + 邮箱 (2026-07-05 立).

背景:
  admin 系统管理员账号 (user_name='admin', 密码 admin123) 在 admin_user 表里原本
  phone (DB 列) 和 email 都为 NULL, 只能通过 user_name='admin' 登录. 用户要求把
  这个账号同时关联到手机号 18643389808 和邮箱 502319984@qq.com, 三种方式
  (user_name / 手机号 / 邮箱) 都能登录且都是最高管理员.

行为 (幂等, 跨 PG/SQLite 兼容):
  1. 直接走 engine1 连接 (PG 优先, SQLite fallback)
  2. 用 text() + 参数化 SQL 更新 (绕过 ORM 模型 __table_args__ schema='public'
     在 SQLite 上生成 public.admin_user 报错的问题)
  3. update admin_user 行的 phone / email / nick_name / user_uuid
  4. ensure admin_role (role_key='admin') 存在; 不存在则创建
  5. ensure admin_user_role 关联 (user_id=1, role_id=admin_role)
  6. select 校验全部生效

执行:
  cd server && python -m scripts.update_admin_account
  或:
  cd server && py -m scripts.update_admin_account
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from loguru import logger
from sqlalchemy import text

from app.database import engine1


ADMIN_USER_NAME = "admin"
ADMIN_PHONE = "18643389808"
ADMIN_EMAIL = "502319984@qq.com"
ADMIN_NICK_NAME = "最高管理员"
ADMIN_USER_UUID = "00000000-0000-0000-0000-000000000001"
ADMIN_ROLE_KEY = "admin"
ADMIN_ROLE_NAME = "超级管理员"
ADMIN_ROLE_SORT = 1


# 2026-07-05 注: admin_user 在模型上有 __table_args__ = {"schema": "public", ...}
# 在 SQLite fallback 上 ORM 会生成 public.admin_user 报 no such table.
# 此脚本用 text() + 原生 SQL, 跨 PG/SQLite 一致.
def _detect_admin_user_table(conn) -> str:
    """探测 admin_user 表的限定名 (含 schema if PG, 裸名 if SQLite).

    PG 上: public.admin_user (用 .table_schema='public' 验证存在)
    SQLite 上: admin_user (sqlite_master 查)
    """
    dialect = conn.dialect.name
    if dialect == "postgresql":
        row = conn.execute(
            text("SELECT to_regclass('public.admin_user')")
        ).scalar()
        if row:
            return "public.admin_user"
    # SQLite / 其他: 用裸名 (admin_user)
    return "admin_user"


def _detect_admin_role_table(conn) -> str:
    return "public.admin_role" if conn.dialect.name == "postgresql" else "admin_role"


def _detect_admin_user_role_table(conn) -> str:
    return "public.admin_user_role" if conn.dialect.name == "postgresql" else "admin_user_role"


def main() -> int:
    print(f"[update_admin_account] start")
    print(f"  target: user_name={ADMIN_USER_NAME!r}")
    print(f"  bind:   phone={ADMIN_PHONE!r}, email={ADMIN_EMAIL!r}")
    print(f"  nick:   {ADMIN_NICK_NAME!r}, role={ADMIN_ROLE_KEY!r}")

    with engine1.begin() as conn:
        dialect = conn.dialect.name
        print(f"  dialect: {dialect}")

        # 检测列: admin_user_role 可能是 (user_id, role_id) 或 (user_id, role_id, created_at, updated_at)
        ur_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(admin_user_role)")).fetchall()} if dialect == "sqlite" else \
                  {row[0] for row in conn.execute(text("""
                      SELECT column_name FROM information_schema.columns
                      WHERE table_name = 'admin_user_role' AND table_schema = 'public'
                  """)).fetchall()}
        has_ur_created = "created_at" in ur_cols
        print(f"  admin_user_role cols: {sorted(ur_cols)}")

        admin_user_t = _detect_admin_user_table(conn)
        admin_role_t = _detect_admin_role_table(conn)
        admin_user_role_t = _detect_admin_user_role_table(conn)

        # 1. 查 admin user 旧值
        row = conn.execute(
            text(f"SELECT user_id, user_name, nick_name, phone, email, user_uuid, del_flag, status "
                 f"FROM {admin_user_t} WHERE user_name = :un"),
            {"un": ADMIN_USER_NAME},
        ).first()
        if row is None:
            print(f"[ERROR] admin_user.user_name={ADMIN_USER_NAME!r} 不存在")
            return 1

        old = {
            "phonenumber": row.phone if hasattr(row, "phone") else row[3],
            "email": row.email if hasattr(row, "email") else row[4],
            "nick_name": row.nick_name if hasattr(row, "nick_name") else row[2],
            "user_uuid": row.user_uuid if hasattr(row, "user_uuid") else row[5],
        }

        # 2. update admin_user
        conn.execute(
            text(f"""
                UPDATE {admin_user_t}
                SET phone = :phone,
                    email = :email,
                    nick_name = :nick,
                    user_uuid = COALESCE(NULLIF(user_uuid, ''), :uuid)
                WHERE user_name = :un
            """),
            {
                "phone": ADMIN_PHONE,
                "email": ADMIN_EMAIL,
                "nick": ADMIN_NICK_NAME,
                "uuid": ADMIN_USER_UUID,
                "un": ADMIN_USER_NAME,
            },
        )

        # 3. ensure admin_role 存在
        role_row = conn.execute(
            text(f"SELECT role_id FROM {admin_role_t} WHERE role_key = :rk"),
            {"rk": ADMIN_ROLE_KEY},
        ).first()
        if role_row is None:
            # 不同的 admin_role schema 在不同 DB 上有细微差异, 只 insert role_key/role_name/role_sort
            insert_cols_sql = ""
            insert_vals_sql = ""
            insert_params: dict = {"rn": ADMIN_ROLE_NAME, "rk": ADMIN_ROLE_KEY, "rs": ADMIN_ROLE_SORT}
            # 看 role 表有哪几列
            if dialect == "postgresql":
                role_cols = {row[0] for row in conn.execute(text("""
                    SELECT column_name FROM information_schema.columns
                    WHERE table_name = 'admin_role' AND table_schema = 'public'
                """)).fetchall()}
            else:
                role_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(admin_role)")).fetchall()}

            insert_map = {
                "role_name": ":rn",
                "role_key": ":rk",
                "role_sort": ":rs",
                "data_scope": "'1'",
                "status": "'0'",
                "del_flag": "'0'",
                "remark": "':rmk'",
            }
            insert_params["rmk"] = "内置超管角色 (update_admin_account.py 2026-07-05 创建)"
            cols = []
            vals = []
            for c, v in insert_map.items():
                if c in role_cols:
                    cols.append(c)
                    if v.startswith(":"):
                        vals.append(v)
                    else:
                        vals.append(v.strip("'"))
            conn.execute(
                text(f"INSERT INTO {admin_role_t} ({', '.join(cols)}) VALUES ({', '.join(vals)})"),
                insert_params,
            )
            role_row = conn.execute(
                text(f"SELECT role_id FROM {admin_role_t} WHERE role_key = :rk"),
                {"rk": ADMIN_ROLE_KEY},
            ).first()
            print(f"  + admin_role created")
        role_id = role_row[0]
        print(f"  role_id: {role_id}")

        # 4. ensure admin_user_role 关联
        link = conn.execute(
            text(f"SELECT user_id FROM {admin_user_role_t} WHERE user_id = :uid AND role_id = :rid"),
            {"uid": row.user_id if hasattr(row, "user_id") else row[0], "rid": role_id},
        ).first()
        if link is None:
            cols_part = "user_id, role_id"
            vals_part = ":uid, :rid"
            params = {"uid": row.user_id if hasattr(row, "user_id") else row[0], "rid": role_id}
            if has_ur_created:
                cols_part += ", created_at, updated_at"
                vals_part += ", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP"
            conn.execute(
                text(f"INSERT INTO {admin_user_role_t} ({cols_part}) VALUES ({vals_part})"),
                params,
            )
            print(f"  + admin_user_role link created: user_id={row.user_id if hasattr(row, 'user_id') else row[0]} -> role_id={role_id}")

        # 5. 校验
        new = conn.execute(
            text(f"SELECT user_id, user_name, nick_name, phone, email, user_uuid, del_flag, status "
                 f"FROM {admin_user_t} WHERE user_name = :un"),
            {"un": ADMIN_USER_NAME},
        ).first()
        link2 = conn.execute(
            text(f"SELECT user_id, role_id FROM {admin_user_role_t} WHERE user_id = :uid AND role_id = :rid"),
            {"uid": new.user_id if hasattr(new, "user_id") else new[0], "rid": role_id},
        ).first()

        def _v(r, idx, name):
            return getattr(r, name) if hasattr(r, name) else r[idx]

        ok = (
            _v(new, 3, "phone") == ADMIN_PHONE
            and _v(new, 4, "email") == ADMIN_EMAIL
            and _v(new, 2, "nick_name") == ADMIN_NICK_NAME
            and bool(_v(new, 5, "user_uuid"))
            and link2 is not None
        )

        print(f"  before: {old}")
        print(f"  after:  phone={_v(new,3,'phone')!r} email={_v(new,4,'email')!r} nick={_v(new,2,'nick_name')!r} uuid={_v(new,5,'user_uuid')!r}")
        print(f"  link:   user_id={_v(new,0,'user_id')} -> role_id={role_id} = {'OK' if link2 else 'MISSING'}")
        print(f"  status: {'OK' if ok else 'FAIL'}")

        if ok:
            print(f"\n[update_admin_account] 最高管理员账号绑定完成, 三种登录方式:")
            print(f"  - user_name: admin (密码 admin123)")
            print(f"  - phone:     {ADMIN_PHONE} (密码 admin123)")
            print(f"  - email:     {ADMIN_EMAIL} (密码 admin123)")
            return 0
        print(f"\n[update_admin_account] 校验失败, 请查看上方数据")
        return 1


if __name__ == "__main__":
    try:
        rc = main()
    except Exception:
        logger.exception("update_admin_account crashed")
        rc = 2
    sys.exit(rc)
