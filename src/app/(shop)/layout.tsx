import type { ReactNode } from "react";
import { Footer } from "@/components/Footer";
import { CartProvider } from "@/lib/client/cart";

export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      {children}
      <Footer />
    </CartProvider>
  );
}
