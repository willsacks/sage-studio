"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Video, FileText, CheckCircle2, Circle } from "lucide-react";
import { getStudentLessonVideoUrl, toggleLessonComplete, updateLessonVideoPosition } from "@/lib/actions/lms-student";
import type { Course, ModuleWithLessons, Lesson, LessonProgress } from "@/lib/queries/courses";

export function StudentCourseView({
  course,
  modules,
  initialLessonId,
  initialProgress,
}: {
  course: Course;
  modules: ModuleWithLessons[];
  initialLessonId?: string;
  initialProgress: Record<string, LessonProgress>;
}) {
  const allLessons = modules.flatMap((m) => m.lessons);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(
    (initialLessonId && allLessons.some((l) => l.id === initialLessonId)) ? initialLessonId : allLessons[0]?.id ?? null
  );
  const [progress, setProgress] = useState<Record<string, LessonProgress>>(initialProgress);
  const activeLesson = allLessons.find((l) => l.id === activeLessonId) ?? null;

  const completedCount = allLessons.filter((l) => progress[l.id]?.completed_at).length;
  const pct = allLessons.length > 0 ? Math.round((completedCount / allLessons.length) * 100) : 0;

  function handleToggleComplete(lessonId: string, completed: boolean) {
    setProgress((prev) => ({
      ...prev,
      [lessonId]: { ...(prev[lessonId] ?? { id: "", enrollment_id: "", lesson_id: lessonId, last_position_seconds: 0, updated_at: new Date().toISOString() }), completed_at: completed ? new Date().toISOString() : null },
    }));
    toggleLessonComplete(lessonId, completed);
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <Link href="/my-courses" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-4">
        <ArrowLeft size={14} /> My Courses
      </Link>

      <h1 className="text-2xl font-bold mb-2">{course.title}</h1>
      {allLessons.length > 0 && (
        <div className="mb-6 max-w-sm">
          <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] mb-1">
            <span>{completedCount} / {allLessons.length} lessons complete</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
            <div className="h-full bg-[var(--primary)] transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-[280px_1fr] gap-6">
        <div className="space-y-4">
          {modules.map((mod) => (
            <div key={mod.id}>
              <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-1.5">{mod.title}</p>
              <div className="space-y-1">
                {mod.lessons.map((lesson) => {
                  const isComplete = !!progress[lesson.id]?.completed_at;
                  return (
                    <button
                      key={lesson.id}
                      onClick={() => setActiveLessonId(lesson.id)}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-left transition-colors ${
                        activeLessonId === lesson.id ? "bg-[var(--primary)]/10 text-[var(--primary)]" : "hover:bg-[var(--accent)] text-[var(--foreground)]"
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle2 size={14} className="flex-shrink-0 text-[var(--primary)]" />
                      ) : lesson.content_type === "video" ? (
                        <Video size={14} className="flex-shrink-0" />
                      ) : (
                        <FileText size={14} className="flex-shrink-0" />
                      )}
                      <span className="truncate">{lesson.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {allLessons.length === 0 && <p className="text-sm text-[var(--muted-foreground)]">No lessons published yet.</p>}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 min-h-[300px]">
          {activeLesson ? (
            <LessonContent
              lesson={activeLesson}
              isComplete={!!progress[activeLesson.id]?.completed_at}
              initialPosition={progress[activeLesson.id]?.last_position_seconds ?? 0}
              onToggleComplete={(completed) => handleToggleComplete(activeLesson.id, completed)}
            />
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">Select a lesson to begin.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function LessonContent({
  lesson,
  isComplete,
  initialPosition,
  onToggleComplete,
}: {
  lesson: Lesson;
  isComplete: boolean;
  initialPosition: number;
  onToggleComplete: (completed: boolean) => void;
}) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSavedRef = useRef(0);

  useEffect(() => {
    setVideoUrl(null);
    setError(null);
    if (lesson.content_type !== "video" || !lesson.video_path) return;
    let cancelled = false;
    getStudentLessonVideoUrl(lesson.id).then((res) => {
      if (cancelled) return;
      if ("url" in res) setVideoUrl(res.url ?? null);
      else setError(res.error ?? "Could not load video");
    });
    return () => { cancelled = true; };
  }, [lesson.id, lesson.content_type, lesson.video_path]);

  function handleLoadedMetadata() {
    if (videoRef.current && initialPosition > 0 && initialPosition < videoRef.current.duration - 2) {
      videoRef.current.currentTime = initialPosition;
    }
  }

  function handleTimeUpdate() {
    const t = videoRef.current?.currentTime ?? 0;
    // Save at most once every 10s of playback, not on every timeupdate tick.
    if (Math.abs(t - lastSavedRef.current) >= 10) {
      lastSavedRef.current = t;
      updateLessonVideoPosition(lesson.id, t);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{lesson.title}</h2>
        <button
          onClick={() => onToggleComplete(!isComplete)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex-shrink-0 ${
            isComplete ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--border)] hover:bg-[var(--accent)]"
          }`}
        >
          {isComplete ? <CheckCircle2 size={13} /> : <Circle size={13} />}
          {isComplete ? "Completed" : "Mark complete"}
        </button>
      </div>
      {lesson.content_type === "video" ? (
        error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            className="w-full rounded-lg aspect-video bg-black"
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPause={handleTimeUpdate}
          />
        ) : (
          <div className="w-full aspect-video rounded-lg bg-[var(--muted)] animate-pulse" />
        )
      ) : (
        <div className="prose max-w-none text-sm whitespace-pre-wrap">{lesson.body}</div>
      )}
    </div>
  );
}
