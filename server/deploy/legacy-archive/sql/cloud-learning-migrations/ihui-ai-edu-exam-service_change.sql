-- liquibase formatted sql

-- changeset bill:202007071
create table t_question_category
(
    id            bigint auto_increment primary key comment '主键id',
    name          nvarchar(50)        not null comment '分类名称',
    sort_order    int       default 1 not null comment '排列序号，表示同级分类的展现次序，如数值相等则按名称次序排列。取值范围:大于零的整数',
    is_show       tinyint   default 1 not null comment '是否显示',
    is_show_index tinyint   default 1 not null comment '是否在首页显示',
    level         int                 not null comment '目录等级',
    image         varchar(500)        not null comment '分类图片',
    create_time   timestamp default current_timestamp comment '创建时间',
    update_time   timestamp default current_timestamp on update current_timestamp comment '最后修改时间'
) comment '题目分类';

-- changeset bill:202007072
create table t_question_category_relation
(
    id                        bigint auto_increment primary key comment '主键id',
    child_category_id         bigint  not null comment '子分类id',
    father_category_id        bigint  not null comment '父分类id',
    direct_father_category_id bigint  not null comment '直属父分类id',
    is_sub                    tinyint not null comment '是否属于子分类',
    create_time               timestamp default current_timestamp comment '创建时间',
    update_time               timestamp default current_timestamp on update current_timestamp comment '最后修改时间'
) comment '题目分类与题目分类关系';

-- changeset bill:202007073
create table t_question
(
    id                    bigint auto_increment primary key comment '主键id',
    title                 nvarchar(2000)           not null comment '题目',
    note                  text                     not null comment '题目描述',
    type                  varchar(100)             not null comment '类型',
    difficulty            int            default 1 not null comment '难度',
    score                 decimal(14, 2) default 1 not null comment '分数',
    reference_answer      text                     not null comment '参考答案',
    reference_answer_note text                     not null comment '答案解析',
    options               text                     not null comment '选项',
    status                varchar(50)              not null comment '状态',
    create_time           timestamp      default current_timestamp comment '创建时间',
    update_time           timestamp      default current_timestamp on update current_timestamp comment '最后修改时间'
) comment '题目';

-- changeset bill:202007074
create table t_question_and_category_relation
(
    id          bigint auto_increment primary key comment '主键id',
    category_id bigint not null comment '目录id',
    question_id bigint not null comment '题目id',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间'
) comment '题目与题目分类关系';

-- changeset bill:202007075
create table t_paper_category
(
    id            bigint auto_increment primary key comment '主键id',
    name          nvarchar(50)        not null comment '分类名称',
    sort_order    int       default 1 not null comment '排列序号，表示同级分类的展现次序，如数值相等则按名称次序排列。取值范围:大于零的整数',
    is_show       tinyint   default 1 not null comment '是否显示',
    is_show_index tinyint   default 1 not null comment '是否在首页显示',
    level         int                 not null comment '目录等级',
    image         varchar(500)        not null comment '分类图片',
    create_time   timestamp default current_timestamp comment '创建时间',
    update_time   timestamp default current_timestamp on update current_timestamp comment '最后修改时间'
) comment '试卷分类';

-- changeset bill:202007076
create table t_paper_category_relation
(
    id                        bigint auto_increment primary key comment '主键id',
    child_category_id         bigint  not null comment '子分类id',
    father_category_id        bigint  not null comment '父分类id',
    direct_father_category_id bigint  not null comment '直属父分类id',
    is_sub                    tinyint not null comment '是否属于子分类',
    create_time               timestamp default current_timestamp comment '创建时间',
    update_time               timestamp default current_timestamp on update current_timestamp comment '最后修改时间'
) comment '试卷分类与试卷分类关系';

-- changeset bill:202007077
create table t_paper
(
    id                  bigint auto_increment primary key comment '主键id',
    title               nvarchar(2000) not null comment '名称',
    code                varchar(100)   not null default '' comment '编号',
    description         nvarchar(3000) not null default '' comment '详情',
    type                varchar(100)   not null comment '类型',
    score               double         not null comment '试卷总分',
    limit_time          bigint         not null comment '考试时长',
    pass_score          double         not null comment '合格分数',
    question_disordered tinyint        not null default 0 comment '题序打乱',
    option_disordered   tinyint        not null default 0 comment '选项打乱',
    difficulty          int            not null default 0 comment '难度',
    status              varchar(50)    not null comment '状态',
    create_time         timestamp               default current_timestamp comment '创建时间',
    update_time         timestamp               default current_timestamp on update current_timestamp comment '最后修改时间'
) comment '试卷';

-- changeset bill:202007079
create table t_paper_paper_category_relation
(
    id          bigint auto_increment primary key comment '主键id',
    category_id bigint not null comment '目录id',
    paper_id    bigint not null comment '试卷id',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间'
) comment '试卷与试卷分类关系';


-- changeset bill:2020070710
create table t_paper_question
(
    id          bigint auto_increment primary key comment '主键id',
    question_id bigint              not null comment '题目id',
    paper_id    bigint              not null comment '试卷id',
    sort_order  int       default 1 not null comment '排列序号，表示同级分类的展现次序，如数值相等则按名称次序排列。取值范围:大于零的整数',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间'
) comment '试卷题目';

-- changeset bill:202007078
create table t_paper_question_rule
(
    id          bigint auto_increment primary key comment '主键id',
    paper_id    bigint not null comment '试卷id',
    rule_json   json   not null comment '抽题规则',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间'
) comment '试卷题目抽题规则';

-- changeset bill:2020070711
create table t_category
(
    id            bigint auto_increment primary key comment '主键id',
    name          nvarchar(50)        not null comment '分类名称',
    sort_order    int       default 1 not null comment '排列序号，表示同级分类的展现次序，如数值相等则按名称次序排列。取值范围:大于零的整数',
    is_show       tinyint   default 1 not null comment '是否显示',
    is_show_index tinyint   default 1 not null comment '是否在首页显示',
    level         int                 not null comment '目录等级',
    image         varchar(500)        not null comment '分类图片',
    create_time   timestamp default current_timestamp comment '创建时间',
    update_time   timestamp default current_timestamp on update current_timestamp comment '最后修改时间'
) comment '考试分类';

-- changeset bill:2020070712
create table t_category_relation
(
    id                        bigint auto_increment primary key comment '主键id',
    child_category_id         bigint  not null comment '子分类id',
    father_category_id        bigint  not null comment '父分类id',
    direct_father_category_id bigint  not null comment '直属父分类id',
    is_sub                    tinyint not null comment '是否属于子分类',
    create_time               timestamp default current_timestamp comment '创建时间',
    update_time               timestamp default current_timestamp on update current_timestamp comment '最后修改时间'
) comment '分类关系';

-- changeset bill:2020070713
create table t_exam
(
    id           bigint auto_increment primary key comment '主键id',
    name         nvarchar(100)  not null comment '名称',
    code         varchar(100)   not null comment '编号',
    start_time   timestamp      not null comment '开始时间',
    end_time     timestamp      not null comment '结束时间',
    image        varchar(1000)  not null comment '封面图片（海报）',
    status       varchar(50)    not null comment '状态',
    phrase       nvarchar(255)  not null default '' comment '短语介绍',
    introduction nvarchar(3000) not null default '' comment '详情',
    create_time  timestamp      not null default current_timestamp comment '创建时间',
    update_time  timestamp      not null default current_timestamp on update current_timestamp comment '最后修改时间'
) comment '考试';

-- changeset bill:2020070714
create table t_exam_chapter
(
    id          bigint auto_increment primary key comment '主键id',
    exam_id     bigint comment '考试id',
    title       nvarchar(100) not null comment '章标题',
    phrase      nvarchar(255) not null default '' comment '介绍',
    create_time timestamp     not null default current_timestamp comment '创建时间',
    update_time timestamp     not null default current_timestamp on update current_timestamp comment '最后修改时间'
) comment '考试章';

-- changeset bill:2020070715
create table t_exam_chapter_section
(
    id              bigint auto_increment primary key comment '主键id',
    exam_chapter_id bigint comment '考试章id',
    title           nvarchar(100) not null comment '章节标题',
    paper_id        bigint        not null comment '试卷id',
    phrase          nvarchar(255) not null default '' comment '介绍',
    create_time     timestamp     not null default current_timestamp comment '创建时间',
    update_time     timestamp     not null default current_timestamp on update current_timestamp comment '最后修改时间'
) comment '考试章节';

-- changeset bill:2020070716
create table t_exam_category_relation
(
    id          bigint auto_increment primary key comment '主键id',
    category_id bigint not null comment '目录id',
    exam_id     bigint not null comment '考试id',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间'
) comment '考试与分类关系';

-- changeset bill:202012121
create table t_sign_up
(
    id             bigint primary key auto_increment comment '主键id',
    member_id      bigint      not null comment '会员id',
    exam_id        bigint      not null comment '考试id',
    status         varchar(50) not null comment '状态',
    completed_time timestamp comment '完成时间',
    create_time    timestamp default current_timestamp comment '创建时间',
    update_time    timestamp default current_timestamp on update current_timestamp comment '最后修改时间'
) comment '报名';

-- changeset bill:202012122
create table t_record
(
    id                      bigint auto_increment comment '主键id',
    member_id               bigint         not null comment '会员id',
    exam_id                 bigint         not null comment '考试id',
    exam_chapter_section_id bigint         not null comment '章节id',
    sign_up_id              bigint         not null comment '报名id',
    paper                   json           not null comment '试卷',
    answer                  json           not null comment '答案',
    reference_answer        json comment '参考答案',
    start_time              timestamp comment '开始考试时间',
    end_time                timestamp comment '结束考试时间',
    score                   decimal(14, 2) not null default 0 comment '分数',
    status                  varchar(50)    not null comment '状态',
    create_time             timestamp               default current_timestamp comment '创建时间',
    update_time             timestamp               default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '学习记录';

-- changeset bill:202106041
create table t_wrong_question
(
    id                    bigint auto_increment primary key comment '主键id',
    question_id           bigint         not null comment '题目id',
    title                 nvarchar(2000) not null comment '题目',
    note                  text           not null comment '题目描述',
    type                  varchar(100)   not null comment '类型',
    difficulty            int            not null comment '难度',
    score                 decimal(14, 2) not null comment '分数',
    reference_answer      text           not null comment '参考答案',
    reference_answer_note text           not null comment '答案解析',
    options               text           not null comment '选项',
    status                varchar(50)    not null comment '状态',
    member_id             bigint         not null comment '会员id',
    scored                decimal(14, 2) not null comment '会员答题得分',
    result                tinyint        not null comment '会员答题结果',
    answer                text           not null comment '会员答案',
    create_time           timestamp default current_timestamp comment '创建时间',
    update_time           timestamp default current_timestamp on update current_timestamp comment '最后修改时间'
) comment '会员错误题目';
