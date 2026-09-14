import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Srodae Zonal Council — Temporal Structures Register",
  description: "Fee register for temporal structures, Srodae Zonal Council",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Srodae Zonal Council — Temporal Structures Register",
    description: "Official register for temporal structure fees, Srodae Zonal Council",
    images: [{ url: "/og-preview.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Srodae Zonal Council — Temporal Structures Register",
    description: "Official register for temporal structure fees, Srodae Zonal Council",
    images: ["/og-preview.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}