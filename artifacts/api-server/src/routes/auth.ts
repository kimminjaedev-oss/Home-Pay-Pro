import { getAuth } from "@clerk/express";
import { GetMeResponse } from "@workspace/api-zod";
import { db, householdsTable, importedHouseholdDataTable, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

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
  const clerkId = (auth?.sessionClaims?.userId as string | undefined) || auth?.userId || undefined;

  if (!clerkId) {
    res.status(401).json({
      error: "Unauthorized",
      debug: {
        userId: auth?.userId,
        sessionClaimsKeys: auth?.sessionClaims ? Object.keys(auth.sessionClaims) : null,
      }
    });
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
    }
  }

  // If no live household match, search the staging import table
  if (unpaidBalance === 0 && (unitNumber || email)) {
    const stagingConditions = [];
    if (unitNumber) stagingConditions.push(eq(importedHouseholdDataTable.unitNumber, unitNumber));
    if (email) stagingConditions.push(eq(importedHouseholdDataTable.email, email.toLowerCase()));

    const [stagingRow] = await db
      .select()
      .from(importedHouseholdDataTable)
      .where(or(...stagingConditions))
      .limit(1);

    if (stagingRow) {
      unpaidBalance = parseFloat(stagingRow.unpaidBalance);
      matchedUnitNumber = stagingRow.unitNumber;
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

  // Mark the staging record as matched and ensure a live household record exists
  if (matchedUnitNumber) {
    await db
      .update(importedHouseholdDataTable)
      .set({ isMatched: true, matchedUserId: newUser.id })
      .where(eq(importedHouseholdDataTable.unitNumber, matchedUnitNumber));

    // Auto-create a live household record if one doesn't already exist
    const [existingHousehold] = await db
      .select({ id: householdsTable.id })
      .from(householdsTable)
      .where(eq(householdsTable.unitNumber, matchedUnitNumber))
      .limit(1);

    if (!existingHousehold) {
      // Fetch the staging row to get all details
      const [stagingRow] = await db
        .select()
        .from(importedHouseholdDataTable)
        .where(eq(importedHouseholdDataTable.unitNumber, matchedUnitNumber))
        .limit(1);

      if (stagingRow) {
        await db.insert(householdsTable).values({
          unitNumber: stagingRow.unitNumber,
          ownerName: stagingRow.ownerName,
          email: stagingRow.email,
          unpaidBalance: stagingRow.unpaidBalance,
          overdueSince: stagingRow.overdueSince,
          userId: newUser.id,
        });
      }
    } else {
      await db
        .update(householdsTable)
        .set({ userId: newUser.id })
        .where(eq(householdsTable.unitNumber, matchedUnitNumber));
    }
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
