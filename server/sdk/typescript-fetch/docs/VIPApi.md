# VIPApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**checkVipApiV1UserCheckGet**](VIPApi.md#checkvipapiv1usercheckget) | **GET** /api/v1/user/check | Check current user VIP status |
| [**getMyVipApiV1UserMyGet**](VIPApi.md#getmyvipapiv1usermyget) | **GET** /api/v1/user/my | Get current user VIP info |
| [**getVipLevelDetailApiV1UserLevelVipIdGet**](VIPApi.md#getvipleveldetailapiv1userlevelvipidget) | **GET** /api/v1/user/level/{vip_id} | Get VIP level detail |
| [**getVipLevelsApiV1UserLevelsGet**](VIPApi.md#getviplevelsapiv1userlevelsget) | **GET** /api/v1/user/levels | Get all VIP levels |
| [**subscribeVipApiV1UserSubscribePost**](VIPApi.md#subscribevipapiv1usersubscribepost) | **POST** /api/v1/user/subscribe | Subscribe VIP (create order) |



## checkVipApiV1UserCheckGet

> any checkVipApiV1UserCheckGet()

Check current user VIP status

Quickly check whether the current user is an active VIP and what level.

### Example

```ts
import {
  Configuration,
  VIPApi,
} from '';
import type { CheckVipApiV1UserCheckGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new VIPApi(config);

  try {
    const data = await api.checkVipApiV1UserCheckGet();
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


## getMyVipApiV1UserMyGet

> any getMyVipApiV1UserMyGet()

Get current user VIP info

Return the current user\&#39;s VIP subscription: level, expiration, and benefits.

### Example

```ts
import {
  Configuration,
  VIPApi,
} from '';
import type { GetMyVipApiV1UserMyGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new VIPApi(config);

  try {
    const data = await api.getMyVipApiV1UserMyGet();
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


## getVipLevelDetailApiV1UserLevelVipIdGet

> any getVipLevelDetailApiV1UserLevelVipIdGet(vipId)

Get VIP level detail

Return details of a single VIP level by its ID.

### Example

```ts
import {
  Configuration,
  VIPApi,
} from '';
import type { GetVipLevelDetailApiV1UserLevelVipIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new VIPApi(config);

  const body = {
    // number
    vipId: 56,
  } satisfies GetVipLevelDetailApiV1UserLevelVipIdGetRequest;

  try {
    const data = await api.getVipLevelDetailApiV1UserLevelVipIdGet(body);
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
| **vipId** | `number` |  | [Defaults to `undefined`] |

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


## getVipLevelsApiV1UserLevelsGet

> any getVipLevelsApiV1UserLevelsGet()

Get all VIP levels

Return the list of all active VIP levels.

### Example

```ts
import {
  Configuration,
  VIPApi,
} from '';
import type { GetVipLevelsApiV1UserLevelsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new VIPApi(config);

  try {
    const data = await api.getVipLevelsApiV1UserLevelsGet();
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


## subscribeVipApiV1UserSubscribePost

> any subscribeVipApiV1UserSubscribePost(subscribeRequest)

Subscribe VIP (create order)

Create a new VIP subscription for the current user.  If the user already has an active subscription that hasn\&#39;t expired, the new subscription starts after the existing one ends.

### Example

```ts
import {
  Configuration,
  VIPApi,
} from '';
import type { SubscribeVipApiV1UserSubscribePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new VIPApi(config);

  const body = {
    // SubscribeRequest
    subscribeRequest: ...,
  } satisfies SubscribeVipApiV1UserSubscribePostRequest;

  try {
    const data = await api.subscribeVipApiV1UserSubscribePost(body);
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
| **subscribeRequest** | [SubscribeRequest](SubscribeRequest.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

