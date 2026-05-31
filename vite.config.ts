import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// User-site kilevoy.github.io обслуживается из корня — base "/"
export default defineConfig({
  plugins: [react()],
  base: "/",
});
