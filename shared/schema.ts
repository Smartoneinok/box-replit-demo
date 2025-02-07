import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  boxUserId: text("box_user_id"),
  boxAccessToken: text("box_access_token"),
  boxTokenExpiresAt: timestamp("box_token_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Create separate schema for session table to preserve it
export const sessions = pgTable("session", {
  sid: text("sid").primaryKey(),
  sess: text("sess").notNull(),
  expire: timestamp("expire", { mode: "date" }).notNull(),
});

export const insertUserSchema = createInsertSchema(users, {
  password: z.string().min(6, "Password must be at least 6 characters"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  boxUserId: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Box Types
export interface BoxFile {
  id: string;
  type: "file";
  name: string;
  size: number;
  modified_at: string;
}

export interface BoxFolder {
  id: string;
  type: "folder";
  name: string;
  item_count: number;
  modified_at: string;
}

export interface BoxItemCollection {
  total_count: number;
  entries: (BoxFile | BoxFolder)[];
}