import { PrismaClient, TagCategory } from "@prisma/client";

const prisma = new PrismaClient();

const SEED_TAGS: { slug: string; displayName: string; category: TagCategory }[] = [
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

const DEFAULT_CONFIG = {
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

async function main() {
  for (const tag of SEED_TAGS) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      create: tag,
      update: { displayName: tag.displayName },
    });
  }

  await prisma.appConfig.upsert({
    where: { key: "defaults" },
    create: { key: "defaults", value: DEFAULT_CONFIG },
    update: { value: DEFAULT_CONFIG },
  });

  console.log("Seed completed:", SEED_TAGS.length, "tags");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
