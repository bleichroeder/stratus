import { VaultProvider } from "@/components/vault/vault-context";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <VaultProvider>
      <div className="flex h-dvh overflow-hidden bg-white dark:bg-stone-950 relative">{children}</div>
    </VaultProvider>
  );
}
