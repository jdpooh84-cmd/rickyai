-- Add error_details column to messages table for transport failure recording.
-- provider_message_id already exists from 20260903000006_milestone5_messaging.sql.
alter table messages add column if not exists error_details jsonb;
