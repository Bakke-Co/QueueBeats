import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster 
      position="top-right"
      toastOptions={{
        style: {
          background: "rgba(0, 0, 0, 0.8)",
          color: "#fff",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "8px",
          backdropFilter: "blur(8px)",
        },
      }}
    />
  );
}
