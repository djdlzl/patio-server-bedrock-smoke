'use strict';

const http = require('node:http');
const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');

const region = process.env.AWS_REGION;
const modelId = process.env.PATIO_AI_MODEL_ID;
const configured = process.env.PATIO_AI_MODE === 'bedrock' && Boolean(region && modelId);
const client = configured ? new BedrockRuntimeClient({ region, maxAttempts: 1 }) : null;
let invocation;

function send(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(body));
}

function invokeOnce() {
  if (invocation) return invocation;
  invocation = (async () => {
    if (!client) return { status: 503, body: { ok: false, code: 'AI_NOT_CONFIGURED', configured } };
    try {
      const result = await client.send(new ConverseCommand({
        modelId,
        messages: [{ role: 'user', content: [{ text: 'Reply with exactly PATIO_OK and nothing else.' }] }],
        inferenceConfig: { maxTokens: 16, temperature: 0 },
      }), { abortSignal: AbortSignal.timeout(30_000) });
      const text = (result.output?.message?.content ?? []).map((part) => part.text ?? '').join('');
      return {
        status: 200,
        body: {
          ok: true,
          mode: 'bedrock',
          configured,
          text,
          requestId: result.$metadata?.requestId ?? null,
          inputTokens: result.usage?.inputTokens ?? null,
          outputTokens: result.usage?.outputTokens ?? null,
          stopReason: result.stopReason ?? null,
        },
      };
    } catch (error) {
      return {
        status: 503,
        body: {
          ok: false,
          code: 'BEDROCK_CALL_FAILED',
          error: error?.name ?? 'Error',
          requestId: error?.$metadata?.requestId ?? null,
          configured,
        },
      };
    }
  })();
  return invocation;
}

http.createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/healthz') {
    return send(response, 200, { ok: true });
  }
  if (request.method === 'GET' && request.url === '/') {
    return send(response, 200, { ok: true, service: 'patio-server-bedrock-smoke', configured, invoked: Boolean(invocation) });
  }
  if (request.method === 'POST' && request.url === '/bedrock') {
    const result = await invokeOnce();
    return send(response, result.status, result.body);
  }
  return send(response, 404, { ok: false, code: 'NOT_FOUND' });
}).listen(8080, '0.0.0.0');
