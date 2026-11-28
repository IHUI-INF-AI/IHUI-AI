<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

工具检索基线（BM25，无 embedding、无模型）

- 用例：100
- Recall@1：59.0%
- Recall@5：83.0%
- MRR：0.700

Top-5 未命中：
- edu-017「李明泽报名的是哪个班、欠多少」期望 edu_list_students，Top5=['edu_create_refund', 'edu_create_payment_record', 'edu_send_fee_reminder_batch', 'edu_send_fee_reminder', 'edu_list_arrears']
- fin-015「查一下今年的总账」期望 finance_ledger_ops，Top5=['hr_insurance_readiness', 'social_insurance_calc', 'ai_bookkeeping', 'hr_my_attendance', 'ai_payroll_handoff']
- code-003「把 config 里的 timeout 从 30 改成 60」期望 file_edit，Top5=['extract_document_assets', 'get_publish_acceptance', 'run_command', 'workbook_read_range', 'sandbox_session']
- code-010「调查一下发布链路为什么失败」期望 investigate_codebase，Top5=['get_publish_task', 'get_publish_stats', 'prepare_publish_draft', 'image_edit', 'audio_transcription']
- code-013「新建一个 README 片段」期望 write_file，Top5=['update_publish_draft', 'create_artifact', 'video_generation', 'workflow_resume', 'advisor_consult']
- code-014「看下当前 git 状态」期望 git_operations，Top5=['list_publish_accounts', 'list_publish_tasks', 'browser_network_requests', 'get_publish_acceptance', 'get_publish_task']
- code-015「看下这次改动的 diff」期望 git_operations，Top5=['workbook_write_cells', 'write_file', 'workbook_close', 'review_pr', 'workflow_resume']
- code-016「跑一下 pytest tests/test_x.py」期望 run_command，Top5=['auto_rebuild_codebase', 'schedule_wakeup', 'workflow_resume', 'apply_patch_set', 'subagent_job']
- web-001「打开 https://aizhs.top」期望 browser_navigate，Top5=['list_publish_accounts', 'workbook_open', 'sandbox_session', 'analyze_code', 'browser_selfcheck']
- web-002「点一下登录按钮」期望 browser_click_element，Top5=['browser_selfcheck', 'prepare_publish_draft', 'get_publish_acceptance', 'list_publish_accounts', 'send_to_session']
- desk-003「点屏幕坐标 100,200」期望 computer_mouse_click，Top5=['computer_mouse_move', 'read_image', 'browser_selfcheck', 'computer_screenshot_screen', 'map_site']
- desk-007「按回车」期望 computer_keyboard_press，Top5=['todo_read', 'read_tool_output', 'list_symbol_definitions', 'web_search', 'list_project_rules']
- media-004「生成一张赛博朋克封面」期望 image_generation，Top5=['create_publish_draft', 'publish_preflight', 'update_publish_draft', 'video_generation', 'configure_automation_task']
- media-009「把这段话读出来」期望 voice_tts，Top5=['audio_transcription', 'extract_document_assets', 'send_team_message', 'hr_insurance_readiness', 'list_scheduled_tasks']
- media-011「把刚才的总结存成 HTML 报告」期望 create_artifact，Top5=['present_files', 'create_publish_draft', 'browser_selfcheck', 'review_pr', 'resolve_conflict']
- media-013「上次我们讨论的工具面方案在哪」期望 session_search，Top5=['read_tool_output', 'get_tool_schema', 'orchestrate_agents', 'workbook_write_cells', 'terminal']
- media-015「看下我的待办」期望 todo_read，Top5=['edu_my_bills', 'team_task', 'browser_network_requests', 'parse_document', 'subagent_job']
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
