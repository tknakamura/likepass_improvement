import type { TagCategory } from "@prisma/client";

export const SEED_TAGS: { slug: string; displayName: string; category: TagCategory }[] = [
  { slug: "street", displayName: "Street", category: "SCENE" },
  { slug: "night", displayName: "Night", category: "ATTRIBUTE" },
  { slug: "tokyo", displayName: "Tokyo", category: "LOCATION" },
  { slug: "dog", displayName: "Dog", category: "SUBJECT" },
  { slug: "cat", displayName: "Cat", category: "SUBJECT" },
  { slug: "sunset", displayName: "Sunset", category: "ATTRIBUTE" },
  { slug: "beach", displayName: "Beach", category: "SCENE" },
  { slug: "cafe", displayName: "Cafe", category: "SCENE" },
  { slug: "minimal", displayName: "Minimal", category: "STYLE" },
  { slug: "architecture", displayName: "Architecture", category: "SUBJECT" },
  { slug: "ramen", displayName: "Ramen", category: "SUBJECT" },
  { slug: "mountain", displayName: "Mountain", category: "SCENE" },
];

export const DEFAULT_CONFIG = {
  dormant: {
    earlyStopMinVotes: 20,
    earlyStopMaxLikeRate: 0.15,
    standardStopMinVotes: 50,
    standardStopMaxLikeRate: 0.25,
    wilsonStopMinVotes: 30,
    wilsonStopUpperBound: 0.35,
  },
  ranking: {
    minVotes: 20,
    minLikes: 5,
    targetVotes: 100,
  },
};
