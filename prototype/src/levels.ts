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
    note: "Buds need 2 pulses and pass pollen on every time they get some.",
    rows: ["222", "2#2", "222"],
  },
  {
    id: 6, world: 2, name: "Half Open", difficulty: 3, role: "climb: dead-end buds stall", spare: 2,
    note: "A bud fed by a single flower can stall half-open. Try a bee on the bud itself.",
    rows: ["2121", "#.#.", "1212"],
  },
  {
    id: 7, world: 2, name: "Orchard Maze", difficulty: 5, role: "peak: world 2", spare: 2,
    note: "Which tiles really matter? Watch where chains stall.",
    rows: ["12221", "#2212", "22#2#", "#12#1", "21#21"],
  },
  {
    id: 8, world: 2, name: "Breather", difficulty: 3, role: "breather after the peak", spare: 2,
    note: "Take a breath and enjoy the chain.",
    rows: ["1221", "#..#", "1221"],
  },
  {
    id: 9, world: 3, name: "Big Buds", difficulty: 2, role: "valley: 3-pulse buds introduced", spare: 1,
    note: "Big buds need 3 pulses and pass pollen three times. Strong amplifiers!",
    rows: ["333", "3#3", "333"],
  },
  {
    id: 10, world: 3, name: "Night Garden", difficulty: 6, role: "capstone peak", spare: 1,
    note: "Everything you've learned. Take your time.",
    rows: ["211113", ".31211", "2#1332", "1.1113", "1...31"],
  },
];

export const WORLD_NAMES: Record<number, string> = {
  1: "World 1 · Meadow",
  2: "World 2 · Orchard",
  3: "World 3 · Night Garden",
};
