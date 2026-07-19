# i18n common 通用文案 4 key 补齐报告

- 时间:2026-07-19 23:18:08
- 范围:`apps/web/messages/` 5 语言文件 common 命名空间
- 任务:补齐 4 个 common 通用文案 key 到 zh-CN / zh-TW / en / ja / ko 5 语言

## 1. 补齐的 4 个 key

| key | zh-CN | zh-TW | en | ja | ko |
| --- | --- | --- | --- | --- | --- |
| `common.systemTip` | 系统提示 | 系統提示 | System Tip | システムヒント | 시스템 팁 |
| `common.serialNumber` | 序号 | 序號 | Serial Number | シリアル番号 | 일련 번호 |
| `common.dataItem` | 数据项 | 資料項 | Data Item | データ項目 | 데이터 항목 |
| `common.modifySuccess` | 修改成功 | 修改成功 | Modified Successfully | 変更成功 | 수정 성공 |

## 2. 受影响文件

- `apps/web/messages/zh-CN.json`(基准,第 309-313 行追加)
- `apps/web/messages/zh-TW.json`(第 309-313 行追加)
- `apps/web/messages/en.json`(第 309-313 行追加)
- `apps/web/messages/ja.json`(第 309-313 行追加)
- `apps/web/messages/ko.json`(第 309-313 行追加)

每个文件均:
- 在 `common` 命名空间最后 1 个 key `"empty"` 后追加逗号
- 4 个新 key 4 空格缩进,与现有键风格一致
- 末尾不带逗号,关闭 `}` 紧随其后
- 5 语言 key 集合 parity 完全一致

## 3. JSON 有效性验证

```bash
node -e "JSON.parse(require('fs').readFileSync('apps/web/messages/zh-CN.json','utf8'))"  # ✅
node -e "JSON.parse(require('fs').readFileSync('apps/web/messages/zh-TW.json','utf8'))"  # ✅
node -e "JSON.parse(require('fs').readFileSync('apps/web/messages/en.json','utf8'))"     # ✅
node -e "JSON.parse(require('fs').readFileSync('apps/web/messages/ja.json','utf8'))"     # ✅
node -e "JSON.parse(require('fs').readFileSync('apps/web/messages/ko.json','utf8'))"     # ✅
```

结果:5 文件全部 `OK`,JSON 结构合法。

## 4. i18n 守门脚本验证

### 4.1 第 2 项 — `check-i18n-keys.mjs`(key 完整性 + parity)

```bash
node scripts/check-i18n-keys.mjs
```

结果:exit 1,但**与本任务 4 个 common key 无关**。脚本输出查找 `common.(systemTip|serialNumber|dataItem|modifySuccess)` **0 命中**,证明 4 个新 key 在 5 语言间 parity 完全一致。

预先存在的 parity 问题(非本任务范围,不在受影响文件清单内):
- en/ja/ko/zh-TW 各有 537 个 `admin.nav.group.*` / `admin.logininfor.*` 等键 zh-CN 缺失
- 250 个 `admin.*` 命名空间缺失键(logininfor / menuPermission / newsCategory / notice / online / operlog / paperTemplate / questionCategory / questionImport / sensitiveWord / signinRule / wallet / withdrawal 等 admin 页面)
- 1166 处未翻译键(多为品牌名 iOS / Android APK / Google / Apple / GitHub / OpenAI / Grok 等有意保留英文 fallback)

依据 `AGENTS.md` §12:pre-push / pre-commit hook 因其他 agent 引入的代码问题失败时,各 agent 各管各的,不在本任务范围内的预存问题不影响本任务交付。

### 4.2 第 2b 项 — `scan-i18n-zh-residue.mjs zh-TW`(简体字残留)

```bash
node scripts/scan-i18n-zh-residue.mjs zh-TW
```

结果:`✅ zh-TW.json 无中文残留`,exit 0。`系統` / `序號` / `資料項` 均为繁体。

### 4.3 第 2c 项 — `scan-i18n-zh-residue.mjs ko`(中文残留)

```bash
node scripts/scan-i18n-zh-residue.mjs ko
```

结果:`✅ ko.json 无中文残留`,exit 0。`시스템 팁` / `일련 번호` / `데이터 항목` / `수정 성공` 均为韩文。

### 4.4 第 2d 项 — `scan-i18n-zh-residue.mjs ja`(中文残留,warn-only)

```bash
node scripts/scan-i18n-zh-residue.mjs ja
```

结果:exit 0(warn-only,不阻塞)。新追加的 4 个 key 中:
- `システムヒント` / `シリアル番号` / `データ項目` / `変更成功` 均为合法日文(含日文汉字词与片假名),未触发新警告。

### 4.5 第 2e 项 — `check-i18n-broken-en.mjs`(破碎英文)

```bash
node scripts/check-i18n-broken-en.mjs
```

结果:`[broken-en] ✅ 通过 (0 处破碎英文)`,exit 0。新追加的 `System Tip` / `Serial Number` / `Data Item` / `Modified Successfully` 均为合法英文短语,无破碎机翻特征。

## 5. typecheck 验证

```bash
pnpm --filter @ihui/web typecheck
```

结果:exit 0,输出 `tsc --noEmit` 无错误。

```
> @ihui/web@0.0.0 typecheck G:\IHUI-AI\apps\web
> tsc --noEmit
```

## 6. 验证总结

| 验证项 | 命令 | 结果 |
| --- | --- | --- |
| JSON 有效性(5 文件) | `node -e "JSON.parse(...)"` | ✅ 全 OK |
| i18n key parity(本任务 4 key) | `findstr common.(systemTip\|serialNumber\|dataItem\|modifySuccess)` | ✅ 0 命中(无 parity 问题) |
| zh-TW 简体残留 | `scan-i18n-zh-residue.mjs zh-TW` | ✅ exit 0 |
| ko 中文残留 | `scan-i18n-zh-residue.mjs ko` | ✅ exit 0 |
| ja 中文残留 | `scan-i18n-zh-residue.mjs ja` | ✅ exit 0(warn-only) |
| en 破碎英文 | `check-i18n-broken-en.mjs` | ✅ exit 0 |
| web typecheck | `pnpm --filter @ihui/web typecheck` | ✅ exit 0 |

## 7. 后续建议(可选,非本任务范围)

- `check-i18n-keys.mjs` 的预存 parity 问题(537 admin 键 + 250 admin 缺失键 + 1166 未翻译键)建议另起任务统一处理,不属于本 common 4 key 补齐任务范围。
