#!/usr/bin/env python3
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (李春川 Li Chunchuan) · https://aizhs.top
"""Gitee 发行直传(release-desktop-local.mjs 的 Gitee 阶段,python 实现——
Node fetch(undici) 对 Gitee multipart 上传报 401,python urllib 实证可行):
  用法: gitee-release-attach.py --tag desktop-v0.1.22 --exe <path> --sig <path> [--skip-upload]
  行为: 找/建 Gitee release → 上传 exe+sig(跳过同名)→ desktop-feed/latest.json 更新(windows)
环境变量: GITEE_TOKEN, GITEE_OWNER(默认 JLSLSSZWHYXGS_0), GITEE_REPO(默认 IHUI-AI)
"""
import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request

TOKEN = os.environ["GITEE_TOKEN"]
OWNER = os.environ.get("GITEE_OWNER", "JLSLSSZWHYXGS_0")
REPO = os.environ.get("GITEE_REPO", "IHUI-AI")


def api(p, method="GET", data=None):
    url = f"https://gitee.com/api/v5{p}"
    if data and method == "POST":
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


def upload(rid, filepath, filename):
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

    # feed 更新(windows 平台)
    sig = open(args.sig, encoding="utf-8").read().strip()
    latest = {
        "version": args.version,
        "notes": f"智汇AI 桌面端 {args.version}:极速薄壳、自动刷新+断网兜底。",
        "pub_date": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "platforms": {"windows-x86_64": {
            "signature": sig,
            "url": f"https://gitee.com/{OWNER}/{REPO}/releases/download/{tag}/{exe_name}",
        }},
    }
    latest_text = json.dumps(latest, indent=2, ensure_ascii=False)

    # 4. [真源] GitHub desktop-feed 分支更新(2026-09-17 根治:Gitee 分支会被
    #    mirror-to-cn 的 --prune 反复删除;真源放 GitHub,镜像自动携带,永不再删)
    gh = os.environ.get("GH_TOKEN")
    if gh:
        gh_repo = os.environ.get("GITHUB_REPOSITORY", "IHUI-INF-AI/IHUI-AI")
        gh_h = {"Authorization": f"Bearer {gh}", "Accept": "application/vnd.github+json",
                "User-Agent": "ihui", "Content-Type": "application/json"}
        latest_b64 = base64.b64encode(latest_text.encode()).decode()
        try:
            req = urllib.request.Request(
                f"https://api.github.com/repos/{gh_repo}/contents/latest.json?ref=desktop-feed")
            req.headers.update(gh_h)
            cur = json.loads(urllib.request.urlopen(req, timeout=60).read())
            put = {"message": f"desktop updater feed {args.version}",
                   "content": latest_b64, "branch": "desktop-feed", "sha": cur["sha"]}
        except Exception:
            put = {"message": f"desktop updater feed {args.version}",
                   "content": latest_b64, "branch": "desktop-feed"}
        try:
            req = urllib.request.Request(
                f"https://api.github.com/repos/{gh_repo}/contents/latest.json", method="PUT")
            req.headers.update(gh_h)
            req.data = json.dumps(put).encode()
            r = urllib.request.urlopen(req, timeout=120)
            print(f"[gh] desktop-feed/latest.json: {r.status}(镜像自动同步 Gitee)")
        except urllib.error.HTTPError as e:
            print(f"[gh] feed 更新失败: {e.code} {e.read().decode()[:150]}")
    else:
        print("[gh] 无 GH_TOKEN,跳过 GitHub 真源 feed 更新")

    # 5. Gitee feed(镜像自动同步;此处 contents PUT 仅作兜底,失败不影响真源)
    content_b64 = base64.b64encode(latest_text.encode()).decode()
    cur = api(f"/repos/{OWNER}/{REPO}/contents/latest.json?ref=desktop-feed")
    body = {"access_token": TOKEN, "content": content_b64,
            "branch": "desktop-feed", "message": f"desktop updater feed {args.version}"}
    if cur and cur.get("sha"):
        body["sha"] = cur["sha"]
    r = api(f"/repos/{OWNER}/{REPO}/contents/latest.json", "PUT", body)
    if not r:
        print("[gitee] desktop-feed contents 更新失败(真源已在 GitHub,镜像稍后同步,忽略)")
    print("[done] 端点: gitee raw/desktop-feed + github raw/desktop-feed")


if __name__ == "__main__":
    main()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
