# StockAnalyseApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**stockAnalysePostApiV1CozeZhsApiStockAnalysePost**](StockAnalyseApi.md#stockanalysepostapiv1cozezhsapistockanalysepost) | **POST** /api/v1/cozeZhsApi/stock/analyse | Stock Analyse Post |
| [**stockAnalysePostApiV1CozeZhsApiStockAnalysePost_0**](StockAnalyseApi.md#stockanalysepostapiv1cozezhsapistockanalysepost_0) | **POST** /api/v1/cozeZhsApi/stock/analyse | Stock Analyse Post |



## stockAnalysePostApiV1CozeZhsApiStockAnalysePost

> any stockAnalysePostApiV1CozeZhsApiStockAnalysePost(stockAnalyseRequest)

Stock Analyse Post

### Example

```ts
import {
  Configuration,
  StockAnalyseApi,
} from '';
import type { StockAnalysePostApiV1CozeZhsApiStockAnalysePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new StockAnalyseApi();

  const body = {
    // StockAnalyseRequest
    stockAnalyseRequest: ...,
  } satisfies StockAnalysePostApiV1CozeZhsApiStockAnalysePostRequest;

  try {
    const data = await api.stockAnalysePostApiV1CozeZhsApiStockAnalysePost(body);
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
| **stockAnalyseRequest** | [StockAnalyseRequest](StockAnalyseRequest.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## stockAnalysePostApiV1CozeZhsApiStockAnalysePost_0

> any stockAnalysePostApiV1CozeZhsApiStockAnalysePost_0(stockAnalyseRequest)

Stock Analyse Post

### Example

```ts
import {
  Configuration,
  StockAnalyseApi,
} from '';
import type { StockAnalysePostApiV1CozeZhsApiStockAnalysePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new StockAnalyseApi();

  const body = {
    // StockAnalyseRequest
    stockAnalyseRequest: ...,
  } satisfies StockAnalysePostApiV1CozeZhsApiStockAnalysePost0Request;

  try {
    const data = await api.stockAnalysePostApiV1CozeZhsApiStockAnalysePost_0(body);
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
| **stockAnalyseRequest** | [StockAnalyseRequest](StockAnalyseRequest.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

