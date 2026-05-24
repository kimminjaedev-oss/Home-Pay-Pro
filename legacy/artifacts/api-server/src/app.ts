import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import cors from "cors";
import express, { type Express } from "express";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";
import {
    CLERK_PROXY_PATH,
    clerkProxyMiddleware,
    getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));

// Raw body for Stripe webhooks — must come before express.json()
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey:
      process.env.NODE_ENV === "production"
        ? publishableKeyFromHost(
            getClerkProxyHost(req) ?? "",
            process.env.CLERK_PUBLISHABLE_KEY,
          )
        : process.env.CLERK_PUBLISHABLE_KEY,
  })),
);

app.use("/api", router);

export default app;
