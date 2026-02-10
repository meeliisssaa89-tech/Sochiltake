import { useAuth, useLogout } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Package, 
  Users, 
  Settings, 
  LogOut,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProducts, useCreateProduct, useDeleteProduct } from "@/hooks/use-products";
import { useOrders } from "@/hooks/use-orders";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProductSchema } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { z } from "zod";

function AdminSidebar() {
  const { mutate: logout } = useLogout();
  const [location] = useLocation();

  const links = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/products", label: "Products", icon: Package },
    { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
    { href: "/admin/customers", label: "Customers", icon: Users },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="w-64 bg-gray-900 text-white min-h-screen p-6 flex flex-col">
      <h2 className="text-2xl font-serif font-bold mb-10">LUXE Admin</h2>
      <nav className="flex-1 space-y-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            <div className={`flex items-center space-x-3 px-4 py-3 rounded-lg cursor-pointer transition-colors ${
              location === link.href ? "bg-red-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}>
              <link.icon className="w-5 h-5" />
              <span>{link.label}</span>
            </div>
          </Link>
        ))}
      </nav>
      <Button 
        variant="ghost" 
        className="justify-start text-gray-400 hover:text-white hover:bg-gray-800"
        onClick={() => logout()}
      >
        <LogOut className="w-5 h-5 mr-3" />
        Logout
      </Button>
    </div>
  );
}

function ProductForm({ onSuccess }: { onSuccess: () => void }) {
  const { mutate, isPending } = useCreateProduct();
  const form = useForm<z.infer<typeof insertProductSchema>>({
    resolver: zodResolver(insertProductSchema),
    defaultValues: {
      name: "",
      description: "",
      price: "0",
      stock: 0,
      images: [],
      sizes: ["S", "M", "L", "XL"],
      colors: ["Black", "White"],
    }
  });

  const onSubmit = (data: any) => {
    mutate(data, {
      onSuccess: () => {
        form.reset();
        onSuccess();
      }
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Name</label>
        <Input {...form.register("name")} placeholder="Product Name" />
      </div>
      <div>
        <label className="text-sm font-medium">Description</label>
        <Textarea {...form.register("description")} placeholder="Description" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Price</label>
          <Input type="number" step="0.01" {...form.register("price")} />
        </div>
        <div>
          <label className="text-sm font-medium">Stock</label>
          <Input type="number" {...form.register("stock", { valueAsNumber: true })} />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Image URL</label>
        <Input 
          placeholder="https://..." 
          onChange={(e) => form.setValue("images", [e.target.value])}
        />
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Creating..." : "Create Product"}
      </Button>
    </form>
  );
}

function ProductsTable() {
  const { data: products } = useProducts();
  const { mutate: deleteProduct } = useDeleteProduct();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Products</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="bg-black text-white"><Plus className="w-4 h-4 mr-2" /> Add Product</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
            </DialogHeader>
            <ProductForm onSuccess={() => setIsOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 text-left text-sm font-medium text-gray-500">
            <tr>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Price</th>
              <th className="px-6 py-4">Stock</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products?.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-100 rounded bg-cover bg-center" style={{ backgroundImage: `url(${product.images[0]})` }} />
                    <span className="font-medium">{product.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4">${Number(product.price).toFixed(2)}</td>
                <td className="px-6 py-4">{product.stock}</td>
                <td className="px-6 py-4 text-right">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => {
                      if (confirm("Are you sure?")) deleteProduct(product.id);
                    }}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
            {(!products || products.length === 0) && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No products found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrdersTable() {
  const { data: orders } = useOrders();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Orders</h1>
      <div className="bg-white rounded-lg shadow border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 text-left text-sm font-medium text-gray-500">
            <tr>
              <th className="px-6 py-4">Order ID</th>
              <th className="px-6 py-4">Customer</th>
              <th className="px-6 py-4">Total</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders?.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-mono">#{order.id.toString().padStart(6, '0')}</td>
                <td className="px-6 py-4">{order.customerName}</td>
                <td className="px-6 py-4">${Number(order.totalAmount).toFixed(2)}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                    order.status === 'delivered' ? 'bg-green-100 text-green-800' : 
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {new Date(order.createdAt!).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {(!orders || orders.length === 0) && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No orders found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [location] = useLocation();
  const { data: user, isLoading } = useAuth();

  if (isLoading) return <div className="h-screen flex items-center justify-center">Loading...</div>;
  if (!user) {
    window.location.href = "/admin/login";
    return null;
  }

  // Simple Router for dashboard content
  const getContent = () => {
    switch (location) {
      case "/admin/products": return <ProductsTable />;
      case "/admin/orders": return <OrdersTable />;
      default: return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-sm font-medium text-muted-foreground">Total Sales</h3>
            <p className="text-3xl font-bold mt-2">$12,450.00</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-sm font-medium text-muted-foreground">Total Orders</h3>
            <p className="text-3xl font-bold mt-2">156</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-sm font-medium text-muted-foreground">Active Customers</h3>
            <p className="text-3xl font-bold mt-2">1,203</p>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 p-8">
        {getContent()}
      </main>
    </div>
  );
}
