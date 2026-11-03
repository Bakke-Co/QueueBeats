import type { ReactNode } from "react";
import { Toaster } from "./Toaster";

export function ToasterProvider({ children }: { children: ReactNode }) {
  return <>{children}<Toaster /></>;
}
