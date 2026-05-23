import { Router } from "express";
import { eq, gt, sql, desc } from "drizzle-orm";
import { db, usersTable, householdsTable, paymentsTable } from "@workspace/db";
import {
  ImportHouseholdsBody,
  ImportHouseholdsResponse,
  GetAdminStatsResponse,
} from "@workspace/api-zod";
import { requireAdmin, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router = Router();

router.post("/admin/import", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = ImportHouseholdsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { rows } = parsed.data;
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const [existing] = await db
        .select()
        .from(householdsTable)
        .where(eq(householdsTable.unitNumber, row.unitNumber))
        .limit(1);

      if (existing) {
        await db
          .update(householdsTable)
          .set({
            ownerName: row.ownerName,
            email: row.email,
            unpaidBalance: String(row.unpaidBalance),
          })
          .where(eq(householdsTable.id, existing.id));

        // Sync balance to linked user (by userId or by email)
        const userIdToUpdate = existing.userId;
        if (userIdToUpdate) {
          await db
            .update(usersTable)
            .set({ unpaidBalance: String(row.unpaidBalance) })
            .where(eq(usersTable.id, userIdToUpdate));
        } else {
          // Try to find user by email and link them
          const [matchedUser] = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.email, row.email))
            .limit(1);
          if (matchedUser) {
            await db
              .update(usersTable)
              .set({ unpaidBalance: String(row.unpaidBalance), unitNumber: row.unitNumber })
              .where(eq(usersTable.id, matchedUser.id));
            await db
              .update(householdsTable)
              .set({ userId: matchedUser.id })
              .where(eq(householdsTable.id, existing.id));
          }
        }
        updated++;
      } else {
        const [newHousehold] = await db.insert(householdsTable).values({
          unitNumber: row.unitNumber,
          ownerName: row.ownerName,
          email: row.email,
          unpaidBalance: String(row.unpaidBalance),
        }).returning();

        // Try to find an existing user with this email and link them
        const [matchedUser] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.email, row.email))
          .limit(1);
        if (matchedUser) {
          await db
            .update(usersTable)
            .set({ unpaidBalance: String(row.unpaidBalance), unitNumber: row.unitNumber })
            .where(eq(usersTable.id, matchedUser.id));
          await db
            .update(householdsTable)
            .set({ userId: matchedUser.id })
            .where(eq(householdsTable.id, newHousehold.id));
        }
        imported++;
      }
    } catch (err) {
      errors.push(`Row ${row.unitNumber}: ${String(err)}`);
      skipped++;
    }
  }

  res.json(ImportHouseholdsResponse.parse({ imported, updated, skipped, errors }));
});

router.get("/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
  const [{ totalHouseholds }] = await db
    .select({ totalHouseholds: sql<number>`count(*)::int` })
    .from(householdsTable);

  const [{ unpaidCount }] = await db
    .select({ unpaidCount: sql<number>`count(*)::int` })
    .from(householdsTable)
    .where(gt(householdsTable.unpaidBalance, "0"));

  const paidCount = totalHouseholds - unpaidCount;

  const [{ totalCollected }] = await db
    .select({
      totalCollected: sql<number>`coalesce(sum(amount::numeric), 0)::float`,
    })
    .from(paymentsTable)
    .where(eq(paymentsTable.status, "completed"));

  const [{ totalOutstanding }] = await db
    .select({
      totalOutstanding: sql<number>`coalesce(sum(unpaid_balance::numeric), 0)::float`,
    })
    .from(householdsTable);

  const recentPayments = await db
    .select({
      payment: paymentsTable,
      userName: usersTable.name,
      userEmail: usersTable.email,
      unitNumber: usersTable.unitNumber,
    })
    .from(paymentsTable)
    .leftJoin(usersTable, eq(paymentsTable.userId, usersTable.id))
    .where(eq(paymentsTable.status, "completed"))
    .orderBy(desc(paymentsTable.createdAt))
    .limit(10);

  res.json(
    GetAdminStatsResponse.parse({
      totalHouseholds,
      paidCount,
      unpaidCount,
      totalCollected,
      totalOutstanding,
      recentPayments: recentPayments.map(({ payment, userName, userEmail, unitNumber }) => ({
        id: payment.id,
        userId: payment.userId,
        userName,
        userEmail,
        unitNumber,
        amount: parseFloat(payment.amount),
        stripeSessionId: payment.stripeSessionId,
        status: payment.status,
        createdAt: payment.createdAt,
      })),
    }),
  );
});

router.get("/admin/export", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      payment: paymentsTable,
      userName: usersTable.name,
      userEmail: usersTable.email,
      unitNumber: usersTable.unitNumber,
    })
    .from(paymentsTable)
    .leftJoin(usersTable, eq(paymentsTable.userId, usersTable.id))
    .orderBy(desc(paymentsTable.createdAt));

  const csvRows = [
    ["ID", "User", "Email", "Unit", "Amount", "Status", "Stripe Session", "Date"].join(","),
    ...rows.map(({ payment, userName, userEmail, unitNumber }) =>
      [
        payment.id,
        `"${userName ?? ""}"`,
        `"${userEmail ?? ""}"`,
        `"${unitNumber ?? ""}"`,
        parseFloat(payment.amount).toFixed(2),
        payment.status,
        `"${payment.stripeSessionId ?? ""}"`,
        payment.createdAt.toISOString(),
      ].join(","),
    ),
  ].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="payments.csv"');
  res.send(csvRows);
});

export default router;
