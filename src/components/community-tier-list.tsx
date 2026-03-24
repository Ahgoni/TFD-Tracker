"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import styles from "./community-tier-list.module.css";

type TierItem = {
  entityKey: string;
  displayName: string;
  image: string;
  voteCount: number;
};

type TierRow = { tier: string; items: TierItem[] };

type ApiPayload = {
  tab: string;
  tiers: TierRow[];
  myVotes: Record<string, string>;
};

type PublicBuildRow = {
  buildId: string;
  buildName: string;
  username: string;
  authorName: string | null;
  href: string;
};

const TIER_CLASS: Record<string, string> = {
  S: styles.tS,
  A: styles.tA,
  B: styles.tB,
  C: styles.tC,
  D: styles.tD,
  UNRANKED: styles.tU,
};

export function CommunityTierList() {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState<"descendants" | "weapons">("descendants");
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<TierItem | null>(null);
  const [publicBuilds, setPublicBuilds] = useState<PublicBuildRow[] | null>(null);
  const [buildsLoading, setBuildsLoading] = useState(false);
  const [voteBusy, setVoteBusy] = useState(false);

  const loadTierList = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/tier-list?tab=${tab}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load tier list");
      const json = (await res.json()) as ApiPayload;
      setData(json);
    } catch {
      setLoadError("Could not load tier list.");
    }
  }, [tab]);

  useEffect(() => {
    void loadTierList();
  }, [loadTierList]);

  useEffect(() => {
    if (!modal) {
      setPublicBuilds(null);
      return;
    }
    setBuildsLoading(true);
    setPublicBuilds(null);
    const q = new URLSearchParams({ tab, entityKey: modal.entityKey });
    fetch(`/api/tier-list/public-builds?${q}`)
      .then((r) => r.json())
      .then((j: { builds?: PublicBuildRow[] }) => {
        setPublicBuilds(Array.isArray(j.builds) ? j.builds : []);
      })
      .catch(() => setPublicBuilds([]))
      .finally(() => setBuildsLoading(false));
  }, [modal, tab]);

  async function submitVote(tier: string) {
    if (!modal) return;
    setVoteBusy(true);
    try {
      const res = await fetch("/api/tier-list/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tab, entityKey: modal.entityKey, tier }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        window.alert(typeof j.error === "string" ? j.error : "Vote failed.");
        return;
      }
      await loadTierList();
    } finally {
      setVoteBusy(false);
    }
  }

  const myVoteForModal = modal && data?.myVotes ? data.myVotes[modal.entityKey] : undefined;

  return (
    <section className={styles.section} aria-labelledby="community-tier-heading">
      <div className={styles.head}>
        <h2 id="community-tier-heading" className={styles.title}>
          The First Descendant <span className={styles.titleAccent}>Community Tier List</span>
        </h2>
        <p className={styles.sub}>
          Votes from signed-in players set each row. Ultimate and base descendants count as one entry. Click a portrait to
          vote or browse public builds.
        </p>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Tier list category">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "descendants"}
          className={`${styles.tab} ${tab === "descendants" ? styles.tabActive : ""}`}
          onClick={() => setTab("descendants")}
        >
          Descendants
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "weapons"}
          className={`${styles.tab} ${tab === "weapons" ? styles.tabActive : ""}`}
          onClick={() => setTab("weapons")}
        >
          Weapons
        </button>
      </div>

      {loadError && <p className={styles.loading}>{loadError}</p>}
      {!data && !loadError && <p className={styles.loading}>Loading tier list…</p>}

      {data && (
        <div className={styles.tierRows}>
          {data.tiers.map((row) => (
            <div className={styles.tierRow} key={row.tier}>
              <div
                className={`${styles.tierBadge} ${TIER_CLASS[row.tier] ?? styles.tU}`}
                title={row.tier === "UNRANKED" ? "Unranked (no votes yet)" : `Tier ${row.tier}`}
              >
                {row.tier === "UNRANKED" ? "?" : row.tier}
              </div>
              <div className={styles.portraitRow}>
                {row.items.length === 0 ? (
                  <span className={styles.emptyBuilds} style={{ padding: "0.35rem" }}>
                    —
                  </span>
                ) : (
                  row.items.map((item) => (
                    <button
                      key={item.entityKey}
                      type="button"
                      className={styles.portraitBtn}
                      onClick={() => setModal(item)}
                      title={`${item.displayName} · ${item.voteCount} vote(s)`}
                    >
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className={styles.portraitImg} src={item.image} alt="" />
                      ) : (
                        <div className={styles.portraitImg} aria-hidden />
                      )}
                      <span className={styles.portraitName}>{item.displayName}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div
          className={styles.backdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tier-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTop}>
              {modal.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.modalImg} src={modal.image} alt="" />
              ) : (
                <div className={styles.modalImg} aria-hidden />
              )}
              <h3 id="tier-modal-title" className={styles.modalTitle}>
                {modal.displayName}
              </h3>
              <button type="button" className={styles.modalClose} onClick={() => setModal(null)} aria-label="Close">
                ×
              </button>
            </div>

            <div className={styles.voteBlock}>
              <p className={styles.voteLabel}>Your tier vote</p>
              {status === "loading" ? (
                <p className={styles.signInHint}>Checking session…</p>
              ) : session?.user ? (
                <div className={styles.voteRow}>
                  {(["S", "A", "B", "C", "D"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`${styles.voteBtn} ${myVoteForModal === t ? styles.voteBtnActive : ""}`}
                      disabled={voteBusy}
                      onClick={() => void submitVote(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <p className={styles.signInHint}>Sign in with Discord to add your vote.</p>
                  <button type="button" className={styles.voteBtn} onClick={() => void signIn("discord")}>
                    Sign in with Discord
                  </button>
                </>
              )}
            </div>

            <div>
              <p className={styles.buildsLabel}>Public builds</p>
              {buildsLoading ? (
                <p className={styles.emptyBuilds}>Loading…</p>
              ) : publicBuilds && publicBuilds.length > 0 ? (
                publicBuilds.map((b) => (
                  <Link key={`${b.username}-${b.buildId}`} href={b.href} className={styles.buildLink}>
                    <div className={styles.buildLinkTitle}>{b.buildName}</div>
                    <div className={styles.buildLinkMeta}>
                      by @{b.username}
                      {b.authorName ? ` · ${b.authorName}` : ""}
                    </div>
                  </Link>
                ))
              ) : (
                <p className={styles.emptyBuilds}>
                  No public builds listed for this {tab === "weapons" ? "weapon" : "descendant"} yet. Mark a build as tier hub
                  in the tracker (Builds tab) with profile sharing open.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
