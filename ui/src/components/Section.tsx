import { type ReactNode } from 'react';

interface SectionProps {
  title: string;
  description?: string;
  headerAction?: ReactNode;
  children: ReactNode;
}

export function Section({ title, description, headerAction, children }: SectionProps) {
  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">{title}</h2>
          {description ? <p className="panel-description">{description}</p> : null}
        </div>
        {headerAction}
      </header>
      <div className="panel-grid">{children}</div>
    </section>
  );
}
