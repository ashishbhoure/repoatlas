import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth/auth";
import { toApiErrorBody, AppError } from "@/lib/errors";

function disabled() {
  return Response.json(
    toApiErrorBody(new AppError("FEATURE_DISABLED", "Accounts are not enabled on this RepoAtlas instance.")),
    { status: 501 },
  );
}

async function handle(request: Request) {
  const auth = getAuth();
  if (!auth) return disabled();
  return toNextJsHandler(auth).POST(request);
}

export async function GET(request: Request) {
  const auth = getAuth();
  if (!auth) return disabled();
  return toNextJsHandler(auth).GET(request);
}

export const POST = handle;
