import { useEffect, useState } from "react";
import type { Document } from "./core/documents";
import { Highlight } from "./Highlight";
export function DocumentViewer({
  doc,
  query,
  selected,
  onSave,
  onRemove,
}: {
  doc: Document;
  query: string;
  selected?: { from: number; to: number };
  onSave: (text: string) => Promise<void>;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false),
    [draft, setDraft] = useState(doc.text),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setEditing(false);
    setDraft(doc.text);
    setError("");
  }, [doc.id, doc.hash]);
  return (
    <section className="viewer" aria-label="Document source">
      <div className="viewer-head">
        <h2>{doc.title}</h2>
        <span>{doc.text.split("\n").length} lignes</span>
        <button
          onClick={() => {
            setDraft(doc.text);
            setEditing(!editing);
          }}
        >
          {editing ? "Annuler" : "Modifier le texte"}
        </button>
        <button onClick={onRemove}>Retirer du dossier</button>
      </div>
      {editing ? (
        <div className="editor">
          <label htmlFor="document-text">Texte du document</label>
          <textarea
            id="document-text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={12}
          />
          <p>
            Les citations existantes resteront figées et seront signalées si la
            source change.
          </p>
          <button
            className="primary"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(draft);
                setEditing(false);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Enregistrement impossible.",
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            Enregistrer la version
          </button>
          <p role="alert" className="warning">
            {error}
          </p>
        </div>
      ) : (
        <div className="document-lines" tabIndex={0}>
          {doc.text.split("\n").map((line, i) => (
            <div
              className={
                selected && i + 1 >= selected.from && i + 1 <= selected.to
                  ? "chosen"
                  : ""
              }
              key={i}
            >
              <span className="line-number">{i + 1}</span>
              <p>
                <Highlight text={line || " "} query={query} />
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
