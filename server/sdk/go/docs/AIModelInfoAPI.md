# \AIModelInfoAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CompatCreateModelApiV1AiCompatCreatePost**](AIModelInfoAPI.md#CompatCreateModelApiV1AiCompatCreatePost) | **Post** /api/v1/ai/compat/create | [兼容] 新增模型 (前端 aiModelInfo.add)
[**CompatDeleteModelApiV1AiCompatDeleteGet**](AIModelInfoAPI.md#CompatDeleteModelApiV1AiCompatDeleteGet) | **Get** /api/v1/ai/compat/delete | [兼容] 删除模型 (前端 aiModelInfo.delete)
[**CompatUpdateModelApiV1AiCompatUpdatePost**](AIModelInfoAPI.md#CompatUpdateModelApiV1AiCompatUpdatePost) | **Post** /api/v1/ai/compat/update | [兼容] 更新模型 (前端 aiModelInfo.update)
[**CreateModelApiV1AiCreatePost**](AIModelInfoAPI.md#CreateModelApiV1AiCreatePost) | **Post** /api/v1/ai/create | 新增模型
[**DeleteModelApiV1AiModelIdDelete**](AIModelInfoAPI.md#DeleteModelApiV1AiModelIdDelete) | **Delete** /api/v1/ai/{model_id} | 删除AI模型
[**UpdateModelApiV1AiUpdatePost**](AIModelInfoAPI.md#UpdateModelApiV1AiUpdatePost) | **Post** /api/v1/ai/update | 更新模型
[**VendorStatsApiV1AiVendorsGet**](AIModelInfoAPI.md#VendorStatsApiV1AiVendorsGet) | **Get** /api/v1/ai/vendors | 支持的厂商统计



## CompatCreateModelApiV1AiCompatCreatePost

> interface{} CompatCreateModelApiV1AiCompatCreatePost(ctx).Name(name).Source(source).Img(img).Remark(remark).Type_(type_).Creator(creator).Execute()

[兼容] 新增模型 (前端 aiModelInfo.add)

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	name := "name_example" // string | 
	source := "source_example" // string |  (optional) (default to "")
	img := "img_example" // string |  (optional) (default to "")
	remark := "remark_example" // string |  (optional) (default to "")
	type_ := int32(56) // int32 |  (optional)
	creator := "creator_example" // string |  (optional) (default to "")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIModelInfoAPI.CompatCreateModelApiV1AiCompatCreatePost(context.Background()).Name(name).Source(source).Img(img).Remark(remark).Type_(type_).Creator(creator).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIModelInfoAPI.CompatCreateModelApiV1AiCompatCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CompatCreateModelApiV1AiCompatCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIModelInfoAPI.CompatCreateModelApiV1AiCompatCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCompatCreateModelApiV1AiCompatCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **string** |  | 
 **source** | **string** |  | [default to &quot;&quot;]
 **img** | **string** |  | [default to &quot;&quot;]
 **remark** | **string** |  | [default to &quot;&quot;]
 **type_** | **int32** |  | 
 **creator** | **string** |  | [default to &quot;&quot;]

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## CompatDeleteModelApiV1AiCompatDeleteGet

> interface{} CompatDeleteModelApiV1AiCompatDeleteGet(ctx).Id(id).Updator(updator).Execute()

[兼容] 删除模型 (前端 aiModelInfo.delete)



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	id := "id_example" // string | 
	updator := "updator_example" // string |  (optional) (default to "")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIModelInfoAPI.CompatDeleteModelApiV1AiCompatDeleteGet(context.Background()).Id(id).Updator(updator).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIModelInfoAPI.CompatDeleteModelApiV1AiCompatDeleteGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CompatDeleteModelApiV1AiCompatDeleteGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIModelInfoAPI.CompatDeleteModelApiV1AiCompatDeleteGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCompatDeleteModelApiV1AiCompatDeleteGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **string** |  | 
 **updator** | **string** |  | [default to &quot;&quot;]

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## CompatUpdateModelApiV1AiCompatUpdatePost

> interface{} CompatUpdateModelApiV1AiCompatUpdatePost(ctx).Id(id).Name(name).Source(source).Img(img).Remark(remark).Type_(type_).IsDel(isDel).Updator(updator).Execute()

[兼容] 更新模型 (前端 aiModelInfo.update)

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	id := "id_example" // string | 
	name := "name_example" // string |  (optional)
	source := "source_example" // string |  (optional)
	img := "img_example" // string |  (optional)
	remark := "remark_example" // string |  (optional)
	type_ := int32(56) // int32 |  (optional)
	isDel := int32(56) // int32 |  (optional)
	updator := "updator_example" // string |  (optional) (default to "")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIModelInfoAPI.CompatUpdateModelApiV1AiCompatUpdatePost(context.Background()).Id(id).Name(name).Source(source).Img(img).Remark(remark).Type_(type_).IsDel(isDel).Updator(updator).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIModelInfoAPI.CompatUpdateModelApiV1AiCompatUpdatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CompatUpdateModelApiV1AiCompatUpdatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIModelInfoAPI.CompatUpdateModelApiV1AiCompatUpdatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCompatUpdateModelApiV1AiCompatUpdatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **string** |  | 
 **name** | **string** |  | 
 **source** | **string** |  | 
 **img** | **string** |  | 
 **remark** | **string** |  | 
 **type_** | **int32** |  | 
 **isDel** | **int32** |  | 
 **updator** | **string** |  | [default to &quot;&quot;]

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## CreateModelApiV1AiCreatePost

> interface{} CreateModelApiV1AiCreatePost(ctx).Vendor(vendor).ModelName(modelName).Description(description).Icon(icon).Execute()

新增模型

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	vendor := "vendor_example" // string | 
	modelName := "modelName_example" // string | 
	description := "description_example" // string |  (optional) (default to "")
	icon := "icon_example" // string |  (optional) (default to "")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIModelInfoAPI.CreateModelApiV1AiCreatePost(context.Background()).Vendor(vendor).ModelName(modelName).Description(description).Icon(icon).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIModelInfoAPI.CreateModelApiV1AiCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateModelApiV1AiCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIModelInfoAPI.CreateModelApiV1AiCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateModelApiV1AiCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **vendor** | **string** |  | 
 **modelName** | **string** |  | 
 **description** | **string** |  | [default to &quot;&quot;]
 **icon** | **string** |  | [default to &quot;&quot;]

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## DeleteModelApiV1AiModelIdDelete

> interface{} DeleteModelApiV1AiModelIdDelete(ctx, modelId).Execute()

删除AI模型



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	modelId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIModelInfoAPI.DeleteModelApiV1AiModelIdDelete(context.Background(), modelId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIModelInfoAPI.DeleteModelApiV1AiModelIdDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteModelApiV1AiModelIdDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIModelInfoAPI.DeleteModelApiV1AiModelIdDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**modelId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteModelApiV1AiModelIdDeleteRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## UpdateModelApiV1AiUpdatePost

> interface{} UpdateModelApiV1AiUpdatePost(ctx).ModelId(modelId).DisplayName(displayName).Status(status).Execute()

更新模型

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	modelId := int32(56) // int32 | 
	displayName := "displayName_example" // string |  (optional)
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIModelInfoAPI.UpdateModelApiV1AiUpdatePost(context.Background()).ModelId(modelId).DisplayName(displayName).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIModelInfoAPI.UpdateModelApiV1AiUpdatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateModelApiV1AiUpdatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIModelInfoAPI.UpdateModelApiV1AiUpdatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateModelApiV1AiUpdatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **modelId** | **int32** |  | 
 **displayName** | **string** |  | 
 **status** | **int32** |  | 

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## VendorStatsApiV1AiVendorsGet

> interface{} VendorStatsApiV1AiVendorsGet(ctx).Execute()

支持的厂商统计

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIModelInfoAPI.VendorStatsApiV1AiVendorsGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIModelInfoAPI.VendorStatsApiV1AiVendorsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `VendorStatsApiV1AiVendorsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIModelInfoAPI.VendorStatsApiV1AiVendorsGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiVendorStatsApiV1AiVendorsGetRequest struct via the builder pattern


### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

