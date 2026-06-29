-- liquibase formatted sql

-- changeset bill:2020070701
create table t_category
(
    id            bigint auto_increment comment '主键id',
    name          nvarchar(50)        not null comment '分类名称',
    sort_order    int       default 1 not null comment '排列序号，表示同级分类的展现次序，如数值相等则按名称次序排列。取值范围:大于零的整数',
    is_show       tinyint   default 1 not null comment '是否显示',
    is_show_index tinyint   default 1 not null comment '是否在首页显示',
    level         int                 not null comment '目录等级',
    image         varchar(500)        not null comment '分类图片',
    create_time   timestamp default current_timestamp comment '创建时间',
    update_time   timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '分类';

-- changeset bill:2020070702
create table t_category_relation
(
    id                        bigint auto_increment comment '主键id',
    child_category_id         bigint  not null comment '子分类id',
    father_category_id        bigint  not null comment '父分类id',
    direct_father_category_id bigint  not null comment '直属父分类id',
    is_sub                    tinyint not null comment '是否属于子分类',
    create_time               timestamp default current_timestamp comment '创建时间',
    update_time               timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '分类关系';

-- changeset bill:2020070703
create table t_channel
(
    id           bigint auto_increment comment '主键id',
    name         nvarchar(100) not null comment '名称',
    introduction text          not null comment '描述',
    image        varchar(1000) not null comment '海报',
    user_id      bigint        not null comment '用户id',
    status       varchar(200)  not null comment '状态',
    start_time   timestamp     not null comment '直播时间',
    show_number  tinyint       not null default 1 comment '人数显示',
    enable_chat  tinyint       not null default 1 comment '是否开启聊天',
    create_time  timestamp     not null default current_timestamp comment '创建时间',
    update_time  timestamp     not null default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '直播频道';

-- changeset bill:2020070705
create table t_channel_category_relation
(
    id          bigint auto_increment comment '主键id',
    category_id bigint not null comment '目录id',
    channel_id  bigint not null comment '频道id',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '频道分类关系';

-- changeset bill:2021030101
create table t_tencent_cloud_live_stream
(
    id          bigint auto_increment comment '主键id',
    channel_id  bigint       not null comment '频道id',
    stream_name varchar(200) not null comment '流名称',
    app_name    varchar(200) not null default 'live' comment '应用名称',
    create_time timestamp    not null default current_timestamp comment '创建时间',
    update_time timestamp    not null default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '腾讯云直播流信息';

-- changeset bill:2020070706
create table t_subscribe
(
    id          bigint auto_increment comment '主键id',
    member_id   bigint not null comment '会员id',
    channel_id  bigint not null comment '频道id',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '频道订阅';

-- changeset bill:202106101
create table t_channel_lecturer
(
    id          bigint primary key auto_increment comment '主键id',
    lecturer_id bigint not null comment '讲师id',
    channel_id  bigint not null comment '频道id',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间'
) comment '频道讲师';
