"""直接调用 auth_service.login_by_password 验证三种登录方式 (2026-07-05 立).

不启动 uvicorn/TestClient, 减少启动开销, 直接 import service 函数跑.
注意: 跑前必须先 strip schema (模拟 app.main:create_app 的 single-tenant 行为),
否则 admin_user / users 等表的 __table_args__ schema='public' 会在 SQLite 上
生成 public.xxx 查询而报 "no such table".

执行:
  cd server && py -m scripts.verify_admin_login
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from loguru import logger

# 静音启动期 INFO 日志
logger.remove()
logger.add(sys.stderr, level="WARNING")

# 强制 import 所有 model, 然后 strip schema (与 create_app 一致)
import app.models  # noqa: F401
from app.database import Base

_stripped = 0
for _t in Base.metadata.tables.values():
    if _t.schema:
        _t.schema = None
        _stripped += 1
print(f"[verify_admin_login] stripped schema from {_stripped} tables")

from app.services.auth_service import login_by_password


ADMIN_PWD = "admin123"
EXPECTED_PHONE = "18643389808"
EXPECTED_EMAIL = "502319984@qq.com"
EXPECTED_NICK = "最高管理员"


def _attempt(label: str, account: str, pwd: str, *, expect_ok: bool) -> bool:
    r = login_by_password(account, pwd)
    success = r.get("success")
    data = r.get("data") or {}
    user = data.get("user") or {}
    expected = expect_ok
    ok = (success is True) == expected
    flag = "PASS" if ok else "FAIL"
    nickname = user.get("nickname") or "?"
    is_admin = user.get("is_admin")
    print(
        f"  [{flag}] {label}: success={success} nickname={nickname!r} is_admin={is_admin} "
        f"msg={r.get('msg', '')[:60]!r}"
    )
    if expect_ok and success:
        if nickname != EXPECTED_NICK:
            print(f"        [WARN] expected nickname={EXPECTED_NICK!r}")
            return False
        if not is_admin:
            print(f"        [WARN] expected is_admin=True")
            return False
        if not data.get("accessToken") and not data.get("access_token"):
            print(f"        [WARN] missing access_token in response")
            return False
    return ok


def main() -> int:
    print(f"[verify_admin_login] start")
    failed: list[str] = []
    cases: list[tuple[str, str, str, bool]] = [
        ("user_name=admin", "admin", ADMIN_PWD, True),
        ("phone=18643389808", EXPECTED_PHONE, ADMIN_PWD, True),
        ("email=502319984@qq.com", EXPECTED_EMAIL, ADMIN_PWD, True),
        ("email=502319984@QQ.COM (upper)", "502319984@QQ.COM", ADMIN_PWD, True),
        ("email with whitespace", f"  {EXPECTED_EMAIL}  ", ADMIN_PWD, True),
        ("phone with whitespace", f"  {EXPECTED_PHONE}  ", ADMIN_PWD, True),
        ("wrong password", "admin", "wrong_pwd", False),
        ("non-existent phone", "13900000000", ADMIN_PWD, False),
    ]
    for label, account, pwd, expect_ok in cases:
        if not _attempt(label, account, pwd, expect_ok=expect_ok):
            failed.append(label)

    print()
    if failed:
        print(f"[verify_admin_login] FAIL: {len(failed)} 项")
        for f in failed:
            print(f"  - {f}")
        return 1
    print(f"[verify_admin_login] OK: {len(cases)} 项全通过 (5 正例 + 3 负例)")
    return 0


if __name__ == "__main__":
    try:
        rc = main()
    except Exception:
        import traceback
        traceback.print_exc()
        rc = 2
    sys.exit(rc)
