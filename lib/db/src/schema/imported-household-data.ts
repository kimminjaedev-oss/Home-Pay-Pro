import { boolean, integer, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Staging table for Excel-imported household data.
 * Used to match users during registration before a live household record exists.
 */
export const importedHouseholdDataTable = pgTable("imported_household_data", {
  id: serial("id").primaryKey(),
  unitNumber: text("unit_number").notNull().unique(),
  ownerName: text("owner_name").notNull(),
  email: text("email").notNull(),
  unpaidBalance: numeric("unpaid_balance", { precision: 10, scale: 2 }).notNull().default("0"),
  overdueSince: timestamp("overdue_since", { withTimezone: true }),
  /** Set to true once a user registers and matches this staging record */
  isMatched: boolean("is_matched").notNull().default(false),
  matchedUserId: integer("matched_user_id"),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertImportedHouseholdDataSchema = createInsertSchema(importedHouseholdDataTable).omit({
  id: true,
  importedAt: true,
  updatedAt: true,
});
export type InsertImportedHouseholdData = z.infer<typeof insertImportedHouseholdDataSchema>;
export type ImportedHouseholdData = typeof importedHouseholdDataTable.$inferSelect;
