"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  fetchDescendantsCatalogRows,
  fetchModulesCatalog,
  fetchWeaponsCatalogRows,
} from "@/lib/fetch-game-catalog";
import type { PlayerLookupCatalogs } from "./player-lookup/PlayerLookupProfile";
import { PlayerLookupProfile } from "./player-lookup/PlayerLookupProfile";

type Compliance = {
  daysSinceStaticMetadataPull: number | null;
  daysSinceStatsPull: number | null;
  metadataOverdue?: boolean;
  statsOverdue?: boolean;
  refreshWithinDays: number;
  notice?: string;
  libraryUrls?: Record<string, string>;
};

function isSuccessPayload(x: unknown): x is Record<string, unknown> & { ouid: string } {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.ouid === "string" && o.ouid.length > 0;
}

export function PlayerLookupTab() {
  const [compliance, setCompliance] = useState<Compliance | null>(null);
  const [catalogs, setCatalogs] = useState<PlayerLookupCatalogs | null>(null);
  const [userName, setUserName] = useState("");
  const [ouidOverride, setOuidOverride] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    fetch("/api/nexon/compliance")
      .then((r) => r.json())
      .then((d) => setCompliance(d))
      .catch(() => setCompliance(null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchModulesCatalog(), fetchDescendantsCatalogRows(), fetchWeaponsCatalogRows()]).then(
      ([m, d, w]) => {
        if (cancelled) return;
        setCatalogs({
          modules: new Map((m ?? []).map((x) => [x.id, x])),
          descendants: new Map((d ?? []).map((x) => [x.id, x])),
          weapons: new Map((w ?? []).map((x) => [x.id, x])),
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const runLookup = useCallback(async () => {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const name = userName.trim();
      const o = ouidOverride.trim();
      if (!name && !o) {
        setError("Enter an in-game user name (e.g. PlayerName#1234).");
        setLoading(false);
        return;
      }
      if (name) params.set("user_name", name);
      if (o) params.set("ouid", o);
      params.set("include", "all");
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
  }, [userName, ouidOverride]);

  const onSubmitForm = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      void runLookup();
    },
    [runLookup],
  );

  return (
    <section className="panel">
      <h2>Player lookup</h2>
      <p className="muted">
        Search by in-game name. We load your Nexon Open API profile (descendant, weapons, reactor, components) and
        match IDs to the official library catalog (
        <a href="https://tfd.nexon.com/en/library/descendants" target="_blank" rel="noopener noreferrer">
          Nexon library
        </a>
        ).
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
        </div>
      )}

      <form onSubmit={onSubmitForm} style={{ maxWidth: "32rem" }}>
        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontWeight: 600, marginBottom: "0.35rem" }}>In-game name</span>
          <input
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="e.g. marcioquatro#8225"
            style={{ width: "100%", padding: "0.5rem 0.65rem", fontSize: "1rem" }}
            autoComplete="off"
          />
        </label>

        <details style={{ marginBottom: "0.75rem", fontSize: "0.88rem" }}>
          <summary style={{ cursor: "pointer", color: "var(--muted)" }}>Advanced: paste OUID</summary>
          <p className="muted" style={{ marginTop: "0.5rem" }}>
            Skip name lookup and query by Nexon OUID directly.
          </p>
          <input
            value={ouidOverride}
            onChange={(e) => setOuidOverride(e.target.value)}
            placeholder="hex OUID"
            style={{ width: "100%", marginTop: "0.35rem", padding: "0.4rem 0.5rem" }}
          />
        </details>

        <button type="submit" className="btn-primary" disabled={loading || !catalogs}>
          {loading ? "Loading…" : "Search"}
        </button>
        {!catalogs ? (
          <span className="muted" style={{ marginLeft: "0.75rem", fontSize: "0.85rem" }}>
            Loading item catalog…
          </span>
        ) : null}
      </form>

      {error && (
        <p style={{ color: "var(--danger)", marginTop: "0.75rem" }} role="alert">
          {error}
        </p>
      )}

      {isSuccessPayload(result) && catalogs ? (
        <PlayerLookupProfile data={result} catalogs={catalogs} />
      ) : null}

      {result != null ? (
        <details style={{ marginTop: "1.25rem" }}>
          <summary style={{ cursor: "pointer", fontSize: "0.88rem", color: "var(--muted)" }}>
            Raw API response (debug)
          </summary>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem", fontSize: "0.82rem" }}>
            <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} />
            Show JSON
          </label>
          {showRaw ? (
            <pre
              style={{
                marginTop: "0.5rem",
                padding: "0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                background: "var(--panel-2)",
                fontSize: "0.7rem",
                overflow: "auto",
                maxHeight: "40vh",
              }}
            >
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : null}
        </details>
      ) : null}
    </section>
  );
}
