<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

> 原路径: C:\Users\Administrator\Documents\Trae-CN\default\db-ledger-rebind-dryrun-20261107.md
> 生成时间: 2026-11-07 09:29:23
> 所属工作线: 账本重绑线（dry-run 对账）

# 账本重绑 dry-run 对账表

- 生成时间: 2026-11-07T01:08:54.816Z
- journal 条目: 376 / 迁移文件: 376
- 账本行: 368
- 重绑候选(hash 唯一命中当前字节): 137
- 已自证(applied): 206
- 多重命中(不动): 0
- 零命中(不动): 25
- journal 无账本行(pending): 8
- 重绑后 created_at 冲突: 7
- 门模拟 before: applied 206 / hashDrift 162 / pending 8
- 门模拟 after (A 全量137): applied 343 / hashDrift 18 / pending 15
- 门模拟 after (B 跳过7冲突): applied 336 / hashDrift 28 / pending 12
- 静态还原校验(forward->rollback 等于当前状态): PASS

## 〇、两方案对照(均为内存模拟,未写库)

| 方案 | 移动条数 | applied | hashDrift(红) | pending | 备注 |
|---|---|---|---|---|---|
| 当前状态 | 0 | 206 | 162 | 8 | 基线 |
| A:严格按 hash 唯一命中全移动 | 137 | 343 | 18 | 15 | 7 条目标 when 与零命中旧行重复,7 条红被"掩绿",7 条 entry 变 pending |
| B:跳过 7 条冲突移动 | 130 | 336 | 28 | 12 | 保持 one-row-per-when;7 条目标 entry 继续红 |

方案 A 变 pending 的 8 条既有未应用 + 7 条新增空位: 0108_r83_supplement_27_tables, 0110_skills_tombstone, 0126_ai-world-sync, 0212_phase2_refund_invoice_fk, 20260913000000_llm_call_logs_config_id_bigint, 20260913160000_multimodal_billing, 20260916170000_api_subscription_windows_and_peak_pricing, 20261106150000_fix_missing_indexes_fks, 20261107000000_repair_api_subscription_drift, 20261107001000_drop_stale_refund_order_fk, 20261107002000_chat_share_token_expires_at, 20261107003000_crash_reports_user_fk, 20261107004000_edu_attendance_rule_partial_unique, 20261107005000_t4_not_null, 20261107006000_rewrite_default_cleanup

方案 B 变 pending: 0110_skills_tombstone, 0126_ai-world-sync, 0212_phase2_refund_invoice_fk, 20260913160000_multimodal_billing, 20261106150000_fix_missing_indexes_fks, 20261107000000_repair_api_subscription_drift, 20261107001000_drop_stale_refund_order_fk, 20261107002000_chat_share_token_expires_at, 20261107003000_crash_reports_user_fk, 20261107004000_edu_attendance_rule_partial_unique, 20261107005000_t4_not_null, 20261107006000_rewrite_default_cleanup


## 一、重绑候选逐行对账表

| # | ledger id | 原 when(ms) | 原位置 tag | → 目标 tag | 目标 when(ms) | 偏移 | 依据 | 置信度 | 可执行方案 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 562 | 1709331200000 | 0108_r83_supplement_27_tables | 0109_missing_migrations | 1709417600000 | +1 | hash 唯一命中当前字节 | 确定 | 仅 A(冲突,建议缓) |
| 2 | 564 | 1709504000000 | 0110_skills_tombstone | 0111_r76_indexes | 1709590400000 | +1 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 3 | 565 | 1709590400000 | 0111_r76_indexes | 0112_r80_new_tables | 1709676800000 | +1 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 4 | 566 | 1709676800000 | 0112_r80_new_tables | 0113_r81_zhs_agent_buy_fields | 1709763200000 | +1 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 5 | 567 | 1709763200000 | 0113_r81_zhs_agent_buy_fields | 0114_r81_edu_classes_tables | 1709849600000 | +1 | hash 唯一命中当前字节 | 确定 | 仅 A(冲突,建议缓) |
| 6 | 573 | 1710281600000 | 0123_pgvector_embedding | 0124_acoustic_iron_man | 1710368000000 | +1 | hash 唯一命中当前字节 | 确定 | 仅 A(冲突,建议缓) |
| 7 | 576 | 1710540800000 | 0126_ai-world-sync | 0126_reflective_greymalkin | 1710627200000 | +1 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 8 | 577 | 1710627200000 | 0126_reflective_greymalkin | 0127_dazzling_master_mold | 1710713600000 | +1 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 9 | 578 | 1710713600000 | 0127_dazzling_master_mold | 0128_robustness_p0_security | 1710800000000 | +1 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 10 | 579 | 1710800000000 | 0128_robustness_p0_security | 0129_codebase_embedding | 1710886400000 | +1 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 11 | 580 | 1710886400000 | 0129_codebase_embedding | 0130_two_factor | 1710972800000 | +1 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 12 | 581 | 1710972800000 | 0130_two_factor | 0143_drop_legacy_learn_tables | 1711059200000 | +1 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 13 | 582 | 1711059200000 | 0143_drop_legacy_learn_tables | 0123_pgvector_embedding | 1710281600000 | -9 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 14 | 583 | 1711145600000 | 0204_past_kinsey_walden | 20260720120000_add_missing_fields | 1713219200000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 15 | 584 | 1711232000000 | 0205_slim_sally_floyd | 20260720130000_add_2_minor_fields | 1713305600000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 16 | 585 | 1711318400000 | 0206_parent_student_binding | 20260720140000_workspace_permissions | 1713392000000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 17 | 586 | 1711404800000 | 0207_exam_score_ranking | 20260720150000_cli_provider_imports | 1713478400000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 18 | 587 | 1711491200000 | 0208_careless_prism | 20260720160000_self_media_published | 1713564800000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 19 | 588 | 1711577600000 | 0208_scheduling_batch4 | 20260720170000_publish_platform | 1713651200000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 20 | 589 | 1711664000000 | 0209_early_maggott | 20260720180000_search_hot_words | 1713737600000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 21 | 590 | 1711750400000 | 0209_homework_batch5 | 20260721180000_feedbacks_rating | 1713824000000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 22 | 591 | 1711836800000 | 0210_enrollment_batch6 | 20260722120000_g2_billing_safety | 1713910400000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 23 | 592 | 1711923200000 | 0210_opposite_rocket_racer | 20260722130000_g5_fk_audit_fix | 1713996800000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 24 | 593 | 1712009600000 | 0211_finance_batch7 | 20260722140000_g6_jsonb_defaults | 1714083200000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 25 | 594 | 1712096000000 | 0212_phase2_refund_invoice_fk | 20260722150000_g10_updated_by | 1714169600000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 26 | 595 | 1712182400000 | 0213_phase5_backfill_orders_sync | 20260722160000_g13_created_by | 1714256000000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 27 | 596 | 1712268800000 | 0214_cleanup_legacy_tenant_rls | 20260722170000_email_logs_create | 1714342400000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 28 | 597 | 1712355200000 | 0215_fuzzy_shadowcat | 20260722180000_llm_config_models_and_groups | 1714428800000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 29 | 598 | 1712441600000 | 0217_dry_tarot | 20260722190000_model_leaderboard | 1714515200000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 30 | 599 | 1712528000000 | 0218_wide_liz_osborn | 20260723120000_p3_deep_layer | 1714601600000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 31 | 600 | 1712614400000 | 0219_flowery_shotgun | 20260723130000_add_user_learning_tables | 1714688000000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 32 | 601 | 1712700800000 | 0220_wide_senator_kelly | 20260724120000_registry_sync_center | 1714774400000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 33 | 602 | 1712787200000 | 0221_wide_puff_adder | 20260724130000_audit_logs_chain | 1714860800000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 34 | 603 | 1712873600000 | 0222_demand_square_cover | 20260724140000_missing_15_tables | 1714947200000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 35 | 604 | 1712960000000 | 0223_add_srs_streams_user_id | 20260724180000_registry_items_payload_hash | 1715033600000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 36 | 605 | 1713046400000 | 0224_pretty_songbird | 20260724190000_resource_context_tables | 1715120000000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 37 | 606 | 1713132800000 | 0225_create_device_tokens | 20260725120000_agent_memory_decay_state | 1715206400000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 38 | 607 | 1713219200000 | 20260720120000_add_missing_fields | 20260725130000_agent_user_profile | 1715292800000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 39 | 608 | 1713305600000 | 20260720130000_add_2_minor_fields | 20260725140000_agent_meta_lessons | 1715379200000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 40 | 609 | 1713392000000 | 20260720140000_workspace_permissions | 20260725150000_agent_ab_tests | 1715465600000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 41 | 610 | 1713478400000 | 20260720150000_cli_provider_imports | 20260725160000_add_last_read_at_to_chat_conversations | 1715552000000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 42 | 611 | 1713564800000 | 20260720160000_self_media_published | 20260725160000_agent_multimodal_memory | 1715638400000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 43 | 612 | 1713651200000 | 20260720170000_publish_platform | 20260725160000_resource_products_pid | 1715724800000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 44 | 613 | 1713737600000 | 20260720180000_search_hot_words | 20260725170000_agent_federated_lessons | 1715811200000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 45 | 614 | 1713824000000 | 20260721180000_feedbacks_rating | 20260725180000_agent_session_summary | 1715897600000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 46 | 615 | 1713910400000 | 20260722120000_g2_billing_safety | 20260725190000_agent_metacognition_log | 1715984000000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 47 | 616 | 1713996800000 | 20260722130000_g5_fk_audit_fix | 20260727120000_p0_indexes | 1716070400000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 48 | 617 | 1714083200000 | 20260722140000_g6_jsonb_defaults | 20260728120000_vip_levels_quota_fields | 1716156800000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 49 | 618 | 1714169600000 | 20260722150000_g10_updated_by | 20260728130000_stage7_ai_careers_resources_fields | 1716243200000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 50 | 619 | 1714256000000 | 20260722160000_g13_created_by | 20260729120000_relay_billing | 1716329600000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 51 | 620 | 1714342400000 | 20260722170000_email_logs_create | 20260730120000_byok_commission | 1716416000000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 52 | 621 | 1714428800000 | 20260722180000_llm_config_models_and_groups | 20260731120000_developer_api_keys_security_fields | 1716502400000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 53 | 622 | 1714515200000 | 20260722190000_model_leaderboard | 20260731120001_llm_call_logs_cache_fields | 1716588800000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 54 | 623 | 1714601600000 | 20260723120000_p3_deep_layer | 20260731120002_ai_model_mappings | 1716675200000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 55 | 624 | 1714688000000 | 20260723130000_add_user_learning_tables | 20260731120004_redemption_codes | 1716761600000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 56 | 625 | 1714774400000 | 20260724120000_registry_sync_center | 20260801010001_llm_call_logs_relay_fields | 1716848000000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 57 | 626 | 1714860800000 | 20260724130000_audit_logs_chain | 20260801010002_ai_relay_channel_groups | 1716934400000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 58 | 627 | 1714947200000 | 20260724140000_missing_15_tables | 20260801010003_user_billing_groups | 1717020800000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 59 | 628 | 1715033600000 | 20260724180000_registry_items_payload_hash | 20260801010004_tiered_pricing_rules | 1717107200000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 60 | 629 | 1715120000000 | 20260724190000_resource_context_tables | 20260801010005_relay_commission_records | 1717193600000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 61 | 630 | 1715206400000 | 20260725120000_agent_memory_decay_state | 20260801010006_coupons | 1717280000000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 62 | 631 | 1715292800000 | 20260725130000_agent_user_profile | 20260801010007_webhook_subscriptions | 1717366400000 | +24 | hash 唯一命中当前字节 | 确定 | 仅 A(冲突,建议缓) |
| 63 | 632 | 1715379200000 | 20260725140000_agent_meta_lessons | 20260801010008_model_price_history | 1717452800000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 64 | 633 | 1715465600000 | 20260725150000_agent_ab_tests | 20260801010009_api_key_groups | 1717539200000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 65 | 634 | 1715552000000 | 20260725160000_add_last_read_at_to_chat_conversations | 20260801010010_add_tenant_id_to_developer_api_keys | 1717625600000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 66 | 635 | 1715638400000 | 20260725160000_agent_multimodal_memory | 20260801010020_add_user_passkeys_table | 1717712000000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 67 | 636 | 1715724800000 | 20260725160000_resource_products_pid | 20260801010030_add_usdt_payments_table | 1717798400000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 68 | 637 | 1715811200000 | 20260725170000_agent_federated_lessons | 20260801010040_add_api_key_shares_table | 1717884800000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 69 | 638 | 1715897600000 | 20260725180000_agent_session_summary | 20260801010050_add_channel_quota_fields | 1717971200000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 70 | 639 | 1715984000000 | 20260725190000_agent_metacognition_log | 20260801010060_add_api_key_tpm_tags | 1718057600000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 71 | 640 | 1716070400000 | 20260727120000_p0_indexes | 20260801010070_add_relay_conversations_table | 1718144000000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 72 | 641 | 1716156800000 | 20260728120000_vip_levels_quota_fields | 20260801010080_add_ai_model_sync_log | 1718230400000 | +24 | hash 唯一命中当前字节 | 确定 | 仅 A(冲突,建议缓) |
| 73 | 642 | 1716243200000 | 20260728130000_stage7_ai_careers_resources_fields | 20260801010090_add_model_sync_metadata | 1718316800000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 74 | 643 | 1716329600000 | 20260729120000_relay_billing | 20260801010100_add_points_multiplier | 1718403200000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 75 | 644 | 1716416000000 | 20260730120000_byok_commission | 20260801010200_add_im_tables | 1718489600000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 76 | 645 | 1716502400000 | 20260731120000_developer_api_keys_security_fields | 20260801020000_add_missing_20_tables | 1718576000000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 77 | 646 | 1716588800000 | 20260731120001_llm_call_logs_cache_fields | 20260801020000_clean_placeholder_keys | 1718662400000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 78 | 647 | 1716675200000 | 20260731120002_ai_model_mappings | 20260801030000_seed_home_schema | 1718748800000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 79 | 648 | 1716761600000 | 20260731120004_redemption_codes | 20260801040000_admin_test_verify_code_bypass | 1718835200000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 80 | 649 | 1716848000000 | 20260801010001_llm_call_logs_relay_fields | 20260802040000_user_devices | 1718921600000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 81 | 650 | 1716934400000 | 20260801010002_ai_relay_channel_groups | 20260804120000_publish_account_groups | 1719008000000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 82 | 651 | 1717020800000 | 20260801010003_user_billing_groups | 20260804130000_plugins | 1719094400000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 83 | 652 | 1717107200000 | 20260801010004_tiered_pricing_rules | 20260804140000_user_token_balance | 1719180800000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 84 | 653 | 1717193600000 | 20260801010005_relay_commission_records | 20260806001852_usdt_tx_hash_unique | 1719267200000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 85 | 654 | 1717280000000 | 20260801010006_coupons | 20260806003847_notification_message_indexes | 1719353600000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 86 | 656 | 1717452800000 | 20260801010008_model_price_history | 20260806153000_tenant_members_user_id_idx | 1719526400000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 87 | 657 | 1717539200000 | 20260801010009_api_key_groups | 20260806154900_crash_reports | 1719612800000 | +24 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 88 | 658 | 1717625600000 | 20260801010010_add_tenant_id_to_developer_api_keys | 0204_past_kinsey_walden | 1711145600000 | -75 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 89 | 659 | 1717712000000 | 20260801010020_add_user_passkeys_table | 0205_slim_sally_floyd | 1711232000000 | -75 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 90 | 660 | 1717798400000 | 20260801010030_add_usdt_payments_table | 0206_parent_student_binding | 1711318400000 | -75 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 91 | 661 | 1717884800000 | 20260801010040_add_api_key_shares_table | 0207_exam_score_ranking | 1711404800000 | -75 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 92 | 662 | 1717971200000 | 20260801010050_add_channel_quota_fields | 0208_careless_prism | 1711491200000 | -75 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 93 | 663 | 1718057600000 | 20260801010060_add_api_key_tpm_tags | 0209_early_maggott | 1711664000000 | -74 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 94 | 664 | 1718144000000 | 20260801010070_add_relay_conversations_table | 0210_opposite_rocket_racer | 1711923200000 | -72 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 95 | 666 | 1718316800000 | 20260801010090_add_model_sync_metadata | 0213_phase5_backfill_orders_sync | 1712182400000 | -71 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 96 | 667 | 1718403200000 | 20260801010100_add_points_multiplier | 0214_cleanup_legacy_tenant_rls | 1712268800000 | -71 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 97 | 668 | 1718489600000 | 20260801010200_add_im_tables | 0215_fuzzy_shadowcat | 1712355200000 | -71 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 98 | 669 | 1718576000000 | 20260801020000_add_missing_20_tables | 20260817000000_add_share_token_to_chat_conversations | 1719872000000 | +15 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 99 | 670 | 1718662400000 | 20260801020000_clean_placeholder_keys | 0217_dry_tarot | 1712441600000 | -72 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 100 | 671 | 1718748800000 | 20260801030000_seed_home_schema | 0218_wide_liz_osborn | 1712528000000 | -72 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 101 | 672 | 1718835200000 | 20260801040000_admin_test_verify_code_bypass | 0219_flowery_shotgun | 1712614400000 | -72 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 102 | 673 | 1718921600000 | 20260802040000_user_devices | 0220_wide_senator_kelly | 1712700800000 | -72 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 103 | 674 | 1719008000000 | 20260804120000_publish_account_groups | 0221_wide_puff_adder | 1712787200000 | -72 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 104 | 675 | 1719094400000 | 20260804130000_plugins | 0222_demand_square_cover | 1712873600000 | -72 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 105 | 676 | 1719180800000 | 20260804140000_user_token_balance | 0223_add_srs_streams_user_id | 1712960000000 | -72 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 106 | 677 | 1719267200000 | 20260806001852_usdt_tx_hash_unique | 0224_pretty_songbird | 1713046400000 | -72 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 107 | 678 | 1719353600000 | 20260806003847_notification_message_indexes | 0225_create_device_tokens | 1713132800000 | -72 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 108 | 679 | 1719526400000 | 20260806153000_tenant_members_user_id_idx | 20260808000000_create_service_inquiries | 1719699200000 | +2 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 109 | 680 | 1719612800000 | 20260806154900_crash_reports | 0208_scheduling_batch4 | 1711577600000 | -93 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 110 | 681 | 1719699200000 | 20260808000000_create_service_inquiries | 0209_homework_batch5 | 1711750400000 | -92 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 111 | 682 | 1719785600000 | 20260815000000_drop_audit_chain_entries | 0210_enrollment_batch6 | 1711836800000 | -92 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 112 | 683 | 1719872000000 | 20260817000000_add_share_token_to_chat_conversations | 0211_finance_batch7 | 1712009600000 | -91 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 113 | 684 | 1719958400000 | 20260820000000_extend_demand_square | 20260815000000_drop_audit_chain_entries | 1719785600000 | -2 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 114 | 685 | 1720044800000 | 20260822000000_feedback_file_path | 20260820000000_extend_demand_square | 1719958400000 | -1 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 115 | 686 | 1720131200000 | 20260829000000_create_agent_memory_semantic | 20260822000000_feedback_file_path | 1720044800000 | -1 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 116 | 687 | 1720217600000 | 20260830000000_add_pinned_to_chat_conversations | 20260829000000_create_agent_memory_semantic | 1720131200000 | -1 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 117 | 688 | 1720304000000 | 20260831000000_feature_gap_tables | 20260830000000_add_pinned_to_chat_conversations | 1720217600000 | -1 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 118 | 689 | 1720390400000 | 20260901000000_conversation_message_archives | 20260831000000_feature_gap_tables | 1720304000000 | -1 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 119 | 690 | 1720476800000 | 20260906173000_drop_dead_tables | 20260901000000_conversation_message_archives | 1720390400000 | -1 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 120 | 691 | 1720563200000 | 20260906174000_audit_partition_ensure_fn | 20260906173000_drop_dead_tables | 1720476800000 | -1 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 121 | 692 | 1720649600000 | 20260906180000_drop_dead_tables_batch2 | 20260906174000_audit_partition_ensure_fn | 1720563200000 | -1 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 122 | 693 | 1720736000000 | 20260906200000_add_risk_hits | 20260906180000_drop_dead_tables_batch2 | 1720649600000 | -1 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 123 | 694 | 1720822400000 | 20260906210000_add_perf_indexes | 20260906200000_add_risk_hits | 1720736000000 | -1 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 124 | 696 | 1720995200000 | 20260906_algorithm_record | 20260907000000_create_agent_runtime_sessions | 1721081600000 | +1 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 125 | 697 | 1721081600000 | 20260907000000_create_agent_runtime_sessions | 20260907010000_ai_pricing_numeric_precision | 1721168000000 | +1 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 126 | 698 | 1721168000000 | 20260907010000_ai_pricing_numeric_precision | 20260907020000_create_user_automations | 1721254400000 | +1 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 127 | 699 | 1721254400000 | 20260907020000_create_user_automations | 20260907030000_create_repo_wiki_docs | 1721340800000 | +1 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 128 | 700 | 1721340800000 | 20260907030000_create_repo_wiki_docs | 20260908010000_add_model_metadata_jsonb | 1721600000000 | +3 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 129 | 701 | 1721427200000 | 20260908000000_create_agent_event_triggers | 20260910000000_agent_tasks_workspace_team | 1721686400000 | +3 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 130 | 703 | 1721600000000 | 20260908010000_add_model_metadata_jsonb | 20260906210000_add_perf_indexes | 1720822400000 | -9 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 131 | 704 | 1721686400000 | 20260910000000_agent_tasks_workspace_team | 20260906_algorithm_record | 1720995200000 | -8 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 132 | 705 | 1721772800000 | 20260910030000_create_knowledge_cards | 20260908000000_create_agent_event_triggers | 1721427200000 | -4 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 133 | 706 | 1721859200000 | 20260913000000_llm_call_logs_config_id_bigint | 20260908000000_create_team_memories | 1721513600000 | -4 | hash 唯一命中当前字节 | 确定 | 仅 A(冲突,建议缓) |
| 134 | 707 | 1721945600000 | 20260913120000_unify_model_names | 20260910030000_create_knowledge_cards | 1721772800000 | -2 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 135 | 708 | 1722032000000 | 20260913140000_model_price_numeric | 20260913120000_unify_model_names | 1721945600000 | -1 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 136 | 709 | 1722118400000 | 20260913160000_multimodal_billing | 20260913140000_model_price_numeric | 1722032000000 | -1 | hash 唯一命中当前字节 | 确定 | A/B 均可 |
| 137 | 713 | 1722377600000 | 20260916170000_api_subscription_windows_and_peak_pricing | 20260913180000_llm_call_logs_provider_code_widen | 1722291200000 | -1 | hash 唯一命中当前字节 | 确定 | 仅 A(冲突,建议缓) |

## 二、不动清单

### 2.1 多重命中 (0)

（无）

### 2.2 零命中 (25)

| ledger id | 原 when(ms) | 原位置 tag | 上一轮归因 | 自身文件当前 hash | 账本 hash | 判定 |
|---|---|---|---|---|---|---|
| 539 | 1707344000000 | 0085_exam_wrong_unique | content-rewrite-stock | a702ec394bd07cc078b3bf02801e9aa56bb35f0a36a9e311e974da981a24564c | b86925ff305e9a4d3b9c5b2d9ed978d24e430e3fc24975b86c71a8d57b503c07 | 零命中：当前 376 文件无此字节 |
| 563 | 1709417600000 | 0109_missing_migrations | binding-next | ac3ca6731391b07674e6c20284f2b26b0981e31e978828093b250b299d090713 | 07492a6bc3f74e0e8fbb9f9fffc5075bd6efc36f460d609e1b7e92edda190959 | 零命中：当前 376 文件无此字节 |
| 568 | 1709849600000 | 0114_r81_edu_classes_tables | binding-next | 8e57baa1d88c85ee8543e93ff8399be098cc9f90e9fbbf7027641732c63a8554 | d1bba4ef742d15e3cfdcc5263c2152e1c2b791e49ecd6f8ff536bba8ead581ba | 零命中：当前 376 文件无此字节 |
| 569 | 1709936000000 | 0115_r82_seed_unique_indexes | binding-nonadjacent | 67d4832d2ef69cadd62a11d3dab9f0bb177bb8be34b2083ba284f32e82c1502c | aa4e1b6988310b849adb754c276c8e52e70bb9955a8cebacc2da6a35e9c32dbe | 零命中：当前 376 文件无此字节 |
| 574 | 1710368000000 | 0124_acoustic_iron_man | binding-next | add0b24a6459c97a86de0c899ef4b70779e7d84297760d9dc4e0ff73d90c79b1 | 4fe6bb2dcbd5bc27f4533e6fd821873d3fcd63a25de3b0785f777962d6013bd1 | 零命中：当前 376 文件无此字节 |
| 575 | 1710454400000 | 0125_knowledge_graph | binding-next | 604ea6231e33eea091b80a803f186688175319f118fdbe435317d13d65ab75e0 | ab42e105ef9177e2037ee7252446ee3e802d7614bedfa0f8b6a180d06c4b8a28 | 零命中：当前 376 文件无此字节 |
| 731 | 1717366400000 | 20260801010007_webhook_subscriptions | binding-nonadjacent | d2347d8654cd2032af0827538720b1b44ce923afac6ca534174e807f379c9cd9 | 7a7c48ba44cfba3e629798284440c3dc7a51683ca883ae2f0daf8d7d5e1e53d0 | 零命中：当前 376 文件无此字节 |
| 665 | 1718230400000 | 20260801010080_add_ai_model_sync_log | binding-nonadjacent | a6b99de36554c1e5db02ed558377e013a6ba9b05682092746406253b2958f588 | ce371d7d224c95becb91d20826dd65dcc112e7b8c12c86e77df7395a2e22c548 | 零命中：当前 376 文件无此字节 |
| 702 | 1721513600000 | 20260908000000_create_team_memories | binding-nonadjacent | bd19789a8ab9e8081164f1bc5f581e3916a303ee219cbb038bd3d7301d312858 | 2bbebc3aefc7c292b02db3f0d9b615871e6df7dda392f267f6f09086c137aea4 | 零命中：当前 376 文件无此字节 |
| 710 | 1722204800000 | 20260913170000_cost_cents_numeric | binding-prev | 4e70705604ac05c4ae8aa8b873d54c3045f0460028a810855a1d337af6cfc980 | fbff77c71ca50595a2868448d4dc9eb52a28d596db31e694a787adb4c866de68 | 零命中：当前 376 文件无此字节 |
| 711 | 1722291200000 | 20260913180000_llm_call_logs_provider_code_widen | binding-prev | 212fd013b7d49adeebe1844a04b7c80f0f86176171a8f2e6b7dfc2a1783b1715 | 35b5e8119364f3825ff7e9a73f95f9271f2e39d7633dc4a84158e10ac0d927da | 零命中：当前 376 文件无此字节 |
| 727 | 1723587200000 | 20260917100000_admin_console_modules | content-rewrite-stock | 3ec6bc79ebaaf20529933124a7df8808d3c00d244f91a7bd86c8754138cce747 | b16eaac2f03b843f67c2faca3d6081e6c35d4a38a066185302136970199e0e75 | 零命中：当前 376 文件无此字节 |
| 729 | 1789781361777 | 20260919100000_edu_canteen | content-rewrite-stock | 587fc12e76291b4b2abec6318f65450122f176925d6f1be6573e178bf5b779b1 | eb145e9b01ae23eb032345ffa7feb0faf4f45c31743816a4abc34b1c0b3f432c | 零命中：当前 376 文件无此字节 |
| 1533 | 1789833776532 | 20260919140000_user_emails | content-rewrite-stock | c9d3227aa1a6d7488770fb20cbd0a08ce320fb91686d53a88a5309b5b87887ca | 33d94911893bbcff2c77fe8a7e3aa7dfdde3e22fb189871ea975960fee6b79f1 | 零命中：当前 376 文件无此字节 |
| 1534 | 1789873200000 | 20260920110000_conversation_imports | content-rewrite-stock | bd2e024a9171ed5598d07ccabfe0054dc58187f2cfddd818df44b319e0098aca | 5b3a23b3e22ed57994fbfbd58e97f3a2c25b078700318c58bce3a00e5f935eb8 | 零命中：当前 376 文件无此字节 |
| 1535 | 1789886400000 | 20260920170000_agent_checkpoints | content-rewrite-stock | c19cee37e2e68c7b937b9fb2617b9fc727ec1087b6361ef65b7765d7ffd00255 | a686e704fd22998d214f564827acde1e9dee6f98aaa81ca8706e4626f74cee36 | 零命中：当前 376 文件无此字节 |
| 1541 | 1790215200000 | 20260924100000_chat_history_projection | content-rewrite-stock | 9f4f785d14934be9093bfb9d3660605f8edf6eb2932a8836774c8e9a81ab8d75 | 90fd90822923463ff35bc2356cb8fa13911c007a60785e0fef1e18c841c5216a | 零命中：当前 376 文件无此字节 |
| 1543 | 1790388000000 | 20260926100000_github_app_tables | content-rewrite-stock | 269cb50f88da508fb87d389034ec4fe2a0a46d9bbe99741a7f5d991ead22db5d | 2c9841f1e8d742c1632739a069dccbb71a9dcb9cc82a41cea77d352aa0307e8b | 零命中：当前 376 文件无此字节 |
| 1555 | 1790769600000 | 20260930120000_edu_study_loops | unattributable | 04e46b4e88f76659d220fd5deb9ee081466f14b8202da35509ace964653421e3 | cd4ddc12bb050c7497019d81c96a2617cc4ecb6613c7f2bcafdff9c09857e5b2 | 零命中：当前 376 文件无此字节 |
| 1556 | 1790773200000 | 20260930130000_points_mall_orders | content-rewrite-stock | 8c3000be74bfbd97c358dbac1c8c5ea680a3dfd9d96c1ce3065b11383b18fd95 | 41d468beab4e64ed48f3e6cfb41d7f017633ec953a326a438d0babb892cb65aa | 零命中：当前 376 文件无此字节 |
| 1560 | 1790964000000 | 20261003020000_codebase_chunks_tenant_ttl | unattributable | 8645f5633dcf4ab3e6c40229491aa0b4beee7083300cb16bd8a135e0d26c820d | 694f474dd6ea1929e16eafa8866c36aea4d22943d0bd9497b8447569cb578671 | 零命中：当前 376 文件无此字节 |
| 1600 | 1792310400000 | 20261018160000_agent_state_tables_runtime_reality | content-rewrite-branch | ad664d985490066c1be2948f481a9fc732a31c898b70e7da56c40d0e5a2abb9d | b91bcb638f32e9b542193cea31fd77af9955cd4d4ca4481e0e6a18e8596d31a6 | 零命中：当前 376 文件无此字节 |
| 1612 | 1792778400000 | 20261023180000_relay_account_pool_owner | content-rewrite-stock | bf702c1d64c6cb0e5ff07a5c83c9aea1ae3bd71371d9b6e44a463605c126451a | 687796a50c2ac89e4d270a3f86519b567c9a302543b4ba0623ddc6692f0fe283 | 零命中：当前 376 文件无此字节 |
| 1624 | 1793064600000 | 20261027090000_default_user_avatar | content-rewrite-stock | db7e06a4a6453ecda7e4b7b0bf9bf1ef8ec63d6cba5fec39efbb349674a7c8b4 | 5a4b85d24b9432f2815a2732648bc75e0e4467fb0b1cef87fd18d84ab6ada34d | 零命中：当前 376 文件无此字节 |
| 1642 | 1793764800000 | 20261104120000_agent_team_collab | content-rewrite-stock | d487b1af0b26ee77a17055bb04347c21c602f29429c822e303be354ee36bf4ab | 394ed8423ee3ef3701a1513eb30542a5965ac38e967a2afdd4313cf7db1ddb86 | 零命中：当前 376 文件无此字节 |

## 三、重绑后 created_at 冲突

| when | tag | 冲突行 | 是否自身 hash |
|---|---|---|---|
| 1709417600000 | 0109_missing_migrations | 562(移入) / 563 | 562:Y / 563:N |
| 1709849600000 | 0114_r81_edu_classes_tables | 567(移入) / 568 | 567:Y / 568:N |
| 1710368000000 | 0124_acoustic_iron_man | 573(移入) / 574 | 573:Y / 574:N |
| 1717366400000 | 20260801010007_webhook_subscriptions | 631(移入) / 731 | 631:Y / 731:N |
| 1718230400000 | 20260801010080_add_ai_model_sync_log | 641(移入) / 665 | 641:Y / 665:N |
| 1721513600000 | 20260908000000_create_team_memories | 702 / 706(移入) | 702:N / 706:Y |
| 1722291200000 | 20260913180000_llm_call_logs_provider_code_widen | 711 / 713(移入) | 711:N / 713:Y |

冲突成因:该 when 上已有一条零命中旧行（上表 2.2 中的历史 blob 记录），移入行才是该 tag 当前字节的记录。移入后同一 when 出现两行：
- 门只会看到「本 tag 当前 hash 在该 when 的行集合里」⇒ 7 条原本红的目标 entry 被掩绿，而旧行仍在账本里、不再被任何判据看见；
- 同时被移出行原来的 when 失去唯一行 ⇒ 7 条 entry 变 pending；
- 这 7 条正是方案 A 与方案 B 的唯一差别。删除旧行不在本次授权范围（属于写生产账本 + 删审计记录），因此单列待批。

## 四、forward / rollback SQL

```sql
-- forward: created_at 重绑（dry-run 产物，未执行）
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1709417600000 WHERE "id" = 562 AND "hash" = 'ac3ca6731391b07674e6c20284f2b26b0981e31e978828093b250b299d090713'; -- 1709331200000 -> 1709417600000 0109_missing_migrations
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1709590400000 WHERE "id" = 564 AND "hash" = '07053a2669eb9b3e1dbf490312ac53d0380f74af1695f6b45e9764f1af9e6cd6'; -- 1709504000000 -> 1709590400000 0111_r76_indexes
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1709676800000 WHERE "id" = 565 AND "hash" = 'b17b42e4ec7668f82007e74e025d078f35dde08bb8d26070e2576d9283c3fd63'; -- 1709590400000 -> 1709676800000 0112_r80_new_tables
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1709763200000 WHERE "id" = 566 AND "hash" = '1c287d947f7ec0600999d1295b37f15ddbabebe459320f94d8944623710c62ad'; -- 1709676800000 -> 1709763200000 0113_r81_zhs_agent_buy_fields
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1709849600000 WHERE "id" = 567 AND "hash" = '8e57baa1d88c85ee8543e93ff8399be098cc9f90e9fbbf7027641732c63a8554'; -- 1709763200000 -> 1709849600000 0114_r81_edu_classes_tables
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1710368000000 WHERE "id" = 573 AND "hash" = 'add0b24a6459c97a86de0c899ef4b70779e7d84297760d9dc4e0ff73d90c79b1'; -- 1710281600000 -> 1710368000000 0124_acoustic_iron_man
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1710627200000 WHERE "id" = 576 AND "hash" = '3751ab366b82d11c908f6c2dbfa7c8a1ddff985408a673b003fd5c3b4b569ba6'; -- 1710540800000 -> 1710627200000 0126_reflective_greymalkin
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1710713600000 WHERE "id" = 577 AND "hash" = '367e521f44f2cd73e4f5d1f04063a9057381b9626cedbdaac6ea6aa99dead3d4'; -- 1710627200000 -> 1710713600000 0127_dazzling_master_mold
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1710800000000 WHERE "id" = 578 AND "hash" = 'd0fd2c4a5edc9491daa9c1754afd7c75b2afe1184f3d8d2cdc8a32fd08b3fa36'; -- 1710713600000 -> 1710800000000 0128_robustness_p0_security
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1710886400000 WHERE "id" = 579 AND "hash" = 'a780c7aed98874d829b57e936371b4ff79b5cb52f82c86743f7bce76eff5f727'; -- 1710800000000 -> 1710886400000 0129_codebase_embedding
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1710972800000 WHERE "id" = 580 AND "hash" = '30823becbd2263e15c726c145cfb1d473510b0d3d6187afe28d9c5fc7504569b'; -- 1710886400000 -> 1710972800000 0130_two_factor
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1711059200000 WHERE "id" = 581 AND "hash" = '439d17c9591931daafd505814dfd7e5d88cc0427676396ae383244502f038768'; -- 1710972800000 -> 1711059200000 0143_drop_legacy_learn_tables
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1710281600000 WHERE "id" = 582 AND "hash" = 'a36ea64bcf7b520e815170c96f3768b127b53f4fd50017de052e62740ea6d773'; -- 1711059200000 -> 1710281600000 0123_pgvector_embedding
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1713219200000 WHERE "id" = 583 AND "hash" = '0ba025554f9ece777a1fcb01b9300bc0e97d3bdf984da8d04378592ef3f47e3e'; -- 1711145600000 -> 1713219200000 20260720120000_add_missing_fields
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1713305600000 WHERE "id" = 584 AND "hash" = '34313e0c35747f1c4422f26b12ff18dd181a7b2aae196a5848b1e911da3d6e44'; -- 1711232000000 -> 1713305600000 20260720130000_add_2_minor_fields
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1713392000000 WHERE "id" = 585 AND "hash" = '41bfb734cadc62e55853ab53def96384813d4a47d47a4b99f197359094f231cd'; -- 1711318400000 -> 1713392000000 20260720140000_workspace_permissions
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1713478400000 WHERE "id" = 586 AND "hash" = 'ba4c760a473029184a5f84a39349314efe77aaf5b75c62fc7b9e899de44c4f5a'; -- 1711404800000 -> 1713478400000 20260720150000_cli_provider_imports
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1713564800000 WHERE "id" = 587 AND "hash" = '4025c97ee2c2d20bea3e3a0fec1b179198a01e5b371ad97725e4bab0fa2736a4'; -- 1711491200000 -> 1713564800000 20260720160000_self_media_published
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1713651200000 WHERE "id" = 588 AND "hash" = 'a10740217eb56cce43c1ef25c7f36967427f00df85eb97df3ebd51da797f40ee'; -- 1711577600000 -> 1713651200000 20260720170000_publish_platform
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1713737600000 WHERE "id" = 589 AND "hash" = '55e7e4748a1d0db637c22707a27e4a8bb394c24b46cef87c2eab3ae18039e949'; -- 1711664000000 -> 1713737600000 20260720180000_search_hot_words
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1713824000000 WHERE "id" = 590 AND "hash" = '0c7e0f64dd45f8a465c9b0833aa464bbd164d053ab584f8d4194d040cc749429'; -- 1711750400000 -> 1713824000000 20260721180000_feedbacks_rating
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1713910400000 WHERE "id" = 591 AND "hash" = 'fb15d504c46ce09cb8233f1258d77e8ed0b7d50e2a2abfcb26564ab42adb9f99'; -- 1711836800000 -> 1713910400000 20260722120000_g2_billing_safety
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1713996800000 WHERE "id" = 592 AND "hash" = 'd30a8c01348b518215a4167c035e4d76de0bc04b7e1ade9b1c8f1d387b0a279c'; -- 1711923200000 -> 1713996800000 20260722130000_g5_fk_audit_fix
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1714083200000 WHERE "id" = 593 AND "hash" = 'c3890ab51c56a8a42dacc45c59e599b1305672e2c8f45c8b55ffe9c37e60ffce'; -- 1712009600000 -> 1714083200000 20260722140000_g6_jsonb_defaults
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1714169600000 WHERE "id" = 594 AND "hash" = 'd1cb9e386d6e62862b99c4e5eda41283cebfd1704093ba5795a628cf037cf927'; -- 1712096000000 -> 1714169600000 20260722150000_g10_updated_by
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1714256000000 WHERE "id" = 595 AND "hash" = '8e789b7bab9ac015cc72cf7b064c93a2e80c72161f2b5466dee75e5df5f075cf'; -- 1712182400000 -> 1714256000000 20260722160000_g13_created_by
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1714342400000 WHERE "id" = 596 AND "hash" = '233f9d99819a570cccbe15cbe64d43cd749836b471ca2b851c70d942cac04b8a'; -- 1712268800000 -> 1714342400000 20260722170000_email_logs_create
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1714428800000 WHERE "id" = 597 AND "hash" = 'a15d58797133fbc7c7e81dd25951e45ec1c77a857ab8f146597f30361e30ddd4'; -- 1712355200000 -> 1714428800000 20260722180000_llm_config_models_and_groups
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1714515200000 WHERE "id" = 598 AND "hash" = '412766a89b0c2ec899999ffefc831ea896a00d3888fbf57eaf2f2454910c14d6'; -- 1712441600000 -> 1714515200000 20260722190000_model_leaderboard
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1714601600000 WHERE "id" = 599 AND "hash" = 'f6a49377ae126e8ba5ca133893eb9baa61b15162a35dc657fa4c1ce8ed7720a2'; -- 1712528000000 -> 1714601600000 20260723120000_p3_deep_layer
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1714688000000 WHERE "id" = 600 AND "hash" = '1321be7a16412d9939061e40efa94e3a7241c9b075715bea6a0360baa810b842'; -- 1712614400000 -> 1714688000000 20260723130000_add_user_learning_tables
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1714774400000 WHERE "id" = 601 AND "hash" = '961bbe0049f9640b62ab1cfa3c4125a0c378392787382fd2dd5d23a4188e6c85'; -- 1712700800000 -> 1714774400000 20260724120000_registry_sync_center
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1714860800000 WHERE "id" = 602 AND "hash" = '5a2e3cd7292e0e4dfd70e6678e3f32eda3c6344527db2ccbb861f823bd6a8f4d'; -- 1712787200000 -> 1714860800000 20260724130000_audit_logs_chain
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1714947200000 WHERE "id" = 603 AND "hash" = '6e4a141a3cddafa86e27efc55ff9c8c4ff861a1b524db28e6fd4dde8c2fbe1a7'; -- 1712873600000 -> 1714947200000 20260724140000_missing_15_tables
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1715033600000 WHERE "id" = 604 AND "hash" = '2c786156d363d817968cd3bf4d4c5784486de98f31a25697460136f2c9f9ea1e'; -- 1712960000000 -> 1715033600000 20260724180000_registry_items_payload_hash
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1715120000000 WHERE "id" = 605 AND "hash" = 'bf7824526cf34fa327059171fee130f9c2c2ab34903a8bcccdfb8b20556c63c9'; -- 1713046400000 -> 1715120000000 20260724190000_resource_context_tables
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1715206400000 WHERE "id" = 606 AND "hash" = 'f49f87c8c6dd6afb3d2086fe231abafae0339b70ad2066271207d8eee873638a'; -- 1713132800000 -> 1715206400000 20260725120000_agent_memory_decay_state
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1715292800000 WHERE "id" = 607 AND "hash" = 'ca4da1e4a1b53f7171f6f33f25690d0754cdd4e32c5272700b071938a53509e1'; -- 1713219200000 -> 1715292800000 20260725130000_agent_user_profile
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1715379200000 WHERE "id" = 608 AND "hash" = '513937c8d1115d416177650deb1622a1a82fa1428bf4bed34535df53ebd1254d'; -- 1713305600000 -> 1715379200000 20260725140000_agent_meta_lessons
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1715465600000 WHERE "id" = 609 AND "hash" = '0c11bfdcb75220ecf121f58fb3175ee4167ea343d6aa2b48c3494d2854ab48ae'; -- 1713392000000 -> 1715465600000 20260725150000_agent_ab_tests
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1715552000000 WHERE "id" = 610 AND "hash" = '630e6c8673a71f33e6f584f2d524aa4a85be35e4a730ac61b64a77d39312137a'; -- 1713478400000 -> 1715552000000 20260725160000_add_last_read_at_to_chat_conversations
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1715638400000 WHERE "id" = 611 AND "hash" = 'ca87ffa97a469e8bcfd3b0689d528de8923d02f74edf420c87d201a83eb33132'; -- 1713564800000 -> 1715638400000 20260725160000_agent_multimodal_memory
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1715724800000 WHERE "id" = 612 AND "hash" = 'bb4684a74c77d9fa6379a5e1413296d27cceb9fc55b8723c259057fc808df45b'; -- 1713651200000 -> 1715724800000 20260725160000_resource_products_pid
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1715811200000 WHERE "id" = 613 AND "hash" = 'c902d202d89b174a1633f097c93cdc138f058de80fdedd77d412b5288620c012'; -- 1713737600000 -> 1715811200000 20260725170000_agent_federated_lessons
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1715897600000 WHERE "id" = 614 AND "hash" = '0330631a49e640437cf8aa69d12be00979a656329fcb656e86f841f8ad62edec'; -- 1713824000000 -> 1715897600000 20260725180000_agent_session_summary
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1715984000000 WHERE "id" = 615 AND "hash" = '802241103f157de518918818e89bdc5e3a75348901df4d4e6a525bc910e403da'; -- 1713910400000 -> 1715984000000 20260725190000_agent_metacognition_log
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1716070400000 WHERE "id" = 616 AND "hash" = 'c2550986487e37165eeeabd1dba79d2a2932c2c810850e23ba101f3be05c9d1d'; -- 1713996800000 -> 1716070400000 20260727120000_p0_indexes
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1716156800000 WHERE "id" = 617 AND "hash" = '5e56362956fae679adc6ee0c7110a3ea8da76b56b7815b90e7f0c7bd90938d22'; -- 1714083200000 -> 1716156800000 20260728120000_vip_levels_quota_fields
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1716243200000 WHERE "id" = 618 AND "hash" = '99e3e6502a6bab11050a78f789290fe1009120838bf6795138befc4a5a6f8f1c'; -- 1714169600000 -> 1716243200000 20260728130000_stage7_ai_careers_resources_fields
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1716329600000 WHERE "id" = 619 AND "hash" = 'a74560c0dabbe5f8e21d920713f8a011cc119124e182935e62a4428bc7fb4579'; -- 1714256000000 -> 1716329600000 20260729120000_relay_billing
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1716416000000 WHERE "id" = 620 AND "hash" = '5269273c0949866f9552204017ac227d989db384e80ab10792f6d0381fb107ec'; -- 1714342400000 -> 1716416000000 20260730120000_byok_commission
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1716502400000 WHERE "id" = 621 AND "hash" = 'ed1dd53a9406ca621ca84f376fe78910c0d098c83e65c007532e61a2056c859c'; -- 1714428800000 -> 1716502400000 20260731120000_developer_api_keys_security_fields
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1716588800000 WHERE "id" = 622 AND "hash" = 'df761ec568cc9da1f1660a463fefe5be69850a8bfda100b8c3dee3d5acd7c6f4'; -- 1714515200000 -> 1716588800000 20260731120001_llm_call_logs_cache_fields
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1716675200000 WHERE "id" = 623 AND "hash" = '867bef6f8f8091bd278a3d613d490b1d1d017ac70afc58964f4b68ba34dceb7b'; -- 1714601600000 -> 1716675200000 20260731120002_ai_model_mappings
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1716761600000 WHERE "id" = 624 AND "hash" = '074805b3272473715f91033b3f1557a948c7c66c447f95b8661ca1f64aeba4bd'; -- 1714688000000 -> 1716761600000 20260731120004_redemption_codes
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1716848000000 WHERE "id" = 625 AND "hash" = 'f962d464555305aee6ec458eefaab1aab24fdbbd7d4bd4b8f168c9333caf3176'; -- 1714774400000 -> 1716848000000 20260801010001_llm_call_logs_relay_fields
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1716934400000 WHERE "id" = 626 AND "hash" = 'f4634bff75f9884dd968f8587c0a1b582da4173ea9a56dbf7e9e781ded812ef5'; -- 1714860800000 -> 1716934400000 20260801010002_ai_relay_channel_groups
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1717020800000 WHERE "id" = 627 AND "hash" = '610026ea96da729547ce3d7a684df5f51efe4f13cfcd761d537226a6077ed96e'; -- 1714947200000 -> 1717020800000 20260801010003_user_billing_groups
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1717107200000 WHERE "id" = 628 AND "hash" = '5322e59d9fc1ffd70e76c83e658effe46290955f533ae7a0e47c29c973258afc'; -- 1715033600000 -> 1717107200000 20260801010004_tiered_pricing_rules
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1717193600000 WHERE "id" = 629 AND "hash" = '6d192f0c8dc4f62972c134d1a0214878be94501aa1025fb7bc8480d20df952c3'; -- 1715120000000 -> 1717193600000 20260801010005_relay_commission_records
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1717280000000 WHERE "id" = 630 AND "hash" = 'c713f548edf63d57507a86ab8dc30c0852d9819ae291c47d4a49c82f395c1a77'; -- 1715206400000 -> 1717280000000 20260801010006_coupons
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1717366400000 WHERE "id" = 631 AND "hash" = 'd2347d8654cd2032af0827538720b1b44ce923afac6ca534174e807f379c9cd9'; -- 1715292800000 -> 1717366400000 20260801010007_webhook_subscriptions
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1717452800000 WHERE "id" = 632 AND "hash" = 'ffa722bf30a69af2a6e7f6030d4ffd7ae2b37f10987ed011af9328f006c271ff'; -- 1715379200000 -> 1717452800000 20260801010008_model_price_history
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1717539200000 WHERE "id" = 633 AND "hash" = '976d211fc242fde50260f7bf4e6f1035fbc4cd38c02614aadb2dd78268b35c89'; -- 1715465600000 -> 1717539200000 20260801010009_api_key_groups
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1717625600000 WHERE "id" = 634 AND "hash" = 'cdfbfa4e7c261f76b99ccb5832ec61221a49f0e1c36376750708d9e8797c5b78'; -- 1715552000000 -> 1717625600000 20260801010010_add_tenant_id_to_developer_api_keys
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1717712000000 WHERE "id" = 635 AND "hash" = '9499e7073d5104eec07b6ee65ef1c55c81a6d60bf07a4f5db296f5c4a5d06e21'; -- 1715638400000 -> 1717712000000 20260801010020_add_user_passkeys_table
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1717798400000 WHERE "id" = 636 AND "hash" = '806764501ab0e837bc5de4344187f8d5ef457a71f3c7a661b46d6097c8e743bf'; -- 1715724800000 -> 1717798400000 20260801010030_add_usdt_payments_table
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1717884800000 WHERE "id" = 637 AND "hash" = '3ee96f50cc7c5fa60b7d11ce110aca135fc07d4e5fe9a09ba71fbd7fe64d90c9'; -- 1715811200000 -> 1717884800000 20260801010040_add_api_key_shares_table
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1717971200000 WHERE "id" = 638 AND "hash" = '228626ba5e5d37294c210d64f6b212d7c109b702f39cfa18e6bbd230c2981437'; -- 1715897600000 -> 1717971200000 20260801010050_add_channel_quota_fields
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1718057600000 WHERE "id" = 639 AND "hash" = '3c021844d299fe7276d1e69650652e29528fee4a74472879a87804319accfb33'; -- 1715984000000 -> 1718057600000 20260801010060_add_api_key_tpm_tags
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1718144000000 WHERE "id" = 640 AND "hash" = '6e3058cf915eb9e720bae29cb4e3670faa6d15a2ab8ccd8a8719a2f9cb9e6c36'; -- 1716070400000 -> 1718144000000 20260801010070_add_relay_conversations_table
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1718230400000 WHERE "id" = 641 AND "hash" = 'a6b99de36554c1e5db02ed558377e013a6ba9b05682092746406253b2958f588'; -- 1716156800000 -> 1718230400000 20260801010080_add_ai_model_sync_log
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1718316800000 WHERE "id" = 642 AND "hash" = '4238618c9172da75eb2993342ae6c24734de5693d938246c95aa38fd90d7d98e'; -- 1716243200000 -> 1718316800000 20260801010090_add_model_sync_metadata
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1718403200000 WHERE "id" = 643 AND "hash" = 'a8c335fbf031b51342c9419d21dd05b69e44e9971ef1930ef1238dd2215c837d'; -- 1716329600000 -> 1718403200000 20260801010100_add_points_multiplier
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1718489600000 WHERE "id" = 644 AND "hash" = '2b9e02d2e8a3be03814e92c4df78e9c5d88915cd597d86fd0e70e2a33e38cf72'; -- 1716416000000 -> 1718489600000 20260801010200_add_im_tables
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1718576000000 WHERE "id" = 645 AND "hash" = 'aed890160f13d3e155e585bdd69f13f7947643a1f5ace9e58611b76322b61395'; -- 1716502400000 -> 1718576000000 20260801020000_add_missing_20_tables
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1718662400000 WHERE "id" = 646 AND "hash" = '69858760a60a3a64072db1209a602f035a787833972c6d1bbc11b99f0538b495'; -- 1716588800000 -> 1718662400000 20260801020000_clean_placeholder_keys
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1718748800000 WHERE "id" = 647 AND "hash" = '28b50e6e04a6c9f9a3a7df7fb39a95880ff8f33121b62d8075c0c2c6f03e5986'; -- 1716675200000 -> 1718748800000 20260801030000_seed_home_schema
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1718835200000 WHERE "id" = 648 AND "hash" = '5cc9b22f2b786f9481a6bf51266c1a27ceffcdf0abe7e25e296878d98238f10b'; -- 1716761600000 -> 1718835200000 20260801040000_admin_test_verify_code_bypass
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1718921600000 WHERE "id" = 649 AND "hash" = '98da26f63f16eb633f13901f55b8e388bf8708f8e6a209774d219f4494cc3820'; -- 1716848000000 -> 1718921600000 20260802040000_user_devices
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1719008000000 WHERE "id" = 650 AND "hash" = '9657875c4a856276b6cdffc52fd74485fcb780dbacff059137f65aa73bb6cd23'; -- 1716934400000 -> 1719008000000 20260804120000_publish_account_groups
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1719094400000 WHERE "id" = 651 AND "hash" = '64496baaab9bb39675c3bbabd699ba12c9e4b5e168fd8ffd769fec7718a1b4a9'; -- 1717020800000 -> 1719094400000 20260804130000_plugins
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1719180800000 WHERE "id" = 652 AND "hash" = '8dfa4999031e503b083706add9473c476ffca382dad18365282c9cff860c731d'; -- 1717107200000 -> 1719180800000 20260804140000_user_token_balance
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1719267200000 WHERE "id" = 653 AND "hash" = '348d372b8f1d830c0b00910f069c77ec0050b952e1656076440b412637c7d874'; -- 1717193600000 -> 1719267200000 20260806001852_usdt_tx_hash_unique
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1719353600000 WHERE "id" = 654 AND "hash" = '75f01d4eda1ccff42c60a2ed8e73cb02bfafeb8e06e8feb20982ee43b16e04e8'; -- 1717280000000 -> 1719353600000 20260806003847_notification_message_indexes
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1719526400000 WHERE "id" = 656 AND "hash" = 'c532681e9e34a836d69c7e0bd4456f842e09648d6b3839bb00b14a3919b71530'; -- 1717452800000 -> 1719526400000 20260806153000_tenant_members_user_id_idx
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1719612800000 WHERE "id" = 657 AND "hash" = '24cb9d746ee04b3b73787bf4ef795418ee8a14c5a82173411c2f4d5574dda1eb'; -- 1717539200000 -> 1719612800000 20260806154900_crash_reports
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1711145600000 WHERE "id" = 658 AND "hash" = 'b37251963712fdc96bdc8644ecbe5da0e152ae3e41b6a64cb9093b9a0f478f9f'; -- 1717625600000 -> 1711145600000 0204_past_kinsey_walden
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1711232000000 WHERE "id" = 659 AND "hash" = '370007887a735fcda007000f0415ac08eccbc9c014eb41671baab6f2bf333238'; -- 1717712000000 -> 1711232000000 0205_slim_sally_floyd
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1711318400000 WHERE "id" = 660 AND "hash" = 'b99c9c30caa119771fb45fe250b5b6bcaca211e5bf54a865c8c4dfb8065ea5e7'; -- 1717798400000 -> 1711318400000 0206_parent_student_binding
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1711404800000 WHERE "id" = 661 AND "hash" = 'ab5fbf59bffe75d67ce0d1969b48f19b2711aff5f71ecba93bcd67e3d41ab9be'; -- 1717884800000 -> 1711404800000 0207_exam_score_ranking
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1711491200000 WHERE "id" = 662 AND "hash" = 'b9cde1c40830d5abfe8680eff07c5eae67af581a3d02a53361442e8032d430c5'; -- 1717971200000 -> 1711491200000 0208_careless_prism
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1711664000000 WHERE "id" = 663 AND "hash" = '822584b0a602af8f5427c73692e4b443efedf68ac5f3ddb73c55cdd43fd560ff'; -- 1718057600000 -> 1711664000000 0209_early_maggott
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1711923200000 WHERE "id" = 664 AND "hash" = 'f273c84e57df6a40dc1ce3ad5459f08992a97f2397a307f04d703f9e2c27a667'; -- 1718144000000 -> 1711923200000 0210_opposite_rocket_racer
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1712182400000 WHERE "id" = 666 AND "hash" = '307e4538a191ce1a656a4bafa208669fb7ce3e79d192611ee6313229b785b1fe'; -- 1718316800000 -> 1712182400000 0213_phase5_backfill_orders_sync
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1712268800000 WHERE "id" = 667 AND "hash" = '633f94c08d0b6491ffd580aaf0ce1f748d3c76d5c8d4e86b44acf0f8fab01c04'; -- 1718403200000 -> 1712268800000 0214_cleanup_legacy_tenant_rls
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1712355200000 WHERE "id" = 668 AND "hash" = 'a251d37022d64f55d01d90f13b5c79f8d9b2d3f7802abbf71c743b22ad60adc7'; -- 1718489600000 -> 1712355200000 0215_fuzzy_shadowcat
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1719872000000 WHERE "id" = 669 AND "hash" = 'b23bbc6cc2f11cd26782e169c821b549abf84d344570190322fedfbc3988c2e4'; -- 1718576000000 -> 1719872000000 20260817000000_add_share_token_to_chat_conversations
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1712441600000 WHERE "id" = 670 AND "hash" = 'a2531c7cb482dc0afb8e7a799935f40794e97c3fe93ae2dd7781a3968e3aa88b'; -- 1718662400000 -> 1712441600000 0217_dry_tarot
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1712528000000 WHERE "id" = 671 AND "hash" = '20158031bf6193a001fd4aea48399f7b430979dacfba524eb0d0a4f4e2587ada'; -- 1718748800000 -> 1712528000000 0218_wide_liz_osborn
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1712614400000 WHERE "id" = 672 AND "hash" = '99df832cf5bc6c95ba02bf438f89002b6c3b3567d6b915ddf391c96c69238c58'; -- 1718835200000 -> 1712614400000 0219_flowery_shotgun
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1712700800000 WHERE "id" = 673 AND "hash" = '3ea46f39b18cf32bf352e2bbe516361c484afa9f780b32e4b07ef26ca55fd332'; -- 1718921600000 -> 1712700800000 0220_wide_senator_kelly
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1712787200000 WHERE "id" = 674 AND "hash" = '73d1b83e24838b7e4ef4b1df39cd9dfb8329dc6ddc6b1ceecd16aa07849759f5'; -- 1719008000000 -> 1712787200000 0221_wide_puff_adder
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1712873600000 WHERE "id" = 675 AND "hash" = '625240fb98ee5d571ae21d1b75983449eeb7df2d67aa3c35d59de3a1e15f4415'; -- 1719094400000 -> 1712873600000 0222_demand_square_cover
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1712960000000 WHERE "id" = 676 AND "hash" = '8920dd05fd308d599e81ca05ddd4fe7d8d4a679c769785cf717a03d53de91536'; -- 1719180800000 -> 1712960000000 0223_add_srs_streams_user_id
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1713046400000 WHERE "id" = 677 AND "hash" = 'e2f0bba650c45667e98d30ee2d53666c1d889a518a5589feabde23cc1b8cfea7'; -- 1719267200000 -> 1713046400000 0224_pretty_songbird
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1713132800000 WHERE "id" = 678 AND "hash" = 'eac07b4939cbb2bdec569c0ff8b15465865b6865093fbceaac31dc89b988c36b'; -- 1719353600000 -> 1713132800000 0225_create_device_tokens
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1719699200000 WHERE "id" = 679 AND "hash" = 'd6ff09836fb8d83079957d2a5a24e0884f8dd3957480c43d883d2e6adfe46cfd'; -- 1719526400000 -> 1719699200000 20260808000000_create_service_inquiries
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1711577600000 WHERE "id" = 680 AND "hash" = '38eed713e433a54b2e3e1d2033c3c552541a5f0e7221e10cb0fb24be5e65bbd8'; -- 1719612800000 -> 1711577600000 0208_scheduling_batch4
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1711750400000 WHERE "id" = 681 AND "hash" = '48abd0512ef84cc090f3f7e544a7e0a7883910196e3a31b46ffd6c2f0bf56fa2'; -- 1719699200000 -> 1711750400000 0209_homework_batch5
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1711836800000 WHERE "id" = 682 AND "hash" = 'f4fb3d283e2b67932b06cb4fd1f8397e8673141d5a950f8c3342bbb5f0206beb'; -- 1719785600000 -> 1711836800000 0210_enrollment_batch6
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1712009600000 WHERE "id" = 683 AND "hash" = '5abb00a0a924fbd1128577437544cd0e0ef9603d2db687e6f1db1722a7bb8446'; -- 1719872000000 -> 1712009600000 0211_finance_batch7
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1719785600000 WHERE "id" = 684 AND "hash" = '1d2e61d9596054b93bb9119883ead608f9b4ed055b1f46c27f1d455a34df7cd4'; -- 1719958400000 -> 1719785600000 20260815000000_drop_audit_chain_entries
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1719958400000 WHERE "id" = 685 AND "hash" = 'c1c5cfc0d730d36a6779d959751cf4e6ed99a656049286d7a5ec05460d1698eb'; -- 1720044800000 -> 1719958400000 20260820000000_extend_demand_square
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1720044800000 WHERE "id" = 686 AND "hash" = 'cd30a6dc2c0f27b19c72baa7732c7bd26ce25b65fef7c333cdc9e160306c1189'; -- 1720131200000 -> 1720044800000 20260822000000_feedback_file_path
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1720131200000 WHERE "id" = 687 AND "hash" = '947feb1c86e272ba89679422dfb32f2bc553ecd8334ea248f70399487cf8a6d7'; -- 1720217600000 -> 1720131200000 20260829000000_create_agent_memory_semantic
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1720217600000 WHERE "id" = 688 AND "hash" = 'cd9152155a4dec6b2e13dd1ea54bdb78c5fb57326bdad1539a9271e49413dfea'; -- 1720304000000 -> 1720217600000 20260830000000_add_pinned_to_chat_conversations
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1720304000000 WHERE "id" = 689 AND "hash" = '49fe528918e2ea7cbfbda7c345471e5c1d0cc9a79b7f244e528d66081bb6f05c'; -- 1720390400000 -> 1720304000000 20260831000000_feature_gap_tables
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1720390400000 WHERE "id" = 690 AND "hash" = 'bccebd1bb367b59c9afd45934329605034062b3b3b3e02ae6cf6a602b4391bb9'; -- 1720476800000 -> 1720390400000 20260901000000_conversation_message_archives
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1720476800000 WHERE "id" = 691 AND "hash" = 'c85b23b2b6704afad25a1506da88552298ef136e2de6082ac8df5ee9aef5d95b'; -- 1720563200000 -> 1720476800000 20260906173000_drop_dead_tables
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1720563200000 WHERE "id" = 692 AND "hash" = '989715292ff7648d137599a5925bfa7dfcbad9e7baa3bf387f1f0af2bb958563'; -- 1720649600000 -> 1720563200000 20260906174000_audit_partition_ensure_fn
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1720649600000 WHERE "id" = 693 AND "hash" = 'b5a5d659ab7cfcbb4395e4d26b3476e5fbc7a3eb69a3a9917315816ed7462b9e'; -- 1720736000000 -> 1720649600000 20260906180000_drop_dead_tables_batch2
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1720736000000 WHERE "id" = 694 AND "hash" = '695d37ba2200b5b72ef60a435ee0ce8277c1185f39062e6c54e96be7ff922681'; -- 1720822400000 -> 1720736000000 20260906200000_add_risk_hits
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1721081600000 WHERE "id" = 696 AND "hash" = '1831c292a3474b8f1fe41191502a100cbe61139993746419a6293793ff0ccebd'; -- 1720995200000 -> 1721081600000 20260907000000_create_agent_runtime_sessions
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1721168000000 WHERE "id" = 697 AND "hash" = '158d5a9eee34e3454534d6039af15d748a4a29c92c3b04a1302f0f79569df0fa'; -- 1721081600000 -> 1721168000000 20260907010000_ai_pricing_numeric_precision
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1721254400000 WHERE "id" = 698 AND "hash" = '6d01e056d13ff52846eed676bad844812aeef1279c6468c67a3f19e4d6fa1eb4'; -- 1721168000000 -> 1721254400000 20260907020000_create_user_automations
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1721340800000 WHERE "id" = 699 AND "hash" = 'f4baef32580404bd1403296eb4000335b46145b8170d235cbdc69c5804b2b3c7'; -- 1721254400000 -> 1721340800000 20260907030000_create_repo_wiki_docs
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1721600000000 WHERE "id" = 700 AND "hash" = '43a8813becb4d62d52ad1930ba1a594eb2c65eda193bd6f9bd2e2ca0dcf30f03'; -- 1721340800000 -> 1721600000000 20260908010000_add_model_metadata_jsonb
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1721686400000 WHERE "id" = 701 AND "hash" = 'f27d6160c14b01198371f8abd3eebfafde3172d89a7eac545f0f15fe597c33de'; -- 1721427200000 -> 1721686400000 20260910000000_agent_tasks_workspace_team
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1720822400000 WHERE "id" = 703 AND "hash" = 'c2eeeea21d8c4070b7525b4d2f77c23bbd29aeb6197ab4caf0bae9d04c3b00e8'; -- 1721600000000 -> 1720822400000 20260906210000_add_perf_indexes
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1720995200000 WHERE "id" = 704 AND "hash" = 'df26bb3b39fed263aac0cb7b2df976774f710ecfbf642e466ccff4ef741d9b74'; -- 1721686400000 -> 1720995200000 20260906_algorithm_record
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1721427200000 WHERE "id" = 705 AND "hash" = '119a6e7d048d2934fe7b6b2bf850b94b2aae7c2a64b24899deac4f8058198f8c'; -- 1721772800000 -> 1721427200000 20260908000000_create_agent_event_triggers
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1721513600000 WHERE "id" = 706 AND "hash" = 'bd19789a8ab9e8081164f1bc5f581e3916a303ee219cbb038bd3d7301d312858'; -- 1721859200000 -> 1721513600000 20260908000000_create_team_memories
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1721772800000 WHERE "id" = 707 AND "hash" = 'ad4c1a8914b0e9a188f3336ba4ff70897b2d98f97d2da8b7880ade5cb1a7b925'; -- 1721945600000 -> 1721772800000 20260910030000_create_knowledge_cards
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1721945600000 WHERE "id" = 708 AND "hash" = '9a41ffb65b741bc420a1bb08fead1df7b7764da2702143c37b1b1a8806cfaf7f'; -- 1722032000000 -> 1721945600000 20260913120000_unify_model_names
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1722032000000 WHERE "id" = 709 AND "hash" = 'ae39af4af888b9316848bf97fc70c07d202121e3acdba2eea5b57f6aaf1d343c'; -- 1722118400000 -> 1722032000000 20260913140000_model_price_numeric
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1722291200000 WHERE "id" = 713 AND "hash" = '212fd013b7d49adeebe1844a04b7c80f0f86176171a8f2e6b7dfc2a1783b1715'; -- 1722377600000 -> 1722291200000 20260913180000_llm_call_logs_provider_code_widen
```

```sql
-- rollback: 按 id 反向还原（与 forward 一一对应）
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1709331200000 WHERE "id" = 562 AND "created_at" = 1709417600000; -- 0109_missing_migrations
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1709504000000 WHERE "id" = 564 AND "created_at" = 1709590400000; -- 0111_r76_indexes
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1709590400000 WHERE "id" = 565 AND "created_at" = 1709676800000; -- 0112_r80_new_tables
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1709676800000 WHERE "id" = 566 AND "created_at" = 1709763200000; -- 0113_r81_zhs_agent_buy_fields
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1709763200000 WHERE "id" = 567 AND "created_at" = 1709849600000; -- 0114_r81_edu_classes_tables
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1710281600000 WHERE "id" = 573 AND "created_at" = 1710368000000; -- 0124_acoustic_iron_man
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1710540800000 WHERE "id" = 576 AND "created_at" = 1710627200000; -- 0126_reflective_greymalkin
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1710627200000 WHERE "id" = 577 AND "created_at" = 1710713600000; -- 0127_dazzling_master_mold
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1710713600000 WHERE "id" = 578 AND "created_at" = 1710800000000; -- 0128_robustness_p0_security
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1710800000000 WHERE "id" = 579 AND "created_at" = 1710886400000; -- 0129_codebase_embedding
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1710886400000 WHERE "id" = 580 AND "created_at" = 1710972800000; -- 0130_two_factor
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1710972800000 WHERE "id" = 581 AND "created_at" = 1711059200000; -- 0143_drop_legacy_learn_tables
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1711059200000 WHERE "id" = 582 AND "created_at" = 1710281600000; -- 0123_pgvector_embedding
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1711145600000 WHERE "id" = 583 AND "created_at" = 1713219200000; -- 20260720120000_add_missing_fields
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1711232000000 WHERE "id" = 584 AND "created_at" = 1713305600000; -- 20260720130000_add_2_minor_fields
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1711318400000 WHERE "id" = 585 AND "created_at" = 1713392000000; -- 20260720140000_workspace_permissions
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1711404800000 WHERE "id" = 586 AND "created_at" = 1713478400000; -- 20260720150000_cli_provider_imports
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1711491200000 WHERE "id" = 587 AND "created_at" = 1713564800000; -- 20260720160000_self_media_published
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1711577600000 WHERE "id" = 588 AND "created_at" = 1713651200000; -- 20260720170000_publish_platform
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1711664000000 WHERE "id" = 589 AND "created_at" = 1713737600000; -- 20260720180000_search_hot_words
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1711750400000 WHERE "id" = 590 AND "created_at" = 1713824000000; -- 20260721180000_feedbacks_rating
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1711836800000 WHERE "id" = 591 AND "created_at" = 1713910400000; -- 20260722120000_g2_billing_safety
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1711923200000 WHERE "id" = 592 AND "created_at" = 1713996800000; -- 20260722130000_g5_fk_audit_fix
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1712009600000 WHERE "id" = 593 AND "created_at" = 1714083200000; -- 20260722140000_g6_jsonb_defaults
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1712096000000 WHERE "id" = 594 AND "created_at" = 1714169600000; -- 20260722150000_g10_updated_by
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1712182400000 WHERE "id" = 595 AND "created_at" = 1714256000000; -- 20260722160000_g13_created_by
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1712268800000 WHERE "id" = 596 AND "created_at" = 1714342400000; -- 20260722170000_email_logs_create
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1712355200000 WHERE "id" = 597 AND "created_at" = 1714428800000; -- 20260722180000_llm_config_models_and_groups
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1712441600000 WHERE "id" = 598 AND "created_at" = 1714515200000; -- 20260722190000_model_leaderboard
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1712528000000 WHERE "id" = 599 AND "created_at" = 1714601600000; -- 20260723120000_p3_deep_layer
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1712614400000 WHERE "id" = 600 AND "created_at" = 1714688000000; -- 20260723130000_add_user_learning_tables
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1712700800000 WHERE "id" = 601 AND "created_at" = 1714774400000; -- 20260724120000_registry_sync_center
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1712787200000 WHERE "id" = 602 AND "created_at" = 1714860800000; -- 20260724130000_audit_logs_chain
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1712873600000 WHERE "id" = 603 AND "created_at" = 1714947200000; -- 20260724140000_missing_15_tables
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1712960000000 WHERE "id" = 604 AND "created_at" = 1715033600000; -- 20260724180000_registry_items_payload_hash
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1713046400000 WHERE "id" = 605 AND "created_at" = 1715120000000; -- 20260724190000_resource_context_tables
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1713132800000 WHERE "id" = 606 AND "created_at" = 1715206400000; -- 20260725120000_agent_memory_decay_state
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1713219200000 WHERE "id" = 607 AND "created_at" = 1715292800000; -- 20260725130000_agent_user_profile
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1713305600000 WHERE "id" = 608 AND "created_at" = 1715379200000; -- 20260725140000_agent_meta_lessons
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1713392000000 WHERE "id" = 609 AND "created_at" = 1715465600000; -- 20260725150000_agent_ab_tests
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1713478400000 WHERE "id" = 610 AND "created_at" = 1715552000000; -- 20260725160000_add_last_read_at_to_chat_conversations
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1713564800000 WHERE "id" = 611 AND "created_at" = 1715638400000; -- 20260725160000_agent_multimodal_memory
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1713651200000 WHERE "id" = 612 AND "created_at" = 1715724800000; -- 20260725160000_resource_products_pid
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1713737600000 WHERE "id" = 613 AND "created_at" = 1715811200000; -- 20260725170000_agent_federated_lessons
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1713824000000 WHERE "id" = 614 AND "created_at" = 1715897600000; -- 20260725180000_agent_session_summary
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1713910400000 WHERE "id" = 615 AND "created_at" = 1715984000000; -- 20260725190000_agent_metacognition_log
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1713996800000 WHERE "id" = 616 AND "created_at" = 1716070400000; -- 20260727120000_p0_indexes
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1714083200000 WHERE "id" = 617 AND "created_at" = 1716156800000; -- 20260728120000_vip_levels_quota_fields
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1714169600000 WHERE "id" = 618 AND "created_at" = 1716243200000; -- 20260728130000_stage7_ai_careers_resources_fields
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1714256000000 WHERE "id" = 619 AND "created_at" = 1716329600000; -- 20260729120000_relay_billing
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1714342400000 WHERE "id" = 620 AND "created_at" = 1716416000000; -- 20260730120000_byok_commission
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1714428800000 WHERE "id" = 621 AND "created_at" = 1716502400000; -- 20260731120000_developer_api_keys_security_fields
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1714515200000 WHERE "id" = 622 AND "created_at" = 1716588800000; -- 20260731120001_llm_call_logs_cache_fields
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1714601600000 WHERE "id" = 623 AND "created_at" = 1716675200000; -- 20260731120002_ai_model_mappings
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1714688000000 WHERE "id" = 624 AND "created_at" = 1716761600000; -- 20260731120004_redemption_codes
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1714774400000 WHERE "id" = 625 AND "created_at" = 1716848000000; -- 20260801010001_llm_call_logs_relay_fields
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1714860800000 WHERE "id" = 626 AND "created_at" = 1716934400000; -- 20260801010002_ai_relay_channel_groups
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1714947200000 WHERE "id" = 627 AND "created_at" = 1717020800000; -- 20260801010003_user_billing_groups
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1715033600000 WHERE "id" = 628 AND "created_at" = 1717107200000; -- 20260801010004_tiered_pricing_rules
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1715120000000 WHERE "id" = 629 AND "created_at" = 1717193600000; -- 20260801010005_relay_commission_records
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1715206400000 WHERE "id" = 630 AND "created_at" = 1717280000000; -- 20260801010006_coupons
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1715292800000 WHERE "id" = 631 AND "created_at" = 1717366400000; -- 20260801010007_webhook_subscriptions
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1715379200000 WHERE "id" = 632 AND "created_at" = 1717452800000; -- 20260801010008_model_price_history
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1715465600000 WHERE "id" = 633 AND "created_at" = 1717539200000; -- 20260801010009_api_key_groups
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1715552000000 WHERE "id" = 634 AND "created_at" = 1717625600000; -- 20260801010010_add_tenant_id_to_developer_api_keys
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1715638400000 WHERE "id" = 635 AND "created_at" = 1717712000000; -- 20260801010020_add_user_passkeys_table
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1715724800000 WHERE "id" = 636 AND "created_at" = 1717798400000; -- 20260801010030_add_usdt_payments_table
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1715811200000 WHERE "id" = 637 AND "created_at" = 1717884800000; -- 20260801010040_add_api_key_shares_table
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1715897600000 WHERE "id" = 638 AND "created_at" = 1717971200000; -- 20260801010050_add_channel_quota_fields
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1715984000000 WHERE "id" = 639 AND "created_at" = 1718057600000; -- 20260801010060_add_api_key_tpm_tags
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1716070400000 WHERE "id" = 640 AND "created_at" = 1718144000000; -- 20260801010070_add_relay_conversations_table
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1716156800000 WHERE "id" = 641 AND "created_at" = 1718230400000; -- 20260801010080_add_ai_model_sync_log
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1716243200000 WHERE "id" = 642 AND "created_at" = 1718316800000; -- 20260801010090_add_model_sync_metadata
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1716329600000 WHERE "id" = 643 AND "created_at" = 1718403200000; -- 20260801010100_add_points_multiplier
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1716416000000 WHERE "id" = 644 AND "created_at" = 1718489600000; -- 20260801010200_add_im_tables
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1716502400000 WHERE "id" = 645 AND "created_at" = 1718576000000; -- 20260801020000_add_missing_20_tables
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1716588800000 WHERE "id" = 646 AND "created_at" = 1718662400000; -- 20260801020000_clean_placeholder_keys
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1716675200000 WHERE "id" = 647 AND "created_at" = 1718748800000; -- 20260801030000_seed_home_schema
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1716761600000 WHERE "id" = 648 AND "created_at" = 1718835200000; -- 20260801040000_admin_test_verify_code_bypass
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1716848000000 WHERE "id" = 649 AND "created_at" = 1718921600000; -- 20260802040000_user_devices
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1716934400000 WHERE "id" = 650 AND "created_at" = 1719008000000; -- 20260804120000_publish_account_groups
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1717020800000 WHERE "id" = 651 AND "created_at" = 1719094400000; -- 20260804130000_plugins
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1717107200000 WHERE "id" = 652 AND "created_at" = 1719180800000; -- 20260804140000_user_token_balance
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1717193600000 WHERE "id" = 653 AND "created_at" = 1719267200000; -- 20260806001852_usdt_tx_hash_unique
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1717280000000 WHERE "id" = 654 AND "created_at" = 1719353600000; -- 20260806003847_notification_message_indexes
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1717452800000 WHERE "id" = 656 AND "created_at" = 1719526400000; -- 20260806153000_tenant_members_user_id_idx
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1717539200000 WHERE "id" = 657 AND "created_at" = 1719612800000; -- 20260806154900_crash_reports
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1717625600000 WHERE "id" = 658 AND "created_at" = 1711145600000; -- 0204_past_kinsey_walden
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1717712000000 WHERE "id" = 659 AND "created_at" = 1711232000000; -- 0205_slim_sally_floyd
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1717798400000 WHERE "id" = 660 AND "created_at" = 1711318400000; -- 0206_parent_student_binding
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1717884800000 WHERE "id" = 661 AND "created_at" = 1711404800000; -- 0207_exam_score_ranking
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1717971200000 WHERE "id" = 662 AND "created_at" = 1711491200000; -- 0208_careless_prism
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1718057600000 WHERE "id" = 663 AND "created_at" = 1711664000000; -- 0209_early_maggott
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1718144000000 WHERE "id" = 664 AND "created_at" = 1711923200000; -- 0210_opposite_rocket_racer
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1718316800000 WHERE "id" = 666 AND "created_at" = 1712182400000; -- 0213_phase5_backfill_orders_sync
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1718403200000 WHERE "id" = 667 AND "created_at" = 1712268800000; -- 0214_cleanup_legacy_tenant_rls
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1718489600000 WHERE "id" = 668 AND "created_at" = 1712355200000; -- 0215_fuzzy_shadowcat
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1718576000000 WHERE "id" = 669 AND "created_at" = 1719872000000; -- 20260817000000_add_share_token_to_chat_conversations
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1718662400000 WHERE "id" = 670 AND "created_at" = 1712441600000; -- 0217_dry_tarot
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1718748800000 WHERE "id" = 671 AND "created_at" = 1712528000000; -- 0218_wide_liz_osborn
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1718835200000 WHERE "id" = 672 AND "created_at" = 1712614400000; -- 0219_flowery_shotgun
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1718921600000 WHERE "id" = 673 AND "created_at" = 1712700800000; -- 0220_wide_senator_kelly
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1719008000000 WHERE "id" = 674 AND "created_at" = 1712787200000; -- 0221_wide_puff_adder
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1719094400000 WHERE "id" = 675 AND "created_at" = 1712873600000; -- 0222_demand_square_cover
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1719180800000 WHERE "id" = 676 AND "created_at" = 1712960000000; -- 0223_add_srs_streams_user_id
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1719267200000 WHERE "id" = 677 AND "created_at" = 1713046400000; -- 0224_pretty_songbird
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1719353600000 WHERE "id" = 678 AND "created_at" = 1713132800000; -- 0225_create_device_tokens
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1719526400000 WHERE "id" = 679 AND "created_at" = 1719699200000; -- 20260808000000_create_service_inquiries
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1719612800000 WHERE "id" = 680 AND "created_at" = 1711577600000; -- 0208_scheduling_batch4
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1719699200000 WHERE "id" = 681 AND "created_at" = 1711750400000; -- 0209_homework_batch5
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1719785600000 WHERE "id" = 682 AND "created_at" = 1711836800000; -- 0210_enrollment_batch6
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1719872000000 WHERE "id" = 683 AND "created_at" = 1712009600000; -- 0211_finance_batch7
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1719958400000 WHERE "id" = 684 AND "created_at" = 1719785600000; -- 20260815000000_drop_audit_chain_entries
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1720044800000 WHERE "id" = 685 AND "created_at" = 1719958400000; -- 20260820000000_extend_demand_square
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1720131200000 WHERE "id" = 686 AND "created_at" = 1720044800000; -- 20260822000000_feedback_file_path
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1720217600000 WHERE "id" = 687 AND "created_at" = 1720131200000; -- 20260829000000_create_agent_memory_semantic
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1720304000000 WHERE "id" = 688 AND "created_at" = 1720217600000; -- 20260830000000_add_pinned_to_chat_conversations
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1720390400000 WHERE "id" = 689 AND "created_at" = 1720304000000; -- 20260831000000_feature_gap_tables
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1720476800000 WHERE "id" = 690 AND "created_at" = 1720390400000; -- 20260901000000_conversation_message_archives
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1720563200000 WHERE "id" = 691 AND "created_at" = 1720476800000; -- 20260906173000_drop_dead_tables
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1720649600000 WHERE "id" = 692 AND "created_at" = 1720563200000; -- 20260906174000_audit_partition_ensure_fn
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1720736000000 WHERE "id" = 693 AND "created_at" = 1720649600000; -- 20260906180000_drop_dead_tables_batch2
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1720822400000 WHERE "id" = 694 AND "created_at" = 1720736000000; -- 20260906200000_add_risk_hits
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1720995200000 WHERE "id" = 696 AND "created_at" = 1721081600000; -- 20260907000000_create_agent_runtime_sessions
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1721081600000 WHERE "id" = 697 AND "created_at" = 1721168000000; -- 20260907010000_ai_pricing_numeric_precision
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1721168000000 WHERE "id" = 698 AND "created_at" = 1721254400000; -- 20260907020000_create_user_automations
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1721254400000 WHERE "id" = 699 AND "created_at" = 1721340800000; -- 20260907030000_create_repo_wiki_docs
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1721340800000 WHERE "id" = 700 AND "created_at" = 1721600000000; -- 20260908010000_add_model_metadata_jsonb
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1721427200000 WHERE "id" = 701 AND "created_at" = 1721686400000; -- 20260910000000_agent_tasks_workspace_team
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1721600000000 WHERE "id" = 703 AND "created_at" = 1720822400000; -- 20260906210000_add_perf_indexes
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1721686400000 WHERE "id" = 704 AND "created_at" = 1720995200000; -- 20260906_algorithm_record
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1721772800000 WHERE "id" = 705 AND "created_at" = 1721427200000; -- 20260908000000_create_agent_event_triggers
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1721859200000 WHERE "id" = 706 AND "created_at" = 1721513600000; -- 20260908000000_create_team_memories
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1721945600000 WHERE "id" = 707 AND "created_at" = 1721772800000; -- 20260910030000_create_knowledge_cards
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1722032000000 WHERE "id" = 708 AND "created_at" = 1721945600000; -- 20260913120000_unify_model_names
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1722118400000 WHERE "id" = 709 AND "created_at" = 1722032000000; -- 20260913140000_model_price_numeric
UPDATE "drizzle"."__drizzle_migrations" SET "created_at" = 1722377600000 WHERE "id" = 713 AND "created_at" = 1722291200000; -- 20260913180000_llm_call_logs_provider_code_widen
```

## 附:vector 前置票面事实(2026-11-07)

**结论(定死,不给三选一)**:部署前必须预装 pgvector(含版本),前置检查显式失败;否则迁移不许开始。

- **排除**:给应用角色授 CREATE EXTENSION 权限 —— 业务角色超权,代价大于收益,不写入任何建议。
- **辅助**:template1 预装只覆盖新建库,对已存在库无效,不作为主方案。
- **事实依据**:from-zero 376 条中 8 条失败 = 4 条硬 CREATE EXTENSION 权限失败 + 4 条连带缺表;不是部署期偶发,是空库不继承扩展的必然结果。
- **缺证据**:376/376 那次运行的 DSN 与角色权限(rolsuper)无任何日志留存,导致两个数字对不上却无法回查;此条按缺证据记账,不再推测。
- **改进(已写代码)**:check-migration-from-zero 在建库后、清理前把脱敏 DSN、角色、pg_extension、vector 版本、rolsuper 落盘到 .ihui-agent/state/migration-from-zero-evidence/;落盘失败不影响主判定。
- **已写死位置**:docs/DEPLOYMENT_RUNBOOK.md §3 步骤 0;docs/RELEASE.md 发布前检查(先于 11 项门禁)。

## 七、临时库实测修正(2026-11-07,真 PostgreSQL)

环境:临时库 ihui_rebind_verify_20261107012545,从生产只读复制 368 行到同结构表,基线门 206/162/8,测完 DROP。

| 步骤 | 原文结果 | 判定 |
|---|---|---|
| forward B | `UPDATE 130` / `rows 368` / `count(*)-count(distinct created_at)=4` | ✗ 冲突数 4,不是 0 |
| 4 个重复 when | 1709763200000(0113) / 1710281600000(0123) / 1715292800000(20260725130000) / 1716156800000(20260728120000) | — |
| forward 后门 | applied 336 / hashDrift 28 / pending 8 / lateGap 4 | 未应用合计 12 = pending 8 + lateGap 4;先前把 lateGap 并进 pending 说成 12,口径需修正 |
| rollback | `UPDATE 130` / 逐行 mismatch 0 / EXCEPT 双向 0 | ✓ 可还原 |

4 处冲突的成因:被跳过的 7 条移出行仍占着自己的源 when,上一环节点移入即撞车。

- 0113:跳过 567(0113→0114),移入 566(0112→0113);
- 0123:跳过 573(0123→0124),移入 582(0143→0123);
- 20260725130000:跳过 631(→20260801010007),移入 607(20260720120000→20260725130000);
- 20260728120000:跳过 641(→20260801010080),移入 617(20260722140000→20260728120000)。

冲突 0 的闭包版本(继续排除撞车的上一环)要排除 56 条,内存模拟 applied 287 / hashDrift 80,相当于把整段 +24 链停住,不可接受。

结论:**方案 B 满足不了「一条 when 只对应一行」**;A 又制造 7 个掩绿。唯一干净解是处置那 7 条零命中旧行(删或另置),属写生产账本 + 动审计记录,已按裁定停手待批。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
