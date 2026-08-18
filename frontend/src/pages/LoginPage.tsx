import { Link } from "react-router-dom";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground antialiased">
      <div className="flex flex-1 flex-col items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-4xl">
          <LoginForm />
        </div>
      </div>

      <footer className="mt-auto w-full px-6 pb-6 text-right text-xs text-muted-foreground md:px-10 md:pb-8">
        <p>&copy; 2026 Cortex</p>
        <p className="mt-0.5">
          <Link to="/privacy" className="transition-colors hover:text-foreground">
            Privacy Policy
          </Link>
          <span className="mx-1.5">•</span>
          <Link to="/terms" className="transition-colors hover:text-foreground">
            Terms of Service
          </Link>
        </p>
      </footer>
    </div>
  );
}
