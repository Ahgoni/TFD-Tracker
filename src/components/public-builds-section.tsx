/** Read-only build cards for share & profile pages */

import { PublicBuildCard } from "@/components/public-build-card";
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
          <PublicBuildCard key={b.id} build={b} />
        ))}
      </div>
    </section>
  );
}
