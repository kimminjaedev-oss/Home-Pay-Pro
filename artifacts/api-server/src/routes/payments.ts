import {
    CreateCheckoutBody,
    CreateCheckoutResponse,
    GetAllPaymentsQueryParams,
    GetAllPaymentsResponse,
    GetPaymentHistoryQueryParams,
    GetPaymentHistoryResponse,
    StripeWebhookResponse,
} from "@workspace/api-zod";
import { db, householdsTable, paymentsTable, usersTable } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { Router } from "express";
import Stripe from "stripe";
import { logger } from "../lib/logger";
import { requireAdmin, requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router = Router();

function isLocalHostLike(hostOrDomain: string): boolean {
  const host = hostOrDomain.split(":")[0]?.toLowerCase() ?? "";
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
}

const getBaseUrl = (req: AuthenticatedRequest): string => {
  const domains = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (domains) {
    const protocol = isLocalHostLike(domains) ? "http" : "https";
    return `${protocol}://${domains}`;
  }
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

router.post("/payments/confirm", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const user = req.dbUser!;
  const sessionId = String(req.body?.sessionId ?? "").trim();

  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      res.status(400).json({ error: "Payment is not completed yet" });
      return;
    }

    const metadataUserId = parseInt(session.metadata?.userId ?? "0", 10);
    const paymentId = parseInt(session.metadata?.paymentId ?? "0", 10);
    const amount = (session.amount_total ?? 0) / 100;

    if (!paymentId || !metadataUserId) {
      res.status(400).json({ error: "Invalid checkout metadata" });
      return;
    }

    if (metadataUserId !== user.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [payment] = await db
      .select()
      .from(paymentsTable)
      .where(and(eq(paymentsTable.id, paymentId), eq(paymentsTable.userId, user.id)))
      .limit(1);

    if (!payment) {
      res.status(404).json({ error: "Payment not found" });
      return;
    }

    if (payment.status === "completed") {
      res.json({ message: "Payment already completed" });
      return;
    }

    await db
      .update(paymentsTable)
      .set({ status: "completed" })
      .where(eq(paymentsTable.id, paymentId));

    const newBalance = Math.max(0, parseFloat(user.unpaidBalance) - amount);
    await db
      .update(usersTable)
      .set({ unpaidBalance: String(newBalance) })
      .where(eq(usersTable.id, user.id));

    await db
      .update(householdsTable)
      .set({ unpaidBalance: String(newBalance) })
      .where(eq(householdsTable.userId, user.id));

    logger.info({ userId: user.id, paymentId, amount }, "Payment confirmed from success callback");
    res.json({ message: "Payment confirmed" });
  } catch (err) {
    req.log.error({ err }, "Failed to confirm payment session");
    res.status(500).json({ error: "Failed to confirm payment" });
  }
});

router.post("/payments/reconcile", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const user = req.dbUser!;

  const pendingPayments = await db
    .select()
    .from(paymentsTable)
    .where(and(eq(paymentsTable.userId, user.id), eq(paymentsTable.status, "pending")))
    .orderBy(desc(paymentsTable.createdAt));

  const stripe = getStripe();
  let completedCount = 0;
  let totalAppliedAmount = 0;

  for (const payment of pendingPayments) {
    if (!payment.stripeSessionId) continue;

    try {
      const session = await stripe.checkout.sessions.retrieve(payment.stripeSessionId);
      if (session.payment_status !== "paid") continue;

      await db
        .update(paymentsTable)
        .set({ status: "completed" })
        .where(eq(paymentsTable.id, payment.id));

      completedCount += 1;
      totalAppliedAmount += parseFloat(payment.amount);
    } catch (err) {
      logger.warn({ err, paymentId: payment.id }, "Failed to reconcile pending payment");
    }
  }

  if (totalAppliedAmount > 0) {
    const [freshUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .limit(1);

    if (freshUser) {
      const newBalance = Math.max(0, parseFloat(freshUser.unpaidBalance) - totalAppliedAmount);
      await db
        .update(usersTable)
        .set({ unpaidBalance: String(newBalance) })
        .where(eq(usersTable.id, user.id));

      await db
        .update(householdsTable)
        .set({ unpaidBalance: String(newBalance) })
        .where(eq(householdsTable.userId, user.id));
    }
  }

  res.json({
    checked: pendingPayments.length,
    completed: completedCount,
    appliedAmount: totalAppliedAmount,
  });
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

    const [payment] = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, paymentId))
      .limit(1);

    if (!payment) {
      logger.warn({ paymentId, userId }, "Webhook payment metadata points to unknown payment");
      res.json(StripeWebhookResponse.parse({ message: "Webhook received" }));
      return;
    }

    if (payment.status === "completed") {
      logger.info({ paymentId, userId }, "Webhook event ignored: payment already completed");
      res.json(StripeWebhookResponse.parse({ message: "Webhook received" }));
      return;
    }

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
