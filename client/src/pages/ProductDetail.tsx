import { useRoute } from "wouter";
import { useProduct } from "@/hooks/use-products";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import { useState } from "react";
import { Minus, Plus, Heart, Share2 } from "lucide-react";
import { motion } from "framer-motion";

export default function ProductDetail() {
  const [, params] = useRoute("/products/:id");
  const id = Number(params?.id);
  const { data: product, isLoading } = useProduct(id);
  const { addItem } = useCart();
  
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  if (isLoading) return <div className="min-h-screen bg-white flex items-center justify-center">Loading...</div>;
  if (!product) return <div className="min-h-screen bg-white flex items-center justify-center">Product not found</div>;

  const handleAddToCart = () => {
    if (!product) return;
    if (product.sizes?.length && !selectedSize) {
      alert("Please select a size");
      return;
    }
    addItem(product, quantity, selectedSize || undefined, selectedColor || undefined);
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-32 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">
          {/* Gallery */}
          <div className="space-y-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="aspect-[3/4] bg-gray-100 overflow-hidden"
            >
              {product.images[0] ? (
                <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
              )}
            </motion.div>
            <div className="grid grid-cols-4 gap-4">
               {/* Thumbnails placeholder */}
               {[1, 2, 3].map((i) => (
                 <div key={i} className="aspect-[3/4] bg-gray-100 cursor-pointer hover:opacity-80 transition-opacity" />
               ))}
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-col justify-center">
            <h1 className="text-4xl font-serif font-bold mb-4">{product.name}</h1>
            <div className="flex items-baseline space-x-4 mb-8">
              <span className="text-2xl font-medium">${Number(product.price).toFixed(2)}</span>
              {product.originalPrice && (
                <span className="text-lg text-muted-foreground line-through">${Number(product.originalPrice).toFixed(2)}</span>
              )}
            </div>

            <p className="text-gray-600 leading-relaxed mb-8">
              {product.description}
            </p>

            <div className="space-y-6 mb-8">
              {/* Colors */}
              {product.colors && product.colors.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Color</label>
                  <div className="flex space-x-3">
                    {product.colors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          selectedColor === color ? "border-black scale-110" : "border-transparent hover:scale-110"
                        }`}
                        style={{ backgroundColor: color.toLowerCase() }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Sizes */}
              {product.sizes && product.sizes.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Size</label>
                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`px-4 py-2 border text-sm transition-all ${
                          selectedSize === size 
                            ? "border-black bg-black text-white" 
                            : "border-gray-200 hover:border-black"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium mb-2">Quantity</label>
                <div className="flex items-center w-32 border border-gray-200">
                  <button 
                    className="p-3 hover:bg-gray-100"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="flex-1 text-center font-medium">{quantity}</div>
                  <button 
                    className="p-3 hover:bg-gray-100"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-4 mb-8">
              <Button 
                size="lg" 
                className="flex-1 rounded-none h-14 text-base"
                onClick={handleAddToCart}
              >
                Add to Cart
              </Button>
              <Button size="lg" variant="outline" className="w-14 h-14 rounded-none p-0">
                <Heart className="w-5 h-5" />
              </Button>
            </div>

            <div className="text-sm text-gray-500 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-black">SKU:</span> {product.id.toString().padStart(6, '0')}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-black">Category:</span> Streetwear
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
