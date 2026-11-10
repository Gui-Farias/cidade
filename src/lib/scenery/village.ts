import type { AdminView, PlayerView, PublicPlayer, Status } from "$lib/game/types";

export type Point = { x: number; y: number };
export type Resident = {
  id: string;
  name: string;
  alive: boolean;
  homeSlot: number;
  roommate: number;
  home: Point;
  door: Point;
  entrance: Point;
  gathering: Point;
  route: Point[];
  house: number;
  character: number;
  houseWidth: number;
  sharedWith?: number;
  sharedFrom?: number;
};

export function visibleResidents(view: AdminView | PlayerView | null): PublicPlayer[] {
  if (!view) return [];
  if (view.kind === "admin") return view.players;
  // Rooms opened by an older server may not include the public roster yet.
  // The player's own identity is enough to show their home immediately.
  const roster = view.players ?? [];
  return roster.some((other) => other.id === view.player.id)
    ? roster
    : [...roster, view.player];
}

// The compact village uses six clearings; desktop has room for nine.
// After they fill, residents share a home to avoid overlapping roads.
const villageHomes = 6;
const residentsPerHome = 4;
const firstHomes: Point[] = [
  { x: -465, y: -175 }, { x: 460, y: -180 },
  { x: -665, y: 120 }, { x: 655, y: 130 },
  { x: -445, y: 420 }, { x: 445, y: 425 },
  { x: -700, y: -115 }, { x: 700, y: -115 },
  { x: 0, y: 425 }, { x: 185, y: 510 },
  { x: -925, y: -260 }, { x: 940, y: -185 },
  { x: -900, y: 400 }, { x: 900, y: 435 },
];
type RoadShape = { early: number; late: number; firstControl: number; secondControl: number };
const villageRoadShapes: RoadShape[] = [
  { early: -130, late: -40, firstControl: 0.27, secondControl: 0.70 },
  { early: 60, late: 125, firstControl: 0.34, secondControl: 0.76 },
  { early: 105, late: 20, firstControl: 0.22, secondControl: 0.68 },
  { early: -30, late: -115, firstControl: 0.32, secondControl: 0.77 },
  { early: -105, late: 15, firstControl: 0.24, secondControl: 0.73 },
  { early: 80, late: -10, firstControl: 0.31, secondControl: 0.69 },
  { early: 90, late: 115, firstControl: 0.27, secondControl: 0.78 },
  { early: -130, late: -60, firstControl: 0.35, secondControl: 0.72 },
  { early: -40, late: 50, firstControl: 0.30, secondControl: 0.71 },
];

// Staggered gathering places leave room for sprites and their nameplates.
// A fixed slot keeps everyone in place when another player joins or leaves.
const gatheringSpots: Point[] = [
  { x: -208, y: -160 }, { x: 206, y: 160 },
  { x: 206, y: -52 }, { x: -208, y: 54 },
  { x: -74, y: -54 }, { x: 76, y: 56 },
  { x: 72, y: -160 }, { x: -74, y: 162 },
  { x: -208, y: -52 }, { x: 208, y: 54 },
  { x: -74, y: -160 }, { x: 76, y: 162 },
  { x: 208, y: -160 }, { x: -208, y: 160 },
  { x: 76, y: -54 }, { x: -74, y: 56 },
];

function hash(value: string) {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) {
    result ^= value.charCodeAt(i);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function homeAt(index: number): Point {
  if (index < firstHomes.length) return firstHomes[index];
  const outer = index - firstHomes.length;
  const ring = Math.floor(outer / 16);
  const angle = (outer % 16) / 16 * Math.PI * 2 - Math.PI / 2;
  return { x: Math.cos(angle) * (1180 + ring * 310), y: Math.sin(angle) * (660 + ring * 250) };
}

function homeFor(index: number, homeCount: number) {
  const firstVillageCapacity = homeCount * residentsPerHome;
  return index < firstVillageCapacity
    ? { homeSlot: index % homeCount, roommate: Math.floor(index / homeCount) }
    : { homeSlot: homeCount + Math.floor((index - firstVillageCapacity) / residentsPerHome), roommate: (index - firstVillageCapacity) % residentsPerHome };
}

function gatheringAt(index: number): Point {
  if (index < gatheringSpots.length) return gatheringSpots[index];
  const outer = index - gatheringSpots.length;
  const ring = Math.floor(outer / 12);
  const angle = -Math.PI / 2 + outer % 12 * Math.PI / 6;
  return { x: Math.cos(angle) * (390 + ring * 95), y: Math.sin(angle) * (300 + ring * 78) };
}

function mix(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function curve(a: Point, b: Point, shape: RoadShape): Point[] {
  const distance = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const normal = { x: -(b.y - a.y) / distance, y: (b.x - a.x) / distance };
  const controlA = mix(a, b, shape.firstControl);
  const controlB = mix(a, b, shape.secondControl);
  controlA.x += normal.x * shape.early;
  controlA.y += normal.y * shape.early;
  controlB.x += normal.x * shape.late;
  controlB.y += normal.y * shape.late;
  const segments = Math.max(8, Math.ceil(distance / 18));
  const points: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    points.push({
      x: u ** 3 * a.x + 3 * u ** 2 * t * controlA.x + 3 * u * t ** 2 * controlB.x + t ** 3 * b.x,
      y: u ** 3 * a.y + 3 * u ** 2 * t * controlA.y + 3 * u * t ** 2 * controlB.y + t ** 3 * b.y,
    });
  }
  return points;
}

function roadForHome(homeSlot: number) {
  const home = homeAt(homeSlot);
  const homeSeed = hash(`home-${homeSlot}`);
  const house = homeSeed % 4;
  const houseWidth = 222 + (homeSeed % 3) * 9;
  const door = {
    x: home.x + (house === 3 ? -0.14 : 0.24) * houseWidth,
    y: home.y - 27,
  };
  const porch = { x: door.x + (house === 3 ? 10 : home.x > 0 ? -18 : 8), y: door.y + 42 };
  const angle = Math.atan2(porch.y, porch.x);
  const entrance = { x: Math.cos(angle) * 268, y: Math.sin(angle) * 188 };
  const shape = villageRoadShapes[homeSlot] ?? {
    early: ((homeSeed >>> 16) % 37 - 18) * 5,
    late: ((homeSeed >>> 23) % 29 - 14) * 5,
    firstControl: 0.25 + (homeSeed % 10) / 100,
    secondControl: 0.68 + ((homeSeed >>> 8) % 10) / 100,
  };
  return { home, house, houseWidth, door, porch, entrance, road: curve(porch, entrance, shape) };
}

export function residentsFor(players: PublicPlayer[], homeCount = villageHomes): Resident[] {
  return players.map((player, rosterIndex) => {
    const index = Number.isInteger(player.sceneSlot) ? player.sceneSlot : rosterIndex;
    const { homeSlot, roommate } = homeFor(index, homeCount);
    const { home, house, houseWidth, door, porch, road } = roadForHome(homeSlot);
    const seed = hash(player.id);
    const character = Math.floor(seed / 4) % 4;
    const gathering = gatheringAt(index);
    // The two outer houses join nearby streets instead of adding parallel
    // lanes all the way to the square. Their residents walk the same junction.
    const sharedWith = homeSlot === 6 ? 0 : homeSlot === 7 ? 1 : undefined;
    const mainRoad = sharedWith === undefined ? undefined : roadForHome(sharedWith);
    const joinIndex = mainRoad ? Math.floor(mainRoad.road.length * 0.48) : 0;
    const junction = mainRoad?.road[joinIndex];
    const branchShape: RoadShape = homeSlot === 6
      ? { early: 35, late: -48, firstControl: 0.27, secondControl: 0.73 }
      : { early: -24, late: 58, firstControl: 0.32, secondControl: 0.69 };
    const branch = junction ? curve(porch, junction, branchShape) : undefined;
    const entrance = mainRoad?.entrance ?? road[road.length - 1];
    return {
      id: player.id,
      name: player.name,
      alive: player.alive,
      homeSlot,
      roommate,
      home,
      door,
      entrance,
      gathering,
      route: branch && mainRoad
        ? [door, ...branch, ...mainRoad.road.slice(joinIndex + 1), gathering]
        : [door, ...road, gathering],
      ...(branch ? { sharedWith, sharedFrom: branch.length } : {}),
      house,
      character,
      houseWidth,
    };
  });
}

export function residentDestination(phase: Status, nightReady: boolean, alive: boolean): "home" | "plaza" {
  if (!alive || (phase === "night" && nightReady)) return "home";
  return "plaza";
}

export function pointAlong(points: Point[], progress: number): { point: Point; direction: Point } {
  if (progress <= 0) return { point: points[0], direction: { x: points[1].x - points[0].x, y: points[1].y - points[0].y } };
  if (progress >= 1) {
    const last = points.length - 1;
    return { point: points[last], direction: { x: points[last].x - points[last - 1].x, y: points[last].y - points[last - 1].y } };
  }
  const distances: number[] = [];
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const segment = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    distances.push(segment);
    length += segment;
  }
  let target = Math.max(0, Math.min(1, progress)) * length;
  for (let i = 0; i < distances.length; i++) {
    if (target <= distances[i] || i === distances.length - 1) {
      const a = points[i], b = points[i + 1];
      const fraction = distances[i] ? target / distances[i] : 0;
      return { point: mix(a, b, fraction), direction: { x: b.x - a.x, y: b.y - a.y } };
    }
    target -= distances[i];
  }
  return { point: points[0], direction: { x: 0, y: 1 } };
}
