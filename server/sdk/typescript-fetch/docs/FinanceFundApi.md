# FinanceFundApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**agentTransferNotifyApiV1FinanceFundAgentTransferNotifyPost**](FinanceFundApi.md#agenttransfernotifyapiv1financefundagenttransfernotifypost) | **POST** /api/v1/finance/fund/agent/transfer/notify | Agent Transfer Notify |
| [**fileToStreamApiV1FinanceFundFileToStreamPost**](FinanceFundApi.md#filetostreamapiv1financefundfiletostreampost) | **POST** /api/v1/finance/fund/file/to/stream | File To Stream |
| [**fundAppNotifyApiV1FinanceFundAppNotifyPost**](FinanceFundApi.md#fundappnotifyapiv1financefundappnotifypost) | **POST** /api/v1/finance/fund/app/notify | Fund App Notify |
| [**fundNotifyApiV1FinanceFundNotifyPost**](FinanceFundApi.md#fundnotifyapiv1financefundnotifypost) | **POST** /api/v1/finance/fund/notify | Fund Notify |
| [**getInfoApiV1FinanceFundGetInfoGet**](FinanceFundApi.md#getinfoapiv1financefundgetinfoget) | **GET** /api/v1/finance/fund/getInfo | Get Info |
| [**getProductApiV1FinanceFundGetProductGet**](FinanceFundApi.md#getproductapiv1financefundgetproductget) | **GET** /api/v1/finance/fund/getProduct | Get Product |
| [**getStatisticsApiV1FinanceFundGetStatisticsGet**](FinanceFundApi.md#getstatisticsapiv1financefundgetstatisticsget) | **GET** /api/v1/finance/fund/getStatistics | Get Statistics |
| [**useTokenApiV1FinanceFundUseTokenPost**](FinanceFundApi.md#usetokenapiv1financefundusetokenpost) | **POST** /api/v1/finance/fund/useToken | Use Token |



## agentTransferNotifyApiV1FinanceFundAgentTransferNotifyPost

> any agentTransferNotifyApiV1FinanceFundAgentTransferNotifyPost()

Agent Transfer Notify

### Example

```ts
import {
  Configuration,
  FinanceFundApi,
} from '';
import type { AgentTransferNotifyApiV1FinanceFundAgentTransferNotifyPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FinanceFundApi();

  try {
    const data = await api.agentTransferNotifyApiV1FinanceFundAgentTransferNotifyPost();
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


## fileToStreamApiV1FinanceFundFileToStreamPost

> any fileToStreamApiV1FinanceFundFileToStreamPost()

File To Stream

### Example

```ts
import {
  Configuration,
  FinanceFundApi,
} from '';
import type { FileToStreamApiV1FinanceFundFileToStreamPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FinanceFundApi();

  try {
    const data = await api.fileToStreamApiV1FinanceFundFileToStreamPost();
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


## fundAppNotifyApiV1FinanceFundAppNotifyPost

> any fundAppNotifyApiV1FinanceFundAppNotifyPost()

Fund App Notify

### Example

```ts
import {
  Configuration,
  FinanceFundApi,
} from '';
import type { FundAppNotifyApiV1FinanceFundAppNotifyPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FinanceFundApi();

  try {
    const data = await api.fundAppNotifyApiV1FinanceFundAppNotifyPost();
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


## fundNotifyApiV1FinanceFundNotifyPost

> any fundNotifyApiV1FinanceFundNotifyPost()

Fund Notify

### Example

```ts
import {
  Configuration,
  FinanceFundApi,
} from '';
import type { FundNotifyApiV1FinanceFundNotifyPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FinanceFundApi();

  try {
    const data = await api.fundNotifyApiV1FinanceFundNotifyPost();
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


## getInfoApiV1FinanceFundGetInfoGet

> any getInfoApiV1FinanceFundGetInfoGet(token)

Get Info

### Example

```ts
import {
  Configuration,
  FinanceFundApi,
} from '';
import type { GetInfoApiV1FinanceFundGetInfoGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FinanceFundApi();

  const body = {
    // string | user uuid
    token: token_example,
  } satisfies GetInfoApiV1FinanceFundGetInfoGetRequest;

  try {
    const data = await api.getInfoApiV1FinanceFundGetInfoGet(body);
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
| **token** | `string` | user uuid | [Defaults to `undefined`] |

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


## getProductApiV1FinanceFundGetProductGet

> any getProductApiV1FinanceFundGetProductGet()

Get Product

### Example

```ts
import {
  Configuration,
  FinanceFundApi,
} from '';
import type { GetProductApiV1FinanceFundGetProductGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FinanceFundApi();

  try {
    const data = await api.getProductApiV1FinanceFundGetProductGet();
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


## getStatisticsApiV1FinanceFundGetStatisticsGet

> any getStatisticsApiV1FinanceFundGetStatisticsGet()

Get Statistics

### Example

```ts
import {
  Configuration,
  FinanceFundApi,
} from '';
import type { GetStatisticsApiV1FinanceFundGetStatisticsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FinanceFundApi();

  try {
    const data = await api.getStatisticsApiV1FinanceFundGetStatisticsGet();
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


## useTokenApiV1FinanceFundUseTokenPost

> any useTokenApiV1FinanceFundUseTokenPost(platform)

Use Token

### Example

```ts
import {
  Configuration,
  FinanceFundApi,
} from '';
import type { UseTokenApiV1FinanceFundUseTokenPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FinanceFundApi();

  const body = {
    // string (optional)
    platform: platform_example,
  } satisfies UseTokenApiV1FinanceFundUseTokenPostRequest;

  try {
    const data = await api.useTokenApiV1FinanceFundUseTokenPost(body);
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
| **platform** | `string` |  | [Optional] [Defaults to `&#39;WEB&#39;`] |

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

