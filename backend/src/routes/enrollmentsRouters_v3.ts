import { Router, type Request, type Response } from "express";
import { zEnrollmentBody,zEnrollmentPutBody } from "../libs/zodValidators.ts";

import type { CustomRequest } from "../libs/types.ts";

// import authentication middleware
import { authenticateToken } from "../middlewares/authenMiddleware.ts";
import { checkRoles } from "../middlewares/checkRolesDBMiddleware.ts";

// import database
import { PrismaClient } from "../../generated/prisma/client.ts";
const prisma = new PrismaClient();

const router = Router();

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

router.put(
  "/",
  authenticateToken,
  checkRoles,
  async (req: CustomRequest, res: Response) => {
    try {
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

      if (user?.role === "STUDENT" && studentId !== user.studentId) {
        return res.status(403).json({
          success: false,
          message: "Forbidden access",
        });
      }

      if (courseId === newCourseId) {
        return res.status(400).json({
          success: false,
          message: "New course must be different from current course",
        });
      }

      const enrollment = await prisma.enrollment.findFirst({
        where: { studentId, courseId },
      });

      if (!enrollment) {
        return res.status(404).json({
          success: false,
          message: "Enrollment does not exists",
        });
      }

      const newCourse = await prisma.course.findUnique({
        where: { courseId: newCourseId },
      });

      if (!newCourse) {
        return res.status(404).json({
          success: false,
          message: `Course ${newCourseId} does not exists`,
        });
      }

      const duplicate = await prisma.enrollment.findFirst({
        where: { studentId, courseId: newCourseId },
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "Student has already enrolled in the new course",
        });
      }

      await prisma.enrollment.updateMany({
        where: { studentId, courseId },
        data: { courseId: newCourseId },
      });

      const updated = await prisma.enrollment.findFirst({
        where: { studentId, courseId: newCourseId },
      });

      return res.status(200).json({
        success: true,
        message: "Enrollment updated successfully",
        data: updated,
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

router.delete(
  "/",
  authenticateToken,
  checkRoles,
  async (req: CustomRequest, res: Response) => {
    try {
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

      if (user?.role === "STUDENT" && studentId !== user.studentId) {
        return res.status(403).json({
          success: false,
          message: "Forbidden access",
        });
      }

      const enrollment = await prisma.enrollment.findFirst({
        where: { studentId, courseId },
      });

      if (!enrollment) {
        return res.status(404).json({
          success: false,
          message: "Enrollment does not exists",
        });
      }

      await prisma.enrollment.deleteMany({
        where: { studentId, courseId },
      });

      return res.status(200).json({
        success: true,
        message: "Enrollment deleted successfully",
        data: enrollment,
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