# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""公众号任务「合法微信绑定」链路脚本(纯接口参数,真人授权收口)。

此脚本只做一件事: 把 WorkBuddy 账号与微信号的**合法 OAuth 绑定**参数化、可复跑。
它不伪造任何判据、不代签、不上报假关注事件; 真人授权那一步必须由账号所有者完成。

链路(来自官方 usercenter-index.js 取证, 2026-11-11 真机验证):
  1) initiate : POST https://api.account.tencent.com/personal_center/v1/credential/wechat/initiate
                 body = {scene:"BIND_WECHAT", action:"bind", callback_uri, extra_param}
                 鉴权 : account.tencent.com 登录态 cookie(浏览器 withCredentials)
                 => 返回 {redirect_url}  (微信 OAuth 授权页)
  2) 真人授权 : 打开 redirect_url, 在微信内确认授权 (手机端 WorkBuddy App 走已装微信,无需扫码;这一步程序不能代做)
  3) callback : POST https://api.account.tencent.com/personal_center/v1/credential/wechat/callback
                 body = {code, state}   (微信回跳带回)
                 => 服务端写入该账号的 wechatOpenId / mpOpenId
  4) 关注满24h: 同一微信号在微信内关注「腾讯 WorkBuddy」官方公众号满 24 小时
                 (官方规则: 同一微信号仅可领取一次; 同手机号/微信/设备/IP 归并同一用户)
  5) 自动领奖 : 服务端翻 completed 后, workbuddy_oa_simulate.py --live 或调度器自动 claim

用法:
  # 起手: 拿到 account.tencent.com 会话 cookie 后, 生成微信授权 URL
  .venv/Scripts/python.exe scripts/workbuddy_oa_bind.py --cookie-file ./my-oneid-cookie.txt --uid 0bc1074d
  # 真人授权后, 用回跳的 code/state 收口绑定
  .venv/Scripts/python.exe scripts/workbuddy_oa_bind.py --cookie-file ./my-oneid-cookie.txt \
      --uid 0bc1074d --code <wx_code> --state <wx_state>

注意: 会话 cookie 必须是**目标账号**在 account.tencent.com 的登录态, 不能用别号/号池 copilot token
      (后者打 initiate 实测 401 G40102 token invalid)。cookie 仅在进程内使用, 默认不落盘、不回显。
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx  # noqa: E402

ONEID_BASE = "https://api.account.tencent.com"
INITIATE_PATH = "/personal_center/v1/credential/wechat/initiate"
CALLBACK_PATH = "/personal_center/v1/credential/wechat/callback"
DEFAULT_CALLBACK_URI = "https://www.workbuddy.cn/account-settings"


def initiate_params(callback_uri: str = DEFAULT_CALLBACK_URI) -> dict:
    """绑定起手请求体(官方字段, 已真机验证)。"""
    return {
        "scene": "BIND_WECHAT",
        "action": "bind",
        "callback_uri": callback_uri,
        "extra_param": "",
    }


def callback_params(code: str, state: str) -> dict:
    """绑定回跳请求体(微信授权后带回的 code/state)。"""
    return {"code": code, "state": state}


def _cookie_header(cookie: str) -> dict:
    return {"Content-Type": "application/json", "Cookie": cookie}


async def initiate_bind(cookie: str, *, callback_uri: str = DEFAULT_CALLBACK_URI) -> dict:
    """起手绑定, 返回服务端响应(含 redirect_url)。"""
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            ONEID_BASE + INITIATE_PATH,
            headers=_cookie_header(cookie),
            json=initiate_params(callback_uri),
        )
        body = r.text
        try:
            body = r.json()
        except ValueError:
            pass
        return {"http": r.status_code, "body": body}


async def callback_bind(cookie: str, code: str, state: str) -> dict:
    """回跳收口绑定, 服务端写入 wechatOpenId。"""
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            ONEID_BASE + CALLBACK_PATH,
            headers=_cookie_header(cookie),
            json=callback_params(code, state),
        )
        body = r.text
        try:
            body = r.json()
        except ValueError:
            pass
        return {"http": r.status_code, "body": body}


async def _run(args: argparse.Namespace) -> int:
    cookie = Path(args.cookie_file).read_text(encoding="utf-8").strip() if args.cookie_file else ""
    if not cookie:
        print("[ERROR] 必须提供 --cookie-file(目标账号在 account.tencent.com 的登录态 cookie)", file=sys.stderr)
        return 2
    if args.code and args.state:
        res = await callback_bind(cookie, args.code, args.state)
        print(f"[{args.uid}] callback http={res['http']}")
        print(f"  body = {res['body']}")
        print("若 http=200 且 body 无错误, 绑定已写入; 去微信关注公众号满 24h 后, 跑 --live 自动领奖。")
        return 0
    res = await initiate_bind(cookie, callback_uri=args.callback_uri)
    print(f"[{args.uid}] initiate http={res['http']}")
    body = res["body"]
    if isinstance(body, dict):
        url = body.get("redirect_url") or body.get("data", {}).get("redirect_url")
        if url:
            print("\n=== 微信授权 URL(请在本机/手机浏览器打开, 用微信号确认授权) ===")
            print(url)
            print("授权后会回跳到 callback_uri 并带 code/state; 复制回来再执行:")
            print(
                f'  .venv/Scripts/python.exe scripts/workbuddy_oa_bind.py --cookie-file {args.cookie_file} '
                f"--uid {args.uid} --code <code> --state <state>"
            )
            return 0
    print(f"  body = {body}")
    print("[WARN] 未解析出 redirect_url; cookie 可能不是目标账号的有效 account.tencent.com 会话。")
    return 1


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="公众号任务合法微信绑定链路(纯接口参数)")
    p.add_argument("--uid", required=True, help="目标 WorkBuddy 账号 uid(前 8 位即可)")
    p.add_argument("--cookie-file", help="目标账号 account.tencent.com 登录态 cookie 文本文件路径")
    p.add_argument("--callback-uri", default=DEFAULT_CALLBACK_URI, help="绑定回跳地址")
    p.add_argument("--code", help="微信授权回跳 code(收口绑定用)")
    p.add_argument("--state", help="微信授权回跳 state(收口绑定用)")
    return asyncio.run(_run(p.parse_args(argv)))


if __name__ == "__main__":
    raise SystemExit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
