"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useI18n } from "@/contexts/i18n-context";
import styles from "./tier-list-mod-panel.module.css";

type Tab = "descendants" | "weapons";

type TierKey = "S" | "A" | "B" | "C" | "D";

type OverviewEntity = {
  entityKey: string;
  displayName: string;
  rawByTier: Record<TierKey, number>;
  overlayByTier: Record<TierKey, number>;
  effectiveByTier: Record<TierKey, number>;
  uniqueVoters: number;
  rawScorePercent: number | null;
  effectiveScorePercent: number | null;
};

type VoterRow = {
  id: string;
  userId: string;
  username: string | null;
  name: string | null;
  tier: string;
  createdAt: string;
};

const TIERS: TierKey[] = ["S", "A", "B", "C", "D"];

export function TierListModPanel({
  tab,
  onTierListChanged,
}: {
  tab: Tab;
  onTierListChanged: () => void;
}) {
  const { t } = useI18n();
  const { status } = useSession();
  const [modOk, setModOk] = useState(false);
  const [entities, setEntities] = useState<OverviewEntity[]>([]);
  const [overviewErr, setOverviewErr] = useState<string | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");
  const [deltaTier, setDeltaTier] = useState<TierKey>("S");
  const [deltaAmount, setDeltaAmount] = useState("1");
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [voters, setVoters] = useState<VoterRow[] | null>(null);
  const [votersLoading, setVotersLoading] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") {
      setModOk(false);
      return;
    }
    let cancelled = false;
    void fetch("/api/tier-list/mod/session", { credentials: "include", cache: "no-store" }).then((r) => {
      if (!cancelled) setModOk(r.ok);
    });
    return () => {
      cancelled = true;
    };
  }, [status]);

  const loadOverview = useCallback(async () => {
    if (!modOk) return;
    setLoadingOverview(true);
    setOverviewErr(null);
    try {
      const r = await fetch(`/api/tier-list/mod/overview?tab=${tab}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!r.ok) {
        setOverviewErr(t("tierListMod.overviewFailed"));
        setEntities([]);
        return;
      }
      const j = (await r.json()) as { entities?: OverviewEntity[] };
      setEntities(Array.isArray(j.entities) ? j.entities : []);
    } catch {
      setOverviewErr(t("tierListMod.overviewFailed"));
      setEntities([]);
    } finally {
      setLoadingOverview(false);
    }
  }, [modOk, tab, t]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    setVoters(null);
    setActionErr(null);
    if (entities.length === 0) {
      setSelectedKey("");
      return;
    }
    setSelectedKey((prev) => {
      if (prev && entities.some((e) => e.entityKey === prev)) return prev;
      return entities[0]!.entityKey;
    });
  }, [entities]);

  const selected = useMemo(
    () => entities.find((e) => e.entityKey === selectedKey) ?? null,
    [entities, selectedKey],
  );

  async function applyDelta() {
    if (!selected) return;
    const n = Number.parseInt(deltaAmount, 10);
    if (!Number.isFinite(n) || n === 0) {
      setActionErr(t("tierListMod.deltaInvalid"));
      return;
    }
    setBusy(true);
    setActionErr(null);
    try {
      const r = await fetch("/api/tier-list/mod/overlay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tab,
          entityKey: selected.entityKey,
          deltas: { [deltaTier]: n },
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setActionErr(typeof j.error === "string" ? j.error : t("tierListMod.actionFailed"));
        return;
      }
      await loadOverview();
      onTierListChanged();
      setVoters(null);
    } finally {
      setBusy(false);
    }
  }

  async function resetOverlay() {
    if (!selected) return;
    if (!window.confirm(t("tierListMod.confirmReset"))) return;
    setBusy(true);
    setActionErr(null);
    try {
      const r = await fetch("/api/tier-list/mod/overlay/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tab, entityKey: selected.entityKey }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setActionErr(typeof j.error === "string" ? j.error : t("tierListMod.actionFailed"));
        return;
      }
      await loadOverview();
      onTierListChanged();
      setVoters(null);
    } finally {
      setBusy(false);
    }
  }

  async function loadVoters() {
    if (!selected) return;
    setVotersLoading(true);
    setActionErr(null);
    try {
      const r = await fetch(
        `/api/tier-list/mod/voters?tab=${tab}&entityKey=${encodeURIComponent(selected.entityKey)}`,
        { credentials: "include", cache: "no-store" },
      );
      const j = (await r.json()) as { votes?: VoterRow[]; error?: string };
      if (!r.ok) {
        setActionErr(j.error ?? t("tierListMod.actionFailed"));
        setVoters([]);
        return;
      }
      setVoters(Array.isArray(j.votes) ? j.votes : []);
    } catch {
      setActionErr(t("tierListMod.actionFailed"));
      setVoters([]);
    } finally {
      setVotersLoading(false);
    }
  }

  async function deleteVote(voteId: string) {
    if (!window.confirm(t("tierListMod.confirmDeleteVote"))) return;
    setBusy(true);
    setActionErr(null);
    try {
      const r = await fetch("/api/tier-list/mod/vote", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ voteId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setActionErr(typeof j.error === "string" ? j.error : t("tierListMod.actionFailed"));
        return;
      }
      await loadOverview();
      await loadVoters();
      onTierListChanged();
    } finally {
      setBusy(false);
    }
  }

  if (status !== "authenticated" || !modOk) {
    return null;
  }

  return (
    <div className={styles.wrap}>
      <details className={styles.details}>
        <summary className={styles.summary}>{t("tierListMod.title")}</summary>
        <div className={styles.body}>
          <p className={styles.hint}>{t("tierListMod.hint")}</p>

          {overviewErr && <p className={styles.err}>{overviewErr}</p>}
          {loadingOverview && <p className={styles.meta}>{t("tierListMod.loadingOverview")}</p>}

          {!loadingOverview && entities.length > 0 && (
            <>
              <div className={styles.row}>
                <div>
                  <span className={styles.label}>{t("tierListMod.pickEntity")}</span>
                  <select
                    className={styles.select}
                    value={selectedKey}
                    onChange={(e) => {
                      setSelectedKey(e.target.value);
                      setVoters(null);
                      setActionErr(null);
                    }}
                  >
                    {entities.map((e) => (
                      <option key={e.entityKey} value={e.entityKey}>
                        {e.displayName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selected && (
                <>
                  <p className={styles.meta}>
                    {t("tierListMod.uniqueVoters", { n: String(selected.uniqueVoters) })}
                    {" · "}
                    {t("tierListMod.scores", {
                      raw: selected.rawScorePercent != null ? `${selected.rawScorePercent}%` : "—",
                      eff:
                        selected.effectiveScorePercent != null ? `${selected.effectiveScorePercent}%` : "—",
                    })}
                  </p>

                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>{t("tierListMod.colTier")}</th>
                          <th>{t("tierListMod.colReal")}</th>
                          <th>{t("tierListMod.colOverlay")}</th>
                          <th>{t("tierListMod.colEffective")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {TIERS.map((tier) => (
                          <tr key={tier}>
                            <td>{tier}</td>
                            <td>{selected.rawByTier[tier]}</td>
                            <td>{selected.overlayByTier[tier]}</td>
                            <td>{selected.effectiveByTier[tier]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className={styles.row}>
                    <div>
                      <span className={styles.label}>{t("tierListMod.addToTier")}</span>
                      <select
                        className={styles.select}
                        value={deltaTier}
                        onChange={(e) => setDeltaTier(e.target.value as TierKey)}
                        style={{ minWidth: "4rem" }}
                      >
                        {TIERS.map((x) => (
                          <option key={x} value={x}>
                            {x}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <span className={styles.label}>{t("tierListMod.deltaCount")}</span>
                      <input
                        className={styles.input}
                        type="number"
                        value={deltaAmount}
                        onChange={(e) => setDeltaAmount(e.target.value)}
                      />
                    </div>
                    <button type="button" className={styles.btn} disabled={busy} onClick={() => void applyDelta()}>
                      {t("tierListMod.applyDelta")}
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnDanger}`}
                      disabled={busy}
                      onClick={() => void resetOverlay()}
                    >
                      {t("tierListMod.resetOverlay")}
                    </button>
                  </div>

                  <div className={styles.row}>
                    <button type="button" className={styles.btn} disabled={votersLoading || busy} onClick={() => void loadVoters()}>
                      {votersLoading ? t("tierListMod.loadingVoters") : t("tierListMod.loadVoters")}
                    </button>
                  </div>

                  {voters && voters.length > 0 && (
                    <div className={styles.voterList}>
                      {voters.map((v) => (
                        <div key={v.id} className={styles.voterRow}>
                          <span>
                            @{v.username ?? v.userId.slice(0, 8)}
                            {v.name ? ` (${v.name})` : ""}
                          </span>
                          <span>{v.tier}</span>
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnDanger}`}
                            disabled={busy}
                            onClick={() => void deleteVote(v.id)}
                          >
                            {t("tierListMod.removeVote")}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {voters && voters.length === 0 && (
                    <p className={styles.meta}>{t("tierListMod.noVoters")}</p>
                  )}
                </>
              )}
            </>
          )}

          {actionErr && <p className={styles.err}>{actionErr}</p>}
        </div>
      </details>
    </div>
  );
}
