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
create table t_news
(
    id          bigint auto_increment comment '主键id',
    title       nvarchar(100) not null comment '标题',
    type        varchar(100)  not null comment '类型',
    user_id     bigint        not null comment '用户id',
    content     text          not null comment '内容',
    image       varchar(3000) comment '海报图片',
    tags        varchar(3000) comment '标签',
    keywords        varchar(3000) comment '关键字',
    status      varchar(100)  not null comment '状态',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '新闻';

-- changeset bill:2020070704
create table t_article
(
    id           bigint auto_increment comment '主键id',
    title        nvarchar(100) not null comment '标题',
    member_id    bigint        not null comment '用户id',
    content      text          not null comment '内容',
    image        varchar(3000) comment '海报图片',
    tags         varchar(3000) comment '标签',
    keywords     varchar(3000) comment '关键字',
    status       varchar(100)  not null comment '状态',
    introduction nvarchar(200) not null default '' comment '描述',
    create_time  timestamp              default current_timestamp comment '创建时间',
    update_time  timestamp              default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '文章';

-- changeset bill:2020070705
create table t_article_category_relation
(
    id          bigint auto_increment comment '主键id',
    category_id bigint not null comment '目录id',
    article_id  bigint not null comment '文章id',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '文章类目关系';

-- changeset bill:2020070706
alter table t_article add recommend tinyint default 0 not null comment '推荐';
alter table t_article add top tinyint default 0 not null comment '置顶';

-- changeset bill:2020070707
alter table t_news add recommend tinyint default 0 not null comment '推荐';
alter table t_news add top tinyint default 0 not null comment '置顶';

-- changeset bill:2020070708
alter table t_news add description nvarchar(3000) default '' not null comment '简介';
