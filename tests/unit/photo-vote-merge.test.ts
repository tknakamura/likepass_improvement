import { describe, it, expect } from "vitest";

type TagNpcRow = {
  id: string;
  contentId: string;
  judgeId: string;
  tagId: string | null;
  value: "LIKE" | "PASS";
  confidence: number | null;
  updatedAt: Date;
};

/**
 * Mirrors the migration rule for consolidating tag-scoped NPC rows
 * into one photo-level decision per content×judge.
 */
function mergeNpcRows(rows: TagNpcRow[]): TagNpcRow {
  const photoLevel = rows
    .filter((r) => r.tagId == null)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.id.localeCompare(a.id));
  if (photoLevel[0]) return photoLevel[0];

  const tagged = rows.filter((r) => r.tagId != null);
  const counts = new Map<"LIKE" | "PASS", TagNpcRow[]>();
  for (const row of tagged) {
    const list = counts.get(row.value) ?? [];
    list.push(row);
    counts.set(row.value, list);
  }

  const ranked = [...counts.entries()].sort((a, b) => {
    if (b[1].length !== a[1].length) return b[1].length - a[1].length;
    const maxConf = (list: TagNpcRow[]) => Math.max(...list.map((r) => r.confidence ?? 0));
    if (maxConf(b[1]) !== maxConf(a[1])) return maxConf(b[1]) - maxConf(a[1]);
    const maxUpd = (list: TagNpcRow[]) => Math.max(...list.map((r) => r.updatedAt.getTime()));
    if (maxUpd(b[1]) !== maxUpd(a[1])) return maxUpd(b[1]) - maxUpd(a[1]);
    return a[1][0].id.localeCompare(b[1][0].id);
  });

  const winners = ranked[0][1].sort(
    (a, b) =>
      (b.confidence ?? 0) - (a.confidence ?? 0) ||
      b.updatedAt.getTime() - a.updatedAt.getTime() ||
      a.id.localeCompare(b.id),
  );
  return winners[0];
}

function keepLatestHumanVote(
  votes: Array<{ id: string; updatedAt: Date; createdAt: Date; value: "LIKE" | "PASS" }>,
) {
  return [...votes].sort(
    (a, b) =>
      b.updatedAt.getTime() - a.updatedAt.getTime() ||
      b.createdAt.getTime() - a.createdAt.getTime() ||
      b.id.localeCompare(a.id),
  )[0];
}

describe("photo vote merge rules", () => {
  it("prefers legacy photo-level NPC rows over tag-scoped ones", () => {
    const kept = mergeNpcRows([
      {
        id: "tagged",
        contentId: "c1",
        judgeId: "j1",
        tagId: "t1",
        value: "PASS",
        confidence: 0.99,
        updatedAt: new Date("2026-07-18T10:00:00Z"),
      },
      {
        id: "photo",
        contentId: "c1",
        judgeId: "j1",
        tagId: null,
        value: "LIKE",
        confidence: 0.5,
        updatedAt: new Date("2026-07-18T09:00:00Z"),
      },
    ]);
    expect(kept.id).toBe("photo");
    expect(kept.value).toBe("LIKE");
  });

  it("uses majority for tag-scoped NPC rows", () => {
    const kept = mergeNpcRows([
      {
        id: "a",
        contentId: "c1",
        judgeId: "j1",
        tagId: "t1",
        value: "LIKE",
        confidence: 0.7,
        updatedAt: new Date("2026-07-18T10:00:00Z"),
      },
      {
        id: "b",
        contentId: "c1",
        judgeId: "j1",
        tagId: "t2",
        value: "LIKE",
        confidence: 0.8,
        updatedAt: new Date("2026-07-18T11:00:00Z"),
      },
      {
        id: "c",
        contentId: "c1",
        judgeId: "j1",
        tagId: "t3",
        value: "PASS",
        confidence: 0.95,
        updatedAt: new Date("2026-07-18T12:00:00Z"),
      },
    ]);
    expect(kept.value).toBe("LIKE");
    expect(kept.id).toBe("b");
  });

  it("keeps the latest human vote for user×content", () => {
    const kept = keepLatestHumanVote([
      {
        id: "old",
        value: "PASS",
        updatedAt: new Date("2026-07-18T09:00:00Z"),
        createdAt: new Date("2026-07-18T09:00:00Z"),
      },
      {
        id: "new",
        value: "LIKE",
        updatedAt: new Date("2026-07-18T10:00:00Z"),
        createdAt: new Date("2026-07-18T10:00:00Z"),
      },
    ]);
    expect(kept.id).toBe("new");
    expect(kept.value).toBe("LIKE");
  });
});
