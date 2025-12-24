-- Primeiro: Adicionar nova role 'direction' ao enum app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'direction';