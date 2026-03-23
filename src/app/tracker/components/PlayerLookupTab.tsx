"use client";

import { useCallback, useEffect, useState } from "react";

type Compliance = {
  daysSinceStaticMetadataPull: number | null;
  daysSinceStatsPull: number | null;
  metadataOverdue?: boolean;
  statsOverdue?: boolean;
  refreshWithinDays: number;
  notice?: string;
  libraryUrls?: Record<string, string>;
};

export function PlayerLookupTab() {
  const [compliance, setCompliance] = useState<Compliance | null>(null);
  const [userName, setUserName] = useState("");
  const [ouid, setOuid] = useState("");
  const [include, setInclude] = useState("basic,descendant");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  useEffect(() => {
    fetch("/api/nexon/compliance")
      .then((r) => r.json())
      .then((d) => setCompliance(d))
      .catch(() => setCompliance(null));
  }, []);

  const runLookup = useCallback(async () => {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const name = userName.trim();
      const o = ouid.trim();
      if (!name && !o) {
        setError("Enter an in-game user name or paste an OUID.");
        setLoading(false);
        return;
      }
      if (name) params.set("user_name", name);
      if (o) params.set("ouid", o);
      params.set("include", include.trim() || "basic");
      const res = await fetch(`/api/nexon/player?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(
          typeof data?.message === "string"
            ? data.message
            : typeof data?.error === "string"
              ? data.error
              : `Request failed (${res.status})`,
        );
        setResult(data);
        return;
      }
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [userName, ouid, include]);

  return (
    <section className="panel">
      <h2>Player lookup (Nexon Open API)</h2>
      <p className="muted">
        Live data from your registered Nexon Open API key (server-side only). Canonical **library** reference for
        names/stats/math:{" "}
        <a href="https://tfd.nexon.com/en/library/descendants" target="_blank" rel="noopener noreferrer">
          Descendants
        </a>
        ,{" "}
        <a href="https://tfd.nexon.com/en/library/weapons" target="_blank" rel="noopener noreferrer">
          Weapons
        </a>
        ,{" "}
        <a href="https://tfd.nexon.com/en/library/modules" target="_blank" rel="noopener noreferrer">
          Modules
        </a>
        , etc.
      </p>

      {compliance && (
        <div
          className="panel"
          style={{
            marginBottom: "1rem",
            padding: "0.75rem",
            borderColor:
              compliance.metadataOverdue || compliance.statsOverdue ? "var(--danger)" : "var(--line)",
          }}
        >
          <strong>Nexon 30-day data notice</strong>
          <p className="muted" style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>
            {compliance.notice}{" "}
            <a href="https://openapi.nexon.com" target="_blank" rel="noopener noreferrer">
              openapi.nexon.com
            </a>
          </p>
          <p style={{ fontSize: "0.82rem", marginTop: "0.35rem" }}>
            Static metadata last pull:{" "}
            {compliance.daysSinceStaticMetadataPull === null
              ? "—"
              : `${compliance.daysSinceStaticMetadataPull} day(s) ago`}
            {compliance.metadataOverdue ? (
              <span style={{ color: "var(--danger)" }}> — run `npm run fetch:data`</span>
            ) : null}
          </p>
          <p style={{ fontSize: "0.82rem" }}>
            Stat DB last pull:{" "}
            {compliance.daysSinceStatsPull === null ? "—" : `${compliance.daysSinceStatsPull} day(s) ago`}
            {compliance.statsOverdue ? (
              <span style={{ color: "var(--danger)" }}> — run `npm run fetch:stats`</span>
            ) : null}
          </p>
          <p className="muted" style={{ fontSize: "0.78rem" }}>
            Refresher within {compliance.refreshWithinDays} days per Nexon terms.
          </p>
        </div>
      )}

      <label>
        In-game user name (resolves OUID via `/tfd/v1/id`)
        <input
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="e.g. PlayerName"
          style={{ width: "100%", maxWidth: "28rem" }}
        />
      </label>
      <p className="muted" style={{ fontSize: "0.82rem", margin: "0.35rem 0 0.75rem" }}>
        Or paste <strong>OUID</strong> directly (skip name resolution):
      </p>
      <label>
        OUID (optional)
        <input
          value={ouid}
          onChange={(e) => setOuid(e.target.value)}
          placeholder="hex string from Nexon"
          style={{ width: "100%", maxWidth: "36rem" }}
        />
      </label>
      <label style={{ marginTop: "0.75rem" }}>
        Include (comma-separated)
        <input
          value={include}
          onChange={(e) => setInclude(e.target.value)}
          placeholder="basic, descendant, weapon, reactor, external-component"
          style={{ width: "100%", maxWidth: "36rem" }}
        />
      </label>
      <p className="muted" style={{ fontSize: "0.78rem" }}>
        Use <code className="inline-code">all</code> for basic + descendant + weapon + reactor + external-component.
      </p>

      <div style={{ marginTop: "0.75rem" }}>
        <button type="button" className="btn-primary" onClick={runLookup} disabled={loading}>
          {loading ? "Loading…" : "Lookup"}
        </button>
      </div>

      {error && (
        <p style={{ color: "var(--danger)", marginTop: "0.75rem" }} role="alert">
          {error}
        </p>
      )}

      {result != null ? (
        <pre
          className="player-lookup-json"
          style={{
            marginTop: "1rem",
            padding: "0.75rem",
            borderRadius: "8px",
            border: "1px solid var(--line)",
            background: "var(--panel-2)",
            fontSize: "0.72rem",
            overflow: "auto",
            maxHeight: "70vh",
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}
