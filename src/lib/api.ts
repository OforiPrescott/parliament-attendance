import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type z } from "zod";
import { getSessionUser, type SessionUser } from "./auth";
import { can, type Permission } from "./permissions";
import { PG } from "./sql";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

type Ctx<P> = { req: NextRequest; user: SessionUser; params: P };
type Options = { permission?: Permission | Permission[]; allowPasswordChange?: boolean };

/**
 * Wraps a route handler with authentication, authorisation and uniform error
 * handling. Mutating requests are additionally origin-checked in middleware.
 */
export function route<P extends Record<string, string> = Record<string, string>>(
  opts: Options,
  handler: (ctx: Ctx<P>) => Promise<unknown>,
) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    try {
      const user = await getSessionUser();
      if (!user) throw new ApiError(401, "Your session has ended. Please sign in again.");
      if ((user.mustChangePassword || user.passwordExpired) && !opts.allowPasswordChange)
        throw new ApiError(403, "You must change your password before continuing.");
      if (opts.permission && !can(user.permissions, opts.permission))
        throw new ApiError(403, "You do not have permission to perform this action.");
      const params = (await context?.params) ?? ({} as P);
      const result = await handler({ req, user, params });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError) return NextResponse.json({ error: e.message, details: e.details }, { status: e.status });
  if (e instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const i of e.issues) fields[i.path.join(".") || "_"] ??= i.message;
    return NextResponse.json({ error: "Please correct the highlighted fields.", fields }, { status: 400 });
  }
  const { code, detail } = (e ?? {}) as { code?: string; detail?: string };
  if (code === PG.UNIQUE_VIOLATION)
    return NextResponse.json({ error: "A record with the same unique value already exists." }, { status: 409 });
  if (code === PG.FOREIGN_KEY_VIOLATION && /still referenced/i.test(detail ?? ""))
    return NextResponse.json({ error: "This record is in use elsewhere and cannot be deleted. Deactivate it instead." }, { status: 409 });
  if (code === PG.FOREIGN_KEY_VIOLATION)
    return NextResponse.json({ error: "A referenced record does not exist." }, { status: 400 });
  if (code === PG.CHECK_VIOLATION)
    return NextResponse.json({ error: "One of the values is not allowed. Check the form and try again." }, { status: 400 });
  console.error("[api] unhandled error", e);
  return NextResponse.json({ error: "An unexpected error occurred. It has been logged." }, { status: 500 });
}

export async function body<S extends z.ZodTypeAny>(req: NextRequest, schema: S): Promise<z.output<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.");
  }
  return schema.parse(json);
}

export function query<S extends z.ZodTypeAny>(req: NextRequest, schema: S): z.output<S> {
  const o: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    if (v !== "") o[k] = v;
  });
  return schema.parse(o);
}

export function intParam(v: string | undefined, name = "id"): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(400, `Invalid ${name}.`);
  return n;
}

export function notFound(what = "Record"): never {
  throw new ApiError(404, `${what} not found.`);
}
