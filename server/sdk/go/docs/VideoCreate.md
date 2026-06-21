# VideoCreate

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**CourseId** | **int32** |  | 
**Title** | **string** |  | 
**Subtitle** | Pointer to **NullableString** |  | [optional] 
**Content** | Pointer to **NullableString** |  | [optional] 
**VideoPath** | **string** |  | 
**Duration** | Pointer to **NullableInt32** |  | [optional] 
**AdjunctUrl** | Pointer to **NullableString** |  | [optional] 
**IsPay** | Pointer to **int32** |  | [optional] [default to 0]
**Amount** | Pointer to **NullableFloat32** |  | [optional] 
**Lecturer** | Pointer to **NullableString** |  | [optional] 
**Label** | Pointer to **NullableString** |  | [optional] 
**Stage** | Pointer to **NullableString** |  | [optional] 
**Sort** | Pointer to **int32** |  | [optional] [default to 0]
**Binding** | Pointer to **NullableString** |  | [optional] 
**Remark** | Pointer to **NullableString** |  | [optional] 

## Methods

### NewVideoCreate

`func NewVideoCreate(courseId int32, title string, videoPath string, ) *VideoCreate`

NewVideoCreate instantiates a new VideoCreate object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewVideoCreateWithDefaults

`func NewVideoCreateWithDefaults() *VideoCreate`

NewVideoCreateWithDefaults instantiates a new VideoCreate object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetCourseId

`func (o *VideoCreate) GetCourseId() int32`

GetCourseId returns the CourseId field if non-nil, zero value otherwise.

### GetCourseIdOk

`func (o *VideoCreate) GetCourseIdOk() (*int32, bool)`

GetCourseIdOk returns a tuple with the CourseId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCourseId

`func (o *VideoCreate) SetCourseId(v int32)`

SetCourseId sets CourseId field to given value.


### GetTitle

`func (o *VideoCreate) GetTitle() string`

GetTitle returns the Title field if non-nil, zero value otherwise.

### GetTitleOk

`func (o *VideoCreate) GetTitleOk() (*string, bool)`

GetTitleOk returns a tuple with the Title field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTitle

`func (o *VideoCreate) SetTitle(v string)`

SetTitle sets Title field to given value.


### GetSubtitle

`func (o *VideoCreate) GetSubtitle() string`

GetSubtitle returns the Subtitle field if non-nil, zero value otherwise.

### GetSubtitleOk

`func (o *VideoCreate) GetSubtitleOk() (*string, bool)`

GetSubtitleOk returns a tuple with the Subtitle field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSubtitle

`func (o *VideoCreate) SetSubtitle(v string)`

SetSubtitle sets Subtitle field to given value.

### HasSubtitle

`func (o *VideoCreate) HasSubtitle() bool`

HasSubtitle returns a boolean if a field has been set.

### SetSubtitleNil

`func (o *VideoCreate) SetSubtitleNil(b bool)`

 SetSubtitleNil sets the value for Subtitle to be an explicit nil

### UnsetSubtitle
`func (o *VideoCreate) UnsetSubtitle()`

UnsetSubtitle ensures that no value is present for Subtitle, not even an explicit nil
### GetContent

`func (o *VideoCreate) GetContent() string`

GetContent returns the Content field if non-nil, zero value otherwise.

### GetContentOk

`func (o *VideoCreate) GetContentOk() (*string, bool)`

GetContentOk returns a tuple with the Content field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetContent

`func (o *VideoCreate) SetContent(v string)`

SetContent sets Content field to given value.

### HasContent

`func (o *VideoCreate) HasContent() bool`

HasContent returns a boolean if a field has been set.

### SetContentNil

`func (o *VideoCreate) SetContentNil(b bool)`

 SetContentNil sets the value for Content to be an explicit nil

### UnsetContent
`func (o *VideoCreate) UnsetContent()`

UnsetContent ensures that no value is present for Content, not even an explicit nil
### GetVideoPath

`func (o *VideoCreate) GetVideoPath() string`

GetVideoPath returns the VideoPath field if non-nil, zero value otherwise.

### GetVideoPathOk

`func (o *VideoCreate) GetVideoPathOk() (*string, bool)`

GetVideoPathOk returns a tuple with the VideoPath field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetVideoPath

`func (o *VideoCreate) SetVideoPath(v string)`

SetVideoPath sets VideoPath field to given value.


### GetDuration

`func (o *VideoCreate) GetDuration() int32`

GetDuration returns the Duration field if non-nil, zero value otherwise.

### GetDurationOk

`func (o *VideoCreate) GetDurationOk() (*int32, bool)`

GetDurationOk returns a tuple with the Duration field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDuration

`func (o *VideoCreate) SetDuration(v int32)`

SetDuration sets Duration field to given value.

### HasDuration

`func (o *VideoCreate) HasDuration() bool`

HasDuration returns a boolean if a field has been set.

### SetDurationNil

`func (o *VideoCreate) SetDurationNil(b bool)`

 SetDurationNil sets the value for Duration to be an explicit nil

### UnsetDuration
`func (o *VideoCreate) UnsetDuration()`

UnsetDuration ensures that no value is present for Duration, not even an explicit nil
### GetAdjunctUrl

`func (o *VideoCreate) GetAdjunctUrl() string`

GetAdjunctUrl returns the AdjunctUrl field if non-nil, zero value otherwise.

### GetAdjunctUrlOk

`func (o *VideoCreate) GetAdjunctUrlOk() (*string, bool)`

GetAdjunctUrlOk returns a tuple with the AdjunctUrl field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAdjunctUrl

`func (o *VideoCreate) SetAdjunctUrl(v string)`

SetAdjunctUrl sets AdjunctUrl field to given value.

### HasAdjunctUrl

`func (o *VideoCreate) HasAdjunctUrl() bool`

HasAdjunctUrl returns a boolean if a field has been set.

### SetAdjunctUrlNil

`func (o *VideoCreate) SetAdjunctUrlNil(b bool)`

 SetAdjunctUrlNil sets the value for AdjunctUrl to be an explicit nil

### UnsetAdjunctUrl
`func (o *VideoCreate) UnsetAdjunctUrl()`

UnsetAdjunctUrl ensures that no value is present for AdjunctUrl, not even an explicit nil
### GetIsPay

`func (o *VideoCreate) GetIsPay() int32`

GetIsPay returns the IsPay field if non-nil, zero value otherwise.

### GetIsPayOk

`func (o *VideoCreate) GetIsPayOk() (*int32, bool)`

GetIsPayOk returns a tuple with the IsPay field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetIsPay

`func (o *VideoCreate) SetIsPay(v int32)`

SetIsPay sets IsPay field to given value.

### HasIsPay

`func (o *VideoCreate) HasIsPay() bool`

HasIsPay returns a boolean if a field has been set.

### GetAmount

`func (o *VideoCreate) GetAmount() float32`

GetAmount returns the Amount field if non-nil, zero value otherwise.

### GetAmountOk

`func (o *VideoCreate) GetAmountOk() (*float32, bool)`

GetAmountOk returns a tuple with the Amount field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAmount

`func (o *VideoCreate) SetAmount(v float32)`

SetAmount sets Amount field to given value.

### HasAmount

`func (o *VideoCreate) HasAmount() bool`

HasAmount returns a boolean if a field has been set.

### SetAmountNil

`func (o *VideoCreate) SetAmountNil(b bool)`

 SetAmountNil sets the value for Amount to be an explicit nil

### UnsetAmount
`func (o *VideoCreate) UnsetAmount()`

UnsetAmount ensures that no value is present for Amount, not even an explicit nil
### GetLecturer

`func (o *VideoCreate) GetLecturer() string`

GetLecturer returns the Lecturer field if non-nil, zero value otherwise.

### GetLecturerOk

`func (o *VideoCreate) GetLecturerOk() (*string, bool)`

GetLecturerOk returns a tuple with the Lecturer field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLecturer

`func (o *VideoCreate) SetLecturer(v string)`

SetLecturer sets Lecturer field to given value.

### HasLecturer

`func (o *VideoCreate) HasLecturer() bool`

HasLecturer returns a boolean if a field has been set.

### SetLecturerNil

`func (o *VideoCreate) SetLecturerNil(b bool)`

 SetLecturerNil sets the value for Lecturer to be an explicit nil

### UnsetLecturer
`func (o *VideoCreate) UnsetLecturer()`

UnsetLecturer ensures that no value is present for Lecturer, not even an explicit nil
### GetLabel

`func (o *VideoCreate) GetLabel() string`

GetLabel returns the Label field if non-nil, zero value otherwise.

### GetLabelOk

`func (o *VideoCreate) GetLabelOk() (*string, bool)`

GetLabelOk returns a tuple with the Label field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLabel

`func (o *VideoCreate) SetLabel(v string)`

SetLabel sets Label field to given value.

### HasLabel

`func (o *VideoCreate) HasLabel() bool`

HasLabel returns a boolean if a field has been set.

### SetLabelNil

`func (o *VideoCreate) SetLabelNil(b bool)`

 SetLabelNil sets the value for Label to be an explicit nil

### UnsetLabel
`func (o *VideoCreate) UnsetLabel()`

UnsetLabel ensures that no value is present for Label, not even an explicit nil
### GetStage

`func (o *VideoCreate) GetStage() string`

GetStage returns the Stage field if non-nil, zero value otherwise.

### GetStageOk

`func (o *VideoCreate) GetStageOk() (*string, bool)`

GetStageOk returns a tuple with the Stage field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetStage

`func (o *VideoCreate) SetStage(v string)`

SetStage sets Stage field to given value.

### HasStage

`func (o *VideoCreate) HasStage() bool`

HasStage returns a boolean if a field has been set.

### SetStageNil

`func (o *VideoCreate) SetStageNil(b bool)`

 SetStageNil sets the value for Stage to be an explicit nil

### UnsetStage
`func (o *VideoCreate) UnsetStage()`

UnsetStage ensures that no value is present for Stage, not even an explicit nil
### GetSort

`func (o *VideoCreate) GetSort() int32`

GetSort returns the Sort field if non-nil, zero value otherwise.

### GetSortOk

`func (o *VideoCreate) GetSortOk() (*int32, bool)`

GetSortOk returns a tuple with the Sort field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSort

`func (o *VideoCreate) SetSort(v int32)`

SetSort sets Sort field to given value.

### HasSort

`func (o *VideoCreate) HasSort() bool`

HasSort returns a boolean if a field has been set.

### GetBinding

`func (o *VideoCreate) GetBinding() string`

GetBinding returns the Binding field if non-nil, zero value otherwise.

### GetBindingOk

`func (o *VideoCreate) GetBindingOk() (*string, bool)`

GetBindingOk returns a tuple with the Binding field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBinding

`func (o *VideoCreate) SetBinding(v string)`

SetBinding sets Binding field to given value.

### HasBinding

`func (o *VideoCreate) HasBinding() bool`

HasBinding returns a boolean if a field has been set.

### SetBindingNil

`func (o *VideoCreate) SetBindingNil(b bool)`

 SetBindingNil sets the value for Binding to be an explicit nil

### UnsetBinding
`func (o *VideoCreate) UnsetBinding()`

UnsetBinding ensures that no value is present for Binding, not even an explicit nil
### GetRemark

`func (o *VideoCreate) GetRemark() string`

GetRemark returns the Remark field if non-nil, zero value otherwise.

### GetRemarkOk

`func (o *VideoCreate) GetRemarkOk() (*string, bool)`

GetRemarkOk returns a tuple with the Remark field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRemark

`func (o *VideoCreate) SetRemark(v string)`

SetRemark sets Remark field to given value.

### HasRemark

`func (o *VideoCreate) HasRemark() bool`

HasRemark returns a boolean if a field has been set.

### SetRemarkNil

`func (o *VideoCreate) SetRemarkNil(b bool)`

 SetRemarkNil sets the value for Remark to be an explicit nil

### UnsetRemark
`func (o *VideoCreate) UnsetRemark()`

UnsetRemark ensures that no value is present for Remark, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


