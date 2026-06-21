# ContentActivityApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getActivityApiV1ContentActivityActivityIdGet**](#getactivityapiv1contentactivityactivityidget) | **GET** /api/v1/content/activity/{activity_id} | 活动详情|
|[**listActivitiesApiV1ContentActivityListGet**](#listactivitiesapiv1contentactivitylistget) | **GET** /api/v1/content/activity/list | 活动列表|

# **getActivityApiV1ContentActivityActivityIdGet**
> any getActivityApiV1ContentActivityActivityIdGet()

根据活动 ID 返回详情。

### Example

```typescript
import {
    ContentActivityApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentActivityApi(configuration);

let activityId: string; // (default to undefined)

const { status, data } = await apiInstance.getActivityApiV1ContentActivityActivityIdGet(
    activityId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **activityId** | [**string**] |  | defaults to undefined|


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

# **listActivitiesApiV1ContentActivityListGet**
> any listActivitiesApiV1ContentActivityListGet()

分页返回活动列表，可按 status 筛选。

### Example

```typescript
import {
    ContentActivityApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentActivityApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let status: number; //筛选状态: 0=关闭 1=开启 (optional) (default to undefined)

const { status, data } = await apiInstance.listActivitiesApiV1ContentActivityListGet(
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
| **status** | [**number**] | 筛选状态: 0&#x3D;关闭 1&#x3D;开启 | (optional) defaults to undefined|


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

