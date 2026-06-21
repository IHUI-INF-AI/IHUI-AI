# VIPApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**checkVipApiV1UserCheckGet**](#checkvipapiv1usercheckget) | **GET** /api/v1/user/check | Check current user VIP status|
|[**getMyVipApiV1UserMyGet**](#getmyvipapiv1usermyget) | **GET** /api/v1/user/my | Get current user VIP info|
|[**getVipLevelDetailApiV1UserLevelVipIdGet**](#getvipleveldetailapiv1userlevelvipidget) | **GET** /api/v1/user/level/{vip_id} | Get VIP level detail|
|[**getVipLevelsApiV1UserLevelsGet**](#getviplevelsapiv1userlevelsget) | **GET** /api/v1/user/levels | Get all VIP levels|
|[**subscribeVipApiV1UserSubscribePost**](#subscribevipapiv1usersubscribepost) | **POST** /api/v1/user/subscribe | Subscribe VIP (create order)|

# **checkVipApiV1UserCheckGet**
> any checkVipApiV1UserCheckGet()

Quickly check whether the current user is an active VIP and what level.

### Example

```typescript
import {
    VIPApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VIPApi(configuration);

const { status, data } = await apiInstance.checkVipApiV1UserCheckGet();
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

# **getMyVipApiV1UserMyGet**
> any getMyVipApiV1UserMyGet()

Return the current user\'s VIP subscription: level, expiration, and benefits.

### Example

```typescript
import {
    VIPApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VIPApi(configuration);

const { status, data } = await apiInstance.getMyVipApiV1UserMyGet();
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

# **getVipLevelDetailApiV1UserLevelVipIdGet**
> any getVipLevelDetailApiV1UserLevelVipIdGet()

Return details of a single VIP level by its ID.

### Example

```typescript
import {
    VIPApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VIPApi(configuration);

let vipId: number; // (default to undefined)

const { status, data } = await apiInstance.getVipLevelDetailApiV1UserLevelVipIdGet(
    vipId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **vipId** | [**number**] |  | defaults to undefined|


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

# **getVipLevelsApiV1UserLevelsGet**
> any getVipLevelsApiV1UserLevelsGet()

Return the list of all active VIP levels.

### Example

```typescript
import {
    VIPApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VIPApi(configuration);

const { status, data } = await apiInstance.getVipLevelsApiV1UserLevelsGet();
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

# **subscribeVipApiV1UserSubscribePost**
> any subscribeVipApiV1UserSubscribePost(subscribeRequest)

Create a new VIP subscription for the current user.  If the user already has an active subscription that hasn\'t expired, the new subscription starts after the existing one ends.

### Example

```typescript
import {
    VIPApi,
    Configuration,
    SubscribeRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new VIPApi(configuration);

let subscribeRequest: SubscribeRequest; //

const { status, data } = await apiInstance.subscribeVipApiV1UserSubscribePost(
    subscribeRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **subscribeRequest** | **SubscribeRequest**|  | |


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

