import { it, expect } from "vitest";
import {
  makeDocument,
  cite,
  citationState,
  restoreWorkspace,
  exportNote,
} from "./documents";
import { SearchIndex, passages } from "./search";
it("preserves original line references across CRLF normalization", async () => {
  const d = await makeDocument(
    "Note",
    "Titre\r\n\r\nLa mobilité.\r\nSon budget.",
    "d",
  );
  expect(passages(d)[1]).toMatchObject({
    from: 3,
    to: 4,
    text: "La mobilité.\nSon budget.",
  });
  expect(cite(d, 3, 4).quote).toBe("La mobilité.\nSon budget.");
});
it("handles accents, all/any terms and literal phrase constraints", async () => {
  const d = await makeDocument(
    "Note",
    "La mobilité respecte le budget.\n\nLe budget augmente.",
    "d",
  );
  const s = new SearchIndex([d]);
  expect(s.search("mobilite budget")).toHaveLength(1);
  expect(s.search("mobilité budget", "any")).toHaveLength(2);
  expect(s.search('"respecte le budget"')).toHaveLength(1);
  expect(s.search('"budget respecte"')).toHaveLength(0);
});
it("ranks relevant short passages and filters documents", async () => {
  const a = await makeDocument("A", "budget budget mobilité", "a");
  const b = await makeDocument(
    "B",
    "budget et beaucoup de mots sans lien avec le sujet ni les transports",
    "b",
  );
  const s = new SearchIndex([a, b]);
  expect(s.search("budget")[0].documentId).toBe("a");
  expect(s.search("budget", "all", "b")).toHaveLength(1);
  expect(s.search("  !!!")).toEqual([]);
});
it("freezes quotations and flags modified or missing sources", async () => {
  const d = await makeDocument("Source", "Budget : 100", "d");
  const c = cite(d, 1, 1);
  const changed = await makeDocument("Source", "Budget : 200", "d");
  expect(citationState(c, [d])).toBe("valid");
  expect(citationState(c, [changed])).toBe("changed");
  expect(citationState(c, [])).toBe("missing");
  expect(c.quote).toBe("Budget : 100");
  expect(
    exportNote({ version: 1, documents: [changed], citations: [c] }),
  ).toContain("Source modifiée");
});
it("rejects invalid line ranges", async () => {
  const d = await makeDocument("a", "b");
  expect(() => cite(d, 0, 1)).toThrow();
  expect(() => cite(d, 1, 2)).toThrow();
});
it("recomputes hashes on restore and detects edited backup content", async () => {
  const d = await makeDocument("Note", "Original", "d");
  const c = cite(d, 1, 1);
  const restored = await restoreWorkspace(
    JSON.stringify({
      version: 1,
      documents: [{ ...d, text: "Modifié" }],
      citations: [c],
    }),
  );
  expect(citationState(c, restored.documents)).toBe("changed");
});
it("rejects duplicate document IDs and malformed imports", async () => {
  const d = await makeDocument("a", "b", "same");
  await expect(
    restoreWorkspace(
      JSON.stringify({ version: 1, documents: [d, d], citations: [] }),
    ),
  ).rejects.toThrow("dupliqué");
  await expect(restoreWorkspace('{"version":2}')).rejects.toThrow();
  await expect(makeDocument("a", "binary\u0000")).rejects.toThrow();
});
it("roundtrips workspace and readable footnotes", async () => {
  const d = await makeDocument("Titre [1]", "Texte\nSuite", "d");
  const w = { version: 1 as const, documents: [d], citations: [cite(d, 1, 2)] };
  const r = await restoreWorkspace(JSON.stringify(w));
  expect(citationState(r.citations[0], r.documents)).toBe("valid");
  expect(exportNote(r)).toContain("lignes 1–2");
});
