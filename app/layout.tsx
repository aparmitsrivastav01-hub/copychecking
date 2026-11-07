import type { Metadata } from "next";
import { AppProvider } from "@/components/app-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "PaperCheck AI — Practice like it counts",
  description: "CBSE Class 12 answer sheet evaluation, built around the way you actually write exams.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AppProvider>{children}</AppProvider></body></html>;
}
