<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R108 — 渲染链：三个环境变量，一个 runtime python，然后终于看见了画面

> 到 R107 为止，所有门都是对着合成 deck 跑的，**没有一道门能让人看见那个 deck 长什么样**。
> 这轮补上了这一环，代价是四次失败。

## 1. 结果

```
render_slides.py  ->  Slides rendered to .../png4   rc=0   slide-1.png  17,112 B
create_montage.py ->  Montage saved to .../montage.png  rc=0   montage.png  5,670 B
```

**pptx → slide-N.png → montage.png，完整链路通了。**

## 2. 四次失败，每次一层

### 失败一：解释器选错了

用仓库自己的 venv 跑：

```
ModuleNotFoundError: No module named 'pdf2image'
```

换成 runtime 自带的 python：

```
pdf2image True / pypdfium2 True / PIL True / lxml True
```

⇒ **必须用 `<runtime>/dependencies/python/python.exe`**。venv 里没有这套依赖。

### 失败二：缺第一个环境变量

```
RuntimeError: RUNTIME_NODE is required.
```

`runtime_helpers.py` 读 `RUNTIME_NODE`，要求**绝对路径**且**文件必须存在**。

### 失败三：满足第一层之后才撞见的第二层

```
RuntimeError: RUNTIME_BIN_DIR is required.
```

这个要求是**目录**，且里面必须有 `native-executables.json`。

### 失败四：node 侧还有自己的变量，命名风格都不一样

```
Error: RUNTIME_NODE_MODULES or CODEX_PRIMARY_RUNTIME_NODE_MODULES is required.
```

注意它的优先级：**`RUNTIME_NODE_MODULES` 优先**，没设才回落到带 runtime 前缀的那个。

**三个都给对，才渲染成功。**

## 3. 一个必须记下的陷阱：exit 0 会撒谎

第一次尝试时，脚本打了一整段 Python traceback，然后**退出码是 0**。

```
traceback ... RuntimeError: RUNTIME_NODE is required.
rc=0
```

**如果只看退出码，就会以为渲染成功了，而实际上什么都没生成。**

后面几次失败倒是老实退出 1。所以在这条路径上，**退出码不可信，`slide-N.png` 在不在才是判据**。

## 4. 两个工具的契约

**render_slides.py**

| 项 | 值 |
|---|---|
| 位置参数 | `input_path`（PPTX 或 PDF） |
| 选项 | `--output_dir` / `--width` / `--height` |
| 默认尺寸 | 1600 × 900 |
| 缩放 | 等比（isotropic），**会略微超出**声明值 |
| 默认输出目录 | 输入文件旁边、以输入文件名命名 |
| 输出命名 | `slide-<N>.png` |

**create_montage.py**

| 项 | 值 |
|---|---|
| 输入 | `--input_files` 或 `--input_dir`（**二选一，互斥**） |
| 必填 | `--output_file` |
| 列数 | `--num_col`，默认 **5** |
| 单元格 | `--cell_width` / `--cell_height` / `--gap` |
| 标签 | `--label_mode {number, filename, none}` |
| 其他 | `--retain_converted_files` / `--fail_on_image_error` |
| 格式 | 由输出文件扩展名推断 |

## 5. 落成

`apps/ai-service/app/core/codex_render_toolchain.py`：

- 两工具身份 + 描述（逐字）
- `RENDER_*` / `MONTAGE_*` 参数表
- `VENV_ERROR_TEXT`（逐字）+ `RUNTIME_HAS_PDF2IMAGE=True` + `MUST_USE_RUNTIME_PYTHON=True`
- **`ENV_CHAIN`（3 个）+ `ENV_CHAIN_LENGTH=3`** + 三条错误文本逐字
- `RUNTIME_NODE_MODULES_VARS`（2 个名字）+ 优先级
- `RENDERED_BYTES=17112` / `MONTAGE_OUTPUT_BYTES=5670`
- **`FIRST_ATTEMPT_EXIT_CODE=0` + `FIRST_ATTEMPT_HAD_TRACEBACK=True` + `FIRST_ATTEMPT_PRODUCED_PNG=False`**
- `EXIT_CODE_TRUSTWORTHY_ON_SUCCESS_PATH=False` / `PRESENCE_OF_PNG_IS_THE_JUDGE=True`

**17 passed**、ruff 全绿、水印 2/2。

两条反向变异：`EXIT_CODE_TRUSTWORTHY_ON_SUCCESS_PATH` 改 True → 红；`ENV_CHAIN` 砍掉一个变量 → 红。

## 6. 这一环为什么重要

前面二十几轮，我对 deck 的所有判断都是**从 XML 反推**的：这个 flag 认不认、那个字段出不出现。**判据是文本，不是画面。**

现在有了：

```
pptx  --render_slides-->  slide-1.png  --create_montage-->  montage.png
```

⇒ 合成的 deck **可以被眼睛看了**。
⇒ 我做的图表/表格/披露文本，**能被验证是不是真的画出来了**。

## 7. 诚实边界

1. **只渲染了一页**（`numlit.pptx` 是单页）。多页时 `slide-<N>` 的编号规则我没验证。
2. 我没有**看图**——只确认了 PNG 存在且是 17 KB。**内容对不对，还没看过。**
3. `create_montage` 只用了一张图，多图拼接和 `label_mode` 三种模式的实际效果没测。
4. `--fail_on_image_error` 和 `--retain_converted_files` 从未触发过。
5. **exit-0 撒谎那一次我没定位原因**——只知道现象。
6. `RUNTIME_BIN_DIR` 里要 `native-executables.json`，那个文件的内容我没读。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
