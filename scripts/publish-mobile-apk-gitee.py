#!/usr/bin/env python3
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""
把**官网签名** APK 同步到 Gitee 国内腿(固定 tag ⇒ 对外 URL 恒定)。

为什么必须独立一支脚本(2026-11-04 现网取证后的补腿):
- 站点腿 `www.aizhs.top/remote-images/download/ihui-ai-latest.apk` 的 302 实际落在
  Cloudflare 洛杉矶(`Server: cloudflare` / `CF-RAY …-LAX` / `cf-cache-status: EXPIRED`),
  跟随重定向取 512KB 25s 只到 262144B;手机侧 30s 0 字节超时。同机 Gitee 是
  `200 / ttfb 0.32s / 180.76.199.13`。
- `.github/scripts/sync-gitee.py` 同步的是 GitHub Release 的 CI dev 包 —— 它没有官网
  keystore,签名身份不是 `62:B0:FF:0E…`,**不能**当 APK 对外腿(装不上/覆盖升级失败)。
- `scripts/publish-mobile-apk.mjs` 已负责站点腿落盘 + 登记 app_versions。本脚本只补国内腿,
  必须与它**同一枚 APK**调用:两条腿不是同一份字节时,客户端的体积对账会拒绝国内腿。

Gitee 同名附件实证(2026-09-24 / 2026-10-17,见 sync-gitee.py):
  GET /releases/{id}/attach_files 返回 `name` / `id` / `size`;
  DELETE /releases/{id}/attach_files/{id} 返回 204 即真删;
  「同名直链永取第一个附件」⇒ 必须**先 POST 新附件、再删旧的同名**,
  否则用户拿到的还是旧包(与 desktop-feed-live.ts 的冒名旧包教训同源)。

用法:
  python scripts/publish-mobile-apk-gitee.py --self-test
  python scripts/publish-mobile-apk-gitee.py --apk <path> --dry-run
  python scripts/publish-mobile-apk-gitee.py --apk <path> [--tag mobile-apk-latest]

凭据:GITEE_TOKEN。缺凭据一律 exit 2 并打印唯一整改命令,**绝不静默跳过**(§0.10)。
退出码:0 成功 / 1 硬失败 / 2 未判定或缺凭据。
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

CONFIG_PATH = Path(__file__).resolve().parent / "data" / "mobile-download-leg.json"
EXIT_OK, EXIT_FAIL, EXIT_UNDETERMINED = 0, 1, 2


def load_config(path=CONFIG_PATH):
    cfg = json.loads(Path(path).read_text(encoding="utf-8"))
    needed = ("cnLegTag", "cnLegOwner", "cnLegRepo", "cnLegUrl", "latestKey", "minApkBytes")
    missing = [k for k in needed if not cfg.get(k)]
    if missing:
        raise ValueError(f"下载腿单源缺国内腿字段: {', '.join(missing)}")
    return cfg


def cn_leg_url(cfg):
    """由坐标构造直链(纯函数,self-test 钉它与单源里的 cnLegUrl 逐字相等)。"""
    return (
        f"https://gitee.com/{cfg['cnLegOwner']}/{cfg['cnLegRepo']}"
        f"/releases/download/{cfg['cnLegTag']}/{cfg['latestKey']}"
    )


def validate_local_apk(path, min_bytes):
    """本地三查:存在 / 体积达标 / ZIP 魔数。返回 (ok, reason, size)。"""
    p = Path(path)
    if not p.is_file():
        return False, f"APK 不存在: {p}", 0
    size = p.stat().st_size
    if size < min_bytes:
        return False, f"APK 体积 {size}B < 下限 {min_bytes}B", size
    with p.open("rb") as f:
        if f.read(4) != b"PK\x03\x04":
            return False, "APK 不是 ZIP/APK 形态(缺 PK\\x03\\x04 魔数)", size
    return True, f"{size}B", size


def judge_upload_verification(remote_len, local_size):
    """写后自证:量不到 ⇒ 未判定,不许折算成绿。"""
    if remote_len is None:
        return "undetermined", "HEAD 量不到 Content-Length"
    if remote_len != local_size:
        return "fail", f"Gitee {remote_len}B ≠ 本地 {local_size}B(可能拿到了旧同名附件)"
    return "ok", f"Gitee {remote_len}B == 本地 {local_size}B"


def self_test():
    cfg = {
        "cnLegTag": "mobile-apk-latest",
        "cnLegOwner": "JLSLSSZWHYXGS_0",
        "cnLegRepo": "IHUI-AI",
        "latestKey": "ihui-ai-latest.apk",
        "minApkBytes": 52428800,
    }
    expected = (
        "https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI/releases/download/"
        "mobile-apk-latest/ihui-ai-latest.apk"
    )
    assert cn_leg_url(cfg) == expected, "直链构造与固定 URL 不等"
    assert judge_upload_verification(None, 100)[0] == "undetermined", "量不到必须未判定"
    assert judge_upload_verification(99, 100)[0] == "fail", "字节不等必须硬失败"
    assert judge_upload_verification(100, 100)[0] == "ok", "字节相等才绿"
    assert validate_local_apk("/definitely/not/here.apk", 1)[0] is False
    import tempfile

    with tempfile.NamedTemporaryFile(suffix=".apk", delete=False) as tmp:
        tmp.write(b"PK\x03\x04" + b"0" * 64)
        name = tmp.name
    try:
        assert validate_local_apk(name, 1)[0] is True, "合法 ZIP 头应放行"
        assert validate_local_apk(name, 10**9)[0] is False, "低于下限应拒绝"
    finally:
        os.unlink(name)
    print("[self-test] 直链构造 / 体积下限 / ZIP 魔数 / 写后自证三态 —— 全过")
    return EXIT_OK


class Gitee:
    def __init__(self, token, owner, repo):
        self.token, self.owner, self.repo = token, owner, repo

    def api(self, path, method="GET", data=None, timeout=120):
        url = f"https://gitee.com/api/v5{path}"
        if self.token:
            url += ("&" if "?" in url else "?") + f"access_token={self.token}"
        body = json.dumps(data).encode() if data is not None else None
        req = urllib.request.Request(url, data=body, method=method)
        if body is not None:
            req.add_header("Content-Type", "application/json")
        try:
            resp = urllib.request.urlopen(req, timeout=timeout)
            raw = resp.read()
            if resp.status in (204, 205) or not raw.strip():
                return {}
            return json.loads(raw)
        except urllib.error.HTTPError as e:
            print(f"[gitee] {method} {path} -> {e.code}: {e.read()[:200]}")
            return None
        except Exception as e:  # 网络层一律如实报,不静默
            print(f"[gitee] {method} {path} -> 网络异常: {e}")
            return None

    def upload(self, release_id, filepath, filename):
        # Node fetch(undici) 对 Gitee multipart 报 401 ⇒ 沿用 python urllib 的实证姿势。
        url = (
            f"https://gitee.com/api/v5/repos/{self.owner}/{self.repo}"
            f"/releases/{release_id}/attach_files?access_token={self.token}"
        )
        boundary = "ihui" + str(int(time.time() * 1000))
        with open(filepath, "rb") as f:
            payload = f.read()
        body = (
            (
                f'--{boundary}\r\nContent-Disposition: form-data; name="file"; '
                f'filename="{filename}"\r\nContent-Type: application/octet-stream\r\n\r\n'
            ).encode()
            + payload
            + f"\r\n--{boundary}--\r\n".encode()
        )
        req = urllib.request.Request(url, data=body, method="POST")
        req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
        try:
            resp = urllib.request.urlopen(req, timeout=1800)
            print(f"[gitee] 上传 {filename}: HTTP {resp.status}")
            return resp.status in (200, 201)
        except Exception as e:
            print(f"[gitee] 上传失败: {e}")
            return False


def head_content_length(url):
    req = urllib.request.Request(url, method="HEAD")
    try:
        resp = urllib.request.urlopen(req, timeout=60)
        n = resp.headers.get("Content-Length")
        return int(n) if n and n.isdigit() else None
    except Exception as e:
        print(f"[verify] HEAD 失败: {e}")
        return None


def main(argv=None):
    ap = argparse.ArgumentParser(description="把官网签名 APK 同步到 Gitee 国内腿")
    ap.add_argument("--apk", help="官网签名 APK 本地路径(须与 publish-mobile-apk.mjs 同一枚)")
    ap.add_argument("--tag", help="覆盖单源里的 cnLegTag")
    ap.add_argument("--dry-run", action="store_true", help="只校验与打印计划,不联网")
    ap.add_argument("--self-test", action="store_true", help="纯函数夹具,不联网")
    args = ap.parse_args(argv)

    if args.self_test:
        return self_test()
    if not args.apk:
        print("缺 --apk;只自检请加 --self-test")
        return EXIT_UNDETERMINED

    try:
        cfg = load_config()
    except Exception as e:
        print(f"单源读取失败: {e}")
        return EXIT_UNDETERMINED
    if args.tag:
        cfg["cnLegTag"] = args.tag
    url = cn_leg_url(cfg)
    if cfg.get("cnLegUrl") and not args.tag and url != cfg["cnLegUrl"]:
        print(f"单源自相矛盾: cnLegUrl={cfg['cnLegUrl']} 但坐标推出 {url}")
        return EXIT_FAIL

    ok, reason, size = validate_local_apk(args.apk, int(cfg["minApkBytes"]))
    if not ok:
        print(f"本地 APK 校验不过: {reason}")
        return EXIT_FAIL
    print(f"[local] {reason},目标直链 {url}")

    if args.dry_run:
        print("[dry-run] 不联网。真实运行需要 GITEE_TOKEN,动作 = 找/建 release → 传新附件 → 删旧同名 → HEAD 自证")
        return EXIT_OK

    token = os.environ.get("GITEE_TOKEN", "").strip()
    if not token:
        print("❌ 缺 GITEE_TOKEN ⇒ 国内腿未判定(不记绿、不静默跳过)")
        print("   唯一整改:在发布机设环境变量(或 CI Secrets 的 GITEE_TOKEN)后重跑:")
        print(f'   setx GITEE_TOKEN "<Gitee 私人令牌>"  ;  python scripts/publish-mobile-apk-gitee.py --apk "{args.apk}"')
        return EXIT_UNDETERMINED

    g = Gitee(token, cfg["cnLegOwner"], cfg["cnLegRepo"])
    base = f"/repos/{cfg['cnLegOwner']}/{cfg['cnLegRepo']}"
    rel = g.api(f"{base}/releases/tags/{cfg['cnLegTag']}")
    if not rel:
        # 实证:新建 tag 的 release 必须带 target_commitish,否则 Gitee 返回 400
        # `{"messages":["target_commitish is missing"]}`(2026-11-04 首次上传踩到)。
        repo_info = g.api(base) or {}
        target = repo_info.get("default_branch") or "main"
        rel = g.api(
            f"{base}/releases",
            "POST",
            {
                "tag_name": cfg["cnLegTag"],
                "target_commitish": target,
                "name": "Android APK 国内分发腿",
                "body": "官网签名 APK 的固定国内直链;每次发版替换同名附件。",
                "prerelease": False,
            },
        )
    if not rel or not rel.get("id"):
        print("❌ 找/建 Gitee release 失败")
        return EXIT_FAIL
    rid = rel["id"]

    attachments = g.api(f"{base}/releases/{rid}/attach_files") or []
    old_ids = [a["id"] for a in attachments if a.get("name") == cfg["latestKey"] and a.get("id")]
    if not g.upload(rid, args.apk, cfg["latestKey"]):
        return EXIT_FAIL
    # 先传新、再删旧:同名直链永取第一个附件,顺序反了用户会拿到旧包。
    for old_id in old_ids:
        g.api(f"{base}/releases/{rid}/attach_files/{old_id}", "DELETE")

    state, reason = judge_upload_verification(head_content_length(url), size)
    print(f"[verify] {state}: {reason}")
    if state == "fail":
        return EXIT_FAIL
    if state != "ok":
        return EXIT_UNDETERMINED
    print(f"✅ 国内腿已就绪: {url}")
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
