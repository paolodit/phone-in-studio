import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const callers = await prisma.caller.findMany({
    where: { status: "APPROVED" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, firstName: true, surnameInitial: true, issueHeadline: true },
    take: 200,
  });
  return NextResponse.json(callers);
}
