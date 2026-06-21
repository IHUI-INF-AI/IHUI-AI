# ContentActivityApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getActivityApiV1ContentActivityActivityIdGet**](ContentActivityApi.md#getactivityapiv1contentactivityactivityidget) | **GET** /api/v1/content/activity/{activity_id} | 活动详情 |
| [**listActivitiesApiV1ContentActivityListGet**](ContentActivityApi.md#listactivitiesapiv1contentactivitylistget) | **GET** /api/v1/content/activity/list | 活动列表 |



## getActivityApiV1ContentActivityActivityIdGet

> any getActivityApiV1ContentActivityActivityIdGet(activityId)

活动详情

根据活动 ID 返回详情。

### Example

```ts
import {
  Configuration,
  ContentActivityApi,
} from '';
import type { GetActivityApiV1ContentActivityActivityIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ContentActivityApi();

  const body = {
    // string
    activityId: activityId_example,
  } satisfies GetActivityApiV1ContentActivityActivityIdGetRequest;

  try {
    const data = await api.getActivityApiV1ContentActivityActivityIdGet(body);
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
| **activityId** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listActivitiesApiV1ContentActivityListGet

> any listActivitiesApiV1ContentActivityListGet(page, limit, status)

活动列表

分页返回活动列表，可按 status 筛选。

### Example

```ts
import {
  Configuration,
  ContentActivityApi,
} from '';
import type { ListActivitiesApiV1ContentActivityListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ContentActivityApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number | 筛选状态: 0=关闭 1=开启 (optional)
    status: 56,
  } satisfies ListActivitiesApiV1ContentActivityListGetRequest;

  try {
    const data = await api.listActivitiesApiV1ContentActivityListGet(body);
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
| **status** | `number` | 筛选状态: 0&#x3D;关闭 1&#x3D;开启 | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

