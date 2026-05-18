interface Props {
  snippet: string | null;
}

export default function EvidencePanel({ snippet }: Props) {
  if (!snippet) {
    return <span className="text-stone-400 text-xs italic">No evidence captured</span>;
  }

  return (
    <blockquote className="border-l-2 border-rose-400 pl-3 text-xs text-stone-600 italic leading-relaxed max-w-sm">
      "{snippet}"
    </blockquote>
  );
}
