-- =============================================================
-- zhs-platform 首版 schema - 共 150 张表
-- 适用 PostgreSQL
-- =============================================================

-- ===== Database: zhs_ai_project =====
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
CREATE INDEX idx_ask_answer_question ON ask_answer (question_id);
CREATE INDEX idx_ask_answer_member ON ask_answer (member_id);

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
CREATE INDEX idx_ask_question_member ON ask_question (member_id);
CREATE INDEX idx_ask_question_status ON ask_question (status);

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
CREATE INDEX idx_aqc_category ON ask_question_category (category_id);
CREATE INDEX idx_aqc_question ON ask_question_category (question_id);

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
CREATE INDEX idx_bs_target ON behavior_share (target_type, target_id);
CREATE INDEX idx_bs_user ON behavior_share (user_id);

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
CREATE INDEX idx_cp_status ON circle_post (status);
CREATE INDEX idx_cp_user ON circle_post (user_id);
CREATE INDEX idx_cp_circle ON circle_post (circle_id);

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
CREATE INDEX idx_cpl_post ON circle_post_like (post_id);
CREATE INDEX idx_cpl_user ON circle_post_like (user_id);

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

DROP TABLE IF EXISTS "exam_paper";

CREATE TABLE exam_paper (
	id BIGSERIAL NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	description TEXT, 
	category_id BIGINT, 
	course_id BIGINT, 
	cover VARCHAR(500), 
	total_score FLOAT, 
	pass_score FLOAT, 
	duration INTEGER, 
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
	content TEXT NOT NULL, 
	options TEXT, 
	answer TEXT NOT NULL, 
	analysis TEXT, 
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
	paper_id BIGINT NOT NULL, 
	paper_title VARCHAR(200), 
	user_id VARCHAR(64) NOT NULL, 
	user_name VARCHAR(100), 
	score FLOAT, 
	total_score FLOAT, 
	pass_score FLOAT, 
	is_pass BOOLEAN, 
	status INTEGER, 
	start_time TIMESTAMP WITHOUT TIME ZONE, 
	submit_time TIMESTAMP WITHOUT TIME ZONE, 
	cost_time INTEGER, 
	correct_num INTEGER, 
	wrong_num INTEGER, 
	answer_data TEXT, 
	remark VARCHAR(500), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX idx_er_user ON exam_record (user_id);
CREATE INDEX idx_er_paper ON exam_record (paper_id);

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
CREATE INDEX idx_lc_status ON live_channel (status);
CREATE INDEX idx_lc_start ON live_channel (start_time);

DROP TABLE IF EXISTS "live_channel_category";

CREATE TABLE live_channel_category (
	id BIGSERIAL NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	sort_order INTEGER, 
	is_show BOOLEAN, 
	icon VARCHAR(500), 
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
CREATE INDEX idx_ls_channel ON live_subscribe (channel_id);
CREATE INDEX idx_ls_user ON live_subscribe (user_id);

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
CREATE INDEX idx_notif_user ON notification (user_id);
CREATE INDEX idx_notif_status ON notification (status);
CREATE INDEX idx_notif_type ON notification (type);

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
CREATE INDEX idx_nl_time ON notification_log (send_time);
CREATE INDEX idx_nl_notif ON notification_log (notification_id);

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
CREATE INDEX idx_pe_status ON point_exchange (status);
CREATE INDEX idx_pe_user ON point_exchange (user_id);

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
CREATE INDEX idx_pl_action ON point_log (action);
CREATE INDEX idx_pl_time ON point_log (created_at);

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

DROP TABLE IF EXISTS "sys_user";

CREATE TABLE public.sys_user (
	user_id BIGSERIAL NOT NULL, 
	user_uuid VARCHAR(36), 
	dept_id BIGINT, 
	user_name VARCHAR(64) NOT NULL, 
	nick_name VARCHAR(32) NOT NULL, 
	user_type VARCHAR(2), 
	email VARCHAR(64), 
	phone VARCHAR(11), 
	sex VARCHAR(1), 
	avatar VARCHAR(128), 
	password VARCHAR(128), 
	status VARCHAR(1), 
	del_flag VARCHAR(1), 
	login_ip VARCHAR(128), 
	login_date TIMESTAMP WITHOUT TIME ZONE, 
	create_by VARCHAR(64), 
	create_time TIMESTAMP WITHOUT TIME ZONE, 
	update_by VARCHAR(64), 
	update_time TIMESTAMP WITHOUT TIME ZONE, 
	remark VARCHAR(500), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (user_id), 
	UNIQUE (user_uuid), 
	UNIQUE (user_name)
)

;
CREATE INDEX idx_sys_user_status ON public.sys_user (status, del_flag);
CREATE INDEX idx_sys_user_phone ON public.sys_user (phone);
CREATE INDEX idx_sys_user_uuid ON public.sys_user (user_uuid);
CREATE INDEX idx_sys_user_dept ON public.sys_user (dept_id);

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
CREATE INDEX ix_public_video_generation_tasks_id ON public.video_generation_tasks (id);
CREATE INDEX ix_public_video_generation_tasks_user_uuid ON public.video_generation_tasks (user_uuid);
CREATE UNIQUE INDEX ix_public_video_generation_tasks_task_id ON public.video_generation_tasks (task_id);

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
CREATE INDEX idx_s_status ON public.zhs_agent_settlement (settlement);
CREATE INDEX idx_s_order ON public.zhs_agent_settlement (order_no);

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

-- ===== Database: zhs_ai_project =====
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
CREATE INDEX idx_si_category ON search_index (category);
CREATE INDEX idx_si_status ON search_index (status);
CREATE INDEX idx_si_target ON search_index (target_type, target_id);

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

DROP TABLE IF EXISTS "sys_config";

CREATE TABLE sys_config (
	config_id BIGSERIAL NOT NULL, 
	config_name VARCHAR(100), 
	config_key VARCHAR(100), 
	config_value VARCHAR(500), 
	config_type VARCHAR(1), 
	create_time TIMESTAMP WITHOUT TIME ZONE, 
	remark VARCHAR(500), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (config_id), 
	UNIQUE (config_key)
)

;

DROP TABLE IF EXISTS "sys_dept";

CREATE TABLE sys_dept (
	dept_id BIGSERIAL NOT NULL, 
	parent_id BIGINT, 
	ancestors VARCHAR(50), 
	dept_name VARCHAR(30) NOT NULL, 
	order_num INTEGER, 
	leader VARCHAR(20), 
	phone VARCHAR(11), 
	email VARCHAR(50), 
	status VARCHAR(1), 
	del_flag VARCHAR(1), 
	create_time TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (dept_id)
)

;

DROP TABLE IF EXISTS "sys_dict_data";

CREATE TABLE sys_dict_data (
	dict_code BIGSERIAL NOT NULL, 
	dict_sort INTEGER, 
	dict_label VARCHAR(100), 
	dict_value VARCHAR(100), 
	dict_type VARCHAR(100), 
	css_class VARCHAR(100), 
	list_class VARCHAR(100), 
	is_default VARCHAR(1), 
	status VARCHAR(1), 
	create_time TIMESTAMP WITHOUT TIME ZONE, 
	remark VARCHAR(500), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (dict_code)
)

;

DROP TABLE IF EXISTS "sys_dict_type";

CREATE TABLE sys_dict_type (
	dict_id BIGSERIAL NOT NULL, 
	dict_name VARCHAR(100), 
	dict_type VARCHAR(100), 
	status VARCHAR(1), 
	create_time TIMESTAMP WITHOUT TIME ZONE, 
	remark VARCHAR(500), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (dict_id), 
	UNIQUE (dict_type)
)

;

DROP TABLE IF EXISTS "sys_job";

CREATE TABLE sys_job (
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
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (job_id)
)

;

DROP TABLE IF EXISTS "sys_job_log";

CREATE TABLE sys_job_log (
	job_log_id BIGSERIAL NOT NULL, 
	job_name VARCHAR(64) NOT NULL, 
	job_group VARCHAR(64), 
	invoke_target VARCHAR(500) NOT NULL, 
	status VARCHAR(1), 
	error_message VARCHAR(2000), 
	exception_info VARCHAR(2000), 
	start_time TIMESTAMP WITHOUT TIME ZONE, 
	stop_time TIMESTAMP WITHOUT TIME ZONE, 
	create_time TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (job_log_id)
)

;

DROP TABLE IF EXISTS "sys_logininfor";

CREATE TABLE sys_logininfor (
	info_id BIGSERIAL NOT NULL, 
	user_name VARCHAR(50), 
	ipaddr VARCHAR(128), 
	browser VARCHAR(50), 
	os VARCHAR(50), 
	status VARCHAR(1), 
	msg VARCHAR(255), 
	login_time TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (info_id)
)

;

DROP TABLE IF EXISTS "sys_menu";

CREATE TABLE sys_menu (
	menu_id BIGSERIAL NOT NULL, 
	menu_name VARCHAR(64) NOT NULL, 
	parent_id BIGINT, 
	order_num INTEGER, 
	path VARCHAR(200), 
	component VARCHAR(255), 
	perms VARCHAR(100), 
	menu_type VARCHAR(1), 
	visible VARCHAR(1), 
	status VARCHAR(1), 
	icon VARCHAR(128), 
	create_time TIMESTAMP WITHOUT TIME ZONE, 
	update_time TIMESTAMP WITHOUT TIME ZONE, 
	remark VARCHAR(500), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (menu_id)
)

;

DROP TABLE IF EXISTS "sys_notice";

CREATE TABLE sys_notice (
	notice_id BIGSERIAL NOT NULL, 
	notice_title VARCHAR(50) NOT NULL, 
	notice_type VARCHAR(1) NOT NULL, 
	notice_content TEXT, 
	status VARCHAR(1), 
	create_by VARCHAR(64), 
	create_time TIMESTAMP WITHOUT TIME ZONE, 
	remark VARCHAR(255), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (notice_id)
)

;

DROP TABLE IF EXISTS "sys_oper_log";

CREATE TABLE sys_oper_log (
	oper_id BIGSERIAL NOT NULL, 
	title VARCHAR(50), 
	business_type INTEGER, 
	method VARCHAR(100), 
	request_method VARCHAR(10), 
	oper_name VARCHAR(50), 
	oper_url VARCHAR(255), 
	oper_ip VARCHAR(128), 
	oper_param TEXT, 
	json_result TEXT, 
	status INTEGER, 
	error_msg VARCHAR(2000), 
	oper_time TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (oper_id)
)

;

DROP TABLE IF EXISTS "sys_post";

CREATE TABLE sys_post (
	post_id BIGSERIAL NOT NULL, 
	post_code VARCHAR(64) NOT NULL, 
	post_name VARCHAR(50) NOT NULL, 
	post_sort INTEGER NOT NULL, 
	status VARCHAR(1), 
	create_time TIMESTAMP WITHOUT TIME ZONE, 
	remark VARCHAR(500), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (post_id)
)

;

DROP TABLE IF EXISTS "sys_role";

CREATE TABLE sys_role (
	role_id BIGSERIAL NOT NULL, 
	role_name VARCHAR(32) NOT NULL, 
	role_key VARCHAR(100) NOT NULL, 
	role_sort INTEGER NOT NULL, 
	data_scope VARCHAR(1), 
	status VARCHAR(1), 
	del_flag VARCHAR(1), 
	create_time TIMESTAMP WITHOUT TIME ZONE, 
	update_time TIMESTAMP WITHOUT TIME ZONE, 
	remark VARCHAR(500), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (role_id)
)

;
CREATE INDEX idx_sys_role_key ON sys_role (role_key);
CREATE INDEX idx_sys_role_status ON sys_role (status, del_flag);

DROP TABLE IF EXISTS "sys_role_dept";

CREATE TABLE sys_role_dept (
	role_id BIGINT NOT NULL, 
	dept_id BIGINT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (role_id, dept_id)
)

;

DROP TABLE IF EXISTS "sys_role_menu";

CREATE TABLE sys_role_menu (
	role_id BIGINT NOT NULL, 
	menu_id BIGINT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (role_id, menu_id)
)

;

-- ===== Database: zhs_center_project =====
DROP TABLE IF EXISTS "sys_user_post";

CREATE TABLE sys_user_post (
	user_id BIGINT NOT NULL, 
	post_id BIGINT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (user_id, post_id)
)

;

-- ===== Database: zhs_ai_project =====
DROP TABLE IF EXISTS "sys_user_role";

CREATE TABLE sys_user_role (
	user_id BIGINT NOT NULL, 
	role_id BIGINT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (user_id, role_id)
)

;

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
CREATE INDEX idx_vl_path ON visit_log (path);
CREATE INDEX idx_vl_time ON visit_log (created_at);
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
CREATE INDEX idx_vs_target ON visit_stats (target_type, target_id);
CREATE INDEX idx_vs_date ON visit_stats (stat_date);

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

-- ===== Database: zhs_ai_project =====
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

DROP TABLE IF EXISTS "zhs_dictionary";

CREATE TABLE zhs_dictionary (
	id BIGSERIAL NOT NULL, 
	dict_type VARCHAR(100) NOT NULL, 
	dict_code VARCHAR(100) NOT NULL, 
	dict_label VARCHAR(200), 
	dict_value VARCHAR(500), 
	sort INTEGER, 
	status INTEGER, 
	create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;

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
CREATE INDEX ix_zhs_user_agent_context_agent_id ON zhs_user_agent_context (agent_id);
CREATE INDEX ix_zhs_user_agent_context_user_uuid ON zhs_user_agent_context (user_uuid);
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
CREATE INDEX ix_zhs_user_agent_image_agent_id ON zhs_user_agent_image (agent_id);
CREATE INDEX ix_zhs_user_agent_image_user_uuid ON zhs_user_agent_image (user_uuid);
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

