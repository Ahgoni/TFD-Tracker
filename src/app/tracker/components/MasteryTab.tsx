"use client";

import type { TrackerState } from "../tracker-client";

interface Props {
  state: TrackerState;
}

const MASTERY_REWARDS: Array<{
  rank: number;
  descCap: number;
  weapCap: number;
  presets: number;
  inventory: number;
  storage: number;
}> = [
  { rank: 1,  descCap: 25, weapCap: 25, presets: 1,  inventory: 75,  storage: 75  },
  { rank: 2,  descCap: 28, weapCap: 28, presets: 1,  inventory: 76,  storage: 76  },
  { rank: 3,  descCap: 31, weapCap: 31, presets: 2,  inventory: 77,  storage: 77  },
  { rank: 4,  descCap: 34, weapCap: 34, presets: 2,  inventory: 78,  storage: 78  },
  { rank: 5,  descCap: 36, weapCap: 36, presets: 2,  inventory: 80,  storage: 80  },
  { rank: 6,  descCap: 38, weapCap: 38, presets: 3,  inventory: 82,  storage: 82  },
  { rank: 7,  descCap: 40, weapCap: 40, presets: 3,  inventory: 84,  storage: 84  },
  { rank: 8,  descCap: 42, weapCap: 42, presets: 3,  inventory: 86,  storage: 86  },
  { rank: 9,  descCap: 43, weapCap: 43, presets: 4,  inventory: 88,  storage: 88  },
  { rank: 10, descCap: 44, weapCap: 44, presets: 4,  inventory: 90,  storage: 90  },
  { rank: 11, descCap: 45, weapCap: 45, presets: 4,  inventory: 92,  storage: 92  },
  { rank: 12, descCap: 46, weapCap: 46, presets: 5,  inventory: 94,  storage: 94  },
  { rank: 13, descCap: 46, weapCap: 47, presets: 5,  inventory: 96,  storage: 96  },
  { rank: 14, descCap: 47, weapCap: 47, presets: 5,  inventory: 98,  storage: 98  },
  { rank: 15, descCap: 47, weapCap: 48, presets: 6,  inventory: 100, storage: 100 },
  { rank: 16, descCap: 48, weapCap: 48, presets: 6,  inventory: 103, storage: 103 },
  { rank: 17, descCap: 48, weapCap: 49, presets: 6,  inventory: 106, storage: 106 },
  { rank: 18, descCap: 49, weapCap: 49, presets: 7,  inventory: 109, storage: 109 },
  { rank: 19, descCap: 49, weapCap: 50, presets: 7,  inventory: 112, storage: 112 },
  { rank: 20, descCap: 50, weapCap: 50, presets: 7,  inventory: 115, storage: 115 },
  { rank: 21, descCap: 50, weapCap: 50, presets: 8,  inventory: 118, storage: 118 },
  { rank: 22, descCap: 50, weapCap: 50, presets: 8,  inventory: 121, storage: 121 },
  { rank: 23, descCap: 50, weapCap: 50, presets: 9,  inventory: 124, storage: 124 },
  { rank: 24, descCap: 50, weapCap: 50, presets: 9,  inventory: 127, storage: 127 },
  { rank: 25, descCap: 50, weapCap: 50, presets: 10, inventory: 130, storage: 130 },
  { rank: 26, descCap: 50, weapCap: 50, presets: 10, inventory: 134, storage: 134 },
  { rank: 27, descCap: 50, weapCap: 50, presets: 11, inventory: 138, storage: 138 },
  { rank: 28, descCap: 50, weapCap: 50, presets: 11, inventory: 142, storage: 142 },
  { rank: 29, descCap: 50, weapCap: 50, presets: 11, inventory: 146, storage: 146 },
  { rank: 30, descCap: 50, weapCap: 50, presets: 12, inventory: 150, storage: 150 },
  { rank: 31, descCap: 50, weapCap: 50, presets: 12, inventory: 155, storage: 155 },
  { rank: 32, descCap: 50, weapCap: 50, presets: 13, inventory: 160, storage: 160 },
  { rank: 33, descCap: 50, weapCap: 50, presets: 13, inventory: 165, storage: 165 },
  { rank: 34, descCap: 50, weapCap: 50, presets: 14, inventory: 170, storage: 170 },
  { rank: 35, descCap: 50, weapCap: 50, presets: 14, inventory: 175, storage: 175 },
  { rank: 36, descCap: 50, weapCap: 50, presets: 15, inventory: 180, storage: 180 },
  { rank: 37, descCap: 50, weapCap: 50, presets: 15, inventory: 185, storage: 185 },
  { rank: 38, descCap: 50, weapCap: 50, presets: 16, inventory: 190, storage: 190 },
  { rank: 39, descCap: 50, weapCap: 50, presets: 16, inventory: 195, storage: 195 },
  { rank: 40, descCap: 50, weapCap: 50, presets: 17, inventory: 200, storage: 200 },
];

/**
 * Rough mastery rank estimation based on collection progress.
 * Each unique descendant owned = ~2.5% of a rank, each weapon acquired = ~1% of a rank.
 * This is an approximation since Nexon hasn't published exact XP tables.
 */
function estimateMasteryRank(ownedDescendants: number, acquiredWeapons: number): number {
  const descPoints = ownedDescendants * 2.5;
  const weapPoints = acquiredWeapons * 1.0;
  const totalPoints = descPoints + weapPoints;
  return Math.min(40, Math.max(1, Math.floor(totalPoints / 4) + 1));
}

function ProgressRing({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const r = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);

  return (
    <div className="mastery-ring-card">
      <svg viewBox="0 0 100 100" className="mastery-ring-svg">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text x="50" y="46" textAnchor="middle" className="mastery-ring-value">{value}</text>
        <text x="50" y="60" textAnchor="middle" className="mastery-ring-max">/ {max}</text>
      </svg>
      <span className="mastery-ring-label">{label}</span>
    </div>
  );
}

export function MasteryTab({ state }: Props) {
  const ownedDescendants = (state.descendants ?? []).filter((d) => d.owned).length;
  const totalDescendants = (state.descendants ?? []).length;
  const acquiredWeapons = (state.weapons ?? []).filter((w) => w.acquired).length;
  const totalWeapons = (state.weapons ?? []).length;
  const totalReactors = (state.reactors ?? []).length;

  const estimatedRank = estimateMasteryRank(ownedDescendants, acquiredWeapons);
  const currentRewards = MASTERY_REWARDS[estimatedRank - 1] ?? MASTERY_REWARDS[0];
  const pctToMax = Math.min(100, Math.round((estimatedRank / 40) * 100));

  const missingDescendants = (state.descendants ?? []).filter((d) => !d.owned).sort((a, b) => a.name.localeCompare(b.name));
  const missingWeapons = (state.weapons ?? []).filter((w) => !w.acquired).length;

  return (
    <div className="mastery-page">
      {/* Rank header */}
      <section className="mastery-hero">
        <div className="mastery-rank-display">
          <div className="mastery-rank-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="mastery-star">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className="mastery-rank-number">{estimatedRank}</span>
          </div>
          <div className="mastery-rank-info">
            <h2 className="mastery-rank-title">Mastery Rank {estimatedRank}</h2>
            <p className="mastery-rank-sub">Estimated from your collection progress</p>
            <div className="mastery-progress-bar">
              <div className="mastery-progress-fill" style={{ width: `${pctToMax}%` }} />
            </div>
            <p className="mastery-progress-label">{pctToMax}% to max rank (40)</p>
          </div>
        </div>
      </section>

      {/* Collection rings */}
      <section className="mastery-rings">
        <ProgressRing value={ownedDescendants} max={totalDescendants} label="Descendants Owned" color="#00c8f0" />
        <ProgressRing value={acquiredWeapons} max={totalWeapons} label="Weapons Acquired" color="#a855f7" />
        <ProgressRing value={totalReactors} max={totalReactors || 1} label="Reactors Logged" color="#f59e0b" />
      </section>

      {/* Current rank rewards */}
      <section className="mastery-current-rewards">
        <h3>Your Rank {estimatedRank} Rewards</h3>
        <div className="mastery-reward-chips">
          <div className="mastery-reward-chip">
            <span className="mastery-reward-value">{currentRewards.descCap}</span>
            <span className="mastery-reward-label">Desc. Module Cap</span>
          </div>
          <div className="mastery-reward-chip">
            <span className="mastery-reward-value">{currentRewards.weapCap}</span>
            <span className="mastery-reward-label">Weap. Module Cap</span>
          </div>
          <div className="mastery-reward-chip">
            <span className="mastery-reward-value">{currentRewards.presets}</span>
            <span className="mastery-reward-label">Preset Slots</span>
          </div>
          <div className="mastery-reward-chip">
            <span className="mastery-reward-value">{currentRewards.inventory}</span>
            <span className="mastery-reward-label">Inventory Slots</span>
          </div>
          <div className="mastery-reward-chip">
            <span className="mastery-reward-value">{currentRewards.storage}</span>
            <span className="mastery-reward-label">Storage Slots</span>
          </div>
        </div>
      </section>

      {/* Missing descendants */}
      {missingDescendants.length > 0 && (
        <section className="mastery-missing">
          <h3>Missing Descendants ({missingDescendants.length})</h3>
          <div className="mastery-missing-grid">
            {missingDescendants.map((d) => (
              <div key={d.name} className="mastery-missing-item">
                <img src={d.portrait} alt={d.name} className="mastery-missing-img" />
                <span>{d.name}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Missing weapons count */}
      {missingWeapons > 0 && (
        <section className="mastery-missing">
          <h3>Missing Weapons</h3>
          <p className="muted">
            You still need <strong>{missingWeapons}</strong> more weapon{missingWeapons !== 1 ? "s" : ""} to complete your collection.
          </p>
        </section>
      )}

      {/* Full rewards table */}
      <section className="mastery-table-section">
        <h3>Mastery Rank Rewards Table</h3>
        <div className="table-wrap">
          <table className="mastery-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Desc. Module Cap</th>
                <th>Weap. Module Cap</th>
                <th>Preset Slots</th>
                <th>Inventory</th>
                <th>Storage</th>
              </tr>
            </thead>
            <tbody>
              {MASTERY_REWARDS.map((row) => (
                <tr key={row.rank} className={row.rank === estimatedRank ? "mastery-current-row" : row.rank < estimatedRank ? "mastery-past-row" : ""}>
                  <td>
                    <span className={`mastery-rank-cell${row.rank === estimatedRank ? " current" : ""}`}>
                      {row.rank}
                    </span>
                  </td>
                  <td>{row.descCap}</td>
                  <td>{row.weapCap}</td>
                  <td>{row.presets}</td>
                  <td>{row.inventory}</td>
                  <td>{row.storage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
