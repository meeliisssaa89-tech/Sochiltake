import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Authentication
  setupAuth(app);

  // === Products ===
  app.get(api.products.list.path, async (req, res) => {
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const isFeatured = req.query.isFeatured === 'true';
    const search = req.query.search as string;
    
    const products = await storage.getProducts({ categoryId, isFeatured, search });
    res.json(products);
  });

  app.get(api.products.get.path, async (req, res) => {
    const product = await storage.getProduct(Number(req.params.id));
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  });

  app.post(api.products.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const input = api.products.create.input.parse(req.body);
      const product = await storage.createProduct(input);
      res.status(201).json(product);
    } catch (e) {
      res.status(400).json(e);
    }
  });

  app.put(api.products.update.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const input = api.products.update.input.parse(req.body);
      const product = await storage.updateProduct(Number(req.params.id), input);
      res.json(product);
    } catch (e) {
      res.status(400).json(e);
    }
  });

  app.delete(api.products.delete.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    await storage.deleteProduct(Number(req.params.id));
    res.sendStatus(204);
  });

  // === Categories ===
  app.get(api.categories.list.path, async (req, res) => {
    const categories = await storage.getCategories();
    res.json(categories);
  });

  app.post(api.categories.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const category = await storage.createCategory(req.body);
    res.status(201).json(category);
  });

  app.delete(api.categories.delete.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    await storage.deleteCategory(Number(req.params.id));
    res.sendStatus(204);
  });

  // === Orders ===
  app.post(api.orders.create.path, async (req, res) => {
    try {
      const input = api.orders.create.input.parse(req.body);
      
      // Enrich items with current product data (price, name) to snapshot it
      const enrichedItems = await Promise.all(input.items.map(async (item) => {
        const product = await storage.getProduct(item.productId);
        if (!product) throw new Error(`Product ${item.productId} not found`);
        return {
          ...item,
          productName: product.name,
          price: product.price, // Use current price
        };
      }));

      // Calculate total
      const totalAmount = enrichedItems.reduce((sum, item) => {
        return sum + (Number(item.price) * item.quantity);
      }, 0).toString();

      const order = await storage.createOrder({
        ...input,
        totalAmount,
        items: enrichedItems,
      });
      res.status(201).json(order);
    } catch (e) {
      console.error(e);
      res.status(400).json({ message: "Invalid order data" });
    }
  });

  app.get(api.orders.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const orders = await storage.getOrders();
    res.json(orders);
  });

  app.get(api.orders.get.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const order = await storage.getOrder(Number(req.params.id));
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  });

  app.patch(api.orders.updateStatus.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const order = await storage.updateOrderStatus(Number(req.params.id), req.body.status);
    res.json(order);
  });

  // === Site Content ===
  app.get(api.content.list.path, async (req, res) => {
    const section = req.query.section as string;
    const content = await storage.getSiteContent(section);
    res.json(content);
  });

  app.post(api.content.update.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const content = await storage.createSiteContent(req.body);
    res.status(201).json(content);
  });

  app.delete(api.content.delete.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    await storage.deleteSiteContent(Number(req.params.id));
    res.sendStatus(204);
  });

  // Seed Data function (call if DB is empty)
  seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existingAdmin = await storage.getUserByUsername("admin");
  if (!existingAdmin) {
    const hashedPassword = await hashPassword("admin123");
    await storage.createUser({
      username: "admin",
      password: hashedPassword,
      role: "admin"
    });
    console.log("Admin user created (admin / admin123)");
  }

  const categories = await storage.getCategories();
  if (categories.length === 0) {
    console.log("Seeding database...");
    
    const cat1 = await storage.createCategory({ name: "Footwear", slug: "footwear", imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff" });
    const cat2 = await storage.createCategory({ name: "Accessories", slug: "accessories", imageUrl: "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd" });

    await storage.createProduct({
      name: "Urban Runner X",
      description: "High-performance running shoes with adaptive cushioning.",
      price: "129.99",
      stock: 50,
      categoryId: cat1.id,
      images: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff", "https://images.unsplash.com/photo-1608231387042-66d1773070a5"],
      sizes: ["40", "41", "42", "43", "44"],
      colors: ["Black", "White", "Red"],
      isFeatured: true
    });

    await storage.createProduct({
      name: "Classic Leather Wallet",
      description: "Premium genuine leather wallet with RFID protection.",
      price: "49.99",
      stock: 100,
      categoryId: cat2.id,
      images: ["https://images.unsplash.com/photo-1627123424574-18bd0833e481"],
      colors: ["Brown", "Black"],
      isFeatured: false
    });

    await storage.createSiteContent({
      section: "hero",
      title: "New Season Arrivals",
      subtitle: "Discover the latest trends in urban fashion.",
      imageUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b",
      link: "/products",
      isActive: true
    });
    
    console.log("Database seeded!");
  }
}

