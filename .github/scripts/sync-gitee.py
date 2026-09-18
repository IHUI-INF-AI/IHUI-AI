#!/usr/bin/env python3
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
"""release-desktop 的 Gitee 同步 job(2026-09-17 立):
1. 从 GitHub release(desktop-v*) 下载全平台安装包/更新签名
   (2026-09-18:镜像范围 = **全部安装包** exe/dmg/deb/rpm/AppImage/app.tar.gz + .sig,
    不再局限于 updater 所需平台——此前 macOS/Linux 后缀不匹配,只剩 Windows 单平台)
2. 找/建 Gitee 同名 release 并逐资产上传(同名跳过,幂等)
3. 生成 latest.json(url 全部指向 Gitee 直链,国内下载快)并更新 desktop-feed 分支
   → 更新器第一端点 https://gitee.com/<owner>/IHUI-AI/raw/desktop-feed/latest.json
环境变量:GITEE_TOKEN / GITEE_OWNER / TAG / GH_TOKEN / GITHUB_REPOSITORY
可选:IHUI_MIRROR_TMP(本地 Windows 执行时的临时目录,CI 不设)
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

# 本地(Windows)执行时 "/tmp" 会解析为**当前盘符根目录**(如 G:\tmp)且可能不存在;
# 允许用 IHUI_MIRROR_TMP 覆盖。CI(Linux)不设该变量,行为与原先完全一致。
TMP_DIR = os.environ.get("IHUI_MIRROR_TMP", "/tmp").rstrip("/")
os.makedirs(TMP_DIR, exist_ok=True)

# Tauri updater 平台 → 产物名匹配规则(2026-09-18 修正)
# 旧实现按硬编码后缀匹配,与实际产物名不符 → macOS/Linux 条目**从未命中**,
# Gitee release 只剩 Windows 单平台(国内用户下载 dmg/deb/rpm 只能回退 GitHub)。
# 实测产物名(GitHub release desktop-v0.1.36):
#   AI_<ver>_x64-setup.exe / AI.app.tar.gz(x64) / AI_universal.app.tar.gz(universal)
#   AI_<ver>_amd64.AppImage / AI_<ver>_amd64.deb / AI-<ver>-1.x86_64.rpm
PLATFORM_MAP = [
    ("windows-x86_64", lambda n: n.endswith("-setup.exe")),
    ("darwin-x86_64", lambda n: n == "AI.app.tar.gz"),
    ("darwin-aarch64", lambda n: n == "AI_universal.app.tar.gz"),
    # Tauri 的 AppImage 自动更新要求 .AppImage.tar.gz(AppImage + zsync 元数据);
    # 当前产物只有裸 .AppImage,故 Linux 更新平台暂不可用(不写入 feed,见 step 4 跳过日志)。
    ("linux-x86_64", lambda n: n.endswith(".AppImage.tar.gz")),
]

# 镜像范围(2026-09-18):Gitee release 承载**全部用户可下载的安装包**,
# 与 updater 平台解耦——否则 dmg/deb/rpm 等非更新器产物永远拿不到国内镜像。
# latest.json 属 feed 自身(由独立流程维护),不在镜像范围。
MIRROR_SUFFIXES = ("-setup.exe", ".dmg", ".deb", ".rpm", ".AppImage", ".app.tar.gz")


def gh_api(path):
    req = urllib.request.Request(f"https://api.github.com{path}")
    req.add_header("Authorization", f"Bearer {GH_TOKEN}")
    req.add_header("Accept", "application/vnd.github+json")
    try:
        return json.load(urllib.request.urlopen(req, timeout=60))
    except urllib.error.HTTPError as e:
        # 2026-09-18:TAG 传错(如 workflow_dispatch 下拿到分支名 main)时原实现直接
        # 抛裸 HTTPError,只有一长串 urllib 堆栈、看不到请求了哪个路径。这里回显 path。
        detail = e.read()[:300].decode("utf-8", errors="replace")
        raise SystemExit(f"[gh] GET {path} -> HTTP {e.code}: {detail}") from e


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

    # 3. 上传缺的资产(安装包 + 全部 .sig)
    # 3.0 updater 平台 → (主包, .sig) 映射(仅供 step 4 生成 feed,不决定镜像范围)
    need = {}
    for plat, match in PLATFORM_MAP:
        mains = [n for n in assets if match(n)]
        if not mains:
            print(f"[feed] {plat} 无匹配产物,跳过")
            continue
        main = sorted(mains)[-1]
        sig = main + ".sig"
        need[plat] = (main, sig if sig in assets else None)

    # 3.1 镜像清单:全部可下载安装包 + 对应 .sig(含 dmg/deb/rpm 等非 updater 平台)
    mirror = []
    for name in sorted(assets):
        if name.endswith(".sig"):
            continue
        if any(name.endswith(sfx) for sfx in MIRROR_SUFFIXES):
            mirror.append(name)
            if f"{name}.sig" in assets:
                mirror.append(f"{name}.sig")
    files = sorted(set(mirror) | {f for pair in need.values() for f in pair if f})
    print(f"[mirror] 待同步 {len(files)} 个文件:{', '.join(files) if files else '(无)'}")

    # 3a. 先下载全部所需文件到本地(feed 生成也需要 sig——即使 Gitee 已有同名资产)
    for fname in files:
        local = f"{TMP_DIR}/{fname}"
        if os.path.exists(local):
            continue
        gh_url = assets[fname]["browser_download_url"]
        for attempt in range(1, 4):
            try:
                req = urllib.request.Request(gh_url)
                req.add_header("Authorization", f"Bearer {GH_TOKEN}")
                open(local, "wb").write(urllib.request.urlopen(req, timeout=1800).read())
                print(f"[gh→tmp] {fname}: {os.path.getsize(local)} 字节")
                break
            except Exception as e:
                print(f"[gh→tmp] {fname} 第{attempt}次失败: {e}")
                time.sleep(5)
        else:
            sys.exit(f"资产下载失败: {fname}")

    # 3b. 上传 Gitee 缺失的资产(幂等:已有同名跳过)
    for fname in files:
        if fname in gitee_assets:
            print(f"[gitee] {fname} 已存在,跳过上传")
            continue
        gitee_upload(rid, f"{TMP_DIR}/{fname}", fname)
        gitee_assets.add(fname)

    # 4. 生成 latest.json(url → Gitee 直链)
    platforms = {}
    for plat, (main, sig) in need.items():
        if sig is None:
            print(f"[feed] {plat} 无 .sig,跳过")
            continue
        sig_content = open(f"{TMP_DIR}/{sig}").read().strip()
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

    # 5. 更新器 feed(2026-09-17 终极:release 附件方案)
    # 旧 desktop-feed 分支方案已废弃——仓库「单分支守门」会删该分支,且 Gitee contents API
    # 的 PUT 行为不稳。改写 desktop-updater-feed release 的 latest.json 附件(幂等替换),
    # 与 gitee-release-attach.py(本机发版路径)完全一致;失败不阻塞(更新器双端点,GH 兜底)。
    try:
        content_b64 = __import__("base64").b64encode(
            json.dumps(latest, indent=2, ensure_ascii=False).encode()).decode()
        FEED_TAG = "desktop-updater-feed"
        rel = gitee_api(f"/repos/{GITEE_OWNER}/{GITEE_REPO}/releases/tags/{FEED_TAG}")
        if rel and rel.get("id"):
            print("[gitee] feed release 已存在(Gitee 侧 feed 由 GitHub 端点承担,跳过)")
        else:
            rel = gitee_api(f"/repos/{GITEE_OWNER}/{GITEE_REPO}/releases", "POST", {
                "tag_name": FEED_TAG, "name": "Desktop updater feed(更新 feed 固定端点)",
                "body": "自动化维护:latest.json 随每次桌面端发版更新。请勿手动删除。",
                "target_commitish": "main", "prerelease": False})
            if rel and rel.get("id"):
                boundary = "ihui" + str(int(__import__("time").time() * 1000))
                # multipart 组装与 gitee-release-attach.py 的 upload() 同款(\r\n 转义)
                header = (
                    "--%s\r\nContent-Disposition: form-data; name=\"file\"; "
                    "filename=\"latest.json\"\r\nContent-Type: application/json\r\n\r\n"
                    % boundary
                )
                body = header.encode() + json.dumps(
                    latest, indent=2, ensure_ascii=False).encode() + (
                    "\r\n--%s--\r\n" % boundary).encode()
                req = urllib.request.Request(
                    f"https://gitee.com/api/v5/repos/{GITEE_OWNER}/{GITEE_REPO}/releases/{rel['id']}/attach_files?access_token={GITEE_TOKEN}",
                    data=body, method="POST")
                req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
                r = urllib.request.urlopen(req, timeout=300)
                print(f"[gitee] feed release latest.json 更新: {r.status}")
        print("[done] 端点: gitee/github releases/download/desktop-updater-feed/latest.json")
    except Exception as e:
        print(f"[gitee] feed 更新异常(不阻塞): {e}")
    print("[done] Gitee 更新器端点: https://github.com/IHUI-INF-AI/IHUI-AI/releases/download/desktop-updater-feed/latest.json")


if __name__ == "__main__":
    main()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
