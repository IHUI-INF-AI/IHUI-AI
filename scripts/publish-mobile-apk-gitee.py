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

多分片(2026-11-05 起本脚本一并发布):
  同一枚 APK 再切 16 份独立附件 + 一份 `ihui-ai-parts.json` 清单,目录都在同一个固定 tag 下。
  客户端(0.0.12+)先读清单、8 路并发各拉一份、按偏移定位写拼回整包 —— 绕开"Gitee 单文件不认
  Range"与"站点腿套餐吞吐硬顶"这两条死路。清单永远最后传、旧分片最后删。

用法:
  python scripts/publish-mobile-apk-gitee.py --self-test
  python scripts/publish-mobile-apk-gitee.py --apk <path> --dry-run
  python scripts/publish-mobile-apk-gitee.py --apk <path> --version 0.0.12 [--parts 16]
  python scripts/publish-mobile-apk-gitee.py --apk <path> [--tag mobile-apk-latest]

凭据:GITEE_TOKEN。缺凭据一律 exit 2 并打印唯一整改命令,**绝不静默跳过**(§0.10)。
退出码:0 成功 / 1 硬失败 / 2 未判定或缺凭据。
"""

import argparse
import json
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

CONFIG_PATH = Path(__file__).resolve().parent / "data" / "mobile-download-leg.json"
EXIT_OK, EXIT_FAIL, EXIT_UNDETERMINED = 0, 1, 2

# ── HTTP 出口(2026-11-05 现网教训)─────────────────────────────────────────
# Windows 上 `urllib.request.getproxies()` 会**读注册表里的系统代理**(本机
# `HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings` 指向 127.0.0.1:7897),
# 而 curl/node/git 只看环境变量。那个系统代理今天已失效:urllib 每条 https 都在握手阶段被回
# EOF(实测 6/6 `SSL: UNEXPECTED_EOF_WHILE_READING`,每次卡满 5s),而 curl 同 URL 200/0.2s。
# 发布链路不许继承这种"只在 Python 里成立"的失败,所以这里显式只认环境变量:给了
# HTTPS_PROXY 才走代理,否则直连 —— 与 curl/node 的口径一致。
def build_opener():
    proxy = os.environ.get("https_proxy") or os.environ.get("HTTPS_PROXY") or ""
    if proxy:
        return urllib.request.build_opener(
            urllib.request.ProxyHandler({"http": proxy, "https": proxy})
        )
    return urllib.request.build_opener(urllib.request.ProxyHandler({}))


OPENER = build_opener()
NET_ATTEMPTS = 3


def open_url(req, timeout=120, attempts=NET_ATTEMPTS):
    """带退避的请求:网络层异常(SSL EOF/超时/连接重置)重试,HTTP 4xx 原样抛出。

    为什么必须有这一层:16 份分片 + 整包 + 清单是十几次独立请求,任何一次赶上连接被
    中途切断,整条发布就判失败(而这一轮已经花了 20 多分钟构建)。HTTP 4xx 是"请求本身
    不对"(令牌/参数),重试没有意义,立刻抛给调用方如实打印。
    """
    last = None
    for attempt in range(attempts):
        try:
            return OPENER.open(req, timeout=timeout)
        except urllib.error.HTTPError as e:
            if e.code < 500 and e.code != 429:
                raise
            last = e
        except Exception as e:  # 网络层:一律按可重试处理,最后一次仍失败由调用方报错
            last = e
        if attempt + 1 < attempts:
            wait = 2 * (attempt + 1)
            print(f"[net] 第 {attempt + 1}/{attempts} 次失败({last});{wait}s 后重试")
            time.sleep(wait)
    raise last


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


# ── 多分片(2026-11-05 立)──────────────────────────────────────────────────
# 为什么切成多份独立附件:站点腿(EdgeOne 免费版)有套餐吞吐硬顶,4→24 连接都停在
# 4.5–6.4 MB/s;Gitee 单文件又**不认 Range**(探针回 200 整包)。但 Gitee 多连接线性叠加
# (1/4/8 连接 = 1.92/7.23/15.36 MB/s)⇒ 想再快只能把"一条连接"换成"N 条独立连接"。
# 所以发布侧把同一枚 APK 切成 N 份**独立附件**,每份一条自己的直链;客户端 8 路并发各拉一份、
# 按偏移定位写拼回整包。分片名带版本号 ⇒ 重发同版本/换切法都不会撞历史同名附件。
PARTS_MANIFEST_SCHEMA = "ihui-apk-parts/v1"
# ⚠️ 与 apps/mobile-rn/src/lib/apk-download-legs.ts 的 APK_PARTS_MANIFEST_ASSET 逐字一致。
PARTS_MANIFEST_ASSET = "ihui-ai-parts.json"
PART_NAME_RE = re.compile(r"^ihui-ai-[0-9A-Za-z._+-]+-part-\d{2,3}\.bin$")
MAX_PARTS = 64


def part_filename(version, index):
    return f"ihui-ai-{version}-part-{index:02d}.bin"


def split_apk(apk_path, count, out_dir, version):
    """按份数顺序切包:前 n-1 份等长,末份吃余数。**不改字节、不补齐、不重排。**
    返回 [{'name','size','path'}],调用方用 size 之和与整包对账(写后自证的第一环)。
    """
    if not 1 <= count <= MAX_PARTS:
        raise ValueError(f"分片份数 {count} 越界(1–{MAX_PARTS})")
    if not re.fullmatch(r"[0-9][0-9A-Za-z._+-]{0,62}", version or ""):
        raise ValueError(f"版本号不能用作文件名: {version!r}")
    src_path = Path(apk_path)
    total = src_path.stat().st_size
    chunk = -(-total // count)  # ceil,保证末份 > 0 且总份数不缩水
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    parts = []
    with src_path.open("rb") as src:
        for i in range(count):
            start = i * chunk
            want = min(chunk, total - start)
            if want <= 0:
                break
            dest = out / part_filename(version, i)
            with dest.open("wb") as dst:
                remaining = want
                while remaining > 0:
                    buf = src.read(min(8 * 1024 * 1024, remaining))
                    if not buf:
                        raise IOError(f"读 APK 提前结束: {dest.name} 还差 {remaining}B")
                    dst.write(buf)
                    remaining -= len(buf)
            parts.append({"name": dest.name, "size": dest.stat().st_size, "path": str(dest)})
    if sum(p["size"] for p in parts) != total:
        raise ValueError(f"切包字节对不上: 分片合计 {sum(p['size'] for p in parts)} ≠ {total}")
    return parts


def build_parts_manifest(version, total_bytes, parts, version_code=None):
    """清单只描述"这一版切成了哪几份";客户端按它拼,不构造名字 ⇒ 换切法无需改客户端。"""
    return {
        "schema": PARTS_MANIFEST_SCHEMA,
        "version": version,
        "versionCode": version_code,
        "totalBytes": total_bytes,
        "parts": [{"name": p["name"], "size": p["size"]} for p in parts],
    }


def judge_parts_verification(lengths, expected):
    """逐份写后自证:N 份里只要有一份量不到 ⇒ 未判定;有一份不等 ⇒ 硬失败。"""
    for (name, want), size in zip(expected, lengths):
        if size is None:
            return "undetermined", f"分片 {name} HEAD 量不到 Content-Length"
        if size != want:
            return "fail", f"分片 {name} Gitee {size}B ≠ 本地 {want}B"
    return "ok", f"{len(expected)} 份分片长度全部一致"


def fetch_text(url):
    req = urllib.request.Request(url, headers={"Cache-Control": "no-cache", "Pragma": "no-cache"})
    try:
        with open_url(req, timeout=60) as resp:
            return resp.read().decode("utf-8", "replace")
    except Exception as e:
        print(f"[verify] 清单读取失败: {e}")
        return None


def verify_manifest(url, expected):
    """读取并逐字段对账。Gitee 直链有 CDN,最多重试 3 次,仍不一致按失败报,不折算成绿。"""
    want = {
        "schema": expected["schema"],
        "version": expected["version"],
        "versionCode": expected["versionCode"],
        "totalBytes": expected["totalBytes"],
        "parts": expected["parts"],
    }
    for attempt in range(3):
        raw = fetch_text(url)
        if raw is None:
            time.sleep(1 + attempt)
            continue
        try:
            got = json.loads(raw)
        except json.JSONDecodeError:
            time.sleep(1 + attempt)
            continue
        if got == want:
            return "ok", f"{len(want['parts'])} 份 / {want['totalBytes']}B"
        if attempt == 2:
            return "fail", f"清单内容不符(可能仍是旧清单): {raw[:200]}"
        time.sleep(1 + attempt)
    return "undetermined", "清单连续 3 次读不到"


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

    # 多分片:切包字节守恒 / 末份吃余数 / 命名形态 / 清单与分片逐项相等
    with tempfile.TemporaryDirectory() as td:
        src = Path(td) / "tiny.apk"
        payload = b"PK\x03\x04" + bytes(range(256)) * 3
        src.write_bytes(payload)
        parts = split_apk(src, 3, Path(td) / "parts", "9.9.9")
        assert [p["size"] for p in parts] == [258, 258, 256], "切包份长不是预期(末份必须吃余数)"
        assert sum(p["size"] for p in parts) == len(payload), "切包字节总和 ≠ 整包"
        assert all(PART_NAME_RE.fullmatch(p["name"]) for p in parts), "分片名不合协议"
        manifest = build_parts_manifest("9.9.9", len(payload), parts, 26110506)
        assert manifest["schema"] == PARTS_MANIFEST_SCHEMA
        assert manifest["totalBytes"] == len(payload), "清单总量 ≠ 整包"
        assert manifest["parts"] == [{"name": p["name"], "size": p["size"]} for p in parts]
        # 重切不同份数也必须守恒(发布侧改切法不许改客户端)
        parts5 = split_apk(src, 5, Path(td) / "parts5", "9.9.9")
        assert len(parts5) == 5 and sum(p["size"] for p in parts5) == len(payload)
    expected_parts = [("a", 10), ("b", 20)]
    assert judge_parts_verification([10, 20], expected_parts)[0] == "ok"
    assert judge_parts_verification([10, None], expected_parts)[0] == "undetermined"
    assert judge_parts_verification([10, 19], expected_parts)[0] == "fail"

    print("[self-test] 直链构造 / 体积下限 / ZIP 魔数 / 写后自证三态 / 多分片切包与清单 —— 全过")
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
            resp = open_url(req, timeout=timeout)
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
            # 上传重试 2 次而不是 3 次:每份 5MB 级、超时 1800s,多轮重试会把一轮发版拖过
            # 计划任务的下一个触发点。重试不会投毒:同名直链取第一个附件,而"已收全"的附件
            # 才是 Gitee 登记的那一枚(半截传输根本不会出现在附件列表里)。
            resp = open_url(req, timeout=1800, attempts=2)
            print(f"[gitee] 上传 {filename}: HTTP {resp.status}")
            return resp.status in (200, 201)
        except Exception as e:
            print(f"[gitee] 上传失败: {e}")
            return False


def head_content_length(url):
    req = urllib.request.Request(url, method="HEAD")
    try:
        resp = open_url(req, timeout=60)
        n = resp.headers.get("Content-Length")
        return int(n) if n and n.isdigit() else None
    except Exception as e:
        print(f"[verify] HEAD 失败: {e}")
        return None


def main(argv=None):
    ap = argparse.ArgumentParser(description="把官网签名 APK 同步到 Gitee 国内腿")
    ap.add_argument("--apk", help="官网签名 APK 本地路径(须与 publish-mobile-apk.mjs 同一枚)")
    ap.add_argument("--tag", help="覆盖单源里的 cnLegTag")
    ap.add_argument("--version", help="目标版本号(如 0.0.12);给了它才发布多分片")
    ap.add_argument(
        "--parts",
        type=int,
        default=None,
        help="分片份数;--version 在场时默认 16,显式 0 表示只发单文件腿",
    )
    ap.add_argument("--version-code", type=int, default=None, help="写进清单的 versionCode(可选)")
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

    parts_count = args.parts if args.parts is not None else (16 if args.version else 0)
    if args.parts is not None and not args.version and args.parts > 0:
        print("给了 --parts 但缺 --version:多分片清单必须带版本号(否则重启后无法对账)")
        return EXIT_UNDETERMINED
    if parts_count < 0 or parts_count > MAX_PARTS:
        print(f"--parts {parts_count} 越界(0–{MAX_PARTS})")
        return EXIT_FAIL
    if parts_count:
        chunk = -(-size // parts_count)
        print(f"[parts] 计划 {parts_count} 份(每份 ≤{chunk}B)+ {PARTS_MANIFEST_ASSET}(version={args.version})")

    if args.dry_run:
        print("[dry-run] 不联网。真实运行需要 GITEE_TOKEN,动作 = 找/建 release → 传整包 → 传分片 → 传清单 → 删旧同名/旧分片 → HEAD+清单自证")
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
        # POST 的响应可能在"服务端已建好"之后断在半路(网络层重试会再 POST 一次,
        # 第二次因 tag 已存在回 400)。这里再读一次标签,避免把"其实建好了"判成失败。
        rel = g.api(f"{base}/releases/tags/{cfg['cnLegTag']}")
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
    print(f"[verify] 单文件腿 {state}: {reason}")

    # ── 多分片腿(0.0.12+ 客户端走这条)────────────────────────────────────
    parts_state, parts_reason = "ok", "未启用"
    if parts_count > 0:
        base_dir = url.rsplit("/", 1)[0]
        manifest_url = f"{base_dir}/{PARTS_MANIFEST_ASSET}"
        with tempfile.TemporaryDirectory() as td:
            try:
                parts = split_apk(args.apk, parts_count, Path(td) / "parts", args.version)
            except (ValueError, IOError) as e:
                print(f"切包失败: {e}")
                return EXIT_FAIL
            total = sum(p["size"] for p in parts)
            manifest = build_parts_manifest(args.version, total, parts, args.version_code)
            manifest_path = Path(td) / PARTS_MANIFEST_ASSET
            manifest_path.write_text(
                json.dumps(manifest, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )
            names = {p["name"] for p in parts}
            print(f"[parts] {len(parts)} 份,合计 {total}B;清单 {manifest_url}")

            # 1) 先把每一份传上去(名字带版本号,不与上一版撞名)
            for part in parts:
                if not g.upload(rid, part["path"], part["name"]):
                    return EXIT_FAIL
            # 2) 重发同版本时删掉同名旧份 —— 直链永取第一个附件,清单生效前必须只剩新字节
            for a in attachments:
                if a.get("name") in names and a.get("id"):
                    g.api(f"{base}/releases/{rid}/attach_files/{a['id']}", "DELETE")
            # 3) 清单最后传(先传新、再删旧同名):它一旦被读到,指向的分片必须已经就位
            old_manifest_ids = [
                a["id"]
                for a in attachments
                if a.get("name") == PARTS_MANIFEST_ASSET and a.get("id")
            ]
            if not g.upload(rid, str(manifest_path), PARTS_MANIFEST_ASSET):
                return EXIT_FAIL
            for old_id in old_manifest_ids:
                g.api(f"{base}/releases/{rid}/attach_files/{old_id}", "DELETE")

            # 4) 写后自证:逐份长度对账,再读回清单逐字段对账
            lengths = [head_content_length(f"{base_dir}/{p['name']}") for p in parts]
            parts_state, parts_reason = judge_parts_verification(
                lengths, [(p["name"], p["size"]) for p in parts]
            )
            print(f"[verify] 分片 {parts_state}: {parts_reason}")
            if parts_state != "fail":
                mstate, mreason = verify_manifest(manifest_url, manifest)
                print(f"[verify] 清单 {mstate}: {mreason}")
                if mstate == "fail":
                    parts_state, parts_reason = "fail", mreason
                elif mstate != "ok" and parts_state == "ok":
                    parts_state, parts_reason = "undetermined", mreason

            # 5) 清掉上一版的分片(当前这批一个不动);失败不阻断发布,但要如实打印
            for a in g.api(f"{base}/releases/{rid}/attach_files") or []:
                nm = a.get("name") or ""
                if PART_NAME_RE.fullmatch(nm) and nm not in names and a.get("id"):
                    print(f"[parts] 清理旧分片 {nm}")
                    g.api(f"{base}/releases/{rid}/attach_files/{a['id']}", "DELETE")

    if state == "fail" or parts_state == "fail":
        return EXIT_FAIL
    if state != "ok" or parts_state != "ok":
        print("⚠️ 国内腿未判定(不记绿):单文件腿或分片腿没量到")
        return EXIT_UNDETERMINED
    print(f"✅ 国内腿已就绪: {url}")
    if parts_count > 0:
        print(f"✅ 多分片已就绪: {parts_count} 份 + {url.rsplit('/', 1)[0]}/{PARTS_MANIFEST_ASSET}")
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
