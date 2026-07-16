export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
export type ApiParameterType = 'string' | 'number' | 'date';
export type ApiSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'object' | 'array' | 'null';
export type ApiBodyKind = 'none' | 'string' | 'formData' | 'object';
export type ApiParameter = {
  id: string;
  name: string;
  in: 'path' | 'query';
  type: ApiParameterType;
  required: boolean;
  description: string;
  example: string;
};
export type ApiSchemaField = {
  id: string;
  name: string;
  type: ApiSchemaType;
  required: boolean;
  description: string;
  example: string;
  children: ApiSchemaField[];
};
export type ApiPayload = { contentType: string; kind: ApiBodyKind; schema: ApiSchemaField[] };
export type ApiResponse = ApiPayload & { status: number };
export type ApiEndpointData = {
  version: 1;
  title: string;
  description: string;
  method: ApiMethod;
  uri: string;
  parameters: ApiParameter[];
  body: ApiPayload;
  response: ApiResponse;
};

export const apiMethods: ApiMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
export const apiParameterTypes: ApiParameterType[] = ['string', 'number', 'date'];
export const apiSchemaTypes: ApiSchemaType[] = [
  'string',
  'number',
  'integer',
  'boolean',
  'date',
  'object',
  'array',
  'null',
];
export const apiContentTypes = [
  'application/json',
  'multipart/form-data',
  'application/x-www-form-urlencoded',
  'text/plain',
  'application/octet-stream',
];
export const apiBodyKinds: ApiBodyKind[] = ['none', 'string', 'formData', 'object'];

export function createApiEndpointData(value?: Partial<ApiEndpointData>): ApiEndpointData {
  const base: ApiEndpointData = {
    version: 1,
    title: 'Эндпоинт API',
    description: '',
    method: 'GET',
    uri: '/api/v1/{path_var}?{query_var}&{query_var2}',
    parameters: [],
    body: { contentType: 'application/json', kind: 'none', schema: [] },
    response: { status: 200, contentType: 'application/json', kind: 'object', schema: [] },
  };
  const method = apiMethods.includes(value?.method as ApiMethod) ? value!.method! : base.method;
  const uri = typeof value?.uri === 'string' ? value.uri : base.uri;
  const parameters = syncApiParameters(
    uri,
    Array.isArray(value?.parameters) ? value!.parameters!.filter(isParameter).map((item) => ({ ...item })) : [],
  );
  return {
    version: 1,
    title: typeof value?.title === 'string' ? value.title : base.title,
    description: typeof value?.description === 'string' ? value.description : '',
    method,
    uri,
    parameters,
    body: normalizePayload(value?.body, base.body),
    response: {
      ...normalizePayload(value?.response, base.response),
      status: Number.isInteger(value?.response?.status) ? value!.response!.status : 200,
    },
  };
}

export function parseApiUri(uri: string): Array<{ name: string; in: 'path' | 'query' }> {
  const question = uri.indexOf('?');
  const path = question >= 0 ? uri.slice(0, question) : uri;
  const query = question >= 0 ? uri.slice(question + 1) : '';
  const result: Array<{ name: string; in: 'path' | 'query' }> = [];
  const seen = new Set<string>();
  for (const match of path.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)) {
    const key = `path:${match[1]}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ name: match[1], in: 'path' });
    }
  }
  for (const part of query.split('&')) {
    const match = /\{([A-Za-z_][A-Za-z0-9_]*)\}/.exec(part);
    if (match) {
      const key = `query:${match[1]}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ name: match[1], in: 'query' });
      }
    }
  }
  return result;
}

export function syncApiParameters(uri: string, current: ApiParameter[]): ApiParameter[] {
  return parseApiUri(uri).map((parsed) => {
    const previous = current.find((item) => item.name === parsed.name && item.in === parsed.in);
    return previous
      ? { ...previous, in: parsed.in }
      : {
          id: uid('param'),
          name: parsed.name,
          in: parsed.in,
          type: 'string',
          required: parsed.in === 'path',
          description: '',
          example: '',
        };
  });
}
export function createSchemaField(name = 'field'): ApiSchemaField {
  return { id: uid('field'), name, type: 'string', required: false, description: '', example: '', children: [] };
}

export function generateTypeScriptModels(data: ApiEndpointData): string {
  const endpoint = createApiEndpointData(data);
  const name = operationName(endpoint);
  const pathParams = endpoint.parameters.filter((item) => item.in === 'path');
  const queryParams = endpoint.parameters.filter((item) => item.in === 'query');
  const output: string[] = [];
  if (pathParams.length) {
    output.push(
      `export interface ${name}PathParams {`,
      ...pathParams.map((item) => `  ${item.name}${item.required ? '' : '?'}: ${parameterTsType(item.type)};`),
      '}',
      '',
    );
  }
  if (queryParams.length) {
    output.push(
      `export interface ${name}QueryParams {`,
      ...queryParams.map((item) => `  ${item.name}${item.required ? '' : '?'}: ${parameterTsType(item.type)};`),
      '}',
      '',
    );
  }
  output.push(
    `export type ${name}Request = ${payloadTsType(endpoint.body)};`,
    '',
    `export type ${name}Response = ${payloadTsType(endpoint.response)};`,
  );
  return output.join('\n');
}

export function generateNativeFetch(data: ApiEndpointData): string {
  const endpoint = createApiEndpointData(data);
  const path = generateEncodedPath(endpoint);
  const queries = endpoint.parameters.filter((item) => item.in === 'query');
  const hasBody = endpoint.body.kind !== 'none' && !['GET', 'HEAD'].includes(endpoint.method);
  const queryCode = queries.length
    ? `\n  const queryParts: string[] = [];\n${queries.map((item) => `  if (${item.required ? 'true' : `query.${item.name} !== undefined && query.${item.name} !== null`}) queryParts.push('${item.name}=' + encodeURIComponent(String(query.${item.name})));`).join('\n')}\n  const queryString = queryParts.length ? '?' + queryParts.join('&') : '';`
    : '';
  const body = hasBody ? generateFetchBody(endpoint.body) : '';
  return `export async function requestEndpoint(params: Record<string, unknown>, query: Record<string, unknown>, body: unknown) {${queryCode}\n  const response = await fetch(\`${path}${queries.length ? '${queryString}' : ''}\`, {\n    method: '${endpoint.method}',${hasBody ? `\n${body}` : ''}\n  });\n  if (!response.ok) throw new Error(\`Request failed: \${response.status}\`);\n  return response.${endpoint.response.contentType.includes('json') ? 'json()' : 'text()'};\n}`;
}

export function generateAngularRequest(data: ApiEndpointData): string {
  const endpoint = createApiEndpointData(data);
  const path = generateEncodedPath(endpoint);
  const queries = endpoint.parameters.filter((item) => item.in === 'query');
  const hasBody = endpoint.body.kind !== 'none' && !['GET', 'HEAD'].includes(endpoint.method);
  const queryCode = queries.length
    ? `\n    const queryParts: string[] = [];\n${queries.map((item) => `    if (${item.required ? 'true' : `query.${item.name} !== undefined && query.${item.name} !== null`}) queryParts.push('${item.name}=' + encodeURIComponent(String(query.${item.name})));`).join('\n')}\n    const queryString = queryParts.length ? '?' + queryParts.join('&') : '';`
    : '';
  return `import { HttpClient } from '@angular/common/http';\nimport { Injectable } from '@angular/core';\n\n@Injectable({ providedIn: 'root' })\nexport class EndpointService {\n  constructor(private readonly http: HttpClient) {}\n\n  request(params: Record<string, unknown>, query: Record<string, unknown>, body: unknown) {${queryCode}\n    const url = \`${path}${queries.length ? '${queryString}' : ''}\`;\n    return this.http.request('${endpoint.method}', url, {${hasBody ? ' body,' : ''} responseType: '${endpoint.response.contentType.includes('json') ? 'json' : 'text'}' });\n  }\n}`;
}

export function generateSwaggerSchema(data: ApiEndpointData): string {
  const endpoint = createApiEndpointData(data);
  const [path] = endpoint.uri.split('?');
  const parameters = endpoint.parameters.map((item) => ({
    name: item.name,
    in: item.in,
    required: item.required,
    schema: {
      type: item.type === 'date' ? 'string' : item.type,
      ...(item.type === 'date' ? { format: 'date-time' } : {}),
    },
    ...(item.description ? { description: item.description } : {}),
  }));
  const operation: Record<string, unknown> = {
    summary: endpoint.title,
    description: endpoint.description,
    parameters,
    ...(endpoint.body.kind !== 'none' && !['GET', 'HEAD'].includes(endpoint.method)
      ? {
          requestBody: {
            required: true,
            content: { [endpoint.body.contentType]: { schema: payloadSchema(endpoint.body) } },
          },
        }
      : {}),
    responses: {
      [String(endpoint.response.status)]: {
        description: 'Ответ',
        content: { [endpoint.response.contentType]: { schema: payloadSchema(endpoint.response) } },
      },
    },
  };
  return JSON.stringify(
    {
      openapi: '3.0.3',
      info: { title: endpoint.title || 'API', version: '1.0.0' },
      paths: { [path]: { [endpoint.method.toLowerCase()]: operation } },
    },
    null,
    2,
  );
}

export function generateApiHtmlPreview(data: ApiEndpointData): string {
  const endpoint = createApiEndpointData(data);
  const parameters = endpoint.parameters
    .map(
      (item) =>
        `<tr><td><code>${escapeHtml(item.name)}</code></td><td>${item.in === 'path' ? 'путь' : 'запрос'}</td><td>${apiTypeLabel(item.type)}</td><td>${item.required ? 'да' : 'нет'}</td><td>${escapeHtml(item.description)}</td></tr>`,
    )
    .join('');
  return `<article class="api-endpoint-doc"><header><span class="api-method api-method-${endpoint.method.toLowerCase()}">${endpoint.method}</span><code class="api-uri">${escapeHtml(endpoint.uri)}</code></header><h2>${escapeHtml(endpoint.title)}</h2>${endpoint.description ? `<p>${escapeHtml(endpoint.description)}</p>` : ''}${parameters ? `<h3>Параметры</h3><table><thead><tr><th>Название</th><th>Расположение</th><th>Тип</th><th>Обязательный</th><th>Описание</th></tr></thead><tbody>${parameters}</tbody></table>` : ''}<h3>Тело запроса</h3>${payloadHtml(endpoint.body)}<h3>Ответ ${endpoint.response.status}</h3>${payloadHtml(endpoint.response)}</article>`;
}

function generateEncodedPath(endpoint: ApiEndpointData) {
  const [path] = endpoint.uri.split('?');
  return path.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name: string) => {
    const parameter = endpoint.parameters.find((item) => item.in === 'path' && item.name === name);
    return parameter?.required
      ? `\${encodeURIComponent(String(params.${name}))}`
      : `\${params.${name} == null ? '' : encodeURIComponent(String(params.${name}))}`;
  });
}
function operationName(endpoint: ApiEndpointData) {
  const [path] = endpoint.uri.split('?');
  const words = `${endpoint.method.toLowerCase()} ${path.replaceAll(/\{[^}]+\}/g, ' by id ')}`
    .replaceAll(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/);
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('') || 'Endpoint';
}
function parameterTsType(type: ApiParameterType) {
  return type === 'number' ? 'number' : type === 'date' ? 'string | Date' : 'string';
}
function payloadTsType(payload: ApiPayload) {
  if (payload.kind === 'none') return 'undefined';
  if (payload.kind === 'string') return 'string';
  if (payload.kind === 'formData') return 'FormData';
  return objectTsType(payload.schema, 0);
}
function objectTsType(fields: ApiSchemaField[], depth: number): string {
  if (!fields.length) return 'Record<string, unknown>';
  const pad = '  '.repeat(depth);
  return `{\n${fields.map((field) => `${pad}  ${field.description ? `/** ${field.description.replaceAll('*/', '* /')} */\n${pad}  ` : ''}${safeTsProperty(field.name)}${field.required ? '' : '?'}: ${fieldTsType(field, depth + 1)};`).join('\n')}\n${pad}}`;
}
function fieldTsType(field: ApiSchemaField, depth: number): string {
  if (field.type === 'object') return objectTsType(field.children, depth);
  if (field.type === 'array') return `Array<${field.children[0] ? fieldTsType(field.children[0], depth) : 'unknown'}>`;
  if (field.type === 'integer' || field.type === 'number') return 'number';
  if (field.type === 'date') return 'string';
  return field.type;
}
function safeTsProperty(name: string) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}
function generateFetchBody(payload: ApiPayload) {
  if (payload.kind === 'formData') return `    body: body as FormData,`;
  if (payload.kind === 'string')
    return `    headers: { 'Content-Type': '${payload.contentType}' },\n    body: String(body),`;
  return `    headers: { 'Content-Type': '${payload.contentType}' },\n    body: JSON.stringify(body),`;
}
function payloadSchema(payload: ApiPayload): Record<string, unknown> {
  if (payload.kind === 'none') return {};
  if (payload.kind === 'string') return { type: 'string' };
  return {
    type: 'object',
    properties: Object.fromEntries(payload.schema.map((field) => [field.name, fieldSchema(field)])),
    required: payload.schema.filter((field) => field.required).map((field) => field.name),
  };
}
function fieldSchema(field: ApiSchemaField): Record<string, unknown> {
  if (field.type === 'array')
    return { type: 'array', items: field.children[0] ? fieldSchema(field.children[0]) : { type: 'string' } };
  if (field.type === 'object')
    return {
      type: 'object',
      properties: Object.fromEntries(field.children.map((child) => [child.name, fieldSchema(child)])),
      required: field.children.filter((child) => child.required).map((child) => child.name),
    };
  return {
    type: field.type === 'date' ? 'string' : field.type,
    ...(field.type === 'date' ? { format: 'date-time' } : {}),
    ...(field.description ? { description: field.description } : {}),
  };
}
function payloadHtml(payload: ApiPayload) {
  return `<p><code>${escapeHtml(payload.contentType)}</code> · ${bodyKindLabel(payload.kind)}</p>${
    payload.schema.length
      ? `<table><thead><tr><th>Поле</th><th>Тип</th><th>Обязательное</th><th>Описание</th></tr></thead><tbody>${flattenSchema(
          payload.schema,
        )
          .map(
            (item) =>
              `<tr><td><code>${'&nbsp;'.repeat(item.depth * 4)}${escapeHtml(item.field.name)}</code></td><td>${apiTypeLabel(item.field.type)}</td><td>${item.field.required ? 'да' : 'нет'}</td><td>${escapeHtml(item.field.description)}</td></tr>`,
          )
          .join('')}</tbody></table>`
      : ''
  }`;
}
function flattenSchema(fields: ApiSchemaField[], depth = 0): Array<{ field: ApiSchemaField; depth: number }> {
  return fields.flatMap((field) => [{ field, depth }, ...flattenSchema(field.children, depth + 1)]);
}

function apiTypeLabel(type: ApiParameterType | ApiSchemaType): string {
  return {
    string: 'строка',
    number: 'число',
    integer: 'целое число',
    boolean: 'логическое значение',
    date: 'дата',
    object: 'объект',
    array: 'массив',
    null: 'пустое значение',
  }[type];
}

function bodyKindLabel(kind: ApiBodyKind): string {
  return { none: 'без тела', string: 'строка', formData: 'данные формы', object: 'объект' }[kind];
}
function normalizePayload(value: unknown, fallback: ApiPayload): ApiPayload {
  if (!value || typeof value !== 'object') return { ...fallback, schema: [] };
  const item = value as Partial<ApiPayload>;
  return {
    contentType: typeof item.contentType === 'string' ? item.contentType : fallback.contentType,
    kind: apiBodyKinds.includes(item.kind as ApiBodyKind) ? item.kind! : fallback.kind,
    schema: Array.isArray(item.schema) ? item.schema.filter(isSchemaField).map(normalizeField) : [],
  };
}
function normalizeField(field: ApiSchemaField): ApiSchemaField {
  return {
    ...field,
    children: Array.isArray(field.children) ? field.children.filter(isSchemaField).map(normalizeField) : [],
  };
}
function isParameter(value: unknown): value is ApiParameter {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ApiParameter>;
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    (item.in === 'path' || item.in === 'query') &&
    apiParameterTypes.includes(item.type as ApiParameterType)
  );
}
function isSchemaField(value: unknown): value is ApiSchemaField {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ApiSchemaField>;
  return (
    typeof item.id === 'string' && typeof item.name === 'string' && apiSchemaTypes.includes(item.type as ApiSchemaType)
  );
}
function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
