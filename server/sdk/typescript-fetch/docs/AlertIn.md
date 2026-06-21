
# AlertIn

输入告警 (简化: 只要 status + labels).

## Properties

Name | Type
------------ | -------------
`status` | string
`labels` | { [key: string]: any; }
`annotations` | { [key: string]: any; }

## Example

```typescript
import type { AlertIn } from ''

// TODO: Update the object below with actual values
const example = {
  "status": null,
  "labels": null,
  "annotations": null,
} satisfies AlertIn

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AlertIn
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


