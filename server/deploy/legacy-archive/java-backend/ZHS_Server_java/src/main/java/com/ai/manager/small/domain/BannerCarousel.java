package com.ai.manager.small.domain;

// import javax.persistence.*; // Remove JPA imports

import lombok.Data;

// Remove JPA annotations
// @Entity
// @Table(name = "zhs_banner_carousel")
@Data
public class BannerCarousel {

    // @Id
    // @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; // ID

    private String img; // 图片地址
    private String type;
    private String centerImg;
    private String describe;
    private String createdAt;
    private String updatedAt;

} 