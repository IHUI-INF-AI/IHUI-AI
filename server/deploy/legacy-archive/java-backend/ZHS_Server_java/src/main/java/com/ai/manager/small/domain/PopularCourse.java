package com.ai.manager.small.domain;

// import javax.persistence.*; // Remove JPA imports

import lombok.Data;

// Remove JPA annotations
// @Entity
// @Table(name = "zhs_popular_courses")
@Data
public class PopularCourse {

    // @Id
    // @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; // 课程ID

    private String title; // 课程标题

    private String cover; // 封面图片地址

    private String url; // 跳转链接

    private Integer sort; // 排序值

    private Integer status; // 状态：0-禁用，1-启用

} 