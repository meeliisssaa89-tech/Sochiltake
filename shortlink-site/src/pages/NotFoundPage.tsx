import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card text-center max-w-md w-full">
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <p className="text-gray-600 mb-4">Page not found.</p>
        <Link to="/" className="text-purple-600 hover:underline text-sm">Home</Link>
      </div>
    </div>
  );
}
