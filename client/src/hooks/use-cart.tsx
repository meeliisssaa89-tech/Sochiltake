import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Product } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export type CartItem = {
  product: Product;
  quantity: number;
  size?: string;
  color?: string;
};

type CartContextType = {
  items: CartItem[];
  addItem: (product: Product, quantity: number, size?: string, color?: string) => void;
  removeItem: (productId: number, size?: string, color?: string) => void;
  updateQuantity: (productId: number, quantity: number, size?: string, color?: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem("cart-items");
    if (saved) {
      try {
        setItems(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse cart items", e);
      }
    }
  }, []);

  // Save to local storage
  useEffect(() => {
    localStorage.setItem("cart-items", JSON.stringify(items));
  }, [items]);

  const addItem = (product: Product, quantity: number, size?: string, color?: string) => {
    setItems((prev) => {
      const existing = prev.find(
        (item) =>
          item.product.id === product.id &&
          item.size === size &&
          item.color === color
      );

      if (existing) {
        return prev.map((item) =>
          item === existing
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity, size, color }];
    });
    setIsOpen(true);
    toast({
      title: "Added to cart",
      description: `${product.name} has been added to your cart.`,
    });
  };

  const removeItem = (productId: number, size?: string, color?: string) => {
    setItems((prev) =>
      prev.filter(
        (item) =>
          !(
            item.product.id === productId &&
            item.size === size &&
            item.color === color
          )
      )
    );
  };

  const updateQuantity = (
    productId: number,
    quantity: number,
    size?: string,
    color?: string
  ) => {
    if (quantity < 1) {
      removeItem(productId, size, color);
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId &&
        item.size === size &&
        item.color === color
          ? { ...item, quantity }
          : item
      )
    );
  };

  const clearCart = () => setItems([]);

  const cartCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const cartTotal = items.reduce(
    (acc, item) => acc + Number(item.product.price) * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        cartCount,
        cartTotal,
        isOpen,
        setIsOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
}
