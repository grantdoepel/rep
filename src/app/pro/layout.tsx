import type { Metadata } from "next";

export const metadata: Metadata = { title: "uvu pro", description: "Write a three-minute plan. See who did it.", appleWebApp: { capable: false } };

export default function ProLayout({ children }: { children: React.ReactNode }) {
  return children;
}
