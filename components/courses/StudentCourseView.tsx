"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Video, FileText } from "lucide-react";
import { getStudentLessonVideoUrl } from "@/lib/actions/lms-student";
import type { Course, ModuleWithLessons, Lesson } from "@/lib/queries/courses";

export function StudentCourseView({ course, modules }: { course: Course; modules: ModuleWithLessons[] }) {
  const allLessons = modules.flatMap((m) => m.lessons);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(allLessons[0]?.id ?? null);
  const activeLesson = allLessons.find((l) => l.id === activeLessonId) ?? null;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <Link href="/my-courses" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-4">
        <ArrowLeft size={14} /> My Courses
      </Link>

      <h1 className="text-2xl font-bold mb-6">{course.title}</h1>

      <div className="grid md:grid-cols-[280px_1fr] gap-6">
        <div className="space-y-4">
          {modules.map((mod) => (
            <div key={mod.id}>
              <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-1.5">{mod.title}</p>
              <div className="space-y-1">
                {mod.lessons.map((lesson) => (
                  <button
                    key={lesson.id}
                    onClick={() => setActiveLessonId(lesson.id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-left transition-colors ${
                      activeLessonId === lesson.id ? "bg-[var(--primary)]/10 text-[var(--primary)]" : "hover:bg-[var(--accent)] text-[var(--foreground)]"
                    }`}
                  >
                    {lesson.content_type === "video" ? <Video size={14} className="flex-shrink-0" /> : <FileText size={14} className="flex-shrink-0" />}
                    <span className="truncate">{lesson.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {allLessons.length === 0 && <p className="text-sm text-[var(--muted-foreground)]">No lessons published yet.</p>}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 min-h-[300px]">
          {activeLesson ? <LessonContent lesson={activeLesson} /> : <p className="text-sm text-[var(--muted-foreground)]">Select a lesson to begin.</p>}
        </div>
      </div>
    </div>
  );
}

function LessonContent({ lesson }: { lesson: Lesson }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{lesson.title}</h2>
      {lesson.content_type === "video" ? (
        error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : videoUrl ? (
          <video src={videoUrl} controls className="w-full rounded-lg aspect-video bg-black" />
        ) : (
          <div className="w-full aspect-video rounded-lg bg-[var(--muted)] animate-pulse" />
        )
      ) : (
        <div className="prose max-w-none text-sm whitespace-pre-wrap">{lesson.body}</div>
      )}
    </div>
  );
}
