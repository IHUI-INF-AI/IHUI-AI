# \UserModelChatAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ImageApiV1UserModelChatImagePost**](UserModelChatAPI.md#ImageApiV1UserModelChatImagePost) | **Post** /api/v1/user-model-chat/image | AI模型生图
[**ImageApiV1UserModelChatImagePost_0**](UserModelChatAPI.md#ImageApiV1UserModelChatImagePost_0) | **Post** /api/v1/user-model-chat/image | AI模型生图
[**ListModelsApiV1UserModelChatListGet**](UserModelChatAPI.md#ListModelsApiV1UserModelChatListGet) | **Get** /api/v1/user-model-chat/list | 可用模型列表
[**ListModelsApiV1UserModelChatListGet_0**](UserModelChatAPI.md#ListModelsApiV1UserModelChatListGet_0) | **Get** /api/v1/user-model-chat/list | 可用模型列表
[**UserModelChatChat**](UserModelChatAPI.md#UserModelChatChat) | **Post** /api/v1/user-model-chat/chat | AI模型对话
[**UserModelChatChat_0**](UserModelChatAPI.md#UserModelChatChat_0) | **Post** /api/v1/user-model-chat/chat | AI模型对话



## ImageApiV1UserModelChatImagePost

> interface{} ImageApiV1UserModelChatImagePost(ctx).BodyImageApiV1UserModelChatImagePost(bodyImageApiV1UserModelChatImagePost).ApiKey(apiKey).ApiBase(apiBase).Execute()

AI模型生图

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
	bodyImageApiV1UserModelChatImagePost := *openapiclient.NewBodyImageApiV1UserModelChatImagePost("Prompt_example") // BodyImageApiV1UserModelChatImagePost | 
	apiKey := "apiKey_example" // string |  (optional)
	apiBase := "apiBase_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserModelChatAPI.ImageApiV1UserModelChatImagePost(context.Background()).BodyImageApiV1UserModelChatImagePost(bodyImageApiV1UserModelChatImagePost).ApiKey(apiKey).ApiBase(apiBase).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserModelChatAPI.ImageApiV1UserModelChatImagePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ImageApiV1UserModelChatImagePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserModelChatAPI.ImageApiV1UserModelChatImagePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiImageApiV1UserModelChatImagePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyImageApiV1UserModelChatImagePost** | [**BodyImageApiV1UserModelChatImagePost**](BodyImageApiV1UserModelChatImagePost.md) |  | 
 **apiKey** | **string** |  | 
 **apiBase** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ImageApiV1UserModelChatImagePost_0

> interface{} ImageApiV1UserModelChatImagePost_0(ctx).BodyImageApiV1UserModelChatImagePost(bodyImageApiV1UserModelChatImagePost).ApiKey(apiKey).ApiBase(apiBase).Execute()

AI模型生图

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
	bodyImageApiV1UserModelChatImagePost := *openapiclient.NewBodyImageApiV1UserModelChatImagePost("Prompt_example") // BodyImageApiV1UserModelChatImagePost | 
	apiKey := "apiKey_example" // string |  (optional)
	apiBase := "apiBase_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserModelChatAPI.ImageApiV1UserModelChatImagePost_0(context.Background()).BodyImageApiV1UserModelChatImagePost(bodyImageApiV1UserModelChatImagePost).ApiKey(apiKey).ApiBase(apiBase).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserModelChatAPI.ImageApiV1UserModelChatImagePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ImageApiV1UserModelChatImagePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserModelChatAPI.ImageApiV1UserModelChatImagePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiImageApiV1UserModelChatImagePost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyImageApiV1UserModelChatImagePost** | [**BodyImageApiV1UserModelChatImagePost**](BodyImageApiV1UserModelChatImagePost.md) |  | 
 **apiKey** | **string** |  | 
 **apiBase** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListModelsApiV1UserModelChatListGet

> interface{} ListModelsApiV1UserModelChatListGet(ctx).Execute()

可用模型列表



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
	resp, r, err := apiClient.UserModelChatAPI.ListModelsApiV1UserModelChatListGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserModelChatAPI.ListModelsApiV1UserModelChatListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListModelsApiV1UserModelChatListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserModelChatAPI.ListModelsApiV1UserModelChatListGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiListModelsApiV1UserModelChatListGetRequest struct via the builder pattern


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


## ListModelsApiV1UserModelChatListGet_0

> interface{} ListModelsApiV1UserModelChatListGet_0(ctx).Execute()

可用模型列表



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
	resp, r, err := apiClient.UserModelChatAPI.ListModelsApiV1UserModelChatListGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserModelChatAPI.ListModelsApiV1UserModelChatListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListModelsApiV1UserModelChatListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserModelChatAPI.ListModelsApiV1UserModelChatListGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiListModelsApiV1UserModelChatListGet_2Request struct via the builder pattern


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


## UserModelChatChat

> interface{} UserModelChatChat(ctx).BodyUserModelChatChat(bodyUserModelChatChat).ApiKey(apiKey).ApiBase(apiBase).Execute()

AI模型对话



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
	bodyUserModelChatChat := *openapiclient.NewBodyUserModelChatChat([]interface{}{nil}) // BodyUserModelChatChat | 
	apiKey := "apiKey_example" // string |  (optional)
	apiBase := "apiBase_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserModelChatAPI.UserModelChatChat(context.Background()).BodyUserModelChatChat(bodyUserModelChatChat).ApiKey(apiKey).ApiBase(apiBase).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserModelChatAPI.UserModelChatChat``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UserModelChatChat`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserModelChatAPI.UserModelChatChat`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUserModelChatChatRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyUserModelChatChat** | [**BodyUserModelChatChat**](BodyUserModelChatChat.md) |  | 
 **apiKey** | **string** |  | 
 **apiBase** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## UserModelChatChat_0

> interface{} UserModelChatChat_0(ctx).BodyUserModelChatChat(bodyUserModelChatChat).ApiKey(apiKey).ApiBase(apiBase).Execute()

AI模型对话



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
	bodyUserModelChatChat := *openapiclient.NewBodyUserModelChatChat([]interface{}{nil}) // BodyUserModelChatChat | 
	apiKey := "apiKey_example" // string |  (optional)
	apiBase := "apiBase_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserModelChatAPI.UserModelChatChat_0(context.Background()).BodyUserModelChatChat(bodyUserModelChatChat).ApiKey(apiKey).ApiBase(apiBase).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserModelChatAPI.UserModelChatChat_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UserModelChatChat_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserModelChatAPI.UserModelChatChat_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUserModelChatChat_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyUserModelChatChat** | [**BodyUserModelChatChat**](BodyUserModelChatChat.md) |  | 
 **apiKey** | **string** |  | 
 **apiBase** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

