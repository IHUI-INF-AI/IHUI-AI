#!/usr/bin/env python3
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Gitee release 资产补齐(本机通道,2026-10-12 立):
CI 的 sync-gitee job 历史上只落地了 Windows 资产(0.1.50 实测 Gitee 仅 exe+sig),
macOS/Linux 安装包与签名包缺失 → 站点快照 resolve-desktop-download.mjs 的 gitee 优先
合并逻辑对这几件拿不到 Gitee 直链,下载页/更新 feed 只能回指 GitHub(国内直连被重置)。
本脚本把 GH release 缺失资产全量补到 Gitee release(幂等,同名跳过),补完后由
resolve-desktop-download.mjs 刷新快照即可让全平台下载走 Gitee。

  用法: python backfill-gitee-assets.py --tag desktop-v0.1.50 [--no-proxy] [--dry-run]
  下载: 默认走 gh-proxy.com 镜像(本机 GitHub release 直连被掐,2026-10-10 实证);
        --no-proxy 直连(海外机/代理正常时)。
  上传: 与 gitee-release-attach.py 同款 python urllib multipart(undici 401 教训同源)。
  临时落盘: .ihui-agent/tmp/backfill-gitee/(禁用 /tmp,Git Bash 下静默失败)。
环境变量: GITEE_TOKEN(必填;GITHUB_TOKEN 可选,仅用于提高 GH API 限流)
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request

TOKEN = os.environ.get("GITEE_TOKEN", "")
GH_TOKEN = os.environ.get("GITHUB_TOKEN", "")
OWNER = os.environ.get("GITEE_OWNER", "JLSLSSZWHYXGS_0")
REPO = os.environ.get("GITEE_REPO", "IHUI-AI")
GH_REPO = os.environ.get("GITHUB_REPOSITORY", "IHUI-INF-AI/IHUI-AI")
PROXY_PREFIX = "https://gh-proxy.com/"
TMP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       "..", "..", ".ihui-agent", "tmp", "backfill-gitee")


def gh_api(path):
    req = urllib.request.Request(f"https://api.github.com{path}")
    if GH_TOKEN:
        req.add_header("Authorization", f"Bearer {GH_TOKEN}")
    req.add_header("Accept", "application/vnd.github+json")
    return json.load(urllib.request.urlopen(req, timeout=60))


def gitee_api(p, method="GET", data=None):
    url = f"https://gitee.com/api/v5{p}"
    if method in ("GET", "POST"):
        url += ("&" if "?" in url else "?") + f"access_token={TOKEN}"
    req = urllib.request.Request(url, method=method)
    if data:
        req.add_header("Content-Type", "application/json")
        req.data = json.dumps(data).encode()
    try:
        r = urllib.request.urlopen(req, timeout=120)
        body = r.read().decode()
        return (json.loads(body) if body.strip() else None)
    except urllib.error.HTTPError as e:
        print(f"[gitee] {method} {p} -> {e.code}: {e.read().decode()[:200]}")
        return None


def gitee_upload(rid, filepath, filename):
    url = (f"https://gitee.com/api/v5/repos/{OWNER}/{REPO}"
           f"/releases/{rid}/attach_files?access_token={TOKEN}")
    boundary = "ihui" + str(int(time.time() * 1000))
    data = open(filepath, "rb").read()
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; "
            f"filename=\"{filename}\"\r\nContent-Type: application/octet-stream\r\n\r\n").encode() \
        + data + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    r = urllib.request.urlopen(req, timeout=1800)
    print(f"[gitee] 上传 {filename}: {r.status}")


def download(url, dest):
    for attempt in range(1, 4):
        try:
            req = urllib.request.Request(url, method="GET")
            r = urllib.request.urlopen(req, timeout=1800)
            tmp = dest + ".part"
            with open(tmp, "wb") as f:
                while True:
                    chunk = r.read(1 << 20)
                    if not chunk:
                        break
                    f.write(chunk)
            os.replace(tmp, dest)
            print(f"[dl] {os.path.basename(dest)}: {os.path.getsize(dest)} 字节")
            return True
        except Exception as e:
            print(f"[dl] {os.path.basename(dest)} 第{attempt}次失败: {e}")
            time.sleep(5)
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tag", required=True)
    ap.add_argument("--no-proxy", action="store_true", help="GitHub 下载不走 gh-proxy 镜像")
    ap.add_argument("--dry-run", action="store_true", help="只打印将补哪些资产,不下载不上传")
    args = ap.parse_args()
    if not TOKEN:
        sys.exit("ERROR: 缺 GITEE_TOKEN 环境变量")

    # 1. GH release 资产清单
    rel = gh_api(f"/repos/{GH_REPO}/releases/tags/{args.tag}")
    gh_assets = {a["name"]: a["browser_download_url"] for a in rel.get("assets", [])}
    print(f"[gh] {args.tag} 资产 {len(gh_assets)} 个")

    # 2. Gitee release(找/建)
    grel = gitee_api(f"/repos/{OWNER}/{REPO}/releases/tags/{args.tag}")
    if not grel or not grel.get("id"):
        if args.dry_run:
            sys.exit(f"[dry-run] Gitee 无 {args.tag} release,将需要创建")
        grel = gitee_api(f"/repos/{OWNER}/{REPO}/releases", "POST", {
            "tag_name": args.tag, "name": f"IHUI AI Desktop {args.tag}",
            "body": rel.get("body") or "Desktop bundles (Tauri 2)",
            "target_commitish": "main", "prerelease": False})
        if not grel or not grel.get("id"):
            sys.exit("Gitee release 创建失败")
    rid = grel["id"]
    have = {a["name"] for a in (grel.get("assets") or [])}
    print(f"[gitee] release id={rid},已有资产 {sorted(have)}")

    # 3. 计算缺失集(源码自动包 zip/tar.gz 不在 GH 资产里,不涉)
    # latest.json 刻意排除:GH 侧版本 url 全指 github.com,补到 Gitee 只会误导
    # (客户端更新端点是 aizhs.top 单端点,仓库快照才是真源,见 release-desktop 注释链)。
    missing = {n: u for n, u in gh_assets.items() if n not in have and n != "latest.json"}
    if not missing:
        print("[done] Gitee 资产已齐,无需补")
        return
    print(f"[plan] 待补 {len(missing)} 个: {sorted(missing)}")
    if args.dry_run:
        return

    # 4. 下载缺失资产(gh-proxy 镜像,断点不续传但整文件 3 次重试)
    os.makedirs(TMP_DIR, exist_ok=True)
    local = {}
    for name, url in sorted(missing.items()):
        dest = os.path.join(TMP_DIR, name)
        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            print(f"[dl] {name}: 沿用本地已有 ({os.path.getsize(dest)} 字节)")
        else:
            dl_url = url if args.no_proxy else PROXY_PREFIX + url
            if not download(dl_url, dest):
                sys.exit(f"下载失败,中止: {name}")
        local[name] = dest

    # 5. 上传 Gitee(上传后再拉一次资产名单防并发重复;同名跳过)
    for name, path in sorted(local.items()):
        if name in have:
            print(f"[gitee] {name} 已存在,跳过")
            continue
        gitee_upload(rid, path, name)
        have.add(name)
        time.sleep(2)
    print(f"[done] {args.tag} 补齐完成,当前 Gitee 资产 {len(have)} 个")


if __name__ == "__main__":
    main()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
