import { unstable_rethrow } from "next/navigation";
import { toAppError, type AppError } from "./index";

/**
 * For catch blocks in server components and route handlers: lets Next.js's own control-flow
 * signals (notFound, redirect, prerender bail-outs) through, and converts everything else
 * into a safe AppError.
 */
export function caught(e: unknown): AppError {
  unstable_rethrow(e);
  return toAppError(e);
}

export function rethrowFrameworkErrors(e: unknown): void {
  unstable_rethrow(e);
}
