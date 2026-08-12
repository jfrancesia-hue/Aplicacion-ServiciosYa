-- La Ley 25.326, art. 7.4, reserva el tratamiento de antecedentes penales o
-- contravencionales a las autoridades públicas competentes. Se preservan los
-- valores históricos para una depuración controlada, pero se bloquean nuevas
-- cargas desde cuentas de aplicación.

create or replace function public.prevent_private_criminal_record_collection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' and new.antecedentes is not null then
      raise exception 'CRIMINAL_RECORD_DOCUMENTS_NOT_ACCEPTED';
    end if;
    if tg_op = 'UPDATE'
      and new.antecedentes is distinct from old.antecedentes then
      raise exception 'CRIMINAL_RECORD_DOCUMENTS_NOT_ACCEPTED';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_private_criminal_record_collection
  on public.usuarios;
create trigger prevent_private_criminal_record_collection
before insert or update of antecedentes on public.usuarios
for each row execute function public.prevent_private_criminal_record_collection();
