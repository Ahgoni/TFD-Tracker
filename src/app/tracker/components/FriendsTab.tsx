"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface SavedFriend {
  id: string;
  token: string;
  nickname: string;
  createdAt: string;
}

interface Props {
  sharePrivacy: "open" | "link_only";
  onPrivacyChange: (p: "open" | "link_only") => void;
  shareToken: string | null;
  onGenerateShare: () => void;
}

/**
 * Parses a pasted URL or raw value into a storable token:
 * - /share/user/USERID  → "user:USERID"
 * - /share/TOKEN        → "TOKEN"
 * - raw TOKEN           → "TOKEN"
 */
function parseInput(input: string): string {
  const trimmed = input.trim();
  const userMatch = trimmed.match(/\/share\/user\/([a-zA-Z0-9_-]+)/);
  if (userMatch) return `user:${userMatch[1]}`;
  const tokenMatch = trimmed.match(/\/share\/([a-zA-Z0-9_-]+)/);
  if (tokenMatch) return tokenMatch[1];
  return trimmed;
}

function friendViewUrl(token: string, origin: string): string {
  if (token.startsWith("user:")) return `${origin}/share/user/${token.slice(5)}`;
  return `${origin}/share/${token}`;
}

export function FriendsTab({ sharePrivacy, onPrivacyChange, shareToken, onGenerateShare }: Props) {
  const { data: session } = useSession();
  const [friends, setFriends] = useState<SavedFriend[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [nickname, setNickname] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState<"profile" | "share" | null>(null);

  const userId = (session?.user as { id?: string } | undefined)?.id;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    fetch("/api/friends")
      .then((r) => r.json())
      .then((d) => { setFriends(d.friends ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const copyText = useCallback((text: string, which: "profile" | "share") => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    });
  }, []);

  async function addFriend(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const token = parseInput(input);
    if (!token) { setError("Paste a valid share link or profile link."); return; }
    if (!nickname.trim()) { setError("Give this friend a nickname."); return; }
    setAdding(true);
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, nickname: nickname.trim() }),
    });
    const data = await res.json();
    setAdding(false);
    if (!res.ok) { setError(data.error ?? "Failed to add friend."); return; }
    setFriends((prev) => {
      const exists = prev.find((f) => f.token === token);
      if (exists) return prev.map((f) => f.token === token ? { ...f, nickname: nickname.trim() } : f);
      return [...prev, data.friend];
    });
    setSuccess(`Added ${nickname.trim()} — you can view their inventory below.`);
    setInput("");
    setNickname("");
  }

  async function removeFriend(id: string) {
    await fetch(`/api/friends/${id}`, { method: "DELETE" });
    setFriends((prev) => prev.filter((f) => f.id !== id));
  }

  const profileUrl = userId ? `${origin}/share/user/${userId}` : null;
  const shareUrl = shareToken ? `${origin}/share/${shareToken}` : null;

  return (
    <div className="friends-page">

      {/* ── Your Inventory Link ─────────────────────────────────── */}
      <section className="panel" style={{ borderLeft: "3px solid var(--accent)" }}>
        <h3 className="friends-add-title" style={{ marginBottom: "1rem" }}>Your Inventory Link</h3>

        {/* Privacy toggle */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <button
            className={`privacy-opt${sharePrivacy === "open" ? " active" : ""}`}
            onClick={() => onPrivacyChange("open")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Open to Friends
          </button>
          <button
            className={`privacy-opt${sharePrivacy === "link_only" ? " active" : ""}`}
            onClick={() => onPrivacyChange("link_only")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Link Only
          </button>
        </div>

        {sharePrivacy === "open" && profileUrl && (
          <div style={{ marginBottom: "1rem" }}>
            <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "0.45rem" }}>
              Your permanent profile link — friends can paste this to view your inventory without a share token:
            </p>
            <div className="share-link-row" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input readOnly value={profileUrl} onClick={(e) => (e.target as HTMLInputElement).select()} style={{ flex: 1 }} />
              <button
                className="filter-chip"
                style={{ fontSize: "0.76rem", flexShrink: 0 }}
                onClick={() => copyText(profileUrl, "profile")}
              >
                {copied === "profile" ? "✓ Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {sharePrivacy === "link_only" && (
          <div style={{ marginBottom: "1rem" }}>
            {shareUrl ? (
              <>
                <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "0.45rem" }}>
                  Your revokable share link — only people with this link can view your inventory:
                </p>
                <div className="share-link-row" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input readOnly value={shareUrl} onClick={(e) => (e.target as HTMLInputElement).select()} style={{ flex: 1 }} />
                  <button
                    className="filter-chip"
                    style={{ fontSize: "0.76rem", flexShrink: 0 }}
                    onClick={() => copyText(shareUrl, "share")}
                  >
                    {copied === "share" ? "✓ Copied!" : "Copy"}
                  </button>
                </div>
              </>
            ) : (
              <div>
                <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "0.6rem" }}>
                  Generate a revokable share link to give to friends:
                </p>
                <button className="btn btn-primary btn-sm" onClick={onGenerateShare}>
                  Generate Share Link
                </button>
              </div>
            )}
          </div>
        )}

        <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: 0 }}>
          {sharePrivacy === "open"
            ? "Anyone who adds your profile link can view your inventory. Switch to \"Link Only\" for a revokable token."
            : "Only friends with your share link can view. Switch to \"Open\" for a permanent profile link."}
        </p>
      </section>

      {/* ── Add friend form ─────────────────────────────────────── */}
      <section className="panel">
        <h3 className="friends-add-title">Add a Friend</h3>
        <p style={{ fontSize: "0.84rem", color: "var(--muted)", marginBottom: "1rem" }}>
          Ask your friend to copy their inventory link from the Friends tab or profile menu and paste it below.
          You can paste either a <strong style={{ color: "var(--accent)" }}>profile link</strong> (<code>/share/user/…</code>) or a <strong style={{ color: "var(--accent2)" }}>share link</strong> (<code>/share/…</code>).
        </p>
        <form className="friends-add-form" onSubmit={addFriend}>
          <label className="friends-label" style={{ flex: 2 }}>
            Friend&apos;s link (profile URL or share link)
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="https://…/share/user/abc  or  https://…/share/xyz123"
              className="friends-input"
            />
          </label>
          <label className="friends-label">
            Nickname
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. CoolGamer99"
              maxLength={40}
              className="friends-input friends-input-sm"
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={adding} style={{ alignSelf: "end" }}>
            {adding ? "Adding…" : "Add Friend"}
          </button>
        </form>
        {error && <p className="friends-msg friends-msg-error">{error}</p>}
        {success && <p className="friends-msg friends-msg-ok">{success}</p>}
      </section>

      {/* ── Friends list ────────────────────────────────────────── */}
      <section className="friends-list-section">
        <h3 className="welcome-section-heading">Saved Friends ({friends.length})</h3>
        {loading ? (
          <p className="friends-empty-text">Loading…</p>
        ) : friends.length === 0 ? (
          <div className="welcome-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <p>No friends added yet. Copy a friend&apos;s link and paste it above to get started.</p>
          </div>
        ) : (
          <ul className="friends-list">
            {friends.map((f) => {
              const isProfileLink = f.token.startsWith("user:");
              const viewUrl = friendViewUrl(f.token, origin);
              return (
                <li key={f.id} className="friends-item">
                  <div className="friends-item-avatar">
                    {f.nickname[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="friends-item-info">
                    <span className="friends-item-name">{f.nickname}</span>
                    <span className="friends-item-token">
                      {isProfileLink ? "Profile link" : "Share link"} · added {new Date(f.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="friends-item-actions">
                    <Link
                      href={viewUrl}
                      target="_blank"
                      rel="noopener"
                      className="btn btn-ghost btn-sm"
                    >
                      View Inventory ↗
                    </Link>
                    <button
                      className="btn btn-sm"
                      style={{ background: "transparent", borderColor: "rgba(255,68,102,0.3)", color: "#ff7a90" }}
                      onClick={() => removeFriend(f.id)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
