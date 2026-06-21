# 创建代码片段

生成 VS Code / Cursor 代码片段。

## 指令

请根据以下代码创建代码片段：

{{selection}}

### 代码片段格式

```json
{
  "Vue 3 Setup Component": {
    "prefix": ["vue3", "vuesetup"],
    "body": [
      "<template>",
      "  <div class=\"${1:component-name}\">",
      "    $0",
      "  </div>",
      "</template>",
      "",
      "<script setup lang=\"ts\">",
      "import { ref } from 'vue'",
      "",
      "// Props",
      "interface Props {",
      "  ${2:propName}?: ${3:string}",
      "}",
      "const props = defineProps<Props>()",
      "",
      "// State",
      "const ${4:state} = ref($5)",
      "</script>",
      "",
      "<style scoped>",
      ".${1:component-name} {",
      "  $6",
      "}",
      "</style>"
    ],
    "description": "Vue 3 Composition API 组件模板"
  }
}
```

### 占位符语法

- `$1`, `$2` - Tab 停止位，按顺序跳转
- `$0` - 最终光标位置
- `${1:default}` - 带默认值的占位符
- `${1|one,two,three|}` - 下拉选项
- `$TM_FILENAME_BASE` - 文件名（无扩展名）
- `$CURRENT_YEAR` - 当前年份

### 常用片段类型

1. **组件模板** - Vue/React 组件
2. **函数模板** - 常用函数结构
3. **测试模板** - 测试用例结构
4. **注释模板** - 文档注释

### 输出

1. JSON 格式的代码片段
2. 使用说明
3. 建议的 prefix（触发词）
