-- liquibase formatted sql

-- changeset bill:20190930115001
create table t_private_letter
(
    id          bigint auto_increment comment '主键id',
    sender_id   varchar(100) not null comment '发送者id',
    receiver_id varchar(100) not null comment '接受者id',
    content     text         not null comment '内容',
    read_time   timestamp comment '读信息时间',
    is_read     tinyint      not null default 0 comment '是否已读',
    status      varchar(30)  not null comment '状态',
    create_time timestamp             default current_timestamp comment '创建时间',
    update_time timestamp             default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '私信';

-- changeset bill:2021004221
create table t_notice
(
    id           bigint auto_increment comment '主键id',
    topic_id     bigint       not null comment '主题id',
    topic_type   varchar(100) not null comment '主题类型',
    to_member_id bigint       not null comment '主题会员',
    status       varchar(100) comment '状态',
    type         varchar(100) not null comment '类型',
    browsed      tinyint      not null default 0 comment '是否已读',
    member_id    bigint       not null comment '会员',
    create_time  timestamp             default current_timestamp comment '创建时间',
    update_time  timestamp             default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '通知';

-- changeset bill:2021004222
create table t_announcement
(
    id           bigint auto_increment comment '主键id',
    title        nvarchar(2000) not null comment '标题',
    content      text           not null comment '内容',
    status       varchar(100) comment '状态',
    publish_time timestamp      not null comment '发布时间',
    create_time  timestamp default current_timestamp comment '创建时间',
    update_time  timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '公告';

-- changeset bill:2021004223
create table t_announcement_read_record
(
    id              bigint auto_increment comment '主键id',
    announcement_id bigint not null comment '公告id',
    member_id       bigint not null comment '会员id',
    create_time     timestamp default current_timestamp comment '创建时间',
    update_time     timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '公告阅读记录';

-- changeset bill:2021004224
create table t_system_notice
(
    id          bigint auto_increment comment '主键id',
    content     text not null comment '通知内容',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '系统通知';

-- changeset bill:202105121
create table t_template
(
    id          bigint auto_increment comment '主键id',
    type        varchar(100) not null comment '类型',
    content     text         not null comment '通知内容',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '通知模板';

-- changeset bill:202105122
insert into t_template(type, content) values('sign_up', '亲爱的会员，您成功报名课程「标题」。我们一起愉快学习吧~');

-- changeset bill:202105123
insert into t_template(type, content) values('register_user', '注册账号成功，欢迎加入大家庭~');
