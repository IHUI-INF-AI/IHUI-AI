# \ContentAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateVersionApiV1ContentVersionCreatePost**](ContentAPI.md#CreateVersionApiV1ContentVersionCreatePost) | **Post** /api/v1/content/version/create | 创建 App 版本
[**DeleteFeedbackApiV1ContentFeedbackDeleteDelete**](ContentAPI.md#DeleteFeedbackApiV1ContentFeedbackDeleteDelete) | **Delete** /api/v1/content/feedback/delete | 删除反馈
[**DeleteVersionApiV1ContentVersionDeleteDelete**](ContentAPI.md#DeleteVersionApiV1ContentVersionDeleteDelete) | **Delete** /api/v1/content/version/delete | 删除 App 版本
[**GetAboutApiV1ContentAboutGet**](ContentAPI.md#GetAboutApiV1ContentAboutGet) | **Get** /api/v1/content/about | Get about us
[**GetContactApiV1ContentContactGet**](ContentAPI.md#GetContactApiV1ContentContactGet) | **Get** /api/v1/content/contact | 获取联系信息
[**GetNewsApiV1ContentNewsNewsIdGet**](ContentAPI.md#GetNewsApiV1ContentNewsNewsIdGet) | **Get** /api/v1/content/news/{news_id} | Get news detail
[**GetVersionApiV1ContentVersionGet**](ContentAPI.md#GetVersionApiV1ContentVersionGet) | **Get** /api/v1/content/version | Get latest app version
[**ListBannersApiV1ContentBannersGet**](ContentAPI.md#ListBannersApiV1ContentBannersGet) | **Get** /api/v1/content/banners | List banners
[**ListFeedbacksApiV1ContentFeedbackListGet**](ContentAPI.md#ListFeedbacksApiV1ContentFeedbackListGet) | **Get** /api/v1/content/feedback/list | 反馈列表
[**ListNewsApiV1ContentNewsGet**](ContentAPI.md#ListNewsApiV1ContentNewsGet) | **Get** /api/v1/content/news | List news
[**ListVersionsApiV1ContentVersionListGet**](ContentAPI.md#ListVersionsApiV1ContentVersionListGet) | **Get** /api/v1/content/version/list | App 版本列表
[**SubmitFeedbackApiV1ContentFeedbackPost**](ContentAPI.md#SubmitFeedbackApiV1ContentFeedbackPost) | **Post** /api/v1/content/feedback | Submit feedback
[**UpdateFeedbackApiV1ContentFeedbackUpdatePut**](ContentAPI.md#UpdateFeedbackApiV1ContentFeedbackUpdatePut) | **Put** /api/v1/content/feedback/update | 更新/回复反馈
[**UpdateVersionApiV1ContentVersionUpdatePut**](ContentAPI.md#UpdateVersionApiV1ContentVersionUpdatePut) | **Put** /api/v1/content/version/update | 更新 App 版本



## CreateVersionApiV1ContentVersionCreatePost

> interface{} CreateVersionApiV1ContentVersionCreatePost(ctx).VersionCode(versionCode).VersionName(versionName).DownloadUrl(downloadUrl).Description(description).Platform(platform).ForceUpdate(forceUpdate).Execute()

创建 App 版本

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
	versionCode := "versionCode_example" // string | 
	versionName := "versionName_example" // string | 
	downloadUrl := "downloadUrl_example" // string | 
	description := "description_example" // string |  (optional) (default to "")
	platform := "platform_example" // string |  (optional) (default to "android")
	forceUpdate := int32(56) // int32 | 0=否 1=是 (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentAPI.CreateVersionApiV1ContentVersionCreatePost(context.Background()).VersionCode(versionCode).VersionName(versionName).DownloadUrl(downloadUrl).Description(description).Platform(platform).ForceUpdate(forceUpdate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentAPI.CreateVersionApiV1ContentVersionCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateVersionApiV1ContentVersionCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentAPI.CreateVersionApiV1ContentVersionCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateVersionApiV1ContentVersionCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **versionCode** | **string** |  | 
 **versionName** | **string** |  | 
 **downloadUrl** | **string** |  | 
 **description** | **string** |  | [default to &quot;&quot;]
 **platform** | **string** |  | [default to &quot;android&quot;]
 **forceUpdate** | **int32** | 0&#x3D;否 1&#x3D;是 | [default to 0]

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


## DeleteFeedbackApiV1ContentFeedbackDeleteDelete

> interface{} DeleteFeedbackApiV1ContentFeedbackDeleteDelete(ctx).FeedbackId(feedbackId).Execute()

删除反馈

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
	feedbackId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentAPI.DeleteFeedbackApiV1ContentFeedbackDeleteDelete(context.Background()).FeedbackId(feedbackId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentAPI.DeleteFeedbackApiV1ContentFeedbackDeleteDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteFeedbackApiV1ContentFeedbackDeleteDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentAPI.DeleteFeedbackApiV1ContentFeedbackDeleteDelete`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDeleteFeedbackApiV1ContentFeedbackDeleteDeleteRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **feedbackId** | **int32** |  | 

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


## DeleteVersionApiV1ContentVersionDeleteDelete

> interface{} DeleteVersionApiV1ContentVersionDeleteDelete(ctx).VersionId(versionId).Execute()

删除 App 版本

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
	versionId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentAPI.DeleteVersionApiV1ContentVersionDeleteDelete(context.Background()).VersionId(versionId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentAPI.DeleteVersionApiV1ContentVersionDeleteDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteVersionApiV1ContentVersionDeleteDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentAPI.DeleteVersionApiV1ContentVersionDeleteDelete`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDeleteVersionApiV1ContentVersionDeleteDeleteRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **versionId** | **int32** |  | 

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


## GetAboutApiV1ContentAboutGet

> interface{} GetAboutApiV1ContentAboutGet(ctx).Execute()

Get about us

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
	resp, r, err := apiClient.ContentAPI.GetAboutApiV1ContentAboutGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentAPI.GetAboutApiV1ContentAboutGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetAboutApiV1ContentAboutGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentAPI.GetAboutApiV1ContentAboutGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetAboutApiV1ContentAboutGetRequest struct via the builder pattern


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


## GetContactApiV1ContentContactGet

> interface{} GetContactApiV1ContentContactGet(ctx).Execute()

获取联系信息



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
	resp, r, err := apiClient.ContentAPI.GetContactApiV1ContentContactGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentAPI.GetContactApiV1ContentContactGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetContactApiV1ContentContactGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentAPI.GetContactApiV1ContentContactGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetContactApiV1ContentContactGetRequest struct via the builder pattern


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


## GetNewsApiV1ContentNewsNewsIdGet

> interface{} GetNewsApiV1ContentNewsNewsIdGet(ctx, newsId).Execute()

Get news detail

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
	newsId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentAPI.GetNewsApiV1ContentNewsNewsIdGet(context.Background(), newsId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentAPI.GetNewsApiV1ContentNewsNewsIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetNewsApiV1ContentNewsNewsIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentAPI.GetNewsApiV1ContentNewsNewsIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**newsId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetNewsApiV1ContentNewsNewsIdGetRequest struct via the builder pattern


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


## GetVersionApiV1ContentVersionGet

> interface{} GetVersionApiV1ContentVersionGet(ctx).Platform(platform).Execute()

Get latest app version

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
	platform := "platform_example" // string |  (optional) (default to "android")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentAPI.GetVersionApiV1ContentVersionGet(context.Background()).Platform(platform).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentAPI.GetVersionApiV1ContentVersionGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetVersionApiV1ContentVersionGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentAPI.GetVersionApiV1ContentVersionGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGetVersionApiV1ContentVersionGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **platform** | **string** |  | [default to &quot;android&quot;]

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


## ListBannersApiV1ContentBannersGet

> interface{} ListBannersApiV1ContentBannersGet(ctx).Position(position).Execute()

List banners

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
	position := "position_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentAPI.ListBannersApiV1ContentBannersGet(context.Background()).Position(position).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentAPI.ListBannersApiV1ContentBannersGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListBannersApiV1ContentBannersGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentAPI.ListBannersApiV1ContentBannersGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListBannersApiV1ContentBannersGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **position** | **string** |  | 

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


## ListFeedbacksApiV1ContentFeedbackListGet

> interface{} ListFeedbacksApiV1ContentFeedbackListGet(ctx).Page(page).Limit(limit).Status(status).Execute()

反馈列表

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
	limit := int32(56) // int32 |  (optional) (default to 20)
	status := int32(56) // int32 | 筛选状态: 0=未处理 1=已处理 (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentAPI.ListFeedbacksApiV1ContentFeedbackListGet(context.Background()).Page(page).Limit(limit).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentAPI.ListFeedbacksApiV1ContentFeedbackListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListFeedbacksApiV1ContentFeedbackListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentAPI.ListFeedbacksApiV1ContentFeedbackListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListFeedbacksApiV1ContentFeedbackListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **status** | **int32** | 筛选状态: 0&#x3D;未处理 1&#x3D;已处理 | 

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


## ListNewsApiV1ContentNewsGet

> interface{} ListNewsApiV1ContentNewsGet(ctx).Page(page).Limit(limit).Execute()

List news

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
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentAPI.ListNewsApiV1ContentNewsGet(context.Background()).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentAPI.ListNewsApiV1ContentNewsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListNewsApiV1ContentNewsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentAPI.ListNewsApiV1ContentNewsGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListNewsApiV1ContentNewsGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]

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


## ListVersionsApiV1ContentVersionListGet

> interface{} ListVersionsApiV1ContentVersionListGet(ctx).Page(page).Limit(limit).Platform(platform).Execute()

App 版本列表

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
	limit := int32(56) // int32 |  (optional) (default to 20)
	platform := "platform_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentAPI.ListVersionsApiV1ContentVersionListGet(context.Background()).Page(page).Limit(limit).Platform(platform).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentAPI.ListVersionsApiV1ContentVersionListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListVersionsApiV1ContentVersionListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentAPI.ListVersionsApiV1ContentVersionListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListVersionsApiV1ContentVersionListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **platform** | **string** |  | 

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


## SubmitFeedbackApiV1ContentFeedbackPost

> interface{} SubmitFeedbackApiV1ContentFeedbackPost(ctx).Content(content).Images(images).Type_(type_).Execute()

Submit feedback

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
	content := "content_example" // string | 
	images := "images_example" // string |  (optional)
	type_ := "type__example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentAPI.SubmitFeedbackApiV1ContentFeedbackPost(context.Background()).Content(content).Images(images).Type_(type_).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentAPI.SubmitFeedbackApiV1ContentFeedbackPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SubmitFeedbackApiV1ContentFeedbackPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentAPI.SubmitFeedbackApiV1ContentFeedbackPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSubmitFeedbackApiV1ContentFeedbackPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **content** | **string** |  | 
 **images** | **string** |  | 
 **type_** | **string** |  | 

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


## UpdateFeedbackApiV1ContentFeedbackUpdatePut

> interface{} UpdateFeedbackApiV1ContentFeedbackUpdatePut(ctx).FeedbackId(feedbackId).Status(status).Reply(reply).Execute()

更新/回复反馈

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
	feedbackId := int32(56) // int32 | 
	status := int32(56) // int32 |  (optional)
	reply := "reply_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentAPI.UpdateFeedbackApiV1ContentFeedbackUpdatePut(context.Background()).FeedbackId(feedbackId).Status(status).Reply(reply).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentAPI.UpdateFeedbackApiV1ContentFeedbackUpdatePut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateFeedbackApiV1ContentFeedbackUpdatePut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentAPI.UpdateFeedbackApiV1ContentFeedbackUpdatePut`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateFeedbackApiV1ContentFeedbackUpdatePutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **feedbackId** | **int32** |  | 
 **status** | **int32** |  | 
 **reply** | **string** |  | 

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


## UpdateVersionApiV1ContentVersionUpdatePut

> interface{} UpdateVersionApiV1ContentVersionUpdatePut(ctx).VersionId(versionId).VersionCode(versionCode).VersionName(versionName).DownloadUrl(downloadUrl).Description(description).Platform(platform).ForceUpdate(forceUpdate).Status(status).Execute()

更新 App 版本

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
	versionId := int32(56) // int32 | 
	versionCode := "versionCode_example" // string |  (optional)
	versionName := "versionName_example" // string |  (optional)
	downloadUrl := "downloadUrl_example" // string |  (optional)
	description := "description_example" // string |  (optional)
	platform := "platform_example" // string |  (optional)
	forceUpdate := int32(56) // int32 |  (optional)
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentAPI.UpdateVersionApiV1ContentVersionUpdatePut(context.Background()).VersionId(versionId).VersionCode(versionCode).VersionName(versionName).DownloadUrl(downloadUrl).Description(description).Platform(platform).ForceUpdate(forceUpdate).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentAPI.UpdateVersionApiV1ContentVersionUpdatePut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateVersionApiV1ContentVersionUpdatePut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentAPI.UpdateVersionApiV1ContentVersionUpdatePut`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateVersionApiV1ContentVersionUpdatePutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **versionId** | **int32** |  | 
 **versionCode** | **string** |  | 
 **versionName** | **string** |  | 
 **downloadUrl** | **string** |  | 
 **description** | **string** |  | 
 **platform** | **string** |  | 
 **forceUpdate** | **int32** |  | 
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

