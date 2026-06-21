# 数据库索引审计报告

扫描 150 张表

## 摘要

- 总表数: **150**
- 有缺失索引: **83**
- 缺失索引总数: **103**

## 详细报告

| 表名 | 已有索引 | 缺失索引 |
|------|---------|---------|
| `agent_billings` | id | HIGH_FREQ: status (类型=INTEGER) |
| `agent_buy_scheduled_tasks` | id | HIGH_FREQ: status (类型=INTEGER) |
| `agent_callbacks` | id | ✓ |
| `agent_category_link` | agent_id, category_id, id | ✓ |
| `agent_configs` | id | ✓ |
| `agent_heat_stats` | id | ✓ |
| `agent_rule_param` | id, rule_id | ✓ |
| `agent_upload` | id | HIGH_FREQ: status (类型=INTEGER) |
| `agents` | agent_id | HIGH_FREQ: user_id (类型=VARCHAR(64)) |
| `ai_about_us` | id | HIGH_FREQ: status (类型=INTEGER) |
| `ai_contact` | id | HIGH_FREQ: status (类型=INTEGER) |
| `ai_file_storage` | id | HIGH_FREQ: status (类型=INTEGER) |
| `ai_gc` | id | HIGH_FREQ: status (类型=INTEGER) |
| `ai_gc_user_log` | id | ✓ |
| `ai_news` | id | HIGH_FREQ: status (类型=INTEGER) |
| `ai_user_feedback` | id | HIGH_FREQ: status (类型=INTEGER) |
| `app_content` | id | HIGH_FREQ: status (类型=INTEGER) |
| `app_version` | id | HIGH_FREQ: status (类型=INTEGER) |
| `ask_answer` | id, member_id, question_id | ✓ |
| `ask_category` | id | ✓ |
| `ask_comment` | id, target_id, target_type | HIGH_FREQ: user_id (类型=VARCHAR(64)) |
| `ask_favorite` | id, target_id, target_type, user_id | ✓ |
| `ask_like` | id, target_id, target_type, user_id | ✓ |
| `ask_question` | id, member_id, status | ✓ |
| `ask_question_category` | category_id, id, question_id | ✓ |
| `behavior_comment` | id, target_id, target_type | HIGH_FREQ: user_id (类型=VARCHAR(64))<br/>HIGH_FREQ: status (类型=INTEGER) |
| `behavior_favorite` | id, target_id, target_type, user_id | ✓ |
| `behavior_follow` | id, target_user_id, user_id | ✓ |
| `behavior_like` | id, target_id, target_type, user_id | ✓ |
| `behavior_report` | id, target_id, target_type | HIGH_FREQ: user_id (类型=VARCHAR(64))<br/>HIGH_FREQ: status (类型=INTEGER) |
| `behavior_sensitive` | id, word | HIGH_FREQ: status (类型=INTEGER) |
| `behavior_share` | id, target_id, target_type, user_id | ✓ |
| `circle` | category_id, id, status | ✓ |
| `circle_category` | id | ✓ |
| `circle_member` | circle_id, id, user_id | HIGH_FREQ: status (类型=INTEGER) |
| `circle_post` | circle_id, id, status, user_id | ✓ |
| `circle_post_comment` | id, post_id | HIGH_FREQ: user_id (类型=VARCHAR(64)) |
| `circle_post_like` | id, post_id, user_id | ✓ |
| `exam_category` | id | ✓ |
| `exam_paper` | category_id, id, status | ✓ |
| `exam_question` | id, paper_id, type | ✓ |
| `exam_record` | id, paper_id, user_id | HIGH_FREQ: status (类型=INTEGER) |
| `exam_wrong_question` | id, question_id, user_id | ✓ |
| `exchange_rate` | id | HIGH_FREQ: status (类型=INTEGER) |
| `gen_table` | table_id | HIGH_FREQ: create_by (类型=VARCHAR(64))<br/>HIGH_FREQ: update_by (类型=VARCHAR(64)) |
| `gen_table_column` | column_id | HIGH_FREQ: create_by (类型=VARCHAR(64))<br/>HIGH_FREQ: update_by (类型=VARCHAR(64)) |
| `live_channel` | id, start_time, status | ✓ |
| `live_channel_category` | id | ✓ |
| `live_comment` | channel_id, id | HIGH_FREQ: user_id (类型=VARCHAR(64)) |
| `live_gift` | channel_id, id | HIGH_FREQ: user_id (类型=VARCHAR(64)) |
| `live_subscribe` | channel_id, id, user_id | ✓ |
| `message` | id, is_read, user_id | ✓ |
| `message_announcement` | id, status | ✓ |
| `message_read_log` | id, user_id | ✓ |
| `message_template` | code, id | HIGH_FREQ: status (类型=INTEGER) |
| `notification` | id, status, type, user_id | ✓ |
| `notification_channel` | id | HIGH_FREQ: status (类型=INTEGER) |
| `notification_log` | id, notification_id, send_time | HIGH_FREQ: user_id (类型=VARCHAR(64)) |
| `notification_subscription` | id, user_id | ✓ |
| `oauth_apps` | client_id, id | ✓ |
| `oauth_private_keys` | id | HIGH_FREQ: status (类型=INTEGER) |
| `oauth_sessions` | code, id | ✓ |
| `oauth_users` | id | ✓ |
| `point_account` | id, user_id | ✓ |
| `point_exchange` | id, status, user_id | ✓ |
| `point_goods` | id, status | ✓ |
| `point_log` | action, created_at, id, user_id | ✓ |
| `point_rule` | code, id | HIGH_FREQ: status (类型=INTEGER) |
| `resource` | id | HIGH_FREQ: status (类型=INTEGER) |
| `search_hot_keyword` | id, status | ✓ |
| `search_index` | category, id, status, target_id, target_type | HIGH_FREQ: user_id (类型=VARCHAR(64)) |
| `search_log` | id, keyword, user_id | ✓ |
| `sys_config` | config_id, config_key | ✓ |
| `sys_dept` | dept_id | HIGH_FREQ: parent_id (类型=BIGINT)<br/>HIGH_FREQ: status (类型=VARCHAR(1))<br/>HIGH_FREQ: del_flag (类型=VARCHAR(1)) |
| `sys_dict_data` | dict_code | HIGH_FREQ: status (类型=VARCHAR(1)) |
| `sys_dict_type` | dict_id, dict_type | HIGH_FREQ: status (类型=VARCHAR(1)) |
| `sys_job` | job_id | HIGH_FREQ: status (类型=VARCHAR(1))<br/>HIGH_FREQ: create_by (类型=VARCHAR(64))<br/>HIGH_FREQ: update_by (类型=VARCHAR(64)) |
| `sys_job_log` | job_log_id | HIGH_FREQ: status (类型=VARCHAR(1)) |
| `sys_logininfor` | info_id | HIGH_FREQ: status (类型=VARCHAR(1)) |
| `sys_menu` | menu_id | HIGH_FREQ: parent_id (类型=BIGINT)<br/>HIGH_FREQ: status (类型=VARCHAR(1)) |
| `sys_notice` | notice_id | HIGH_FREQ: status (类型=VARCHAR(1))<br/>HIGH_FREQ: create_by (类型=VARCHAR(64)) |
| `sys_oper_log` | oper_id | HIGH_FREQ: status (类型=INTEGER) |
| `sys_post` | post_id | HIGH_FREQ: status (类型=VARCHAR(1)) |
| `sys_role` | del_flag, role_id, role_key, status | ✓ |
| `sys_role_dept` | dept_id, role_id | ✓ |
| `sys_role_menu` | menu_id, role_id | ✓ |
| `sys_user` | del_flag, dept_id, phone, status, user_id... | HIGH_FREQ: create_by (类型=VARCHAR(64))<br/>HIGH_FREQ: update_by (类型=VARCHAR(64)) |
| `sys_user_post` | post_id, user_id | ✓ |
| `sys_user_role` | role_id, user_id | ✓ |
| `tbox_bean` | id | HIGH_FREQ: status (类型=INTEGER) |
| `user_auth_info` | user_uuid | ✓ |
| `user_margin` | user_uuid | ✓ |
| `user_sk_info` | id, user_uuid | HIGH_FREQ: status (类型=INTEGER) |
| `user_third_party_accounts` | id | ✓ |
| `user_vip` | id, user_uuid | HIGH_FREQ: status (类型=INTEGER) |
| `users` | invite_code, uuid | HIGH_FREQ: status (类型=INTEGER)<br/>HIGH_FREQ: parent_id (类型=VARCHAR(64)) |
| `video_generation_tasks` | id, task_id, user_uuid | HIGH_FREQ: status (类型=VARCHAR(50)) |
| `vip_level` | id | HIGH_FREQ: status (类型=INTEGER) |
| `visit_log` | created_at, id, path, target_id, target_type... | ✓ |
| `visit_page` | id, stat_date | ✓ |
| `visit_source` | id, stat_date | ✓ |
| `visit_stats` | id, stat_date, target_id, target_type | ✓ |
| `zhs_activity` | id | HIGH_FREQ: status (类型=SMALLINT) |
| `zhs_agent_buy` | id | HIGH_FREQ: status (类型=VARCHAR(10)) |
| `zhs_agent_category` | id | ✓ |
| `zhs_agent_developer` | id | HIGH_FREQ: user_id (类型=VARCHAR(64))<br/>HIGH_FREQ: status (类型=INTEGER) |
| `zhs_agent_examine` | id | HIGH_FREQ: status (类型=BIGINT) |
| `zhs_agent_need_task` | agent_id, id, user_id | HIGH_FREQ: status (类型=INTEGER) |
| `zhs_agent_rule` | agent_id, id | HIGH_FREQ: status (类型=INTEGER) |
| `zhs_agent_settlement` | id, order_no, settlement | ✓ |
| `zhs_agent_withdrawal_detail` | id, out_bill_no, user_id | HIGH_FREQ: status (类型=INTEGER) |
| `zhs_ai_model_info` | id, name | HIGH_FREQ: status (类型=INTEGER) |
| `zhs_banner_carousel` | id | HIGH_FREQ: status (类型=INTEGER) |
| `zhs_category_dictionary` | id | HIGH_FREQ: parent_id (类型=BIGINT)<br/>HIGH_FREQ: status (类型=INTEGER) |
| `zhs_commission_flow` | id | HIGH_FREQ: user_id (类型=VARCHAR(64))<br/>HIGH_FREQ: status (类型=INTEGER) |
| `zhs_course` | id | ✓ |
| `zhs_course_audit` | id | ✓ |
| `zhs_course_pay` | id | HIGH_FREQ: status (类型=INTEGER) |
| `zhs_course_pay_log` | id | ✓ |
| `zhs_course_platform_log` | id | ✓ |
| `zhs_course_temp` | id | HIGH_FREQ: status (类型=INTEGER) |
| `zhs_course_video` | id | HIGH_FREQ: status (类型=INTEGER) |
| `zhs_course_video_temp` | id | HIGH_FREQ: status (类型=INTEGER) |
| `zhs_developer_link` | id | HIGH_FREQ: user_id (类型=VARCHAR(64))<br/>HIGH_FREQ: status (类型=INTEGER) |
| `zhs_dictionary` | id | HIGH_FREQ: status (类型=INTEGER) |
| `zhs_education_platform` | code, id | HIGH_FREQ: status (类型=INTEGER) |
| `zhs_educational_course` | id | HIGH_FREQ: status (类型=INTEGER) |
| `zhs_exchange_rate` | id | HIGH_FREQ: status (类型=INTEGER) |
| `zhs_identity` | id | HIGH_FREQ: status (类型=INTEGER) |
| `zhs_identity_proportion` | id | HIGH_FREQ: status (类型=INTEGER) |
| `zhs_information` | id | HIGH_FREQ: status (类型=INTEGER) |
| `zhs_knowledge_planet` | id | HIGH_FREQ: status (类型=INTEGER) |
| `zhs_official_information` | id | HIGH_FREQ: status (类型=INTEGER) |
| `zhs_operate_token_flow` | id | HIGH_FREQ: user_id (类型=VARCHAR(64)) |
| `zhs_order` | id | HIGH_FREQ: user_id (类型=VARCHAR(64))<br/>HIGH_FREQ: status (类型=INTEGER) |
| `zhs_organization` | id | HIGH_FREQ: parent_id (类型=BIGINT)<br/>HIGH_FREQ: status (类型=INTEGER) |
| `zhs_popular_courses` | id | HIGH_FREQ: status (类型=INTEGER) |
| `zhs_product` | id | HIGH_FREQ: status (类型=INTEGER) |
| `zhs_product_identity` | id | HIGH_FREQ: status (类型=INTEGER) |
| `zhs_resources` | id | HIGH_FREQ: status (类型=INTEGER) |
| `zhs_user_agent_audio` | agent_id, id, user_uuid | ✓ |
| `zhs_user_agent_context` | agent_id, id, user_uuid | ✓ |
| `zhs_user_agent_free_time` | id | ✓ |
| `zhs_user_agent_image` | agent_id, id, user_uuid | ✓ |
| `zhs_user_comment_log` | id | ✓ |
| `zhs_user_model_chat` | id, user_uuid | ✓ |
| `zhs_user_platform` | id | HIGH_FREQ: status (类型=INTEGER) |
| `zhs_user_video_comment` | id | HIGH_FREQ: parent_id (类型=BIGINT)<br/>HIGH_FREQ: status (类型=INTEGER) |
| `zhs_user_video_log` | id | ✓ |
| `zhs_withdrawal_flow` | id | HIGH_FREQ: user_id (类型=VARCHAR(64))<br/>HIGH_FREQ: status (类型=INTEGER) |

## 修复建议

为每个缺失字段在 model __table_args__ 中添加 Index:
```python
__table_args__ = (
    Index('ix_table_status', 'status'),
    Index('ix_table_user_id', 'user_id'),
)
```