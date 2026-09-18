"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Pencil, Video, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUploader } from "@/components/ui/image-uploader";
import { FocusPointPicker } from "@/components/ui/focus-point-picker";
import { LessonEditorDialog } from "@/components/courses/LessonEditorDialog";
import { ConfirmDeleteDialog } from "@/components/courses/ConfirmDeleteDialog";
import {
  saveCourse,
  toggleCoursePublished,
  addModule,
  renameModule,
  deleteModule,
  moveModule,
  addLesson,
  deleteLesson,
  moveLesson,
} from "@/lib/actions/courses";
import type { Course, ModuleWithLessons, Lesson } from "@/lib/queries/courses";

export function CourseEditor({ course, modules }: { course: Course; modules: ModuleWithLessons[] }) {
  const router = useRouter();
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(course.cover_image_url);
  const [coverFocusX, setCoverFocusX] = useState(course.cover_image_focus_x ?? 50);
  const [coverFocusY, setCoverFocusY] = useState(course.cover_image_focus_y ?? 50);
  const [isPending, startTransition] = useTransition();
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [newModuleTitle, setNewModuleTitle] = useState("");

  function handleSaveDetails() {
    startTransition(async () => {
      await saveCourse(course.id, { title: title.trim() || "Untitled course", description, coverImageUrl });
      router.refresh();
    });
  }

  function handleTogglePublished() {
    startTransition(async () => {
      await toggleCoursePublished(course.id, course.status !== "published");
      router.refresh();
    });
  }

  function handleAddModule() {
    if (!newModuleTitle.trim()) return;
    startTransition(async () => {
      await addModule(course.id, newModuleTitle);
      setNewModuleTitle("");
      router.refresh();
    });
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/courses" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
          <ArrowLeft size={14} /> Courses
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/courses/${course.id}/students`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-medium hover:bg-[var(--accent)] transition-colors">
            <Users size={13} /> Students
          </Link>
          <Button size="sm" variant={course.status === "published" ? "outline" : "default"} onClick={handleTogglePublished} disabled={isPending}>
            {course.status === "published" ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </div>

      {/* Course details */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="course-title">Title</Label>
          <Input id="course-title" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={handleSaveDetails} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="course-description">Description</Label>
          <textarea
            id="course-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleSaveDetails}
            placeholder="What will students learn in this course?"
            className="w-full h-24 resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm p-3 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/30 placeholder:text-[var(--muted-foreground)]"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Cover image</Label>
          <ImageUploader
            value={coverImageUrl}
            onChange={(url) => { setCoverImageUrl(url); startTransition(async () => { await saveCourse(course.id, { coverImageUrl: url }); router.refresh(); }); }}
            bucket="offering-media"
            folder="course-covers"
            aspectRatio="wide"
          />
          {coverImageUrl && (
            <FocusPointPicker
              imageUrl={coverImageUrl}
              focusX={coverFocusX}
              focusY={coverFocusY}
              onChange={(x, y) => {
                setCoverFocusX(x);
                setCoverFocusY(y);
                startTransition(async () => { await saveCourse(course.id, { coverImageFocusX: x, coverImageFocusY: y }); router.refresh(); });
              }}
              aspectRatio="wide"
            />
          )}
        </div>
      </div>

      {/* Modules */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[var(--foreground)]">Modules</h2>
        </div>

        {modules.length === 0 && (
          <p className="text-sm text-[var(--muted-foreground)] py-6 text-center border-2 border-dashed border-[var(--border)] rounded-xl">
            No modules yet — add one to start building lessons.
          </p>
        )}

        <div className="space-y-4">
          {modules.map((mod, i) => (
            <ModuleCard
              key={mod.id}
              courseId={course.id}
              module={mod}
              isFirst={i === 0}
              isLast={i === modules.length - 1}
              onEditLesson={setEditingLesson}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            placeholder="New module title"
            className="h-9 text-sm max-w-xs"
            onKeyDown={(e) => e.key === "Enter" && handleAddModule()}
          />
          <Button size="sm" variant="outline" onClick={handleAddModule} disabled={!newModuleTitle.trim()}>
            <Plus size={13} className="mr-1" /> Add module
          </Button>
        </div>
      </div>

      {editingLesson && (
        <LessonEditorDialog
          courseId={course.id}
          lesson={editingLesson}
          open={!!editingLesson}
          onOpenChange={(open) => !open && setEditingLesson(null)}
        />
      )}
    </div>
  );
}

function ModuleCard({
  courseId,
  module: mod,
  isFirst,
  isLast,
  onEditLesson,
}: {
  courseId: string;
  module: ModuleWithLessons;
  isFirst: boolean;
  isLast: boolean;
  onEditLesson: (lesson: Lesson) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(mod.title);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [deletingModule, setDeletingModule] = useState(false);
  const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleRename() {
    if (title.trim() === mod.title) return;
    startTransition(async () => { await renameModule(mod.id, title); router.refresh(); });
  }

  function handleDelete() {
    startTransition(async () => { await deleteModule(mod.id); router.refresh(); });
  }

  function handleMove(direction: "up" | "down") {
    startTransition(async () => { await moveModule(courseId, mod.id, direction); router.refresh(); });
  }

  function handleAddLesson() {
    if (!newLessonTitle.trim()) return;
    startTransition(async () => { await addLesson(mod.id, newLessonTitle); setNewLessonTitle(""); router.refresh(); });
  }

  function handleDeleteLesson(lessonId: string) {
    startTransition(async () => { await deleteLesson(lessonId); router.refresh(); });
  }

  function handleMoveLesson(lessonId: string, direction: "up" | "down") {
    startTransition(async () => { await moveLesson(mod.id, lessonId, direction); router.refresh(); });
  }

  const deletingLesson = mod.lessons.find((l) => l.id === deletingLessonId) ?? null;

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-[var(--muted)]/30">
        <div className="flex flex-col -my-1">
          <button onClick={() => handleMove("up")} disabled={isFirst} className="disabled:opacity-30 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <ChevronUp size={14} />
          </button>
          <button onClick={() => handleMove("down")} disabled={isLast} className="disabled:opacity-30 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <ChevronDown size={14} />
          </button>
        </div>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleRename}
          className="h-8 text-sm font-medium border-none bg-transparent px-1 focus-visible:ring-1"
        />
        <button onClick={() => setDeletingModule(true)} className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-500/10 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>

      <div className="divide-y divide-[var(--border)]">
        {mod.lessons.map((lesson, i) => (
          <div key={lesson.id} className="flex items-center gap-2 px-4 py-2.5">
            <div className="flex flex-col -my-1">
              <button onClick={() => handleMoveLesson(lesson.id, "up")} disabled={i === 0} className="disabled:opacity-30 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                <ChevronUp size={12} />
              </button>
              <button onClick={() => handleMoveLesson(lesson.id, "down")} disabled={i === mod.lessons.length - 1} className="disabled:opacity-30 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                <ChevronDown size={12} />
              </button>
            </div>
            {lesson.content_type === "video" ? <Video size={14} className="text-[var(--muted-foreground)] flex-shrink-0" /> : <FileText size={14} className="text-[var(--muted-foreground)] flex-shrink-0" />}
            <span className="text-sm flex-1">{lesson.title}</span>
            <button onClick={() => onEditLesson(lesson)} className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors">
              <Pencil size={13} />
            </button>
            <button onClick={() => setDeletingLessonId(lesson.id)} className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-500/10 transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        ))}

        <div className="flex items-center gap-2 px-4 py-2.5">
          <Input
            value={newLessonTitle}
            onChange={(e) => setNewLessonTitle(e.target.value)}
            placeholder="New lesson title"
            className="h-8 text-xs"
            onKeyDown={(e) => e.key === "Enter" && handleAddLesson()}
          />
          <Button size="sm" variant="ghost" onClick={handleAddLesson} disabled={!newLessonTitle.trim()}>
            <Plus size={13} className="mr-1" /> Add lesson
          </Button>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={deletingModule}
        onOpenChange={setDeletingModule}
        title="Delete module?"
        description={
          <>
            <span className="font-medium text-[var(--foreground)]">{mod.title}</span> and its {mod.lessons.length} lesson{mod.lessons.length === 1 ? "" : "s"} will be permanently deleted. This cannot be undone.
          </>
        }
        confirmLabel="Delete module"
        onConfirm={handleDelete}
      />
      <ConfirmDeleteDialog
        open={!!deletingLessonId}
        onOpenChange={(open) => !open && setDeletingLessonId(null)}
        title="Delete lesson?"
        description={
          <>
            <span className="font-medium text-[var(--foreground)]">{deletingLesson?.title}</span> will be permanently deleted. This cannot be undone.
          </>
        }
        confirmLabel="Delete lesson"
        onConfirm={() => deletingLessonId && handleDeleteLesson(deletingLessonId)}
      />
    </div>
  );
}
