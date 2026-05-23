import { pgTable, text, serial, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const householdsTable = pgTable("households", {
  id: serial("id").primaryKey(),
  unitNumber: text("unit_number").notNull().unique(),
  ownerName: text("owner_name").notNull(),
  email: text("email").notNull(),
  unpaidBalance: numeric("unpaid_balance", { precision: 10, scale: 2 }).notNull().default("0"),
  userId: integer("user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertHouseholdSchema = createInsertSchema(householdsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHousehold = z.infer<typeof insertHouseholdSchema>;
export type Household = typeof householdsTable.$inferSelect;
