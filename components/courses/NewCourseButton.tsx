"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { addCourse } from "@/lib/actions/courses";

export function NewCourseButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    if (!title.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await addCourse(title);
      if ("error" in result) { setError(result.error ?? "Failed to create course"); return; }
      setOpen(false);
      router.push(`/courses/${result.courseId}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus size={14} className="mr-1.5" /> New course</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New course</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Foundations of Landscape Design"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button size="sm" onClick={handleCreate} disabled={isPending || !title.trim()}>
            {isPending && <Loader2 size={13} className="animate-spin mr-1.5" />}
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
