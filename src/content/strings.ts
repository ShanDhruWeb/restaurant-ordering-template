// Every piece of text shown to customers and staff lives here, so Hindi or Marathi
// can be added later by translating this one file. Restaurant-specific text
// (name, tagline, hours) comes from restaurant.config.ts instead.

export const strings = {
  testMode: {
    test: "TEST MODE: payments are simulated by Razorpay test mode. No real money is charged.",
    mock: "TEST MODE (mock gateway): payments are simulated locally. No real money is charged.",
  },
} as const;
