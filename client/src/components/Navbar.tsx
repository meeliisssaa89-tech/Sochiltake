import { Link, useLocation } from "wouter";
import { ShoppingBag, Menu, X, Search, User } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { CartSheet } from "./CartSheet";
import { useAuth } from "@/hooks/use-auth";

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { cartCount, setIsOpen: setOpenCart } = useCart();
  const [location] = useLocation();
  const { data: user } = useAuth();

  const isTransparent = location === "/";

  return (
    <>
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isTransparent && !isMenuOpen 
            ? "bg-transparent text-white border-transparent" 
            : "bg-white text-black border-b border-gray-100"
        }`}
      >
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          {/* Mobile Menu Button */}
          <button 
            className="lg:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X /> : <Menu />}
          </button>

          {/* Logo */}
          <Link href="/" className="text-2xl font-serif font-bold tracking-tighter">
            LUXE.
          </Link>

          {/* Desktop Links */}
          <div className="hidden lg:flex items-center space-x-8">
            <Link href="/" className="text-sm font-medium hover:text-red-500 transition-colors">HOME</Link>
            <Link href="/products" className="text-sm font-medium hover:text-red-500 transition-colors">SHOP</Link>
            <Link href="/products?category=new" className="text-sm font-medium hover:text-red-500 transition-colors">NEW ARRIVALS</Link>
            <Link href="/about" className="text-sm font-medium hover:text-red-500 transition-colors">ABOUT</Link>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" className="hidden sm:flex hover:bg-transparent hover:text-red-500">
              <Search className="w-5 h-5" />
            </Button>
            
            <Link href={user ? "/admin" : "/admin/login"}>
              <Button variant="ghost" size="icon" className="hidden sm:flex hover:bg-transparent hover:text-red-500">
                <User className="w-5 h-5" />
              </Button>
            </Link>

            <Button 
              variant="ghost" 
              size="icon" 
              className="relative hover:bg-transparent hover:text-red-500"
              onClick={() => setOpenCart(true)}
            >
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
                  {cartCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden bg-white text-black border-b border-gray-100 overflow-hidden"
            >
              <div className="flex flex-col p-4 space-y-4">
                <Link href="/" onClick={() => setIsMenuOpen(false)} className="text-lg font-medium">HOME</Link>
                <Link href="/products" onClick={() => setIsMenuOpen(false)} className="text-lg font-medium">SHOP</Link>
                <Link href="/products?category=new" onClick={() => setIsMenuOpen(false)} className="text-lg font-medium">NEW ARRIVALS</Link>
                <Link href="/about" onClick={() => setIsMenuOpen(false)} className="text-lg font-medium">ABOUT</Link>
                <div className="pt-4 border-t border-gray-100 flex space-x-4">
                  <Link href="/admin/login" className="text-sm text-gray-500">Account</Link>
                  <span className="text-sm text-gray-500">Search</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <CartSheet />
    </>
  );
}
