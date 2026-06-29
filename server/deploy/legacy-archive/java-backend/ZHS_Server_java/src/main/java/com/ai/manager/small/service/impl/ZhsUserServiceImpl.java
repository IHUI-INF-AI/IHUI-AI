package com.ai.manager.small.service.impl;

import com.ai.manager.core.constants.BeanConfig;
import com.ai.manager.small.domain.*;
import com.ai.manager.small.mapper.*;
import com.ai.manager.small.service.IZhsActivityService;
import com.ai.manager.small.service.IZhsProductIdentityService;
import com.ai.manager.small.service.IZhsUserService;
import com.ai.manager.small.service.IZhsVipLevelService;
import com.ai.manager.core.utils.JsonUtils;
import com.google.common.collect.Maps;
import org.apache.commons.beanutils.BeanUtils;
import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.lang3.StringUtils;
import org.assertj.core.util.Lists;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

/**
 * 用户Service业务层处理
 * 
 * @author Raindrop_L
 * @date 2025-06-18
 */
@Service
public class ZhsUserServiceImpl implements IZhsUserService
{

    @Value("${ai.creator.name}")
    public String creatorName;

    // 基础
    @Autowired
    private UserMapper userMapper;
    @Autowired
    private OrderMapper orderMapper;
    @Autowired
    private CommissionFlowMapper commissionFlowMapper;

    // 商品
    @Autowired
    private ZhsUserMapper zhsUserMapper;
    private IZhsActivityService activityService;
    @Autowired
    private ProductMapper productMapper;
    @Autowired
    private IZhsProductIdentityService productIdentityService;
    // vip
    @Autowired
    private IZhsVipLevelService vipLevelService;

    // 流水
    @Autowired
    private OperateTokenFlowMapper operateTokenFlowMapper;
    @Autowired
    private ZhsIdentityProportionMapper identityProportionMapper;

    /**
     * 查询用户
     * 
     * @param id 用户主键
     * @return 用户
     */
    @Override
    public ZhsUser selectZhsUserById(Integer id)
    {
        return zhsUserMapper.selectZhsUserById(id);
    }

    /**
     * 查询用户列表
     * 
     * @param zhsUser 用户
     * @return 用户
     */
    @Override
    public List<ZhsUser> selectZhsUserList(ZhsUser zhsUser)
    {
        return zhsUserMapper.selectZhsUserList(zhsUser);
    }

    /**
     * 新增用户
     * 
     * @param zhsUser 用户
     * @return 结果
     */
    @Override
    public int insertZhsUser(ZhsUser zhsUser)
    {
        return zhsUserMapper.insertZhsUser(zhsUser);
    }

    /**
     * 修改用户
     * 
     * @param zhsUser 用户
     * @return 结果
     */
    @Override
    public int updateZhsUser(ZhsUser zhsUser)
    {
        return zhsUserMapper.updateZhsUser(zhsUser);
    }

    /**
     * 批量删除用户
     * 
     * @param ids 需要删除的用户主键
     * @return 结果
     */
    @Override
    public int deleteZhsUserByIds(Integer[] ids)
    {
        return zhsUserMapper.deleteZhsUserByIds(ids);
    }

    /**
     * 删除用户信息
     * 
     * @param id 用户主键
     * @return 结果
     */
    @Override
    public int deleteZhsUserById(Integer id)
    {
        return zhsUserMapper.deleteZhsUserById(id);
    }


    public User getByOpenId(String openId) {
        return userMapper.selectByOpenId(openId);
    }

    @Override
    @Transactional
    public Map<String, Object> updatePayStatus(User byOpenId, Order order) {
        // 判断当前身份是否是会员
        boolean isVip = byOpenId.getIsVIP().equals(1);

        Map<String, Object > result = Maps.newHashMap();
        result.put("code", 200);
        result.put("msg", "success");

        if(order.getStatus() == 1){
            try {
                result.put("data", JsonUtils.toJson(byOpenId));
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
            return result;
        }

        order.setStatus(1);
        order.setPaidAt(Instant.now().getEpochSecond());
        order.setPaymentStatus(1);
        Integer orderNum = orderMapper.updateOrder(order);

        if (StringUtils.isNotBlank(order.getActivityId())){
            // 活动商品
            setActivityToken(byOpenId, order.getActivityId(), order.getAmount());
        }else if(Objects.nonNull(order.getProductId())) {
            // 普通商品
            if(order.getOrderType() == 1){
                byOpenId.setIsVIP(1);
                // 添加用户身份
                addUserLevel(byOpenId);
            }
            setProductToken(byOpenId, order.getProductId());
        }else if(StringUtils.isNotBlank(order.getProductIdentityId())) {
            // 用户身份
            if(order.getOrderType() == 4 && order.getProductIdentityId().equals(BeanConfig.PRODUCT_IDENTITY_VIP)){
                byOpenId.setIsVIP(1);
                byOpenId.setTokenQuantity(Long.valueOf(BeanConfig.PRODUCT_IDENTITY_VIPTOKEN));

                // 添加用户身份
                addUserLevel(byOpenId);
            }
            if(order.getOrderType() == 4 && order.getProductIdentityId().equals(BeanConfig.PRODUCT_IDENTITY_OPERATE)){
                byOpenId.setIdentityTypy(1);
                byOpenId.setTokenQuantity(0L);
            }
        }

        Integer userNum = updateStatus(byOpenId);

        // 如果初始是vip则添加用户经验值
        if(isVip)
            editUserVip(byOpenId, order);
        try {
            result.put("data", BeanUtils.describe(byOpenId));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        return result;
    }

    /**
     * 修改并添加记录
     * @param user
     * @return
     */
    private Integer updateStatus(User user) {
//        operate_time
        // 添加用户的token操作记录
        OperateTokenFlow tokenFlow = OperateTokenFlow.builder()
                .userId(user.getId())
                .createdAt(Instant.now().getEpochSecond())
                .tokenQuantity(user.getTokenQuantity())
                .operateDesc("用户购买TOKEN：" + user.getTokenQuantity())
                .build();
        operateTokenFlowMapper.insert(tokenFlow);

        return userMapper.updateStatus(user);
    }

    /**
     * 普通商品
     * @param user
     * @param productId
     */
    private void setProductToken(User user, Long productId){
        if(productId == 1){
            user.setIsVIP(1);
        }

        Product product = productMapper.selectById(productId);
        // 修改次数
        User byOpenId = getByOpenId(user.getOpenId());
        Integer isVIP = byOpenId.getIsVIP();
        Integer identityType = byOpenId.getIdentityTypy();

        if(identityType == 1){
            user.setTokenQuantity(product.getDenominationOperate());
        } else if(isVIP == 1){
            user.setTokenQuantity(product.getDenominationVip());
        }else {
            user.setTokenQuantity(product.getDenomination());
        }
    }

    /**
     * 活动商品计算
     * @param user
     * @param activityId
     * @param amount
     */
    private void setActivityToken(User user, String activityId, Integer amount) {
        ZhsActivity zhsActivity = activityService.selectZhsActivityById(activityId);
        Long tokenQuantity = (amount/100) * zhsActivity.getComputing();
        user.setTokenQuantity(tokenQuantity);
    }

    private int addUserLevel(User user) {
        // 创建联系表
        ZhsUserVip param = ZhsUserVip.builder()
                .id(UUID.randomUUID().toString())
                .userId(user.getId().toString())
                .openId(user.getToken())
                .vipId(BeanConfig.BASE_VIP_ID)
                .progress(0)
                .creator(creatorName)
                .build();
        return userMapper.addUserLevel(param);
    }

    /**
     * 修改用户vip级别
     * @param byOpenId
     * @param order
     * @return
     */
    public int editUserVip(User byOpenId, Order order) {
        if(byOpenId.getIsVIP()==0) {
            return 0;
        }

        // 获取会员等级 并计算
        ZhsUserVip userVip =  vipLevelService.getUserProgeress(byOpenId.getToken());

        Integer progress = 0;
        // 根据订单中的钱数确认当前所需增长的经验 // 不同订单来源不一致
        switch (order.getOrderType()){
            case 1:
                //创建会员
                break;
            case  2:
                // 普通订单
                Long productIdInt = Long.valueOf(order.getProductId().toString());
                // TODO 未来要改成UUID的主键
                progress = productMapper.selectById(productIdInt).getPrice();
                break;
            case 3:
                // 活动 金额来自用户手填 所以在订单中
//                ZhsActivity zhsActivity = activityService.selectZhsActivityById(order.getActivityId());
                progress = order.getAmount();
                break;
            case 4:
                // 开通身份
                ZhsProductIdentity productIdentityAmount = productIdentityService.selectZhsProductIdentityById(order.getProductIdentityId());
                // 判断是否在时间内
                long nowDate = new Date().getTime();
                if (productIdentityAmount.getStatus() == 1 && productIdentityAmount.getBeginTime().getTime() < nowDate && productIdentityAmount.getEndTime().getTime() >= nowDate)
                    progress = productIdentityAmount.getAmount();
                else
                    progress = productIdentityAmount.getDefAmount();
                break;
            default:
                return 0;
        }
        // 计算规则
        progress = ruleCalculation(progress / 100);

        // 修改等级
        progress = userVip.getProgress() + progress;
        return vipLevelService.setUserProgress(userVip.getOpenId(),userVip.getVipId(), progress);
    }

    /**
     * 计算金额与经验的换算规则
     * @param progress
     * @return
     */
    private Integer ruleCalculation(Integer progress) {
        return progress / 100;
    }


    private ZhsIdentityProportion proportion;

    /**
     * 根据订单回馈邀请人（分销）
     *
     * @param user
     * @param order
     */
    @Override
    @Transactional
    public void feedbackInvite(User user, Order order) {
        // 获取上级和上上级
        List<User> parentUsers = userMapper.getParentUser(user.getOpenId());
        if(CollectionUtils.isNotEmpty(parentUsers)){
            List<CommissionFlow> commissionFlows = createCommissionFlows(parentUsers, user, order);
            int i = commissionFlowMapper.saveList(commissionFlows);
        }
    }

    /**
     * 创建返利流水账单
     * @param parentUsers
     * @param user
     * @param order
     * @return
     */
    private List<CommissionFlow> createCommissionFlows(List<User> parentUsers, User user, Order order) {
        // 获取当前分润比例
        proportion = identityProportionMapper.selectZhsIdentityProportionList(ZhsIdentityProportion.builder().status(1).build()).get(0);

        List<CommissionFlow> result = Lists.newArrayList();
        // 计算佣金流水
        CommissionFlow parentCommissionFlow = CommissionFlow.builder()
//                .id(UUID.randomUUID())
                .userId(Integer.valueOf(user.getId().toString()))
                .openId(user.getToken())
                .orderId(order.getId().toString())
                .time(Instant.now().getEpochSecond())
//                .status(0)
                .build();
        User parentUser = parentUsers.get(0);
        parentCommissionFlow.setBelongersOpenId(parentUser.getToken());
        if(parentUser.getIsVIP() == 0){ // 普通用户
            parentCommissionFlow.setType(0);
            // 计算返利
            parentCommissionFlow.setToken(calcReturnToken(user.getTokenQuantity()).toString());
        }else {
            // 所有会员
            parentCommissionFlow.setType(1);
            // 计算返利                                                 // 操盘手与非操盘手区分
            parentCommissionFlow.setAmount(calcReturnVip(order,parentUser.getIdentityTypy() == 1));
        }
        result.add(parentCommissionFlow);

        if(parentUsers.size() != 2){
            return result;
        }
        // 计算上上级是操盘手的
        CommissionFlow grandparentCommissionFlow = CommissionFlow.builder()
//                .id(UUID.randomUUID())
                .userId(Integer.valueOf(user.getId().toString()))
                .openId(user.getToken())
                .orderId(order.getId().toString())
                .time(Instant.now().getEpochSecond())
//                .status(0)
                .build();
        User grandUser = parentUsers.get(1);
        grandparentCommissionFlow.setBelongersOpenId(grandUser.getToken());
        grandparentCommissionFlow.setType(2);
        grandparentCommissionFlow.setAmount(calcReturnTrader(order));
        result.add(grandparentCommissionFlow);

        return result;
    }

    /**
     * 计算上上级操盘手
     * @param order
     * @return
     */
    private Integer calcReturnTrader(Order order) {
        // 判断订单内容
        Integer orderType = order.getOrderType();
        switch (orderType){
            case 1: //会员
                return order.getAmount() * proportion.getGrandVipProportion() / 100;
            case 2: // token
                // 2 3 一致
            case 3: // 活动
                return order.getAmount() * proportion.getGrandRoutineProportion() / 100;
            case 4: // 开通身份
                // 判断是否购买内容
                if(order.getProductIdentityId().equals(BeanConfig.PRODUCT_IDENTITY_VIP)){
                    return order.getAmount() * proportion.getGrandVipProportion() / 100;
                }
                if(order.getProductIdentityId().equals(BeanConfig.PRODUCT_IDENTITY_OPERATE)){
                    return order.getAmount() * proportion.getGrandTraderProportion() / 100;
                }
            default:
                return 0;
        }
    }

    /**
     * VIP计算返利token
     * @param order
     * @param type false:vip | true：操盘手
     * @return
     */
    private Integer calcReturnVip(Order order, boolean type){

        // 判断订单内容
        Integer orderType = order.getOrderType();
        switch (orderType){
            case 1: //会员
                return order.getAmount() * (type?proportion.getTraderVipProportion():proportion.getVipProportion()) / 100;
            case 2: // token
                // 2 3 比例一致
            case 3: // 活动
                return order.getAmount() * (type?proportion.getTraderRoutineProportion():proportion.getRoutineProportion()) / 100;
            case 4: // 开通身份
                // 判断是否购买内容
                if(order.getProductIdentityId().equals(BeanConfig.PRODUCT_IDENTITY_VIP)){
                    return order.getAmount() * (type?proportion.getTraderVipProportion():proportion.getVipProportion()) / 100;
                }
                if(order.getProductIdentityId().equals(BeanConfig.PRODUCT_IDENTITY_OPERATE)){
                    return order.getAmount() * (type?proportion.getTraderTraderProportion():proportion.getTraderProportion()) / 100;
                }
            default:
                return 0;
        }
    }

    /**
     * 普通用户计算返利token
     * 按5%进行返利
     * @param tokenQuantity
     * @return
     */
    private Long calcReturnToken(Long tokenQuantity){
        if(proportion == null){
            return 0L;
        }
        return tokenQuantity * proportion.getTokenProportion() / 100;
    }


    @Override
    public void userPayNotify(Order order) {
        User user = zhsUserMapper.getByUuid(order.getOpenId());
        // 修改支付状态
        updatePayStatus(user, order);

        // 支付后对邀请人返利
        feedbackInvite(user, order);
    }

}
