import type { ReactNode } from "react";

function ModulePanel({
  children,
  description,
  eyebrow,
  title
}: {
  children: ReactNode;
  description?: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <section className="ModulePanel">
      <header className="ModulePanel-header">
        {eyebrow ? <p className="ModulePanel-eyebrow">{eyebrow}</p> : null}
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </header>
      <div className="ModulePanel-body">{children}</div>
    </section>
  );
}

export { ModulePanel };
