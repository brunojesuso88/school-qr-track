import { describe, expect, it } from 'vitest';
import {
  defaultSchoolPreferences,
  initialStudentStatusFilter,
  isValidAcademicYear,
  parseSchoolPreferences,
} from '../schoolPreferences';

describe('parseSchoolPreferences', () => {
  it('aplica defaults quando não há valores', () => {
    const prefs = parseSchoolPreferences(null);
    expect(prefs).toEqual(defaultSchoolPreferences());
    expect(prefs.show_inactive_students).toBe(true);
    expect(prefs.default_student_sort).toBe('name-asc');
  });

  it('lê valores válidos', () => {
    expect(
      parseSchoolPreferences({
        academic_year: 2027,
        current_bimester: 3,
        show_inactive_students: false,
        default_student_sort: 'ira-desc',
      }),
    ).toEqual({
      academic_year: 2027,
      current_bimester: 3,
      show_inactive_students: false,
      default_student_sort: 'ira-desc',
    });
  });

  it('aceita strings JSON legadas', () => {
    const prefs = parseSchoolPreferences({
      academic_year: '"2025"',
      default_student_sort: '"absences-desc"',
      show_inactive_students: 'false',
    });
    expect(prefs.academic_year).toBe(2025);
    expect(prefs.default_student_sort).toBe('absences-desc');
    expect(prefs.show_inactive_students).toBe(false);
  });

  it('ignora valores inválidos', () => {
    const prefs = parseSchoolPreferences({
      academic_year: 1990,
      current_bimester: 9,
      default_student_sort: 'random',
    });
    expect(prefs).toEqual(defaultSchoolPreferences());
  });
});

describe('isValidAcademicYear', () => {
  it('valida faixa 2020–2100', () => {
    expect(isValidAcademicYear(2020)).toBe(true);
    expect(isValidAcademicYear(2100)).toBe(true);
    expect(isValidAcademicYear(2019)).toBe(false);
    expect(isValidAcademicYear(2101)).toBe(false);
    expect(isValidAcademicYear(2026.5)).toBe(false);
  });
});

describe('initialStudentStatusFilter', () => {
  it('preserva comportamento atual quando desistentes são exibidos', () => {
    expect(initialStudentStatusFilter(true)).toBe('all');
    expect(initialStudentStatusFilter(false)).toBe('active');
  });
});
