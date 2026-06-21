# \ContentCMSAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateBannerApiV1ContentCmsBannerCreatePost**](ContentCMSAPI.md#CreateBannerApiV1ContentCmsBannerCreatePost) | **Post** /api/v1/content/cms/banner/create | Create banner (admin only)
[**CreateNewsApiV1ContentCmsNewsCreatePost**](ContentCMSAPI.md#CreateNewsApiV1ContentCmsNewsCreatePost) | **Post** /api/v1/content/cms/news/create | Create news (admin only)
[**CreateNoticeApiV1ContentCmsNoticeCreatePost**](ContentCMSAPI.md#CreateNoticeApiV1ContentCmsNoticeCreatePost) | **Post** /api/v1/content/cms/notice/create | Create system notice (admin only)
[**DeleteBannerApiV1ContentCmsBannerDeletePost**](ContentCMSAPI.md#DeleteBannerApiV1ContentCmsBannerDeletePost) | **Post** /api/v1/content/cms/banner/delete | Delete banner (admin only)
[**DeleteNewsApiV1ContentCmsNewsDeletePost**](ContentCMSAPI.md#DeleteNewsApiV1ContentCmsNewsDeletePost) | **Post** /api/v1/content/cms/news/delete | Delete news (admin only)
[**DeleteNoticeApiV1ContentCmsNoticeDeletePost**](ContentCMSAPI.md#DeleteNoticeApiV1ContentCmsNoticeDeletePost) | **Post** /api/v1/content/cms/notice/delete | Delete notice (admin only)
[**ListBannersApiV1ContentCmsBannerListGet**](ContentCMSAPI.md#ListBannersApiV1ContentCmsBannerListGet) | **Get** /api/v1/content/cms/banner/list | Banner list (public)
[**ListNewsApiV1ContentCmsNewsListGet**](ContentCMSAPI.md#ListNewsApiV1ContentCmsNewsListGet) | **Get** /api/v1/content/cms/news/list | News list (public)
[**ListNoticesApiV1ContentCmsNoticeListGet**](ContentCMSAPI.md#ListNoticesApiV1ContentCmsNoticeListGet) | **Get** /api/v1/content/cms/notice/list | System notice list (public)
[**ListPopularApiV1ContentCmsPopularListGet**](ContentCMSAPI.md#ListPopularApiV1ContentCmsPopularListGet) | **Get** /api/v1/content/cms/popular/list | Popular recommendations (public)
[**UpdateBannerApiV1ContentCmsBannerUpdateBannerIdPut**](ContentCMSAPI.md#UpdateBannerApiV1ContentCmsBannerUpdateBannerIdPut) | **Put** /api/v1/content/cms/banner/update/{banner_id} | Update banner (admin only)
[**UpdateNewsApiV1ContentCmsNewsUpdateNewsIdPut**](ContentCMSAPI.md#UpdateNewsApiV1ContentCmsNewsUpdateNewsIdPut) | **Put** /api/v1/content/cms/news/update/{news_id} | Update news (admin only)
[**UpdateNoticeApiV1ContentCmsNoticeUpdateNoticeIdPut**](ContentCMSAPI.md#UpdateNoticeApiV1ContentCmsNoticeUpdateNoticeIdPut) | **Put** /api/v1/content/cms/notice/update/{notice_id} | Update notice (admin only)



## CreateBannerApiV1ContentCmsBannerCreatePost

> interface{} CreateBannerApiV1ContentCmsBannerCreatePost(ctx).Title(title).Image(image).Url(url).Sort(sort).Authorization(authorization).Execute()

Create banner (admin only)



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
	title := "title_example" // string | Banner title
	image := "image_example" // string | Banner image URL
	url := "url_example" // string | Banner link URL (optional) (default to "")
	sort := int32(56) // int32 | Sort order (optional) (default to 0)
	authorization := "authorization_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentCMSAPI.CreateBannerApiV1ContentCmsBannerCreatePost(context.Background()).Title(title).Image(image).Url(url).Sort(sort).Authorization(authorization).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentCMSAPI.CreateBannerApiV1ContentCmsBannerCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateBannerApiV1ContentCmsBannerCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentCMSAPI.CreateBannerApiV1ContentCmsBannerCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateBannerApiV1ContentCmsBannerCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **string** | Banner title | 
 **image** | **string** | Banner image URL | 
 **url** | **string** | Banner link URL | [default to &quot;&quot;]
 **sort** | **int32** | Sort order | [default to 0]
 **authorization** | **string** |  | 

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


## CreateNewsApiV1ContentCmsNewsCreatePost

> interface{} CreateNewsApiV1ContentCmsNewsCreatePost(ctx).Title(title).Content(content).Image(image).Authorization(authorization).Execute()

Create news (admin only)



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
	title := "title_example" // string | News title
	content := "content_example" // string | News content (HTML supported)
	image := "image_example" // string | Cover image URL (optional) (default to "")
	authorization := "authorization_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentCMSAPI.CreateNewsApiV1ContentCmsNewsCreatePost(context.Background()).Title(title).Content(content).Image(image).Authorization(authorization).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentCMSAPI.CreateNewsApiV1ContentCmsNewsCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateNewsApiV1ContentCmsNewsCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentCMSAPI.CreateNewsApiV1ContentCmsNewsCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateNewsApiV1ContentCmsNewsCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **string** | News title | 
 **content** | **string** | News content (HTML supported) | 
 **image** | **string** | Cover image URL | [default to &quot;&quot;]
 **authorization** | **string** |  | 

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


## CreateNoticeApiV1ContentCmsNoticeCreatePost

> interface{} CreateNoticeApiV1ContentCmsNoticeCreatePost(ctx).NoticeTitle(noticeTitle).NoticeType(noticeType).NoticeContent(noticeContent).Authorization(authorization).Execute()

Create system notice (admin only)



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
	noticeTitle := "noticeTitle_example" // string | Notice title
	noticeType := "noticeType_example" // string | 1=notification, 2=announcement (optional) (default to "1")
	noticeContent := "noticeContent_example" // string | Notice content (optional) (default to "")
	authorization := "authorization_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentCMSAPI.CreateNoticeApiV1ContentCmsNoticeCreatePost(context.Background()).NoticeTitle(noticeTitle).NoticeType(noticeType).NoticeContent(noticeContent).Authorization(authorization).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentCMSAPI.CreateNoticeApiV1ContentCmsNoticeCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateNoticeApiV1ContentCmsNoticeCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentCMSAPI.CreateNoticeApiV1ContentCmsNoticeCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateNoticeApiV1ContentCmsNoticeCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **noticeTitle** | **string** | Notice title | 
 **noticeType** | **string** | 1&#x3D;notification, 2&#x3D;announcement | [default to &quot;1&quot;]
 **noticeContent** | **string** | Notice content | [default to &quot;&quot;]
 **authorization** | **string** |  | 

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


## DeleteBannerApiV1ContentCmsBannerDeletePost

> interface{} DeleteBannerApiV1ContentCmsBannerDeletePost(ctx).BannerId(bannerId).Authorization(authorization).Execute()

Delete banner (admin only)



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
	bannerId := int32(56) // int32 | Banner ID to delete
	authorization := "authorization_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentCMSAPI.DeleteBannerApiV1ContentCmsBannerDeletePost(context.Background()).BannerId(bannerId).Authorization(authorization).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentCMSAPI.DeleteBannerApiV1ContentCmsBannerDeletePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteBannerApiV1ContentCmsBannerDeletePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentCMSAPI.DeleteBannerApiV1ContentCmsBannerDeletePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDeleteBannerApiV1ContentCmsBannerDeletePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bannerId** | **int32** | Banner ID to delete | 
 **authorization** | **string** |  | 

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


## DeleteNewsApiV1ContentCmsNewsDeletePost

> interface{} DeleteNewsApiV1ContentCmsNewsDeletePost(ctx).NewsId(newsId).Authorization(authorization).Execute()

Delete news (admin only)



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
	newsId := int32(56) // int32 | News ID to delete
	authorization := "authorization_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentCMSAPI.DeleteNewsApiV1ContentCmsNewsDeletePost(context.Background()).NewsId(newsId).Authorization(authorization).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentCMSAPI.DeleteNewsApiV1ContentCmsNewsDeletePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteNewsApiV1ContentCmsNewsDeletePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentCMSAPI.DeleteNewsApiV1ContentCmsNewsDeletePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDeleteNewsApiV1ContentCmsNewsDeletePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **newsId** | **int32** | News ID to delete | 
 **authorization** | **string** |  | 

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


## DeleteNoticeApiV1ContentCmsNoticeDeletePost

> interface{} DeleteNoticeApiV1ContentCmsNoticeDeletePost(ctx).NoticeId(noticeId).Authorization(authorization).Execute()

Delete notice (admin only)



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
	noticeId := int32(56) // int32 | Notice ID to delete
	authorization := "authorization_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentCMSAPI.DeleteNoticeApiV1ContentCmsNoticeDeletePost(context.Background()).NoticeId(noticeId).Authorization(authorization).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentCMSAPI.DeleteNoticeApiV1ContentCmsNoticeDeletePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteNoticeApiV1ContentCmsNoticeDeletePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentCMSAPI.DeleteNoticeApiV1ContentCmsNoticeDeletePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDeleteNoticeApiV1ContentCmsNoticeDeletePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **noticeId** | **int32** | Notice ID to delete | 
 **authorization** | **string** |  | 

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


## ListBannersApiV1ContentCmsBannerListGet

> interface{} ListBannersApiV1ContentCmsBannerListGet(ctx).Page(page).Limit(limit).Status(status).Execute()

Banner list (public)



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
	limit := int32(56) // int32 |  (optional) (default to 10)
	status := int32(56) // int32 | 0=disabled, 1=enabled (optional) (default to 1)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentCMSAPI.ListBannersApiV1ContentCmsBannerListGet(context.Background()).Page(page).Limit(limit).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentCMSAPI.ListBannersApiV1ContentCmsBannerListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListBannersApiV1ContentCmsBannerListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentCMSAPI.ListBannersApiV1ContentCmsBannerListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListBannersApiV1ContentCmsBannerListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 10]
 **status** | **int32** | 0&#x3D;disabled, 1&#x3D;enabled | [default to 1]

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


## ListNewsApiV1ContentCmsNewsListGet

> interface{} ListNewsApiV1ContentCmsNewsListGet(ctx).Page(page).Limit(limit).UserUuid(userUuid).Execute()

News list (public)



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
	userUuid := "userUuid_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentCMSAPI.ListNewsApiV1ContentCmsNewsListGet(context.Background()).Page(page).Limit(limit).UserUuid(userUuid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentCMSAPI.ListNewsApiV1ContentCmsNewsListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListNewsApiV1ContentCmsNewsListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentCMSAPI.ListNewsApiV1ContentCmsNewsListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListNewsApiV1ContentCmsNewsListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **userUuid** | **string** |  | 

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


## ListNoticesApiV1ContentCmsNoticeListGet

> interface{} ListNoticesApiV1ContentCmsNoticeListGet(ctx).Page(page).Limit(limit).UserUuid(userUuid).Execute()

System notice list (public)



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
	userUuid := "userUuid_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentCMSAPI.ListNoticesApiV1ContentCmsNoticeListGet(context.Background()).Page(page).Limit(limit).UserUuid(userUuid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentCMSAPI.ListNoticesApiV1ContentCmsNoticeListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListNoticesApiV1ContentCmsNoticeListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentCMSAPI.ListNoticesApiV1ContentCmsNoticeListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListNoticesApiV1ContentCmsNoticeListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **userUuid** | **string** |  | 

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


## ListPopularApiV1ContentCmsPopularListGet

> interface{} ListPopularApiV1ContentCmsPopularListGet(ctx).Page(page).Limit(limit).Execute()

Popular recommendations (public)



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
	resp, r, err := apiClient.ContentCMSAPI.ListPopularApiV1ContentCmsPopularListGet(context.Background()).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentCMSAPI.ListPopularApiV1ContentCmsPopularListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListPopularApiV1ContentCmsPopularListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentCMSAPI.ListPopularApiV1ContentCmsPopularListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListPopularApiV1ContentCmsPopularListGetRequest struct via the builder pattern


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


## UpdateBannerApiV1ContentCmsBannerUpdateBannerIdPut

> interface{} UpdateBannerApiV1ContentCmsBannerUpdateBannerIdPut(ctx, bannerId).Title(title).Image(image).Url(url).Sort(sort).IsActive(isActive).Authorization(authorization).Execute()

Update banner (admin only)



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
	bannerId := int32(56) // int32 | 
	title := "title_example" // string |  (optional)
	image := "image_example" // string |  (optional)
	url := "url_example" // string |  (optional)
	sort := int32(56) // int32 |  (optional)
	isActive := int32(56) // int32 |  (optional)
	authorization := "authorization_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentCMSAPI.UpdateBannerApiV1ContentCmsBannerUpdateBannerIdPut(context.Background(), bannerId).Title(title).Image(image).Url(url).Sort(sort).IsActive(isActive).Authorization(authorization).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentCMSAPI.UpdateBannerApiV1ContentCmsBannerUpdateBannerIdPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateBannerApiV1ContentCmsBannerUpdateBannerIdPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentCMSAPI.UpdateBannerApiV1ContentCmsBannerUpdateBannerIdPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**bannerId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateBannerApiV1ContentCmsBannerUpdateBannerIdPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **title** | **string** |  | 
 **image** | **string** |  | 
 **url** | **string** |  | 
 **sort** | **int32** |  | 
 **isActive** | **int32** |  | 
 **authorization** | **string** |  | 

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


## UpdateNewsApiV1ContentCmsNewsUpdateNewsIdPut

> interface{} UpdateNewsApiV1ContentCmsNewsUpdateNewsIdPut(ctx, newsId).Title(title).Content(content).Image(image).IsActive(isActive).Authorization(authorization).Execute()

Update news (admin only)



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
	title := "title_example" // string |  (optional)
	content := "content_example" // string |  (optional)
	image := "image_example" // string |  (optional)
	isActive := int32(56) // int32 |  (optional)
	authorization := "authorization_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentCMSAPI.UpdateNewsApiV1ContentCmsNewsUpdateNewsIdPut(context.Background(), newsId).Title(title).Content(content).Image(image).IsActive(isActive).Authorization(authorization).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentCMSAPI.UpdateNewsApiV1ContentCmsNewsUpdateNewsIdPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateNewsApiV1ContentCmsNewsUpdateNewsIdPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentCMSAPI.UpdateNewsApiV1ContentCmsNewsUpdateNewsIdPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**newsId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateNewsApiV1ContentCmsNewsUpdateNewsIdPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **title** | **string** |  | 
 **content** | **string** |  | 
 **image** | **string** |  | 
 **isActive** | **int32** |  | 
 **authorization** | **string** |  | 

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


## UpdateNoticeApiV1ContentCmsNoticeUpdateNoticeIdPut

> interface{} UpdateNoticeApiV1ContentCmsNoticeUpdateNoticeIdPut(ctx, noticeId).NoticeTitle(noticeTitle).NoticeType(noticeType).NoticeContent(noticeContent).Status(status).Authorization(authorization).Execute()

Update notice (admin only)



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
	noticeId := int32(56) // int32 | 
	noticeTitle := "noticeTitle_example" // string |  (optional)
	noticeType := "noticeType_example" // string |  (optional)
	noticeContent := "noticeContent_example" // string |  (optional)
	status := "status_example" // string |  (optional)
	authorization := "authorization_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentCMSAPI.UpdateNoticeApiV1ContentCmsNoticeUpdateNoticeIdPut(context.Background(), noticeId).NoticeTitle(noticeTitle).NoticeType(noticeType).NoticeContent(noticeContent).Status(status).Authorization(authorization).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentCMSAPI.UpdateNoticeApiV1ContentCmsNoticeUpdateNoticeIdPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateNoticeApiV1ContentCmsNoticeUpdateNoticeIdPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentCMSAPI.UpdateNoticeApiV1ContentCmsNoticeUpdateNoticeIdPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**noticeId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateNoticeApiV1ContentCmsNoticeUpdateNoticeIdPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **noticeTitle** | **string** |  | 
 **noticeType** | **string** |  | 
 **noticeContent** | **string** |  | 
 **status** | **string** |  | 
 **authorization** | **string** |  | 

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

