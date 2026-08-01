(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/index.js [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
;
;
;
;
;
;
;
;
}),
"[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/create-element.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createChildren",
    ()=>createChildren,
    "createClassNameString",
    ()=>createClassNameString,
    "createStyleObject",
    ()=>createStyleObject,
    "default",
    ()=>createElement
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$extends$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@babel/runtime/helpers/esm/extends.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$defineProperty$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@babel/runtime/helpers/esm/defineProperty.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
;
function ownKeys(e, r) {
    var t = Object.keys(e);
    if (Object.getOwnPropertySymbols) {
        var o = Object.getOwnPropertySymbols(e);
        r && (o = o.filter(function(r) {
            return Object.getOwnPropertyDescriptor(e, r).enumerable;
        })), t.push.apply(t, o);
    }
    return t;
}
function _objectSpread(e) {
    for(var r = 1; r < arguments.length; r++){
        var t = null != arguments[r] ? arguments[r] : {};
        r % 2 ? ownKeys(Object(t), !0).forEach(function(r) {
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$defineProperty$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(e, r, t[r]);
        }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function(r) {
            Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
        });
    }
    return e;
}
;
// Get all possible permutations of all power sets
//
// Super simple, non-algorithmic solution since the
// number of class names will not be greater than 4
function powerSetPermutations(arr) {
    var arrLength = arr.length;
    if (arrLength === 0 || arrLength === 1) return arr;
    if (arrLength === 2) {
        // prettier-ignore
        return [
            arr[0],
            arr[1],
            "".concat(arr[0], ".").concat(arr[1]),
            "".concat(arr[1], ".").concat(arr[0])
        ];
    }
    if (arrLength === 3) {
        return [
            arr[0],
            arr[1],
            arr[2],
            "".concat(arr[0], ".").concat(arr[1]),
            "".concat(arr[0], ".").concat(arr[2]),
            "".concat(arr[1], ".").concat(arr[0]),
            "".concat(arr[1], ".").concat(arr[2]),
            "".concat(arr[2], ".").concat(arr[0]),
            "".concat(arr[2], ".").concat(arr[1]),
            "".concat(arr[0], ".").concat(arr[1], ".").concat(arr[2]),
            "".concat(arr[0], ".").concat(arr[2], ".").concat(arr[1]),
            "".concat(arr[1], ".").concat(arr[0], ".").concat(arr[2]),
            "".concat(arr[1], ".").concat(arr[2], ".").concat(arr[0]),
            "".concat(arr[2], ".").concat(arr[0], ".").concat(arr[1]),
            "".concat(arr[2], ".").concat(arr[1], ".").concat(arr[0])
        ];
    }
    if (arrLength >= 4) {
        // Currently does not support more than 4 extra
        // class names (after `.token` has been removed)
        return [
            arr[0],
            arr[1],
            arr[2],
            arr[3],
            "".concat(arr[0], ".").concat(arr[1]),
            "".concat(arr[0], ".").concat(arr[2]),
            "".concat(arr[0], ".").concat(arr[3]),
            "".concat(arr[1], ".").concat(arr[0]),
            "".concat(arr[1], ".").concat(arr[2]),
            "".concat(arr[1], ".").concat(arr[3]),
            "".concat(arr[2], ".").concat(arr[0]),
            "".concat(arr[2], ".").concat(arr[1]),
            "".concat(arr[2], ".").concat(arr[3]),
            "".concat(arr[3], ".").concat(arr[0]),
            "".concat(arr[3], ".").concat(arr[1]),
            "".concat(arr[3], ".").concat(arr[2]),
            "".concat(arr[0], ".").concat(arr[1], ".").concat(arr[2]),
            "".concat(arr[0], ".").concat(arr[1], ".").concat(arr[3]),
            "".concat(arr[0], ".").concat(arr[2], ".").concat(arr[1]),
            "".concat(arr[0], ".").concat(arr[2], ".").concat(arr[3]),
            "".concat(arr[0], ".").concat(arr[3], ".").concat(arr[1]),
            "".concat(arr[0], ".").concat(arr[3], ".").concat(arr[2]),
            "".concat(arr[1], ".").concat(arr[0], ".").concat(arr[2]),
            "".concat(arr[1], ".").concat(arr[0], ".").concat(arr[3]),
            "".concat(arr[1], ".").concat(arr[2], ".").concat(arr[0]),
            "".concat(arr[1], ".").concat(arr[2], ".").concat(arr[3]),
            "".concat(arr[1], ".").concat(arr[3], ".").concat(arr[0]),
            "".concat(arr[1], ".").concat(arr[3], ".").concat(arr[2]),
            "".concat(arr[2], ".").concat(arr[0], ".").concat(arr[1]),
            "".concat(arr[2], ".").concat(arr[0], ".").concat(arr[3]),
            "".concat(arr[2], ".").concat(arr[1], ".").concat(arr[0]),
            "".concat(arr[2], ".").concat(arr[1], ".").concat(arr[3]),
            "".concat(arr[2], ".").concat(arr[3], ".").concat(arr[0]),
            "".concat(arr[2], ".").concat(arr[3], ".").concat(arr[1]),
            "".concat(arr[3], ".").concat(arr[0], ".").concat(arr[1]),
            "".concat(arr[3], ".").concat(arr[0], ".").concat(arr[2]),
            "".concat(arr[3], ".").concat(arr[1], ".").concat(arr[0]),
            "".concat(arr[3], ".").concat(arr[1], ".").concat(arr[2]),
            "".concat(arr[3], ".").concat(arr[2], ".").concat(arr[0]),
            "".concat(arr[3], ".").concat(arr[2], ".").concat(arr[1]),
            "".concat(arr[0], ".").concat(arr[1], ".").concat(arr[2], ".").concat(arr[3]),
            "".concat(arr[0], ".").concat(arr[1], ".").concat(arr[3], ".").concat(arr[2]),
            "".concat(arr[0], ".").concat(arr[2], ".").concat(arr[1], ".").concat(arr[3]),
            "".concat(arr[0], ".").concat(arr[2], ".").concat(arr[3], ".").concat(arr[1]),
            "".concat(arr[0], ".").concat(arr[3], ".").concat(arr[1], ".").concat(arr[2]),
            "".concat(arr[0], ".").concat(arr[3], ".").concat(arr[2], ".").concat(arr[1]),
            "".concat(arr[1], ".").concat(arr[0], ".").concat(arr[2], ".").concat(arr[3]),
            "".concat(arr[1], ".").concat(arr[0], ".").concat(arr[3], ".").concat(arr[2]),
            "".concat(arr[1], ".").concat(arr[2], ".").concat(arr[0], ".").concat(arr[3]),
            "".concat(arr[1], ".").concat(arr[2], ".").concat(arr[3], ".").concat(arr[0]),
            "".concat(arr[1], ".").concat(arr[3], ".").concat(arr[0], ".").concat(arr[2]),
            "".concat(arr[1], ".").concat(arr[3], ".").concat(arr[2], ".").concat(arr[0]),
            "".concat(arr[2], ".").concat(arr[0], ".").concat(arr[1], ".").concat(arr[3]),
            "".concat(arr[2], ".").concat(arr[0], ".").concat(arr[3], ".").concat(arr[1]),
            "".concat(arr[2], ".").concat(arr[1], ".").concat(arr[0], ".").concat(arr[3]),
            "".concat(arr[2], ".").concat(arr[1], ".").concat(arr[3], ".").concat(arr[0]),
            "".concat(arr[2], ".").concat(arr[3], ".").concat(arr[0], ".").concat(arr[1]),
            "".concat(arr[2], ".").concat(arr[3], ".").concat(arr[1], ".").concat(arr[0]),
            "".concat(arr[3], ".").concat(arr[0], ".").concat(arr[1], ".").concat(arr[2]),
            "".concat(arr[3], ".").concat(arr[0], ".").concat(arr[2], ".").concat(arr[1]),
            "".concat(arr[3], ".").concat(arr[1], ".").concat(arr[0], ".").concat(arr[2]),
            "".concat(arr[3], ".").concat(arr[1], ".").concat(arr[2], ".").concat(arr[0]),
            "".concat(arr[3], ".").concat(arr[2], ".").concat(arr[0], ".").concat(arr[1]),
            "".concat(arr[3], ".").concat(arr[2], ".").concat(arr[1], ".").concat(arr[0])
        ];
    }
}
var classNameCombinations = {};
function getClassNameCombinations(classNames) {
    if (classNames.length === 0 || classNames.length === 1) return classNames;
    var key = classNames.join('.');
    if (!classNameCombinations[key]) {
        classNameCombinations[key] = powerSetPermutations(classNames);
    }
    return classNameCombinations[key];
}
function createStyleObject(classNames) {
    var elementStyle = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var stylesheet = arguments.length > 2 ? arguments[2] : undefined;
    var nonTokenClassNames = classNames.filter(function(className) {
        return className !== 'token';
    });
    var classNamesCombinations = getClassNameCombinations(nonTokenClassNames);
    return classNamesCombinations.reduce(function(styleObject, className) {
        return _objectSpread(_objectSpread({}, styleObject), stylesheet[className]);
    }, elementStyle);
}
function createClassNameString(classNames) {
    return classNames.join(' ');
}
function createChildren(stylesheet, useInlineStyles) {
    var childrenCount = 0;
    return function(children) {
        childrenCount += 1;
        return children.map(function(child, i) {
            return createElement({
                node: child,
                stylesheet: stylesheet,
                useInlineStyles: useInlineStyles,
                key: "code-segment-".concat(childrenCount, "-").concat(i)
            });
        });
    };
}
function createElement(_ref) {
    var node = _ref.node, stylesheet = _ref.stylesheet, _ref$style = _ref.style, style = _ref$style === void 0 ? {} : _ref$style, useInlineStyles = _ref.useInlineStyles, key = _ref.key;
    var properties = node.properties, type = node.type, TagName = node.tagName, value = node.value;
    if (type === 'text') {
        return value;
    } else if (TagName) {
        var childrenCreator = createChildren(stylesheet, useInlineStyles);
        var props;
        if (!useInlineStyles) {
            props = _objectSpread(_objectSpread({}, properties), {}, {
                className: createClassNameString(properties.className)
            });
        } else {
            var allStylesheetSelectors = Object.keys(stylesheet).reduce(function(classes, selector) {
                selector.split('.').forEach(function(className) {
                    if (!classes.includes(className)) classes.push(className);
                });
                return classes;
            }, []);
            // For compatibility with older versions of react-syntax-highlighter
            var startingClassName = properties.className && properties.className.includes('token') ? [
                'token'
            ] : [];
            var className = properties.className && startingClassName.concat(properties.className.filter(function(className) {
                return !allStylesheetSelectors.includes(className);
            }));
            props = _objectSpread(_objectSpread({}, properties), {}, {
                className: createClassNameString(className) || undefined,
                style: createStyleObject(properties.className, Object.assign({}, properties.style, style), stylesheet)
            });
        }
        var children = childrenCreator(node.children);
        return /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(TagName, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$extends$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])({
            key: key
        }, props), children);
    }
}
}),
"[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/checkForListedLanguage.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
const __TURBOPACK__default__export__ = function(astGenerator, language) {
    var langs = astGenerator.listLanguages();
    return langs.indexOf(language) !== -1;
};
}),
"[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/highlight.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$objectWithoutProperties$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@babel/runtime/helpers/esm/objectWithoutProperties.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$toConsumableArray$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@babel/runtime/helpers/esm/toConsumableArray.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$defineProperty$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@babel/runtime/helpers/esm/defineProperty.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$create$2d$element$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/create-element.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$checkForListedLanguage$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/checkForListedLanguage.js [app-client] (ecmascript)");
;
;
;
var _excluded = [
    "language",
    "children",
    "style",
    "customStyle",
    "codeTagProps",
    "useInlineStyles",
    "showLineNumbers",
    "showInlineLineNumbers",
    "startingLineNumber",
    "lineNumberContainerStyle",
    "lineNumberStyle",
    "wrapLines",
    "wrapLongLines",
    "lineProps",
    "renderer",
    "PreTag",
    "CodeTag",
    "code",
    "astGenerator"
];
function ownKeys(e, r) {
    var t = Object.keys(e);
    if (Object.getOwnPropertySymbols) {
        var o = Object.getOwnPropertySymbols(e);
        r && (o = o.filter(function(r) {
            return Object.getOwnPropertyDescriptor(e, r).enumerable;
        })), t.push.apply(t, o);
    }
    return t;
}
function _objectSpread(e) {
    for(var r = 1; r < arguments.length; r++){
        var t = null != arguments[r] ? arguments[r] : {};
        r % 2 ? ownKeys(Object(t), !0).forEach(function(r) {
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$defineProperty$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(e, r, t[r]);
        }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function(r) {
            Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
        });
    }
    return e;
}
;
;
;
var newLineRegex = /\n/g;
function getNewLines(str) {
    return str.match(newLineRegex);
}
function getAllLineNumbers(_ref) {
    var lines = _ref.lines, startingLineNumber = _ref.startingLineNumber, style = _ref.style;
    return lines.map(function(_, i) {
        var number = i + startingLineNumber;
        return /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("span", {
            key: "line-".concat(i),
            className: "react-syntax-highlighter-line-number",
            style: typeof style === 'function' ? style(number) : style
        }, "".concat(number, "\n"));
    });
}
function AllLineNumbers(_ref2) {
    var codeString = _ref2.codeString, codeStyle = _ref2.codeStyle, _ref2$containerStyle = _ref2.containerStyle, containerStyle = _ref2$containerStyle === void 0 ? {
        "float": 'left',
        paddingRight: '10px'
    } : _ref2$containerStyle, _ref2$numberStyle = _ref2.numberStyle, numberStyle = _ref2$numberStyle === void 0 ? {} : _ref2$numberStyle, startingLineNumber = _ref2.startingLineNumber;
    return /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("code", {
        style: Object.assign({}, codeStyle, containerStyle)
    }, getAllLineNumbers({
        lines: codeString.replace(/\n$/, '').split('\n'),
        style: numberStyle,
        startingLineNumber: startingLineNumber
    }));
}
function getEmWidthOfNumber(num) {
    return "".concat(num.toString().length, ".25em");
}
function getInlineLineNumber(lineNumber, inlineLineNumberStyle) {
    return {
        type: 'element',
        tagName: 'span',
        properties: {
            key: "line-number--".concat(lineNumber),
            className: [
                'comment',
                'linenumber',
                'react-syntax-highlighter-line-number'
            ],
            style: inlineLineNumberStyle
        },
        children: [
            {
                type: 'text',
                value: lineNumber
            }
        ]
    };
}
function assembleLineNumberStyles(lineNumberStyle, lineNumber, largestLineNumber) {
    // minimally necessary styling for line numbers
    var defaultLineNumberStyle = {
        display: 'inline-block',
        minWidth: getEmWidthOfNumber(largestLineNumber),
        paddingRight: '1em',
        textAlign: 'right',
        userSelect: 'none'
    };
    // prep custom styling
    var customLineNumberStyle = typeof lineNumberStyle === 'function' ? lineNumberStyle(lineNumber) : lineNumberStyle;
    // combine
    var assembledStyle = _objectSpread(_objectSpread({}, defaultLineNumberStyle), customLineNumberStyle);
    return assembledStyle;
}
function createLineElement(_ref3) {
    var children = _ref3.children, lineNumber = _ref3.lineNumber, lineNumberStyle = _ref3.lineNumberStyle, largestLineNumber = _ref3.largestLineNumber, showInlineLineNumbers = _ref3.showInlineLineNumbers, _ref3$lineProps = _ref3.lineProps, lineProps = _ref3$lineProps === void 0 ? {} : _ref3$lineProps, _ref3$className = _ref3.className, className = _ref3$className === void 0 ? [] : _ref3$className, showLineNumbers = _ref3.showLineNumbers, wrapLongLines = _ref3.wrapLongLines, _ref3$wrapLines = _ref3.wrapLines, wrapLines = _ref3$wrapLines === void 0 ? false : _ref3$wrapLines;
    var properties = wrapLines ? _objectSpread({}, typeof lineProps === 'function' ? lineProps(lineNumber) : lineProps) : {};
    properties['className'] = properties['className'] ? [].concat((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$toConsumableArray$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(properties['className'].trim().split(/\s+/)), (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$toConsumableArray$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(className)) : className;
    if (lineNumber && showInlineLineNumbers) {
        var inlineLineNumberStyle = assembleLineNumberStyles(lineNumberStyle, lineNumber, largestLineNumber);
        children.unshift(getInlineLineNumber(lineNumber, inlineLineNumberStyle));
    }
    if (wrapLongLines & showLineNumbers) {
        properties.style = _objectSpread({
            display: 'flex'
        }, properties.style);
    }
    return {
        type: 'element',
        tagName: 'span',
        properties: properties,
        children: children
    };
}
function flattenCodeTree(tree) {
    var className = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
    var newTree = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
    for(var i = 0; i < tree.length; i++){
        var node = tree[i];
        if (node.type === 'text') {
            newTree.push(createLineElement({
                children: [
                    node
                ],
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$toConsumableArray$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(new Set(className))
            }));
        } else if (node.children) {
            var classNames = className.concat(node.properties.className);
            flattenCodeTree(node.children, classNames).forEach(function(i) {
                return newTree.push(i);
            });
        }
    }
    return newTree;
}
function processLines(codeTree, wrapLines, lineProps, showLineNumbers, showInlineLineNumbers, startingLineNumber, largestLineNumber, lineNumberStyle, wrapLongLines) {
    var _ref4;
    var tree = flattenCodeTree(codeTree.value);
    var newTree = [];
    var lastLineBreakIndex = -1;
    var index = 0;
    function createWrappedLine(children, lineNumber) {
        var className = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
        return createLineElement({
            children: children,
            lineNumber: lineNumber,
            lineNumberStyle: lineNumberStyle,
            largestLineNumber: largestLineNumber,
            showInlineLineNumbers: showInlineLineNumbers,
            lineProps: lineProps,
            className: className,
            showLineNumbers: showLineNumbers,
            wrapLongLines: wrapLongLines,
            wrapLines: wrapLines
        });
    }
    function createUnwrappedLine(children, lineNumber) {
        if (showLineNumbers && lineNumber && showInlineLineNumbers) {
            var inlineLineNumberStyle = assembleLineNumberStyles(lineNumberStyle, lineNumber, largestLineNumber);
            children.unshift(getInlineLineNumber(lineNumber, inlineLineNumberStyle));
        }
        return children;
    }
    function createLine(children, lineNumber) {
        var className = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
        return wrapLines || className.length > 0 ? createWrappedLine(children, lineNumber, className) : createUnwrappedLine(children, lineNumber);
    }
    var _loop = function _loop() {
        var node = tree[index];
        var value = node.children[0].value;
        var newLines = getNewLines(value);
        if (newLines) {
            var splitValue = value.split('\n');
            splitValue.forEach(function(text, i) {
                var lineNumber = showLineNumbers && newTree.length + startingLineNumber;
                var newChild = {
                    type: 'text',
                    value: "".concat(text, "\n")
                };
                // if it's the first line
                if (i === 0) {
                    var _children = tree.slice(lastLineBreakIndex + 1, index).concat(createLineElement({
                        children: [
                            newChild
                        ],
                        className: node.properties.className
                    }));
                    var _line = createLine(_children, lineNumber);
                    newTree.push(_line);
                // if it's the last line
                } else if (i === splitValue.length - 1) {
                    var stringChild = tree[index + 1] && tree[index + 1].children && tree[index + 1].children[0];
                    var lastLineInPreviousSpan = {
                        type: 'text',
                        value: "".concat(text)
                    };
                    if (stringChild) {
                        var newElem = createLineElement({
                            children: [
                                lastLineInPreviousSpan
                            ],
                            className: node.properties.className
                        });
                        tree.splice(index + 1, 0, newElem);
                    } else {
                        var _children2 = [
                            lastLineInPreviousSpan
                        ];
                        var _line2 = createLine(_children2, lineNumber, node.properties.className);
                        newTree.push(_line2);
                    }
                // if it's neither the first nor the last line
                } else {
                    var _children3 = [
                        newChild
                    ];
                    var _line3 = createLine(_children3, lineNumber, node.properties.className);
                    newTree.push(_line3);
                }
            });
            lastLineBreakIndex = index;
        }
        index++;
    };
    while(index < tree.length){
        _loop();
    }
    if (lastLineBreakIndex !== tree.length - 1) {
        var children = tree.slice(lastLineBreakIndex + 1, tree.length);
        if (children && children.length) {
            var lineNumber = showLineNumbers && newTree.length + startingLineNumber;
            var line = createLine(children, lineNumber);
            newTree.push(line);
        }
    }
    return wrapLines ? newTree : (_ref4 = []).concat.apply(_ref4, newTree);
}
function defaultRenderer(_ref5) {
    var rows = _ref5.rows, stylesheet = _ref5.stylesheet, useInlineStyles = _ref5.useInlineStyles;
    return rows.map(function(node, i) {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$create$2d$element$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])({
            node: node,
            stylesheet: stylesheet,
            useInlineStyles: useInlineStyles,
            key: "code-segment-".concat(i)
        });
    });
}
// only highlight.js has the highlightAuto method
function isHighlightJs(astGenerator) {
    return astGenerator && typeof astGenerator.highlightAuto !== 'undefined';
}
function getCodeTree(_ref6) {
    var astGenerator = _ref6.astGenerator, language = _ref6.language, code = _ref6.code, defaultCodeValue = _ref6.defaultCodeValue;
    // figure out whether we're using lowlight/highlight or refractor/prism
    // then attempt highlighting accordingly
    // lowlight/highlight?
    if (isHighlightJs(astGenerator)) {
        var hasLanguage = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$checkForListedLanguage$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(astGenerator, language);
        if (language === 'text') {
            return {
                value: defaultCodeValue,
                language: 'text'
            };
        } else if (hasLanguage) {
            return astGenerator.highlight(language, code);
        } else {
            return astGenerator.highlightAuto(code);
        }
    }
    // must be refractor/prism, then
    try {
        return language && language !== 'text' ? {
            value: astGenerator.highlight(code, language)
        } : {
            value: defaultCodeValue
        };
    } catch (e) {
        return {
            value: defaultCodeValue
        };
    }
}
function __TURBOPACK__default__export__(defaultAstGenerator, defaultStyle) {
    return function SyntaxHighlighter(_ref7) {
        var _code$match$length, _code$match;
        var language = _ref7.language, children = _ref7.children, _ref7$style = _ref7.style, style = _ref7$style === void 0 ? defaultStyle : _ref7$style, _ref7$customStyle = _ref7.customStyle, customStyle = _ref7$customStyle === void 0 ? {} : _ref7$customStyle, _ref7$codeTagProps = _ref7.codeTagProps, codeTagProps = _ref7$codeTagProps === void 0 ? {
            className: language ? "language-".concat(language) : undefined,
            style: _objectSpread(_objectSpread({}, style['code[class*="language-"]']), style["code[class*=\"language-".concat(language, "\"]")])
        } : _ref7$codeTagProps, _ref7$useInlineStyles = _ref7.useInlineStyles, useInlineStyles = _ref7$useInlineStyles === void 0 ? true : _ref7$useInlineStyles, _ref7$showLineNumbers = _ref7.showLineNumbers, showLineNumbers = _ref7$showLineNumbers === void 0 ? false : _ref7$showLineNumbers, _ref7$showInlineLineN = _ref7.showInlineLineNumbers, showInlineLineNumbers = _ref7$showInlineLineN === void 0 ? true : _ref7$showInlineLineN, _ref7$startingLineNum = _ref7.startingLineNumber, startingLineNumber = _ref7$startingLineNum === void 0 ? 1 : _ref7$startingLineNum, lineNumberContainerStyle = _ref7.lineNumberContainerStyle, _ref7$lineNumberStyle = _ref7.lineNumberStyle, lineNumberStyle = _ref7$lineNumberStyle === void 0 ? {} : _ref7$lineNumberStyle, wrapLines = _ref7.wrapLines, _ref7$wrapLongLines = _ref7.wrapLongLines, wrapLongLines = _ref7$wrapLongLines === void 0 ? false : _ref7$wrapLongLines, _ref7$lineProps = _ref7.lineProps, lineProps = _ref7$lineProps === void 0 ? {} : _ref7$lineProps, renderer = _ref7.renderer, _ref7$PreTag = _ref7.PreTag, PreTag = _ref7$PreTag === void 0 ? 'pre' : _ref7$PreTag, _ref7$CodeTag = _ref7.CodeTag, CodeTag = _ref7$CodeTag === void 0 ? 'code' : _ref7$CodeTag, _ref7$code = _ref7.code, code = _ref7$code === void 0 ? (Array.isArray(children) ? children[0] : children) || '' : _ref7$code, astGenerator = _ref7.astGenerator, rest = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$objectWithoutProperties$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(_ref7, _excluded);
        astGenerator = astGenerator || defaultAstGenerator;
        var allLineNumbers = showLineNumbers ? /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(AllLineNumbers, {
            containerStyle: lineNumberContainerStyle,
            codeStyle: codeTagProps.style || {},
            numberStyle: lineNumberStyle,
            startingLineNumber: startingLineNumber,
            codeString: code
        }) : null;
        var defaultPreStyle = style.hljs || style['pre[class*="language-"]'] || {
            backgroundColor: '#fff'
        };
        var generatorClassName = isHighlightJs(astGenerator) ? 'hljs' : 'prismjs';
        var preProps = useInlineStyles ? Object.assign({}, rest, {
            style: Object.assign({}, defaultPreStyle, customStyle)
        }) : Object.assign({}, rest, {
            className: rest.className ? "".concat(generatorClassName, " ").concat(rest.className) : generatorClassName,
            style: Object.assign({}, customStyle)
        });
        if (wrapLongLines) {
            codeTagProps.style = _objectSpread({
                whiteSpace: 'pre-wrap'
            }, codeTagProps.style);
        } else {
            codeTagProps.style = _objectSpread({
                whiteSpace: 'pre'
            }, codeTagProps.style);
        }
        if (!astGenerator) {
            return /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(PreTag, preProps, allLineNumbers, /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(CodeTag, codeTagProps, code));
        }
        /*
     * Some custom renderers rely on individual row elements so we need to turn wrapLines on
     * if renderer is provided and wrapLines is undefined.
     */ if (wrapLines === undefined && renderer || wrapLongLines) wrapLines = true;
        renderer = renderer || defaultRenderer;
        var defaultCodeValue = [
            {
                type: 'text',
                value: code
            }
        ];
        var codeTree = getCodeTree({
            astGenerator: astGenerator,
            language: language,
            code: code,
            defaultCodeValue: defaultCodeValue
        });
        if (codeTree.language === null) {
            codeTree.value = defaultCodeValue;
        }
        // pre-determine largest line number so that we can force minWidth on all linenumber elements
        var lineBreakCount = (_code$match$length = (_code$match = code.match(/\n/g)) === null || _code$match === void 0 ? void 0 : _code$match.length) !== null && _code$match$length !== void 0 ? _code$match$length : 0;
        var largestLineNumber = startingLineNumber + lineBreakCount;
        var rows = processLines(codeTree, wrapLines, lineProps, showLineNumbers, showInlineLineNumbers, startingLineNumber, largestLineNumber, lineNumberStyle, wrapLongLines);
        return /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(PreTag, preProps, /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(CodeTag, codeTagProps, !showInlineLineNumbers && allLineNumbers, renderer({
            rows: rows,
            stylesheet: style,
            useInlineStyles: useInlineStyles
        })));
    };
}
}),
"[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/styles/hljs/default-style.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
const __TURBOPACK__default__export__ = {
    "hljs": {
        "display": "block",
        "overflowX": "auto",
        "padding": "0.5em",
        "background": "#F0F0F0",
        "color": "#444"
    },
    "hljs-subst": {
        "color": "#444"
    },
    "hljs-comment": {
        "color": "#888888"
    },
    "hljs-keyword": {
        "fontWeight": "bold"
    },
    "hljs-attribute": {
        "fontWeight": "bold"
    },
    "hljs-selector-tag": {
        "fontWeight": "bold"
    },
    "hljs-meta-keyword": {
        "fontWeight": "bold"
    },
    "hljs-doctag": {
        "fontWeight": "bold"
    },
    "hljs-name": {
        "fontWeight": "bold"
    },
    "hljs-type": {
        "color": "#880000"
    },
    "hljs-string": {
        "color": "#880000"
    },
    "hljs-number": {
        "color": "#880000"
    },
    "hljs-selector-id": {
        "color": "#880000"
    },
    "hljs-selector-class": {
        "color": "#880000"
    },
    "hljs-quote": {
        "color": "#880000"
    },
    "hljs-template-tag": {
        "color": "#880000"
    },
    "hljs-deletion": {
        "color": "#880000"
    },
    "hljs-title": {
        "color": "#880000",
        "fontWeight": "bold"
    },
    "hljs-section": {
        "color": "#880000",
        "fontWeight": "bold"
    },
    "hljs-regexp": {
        "color": "#BC6060"
    },
    "hljs-symbol": {
        "color": "#BC6060"
    },
    "hljs-variable": {
        "color": "#BC6060"
    },
    "hljs-template-variable": {
        "color": "#BC6060"
    },
    "hljs-link": {
        "color": "#BC6060"
    },
    "hljs-selector-attr": {
        "color": "#BC6060"
    },
    "hljs-selector-pseudo": {
        "color": "#BC6060"
    },
    "hljs-literal": {
        "color": "#78A960"
    },
    "hljs-built_in": {
        "color": "#397300"
    },
    "hljs-bullet": {
        "color": "#397300"
    },
    "hljs-code": {
        "color": "#397300"
    },
    "hljs-addition": {
        "color": "#397300"
    },
    "hljs-meta": {
        "color": "#1f7199"
    },
    "hljs-meta-string": {
        "color": "#4d99bf"
    },
    "hljs-emphasis": {
        "fontStyle": "italic"
    },
    "hljs-strong": {
        "fontWeight": "bold"
    }
};
}),
"[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/languages/hljs/supported-languages.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

//
// This file has been auto-generated by the `npm run build-languages-hljs` task
//
__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
const __TURBOPACK__default__export__ = [
    '1c',
    'abnf',
    'accesslog',
    'actionscript',
    'ada',
    'angelscript',
    'apache',
    'applescript',
    'arcade',
    'arduino',
    'armasm',
    'asciidoc',
    'aspectj',
    'autohotkey',
    'autoit',
    'avrasm',
    'awk',
    'axapta',
    'bash',
    'basic',
    'bnf',
    'brainfuck',
    'c-like',
    'c',
    'cal',
    'capnproto',
    'ceylon',
    'clean',
    'clojure-repl',
    'clojure',
    'cmake',
    'coffeescript',
    'coq',
    'cos',
    'cpp',
    'crmsh',
    'crystal',
    'csharp',
    'csp',
    'css',
    'd',
    'dart',
    'delphi',
    'diff',
    'django',
    'dns',
    'dockerfile',
    'dos',
    'dsconfig',
    'dts',
    'dust',
    'ebnf',
    'elixir',
    'elm',
    'erb',
    'erlang-repl',
    'erlang',
    'excel',
    'fix',
    'flix',
    'fortran',
    'fsharp',
    'gams',
    'gauss',
    'gcode',
    'gherkin',
    'glsl',
    'gml',
    'go',
    'golo',
    'gradle',
    'groovy',
    'haml',
    'handlebars',
    'haskell',
    'haxe',
    'hsp',
    'htmlbars',
    'http',
    'hy',
    'inform7',
    'ini',
    'irpf90',
    'isbl',
    'java',
    'javascript',
    'jboss-cli',
    'json',
    'julia-repl',
    'julia',
    'kotlin',
    'lasso',
    'latex',
    'ldif',
    'leaf',
    'less',
    'lisp',
    'livecodeserver',
    'livescript',
    'llvm',
    'lsl',
    'lua',
    'makefile',
    'markdown',
    'mathematica',
    'matlab',
    'maxima',
    'mel',
    'mercury',
    'mipsasm',
    'mizar',
    'mojolicious',
    'monkey',
    'moonscript',
    'n1ql',
    'nginx',
    'nim',
    'nix',
    'node-repl',
    'nsis',
    'objectivec',
    'ocaml',
    'openscad',
    'oxygene',
    'parser3',
    'perl',
    'pf',
    'pgsql',
    'php-template',
    'php',
    'plaintext',
    'pony',
    'powershell',
    'processing',
    'profile',
    'prolog',
    'properties',
    'protobuf',
    'puppet',
    'purebasic',
    'python-repl',
    'python',
    'q',
    'qml',
    'r',
    'reasonml',
    'rib',
    'roboconf',
    'routeros',
    'rsl',
    'ruby',
    'ruleslanguage',
    'rust',
    'sas',
    'scala',
    'scheme',
    'scilab',
    'scss',
    'shell',
    'smali',
    'smalltalk',
    'sml',
    'sqf',
    'sql',
    'sql_more',
    'stan',
    'stata',
    'step21',
    'stylus',
    'subunit',
    'swift',
    'taggerscript',
    'tap',
    'tcl',
    'thrift',
    'tp',
    'twig',
    'typescript',
    'vala',
    'vbnet',
    'vbscript-html',
    'vbscript',
    'verilog',
    'vhdl',
    'vim',
    'x86asm',
    'xl',
    'xml',
    'xquery',
    'yaml',
    'zephir'
];
}),
"[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/default-highlight.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$highlight$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/highlight.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$styles$2f$hljs$2f$default$2d$style$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/styles/hljs/default-style.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$lowlight$40$1$2e$20$2e$0$2f$node_modules$2f$lowlight$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/lowlight@1.20.0/node_modules/lowlight/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$languages$2f$hljs$2f$supported$2d$languages$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/languages/hljs/supported-languages.js [app-client] (ecmascript)");
;
;
;
;
var highlighter = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$highlight$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$lowlight$40$1$2e$20$2e$0$2f$node_modules$2f$lowlight$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$styles$2f$hljs$2f$default$2d$style$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"]);
highlighter.supportedLanguages = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$languages$2f$hljs$2f$supported$2d$languages$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"];
const __TURBOPACK__default__export__ = highlighter;
}),
"[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/async-syntax-highlighter.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$typeof$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@babel/runtime/helpers/esm/typeof.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$asyncToGenerator$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@babel/runtime/helpers/esm/asyncToGenerator.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$extends$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@babel/runtime/helpers/esm/extends.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$classCallCheck$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@babel/runtime/helpers/esm/classCallCheck.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$createClass$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@babel/runtime/helpers/esm/createClass.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$possibleConstructorReturn$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@babel/runtime/helpers/esm/possibleConstructorReturn.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$getPrototypeOf$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@babel/runtime/helpers/esm/getPrototypeOf.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$inherits$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@babel/runtime/helpers/esm/inherits.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$defineProperty$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@babel/runtime/helpers/esm/defineProperty.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$highlight$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/highlight.js [app-client] (ecmascript)");
;
;
;
;
;
;
;
;
;
function _regeneratorRuntime() {
    "use strict"; /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/facebook/regenerator/blob/main/LICENSE */ 
    _regeneratorRuntime = function _regeneratorRuntime() {
        return e;
    };
    var t, e = {}, r = Object.prototype, n = r.hasOwnProperty, o = Object.defineProperty || function(t, e, r) {
        t[e] = r.value;
    }, i = "function" == typeof Symbol ? Symbol : {}, a = i.iterator || "@@iterator", c = i.asyncIterator || "@@asyncIterator", u = i.toStringTag || "@@toStringTag";
    function define(t, e, r) {
        return Object.defineProperty(t, e, {
            value: r,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }), t[e];
    }
    try {
        define({}, "");
    } catch (t) {
        define = function define(t, e, r) {
            return t[e] = r;
        };
    }
    function wrap(t, e, r, n) {
        var i = e && e.prototype instanceof Generator ? e : Generator, a = Object.create(i.prototype), c = new Context(n || []);
        return o(a, "_invoke", {
            value: makeInvokeMethod(t, r, c)
        }), a;
    }
    function tryCatch(t, e, r) {
        try {
            return {
                type: "normal",
                arg: t.call(e, r)
            };
        } catch (t) {
            return {
                type: "throw",
                arg: t
            };
        }
    }
    e.wrap = wrap;
    var h = "suspendedStart", l = "suspendedYield", f = "executing", s = "completed", y = {};
    function Generator() {}
    function GeneratorFunction() {}
    function GeneratorFunctionPrototype() {}
    var p = {};
    define(p, a, function() {
        return this;
    });
    var d = Object.getPrototypeOf, v = d && d(d(values([])));
    v && v !== r && n.call(v, a) && (p = v);
    var g = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(p);
    function defineIteratorMethods(t) {
        [
            "next",
            "throw",
            "return"
        ].forEach(function(e) {
            define(t, e, function(t) {
                return this._invoke(e, t);
            });
        });
    }
    function AsyncIterator(t, e) {
        function invoke(r, o, i, a) {
            var c = tryCatch(t[r], t, o);
            if ("throw" !== c.type) {
                var u = c.arg, h = u.value;
                return h && "object" == (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$typeof$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(h) && n.call(h, "__await") ? e.resolve(h.__await).then(function(t) {
                    invoke("next", t, i, a);
                }, function(t) {
                    invoke("throw", t, i, a);
                }) : e.resolve(h).then(function(t) {
                    u.value = t, i(u);
                }, function(t) {
                    return invoke("throw", t, i, a);
                });
            }
            a(c.arg);
        }
        var r;
        o(this, "_invoke", {
            value: function value(t, n) {
                function callInvokeWithMethodAndArg() {
                    return new e(function(e, r) {
                        invoke(t, n, e, r);
                    });
                }
                return r = r ? r.then(callInvokeWithMethodAndArg, callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg();
            }
        });
    }
    function makeInvokeMethod(e, r, n) {
        var o = h;
        return function(i, a) {
            if (o === f) throw Error("Generator is already running");
            if (o === s) {
                if ("throw" === i) throw a;
                return {
                    value: t,
                    done: !0
                };
            }
            for(n.method = i, n.arg = a;;){
                var c = n.delegate;
                if (c) {
                    var u = maybeInvokeDelegate(c, n);
                    if (u) {
                        if (u === y) continue;
                        return u;
                    }
                }
                if ("next" === n.method) n.sent = n._sent = n.arg;
                else if ("throw" === n.method) {
                    if (o === h) throw o = s, n.arg;
                    n.dispatchException(n.arg);
                } else "return" === n.method && n.abrupt("return", n.arg);
                o = f;
                var p = tryCatch(e, r, n);
                if ("normal" === p.type) {
                    if (o = n.done ? s : l, p.arg === y) continue;
                    return {
                        value: p.arg,
                        done: n.done
                    };
                }
                "throw" === p.type && (o = s, n.method = "throw", n.arg = p.arg);
            }
        };
    }
    function maybeInvokeDelegate(e, r) {
        var n = r.method, o = e.iterator[n];
        if (o === t) return r.delegate = null, "throw" === n && e.iterator["return"] && (r.method = "return", r.arg = t, maybeInvokeDelegate(e, r), "throw" === r.method) || "return" !== n && (r.method = "throw", r.arg = new TypeError("The iterator does not provide a '" + n + "' method")), y;
        var i = tryCatch(o, e.iterator, r.arg);
        if ("throw" === i.type) return r.method = "throw", r.arg = i.arg, r.delegate = null, y;
        var a = i.arg;
        return a ? a.done ? (r[e.resultName] = a.value, r.next = e.nextLoc, "return" !== r.method && (r.method = "next", r.arg = t), r.delegate = null, y) : a : (r.method = "throw", r.arg = new TypeError("iterator result is not an object"), r.delegate = null, y);
    }
    function pushTryEntry(t) {
        var e = {
            tryLoc: t[0]
        };
        1 in t && (e.catchLoc = t[1]), 2 in t && (e.finallyLoc = t[2], e.afterLoc = t[3]), this.tryEntries.push(e);
    }
    function resetTryEntry(t) {
        var e = t.completion || {};
        e.type = "normal", delete e.arg, t.completion = e;
    }
    function Context(t) {
        this.tryEntries = [
            {
                tryLoc: "root"
            }
        ], t.forEach(pushTryEntry, this), this.reset(!0);
    }
    function values(e) {
        if (e || "" === e) {
            var r = e[a];
            if (r) return r.call(e);
            if ("function" == typeof e.next) return e;
            if (!isNaN(e.length)) {
                var o = -1, i = function next() {
                    for(; ++o < e.length;)if (n.call(e, o)) return next.value = e[o], next.done = !1, next;
                    return next.value = t, next.done = !0, next;
                };
                return i.next = i;
            }
        }
        throw new TypeError((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$typeof$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(e) + " is not iterable");
    }
    return GeneratorFunction.prototype = GeneratorFunctionPrototype, o(g, "constructor", {
        value: GeneratorFunctionPrototype,
        configurable: !0
    }), o(GeneratorFunctionPrototype, "constructor", {
        value: GeneratorFunction,
        configurable: !0
    }), GeneratorFunction.displayName = define(GeneratorFunctionPrototype, u, "GeneratorFunction"), e.isGeneratorFunction = function(t) {
        var e = "function" == typeof t && t.constructor;
        return !!e && (e === GeneratorFunction || "GeneratorFunction" === (e.displayName || e.name));
    }, e.mark = function(t) {
        return Object.setPrototypeOf ? Object.setPrototypeOf(t, GeneratorFunctionPrototype) : (t.__proto__ = GeneratorFunctionPrototype, define(t, u, "GeneratorFunction")), t.prototype = Object.create(g), t;
    }, e.awrap = function(t) {
        return {
            __await: t
        };
    }, defineIteratorMethods(AsyncIterator.prototype), define(AsyncIterator.prototype, c, function() {
        return this;
    }), e.AsyncIterator = AsyncIterator, e.async = function(t, r, n, o, i) {
        void 0 === i && (i = Promise);
        var a = new AsyncIterator(wrap(t, r, n, o), i);
        return e.isGeneratorFunction(r) ? a : a.next().then(function(t) {
            return t.done ? t.value : a.next();
        });
    }, defineIteratorMethods(g), define(g, u, "Generator"), define(g, a, function() {
        return this;
    }), define(g, "toString", function() {
        return "[object Generator]";
    }), e.keys = function(t) {
        var e = Object(t), r = [];
        for(var n in e)r.push(n);
        return r.reverse(), function next() {
            for(; r.length;){
                var t = r.pop();
                if (t in e) return next.value = t, next.done = !1, next;
            }
            return next.done = !0, next;
        };
    }, e.values = values, Context.prototype = {
        constructor: Context,
        reset: function reset(e) {
            if (this.prev = 0, this.next = 0, this.sent = this._sent = t, this.done = !1, this.delegate = null, this.method = "next", this.arg = t, this.tryEntries.forEach(resetTryEntry), !e) for(var r in this)"t" === r.charAt(0) && n.call(this, r) && !isNaN(+r.slice(1)) && (this[r] = t);
        },
        stop: function stop() {
            this.done = !0;
            var t = this.tryEntries[0].completion;
            if ("throw" === t.type) throw t.arg;
            return this.rval;
        },
        dispatchException: function dispatchException(e) {
            if (this.done) throw e;
            var r = this;
            function handle(n, o) {
                return a.type = "throw", a.arg = e, r.next = n, o && (r.method = "next", r.arg = t), !!o;
            }
            for(var o = this.tryEntries.length - 1; o >= 0; --o){
                var i = this.tryEntries[o], a = i.completion;
                if ("root" === i.tryLoc) return handle("end");
                if (i.tryLoc <= this.prev) {
                    var c = n.call(i, "catchLoc"), u = n.call(i, "finallyLoc");
                    if (c && u) {
                        if (this.prev < i.catchLoc) return handle(i.catchLoc, !0);
                        if (this.prev < i.finallyLoc) return handle(i.finallyLoc);
                    } else if (c) {
                        if (this.prev < i.catchLoc) return handle(i.catchLoc, !0);
                    } else {
                        if (!u) throw Error("try statement without catch or finally");
                        if (this.prev < i.finallyLoc) return handle(i.finallyLoc);
                    }
                }
            }
        },
        abrupt: function abrupt(t, e) {
            for(var r = this.tryEntries.length - 1; r >= 0; --r){
                var o = this.tryEntries[r];
                if (o.tryLoc <= this.prev && n.call(o, "finallyLoc") && this.prev < o.finallyLoc) {
                    var i = o;
                    break;
                }
            }
            i && ("break" === t || "continue" === t) && i.tryLoc <= e && e <= i.finallyLoc && (i = null);
            var a = i ? i.completion : {};
            return a.type = t, a.arg = e, i ? (this.method = "next", this.next = i.finallyLoc, y) : this.complete(a);
        },
        complete: function complete(t, e) {
            if ("throw" === t.type) throw t.arg;
            return "break" === t.type || "continue" === t.type ? this.next = t.arg : "return" === t.type ? (this.rval = this.arg = t.arg, this.method = "return", this.next = "end") : "normal" === t.type && e && (this.next = e), y;
        },
        finish: function finish(t) {
            for(var e = this.tryEntries.length - 1; e >= 0; --e){
                var r = this.tryEntries[e];
                if (r.finallyLoc === t) return this.complete(r.completion, r.afterLoc), resetTryEntry(r), y;
            }
        },
        "catch": function _catch(t) {
            for(var e = this.tryEntries.length - 1; e >= 0; --e){
                var r = this.tryEntries[e];
                if (r.tryLoc === t) {
                    var n = r.completion;
                    if ("throw" === n.type) {
                        var o = n.arg;
                        resetTryEntry(r);
                    }
                    return o;
                }
            }
            throw Error("illegal catch attempt");
        },
        delegateYield: function delegateYield(e, r, n) {
            return this.delegate = {
                iterator: values(e),
                resultName: r,
                nextLoc: n
            }, "next" === this.method && (this.arg = t), y;
        }
    }, e;
}
function _callSuper(t, o, e) {
    return o = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$getPrototypeOf$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(o), (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$possibleConstructorReturn$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(t, _isNativeReflectConstruct() ? Reflect.construct(o, e || [], (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$getPrototypeOf$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(t).constructor) : o.apply(t, e));
}
function _isNativeReflectConstruct() {
    try {
        var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {}));
    } catch (t) {}
    return (_isNativeReflectConstruct = function _isNativeReflectConstruct() {
        return !!t;
    })();
}
;
;
const __TURBOPACK__default__export__ = function(options) {
    var _ReactAsyncHighlighter;
    var loader = options.loader, isLanguageRegistered = options.isLanguageRegistered, registerLanguage = options.registerLanguage, languageLoaders = options.languageLoaders, noAsyncLoadingLanguages = options.noAsyncLoadingLanguages;
    var ReactAsyncHighlighter = /*#__PURE__*/ function(_React$PureComponent) {
        function ReactAsyncHighlighter() {
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$classCallCheck$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(this, ReactAsyncHighlighter);
            return _callSuper(this, ReactAsyncHighlighter, arguments);
        }
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$inherits$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(ReactAsyncHighlighter, _React$PureComponent);
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$createClass$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(ReactAsyncHighlighter, [
            {
                key: "componentDidUpdate",
                value: function componentDidUpdate() {
                    if (!ReactAsyncHighlighter.isRegistered(this.props.language) && languageLoaders) {
                        this.loadLanguage();
                    }
                }
            },
            {
                key: "componentDidMount",
                value: function componentDidMount() {
                    var _this = this;
                    if (!ReactAsyncHighlighter.astGeneratorPromise) {
                        ReactAsyncHighlighter.loadAstGenerator();
                    }
                    if (!ReactAsyncHighlighter.astGenerator) {
                        ReactAsyncHighlighter.astGeneratorPromise.then(function() {
                            _this.forceUpdate();
                        });
                    }
                    if (!ReactAsyncHighlighter.isRegistered(this.props.language) && languageLoaders) {
                        this.loadLanguage();
                    }
                }
            },
            {
                key: "loadLanguage",
                value: function loadLanguage() {
                    var _this2 = this;
                    var language = this.props.language;
                    if (language === 'text') {
                        return;
                    }
                    ReactAsyncHighlighter.loadLanguage(language).then(function() {
                        return _this2.forceUpdate();
                    })["catch"](function() {});
                }
            },
            {
                key: "normalizeLanguage",
                value: function normalizeLanguage(language) {
                    return ReactAsyncHighlighter.isSupportedLanguage(language) ? language : 'text';
                }
            },
            {
                key: "render",
                value: function render() {
                    return /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(ReactAsyncHighlighter.highlightInstance, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$extends$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])({}, this.props, {
                        language: this.normalizeLanguage(this.props.language),
                        astGenerator: ReactAsyncHighlighter.astGenerator
                    }));
                }
            }
        ], [
            {
                key: "preload",
                value: function preload() {
                    return ReactAsyncHighlighter.loadAstGenerator();
                }
            },
            {
                key: "loadLanguage",
                value: function() {
                    var _loadLanguage = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$asyncToGenerator$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(/*#__PURE__*/ _regeneratorRuntime().mark(function _callee(language) {
                        var languageLoader;
                        return _regeneratorRuntime().wrap(function _callee$(_context) {
                            while(1)switch(_context.prev = _context.next){
                                case 0:
                                    languageLoader = languageLoaders[language];
                                    if (!(typeof languageLoader === 'function')) {
                                        _context.next = 5;
                                        break;
                                    }
                                    return _context.abrupt("return", languageLoader(ReactAsyncHighlighter.registerLanguage));
                                case 5:
                                    throw new Error("Language ".concat(language, " not supported"));
                                case 6:
                                case "end":
                                    return _context.stop();
                            }
                        }, _callee);
                    }));
                    function loadLanguage(_x) {
                        return _loadLanguage.apply(this, arguments);
                    }
                    return loadLanguage;
                }()
            },
            {
                key: "isSupportedLanguage",
                value: function isSupportedLanguage(language) {
                    return ReactAsyncHighlighter.isRegistered(language) || typeof languageLoaders[language] === 'function';
                }
            },
            {
                key: "loadAstGenerator",
                value: function loadAstGenerator() {
                    ReactAsyncHighlighter.astGeneratorPromise = loader().then(function(astGenerator) {
                        ReactAsyncHighlighter.astGenerator = astGenerator;
                        if (registerLanguage) {
                            ReactAsyncHighlighter.languages.forEach(function(language, name) {
                                return registerLanguage(astGenerator, name, language);
                            });
                        }
                    });
                    return ReactAsyncHighlighter.astGeneratorPromise;
                }
            }
        ]);
    }(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].PureComponent);
    _ReactAsyncHighlighter = ReactAsyncHighlighter;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$defineProperty$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(ReactAsyncHighlighter, "astGenerator", null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$defineProperty$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(ReactAsyncHighlighter, "highlightInstance", (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$highlight$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(null, {}));
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$defineProperty$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(ReactAsyncHighlighter, "astGeneratorPromise", null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$defineProperty$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(ReactAsyncHighlighter, "languages", new Map());
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$defineProperty$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(ReactAsyncHighlighter, "supportedLanguages", options.supportedLanguages || Object.keys(languageLoaders || {}));
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$defineProperty$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(ReactAsyncHighlighter, "isRegistered", function(language) {
        if (noAsyncLoadingLanguages) {
            return true;
        }
        if (!registerLanguage) {
            throw new Error("Current syntax highlighter doesn't support registration of languages");
        }
        if (!_ReactAsyncHighlighter.astGenerator) {
            // Ast generator not available yet, but language will be registered once it is.
            return _ReactAsyncHighlighter.languages.has(language);
        }
        return isLanguageRegistered(_ReactAsyncHighlighter.astGenerator, language);
    });
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$defineProperty$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(ReactAsyncHighlighter, "registerLanguage", function(name, language) {
        if (!registerLanguage) {
            throw new Error("Current syntax highlighter doesn't support registration of languages");
        }
        if (_ReactAsyncHighlighter.astGenerator) {
            return registerLanguage(_ReactAsyncHighlighter.astGenerator, name, language);
        } else {
            _ReactAsyncHighlighter.languages.set(name, language);
        }
    });
    return ReactAsyncHighlighter;
};
}),
"[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/async-languages/create-language-async-loader.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$typeof$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@babel/runtime/helpers/esm/typeof.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$asyncToGenerator$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@babel/runtime/helpers/esm/asyncToGenerator.js [app-client] (ecmascript)");
;
;
function _regeneratorRuntime() {
    "use strict"; /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/facebook/regenerator/blob/main/LICENSE */ 
    _regeneratorRuntime = function _regeneratorRuntime() {
        return e;
    };
    var t, e = {}, r = Object.prototype, n = r.hasOwnProperty, o = Object.defineProperty || function(t, e, r) {
        t[e] = r.value;
    }, i = "function" == typeof Symbol ? Symbol : {}, a = i.iterator || "@@iterator", c = i.asyncIterator || "@@asyncIterator", u = i.toStringTag || "@@toStringTag";
    function define(t, e, r) {
        return Object.defineProperty(t, e, {
            value: r,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }), t[e];
    }
    try {
        define({}, "");
    } catch (t) {
        define = function define(t, e, r) {
            return t[e] = r;
        };
    }
    function wrap(t, e, r, n) {
        var i = e && e.prototype instanceof Generator ? e : Generator, a = Object.create(i.prototype), c = new Context(n || []);
        return o(a, "_invoke", {
            value: makeInvokeMethod(t, r, c)
        }), a;
    }
    function tryCatch(t, e, r) {
        try {
            return {
                type: "normal",
                arg: t.call(e, r)
            };
        } catch (t) {
            return {
                type: "throw",
                arg: t
            };
        }
    }
    e.wrap = wrap;
    var h = "suspendedStart", l = "suspendedYield", f = "executing", s = "completed", y = {};
    function Generator() {}
    function GeneratorFunction() {}
    function GeneratorFunctionPrototype() {}
    var p = {};
    define(p, a, function() {
        return this;
    });
    var d = Object.getPrototypeOf, v = d && d(d(values([])));
    v && v !== r && n.call(v, a) && (p = v);
    var g = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(p);
    function defineIteratorMethods(t) {
        [
            "next",
            "throw",
            "return"
        ].forEach(function(e) {
            define(t, e, function(t) {
                return this._invoke(e, t);
            });
        });
    }
    function AsyncIterator(t, e) {
        function invoke(r, o, i, a) {
            var c = tryCatch(t[r], t, o);
            if ("throw" !== c.type) {
                var u = c.arg, h = u.value;
                return h && "object" == (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$typeof$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(h) && n.call(h, "__await") ? e.resolve(h.__await).then(function(t) {
                    invoke("next", t, i, a);
                }, function(t) {
                    invoke("throw", t, i, a);
                }) : e.resolve(h).then(function(t) {
                    u.value = t, i(u);
                }, function(t) {
                    return invoke("throw", t, i, a);
                });
            }
            a(c.arg);
        }
        var r;
        o(this, "_invoke", {
            value: function value(t, n) {
                function callInvokeWithMethodAndArg() {
                    return new e(function(e, r) {
                        invoke(t, n, e, r);
                    });
                }
                return r = r ? r.then(callInvokeWithMethodAndArg, callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg();
            }
        });
    }
    function makeInvokeMethod(e, r, n) {
        var o = h;
        return function(i, a) {
            if (o === f) throw Error("Generator is already running");
            if (o === s) {
                if ("throw" === i) throw a;
                return {
                    value: t,
                    done: !0
                };
            }
            for(n.method = i, n.arg = a;;){
                var c = n.delegate;
                if (c) {
                    var u = maybeInvokeDelegate(c, n);
                    if (u) {
                        if (u === y) continue;
                        return u;
                    }
                }
                if ("next" === n.method) n.sent = n._sent = n.arg;
                else if ("throw" === n.method) {
                    if (o === h) throw o = s, n.arg;
                    n.dispatchException(n.arg);
                } else "return" === n.method && n.abrupt("return", n.arg);
                o = f;
                var p = tryCatch(e, r, n);
                if ("normal" === p.type) {
                    if (o = n.done ? s : l, p.arg === y) continue;
                    return {
                        value: p.arg,
                        done: n.done
                    };
                }
                "throw" === p.type && (o = s, n.method = "throw", n.arg = p.arg);
            }
        };
    }
    function maybeInvokeDelegate(e, r) {
        var n = r.method, o = e.iterator[n];
        if (o === t) return r.delegate = null, "throw" === n && e.iterator["return"] && (r.method = "return", r.arg = t, maybeInvokeDelegate(e, r), "throw" === r.method) || "return" !== n && (r.method = "throw", r.arg = new TypeError("The iterator does not provide a '" + n + "' method")), y;
        var i = tryCatch(o, e.iterator, r.arg);
        if ("throw" === i.type) return r.method = "throw", r.arg = i.arg, r.delegate = null, y;
        var a = i.arg;
        return a ? a.done ? (r[e.resultName] = a.value, r.next = e.nextLoc, "return" !== r.method && (r.method = "next", r.arg = t), r.delegate = null, y) : a : (r.method = "throw", r.arg = new TypeError("iterator result is not an object"), r.delegate = null, y);
    }
    function pushTryEntry(t) {
        var e = {
            tryLoc: t[0]
        };
        1 in t && (e.catchLoc = t[1]), 2 in t && (e.finallyLoc = t[2], e.afterLoc = t[3]), this.tryEntries.push(e);
    }
    function resetTryEntry(t) {
        var e = t.completion || {};
        e.type = "normal", delete e.arg, t.completion = e;
    }
    function Context(t) {
        this.tryEntries = [
            {
                tryLoc: "root"
            }
        ], t.forEach(pushTryEntry, this), this.reset(!0);
    }
    function values(e) {
        if (e || "" === e) {
            var r = e[a];
            if (r) return r.call(e);
            if ("function" == typeof e.next) return e;
            if (!isNaN(e.length)) {
                var o = -1, i = function next() {
                    for(; ++o < e.length;)if (n.call(e, o)) return next.value = e[o], next.done = !1, next;
                    return next.value = t, next.done = !0, next;
                };
                return i.next = i;
            }
        }
        throw new TypeError((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$typeof$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(e) + " is not iterable");
    }
    return GeneratorFunction.prototype = GeneratorFunctionPrototype, o(g, "constructor", {
        value: GeneratorFunctionPrototype,
        configurable: !0
    }), o(GeneratorFunctionPrototype, "constructor", {
        value: GeneratorFunction,
        configurable: !0
    }), GeneratorFunction.displayName = define(GeneratorFunctionPrototype, u, "GeneratorFunction"), e.isGeneratorFunction = function(t) {
        var e = "function" == typeof t && t.constructor;
        return !!e && (e === GeneratorFunction || "GeneratorFunction" === (e.displayName || e.name));
    }, e.mark = function(t) {
        return Object.setPrototypeOf ? Object.setPrototypeOf(t, GeneratorFunctionPrototype) : (t.__proto__ = GeneratorFunctionPrototype, define(t, u, "GeneratorFunction")), t.prototype = Object.create(g), t;
    }, e.awrap = function(t) {
        return {
            __await: t
        };
    }, defineIteratorMethods(AsyncIterator.prototype), define(AsyncIterator.prototype, c, function() {
        return this;
    }), e.AsyncIterator = AsyncIterator, e.async = function(t, r, n, o, i) {
        void 0 === i && (i = Promise);
        var a = new AsyncIterator(wrap(t, r, n, o), i);
        return e.isGeneratorFunction(r) ? a : a.next().then(function(t) {
            return t.done ? t.value : a.next();
        });
    }, defineIteratorMethods(g), define(g, u, "Generator"), define(g, a, function() {
        return this;
    }), define(g, "toString", function() {
        return "[object Generator]";
    }), e.keys = function(t) {
        var e = Object(t), r = [];
        for(var n in e)r.push(n);
        return r.reverse(), function next() {
            for(; r.length;){
                var t = r.pop();
                if (t in e) return next.value = t, next.done = !1, next;
            }
            return next.done = !0, next;
        };
    }, e.values = values, Context.prototype = {
        constructor: Context,
        reset: function reset(e) {
            if (this.prev = 0, this.next = 0, this.sent = this._sent = t, this.done = !1, this.delegate = null, this.method = "next", this.arg = t, this.tryEntries.forEach(resetTryEntry), !e) for(var r in this)"t" === r.charAt(0) && n.call(this, r) && !isNaN(+r.slice(1)) && (this[r] = t);
        },
        stop: function stop() {
            this.done = !0;
            var t = this.tryEntries[0].completion;
            if ("throw" === t.type) throw t.arg;
            return this.rval;
        },
        dispatchException: function dispatchException(e) {
            if (this.done) throw e;
            var r = this;
            function handle(n, o) {
                return a.type = "throw", a.arg = e, r.next = n, o && (r.method = "next", r.arg = t), !!o;
            }
            for(var o = this.tryEntries.length - 1; o >= 0; --o){
                var i = this.tryEntries[o], a = i.completion;
                if ("root" === i.tryLoc) return handle("end");
                if (i.tryLoc <= this.prev) {
                    var c = n.call(i, "catchLoc"), u = n.call(i, "finallyLoc");
                    if (c && u) {
                        if (this.prev < i.catchLoc) return handle(i.catchLoc, !0);
                        if (this.prev < i.finallyLoc) return handle(i.finallyLoc);
                    } else if (c) {
                        if (this.prev < i.catchLoc) return handle(i.catchLoc, !0);
                    } else {
                        if (!u) throw Error("try statement without catch or finally");
                        if (this.prev < i.finallyLoc) return handle(i.finallyLoc);
                    }
                }
            }
        },
        abrupt: function abrupt(t, e) {
            for(var r = this.tryEntries.length - 1; r >= 0; --r){
                var o = this.tryEntries[r];
                if (o.tryLoc <= this.prev && n.call(o, "finallyLoc") && this.prev < o.finallyLoc) {
                    var i = o;
                    break;
                }
            }
            i && ("break" === t || "continue" === t) && i.tryLoc <= e && e <= i.finallyLoc && (i = null);
            var a = i ? i.completion : {};
            return a.type = t, a.arg = e, i ? (this.method = "next", this.next = i.finallyLoc, y) : this.complete(a);
        },
        complete: function complete(t, e) {
            if ("throw" === t.type) throw t.arg;
            return "break" === t.type || "continue" === t.type ? this.next = t.arg : "return" === t.type ? (this.rval = this.arg = t.arg, this.method = "return", this.next = "end") : "normal" === t.type && e && (this.next = e), y;
        },
        finish: function finish(t) {
            for(var e = this.tryEntries.length - 1; e >= 0; --e){
                var r = this.tryEntries[e];
                if (r.finallyLoc === t) return this.complete(r.completion, r.afterLoc), resetTryEntry(r), y;
            }
        },
        "catch": function _catch(t) {
            for(var e = this.tryEntries.length - 1; e >= 0; --e){
                var r = this.tryEntries[e];
                if (r.tryLoc === t) {
                    var n = r.completion;
                    if ("throw" === n.type) {
                        var o = n.arg;
                        resetTryEntry(r);
                    }
                    return o;
                }
            }
            throw Error("illegal catch attempt");
        },
        delegateYield: function delegateYield(e, r, n) {
            return this.delegate = {
                iterator: values(e),
                resultName: r,
                nextLoc: n
            }, "next" === this.method && (this.arg = t), y;
        }
    }, e;
}
const __TURBOPACK__default__export__ = function(name, loader) {
    return /*#__PURE__*/ function() {
        var _ref = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$babel$2f$runtime$2f$helpers$2f$esm$2f$asyncToGenerator$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(/*#__PURE__*/ _regeneratorRuntime().mark(function _callee(registerLanguage) {
            var module;
            return _regeneratorRuntime().wrap(function _callee$(_context) {
                while(1)switch(_context.prev = _context.next){
                    case 0:
                        _context.next = 2;
                        return loader();
                    case 2:
                        module = _context.sent;
                        registerLanguage(name, module["default"] || module);
                    case 4:
                    case "end":
                        return _context.stop();
                }
            }, _callee);
        }));
        return function(_x) {
            return _ref.apply(this, arguments);
        };
    }();
};
}),
"[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/async-languages/hljs.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/async-languages/create-language-async-loader.js [app-client] (ecmascript)");
;
const __TURBOPACK__default__export__ = {
    oneC: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("oneC", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/1c.js [app-client] (ecmascript, async loader)");
    }),
    abnf: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("abnf", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/abnf.js [app-client] (ecmascript, async loader)");
    }),
    accesslog: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("accesslog", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/accesslog.js [app-client] (ecmascript, async loader)");
    }),
    actionscript: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("actionscript", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/actionscript.js [app-client] (ecmascript, async loader)");
    }),
    ada: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("ada", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/ada.js [app-client] (ecmascript, async loader)");
    }),
    angelscript: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("angelscript", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/angelscript.js [app-client] (ecmascript, async loader)");
    }),
    apache: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("apache", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/apache.js [app-client] (ecmascript, async loader)");
    }),
    applescript: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("applescript", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/applescript.js [app-client] (ecmascript, async loader)");
    }),
    arcade: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("arcade", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/arcade.js [app-client] (ecmascript, async loader)");
    }),
    arduino: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("arduino", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/arduino.js [app-client] (ecmascript, async loader)");
    }),
    armasm: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("armasm", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/armasm.js [app-client] (ecmascript, async loader)");
    }),
    asciidoc: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("asciidoc", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/asciidoc.js [app-client] (ecmascript, async loader)");
    }),
    aspectj: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("aspectj", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/aspectj.js [app-client] (ecmascript, async loader)");
    }),
    autohotkey: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("autohotkey", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/autohotkey.js [app-client] (ecmascript, async loader)");
    }),
    autoit: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("autoit", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/autoit.js [app-client] (ecmascript, async loader)");
    }),
    avrasm: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("avrasm", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/avrasm.js [app-client] (ecmascript, async loader)");
    }),
    awk: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("awk", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/awk.js [app-client] (ecmascript, async loader)");
    }),
    axapta: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("axapta", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/axapta.js [app-client] (ecmascript, async loader)");
    }),
    bash: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("bash", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/bash.js [app-client] (ecmascript, async loader)");
    }),
    basic: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("basic", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/basic.js [app-client] (ecmascript, async loader)");
    }),
    bnf: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("bnf", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/bnf.js [app-client] (ecmascript, async loader)");
    }),
    brainfuck: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("brainfuck", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/brainfuck.js [app-client] (ecmascript, async loader)");
    }),
    cLike: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("cLike", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/c-like.js [app-client] (ecmascript, async loader)");
    }),
    c: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("c", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/c.js [app-client] (ecmascript, async loader)");
    }),
    cal: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("cal", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/cal.js [app-client] (ecmascript, async loader)");
    }),
    capnproto: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("capnproto", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/capnproto.js [app-client] (ecmascript, async loader)");
    }),
    ceylon: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("ceylon", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/ceylon.js [app-client] (ecmascript, async loader)");
    }),
    clean: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("clean", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/clean.js [app-client] (ecmascript, async loader)");
    }),
    clojureRepl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("clojureRepl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/clojure-repl.js [app-client] (ecmascript, async loader)");
    }),
    clojure: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("clojure", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/clojure.js [app-client] (ecmascript, async loader)");
    }),
    cmake: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("cmake", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/cmake.js [app-client] (ecmascript, async loader)");
    }),
    coffeescript: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("coffeescript", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/coffeescript.js [app-client] (ecmascript, async loader)");
    }),
    coq: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("coq", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/coq.js [app-client] (ecmascript, async loader)");
    }),
    cos: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("cos", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/cos.js [app-client] (ecmascript, async loader)");
    }),
    cpp: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("cpp", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/cpp.js [app-client] (ecmascript, async loader)");
    }),
    crmsh: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("crmsh", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/crmsh.js [app-client] (ecmascript, async loader)");
    }),
    crystal: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("crystal", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/crystal.js [app-client] (ecmascript, async loader)");
    }),
    csharp: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("csharp", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/csharp.js [app-client] (ecmascript, async loader)");
    }),
    csp: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("csp", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/csp.js [app-client] (ecmascript, async loader)");
    }),
    css: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("css", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/css.js [app-client] (ecmascript, async loader)");
    }),
    d: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("d", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/d.js [app-client] (ecmascript, async loader)");
    }),
    dart: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("dart", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/dart.js [app-client] (ecmascript, async loader)");
    }),
    delphi: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("delphi", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/delphi.js [app-client] (ecmascript, async loader)");
    }),
    diff: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("diff", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/diff.js [app-client] (ecmascript, async loader)");
    }),
    django: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("django", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/django.js [app-client] (ecmascript, async loader)");
    }),
    dns: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("dns", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/dns.js [app-client] (ecmascript, async loader)");
    }),
    dockerfile: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("dockerfile", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/dockerfile.js [app-client] (ecmascript, async loader)");
    }),
    dos: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("dos", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/dos.js [app-client] (ecmascript, async loader)");
    }),
    dsconfig: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("dsconfig", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/dsconfig.js [app-client] (ecmascript, async loader)");
    }),
    dts: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("dts", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/dts.js [app-client] (ecmascript, async loader)");
    }),
    dust: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("dust", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/dust.js [app-client] (ecmascript, async loader)");
    }),
    ebnf: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("ebnf", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/ebnf.js [app-client] (ecmascript, async loader)");
    }),
    elixir: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("elixir", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/elixir.js [app-client] (ecmascript, async loader)");
    }),
    elm: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("elm", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/elm.js [app-client] (ecmascript, async loader)");
    }),
    erb: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("erb", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/erb.js [app-client] (ecmascript, async loader)");
    }),
    erlangRepl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("erlangRepl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/erlang-repl.js [app-client] (ecmascript, async loader)");
    }),
    erlang: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("erlang", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/erlang.js [app-client] (ecmascript, async loader)");
    }),
    excel: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("excel", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/excel.js [app-client] (ecmascript, async loader)");
    }),
    fix: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("fix", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/fix.js [app-client] (ecmascript, async loader)");
    }),
    flix: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("flix", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/flix.js [app-client] (ecmascript, async loader)");
    }),
    fortran: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("fortran", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/fortran.js [app-client] (ecmascript, async loader)");
    }),
    fsharp: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("fsharp", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/fsharp.js [app-client] (ecmascript, async loader)");
    }),
    gams: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("gams", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/gams.js [app-client] (ecmascript, async loader)");
    }),
    gauss: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("gauss", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/gauss.js [app-client] (ecmascript, async loader)");
    }),
    gcode: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("gcode", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/gcode.js [app-client] (ecmascript, async loader)");
    }),
    gherkin: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("gherkin", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/gherkin.js [app-client] (ecmascript, async loader)");
    }),
    glsl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("glsl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/glsl.js [app-client] (ecmascript, async loader)");
    }),
    gml: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("gml", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/gml.js [app-client] (ecmascript, async loader)");
    }),
    go: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("go", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/go.js [app-client] (ecmascript, async loader)");
    }),
    golo: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("golo", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/golo.js [app-client] (ecmascript, async loader)");
    }),
    gradle: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("gradle", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/gradle.js [app-client] (ecmascript, async loader)");
    }),
    groovy: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("groovy", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/groovy.js [app-client] (ecmascript, async loader)");
    }),
    haml: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("haml", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/haml.js [app-client] (ecmascript, async loader)");
    }),
    handlebars: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("handlebars", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/handlebars.js [app-client] (ecmascript, async loader)");
    }),
    haskell: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("haskell", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/haskell.js [app-client] (ecmascript, async loader)");
    }),
    haxe: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("haxe", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/haxe.js [app-client] (ecmascript, async loader)");
    }),
    hsp: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("hsp", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/hsp.js [app-client] (ecmascript, async loader)");
    }),
    htmlbars: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("htmlbars", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/htmlbars.js [app-client] (ecmascript, async loader)");
    }),
    http: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("http", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/http.js [app-client] (ecmascript, async loader)");
    }),
    hy: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("hy", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/hy.js [app-client] (ecmascript, async loader)");
    }),
    inform7: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("inform7", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/inform7.js [app-client] (ecmascript, async loader)");
    }),
    ini: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("ini", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/ini.js [app-client] (ecmascript, async loader)");
    }),
    irpf90: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("irpf90", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/irpf90.js [app-client] (ecmascript, async loader)");
    }),
    isbl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("isbl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/isbl.js [app-client] (ecmascript, async loader)");
    }),
    java: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("java", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/java.js [app-client] (ecmascript, async loader)");
    }),
    javascript: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("javascript", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/javascript.js [app-client] (ecmascript, async loader)");
    }),
    jbossCli: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("jbossCli", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/jboss-cli.js [app-client] (ecmascript, async loader)");
    }),
    json: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("json", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/json.js [app-client] (ecmascript, async loader)");
    }),
    juliaRepl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("juliaRepl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/julia-repl.js [app-client] (ecmascript, async loader)");
    }),
    julia: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("julia", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/julia.js [app-client] (ecmascript, async loader)");
    }),
    kotlin: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("kotlin", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/kotlin.js [app-client] (ecmascript, async loader)");
    }),
    lasso: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("lasso", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/lasso.js [app-client] (ecmascript, async loader)");
    }),
    latex: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("latex", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/latex.js [app-client] (ecmascript, async loader)");
    }),
    ldif: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("ldif", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/ldif.js [app-client] (ecmascript, async loader)");
    }),
    leaf: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("leaf", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/leaf.js [app-client] (ecmascript, async loader)");
    }),
    less: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("less", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/less.js [app-client] (ecmascript, async loader)");
    }),
    lisp: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("lisp", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/lisp.js [app-client] (ecmascript, async loader)");
    }),
    livecodeserver: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("livecodeserver", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/livecodeserver.js [app-client] (ecmascript, async loader)");
    }),
    livescript: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("livescript", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/livescript.js [app-client] (ecmascript, async loader)");
    }),
    llvm: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("llvm", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/llvm.js [app-client] (ecmascript, async loader)");
    }),
    lsl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("lsl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/lsl.js [app-client] (ecmascript, async loader)");
    }),
    lua: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("lua", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/lua.js [app-client] (ecmascript, async loader)");
    }),
    makefile: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("makefile", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/makefile.js [app-client] (ecmascript, async loader)");
    }),
    markdown: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("markdown", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/markdown.js [app-client] (ecmascript, async loader)");
    }),
    mathematica: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("mathematica", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/mathematica.js [app-client] (ecmascript, async loader)");
    }),
    matlab: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("matlab", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/matlab.js [app-client] (ecmascript, async loader)");
    }),
    maxima: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("maxima", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/maxima.js [app-client] (ecmascript, async loader)");
    }),
    mel: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("mel", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/mel.js [app-client] (ecmascript, async loader)");
    }),
    mercury: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("mercury", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/mercury.js [app-client] (ecmascript, async loader)");
    }),
    mipsasm: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("mipsasm", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/mipsasm.js [app-client] (ecmascript, async loader)");
    }),
    mizar: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("mizar", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/mizar.js [app-client] (ecmascript, async loader)");
    }),
    mojolicious: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("mojolicious", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/mojolicious.js [app-client] (ecmascript, async loader)");
    }),
    monkey: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("monkey", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/monkey.js [app-client] (ecmascript, async loader)");
    }),
    moonscript: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("moonscript", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/moonscript.js [app-client] (ecmascript, async loader)");
    }),
    n1ql: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("n1ql", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/n1ql.js [app-client] (ecmascript, async loader)");
    }),
    nginx: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("nginx", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/nginx.js [app-client] (ecmascript, async loader)");
    }),
    nim: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("nim", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/nim.js [app-client] (ecmascript, async loader)");
    }),
    nix: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("nix", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/nix.js [app-client] (ecmascript, async loader)");
    }),
    nodeRepl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("nodeRepl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/node-repl.js [app-client] (ecmascript, async loader)");
    }),
    nsis: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("nsis", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/nsis.js [app-client] (ecmascript, async loader)");
    }),
    objectivec: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("objectivec", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/objectivec.js [app-client] (ecmascript, async loader)");
    }),
    ocaml: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("ocaml", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/ocaml.js [app-client] (ecmascript, async loader)");
    }),
    openscad: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("openscad", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/openscad.js [app-client] (ecmascript, async loader)");
    }),
    oxygene: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("oxygene", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/oxygene.js [app-client] (ecmascript, async loader)");
    }),
    parser3: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("parser3", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/parser3.js [app-client] (ecmascript, async loader)");
    }),
    perl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("perl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/perl.js [app-client] (ecmascript, async loader)");
    }),
    pf: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("pf", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/pf.js [app-client] (ecmascript, async loader)");
    }),
    pgsql: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("pgsql", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/pgsql.js [app-client] (ecmascript, async loader)");
    }),
    phpTemplate: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("phpTemplate", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/php-template.js [app-client] (ecmascript, async loader)");
    }),
    php: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("php", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/php.js [app-client] (ecmascript, async loader)");
    }),
    plaintext: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("plaintext", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/plaintext.js [app-client] (ecmascript, async loader)");
    }),
    pony: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("pony", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/pony.js [app-client] (ecmascript, async loader)");
    }),
    powershell: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("powershell", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/powershell.js [app-client] (ecmascript, async loader)");
    }),
    processing: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("processing", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/processing.js [app-client] (ecmascript, async loader)");
    }),
    profile: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("profile", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/profile.js [app-client] (ecmascript, async loader)");
    }),
    prolog: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("prolog", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/prolog.js [app-client] (ecmascript, async loader)");
    }),
    properties: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("properties", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/properties.js [app-client] (ecmascript, async loader)");
    }),
    protobuf: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("protobuf", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/protobuf.js [app-client] (ecmascript, async loader)");
    }),
    puppet: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("puppet", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/puppet.js [app-client] (ecmascript, async loader)");
    }),
    purebasic: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("purebasic", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/purebasic.js [app-client] (ecmascript, async loader)");
    }),
    pythonRepl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("pythonRepl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/python-repl.js [app-client] (ecmascript, async loader)");
    }),
    python: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("python", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/python.js [app-client] (ecmascript, async loader)");
    }),
    q: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("q", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/q.js [app-client] (ecmascript, async loader)");
    }),
    qml: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("qml", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/qml.js [app-client] (ecmascript, async loader)");
    }),
    r: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("r", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/r.js [app-client] (ecmascript, async loader)");
    }),
    reasonml: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("reasonml", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/reasonml.js [app-client] (ecmascript, async loader)");
    }),
    rib: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("rib", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/rib.js [app-client] (ecmascript, async loader)");
    }),
    roboconf: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("roboconf", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/roboconf.js [app-client] (ecmascript, async loader)");
    }),
    routeros: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("routeros", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/routeros.js [app-client] (ecmascript, async loader)");
    }),
    rsl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("rsl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/rsl.js [app-client] (ecmascript, async loader)");
    }),
    ruby: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("ruby", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/ruby.js [app-client] (ecmascript, async loader)");
    }),
    ruleslanguage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("ruleslanguage", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/ruleslanguage.js [app-client] (ecmascript, async loader)");
    }),
    rust: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("rust", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/rust.js [app-client] (ecmascript, async loader)");
    }),
    sas: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("sas", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/sas.js [app-client] (ecmascript, async loader)");
    }),
    scala: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("scala", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/scala.js [app-client] (ecmascript, async loader)");
    }),
    scheme: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("scheme", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/scheme.js [app-client] (ecmascript, async loader)");
    }),
    scilab: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("scilab", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/scilab.js [app-client] (ecmascript, async loader)");
    }),
    scss: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("scss", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/scss.js [app-client] (ecmascript, async loader)");
    }),
    shell: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("shell", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/shell.js [app-client] (ecmascript, async loader)");
    }),
    smali: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("smali", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/smali.js [app-client] (ecmascript, async loader)");
    }),
    smalltalk: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("smalltalk", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/smalltalk.js [app-client] (ecmascript, async loader)");
    }),
    sml: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("sml", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/sml.js [app-client] (ecmascript, async loader)");
    }),
    sqf: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("sqf", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/sqf.js [app-client] (ecmascript, async loader)");
    }),
    sql: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("sql", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/sql.js [app-client] (ecmascript, async loader)");
    }),
    sqlMore: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("sqlMore", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/sql_more.js [app-client] (ecmascript, async loader)");
    }),
    stan: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("stan", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/stan.js [app-client] (ecmascript, async loader)");
    }),
    stata: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("stata", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/stata.js [app-client] (ecmascript, async loader)");
    }),
    step21: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("step21", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/step21.js [app-client] (ecmascript, async loader)");
    }),
    stylus: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("stylus", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/stylus.js [app-client] (ecmascript, async loader)");
    }),
    subunit: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("subunit", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/subunit.js [app-client] (ecmascript, async loader)");
    }),
    swift: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("swift", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/swift.js [app-client] (ecmascript, async loader)");
    }),
    taggerscript: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("taggerscript", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/taggerscript.js [app-client] (ecmascript, async loader)");
    }),
    tap: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("tap", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/tap.js [app-client] (ecmascript, async loader)");
    }),
    tcl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("tcl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/tcl.js [app-client] (ecmascript, async loader)");
    }),
    thrift: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("thrift", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/thrift.js [app-client] (ecmascript, async loader)");
    }),
    tp: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("tp", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/tp.js [app-client] (ecmascript, async loader)");
    }),
    twig: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("twig", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/twig.js [app-client] (ecmascript, async loader)");
    }),
    typescript: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("typescript", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/typescript.js [app-client] (ecmascript, async loader)");
    }),
    vala: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("vala", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/vala.js [app-client] (ecmascript, async loader)");
    }),
    vbnet: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("vbnet", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/vbnet.js [app-client] (ecmascript, async loader)");
    }),
    vbscriptHtml: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("vbscriptHtml", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/vbscript-html.js [app-client] (ecmascript, async loader)");
    }),
    vbscript: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("vbscript", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/vbscript.js [app-client] (ecmascript, async loader)");
    }),
    verilog: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("verilog", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/verilog.js [app-client] (ecmascript, async loader)");
    }),
    vhdl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("vhdl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/vhdl.js [app-client] (ecmascript, async loader)");
    }),
    vim: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("vim", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/vim.js [app-client] (ecmascript, async loader)");
    }),
    x86asm: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("x86asm", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/x86asm.js [app-client] (ecmascript, async loader)");
    }),
    xl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("xl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/xl.js [app-client] (ecmascript, async loader)");
    }),
    xml: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("xml", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/xml.js [app-client] (ecmascript, async loader)");
    }),
    xquery: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("xquery", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/xquery.js [app-client] (ecmascript, async loader)");
    }),
    yaml: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("yaml", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/yaml.js [app-client] (ecmascript, async loader)");
    }),
    zephir: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("zephir", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/zephir.js [app-client] (ecmascript, async loader)");
    })
};
}),
"[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/light-async.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$syntax$2d$highlighter$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/async-syntax-highlighter.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$hljs$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/async-languages/hljs.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$checkForListedLanguage$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/checkForListedLanguage.js [app-client] (ecmascript)");
;
;
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$syntax$2d$highlighter$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])({
    loader: function loader() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/lowlight@1.20.0/node_modules/lowlight/lib/core.js [app-client] (ecmascript, async loader)").then(function(module) {
            // Webpack 3 returns module.exports as default as module, but webpack 4 returns module.exports as module.default
            return module["default"] || module;
        });
    },
    isLanguageRegistered: function isLanguageRegistered(instance, language) {
        return !!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$checkForListedLanguage$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(instance, language);
    },
    languageLoaders: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$hljs$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"],
    registerLanguage: function registerLanguage(instance, name, language) {
        return instance.registerLanguage(name, language);
    }
});
}),
"[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/light.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$highlight$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/highlight.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$lowlight$40$1$2e$20$2e$0$2f$node_modules$2f$lowlight$2f$lib$2f$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/lowlight@1.20.0/node_modules/lowlight/lib/core.js [app-client] (ecmascript)");
;
;
var SyntaxHighlighter = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$highlight$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$lowlight$40$1$2e$20$2e$0$2f$node_modules$2f$lowlight$2f$lib$2f$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {});
SyntaxHighlighter.registerLanguage = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$lowlight$40$1$2e$20$2e$0$2f$node_modules$2f$lowlight$2f$lib$2f$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].registerLanguage;
const __TURBOPACK__default__export__ = SyntaxHighlighter;
}),
"[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/async-languages/prism.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/async-languages/create-language-async-loader.js [app-client] (ecmascript)");
;
const __TURBOPACK__default__export__ = {
    abap: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("abap", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/abap.js [app-client] (ecmascript, async loader)");
    }),
    abnf: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("abnf", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/abnf.js [app-client] (ecmascript, async loader)");
    }),
    actionscript: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("actionscript", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/actionscript.js [app-client] (ecmascript, async loader)");
    }),
    ada: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("ada", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/ada.js [app-client] (ecmascript, async loader)");
    }),
    agda: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("agda", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/agda.js [app-client] (ecmascript, async loader)");
    }),
    al: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("al", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/al.js [app-client] (ecmascript, async loader)");
    }),
    antlr4: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("antlr4", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/antlr4.js [app-client] (ecmascript, async loader)");
    }),
    apacheconf: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("apacheconf", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/apacheconf.js [app-client] (ecmascript, async loader)");
    }),
    apex: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("apex", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/apex.js [app-client] (ecmascript, async loader)");
    }),
    apl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("apl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/apl.js [app-client] (ecmascript, async loader)");
    }),
    applescript: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("applescript", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/applescript.js [app-client] (ecmascript, async loader)");
    }),
    aql: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("aql", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/aql.js [app-client] (ecmascript, async loader)");
    }),
    arduino: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("arduino", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/arduino.js [app-client] (ecmascript, async loader)");
    }),
    arff: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("arff", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/arff.js [app-client] (ecmascript, async loader)");
    }),
    asciidoc: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("asciidoc", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/asciidoc.js [app-client] (ecmascript, async loader)");
    }),
    asm6502: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("asm6502", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/asm6502.js [app-client] (ecmascript, async loader)");
    }),
    asmatmel: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("asmatmel", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/asmatmel.js [app-client] (ecmascript, async loader)");
    }),
    aspnet: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("aspnet", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/aspnet.js [app-client] (ecmascript, async loader)");
    }),
    autohotkey: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("autohotkey", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/autohotkey.js [app-client] (ecmascript, async loader)");
    }),
    autoit: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("autoit", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/autoit.js [app-client] (ecmascript, async loader)");
    }),
    avisynth: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("avisynth", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/avisynth.js [app-client] (ecmascript, async loader)");
    }),
    avroIdl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("avroIdl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/avro-idl.js [app-client] (ecmascript, async loader)");
    }),
    bash: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("bash", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/bash.js [app-client] (ecmascript, async loader)");
    }),
    basic: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("basic", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/basic.js [app-client] (ecmascript, async loader)");
    }),
    batch: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("batch", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/batch.js [app-client] (ecmascript, async loader)");
    }),
    bbcode: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("bbcode", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/bbcode.js [app-client] (ecmascript, async loader)");
    }),
    bicep: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("bicep", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/bicep.js [app-client] (ecmascript, async loader)");
    }),
    birb: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("birb", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/birb.js [app-client] (ecmascript, async loader)");
    }),
    bison: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("bison", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/bison.js [app-client] (ecmascript, async loader)");
    }),
    bnf: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("bnf", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/bnf.js [app-client] (ecmascript, async loader)");
    }),
    brainfuck: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("brainfuck", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/brainfuck.js [app-client] (ecmascript, async loader)");
    }),
    brightscript: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("brightscript", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/brightscript.js [app-client] (ecmascript, async loader)");
    }),
    bro: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("bro", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/bro.js [app-client] (ecmascript, async loader)");
    }),
    bsl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("bsl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/bsl.js [app-client] (ecmascript, async loader)");
    }),
    c: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("c", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/c.js [app-client] (ecmascript, async loader)");
    }),
    cfscript: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("cfscript", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/cfscript.js [app-client] (ecmascript, async loader)");
    }),
    chaiscript: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("chaiscript", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/chaiscript.js [app-client] (ecmascript, async loader)");
    }),
    cil: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("cil", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/cil.js [app-client] (ecmascript, async loader)");
    }),
    clike: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("clike", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/clike.js [app-client] (ecmascript, async loader)");
    }),
    clojure: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("clojure", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/clojure.js [app-client] (ecmascript, async loader)");
    }),
    cmake: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("cmake", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/cmake.js [app-client] (ecmascript, async loader)");
    }),
    cobol: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("cobol", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/cobol.js [app-client] (ecmascript, async loader)");
    }),
    coffeescript: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("coffeescript", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/coffeescript.js [app-client] (ecmascript, async loader)");
    }),
    concurnas: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("concurnas", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/concurnas.js [app-client] (ecmascript, async loader)");
    }),
    coq: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("coq", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/coq.js [app-client] (ecmascript, async loader)");
    }),
    cpp: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("cpp", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/cpp.js [app-client] (ecmascript, async loader)");
    }),
    crystal: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("crystal", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/crystal.js [app-client] (ecmascript, async loader)");
    }),
    csharp: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("csharp", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/csharp.js [app-client] (ecmascript, async loader)");
    }),
    cshtml: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("cshtml", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/cshtml.js [app-client] (ecmascript, async loader)");
    }),
    csp: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("csp", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/csp.js [app-client] (ecmascript, async loader)");
    }),
    cssExtras: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("cssExtras", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/css-extras.js [app-client] (ecmascript, async loader)");
    }),
    css: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("css", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/css.js [app-client] (ecmascript, async loader)");
    }),
    csv: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("csv", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/csv.js [app-client] (ecmascript, async loader)");
    }),
    cypher: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("cypher", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/cypher.js [app-client] (ecmascript, async loader)");
    }),
    d: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("d", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/d.js [app-client] (ecmascript, async loader)");
    }),
    dart: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("dart", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/dart.js [app-client] (ecmascript, async loader)");
    }),
    dataweave: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("dataweave", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/dataweave.js [app-client] (ecmascript, async loader)");
    }),
    dax: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("dax", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/dax.js [app-client] (ecmascript, async loader)");
    }),
    dhall: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("dhall", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/dhall.js [app-client] (ecmascript, async loader)");
    }),
    diff: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("diff", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/diff.js [app-client] (ecmascript, async loader)");
    }),
    django: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("django", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/django.js [app-client] (ecmascript, async loader)");
    }),
    dnsZoneFile: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("dnsZoneFile", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/dns-zone-file.js [app-client] (ecmascript, async loader)");
    }),
    docker: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("docker", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/docker.js [app-client] (ecmascript, async loader)");
    }),
    dot: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("dot", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/dot.js [app-client] (ecmascript, async loader)");
    }),
    ebnf: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("ebnf", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/ebnf.js [app-client] (ecmascript, async loader)");
    }),
    editorconfig: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("editorconfig", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/editorconfig.js [app-client] (ecmascript, async loader)");
    }),
    eiffel: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("eiffel", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/eiffel.js [app-client] (ecmascript, async loader)");
    }),
    ejs: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("ejs", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/ejs.js [app-client] (ecmascript, async loader)");
    }),
    elixir: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("elixir", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/elixir.js [app-client] (ecmascript, async loader)");
    }),
    elm: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("elm", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/elm.js [app-client] (ecmascript, async loader)");
    }),
    erb: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("erb", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/erb.js [app-client] (ecmascript, async loader)");
    }),
    erlang: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("erlang", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/erlang.js [app-client] (ecmascript, async loader)");
    }),
    etlua: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("etlua", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/etlua.js [app-client] (ecmascript, async loader)");
    }),
    excelFormula: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("excelFormula", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/excel-formula.js [app-client] (ecmascript, async loader)");
    }),
    factor: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("factor", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/factor.js [app-client] (ecmascript, async loader)");
    }),
    falselang: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("falselang", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/false.js [app-client] (ecmascript, async loader)");
    }),
    firestoreSecurityRules: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("firestoreSecurityRules", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/firestore-security-rules.js [app-client] (ecmascript, async loader)");
    }),
    flow: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("flow", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/flow.js [app-client] (ecmascript, async loader)");
    }),
    fortran: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("fortran", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/fortran.js [app-client] (ecmascript, async loader)");
    }),
    fsharp: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("fsharp", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/fsharp.js [app-client] (ecmascript, async loader)");
    }),
    ftl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("ftl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/ftl.js [app-client] (ecmascript, async loader)");
    }),
    gap: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("gap", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/gap.js [app-client] (ecmascript, async loader)");
    }),
    gcode: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("gcode", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/gcode.js [app-client] (ecmascript, async loader)");
    }),
    gdscript: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("gdscript", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/gdscript.js [app-client] (ecmascript, async loader)");
    }),
    gedcom: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("gedcom", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/gedcom.js [app-client] (ecmascript, async loader)");
    }),
    gherkin: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("gherkin", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/gherkin.js [app-client] (ecmascript, async loader)");
    }),
    git: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("git", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/git.js [app-client] (ecmascript, async loader)");
    }),
    glsl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("glsl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/glsl.js [app-client] (ecmascript, async loader)");
    }),
    gml: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("gml", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/gml.js [app-client] (ecmascript, async loader)");
    }),
    gn: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("gn", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/gn.js [app-client] (ecmascript, async loader)");
    }),
    goModule: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("goModule", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/go-module.js [app-client] (ecmascript, async loader)");
    }),
    go: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("go", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/go.js [app-client] (ecmascript, async loader)");
    }),
    graphql: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("graphql", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/graphql.js [app-client] (ecmascript, async loader)");
    }),
    groovy: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("groovy", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/groovy.js [app-client] (ecmascript, async loader)");
    }),
    haml: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("haml", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/haml.js [app-client] (ecmascript, async loader)");
    }),
    handlebars: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("handlebars", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/handlebars.js [app-client] (ecmascript, async loader)");
    }),
    haskell: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("haskell", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/haskell.js [app-client] (ecmascript, async loader)");
    }),
    haxe: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("haxe", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/haxe.js [app-client] (ecmascript, async loader)");
    }),
    hcl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("hcl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/hcl.js [app-client] (ecmascript, async loader)");
    }),
    hlsl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("hlsl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/hlsl.js [app-client] (ecmascript, async loader)");
    }),
    hoon: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("hoon", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/hoon.js [app-client] (ecmascript, async loader)");
    }),
    hpkp: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("hpkp", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/hpkp.js [app-client] (ecmascript, async loader)");
    }),
    hsts: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("hsts", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/hsts.js [app-client] (ecmascript, async loader)");
    }),
    http: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("http", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/http.js [app-client] (ecmascript, async loader)");
    }),
    ichigojam: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("ichigojam", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/ichigojam.js [app-client] (ecmascript, async loader)");
    }),
    icon: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("icon", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/icon.js [app-client] (ecmascript, async loader)");
    }),
    icuMessageFormat: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("icuMessageFormat", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/icu-message-format.js [app-client] (ecmascript, async loader)");
    }),
    idris: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("idris", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/idris.js [app-client] (ecmascript, async loader)");
    }),
    iecst: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("iecst", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/iecst.js [app-client] (ecmascript, async loader)");
    }),
    ignore: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("ignore", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/ignore.js [app-client] (ecmascript, async loader)");
    }),
    inform7: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("inform7", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/inform7.js [app-client] (ecmascript, async loader)");
    }),
    ini: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("ini", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/ini.js [app-client] (ecmascript, async loader)");
    }),
    io: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("io", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/io.js [app-client] (ecmascript, async loader)");
    }),
    j: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("j", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/j.js [app-client] (ecmascript, async loader)");
    }),
    java: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("java", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/java.js [app-client] (ecmascript, async loader)");
    }),
    javadoc: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("javadoc", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/javadoc.js [app-client] (ecmascript, async loader)");
    }),
    javadoclike: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("javadoclike", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/javadoclike.js [app-client] (ecmascript, async loader)");
    }),
    javascript: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("javascript", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/javascript.js [app-client] (ecmascript, async loader)");
    }),
    javastacktrace: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("javastacktrace", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/javastacktrace.js [app-client] (ecmascript, async loader)");
    }),
    jexl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("jexl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/jexl.js [app-client] (ecmascript, async loader)");
    }),
    jolie: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("jolie", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/jolie.js [app-client] (ecmascript, async loader)");
    }),
    jq: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("jq", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/jq.js [app-client] (ecmascript, async loader)");
    }),
    jsExtras: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("jsExtras", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/js-extras.js [app-client] (ecmascript, async loader)");
    }),
    jsTemplates: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("jsTemplates", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/js-templates.js [app-client] (ecmascript, async loader)");
    }),
    jsdoc: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("jsdoc", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/jsdoc.js [app-client] (ecmascript, async loader)");
    }),
    json: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("json", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/json.js [app-client] (ecmascript, async loader)");
    }),
    json5: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("json5", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/json5.js [app-client] (ecmascript, async loader)");
    }),
    jsonp: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("jsonp", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/jsonp.js [app-client] (ecmascript, async loader)");
    }),
    jsstacktrace: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("jsstacktrace", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/jsstacktrace.js [app-client] (ecmascript, async loader)");
    }),
    jsx: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("jsx", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/jsx.js [app-client] (ecmascript, async loader)");
    }),
    julia: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("julia", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/julia.js [app-client] (ecmascript, async loader)");
    }),
    keepalived: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("keepalived", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/keepalived.js [app-client] (ecmascript, async loader)");
    }),
    keyman: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("keyman", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/keyman.js [app-client] (ecmascript, async loader)");
    }),
    kotlin: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("kotlin", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/kotlin.js [app-client] (ecmascript, async loader)");
    }),
    kumir: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("kumir", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/kumir.js [app-client] (ecmascript, async loader)");
    }),
    kusto: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("kusto", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/kusto.js [app-client] (ecmascript, async loader)");
    }),
    latex: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("latex", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/latex.js [app-client] (ecmascript, async loader)");
    }),
    latte: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("latte", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/latte.js [app-client] (ecmascript, async loader)");
    }),
    less: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("less", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/less.js [app-client] (ecmascript, async loader)");
    }),
    lilypond: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("lilypond", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/lilypond.js [app-client] (ecmascript, async loader)");
    }),
    liquid: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("liquid", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/liquid.js [app-client] (ecmascript, async loader)");
    }),
    lisp: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("lisp", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/lisp.js [app-client] (ecmascript, async loader)");
    }),
    livescript: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("livescript", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/livescript.js [app-client] (ecmascript, async loader)");
    }),
    llvm: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("llvm", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/llvm.js [app-client] (ecmascript, async loader)");
    }),
    log: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("log", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/log.js [app-client] (ecmascript, async loader)");
    }),
    lolcode: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("lolcode", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/lolcode.js [app-client] (ecmascript, async loader)");
    }),
    lua: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("lua", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/lua.js [app-client] (ecmascript, async loader)");
    }),
    magma: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("magma", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/magma.js [app-client] (ecmascript, async loader)");
    }),
    makefile: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("makefile", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/makefile.js [app-client] (ecmascript, async loader)");
    }),
    markdown: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("markdown", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/markdown.js [app-client] (ecmascript, async loader)");
    }),
    markupTemplating: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("markupTemplating", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/markup-templating.js [app-client] (ecmascript, async loader)");
    }),
    markup: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("markup", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/markup.js [app-client] (ecmascript, async loader)");
    }),
    matlab: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("matlab", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/matlab.js [app-client] (ecmascript, async loader)");
    }),
    maxscript: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("maxscript", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/maxscript.js [app-client] (ecmascript, async loader)");
    }),
    mel: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("mel", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/mel.js [app-client] (ecmascript, async loader)");
    }),
    mermaid: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("mermaid", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/mermaid.js [app-client] (ecmascript, async loader)");
    }),
    mizar: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("mizar", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/mizar.js [app-client] (ecmascript, async loader)");
    }),
    mongodb: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("mongodb", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/mongodb.js [app-client] (ecmascript, async loader)");
    }),
    monkey: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("monkey", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/monkey.js [app-client] (ecmascript, async loader)");
    }),
    moonscript: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("moonscript", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/moonscript.js [app-client] (ecmascript, async loader)");
    }),
    n1ql: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("n1ql", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/n1ql.js [app-client] (ecmascript, async loader)");
    }),
    n4js: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("n4js", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/n4js.js [app-client] (ecmascript, async loader)");
    }),
    nand2tetrisHdl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("nand2tetrisHdl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/nand2tetris-hdl.js [app-client] (ecmascript, async loader)");
    }),
    naniscript: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("naniscript", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/naniscript.js [app-client] (ecmascript, async loader)");
    }),
    nasm: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("nasm", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/nasm.js [app-client] (ecmascript, async loader)");
    }),
    neon: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("neon", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/neon.js [app-client] (ecmascript, async loader)");
    }),
    nevod: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("nevod", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/nevod.js [app-client] (ecmascript, async loader)");
    }),
    nginx: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("nginx", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/nginx.js [app-client] (ecmascript, async loader)");
    }),
    nim: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("nim", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/nim.js [app-client] (ecmascript, async loader)");
    }),
    nix: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("nix", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/nix.js [app-client] (ecmascript, async loader)");
    }),
    nsis: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("nsis", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/nsis.js [app-client] (ecmascript, async loader)");
    }),
    objectivec: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("objectivec", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/objectivec.js [app-client] (ecmascript, async loader)");
    }),
    ocaml: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("ocaml", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/ocaml.js [app-client] (ecmascript, async loader)");
    }),
    opencl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("opencl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/opencl.js [app-client] (ecmascript, async loader)");
    }),
    openqasm: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("openqasm", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/openqasm.js [app-client] (ecmascript, async loader)");
    }),
    oz: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("oz", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/oz.js [app-client] (ecmascript, async loader)");
    }),
    parigp: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("parigp", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/parigp.js [app-client] (ecmascript, async loader)");
    }),
    parser: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("parser", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/parser.js [app-client] (ecmascript, async loader)");
    }),
    pascal: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("pascal", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/pascal.js [app-client] (ecmascript, async loader)");
    }),
    pascaligo: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("pascaligo", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/pascaligo.js [app-client] (ecmascript, async loader)");
    }),
    pcaxis: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("pcaxis", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/pcaxis.js [app-client] (ecmascript, async loader)");
    }),
    peoplecode: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("peoplecode", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/peoplecode.js [app-client] (ecmascript, async loader)");
    }),
    perl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("perl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/perl.js [app-client] (ecmascript, async loader)");
    }),
    phpExtras: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("phpExtras", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/php-extras.js [app-client] (ecmascript, async loader)");
    }),
    php: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("php", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/php.js [app-client] (ecmascript, async loader)");
    }),
    phpdoc: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("phpdoc", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/phpdoc.js [app-client] (ecmascript, async loader)");
    }),
    plsql: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("plsql", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/plsql.js [app-client] (ecmascript, async loader)");
    }),
    powerquery: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("powerquery", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/powerquery.js [app-client] (ecmascript, async loader)");
    }),
    powershell: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("powershell", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/powershell.js [app-client] (ecmascript, async loader)");
    }),
    processing: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("processing", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/processing.js [app-client] (ecmascript, async loader)");
    }),
    prolog: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("prolog", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/prolog.js [app-client] (ecmascript, async loader)");
    }),
    promql: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("promql", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/promql.js [app-client] (ecmascript, async loader)");
    }),
    properties: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("properties", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/properties.js [app-client] (ecmascript, async loader)");
    }),
    protobuf: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("protobuf", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/protobuf.js [app-client] (ecmascript, async loader)");
    }),
    psl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("psl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/psl.js [app-client] (ecmascript, async loader)");
    }),
    pug: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("pug", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/pug.js [app-client] (ecmascript, async loader)");
    }),
    puppet: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("puppet", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/puppet.js [app-client] (ecmascript, async loader)");
    }),
    pure: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("pure", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/pure.js [app-client] (ecmascript, async loader)");
    }),
    purebasic: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("purebasic", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/purebasic.js [app-client] (ecmascript, async loader)");
    }),
    purescript: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("purescript", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/purescript.js [app-client] (ecmascript, async loader)");
    }),
    python: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("python", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/python.js [app-client] (ecmascript, async loader)");
    }),
    q: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("q", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/q.js [app-client] (ecmascript, async loader)");
    }),
    qml: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("qml", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/qml.js [app-client] (ecmascript, async loader)");
    }),
    qore: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("qore", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/qore.js [app-client] (ecmascript, async loader)");
    }),
    qsharp: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("qsharp", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/qsharp.js [app-client] (ecmascript, async loader)");
    }),
    r: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("r", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/r.js [app-client] (ecmascript, async loader)");
    }),
    racket: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("racket", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/racket.js [app-client] (ecmascript, async loader)");
    }),
    reason: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("reason", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/reason.js [app-client] (ecmascript, async loader)");
    }),
    regex: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("regex", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/regex.js [app-client] (ecmascript, async loader)");
    }),
    rego: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("rego", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/rego.js [app-client] (ecmascript, async loader)");
    }),
    renpy: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("renpy", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/renpy.js [app-client] (ecmascript, async loader)");
    }),
    rest: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("rest", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/rest.js [app-client] (ecmascript, async loader)");
    }),
    rip: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("rip", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/rip.js [app-client] (ecmascript, async loader)");
    }),
    roboconf: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("roboconf", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/roboconf.js [app-client] (ecmascript, async loader)");
    }),
    robotframework: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("robotframework", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/robotframework.js [app-client] (ecmascript, async loader)");
    }),
    ruby: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("ruby", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/ruby.js [app-client] (ecmascript, async loader)");
    }),
    rust: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("rust", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/rust.js [app-client] (ecmascript, async loader)");
    }),
    sas: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("sas", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/sas.js [app-client] (ecmascript, async loader)");
    }),
    sass: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("sass", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/sass.js [app-client] (ecmascript, async loader)");
    }),
    scala: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("scala", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/scala.js [app-client] (ecmascript, async loader)");
    }),
    scheme: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("scheme", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/scheme.js [app-client] (ecmascript, async loader)");
    }),
    scss: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("scss", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/scss.js [app-client] (ecmascript, async loader)");
    }),
    shellSession: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("shellSession", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/shell-session.js [app-client] (ecmascript, async loader)");
    }),
    smali: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("smali", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/smali.js [app-client] (ecmascript, async loader)");
    }),
    smalltalk: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("smalltalk", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/smalltalk.js [app-client] (ecmascript, async loader)");
    }),
    smarty: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("smarty", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/smarty.js [app-client] (ecmascript, async loader)");
    }),
    sml: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("sml", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/sml.js [app-client] (ecmascript, async loader)");
    }),
    solidity: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("solidity", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/solidity.js [app-client] (ecmascript, async loader)");
    }),
    solutionFile: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("solutionFile", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/solution-file.js [app-client] (ecmascript, async loader)");
    }),
    soy: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("soy", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/soy.js [app-client] (ecmascript, async loader)");
    }),
    sparql: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("sparql", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/sparql.js [app-client] (ecmascript, async loader)");
    }),
    splunkSpl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("splunkSpl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/splunk-spl.js [app-client] (ecmascript, async loader)");
    }),
    sqf: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("sqf", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/sqf.js [app-client] (ecmascript, async loader)");
    }),
    sql: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("sql", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/sql.js [app-client] (ecmascript, async loader)");
    }),
    squirrel: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("squirrel", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/squirrel.js [app-client] (ecmascript, async loader)");
    }),
    stan: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("stan", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/stan.js [app-client] (ecmascript, async loader)");
    }),
    stylus: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("stylus", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/stylus.js [app-client] (ecmascript, async loader)");
    }),
    swift: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("swift", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/swift.js [app-client] (ecmascript, async loader)");
    }),
    systemd: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("systemd", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/systemd.js [app-client] (ecmascript, async loader)");
    }),
    t4Cs: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("t4Cs", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/t4-cs.js [app-client] (ecmascript, async loader)");
    }),
    t4Templating: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("t4Templating", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/t4-templating.js [app-client] (ecmascript, async loader)");
    }),
    t4Vb: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("t4Vb", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/t4-vb.js [app-client] (ecmascript, async loader)");
    }),
    tap: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("tap", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/tap.js [app-client] (ecmascript, async loader)");
    }),
    tcl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("tcl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/tcl.js [app-client] (ecmascript, async loader)");
    }),
    textile: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("textile", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/textile.js [app-client] (ecmascript, async loader)");
    }),
    toml: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("toml", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/toml.js [app-client] (ecmascript, async loader)");
    }),
    tremor: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("tremor", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/tremor.js [app-client] (ecmascript, async loader)");
    }),
    tsx: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("tsx", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/tsx.js [app-client] (ecmascript, async loader)");
    }),
    tt2: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("tt2", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/tt2.js [app-client] (ecmascript, async loader)");
    }),
    turtle: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("turtle", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/turtle.js [app-client] (ecmascript, async loader)");
    }),
    twig: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("twig", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/twig.js [app-client] (ecmascript, async loader)");
    }),
    typescript: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("typescript", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/typescript.js [app-client] (ecmascript, async loader)");
    }),
    typoscript: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("typoscript", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/typoscript.js [app-client] (ecmascript, async loader)");
    }),
    unrealscript: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("unrealscript", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/unrealscript.js [app-client] (ecmascript, async loader)");
    }),
    uorazor: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("uorazor", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/uorazor.js [app-client] (ecmascript, async loader)");
    }),
    uri: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("uri", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/uri.js [app-client] (ecmascript, async loader)");
    }),
    v: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("v", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/v.js [app-client] (ecmascript, async loader)");
    }),
    vala: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("vala", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/vala.js [app-client] (ecmascript, async loader)");
    }),
    vbnet: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("vbnet", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/vbnet.js [app-client] (ecmascript, async loader)");
    }),
    velocity: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("velocity", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/velocity.js [app-client] (ecmascript, async loader)");
    }),
    verilog: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("verilog", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/verilog.js [app-client] (ecmascript, async loader)");
    }),
    vhdl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("vhdl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/vhdl.js [app-client] (ecmascript, async loader)");
    }),
    vim: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("vim", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/vim.js [app-client] (ecmascript, async loader)");
    }),
    visualBasic: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("visualBasic", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/visual-basic.js [app-client] (ecmascript, async loader)");
    }),
    warpscript: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("warpscript", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/warpscript.js [app-client] (ecmascript, async loader)");
    }),
    wasm: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("wasm", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/wasm.js [app-client] (ecmascript, async loader)");
    }),
    webIdl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("webIdl", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/web-idl.js [app-client] (ecmascript, async loader)");
    }),
    wiki: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("wiki", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/wiki.js [app-client] (ecmascript, async loader)");
    }),
    wolfram: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("wolfram", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/wolfram.js [app-client] (ecmascript, async loader)");
    }),
    wren: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("wren", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/wren.js [app-client] (ecmascript, async loader)");
    }),
    xeora: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("xeora", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/xeora.js [app-client] (ecmascript, async loader)");
    }),
    xmlDoc: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("xmlDoc", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/xml-doc.js [app-client] (ecmascript, async loader)");
    }),
    xojo: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("xojo", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/xojo.js [app-client] (ecmascript, async loader)");
    }),
    xquery: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("xquery", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/xquery.js [app-client] (ecmascript, async loader)");
    }),
    yaml: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("yaml", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/yaml.js [app-client] (ecmascript, async loader)");
    }),
    yang: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("yang", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/yang.js [app-client] (ecmascript, async loader)");
    }),
    zig: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$create$2d$language$2d$async$2d$loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("zig", function() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/lang/zig.js [app-client] (ecmascript, async loader)");
    })
};
}),
"[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/prism-async-light.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$syntax$2d$highlighter$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/async-syntax-highlighter.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$prism$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/async-languages/prism.js [app-client] (ecmascript)");
;
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$syntax$2d$highlighter$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])({
    loader: function loader() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/core.js [app-client] (ecmascript, async loader)").then(function(module) {
            // Webpack 3 returns module.exports as default as module, but webpack 4 returns module.exports as module.default
            return module["default"] || module;
        });
    },
    isLanguageRegistered: function isLanguageRegistered(instance, language) {
        return instance.registered(language);
    },
    languageLoaders: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$languages$2f$prism$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"],
    registerLanguage: function registerLanguage(instance, name, language) {
        return instance.register(language);
    }
});
}),
"[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/languages/prism/supported-languages.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

//
// This file has been auto-generated by the `npm run build-languages-prism` task
//
__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
const __TURBOPACK__default__export__ = [
    'abap',
    'abnf',
    'actionscript',
    'ada',
    'agda',
    'al',
    'antlr4',
    'apacheconf',
    'apex',
    'apl',
    'applescript',
    'aql',
    'arduino',
    'arff',
    'asciidoc',
    'asm6502',
    'asmatmel',
    'aspnet',
    'autohotkey',
    'autoit',
    'avisynth',
    'avro-idl',
    'bash',
    'basic',
    'batch',
    'bbcode',
    'bicep',
    'birb',
    'bison',
    'bnf',
    'brainfuck',
    'brightscript',
    'bro',
    'bsl',
    'c',
    'cfscript',
    'chaiscript',
    'cil',
    'clike',
    'clojure',
    'cmake',
    'cobol',
    'coffeescript',
    'concurnas',
    'coq',
    'cpp',
    'crystal',
    'csharp',
    'cshtml',
    'csp',
    'css-extras',
    'css',
    'csv',
    'cypher',
    'd',
    'dart',
    'dataweave',
    'dax',
    'dhall',
    'diff',
    'django',
    'dns-zone-file',
    'docker',
    'dot',
    'ebnf',
    'editorconfig',
    'eiffel',
    'ejs',
    'elixir',
    'elm',
    'erb',
    'erlang',
    'etlua',
    'excel-formula',
    'factor',
    'false',
    'firestore-security-rules',
    'flow',
    'fortran',
    'fsharp',
    'ftl',
    'gap',
    'gcode',
    'gdscript',
    'gedcom',
    'gherkin',
    'git',
    'glsl',
    'gml',
    'gn',
    'go-module',
    'go',
    'graphql',
    'groovy',
    'haml',
    'handlebars',
    'haskell',
    'haxe',
    'hcl',
    'hlsl',
    'hoon',
    'hpkp',
    'hsts',
    'http',
    'ichigojam',
    'icon',
    'icu-message-format',
    'idris',
    'iecst',
    'ignore',
    'inform7',
    'ini',
    'io',
    'j',
    'java',
    'javadoc',
    'javadoclike',
    'javascript',
    'javastacktrace',
    'jexl',
    'jolie',
    'jq',
    'js-extras',
    'js-templates',
    'jsdoc',
    'json',
    'json5',
    'jsonp',
    'jsstacktrace',
    'jsx',
    'julia',
    'keepalived',
    'keyman',
    'kotlin',
    'kumir',
    'kusto',
    'latex',
    'latte',
    'less',
    'lilypond',
    'liquid',
    'lisp',
    'livescript',
    'llvm',
    'log',
    'lolcode',
    'lua',
    'magma',
    'makefile',
    'markdown',
    'markup-templating',
    'markup',
    'matlab',
    'maxscript',
    'mel',
    'mermaid',
    'mizar',
    'mongodb',
    'monkey',
    'moonscript',
    'n1ql',
    'n4js',
    'nand2tetris-hdl',
    'naniscript',
    'nasm',
    'neon',
    'nevod',
    'nginx',
    'nim',
    'nix',
    'nsis',
    'objectivec',
    'ocaml',
    'opencl',
    'openqasm',
    'oz',
    'parigp',
    'parser',
    'pascal',
    'pascaligo',
    'pcaxis',
    'peoplecode',
    'perl',
    'php-extras',
    'php',
    'phpdoc',
    'plsql',
    'powerquery',
    'powershell',
    'processing',
    'prolog',
    'promql',
    'properties',
    'protobuf',
    'psl',
    'pug',
    'puppet',
    'pure',
    'purebasic',
    'purescript',
    'python',
    'q',
    'qml',
    'qore',
    'qsharp',
    'r',
    'racket',
    'reason',
    'regex',
    'rego',
    'renpy',
    'rest',
    'rip',
    'roboconf',
    'robotframework',
    'ruby',
    'rust',
    'sas',
    'sass',
    'scala',
    'scheme',
    'scss',
    'shell-session',
    'smali',
    'smalltalk',
    'smarty',
    'sml',
    'solidity',
    'solution-file',
    'soy',
    'sparql',
    'splunk-spl',
    'sqf',
    'sql',
    'squirrel',
    'stan',
    'stylus',
    'swift',
    'systemd',
    't4-cs',
    't4-templating',
    't4-vb',
    'tap',
    'tcl',
    'textile',
    'toml',
    'tremor',
    'tsx',
    'tt2',
    'turtle',
    'twig',
    'typescript',
    'typoscript',
    'unrealscript',
    'uorazor',
    'uri',
    'v',
    'vala',
    'vbnet',
    'velocity',
    'verilog',
    'vhdl',
    'vim',
    'visual-basic',
    'warpscript',
    'wasm',
    'web-idl',
    'wiki',
    'wolfram',
    'wren',
    'xeora',
    'xml-doc',
    'xojo',
    'xquery',
    'yaml',
    'yang',
    'zig'
];
}),
"[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/prism-async.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$syntax$2d$highlighter$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/async-syntax-highlighter.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$languages$2f$prism$2f$supported$2d$languages$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/languages/prism/supported-languages.js [app-client] (ecmascript)");
;
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$async$2d$syntax$2d$highlighter$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])({
    loader: function loader() {
        return __turbopack_context__.A("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/index.js [app-client] (ecmascript, async loader)").then(function(module) {
            // Webpack 3 returns module.exports as default as module, but webpack 4 returns module.exports as module.default
            return module["default"] || module;
        });
    },
    noAsyncLoadingLanguages: true,
    supportedLanguages: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$languages$2f$prism$2f$supported$2d$languages$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"]
});
}),
"[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/prism-light.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$highlight$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/highlight.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$refractor$40$3$2e$6$2e$0$2f$node_modules$2f$refractor$2f$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/core.js [app-client] (ecmascript)");
;
;
var SyntaxHighlighter = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$highlight$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$refractor$40$3$2e$6$2e$0$2f$node_modules$2f$refractor$2f$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {});
SyntaxHighlighter.registerLanguage = function(_, language) {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$refractor$40$3$2e$6$2e$0$2f$node_modules$2f$refractor$2f$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].register(language);
};
SyntaxHighlighter.alias = function(name, aliases) {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$refractor$40$3$2e$6$2e$0$2f$node_modules$2f$refractor$2f$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].alias(name, aliases);
};
const __TURBOPACK__default__export__ = SyntaxHighlighter;
}),
"[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/styles/prism/prism.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
const __TURBOPACK__default__export__ = {
    "code[class*=\"language-\"]": {
        "color": "black",
        "background": "none",
        "textShadow": "0 1px white",
        "fontFamily": "Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace",
        "fontSize": "1em",
        "textAlign": "left",
        "whiteSpace": "pre",
        "wordSpacing": "normal",
        "wordBreak": "normal",
        "wordWrap": "normal",
        "lineHeight": "1.5",
        "MozTabSize": "4",
        "OTabSize": "4",
        "tabSize": "4",
        "WebkitHyphens": "none",
        "MozHyphens": "none",
        "msHyphens": "none",
        "hyphens": "none"
    },
    "pre[class*=\"language-\"]": {
        "color": "black",
        "background": "#f5f2f0",
        "textShadow": "0 1px white",
        "fontFamily": "Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace",
        "fontSize": "1em",
        "textAlign": "left",
        "whiteSpace": "pre",
        "wordSpacing": "normal",
        "wordBreak": "normal",
        "wordWrap": "normal",
        "lineHeight": "1.5",
        "MozTabSize": "4",
        "OTabSize": "4",
        "tabSize": "4",
        "WebkitHyphens": "none",
        "MozHyphens": "none",
        "msHyphens": "none",
        "hyphens": "none",
        "padding": "1em",
        "margin": ".5em 0",
        "overflow": "auto"
    },
    "pre[class*=\"language-\"]::-moz-selection": {
        "textShadow": "none",
        "background": "#b3d4fc"
    },
    "pre[class*=\"language-\"] ::-moz-selection": {
        "textShadow": "none",
        "background": "#b3d4fc"
    },
    "code[class*=\"language-\"]::-moz-selection": {
        "textShadow": "none",
        "background": "#b3d4fc"
    },
    "code[class*=\"language-\"] ::-moz-selection": {
        "textShadow": "none",
        "background": "#b3d4fc"
    },
    "pre[class*=\"language-\"]::selection": {
        "textShadow": "none",
        "background": "#b3d4fc"
    },
    "pre[class*=\"language-\"] ::selection": {
        "textShadow": "none",
        "background": "#b3d4fc"
    },
    "code[class*=\"language-\"]::selection": {
        "textShadow": "none",
        "background": "#b3d4fc"
    },
    "code[class*=\"language-\"] ::selection": {
        "textShadow": "none",
        "background": "#b3d4fc"
    },
    ":not(pre) > code[class*=\"language-\"]": {
        "background": "#f5f2f0",
        "padding": ".1em",
        "borderRadius": ".3em",
        "whiteSpace": "normal"
    },
    "comment": {
        "color": "slategray"
    },
    "prolog": {
        "color": "slategray"
    },
    "doctype": {
        "color": "slategray"
    },
    "cdata": {
        "color": "slategray"
    },
    "punctuation": {
        "color": "#999"
    },
    "namespace": {
        "Opacity": ".7"
    },
    "property": {
        "color": "#905"
    },
    "tag": {
        "color": "#905"
    },
    "boolean": {
        "color": "#905"
    },
    "number": {
        "color": "#905"
    },
    "constant": {
        "color": "#905"
    },
    "symbol": {
        "color": "#905"
    },
    "deleted": {
        "color": "#905"
    },
    "selector": {
        "color": "#690"
    },
    "attr-name": {
        "color": "#690"
    },
    "string": {
        "color": "#690"
    },
    "char": {
        "color": "#690"
    },
    "builtin": {
        "color": "#690"
    },
    "inserted": {
        "color": "#690"
    },
    "operator": {
        "color": "#9a6e3a",
        "background": "hsla(0, 0%, 100%, .5)"
    },
    "entity": {
        "color": "#9a6e3a",
        "background": "hsla(0, 0%, 100%, .5)",
        "cursor": "help"
    },
    "url": {
        "color": "#9a6e3a",
        "background": "hsla(0, 0%, 100%, .5)"
    },
    ".language-css .token.string": {
        "color": "#9a6e3a",
        "background": "hsla(0, 0%, 100%, .5)"
    },
    ".style .token.string": {
        "color": "#9a6e3a",
        "background": "hsla(0, 0%, 100%, .5)"
    },
    "atrule": {
        "color": "#07a"
    },
    "attr-value": {
        "color": "#07a"
    },
    "keyword": {
        "color": "#07a"
    },
    "function": {
        "color": "#DD4A68"
    },
    "class-name": {
        "color": "#DD4A68"
    },
    "regex": {
        "color": "#e90"
    },
    "important": {
        "color": "#e90",
        "fontWeight": "bold"
    },
    "variable": {
        "color": "#e90"
    },
    "bold": {
        "fontWeight": "bold"
    },
    "italic": {
        "fontStyle": "italic"
    }
};
}),
"[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/prism.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$highlight$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/highlight.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$styles$2f$prism$2f$prism$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/styles/prism/prism.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$refractor$40$3$2e$6$2e$0$2f$node_modules$2f$refractor$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/refractor@3.6.0/node_modules/refractor/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$languages$2f$prism$2f$supported$2d$languages$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/languages/prism/supported-languages.js [app-client] (ecmascript)");
;
;
;
;
var highlighter = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$highlight$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$refractor$40$3$2e$6$2e$0$2f$node_modules$2f$refractor$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$styles$2f$prism$2f$prism$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"]);
highlighter.supportedLanguages = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$languages$2f$prism$2f$supported$2d$languages$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"];
const __TURBOPACK__default__export__ = highlighter;
}),
"[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/index.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Light",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$light$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"],
    "LightAsync",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$light$2d$async$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"],
    "Prism",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$prism$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"],
    "PrismAsync",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$prism$2d$async$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"],
    "PrismAsyncLight",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$prism$2d$async$2d$light$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"],
    "PrismLight",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$prism$2d$light$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"],
    "createElement",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$create$2d$element$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"],
    "default",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$default$2d$highlight$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$default$2d$highlight$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/default-highlight.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$light$2d$async$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/light-async.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$light$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/light.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$prism$2d$async$2d$light$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/prism-async-light.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$prism$2d$async$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/prism-async.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$prism$2d$light$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/prism-light.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$prism$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/prism.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$syntax$2d$highlighter$40$15$2e$6$2e$6_react$40$19$2e$0$2e$0$2f$node_modules$2f$react$2d$syntax$2d$highlighter$2f$dist$2f$esm$2f$create$2d$element$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/create-element.js [app-client] (ecmascript)");
}),
"[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/index.js [app-client] (ecmascript, next/dynamic entry)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/node_modules/.pnpm/react-syntax-highlighter@15.6.6_react@19.0.0/node_modules/react-syntax-highlighter/dist/esm/index.js [app-client] (ecmascript)"));
}),
]);

//# sourceMappingURL=fbb28_react-syntax-highlighter_dist_esm_f37c2a3f._.js.map