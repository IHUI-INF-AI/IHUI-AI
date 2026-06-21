
# RuleSpec

单条抑制规则 (alertmanager YAML JSON 等价).

## Properties

Name | Type
------------ | -------------
`name` | string
`sourceMatch` | { [key: string]: any; }
`targetMatch` | { [key: string]: any; }
`equal` | Array&lt;string&gt;

## Example

```typescript
import type { RuleSpec } from ''

// TODO: Update the object below with actual values
const example = {
  "name": null,
  "sourceMatch": null,
  "targetMatch": null,
  "equal": null,
} satisfies RuleSpec

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as RuleSpec
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


