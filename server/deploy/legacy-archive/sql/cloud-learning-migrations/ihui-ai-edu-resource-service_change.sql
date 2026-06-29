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

-- changeset bill:2020070704
create table t_resource
(
    id           bigint auto_increment comment '主键id',
    title        nvarchar(100) not null comment '标题',
    member_id    bigint        not null comment '用户id',
    introduction text          not null comment '内容',
    image        varchar(3000) comment '海报图片',
    url          varchar(3000) comment '标签',
    status       varchar(100)  not null comment '状态',
    type         varchar(200)  not null comment '类型',
    create_time  timestamp default current_timestamp comment '创建时间',
    update_time  timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '资源';

-- changeset bill:2020070705
create table t_resource_category_relation
(
    id          bigint auto_increment comment '主键id',
    category_id bigint not null comment '目录id',
    resource_id  bigint not null comment '资源id',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '资源类目关系';

-- changeset bill:202103311
create table t_resource_download
(
    id          bigint auto_increment comment '主键id',
    member_id bigint not null comment '会员id',
    resource_id  bigint not null comment '资源id',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '会员下载记录';

-- changeset bill:202311131
create table t_resource_search_record
(
    id          bigint auto_increment comment '主键id',
    member_id bigint not null comment '会员id',
    search_condition  text not null comment '搜索条件',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '会员搜索记录';
