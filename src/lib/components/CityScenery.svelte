<script lang="ts">
  import { onMount } from "svelte";
  import type { PublicPlayer, Status } from "$lib/game/types";
  import { map, mapCenter } from "$lib/scenery/map";
  import { pointAlong, residentDestination, residentsFor, type Point, type Resident } from "$lib/scenery/village";
  import grassUrl from "$lib/assets/scenery/grass.webp";
  import roadAUrl from "$lib/assets/scenery/road-strip-a.webp";
  import roadBUrl from "$lib/assets/scenery/road-strip-b.webp";
  import roadCUrl from "$lib/assets/scenery/road-strip-c.webp";
  import plazaUrl from "$lib/assets/scenery/plaza.webp";
  import tree1Url from "$lib/assets/scenery/tree-1.webp";
  import tree2Url from "$lib/assets/scenery/tree-2.webp";
  import tree3Url from "$lib/assets/scenery/tree-3.webp";
  import rocks1aUrl from "$lib/assets/scenery/rocks-1-a.webp";
  import rocks1bUrl from "$lib/assets/scenery/rocks-1-b.webp";
  import rocks2aUrl from "$lib/assets/scenery/rocks-2-a.webp";
  import rocks2bUrl from "$lib/assets/scenery/rocks-2-b.webp";
  import casa01Url from "../../../arte/casa/casa01.png";
  import casa02Url from "../../../arte/casa/casa02.png";
  import casa03Url from "../../../arte/casa/casa03.png";
  import casa04Url from "../../../arte/casa/casa04.png";
  import men1Url from "../../../arte/perso/men1.png";
  import men2Url from "../../../arte/perso/men2.png";
  import woman1Url from "../../../arte/perso/woman1.png";
  import woman2Url from "../../../arte/perso/woman2.png";

  let { players = [], phase = "waiting", nightReady = false }: {
    players?: PublicPlayer[];
    phase?: Status;
    nightReady?: boolean;
  } = $props();

  const urls = {
    grass: grassUrl, roadA: roadAUrl, roadB: roadBUrl, roadC: roadCUrl, plaza: plazaUrl,
    tree1: tree1Url, tree2: tree2Url, tree3: tree3Url,
    rocks1a: rocks1aUrl, rocks1b: rocks1bUrl, rocks2a: rocks2aUrl, rocks2b: rocks2bUrl,
  };
  const houseUrls = [casa01Url, casa02Url, casa03Url, casa04Url];
  const personSheets = [
    { url: men1Url, columns: 11, rows: [0, 266, 506, 749, 1024], checkerboard: false },
    { url: men2Url, columns: 9, rows: [0, 278, 521, 756, 1024], checkerboard: true },
    { url: woman1Url, columns: 11, rows: [0, 259, 508, 747, 1024], checkerboard: false },
    { url: woman2Url, columns: 9, rows: [0, 288, 528, 766, 1024], checkerboard: false },
  ];
  const housemateDepartureMs = 380;
  type Images = Record<keyof typeof urls, HTMLImageElement>;
  type Facing = "front" | "back" | "left" | "right";
  type Frames = { idle: HTMLCanvasElement; walk: Record<Facing, HTMLCanvasElement[]> };
  type Actor = { progress: number; from: number; target: number; started: number; duration: number; born: number };

  let stage: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let actorCanvas: HTMLCanvasElement;
  let images: Images | undefined;
  let houses: (HTMLCanvasElement | HTMLImageElement | undefined)[] = [];
  let frames: (Frames | undefined)[] = [];
  let residents: Resident[] = [];
  let homes: Resident[] = [];
  let currentPhase: Status = "waiting";
  let currentNightReady = false;
  let roadTextures: HTMLCanvasElement[] = [];
  const loadingHouses = new Set<number>();
  const loadingCharacters = new Set<number>();
  // null forces the first paint even while the room has no residents.
  let sceneKey: string | null = null;
  let homeCount = 6;
  let viewport = { width: 0, height: 0, ratio: 1, scale: 1, cameraY: mapCenter.y };
  let active = false;
  let reducedMotion = false;
  let frameId = 0;
  const actors = new Map<string, Actor>();

  function load(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Imagem não carregada: ${url}`));
      image.src = url;
    });
  }

  // casa04 was exported with a checkerboard baked into its RGB pixels. Only
  // border-connected neutral pixels are removed, preserving the painted house.
  function clearHouseBackdrop(image: HTMLImageElement): HTMLCanvasElement {
    const surface = document.createElement("canvas");
    surface.width = image.naturalWidth;
    surface.height = image.naturalHeight;
    const context = surface.getContext("2d", { willReadFrequently: true })!;
    context.drawImage(image, 0, 0);
    const bitmap = context.getImageData(0, 0, surface.width, surface.height);
    const pixels = bitmap.data;
    const width = surface.width, height = surface.height;
    const seen = new Uint8Array(width * height);
    const queue = new Uint32Array(width * height);
    let head = 0, tail = 0;
    function neutral(index: number) {
      const offset = index * 4;
      const r = pixels[offset], g = pixels[offset + 1], b = pixels[offset + 2];
      return Math.max(r, g, b) - Math.min(r, g, b) < 21 && Math.min(r, g, b) > 125;
    }
    function push(index: number) {
      if (!seen[index] && neutral(index)) { seen[index] = 1; queue[tail++] = index; }
    }
    for (let x = 0; x < width; x++) { push(x); push((height - 1) * width + x); }
    for (let y = 0; y < height; y++) { push(y * width); push(y * width + width - 1); }
    while (head < tail) {
      const index = queue[head++];
      pixels[index * 4 + 3] = 0;
      const x = index % width;
      if (x) push(index - 1);
      if (x + 1 < width) push(index + 1);
      if (index >= width) push(index - width);
      if (index + width < width * height) push(index + width);
    }
    context.putImageData(bitmap, 0, 0);
    return surface;
  }

  function prepareFrames(sheet: HTMLImageElement, character: number): Frames {
    const layout = personSheets[character];
    const source = document.createElement("canvas");
    source.width = sheet.naturalWidth;
    source.height = sheet.naturalHeight;
    const sourceContext = source.getContext("2d", { willReadFrequently: true })!;
    sourceContext.drawImage(sheet, 0, 0);
    const bitmap = sourceContext.getImageData(0, 0, source.width, source.height);
    const pixels = bitmap.data;

    // men2.png has a checkerboard painted into its RGB pixels, unlike the
    // other three transparent sheets. Key only its bright neutral background.
    if (layout.checkerboard) {
      for (let offset = 0; offset < pixels.length; offset += 4) {
        const darkest = Math.min(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
        const lightest = Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
        if (darkest > 175 && lightest - darkest < 16) pixels[offset + 3] = 0;
      }
      sourceContext.putImageData(bitmap, 0, 0);
    }

    type Box = { x: number; y: number; width: number; height: number };
    const rows: HTMLCanvasElement[][] = [];
    for (let row = 0; row < 4; row++) {
      const top = layout.rows[row], bottom = layout.rows[row + 1];
      const occupied = new Uint8Array(source.width);
      for (let y = top; y < bottom; y += 2) for (let x = 0; x < source.width; x++) {
        if (pixels[(y * source.width + x) * 4 + 3] > 96) occupied[x] = 1;
      }
      const columns: { left: number; right: number }[] = [];
      let left = -1;
      for (let x = 0; x <= source.width; x++) {
        if (x < source.width && occupied[x]) {
          if (left < 0) left = x;
        } else if (left >= 0) {
          if (x - left > 12) columns.push({ left, right: x });
          left = -1;
        }
      }
      if (columns.length !== layout.columns) throw new Error(`Quadros inválidos em ${layout.url}: ${columns.length}`);

      const boxes: Box[] = columns.map(({ left, right }) => {
        let minY = bottom, maxY = top;
        for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
          if (pixels[(y * source.width + x) * 4 + 3] <= 96) continue;
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
        return { x: left, y: minY, width: right - left, height: maxY - minY + 1 };
      });
      const walkingHeight = Math.max(...boxes.slice(1).map((box) => box.height));
      rows.push(boxes.map((box, index) => {
        const frame = document.createElement("canvas");
        frame.width = 180;
        frame.height = 256;
        const scale = 248 / (index === 0 ? box.height : walkingHeight);
        const width = box.width * scale, height = box.height * scale;
        frame.getContext("2d")!.drawImage(source, box.x, box.y, box.width, box.height,
          (frame.width - width) / 2, frame.height - height - 3, width, height);
        return frame;
      }));
    }
    return {
      idle: rows[0][0],
      walk: { front: rows[0].slice(1), left: rows[1].slice(1), back: rows[2].slice(1), right: rows[3].slice(1) },
    };
  }

  function prepareRoadTexture(image: HTMLImageElement) {
    const width = image.naturalWidth, height = image.naturalHeight;
    const surface = document.createElement("canvas");
    surface.width = width * 4;
    surface.height = height;
    const context = surface.getContext("2d")!;
    for (let column = 0; column < 4; column++) {
      context.save();
      context.translate(column * width + (column % 2 ? width : 0), 0);
      context.scale(column % 2 ? -1 : 1, 1);
      context.drawImage(image, 0, 0);
      context.restore();
    }
    return surface;
  }

  function configureCanvas(target: HTMLCanvasElement, width: number, height: number, ratio: number) {
    const pixelWidth = Math.round(width * ratio), pixelHeight = Math.round(height * ratio);
    if (target.width !== pixelWidth || target.height !== pixelHeight) {
      target.width = pixelWidth;
      target.height = pixelHeight;
    }
    const context = target.getContext("2d")!;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    return context;
  }

  function worldTransform(context: CanvasRenderingContext2D) {
    const { width, height, scale, cameraY } = viewport;
    context.translate(width / 2, height / 2);
    context.scale(scale, scale);
    context.translate(-mapCenter.x, -cameraY);
  }

  function nearHomes(point: Point, radius: number) {
    return homes.some((resident) => Math.abs(point.x - resident.home.x) < resident.houseWidth * 0.65 + radius &&
      Math.abs(point.y - (resident.home.y - 80)) < 115 + radius);
  }

  function nearRoad(point: Point, radius: number) {
    return homes.some((resident) => resident.route.slice(0, -2).some((a, i) => {
      const b = resident.route[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy) < radius;
    }));
  }

  function drawRoad(context: CanvasRenderingContext2D, points: Point[], variant = 0) {
    const roadTexture = roadTextures[variant % roadTextures.length];
    if (!roadTexture || points.length < 2) return;
    const width = 49 + (variant % 3) * 2;
    const textureScale = width / roadTexture.height;
    const texturePeriod = roadTexture.width / 2;
    const segmentLengths = points.slice(1).map((point, index) =>
      Math.hypot(point.x - points[index].x, point.y - points[index].y));
    const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
    let segment = 0, segmentStart = 0;
    for (let distance = 0; distance < totalLength; distance += 3) {
      const step = Math.min(3, totalLength - distance);
      const center = distance + step / 2;
      while (segment < segmentLengths.length - 1 && center > segmentStart + segmentLengths[segment]) {
        segmentStart += segmentLengths[segment++];
      }
      const from = points[segment], to = points[segment + 1];
      const fraction = segmentLengths[segment] ? (center - segmentStart) / segmentLengths[segment] : 0;
      const x = mapCenter.x + from.x + (to.x - from.x) * fraction;
      const y = mapCenter.y + from.y + (to.y - from.y) * fraction;
      const sourceX = distance / textureScale % texturePeriod;
      context.save();
      context.translate(x, y);
      context.rotate(Math.atan2(to.y - from.y, to.x - from.x));
      context.drawImage(roadTexture, sourceX, 0, step / textureScale, roadTexture.height,
        -step / 2 - 0.6, -width / 2, step + 1.2, width);
      context.restore();
    }
  }

  function renderScene() {
    if (!active || !images || !roadTextures.length) return;
    const bounds = stage.getBoundingClientRect();
    const width = bounds.width, height = bounds.height;
    if (!width || !height) return;
    const scale = Math.max(0.46, Math.min(0.88, width / 1650));
    const plazaScreenY = width < 700
      ? Math.max(156, Math.min(height * 0.26, 240))
      : width < 1100 ? Math.max(190, Math.min(height * 0.34, 420)) : height / 2;
    viewport = {
      width, height, ratio: Math.min(window.devicePixelRatio || 1, 2), scale,
      cameraY: mapCenter.y + (height / 2 - plazaScreenY) / scale,
    };
    const context = configureCanvas(canvas, width, height, viewport.ratio);
    context.fillStyle = "#779e37";
    context.fillRect(0, 0, width, height);
    worldTransform(context);

    // Mirror alternate copies of the painted grass to conceal its tile seams.
    const tile = 1254, originX = mapCenter.x - tile / 2, originY = mapCenter.y - tile / 2;
    const halfWidth = width / (2 * scale), halfHeight = height / (2 * scale);
    for (let ty = Math.floor((viewport.cameraY - halfHeight - originY) / tile); ty <= Math.floor((viewport.cameraY + halfHeight - originY) / tile); ty++) {
      for (let tx = Math.floor((mapCenter.x - halfWidth - originX) / tile); tx <= Math.floor((mapCenter.x + halfWidth - originX) / tile); tx++) {
        const flipX = Math.abs(tx % 2) === 1, flipY = Math.abs(ty % 2) === 1;
        context.save();
        context.translate(originX + tx * tile + (flipX ? tile : 0), originY + ty * tile + (flipY ? tile : 0));
        context.scale(flipX ? -1 : 1, flipY ? -1 : 1);
        context.drawImage(images.grass, 0, 0, tile, tile);
        context.restore();
      }
    }

    if (residents.length) {
      const occupiedHomes = new Set(homes.map((resident) => resident.homeSlot));
      for (const resident of homes.filter((item) => item.sharedWith !== undefined)) {
        const branchEndsAtJunction = occupiedHomes.has(resident.sharedWith!);
        drawRoad(context, resident.route.slice(0, branchEndsAtJunction ? resident.sharedFrom! + 1 : -1), resident.homeSlot);
      }
      for (const resident of homes.filter((item) => item.sharedWith === undefined)) {
        drawRoad(context, resident.route.slice(0, -1), resident.homeSlot);
      }
    } else {
      // The empty village retains modest entrances ready for its first homes.
      drawRoad(context, [{ x: -405, y: 0 }, { x: -255, y: 0 }]);
      drawRoad(context, [{ x: 255, y: 0 }, { x: 405, y: 0 }]);
      drawRoad(context, [{ x: 0, y: -320 }, { x: 0, y: -176 }]);
      drawRoad(context, [{ x: 0, y: 177 }, { x: 0, y: 310 }]);
    }

    context.drawImage(images.plaza, mapCenter.x - map.plaza.width / 2, mapCenter.y - map.plaza.height / 2, map.plaza.width, map.plaza.height);

    for (const resident of [...homes].sort((a, b) => a.home.y - b.home.y)) {
      const image = houses[resident.house];
      if (!image) continue;
      const houseHeight = resident.houseWidth * image.height / image.width;
      context.drawImage(image, mapCenter.x + resident.home.x - resident.houseWidth / 2,
        mapCenter.y + resident.home.y - houseHeight, resident.houseWidth, houseHeight);
    }

    for (const rock of map.rocks) {
      if (nearHomes(rock, 35) || nearRoad(rock, 55)) continue;
      const image = images[rock.kind];
      const rockHeight = rock.width * image.naturalHeight / image.naturalWidth;
      context.drawImage(image, mapCenter.x + rock.x - rock.width / 2, mapCenter.y + rock.y - rockHeight, rock.width, rockHeight);
    }
    for (const tree of map.trees) {
      if (nearHomes(tree, 75) || nearRoad(tree, 90)) continue;
      const image = images[tree.kind];
      const treeHeight = tree.width * image.naturalHeight / image.naturalWidth;
      context.drawImage(image, mapCenter.x + tree.x - tree.width / 2, mapCenter.y + tree.y - treeHeight, tree.width, treeHeight);
    }
    renderActors(performance.now());
  }

  function setActorDestination(actor: Actor, target: number, resident: Resident, now: number) {
    if (actor.target === target) return;
    actor.from = actor.progress;
    actor.target = target;
    actor.started = now + resident.roommate * housemateDepartureMs;
    const distance = resident.route.reduce((sum, point, index) => index
      ? sum + Math.hypot(point.x - resident.route[index - 1].x, point.y - resident.route[index - 1].y) : sum, 0);
    actor.duration = reducedMotion ? 0 : Math.max(280, Math.abs(target - actor.from) * distance / 125 * 1000);
  }

  function reconcile(nextPlayers: PublicPlayer[], nextPhase: Status, nextNightReady: boolean) {
    currentPhase = nextPhase;
    currentNightReady = nextNightReady;
    if (!images) return;
    residents = residentsFor(nextPlayers, homeCount);
    const occupied = new Set<number>();
    homes = residents.filter((resident) => {
      if (occupied.has(resident.homeSlot)) return false;
      occupied.add(resident.homeSlot);
      return true;
    });
    loadResidentAssets(residents);
    const nextSceneKey = `${homeCount}:${residents.map((resident) => resident.id).join("|")}`;
    const now = performance.now();
    const livingIds = new Set(residents.map((resident) => resident.id));
    for (const id of actors.keys()) if (!livingIds.has(id)) actors.delete(id);
    for (const resident of residents) {
      const destination = residentDestination(currentPhase, currentNightReady, resident.alive) === "plaza" ? 1 : 0;
      let actor = actors.get(resident.id);
      if (!actor) {
        actor = { progress: 0, from: 0, target: 0, started: now, duration: 0, born: now };
        actors.set(resident.id, actor);
      }
      setActorDestination(actor, destination, resident, now);
    }
    if (nextSceneKey !== sceneKey) {
      sceneKey = nextSceneKey;
      renderScene();
    } else renderActors(now);
    startAnimation();
  }

  function updateActor(actor: Actor, now: number) {
    if (actor.duration && actor.progress !== actor.target) {
      const fraction = Math.max(0, Math.min(1, (now - actor.started) / actor.duration));
      actor.progress = actor.from + (actor.target - actor.from) * fraction;
    } else actor.progress = actor.target;
  }

  function renderActors(now: number) {
    if (!active || !viewport.width) return;
    const context = configureCanvas(actorCanvas, viewport.width, viewport.height, viewport.ratio);
    worldTransform(context);
    const visible = residents.flatMap((resident) => {
      if (!houses[resident.house] || !frames[resident.character]) return [];
      const actor = actors.get(resident.id)!;
      updateActor(actor, now);
      const travel = pointAlong(resident.route, actor.progress);
      return [{ resident, actor, travel }];
    }).sort((a, b) => a.travel.point.y - b.travel.point.y);
    for (const { resident, actor, travel } of visible) {
      if (actor.progress <= 0 && actor.target === 0) continue;
      if (actor.progress === 0 && now < actor.started) continue;
      const walking = now >= actor.started && Math.abs(actor.target - actor.progress) > 0.001;
      const direction = actor.target === 0
        ? { x: -travel.direction.x, y: -travel.direction.y }
        : travel.direction;
      const facing: Facing = Math.abs(direction.x) > Math.abs(direction.y) * 0.8
        ? direction.x < 0 ? "left" : "right"
        : direction.y < 0 ? "back" : "front";
      const group = frames[resident.character]!;
      const sequence = group.walk[facing];
      const frame = walking ? sequence[Math.floor((now - actor.started) / 125) % sequence.length] : group.idle;
      const x = mapCenter.x + travel.point.x, y = mapCenter.y + travel.point.y;
      const entranceAlpha = Math.min(1, (now - actor.born) / 460);
      const homeFade = actor.target === 0 ? Math.min(1, actor.progress * 9) : Math.min(1, actor.progress * 9 + 0.05);
      context.globalAlpha = Math.max(0, Math.min(entranceAlpha, homeFade));
      const spriteHeight = 73, spriteWidth = spriteHeight * frame.width / frame.height;
      context.drawImage(frame, x - spriteWidth / 2, y - spriteHeight, spriteWidth, spriteHeight);
      if (actor.progress > 0.96 && actor.target === 1) {
        context.font = "600 16px system-ui, sans-serif";
        const labelWidth = Math.min(residents.length > 8 ? 124 : 160, context.measureText(resident.name).width + 22);
        context.fillStyle = "rgba(9, 24, 20, .78)";
        context.beginPath();
        context.roundRect(x - labelWidth / 2, y + 5, labelWidth, 24, 9);
        context.fill();
        context.fillStyle = "#fff9e9";
        context.textAlign = "center";
        context.fillText(resident.name, x, y + 22, labelWidth - 14);
      }
      context.globalAlpha = 1;
    }
  }

  function startAnimation() {
    if (frameId || !active) return;
    const moving = residents.some((resident) => {
      const actor = actors.get(resident.id);
      return !!houses[resident.house] && !!frames[resident.character] && !!actor && actor.progress !== actor.target;
    });
    if (moving) frameId = requestAnimationFrame(tick);
  }

  function tick(now: number) {
    frameId = 0;
    renderActors(now);
    startAnimation();
  }

  function loadResidentAssets(visible: Resident[]) {
    for (const resident of visible) {
      const house = resident.house;
      if (!houses[house] && !loadingHouses.has(house)) {
        loadingHouses.add(house);
        void load(houseUrls[house]).then((image) => {
          if (!active) return;
          houses[house] = house === 3 ? clearHouseBackdrop(image) : image;
          const now = performance.now();
          for (const current of residents) if (current.house === house) {
            const actor = actors.get(current.id);
            if (actor?.progress === 0) { actor.started = now + current.roommate * housemateDepartureMs; actor.born = now; }
          }
          renderScene();
          startAnimation();
        }).catch((error) => console.error("Erro ao carregar casa:", error))
          .finally(() => loadingHouses.delete(house));
      }
      const character = resident.character;
      if (!frames[character] && !loadingCharacters.has(character)) {
        loadingCharacters.add(character);
        void load(personSheets[character].url).then((image) => {
          if (!active) return;
          frames[character] = prepareFrames(image, character);
          const now = performance.now();
          for (const current of residents) if (current.character === character) {
            const actor = actors.get(current.id);
            if (actor?.progress === 0) { actor.started = now + current.roommate * housemateDepartureMs; actor.born = now; }
          }
          renderActors(now);
          startAnimation();
        }).catch((error) => console.error("Erro ao carregar personagem:", error))
          .finally(() => loadingCharacters.delete(character));
      }
    }
  }

  $effect(() => {
    reconcile(players, phase, nightReady);
  });

  onMount(() => {
    active = true;
    reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function resizeScene() {
      const nextHomeCount = stage.getBoundingClientRect().width >= 1100 ? 9 : 6;
      if (nextHomeCount !== homeCount) {
        homeCount = nextHomeCount;
        reconcile(players, phase, nightReady);
      } else renderScene();
    }
    resizeScene();
    const observer = new ResizeObserver(resizeScene);
    observer.observe(stage);
    Promise.all(Object.entries(urls).map(async ([key, url]) => [key, await load(url)] as const)).then((loaded) => {
      if (!active) return;
      images = Object.fromEntries(loaded) as Images;
      roadTextures = [images.roadA, images.roadB, images.roadC].map(prepareRoadTexture);
      reconcile(players, phase, nightReady);
    }).catch((error) => console.error("Erro ao carregar o cenário:", error));
    return () => {
      active = false;
      observer.disconnect();
      cancelAnimationFrame(frameId);
    };
  });
</script>

<div class="city-scenery" bind:this={stage} aria-label="Cidade medieval com casas, moradores, caminhos e praça" role="img">
  <canvas bind:this={canvas} aria-hidden="true"></canvas>
  <canvas bind:this={actorCanvas} aria-hidden="true"></canvas>
</div>

<style>
  .city-scenery { position: fixed; inset: 0; width: 100vw; height: 100dvh; overflow: hidden; background: #779e37; pointer-events: none; z-index: 0; }
  canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
</style>
