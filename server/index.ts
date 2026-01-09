import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectMem from "memorystore";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
const isProduction = app.get("env") === "production";
if (isProduction) {
  // Respect X-Forwarded-* headers from the reverse proxy (Nginx).
  app.set("trust proxy", 1);
}
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const MemStore = connectMem(session);
const oneDayMs = 24 * 60 * 60 * 1000;
const sessionMaxAgeMs = Number(process.env.SESSION_MAX_AGE_MS ?? oneDayMs);
const sessionSecret = process.env.SESSION_SECRET ?? "dev-secret";
app.use(
  session({
    cookie: {
      maxAge: sessionMaxAgeMs,
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
    },
    store: new MemStore({ checkPeriod: sessionMaxAgeMs }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
  })
);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (!isProduction) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  const listenOptions: any = { port, host: "0.0.0.0" };
  // Windows does not support the `reusePort` option which
  // results in an ENOTSUP error when starting the server.
  if (process.platform !== "win32") {
    listenOptions.reusePort = true;
  }

  server.listen(listenOptions, () => {
    log(`serving on port ${port}`);
  });
})();
