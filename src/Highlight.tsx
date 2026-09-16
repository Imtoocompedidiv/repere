import { normalize, tokenize } from "./core/search";
export function Highlight({ text, query }: { text: string; query: string }) {
  const terms = new Set(tokenize(query));
  return (
    <>
      {text
        .split(/([\p{L}\p{N}\p{M}]+)/gu)
        .map((part, i) =>
          terms.has(normalize(part)) ? <mark key={i}>{part}</mark> : part,
        )}
    </>
  );
}
