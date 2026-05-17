import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function FieldSection({ title, description, children }: Props) {
  const slug = title.replace(/\s+/g, "-").toLowerCase();
  return (
    <section className="border-b border-zinc-100 pb-8 last:border-b-0 last:pb-0" aria-labelledby={`sec-${slug}`}>
      <header className="mb-4">
        <h3 id={`sec-${slug}`} className="text-sm font-semibold tracking-tight text-zinc-900">
          {title}
        </h3>
        {description ? <p className="mt-1 text-xs text-zinc-500">{description}</p> : null}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
