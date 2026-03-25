import Link from "next/link";
import { SignInWithDiscordLink } from "@/components/sign-in-discord-link";
import { PublicBuildPlannerView } from "@/components/public-build-planner-view";
import type { PublicBuild } from "@/lib/public-build-types";

interface SharedState {
  builds?: PublicBuild[];
}

interface Owner {
  name: string | null;
  image: string | null;
  username: string | null;
}

async function getProfileData(username: string): Promise<{ owner: Owner; state: SharedState } | null> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/share/u/${encodeURIComponent(username)}`, { cache: "no-store" });
    if (!res.ok) {
      if (res.status === 403) {
        return { owner: { name: null, image: null, username }, state: {} };
      }
      return null;
    }
    return res.json();
  } catch {
    return null;
  }
}

export default async function PublicBuildPage({
  params,
}: {
  params: Promise<{ username: string; buildId: string }>;
}) {
  const { username, buildId } = await params;
  const data = await getProfileData(username);

  if (!data) {
    return (
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <h1>TFD Tracker</h1>
          </div>
        </header>
        <section className="panel">
          <h2>Profile not found</h2>
          <p className="muted">No user with the username <strong>@{username}</strong> exists.</p>
          <div className="actions">
            <Link className="btn btn-primary" href="/">
              Go home
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (Object.keys(data.state).length === 0 && !data.owner.name) {
    return (
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <h1>TFD Tracker</h1>
          </div>
        </header>
        <section className="panel">
          <h2>Build not available</h2>
          <p className="muted">This user has not shared builds publicly, or the profile is restricted. Ask them to enable Builds sharing (Public) and mark the build Public.</p>
          <div className="actions">
            <Link className="btn btn-primary" href="/">
              Go home
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const build = (data.state.builds ?? []).find((b) => b.id === buildId);
  if (!build?.name) {
    return (
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <h1>TFD Tracker</h1>
          </div>
        </header>
        <section className="panel">
          <h2>Build not found</h2>
          <p className="muted">This build does not exist or has no name.</p>
          <div className="actions">
            <Link className="btn btn-primary" href={`/u/${encodeURIComponent(username)}`}>
              View @{username}
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const { owner } = data;

  return (
    <div className="app public-build-page">
      <header className="topbar">
        <div className="topbar-row">
          <div className="brand">
            <h1>Shared build</h1>
            <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.88rem" }}>
              {build.name} · {build.displayName} · by @{owner.username ?? username}
              {owner.name ? ` (${owner.name})` : ""}
            </p>
          </div>
          {owner.image && (
            <span className="user-chip">
              <img src={owner.image} alt="" />
              {owner.name ?? "Player"}
            </span>
          )}
        </div>
        <div style={{ paddingTop: "0.35rem", display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
          <Link className="filter-chip" href="/">
            Home
          </Link>
          <Link className="filter-chip" href={`/u/${encodeURIComponent(username)}`}>
            @{owner.username ?? username} full profile
          </Link>
          <SignInWithDiscordLink className="filter-chip">
            Sign in to track your own builds
          </SignInWithDiscordLink>
        </div>
      </header>

      <section className="panel public-build-spotlight-panel">
        <PublicBuildPlannerView build={build as PublicBuild} />
      </section>
    </div>
  );
}
