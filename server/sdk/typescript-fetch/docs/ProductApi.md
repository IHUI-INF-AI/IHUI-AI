# ProductApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createProductApiV1ZhsProductPost**](ProductApi.md#createproductapiv1zhsproductpost) | **POST** /api/v1/zhs_product | Create product |
| [**deleteProductsApiV1ZhsProductItemIdsDelete**](ProductApi.md#deleteproductsapiv1zhsproductitemidsdelete) | **DELETE** /api/v1/zhs_product/{item_ids} | Delete products |
| [**getProductApiV1ZhsProductItemIdGet**](ProductApi.md#getproductapiv1zhsproductitemidget) | **GET** /api/v1/zhs_product/{item_id} | Get product detail |
| [**listProductsApiV1ZhsProductListGet**](ProductApi.md#listproductsapiv1zhsproductlistget) | **GET** /api/v1/zhs_product/list | List products |
| [**updateProductApiV1ZhsProductPut**](ProductApi.md#updateproductapiv1zhsproductput) | **PUT** /api/v1/zhs_product | Update product |



## createProductApiV1ZhsProductPost

> any createProductApiV1ZhsProductPost(productCreate)

Create product

### Example

```ts
import {
  Configuration,
  ProductApi,
} from '';
import type { CreateProductApiV1ZhsProductPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProductApi();

  const body = {
    // ProductCreate
    productCreate: ...,
  } satisfies CreateProductApiV1ZhsProductPostRequest;

  try {
    const data = await api.createProductApiV1ZhsProductPost(body);
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
| **productCreate** | [ProductCreate](ProductCreate.md) |  | |

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


## deleteProductsApiV1ZhsProductItemIdsDelete

> any deleteProductsApiV1ZhsProductItemIdsDelete(itemIds)

Delete products

### Example

```ts
import {
  Configuration,
  ProductApi,
} from '';
import type { DeleteProductsApiV1ZhsProductItemIdsDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProductApi();

  const body = {
    // string
    itemIds: itemIds_example,
  } satisfies DeleteProductsApiV1ZhsProductItemIdsDeleteRequest;

  try {
    const data = await api.deleteProductsApiV1ZhsProductItemIdsDelete(body);
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


## getProductApiV1ZhsProductItemIdGet

> any getProductApiV1ZhsProductItemIdGet(itemId)

Get product detail

### Example

```ts
import {
  Configuration,
  ProductApi,
} from '';
import type { GetProductApiV1ZhsProductItemIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProductApi();

  const body = {
    // string
    itemId: itemId_example,
  } satisfies GetProductApiV1ZhsProductItemIdGetRequest;

  try {
    const data = await api.getProductApiV1ZhsProductItemIdGet(body);
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


## listProductsApiV1ZhsProductListGet

> any listProductsApiV1ZhsProductListGet(page, limit, name, type, status)

List products

### Example

```ts
import {
  Configuration,
  ProductApi,
} from '';
import type { ListProductsApiV1ZhsProductListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProductApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    name: name_example,
    // string (optional)
    type: type_example,
    // number (optional)
    status: 56,
  } satisfies ListProductsApiV1ZhsProductListGetRequest;

  try {
    const data = await api.listProductsApiV1ZhsProductListGet(body);
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
| **type** | `string` |  | [Optional] [Defaults to `undefined`] |
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


## updateProductApiV1ZhsProductPut

> any updateProductApiV1ZhsProductPut(productUpdate)

Update product

### Example

```ts
import {
  Configuration,
  ProductApi,
} from '';
import type { UpdateProductApiV1ZhsProductPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProductApi();

  const body = {
    // ProductUpdate
    productUpdate: ...,
  } satisfies UpdateProductApiV1ZhsProductPutRequest;

  try {
    const data = await api.updateProductApiV1ZhsProductPut(body);
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
| **productUpdate** | [ProductUpdate](ProductUpdate.md) |  | |

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

