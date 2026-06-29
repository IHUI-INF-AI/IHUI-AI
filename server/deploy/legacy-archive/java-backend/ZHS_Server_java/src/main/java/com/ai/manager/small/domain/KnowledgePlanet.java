package com.ai.manager.small.domain;

// import javax.persistence.*; // Remove JPA imports

import lombok.Data;

// Remove JPA annotations
// @Entity
// @Table(name = "zhs_knowledge_planet")
@Data
public class KnowledgePlanet {

    // @Id
    // @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; // ID

    private String title; // 标题

    private String cover; // 封面图片地址

    private String url; // 跳转链接

    private Integer sort; // 排序值

    private Integer status; // 状态：0-禁用，1-启用
    private String img;
    private Long time;
    private String classification;
    private Integer type;
    private Long createdAt;
    private Long updatedAt;
    private String businesses;
    private String businessesImage;
    private Integer likes;
    private Integer numberOfVisitors;

}