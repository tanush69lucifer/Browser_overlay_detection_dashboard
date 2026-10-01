const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const email = z.string().trim().toLowerCase().email('Enter a valid email');
const sort = z
  .string()
  .regex(/^-?[a-zA-Z]+$/, 'Invalid sort field')
  .optional()
  .default('-createdAt');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email,
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  role: z.enum(['CANDIDATE', 'PROCTOR', 'ADMIN']).optional(),
});

const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

const googleLoginSchema = z.object({
  credential: z.string().min(100).max(10000),
});

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional().default(''),
  sort,
});

const userListQuery = listQuery.extend({
  role: z.enum(['CANDIDATE', 'PROCTOR', 'ADMIN']).optional(),
});

const sessionListQuery = listQuery.extend({
  limit: z.coerce.number().int().min(1).max(500).default(500),
  status: z.enum(['ONLINE', 'OFFLINE', 'ENDED']).optional(),
});

const questionSchema = z.object({
  text: z.string().trim().min(1, 'Question text is required').max(1000),
  options: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
});

const examFields = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120),
  description: z.string().trim().max(1000).optional().default(''),
  startAt: z.coerce.date({ invalid_type_error: 'Invalid start time' }),
  endAt: z.coerce.date({ invalid_type_error: 'Invalid end time' }),
  durationMin: z.coerce.number().int().min(1).max(600).default(60),
  sensitivity: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  questions: z.array(questionSchema).max(100).default([]),
  candidateIds: z.array(objectId).max(1000).default([]),
  proctorIds: z.array(objectId).max(50).default([]),
  fingerprintIds: z.array(objectId).max(100).default([]),
});

const endAfterStart = (d) => !(d.startAt && d.endAt) || d.endAt > d.startAt;
const endAfterStartMsg = { message: 'End time must be after start time', path: ['endAt'] };

const createExamSchema = examFields.refine(endAfterStart, endAfterStartMsg);
const updateExamSchema = examFields.partial().refine(endAfterStart, endAfterStartMsg);

const startSessionSchema = z.object({
  userAgent: z.string().max(300).optional().default(''),
  screen: z
    .object({
      w: z.coerce.number().int().min(0).max(20000),
      h: z.coerce.number().int().min(0).max(20000),
    })
    .optional(),
});

const endSessionSchema = z.object({
  // keyed by question _id; value = option index or free-text answer
  answers: z
    .record(z.string().max(50), z.union([z.number().int().min(0).max(20), z.string().max(5000)]))
    .optional()
    .default({}),
});

module.exports = {
  registerSchema,
  loginSchema,
  googleLoginSchema,
  listQuery,
  userListQuery,
  sessionListQuery,
  createExamSchema,
  updateExamSchema,
  startSessionSchema,
  endSessionSchema,
};
