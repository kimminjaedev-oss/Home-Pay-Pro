import { Router } from "express";
import Stripe from "stripe";
import { eq, sql, desc } from "drizzle-orm";
import { db, usersTable, paymentsTable, householdsTable } from "@workspace/db";
import {
  CreateCheckoutBody,
  CreateCheckoutResponse,
  GetPaymentHistoryQueryParams,
  GetPaymentHistoryResponse,
  StripeWebhookResponse,
  GetAllPaymentsQueryParams,
  GetAllPaymentsResponse,
} from "@workspace/api-zod";
import { requireAuth, requireAdmin, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router = Router();

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
}

const getBaseUrl = (req: AuthenticatedRequest): string => {
  const domains = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (domains) return `https://${domains}`;
  return `${req.protocol}://${req.get("host")}`;
};

router.post("/payments/create-checkout", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateCheckoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const user = req.dbUser!;
  const { amount, description } = parsed.data;

  if (amount < 1) {
    res.status(400).json({ error: "Amount must be at least $1" });
    return;
  }

  const stripe = getStripe();
  const baseUrl = getBaseUrl(req);

  const [payment] = await db
    .insert(paymentsTable)
    .values({
      userId: user.id,
      amount: String(amount),
      status: "pending",
    })
    .returning();

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: description ?? `Maintenance Fee - Unit ${user.unitNumber ?? "N/A"}`,
              description: `Payment for ${user.name}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/payment/cancel`,
      metadata: {
        userId: String(user.id),
        paymentId: String(payment.id),
        unitNumber: user.unitNumber ?? "",
      },
    });

    await db
      .update(paymentsTable)
      .set({ stripeSessionId: session.id })
      .where(eq(paymentsTable.id, payment.id));

    res.json(CreateCheckoutResponse.parse({ url: session.url, sessionId: session.id }));
  } catch (err) {
    await db
      .update(paymentsTable)
      .set({ status: "failed" })
      .where(eq(paymentsTable.id, payment.id));
    req.log.error({ err }, "Failed to create Stripe checkout");
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

router.get("/payments/history", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = GetPaymentHistoryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const user = req.dbUser!;
  const { page = 1, limit = 20 } = parsed.data;
  const offset = (page - 1) * limit;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(paymentsTable)
    .where(eq(paymentsTable.userId, user.id));

  const rows = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.userId, user.id))
    .orderBy(desc(paymentsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(
    GetPaymentHistoryResponse.parse({
      payments: rows.map((p) => ({
        id: p.id,
        userId: p.userId,
        userName: user.name,
        userEmail: user.email,
        unitNumber: user.unitNumber,
        amount: parseFloat(p.amount),
        stripeSessionId: p.stripeSessionId,
        status: p.status,
        createdAt: p.createdAt,
      })),
      total: count,
      page,
      limit,
    }),
  );
});

router.get("/payments/all", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = GetAllPaymentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { page = 1, limit = 20 } = parsed.data;
  const offset = (page - 1) * limit;

  const rows = await db
    .select({
      payment: paymentsTable,
      userName: usersTable.name,
      userEmail: usersTable.email,
      unitNumber: usersTable.unitNumber,
    })
    .from(paymentsTable)
    .leftJoin(usersTable, eq(paymentsTable.userId, usersTable.id))
    .orderBy(desc(paymentsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(paymentsTable);

  res.json(
    GetAllPaymentsResponse.parse({
      payments: rows.map(({ payment, userName, userEmail, unitNumber }) => ({
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
      total: count,
      page,
      limit,
    }),
  );
});

// Stripe webhook — raw body, no auth
router.post("/payments/webhook", async (req, res): Promise<void> => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    res.status(500).json({ error: "Webhook secret not configured" });
    return;
  }

  const sig = req.headers["stripe-signature"];
  if (!sig || typeof sig !== "string") {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
  } catch (err) {
    logger.error({ err }, "Stripe webhook signature verification failed");
    res.status(400).json({ error: "Webhook signature verification failed" });
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = parseInt(session.metadata?.userId ?? "0", 10);
    const paymentId = parseInt(session.metadata?.paymentId ?? "0", 10);
    const amount = (session.amount_total ?? 0) / 100;

    await db
      .update(paymentsTable)
      .set({ status: "completed" })
      .where(eq(paymentsTable.id, paymentId));

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (user) {
      const newBalance = Math.max(0, parseFloat(user.unpaidBalance) - amount);
      await db
        .update(usersTable)
        .set({ unpaidBalance: String(newBalance) })
        .where(eq(usersTable.id, userId));

      await db
        .update(householdsTable)
        .set({ unpaidBalance: String(newBalance) })
        .where(eq(householdsTable.userId, userId));
    }

    logger.info({ userId, paymentId, amount }, "Payment completed via webhook");
  }

  res.json(StripeWebhookResponse.parse({ message: "Webhook received" }));
});

export default router;
