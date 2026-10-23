import type { Metadata, Viewport } from "next";
import type { CSSProperties, ReactNode } from "react";
import { theme } from "@/config";
import { getIdentity } from "@/lib/identity";
import { strings } from "@/content/strings";
import { isTestMode, razorpayModeOrNull } from "@/server/mode";
import { fontFamily } from "./fonts";
import "./globals.css";

const id = getIdentity();

export const metadata: Metadata = {
  metadataBase: new URL(id.siteUrl),
  title: {
    default: `${id.tradeName}: ${id.tagline}`,
    template: `%s | ${id.tradeName}`,
  },
  description: id.description,
  applicationName: id.shortName,
  openGraph: {
    type: "website",
    siteName: id.tradeName,
    title: id.tradeName,
    description: id.description,
    images: [{ url: id.ogImage, width: 1200, height: 630 }],
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: id.logo, apple: id.logo },
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
