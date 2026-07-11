import { PrismaClient, TagCategory } from "@prisma/client";
import { computeLikeRate, wilsonLowerBound } from "../src/server/services/ranking/scoring";

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

const DEMO_IMAGES: {
  seed: string;
  tags: string[];
  status: "EXPLORING" | "ACTIVE";
  likeCount: number;
  passCount: number;
}[] = [
  { seed: "lp-street-01", tags: ["street", "night", "tokyo"], status: "EXPLORING", likeCount: 8, passCount: 4 },
  { seed: "lp-street-02", tags: ["street", "minimal"], status: "EXPLORING", likeCount: 5, passCount: 6 },
  { seed: "lp-night-01", tags: ["night", "tokyo", "architecture"], status: "EXPLORING", likeCount: 12, passCount: 3 },
  { seed: "lp-dog-01", tags: ["dog", "street"], status: "EXPLORING", likeCount: 15, passCount: 2 },
  { seed: "lp-cat-01", tags: ["cat", "cafe"], status: "EXPLORING", likeCount: 9, passCount: 5 },
  { seed: "lp-sunset-01", tags: ["sunset", "beach"], status: "EXPLORING", likeCount: 7, passCount: 7 },
  { seed: "lp-beach-01", tags: ["beach", "minimal", "sunset"], status: "EXPLORING", likeCount: 11, passCount: 4 },
  { seed: "lp-cafe-01", tags: ["cafe", "minimal"], status: "EXPLORING", likeCount: 6, passCount: 8 },
  { seed: "lp-arch-01", tags: ["architecture", "tokyo"], status: "EXPLORING", likeCount: 10, passCount: 3 },
  { seed: "lp-ramen-01", tags: ["ramen", "tokyo"], status: "EXPLORING", likeCount: 14, passCount: 2 },
  { seed: "lp-mountain-01", tags: ["mountain", "sunset"], status: "EXPLORING", likeCount: 4, passCount: 9 },
  { seed: "lp-street-03", tags: ["street", "night"], status: "EXPLORING", likeCount: 3, passCount: 10 },
  { seed: "lp-minimal-01", tags: ["minimal", "architecture"], status: "EXPLORING", likeCount: 8, passCount: 6 },
  { seed: "lp-dog-02", tags: ["dog", "beach"], status: "EXPLORING", likeCount: 16, passCount: 1 },
  { seed: "lp-cat-02", tags: ["cat", "night"], status: "EXPLORING", likeCount: 5, passCount: 11 },
  { seed: "lp-active-01", tags: ["street", "tokyo", "night"], status: "ACTIVE", likeCount: 42, passCount: 8 },
  { seed: "lp-active-02", tags: ["dog", "street"], status: "ACTIVE", likeCount: 55, passCount: 10 },
  { seed: "lp-active-03", tags: ["sunset", "beach"], status: "ACTIVE", likeCount: 38, passCount: 12 },
  { seed: "lp-active-04", tags: ["architecture", "minimal"], status: "ACTIVE", likeCount: 48, passCount: 7 },
  { seed: "lp-active-05", tags: ["ramen", "tokyo", "night"], status: "ACTIVE", likeCount: 33, passCount: 9 },
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

function imageUrl(seed: string, size = 800) {
  return `https://picsum.photos/seed/${seed}/${size}/${size}`;
}

async function seedDemoUsers() {
  const now = new Date();

  const poster = await prisma.user.upsert({
    where: { email: "poster@likepass.local" },
    create: {
      email: "poster@likepass.local",
      name: "Demo Poster",
      username: "demo_poster",
      status: "ACTIVE",
      termsAcceptedAt: now,
      privacyAcceptedAt: now,
      onboardingCompletedAt: now,
    },
    update: {},
  });

  const demo = await prisma.user.upsert({
    where: { email: "demo@likepass.local" },
    create: {
      email: "demo@likepass.local",
      name: "Demo User",
      username: "demo_user",
      status: "ACTIVE",
      termsAcceptedAt: now,
      privacyAcceptedAt: now,
      onboardingCompletedAt: now,
    },
    update: {},
  });

  const tagRecords = await prisma.tag.findMany();
  const tagBySlug = Object.fromEntries(tagRecords.map((t) => [t.slug, t]));

  for (const pref of ["street", "night", "dog", "sunset", "tokyo"]) {
    const tag = tagBySlug[pref];
    if (!tag) continue;
    await prisma.userTagPreference.upsert({
      where: { userId_tagId: { userId: demo.id, tagId: tag.id } },
      create: { userId: demo.id, tagId: tag.id, source: "onboarding" },
      update: {},
    });
  }

  return { poster, demo };
}

async function seedDemoContent(posterId: string) {
  const tagRecords = await prisma.tag.findMany();
  const tagBySlug = Object.fromEntries(tagRecords.map((t) => [t.slug, t]));

  let created = 0;
  for (const item of DEMO_IMAGES) {
    const existing = await prisma.content.findFirst({
      where: { imageHash: item.seed },
    });
    if (existing) continue;

    const voteCount = item.likeCount + item.passCount;
    const likeRate = computeLikeRate(item.likeCount, item.passCount);
    const wilsonLower = wilsonLowerBound(item.likeCount, item.passCount);

    const content = await prisma.content.create({
      data: {
        userId: posterId,
        status: item.status,
        originalObjectKey: imageUrl(item.seed, 1200),
        largeObjectKey: imageUrl(item.seed, 1200),
        mediumObjectKey: imageUrl(item.seed, 800),
        thumbnailObjectKey: imageUrl(item.seed, 200),
        width: 800,
        height: 800,
        aspectRatio: 1,
        mimeType: "image/jpeg",
        imageHash: item.seed,
        aiQualityScore: 0.75 + Math.random() * 0.2,
        aiSafetyStatus: "SAFE",
        likeCount: item.likeCount,
        passCount: item.passCount,
        voteCount,
        likeRate,
        wilsonLower,
        publishedAt: new Date(),
      },
    });

    for (const slug of item.tags) {
      const tag = tagBySlug[slug];
      if (!tag) continue;
      await prisma.contentTag.create({
        data: {
          contentId: content.id,
          tagId: tag.id,
          source: "AI",
          confidence: 0.85,
          status: item.status === "ACTIVE" ? "ACTIVE" : "PENDING",
          likeCount: item.likeCount,
          passCount: item.passCount,
          voteCount,
          rankingScore: wilsonLower,
        },
      });
      await prisma.tag.update({
        where: { id: tag.id },
        data: { usageCount: { increment: 1 } },
      });
    }
    created++;
  }

  return created;
}

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

  const { poster } = await seedDemoUsers();
  const contentCount = await seedDemoContent(poster.id);

  console.log("Seed completed:", SEED_TAGS.length, "tags,", contentCount, "demo images");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
