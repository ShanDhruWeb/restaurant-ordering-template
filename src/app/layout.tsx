import type { Metadata, Viewport } from "next";
import type { CSSProperties, ReactNode } from "react";
import { config, theme } from "@/config";
import { strings } from "@/content/strings";
import { isTestMode, razorpayModeOrNull } from "@/server/mode";
import { fontFamily } from "./fonts";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${config.restaurant.name}: ${config.restaurant.tagline}`,
    template: `%s | ${config.restaurant.name}`,
  },
  description: config.restaurant.description,
  applicationName: config.restaurant.shortName,
  openGraph: {
    type: "website",
    siteName: config.restaurant.name,
    title: config.restaurant.name,
    description: config.restaurant.description,
    images: [{ url: config.restaurant.ogImage, width: 1200, height: 630 }],
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: config.restaurant.logo, apple: config.restaurant.logo },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: theme.colours.background,
  colorScheme: theme.colorScheme,
};

// Design tokens as CSS variables. globals.css maps them to Tailwind utilities.
const tokens = {
  "--t-bg": theme.colours.background,
  "--t-surface": theme.colours.surface,
  "--t-text": theme.colours.text,
  "--t-muted": theme.colours.muted,
  "--t-primary": theme.colours.primary,
  "--t-primary-text": theme.colours.primaryText,
  "--t-accent": theme.colours.accent,
  "--t-success": theme.colours.success,
  "--t-danger": theme.colours.danger,
  "--t-radius": theme.radius,
  "--t-font-heading": fontFamily(theme.fonts.heading),
  "--t-font-body": fontFamily(theme.fonts.body),
} as CSSProperties;

export default function RootLayout({ children }: { children: ReactNode }) {
  const mode = razorpayModeOrNull();
  return (
    <html lang="en-IN" style={tokens}>
      <body className="antialiased">
        {isTestMode() && (
          <div
            role="status"
            className="no-print bg-ink px-4 py-1.5 text-center text-sm font-semibold text-bg"
          >
            {mode === "mock" ? strings.testMode.mock : strings.testMode.test}
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
