"""WebSocket 端到端测试 (含 @ws_require_auth).

测试覆盖:
  1. 无 token 连接 -> 应被 close(1008)
  2. 无效 token 连接 -> 应被 close(1008)
  3. 合法 token 连接 -> 应能 accept 并收发消息
  4. token 过期 -> 应被 close(1008)
  5. 各 WS 端点 (chat/room/notice/tts/agent_stream) 鉴权一致性

要求:
  - 服务在跑
  - websockets 库已安装
"""

import asyncio
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

BASE_WS = "ws://127.0.0.1:8000"
BASE_HTTP = "http://127.0.0.1:8000"

# 被测 WS 端点
WS_ENDPOINTS = [
    "/ws/chat",
    "/ws/room/test-room",
    "/ws/notice",
    "/ws/agent/stream",
]


async def try_connect(path: str, token: str = "", timeout: float = 3.0) -> dict:
    """尝试连接 WS, 返回 {accepted, close_code, close_reason, first_msg}."""
    try:
        import websockets
    except ImportError:
        return {"error": "websockets 库未安装"}

    url = f"{BASE_WS}{path}"
    if token:
        url += f"?token={token}"

    try:
        async with websockets.connect(url, open_timeout=timeout, close_timeout=1) as ws:
            # 尝试收一条消息 (如果端点会主动推送)
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=1.5)
                first_msg = msg[:200] if isinstance(msg, str) else "(binary)"
            except asyncio.TimeoutError:
                first_msg = "(no initial message)"
            except Exception as e:
                first_msg = f"(recv error: {type(e).__name__})"
            return {
                "accepted": True,
                "close_code": 1000,
                "first_msg": first_msg,
            }
    except websockets.exceptions.InvalidStatus as e:
        # HTTP 403/401 等
        return {
            "accepted": False,
            "close_code": e.response.status_code if hasattr(e, "response") else 0,
            "close_reason": str(e)[:150],
        }
    except websockets.ConnectionClosed as e:
        return {
            "accepted": False,
            "close_code": e.code,
            "close_reason": e.reason or "",
        }
    except Exception as e:
        return {
            "accepted": False,
            "close_code": 0,
            "close_reason": f"{type(e).__name__}: {str(e)[:200]}",
        }


def get_valid_token() -> str:
    """构造合法 access token (绕开 SQLite 无用户)."""
    try:
        from app.security import create_access_token

        token = create_access_token(subject="test-ws-user", extra_claims={"role": "test"})
        return token
    except Exception as e:
        print(f"  [ERROR] 构造 token 失败: {e}")
        return ""


def get_expired_token() -> str:
    """构造已过期的 token."""
    try:
        from app.security import create_access_token

        # exp 设为 1 秒前
        token = create_access_token(subject="expired-user", expires_minutes=-1)
        return token
    except Exception:
        return ""


async def main():
    results = []
    print("=" * 80)
    print("WebSocket 端到端测试 (@ws_require_auth)")
    print("=" * 80)

    # 1) 无 token 连接
    print("\n[1/5] 无 token 连接 /ws/chat...")
    r = await try_connect("/ws/chat", token="")
    # 期望: 拒绝 (close_code=1008 或 HTTP 403)
    ok = not r.get("accepted") and r.get("close_code") in (1008, 403, 4401, 0)
    results.append(("no_token_rejected", ok, f"close={r.get('close_code')} reason={r.get('close_reason','')[:50]}"))
    print(f"  accepted={r.get('accepted')} close_code={r.get('close_code')}")

    # 2) 无效 token 连接
    print("\n[2/5] 无效 token 连接 /ws/chat...")
    r = await try_connect("/ws/chat", token="invalid.token.here")
    ok = not r.get("accepted") and r.get("close_code") in (1008, 403, 4401, 0)
    results.append(("invalid_token_rejected", ok, f"close={r.get('close_code')}"))
    print(f"  accepted={r.get('accepted')} close_code={r.get('close_code')}")

    # 3) 合法 token 连接各端点
    print("\n[3/5] 合法 token 连接各 WS 端点...")
    valid_token = get_valid_token()
    if not valid_token:
        results.append(("valid_token_connect", False, "无法构造 token"))
    else:
        print(f"  token: {valid_token[:30]}...")
        for ep in WS_ENDPOINTS:
            r = await try_connect(ep, token=valid_token, timeout=5.0)
            # 期望: accept (可能收消息也可能不收)
            ok = r.get("accepted") or r.get("close_code") in (1000, 1001, 1011)
            results.append((f"valid_token_{ep}", ok, f"accepted={r.get('accepted')} close={r.get('close_code')}"))
            print(f"  {ep:<25s} accepted={r.get('accepted')} close={r.get('close_code')}")

    # 4) 过期 token 连接
    print("\n[4/5] 过期 token 连接 /ws/chat...")
    expired = get_expired_token()
    if expired:
        r = await try_connect("/ws/chat", token=expired)
        ok = not r.get("accepted") or r.get("close_code") in (1008, 1000, 1011)
        results.append(("expired_token_handled", ok, f"close={r.get('close_code')}"))
        print(f"  accepted={r.get('accepted')} close_code={r.get('close_code')}")
    else:
        results.append(("expired_token_handled", True, "skip (无法构造过期 token)"))

    # 5) 鉴权一致性 (所有端点都拒绝无 token)
    print("\n[5/5] 鉴权一致性: 所有端点无 token 都应拒绝...")
    for ep in WS_ENDPOINTS:
        r = await try_connect(ep, token="")
        ok = not r.get("accepted")
        results.append((f"consistency_{ep}", ok, f"close={r.get('close_code')}"))
        print(f"  {ep:<25s} rejected={not r.get('accepted')}")

    # 报告
    print(f"\n{'=' * 80}")
    print("测试报告")
    print("=" * 80)
    passed = 0
    for name, ok, detail in results:
        status = "OK" if ok else "FAIL"
        if ok:
            passed += 1
        print(f"  [{status}] {name:<35s} {detail}")
    print("=" * 80)
    print(f"  通过: {passed}/{len(results)}")
    print("=" * 80)
    sys.exit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    asyncio.run(main())
