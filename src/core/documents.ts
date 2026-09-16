export type Document = {
  id: string;
  title: string;
  text: string;
  hash: string;
  updatedAt: string;
};
export type Citation = {
  id: string;
  documentId: string;
  title: string;
  hash: string;
  from: number;
  to: number;
  quote: string;
};
export type Workspace = {
  version: 1;
  documents: Document[];
  citations: Citation[];
};
export async function digest(text: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function makeDocument(
  title: string,
  text: string,
  id: string = crypto.randomUUID(),
): Promise<Document> {
  const normalized = text.replace(/\r\n?/g, "\n");
  if (!title.trim() || title.length > 200)
    throw new Error("Titre requis, 200 caractères maximum.");
  if (!normalized.trim()) throw new Error("Le document est vide.");
  if (normalized.includes("\u0000"))
    throw new Error("Importez un fichier texte UTF-8, pas un fichier binaire.");
  if (new TextEncoder().encode(normalized).length > 500000)
    throw new Error("Chaque document doit faire moins de 500 Ko.");
  return {
    id,
    title: title.trim(),
    text: normalized,
    hash: await digest(normalized),
    updatedAt: new Date().toISOString(),
  };
}
export function cite(doc: Document, from: number, to: number): Citation {
  const lines = doc.text.split("\n");
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 1 ||
    to < from ||
    to > lines.length
  )
    throw new Error("Intervalle de lignes invalide.");
  return {
    id: `${doc.id}:${doc.hash}:${from}:${to}`,
    documentId: doc.id,
    title: doc.title,
    hash: doc.hash,
    from,
    to,
    quote: lines.slice(from - 1, to).join("\n"),
  };
}
export function citationState(
  citation: Citation,
  documents: Document[],
): "valid" | "changed" | "missing" {
  const doc = documents.find((d) => d.id === citation.documentId);
  if (!doc) return "missing";
  return doc.hash === citation.hash &&
    doc.text
      .split("\n")
      .slice(citation.from - 1, citation.to)
      .join("\n") === citation.quote
    ? "valid"
    : "changed";
}
function plain(s: string) {
  return s.replace(/[\r\n]/g, " ").replace(/[\\`*_[\]<>#]/g, "\\$&");
}
export function exportNote(workspace: Workspace): string {
  return (
    "# Note documentaire\n\n" +
    workspace.citations
      .map((c, i) => {
        const state = citationState(c, workspace.documents);
        return (
          c.quote
            .split("\n")
            .map((l) => "> " + l)
            .join("\n") +
          `\n\n[^${i + 1}] ${state === "valid" ? "" : "**Source modifiée ou absente : citation conservée à vérifier.**"}\n`
        );
      })
      .join("\n") +
    "\n" +
    workspace.citations
      .map(
        (c, i) =>
          `[^${i + 1}]: ${plain(c.title)}, lignes ${c.from}–${c.to}. Empreinte SHA-256 : ${c.hash}.`,
      )
      .join("\n") +
    "\n"
  );
}
export async function restoreWorkspace(raw: string): Promise<Workspace> {
  if (new TextEncoder().encode(raw).length > 4000000)
    throw new Error("Sauvegarde trop volumineuse (4 Mo maximum).");
  const w: unknown = JSON.parse(raw);
  if (!w || typeof w !== "object") throw new Error("Sauvegarde invalide.");
  const p = w as Workspace;
  if (
    p.version !== 1 ||
    !Array.isArray(p.documents) ||
    !Array.isArray(p.citations) ||
    p.documents.length > 40 ||
    p.citations.length > 200
  )
    throw new Error("Format de sauvegarde non pris en charge.");
  const documents: Document[] = [];
  for (const d of p.documents) {
    if (
      !d ||
      typeof d.id !== "string" ||
      d.id.length > 100 ||
      typeof d.text !== "string" ||
      typeof d.title !== "string"
    )
      throw new Error("Document invalide.");
    if (documents.some((x) => x.id === d.id))
      throw new Error("Identifiant de document dupliqué.");
    // Recompute digests; never trust a supplied hash to validate citations.
    documents.push(await makeDocument(d.title, d.text, d.id));
  }
  const citations: Citation[] = [];
  for (const c of p.citations) {
    if (
      !c ||
      typeof c.documentId !== "string" ||
      typeof c.title !== "string" ||
      c.title.length > 200 ||
      typeof c.hash !== "string" ||
      !/^[a-f\d]{64}$/.test(c.hash) ||
      typeof c.quote !== "string" ||
      c.quote.length > 500000 ||
      !Number.isInteger(c.from) ||
      !Number.isInteger(c.to) ||
      c.from < 1 ||
      c.to < c.from
    )
      throw new Error("Citation invalide.");
    const id = `${c.documentId}:${c.hash}:${c.from}:${c.to}`;
    if (!citations.some((x) => x.id === id)) citations.push({ ...c, id });
  }
  return { version: 1, documents, citations };
}
