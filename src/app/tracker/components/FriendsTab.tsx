"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface SavedFriend {
  id: string;
  token: string;
  nickname: string;
  createdAt: string;
  lastSeen: string | null;
  friendName: string | null;
  friendImage: string | null;
}

interface Props {
  sharePrivacy: "open" | "link_only";
  onPrivacyChange: (p: "open" | "link_only") => void;
  shareToken: string | null;
  onGenerateShare: () => void;
}

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

type OnlineStatus = "online" | "recent" | "offline";

function getStatus(lastSeen: string | null): OnlineStatus {
  if (!lastSeen) return "offline";
  const diff = Date.now() - new Date(lastSeen).getTime();
  if (diff < 5 * 60 * 1000) return "online";
  if (diff < 30 * 60 * 1000) return "recent";
  return "offline";
}

function formatLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return "Never";
  const diff = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function StatusDot({ status }: { status: OnlineStatus }) {
  return (
    <span
      className={`social-status-dot social-status-${status}`}
      title={status === "online" ? "Online now" : status === "recent" ? "Recently active" : "Offline"}
    />
  );
}

function FriendAvatar({ name, image }: { name: string | null; image: string | null }) {
  if (image) {
    return <img src={image} alt="" className="social-friend-avatar" />;
  }
  return (
    <div className="social-friend-avatar social-friend-avatar-initial">
      {(name ?? "?")[0]?.toUpperCase()}
    </div>
  );
}

export function FriendsTab({ sharePrivacy, onPrivacyChange, shareToken, onGenerateShare }: Props) {
  const { data: session } = useSession();
  const [friends, setFriends] = useState<SavedFriend[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [input, setInput] = useState("");
  const [nickname, setNickname] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState<"profile" | "share" | null>(null);
  const addFormRef = useRef<HTMLDivElement>(null);

  const userId = (session?.user as { id?: string } | undefined)?.id;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const profileUrl = userId ? `${origin}/share/user/${userId}` : null;
  const shareUrl = shareToken ? `${origin}/share/${shareToken}` : null;

  useEffect(() => {
    fetch("/api/friends")
      .then((r) => r.json())
      .then((d) => { setFriends(d.friends ?? []); setLoading(false); })
      .catch(() => setLoading(false));
    const interval = setInterval(() => {
      fetch("/api/friends")
        .then((r) => r.json())
        .then((d) => setFriends(d.friends ?? []))
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
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
    if (!token) { setError("Paste a valid share or profile link."); return; }
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
    setSuccess(`${nickname.trim()} added to your squad!`);
    setInput("");
    setNickname("");
    setTimeout(() => setSuccess(""), 4000);
  }

  async function removeFriend(id: string) {
    await fetch(`/api/friends/${id}`, { method: "DELETE" });
    setFriends((prev) => prev.filter((f) => f.id !== id));
  }

  const onlineFriends = friends.filter((f) => getStatus(f.lastSeen) === "online");
  const recentFriends = friends.filter((f) => getStatus(f.lastSeen) === "recent");
  const offlineFriends = friends.filter((f) => getStatus(f.lastSeen) === "offline");

  return (
    <div className="social-panel">

      {/* Header bar */}
      <div className="social-header">
        <div className="social-header-left">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="social-header-icon">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span className="social-header-title">SQUAD</span>
          <span className="social-header-count">
            {onlineFriends.length > 0 && (
              <span className="social-count-pill social-count-online">{onlineFriends.length} online</span>
            )}
            <span className="social-count-pill social-count-total">{friends.length} total</span>
          </span>
        </div>
        <button
          className={`social-add-btn${showAddForm ? " active" : ""}`}
          onClick={() => { setShowAddForm((v) => !v); setError(""); setSuccess(""); }}
          title="Add a friend"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
          </svg>
          Add Friend
        </button>
      </div>

      {/* Your link strip */}
      <div className="social-your-link-box">
        <div className="social-your-link-header">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13, opacity: 0.7 }}>
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span>Your Inventory Link</span>
          <div className="social-privacy-toggle">
            <button
              className={`social-privacy-btn${sharePrivacy === "open" ? " active" : ""}`}
              onClick={() => onPrivacyChange("open")}
              title="Friends can view without a link"
            >Open</button>
            <button
              className={`social-privacy-btn${sharePrivacy === "link_only" ? " active" : ""}`}
              onClick={() => onPrivacyChange("link_only")}
              title="Only visible with share link"
            >Link Only</button>
          </div>
        </div>

        {sharePrivacy === "open" && profileUrl ? (
          <div className="social-link-row">
            <input readOnly value={profileUrl} onClick={(e) => (e.target as HTMLInputElement).select()} />
            <button className="social-copy-btn" onClick={() => copyText(profileUrl, "profile")}>
              {copied === "profile" ? "✓" : "Copy"}
            </button>
          </div>
        ) : sharePrivacy === "link_only" && shareUrl ? (
          <div className="social-link-row">
            <input readOnly value={shareUrl} onClick={(e) => (e.target as HTMLInputElement).select()} />
            <button className="social-copy-btn" onClick={() => copyText(shareUrl, "share")}>
              {copied === "share" ? "✓" : "Copy"}
            </button>
          </div>
        ) : sharePrivacy === "link_only" ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.5rem" }}>
            <p style={{ fontSize: "0.8rem", color: "var(--muted)", flex: 1, margin: 0 }}>
              No share link yet. Generate one so friends can view your inventory.
            </p>
            <button className="btn btn-primary btn-sm" onClick={onGenerateShare}>Generate Link</button>
          </div>
        ) : null}

        <p className="social-link-hint">
          {sharePrivacy === "open"
            ? "Friends who paste your profile link can view your inventory."
            : "Only people with your exact share link can view."}
        </p>
      </div>

      {/* Add friend form (collapsible) */}
      {showAddForm && (
        <div className="social-add-form-wrap" ref={addFormRef}>
          <p className="social-add-intro">
            Ask your friend to copy their link from the <strong>Friends</strong> tab and paste it below.
            Accepts both a <em>profile link</em> (<code>/share/user/…</code>) or a <em>share link</em> (<code>/share/…</code>).
          </p>
          <form className="social-add-form" onSubmit={addFriend}>
            <div className="social-add-fields">
              <div className="social-field">
                <label className="social-field-label">Friend&apos;s Link</label>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="https://tfdtracker.gg/share/user/…"
                  className="social-field-input"
                />
              </div>
              <div className="social-field social-field-sm">
                <label className="social-field-label">Nickname</label>
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. Void_Hunter"
                  maxLength={40}
                  className="social-field-input"
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={adding}>
              {adding ? "Adding…" : "Add to Squad"}
            </button>
          </form>
          {error && <p className="social-msg social-msg-error">{error}</p>}
          {success && <p className="social-msg social-msg-ok">{success}</p>}

          <div className="social-discord-note">
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 16, height: 16, flexShrink: 0, color: "#5865f2" }}>
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
            </svg>
            <span>
              Auto-adding Discord friends requires special API access from Discord. For now, share your link above and have them add you manually.
            </span>
          </div>
        </div>
      )}

      {/* Friends list */}
      <div className="social-list">
        {loading ? (
          <div className="social-loading">
            <div className="social-loading-spinner" />
            <span>Loading squad…</span>
          </div>
        ) : friends.length === 0 ? (
          <div className="social-empty-state">
            <svg viewBox="0 0 80 80" fill="none" className="social-empty-icon">
              <circle cx="40" cy="40" r="39" stroke="currentColor" strokeOpacity=".15" strokeWidth="2" />
              <path d="M52 54v-2a10 10 0 0 0-10-10H28a10 10 0 0 0-10 10v2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="35" cy="28" r="8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M58 54v-2a10 10 0 0 0-7.5-9.7M50 20.13a10 10 0 0 1 0 14.74" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <p className="social-empty-title">No squad members yet</p>
            <p className="social-empty-sub">Share your inventory link with friends and ask them to add you, or click <strong>Add Friend</strong> above.</p>
          </div>
        ) : (
          <>
            {onlineFriends.length > 0 && (
              <div className="social-group">
                <div className="social-section-hdr">
                  <StatusDot status="online" />
                  Online — {onlineFriends.length}
                </div>
                {onlineFriends.map((f) => (
                  <FriendRow key={f.id} friend={f} origin={origin} onRemove={removeFriend} />
                ))}
              </div>
            )}

            {recentFriends.length > 0 && (
              <div className="social-group">
                <div className="social-section-hdr">
                  <StatusDot status="recent" />
                  Recently Active — {recentFriends.length}
                </div>
                {recentFriends.map((f) => (
                  <FriendRow key={f.id} friend={f} origin={origin} onRemove={removeFriend} />
                ))}
              </div>
            )}

            {offlineFriends.length > 0 && (
              <div className="social-group">
                <div className="social-section-hdr">
                  <StatusDot status="offline" />
                  Offline — {offlineFriends.length}
                </div>
                {offlineFriends.map((f) => (
                  <FriendRow key={f.id} friend={f} origin={origin} onRemove={removeFriend} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FriendRow({
  friend,
  origin,
  onRemove,
}: {
  friend: SavedFriend;
  origin: string;
  onRemove: (id: string) => void;
}) {
  const status = getStatus(friend.lastSeen);
  const viewUrl = friendViewUrl(friend.token, origin);
  const isProfileLink = friend.token.startsWith("user:");

  return (
    <div className="social-friend-row">
      <div className="social-friend-row-left">
        <div className="social-friend-avatar-wrap">
          <FriendAvatar name={friend.friendName ?? friend.nickname} image={friend.friendImage} />
          <StatusDot status={status} />
        </div>
        <div className="social-friend-info">
          <span className="social-friend-name">{friend.nickname}</span>
          {friend.friendName && friend.friendName !== friend.nickname && (
            <span className="social-friend-discord-name">{friend.friendName}</span>
          )}
          <span className="social-friend-meta">
            {status === "online"
              ? "Tracker open"
              : status === "recent"
              ? `Active ${formatLastSeen(friend.lastSeen)}`
              : `Last seen ${formatLastSeen(friend.lastSeen)}`}
            {" · "}
            {isProfileLink ? "Profile link" : "Share link"}
          </span>
        </div>
      </div>
      <div className="social-friend-row-right">
        <Link
          href={viewUrl}
          target="_blank"
          rel="noopener"
          className="social-view-btn"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
          </svg>
          View
        </Link>
        <button
          className="social-remove-btn"
          onClick={() => onRemove(friend.id)}
          title="Remove from squad"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
