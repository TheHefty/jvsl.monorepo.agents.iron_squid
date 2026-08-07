/**
 * Mock data for the first UI pass.
 *
 * The real roster is generated from Leanny/splat3 — every row with
 * `Type == "Versus"` minus the Side Order replicas, which is 162 weapons at
 * game version 1120. That generator is a later pass; what matters here is that
 * nothing downstream hardcodes a count, so swapping this module for real data
 * changes no component.
 */

export type WeaponState = 'cleared' | 'current' | 'untouched';

export type Weapon = {
  id: string;
  name: string;
  className: string;
  state: WeaponState;
};

export type GearSlot = 'head' | 'body' | 'shoes';

export type Draw = {
  weapon: Weapon;
  gear: Record<GearSlot, string>;
};

export type LogEntry = {
  id: string;
  kind: 'win' | 'death';
  weapon: string;
  detail: string;
  when: string;
};

const BASE_NAMES = [
  ['Sploosh-o-matic', 'Shooter'],
  ['Splattershot Jr.', 'Shooter'],
  ['Splash-o-matic', 'Shooter'],
  ['Aerospray MG', 'Shooter'],
  ["N-ZAP '85", 'Shooter'],
  ['Splattershot', 'Shooter'],
  ['.52 Gal', 'Shooter'],
  ['Splattershot Pro', 'Shooter'],
  ['.96 Gal', 'Shooter'],
  ['Jet Squelcher', 'Shooter'],
  ['Splattershot Nova', 'Shooter'],
  ['L-3 Nozzlenose', 'Shooter'],
  ['H-3 Nozzlenose', 'Shooter'],
  ['Squeezer', 'Shooter'],
  ['Luna Blaster', 'Blaster'],
  ['Blaster', 'Blaster'],
  ['Range Blaster', 'Blaster'],
  ['Clash Blaster', 'Blaster'],
  ['Rapid Blaster', 'Blaster'],
  ['S-BLAST 92', 'Blaster'],
  ['Carbon Roller', 'Roller'],
  ['Splat Roller', 'Roller'],
  ['Dynamo Roller', 'Roller'],
  ['Flingza Roller', 'Roller'],
  ['Big Swig Roller', 'Roller'],
  ['Inkbrush', 'Brush'],
  ['Octobrush', 'Brush'],
  ['Painbrush', 'Brush'],
  ['Splat Charger', 'Charger'],
  ['Splatterscope', 'Charger'],
  ['E-liter 4K', 'Charger'],
  ['Bamboozler 14 Mk I', 'Charger'],
  ['Goo Tuber', 'Charger'],
  ['Snipewriter 5H', 'Charger'],
  ['Slosher', 'Slosher'],
  ['Tri-Slosher', 'Slosher'],
  ['Sloshing Machine', 'Slosher'],
  ['Bloblobber', 'Slosher'],
  ['Explosher', 'Slosher'],
  ['Dread Wringer', 'Slosher'],
  ['Mini Splatling', 'Splatling'],
  ['Heavy Splatling', 'Splatling'],
  ['Hydra Splatling', 'Splatling'],
  ['Ballpoint Splatling', 'Splatling'],
  ['Nautilus 47', 'Splatling'],
  ['Heavy Edit Splatling', 'Splatling'],
  ['Dapple Dualies', 'Dualies'],
  ['Splat Dualies', 'Dualies'],
  ['Glooga Dualies', 'Dualies'],
  ['Dualie Squelchers', 'Dualies'],
  ['Dark Tetra Dualies', 'Dualies'],
  ['Douser Dualies FF', 'Dualies'],
  ['Splat Brella', 'Brella'],
  ['Tenta Brella', 'Brella'],
  ['Undercover Brella', 'Brella'],
  ['Recycled Brella 24 Mk I', 'Brella'],
  ['Tri-Stringer', 'Stringer'],
  ['REEF-LUX 450', 'Stringer'],
  ['Wellstring V', 'Stringer'],
  ['Splatana Stamper', 'Splatana'],
  ['Splatana Wiper', 'Splatana'],
  ['Mint Decavitator', 'Splatana']
] as const;

/** Kit suffixes, mirroring how Splatoon ships second and third kits. */
const KITS = ['', 'Custom', 'Deco'] as const;

export const TOTAL_WEAPONS = 162;

function buildRoster(): Omit<Weapon, 'state'>[] {
  const out: Omit<Weapon, 'state'>[] = [];
  for (const kit of KITS) {
    for (const [name, className] of BASE_NAMES) {
      if (out.length >= TOTAL_WEAPONS) break;
      out.push({
        id: `${name}-${kit || 'base'}`.replace(/\s+/g, '-').toLowerCase(),
        name: kit ? `${kit} ${name}` : name,
        className
      });
    }
  }
  return out;
}

const ROSTER = buildRoster();

export const CLEARED_COUNT = 40;

export function getWeapons(): Weapon[] {
  return ROSTER.map((w, i) => ({
    ...w,
    state:
      i < CLEARED_COUNT
        ? 'cleared'
        : i === CLEARED_COUNT
          ? 'current'
          : 'untouched'
  }));
}

export function getCurrentDraw(): Draw {
  const weapons = getWeapons();
  const weapon = weapons.find((w) => w.state === 'current') ?? weapons[0];
  return {
    weapon,
    gear: {
      head: 'Squid Clip-Ons',
      body: 'Retro Gamer Jersey',
      shoes: 'Orange Arrows'
    }
  };
}

export const RUN_SUMMARY = {
  number: 7,
  day: 12,
  handle: '@ika_no_9',
  lives: 3,
  maxLives: 5,
  streak: 6,
  personalBest: 62,
  deaths: 6,
  matches: 318,
  startedISO: '2026-07-26',
  totalRuns: 1204,
  completedRuns: 0,
  gearBurned: {head: 40, body: 40, shoes: 40},
  gearTotals: {head: 273, body: 385, shoes: 254}
};

export function getLog(): LogEntry[] {
  return [
    {
      id: '1',
      kind: 'win',
      weapon: 'Nautilus 47',
      detail: 'Tower Control · Hagglefish Market',
      when: '2026-08-02T23:41:00Z'
    },
    {
      id: '2',
      kind: 'win',
      weapon: 'Ballpoint Splatling',
      detail: 'Rainmaker · Eeltail Alley',
      when: '2026-08-02T23:12:00Z'
    },
    {
      id: '3',
      kind: 'death',
      weapon: 'Hydra Splatling',
      detail: 'Life spent. Three left.',
      when: '2026-08-02T22:50:00Z'
    },
    {
      id: '4',
      kind: 'win',
      weapon: 'Mini Splatling',
      detail: 'Splat Zones · Mahi-Mahi Resort',
      when: '2026-08-02T22:22:00Z'
    },
    {
      id: '5',
      kind: 'win',
      weapon: 'Heavy Splatling',
      detail: 'Clam Blitz · Scorch Gorge',
      when: '2026-08-02T21:58:00Z'
    },
    {
      id: '6',
      kind: 'death',
      weapon: 'Dread Wringer',
      detail: 'Life spent. Overtime, 0.2%.',
      when: '2026-08-01T20:14:00Z'
    },
    {
      id: '7',
      kind: 'win',
      weapon: 'Explosher',
      detail: 'Clam Blitz · Undertow Spillway',
      when: '2026-08-01T19:47:00Z'
    },
    {
      id: '8',
      kind: 'win',
      weapon: 'Bloblobber',
      detail: "Tower Control · Museum d'Alfonsino",
      when: '2026-08-01T19:20:00Z'
    }
  ];
}
