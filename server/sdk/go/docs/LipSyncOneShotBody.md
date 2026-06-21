# LipSyncOneShotBody

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**UserUuid** | **string** |  | 
**VideoId** | Pointer to **NullableString** |  | [optional] 
**VideoUrl** | Pointer to **NullableString** |  | [optional] 
**FaceId** | Pointer to **NullableString** |  | [optional] 
**AudioId** | Pointer to **NullableString** |  | [optional] 
**SoundFile** | Pointer to **NullableString** |  | [optional] 
**SoundStartTime** | **int32** |  | 
**SoundEndTime** | **int32** |  | 
**SoundInsertTime** | **int32** |  | 
**SoundVolume** | Pointer to **float32** |  | [optional] [default to 1.0]
**OriginalAudioVolume** | Pointer to **float32** |  | [optional] [default to 1.0]
**ExternalTaskId** | Pointer to **NullableString** |  | [optional] 
**CallbackUrl** | Pointer to **NullableString** |  | [optional] 
**ChatId** | Pointer to **string** |  | [optional] [default to ""]

## Methods

### NewLipSyncOneShotBody

`func NewLipSyncOneShotBody(userUuid string, soundStartTime int32, soundEndTime int32, soundInsertTime int32, ) *LipSyncOneShotBody`

NewLipSyncOneShotBody instantiates a new LipSyncOneShotBody object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewLipSyncOneShotBodyWithDefaults

`func NewLipSyncOneShotBodyWithDefaults() *LipSyncOneShotBody`

NewLipSyncOneShotBodyWithDefaults instantiates a new LipSyncOneShotBody object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetUserUuid

`func (o *LipSyncOneShotBody) GetUserUuid() string`

GetUserUuid returns the UserUuid field if non-nil, zero value otherwise.

### GetUserUuidOk

`func (o *LipSyncOneShotBody) GetUserUuidOk() (*string, bool)`

GetUserUuidOk returns a tuple with the UserUuid field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUserUuid

`func (o *LipSyncOneShotBody) SetUserUuid(v string)`

SetUserUuid sets UserUuid field to given value.


### GetVideoId

`func (o *LipSyncOneShotBody) GetVideoId() string`

GetVideoId returns the VideoId field if non-nil, zero value otherwise.

### GetVideoIdOk

`func (o *LipSyncOneShotBody) GetVideoIdOk() (*string, bool)`

GetVideoIdOk returns a tuple with the VideoId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetVideoId

`func (o *LipSyncOneShotBody) SetVideoId(v string)`

SetVideoId sets VideoId field to given value.

### HasVideoId

`func (o *LipSyncOneShotBody) HasVideoId() bool`

HasVideoId returns a boolean if a field has been set.

### SetVideoIdNil

`func (o *LipSyncOneShotBody) SetVideoIdNil(b bool)`

 SetVideoIdNil sets the value for VideoId to be an explicit nil

### UnsetVideoId
`func (o *LipSyncOneShotBody) UnsetVideoId()`

UnsetVideoId ensures that no value is present for VideoId, not even an explicit nil
### GetVideoUrl

`func (o *LipSyncOneShotBody) GetVideoUrl() string`

GetVideoUrl returns the VideoUrl field if non-nil, zero value otherwise.

### GetVideoUrlOk

`func (o *LipSyncOneShotBody) GetVideoUrlOk() (*string, bool)`

GetVideoUrlOk returns a tuple with the VideoUrl field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetVideoUrl

`func (o *LipSyncOneShotBody) SetVideoUrl(v string)`

SetVideoUrl sets VideoUrl field to given value.

### HasVideoUrl

`func (o *LipSyncOneShotBody) HasVideoUrl() bool`

HasVideoUrl returns a boolean if a field has been set.

### SetVideoUrlNil

`func (o *LipSyncOneShotBody) SetVideoUrlNil(b bool)`

 SetVideoUrlNil sets the value for VideoUrl to be an explicit nil

### UnsetVideoUrl
`func (o *LipSyncOneShotBody) UnsetVideoUrl()`

UnsetVideoUrl ensures that no value is present for VideoUrl, not even an explicit nil
### GetFaceId

`func (o *LipSyncOneShotBody) GetFaceId() string`

GetFaceId returns the FaceId field if non-nil, zero value otherwise.

### GetFaceIdOk

`func (o *LipSyncOneShotBody) GetFaceIdOk() (*string, bool)`

GetFaceIdOk returns a tuple with the FaceId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetFaceId

`func (o *LipSyncOneShotBody) SetFaceId(v string)`

SetFaceId sets FaceId field to given value.

### HasFaceId

`func (o *LipSyncOneShotBody) HasFaceId() bool`

HasFaceId returns a boolean if a field has been set.

### SetFaceIdNil

`func (o *LipSyncOneShotBody) SetFaceIdNil(b bool)`

 SetFaceIdNil sets the value for FaceId to be an explicit nil

### UnsetFaceId
`func (o *LipSyncOneShotBody) UnsetFaceId()`

UnsetFaceId ensures that no value is present for FaceId, not even an explicit nil
### GetAudioId

`func (o *LipSyncOneShotBody) GetAudioId() string`

GetAudioId returns the AudioId field if non-nil, zero value otherwise.

### GetAudioIdOk

`func (o *LipSyncOneShotBody) GetAudioIdOk() (*string, bool)`

GetAudioIdOk returns a tuple with the AudioId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAudioId

`func (o *LipSyncOneShotBody) SetAudioId(v string)`

SetAudioId sets AudioId field to given value.

### HasAudioId

`func (o *LipSyncOneShotBody) HasAudioId() bool`

HasAudioId returns a boolean if a field has been set.

### SetAudioIdNil

`func (o *LipSyncOneShotBody) SetAudioIdNil(b bool)`

 SetAudioIdNil sets the value for AudioId to be an explicit nil

### UnsetAudioId
`func (o *LipSyncOneShotBody) UnsetAudioId()`

UnsetAudioId ensures that no value is present for AudioId, not even an explicit nil
### GetSoundFile

`func (o *LipSyncOneShotBody) GetSoundFile() string`

GetSoundFile returns the SoundFile field if non-nil, zero value otherwise.

### GetSoundFileOk

`func (o *LipSyncOneShotBody) GetSoundFileOk() (*string, bool)`

GetSoundFileOk returns a tuple with the SoundFile field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSoundFile

`func (o *LipSyncOneShotBody) SetSoundFile(v string)`

SetSoundFile sets SoundFile field to given value.

### HasSoundFile

`func (o *LipSyncOneShotBody) HasSoundFile() bool`

HasSoundFile returns a boolean if a field has been set.

### SetSoundFileNil

`func (o *LipSyncOneShotBody) SetSoundFileNil(b bool)`

 SetSoundFileNil sets the value for SoundFile to be an explicit nil

### UnsetSoundFile
`func (o *LipSyncOneShotBody) UnsetSoundFile()`

UnsetSoundFile ensures that no value is present for SoundFile, not even an explicit nil
### GetSoundStartTime

`func (o *LipSyncOneShotBody) GetSoundStartTime() int32`

GetSoundStartTime returns the SoundStartTime field if non-nil, zero value otherwise.

### GetSoundStartTimeOk

`func (o *LipSyncOneShotBody) GetSoundStartTimeOk() (*int32, bool)`

GetSoundStartTimeOk returns a tuple with the SoundStartTime field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSoundStartTime

`func (o *LipSyncOneShotBody) SetSoundStartTime(v int32)`

SetSoundStartTime sets SoundStartTime field to given value.


### GetSoundEndTime

`func (o *LipSyncOneShotBody) GetSoundEndTime() int32`

GetSoundEndTime returns the SoundEndTime field if non-nil, zero value otherwise.

### GetSoundEndTimeOk

`func (o *LipSyncOneShotBody) GetSoundEndTimeOk() (*int32, bool)`

GetSoundEndTimeOk returns a tuple with the SoundEndTime field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSoundEndTime

`func (o *LipSyncOneShotBody) SetSoundEndTime(v int32)`

SetSoundEndTime sets SoundEndTime field to given value.


### GetSoundInsertTime

`func (o *LipSyncOneShotBody) GetSoundInsertTime() int32`

GetSoundInsertTime returns the SoundInsertTime field if non-nil, zero value otherwise.

### GetSoundInsertTimeOk

`func (o *LipSyncOneShotBody) GetSoundInsertTimeOk() (*int32, bool)`

GetSoundInsertTimeOk returns a tuple with the SoundInsertTime field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSoundInsertTime

`func (o *LipSyncOneShotBody) SetSoundInsertTime(v int32)`

SetSoundInsertTime sets SoundInsertTime field to given value.


### GetSoundVolume

`func (o *LipSyncOneShotBody) GetSoundVolume() float32`

GetSoundVolume returns the SoundVolume field if non-nil, zero value otherwise.

### GetSoundVolumeOk

`func (o *LipSyncOneShotBody) GetSoundVolumeOk() (*float32, bool)`

GetSoundVolumeOk returns a tuple with the SoundVolume field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSoundVolume

`func (o *LipSyncOneShotBody) SetSoundVolume(v float32)`

SetSoundVolume sets SoundVolume field to given value.

### HasSoundVolume

`func (o *LipSyncOneShotBody) HasSoundVolume() bool`

HasSoundVolume returns a boolean if a field has been set.

### GetOriginalAudioVolume

`func (o *LipSyncOneShotBody) GetOriginalAudioVolume() float32`

GetOriginalAudioVolume returns the OriginalAudioVolume field if non-nil, zero value otherwise.

### GetOriginalAudioVolumeOk

`func (o *LipSyncOneShotBody) GetOriginalAudioVolumeOk() (*float32, bool)`

GetOriginalAudioVolumeOk returns a tuple with the OriginalAudioVolume field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOriginalAudioVolume

`func (o *LipSyncOneShotBody) SetOriginalAudioVolume(v float32)`

SetOriginalAudioVolume sets OriginalAudioVolume field to given value.

### HasOriginalAudioVolume

`func (o *LipSyncOneShotBody) HasOriginalAudioVolume() bool`

HasOriginalAudioVolume returns a boolean if a field has been set.

### GetExternalTaskId

`func (o *LipSyncOneShotBody) GetExternalTaskId() string`

GetExternalTaskId returns the ExternalTaskId field if non-nil, zero value otherwise.

### GetExternalTaskIdOk

`func (o *LipSyncOneShotBody) GetExternalTaskIdOk() (*string, bool)`

GetExternalTaskIdOk returns a tuple with the ExternalTaskId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetExternalTaskId

`func (o *LipSyncOneShotBody) SetExternalTaskId(v string)`

SetExternalTaskId sets ExternalTaskId field to given value.

### HasExternalTaskId

`func (o *LipSyncOneShotBody) HasExternalTaskId() bool`

HasExternalTaskId returns a boolean if a field has been set.

### SetExternalTaskIdNil

`func (o *LipSyncOneShotBody) SetExternalTaskIdNil(b bool)`

 SetExternalTaskIdNil sets the value for ExternalTaskId to be an explicit nil

### UnsetExternalTaskId
`func (o *LipSyncOneShotBody) UnsetExternalTaskId()`

UnsetExternalTaskId ensures that no value is present for ExternalTaskId, not even an explicit nil
### GetCallbackUrl

`func (o *LipSyncOneShotBody) GetCallbackUrl() string`

GetCallbackUrl returns the CallbackUrl field if non-nil, zero value otherwise.

### GetCallbackUrlOk

`func (o *LipSyncOneShotBody) GetCallbackUrlOk() (*string, bool)`

GetCallbackUrlOk returns a tuple with the CallbackUrl field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCallbackUrl

`func (o *LipSyncOneShotBody) SetCallbackUrl(v string)`

SetCallbackUrl sets CallbackUrl field to given value.

### HasCallbackUrl

`func (o *LipSyncOneShotBody) HasCallbackUrl() bool`

HasCallbackUrl returns a boolean if a field has been set.

### SetCallbackUrlNil

`func (o *LipSyncOneShotBody) SetCallbackUrlNil(b bool)`

 SetCallbackUrlNil sets the value for CallbackUrl to be an explicit nil

### UnsetCallbackUrl
`func (o *LipSyncOneShotBody) UnsetCallbackUrl()`

UnsetCallbackUrl ensures that no value is present for CallbackUrl, not even an explicit nil
### GetChatId

`func (o *LipSyncOneShotBody) GetChatId() string`

GetChatId returns the ChatId field if non-nil, zero value otherwise.

### GetChatIdOk

`func (o *LipSyncOneShotBody) GetChatIdOk() (*string, bool)`

GetChatIdOk returns a tuple with the ChatId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetChatId

`func (o *LipSyncOneShotBody) SetChatId(v string)`

SetChatId sets ChatId field to given value.

### HasChatId

`func (o *LipSyncOneShotBody) HasChatId() bool`

HasChatId returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


