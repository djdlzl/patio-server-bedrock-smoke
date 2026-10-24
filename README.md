# Patio server and Bedrock smoke example

This small Node server uses the approved `node-service@1` build template and the
runtime AI configuration supplied by Patio. It has no database or storage
dependencies. Install dependencies with `npm ci`, then run `npm start`.

- `GET /healthz`: process health; never calls Bedrock.
- `GET /`: process status and whether managed AI configuration is present.
- `POST /bedrock`: sends one fixed prompt with a maximum of 16 output tokens.

The first `/bedrock` request starts one Bedrock request. Its result, including a
failure, is cached in the running process; later requests reuse it. SDK retries
are disabled. Restarting the process clears the cache. Responses contain only
the fixed prompt's output, AWS request ID, token usage and configuration presence.
Credentials and model identifiers are never returned or logged.
