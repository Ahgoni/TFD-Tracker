"use client";

import { useState, useRef, useEffect } from "react";
import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";
import { ThemeToggle } from "../../theme-toggle";

interface Props {
  onShare: () => void;
  shareActive?: boolean;
  sharePrivacy: "open" | "link_only";
  onPrivacyChange: (p: "open" | "link_only") => void;
  /** One-time migration: import legacy localStorage backup into cloud state */
  onImportFromBrowser?: () => void | Promise<void>;
}

export function ProfileMenu({ onShare, shareActive, sharePrivacy, onPrivacyChange, onImportFromBrowser }: Props) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const initial = session?.user?.name?.[0]?.toUpperCase() ?? "U";

  return (
    <div className="profile-menu" ref={ref}>
      <button
        className={`profile-trigger${open ? " open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title={session?.user?.name ?? "Account"}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {session?.user?.image ? (
          <img src={session.user.image} alt="" className="profile-avatar" />
        ) : (
          <span className="profile-initial">{initial}</span>
        )}
        <svg className="profile-caret" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div className="profile-dropdown" role="menu">
          {/* Account info */}
          <div className="profile-info">
            {session?.user?.image ? (
              <img src={session.user.image} alt="" />
            ) : (
              <span className="profile-initial-lg">{initial}</span>
            )}
            <div>
              <div className="profile-name">{session?.user?.name ?? "User"}</div>
              <div className="profile-sub">Discord account</div>
            </div>
          </div>

          <div className="profile-sep" />

          {/* Share inventory */}
          <button
            role="menuitem"
            className={`profile-action${shareActive ? " active" : ""}`}
            onClick={() => { onShare(); setOpen(false); }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
            </svg>
            Share my inventory
          </button>

          <div className="profile-sep" />

          {/* Privacy setting */}
          <div className="profile-privacy-section">
            <div className="profile-privacy-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, opacity: 0.6 }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Inventory Privacy
            </div>
            <div className="profile-privacy-opts">
              <button
                className={`privacy-opt${sharePrivacy === "open" ? " active" : ""}`}
                onClick={() => onPrivacyChange("open")}
                title="Friends can view your inventory without a share link"
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
                title="Only people with your share link can view"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                Link Only
              </button>
            </div>
            <p className="profile-privacy-hint">
              {sharePrivacy === "open"
                ? "Friends who add you by username can view your inventory."
                : "Only people with your share link can see your inventory."}
            </p>
          </div>

          <div className="profile-sep" />

          {onImportFromBrowser && (
            <>
              <button
                role="menuitem"
                className="profile-action"
                onClick={() => {
                  void onImportFromBrowser();
                  setOpen(false);
                }}
                title="If you used TFD Tracker before cloud save, data may still be in this browser"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Import from browser backup
              </button>
              <div className="profile-sep" />
            </>
          )}

          {/* Theme toggle */}
          <div style={{ padding: "0.4rem 0.75rem" }}>
            <ThemeToggle />
          </div>

          <div className="profile-sep" />

          {/* Sign out */}
          <button
            role="menuitem"
            className="profile-action danger"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
