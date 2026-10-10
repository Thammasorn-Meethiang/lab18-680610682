import { useState } from "react";
import { PlusCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuthStore } from "@/lib/auth-store";
import { useEnrollmentStore } from "@/lib/enrollment-store";
import { ArrowRightLeft, Trash2 } from "lucide-react";

export default function StudentEnrollmentsPage() {
  const studentId = useAuthStore((s) => s.studentId);
  const { students, courses, enrollments, enroll,updateEnrollment,dropEnrollment } = useEnrollmentStore();

  const [open, setOpen] = useState(false);
  const [formCourse, setFormCourse] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [newCourseId, setNewCourseId] = useState<string | null>(null);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const [dropOpen, setDropOpen] = useState(false);
  const [dropCourseId, setDropCourseId] = useState<string | null>(null);

  const me = students.find((s) => s.studentId === studentId);
  const myEnrollments = enrollments.filter((e) => e.studentId === studentId);

  const courseOptions = courses
    .filter((c) => !myEnrollments.some((e) => e.courseId === c.courseId))
    .map((c) => ({
      value: c.courseId,
      label: `${c.courseId} — ${c.courseTitle}`,
    }));

  const courseOf = (courseId: string) =>
    courses.find((c) => c.courseId === courseId);

  const changeCourseOptions = courses
  .filter(
    (c) =>
      c.courseId !== selectedCourseId &&
      !myEnrollments.some((e) => e.courseId === c.courseId),
  )
  .map((c) => ({
    value: c.courseId,
    label: `${c.courseId} — ${c.courseTitle}`,
  }));

  const openChangeDialog = (courseId: string) => {
    setSelectedCourseId(courseId);
    setNewCourseId(null);
    setChangeError(null);
    setChangeOpen(true);
  };

  const handleChangeCourse = async () => {
    if (!studentId || !selectedCourseId || !newCourseId) return;

    setChanging(true);
    setChangeError(null);

    try {
      await updateEnrollment(studentId, selectedCourseId, newCourseId);
      setChangeOpen(false);
      setSelectedCourseId(null);
      setNewCourseId(null);
    } catch (err) {
      setChangeError(
        err instanceof Error ? err.message : "เปลี่ยนวิชาไม่สำเร็จ",
      );
    } finally {
      setChanging(false);
    }
  };

  const openDropDialog = (courseId: string) => {
    setDropCourseId(courseId);
    setDropError(null);
    setDropOpen(true);
  };

  const handleDropEnrollment = async () => {
    if (!studentId || !dropCourseId) return;
    setDropError(null);
    try {
      await dropEnrollment(studentId, dropCourseId);
      setDropOpen(false);
      setDropCourseId(null);
    } catch (err) {
      setDropError(
        err instanceof Error ? err.message : "ยกเลิกวิชาไม่สำเร็จ",
      );
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setFormCourse(null);
      setServerError(null);
    }
  };

  const handleEnroll = async () => {
    if (!studentId || !formCourse) return;
    setSubmitting(true);
    setServerError(null);
    try {
      await enroll(studentId, formCourse);
      handleOpenChange(false);
    } catch (err) {
      setServerError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">จัดการการลงทะเบียน</h1>
          <p className="text-sm text-muted-foreground">
            {me
              ? `${me.studentId} — ${me.firstName} ${me.lastName} (${me.program})`
              : (studentId ?? "-")}{" "}
            · ลงทะเบียนแล้ว {myEnrollments.length} วิชา
          </p>
        </div>

        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger render={<Button disabled={!studentId} />}>
            <PlusCircle className="h-4 w-4" />
            ลงทะเบียนเรียน
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>ลงทะเบียนเรียน</DialogTitle>
              <DialogDescription>
                เลือกวิชาที่ยังไม่ได้ลงทะเบียน
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="formCourse">วิชา</Label>
              <Select
                items={courseOptions}
                value={formCourse}
                onValueChange={(v) => setFormCourse(v as string)}
              >
                <SelectTrigger id="formCourse" className="w-full">
                  <SelectValue
                    placeholder={
                      courseOptions.length === 0
                        ? "ลงทะเบียนครบทุกวิชาแล้ว"
                        : "เลือกวิชา"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {courseOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {serverError && (
              <p className="text-sm text-destructive">{serverError}</p>
            )}
            <DialogFooter>
              <Button
                disabled={!formCourse || submitting}
                onClick={handleEnroll}
              >
                <PlusCircle className="h-4 w-4" />
                {submitting ? "กำลังลงทะเบียน..." : "ลงทะเบียน"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
          <Dialog
           open={changeOpen}
           onOpenChange={(next) => {
            setChangeOpen(next);
              if (!next) {
                setSelectedCourseId(null);
                setNewCourseId(null);
                setChangeError(null);
              }
             }}
             >
            <DialogContent className="sm:max-w-lg">
             <DialogHeader>
              <DialogTitle>เปลี่ยนวิชา</DialogTitle>
               <DialogDescription>
                  เลือกวิชาใหม่แทนวิชา {selectedCourseId} (เลือกได้เฉพาะวิชาที่ลงทะเบียนแล้ว)
              </DialogDescription>
                </DialogHeader>
                  <div className="grid gap-1.5">
                    <Label htmlFor="newCourseId">วิชาใหม่</Label>
                    <Select
                     items={changeCourseOptions}
                      value={newCourseId}
                      onValueChange={(value) => setNewCourseId(value as string)}
                    >
                      <SelectTrigger id="newCourseId" className="w-full">
                        <SelectValue placeholder="เลือกวิชาใหม่" />
                      </SelectTrigger>
                      <SelectContent>
                        {changeCourseOptions.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                    {changeError && (
                      <p className="text-sm text-destructive">{changeError}</p>
                    )}
                  <DialogFooter>
                   <Button
                    disabled={!newCourseId || changing}
                    onClick={handleChangeCourse}
                   >
                  {changing ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
          </DialogFooter>
        </DialogContent>   
      </Dialog>
      <Dialog
        open={dropOpen}
        onOpenChange={(next) => {
          setDropOpen(next);

          if (!next) {
            setDropCourseId(null);
            setDropError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>ยกเลิกการลงทะเบียน</DialogTitle>
            <DialogDescription>
              คุณต้องการยกเลิกวิชานี้ใช่หรือไม่?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border p-4">
            <p className="font-medium">
              {dropCourseId ?? "-"}
            </p>
            <p className="text-sm text-muted-foreground">
              {dropCourseId
                ? courseOf(dropCourseId)?.courseTitle ?? "-"
                : "-"}
            </p>
          </div>
          {dropError && (
            <p className="text-sm text-destructive" role="alert">
              {dropError}
            </p>
          )}
          <DialogFooter>
            <Button
        variant="outline"
        onClick={() => setDropOpen(false)}
      >
        ยกเลิก
      </Button>
      <Button
        variant="destructive"
        onClick={handleDropEnrollment}
      >
        <Trash2 className="h-4 w-4" />
        ยืนยันยกเลิกวิชา
      </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>รหัสวิชา</TableHead>
              <TableHead>ชื่อวิชา</TableHead>
              <TableHead>ผู้สอน</TableHead>
              <TableHead>วันที่ลงทะเบียน</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {myEnrollments.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-20 text-center text-muted-foreground"
                >
                  ยังไม่ได้ลงทะเบียนวิชาใด
                </TableCell>
              </TableRow>
            )}
            {myEnrollments.map((e) => {
              const course = courseOf(e.courseId);
              return (
                <TableRow key={e.courseId}>
                  <TableCell>{e.courseId}</TableCell>
                  <TableCell>{course?.courseTitle ?? "-"}</TableCell>
                  <TableCell>{course?.instructors.join(", ") || "-"}</TableCell>
                  <TableCell>
                    {e.enrolledAt
                      ? new Date(e.enrolledAt).toLocaleString("th-TH")
                      : "-"}
                    </TableCell>
                    <TableCell>
                    <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="เปลี่ยนวิชา"
                      onClick={() => openChangeDialog(e.courseId)}
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                    </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="ยกเลิกวิชา"
                        onClick={() => openDropDialog(e.courseId)}
                      >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}