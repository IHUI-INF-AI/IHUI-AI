# AskCategoryApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**addCategoryApiV1AskCategoryPost**](#addcategoryapiv1askcategorypost) | **POST** /api/v1/ask/category | 添加分类|
|[**askCategoryAdminList**](#askcategoryadminlist) | **GET** /api/v1/ask/category/admin/list | 分类列表(管理员)|
|[**changeShowApiV1AskCategoryIsShowPut**](#changeshowapiv1askcategoryisshowput) | **PUT** /api/v1/ask/category/is-show | 修改显示状态|
|[**changeShowIndexApiV1AskCategoryIsShowIndexPut**](#changeshowindexapiv1askcategoryisshowindexput) | **PUT** /api/v1/ask/category/is-show-index | 修改首页显示状态|
|[**deleteCategoryApiV1AskCategoryCatIdDelete**](#deletecategoryapiv1askcategorycatiddelete) | **DELETE** /api/v1/ask/category/{cat_id} | 删除分类|
|[**getCategoryApiV1AskCategoryCatIdGet**](#getcategoryapiv1askcategorycatidget) | **GET** /api/v1/ask/category/{cat_id} | 分类详情|
|[**publicListApiV1AskCategoryPublicApiListGet**](#publiclistapiv1askcategorypublicapilistget) | **GET** /api/v1/ask/category/public-api/list | 分类列表(公开)|
|[**updateCategoryApiV1AskCategoryPut**](#updatecategoryapiv1askcategoryput) | **PUT** /api/v1/ask/category | 修改分类|

# **addCategoryApiV1AskCategoryPost**
> any addCategoryApiV1AskCategoryPost(categoryCreate)


### Example

```typescript
import {
    AskCategoryApi,
    Configuration,
    CategoryCreate
} from './api';

const configuration = new Configuration();
const apiInstance = new AskCategoryApi(configuration);

let categoryCreate: CategoryCreate; //

const { status, data } = await apiInstance.addCategoryApiV1AskCategoryPost(
    categoryCreate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **categoryCreate** | **CategoryCreate**|  | |


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

# **askCategoryAdminList**
> any askCategoryAdminList()


### Example

```typescript
import {
    AskCategoryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskCategoryApi(configuration);

let isShow: boolean; // (optional) (default to undefined)
let isShowIndex: boolean; // (optional) (default to undefined)

const { status, data } = await apiInstance.askCategoryAdminList(
    isShow,
    isShowIndex
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **isShow** | [**boolean**] |  | (optional) defaults to undefined|
| **isShowIndex** | [**boolean**] |  | (optional) defaults to undefined|


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

# **changeShowApiV1AskCategoryIsShowPut**
> any changeShowApiV1AskCategoryIsShowPut()


### Example

```typescript
import {
    AskCategoryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskCategoryApi(configuration);

let id: number; // (default to undefined)
let isShow: boolean; // (default to undefined)

const { status, data } = await apiInstance.changeShowApiV1AskCategoryIsShowPut(
    id,
    isShow
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|
| **isShow** | [**boolean**] |  | defaults to undefined|


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

# **changeShowIndexApiV1AskCategoryIsShowIndexPut**
> any changeShowIndexApiV1AskCategoryIsShowIndexPut()


### Example

```typescript
import {
    AskCategoryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskCategoryApi(configuration);

let id: number; // (default to undefined)
let isShowIndex: boolean; // (default to undefined)

const { status, data } = await apiInstance.changeShowIndexApiV1AskCategoryIsShowIndexPut(
    id,
    isShowIndex
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|
| **isShowIndex** | [**boolean**] |  | defaults to undefined|


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

# **deleteCategoryApiV1AskCategoryCatIdDelete**
> any deleteCategoryApiV1AskCategoryCatIdDelete()


### Example

```typescript
import {
    AskCategoryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskCategoryApi(configuration);

let catId: number; // (default to undefined)

const { status, data } = await apiInstance.deleteCategoryApiV1AskCategoryCatIdDelete(
    catId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **catId** | [**number**] |  | defaults to undefined|


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

# **getCategoryApiV1AskCategoryCatIdGet**
> any getCategoryApiV1AskCategoryCatIdGet()


### Example

```typescript
import {
    AskCategoryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskCategoryApi(configuration);

let catId: number; // (default to undefined)

const { status, data } = await apiInstance.getCategoryApiV1AskCategoryCatIdGet(
    catId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **catId** | [**number**] |  | defaults to undefined|


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

# **publicListApiV1AskCategoryPublicApiListGet**
> any publicListApiV1AskCategoryPublicApiListGet()


### Example

```typescript
import {
    AskCategoryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskCategoryApi(configuration);

let isShow: boolean; // (optional) (default to undefined)
let isShowIndex: boolean; // (optional) (default to undefined)

const { status, data } = await apiInstance.publicListApiV1AskCategoryPublicApiListGet(
    isShow,
    isShowIndex
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **isShow** | [**boolean**] |  | (optional) defaults to undefined|
| **isShowIndex** | [**boolean**] |  | (optional) defaults to undefined|


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

# **updateCategoryApiV1AskCategoryPut**
> any updateCategoryApiV1AskCategoryPut(categoryUpdate)


### Example

```typescript
import {
    AskCategoryApi,
    Configuration,
    CategoryUpdate
} from './api';

const configuration = new Configuration();
const apiInstance = new AskCategoryApi(configuration);

let categoryUpdate: CategoryUpdate; //

const { status, data } = await apiInstance.updateCategoryApiV1AskCategoryPut(
    categoryUpdate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **categoryUpdate** | **CategoryUpdate**|  | |


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

