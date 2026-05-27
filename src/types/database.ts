// Tipos generados manualmente que reflejan el esquema en Supabase.
// Mantener sincronizado con las migraciones.

export type UserRole = "admin" | "cotizador";
export type ServiceType =
  | "card_processing"
  | "alternative_payment"
  | "international_payin"
  | "international_payout";
export type CardType = "debit" | "credit" | "international" | "amex";
// Antes era enum fijo. Ahora es texto libre referenciando payment_methods.code
export type AltPaymentMethod = string;
export type QuoteStatus = "draft" | "sent" | "approved" | "rejected";

export type PaymentMethod = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};
export type ExtraFeeFrequency = "one_time" | "monthly" | "annual" | "per_transaction";

export type ExtraFee = {
  id: string;          // uuid local en cliente
  title: string;
  amount: number;
  currency: string;
  frequency: ExtraFeeFrequency;
  notes?: string | null;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export type Currency = {
  code: string;
  name: string;
  symbol: string;
  created_at: string;
};

export type Country = {
  id: string;
  code: string;
  name: string;
  default_currency_code: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type Provider = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProviderCost = {
  id: string;
  provider_id: string;
  service_type: ServiceType;
  subtype: string | null;
  country_code: string | null;
  currency_code: string;
  cost_variable: number | null;
  cost_fixed: number | null;
  cost_chargeback: number | null;
  cost_refund: number | null;
  cost_dispersion: number | null;
  settlement_time: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type Quote = {
  id: string;
  quote_number: string;
  customer_name: string;
  customer_company: string | null;
  customer_email: string | null;
  customer_contact: string | null;
  notes: string | null;
  status: QuoteStatus;
  settlement_currency: string | null;
  minimum_monthly_billing: number | null;
  charges_3ds: boolean;
  cost_3ds: number | null;
  price_3ds: number | null;
  provider_3ds_id: string | null;
  has_monthly_fee: boolean;
  monthly_fee: number | null;
  has_annual_fee: boolean;
  annual_fee: number | null;
  has_rolling_reserve: boolean;
  rolling_reserve_pct: number | null;
  rolling_reserve_release_days: number | null;
  extra_fees: ExtraFee[];
  includes_card_processing: boolean;
  includes_alternative_payments: boolean;
  includes_international_payments: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type QuoteCardProcessing = {
  id: string;
  quote_id: string;
  country_code: string;
  currency_code: string;
  card_type: CardType;
  settlement_time: string | null;
  has_variable: boolean;
  price_variable: number | null;
  cost_variable: number | null;
  provider_variable_id: string | null;
  has_fixed: boolean;
  price_fixed: number | null;
  cost_fixed: number | null;
  provider_fixed_id: string | null;
  has_chargeback: boolean;
  price_chargeback: number | null;
  cost_chargeback: number | null;
  provider_chargeback_id: string | null;
  has_refund: boolean;
  price_refund: number | null;
  cost_refund: number | null;
  provider_refund_id: string | null;
  created_at: string;
};

export type QuoteAlternativePayment = {
  id: string;
  quote_id: string;
  country_code: string;
  currency_code: string;
  method: AltPaymentMethod;
  settlement_time: string | null;
  has_variable: boolean;
  price_variable: number | null;
  cost_variable: number | null;
  provider_variable_id: string | null;
  has_fixed: boolean;
  price_fixed: number | null;
  cost_fixed: number | null;
  provider_fixed_id: string | null;
  has_dispersion: boolean;
  price_dispersion: number | null;
  cost_dispersion: number | null;
  provider_dispersion_id: string | null;
  created_at: string;
};

export type QuoteInternationalPayment = {
  id: string;
  quote_id: string;
  country_code: string;
  currency_code: string;
  has_payin: boolean;
  payin_price_variable: number | null;
  payin_cost_variable: number | null;
  payin_provider_variable_id: string | null;
  payin_price_fixed: number | null;
  payin_cost_fixed: number | null;
  payin_provider_fixed_id: string | null;
  has_payout: boolean;
  payout_price_variable: number | null;
  payout_cost_variable: number | null;
  payout_provider_variable_id: string | null;
  payout_price_fixed: number | null;
  payout_cost_fixed: number | null;
  payout_provider_fixed_id: string | null;
  created_at: string;
};

// Tipo wrapper compatible con Supabase
export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      currencies: { Row: Currency; Insert: Partial<Currency>; Update: Partial<Currency> };
      countries: { Row: Country; Insert: Partial<Country>; Update: Partial<Country> };
      providers: { Row: Provider; Insert: Partial<Provider>; Update: Partial<Provider> };
      provider_costs: { Row: ProviderCost; Insert: Partial<ProviderCost>; Update: Partial<ProviderCost> };
      quotes: { Row: Quote; Insert: Partial<Quote>; Update: Partial<Quote> };
      quote_card_processing: {
        Row: QuoteCardProcessing;
        Insert: Partial<QuoteCardProcessing>;
        Update: Partial<QuoteCardProcessing>;
      };
      quote_alternative_payments: {
        Row: QuoteAlternativePayment;
        Insert: Partial<QuoteAlternativePayment>;
        Update: Partial<QuoteAlternativePayment>;
      };
      quote_international_payments: {
        Row: QuoteInternationalPayment;
        Insert: Partial<QuoteInternationalPayment>;
        Update: Partial<QuoteInternationalPayment>;
      };
    };
    Enums: {
      user_role: UserRole;
      service_type: ServiceType;
      card_type: CardType;
      alt_payment_method: AltPaymentMethod;
      quote_status: QuoteStatus;
    };
  };
};
