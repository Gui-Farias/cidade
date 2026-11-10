import type { Action } from "svelte/action";

type DragOptions = {
  handle: string;
  resetKey?: unknown;
  exiting?: boolean;
};

const mouseScreen = "(min-width: 900px) and (any-hover: hover) and (any-pointer: fine)";
const interactive = "button, a, input, select, textarea, [role='button'], [contenteditable='true']";
const positionStyles = ["position", "left", "top", "right", "bottom", "width", "height", "transform", "animation"];

export const draggable: Action<HTMLElement, DragOptions> = (node, initialOptions) => {
  const media = window.matchMedia(mouseScreen);
  let options = initialOptions;
  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;
  let panelWidth = 0;
  let panelHeight = 0;
  let previousSelection = "";

  const clamp = (value: number, size: number, viewport: number) =>
    Math.min(Math.max(12, value), Math.max(12, viewport - size - 12));

  function finishDrag(event?: Event) {
    if (pointerId === null) return;
    if (event instanceof PointerEvent && event.pointerId !== pointerId) return;
    pointerId = null;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", finishDrag);
    window.removeEventListener("pointercancel", finishDrag);
    window.removeEventListener("blur", finishDrag);
    document.body.style.userSelect = previousSelection;
    node.classList.remove("is-dragging");
  }

  function resetPosition() {
    finishDrag();
    for (const property of positionStyles) node.style.removeProperty(property);
  }

  function move(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    node.style.left = `${clamp(originX + event.clientX - startX, panelWidth, window.innerWidth)}px`;
    node.style.top = `${clamp(originY + event.clientY - startY, panelHeight, window.innerHeight)}px`;
  }

  function startDrag(event: PointerEvent) {
    if (pointerId !== null) return;
    if (!media.matches || event.pointerType !== "mouse" || event.button !== 0) return;
    if (!(event.target instanceof Element) || event.target.closest(interactive)) return;
    const handle = event.target.closest(options.handle);
    if (!handle || !node.contains(handle)) return;

    const bounds = node.getBoundingClientRect();
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    originX = bounds.left;
    originY = bounds.top;
    panelWidth = bounds.width;
    panelHeight = bounds.height;

    node.style.position = "fixed";
    node.style.right = "auto";
    node.style.bottom = "auto";
    node.style.width = `${panelWidth}px`;
    node.style.height = `${panelHeight}px`;
    node.style.left = `${originX}px`;
    node.style.top = `${originY}px`;
    node.style.transform = "none";
    node.style.animation = "none";
    node.classList.add("is-dragging");
    previousSelection = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
    window.addEventListener("blur", finishDrag);
    event.preventDefault();
  }

  node.addEventListener("pointerdown", startDrag);
  media.addEventListener("change", resetPosition);
  window.addEventListener("resize", resetPosition);

  return {
    update(nextOptions) {
      if (nextOptions.resetKey !== options.resetKey) resetPosition();
      if (nextOptions.exiting && !options.exiting) {
        finishDrag();
        node.style.removeProperty("animation");
      }
      options = nextOptions;
    },
    destroy() {
      node.removeEventListener("pointerdown", startDrag);
      media.removeEventListener("change", resetPosition);
      window.removeEventListener("resize", resetPosition);
      finishDrag();
    },
  };
};
