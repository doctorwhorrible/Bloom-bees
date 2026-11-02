import type { LevelDef } from "./engine";

// Hand-made levels following the doc's onboarding + "rolling hills" curve.
// `difficulty` (1-8) is the intended hill height; par is computed by tools/verify.ts.
// Legend: '.' empty, '#' rock, '1' flower (1 pulse), '2' bud (2 pulses), '3' big bud (3 pulses).
export interface LevelMeta extends LevelDef {
  difficulty: number;
  role: string;
}

export const LEVELS: LevelMeta[] = [
  {
    id: 1, world: 1, name: "First Bloom", difficulty: 1, role: "valley: first tap", spare: 3,
    note: "Tap a flower to place a bee. Pollen spreads to every neighbor!",
    rows: ["111", "111", "111"],
  },
  {
    id: 2, world: 1, name: "Stone Wall", difficulty: 2, role: "climb: rocks block pollen", spare: 3,
    note: "Rocks block pollen. Each meadow needs its own bee.",
    rows: ["11#11", "11#11", "11#11"],
  },
  {
    id: 3, world: 1, name: "Rock Garden", difficulty: 3, role: "climb", spare: 3,
    note: "Count the separate meadows. Fewer bees = more stars.",
    rows: ["111#.", "1.1#1", "##.#1", "11.11", "11#1."],
  },
  {
    id: 4, world: 1, name: "Winding Path", difficulty: 4, role: "peak: world 1", spare: 3,
    note: "Twisty fields hide extra meadows. Aim for par!",
    rows: ["111#1", "#.1#1", "11.#1", "1#11.", "1.#11"],
  },
  {
    id: 5, world: 2, name: "First Buds", difficulty: 2, role: "valley: buds introduced", spare: 2,
    note: "Buds need 2 pulses. Pollen never bounces back, so one flower has to reach the bud from both sides.",
    rows: ["11", "12"],
  },
  {
    id: 6, world: 2, name: "Half Open", difficulty: 3, role: "climb: dead-end buds stall", spare: 2,
    note: "One line of flowers leaves the end bud half open. Bee the line, then the bud.",
    rows: ["11112"],
  },
  {
    id: 7, world: 2, name: "Orchard Maze", difficulty: 5, role: "peak: world 2", spare: 2,
    note: "Buds stall where a chain can't reach them twice. Order can matter.",
    rows: ["11.2", "1212", "#.1#", "2121"],
  },
  {
    id: 8, world: 2, name: "Breather", difficulty: 3, role: "breather after the peak", spare: 2,
    note: "Start at a corner and enjoy the chain. The bud is carried along.",
    rows: ["11111", "11121", "11111"],
  },
  {
    id: 9, world: 3, name: "Big Buds", difficulty: 2, role: "valley: 3-pulse buds introduced", spare: 1,
    note: "Big buds need 3 pulses. A corner leaves this one at 2 — then bee the bud. Nothing bounces back.",
    rows: ["111", "131", "111"],
  },
  {
    id: 10, world: 3, name: "Night Garden", difficulty: 6, role: "capstone peak", spare: 1,
    note: "Meadows, buds, and one big bud. Pollen still never bounces back.",
    rows: ["11211", "2#3#1", "12121"],
  },
];

export const WORLD_NAMES: Record<number, string> = {
  1: "World 1 · Meadow",
  2: "World 2 · Orchard",
  3: "World 3 · Night Garden",
};
