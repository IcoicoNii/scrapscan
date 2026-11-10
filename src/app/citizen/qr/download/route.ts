import { db } from "@/lib/db";
import { ForbiddenError, requirePermission } from "@/lib/auth";
import { qrSvg } from "@/lib/qr";

export async function GET() {
  try {
    const user = await requirePermission("qr:read:own");
    if (!user.householdId) return new Response("No household", { status: 404 });
    const qr = await db.qrCode.findFirst({
      where: { householdId: user.householdId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      include: { household: { select: { code: true } } },
    });
    if (!qr) return new Response("No active QR code", { status: 404 });

    const svg = await qrSvg(qr.token);
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": `attachment; filename="scrapscan-${qr.household.code}.svg"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return new Response("Forbidden", { status: e.message === "UNAUTHENTICATED" ? 401 : 403 });
    throw e;
  }
}
