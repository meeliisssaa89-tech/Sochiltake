import { pgTable, text, serial, integer, boolean, timestamp, jsonb, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users (Admins)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").default("admin").notNull(),
});

// Categories
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  imageUrl: text("image_url"),
});

// Products
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }), // For discounts
  stock: integer("stock").notNull().default(0),
  categoryId: integer("category_id").references(() => categories.id),
  images: text("images").array().notNull(), // Array of image URLs
  sizes: text("sizes").array().default([]),
  colors: text("colors").array().default([]),
  isFeatured: boolean("is_featured").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Orders
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  address: jsonb("address").notNull(), // { street, city, zip, country }
  status: text("status").default("pending").notNull(), // pending, processing, shipped, delivered, cancelled
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Order Items
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  productId: integer("product_id").references(() => products.id), // Nullable if product deleted
  productName: text("product_name").notNull(), // Snapshot of name
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(), // Snapshot of price
  size: text("size"),
  color: text("color"),
});

// Site Content (Banners, Hero Sections)
export const siteContent = pgTable("site_content", {
  id: serial("id").primaryKey(),
  section: text("section").notNull(), // 'hero', 'promo_banner', 'about'
  title: text("title"),
  subtitle: text("subtitle"),
  imageUrl: text("image_url"),
  link: text("link"),
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order").default(0),
});

// Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true });
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true });
export const insertSiteContentSchema = createInsertSchema(siteContent).omit({ id: true });

// Types
export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type SiteContent = typeof siteContent.$inferSelect;
