import { Navbar } from "@/components/Navbar";
import { useProducts } from "@/hooks/use-products";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Filter, ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export default function ProductList() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const categoryId = searchParams.get("category");
  
  const { data: products, isLoading } = useProducts({ 
    search: searchParams.get("search") || undefined 
  });

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-32 pb-24">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-4">
          <div>
            <h1 className="text-4xl font-serif font-bold mb-2">Shop All</h1>
            <p className="text-muted-foreground">
              {products?.length || 0} Products Found
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Filter className="w-4 h-4" /> Filters
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="py-6 space-y-6">
                  {/* Category Filter Placeholders */}
                  <div>
                    <h3 className="font-medium mb-3">Category</h3>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" className="rounded border-gray-300" />
                        <span>Clothing</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" className="rounded border-gray-300" />
                        <span>Accessories</span>
                      </label>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <Button variant="outline" className="flex items-center gap-2">
              Sort By <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {isLoading ? (
             Array(8).fill(0).map((_, i) => (
              <div key={i} className="space-y-4">
                <div className="aspect-[3/4] bg-gray-100 animate-pulse" />
                <div className="h-4 w-2/3 bg-gray-100 animate-pulse" />
                <div className="h-4 w-1/3 bg-gray-100 animate-pulse" />
              </div>
            ))
          ) : products && products.length > 0 ? (
            products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))
          ) : (
            <div className="col-span-full py-24 text-center">
              <h3 className="text-xl font-medium">No products found</h3>
              <p className="text-muted-foreground mt-2">Try adjusting your filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
