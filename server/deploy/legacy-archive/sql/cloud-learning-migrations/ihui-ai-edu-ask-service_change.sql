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
create table t_question
(
    id          bigint auto_increment comment '主键id',
    title       nvarchar(50) not null comment '标题',
    content     text         not null comment '内容',
    member_id   bigint       not null comment '会员id',
    status      varchar(50)  not null comment '状态',
    image       varchar(500) not null comment '题图',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '问题';

-- changeset bill:2020070704
create table t_question_category_relation
(
    id          bigint auto_increment comment '主键id',
    category_id bigint not null comment '目录id',
    question_id  bigint not null comment '问题id',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '频道类目关系';

-- changeset bill:2020070705
create table t_answer
(
    id          bigint auto_increment comment '主键id',
    content     text         not null comment '内容',
    question_id   bigint       not null comment '问题id',
    member_id   bigint       not null comment '会员id',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '回答';
