import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { getBoxClient } from "./box";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  app.get("/api/files", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const folderId = req.query.folderId || "0";
      const client = await getBoxClient(req.user!);
      const items = await client.folders.getItems(folderId as string, { 
        fields: "id,name,size,modified_at,type,item_count" 
      });
      res.json(items);
    } catch (err) {
      console.error('Error fetching files:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      res.status(500).json({ error: errorMessage });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}