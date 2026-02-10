import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useProducts } from "@/hooks/use-products";
import { ProductCard } from "@/components/ProductCard";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight, Truck, RefreshCw, ShieldCheck } from "lucide-react";

export default function Home() {
  const { data: featuredProducts } = useProducts({ isFeatured: true });

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero Section */}
      <section className="relative h-[90vh] w-full bg-black text-white overflow-hidden">
        {/* Abstract Background */}
        <div className="absolute inset-0 bg-neutral-900">
           {/* Placeholder for Unsplash Image - Fashion Model */}
           {/* <img src="https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&q=80" className="w-full h-full object-cover opacity-60" /> */}
           <div className="w-full h-full bg-gradient-to-br from-neutral-900 to-neutral-800" />
        </div>
        
        <div className="relative h-full container mx-auto px-4 flex flex-col justify-center items-start z-10">
          <motion.h1 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold tracking-tight mb-6"
          >
            Elegance <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-500">Redefined.</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="max-w-md text-lg text-gray-300 mb-8 font-light"
          >
            Discover the new collection of premium streetwear tailored for the modern individual.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            <Link href="/products">
              <Button size="lg" className="rounded-none bg-white text-black hover:bg-gray-200 px-8 py-6 text-lg">
                Shop Collection
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-24 container mx-auto px-4">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-3xl font-serif font-bold mb-2">Featured Collection</h2>
            <p className="text-muted-foreground">Handpicked essentials for you.</p>
          </div>
          <Link href="/products" className="hidden sm:flex items-center space-x-2 text-sm font-medium hover:text-red-600 transition-colors">
            <span>View All</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {featuredProducts?.map((product) => (
            <ProductCard key={product.id} product={product} />
          )) || (
            // Loading Skeletons
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="space-y-4">
                <div className="aspect-[3/4] bg-gray-100 animate-pulse" />
                <div className="h-4 w-2/3 bg-gray-100 animate-pulse" />
                <div className="h-4 w-1/3 bg-gray-100 animate-pulse" />
              </div>
            ))
          )}
        </div>
      </section>

      {/* Promo Banner */}
      <section className="py-24 bg-neutral-900 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-serif font-bold mb-6">Join the Movement</h2>
          <p className="max-w-2xl mx-auto text-gray-400 mb-8">
            Sign up for our newsletter to receive exclusive offers and be the first to know about new drops.
          </p>
          <div className="flex max-w-md mx-auto">
            <input 
              type="email" 
              placeholder="Enter your email" 
              className="flex-1 px-4 py-3 bg-neutral-800 border-none focus:ring-1 focus:ring-white outline-none"
            />
            <button className="px-6 py-3 bg-white text-black font-medium hover:bg-gray-200 transition-colors">
              Subscribe
            </button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 border-t border-gray-100">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
              <Truck className="w-6 h-6" />
            </div>
            <h3 className="font-serif font-bold text-lg">Free Worldwide Shipping</h3>
            <p className="text-sm text-muted-foreground max-w-xs">On all orders over $200. Delivered safely to your doorstep.</p>
          </div>
          <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
              <RefreshCw className="w-6 h-6" />
            </div>
            <h3 className="font-serif font-bold text-lg">30 Days Return</h3>
            <p className="text-sm text-muted-foreground max-w-xs">Not satisfied? Return it within 30 days for a full refund.</p>
          </div>
          <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-serif font-bold text-lg">Secure Payment</h3>
            <p className="text-sm text-muted-foreground max-w-xs">We ensure secure payment with 256-bit encryption.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-16">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-12">
          <div>
            <h4 className="font-serif font-bold text-xl mb-6">LUXE.</h4>
            <p className="text-sm text-muted-foreground">Defining modern luxury through minimal aesthetics and premium quality.</p>
          </div>
          <div>
            <h4 className="font-bold mb-6 text-sm uppercase tracking-wider">Shop</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/products?category=men">Men</Link></li>
              <li><Link href="/products?category=women">Women</Link></li>
              <li><Link href="/products?category=accessories">Accessories</Link></li>
              <li><Link href="/products?category=new">New Arrivals</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-6 text-sm uppercase tracking-wider">Company</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/about">About Us</Link></li>
              <li><Link href="/contact">Contact</Link></li>
              <li><Link href="/careers">Careers</Link></li>
              <li><Link href="/terms">Terms & Conditions</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-6 text-sm uppercase tracking-wider">Connect</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>Instagram</li>
              <li>Twitter</li>
              <li>Facebook</li>
              <li>Pinterest</li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto px-4 mt-12 pt-8 border-t border-gray-100 text-center text-sm text-muted-foreground">
          © 2024 LUXE. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
