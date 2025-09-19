// Alias route for legacy/external systems expecting /api/wroker_webhook
// Reuse the same POST handler as /api/worker-webhook
export { POST } from "../worker-webhook/route";
