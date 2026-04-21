import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { UserProvider } from "@/contexts/UserContext";
import Index from "./pages/Index.tsx";
import { AdminPanel } from "./pages/AdminPanel.tsx";
import NotFound from "./pages/NotFound.tsx";
import { AdsSdkInjector } from "./components/AdsSdkInjector";
import { ADMIN_PATH } from "./lib/adminAuth";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <UserProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AdsSdkInjector />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path={ADMIN_PATH} element={<AdminPanel />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </UserProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
