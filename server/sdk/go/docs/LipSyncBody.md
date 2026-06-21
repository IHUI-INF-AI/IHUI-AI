# LipSyncBody

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**UserUuid** | **string** |  | 
**SessionId** | Pointer to **NullableString** | From /video/identify; if absent, video_id/video_url required | [optional] 
**VideoId** | Pointer to **NullableString** |  | [optional] 
**VideoUrl** | Pointer to **NullableString** |  | [optional] 
**FaceChoose** | **interface{}** |  | 
**ExternalTaskId** | Pointer to **NullableString** |  | [optional] 
**CallbackUrl** | Pointer to **NullableString** |  | [optional] 
**ChatId** | Pointer to **string** |  | [optional] [default to ""]

## Methods

### NewLipSyncBody

`func NewLipSyncBody(userUuid string, faceChoose interface{}, ) *LipSyncBody`

NewLipSyncBody instantiates a new LipSyncBody object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewLipSyncBodyWithDefaults

`func NewLipSyncBodyWithDefaults() *LipSyncBody`

NewLipSyncBodyWithDefaults instantiates a new LipSyncBody object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetUserUuid

`func (o *LipSyncBody) GetUserUuid() string`

GetUserUuid returns the UserUuid field if non-nil, zero value otherwise.

### GetUserUuidOk

`func (o *LipSyncBody) GetUserUuidOk() (*string, bool)`

GetUserUuidOk returns a tuple with the UserUuid field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUserUuid

`func (o *LipSyncBody) SetUserUuid(v string)`

SetUserUuid sets UserUuid field to given value.


### GetSessionId

`func (o *LipSyncBody) GetSessionId() string`

GetSessionId returns the SessionId field if non-nil, zero value otherwise.

### GetSessionIdOk

`func (o *LipSyncBody) GetSessionIdOk() (*string, bool)`

GetSessionIdOk returns a tuple with the SessionId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSessionId

`func (o *LipSyncBody) SetSessionId(v string)`

SetSessionId sets SessionId field to given value.

### HasSessionId

`func (o *LipSyncBody) HasSessionId() bool`

HasSessionId returns a boolean if a field has been set.

### SetSessionIdNil

`func (o *LipSyncBody) SetSessionIdNil(b bool)`

 SetSessionIdNil sets the value for SessionId to be an explicit nil

### UnsetSessionId
`func (o *LipSyncBody) UnsetSessionId()`

UnsetSessionId ensures that no value is present for SessionId, not even an explicit nil
### GetVideoId

`func (o *LipSyncBody) GetVideoId() string`

GetVideoId returns the VideoId field if non-nil, zero value otherwise.

### GetVideoIdOk

`func (o *LipSyncBody) GetVideoIdOk() (*string, bool)`

GetVideoIdOk returns a tuple with the VideoId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetVideoId

`func (o *LipSyncBody) SetVideoId(v string)`

SetVideoId sets VideoId field to given value.

### HasVideoId

`func (o *LipSyncBody) HasVideoId() bool`

HasVideoId returns a boolean if a field has been set.

### SetVideoIdNil

`func (o *LipSyncBody) SetVideoIdNil(b bool)`

 SetVideoIdNil sets the value for VideoId to be an explicit nil

### UnsetVideoId
`func (o *LipSyncBody) UnsetVideoId()`

UnsetVideoId ensures that no value is present for VideoId, not even an explicit nil
### GetVideoUrl

`func (o *LipSyncBody) GetVideoUrl() string`

GetVideoUrl returns the VideoUrl field if non-nil, zero value otherwise.

### GetVideoUrlOk

`func (o *LipSyncBody) GetVideoUrlOk() (*string, bool)`

GetVideoUrlOk returns a tuple with the VideoUrl field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetVideoUrl

`func (o *LipSyncBody) SetVideoUrl(v string)`

SetVideoUrl sets VideoUrl field to given value.

### HasVideoUrl

`func (o *LipSyncBody) HasVideoUrl() bool`

HasVideoUrl returns a boolean if a field has been set.

### SetVideoUrlNil

`func (o *LipSyncBody) SetVideoUrlNil(b bool)`

 SetVideoUrlNil sets the value for VideoUrl to be an explicit nil

### UnsetVideoUrl
`func (o *LipSyncBody) UnsetVideoUrl()`

UnsetVideoUrl ensures that no value is present for VideoUrl, not even an explicit nil
### GetFaceChoose

`func (o *LipSyncBody) GetFaceChoose() interface{}`

GetFaceChoose returns the FaceChoose field if non-nil, zero value otherwise.

### GetFaceChooseOk

`func (o *LipSyncBody) GetFaceChooseOk() (*interface{}, bool)`

GetFaceChooseOk returns a tuple with the FaceChoose field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetFaceChoose

`func (o *LipSyncBody) SetFaceChoose(v interface{})`

SetFaceChoose sets FaceChoose field to given value.


### SetFaceChooseNil

`func (o *LipSyncBody) SetFaceChooseNil(b bool)`

 SetFaceChooseNil sets the value for FaceChoose to be an explicit nil

### UnsetFaceChoose
`func (o *LipSyncBody) UnsetFaceChoose()`

UnsetFaceChoose ensures that no value is present for FaceChoose, not even an explicit nil
### GetExternalTaskId

`func (o *LipSyncBody) GetExternalTaskId() string`

GetExternalTaskId returns the ExternalTaskId field if non-nil, zero value otherwise.

### GetExternalTaskIdOk

`func (o *LipSyncBody) GetExternalTaskIdOk() (*string, bool)`

GetExternalTaskIdOk returns a tuple with the ExternalTaskId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetExternalTaskId

`func (o *LipSyncBody) SetExternalTaskId(v string)`

SetExternalTaskId sets ExternalTaskId field to given value.

### HasExternalTaskId

`func (o *LipSyncBody) HasExternalTaskId() bool`

HasExternalTaskId returns a boolean if a field has been set.

### SetExternalTaskIdNil

`func (o *LipSyncBody) SetExternalTaskIdNil(b bool)`

 SetExternalTaskIdNil sets the value for ExternalTaskId to be an explicit nil

### UnsetExternalTaskId
`func (o *LipSyncBody) UnsetExternalTaskId()`

UnsetExternalTaskId ensures that no value is present for ExternalTaskId, not even an explicit nil
### GetCallbackUrl

`func (o *LipSyncBody) GetCallbackUrl() string`

GetCallbackUrl returns the CallbackUrl field if non-nil, zero value otherwise.

### GetCallbackUrlOk

`func (o *LipSyncBody) GetCallbackUrlOk() (*string, bool)`

GetCallbackUrlOk returns a tuple with the CallbackUrl field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCallbackUrl

`func (o *LipSyncBody) SetCallbackUrl(v string)`

SetCallbackUrl sets CallbackUrl field to given value.

### HasCallbackUrl

`func (o *LipSyncBody) HasCallbackUrl() bool`

HasCallbackUrl returns a boolean if a field has been set.

### SetCallbackUrlNil

`func (o *LipSyncBody) SetCallbackUrlNil(b bool)`

 SetCallbackUrlNil sets the value for CallbackUrl to be an explicit nil

### UnsetCallbackUrl
`func (o *LipSyncBody) UnsetCallbackUrl()`

UnsetCallbackUrl ensures that no value is present for CallbackUrl, not even an explicit nil
### GetChatId

`func (o *LipSyncBody) GetChatId() string`

GetChatId returns the ChatId field if non-nil, zero value otherwise.

### GetChatIdOk

`func (o *LipSyncBody) GetChatIdOk() (*string, bool)`

GetChatIdOk returns a tuple with the ChatId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetChatId

`func (o *LipSyncBody) SetChatId(v string)`

SetChatId sets ChatId field to given value.

### HasChatId

`func (o *LipSyncBody) HasChatId() bool`

HasChatId returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


