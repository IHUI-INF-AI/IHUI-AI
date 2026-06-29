package com.ai.manager.small.mapper;


import com.ai.manager.small.domain.CommissionFlow;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Mapper
public interface CommissionFlowMapper { // Renamed to CommissionFlowMapper

    // TODO: 将原 CommissionFlowRepository 中的方法转换为 MyBatis 方法，并实现 SQL

    // MyBatis 方法定义
    BigDecimal sumAmountByUserIdAndTimeGreaterThanEqual(@Param("userId") Integer userId,
                                                        @Param("timeGreaterThanEqual") Integer timeGreaterThanEqual);
    BigDecimal sumAmountByUserId(Long userId);
    List<CommissionFlow> selectByUserIdOrderByTimeDesc(Long userId);

    List<CommissionFlow> selectByUserId(@Param("userId") Integer userId);
    long countByUserId(@Param("userId") Long userId);

    int insert(CommissionFlow commissionFlow);

    int saveList(@Param("commissionFlows") List<CommissionFlow> commissionFlows);

    Map<String,String> getAccountByOpenId(@Param("token")String token);

    List<Map<String, Object>> selectAllOrders(@Param("token") String token,@Param("orderStatus") String orderStatus,@Param("startOfDay") long startOfDay,@Param("endOfDay") long endOfDay);

    int updateStatus(@Param("ids") List<String> ids);
}