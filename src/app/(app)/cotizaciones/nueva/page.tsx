import { createClient } from "@/lib/supabase/server";
import QuoteBuilder from "./QuoteBuilder";
import { saveQuote } from "./actions";

export default async function NuevaCotizacionPage() {
  const supabase = await createClient();

  const [{ data: countries }, { data: currencies }, { data: providers }, { data: providerCosts }, { data: paymentMethods }] = await Promise.all([
    supabase.from("countries").select("*").eq("active", true).order("name"),
    supabase.from("currencies").select("*").order("code"),
    supabase.from("providers").select("*").eq("active", true).order("name"),
    supabase.from("provider_costs").select("*"),
    supabase.from("payment_methods").select("*").eq("active", true).order("display_order"),
  ]);

  return (
    <QuoteBuilder
      countries={countries || []}
      currencies={currencies || []}
      providers={providers || []}
      providerCosts={providerCosts || []}
      paymentMethods={paymentMethods || []}
      saveAction={saveQuote}
    />
  );
}
