"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "rgba(19,25,41,0.95)",
            border: "1px solid rgba(148,163,184,0.12)",
            color: "#e8eaf2",
            backdropFilter: "blur(16px)",
            borderRadius: "12px",
            fontSize: "13px",
            fontWeight: 500,
          },
        }}
        richColors
      />
    </QueryClientProvider>
  );
}