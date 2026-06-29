package com.ai.manager.small.domain;

import java.util.Date;

// import javax.persistence.Entity;
// import javax.persistence.GeneratedValue;
// import javax.persistence.GenerationType;
// import javax.persistence.Id;
// import javax.persistence.Table;

import lombok.Data; // Import Lombok @Data

// @Entity // Removed JPA annotation
// @Table(name = "zhs_product") // Removed JPA annotation
@Data // Add @Data annotation
public class Product {

    // @Id // Removed JPA annotation
    // @GeneratedValue(strategy = GenerationType.IDENTITY) // Removed JPA annotation
    private Long id;
    private String name;
    private String desc; // Renamed from desc
    private Integer price;
    private Integer type; // 1: 会员，2: Token
    private Long denomination; // Token 面额 (非VIP购买时)
    private Long denominationVip; // Token 面额 (VIP购买时)
    private Long denominationOperate; // Token 面额 (操盘手购买)
    private Integer status; // 0: 下架，1: 上架
    
    private Date createdAt ; 
    private Date updatedAt;

    // Remove manual getters and setters if they exist
} 