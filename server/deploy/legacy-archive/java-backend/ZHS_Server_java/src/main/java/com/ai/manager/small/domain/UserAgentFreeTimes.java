package com.ai.manager.small.domain;

// import javax.persistence.*; // Remove JPA imports

// Remove JPA annotations
// @Entity
// @Table(name = "zhs_user_agent_free_times")

import lombok.Data;

@Data
public class UserAgentFreeTimes {

    // @Id
    // @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; // 记录ID

    // @Column(name = "user_id")
    private Integer userId; // 用户ID

    // @Column(name = "agent_user_id")
    private Long agentUserId; // 代理用户ID

    private Integer times; // 免费次数

    // @Column(name = "created_at")
    private Long createdAt; // 创建时间 (int 类型，存储时间戳)
    private Long updatedAt; // 创建时间 (int 类型，存储时间戳)
    private Long agentId;
    private int degree;

}