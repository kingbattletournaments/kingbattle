import { isDbConfigured } from "./db";

/** True when the API is using Supabase (persistent). False = in-memory demo store (not for production). */
export function isUsingSupabase(): boolean {
  return isDbConfigured();
}

/**
 * In production, writes must go to Supabase. In-memory data is lost between serverless invocations on Vercel.
 * Returns an error message when writes should be blocked, otherwise null.
 */
export function getProductionStoreError(): string | null {
  if (process.env.NODE_ENV === "production" && !isDbConfigured()) {
    return (
      "Database not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
      "in your deployment environment (e.g. Vercel project settings)."
    );
  }
  return null;
}
