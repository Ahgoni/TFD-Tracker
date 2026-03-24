"use client";

/** Same shape as equipped-set aggregation from Nexon catalog or external-components.json */
export type ExternalSetBonusSet = {
  setName: string;
  count: number;
  twoEffect: string;
  fourEffect: string;
};

/**
 * 2-piece / 4-piece set bonuses — shared by Player Lookup (Components) and Builds planner
 * so copy and styling stay aligned.
 */
export function ExternalSetBonusesBanner({ sets }: { sets: ExternalSetBonusSet[] }) {
  const active = sets.filter((s) => s.count >= 2);
  if (active.length === 0) return null;
  return (
    <div className="ext-set-bonuses-wrap">
      {active.map((s) => (
        <div key={s.setName} className="ext-set-banner">
          <strong>
            {s.setName} — {s.count}/4 equipped
          </strong>
          {s.count >= 2 && s.twoEffect ? (
            <span className="ext-set-tier">
              <strong>2-piece:</strong> {s.twoEffect}
            </span>
          ) : null}
          {s.count >= 4 && s.fourEffect ? (
            <span className="ext-set-tier">
              <strong>4-piece:</strong> {s.fourEffect}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
