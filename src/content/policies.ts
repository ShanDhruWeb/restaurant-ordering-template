// Policy and About page text, written once and filled in from restaurant.config.ts
// through the identity module. Every builder is a pure function of an Identity, so
// tests can prove each config value is used and nothing is typed in here.
//
// The text describes what this system actually does (docs/COMPLIANCE.md lists each
// statement against the code). It is plain-language template text, not legal advice:
// the restaurant should have a lawyer or CA read it once (legal.policiesReviewed).
import type { Identity } from "@/lib/identity";

export interface PolicySection {
  heading: string;
  paragraphs: string[];
}

export interface Policy {
  slug: "terms" | "privacy" | "refunds" | "shipping" | "about";
  title: string;
  /** "Last updated: 23 October 2026". Absent on the About page. */
  lastUpdated?: string;
  sections: PolicySection[];
}

const lastUpdated = (id: Identity) => `Last updated: ${id.policiesEffectiveDateText}`;

/** Legal name first, with the brand and "we" defined; the trade name afterwards. */
function whoWeAre(id: Identity): string {
  return id.legalName === id.tradeName
    ? `${id.legalName} ("we", "us")`
    : `${id.legalName}, trading as ${id.tradeName} ("we", "us")`;
}

function contactParagraph(id: Identity): string {
  return `You can reach ${id.tradeName} at ${id.phone} or ${id.email}, or visit us at ${id.operatingAddressText}.`;
}

function grievanceParagraph(id: Identity): string {
  const g = id.grievance;
  return `If you have a complaint, write to or call our grievance contact, ${g.name}, at ${g.email} or ${g.phone}. We will reply as soon as we reasonably can.`;
}

export function buildTerms(id: Identity): Policy {
  const offers = id.ordering.types.map((t) =>
    t === "dine_in" ? "dine-in at your table" : "takeaway pickup",
  );
  return {
    slug: "terms",
    title: "Terms and Conditions",
    lastUpdated: lastUpdated(id),
    sections: [
      {
        heading: "Who operates this website",
        paragraphs: [
          `This website is operated by ${whoWeAre(id)}, ${id.entityTypeLabel}, with its registered address at ${id.registeredAddressText}. By placing an order you agree to these terms.`,
        ],
      },
      {
        heading: "The service",
        paragraphs: [
          `This website lets you order food from ${id.tradeName} for ${offers.join(" or ")} and pay for it online. Our Shipping and Delivery Policy explains how orders reach you.`,
        ],
      },
      {
        heading: "Who can order",
        paragraphs: [
          "You must be at least 18 years old and able to enter into a binding contract under Indian law to place an order. If you are younger, please ask a parent or guardian to order for you.",
        ],
      },
      {
        heading: "Menu, prices and taxes",
        paragraphs: [
          "We try to keep the menu, descriptions and photos accurate, but they can contain mistakes and dishes can change. Photos are for illustration.",
          `All prices are in Indian Rupees (INR). ${id.ordering.taxNote} The price you see at checkout is the price you pay.`,
        ],
      },
      {
        heading: "Orders and availability",
        paragraphs: [
          "Items can sell out. If an item is unavailable we may remove it from your order, refuse the order or cancel it. If you have already paid, we will refund you in full.",
          `An order that is not paid within ${id.ordering.orderExpiryMinutes} minutes is cancelled automatically.`,
          `${id.tradeName} may pause online ordering at any time, for example when the kitchen is very busy or closed.`,
        ],
      },
      {
        heading: "Payment",
        paragraphs: [
          "Payments are processed by Razorpay. You pay on Razorpay's secure payment window. We do not see or store your card number, UPI PIN or bank login.",
          "Charges, refunds and failed payments are also subject to the terms of Razorpay and your bank.",
        ],
      },
      {
        heading: "Order confirmation",
        paragraphs: [
          "Your order is confirmed only when your payment succeeds and the order page shows it as Paid. Keep the order page or your order number, because you may need it for any question about your order.",
        ],
      },
      {
        heading: "Acceptable use",
        paragraphs: [
          "Please use this website only to place genuine orders. Do not try to disrupt it, bypass its security, place false orders, or use automated tools to place orders.",
        ],
      },
      {
        heading: "Intellectual property",
        paragraphs: [
          `The name ${id.tradeName}, the logo, the menu text and the photos on this website belong to ${id.legalName} or its licensors. You may not copy or reuse them without our written permission.`,
        ],
      },
      {
        heading: "Allergens and dietary information",
        paragraphs: [
          "Our dishes may contain or come into contact with allergens such as nuts, dairy, gluten, soy and sesame. Menu descriptions and vegetarian marks are a guide and cannot guarantee that a dish is free of any ingredient.",
          "If you have an allergy or a dietary restriction, tell our staff before you order.",
        ],
      },
      {
        heading: "Limitation of liability",
        paragraphs: [
          `To the extent the law allows, ${id.tradeName} is not liable for indirect or consequential losses, or for delays or failures caused by events outside our reasonable control, such as power cuts or internet and payment-network outages. Our total liability for any order is limited to the amount you paid for that order.`,
          "Nothing in these terms limits any right you have as a consumer under Indian law, or any liability that the law does not allow us to exclude.",
        ],
      },
      {
        heading: "Changes to these terms",
        paragraphs: [
          `We may update these terms from time to time. The date at the top of this page shows when they last changed. The terms in force when you place an order apply to that order.`,
        ],
      },
      {
        heading: "Governing law",
        paragraphs: [
          `These terms are governed by the laws of India. The courts at ${id.jurisdictionCity} have jurisdiction over any dispute, without affecting any right you have to approach a consumer forum or court that the law gives you.`,
        ],
      },
      {
        heading: "Contact and grievances",
        paragraphs: [contactParagraph(id), grievanceParagraph(id)],
      },
    ],
  };
}

export function buildPrivacy(id: Identity): Policy {
  return {
    slug: "privacy",
    title: "Privacy Policy",
    lastUpdated: lastUpdated(id),
    sections: [
      {
        heading: "Who we are",
        paragraphs: [
          `This policy explains how ${whoWeAre(id)}, ${id.registeredAddressText}, handles your personal data when you use this website. We decide why and how your data is used for your orders.`,
        ],
      },
      {
        heading: "What we collect",
        paragraphs: [
          "When you place an order we collect your name, your mobile number (where we ask for it), your table number or takeaway choice, the items you order, any note you write for the kitchen, and the time you agreed to our policies.",
          "We also keep a record of the payment: the Razorpay payment reference, the amount, the status, and the type of payment method (for example UPI or card).",
          "Our servers receive basic technical data when you visit, such as your IP address and browser type.",
        ],
      },
      {
        heading: "What we do not collect",
        paragraphs: [
          "Your card number, UPI PIN and bank login are entered on Razorpay's payment window. They never reach our website or our database.",
        ],
      },
      {
        heading: "Why we use your data",
        paragraphs: [
          "We use your data to prepare and serve your order, to call out or contact you about it, to process payments and refunds, to keep accounts as the law requires, to resolve disputes, and to keep the website secure and prevent abuse.",
          "We do not sell your data and we do not use it for advertising.",
        ],
      },
      {
        heading: "Cookies and browser storage",
        paragraphs: [
          "Your cart and your name and mobile number are kept in your own browser's session storage while you order, so a page refresh does not lose them. They are cleared when you close the tab.",
          "This website does not use advertising or tracking cookies.",
        ],
      },
      {
        heading: "Who we share it with",
        paragraphs: [
          "We share payment details with Razorpay so it can process your payment. Our website and database are run by hosting and database service providers who store the data for us and may not use it for their own purposes.",
          "We may also share data when the law or a court requires it.",
        ],
      },
      {
        heading: "How long we keep it",
        paragraphs: [
          "We keep order and payment records for as long as we need them to run the service, handle refunds and disputes, and meet tax and accounting rules. You can ask us to delete or anonymise your data (see Your rights below), and we will do so unless the law requires us to keep it.",
        ],
      },
      {
        heading: "Security",
        paragraphs: [
          "We use encrypted connections (HTTPS), keep payment secrets away from the browser, limit staff access with logins, and take reasonable steps to protect data. No system is perfectly secure, so we cannot promise absolute security.",
        ],
      },
      {
        heading: "Your rights",
        paragraphs: [
          "Under India's Digital Personal Data Protection Act, 2023 you have rights over your personal data, including to ask what we hold about you, to have it corrected or deleted where the law allows, and to complain about how it is handled.",
          `To use these rights, contact our grievance contact, ${id.grievance.name}, at ${id.grievance.email} or ${id.grievance.phone}, and quote your order number where you can. We may need to confirm it is you before we act.`,
        ],
      },
      {
        heading: "Children",
        paragraphs: [
          "This website is meant for adults. We do not knowingly collect data about children under 18. If you think a child has given us data, contact us and we will delete it.",
        ],
      },
      {
        heading: "Changes to this policy",
        paragraphs: [
          "We may update this policy. The date at the top of this page shows when it last changed.",
        ],
      },
      {
        heading: "Contact",
        paragraphs: [contactParagraph(id), grievanceParagraph(id)],
      },
    ],
  };
}

export function buildRefunds(id: Identity): Policy {
  const p = id.policies;
  return {
    slug: "refunds",
    title: "Cancellation and Refund Policy",
    lastUpdated: lastUpdated(id),
    sections: [
      {
        heading: "About this policy",
        paragraphs: [
          `This policy applies to orders placed on this website with ${whoWeAre(id)}. Our food is made fresh to order, so cancellations are limited as described below.`,
        ],
      },
      {
        heading: "Cancelling an order",
        paragraphs: [
          `You can cancel an order only ${p.cancellationCutoff}.`,
          `There is no cancel button on this website. To cancel, call ${id.tradeName} on ${id.phone} straight away and quote your order number. Our staff will confirm whether the order can still be cancelled.`,
        ],
      },
      {
        heading: "When you get a refund",
        paragraphs: [
          "You will get a refund of the amount you paid in these cases:",
          `You cancelled ${p.cancellationCutoff}, and our staff confirmed the cancellation.`,
          "We could not fulfil your order, or an item you ordered was unavailable or wrong.",
          "You were charged more than once for the same order, or money was taken but your order was not confirmed.",
        ],
      },
      {
        heading: "When you do not get a refund",
        paragraphs: [
          "We cannot refund an order if you change your mind after preparation has started, or if you do not collect it. We do not give cash refunds.",
        ],
      },
      {
        heading: "How refunds are paid",
        paragraphs: [
          "Refunds go back to the payment method you used, through Razorpay. We do not refund in cash or to a different account.",
          `Once a refund has been issued, it should reach your account in ${p.refundTimelineText}. The order page shows that a refund is being arranged until the refund is processed.`,
        ],
      },
      {
        heading: "Money taken but no order",
        paragraphs: [
          "If money left your account but your order does not show as Paid, do not pay again. A payment that reaches us late, or twice, is flagged for our staff, who will either prepare the order or refund you.",
          `To check, call ${id.phone} or write to ${id.email} with the payment reference from your bank or Razorpay message and the time of payment.`,
        ],
      },
      {
        heading: "Contact",
        paragraphs: [contactParagraph(id), grievanceParagraph(id)],
      },
    ],
  };
}

export function buildShipping(id: Identity): Policy {
  const p = id.policies;
  const types = id.ordering.types;
  const service = [
    types.includes("dine_in") ? "dine-in, where we serve your order at your table" : null,
    types.includes("takeaway")
      ? `takeaway, where you collect your order from ${id.operatingAddressText}`
      : null,
  ].filter(Boolean);
  const sections: PolicySection[] = [
    {
      heading: "How you get your order",
      paragraphs: [
        `${whoWeAre(id)} offers ${service.join(", and ")}. Food is prepared at ${id.operatingAddressText}.`,
        "We do not ship orders by courier or post, and there are no shipping charges.",
      ],
    },
    {
      heading: "Preparation time",
      paragraphs: [
        `Most orders are ready in about ${p.preparationTimeMinutes} minutes after payment. It can take longer when the kitchen is busy.`,
        "The order page updates when your order is ready.",
      ],
    },
  ];
  if (types.includes("takeaway")) {
    sections.push({
      heading: "Uncollected orders",
      paragraphs: [
        p.collectionGraceMinutes
          ? `Please collect your takeaway order within ${p.collectionGraceMinutes} minutes of it being ready. Food kept longer may lose its quality.`
          : "Please collect your takeaway order as soon as it is ready, because food loses quality if it waits.",
        "Orders that are not collected are not refunded, as the food has already been made.",
      ],
    });
  }
  if (p.deliveryEnabled && p.delivery) {
    sections.push({
      heading: "Home delivery",
      paragraphs: [
        `We deliver within ${p.delivery.area}.`,
        `Delivery charge: ${p.delivery.chargeText}.`,
        `Delivery time: ${p.delivery.timeText}.`,
      ],
    });
  } else {
    sections.push({
      heading: "Home delivery",
      paragraphs: ["Home delivery is not offered through this website."],
    });
  }
  sections.push({
    heading: "Contact",
    paragraphs: [contactParagraph(id)],
  });
  return { slug: "shipping", title: "Shipping and Delivery Policy", lastUpdated: lastUpdated(id), sections };
}

export function buildAbout(id: Identity): Policy {
  const cuisines = id.cuisines.join(", ");
  const types = id.ordering.types;
  const way = [
    types.includes("dine_in") ? "at your table" : null,
    types.includes("takeaway") ? "for takeaway" : null,
  ]
    .filter(Boolean)
    .join(" or ");
  return {
    slug: "about",
    title: "About us",
    sections: [
      {
        heading: `About ${id.tradeName}`,
        paragraphs: [
          `${id.tradeName} is a restaurant at ${id.operatingAddressText}. ${id.description}`,
          `We cook ${cuisines} food, made fresh to order.`,
        ],
      },
      {
        heading: "How online ordering works",
        paragraphs: [
          `Open this website or scan the QR code on your table, choose your dishes, and pay securely with UPI or card through Razorpay. The kitchen starts on your order once the payment is confirmed, and you get your food ${way}.`,
          "This website sells food and drink for the restaurant only. Prices are in Indian Rupees (INR).",
        ],
      },
      {
        heading: "Who runs this website",
        paragraphs: [
          `This website is run by ${id.legalName}, ${id.entityTypeLabel}, registered at ${id.registeredAddressText}.`,
          [id.gstin ? `GSTIN: ${id.gstin}.` : null, id.fssai ? `FSSAI licence number: ${id.fssai}.` : null]
            .filter(Boolean)
            .join(" "),
        ].filter(Boolean),
      },
    ],
  };
}
