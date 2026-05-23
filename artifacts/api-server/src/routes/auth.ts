import { Router } from "express";
import { getAuth } from "@clerk/express";
import { eq, or } from "drizzle-orm";
import { db, usersTable, householdsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { GetMeResponse } from "@workspace/api-zod";

const router = Router();

router.get("/auth/me", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const user = req.dbUser!;
  res.json(
    GetMeResponse.parse({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      unitNumber: user.unitNumber,
      unpaidBalance: parseFloat(user.unpaidBalance),
      createdAt: user.createdAt,
    }),
  );
});

// JIT user provisioning — called after Clerk sign-in/sign-up to sync user into DB
router.post("/auth/provision", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId;

  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { name, email, unitNumber } = req.body as {
    name?: string;
    email?: string;
    unitNumber?: string;
  };

  if (!name || !email) {
    res.status(400).json({ error: "name and email are required" });
    return;
  }

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1);

  if (existing.length > 0) {
    const user = existing[0];
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      unitNumber: user.unitNumber,
      unpaidBalance: parseFloat(user.unpaidBalance),
      createdAt: user.createdAt,
    });
    return;
  }

  let unpaidBalance = 0;
  let matchedUnitNumber = unitNumber ?? null;

  if (unitNumber || email) {
    const conditions = [];
    if (unitNumber) conditions.push(eq(householdsTable.unitNumber, unitNumber));
    if (email) conditions.push(eq(householdsTable.email, email));

    const [household] = await db
      .select()
      .from(householdsTable)
      .where(or(...conditions))
      .limit(1);

    if (household) {
      unpaidBalance = parseFloat(household.unpaidBalance);
      matchedUnitNumber = household.unitNumber;

      await db
        .update(householdsTable)
        .set({ userId: undefined })
        .where(eq(householdsTable.id, household.id));
    }
  }

  const [newUser] = await db
    .insert(usersTable)
    .values({
      clerkId,
      name,
      email,
      role: "user",
      unitNumber: matchedUnitNumber,
      unpaidBalance: String(unpaidBalance),
    })
    .returning();

  if (matchedUnitNumber) {
    await db
      .update(householdsTable)
      .set({ userId: newUser.id })
      .where(eq(householdsTable.unitNumber, matchedUnitNumber));
  }

  res.status(201).json({
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    unitNumber: newUser.unitNumber,
    unpaidBalance: parseFloat(newUser.unpaidBalance),
    createdAt: newUser.createdAt,
  });
});

export default router;
