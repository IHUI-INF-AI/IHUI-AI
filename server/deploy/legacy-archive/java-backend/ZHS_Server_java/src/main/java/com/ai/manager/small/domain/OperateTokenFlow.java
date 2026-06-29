package com.ai.manager.small.domain;

// import javax.persistence.*; // Remove JPA imports
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// Remove JPA annotations
// @Entity
// @Table(name = "zhs_operate_token_flow")
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class OperateTokenFlow {

    // @Id
    // @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // @Column(name = "user_id")
    private Integer userId; // 用户ID

    private Long tokenQuantity; // token 数量（正数表示增加，负数表示减少）

    private Integer type; // 操作类型 (e.g., 0-购买, 1-签到, 2-资源消耗)

    // @Column(name = "created_at")
    private Long createdAt; // 操作时间 (int 类型，存储时间戳)

    private String operateDesc; // 备注

    private Integer tokenFree; // 免费次数
    private String userUuid;

}