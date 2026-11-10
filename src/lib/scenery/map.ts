// All positions are world units relative to the plaza. Changing the world size
// keeps the plaza, roads and decorations anchored to the map's logical center.
const plazaWidth = 540;
const plazaHeight = plazaWidth * 691 / 960;

export const map = {
  width: 1800,
  height: 1200,
  plaza: { width: plazaWidth, height: plazaHeight },
  roads: [
    // Short spurs tuck beneath the plaza; the bends lead toward the nearby
    // trees while leaving the broad clearings open for future buildings.
    { kind: "bendRight", x: -490, y: -145, width: 300, height: 266 },
    { kind: "bendLeft", x: 230, y: -145, width: 300, height: 266 },
    { kind: "vertical", x: -145, y: -415, width: 290, height: 258 },
    { kind: "vertical", x: -145, y: 145, width: 290, height: 258 },
  ],
  rocks: [
    { kind: "rocks1a", x: -587, y: -254, width: 116 },
    { kind: "rocks2b", x: 598, y: -236, width: 100 },
    { kind: "rocks1b", x: -370, y: -324, width: 94 },
    { kind: "rocks2a", x: 388, y: -307, width: 98 },
    { kind: "rocks2a", x: -605, y: 317, width: 111 },
    { kind: "rocks1b", x: 601, y: 301, width: 91 },
    { kind: "rocks2b", x: -330, y: 365, width: 98 },
    { kind: "rocks1a", x: 355, y: 366, width: 104 },
  ],
  trees: [
    { kind: "tree1", x: -733, y: -235, width: 168 },
    { kind: "tree2", x: -470, y: -120, width: 150 },
    { kind: "tree3", x: -345, y: -323, width: 154 },
    { kind: "tree2", x: 365, y: -331, width: 151 },
    { kind: "tree1", x: 480, y: -140, width: 163 },
    { kind: "tree3", x: 760, y: -167, width: 155 },
    { kind: "tree2", x: -720, y: 130, width: 159 },
    { kind: "tree1", x: 715, y: 140, width: 167 },
    { kind: "tree3", x: -500, y: 258, width: 155 },
    { kind: "tree1", x: -382, y: 391, width: 164 },
    { kind: "tree2", x: 410, y: 391, width: 149 },
    { kind: "tree3", x: 510, y: 250, width: 158 },
  ],
} as const;

export const mapCenter = { x: map.width / 2, y: map.height / 2 };
