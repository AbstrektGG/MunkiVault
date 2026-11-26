"use client";

import { useRef, useState } from "react";
import { Bold, Code, Columns2, Heading2, Italic, Link2, List, ListChecks, Table } from "lucide-react";
import { Markdown } from "./Markdown";

type Mode = "write" | "split" | "preview";

export function MarkdownEditor({ name, defaultValue = "", rows = 14 }: { name: string; defaultValue?: string; rows?: number }) {
  const [value, setValue] = useState(defaultValue);
  const [mode, setMode] = useState<Mode>("write");
  const ref = useRef<HTMLTextAreaElement>(null);

  // Wraps the selection, or inserts a prefix at the start of each selected line.
  function apply(before: string, after = "", linePrefix = false) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = value.slice(s, e);
    let next: string, caretStart: number, caretEnd: number;
    if (linePrefix) {
      const lineStart = value.lastIndexOf("\n", s - 1) + 1;
      const block = value.slice(lineStart, e).split("\n").map((l) => before + l).join("\n");
      next = value.slice(0, lineStart) + block + value.slice(e);
      caretStart = lineStart; caretEnd = lineStart + block.length;
    } else {
      const inner = selected || "text";
      next = value.slice(0, s) + before + inner + after + value.slice(e);
      caretStart = s + before.length; caretEnd = caretStart + inner.length;
    }
    setValue(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(caretStart, caretEnd); });
  }

  const tools = [
    { label: "Bold", icon: Bold, run: () => apply("**", "**") },
    { label: "Italic", icon: Italic, run: () => apply("_", "_") },
    { label: "Heading", icon: Heading2, run: () => apply("## ", "", true) },
    { label: "Bulleted list", icon: List, run: () => apply("- ", "", true) },
    { label: "Checklist", icon: ListChecks, run: () => apply("- [ ] ", "", true) },
    { label: "Code", icon: Code, run: () => apply("`", "`") },
    { label: "Link", icon: Link2, run: () => apply("[", "](https://)") },
    { label: "Table", icon: Table, run: () => apply("\n| Column | Column |\n| --- | --- |\n| ", " |  |\n") },
  ];

  return (
    <div className="editor">
      <div className="editor-bar">
        {tools.map(({ label, icon: Icon, run }) => (
          <button key={label} type="button" className="btn btn-ghost btn-sm" title={label} aria-label={label} onClick={run} disabled={mode === "preview"}>
            <Icon size={15} />
          </button>
        ))}
        <span className="spacer" />
        {(["write", "split", "preview"] as const).map((m) => (
          <button key={m} type="button" className={`btn btn-sm ${mode === m ? "" : "btn-ghost"}`} aria-pressed={mode === m} onClick={() => setMode(m)}>
            {m === "split" ? <Columns2 size={14} /> : null}{m[0].toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>
      <div className={`editor-panes ${mode === "split" ? "split" : ""}`}>
        <textarea ref={ref} id={name} name={name} rows={rows} value={value} hidden={mode === "preview"}
          onChange={(e) => setValue(e.target.value)} spellCheck placeholder="Write in Markdown..." />
        {mode !== "write" ? <div className="preview"><Markdown source={value} /></div> : null}
      </div>
    </div>
  );
}
