# StockAnalyseApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**stockAnalysePostApiV1CozeZhsApiStockAnalysePost**](#stockanalysepostapiv1cozezhsapistockanalysepost) | **POST** /api/v1/cozeZhsApi/stock/analyse | Stock Analyse Post|
|[**stockAnalysePostApiV1CozeZhsApiStockAnalysePost_0**](#stockanalysepostapiv1cozezhsapistockanalysepost_0) | **POST** /api/v1/cozeZhsApi/stock/analyse | Stock Analyse Post|

# **stockAnalysePostApiV1CozeZhsApiStockAnalysePost**
> any stockAnalysePostApiV1CozeZhsApiStockAnalysePost(stockAnalyseRequest)


### Example

```typescript
import {
    StockAnalyseApi,
    Configuration,
    StockAnalyseRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new StockAnalyseApi(configuration);

let stockAnalyseRequest: StockAnalyseRequest; //

const { status, data } = await apiInstance.stockAnalysePostApiV1CozeZhsApiStockAnalysePost(
    stockAnalyseRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **stockAnalyseRequest** | **StockAnalyseRequest**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **stockAnalysePostApiV1CozeZhsApiStockAnalysePost_0**
> any stockAnalysePostApiV1CozeZhsApiStockAnalysePost_0(stockAnalyseRequest)


### Example

```typescript
import {
    StockAnalyseApi,
    Configuration,
    StockAnalyseRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new StockAnalyseApi(configuration);

let stockAnalyseRequest: StockAnalyseRequest; //

const { status, data } = await apiInstance.stockAnalysePostApiV1CozeZhsApiStockAnalysePost_0(
    stockAnalyseRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **stockAnalyseRequest** | **StockAnalyseRequest**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

