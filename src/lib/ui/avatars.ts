import amber from "$lib/assets/ui/avatar-amber.webp";
import olive from "$lib/assets/ui/avatar-olive.webp";
import teal from "$lib/assets/ui/avatar-teal.webp";
import russet from "$lib/assets/ui/avatar-russet.webp";

const portraits = [amber, olive, teal, russet];
const assigned = new Map<string, string>();

export function avatarForPlayer(id: string): string {
  const portrait = assigned.get(id);
  if (portrait) return portrait;
  let hash = 0;
  for (let index = 0; index < id.length; index++)
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  const selected = portraits[hash % portraits.length];
  assigned.set(id, selected);
  return selected;
}
