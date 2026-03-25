import Link from "next/link";
import { PublicBuildStatRollup } from "@/components/public-build-stats-client";
import type { PublicBuild } from "@/lib/public-build-types";

/** Single read-only build card (profile, share, spotlight page). */
export function PublicBuildCard({
  build,
  profileUsername,
}: {
  build: PublicBuild;
  profileUsername?: string;
}) {
  const b = build;
  return (
    <article className="build-card" id={`build-${b.id}`}>
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
                ),
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
                ) : null,
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
            ) : null,
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
      {profileUsername && b.id ? (
        <div className="build-card-full-link-wrap">
          <Link
            className="btn btn-primary btn-sm"
            href={`/u/${encodeURIComponent(profileUsername)}/b/${encodeURIComponent(b.id)}`}
            style={{ width: "100%", justifyContent: "center", marginTop: "0.5rem" }}
          >
            Full loadout view
          </Link>
        </div>
      ) : null}
    </article>
  );
}
