import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import { PAGE_SEO } from "@/lib/seo";
import { PaymentDetailsPanel } from "@/components/payments/PaymentDetailsPanel";
import { PaymentReceiptForm } from "@/components/payments/PaymentReceiptForm";
import type { PaymentMethodId } from "@/lib/payments/paymentCredentials";
import { RECOMMENDED_MONTHLY_PLAN } from "@/lib/conversionPsychology";
import { PLAN_DETAILS } from "@/lib/stripe";

export default function FounderAccessPage() {
  const [searchParams] = useSearchParams();
  const planKey = searchParams.get("plan") || RECOMMENDED_MONTHLY_PLAN;
  
  const [activePaymentMethod, setActivePaymentMethod] = useState<PaymentMethodId>("mobile");
  const [invoiceDraft, setInvoiceDraft] = useState<{
    invoiceId: string;
    invoiceNumber: string;
    paymentReference: string;
  } | null>(null);

  // Validate planKey
  const isValidPlan = planKey in PLAN_DETAILS;
  const safePlanKey = isValidPlan ? (planKey as keyof typeof PLAN_DETAILS) : "pro";
  const selectedProductName = PLAN_DETAILS[safePlanKey].name;

  return (
    <main className="min-h-[100vh] py-20 px-4 flex flex-col items-center max-w-3xl mx-auto">
      <SEOHead meta={PAGE_SEO.founderAccess} />
      
      <div className="text-center space-y-4 mb-10 mt-10">
        <h1 className="text-4xl font-bold tracking-tight">Founder Access</h1>
        <p className="text-muted-foreground">
          Direct activation for ShadowTalk subscriptions via JazzCash, Easypaisa, Bank Transfer, or Crypto.
        </p>
      </div>

      <div className="w-full space-y-8">
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">1. Generate an Invoice</h2>
          <PaymentDetailsPanel
            planKey={safePlanKey}
            selectedProductName={selectedProductName}
            activePaymentMethod={activePaymentMethod}
            onPaymentMethodChange={setActivePaymentMethod}
            onInvoiceDraft={setInvoiceDraft}
          />
        </section>

        <section className="space-y-4 pt-8 border-t border-border/50">
          <h2 className="text-xl font-semibold">2. Submit Payment Receipt</h2>
          <PaymentReceiptForm
            planKey={safePlanKey}
            defaultMethod={activePaymentMethod === "mobile" ? "jazzcash" : activePaymentMethod === "bank" ? "bank_transfer" : "usdt"}
            currency={activePaymentMethod === "mobile" || activePaymentMethod === "bank" ? "PKR" : "USD"}
            invoiceDraftId={invoiceDraft?.invoiceId}
          />
        </section>
      </div>
    </main>
  );
}
