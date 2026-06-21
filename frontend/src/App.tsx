import { RouterProvider } from "react-router";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { router } from "@/app/router";
import { KikiHotTakes } from "@/features/kiki/components/kiki-hot-takes";

export function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
      <Toaster richColors />
      <KikiHotTakes />
    </ThemeProvider>
  );
}

export default App;
