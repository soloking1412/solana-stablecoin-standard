import { Request, Response, NextFunction } from "express";
import { loadConfig } from "../config";

const SKIP_PATHS = ["/health", "/ready"];

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (SKIP_PATHS.includes(req.path)) {
    return next();
  }

  const apiKey = req.headers["x-api-key"] as string;
  const config = loadConfig();

  if (!apiKey || apiKey !== config.apiKey) {
    res.status(401).json({ error: "Unauthorized: invalid or missing API key" });
    return;
  }

  next();
}
