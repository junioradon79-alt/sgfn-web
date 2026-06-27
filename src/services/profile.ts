import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/database";

export async function getProfile(
  userId: string
): Promise<{
  data: Profile | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  return {
    data,
    error,
  };
}