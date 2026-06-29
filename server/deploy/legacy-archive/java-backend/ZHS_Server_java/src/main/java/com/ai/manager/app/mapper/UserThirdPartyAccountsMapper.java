package com.ai.manager.app.mapper;

import com.ai.manager.app.domain.UserThirdPartyAccounts;
import com.ai.manager.app.domain.users.UsersVO;
import com.ai.manager.app.domain.users.VipLevelVO;
import com.baomidou.dynamic.datasource.annotation.DS;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 第三方账号关联Mapper接口
 * 
 * @author Raindrop_L
 * @date 2025-06-25
 */
@DS("center")
public interface UserThirdPartyAccountsMapper 
{
    /**
     * 查询第三方账号关联
     * 
     * @param id 第三方账号关联主键
     * @return 第三方账号关联
     */
    public UserThirdPartyAccounts selectUserThirdPartyAccountsById(Long id);

    /**
     * 查询第三方账号关联列表
     * 
     * @param userThirdPartyAccounts 第三方账号关联
     * @return 第三方账号关联集合
     */
    public List<UserThirdPartyAccounts> selectUserThirdPartyAccountsList(UserThirdPartyAccounts userThirdPartyAccounts);

    /**
     * 新增第三方账号关联
     * 
     * @param userThirdPartyAccounts 第三方账号关联
     * @return 结果
     */
    public int insertUserThirdPartyAccounts(UserThirdPartyAccounts userThirdPartyAccounts);

    /**
     * 修改第三方账号关联
     * 
     * @param userThirdPartyAccounts 第三方账号关联
     * @return 结果
     */
    public int updateUserThirdPartyAccounts(UserThirdPartyAccounts userThirdPartyAccounts);

    /**
     * 删除第三方账号关联
     * 
     * @param id 第三方账号关联主键
     * @return 结果
     */
    public int deleteUserThirdPartyAccountsById(Long id);

    /**
     * 批量删除第三方账号关联
     * 
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int deleteUserThirdPartyAccountsByIds(Long[] ids);

    UserThirdPartyAccounts getByUserUuid(@Param("uuid") String uuid, @Param("platform") String platform);

    UserThirdPartyAccounts getByUserUuidBasic(@Param("uuid") String uuid, @Param("platform") String platform);

    int delAuth(@Param("uuid") String uuid, @Param("platform") String platform);

    List<UsersVO> getMyTeam(@Param("uuid") String uuid, @Param("search") String search, @Param("begin") Long begin, @Param("end") Long end, @Param("platform") String platform);

    List<UserThirdPartyAccounts> getByUserUuidsBasic(@Param("uuids") List<String> uuids, @Param("platform") String platform);

    List<VipLevelVO> getVIPInfoByUserUuids(@Param("uuids") List<String> uuids);

    Long getTeamSize(@Param("platform") String platform, @Param("uuid") String uuid);
}
