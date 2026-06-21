# FinanceDistributionApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**commissionDetailApiV1FinanceCommissionDetailGet**](#commissiondetailapiv1financecommissiondetailget) | **GET** /api/v1/finance/commission-detail | 佣金明细|
|[**inviteeOrderStatsApiV1FinanceInviteeOrderStatsGet**](#inviteeorderstatsapiv1financeinviteeorderstatsget) | **GET** /api/v1/finance/invitee-order-stats | 下级用户订单统计|
|[**inviteeStatsApiV1FinanceInviteeStatsGet**](#inviteestatsapiv1financeinviteestatsget) | **GET** /api/v1/finance/invitee-stats | 邀请统计|
|[**listSubordinatesApiV1FinanceSubordinatesGet**](#listsubordinatesapiv1financesubordinatesget) | **GET** /api/v1/finance/subordinates | 我的下级用户列表|
|[**listTeamApiV1FinanceTeamGet**](#listteamapiv1financeteamget) | **GET** /api/v1/finance/team | 我的团队（下属列表+搜索排序）|
|[**operatorDataCardApiV1FinanceOperatorCardGet**](#operatordatacardapiv1financeoperatorcardget) | **GET** /api/v1/finance/operator-card | 操盘手数据卡片统计|
|[**teamCenterApiV1FinanceTeamCenterGet**](#teamcenterapiv1financeteamcenterget) | **GET** /api/v1/finance/team/center | 个人中心我的团队（概要）|
|[**userAndChildrenOrdersApiV1FinanceUserAndChildrenOrdersGet**](#userandchildrenordersapiv1financeuserandchildrenordersget) | **GET** /api/v1/finance/user-and-children-orders | 用户及下级的订单列表|

# **commissionDetailApiV1FinanceCommissionDetailGet**
> any commissionDetailApiV1FinanceCommissionDetailGet()


### Example

```typescript
import {
    FinanceDistributionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceDistributionApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.commissionDetailApiV1FinanceCommissionDetailGet(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **inviteeOrderStatsApiV1FinanceInviteeOrderStatsGet**
> any inviteeOrderStatsApiV1FinanceInviteeOrderStatsGet()

Mirrors Java getUserInviteeOrderStats.  For each invitee, return their order count, total amount, and latest order time.

### Example

```typescript
import {
    FinanceDistributionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceDistributionApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.inviteeOrderStatsApiV1FinanceInviteeOrderStatsGet(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **inviteeStatsApiV1FinanceInviteeStatsGet**
> any inviteeStatsApiV1FinanceInviteeStatsGet()


### Example

```typescript
import {
    FinanceDistributionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceDistributionApi(configuration);

const { status, data } = await apiInstance.inviteeStatsApiV1FinanceInviteeStatsGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listSubordinatesApiV1FinanceSubordinatesGet**
> any listSubordinatesApiV1FinanceSubordinatesGet()


### Example

```typescript
import {
    FinanceDistributionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceDistributionApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listSubordinatesApiV1FinanceSubordinatesGet(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listTeamApiV1FinanceTeamGet**
> any listTeamApiV1FinanceTeamGet()


### Example

```typescript
import {
    FinanceDistributionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceDistributionApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let keyword: string; //搜索关键词（昵称/UUID） (optional) (default to undefined)
let sortBy: string; //排序字段: created_at / is_vip (optional) (default to 'created_at')
let sortOrder: string; //排序方向: asc / desc (optional) (default to 'desc')

const { status, data } = await apiInstance.listTeamApiV1FinanceTeamGet(
    page,
    limit,
    keyword,
    sortBy,
    sortOrder
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **keyword** | [**string**] | 搜索关键词（昵称/UUID） | (optional) defaults to undefined|
| **sortBy** | [**string**] | 排序字段: created_at / is_vip | (optional) defaults to 'created_at'|
| **sortOrder** | [**string**] | 排序方向: asc / desc | (optional) defaults to 'desc'|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **operatorDataCardApiV1FinanceOperatorCardGet**
> any operatorDataCardApiV1FinanceOperatorCardGet()

Mirrors Java getOperatorDataCardData.  Returns commission stats (today/month/total), order stats of invitees, invited user counts, and withdrawal stats.

### Example

```typescript
import {
    FinanceDistributionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceDistributionApi(configuration);

const { status, data } = await apiInstance.operatorDataCardApiV1FinanceOperatorCardGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **teamCenterApiV1FinanceTeamCenterGet**
> any teamCenterApiV1FinanceTeamCenterGet()


### Example

```typescript
import {
    FinanceDistributionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceDistributionApi(configuration);

const { status, data } = await apiInstance.teamCenterApiV1FinanceTeamCenterGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **userAndChildrenOrdersApiV1FinanceUserAndChildrenOrdersGet**
> any userAndChildrenOrdersApiV1FinanceUserAndChildrenOrdersGet()

Mirrors Java getUserAndChildrenOrders.  Returns orders from the current user AND all invitees, paginated.

### Example

```typescript
import {
    FinanceDistributionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceDistributionApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.userAndChildrenOrdersApiV1FinanceUserAndChildrenOrdersGet(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

