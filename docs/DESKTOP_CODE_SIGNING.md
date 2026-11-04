<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 桌面端代码签名(Windows SignPath / macOS Developer ID)

> **最后更新**: 2026-11-03
> **适用范围**: `release-desktop.yml` 的 `desktop-v*` 发布链(tag push 或 workflow_dispatch)
> **落地文件**: `.github/workflows/release-desktop.yml`、`scripts/desktop-signing-chain.mjs`、`scripts/desktop-updater-sig-verify.mjs`、`.github/SECRETS.md`

**一句话结论**: Windows 走 **SignPath Foundation**(证书在 SignPath 的 HSM 里、CI 零私钥落地、按 release 人工审批),macOS 只能走 **Apple Developer ID Application + `notarytool` 公证 + staple**。任一平台凭据缺失时,`signature-gate` **必红**,`latest.json` **不更新**——未签名产物不得被读成一次成功发布。

---

## 0. 链路全景(对照代码时看这张表)

| # | 阶段 | Windows 步骤 / job | macOS 步骤 / job | 凭据依赖 | 失败后果 |
| --- | --- | --- | --- | --- | --- |
| ① | 出未签名产物 | `Build & Release`(tauri-action) | 同左 | 无 | build 红 |
| ② | 签名 | `Upload unsigned installer for signing` → `Submit SignPath signing request`(等人工审批,最长 3600s) → `Install signed installer, verify Authenticode, refresh updater signature` | `Export Apple signing credentials` → tauri 自动签名/公证/staple → `Notarize, staple and verify macOS bundles` | `SIGNPATH_*` 四项 / `APPLE_*` 三+三 | 步骤 throw ⇒ build 红,且 `Fallback upload` 拒绝上传 |
| ③ | 重算哈希与 `.sig` | 第二步同一步内完成(§4) | staple 后重建 `.app.tar.gz` 并重签 `.sig` | `DESKTOP_TAURI_PRIVATE_KEY` / `_PASSWORD` | 同左 |
| ④ | 独立复核 | `Signature Gate (windows-x64)` | `Signature Gate (macos-universal)` | 无(只读 artifact) | 门禁红 |
| ⑤ | 更新清单 | `publish-updater-json`(`needs: [build, signature-gate]`) | 同左 | `GITHUB_TOKEN` | 不生成 `latest.json` |

链路顺序本身就是判据,详见 §4。任何"把 gate 改绿"的改动都等于取消发布门禁。

---

## 1. 方案对比与选定

| 维度 | SignPath Foundation(开源免费) | Azure Trusted Signing | 自有 EV 证书直签 |
| --- | --- | --- | --- |
| 费用 | 免费(开源项目) | 按月计费(订阅 + 请求量) | 证书年费数千元 + USB token/HSM 硬件,通常还要买托管服务 |
| 私钥位置 | SignPath 的 **HSM**,任何人(含本仓库维护者)都拿不到 | Azure Key Vault 托管(需 Azure 订阅) | 本机 USB token / 本地 HSM,必须有人插着设备才能签 |
| 资格门槛 | 公开仓库 + OSI 认可许可证 + 项目说明,人工审核 | 需 Azure 订阅 + Trusted Signing Account + Identity Validation;**个人/个体户需可验证的 3 年经营历史**,中国区主体通常不满足资格 | 需 CA 对公司做 OV/EV 尽调,企业资质 + 年费 |
| CI 可用性 | 原生支持 `signpath/github-action-submit-signing-request`(本仓库已接) | 需 azure 凭据 + 对应 action | **托管式 CI 拿不到私钥** ⇒ 只能在自托管 runner + 插着 token 的机器上签 |
| 审批节奏 | 每次 release 在 SignPath UI 人工批准(Restricted policy) | 首次 Identity Validation 通过后基本自动化 | 无审批,但每次都得有硬件在场 |
| 证书主体 | `SignPath Foundation` | 你的组织名 | 你的公司名 |
| 本项目适配 | ✅ 已接 workflow、零私钥落地 | ❌ 资格大概率不满足 | ❌ CI 无法落地私钥 |

**选定结论**

- **Windows → SignPath Foundation**。理由不是"便宜",而是①`release-desktop.yml` / `release-cli.yml` 已经有 `signpath/github-action-submit-signing-request` 步骤,换方案等于重写签名段;②私钥在 SignPath HSM 里,**不存在"仓库/CI 泄漏私钥"这一档事故**;③免费计划对 Apache-2.0 开源项目开放。代价是每次发版要人工批准一次(§2.6)。
- **macOS → Apple Developer ID Application + `notarytool`**。这是 macOS 唯一可行的公开分发签名路径,没有第二条:自签证书不被 Gatekeeper 认,`codesign` 通过不代表用户能打开。费用 $99/年(§3.1)。

**为什么不用自签 / 不签名**

- Windows:未做 Authenticode 的 `.exe` 会撞 **SmartScreen**("Windows 已保护你的电脑"),下载转化直接掉,且用户需手动"更多信息 → 仍要运行";企业环境可能被策略直接拦。
- macOS:未签名/未公证的 `.app` 被 **Gatekeeper** 拦成"已损坏,应移到废纸篓",不是"点一下就能开"——用户根本无法自解。
- 本项目 CI 的立场是明确的:凭据缺失时 build 里的签名步跳过,但 `signature-gate` **判红**。**"不签"在本流水线里不是一个可发布状态**,它是失败状态(§5)。

---

## 2. Windows:SignPath 申请与配置

### 2.1 申请(一次性,审批周期通常数周)

1. 打开 <https://signpath.io/> → 找到 "Open Source" / SignPath Foundation 入口(表单页 <https://signpath.org/>)。
2. 表单必填项按下面这份准备(本项目 2026-10-20 已提交,可照抄口径):
   - 公开仓库地址:`https://github.com/IHUI-INF-AI/IHUI-AI`
   - 许可证:Apache-2.0(仓库根 `LICENSE`)
   - 项目说明:桌面端 Tauri(NSIS)安装包 `*-setup.exe` + CLI 的 `ihui.exe` 需要 Authenticode 签名
   - 维护者联系邮箱、项目主页(<https://aizhs.top>)、可引用的公开佐证(Product Hunt / dev.to / 收录页等,清单见 `docs/RELEASE.md` 的「申请表中已附的公开佐证」)
3. 提交成功会立刻收到 `SignPath Foundation Team <oss-support@signpath.org>` 的「Open Source Project Submitted」确认信;**审批周期官方口径是"几个工作日到数周"**,本项目实测提交后 1-2 周内无进一步消息属正常,不要重复提交。
4. 通过后会收到 Organization 邀请链接,用申请时的邮箱注册/登录 SignPath 账号并接受。

### 2.2 后台对象(创建顺序不能乱)

登录 SignPath 后按顺序建四样东西,**slug 必须与 GitHub Secrets 逐字一致**(大小写、连字符都算):

| 对象 | 建议 slug | 关键设置 | 对应 secret |
| --- | --- | --- | --- |
| Organization | (无 slug,只有 UUID) | 在 Organization settings 页复制 UUID | `SIGNPATH_ORGANIZATION_ID` |
| Project | `ihui-ai` | 关联上面的 Organization | `SIGNPATH_PROJECT_SLUG` |
| Signing Policy | `release-signing` | 勾选 **Restricted**(每次请求需人工批准;不勾就是"提交即签",等于放弃审批) | `SIGNPATH_SIGNING_POLICY_SLUG` |
| Artifact Configuration | `nsis-exe` | Artifact type = **Windows PE**;Packaging = **Single file**(回传裸 `.exe`) | (不是 secret,见下) |

Artifact Configuration 的两个细节:

- **Packaging 选 `Zip` 也兼容**:workflow 的 `Install signed installer, verify Authenticode, refresh updater signature (Windows)` 步骤先找 `signed-desktop/` 下的 `*.exe`,找不到就把 `*.zip` 全部 `Expand-Archive` 再找。两种都能跑通,选 `Single file` 少一步解压。
- **本项目 workflow 不传 `artifact-configuration-slug`**(见 `release-desktop.yml` 的 `Submit SignPath signing request` 步骤参数:只有 api-token / organization-id / project-slug / signing-policy-slug / github-artifact-id)。因此 SignPath 会走项目**默认**配置 ⇒ 必须把 `nsis-exe` 设为默认;项目下如果只有这一份配置,它天然是默认。

> 若 SignPath UI 提示 **Origin verification / Trusted build system**,选 **GitHub Actions** 并完成 GitHub App 授权——它校验"产物确实来自这次 GitHub Actions 构建",没配会被拒签。

### 2.3 生成 API Token

1. 右上角 **User Settings → API Tokens → Create token**。
2. 权限:scope 只勾**该 Organization**;角色选 **submitter**(提交签名请求用,不需要 policy 管理权限)。
3. 创建后**只显示一次**,立刻复制;丢了就重生成(旧 token 不会自动失效,记得 Revoke)。

### 2.4 GitHub Secrets(逐个填)

仓库 → Settings → Secrets and variables → Actions → New repository secret:

| Secret | 取值来源 | 说明 |
| --- | --- | --- |
| `SIGNPATH_API_TOKEN` | §2.3 的 token | submitter 权限 |
| `SIGNPATH_ORGANIZATION_ID` | Organization settings 页的 UUID | 不是名字,是 UUID |
| `SIGNPATH_PROJECT_SLUG` | §2.2 的 Project slug(如 `ihui-ai`) | 逐字一致 |
| `SIGNPATH_SIGNING_POLICY_SLUG` | §2.2 的 Signing Policy slug(如 `release-signing`) | 逐字一致 |
| `DESKTOP_WIN_SIGNER_SUBJECT` | 期望证书主体**子串** | SignPath Foundation 签发的证书主体含 `SignPath Foundation`;不填时 workflow 默认按 `SignPath Foundation` 断言。**将来换自有 EV 证书只改这一枚 secret,不动 workflow** |

判定逻辑(`build` job 的 job-level env):四项 `SIGNPATH_*` **全部非空** ⇒ `SIGNPATH_CONFIGURED=true` 才启用签名步骤;缺任意一项 ⇒ 整组跳过 ⇒ §5 的红色路径。

`DESKTOP_TAURI_PRIVATE_KEY` / `DESKTOP_TAURI_KEY_PASSWORD`(Tauri 更新签名私钥)**已经在用**,本方案不新增、也不轮换——它负责 `.sig` 重算(§4)。

### 2.5 填完之后如何验证

1. GitHub → Actions → **Release Desktop** → **Run workflow**,`ref=main`,`tag=desktop-vX.Y.Z`(workflow_dispatch 比 push tag 稳,原因见 `docs/RELEASE.md` 的"触发方式铁律")。
2. 打开 `Build Desktop (windows-x64)` job,按顺序应能看到:
   - `Upload unsigned installer for signing (Windows)` —— 上传 `unsigned-desktop-windows-x64` artifact;
   - `Submit SignPath signing request (Windows)` —— 这里会**停在等待人工审批**(最长 `wait-for-completion-timeout-in-seconds: 3600`);此时去 SignPath UI 批准(§2.6);
   - `Install signed installer, verify Authenticode, refresh updater signature (Windows)` —— 日志里应出现 `签名前: SHA256=... / <n> 字节` 与 `签名后: SHA256=... / <m> 字节`(两个哈希必须不同)、`签名者: CN=SignPath Foundation...`;随后是 `.sig` 重算与公钥验签;
   - `Upload signed installer + signature manifest (Windows)` —— 上传 `signed-desktop-windows-x64`(签名后 exe + 同名 `.sig` + `signature-manifest.json`)。
3. 等 `Signature Gate (windows-x64)` 变绿。它的 job summary 会打印:下载物的 **SHA256**、**签名者 subject**、**Authenticode=Valid / 证书链通过 / 时间戳存在**、**更新器 `.sig` 与安装包字节匹配**。
4. 只有 gate 绿了,`publish-updater-json` 才会跑并更新 `latest.json`。

常见"看起来绿了但没签"的坑:只看 build job 的绿勾。**判据永远是 `Signature Gate` 那一格**,以及它 Summary 里那四行。

### 2.6 每次发布的人工审批(持续义务)

- Restricted policy 下,**每一次**签名请求都要在 SignPath UI → 项目 → Signing requests 里点批准,不是配置一次后全自动。
- 排队/无人批准时,`Submit SignPath signing request` 会一直等,最长 1 小时(workflow 已把默认 600s 提到 **3600s**);超时后该步骤失败 ⇒ build 红 ⇒ 不会上传签名产物。
- 实操建议:发版时先触发 workflow,看到该步骤进入 waiting 状态就去 SignPath 点批准,别等 1 小时。

---

## 3. macOS:Apple Developer Program 申请与配置

### 3.1 注册

1. 打开 <https://developer.apple.com/programs/> → Enroll。
2. 费用:个人/公司 **$99/年**(人民币约 **¥688/年**,以官网结算页为准)。
3. 前置:Apple ID(建议用公司邮箱)+ **双重认证**已开启;公司账号还需要 **D-U-N-S 编号**(免费申请,审核约 1-2 周);个人账号不需要 D-U-N-S。
4. 账号类型影响签名身份显示:个人显示 `Developer ID Application: <姓名> (<TEAMID>)`,公司显示 `Developer ID Application: <公司名> (<TEAMID>)`——`APPLE_SIGNING_IDENTITY` 必须与 `security find-identity` 的输出**逐字一致**。

### 3.2 生成 Developer ID Application 证书(本机钥匙串)

1. <https://developer.apple.com/account> → **Certificates, Identifiers & Profiles** → **Certificates** → **+** → 选 **Developer ID Application** → Continue。
2. 本机打开 **钥匙串访问** → 菜单「证书助理」→「从证书颁发机构请求证书」→ 选「存储到磁盘」→ 得到 `CertificateSigningRequest.certSigningRequest`。
3. 回到网页上传该 CSR → 下载 `developerID_application.cer`。
4. 双击 `.cer` 导入「登录」钥匙串 → 在「我的证书」里确认这条证书**展开后有私钥**(没有私钥就是导入错了或 CSR 不是这台机器生成的)。
5. 选中证书 → 右键「导出…」→ 格式 **个人信息交换(.p12)** → 文件名 `DeveloperID.p12` → 设置**导出密码**(这就是 `APPLE_CERTIFICATE_PASSWORD`)。
6. 自检身份字符串:

   ```bash
   security find-identity -v -p codesigning
   # 1) ABCDEF...  "Developer ID Application: <名称> (TEAMID)"
   ```

   把引号内的整串填进 `APPLE_SIGNING_IDENTITY`。

### 3.3 导成单行 base64

```bash
# macOS
base64 -i DeveloperID.p12 | tr -d '\n' > DeveloperID.p12.b64
# Linux(CI/容器里)
base64 -w0 DeveloperID.p12 > DeveloperID.p12.b64
```

**必须单行**(`tr -d '\n'` 不能省):workflow 是把 secret 原样写进 `GITHUB_ENV` 的 `APPLE_CERTIFICATE=...`,多行会把后续行当成别的环境变量,tauri 侧表现为"导入证书失败"。

自检(能解回一个可读的 p12 才算合法):

```bash
base64 -d DeveloperID.p12.b64 > /tmp/check.p12
openssl pkcs12 -info -in /tmp/check.p12 -noout -passin pass:'<导出密码>'
```

### 3.4 App 专用密码(notarytool 用)

1. <https://appleid.apple.com/> → 登录 → **登录与安全** → **App 专用密码** → **+**。
2. 名字随意(如 `ihui-notary`)→ 得到 `xxxx-xxxx-xxxx-xxxx`。
3. 这就是 `APPLE_PASSWORD`。**不能用 Apple ID 主密码**,也不能用"应用专用 ID"。

### 3.5 GitHub Secrets(逐个填;公证通道 A/B 二选一)

**基础三件(缺一即视为未配置)**

| Secret | 取值来源 | 说明 |
| --- | --- | --- |
| `APPLE_CERTIFICATE` | §3.3 的单行 base64 | 不要带换行、不要带 `-----BEGIN` 之类的包裹 |
| `APPLE_CERTIFICATE_PASSWORD` | §3.2 第 5 步的导出密码 | p12 的密码,不是 Apple ID 密码 |
| `APPLE_SIGNING_IDENTITY` | §3.2 第 6 步 `security find-identity` 的输出 | 形如 `Developer ID Application: <公司名> (<TEAMID>)` |

**公证通道 A(App ID + App 专用密码,推荐)**

| Secret | 取值来源 |
| --- | --- |
| `APPLE_ID` | Apple ID 邮箱 |
| `APPLE_PASSWORD` | §3.4 的 App 专用密码 |
| `APPLE_TEAM_ID` | 10 位 Team ID(<https://developer.apple.com/account> → Membership 页可见) |

**公证通道 B(App Store Connect API Key,可选替代)**

| Secret | 取值来源 |
| --- | --- |
| `APPLE_API_KEY` | App Store Connect → 用户与访问 → 密钥 → **Key ID**(注意:填 Key ID,不是 `.p8` 文件名) |
| `APPLE_API_ISSUER` | 同页的 **Issuer ID**(UUID 形态) |
| `APPLE_API_KEY_PATH` | `.p8` 文件在 **runner 上的路径**;本仓库**没有内置把 `.p8` 落盘/解码的步骤**,走 B 必须自己在前置步骤里把文件写到这个路径 |

**A/B 规则**(workflow 的 `APPLE_SIGNING_CONFIGURED` 表达式,别猜):

```
APPLE_CERTIFICATE && APPLE_CERTIFICATE_PASSWORD && APPLE_SIGNING_IDENTITY
  && ( (APPLE_ID && APPLE_PASSWORD && APPLE_TEAM_ID)        // 通道 A
     || (APPLE_API_KEY && APPLE_API_ISSUER && APPLE_API_KEY_PATH) )  // 通道 B
```

- **二选一即可**,不需要两套都配;两套都配时 workflow 优先走 **A**(`Export Apple signing credentials` 里 `if [ -n "${IN_APPLE_ID}" ]` 分支在前,B 走 `else`)。
- 只配证书、不配公证 ⇒ `APPLE_SIGNING_CONFIGURED` 仍为 `false`(刻意设计:只签名不公证的产物在 Gatekeeper 下照样被拦,"看起来签了、装上仍报损坏"比不签更难排查)。

### 3.6 填完之后如何验证

1. 触发 `Release Desktop`(同上,workflow_dispatch + `tag` 输入)→ 打开 `Build Desktop (macos-universal)` job。
2. 顺序应看到:
   - `Export Apple signing credentials (macOS)` —— summary 一行 `Apple 签名凭据已导出(证书 + Apple ID 公证 / App Store Connect API Key 公证)`;这一步把凭据写进 `GITHUB_ENV`,**不能**改成直接在 `Build & Release` 的 env 里塞 secrets(未配置的 secret 会注入成空串,Tauri 看到 `APPLE_CERTIFICATE=""` 会把构建弄红);
   - `Build & Release` —— tauri 用 `APPLE_*` 自动 codesign + notarytool + staple;
   - `Notarize, staple and verify macOS bundles` —— 日志打印签名对象、`Authority=Developer ID Application ...`、`TeamIdentifier=`、app/dmg 的公证状态与 id、DMG SHA256;`.app` 上没有 staple 票据时会现场 zip → submit → staple → **重建 `.app.tar.gz` 并重签 `.sig`**;
   - `Upload signed macOS bundles + signature manifest` —— 上传 `signed-desktop-macos-universal`。
3. 等 `Signature Gate (macos-universal)` 绿。它做的是:挂载 DMG 取里面用户真正拖进 Applications 的 `.app` → `codesign -dv` 断言 `Authority=Developer ID Application`、`flags=0x10000(runtime)`(hardened runtime)、`codesign --verify --deep --strict` → 读 `signature-manifest.json` 断言 `dmgNotarization.status == "Accepted"` 且 `stapled === true` → `stapler validate` + `spctl --assess`(execute 与 open 两个判据)→ 用 `scripts/desktop-updater-sig-verify.mjs` 验 `.app.tar.gz` 的 `.sig`。
4. gate 绿后 `publish-updater-json` 才会更新 `latest.json`。

---

## 4. 更新器一致性(为什么顺序不能变)

Tauri 自动更新用 **minisign `.sig`** 校验**文件字节**;Authenticode / code signature 都会**改字节**。所以顺序是:

1. **先签名**(②),签名一定会改变文件字节(Windows 侧 workflow 还会显式断言 `签名前 SHA256 != 签名后 SHA256`,相同即 throw:说明回传物根本没替换成签名版)。
2. **对签名后的字节重算 SHA256 / 字节数**,写进 `signature-manifest.json`(`sha256` / `bytes` / `unsignedSha256` 对照)。gate 会重新下载产物再算一遍,与清单逐字节比对——防"清单是新的、包是旧的"。
3. **用同一份字节跑 `tauri signer sign`** 重算同名 `.sig`。`tauri-action` 在打包阶段生成的那份 `.sig` 覆盖的是**未签名**的字节,签名一覆盖就失效。
4. **独立 runner 用 `tauri.conf.json` 的 pubkey 验签**(`node scripts/desktop-updater-sig-verify.mjs --artifact ... --signature ....sig --config apps/desktop/src-tauri/tauri.conf.json`)。这一步不是在"信任 build job 的自述",而是用**已分发客户端里的那把公钥**去验:能验过,才说明已装客户端也能验过。
5. **只有 gate 绿了才生成 `latest.json`**:`publish-updater-json.needs: [build, signature-gate]`。少了这条依赖,未签名/未公证的包会照样被写进更新清单,已装客户端自动升级后验签失败/被 Gatekeeper 拦。

**为什么不能"签完 exe 就算完"**:已安装客户端只认 `.sig` 覆盖的那份字节。签名覆盖 exe 后不重算 `.sig` ⇒ 客户端下载到的新包与 `.sig` 不匹配 ⇒ **全体客户端的自动更新全部失败**,且表现为"更新永远失败/更新后打不开",排查成本远高于"这次不发版"。所以 workflow 里 `.sig` 重算失败是**硬失败**(`throw`),没有跳过余地;`Fallback upload` 在"已配置凭据但签名步失败"时也会 **exit 1 拒绝上传**,不让"新包配旧签名"外溢到 Release。

**macOS 为什么特殊**:`staple` 会把公证票据写进 `.app`,**改变了 `.app` 的字节**。所以 `Notarize, staple and verify macOS bundles` 在补做公证后会 `rm -f` 旧的 `.app.tar.gz` 与 `.sig`,用 **staple 后**的 app 重新 `tar -czf` 打包,再 `tauri signer sign` 重签,并立刻用 `desktop-updater-sig-verify.mjs` 验证。若沿用 tauri 打包阶段那份 `.app.tar.gz`(staple 之前生成的),更新器拿到的字节与 `.sig` 就对不上。

---

## 5. 无凭据时的行为(必须按这个口径理解 CI)

| 平台 | job env | build 内发生了什么 | `signature-gate` | `latest.json` | GitHub Release |
| --- | --- | --- | --- | --- | --- |
| Windows | `SIGNPATH_CONFIGURED=false`(四项 `SIGNPATH_*` 未齐) | 签名三步整体跳过;`Report unsigned fallback (Windows)` 打 `::warning::` 并在 Summary 写「未签名 / signature-gate 会因此判红」 | `Assert signed artifact present` 找不到 `signature-manifest.json` ⇒ `::error::未签名(windows-x64):...` 并 **exit 1(红)** | **不更新**(`needs: [build, signature-gate]` 不满足) | **仍可能留有未签名 `*-setup.exe`**:`Fallback upload bundle files to Release` 是 `if: always()`,只在"已配凭据但签名失败"时才拒绝上传 |
| macOS | `APPLE_SIGNING_CONFIGURED=false` | 签名/公证步整体跳过;`Report unsigned / un-notarized fallback (macOS)` 打 `::warning::` + Summary「未签名 / 未公证」 | `Assert signed artifact present` ⇒ `::error::未签名(macos-universal)` **exit 1(红)** | **不更新** | 同左,可能留有未签名 `.dmg` / `.app.tar.gz` |

由此得到三条操作口径:

1. **红不等于"构建坏了"**,它是"这次发布没完成"的显式表达。gate 的注释写明:这是刻意设计,**不得用任何开关把它改绿**。
2. **已装客户端不会收到未签名包**(`latest.json` 没更新,更新端点 <https://aizhs.top/desktop-feed.json> 仍指向上一版)。但 **GitHub Release 里可能已经有未签名资产** ⇒ "Release 上有 exe" **不等于**"这一版可以发布/可以烘焙进更新源"。发布前必须确认 `Signature Gate` 是绿的。
3. **`DESKTOP_ALLOW_UNSIGNED=1` 不是 CI 开关**。它只作用于**本机**的桌面端打包链路(`DESKTOP_ALLOW_UNSIGNED=1 pnpm --filter @ihui/desktop build`;根 `package.json` 里没有 `desktop:bundle` 这个别名,实现见 `scripts/desktop-build.mjs` → `scripts/desktop-artifact-single.mjs` 的收敛钩子与 `scripts/lib/desktop-unsigned-config.mjs`,它改的只是临时 config 里的 `bundle.createUpdaterArtifacts: false`),用途是"本机没私钥也要产出自测包"。**它不能用于放行未签名发布,CI 中禁止出现该变量**(校验命令见 §6)。

---

## 6. 本地如何复核

无凭据环境下**不可能**验证真实签名(没有证书就没有可验的签名对象;Windows 本机 `signtool verify` 只会对未签名 exe 报 `NotSigned`,macOS 本机 `spctl` 只会拒绝没有公证票据的 app)。本地能验的是**链路配置与脚本自身**:

```bash
# 1) 链路静态检查:workflow 的签名步骤顺序、secrets 引用名、gate 与 publish-updater-json 依赖、文档口径
node scripts/desktop-signing-chain.mjs

# 2) 用夹具正反例自证检查器本身没错(改判据后必须重跑)
node scripts/desktop-signing-chain.mjs --self-test

# 3) 更新器 .sig 验签器的自证(minisign 公钥解析 / 字节不匹配必须报错)
node scripts/desktop-updater-sig-verify.mjs --self-test

# 4) YAML 语法(把"改坏缩进"挡在 commit 之前)
python -c "import yaml; yaml.safe_load(open('.github/workflows/release-desktop.yml', encoding='utf-8')); print('yaml ok')"

# 5) workflow 语义 lint(需本机已装 actionlint: https://github.com/rhysd/actionlint)
actionlint .github/workflows/release-desktop.yml

# 6) 确认 CI 里没有本地豁免开关的真实使用(只出现在注释里不算;输出为空即合格)
grep -rn 'DESKTOP_ALLOW_UNSIGNED' .github/workflows/ | grep -v '#' || echo 'CI 内无 DESKTOP_ALLOW_UNSIGNED ✓'
```

说明:

- 第 1、2、3 条依赖仓库内的 `scripts/desktop-signing-chain.mjs` / `scripts/desktop-updater-sig-verify.mjs`。若报 `Cannot find module`,说明当前分支没带上这两个脚本——**先补齐再谈验收**,不要用"本机没凭据"当跳过复核的理由。
- 第 4-6 条在任何机器上都能跑,改完 workflow 必须至少跑到这三条。
- 真签名只能在**配好凭据的 CI**里验:build job 的自检证明"我签了这份",`Signature Gate` 在**另一台 runner** 上证明"用户下载到的那份字节确实签了"。两者都不是本地能替代的。

---

## 7. 故障排查

| 现象 | 常见原因 | 处置 |
| --- | --- | --- |
| SignPath 回传的是 `zip` 而不是 `exe` | Artifact Configuration 的 Packaging 选了 `Zip` | workflow 会自动 `Expand-Archive` 再找 exe,**无需改 workflow**;若解压后仍无 exe,是 artifact configuration 里没把 `*-setup.exe` 列为签名对象 |
| `签名回传物里没找到安装包` | artifact configuration 的 PE 过滤规则不匹配本仓库产品名(中文 `智汇AI` + `-setup.exe`) | 在 SignPath 里按 **文件名后缀** `-setup.exe` 匹配,别按产品名精确匹配 |
| `签名前后字节完全相同` | 回传物没替换(签的不是这份产物,或 configuration 把原始文件原样返回) | 检查 Artifact Configuration 的 "sign" 动作是否真的配置了 PE 签名项 |
| `signtool verify /pa` 失败 | ① 回传的 exe 没带**完整证书链**(根/中间证书缺失);② **没有 RFC3161 时间戳**(证书过期后已发放的包会失去可信时间) | ① 在 SignPath 侧确认回传物包含完整链;② 确认 SignPath 的签名请求带了时间戳(Foundation 计划默认带);本机排查可用 `Get-AuthenticodeSignature` 看 `Status`/`StatusMessage` |
| `签名者主体与期望不符` | 证书主体与 `DESKTOP_WIN_SIGNER_SUBJECT` 不一致(换了证书/换了计划) | 改 secret 即可,不用动 workflow;Foundation 计划保持 `SignPath Foundation` |
| `Submit SignPath signing request` 超时(3600s) | Restricted policy 没人在 SignPath UI 批准 | 去 SignPath UI 批准;确属排队可重跑该 job |
| 请求被拒(401/403) | token 权限/组织不匹配,或 slug 拼错 | 重生成 submitter token;逐个核对 4 个 slug/UUID 与 secret 逐字一致 |
| macOS `spctl` 拒绝(`source=Unnotarized Developer ID` 等) | `.app` 不是 Developer ID 签名 / 缺 hardened runtime / 公证未 `Accepted` / 没 staple | `codesign -dv --verbose=4` 看 `Authority=` 与 `flags=0x10000(runtime)`;`xcrun stapler validate` 看票据;公证状态必须是 `Accepted` |
| `未使用 Developer ID Application 证书签名` | 导入的是 Apple Development / 自签证书 | 重新按 §3.2 生成 **Developer ID Application** 证书,p12 与身份字符串都要换 |
| `证书身份与 APPLE_SIGNING_IDENTITY 不符` | secret 里的字符串与 `security find-identity` 输出不逐字一致(常见:少了 `(TEAMID)` 或多空格) | 用 `security find-identity -v -p codesigning` 的输出整串复制 |
| `APPLE_SIGNING_CONFIGURED` 一直是 `false` | 只配了证书,公证三件套没齐(或 B 通道缺 `APPLE_API_KEY_PATH`) | 按 §3.5 补齐 A 或 B 的**三条** |
| `.sig` 验签失败 | ① `.sig` 用的是**签名前**的字节(没重算);② 上传的 exe 与 `.sig` 不成对(同名不同字节);③ `DESKTOP_TAURI_PRIVATE_KEY` 与 `tauri.conf.json` 的 pubkey 不配对 | ① 重跑签名链,确认"重算 `.sig`"步骤在覆盖之后;② 重新上传成对资产;③ 私钥/公钥配对问题按 `docs/RELEASE.md` 的"禁止生成新密钥对"口径处理(取回原私钥,不轮换) |
| gate 报 SHA256/字节数不一致 | artifact 被二次改写(上传后又跑了打包/压缩),或清单与包不是同一轮产物 | 保证"清单生成 → 上传 → gate 下载"之间没有任何步骤再动文件 |

---

## 8. 填表操作单(填进去就能发版)

### 8.0 前置自检(fail-fast)

`release-desktop.yml` 的 build job 在**建链审计之后、编译之前**跑一步
`Preflight desktop signing credentials`(`id: signing-preflight`),执行
`node scripts/desktop-signing-preflight.mjs --platform "${{ runner.os }}"`:

- 只判"在不在"(trim 后非空),**绝不打印任何值**,连长度/前缀都不打;
- 缺项时一次性列出**全部**缺失的 secret 名,`::error::签名凭据缺口(平台=windows,缺 6/6): ...`,随后 job 红;
- 齐备时打印 `签名凭据已就绪 N/N(平台=windows)` 继续走。

平台口径:Windows 要 SignPath 四件 + Tauri 两枚;macOS 要 Apple 证书三件 + 公证通道**整组**三件 + Tauri 两枚;
Linux 无代码签名,只要 Tauri 两枚(只影响 updater `.sig`)。本地复跑:

```bash
node scripts/desktop-signing-preflight.mjs --platform windows   # 缺项 → rc 1
node scripts/desktop-signing-preflight.mjs --self-test          # 判据自检 → rc 0
```

### 8.1 每个 secret:谁产生 / 前置条件 / 缺它失败在哪 / 放哪

| secret | 产生方 | 前置条件(账号/资质/费用) | 缺它时失败在哪 | 放哪 |
| --- | --- | --- | --- | --- |
| `SIGNPATH_API_TOKEN` | SignPath 用户设置 → API Tokens(submitter) | SignPath 账号 + 已加入 Organization | `signing-preflight` 立即红;配了别的三项也签不了 | repo secret |
| `SIGNPATH_ORGANIZATION_ID` | SignPath Organization settings(UUID) | 同上 | 同上;`Submit SignPath signing request` 403 | repo secret |
| `SIGNPATH_PROJECT_SLUG` | SignPath Project slug | 申请通过(公开仓库 + Apache-2.0,人工审核数周) | 同上;请求 404 | repo secret |
| `SIGNPATH_SIGNING_POLICY_SLUG` | SignPath Signing Policy slug(Restricted) | 同上 | 同上;请求 404 | repo secret |
| `DESKTOP_WIN_SIGNER_SUBJECT`(可选) | 自己填证书主体子串 | 无 | 签名者断言失败(`签名者主体与期望不符`) | repo secret |
| `APPLE_CERTIFICATE` | Apple Developer → Certificates(Developer ID Application → 导出 .p12 → 单行 base64) | Apple Developer Program **$99/年**;公司号需 D-U-N-S | `signing-preflight` 立即红;`Export Apple signing credentials` 不跑 | repo secret |
| `APPLE_CERTIFICATE_PASSWORD` | 导出 .p12 时自设 | 同上 | 同上 | repo secret |
| `APPLE_SIGNING_IDENTITY` | `security find-identity -v -p codesigning` 整串 | 同上 | 同上;`codesign` 报身份不符 | repo secret |
| `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID`(通道 A) | appleid.apple.com → App 专用密码 | 同上 | preflight 报"两组通道全缺";公证 401 | repo secret |
| `APPLE_API_KEY` / `APPLE_API_ISSUER` / `APPLE_API_KEY_PATH`(通道 B) | App Store Connect → Users and Access → Keys | 同上 | 同上 | repo secret |
| `DESKTOP_TAURI_PRIVATE_KEY` / `DESKTOP_TAURI_KEY_PASSWORD` | **已存在**(2026-09-16 建,勿轮换) | 无 | preflight 红;`.sig` 无法重算 | repo secret(已有) |

Windows 与 macOS 各自独立:只填 SignPath → Windows 能签、macOS 照旧"未公证"红;只填 Apple → 反之。
`signature-gate` 是硬阻断(`publish-updater-json.needs: [build, signature-gate]`),任一平台没签/没公证都不出 `latest.json`。

### 8.2 填入命令(占位符,别把真值写进任何文件)

```bash
gh secret set SIGNPATH_API_TOKEN           --body "<VALUE>"
gh secret set SIGNPATH_ORGANIZATION_ID     --body "<VALUE>"
gh secret set SIGNPATH_PROJECT_SLUG        --body "<VALUE>"
gh secret set SIGNPATH_SIGNING_POLICY_SLUG --body "<VALUE>"
gh secret set APPLE_CERTIFICATE            --body "<VALUE>"   # .p12 单行 base64
gh secret set APPLE_CERTIFICATE_PASSWORD   --body "<VALUE>"
gh secret set APPLE_SIGNING_IDENTITY       --body "<VALUE>"
gh secret set APPLE_ID                   --body "<VALUE>"   # 通道 A(每条各设一次)
gh secret set APPLE_PASSWORD             --body "<VALUE>"
gh secret set APPLE_TEAM_ID              --body "<VALUE>"
gh secret set APPLE_API_KEY              --body "<VALUE>"   # 通道 B(与 A 二选一)
gh secret set APPLE_API_ISSUER           --body "<VALUE>"
gh secret set APPLE_API_KEY_PATH         --body "<VALUE>"
```

### 8.3 两条路径与解锁范围

- **最小可行路径**:SignPath 四件 → Windows 安装包 Authenticode 签名(解 SmartScreen);Apple 证书三件 + 通道 A 三件 → macOS 签名+公证+staple。
  解锁:Windows `-setup.exe` 与 macOS `.dmg`/`.app.tar.gz` 全部可发布,`latest.json` 恢复更新。
- **完全路径**:另建 `release` environment,把上述 secret 放进 environment 并要求人工审批,配合 SignPath 的 Restricted policy 形成"双人可见"的发版闸。
  解锁:同一批产物 + 每次发版多一道环境审批;不改变产物字节,只改变"谁有权触发"。

### 8.4 怎么验证接线(不需要真的发版)

1. `gh workflow run release-desktop.yml --ref main -f tag=desktop-v<TEST>`(用临时 tag,事后删 release/tag)。
2. 看 `Build Desktop (windows-x64)` 最上面的 `Preflight desktop signing credentials`:
   未配齐时**1 分钟内**就红,日志是 `签名凭据缺口(平台=windows,缺 N/6): <名字列表>`;
   配齐后是 `签名凭据已就绪 6/6`。
3. 再往下看 `Submit SignPath signing request` 进入 waiting(去 SignPath UI 批准)、
   `Install signed installer, verify Authenticode` 打印"签名前/签名后 SHA256 与字节数"且两值不同。
4. 最后看 `Signature Gate (windows-x64)` / `(macos-universal)`:这两格才是发布判据。

### 8.5 常见坑

- **p12 密码**:`APPLE_CERTIFICATE_PASSWORD` 是导出 .p12 时设的密码,不是 Apple ID 密码,也不是 App 专用密码。
- **证书类型**:必须是 `Developer ID Application`;Apple Development / 自签会让 `codesign` 过而 Gatekeeper 仍拦。
- **identity 字符串**:`APPLE_SIGNING_IDENTITY` 要含 `(TEAMID)`,多一个空格就"身份不符"。
- **Team ID vs bundle id**:`APPLE_TEAM_ID` 是 10 位团队号;`tauri.conf.json` 的 `identifier`(`com.ihui.desktop`)是 bundle id,两者别混。
- **SignPath 两个 slug**:`PROJECT_SLUG` 与 `SIGNING_POLICY_SLUG` 是两样东西,拼错分别报 404;`ORGANIZATION_ID` 是 UUID 不是名字。
- **Base64 必须单行**:多行会把 `$GITHUB_ENV` 后续行当别的变量,表现为"导入证书失败"。
- **不要轮换 Tauri 私钥**:它与 `tauri.conf.json` 的 `pubkey` 绑定,轮换会让已安装客户端验签失败。

## 9. 相关文档

- `.github/SECRETS.md` —— 每个 secret 的名称/用途/必填条件/申请入口速查表
- `docs/RELEASE.md` —— 桌面端发版流程与更新器第一数据源烘焙步骤
- `apps/desktop/README.md` —— 本机无签名私钥时打包(`DESKTOP_ALLOW_UNSIGNED=1`)的边界
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
