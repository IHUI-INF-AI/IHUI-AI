# 企业文档使用说明

## 支持的文档格式

文档中心支持以下格式的文档显示：

### 1. Markdown 文档（.md）
- 纯文本格式，支持基本的格式化（标题、列表、表格、代码块等）
- 适合技术文档、说明文档
- 示例：`whitepaper.md`

### 2. PDF 文档（.pdf）
- 保留原始格式，支持图片、表格、图表
- 浏览器直接预览
- 配置方式：
```javascript
{ 
  id: 'example-pdf', 
  fileUrl: '/docs/enterprise-service/example.pdf', 
  fileType: 'pdf', 
  title: '示例PDF文档', 
  category: '企业服务', 
  type: 'file' 
}
```

### 3. PowerPoint 文档（.ppt, .pptx）
- 完整保留幻灯片格式、动画、图片
- 使用微软 Office Online 预览服务
- 配置方式：
```javascript
{ 
  id: 'example-ppt', 
  fileUrl: '/docs/enterprise-service/example.pptx', 
  fileType: 'pptx', 
  title: '示例PPT文档', 
  category: '企业服务', 
  type: 'file' 
}
```

### 4. Word 文档（.doc, .docx）
- 完整保留文档格式、图片、表格
- 使用微软 Office Online 预览服务
- 配置方式：
```javascript
{ 
  id: 'example-doc', 
  fileUrl: '/docs/enterprise-service/example.docx', 
  fileType: 'docx', 
  title: '示例Word文档', 
  category: '企业服务', 
  type: 'file' 
}
```

### 5. Excel 文档（.xls, .xlsx）
- 完整保留表格数据、图表
- 使用微软 Office Online 预览服务
- 配置方式：
```javascript
{ 
  id: 'example-xls', 
  fileUrl: '/docs/enterprise-service/example.xlsx', 
  fileType: 'xlsx', 
  title: '示例Excel文档', 
  category: '企业服务', 
  type: 'file' 
}
```

## 添加新文档的步骤

1. **准备文档文件**
   - 将文档文件（PPT/Word/PDF/Excel）放入 `public/docs/enterprise-service/` 目录

2. **配置文档目录**
   - 打开 `src/views/EduDocumentation.vue`
   - 在 `DOC_CATALOG` 数组中添加新条目：
   ```javascript
   { 
     id: 'unique-doc-id',           // 唯一标识符
     fileUrl: '/docs/enterprise-service/filename.pptx',  // 文件路径
     fileType: 'pptx',              // 文件类型
     title: '文档标题',              // 显示标题
     category: '企业服务',          // 分类
     type: 'file'                   // 类型标记
   }
   ```

3. **重启开发服务器**
   - 如果是新添加的文件类型，可能需要重启 Vite 服务器

## 注意事项

1. **文件大小限制**
   - 建议单个文件不超过 50MB
   - 大文件可能影响加载速度

2. **Office 文档预览**
   - PPT/Word/Excel 使用微软 Office Online 预览服务
   - 需要文件可以通过公网访问（或 localhost 开发环境）
   - 如果文件无法访问，预览会失败

3. **PDF 预览**
   - 直接使用浏览器内置的 PDF 阅读器
   - 不需要外部服务

4. **安全性**
   - 敏感文档建议转换为 PDF 后上传
   - 避免上传包含敏感信息的可编辑文档

## 示例

当前目录中的示例文件：
- `whitepaper.md` - Markdown 格式白皮书
- `ai-community-intro.md` - Markdown 格式社区介绍
- `decision-maker-community.md` - Markdown 格式决策者社群介绍
- `human-ai-collaboration.md` - Markdown 格式人机协作介绍

## 转换工具

如果需要将现有文档转换为支持的格式，可以使用以下工具：

- **PPT/Word/Excel 转 PDF**: Microsoft Office、WPS、Google Docs
- **图片压缩**: TinyPNG、Squoosh
- **PDF 优化**: Adobe Acrobat、PDF24
