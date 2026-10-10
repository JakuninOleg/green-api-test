import { useState } from "react";
import type { GreenApiCredentials } from "./api/green-api.ts";
import { ChatApp } from "./components/ChatApp.tsx";
import { ConnectionForm } from "./components/ConnectionForm.tsx";

export function App() {
  const [credentials, setCredentials] = useState<GreenApiCredentials | null>(null);

  if (credentials) {
    return <ChatApp credentials={credentials} onDisconnect={() => setCredentials(null)} />;
  }

  return (
    <main className="page">
      <ConnectionForm onConnect={setCredentials} />
    </main>
  );
}
