import Link from "next/link";
import { PublicBuildsSection } from "@/components/public-builds-section";
import type { PublicBuild } from "@/lib/public-build-types";

interface SharedState {
  tabs?: string[];
  reactors?: Array<{ id: string; name: string; element: string; skillType: string; level: number; enhancement: string; descendant?: string }>;
  weapons?: Array<{ slug: string; name: string; rarity: string; roundsType: string; acquired: boolean; level: number; enhancement: number }>;
  descendants?: Array<{ id: string; name: string; element: string; level: number; archeLevel: number; catalysts: number }>;
  goals?: Array<{ id: string; text: string; completed: boolean; active: boolean }>;
  builds?: PublicBuild[];
}

interface Owner {
  name: string | null;
  image: string | null;
}

async function getProfileData(userId: string): Promise<{ owner: Owner; state: SharedState } | null> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/share/user/${userId}`, { cache: "no-store" });
    if (!res.ok) {
      if (res.status === 403) {
        return { owner: { name: null, image: null }, state: {} };
      }
      return null;
    }
    return res.json();
  } catch {
    return null;
  }
}

export default async function UserProfileSharePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const data = await getProfileData(userId);

  if (!data) {
    return (
      <div className="app">
        <header className="topbar">
          <div className="brand"><h1>TFD Tracker</h1></div>
        </header>
        <section className="panel">
          <h2>Profile not found</h2>
          <p className="muted">This profile link is invalid or the user no longer exists.</p>
          <div className="actions">
            <Link className="btn btn-primary" href="/">Go home</Link>
          </div>
        </section>
      </div>
    );
  }

  // Privacy blocked
  if (Object.keys(data.state).length === 0 && !data.owner.name) {
    return (
      <div className="app">
        <header className="topbar">
          <div className="brand"><h1>TFD Tracker</h1></div>
        </header>
        <section className="panel">
          <h2>Inventory is Private</h2>
          <p className="muted">This user has set their inventory to &quot;Link Only&quot;. Ask them for a share link.</p>
          <div className="actions">
            <Link className="btn btn-primary" href="/">Go home</Link>
          </div>
        </section>
      </div>
    );
  }

  const { owner, state } = data;
  const ownedWeapons = (state.weapons ?? []).filter((w) => w.acquired);
  const activeGoals = (state.goals ?? []).filter((g) => g.active && !g.completed);
  const maxedReactors = (state.reactors ?? []).filter((r) => r.enhancement === "5" || r.enhancement === "Max");

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-row">
          <div className="brand">
            <h1>TFD Tracker — Friend&apos;s Inventory</h1>
            <p>Read-only view · {owner.name ?? "a player"}&apos;s inventory</p>
          </div>
          {owner.image && (
            <span className="user-chip">
              <img src={owner.image} alt="" />
              {owner.name ?? "Player"}
            </span>
          )}
        </div>
        <div style={{ paddingTop: "0.3rem" }}>
          <Link className="filter-chip" href="/api/auth/signin">Sign in to track your own inventory</Link>
        </div>
      </header>

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom: "1rem" }}>
        {[
          { label: "Total Reactors", value: (state.reactors ?? []).length },
          { label: "Owned Weapons", value: ownedWeapons.length },
          { label: "Named Builds", value: (state.builds ?? []).filter((b) => b?.name).length },
          { label: "Max Enhancement Reactors", value: maxedReactors.length },
          { label: "Active Farming Goals", value: activeGoals.length },
        ].map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="label">{s.label}</div>
            <div className="value">{s.value}</div>
          </div>
        ))}
      </div>

      <PublicBuildsSection builds={(state.builds ?? []) as PublicBuild[]} />

      {/* Descendants */}
      {(state.descendants ?? []).length > 0 && (
        <section className="panel" style={{ marginBottom: "1rem" }}>
          <h2>Descendants ({state.descendants!.length})</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Element</th><th>Level</th><th>Arche</th><th>Catalysts</th></tr></thead>
              <tbody>
                {state.descendants!.map((d) => (
                  <tr key={d.id}><td>{d.name}</td><td>{d.element}</td><td>{d.level}</td><td>{d.archeLevel}</td><td>{d.catalysts}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Reactors */}
      {(state.reactors ?? []).length > 0 && (
        <section className="panel" style={{ marginBottom: "1rem" }}>
          <h2>Reactors ({state.reactors!.length})</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Element</th><th>Skill Type</th><th>Level</th><th>Enhancement</th></tr></thead>
              <tbody>
                {state.reactors!.map((r) => (
                  <tr key={r.id}><td>{r.name}</td><td>{r.element}</td><td>{r.skillType}</td><td>{r.level}</td><td>{String(r.enhancement).trim().toLowerCase() === "max" ? "5" : r.enhancement}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Weapons */}
      {ownedWeapons.length > 0 && (
        <section className="panel" style={{ marginBottom: "1rem" }}>
          <h2>Acquired Weapons ({ownedWeapons.length})</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Rarity</th><th>Rounds</th><th>Level</th><th>Enhancement</th></tr></thead>
              <tbody>
                {ownedWeapons.map((w) => (
                  <tr key={w.slug}>
                    <td>{w.name}</td>
                    <td><span className={`skill-chip ${w.rarity === "Ultimate" ? "rarity-chip-ultimate" : w.rarity === "Rare" ? "rarity-chip-rare" : "rarity-chip-normal"}`}>{w.rarity}</span></td>
                    <td>{w.roundsType}</td>
                    <td>{w.level}</td>
                    <td>{w.enhancement}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Goals */}
      {activeGoals.length > 0 && (
        <section className="panel" style={{ marginBottom: "1rem" }}>
          <h2>Active Farming Goals</h2>
          <ul className="item-list">
            {activeGoals.map((g) => (
              <li key={g.id}>
                <span style={{ fontSize: "0.88rem" }}>{g.text}</span>
                <span className="filter-chip" style={{ fontSize: "0.72rem" }}>Farming</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
