import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Phone-In",
  description: "Human host / AI caller production studio",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
