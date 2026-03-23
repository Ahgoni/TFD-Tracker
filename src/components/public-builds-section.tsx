/** Read-only build cards for share & profile pages */

import { PublicBuildStatRollup } from "@/components/public-build-stats-client";
import type { PublicBuild, PublicPlacedModule } from "@/lib/public-build-types";

export type { PublicBuild, PublicPlacedModule };

export function PublicBuildsSection({ builds }: { builds: PublicBuild[] }) {
  const list = builds.filter((b) => b?.name);
  if (!builds?.length) {
    return (
      <section className="panel public-builds-empty" style={{ marginBottom: "1rem" }}>
        <h2>Builds</h2>
        <p className="muted">No saved builds in this snapshot.</p>
      </section>
    );
  }
  if (list.length === 0) {
    return (
      <section className="panel public-builds-empty" style={{ marginBottom: "1rem" }}>
        <h2>Builds ({builds.length})</h2>
        <p className="muted">Builds exist but need a name to appear here.</p>
      </section>
    );
  }

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
            {b.plannerSlots?.some(Boolean) ? (
              <>
                <ul className="build-planner-icons public-build-icons">
                  {b.plannerSlots.map(
                    (s, i) =>
                      s && (
                        <li key={`${s.moduleId}-${i}`} title={`${s.name} (Lv ${s.level})`}>
                          {s.image ? <img src={s.image} alt="" className="build-planner-ico" /> : <span className="build-planner-dot" />}
                        </li>
                      )
                  )}
                </ul>
                <PublicBuildStatRollup build={b} />
                <ul className="build-module-list">
                  {b.plannerSlots.map(
                    (s, i) =>
                      s ? (
                        <li key={`n-${s.moduleId}-${i}`}>
                          <span className="build-mod-label">{i + 1}</span>
                          {s.name}
                          <span className="muted" style={{ fontSize: "0.72rem", marginLeft: 4 }}>
                            L{s.level} · {s.capacity} cap
                          </span>
                        </li>
                      ) : null
                  )}
                </ul>
              </>
            ) : (
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
            )}
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
