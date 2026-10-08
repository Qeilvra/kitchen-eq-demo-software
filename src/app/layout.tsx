import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "AIRMECH ONE · Built by Qeilvra", template: "%s · AIRMECH ONE" },
  description:
    "Connected HVAC and MEP operations, from the first enquiry to the final service report.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
