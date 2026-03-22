/** Read-only build cards for share & profile pages */

export interface PublicBuild {
  id: string;
  name: string;
  targetType: string;
  displayName: string;
  imageUrl: string;
  moduleSlots: string[];
  reactorNotes: string;
  notes: string;
}

export function PublicBuildsSection({ builds }: { builds: PublicBuild[] }) {
  const list = builds.filter((b) => b?.name);
  if (list.length === 0) return null;

  return (
    <section className="panel" style={{ marginBottom: "1rem" }}>
      <h2>Builds ({list.length})</h2>
      <div className="builds-grid public-builds">
        {list.map((b) => (
          <article className="build-card" key={b.id} id={`build-${b.id}`}>
            <div className="build-card-head">
              {b.imageUrl ? (
                <img src={b.imageUrl} alt="" className="build-card-img" />
              ) : (
                <div className="build-card-img build-card-img-fallback" aria-hidden />
              )}
              <div>
                <h3 style={{ fontSize: "1rem", margin: 0 }}>{b.name}</h3>
                <p className="build-card-meta">
                  <span className={`build-type-tag ${b.targetType}`}>{b.targetType}</span>
                  {b.displayName}
                </p>
              </div>
            </div>
            <ul className="build-module-list">
              {(b.moduleSlots ?? []).map((line, i) =>
                line ? (
                  <li key={i}>
                    <span className="build-mod-label">{i + 1}</span>
                    {line}
                  </li>
                ) : null
              )}
            </ul>
            {b.reactorNotes && (
              <p className="build-extra">
                <strong>Reactor:</strong> {b.reactorNotes}
              </p>
            )}
            {b.notes && (
              <p className="build-extra">
                <strong>Notes:</strong> {b.notes}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
