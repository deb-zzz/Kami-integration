/**
 * Request-scoped cache shim for React 18 compatibility.
 * React 19 exports cache() from 'react'; this provides the same API
 * so the app builds with React 18. Pass-through (no deduplication).
 */
export function cache<T>(fn: T): T {
	return fn;
}
