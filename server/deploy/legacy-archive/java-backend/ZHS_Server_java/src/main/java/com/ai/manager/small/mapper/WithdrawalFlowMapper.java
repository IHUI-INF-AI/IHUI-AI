package com.ai.manager.small.mapper;

// import org.springframework.data.jpa.repository.JpaRepository;
// import org.springframework.data.jpa.repository.Query;
// import org.springframework.data.repository.query.Param;

import com.ai.manager.small.domain.WithdrawalFlow;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.math.BigDecimal;
// import java.util.Optional; // Remove Optional import

// 将 JpaRepository 替换为标准的 Mapper 接口
// public interface WithdrawalFlowRepository extends JpaRepository<WithdrawalFlow, Long> { // Removed extends
@Mapper
public interface WithdrawalFlowMapper { // Renamed to WithdrawalFlowMapper

    // TODO: 将原 WithdrawalFlowRepository 中的方法转换为 MyBatis 方法，并实现 SQL
    // 原 WithdrawalFlowRepository 中的方法签名 (需要手动转换为 MyBatis 方法)
    // @Query("SELECT SUM(wf.amount) FROM WithdrawalFlow wf WHERE wf.userId = :userId AND wf.createdAt >= :timeStart") BigDecimal sumAmountByUserIdAndCreatedAtGreaterThanEqual(@Param("userId") Long userId, @Param("timeStart") int timeStart);
    // @Query("SELECT SUM(wf.amount) FROM WithdrawalFlow wf WHERE wf.userId = :userId") BigDecimal sumAmountByUserId(@Param("userId") Long userId);
    // Optional<WithdrawalFlow> findByPartnerTradeNo(String partnerTradeNo);

    // MyBatis 方法定义
    BigDecimal sumAmountByUserIdAndCreatedAtGreaterThanEqual(@Param("userId") Long userId, @Param("timeStart") int timeStart);
    BigDecimal sumAmountByUserId(Long userId);
    WithdrawalFlow selectByPartnerTradeNo(String partnerTradeNo);

    // 添加提现流水插入和更新方法
    int insertWithdrawalFlow(WithdrawalFlow withdrawalFlow);
    int updateWithdrawalFlow(WithdrawalFlow withdrawalFlow);

    BigDecimal sumAmountByUserIdAndUpdatedAtGreaterThanEqual(@Param("userId") Integer userId,
                                                             @Param("updatedAtGreaterThanEqual") Integer updatedAtGreaterThanEqual);

    // TODO: Add other methods as needed based on PHP analysis
} 