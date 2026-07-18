import type { PrismaClient } from "@prisma/client";
import { DEFAULT_CONFIG, SEED_NPC_JUDGES, SEED_TAGS } from "@/lib/seed/data";

export async function seedEssentials(prisma: PrismaClient) {
  for (const tag of SEED_TAGS) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      create: tag,
      update: { displayName: tag.displayName, category: tag.category, status: "ACTIVE" },
    });
  }

  for (const judge of SEED_NPC_JUDGES) {
    await prisma.npcJudge.upsert({
      where: { id: judge.id },
      create: {
        id: judge.id,
        slug: judge.slug,
        displayName: judge.displayName,
        countryCode: judge.countryCode,
        countryNameJa: judge.countryNameJa,
        personaJa: judge.personaJa,
        viewingLensJa: judge.viewingLensJa,
        initials: judge.initials,
        sortOrder: judge.sortOrder,
        active: true,
      },
      update: {
        slug: judge.slug,
        displayName: judge.displayName,
        countryCode: judge.countryCode,
        countryNameJa: judge.countryNameJa,
        personaJa: judge.personaJa,
        viewingLensJa: judge.viewingLensJa,
        initials: judge.initials,
        sortOrder: judge.sortOrder,
        active: true,
      },
    });
  }

  await prisma.appConfig.upsert({
    where: { key: "defaults" },
    create: { key: "defaults", value: DEFAULT_CONFIG },
    update: { value: DEFAULT_CONFIG },
  });

  return SEED_TAGS.length;
}
