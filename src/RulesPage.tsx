import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rules from "./content/rules.md?raw";

type Section = { title: string; id: string; body: string };

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

function splitIntoSections(md: string): Section[] {
  // Expect: intro (optional, before first ##), then multiple ## sections
  const parts = md.split(/^##\s+/gm);

  const sections: Section[] = [];

  for (let i = 0; i < parts.length; i++) {
    const chunk = parts[i].trim();
    if (!chunk) continue;

    // First line is the title, rest is body
    const [rawTitle, ...rest] = chunk.split("\n");
    const title = rawTitle.trim();
    const body = rest.join("\n").trim();

    sections.push({
      title,
      id: slugify(title),
      body,
    });
  }

  return sections;
}

export function RulesPage() {
  const sections = useMemo(() => splitIntoSections(rules), []);

  return (
    <div className="rules-layout">
      {/* Sidebar
      <aside className="rules-sidebar">
        <h3>Inhalt</h3>
        <ul>
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.title}</a>
            </li>
          ))}
        </ul>
      </aside>
      */}

      {/* Cards */}
      <div className="rules-cards">
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="rules-card">
            <h2 className="rules-card-title">{s.title}</h2>

            <div className="rules-card-body markdown-body">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
              >
                {s.body}
              </ReactMarkdown>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
