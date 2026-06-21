import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('usePdfAnnotations', () => {
  it('应该导出函数', async () => {
    const mod = await import('../usePdfAnnotations')
    expect(mod).toBeDefined()
  })

  // 每个测试前后清理 localStorage，避免相互污染
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  // 测试初始状态和默认值
  it('应该有正确的初始状态', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const state = usePdfAnnotations()
    expect(state.annotations.value).toEqual([])
    expect(state.selectedId.value).toBeNull()
    expect(state.mode.value).toBe('select')
    expect(state.color.value).toBe('var(--el-text-color-primary)')
    expect(state.isDrawing.value).toBe(false)
    expect(state.drawStart.value).toBeNull()
  })

  // 测试 defaultColors 导出
  it('应该导出默认颜色配置', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { defaultColors } = usePdfAnnotations()
    expect(defaultColors.highlight).toBe('var(--el-text-color-primary)')
    expect(defaultColors.underline).toBe('var(--el-text-color-primary)')
    expect(defaultColors.text).toBe('var(--el-text-color-primary)')
    expect(defaultColors.note).toBe('var(--color-orange-ff9800)')
  })

  // 测试 addAnnotation 添加批注
  it('addAnnotation 应该添加批注并生成 id 和时间戳', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { addAnnotation, annotations } = usePdfAnnotations()
    const ann = addAnnotation({
      type: 'highlight',
      page: 1,
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      color: '#ff0000'
    })
    expect(ann.id).toMatch(/^ann_\d+_[\w]+$/)
    expect(ann.createdAt).toBeTypeOf('number')
    expect(ann.updatedAt).toBeTypeOf('number')
    expect(annotations.value).toHaveLength(1)
    expect(annotations.value[0]).toEqual(ann)
  })

  // 测试 updateAnnotation 更新批注
  it('updateAnnotation 应该更新指定批注', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { addAnnotation, updateAnnotation, annotations } = usePdfAnnotations()
    const ann = addAnnotation({
      type: 'text',
      page: 1,
      x: 0,
      y: 0,
      color: '#000'
    })
    updateAnnotation(ann.id, { content: '更新内容', color: '#fff' })
    expect(annotations.value[0].content).toBe('更新内容')
    expect(annotations.value[0].color).toBe('#fff')
  })

  // 测试 updateAnnotation 找不到 id 时不做任何操作
  it('updateAnnotation 找不到 id 时不应抛错', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { updateAnnotation, annotations } = usePdfAnnotations()
    updateAnnotation('不存在的id', { content: 'x' })
    expect(annotations.value).toHaveLength(0)
  })

  // 测试 deleteAnnotation 删除批注
  it('deleteAnnotation 应该删除指定批注', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { addAnnotation, deleteAnnotation, annotations } = usePdfAnnotations()
    const ann = addAnnotation({ type: 'note', page: 1, x: 0, y: 0, color: '#000' })
    deleteAnnotation(ann.id)
    expect(annotations.value).toHaveLength(0)
  })

  // 测试 deleteAnnotation 删除当前选中项时清除选中
  it('deleteAnnotation 删除选中项时应清除 selectedId', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { addAnnotation, deleteAnnotation, selectAnnotation, selectedId } = usePdfAnnotations()
    const ann = addAnnotation({ type: 'note', page: 1, x: 0, y: 0, color: '#000' })
    selectAnnotation(ann.id)
    expect(selectedId.value).toBe(ann.id)
    deleteAnnotation(ann.id)
    expect(selectedId.value).toBeNull()
  })

  // 测试 deleteAnnotation 找不到 id 时不抛错
  it('deleteAnnotation 找不到 id 时不应抛错', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { deleteAnnotation } = usePdfAnnotations()
    expect(() => deleteAnnotation('不存在')).not.toThrow()
  })

  // 测试 selectAnnotation 选择批注
  it('selectAnnotation 应该设置 selectedId', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { selectAnnotation, selectedId } = usePdfAnnotations()
    selectAnnotation('abc')
    expect(selectedId.value).toBe('abc')
    selectAnnotation(null)
    expect(selectedId.value).toBeNull()
  })

  // 测试 selectedAnnotation 计算属性
  it('selectedAnnotation 应该返回当前选中的批注', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { addAnnotation, selectAnnotation, selectedAnnotation } = usePdfAnnotations()
    const ann = addAnnotation({ type: 'note', page: 1, x: 0, y: 0, color: '#000' })
    selectAnnotation(ann.id)
    expect(selectedAnnotation.value?.id).toBe(ann.id)
    selectAnnotation(null)
    expect(selectedAnnotation.value).toBeNull()
  })

  // 测试 pageAnnotations 计算属性按页过滤
  it('pageAnnotations 应该按页码过滤批注', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { addAnnotation, pageAnnotations } = usePdfAnnotations()
    addAnnotation({ type: 'note', page: 1, x: 0, y: 0, color: '#000' })
    addAnnotation({ type: 'note', page: 2, x: 0, y: 0, color: '#000' })
    addAnnotation({ type: 'note', page: 1, x: 0, y: 0, color: '#000' })
    expect(pageAnnotations.value(1)).toHaveLength(2)
    expect(pageAnnotations.value(2)).toHaveLength(1)
    expect(pageAnnotations.value(3)).toHaveLength(0)
  })

  // 测试 setMode 设置模式
  it('setMode 非 select 模式应同步更新默认颜色', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { setMode, mode, color } = usePdfAnnotations()
    setMode('highlight')
    expect(mode.value).toBe('highlight')
    expect(color.value).toBe('var(--el-text-color-primary)')
    setMode('note')
    expect(mode.value).toBe('note')
    expect(color.value).toBe('var(--color-orange-ff9800)')
  })

  // 测试 setMode 切回 select 模式时不改变颜色
  it('setMode 切回 select 模式不应改变颜色', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { setMode, color } = usePdfAnnotations()
    setMode('note')
    const noteColor = color.value
    setMode('select')
    expect(color.value).toBe(noteColor)
  })

  // 测试 setColor 设置颜色
  it('setColor 应该设置颜色', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { setColor, color } = usePdfAnnotations()
    setColor('#123456')
    expect(color.value).toBe('#123456')
  })

  // 测试 clearAllAnnotations 清空所有批注
  it('clearAllAnnotations 应清空批注和选中', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { addAnnotation, selectAnnotation, clearAllAnnotations, annotations, selectedId } = usePdfAnnotations()
    const ann = addAnnotation({ type: 'note', page: 1, x: 0, y: 0, color: '#000' })
    selectAnnotation(ann.id)
    clearAllAnnotations()
    expect(annotations.value).toHaveLength(0)
    expect(selectedId.value).toBeNull()
  })

  // 测试 exportAnnotations 导出 JSON 字符串
  it('exportAnnotations 应该返回 JSON 字符串', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { addAnnotation, exportAnnotations } = usePdfAnnotations()
    addAnnotation({ type: 'note', page: 1, x: 0, y: 0, color: '#000', content: '测试' })
    const json = exportAnnotations()
    const parsed = JSON.parse(json)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].content).toBe('测试')
  })

  // 测试 importAnnotations 成功导入
  it('importAnnotations 应该成功导入数组', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { importAnnotations, annotations } = usePdfAnnotations()
    const data = [{
      id: 'ann_1',
      type: 'note',
      page: 1,
      x: 0,
      y: 0,
      color: '#000',
      createdAt: 1000,
      content: '导入'
    }]
    const ok = importAnnotations(JSON.stringify(data))
    expect(ok).toBe(true)
    expect(annotations.value).toHaveLength(1)
    expect(annotations.value[0].id).toBe('ann_1')
    expect(annotations.value[0].updatedAt).toBeTypeOf('number')
  })

  // 测试 importAnnotations 缺失字段时补全 id 和 createdAt
  it('importAnnotations 缺失 id 和 createdAt 时应补全', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { importAnnotations, annotations } = usePdfAnnotations()
    const data = [{ type: 'note', page: 1, x: 0, y: 0, color: '#000' }]
    const ok = importAnnotations(JSON.stringify(data))
    expect(ok).toBe(true)
    expect(annotations.value[0].id).toMatch(/^ann_/)
    expect(annotations.value[0].createdAt).toBeTypeOf('number')
  })

  // 测试 importAnnotations 非数组返回 false
  it('importAnnotations 非数组应返回 false', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { importAnnotations, annotations } = usePdfAnnotations()
    expect(importAnnotations(JSON.stringify({ a: 1 }))).toBe(false)
    expect(annotations.value).toHaveLength(0)
  })

  // 测试 importAnnotations JSON 解析失败返回 false
  it('importAnnotations 非法 JSON 应返回 false', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { importAnnotations } = usePdfAnnotations()
    expect(importAnnotations('不是json')).toBe(false)
  })

  // 测试 loadAnnotations 从 localStorage 加载
  it('loadAnnotations 应该从 localStorage 加载批注', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { loadAnnotations, annotations } = usePdfAnnotations()
    const data = [{ id: 'x1', type: 'note', page: 1, x: 0, y: 0, color: '#000', createdAt: 1, updatedAt: 1 }]
    localStorage.setItem('pdf_annotations_doc1', JSON.stringify(data))
    loadAnnotations('doc1')
    expect(annotations.value).toHaveLength(1)
    expect(annotations.value[0].id).toBe('x1')
  })

  // 测试 loadAnnotations 无数据时保持空数组
  it('loadAnnotations 无数据时应保持空数组', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { loadAnnotations, annotations } = usePdfAnnotations()
    loadAnnotations('doc_no_data')
    expect(annotations.value).toHaveLength(0)
  })

  // 测试 loadAnnotations JSON 解析失败时清空
  it('loadAnnotations 解析失败时应清空批注', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { loadAnnotations, annotations } = usePdfAnnotations()
    localStorage.setItem('pdf_annotations_bad', '非法json')
    loadAnnotations('bad')
    expect(annotations.value).toHaveLength(0)
  })

  // 测试 saveAnnotations 保存到 localStorage
  it('saveAnnotations 应该保存到 localStorage', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { addAnnotation, saveAnnotations } = usePdfAnnotations()
    addAnnotation({ type: 'note', page: 1, x: 0, y: 0, color: '#000' })
    saveAnnotations('doc1')
    const saved = localStorage.getItem('pdf_annotations_doc1')
    expect(saved).not.toBeNull()
    expect(JSON.parse(saved!)).toHaveLength(1)
  })

  // 测试 saveAnnotations 存储失败时不抛错
  it('saveAnnotations 存储失败时不应抛错', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { saveAnnotations } = usePdfAnnotations()
    // 模拟 localStorage.setItem 抛错
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('存储已满')
    })
    expect(() => saveAnnotations('doc1')).not.toThrow()
    spy.mockRestore()
  })

  // 测试 startDrawing 开始绘制
  it('startDrawing 应该设置绘制状态和起点', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { startDrawing, isDrawing, drawStart } = usePdfAnnotations()
    startDrawing(10, 20)
    expect(isDrawing.value).toBe(true)
    expect(drawStart.value).toEqual({ x: 10, y: 20 })
  })

  // 测试 endDrawing 未开始绘制返回 null
  it('endDrawing 未开始绘制应返回 null', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { endDrawing } = usePdfAnnotations()
    expect(endDrawing(1, 100, 100)).toBeNull()
  })

  // 测试 endDrawing select 模式返回 null
  it('endDrawing select 模式应返回 null', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { startDrawing, endDrawing } = usePdfAnnotations()
    startDrawing(0, 0)
    expect(endDrawing(1, 100, 100)).toBeNull()
  })

  // 测试 endDrawing highlight 模式生成批注
  it('endDrawing highlight 模式应生成批注', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { startDrawing, endDrawing, setMode, isDrawing, drawStart, annotations } = usePdfAnnotations()
    setMode('highlight')
    startDrawing(10, 20)
    const ann = endDrawing(1, 110, 70)
    expect(ann).not.toBeNull()
    expect(ann!.type).toBe('highlight')
    expect(ann!.page).toBe(1)
    // 坐标取最小值
    expect(ann!.x).toBe(10)
    expect(ann!.y).toBe(20)
    // 宽高取绝对值
    expect(ann!.width).toBe(100)
    expect(ann!.height).toBe(50)
    // highlight 模式 content 应为 undefined
    expect(ann!.content).toBeUndefined()
    expect(isDrawing.value).toBe(false)
    expect(drawStart.value).toBeNull()
    expect(annotations.value).toHaveLength(1)
  })

  // 测试 endDrawing 反向拖动（终点在起点左上）
  it('endDrawing 反向拖动应正确计算坐标', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { startDrawing, endDrawing, setMode } = usePdfAnnotations()
    setMode('underline')
    startDrawing(100, 100)
    const ann = endDrawing(2, 50, 30)
    expect(ann!.x).toBe(50)
    expect(ann!.y).toBe(30)
    expect(ann!.width).toBe(50)
    expect(ann!.height).toBe(70)
    expect(ann!.type).toBe('underline')
  })

  // 测试 endDrawing text 模式 content 为空字符串
  it('endDrawing text 模式 content 应为空字符串', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { startDrawing, endDrawing, setMode } = usePdfAnnotations()
    setMode('text')
    startDrawing(0, 0)
    const ann = endDrawing(1, 50, 50)
    expect(ann!.content).toBe('')
  })

  // 测试 endDrawing note 模式 content 为空字符串
  it('endDrawing note 模式 content 应为空字符串', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { startDrawing, endDrawing, setMode } = usePdfAnnotations()
    setMode('note')
    startDrawing(0, 0)
    const ann = endDrawing(1, 50, 50)
    expect(ann!.content).toBe('')
  })

  // 测试 cancelDrawing 取消绘制
  it('cancelDrawing 应该重置绘制状态', async () => {
    const { usePdfAnnotations } = await import('../usePdfAnnotations')
    const { startDrawing, cancelDrawing, isDrawing, drawStart } = usePdfAnnotations()
    startDrawing(10, 20)
    cancelDrawing()
    expect(isDrawing.value).toBe(false)
    expect(drawStart.value).toBeNull()
  })
})
