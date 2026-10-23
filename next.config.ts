import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Razorpay Checkout loads its script from checkout.razorpay.com, opens frames on
// api.razorpay.com / checkout.razorpay.com and talks to several *.razorpay.com hosts.
// Razorpay does not publish an exact list, so we allow *.razorpay.com.
// See docs/DECISIONS.md (CSP) and docs/TESTING.md (CSP check with test keys).
const razorpay = "https://checkout.razorpay.com https://api.razorpay.com https://*.razorpay.com";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval' " : ""}${razorpay}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${razorpay}`,
  "font-src 'self' data:",
  `connect-src 'self' ${razorpay}`,
  `frame-src ${razorpay}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self' ${razorpay}`,
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://*.razorpay.com")',
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Different Razorpay flows call the same pages by different names.
  async redirects() {
    return [
      { source: "/cancellation-and-refunds", destination: "/refunds", permanent: true },
      { source: "/refund-policy", destination: "/refunds", permanent: true },
      { source: "/delivery-policy", destination: "/shipping", permanent: true },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
