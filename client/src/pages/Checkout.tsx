import { Navbar } from "@/components/Navbar";
import { useCart } from "@/hooks/use-cart";
import { useCreateOrder } from "@/hooks/use-orders";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

// Simplified schema for guest checkout form
const checkoutSchema = z.object({
  firstName: z.string().min(1, "First Name is required"),
  lastName: z.string().min(1, "Last Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(5, "Phone is required"),
  address: z.string().min(5, "Address is required"),
  city: z.string().min(1, "City is required"),
  zip: z.string().min(1, "ZIP is required"),
  country: z.string().min(1, "Country is required"),
});

export default function Checkout() {
  const { items, cartTotal, clearCart } = useCart();
  const { mutate: createOrder, isPending } = useCreateOrder();
  const [, setLocation] = useLocation();

  const form = useForm<z.infer<typeof checkoutSchema>>({
    resolver: zodResolver(checkoutSchema)
  });

  const onSubmit = (data: z.infer<typeof checkoutSchema>) => {
    createOrder({
      customerName: `${data.firstName} ${data.lastName}`,
      customerEmail: data.email,
      customerPhone: data.phone,
      address: {
        street: data.address,
        city: data.city,
        zip: data.zip,
        country: data.country
      },
      totalAmount: cartTotal,
      items: items.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        size: item.size,
        color: item.color,
        productName: item.product.name,
        price: item.product.price
      }))
    }, {
      onSuccess: () => {
        clearCart();
        alert("Order placed successfully!");
        setLocation("/");
      }
    });
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="container mx-auto px-4 pt-32 text-center">
          <h1 className="text-2xl font-bold mb-4">Your cart is empty</h1>
          <Button onClick={() => setLocation("/products")}>Start Shopping</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-32 pb-24">
        <h1 className="text-3xl font-serif font-bold mb-8 text-center">Checkout</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
          {/* Form */}
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold mb-6">Shipping Details</h2>
            <form id="checkout-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input {...form.register("firstName")} placeholder="First Name" />
                <Input {...form.register("lastName")} placeholder="Last Name" />
              </div>
              <Input {...form.register("email")} placeholder="Email Address" />
              <Input {...form.register("phone")} placeholder="Phone Number" />
              <Input {...form.register("address")} placeholder="Street Address" />
              <div className="grid grid-cols-2 gap-4">
                <Input {...form.register("city")} placeholder="City" />
                <Input {...form.register("zip")} placeholder="ZIP Code" />
              </div>
              <Input {...form.register("country")} placeholder="Country" />
            </form>
          </div>

          {/* Summary */}
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold mb-6">Order Summary</h2>
              <div className="space-y-4 mb-6">
                {items.map(item => (
                  <div key={`${item.product.id}-${item.size}`} className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{item.product.name}</p>
                      <p className="text-sm text-gray-500">Qty: {item.quantity} {item.size && `| Size: ${item.size}`}</p>
                    </div>
                    <p className="font-medium">${(Number(item.product.price) * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Shipping</span>
                  <span>Free</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t mt-2">
                  <span>Total</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
              </div>
              
              <Button 
                type="submit" 
                form="checkout-form" 
                className="w-full mt-6 bg-black text-white hover:bg-gray-800 h-12 text-lg" 
                disabled={isPending}
              >
                {isPending ? "Processing..." : "Place Order"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
