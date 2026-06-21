# FinanceDistributionApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**commissionDetailApiV1FinanceCommissionDetailGet**](FinanceDistributionApi.md#commissiondetailapiv1financecommissiondetailget) | **GET** /api/v1/finance/commission-detail | 佣金明细 |
| [**inviteeOrderStatsApiV1FinanceInviteeOrderStatsGet**](FinanceDistributionApi.md#inviteeorderstatsapiv1financeinviteeorderstatsget) | **GET** /api/v1/finance/invitee-order-stats | 下级用户订单统计 |
| [**inviteeStatsApiV1FinanceInviteeStatsGet**](FinanceDistributionApi.md#inviteestatsapiv1financeinviteestatsget) | **GET** /api/v1/finance/invitee-stats | 邀请统计 |
| [**listSubordinatesApiV1FinanceSubordinatesGet**](FinanceDistributionApi.md#listsubordinatesapiv1financesubordinatesget) | **GET** /api/v1/finance/subordinates | 我的下级用户列表 |
| [**listTeamApiV1FinanceTeamGet**](FinanceDistributionApi.md#listteamapiv1financeteamget) | **GET** /api/v1/finance/team | 我的团队（下属列表+搜索排序） |
| [**operatorDataCardApiV1FinanceOperatorCardGet**](FinanceDistributionApi.md#operatordatacardapiv1financeoperatorcardget) | **GET** /api/v1/finance/operator-card | 操盘手数据卡片统计 |
| [**teamCenterApiV1FinanceTeamCenterGet**](FinanceDistributionApi.md#teamcenterapiv1financeteamcenterget) | **GET** /api/v1/finance/team/center | 个人中心我的团队（概要） |
| [**userAndChildrenOrdersApiV1FinanceUserAndChildrenOrdersGet**](FinanceDistributionApi.md#userandchildrenordersapiv1financeuserandchildrenordersget) | **GET** /api/v1/finance/user-and-children-orders | 用户及下级的订单列表 |



## commissionDetailApiV1FinanceCommissionDetailGet

> any commissionDetailApiV1FinanceCommissionDetailGet(page, limit)

佣金明细

### Example

```ts
import {
  Configuration,
  FinanceDistributionApi,
} from '';
import type { CommissionDetailApiV1FinanceCommissionDetailGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FinanceDistributionApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies CommissionDetailApiV1FinanceCommissionDetailGetRequest;

  try {
    const data = await api.commissionDetailApiV1FinanceCommissionDetailGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## inviteeOrderStatsApiV1FinanceInviteeOrderStatsGet

> any inviteeOrderStatsApiV1FinanceInviteeOrderStatsGet(page, limit)

下级用户订单统计

Mirrors Java getUserInviteeOrderStats.  For each invitee, return their order count, total amount, and latest order time.

### Example

```ts
import {
  Configuration,
  FinanceDistributionApi,
} from '';
import type { InviteeOrderStatsApiV1FinanceInviteeOrderStatsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FinanceDistributionApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies InviteeOrderStatsApiV1FinanceInviteeOrderStatsGetRequest;

  try {
    const data = await api.inviteeOrderStatsApiV1FinanceInviteeOrderStatsGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## inviteeStatsApiV1FinanceInviteeStatsGet

> any inviteeStatsApiV1FinanceInviteeStatsGet()

邀请统计

### Example

```ts
import {
  Configuration,
  FinanceDistributionApi,
} from '';
import type { InviteeStatsApiV1FinanceInviteeStatsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FinanceDistributionApi(config);

  try {
    const data = await api.inviteeStatsApiV1FinanceInviteeStatsGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listSubordinatesApiV1FinanceSubordinatesGet

> any listSubordinatesApiV1FinanceSubordinatesGet(page, limit)

我的下级用户列表

### Example

```ts
import {
  Configuration,
  FinanceDistributionApi,
} from '';
import type { ListSubordinatesApiV1FinanceSubordinatesGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FinanceDistributionApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListSubordinatesApiV1FinanceSubordinatesGetRequest;

  try {
    const data = await api.listSubordinatesApiV1FinanceSubordinatesGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listTeamApiV1FinanceTeamGet

> any listTeamApiV1FinanceTeamGet(page, limit, keyword, sortBy, sortOrder)

我的团队（下属列表+搜索排序）

### Example

```ts
import {
  Configuration,
  FinanceDistributionApi,
} from '';
import type { ListTeamApiV1FinanceTeamGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FinanceDistributionApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string | 搜索关键词（昵称/UUID） (optional)
    keyword: keyword_example,
    // string | 排序字段: created_at / is_vip (optional)
    sortBy: sortBy_example,
    // string | 排序方向: asc / desc (optional)
    sortOrder: sortOrder_example,
  } satisfies ListTeamApiV1FinanceTeamGetRequest;

  try {
    const data = await api.listTeamApiV1FinanceTeamGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |
| **keyword** | `string` | 搜索关键词（昵称/UUID） | [Optional] [Defaults to `undefined`] |
| **sortBy** | `string` | 排序字段: created_at / is_vip | [Optional] [Defaults to `&#39;created_at&#39;`] |
| **sortOrder** | `string` | 排序方向: asc / desc | [Optional] [Defaults to `&#39;desc&#39;`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## operatorDataCardApiV1FinanceOperatorCardGet

> any operatorDataCardApiV1FinanceOperatorCardGet()

操盘手数据卡片统计

Mirrors Java getOperatorDataCardData.  Returns commission stats (today/month/total), order stats of invitees, invited user counts, and withdrawal stats.

### Example

```ts
import {
  Configuration,
  FinanceDistributionApi,
} from '';
import type { OperatorDataCardApiV1FinanceOperatorCardGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FinanceDistributionApi(config);

  try {
    const data = await api.operatorDataCardApiV1FinanceOperatorCardGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## teamCenterApiV1FinanceTeamCenterGet

> any teamCenterApiV1FinanceTeamCenterGet()

个人中心我的团队（概要）

### Example

```ts
import {
  Configuration,
  FinanceDistributionApi,
} from '';
import type { TeamCenterApiV1FinanceTeamCenterGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FinanceDistributionApi(config);

  try {
    const data = await api.teamCenterApiV1FinanceTeamCenterGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## userAndChildrenOrdersApiV1FinanceUserAndChildrenOrdersGet

> any userAndChildrenOrdersApiV1FinanceUserAndChildrenOrdersGet(page, limit)

用户及下级的订单列表

Mirrors Java getUserAndChildrenOrders.  Returns orders from the current user AND all invitees, paginated.

### Example

```ts
import {
  Configuration,
  FinanceDistributionApi,
} from '';
import type { UserAndChildrenOrdersApiV1FinanceUserAndChildrenOrdersGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FinanceDistributionApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies UserAndChildrenOrdersApiV1FinanceUserAndChildrenOrdersGetRequest;

  try {
    const data = await api.userAndChildrenOrdersApiV1FinanceUserAndChildrenOrdersGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

