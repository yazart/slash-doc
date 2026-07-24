import { describe, expect, it } from 'vitest';
import {
  createApiEndpointData,
  generateAngularRequest,
  generateApiHtmlPreview,
  generateNativeFetch,
  generateSwaggerSchema,
  generateTypeScriptModels,
  parseApiUri,
  syncApiParameters,
  type ApiEndpointData,
  type ApiParameter,
} from '../src/shared/api-endpoint';

function endpointFixture(): ApiEndpointData {
  return createApiEndpointData({
    title: 'Создать <пользователя>',
    description: 'Возвращает & сохраняет',
    method: 'POST',
    uri: '/api/v1/users/{user_id}?{expand}&{limit}',
    parameters: [
      parameter('user_id', 'path', 'string', true),
      parameter('expand', 'query', 'string', false),
      parameter('limit', 'query', 'number', true),
    ],
    body: {
      contentType: 'application/json',
      kind: 'object',
      schema: [
        {
          id: 'name',
          name: 'display-name',
          type: 'string',
          required: true,
          description: 'Имя',
          example: 'Ada',
          children: [],
        },
      ],
    },
    response: {
      status: 201,
      contentType: 'application/json',
      kind: 'object',
      schema: [
        {
          id: 'id',
          name: 'id',
          type: 'integer',
          required: true,
          description: '',
          example: '1',
          children: [],
        },
      ],
    },
  });
}

function parameter(
  name: string,
  location: ApiParameter['in'],
  type: ApiParameter['type'],
  required: boolean,
): ApiParameter {
  return { id: name, name, in: location, type, required, description: '', example: '' };
}

describe('API endpoint normalization', () => {
  it('extracts unique path and query placeholders', () => {
    expect(parseApiUri('/teams/{team}/users/{user}?{expand}&page={page}&{expand}')).toEqual([
      { name: 'team', in: 'path' },
      { name: 'user', in: 'path' },
      { name: 'expand', in: 'query' },
      { name: 'page', in: 'query' },
    ]);
  });

  it('preserves matching metadata and creates required path parameters', () => {
    const current = parameter('expand', 'query', 'date', true);
    const parameters = syncApiParameters('/users/{id}?{expand}', [current]);

    expect(parameters[0]).toMatchObject({ name: 'id', in: 'path', type: 'string', required: true });
    expect(parameters[1]).toEqual(current);
  });

  it('falls back from unsupported methods and invalid payload kinds', () => {
    const data = createApiEndpointData({
      method: 'TRACE' as ApiEndpointData['method'],
      body: { contentType: 'text/plain', kind: 'invalid' as never, schema: [] },
    });

    expect(data.method).toBe('GET');
    expect(data.body.kind).toBe('none');
  });
});

describe('API endpoint generators', () => {
  it('encodes URI variables in Fetch and Angular examples', () => {
    const endpoint = endpointFixture();
    const fetch = generateNativeFetch(endpoint);
    const angular = generateAngularRequest(endpoint);

    expect(fetch).toContain('encodeURIComponent(String(params.user_id))');
    expect(fetch).toContain('encodeURIComponent(String(query.expand))');
    expect(fetch).toContain("method: 'POST'");
    expect(fetch).toContain('body: JSON.stringify(body)');
    expect(angular).toContain("this.http.request('POST'");
    expect(angular).toContain('encodeURIComponent(String(query.limit))');
  });

  it('generates typed request and response models', () => {
    const models = generateTypeScriptModels(endpointFixture());

    expect(models).toContain('export interface PostApiV1UsersByIdPathParams');
    expect(models).toContain('user_id: string;');
    expect(models).toContain('"display-name": string;');
    expect(models).toContain('id: number;');
  });

  it('generates a valid OpenAPI document', () => {
    const swagger = JSON.parse(generateSwaggerSchema(endpointFixture()));
    const operation = swagger.paths['/api/v1/users/{user_id}'].post;

    expect(swagger.openapi).toBe('3.0.3');
    expect(operation.requestBody.content['application/json'].schema.required).toEqual(['display-name']);
    expect(operation.responses['201'].content['application/json'].schema.properties.id.type).toBe('integer');
  });

  it('escapes user-provided HTML in documentation preview', () => {
    const html = generateApiHtmlPreview(endpointFixture());

    expect(html).toContain('Создать &lt;пользователя&gt;');
    expect(html).toContain('Возвращает &amp; сохраняет');
    expect(html).not.toContain('<пользователя>');
  });
});
