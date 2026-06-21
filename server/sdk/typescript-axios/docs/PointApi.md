# PointApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createGoodsApiV1PointGoodsPost**](#creategoodsapiv1pointgoodspost) | **POST** /api/v1/point/goods | 新增积分商品|
|[**createGoodsApiV1PointGoodsPost_0**](#creategoodsapiv1pointgoodspost_0) | **POST** /api/v1/point/goods | 新增积分商品|
|[**createRuleApiV1PointRulePost**](#createruleapiv1pointrulepost) | **POST** /api/v1/point/rule | 新增规则|
|[**createRuleApiV1PointRulePost_0**](#createruleapiv1pointrulepost_0) | **POST** /api/v1/point/rule | 新增规则|
|[**deleteGoodsApiV1PointGoodsGidDelete**](#deletegoodsapiv1pointgoodsgiddelete) | **DELETE** /api/v1/point/goods/{gid} | 删除商品|
|[**deleteGoodsApiV1PointGoodsGidDelete_0**](#deletegoodsapiv1pointgoodsgiddelete_0) | **DELETE** /api/v1/point/goods/{gid} | 删除商品|
|[**deleteRuleApiV1PointRuleRidDelete**](#deleteruleapiv1pointruleriddelete) | **DELETE** /api/v1/point/rule/{rid} | 删除规则|
|[**deleteRuleApiV1PointRuleRidDelete_0**](#deleteruleapiv1pointruleriddelete_0) | **DELETE** /api/v1/point/rule/{rid} | 删除规则|
|[**exchangeApiV1PointExchangePost**](#exchangeapiv1pointexchangepost) | **POST** /api/v1/point/exchange | 兑换商品|
|[**exchangeApiV1PointExchangePost_0**](#exchangeapiv1pointexchangepost_0) | **POST** /api/v1/point/exchange | 兑换商品|
|[**exchangeListApiV1PointExchangeListGet**](#exchangelistapiv1pointexchangelistget) | **GET** /api/v1/point/exchange/list | 兑换记录|
|[**exchangeListApiV1PointExchangeListGet_0**](#exchangelistapiv1pointexchangelistget_0) | **GET** /api/v1/point/exchange/list | 兑换记录|
|[**getGoodsApiV1PointGoodsGidGet**](#getgoodsapiv1pointgoodsgidget) | **GET** /api/v1/point/goods/{gid} | 积分商品详情|
|[**getGoodsApiV1PointGoodsGidGet_0**](#getgoodsapiv1pointgoodsgidget_0) | **GET** /api/v1/point/goods/{gid} | 积分商品详情|
|[**goodsListApiV1PointGoodsListGet**](#goodslistapiv1pointgoodslistget) | **GET** /api/v1/point/goods/list | 积分商品列表|
|[**goodsListApiV1PointGoodsListGet_0**](#goodslistapiv1pointgoodslistget_0) | **GET** /api/v1/point/goods/list | 积分商品列表|
|[**listLogsApiV1PointLogListGet**](#listlogsapiv1pointloglistget) | **GET** /api/v1/point/log/list | 积分流水|
|[**listLogsApiV1PointLogListGet_0**](#listlogsapiv1pointloglistget_0) | **GET** /api/v1/point/log/list | 积分流水|
|[**myAccountApiV1PointAccountGet**](#myaccountapiv1pointaccountget) | **GET** /api/v1/point/account | 我的积分账户|
|[**myAccountApiV1PointAccountGet_0**](#myaccountapiv1pointaccountget_0) | **GET** /api/v1/point/account | 我的积分账户|
|[**ruleListApiV1PointRuleListGet**](#rulelistapiv1pointrulelistget) | **GET** /api/v1/point/rule/list | 积分规则列表|
|[**ruleListApiV1PointRuleListGet_0**](#rulelistapiv1pointrulelistget_0) | **GET** /api/v1/point/rule/list | 积分规则列表|
|[**signinApiV1PointSigninPost**](#signinapiv1pointsigninpost) | **POST** /api/v1/point/signin | 每日签到|
|[**signinApiV1PointSigninPost_0**](#signinapiv1pointsigninpost_0) | **POST** /api/v1/point/signin | 每日签到|
|[**triggerApiV1PointTriggerPost**](#triggerapiv1pointtriggerpost) | **POST** /api/v1/point/trigger | 触发积分行为|
|[**triggerApiV1PointTriggerPost_0**](#triggerapiv1pointtriggerpost_0) | **POST** /api/v1/point/trigger | 触发积分行为|
|[**updateGoodsApiV1PointGoodsGidPut**](#updategoodsapiv1pointgoodsgidput) | **PUT** /api/v1/point/goods/{gid} | 修改商品|
|[**updateGoodsApiV1PointGoodsGidPut_0**](#updategoodsapiv1pointgoodsgidput_0) | **PUT** /api/v1/point/goods/{gid} | 修改商品|
|[**updateRuleApiV1PointRuleRidPut**](#updateruleapiv1pointruleridput) | **PUT** /api/v1/point/rule/{rid} | 修改规则|
|[**updateRuleApiV1PointRuleRidPut_0**](#updateruleapiv1pointruleridput_0) | **PUT** /api/v1/point/rule/{rid} | 修改规则|
|[**userAccountApiV1PointAccountUserIdGet**](#useraccountapiv1pointaccountuseridget) | **GET** /api/v1/point/account/{user_id} | 指定用户积分账户|
|[**userAccountApiV1PointAccountUserIdGet_0**](#useraccountapiv1pointaccountuseridget_0) | **GET** /api/v1/point/account/{user_id} | 指定用户积分账户|

# **createGoodsApiV1PointGoodsPost**
> any createGoodsApiV1PointGoodsPost()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let name: string; // (default to undefined)
let description: string; // (optional) (default to undefined)
let image: string; // (optional) (default to undefined)
let pointCost: number; // (optional) (default to 0)
let stock: number; // (optional) (default to 0)
let limitPerUser: number; // (optional) (default to 1)
let type: string; // (optional) (default to 'virtual')
let sortOrder: number; // (optional) (default to 0)

const { status, data } = await apiInstance.createGoodsApiV1PointGoodsPost(
    name,
    description,
    image,
    pointCost,
    stock,
    limitPerUser,
    type,
    sortOrder
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **name** | [**string**] |  | defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **image** | [**string**] |  | (optional) defaults to undefined|
| **pointCost** | [**number**] |  | (optional) defaults to 0|
| **stock** | [**number**] |  | (optional) defaults to 0|
| **limitPerUser** | [**number**] |  | (optional) defaults to 1|
| **type** | [**string**] |  | (optional) defaults to 'virtual'|
| **sortOrder** | [**number**] |  | (optional) defaults to 0|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createGoodsApiV1PointGoodsPost_0**
> any createGoodsApiV1PointGoodsPost_0()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let name: string; // (default to undefined)
let description: string; // (optional) (default to undefined)
let image: string; // (optional) (default to undefined)
let pointCost: number; // (optional) (default to 0)
let stock: number; // (optional) (default to 0)
let limitPerUser: number; // (optional) (default to 1)
let type: string; // (optional) (default to 'virtual')
let sortOrder: number; // (optional) (default to 0)

const { status, data } = await apiInstance.createGoodsApiV1PointGoodsPost_0(
    name,
    description,
    image,
    pointCost,
    stock,
    limitPerUser,
    type,
    sortOrder
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **name** | [**string**] |  | defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **image** | [**string**] |  | (optional) defaults to undefined|
| **pointCost** | [**number**] |  | (optional) defaults to 0|
| **stock** | [**number**] |  | (optional) defaults to 0|
| **limitPerUser** | [**number**] |  | (optional) defaults to 1|
| **type** | [**string**] |  | (optional) defaults to 'virtual'|
| **sortOrder** | [**number**] |  | (optional) defaults to 0|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createRuleApiV1PointRulePost**
> any createRuleApiV1PointRulePost()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let code: string; // (default to undefined)
let name: string; // (default to undefined)
let action: string; // (default to undefined)
let type: string; // (optional) (default to 'add')
let point: number; // (optional) (default to 0)
let maxPerDay: number; // (optional) (default to 0)
let description: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.createRuleApiV1PointRulePost(
    code,
    name,
    action,
    type,
    point,
    maxPerDay,
    description
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **code** | [**string**] |  | defaults to undefined|
| **name** | [**string**] |  | defaults to undefined|
| **action** | [**string**] |  | defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to 'add'|
| **point** | [**number**] |  | (optional) defaults to 0|
| **maxPerDay** | [**number**] |  | (optional) defaults to 0|
| **description** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createRuleApiV1PointRulePost_0**
> any createRuleApiV1PointRulePost_0()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let code: string; // (default to undefined)
let name: string; // (default to undefined)
let action: string; // (default to undefined)
let type: string; // (optional) (default to 'add')
let point: number; // (optional) (default to 0)
let maxPerDay: number; // (optional) (default to 0)
let description: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.createRuleApiV1PointRulePost_0(
    code,
    name,
    action,
    type,
    point,
    maxPerDay,
    description
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **code** | [**string**] |  | defaults to undefined|
| **name** | [**string**] |  | defaults to undefined|
| **action** | [**string**] |  | defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to 'add'|
| **point** | [**number**] |  | (optional) defaults to 0|
| **maxPerDay** | [**number**] |  | (optional) defaults to 0|
| **description** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteGoodsApiV1PointGoodsGidDelete**
> any deleteGoodsApiV1PointGoodsGidDelete()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let gid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteGoodsApiV1PointGoodsGidDelete(
    gid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **gid** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteGoodsApiV1PointGoodsGidDelete_0**
> any deleteGoodsApiV1PointGoodsGidDelete_0()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let gid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteGoodsApiV1PointGoodsGidDelete_0(
    gid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **gid** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteRuleApiV1PointRuleRidDelete**
> any deleteRuleApiV1PointRuleRidDelete()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let rid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteRuleApiV1PointRuleRidDelete(
    rid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **rid** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteRuleApiV1PointRuleRidDelete_0**
> any deleteRuleApiV1PointRuleRidDelete_0()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let rid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteRuleApiV1PointRuleRidDelete_0(
    rid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **rid** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **exchangeApiV1PointExchangePost**
> any exchangeApiV1PointExchangePost()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let goodsId: number; // (default to undefined)
let quantity: number; // (optional) (default to 1)
let address: string; // (optional) (default to undefined)
let contact: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.exchangeApiV1PointExchangePost(
    goodsId,
    quantity,
    address,
    contact
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **goodsId** | [**number**] |  | defaults to undefined|
| **quantity** | [**number**] |  | (optional) defaults to 1|
| **address** | [**string**] |  | (optional) defaults to undefined|
| **contact** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **exchangeApiV1PointExchangePost_0**
> any exchangeApiV1PointExchangePost_0()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let goodsId: number; // (default to undefined)
let quantity: number; // (optional) (default to 1)
let address: string; // (optional) (default to undefined)
let contact: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.exchangeApiV1PointExchangePost_0(
    goodsId,
    quantity,
    address,
    contact
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **goodsId** | [**number**] |  | defaults to undefined|
| **quantity** | [**number**] |  | (optional) defaults to 1|
| **address** | [**string**] |  | (optional) defaults to undefined|
| **contact** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **exchangeListApiV1PointExchangeListGet**
> any exchangeListApiV1PointExchangeListGet()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.exchangeListApiV1PointExchangeListGet(
    page,
    limit,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **status** | [**number**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **exchangeListApiV1PointExchangeListGet_0**
> any exchangeListApiV1PointExchangeListGet_0()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.exchangeListApiV1PointExchangeListGet_0(
    page,
    limit,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **status** | [**number**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getGoodsApiV1PointGoodsGidGet**
> any getGoodsApiV1PointGoodsGidGet()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let gid: number; // (default to undefined)

const { status, data } = await apiInstance.getGoodsApiV1PointGoodsGidGet(
    gid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **gid** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getGoodsApiV1PointGoodsGidGet_0**
> any getGoodsApiV1PointGoodsGidGet_0()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let gid: number; // (default to undefined)

const { status, data } = await apiInstance.getGoodsApiV1PointGoodsGidGet_0(
    gid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **gid** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **goodsListApiV1PointGoodsListGet**
> any goodsListApiV1PointGoodsListGet()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let keyword: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.goodsListApiV1PointGoodsListGet(
    page,
    limit,
    keyword
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **keyword** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **goodsListApiV1PointGoodsListGet_0**
> any goodsListApiV1PointGoodsListGet_0()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let keyword: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.goodsListApiV1PointGoodsListGet_0(
    page,
    limit,
    keyword
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **keyword** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listLogsApiV1PointLogListGet**
> any listLogsApiV1PointLogListGet()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let type: string; // (optional) (default to undefined)
let action: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listLogsApiV1PointLogListGet(
    page,
    limit,
    type,
    action
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **type** | [**string**] |  | (optional) defaults to undefined|
| **action** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listLogsApiV1PointLogListGet_0**
> any listLogsApiV1PointLogListGet_0()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let type: string; // (optional) (default to undefined)
let action: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listLogsApiV1PointLogListGet_0(
    page,
    limit,
    type,
    action
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **type** | [**string**] |  | (optional) defaults to undefined|
| **action** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **myAccountApiV1PointAccountGet**
> any myAccountApiV1PointAccountGet()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

const { status, data } = await apiInstance.myAccountApiV1PointAccountGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **myAccountApiV1PointAccountGet_0**
> any myAccountApiV1PointAccountGet_0()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

const { status, data } = await apiInstance.myAccountApiV1PointAccountGet_0();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **ruleListApiV1PointRuleListGet**
> any ruleListApiV1PointRuleListGet()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let type: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.ruleListApiV1PointRuleListGet(
    type
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **type** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **ruleListApiV1PointRuleListGet_0**
> any ruleListApiV1PointRuleListGet_0()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let type: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.ruleListApiV1PointRuleListGet_0(
    type
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **type** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **signinApiV1PointSigninPost**
> any signinApiV1PointSigninPost()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

const { status, data } = await apiInstance.signinApiV1PointSigninPost();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **signinApiV1PointSigninPost_0**
> any signinApiV1PointSigninPost_0()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

const { status, data } = await apiInstance.signinApiV1PointSigninPost_0();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **triggerApiV1PointTriggerPost**
> any triggerApiV1PointTriggerPost()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let action: string; //行为code (default to undefined)
let description: string; // (optional) (default to undefined)
let refId: string; // (optional) (default to undefined)
let refType: string; // (optional) (default to undefined)
let userId: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.triggerApiV1PointTriggerPost(
    action,
    description,
    refId,
    refType,
    userId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **action** | [**string**] | 行为code | defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **refId** | [**string**] |  | (optional) defaults to undefined|
| **refType** | [**string**] |  | (optional) defaults to undefined|
| **userId** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **triggerApiV1PointTriggerPost_0**
> any triggerApiV1PointTriggerPost_0()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let action: string; //行为code (default to undefined)
let description: string; // (optional) (default to undefined)
let refId: string; // (optional) (default to undefined)
let refType: string; // (optional) (default to undefined)
let userId: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.triggerApiV1PointTriggerPost_0(
    action,
    description,
    refId,
    refType,
    userId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **action** | [**string**] | 行为code | defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **refId** | [**string**] |  | (optional) defaults to undefined|
| **refType** | [**string**] |  | (optional) defaults to undefined|
| **userId** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateGoodsApiV1PointGoodsGidPut**
> any updateGoodsApiV1PointGoodsGidPut()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let gid: number; // (default to undefined)
let name: string; // (optional) (default to undefined)
let description: string; // (optional) (default to undefined)
let pointCost: number; // (optional) (default to undefined)
let stock: number; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateGoodsApiV1PointGoodsGidPut(
    gid,
    name,
    description,
    pointCost,
    stock,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **gid** | [**number**] |  | defaults to undefined|
| **name** | [**string**] |  | (optional) defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **pointCost** | [**number**] |  | (optional) defaults to undefined|
| **stock** | [**number**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateGoodsApiV1PointGoodsGidPut_0**
> any updateGoodsApiV1PointGoodsGidPut_0()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let gid: number; // (default to undefined)
let name: string; // (optional) (default to undefined)
let description: string; // (optional) (default to undefined)
let pointCost: number; // (optional) (default to undefined)
let stock: number; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateGoodsApiV1PointGoodsGidPut_0(
    gid,
    name,
    description,
    pointCost,
    stock,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **gid** | [**number**] |  | defaults to undefined|
| **name** | [**string**] |  | (optional) defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **pointCost** | [**number**] |  | (optional) defaults to undefined|
| **stock** | [**number**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateRuleApiV1PointRuleRidPut**
> any updateRuleApiV1PointRuleRidPut()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let rid: number; // (default to undefined)
let name: string; // (optional) (default to undefined)
let point: number; // (optional) (default to undefined)
let maxPerDay: number; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateRuleApiV1PointRuleRidPut(
    rid,
    name,
    point,
    maxPerDay,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **rid** | [**number**] |  | defaults to undefined|
| **name** | [**string**] |  | (optional) defaults to undefined|
| **point** | [**number**] |  | (optional) defaults to undefined|
| **maxPerDay** | [**number**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateRuleApiV1PointRuleRidPut_0**
> any updateRuleApiV1PointRuleRidPut_0()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let rid: number; // (default to undefined)
let name: string; // (optional) (default to undefined)
let point: number; // (optional) (default to undefined)
let maxPerDay: number; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateRuleApiV1PointRuleRidPut_0(
    rid,
    name,
    point,
    maxPerDay,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **rid** | [**number**] |  | defaults to undefined|
| **name** | [**string**] |  | (optional) defaults to undefined|
| **point** | [**number**] |  | (optional) defaults to undefined|
| **maxPerDay** | [**number**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **userAccountApiV1PointAccountUserIdGet**
> any userAccountApiV1PointAccountUserIdGet()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let userId: string; // (default to undefined)

const { status, data } = await apiInstance.userAccountApiV1PointAccountUserIdGet(
    userId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userId** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **userAccountApiV1PointAccountUserIdGet_0**
> any userAccountApiV1PointAccountUserIdGet_0()


### Example

```typescript
import {
    PointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PointApi(configuration);

let userId: string; // (default to undefined)

const { status, data } = await apiInstance.userAccountApiV1PointAccountUserIdGet_0(
    userId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userId** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

