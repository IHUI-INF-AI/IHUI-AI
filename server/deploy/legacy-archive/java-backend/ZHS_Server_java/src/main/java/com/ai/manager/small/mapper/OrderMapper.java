package com.ai.manager.small.mapper;

// import org.springframework.data.jpa.repository.JpaRepository;
// import org.springframework.data.jpa.repository.Query;
// import org.springframework.data.repository.query.Param;
// import org.springframework.data.domain.Page;
// import org.springframework.data.domain.Pageable;

import com.ai.manager.small.domain.Order;
import com.ai.manager.small.domain.dto.OrderPageDTO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
// import java.util.Optional; // Removed Optional import

// 将 JpaRepository 替换为标准的 Mapper 接口
// public interface OrderRepository extends JpaRepository<Order, Long> { // Removed extends
@Mapper
public interface OrderMapper { // Renamed to OrderMapper

    // TODO: 将原 OrderRepository 中的方法转换为 MyBatis 方法，并实现 SQL
    // 原 OrderRepository 中的方法签名 (需要手动转换为 MyBatis 方法)
    // List<Order> findByUserIdInOrderByCreatedAtDesc(Collection<Long> userIds);
    // Page<Order> findByUserIdIn(Collection<Long> userIds, Pageable pageable);
    // long countByUserIdInAndStatusIn(Collection<Long> userIds, Collection<Integer> statuses);
    // long countByUserIdInAndCreatedAtGreaterThanEqualAndStatusIn(Collection<Long> userIds, Integer createdAt, Collection<Integer> statuses);
    // long countByUserIdInAndStatus(Collection<Long> userIds, Integer status);
    // long countByUserIdInAndCreatedAtGreaterThanEqualAndStatus(Collection<Long> userIds, Integer createdAt, Integer status);
    // @Query("SELECT SUM(o.amount), COUNT(o) FROM Order o WHERE o.userId = :userId") List<Object[]> sumAmountAndCountByUserId(@Param("userId") Long userId);
    // @Query("SELECT MAX(o.createdAt) FROM Order o WHERE o.userId = :userId") Integer findLatestCreatedAtByUserId(@Param("userId") Long userId);
    // Order findByOutTradeNo(String outTradeNo);
    // @Query("SELECT COUNT(o), SUM(o.amount), MAX(o.createdAt) FROM Order o WHERE o.userId = :userId") List<Object[]> countAndSumAmountAndMaxCreatedAtByUserId(@Param("userId") Long userId);
    // @Query("SELECT o.id, o.outTradeNo, o.userId FROM Order o WHERE o.id IN :orderIds") List<Object[]> findIdOutTradeNoUserIdByIdIn(@Param("orderIds") List<Long> orderIds);
    // Long countByUserIdInAndCreatedAtGreaterThanEqualAndStatus(List<Long> userId, int createdAt, int status);
    // Long countByUserIdInAndStatus(List<Long> userId, int status);
    // long countByUserIdInAndStatusInAndCreatedAtGreaterThanEqual(List<Long> userIds, Collection<Integer> statuses, int createdAt);
    // long countByUserIdInAndStatusIn(List<Long> userIds, Collection<Integer> statuses);
    // Long countByUserId(Long userId);
    // BigDecimal sumAmountByUserId(Long userId);
    // Optional<Order> findTopByUserIdOrderByCreatedAtDesc(Long userId);

    // MyBatis 方法定义
//    List<Order> selectByUserIdInOrderByCreatedAtDesc(Collection<Long> userIds);
//    long countByUserIdInAndStatusIn(Collection<Long> userIds, Collection<Integer> statuses);
//    BigDecimal sumAmountByUserId(Long userId);

    // 添加/修改 DistributionService 和 WXPayService 中使用到的方法定义
//    List<Order> selectByUserIdIn(@Param("userIds") Collection<Long> userIds);
//    long countByUserIdIn(@Param("userIds") Collection<Long> userIds);
//    long countByUserIdInAndStatusInAndCreatedAtGreaterThanEqual(@Param("userIds") Collection<Long> userIds, @Param("statuses") Collection<Integer> statuses, @Param("createdAt") int createdAt);
//    long countByUserId(@Param("userId") Long userId);
//    Order selectTopByUserIdOrderByCreatedAtDesc(@Param("userId") Long userId); // For DistributionService
//    BigDecimal sumAmountByUserIdInAndStatusIn(@Param("userIds") Collection<Long> userIds, @Param("statuses") Collection<Integer> statuses);

    // 添加 Order 的插入和更新方法
    int insertOrder(Order order);
    int updateOrder(Order order);

    // 添加根据商户订单号查找订单的方法
    Order selectByOutTradeNo(String outTradeNo); // For WXPayService

    List<Order> selectByUserIdsIn(@Param("userIds") List<Integer> userIds,
                                  @Param("orderBy") String orderBy,
                                  @Param("orderDesc") String orderDesc,
                                  @Param("limit") Integer limit,
                                  @Param("offset") Integer offset);

    Integer countByUserIdsIn(@Param("userIds") List<Integer> userIds);

    BigDecimal sumAmountByUserIdsIn(@Param("userIds") List<Integer> userIds);

    Integer selectLatestCreatedAtByUserIdsIn(@Param("userIds") List<Integer> userIds);

    Long countByUserIdsInAndStatusIn(@Param("userIds") List<Integer> userIds,
                                     @Param("statuses") List<Integer> statuses,
                                     @Param("createdAtGreaterThanEqual") Integer createdAtGreaterThanEqual);

    Integer updateStatus(@Param("outTradeNo") String outTradeNo, @Param("status") Integer status);
//
//    Long selectByOpenId(String openId);
//
//    String selectOutTradeNoByOpenId(String openId);

    List<Order> getOrder(OrderPageDTO order);

    // TODO: Add other methods as needed based on PHP analysis
}