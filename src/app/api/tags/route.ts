import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { TagStatus } from "@prisma/client";
import { seedEssentials } from "@/lib/seed/essentials";

export async function GET() {
  let tags = await prisma.tag.findMany({
    where: { status: TagStatus.ACTIVE },
    orderBy: { usageCount: "desc" },
    take: 50,
  });

  if (tags.length === 0) {
    await seedEssentials(prisma);
    tags = await prisma.tag.findMany({
      where: { status: TagStatus.ACTIVE },
      orderBy: { usageCount: "desc" },
      take: 50,
    });
  }

  return NextResponse.json({
    tags: tags.map((t) => ({
      id: t.id,
      slug: t.slug,
      displayName: t.displayName,
      category: t.category,
    })),
  });
}
