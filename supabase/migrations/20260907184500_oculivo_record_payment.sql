-- Transactional billing payment posting for Oculivo.
-- Keeps payment insert + invoice amount reconciliation atomic.

create or replace function public.oculivo_record_payment(
  p_organization_id uuid,
  p_patient_id uuid,
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_reference_number text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_payment_id uuid;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'payment amount must be greater than zero';
  end if;

  select role::text
    into v_role
  from public.organization_memberships
  where organization_id = p_organization_id
    and user_id = auth.uid()
    and is_active = true
  limit 1;

  if v_role is null or v_role not in ('owner','admin','manager','billing') then
    raise exception 'billing permission required';
  end if;

  if not exists (
    select 1 from public.patients
    where id = p_patient_id
      and organization_id = p_organization_id
  ) then
    raise exception 'patient not found in active organization';
  end if;

  if p_invoice_id is not null then
    if not exists (
      select 1 from public.invoices
      where id = p_invoice_id
        and organization_id = p_organization_id
        and patient_id = p_patient_id
    ) then
      raise exception 'invoice not found for patient';
    end if;
  end if;

  insert into public.payments (
    organization_id,
    patient_id,
    invoice_id,
    amount,
    payment_method,
    reference_number,
    recorded_by
  )
  values (
    p_organization_id,
    p_patient_id,
    p_invoice_id,
    p_amount,
    p_payment_method,
    nullif(trim(p_reference_number), ''),
    auth.uid()
  )
  returning id into v_payment_id;

  if p_invoice_id is not null then
    update public.invoices
       set amount_paid = coalesce(amount_paid,0) + p_amount
     where id = p_invoice_id
       and organization_id = p_organization_id
       and patient_id = p_patient_id;
  end if;

  return v_payment_id;
end;
$$;

revoke all on function public.oculivo_record_payment(uuid,uuid,uuid,numeric,text,text) from public;
grant execute on function public.oculivo_record_payment(uuid,uuid,uuid,numeric,text,text) to authenticated;
