# \BotsAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateBotApiV1BotsCreatePost**](BotsAPI.md#CreateBotApiV1BotsCreatePost) | **Post** /api/v1/bots/create | 创建 Bot
[**DeleteBotApiV1BotsDeletePost**](BotsAPI.md#DeleteBotApiV1BotsDeletePost) | **Post** /api/v1/bots/delete | 删除 Bot
[**GetBotApiV1BotsBotIdGet**](BotsAPI.md#GetBotApiV1BotsBotIdGet) | **Get** /api/v1/bots/{bot_id} | Bot 详情
[**ListBotsApiV1BotsListGet**](BotsAPI.md#ListBotsApiV1BotsListGet) | **Get** /api/v1/bots/list | Bot 列表
[**ListDatasetsApiV1BotsDatasetsListGet**](BotsAPI.md#ListDatasetsApiV1BotsDatasetsListGet) | **Get** /api/v1/bots/datasets/list | Bot 关联知识库列表
[**PublishBotApiV1BotsPublishPost**](BotsAPI.md#PublishBotApiV1BotsPublishPost) | **Post** /api/v1/bots/publish | 发布 Bot
[**UpdateBotApiV1BotsUpdatePost**](BotsAPI.md#UpdateBotApiV1BotsUpdatePost) | **Post** /api/v1/bots/update | 更新 Bot



## CreateBotApiV1BotsCreatePost

> interface{} CreateBotApiV1BotsCreatePost(ctx).Name(name).Description(description).Persona(persona).Execute()

创建 Bot

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
	description := "description_example" // string |  (optional) (default to "")
	persona := "persona_example" // string | Bot 人设描述 (optional) (default to "")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.BotsAPI.CreateBotApiV1BotsCreatePost(context.Background()).Name(name).Description(description).Persona(persona).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `BotsAPI.CreateBotApiV1BotsCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateBotApiV1BotsCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `BotsAPI.CreateBotApiV1BotsCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateBotApiV1BotsCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **string** |  | 
 **description** | **string** |  | [default to &quot;&quot;]
 **persona** | **string** | Bot 人设描述 | [default to &quot;&quot;]

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


## DeleteBotApiV1BotsDeletePost

> interface{} DeleteBotApiV1BotsDeletePost(ctx).BotId(botId).Execute()

删除 Bot

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
	botId := "botId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.BotsAPI.DeleteBotApiV1BotsDeletePost(context.Background()).BotId(botId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `BotsAPI.DeleteBotApiV1BotsDeletePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteBotApiV1BotsDeletePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `BotsAPI.DeleteBotApiV1BotsDeletePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDeleteBotApiV1BotsDeletePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **botId** | **string** |  | 

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


## GetBotApiV1BotsBotIdGet

> interface{} GetBotApiV1BotsBotIdGet(ctx, botId).Execute()

Bot 详情

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
	botId := "botId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.BotsAPI.GetBotApiV1BotsBotIdGet(context.Background(), botId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `BotsAPI.GetBotApiV1BotsBotIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetBotApiV1BotsBotIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `BotsAPI.GetBotApiV1BotsBotIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**botId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetBotApiV1BotsBotIdGetRequest struct via the builder pattern


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


## ListBotsApiV1BotsListGet

> interface{} ListBotsApiV1BotsListGet(ctx).Page(page).PageSize(pageSize).SpaceId(spaceId).Execute()

Bot 列表

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
	page := int32(56) // int32 |  (optional) (default to 1)
	pageSize := int32(56) // int32 |  (optional) (default to 20)
	spaceId := "spaceId_example" // string | 空间 ID，默认使用 settings.COZE_ACCOUNT_ID (optional) (default to "")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.BotsAPI.ListBotsApiV1BotsListGet(context.Background()).Page(page).PageSize(pageSize).SpaceId(spaceId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `BotsAPI.ListBotsApiV1BotsListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListBotsApiV1BotsListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `BotsAPI.ListBotsApiV1BotsListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListBotsApiV1BotsListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **pageSize** | **int32** |  | [default to 20]
 **spaceId** | **string** | 空间 ID，默认使用 settings.COZE_ACCOUNT_ID | [default to &quot;&quot;]

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


## ListDatasetsApiV1BotsDatasetsListGet

> interface{} ListDatasetsApiV1BotsDatasetsListGet(ctx).Page(page).PageSize(pageSize).Execute()

Bot 关联知识库列表

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
	page := int32(56) // int32 |  (optional) (default to 1)
	pageSize := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.BotsAPI.ListDatasetsApiV1BotsDatasetsListGet(context.Background()).Page(page).PageSize(pageSize).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `BotsAPI.ListDatasetsApiV1BotsDatasetsListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListDatasetsApiV1BotsDatasetsListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `BotsAPI.ListDatasetsApiV1BotsDatasetsListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListDatasetsApiV1BotsDatasetsListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **pageSize** | **int32** |  | [default to 20]

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


## PublishBotApiV1BotsPublishPost

> interface{} PublishBotApiV1BotsPublishPost(ctx).BotId(botId).Version(version).Execute()

发布 Bot

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
	botId := "botId_example" // string | 
	version := "version_example" // string |  (optional) (default to "")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.BotsAPI.PublishBotApiV1BotsPublishPost(context.Background()).BotId(botId).Version(version).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `BotsAPI.PublishBotApiV1BotsPublishPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PublishBotApiV1BotsPublishPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `BotsAPI.PublishBotApiV1BotsPublishPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPublishBotApiV1BotsPublishPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **botId** | **string** |  | 
 **version** | **string** |  | [default to &quot;&quot;]

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


## UpdateBotApiV1BotsUpdatePost

> interface{} UpdateBotApiV1BotsUpdatePost(ctx).BotId(botId).Name(name).Description(description).Persona(persona).Execute()

更新 Bot

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
	botId := "botId_example" // string | 
	name := "name_example" // string |  (optional)
	description := "description_example" // string |  (optional)
	persona := "persona_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.BotsAPI.UpdateBotApiV1BotsUpdatePost(context.Background()).BotId(botId).Name(name).Description(description).Persona(persona).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `BotsAPI.UpdateBotApiV1BotsUpdatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateBotApiV1BotsUpdatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `BotsAPI.UpdateBotApiV1BotsUpdatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateBotApiV1BotsUpdatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **botId** | **string** |  | 
 **name** | **string** |  | 
 **description** | **string** |  | 
 **persona** | **string** |  | 

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

