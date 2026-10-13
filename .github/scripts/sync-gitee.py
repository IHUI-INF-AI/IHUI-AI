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

# 2026-10-12:模块级 PLATFORM_MAP 已删除 —— 旧映射后缀与 tauri-action 实际产物名
# 对不上(两次实锤 mac/linux 全漏),正确映射已内联到 main()(带注释),勿在此复活。


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
    # 2026-10-13 深夜修:Gitee 大文件(79MB AppImage 实锤)写超时为慢性病,
    # 原实现单次尝试失败即放弃且调用处不检查返回值 ⇒ 资产永久缺角(下版才补)。
    # 改为 3 次指数退避重试;调用处对 False 记入失败清单并终验,重跑本 job 幂等补齐。
    for attempt in range(1, 4):
        req = urllib.request.Request(url, data=body, method="POST")
        req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
        try:
            r = urllib.request.urlopen(req, timeout=1800)
            print(f"[gitee] 上传 {filename}: {r.status}")
            return True
        except urllib.error.HTTPError as e:
            print(f"[gitee] 上传 {filename} 第{attempt}/3次失败: {e.code} {e.read()[:150]}")
        except Exception as e:
            print(f"[gitee] 上传 {filename} 第{attempt}/3次异常: {e}")
        time.sleep(20 * attempt)
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

    # 3. 上传缺的资产
    # 2026-10-12 修正 PLATFORM_MAP(0.1.50/0.1.51 两次实锤 mac/linux 全漏):
    #   tauri-action universal 构建的实际产物名是 AI_universal.app.tar.gz(不含
    #   aarch64/x64 字样),旧后缀 aarch64.app.tar.gz / x64.app.tar.gz 永不命中;
    #   linux 的 updater 产物是 .AppImage 本体(.AppImage.tar.gz 形态不存在)。
    #   universal 一份签名包覆盖 darwin 双键。
    need = {}
    for plat, suffix in [
        ("windows-x86_64", "-setup.exe"),
        ("darwin-aarch64", "universal.app.tar.gz"),
        ("darwin-x86_64", "universal.app.tar.gz"),
        ("linux-x86_64", ".AppImage"),
    ]:
        mains = [n for n in assets if n.endswith(suffix)]
        if not mains:
            print(f"[warn] 平台 {plat} 在 GH release 无命中资产(后缀 {suffix})")
            continue
        main = sorted(mains)[-1]
        sig = main + ".sig"
        need[plat] = (main, sig if sig in assets else None)

    # 3--extra. 镜像 GH release 全部安装包资产(不只 feed 四键)——下载页的
    # dmg/deb/rpm 也走 Gitee 优先合并(0.1.51 曾因此回指 GitHub,backfill 兜底
    # 属人工通道,这里补成 CI 自动)。latest.json 排除(GH 版 url 指 github.com)。
    upload_set = set()
    for plat, (main, sig) in need.items():
        upload_set.update(x for x in (main, sig) if x)
    for name in assets:
        if name == "latest.json" or name.endswith((".zip", ".tar.gz")):
            continue
        upload_set.add(name)

    # 3a. 先下载全部所需文件到本地(feed 生成也需要 sig——即使 Gitee 已有同名资产)
    # 2026-10-12:临时目录按 TAG 分子目录 —— 跨 tag 平铺会让无版本号资产名
    # (AI_universal.app.tar.gz 等)把上一版内容当本版上传(backfill 实锤的冒名形态)。
    tmpdir = f"/tmp/backfill-gitee/{TAG}"
    os.makedirs(tmpdir, exist_ok=True)
    for fname in sorted(upload_set):
        local = f"{tmpdir}/{fname}"
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
    # 2026-10-13:上传失败不再静默吞——记入失败清单,全部尽力后统一终验,
    # 有缺口则以非零退出(重跑本 job 幂等补齐),让 job 红 ≠ 资产悄悄缺角。
    upload_failed = []
    for fname in sorted(upload_set):
        if fname in gitee_assets:
            print(f"[gitee] {fname} 已存在,跳过上传")
            continue
        if not gitee_upload(rid, f"{tmpdir}/{fname}", fname):
            upload_failed.append(fname)
            continue
        gitee_assets.add(fname)
    if upload_failed:
        sys.exit(f"[gitee] 以下资产重试 3 次后仍上传失败: {sorted(upload_failed)}"
                 f"(重跑本 job 可幂等补齐)")

    # 4. 生成 latest.json(url → Gitee 直链)
    platforms = {}
    for plat, (main, sig) in need.items():
        if sig is None:
            print(f"[feed] {plat} 无 .sig,跳过")
            continue
        sig_content = open(f"{tmpdir}/{sig}").read().strip()
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
    # 与 gitee-release-attach.py(本机发版路径)一致。
    # 注:Gitee 侧该 release 只是附件存档,**不是**更新器端点(客户端 2026-10-05 起只认
    # aizhs.top 单端点);GitHub feed 维护已随该拍板删除,这里不再提任何 GitHub 端点。
    try:
        content_b64 = __import__("base64").b64encode(
            json.dumps(latest, indent=2, ensure_ascii=False).encode()).decode()
        FEED_TAG = "desktop-updater-feed"
        rel = gitee_api(f"/repos/{GITEE_OWNER}/{GITEE_REPO}/releases/tags/{FEED_TAG}")
        if rel and rel.get("id"):
            print("[gitee] feed release 已存在(非更新器端点,跳过)")
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
        print("[done] Gitee feed 附件已处理(非更新器端点,仅存档)")
    except Exception as e:
        print(f"[gitee] feed 更新异常(不阻塞): {e}")


if __name__ == "__main__":
    main()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
