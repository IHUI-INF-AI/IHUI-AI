// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'

vi.mock('next-intl', () => {
  // 与 packages/i18n/messages/{shared,web}/zh-CN.json 的同名键保持一致
  const ZH: Record<string, string> = {
    plan: '计划 ({count})',
    reference: '引用 ({count})',
    toolCallStats: '工具调用 ({count} 次)',
    moreItems: '还有 {count} 个',
    parameters: '参数',
    openInWorkPanel: '在工作展示区打开',
    toolUnknownFile: '(未知文件)',
    planStepCompleted: '已完成',
    planStepInProgress: '进行中',
    planStepFailed: '失败',
    argsLabel: '参数',
    resultLabel: '结果',
    errorLabel: '错误',
    statusSkipped: '已跳过',
    statusRunning: '执行中',
    statusSuccess: '已完成',
    statusFailed: '执行失败',
    roundNumber: '第 {n} 轮',
    retriedTimes: '重试 {n} 次',
    sourcePlugin: '插件',
    sourceMcp: 'MCP 服务',
    unitLines: '{n} 行',
    unitResults: '{n} 个结果',
    unitFiles: '{n} 个文件',
    addedCount: '+{n}',
    removedCount: '-{n}',
    toolReadFile: '读取文件内容',
    toolWriteFile: '写入文件',
    toolEditFile: '编辑文件',
    toolWebSearch: '搜索网页',
    toolSearchCodebase: '搜索代码库',
    toolSummarizeArtifacts: '汇总任务产物',
    toolImageGeneration: '生成图片',
    toolImageEdit: '编辑图片',
    toolMusicGeneration: '生成音乐',
    toolVoiceTts: '文字转语音',
    toolVideoGeneration: '生成视频',
    // D134:两族结构化摘要标签。刻意**不**收 deleteRecursiveTag —— 它作为
    // "词包缺 key"的夹具供缺语言回退用例使用(mock 的 ZH[key] ?? key 与
    // next-intl 缺消息时回退键名的行为一致)。
    commandSummaryLabel: '将执行的命令',
    deleteSummaryLabel: '将删除的目标',
  }
  const translate = (key: string, params?: Record<string, number>) => {
    const template = ZH[key] ?? key
    if (!params) return template
    return template.replace(/\{(\w+)\}/g, (_m, name) => String(params[name] ?? ''))
  }
  return { useTranslations: () => translate }
})

/** 活动行的稳定标识:工具码名只存在于 data-testid,界面文案一律本地化 */
const rowOf = (toolName: string) => screen.getByTestId(`tool-call-row-${toolName}`)

import { ToolCallCard } from '../tool-call-card'

/**
 * ToolCallCard `repeated` 徽章渲染守门测试 (§17 UI 改动交付前自验降级方案)
 *
 * 验证去重机制跳过提示徽章的渲染逻辑(tool-call-card.tsx line 198-205):
 *   - repeated=true → 渲染 "已跳过" 徽章
 *   - repeated=false/undefined → 不渲染(向后兼容旧数据无 repeated 字段)
 *   - 徽章带 aria-label 提供无障碍说明
 *   - 与 iteration 徽章(第N轮)共存时两者都渲染
 *
 * 降级说明:web dev server 因其他 agent merge conflict 处于非可用状态,
 * 无法 browser_use 实际渲染验证,降级为 vitest 单元测试(AGENTS.md §17 豁免场景 3)。
 *
 * 断言风格:沿用 Switch.test.tsx 的原生 vitest 断言(getAttribute + toBe / toBeTruthy /
 * toBeNull),项目未引入 @testing-library/jest-dom,故不使用 toBeInTheDocument 等 matcher。
 */
describe('ToolCallCard repeated 徽章渲染', () => {
  afterEach(() => cleanup())

  it('repeated=true 时渲染 "已跳过" 徽章', () => {
    render(
      <ToolCallCard
        toolName="search_codebase"
        args={{ query: 'config' }}
        status="success"
        repeated
      />,
    )
    // getByText 找不到会抛错;这里验证返回的元素真实存在
    expect(screen.getByText('已跳过')).toBeTruthy()
  })

  it('repeated=false 时不渲染 "已跳过" 徽章', () => {
    render(
      <ToolCallCard
        toolName="search_codebase"
        args={{ query: 'config' }}
        status="success"
        repeated={false}
      />,
    )
    expect(screen.queryByText('已跳过')).toBeNull()
  })

  it('repeated=undefined 时不渲染 "已跳过" 徽章(向后兼容旧数据)', () => {
    render(
      <ToolCallCard
        toolName="search_codebase"
        args={{ query: 'config' }}
        status="success"
        // 不传 repeated(模拟旧数据无 repeated 字段)
      />,
    )
    expect(screen.queryByText('已跳过')).toBeNull()
  })

  it('repeated 时整行 aria-label 带上跳过状态(无障碍说明不丢)', () => {
    render(
      <ToolCallCard
        toolName="search_codebase"
        args={{ query: 'config' }}
        status="success"
        repeated
      />,
    )
    // 状态说明从"徽章自带 aria-label"上移到整行 aria-label(行是唯一可点击对象)
    expect(rowOf('search_codebase').getAttribute('aria-label')).toContain('已跳过')
  })

  it('repeated 徽章与 iteration 徽章共存时都渲染', () => {
    render(
      <ToolCallCard
        toolName="search_codebase"
        args={{ query: 'config' }}
        status="success"
        iteration={3}
        repeated
      />,
    )
    // iteration 徽章(第3轮)+ repeated 徽章(已跳过)都应渲染
    expect(screen.getByText('第 3 轮')).toBeTruthy()
    expect(screen.getByText('已跳过')).toBeTruthy()
  })
})

/**
 * ToolCallCard image / summary 类型渲染守门测试。
 *
 * 验证 image_generation(summarize_artifacts)工具命中专用渲染分支,
 * 无匹配数据时回退到 JSON args/result 渲染。展开状态由 header button 控制,
 * 默认 collapsed,需 fireEvent.click 触发展开后才校验内容。
 */
describe('ToolCallCard image rendering', () => {
  afterEach(() => cleanup())

  it('image_generation 工具 + imageUrl 时渲染 <img>', () => {
    render(
      <ToolCallCard
        toolName="image_generation"
        args={{ prompt: '一只猫' }}
        imageUrl="data:image/png;base64,xxx"
        status="success"
      />,
    )
    // 展开卡片
    fireEvent.click(rowOf('image_generation'))
    // img 存在 + alt="一只猫"(jsdom 不触发 onLoad,img 仍在 DOM,只是 opacity-0)
    const img = screen.getByAltText('一只猫')
    expect(img).toBeTruthy()
    expect(img.getAttribute('src')).toBe('data:image/png;base64,xxx')
  })

  it('image_generation 工具无 imageUrl 时回退到 JSON 渲染', () => {
    render(
      <ToolCallCard toolName="image_generation" args={{ prompt: '一只猫' }} status="success" />,
    )
    fireEvent.click(rowOf('image_generation'))
    // 无 img
    expect(screen.queryByRole('img')).toBeNull()
    // 回退到 JSON args 渲染(参数 label 存在)
    expect(screen.getByText('参数')).toBeTruthy()
  })

  it('非 image_generation 工具 + imageUrl 时不渲染 img', () => {
    render(
      <ToolCallCard
        toolName="read_file"
        args={{}}
        imageUrl="data:image/png;base64,xxx"
        status="success"
      />,
    )
    fireEvent.click(rowOf('read_file'))
    // imageUrl 仅对 image_generation 生效,read_file 不渲染 img
    expect(screen.queryByRole('img')).toBeNull()
  })
})

describe('ToolCallCard summary rendering', () => {
  afterEach(() => cleanup())

  it('summarize_artifacts + summaryData 时渲染聚合视图', () => {
    render(
      <ToolCallCard
        toolName="summarize_artifacts"
        args={{}}
        summaryData={{
          plans: [{ id: 'p1', title: 'Plan A', status: 'completed' }],
          sources: [{ type: 'file', ref: 'src/foo.ts' }],
          tool_calls_summary: { total: 5, by_tool: { read_file: 3, write_file: 2 } },
        }}
        status="success"
      />,
    )
    fireEvent.click(rowOf('summarize_artifacts'))
    expect(screen.getByText('计划 (1)')).toBeTruthy()
    expect(screen.getByText('引用 (1)')).toBeTruthy()
    expect(screen.getByText('工具调用 (5 次)')).toBeTruthy()
    // by_tool 徽章
    expect(screen.getByText('读取文件内容 × 3')).toBeTruthy()
    expect(screen.getByText('写入文件 × 2')).toBeTruthy()
  })

  it('summarize_artifacts 无 summaryData 时回退到 JSON', () => {
    render(<ToolCallCard toolName="summarize_artifacts" args={{}} status="success" />)
    fireEvent.click(rowOf('summarize_artifacts'))
    // 无聚合视图标题
    expect(screen.queryByText(/^计划/)).toBeNull()
    // 回退到 JSON(参数 label)
    expect(screen.getByText('参数')).toBeTruthy()
  })

  it('summary sources 超过 5 个时显示 "还有 N 个"', () => {
    const sources = Array.from({ length: 7 }, (_, i) => ({ type: 'file', ref: `file${i}.ts` }))
    render(
      <ToolCallCard
        toolName="summarize_artifacts"
        args={{}}
        summaryData={{ sources }}
        status="success"
      />,
    )
    fireEvent.click(rowOf('summarize_artifacts'))
    // 前 5 个 ref 渲染 + "... 还有 2 个" 提示
    expect(screen.getByText('file0.ts')).toBeTruthy()
    expect(screen.getByText('file4.ts')).toBeTruthy()
    expect(screen.getByText('还有 2 个')).toBeTruthy()
  })

  it('summary plans 状态为 completed 渲染绿色徽章', () => {
    render(
      <ToolCallCard
        toolName="summarize_artifacts"
        args={{}}
        summaryData={{
          plans: [{ id: 'p1', title: 'Plan A', status: 'completed' }],
        }}
        status="success"
      />,
    )
    fireEvent.click(rowOf('summarize_artifacts'))
    const badge = screen.getByText('已完成')
    expect(badge).toBeTruthy()
    // 完成态徽章走 StreamTag success 档(emerald-600)
    expect(badge.getAttribute('class')).toContain('emerald-600')
  })

  it('image 和 summary 都不存在时仍渲染 JSON', () => {
    render(
      <ToolCallCard
        toolName="read_file"
        args={{ path: '/tmp/test.txt' }}
        result={{ content: 'hello' }}
        status="success"
      />,
    )
    fireEvent.click(rowOf('read_file'))
    // args/result JSON 渲染(参数 + 结果 label)
    expect(screen.getByText('参数')).toBeTruthy()
    expect(screen.getByText('结果')).toBeTruthy()
  })
})

/**
 * ToolCallCard audio / video 媒体渲染守门测试(token6688 music/video_generation,2026-09-08)。
 *
 * 验证 music_generation(audioUrl)→ <audio> 播放器、video_generation(videoUrl)→
 * <video> 播放器专用分支;无 URL(任务未完成,仅 task_id)时回退 JSON 渲染。
 */
describe('ToolCallCard media rendering (music/video)', () => {
  afterEach(() => cleanup())

  it('music_generation + audioUrl 时渲染 <audio> 播放器', () => {
    render(
      <ToolCallCard
        toolName="music_generation"
        args={{ prompt: '轻快的钢琴曲' }}
        audioUrl="https://cdn.example.com/song.mp3"
        status="success"
      />,
    )
    fireEvent.click(rowOf('music_generation'))
    const audio = screen.getByTestId('tool-media-audio')
    expect(audio).toBeTruthy()
    expect(audio.getAttribute('src')).toBe('https://cdn.example.com/song.mp3')
  })

  it('voice_tts + data URI audioUrl 时渲染 <audio> 播放器(edge-tts 产物)', () => {
    render(
      <ToolCallCard
        toolName="voice_tts"
        args={{ text: '你好,世界' }}
        audioUrl="data:audio/mpeg;base64,SUQzZmFrZQ=="
        status="success"
      />,
    )
    fireEvent.click(rowOf('voice_tts'))
    const audio = screen.getByTestId('tool-media-audio')
    expect(audio).toBeTruthy()
    expect(audio.getAttribute('src')).toBe('data:audio/mpeg;base64,SUQzZmFrZQ==')
  })

  it('voice_tts 无 audioUrl(失败)时回退 JSON 渲染', () => {
    render(
      <ToolCallCard
        toolName="voice_tts"
        args={{ text: '你好' }}
        result={{ ok: false, error: 'edge-tts 不可达', errorCode: 'ENGINE_ERROR' }}
        status="success"
      />,
    )
    fireEvent.click(rowOf('voice_tts'))
    expect(screen.queryByTestId('tool-media-audio')).toBeNull()
    expect(screen.getByText('参数')).toBeTruthy()
  })

  it('video_generation + videoUrl 时渲染 <video> 播放器', () => {
    render(
      <ToolCallCard
        toolName="video_generation"
        args={{ prompt: '橘猫晒太阳' }}
        videoUrl="https://cdn.example.com/clip.mp4"
        status="success"
      />,
    )
    fireEvent.click(rowOf('video_generation'))
    const video = screen.getByTestId('tool-media-video')
    expect(video).toBeTruthy()
    expect(video.getAttribute('src')).toBe('https://cdn.example.com/clip.mp4')
  })

  it('music_generation 无 audioUrl(任务未完成)时回退 JSON 渲染', () => {
    render(
      <ToolCallCard
        toolName="music_generation"
        args={{ prompt: '轻快的钢琴曲' }}
        result={{ ok: true, completed: false, task_id: 't-1', status: 'submitted' }}
        status="success"
      />,
    )
    fireEvent.click(rowOf('music_generation'))
    expect(screen.queryByTestId('tool-media-audio')).toBeNull()
    expect(screen.getByText('参数')).toBeTruthy()
  })

  it('video_generation 无 videoUrl(任务未完成)时回退 JSON 渲染', () => {
    render(
      <ToolCallCard
        toolName="video_generation"
        args={{ prompt: '橘猫晒太阳' }}
        result={{ ok: true, completed: false, task_id: 't-2', status: 'submitted' }}
        status="success"
      />,
    )
    fireEvent.click(rowOf('video_generation'))
    expect(screen.queryByTestId('tool-media-video')).toBeNull()
    expect(screen.getByText('参数')).toBeTruthy()
  })

  it('audioUrl/videoUrl 仅对对应工具生效(其他工具不渲染播放器)', () => {
    render(
      <ToolCallCard
        toolName="read_file"
        args={{}}
        audioUrl="https://cdn.example.com/song.mp3"
        videoUrl="https://cdn.example.com/clip.mp4"
        status="success"
      />,
    )
    fireEvent.click(rowOf('read_file'))
    expect(screen.queryByTestId('tool-media-audio')).toBeNull()
    expect(screen.queryByTestId('tool-media-video')).toBeNull()
  })
})

/**
 * D134(2026-09-29)两族结构化摘要守门测试:对话流保真④ —— 工具参数是 JSON 裸 dump,
 * 不足以支撑当场批准,缺按副作用分类的结构化摘要。
 *
 * 两族判定依据(HEAD 面取证,与 tool-call-card.tsx 名单注释一致):
 *   命令族 run_command(注册面 required ["command"],别名 execute_command / run_shell /
 *   shell_command 为 llm.py 归一与 _TERMINAL_TOOL_NAMES 等价名)→ 摘要突出命令文本;
 *   删除族 delete_file(llm.py 高危档 + _DELEGATE_ONLY_TOOLS;args 形状 {path, recursive})
 *   → 摘要突出目标路径;其余工具回退 JSON 裸 dump(零回归)。
 *
 * 断言风格沿用本文件:getByTestId + toBe / toBeNull(仓内未引入 jest-dom)。
 */
describe('ToolCallCard effect summary (D134 两族结构化摘要)', () => {
  afterEach(() => cleanup())

  it('命令族 run_command:结构化摘要出现且含将执行的命令文本,JSON dump 保留为详情', () => {
    render(
      <ToolCallCard
        toolName="run_command"
        args={{ command: 'pytest tests/d134 -q', cwd: '.', timeout: 60 }}
        status="running"
      />,
    )
    fireEvent.click(rowOf('run_command'))
    // 摘要块出现,命令文本逐字呈现(等宽块)
    const block = screen.getByTestId('tool-call-command-summary')
    expect(block).toBeTruthy()
    expect(screen.getByTestId('tool-call-command-text').textContent).toBe('pytest tests/d134 -q')
    // 本地化标签命中(词表键接线正确)
    expect(screen.getByText('将执行的命令')).toBeTruthy()
    // JSON 裸 dump 未被摘除:仍作为展开详情保留在其下方
    const argsDump = screen.getByTestId('tool-call-args')
    expect(argsDump.textContent).toContain('"command"')
    expect(argsDump.textContent).toContain('pytest tests/d134 -q')
  })

  it('删除族 delete_file:结构化摘要出现且含目标路径', () => {
    render(
      <ToolCallCard
        toolName="delete_file"
        args={{ path: 'src/legacy/old.js' }}
        status="success"
      />,
    )
    fireEvent.click(rowOf('delete_file'))
    const block = screen.getByTestId('tool-call-delete-summary')
    expect(block).toBeTruthy()
    expect(screen.getByTestId('tool-call-delete-path').textContent).toBe('src/legacy/old.js')
    expect(screen.getByText('将删除的目标')).toBeTruthy()
    // 未标 recursive 时不渲染递归徽章
    expect(screen.queryByText('递归删除')).toBeNull()
    // JSON dump 仍保留(展开详情)
    expect(screen.getByTestId('tool-call-args').textContent).toContain('src/legacy/old.js')
  })

  it('非两族 read_file:不渲染结构化摘要,仍走 JSON 裸 dump 现状(零回归)', () => {
    render(<ToolCallCard toolName="read_file" args={{ path: '/tmp/notes.txt' }} status="success" />)
    fireEvent.click(rowOf('read_file'))
    expect(screen.queryByTestId('tool-call-command-summary')).toBeNull()
    expect(screen.queryByTestId('tool-call-delete-summary')).toBeNull()
    expect(screen.queryByTestId('tool-call-command-text')).toBeNull()
    expect(screen.queryByTestId('tool-call-delete-path')).toBeNull()
    // JSON 现状不变
    const argsDump = screen.getByTestId('tool-call-args')
    expect(argsDump.textContent).toContain('"path"')
    expect(argsDump.textContent).toContain('/tmp/notes.txt')
  })

  it('缺语言回退不崩:词包缺 deleteRecursiveTag 时回退键名,摘要主体照常渲染', () => {
    // 测试词表刻意缺 deleteRecursiveTag(mock 的 ZH[key] ?? key 镜像 next-intl
    // 缺消息回退键名的行为):递归徽章以键名原样落界面,卡片不抛错、路径照常呈现
    render(
      <ToolCallCard
        toolName="delete_file"
        args={{ path: 'tmp/logs/archive', recursive: true }}
        status="running"
      />,
    )
    fireEvent.click(rowOf('delete_file'))
    // 回退键名原样渲染(即"缺语言"形态),组件未崩
    expect(screen.getByText('deleteRecursiveTag')).toBeTruthy()
    // 摘要主体不受缺 key 影响
    expect(screen.getByTestId('tool-call-delete-path').textContent).toBe('tmp/logs/archive')
    expect(screen.getByText('将删除的目标')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
