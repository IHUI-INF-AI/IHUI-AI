# CSS 转 Tailwind

将传统 CSS 转换为 Tailwind CSS 类。

## 指令

请将以下 CSS 转换为 Tailwind CSS：

{{selection}}

### 转换规则

1. **布局**
```css
/* CSS */
display: flex;
justify-content: center;
align-items: center;
flex-direction: column;
gap: 16px;

/* Tailwind */
class="flex justify-center items-center flex-col gap-4"
```

2. **间距**
```css
/* CSS */
padding: 16px 24px;
margin-top: 8px;
margin-bottom: 16px;

/* Tailwind */
class="px-6 py-4 mt-2 mb-4"
```

3. **颜色**
```css
/* CSS */
color: #3b82f6;
background-color: #f3f4f6;
border-color: #e5e7eb;

/* Tailwind */
class="text-blue-500 bg-gray-100 border-gray-200"
```

4. **响应式**
```css
/* CSS */
@media (min-width: 768px) {
  padding: 32px;
}

/* Tailwind */
class="p-4 md:p-8"
```

### 输出

1. 转换后的 Tailwind 类
2. 对应关系说明
3. 自定义值的处理建议
