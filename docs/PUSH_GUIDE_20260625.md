# 推送指南 - 2026-06-25

## 当前状态

- 本地分支: `main`
- 远端分支: `origin/main` @ `7cc9c02f1ac67d6003948a6aa52c07d830955659`
- 领先 commit 数: 4 个

## 待推送的 4 个 commit

```
c1044e8 chore: 续清 usePagePerf 引用 (Agents.vue)
2baccf4 chore: 续清 usePagePerf 引用 (Settings.vue + Tools.vue)
673789f chore: 字体重构后续清理 (移除 usePagePerf 引用 + SCSS inherit 优化)
cdb8ab0 chore: 添加整合交付 + 凭证轮换 + 部署辅助文档与脚本
```

## 推送方法 (3 选 1)

### 方法 1: 直接 git push (推荐,网络可达时)

```bash
cd g:\IHUI-AI
git push origin main
```

### 方法 2: 使用 bundle 文件 (网络受限时)

bundle 文件已生成: `g:\IHUI-AI\push-bundle-20260625.bundle` (74KB, 4 commit)

在能访问 GitHub 的机器上:
```bash
# 1. 拷贝 bundle 到目标机器
# 2. 验证 bundle
git bundle verify push-bundle-20260625.bundle

# 3. 从 bundle fetch
git fetch push-bundle-20260625.bundle main:tmp-main
git push origin tmp-main:main
git branch -d tmp-main
```

### 方法 3: 使用 patch 文件 (备选)

```bash
cd g:\IHUI-AI
git format-patch -4 HEAD --stdout > 4-commits.patch
# 在远端机器上:
git am 4-commits.patch
git push origin main
```

## 推送前最终检查

- [x] git status 干净 (无 untracked, 无 modified)
- [x] 4 个 commit 通过基础语法检查
- [x] docs/KEY_ROTATION_RUNBOOK.md 完整 (562 行)
- [x] server/scripts/alipay_private_key_backup.py 语法 OK
- [x] server/scripts/credential_rotation_checklist.py 语法 OK
- [x] deploy_certs.sh 语法 OK (bash -n)
- [x] 临时调试脚本已 .gitignore
- [x] 无明文凭证泄露

## 推送后

1. 验证 GitHub Actions CI 通过
2. 在 5xx 服务器拉取最新代码
3. 重启后端 + 前端 dev server
4. 执行生产冒烟测试: `python server/scripts/verify_production_smoke.py`
5. 删除 `push-bundle-20260625.bundle` 临时文件
