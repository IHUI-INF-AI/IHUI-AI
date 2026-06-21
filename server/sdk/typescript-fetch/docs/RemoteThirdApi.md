# RemoteThirdApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**thirdGroupListApiV1RemoteThirdGroupListGet**](RemoteThirdApi.md#thirdgrouplistapiv1remotethirdgrouplistget) | **GET** /api/v1/remote/third/group/list | Third Group List |
| [**thirdGroupListApiV1RemoteThirdGroupListGet_0**](RemoteThirdApi.md#thirdgrouplistapiv1remotethirdgrouplistget_0) | **GET** /api/v1/remote/third/group/list | Third Group List |



## thirdGroupListApiV1RemoteThirdGroupListGet

> any thirdGroupListApiV1RemoteThirdGroupListGet()

Third Group List

对应 Java: GET /remote/third/group/list — 不同榜单数据 (按 group 分组的排行).

### Example

```ts
import {
  Configuration,
  RemoteThirdApi,
} from '';
import type { ThirdGroupListApiV1RemoteThirdGroupListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RemoteThirdApi();

  try {
    const data = await api.thirdGroupListApiV1RemoteThirdGroupListGet();
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

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## thirdGroupListApiV1RemoteThirdGroupListGet_0

> any thirdGroupListApiV1RemoteThirdGroupListGet_0()

Third Group List

对应 Java: GET /remote/third/group/list — 不同榜单数据 (按 group 分组的排行).

### Example

```ts
import {
  Configuration,
  RemoteThirdApi,
} from '';
import type { ThirdGroupListApiV1RemoteThirdGroupListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RemoteThirdApi();

  try {
    const data = await api.thirdGroupListApiV1RemoteThirdGroupListGet_0();
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

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

