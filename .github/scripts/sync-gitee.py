#!/usr/bin/env python3
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
"""release-desktop 的 Gitee 同步 job(2026-09-17 立):
1. 从 GitHub release(desktop-v*) 下载全平台安装包/更新签名
2. 找/建 Gitee 同名 release 并逐资产上传(同名跳过,幂等)
3. 生成 latest.json(url 全部指向 Gitee 直链,国内下载快)并更新 desktop-feed 分支
   → 更新器第一端点 https://gitee.com/<owner>/IHUI-AI/raw/desktop-feed/latest.json
环境变量:GITEE_TOKEN / GITEE_OWNER / TAG / GH_TOKEN / GITHUB_REPOSITORY
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error

GH_TOKEN = os.environ["GH_TOKEN"]
GITEE_TOKEN = os.environ["GITEE_TOKEN"]
GITEE_OWNER = os.environ["GITEE_OWNER"]
TAG = os.environ["TAG"]
GH_REPO = os.environ["GITHUB_REPOSITORY"]
GITEE_REPO = "IHUI-AI"

# Tauri updater 平台 → 资产名后缀映射
PLATFORM_MAP = [
    ("windows-x86_64", "-setup.exe"),
    ("darwin-aarch64", "aarch64.app.tar.gz"),
    ("darwin-x86_64", "x64.app.tar.gz"),
    ("linux-x86_64", ".AppImage.tar.gz"),
]


def gh_api(path):
    req = urllib.request.Request(f"https://api.github.com{path}")
    req.add_header("Authorization", f"Bearer {GH_TOKEN}")
    req.add_header("Accept", "application/vnd.github+json")
    return json.load(urllib.request.urlopen(req, timeout=60))


def gitee_api(path, method="GET", data=None):
    url = f"https://gitee.com/api/v5{path}"
    if data is not None and method == "POST":
        url += ("&" if "?" in url else "?") + f"access_token={GITEE_TOKEN}"
    req = urllib.request.Request(url, method=method)
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        req.add_header("Content-Type", "application/json")
    req.data = body
    try:
        return json.load(urllib.request.urlopen(req, timeout=120))
    except urllib.error.HTTPError as e:
        print(f"[gitee] {method} {path} -> {e.code}: {e.read()[:200]}")
        return None


def gitee_upload(release_id, filepath, filename):
    url = (f"https://gitee.com/api/v5/repos/{GITEE_OWNER}/{GITEE_REPO}"
           f"/releases/{release_id}/attach_files?access_token={GITEE_TOKEN}")
    boundary = "ihui" + str(int(time.time()))
    data = open(filepath, "rb").read()
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; "
            f"filename=\"{filename}\"\r\nContent-Type: application/octet-stream\r\n\r\n").encode() \
        + data + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    try:
        r = urllib.request.urlopen(req, timeout=1800)
        print(f"[gitee] 上传 {filename}: {r.status}")
        return True
    except urllib.error.HTTPError as e:
        print(f"[gitee] 上传 {filename} 失败: {e.code} {e.read()[:150]}")
        return False


def main():
    # 1. GitHub release 资产清单
    rel = gh_api(f"/repos/{GH_REPO}/releases/tags/{TAG}")
    assets = {a["name"]: a for a in rel.get("assets", [])}
    print(f"[gh] {TAG} 资产 {len(assets)} 个")

    # 2. 找/建 Gitee release
    grel = gitee_api(f"/repos/{GITEE_OWNER}/{GITEE_REPO}/releases/tags/{TAG}")
    if grel is None:
        print("[gitee] 创建 release...")
        grel = gitee_api(f"/repos/{GITEE_OWNER}/{GITEE_REPO}/releases", "POST", {
            "tag_name": TAG, "name": f"IHUI AI Desktop {TAG}",
            "body": rel.get("body") or "Desktop bundles (Tauri 2)",
            "target_commitish": "main", "prerelease": False})
        if grel is None:
            sys.exit("Gitee release 创建失败")
    rid = grel["id"]
    gitee_assets = {a["name"] for a in (grel.get("assets") or [])}

    # 3. 上传缺的资产(安装包+sig)
    need = {}
    for plat, suffix in PLATFORM_MAP:
        mains = [n for n in assets if n.endswith(suffix)]
        if not mains:
            continue
        main = sorted(mains)[-1]
        sig = main + ".sig"
        need[plat] = (main, sig if sig in assets else None)

    for plat, (main, sig) in need.items():
        for fname in [x for x in (main, sig) if x]:
            if fname in gitee_assets:
                print(f"[gitee] {fname} 已存在,跳过")
                continue
            gh_url = assets[fname]["browser_download_url"]
            local = f"/tmp/{fname}"
            for attempt in range(1, 4):
                try:
                    req = urllib.request.Request(gh_url)
                    req.add_header("Authorization", f"Bearer {GH_TOKEN}")
                    open(local, "wb").write(urllib.request.urlopen(req, timeout=1800).read())
                    print(f"[gh→tmp] {fname}: {os.path.getsize(local)} 字节")
                    break
                except Exception as e:
                    print(f"[gh→tmp] 第{attempt}次失败: {e}")
                    time.sleep(5)
            else:
                sys.exit(f"资产下载失败: {fname}")
            gitee_upload(rid, local, fname)
            gitee_assets.add(fname)

    # 4. 生成 latest.json(url → Gitee 直链)
    platforms = {}
    for plat, (main, sig) in need.items():
        if sig is None:
            print(f"[feed] {plat} 无 .sig,跳过")
            continue
        sig_content = open(f"/tmp/{sig}").read().strip()
        platforms[plat] = {
            "signature": sig_content,
            "url": f"https://gitee.com/{GITEE_OWNER}/{GITEE_REPO}/releases/download/{TAG}/{main}",
        }
    if not platforms:
        sys.exit("无任何平台可写入 feed")
    latest = {
        "version": TAG.replace("desktop-v", ""),
        "notes": f"IHUI AI Desktop {TAG} — 国内直连更新(Gitee)",
        "pub_date": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "platforms": platforms,
    }
    content_b64 = __import__("base64").b64encode(
        json.dumps(latest, indent=2, ensure_ascii=False).encode()).decode()

    # 5. 更新 desktop-feed 分支的 latest.json(contents API,幂等)
    path = f"/repos/{GITEE_OWNER}/{GITEE_REPO}/contents/latest.json?ref=desktop-feed"
    cur = None
    try:
        cur = gitee_api(f"/repos/{GITEE_OWNER}/{GITEE_REPO}/contents/latest.json?ref=desktop-feed")
    except Exception:
        pass
    body = {"access_token": GITEE_TOKEN, "content": content_b64, "branch": "desktop-feed"}
    if cur and cur.get("sha"):
        body["sha"] = cur["sha"]
    r = gitee_api(f"/repos/{GITEE_OWNER}/{GITEE_REPO}/contents/latest.json", "PUT", body)
    if r:
        print(f"[gitee] desktop-feed/latest.json 已更新 commit={r.get('commit', {}).get('sha', '')[:10]}")
    else:
        sys.exit("desktop-feed 更新失败")
    print(f"[done] Gitee 更新器端点: https://gitee.com/{GITEE_OWNER}/{GITEE_REPO}/raw/desktop-feed/latest.json")


if __name__ == "__main__":
    main()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
