import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ExpiryIQ",
  description: "Local medicine expiry tracker POC"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
