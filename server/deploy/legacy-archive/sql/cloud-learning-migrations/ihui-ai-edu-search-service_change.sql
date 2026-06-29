-- liquibase formatted sql

-- changeset bill:202104221
create table t_hot_word
(
    id          bigint auto_increment comment '主键id',
    name        nvarchar(200) not null comment '热词',
    sort_order  bigint        not null comment '权重',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '热词';

-- changeset bill:202104222
create table t_record
(
    id          bigint auto_increment comment '主键id',
    word        nvarchar(4000) not null comment '搜索内容',
    member_id   bigint         not null default 0 comment '用户id',
    ip_addr     varchar(200)   not null comment 'ip地址',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '搜索记录';

-- changeset bill:202104223
create table t_content
(
    id          bigint auto_increment comment '主键id',
    topic_id    bigint         not null comment '主题ID，如课程评论、知识评论的ID等',
    topic_title  nvarchar(2000) not null comment '主题标题，如课程评论、知识评论的ID等',
    topic_type  nvarchar(50)   not null comment '主题类型，如课程评论、知识评论等',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '可搜索内容';

