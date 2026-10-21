import "server-only";
import { z } from "zod";
import { AppError, toApiErrorBody, toAppError } from "@/lib/errors";
import { rethrowFrameworkErrors } from "@/lib/errors/server";
import { log } from "@/lib/observability/logger";

/** Converts any thrown error into the consistent API error format with a safe message. */
export function errorResponse(e: unknown): Response {
  const err = toAppError(e);
  if (err.code === "INTERNAL") {
    log.error("api.error", { code: err.code, error: err.cause ?? err });
  } else if (err.status >= 500 && err.code !== "FEATURE_DISABLED") {
    log.warn("api.upstream_error", { code: err.code, message: err.userMessage });
  }
  const headers: Record<string, string> = {};
  if (err.retryAfter !== undefined) headers["Retry-After"] = String(err.retryAfter);
  return Response.json(toApiErrorBody(err), { status: err.status, headers });
}

/** Wraps a route handler so every failure goes through errorResponse. */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      rethrowFrameworkErrors(e);
      return errorResponse(e);
    }
  };
}

export function parseOrThrow<S extends z.ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  const r = schema.safeParse(value);
  if (!r.success) {
    const issue = r.error.issues[0];
    const where = issue.path.length ? `${issue.path.join(".")}: ` : "";
    throw new AppError("INVALID_INPUT", `${where}${issue.message}`);
  }
  return r.data;
}

/** Reads a JSON body with a size cap; rejects non-JSON or oversized payloads. */
export async function readJson(request: Request, maxBytes = 16_384): Promise<unknown> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new AppError("INVALID_INPUT", "Expected a JSON request body.");
  const text = await request.text();
  if (text.length > maxBytes) throw new AppError("INVALID_INPUT", "Request body is too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("INVALID_INPUT", "Request body is not valid JSON.");
  }
}

/**
 * CSRF defence for cookie-authenticated mutations: the Origin header must match the app.
 * Combined with SameSite=Lax session cookies this blocks cross-site form/fetch attacks.
 */
export function assertSameOrigin(request: Request, appUrl: string) {
  const origin = request.headers.get("origin");
  const expected = new URL(appUrl).origin;
  const actual = origin ?? (request.headers.get("referer") ? new URL(request.headers.get("referer")!).origin : null);
  if (actual !== expected) {
    throw new AppError("FORBIDDEN", "Cross-origin requests are not allowed.");
  }
}
