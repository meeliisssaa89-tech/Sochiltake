import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export function CartSheet() {
  const { isOpen, setIsOpen, items, updateQuantity, removeItem, cartTotal } = useCart();

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="w-full sm:max-w-md flex flex-col h-full bg-white">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">Shopping Cart</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4">
            <p className="text-muted-foreground">Your cart is empty.</p>
            <Button onClick={() => setIsOpen(false)} variant="outline">Continue Shopping</Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 -mx-6 px-6 my-4">
              <div className="space-y-6">
                {items.map((item) => (
                  <div key={`${item.product.id}-${item.size}-${item.color}`} className="flex space-x-4">
                    <div className="w-20 h-24 bg-gray-100 rounded-sm overflow-hidden">
                      {item.product.images[0] ? (
                        <img 
                          src={item.product.images[0]} 
                          alt={item.product.name} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <h4 className="font-medium text-sm leading-none">{item.product.name}</h4>
                      <p className="text-sm text-muted-foreground">{item.size} / {item.color}</p>
                      <p className="text-sm font-medium">${Number(item.product.price).toFixed(2)}</p>
                      
                      <div className="flex items-center space-x-2 mt-2">
                        <div className="flex items-center border border-gray-200 rounded-sm">
                          <button 
                            className="p-1 hover:bg-gray-100"
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.size, item.color)}
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center text-xs">{item.quantity}</span>
                          <button 
                            className="p-1 hover:bg-gray-100"
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.size, item.color)}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-muted-foreground hover:text-red-600"
                          onClick={() => removeItem(item.product.id, item.size, item.color)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <div className="space-y-4 pt-4 border-t border-gray-100">
              <div className="flex justify-between text-base font-medium">
                <span>Subtotal</span>
                <span>${cartTotal.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Shipping and taxes calculated at checkout.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Continue Shopping
                </Button>
                <Link href="/checkout" onClick={() => setIsOpen(false)}>
                  <Button className="w-full bg-black text-white hover:bg-gray-800">Checkout</Button>
                </Link>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
