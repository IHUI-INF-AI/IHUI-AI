package com.ai.manager.small.domain;

// import javax.persistence.*; // Remove JPA imports
import lombok.Data;

import java.math.BigDecimal;

// Remove JPA annotations
// @Entity
// @Table(name = "zhs_exchange_rate")
@Data
public class ExchangeRate {

    // @Id
    // @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String currency; // 货币类型 (e.g., USD, CNY)

    private BigDecimal rate; // 汇率

    // @Column(name = "updated_at")
    private Integer updatedAt; // 更新时间 (int 类型，存储时间戳)

    
} 