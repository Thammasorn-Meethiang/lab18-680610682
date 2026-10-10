import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { zEnrollmentBody } from "../libs/zodValidators.ts";

import type { CustomRequest } from "../libs/types.ts";

// import authentication middleware
import { authenticateToken } from "../middlewares/authenMiddleware.ts";
import { checkRoles } from "../middlewares/checkRolesDBMiddleware.ts";

// import database
import { PrismaClient } from "../../generated/prisma/client.ts";
const prisma = new PrismaClient();

const router = Router();

// Schema สำหรับเปลี่ยนวิชา (PUT /enrollments)
export const zEnrollmentPutBody = z.object({
  studentId: z.string().min(1, "studentId is required"),
  courseId: z.string().min(1, "courseId is required"),
  newCourseId: z.string().min(1, "newCourseId is required"),
});

// GET /api/v3/enrollments
// ADMIN: get all enrollments, STUDENT: get only his own enrollments
router.get(
  "/",
  authenticateToken,
  checkRoles,
  async (req: CustomRequest, res: Response) => {
    try {
      const user = req.user;
      const enrollments = await prisma.enrollment.findMany({
        where:
          user?.role === "STUDENT" ? { studentId: user.studentId ?? "" } : {},
        orderBy: { createdAt: "asc" },
      });

      return res.json({
        success: true,
        data: enrollments,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Something is wrong, please try again",
        error: err,
      });
    }
  },
);

// POST /api/v3/enrollments, body = {studentId, courseId}
// ADMIN: enroll any student, STUDENT: enroll only himself
router.post(
  "/",
  authenticateToken,
  checkRoles,
  async (req: CustomRequest, res: Response) => {
    try {
      // validate req.body
      const result = zEnrollmentBody.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: result.error.issues[0]?.message,
        });
      }
      const { studentId, courseId } = result.data;

      // STUDENT can enroll only himself
      const user = req.user;
      if (user?.role === "STUDENT" && studentId !== user.studentId) {
        return res.status(403).json({
          success: false,
          message: "Forbidden access",
        });
      }

      // check if student and course exist
      const student = await prisma.student.findUnique({
        where: { studentId },
      });
      if (!student) {
        return res.status(404).json({
          success: false,
          message: `Student ${studentId} does not exists`,
        });
      }
      const course = await prisma.course.findUnique({ where: { courseId } });
      if (!course) {
        return res.status(404).json({
          success: false,
          message: `Course ${courseId} does not exists`,
        });
      }

      // check if the student already enrolled in this course
      const enrolled = await prisma.enrollment.findFirst({
        where: { studentId, courseId },
      });
      if (enrolled) {
        return res.status(409).json({
          success: false,
          message: `Student ${studentId} has already enrolled in ${courseId}`,
        });
      }

      const created = await prisma.enrollment.create({
        data: { studentId, courseId },
      });

      return res.status(201).json({
        success: true,
        data: created,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Something is wrong, please try again",
        error: err,
      });
    }
  },
);

// 3.1 PUT /api/v3/enrollments, body = {studentId, courseId, newCourseId}
// เปลี่ยนวิชาที่ลงทะเบียนไว้ (courseId -> newCourseId)
router.put(
  "/",
  authenticateToken,
  checkRoles,
  async (req: CustomRequest, res: Response) => {
    try {
      // 1. ตรวจสอบ body ด้วย zEnrollmentPutBody
      const result = zEnrollmentPutBody.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: result.error.issues[0]?.message,
        });
      }

      const { studentId, courseId, newCourseId } = result.data;
      const user = req.user;

      // 2. Role ADMIN แก้ได้ทุกคน / Role STUDENT แก้ได้แค่ของตัวเอง
      if (user?.role === "STUDENT" && studentId !== user.studentId) {
        return res.status(403).json({
          success: false,
          message: "Forbidden access",
        });
      }

      // 3. วิชาใหม่ = วิชาเดิม
      if (courseId === newCourseId) {
        return res.status(400).json({
          success: false,
          message: "New course cannot be the same as current course",
        });
      }

      // 4. ตรวจสอบว่ายังไม่ได้ลงวิชาเดิมไว้
      const currentEnrollment = await prisma.enrollment.findFirst({
        where: { studentId, courseId },
      });
      if (!currentEnrollment) {
        return res.status(404).json({
          success: false,
          message: `Enrollment for course ${courseId} not found`,
        });
      }

      // 5. ตรวจสอบว่าวิชาใหม่ไม่มีจริง
      const newCourse = await prisma.course.findUnique({
        where: { courseId: newCourseId },
      });
      if (!newCourse) {
        return res.status(404).json({
          success: false,
          message: `New course ${newCourseId} does not exists`,
        });
      }

      // 6. ตรวจสอบว่าลงวิชาใหม่ไว้แล้ว
      const alreadyEnrolled = await prisma.enrollment.findFirst({
        where: { studentId, courseId: newCourseId },
      });
      if (alreadyEnrolled) {
        return res.status(409).json({
          success: false,
          message: `Student ${studentId} has already enrolled in ${newCourseId}`,
        });
      }

      // ดำเนินการสลับวิชาผ่าน transaction
      const [_, updatedEnrollment] = await prisma.$transaction([
        prisma.enrollment.delete({
          where: { id: currentEnrollment.id },
        }),
        prisma.enrollment.create({
          data: {
            studentId,
            courseId: newCourseId,
          },
        }),
      ]);

      return res.status(200).json({
        success: true,
        message: "Course updated successfully",
        data: updatedEnrollment,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Something is wrong, please try again",
        error: err,
      });
    }
  },
);

// 3.2 DELETE /api/v3/enrollments, body = {studentId, courseId}
// ยกเลิกการลงทะเบียน (drop)
router.delete(
  "/",
  authenticateToken,
  checkRoles,
  async (req: CustomRequest, res: Response) => {
    try {
      // 1. ตรวจสอบ req.body
      const result = zEnrollmentBody.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: result.error.issues[0]?.message,
        });
      }

      const { studentId, courseId } = result.data;
      const user = req.user;

      // 2. Role ADMIN ลบได้ทุกคน / Role STUDENT ลบได้แค่ของตัวเอง
      if (user?.role === "STUDENT" && studentId !== user.studentId) {
        return res.status(403).json({
          success: false,
          message: "Forbidden access",
        });
      }

      // 3. ตรวจสอบว่าพบการลงทะเบียนหรือไม่
      const enrollment = await prisma.enrollment.findFirst({
        where: { studentId, courseId },
      });
      if (!enrollment) {
        return res.status(404).json({
          success: false,
          message: "Enrollment not found",
        });
      }

      // ลบรายการลงทะเบียน
      const deleted = await prisma.enrollment.delete({
        where: { id: enrollment.id },
      });

      return res.status(200).json({
        success: true,
        message: "Enrollment dropped successfully",
        data: deleted,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Something is wrong, please try again",
        error: err,
      });
    }
  },
);

export default router;