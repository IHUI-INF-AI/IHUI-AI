-- =============================================================
-- zhs-platform 首版 schema - 共 236 张表
-- 适用 PostgreSQL
-- =============================================================

-- ===== Database: zhs_ai_project =====
DROP TABLE IF EXISTS "admin_config";

CREATE TABLE admin_config (
	config_id BIGSERIAL NOT NULL, 
	config_name VARCHAR(100), 
	config_key VARCHAR(100), 
	config_value VARCHAR(500), 
	config_type VARCHAR(1), 
	create_by VARCHAR(64), 
	create_time TIMESTAMP WITHOUT TIME ZONE, 
	update_by VARCHAR(64), 
	update_time TIMESTAMP WITHOUT TIME ZONE, 
	remark VARCHAR(500), 
	PRIMARY KEY (config_id)
)

;

DROP TABLE IF EXISTS "admin_dept";

CREATE TABLE admin_dept (
	dept_id BIGSERIAL NOT NULL, 
	parent_id BIGINT, 
	ancestors VARCHAR(50), 
	dept_name VARCHAR(30), 
	order_num INTEGER, 
	leader VARCHAR(20), 
	phone VARCHAR(11), 
	email VARCHAR(50), 
	status VARCHAR(1), 
	del_flag VARCHAR(1), 
	create_by VARCHAR(64), 
	create_time TIMESTAMP WITHOUT TIME ZONE, 
	update_by VARCHAR(64), 
	update_time TIMESTAMP WITHOUT TIME ZONE, 
	remark VARCHAR(500), 
	PRIMARY KEY (dept_id)
)

;
CREATE INDEX ix_admin_dept_status ON admin_dept (status);
CREATE INDEX ix_admin_dept_del_flag ON admin_dept (del_flag);
CREATE INDEX ix_admin_dept_parent_id ON admin_dept (parent_id);

DROP TABLE IF EXISTS "admin_dict_data";

CREATE TABLE admin_dict_data (
	dict_code BIGSERIAL NOT NULL, 
	dict_sort INTEGER, 
	dict_label VARCHAR(100), 
	dict_value VARCHAR(100), 
	dict_type VARCHAR(100), 
	css_class VARCHAR(100), 
	list_class VARCHAR(100), 
	is_default VARCHAR(1), 
	status VARCHAR(1), 
	create_by VARCHAR(64), 
	create_time TIMESTAMP WITHOUT TIME ZONE, 
	update_by VARCHAR(64), 
	update_time TIMESTAMP WITHOUT TIME ZONE, 
	remark VARCHAR(500), 
	PRIMARY KEY (dict_code)
)

;
CREATE INDEX ix_admin_dict_data_status ON admin_dict_data (status);

DROP TABLE IF EXISTS "admin_dict_type";

CREATE TABLE admin_dict_type (
	dict_id BIGSERIAL NOT NULL, 
	dict_name VARCHAR(100), 
	dict_type VARCHAR(100), 
	status VARCHAR(1), 
	create_by VARCHAR(64), 
	create_time TIMESTAMP WITHOUT TIME ZONE, 
	update_by VARCHAR(64), 
	update_time TIMESTAMP WITHOUT TIME ZONE, 
	remark VARCHAR(500), 
	PRIMARY KEY (dict_id)
)

;
CREATE INDEX ix_admin_dict_type_status ON admin_dict_type (status);

DROP TABLE IF EXISTS "admin_job";

CREATE TABLE admin_job (
	job_id BIGSERIAL NOT NULL, 
	job_name VARCHAR(64) NOT NULL, 
	job_group VARCHAR(64), 
	invoke_target VARCHAR(500) NOT NULL, 
	cron_expression VARCHAR(255), 
	misfire_policy VARCHAR(20), 
	concurrent VARCHAR(1), 
	status VARCHAR(1), 
	create_by VARCHAR(64), 
	create_time TIMESTAMP WITHOUT TIME ZONE, 
	update_by VARCHAR(64), 
	update_time TIMESTAMP WITHOUT TIME ZONE, 
	remark VARCHAR(500), 
	PRIMARY KEY (job_id)
)

;
CREATE INDEX ix_admin_job_status ON admin_job (status);
CREATE INDEX ix_admin_job_create_by ON admin_job (create_by);
CREATE INDEX ix_admin_job_update_by ON admin_job (update_by);

DROP TABLE IF EXISTS "admin_job_log";

CREATE TABLE admin_job_log (
	job_log_id BIGSERIAL NOT NULL, 
	job_name VARCHAR(64), 
	job_group VARCHAR(64), 
	invoke_target VARCHAR(500), 
	job_message VARCHAR(500), 
	status VARCHAR(1), 
	exception_info VARCHAR(2000), 
	create_time TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (job_log_id)
)

;
CREATE INDEX ix_admin_job_log_status ON admin_job_log (status);

DROP TABLE IF EXISTS "admin_logininfor";

CREATE TABLE admin_logininfor (
	info_id BIGSERIAL NOT NULL, 
	user_name VARCHAR(50), 
	status VARCHAR(1), 
	ipaddr VARCHAR(128), 
	msg VARCHAR(255), 
	access_time TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (info_id)
)

;
CREATE INDEX ix_admin_logininfor_status ON admin_logininfor (status);

DROP TABLE IF EXISTS "admin_menu";

CREATE TABLE admin_menu (
	menu_id BIGSERIAL NOT NULL, 
	menu_name VARCHAR(50) NOT NULL, 
	parent_id BIGINT, 
	order_num INTEGER, 
	path VARCHAR(200), 
	component VARCHAR(255), 
	query VARCHAR(255), 
	route_name VARCHAR(50), 
	is_frame VARCHAR(1), 
	is_cache VARCHAR(1), 
	menu_type VARCHAR(1), 
	visible VARCHAR(1), 
	status VARCHAR(1), 
	perms VARCHAR(100), 
	icon VARCHAR(100), 
	create_by VARCHAR(64), 
	create_time TIMESTAMP WITHOUT TIME ZONE, 
	update_by VARCHAR(64), 
	update_time TIMESTAMP WITHOUT TIME ZONE, 
	remark VARCHAR(500), 
	PRIMARY KEY (menu_id)
)

;
CREATE INDEX ix_admin_menu_parent_id ON admin_menu (parent_id);
CREATE INDEX ix_admin_menu_status ON admin_menu (status);

DROP TABLE IF EXISTS "admin_notice";

CREATE TABLE admin_notice (
	notice_id BIGSERIAL NOT NULL, 
	notice_title VARCHAR(50) NOT NULL, 
	notice_type VARCHAR(1) NOT NULL, 
	notice_content VARCHAR(2000), 
	status VARCHAR(1), 
	create_by VARCHAR(64), 
	create_time TIMESTAMP WITHOUT TIME ZONE, 
	update_by VARCHAR(64), 
	update_time TIMESTAMP WITHOUT TIME ZONE, 
	remark VARCHAR(500), 
	PRIMARY KEY (notice_id)
)

;
CREATE INDEX ix_admin_notice_status ON admin_notice (status);
CREATE INDEX ix_admin_notice_create_by ON admin_notice (create_by);

DROP TABLE IF EXISTS "admin_oper_log";

CREATE TABLE admin_oper_log (
	oper_id BIGSERIAL NOT NULL, 
	title VARCHAR(50), 
	business_type INTEGER, 
	method VARCHAR(200), 
	request_method INTEGER, 
	operator_type INTEGER, 
	oper_name VARCHAR(50), 
	dept_name VARCHAR(50), 
	oper_url VARCHAR(255), 
	oper_ip VARCHAR(128), 
	oper_param VARCHAR(2000), 
	json_result VARCHAR(2000), 
	status INTEGER, 
	error_msg VARCHAR(2000), 
	oper_time TIMESTAMP WITHOUT TIME ZONE, 
	cost_time BIGINT, 
	PRIMARY KEY (oper_id)
)

;
CREATE INDEX ix_admin_oper_log_status ON admin_oper_log (status);

DROP TABLE IF EXISTS "admin_post";

CREATE TABLE admin_post (
	post_id BIGSERIAL NOT NULL, 
	post_code VARCHAR(64) NOT NULL, 
	post_name VARCHAR(50) NOT NULL, 
	post_sort INTEGER NOT NULL, 
	status VARCHAR(1), 
	create_by VARCHAR(64), 
	create_time TIMESTAMP WITHOUT TIME ZONE, 
	update_by VARCHAR(64), 
	update_time TIMESTAMP WITHOUT TIME ZONE, 
	remark VARCHAR(500), 
	PRIMARY KEY (post_id)
)

;
CREATE INDEX ix_admin_post_status ON admin_post (status);

DROP TABLE IF EXISTS "admin_role";

CREATE TABLE admin_role (
	role_id BIGSERIAL NOT NULL, 
	role_name VARCHAR(30) NOT NULL, 
	role_key VARCHAR(100) NOT NULL, 
	role_sort INTEGER NOT NULL, 
	data_scope VARCHAR(1), 
	menu_check_strictly INTEGER, 
	dept_check_strictly INTEGER, 
	status VARCHAR(1), 
	del_flag VARCHAR(1), 
	create_by VARCHAR(64), 
	create_time TIMESTAMP WITHOUT TIME ZONE, 
	update_by VARCHAR(64), 
	update_time TIMESTAMP WITHOUT TIME ZONE, 
	remark VARCHAR(500), 
	PRIMARY KEY (role_id)
)

;

DROP TABLE IF EXISTS "admin_role_dept";

CREATE TABLE admin_role_dept (
	role_id BIGINT NOT NULL, 
	dept_id BIGINT NOT NULL, 
	PRIMARY KEY (role_id, dept_id)
)

;

DROP TABLE IF EXISTS "admin_role_menu";

CREATE TABLE admin_role_menu (
	role_id BIGINT NOT NULL, 
	menu_id BIGINT NOT NULL, 
	PRIMARY KEY (role_id, menu_id)
)

;

DROP TABLE IF EXISTS "admin_sms_template";

CREATE TABLE admin_sms_template (
	template_id BIGSERIAL NOT NULL, 
	template_name VARCHAR(100) NOT NULL, 
	template_code VARCHAR(100) NOT NULL, 
	template_content TEXT NOT NULL, 
	template_type VARCHAR(1), 
	sign_name VARCHAR(100), 
	status VARCHAR(1), 
	remark VARCHAR(500), 
	create_by VARCHAR(64), 
	create_time TIMESTAMP WITHOUT TIME ZONE, 
	update_by VARCHAR(64), 
	update_time TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (template_id)
)

;
CREATE INDEX ix_admin_sms_template_status ON admin_sms_template (status);

DROP TABLE IF EXISTS "admin_user_post";

CREATE TABLE admin_user_post (
	user_id BIGINT NOT NULL, 
	post_id BIGINT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (user_id, post_id)
)

;

DROP TABLE IF EXISTS "admin_user_role";

CREATE TABLE admin_user_role (
	user_id BIGINT NOT NULL, 
	role_id BIGINT NOT NULL, 
	PRIMARY KEY (user_id, role_id)
)

;

DROP TABLE IF EXISTS "agent_billings";

CREATE TABLE agent_billings (
	id BIGSERIAL NOT NULL, 
	user_uuid VARCHAR(64) NOT NULL, 
	agent_id VARCHAR(64) NOT NULL, 
	billing_type VARCHAR(32), 
	amount BIGINT, 
	tokens BIGINT, 
	status INTEGER, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_agent_billings_status ON agent_billings (status);

DROP TABLE IF EXISTS "agent_buy_scheduled_tasks";

CREATE TABLE agent_buy_scheduled_tasks (
	id BIGSERIAL NOT NULL, 
	buy_id BIGINT NOT NULL, 
	task_type VARCHAR(32), 
	scheduled_time TIMESTAMP WITHOUT TIME ZONE, 
	status INTEGER, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_agent_buy_scheduled_tasks_status ON agent_buy_scheduled_tasks (status);

DROP TABLE IF EXISTS "agent_callbacks";

CREATE TABLE agent_callbacks (
	id BIGSERIAL NOT NULL, 
	agent_id VARCHAR(64) NOT NULL, 
	callback_url TEXT, 
	callback_data_1 VARCHAR(500), 
	callback_data_2 VARCHAR(500), 
	callback_data_3 VARCHAR(500), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

DROP TABLE IF EXISTS "agent_category_link";

CREATE TABLE agent_category_link (
	id BIGSERIAL NOT NULL, 
	agent_id VARCHAR(64) NOT NULL, 
	category_id BIGINT NOT NULL, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_category_link_agent ON agent_category_link (agent_id);
CREATE INDEX idx_category_link_category ON agent_category_link (category_id);

DROP TABLE IF EXISTS "agent_configs";

CREATE TABLE agent_configs (
	id BIGSERIAL NOT NULL, 
	agent_id VARCHAR(64) NOT NULL, 
	config_key VARCHAR(100) NOT NULL, 
	config_value TEXT, 
	is_deleted INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

DROP TABLE IF EXISTS "agent_heat_stats";

CREATE TABLE agent_heat_stats (
	id BIGSERIAL NOT NULL, 
	agent_id VARCHAR(64) NOT NULL, 
	hit_count BIGINT, 
	date_str VARCHAR(10), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

DROP TABLE IF EXISTS "agent_rule_param";

CREATE TABLE agent_rule_param (
	id BIGSERIAL NOT NULL, 
	rule_id BIGINT NOT NULL, 
	param_name VARCHAR(128) NOT NULL, 
	param_value TEXT, 
	param_type VARCHAR(32), 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_rule_param_rule_id ON agent_rule_param (rule_id);

DROP TABLE IF EXISTS "agent_upload";

CREATE TABLE agent_upload (
	id BIGSERIAL NOT NULL, 
	user_uuid VARCHAR(64) NOT NULL, 
	user_id VARCHAR(64), 
	user_name VARCHAR(100), 
	agent_id VARCHAR(64) NOT NULL, 
	agent_name VARCHAR(200), 
	file_url VARCHAR(500) NOT NULL, 
	file_name VARCHAR(200), 
	file_size BIGINT, 
	mime_type VARCHAR(100), 
	ext VARCHAR(20), 
	file_type VARCHAR(50), 
	biz_type VARCHAR(50), 
	status INTEGER, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_agent_upload_status ON agent_upload (status);

DROP TABLE IF EXISTS "ai_about_us";

CREATE TABLE ai_about_us (
	id BIGSERIAL NOT NULL, 
	title VARCHAR(200), 
	content TEXT, 
	status INTEGER, 
	sort INTEGER, 
	creator VARCHAR(64), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_ai_about_us_status ON ai_about_us (status);

DROP TABLE IF EXISTS "ai_bot_sites";

CREATE TABLE ai_bot_sites (
	id SERIAL NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	url VARCHAR(512), 
	category VARCHAR(64), 
	description TEXT, 
	icon VARCHAR(512), 
	sort INTEGER, 
	is_use INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

DROP TABLE IF EXISTS "ai_contact";

CREATE TABLE ai_contact (
	id BIGSERIAL NOT NULL, 
	name VARCHAR(100), 
	phone VARCHAR(20), 
	email VARCHAR(100), 
	content TEXT, 
	status INTEGER, 
	title VARCHAR(200), 
	sort_order INTEGER, 
	remark VARCHAR(500), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_ai_contact_status ON ai_contact (status);

DROP TABLE IF EXISTS "ai_file_storage";

CREATE TABLE ai_file_storage (
	id BIGSERIAL NOT NULL, 
	file_name VARCHAR(255), 
	file_path VARCHAR(500), 
	file_size BIGINT, 
	file_type VARCHAR(50), 
	bucket VARCHAR(100), 
	user_uuid VARCHAR(64), 
	status INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_ai_file_storage_status ON ai_file_storage (status);

DROP TABLE IF EXISTS "ai_gc_user_log";

CREATE TABLE ai_gc_user_log (
	id BIGSERIAL NOT NULL, 
	gc_id BIGINT NOT NULL, 
	user_uuid VARCHAR(64) NOT NULL, 
	action VARCHAR(32) NOT NULL, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

DROP TABLE IF EXISTS "ai_news";

CREATE TABLE ai_news (
	id BIGSERIAL NOT NULL, 
	title VARCHAR(300) NOT NULL, 
	subtitle VARCHAR(500), 
	content TEXT, 
	cover_image VARCHAR(500), 
	author VARCHAR(100), 
	category VARCHAR(50), 
	view_count BIGINT, 
	status INTEGER, 
	publish_time TIMESTAMP WITHOUT TIME ZONE, 
	sort INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_ai_news_status ON ai_news (status);

DROP TABLE IF EXISTS "ai_user_feedback";

CREATE TABLE ai_user_feedback (
	id BIGSERIAL NOT NULL, 
	user_uuid VARCHAR(64), 
	content TEXT, 
	images TEXT, 
	type VARCHAR(50), 
	status INTEGER, 
	reply TEXT, 
	reply_time TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_ai_user_feedback_status ON ai_user_feedback (status);

DROP TABLE IF EXISTS "app_content";

CREATE TABLE app_content (
	id BIGSERIAL NOT NULL, 
	title VARCHAR(200), 
	image_url VARCHAR(500), 
	link_url VARCHAR(500), 
	type VARCHAR(50), 
	status INTEGER, 
	sort INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_app_content_status ON app_content (status);

DROP TABLE IF EXISTS "app_version";

CREATE TABLE app_version (
	id BIGSERIAL NOT NULL, 
	version_code VARCHAR(50), 
	version_name VARCHAR(50), 
	version VARCHAR(20), 
	build INTEGER, 
	title VARCHAR(200), 
	content TEXT, 
	download_url VARCHAR(500), 
	description TEXT, 
	platform VARCHAR(20), 
	force_update INTEGER, 
	is_force INTEGER, 
	is_silent INTEGER, 
	min_version VARCHAR(20), 
	gray_ratio INTEGER, 
	file_size INTEGER, 
	md5 VARCHAR(50), 
	status INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_app_version_status ON app_version (status);

DROP TABLE IF EXISTS "ask_answer";

CREATE TABLE ask_answer (
	id BIGSERIAL NOT NULL, 
	question_id BIGINT NOT NULL, 
	content TEXT NOT NULL, 
	member_id VARCHAR(64) NOT NULL, 
	member_name VARCHAR(100), 
	member_avatar VARCHAR(500), 
	favorite_num INTEGER, 
	like_num INTEGER, 
	comment_num INTEGER, 
	is_adopted BOOLEAN, 
	is_top BOOLEAN, 
	deleted BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_ask_answer_member ON ask_answer (member_id);
CREATE INDEX idx_ask_answer_question ON ask_answer (question_id);

DROP TABLE IF EXISTS "ask_answer_ext";

CREATE TABLE ask_answer_ext (
	id BIGSERIAL NOT NULL, 
	answer_id BIGINT NOT NULL, 
	member_id BIGINT, 
	favorite_num INTEGER, 
	like_num INTEGER, 
	comment_num INTEGER, 
	is_adopted BOOLEAN, 
	is_top BOOLEAN, 
	deleted BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (answer_id)
)

;
CREATE INDEX idx_aae_member ON ask_answer_ext (member_id);
CREATE INDEX idx_aae_answer ON ask_answer_ext (answer_id);

DROP TABLE IF EXISTS "ask_category";

CREATE TABLE ask_category (
	id BIGSERIAL NOT NULL, 
	pid BIGINT, 
	name VARCHAR(100) NOT NULL, 
	sort_order INTEGER, 
	is_show BOOLEAN, 
	is_show_index BOOLEAN, 
	image VARCHAR(500), 
	level INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

DROP TABLE IF EXISTS "ask_category_relation";

CREATE TABLE ask_category_relation (
	id BIGSERIAL NOT NULL, 
	child_category_id BIGINT NOT NULL, 
	father_category_id BIGINT NOT NULL, 
	direct_father_category_id BIGINT, 
	is_sub INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_acr_father ON ask_category_relation (father_category_id);
CREATE INDEX idx_acr_child ON ask_category_relation (child_category_id);

DROP TABLE IF EXISTS "ask_comment";

CREATE TABLE ask_comment (
	id BIGSERIAL NOT NULL, 
	target_type VARCHAR(20) NOT NULL, 
	target_id BIGINT NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	user_name VARCHAR(100), 
	content TEXT NOT NULL, 
	pid BIGINT, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_ask_comment_user_id ON ask_comment (user_id);
CREATE INDEX idx_ask_comment_target ON ask_comment (target_type, target_id);

DROP TABLE IF EXISTS "ask_favorite";

CREATE TABLE ask_favorite (
	id BIGSERIAL NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	target_type VARCHAR(20) NOT NULL, 
	target_id BIGINT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_ask_fav_user ON ask_favorite (user_id, target_type, target_id);

DROP TABLE IF EXISTS "ask_like";

CREATE TABLE ask_like (
	id BIGSERIAL NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	target_type VARCHAR(20) NOT NULL, 
	target_id BIGINT NOT NULL, 
	is_like BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_ask_like_user ON ask_like (user_id, target_type, target_id);

DROP TABLE IF EXISTS "ask_question";

CREATE TABLE ask_question (
	id BIGSERIAL NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	content TEXT NOT NULL, 
	image VARCHAR(500), 
	member_id VARCHAR(64) NOT NULL, 
	member_name VARCHAR(100), 
	member_avatar VARCHAR(500), 
	status VARCHAR(20), 
	favorite_num INTEGER, 
	like_num INTEGER, 
	comment_num INTEGER, 
	watch_num INTEGER, 
	answer_num INTEGER, 
	is_top BOOLEAN, 
	is_essence BOOLEAN, 
	deleted BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_ask_question_status ON ask_question (status);
CREATE INDEX idx_ask_question_member ON ask_question (member_id);

DROP TABLE IF EXISTS "ask_question_category";

CREATE TABLE ask_question_category (
	id BIGSERIAL NOT NULL, 
	question_id BIGINT NOT NULL, 
	category_id BIGINT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_aqc_question ON ask_question_category (question_id);
CREATE INDEX idx_aqc_category ON ask_question_category (category_id);

DROP TABLE IF EXISTS "ask_question_ext";

CREATE TABLE ask_question_ext (
	id BIGSERIAL NOT NULL, 
	question_id BIGINT NOT NULL, 
	member_id BIGINT, 
	view_num INTEGER, 
	collect_num INTEGER, 
	answer_num INTEGER, 
	comment_num INTEGER, 
	is_top BOOLEAN, 
	is_essence BOOLEAN, 
	deleted BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (question_id)
)

;
CREATE INDEX idx_aqe_question ON ask_question_ext (question_id);
CREATE INDEX idx_aqe_member ON ask_question_ext (member_id);

DROP TABLE IF EXISTS "behavior_comment";

CREATE TABLE behavior_comment (
	id BIGSERIAL NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	user_name VARCHAR(100), 
	user_avatar VARCHAR(500), 
	target_type VARCHAR(50) NOT NULL, 
	target_id BIGINT NOT NULL, 
	content TEXT NOT NULL, 
	pid BIGINT, 
	reply_user_id VARCHAR(64), 
	reply_user_name VARCHAR(100), 
	like_num INTEGER, 
	status INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_bc_target ON behavior_comment (target_type, target_id);
CREATE INDEX ix_behavior_comment_status ON behavior_comment (status);
CREATE INDEX ix_behavior_comment_user_id ON behavior_comment (user_id);

DROP TABLE IF EXISTS "behavior_favorite";

CREATE TABLE behavior_favorite (
	id BIGSERIAL NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	user_name VARCHAR(100), 
	target_type VARCHAR(50) NOT NULL, 
	target_id BIGINT NOT NULL, 
	folder VARCHAR(50), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_bf_target ON behavior_favorite (target_type, target_id);
CREATE INDEX idx_bf_user ON behavior_favorite (user_id);

DROP TABLE IF EXISTS "behavior_follow";

CREATE TABLE behavior_follow (
	id BIGSERIAL NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	target_user_id VARCHAR(64) NOT NULL, 
	is_mutual BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_bf2_user ON behavior_follow (user_id);
CREATE INDEX idx_bf2_target ON behavior_follow (target_user_id);

DROP TABLE IF EXISTS "behavior_like";

CREATE TABLE behavior_like (
	id BIGSERIAL NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	user_name VARCHAR(100), 
	target_type VARCHAR(50) NOT NULL, 
	target_id BIGINT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_bl_target ON behavior_like (target_type, target_id);
CREATE INDEX idx_bl_user ON behavior_like (user_id);

DROP TABLE IF EXISTS "behavior_report";

CREATE TABLE behavior_report (
	id BIGSERIAL NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	target_type VARCHAR(50) NOT NULL, 
	target_id BIGINT NOT NULL, 
	reason VARCHAR(500), 
	category VARCHAR(50), 
	status INTEGER, 
	handle_user VARCHAR(64), 
	handle_remark VARCHAR(500), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_br_target ON behavior_report (target_type, target_id);
CREATE INDEX ix_behavior_report_user_id ON behavior_report (user_id);
CREATE INDEX ix_behavior_report_status ON behavior_report (status);

DROP TABLE IF EXISTS "behavior_sensitive";

CREATE TABLE behavior_sensitive (
	id BIGSERIAL NOT NULL, 
	word VARCHAR(100) NOT NULL, 
	category VARCHAR(50), 
	level INTEGER, 
	action VARCHAR(20), 
	replacement VARCHAR(50), 
	status INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (word)
)

;
CREATE INDEX ix_behavior_sensitive_status ON behavior_sensitive (status);

DROP TABLE IF EXISTS "behavior_share";

CREATE TABLE behavior_share (
	id BIGSERIAL NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	target_type VARCHAR(50) NOT NULL, 
	target_id BIGINT NOT NULL, 
	platform VARCHAR(50), 
	ip VARCHAR(50), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_bs_user ON behavior_share (user_id);
CREATE INDEX idx_bs_target ON behavior_share (target_type, target_id);

DROP TABLE IF EXISTS "circle";

CREATE TABLE circle (
	id BIGSERIAL NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	description TEXT, 
	avatar VARCHAR(500), 
	cover VARCHAR(500), 
	category_id BIGINT, 
	owner_id VARCHAR(64) NOT NULL, 
	owner_name VARCHAR(100), 
	member_num INTEGER, 
	post_num INTEGER, 
	status INTEGER, 
	is_official BOOLEAN, 
	is_top BOOLEAN, 
	is_essence BOOLEAN, 
	deleted BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_circle_status ON circle (status);
CREATE INDEX idx_circle_category ON circle (category_id);

DROP TABLE IF EXISTS "circle_category";

CREATE TABLE circle_category (
	id BIGSERIAL NOT NULL, 
	pid BIGINT, 
	name VARCHAR(100) NOT NULL, 
	sort_order INTEGER, 
	is_show BOOLEAN, 
	icon VARCHAR(500), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

DROP TABLE IF EXISTS "circle_category_bind";

CREATE TABLE circle_category_bind (
	id BIGSERIAL NOT NULL, 
	circle_id BIGINT NOT NULL, 
	category_id BIGINT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_ccb_category ON circle_category_bind (category_id);
CREATE INDEX idx_ccb_circle ON circle_category_bind (circle_id);

DROP TABLE IF EXISTS "circle_category_relation";

CREATE TABLE circle_category_relation (
	id BIGSERIAL NOT NULL, 
	child_category_id BIGINT NOT NULL, 
	father_category_id BIGINT NOT NULL, 
	direct_father_category_id BIGINT, 
	is_sub INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_ccr_child ON circle_category_relation (child_category_id);
CREATE INDEX idx_ccr_father ON circle_category_relation (father_category_id);

DROP TABLE IF EXISTS "circle_member";

CREATE TABLE circle_member (
	id BIGSERIAL NOT NULL, 
	circle_id BIGINT NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	user_name VARCHAR(100), 
	user_avatar VARCHAR(500), 
	role VARCHAR(20), 
	status INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_cm_user ON circle_member (user_id);
CREATE INDEX idx_cm_circle ON circle_member (circle_id);
CREATE INDEX ix_circle_member_status ON circle_member (status);

DROP TABLE IF EXISTS "circle_post";

CREATE TABLE circle_post (
	id BIGSERIAL NOT NULL, 
	circle_id BIGINT NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	user_name VARCHAR(100), 
	user_avatar VARCHAR(500), 
	content TEXT NOT NULL, 
	images TEXT, 
	video VARCHAR(500), 
	status INTEGER, 
	like_num INTEGER, 
	comment_num INTEGER, 
	share_num INTEGER, 
	watch_num INTEGER, 
	is_top BOOLEAN, 
	is_essence BOOLEAN, 
	deleted BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_cp_circle ON circle_post (circle_id);
CREATE INDEX idx_cp_status ON circle_post (status);
CREATE INDEX idx_cp_user ON circle_post (user_id);

DROP TABLE IF EXISTS "circle_post_comment";

CREATE TABLE circle_post_comment (
	id BIGSERIAL NOT NULL, 
	post_id BIGINT NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	user_name VARCHAR(100), 
	content TEXT NOT NULL, 
	pid BIGINT, 
	reply_user_id VARCHAR(64), 
	reply_user_name VARCHAR(100), 
	like_num INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_cpc_post ON circle_post_comment (post_id);
CREATE INDEX ix_circle_post_comment_user_id ON circle_post_comment (user_id);

DROP TABLE IF EXISTS "circle_post_like";

CREATE TABLE circle_post_like (
	id BIGSERIAL NOT NULL, 
	post_id BIGINT NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_cpl_user ON circle_post_like (user_id);
CREATE INDEX idx_cpl_post ON circle_post_like (post_id);

DROP TABLE IF EXISTS "edu_check_in";

CREATE TABLE edu_check_in (
	id BIGSERIAL NOT NULL, 
	member_id VARCHAR(64) NOT NULL, 
	continuous_num INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_eci_member ON edu_check_in (member_id);

DROP TABLE IF EXISTS "edu_check_in_record";

CREATE TABLE edu_check_in_record (
	id BIGSERIAL NOT NULL, 
	member_id VARCHAR(64) NOT NULL, 
	type INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_ecir_member ON edu_check_in_record (member_id);
CREATE INDEX idx_ecir_type ON edu_check_in_record (type);

DROP TABLE IF EXISTS "edu_follow";

CREATE TABLE edu_follow (
	id BIGSERIAL NOT NULL, 
	member_id VARCHAR(64) NOT NULL, 
	follow_member_id VARCHAR(64) NOT NULL, 
	status INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_ef_member ON edu_follow (member_id);
CREATE INDEX idx_ef_follow ON edu_follow (follow_member_id);
CREATE INDEX idx_ef_status ON edu_follow (status);

DROP TABLE IF EXISTS "edu_invoice_application";

CREATE TABLE edu_invoice_application (
	id BIGSERIAL NOT NULL, 
	order_no VARCHAR(64) NOT NULL, 
	user_id VARCHAR(64), 
	company_id BIGINT, 
	product_fee BIGINT, 
	invoice_amount BIGINT, 
	invoice_content VARCHAR(500), 
	title_type INTEGER, 
	company_name VARCHAR(200), 
	company_tax_number VARCHAR(100), 
	company_address VARCHAR(500), 
	company_phone VARCHAR(50), 
	bank_name VARCHAR(100), 
	bank_account VARCHAR(50), 
	email VARCHAR(100), 
	mobile_phone VARCHAR(20), 
	invoice_status INTEGER, 
	create_user_id VARCHAR(64), 
	create_user_name VARCHAR(100), 
	update_user_id VARCHAR(64), 
	update_user_name VARCHAR(100), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_eia_order_no ON edu_invoice_application (order_no);
CREATE INDEX idx_eia_user ON edu_invoice_application (user_id);
CREATE INDEX idx_eia_status ON edu_invoice_application (invoice_status);

DROP TABLE IF EXISTS "edu_invoice_title";

CREATE TABLE edu_invoice_title (
	id BIGSERIAL NOT NULL, 
	user_id VARCHAR(64), 
	company_id BIGINT, 
	title_type INTEGER, 
	company_name VARCHAR(200), 
	company_tax_number VARCHAR(100), 
	company_address VARCHAR(500), 
	company_phone VARCHAR(50), 
	bank_name VARCHAR(100), 
	bank_account VARCHAR(50), 
	email VARCHAR(100), 
	mobile_phone VARCHAR(20), 
	default_flag BOOLEAN, 
	create_user_id VARCHAR(64), 
	update_user_id VARCHAR(64), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_eit_user ON edu_invoice_title (user_id);
CREATE INDEX idx_eit_company ON edu_invoice_title (company_id);

DROP TABLE IF EXISTS "edu_member";

CREATE TABLE edu_member (
	id BIGSERIAL NOT NULL, 
	wechat_open_id VARCHAR(100), 
	wechat_union_id VARCHAR(100), 
	username VARCHAR(100), 
	password VARCHAR(200), 
	code VARCHAR(100), 
	name VARCHAR(100), 
	status INTEGER, 
	gender VARCHAR(10), 
	telephone VARCHAR(50), 
	mobile VARCHAR(20), 
	email VARCHAR(100), 
	birthday DATE, 
	avatar VARCHAR(500), 
	expire_time VARCHAR(50), 
	description VARCHAR(500), 
	company_id BIGINT, 
	realname VARCHAR(100), 
	id_photo VARCHAR(500), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_em_company ON edu_member (company_id);
CREATE INDEX idx_em_mobile ON edu_member (mobile);
CREATE INDEX idx_em_status ON edu_member (status);
CREATE INDEX idx_em_username ON edu_member (username);
CREATE INDEX idx_em_openid ON edu_member (wechat_open_id);

DROP TABLE IF EXISTS "edu_member_company";

CREATE TABLE edu_member_company (
	id BIGSERIAL NOT NULL, 
	name VARCHAR(200) NOT NULL, 
	image VARCHAR(500), 
	mobile VARCHAR(20), 
	email VARCHAR(100), 
	status INTEGER, 
	sort_order INTEGER, 
	company_type_id BIGINT, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_emc_type ON edu_member_company (company_type_id);
CREATE INDEX idx_emc_status ON edu_member_company (status);

DROP TABLE IF EXISTS "edu_member_company_member_relation";

CREATE TABLE edu_member_company_member_relation (
	id BIGSERIAL NOT NULL, 
	member_id VARCHAR(64) NOT NULL, 
	member_company_id BIGINT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_emcmr_member ON edu_member_company_member_relation (member_id);
CREATE INDEX idx_emcmr_company ON edu_member_company_member_relation (member_company_id);

DROP TABLE IF EXISTS "edu_member_company_type";

CREATE TABLE edu_member_company_type (
	id BIGSERIAL NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	status INTEGER, 
	sort_order INTEGER, 
	member_maximum INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

DROP TABLE IF EXISTS "edu_member_group";

CREATE TABLE edu_member_group (
	id BIGSERIAL NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	sort_order INTEGER, 
	status INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

DROP TABLE IF EXISTS "edu_member_group_member_relation";

CREATE TABLE edu_member_group_member_relation (
	id BIGSERIAL NOT NULL, 
	member_id VARCHAR(64) NOT NULL, 
	member_group_id BIGINT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_emgmr_group ON edu_member_group_member_relation (member_group_id);
CREATE INDEX idx_emgmr_member ON edu_member_group_member_relation (member_id);

DROP TABLE IF EXISTS "edu_member_level";

CREATE TABLE edu_member_level (
	id BIGSERIAL NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	description VARCHAR(500), 
	conditions BIGINT, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

DROP TABLE IF EXISTS "edu_member_level_relation";

CREATE TABLE edu_member_level_relation (
	id BIGSERIAL NOT NULL, 
	member_id VARCHAR(64) NOT NULL, 
	level_id BIGINT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_emlr_level ON edu_member_level_relation (level_id);
CREATE INDEX idx_emlr_member ON edu_member_level_relation (member_id);

DROP TABLE IF EXISTS "edu_member_post";

CREATE TABLE edu_member_post (
	id BIGSERIAL NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	sort_order INTEGER, 
	status INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

DROP TABLE IF EXISTS "edu_member_post_member_relation";

CREATE TABLE edu_member_post_member_relation (
	id BIGSERIAL NOT NULL, 
	member_id VARCHAR(64) NOT NULL, 
	member_post_id BIGINT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_empmr_post ON edu_member_post_member_relation (member_post_id);
CREATE INDEX idx_empmr_member ON edu_member_post_member_relation (member_id);

DROP TABLE IF EXISTS "edu_member_tag";

CREATE TABLE edu_member_tag (
	id BIGSERIAL NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	sort_order INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

DROP TABLE IF EXISTS "edu_member_tag_member_relation";

CREATE TABLE edu_member_tag_member_relation (
	id BIGSERIAL NOT NULL, 
	member_id VARCHAR(64) NOT NULL, 
	member_tag_id BIGINT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_emtmr_member ON edu_member_tag_member_relation (member_id);
CREATE INDEX idx_emtmr_tag ON edu_member_tag_member_relation (member_tag_id);

DROP TABLE IF EXISTS "edu_order_item";

CREATE TABLE edu_order_item (
	id BIGSERIAL NOT NULL, 
	order_id BIGINT NOT NULL, 
	item_id BIGINT NOT NULL, 
	title VARCHAR(200), 
	image VARCHAR(500), 
	original_price BIGINT, 
	price BIGINT, 
	quantity INTEGER, 
	payment_amount BIGINT, 
	discount_amount BIGINT, 
	total_amount BIGINT, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_eoi_order ON edu_order_item (order_id);
CREATE INDEX idx_eoi_item ON edu_order_item (item_id);

DROP TABLE IF EXISTS "edu_order_payment";

CREATE TABLE edu_order_payment (
	id BIGSERIAL NOT NULL, 
	order_id BIGINT NOT NULL, 
	status INTEGER, 
	channel VARCHAR(20), 
	amount BIGINT, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_eop_order ON edu_order_payment (order_id);
CREATE INDEX idx_eop_status ON edu_order_payment (status);

DROP TABLE IF EXISTS "edu_payment";

CREATE TABLE edu_payment (
	id BIGSERIAL NOT NULL, 
	order_no VARCHAR(64) NOT NULL, 
	pay_no VARCHAR(64), 
	status INTEGER, 
	callback_url VARCHAR(500), 
	subject VARCHAR(256), 
	total_amount BIGINT NOT NULL, 
	order_create_time TIMESTAMP WITHOUT TIME ZONE, 
	expire_time TIMESTAMP WITHOUT TIME ZONE, 
	return_url VARCHAR(500), 
	platform VARCHAR(20), 
	terminal VARCHAR(20), 
	channel VARCHAR(20), 
	ip VARCHAR(64), 
	open_id VARCHAR(100), 
	transaction_id VARCHAR(100), 
	user_id VARCHAR(64), 
	department_id BIGINT, 
	company_id BIGINT, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_ep_order_no ON edu_payment (order_no);
CREATE INDEX idx_ep_status ON edu_payment (status);
CREATE INDEX idx_ep_pay_no ON edu_payment (pay_no);
CREATE INDEX idx_ep_user ON edu_payment (user_id);

DROP TABLE IF EXISTS "edu_payment_config";

CREATE TABLE edu_payment_config (
	id BIGSERIAL NOT NULL, 
	platform_code VARCHAR(50) NOT NULL, 
	platform_name VARCHAR(100), 
	config_key VARCHAR(100) NOT NULL, 
	config_value TEXT, 
	description VARCHAR(500), 
	status INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_epc_status ON edu_payment_config (status);
CREATE INDEX idx_epc_platform ON edu_payment_config (platform_code);

DROP TABLE IF EXISTS "exam";

CREATE TABLE exam (
	id BIGSERIAL NOT NULL, 
	name VARCHAR(64) NOT NULL, 
	code VARCHAR(64), 
	start_time TIMESTAMP WITHOUT TIME ZONE, 
	end_time TIMESTAMP WITHOUT TIME ZONE, 
	image VARCHAR(500), 
	status INTEGER, 
	phrase VARCHAR(500), 
	introduction TEXT, 
	type VARCHAR(20), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_exam_type ON exam (type);
CREATE INDEX idx_exam_status ON exam (status);

DROP TABLE IF EXISTS "exam_category";

CREATE TABLE exam_category (
	id BIGSERIAL NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	pid BIGINT, 
	sort_order INTEGER, 
	is_show BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

DROP TABLE IF EXISTS "exam_category_relation";

CREATE TABLE exam_category_relation (
	id BIGSERIAL NOT NULL, 
	exam_id BIGINT NOT NULL, 
	category_id BIGINT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_ecr_category ON exam_category_relation (category_id);
CREATE INDEX idx_ecr_exam ON exam_category_relation (exam_id);

DROP TABLE IF EXISTS "exam_chapter";

CREATE TABLE exam_chapter (
	id BIGSERIAL NOT NULL, 
	paper_id BIGINT, 
	title VARCHAR(200) NOT NULL, 
	description TEXT, 
	cover VARCHAR(500), 
	question_num INTEGER, 
	total_score FLOAT, 
	sort_order INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_exam_chapter_sort ON exam_chapter (sort_order);
CREATE INDEX idx_exam_chapter_paper ON exam_chapter (paper_id);

DROP TABLE IF EXISTS "exam_chapter_section";

CREATE TABLE exam_chapter_section (
	id BIGSERIAL NOT NULL, 
	chapter_id BIGINT, 
	paper_id BIGINT, 
	title VARCHAR(200) NOT NULL, 
	description TEXT, 
	media_url VARCHAR(500), 
	content TEXT, 
	question_num INTEGER, 
	total_score FLOAT, 
	duration INTEGER, 
	sort_order INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_exam_chapter_section_chapter ON exam_chapter_section (chapter_id);
CREATE INDEX idx_exam_chapter_section_paper ON exam_chapter_section (paper_id);

DROP TABLE IF EXISTS "exam_paper";

CREATE TABLE exam_paper (
	id BIGSERIAL NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	code VARCHAR(64), 
	description TEXT, 
	category_id BIGINT, 
	course_id BIGINT, 
	cover VARCHAR(500), 
	total_score FLOAT, 
	pass_score FLOAT, 
	duration INTEGER, 
	question_disordered BOOLEAN, 
	option_disordered BOOLEAN, 
	question_num INTEGER, 
	attempt_num INTEGER, 
	avg_score FLOAT, 
	type INTEGER, 
	difficulty INTEGER, 
	is_free BOOLEAN, 
	price FLOAT, 
	status INTEGER, 
	sort_order INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_exam_paper_status ON exam_paper (status);
CREATE INDEX idx_exam_paper_cat ON exam_paper (category_id);

DROP TABLE IF EXISTS "exam_question";

CREATE TABLE exam_question (
	id BIGSERIAL NOT NULL, 
	paper_id BIGINT NOT NULL, 
	type INTEGER NOT NULL, 
	title VARCHAR(500), 
	content TEXT, 
	note TEXT, 
	options TEXT, 
	answer TEXT, 
	reference_answer TEXT, 
	analysis TEXT, 
	reference_answer_note TEXT, 
	status INTEGER, 
	score FLOAT, 
	difficulty INTEGER, 
	sort_order INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_eq_paper ON exam_question (paper_id);
CREATE INDEX idx_eq_type ON exam_question (type);

DROP TABLE IF EXISTS "exam_record";

CREATE TABLE exam_record (
	id BIGSERIAL NOT NULL, 
	exam_id BIGINT, 
	exam_chapter_section_id BIGINT, 
	sign_up_id BIGINT, 
	paper_id BIGINT NOT NULL, 
	paper_title VARCHAR(200), 
	user_id VARCHAR(64) NOT NULL, 
	user_name VARCHAR(100), 
	member_id BIGINT, 
	score FLOAT, 
	total_score FLOAT, 
	pass_score FLOAT, 
	is_pass BOOLEAN, 
	status INTEGER, 
	start_time TIMESTAMP WITHOUT TIME ZONE, 
	submit_time TIMESTAMP WITHOUT TIME ZONE, 
	end_time TIMESTAMP WITHOUT TIME ZONE, 
	cost_time INTEGER, 
	correct_num INTEGER, 
	wrong_num INTEGER, 
	answer_data TEXT, 
	answer TEXT, 
	reference_answer TEXT, 
	remark VARCHAR(500), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_er_signup ON exam_record (sign_up_id);
CREATE INDEX idx_er_paper ON exam_record (paper_id);
CREATE INDEX ix_exam_record_status ON exam_record (status);
CREATE INDEX idx_er_user ON exam_record (user_id);
CREATE INDEX idx_er_exam ON exam_record (exam_id);

DROP TABLE IF EXISTS "exam_sign_up";

CREATE TABLE exam_sign_up (
	id BIGSERIAL NOT NULL, 
	exam_id BIGINT NOT NULL, 
	member_id VARCHAR(64) NOT NULL, 
	status INTEGER, 
	completed_time TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_su_exam ON exam_sign_up (exam_id);
CREATE INDEX idx_su_member ON exam_sign_up (member_id);
CREATE INDEX idx_su_status ON exam_sign_up (status);

DROP TABLE IF EXISTS "exam_wrong_question";

CREATE TABLE exam_wrong_question (
	id BIGSERIAL NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	question_id BIGINT NOT NULL, 
	paper_id BIGINT NOT NULL, 
	paper_title VARCHAR(200), 
	user_answer TEXT, 
	right_answer TEXT, 
	wrong_count INTEGER, 
	last_wrong_time TIMESTAMP WITHOUT TIME ZONE, 
	is_mastered BOOLEAN, 
	title VARCHAR(500), 
	note TEXT, 
	type INTEGER, 
	reference_answer TEXT, 
	reference_answer_note TEXT, 
	difficulty INTEGER, 
	score FLOAT, 
	options TEXT, 
	scored FLOAT, 
	result BOOLEAN, 
	member_id BIGINT, 
	answer TEXT, 
	status INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_ewq_user ON exam_wrong_question (user_id);
CREATE INDEX idx_ewq_question ON exam_wrong_question (question_id);

DROP TABLE IF EXISTS "exchange_rate";

CREATE TABLE exchange_rate (
	id BIGSERIAL NOT NULL, 
	currency_code VARCHAR(20), 
	currency_name VARCHAR(50), 
	rate FLOAT, 
	status INTEGER, 
	sort INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_exchange_rate_status ON exchange_rate (status);

DROP TABLE IF EXISTS "gen_table";

CREATE TABLE gen_table (
	table_id BIGSERIAL NOT NULL, 
	table_name VARCHAR(200) NOT NULL, 
	table_comment VARCHAR(500), 
	sub_table_name VARCHAR(200), 
	sub_table_fk_name VARCHAR(200), 
	class_name VARCHAR(200), 
	tpl_category VARCHAR(10), 
	tpl_web_type VARCHAR(10), 
	package_name VARCHAR(100), 
	module_name VARCHAR(100), 
	business_name VARCHAR(100), 
	function_name VARCHAR(500), 
	function_author VARCHAR(100), 
	gen_type VARCHAR(1), 
	gen_path VARCHAR(200), 
	options TEXT, 
	create_by VARCHAR(64), 
	create_time TIMESTAMP WITHOUT TIME ZONE, 
	update_by VARCHAR(64), 
	update_time TIMESTAMP WITHOUT TIME ZONE, 
	remark TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (table_id)
)

;
CREATE INDEX ix_gen_table_create_by ON gen_table (create_by);
CREATE INDEX ix_gen_table_update_by ON gen_table (update_by);

DROP TABLE IF EXISTS "gen_table_column";

CREATE TABLE gen_table_column (
	column_id BIGSERIAL NOT NULL, 
	table_id BIGINT, 
	column_name VARCHAR(200), 
	column_comment VARCHAR(1000), 
	column_type VARCHAR(100), 
	java_type VARCHAR(100), 
	java_field VARCHAR(200), 
	is_pk VARCHAR(1), 
	is_increment VARCHAR(1), 
	is_required VARCHAR(1), 
	is_insert VARCHAR(1), 
	is_edit VARCHAR(1), 
	is_list VARCHAR(1), 
	is_query VARCHAR(1), 
	query_type VARCHAR(200), 
	html_type VARCHAR(200), 
	dict_type VARCHAR(200), 
	sort INTEGER, 
	create_by VARCHAR(64), 
	create_time TIMESTAMP WITHOUT TIME ZONE, 
	update_by VARCHAR(64), 
	update_time TIMESTAMP WITHOUT TIME ZONE, 
	remark TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (column_id)
)

;
CREATE INDEX ix_gen_table_column_update_by ON gen_table_column (update_by);
CREATE INDEX ix_gen_table_column_create_by ON gen_table_column (create_by);

DROP TABLE IF EXISTS "homework";

CREATE TABLE homework (
	id BIGSERIAL NOT NULL, 
	lesson_id BIGINT NOT NULL, 
	content TEXT, 
	url VARCHAR(500), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_hw_lesson ON homework (lesson_id);

DROP TABLE IF EXISTS "id_mapping";

CREATE TABLE id_mapping (
	id VARCHAR(64) NOT NULL, 
	source_table VARCHAR(64) NOT NULL, 
	old_id VARCHAR(32) NOT NULL, 
	new_uuid VARCHAR(64) NOT NULL, 
	migration_batch VARCHAR(32), 
	remark VARCHAR(500), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_idm_batch ON id_mapping (migration_batch);
CREATE UNIQUE INDEX uk_idm_source_old ON id_mapping (source_table, old_id);
CREATE INDEX idx_idm_source_new ON id_mapping (source_table, new_uuid);

DROP TABLE IF EXISTS "lesson_access";

CREATE TABLE lesson_access (
	id BIGSERIAL NOT NULL, 
	lesson_id BIGINT NOT NULL, 
	access_type VARCHAR(50) NOT NULL, 
	access_value VARCHAR(100) NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_la_lesson ON lesson_access (lesson_id);

DROP TABLE IF EXISTS "lesson_task";

CREATE TABLE lesson_task (
	id BIGSERIAL NOT NULL, 
	lesson_id BIGINT NOT NULL, 
	lesson_chapter_id BIGINT, 
	lesson_chapter_section_id BIGINT, 
	title VARCHAR(200), 
	content_type VARCHAR(50), 
	conditions TEXT, 
	status INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_task_lesson ON lesson_task (lesson_id);
CREATE INDEX idx_task_chapter ON lesson_task (lesson_chapter_id);

DROP TABLE IF EXISTS "live_channel";

CREATE TABLE live_channel (
	id BIGSERIAL NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	description TEXT, 
	cover VARCHAR(500), 
	host_id VARCHAR(64) NOT NULL, 
	host_name VARCHAR(100), 
	host_avatar VARCHAR(500), 
	category_id BIGINT, 
	push_url VARCHAR(500), 
	pull_url VARCHAR(500), 
	play_url_hls VARCHAR(500), 
	play_url_rtmp VARCHAR(500), 
	play_url_flv VARCHAR(500), 
	status INTEGER, 
	type INTEGER, 
	password VARCHAR(50), 
	price INTEGER, 
	is_record BOOLEAN, 
	record_url VARCHAR(500), 
	start_time TIMESTAMP WITHOUT TIME ZONE, 
	end_time TIMESTAMP WITHOUT TIME ZONE, 
	plan_start_time TIMESTAMP WITHOUT TIME ZONE, 
	plan_duration INTEGER, 
	online_num INTEGER, 
	view_num INTEGER, 
	like_num INTEGER, 
	comment_num INTEGER, 
	share_num INTEGER, 
	is_top BOOLEAN, 
	is_essence BOOLEAN, 
	deleted BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_lc_start ON live_channel (start_time);
CREATE INDEX idx_lc_status ON live_channel (status);

DROP TABLE IF EXISTS "live_channel_category";

CREATE TABLE live_channel_category (
	id BIGSERIAL NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	sort_order INTEGER, 
	is_show BOOLEAN, 
	is_show_index BOOLEAN, 
	icon VARCHAR(500), 
	type VARCHAR(50), 
	level INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

DROP TABLE IF EXISTS "live_comment";

CREATE TABLE live_comment (
	id BIGSERIAL NOT NULL, 
	channel_id BIGINT NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	user_name VARCHAR(100), 
	user_avatar VARCHAR(500), 
	content TEXT NOT NULL, 
	type INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_live_comment_user_id ON live_comment (user_id);
CREATE INDEX idx_lcm_channel ON live_comment (channel_id);

DROP TABLE IF EXISTS "live_gift";

CREATE TABLE live_gift (
	id BIGSERIAL NOT NULL, 
	channel_id BIGINT NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	user_name VARCHAR(100), 
	gift_id BIGINT, 
	gift_name VARCHAR(100), 
	gift_count INTEGER, 
	total_price INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_live_gift_user_id ON live_gift (user_id);
CREATE INDEX idx_lg_channel ON live_gift (channel_id);

DROP TABLE IF EXISTS "live_subscribe";

CREATE TABLE live_subscribe (
	id BIGSERIAL NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	channel_id BIGINT NOT NULL, 
	is_notify BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_ls_user ON live_subscribe (user_id);
CREATE INDEX idx_ls_channel ON live_subscribe (channel_id);

DROP TABLE IF EXISTS "message";

CREATE TABLE message (
	id BIGSERIAL NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	sender_id VARCHAR(64), 
	sender_name VARCHAR(100), 
	type VARCHAR(20), 
	title VARCHAR(200) NOT NULL, 
	content TEXT NOT NULL, 
	target_type VARCHAR(50), 
	target_id VARCHAR(64), 
	target_url VARCHAR(500), 
	is_read BOOLEAN, 
	read_time TIMESTAMP WITHOUT TIME ZONE, 
	is_top BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_msg_status ON message (is_read);
CREATE INDEX idx_msg_user ON message (user_id);

DROP TABLE IF EXISTS "message_announcement";

CREATE TABLE message_announcement (
	id BIGSERIAL NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	content TEXT NOT NULL, 
	cover VARCHAR(500), 
	type INTEGER, 
	priority INTEGER, 
	status INTEGER, 
	target_user VARCHAR(20), 
	target_url VARCHAR(500), 
	publish_time TIMESTAMP WITHOUT TIME ZONE, 
	expire_time TIMESTAMP WITHOUT TIME ZONE, 
	view_num INTEGER, 
	is_top BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_ann_status ON message_announcement (status);

DROP TABLE IF EXISTS "message_read_log";

CREATE TABLE message_read_log (
	id BIGSERIAL NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	message_id BIGINT NOT NULL, 
	message_type VARCHAR(20) NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_mrl_user ON message_read_log (user_id);

DROP TABLE IF EXISTS "message_template";

CREATE TABLE message_template (
	id BIGSERIAL NOT NULL, 
	code VARCHAR(50) NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	type VARCHAR(20) NOT NULL, 
	subject VARCHAR(200), 
	content TEXT NOT NULL, 
	variables VARCHAR(500), 
	status INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (code)
)

;
CREATE INDEX ix_message_template_status ON message_template (status);

DROP TABLE IF EXISTS "notification";

CREATE TABLE notification (
	id BIGSERIAL NOT NULL, 
	user_id VARCHAR(64), 
	title VARCHAR(200) NOT NULL, 
	content TEXT NOT NULL, 
	type VARCHAR(20), 
	channel VARCHAR(50), 
	target_type VARCHAR(50), 
	target_id VARCHAR(64), 
	target_url VARCHAR(500), 
	status INTEGER, 
	send_time TIMESTAMP WITHOUT TIME ZONE, 
	read_time TIMESTAMP WITHOUT TIME ZONE, 
	retry_count INTEGER, 
	error_msg VARCHAR(500), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_notif_status ON notification (status);
CREATE INDEX idx_notif_type ON notification (type);
CREATE INDEX idx_notif_user ON notification (user_id);

DROP TABLE IF EXISTS "notification_channel";

CREATE TABLE notification_channel (
	id BIGSERIAL NOT NULL, 
	name VARCHAR(50) NOT NULL, 
	type VARCHAR(20) NOT NULL, 
	config TEXT, 
	is_default BOOLEAN, 
	status INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_notification_channel_status ON notification_channel (status);

DROP TABLE IF EXISTS "notification_log";

CREATE TABLE notification_log (
	id BIGSERIAL NOT NULL, 
	notification_id BIGINT NOT NULL, 
	user_id VARCHAR(64), 
	channel VARCHAR(50), 
	type VARCHAR(20), 
	success BOOLEAN, 
	response TEXT, 
	error VARCHAR(500), 
	send_time TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_nl_notif ON notification_log (notification_id);
CREATE INDEX idx_nl_time ON notification_log (send_time);
CREATE INDEX ix_notification_log_user_id ON notification_log (user_id);

DROP TABLE IF EXISTS "notification_subscription";

CREATE TABLE notification_subscription (
	id BIGSERIAL NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	type VARCHAR(20) NOT NULL, 
	category VARCHAR(50) NOT NULL, 
	enabled BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_ns_user ON notification_subscription (user_id);

-- ===== Database: zhs_center_project =====
DROP TABLE IF EXISTS "oauth_apps";

CREATE TABLE oauth_apps (
	id BIGSERIAL NOT NULL, 
	client_id VARCHAR(100) NOT NULL, 
	client_secret VARCHAR(255) NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	redirect_uri TEXT, 
	is_active INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (client_id)
)

;

DROP TABLE IF EXISTS "oauth_private_keys";

CREATE TABLE oauth_private_keys (
	id BIGSERIAL NOT NULL, 
	app_id VARCHAR(64) NOT NULL, 
	key_type VARCHAR(32), 
	key_data TEXT NOT NULL, 
	status INTEGER, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_oauth_private_keys_status ON oauth_private_keys (status);

DROP TABLE IF EXISTS "oauth_sessions";

CREATE TABLE oauth_sessions (
	id BIGSERIAL NOT NULL, 
	code VARCHAR(100) NOT NULL, 
	client_id VARCHAR(100) NOT NULL, 
	user_uuid VARCHAR(64) NOT NULL, 
	expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	state VARCHAR(128), 
	is_used INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (code)
)

;

DROP TABLE IF EXISTS "oauth_users";

CREATE TABLE oauth_users (
	id BIGSERIAL NOT NULL, 
	user_uuid VARCHAR(64) NOT NULL, 
	provider VARCHAR(50) NOT NULL, 
	provider_user_id VARCHAR(100) NOT NULL, 
	access_token TEXT, 
	refresh_token TEXT, 
	expires_at TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

-- ===== Database: zhs_ai_project =====
DROP TABLE IF EXISTS "paper_category";

CREATE TABLE paper_category (
	id BIGSERIAL NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	sort_order INTEGER, 
	is_show BOOLEAN, 
	is_show_index BOOLEAN, 
	image VARCHAR(500), 
	level INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_pc_show ON paper_category (is_show);
CREATE INDEX idx_pc_level ON paper_category (level);

DROP TABLE IF EXISTS "paper_category_relation";

CREATE TABLE paper_category_relation (
	id BIGSERIAL NOT NULL, 
	child_category_id BIGINT NOT NULL, 
	father_category_id BIGINT NOT NULL, 
	direct_father_category_id BIGINT, 
	is_sub INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_pcr_father ON paper_category_relation (father_category_id);
CREATE INDEX idx_pcr_child ON paper_category_relation (child_category_id);

DROP TABLE IF EXISTS "paper_paper_category_relation";

CREATE TABLE paper_paper_category_relation (
	id BIGSERIAL NOT NULL, 
	paper_id BIGINT NOT NULL, 
	category_id BIGINT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_ppcr_paper ON paper_paper_category_relation (paper_id);
CREATE INDEX idx_ppcr_category ON paper_paper_category_relation (category_id);

DROP TABLE IF EXISTS "paper_question";

CREATE TABLE paper_question (
	id BIGSERIAL NOT NULL, 
	paper_id BIGINT NOT NULL, 
	question_id BIGINT NOT NULL, 
	sort_order INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_pq_question ON paper_question (question_id);
CREATE INDEX idx_pq_paper ON paper_question (paper_id);

DROP TABLE IF EXISTS "paper_question_rule";

CREATE TABLE paper_question_rule (
	id BIGSERIAL NOT NULL, 
	paper_id BIGINT NOT NULL, 
	rule_json TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_pqr_paper ON paper_question_rule (paper_id);

DROP TABLE IF EXISTS "payment_callbacks";

CREATE TABLE payment_callbacks (
	id BIGSERIAL NOT NULL, 
	order_id VARCHAR(64), 
	payment_method VARCHAR(32), 
	callback_type VARCHAR(32), 
	raw_data TEXT, 
	status INTEGER, 
	amount INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_payment_callbacks_order_id ON payment_callbacks (order_id);

DROP TABLE IF EXISTS "point_account";

CREATE TABLE point_account (
	id BIGSERIAL NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	user_name VARCHAR(100), 
	total_point BIGINT, 
	available_point BIGINT, 
	frozen_point BIGINT, 
	used_point BIGINT, 
	level INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (user_id)
)

;
CREATE INDEX idx_pa_user ON point_account (user_id);

DROP TABLE IF EXISTS "point_exchange";

CREATE TABLE point_exchange (
	id BIGSERIAL NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	user_name VARCHAR(100), 
	goods_id BIGINT NOT NULL, 
	goods_name VARCHAR(200), 
	point_cost INTEGER, 
	quantity INTEGER, 
	total_point INTEGER, 
	status INTEGER, 
	address VARCHAR(500), 
	contact VARCHAR(100), 
	express_no VARCHAR(100), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_pe_user ON point_exchange (user_id);
CREATE INDEX idx_pe_status ON point_exchange (status);

DROP TABLE IF EXISTS "point_goods";

CREATE TABLE point_goods (
	id BIGSERIAL NOT NULL, 
	name VARCHAR(200) NOT NULL, 
	description TEXT, 
	image VARCHAR(500), 
	point_cost INTEGER, 
	stock INTEGER, 
	sold_num INTEGER, 
	limit_per_user INTEGER, 
	type VARCHAR(20), 
	status INTEGER, 
	sort_order INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_pg_status ON point_goods (status);

DROP TABLE IF EXISTS "point_log";

CREATE TABLE point_log (
	id BIGSERIAL NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	user_name VARCHAR(100), 
	type VARCHAR(20), 
	action VARCHAR(50) NOT NULL, 
	point INTEGER, 
	balance INTEGER, 
	description VARCHAR(500), 
	ref_id VARCHAR(64), 
	ref_type VARCHAR(50), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_pl_user ON point_log (user_id);
CREATE INDEX idx_pl_time ON point_log (created_at);
CREATE INDEX idx_pl_action ON point_log (action);

DROP TABLE IF EXISTS "point_rule";

CREATE TABLE point_rule (
	id BIGSERIAL NOT NULL, 
	code VARCHAR(50) NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	type VARCHAR(20), 
	action VARCHAR(50) NOT NULL, 
	point INTEGER, 
	max_per_day INTEGER, 
	description VARCHAR(500), 
	status INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (code)
)

;
CREATE INDEX ix_point_rule_status ON point_rule (status);

DROP TABLE IF EXISTS "admin_user";

CREATE TABLE public.admin_user (
	user_id BIGSERIAL NOT NULL, 
	user_uuid VARCHAR(36), 
	dept_id BIGINT, 
	user_name VARCHAR(30) NOT NULL, 
	nick_name VARCHAR(30) NOT NULL, 
	email VARCHAR(50), 
	phone VARCHAR(11), 
	sex VARCHAR(1), 
	avatar VARCHAR(100), 
	password VARCHAR(100), 
	status VARCHAR(1), 
	del_flag VARCHAR(1), 
	login_ip VARCHAR(128), 
	login_date TIMESTAMP WITHOUT TIME ZONE, 
	create_by VARCHAR(64), 
	create_time TIMESTAMP WITHOUT TIME ZONE, 
	update_by VARCHAR(64), 
	update_time TIMESTAMP WITHOUT TIME ZONE, 
	remark VARCHAR(500), 
	PRIMARY KEY (user_id)
)

;
CREATE UNIQUE INDEX ix_public_admin_user_user_uuid ON public.admin_user (user_uuid);
CREATE INDEX ix_admin_user_update_by ON public.admin_user (update_by);
CREATE INDEX ix_admin_user_create_by ON public.admin_user (create_by);

DROP TABLE IF EXISTS "agents";

CREATE TABLE public.agents (
	agent_id VARCHAR(64) NOT NULL, 
	agent_name VARCHAR(200) NOT NULL, 
	agent_description TEXT, 
	agent_avatar VARCHAR(500), 
	agent_version VARCHAR(32), 
	bot_id VARCHAR(64), 
	bot_id_str VARCHAR(64), 
	bot_name VARCHAR(200), 
	connector_id INTEGER, 
	connector_user_id VARCHAR(64), 
	user_id VARCHAR(64), 
	user_id_str VARCHAR(64), 
	user_name VARCHAR(100), 
	agent_prompt TEXT, 
	agent_model VARCHAR(100), 
	agent_temperature FLOAT, 
	agent_max_tokens INTEGER, 
	agent_variables TEXT, 
	publish_status INTEGER, 
	publish_channel VARCHAR(50), 
	publish_time TIMESTAMP WITHOUT TIME ZONE, 
	category VARCHAR(100), 
	tags VARCHAR(500), 
	is_public INTEGER, 
	access_level VARCHAR(50), 
	usage_count BIGINT, 
	like_count BIGINT, 
	share_count BIGINT, 
	creator_id VARCHAR(64), 
	creator_name VARCHAR(100), 
	callback_data_1 VARCHAR(500), 
	callback_data_2 VARCHAR(500), 
	callback_data_3 VARCHAR(500), 
	prologue TEXT, 
	all_token BIGINT, 
	sort INTEGER, 
	coze_account_id VARCHAR(64), 
	type INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (agent_id)
)

;
CREATE INDEX ix_agents_user_id ON public.agents (user_id);

DROP TABLE IF EXISTS "ai_gc";

CREATE TABLE public.ai_gc (
	id BIGSERIAL NOT NULL, 
	user_uuid VARCHAR(64) NOT NULL, 
	agent_id VARCHAR(64), 
	gc_type VARCHAR(32), 
	content TEXT, 
	status INTEGER, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_ai_gc_status ON public.ai_gc (status);

-- ===== Database: zhs_center_project =====
DROP TABLE IF EXISTS "user_margin";

CREATE TABLE public.user_margin (
	user_uuid VARCHAR(64) NOT NULL, 
	token_quantity BIGINT, 
	PRIMARY KEY (user_uuid)
)

;

DROP TABLE IF EXISTS "users";

CREATE TABLE public.users (
	uuid VARCHAR(64) NOT NULL, 
	phone VARCHAR(32), 
	password_hash VARCHAR(255), 
	password_salt VARCHAR(64), 
	nickname VARCHAR(100), 
	avatar VARCHAR(500), 
	gender INTEGER, 
	birthday TIMESTAMP WITHOUT TIME ZONE, 
	status INTEGER, 
	invite_code VARCHAR(32), 
	parent_id VARCHAR(64), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	is_vip INTEGER, 
	PRIMARY KEY (uuid), 
	UNIQUE (invite_code)
)

;
CREATE INDEX ix_users_parent_id ON public.users (parent_id);
CREATE INDEX ix_users_status ON public.users (status);

-- ===== Database: zhs_ai_project =====
DROP TABLE IF EXISTS "video_generation_tasks";

CREATE TABLE public.video_generation_tasks (
	id SERIAL NOT NULL, 
	task_id VARCHAR(36) NOT NULL, 
	user_uuid VARCHAR(255) NOT NULL, 
	chat_id VARCHAR(255), 
	status VARCHAR(50) NOT NULL, 
	message VARCHAR(512), 
	result TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_video_generation_tasks_status ON public.video_generation_tasks (status);
CREATE UNIQUE INDEX ix_public_video_generation_tasks_task_id ON public.video_generation_tasks (task_id);
CREATE INDEX ix_public_video_generation_tasks_id ON public.video_generation_tasks (id);
CREATE INDEX ix_public_video_generation_tasks_user_uuid ON public.video_generation_tasks (user_uuid);

DROP TABLE IF EXISTS "zhs_agent_buy";

CREATE TABLE public.zhs_agent_buy (
	id BIGSERIAL NOT NULL, 
	agent_order_uuid VARCHAR(64), 
	order_no VARCHAR(64), 
	bug_uuid VARCHAR(64), 
	bug_name VARCHAR(100), 
	agent_id VARCHAR(64), 
	agent_name VARCHAR(200), 
	category_id VARCHAR(64), 
	discount BIGINT, 
	real_price BIGINT, 
	price BIGINT, 
	count BIGINT, 
	bug_time TIMESTAMP WITHOUT TIME ZONE, 
	expiration_date TIMESTAMP WITHOUT TIME ZONE, 
	status VARCHAR(10), 
	settlement VARCHAR(10), 
	prologue TEXT, 
	settlement_time TIMESTAMP WITHOUT TIME ZONE, 
	issue_no INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_agent_buy_status ON public.zhs_agent_buy (status);

DROP TABLE IF EXISTS "zhs_agent_settlement";

CREATE TABLE public.zhs_agent_settlement (
	id VARCHAR(36) NOT NULL, 
	uuid VARCHAR(36), 
	order_no VARCHAR(64), 
	create_time TIMESTAMP WITHOUT TIME ZONE, 
	buy_uuid VARCHAR(64), 
	agent_id VARCHAR(64), 
	agent_name VARCHAR(128), 
	prologue TEXT, 
	agent_avatar VARCHAR(500), 
	expiration_date TIMESTAMP WITHOUT TIME ZONE, 
	settlement VARCHAR(2), 
	withdrawal VARCHAR(2), 
	withdrawal_id VARCHAR(36), 
	issue_no VARCHAR(32), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_s_order ON public.zhs_agent_settlement (order_no);
CREATE INDEX idx_s_status ON public.zhs_agent_settlement (settlement);

DROP TABLE IF EXISTS "zhs_commission_flow";

CREATE TABLE public.zhs_commission_flow (
	id BIGSERIAL NOT NULL, 
	user_id VARCHAR(64), 
	order_id BIGINT, 
	open_id VARCHAR(100), 
	amount BIGINT, 
	type INTEGER, 
	status INTEGER, 
	token BIGINT, 
	time BIGINT, 
	remark VARCHAR(255), 
	belongers_open_id VARCHAR(100), 
	order_status INTEGER, 
	invited_user_id VARCHAR(64), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_commission_flow_user_id ON public.zhs_commission_flow (user_id);
CREATE INDEX ix_zhs_commission_flow_status ON public.zhs_commission_flow (status);

-- ===== Database: zhs_educational_training =====
DROP TABLE IF EXISTS "zhs_course";

CREATE TABLE public.zhs_course (
	id BIGSERIAL NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	subtitle TEXT, 
	content TEXT, 
	remark TEXT, 
	remark_file VARCHAR(500), 
	binding VARCHAR(500), 
	stage VARCHAR(50), 
	is_hidden INTEGER, 
	is_del INTEGER, 
	sort INTEGER, 
	creator VARCHAR(100), 
	label VARCHAR(100), 
	audit_status INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

-- ===== Database: zhs_ai_project =====
DROP TABLE IF EXISTS "zhs_course_new";

CREATE TABLE public.zhs_course_new (
	id VARCHAR(64) NOT NULL, 
	title VARCHAR(200), 
	subtitle TEXT, 
	content TEXT, 
	remark_file VARCHAR(500), 
	binding VARCHAR(500), 
	stage INTEGER, 
	is_hidden INTEGER, 
	is_del INTEGER, 
	sort INTEGER, 
	creator VARCHAR(64), 
	updator VARCHAR(64), 
	remark TEXT, 
	label VARCHAR(100), 
	types VARCHAR(500), 
	categorys VARCHAR(500), 
	platform VARCHAR(64), 
	audit_status INTEGER, 
	nickname VARCHAR(100), 
	avatar VARCHAR(500), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

-- ===== Database: zhs_educational_training =====
DROP TABLE IF EXISTS "zhs_identity";

CREATE TABLE public.zhs_identity (
	id BIGSERIAL NOT NULL, 
	identity_name VARCHAR(100) NOT NULL, 
	identity_type VARCHAR(50), 
	status INTEGER, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_identity_status ON public.zhs_identity (status);

-- ===== Database: zhs_ai_project =====
DROP TABLE IF EXISTS "zhs_identity_ext";

CREATE TABLE public.zhs_identity_ext (
	id SERIAL NOT NULL, 
	uuid VARCHAR(64), 
	name VARCHAR(100), 
	platform_id VARCHAR(64), 
	organization_id VARCHAR(64), 
	parent_id VARCHAR(64), 
	binding VARCHAR(500), 
	is_hidden INTEGER, 
	is_del INTEGER, 
	is_cross INTEGER, 
	creator VARCHAR(64), 
	updator VARCHAR(64), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

DROP TABLE IF EXISTS "zhs_order";

CREATE TABLE public.zhs_order (
	id BIGSERIAL NOT NULL, 
	user_id VARCHAR(64), 
	out_trade_no VARCHAR(64), 
	open_id VARCHAR(100), 
	amount BIGINT, 
	status INTEGER, 
	payment_status INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	paid_at TIMESTAMP WITHOUT TIME ZONE, 
	product_id VARCHAR(64), 
	order_type INTEGER, 
	activity_id VARCHAR(64), 
	product_identity_id VARCHAR(64), 
	pay_type VARCHAR(20), 
	refund_time TIMESTAMP WITHOUT TIME ZONE, 
	refund_reason VARCHAR(255), 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_order_status ON public.zhs_order (status);
CREATE INDEX ix_zhs_order_user_id ON public.zhs_order (user_id);

DROP TABLE IF EXISTS "zhs_organization_ext";

CREATE TABLE public.zhs_organization_ext (
	id SERIAL NOT NULL, 
	uuid VARCHAR(64), 
	platform_id VARCHAR(64), 
	name VARCHAR(200), 
	file_path TEXT, 
	binding VARCHAR(500), 
	is_hidden INTEGER, 
	is_del INTEGER, 
	creator VARCHAR(64), 
	updator VARCHAR(64), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

DROP TABLE IF EXISTS "zhs_refund";

CREATE TABLE public.zhs_refund (
	id BIGSERIAL NOT NULL, 
	refund_id VARCHAR(32) NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	order_no VARCHAR(64) NOT NULL, 
	reason VARCHAR(500) NOT NULL, 
	amount BIGINT, 
	description VARCHAR(500), 
	status VARCHAR(20), 
	retry_count INTEGER, 
	evidence TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (refund_id)
)

;
CREATE INDEX ix_zhs_refund_user_id ON public.zhs_refund (user_id);
CREATE INDEX ix_zhs_refund_status ON public.zhs_refund (status);
CREATE INDEX ix_zhs_refund_order_no ON public.zhs_refund (order_no);

DROP TABLE IF EXISTS "zhs_refund_timeline";

CREATE TABLE public.zhs_refund_timeline (
	id BIGSERIAL NOT NULL, 
	refund_id VARCHAR(32) NOT NULL, 
	action VARCHAR(50) NOT NULL, 
	operator VARCHAR(64), 
	note VARCHAR(500), 
	status_from VARCHAR(20), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_refund_timeline_refund_id ON public.zhs_refund_timeline (refund_id);

DROP TABLE IF EXISTS "zhs_withdrawal_flow";

CREATE TABLE public.zhs_withdrawal_flow (
	id BIGSERIAL NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	amount BIGINT NOT NULL, 
	status INTEGER, 
	partner_trade_no VARCHAR(64), 
	payment_no VARCHAR(64), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_withdrawal_flow_user_id ON public.zhs_withdrawal_flow (user_id);
CREATE INDEX ix_zhs_withdrawal_flow_status ON public.zhs_withdrawal_flow (status);

DROP TABLE IF EXISTS "question";

CREATE TABLE question (
	id BIGSERIAL NOT NULL, 
	title VARCHAR(500) NOT NULL, 
	note TEXT, 
	type INTEGER NOT NULL, 
	reference_answer TEXT, 
	reference_answer_note TEXT, 
	status INTEGER, 
	difficulty INTEGER, 
	score FLOAT, 
	options TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_q_type ON question (type);
CREATE INDEX idx_q_difficulty ON question (difficulty);
CREATE INDEX idx_q_status ON question (status);

DROP TABLE IF EXISTS "question_and_category_relation";

CREATE TABLE question_and_category_relation (
	id BIGSERIAL NOT NULL, 
	question_id BIGINT NOT NULL, 
	category_id BIGINT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_qacr_category ON question_and_category_relation (category_id);
CREATE INDEX idx_qacr_question ON question_and_category_relation (question_id);

DROP TABLE IF EXISTS "question_category";

CREATE TABLE question_category (
	id BIGSERIAL NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	sort_order INTEGER, 
	is_show BOOLEAN, 
	is_show_index BOOLEAN, 
	image VARCHAR(500), 
	level INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_qc_level ON question_category (level);
CREATE INDEX idx_qc_show ON question_category (is_show);

DROP TABLE IF EXISTS "question_category_relation";

CREATE TABLE question_category_relation (
	id BIGSERIAL NOT NULL, 
	child_category_id BIGINT NOT NULL, 
	father_category_id BIGINT NOT NULL, 
	direct_father_category_id BIGINT, 
	is_sub INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_qcr_child ON question_category_relation (child_category_id);
CREATE INDEX idx_qcr_father ON question_category_relation (father_category_id);

DROP TABLE IF EXISTS "resource";

CREATE TABLE resource (
	id BIGSERIAL NOT NULL, 
	resource_name VARCHAR(200), 
	resource_type VARCHAR(50), 
	resource_url VARCHAR(500), 
	status INTEGER, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_resource_status ON resource (status);

DROP TABLE IF EXISTS "search_hot_keyword";

CREATE TABLE search_hot_keyword (
	id BIGSERIAL NOT NULL, 
	keyword VARCHAR(100) NOT NULL, 
	search_count INTEGER, 
	status INTEGER, 
	sort_order INTEGER, 
	is_hot BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_shk_status ON search_hot_keyword (status);

DROP TABLE IF EXISTS "search_index";

CREATE TABLE search_index (
	id BIGSERIAL NOT NULL, 
	target_type VARCHAR(50) NOT NULL, 
	target_id BIGINT NOT NULL, 
	title VARCHAR(500) NOT NULL, 
	content TEXT, 
	keywords VARCHAR(500), 
	category VARCHAR(100), 
	tags VARCHAR(500), 
	cover VARCHAR(500), 
	url VARCHAR(500), 
	user_id VARCHAR(64), 
	user_name VARCHAR(100), 
	weight INTEGER, 
	view_num INTEGER, 
	like_num INTEGER, 
	comment_num INTEGER, 
	status INTEGER, 
	is_top BOOLEAN, 
	is_essence BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_si_status ON search_index (status);
CREATE INDEX idx_si_target ON search_index (target_type, target_id);
CREATE INDEX ix_search_index_user_id ON search_index (user_id);
CREATE INDEX idx_si_category ON search_index (category);

DROP TABLE IF EXISTS "search_log";

CREATE TABLE search_log (
	id BIGSERIAL NOT NULL, 
	user_id VARCHAR(64), 
	keyword VARCHAR(200) NOT NULL, 
	target_type VARCHAR(50), 
	result_count INTEGER, 
	ip VARCHAR(50), 
	user_agent VARCHAR(500), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_sl_user ON search_log (user_id);
CREATE INDEX idx_sl_keyword ON search_log (keyword);

DROP TABLE IF EXISTS "t_category";

CREATE TABLE t_category (
	id BIGSERIAL NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	sort_order INTEGER, 
	is_show INTEGER, 
	is_show_index INTEGER, 
	image VARCHAR(500), 
	level INTEGER, 
	create_user_id BIGINT, 
	company_id BIGINT, 
	department_id BIGINT, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_cat_show ON t_category (is_show);

DROP TABLE IF EXISTS "t_category_relation";

CREATE TABLE t_category_relation (
	id BIGSERIAL NOT NULL, 
	child_category_id BIGINT NOT NULL, 
	father_category_id BIGINT NOT NULL, 
	direct_father_category_id BIGINT, 
	is_sub INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_catrel_child ON t_category_relation (child_category_id);

DROP TABLE IF EXISTS "t_certificate";

CREATE TABLE t_certificate (
	id BIGSERIAL NOT NULL, 
	certificate_id BIGINT, 
	code VARCHAR(100), 
	name VARCHAR(200), 
	description TEXT, 
	awarding_organization VARCHAR(200), 
	awarder_name VARCHAR(100), 
	awarder_position VARCHAR(100), 
	design VARCHAR(500), 
	award_conditions TEXT, 
	validity_policy TEXT, 
	award_date TIMESTAMP WITHOUT TIME ZONE, 
	validity VARCHAR(100), 
	status INTEGER, 
	member_id BIGINT, 
	lesson_id BIGINT, 
	lesson_sign_id BIGINT, 
	lesson_sign_time TIMESTAMP WITHOUT TIME ZONE, 
	lesson_complete_time TIMESTAMP WITHOUT TIME ZONE, 
	score INTEGER, 
	company_id BIGINT, 
	create_user_id BIGINT, 
	create_user_name VARCHAR(100), 
	update_user_id BIGINT, 
	update_user_name VARCHAR(100), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_cert_lesson ON t_certificate (lesson_id);
CREATE INDEX idx_cert_member ON t_certificate (member_id);
CREATE INDEX idx_cert_status ON t_certificate (status);

DROP TABLE IF EXISTS "t_certificate_serial_number";

CREATE TABLE t_certificate_serial_number (
	id BIGSERIAL NOT NULL, 
	year INTEGER NOT NULL, 
	month INTEGER NOT NULL, 
	day INTEGER NOT NULL, 
	current_serial INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_csn_date ON t_certificate_serial_number (year, month, day);

DROP TABLE IF EXISTS "t_certificate_template";

CREATE TABLE t_certificate_template (
	id BIGSERIAL NOT NULL, 
	name VARCHAR(200) NOT NULL, 
	description TEXT, 
	awarding_organization VARCHAR(200), 
	awarder_name VARCHAR(100), 
	awarder_position VARCHAR(100), 
	design VARCHAR(500), 
	award_conditions TEXT, 
	validity_policy TEXT, 
	status INTEGER, 
	company_id BIGINT, 
	create_user_id BIGINT, 
	create_user_name VARCHAR(100), 
	update_user_id BIGINT, 
	update_user_name VARCHAR(100), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_ct_status ON t_certificate_template (status);

DROP TABLE IF EXISTS "t_channel_lecturer";

CREATE TABLE t_channel_lecturer (
	id BIGSERIAL NOT NULL, 
	lecturer_id BIGINT NOT NULL, 
	channel_id BIGINT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_cl_channel ON t_channel_lecturer (channel_id);
CREATE INDEX idx_cl_lecturer ON t_channel_lecturer (lecturer_id);

DROP TABLE IF EXISTS "t_exam_paper_record";

CREATE TABLE t_exam_paper_record (
	id BIGSERIAL NOT NULL, 
	exam_id BIGINT NOT NULL, 
	exam_chapter_section_id BIGINT, 
	sign_up_id BIGINT, 
	member_id BIGINT NOT NULL, 
	paper TEXT, 
	answer TEXT, 
	reference_answer TEXT, 
	start_time TIMESTAMP WITHOUT TIME ZONE, 
	end_time TIMESTAMP WITHOUT TIME ZONE, 
	score INTEGER, 
	status INTEGER, 
	lesson_id BIGINT, 
	serial_num VARCHAR(100), 
	exam_title VARCHAR(200), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_epr_member ON t_exam_paper_record (member_id);
CREATE INDEX idx_epr_exam ON t_exam_paper_record (exam_id);
CREATE INDEX idx_epr_status ON t_exam_paper_record (status);

DROP TABLE IF EXISTS "t_homework_record";

CREATE TABLE t_homework_record (
	id BIGSERIAL NOT NULL, 
	lesson_id BIGINT NOT NULL, 
	member_id BIGINT NOT NULL, 
	url VARCHAR(500), 
	sign_up_id BIGINT, 
	status INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_hr_lesson ON t_homework_record (lesson_id);
CREATE INDEX idx_hr_member ON t_homework_record (member_id);
CREATE INDEX idx_hr_status ON t_homework_record (status);

DROP TABLE IF EXISTS "t_learn_map";

CREATE TABLE t_learn_map (
	id BIGSERIAL NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	description TEXT, 
	image VARCHAR(500), 
	status INTEGER, 
	create_user_id BIGINT, 
	company_id BIGINT, 
	department_id BIGINT, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_lm_status ON t_learn_map (status);

DROP TABLE IF EXISTS "t_learn_map_topic";

CREATE TABLE t_learn_map_topic (
	id BIGSERIAL NOT NULL, 
	learn_map_id BIGINT NOT NULL, 
	topic_id BIGINT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_lmt_map ON t_learn_map_topic (learn_map_id);
CREATE INDEX idx_lmt_topic ON t_learn_map_topic (topic_id);

DROP TABLE IF EXISTS "t_lesson";

CREATE TABLE t_lesson (
	id BIGSERIAL NOT NULL, 
	name VARCHAR(200) NOT NULL, 
	code VARCHAR(100), 
	start_time TIMESTAMP WITHOUT TIME ZONE, 
	end_time TIMESTAMP WITHOUT TIME ZONE, 
	image VARCHAR(500), 
	status INTEGER, 
	phrase TEXT, 
	introduction TEXT, 
	price INTEGER, 
	original_price INTEGER, 
	create_user_id BIGINT, 
	company_id BIGINT, 
	department_id BIGINT, 
	certificate_id BIGINT, 
	exam_paper_id BIGINT, 
	sort_weight INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_lesson_creator ON t_lesson (create_user_id);
CREATE INDEX idx_lesson_status ON t_lesson (status);

DROP TABLE IF EXISTS "t_lesson_category_relation";

CREATE TABLE t_lesson_category_relation (
	id BIGSERIAL NOT NULL, 
	lesson_id BIGINT NOT NULL, 
	category_id BIGINT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_lcr_lesson ON t_lesson_category_relation (lesson_id);
CREATE INDEX idx_lcr_category ON t_lesson_category_relation (category_id);

DROP TABLE IF EXISTS "t_lesson_chapter";

CREATE TABLE t_lesson_chapter (
	id BIGSERIAL NOT NULL, 
	lesson_id BIGINT NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	phrase TEXT, 
	sort_order INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_lchapter_lesson ON t_lesson_chapter (lesson_id);

DROP TABLE IF EXISTS "t_lesson_chapter_section";

CREATE TABLE t_lesson_chapter_section (
	id BIGSERIAL NOT NULL, 
	lesson_chapter_id BIGINT NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	type VARCHAR(50), 
	url VARCHAR(500), 
	phrase TEXT, 
	total_time INTEGER, 
	sort_order INTEGER, 
	content TEXT, 
	content_type VARCHAR(50), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_lsection_chapter ON t_lesson_chapter_section (lesson_chapter_id);

DROP TABLE IF EXISTS "t_rate";

CREATE TABLE t_rate (
	id BIGSERIAL NOT NULL, 
	lesson_id BIGINT NOT NULL, 
	sign_id BIGINT, 
	member_id BIGINT NOT NULL, 
	content_utility_score INTEGER, 
	content_depth_score INTEGER, 
	instructor_expertise_score INTEGER, 
	teaching_method_score INTEGER, 
	innovate_score INTEGER, 
	overall_satisfaction_score INTEGER, 
	additional_comments TEXT, 
	company_id BIGINT, 
	create_user_id BIGINT, 
	create_user_name VARCHAR(100), 
	update_user_id BIGINT, 
	update_user_name VARCHAR(100), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_rate_lesson ON t_rate (lesson_id);
CREATE INDEX idx_rate_member ON t_rate (member_id);

DROP TABLE IF EXISTS "t_record";

CREATE TABLE t_record (
	id BIGSERIAL NOT NULL, 
	lesson_id BIGINT NOT NULL, 
	lesson_chapter_section_id BIGINT NOT NULL, 
	member_id BIGINT NOT NULL, 
	learn_time INTEGER, 
	sign_up_id BIGINT, 
	max_progress_time INTEGER, 
	status INTEGER, 
	progress INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_record_member ON t_record (member_id);
CREATE INDEX idx_record_signup ON t_record (sign_up_id);
CREATE INDEX idx_record_lesson ON t_record (lesson_id);

DROP TABLE IF EXISTS "t_record_log";

CREATE TABLE t_record_log (
	id BIGSERIAL NOT NULL, 
	lesson_id BIGINT NOT NULL, 
	lesson_chapter_section_id BIGINT NOT NULL, 
	member_id BIGINT NOT NULL, 
	learn_time INTEGER, 
	sign_up_id BIGINT, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_rlog_member ON t_record_log (member_id);

DROP TABLE IF EXISTS "t_sign_up";

CREATE TABLE t_sign_up (
	id BIGSERIAL NOT NULL, 
	lesson_id BIGINT NOT NULL, 
	member_id BIGINT NOT NULL, 
	company_id BIGINT, 
	status INTEGER, 
	completed_time TIMESTAMP WITHOUT TIME ZONE, 
	progress INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_signup_member ON t_sign_up (member_id);
CREATE INDEX idx_signup_status ON t_sign_up (status);
CREATE INDEX idx_signup_lesson ON t_sign_up (lesson_id);

DROP TABLE IF EXISTS "t_tencent_cloud_live_stream";

CREATE TABLE t_tencent_cloud_live_stream (
	id BIGSERIAL NOT NULL, 
	channel_id BIGINT NOT NULL, 
	stream_name VARCHAR(200) NOT NULL, 
	app_name VARCHAR(200) NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_tcls_channel ON t_tencent_cloud_live_stream (channel_id);

DROP TABLE IF EXISTS "t_topic";

CREATE TABLE t_topic (
	id BIGSERIAL NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	description TEXT, 
	image VARCHAR(500), 
	status INTEGER, 
	price INTEGER, 
	original_price INTEGER, 
	create_user_id BIGINT, 
	company_id BIGINT, 
	department_id BIGINT, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_topic_status ON t_topic (status);

DROP TABLE IF EXISTS "t_topic_category";

CREATE TABLE t_topic_category (
	id BIGSERIAL NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	sort_order INTEGER, 
	is_show INTEGER, 
	is_show_index INTEGER, 
	image VARCHAR(500), 
	level INTEGER, 
	create_user_id BIGINT, 
	company_id BIGINT, 
	department_id BIGINT, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_tc_show ON t_topic_category (is_show);

DROP TABLE IF EXISTS "t_topic_category_relation";

CREATE TABLE t_topic_category_relation (
	id BIGSERIAL NOT NULL, 
	child_category_id BIGINT NOT NULL, 
	father_category_id BIGINT NOT NULL, 
	direct_father_category_id BIGINT, 
	is_sub INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_tcr_child ON t_topic_category_relation (child_category_id);

DROP TABLE IF EXISTS "t_topic_lesson";

CREATE TABLE t_topic_lesson (
	id BIGSERIAL NOT NULL, 
	lesson_id BIGINT NOT NULL, 
	topic_id BIGINT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_tl_lesson ON t_topic_lesson (lesson_id);
CREATE INDEX idx_tl_topic ON t_topic_lesson (topic_id);

DROP TABLE IF EXISTS "t_topic_topic_category_relation";

CREATE TABLE t_topic_topic_category_relation (
	id BIGSERIAL NOT NULL, 
	topic_id BIGINT NOT NULL, 
	category_id BIGINT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_ttcr_topic ON t_topic_topic_category_relation (topic_id);

DROP TABLE IF EXISTS "tbox_bean";

CREATE TABLE tbox_bean (
	id BIGSERIAL NOT NULL, 
	bean_type VARCHAR(50), 
	bean_data TEXT, 
	status INTEGER, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_tbox_bean_status ON tbox_bean (status);

DROP TABLE IF EXISTS "transfer_infos";

CREATE TABLE transfer_infos (
	id BIGSERIAL NOT NULL, 
	transfer_no VARCHAR(64), 
	from_user VARCHAR(64), 
	to_user VARCHAR(64), 
	amount INTEGER, 
	status INTEGER, 
	remark VARCHAR(255), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE UNIQUE INDEX ix_transfer_infos_transfer_no ON transfer_infos (transfer_no);

DROP TABLE IF EXISTS "user_agent_free_times";

CREATE TABLE user_agent_free_times (
	id BIGSERIAL NOT NULL, 
	user_uuid VARCHAR(64) NOT NULL, 
	agent_id VARCHAR(64) NOT NULL, 
	free_times INTEGER, 
	used_times INTEGER, 
	last_reset_at TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_user_agent_free_times_agent_id ON user_agent_free_times (agent_id);
CREATE INDEX ix_user_agent_free_times_user_uuid ON user_agent_free_times (user_uuid);

-- ===== Database: zhs_center_project =====
DROP TABLE IF EXISTS "user_auth_info";

CREATE TABLE user_auth_info (
	user_uuid VARCHAR(64) NOT NULL, 
	phone VARCHAR(20), 
	cancel_phone VARCHAR(20), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (user_uuid)
)

;

DROP TABLE IF EXISTS "user_sk_info";

CREATE TABLE user_sk_info (
	id SERIAL NOT NULL, 
	user_uuid VARCHAR(255), 
	key VARCHAR(255), 
	status INTEGER, 
	type INTEGER, 
	max BIGINT, 
	out_time TIMESTAMP WITHOUT TIME ZONE, 
	created_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	updated_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_user_sk_info_status ON user_sk_info (status);
CREATE INDEX ix_user_sk_info_user_uuid ON user_sk_info (user_uuid);
CREATE INDEX ix_user_sk_info_id ON user_sk_info (id);

DROP TABLE IF EXISTS "user_third_party_accounts";

CREATE TABLE user_third_party_accounts (
	id SERIAL NOT NULL, 
	user_uuid VARCHAR(64) NOT NULL, 
	open_id VARCHAR(100), 
	union_id VARCHAR(100), 
	platform VARCHAR(20), 
	access_token TEXT, 
	refresh_token TEXT, 
	expire_time TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	deleted_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

-- ===== Database: zhs_ai_project =====
DROP TABLE IF EXISTS "user_vip";

CREATE TABLE user_vip (
	id SERIAL NOT NULL, 
	user_uuid VARCHAR(64) NOT NULL, 
	vip_level_id INTEGER NOT NULL, 
	level_value INTEGER, 
	start_time TIMESTAMP WITHOUT TIME ZONE, 
	end_time TIMESTAMP WITHOUT TIME ZONE, 
	status INTEGER, 
	order_id VARCHAR(64), 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_user_vip_status ON user_vip (status);
CREATE INDEX ix_user_vip_user_uuid ON user_vip (user_uuid);

DROP TABLE IF EXISTS "vip_level";

CREATE TABLE vip_level (
	id SERIAL NOT NULL, 
	level_name VARCHAR(50) NOT NULL, 
	level_value INTEGER, 
	price BIGINT, 
	duration_days INTEGER, 
	benefits TEXT, 
	status INTEGER, 
	sort_order INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_vip_level_status ON vip_level (status);

DROP TABLE IF EXISTS "visit_log";

CREATE TABLE visit_log (
	id BIGSERIAL NOT NULL, 
	user_id VARCHAR(64), 
	user_name VARCHAR(100), 
	session_id VARCHAR(64), 
	path VARCHAR(500) NOT NULL, 
	method VARCHAR(10), 
	query_params TEXT, 
	referer VARCHAR(500), 
	user_agent VARCHAR(500), 
	ip VARCHAR(50), 
	device VARCHAR(50), 
	os VARCHAR(50), 
	browser VARCHAR(50), 
	target_type VARCHAR(50), 
	target_id VARCHAR(64), 
	duration INTEGER, 
	source VARCHAR(50), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_vl_user ON visit_log (user_id);
CREATE INDEX idx_vl_time ON visit_log (created_at);
CREATE INDEX idx_vl_path ON visit_log (path);
CREATE INDEX idx_vl_target ON visit_log (target_type, target_id);

DROP TABLE IF EXISTS "visit_page";

CREATE TABLE visit_page (
	id BIGSERIAL NOT NULL, 
	stat_date VARCHAR(20) NOT NULL, 
	path VARCHAR(500) NOT NULL, 
	visit_count INTEGER, 
	uv INTEGER, 
	avg_duration INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_vp_date ON visit_page (stat_date);

DROP TABLE IF EXISTS "visit_source";

CREATE TABLE visit_source (
	id BIGSERIAL NOT NULL, 
	stat_date VARCHAR(20) NOT NULL, 
	source VARCHAR(50) NOT NULL, 
	visit_count INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_vs2_date ON visit_source (stat_date);

DROP TABLE IF EXISTS "visit_stats";

CREATE TABLE visit_stats (
	id BIGSERIAL NOT NULL, 
	stat_date VARCHAR(20) NOT NULL, 
	stat_type VARCHAR(20) NOT NULL, 
	target_type VARCHAR(50), 
	target_id VARCHAR(64), 
	pv INTEGER, 
	uv INTEGER, 
	ip_count INTEGER, 
	new_user INTEGER, 
	avg_duration INTEGER, 
	bounce_rate FLOAT, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_vs_date ON visit_stats (stat_date);
CREATE INDEX idx_vs_target ON visit_stats (target_type, target_id);

DROP TABLE IF EXISTS "wx_pay_notifications";

CREATE TABLE wx_pay_notifications (
	id BIGSERIAL NOT NULL, 
	out_trade_no VARCHAR(64), 
	transaction_id VARCHAR(64), 
	openid VARCHAR(128), 
	trade_type VARCHAR(32), 
	bank_type VARCHAR(32), 
	total_fee INTEGER, 
	cash_fee INTEGER, 
	refund_no VARCHAR(64), 
	notification_type VARCHAR(32), 
	result_code VARCHAR(16), 
	raw_xml TEXT, 
	status INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_wx_pay_notifications_out_trade_no ON wx_pay_notifications (out_trade_no);
CREATE INDEX ix_wx_pay_notifications_transaction_id ON wx_pay_notifications (transaction_id);

DROP TABLE IF EXISTS "zhs_activity";

CREATE TABLE zhs_activity (
	id VARCHAR(255) NOT NULL, 
	activity_name VARCHAR(255), 
	activity_rule TEXT, 
	activity_recharge TEXT, 
	multiple INTEGER, 
	computing BIGINT, 
	begin_time TIMESTAMP WITHOUT TIME ZONE, 
	end_time TIMESTAMP WITHOUT TIME ZONE, 
	status SMALLINT, 
	begin_amount INTEGER, 
	creator VARCHAR(255), 
	updator VARCHAR(255), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_activity_status ON zhs_activity (status);

DROP TABLE IF EXISTS "zhs_agent_category";

CREATE TABLE zhs_agent_category (
	id BIGSERIAL NOT NULL, 
	agent_id VARCHAR(64), 
	"group" INTEGER, 
	type VARCHAR(10), 
	type_child VARCHAR(10), 
	limit_free VARCHAR(10), 
	account INTEGER, 
	create_time TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

DROP TABLE IF EXISTS "zhs_agent_developer";

CREATE TABLE zhs_agent_developer (
	id BIGSERIAL NOT NULL, 
	agent_id VARCHAR(64) NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	order_no VARCHAR(64), 
	status INTEGER, 
	price FLOAT, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_agent_developer_status ON zhs_agent_developer (status);
CREATE INDEX ix_zhs_agent_developer_user_id ON zhs_agent_developer (user_id);

DROP TABLE IF EXISTS "zhs_agent_examine";

CREATE TABLE zhs_agent_examine (
	id BIGSERIAL NOT NULL, 
	agent_id VARCHAR(64) NOT NULL, 
	agent_name VARCHAR(200), 
	category_id VARCHAR(64), 
	status BIGINT, 
	start_time TIMESTAMP WITHOUT TIME ZONE, 
	start_user VARCHAR(64), 
	start_phone VARCHAR(32), 
	start_name VARCHAR(100), 
	examine_user VARCHAR(64), 
	examine_user_id VARCHAR(64), 
	examine_time TIMESTAMP WITHOUT TIME ZONE, 
	"desc" TEXT, 
	follow TEXT, 
	agent_avatar VARCHAR(500), 
	prologue TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_agent_examine_status ON zhs_agent_examine (status);

DROP TABLE IF EXISTS "zhs_agent_need_task";

CREATE TABLE zhs_agent_need_task (
	id BIGSERIAL NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	agent_id VARCHAR(64), 
	task_name VARCHAR(128) NOT NULL, 
	task_desc TEXT, 
	reward_tokens INTEGER, 
	status INTEGER, 
	accept_user_id VARCHAR(64), 
	deadline TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_need_task_user ON zhs_agent_need_task (user_id);
CREATE INDEX ix_zhs_agent_need_task_status ON zhs_agent_need_task (status);
CREATE INDEX idx_need_task_agent ON zhs_agent_need_task (agent_id);

DROP TABLE IF EXISTS "zhs_agent_rule";

CREATE TABLE zhs_agent_rule (
	id BIGSERIAL NOT NULL, 
	agent_id VARCHAR(64) NOT NULL, 
	rule_name VARCHAR(128) NOT NULL, 
	rule_code TEXT NOT NULL, 
	rule_type VARCHAR(32), 
	priority INTEGER, 
	status INTEGER, 
	description VARCHAR(255), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_agent_rule_status ON zhs_agent_rule (status);
CREATE INDEX idx_rule_agent_id ON zhs_agent_rule (agent_id);

DROP TABLE IF EXISTS "zhs_agent_withdrawal_detail";

CREATE TABLE zhs_agent_withdrawal_detail (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36), 
	amount BIGINT, 
	type INTEGER, 
	initiate_at BIGINT, 
	status INTEGER, 
	reviewer VARCHAR(36), 
	reviewer_time BIGINT, 
	payment_time BIGINT, 
	out_bill_no VARCHAR(255), 
	user_name VARCHAR(50), 
	open_id VARCHAR(255), 
	order_ids TEXT, 
	wechat_msg TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_w_bill ON zhs_agent_withdrawal_detail (out_bill_no);
CREATE INDEX idx_w_user ON zhs_agent_withdrawal_detail (user_id);
CREATE INDEX ix_zhs_agent_withdrawal_detail_status ON zhs_agent_withdrawal_detail (status);

DROP TABLE IF EXISTS "zhs_ai_model_info";

CREATE TABLE zhs_ai_model_info (
	id BIGSERIAL NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	source VARCHAR(100), 
	icon VARCHAR(500), 
	description TEXT, 
	status INTEGER, 
	sort INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (name)
)

;
CREATE INDEX ix_zhs_ai_model_info_status ON zhs_ai_model_info (status);

DROP TABLE IF EXISTS "zhs_banner_carousel";

CREATE TABLE zhs_banner_carousel (
	id BIGSERIAL NOT NULL, 
	title VARCHAR(200), 
	image_url VARCHAR(500), 
	link_url VARCHAR(500), 
	position VARCHAR(50), 
	status INTEGER, 
	sort INTEGER, 
	is_active INTEGER, 
	sort_order INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_banner_carousel_status ON zhs_banner_carousel (status);

-- ===== Database: zhs_educational_training =====
DROP TABLE IF EXISTS "zhs_category_dictionary";

CREATE TABLE zhs_category_dictionary (
	id BIGSERIAL NOT NULL, 
	name VARCHAR(100), 
	code VARCHAR(50), 
	parent_id BIGINT, 
	type VARCHAR(50), 
	status INTEGER, 
	sort INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_category_dictionary_parent_id ON zhs_category_dictionary (parent_id);
CREATE INDEX ix_zhs_category_dictionary_status ON zhs_category_dictionary (status);

DROP TABLE IF EXISTS "zhs_course_audit";

CREATE TABLE zhs_course_audit (
	id BIGSERIAL NOT NULL, 
	course_id BIGINT NOT NULL, 
	audit_status INTEGER, 
	auditor VARCHAR(64), 
	audit_time TIMESTAMP WITHOUT TIME ZONE, 
	remark TEXT, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

DROP TABLE IF EXISTS "zhs_course_pay";

CREATE TABLE zhs_course_pay (
	id BIGSERIAL NOT NULL, 
	course_id BIGINT NOT NULL, 
	user_uuid VARCHAR(64) NOT NULL, 
	order_no VARCHAR(64), 
	amount BIGINT, 
	status INTEGER, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_course_pay_status ON zhs_course_pay (status);

DROP TABLE IF EXISTS "zhs_course_pay_log";

CREATE TABLE zhs_course_pay_log (
	id BIGSERIAL NOT NULL, 
	pay_id BIGINT NOT NULL, 
	action VARCHAR(32) NOT NULL, 
	detail TEXT, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

DROP TABLE IF EXISTS "zhs_course_platform_log";

CREATE TABLE zhs_course_platform_log (
	id BIGSERIAL NOT NULL, 
	course_id BIGINT NOT NULL, 
	platform_id BIGINT NOT NULL, 
	action VARCHAR(32) NOT NULL, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

DROP TABLE IF EXISTS "zhs_course_temp";

CREATE TABLE zhs_course_temp (
	id BIGSERIAL NOT NULL, 
	course_name VARCHAR(200), 
	status INTEGER, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_course_temp_status ON zhs_course_temp (status);

DROP TABLE IF EXISTS "zhs_course_video";

CREATE TABLE zhs_course_video (
	id BIGSERIAL NOT NULL, 
	course_id BIGINT NOT NULL, 
	binding VARCHAR(500), 
	video_path VARCHAR(500) NOT NULL, 
	title VARCHAR(200), 
	subtitle TEXT, 
	content TEXT, 
	remark TEXT, 
	duration INTEGER, 
	adjunct_url VARCHAR(500), 
	is_pay INTEGER, 
	amount FLOAT, 
	status INTEGER, 
	sort INTEGER, 
	creator VARCHAR(100), 
	lecturer VARCHAR(100), 
	label VARCHAR(100), 
	audit_status INTEGER, 
	stage VARCHAR(50), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_course_video_status ON zhs_course_video (status);

DROP TABLE IF EXISTS "zhs_course_video_temp";

CREATE TABLE zhs_course_video_temp (
	id BIGSERIAL NOT NULL, 
	video_name VARCHAR(200), 
	status INTEGER, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_course_video_temp_status ON zhs_course_video_temp (status);

-- ===== Database: zhs_ai_project =====
DROP TABLE IF EXISTS "zhs_crew_message";

CREATE TABLE zhs_crew_message (
	id BIGSERIAL NOT NULL, 
	session_id VARCHAR(36) NOT NULL, 
	task_id VARCHAR(36), 
	from_role VARCHAR(50) NOT NULL, 
	to_role VARCHAR(50), 
	content TEXT NOT NULL, 
	message_type VARCHAR(20), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_crew_message_session_id ON zhs_crew_message (session_id);

DROP TABLE IF EXISTS "zhs_crew_session";

CREATE TABLE zhs_crew_session (
	id UUID NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	title VARCHAR(255), 
	status VARCHAR(20) NOT NULL, 
	input_message TEXT, 
	output_message TEXT, 
	shared_memory TEXT, 
	config TEXT, 
	total_tokens INTEGER, 
	total_cost FLOAT, 
	completed_at TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_crew_session_user_id ON zhs_crew_session (user_id);
CREATE INDEX ix_crew_session_status ON zhs_crew_session (status);

DROP TABLE IF EXISTS "zhs_crew_task";

CREATE TABLE zhs_crew_task (
	id UUID NOT NULL, 
	session_id UUID NOT NULL, 
	task_index INTEGER NOT NULL, 
	agent_role VARCHAR(50) NOT NULL, 
	description TEXT NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	input_data TEXT, 
	output_data TEXT, 
	dependencies TEXT, 
	retry_count INTEGER, 
	max_retries INTEGER, 
	tokens_used INTEGER, 
	error_message TEXT, 
	started_at TIMESTAMP WITHOUT TIME ZONE, 
	completed_at TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_crew_task_session_id ON zhs_crew_task (session_id);
CREATE INDEX ix_crew_task_status ON zhs_crew_task (status);

DROP TABLE IF EXISTS "zhs_developer_link";

CREATE TABLE zhs_developer_link (
	id BIGSERIAL NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	coze_account_id VARCHAR(64), 
	coze_account_name VARCHAR(200), 
	status INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_developer_link_status ON zhs_developer_link (status);
CREATE INDEX ix_zhs_developer_link_user_id ON zhs_developer_link (user_id);

-- ===== Database: zhs_educational_training =====
DROP TABLE IF EXISTS "zhs_education_platform";

CREATE TABLE zhs_education_platform (
	id BIGSERIAL NOT NULL, 
	code VARCHAR(50) NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	domain VARCHAR(200), 
	remark TEXT, 
	binding VARCHAR(500), 
	file_path VARCHAR(500), 
	type INTEGER, 
	status INTEGER, 
	sort INTEGER, 
	is_hidden INTEGER, 
	is_del INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (code)
)

;
CREATE INDEX ix_zhs_education_platform_status ON zhs_education_platform (status);

DROP TABLE IF EXISTS "zhs_educational_course";

CREATE TABLE zhs_educational_course (
	id BIGSERIAL NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	subtitle TEXT, 
	cover VARCHAR(500), 
	content TEXT, 
	price FLOAT, 
	category VARCHAR(100), 
	stage VARCHAR(50), 
	status INTEGER, 
	is_hidden INTEGER, 
	is_del INTEGER, 
	sort INTEGER, 
	creator VARCHAR(64), 
	label VARCHAR(100), 
	audit_status INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_educational_course_status ON zhs_educational_course (status);

-- ===== Database: zhs_ai_project =====
DROP TABLE IF EXISTS "zhs_exchange_rate";

CREATE TABLE zhs_exchange_rate (
	id BIGSERIAL NOT NULL, 
	from_currency VARCHAR(20) NOT NULL, 
	to_currency VARCHAR(20) NOT NULL, 
	rate FLOAT NOT NULL, 
	status INTEGER, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_exchange_rate_status ON zhs_exchange_rate (status);

DROP TABLE IF EXISTS "zhs_identity_proportion";

CREATE TABLE zhs_identity_proportion (
	id VARCHAR(64) NOT NULL, 
	begin_time TIMESTAMP WITHOUT TIME ZONE, 
	end_time TIMESTAMP WITHOUT TIME ZONE, 
	status INTEGER, 
	gift BIGINT, 
	token_proportion INTEGER, 
	vip_gift BIGINT, 
	routine_proportion INTEGER, 
	vip_proportion INTEGER, 
	trader_proportion INTEGER, 
	trader_gift BIGINT, 
	trader_routine_proportion INTEGER, 
	trader_vip_proportion INTEGER, 
	trader_trader_proportion INTEGER, 
	grand_routine_proportion INTEGER, 
	grand_vip_proportion INTEGER, 
	grand_trader_proportion INTEGER, 
	creator VARCHAR(64), 
	created_time TIMESTAMP WITHOUT TIME ZONE, 
	updator VARCHAR(64), 
	updated_time TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_identity_proportion_status ON zhs_identity_proportion (status);

DROP TABLE IF EXISTS "zhs_information";

CREATE TABLE zhs_information (
	id BIGSERIAL NOT NULL, 
	title VARCHAR(300), 
	content TEXT, 
	type INTEGER, 
	status INTEGER, 
	sort INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_information_status ON zhs_information (status);

DROP TABLE IF EXISTS "zhs_knowledge_chunk";

CREATE TABLE zhs_knowledge_chunk (
	id BIGSERIAL NOT NULL, 
	doc_id INTEGER NOT NULL, 
	collection_name VARCHAR(100) NOT NULL, 
	owner_uuid VARCHAR(64) NOT NULL, 
	chunk_index INTEGER NOT NULL, 
	content TEXT NOT NULL, 
	embedding TEXT, 
	score FLOAT, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_knowledge_chunk_collection ON zhs_knowledge_chunk (collection_name);
CREATE INDEX ix_knowledge_chunk_doc_id ON zhs_knowledge_chunk (doc_id);

DROP TABLE IF EXISTS "zhs_knowledge_doc";

CREATE TABLE zhs_knowledge_doc (
	id BIGSERIAL NOT NULL, 
	owner_uuid VARCHAR(64) NOT NULL, 
	collection_name VARCHAR(100) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	source_type VARCHAR(20) NOT NULL, 
	source_path VARCHAR(500), 
	content_hash VARCHAR(64), 
	chunk_count INTEGER, 
	status VARCHAR(20) NOT NULL, 
	metadata_json TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_knowledge_doc_owner ON zhs_knowledge_doc (owner_uuid);
CREATE INDEX ix_knowledge_doc_collection ON zhs_knowledge_doc (collection_name);

DROP TABLE IF EXISTS "zhs_knowledge_planet";

CREATE TABLE zhs_knowledge_planet (
	id BIGSERIAL NOT NULL, 
	name VARCHAR(200), 
	description TEXT, 
	cover VARCHAR(500), 
	price BIGINT, 
	type VARCHAR(50), 
	status INTEGER, 
	sort INTEGER, 
	creator VARCHAR(64), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_knowledge_planet_status ON zhs_knowledge_planet (status);

DROP TABLE IF EXISTS "zhs_official_information";

CREATE TABLE zhs_official_information (
	id BIGSERIAL NOT NULL, 
	title VARCHAR(300), 
	content TEXT, 
	type VARCHAR(50), 
	status INTEGER, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_official_information_status ON zhs_official_information (status);

DROP TABLE IF EXISTS "zhs_operate_token_flow";

CREATE TABLE zhs_operate_token_flow (
	id BIGSERIAL NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	token_quantity BIGINT, 
	type INTEGER, 
	operate_desc VARCHAR(255), 
	token_free BIGINT, 
	user_uuid VARCHAR(64), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_operate_token_flow_user_id ON zhs_operate_token_flow (user_id);

-- ===== Database: zhs_educational_training =====
DROP TABLE IF EXISTS "zhs_organization";

CREATE TABLE zhs_organization (
	id BIGSERIAL NOT NULL, 
	org_name VARCHAR(200) NOT NULL, 
	org_type VARCHAR(50), 
	parent_id BIGINT, 
	status INTEGER, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_organization_status ON zhs_organization (status);
CREATE INDEX ix_zhs_organization_parent_id ON zhs_organization (parent_id);

-- ===== Database: zhs_ai_project =====
DROP TABLE IF EXISTS "zhs_popular_courses";

CREATE TABLE zhs_popular_courses (
	id BIGSERIAL NOT NULL, 
	course_id BIGINT NOT NULL, 
	sort_order INTEGER, 
	status INTEGER, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_popular_courses_status ON zhs_popular_courses (status);

DROP TABLE IF EXISTS "zhs_product";

CREATE TABLE zhs_product (
	id VARCHAR(64) NOT NULL, 
	name VARCHAR(200), 
	price BIGINT, 
	token_amount BIGINT, 
	type VARCHAR(50), 
	status INTEGER, 
	sort INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_product_status ON zhs_product (status);

DROP TABLE IF EXISTS "zhs_product_identity";

CREATE TABLE zhs_product_identity (
	id VARCHAR(64) NOT NULL, 
	name VARCHAR(200), 
	description TEXT, 
	price BIGINT, 
	token_amount BIGINT, 
	identity_type VARCHAR(50), 
	duration_days INTEGER, 
	status INTEGER, 
	sort INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_product_identity_status ON zhs_product_identity (status);

DROP TABLE IF EXISTS "zhs_resources";

CREATE TABLE zhs_resources (
	id BIGSERIAL NOT NULL, 
	resource_name VARCHAR(200), 
	resource_type VARCHAR(50), 
	resource_url VARCHAR(500), 
	status INTEGER, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_resources_status ON zhs_resources (status);

DROP TABLE IF EXISTS "zhs_station_letter";

CREATE TABLE zhs_station_letter (
	id BIGSERIAL NOT NULL, 
	user_uuid VARCHAR(64) NOT NULL, 
	receiver_uuid VARCHAR(64), 
	type INTEGER, 
	content TEXT NOT NULL, 
	chat_id VARCHAR(64) NOT NULL, 
	send_time TIMESTAMP WITHOUT TIME ZONE, 
	is_del INTEGER, 
	is_read INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_zsl_sendtime ON zhs_station_letter (send_time);
CREATE INDEX idx_zsl_receiver ON zhs_station_letter (receiver_uuid);
CREATE INDEX idx_zsl_read ON zhs_station_letter (is_read, is_del);
CREATE INDEX idx_zsl_chat ON zhs_station_letter (chat_id);

DROP TABLE IF EXISTS "zhs_station_room";

CREATE TABLE zhs_station_room (
	id BIGSERIAL NOT NULL, 
	room_name VARCHAR(200) NOT NULL, 
	type INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_zsr_type ON zhs_station_room (type);

DROP TABLE IF EXISTS "zhs_station_user";

CREATE TABLE zhs_station_user (
	id BIGSERIAL NOT NULL, 
	user_uuid VARCHAR(64) NOT NULL, 
	room_id BIGINT NOT NULL, 
	is_leave INTEGER, 
	is_del INTEGER, 
	leave_at TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_zsu_status ON zhs_station_user (is_leave, is_del);
CREATE INDEX idx_zsu_user ON zhs_station_user (user_uuid);
CREATE INDEX idx_zsu_room ON zhs_station_user (room_id);

DROP TABLE IF EXISTS "zhs_user_agent_audio";

CREATE TABLE zhs_user_agent_audio (
	id BIGSERIAL NOT NULL, 
	user_uuid VARCHAR(64) NOT NULL, 
	agent_id VARCHAR(64) NOT NULL, 
	audio_url VARCHAR(500), 
	duration INTEGER, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_user_agent_audio_user_uuid ON zhs_user_agent_audio (user_uuid);
CREATE INDEX ix_zhs_user_agent_audio_agent_id ON zhs_user_agent_audio (agent_id);

DROP TABLE IF EXISTS "zhs_user_agent_context";

CREATE TABLE zhs_user_agent_context (
	id BIGSERIAL NOT NULL, 
	user_uuid VARCHAR(64) NOT NULL, 
	user_id VARCHAR(64), 
	agent_id VARCHAR(64) NOT NULL, 
	session_id VARCHAR(64), 
	role VARCHAR(20), 
	content TEXT, 
	content_type VARCHAR(20), 
	tokens INTEGER, 
	context_key VARCHAR(200), 
	context_value TEXT, 
	field_name VARCHAR(200), 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	update_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_user_agent_context_user_uuid ON zhs_user_agent_context (user_uuid);
CREATE INDEX ix_zhs_user_agent_context_agent_id ON zhs_user_agent_context (agent_id);
CREATE INDEX ix_zhs_user_agent_context_user_id ON zhs_user_agent_context (user_id);

DROP TABLE IF EXISTS "zhs_user_agent_free_time";

CREATE TABLE zhs_user_agent_free_time (
	id BIGSERIAL NOT NULL, 
	user_uuid VARCHAR(64) NOT NULL, 
	agent_id VARCHAR(64), 
	free_count INTEGER, 
	used_count INTEGER, 
	expire_time TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

DROP TABLE IF EXISTS "zhs_user_agent_image";

CREATE TABLE zhs_user_agent_image (
	id BIGSERIAL NOT NULL, 
	user_uuid VARCHAR(64) NOT NULL, 
	user_id VARCHAR(64), 
	user_name VARCHAR(100), 
	agent_id VARCHAR(64), 
	agent_name VARCHAR(200), 
	image_url VARCHAR(500) NOT NULL, 
	image_type VARCHAR(20), 
	prompt TEXT, 
	model VARCHAR(50), 
	task_id VARCHAR(100), 
	status INTEGER, 
	cost INTEGER, 
	width INTEGER, 
	height INTEGER, 
	size INTEGER, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_user_agent_image_user_uuid ON zhs_user_agent_image (user_uuid);
CREATE INDEX ix_zhs_user_agent_image_agent_id ON zhs_user_agent_image (agent_id);
CREATE INDEX ix_zhs_user_agent_image_user_id ON zhs_user_agent_image (user_id);

-- ===== Database: zhs_educational_training =====
DROP TABLE IF EXISTS "zhs_user_comment_log";

CREATE TABLE zhs_user_comment_log (
	id BIGSERIAL NOT NULL, 
	user_uuid VARCHAR(64) NOT NULL, 
	comment_id BIGINT NOT NULL, 
	action VARCHAR(32) NOT NULL, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

-- ===== Database: zhs_ai_project =====
DROP TABLE IF EXISTS "zhs_user_model_chat";

CREATE TABLE zhs_user_model_chat (
	id BIGSERIAL NOT NULL, 
	user_uuid VARCHAR(64) NOT NULL, 
	model_name VARCHAR(100) NOT NULL, 
	mark VARCHAR(500), 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_user_model_chat_user_uuid ON zhs_user_model_chat (user_uuid);

-- ===== Database: zhs_educational_training =====
DROP TABLE IF EXISTS "zhs_user_platform";

CREATE TABLE zhs_user_platform (
	id BIGSERIAL NOT NULL, 
	user_uuid VARCHAR(64) NOT NULL, 
	platform_id BIGINT NOT NULL, 
	status INTEGER, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_user_platform_status ON zhs_user_platform (status);

DROP TABLE IF EXISTS "zhs_user_video_comment";

CREATE TABLE zhs_user_video_comment (
	id BIGSERIAL NOT NULL, 
	video_id BIGINT NOT NULL, 
	user_uuid VARCHAR(64) NOT NULL, 
	content TEXT, 
	parent_id BIGINT, 
	status INTEGER, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_zhs_user_video_comment_status ON zhs_user_video_comment (status);
CREATE INDEX ix_zhs_user_video_comment_parent_id ON zhs_user_video_comment (parent_id);

DROP TABLE IF EXISTS "zhs_user_video_log";

CREATE TABLE zhs_user_video_log (
	id BIGSERIAL NOT NULL, 
	video_id BIGINT NOT NULL, 
	user_uuid VARCHAR(64) NOT NULL, 
	action VARCHAR(32) NOT NULL, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

