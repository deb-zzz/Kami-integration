# Checkout Processor

Orchestrates the full checkout flow: validates items and charges, then runs buy → deploy → mint operations.

## Gasless / EntryPoint

When the platform funding EOA is the SimpleAccount owner (default setup):

-   **Deploy** and **mint** use the **direct path** (EOA → SimpleAccount.execute). No EntryPoint and no deposit top-up.
-   **setPrice** and other **after-mint operations** (setTokenURI, setTotalSupply, etc.) use the **EntryPoint** when `USE_ENTRY_POINT_FOR_EXECUTE=true`; the service tops up the SimpleAccount’s EntryPoint deposit as needed before those calls.

Checkout only runs deploy and mint; setPrice is typically called later via the asset/product setPrice APIs, which use the EntryPoint path when enabled.

**KAMI721C vs KAMI721AC:**

-   **KAMI721C (ERC721C)** uses **per-token pricing**: the mint price is passed in the mint call; there is no global `setMintPrice`. After deploy we only grant OWNER_ROLE; we never call `setMintPrice` for ERC721C.
-   **KAMI721AC (ERC721AC)** uses a **global mint price**: we may call `setMintPrice` after deploy (or before mint if not set). Checkout mint flow ensures mint price is set for ERC721AC before minting.

## Public API

-   **`processCheckout(checkoutId, checkoutItems, buyerWalletAddress, onProgress?)`**  
    Single entry point. Returns a `CheckoutResponse` (success, deployedCollections, mintedTokens, purchasedAssets, errors). Never throws; errors are returned in the response.

## Module layout

| File              | Role                                                                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **index.ts**      | Orchestrator: calls validation, then execution phases in order. Exports `processCheckout`.                                                                                                             |
| **types.ts**      | Types (`ToDeploy`, `ToMint`, `ToBuy`, `ProgressCallback`, result types) and `PROGRESS_RANGES`.                                                                                                         |
| **nft-rules.ts**  | Central NFT/contract-type rules: mint/buy/deploy support and quantity limits per type (ERC721C, ERC721AC, ERC1155C). **When adding new NFT types, update this module and validation/categorisation.**  |
| **helpers.ts**    | Shared helpers: `reportProgress`, `pushItemError`, `getPaymentToken`, `transferChargesForItem`.                                                                                                        |
| **validation.ts** | `validateCharges` (buyer balance for charges), `validateAndCategorizeItems` (per-item validation and routing into deploy/mint/buy queues). Uses `nft-rules` for quantity and contract-type validation. |
| **execution.ts**  | Phase runners: `executeBuyPhase`, `executeDeployPhase`, `executeMintPhase`. Also contains `buyAsset`, `deployCollection`, `mintVoucher`.                                                               |

## Flow

1. **Charge validation** – Ensure buyer has enough balance for all charges (per chain + payment token).
2. **Item validation & categorization** – For each item: resolve product → voucher if needed, validate voucher/collection/quantity, then route into:
    - **toDeploy** – collection not deployed yet (will deploy then mint first voucher).
    - **toMint** – voucher-based mints (ERC721AC batches grouped by voucherId).
    - **toBuy** – asset-based purchases (with optional ERC721AC buy→mint conversion when seller is creator).
3. **Execution** – Run in order: **Buy** (60–90% progress) → **Deploy** (10–30%) → **Mint** (30–60%). Deploy appends first voucher to `toMint`; mint runs the combined list. Progress is reported via `onProgress`.

## Usage

```ts
import { processCheckout } from '@/lib/checkout-processor';

const result = await processCheckout(checkoutId, checkoutItems, buyerWalletAddress, async (progress, stage) => {
	/* optional progress callback */
});
```

Used by `src/app/api/checkout/route.ts` for sync and async checkout.

---

## Async checkout for callers (e.g. cart-service)

Checkout can run for several minutes (deploy, mint, buy). If the UI calls cart-service and cart-service calls this API and waits for completion, the UI request can time out.

**Fix: use async mode so no service waits for checkout to finish.**

### Contract for callers (e.g. cart-service)

1. **Start checkout (async)**  
   `POST /api/checkout?async=true`  
   Body: `{ checkoutId, checkoutItems, walletAddress }`

    - Returns **202 Accepted** immediately.
    - Response body: `{ success: true, checkoutId, status: 'pending', message: '...' }`
    - Cart-service should return **202** to the UI right away with the same `checkoutId` (or a cart/order job id that maps to it).

2. **Get completion status**  
   `GET /api/checkout/{checkoutId}/status`

    - Returns current job: `status` (`pending` | `processing` | `completed` | `failed`), `progress`, `stage`, and when finished: `result` (full checkout result) or `error` / `errors`.
    - Cart-service can poll this and expose its own status endpoint that the UI polls, or return `checkoutId` to the UI so the UI polls this API directly.

3. **Optional: live progress via SSE**  
   `GET /api/checkout/{checkoutId}/stream`

    - Server-Sent Events: `progress`, `status`, then `complete` (with `result`) or `error` (with `error` / `errors`).
    - Useful if the UI wants a single long-lived connection instead of polling.

    **UI example (EventSource):**

    ```js
    const streamUrl = `${API_BASE}/api/checkout/${checkoutId}/stream`;
    const eventSource = new EventSource(streamUrl);

    eventSource.onmessage = (e) => {
    	const { type, data } = JSON.parse(e.data);
    	if (type === 'progress') {
    		setProgress(data.progress);
    		setStage(data.stage);
    	}
    	if (type === 'complete') {
    		eventSource.close();
    		onSuccess(data.result);
    	}
    	if (type === 'error') {
    		eventSource.close();
    		onError(data.error, data.errors);
    	}
    };

    eventSource.onerror = () => {
    	eventSource.close();
    	onError('Stream connection failed');
    };
    ```

### NGINX and API Gateway configuration for SSE

The UI reaches this service via **NGINX** and a **Node.js API Gateway**. Both must pass the SSE response through without buffering and avoid closing the connection before the stream ends.

#### NGINX

-   **Disable buffering** so events are sent to the client as soon as the backend emits them. The app already sends `X-Accel-Buffering: no`; NGINX honours that. You can also set it in config:
    ```nginx
    location /api/checkout/ {
      proxy_pass http://api_gateway_or_backend;
      proxy_buffering off;
      proxy_cache off;
      proxy_read_timeout 300s;   # stream can run up to 5 minutes
      proxy_connect_timeout 10s;
      proxy_send_timeout 300s;
    }
    ```
-   **Timeouts**: The stream endpoint keeps the connection open until checkout completes or 5 minutes. Use `proxy_read_timeout` and `proxy_send_timeout` of at least 300 seconds (or higher if checkout can run longer). Shorter values will cut the connection mid-stream.

#### Nginx Proxy Manager

When the reverse proxy is managed by **Nginx Proxy Manager (NPM)**, use one of these approaches so SSE is not buffered and the connection is not closed too early.

**Option A – Custom location with advanced config**

1. Edit the **Proxy Host** that serves the API (or web3-service).
2. Open **Custom locations** and add a location:
    - **Define location**: e.g. `/api/checkout` (or `/api/checkout/`).
    - **Scheme**: `http` or `https` (to match your upstream).
    - **Forward hostname / Forward port**: your API gateway or web3-service host and port.
3. In the **Advanced** (or custom configuration) section for that location, add:

    ```nginx
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 300s;
    proxy_connect_timeout 10s;
    proxy_send_timeout 300s;
    ```

    NPM will merge this with the generated `proxy_pass` and other proxy directives for that location.

**Option B – Custom Nginx config in the Proxy Host**

1. Edit the **Proxy Host**.
2. Open the **Advanced** tab and in **Custom Nginx Configuration** (injected inside the `server { }` block) add a dedicated location for the checkout API:

    ```nginx
    location /api/checkout/ {
        proxy_pass http://YOUR_UPSTREAM;  # same upstream as your API, e.g. http://api-gateway:3000
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
        proxy_connect_timeout 10s;
        proxy_send_timeout 300s;
    }
    ```

    Replace `http://YOUR_UPSTREAM` with the same upstream you use for the API (e.g. `http://127.0.0.1:3000` or the API gateway container/host). This location takes precedence for `/api/checkout/` so the stream gets the right timeouts and no buffering.

**Notes**

-   If the API is on the same host as NPM, use `http://127.0.0.1:PORT` or the container name; if it’s the API Gateway, use that service’s address.
-   300s timeouts match the stream’s 5‑minute limit; increase if checkout can run longer.
-   The backend already sends `X-Accel-Buffering: no`; the directives above ensure NPM’s generated config also disables buffering for this path.

#### Node.js API Gateway

-   **Stream the response** – do not buffer the upstream response. Pipe the response body (and forward headers) so chunks are sent to the client as they arrive.
-   **Timeouts**: Disable or raise the gateway’s response timeout for the stream path so it does not close the connection before the backend finishes. For example, if using Express with a global timeout middleware, exclude the checkout stream route or set a long timeout (e.g. 5+ minutes) for that path.
-   **Headers**: Forward upstream headers that the backend sends for SSE:
    -   `Content-Type: text/event-stream`
    -   `Cache-Control: no-cache`
    -   `Connection: keep-alive`
    -   `X-Accel-Buffering: no` (so NGINX in front of the gateway does not buffer)

**Example (Express + http-proxy-middleware, stream through):**

```js
const { createProxyMiddleware } = require('http-proxy-middleware');

// Proxy to web3-service; by default many proxies stream the response
app.use(
	'/api/checkout',
	createProxyMiddleware({
		target: 'http://web3-service',
		changeOrigin: true,
		// Increase timeout for long-lived SSE (e.g. 5 minutes)
		proxyTimeout: 300000,
		timeout: 300000,
		onProxyRes(proxyRes) {
			// Ensure SSE headers are not stripped
			proxyRes.headers['x-accel-buffering'] = 'no';
		},
	})
);
```

**Manual proxy (stream pipe)** – when the gateway must rewrite the path, add auth, or use a different HTTP client:

```js
const http = require('http');

const WEB3_SERVICE_URL = new URL(process.env.WEB3_SERVICE_URL || 'http://localhost:3000');
const SSE_TIMEOUT_MS = 300000; // 5 minutes

// Express example: GET /api/checkout/:checkoutId/stream
app.get('/api/checkout/:checkoutId/stream', (req, res) => {
	const { checkoutId } = req.params;
	const path = `${WEB3_SERVICE_URL.pathname}/api/checkout/${checkoutId}/stream`;

	const proxyReq = http.request(
		{
			hostname: WEB3_SERVICE_URL.hostname,
			port: WEB3_SERVICE_URL.port || 80,
			path,
			method: 'GET',
			timeout: SSE_TIMEOUT_MS,
		},
		(proxyRes) => {
			// Forward SSE headers to the client
			res.writeHead(proxyRes.statusCode, {
				'Content-Type': proxyRes.headers['content-type'] || 'text/event-stream',
				'Cache-Control': proxyRes.headers['cache-control'] || 'no-cache',
				Connection: 'keep-alive',
				'X-Accel-Buffering': 'no',
			});

			// Pipe upstream body to client (stream; no buffering)
			proxyRes.pipe(res, { end: true });
		}
	);

	proxyReq.on('error', (err) => {
		if (!res.writableEnded) {
			res.writeHead(502, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ error: 'Gateway error', message: err.message }));
		}
	});

	proxyReq.end();
});
```

Important: do **not** read the full response with `await response.json()` or concatenate the body; use `pipe(res)` or forward chunks so the client receives events as they arrive.

### Summary for cart-service

-   Call `POST /api/checkout?async=true`; do **not** wait for checkout to complete.
-   Return **202** to the UI with `checkoutId` (or equivalent job id).
-   Expose a status endpoint that either forwards `GET /api/checkout/{checkoutId}/status` or proxies the same fields so the UI can poll until `status === 'completed'` or `'failed'` and then show `result` or `error`/`errors`.
-   **Debugging:** The checkout API logs each request with prefix `[checkout] Request` (checkoutId, walletAddress, item count, and per-item fields). Use server logs to verify the payload cart-service sends (e.g. that `assetId` or `tokenId` is present for buy).
