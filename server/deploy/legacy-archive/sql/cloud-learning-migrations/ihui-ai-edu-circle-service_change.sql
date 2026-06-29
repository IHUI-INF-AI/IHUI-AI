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

-- changeset bill:2020070704
create table t_circle
(
    id           bigint auto_increment comment '主键id',
    name         nvarchar(100) not null comment '名称',
    member_id    bigint        not null comment '会员id',
    image        varchar(3000) comment '图片',
    status       varchar(100)  not null comment '状态',
    introduction nvarchar(200) not null default '' comment '描述',
    create_time  timestamp              default current_timestamp comment '创建时间',
    update_time  timestamp              default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '圈子';

-- changeset bill:2020070705
create table t_circle_category_relation
(
    id          bigint auto_increment comment '主键id',
    category_id bigint not null comment '目录id',
    circle_id   bigint not null comment '圈子id',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '圈子类目关系';

-- changeset bill:2020070706
create table t_dynamic
(
    id          bigint auto_increment comment '主键id',
    content     text not null comment '内容',
    member_id   bigint        not null comment '会员id',
    image       varchar(3000) default '' comment '图片，多个逗号隔开',
    status      varchar(100)  not null comment '状态',
    circle_id   bigint        not null comment '圈子id',
    create_time timestamp     default current_timestamp comment '创建时间',
    update_time timestamp     default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '圈子动态';

-- changeset bill:2020070708
create table t_circle_member
(
    id          bigint auto_increment comment '主键id',
    member_id bigint not null comment '会员id',
    circle_id   bigint not null comment '圈子id',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '圈子会员';
