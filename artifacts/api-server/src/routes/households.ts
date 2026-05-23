import { Router } from "express";
import { eq, ilike, or, gt, sql } from "drizzle-orm";
import { db, usersTable, householdsTable } from "@workspace/db";
import {
  ListHouseholdsQueryParams,
  ListHouseholdsResponse,
  GetHouseholdParams,
  GetHouseholdResponse,
  GetMyHouseholdResponse,
} from "@workspace/api-zod";
import { requireAuth, requireAdmin, type AuthenticatedRequest } from "../middlewares/requireAuth";

const MONTHLY_FEE = 36;

const router = Router();

router.get("/households/my", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const user = req.dbUser!;

  const [household] = await db
    .select()
    .from(householdsTable)
    .where(eq(householdsTable.userId, user.id))
    .limit(1);

  if (!household) {
    const unpaidBalance = parseFloat(user.unpaidBalance);
    res.json(
      GetMyHouseholdResponse.parse({
        id: 0,
        unitNumber: user.unitNumber ?? "N/A",
        ownerName: user.name,
        email: user.email,
        unpaidBalance,
        monthlyFee: MONTHLY_FEE,
        totalDue: unpaidBalance + MONTHLY_FEE,
        userId: user.id,
        userName: user.name,
        createdAt: new Date().toISOString(),
      }),
    );
    return;
  }

  const unpaidBalance = parseFloat(household.unpaidBalance);
  res.json(
    GetMyHouseholdResponse.parse({
      id: household.id,
      unitNumber: household.unitNumber,
      ownerName: household.ownerName,
      email: household.email,
      unpaidBalance,
      monthlyFee: MONTHLY_FEE,
      totalDue: unpaidBalance + MONTHLY_FEE,
      userId: household.userId,
      userName: user.name,
      createdAt: household.createdAt,
    }),
  );
});

router.get("/households", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = ListHouseholdsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { search, unpaidOnly, page = 1, limit = 20 } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (search) {
    conditions.push(
      or(
        ilike(householdsTable.unitNumber, `%${search}%`),
        ilike(householdsTable.ownerName, `%${search}%`),
        ilike(householdsTable.email, `%${search}%`),
      ),
    );
  }
  if (unpaidOnly) {
    conditions.push(gt(householdsTable.unpaidBalance, "0"));
  }

  const whereClause = conditions.length > 0 ? conditions[0] : undefined;
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(householdsTable)
    .where(whereClause);

  const rows = await db
    .select()
    .from(householdsTable)
    .where(whereClause)
    .limit(limit)
    .offset(offset)
    .orderBy(householdsTable.unitNumber);

  res.json(
    ListHouseholdsResponse.parse({
      households: rows.map((h) => ({
        id: h.id,
        unitNumber: h.unitNumber,
        ownerName: h.ownerName,
        email: h.email,
        unpaidBalance: parseFloat(h.unpaidBalance),
        userId: h.userId,
        createdAt: h.createdAt,
      })),
      total: count,
      page,
      limit,
    }),
  );
});

router.get("/households/:id", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetHouseholdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [household] = await db
    .select()
    .from(householdsTable)
    .where(eq(householdsTable.id, params.data.id))
    .limit(1);

  if (!household) {
    res.status(404).json({ error: "Household not found" });
    return;
  }

  let userName = null;
  if (household.userId) {
    const [user] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, household.userId))
      .limit(1);
    userName = user?.name ?? null;
  }

  const unpaidBalance = parseFloat(household.unpaidBalance);
  res.json(
    GetHouseholdResponse.parse({
      id: household.id,
      unitNumber: household.unitNumber,
      ownerName: household.ownerName,
      email: household.email,
      unpaidBalance,
      monthlyFee: MONTHLY_FEE,
      totalDue: unpaidBalance + MONTHLY_FEE,
      userId: household.userId,
      userName,
      createdAt: household.createdAt,
    }),
  );
});

export default router;
