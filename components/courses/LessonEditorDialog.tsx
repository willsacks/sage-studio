"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { saveLesson } from "@/lib/actions/courses";
import { CourseVideoUploader } from "@/components/courses/CourseVideoUploader";
import type { Lesson } from "@/lib/queries/courses";

export function LessonEditorDialog({
  courseId,
  lesson,
  open,
  onOpenChange,
}: {
  courseId: string;
  lesson: Lesson;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(lesson.title);
  const [contentType, setContentType] = useState<"text" | "video">(lesson.content_type);
  const [body, setBody] = useState(lesson.body ?? "");
  const [videoPath, setVideoPath] = useState<string | null>(lesson.video_path);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await saveLesson(lesson.id, {
        title: title.trim() || "Untitled lesson",
        contentType,
        body: contentType === "text" ? body : null,
        videoPath: contentType === "video" ? videoPath : null,
      });
      if ("error" in result) { setError(result.error ?? "Failed to save"); return; }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit lesson</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="lesson-title">Title</Label>
            <Input id="lesson-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Content type</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setContentType("text")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${contentType === "text" ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--border)] hover:bg-[var(--accent)]"}`}
              >
                Text
              </button>
              <button
                type="button"
                onClick={() => setContentType("video")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${contentType === "video" ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--border)] hover:bg-[var(--accent)]"}`}
              >
                Video
              </button>
            </div>
          </div>

          {contentType === "text" ? (
            <div className="space-y-1.5">
              <Label>Lesson content</Label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write the lesson content here..."
                className="w-full h-48 resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm p-3 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/30 placeholder:text-[var(--muted-foreground)]"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Lesson video</Label>
              <CourseVideoUploader courseId={courseId} value={videoPath} onChange={setVideoPath} />
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isPending}>
              {isPending && <Loader2 size={13} className="animate-spin mr-1.5" />}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
