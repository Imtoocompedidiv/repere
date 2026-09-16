import { citationState, type Workspace, type Citation } from "./core/documents";
export function NotePanel({
  workspace,
  onRemove,
  onExport,
  onOpen,
}: {
  workspace: Workspace;
  onRemove: (id: string) => void;
  onExport: () => void;
  onOpen: (citation: Citation) => void;
}) {
  return (
    <aside className="notes">
      <h2>
        Ma note <span>({workspace.citations.length})</span>
      </h2>
      {!workspace.citations.length && (
        <div className="note-empty">
          <p>Rassemblez les passages qui éclairent votre sujet.</p>
          <small>
            Chaque citation garde sa source, ses lignes et l’empreinte du
            document.
          </small>
        </div>
      )}
      <div className="note-list">
        {workspace.citations.map((c, i) => (
          <article key={c.id}>
            <blockquote>{c.quote}</blockquote>
            <button className="source" onClick={() => onOpen(c)}>
              {i + 1}. {c.title} · Lignes {c.from}–{c.to}
            </button>
            {citationState(c, workspace.documents) !== "valid" && (
              <p className="warning">
                Source{" "}
                {citationState(c, workspace.documents) === "missing"
                  ? "absente"
                  : "modifiée"}{" "}
                : vérifiez cette citation.
              </p>
            )}
            <button
              className="remove"
              onClick={() => onRemove(c.id)}
              aria-label={`Retirer la citation ${i + 1}`}
            >
              Retirer
            </button>
          </article>
        ))}
      </div>
      <button
        className="primary export-note"
        disabled={!workspace.citations.length}
        onClick={onExport}
      >
        Exporter en Markdown
      </button>
    </aside>
  );
}
