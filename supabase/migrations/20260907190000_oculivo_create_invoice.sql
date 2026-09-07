-- Transactional invoice creation for Oculivo.
-- Invoice header and line items succeed or roll back together.

create or replace function public.oculivo_create_invoice(
  p_organization_id uuid,
  p_patient_id uuid,
  p_invoice_number text,
  p_insurance_amount numeric default 0,
  p_due_date date default null,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_invoice_id uuid;
  v_role text;
  v_subtotal numeric := 0;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
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

  if nullif(trim(p_invoice_number), '') is null then
    raise exception 'invoice number is required';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'at least one invoice line item is required';
  end if;

  select coalesce(sum(quantity * unit_price),0)
    into v_subtotal
  from jsonb_to_recordset(p_items) as x(description text, quantity numeric, unit_price numeric)
  where nullif(trim(description),'') is not null
    and quantity > 0
    and unit_price >= 0;

  if v_subtotal <= 0 then
    raise exception 'invoice subtotal must be greater than zero';
  end if;

  if coalesce(p_insurance_amount,0) < 0 or coalesce(p_insurance_amount,0) > v_subtotal then
    raise exception 'insurance amount must be between zero and subtotal';
  end if;

  insert into public.invoices (
    organization_id,
    patient_id,
    invoice_number,
    subtotal,
    insurance_amount,
    patient_amount,
    due_date,
    created_by
  )
  values (
    p_organization_id,
    p_patient_id,
    trim(p_invoice_number),
    v_subtotal,
    coalesce(p_insurance_amount,0),
    v_subtotal - coalesce(p_insurance_amount,0),
    p_due_date,
    auth.uid()
  )
  returning id into v_invoice_id;

  insert into public.invoice_items (
    organization_id,
    invoice_id,
    description,
    quantity,
    unit_price,
    total
  )
  select
    p_organization_id,
    v_invoice_id,
    trim(description),
    quantity,
    unit_price,
    quantity * unit_price
  from jsonb_to_recordset(p_items) as x(description text, quantity numeric, unit_price numeric)
  where nullif(trim(description),'') is not null
    and quantity > 0
    and unit_price >= 0;

  return v_invoice_id;
end;
$$;

revoke all on function public.oculivo_create_invoice(uuid,uuid,text,numeric,date,jsonb) from public;
grant execute on function public.oculivo_create_invoice(uuid,uuid,text,numeric,date,jsonb) to authenticated;
