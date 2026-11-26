"use client";

import { useEffect, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

// Markdown is sanitised in the browser before it is inserted; nothing is rendered until then.
export function Markdown({ source }: { source: string }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    const raw = marked.parse(source, { async: false, gfm: true, breaks: true }) as string;
    setHtml(DOMPurify.sanitize(raw, { USE_PROFILES: { html: true }, FORBID_TAGS: ["style", "form", "input", "button"] }));
  }, [source]);
  if (html === null) return <div className="md muted">Loading...</div>;
  if (!html.trim()) return <div className="md muted">Nothing to preview yet.</div>;
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />;
}
