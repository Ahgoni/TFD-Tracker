"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirectToDiscordOAuth } from "@/lib/discord-oauth-redirect";
import { useI18n } from "@/contexts/i18n-context";
import { TierListModPanel } from "@/components/tier-list-mod-panel";
import styles from "./community-tier-list.module.css";

type VoteTierKey = "S" | "A" | "B" | "C" | "D";

type TierItem = {
  entityKey: string;
  displayName: string;
  image: string;
  voteCount: number;
  votesByTier: Record<VoteTierKey, number>;
  scorePercent: number | null;
  consensusTier: VoteTierKey | null;
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

const DIST_CLASS: Record<VoteTierKey, string> = {
  S: styles.distS,
  A: styles.distA,
  B: styles.distB,
  C: styles.distC,
  D: styles.distD,
};

const TIER_ORDER: readonly VoteTierKey[] = ["S", "A", "B", "C", "D"];

function VoteDistributionBar({
  votesByTier,
  total,
  label,
  decorative = false,
}: {
  votesByTier: Record<VoteTierKey, number>;
  total: number;
  /** When false, provide a short description for screen readers. */
  label?: string;
  /** Hide from assistive tech when an ancestor already names the control (e.g. list row button). */
  decorative?: boolean;
}) {
  if (total <= 0) {
    return (
      <div className={styles.barTrack} aria-hidden={decorative || undefined}>
        <div className={styles.barEmpty} />
      </div>
    );
  }
  return (
    <div
      className={styles.barTrack}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : label}
    >
      {TIER_ORDER.map((t) => {
        const n = votesByTier[t];
        if (n <= 0) return null;
        return (
          <div
            key={t}
            className={`${styles.barSeg} ${DIST_CLASS[t]}`}
            style={{ flexGrow: n, flexBasis: 0, minWidth: n > 0 ? "4px" : 0 }}
          />
        );
      })}
    </div>
  );
}

const DISPLAY_STORAGE_KEY = "tfd-tier-list-display";

function readStoredDisplayMode(): "tiers" | "votes" {
  if (typeof window === "undefined") return "tiers";
  try {
    const v = window.sessionStorage.getItem(DISPLAY_STORAGE_KEY);
    if (v === "votes" || v === "tiers") return v;
  } catch {
    /* ignore */
  }
  return "tiers";
}

function goToDiscordSignIn() {
  if (typeof window === "undefined") return;
  const u = new URL(window.location.href);
  u.hash = "";
  void redirectToDiscordOAuth(u.toString()).catch(() => {
    window.alert("Could not start Discord sign-in.");
  });
}

export function CommunityTierList() {
  const { t } = useI18n();
  const { data: session, status } = useSession();
  const [tab, setTab] = useState<"descendants" | "weapons">("descendants");
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<TierItem | null>(null);
  const [publicBuilds, setPublicBuilds] = useState<PublicBuildRow[] | null>(null);
  const [buildsLoading, setBuildsLoading] = useState(false);
  const [voteBusy, setVoteBusy] = useState(false);
  const [displayMode, setDisplayMode] = useState<"tiers" | "votes">("tiers");

  useEffect(() => {
    setDisplayMode(readStoredDisplayMode());
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(DISPLAY_STORAGE_KEY, displayMode);
    } catch {
      /* ignore */
    }
  }, [displayMode]);

  const loadTierList = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/tier-list?tab=${tab}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load tier list");
      const json = (await res.json()) as ApiPayload;
      setData(json);
    } catch {
      setLoadError(t("tierList.loadError"));
    }
  }, [tab, t]);

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
    if (status !== "authenticated" || !session?.user) {
      goToDiscordSignIn();
      return;
    }
    setVoteBusy(true);
    try {
      const res = await fetch("/api/tier-list/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tab, entityKey: modal.entityKey, tier }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        window.alert(typeof j.error === "string" ? j.error : t("tierList.voteFailed"));
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
          {t("tierList.title")} <span className={styles.titleAccent}>{t("tierList.titleAccent")}</span>
        </h2>
        <p className={styles.sub}>{t("tierList.subtitle")}</p>
      </div>

      <div className={styles.tabsRow}>
        <div className={styles.tabs} role="tablist" aria-label={t("tierList.tabsAria")}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "descendants"}
            className={`${styles.tab} ${tab === "descendants" ? styles.tabActive : ""}`}
            onClick={() => setTab("descendants")}
          >
            {t("tierList.tabDescendants")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "weapons"}
            className={`${styles.tab} ${tab === "weapons" ? styles.tabActive : ""}`}
            onClick={() => setTab("weapons")}
          >
            {t("tierList.tabWeapons")}
          </button>
        </div>
        <div className={styles.displayToggle} role="group" aria-label={t("tierList.displayAria")}>
          <span className={styles.displayLabel}>{t("tierList.displayLabel")}</span>
          <button
            type="button"
            className={`${styles.displayBtn} ${displayMode === "tiers" ? styles.displayBtnActive : ""}`}
            aria-pressed={displayMode === "tiers"}
            onClick={() => setDisplayMode("tiers")}
          >
            {t("tierList.displayTiers")}
          </button>
          <button
            type="button"
            className={`${styles.displayBtn} ${displayMode === "votes" ? styles.displayBtnActive : ""}`}
            aria-pressed={displayMode === "votes"}
            onClick={() => setDisplayMode("votes")}
          >
            {t("tierList.displayVotes")}
          </button>
        </div>
      </div>

      <TierListModPanel tab={tab} onTierListChanged={() => void loadTierList()} />

      {loadError && <p className={styles.loading}>{loadError}</p>}
      {!data && !loadError && <p className={styles.loading}>{t("tierList.loading")}</p>}

      {data && (
        <div className={styles.tierRows}>
          {data.tiers.map((row) => (
            <div className={styles.tierRow} key={row.tier}>
              <div
                className={`${styles.tierBadge} ${TIER_CLASS[row.tier] ?? styles.tU}`}
                title={
                  row.tier === "UNRANKED"
                    ? t("tierList.tierUnrankedTitle")
                    : t("tierList.tierRankTitle", { tier: row.tier })
                }
              >
                {row.tier === "UNRANKED" ? "?" : row.tier}
              </div>
              <div className={displayMode === "votes" ? styles.itemList : styles.portraitList}>
                {row.items.length === 0 ? (
                  <span className={styles.emptyBuilds} style={{ padding: "0.35rem" }}>
                    —
                  </span>
                ) : displayMode === "tiers" ? (
                  <div className={styles.portraitRow}>
                    {row.items.map((item) => (
                      <button
                        key={item.entityKey}
                        type="button"
                        className={styles.portraitBtn}
                        onClick={() => setModal(item)}
                        title={t("tierList.voteCount", {
                          name: item.displayName,
                          count: String(item.voteCount),
                        })}
                      >
                        {item.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className={styles.portraitImg} src={item.image} alt="" />
                        ) : (
                          <div className={styles.portraitImg} aria-hidden />
                        )}
                        <span className={styles.portraitNameTiers}>{item.displayName}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  row.items.map((item) => {
                    const total = item.voteCount;
                    const scoreLabel =
                      item.scorePercent != null
                        ? t("tierList.rowAria", {
                            name: item.displayName,
                            score: String(item.scorePercent),
                            count: String(total),
                          })
                        : t("tierList.rowAriaUnranked", { name: item.displayName });
                    return (
                      <button
                        key={item.entityKey}
                        type="button"
                        className={styles.itemRow}
                        onClick={() => setModal(item)}
                        title={t("tierList.voteCount", {
                          name: item.displayName,
                          count: String(item.voteCount),
                        })}
                        aria-label={scoreLabel}
                      >
                        <div className={styles.itemLead}>
                          {item.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img className={styles.portraitImg} src={item.image} alt="" />
                          ) : (
                            <div className={styles.portraitImg} aria-hidden />
                          )}
                          <span className={styles.portraitName}>{item.displayName}</span>
                        </div>
                        <div className={styles.barCell}>
                          <VoteDistributionBar
                            votesByTier={
                              item.votesByTier ?? { S: 0, A: 0, B: 0, C: 0, D: 0 }
                            }
                            total={total}
                            decorative
                          />
                        </div>
                        <div className={styles.scoreCol} aria-hidden>
                          {item.scorePercent != null ? (
                            <span className={styles.scorePct}>{item.scorePercent}%</span>
                          ) : (
                            <span className={styles.scoreDash}>—</span>
                          )}
                        </div>
                      </button>
                    );
                  })
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
              <button type="button" className={styles.modalClose} onClick={() => setModal(null)} aria-label={t("tierList.modalClose")}>
                ×
              </button>
            </div>

            {modal.voteCount > 0 && modal.scorePercent != null && modal.votesByTier && (
              <div className={styles.modalStats}>
                <p className={styles.modalStatsLabel}>{t("tierList.communityScore")}</p>
                <div className={styles.modalStatsRow}>
                  <VoteDistributionBar
                    votesByTier={modal.votesByTier}
                    total={modal.voteCount}
                    label={t("tierList.rowAria", {
                      name: modal.displayName,
                      score: String(modal.scorePercent),
                      count: String(modal.voteCount),
                    })}
                  />
                  <span className={styles.modalScorePct}>{modal.scorePercent}%</span>
                </div>
                <p className={styles.modalStatsHint}>{t("tierList.scoreHint")}</p>
              </div>
            )}

            <div className={styles.voteBlock}>
              <p className={styles.voteLabel}>{t("tierList.modalYourVote")}</p>
              {status === "loading" ? (
                <p className={styles.signInHint}>{t("tierList.modalCheckingSession")}</p>
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
                  <p className={styles.signInHint}>{t("tierList.modalSignInHint")}</p>
                  <button type="button" className={styles.voteBtn} onClick={goToDiscordSignIn}>
                    {t("tierList.modalGoSignIn")}
                  </button>
                </>
              )}
            </div>

            <div>
              <p className={styles.buildsLabel}>{t("tierList.modalPublicBuilds")}</p>
              {buildsLoading ? (
                <p className={styles.emptyBuilds}>{t("tierList.modalLoadingBuilds")}</p>
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
                  {t("tierList.modalNoBuilds", {
                    target: t(tab === "weapons" ? "tierList.targetWeapon" : "tierList.targetDescendant"),
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
