import type { Document } from "./documents";
export function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
export function tokenize(text: string) {
  return normalize(text).match(/[\p{L}\p{N}]+/gu) ?? [];
}
export type Passage = {
  documentId: string;
  title: string;
  from: number;
  to: number;
  text: string;
};
export type Match = Passage & { score: number };
export function passages(doc: Document): Passage[] {
  const lines = doc.text.split("\n");
  const chunks: Passage[] = [];
  let start = 0;
  const push = (end: number) => {
    if (end > start) {
      const text = lines.slice(start, end).join("\n");
      if (text.trim())
        chunks.push({
          documentId: doc.id,
          title: doc.title,
          from: start + 1,
          to: end,
          text,
        });
    }
  };
  for (let i = 0; i <= lines.length; i++) {
    if (i === lines.length || !lines[i].trim() || i - start === 6) {
      push(i);
      start = i === lines.length || !lines[i].trim() ? i + 1 : i;
    }
  }
  return chunks;
}
export class SearchIndex {
  entries: {
    passage: Passage;
    freq: Map<string, number>;
    length: number;
    normalized: string;
  }[] = [];
  df = new Map<string, number>();
  average = 1;
  constructor(documents: Document[]) {
    this.entries = documents.flatMap(passages).map((p) => {
      const tokens = tokenize(p.text);
      const freq = new Map<string, number>();
      tokens.forEach((t) => freq.set(t, (freq.get(t) ?? 0) + 1));
      for (const t of freq.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      return {
        passage: p,
        freq,
        length: tokens.length,
        normalized: normalize(p.text),
      };
    });
    this.average =
      this.entries.reduce((a, e) => a + e.length, 0) /
        Math.max(this.entries.length, 1) || 1;
  }
  search(
    query: string,
    mode: "all" | "any" = "all",
    documentId?: string,
  ): Match[] {
    const bounded = query.slice(0, 180);
    const phrases = Array.from(bounded.matchAll(/"([^"]+)"/g), (m) =>
      normalize(m[1]),
    );
    const terms = [...new Set(tokenize(bounded))].slice(0, 24);
    if (!terms.length) return [];
    return this.entries
      .filter((e) => !documentId || e.passage.documentId === documentId)
      .flatMap((e) => {
        const hits = terms.filter((t) => e.freq.has(t));
        if (
          !hits.length ||
          (mode === "all" && hits.length !== terms.length) ||
          phrases.some((p) => !e.normalized.includes(p))
        )
          return [];
        const score = hits.reduce((sum, t) => {
          const tf = e.freq.get(t)!;
          const idf = Math.log(
            1 +
              (this.entries.length - (this.df.get(t) ?? 0) + 0.5) /
                ((this.df.get(t) ?? 0) + 0.5),
          );
          return (
            sum +
            (idf * (tf * 2.2)) /
              (tf + 1.2 * (0.25 + (0.75 * e.length) / this.average))
          );
        }, 0);
        return [{ ...e.passage, score }];
      })
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.title.localeCompare(b.title) ||
          a.from - b.from,
      )
      .slice(0, 100);
  }
}
