-- Adicionar 'user' ao enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'user';

-- Atualizar função para atribuir 'user' por padrão (não admin)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  
  -- Novos usuários recebem role 'user' por padrão (mobile users)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;