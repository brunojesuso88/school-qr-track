import { z } from 'zod';

// Phone number regex for Brazilian format (10 or 11 digits)
const phoneRegex = /^\d{10,11}$/;

// Name regex allowing letters (including accented), spaces, and hyphens
const nameRegex = /^[a-zA-ZÀ-ÿ\s\-']+$/;

// Student form validation schema
export const studentSchema = z.object({
  full_name: z.string()
    .min(3, 'Nome deve ter pelo menos 3 caracteres')
    .max(100, 'Nome muito longo (máximo 100 caracteres)')
    .regex(nameRegex, 'Nome deve conter apenas letras'),
  guardian_name: z.union([
    z.literal(''),
    z.string()
      .min(3, 'Nome do responsável deve ter pelo menos 3 caracteres')
      .max(100, 'Nome muito longo (máximo 100 caracteres)')
      .regex(nameRegex, 'Nome deve conter apenas letras'),
  ]),
  guardian_phone: z.union([
    z.literal(''),
    z.string()
      .regex(phoneRegex, 'Telefone deve ter 10 ou 11 dígitos'),
  ]),
  class: z.string()
    .min(1, 'Turma é obrigatória')
    .max(50, 'Nome da turma muito longo'),
  shift: z.enum(['morning', 'afternoon', 'evening']),
  status: z.string().optional(),
  has_medical_report: z.boolean().optional(),
  medical_report_details: z.string().max(1000, 'Detalhes muito longos (máximo 1000 caracteres)').optional().nullable(),
});

// Class form validation schema
export const classSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(50, 'Nome muito longo (máximo 50 caracteres)'),
  description: z.string()
    .max(500, 'Descrição muito longa (máximo 500 caracteres)')
    .optional()
    .nullable(),
  shift: z.enum(['morning', 'afternoon', 'evening']),
});

// Occurrence form validation schema
export const occurrenceSchema = z.object({
  type: z.string().min(1, 'Tipo é obrigatório'),
  description: z.string()
    .max(1000, 'Descrição muito longa (máximo 1000 caracteres)')
    .optional()
    .nullable(),
  date: z.date(),
});

// QR code validation
export const qrCodeSchema = z.string()
  .regex(/^STU-\d+-[a-z0-9]+$/, 'QR code inválido');

// Helper function to validate phone number
export const validatePhone = (phone: string): boolean => {
  return phoneRegex.test(phone.replace(/\D/g, ''));
};

// Helper function to format phone number (remove non-digits)
export const formatPhone = (phone: string): string => {
  return phone.replace(/\D/g, '');
};

// Types for validated data
export type StudentFormData = z.infer<typeof studentSchema>;
export type ClassFormData = z.infer<typeof classSchema>;
export type OccurrenceFormData = z.infer<typeof occurrenceSchema>;
