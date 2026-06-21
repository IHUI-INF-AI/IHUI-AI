# ProductIdentityApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createProductIdentityApiV1ProductIdentityPost**](ProductIdentityApi.md#createproductidentityapiv1productidentitypost) | **POST** /api/v1/product_identity | Create product identity |
| [**deleteProductIdentitiesApiV1ProductIdentityItemIdsDelete**](ProductIdentityApi.md#deleteproductidentitiesapiv1productidentityitemidsdelete) | **DELETE** /api/v1/product_identity/{item_ids} | Delete product identities |
| [**getProductIdentityApiV1ProductIdentityItemIdGet**](ProductIdentityApi.md#getproductidentityapiv1productidentityitemidget) | **GET** /api/v1/product_identity/{item_id} | Get product identity detail |
| [**listProductIdentitiesApiV1ProductIdentityListGet**](ProductIdentityApi.md#listproductidentitiesapiv1productidentitylistget) | **GET** /api/v1/product_identity/list | List product identities |
| [**updateProductIdentityApiV1ProductIdentityPut**](ProductIdentityApi.md#updateproductidentityapiv1productidentityput) | **PUT** /api/v1/product_identity | Update product identity |



## createProductIdentityApiV1ProductIdentityPost

> any createProductIdentityApiV1ProductIdentityPost(productIdentityCreate)

Create product identity

### Example

```ts
import {
  Configuration,
  ProductIdentityApi,
} from '';
import type { CreateProductIdentityApiV1ProductIdentityPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProductIdentityApi();

  const body = {
    // ProductIdentityCreate
    productIdentityCreate: ...,
  } satisfies CreateProductIdentityApiV1ProductIdentityPostRequest;

  try {
    const data = await api.createProductIdentityApiV1ProductIdentityPost(body);
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
| **productIdentityCreate** | [ProductIdentityCreate](ProductIdentityCreate.md) |  | |

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


## deleteProductIdentitiesApiV1ProductIdentityItemIdsDelete

> any deleteProductIdentitiesApiV1ProductIdentityItemIdsDelete(itemIds)

Delete product identities

### Example

```ts
import {
  Configuration,
  ProductIdentityApi,
} from '';
import type { DeleteProductIdentitiesApiV1ProductIdentityItemIdsDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProductIdentityApi();

  const body = {
    // string
    itemIds: itemIds_example,
  } satisfies DeleteProductIdentitiesApiV1ProductIdentityItemIdsDeleteRequest;

  try {
    const data = await api.deleteProductIdentitiesApiV1ProductIdentityItemIdsDelete(body);
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
| **itemIds** | `string` |  | [Defaults to `undefined`] |

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


## getProductIdentityApiV1ProductIdentityItemIdGet

> any getProductIdentityApiV1ProductIdentityItemIdGet(itemId)

Get product identity detail

### Example

```ts
import {
  Configuration,
  ProductIdentityApi,
} from '';
import type { GetProductIdentityApiV1ProductIdentityItemIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProductIdentityApi();

  const body = {
    // string
    itemId: itemId_example,
  } satisfies GetProductIdentityApiV1ProductIdentityItemIdGetRequest;

  try {
    const data = await api.getProductIdentityApiV1ProductIdentityItemIdGet(body);
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
| **itemId** | `string` |  | [Defaults to `undefined`] |

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


## listProductIdentitiesApiV1ProductIdentityListGet

> any listProductIdentitiesApiV1ProductIdentityListGet(page, limit, name, identityType, status)

List product identities

### Example

```ts
import {
  Configuration,
  ProductIdentityApi,
} from '';
import type { ListProductIdentitiesApiV1ProductIdentityListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProductIdentityApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    name: name_example,
    // string (optional)
    identityType: identityType_example,
    // number (optional)
    status: 56,
  } satisfies ListProductIdentitiesApiV1ProductIdentityListGetRequest;

  try {
    const data = await api.listProductIdentitiesApiV1ProductIdentityListGet(body);
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
| **name** | `string` |  | [Optional] [Defaults to `undefined`] |
| **identityType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## updateProductIdentityApiV1ProductIdentityPut

> any updateProductIdentityApiV1ProductIdentityPut(productIdentityUpdate)

Update product identity

### Example

```ts
import {
  Configuration,
  ProductIdentityApi,
} from '';
import type { UpdateProductIdentityApiV1ProductIdentityPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProductIdentityApi();

  const body = {
    // ProductIdentityUpdate
    productIdentityUpdate: ...,
  } satisfies UpdateProductIdentityApiV1ProductIdentityPutRequest;

  try {
    const data = await api.updateProductIdentityApiV1ProductIdentityPut(body);
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
| **productIdentityUpdate** | [ProductIdentityUpdate](ProductIdentityUpdate.md) |  | |

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

