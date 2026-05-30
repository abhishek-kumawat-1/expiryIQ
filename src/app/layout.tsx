// import type { Metadata } from "next";
// import "./globals.css";

// export const metadata: Metadata = {
//   title: "ExpiryIQ",
//   description: "Local medicine expiry tracker POC"
// };

// export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
//   return (
//     <html lang="en">
//       <body>{children}</body>
//     </html>
//   );
// }


import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ExpiryIQ",
  description: "Local medicine expiry tracker POC",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`
          ${inter.className}
          bg-zinc-950
          text-zinc-100
          antialiased
          min-h-screen
        `}
      >
        <div className="min-h-screen bg-zinc-950">
          {children}
        </div>
      </body>
    </html>
  );
}
