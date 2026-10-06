import type { Metadata } from "next";
import { EditorShell } from "@/components/editor/editor-shell";

export const metadata: Metadata = {
  title: "Editor — edit text in images & PDFs",
  description:
    "Detect, erase and replace text inside images and PDF pages, match the original font and export PNG, JPEG, WebP or PDF. Runs fully in your browser.",
  alternates: { canonical: "/edit" },
  robots: { index: true, follow: true },
};

export default function EditPage() {
  return <EditorShell />;
}
