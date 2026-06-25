import { InfiniteCanvas } from "@/components/canvas/InfiniteCanvas";
import { FloatingDock } from "@/components/canvas/FloatingDock";
import { AiActionBar } from "@/components/canvas/AiActionBar";
import { UploadLayer } from "@/components/canvas/UploadLayer";

export default function Home() {
  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <InfiniteCanvas>
        <FloatingDock />
        <UploadLayer />
        <AiActionBar />
      </InfiniteCanvas>
    </main>
  );
}
