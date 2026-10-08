import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "AIRMECH ONE · Operations Management System", template: "%s · AIRMECH ONE" },
  description:
    "Engineering and service operations across building services, maintenance, MEP, controls and marine support.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
