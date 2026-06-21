# \AgentCreationAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**GetCreationByShareCodeApiV1AgentsShareThirdCodeGet**](AgentCreationAPI.md#GetCreationByShareCodeApiV1AgentsShareThirdCodeGet) | **Get** /api/v1/agents/share/third/{code} | 通过分享码获取创作
[**MyCreationsApiV1AgentsMyTypePost**](AgentCreationAPI.md#MyCreationsApiV1AgentsMyTypePost) | **Post** /api/v1/agents/my/{type} | 我的创作列表
[**OperateCreationApiV1AgentsOperateGcIdTypeGet**](AgentCreationAPI.md#OperateCreationApiV1AgentsOperateGcIdTypeGet) | **Get** /api/v1/agents/operate/{gc_id}/{type} | 点赞/收藏操作
[**ShareCreationApiV1AgentsSharePost**](AgentCreationAPI.md#ShareCreationApiV1AgentsSharePost) | **Post** /api/v1/agents/share | 分享创作（生成分享码）
[**ShareGenerateImageApiV1AgentsShareImagePost**](AgentCreationAPI.md#ShareGenerateImageApiV1AgentsShareImagePost) | **Post** /api/v1/agents/share/image | 分享生成图片
[**ShareToCodeApiV1AgentsShareCodePost**](AgentCreationAPI.md#ShareToCodeApiV1AgentsShareCodePost) | **Post** /api/v1/agents/share/code | 分享转CODE



## GetCreationByShareCodeApiV1AgentsShareThirdCodeGet

> interface{} GetCreationByShareCodeApiV1AgentsShareThirdCodeGet(ctx, code).Execute()

通过分享码获取创作



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
	code := "code_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentCreationAPI.GetCreationByShareCodeApiV1AgentsShareThirdCodeGet(context.Background(), code).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentCreationAPI.GetCreationByShareCodeApiV1AgentsShareThirdCodeGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetCreationByShareCodeApiV1AgentsShareThirdCodeGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentCreationAPI.GetCreationByShareCodeApiV1AgentsShareThirdCodeGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**code** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetCreationByShareCodeApiV1AgentsShareThirdCodeGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## MyCreationsApiV1AgentsMyTypePost

> interface{} MyCreationsApiV1AgentsMyTypePost(ctx, type_).Page(page).Limit(limit).Execute()

我的创作列表



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
	type_ := "type__example" // string | 
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentCreationAPI.MyCreationsApiV1AgentsMyTypePost(context.Background(), type_).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentCreationAPI.MyCreationsApiV1AgentsMyTypePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MyCreationsApiV1AgentsMyTypePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentCreationAPI.MyCreationsApiV1AgentsMyTypePost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**type_** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiMyCreationsApiV1AgentsMyTypePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]

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


## OperateCreationApiV1AgentsOperateGcIdTypeGet

> interface{} OperateCreationApiV1AgentsOperateGcIdTypeGet(ctx, gcId, type_).Execute()

点赞/收藏操作



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
	gcId := "gcId_example" // string | 
	type_ := "type__example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentCreationAPI.OperateCreationApiV1AgentsOperateGcIdTypeGet(context.Background(), gcId, type_).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentCreationAPI.OperateCreationApiV1AgentsOperateGcIdTypeGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `OperateCreationApiV1AgentsOperateGcIdTypeGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentCreationAPI.OperateCreationApiV1AgentsOperateGcIdTypeGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**gcId** | **string** |  | 
**type_** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiOperateCreationApiV1AgentsOperateGcIdTypeGetRequest struct via the builder pattern


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


## ShareCreationApiV1AgentsSharePost

> interface{} ShareCreationApiV1AgentsSharePost(ctx).GcId(gcId).Execute()

分享创作（生成分享码）



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
	gcId := "gcId_example" // string | 创作ID

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentCreationAPI.ShareCreationApiV1AgentsSharePost(context.Background()).GcId(gcId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentCreationAPI.ShareCreationApiV1AgentsSharePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ShareCreationApiV1AgentsSharePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentCreationAPI.ShareCreationApiV1AgentsSharePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiShareCreationApiV1AgentsSharePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **gcId** | **string** | 创作ID | 

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


## ShareGenerateImageApiV1AgentsShareImagePost

> interface{} ShareGenerateImageApiV1AgentsShareImagePost(ctx).GcId(gcId).Width(width).Height(height).Execute()

分享生成图片



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
	gcId := "gcId_example" // string | 创作ID
	width := int32(56) // int32 | 图片宽度 (optional) (default to 800)
	height := int32(56) // int32 | 图片高度 (optional) (default to 600)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentCreationAPI.ShareGenerateImageApiV1AgentsShareImagePost(context.Background()).GcId(gcId).Width(width).Height(height).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentCreationAPI.ShareGenerateImageApiV1AgentsShareImagePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ShareGenerateImageApiV1AgentsShareImagePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentCreationAPI.ShareGenerateImageApiV1AgentsShareImagePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiShareGenerateImageApiV1AgentsShareImagePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **gcId** | **string** | 创作ID | 
 **width** | **int32** | 图片宽度 | [default to 800]
 **height** | **int32** | 图片高度 | [default to 600]

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


## ShareToCodeApiV1AgentsShareCodePost

> interface{} ShareToCodeApiV1AgentsShareCodePost(ctx).GcId(gcId).Execute()

分享转CODE



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
	gcId := "gcId_example" // string | 创作ID

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentCreationAPI.ShareToCodeApiV1AgentsShareCodePost(context.Background()).GcId(gcId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentCreationAPI.ShareToCodeApiV1AgentsShareCodePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ShareToCodeApiV1AgentsShareCodePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentCreationAPI.ShareToCodeApiV1AgentsShareCodePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiShareToCodeApiV1AgentsShareCodePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **gcId** | **string** | 创作ID | 

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

