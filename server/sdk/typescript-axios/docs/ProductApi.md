# ProductApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createProductApiV1ZhsProductPost**](#createproductapiv1zhsproductpost) | **POST** /api/v1/zhs_product | Create product|
|[**deleteProductsApiV1ZhsProductItemIdsDelete**](#deleteproductsapiv1zhsproductitemidsdelete) | **DELETE** /api/v1/zhs_product/{item_ids} | Delete products|
|[**getProductApiV1ZhsProductItemIdGet**](#getproductapiv1zhsproductitemidget) | **GET** /api/v1/zhs_product/{item_id} | Get product detail|
|[**listProductsApiV1ZhsProductListGet**](#listproductsapiv1zhsproductlistget) | **GET** /api/v1/zhs_product/list | List products|
|[**updateProductApiV1ZhsProductPut**](#updateproductapiv1zhsproductput) | **PUT** /api/v1/zhs_product | Update product|

# **createProductApiV1ZhsProductPost**
> any createProductApiV1ZhsProductPost(productCreate)


### Example

```typescript
import {
    ProductApi,
    Configuration,
    ProductCreate
} from './api';

const configuration = new Configuration();
const apiInstance = new ProductApi(configuration);

let productCreate: ProductCreate; //

const { status, data } = await apiInstance.createProductApiV1ZhsProductPost(
    productCreate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **productCreate** | **ProductCreate**|  | |


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

# **deleteProductsApiV1ZhsProductItemIdsDelete**
> any deleteProductsApiV1ZhsProductItemIdsDelete()


### Example

```typescript
import {
    ProductApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ProductApi(configuration);

let itemIds: string; // (default to undefined)

const { status, data } = await apiInstance.deleteProductsApiV1ZhsProductItemIdsDelete(
    itemIds
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **itemIds** | [**string**] |  | defaults to undefined|


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

# **getProductApiV1ZhsProductItemIdGet**
> any getProductApiV1ZhsProductItemIdGet()


### Example

```typescript
import {
    ProductApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ProductApi(configuration);

let itemId: string; // (default to undefined)

const { status, data } = await apiInstance.getProductApiV1ZhsProductItemIdGet(
    itemId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **itemId** | [**string**] |  | defaults to undefined|


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

# **listProductsApiV1ZhsProductListGet**
> any listProductsApiV1ZhsProductListGet()


### Example

```typescript
import {
    ProductApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ProductApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let name: string; // (optional) (default to undefined)
let type: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.listProductsApiV1ZhsProductListGet(
    page,
    limit,
    name,
    type,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **name** | [**string**] |  | (optional) defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to undefined|
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

# **updateProductApiV1ZhsProductPut**
> any updateProductApiV1ZhsProductPut(productUpdate)


### Example

```typescript
import {
    ProductApi,
    Configuration,
    ProductUpdate
} from './api';

const configuration = new Configuration();
const apiInstance = new ProductApi(configuration);

let productUpdate: ProductUpdate; //

const { status, data } = await apiInstance.updateProductApiV1ZhsProductPut(
    productUpdate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **productUpdate** | **ProductUpdate**|  | |


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

