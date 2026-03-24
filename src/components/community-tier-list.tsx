"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useI18n } from "@/contexts/i18n-context";
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

function goToDiscordSignIn() {
  if (typeof window === "undefined") return;
  const u = new URL(window.location.href);
  u.hash = "";
  void signIn("discord", { callbackUrl: u.toString() });
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
              <button type="button" className={styles.modalClose} onClick={() => setModal(null)} aria-label={t("tierList.modalClose")}>
                ×
              </button>
            </div>

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
