import { db } from "./db";
import {
  users, products, categories, orders, orderItems, siteContent,
  type User, type InsertUser,
  type Product, type Category, type Order, type SiteContent,
  type OrderItem, type InsertProduct
} from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // Auth & Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  sessionStore: session.Store;

  // Products
  getProducts(filters?: { categoryId?: number; isFeatured?: boolean; search?: string }): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: number): Promise<void>;

  // Categories
  getCategories(): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  createCategory(category: Partial<Category>): Promise<Category>;
  deleteCategory(id: number): Promise<void>;

  // Orders
  createOrder(order: Partial<Order> & { items: Partial<OrderItem>[] }): Promise<Order>;
  getOrders(): Promise<Order[]>;
  getOrder(id: number): Promise<Order & { items: OrderItem[] } | undefined>;
  updateOrderStatus(id: number, status: string): Promise<Order>;

  // Content
  getSiteContent(section?: string): Promise<SiteContent[]>;
  createSiteContent(content: Partial<SiteContent>): Promise<SiteContent>;
  deleteSiteContent(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  // Auth
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Products
  async getProducts(filters?: { categoryId?: number; isFeatured?: boolean; search?: string }): Promise<Product[]> {
    let query = db.select().from(products);
    
    if (filters) {
      if (filters.categoryId) {
        query.where(eq(products.categoryId, filters.categoryId));
      }
      if (filters.isFeatured !== undefined) {
        query.where(eq(products.isFeatured, filters.isFeatured));
      }
      // Simple search (can be improved)
      if (filters.search) {
        query.where(sql`${products.name} ILIKE ${`%${filters.search}%`}`);
      }
    }
    
    return await query.orderBy(desc(products.createdAt));
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(insertProduct).returning();
    return product;
  }

  async updateProduct(id: number, updates: Partial<InsertProduct>): Promise<Product> {
    const [product] = await db.update(products).set(updates).where(eq(products.id, id)).returning();
    return product;
  }

  async deleteProduct(id: number): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async createCategory(category: Partial<Category>): Promise<Category> {
    const [cat] = await db.insert(categories).values(category as any).returning();
    return cat;
  }

  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  // Orders
  async createOrder(orderData: Partial<Order> & { items: Partial<OrderItem>[] }): Promise<Order> {
    return await db.transaction(async (tx) => {
      const [order] = await tx.insert(orders).values({
        customerName: orderData.customerName!,
        customerEmail: orderData.customerEmail!,
        customerPhone: orderData.customerPhone!,
        address: orderData.address!,
        totalAmount: orderData.totalAmount!,
      }).returning();

      for (const item of orderData.items) {
        await tx.insert(orderItems).values({
          orderId: order.id,
          productId: item.productId,
          productName: item.productName!,
          quantity: item.quantity!,
          price: item.price!,
          size: item.size,
          color: item.color,
        });
      }
      return order;
    });
  }

  async getOrders(): Promise<Order[]> {
    return await db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async getOrder(id: number): Promise<Order & { items: OrderItem[] } | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return undefined;

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
    return { ...order, items };
  }

  async updateOrderStatus(id: number, status: string): Promise<Order> {
    const [order] = await db.update(orders).set({ status }).where(eq(orders.id, id)).returning();
    return order;
  }

  // Content
  async getSiteContent(section?: string): Promise<SiteContent[]> {
    if (section) {
      return await db.select().from(siteContent).where(eq(siteContent.section, section));
    }
    return await db.select().from(siteContent);
  }

  async createSiteContent(content: Partial<SiteContent>): Promise<SiteContent> {
    const [newItem] = await db.insert(siteContent).values(content as any).returning();
    return newItem;
  }

  async deleteSiteContent(id: number): Promise<void> {
    await db.delete(siteContent).where(eq(siteContent.id, id));
  }
}

export const storage = new DatabaseStorage();
