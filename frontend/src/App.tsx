import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "@/lib/ui/sonner";
import { AppRoutes } from "@/routes";

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      <Toaster position="top-right" offset="70px" />
    </>
  );
}

export default App;
