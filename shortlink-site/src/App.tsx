import { Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import ReaderPage from "./pages/ReaderPage";
import AdminPage from "./pages/AdminPage";
import NotFoundPage from "./pages/NotFoundPage";
import PubLoginPage from "./pages/PubLoginPage";
import PubSignupPage from "./pages/PubSignupPage";
import PubDashboardPage from "./pages/PubDashboardPage";
import PubEditorPage from "./pages/PubEditorPage";
import PublicArticlePage from "./pages/PublicArticlePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/read" element={<ReaderPage />} />
      <Route path="/admin" element={<AdminPage />} />

      {/* Publisher (author) workspace */}
      <Route path="/publisher" element={<PubLoginPage />} />
      <Route path="/publisher/login" element={<PubLoginPage />} />
      <Route path="/publisher/signup" element={<PubSignupPage />} />
      <Route path="/publisher/dashboard" element={<PubDashboardPage />} />
      <Route path="/publisher/article/new" element={<PubEditorPage />} />
      <Route path="/publisher/article/:id/edit" element={<PubEditorPage />} />

      {/* Public article viewer */}
      <Route path="/p/:slug" element={<PublicArticlePage />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
