#!/usr/bin/env python3
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Gitee 发行直传(release-desktop-local.mjs 的 Gitee 阶段,python 实现——
Node fetch(undici) 对 Gitee multipart 上传报 401,python urllib 实证可行):
  用法: gitee-release-attach.py --tag desktop-v0.1.22 --exe <path> --sig <path> --version 0.1.22 [--skip-upload]
  行为: 找/建 Gitee release → 上传 exe+sig(跳过同名)→ 更新更新器 feed:
        **release 附件方案**(2026-09-17 终极):latest.json 作为
        desktop-updater-feed release 的附件(替换式更新)——仓库治理「单分支守门」
        会删除除 main 外所有分支(desktop-feed 分支被删三次的真因),release 附件不受影响。
        Gitee 与 GitHub 双平台同步更新,更新器端点见 tauri.conf.json plugins.updater.endpoints。
环境变量: GITEE_TOKEN;可选 GH_TOKEN(启用 GitHub 侧 feed 更新), GITHUB_REPOSITORY
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request

TOKEN = os.environ["GITEE_TOKEN"]
OWNER = os.environ.get("GITEE_OWNER", "JLSLSSZWHYXGS_0")
REPO = os.environ.get("GITEE_REPO", "IHUI-AI")
FEED_TAG = "desktop-updater-feed"


def api(p, method="GET", data=None):
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


def upload(rid, filepath, filename, content_type="application/octet-stream"):
    url = (f"https://gitee.com/api/v5/repos/{OWNER}/{REPO}"
           f"/releases/{rid}/attach_files?access_token={TOKEN}")
    boundary = "ihui" + str(int(time.time() * 1000))
    data = open(filepath, "rb").read()
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; "
            f"filename=\"{filename}\"\r\nContent-Type: {content_type}\r\n\r\n").encode() \
        + data + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    r = urllib.request.urlopen(req, timeout=1800)
    print(f"[gitee] 上传 {filename}: {r.status}")


def replace_gitee_feed(latest_data):
    """Gitee feed 更新:整删重建 release(2026-09-17 实证——同名附件允许重复上传但
    下载直链永远取第一个旧附件;而 asset 列表不返回 id 无法逐一删除,故删整个 release)。"""
    # 2026-09-17:tag 残留导致同 tag 重建必失败,且 Gitee 无删 tag API——
    # 快速路径:tag 已存在则本平台 feed 由 GitHub release 附件承担(更新器双端点),
    # 不做无谓的删/建重试(每次省 ~10s)。仅当无残留 tag 时才创建。
    rel = api(f"/repos/{OWNER}/{REPO}/releases/tags/{FEED_TAG}")
    if rel and rel.get("id"):
        print("[gitee] feed release 已存在(Gitee 侧 feed 由 GitHub 端点承担,跳过重建)")
        return
    rel = api(f"/repos/{OWNER}/{REPO}/releases", "POST", {
        "tag_name": FEED_TAG, "name": "Desktop updater feed(更新 feed 固定端点)",
        "body": "自动化维护:latest.json 随每次桌面端发版更新。请勿手动删除。",
        "target_commitish": "main", "prerelease": False})
    if not rel or not rel.get("id"):
        print("[gitee] feed release 重建失败,跳过")
        return
    boundary = "ihui" + str(int(time.time() * 1000))
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; "
            f"filename=\"latest.json\"\r\nContent-Type: application/json\r\n\r\n").encode() \
        + latest_data + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        f"https://gitee.com/api/v5/repos/{OWNER}/{REPO}/releases/{rel['id']}/attach_files?access_token={TOKEN}",
        data=body, method="POST")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    r = urllib.request.urlopen(req, timeout=300)
    print(f"[gitee] feed release 重建并更新 latest.json: {r.status}")


def replace_github_feed(latest_data):
    gh = os.environ.get("GH_TOKEN")
    if not gh:
        print("[gh] 无 GH_TOKEN,跳过 GitHub feed")
        return
    gh_repo = os.environ.get("GITHUB_REPOSITORY", "IHUI-INF-AI/IHUI-AI")
    hdr = {"Authorization": f"Bearer {gh}", "Accept": "application/vnd.github+json",
           "User-Agent": "ihui"}

    def gh_api(pth, method="GET", payload=None):
        req = urllib.request.Request(f"https://api.github.com{pth}", method=method)
        req.headers.update(hdr)
        if payload is not None:
            req.add_header("Content-Type", "application/json")
            req.data = json.dumps(payload).encode()
        try:
            r = urllib.request.urlopen(req, timeout=120)
            b = r.read().decode()
            return (json.loads(b) if b.strip() else None)
        except urllib.error.HTTPError as e:
            print(f"[gh] {method} {pth} -> {e.code}")
            return None

    rel = gh_api(f"/repos/{gh_repo}/releases/tags/{FEED_TAG}")
    if not rel or not rel.get("id"):
        rel = gh_api(f"/repos/{gh_repo}/releases", "POST", {
            "tag_name": FEED_TAG, "name": "Desktop updater feed",
            "body": "Automated: latest.json updated on each desktop release.",
            "prerelease": False, "draft": False})
    if not rel or not rel.get("id"):
        print("[gh] feed release 不可用,跳过")
        return
    for a in rel.get("assets", []):
        if a["name"] == "latest.json":
            gh_api(f"/repos/{gh_repo}/releases/assets/{a['id']}", "DELETE")
    req = urllib.request.Request(rel["upload_url"].split("{")[0] + "?name=latest.json",
                                 data=latest_data, method="POST")
    req.headers.update(hdr)
    req.add_header("Content-Type", "application/json")
    try:
        print(f"[gh] feed release latest.json 更新: {urllib.request.urlopen(req, timeout=300).status}")
    except urllib.error.HTTPError as e:
        print(f"[gh] feed 上传失败: {e.code}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tag", required=True)
    ap.add_argument("--exe", required=True)
    ap.add_argument("--sig", required=True)
    ap.add_argument("--skip-upload", action="store_true")
    ap.add_argument("--version", required=True)
    args = ap.parse_args()

    tag = args.tag
    rel = api(f"/repos/{OWNER}/{REPO}/releases/tags/{tag}")
    # Gitee 对不存在的 release 返回 200 + "null" 字面量,须显式判空
    if not rel or not rel.get("id"):
        rel = api(f"/repos/{OWNER}/{REPO}/releases", "POST", {
            "tag_name": tag, "name": f"智汇AI 桌面端 {tag}",
            "body": f"桌面端 {args.version}(本机极速发版)",
            "target_commitish": "main", "prerelease": False})
        if not rel or not rel.get("id"):
            sys.exit("Gitee release 创建失败")
    rid = rel["id"]
    have = {a["name"] for a in (rel.get("assets") or [])}
    print(f"[gitee] release {tag} id={rid},已有资产 {len(have)} 个")

    exe_name = os.path.basename(args.exe)
    sig_name = exe_name + ".sig"
    if not args.skip_upload:
        for f, p in ((exe_name, args.exe), (sig_name, args.sig)):
            if f in have:
                print(f"[gitee] {f} 已存在,跳过上传")
                continue
            upload(rid, p, f)
            time.sleep(2)
            have.add(f)

    # 更新器 feed(2026-09-17 终极:release 附件方案,双平台)
    sig = open(args.sig, encoding="utf-8").read().strip()
    latest = {
        "version": args.version,
        "notes": f"智汇AI 桌面端 {args.version}:极速薄壳、首启不白屏、自动热刷新、断网兜底、自动更新。",
        "pub_date": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "platforms": {"windows-x86_64": {
            "signature": sig,
            "url": f"https://gitee.com/{OWNER}/{REPO}/releases/download/{tag}/{exe_name}",
        }},
    }
    latest_data = json.dumps(latest, indent=2, ensure_ascii=False).encode()
    try:
        replace_gitee_feed(latest_data)
    except Exception as e:
        print(f"[gitee] feed 更新异常: {e}")
    try:
        replace_github_feed(latest_data)
    except Exception as e:
        print(f"[gh] feed 更新异常: {e}")
    print("[done] 端点: gitee/github releases/download/desktop-updater-feed/latest.json")


if __name__ == "__main__":
    main()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
