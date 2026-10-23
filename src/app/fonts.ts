// next/font needs every font written out literally, so all fonts a restaurant may
// pick are declared here. Only the two chosen in the config are used on the page;
// preload is off so unused fonts are never downloaded.
import { DM_Sans, Fraunces, Inter, Lora, Manrope, Outfit, Playfair_Display, Poppins } from "next/font/google";
import type { FontName } from "@/config/fonts";

const fraunces = Fraunces({ subsets: ["latin"], display: "swap", preload: false });
const dmSans = DM_Sans({ subsets: ["latin"], display: "swap", preload: false });
const outfit = Outfit({ subsets: ["latin"], display: "swap", preload: false });
const inter = Inter({ subsets: ["latin"], display: "swap", preload: false });
const playfair = Playfair_Display({ subsets: ["latin"], display: "swap", preload: false });
const manrope = Manrope({ subsets: ["latin"], display: "swap", preload: false });
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});
const lora = Lora({ subsets: ["latin"], display: "swap", preload: false });

const FONTS: Record<FontName, { style: { fontFamily: string } }> = {
  Fraunces: fraunces,
  "DM Sans": dmSans,
  Outfit: outfit,
  Inter: inter,
  "Playfair Display": playfair,
  Manrope: manrope,
  Poppins: poppins,
  Lora: lora,
};

export function fontFamily(name: FontName): string {
  return FONTS[name].style.fontFamily;
}
