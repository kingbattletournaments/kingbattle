import type { SupabaseClient } from "@supabase/supabase-js";
import { generateTransactionId } from "@/lib/id-formats";

export type CoinTransactionInsert = {
  user_id: string;
  amount: number;
  type: string;
  reference_id?: string | null;
  reference_text?: string | null;
  description?: string | null;
};

export async function insertCoinTransaction(
  supabase: SupabaseClient,
  payload: CoinTransactionInsert,
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const id = generateTransactionId();
    const { error } = await supabase.from("app_coin_transactions").insert({ id, ...payload });
    if (!error) return id;
    if ((error as { code?: string }).code !== "23505") {
      console.error("insertCoinTransaction failed:", error.message);
      throw error;
    }
  }
  throw new Error("Could not allocate a unique transaction id");
}
