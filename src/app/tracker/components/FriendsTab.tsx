"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";

interface SavedFriend {
  id: string;
  token: string;
  nickname: string;
  createdAt: string;
  lastSeen: string | null;
  friendName: string | null;
  friendImage: string | null;
  friendUsername: string | null;
}

interface Props {
  sharePrivacy: "open" | "link_only";
  onPrivacyChange: (p: "open" | "link_only") => void;
  shareToken: string | null;
  onGenerateShare: () => void;
}

function parseInput(input: string): { type: "username" | "user_id" | "share_token"; value: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const usernamePageMatch = trimmed.match(/\/u\/([a-zA-Z0-9_]+)/);
  if (usernamePageMatch) return { type: "username", value: usernamePageMatch[1].toLowerCase() };

  const userMatch = trimmed.match(/\/share\/user\/([a-zA-Z0-9_-]+)/);
  if (userMatch) return { type: "user_id", value: userMatch[1] };

  const tokenMatch = trimmed.match(/\/share\/([a-zA-Z0-9_-]+)/);
  if (tokenMatch) return { type: "share_token", value: tokenMatch[1] };

  const cleaned = trimmed.replace(/^@/, "").toLowerCase();
  if (/^[a-z][a-z0-9_]{2,19}$/.test(cleaned)) return { type: "username", value: cleaned };

  return null;
}

function friendViewUrl(token: string, origin: string): string {
  if (token.startsWith("user:")) return `${origin}/share/user/${token.slice(5)}`;
  if (token.startsWith("username:")) return `${origin}/u/${token.slice(9)}`;
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
  const [copied, setCopied] = useState<"profile" | "share" | "id" | null>(null);


  const username = (session?.user as Record<string, unknown> | undefined)?.username as string | null;
  const nexonIngameName = (session?.user as Record<string, unknown> | undefined)?.nexonIngameName as string | null;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const profileUrl = username ? `${origin}/u/${username}` : null;
  const shareUrl = shareToken ? `${origin}/share/${shareToken}` : null;

  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);

  const [editingNexon, setEditingNexon] = useState(false);
  const [newNexon, setNewNexon] = useState("");
  const [nexonError, setNexonError] = useState("");
  const [savingNexon, setSavingNexon] = useState(false);

  useEffect(() => {
    fetch("/api/friends")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { setFriends(d.friends ?? []); setLoading(false); })
      .catch(() => setLoading(false));
    const interval = setInterval(() => {
      fetch("/api/friends")
        .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
        .then((d) => setFriends(d.friends ?? []))
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const copyText = useCallback(async (text: string, which: "profile" | "share" | "id") => {
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } else {
      window.prompt("Copy:", text);
    }
  }, []);

  async function saveUsername(e: React.FormEvent) {
    e.preventDefault();
    setUsernameError("");
    setSavingUsername(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: newUsername.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) { setUsernameError(data.error ?? "Failed to save username."); return; }
      setEditingUsername(false);
      window.location.reload();
    } catch {
      setUsernameError("Network error.");
    } finally {
      setSavingUsername(false);
    }
  }

  async function saveNexon(e: React.FormEvent) {
    e.preventDefault();
    setNexonError("");
    setSavingNexon(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nexonIngameName: newNexon.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNexonError(typeof data.error === "string" ? data.error : "Failed to save.");
        return;
      }
      setEditingNexon(false);
      window.location.reload();
    } catch {
      setNexonError("Network error.");
    } finally {
      setSavingNexon(false);
    }
  }

  async function addFriend(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const parsed = parseInput(input);
    if (!parsed) { setError("Enter a username (e.g. @ahgoni) or paste a profile/share link."); return; }
    if (!nickname.trim()) { setError("Give this friend a nickname."); return; }

    setAdding(true);

    try {
      let token: string;

      if (parsed.type === "username") {
        const lookupRes = await fetch(`/api/user/lookup?q=${encodeURIComponent(parsed.value)}`);
        if (!lookupRes.ok) {
          const err = await lookupRes.json();
          setError(err.error ?? `No user found with username @${parsed.value}`);
          setAdding(false);
          return;
        }
        token = `username:${parsed.value}`;
      } else if (parsed.type === "user_id") {
        token = `user:${parsed.value}`;
      } else {
        token = parsed.value;
      }

      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, nickname: nickname.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to add friend."); setAdding(false); return; }

      setFriends((prev) => {
        const exists = prev.find((f) => f.token === token);
        if (exists) return prev.map((f) => f.token === token ? { ...f, nickname: nickname.trim() } : f);
        return [...prev, data.friend];
      });
      setSuccess(`${nickname.trim()} added to your squad!`);
      setInput("");
      setNickname("");
      setTimeout(() => setSuccess(""), 4000);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setAdding(false);
    }
  }

  async function removeFriend(id: string) {
    try {
      const res = await fetch(`/api/friends/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      setFriends((prev) => prev.filter((f) => f.id !== id));
    } catch { /* network error — leave list unchanged */ }
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

      {/* Your Profile ID */}
      <div className="social-your-link-box">
        <div className="social-your-link-header">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13, opacity: 0.7 }}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
          <span>Your Profile ID</span>
          <div className="social-privacy-toggle">
            <button
              className={`social-privacy-btn${sharePrivacy === "open" ? " active" : ""}`}
              onClick={() => onPrivacyChange("open")}
              title="Friends can view without a link"
            >Open to Friends</button>
            <button
              className={`social-privacy-btn${sharePrivacy === "link_only" ? " active" : ""}`}
              onClick={() => onPrivacyChange("link_only")}
              title="Only visible with share link"
            >Link Only</button>
          </div>
        </div>

        {username ? (
          <div className="social-profile-id-row">
            <div className="social-profile-id">
              <span className="social-profile-at">@</span>
              <span className="social-profile-name">{username}</span>
            </div>
            <button className="social-copy-btn" onClick={() => copyText(`@${username}`, "id")}>
              {copied === "id" ? "Copied!" : "Copy ID"}
            </button>
            <button
              className="social-copy-btn"
              style={{ fontSize: "0.72rem" }}
              onClick={() => { setNewUsername(username); setEditingUsername(true); setUsernameError(""); }}
            >Edit</button>
          </div>
        ) : (
          <div className="social-set-username">
            <p className="social-set-username-hint">Set a profile ID so friends can add you by username instead of sharing links.</p>
            <button className="btn btn-primary btn-sm" onClick={() => { setEditingUsername(true); setNewUsername(""); setUsernameError(""); }}>
              Choose Username
            </button>
          </div>
        )}

        {editingUsername && (
          <form className="social-username-form" onSubmit={saveUsername}>
            <div className="social-username-input-wrap">
              <span className="social-username-prefix">@</span>
              <input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="your_username"
                maxLength={20}
                autoFocus
                className="social-field-input"
              />
            </div>
            <div className="social-username-actions">
              <button type="submit" className="btn btn-primary btn-sm" disabled={savingUsername}>
                {savingUsername ? "Saving…" : "Save"}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingUsername(false)}>Cancel</button>
            </div>
            {usernameError && <p className="social-msg social-msg-error">{usernameError}</p>}
            <p className="social-username-rules">3–20 characters · lowercase letters, numbers, underscores · must start with a letter</p>
          </form>
        )}

        {!editingUsername && (
          <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--line)" }}>
            <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: "0.35rem" }}>
              TFD in-game name <span style={{ opacity: 0.85 }}>(optional — shown on your public profile; not verified by Nexon)</span>
            </div>
            {!editingNexon ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600 }}>{nexonIngameName ?? "— not set —"}</span>
                <button
                  type="button"
                  className="social-copy-btn"
                  style={{ fontSize: "0.72rem" }}
                  onClick={() => {
                    setNewNexon(nexonIngameName ?? "");
                    setEditingNexon(true);
                    setNexonError("");
                  }}
                >
                  {nexonIngameName ? "Edit" : "Add"}
                </button>
              </div>
            ) : (
              <form className="social-username-form" onSubmit={saveNexon}>
                <input
                  value={newNexon}
                  onChange={(e) => setNewNexon(e.target.value)}
                  placeholder="Exact in-game name"
                  maxLength={32}
                  autoFocus
                  className="social-field-input"
                  style={{ maxWidth: "18rem" }}
                />
                <div className="social-username-actions">
                  <button type="submit" className="btn btn-primary btn-sm" disabled={savingNexon}>
                    {savingNexon ? "Saving…" : "Save"}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingNexon(false)}>
                    Cancel
                  </button>
                </div>
                {nexonError && <p className="social-msg social-msg-error">{nexonError}</p>}
              </form>
            )}
          </div>
        )}

        {sharePrivacy === "open" && profileUrl && !editingUsername && (
          <div className="social-link-row" style={{ marginTop: "0.5rem" }}>
            <input readOnly value={profileUrl} onClick={(e) => (e.target as HTMLInputElement).select()} />
            <button className="social-copy-btn" onClick={() => copyText(profileUrl, "profile")}>
              {copied === "profile" ? "Copied!" : "Copy Link"}
            </button>
          </div>
        )}

        {sharePrivacy === "link_only" && shareUrl && !editingUsername && (
          <div className="social-link-row" style={{ marginTop: "0.5rem" }}>
            <input readOnly value={shareUrl} onClick={(e) => (e.target as HTMLInputElement).select()} />
            <button className="social-copy-btn" onClick={() => copyText(shareUrl, "share")}>
              {copied === "share" ? "Copied!" : "Copy Link"}
            </button>
          </div>
        )}

        {sharePrivacy === "link_only" && !shareUrl && !editingUsername && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.5rem" }}>
            <p style={{ fontSize: "0.8rem", color: "var(--muted)", flex: 1, margin: 0 }}>
              Generate a share link so friends can view your inventory.
            </p>
            <button className="btn btn-primary btn-sm" onClick={onGenerateShare}>Generate Link</button>
          </div>
        )}

        <p className="social-link-hint">
          {sharePrivacy === "open"
            ? "Friends can add you by username or profile link."
            : "Only people with your exact share link can view."}
        </p>
      </div>

      {/* Add friend form (collapsible) */}
      {showAddForm && (
        <div className="social-add-form-wrap">
          <p className="social-add-intro">
            Add a friend by their <strong>username</strong> (e.g. <code>@void_hunter</code>) or paste their profile/share link.
          </p>
          <form className="social-add-form" onSubmit={addFriend}>
            <div className="social-add-fields">
              <div className="social-field">
                <label className="social-field-label">Username or Link</label>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="@username or https://tfdtracker.gg/u/..."
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
            <p className="social-empty-sub">Share your username with friends and ask them to add you, or click <strong>Add Friend</strong> above.</p>
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

  return (
    <div className="social-friend-row">
      <div className="social-friend-row-left">
        <div className="social-friend-avatar-wrap">
          <FriendAvatar name={friend.friendName ?? friend.nickname} image={friend.friendImage} />
          <StatusDot status={status} />
        </div>
        <div className="social-friend-info">
          <span className="social-friend-name">{friend.nickname}</span>
          <span className="social-friend-discord-name">
            {friend.friendUsername ? `@${friend.friendUsername}` : friend.friendName ?? ""}
          </span>
          <span className="social-friend-meta">
            {status === "online"
              ? "Tracker open"
              : status === "recent"
              ? `Active ${formatLastSeen(friend.lastSeen)}`
              : `Last seen ${formatLastSeen(friend.lastSeen)}`}
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
