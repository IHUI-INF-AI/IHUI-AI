-- liquibase formatted sql

-- changeset bill:2020070701
create table t_category
(
    id            bigint auto_increment comment '主键id',
    name          nvarchar(50)        not null comment '类目名称',
    sort_order    int       default 1 not null comment '排列序号，表示同级类目的展现次序，如数值相等则按名称次序排列。取值范围:大于零的整数',
    is_show       tinyint   default 1 not null comment '是否显示',
    is_show_index tinyint   default 1 not null comment '是否在首页显示',
    level         int                 not null comment '目录等级',
    image         varchar(500)        not null comment '分类图片',
    create_time   timestamp default current_timestamp comment '创建时间',
    update_time   timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    constraint t_category_pk primary key (id)
) comment '课程类目';

-- changeset bill:2020070702
create table t_category_relation
(
    id                        bigint auto_increment comment '主键id',
    child_category_id         bigint  not null comment '子类目id',
    father_category_id        bigint  not null comment '父类目id',
    direct_father_category_id bigint  not null comment '直属父类目id',
    is_sub                    tinyint not null comment '是否属于子类目',
    create_time               timestamp default current_timestamp comment '创建时间',
    update_time               timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    constraint t_category_relation_pk primary key (id)
) comment '类目关系';

-- changeset bill:2020070703
create table t_lesson
(
    id           bigint auto_increment comment '主键id',
    name         nvarchar(100)  not null comment '频道名称（最大长度64个字符，只支持中文、字母、数字和下划线）',
    code         varchar(100)   not null comment '编号',
    start_time   timestamp      not null comment '开始时间',
    end_time     timestamp      not null comment '结束时间',
    image        varchar(1000)  not null comment '封面图片（海报）',
    is_show      tinyint        not null default 1 comment '是否可见',
    status       varchar(50)    not null comment '状态',
    phrase       nvarchar(255)  not null default '' comment '短语介绍',
    introduction nvarchar(3000) not null default '' comment '详情',
    create_time  timestamp      not null default current_timestamp comment '创建时间',
    update_time  timestamp      not null default current_timestamp on update current_timestamp comment '最后修改时间',
    constraint t_channel_pk primary key (id)
) comment '课程表';

-- changeset bill:2020070707
create table t_lesson_chapter
(
    id          bigint auto_increment comment '主键id',
    lesson_id   bigint comment '课程id',
    title       nvarchar(100) not null comment '章标题',
    phrase      nvarchar(255) not null default '' comment '介绍',
    create_time timestamp     not null default current_timestamp comment '创建时间',
    update_time timestamp     not null default current_timestamp on update current_timestamp comment '最后修改时间',
    constraint t_channel_pk primary key (id)
) comment '课程章表';

-- changeset bill:2020070706
create table t_lesson_chapter_section
(
    id                bigint auto_increment comment '主键id',
    lesson_chapter_id bigint comment '课程章id',
    title             nvarchar(100) not null comment '章节标题',
    url               varchar(1000) not null comment '内容地址',
    phrase            nvarchar(255) not null default '' comment '介绍',
    create_time       timestamp     not null default current_timestamp comment '创建时间',
    update_time       timestamp     not null default current_timestamp on update current_timestamp comment '最后修改时间',
    constraint t_channel_pk primary key (id)
) comment '课程章节表';

-- changeset bill:2020070705
create table t_lesson_category_relation
(
    id          bigint auto_increment comment '主键id',
    category_id bigint not null comment '目录id',
    lesson_id   bigint not null comment '频道id',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    constraint t_channel_category_relation_pk primary key (id)
) comment '频道类目关系';

-- changeset bill:202012121
create table t_sign_up
(
    id          bigint auto_increment comment '主键id',
    member_id   bigint      not null comment '会员id',
    lesson_id   bigint      not null comment '频道id',
    status      varchar(50) not null comment '状态',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '报名';

-- changeset bill:202012122
create table t_record
(
    id                        bigint auto_increment comment '主键id',
    member_id                 bigint not null comment '会员id',
    lesson_id                 bigint not null comment '频道id',
    lesson_chapter_section_id bigint not null comment '章节id',
    sign_up_id                bigint not null comment '报名id',
    learn_time                bigint not null comment '学习时长',
    create_time               timestamp default current_timestamp comment '创建时间',
    update_time               timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '学习记录';

-- changeset bill:20210305
alter table t_lesson
    drop column is_show;

-- changeset bill:202104121
create table t_topic_category
(
    id            bigint auto_increment comment '主键id',
    name          nvarchar(50)        not null comment '类目名称',
    sort_order    int       default 1 not null comment '排列序号，表示同级类目的展现次序，如数值相等则按名称次序排列。取值范围:大于零的整数',
    is_show       tinyint   default 1 not null comment '是否显示',
    is_show_index tinyint   default 1 not null comment '是否在首页显示',
    level         int                 not null comment '目录等级',
    image         varchar(500)        not null comment '分类图片',
    create_time   timestamp default current_timestamp comment '创建时间',
    update_time   timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '专题分类';

-- changeset bill:202104122
create table t_topic_category_relation
(
    id                        bigint auto_increment comment '主键id',
    child_category_id         bigint  not null comment '子类目id',
    father_category_id        bigint  not null comment '父类目id',
    direct_father_category_id bigint  not null comment '直属父类目id',
    is_sub                    tinyint not null comment '是否属于子类目',
    create_time               timestamp default current_timestamp comment '创建时间',
    update_time               timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '专题分类关系';

-- changeset bill:202104123
create table t_topic
(
    id          bigint auto_increment comment '主键id',
    title       nvarchar(100)  not null comment '标题',
    image       varchar(1000)  not null comment '封面图片（海报）',
    status      varchar(50)    not null comment '状态',
    description nvarchar(3000) not null default '' comment '详情',
    create_time timestamp      not null default current_timestamp comment '创建时间',
    update_time timestamp      not null default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '专题';

-- changeset bill:202104124
create table t_topic_topic_category_relation
(
    id          bigint auto_increment comment '主键id',
    category_id bigint not null comment '目录id',
    topic_id    bigint not null comment '专题id',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '专题与分类关系';

-- changeset bill:202104125
create table t_topic_lesson
(
    id          bigint auto_increment comment '主键id',
    lesson_id   bigint not null comment '课程id',
    topic_id    bigint not null comment '专题id',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '专题与课程关系';

-- changeset bill:202104126
create table t_learn_map
(
    id          bigint auto_increment comment '主键id',
    title       nvarchar(100)  not null comment '标题',
    image       varchar(1000)  not null comment '封面图片（海报）',
    status      varchar(50)    not null comment '状态',
    description nvarchar(3000) not null default '' comment '详情',
    create_time timestamp               default current_timestamp comment '创建时间',
    update_time timestamp               default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '学习地图';

-- changeset bill:202104127
create table t_learn_map_topic
(
    id           bigint auto_increment comment '主键id',
    learn_map_id bigint not null comment '学习地图id',
    topic_id     bigint not null comment '专题id',
    create_time  timestamp default current_timestamp comment '创建时间',
    update_time  timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '学习地图与专题的关系';

-- changeset bill:202104283
alter table t_record
    add max_progress_time bigint not null comment '最大的学习进度时间';
alter table t_record
    add status varchar(200) default 'progressing' not null comment '状态';

-- changeset bill:202104284
alter table t_lesson_chapter_section
    add total_time bigint not null comment '内容总时长';

-- changeset bill:202104286
alter table t_sign_up
    add completed_time timestamp comment '完成时间';

-- changeset bill:202105081
create table t_record_log
(
    id                        bigint auto_increment comment '主键id',
    member_id                 bigint not null comment '会员id',
    lesson_id                 bigint not null comment '课程id',
    lesson_chapter_section_id bigint not null comment '章节id',
    sign_up_id                bigint not null comment '报名id',
    learn_time                bigint not null comment '学习时长',
    create_time               timestamp default current_timestamp comment '创建时间',
    update_time               timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '学习记录日志';

-- changeset bill:202109121
alter table t_lesson
    add company_id bigint comment '公司id';

-- changeset bill:202109122
alter table t_lesson
    add department_id bigint comment '部门id';

-- changeset bill:202109123
alter table t_lesson
    add create_user_id bigint comment '创建用户id';

-- changeset bill:202109124
alter table t_lesson
    add price decimal(14, 2) default 0 comment '价格';

-- changeset bill:202109125
alter table t_lesson
    add original_price decimal(14, 2) default 0 comment '原价';

-- changeset bill:202109126
alter table t_category
    add company_id bigint not null comment '公司id';
alter table t_category
    add department_id bigint not null comment '部门id';
alter table t_category
    add create_user_id bigint not null comment '创建用户id';

-- changeset bill:202109127
alter table t_lesson_chapter
    add sort_order int not null default 0 comment '排序';
alter table t_lesson_chapter_section
    add sort_order int not null default 0 comment '排序';
alter table t_lesson_chapter_section
    add type varchar(20) not null comment '内容类型（上传、链接）';

-- changeset bill:202109128
create table t_homework
(
    id          bigint auto_increment comment '主键id',
    lesson_id   bigint        not null comment '课程id',
    url         varchar(3000) not null default '' comment '附件地址',
    content     text          not null comment '作业内容',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '作业';

-- changeset bill:202109129
create table t_homework_record
(
    id          bigint auto_increment comment '主键id',
    member_id   bigint        not null comment '会员id',
    lesson_id   bigint        not null comment '课程id',
    url         varchar(3000) not null comment '作业提交内容的地址',
    status      varchar(200)  not null comment '状态',
    sign_up_id  bigint        not null comment '报名id',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '作业提交内容记录';

-- changeset bill:202109131
alter table t_topic_category
    add company_id bigint not null default 0 comment '公司id';
alter table t_topic_category
    add department_id bigint not null default 0 comment '部门id';
alter table t_topic_category
    add create_user_id bigint not null default 0 comment '创建用户id';

-- changeset bill:202109132
alter table t_topic
    add company_id bigint comment '公司id';
alter table t_topic
    add department_id bigint comment '部门id';
alter table t_topic
    add create_user_id bigint comment '创建用户id';
alter table t_topic
    add price decimal(14, 2) default 0 comment '价格';
alter table t_topic
    add original_price decimal(14, 2) default 0 comment '原价';

-- changeset bill:202109133
alter table t_learn_map
    add company_id bigint comment '公司id';
alter table t_learn_map
    add department_id bigint comment '部门id';
alter table t_learn_map
    add create_user_id bigint comment '创建用户id';

-- changeset bill:202502031
alter table t_lesson
    add exam_paper_id bigint comment '试卷ID';
