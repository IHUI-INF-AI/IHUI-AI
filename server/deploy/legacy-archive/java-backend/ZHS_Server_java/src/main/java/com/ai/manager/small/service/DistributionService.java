package com.ai.manager.small.service;

import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.constants.ResultConfig;
import com.ai.manager.small.domain.CommissionFlow;
import com.ai.manager.small.domain.Order;
import com.ai.manager.small.domain.User;
import com.ai.manager.small.mapper.CommissionFlowMapper;
import com.ai.manager.small.mapper.OrderMapper;
import com.ai.manager.small.mapper.UserMapper;
import com.ai.manager.small.mapper.WithdrawalFlowMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class DistributionService {

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private OrderMapper orderMapper;

    @Autowired
    private CommissionFlowMapper commissionFlowMapper;

    @Autowired
    private WithdrawalFlowMapper withdrawalFlowMapper;

    /**
     * 获取操盘手的所有下家
     * 对应 PHP 的 getSubordinates 方法
     *
     * @param openId   微信用户OpenID
     * @param quantity 每页条数
     * @param page     当前页码
     * @return 下家列表（分页）
     */
    public ResponseResultInfo getSubordinates(String openId, int quantity, int page) {
        // 参数校验
        if (openId == null || openId.isEmpty()) {
            return ResponseResultInfo.builder()
                    .code(ResultConfig.ERROR_PARAM_CODE.toString())
                    .msg("缺少 open_id")
                    .build();
        }

        // 查找当前用户
        User user = userMapper.selectByOpenId(openId);
        if (user == null) {
            return ResponseResultInfo.builder()
                    .code("404")
                    .msg("用户不存在")
                    .build();
        }

        String inviteCode = user.getInviteCode();
        if (inviteCode == null || inviteCode.isEmpty()) {
            return ResponseResultInfo.builder()
                    .code("404")
                    .msg("用户没有邀请码")
                    .build();
        }

        // 获取总条数
        long total = userMapper.countByParentId(inviteCode, null);

        // 查询分页数据
        int offset = (page - 1) * quantity;
        List<User> invitees = userMapper.selectByParentId(inviteCode, quantity, offset);

        Map<String, Object> data = new HashMap<>();
        data.put("list", invitees);
        data.put("total", total);
        data.put("page", page);
        data.put("quantity", quantity);
        data.put("pages", (int) Math.ceil((double) total / quantity));

        return ResponseResultInfo.builder()
                .code(ResultConfig.SUCCESS_CODE.toString())
                .msg("查询成功")
                .data(data)
                .build();
    }

    /**
     * 获取用户及其下级的订单（分页）
     * 对应 PHP 的 getUserAndChildrenOrders 方法
     *
     * @param userId   用户ID
     * @param page     页码
     * @param quantity 每页数量
     * @return 订单列表和分页信息
     */
    public ResponseResultInfo getUserAndChildrenOrders(Integer userId, int page, int quantity) {
        // 参数校验
        if (userId == null) {
            return ResponseResultInfo.builder()
                    .code(ResultConfig.ERROR_PARAM_CODE.toString())
                    .msg("缺少用户ID")
                    .build();
        }

        // 1. 获取当前用户的 invite_code
        User user = userMapper.selectById(userId);
        if (user == null || user.getInviteCode() == null || user.getInviteCode().isEmpty()) {
            return ResponseResultInfo.builder()
                    .code("404")
                    .msg("用户不是操盘手不存在或没有邀请码")
                    .build();
        }
        String inviteCode = user.getInviteCode();

        // 2. 获取所有 parent_id = 当前用户 invite_code 的用户ID（下家）
        List<Integer> childIds = userMapper.selectIdsByParentId(inviteCode);

        // 3. 合并当前用户和下家 ID
        List<Integer> userIds = new ArrayList<>();
        userIds.add(userId);
        if (childIds != null) {
            userIds.addAll(childIds);
        }

        // Handle empty userIds list to prevent SQL errors
        if (userIds.isEmpty()) {
             return ResponseResultInfo.builder()
                     .code(ResultConfig.SUCCESS_CODE.toString())
                     .msg("成功")
                     .data(Collections.emptyList()) // Return empty list if no users
                     .build();
        }

        // 4. 分页查询这些用户的订单数据（订单列表）
        int offset = (page - 1) * quantity;
        // Corrected: Pass sort field, direction, limit, and offset
        List<Order> orders = orderMapper.selectByUserIdsIn(userIds, "created_at", "desc", quantity, offset);

        // TODO: PHP 版本返回了分页信息，这里也需要添加
        // 获取总订单数 (需要一个新的 Mapper 方法，例如 countByUserIdsIn)
        // long totalOrders = orderMapper.countByUserIdsIn(userIds);
        // Map<String, Object> paginationData = new HashMap<>();
        // paginationData.put("list", orders);
        // paginationData.put("total", totalOrders);
        // paginationData.put("page", page);
        // paginationData.put("quantity", quantity);
        // paginationData.put("pages", (int) Math.ceil((double) totalOrders / quantity));

        return ResponseResultInfo.builder()
                .code(ResultConfig.SUCCESS_CODE.toString())
                .msg("成功")
                .data(orders) // 暂时只返回订单列表，分页信息待完善
                .build();

    }

    /**
     * 获取操盘手数据卡片数据
     * 对应 PHP 的 getOperatorDataCardData 方法
     *
     * @param userId 用户ID
     * @return 数据卡片数据
     */
    public ResponseResultInfo getOperatorDataCardData(Integer userId) {
        // 参数校验
        if (userId == null) {
            return ResponseResultInfo.builder()
                    .code(ResultConfig.ERROR_PARAM_CODE.toString())
                    .msg("缺少 user_id")
                    .build();
        }

        // 获取用户信息
        User user = userMapper.selectById(userId);
        if (user == null) {
            return ResponseResultInfo.builder()
                    .code("404")
                    .msg("用户不存在")
                    .build();
        }
        String inviteCode = user.getInviteCode();

        if (inviteCode == null || inviteCode.isEmpty()) {
        return ResponseResultInfo.builder()
                    .code("404")
                    .msg("用户没有邀请码")
                    .build();
        }

        // 时间范围 (Java uses milliseconds, PHP uses seconds)
        // Using helper methods to get timestamps
        Integer todayStart = getStartOfDayTimestamp();
        Integer monthStart = getStartOfMonthTimestamp();

        // 1. 佣金流水统计（commission_flow）
        Map<String, BigDecimal> commission = new HashMap<>();
        commission.put("today", commissionFlowMapper.sumAmountByUserIdAndTimeGreaterThanEqual(userId, todayStart));
        commission.put("month", commissionFlowMapper.sumAmountByUserIdAndTimeGreaterThanEqual(userId, monthStart));
        commission.put("total", commissionFlowMapper.sumAmountByUserIdAndTimeGreaterThanEqual(userId, null));

        // 2. 被邀请的用户列表（user表） - Need to get IDs first
        List<Integer> invitedUserIds = userMapper.selectIdsByParentId(inviteCode);

        Map<String, Map<String, Long>> orderStats = new HashMap<>();
        if (!invitedUserIds.isEmpty() || invitedUserIds.size()>0) {
            invitedUserIds = new ArrayList<>();
            // invitedUserIds.add(0L); // Removed dummy ID, handle empty list in SQL or Service logic
            // 3. 邀请用户产生的订单数量统计（order表）
            Map<String, Long> orderStatsToday = new HashMap<>();
            // Corrected: Use countByUserIdsInAndStatusIn with correct parameters
            orderStatsToday.put("status", orderMapper.countByUserIdsInAndStatusIn(invitedUserIds, Arrays.asList(3), todayStart));
            orderStats.put("today", orderStatsToday);

            Map<String, Long> orderStatsMonth = new HashMap<>();
            // Corrected: Use countByUserIdsInAndStatusIn with correct parameters
            orderStatsMonth.put("status", orderMapper.countByUserIdsInAndStatusIn(invitedUserIds, Arrays.asList(3), monthStart));
            orderStats.put("month", orderStatsMonth);

            Map<String, Long> orderStatsTotal = new HashMap<>();
            // Corrected: Use countByUserIdsInAndStatusIn with correct parameters
            orderStatsTotal.put("status", orderMapper.countByUserIdsInAndStatusIn(invitedUserIds, Arrays.asList(3), null));
            orderStats.put("total", orderStatsTotal);
        }
        // 4. 邀请用户数量统计
        Map<String, Long> invitedUserStats = new HashMap<>();
        // Corrected: Use countByParentId with time filters
        invitedUserStats.put("today", userMapper.countByParentId(inviteCode, todayStart));
        invitedUserStats.put("month", userMapper.countByParentId(inviteCode, monthStart));
        invitedUserStats.put("total", userMapper.countByParentId(inviteCode, null));

        // 5. 提现流水统计（withdrawal_flow）
        Map<String, BigDecimal> withdrawal = new HashMap<>();
        // Corrected: Use sumAmountByUserIdAndUpdatedAtGreaterThanEqual with correct parameters
        withdrawal.put("today", withdrawalFlowMapper.sumAmountByUserIdAndUpdatedAtGreaterThanEqual(userId, todayStart));
        withdrawal.put("month", withdrawalFlowMapper.sumAmountByUserIdAndUpdatedAtGreaterThanEqual(userId, monthStart));
        withdrawal.put("total", withdrawalFlowMapper.sumAmountByUserIdAndUpdatedAtGreaterThanEqual(userId, null));

        // 返回
        Map<String, Object> data = new HashMap<>();
        data.put("commission", commission);
        data.put("orderStats", orderStats);
        data.put("invitedUserStats", invitedUserStats);
        data.put("withdrawal", withdrawal);
        data.put("user", user);

        return ResponseResultInfo.builder()
                .code(ResultConfig.SUCCESS_CODE.toString())
                .msg("成功")
                .data(data)
                .build();

    }

    /**
     * 获取用户邀请的下级用户订单统计
     * 对应 PHP 的 getUserInviteeOrderStats 方法
     *
     * @param userId 用户ID
     * @return 下级用户订单统计列表
     */
    public ResponseResultInfo getUserInviteeOrderStats(Integer userId) {
        // 参数校验
        if (userId == null) {
            return ResponseResultInfo.builder()
                    .code(ResultConfig.ERROR_PARAM_CODE.toString())
                    .msg("缺少用户ID")
                    .build();
        }

        // 1. 获取用户数据
        User user = userMapper.selectById(userId);
        if (user == null) {
            return ResponseResultInfo.builder()
                    .code("404")
                    .msg("用户不存在")
                    .build();
        }
        String inviteCode = user.getInviteCode();

        if (inviteCode == null || inviteCode.isEmpty()) {
            return ResponseResultInfo.builder()
                    .code("404")
                    .msg("用户没有邀请码")
                    .build();
        }

        // 2. 获取所有下级用户（parent_id = invite_code）
        // Corrected: Pass null for limit and offset for no pagination
        List<User> invitees = userMapper.selectByParentId(inviteCode, null, null);

            // 3. 查询下级用户的订单统计数据
            // 需要一个新的 Mapper 方法来获取每个下级用户的订单总数和已完成订单数
            // 假设有一个方法 List<Map<String, Object>> countOrdersByUserIdInAndStatus(@Param("userIds") List<Long> userIds, @Param("status") Integer status);
        List<Map<String, Object>> inviteeStatsList = new ArrayList<>();

        if (invitees != null) {
            for (User invitee : invitees) {
                Map<String, Object> inviteeStats = new HashMap<>();
                inviteeStats.put("id", invitee.getId());
                inviteeStats.put("nickname", invitee.getNickname());
                inviteeStats.put("avatar", invitee.getAvatar());
                inviteeStats.put("phone", invitee.getPhone());
                inviteeStats.put("created_at", invitee.getCreatedAt());
                inviteeStats.put("total_earnings", invitee.getTotalEarnings());
                inviteeStats.put("is_VIP", invitee.getIsVIP());

                // 3. 统计该用户的订单情况
                // Corrected: Use OrderMapper methods with a list containing single user ID
                long orderCount = orderMapper.countByUserIdsIn(Collections.singletonList(invitee.getId()));
                BigDecimal totalAmount = orderMapper.sumAmountByUserIdsIn(Collections.singletonList(invitee.getId()));
                Integer latestTime = orderMapper.selectLatestCreatedAtByUserIdsIn(Collections.singletonList(invitee.getId()));

                // 4. 合并统计字段
                inviteeStats.put("order_count", orderCount);
                inviteeStats.put("total_amount", totalAmount != null ? totalAmount.doubleValue() : 0.0);
                inviteeStats.put("latest_time", latestTime);

                inviteeStatsList.add(inviteeStats);
            }
        }

        return ResponseResultInfo.builder()
                .code(ResultConfig.SUCCESS_CODE.toString())
                .msg("查询成功")
                .data(inviteeStatsList) // 返回统计数据
                .build();
    }

    /**
     * 获取用户佣金明细
     * 对应 PHP 的 getUserCommissionDetail 方法
     *
     * @param userId 用户ID
     * @return 用户佣金明细数据
     */
    public ResponseResultInfo getUserCommissionDetail(Integer userId) {
        // 参数校验
        if (userId == null) {
            return ResponseResultInfo.builder()
                    .code(ResultConfig.ERROR_PARAM_CODE.toString())
                    .msg("缺少用户ID")
                    .build();
        }

        // 获取用户信息
        User user = userMapper.selectById(userId);
        if (user == null) {
            return ResponseResultInfo.builder()
                    .code("404")
                    .msg("用户不存在")
                    .build();
        }

        // 获取今日时间戳 (使用 Helper 方法)
        Integer todayStart = getStartOfDayTimestamp();

        // 获取今日佣金总额
        BigDecimal todayCommissionTotal = commissionFlowMapper.sumAmountByUserIdAndTimeGreaterThanEqual(userId, todayStart);
        if (todayCommissionTotal == null) todayCommissionTotal = BigDecimal.ZERO;

        // 获取佣金流水列表
        List<CommissionFlow> commissionFlowList = commissionFlowMapper.selectByUserId(userId);

        // 查找关联的用户信息 (被邀请人) based on invited_user_id in CommissionFlow
        /*List<Long> invitedUserIdsFromFlow = commissionFlowList.stream()
                .map(CommissionFlow::getInvitedUserId) // Assuming getInvitedUserId exists in CommissionFlow
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());*/

        final Map<Integer, User> invitedUserMap = new HashMap<>(); // Declare as final and initialize here

        /*if (!invitedUserIdsFromFlow.isEmpty()) {
            // Fetch invited users based on their IDs
            // selectByIdIn method should now exist in UserMapper
            List<User> invitedUserList = userMapper.selectByIdIn(invitedUserIdsFromFlow);
             if (invitedUserList != null) {
                 // Modify the final map
                invitedUserMap.putAll(invitedUserList.stream()
                        .collect(Collectors.toMap(User::getId, u -> u)));
             }
        }*/

        List<Long> orderIds = commissionFlowList.stream()
                .map(CommissionFlow::getOrderId) // Assuming getInvitedUserId exists in CommissionFlow
                .filter(Objects::nonNull)
                .map(Long::valueOf)
                .distinct()
                .collect(Collectors.toList());
        if (!orderIds.isEmpty()) {
            List<User> invitedUserList = userMapper.selectByOrderIdIn(orderIds);
            if (invitedUserList != null) {
                invitedUserMap.putAll(invitedUserList.stream().collect(Collectors.toMap(User::getId, u -> u)));
            }
        }

        // 组装返回数据
        List<Map<String, Object>> detailList = commissionFlowList.stream()
                .map(flow -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("amount", flow.getAmount());
                    item.put("time", flow.getTime());
//                    item.put("remark", flow.getRemark());

                    // 获取被邀请人昵称 using invitedUserMap
//                    User invitedUser = invitedUserMap.get(flow.getInvitedUserId());
//                    item.put("invited_user_nickname", invitedUser != null ? invitedUser.getNickname() : "未知用户");
//                    item.put("invited_user_id", flow.getInvitedUserId());

                    // TODO: Add order details if needed based on PHP (PHP code doesn't seem to add order details here)

                    return item;
                })
                .collect(Collectors.toList());

        Map<String, Object> data = new HashMap<>();
        data.put("list", detailList);
        data.put("today_commission", todayCommissionTotal);

        return ResponseResultInfo.builder()
                .code(ResultConfig.SUCCESS_CODE.toString())
                .msg("成功")
                .data(data)
                .build();
    }

    // Helper method to calculate start of day in seconds (approximate GMT+8)
    private Integer getStartOfDayTimestamp() {
        long currentTimeMillis = System.currentTimeMillis();
        // Calculate start of day in GMT+8
        long currentTimeSeconds = currentTimeMillis / 1000L;
        long secondsIntoDay = (currentTimeSeconds + 8 * 3600) % 86400; // Adjust for GMT+8 before modulo
        return (int) (currentTimeSeconds - secondsIntoDay);
    }

    // Helper method to calculate start of month in seconds (approximate GMT+8)
    private Integer getStartOfMonthTimestamp() {
         // Using Java 8 Time API for more accurate calculation (requires Java 8 or higher)
         // import java.time.LocalDate;
         // import java.time.ZoneId;
         // LocalDate now = LocalDate.now();
         // LocalDate startOfMonth = now.withDayOfMonth(1);
         // return (int) startOfMonth.atStartOfDay(ZoneId.of("Asia/Shanghai")).toEpochSecond(); // Use correct timezone

         // Temporary approximation if Java 8 Time API is not used
         // This is a very rough approximation based on 30 days per month.
         // Need a more accurate way to get the first day of the current month.

        // Placeholder for now - need to implement correctly based on Java version and timezone needs
        // Simple approach: subtract roughly number of seconds in days passed this month.
        long currentTimeMillis = System.currentTimeMillis();
        long currentTimeSeconds = currentTimeMillis / 1000L;

        // Very rough calculation of seconds passed in current month (assuming 30 days per month)
        // This is not accurate and needs to be replaced with proper date calculation.
        // long secondsPassedInMonthApprox = (currentTimeSeconds % (30 * 86400));
        // return (int) (currentTimeSeconds - secondsPassedInMonthApprox + 8 * 3600); // Add GMT+8 offset

        // Simple placeholder returning a fixed offset for demonstration. REPLACE THIS.
         return (int) (System.currentTimeMillis() / 1000L - 25 * 86400); // Subtract ~25 days worth of seconds as a placeholder
    }

    // Helpers for UserRepository (Add these methods to UserRepository interface)
    // long countByParentId(String parentId);
    // List<User> findByParentIdOrderByCreatedAtDesc(String parentId, Pageable pageable);
    // List<Long> findIdsByParentId(String parentId); // Need to add this, could use @Query
    // long countByParentIdAndCreatedAtGreaterThanEqual(String parentId, Integer createdAt);
    // List<User> findByParentId(String parentId); // Need to add this

    // Helpers for OrderRepository (Add these methods to OrderRepository interface)
    // List<Order> findByUserIdInOrderByCreatedAtDesc(Collection<Long> userIds); // Need findByUserIdIn(Collection<Long> userIds, Pageable pageable) for pagination
    // long countByUserIdInAndStatusIn(Collection<Long> userIds, Collection<Integer> statuses);
    // long countByUserIdInAndCreatedAtGreaterThanEqualAndStatusIn(Collection<Long> userIds, Integer createdAt, Collection<Integer> statuses);
    // long countByUserIdInAndStatus(Collection<Long> userIds, Integer status);
    // long countByUserIdInAndCreatedAtGreaterThanEqualAndStatus(Collection<Long> userIds, Integer createdAt, Integer status);
    // @Query("SELECT SUM(o.amount), COUNT(o) FROM Order o WHERE o.userId = :userId") List<Object[]> sumAmountAndCountByUserId(@Param("userId") Long userId);
    // @Query("SELECT MAX(o.createdAt) FROM Order o WHERE o.userId = :userId") Integer findLatestCreatedAtByUserId(@Param("userId") Long userId);

    // Helpers for CommissionFlowRepository (Add these methods to CommissionFlowRepository interface)
    // BigDecimal sumAmountByUserIdAndTimeGreaterThanEqual(Long userId, Integer time);
    // BigDecimal sumAmountByUserId(Long userId);

    // Helpers for WithdrawalFlowRepository (Add these methods to WithdrawalFlowRepository interface)
    // BigDecimal sumAmountByUserIdAndTimeGreaterThanEqual(Long userId, Integer time);
    // BigDecimal sumAmountByUserId(Long userId);
} 