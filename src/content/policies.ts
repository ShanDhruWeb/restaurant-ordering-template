// Default policy text, filled in from restaurant.config.ts.
// TEMPLATE TEXT: every restaurant must read and adjust this before launch
// (the pages show a visible notice saying so). This is not legal advice.
import { config } from "@/config";
import { formatHHMM } from "@/lib/time";

export interface PolicySection {
  heading: string;
  paragraphs: string[];
}

export interface Policy {
  title: string;
  sections: PolicySection[];
}

const r = config.restaurant;
const legalName = config.legal.businessLegalName;
const contactLine = `${r.phone} or ${r.email}`;

export const terms: Policy = {
  title: "Terms of service",
  sections: [
    {
      heading: "Who we are",
      paragraphs: [
        `This website is operated by ${legalName} ("${r.name}", "we"), ${r.address.line1}, ${r.address.area}, ${r.address.city} ${r.address.pincode}. By placing an order you agree to these terms.`,
      ],
    },
    {
      heading: "Orders",
      paragraphs: [
        "An order is confirmed only after your payment succeeds and the order page shows it as Paid. Prices shown on the menu are the prices you pay. " +
          config.ordering.taxNote,
        `Unpaid orders are cancelled automatically after ${config.ordering.orderExpiryMinutes} minutes.`,
        "Dishes may contain allergens such as nuts, dairy, gluten and sesame. Please tell our staff about any allergy before ordering.",
      ],
    },
    {
      heading: "Payments",
      paragraphs: [
        "Payments are processed by Razorpay. We do not see or store your card details, UPI PIN or bank login.",
      ],
    },
    {
      heading: "Availability",
      paragraphs: [
        `Online ordering is available ${formatHHMM(r.hours.open)} to ${formatHHMM(r.hours.close)}, subject to the kitchen accepting orders. We may refuse or cancel an order, for example if an item runs out; you will then receive a full refund.`,
      ],
    },
    {
      heading: "Contact",
      paragraphs: [`Questions about an order? Contact us at ${contactLine}.`],
    },
  ],
};

export const privacy: Policy = {
  title: "Privacy policy",
  sections: [
    {
      heading: "What we collect",
      paragraphs: [
        "When you order we collect your name, mobile number (if given), table or takeaway choice, the items you order and any note to the kitchen.",
        "Razorpay processes your payment and gives us only a payment reference and status. We never receive your card number, UPI PIN or bank login.",
      ],
    },
    {
      heading: "Why we use it",
      paragraphs: [
        "Only to prepare your order, contact you about it, handle refunds, keep accounts as the law requires, and protect the site from abuse.",
        "We do not sell your data, we do not send marketing messages, and this site uses no advertising or tracking cookies.",
      ],
    },
    {
      heading: "Storage and sharing",
      paragraphs: [
        "Order data is stored with our hosting and database providers and shared with Razorpay for payments. It is kept as long as tax and accounting rules require.",
        "Your cart is stored only in your own browser for the current session.",
      ],
    },
    {
      heading: "Your choices",
      paragraphs: [
        `To ask what data we hold about you, or to have it corrected or deleted where the law allows, contact ${contactLine}.`,
      ],
    },
  ],
};

export const refunds: Policy = {
  title: "Refunds and cancellations",
  sections: [
    {
      heading: "Cancelling an order",
      paragraphs: [
        "Food is prepared fresh as soon as an order is paid, so please contact the staff immediately if you need to cancel. Once preparation has started we may not be able to cancel.",
      ],
    },
    {
      heading: "When we refund",
      paragraphs: [
        "You will receive a full refund if we cancel your order (for example, an item is unavailable), if you were charged twice, or if your payment reached us after the order had expired and we could not prepare it.",
        "If there is a problem with your food, please tell the staff before you leave so we can make it right.",
      ],
    },
    {
      heading: "How refunds work",
      paragraphs: [
        "Refunds go back to the original payment method through Razorpay. They usually reach your account within 5 to 7 working days, depending on your bank.",
        `For any refund question, contact ${contactLine} with your order number.`,
      ],
    },
  ],
};
