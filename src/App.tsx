import { useEffect, useMemo, useRef, useState } from "react";
import {
  makeDocument,
  cite,
  exportNote,
  restoreWorkspace,
  type Workspace,
  type Citation,
  type Document,
} from "./core/documents";
import { SearchIndex, type Match } from "./core/search";
import { exampleWorkspace } from "./sample";
import { readWorkspace, saveWorkspace } from "./storage";
import { Highlight } from "./Highlight";
import { NotePanel } from "./NotePanel";
import { DocumentViewer } from "./DocumentViewer";
import { download } from "./download";
export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>({
      version: 1,
      documents: [],
      citations: [],
    }),
    [ready, setReady] = useState(false),
    [query, setQuery] = useState("mobilité budget"),
    [mode, setMode] = useState<"all" | "any">("all"),
    [filter, setFilter] = useState(""),
    [selection, setSelection] = useState<{
      documentId: string;
      from: number;
      to: number;
    } | null>(null),
    [message, setMessage] = useState("Ouverture de votre espace…"),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  const importInput = useRef<HTMLInputElement>(null),
    restoreInput = useRef<HTMLInputElement>(null),
    saveChain = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await readWorkspace();
        const data = stored
          ? await restoreWorkspace(JSON.stringify(stored))
          : await exampleWorkspace();
        if (active) {
          setWorkspace(data);
          setMessage(
            stored
              ? "Dossier local restauré."
              : "Trois exemples fictifs sont disponibles. Importez vos propres textes pour commencer.",
          );
        }
      } catch {
        if (active) {
          setWorkspace(await exampleWorkspace());
          setMessage(
            "Stockage local indisponible ou illisible. Sauvegardez votre travail en JSON.",
          );
        }
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    setSaved(false);
    saveChain.current = saveChain.current
      .catch(() => {})
      .then(() => saveWorkspace(workspace))
      .then(() => setSaved(true))
      .catch(() => {
        setMessage(
          "Le navigateur ne peut pas conserver ce dossier. Utilisez Sauvegarder le dossier.",
        );
      });
  }, [workspace, ready]);
  const [removed, setRemoved] = useState<Document | null>(null);
  const index = useMemo(
    () => new SearchIndex(workspace.documents),
    [workspace.documents],
  );
  const matches = useMemo(
    () => index.search(query, mode, filter || undefined),
    [index, query, mode, filter],
  );
  const active =
    workspace.documents.find((d) => d.id === selection?.documentId) ??
    workspace.documents.find((d) => d.id === filter) ??
    workspace.documents[0];
  async function importFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      if (workspace.documents.length + files.length > 40)
        throw new Error("Maximum : 40 documents.");
      const next: Document[] = [];
      for (const f of Array.from(files)) {
        if (f.size > 500000) throw new Error(`${f.name} dépasse 500 Ko.`);
        next.push(
          await makeDocument(
            f.name.replace(/\.(txt|md)$/i, ""),
            await f.text(),
          ),
        );
      }
      if (JSON.stringify([...workspace.documents, ...next]).length > 2000000)
        throw new Error("Le dossier dépasse 2 millions de caractères.");
      setWorkspace((w) => ({ ...w, documents: [...w.documents, ...next] }));
      setMessage(`${next.length} document(s) importé(s) et indexé(s).`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Import impossible.");
    } finally {
      setBusy(false);
    }
  }
  function addCitation(m: Match) {
    const doc = workspace.documents.find((d) => d.id === m.documentId)!;
    const c = cite(doc, m.from, m.to);
    if (workspace.citations.some((x) => x.id === c.id)) {
      setMessage("Ce passage figure déjà dans votre note.");
      return;
    }
    if (workspace.citations.length >= 200) {
      setMessage("Maximum : 200 citations.");
      return;
    }
    setWorkspace((w) => ({ ...w, citations: [...w.citations, c] }));
    setSelection(m);
    setMessage("Citation ajoutée avec sa référence exacte.");
  }
  function openCitation(c: Citation) {
    if (workspace.documents.some((d) => d.id === c.documentId)) {
      setSelection({ documentId: c.documentId, from: c.from, to: c.to });
      setMessage(`Source ouverte : ${c.title}.`);
    } else
      setMessage(
        "La source ne figure plus dans ce dossier. La citation originale reste conservée.",
      );
  }
  async function restore(files: FileList | null) {
    if (!files?.[0]) return;
    setBusy(true);
    try {
      if (files[0].size > 4000000)
        throw new Error("Sauvegarde trop volumineuse.");
      const restored = await restoreWorkspace(await files[0].text());
      download(
        "repere-avant-restauration.json",
        JSON.stringify(workspace, null, 2),
        "application/json",
      );
      setWorkspace(restored);
      setFilter("");
      setSelection(null);
      setMessage(
        "Dossier restauré. Une sauvegarde de l’état précédent a été téléchargée.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Sauvegarde invalide.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <a className="skip" href="#search">
        Aller à la recherche
      </a>
      <header>
        <a className="brand" href="./">
          repère
        </a>
        <span>Les sources au premier plan.</span>
        <nav>
          <button
            onClick={() => importInput.current?.click()}
            disabled={!ready || busy}
          >
            Importer des textes
          </button>
          <a href="https://github.com/Imtoocompedidiv/repere">Code source</a>
        </nav>
        <input
          type="file"
          ref={importInput}
          hidden
          multiple
          accept=".txt,.md,text/plain,text/markdown"
          onChange={(e) => {
            void importFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          type="file"
          ref={restoreInput}
          hidden
          accept=".json,application/json"
          onChange={(e) => {
            void restore(e.target.files);
            e.target.value = "";
          }}
        />
      </header>
      <main>
        <section className="search-section">
          <h1>Retrouver. Relier. Étayer.</h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setMessage(`${matches.length} passages trouvés.`);
            }}
          >
            <input
              id="search"
              aria-label="Rechercher dans vos documents"
              placeholder="Rechercher dans vos documents…"
              value={query}
              maxLength={180}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="primary">Rechercher</button>
          </form>
          <p className="search-hint">
            Accents ignorés · Guillemets pour une expression exacte · Fichiers
            .txt et .md
          </p>
        </section>
        <div className="research">
          <aside className="library">
            <h2>
              Bibliothèque <span>({workspace.documents.length})</span>
            </h2>
            <button
              className={!filter ? "selected all-docs" : "all-docs"}
              onClick={() => setFilter("")}
            >
              Tous les documents
            </button>
            {workspace.documents.map((d) => (
              <button
                className={`doc-link ${filter === d.id ? "selected" : ""}`}
                key={d.id}
                onClick={() => {
                  setFilter(d.id);
                  setSelection({ documentId: d.id, from: 1, to: 1 });
                }}
              >
                <span>{d.title}</span>
                <small>{d.text.split("\n").length} lignes</small>
              </button>
            ))}
          </aside>
          <section className="results">
            <div className="results-head">
              <h2>
                Résultats <span>({matches.length})</span>
              </h2>
              <select
                aria-label="Mode de recherche"
                value={mode}
                onChange={(e) => setMode(e.target.value as "all" | "any")}
              >
                <option value="all">Tous les mots</option>
                <option value="any">Au moins un mot</option>
              </select>
            </div>
            {!matches.length && (
              <div className="empty">
                <h3>
                  {query.trim()
                    ? "Aucun passage trouvé."
                    : "Quel sujet recherchez-vous ?"}
                </h3>
                <p>
                  Essayez un terme plus court, choisissez « Au moins un mot » ou
                  élargissez à tous les documents.
                </p>
              </div>
            )}
            {matches.map((m) => (
              <article className="result" key={`${m.documentId}:${m.from}`}>
                <button
                  className="result-source"
                  onClick={() => setSelection(m)}
                >
                  <strong>{m.title}</strong>
                  <span>
                    Lignes {m.from}–{m.to}
                  </span>
                </button>
                <blockquote>
                  <Highlight text={m.text} query={query} />
                </blockquote>
                <button className="add" onClick={() => addCitation(m)}>
                  {workspace.citations.some(
                    (c) =>
                      c.id ===
                      `${m.documentId}:${workspace.documents.find((d) => d.id === m.documentId)!.hash}:${m.from}:${m.to}`,
                  )
                    ? "Dans la note"
                    : "Ajouter à la note"}
                </button>
              </article>
            ))}
          </section>
          <NotePanel
            workspace={workspace}
            onRemove={(id) => {
              setWorkspace((w) => ({
                ...w,
                citations: w.citations.filter((c) => c.id !== id),
              }));
              setMessage("Citation retirée de la note.");
            }}
            onExport={() => {
              download(
                "repere-note.md",
                exportNote(workspace),
                "text/markdown;charset=utf-8",
              );
              setMessage(
                "Note exportée avec les références et empreintes de ses sources.",
              );
            }}
            onOpen={openCitation}
          />
        </div>
        {active && (
          <DocumentViewer
            onRemove={() => {
              setRemoved(active);
              setWorkspace((w) => ({
                ...w,
                documents: w.documents.filter((d) => d.id !== active.id),
              }));
              setFilter("");
              setSelection(null);
              setMessage(
                "Document retiré du dossier. Le fichier original reste intact.",
              );
            }}
            doc={active}
            query={query}
            selected={
              selection?.documentId === active.id ? selection : undefined
            }
            onSave={async (text) => {
              const revised = await makeDocument(active.title, text, active.id);
              setWorkspace((w) => ({
                ...w,
                documents: w.documents.map((d) =>
                  d.id === active.id ? revised : d,
                ),
              }));
              setMessage(
                "Nouvelle version enregistrée. Les citations antérieures ont été revérifiées.",
              );
            }}
          />
        )}
        <p className="status" role="status">
          {message}{" "}
          {removed && (
            <button
              onClick={() => {
                setWorkspace((w) => ({
                  ...w,
                  documents: [...w.documents, removed],
                }));
                setRemoved(null);
                setMessage("Document restauré.");
              }}
            >
              Annuler le retrait
            </button>
          )}
        </p>
      </main>
      <footer>
        <span>
          {saved ? "Enregistré dans ce navigateur" : "Stockage local"} ·{" "}
          {workspace.documents.every((d) => d.id.startsWith("ex-"))
            ? "Exemples fictifs"
            : "Documents personnels"}{" "}
          · Aucun envoi de vos documents
        </span>
        <div>
          <button
            disabled={!ready || busy}
            onClick={() => {
              download(
                "repere-dossier.json",
                JSON.stringify(workspace, null, 2),
                "application/json",
              );
              setMessage(
                "Dossier exporté. Conservez ce fichier pour le restaurer ailleurs.",
              );
            }}
          >
            Sauvegarder le dossier
          </button>
          <button
            disabled={!ready || busy}
            onClick={() => restoreInput.current?.click()}
          >
            Restaurer
          </button>
        </div>
      </footer>
    </>
  );
}
