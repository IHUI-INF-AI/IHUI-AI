package com.ai.manager.small.domain;

// import javax.persistence.Entity;
// import javax.persistence.GeneratedValue;
// import javax.persistence.GenerationType;
// import javax.persistence.Id;
// import javax.persistence.Table;

import lombok.Data; // Import Lombok @Data

// @Entity // Removed JPA annotation
// @Table(name = "zhs_withdrawal_flow") // Removed JPA annotation
@Data // Add @Data annotation
public class WithdrawalFlow {

    // @Id // Removed JPA annotation
    // @GeneratedValue(strategy = GenerationType.IDENTITY) // Removed JPA annotation
    private Long id;
    private Integer userId;
    private Long amount;
    private Integer status;
    private Integer createdAt;
    private Integer updatedAt;
    private String partnerTradeNo;
    private String paymentNo;

    // Remove manual getters and setters if they exist
}