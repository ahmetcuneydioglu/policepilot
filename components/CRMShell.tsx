"use client";

import { type ReactNode } from "react";
import { AuthProvider } from "@/lib/AuthContext";
import { NotificationProvider } from "@/lib/NotificationContext";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import ToastContainer from "@/components/ToastContainer";

export default function CRMShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <NotificationProvider>
        <div className="flex h-screen overflow-hidden bg-slate-100">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <TopBar />
            <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
              <div className="p-4 sm:p-6 lg:p-8">{children}</div>
            </main>
          </div>
        </div>
        <ToastContainer />
      </NotificationProvider>
    </AuthProvider>
  );
}
