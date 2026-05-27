import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import QuoteBuilder from "../../nueva/QuoteBuilder";
import { updateQuote } from "../../nueva/actions";

export default async function EditarCotizacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: quote }, { data: cardLines }, { data: altLines }, { data: intlLines },
         { data: countries }, { data: currencies }, { data: providers }, { data: providerCosts }, { data: paymentMethods }] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", id).single(),
    supabase.from("quote_card_processing").select("*").eq("quote_id", id),
    supabase.from("quote_alternative_payments").select("*").eq("quote_id", id),
    supabase.from("quote_international_payments").select("*").eq("quote_id", id),
    supabase.from("countries").select("*").eq("active", true).order("name"),
    supabase.from("currencies").select("*").order("code"),
    supabase.from("providers").select("*").eq("active", true).order("name"),
    supabase.from("provider_costs").select("*"),
    supabase.from("payment_methods").select("*").eq("active", true).order("display_order"),
  ]);

  if (!quote) redirect("/cotizaciones");

  const initialQuote = {
    ...quote,
    cardLines: cardLines || [],
    altLines: altLines || [],
    intlLines: intlLines || [],
  };

  const saveAction = async (payload: any) => {
    "use server";
    await updateQuote(id, payload);
  };

  return (
    <QuoteBuilder
      countries={countries || []}
      currencies={currencies || []}
      providers={providers || []}
      providerCosts={providerCosts || []}
      paymentMethods={paymentMethods || []}
      initialQuote={initialQuote}
      saveAction={saveAction}
    />
  );
}
