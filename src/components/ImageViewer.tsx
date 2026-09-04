import React from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function ImageViewer({ src, isOpen, onClose }: { src: string | null; isOpen: boolean; onClose: () => void }) {
  if (!src) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-full h-[90vh] p-1 bg-black/90 border-none flex flex-col justify-center items-center rounded-xl overflow-hidden [&>button]:text-white">
        <DialogTitle className="sr-only">Image Viewer</DialogTitle>
        <DialogDescription className="sr-only">Full screen view of the selected image.</DialogDescription>
        <img
          src={src}
          alt="Full screen view"
          className="max-w-full max-h-full object-contain"
        />
      </DialogContent>
    </Dialog>
  );
}
