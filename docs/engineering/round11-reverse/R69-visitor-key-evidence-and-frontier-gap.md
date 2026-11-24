<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R69 · visitor 键分支：前沿两结构的字段**集合**到手，顺序与 arity 缺口仍开

> 对象：`codex.exe`（OpenAI Codex 26.1111.2228.0，Rust PE，382,514,992 B）
> 前序：R68 用「`&'static str` 胖指针 = 16 字节 `(ptr,len)` 记录数组」把 44 结构做到 44/44 自证，并回收 `ConfigRequirementsToml` 46 字段；R67 仍留 `ThreadStartParams`(27) / `TurnStartParams`(28) 两枚前沿。
> 本轮把这两枚的四条候选路线全部实测：一条失败到底、一条只给集合、一条给出错误结论（多结构混合）。

## 1. 结论先行

1. **记录数组法对这两枚彻底无效**：把 R68 扫描器在三个方向放宽后——**合并 `.data` 段**、**允许单字符字段名**、**允许 `ptr` 跨段**——run 总数 15,234 → **17,134**，长度 27 的仍只有 1 条（芬兰语词形 `olla/olen/olet…`）、长度 28 只有 3 条（agent 操作码、orchestrator 错误码、斯洛文尼亚语介词）。**没有一条是字段表** ⇒ 这两枚结构没有 serde `FIELDS` 数组（它们只 derive 了 `Debug`，模板 `struct X with N elements` 是 Debug 的格式串）。
2. **代码顺序字面量法失败**：引用两枚模板的函数各只有 1 个（Thread `0x145800120..0x145808ea8`、Turn `0x145772930..0x14577e0e7`），函数内 84 / 89 个 `lea` 站点里绝大多数指向 **serde 桩的 panic 文本**（`MapAccess::next_value called before next_key` + `serde-1.0.228/src/private/de.rs`），不是字段名。
3. **字典 DP 切分法失败**：字段名在池里是**无分隔连排**（`turnIditemoutputDeferred…`），用 R65 的 20,287 词字典做精确切分，两个池（158 B / 348 B）得 **0 个合法切分**——字典无法在没有边界信号时区分 `previous_window_id` 与 `window_id` 这类吞并。
4. **visitor 键分支法给集合、不给顺序**：反序列化 visitor 的 `next_key` match 臂用 `&'static str` 逐字比较，这些字面量是**编译器认证**的。取三处 worker 函数后：
   - `TurnStartParams`：**27 个精确名**（visitor 26 + 池内已认证的 `cyberAccessProgram`），R67 的 23 名尾部**全部覆盖**，多出的 4 个正是头部候选 `threadId / summary / model / modelProvider`。**arity 28，缺口 1**。
   - `ThreadStartParams`：43 个名，但该 visitor **同时服务普通 `Thread` 对象**（`id / preview / status / createdAt / cliVersion / recencyAt / forkedFromId` 都在里面），集合混两结构，**不能当字段表用**。
5. **顺序不可得**：声明顺序只有两条来源——`FIELDS` 记录数组（这两枚没有）或 Debug 的分片参数表（实测该处不是 16 字节记录形态，72 条窗口里 60 / 63 条不可解析）。visitor 臂序是**分支顺序**，与声明顺序无关，本轮**不作任何顺序声明**。

## 2. 证据表

| 读数 | 值 |
| --- | --- |
| 放宽后记录 run | 17,134（`.rdata` + `.data`，单字符名，跨段 ptr） |
| 长度 27 的 run | 1（芬兰语词形） |
| 长度 28 的 run | 3（agent 操作码 / orchestrator 错误码 / 斯洛文尼亚语介词） |
| Turn visitor 函数 | 3（`0x145772930` / `0x145781900` / `0x145875a20`） |
| Turn visitor 键 | 26 → union 27 |
| Turn attested 覆盖 | 23 / 23 |
| Turn visitor-only | 4：`threadId`、`summary`、`model`、`modelProvider` |
| Turn arity 缺口 | 1 |
| Thread visitor 键 | 43（混 `Thread` 对象字段） |
| 字典 DP 切分 | 0 个合法切分（158 B / 348 B 两池） |
| Debug 记录窗口 | 72 条中 60 / 63 条不可解析 |
| `lea` 站点（全镜像） | 1,160,394 |
| pdata 函数 | 1,139,013 |

## 3. 三条新否证（已进模块常量，防后续重跑）

| method id | 轴 | 否证读数 |
| --- | --- | --- |
| `widened-record-array` | 16 字节记录数组 | 17,134 run 仍无 27/28 字段表 |
| `code-order-literal-run` | 代码序 `lea` 序列 | 84/89 站点是 serde panic 文本 |
| `dictionary-dp-segmentation` | 字典精确切分 | 20,287 词、0 合法切分 |

## 4. 交付

| 文件 | 行 | 内容 |
| --- | --- | --- |
| `apps/ai-service/app/core/struct_visitor_key_evidence.py` | 229 | `TURN_START_PARAMS_VISITOR_KEYS`(27) / `TURN_START_PARAMS_ATTESTED_TAIL`(23) / `THREAD_START_PARAMS_VISITOR_KEYS`(43) / `TURN_VISITOR_ONLY`(4) / `TURN_ARITY_GAP=1` / `THREAD_MIXED_MARKERS`(7) / `MEASUREMENTS`(7 读数) / `FALSIFIED_AFTER_R68`(3 条) / 校验器 |
| `apps/ai-service/tests/test_struct_visitor_key_evidence.py` | 85 | 9 例：集合精确、arity 28 与缺口 1、attested 全覆盖、头部候选 4 名、Thread 判混、三条否证在册、读数固定、校验器正向 + 截断反向 |

字段名一律由探针从二进制读出后写盘（`D:/DevEnv/Temp/r69/gen_r69.py`），零手敲。

## 5. 验证（现读）

- `pytest tests/test_struct_visitor_key_evidence.py -q` → **9 passed**
- `ruff check` 两文件 → **All checks passed**（生成器源头修：HEADER 多余空行、测试未用导入、validator 语义边界写反）
- 反向变异：截断集合 → 校验器判红（已成测试）

## 6. 边界（诚实面）

- **Turn 缺 1 名**：arity 28 与 27 名之间的差 1，在三个 worker 函数里都搜不到新候选（`turn_fn2` / `turn_fn3` 新候选均为 0），说明该字段的 key 或走 `#[serde(flatten)]`、或被 `skip`、或与别的字段共用同一字面量。
- **顺序未定**：本轮**不声明**任何字段顺序；契约里只给集合，且模块 docstring 明确写「order is deliberately not claimed」。
- **Thread 不可分**：43 名里 `Thread` 对象字段与 `ThreadStartParams` 字段混在同一 visitor，缺判别信号。
- **Debug 参数表未破**：`struct X with N elements` 与字段名的分片表不是 16 字节记录形态，需按 `core::fmt::rt::Argument`（48 字节/条）重扫。

## 7. 下一步（按价值排序）

1. **按 `Argument` 表重扫**：`core::fmt::rt::Argument` 在本镜像里是 48 字节，若 Debug 用分片参数表，`(ptr,len)` 会以第三种步长出现；这是拿到**顺序**的最短路径。
2. **Ghidra 定点反编译** `Debug` impl（`D:\DevEnv\ghidra_12.1.4` 已装、REA 6.4.0 已验证）：`write_str`/`field` 调用序列 = 声明顺序，可直接补齐 27/28 的**顺序与缺口**。
3. **Turn 缺 1 名**：把 `next_key` 的 `match` 跳转表（`jmp [table+idx]`）反查，覆盖未被 worker 采到的臂。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
