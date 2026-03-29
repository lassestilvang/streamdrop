import { AppError } from "./errors.js";

export function parseRunIdFromPath(requestUrl: string): string {
  const url = new URL(requestUrl);
  const segments = url.pathname.split("/").filter(Boolean);
  const runId = segments[2];

  if (!runId) {
    throw new AppError(400, "INVALID_RUN_ID", "Run id is required.");
  }

  return decodeURIComponent(runId);
}

export function readBatchIndex(requestUrl: string): number {
  const url = new URL(requestUrl);
  const batch = url.searchParams.get("batch");

  if (!batch) {
    throw new AppError(400, "INVALID_QUERY", "batch is required.");
  }

  const batchIndex = Number.parseInt(batch, 10);

  if (!Number.isInteger(batchIndex) || batchIndex < 1) {
    throw new AppError(400, "INVALID_QUERY", "batch must be a positive integer.");
  }

  return batchIndex;
}
