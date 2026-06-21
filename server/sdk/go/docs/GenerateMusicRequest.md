# GenerateMusicRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Prompt** | **string** | 音乐描述 / 歌词提示 | 
**Mv** | Pointer to **NullableString** | 模型版本, e.g. v3.5, v4 | [optional] 
**Style** | Pointer to **NullableString** | 音乐风格, e.g. pop, rock, jazz | [optional] 
**Title** | Pointer to **NullableString** | 歌曲标题 | [optional] 
**Duration** | Pointer to **NullableInt32** | 时长(秒) | [optional] 
**Instrumental** | Pointer to **NullableBool** | 是否纯音乐(无人声) | [optional] 

## Methods

### NewGenerateMusicRequest

`func NewGenerateMusicRequest(prompt string, ) *GenerateMusicRequest`

NewGenerateMusicRequest instantiates a new GenerateMusicRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewGenerateMusicRequestWithDefaults

`func NewGenerateMusicRequestWithDefaults() *GenerateMusicRequest`

NewGenerateMusicRequestWithDefaults instantiates a new GenerateMusicRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetPrompt

`func (o *GenerateMusicRequest) GetPrompt() string`

GetPrompt returns the Prompt field if non-nil, zero value otherwise.

### GetPromptOk

`func (o *GenerateMusicRequest) GetPromptOk() (*string, bool)`

GetPromptOk returns a tuple with the Prompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPrompt

`func (o *GenerateMusicRequest) SetPrompt(v string)`

SetPrompt sets Prompt field to given value.


### GetMv

`func (o *GenerateMusicRequest) GetMv() string`

GetMv returns the Mv field if non-nil, zero value otherwise.

### GetMvOk

`func (o *GenerateMusicRequest) GetMvOk() (*string, bool)`

GetMvOk returns a tuple with the Mv field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMv

`func (o *GenerateMusicRequest) SetMv(v string)`

SetMv sets Mv field to given value.

### HasMv

`func (o *GenerateMusicRequest) HasMv() bool`

HasMv returns a boolean if a field has been set.

### SetMvNil

`func (o *GenerateMusicRequest) SetMvNil(b bool)`

 SetMvNil sets the value for Mv to be an explicit nil

### UnsetMv
`func (o *GenerateMusicRequest) UnsetMv()`

UnsetMv ensures that no value is present for Mv, not even an explicit nil
### GetStyle

`func (o *GenerateMusicRequest) GetStyle() string`

GetStyle returns the Style field if non-nil, zero value otherwise.

### GetStyleOk

`func (o *GenerateMusicRequest) GetStyleOk() (*string, bool)`

GetStyleOk returns a tuple with the Style field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetStyle

`func (o *GenerateMusicRequest) SetStyle(v string)`

SetStyle sets Style field to given value.

### HasStyle

`func (o *GenerateMusicRequest) HasStyle() bool`

HasStyle returns a boolean if a field has been set.

### SetStyleNil

`func (o *GenerateMusicRequest) SetStyleNil(b bool)`

 SetStyleNil sets the value for Style to be an explicit nil

### UnsetStyle
`func (o *GenerateMusicRequest) UnsetStyle()`

UnsetStyle ensures that no value is present for Style, not even an explicit nil
### GetTitle

`func (o *GenerateMusicRequest) GetTitle() string`

GetTitle returns the Title field if non-nil, zero value otherwise.

### GetTitleOk

`func (o *GenerateMusicRequest) GetTitleOk() (*string, bool)`

GetTitleOk returns a tuple with the Title field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTitle

`func (o *GenerateMusicRequest) SetTitle(v string)`

SetTitle sets Title field to given value.

### HasTitle

`func (o *GenerateMusicRequest) HasTitle() bool`

HasTitle returns a boolean if a field has been set.

### SetTitleNil

`func (o *GenerateMusicRequest) SetTitleNil(b bool)`

 SetTitleNil sets the value for Title to be an explicit nil

### UnsetTitle
`func (o *GenerateMusicRequest) UnsetTitle()`

UnsetTitle ensures that no value is present for Title, not even an explicit nil
### GetDuration

`func (o *GenerateMusicRequest) GetDuration() int32`

GetDuration returns the Duration field if non-nil, zero value otherwise.

### GetDurationOk

`func (o *GenerateMusicRequest) GetDurationOk() (*int32, bool)`

GetDurationOk returns a tuple with the Duration field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDuration

`func (o *GenerateMusicRequest) SetDuration(v int32)`

SetDuration sets Duration field to given value.

### HasDuration

`func (o *GenerateMusicRequest) HasDuration() bool`

HasDuration returns a boolean if a field has been set.

### SetDurationNil

`func (o *GenerateMusicRequest) SetDurationNil(b bool)`

 SetDurationNil sets the value for Duration to be an explicit nil

### UnsetDuration
`func (o *GenerateMusicRequest) UnsetDuration()`

UnsetDuration ensures that no value is present for Duration, not even an explicit nil
### GetInstrumental

`func (o *GenerateMusicRequest) GetInstrumental() bool`

GetInstrumental returns the Instrumental field if non-nil, zero value otherwise.

### GetInstrumentalOk

`func (o *GenerateMusicRequest) GetInstrumentalOk() (*bool, bool)`

GetInstrumentalOk returns a tuple with the Instrumental field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetInstrumental

`func (o *GenerateMusicRequest) SetInstrumental(v bool)`

SetInstrumental sets Instrumental field to given value.

### HasInstrumental

`func (o *GenerateMusicRequest) HasInstrumental() bool`

HasInstrumental returns a boolean if a field has been set.

### SetInstrumentalNil

`func (o *GenerateMusicRequest) SetInstrumentalNil(b bool)`

 SetInstrumentalNil sets the value for Instrumental to be an explicit nil

### UnsetInstrumental
`func (o *GenerateMusicRequest) UnsetInstrumental()`

UnsetInstrumental ensures that no value is present for Instrumental, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


