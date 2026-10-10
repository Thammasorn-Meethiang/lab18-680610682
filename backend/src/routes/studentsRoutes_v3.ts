import { Router, type Request, type Response } from "express";
import { zStudentPostBody, zStudentPutBody, zStudentId } from "../libs/zodValidators.js";

import type { Student, CustomRequest } from "../libs/types.js";

// import authentication middleware
import { authenticateToken } from "../middlewares/authenMiddleware.ts";
import { checkRoleAdmin } from "../middlewares/checkRoleAdminDBMiddleware.ts";
import { checkRoles } from "../middlewares/checkRolesDBMiddleware.ts";

// import database
import { PrismaClient } from "../../generated/prisma/client.ts";
const prisma = new PrismaClient();

const router = Router();

// GET /api/v3/students
// get students (by program) with files
router.get(
  "/",
  authenticateToken,
  checkRoleAdmin,
  async (req: Request, res: Response) => {
    try {
      // get students from DB (with their files records)
      // const students = await prisma.student.findMany();
      const students = await prisma.student.findMany({
        include: { files: true },
      });

      // get program name from query string (if any)
      const program = req.query.program;
      if (program) {
        // filter students by program
        let filtered_students = students.filter(
          (student: any) => student.program === program,
        );
        return res.json({
          success: true,
          data: filtered_students,
        });
      } else {
        // return all students
        return res.json({
          success: true,
          data: students,
        });
      }
    } catch (err) {
      return res.json({
        success: false,
        message: "Something is wrong, please try again",
        error: err,
      });
    }
  },
);

// GET /api/v3/students/{studentId}
router.get(
  "/:studentId",
  authenticateToken,
  checkRoles,
  async (req: CustomRequest, res: Response) => {
    try {
      // get user, token from CustomRequest (token payload)
      const user = req.user;
      const token = req.token;

      // get parameterized variable: studentId
      const studentId = req.params.studentId as string;
      // validate studentId
      const result = zStudentId.safeParse(studentId);
      if (!result.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: result.error.issues[0]?.message,
        });
      }

      let found_student = null;
      if (studentId) {
        // get student from DB by studentId
        found_student = await prisma.student.findUnique({
          where: { studentId: studentId },
        });
      }

      // if student is not found
      if (!found_student) {
        return res.status(404).json({
          success: false,
          message: "Student does not exists",
        });
      }

      // if STUDENT does not own the data
      if (
        user?.role === "STUDENT" &&
        found_student.studentId !== user.studentId
      ) {
        return res.status(403).json({
          success: false,
          message: "Forbidden access",
        });
      }

      res.json({
        success: true,
        data: found_student,
      });
    } catch (err) {
      return res.json({
        success: false,
        message: "Something is wrong, please try again",
        error: err,
      });
    }
  },
);

// POST /api/v3/students, body = {new student data}
// add a new student
router.post(
  "/",
  authenticateToken,
  checkRoleAdmin,
  async (req: CustomRequest, res: Response) => {
    try {
      // get new student info from req.body
      const body = (await req.body) as Student;

      // validate req.body with predefined validator
      const result = zStudentPostBody.safeParse(body); // check zod
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: result.error.issues[0]?.message,
        });
      }

      //check if the studentId exists in DB
      const student = await prisma.student.findUnique({
        where: { studentId: result.data.studentId },
      });
      if (student) {
        return res.status(400).json({
          success: false,
          message: "The StudentID is already taken.",
        });
      }

      // add new student and write to DB
      const { studentId, firstName, lastName, program, interests, emails } =
        result.data;
      const created = await prisma.student.create({
        data: {
          studentId,
          firstName,
          lastName,
          program,
          interests,
          emails,
        },
      });

      // add response header 'Link'
      res.set("Link", `/api/v3/students/${created.studentId}`);

      return res.status(201).json({
        success: true,
        data: created,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Somthing is wrong, please try again",
        error: err,
      });
    }
  },
);

// 1.1 PUT /api/v3/students
// สำหรับแก้ไขข้อมูลนักศึกษา
router.put(
  "/",
  authenticateToken,
  checkRoles,
  async (req: CustomRequest, res: Response) => {
    try {
      const user = req.user;

      // ตรวจสอบข้อมูลด้วย zStudentPutBody
      const result = zStudentPutBody.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: result.error.issues[0]?.message,
        });
      }

      const { studentId, firstName, lastName, program, interests, emails } = result.data;

      // Role ADMIN แก้ไขได้ทุกคน / Role STUDENT แก้ไขได้แค่ข้อมูลของตัวเอง
      if (user?.role === "STUDENT" && user.studentId !== studentId) {
        return res.status(403).json({
          success: false,
          message: "Forbidden access",
        });
      }

      // ตรวจสอบว่ามีนักศึกษาคนนี้หรือไม่
      const existingStudent = await prisma.student.findUnique({
        where: { studentId },
      });
      if (!existingStudent) {
        return res.status(404).json({
          success: false,
          message: "Student does not exists",
        });
      }

      // แก้เฉพาะ field ที่ส่งมา
     // เตรียมข้อมูลที่จะอัปเดต (แก้เฉพาะ field ที่ส่งมา)
      const updateData: Record<string, any> = {};
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (program !== undefined) updateData.program = program;
      if (interests !== undefined) updateData.interests = interests;
      if (emails !== undefined) updateData.emails = emails;

      const updatedStudent = await prisma.student.update({
        where: { studentId },
        data: updateData,
      });

      return res.status(200).json({
        success: true,
        message: "Student updated successfully",
        data: updatedStudent,
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

// 1.2 DELETE /api/v3/students
// สำหรับลบนักศึกษา (เฉพาะ ADMIN)
router.delete(
  "/",
  authenticateToken,
  checkRoleAdmin,
  async (req: CustomRequest, res: Response) => {
    try {
      const { studentId } = req.body;

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: "studentId is required",
        });
      }

      // ตรวจสอบว่ามีนักศึกษาคนนี้หรือไม่
      const existingStudent = await prisma.student.findUnique({
        where: { studentId },
      });
      if (!existingStudent) {
        return res.status(404).json({
          success: false,
          message: "Student does not exists",
        });
      }

      // ลบ Enrollment ที่อ้างอิง studentId ก่อน แล้วค่อยลบนักศึกษา โดยใช้ prisma.$transaction
      const [_, deletedStudent] = await prisma.$transaction([
        prisma.enrollment.deleteMany({
          where: { studentId },
        }),
        prisma.student.delete({
          where: { studentId },
        }),
      ]);

      return res.status(200).json({
        success: true,
        message: "Student and related enrollments deleted successfully",
        data: deletedStudent,
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