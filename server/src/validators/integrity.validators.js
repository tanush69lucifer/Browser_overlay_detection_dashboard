// Request validation schemas for integrity APIs (flags, fingerprints, thresholds, signals, reports).
const { z } = require('zod');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ObjectId');

const idParamSchema = z.object({
  id: objectIdSchema,
});

const sensitivityParamSchema = z.object({
  sensitivity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
});

const patchFlagSchema = z.object({
  reviewed: z.boolean().optional(),
  note: z.string().max(1000).optional(),
  verdict: z.enum(['SUSPICIOUS', 'CLEARED']).nullable().optional(),
});

const signalItemSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  code: z.string().min(1),
  severity: z.enum(['LOW', 'MED', 'HIGH']).optional(),
  t: z.number().optional(),
  key: z.string().max(200).optional(),
  meta: z.record(z.union([z.string().max(200), z.number().finite(), z.boolean()]))
    .refine((meta) => Object.keys(meta).length <= 10, 'Signal metadata has too many fields')
    .optional(),
}).strict();

const signalsBatchSchema = z.object({
  signals: z.array(signalItemSchema).min(1).max(50),
});

const createFingerprintSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  tool: z.string().min(1).max(100).trim(),
  matcherType: z.enum(['SELECTOR', 'IFRAME_SRC', 'GLOBAL_VAR', 'EXTENSION_RESOURCE']),
  matcher: z.string().min(1).trim(),
  resourcePath: z.string().max(200).optional(),
  weight: z.number().int().min(1).default(10),
  severity: z.enum(['LOW', 'MED', 'HIGH']).default('HIGH'),
  description: z.string().max(500).default('').optional(),
  isActive: z.boolean().default(true).optional(),
  allowed: z.boolean().default(false).optional(),
}).refine((value) => value.matcherType !== 'EXTENSION_RESOURCE' || (
  /^[a-p]{32}$/.test(value.matcher) &&
  /^[a-zA-Z0-9/_-]+\.(svg|png|webp)$/i.test(value.resourcePath || '') &&
  !value.resourcePath.startsWith('/') &&
  !value.resourcePath.split('/').includes('..')
), {
  message: 'Use a Chrome/Edge extension ID and a relative SVG, PNG, or WebP resource path', path: ['resourcePath'],
});

const updateFingerprintSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  tool: z.string().min(1).max(100).trim().optional(),
  matcherType: z.enum(['SELECTOR', 'IFRAME_SRC', 'GLOBAL_VAR', 'EXTENSION_RESOURCE']).optional(),
  matcher: z.string().min(1).trim().optional(),
  resourcePath: z.string().max(200).optional(),
  weight: z.number().int().min(1).optional(),
  severity: z.enum(['LOW', 'MED', 'HIGH']).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
  allowed: z.boolean().optional(),
}).refine((value) => value.matcherType !== 'EXTENSION_RESOURCE' || (
  /^[a-p]{32}$/.test(value.matcher || '') &&
  /^[a-zA-Z0-9/_-]+\.(svg|png|webp)$/i.test(value.resourcePath || '') &&
  !value.resourcePath.startsWith('/') &&
  !value.resourcePath.split('/').includes('..')
), {
  message: 'Extension resource updates require a valid extension ID and relative image path', path: ['resourcePath'],
});

const updateThresholdSchema = z.object({
  windowMs: z.number().int().min(1000).optional(),
  flagScore: z.number().int().min(1).optional(),
});

const reportQuerySchema = z.object({
  format: z.enum(['json', 'csv']).default('json').optional(),
  range: z.enum(['24h', '7d', '30d', 'all']).default('all').optional(),
});

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(20).optional(),
  search: z.string().default('').optional(),
});

module.exports = {
  idParamSchema,
  sensitivityParamSchema,
  patchFlagSchema,
  signalsBatchSchema,
  createFingerprintSchema,
  updateFingerprintSchema,
  updateThresholdSchema,
  reportQuerySchema,
  paginationQuerySchema,
};
