import {type Rule} from 'eslint';

type NativeUsage = 'instance' | 'prototype' | 'static';
type PropertyInfo = {
	all: Set<string>;
	callable: Set<string>;
};

type NativeObjectInfo = Partial<Record<NativeUsage, PropertyInfo>>;
type NativeObjectReference = {
	typeName: string;
	usage: NativeUsage;
};

type AstNode = {
	type: string;
};

type PropertyContainer = CallableFunction | NewableFunction | {constructor: unknown};

type NamedAstNode = AstNode & {
	name: string;
};

type LiteralAstNode = AstNode & {
	value?: unknown;
	regex?: unknown;
};

type MemberExpressionAstNode = AstNode & {
	computed: boolean;
	object: AstNode;
	property: AstNode;
};

type BinaryExpressionAstNode = AstNode & {
	operator: string;
	left: AstNode;
	right: AstNode;
};

type NewExpressionAstNode = AstNode & {
	callee: AstNode;
};

type NativeObjectDefinition = {
	typeName: string;
	instance?: unknown;
	instanceProperties?: string[];
	static?: unknown;
	prototype?: unknown;
};

const isPropertyContainer = (value: unknown): value is PropertyContainer => typeof value === 'function' || (typeof value === 'object' && value !== null);

const isIdentifierNode = (node: AstNode): node is NamedAstNode => node.type === 'Identifier' && 'name' in node && typeof node.name === 'string';

const isLiteralNode = (node: AstNode): node is LiteralAstNode => node.type === 'Literal';

const isMemberExpressionNode = (node: AstNode): node is MemberExpressionAstNode =>
	node.type === 'MemberExpression'
	&& 'computed' in node
	&& typeof node.computed === 'boolean'
	&& 'object' in node
	&& 'property' in node;

const isBinaryExpressionNode = (node: AstNode): node is BinaryExpressionAstNode =>
	node.type === 'BinaryExpression'
	&& 'operator' in node
	&& typeof node.operator === 'string'
	&& 'left' in node
	&& 'right' in node;

const isNewExpressionNode = (node: AstNode): node is NewExpressionAstNode => node.type === 'NewExpression' && 'callee' in node;

const createPropertyInfo = (value: unknown, extraProperties: string[] = []): PropertyInfo => {
	const all = new Set<string>();
	const callable = new Set<string>();

	for (const propertyName of extraProperties) {
		all.add(propertyName);
	}

	for (let currentValue = value; isPropertyContainer(currentValue); currentValue = Object.getPrototypeOf(currentValue)) {
		for (const propertyName of Object.getOwnPropertyNames(currentValue)) {
			all.add(propertyName);

			const descriptor = Object.getOwnPropertyDescriptor(currentValue, propertyName);
			if (typeof descriptor?.value === 'function') {
				callable.add(propertyName);
			}
		}
	}

	return {
		all,
		callable,
	};
};

const emptyFunction = () => undefined;

// Keep the checked native object list explicit so rule behavior stays predictable.
const nativeObjectDefinitions: NativeObjectDefinition[] = [
	{
		typeName: 'Array',
		instance: [],
		static: Array,
		prototype: Array.prototype,
	},
	{
		typeName: 'ArrayBuffer',
		instance: new ArrayBuffer(0),
		static: ArrayBuffer,
		prototype: ArrayBuffer.prototype,
	},
	{
		typeName: 'Boolean',
		instance: Boolean.prototype,
		static: Boolean,
		prototype: Boolean.prototype,
	},
	{
		typeName: 'DataView',
		instance: new DataView(new ArrayBuffer(1)),
		static: DataView,
		prototype: DataView.prototype,
	},
	{
		typeName: 'Date',
		instance: new Date(),
		static: Date,
		prototype: Date.prototype,
	},
	{
		typeName: 'Float32Array',
		instance: new Float32Array(),
		static: Float32Array,
		prototype: Float32Array.prototype,
	},
	{
		typeName: 'Float64Array',
		instance: new Float64Array(),
		static: Float64Array,
		prototype: Float64Array.prototype,
	},
	{
		typeName: 'Function',
		instance: emptyFunction,
		static: Function,
		prototype: Function.prototype,
	},
	{
		typeName: 'Int8Array',
		instance: new Int8Array(),
		static: Int8Array,
		prototype: Int8Array.prototype,
	},
	{
		typeName: 'Int16Array',
		instance: new Int16Array(),
		static: Int16Array,
		prototype: Int16Array.prototype,
	},
	{
		typeName: 'Int32Array',
		instance: new Int32Array(),
		static: Int32Array,
		prototype: Int32Array.prototype,
	},
	{
		typeName: 'Map',
		instance: new Map(),
		static: Map,
		prototype: Map.prototype,
	},
	{
		typeName: 'Number',
		instance: Number.prototype,
		static: Number,
		prototype: Number.prototype,
	},
	{
		typeName: 'Object',
		instance: {},
		static: Object,
		prototype: Object.prototype,
	},
	{
		typeName: 'Promise',
		instance: Promise.resolve(),
		static: Promise,
		prototype: Promise.prototype,
	},
	{
		typeName: 'RegExp',
		instance: /./u,
		static: RegExp,
		prototype: RegExp.prototype,
	},
	{
		typeName: 'Set',
		instance: new Set(),
		static: Set,
		prototype: Set.prototype,
	},
	{
		typeName: 'String',
		instance: String.prototype,
		instanceProperties: ['length'],
		static: String,
		prototype: String.prototype,
	},
	{
		typeName: 'Uint8Array',
		instance: new Uint8Array(),
		static: Uint8Array,
		prototype: Uint8Array.prototype,
	},
	{
		typeName: 'Uint8ClampedArray',
		instance: new Uint8ClampedArray(),
		static: Uint8ClampedArray,
		prototype: Uint8ClampedArray.prototype,
	},
	{
		typeName: 'Uint16Array',
		instance: new Uint16Array(),
		static: Uint16Array,
		prototype: Uint16Array.prototype,
	},
	{
		typeName: 'Uint32Array',
		instance: new Uint32Array(),
		static: Uint32Array,
		prototype: Uint32Array.prototype,
	},
	{
		typeName: 'URL',
		instance: new URL('https://example.com'),
		static: URL,
		prototype: URL.prototype,
	},
	{
		typeName: 'URLSearchParams',
		instance: new URLSearchParams(),
		static: URLSearchParams,
		prototype: URLSearchParams.prototype,
	},
	{
		typeName: 'JSON',
		static: JSON,
	},
	{
		typeName: 'Math',
		static: Math,
	},
	{
		typeName: 'Reflect',
		static: Reflect,
	},
];

const nativeObjects = new Map<string, NativeObjectInfo>();

for (const nativeObjectDefinition of nativeObjectDefinitions) {
	const nativeObjectInfo: NativeObjectInfo = {};

	if (nativeObjectDefinition.instance) {
		nativeObjectInfo.instance = createPropertyInfo(nativeObjectDefinition.instance, nativeObjectDefinition.instanceProperties);
	}

	if (nativeObjectDefinition.prototype) {
		nativeObjectInfo.prototype = createPropertyInfo(nativeObjectDefinition.prototype);
	}

	if (nativeObjectDefinition.static) {
		nativeObjectInfo.static = createPropertyInfo(nativeObjectDefinition.static);
	}

	nativeObjects.set(nativeObjectDefinition.typeName, nativeObjectInfo);
}

const getPropertyName = (memberExpression: MemberExpressionAstNode): string | undefined => {
	const {property} = memberExpression;
	if (memberExpression.computed) {
		return isLiteralNode(property) && typeof property.value === 'string' ? property.value : undefined;
	}

	return isIdentifierNode(property) ? property.name : undefined;
};

const resolveBinaryExpressionType = (binaryExpression: BinaryExpressionAstNode): NativeObjectReference | undefined => {
	if (binaryExpression.operator !== '+') {
		return undefined;
	}

	const leftReference = resolveNativeObjectReference(binaryExpression.left);
	const rightReference = resolveNativeObjectReference(binaryExpression.right);

	if (leftReference?.usage !== 'instance' || rightReference?.usage !== 'instance') {
		return undefined;
	}

	if (leftReference.typeName === 'String' || rightReference.typeName === 'String') {
		return {
			typeName: 'String',
			usage: 'instance',
		};
	}

	return undefined;
};

const resolveIdentifierReference = (node: NamedAstNode): NativeObjectReference | undefined => {
	if (!nativeObjects.has(node.name)) {
		return undefined;
	}

	return {
		typeName: node.name,
		usage: 'static',
	};
};

const resolveLiteralReference = (node: LiteralAstNode): NativeObjectReference | undefined => {
	if (node.regex) {
		return {
			typeName: 'RegExp',
			usage: 'instance',
		};
	}

	if (typeof node.value === 'boolean') {
		return {
			typeName: 'Boolean',
			usage: 'instance',
		};
	}

	if (typeof node.value === 'number') {
		return {
			typeName: 'Number',
			usage: 'instance',
		};
	}

	if (typeof node.value === 'string') {
		return {
			typeName: 'String',
			usage: 'instance',
		};
	}

	return undefined;
};

const resolvePrototypeReference = (node: MemberExpressionAstNode): NativeObjectReference | undefined => {
	if (getPropertyName(node) !== 'prototype' || !isIdentifierNode(node.object) || !nativeObjects.has(node.object.name)) {
		return undefined;
	}

	return {
		typeName: node.object.name,
		usage: 'prototype',
	};
};

const resolveNewExpressionReference = (node: NewExpressionAstNode): NativeObjectReference | undefined => {
	if (!isIdentifierNode(node.callee) || !nativeObjects.has(node.callee.name)) {
		return undefined;
	}

	return {
		typeName: node.callee.name,
		usage: 'instance',
	};
};

function resolveNativeObjectReference(node: AstNode | undefined): NativeObjectReference | undefined {
	if (!node) {
		return undefined;
	}

	if (isMemberExpressionNode(node)) {
		return resolvePrototypeReference(node);
	}

	if (isBinaryExpressionNode(node)) {
		return resolveBinaryExpressionType(node);
	}

	if (isLiteralNode(node)) {
		return resolveLiteralReference(node);
	}

	if (isIdentifierNode(node)) {
		return resolveIdentifierReference(node);
	}

	if (isNewExpressionNode(node)) {
		return resolveNewExpressionReference(node);
	}

	switch (node.type) {
		case 'ArrayExpression': {
			return {
				typeName: 'Array',
				usage: 'instance',
			};
		}

		case 'ArrowFunctionExpression':
		case 'FunctionExpression': {
			return {
				typeName: 'Function',
				usage: 'instance',
			};
		}

		case 'ObjectExpression': {
			return {
				typeName: 'Object',
				usage: 'instance',
			};
		}

		case 'TemplateLiteral': {
			return {
				typeName: 'String',
				usage: 'instance',
			};
		}

		default: {
			return undefined;
		}
	}
}

const noUseExtendNativeRule: Rule.RuleModule = {
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow relying on non-standard properties on native objects',
		},
		messages: {
			unexpected: 'Avoid relying on extended native objects.',
		},
		schema: [],
	},
	create(context) {
		return {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			MemberExpression(node) {
				const propertyName = getPropertyName(node);
				if (!propertyName) {
					return;
				}

				const nativeObjectReference = resolveNativeObjectReference(node.object);
				if (!nativeObjectReference) {
					return;
				}

				const propertyInfo = nativeObjects.get(nativeObjectReference.typeName)?.[nativeObjectReference.usage];
				if (!propertyInfo) {
					return;
				}

				const isCall = node.parent.type === 'CallExpression' && node.parent.callee === node;
				if (isCall) {
					if (!propertyInfo.callable.has(propertyName)) {
						context.report({
							node,
							messageId: 'unexpected',
						});
					}

					return;
				}

				if (!propertyInfo.all.has(propertyName)) {
					context.report({
						node,
						messageId: 'unexpected',
					});
				}
			},
		};
	},
};

export default noUseExtendNativeRule;
