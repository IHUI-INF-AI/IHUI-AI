package com.ai.manager.small.mapper;

import com.ai.manager.small.domain.User;
import com.ai.manager.small.domain.ZhsIdentityProportion;
import com.ai.manager.small.domain.ZhsUserVip;
import com.ai.manager.small.domain.vo.TraderTeam;
import com.baomidou.dynamic.datasource.annotation.DS;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
@DS("center")
public interface UserMapper {

    // ResourceService -> getUserAgentFreeTimeInfo 调用 selectById 获取用户对象 (包含 isVIP)
    User selectById(@Param("userId") Integer userId);
    List<User> select(User user);


    // ResourceService -> recharge 调用
    String selectOpenIdById(@Param("userId") Long userId);
    Integer selectIsVipByOpenId(@Param("openId") String openId);

    // ResourceService -> getTokenCount 调用
    Integer selectTokenQuantityById(@Param("userId") Long userId);
    int updateTokenQuantityById(User userId);

    // LoginService 调用
    User selectByOpenId(@Param("openId") String openId);
    User byPhone(@Param("phone") String phone);
    User selectByInviteCode(@Param("inviteCode") String inviteCode);
    int insertUser(User user);
//    int updateByOpenId(@Param("openId") String openId, @Param("updateData") Map<String, Object> updateData);
    Integer updateByOpenId(User updateUser);
    int updateUserCard(@Param("id") Integer id, @Param("card") String card, @Param("updatedAt") Long updatedAt);

    // DistributionService 调用
    List<User> selectByParentId(@Param("parentId") String parentId,
                                @Param("limit") Integer limit,
                                @Param("offset") Integer offset);
    long countByParentId(@Param("parentId") String parentId,
                         @Param("createdAtGreaterThanEqual") Integer createdAtGreaterThanEqual);
    List<Integer> selectIdsByParentId(@Param("parentId") String parentId);
    List<User> selectByIdIn(@Param("userIds") List<Long> userIds);

    // Removed methods not called by ResourceService:
    // User selectByOpenId(String openId);
    // List<User> selectByParentId(String parentId);
    // User selectByInviteCode(String inviteCode);
    // int insertUser(User user);
    int updateUser(User user);

    // long countByParentId(String parentId);
    // List<User> selectByParentId(@Param("parentId") String parentId, @Param("offset") int offset, @Param("limit") int limit);
    // List<Long> selectIdsByParentId(@Param("parentId") String parentId);
    // long countByParentIdAndCreatedAtGreaterThanEqual(@Param("parentId") String parentId, @Param("createdAt") int createdAt);
     List<User> selectByOrderIdIn(@Param("orderIds")List<Long> orderIds);

    Integer updateStatus(User user);

    Integer setNumber(User build);

    Integer addUserLevel(ZhsUserVip param);

    List<User> getParentUser(String openId);

    List<User> getChildUser(String openId);
    List<User> getGrandchildUser(String openId);

//    List<TraderTeam> getTraderTeam(@Param("openId") String openId, @Param("search") String search, @Param("byOrderNum") Integer byOrderNum, @Param("byOrderTtime") Integer byOrderTtime, @Param("beginTime") Long beginTime, @Param("endTime") Long endTime, @Param("orderBeginTime") Long orderBeginTime, @Param("orderBeginTime")Long orderEndTime);
    List<TraderTeam> getTraderTeam(@Param("token") String token, @Param("search") String search, @Param("byOrderNum") Integer byOrderNum, @Param("byOrderTtime") Integer byOrderTtime, @Param("beginTime") Long beginTime, @Param("endTime") Long endTime);

    User getByPhone(@Param("phoneNumber") String phoneNumber);

    int editWxOpenId(@Param("phone") String phone, @Param("openId") String openId);

    int delVisitor(@Param("openId") String openId);

    void updateParent(@Param("openId") String openId, @Param("crankUpProportion") ZhsIdentityProportion crankUpProportion);

    List<TraderTeam> getTraderTeam2(@Param("uuids") List<String> uuids, @Param("beginTime") Long beginTime, @Param("endTime") Long endTime);

    Integer cancelUser(@Param("uuid") String uuid);

    Integer firstShare(@Param("uuid") String uuid, @Param("token") String token);

    // User selectByMobile(String mobile);
    // User selectByMobileAndPassword(@Param("mobile") String mobile, @Param("password") String password);
    // List<User> selectBySuperiorId(Long superiorId);
    // Integer selectIsVipById(@Param("id") Long id); // Not used by ResourceService
}
