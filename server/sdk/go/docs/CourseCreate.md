# CourseCreate

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Title** | **string** |  | 
**Subtitle** | Pointer to **NullableString** |  | [optional] 
**Content** | Pointer to **NullableString** |  | [optional] 
**Remark** | Pointer to **NullableString** |  | [optional] 
**RemarkFile** | Pointer to **NullableString** |  | [optional] 
**Binding** | Pointer to **NullableString** |  | [optional] 
**Stage** | Pointer to **NullableString** |  | [optional] 
**Label** | Pointer to **NullableString** |  | [optional] 
**Sort** | Pointer to **int32** |  | [optional] [default to 0]
**IsHidden** | Pointer to **int32** |  | [optional] [default to 0]

## Methods

### NewCourseCreate

`func NewCourseCreate(title string, ) *CourseCreate`

NewCourseCreate instantiates a new CourseCreate object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewCourseCreateWithDefaults

`func NewCourseCreateWithDefaults() *CourseCreate`

NewCourseCreateWithDefaults instantiates a new CourseCreate object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetTitle

`func (o *CourseCreate) GetTitle() string`

GetTitle returns the Title field if non-nil, zero value otherwise.

### GetTitleOk

`func (o *CourseCreate) GetTitleOk() (*string, bool)`

GetTitleOk returns a tuple with the Title field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTitle

`func (o *CourseCreate) SetTitle(v string)`

SetTitle sets Title field to given value.


### GetSubtitle

`func (o *CourseCreate) GetSubtitle() string`

GetSubtitle returns the Subtitle field if non-nil, zero value otherwise.

### GetSubtitleOk

`func (o *CourseCreate) GetSubtitleOk() (*string, bool)`

GetSubtitleOk returns a tuple with the Subtitle field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSubtitle

`func (o *CourseCreate) SetSubtitle(v string)`

SetSubtitle sets Subtitle field to given value.

### HasSubtitle

`func (o *CourseCreate) HasSubtitle() bool`

HasSubtitle returns a boolean if a field has been set.

### SetSubtitleNil

`func (o *CourseCreate) SetSubtitleNil(b bool)`

 SetSubtitleNil sets the value for Subtitle to be an explicit nil

### UnsetSubtitle
`func (o *CourseCreate) UnsetSubtitle()`

UnsetSubtitle ensures that no value is present for Subtitle, not even an explicit nil
### GetContent

`func (o *CourseCreate) GetContent() string`

GetContent returns the Content field if non-nil, zero value otherwise.

### GetContentOk

`func (o *CourseCreate) GetContentOk() (*string, bool)`

GetContentOk returns a tuple with the Content field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetContent

`func (o *CourseCreate) SetContent(v string)`

SetContent sets Content field to given value.

### HasContent

`func (o *CourseCreate) HasContent() bool`

HasContent returns a boolean if a field has been set.

### SetContentNil

`func (o *CourseCreate) SetContentNil(b bool)`

 SetContentNil sets the value for Content to be an explicit nil

### UnsetContent
`func (o *CourseCreate) UnsetContent()`

UnsetContent ensures that no value is present for Content, not even an explicit nil
### GetRemark

`func (o *CourseCreate) GetRemark() string`

GetRemark returns the Remark field if non-nil, zero value otherwise.

### GetRemarkOk

`func (o *CourseCreate) GetRemarkOk() (*string, bool)`

GetRemarkOk returns a tuple with the Remark field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRemark

`func (o *CourseCreate) SetRemark(v string)`

SetRemark sets Remark field to given value.

### HasRemark

`func (o *CourseCreate) HasRemark() bool`

HasRemark returns a boolean if a field has been set.

### SetRemarkNil

`func (o *CourseCreate) SetRemarkNil(b bool)`

 SetRemarkNil sets the value for Remark to be an explicit nil

### UnsetRemark
`func (o *CourseCreate) UnsetRemark()`

UnsetRemark ensures that no value is present for Remark, not even an explicit nil
### GetRemarkFile

`func (o *CourseCreate) GetRemarkFile() string`

GetRemarkFile returns the RemarkFile field if non-nil, zero value otherwise.

### GetRemarkFileOk

`func (o *CourseCreate) GetRemarkFileOk() (*string, bool)`

GetRemarkFileOk returns a tuple with the RemarkFile field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRemarkFile

`func (o *CourseCreate) SetRemarkFile(v string)`

SetRemarkFile sets RemarkFile field to given value.

### HasRemarkFile

`func (o *CourseCreate) HasRemarkFile() bool`

HasRemarkFile returns a boolean if a field has been set.

### SetRemarkFileNil

`func (o *CourseCreate) SetRemarkFileNil(b bool)`

 SetRemarkFileNil sets the value for RemarkFile to be an explicit nil

### UnsetRemarkFile
`func (o *CourseCreate) UnsetRemarkFile()`

UnsetRemarkFile ensures that no value is present for RemarkFile, not even an explicit nil
### GetBinding

`func (o *CourseCreate) GetBinding() string`

GetBinding returns the Binding field if non-nil, zero value otherwise.

### GetBindingOk

`func (o *CourseCreate) GetBindingOk() (*string, bool)`

GetBindingOk returns a tuple with the Binding field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBinding

`func (o *CourseCreate) SetBinding(v string)`

SetBinding sets Binding field to given value.

### HasBinding

`func (o *CourseCreate) HasBinding() bool`

HasBinding returns a boolean if a field has been set.

### SetBindingNil

`func (o *CourseCreate) SetBindingNil(b bool)`

 SetBindingNil sets the value for Binding to be an explicit nil

### UnsetBinding
`func (o *CourseCreate) UnsetBinding()`

UnsetBinding ensures that no value is present for Binding, not even an explicit nil
### GetStage

`func (o *CourseCreate) GetStage() string`

GetStage returns the Stage field if non-nil, zero value otherwise.

### GetStageOk

`func (o *CourseCreate) GetStageOk() (*string, bool)`

GetStageOk returns a tuple with the Stage field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetStage

`func (o *CourseCreate) SetStage(v string)`

SetStage sets Stage field to given value.

### HasStage

`func (o *CourseCreate) HasStage() bool`

HasStage returns a boolean if a field has been set.

### SetStageNil

`func (o *CourseCreate) SetStageNil(b bool)`

 SetStageNil sets the value for Stage to be an explicit nil

### UnsetStage
`func (o *CourseCreate) UnsetStage()`

UnsetStage ensures that no value is present for Stage, not even an explicit nil
### GetLabel

`func (o *CourseCreate) GetLabel() string`

GetLabel returns the Label field if non-nil, zero value otherwise.

### GetLabelOk

`func (o *CourseCreate) GetLabelOk() (*string, bool)`

GetLabelOk returns a tuple with the Label field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLabel

`func (o *CourseCreate) SetLabel(v string)`

SetLabel sets Label field to given value.

### HasLabel

`func (o *CourseCreate) HasLabel() bool`

HasLabel returns a boolean if a field has been set.

### SetLabelNil

`func (o *CourseCreate) SetLabelNil(b bool)`

 SetLabelNil sets the value for Label to be an explicit nil

### UnsetLabel
`func (o *CourseCreate) UnsetLabel()`

UnsetLabel ensures that no value is present for Label, not even an explicit nil
### GetSort

`func (o *CourseCreate) GetSort() int32`

GetSort returns the Sort field if non-nil, zero value otherwise.

### GetSortOk

`func (o *CourseCreate) GetSortOk() (*int32, bool)`

GetSortOk returns a tuple with the Sort field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSort

`func (o *CourseCreate) SetSort(v int32)`

SetSort sets Sort field to given value.

### HasSort

`func (o *CourseCreate) HasSort() bool`

HasSort returns a boolean if a field has been set.

### GetIsHidden

`func (o *CourseCreate) GetIsHidden() int32`

GetIsHidden returns the IsHidden field if non-nil, zero value otherwise.

### GetIsHiddenOk

`func (o *CourseCreate) GetIsHiddenOk() (*int32, bool)`

GetIsHiddenOk returns a tuple with the IsHidden field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetIsHidden

`func (o *CourseCreate) SetIsHidden(v int32)`

SetIsHidden sets IsHidden field to given value.

### HasIsHidden

`func (o *CourseCreate) HasIsHidden() bool`

HasIsHidden returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


