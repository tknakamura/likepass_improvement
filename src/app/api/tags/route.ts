import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { TagStatus } from "@prisma/client";

export async function GET() {
  const tags = await prisma.tag.findMany({
    where: { status: TagStatus.ACTIVE },
    orderBy: { usageCount: "desc" },
    take: 50,
  });

  return NextResponse.json({
    tags: tags.map((t) => ({
      id: t.id,
      slug: t.slug,
      displayName: t.displayName,
      category: t.category,
    })),
  });
}
