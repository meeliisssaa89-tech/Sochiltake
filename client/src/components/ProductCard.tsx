import { Product } from "@shared/schema";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="group relative flex flex-col space-y-3"
    >
      <Link href={`/products/${product.id}`} className="block relative aspect-[3/4] overflow-hidden bg-gray-100 cursor-pointer">
        {product.images[0] ? (
          <img 
            src={product.images[0]} 
            alt={product.name} 
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
        )}
        
        {/* Quick Add Button overlay */}
        <div className="absolute inset-x-4 bottom-4 opacity-0 translate-y-4 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
          <Button 
            className="w-full bg-white text-black hover:bg-black hover:text-white shadow-lg font-medium"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              addItem(product, 1);
            }}
          >
            Quick Add
          </Button>
        </div>

        {product.originalPrice && Number(product.originalPrice) > Number(product.price) && (
          <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 uppercase font-bold tracking-wider">
            Sale
          </div>
        )}
      </Link>
      
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <Link href={`/products/${product.id}`} className="text-sm font-medium hover:underline decoration-1 underline-offset-4">
            {product.name}
          </Link>
          <p className="text-sm text-muted-foreground capitalize">Category Name</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium">${Number(product.price).toFixed(2)}</p>
          {product.originalPrice && (
            <p className="text-xs text-muted-foreground line-through">${Number(product.originalPrice).toFixed(2)}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
