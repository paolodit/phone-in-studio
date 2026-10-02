import type { Metadata } from "next";
import "./globals.css";
import { HostedRuntime } from "@/components/HostedRuntime";
import { hostedMode } from "@/lib/hosted-platform";

// One image serves both hosted and self-hosted deployments; resolve this at runtime.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Phone-In",
  description: "Human host / AI caller production studio",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><HostedRuntime enabled={hostedMode()}>{children}</HostedRuntime></body></html>;
}
