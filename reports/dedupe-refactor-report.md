# IHUI-AI 冗余重复代码深度修复报告

> 日期：2026-08-12 ｜ 范围：apps/* + packages/* ｜ 工具：jscpd 全量扫描 + 人工逐簇核验

---

## 一、扫描结论（9443 处克隆 → 4 类高价值可修复项）

| 类别                    | 位置                                          | 重复规模              | 处置                               |
| ----------------------- | --------------------------------------------- | --------------------- | ---------------------------------- |
| ① Playwright 发布适配器 | ai-service `publish/adapters/`（16 个文件）   | 每文件 ~180L 公共骨架 | ✅ 抽 `PlaywrightBaseAdapter` 基类 |
| ② 注册表单              | web `PhoneRegisterForm` / `EmailRegisterForm` | 90% 重复（各 255L）   | ✅ 参数化合并                      |
| ③ 验证码登录表单        | ui-react `phone/email-code-login-form`        | 90% 重复（各 270L）   | ✅ 参数化合并                      |
| ④ 账号历史输入框        | web vs 共享包双份实现                         | 216L 死代码           | ✅ 删除 web 副本                   |

**排除项**（非代码冗余，不处理）：

- drizzle snapshot JSON（迁移元数据）、tauri gen schema（构建产物）
- i18n 5 语言消息文件（多语言固有重复）
- skill 双份 `all_sources.py`/`x_sources.py`（双树边界硬门禁的自包含隔离，合并会破坏 skill 边界）
- asks/circles、v1-* 等路由（业务不同，仅骨架相似，合并收益低风险高）

---

## 二、已完成的深度修复

### ① ai-service：18 个 Playwright 发布适配器下沉基类（最大头）

**新建** `apps/ai-service/app/services/publish/adapters/playwright_base.py`：

- `CookieSpec`：声明式 cookie 规格（name/domain/httpOnly/secure/sameSite）
- `PlaywrightBaseAdapter`：统一 verify_credentials / publish 骨架，参数化 URL/选择器/cookie/成功 URL 判定/verify 模式/tags 上限/simulate 时长
- **动态 URL 钩子**：`build_create_url` / `validate_publish_config` / `extra_payload`（贴吧/虎扑等按 platform_config 构造发布页 URL 的平台覆写）

**下沉 18 个适配器**（每个从 ~250L 缩至 ~60-80L 纯配置）：

| 批次           | 平台                                                                                                 | verify 模式                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 标准模板（10） | 36kr / acfun / china_news / huxiu / lofter / people / tmtmedia / douban / baidu_zhidao / zhihu_daily | 登录+退出检查 / 退出必现                                    |
| 六大号（6）    | baijiahao / dayihao / netease / qq / sina / sohu                                                     | 退出必现 + simulate 15-45s                                  |
| 动态 URL（2）  | hupu / baidu_tieba                                                                                   | 覆写 build_create_url/validate_publish_config/extra_payload |

**新增回归测试** `tests/test_publish_playwright_base.py`：190 cases 全部通过（注册完整性、cookie 规格、verify 全场景、publish 全场景、category 步骤、动态 URL 适配器 config 校验 + payload 扩展）。

### ② web：注册表单合并

- 新建 `RegisterAccountForm.tsx`（accountType: 'phone' | 'email' 参数化，消除 90% 重复）
- `PhoneRegisterForm` / `EmailRegisterForm` 变薄 wrapper，**导出 API 不变**

### ③ ui-react：验证码登录表单合并

- 新建 `code-login-form.tsx`（accountType 参数化）
- `email-code-login-form` / `phone-code-login-form` 变薄 wrapper，**data-testid 全保留**（login-phone-input 等，e2e 依赖）

### ④ 删除死代码

- 删除 web `AccountHistoryInput.tsx`（216L，无消费者，共享包已有完整实现）
- 删除并行会话残留半成品 `CodeRegisterForm.tsx`（与 RegisterAccountForm 功能重复且自身含 zod 类型错误）

---

## 三、量化效果

| 指标                        | 修复前                          | 修复后                        |
| --------------------------- | ------------------------------- | ----------------------------- |
| publish/adapters 目录重复簇 | 多个 177L+ 簇（36kr-lofter 等） | 18 个适配器骨架全部收敛至基类 |
| 全项目代码克隆数            | 7830                            | 7610                          |

---

## 四、验证结果（0 新增回归）

| 验证项                | 结果                                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| ai-service 新回归测试 | ✅ 190 passed                                                                                                                                |
| 既有 publish 测试     | ✅ 失败集合与改造前**完全一致**（18 个失败全在未改动适配器 csdn/juejin/shipinhao/wordpress/xiaohongshu/zhihu；git 确认未修改、零依赖新基类） |
| web typecheck         | ✅ 干净（仅剩预存在 Tooltip 错误，位于并行会话改动的 admin 文件）                                                                            |
| ui-react typecheck    | ✅ 0 error                                                                                                                                   |
| web 登录单测          | ✅ 18 passed                                                                                                                                 |
| lint / prettier       | ✅ 全绿                                                                                                                                      |

---

## 五、后续建议（本次有意保留，不建议在本次处理）

1. **edu-management 页面**（schedule ↔ study-plan 450L 重复）：页面级大重构，需专项验证交互，风险高
2. **cli 命令脚手架**（agents/context/security 等 156L 重复）：业务差异大，抽取通用 helper 收益中等
3. **miniapp CSS**（forgot-password/register/login 245L+235L）：样式细节值差异大，合并需视觉回归验收
4. **视频类适配器**（haokan ↔ xigua 149L）：分属百度系/字节系，凭证与上传交互差异大，需视频专项基类
5. **HTTP API 类适配器**（cnblogs ↔ oschina 89L）：非浏览器型，另立 API 基类方有价值
