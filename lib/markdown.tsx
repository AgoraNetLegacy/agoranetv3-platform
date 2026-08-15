// A deliberately tiny markdown renderer for the mechanism reference
// documents (dashboard spec §5.4; dense reference material, rendered
// readably; no external dependency, no HTML injection: everything is
// React text nodes).

import type { ReactNode } from "react";

function inline(text: string, keyBase: string): ReactNode[] {
  // **bold** and *italic*, nothing else.
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={`${keyBase}-b${i}`}>{token.slice(2, -2)}</strong>);
    } else {
      parts.push(<em key={`${keyBase}-i${i}`}>{token.slice(1, -1)}</em>);
    }
    last = m.index + token.length;
    i += 1;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function Markdown({ source }: { source: string }) {
  // Strip YAML frontmatter.
  let body = source;
  if (body.startsWith("---")) {
    const end = body.indexOf("\n---", 3);
    if (end !== -1) body = body.slice(end + 4);
  }

  const blocks: ReactNode[] = [];
  const lines = body.split("\n");
  let paragraph: string[] = [];
  let list: string[] = [];
  let orderedList: string[] = [];
  let tableRows: string[][] = [];
  let key = 0;

  const flushParagraph = () => {
    if (paragraph.length) {
      const text = paragraph.join(" ").trim();
      if (text) blocks.push(<p key={key++}>{inline(text, `p${key}`)}</p>);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push(
        <ul key={key++}>
          {list.map((item, i) => (
            <li key={i}>{inline(item, `l${key}-${i}`)}</li>
          ))}
        </ul>
      );
      list = [];
    }
  };
  const flushOrderedList = () => {
    if (orderedList.length) {
      blocks.push(
        <ol key={key++}>
          {orderedList.map((item, i) => (
            <li key={i}>{inline(item, `o${key}-${i}`)}</li>
          ))}
        </ol>
      );
      orderedList = [];
    }
  };
  const flushTable = () => {
    if (tableRows.length) {
      const [head, ...rest] = tableRows;
      blocks.push(
        <table key={key++} className="books">
          <thead>
            <tr>
              {head.map((cell, i) => (
                <th key={i}>{inline(cell, `th${key}-${i}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rest.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c}>{inline(cell, `td${key}-${r}-${c}`)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
      tableRows = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushOrderedList();
    flushTable();
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      const text = inline(heading[2], `h${key}`);
      if (level === 1) blocks.push(<h2 key={key++}>{text}</h2>);
      else if (level === 2) blocks.push(<h3 key={key++}>{text}</h3>);
      else blocks.push(<h4 key={key++}>{text}</h4>);
      continue;
    }
    // Pipe tables: header, |---| separator (skipped), then rows.
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushParagraph();
      flushList();
      flushOrderedList();
      if (!/^\s*\|(\s*:?-+:?\s*\|)+\s*$/.test(line)) {
        tableRows.push(
          line
            .replace(/^\s*\|/, "")
            .replace(/\|\s*$/, "")
            .split("|")
            .map((c) => c.trim())
        );
      }
      continue;
    }
    if (/^---+\s*$/.test(line)) {
      flushAll();
      continue;
    }
    const bullet = line.match(/^\s*-\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      flushOrderedList();
      flushTable();
      list.push(bullet[1]);
      continue;
    }
    // Numbered lists: "1. …" items; indented continuations fold in below.
    const numbered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (numbered) {
      flushParagraph();
      flushList();
      flushTable();
      orderedList.push(numbered[1]);
      continue;
    }
    if (line.trim() === "") {
      flushAll();
      continue;
    }
    if (list.length && /^\s{2,}/.test(raw)) {
      list[list.length - 1] += " " + line.trim();
      continue;
    }
    if (orderedList.length && /^\s{2,}/.test(raw)) {
      orderedList[orderedList.length - 1] += " " + line.trim();
      continue;
    }
    paragraph.push(line.trim());
  }
  flushAll();

  return <div className="reference-doc">{blocks}</div>;
}
