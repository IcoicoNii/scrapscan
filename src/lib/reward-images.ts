/** Thumbnails shipped in public/rewards/. A reward stores one of these paths in `imageUrl`, or null for none. */
export const REWARD_IMAGES = [
  { file: "eco-advocate-shirt.png", label: "Eco-Advocate Shirt" },
  { file: "baby-wipes.png", label: "Baby Wipes" },
  { file: "batteries.png", label: "Batteries" },
  { file: "broom-walls.png", label: "Broom/Walls" },
  { file: "candles.png", label: "Candles" },
  { file: "eco-friendly-dishsoap.png", label: "Eco-Friendly Dishsoap" },
  { file: "dustpan-set.png", label: "Dustpan Set" },
  { file: "led-flashlight.png", label: "LED Flashlight" },
  { file: "oil-ointments.png", label: "Oil/Ointments" },
  { file: "reusable-raincoat.png", label: "Reusable Raincoat" },
  { file: "1kg-rice.png", label: "1 kg Rice" },
  { file: "travel-utensil-set.png", label: "Travel Utensil Set" },
  { file: "folding-umbrella.png", label: "Folding Umbrella" },
  { file: "vegetable-seeds.png", label: "Vegetable Seeds" },
  { file: "dishwashing-sponge.png", label: "Dishwashing Sponge" },
  { file: "emergency-whistle.png", label: "Emergency Whistle" },
  { file: "face-towel.png", label: "Face Towel" },
  { file: "garbage-bags.png", label: "Garbage Bags" },
].map((i) => ({ ...i, url: `/rewards/${i.file}` }));

const ALLOWED = new Set(REWARD_IMAGES.map((i) => i.url));

/** Accepts only the shipped thumbnail paths; anything else (including "") becomes null. */
export function parseRewardImage(v: unknown): string | null {
  return typeof v === "string" && ALLOWED.has(v) ? v : null;
}
