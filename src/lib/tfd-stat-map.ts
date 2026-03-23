/**
 * Nexon stat-ID → human name mapping and display-group definitions
 * for the build planner stat sheet.
 *
 * Source: https://open.api.nexon.com/static/tfd/meta/en/stat.json
 */

export const STAT_NAMES: Record<string, string> = {
  "105000001": "Max HP",
  "105000005": "Max Range",
  "105000006": "Hip Fire Accuracy",
  "105000018": "Movement Speed",
  "105000019": "Sprint Speed",
  "105000021": "Rounds per Magazine",
  "105000023": "Fire Rate",
  "105000024": "Max MP",
  "105000025": "Max Shield",
  "105000026": "Firearm ATK",
  "105000029": "DEF",
  "105000030": "Firearm Critical Hit Rate",
  "105000031": "Firearm Critical Hit Damage",
  "105000032": "Shell Capacity",
  "105000035": "Weak Point Damage",
  "105000036": "Aimed Shot Accuracy",
  "105000052": "Reload Time Modifier",
  "105000054": "Effective Range (Drop-off start)",
  "105000055": "Effective Range (Drop-off end)",
  "105000056": "ATK Drop-off Modifier",
  "105000062": "Fire Resistance",
  "105000063": "Chill Resistance",
  "105000064": "Electric Resistance",
  "105000065": "Toxin Resistance",
  "105000066": "Critical Hit Resistance",
  "105000069": "Burst",
  "105000070": "Crush",
  "105000071": "Pierce",
  "105000075": "Penetration",
  "105000095": "Reload Time",
  "105000100": "HP Recovery Out of Combat",
  "105000101": "MP Recovery Out of Combat",
  "105000102": "Shield Recovery Out of Combat",
  "105000103": "HP Recovery In Combat",
  "105000104": "MP Recovery In Combat",
  "105000105": "Shield Recovery In Combat",
  "105000116": "Recoil",
  "105000117": "Skill Cooldown",
  "105000118": "Skill Cost",
  "105000119": "Skill Power Modifier",
  "105000127": "Weapon Change Speed",
  "105000139": "Firearm DMG Modifier",
  "105000140": "Outgoing DMG Modifier",
  "105000141": "Incoming Damage Modifier",
  "105000145": "Skill Power",
  "105000146": "Base Skill Power boost ratio",
  "105000147": "Non-Attribute Skill Power Boost Ratio",
  "105000148": "Fire Skill Power Boost Ratio",
  "105000149": "Chill Skill Power Boost Ratio",
  "105000150": "Electric Skill Power Boost Ratio",
  "105000151": "Toxic Skill Power Boost Ratio",
  "105000152": "Fusion Skill Power Boost Ratio",
  "105000153": "Singular Skill Power Boost Ratio",
  "105000154": "Dimension Skill Power Boost Ratio",
  "105000155": "Tech Skill Power Boost Ratio",
  "105000165": "Skill Critical Hit Rate",
  "105000166": "Skill Critical Hit Damage",
  "105000168": "Skill DEF",
  "105000169": "Non-Attribute Resistance",
  "105000170": "Attribute Status Effect Trigger Rate",
  "105000194": "Beam Rifle Charge Gain Speed",
  "105000195": "Beam Rifle Charge Depletion Speed",
  "105000227": "Multi-Hit Chance",
  "105000229": "Multi-Hit Damage",
};

export interface StatGroup {
  label: string;
  stats: string[];
}

export const DESCENDANT_STAT_GROUPS: StatGroup[] = [
  {
    label: "Survivability",
    stats: [
      "Max HP",
      "Max Shield",
      "DEF",
      "Skill DEF",
      "Incoming Damage Modifier",
      "Fire Resistance",
      "Chill Resistance",
      "Electric Resistance",
      "Toxin Resistance",
      "Non-Attribute Resistance",
      "Critical Hit Resistance",
    ],
  },
  {
    label: "Offense",
    stats: [
      "Skill Power",
      "Skill Power Modifier",
      "Skill Critical Hit Rate",
      "Skill Critical Hit Damage",
      "Firearm DMG Modifier",
      "Outgoing DMG Modifier",
    ],
  },
  {
    label: "Utility",
    stats: [
      "Max MP",
      "Movement Speed",
      "Sprint Speed",
      "Skill Cooldown",
      "Skill Cost",
      "Weapon Change Speed",
      "HP Recovery Out of Combat",
      "Shield Recovery Out of Combat",
      "MP Recovery Out of Combat",
      "HP Recovery In Combat",
      "Shield Recovery In Combat",
      "MP Recovery In Combat",
    ],
  },
];

export const WEAPON_STAT_GROUPS: StatGroup[] = [
  {
    label: "Offense",
    stats: [
      "Firearm ATK",
      "Firearm Critical Hit Rate",
      "Firearm Critical Hit Damage",
      "Weak Point Damage",
      "Fire Rate",
      "Multi-Hit Chance",
      "Multi-Hit Damage",
      "Attribute Status Effect Trigger Rate",
    ],
  },
  {
    label: "Handling",
    stats: [
      "Rounds per Magazine",
      "Reload Time",
      "Recoil",
      "Hip Fire Accuracy",
      "Aimed Shot Accuracy",
      "Max Range",
      "Effective Range (Drop-off start)",
      "Effective Range (Drop-off end)",
    ],
  },
];

/** Short display names for stat sheet (truncate verbose Nexon labels). */
export const STAT_SHORT: Record<string, string> = {
  "Firearm Critical Hit Rate": "Crit Rate",
  "Firearm Critical Hit Damage": "Crit DMG",
  "Firearm DMG Modifier": "Firearm DMG",
  "Skill Power Modifier": "Skill Power %",
  "Skill Critical Hit Rate": "Skill Crit Rate",
  "Skill Critical Hit Damage": "Skill Crit DMG",
  "Outgoing DMG Modifier": "Outgoing DMG",
  "Incoming Damage Modifier": "Incoming DMG",
  "Attribute Status Effect Trigger Rate": "Status Trigger",
  "Effective Range (Drop-off start)": "Range (start)",
  "Effective Range (Drop-off end)": "Range (end)",
  "HP Recovery Out of Combat": "HP Regen (OOC)",
  "Shield Recovery Out of Combat": "Shield Regen (OOC)",
  "MP Recovery Out of Combat": "MP Regen (OOC)",
  "HP Recovery In Combat": "HP Regen (IC)",
  "Shield Recovery In Combat": "Shield Regen (IC)",
  "MP Recovery In Combat": "MP Regen (IC)",
  "Reload Time Modifier": "Reload Speed",
  "Weapon Change Speed": "Swap Speed",
  "Non-Attribute Resistance": "Non-Attr Resist",
  "Critical Hit Resistance": "Crit Resist",
  "Rounds per Magazine": "Magazine",
  "ATK Drop-off Modifier": "ATK Drop-off",
  "Hip Fire Accuracy": "Hip Accuracy",
  "Aimed Shot Accuracy": "Aim Accuracy",
};

export function shortStatName(name: string): string {
  return STAT_SHORT[name] ?? name;
}
