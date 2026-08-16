// Raw Postgres/PostgREST errors carry a SQLSTATE-style code (e.g. '42703'
// column-not-found, '23505' unique-violation) and can reveal internal
// schema details - table names, column names, constraint names - in their
// message text. Errors we throw ourselves (`throw new Error('Unauthorized')`)
// never have that field. This keeps our own deliberate, safe messages
// intact while replacing anything that looks like a raw DB error with a
// generic one before it reaches the client.
export function clientSafeMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error && typeof error === "object" && "code" in error && typeof (error as any).code === "string") {
    return fallback;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}
