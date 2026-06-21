# ProductIdentityApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createProductIdentityApiV1ProductIdentityPost**](#createproductidentityapiv1productidentitypost) | **POST** /api/v1/product_identity | Create product identity|
|[**deleteProductIdentitiesApiV1ProductIdentityItemIdsDelete**](#deleteproductidentitiesapiv1productidentityitemidsdelete) | **DELETE** /api/v1/product_identity/{item_ids} | Delete product identities|
|[**getProductIdentityApiV1ProductIdentityItemIdGet**](#getproductidentityapiv1productidentityitemidget) | **GET** /api/v1/product_identity/{item_id} | Get product identity detail|
|[**listProductIdentitiesApiV1ProductIdentityListGet**](#listproductidentitiesapiv1productidentitylistget) | **GET** /api/v1/product_identity/list | List product identities|
|[**updateProductIdentityApiV1ProductIdentityPut**](#updateproductidentityapiv1productidentityput) | **PUT** /api/v1/product_identity | Update product identity|

# **createProductIdentityApiV1ProductIdentityPost**
> any createProductIdentityApiV1ProductIdentityPost(productIdentityCreate)


### Example

```typescript
import {
    ProductIdentityApi,
    Configuration,
    ProductIdentityCreate
} from './api';

const configuration = new Configuration();
const apiInstance = new ProductIdentityApi(configuration);

let productIdentityCreate: ProductIdentityCreate; //

const { status, data } = await apiInstance.createProductIdentityApiV1ProductIdentityPost(
    productIdentityCreate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **productIdentityCreate** | **ProductIdentityCreate**|  | |


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

# **deleteProductIdentitiesApiV1ProductIdentityItemIdsDelete**
> any deleteProductIdentitiesApiV1ProductIdentityItemIdsDelete()


### Example

```typescript
import {
    ProductIdentityApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ProductIdentityApi(configuration);

let itemIds: string; // (default to undefined)

const { status, data } = await apiInstance.deleteProductIdentitiesApiV1ProductIdentityItemIdsDelete(
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

# **getProductIdentityApiV1ProductIdentityItemIdGet**
> any getProductIdentityApiV1ProductIdentityItemIdGet()


### Example

```typescript
import {
    ProductIdentityApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ProductIdentityApi(configuration);

let itemId: string; // (default to undefined)

const { status, data } = await apiInstance.getProductIdentityApiV1ProductIdentityItemIdGet(
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

# **listProductIdentitiesApiV1ProductIdentityListGet**
> any listProductIdentitiesApiV1ProductIdentityListGet()


### Example

```typescript
import {
    ProductIdentityApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ProductIdentityApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let name: string; // (optional) (default to undefined)
let identityType: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.listProductIdentitiesApiV1ProductIdentityListGet(
    page,
    limit,
    name,
    identityType,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **name** | [**string**] |  | (optional) defaults to undefined|
| **identityType** | [**string**] |  | (optional) defaults to undefined|
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

# **updateProductIdentityApiV1ProductIdentityPut**
> any updateProductIdentityApiV1ProductIdentityPut(productIdentityUpdate)


### Example

```typescript
import {
    ProductIdentityApi,
    Configuration,
    ProductIdentityUpdate
} from './api';

const configuration = new Configuration();
const apiInstance = new ProductIdentityApi(configuration);

let productIdentityUpdate: ProductIdentityUpdate; //

const { status, data } = await apiInstance.updateProductIdentityApiV1ProductIdentityPut(
    productIdentityUpdate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **productIdentityUpdate** | **ProductIdentityUpdate**|  | |


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

