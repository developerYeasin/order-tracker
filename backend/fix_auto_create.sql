-- Fix Steadfast Auto-Create Setting
-- Run this SQL script on your order_tracker database to enable automatic Steadfast consignment creation

UPDATE settings
SET settings_value = 'true'
WHERE settings_key = 'auto_create_courier';

-- Verify the update
SELECT settings_key, settings_value FROM settings WHERE settings_key = 'auto_create_courier';
